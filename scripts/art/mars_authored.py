"""Mars: Signal Siege — pixel maps for the three hand-authored enemies.

The group sheets are painterly renders of orange-armoured machines lit with
cyan and acid green. The first pass at these three was drawn in flat purple
with stick legs, so they read as a different game's placeholder art sitting in
the middle of the roster. These maps are built from the same palette and the
same light direction (top-left key, cyan rim from the creature's own glow) so
they belong to the sector art rather than merely coexisting with it.

Each map is one animation frame. `.` is transparent; every other glyph indexes
PALETTE. Frames of one creature must share a width and height.
"""

PALETTE = {
    "K": "#14101e",   # outline, near-black violet
    "S": "#3a2436",   # deep shadow / underside
    "B": "#7a3418",   # dark orange
    "O": "#c05a24",   # mid orange, the carapace body
    "L": "#ef9440",   # lit orange
    "H": "#ffd08a",   # specular highlight
    "N": "#26304c",   # navy plate
    "M": "#3f4c70",   # mid navy
    "C": "#35d8d0",   # cyan glow
    "G": "#8ff8f0",   # bright cyan core
    "A": "#7ef04a",   # acid green tell
    "R": "#ff7a2a",   # thruster / muzzle heat
}

# ---------------------------------------------------------------- crawler
# A low armoured mite: three overlapping carapace domes, a wedge head with a
# cyan eye band at the right (the sheet's native facing), a raised tail barb,
# and six legs that carry the walk. Kept to 13px tall because its whole job in
# a level is to be the thing you cannot shoot over while crouched.

CRAWLER = [
    # frame 0
    """
..........................
.KK.......................
KGSK......................
KCSK...KKK....KKK.........
KOSK..KOLLK..KOLLK...KKKK.
.KOKKKOLHHLKKOLHHLKKKOLLK.
..KOLLOLHOOLOLHOOLOLOLGGLK
..KOOOBOOOOBOOOOBOOOOOGGOK
..KNNNNNNNNNNNNNNNNNNNNNOK
..KMSNNMMNNMMNNMMNNMMNNSMK
...KK.KK...KK...KK...KK.K.
....K..K....K....K....K...
...KK..KK...KK...KK...KK..
""",
    # frame 1 — legs mid-stride, carapace settles one pixel
    """
..........................
.KK.......................
KGSK......................
KCSK...KKK....KKK.........
KOSK..KOLLK..KOLLK...KKKK.
.KOKKKOLHHLKKOLHHLKKKOLLK.
..KOLLOLHOOLOLHOOLOLOLGGLK
..KOOOBOOOOBOOOOBOOOOOGGOK
..KNNNNNNNNNNNNNNNNNNNNNOK
..KMSNNMMNNMMNNMMNNMMNNSMK
...K...K....K....K....K.K.
..KK...KK...KK...KK...KK..
..K.....K....K....K....K..
""",
    # frame 2 — opposite phase
    """
..........................
.KK.......................
KGSK......................
KCSK...KKK....KKK.........
KOSK..KOLLK..KOLLK...KKKK.
.KOKKKOLHHLKKOLHHLKKKOLLK.
..KOLLOLHOOLOLHOOLOLOLGGLK
..KOOOBOOOOBOOOOBOOOOOGGOK
..KNNNNNNNNNNNNNNNNNNNNNOK
..KMSNNMMNNMMNNMMNNMMNNSMK
...KK.KK...KK...KK...KK.K.
...K...K....K....K....K...
..KK..KK...KK...KK...KK...
""",
    # frame 3
    """
..........................
.KK.......................
KGSK......................
KCSK...KKK....KKK.........
KOSK..KOLLK..KOLLK...KKKK.
.KOKKKOLHHLKKOLHHLKKKOLLK.
..KOLLOLHOOLOLHOOLOLOLGGLK
..KOOOBOOOOBOOOOBOOOOOGGOK
..KNNNNNNNNNNNNNNNNNNNNNOK
..KMSNNMMNNMMNNMMNNMMNNSMK
...K..KK...KK...KK...KK.K.
...KK..K....K....K....K...
....K..KK...KK...KK...KK..
""",
]

# ---------------------------------------------------------------- wasp
# A hovering gun-drone: armoured orange shell, navy sensor chin with a cyan
# lens, two counter-rotating blades whose blur alternates, and a pair of stub
# thrusters. The rotor is the one place detached pixels are deliberate, which
# is why the sheet is flagged allowDetached for the atlas checker.

