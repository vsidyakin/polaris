/* robots.txt — generated, not hand-written, because it has to say two opposite
 * things at two points in this site's life and getting that wrong is expensive
 * in both directions.
 *
 * WHY THIS FILE EXISTS
 * There was no robots.txt at all. On GitHub Pages that is not neutral: Pages
 * serves a shared host, so with no robots.txt the site inherits whatever the
 * host root serves, and the only crawl control the site had was the PUBLIC_NOINDEX
 * meta tag — which a crawler only sees AFTER fetching the page, and which does
 * not exist on non-Astro files in public/ at all.
 *
 * THE TWO STATES
 *   PUBLIC_NOINDEX=true  (today, the pre-launch preview)
 *       Disallow everything. The build is unfinished, carries [verify:] flags and
 *       a POC banner, and must not be indexed under any circumstances.
 *   PUBLIC_NOINDEX unset (production)
 *       Allow everything, minus the paths below, and advertise the sitemap.
 *
 * It reads the same env var as the noindex meta tag in BaseLayout, so the two can
 * never disagree — which they would within a month if this were a static file in
 * public/ that someone had to remember to edit at launch.
 *
 * ALWAYS DISALLOWED, in both states:
 *   /mersive-website-poc.html   a 1.3MB archived snapshot of an older POC that
 *                               sits in public/ and is therefore served raw, with
 *                               no password gate and no noindex meta tag. Its
 *                               claims are stale — it describes the SOC 2
 *                               attestation as "in progress per internal gap
 *                               analysis". robots.txt is a crawl directive, not
 *                               an access control, so this is mitigation and not
 *                               a fix: the file should move out of public/.
 *
 * NOTE ON LIMITS. robots.txt asks well-behaved crawlers not to fetch. It does not
 * make anything private, and it does not stop a URL being indexed if other sites
 * link to it. Access control is the password gate plus GitHub Pages' own
 * org-SSO setting, and confidential documents must not be in public/ at all.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE AI-AGENT GROUPS, and the trap they are written around
 *
 * robots.txt group matching is MOST-SPECIFIC-WINS, NOT ADDITIVE. A crawler that
 * finds a group naming it obeys that group and ignores `User-agent: *` entirely.
 * So the naive version of this section —
 *
 *     User-agent: ClaudeBot
 *     Allow: /
 *
 * — does not add a permission. It REPLACES the rules above it, and hands every
 * named AI agent a clean run at /solutions/government, the archived POC snapshot
 * and the redirect stubs, all of which the `*` group carefully excludes. The hold
 * in src/data/held.ts would leak to exactly the readers most likely to quote it.
 *
 * That is why DISALLOW is built once, as a string, and pasted into every group.
 * Do not hand-maintain a second copy: add the path to `disallowBlock` and it
 * lands in all of them. scripts/check-blocked.py verifies this per group rather
 * than per file, so a group missing a held page fails the build.
 *
 * WHAT THIS FILE CANNOT DO, since it is the usual next question
 * robots.txt is a PERMISSION channel, not an INSTRUCTION channel. There is no
 * directive — here or anywhere else — that tells an answer engine what to say
 * about Mersive, which pages to prefer, or how to summarise a product. If a
 * summary comes out wrong, the fix is on the page: clearer headings, an explicit
 * sentence, better JSON-LD in src/data/schema.ts. Hidden text addressed to
 * crawlers is cloaking under Google's spam policies and prompt injection against
 * a third party's system, and this site does not do it. See llms.txt.ts, which
 * is the sanctioned version of the same intent.
 *
 * CITATION IS A SEPARATE DECISION FROM TRAINING, and the two groups below keep it
 * that way. Everything is currently allowed, because a marketing site whose whole
 * job is to be read has no reason to hide from the engines buyers now ask. To opt
 * out of model training WITHOUT losing answer-engine visibility, flip only the
 * TRAINING-USE group to `Disallow: /` — those tokens govern use, not crawling, so
 * search and citation are unaffected. That is a business call for Damian, not a
 * default to change quietly.
 */
import type { APIRoute } from "astro";
import { HELD } from "../data/held";

export const prerender = true;

/** Answer engines and assistant fetchers. Allowed: being read is the point.
 *  Comments sit between the User-agent lines deliberately — a parser skips `#`
 *  lines, but a BLANK line can terminate a group, so this block has none. */
