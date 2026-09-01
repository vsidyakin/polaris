#!/usr/bin/env python3
"""Mars: Signal Siege — build production sprite atlases from the art masters.

Input:  Game art files/Mars Signal Siege/{source-local,source-cdn}
Output: public/eggs/mars-signal-siege/art/*.png + atlases.json

This is a build tool, not a test. `scripts/check-mars-sprite-atlases.py` grades
what this produces.

Why it exists
-------------
The masters are high-resolution painterly renders on inconsistent canvases: the
enemy sheets are 1536x1024 cut 3x3, which is 341.33px per row, so every row
after the first samples a slice of its neighbour. The projectile sheet has
subjects running off the left and right cell walls. Nothing downstream can fix
that at draw time — it has to be re-cut at source.

So each cell is:

  1. cut by connected component rather than on the grid, because the grid is a
     claim about the artwork and on the enemy sheets it is a false one,
  2. un-matted — the masters were composited over white before the alpha was
     cut, which leaves a pale rim that reads as a halo in game,
  3. trimmed to its true opaque bounds,
  4. resampled to the game's native pixel grid by ONE scale per actor — see
     below — because the game renders at 640x360 and drawing a 512px cell into
     a 68px enemy is what makes the art mush,
  5. re-seated on a fixed baseline and pivot so a run cycle does not wobble,
  6. re-placed in a uniform cell with a guaranteed transparent gutter, so no
     opaque pixel can ever touch a cell wall.

The result is genuine 1x pixel art: Phaser integer-scales the whole canvas with
nearest-neighbour, which is what makes it read as late-SNES rather than as a
smooth render that has been shrunk.

One scale per actor, never one per frame
----------------------------------------
Steps 3-4 used to run per cell: each cell's own trimmed bounding box was
normalised to a target height. That is wrong, and players reported it as "the
main character sprite changes when he jumps, size increases, colors slightly
change too". A bounding box is not a character. It contains the weapon, so
holding Up shrank Rook by 18% to make room for the raised rifle; it shrinks when
a pose tucks, so a single stride pulsed him 16.8%; and it is measured on a
different master for every family, so the aim poses came out 41% apart from each
other.

Every actor now gets ONE scale, derived once from the family's own artwork and
applied to every frame of it. The drawn height of a frame is then free to vary,
because that is the animation: a running figure IS lower at mid-stride, a
centipede IS taller when it rears. What must not vary is the size of the
creature, and that is what a shared scale fixes.

The three measurements that make that possible, one per actor kind:

  Rook     the visor. It is the only feature that is literally the same object
           in all four of his master families, so the top of his helmet can be
           located even in a pose where the rifle is the highest thing in the
           silhouette.
  enemies  the idle cell of the role. Move and attack then keep whatever height
           the artist drew them at.
  bosses   the idle cell, capped by the widest pose so nothing has to be
           clamped against a cell wall later.
"""

from __future__ import annotations

import json
import os
import sys

try:
    from PIL import Image, ImageChops, ImageFilter
except ImportError:
    print("build-mars-art: Pillow is required (pip install Pillow)")
    sys.exit(2)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC_LOCAL = os.path.join(ROOT, "Game art files", "Mars Signal Siege", "source-local")
SRC_CDN = os.path.join(ROOT, "Game art files", "Mars Signal Siege", "source-cdn")
OUT = os.path.join(ROOT, "public", "eggs", "mars-signal-siege", "art")

SOLID = 24          # alpha at or above this counts as subject
GUTTER = 3          # guaranteed transparent margin inside every cell

# Rook's standing height in game pixels, measured helmet-crown to boot, NOT
# including the rifle. 70 rather than the old 74 because the aim-up-in-air
# master carries 107 master pixels of rifle above the crown: at 74 the whole
# silhouette needs 92px and the cell only has 90 clear of the gutter, so that
# one pose would have had to be shrunk to fit and the parity this exists to
# guarantee would have been broken by the very frame that motivated it.
ROOK_FIGURE_H = 70
# Prone is a lying pose, so it is sized by length, not by standing height.
# Matching it to Rook's head would need 130px of cell width and the cell is 96;
# 86 keeps the boots-to-muzzle run a little longer than he is tall, which is
# what a man flat on his front with a rifle out in front of him measures.
ROOK_PRONE_LEN = 86
# Palette size for the player sheet. Enough for the armour, under-suit, steel
# and light ramps to keep their value steps — the failure mode of a small
# palette is not a wrong hue, it is two steps of a ramp collapsing into one flat
# shape — and small enough that the sheet reads as drawn rather than rendered.
ROOK_COLOURS = 64
# Crown offset: the helmet top sits this many visor-heights above the visor.
# Measured across the run, key and prone masters, where the crown IS the top of
# the silhouette, and stable there at 0.87-1.11.
VISOR_TO_CROWN = 0.93

# The six environment families, and the master each one is painted in. Shared
# by the backdrop and the terrain builders so a family cannot end up with a
# backdrop and no ground cut from the same picture.
def mean_luma(im):
    """Mean Rec.601 luminance of an image, sampled on a coarse grid."""
    small = im.resize((64, 36), Image.LANCZOS)
    px = small.load()
    total = 0.0
    for y in range(36):
        for x in range(64):
            r, g, b = px[x, y][:3]
            total += 0.299 * r + 0.587 * g + 0.114 * b
    return total / (64 * 36)


BACKGROUNDS = [
    ("dustline", "Mars_Background_Dustline_v0.7.png"),
    ("uplink", "Mars_Toxic_Uplink_Background_v0.7.png"),
    ("icevault", "Mars_Background_IceVault_v0.7.png"),
    ("hivecity", "Mars_Background_HiveCity_v0.7.png"),
    ("catacombs", "Mars_Background_Catacombs_v0.7.png"),
    ("foundry", "Mars_Background_FoundryCore_v0.7.png"),
]


# ---------------------------------------------------------------- primitives

def load(path):
    return Image.open(path).convert("RGBA")


def unmatte(im: Image.Image) -> Image.Image:
    """Undo a composite over white.

    The masters were flattened onto white and then had their alpha cut, so
    partially-transparent rim pixels carry white that does not belong to the
    subject. Recovering F from C = a*F + (1-a)*255 removes the halo instead of
    eroding the sprite, which is what a simple alpha-threshold would do.
    """
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0 or a == 255:
                continue
            f = a / 255.0
            nr = min(255, max(0, int((r - (1 - f) * 255) / f)))
            ng = min(255, max(0, int((g - (1 - f) * 255) / f)))
            nb = min(255, max(0, int((b - (1 - f) * 255) / f)))
            px[x, y] = (nr, ng, nb, a)
    return im


def harden_alpha(im: Image.Image, lo=40, hi=176) -> Image.Image:
    """Push alpha to a clean 0/255 with a short ramp.

    Pixel art wants a hard edge. Leaving a long alpha ramp is what makes a
    sprite look like a sticker with a glow, and it is also why several masters
    never reach alpha 255 anywhere — the whole subject is slightly see-through
    and the background ghosts up through the character.
    """
    a = im.split()[-1]
    a = a.point(lambda v: 0 if v < lo else (255 if v > hi else int((v - lo) * 255 / (hi - lo))))
    im.putalpha(a)
    return im


def solid_mask(im: Image.Image) -> Image.Image:
    return im.split()[-1].point(lambda v: 255 if v >= SOLID else 0)


def solid_bbox(im: Image.Image):
    return solid_mask(im).getbbox()


def blobs(mask, min_size: int = 1):
    """Connected opaque regions, largest first.

    Each entry carries its own pixels, bbox and centroid. The centroid is what
    lets a subject be assigned to the cell it belongs to even when its helmet
    crosses the cut line into the cell above (Defect B).
    """
    w, h = mask.size
    px = mask.load()
    seen = bytearray(w * h)
    out = []
    for sy in range(h):
        for sx in range(w):
            if not px[sx, sy] or seen[sy * w + sx]:
                continue
            stack = [(sx, sy)]
            seen[sy * w + sx] = 1
            pts = []
            sum_x = sum_y = 0
            x0 = x1 = sx
            y0 = y1 = sy
            while stack:
                cx, cy = stack.pop()
                pts.append((cx, cy))
                sum_x += cx
                sum_y += cy
                if cx < x0: x0 = cx
                if cx > x1: x1 = cx
                if cy < y0: y0 = cy
                if cy > y1: y1 = cy
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nx, ny = cx + dx, cy + dy
                    if 0 <= nx < w and 0 <= ny < h and px[nx, ny] and not seen[ny * w + nx]:
                        seen[ny * w + nx] = 1
                        stack.append((nx, ny))
            n = len(pts)
            if n >= min_size:
                out.append({"n": n, "bbox": (x0, y0, x1, y1), "px": pts,
                            "cx": sum_x / n, "cy": sum_y / n})
    out.sort(key=lambda c: -c["n"])
    return out


def bbox_near(a, b, pad: int) -> bool:
    """Do two bounding boxes come within `pad` pixels of each other?"""
    ax0, ay0, ax1, ay1 = a
    bx0, by0, bx1, by1 = b
    return not (ax0 - pad > bx1 or bx0 - pad > ax1 or
                ay0 - pad > by1 or by0 - pad > ay1)


def despeckle(im: Image.Image, ratio=0.04, absolute=220, near=2,
              floor_band=0.20, foot_gap=6) -> Image.Image:
    """Drop small islands that are not part of the subject.

    Several masters carry a detached crumb a few pixels from the body — a
    fragment of a neighbouring cell that survived the original cut. Rook's idle
    pose has one beside his shoulder, and in game it reads as a floating white
    speck that follows the character around.

    Size alone is not enough to identify one, and trusting it amputated feet
    (Defect C). Resampling with LANCZOS and re-hardening the alpha pinches thin
    ankles until they part from the leg, and the pass that ran after it then
    deleted them as debris: c_trooper lost 32px and 14px of drawn height,
    d_trooper 62px, and every hound and drone in the roster lost a foot. Every
    single component it removed was at the bottom of the sprite, which is the
    tell — debris from a neighbouring cell has no reason to prefer the floor.

    So a component is only debris if it is small AND clear of the silhouette AND
    not standing under the body in the ground band. Anything touching the body
    is anatomy; anything underfoot is a foot. "Underfoot" has to mean directly
    below and close: three boss frames were keeping a two-pixel crumb that sat
    34px clear of the creature purely because it was low in the cell, and it was
    low enough that seat() then put THAT on the ground line and left the boss
    floating above it.

    `floor_band` is 0 for anything seated by its centre: a bolt has no feet, so
    there is nothing at its bottom edge that needs protecting from a rule that
    exists to protect feet.
    """
    bs = blobs(solid_mask(im))
    if len(bs) < 2:
        return im
    main = bs[0]
    mx0, my0, mx1, my1 = main["bbox"]
    floor_top = my1 - (my1 - my0 + 1) * floor_band
    px = im.load()
    for b in bs[1:]:
        if b["n"] > absolute or b["n"] >= main["n"] * ratio:
            continue
        if bbox_near(b["bbox"], main["bbox"], near):
            continue
        bx0, by0, bx1, by1 = b["bbox"]
        if (floor_band and by1 >= floor_top and by0 - my1 <= foot_gap
                and bx1 >= mx0 - near and bx0 <= mx1 + near):
            continue
        for x, y in b["px"]:
            px[x, y] = (0, 0, 0, 0)
    return im


