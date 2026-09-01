#!/usr/bin/env python3
"""Fail if a claim Damian has ruled out of the POC reappears in the built site.

WHY THIS IS ONE SCRIPT AND NOT ONE PER PHRASE

The other guards each enforce a *shape* of correctness — a spec must be stated at
full depth, a warranty claim must carry its condition, a seal claim must be scoped
to the device. This one enforces a list: specific sentences that were published,
found to be untrue or ambiguous, and ruled out. That list will grow, and growing a
table is cheaper than growing a directory of near-identical scripts.

Each entry carries the ruling date and the reason, because in six months the
useful question will not be "what is banned" but "why, and who said so".

SEEDED WITH THE TWO FROM 14 AUG 2026

DRIFT DETECTION. Ruled: "remove drift concept everywhere." It reached thirteen
places across seven files and it does not exist — template application is
push-only, there is no read-back and no periodic audit. Its provenance is the
instructive part: it came out of Mersive's own blog post, where it is a checklist
item telling BUYERS what to test for in a management platform. Prescriptive
language about the category became descriptive language about us. That is the same
failure that put Amazon Fire TV Stick specs in the Element column — authoritative
text about something adjacent, read as text about us. An earlier technical report
had already flagged it as a Q4 2026 roadmap line, so this is the second
independent pass to catch it. Hence a guard.

BARE "NO ROLLBACK". Ruled: "we have rollback of a bad firmware load." Two
mechanisms hide inside one word, and the site published both halves as a
contradiction — the Pro page headed a row "Signed updates, no rollback" while the
firmware page described automatic rollback in operational detail, and the
printable sheet said "rollback protection", which a reader takes as protection
AGAINST rollback. A DOWNGRADE chosen by an administrator is refused; a FAILED LOAD
returns to the last known-good partition. Say which one you mean.

WHAT IS DELIBERATELY NOT BANNED
  - the word "drift" alone: /resources/network correctly warns that clock drift
    over two minutes breaks certificate validation, and several figures drift on
    scroll. Banning a word because a phrase misused it is how a guard starts
    fighting correct copy.
  - "rollback" alone: the compare matrix scores "automatic rollback if a firmware
    update fails" and its hover cards analyse rivals' RAUC evidence in detail.
    Those are facts, and one of them is now a Polaris strength.

Run against a build: python3 scripts/check-claims.py [dist-dir]   (default dist)
Exit 0 clean, 1 on any violation.
"""

import glob
import html as htmllib
import io
import os
import re
import sys

# (compiled pattern, short name, why it is banned, what to say instead)
BANNED = [
    (re.compile(r"drift\s+detection", re.I),
     "drift detection",
     "does not exist; template application is push-only with no read-back or audit "
     "job. Q4 2026 roadmap. Ruled out of the POC by Damian Blazy 14 Aug 2026.",
     "Editing a template re-applies it to every device assigned to it, so a room "
     "that was changed locally comes back to the approved profile."),

    (re.compile(r"settings[-\s]drift|configuration\s+drift|config\s+drift", re.I),
     "settings / configuration drift",
     "same ruling: the drift concept comes off the POC entirely, on the problem "
     "side as well as the capability side. Naming a problem the product does not "
     "solve is worse than not raising it.",
     "State what templates do: a template edit re-applies across every room "
     "assigned to it."),

    (re.compile(r"\bno\s+rollback\b|\brollback\s+protection\b|\bwithout\s+rollback\b", re.I),
     "bare 'no rollback' / 'rollback protection'",
     "false and backwards. Polaris DOES roll back a failed firmware load, from two "
     "partitions. What it refuses is a deliberate DOWNGRADE. Confirmed by Damian "
     "Blazy 14 Aug 2026; see src/data/rulings.ts, FIRMWARE.",
     "'the device refuses a downgrade' for the security property, and 'automatic "
     "rollback on a failed load' for the reliability one. Never the bare word."),
]


def text_of(path):
    """Visible text, with [verify: ...] notes removed.

    A verify note has to be able to quote a banned phrase in order to say it is
    banned — /resources/firmware now carries one doing exactly that about staged
    rollout. Checking a claim against the note disputing it is backwards, and it
    has already cost two rounds on other guards this week."""
    s = io.open(path, encoding="utf-8", errors="ignore").read()
    s = re.sub(r"<(script|style)[^>]*>.*?</\1>", " ", s, flags=re.S | re.I)
    t = " ".join(htmllib.unescape(re.sub(r"<[^>]+>", " ", s)).split())
    return re.sub(r"\[verify:[^\]]*\]", " ", t, flags=re.I)


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
        checked += 1
        t = text_of(f)
        for rx, name, why, instead in BANNED:
            m = rx.search(t)
            if m:
                ctx = t[max(0, m.start() - 90): m.end() + 90]
                problems.append((url, name, m.group(0), why, instead, ctx))

    if problems:
        print(f"FAIL: {len(problems)} retired claim(s) back on {checked} pages.\n")
        for url, name, hit, why, instead, ctx in problems:
            print(f"  {url}")
            print(f"      found   : \"{hit}\"  ({name})")
            print(f"      why     : {why}")
            print(f"      instead : {instead}")
            print(f"      context : …{ctx}…\n")
        return 1

    print(f"PASS: {checked} pages, none carrying any of the {len(BANNED)} retired "
          f"claim patterns.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
