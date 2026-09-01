#!/usr/bin/env python3
"""Mars: Signal Siege — sprite atlas integrity check.

Runs against the *production* art in public/eggs/mars-signal-siege/art and the
atlas JSON that ships beside it. Every rule here exists because a build shipped
a sheet that broke it:

  FRACTIONAL_CELL  a 1024px sheet cut into 3 rows is 341.333px per cell, so
                   every row after the first samples a slice of its neighbour.
                   Phaser rounds differently than Canvas2D did, which is how a
                   "working" prototype sheet becomes a visible seam here.
  EDGE_BLEED       an opaque pixel touching a cell boundary will smear into the
                   adjacent cell under linear sampling and betray the atlas
                   rectangle at non-integer zoom.
  HALO             a pale fringe around the subject, left behind when art was
                   matted onto white before the alpha was cut. Reads as a white
                   aura in game.
  NO_OPAQUE        alpha never reaching 255 means the whole sprite is slightly
                   transparent — backgrounds ghost through the character.
  EMPTY_CELL       a declared frame with nothing in it: an animation that pops
                   to nothing for one frame.
  BASELINE_DRIFT   the subject's lowest opaque row moves between frames of a
                   walk/run cycle, which is what makes feet sink into the floor.
  PIVOT_DRIFT      the subject's horizontal centre of mass jumps between frames,
                   which is what makes a run cycle wobble.

The eight rules below were added after an audit found six defects that every
rule above passed. They are grouped by the question they answer.

  IS IT THE SAME CREATURE FROM FRAME TO FRAME?

  SCALE_DRIFT_WITHIN_TAG   two frames of one animation drawn at two scales.
  SCALE_DRIFT_ACROSS_ACTOR two animations of one actor drawn at two scales.
  DECLARED_HEIGHT_MISMATCH the actor is not the size the build says it is.
  PALETTE_INCOHERENCE      one actor, two gradings — "the color changes when he
                           stops".

  IS IT ALL THERE, AND NOTHING ELSE?

  DETACHED_MASS            ink that is not attached to the subject: a crumb of
                           the neighbouring master cell that survived the cut.
  FLOATING_SUBJECT         the subject is not standing on its own baseline,
                           usually because something else is.
  MASTER_CUT_CROSSING      the master a sheet was cut from cannot be cut on the
                           grid the build declares.

  IS THERE ENOUGH OF IT TO ANIMATE?

  CYCLE_FRAME_COUNT        a locomotion cycle with fewer than four frames reads
                           as a shuffle with a hitch, however good the frames.

Two of these read the manifest rather than the pixels, and that is deliberate.
The scale a frame was drawn at cannot be recovered from the finished sprite: a
run cycle's bounding box moves 16% between strides because the man crouches,
and a centipede's moves 40% because it rears, and neither is a defect. Only the
build knows which of those is a pose and which is a rescale, so the build writes
down the scale it used and these rules hold it to a single number per actor.
That is not self-certification — DECLARED_HEIGHT_MISMATCH measures the named
reference frame in the PNG, so a manifest that lies about the scale has to lie
about the pixels to match, and MASTER_CUT_CROSSING re-reads the masters from
disk. What the manifest buys is the ability to tell a pose from a mistake.

Exit code is non-zero if any ERROR-severity finding survives the suppression
list, so this is safe to wire into `pnpm test:mars`.
"""

from __future__ import annotations

import colorsys
import json
import os
import sys
from dataclasses import dataclass, field

try:
    from PIL import Image
except ImportError:  # pragma: no cover
    print("check-mars-sprite-atlases: Pillow is required (pip install Pillow)")
    sys.exit(2)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ART = os.path.join(ROOT, "public", "eggs", "mars-signal-siege", "art")
MANIFEST = os.path.join(ART, "atlases.json")
MASTERS = os.path.join(ROOT, "Game art files", "Mars Signal Siege", "source-local")

