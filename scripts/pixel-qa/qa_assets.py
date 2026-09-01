"""qa_assets.py -- deterministic structural checks on the string-art stores.

Checks, per sprite:

  E1  frames within one sprite differ in width or height  (breaks animation)
  E2  rows within one frame are of unequal length         (malformed sprite)
  E3  characters outside the legal PXC set                (renders nothing)
  E4  palette index referenced beyond the end of PAL      (undefined colour)
  E5  every frame of the sprite is entirely transparent   (invisible sprite)
  W1  one (but not every) frame is entirely transparent   (blink / wasted frame)
  W2  a tile off its own game's grid: tile_* must be 8x8, e_[tcdw]_* 16x16
  W3  size disagrees with the engine's documented SPRITE INVENTORY docblock
  W4  frame count disagrees with the same docblock

E* are hard errors and make the script exit 1.  W* are reported but do not
fail the run.

Usage
-----
    python3 qa_assets.py [repo_root] [--json out.json] [--quiet]
"""

from __future__ import annotations

import json
import re
import sys

import parse   # NB: read parse.LEGAL_CHARS / parse.CHAR_TO_INDEX through the
               # module, never `from parse import` them - refresh_pxc() rebinds
               # them at load time and a by-value import would miss the update.
from parse import (CHAR_TO_INDEX, LEGAL_CHARS, TRANSPARENT, bbox, base_name,
                   frame_size, is_tile, load_all, opaque_count,
                   repo_root_default)

# ---------------------------------------------------------------------------
# the engine's documented inventory (runtime.ts docblock, "SPRITE INVENTORY")
# ---------------------------------------------------------------------------
_INV_NAMES = re.compile(
    r"(?P<names>[a-z][a-z0-9_]*\*?(?:/[a-z][a-z0-9_]*\*?)*)"
    r"(?:\s+(?P<w>\d+)x(?P<h>\d+))?"
    r"(?:\s+x(?P<n>\d+))?")


def parse_inventory(repo_root: str, art_names) -> dict:
    """Return {name_or_glob: {"w":int|None, "h":int|None, "frames":int|None}}.

    The docblock is prose, so this is best-effort by design: a candidate name is
    only kept when it actually matches a sprite in the store (which throws away
    prose words such as "the 16x20 box"), and a name written without dimensions
    inherits the last dimensions stated in the block -- which is how the block
    reads ("player_idle 16x20 x2 - player_run x4").
    """
    import os
    src = parse._read(os.path.join(repo_root, parse.RUNTIME_TS))
    m = re.search(r"SPRITE INVENTORY.*?\n(?P<body>.*?)\n\s*TEXT\b", src, re.S)
    if not m:
        return {}
    body = m.group("body")
    real = set(art_names)
    prefixes = sorted({n.split("_")[0] for n in real})

    def matches(token: str) -> bool:
        if token.endswith("*"):
            stem = token[:-1]
            return any(n.startswith(stem) for n in real)
        return token in real or token in prefixes

    inv = {}
    last_dims = (None, None)
    for mm in _INV_NAMES.finditer(body):
        names = [t for t in mm.group("names").split("/") if t]
        w = int(mm.group("w")) if mm.group("w") else None
        h = int(mm.group("h")) if mm.group("h") else None
        n = int(mm.group("n")) if mm.group("n") else None
        keep = [t for t in names if matches(t)]
        if not keep:
            continue
        if w is not None:
            last_dims = (w, h)
        elif n is not None:
            # "player_run x4" -- inherits the box stated just before it
            w, h = last_dims
        if w is None and n is None:
            continue
        for t in keep:
            rec = inv.setdefault(t, {"w": None, "h": None, "frames": None})
            if w is not None:
                rec["w"], rec["h"] = w, h
            if n is not None:
                rec["frames"] = n
    return inv


def inventory_expectation(name: str, inv: dict):
    """Exact name first, then the longest matching glob."""
    if name in inv:
        return name, inv[name]
    best = None
    for key, rec in inv.items():
        if key.endswith("*") and name.startswith(key[:-1]):
            if best is None or len(key) > len(best):
                best = key
    return (best, inv[best]) if best else (None, None)


