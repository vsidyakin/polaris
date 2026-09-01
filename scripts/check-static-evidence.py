#!/usr/bin/env python3
"""Fail if a matrix page publishes its evidence only to browsers that run scripts.

WHY THIS EXISTS

Measured on the built site, 15 Aug 2026:

    dist/compare/hub/index.html          0 <td> cells,   0 source links
    dist/platform/security/index.html  160 <td> cells, 140 source links

The compare hub built its two tables in the browser into a pair of empty divs. So
the page carrying the LARGER body of competitor research — 706 graded, noted and
cited cells — served none of it. A plain fetch got two empty divs. So did a
printout, a reader with script disabled, and an unknown share of the answer
engines that increasingly stand between a buyer and a vendor's website.

That is not a performance detail. The entire claim of these tables is that we
grade vendors on whether their evidence is RETRIEVABLE BY THE PUBLIC. Making that
charge from inside a 539 KB JavaScript bundle fails our own test, in public, in
front of the audience most likely to check.

Damian, 15 Aug 2026: "make the change to compare hub so the data is in html and
crawlable."

WHAT THIS ENFORCES

For every page that carries a matrix: the table element exists in the SERVED
HTML, it contains at least as many cells as there are competitor cells in the
data behind it, and at least as many source links. The thresholds are computed
from src/data/compare.ts, not hardcoded, so adding a vendor or a row raises the
bar automatically and cannot silently pass on yesterday's number.

WHY A COUNT AND NOT "IS THE TABLE THERE"

Because the failure mode this is guarding against is partial. A renderer that
emits the table but drops the hidden columns, or emits the grades but not the
citations, would satisfy any check for the element's existence while losing most
of the evidence — which is exactly the drift that happened once already, when the
Trust Center printed citations and the hub printed none.

Run: python3 scripts/check-static-evidence.py dist   (or `pnpm check:static`)
Exit 0 clean, 1 on any violation.
"""

import io
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "src", "data", "compare.ts")

DEEP_BRANDS = ["Barco ClickShare", "Airtame", "ScreenBeam", "WolfVision Cynap",
               "Kramer VIA", "Crestron AirMedia", "Vivi", "MTR / Zoom Rooms"]

SECURITY_GROUP = "Security & platform"


def counts():
    """Competitor cells per table, read from the data rather than assumed."""
    s = io.open(SRC, encoding="utf-8").read()
    brands = [b.strip().strip('"') for b in
              re.search(r"brands:\s*\[([^\]]+)\]", s).group(1).split(",")]
    di = s.find("export const DEEP")
    comp_rows = len(re.findall(r'\["([^"]+)",\[', s[:di]))
    deep_rows = len(re.findall(r'\["([^"]+)",\[', s[di:]))
    # the security slice, which is what the Trust Center publishes
    i = s.find('{g:"%s"' % SECURITY_GROUP)
    j = s.find('{g:"', i + 10)
    sec_rows = len(re.findall(r'\["([^"]+)",\[', s[i:j]))
    return {
        "hub": comp_rows * len(brands) + deep_rows * len(DEEP_BRANDS),
        "sec": sec_rows * len(brands),
    }


def _stylesheets(dist):
    import glob
    return sorted(glob.glob(os.path.join(ROOT, dist, "_astro", "*.css")))


PAGES = [
    ("compare/hub", "hub", ("cmptable", "dpttable")),
    ("platform/security", "sec", ("sectable",)),
]


def main():
    dist = sys.argv[1] if len(sys.argv) > 1 else "dist"
    need = counts()
    failures, report = [], []

    for route, key, tables in PAGES:
        path = os.path.join(ROOT, dist, *route.split("/"), "index.html")
        if not os.path.exists(path):
            failures.append((route, f"not built at {path}"))
            continue
        h = io.open(path, encoding="utf-8", errors="replace").read()

        for t in tables:
            if f'id="{t}"' not in h:
                failures.append((route, f'no <table id="{t}"> in the served HTML'))

        cells = len(re.findall(r"<td[ >]", h))
        links = len(re.findall(r'class="pws"', h))
        want = need[key]
        report.append((route, cells, links, want))

        if cells < want:
            failures.append((route, f"{cells} <td> cells in the HTML, expected at least "
                                    f"{want} competitor cells — the table is being built "
                                    f"by script, or columns are being dropped"))
        if links < want:
            failures.append((route, f"{links} source links in the HTML, expected at least "
                                    f"{want} — cells are rendering without their citation"))

        # DUPLICATE CARD IDS. Each cell points aria-describedby at its own card,
        # so a screen reader can read the reasoning that is visually hidden. Two
        # cards sharing an id means one of them is unreachable and the other is
        # announced twice — and it happens silently. It nearly shipped: "The pod
        # hosts the call (Link add-on)" is a row in BOTH tables on the hub, so
        # the id had to be namespaced per table.
        ids = re.findall(r'<span class="pwc" id="([^"]+)"', h)
        dupes = {i for i in ids if ids.count(i) > 1}
        if dupes:
            failures.append((route, f"{len(dupes)} duplicate card id(s), e.g. "
                                    f"{sorted(dupes)[:3]} — aria-describedby resolves to "
                                    f"whichever came first, so a cell describes the wrong cell"))

        # An empty container that a script fills is the exact shape of the bug.
        for m in re.finditer(r'<div id="(comptable|deeptable)"[^>]*>\s*</div>', h):
            failures.append((route, f'<div id="{m.group(1)}"> is empty in the served HTML; '
                                    f"its contents exist only after JavaScript runs"))

    # ── The containing-block rule the hover cards depend on ──────────────────
    #
    # The source cards are position:fixed so they can escape .cmpscroll's
    # overflow. That only works while nothing between the card and the viewport
    # has a transform, translate, filter, perspective, contain or will-change —
    # any of those becomes the containing block, which both offsets the card and
    # lets the scroll pane crop it. .reveal, the site's scroll-in animation,
    # compiles to `translate: ...` and stays that way after it finishes, and the
    # Trust Center's matrix lives inside one. That cost three rounds of blaming
    # the placement maths.
    #
    # global.css neutralises it with `.reveal:has(.cmpscroll){translate:none}`.
    # Delete that rule and the cards go back to landing off the table with their
    # citations cropped — a failure that looks cosmetic and hides the evidence.
    # So the rule is checked, in the BUILT stylesheet, where Tailwind has had its
    # say.
    css = " ".join(io.open(p, encoding="utf-8", errors="replace").read()
                   for p in _stylesheets(dist))
    if not re.search(r"\.reveal:has\(\s*\.cmpscroll\s*\)[^{]*\{[^}]*translate:\s*none", css):
        failures.append(("stylesheet",
                         "`.reveal:has(.cmpscroll){translate:none}` is missing from the "
                         "built CSS. Without it a .reveal ancestor becomes the containing "
                         "block for the fixed source cards: they land off the table and "
                         "the scroll pane crops the citation off the bottom."))

    for route, cells, links, want in report:
        print(f"  {route:24s} {cells:5d} cells  {links:5d} source links   (floor {want})")

    if failures:
        print(f"\nFAIL: {len(failures)} matrix page problem(s). Evidence that only exists "
              f"after a script runs is not published evidence.\n")
        for route, why in failures:
            print(f"  - {route}\n      {why}")
        return 1

    total = sum(r[1] for r in report)
    print(f"PASS: {total} matrix cells and {sum(r[2] for r in report)} source links served "
          f"as HTML, before any script runs.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