# A pixel counts as "opaque enough to matter" above this alpha.
SOLID = 24
# Halo detection: near-white, low-saturation pixels at the subject's edge.
HALO_MIN_LUMA = 232
HALO_MAX_SAT = 26
# Fraction of edge pixels that must be pale before we call it a matte.
HALO_EDGE_RATIO = 0.34
# Baseline / pivot drift tolerances, in pixels, within one animation tag.
BASELINE_TOLERANCE = 2
PIVOT_TOLERANCE = 6

# How far a component may sit from the main silhouette and still be part of it.
# Geometric, not size-based: the fragments that were getting through were 22-118
# px and 5-18% of the body, comfortably over the old "small enough to be debris"
# thresholds, and they were still a crumb of the cell next door. Distance is
# what actually distinguishes a foot from a fragment.
DETACHED_PAD = 4
# The subject stands on the baseline. One pixel of slack, for the boss breathing
# frame, which is its idle lifted by exactly that.
FLOAT_TOLERANCE = 1
# Frames of one tag share a scale exactly; the tolerance is for rounding.
SCALE_TOLERANCE_TAG = 0.04
# Tags of one actor may differ where the artwork forces it — Rook's prone master
# is drawn at less than half the resolution of his run master and no cell can
# reconcile the two — but not by more than this.
SCALE_TOLERANCE_ACTOR = 0.06
# Drawn height of the reference frame, against what the build said it would be.
HEIGHT_TOLERANCE = 1
# Colour coherence. The warm mass is the actor's armour and its identity; it is
# held tightly. The cool mass is lights, visors and trim, whose visible AREA
# swings hugely with the pose — a trooper turning to fire shows a backpack it
# was hiding — so it gets a weaker bound. Both are far tighter than the defect
# they exist for: Rook's three masters were graded 0.28 apart in saturation.
WARM_S_TOL, WARM_V_TOL = 0.06, 0.05
COOL_S_TOL, COOL_V_TOL = 0.10, 0.10
# Only lit pixels are measured. Shadow is where a painterly render's chroma
# noise lives, and how much of a sprite is in shadow is a fact about the pose.
LIT_V = 0.30
# Below this many pixels a mass is not a measurement of anything.
MASS_FLOOR = 200
# A locomotion cycle needs four beats: contact, down, pass, up. The prototype
# shipped six of Rook's eight run frames and it read as a shuffle with a hitch.
CYCLE_MIN_FRAMES = 4
# Tag names that claim to be locomotion.
CYCLE_SUFFIXES = ("run", "runfire", "walk")
# A master subject may not have more than this share of itself outside the cell
# its centre of mass falls in, or which cell owns it is a coin flip.
CUT_AMBIGUOUS = 0.25
@dataclass
class Finding:
    severity: str      # ERROR | WARN
    code: str
    sheet: str
    detail: str
    cell: str = ""


@dataclass
class Report:
    findings: list[Finding] = field(default_factory=list)
    checked: int = 0

    def add(self, severity, code, sheet, detail, cell=""):
        self.findings.append(Finding(severity, code, sheet, detail, cell))

    @property
    def errors(self):
        return [f for f in self.findings if f.severity == "ERROR"]


def cell_box(cols, rows, w, h, col, row):
    """Integer cell rect. Assumes the sheet divides evenly; FRACTIONAL_CELL
    reports it when it does not, and we floor so the check still runs."""
    cw, ch = w // cols, h // rows
    return (col * cw, row * ch, col * cw + cw, row * ch + ch)


