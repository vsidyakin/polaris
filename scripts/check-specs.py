#!/usr/bin/env python3
"""Fail when the same specification is stated two different ways.

THE RULE THIS ENFORCES
Ruled by Damian Blazy, 12 Aug 2026: every usage of a spec states the MOST
DETAILED version of it, and every surface states the SAME most-detailed version.
Detail means the port count, the generation, the connector type, the mode ("2x
USB-A 3.0, host mode", never "2x USB"), units on every axis, both scales
where a conversion helps, the provenance citation, and any open [verify:] flag.
See src/data/rulings.ts, SPEC_DETAIL_RULE.

WHY A SCRIPT AND NOT A CONVENTION
There was already a rule. It was written as a comment block inside
products/pro.astro naming the exact prohibited substitution:

    replacing "2x USB-A 3.0, host mode" with "2x USB" because the sheet
    was vaguer

Pro's USB row was thinned to "2x USB", reverted at 12:16 on 12 Aug 2026, and
shipped again as "USB x 2" at 17:05 the same day - on a different page. Four
hours and forty-nine minutes. A rule written in one file cannot govern another
file, and a convention cannot survive two agents editing the same repo. So the
rule is a check.

WHAT IT DOES
Extracts every two-column spec row from every surface that publishes specs,
pairs rows across surfaces by their label, and compares the values. Any pair
that differs is a failure, with the two values printed so the fix is obvious.
Rows appearing on only one surface are reported separately as coverage gaps,
which are not failures - a printable sheet may legitimately carry rows the
product page does not - but a spec on both surfaces must read identically.

Comparison ignores markup, entity encoding, the leading tick, and whitespace,
because those are presentation. It does NOT ignore [verify:] flags: a surface
that drops the flag is not a shorter version of the claim, it is a different and
stronger one, so a missing flag is a real difference and is reported as such.

Run: python3 scripts/check-specs.py     (or `pnpm check:specs`)
Exit 0 clean, 1 on any inconsistency.
"""

import collections
import difflib
import html
import io
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Surfaces that publish specs, grouped by the product they describe. A spec must
# read the same across every surface within a group.
GROUPS = {
    "Polaris Pro": [
        "src/pages/products/pro.astro",
        "src/pages/products/pro/spec.astro",
    ],
    "Polaris Essentials": [
        "src/pages/products/essentials.astro",
        "src/pages/products/essentials/spec.astro",
    ],
}

# Surfaces that publish specs but cannot be PAIRED, so they are scanned for
# dilution only. /products/family is a four-column tier comparison: its rows hold
# Element, Essentials and Pro side by side, so there is no two-surface pair to
# compare — and that is exactly why it drifted. It published "16 GB LPDDR4x ·
# 16 GB+ flash" while the Pro page said 16 GB LPDDR4 · 32 GB flash, and carried
# the diluted "4K30" and "dual 4K60" long after the product pages had been
# corrected, because no check was looking at it at all.
SCAN_ONLY = [
    "src/pages/products/family.astro",
]

# Labels that legitimately differ between surfaces, each with a reason.
# Keep this list very short; the point of the check is that it is hard to add to.
ALLOWED_DIFFERENCE = {
    # (group, normalised label): reason
}

# ---------------------------------------------------------------------------
# DILUTED PHRASES
#
# Pairing rows by label is necessary but not sufficient, and the first run of
# this script proved it. It reported PASS on 19 matched specs while the Pro
# sheet still said "USB x 2" in a row labelled "Rear panel" and "2x USB" in a
# comparison column - Damian's own example of the thing not to do. Neither
# matched a row labelled "USB", so neither was compared with anything.
#
# So detail is also checked directly, wherever it appears and whatever the row
# is called: if a phrase names a component, it must name it at full depth. Each
# entry is (pattern, what is missing, the full form).
# ---------------------------------------------------------------------------
DILUTED = [
    # The connector suffix comes BEFORE the generation on this product: "USB-A 3.0",
    # not "USB 3.0 Type-A". The first draft of this pattern allowed "-C" and not
    # "-A", so when Damian corrected the connector on 13 Aug 2026 the guard failed
    # the corrected copy and passed the wrong copy. A checker whose allow-list
    # encodes one product assumption is a checker that fights the fix.
    (re.compile(r"\d\s*(?:&times;|x|×)\s*USB(?!\s*(?:-[ABC]|3\.0|2\.0|3\.1|3\.2|\s*Type))", re.I),
     "a USB port count with no generation or connector type",
     "2x USB-A 3.0, host mode"),
    (re.compile(r"USB\s*(?:&times;|x|×)\s*\d", re.I),
     "a USB port count with no generation or connector type",
     "2x USB-A 3.0, host mode"),
    (re.compile(r"(?<![\w.])4K(?!\s*(?:\d|\(|&nbsp;|[0-9]))(?![^<]{0,24}(?:×|&times;|x\s*\d))", re.I),
     "a 4K claim with no pixel dimensions or refresh rate",
     "4K (3840 x 2160) at 60 Hz"),
]