def visor_bbox(im: Image.Image):
    """Bounds of the largest cyan mass: Rook's visor.

    The one landmark that survives every pose and every master. Rook's four
    families were rendered at four different resolutions AND four different
    figure proportions, so nothing derived from the silhouette compares across
    them: the widest horizontal run is his shoulders in one pose and his rifle
    in another, and total area moves with how much of him is hidden behind
    himself. A visor is a visor.
    """
    hsv = im.convert("RGB").convert("HSV")
    hue, sat, val = hsv.split()
    m = ImageChops.multiply(
        hue.point(lambda v: 255 if 107 <= v <= 153 else 0),
        sat.point(lambda v: 255 if v >= 89 else 0))
    m = ImageChops.multiply(m, val.point(lambda v: 255 if v >= 89 else 0))
    m = ImageChops.multiply(m, im.split()[-1].point(lambda v: 255 if v >= 128 else 0))
    found = blobs(m, min_size=6)
    return found[0]["bbox"] if found else None


def figure_height(im: Image.Image):
    """Boot to helmet crown, ignoring a weapon carried above the head.

    This is the number a player reads as "how big is he", and the number the old
    build never measured. It normalised the bounding box instead, so the 20px of
    rifle in the aim-up master came out of Rook's body: holding Up shrank him by
    18%, which is a control input changing the size of the character.
    """
    bb = solid_bbox(im)
    if bb is None:
        return None
    ground = bb[3] - 1
    vb = visor_bbox(im)
    if vb is None:
        return ground - bb[1] + 1
    crown = max(bb[1], vb[1] - VISOR_TO_CROWN * (vb[3] - vb[1] + 1))
    return ground - crown + 1


# --- colour -----------------------------------------------------------------
#
# Rook's three master families were graded by three different hands. The armour
# hue is effectively constant across them (5-9 degrees) but nothing else is:
#
#   rkey_*, rprone_*   idle, idlefire, clear, prone   (128,69,62)  S .51 V .50
#   Mars_Rook_RunFire  run, runfire                   (142,59,47)  S .67 V .56
#   Rook_Aim_*         jump, fall, aimup, ...         (160,53,34)  S .79 V .63
#
# So stopping desaturated Rook by 24% and darkened him by 11% — "actually, the
# color changes when he stops" — and jumping saturated him by 55%. Same fix as
# the size half of the defect: measure the family, correct the family.

WARM_HUE = 0.02      # armour orange
COOL_HUE = 0.58      # under-suit navy and the visor


def _hue_weight(h: float) -> float:
    """1 for armour, 0 for under-suit, smooth in between.

    A hard hue cutoff bands the mid-tones where the two masses meet, which on a
    downsampled render is most of the rim.
    """
    dw = min(abs(h - WARM_HUE), 1 - abs(h - WARM_HUE))
    dc = min(abs(h - COOL_HUE), 1 - abs(h - COOL_HUE))
    return dc / max(1e-6, dw + dc)


def mass_stats(cells):
    """Mean saturation and value of the warm and cool masses of a family.

    Returns the sample sizes too: a pose that hides most of its armour behind
    its own arm is a poor thing to normalise a whole family on.
    """
    import colorsys
    warm_s = warm_v = cool_s = cool_v = 0.0
    warm_n = cool_n = 0
    for im in cells:
        if im is None:
            continue
        px = im.load()
        w, h = im.size
        for y in range(h):
            for x in range(w):
                r, g, b, a = px[x, y]
                if a < 200:
                    continue
                hh, ss, vv = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
                if vv < 0.10:
                    continue
                if (hh < 0.09 or hh > 0.93) and ss > 0.25:
                    warm_s += ss; warm_v += vv; warm_n += 1
                elif 0.45 < hh < 0.75 and ss > 0.15:
                    cool_s += ss; cool_v += vv; cool_n += 1
    return {
        "warm": (warm_s / warm_n, warm_v / warm_n) if warm_n else None,
        "cool": (cool_s / cool_n, cool_v / cool_n) if cool_n else None,
        "warm_n": warm_n,
        "cool_n": cool_n,
    }


def regrade(im: Image.Image, gains):
    """Pull one family's saturation and value onto the reference family's.

    Multiplicative rather than additive so the ramp keeps its order and its
    relative steps: the art is still the artist's, only its exposure is common.
    """
    import colorsys
    (sw, vw), (sc, vc) = gains
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            hh, ss, vv = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            k = _hue_weight(hh)
            ss = min(1.0, ss * (k * sw + (1 - k) * sc))
            vv = min(1.0, vv * (k * vw + (1 - k) * vc))
            nr, ng, nb = colorsys.hsv_to_rgb(hh, ss, vv)
            px[x, y] = (round(nr * 255), round(ng * 255), round(nb * 255), a)
    return im


# A grading correction is an exposure fix, not a repaint. Past this much the
# input was not the same character under the same light and the honest answer is
# to re-render the master, not to crank it.
GAIN_LIMIT = (0.65, 1.55)
# Below this many pixels a mass is not a reliable measurement of anything.
MASS_FLOOR = 300


def gains_for(stats, target, fallback=None):
    """Per-mass (saturation, value) multipliers taking `stats` onto `target`."""
    def pair(key):
        a, b = stats.get(key), target.get(key)
        if not a or not b or stats.get(f"{key}_n", 0) < MASS_FLOOR:
            return fallback[0 if key == "warm" else 1] if fallback else (1.0, 1.0)
        lo, hi = GAIN_LIMIT
        return (min(hi, max(lo, b[0] / max(1e-6, a[0]))),
                min(hi, max(lo, b[1] / max(1e-6, a[1]))))
    return (pair("warm"), pair("cool"))


def _median_cut(samples, n):
    """The n best colours for a bag of samples, as RGB triples."""
    strip = Image.new("RGB", (max(1, len(samples)), 1))
    strip.putdata(samples or [(0, 0, 0)])
    p = strip.quantize(colors=n, method=Image.Quantize.MEDIANCUT,
                       dither=Image.Dither.NONE)
    return [c for _, c in (p.convert("RGB").getcolors(1 << 16) or [])]


def quantise(im: Image.Image, colours: int, accents: int = 12) -> Image.Image:
    """Collapse a finished actor sheet onto one shared indexed palette.

    Rook carried 1081-2273 unique colours per frame: a painterly render that had
    been shrunk, not pixel art. One palette for the whole sheet is also the
    cheapest possible guarantee that two poses cannot drift apart again — after
    this there is exactly one orange for Rook's armour, and every frame uses it.

    Two things had to be got right, and the first attempt got neither.

    Frequency. Entering every pixel once gave a palette that was almost all
    armour and shadow — a dozen entries separating one near-black from another.
    Each distinct colour is now entered by the square root of how often it
    occurs, so the big masses still buy more of the ramp than the small ones
    without buying all of it.

    Accents. Rook's lit cyan — visor, gun strips, chest lamps — is a few hundred
    pixels on a sheet of tens of thousands, so median cut merged it into the
    greens and his visor came out mint. That is not a colour error, it is the
    helmet ceasing to read as a helmet. The lit accents therefore get their own
    slice of the palette, chosen against each other rather than against the
    armour they will never be confused with.
    """
    import colorsys
    alpha = im.split()[-1]
    rgb = im.convert("RGB")
    ap = alpha.load()
    px = rgb.load()
    w, h = rgb.size
    counts = {}
    for y in range(h):
        for x in range(w):
            if ap[x, y] >= SOLID:
                c = px[x, y]
                counts[c] = counts.get(c, 0) + 1
    if not counts:
        return im
    body, accent = [], []
    for c, n in counts.items():
        weight = [c] * max(1, round(n ** 0.5))
        hh, ss, vv = colorsys.rgb_to_hsv(c[0] / 255, c[1] / 255, c[2] / 255)
        (accent if (0.30 <= hh <= 0.70 and ss >= 0.5 and vv >= 0.5)
         else body).extend(weight)
    pal = _median_cut(body, colours - accents)
    if accent:
        pal += _median_cut(accent, accents)
    pal = pal[:colours]
    flat = [v for c in pal for v in c]
    flat += flat[-3:] * (256 - len(pal))
    holder = Image.new("P", (1, 1))
    holder.putpalette(flat)
    out = rgb.quantize(palette=holder, dither=Image.Dither.NONE).convert("RGB")
    out.putalpha(alpha)
    return out


def cut(im: Image.Image, cols: int, rows: int, col: int, row: int) -> Image.Image:
    """Cut a cell on exact float boundaries."""
    w, h = im.size
    cw, ch = w / cols, h / rows
    return im.crop((round(col * cw), round(row * ch), round((col + 1) * cw), round((row + 1) * ch)))


# How much of a subject may sit outside the cell its centroid lands in before
# the assignment is a coin flip and the build has to stop.
CUT_AMBIGUOUS = 0.25
# A part this close to the subject, or this large a share of it, belongs to it
# however the grid falls. Everything else in the crop window is a neighbour.
CUT_KEEP_NEAR = 20
CUT_KEEP_SHARE = 0.20