def blobs(mask):
    """Connected opaque regions, largest first, as dicts of size/bbox/centroid.

    Run-length plus union-find rather than a flood fill per pixel. The flood
    fill is fine on a 96px cell and takes the best part of a minute on a
    1536x1024 master, and MASTER_CUT_CROSSING has to read seven of those.
    """
    w, h = mask.size
    px = mask.load()
    parent = []
    runs_by_row = []

    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    def union(a, b):
        ra, rb = find(a), find(b)
        if ra != rb:
            parent[max(ra, rb)] = min(ra, rb)

    for y in range(h):
        runs = []
        x = 0
        while x < w:
            if px[x, y]:
                x0 = x
                while x < w and px[x, y]:
                    x += 1
                idx = len(parent)
                parent.append(idx)
                runs.append((x0, x - 1, idx))
            else:
                x += 1
        if y and runs and runs_by_row[-1]:
            for a0, a1, ai in runs:
                for b0, b1, bi in runs_by_row[-1]:
                    if a0 <= b1 and b0 <= a1:
                        union(ai, bi)
        runs_by_row.append(runs)

    agg = {}
    for y, runs in enumerate(runs_by_row):
        for x0, x1, idx in runs:
            r = find(idx)
            a = agg.get(r)
            n = x1 - x0 + 1
            if a is None:
                agg[r] = {"n": n, "bbox": [x0, y, x1, y],
                          "sx": (x0 + x1) * n / 2.0, "sy": y * n}
            else:
                a["n"] += n
                bb = a["bbox"]
                bb[0] = min(bb[0], x0)
                bb[1] = min(bb[1], y)
                bb[2] = max(bb[2], x1)
                bb[3] = max(bb[3], y)
                a["sx"] += (x0 + x1) * n / 2.0
                a["sy"] += y * n
    out = []
    for a in agg.values():
        out.append({"n": a["n"], "bbox": tuple(a["bbox"]),
                    "cx": a["sx"] / a["n"], "cy": a["sy"] / a["n"]})
    out.sort(key=lambda c: -c["n"])
    return out


def bbox_gap(a, b):
    """Closest approach of two bounding boxes, in pixels; 0 if they overlap."""
    ax0, ay0, ax1, ay1 = a
    bx0, by0, bx1, by1 = b
    dx = max(0, bx0 - ax1, ax0 - bx1)
    dy = max(0, by0 - ay1, ay0 - by1)
    return max(dx, dy)


def detached_masses(bs, pad=DETACHED_PAD):
    """Components that are not part of the main silhouette.

    The rule this replaces asked whether a fragment was small — under 220px and
    under 4% of the body. Every fragment that mattered was over both: the crumbs
    the enemy sheets carried in from the master cut were 22-118px and 5-18% of
    the creature, and they sat on the ground line where they had the maximum
    possible effect, taking over the baseline and pushing the real creature into
    the air. Size never described the problem. Distance does: a foot is under
    the leg it belongs to, and a fragment of the cell next door is not.
    """
    if len(bs) < 2:
        return []
    main = bs[0]["bbox"]
    return [b for b in bs[1:] if bbox_gap(main, b["bbox"]) > pad]


def mass_means(cell, box=None):
    """Mean saturation and value of the lit warm and lit cool masses.

    Warm is the armour or carapace — every actor in this game is built on the
    same orange ramp — and it is the actor's identity. Cool is the under-suit,
    the visor and the indicator lamps.
    """
    px = cell.load()
    w, h = cell.size
    ws = wv = cs = cv = 0.0
    wn = cn = 0
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a < 200:
                continue
            hh, ss, vv = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            if vv < LIT_V:
                continue
            if (hh < 0.09 or hh > 0.93) and ss > 0.25:
                ws += ss
                wv += vv
                wn += 1
            elif 0.45 < hh < 0.75 and ss > 0.15:
                cs += ss
                cv += vv
                cn += 1
    return {"warm": (ws, wv, wn), "cool": (cs, cv, cn)}


def merge_means(parts):
    """Pool per-frame sums into one mean, or None if the sample is too thin."""
    out = {}
    for key in ("warm", "cool"):
        s = sum(p[key][0] for p in parts)
        v = sum(p[key][1] for p in parts)
        n = sum(p[key][2] for p in parts)
        out[key] = (s / n, v / n) if n >= MASS_FLOOR else None
    return out