WASP = [
    """
....K......K....
...KGK....KGK...
..KKCKKKKKKCKK..
...KKKKKKKKKK...
.....KKOOKK.....
....KOLHHLOK....
...KOLHOOHLOK...
..KOLHOOOOHLOK..
..KOLOOOOOOLOK..
..KONNNNNNNNOK..
..KNMGGGGGGMNK..
..KNMGCCCCGMNK..
...KNMMMMMMNK...
....KKNNNNKK....
.....K.KK.K.....
.....R.RR.R.....
""",
    """
..KK........KK..
.KGGK......KGGK.
..KCKKKKKKKKCK..
...KKKKKKKKKK...
.....KKOOKK.....
....KOLHHLOK....
...KOLHOOHLOK...
..KOLHOOOOHLOK..
..KOLOOOOOOLOK..
..KONNNNNNNNOK..
..KNMGGGGGGMNK..
..KNMGCCCCGMNK..
...KNMMMMMMNK...
....KKNNNNKK....
.....K.KK.K.....
.....R.RR.R.....
""",
    """
....K......K....
...KCK....KCK...
..KKGKKKKKKGKK..
...KKKKKKKKKK...
.....KKOOKK.....
....KOLHHLOK....
...KOLHOOHLOK...
..KOLHOOOOHLOK..
..KOLOOOOOOLOK..
..KONNNNNNNNOK..
..KNMGGGGGGMNK..
..KNMGCCCCGMNK..
...KNMMMMMMNK...
....KKNNNNKK....
.....K.KK.K.....
......R..R......
""",
    """
..KK........KK..
.KCCK......KCCK.
..KGKKKKKKKKGK..
...KKKKKKKKKK...
.....KKOOKK.....
....KOLHHLOK....
...KOLHOOHLOK...
..KOLHOOOOHLOK..
..KOLOOOOOOLOK..
..KONNNNNNNNOK..
..KNMGGGGGGMNK..
..KNMGCCCCGMNK..
...KNMMMMMMNK...
....KKNNNNKK....
.....K.KK.K.....
......R..R......
""",
]

# ---------------------------------------------------------------- canopy
# The paratroop canopy, drawn as its own actor rather than baked into the
# trooper frames: the trooper underneath is an ordinary trooper the moment it
# lands, and a canopy welded into its cells would have to be erased from every
# pose. It is seated at the bottom of its cell like everything else, so the
# game hangs it off the trooper's head with a bottom-centre origin.
#
# The dome is generated from a half-width profile rather than plotted by hand.
# A parachute is read almost entirely from the curve of its skirt, and the
# hand-plotted version came out reading as a table.

CANOPY_W, CANOPY_H = 48, 34
CANOPY_PROFILE = [3, 7, 11, 14, 16, 18, 19, 20, 21, 22, 22, 23, 23]
CANOPY_SEAMS = (-0.78, -0.46, -0.15, 0.15, 0.46, 0.78)


def build_canopy(sway):
    """One canopy frame. `sway` swings the HARNESS under a fixed dome, which is
    what a descent actually looks like — the canopy holds the air and the load
    below it moves. Rocking the dome instead made the whole rig slide sideways.

    Sized against the trooper hanging under it, not against the cell it used to
    share: at 26 px it was half the width of a 64 px soldier, which is not how a
    parachute looks and is why the descent read as a prop. The first version was
    also too shallow — a dome that reaches full width in three rows is an awning
    — so the profile now spends thirteen rows getting there.
    """
    import math
    w, h, cx = CANOPY_W, CANOPY_H, 23
    g = [["." for _ in range(w)] for _ in range(h)]

    for i, hw in enumerate(CANOPY_PROFILE):
        prev = CANOPY_PROFILE[i - 1] if i else -1
        for x in range(cx - hw, cx + hw + 1):
            if not (0 <= x < w):
                continue
            n = (x - cx) / hw
            if x in (cx - hw, cx + hw) or i == 0 or abs(x - cx) > prev + 1:
                c = "K"                                   # silhouette
            elif i <= 2:
                c = "H" if n < 0.15 else "L"              # key light, top-left
            elif i <= 5:
                c = "H" if n < -0.55 else ("L" if n < 0.2 else "O")
            elif i <= 9:
                c = "L" if n < -0.6 else ("O" if n < 0.35 else "B")
            else:
                c = "O" if n < -0.4 else "B"
            g[i][x] = c

    # Gore seams. Six panels is what stops the dome reading as one balloon.
    for sx in CANOPY_SEAMS:
        for i in range(3, len(CANOPY_PROFILE)):
            x = cx + int(round(sx * CANOPY_PROFILE[i]))
            if 0 <= x < w and g[i][x] not in (".", "K"):
                g[i][x] = "S"

    # Scalloped skirt: the lip dips between gores instead of cutting straight.
    lip = len(CANOPY_PROFILE)
    for x in range(cx - 23, cx + 24):
        if not (0 <= x < w):
            continue
        n = (x - cx) / 23
        g[lip][x] = "K"
        if abs(math.sin(n * math.pi * 3.0)) > 0.62 and lip + 1 < h:
            g[lip + 1][x] = "K"

    def line(x0, y0, x1, y1):
        """Bresenham. Stepping the shroud lines row by row left them dotted,
        which at this size reads as damage rather than as rigging."""
        dx, dy = abs(x1 - x0), abs(y1 - y0)
        sx, sy = (1 if x0 < x1 else -1), (1 if y0 < y1 else -1)
        err, x, y = dx - dy, x0, y0
        while True:
            if 0 <= x < w and 0 <= y < h and g[y][x] == ".":
                g[y][x] = "K"
            if x == x1 and y == y1:
                break
            e2 = 2 * err
            if e2 > -dy:
                err -= dy
                x += sx
            if e2 < dx:
                err += dx
                y += sy

    hx = 23 + sway
    for ax in (cx - 22, cx - 13, cx - 5, cx + 5, cx + 13, cx + 22):
        line(ax, lip + 2, hx, h - 2)
    g[h - 1][hx] = "K"

    return "\n".join("".join(r) for r in g)


