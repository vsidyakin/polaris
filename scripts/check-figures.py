#!/usr/bin/env python3
"""Fail if any figure can grow taller than the window.

WHY THIS EXISTS
Damian reported the same defect twice: a diagram rendering taller than the
browser viewport, so you scroll up and down to read one figure. The first fix
listed three selectors and capped those. That is a whitelist. It held for the
three figures it named and the defect reappeared on the fourth (A0.6.f1, the
collaboration scene) because nothing stopped a new full-width figure from
shipping uncapped.

A whitelist that has to be maintained by memory is not a fix. This is the fix:
a check that reads the stylesheets, finds every rule that stretches an <svg> to
the full width of its column, and fails unless that same selector is also bound
by the height ceiling in pages.css.

THE UNDERLYING GEOMETRY
An inline <svg> with a viewBox and `width:100%; height:auto` has no height of
its own - it takes the column width and derives its height from its aspect
ratio. That was harmless when the content column was 1200px. After the
full-width rollout a column can be ~2400px, and a 760x520 diagram then renders
1642px tall, taller than any laptop viewport.

Capping max-width in pixels does not fix it, and .clbwrap is the proof: at
`max-width: 860px` and a 1.632 ratio it is always ~527px tall, which overflows
a short window and is unaffected by how tall the window actually is. The bound
has to be a function of viewport height:

    max-width = min(--fig-w, --fig-h * --fig-ar)

where --fig-ar is the figure's own width/height from its viewBox. That caps the
HEIGHT while leaving the figure fully responsive, and it never letterboxes.

WHAT COUNTS AS A VIOLATION
A CSS rule whose selector ends in `svg` (or is an svg class like .rs-svg) and
whose body sets the element to full width - `w-full`, `width: 100%` - while that
selector does not appear in the ceiling rule's selector list.

Icons are exempt: an icon inside a fixed-size box cannot outgrow the window.
The exemption is by explicit selector, listed in EXEMPT with a reason, so
exempting something is a visible decision rather than a silent omission.

Run: python3 scripts/check-figures.py     (or `pnpm check:figures`)
Exit 0 clean, 1 on any violation.
"""

import io
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STYLES = os.path.join(ROOT, "src", "styles")

# Selectors that stretch an svg to full width but cannot overflow the viewport,
# each with the reason it is safe. Add to this list only with a reason.
EXEMPT = {
    ".tile .tg svg": "icon inside a fixed-height tile; h-full w-full of a small box",
    ".navic svg": "nav icon inside .navic's fixed h-4 w-4 box; h-full w-full of a 16px glyph",
    ".drop a > .nrow-ic svg": "15px dropdown-row glyph; h-full w-full of a 15px box",
    ".ftic svg": "14px footer column-head glyph; h-full w-full of a 14px box",
}

FULL_WIDTH = re.compile(r"w-full|width:\s*100%")
# The ceiling rule is identified by the formula, not by a line number, so moving
# it around the file does not break this check.
#
# Note the body class is [^{}] and not [^}]. With [^}] the body is allowed to
# contain a "{", so the match slides backwards and swallows the enclosing
# "@layer components {" as part of the selector list - which is exactly what
# happened on the first run of this script. A rule body cannot contain a brace,
# so say so.
CEILING = re.compile(
    r"([^{}]*?)\{([^{}]*max-width:\s*min\(\s*var\(--fig-w[^{}]*var\(--fig-ar[^{}]*)\}",
    re.S,
)


def strip_comments(css):
    """Blank out /* ... */ but keep newlines, so reported line numbers stay true.

    This file's own first draft skipped this step and every selector came back
    with the preceding comment block glued to the front of it - including the
    ceiling's own selector list, which then looked like one giant selector with
    no --fig-ar. A CSS parser that does not handle comments is not a CSS parser,
    and this codebase comments almost every rule."""
    return re.sub(r"/\*.*?\*/", lambda m: "\n" * m.group(0).count("\n"), css, flags=re.S)


def rules(css):
    """Yield (selector, body, line) for every flat rule. Good enough for this
    codebase: nested at-rules are entered, but no rule here nests a rule."""
    for m in re.finditer(r"([^{}]+)\{([^{}]*)\}", css):
        sel = " ".join(m.group(1).split())
        if sel.startswith("@") or not sel:
            continue
        yield sel, m.group(2), css[: m.start()].count("\n") + 1


