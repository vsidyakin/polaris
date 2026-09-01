"""qa_palette.py -- palette and readability analysis.

Reports:

  P1  NEAR-DUPLICATE PAL ENTRIES   any two PAL entries within a CIE76 deltaE of
      6.  Two colours that close are colour noise: they cost a palette slot and
      no player can tell them apart.
  P2  FLAT VALUE CLUSTER           any cluster of 3+ PAL entries whose WCAG
      relative luminance is within 0.03 of each other.  Shading reads by value
      first, so a value cluster flattens whatever ramp it sits in.
  P3  LOW CONTRAST ON THE VOID     for every sprite, the WCAG contrast ratio
      between its most-used opaque colour and PAL[0] and PAL[1] (the two
      void / background colours).  Under 3:1 the sprite disappears into the
      background.
  P4  INVISIBLE SPRITE             no colour anywhere in the sprite clears 3:1
      against the void.  P3 alone over-reports outlined sprites (a black
      outline is meant to be black); P4 is the version that cannot be argued
      with -- nothing in the sprite separates from the background.

Also prints the per-sprite distinct-colour count and a per-game colour census
(games are inferred from the sprite name prefix, which is how the stores are
organised: player_/boss_/tile_ ... for the 8-bit platformer, inv_ for the
inventory game, e_ for the Mars relay-run game, ss_/sky_ for the star scenes).

All animation/palette findings are advisory; the script always exits 0.

Usage
-----
    python3 qa_palette.py [repo_root] [--json=out.json] [--quiet]
"""

from __future__ import annotations

import json
import math
import sys
from collections import Counter

import parse   # NB: read parse.LEGAL_CHARS / parse.CHAR_TO_INDEX through the
               # module, never `from parse import` them - refresh_pxc() rebinds
               # them at load time and a by-value import would miss the update.
from parse import (CHAR_TO_INDEX, TRANSPARENT, base_name, is_tile, load_all,
                   opaque_cells, repo_root_default)

DELTA_E_TOL = 6.0        # CIE76 -- below this two colours are the same colour
LUM_CLUSTER_TOL = 0.03   # WCAG relative luminance
LUM_CLUSTER_MIN = 3      # how many colours make it a "cluster"
CONTRAST_FLOOR = 3.0     # WCAG large-text / graphics floor

CODE_LABEL = {
    "P1": "near-duplicate PAL colours (CIE76 deltaE < 6)",
    "P2": "flat value cluster (3+ PAL colours within 0.03 luminance)",
    "P3": "sprite's dominant colour under 3:1 contrast on the void",
    "P4": "no colour in the sprite reaches 3:1 on the void (invisible sprite)",
}


# ---------------------------------------------------------------------------
# colour maths -- sRGB -> linear -> XYZ -> CIE Lab, D65
# ---------------------------------------------------------------------------
def hex_to_rgb(h: str):
    h = h.lstrip("#")
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))


def _lin(c: float) -> float:
    c = c / 255.0
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def relative_luminance(hexcol: str) -> float:
    """WCAG 2.x relative luminance."""
    r, g, b = hex_to_rgb(hexcol)
    return 0.2126 * _lin(r) + 0.7152 * _lin(g) + 0.0722 * _lin(b)


def contrast_ratio(a: str, b: str) -> float:
    la, lb = relative_luminance(a), relative_luminance(b)
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)


_WHITE = (95.047, 100.000, 108.883)   # D65


def to_lab(hexcol: str):
    r, g, b = (_lin(c) for c in hex_to_rgb(hexcol))
    x = (r * 0.4124 + g * 0.3576 + b * 0.1805) * 100
    y = (r * 0.2126 + g * 0.7152 + b * 0.0722) * 100
    z = (r * 0.0193 + g * 0.1192 + b * 0.9505) * 100

    def f(t):
        t = t / 1.0
        return t ** (1.0 / 3) if t > 0.008856 else (7.787 * t) + (16.0 / 116)

    fx, fy, fz = f(x / _WHITE[0]), f(y / _WHITE[1]), f(z / _WHITE[2])
    return (116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz))


