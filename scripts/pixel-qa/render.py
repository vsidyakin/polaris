"""render.py -- turn the string-art back into PNGs so it can be eyeballed.

Nearest-neighbour only, integer scaling only -- the same rules the engine uses
(imageSmoothingEnabled = false, 220x130 blitted to 880x520 at exactly 4x).

Contact sheets are drawn on PAL[0], the game's void colour, so a sprite that
sinks into the background here sinks into it in the game too.

Usage
-----
    # one sprite, frame 0, at 1x and 4x
    python3 render.py --sprite player_idle

    # every frame of a sprite
    python3 render.py --sprite e_p_side --all-frames --scale 4

    # contact sheet of everything, grouped by name prefix, 4x
    python3 render.py --sheet ../../..//out/sprite-contact-sheet.png

    # only some sprites
    python3 render.py --sheet out.png --filter e_p_

Options
    --repo PATH      repo root (default: two directories above this file)
    --out DIR        output directory for --sprite (default: ./out)
    --scale N        integer scale, default 4
    --sheet PATH     write a contact sheet here; splits into PATH-1.png,
                     PATH-2.png ... if one image would exceed --max-px
    --sheet-width N  sheet width in px, default 1800
    --max-px N       split threshold in px, default 4000
"""

from __future__ import annotations

import os
import sys

from PIL import Image, ImageDraw, ImageFont

import parse   # NB: read parse.LEGAL_CHARS / parse.CHAR_TO_INDEX through the
               # module, never `from parse import` them - refresh_pxc() rebinds
               # them at load time and a by-value import would miss the update.
from parse import (CHAR_TO_INDEX, TRANSPARENT, base_name, frame_size, load_all,
                   repo_root_default)

MAGENTA = (255, 0, 255, 255)     # a char with no palette entry -- loud on purpose


def _rgba(hexcol: str):
    h = hexcol.lstrip("#")
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), 255)


def render_frame(frame, pal, scale: int = 1) -> Image.Image:
    """Render one frame to an RGBA image at an integer scale, nearest neighbour.

    Ragged frames are padded to the widest row with transparent pixels so a
    malformed sprite still renders (and its raggedness is visible).
    """
    if scale < 1 or int(scale) != scale:
        raise ValueError("scale must be a positive integer")
    w, h = frame_size(frame)
    img = Image.new("RGBA", (max(w, 1), max(h, 1)), (0, 0, 0, 0))
    px = img.load()
    lut = [_rgba(c) for c in pal]
    for y, row in enumerate(frame):
        for x, ch in enumerate(row):
            if ch == TRANSPARENT:
                continue
            idx = parse.CHAR_TO_INDEX.get(ch)
            px[x, y] = lut[idx] if (idx is not None and idx < len(lut)) else MAGENTA
    if scale != 1:
        img = img.resize((img.width * scale, img.height * scale), Image.NEAREST)
    return img


def render_sprite(art, pal, name, frame=0, scale=1) -> Image.Image:
    return render_frame(art[name]["frames"][frame], pal, scale)


# ---------------------------------------------------------------------------
# contact sheet
# ---------------------------------------------------------------------------
MISC_GROUP = "misc"
MIN_GROUP = 3        # groups smaller than this get folded into MISC_GROUP


def prefix_of(name: str) -> str:
    """Grouping key: the first name token, or the first two for the e_* store
    (so e_p_/e_t_/e_d_/e_c_/e_w_ each get their own band)."""
    bare = base_name(name)
    if bare.startswith("e_") and bare.count("_") >= 2:
        return "_".join(bare.split("_")[:2]) + "_"      # e_p_, e_t_, e_d_ ...
    return bare.split("_")[0] + "_" if "_" in bare else bare


def group_names(names):
    """name prefix -> [names], with tiny groups folded into 'misc'."""
    groups = {}
    for n in names:
        groups.setdefault(prefix_of(n), []).append(n)
    small = [g for g, v in groups.items() if len(v) < MIN_GROUP]
    if len(small) > 1:
        misc = []
        for g in small:
            misc.extend(groups.pop(g))
        groups[MISC_GROUP] = misc
    return groups


def _font():
    try:
        return ImageFont.load_default()
    except Exception:                                    # pragma: no cover
        return None


LABEL_H = 12
PAD = 8
GROUP_H = 22


def _cell_label(name: str) -> str:
    """'@EART6' (an EART6 override of an EGG_ART name) shows as a trailing *."""
    return name.replace("@EART6", "*")


def _label_px(text):
    """Width of the default bitmap font at 6px/char -- enough to keep labels
    from colliding without depending on font metrics."""
    return 6 * len(text) + 4