def main():
    pages = strip_comments(io.open(os.path.join(STYLES, "pages.css"), encoding="utf-8").read())

    m = CEILING.search(pages)
    if not m:
        print("FAIL: the figure ceiling rule is gone from pages.css.")
        print("      Expected a rule with max-width: min(var(--fig-w...), calc(var(--fig-h...) * var(--fig-ar)))")
        return 1
    covered = {s.strip() for s in m.group(1).split(",") if s.strip()}
    print(f"ceiling covers {len(covered)} selectors: {', '.join(sorted(covered))}")

    # Every selector in the ceiling must declare its own --fig-ar, or the
    # calc() collapses to an invalid value and the cap silently does nothing.
    missing_ar = []
    for sel in covered:
        pat = re.compile(re.escape(sel) + r"\s*\{[^}]*--fig-ar", re.S)
        if not pat.search(pages):
            missing_ar.append(sel)

    violations = []
    for fname in sorted(os.listdir(STYLES)):
        if not fname.endswith(".css"):
            continue
        css = strip_comments(io.open(os.path.join(STYLES, fname), encoding="utf-8").read())
        for sel, body, line in rules(css):
            if not FULL_WIDTH.search(body):
                continue
            # only rules that target an svg
            if not (sel.endswith("svg") or "svg" in sel.split()[-1] or sel.endswith("-svg")):
                continue
            if sel in EXEMPT or sel in covered:
                continue
            violations.append((fname, line, sel, " ".join(body.split())[:60]))

    ok = True
    if missing_ar:
        ok = False
        print("\nFAIL: in the ceiling list but never given a --fig-ar, so the cap does nothing:")
        for sel in sorted(missing_ar):
            print(f"  - {sel}")

    if violations:
        ok = False
        print("\nFAIL: these rules make an svg full-width but are not bound by the ceiling.")
        print("      Add the selector to the ceiling list in pages.css with its own")
        print("      --fig-ar (width/height from its viewBox), or add it to EXEMPT")
        print("      in this script with a reason.\n")
        for fname, line, sel, body in violations:
            print(f"  {fname}:{line}  {sel}")
            print(f"      {{ {body} }}")

    # A pixel-only cap on a covered selector is the .clbwrap trap: it wins on
    # tie and pins the height. Catch it anywhere, in any stylesheet.
    pinned = []
    for fname in sorted(os.listdir(STYLES)):
        if not fname.endswith(".css"):
            continue
        css = strip_comments(io.open(os.path.join(STYLES, fname), encoding="utf-8").read())
        for sel, body, line in rules(css):
            if sel not in covered:
                continue
            for mm in re.finditer(r"max-width:\s*([^;}]+)", body):
                val = mm.group(1).strip()
                if "--fig-ar" not in val:
                    pinned.append((fname, line, sel, val))
    if pinned:
        ok = False
        print("\nFAIL: a covered selector also sets a plain max-width, which pins its")
        print("      height regardless of viewport height. Move the value to --fig-w.\n")
        for fname, line, sel, val in pinned:
            print(f"  {fname}:{line}  {sel}  ->  max-width: {val}")

    # ── INLINE STYLES, which is how this defect survived the guard ────────────
    #
    # Damian reported the figure overflowing a THIRD time on 14 Aug 2026, while
    # this script reported PASS. It was right about the stylesheets and blind to
    # the markup: src/lib/blocks.ts emitted the collaboration scene as
    #
    #     <div class="clbwrap reveal"><svg style="max-width:none" viewBox="0 0 780 478"
    #
    # An inline style beats any stylesheet rule, so .clbwrap's ceiling — written
    # specifically for this figure, after this figure broke twice — never applied
    # to it. The guard checked the fix and not the thing being fixed.
    #
    # So: no inline max-width:none, and no inline max-width at all, on an element
    # that also carries a viewBox. A viewBox means the element derives its height
    # from its width, which is the whole condition this script exists to bound.
    inline = []
    src = os.path.join(ROOT, "src")
    for dirpath, _dirnames, filenames in os.walk(src):
        for fn in filenames:
            if not fn.endswith((".astro", ".ts", ".tsx", ".html")):
                continue
            p = os.path.join(dirpath, fn)
            text = io.open(p, encoding="utf-8", errors="ignore").read()
            for mm in re.finditer(r"<svg\b[^>]*>", text):
                tag = mm.group(0)
                if "viewBox" not in tag:
                    continue
                sm = re.search(r'style="([^"]*)"', tag)
                if not sm or "max-width" not in sm.group(1):
                    continue
                rel = os.path.relpath(p, ROOT).replace(os.sep, "/")
                inline.append((rel, text[: mm.start()].count("\n") + 1, sm.group(1)[:70]))
    if inline:
        ok = False
        print("\nFAIL: an inline style sets max-width on an svg that has a viewBox.")
        print("      Inline beats the stylesheet, so the height ceiling in pages.css")
        print("      does not apply. Remove it and let the wrapper's --fig-w do the")
        print("      work.\n")
        for fname, line, style in inline:
            print(f"  {fname}:{line}  style=\"{style}\"")

    if ok:
        print(f"\nPASS: {len(covered)} figures capped, all with a --fig-ar, "
              f"{len(EXEMPT)} exempt with a reason, no unbounded full-width svg, "
              f"no inline max-width on a viewBox svg.")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
