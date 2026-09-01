#!/usr/bin/env python3
"""Export the competitor claims register — the master file, generated from the site.

WHY THIS IS GENERATED AND NOT MAINTAINED BY HAND

Damian asked for "a master file that records all our competitor claims, with
sources, that we can periodically review with AI to update and then update the
site." The temptation is to write that file once and edit it thereafter. That
would be the third copy of this data, and this project has already been bitten
twice by a second copy drifting from the first — the compare hub and the Trust
Center rendered the same 706 cells and disagreed about whether to print a
citation, for a whole day.

So the register is a REPORT, not a source. src/data/compare.ts stays the single
source of truth; this script reads it and writes the register. Run it after any
research pass and the file is current by construction. Edit the register by hand
and your edit is gone the next time anyone runs it — which is the correct
outcome, because the site would never have shown it.

THE REVIEW LOOP THIS IS BUILT FOR

    1. Open the register. Every claim, its grade, its evidence, its source URL,
       the date it was read and how confident we were.
    2. Hand a slice to an AI or a person: "re-check these 40 rows against their
       cited documents; report disagreements."
    3. Feed the disagreements back through the evidence protocol
       (Reports/Competitive analysis/Evidence protocol v1.1) into compare.ts.
    4. Re-run this script. The register updates itself.

WHAT IS DELIBERATELY IN IT

The read date and the confidence on every row, because the review loop is really
a staleness loop: the question is never "is this table right" in the abstract,
it is "which of these 706 documents has changed since we read it". Barco's ISO
certificate moved from Issue 9 to Issue 11 in the three days between two of our
own passes. Sorting by date read is how you find the next thing to check.

Also the provenance, so a reviewer can see at a glance which claims rest on a
distributor rather than the manufacturer — those are both the weakest evidence
and the most likely to move.

Run: python3 scripts/export-claims-register.py [outdir]
Writes claims-register.md and claims-register.csv.
"""

import csv
import datetime
import io
import os
import re
import sys
from collections import Counter, defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "src", "data", "compare.ts")

DEFAULT_OUT = (
    "/sessions/peaceful-optimistic-gauss/mnt/Website/Review of comp websites"
    if os.path.isdir("/sessions/peaceful-optimistic-gauss/mnt/Website/Review of comp websites")
    else "."
)

DEEP_BRANDS = ["Barco ClickShare", "Airtame", "ScreenBeam", "WolfVision Cynap",
               "Kramer VIA", "Crestron AirMedia", "Vivi", "MTR / Zoom Rooms"]

GRADE_WORD = {
    "y": "Yes — evidence published",
    "p": "Partial — published but qualified",
    "n": "No published evidence found",
    "u": "Not assessed",
}


def unescape(t):
    return t.replace('\\"', '"').replace("\\\\", "\\")


def load():
    s = io.open(SRC, encoding="utf-8").read()
    brands = [b.strip().strip('"') for b in
              re.search(r"brands:\s*\[([^\]]+)\]", s).group(1).split(",")]
    whyp = {k: unescape(v) for k, v in
            re.findall(r'"([^"]+\|[^"]+)":\s*"((?:[^"\\]|\\.)*)"', s)}
    src = {}
    for m in re.finditer(r'"([^"]+\|[^"]+)":\s*(\{[^{}]*\})', s):
        b = m.group(2)
        g = lambda f: (re.search(r'\b%s:\s*"((?:[^"\\]|\\.)*)"' % f, b) or [None, ""])[1]
        if not g("u"):
            continue
        src[m.group(1)] = {"u": g("u"), "t": unescape(g("t")), "d": g("d"),
                           "c": g("c") or "high", "o": g("o") or "oem"}
    di = s.find("export const DEEP")
    rows = []
    for table, seg, bl in (("Headline matrix", s[:di], brands),
                           ("Module detail", s[di:], DEEP_BRANDS)):
        for grp, body in re.findall(r'\{g:"([^"]+)",rows:\[(.*?)\]\}', seg, re.S):
            for lbl, vals in re.findall(r'\["([^"]+)",\[([^\]]+)\]\]', body):
                v = [x.strip().strip('"') for x in vals.split(",")]
                rows.append((table, grp, lbl, v[0],
                             [(b, v[i + 1]) for i, b in enumerate(bl) if i + 1 < len(v)]))
    return rows, whyp, src


