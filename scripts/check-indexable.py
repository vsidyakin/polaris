#!/usr/bin/env python3
"""Fail if a production build carries preview-only suppression.

SCOPE. Two things suppress this site, and neither belongs on www.mersive.com:

    crawler blocking   noindex meta tag, robots.txt Disallow: /, the llms.txt
                       do-not-quote preamble. All three from PUBLIC_NOINDEX.
    the password gate  data-gate="locked" on <html> plus the PageGate markup,
                       from SITE_PASSWORD.

They are checked together because they are one defect with two spellings —
preview machinery surviving into production — and because both are read off the
same built tree. src/layouts/BaseLayout.astro already refuses to BUILD a gated
production page; this is the backstop that reads what actually shipped.

THE PROBLEM THIS SOLVES

Crawler blocking on this site is two separate mechanisms driven by one env var:

    PUBLIC_NOINDEX=true  ->  <meta name="robots" content="noindex, nofollow"> on
                             every page (src/layouts/BaseLayout.astro), AND
                             robots.txt reduced to `User-agent: * / Disallow: /`
                             (src/pages/robots.txt.ts), AND a DO-NOT-QUOTE
                             preamble on llms.txt (src/pages/llms.txt.ts).

Both are correct for the GitHub Pages preview and both are wrong for
www.mersive.com. The failure mode is silent in the worst possible way: nothing
errors, no page looks broken, the site is up and serving — and it can never be
indexed. You find out from the absence of traffic, weeks later, which is far too
late for a launch.

The gate fails the same way but louder and worse: a gated production site is not
a degraded launch, it is an invisible one. Every visitor meets a password prompt
for a password nobody issued them, while the site looks live from the inside.

That was not a hypothetical. PUBLIC_NOINDEX was hardcoded at workflow level in
.github/workflows/deploy.yml, so the documented way to go live produced exactly
that state.

WHAT COUNTS AS A PRODUCTION BUILD

The origin in the build itself, read from the canonical link on the home page. A
build whose canonical URLs point at www.mersive.com IS the production site by
definition — that is the URL it tells crawlers to index — regardless of which
command produced it. So this needs no flag and cannot be fooled by one:

    origin = www.mersive.com   ->  production. Crawler blocking is a FAILURE.
    anything else              ->  a Pages preview or a local build. Blocking is
                                   expected; an unblocked one warns, because an
                                   indexable preview competes with production as
                                   duplicate content on a second origin.

WHAT IT CHECKS IN EITHER STATE

The two mechanisms must agree. `Disallow: /` with no noindex tags, or noindex
tags with a permissive robots.txt, means one of them was edited and the other
was not — and whichever one a given crawler happens to honour then decides the
outcome. Both directions are reported.

THE ONE DOCUMENTED EXCEPTION

Pages listed in src/data/held.ts carry noindex in every state, on purpose: a hold
has to outlive the preview. Those are excluded here and enforced separately by
scripts/check-blocked.py. Nothing else is exempt.

WHAT THIS DOES NOT CHECK
Whether the site SHOULD be indexed, and whether the content is ready. It reads
what the build says, not whether saying it is a good idea.

Run against a build: python3 scripts/check-indexable.py [dist-dir]   (default dist)
Exit 0 clean (warnings included), 1 on any violation.
"""

import glob
import io
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# The production origin, as hard-coded in astro.config.mjs and src/data/schema.ts.
# Kept as a host rather than a full URL so a scheme or trailing-slash difference
# cannot produce a false pass.
PROD_HOST = "www.mersive.com"

NOINDEX_TAG = re.compile(r'<meta\s+name="robots"\s+content="[^"]*noindex', re.I)
CANONICAL = re.compile(r'<link\s+rel="canonical"\s+href="([^"]+)"', re.I)
# The gate has two halves and either one alone is a defect: the attribute without
# the markup hides the page with no way to unlock it, and the markup without the
# attribute ships a dormant prompt plus the salted hash. Both are matched.
GATE_ATTR = re.compile(r'<html[^>]*\sdata-gate="locked"', re.I)
GATE_MARKUP = re.compile(r'class="gate(?:\s|")|id="gate-form"', re.I)


