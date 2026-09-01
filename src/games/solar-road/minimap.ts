/* SOLAR CIRCUIT — the course map.
 *
 * A panel in the top-left showing the next few hundred metres of trail,
 * scrolling under a marker that stays in one place. A satnav, not an atlas.
 *
 * COURSE-UP, NOT HEADING-UP
 *
 * The window held its orientation to the CRAFT at first — rotated every frame so
 * the direction of travel was always straight up. That is how a car satnav
 * works and it was the wrong choice here, for one concrete reason: it makes the
 * marker's heading meaningless. If the map always turns to put the craft
 * upright, the arrow can only ever point up, and the single most useful thing a
 * marker can tell you — which way the trail is about to take you — is exactly
 * the thing the rotation has removed.
 *
 * So the map holds the COURSE's orientation instead, rotated once at build time
 * so the run from A to B reads up the panel, and the marker turns within it. Now
 * the arrow leans into the hook and swings through the hairpin, and the shape of
 * the trail ahead is drawn where it actually is rather than where the craft
 * happens to be pointing.
 *
 * WHY IT IS NOT THE WHOLE COURSE ANY MORE
 *
 * It was, at first: the entire run drawn end to end with a dot creeping along
 * it. That is a fine progress indicator and a useless map. At the scale needed
 * to fit a sixty-second course into a corner of the screen, the corner the
 * player was about to arrive at came out as two pixels of wiggle — legible as
 * "there is a bend somewhere ahead", which they could already see out of the
 * window, and not legible as "it goes left and then immediately hard right",
 * which is the thing a map could have told them and the road could not.
 *
 * So it zooms in. What is on screen is a window of the course a few seconds
 * wide, at a scale where a hairpin looks like a hairpin, and the boost pads
 * inside that window are marked — which is the other thing worth knowing early,
 * since a pad is only worth anything if you saw it in time to line up on it.
 *
 * The progress the old version showed is not lost; it moved to the bar down the
 * edge of the panel, which costs eight pixels and does that job properly.
 *
 * IT IS THE REAL COURSE, NOT A DECORATIVE SQUIGGLE
 *
 * The shape is integrated from the same `curve` values the track was built with,
 * so every bend on the map is a bend the player will actually drive. That is the
 * only version of this worth having: a map that does not match the road teaches
 * the player something false, and they find out at the first corner it lied
 * about.
 *
 * WHY THE HEADING CONSTANT IS ARBITRARY AND THAT IS FINE
 *
 * `curve` is not an angle. It is a per-segment lateral offset the projection
 * accumulates — the engine has no notion of the road's compass heading, because
 * it never needs one. Treating it as proportional to a turn rate is the right
 * shape of approximation (a harder curve held for longer turns further), and
 * since the window is drawn at a fixed zoom about the craft, the constant only
 * decides how pronounced the bends look, never whether they are in the right
 * place relative to each other.
 */

import Phaser from "phaser";
import type { RoadScene } from "./game-scene";
import { orientPath, planPath } from "./tracks";

/** Panel box, in canvas pixels: a rectangle in the top-left corner. The Y offset
 *  clears the ✕ and mute buttons, which are DOM and positioned against the
 *  viewport rather than the canvas — the two coordinate systems only line up
 *  loosely, so the gap is deliberately generous. */
const BOX = { x: 24, y: 72, w: 300, h: 236 };
/** The progress bar down the right-hand edge of the panel. */
const PROGRESS_W = 8;

/** Where the craft sits in the panel, as a fraction of its height. Low, because
 *  what is behind you does not matter and what is ahead is the whole point. */
const ANCHOR_Y = 0.82;

/** Segments of course drawn ahead of the craft and behind it. Ahead is about
 *  four seconds at the speeds this is useful at — far enough to plan a corner,
 *  near enough that the corner after it is not competing for the same space. */
const AHEAD = 420;
const BEHIND = 70;
/** Panel pixels per unit of the integrated plan view. One plan unit is one
 *  segment of travel, so this and AHEAD together decide the zoom. */
const ZOOM = 0.42;

/** One map sample per this many segments. Much finer than the whole-course view
 *  needed, because a corner is now tens of pixels rather than two. */
const SAMPLE = 6;

const COL_TRAIL = 0x8f7ae0;
const COL_EDGE = 0x4a3d7d;
const COL_PAD = 0xffe05c;
const COL_CRAFT = 0xf2fdff;

export class Minimap {
  private readonly scene: RoadScene;
  /** The frame and the progress groove: drawn once. */
  private readonly base: Phaser.GameObjects.Graphics;
  /** The scrolling window, redrawn every frame. */
  private readonly live: Phaser.GameObjects.Graphics;
  /** Plan-view position and heading, one entry per SAMPLE segments. */
  private readonly pts: Array<{ x: number; y: number; h: number }> = [];
  /** Sample indices carrying a boost pad. */
  private readonly padAt = new Set<number>();

  constructor(scene: RoadScene) {
    this.scene = scene;
    this.base = scene.add.graphics({ x: 0, y: 0 }).setScrollFactor(0);
    this.live = scene.add.graphics({ x: 0, y: 0 }).setScrollFactor(0);

    /* Everything the window draws is clipped to the panel. Without this a
       hairpin swings the trail clean across the stopwatch: running off the edges
       is exactly what a zoomed window does, and the mask is what makes that a
       feature rather than a bug. */
    const shape = this.scene.make.graphics({}, false);
    shape.fillRect(BOX.x, BOX.y, BOX.w - PROGRESS_W - 4, BOX.h);
    this.live.setMask(shape.createGeometryMask());

    this.build();
  }