def main():
    out = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_OUT
    rows, whyp, src = load()
    today = datetime.date.today().isoformat()

    recs = []
    for table, grp, lbl, pol, cells in rows:
        for brand, grade in cells:
            k = lbl + "|" + brand
            sc = src.get(k, {})
            recs.append({
                "table": table, "group": grp, "claim": lbl, "vendor": brand,
                "polaris": pol, "grade": grade, "grade_meaning": GRADE_WORD.get(grade, grade),
                "evidence": whyp.get(k, ""), "source_url": sc.get("u", ""),
                "source_title": sc.get("t", ""), "read": sc.get("d", ""),
                "confidence": sc.get("c", ""), "provenance": sc.get("o", ""),
            })

    os.makedirs(out, exist_ok=True)
    csv_path = os.path.join(out, "claims-register.csv")
    with io.open(csv_path, "w", encoding="utf-8-sig", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=list(recs[0].keys()))
        w.writeheader()
        w.writerows(recs)

    g = Counter(r["grade"] for r in recs)
    c = Counter(r["confidence"] for r in recs)
    o = Counter(r["provenance"] for r in recs)
    dates = Counter(r["read"] for r in recs if r["read"])
    unsourced = [r for r in recs if not r["source_url"]]
    stale = sorted({(r["read"], r["vendor"]) for r in recs if r["read"]})

    md = [
        "# Mersive competitor claims register",
        "",
        f"**Generated {today}** by `scripts/export-claims-register.py` from "
        "`src/data/compare.ts`, which is the single source of truth.",
        "",
        "> **Do not edit this file.** It is a report. Corrections go into "
        "`compare.ts` through the evidence protocol "
        "(`Reports/Competitive analysis/Evidence protocol v1.1 (Aug 2026).md`), "
        "then this file is regenerated. An edit made here would never reach the "
        "website and would be overwritten on the next run.",
        "",
        "## What this is",
        "",
        f"Every claim Mersive publishes about a competitor: **{len(recs)} cells** "
        f"across **{len({r['vendor'] for r in recs})} vendors** and "
        f"**{len({r['claim'] for r in recs})} questions**, each with the document "
        "it was graded from, the date that document was read, how confident we "
        "were and whose website it lives on.",
        "",
        "The construct being measured is **published evidence a member of the "
        "public can retrieve** — not engineering quality. A vendor may build "
        "something well and document it nowhere; that scores badly here and says "
        "nothing about their product.",
        "",
        "## How to run a review cycle",
        "",
        "1. Sort `claims-register.csv` by **read** date, oldest first.",
        "2. Take a slice — a vendor, a group, or the oldest fifty rows.",
        "3. Ask an AI or a person: *\"open each source_url and tell me whether it "
        "still supports the grade and the evidence sentence. Report only "
        "disagreements, with what the page says now.\"*",
        "4. Put disagreements through the protocol: re-read, find a second source, "
        "then a third if the two conflict, and record the disagreement rather than "
        "resolving it silently.",
        "5. Apply to `compare.ts`. Re-run this script. Re-run `pnpm verify`.",
        "",
        "**Check these first, every time:** rows with `confidence: low`, rows with "
        "`provenance: third`, and anything a vendor has plausibly re-published "
        "since the read date. Certificates move quickly — Barco's ISO went from "
        "Issue 9 to Issue 11 inside three days during this research.",
        "",
        "## Current state",
        "",
        "| | count |",
        "|---|---|",
        f"| Claims recorded | {len(recs)} |",
        f"| With a source URL | {len(recs) - len(unsourced)} |",
        f"| Yes | {g.get('y', 0)} |",
        f"| Partial | {g.get('p', 0)} |",
        f"| No published evidence | {g.get('n', 0)} |",
        f"| Not assessed | {g.get('u', 0)} |",
        f"| Confidence high / med / low | {c.get('high', 0)} / {c.get('med', 0)} / {c.get('low', 0)} |",
        f"| Source on the vendor's own site | {o.get('oem', 0)} |",
        f"| Source on an independent registry | {o.get('registry', 0)} |",
        f"| Source on a third-party host | {o.get('third', 0)} |",
        "",
        "Evidence read between **" + (min(dates) if dates else "n/a") + "** and **"
        + (max(dates) if dates else "n/a") + "**.",
        "",
    ]

    low = [r for r in recs if r["confidence"] == "low"]
    third = [r for r in recs if r["provenance"] == "third"]
    if low or third:
        md += ["## Review these first", ""]
    if third:
        md += ["### Claims resting on someone else's website", "",
               "The vendor has not published this themselves. Weakest evidence in "
               "the set and the most likely to change.", ""]
        for r in third:
            md.append(f"- **{r['vendor']} — {r['claim']}** ({r['grade']}) · "
                      f"[{r['source_title']}]({r['source_url']}) · read {r['read']}")
        md.append("")
    if low:
        md += ["### Low-confidence claims", "",
               "Marketing language, an undated page, a page that would not render, "
               "or a product-family assumption. Each is honest about being thin.", ""]
        for r in low:
            md.append(f"- **{r['vendor']} — {r['claim']}** ({r['grade']}) · "
                      f"[{r['source_title']}]({r['source_url']}) · read {r['read']}")
        md.append("")

    md += ["## The register", ""]
    by = defaultdict(list)
    for r in recs:
        by[(r["table"], r["group"])].append(r)
    for (table, grp), rs in by.items():
        md += [f"### {table} — {grp}", ""]
        for claim in dict.fromkeys(r["claim"] for r in rs):
            crs = [r for r in rs if r["claim"] == claim]
            md += [f"#### {claim}", "",
                   f"*Polaris: {GRADE_WORD.get(crs[0]['polaris'], crs[0]['polaris'])}*", "",
                   "| Vendor | Grade | Evidence | Source | Read | Conf | Host |",
                   "|---|---|---|---|---|---|---|"]
            for r in crs:
                ev = r["evidence"].replace("|", "\\|")
                ttl = (r["source_title"] or "—").replace("|", "\\|")
                link = f"[{ttl}]({r['source_url']})" if r["source_url"] else "—"
                md.append(f"| {r['vendor']} | {r['grade']} | {ev} | {link} | "
                          f"{r['read']} | {r['confidence']} | {r['provenance']} |")
            md.append("")

    md_path = os.path.join(out, "claims-register.md")
    io.open(md_path, "w", encoding="utf-8").write("\n".join(md))
    print(f"wrote {md_path}\nwrote {csv_path}")
    print(f"{len(recs)} claims, {len(recs)-len(unsourced)} sourced, "
          f"{len(low)} low-confidence, {len(third)} third-party")
    return 0


if __name__ == "__main__":
    sys.exit(main())