def delta_e76(a: str, b: str) -> float:
    la, aa, ba = to_lab(a)
    lb, ab, bb = to_lab(b)
    return math.sqrt((la - lb) ** 2 + (aa - ab) ** 2 + (ba - bb) ** 2)


def pal_char(index: int) -> str:
    from parse import PXC_ORDER
    return PXC_ORDER[index] if index < len(PXC_ORDER) else "?"


# ---------------------------------------------------------------------------
# which game a sprite belongs to (the stores are organised by name prefix)
# ---------------------------------------------------------------------------
GAME_RULES = [
    ("e_",        "Mars relay run (game 6)"),
    ("inv_",      "inventory shooter"),
    ("ss_",       "star scene"),
    ("sky_",      "star scene"),
    ("player_",   "8-bit platformer"),
    ("boss_",     "8-bit platformer"),
    ("tile_",     "8-bit platformer"),
    ("prop_",     "8-bit platformer"),
    ("pk_",       "8-bit platformer"),
    ("hud_",      "8-bit platformer"),
]


def game_of(name: str) -> str:
    bare = base_name(name)
    for prefix, game in GAME_RULES:
        if bare.startswith(prefix):
            return game
    return "8-bit platformer"


# ---------------------------------------------------------------------------
# analysis
# ---------------------------------------------------------------------------
def sprite_colour_census(rec: dict) -> Counter:
    """Counter of palette index -> pixel count over every frame."""
    c = Counter()
    for frame in rec["frames"]:
        for _, _, ch in opaque_cells(frame):
            c[parse.CHAR_TO_INDEX[ch]] += 1
    return c


def near_duplicates(pal: list) -> list:
    out = []
    for i in range(len(pal)):
        for j in range(i + 1, len(pal)):
            de = delta_e76(pal[i], pal[j])
            if de < DELTA_E_TOL:
                out.append({"code": "P1", "severity": "warn",
                            "a": i, "b": j,
                            "a_char": pal_char(i), "b_char": pal_char(j),
                            "a_hex": pal[i], "b_hex": pal[j],
                            "delta_e": round(de, 2),
                            "detail": "PAL[%d] %s ('%s') and PAL[%d] %s ('%s') "
                                      "are deltaE %.2f apart"
                                      % (i, pal[i], pal_char(i),
                                         j, pal[j], pal_char(j), de)})
    out.sort(key=lambda f: f["delta_e"])
    return out


def value_clusters(pal: list) -> list:
    """Maximal runs of 3+ entries whose luminance span is <= LUM_CLUSTER_TOL."""
    lums = sorted(((relative_luminance(c), i) for i, c in enumerate(pal)))
    clusters = []
    i = 0
    n = len(lums)
    while i < n:
        j = i
        while j + 1 < n and lums[j + 1][0] - lums[i][0] <= LUM_CLUSTER_TOL:
            j += 1
        if j - i + 1 >= LUM_CLUSTER_MIN:
            members = lums[i:j + 1]
            clusters.append({
                "code": "P2", "severity": "warn",
                "indices": [m[1] for m in members],
                "span": round(members[-1][0] - members[0][0], 4),
                "detail": "%d colours inside %.4f luminance: %s"
                          % (len(members), members[-1][0] - members[0][0],
                             ", ".join("PAL[%d] %s ('%s') L=%.3f"
                                       % (idx, pal[idx], pal_char(idx), lum)
                                       for lum, idx in members))})
            i = j + 1
        else:
            i += 1
    return clusters