def cut_subjects(master: Image.Image, cols: int, rows: int, label: str):
    """Cut a group sheet by connected component, not on the nominal grid.

    Defect B. `cut()` is arithmetically exact and it was still slicing through
    the artwork, because the artwork is not on the grid: ink crosses the row
    boundary in ten of the twelve boundary positions on the four enemy sheets.
    Trooper helmets lost 22-31 master pixels, walker and spider antennae 42-53,
    and one subject lost 286.

    Worse than the truncation was what came the other way. The neighbour's feet
    landed at the BOTTOM of the cell below, so eight frames of enemies.png each
    carried 22-118 stray pixels sitting exactly on the ground line. The real
    creature then floated 9-14px above its own baseline, and the crumb inflated
    the bounding box the scale was derived from, so it was drawn well under its
    role height as well. One misplaced crumb produced three separate defects.

    The grid cannot be trusted, but the ink can: a subject is a connected mass,
    and the cell it belongs to is the one its centre of mass falls in. Cropping
    to that mass's own bounds gets the whole helmet and none of the neighbour.
    """
    mask = solid_mask(master)
    found = blobs(mask, min_size=4)
    w, h = master.size
    cw, ch = w / cols, h / rows
    assigned = {}
    for b in found:
        col = min(cols - 1, int(b["cx"] // cw))
        row = min(rows - 1, int(b["cy"] // ch))
        assigned.setdefault((col, row), []).append(b)

    out = {}
    for row in range(rows):
        for col in range(cols):
            group = assigned.get((col, row))
            if not group:
                raise SystemExit(
                    f"build-mars-art: MASTER_CUT_CROSSING — {label} cell "
                    f"c{col}r{row} contains no subject; the sheet is not the "
                    f"{cols}x{rows} grid the build declares")
            main = group[0]
            nx0, ny0 = round(col * cw), round(row * ch)
            nx1, ny1 = round((col + 1) * cw), round((row + 1) * ch)
            outside = sum(1 for x, y in main["px"]
                          if not (nx0 <= x < nx1 and ny0 <= y < ny1))
            if outside > main["n"] * CUT_AMBIGUOUS:
                raise SystemExit(
                    f"build-mars-art: MASTER_CUT_CROSSING — {label} cell "
                    f"c{col}r{row}: {100*outside/main['n']:.0f}% of the subject "
                    f"lies outside its own cell, so which cell owns it is a "
                    f"coin flip. Re-author the master on its grid.")
            keep = [b for b in group
                    if b is main
                    or b["n"] >= main["n"] * CUT_KEEP_SHARE
                    or bbox_near(b["bbox"], main["bbox"], CUT_KEEP_NEAR)]
            x0 = min(b["bbox"][0] for b in keep)
            y0 = min(b["bbox"][1] for b in keep)
            x1 = max(b["bbox"][2] for b in keep)
            y1 = max(b["bbox"][3] for b in keep)
            sub = master.crop((x0, y0, x1 + 1, y1 + 1))
            # Anything in the crop window that is not this subject is the
            # neighbour leaning in, so it is erased rather than carried along.
            keep_ids = {id(b) for b in keep}
            px = sub.load()
            for b in found:
                if id(b) in keep_ids:
                    continue
                if not bbox_near(b["bbox"], (x0, y0, x1, y1), 0):
                    continue
                for x, y in b["px"]:
                    if x0 <= x <= x1 and y0 <= y <= y1:
                        px[x - x0, y - y0] = (0, 0, 0, 0)
            out[(col, row)] = sub
    return out


CLAMPED = []       # cells fit_in_cell had to rescue, reported at the end


def fit_in_cell(sprite: Image.Image, cell_w: int, cell_h: int,
                label: str = "?") -> Image.Image:
    """Last-resort rescue for a sprite that cannot clear the gutter.

    This used to be routine, and that was Defect E: boss5's arms span more than
    the cell, so every one of its poses was clamped to the 186px usable width
    and its height fell out of whatever aspect ratio that pose happened to have
    — idle 102, walk-a 112, walk-b 117, wind 118, fire 117. A 15% swing inside
    one boss, and it never reached its 126px hitbox either.

    Scaling to the tighter axis per frame IS a per-frame scale, which is the
    defect this file now exists to prevent. Every builder therefore chooses a
    group scale that already fits, and reaching this function means a master
    changed shape — so it is loud rather than silent. `label=None` marks the
    two places where it is deliberate: an impact burst is GROWN from its bolt
    and is meant to fill its cell.
    """
    max_w, max_h = cell_w - 2 * GUTTER, cell_h - 2 * GUTTER
    sw, sh = sprite.size
    if sw <= max_w and sh <= max_h:
        return sprite
    k = min(max_w / sw, max_h / sh)
    if label is not None:
        CLAMPED.append(f"{label}: {sw}x{sh} into {max_w}x{max_h} (x{k:.3f})")
    return harden_alpha(
        sprite.resize((max(1, int(sw * k)), max(1, int(sh * k))), Image.LANCZOS),
        lo=48, hi=168,
    )


def baseline_of(cell_h: int) -> int:
    """The row every ground-anchored sprite's lowest opaque pixel sits on.

    Defect F: seat() has always placed that pixel at `cell_h - GUTTER - 1`,
    because the gutter is a count of clear rows and the last of them is
    `cell_h - 1`. emit() declared `cell_h - GUTTER`, one row lower — so the game
    anchored every actor to a line one pixel under its own feet and everything
    in the build floated. One function now answers the question for both.
    """
    return cell_h - GUTTER - 1


def seat(sprite: Image.Image, cell_w: int, cell_h: int, pivot_x: float = 0.5,
         anchor: str = "ground", label: str = "?") -> Image.Image:
    """Place a trimmed sprite in a uniform cell.

    `ground` seats the sprite's lowest row on a fixed baseline, which is what
    keeps feet out of the floor across a walk cycle. `center` centres it on
    both axes, which is what a projectile or a burst wants — those have no
    ground contact and forcing one on them drags the bolt off its own flight
    line.

    Horizontal placement is by `pivot_x` (a fraction of the sprite's own width)
    mapped to the cell centre, so a character whose gun juts forward does not
    drag the whole body off-centre the way bbox-centring does.
    """
    sprite = fit_in_cell(sprite, cell_w, cell_h, label)
    canvas = Image.new("RGBA", (cell_w, cell_h), (0, 0, 0, 0))
    sw, sh = sprite.size
    x = round(cell_w / 2 - sw * pivot_x)
    y = (baseline_of(cell_h) + 1 - sh) if anchor == "ground" \
        else round((cell_h - sh) / 2)
    x = max(GUTTER, min(cell_w - GUTTER - sw, x))
    y = max(GUTTER, min(cell_h - GUTTER - sh, y))
    canvas.alpha_composite(sprite, (x, y))
    return canvas


def clean(cell: Image.Image):
    """Un-matte, harden, despeckle and trim one master cell.

    Split out of the old prepare() so a builder can measure every cell of a
    family before it decides what scale to draw them all at. Deciding per cell
    is Defect A, D and E; it cannot be decided per cell if the cells are
    resampled the moment they are read.
    """
    cell = unmatte(cell)
    cell = harden_alpha(cell)
    cell = despeckle(cell)
    bb = solid_bbox(cell)
    if bb is None:
        return None
    return cell.crop(bb)


def place(sub: Image.Image, scale: float, cell_w: int, cell_h: int, pivot_x=0.5,
          anchor="ground", label="?"):
    """Resample a cleaned subject by an EXPLICIT scale and seat it.

    The scale is an argument rather than something derived from this cell,
    which is the whole point: the caller worked it out once for the actor.
    """
    w, h = sub.size
    nw, nh = max(1, round(w * scale)), max(1, round(h * scale))
    out = sub.resize((nw, nh), Image.LANCZOS)
    if scale < 0.5:
        out = out.filter(ImageFilter.UnsharpMask(radius=1.0, percent=55, threshold=2))
    out = harden_alpha(out, lo=48, hi=168)
    # A crumb that was 300px on a 512px master is a dozen pixels once it reaches
    # the game's grid — under the absolute threshold on the way in, over it on
    # the way out. Safe to repeat now that despeckle() is geometric and cannot
    # take a foot off (Defect C).
    out = despeckle(out, floor_band=0.20 if anchor == "ground" else 0.0)
    bb = solid_bbox(out)
    if bb is None:
        return None, None
    out = out.crop(bb)
    return seat(out, cell_w, cell_h, pivot_x, anchor, label), out.size


def prepare(cell: Image.Image, target_h: int, cell_w: int, cell_h: int, pivot_x=0.5,
            anchor="ground", label="?"):
    """clean + place for a subject that IS its own family.

    Only projectiles and effects use this now: a bolt has one frame, so a
    per-cell scale and a per-family scale are the same number. Everything with
    an animation gets its scale from its family instead.
    """
    sub = clean(cell)
    if sub is None:
        return None, None
    return place(sub, target_h / sub.size[1], cell_w, cell_h, pivot_x, anchor, label)


def sheet(cells, cols, cell_w, cell_h):
    rows = (len(cells) + cols - 1) // cols
    out = Image.new("RGBA", (cols * cell_w, rows * cell_h), (0, 0, 0, 0))
    for i, c in enumerate(cells):
        if c is None:
            continue
        out.alpha_composite(c, ((i % cols) * cell_w, (i // cols) * cell_h))
    return out, rows


# ---------------------------------------------------------------- builders

MANIFEST = {"sheets": [], "suppress": []}


# Which way each sheet's artwork is drawn facing, before any flip.
#
# This is NOT uniform, which is the whole reason it is written down. The four
# painterly group sheets and the boss sheet are all drawn facing LEFT; Rook is
# drawn facing RIGHT; and the types authored here in Aseprite were drawn facing
# RIGHT because that is the direction they were designed against. A single
# global rule is therefore wrong for somebody no matter which way it points,
# and it has now been wrong in both directions in turn — once leaving every
# ground enemy moonwalking, and once leaving them all running backwards.
#
# The game reads this from the manifest rather than hard-coding a comparison,
# so the answer lives with the art it describes.
FACES_RIGHT = {
    "rook/rook.png": True,
    "enemies/enemies.png": False,
    "enemies/new-enemies.png": True,
    "bosses/bosses.png": False,
}


def emit(name, image, cols, rows, cell_w, cell_h, tags, live, meta=None):
    path = os.path.join(OUT, name)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    image.save(path, optimize=True)
    entry = {
        "file": name,
        "cols": cols,
        "rows": rows,
        "cellW": cell_w,
        "cellH": cell_h,
        # Where the feet sit inside the cell, and the column the body is
        # centred on. This is the row seat() actually puts the lowest opaque
        # pixel on — see baseline_of() for why it used to be one lower.
        "baseline": baseline_of(cell_h),
        "pivotX": cell_w // 2,
        "tags": tags,
        "live_frames": live,
    }
    if name in FACES_RIGHT:
        entry["facesRight"] = FACES_RIGHT[name]
    if meta:
        entry.update(meta)
    MANIFEST["sheets"].append(entry)
    kb = os.path.getsize(path) / 1024
    print(f"  {name:34s} {image.size[0]:4d}x{image.size[1]:<4d} "
          f"{cols}x{rows} cell {cell_w}x{cell_h}  {kb:7.1f} KB")


def build_rook():
    """Rook: an 8-pose run cycle, an 8-pose run-and-fire cycle, and key poses.

    The run atlases are the one part of the masters whose geometry was already
    right — 192px cells, ground line steady at 177/178 across all eight frames.
    So the cycle is kept intact and only re-seated; the prototype threw two of
    the eight frames away (it sampled [0,2,3,4,6,7]) and that is what made the
    run read as a six-step shuffle with a hitch. All eight ship here.

    Rook is cut from four masters that agree about almost nothing. They are at
    four resolutions (his visor measures 17, 12, 39 and 8 master pixels), drawn
    at two different sets of proportions, and graded three different ways. The
    old build hid none of that: it normalised every cell's bounding box to 74px
    and shipped the rest. So the run cycle pulsed 16.8% inside a single stride,
    the six aim masters landed 41% apart, and holding Up made him 18% smaller.

    Four families, four scales, measured once each and never per frame:

      run     eight strides from one atlas    reference for size AND for colour
      key     rkey_3 idle, rkey_2 idlefire
      aim     six masters, five tags
      prone   two masters, sized by length rather than by height

    The run cycle is the reference because it is the animation a player watches
    for most of the game; matching everything else to it means the pose they see
    most is also the pose that never changed.
    """
    CW, CH = 96, 96
    cells, tags, live = [], {}, []
    # Which family each cell came from, and the one scale that family agreed on.
    # Both go in the manifest: a scale that differs between two frames of one
    # actor IS the defect, and a number in the manifest is how the checker sees
    # it without having to re-derive the whole pipeline.
    fam_of, scale_of, size_of = [], [], []

    def family(name, imgs, mode="figure", target=ROOK_FIGURE_H, pivot_x=0.52):
        """Measure a whole master family, fix one scale, place all of it.

        `figure` sizes by boot-to-crown, so the man is the same man in every
        pose. `length` sizes by width, for prone, which has no standing height
        to be matched on.
        """
        subs = [clean(im) for im in imgs]
        if any(s is None for s in subs):
            raise SystemExit(
                f"build-mars-art: rook family '{name}' has an empty master")
        ref = (max(figure_height(s) for s in subs) if mode == "figure"
               else max(s.size[0] for s in subs))
        scale = target / ref
        # A family that cannot fit the cell at parity would be quietly shrunk
        # one frame at a time by fit_in_cell, which is exactly the per-frame
        # scaling this exists to kill. Shrink the family together, and say so.
        room = min(min((CW - 2 * GUTTER) / s.size[0], (CH - 2 * GUTTER) / s.size[1])
                   for s in subs)
        if scale > room:
            print(f"    ! rook family '{name}' capped by the cell: "
                  f"x{scale:.4f} -> x{room:.4f}")
            scale = room
        idx = []
        for i, sub in enumerate(subs):
            seated, _ = place(sub, scale, CW, CH, pivot_x=pivot_x,
                              label=f"rook {name}[{i}]")
            idx.append(len(cells))
            cells.append(seated)
            fam_of.append(name)
            scale_of.append(scale)
            size_of.append(round(ref * scale))
        print(f"    rook '{name}': reference {ref:.1f} master px -> "
              f"x{scale:.4f} over {len(idx)} cell(s)")
        return idx

    def add(tag, frames):
        tags[tag] = list(frames)
        live.extend(frames)

    def alias(tag, source):
        """Point a second tag at cells that are already in the sheet."""
        tags[tag] = list(tags[source])

    fire_src = load(os.path.join(SRC_LOCAL, "Mars_Rook_RunFire_Atlas_Clean_v0.7.png"))
    run_idx = family("run", [cut(fire_src, 4, 2, c, r)
                             for r in range(2) for c in range(4)])
    add("runfire", run_idx)
    # Mars_Rook_Run_Atlas draws Rook with his arms pumping and the rifle stowed.
    # Shipping it meant the weapon disappeared whenever he ran without firing,
    # so bolts came out of thin air the moment he squeezed the trigger. The
    # rifle-levelled cycle is the run cycle; `run` is an alias, not a second set
    # of cells.
    alias("run", "runfire")

    # Key poses. The mapping here is deliberate and was wrong before: rkey_0 is
    # Rook stood at ease with the rifle stowed and a handset raised, so using it
    # for idle meant the gun vanished the instant the player stopped moving and
    # shots appeared out of empty air. Every pose that can fire now shows the
    # weapon.
    #
    #   rkey_0  at ease, rifle stowed        -> unused
    #   rkey_1  mid-stride, rear foot lifted  -> unused
    #   rkey_2  braced, rifle levelled, wide  -> idlefire / clear
    #   rkey_3  both boots flat, rifle level  -> idle
    #
    # rkey_1 was the idle for one build and it is a walking frame: the rear leg
    # is bent with the foot clear of the deck, so a player standing still stood
    # on one leg forever. rkey_3 is the only master in the set with the weight
    # even on both boots and the weapon in shot, which is what a default stance
    # has to be. rkey_0 is the gunless one and stays unused, so this does not
    # undo the fix that put the rifle back on screen.
    #
    # The two that ship are one family and take one scale. The two that do not
    # are kept out of the measurement as well as out of the sheet: an unused
    # master must not get to decide how big the used ones are drawn.
    keys = [load(os.path.join(SRC_CDN, f"rkey_{i}.png")) for i in range(4)]
    key_idx = family("key", [keys[3], keys[2]])
    add("idle", [key_idx[0]])
    add("idlefire", [key_idx[1]])
    alias("clear", "idlefire")

    # Aim poses, each its own master at its own canvas size — but all six drawn
    # by the same hand at the same resolution, so they are one family and take
    # one scale. Measuring them one at a time is what put 41% between them.
    aim_files = [
        "Rook_Aim_Up_Stand_v0.7.png",
        "Rook_Aim_Up_Air_v0.7.png",
        "Rook_Aim_Diagonal_Up_Air_v0.7.png",
        "Rook_Aim_Diagonal_Down_Air_v0.7.png",
        "Rook_Aim_Diagonal_Up_Run_1_v0.7.png",
        "Rook_Aim_Diagonal_Up_Run_2_v0.7.png",
    ]
    aim_idx = family("aim", [load(os.path.join(SRC_LOCAL, f)) for f in aim_files])
    add("aimup", [aim_idx[0]])
    add("aimup_air", [aim_idx[1]])
    add("aimdiagup_air", [aim_idx[2]])
    add("aimdiagdown_air", [aim_idx[3]])
    # The grounded diagonal-up aim, played on the stride clock while running.
    add("aimdiagup_run", [aim_idx[4], aim_idx[5]])

    # Jump and fall are the TUCKED air poses — knees drawn up on the rise,
    # leaning forward on the way down.
    #
    # Two wrong answers preceded this one. The original used rkey_1 and rkey_2,
    # which are planted stances, so Rook stood bolt upright in mid-air. The
    # obvious correction was to reuse the two diagonal-up run strides, since
    # they are the only frames with both feet clear of the deck — but those are
    # also what a player sees when they hold Up while running, which made a jump
    # and a grounded diagonal aim pixel-identical. That is what "when I try to
    # shoot diagonally it triggers a jump" describes: not the input doing two
    # things, the sprite claiming it did. Confusing two air poses with each
    # other is survivable; confusing a ground pose with an air pose is not.
    alias("jump", "aimdiagup_air")
    alias("fall", "aimdiagdown_air")

    # Prone is a lying pose, so boot-to-crown says nothing about it: sized by
    # length instead. Head parity with the run cycle would want 130px of sprite
    # and the cell has 90, which is the one place these masters cannot be
    # reconciled — the prone master is drawn at less than half the run master's
    # resolution. ROOK_PRONE_LEN keeps the pose a little longer than he is tall,
    # which is what a man flat on his front with a rifle out in front measures.
    prone_idx = family("prone",
                       [load(os.path.join(SRC_CDN, f"rprone_{i}.png"))
                        for i in range(2)],
                       mode="length", target=ROOK_PRONE_LEN, pivot_x=0.5)
    add("prone", [prone_idx[0]])
    add("pronefire", [prone_idx[1]])

    # --- one grading, and then one palette ---------------------------------
    #
    # Sizes now agree; the other half of "colors slightly change too" is that
    # the four families were exposed differently. Each is pulled onto the run
    # family's own saturation and value, warm mass and cool mass separately, so
    # the armour and the under-suit both land where the run cycle has them.
    # The family is the unit of the defect, so the family gain is computed
    # first; each cell is then trimmed onto the same target individually,
    # because the shared palette that follows has to quantise all eighteen of
    # them together and a frame still half a step off drags palette entries
    # away from the frames that agreed. A cell whose armour is mostly hidden
    # behind its own arm falls back to its family's gain rather than inventing
    # one from a hundred pixels.
    ref_stats = mass_stats([cells[i] for i in run_idx])
    for name in ("run", "key", "aim", "prone"):
        idx = [i for i, f in enumerate(fam_of) if f == name]
        fam_gains = gains_for(mass_stats([cells[i] for i in idx]), ref_stats)
        print(f"    rook '{name}' regrade: warm Sx{fam_gains[0][0]:.3f} "
              f"Vx{fam_gains[0][1]:.3f}, cool Sx{fam_gains[1][0]:.3f} "
              f"Vx{fam_gains[1][1]:.3f}")
        for i in idx:
            if cells[i] is None:
                continue
            regrade(cells[i], gains_for(mass_stats([cells[i]]), ref_stats,
                                        fallback=fam_gains))

    # Measure a muzzle socket for every live frame, in cell-local pixels with
    # the origin at the cell's own top-left. The game converts these to world
    # space against Rook's draw origin and mirrors x for a left-facing sprite.
    sockets = {}
    for tag, frames in tags.items():
        rule = MUZZLE_RULES.get(tag)
        if not rule:
            continue
        for f in frames:
            if f in sockets or cells[f] is None:
                continue
            pt = muzzle_socket(cells[f], rule)
            if pt:
                sockets[str(f)] = [round(float(pt[0]), 1), round(float(pt[1]), 1)]

    # Reference frame for DECLARED_HEIGHT_MISMATCH: the tallest run stride, the
    # frame the scale was derived from. Naming the frame is the point — every
    # other frame is free to be shorter, because that is the animation.
    tallest = max(run_idx,
                  key=lambda i: solid_bbox(cells[i])[3] - solid_bbox(cells[i])[1])
    tb = solid_bbox(cells[tallest])

    img, rows = sheet(cells, 8, CW, CH)
    # One palette for the whole character. It is what makes this pixel art
    # rather than a shrunk render — he carried 1081-2273 unique colours per
    # frame — and it is also a standing guarantee: after this there is exactly
    # one orange for Rook's armour, so no future master can bring its own.
    before = img.convert("RGB").getcolors(1 << 22)
    img = quantise(img, ROOK_COLOURS)
    print(f"    rook palette: {len(before) if before else '?'} colours "
          f"-> {ROOK_COLOURS}")

    emit("rook/rook.png", img, 8, rows, CW, CH, tags, live,
         {"drawHeight": ROOK_FIGURE_H,
          "sockets": sockets,
          "actorOf": {t: "rook" for t in tags},
          # Two different numbers, because they answer two different questions.
          # `frameScale` is the resampling factor, which is only comparable
          # between cells cut from the same master — Rook's four masters are at
          # four resolutions, so his run cells resample by 0.48 and his prone
          # cells by 0.67 to reach the same place. `frameSize` is where they
          # reached: the actor's own size in game pixels, which is comparable
          # across anything.
          "frameScale": {str(i): round(s, 5) for i, s in enumerate(scale_of)},
          "frameSize": {str(i): size_of[i] for i in range(len(cells))},
          # Prone is the same actor and deliberately not the same size class:
          # its master is drawn at less than half the run master's resolution,
          # so matching Rook's head would need 130px of sprite in a 96px cell.
          # Splitting the size group says that out loud instead of hiding it in
          # a tolerance, and keeps the colour rules treating him as one man.
          "sizeGroupOf": {t: ("rook_prone" if t.startswith("prone") else "rook")
                          for t in tags},
          # Two numbers, because they can differ: the height the build INTENDED
          # for the actor, and the height it worked out it would actually get
          # for the frame it derived the scale from. A cell narrower than the
          # actor caps the scale, and that has to be visible in the manifest
          # rather than absorbed into the art.
          "declaredHeights": {"rook": {"frame": tallest,
                                       "height": tb[3] - tb[1],
                                       "intent": ROOK_FIGURE_H}},
          "cycles": ["run", "runfire"]})

    # aimdiagup_run is the grounded diagonal-up aim, played on the stride clock,
    # and CYCLE_FRAME_COUNT is right that two frames is not a cycle. There are
    # two masters and no more; padding the tag would satisfy the count and
    # animate nothing. Acknowledged rather than hidden, so it comes back the day
    # a third and fourth stride are drawn.
    MANIFEST["suppress"].append(
        ["CYCLE_FRAME_COUNT", "rook/rook.png", "aimdiagup_run"])


def muzzle_socket(cell: Image.Image, rule: str):
    """Locate the weapon muzzle in one finished cell.

    The prototype spawned shots from a table of six hand-tuned offsets and fell
    back to the collision-box centre for every pose it did not cover, which is
    why bolts left Rook's stomach when he fired upward or while prone. Measuring
    the muzzle from the art itself means the socket is correct for whatever the
    frame actually shows, and stays correct if the art is redrawn.

    `rule` picks the band to search, because "the far end of the gun" is a
    different direction in each stance.
    """
    mask = cell.split()[-1].point(lambda v: 255 if v >= SOLID else 0)
    bb = mask.getbbox()
    if bb is None:
        return None
    x0, y0, x1, y1 = bb
    h = y1 - y0
    px = mask.load()

    def band(lo, hi):
        return range(max(y0, y0 + int(h * lo)), min(y1, y0 + int(h * hi)))

    if rule == "up":
        # Topmost lit pixel: the barrel is the highest thing in the silhouette.
        for y in range(y0, y1):
            xs = [x for x in range(x0, x1) if px[x, y]]
            if xs:
                return (sum(xs) / len(xs), y)
        return None

    rows = {
        "forward": band(0.28, 0.62),
        "diag_up": band(0.04, 0.46),
        "diag_down": band(0.48, 0.92),
        "prone": band(0.0, 1.0),
    }[rule]

    best = None
    for y in rows:
        for x in range(x1 - 1, x0 - 1, -1):
            if px[x, y]:
                if best is None or x > best[0]:
                    best = (x, y)
                break
    return best


# Which measuring rule each Rook tag uses.
MUZZLE_RULES = {
    "run": "forward", "runfire": "forward", "idle": "forward",
    "idlefire": "forward", "clear": "forward",
    "jump": "diag_up", "fall": "diag_down",
    "aimup": "up", "aimup_air": "up",
    "aimdiagup_air": "diag_up", "aimdiagup_run": "diag_up",
    "aimdiagdown_air": "diag_down",
    "prone": "prone", "pronefire": "prone",
}


# What each row of each group sheet ACTUALLY depicts.
#
# The four group sheets do not share a row convention, and assuming they did
# was a real bug with three visible symptoms: a flying pod walked along the
# ground as a "trooper" (group C row 0), a full human soldier was drawn at 42px
# "mite" height beside Rook's 74px (group C row 1), and a centipede was scaled
# to trooper height and then squashed to 44px by the fit-to-cell pass (group D
# row 0).
#
# Roles drive both the drawn height and the behaviour the game gives the actor,
# so they have to describe the artwork rather than its grid position.
ENEMY_ROLES = {
    "b": ["trooper", "hound", "turret"],
    "c": ["flier", "trooper", "turret"],
    "d": ["hound", "trooper", "turret"],
    "e": ["flier", "drone", "trooper"],
}

# Drawn height per role, in game pixels. Rook is 74.
ROLE_HEIGHT = {
    "trooper": 64,   # a soldier reads as a person: just under Rook
    "turret": 58,
    "hound": 34,     # low to the ground, wide
    "flier": 44,
    "drone": 30,
}


def build_enemies():
    """The four enemy group sheets, re-cut off the grid and sized per role.

    Each sheet is 3x3 on a 1024px canvas — 341.33px per row — and the artwork
    was never on that grid: see cut_subjects() for what that cost. Columns are
    idle / move / attack; rows are whatever ENEMY_ROLES says.

    The cell is wide (112x88) on purpose. At 80x80 the widest subjects — the
    centipede and the spider walkers — could not clear the gutter at their
    proper height, so fit_in_cell shrank them, and the same nominal role came
    out at different sizes in different sectors. A cell wide enough for the
    widest subject means the role's height is the height it actually renders.

    ROLE_HEIGHT is the height of the IDLE cell, not of every cell. The three
    poses used to be normalised to it one at a time, which is Defect D: a wide
    low pose and a tall narrow one got different scales, so e_flier changed size
    by 43% between the two frames of its own walk and d_trooper by 14%. Now the
    idle fixes the scale and move and attack keep whatever height the artist
    drew them at — a centipede that rears to strike is supposed to get taller.
    """
    CW, CH = 112, 88
    cells, tags, live = [], {}, []
    files = {
        "b": "Mars_Enemy_Group_B_v0.7.png",
        "c": "Mars_Enemy_Group_C_v0.7.png",
        "d": "Mars_Enemy_Group_D_v0.7.png",
        "e": "Mars_Enemy_Group_E_v0.7.png",
    }
    poses = ["idle", "move", "attack"]
    scale_of, size_of, actor_of, declared, masters = [], [], {}, {}, []

    for gn, fn in files.items():
        src = load(os.path.join(SRC_LOCAL, fn))
        cut_cells = cut_subjects(src, 3, 3, fn)
        masters.append({"file": fn, "cols": 3, "rows": 3})
        for r, role in enumerate(ENEMY_ROLES[gn]):
            actor = f"{gn}_{role}"
            subs = [clean(cut_cells[(c, r)]) for c in range(3)]
            if any(s is None for s in subs):
                raise SystemExit(f"build-mars-art: {fn} row {r} has an empty cell")
            scale = ROLE_HEIGHT[role] / subs[0].size[1]
            room = min(min((CW - 2 * GUTTER) / s.size[0], (CH - 2 * GUTTER) / s.size[1])
                       for s in subs)
            if scale > room:
                print(f"    ! {actor} capped by the cell: x{scale:.4f} -> x{room:.4f}")
                scale = room
            start = len(cells)
            for pi, pose in enumerate(poses):
                seated, _ = place(subs[pi], scale, CW, CH, label=f"{actor}_{pose}")
                cells.append(seated)
                scale_of.append(scale)
                size_of.append(round(subs[0].size[1] * scale))
                tags[f"{actor}_{pose}"] = [start + pi]
                actor_of[f"{actor}_{pose}"] = actor
            # A two-pose walk reads better than a single frame held; the group
            # sheets only carry one move pose, so the cycle alternates
            # idle/move rather than freezing on move.
            tags[f"{actor}_walk"] = [start + 0, start + 1]
            actor_of[f"{actor}_walk"] = actor
            live.extend(range(start, start + 3))
            declared[actor] = {"frame": start,
                               "height": round(subs[0].size[1] * scale),
                               "intent": ROLE_HEIGHT[role]}

    img, rows = sheet(cells, 9, CW, CH)
    emit("enemies/enemies.png", img, 9, rows, CW, CH, tags, live,
         {"roles": ENEMY_ROLES,
          "masters": masters,
          "actorOf": actor_of,
          "frameScale": {str(i): round(s, 5) for i, s in enumerate(scale_of)},
          "frameSize": {str(i): v for i, v in enumerate(size_of)},
          "declaredHeights": declared})

    # The `_walk` tags are two frames, and CYCLE_FRAME_COUNT wants four. That is
    # the right rule and this is a real shortfall, not a false positive: these
    # twelve creatures each have exactly one authored move pose, so the walk is
    # an idle/move alternation rather than a stride. Padding it to four entries
    # would satisfy the count and animate nothing — Enemy.applyPose clocks the
    # phase modulo 2 — so the finding is acknowledged here instead, and drops
    # away by itself the day a group sheet arrives with four move columns.
    for tag in tags:
        if tag.endswith("_walk"):
            MANIFEST["suppress"].append(
                ["CYCLE_FRAME_COUNT", "enemies/enemies.png", tag])


def build_bosses():
    """Twelve bosses, five authored poses each, expanded into a real cycle.

    The masters give idle / walk-a / walk-b / anticipation / release. That is
    enough to key from but not enough to animate — held poses are what make a
    boss look like it is rocking in place instead of walking. So each boss also
    gets a breathing pair derived from its idle and a recovery frame derived
    from its release, generated here rather than hand-drawn, which keeps the
    anatomy honest: nothing is invented, only re-timed and re-seated.

    One scale per boss (Defect E). Sizing each pose to its own 126px target and
    then letting fit_in_cell rescue the ones that overflowed meant the scale was
    really being set by each pose's aspect ratio: boss5 came out 102 / 112 / 117
    / 118 / 117 tall across its five poses, a 15% swing inside one creature, and
    boss4 and boss11 missed their declared heights as well.

    The scale is whatever makes the idle reach the boss's declared height,
    capped so that the WIDEST pose still clears the gutter. Where the cap binds
    — boss5's arms span 302 master px against a 186px usable cell — the boss
    ends up shorter than its hitbox, and that is now a single honest number
    reported at the end of the build rather than five different ones hidden
    inside the art.
    """
    CW, CH = 192, 192
    cells, tags, live = [], {}, []
    scale_of, size_of, actor_of, declared, masters = [], [], {}, {}, []
    short = []
    uneven = []
    for atlas_i in range(3):
        fn = f"Mars_Boss_Atlas_0{atlas_i+1}_Motion_Clean_v0.8.png"
        src = load(os.path.join(SRC_LOCAL, fn))
        masters.append({"file": fn, "cols": 5, "rows": 4})
        for row in range(4):
            boss = atlas_i * 4 + row
            actor = f"boss{boss}"
            th = 150 if boss == 11 else 126
            subs = [clean(cut(src, 5, 4, col, row)) for col in range(5)]
            if any(s is None for s in subs):
                raise SystemExit(f"build-mars-art: {fn} row {row} has an empty cell")
            scale = th / subs[0].size[1]
            room = min(min((CW - 2 * GUTTER) / s.size[0], (CH - 2 * GUTTER) / s.size[1])
                       for s in subs)
            if scale > room:
                short.append((actor, th, round(subs[0].size[1] * room)))
                scale = room
            start = len(cells)
            poses = []
            for col in range(5):
                seated, _ = place(subs[col], scale, CW, CH, label=f"{actor}[{col}]")
                poses.append(seated)
            cells.extend(poses)                       # 0..4 authored
            # Breathing: the idle lifted one pixel. Two frames held long reads
            # as a living silhouette without implying motion the art lacks.
            breath = Image.new("RGBA", (CW, CH), (0, 0, 0, 0))
            if poses[0]:
                breath.alpha_composite(poses[0], (0, -1))
            cells.append(breath)                      # 5 breathe
            # Recovery: the release pose settling back. It used to be composited
            # at (-2, 1) and left there, which put its lowest row one pixel INTO
            # the gutter on all twelve bosses and sank the creature a pixel
            # below its own ground line for the length of the recovery — the one
            # window in the fight the player is meant to be reading (Defect G).
            # The lateral half of that offset was wrong as well: it is baked in
            # facing-right, and setFlipX mirrors it, so half the time it pushed
            # the boss the wrong way. Boss.visualOffset() already does this at
            # draw time, and knows which way the boss is looking.
            cells.append(poses[4].copy() if poses[4] else
                         Image.new("RGBA", (CW, CH), (0, 0, 0, 0)))   # 6 recover
            for _ in range(7):
                scale_of.append(scale)
                size_of.append(round(subs[0].size[1] * scale))
            tags[f"{actor}_idle"] = [start + 0, start + 5]
            tags[f"{actor}_walk"] = [start + 1, start + 2, start + 1, start + 0]
            tags[f"{actor}_air"] = [start + 2]
            tags[f"{actor}_wind"] = [start + 3]
            tags[f"{actor}_fire"] = [start + 4]
            tags[f"{actor}_recover"] = [start + 6, start + 3]
            for pose in ("idle", "walk", "air", "wind", "fire", "recover"):
                actor_of[f"{actor}_{pose}"] = actor
            live.extend(range(start, start + 7))
            bb = solid_bbox(cells[start])
            declared[actor] = {"frame": start,
                               "height": round(subs[0].size[1] * scale),
                               "intent": th}
            drawn = [solid_bbox(c) for c in poses]
            hs = [b[3] - b[1] for b in drawn if b]
            if hs and (max(hs) - min(hs)) / max(hs) > 0.15:
                uneven.append((actor, min(hs), max(hs)))
            print(f"    {actor}: x{scale:.4f}  idle {bb[2]-bb[0]}x{bb[3]-bb[1]}")

    if short:
        print("    bosses whose widest pose caps them below their hitbox height:")
        for actor, want, got in short:
            print(f"      {actor}: wants {want}px, the cell allows {got}px")
    if uneven:
        # With one scale per boss, a pose that draws much shorter than the rest
        # is the MASTER saying so, not the build. Worth knowing which, because
        # per-cell normalising used to hide it: boss6's release pose is rendered
        # a fifth smaller than its idle in the source atlas, and normalising
        # each cell to 126px was silently correcting an art bug. It is not this
        # script's place to keep doing that, but it is its place to say so.
        print("    bosses whose own masters disagree about their size:")
        for actor, lo, hi in uneven:
            print(f"      {actor}: authored poses draw {lo}-{hi}px "
                  f"({100*(hi-lo)/hi:.0f}% apart) at one scale")

    img, rows = sheet(cells, 7, CW, CH)
    emit("bosses/bosses.png", img, 7, rows, CW, CH, tags, live,
         {"posesPerBoss": 7,
          "masters": masters,
          "actorOf": actor_of,
          "frameScale": {str(i): round(s, 5) for i, s in enumerate(scale_of)},
          "frameSize": {str(i): v for i, v in enumerate(size_of)},
          "declaredHeights": declared,
          "cycles": [f"boss{i}_walk" for i in range(12)]})


def build_projectiles():
    """Player weapon shots, enemy shot families, and the effects that sell them.

    Player shots come from the eight weapon masters; enemy shots from the 4x3
    sheet whose outer column subjects were clipped by the cell wall. Muzzle
    flashes and impacts are generated from each shot's own silhouette so the
    hit reads as the same energy as the bolt that caused it, rather than as a
    generic spark.
    """
    # 48px cells: the barrier disk is 22px wide and its impact blooms past
    # twice that. A 32px cell clipped both, which is how an impact ends up
    # showing its own atlas rectangle.
    CW, CH = 48, 48
    cells, tags, live = [], {}, []

    def derive(base, scale_x, scale_y, blur, alpha_hi):
        """Grow a bolt into a flash or a burst, keeping its own silhouette."""
        f = Image.new("RGBA", (CW, CH), (0, 0, 0, 0))
        if not base:
            return f
        bb = solid_bbox(base)
        if not bb:
            return f
        b = base.crop(bb)
        b = b.resize((max(1, int(b.width * scale_x)), max(1, int(b.height * scale_y))),
                     Image.LANCZOS)
        b = b.filter(ImageFilter.GaussianBlur(blur))
        b = harden_alpha(b, lo=20, hi=alpha_hi)
        return seat(b, CW, CH, 0.5, anchor="center", label=None)

    # --- player weapon bolts -------------------------------------------------
    start = len(cells)
    for i in range(8):
        src = load(os.path.join(SRC_CDN, f"wshot_{i}.png"))
        seated, _ = prepare(src, 14 if i != 7 else 22, CW, CH, anchor="center",
                            label=f"pshot{i}")
        cells.append(seated)
        tags[f"pshot{i}"] = [start + i]
    live.extend(range(start, start + 8))

    # --- enemy bolt families -------------------------------------------------
    esrc = load(os.path.join(SRC_LOCAL, "Mars_Enemy_Projectiles_v0.7.png"))
    start = len(cells)
    for r in range(3):
        for c in range(4):
            seated, _ = prepare(cut(esrc, 4, 3, c, r), 14, CW, CH,
                                anchor="center", label=f"eshot{r*4+c}")
            cells.append(seated)
            tags[f"eshot{r*4+c}"] = [start + r * 4 + c]
    live.extend(range(start, start + 12))

    # --- muzzle flash, per weapon, derived from the bolt --------------------
    start = len(cells)
    for i in range(8):
        cells.append(derive(cells[i], 1.5, 1.9, 0.6, 140))
        tags[f"muzzle{i}"] = [start + i]
    live.extend(range(start, start + 8))

    # --- impact bursts, three frames, per weapon ----------------------------
    for i in range(8):
        start = len(cells)
        for scale, blur, alpha_hi in ((1.2, 0.4, 150), (1.9, 1.1, 190), (2.4, 2.0, 230)):
            cells.append(derive(cells[i], scale, scale, blur, alpha_hi))
        tags[f"impact{i}"] = list(range(start, start + 3))
        live.extend(range(start, start + 3))

    img, rows = sheet(cells, 12, CW, CH)
    # allowDetached, because several of these ARE detached by design: pshot1 is
    # a three-way spread, so the "sprite" is three bolts with clear air between
    # them, and every impact burst throws sparks off the main bloom.
    # DETACHED_MASS is the right rule for a character and the wrong one for a
    # shotgun.
    emit("projectiles/projectiles.png", img, 12, rows, CW, CH, tags, live,
         {"anchor": "center", "allowDetached": True})


def build_new_enemies():
    """The enemy types authored here rather than inherited from the masters.

    The group sheets cover twelve ground and air machines and no canopy at all,
    so the campaign had no telegraphing shield node and nothing that entered a
    stage from above. These fill that: a hovering gun-drone, an armoured ground
    crawler, a shield node whose arc charges over four frames so the player can
    read the shot coming, and the paratroop canopy.

    The crawler and the drone were redrawn. The first pass at them was flat
    purple with stick legs — the only two actors in the game that did not share
    the sector palette, which is exactly how they read on screen. They are now
    built from the same orange/navy/cyan ramp and the same top-left key light as
    everything else.

    They arrive from Aseprite already on the game's pixel grid, so they skip the
    un-matte / resample / despeckle path entirely — running a cleanup pass over
    hand-placed pixels would only erode them. Their detached parts (rotor blur,
    thruster flame, shield arc, shroud lines) are deliberate, which is why the
    sheet is marked allowDetached for the checker.

    Frame width comes from the Aseprite sidecar rather than a table here, so
    redrawing a sprite at a new size cannot silently mis-slice the strip.
    """
    # 56x40, not 32x32. The canopy was redrawn at 48x34 because at 26 px it
    # was half the width of the 64 px trooper hanging under it, which is not
    # what a parachute looks like and is why the descent read as a prop rather
    # than as a drop. The cell is sized to the largest authored subject; the
    # other three keep their own drawn size and simply gain more gutter.
    CW, CH = 56, 40
    specs = [
        ("wasp", "uplink-wasp", "hover"),
        ("crawler", "conduit-crawler", "crawl"),
        ("sentinel", "beacon-sentinel", "charge"),
        ("canopy", "drop-canopy", "drift"),
    ]
    cells, tags, live = [], {}, []
    exports = os.path.join(ROOT, "Game art files", "Mars Signal Siege", "exports")
    for key, stem, tag in specs:
        src = load(os.path.join(exports, stem + ".png"))
        with open(os.path.join(exports, stem + ".json"), encoding="utf-8") as fh:
            meta = json.load(fh)
        fw = meta["frames"][0]["frame"]["w"]
        n = src.width // fw
        start = len(cells)
        for i in range(n):
            sub = src.crop((i * fw, 0, (i + 1) * fw, src.height))
            # Seat on the INK, not on the strip height. Every frame in these
            # four exports happens to fill its own strip today, so this changes
            # nothing yet; it means a redraw that leaves a clear row under the
            # sprite cannot silently lift the actor off the ground line the
            # game stands it on. No resampling — these are hand-placed pixels
            # and the only thing decided here is where the block of them starts.
            bb = solid_bbox(sub)
            if bb:
                sub = sub.crop(bb)
            canvas = Image.new("RGBA", (CW, CH), (0, 0, 0, 0))
            canvas.alpha_composite(sub, ((CW - sub.width) // 2,
                                         baseline_of(CH) + 1 - sub.height))
            cells.append(canvas)
        tags[f"{key}_{tag}"] = list(range(start, len(cells)))
        live.extend(tags[f"{key}_{tag}"])

    img, rows = sheet(cells, 4, CW, CH)
    # The wasp's rotors and the crawler's legs are locomotion and are authored
    # as four-frame cycles; the sentinel's four frames are a telegraph, not a
    # walk, and the canopy drifts on two. Only the first two claim to be cycles.
    emit("enemies/new-enemies.png", img, 4, rows, CW, CH, tags, live,
         {"allowDetached": True, "cycles": ["wasp_hover", "crawler_crawl"]})


# How bright a backdrop is allowed to be, as a fraction of the luminance of the
# ground cut from that same painting.
#
# The player has to be able to tell the floor from the picture behind it, and
# both are cut from one master, so the separation has to be manufactured. It
# used to be manufactured at runtime by multiplying the whole backdrop by a flat
# violet tint -- one constant, applied to six paintings of wildly different
# exposure. Measured, that constant produced a separation ratio of 0.38 on the
# dustline (which reads correctly) and 0.21 on the foundry and 0.18 in the
# catacombs, which do not read at all: the final mission's backdrop was arriving
# on screen at four percent luminance, which is why it was reported as having no
# background art. It had background art. It was being crushed to black.
#
# Grading each backdrop against its OWN ground fixes the exposure where it can
# be looked at, and gives every sector the separation the good ones already had
# -- which for the two dark families means lifting the art, not dimming it.
BG_SEPARATION = 0.42

# A trace of atmospheric cool, so distance still reads as distance once the flat
# violet multiply is gone. Far weaker than the tint it replaces: this is a hint
# of haze, not a colour cast.
BG_HAZE = (0x74, 0x6e, 0x8c)
BG_HAZE_MIX = 0.14


def build_backgrounds():
    """Six environment families plus the vertical uplink, at parallax width.

    Backgrounds are the bulk of the byte budget, so they drop to the game's own
    360px height and ship as a seamless mirrored pair the parallax can tile
    without a visible join.

    Runs AFTER build_terrain, because each backdrop is exposed relative to the
    ground texture cut from it and that texture has to exist first.
    """
    os.makedirs(os.path.join(OUT, "backgrounds"), exist_ok=True)
    for key, fn in BACKGROUNDS:
        im = Image.open(os.path.join(SRC_LOCAL, fn)).convert("RGB")
        im = im.resize((640, 360), Image.LANCZOS)

        body_path = os.path.join(OUT, "terrain", f"{key}-body.png")
        before = mean_luma(im)
        if os.path.exists(body_path):
            # Haze FIRST, then expose. Blending toward a light haze raises the
            # mean, and on the darkest master that lift was larger than the
            # whole picture: the catacombs backdrop needed no gain at all, took
            # the haze afterwards, and came out at 0.94 of its own ground --
            # every bit of the separation this function exists to create,
            # undone by the last line of it. Graded after the blend, the haze
            # is a colour decision and the exposure is still the exposure.
            im = Image.blend(im, Image.new("RGB", im.size, BG_HAZE), BG_HAZE_MIX)
            target = mean_luma(Image.open(body_path).convert("RGB")) * BG_SEPARATION
            # Clamped both ways. A backdrop that needs more than a 2.4x lift has
            # nothing in its shadows worth lifting, and one that needs to drop
            # below 0.3x would lose the painting rather than push it back.
            gain = max(0.30, min(2.40, target / max(1.0, mean_luma(im))))
            im = Image.eval(im, lambda v: max(0, min(255, round(v * gain))))
        else:
            gain = 1.0
        after = mean_luma(im)

        p = os.path.join(OUT, "backgrounds", f"{key}.png")
        im.save(p, optimize=True)
        print(f"  backgrounds/{key}.png{'':13s} 640x360   "
              f"{os.path.getsize(p)/1024:7.1f} KB   "
              f"L {before:4.1f} -> {after:4.1f} (x{gain:.2f})")


def build_terrain():
    """Tileable ground material, one set per environment family.

    The platforms were drawn as flat filled rectangles with a coloured lip.
    Against backdrops this painterly they read as UI laid over the scene rather
    than as the floor of it — the single biggest reason the build looked
    simplified next to the prototype. There is no separate terrain master to
    draw from, but there does not need to be: the bottom of each background
    master IS that sector's rock, lit the same way and painted from the same
    palette, so the ground the player runs on is cut from the same picture as
    the ground behind them.

    Two textures per family:

      body — the rock mass, seamless on BOTH axes, because a platform can be
             any size and a visible repeat seam is worse than a flat fill.
      cap  — the lit top band, seamless horizontally only. It is the edge the
             player reads as "this is the floor", so it is lifted well clear of
             both the body and the backdrop behind it.

    Three things this has to get right, each of which it got wrong first time:

      * The crop window is CHOSEN, not fixed. A fixed offset landed on a tower
        in one master and on toxic growth in another, and neither tiles as
        ground. The window with the least vertical-edge energy is the flattest
        stretch of rubble in the strip, which is exactly what is wanted.
      * The seam cross-fades the right edge toward the real left edge, not a
        mirrored copy. Mirroring guarantees a seamless join and also guarantees
        a symmetrical one, which at 128 px reads as a repeating curtain.
      * Exposure is normalised to a target before contrast is applied. A flat
        multiplier crushed the two darkest masters to pure black while leaving
        the brightest one untouched.
    """
    os.makedirs(os.path.join(OUT, "terrain"), exist_ok=True)
    TW, BODY_H, CAP_H = 128, 64, 14
    BLEND = 28
    BODY_TARGET = 58          # mean luma, 0-255
    CAP_RATIO = 1.5           # how much brighter the lit lip is than the rock
    BODY_MAX_GAIN = 3.2       # exposure ceiling on the rock; the cap follows it

    def cross_fade_right(im, blend):
        """Fade the right edge into the strip's own left edge."""
        w, h = im.size
        out = im.copy()
        left = im.crop((0, 0, blend, h))
        right = im.crop((w - blend, 0, w, h))
        mixed = Image.new("RGB", (blend, h))
        for x in range(blend):
            t = x / max(1, blend - 1)
            for y in range(h):
                a, b = right.getpixel((x, y)), left.getpixel((x, y))
                mixed.putpixel((x, y), tuple(
                    round(a[i] * (1 - t) + b[i] * t) for i in range(3)))
        out.paste(mixed, (w - blend, 0))
        return out

    def seamless_y(im, blend):
        return cross_fade_right(
            im.transpose(Image.ROTATE_90), blend).transpose(Image.ROTATE_270)

    def luma(im):
        px = im.load()
        w, h = im.size
        n = 0
        total = 0.0
        for y in range(0, h, 2):
            for x in range(0, w, 2):
                r, g, b = px[x, y]
                total += 0.299 * r + 0.587 * g + 0.114 * b
                n += 1
        return total / max(1, n)

    def grade(im, target, contrast, max_gain=1.9):
        """Normalise exposure toward `target`, then push contrast about it.

        The lift is capped, and the strip is desaturated in proportion to how
        hard it was lifted. What survives in the shadows of these masters is
        mostly chroma noise, and amplifying it without pulling the saturation
        back turns a dim rock floor into glowing blue static.
        """
        mean = max(1.0, luma(im))
        gain = max(0.45, min(max_gain, target / mean))
        desat = min(0.55, max(0.0, (gain - 1.15) * 0.6))
        px = im.load()
        w, h = im.size
        for y in range(h):
            for x in range(w):
                r, g, b = (max(0, min(255, round((v * gain - target) * contrast + target)))
                           for v in px[x, y])
                if desat:
                    grey = 0.299 * r + 0.587 * g + 0.114 * b
                    r = round(r + (grey - r) * desat)
                    g = round(g + (grey - g) * desat)
                    b = round(b + (grey - b) * desat)
                px[x, y] = (r, g, b)
        return im

    def flattest_window(im, width):
        """The x offset whose window has the least vertical structure.

        Towers, pipes and glowing columns are all strong vertical edges. The
        quietest window is the stretch of plain rubble, which is the only part
        of these paintings that tiles as a floor.
        """
        px = im.load()
        w, h = im.size
        col = []
        for x in range(w - 1):
            e = 0
            for y in range(0, h, 2):
                a, b = px[x, y], px[x + 1, y]
                e += abs(a[0] - b[0]) + abs(a[1] - b[1]) + abs(a[2] - b[2])
            col.append(e)
        best, best_e = 0, None
        for x0 in range(0, w - width, 4):
            e = sum(col[x0:x0 + width])
            if best_e is None or e < best_e:
                best, best_e = x0, e
        return best

    def band_at(src, frac):
        w, h = src.size
        top = int(h * frac)
        cut = src.crop((0, top, w, min(h, top + int(h * 0.13))))
        return cut.resize((1024, BODY_H + CAP_H), Image.LANCZOS)

    def detail(im):
        """Mean absolute horizontal difference: how much texture is present."""
        px = im.load()
        w, h = im.size
        total, n = 0, 0
        for y in range(0, h, 3):
            for x in range(0, w - 2, 3):
                a, b = px[x, y], px[x + 2, y]
                total += abs(a[0] - b[0]) + abs(a[1] - b[1]) + abs(a[2] - b[2])
                n += 1
        return total / max(1, n)

    def choose_band(src):
        """Pick the strip of the painting that can actually serve as a floor.

        A fixed depth does not work across six masters. The exteriors put their
        rubble at the very bottom; the interiors put a black void there and
        their walkable deck higher up. Forcing a fixed band and then correcting
        exposure turned those two into amplified blue noise, because there was
        nothing in the source to amplify.

        So: prefer a band that is already in a usable exposure range and that
        carries real texture, and only then prefer the lowest one.
        """
        best, best_score = None, None
        for frac in (0.58, 0.66, 0.74, 0.82, 0.88):
            cand = band_at(src, frac)
            lum, det = luma(cand), detail(cand)
            if lum < 12 or det < 6:
                continue                       # a void; nothing to recover
            gain = BODY_TARGET / max(1.0, lum)
            # Penalise anything needing a heavy lift, reward texture and depth.
            score = det - abs(gain - 1.0) * 26 + frac * 12
            if best_score is None or score > best_score:
                best, best_score = cand, score
        return best if best is not None else band_at(src, 0.82)

    for key, fn in BACKGROUNDS:
        src = Image.open(os.path.join(SRC_LOCAL, fn)).convert("RGB")
        band = choose_band(src)
        x0 = flattest_window(band, TW)

        body = band.crop((x0, CAP_H, x0 + TW, CAP_H + BODY_H))
        body = seamless_y(cross_fade_right(body, BLEND), BLEND)
        # The default 1.9 ceiling was set to stop a dim master being lifted
        # into blue static, but measured across all six families it was never
        # the thing holding the noise down -- the proportional desaturation
        # above was. What the ceiling actually did was stop the two darkest
        # sectors ever reaching the exposure the other four got, so the hive
        # city shipped a floor at 35 against a target of 58 and the catacombs
        # shipped one at 27. At 3.2 both reach it, and their chroma swing
        # (6.9 and 4.1) still comes in below the dustline (12.2), the ice vault
        # (12.7) and the foundry core (17.8), which have shipped that way from
        # the start. The ceiling is a guard, not a budget.
        grade(body, BODY_TARGET, 1.16, max_gain=BODY_MAX_GAIN)
        body.save(os.path.join(OUT, "terrain", f"{key}-body.png"), optimize=True)

        # The cap is exposed RELATIVE to the body it caps, not to an absolute
        # target. Against a fixed target the gain ceiling stopped the darker
        # masters ever reaching it, and five of the six families shipped a
        # "lit" band measuring the same as, or darker than, the rock underneath
        # -- so the one line the player reads as "this is the floor" was
        # invisible on all but the ice. A ratio cannot fail that way.
        cap = cross_fade_right(band.crop((x0, 0, x0 + TW, CAP_H)), BLEND)
        # The cap's ceiling has to move with the body's. It does not sit at 3.4
        # because 3.4 is a good number -- it sits there because the body used to
        # stop at 1.9, and a lip only ever has to out-expose the rock beneath
        # it. Raising the body ceiling alone immediately re-broke the thing
        # CAP_RATIO was introduced to fix: the catacombs shipped a "lit" lip at
        # 0.83 of its own rock, i.e. a dark line where the bright one should be.
        # Tied to the body ceiling, that cannot come apart again.
        grade(cap, luma(body) * CAP_RATIO, 1.08, max_gain=BODY_MAX_GAIN * 1.8)
        cap.save(os.path.join(OUT, "terrain", f"{key}-cap.png"), optimize=True)

        # The lip is the single line the player reads as "this is the floor".
        # If it ever comes out at or below the rock it caps, the deck loses its
        # top edge -- so say so at build time rather than shipping it.
        ratio = luma(cap) / max(1.0, luma(body))
        if ratio < 1.25:
            print(f"  WARNING: {key} cap is only {ratio:.2f}x its body "
                  f"-- the lit lip will not read")

        for suffix, img in (("body", body), ("cap", cap)):
            path = os.path.join(OUT, "terrain", f"{key}-{suffix}.png")
            print(f"  terrain/{key}-{suffix}.png{'':>{max(0, 14 - len(key))}} "
                  f"{img.size[0]}x{img.size[1]}   "
                  f"{os.path.getsize(path)/1024:7.1f} KB")


def keyline_inset(im, band=90, hits=0.85):
    """How far in the master's decorative border runs, per edge.

    The title master is a framed poster: a three-pixel violet rule about a
    dozen pixels in from every edge. Downscaled to the game's 640x360 it lands
    four pixels from the canvas wall, and because the title screen is shown at
    full bleed the player sees a thin purple box drawn around the whole game.
    On a full-screen open that reads as the game sitting inside a panel rather
    than filling the screen.

    Detected rather than hard-coded, so re-exporting the master at another size
    cannot silently put the rule back on screen. Returns (left, top, right,
    bottom) in master pixels, all zero when there is no rule to find.
    """
    px = im.load()
    w, h = im.size

    def violet(c):
        r, g, b = c[:3]
        return b > 55 and b - r > 18 and b - g > 18

    def run(coords, sample):
        """First index whose line is almost entirely violet, then the far side
        of that run — the border is a rule, not a gradient."""
        start = None
        for i in coords:
            line = [px[a, b] for a, b in sample(i)]
            frac = sum(1 for c in line if violet(c)) / len(line)
            if frac >= hits:
                start = i
            elif start is not None:
                return abs(i - coords[0])
        return 0

    left = run(range(0, band), lambda x: [(x, y) for y in range(0, h, 7)])
    right = run(range(w - 1, w - band, -1), lambda x: [(x, y) for y in range(0, h, 7)])
    top = run(range(0, band), lambda y: [(x, y) for x in range(0, w, 7)])
    bottom = run(range(h - 1, h - band, -1), lambda y: [(x, y) for x in range(0, w, 7)])
    return left, top, right, bottom


def build_ui():
    """Title cover, logo, briefing panels and the boss-gate plate."""
    os.makedirs(os.path.join(OUT, "ui"), exist_ok=True)

    cover = Image.open(os.path.join(SRC_LOCAL, "Mars_Title_Cover_v0.7.png")).convert("RGB")
    l, t, r, b = keyline_inset(cover)
    if any((l, t, r, b)):
        # Two pixels clear of the rule, so no softened edge of it survives the
        # downscale.
        cover = cover.crop((l + 2, t + 2, cover.width - r - 2, cover.height - b - 2))
        print(f"  title cover: cropped inside its keyline ({l},{t},{r},{b})")
    # Centre-crop to the view's own ratio before resampling. Squeezing a
    # near-16:9 crop into exactly 16:9 would stretch the wordmark, and it is
    # lettering the player reads.
    want = 640 / 360
    have = cover.width / cover.height
    if have > want:
        new_w = round(cover.height * want)
        off = (cover.width - new_w) // 2
        cover = cover.crop((off, 0, off + new_w, cover.height))
    elif have < want:
        new_h = round(cover.width / want)
        off = (cover.height - new_h) // 2
        cover = cover.crop((0, off, cover.width, off + new_h))
    cover.resize((640, 360), Image.LANCZOS).save(
        os.path.join(OUT, "ui", "title-cover.png"), optimize=True)
    logo = load(os.path.join(SRC_CDN, "logo.png"))
    bb = solid_bbox(logo)
    if bb:
        logo = logo.crop(bb)
    lw = 420
    logo = logo.resize((lw, max(1, round(logo.height * lw / logo.width))), Image.LANCZOS)
    harden_alpha(logo, lo=40, hi=170).save(
        os.path.join(OUT, "ui", "logo.png"), optimize=True)
    for key, fn in (("panel-a", "panelA.png"), ("panel-b", "panelB.png"),
                    ("boss-gate", "bossBg.png")):
        Image.open(os.path.join(SRC_CDN, fn)).convert("RGB").save(
            os.path.join(OUT, "ui", f"{key}.png"), optimize=True)
    for n in ("title-cover", "logo", "panel-a", "panel-b", "boss-gate"):
        p = os.path.join(OUT, "ui", f"{n}.png")
        print(f"  ui/{n}.png{'':>{max(0,24-len(n))}} "
              f"{os.path.getsize(p)/1024:7.1f} KB")


def main():
    os.makedirs(OUT, exist_ok=True)
    print("Rook:")
    build_rook()
    print("Enemies:")
    build_enemies()
    build_new_enemies()
    print("Bosses:")
    build_bosses()
    print("Projectiles:")
    build_projectiles()
    # Terrain BEFORE backgrounds: each backdrop is exposed relative to the
    # ground cut from it, so the ground has to exist first.
    print("Terrain:")
    build_terrain()
    print("Backgrounds:")
    build_backgrounds()
    print("UI:")
    build_ui()

    with open(os.path.join(OUT, "atlases.json"), "w", encoding="utf-8") as fh:
        json.dump(MANIFEST, fh, indent=1)
    total = sum(
        os.path.getsize(os.path.join(dp, f))
        for dp, _, fs in os.walk(OUT) for f in fs
    )
    if CLAMPED:
        # Reaching fit_in_cell means a frame did not fit the scale its actor
        # agreed on, which is the per-frame rescaling this build exists to
        # prevent. Not fatal — the gutter still has to be honoured — but never
        # silent again.
        print("\nbuild-mars-art: WARNING, frames rescued by fit_in_cell:")
        for line in CLAMPED:
            print(f"  {line}")
    print(f"\nbuild-mars-art: wrote {len(MANIFEST['sheets'])} atlases, "
          f"{total/1024/1024:.2f} MB total under {os.path.relpath(OUT, ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