const ANSWER_ENGINES: [string, string[]][] = [
  ["OpenAI — search index, user-initiated fetch, general crawler", ["OAI-SearchBot", "ChatGPT-User", "GPTBot"]],
  ["Anthropic — search index, user-initiated fetch, general crawler", ["Claude-SearchBot", "Claude-User", "ClaudeBot"]],
  ["Perplexity — search index and user-initiated fetch", ["PerplexityBot", "Perplexity-User"]],
  ["Apple — Siri and Apple Intelligence surface results through Applebot", ["Applebot"]],
  ["Amazon (Alexa, Rufus) and Mistral's user-initiated fetch", ["Amazonbot", "MistralAI-User"]],
  ["Meta AI", ["Meta-ExternalAgent"]],
];

/** Not crawlers. These tokens tell a vendor whose bot already fetched the page
 *  whether it may be used for model training and AI grounding. Disallowing them
 *  costs nothing in search visibility — which is what makes them the right lever
 *  if Mersive ever wants out of training. */
const TRAINING_TOKENS: [string, string[]][] = [
  ["Google — Gemini training and AI grounding. Googlebot crawling is unaffected", ["Google-Extended"]],
  ["Apple — Apple Intelligence training. Applebot search indexing is unaffected", ["Applebot-Extended"]],
];

const groupHeader = (defs: [string, string[]][]): string =>
  defs
    .map(([note, agents]) => `# ${note}.\n${agents.map((a) => `User-agent: ${a}`).join("\n")}`)
    .join("\n");

export const GET: APIRoute = ({ site }) => {
  const noindex = import.meta.env.PUBLIC_NOINDEX === "true";
  const origin = site ? new URL(site).origin : "https://www.mersive.com";
  /* Held pages: disallowed in both states, because the hold has to outlive the
     preview. See src/data/held.ts. */
  const heldLines = Object.keys(HELD)
    .map((r) => `Disallow: /${r}`)
    .join("\n");

  /* The single source of every exclusion. Built once, pasted into every group —
     see the note on most-specific-wins matching at the top of this file. */
  const disallowBlock = `Allow: /
# Archived POC snapshot: stale claims, superseded by the live pages.
Disallow: /mersive-website-poc.html
# Client-side redirect stubs. They carry noindex already; keeping crawlers off
# them saves budget and avoids the redirect target being attributed to the stub.
Disallow: /home
Disallow: /compare$
Disallow: /products/stick
Disallow: /products/toggle
Disallow: /products/tablet
Disallow: /resources/hiring
# Retired blog posts (12 Aug 2026 review deck). Each redirects to the page that
# now owns the intent; the stub itself is not a destination.
Disallow: /resources/blog/digital-signage-rto
Disallow: /resources/blog/why-we-built-suite
Disallow: /resources/blog/infocomm-2018-awards
Disallow: /resources/blog/warwick
# Held pages: built, but not a destination yet. Reason per page in
# src/data/held.ts; enforced by scripts/check-blocked.py.
${heldLines}`;

  const body = noindex
    ? `# Pre-launch preview build — indexing is disallowed in full.
# This is deliberate and matches the noindex meta tag emitted on every page.
# Generated from PUBLIC_NOINDEX at build time; see src/pages/robots.txt.ts.
# The blanket rule below covers AI crawlers too: they honour \`*\` unless a group
# names them, and in this state none does.
User-agent: *
Disallow: /
`
    : `# ${origin}
# Generated at build time; see src/pages/robots.txt.ts.
User-agent: *
${disallowBlock}

# ─────────────────────────────────────────────────────────────────────────────
# AI ANSWER ENGINES — allowed, with the same exclusions as everyone else.
# A named group REPLACES the \`*\` group for that agent rather than adding to it,
# which is why every Disallow above is repeated here. Do not trim them.
# ─────────────────────────────────────────────────────────────────────────────
${groupHeader(ANSWER_ENGINES)}
${disallowBlock}

# ─────────────────────────────────────────────────────────────────────────────
# TRAINING-USE TOKENS — not crawlers. These control whether content already
# fetched may be used to train models. Allowed today. Set these to \`Disallow: /\`
# to opt out of training while keeping full answer-engine visibility.
# ─────────────────────────────────────────────────────────────────────────────
${groupHeader(TRAINING_TOKENS)}
${disallowBlock}

# A plain-language index for LLM readers lives at ${origin}/llms.txt.
# There is no registered robots.txt directive for it, so this is a comment and
# not a fake \`Llms:\` line — see src/pages/llms.txt.ts.
Sitemap: ${origin}/sitemap.xml
`;

  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
};