def analyse_cell(im, box):
    """Return (bbox_of_opaque, edge_touch_flags, halo_ratio, max_alpha, blobs)."""
    cell = im.crop(box)
    alpha = cell.split()[-1]
    bbox = alpha.getbbox()
    if bbox is None:
        return None, None, 0.0, 0, []
    px = cell.load()
    cw, ch = cell.size
    mask = alpha.point(lambda a: 255 if a >= SOLID else 0)
    solid_bbox = mask.getbbox()
    if solid_bbox is None:
        return None, None, 0.0, alpha.getextrema()[1], []

    x0, y0, x1, y1 = solid_bbox
    touches = {
        "left": x0 <= 0,
        "top": y0 <= 0,
        "right": x1 >= cw,
        "bottom": y1 >= ch,
    }

    # Halo: sample opaque pixels that have a transparent neighbour (the rim).
    rim_total = rim_pale = 0
    for y in range(y0, min(y1, ch)):
        for x in range(x0, min(x1, cw)):
            r, g, b, a = px[x, y]
            if a < SOLID:
                continue
            edge = False
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < cw and 0 <= ny < ch:
                    if px[nx, ny][3] < SOLID:
                        edge = True
                        break
                else:
                    edge = True
                    break
            if not edge:
                continue
            rim_total += 1
            luma = 0.299 * r + 0.587 * g + 0.114 * b
            sat = max(r, g, b) - min(r, g, b)
            if luma >= HALO_MIN_LUMA and sat <= HALO_MAX_SAT:
                rim_pale += 1
    halo = (rim_pale / rim_total) if rim_total else 0.0
    return solid_bbox, touches, halo, alpha.getextrema()[1], blobs(mask)


