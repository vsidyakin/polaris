"""Emit src/data/skymap404.ts from out.json (written by gen.py).

Two jobs beyond formatting:

1. Figure membership. A star that a constellation line actually passes through
   should read brighter than the anonymous field around it. d3-celestial's line
   vertices sit on real stars, so we match each vertex to the nearest HYG star
   and flag it. Anything unmatched stays field.

2. Label placement. A constellation name parked nearer a neighbour's stars than
   its own reads as a mislabel, which is worse than no label. Candidates are
   scored against stars, lines and already-placed labels, and hard-rejected
   whenever another figure's stars are closer than the label's own.
"""

import json, math

d = json.load(open("out.json"))
# Must match gen.py exactly - see the note on K there.
ROT, K, OFFY = 45.0, 26.0, 0.0


def proj(ra, dec):
    z = math.radians(90 - dec)
    r = K * math.tan(z / 2)
    t = math.radians(ra * 15 + ROT)
    return 50 + r * math.cos(t), 50 + OFFY + r * math.sin(t)


stars = d["stars"]
pts = [proj(s["ra"], s["dec"]) for s in stars]

# ---------------------------------------------------------------- membership
# Angular separation, small-angle: RA differences shrink by cos(dec).
def sep(ra1, dec1, ra2, dec2):
    dd = dec1 - dec2
    dr = (ra1 - ra2) * 15.0 * math.cos(math.radians((dec1 + dec2) / 2))
    return math.hypot(dd, dr)


member = [False] * len(stars)
matched = 0
for f in d["figs"]:
    for seg in f["segs"]:
        for ra, dec in seg:
            best, bi = 1e9, -1
            for i, s in enumerate(stars):
                if abs(s["dec"] - dec) > 1.2:
                    continue
                sp = sep(s["ra"], s["dec"], ra, dec)
                if sp < best:
                    best, bi = sp, i
            if bi >= 0 and best < 0.6:  # degrees
                if not member[bi]:
                    matched += 1
                member[bi] = True
print("figure-member stars:", matched, "of", len(stars))

polaris = next((i for i, s in enumerate(stars) if s["n"] == "Polaris"), -1)
print("polaris index:", polaris, "at", [round(v, 2) for v in pts[polaris]])

# ------------------------------------------------------------------- labels
# Per-figure vertex clouds, so a candidate can be tested against its own
# constellation and against everyone else's separately.
own = {}
segpts = []
for f in d["figs"]:
    v = []
    for seg in f["segs"]:
        v += [proj(ra, dec) for ra, dec in seg]
    own[f["c"]] = v
    segpts += v

# Names that need a hand: the algorithm optimises for clearance, which is not
# always the same as reading correctly.
FORCE_TWO_LINE = {"UMi", "CMi", "CMa", "CVn", "CrB", "LMi", "Com"}
PREFER_UP = {"UMa"}  # user call: the name belongs above the figure


def boxes(t, two):
    """Text lines and the box they occupy, in chart units."""
    if two and " " in t:
        a, b = t.split(" ", 1)
        return [a, b], max(len(a), len(b)) * 0.95 + 1.4, 5.4
    return [t], len(t) * 0.95 + 1.4, 2.9


placed = []
labs = []
seen = set()
# Long names first: they are the hardest to fit, so they get first pick.
for l in sorted(d["labs"], key=lambda l: -len(l["t"])):
    cid = l["c"]
    # Serpens ships as two figures under one name; one name on the card.
    if l["t"] in seen:
        continue
    mine = own.get(cid, [])
    if not mine:
        continue
    vis = [p for p in mine if 1 < p[0] < 99 and 1 < p[1] < 99]
    if len(vis) < 2:
        continue
    theirs = [p for c, v in own.items() if c != cid for p in v]
    x0 = sum(p[0] for p in vis) / len(vis)
    y0 = sum(p[1] for p in vis) / len(vis)

    best = None
    for two in ((True,) if cid in FORCE_TWO_LINE else (False, True)):
        lines, w, h = boxes(l["t"], two)
        up = cid in PREFER_UP
        # "above" is a half-plane, not a bearing: the sky is too crowded to
        # push a name clear of a big figure without landing it on a neighbour
        angles = range(200, 341, 10) if up else range(0, 360, 15)
        for rad in (2, 3, 4.2, 5.4, 6.6, 8, 9.5) if up else (0, 1.8, 2.8, 3.8, 4.8, 6, 7.5, 9):
            for ang in angles:
                x = x0 + rad * math.cos(math.radians(ang))
                y = y0 + rad * math.sin(math.radians(ang))
                # the card crops the square, so keep names off the very edge
                if not (5 < x < 95 and 4 < y < 96):
                    continue
                # Nearest star of my own figure vs nearest of anyone else's.
                dm = min(math.hypot(px - x, py - y) for px, py in mine)
                dt = min(math.hypot(px - x, py - y) for px, py in theirs) if theirs else 1e9
                # Reads as the neighbour's name: reject. The 0.8 leaves a
                # little slack — figures interlock, and a name is more useful
                # slightly contested than dropped for being a hair off.
                if dt < dm * 0.8:
                    continue
                if up and y > y0:  # asked for above; stay above
                    continue
                cost = 0.0
                for px, py in pts:
                    if abs(px - x) < w / 2 + 0.7 and abs(py - y) < h / 2 + 0.7:
                        cost += 3
                for px, py in segpts:
                    if abs(px - x) < w / 2 and abs(py - y) < h / 2:
                        cost += 2
                for lx, ly, lw, lh in placed:
                    if abs(lx - x) < (lw + w) / 2 + 1 and abs(ly - y) < (lh + h) / 2 + 0.8:
                        cost += 10
                cost += rad * 0.3  # stay near the figure
                cost += max(0.0, 3.6 - (dt - dm)) * 0.5  # reward unambiguity
                if two:
                    cost += 0.6  # one line is tidier, all else equal
                if best is None or cost < best[0]:
                    best = (cost, x, y, lines, w, h)
            if best and best[0] <= 0.6:
                break
        if best and best[0] <= 1.5:
            break

    if best and best[0] < 11:
        _, x, y, lines, w, h = best
        placed.append((x, y, w, h))
        seen.add(l["t"])
        labs.append({"t": lines, "x": round(x, 2), "y": round(y, 2)})

