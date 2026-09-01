#!/usr/bin/env python3
"""Fail if any page claims customer network credentials are sealed in the secure element.

THE CORRECTION, 13 Aug 2026, from firmware source.

TRUE, and worth saying:
    The DEVICE'S OWN keys — its identity key and the key that verifies firmware
    updates — exist as SE050 objects whose private material never leaves the
    element. The application asks the element to perform an operation rather than
    holding the key. The channel to the element is GlobalPlatform SCP-03 and that
    channel's keys sit in ARM TrustZone.
    [key_propagation.sh:31-43,115-116]

FALSE, and published on ten surfaces until today:
    That the CUSTOMER's 802.1X certificate and its private-key password are
    sealed there. They are not. Customer certificates are written to the
    certificate store, and the 802.1X private-key password is a NetworkManager
    system secret.
    [NMGenerators.cpp:148-150,171-173]

The sentence that ran on the Trust Center, both product pages, a printable spec
sheet and a solutions page was:

    "Certificates and key passwords are sealed to the pod's onboard secure
     element rather than stored in configuration, so a pulled device doesn't
     surrender your network credentials."

False in its second half, and false in the half a network team cares about. It is
also the single most CHECKABLE claim the site made: a security reviewer with the
hardware on a bench can disprove it in an afternoon, which is exactly the audience
the Trust Center is written for.

WHY A CHECKER. The wrong version is more attractive than the right one — it is
shorter, it sounds stronger, and "sealed credentials" is the kind of phrase that
gets reached for when compressing a claim into a chip or a table cell. That is how
it reached ten surfaces. It will be reached for again.

WHAT THIS FAILS ON
    A "sealed"/"secure element"/"SE050" claim within 220 characters of a CUSTOMER
    credential word — certificate, credential, 802.1X, EAP, key password — unless
    the same window scopes it to the DEVICE ("device identity", "device's own",
    "identity key", "update-verification").

    Plus four exact phrases that were published and must never return.

Run against a build: python3 scripts/check-keycustody.py [dist-dir]  (default dist)
Exit 0 clean, 1 on any violation.
"""

import glob
import html as htmllib
import io
import os
import re
import sys

# Published and disproven. Never again, in any casing.
BANNED = [
    r"sealed to the pod",
    r"credentials and network certificates (?:are )?sealed",
    r"(?:does not|doesn't|does not) surrender your network credentials",
    r"\bsealed credentials\b",
    r"certificate material (?:is )?sealed",
    r"credentials sealed to the secure element",
    r"key passwords are sealed",
]

SEAL = re.compile(r"sealed|secure element|SE050", re.I)
CUSTOMER = re.compile(
    r"\bcertificates?\b|\bcredentials?\b|802\.1[xX]|\bEAP\b|key password", re.I)
# Scoping that makes a seal claim true: it is about the DEVICE's own keys.
DEVICE_SCOPED = re.compile(
    r"device(?:'s|’s)? own|device identity|identity key|update-verification|"
    r"device(?:'s|’s)? (?:private )?keys|its own identity|"
    # Ruled by Damian 13 Aug 2026 (F4.12): the customer's private key may be
    # described as ENCRYPTED AT REST under a wrapping key that is itself sealed in
    # the element. That is key wrapping, not storage in the element, and it is a
    # different claim from the banned one. The distinction is the whole point, so
    # the phrasing has to be this specific to pass.
    r"encrypted at rest under a key that is itself sealed|"
    r"encrypted at rest under a key that itself is sealed", re.I)


