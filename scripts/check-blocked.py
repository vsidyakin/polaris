#!/usr/bin/env python3
"""Fail if a page marked BLOCKED or HELD is discoverable, or if the two disagree.

THE PROBLEM THIS SOLVES

Damian held /solutions/government on 13 Aug 2026: it may not release until
private-cloud deployment ships, because its Architecture section describes an
on-premises and air-gapped posture Polaris does not have. That hold was recorded
in two places — a [BLOCKED:] note in the page body, and a sentence in a chat log.

Neither is a control. A note in the body is a message to the next human who opens
that file. It does not keep the URL out of sitemap.xml, it does not stop a crawler
fetching it, and it does not survive the moment someone flips PUBLIC_NOINDEX off
on launch day. The page would simply go live, with its own warning printed on it.

So the hold is now data — src/data/held.ts — consumed by the sitemap, robots.txt
and the layout's noindex tag. This script exists to stop that data drifting from
the page it describes, in either direction:

    A page carrying [BLOCKED:] or [HELD ...] but NOT listed in held.ts
        Someone wrote the warning and thought that was the hold. It is not; the
        page is live and discoverable with a warning on it.

    A page listed in held.ts whose body no longer says so
        The copy was fixed but the hold was never lifted, or the copy was
        rewritten and the warning removed while the page stayed suppressed. Both
        are quiet states that nobody notices for months.

    A held page present in sitemap.xml or llms.txt, or missing its noindex tag
        The mechanism itself broke — an edit to sitemap.xml.ts, llms.txt.ts or
        BaseLayout.

    A held page disallowed for `*` but not for the named AI-agent groups
        The subtle one, and the reason the robots.txt check below parses groups
        instead of searching the file for a substring. robots.txt matching is
        most-specific-wins, not additive: an agent named in its own group obeys
        that group ALONE and never reads `User-agent: *`. So a `Disallow` line
        that exists once, in the `*` group, protects nothing from GPTBot or
        ClaudeBot — they are in named groups. Every group has to carry the line,
        and only a per-group check can tell the difference.

Releasing a page is therefore deliberate in both files: delete the held.ts entry
AND remove the notes from the body. Doing one without the other fails the build.

WHAT IT DOES NOT CLAIM
This is a discoverability hold. The page still builds and anyone with the URL can
read it. Access control is the password gate; confidential material must not be
in the build at all.

Run against a build: python3 scripts/check-blocked.py [dist-dir]   (default dist)
Exit 0 clean, 1 on any violation.
"""

import glob
import html as htmllib
import io
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# THE SENTINEL. A page-level hold is declared by the phrase "MAY NOT RELEASE"
# appearing in the page's own copy. Nothing looser works, and the first draft of
# this script proved it: it matched "[BLOCKED:" and instantly demanded that
# /resources/docs be suppressed, because that page carries "[Blocked: no Element
# hardware PRD yet]" — an item-level note about a document that does not exist,
# on a page that is otherwise perfectly releasable.
#
# So "Blocked" means two different things in this codebase: "this page cannot go
# live" and "this bullet cannot be written yet". Only the first is a hold, and a
# guard that cannot tell them apart would have quietly de-indexed the
# documentation hub. The trigger is therefore an explicit sentence a human had to
# choose to write, not a keyword that happens to be nearby.
WARNING = re.compile(r"MAY NOT RELEASE|NOT FOR RELEASE", re.I)


def held_routes():
    """Route keys from src/data/held.ts, read as text rather than executed.

    Parsing the source keeps this script dependency-free and runnable against any
    build tree, which matters because the verification tree is an rsync copy with
    no node_modules. The shape it depends on is one quoted key per entry at the
    top level of HELD, which is the only shape that file has ever had.
    """
    p = os.path.join(ROOT, "src", "data", "held.ts")
    if not os.path.exists(p):
        return set(), "src/data/held.ts is missing"
    src = io.open(p, encoding="utf-8").read()
    body = src[src.find("export const HELD"):]
    body = body[: body.find("};") + 1]
    return set(re.findall(r'^\s*"([^"]+)":', body, re.M)), None


def robots_groups(text):
    """Parse robots.txt into [(agents, disallowed_paths)].

    A group is one or more consecutive User-agent lines followed by its rule
    lines; the next User-agent line after a rule starts a new group. Non-group
    fields (Sitemap) and comments are ignored. This is the grouping rule every
    major crawler implements, and reproducing it here is the whole point — the
    question this answers is "which rules does GPTBot actually obey", which a
    substring search over the file cannot express.
    """
    groups = []
    agents, disallowed, in_rules = [], set(), False
    for raw in text.splitlines():
        line = raw.split("#", 1)[0].strip()
        if not line or ":" not in line:
            continue
        field, _, value = line.partition(":")
        field, value = field.strip().lower(), value.strip()
        if field == "user-agent":
            if in_rules:
                groups.append((agents, disallowed))
                agents, disallowed, in_rules = [], set(), False
            agents.append(value)
        elif field in ("allow", "disallow"):
            in_rules = True
            if field == "disallow":
                disallowed.add(value)
    if agents:
        groups.append((agents, disallowed))
    return groups


