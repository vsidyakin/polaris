#!/usr/bin/env node
/**
 * Post-build pass: prefix hand-written root-absolute URLs in dist/ with the
 * deploy base path.
 *
 * Why this exists
 * ---------------
 * The site is authored for the domain root — pages carry ~280 literal
 * `href="/platform/how"` links, inherited from the single-file POC. The GitHub
 * Pages preview serves the same build from /polaris-website/ instead. Rather
 * than thread a helper through every one of those links (a change that would
 * have to be reverted the day the site moves to www.mersive.com), the source
 * stays canonical and this pass rewrites the emitted HTML.
 *
 * Astro's own `base` config already handles what Astro generates: bundled
 * JS/CSS under /_astro/, and anything built through `withBase()` in
 * src/lib/base.ts (the search index, hrefs assembled inside client scripts).
 * Those arrive here already prefixed and are skipped.
 *
 * Usage: BASE_PATH=/polaris-website node scripts/rebase-html.mjs [distDir]
 * No-ops when BASE_PATH is unset or "/", so the production build is untouched.
 */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, extname } from 'node:path';

const raw = process.env.BASE_PATH ?? '/';
const base = raw.replace(/\/+$/, ''); // "/polaris-website", or "" for root
const siteUrl = (process.env.SITE_URL ?? '').replace(/\/+$/, '');
const distDir = process.argv[2] ?? 'dist';

if (!base) {
  console.log('rebase-html: BASE_PATH is root — nothing to rewrite.');
  process.exit(0);
}

/**
 * Attributes whose value may be a root-absolute site path.
 *
 * This list is authoritative — see the lookbehind on `attrRe` below for why it
 * has to be, and what it cost when it was not.
 */
const ATTRS = ['href', 'src', 'action', 'poster', 'data-href', 'data-src'];

/**
 * A value needs prefixing when it starts with a single "/" and does not already
 * sit under the base. "//cdn.example.com" is protocol-relative, not a path.
 */
const needsPrefix = (value) =>
  value.startsWith('/') &&
  !value.startsWith('//') &&
  value !== base &&
  !value.startsWith(`${base}/`);

let filesChanged = 0;
let urlsRewritten = 0;

function rewriteHtml(html) {
  let n = 0;

  /* Attributes: href="/x", src='/x'. Quoted values only — the build never emits
     unquoted attributes.

     THE LOOKBEHIND, and why it is not `\b`.

     `\b` finds a word boundary, and a hyphen is a non-word character, so
     `\bsrc=` matches inside `data-src="…"`. That made this pass rewrite an
     attribute nobody had put on the list, while `data-src-wide="…"` — the very
     next attribute along, on the other video hero — was left alone, because
     there `-wide` sits between `src` and the `=`. Two sibling attributes,
     opposite treatment, neither of them declared anywhere.

     It cost a broken deploy. products/family hands its two films to
     initComicHero() as `data-src`; the script puts them through withBase(),
     because the documented split says a path this pass has never heard of is the
     script's to prefix. This pass had in fact heard of it by accident, so the
     base went on twice — /polaris-website/polaris-website/video/… — and the only
     place that shows is a real Pages build. Locally, where BASE_PATH is unset
     and this whole pass no-ops, both hero films played perfectly.

     `(?<![-\w])` refuses a match preceded by a hyphen as well as by a word
     character, so a `data-`prefixed attribute is rewritten only when it is
     spelled out in ATTRS. `data-href` and `data-src` are, and match at their own
     first character. `data-src-wide` still does not, exactly as before. Anything
     added later fails closed: it is left alone until someone lists it, which is
     a missing prefix — visible immediately — rather than a doubled one. */
  const attrRe = new RegExp(`(?<![-\\w])(${ATTRS.join('|')})=("|')(/[^"']*)\\2`, 'g');
  let out = html.replace(attrRe, (match, attr, quote, value) => {
    if (!needsPrefix(value)) return match;
    n++;
    return `${attr}=${quote}${base}${value}${quote}`;
  });

  // srcset: comma-separated "url descriptor" pairs.
  out = out.replace(/\bsrcset=("|')([^"']*)\1/g, (match, quote, value) => {
    if (!value.includes('/')) return match;
    const parts = value.split(',').map((part) => {
      const trimmed = part.trim();
      const [url, ...rest] = trimmed.split(/\s+/);
      if (!needsPrefix(url)) return trimmed;
      n++;
      return [`${base}${url}`, ...rest].join(' ');
    });
    return `srcset=${quote}${parts.join(', ')}${quote}`;
  });

  // CSS url(/…) inside <style> blocks and style="" attributes.
  out = out.replace(/url\((\s*['"]?)(\/[^'")]*)(['"]?\s*)\)/g, (match, pre, value, post) => {
    if (!needsPrefix(value)) return match;
    n++;
    return `url(${pre}${base}${value}${post})`;
  });

  /* Astro's redirect stubs (astro.config `redirects`) are emitted without the
     base applied: the target lives in a meta-refresh `content` attribute, which
     the attribute pass above deliberately leaves alone. Rewrite it here. */
  out = out.replace(
    /(content=("|')\s*\d+\s*;\s*url=)(\/[^"']*)\2/gi,
    (match, head, quote, value) => {
      if (!needsPrefix(value)) return match;
      n++;
      return `${head}${base}${value}${quote}`;
    }
  );

  /* Same stubs carry an absolute canonical built from `site` with no base —
     https://host/compare/hub instead of https://host/polaris-website/compare/hub.
     Pages that go through BaseLayout already build theirs base-aware, so this
     only ever fires on the stubs. */
  if (siteUrl) {
    const originRe = new RegExp(`${siteUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(/[^"'\\s>]*)`, 'g');
    out = out.replace(originRe, (match, path) => {
      if (!needsPrefix(path)) return match;
      n++;
      return `${siteUrl}${base}${path}`;
    });
  }

  return [out, n];
}

function rewriteCss(css) {
  let n = 0;
  const out = css.replace(/url\((\s*['"]?)(\/[^'")]*)(['"]?\s*)\)/g, (match, pre, value, post) => {
    if (!needsPrefix(value)) return match;
    n++;
    return `url(${pre}${base}${value}${post})`;
  });
  return [out, n];
}

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(path);
    else yield path;
  }
}

for await (const path of walk(distDir)) {
  const ext = extname(path);
  if (ext !== '.html' && ext !== '.css') continue;

  const source = await readFile(path, 'utf8');
  const [out, n] = ext === '.html' ? rewriteHtml(source) : rewriteCss(source);
  if (!n) continue;

  await writeFile(path, out);
  filesChanged++;
  urlsRewritten += n;
}

console.log(`rebase-html: prefixed ${urlsRewritten} URLs with "${base}" across ${filesChanged} files.`);