# ---------------------------------------------------------------- sentinel
# A floating shield node. Its four frames ARE the telegraph — a ring opening
# outward — so the player reads the shot coming instead of being hit by a
# frame swap. Redrawn alongside the crawler and the drone for the same reason:
# the first pass was flat purple, and it was the only thing on screen that did
# not belong to the sector's palette.

SENTINEL_BODY = """
....................
....................
....................
....................
....................
.......KKKKKK.......
.....KKOLLLLOKK.....
....KOLHHHHHHLOK....
...KOLHOOOOOOHLOK...
..KOLHOOGGGGOOHLOK..
..KOLHOOGCCGOOHLOK..
..KOLHOOGGGGOOHLOK..
..KOLHOOOOOOOOHLOK..
...KOLLOOOOOOLLOK...
....KKNNNNNNNNKK....
...KNMMGGGGGGMMNK...
...KNMMMMMMMMMMNK...
....KNNNNNNNNNNK....
.....KK.KKKK.KK.....
......K.K..K.K......
......K.K..K.K......
.....KK...KK...KK...
"""

# Row 0-4 of each charge frame. Everything below is the body, unchanged.
SENTINEL_ARCS = [
    ["....................", "....................", "....................",
     "....................", "...................."],
    ["....................", "....................", "....................",
     "........KCCK........", "...................."],
    ["....................", "....................", ".......KCCCCK.......",
     "......KCGGGGCK......", "......KC....CK......"],
    ["....................", ".....KKCCCCCCKK.....", "...KCCGGGGGGGGCCK...",
     "..KCGG........GGCK..", "..KC............CK.."],
]


def build_sentinel():
    body = strip(SENTINEL_BODY)
    out = []
    for arc in SENTINEL_ARCS:
        rows = list(body)
        for y, r in enumerate(arc):
            rows[y] = "".join(a if a != "." else b for a, b in zip(r, rows[y]))
        out.append("\n".join(rows))
    return out



def render(frames, path, scale=1):
    """Preview one creature's frames side by side, so a map can be judged
    before it is committed to an Aseprite file."""
    from PIL import Image
    h = len(strip(frames[0]))
    w = max(len(r) for f in frames for r in strip(f))
    img = Image.new("RGBA", (w * len(frames), h), (0, 0, 0, 0))
    for i, f in enumerate(frames):
        for y, row in enumerate(strip(f)):
            for x, ch in enumerate(row):
                if ch == ".":
                    continue
                c = PALETTE[ch]
                img.putpixel((i * w + x, y),
                             (int(c[1:3], 16), int(c[3:5], 16), int(c[5:7], 16), 255))
    if scale > 1:
        img = img.resize((img.width * scale, img.height * scale), Image.NEAREST)
    img.save(path)
    return w, h


def strip(frame):
    return [r for r in frame.split("\n") if r]


def pixels(frame):
    """The map as an Aseprite draw_pixels batch."""
    out = []
    for y, row in enumerate(strip(frame)):
        for x, ch in enumerate(row):
            if ch != ".":
                out.append({"x": x, "y": y, "color": PALETTE[ch]})
    return out


# Built last: the maps above are assembled with strip(), which is defined
# further down this file.
SENTINEL = build_sentinel()
CANOPY = [build_canopy(-2), build_canopy(2)]
