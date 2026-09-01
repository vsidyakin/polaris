#!/usr/bin/env python3
"""Fail if any built page has a broken heading outline.

WHY
A crawler and an answer engine both read the heading outline to work out what a
page is about and how it is organised. Three defects were live before this check
existed, and none was visible from the source:

1. EVERY page carried two H1s. The password gate's "Pre-launch preview" was an
   <h1>, server-rendered ahead of the page's own, so on all 120 pages the first
   heading a machine saw was not the subject. "pre-launch" and "preview" were
   consequently the most-emphasised terms on the entire site, outranking every
   real keyword.
2. Seven H3s per page came from the hidden Easter-egg game overlay — NETWORK
   INTERFERENCE, PACKET MUNCHER, DONGLE PATROL and friends. Every commercial page
   on the site published arcade-game headings.
3. 24 pages jumped H1 -> H3, because they open with a grid of H3 cards and no H2
   above it.

All three are fixed. This exists so they stay fixed, because every one of them was
introduced by an edit that looked completely reasonable in isolation.

WHAT IT CHECKS, per built page
  * exactly one H1
  * the first heading is that H1
  * no level is skipped going down (H1 -> H3 fails; H3 -> H1 is fine, that is
    closing a section, not skipping one)
  * no heading is empty

Redirect stubs are exempt: Astro emits them as meta-refresh pages with no content
and no headings by design.

Run against a build: python3 scripts/check-outline.py [dist-dir]
Defaults to ./dist. Exit 0 clean, 1 on any violation.
"""

import glob
import html
import io
import os
import re
import sys


def text(frag):
    return " ".join(html.unescape(re.sub(r"<[^>]+>", " ", frag)).split())


def main():
    root = sys.argv[1] if len(sys.argv) > 1 else "dist"
    if not os.path.isdir(root):
        print(f"FAIL: no build to check at {root!r}. Run a build first.")
        return 1

    files = sorted(glob.glob(os.path.join(root, "**", "index.html"), recursive=True))
    if not files:
        print(f"FAIL: no index.html found under {root!r}.")
        return 1

    problems = []
    checked = skipped = 0

    for f in files:
        s = io.open(f, encoding="utf-8", errors="ignore").read()
        url = "/" + os.path.relpath(os.path.dirname(f), root).replace(os.sep, "/")
        url = "/" if url == "/." else url
        # Astro's client-side redirect stubs: no content, no headings, by design.
        if "Redirecting to:" in s[:2000]:
            skipped += 1
            continue
        checked += 1

        heads = [(int(m.group(1)), text(m.group(2)))
                 for m in re.finditer(r"<h([1-6])[^>]*>(.*?)</h\1>", s, re.S)]
        levels = [h[0] for h in heads]

        n1 = levels.count(1)
        if n1 != 1:
            problems.append((url, f"{n1} H1 elements, expected exactly 1",
                             [h[1][:44] for h in heads if h[0] == 1]))
        if levels and levels[0] != 1:
            problems.append((url, f"first heading is H{levels[0]}, not H1", [heads[0][1][:44]]))
        for (a, ta), (b, tb) in zip(heads, heads[1:]):
            if b - a > 1:
                problems.append((url, f"outline skips H{a} -> H{b}", [ta[:34], tb[:34]]))
                break
        empty = [i for i, (lv, t) in enumerate(heads) if not t]
        if empty:
            problems.append((url, f"{len(empty)} empty heading(s)", []))

    if problems:
        print(f"FAIL: {len(problems)} heading-outline problem(s) across {checked} pages.\n")
        for url, msg, detail in problems:
            print(f"  {url}")
            print(f"      {msg}")
            for d in detail:
                print(f"        - {d}")
        print("\nFix by adding the missing level, not by demoting the deeper heading.")
        print("Where a page opens with a card grid, an <h2 class=\"sr-only\"> naming the")
        print("group is the pattern used elsewhere on this site.")
        return 1

    print(f"PASS: {checked} pages, every one with a single H1 and no skipped level "
          f"({skipped} redirect stubs exempt).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
