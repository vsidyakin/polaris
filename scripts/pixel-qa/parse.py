"""parse.py -- pull the palette-indexed string-art stores out of the TypeScript
sources and hand back plain Python data.

Three stores exist in the repo:

  EGG_ART  src/scripts/eggs/data.ts     one very long single-line JSON object
  EART5    src/scripts/eggs/runtime.ts  SIGNAL JUMPER (Venus) override store
  EART6    src/scripts/eggs/runtime.ts  THE LOST DISPLAY (Earth) override store
                                        -- both multi-line JS object literals with
                                        bare keys and /* block comments */

All three use the same frame format::

    name: [ frame, frame, ... ]        frame = [ "rowstring", "rowstring", ...]

One character per pixel.  '.' is transparent; every other legal character maps
to an index into PAL via PXC (see CHAR_TO_INDEX below).

Public API
----------
load_all(repo_root) -> (art, pal)
    art : dict name -> {"frames": [[str, ...], ...], "store": "EGG_ART"|"EART5"|"EART6"}
    pal : list[str] of "#rrggbb"

Nothing here imports Pillow, so the checkers stay dependency-free.
"""

from __future__ import annotations

import json
import os
import re

# ---------------------------------------------------------------------------
# PXC -- character to palette index.  Mirrors runtime.ts:
#   const PXC=(()=>{const m={};"0123..Zabcdefghi".split("")
#                   .forEach((ch,i)=>m[ch]=i);return m})();
# ---------------------------------------------------------------------------
# Read the order OUT OF THE SOURCE rather than restating it here. A hardcoded copy
# drifted the moment PAL was extended for Venus: two new characters, j and k, were
# perfectly legal to the engine and "illegal" to this checker, which turned a correct
# art change into two phantom hard errors. A validator that has its own private copy
# of a fact will eventually disagree with the code it validates.
_PXC_FALLBACK = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghi"


def _pxc_order_from_source(repo_root):
    """Lift the PXC character string from runtime.ts. Falls back to the documented
    order if the shape of that line ever changes, so QA degrades rather than dies."""
    import os, re as _re
    try:
        rt = os.path.join(repo_root, "src", "scripts", "eggs", "runtime.ts")
        with open(rt, encoding="utf-8") as fh:
            src = fh.read()
        m = _re.search(r'PXC\s*=\s*\(\(\)\s*=>\s*\{[^"]*"([^"]+)"\.split', src)
        if m and len(m.group(1)) >= 40:
            return m.group(1)
    except Exception:
        pass
    return _PXC_FALLBACK


PXC_ORDER = _PXC_FALLBACK
CHAR_TO_INDEX = {ch: i for i, ch in enumerate(PXC_ORDER)}


def refresh_pxc(repo_root):
    """Re-derive the legal character set from the repo. load_all() calls this, so any
    entry point that loads art gets the current set without having to ask."""
    global PXC_ORDER, CHAR_TO_INDEX, LEGAL_CHARS
    PXC_ORDER = _pxc_order_from_source(repo_root)
    CHAR_TO_INDEX = {ch: i for i, ch in enumerate(PXC_ORDER)}
    LEGAL_CHARS = set(PXC_ORDER) | {TRANSPARENT}
    return PXC_ORDER
TRANSPARENT = "."
LEGAL_CHARS = set(PXC_ORDER) | {TRANSPARENT}

DATA_TS = os.path.join("src", "scripts", "eggs", "data.ts")
RUNTIME_TS = os.path.join("src", "scripts", "eggs", "runtime.ts")

# tile_* is the EGG_ART 8x8 tile store; e_[tcdw]_* is the EART6 tile store
# (eggPx6() skips mirroring exactly those, which is how the engine knows).
TILE_RE = re.compile(r"^(tile_|e_[tcdw]_)")


def is_tile(name: str) -> bool:
    return bool(TILE_RE.match(name))


# ---------------------------------------------------------------------------
# low level text helpers
# ---------------------------------------------------------------------------
def _read(path: str) -> str:
    with open(path, "r", encoding="utf-8", errors="replace") as fh:
        return fh.read()


