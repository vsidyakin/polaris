/**
 * Base-path helper.
 *
 * The site is authored as if it lives at the domain root ("/platform/how"),
 * because that is where it ships. The GitHub Pages preview serves it from a
 * subdirectory instead (/polaris-website/), so paths that are *computed* —
 * search-index entries, hrefs built inside client scripts — have to be
 * prefixed at build time.
 *
 * Hand-written `href="/…"` in .astro markup is NOT this helper's job: the
 * post-build pass in `scripts/rebase-html.mjs` rewrites those in `dist/`, which
 * keeps 280-odd links free of boilerplate. Use `withBase()` only where a path
 * is produced by code.
 *
 * `import.meta.env.BASE_URL` is Astro's `base` config, always slash-terminated
 * ("/" when unset). Vite inlines it in both build-time and browser bundles.
 */
const BASE = import.meta.env.BASE_URL.replace(/\/+$/, "");

/** Prefix a root-absolute site path with the configured base. */
export const withBase = (path: string): string =>
  path.startsWith("/") ? `${BASE}${path}` : path;