def held_routes():
    """Route keys from src/data/held.ts, read as text rather than executed.

    Same approach as scripts/check-blocked.py, and for the same reason: the
    verification tree is an rsync copy with no node_modules, so this stays
    dependency-free and runnable against any build.
    """
    p = os.path.join(ROOT, "src", "data", "held.ts")
    if not os.path.exists(p):
        return set()
    src = io.open(p, encoding="utf-8").read()
    body = src[src.find("export const HELD"):]
    body = body[: body.find("};") + 1]
    return set(re.findall(r'^\s*"([^"]+)":', body, re.M))


def robots_blocks_everything(text):
    """True if the `*` group disallows the whole site.

    Only the `*` group matters for this question. The named AI-agent groups in
    robots.txt.ts repeat the same block, and check-blocked.py already verifies
    per-group consistency; duplicating that here would report one fault twice.
    """
    in_star = False
    for raw in text.splitlines():
        line = raw.split("#", 1)[0].strip()
        if not line or ":" not in line:
            continue
        field, _, value = line.partition(":")
        field, value = field.strip().lower(), value.strip()
        if field == "user-agent":
            in_star = value == "*"
        elif in_star and field == "disallow" and value == "/":
            return True
    return False


def main():
    root = sys.argv[1] if len(sys.argv) > 1 else "dist"
    if not os.path.isdir(root):
        print(f"FAIL: no build at {root!r}. Run a build first.")
        return 1

    held = held_routes()

    rp = os.path.join(root, "robots.txt")
    if not os.path.exists(rp):
        print("FAIL: no robots.txt in the build. It is generated by "
              "src/pages/robots.txt.ts, so its absence means that route stopped "
              "building — and with no robots.txt at all, Pages serves whatever "
              "the shared host root serves.")
        return 1
    robots = io.open(rp, encoding="utf-8").read()

    robots_blocked = robots_blocks_everything(robots)
    advertises_sitemap = re.search(r"^\s*Sitemap:", robots, re.M | re.I) is not None

    # Walk the pages: which carry noindex or the gate, and what origin they claim.
    noindexed, gated, origin, checked = [], [], None, 0
    for f in sorted(glob.glob(os.path.join(root, "**", "index.html"), recursive=True)):
        raw = io.open(f, encoding="utf-8", errors="ignore").read()
        # Redirect stubs carry noindex from Astro itself, in every state. They are
        # not ours to switch and are disallowed in robots.txt anyway.
        if "Redirecting to:" in raw[:2000]:
            continue
        route = os.path.relpath(os.path.dirname(f), root).replace(os.sep, "/")
        route = "" if route == "." else route
        checked += 1

        if origin is None:
            m = CANONICAL.search(raw)
            if m:
                origin = m.group(1)

        if NOINDEX_TAG.search(raw) and route not in held:
            noindexed.append("/" + route)

        # No held-page exemption here: a hold suppresses discovery, never access.
        if GATE_ATTR.search(raw) or GATE_MARKUP.search(raw):
            gated.append("/" + route)

    if not checked:
        print(f"FAIL: no pages found under {root!r}. Run a build first.")
        return 1

    is_prod = bool(origin) and PROD_HOST in origin
    where = origin or "<no canonical found>"
    state = "BLOCKED" if (robots_blocked or noindexed) else "ALLOWED"

    print(f"Build origin : {where}")
    print(f"Target       : {'PRODUCTION' if is_prod else 'preview / local'}")
    print(f"INDEXING     = {state}")
    print(f"  robots.txt : {'Disallow: / (whole site)' if robots_blocked else 'permissive'}"
          f"{'' if advertises_sitemap else ', no Sitemap: line'}")
    print(f"  noindex tag: {len(noindexed)} of {checked} pages"
          f"{f' (+{len(held)} held, exempt)' if held else ''}")
    print(f"  gate        : {'present on ' + str(len(gated)) + ' pages' if gated else 'none'}")
    print()

    problems = []

    # The two mechanisms must agree, in either state. Whichever a given crawler
    # honours would otherwise decide the outcome on its own.
    if robots_blocked and not noindexed:
        problems.append((
            "MECHANISMS DISAGREE",
            "robots.txt disallows the whole site but no page carries a noindex "
            "tag. A crawler that reached a page by an inbound link — robots.txt "
            "does not stop a URL being indexed, only fetched — would index it. "
            "Both come from PUBLIC_NOINDEX, so one of the two readers "
            "(src/pages/robots.txt.ts, src/layouts/BaseLayout.astro) has changed."))
    if noindexed and not robots_blocked:
        problems.append((
            "MECHANISMS DISAGREE",
            f"{len(noindexed)} page(s) carry noindex but robots.txt is permissive "
            f"and advertises the sitemap. The site invites crawling and then tells "
            f"each page not to be indexed. First: {', '.join(noindexed[:3])}"))

    if is_prod:
        # The gate first: an unindexable production site is invisible to search,
        # a gated one is invisible to everybody.
        if gated:
            problems.append((
                "PRODUCTION BUILD SHIPS THE PASSWORD GATE",
                f"{len(gated)} page(s) carry the preview gate — data-gate=\"locked\" "
                f"or the PageGate markup. First: {', '.join(gated[:5])}. Every "
                f"visitor to www.mersive.com would meet a password prompt for a "
                f"password that was never issued. SITE_PASSWORD must be unset for "
                f"production; `pnpm build:prod` clears it, and BaseLayout throws on "
                f"a gated production build, so reaching this check means both were "
                f"bypassed."))

        # The launch trap, caught mechanically.
        if robots_blocked:
            problems.append((
                "PRODUCTION BUILD IS BLOCKED IN robots.txt",
                "this build's canonical URLs point at www.mersive.com, and its "
                "robots.txt says `Disallow: /`. The production site would be live, "
                "correct and permanently unindexable, with nothing in the build "
                "log to say so. PUBLIC_NOINDEX must be unset for production — "
                "`pnpm build:prod` clears it and the other three env vars."))
        if noindexed:
            problems.append((
                "PRODUCTION PAGES CARRY noindex",
                f"{len(noindexed)} page(s) not held in src/data/held.ts ship "
                f"<meta name=\"robots\" content=\"noindex\">. First: "
                f"{', '.join(noindexed[:5])}. Held pages are the only permitted "
                f"exception; anything else is the preview flag leaking into "
                f"production."))
        if not advertises_sitemap:
            problems.append((
                "PRODUCTION robots.txt DOES NOT ADVERTISE THE SITEMAP",
                "the `Sitemap:` line is how a crawler finds sitemap.xml without "
                "guessing. It is emitted only in the permissive state of "
                "src/pages/robots.txt.ts."))

        lp = os.path.join(root, "llms.txt")
        if os.path.exists(lp):
            llms = io.open(lp, encoding="utf-8").read(400)
            if "DO NOT QUOTE" in llms.upper():
                problems.append((
                    "PRODUCTION llms.txt SAYS DO NOT QUOTE",
                    "the pre-launch preamble from src/pages/llms.txt.ts is still "
                    "there, telling every AI reader that this build is unreleased "
                    "and must not be cited. It is emitted only when "
                    "PUBLIC_NOINDEX=true."))

    if problems:
        print(f"FAIL: {len(problems)} problem(s).\n")
        for kind, detail in problems:
            print(f"  {kind}\n      {detail}\n")
        return 1

    if is_prod:
        print("PASS: production build, no preview suppression of either kind. "
              "robots.txt is permissive and advertises the sitemap, no page "
              "outside src/data/held.ts carries noindex, and no page ships the "
              "password gate.")
    elif state == "ALLOWED":
        # Not a failure — it may have been chosen deliberately via INDEXABLE — but
        # it is never the default and is worth seeing in the log.
        print("PASS, WITH A WARNING: this is not a production build, and it is "
              "crawlable.")
        print(f"  Canonical URLs point at {where}, so indexing this build puts a "
              f"second copy of the site in search results, competing with "
              f"www.mersive.com as duplicate content.")
        print("  Correct only if that was the intent — see INDEXABLE in "
              ".github/workflows/deploy.yml. Branch previews cannot reach this "
              "state by design.")
    else:
        print("PASS: preview build, crawler blocking fully applied — "
              "robots.txt disallows everything and every page carries "
              "noindex, nofollow.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