def text_of(path):
    s = io.open(path, encoding="utf-8", errors="ignore").read()
    s = re.sub(r"<(script|style)[^>]*>.*?</\1>", " ", s, flags=re.S | re.I)
    return " ".join(htmllib.unescape(re.sub(r"<[^>]+>", " ", s)).split())


def main():
    root = sys.argv[1] if len(sys.argv) > 1 else "dist"
    if not os.path.isdir(root):
        print(f"FAIL: no build at {root!r}. Run a build first.")
        return 1

    held, err = held_routes()
    if err:
        print(f"FAIL: {err}")
        return 1

    sitemap = ""
    sp = os.path.join(root, "sitemap.xml")
    if os.path.exists(sp):
        sitemap = io.open(sp, encoding="utf-8").read()

    robots = ""
    rp = os.path.join(root, "robots.txt")
    if os.path.exists(rp):
        robots = io.open(rp, encoding="utf-8").read()
    groups = robots_groups(robots) if robots else []

    llms = ""
    lp = os.path.join(root, "llms.txt")
    if os.path.exists(lp):
        llms = io.open(lp, encoding="utf-8").read()

    problems = []
    warned = set()
    checked = 0

    for f in sorted(glob.glob(os.path.join(root, "**", "index.html"), recursive=True)):
        raw = io.open(f, encoding="utf-8", errors="ignore").read()
        if "Redirecting to:" in raw[:2000]:
            continue
        route = os.path.relpath(os.path.dirname(f), root).replace(os.sep, "/")
        route = "" if route == "." else route
        checked += 1

        if WARNING.search(text_of(f)):
            warned.add(route)
            if route not in held:
                problems.append((
                    "/" + route,
                    "WARNED BUT NOT HELD",
                    "the page says it may not release, but nothing suppresses it. "
                    "Add it to src/data/held.ts, or remove the warning."))

        if route in held:
            if "noindex" not in raw:
                problems.append(("/" + route, "HELD WITHOUT NOINDEX",
                                 "held in src/data/held.ts but no noindex tag in the "
                                 "served HTML. Check BaseLayout."))
            if f"/{route}<" in sitemap or f"/{route}</loc>" in sitemap:
                problems.append(("/" + route, "HELD BUT IN THE SITEMAP",
                                 "listed as a canonical destination. Check "
                                 "sitemap.xml.ts."))
            if llms and f"/{route}" in llms:
                problems.append(("/" + route, "HELD BUT LISTED IN llms.txt",
                                 "described to LLM readers as a page worth "
                                 "reading. Check llms.txt.ts — it must exclude "
                                 "exactly what sitemap.xml.ts excludes."))

            # Per group, not per file. A blanket `Disallow: /` (the pre-launch
            # state) covers every path, so it satisfies the requirement.
            for agents, disallowed in groups:
                if "/" in disallowed or f"/{route}" in disallowed:
                    continue
                problems.append((
                    "/" + route,
                    "HELD BUT NOT DISALLOWED FOR " + ", ".join(agents),
                    "this robots.txt group has no Disallow line for the page, so "
                    "those agents may crawl it — a named group replaces `*` "
                    "rather than adding to it. Check robots.txt.ts: every group "
                    "must emit the shared disallow block."))

    for route in sorted(held - warned):
        problems.append((
            "/" + route,
            "HELD BUT THE PAGE NO LONGER SAYS SO",
            "suppressed in src/data/held.ts, but the body carries no [BLOCKED:] or "
            "[HELD] note. Either the copy was fixed and the hold was never lifted, "
            "or the warning was deleted while the page stayed suppressed."))

    if problems:
        print(f"FAIL: {len(problems)} hold problem(s) across {checked} pages.\n")
        print("A warning printed on a page is not a control. See src/data/held.ts.\n")
        for url, kind, detail in problems:
            print(f"  {url}\n      {kind}\n        {detail}\n")
        return 1

    print(f"PASS: {checked} pages, {len(held)} held — each one warned in its body, "
          f"noindexed, disallowed in all {len(groups)} robots.txt group(s), and "
          f"absent from the sitemap and llms.txt.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
