#!/usr/bin/env python3
"""Fail if any page states the warranty in a way the ruling forbids.

THE RULING (src/data/rulings.ts, WARRANTY) has two cases:

    ON SUBSCRIPTION   full warranty for as long as the room is subscribed.
                      No cap, no cliff — it renews when they renew.
    ON PERPETUAL      five years, capped.

WHY A CHECK AND NOT A CONVENTION

This one fact has now gone wrong four separate ways in two days, every time by an
edit that looked reasonable on its own:

  1. "Limited 3-year manufacturer's warranty" — both released data sheets. Dated.
  2. "Included for the life of the product" — a printable spec sheet. An
     open-ended hardware obligation surviving cancellation, on a page with a
     Print button.
  3. "Warranty for life" — the TCO figure heading, with the qualifier only in the
     body beneath it. That phrase then left the page inside a rendered PNG and
     the qualifier did not travel with it.
  5. "for life of subscription" — correct in meaning, one deleted word from the
     bare claim. Which is why the ruling now fixes the words and not the sense.
  4. "Subscription with warranty included, or perpetual license" — one bullet,
     two purchase options, one unqualified promise across both. A reader takes
     the better reading.

Numbers 3 and 4 are the instructive ones: neither contains a false sentence. Both
are true statements that mislead once separated from their qualifier. A human
proof-reading for false claims finds nothing wrong. That is exactly the class of
defect a checker catches and a convention does not.

WHAT IT CHECKS, against the BUILT html so it sees what a reader sees

  A. FORBIDDEN PHRASES anywhere. The wording is fixed, not just the meaning:
     "for life" fails unless immediately followed by "of the subscription".
     Also "life of the product", "3-year warranty", "limited 3-year".
     Three approved subscription forms: "for the whole term", "for life of the
     subscription", "full warranty while on active subscription". The rule bans
     one detachable phrase; it does not police phrasing generally.

  B. PROXIMITY: a page that mentions a perpetual licence within 600 characters of
     a warranty claim must also mention the cap. This is defect 4, generalised —
     the two purchase options may sit side by side only if the distinction sits
     with them.

  C. UNQUALIFIED WARRANTY CLAIMS: a sentence promising warranty inclusion must
     carry its condition — "subscri" (subscription/subscribed/subscribe), "term",
     or the cap. "Warranty included" full stop is the shape of defects 2 and 3.

EXEMPTIONS are by explicit page and reason, listed in EXEMPT below, so exempting
something is a visible decision rather than a silent omission. Competitor claims
are the main legitimate case: describing a rival's three-year warranty is a fact
about them, not a promise about us.

Run against a build: python3 scripts/check-warranty.py [dist-dir]   (default dist)
Exit 0 clean, 1 on any violation.
"""

import glob
import html as htmllib
import io
import os
import re
import sys

# Ruled 13 Aug 2026. ONE phrase is banned outright: bare "for life". Approved
# forms for the subscription case are "for the whole term", "for life of the
# subscription" and "full warranty while on active subscription" — the rule bans
# a detachable phrase, it does not police phrasing generally.
# "for life of subscription" (no "the") also fails: one deleted word from the
# bare claim, which is the failure mode itself.
FORBIDDEN = [
    (re.compile(r"for life(?!\s+of\s+the\s+subscription)", re.I),
     'bare "for life" — say "for life of the subscription" or "full warranty while on active subscription"'),
    (re.compile(r"life of the product", re.I), "survives cancellation; an obligation nobody approved"),
    (re.compile(r"\b3-year warranty\b", re.I), "the dated data-sheet term, superseded"),
    (re.compile(r"\blimited 3-year\b", re.I), "the dated data-sheet term, superseded"),
]

PERPETUAL = re.compile(r"perpetual", re.I)
WARRANTY = re.compile(r"warrant", re.I)
CAP = re.compile(r"capped at (?:5|five) years|(?:5|five)[- ]year cap|capped at 5", re.I)
CONDITION = re.compile(r"subscri|whole term|for the term|capped at", re.I)