# ---------------------------------------------------------------------------
# the checks
# ---------------------------------------------------------------------------
def check_sprite(name: str, rec: dict, pal: list, inv: dict) -> list:
    """Return a list of finding dicts for one sprite."""
    out = []
    frames = rec["frames"]
    store = rec["store"]
    bare = base_name(name)

    def add(code, severity, detail, **extra):
        f = {"code": code, "severity": severity, "sprite": name,
             "store": store, "detail": detail}
        f.update(extra)
        out.append(f)

    if not frames:
        add("E5", "error", "sprite has zero frames")
        return out

    # --- E2 ragged rows, E3 illegal chars, E4 out-of-range palette index ----
    for fi, frame in enumerate(frames):
        lens = sorted({len(r) for r in frame})
        if len(lens) > 1:
            add("E2", "error",
                "frame %d has rows of unequal length: %s (rows %s)"
                % (fi, "/".join(str(x) for x in lens),
                   ",".join(str(i) for i, r in enumerate(frame)
                            if len(r) != lens[-1])[:60]),
                frame=fi)
        bad = {}
        oor = {}
        for y, row in enumerate(frame):
            for x, ch in enumerate(row):
                if ch not in parse.LEGAL_CHARS:
                    bad.setdefault(ch, []).append((x, y))
                elif ch != TRANSPARENT and parse.CHAR_TO_INDEX[ch] >= len(pal):
                    oor.setdefault(ch, []).append((x, y))
        if bad:
            add("E3", "error",
                "frame %d uses illegal character(s) %s at %s"
                % (fi, " ".join(sorted("%r" % c for c in bad)),
                   ", ".join("%s@(%d,%d)" % (c, v[0][0], v[0][1])
                             for c, v in sorted(bad.items()))),
                frame=fi)
        if oor:
            add("E4", "error",
                "frame %d references palette index past PAL[%d]: %s"
                % (fi, len(pal) - 1,
                   ", ".join("'%s'->%d" % (c, parse.CHAR_TO_INDEX[c])
                             for c in sorted(oor))),
                frame=fi)

    # --- E1 inter-frame size drift ------------------------------------------
    sizes = [frame_size(f) for f in frames]
    if len(set(sizes)) > 1:
        add("E1", "error",
            "frames differ in size: %s"
            % " ".join("f%d=%dx%d" % (i, w, h) for i, (w, h) in enumerate(sizes)))

    # --- E5 / W1 blank frames ----------------------------------------------
    blanks = [i for i, f in enumerate(frames) if opaque_count(f) == 0]
    if blanks and len(blanks) == len(frames):
        add("E5", "error", "every frame is entirely transparent")
    elif blanks:
        add("W1", "warn",
            "frame(s) %s entirely transparent"
            % ",".join(str(i) for i in blanks))

    # --- W2 tiles must sit on their own game's grid -------------------------
    # There are TWO tile grids, not one. The Stage 2 games run 8x8 (drawTiles).
    # THE LOST DISPLAY (egg6) runs TS=16 at runtime.ts:5281 and its e_[tcdw]_*
    # tiles are 16x16 by design. Checking every tile against 8x8 produced 90
    # warnings that were all one stale sentence in the docblock, which is exactly
    # how a validator teaches people to ignore it. Each family is now checked
    # against its own grid; anything off BOTH grids is still a real misalignment.
    if is_tile(bare):
        expect = 16 if bare.startswith("e_") else 8
        offenders = ["f%d=%dx%d" % (i, w, h) for i, (w, h) in enumerate(sizes)
                     if (w, h) != (expect, expect)]
        if offenders:
            on_grid = all(w % 8 == 0 and h % 8 == 0 for w, h in sizes)
            add("W2", "warn" if on_grid else "error",
                "tile is not 8x8: %s%s"
                % (" ".join(offenders),
                   "" if on_grid else "  -- and not a multiple of 8 (off-grid)"),
                multiple_of_8=on_grid)

    # --- W3 / W4 documented inventory --------------------------------------
    key, exp = inventory_expectation(bare, inv)
    if exp:
        w, h = sizes[0]
        if exp["w"] is not None and (w, h) != (exp["w"], exp["h"]):
            add("W3", "warn",
                "docblock (%s) says %dx%d, art is %dx%d"
                % (key, exp["w"], exp["h"], w, h))
        if exp["frames"] is not None and exp["frames"] != len(frames):
            add("W4", "warn",
                "docblock (%s) says %d frame(s), art has %d"
                % (key, exp["frames"], len(frames)))
    return out


