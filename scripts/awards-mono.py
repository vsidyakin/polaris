#!/usr/bin/env python3
"""Derive the white award badges in public/awards/mono/ from the colour ones.

WHY THIS EXISTS
The award strip under the hero used to be fifteen colour marks, each sat on a
white plate because they are drawn for white backgrounds. Fifteen plates on a
dark band read as fifteen bright rectangles: the plate is the thing the eye
picks up, and the badge inside it is incidental. The InfoComm 2026 mark was the
one exception -- white artwork on a transparent ground, sitting directly on the
page -- and it is the shape the whole strip now takes (Matt, 27 Aug 2026).

THE SOURCES ARE STILL public/awards/*.png AND STAY THERE. Nothing here is
destructive: this reads the colour files and writes new ones beside them in
mono/. Rerun it after any change to the roster, and re-check the result by eye
-- the parameters below are per-file for a reason.

WHAT "WHITE" MEANS PER FILE
These marks do not share a construction, so one rule cannot convert them all.
Three do the work:

  ink    Dark or saturated artwork on a light or transparent ground -- most of
         the roster. Coverage is `1 - min(R,G,B)`, which reads as "how far from
         white is this pixel", so a saturated red and a near-black both go fully
         white while an off-white ground falls away. White detail *inside* a
         coloured shape (the knocked-out type in a red banner) is near-white by
         that measure, so it drops out and becomes a hole -- which is exactly
         the knockout the 2026 mark uses.

  light  Light artwork on a dark or saturated ground, where `ink` would flood
         the whole tile white. Coverage is luminance, so white type survives and
         the ground goes. `key` forces a colour that is bright to the eye but
         mid-luminance -- the yellow "AV" -- to full white, because on luminance
         alone it renders as 40% grey next to its own white lettering.

  bands  Horizontal strips of one image converted by different rules. The two
         ISE 2020 marks are a red panel of knocked-out type over a black panel
         carrying the publication logo: `ink` on the top makes the panel white
         and knocks the type out of it, `light` on the bottom drops the black
         and keeps the logo. One rule over the whole file loses one half or the
         other.

`warm` multiplies the result by how far the pixel is towards red of blue, and it
is a background knife rather than a tone control. The InfoComm 2025 / SCN badge
is gold, red and white on a blue photograph; nothing about brightness separates
those two, but nothing in the badge is blue and nothing in the photo is warm, so
one subtraction removes the photograph and leaves the badge.

`lo`/`hi` are the ends of the coverage ramp. Widening the gap keeps the
original's tonal variation (gradients survive as grey); narrowing it flattens
everything to the same white. Flat is usually right -- these are logos, not
pictures -- but flattening too hard closes up fine knocked-out type.

CROPPING, AND THE ONE FILE THAT NEEDS IT
`crop` is only for a mark that ships inside a photograph. InfoComm 2025 / SCN is
a badge centred on a stock photo of gears and technicians; no threshold turns a
photograph into line art, so the badge is cut out of it and the photo discarded.
That changes the tile from landscape to portrait, which is why awards.ts carries
different dimensions for it than the colour original. Cropped files are trimmed
of transparent margin and rescaled to 168px tall; everything else keeps its
canvas, so the relative sizes across the strip are the ones already signed off.

OUTPUT
Greyscale+alpha PNGs (mode LA). Every pixel is white, so the colour channels are
three copies of the same 255 -- LA stores it once and the mono set comes out
smaller than the colour set it replaces.

Usage: python3 scripts/awards-mono.py [--check]
       --check exits non-zero if any output is missing or older than its source.
"""

import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "public" / "awards"
OUT = SRC / "mono"


def ink(a, lo=0.12, hi=0.55):
    """Distance from white: dark and saturated go white, near-white drops out."""
    rgb, alpha = a[..., :3], a[..., 3]
    return np.clip(((1.0 - rgb.min(axis=2)) - lo) / (hi - lo), 0, 1) * alpha


def light(a, lo=0.58, hi=0.88, key=None):
    """Luminance: light artwork survives, a dark or saturated ground does not."""
    rgb, alpha = a[..., :3], a[..., 3]
    lum = rgb[..., 0] * 0.2126 + rgb[..., 1] * 0.7152 + rgb[..., 2] * 0.0722
    cov = np.clip((lum - lo) / (hi - lo), 0, 1)
    if key:
        r, g, b = key
        cov = np.where(
            (rgb[..., 0] > r) & (rgb[..., 1] > g) & (rgb[..., 2] < b), 1.0, cov
        )
    return cov * alpha


def warmth(a, width):
    """How far towards red of blue -- see `warm` above. 0 kills a blue ground."""
    rgb = a[..., :3]
    return np.clip((rgb[..., 0] - rgb[..., 2]) / width, 0, 1)


MODES = {"ink": ink, "light": light}