def contrast_findings(art: dict, pal: list) -> list:
    out = []
    for name in sorted(art):
        census = sprite_colour_census(art[name])
        if not census:
            continue
        dom_idx, dom_px = census.most_common(1)[0]
        dom = pal[dom_idx] if dom_idx < len(pal) else "#ff00ff"
        c0 = contrast_ratio(dom, pal[0])
        c1 = contrast_ratio(dom, pal[1])
        worst = min(c0, c1)

        # A dark outline is *meant* to be dark, so the dominant-colour test on
        # its own over-reports outlined sprites.  best_ratio asks the harder
        # question: does ANY colour in this sprite clear 3:1 on the void?  If
        # not, nothing in the sprite separates from the background at all.
        best = max(min(contrast_ratio(pal[i], pal[0]),
                       contrast_ratio(pal[i], pal[1]))
                   for i in census if i < len(pal))
        best_idx = max((i for i in census if i < len(pal)),
                       key=lambda i: min(contrast_ratio(pal[i], pal[0]),
                                         contrast_ratio(pal[i], pal[1])))
        if best < CONTRAST_FLOOR:
            out.append({"code": "P4", "severity": "warn", "sprite": name,
                        "store": art[name]["store"], "game": game_of(name),
                        "is_background": (is_tile(base_name(name))
                                          or base_name(name).startswith("prop_")),
                        "best_ratio": round(best, 2),
                        "best_hex": pal[best_idx],
                        "best_index": best_idx,
                        "vs_pal0": round(c0, 2), "vs_pal1": round(c1, 2),
                        "detail": "best colour in the sprite is PAL[%d] %s "
                                  "('%s') at only %.2f:1 on the void -- every "
                                  "colour it uses is under 3:1"
                                  % (best_idx, pal[best_idx],
                                     pal_char(best_idx), best)})
        if worst < CONTRAST_FLOOR:
            out.append({"code": "P3", "severity": "warn", "sprite": name,
                        "store": art[name]["store"], "game": game_of(name),
                        # tiles and props are drawn *on* the ground, not over
                        # the void, so their low contrast is not a real risk
                        "is_background": (is_tile(base_name(name))
                                         or base_name(name).startswith("prop_")),
                        "dominant": dom, "dominant_index": dom_idx,
                        "dominant_char": pal_char(dom_idx),
                        "dominant_share": round(
                            100.0 * dom_px / sum(census.values()), 1),
                        "vs_pal0": round(c0, 2), "vs_pal1": round(c1, 2),
                        "best_ratio": round(best, 2),
                        "detail": "dominant colour PAL[%d] %s ('%s', %.0f%% of "
                                  "opaque px) is %.2f:1 on PAL[0] %s and "
                                  "%.2f:1 on PAL[1] %s"
                                  % (dom_idx, dom, pal_char(dom_idx),
                                     100.0 * dom_px / sum(census.values()),
                                     c0, pal[0], c1, pal[1])})
    out.sort(key=lambda f: (f["code"], min(f["vs_pal0"], f["vs_pal1"])))
    return out


def store_comparison(art: dict, pal: list) -> dict:
    """For every EART6 sprite that overrides an EGG_ART name of the same name,
    compare distinct colour count and luminance spread.  This answers 'did the
    16-bit pass actually improve things?'."""
    rows = []
    for name in sorted(art):
        if not name.endswith("@EART6"):
            continue
        bare = base_name(name)
        if bare not in art:
            continue
        a = sprite_colour_census(art[bare])
        b = sprite_colour_census(art[name])
        if not a or not b:
            continue

        def lum_spread(cen):
            ls = [relative_luminance(pal[i]) for i in cen if i < len(pal)]
            return max(ls) - min(ls) if ls else 0.0

        def lum_steps(cen):
            """How many distinct luminance levels, at 0.03 resolution."""
            ls = sorted(relative_luminance(pal[i]) for i in cen if i < len(pal))
            steps, last = 0, None
            for l in ls:
                if last is None or l - last > LUM_CLUSTER_TOL:
                    steps += 1
                    last = l
            return steps

        rows.append({"sprite": bare,
                     "egg_colours": len(a), "e6_colours": len(b),
                     "egg_lum_spread": round(lum_spread(a), 4),
                     "e6_lum_spread": round(lum_spread(b), 4),
                     "egg_lum_steps": lum_steps(a), "e6_lum_steps": lum_steps(b),
                     "egg_frames": len(art[bare]["frames"]),
                     "e6_frames": len(art[name]["frames"])})
    return rows


def run(repo_root: str):
    art, pal = load_all(repo_root)
    per_sprite = {}
    per_game = {}
    for name in sorted(art):
        census = sprite_colour_census(art[name])
        per_sprite[name] = {"distinct": len(census),
                            "opaque_px": sum(census.values()),
                            "indices": sorted(census),
                            "game": game_of(name),
                            "store": art[name]["store"]}
        g = per_game.setdefault(game_of(name),
                                {"sprites": 0, "counter": Counter()})
        g["sprites"] += 1
        g["counter"].update(census)
    census_by_game = {g: {"sprites": v["sprites"],
                          "distinct": len(v["counter"]),
                          "indices": sorted(v["counter"]),
                          "top": [(i, n) for i, n in v["counter"].most_common(8)]}
                      for g, v in per_game.items()}
    findings = (near_duplicates(pal) + value_clusters(pal)
                + contrast_findings(art, pal))
    return art, pal, per_sprite, census_by_game, findings, store_comparison(art, pal)