def text_of(path):
    """Visible text, minus [verify: ...] notes.

    A bracketed verify note is a review flag, not a published claim — it renders as
    a yellow mark and its whole purpose is to say "this is not settled". Notes
    legitimately QUOTE the wrong wording in order to dispute it, and the Trust
    Center now carries one doing exactly that: it quotes the verification
    document's proposed "held encrypted at rest under that same secure element"
    and says the document's own evidence contradicts it.

    Checking a claim against the text of the note disputing that claim is
    backwards, so the notes come out before the scan. Everything a reader takes as
    a statement of fact remains in scope."""
    s = io.open(path, encoding="utf-8", errors="ignore").read()
    s = re.sub(r"<(script|style)[^>]*>.*?</\1>", " ", s, flags=re.S | re.I)

    # COMPETITOR CITATION CARDS come out; Polaris's own card stays in.
    #
    # Every cell of the comparison matrix now carries a sourced card, and those
    # cards quote what OTHER vendors publish. On 15 Aug 2026 this guard failed on
    # an Airtame cell reading "Neither it nor the Information Security Notice
    # mentions signed firmware, secure boot, TPM, secure element or a per-device
    # certificate" — a sentence about a competitor NOT having a secure element,
    # sitting near the word "certificate". True, sourced, and none of this guard's
    # business.
    #
    # The exemption is per card and by brand, not blanket: a card headed
    # <b>Polaris</b> is a claim about OUR device and stays fully in scope. A guard
    # that exempted the whole matrix would have exempted our own column with it.
    #
    # `[^>]*` after the class, not a literal `>`: the card gained an id on
    # 15 Aug 2026 when aria-describedby replaced the duplicated aria-label, and
    # this pattern stopped matching the moment it did. The guard then failed on
    # the same Airtame sentence it had already been taught to ignore — a good
    # reminder that a guard keyed on exact markup breaks silently when the markup
    # is improved, and that the failure looks like a real defect.
    s = re.sub(r'<span class="pwc"[^>]*><b>(?!Polaris<)[^<]*</b>.*?</span>', " ", s, flags=re.S)

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
        t = text_of(f)
        if not SEAL.search(t):
            continue
        checked += 1

        for pat in BANNED:
            m = re.search(pat, t, re.I)
            if m:
                problems.append((url, "BANNED PHRASE", f'"{m.group(0)}"'))

        for m in SEAL.finditer(t):
            w = t[max(0, m.start() - 220): m.start() + 220]
            if not CUSTOMER.search(w):
                continue
            if DEVICE_SCOPED.search(w):
                continue
            # A correction note explaining what is NOT sealed is the opposite of
            # the claim, and the Trust Center legitimately carries one.
            if re.search(r"not sealed|rather than sealed|NOT be sealed|corrected", w, re.I):
                continue
            # A NEGATED secure element. The Gen 3 column of the upgrade comparison
            # says "No secure boot and no secure element — that is the generational
            # difference", which is the point of the row: the older hardware has
            # neither. It sits near "802.1X certificates" because the same cell
            # lists what Gen 3 DOES have, so the proximity test fires on a sentence
            # asserting the opposite of the claim being guarded.
            #
            # Tested on the token itself, not on the window: a negation anywhere in
            # 440 characters would let "credentials are sealed to the secure
            # element" pass on any page that also mentioned a device without one.
            # The word "no" has to be immediately in front of it.
            if re.search(r"\b(?:no|without\s+a|without\s+any|never\s+had\s+a)\s+$",
                         t[max(0, m.start() - 24): m.start()], re.I):
                continue
            problems.append((url, "UNSCOPED SEAL CLAIM", "…" + w.strip()[:200] + "…"))
            break

    if problems:
        print(f"FAIL: {len(problems)} key-custody problem(s) across {checked} pages.\n")
        print("The device's OWN keys never leave the secure element — say that.")
        print("The CUSTOMER's 802.1X certificate and key password are NOT in it.")
        print("See src/data/security.ts, THE SEALED-CREDENTIALS CORRECTION.\n")
        for url, kind, detail in problems:
            print(f"  {url}\n      {kind}\n        {detail}\n")
        return 1

    print(f"PASS: {checked} pages mention key custody, every seal claim scoped to "
          f"the device's own keys.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