# Rows that publish a display output, where the pixel dimensions are load-bearing.
# "out", not "output": the tier-comparison table labels the row "HDMI out", and the
# first draft of this pattern required the full word. It matched every product page
# and silently skipped the one table that had actually drifted, which is the whole
# reason the row was added to the scan. Label wording is not a fact about hardware
# and must not decide whether hardware gets checked.
OUTPUT_ROW = re.compile(r"hdmi out|display out|resolution|video out", re.I)
PIXELS = re.compile(r"\d{3,4}\s*(?:&times;|×|x)\s*\d{3,4}", re.I)
# PRODUCT NAMES containing a spec-looking token. "Amazon Fire TV Stick 4K Max" is
# a name, not a resolution claim, and demanding pixel dimensions of it is nonsense.
# Removed before the scan rather than exempted by row, because exempting the row
# would also hide any real dilution sitting beside the name.
PRODUCT_NAMES = re.compile(r"Fire TV Stick 4K Max|Fire TV Stick 4K", re.I)

# The house form: 4K always carries its own dimensions, in brackets, right there.
CANON_4K = re.compile(r"4K\s*\(\s*\d{3,4}\s*(?:&times;|×|x)\s*\d{3,4}", re.I)
# A positive USB port claim: a count, or the connector named.
USB_PORT = re.compile(r"\d\s*(?:&times;|x|×)\s*USB|USB-[ABC]\b|USB\s*(?:&times;|x|×)\s*\d", re.I)

# Text that is allowed to contain a diluted phrase because it is quoting the
# prohibition rather than committing it - the rule blocks in the product pages.
QUOTING = re.compile(r"failure mode this prevents|because the sheet was vaguer|never \"?2x USB", re.I)


def text(fragment):
    """Markup and entities out, readable text in."""
    s = re.sub(r"<[^>]+>", " ", fragment)
    s = html.unescape(s)
    s = s.replace("✓", " ").replace("—", "-").replace("·", ";")
    s = s.replace(" ", " ")
    return " ".join(s.split())


def unflagged(fragment):
    """Readable text with [verify: ...] notes removed.

    For the DILUTION scan only. A verify note is a review flag, not a published
    claim, and notes legitimately discuss the wrong figure in order to dispute it —
    the Essentials output row now carries one that says the data sheet reads 30 Hz
    while the product was specified for 4K60. Checking a claim against the text of
    the note disputing that claim is backwards, and it cost two rounds here: the
    first version of that note tripped this very check, and padding the note with
    dimensions to appease the checker is writing prose for the machine.

    The PAIRING comparison in value_key() still keeps flags, deliberately: a
    surface that quietly drops a flag is making a stronger claim than its sibling,
    which is a real difference and must fail.
    """
    return PRODUCT_NAMES.sub(" ", re.sub(r"\[verify:[^\]]*\]", " ", text(fragment), flags=re.I))


def label_key(lab):
    k = text(lab).lower()
    k = re.sub(r"\[.*?\]", "", k)
    k = re.sub(r"[^a-z0-9 ]", " ", k)
    # a few synonyms seen across the two surfaces
    k = k.replace("in the workspace", "").replace("network authentication", "authentication")
    k = k.replace("no vpn", "")
    return " ".join(k.split())


def value_key(val):
    """Normalise for comparison. Punctuation and separators are presentation;
    words and numbers are not. [verify:] flags are preserved deliberately."""
    s = text(val).lower()
    s = re.sub(r"[.,;:/|]", " ", s)
    s = re.sub(r"\s+", " ", s)
    return s.strip()


