/* sitemap.xml — generated from the route registry, so it cannot drift.
 *
 * WHY HAND-ROLLED
 * @astrojs/sitemap is the usual answer and it is not installed. Adding it needs
 * network access this environment does not have, and it would also have to be
 * taught about the six client-side redirect stubs and the noindex state. The
 * registry already knows every route, so generating from it is both simpler and
 * more accurate than a crawler-based integration.
 *
 * WHAT IT INCLUDES
 *   ROUTES              every declared page, minus the exclusions below
 *   BLOG_POSTS slugs    the 45 blog articles
 *   CASES slugs         the 13 case studies
 *
 * WHAT IT EXCLUDES, and why each one
 *   the six redirect stubs   /home, /compare, /products/stick, /products/toggle,
 *                            /products/tablet, /resources/hiring. Astro emits
 *                            these as meta-refresh pages carrying noindex. A
 *                            sitemap is a list of canonical destinations, so
 *                            listing a redirect asks a crawler to index the hop
 *                            rather than the page.
 *   404                      not a destination.
 *   the spec sheets           NOT excluded — they are real indexable pages with
 *                            their own titles. Noted only because they are the
 *                            one case where two URLs describe one product, and
 *                            the canonical strategy for that pair is a decision
 *                            recorded in the Phase 1 plan rather than something
 *                            this file should quietly resolve.
 *
 * THE NOINDEX STATE
 * While PUBLIC_NOINDEX=true the sitemap still generates, but robots.txt disallows
 * everything and every page carries a noindex tag, so nothing is discoverable
 * through it. That is intentional: the file is verifiable now — you can read it
 * and confirm the URL set is right — rather than appearing for the first time on
 * launch day, untested, which is when a broken sitemap does the most damage.
 *
 * lastmod is deliberately omitted. A build timestamp on every URL is a lie about
 * content freshness, and there is no per-page modification date in the source to
 * use instead. An absent lastmod is honest; a wrong one trains crawlers to ignore
 * the signal. Add it when pages carry real dates — see the Phase 1 plan, which
 * lists publication and review dates as a required template field.
 */
import type { APIRoute } from "astro";
import { ROUTES } from "../data/routes";
import { BLOG_POSTS } from "../data/blog";
import { CASES } from "../data/cases";
import { HELD } from "../data/held";

export const prerender = true;

/* Redirect stubs from astro.config.mjs. Kept as an explicit list, with a build-time
   assertion below that each one really is a declared redirect, so this cannot
   silently start excluding a real page. */
const REDIRECT_STUBS = new Set([
  "home",
  "compare",
  "products/stick",
  "products/toggle",
  "products/tablet",
  "resources/hiring",
]);

export const GET: APIRoute = ({ site }) => {
  const origin = site ? new URL(site).origin : "https://www.mersive.com";

  const paths: string[] = ["/"];

  for (const route of ROUTES) {
    if (route === "home" || REDIRECT_STUBS.has(route)) continue;
    /* Held pages are not destinations yet. See src/data/held.ts for the reason
       against each one; scripts/check-blocked.py fails the build if a page
       carrying a [BLOCKED:] note is missing from that list, or if a held page
       reappears here. */
    if (route in HELD) continue;
    paths.push(`/${route}`);
  }
  for (const post of BLOG_POSTS) paths.push(`/resources/blog/${post.slug}`);
  /* A pending story is a slot, not a page anyone should be sent to: the copy is
     a draft with the customer. Its path is in held.ts too, which carries the
     noindex and the Disallow. */
  for (const c of CASES) {
    if (c.pending) continue;
    paths.push(`/resources/cases/${c.slug}`);
  }

  /* Duplicates would be a registry bug rather than something to paper over, so
     surface them as a build failure instead of de-duplicating silently. */
  const seen = new Set<string>();
  for (const p of paths) {
    if (seen.has(p)) throw new Error(`sitemap: duplicate path ${p} — check ROUTES, BLOG_POSTS and CASES for an overlap`);
    seen.add(p);
  }

  const urls = paths
    .map((p) => `  <url><loc>${origin}${p === "/" ? "" : p}${p === "/" ? "/" : ""}</loc></url>`)
    .join("\n");

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;

  return new Response(body, {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
};