# name: how to convert it. Anything not listed here is not in the strip.
RECIPES = {
    "av-technology-2020-award": {"mode": "ink"},
    # The trophy is a rendered object rather than a mark, so it converts to a
    # silhouette however it is thresholded. A slightly raised floor drops the
    # hatching inside the certificate without closing up the type over it.
    "cio-education-tech-provider": {"mode": "ink", "lo": 0.18},
    "deloitte-technology-fast-500-2020": {"mode": "ink"},
    "infocomm-2020-award": {"mode": "ink"},
    # Gradient ground, white type, yellow "AV" -- see `light` and `key` above.
    "infocomm-2025-avtech-best-in-show": {
        "mode": "light",
        "lo": 0.72,
        "hi": 0.92,
        "key": (0.65, 0.50, 0.45),
    },
    # The badge cut out of its stock photo -- see "CROPPING" and `warm` above.
    # The middle band is the year: red on gold, two colours `ink` cannot tell
    # apart, so that strip switches to luminance and knocks "2025" out of the
    # disc instead of dissolving into it.
    "infocomm-2025-scn-installation-product": {
        "crop": (104, 4, 216, 164),
        "warm": 0.10,
        "bands": [
            {"y": (0, 88), "mode": "ink", "lo": 0.10, "hi": 0.30},
            {"y": (88, 120), "mode": "light", "lo": 0.40, "hi": 0.66},
            {"y": (120, 160), "mode": "ink", "lo": 0.10, "hi": 0.30},
        ],
    },
    # Red panel over black panel -- see `bands` above. The seam is at y=106.
    "ise-2020-av-technology-award": {
        "bands": [
            {"y": (0, 106), "mode": "ink"},
            {"y": (106, 168), "mode": "light", "lo": 0.18, "hi": 0.45},
        ]
    },
    "ise-2020-installation-award": {
        "bands": [
            {"y": (0, 106), "mode": "ink"},
            {"y": (106, 168), "mode": "light", "lo": 0.18, "hi": 0.45},
        ]
    },
    "ise-2021-tnt-winner": {"mode": "ink"},
    "ise-2025-tnt-winner": {"mode": "ink"},
    "proav-power-20": {"mode": "ink"},
    "scn-award-winner": {"mode": "ink"},
    "scn-install-of-the-year-2020": {"mode": "ink"},
    "smartbrief-award": {"mode": "ink"},
}

# Already white artwork on a transparent ground: it is the reference the rest of
# the strip is being made to match, so it is served from public/awards/ as it
# always was rather than copied in here. A second copy is a second thing to keep
# in step with the first.
REFERENCE = "infocomm-2026-best-of-show"


def convert(name, recipe):
    im = Image.open(SRC / f"{name}.png").convert("RGBA")
    crop = recipe.get("crop")
    if crop:
        im = im.crop(crop)
    a = np.asarray(im).astype(np.float32) / 255.0

    bands = recipe.get("bands")
    if bands:
        cov = np.zeros(a.shape[:2], np.float32)
        for band in bands:
            y0, y1 = band["y"]
            params = {k: v for k, v in band.items() if k not in ("y", "mode")}
            cov[y0:y1] = MODES[band["mode"]](a[y0:y1], **params)
    else:
        skip = ("mode", "crop", "warm")
        params = {k: v for k, v in recipe.items() if k not in skip}
        cov = MODES[recipe["mode"]](a, **params)

    if "warm" in recipe:
        cov = cov * warmth(a, recipe["warm"])

    la = np.zeros(a.shape[:2] + (2,), np.uint8)
    la[..., 0] = 255
    la[..., 1] = (np.clip(cov, 0, 1) * 255).astype(np.uint8)
    out = Image.fromarray(la, "LA")

    if crop:
        box = out.split()[1].point(lambda v: 255 if v > 8 else 0).getbbox()
        if box:
            out = out.crop(box)
        out = out.resize((max(1, round(out.width * 168 / out.height)), 168), Image.LANCZOS)
    return out


def main(check=False):
    missing = []
    OUT.mkdir(exist_ok=True)
    for name, recipe in RECIPES.items():
        src, dst = SRC / f"{name}.png", OUT / f"{name}.png"
        if not src.exists():
            print(f"[awards-mono] MISSING SOURCE {src.relative_to(ROOT)}", file=sys.stderr)
            missing.append(name)
            continue
        if check:
            if not dst.exists() or dst.stat().st_mtime < src.stat().st_mtime:
                missing.append(name)
            continue
        img = convert(name, recipe)
        img.save(dst, optimize=True)
        print(f"[awards-mono] {dst.relative_to(ROOT)}  {img.width}x{img.height}")

    stray = {p.stem for p in OUT.glob("*.png")} - set(RECIPES) if OUT.exists() else set()
    for name in sorted(stray):
        print(f"[awards-mono] STRAY (not in RECIPES): mono/{name}.png", file=sys.stderr)

    if check and missing:
        print(f"[awards-mono] stale or missing: {', '.join(missing)}", file=sys.stderr)
        return 1
    if missing:
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main(check="--check" in sys.argv))