def spec_rows(path):
    """label -> list of (raw_label, raw_value). Two-column rows only: a
    three-column row is a comparison table, where a differing value is the
    entire point."""
    full = os.path.join(ROOT, path)
    if not os.path.exists(full):
        return {}
    s = io.open(full, encoding="utf-8").read()
    out = collections.defaultdict(list)
    for tr in re.findall(r"<tr>(.*?)</tr>", s, re.S):
        cells = re.findall(r"<td[^>]*>(.*?)</td>", tr, re.S)
        if len(cells) != 2:
            continue
        lab, val = cells
        if not text(lab) or not text(val):
            continue
        out[label_key(lab)].append((text(lab), val))
    return out


def main():
    failures = []
    gaps = []
    compared = 0

    for group, paths in GROUPS.items():
        tables = {p: spec_rows(p) for p in paths}
        all_labels = set()
        for t in tables.values():
            all_labels |= set(t)

        for lab in sorted(all_labels):
            present = {p: t[lab] for p, t in tables.items() if lab in t}

            # fuzzy-match a label that only appears on one surface, so a rename
            # does not silently turn into a coverage gap
            if len(present) == 1:
                have = next(iter(present))
                for p, t in tables.items():
                    if p == have or lab in t:
                        continue
                    near = difflib.get_close_matches(lab, list(t), 1, 0.80)
                    if near:
                        present[p] = t[near[0]]
            if len(present) < 2:
                gaps.append((group, lab, next(iter(present))))
                continue

            vals = {}
            for p, entries in present.items():
                vals[p] = value_key(entries[0][1])
            compared += 1
            if len(set(vals.values())) == 1:
                continue
            if (group, lab) in ALLOWED_DIFFERENCE:
                continue
            failures.append((group, lab, present))

    # --- diluted phrases, anywhere on any spec surface, whatever the row is called
    diluted = []
    scan = {g: list(ps) for g, ps in GROUPS.items()}
    scan["Tier comparison"] = SCAN_ONLY
    for group, paths in scan.items():
        for p in paths:
            full = os.path.join(ROOT, p)
            if not os.path.exists(full):
                continue
            src = io.open(full, encoding="utf-8").read()
            for tr in re.findall(r"<tr>.*?</tr>", src, re.S):
                if QUOTING.search(tr):
                    continue
                cells = re.findall(r"<t[dh][^>]*>(.*?)</t[dh]>", tr, re.S)
                body = unflagged(" ".join(cells))
                for pat, missing, want in DILUTED:
                    m = pat.search(body)
                    if m:
                        diluted.append((p, body[:150], m.group(0).strip(), missing, want))
                        break
                else:
                    # A DISPLAY-OUTPUT row must carry the pixel dimensions, not just
                    # a refresh rate. "4K30" and "dual 4K60" both slip past the
                    # generic 4K pattern above, because a digit follows the K — and
                    # both shipped in the tier-comparison tables while the rows they
                    # summarised said 4096 x 2160 and 3840 x 2160. The two tiers do
                    # not even use the same 4K: Essentials is DCI (4096) and Pro is
                    # UHD (3840), which is exactly the distinction "4K30 vs 4K60"
                    # erases. Scoped to output rows on purpose: a decode-throughput
                    # row legitimately says "2x 4K60" as a count of streams, and a
                    # checker that flags correct copy gets switched off.
                    #
                    # PER CELL, not per row. The first draft tested the whole row and
                    # missed the exact defect it was written for: in the tier
                    # comparison the Essentials column said "4K30" while the Pro
                    # column next to it said "dual 4K (3840 x 2160) at 60 Hz", so the
                    # row contained pixel dimensions and passed — dimensions
                    # belonging to the other product. A row-level test on a
                    # side-by-side table lets either column vouch for the other.
                    if OUTPUT_ROW.search(text(cells[0]) if cells else ""):
                        hit = False
                        for c in cells[1:]:
                            # A cell wrapped in <mark class="vflag"> is not making a
                            # settled claim: it renders bright yellow and says "not
                            # verified". The Element column is exactly that — a
                            # placeholder for hardware that does not exist yet, kept
                            # deliberately with a flag on it — and holding a
                            # placeholder to the house spec format is nonsense.
                            # Yes, this is an escape hatch. It is a LOUD one: using it
                            # means the text is yellow on the live page, which is a
                            # visible decision rather than a silent bypass.
                            if 'class="vflag"' in c:
                                continue
                            v = unflagged(c)
                            # Every "4K" on an output row must be followed immediately
                            # by its own dimensions. Merely finding dimensions
                            # SOMEWHERE in the cell is not enough: "Dual 4K60 - HD
                            # (1920 x 1080)" contains a pixel pair that belongs to the
                            # 1080p claim, and would vouch for a 4K claim that never
                            # states whether it is DCI 4096 or UHD 3840. Every surface
                            # already uses the canonical form, so requiring it costs
                            # nothing and closes the loophole.
                            if any(not CANON_4K.match(v, m.start())
                                   for m in re.finditer(r"4K", v, re.I)):
                                diluted.append((p, body[:150], v[:70],
                                                "a 4K output claim with no pixel dimensions",
                                                "4K (4096 x 2160) at 30 Hz  /  dual 4K (3840 x 2160) at 60 Hz"))
                                hit = True
                                break
                        if hit:
                            continue

                    # ESSENTIALS HAS NO USB PORT. Ruled by Damian Blazy 13 Aug 2026
                    # (F5.17): the Mini's rear panel is Kensington lock, Ethernet,
                    # HDMI 2.0 and DC power, and nothing else. This matters beyond
                    # the port list — no USB host means no room camera, which is the
                    # whole reason wireless BYOM and Link are Pro capabilities rather
                    # than a licence away. A stray USB row on an Essentials surface
                    # would contradict the tier boundary the site is built on.
                    #
                    # Two-column tables only. The tier-comparison tables are three
                    # columns and their Pro column names USB correctly.
                    if "essentials" in p and len(cells) == 2 and USB_PORT.search(unflagged(cells[1])):
                        diluted.append((p, body[:150], text(cells[1])[:60],
                                        "a USB port claimed for Essentials, which has none",
                                        "no USB row on Essentials; the Mini has no USB host"))

    if diluted:
        print(f"FAIL: {len(diluted)} diluted spec phrase(s).\n")
        print("A spec must name the component at full depth wherever it appears —")
        print("port count AND generation AND connector AND mode. See rulings.ts,")
        print("SPEC_DETAIL_RULE.\n")
        for p, body, hit, missing, want in diluted:
            print(f"  {p}")
            print(f"      found   : \"{hit}\"  — {missing}")
            print(f"      required: {want}")
            print(f"      in row  : {body}")
            print()
        # NOT failures.extend(diluted). The two lists hold different shapes — a
        # pairing failure is (group, label, {path: rows}) and a dilution is a
        # five-field record — and mixing them made the summary loop below raise
        # ValueError instead of printing. The exit code was still 1, so the build
        # gate held, but the operator got a traceback where the fix should have
        # been. Latent since the day dilution detection was added, and invisible
        # until something actually diluted. Counted separately now.

    if failures:
        print(f"FAIL: {len(failures)} specification issue(s) total.\n")
        print("Every surface must carry the MOST DETAILED version. Pick the fuller")
        print("value, put it on every surface, and keep any [verify:] flag.\n")
        for group, lab, present in failures:
            print(f"  {group} — {lab}")
            for p, entries in present.items():
                v = text(entries[0][1])
                print(f"      {os.path.basename(os.path.dirname(p))}/{os.path.basename(p)}")
                print(f"        {v[:190]}")
            print()

    if gaps:
        print(f"note: {len(gaps)} spec row(s) appear on only one surface. Not a failure —")
        print("      a printable sheet may carry rows a product page does not.")
        for group, lab, where in sorted(gaps)[:12]:
            print(f"      {group}: {lab}  (only in {os.path.basename(where)})")
        if len(gaps) > 12:
            print(f"      ... and {len(gaps)-12} more")
        print()

    if not failures and not diluted:
        print(f"PASS: {compared} specs compared across {len(GROUPS)} product groups, "
              f"every one identical on all surfaces.")
    return 1 if (failures or diluted) else 0


if __name__ == "__main__":
    sys.exit(main())