def _strip_comments(src: str) -> str:
    """Remove /* ... */ and // ... comments *outside* of string literals.

    Written as a small scanner rather than a regex because the art rows are
    full of characters a regex would happily eat.
    """
    out = []
    i, n = 0, len(src)
    while i < n:
        ch = src[i]
        if ch == '"' or ch == "'":
            quote = ch
            out.append(ch)
            i += 1
            while i < n:
                if src[i] == "\\":
                    out.append(src[i:i + 2])
                    i += 2
                    continue
                out.append(src[i])
                if src[i] == quote:
                    i += 1
                    break
                i += 1
            continue
        if ch == "/" and i + 1 < n and src[i + 1] == "*":
            j = src.find("*/", i + 2)
            i = n if j < 0 else j + 2
            out.append(" ")
            continue
        if ch == "/" and i + 1 < n and src[i + 1] == "/":
            j = src.find("\n", i)
            i = n if j < 0 else j
            out.append(" ")
            continue
        out.append(ch)
        i += 1
    return "".join(out)


def _balanced_slice(src: str, start: int, open_ch: str, close_ch: str) -> str:
    """Return src[start:end] where start indexes open_ch and end is one past the
    matching close_ch.  String-literal aware."""
    depth = 0
    i, n = start, len(src)
    while i < n:
        ch = src[i]
        if ch == '"' or ch == "'":
            quote = ch
            i += 1
            while i < n:
                if src[i] == "\\":
                    i += 2
                    continue
                if src[i] == quote:
                    break
                i += 1
            i += 1
            continue
        if ch == open_ch:
            depth += 1
        elif ch == close_ch:
            depth -= 1
            if depth == 0:
                return src[start:i + 1]
        i += 1
    raise ValueError("unbalanced %s starting at offset %d" % (open_ch, start))


_BARE_KEY = re.compile(r'(?P<pre>[{,]\s*)(?P<key>[A-Za-z_$][A-Za-z0-9_$]*)\s*:')
_TRAILING_COMMA = re.compile(r",\s*(?P<close>[}\]])")


def _js_object_to_json(text: str) -> dict:
    """Convert a JS object literal of string-arrays into JSON and load it.

    Handles bare keys, single-quoted strings and trailing commas -- the full
    grammar the two art stores actually use.
    """
    t = text
    if "'" in t and '"' not in t:
        t = t.replace("'", '"')
    t = _BARE_KEY.sub(lambda m: '%s"%s":' % (m.group("pre"), m.group("key")), t)
    for _ in range(4):
        new = _TRAILING_COMMA.sub(lambda m: m.group("close"), t)
        if new == t:
            break
        t = new
    return json.loads(t)


def _normalise(raw: dict, store: str) -> dict:
    """raw: name -> list of frames.  Coerce to the documented shape and record
    which store each sprite came from."""
    art = {}
    for name, frames in raw.items():
        if not isinstance(frames, list):
            continue
        norm_frames = []
        for frame in frames:
            if isinstance(frame, str):
                norm_frames.append([frame])          # a lone row used as a frame
            elif isinstance(frame, list):
                norm_frames.append([r if isinstance(r, str) else str(r)
                                    for r in frame])
        art[name] = {"frames": norm_frames, "store": store}
    return art


# ---------------------------------------------------------------------------
# the three extractors
# ---------------------------------------------------------------------------
def load_egg_art(repo_root: str) -> dict:
    src = _strip_comments(_read(os.path.join(repo_root, DATA_TS)))
    m = re.search(r"EGG_ART\s*=\s*\{", src)
    if not m:
        raise ValueError("EGG_ART not found in %s" % DATA_TS)
    body = _balanced_slice(src, m.end() - 1, "{", "}")
    return _normalise(_js_object_to_json(body), "EGG_ART")


def _load_runtime_store(repo_root: str, name: str) -> dict:
    """EART5 and EART6 are the same shape in the same file, so they load the
    same way.  Kept as one function because two copies of this drifted once
    already."""
    src = _strip_comments(_read(os.path.join(repo_root, RUNTIME_TS)))
    m = re.search(r"\b%s\s*=\s*\{" % name, src)
    if not m:
        raise ValueError("%s not found in %s" % (name, RUNTIME_TS))
    body = _balanced_slice(src, m.end() - 1, "{", "}")
    return _normalise(_js_object_to_json(body), name)