def main(argv):
    args = [a for a in argv[1:] if not a.startswith("--")]
    root = args[0] if args else repo_root_default()
    json_out = None
    for a in argv[1:]:
        if a.startswith("--json="):
            json_out = a.split("=", 1)[1]
    quiet = "--quiet" in argv

    art, pal, per_sprite, census, findings, cmp_rows = run(root)


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
    if not quiet:
        if _muted and not quiet:
            import os as _os
            print("suppressed %d finding(s) by annotation (annotations.json); SHOW_SUPPRESSED=1 to list" % len(_muted))
            if _os.environ.get("SHOW_SUPPRESSED"):
                for _f in _muted:
                    print("   [muted %s] %-26s %s" % (_f.get("code"), _f.get("sprite"), _f.get("suppressed_because", "")[:110]))
            print()
        print("PIXEL QA -- PALETTE")
        print("repo : %s" % root)
        print("PAL  : %d colours  (0..16 frozen 8-bit, 17..44 16-bit extension)"
              % len(pal))
        print()
        print("%-4s %-58s %s" % ("CODE", "CHECK", "COUNT"))
        print("-" * 80)
        for code in ("P1", "P2", "P3", "P4"):
            print("%-4s %-58s %d"
                  % (code, CODE_LABEL[code],
                     len([f for f in findings if f["code"] == code])))
        print("-" * 80)
        print()
        print("PER-GAME COLOUR CENSUS")
        for g in sorted(census):
            c = census[g]
            print("  %-26s %3d sprites  %2d distinct colours  indices %s"
                  % (g, c["sprites"], c["distinct"],
                     ",".join(str(i) for i in c["indices"])))
        print()
        print("DISTINCT COLOURS PER SPRITE (highest first)")
        for name, v in sorted(per_sprite.items(),
                              key=lambda kv: -kv[1]["distinct"])[:25]:
            print("  %-28s %2d colours  %5d opaque px  [%s]"
                  % (name, v["distinct"], v["opaque_px"], v["store"]))
        print()
        print("EART6 vs EGG_ART, same sprite name (the 16-bit pass)")
        print("  %-22s %-16s %-16s %s"
              % ("sprite", "colours e->6", "lum spread", "lum steps"))
        for r in cmp_rows:
            print("  %-22s %2d -> %-10d %.3f -> %-8.3f %d -> %d"
                  % (r["sprite"], r["egg_colours"], r["e6_colours"],
                     r["egg_lum_spread"], r["e6_lum_spread"],
                     r["egg_lum_steps"], r["e6_lum_steps"]))
        if cmp_rows:
            n = len(cmp_rows)
            print("  MEAN: colours %.1f -> %.1f   lum spread %.3f -> %.3f   "
                  "lum steps %.2f -> %.2f"
                  % (sum(r["egg_colours"] for r in cmp_rows) / n,
                     sum(r["e6_colours"] for r in cmp_rows) / n,
                     sum(r["egg_lum_spread"] for r in cmp_rows) / n,
                     sum(r["e6_lum_spread"] for r in cmp_rows) / n,
                     sum(r["egg_lum_steps"] for r in cmp_rows) / n,
                     sum(r["e6_lum_steps"] for r in cmp_rows) / n))
        print()
        for f in findings:
            print("[%s] %s%s"
                  % (f["code"],
                     (f["sprite"] + "  ") if "sprite" in f else "",
                     f["detail"]))

    if json_out:
        with open(json_out, "w", encoding="utf-8") as fh:
            json.dump({"findings": findings, "labels": CODE_LABEL,
                       "per_sprite": per_sprite, "census_by_game": census,
                       "store_comparison": cmp_rows, "pal": pal}, fh, indent=1)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
