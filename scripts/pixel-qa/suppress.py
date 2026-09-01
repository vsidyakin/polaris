"""Documented suppression of QA findings.

A validator that fires 278 times and is mostly wrong is worse than none, because the
next person stops reading it. annotations.json records every case where a check's
assumption does not hold, with the engine line that proves it. This module is the
single place that applies those records, so all four checks agree.
"""
import json, os, re

_HERE = os.path.dirname(os.path.abspath(__file__))
with open(os.path.join(_HERE, "annotations.json"), encoding="utf-8") as fh:
    ANN = json.load(fh)

_SPRITES = {k: v for k, v in ANN.get("sprites", {}).items() if not k.startswith("_")}
_SHADOW = ANN.get("shadowed_by_override", {})


def bare(name):
    """'e_c_floor@EART6' -> 'e_c_floor'"""
    return name.split("@", 1)[0]


def store_of(name, default=""):
    return name.split("@", 1)[1] if "@" in name else default


def is_shadowed(name, all_names):
    """True when this sprite's store is overridden for this name by a later store,
    so the entry never reaches the screen and its numbers describe unseen art."""
    src, dst = _SHADOW.get("store"), _SHADOW.get("overridden_by")
    if not src or not dst:
        return False
    if store_of(name, src) != src:
        return False
    return f"{bare(name)}@{dst}" in all_names


def suppressed(name, code, all_names=()):
    """(bool, reason). Reason is empty when the finding stands."""
    rec = _SPRITES.get(bare(name)) or _SPRITES.get(name)
    if rec and code in rec.get("suppress", []):
        return True, rec.get("reason", "annotated")
    if all_names and is_shadowed(name, all_names):
        return True, "shadowed: %s overrides this name, so this copy never renders" % _SHADOW.get("overridden_by")
    return False, ""


def filter_findings(findings, all_names=()):
    """Split a list of finding dicts into (live, suppressed_with_reason)."""
    live, muted = [], []
    for f in findings:
        ok, why = suppressed(f.get("sprite", ""), f.get("code", ""), all_names)
        if ok:
            f = dict(f); f["suppressed_because"] = why
            muted.append(f)
        else:
            live.append(f)
    return live, muted
