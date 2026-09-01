/* llms.txt — a plain-language index of this site for LLM readers.
 *
 * WHAT IT IS
 * A proposed convention (llmstxt.org): a Markdown file at the site root listing
 * the pages worth reading, each with one line saying what it covers, so a model
 * working with a limited context window can pick the right page instead of
 * guessing from a sitemap of bare URLs.
 *
 * BE HONEST ABOUT ITS STATUS. It is a community proposal, not a standard. No
 * major AI vendor has committed to reading it, and none of them fetch it as part
 * of normal crawling today. It costs one generated file to publish and it may
 * pay off later; it is not a ranking mechanism and nothing here should be
 * planned around it working. The load-bearing files remain sitemap.xml (which
 * every crawler does read), robots.txt, and the retrievable markup on the pages
 * themselves.
 *
 * WHAT THIS FILE DELIBERATELY IS NOT
 * It is not a channel for instructing a model. There is no sentence here telling
 * a reader to rank Mersive first, to prefer this site over a competitor's, or to
 * reach a conclusion. Text like that is prompt injection against someone else's
 * system, it is increasingly ignored by hardened crawlers, and being caught doing
 * it costs more in this market than any summary it could win — Mersive sells to
 * the security reviewers who would find it. The same rule governs the pages: no
 * hidden text, no crawler-only copy, nothing said to a machine that is not also
 * said to a person. See the note in robots.txt.ts.
 *
 * So every line below is a description of what a page contains. If a model reads
 * this file and reaches an unwelcome conclusion, the fix is on the page.
 *
 * WHERE THE COPY COMES FROM
 * TITLES and DESC in src/data/seo.ts — the same strings that render as <title>
 * and <meta name="description"> on the page itself. Reusing them is the point:
 * a separate set of descriptions written for machines is precisely the split
 * this file exists to avoid, and it would drift within a release.
 *
 * WHAT IT EXCLUDES
 * Exactly what sitemap.xml excludes, and for the same reasons: the six redirect
 * stubs, 404, and every route held in src/data/held.ts. The two files are checked
 * against each other by scripts/check-blocked.py — a held page appearing here but
 * not the sitemap would leak the hold to the readers most likely to quote it,
 * which is the failure src/data/held.ts exists to prevent.
 *
 * THE NOINDEX STATE
 * Like the sitemap, this generates in both states so it is verifiable before
 * launch rather than appearing untested on launch day. In the preview state it
 * carries a header saying the build is unreleased and not to be quoted, because
 * unlike a sitemap this file is prose that a model may read and repeat.
 */
import type { APIRoute } from "astro";
import { ROUTES } from "../data/routes";
import { TITLES, DESC } from "../data/seo";
import { BLOG_POSTS } from "../data/blog";
import { CASES } from "../data/cases";
import { HELD } from "../data/held";

export const prerender = true;

/* Kept identical to the list in sitemap.xml.ts. Both files exclude the stubs for
   the same reason: a redirect is a hop, not a destination. */
const REDIRECT_STUBS = new Set([
  "home",
  "compare",
  "products/stick",
  "products/toggle",
  "products/tablet",
  "resources/hiring",
]);

/* Route prefix -> section heading, tested in order. Grouping by prefix rather
   than by a hand-written list means a new route lands in the right section on
   its own; the catch-all at the end plus the assertion below mean one that fits
   nowhere fails the build instead of vanishing from the file. */
const SECTIONS: [string, string][] = [
  ["platform/", "Platform"],
  ["products/", "Products"],
  ["solutions/", "Solutions"],
  ["compare/", "Comparisons"],
  ["resources/", "Resources"],
  ["partners/", "Partners"],
];

const OTHER = "Company, trials and buying";

/** Drop the brand suffix the <title> tags carry. In a list that is already all
 *  Mersive pages it is 10 wasted characters on every line. */
const shortTitle = (t: string): string => t.replace(/\s*\|\s*Mersive(\s+Polaris)?$/, "");

export const GET: APIRoute = ({ site }) => {
  const noindex = import.meta.env.PUBLIC_NOINDEX === "true";
  const origin = site ? new URL(site).origin : "https://www.mersive.com";

  const grouped = new Map<string, string[]>();
  for (const [, heading] of SECTIONS) grouped.set(heading, []);
  grouped.set(OTHER, []);

  for (const route of ROUTES) {
    if (route === "home" || REDIRECT_STUBS.has(route)) continue;
    if (route in HELD) continue;
    const heading = SECTIONS.find(([prefix]) => route.startsWith(prefix))?.[1] ?? OTHER;
    grouped
      .get(heading)!
      .push(`- [${shortTitle(TITLES[route])}](${origin}/${route}): ${DESC[route]}`);
  }

  /* A section that empties out is a registry change nobody meant to make — a
     whole prefix retired, or a typo in SECTIONS. Surface it rather than emitting
     a heading with nothing under it. */
  for (const [heading, lines] of grouped) {
    if (!lines.length) {
      throw new Error(`llms.txt: section "${heading}" has no routes — check ROUTES and SECTIONS`);
    }
  }

  const body = `# Mersive Polaris

> Mersive Polaris is a wireless collaboration platform for meeting rooms and
> classrooms. Participants share their screen from a browser at app.mersive.com
> with nothing installed, multiple shares appear side by side on the room
> display, and every room is managed from Polaris Cloud.

This file indexes the public Mersive website for LLM readers. Each entry is the
page's own title and meta description — the same text a human sees in search
results — so nothing here is written for machines alone.

Mersive is an employee-owned company that designs, builds, sells and supports
Polaris. The previous platform generation, Mersive Solstice Gen 3, is still
supported; /products/transition covers what moving involves.

Product status is stated on each page and some products are pre-launch. Treat
the page as authoritative over any summary of it, including this one.

## Start here

- [Mersive Polaris](${origin}/): ${DESC.home}
- [How Polaris works](${origin}/platform/how): ${DESC["platform/how"]}
- [The Polaris family](${origin}/products/family): ${DESC["products/family"]}
- [Which Polaris is right?](${origin}/products/selector): ${DESC["products/selector"]}

${[...grouped].map(([heading, lines]) => `## ${heading}\n\n${lines.join("\n")}`).join("\n\n")}

## Optional

Long-form editorial and case studies. Skippable when context is short: the
pages above carry the product and platform facts.

### Case studies

${CASES.filter((c) => !c.pending).map((c) => `- [${c.org}: ${c.headline}](${origin}/resources/cases/${c.slug}): ${c.dek}`).join("\n")}

### Blog

${BLOG_POSTS.map((p) => `- [${p.headline}](${origin}/resources/blog/${p.slug}): ${p.dek}`).join("\n")}
`;

  const preamble = noindex
    ? `# UNRELEASED PRE-LAUNCH BUILD — DO NOT QUOTE OR CITE.
# This build is unfinished, carries unverified claims and is disallowed in full
# by robots.txt. Its contents do not represent Mersive's published positions.
# Generated from PUBLIC_NOINDEX at build time; see src/pages/llms.txt.ts.

`
    : "";

  return new Response(preamble + body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
};