def check_master_cuts(entry, rep: Report):
    """MASTER_CUT_CROSSING: can this sheet's master be cut on its own grid?

    The four enemy group sheets are 3x3 on a 1024px canvas and the artwork was
    never on that grid: ink crossed the row boundary in ten of the twelve
    boundary positions, so cutting there truncated helmets by 22-31px and
    antennae by up to 53, and dropped the neighbour's feet onto the ground line
    of the cell below. The build no longer cuts on the grid — it assigns each
    connected mass to the cell its centre of mass falls in — but that recovery
    has a limit. A subject with a quarter of itself in the next cell could be
    claimed by either, and then a whole creature moves one cell along and the
    roster silently renames itself.

    So this does not forbid ink on the cut line, which would fail on masters the
    build handles correctly today. It forbids a subject that no rule could
    assign, and an empty cell, which is the other way a re-authored master
    breaks the grid.
    """
    for spec in entry.get("masters", []):
        path = os.path.join(MASTERS, spec["file"])
        if not os.path.exists(path):
            rep.add("WARN", "MASTER_CUT_CROSSING", entry["file"],
                    f"master {spec['file']} is not in the working tree; "
                    f"the cut cannot be verified")
            continue
        im = Image.open(path).convert("RGBA")
        mask = im.split()[-1].point(lambda v: 255 if v >= SOLID else 0)
        cols, rows = spec["cols"], spec["rows"]
        w, h = im.size
        cw, ch = w / cols, h / rows
        seen = set()
        for b in blobs(mask):
            if b["n"] < 4:
                continue
            col = min(cols - 1, int(b["cx"] // cw))
            row = min(rows - 1, int(b["cy"] // ch))
            if (col, row) in seen:
                continue                      # a smaller part of the same cell
            seen.add((col, row))
            x0, y0, x1, y1 = b["bbox"]
            nx0, ny0 = round(col * cw), round(row * ch)
            nx1, ny1 = round((col + 1) * cw), round((row + 1) * ch)
            # Share of the bounding box outside the nominal cell, which
            # over-estimates the share of the mass and so errs toward reporting.
            over = 0.0
            span = max(1, (x1 - x0 + 1) * (y1 - y0 + 1))
            ox = max(0, min(x1, nx1 - 1) - max(x0, nx0) + 1)
            oy = max(0, min(y1, ny1 - 1) - max(y0, ny0) + 1)
            over = 1.0 - (ox * oy) / span
            if over > CUT_AMBIGUOUS:
                rep.add("ERROR", "MASTER_CUT_CROSSING", entry["file"],
                        f"{spec['file']} cell c{col}r{row}: {over*100:.0f}% of "
                        f"the subject lies outside the cell its centre falls "
                        f"in, so which cell owns it is a coin flip")
        for row in range(rows):
            for col in range(cols):
                if (col, row) not in seen:
                    rep.add("ERROR", "MASTER_CUT_CROSSING", entry["file"],
                            f"{spec['file']} cell c{col}r{row} holds no subject; "
                            f"the sheet is not the {cols}x{rows} grid declared")
def check_sheet(entry, rep: Report):
    name = entry["file"]
    path = os.path.join(ART, name)
    if not os.path.exists(path):
        rep.add("ERROR", "MISSING", name, "declared in atlases.json but not on disk")
        return
    im = Image.open(path).convert("RGBA")
    w, h = im.size
    cols, rows = entry["cols"], entry["rows"]

    if w % cols or h % rows:
        rep.add(
            "ERROR", "FRACTIONAL_CELL", name,
            f"{w}x{h} does not divide evenly into {cols}x{rows} "
            f"({w/cols:.2f}x{h/rows:.2f} per cell); rows after the first sample "
            f"their neighbour",
        )

    # The declared cell size is what the game hands Phaser as frameWidth and
    # frameHeight, and what socketFor() measures against. If it disagrees with
    # the PNG, the frame grid and the socket table desynchronise with no other
    # signal — the sheet still loads, it just draws the wrong rectangles.
    if entry.get("cellW") and entry["cellW"] * cols != w:
        rep.add("ERROR", "CELL_MISMATCH", name,
                f"declared cellW {entry['cellW']} x {cols} cols = "
                f"{entry['cellW'] * cols}, but the image is {w} wide")
    if entry.get("cellH") and entry["cellH"] * rows != h:
        rep.add("ERROR", "CELL_MISMATCH", name,
                f"declared cellH {entry['cellH']} x {rows} rows = "
                f"{entry['cellH'] * rows}, but the image is {h} tall")

    # The baseline is what every ground-anchored sprite is positioned by.
    baseline = entry.get("baseline")
    if baseline is not None and not (0 < baseline <= entry.get("cellH", h)):
        rep.add("ERROR", "BAD_BASELINE", name,
                f"baseline {baseline} is outside the cell")

    sheet_max_alpha = 0
    baselines: dict[str, list[tuple[str, int]]] = {}
    pivots: dict[str, list[tuple[str, float]]] = {}
    tags = entry.get("tags", {})
    frame_tag = {}
    for tag, frames in tags.items():
        for f in frames:
            frame_tag[f] = tag
    grounded = entry.get("anchor", "ground") == "ground"
    heights: dict[int, int] = {}
    colours: dict[int, dict] = {}

    for row in range(rows):
        for col in range(cols):
            idx = row * cols + col
            label = f"r{row}c{col}"
            box = cell_box(cols, rows, w, h, col, row)
            bbox, touches, halo, mx, comps = analyse_cell(im, box)
            rep.checked += 1
            sheet_max_alpha = max(sheet_max_alpha, mx)

            declared = idx in entry.get("live_frames", range(cols * rows))
            if bbox is None:
                if declared:
                    rep.add("ERROR", "EMPTY_CELL", name,
                            "declared frame contains no opaque pixels", label)
                continue
            if not declared:
                continue

            hit = [k for k, v in touches.items() if v]
            if hit:
                rep.add("ERROR", "EDGE_BLEED", name,
                        f"opaque pixels touch cell edge(s): {', '.join(hit)}", label)
            if halo >= HALO_EDGE_RATIO:
                rep.add("ERROR", "HALO", name,
                        f"{halo*100:.0f}% of the sprite rim is near-white "
                        f"(matte residue)", label)

            if not entry.get("allowDetached"):
                for b in detached_masses(comps):
                    bx0, by0, bx1, by1 = b["bbox"]
                    rep.add("ERROR", "DETACHED_MASS", name,
                            f"{b['n']}px of ink at ({bx0},{by0})-({bx1},{by1}) "
                            f"sits {bbox_gap(comps[0]['bbox'], b['bbox'])}px "
                            f"clear of the silhouette — a fragment of the "
                            f"neighbouring master cell, not part of the subject",
                            label)

            # FLOATING_SUBJECT. The creature, not the cell contents, has to be
            # on the ground line. Eight enemy frames were seated by a crumb of
            # the cell next door that happened to be the lowest ink present, and
            # the creature hung 9-14px above its own baseline with nothing under
            # its feet. Measuring the largest component rather than the bounding
            # box is the whole point: the bounding box was never wrong.
            #
            # On a sheet marked allowDetached the actor IS several masses — the
            # canopy is a dome with its shroud lines drawn separately — so there
            # the whole ink is the subject and the largest component is only
            # part of it.
            if grounded and baseline is not None and comps:
                foot = (max(b["bbox"][3] for b in comps)
                        if entry.get("allowDetached") else comps[0]["bbox"][3])
                if abs(foot - baseline) > FLOAT_TOLERANCE:
                    rep.add("ERROR", "FLOATING_SUBJECT", name,
                            f"the subject's lowest row is {foot}, baseline is "
                            f"{baseline}: it is drawn {baseline-foot}px off the "
                            f"line the game stands it on", label)

            x0, y0, x1, y1 = bbox
            heights[idx] = y1 - y0
            if entry.get("actorOf"):
                colours[idx] = mass_means(im.crop(box))
            tag = frame_tag.get(idx)
            # Drift only means anything for something that stands on a floor.
            # A projectile or a burst is centred on its own flight line, and
            # measuring its "ground line" reports a defect that is really just
            # the effect growing, which is what it is supposed to do.
            if tag and grounded:
                baselines.setdefault(tag, []).append((label, y1))
                pivots.setdefault(tag, []).append((label, (x0 + x1) / 2))

    # --- muzzle sockets -----------------------------------------------------
    # These decide where every player projectile is born. A socket in an empty
    # corner, or in the character's knees, produces shots that visibly miss the
    # gun — and nothing else in the pipeline would notice.
    sockets = entry.get("sockets") or {}
    if sockets:
        cw_i = entry.get("cellW", w // cols)
        ch_i = entry.get("cellH", h // rows)
        for frame_s, pt in sockets.items():
            idx = int(frame_s)
            col, row = idx % cols, idx // cols
            if row >= rows:
                rep.add("ERROR", "SOCKET_RANGE", name,
                        f"socket for frame {idx} is outside the sheet")
                continue
            sx, sy = pt
            if not (0 <= sx < cw_i and 0 <= sy < ch_i):
                rep.add("ERROR", "SOCKET_RANGE", name,
                        f"socket ({sx}, {sy}) lies outside the {cw_i}x{ch_i} cell",
                        f"r{row}c{col}")
                continue
            box = cell_box(cols, rows, w, h, col, row)
            cell = im.crop(box)
            px = cell.load()
            px_x, px_y = int(round(sx)), int(round(sy))
            px_x = min(max(px_x, 0), cell.size[0] - 1)
            px_y = min(max(px_y, 0), cell.size[1] - 1)
            # Allow a one-pixel neighbourhood: a barrel tip measured at the
            # silhouette edge can round onto the transparent side.
            hit = any(
                px[min(max(px_x + dx, 0), cell.size[0] - 1),
                   min(max(px_y + dy, 0), cell.size[1] - 1)][3] >= SOLID
                for dx in (-1, 0, 1) for dy in (-1, 0, 1)
            )
            if not hit:
                rep.add("ERROR", "SOCKET_OFF_SPRITE", name,
                        f"socket ({sx}, {sy}) is not on the sprite — shots would "
                        f"spawn in empty space", f"r{row}c{col}")

    if sheet_max_alpha and sheet_max_alpha < 255:
        rep.add("ERROR", "NO_OPAQUE", name,
                f"maximum alpha is {sheet_max_alpha}, never 255 — the whole "
                f"sheet is semi-transparent and backgrounds will ghost through")

    for tag, vals in baselines.items():
        if len(vals) < 2:
            continue
        lo = min(v for _, v in vals)
        hi = max(v for _, v in vals)
        if hi - lo > BASELINE_TOLERANCE:
            worst = max(vals, key=lambda kv: abs(kv[1] - lo))
            rep.add("ERROR", "BASELINE_DRIFT", name,
                    f"tag '{tag}' ground line moves {hi-lo}px across frames "
                    f"(worst {worst[0]}); feet will sink or float", worst[0])

    for tag, vals in pivots.items():
        if len(vals) < 2:
            continue
        lo = min(v for _, v in vals)
        hi = max(v for _, v in vals)
        if hi - lo > PIVOT_TOLERANCE:
            rep.add("WARN", "PIVOT_DRIFT", name,
                    f"tag '{tag}' horizontal centre moves {hi-lo:.0f}px across "
                    f"frames; cycle may wobble")

    # --- one actor, one size ------------------------------------------------
    #
    # Players reported this as "the main character sprite changes when he jumps,
    # size increases". It was not a jump bug: the build sized every cell by its
    # own bounding box, and a bounding box contains the weapon and shrinks when
    # a pose tucks, so a single stride pulsed Rook 16.8%, six aim masters landed
    # 41% apart, and holding Up made him 18% smaller. The enemies had it too
    # (e_flier changed 43% between the two frames of its own walk) and so did
    # the bosses (boss5, 15% across its five poses).
    def spread(table, frames):
        vals = [table[str(f)] for f in frames if str(f) in table]
        if len(vals) < 2:
            return None
        lo, hi = min(vals), max(vals)
        return (hi - lo) / lo, lo, hi

    # Within a tag, the resampling factor itself: every frame of one animation
    # comes off one master, so one number should have produced all of them.
    scale_of = entry.get("frameScale") or {}
    for tag, frames in tags.items():
        s = spread(scale_of, sorted(set(frames)))
        if s and s[0] > SCALE_TOLERANCE_TAG:
            rep.add("ERROR", "SCALE_DRIFT_WITHIN_TAG", name,
                    f"tag '{tag}' is resampled at {s[1]:.4f}-{s[2]:.4f}, a "
                    f"{s[0]*100:.1f}% size change inside one animation", tag)

    # Across an actor, the size it came out at. The resampling factor is NOT
    # comparable here: Rook's four masters are at four resolutions, so his run
    # cells resample by 0.48 and his prone cells by 0.67 to reach sizes that
    # differ by a completely different amount. What has to agree is where they
    # arrived, in game pixels.
    size_of = entry.get("frameSize") or {}
    groups: dict[str, set] = {}
    for tag, actor in (entry.get("actorOf") or {}).items():
        group = (entry.get("sizeGroupOf") or {}).get(tag, actor)
        groups.setdefault(group, set()).update(tags.get(tag, []))
    for group, frames in sorted(groups.items()):
        s = spread(size_of, sorted(frames))
        if s and s[0] > SCALE_TOLERANCE_ACTOR:
            rep.add("ERROR", "SCALE_DRIFT_ACROSS_ACTOR", name,
                    f"actor '{group}' is drawn at {s[1]}-{s[2]}px across its "
                    f"tags, a {s[0]*100:.1f}% size change", group)

    # --- and one size that is the size it says it is ------------------------
    #
    # The counterpart to the two rules above, and what stops them being the
    # build marking its own homework: this one ignores the scale entirely and
    # measures the named reference frame in the PNG.
    for actor, spec in (entry.get("declaredHeights") or {}).items():
        f = spec["frame"]
        if f not in heights:
            rep.add("ERROR", "DECLARED_HEIGHT_MISMATCH", name,
                    f"actor '{actor}' names frame {f} as its reference and that "
                    f"frame is not drawn", actor)
            continue
        got = heights[f]
        if abs(got - spec["height"]) > HEIGHT_TOLERANCE:
            rep.add("ERROR", "DECLARED_HEIGHT_MISMATCH", name,
                    f"actor '{actor}' is declared {spec['height']}px tall and "
                    f"its reference frame measures {got}px", actor)
        intent = spec.get("intent")
        if intent is not None and abs(intent - spec["height"]) > HEIGHT_TOLERANCE:
            rep.add("WARN", "DECLARED_HEIGHT_MISMATCH", name,
                    f"actor '{actor}' wants to be {intent}px tall and its cell "
                    f"only allows {spec['height']}px — it will not fill its "
                    f"hitbox", actor)

    # --- one actor, one grading --------------------------------------------
    for actor, tag_set in sorted(
            _actor_tags(entry).items()):
        pooled = merge_means([colours[f] for t in tag_set
                              for f in sorted(set(tags.get(t, [])))
                              if f in colours])
        for tag in sorted(tag_set):
            frames = [f for f in sorted(set(tags.get(tag, []))) if f in colours]
            if not frames:
                continue
            here = merge_means([colours[f] for f in frames])
            for key, s_tol, v_tol in (("warm", WARM_S_TOL, WARM_V_TOL),
                                      ("cool", COOL_S_TOL, COOL_V_TOL)):
                a, b = pooled.get(key), here.get(key)
                if not a or not b:
                    continue
                ds, dv = abs(b[0] - a[0]), abs(b[1] - a[1])
                if ds > s_tol or dv > v_tol:
                    rep.add("ERROR", "PALETTE_INCOHERENCE", name,
                            f"'{tag}' {key} mass sits S{b[0]:.3f} V{b[1]:.3f} "
                            f"against actor '{actor}' at S{a[0]:.3f} V{a[1]:.3f} "
                            f"(dS {ds:.3f}, dV {dv:.3f}) — one actor graded two "
                            f"ways reads as the colour changing when he moves",
                            tag)

    # --- enough frames to be a cycle ----------------------------------------
    declared_cycles = set(entry.get("cycles") or [])
    for tag, frames in sorted(tags.items()):
        if tag not in declared_cycles and not tag.split("_")[-1] in CYCLE_SUFFIXES:
            continue
        if len(frames) < CYCLE_MIN_FRAMES:
            rep.add("ERROR", "CYCLE_FRAME_COUNT", name,
                    f"tag '{tag}' is a locomotion cycle with {len(frames)} "
                    f"frame(s); under {CYCLE_MIN_FRAMES} it reads as a shuffle "
                    f"with a hitch however good the frames are", tag)

    check_master_cuts(entry, rep)


def _actor_tags(entry):
    """Tags grouped by the actor they belong to, per the manifest."""
    out: dict[str, set] = {}
    for tag, actor in (entry.get("actorOf") or {}).items():
        out.setdefault(actor, set()).add(tag)
    return out
def main():
    if not os.path.exists(MANIFEST):
        print(f"check-mars-sprite-atlases: no manifest at {MANIFEST}")
        return 1
    manifest = json.load(open(MANIFEST, encoding="utf-8"))
    rep = Report()
    for entry in manifest["sheets"]:
        check_sheet(entry, rep)

    suppress = set(tuple(s) for s in manifest.get("suppress", []))
    live = [f for f in rep.findings if (f.code, f.sheet, f.cell) not in suppress]
    suppressed = len(rep.findings) - len(live)

    errs = [f for f in live if f.severity == "ERROR"]
    warns = [f for f in live if f.severity == "WARN"]

    for f in live:
        loc = f"{f.sheet}:{f.cell}" if f.cell else f.sheet
        print(f"  [{f.severity}] {f.code:16s} {loc} — {f.detail}")

    print(
        f"\ncheck-mars-sprite-atlases: {len(manifest['sheets'])} sheets, "
        f"{rep.checked} cells, {len(errs)} error(s), {len(warns)} warning(s), "
        f"{suppressed} suppressed"
    )
    return 1 if errs else 0


if __name__ == "__main__":
    sys.exit(main())