# Pages allowed to break a rule, each with the reason. Keep this list short.
EXEMPT = {
    # Competitor warranty facts are claims about THEM. Describing a rival's
    # three-year warranty is the point of a comparison page.
    "/compare/mtr": "competitor warranty terms",
    "/compare/dongles": "competitor warranty terms",
    "/compare/hub": "competitor warranty terms",
    "/compare/barco": "competitor warranty terms",
    "/compare/airtame": "competitor warranty terms",
    "/platform/tco": "competitor warranty terms in the cost-comparison tables",
    # The glossary and legal placeholder describe warranty as a concept.
    "/legal": "placeholder describing which legal documents will exist",
}


def text_of(path):
    s = io.open(path, encoding="utf-8", errors="ignore").read()
    s = re.sub(r"<(script|style)[^>]*>.*?</\1>", " ", s, flags=re.S | re.I)
    return " ".join(htmllib.unescape(re.sub(r"<[^>]+>", " ", s)).split())


def sentences(t):
    return re.split(r"(?<=[.;:])\s+", t)


def main():
    root = sys.argv[1] if len(sys.argv) > 1 else "dist"
    if not os.path.isdir(root):
        print(f"FAIL: no build at {root!r}. Run a build first.")
        return 1

    problems = []
    checked = 0

    for f in sorted(glob.glob(os.path.join(root, "**", "index.html"), recursive=True)):
        raw = io.open(f, encoding="utf-8", errors="ignore").read()
        if "Redirecting to:" in raw[:2000]:
            continue
        url = "/" + os.path.relpath(os.path.dirname(f), root).replace(os.sep, "/")
        url = "/" if url == "/." else url
        t = text_of(f)
        if not WARRANTY.search(t):
            continue
        checked += 1
        exempt = url in EXEMPT

        # A. forbidden phrases. A page may QUOTE a superseded term in order to say
        # it is superseded — that is the opposite of making the claim, and the spec
        # sheets do exactly that in their provenance note. Detected by the quoting
        # context, not by exempting the whole page.
        for rx, why in FORBIDDEN:
            for m in rx.finditer(t):
                ctx = t[max(0, m.start() - 160): m.start() + 160]
                if re.search(r"supersed|dated and to be reissued|no longer|superseding|forbidden|never use", ctx, re.I):
                    continue
                problems.append((url, "FORBIDDEN PHRASE", f'"{m.group(0)}" — {why}'))
                break

        if exempt:
            continue

        # B. perpetual near a warranty claim without the cap
        for m in PERPETUAL.finditer(t):
            # 600, not 400. The platform post states both cases correctly but puts the
            # perpetual case two sentences after the subscription one, ~500 chars out.
            # A window tighter than the paragraph flags correct copy, and a checker
            # that cries wolf on correct copy gets switched off.
            window = t[max(0, m.start() - 600): m.start() + 600]
            if WARRANTY.search(window) and not CAP.search(window):
                problems.append((url, "PERPETUAL WITHOUT THE CAP", "…" + window.strip()[:230] + "…"))
                break

        # C. an inclusion promise with no condition attached
        for s in sentences(t):
            if not re.search(r"warrant", s, re.I):
                continue
            if not re.search(r"includ|carries|covered|comes with", s, re.I):
                continue
            if CONDITION.search(s) or CAP.search(s):
                continue
            problems.append((url, "UNQUALIFIED WARRANTY CLAIM", s.strip()[:190]))
            break

    if problems:
        print(f"FAIL: {len(problems)} warranty problem(s) across {checked} pages that mention it.\n")
        print("The ruling has two cases and they travel together:")
        print("  subscription -> for as long as the room is subscribed, no cap")
        print("  perpetual    -> capped at five years")
        print("See src/data/rulings.ts, WARRANTY.\n")
        for url, kind, detail in problems:
            print(f"  {url}")
            print(f"      {kind}")
            print(f"        {detail}")
            print()
        return 1

    print(f"PASS: {checked} pages mention the warranty, every one stating its condition "
          f"({len(EXEMPT)} exempt with a reason).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