def _layout(names, art, scale, sheet_w):
    """Return a list of ("group", text, y) and ("cell", name, x, y, w, h)
    records, plus the total layout height."""
    groups = group_names(names)

    items = []
    y = PAD
    for g in sorted(groups):
        items.append(("group", g, y))
        y += GROUP_H
        x = PAD
        row_h = 0
        for n in sorted(groups[g]):
            fw, fh = frame_size(art[n]["frames"][0]) if art[n]["frames"] else (1, 1)
            cw = max(fw * scale, _label_px(_cell_label(n))) + PAD
            ch = fh * scale + LABEL_H + PAD
            if x + cw > sheet_w - PAD:
                x = PAD
                y += row_h
                row_h = 0
            items.append(("cell", n, x, y, cw, ch))
            x += cw
            row_h = max(row_h, ch)
        y += row_h + PAD
    return items, y


def contact_sheets(art, pal, names=None, scale=4, sheet_w=1800, max_px=4000):
    """Return a list of PIL images.  Splits when a page would exceed max_px."""
    names = sorted(names if names is not None else art)
    names = [n for n in names if art[n]["frames"]]
    items, total_h = _layout(names, art, scale, sheet_w)

    # Split on group boundaries so a group is never cut in half.  Heights are
    # measured relative to the top of the current page, not the whole layout.
    pages = []
    cur = []
    page_top = None
    page_bottom = 0
    for rec in items:
        kind = rec[0]
        top = rec[2] if kind == "group" else rec[3]
        bottom = (rec[2] + GROUP_H) if kind == "group" else (rec[3] + rec[5])
        if kind == "group" and cur and (page_bottom - page_top) > max_px - 400:
            pages.append(cur)
            cur, page_top, page_bottom = [], None, 0
        if page_top is None:
            page_top = top
        cur.append(rec)
        page_bottom = max(page_bottom, bottom)
    if cur:
        pages.append(cur)

    font = _font()
    bg = _rgba(pal[0])
    grid = _rgba(pal[2])
    text = _rgba(pal[7]) if len(pal) > 7 else (255, 255, 255, 255)
    dim = _rgba(pal[5]) if len(pal) > 5 else text

    out = []
    for page in pages:
        y0 = min((r[2] if r[0] == "group" else r[3]) for r in page) - PAD
        h = max((r[2] + GROUP_H if r[0] == "group" else r[3] + r[5])
                for r in page) + PAD - y0
        img = Image.new("RGBA", (sheet_w, max(h, 40)), bg)
        d = ImageDraw.Draw(img)
        for rec in page:
            if rec[0] == "group":
                _, g, y = rec
                d.text((PAD, y - y0 + 4), "%s" % g, fill=dim, font=font)
                d.line([(PAD, y - y0 + GROUP_H - 5),
                        (sheet_w - PAD, y - y0 + GROUP_H - 5)], fill=grid)
                continue
            _, name, x, y, cw, ch = rec
            spr = render_sprite(art, pal, name, 0, scale)
            img.alpha_composite(spr, (x, y - y0))
            d.text((x, y - y0 + ch - LABEL_H + 1), _cell_label(name),
                   fill=text, font=font)
        out.append(img)
    return out


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------
def main(argv):
    def opt(flag, default=None):
        if flag in argv:
            i = argv.index(flag)
            if i + 1 < len(argv):
                return argv[i + 1]
        for a in argv:
            if a.startswith(flag + "="):
                return a.split("=", 1)[1]
        return default

    root = opt("--repo", repo_root_default())
    scale = int(opt("--scale", "4"))
    out_dir = opt("--out", os.path.join(os.getcwd(), "out"))
    art, pal = load_all(root)

    sprite = opt("--sprite")
    sheet = opt("--sheet")
    flt = opt("--filter")

    if sprite:
        if sprite not in art:
            print("no such sprite: %s" % sprite, file=sys.stderr)
            return 2
        os.makedirs(out_dir, exist_ok=True)
        frames = range(len(art[sprite]["frames"])) if "--all-frames" in argv else [0]
        for fi in frames:
            for s in (1, scale):
                img = render_sprite(art, pal, sprite, fi, s)
                p = os.path.join(out_dir, "%s_f%d_%dx.png"
                                 % (sprite.replace("@", "-"), fi, s))
                img.save(p)
                print("wrote %s  (%dx%d)" % (p, img.width, img.height))
        return 0

    if sheet:
        names = [n for n in art if (flt in n if flt else True)]
        imgs = contact_sheets(art, pal, names, scale=scale,
                              sheet_w=int(opt("--sheet-width", "1800")),
                              max_px=int(opt("--max-px", "4000")))
        os.makedirs(os.path.dirname(os.path.abspath(sheet)) or ".", exist_ok=True)
        if len(imgs) == 1:
            imgs[0].save(sheet)
            print("wrote %s  (%dx%d)" % (sheet, imgs[0].width, imgs[0].height))
        else:
            stem, ext = os.path.splitext(sheet)
            for i, im in enumerate(imgs, 1):
                p = "%s-%d%s" % (stem, i, ext or ".png")
                im.save(p)
                print("wrote %s  (%dx%d)" % (p, im.width, im.height))
        return 0

    print(__doc__)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
