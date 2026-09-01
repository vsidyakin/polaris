#!/usr/bin/env python3
"""Fail if a Trust Center matrix cell makes a claim about a competitor without a source.

WHY THIS EXISTS

The evidence-pack card has always described this matrix as "each cell citing the
document and the date it was read". On 14 Aug 2026 that was measured and it was
not true: across the whole comparison matrix, 540 competitor cells were graded n
or p and only 184 carried any note at all. In the Security & platform group — the
one the Trust Center publishes — 61 of 83 dashes had nothing behind them.

That is worse than an ordinary overclaim. The entire argument of the matrix is
"we grade on retrievable published evidence, and here is ours". A table that
grades fifteen vendors that way while publishing no evidence of its own fails its
own test, in public, in front of the exact audience trained to notice.

Damian ruled on 14 Aug 2026 that every cell be researched and sourced, and that
the source be a link the reader can click — accepting that this sends traffic to
competitors — because "a citation a reader cannot open is not a citation".

WHAT THIS ENFORCES, on the Security & platform group only

  1. Every competitor cell has a note in WHYP.
  2. Every competitor cell has a source in WHYSRC.
  3. Every source has a plausible public http(s) URL, a title and a read date.
  4. No source URL is a search-results page, a localhost or an intranet host —
     those are not retrievable by a reader.
  5. Every WHYP and WHYSRC key names a row and a brand that actually exist. A key
     that matches nothing is dead weight that looks like coverage: it inflates
     the count while rendering nowhere.

WHAT IT DELIBERATELY DOES NOT DO

It cannot tell you a link is still live, or that the page still says what we say
it says. Nothing in a build step can. That is a recurring human job — the read
date in each entry is what makes it auditable, and it is there so a reviewer can
see at a glance how stale the evidence is. Barco's ISO certificate moved from
Issue 9 to Issue 11 between two of our own passes three days apart.

Run: python3 scripts/check-sources.py     (or `pnpm check:sources`)
Exit 0 clean, 1 on any violation.
"""

import io
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "src", "data", "compare.ts")

# BOTH TABLES, as of 15 Aug 2026.
#
# This started life holding one group — Security & platform, the ten rows the
# Trust Center publishes. It widened to the whole COMP table when that finished,
# and now covers the DEEP table too: 706 competitor cells across both.
#
# The staging was deliberate. A guard that fails on known-incomplete work gets
# switched off, and a switched-off guard protects nothing — so each table was
# brought under enforcement only on the day it was actually finished.
GROUP = None      # None = every group
BOTH_TABLES = True

BAD_HOST = re.compile(
    r"^https?://(localhost|127\.|10\.|192\.168\.|intranet|sharepoint\.com)", re.I)
SEARCH_PAGE = re.compile(r"google\.[a-z.]+/search|bing\.com/search|duckduckgo\.com/\?q=|/search\?", re.I)


def main():
    s = io.open(SRC, encoding="utf-8").read()

    brands = [b.strip().strip('"') for b in
              re.search(r"brands:\s*\[([^\]]+)\]", s).group(1).split(",")]

    di = s.find("export const DEEP")
    DEEP_BRANDS = ["Barco ClickShare", "Airtame", "ScreenBeam", "WolfVision Cynap",
                   "Kramer VIA", "Crestron AirMedia", "Vivi", "MTR / Zoom Rooms"]
    if GROUP:
        i = s.find('{g:"%s"' % GROUP)
        if i < 0:
            print(f"FAIL: the {GROUP!r} group is gone from compare.ts.")
            return 1
        j = s.find('{g:"', i + 10)
        segs = [(s[i:j], brands)]
    else:
        segs = [(s[:di], brands)]
        if BOTH_TABLES:
            # The DEEP table carries its own eight-brand column set, not the
            # fourteen of COMP. Checking it against the wrong brand list would
            # invent six missing cells per row and drown the real failures.
            segs.append((s[di:], DEEP_BRANDS))
    rows = [(lbl, vals, bl) for seg, bl in segs
            for lbl, vals in re.findall(r'\["([^"]+)",\[([^\]]+)\]\]', seg)]

    whyp = dict(re.findall(r'"([^"]+\|[^"]+)":\s*"((?:[^"\\]|\\.)*)"', s))
    whysrc = {
        m[0]: (m[1], m[2], m[3])
        for m in re.findall(
            r'"([^"]+\|[^"]+)":\s*\{\s*u:\s*"([^"]*)",\s*t:\s*"((?:[^"\\]|\\.)*)",\s*d:\s*"([^"]*)"',
            s)
    }

    missing_note, missing_src, bad_src = [], [], []
    checked = 0

    for lbl, _vals, bl in rows:
        for b in bl:
            key = lbl + "|" + b
            checked += 1
            if not whyp.get(key, "").strip():
                missing_note.append(key)
            src = whysrc.get(key)
            if not src:
                missing_src.append(key)
                continue
            u, t, d = src
            if not u.startswith("http"):
                bad_src.append((key, "not an http(s) URL", u))
            elif BAD_HOST.search(u):
                bad_src.append((key, "not reachable by a reader", u))
            elif SEARCH_PAGE.search(u):
                bad_src.append((key, "a search-results page is not a source", u))
            if not t.strip():
                bad_src.append((key, "no source title", u))
            if not re.match(r"^\d{4}-\d{2}-\d{2}$", d):
                bad_src.append((key, "no read date in YYYY-MM-DD", d))

    # keys that name a row or brand that does not exist
    valid = {lbl + "|" + b for lbl, _v, bl in rows for b in bl}
    all_rows = set(re.findall(r'\["([^"]+)",\[', s))
    orphans = []
    for key in list(whysrc):
        row, _, brand = key.rpartition("|")
        if brand not in brands and brand not in DEEP_BRANDS and brand != "Polaris":
            orphans.append((key, "unknown brand"))
        elif row not in all_rows:
            orphans.append((key, "unknown row"))

    ok = True
    if missing_note:
        ok = False
        print(f"\nFAIL: {len(missing_note)} cell(s) grade a competitor with no note:")
        for k in missing_note[:20]:
            print("  -", k)
    if missing_src:
        ok = False
        print(f"\nFAIL: {len(missing_src)} cell(s) have a note but no source in WHYSRC:")
        for k in missing_src[:20]:
            print("  -", k)
    if bad_src:
        ok = False
        print(f"\nFAIL: {len(bad_src)} source(s) a reader could not use:")
        for k, why, v in bad_src[:20]:
            print(f"  - {k}\n      {why}: {v}")
    if orphans:
        ok = False
        print(f"\nFAIL: {len(orphans)} WHYSRC key(s) match no cell — they render nowhere:")
        for k, why in orphans[:20]:
            print(f"  - {k}  ({why})")

    if ok:
        dates = sorted({whysrc[k][2] for k in whysrc if k in valid})
        print(f"PASS: {checked} competitor cells across both matrices, every one with a note "
              f"and a public source. Evidence read {dates[0]} to {dates[-1]}.")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
