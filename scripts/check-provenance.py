#!/usr/bin/env python3
"""Fail if a citation is not on the vendor's own domain and does not say so.

THE RULING, Damian Blazy, 15 Aug 2026
-------------------------------------
Protocol v1.0 excluded reseller and distributor pages outright. That was too
blunt and it cost real evidence: Barco's own TAA compliance overview — a
Barco-authored document listing nine ClickShare part numbers with country of
origin — exists only on TD SYNNEX's website. Excluding it loses a true finding;
citing it silently implies Barco published it. Neither is honest.

Damian's rule instead: keep the source, and attribute it.

    "if its listed on a distributor say something like unverifiable with Barco,
     Distributor xyz makes the claim, give source"

So a citation now carries an ORIGIN, and anything that is not the vendor's own
domain or an independent registry must be marked `third` and must SAY SO in the
note. The reader learns three things at once: what the claim is, who is making
it, and that the vendor has not made it themselves.

That last part is a finding in its own right. A TAA statement that exists only
on a distributor's site is materially weaker than one on the manufacturer's,
because the manufacturer is the party who can be held to it — and on a row that
asks whether a vendor PUBLISHES a statement, the answer "their distributor did"
is a different answer.

WHAT THIS ENFORCES
  1. Every citation carries o: "oem" | "registry" | "third".
  2. `oem` must actually be on one of that brand's own domains.
  3. `registry` must be on a recognised independent registry or certification body.
  4. Anything else must be `third`, AND its note must name who is making the
     claim and say the vendor has not published it. Attribution words are
     checked, not assumed.
  5. A citation claiming `oem` for a domain that is not the vendor's fails —
     that mislabel is the one this guard exists to catch, because it is
     invisible to a reader and flattering to us.

The domain lists are data, below. Adding a domain is a visible decision.

Run: python3 scripts/check-provenance.py     (or `pnpm check:provenance`)
Exit 0 clean, 1 on any violation.
"""

import io
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "src", "data", "compare.ts")

# The vendor's own web estate. Subdomains count: assets.barco.com is Barco.
OEM = {
    "Barco ClickShare": ["barco.com"],
    "Barco Hub": ["barco.com"],
    "Crestron AirMedia": ["crestron.com"],
    "Kramer VIA": ["kramerav.com"],
    "WolfVision Cynap": ["wolfvision.com"],
    "Extron ShareLink Pro": ["extron.com"],
    "Airtame": ["airtame.com"],
    "ScreenBeam": ["screenbeam.com", "screenbeam.my.site.com"],
    "BenQ InstaShow": ["benq.com"],
    "Yealink RoomCast": ["yealink.com"],
    "DisplayNote Montage": ["displaynote.com"],
    "Vivi": ["vivi.io", "vivi.atlassian.net"],
    "Cisco Room Bar": ["cisco.com", "webex.com"],
    "MTR / Zoom Rooms": ["microsoft.com", "zoom.com", "zoom.us"],
    "Polaris": ["mersive.com"],
}

# Independent registries, certification bodies and regulators. These are BETTER
# than an OEM source, not worse: the vendor cannot edit them.
REGISTRY = [
    "nist.gov", "csrc.nist.gov",          # CMVP / FIPS
    "cyber.gouv.fr", "ssi.gouv.fr",       # ANSSI / CSPN
    "commoncriteriaportal.org",
    "bsi.bund.de",
    "fedramp.gov",
    "disa.mil",                            # DoDIN APL
    "cloudsecurityalliance.org",           # CSA STAR
    "iso.org", "iaf.nu",
    "schellman.com", "barrcertifications.com",  # registrars' own directories
    "europa.eu", "fcc.gov",
]

# A note carrying a third-party citation has to attribute it. One of these
# phrasings must appear, so the reader is told whose claim it is.
ATTRIB = re.compile(
    r"not published by|is not on [^.]*own|hosted (?:by|on)|distributor|reseller|"
    r"unverifiable (?:with|on)|makes the claim|published by [A-Z]|"
    r"third[- ]party (?:site|page|host)|appears only on",
    re.I,
)


def host(u: str) -> str:
    return re.sub(r"^https?://([^/]+).*", r"\1", u).lower()


def main():
    s = io.open(SRC, encoding="utf-8").read()
    whyp = dict(re.findall(r'"([^"]+\|[^"]+)":\s*"((?:[^"\\]|\\.)*)"', s))
    # Parse each { ... } block whole, then pull fields out of it. A single regex
    # with an optional group in the middle silently matched the empty option on
    # every entry — 208 stamped citations reported as unstamped. Parse the object,
    # then read it.
    src = []
    for m in re.finditer(r'"([^"]+\|[^"]+)":\s*(\{[^{}]*\})', s):
        body = m.group(2)
        u = re.search(r'\bu:\s*"([^"]*)"', body)
        o = re.search(r'\bo:\s*"([^"]*)"', body)
        if not u:
            continue
        src.append((m.group(1), u.group(1), o.group(1) if o else ""))

    bad, unmarked, unattributed = [], [], []
    counts = {"oem": 0, "registry": 0, "third": 0, "none": 0}

    for key, url, origin in src:
        row, _, brand = key.rpartition("|")
        h = host(url)
        is_oem = any(d in h for d in OEM.get(brand, []))
        is_reg = any(d in h for d in REGISTRY)
        actual = "oem" if is_oem else "registry" if is_reg else "third"
        counts[origin or "none"] += 1

        if not origin:
            unmarked.append((key, h, actual))
            continue
        if origin != actual:
            bad.append((key, h, origin, actual))
            continue
        if actual == "third" and not ATTRIB.search(whyp.get(key, "")):
            unattributed.append((key, h))

    ok = True
    if unmarked:
        ok = False
        print(f"\nFAIL: {len(unmarked)} citation(s) carry no origin. Add o: \"oem\", "
              f"\"registry\" or \"third\".")
        for k, h, a in unmarked[:20]:
            print(f"  - {k}\n      {h}  (looks like: {a})")
    if bad:
        ok = False
        print(f"\nFAIL: {len(bad)} citation(s) claim an origin the domain contradicts.")
        print("      A source labelled oem that is not on the vendor's own site is the")
        print("      one error a reader cannot see and that flatters us.\n")
        for k, h, o, a in bad[:20]:
            print(f"  - {k}\n      {h}  marked {o}, actually {a}")
    if unattributed:
        ok = False
        print(f"\nFAIL: {len(unattributed)} third-party citation(s) whose note does not")
        print("      say whose claim it is. Damian's rule, 15 Aug 2026: name the")
        print("      distributor and say the vendor has not published it themselves.\n")
        for k, h in unattributed[:20]:
            print(f"  - {k}\n      {h}")

    if ok:
        print(f"PASS: {sum(counts.values())} citations — {counts['oem']} on the vendor's "
              f"own domain, {counts['registry']} on an independent registry, "
              f"{counts['third']} third-party and each one attributed in its note.")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