print("labels placed:", len(labs), "of", len(d["labs"]))

# --------------------------------------------------------------------- emit
def sf(s, i):
    n = f', n: "{s["n"]}"' if s["n"] else ""
    f = ", f: 1" if member[i] else ""
    return f'{{ ra: {s["ra"]}, dec: {s["dec"]}, m: {s["m"]}{n}{f} }}'


lines_out = []
for f in d["figs"]:
    for seg in f["segs"]:
        lines_out.append("[" + ", ".join(f"[{ra}, {dec}]" for ra, dec in seg) + "]")

hdr = (
    '''/* The 404 sky — generated, not hand-written.
 *
 * Source data:
 *   • Stars — HYG database v4.1 (astronexus/HYG-Database), a merge of
 *     Hipparcos, Yale Bright Star and Gliese. Filtered to visual magnitude
 *     <= %(mag)s and declination >= %(dec)s, then to what this card can show.
 *   • Constellation figures — the IAU-derived line set shipped with
 *     d3-celestial (ofrohn/d3-celestial, constellations.lines.json).
 *
 * Nothing here was typed from memory: `scripts/skymap-gen` fetched both
 * catalogues and emitted this file, so a wrong star is a wrong catalogue row
 * rather than a wrong recollection.
 *
 * Projection: stereographic about the north celestial pole —
 *     r = K · tan(z/2),  z = 90° − dec       θ = RA° + ROT
 * fitted to a reference chart from six labelled stars (Merak, Alkaid, Deneb,
 * Caph, Regulus, Capella), which all agreed on ROT within a degree.
 *
 * Coordinates are a 0-100 square drawn with preserveAspectRatio slice, so the
 * card crops the circle instead of squashing it. Squashing it would make every
 * constellation wrong.
 */

const ROT = %(rot)s;
const K = %(k)s;
/* Vertical shift of the chart centre. Zero: Polaris sits dead centre, which is
 * where the pole belongs on a polar chart. It was lifted while the copy panel
 * occupied the bottom of the card; the panel now sits top-left instead. */
const OFFY = %(offy)s;

export interface SkyStar {
  /** right ascension, hours (J2000) */
  ra: number;
  /** declination, degrees (J2000) */
  dec: number;
  /** visual magnitude */
  m: number;
  /** proper name where the catalogue carries one */
  n?: string;
  /** 1 when a constellation line runs through this star, so it can be drawn
   *  brighter than the anonymous field and move on the figures' parallax
   *  layer rather than drifting off its own constellation */
  f?: 1;
}
'''
    % {"mag": 4.8, "dec": -50, "rot": ROT, "k": K, "offy": OFFY}
)

body = hdr + "\n/** %d stars, brightest first. */\nexport const STARS: SkyStar[] = [\n  " % len(stars)
body += ",\n  ".join(sf(s, i) for i, s in enumerate(stars)) + ",\n];\n\n"
body += (
    "/** Constellation figures as [ra, dec] runs — %d polylines. */\nexport const FIGURES: [number, number][][] = [\n  "
    % len(lines_out)
)
body += ",\n  ".join(lines_out) + ",\n];\n\n"
body += (
    "/** Names, placed by the generator: each one is nearer its own figure's\n"
    " *  stars than any neighbour's, or it is not drawn at all. `t` is one\n"
    " *  entry per rendered line. */\nexport const LABELS: { x: number; y: number; t: string[] }[] = [\n  "
)
body += (
    ",\n  ".join(
        '{ x: %s, y: %s, t: [%s] }' % (l["x"], l["y"], ", ".join('"%s"' % s for s in l["t"]))
        for l in labs
    )
    + ",\n];\n\n"
)
body += '''export function project(ra: number, dec: number): { x: number; y: number } {
  const z = ((90 - dec) * Math.PI) / 180;
  const r = K * Math.tan(z / 2);
  const t = ((ra * 15 + ROT) * Math.PI) / 180;
  return { x: 50 + r * Math.cos(t), y: 50 + OFFY + r * Math.sin(t) };
}

/** The celestial equator: dec 0, so exactly r = K about the pole. */
export const EQUATOR = { cx: 50, cy: 50 + OFFY, r: K };
'''
open(
    "/sessions/peaceful-optimistic-gauss/mnt/Website/git website/polaris-website/src/data/skymap404.ts",
    "w",
    newline="",
).write(body)
print("emitted: stars", len(stars), "polylines", len(lines_out), "labels", len(labs))