def run(repo_root: str):
    art, pal = load_all(repo_root)
    inv = parse_inventory(repo_root, [base_name(n) for n in art])
    findings = []
    for name in sorted(art):
        findings.extend(check_sprite(name, art[name], pal, inv))
    return art, pal, inv, findings


CODE_LABEL = {
    "E1": "frame size drift within sprite",
    "E2": "ragged rows inside a frame",
    "E3": "illegal PXC character",
    "E4": "palette index past end of PAL",
    "E5": "sprite entirely transparent",
    "W1": "one frame entirely transparent",
    "W2": "tile off its own game's grid (8x8 Stage 2 / 16x16 egg6)",
    "W3": "size differs from docblock inventory",
    "W4": "frame count differs from docblock inventory",
}


def main(argv):
    args = [a for a in argv[1:] if not a.startswith("--")]
    root = args[0] if args else repo_root_default()
    json_out = None
    for a in argv[1:]:
        if a.startswith("--json="):
            json_out = a.split("=", 1)[1]
    quiet = "--quiet" in argv

    art, pal, inv, findings = run(root)

    # --- documented suppressions ------------------------------------------------

    # annotations.json records every case where a check's assumption does not hold for

    # a given sprite, together with the engine line that proves it. It is applied here,

    # before anything is counted, so the summary counts and the detail list can never

    # disagree. A validator that is mostly wrong is worse than no validator.

    try:

        import suppress as _sup

        findings, _muted = _sup.filter_findings(findings, list(art.keys()))

    except Exception as _e:

        _muted = []

        print("annotation filter unavailable (%s) - reporting everything" % _e)
    errors = [f for f in findings if f["severity"] == "error"]

    if not quiet:
        if _muted and not quiet:
            import os as _os
            print("suppressed %d finding(s) by annotation (annotations.json); SHOW_SUPPRESSED=1 to list" % len(_muted))
            if _os.environ.get("SHOW_SUPPRESSED"):
                for _f in _muted:
                    print("   [muted %s] %-26s %s" % (_f.get("code"), _f.get("sprite"), _f.get("suppressed_because", "")[:110]))
            print()
        print("PIXEL QA -- ASSETS")
        print("repo   : %s" % root)
        print("sprites: %d  (EGG_ART %d, EART6 %d)  frames: %d  PAL: %d"
              % (len(art),
                 sum(1 for v in art.values() if v["store"] == "EGG_ART"),
                 sum(1 for v in art.values() if v["store"] == "EART6"),
                 sum(len(v["frames"]) for v in art.values()), len(pal)))
        print("docblock inventory entries parsed: %d" % len(inv))
        print()
        print("%-4s %-46s %-7s %s" % ("CODE", "CHECK", "COUNT", "SPRITES"))
        print("-" * 100)
        for code in ("E1", "E2", "E3", "E4", "E5", "W1", "W2", "W3", "W4"):
            hits = [f for f in findings if f["code"] == code]
            names = sorted({f["sprite"] for f in hits})
            shown = ", ".join(names[:6]) + (" ..." if len(names) > 6 else "")
            print("%-4s %-46s %-7d %s" % (code, CODE_LABEL[code], len(hits), shown))
        print("-" * 100)
        print("hard errors: %d   warnings: %d"
              % (len(errors), len(findings) - len(errors)))
        print()
        for f in findings:
            print("[%s] %-28s %s" % (f["code"], f["sprite"], f["detail"]))

    if json_out:
        with open(json_out, "w", encoding="utf-8") as fh:
            json.dump({"findings": findings,
                       "inventory": inv,
                       "labels": CODE_LABEL,
                       "sprite_count": len(art),
                       "pal_size": len(pal)}, fh, indent=1)

    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