def load_eart5(repo_root: str) -> dict:
    return _load_runtime_store(repo_root, "EART5")


def load_eart6(repo_root: str) -> dict:
    return _load_runtime_store(repo_root, "EART6")


def load_pal(repo_root: str) -> list:
    src = _strip_comments(_read(os.path.join(repo_root, RUNTIME_TS)))
    m = re.search(r"\bPAL\s*=\s*\[", src)
    if not m:
        raise ValueError("PAL not found in %s" % RUNTIME_TS)
    body = _balanced_slice(src, m.end() - 1, "[", "]")
    pal = json.loads(_TRAILING_COMMA.sub(lambda mm: mm.group("close"), body))
    return [str(c) for c in pal]


def load_all(repo_root: str):
    """Return (art, pal).

    art maps sprite name -> {"frames": [[row, ...], ...], "store": ...}.
    EART5 and EART6 are later per-game override stores: EART5 is SIGNAL JUMPER's
    (Venus), EART6 is THE LOST DISPLAY's (Earth).  Where a name exists in more
    than one store the override is kept under "<name>@EART5" / "<name>@EART6" so
    nothing is lost and the versions can be compared directly.

    EART5 in particular MUST be loaded here: most of its keys shadow EGG_ART
    names, so without it the checkers would measure the art Venus no longer draws
    and report a clean bill for a store nobody was looking at.
    """
    refresh_pxc(repo_root)   # legal chars come from the engine, not from a constant
    egg = load_egg_art(repo_root)
    e5 = load_eart5(repo_root)
    e6 = load_eart6(repo_root)
    pal = load_pal(repo_root)
    art = dict(egg)
    for store, recs in (("EART5", e5), ("EART6", e6)):
        for name, rec in recs.items():
            key = name if name not in art else name + "@" + store
            art[key] = rec
    return art, pal


# ---------------------------------------------------------------------------
# small geometry helpers shared by the checkers
# ---------------------------------------------------------------------------
def frame_size(frame):
    """(w, h) using the widest row, so ragged frames still report something."""
    if not frame:
        return (0, 0)
    return (max(len(r) for r in frame), len(frame))


def opaque_cells(frame):
    """Yield (x, y, char) for every non-transparent pixel."""
    for y, row in enumerate(frame):
        for x, ch in enumerate(row):
            if ch != TRANSPARENT:
                yield (x, y, ch)


def bbox(frame):
    """(x0, y0, x1, y1) inclusive over opaque pixels, or None if fully clear."""
    xs0 = ys0 = 10 ** 9
    xs1 = ys1 = -1
    for x, y, _ in opaque_cells(frame):
        if x < xs0:
            xs0 = x
        if x > xs1:
            xs1 = x
        if y < ys0:
            ys0 = y
        if y > ys1:
            ys1 = y
    if xs1 < 0:
        return None
    return (xs0, ys0, xs1, ys1)


def opaque_count(frame):
    return sum(1 for _ in opaque_cells(frame))


def base_name(name: str) -> str:
    """Strip the '@EART5' / '@EART6' collision suffix."""
    return name.split("@", 1)[0]


def repo_root_default() -> str:
    """The repo root, assuming this file lives at <root>/scripts/pixel-qa/."""
    here = os.path.dirname(os.path.abspath(__file__))
    return os.path.abspath(os.path.join(here, os.pardir, os.pardir))


if __name__ == "__main__":
    import sys
    root = sys.argv[1] if len(sys.argv) > 1 else repo_root_default()
    art, pal = load_all(root)
    egg = [k for k, v in art.items() if v["store"] == "EGG_ART"]
    e5 = [k for k, v in art.items() if v["store"] == "EART5"]
    e6 = [k for k, v in art.items() if v["store"] == "EART6"]
    print("repo root : %s" % root)
    print("EGG_ART   : %d sprites, %d frames"
          % (len(egg), sum(len(art[k]["frames"]) for k in egg)))
    print("EART5     : %d sprites, %d frames"
          % (len(e5), sum(len(art[k]["frames"]) for k in e5)))
    print("EART6     : %d sprites, %d frames"
          % (len(e6), sum(len(art[k]["frames"]) for k in e6)))
    print("PAL       : %d colours" % len(pal))
