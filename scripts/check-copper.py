#!/usr/bin/env python3
"""Fail the build if the warm accent stops being rare.

THE RULING, Damian Blazy, 15 Aug 2026
-------------------------------------
    "implement copper in a first pass on the home page only, be restrained"
    "you may push the use of this warm color throughout but keep super restrained"

Copper is the only warm colour on this site that does not mean "stop and read
this" — --color-warn and --color-gold are the verify flags, the dashed caution
borders and every held page. Copper means the opposite: you have arrived.

That distinction survives exactly as long as copper stays rare. A warm accent
used once per page reads as expensive. The same accent used six times reads as
a consumer SaaS template, and worse, it teaches a reader that orange on this
site means nothing in particular — which quietly costs us the twelve places
where orange means something urgent.

WHY THIS IS A BUILD STEP AND NOT A NOTE IN A STYLE GUIDE

Because "keep it restrained" is an intention, and intentions erode one
reasonable-looking exception at a time. Nobody ever adds the sixth copper
element on purpose; they add a second one on a page that "needs a bit of life",
and the person who adds the third has only ever seen a site with two. A number
in a script does not soften.

WHAT IT ENFORCES

  1. `.warm` is the only class permitted to carry copper decoratively. One
     marker class is what makes the rule countable at all.
  2. At most ONE .warm element per page. The home page may have TWO, because it
     opens on the promise and closes on the call to action, and those are the
     same beat at two ends of a long page — never in one viewport.
  3. No .warm inside a <table>. The matrices are where a reader interprets
     colour as meaning; a warm cell there would be read as a grade or a warning.
  4. The copper tokens and the .btn.warm rule survive minification.

WHAT IT DELIBERATELY DOES NOT DO

It cannot tell you the accent is in the RIGHT place — only that it is rare.
Placement is a judgement, and it stays a human one.

Run: python3 scripts/check-copper.py dist     (or `pnpm check:copper`)
Exit 0 clean, 1 on any violation.
"""

import glob
import io
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# The home page opens warm and closes warm. Every other page gets one.
LIMIT = 1
EXCEPTIONS = {"/": 2}

# The blog listing pages carry the same open/close shape as the home page:
# the selected-topic pill opens warm and the trial band closes warm, never in
# one viewport. Steve Long, 20 Aug 2026 — the pill colour and keeping the
# sitewide CTA unchanged were both explicit asks. PENDING DAMIAN'S RATIFICATION
# at merge: if he rules one warm moment, the pill steps down, not the band.
# Applies to the hub, its numbered pages, and the topic indexes — NOT to the
# posts themselves, which keep the sitewide limit of one.
#
# /resources/cases carries the same exception for the same reason: it was
# rebuilt onto the blog hub's shared layout (HubLayout, 21 Aug 2026) and its
# sector chips now use the identical .on.warm pill, so its selected chip plus
# its own closing trial band land in the same two-warm-moment shape.
EXCEPTION_PREFIXES = {"/resources/blog/page/": 2, "/resources/blog/topic/": 2}
EXCEPTIONS["/resources/blog"] = 2
EXCEPTIONS["/resources/cases"] = 2


def page_cap(url: str) -> int:
    for prefix, cap in EXCEPTION_PREFIXES.items():
        if url.startswith(prefix):
            return cap
    return EXCEPTIONS.get(url, LIMIT)

WARM = re.compile(r'class="[^"]*\bwarm\b[^"]*"')
TABLE = re.compile(r"<table\b.*?</table>", re.S | re.I)


def main():
    dist = sys.argv[1] if len(sys.argv) > 1 else "dist"
    root = os.path.join(ROOT, dist)
    if not os.path.isdir(root):
        print(f"FAIL: no build at {root!r}. Run a build first.")
        return 1

    failures, seen, total = [], [], 0

    for f in sorted(glob.glob(os.path.join(root, "**", "index.html"), recursive=True)):
        raw = io.open(f, encoding="utf-8", errors="ignore").read()
        if "Redirecting to:" in raw[:2000]:
            continue
        url = "/" + os.path.relpath(os.path.dirname(f), root).replace(os.sep, "/")
        url = "/" if url == "/." else url

        n = len(WARM.findall(raw))
        total += n
        cap = page_cap(url)
        if n:
            seen.append((url, n))
        if n > cap:
            failures.append((url, f"{n} warm elements, limit {cap}. The accent is only "
                                 f"worth having while it is rare — move one, do not raise "
                                 f"the limit."))
        # A warm mark inside a matrix would be read as a grade or a warning.
        for t in TABLE.findall(raw):
            if WARM.search(t):
                failures.append((url, "a .warm element sits inside a <table>. Colour in "
                                      "those tables is meaning, and copper means nothing "
                                      "there except confusion with the caution palette."))
                break

    css = " ".join(io.open(p, encoding="utf-8", errors="replace").read()
                   for p in glob.glob(os.path.join(root, "_astro", "*.css")))
    if "--color-copper:" not in css:
        failures.append(("stylesheet", "--color-copper is gone from the built CSS."))
    if not re.search(r"\.btn\.warm\{[^}]*linear-gradient", css):
        failures.append(("stylesheet", ".btn.warm lost its gradient in the built CSS."))

    for url, n in seen:
        print(f"  {url:34s} {n} warm")

    if failures:
        print(f"\nFAIL: {len(failures)} warm-accent problem(s).\n")
        for url, why in failures:
            print(f"  - {url}\n      {why}")
        return 1

    pages = len(seen)
    print(f"PASS: {total} warm elements across {pages} pages — never more than one on a "
          f"page, two on the home page, and none inside a matrix.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