  private build(): void {
    const segments = this.scene.segments;
    if (segments.length === 0) return;

    /* Integrate the built course into a plan view, then turn the whole thing
       ONCE so the run from A to B reads up the panel — a course that ends up west
       of where it started would otherwise spend the race drifting sideways off
       the edge of the window.
       
       Both steps come from `tracks.ts`, which is what the track-select previews
       use. This file had its own copy of them until Aug 2026, and its own copy of
       a sign error in the rotation with it: two implementations of one piece of
       geometry is two places to get it wrong, and it duly was. Sampled from the
       BUILT segments rather than from the piece list, so the map is drawn from
       the course that actually exists. */
    const raw = planPath(
      segments.map((s) => s.curve),
      SAMPLE,
    );
    for (let i = 0; i < segments.length; i += SAMPLE) {
      if (segments[i]!.pad) this.padAt.add(i / SAMPLE);
    }
    this.pts.push(...orientPath(raw).pts);

    this.base.fillStyle(0x0b0918, 0.55);
    this.base.fillRect(BOX.x, BOX.y, BOX.w, BOX.h);
    this.base.lineStyle(1, COL_EDGE, 0.6);
    this.base.strokeRect(BOX.x, BOX.y, BOX.w, BOX.h);
    /* The progress groove. The bar that fills it is live. */
    this.base.fillStyle(0x05060f, 0.6);
    this.base.fillRect(BOX.x + BOX.w - PROGRESS_W - 2, BOX.y + 2, PROGRESS_W, BOX.h - 4);
  }

  /** @param progress 0 at the line, 1 at Point B. */
  update(progress: number): void {
    const g = this.live;
    g.clear();
    if (this.pts.length < 2) return;

    const p = Phaser.Math.Clamp(progress, 0, 1);
    const t = p * (this.pts.length - 1);
    const i = Math.floor(t);
    const f = t - i;
    const a = this.pts[i]!;
    const b = this.pts[Math.min(this.pts.length - 1, i + 1)]!;

    /* Where the craft is and which way it is pointing, interpolated between
       samples so the window slides rather than stepping six segments at a time. */
    const wx = a.x + (b.x - a.x) * f;
    const wy = a.y + (b.y - a.y) * f;
    const head = a.h + (b.h - a.h) * f;

    /* The window only TRANSLATES — the course keeps the orientation it was given
       at build time, and the marker turns inside it. Screen y runs down and the
       course runs up the panel, hence the negation. */
    const ax = BOX.x + (BOX.w - PROGRESS_W - 4) / 2;
    const ay = BOX.y + BOX.h * ANCHOR_Y;
    const sx = (q: { x: number; y: number }) => ax + (q.x - wx) * ZOOM;
    const sy = (q: { x: number; y: number }) => ay - (q.y - wy) * ZOOM;

    const from = Math.max(0, i - Math.round(BEHIND / SAMPLE));
    const to = Math.min(this.pts.length - 1, i + Math.round(AHEAD / SAMPLE));

    /* The trail. Two strokes: a wide dim one for its width and a thin bright one
       down the middle, which at this zoom is what makes it read as a road rather
       than as a line on a chart. */
    for (const [width, color, alpha] of [
      [9, COL_EDGE, 0.85],
      [3, COL_TRAIL, 1],
    ] as const) {
      g.lineStyle(width, color, alpha);
      g.beginPath();
      g.moveTo(sx(this.pts[from]!), sy(this.pts[from]!));
      for (let k = from + 1; k <= to; k++) g.lineTo(sx(this.pts[k]!), sy(this.pts[k]!));
      g.strokePath();
    }

    /* Boost pads in the window. The second reason this map is worth having: a
       pad seen four seconds early is one you can line up on, and a pad seen out
       of the windscreen is one you are already past. */
    for (const k of this.padAt) {
      if (k < from || k > to) continue;
      const q = this.pts[k]!;
      g.fillStyle(COL_PAD, 0.28);
      g.fillCircle(sx(q), sy(q), 7);
      g.fillStyle(COL_PAD, 1);
      g.fillCircle(sx(q), sy(q), 3.6);
    }

    /* The craft: a chevron at the anchor, pointing the way the trail is taking
       it. Built from a forward and a right vector rather than by rotating a
       fixed set of points, so it stays a chevron at every angle instead of
       shearing — and so "which way is forward" is stated once. */
    const fx = Math.sin(head);
    const fy = -Math.cos(head);
    const rx = Math.cos(head);
    const ry = Math.sin(head);
    g.fillStyle(COL_CRAFT, 1);
    g.beginPath();
    g.moveTo(ax + fx * 9, ay + fy * 9);
    g.lineTo(ax - fx * 6 + rx * 6.5, ay - fy * 6 + ry * 6.5);
    g.lineTo(ax - fx * 2.5, ay - fy * 2.5);
    g.lineTo(ax - fx * 6 - rx * 6.5, ay - fy * 6 - ry * 6.5);
    g.closePath();
    g.fillPath();

    /* Progress up the right-hand edge — the one thing the whole-course view did
       that a zoomed window otherwise cannot. */
    const grooveH = BOX.h - 4;
    g.fillStyle(COL_PAD, 0.9);
    g.fillRect(BOX.x + BOX.w - PROGRESS_W - 2, BOX.y + 2 + grooveH * (1 - p), PROGRESS_W, grooveH * p);
  }
}

export default Minimap;
