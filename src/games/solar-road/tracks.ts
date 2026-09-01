/* SOLAR CIRCUIT — the nine courses.
 *
 * Each one is a list of PIECES, and a piece is exactly what `RoadScene.addRoad`
 * takes: how long it runs for, how hard it bends, how far it climbs, and what
 * width it eases to. The scene knows how to play a list; it no longer knows what
 * any particular course looks like.
 *
 * WHY THEY ARE GENERATED AND NOT HAND-AUTHORED
 *
 * Nine hand-written courses is nine chances for one of them to be dull, and
 * nine places to fix anything learned about what makes a good one. What is
 * hand-authored here is each course's CHARACTER — how twisty, how hilly, how
 * wide, how long — and the generator turns that into pieces. `Antipode` is
 * twistier than `Caloris Run` because its numbers say so, not because somebody
 * typed forty more corners.
 *
 * They are deterministic. Every course comes out of a seeded integer hash, so a
 * given track is the same course for every player, on every machine, and the
 * same course tomorrow as today — which is what makes learning one of them worth
 * the effort, and what lets the track-select preview draw a course before it has
 * been built. Do not introduce Math.random() here, and do not change an existing
 * track's `seed` or its shape parameters unless you mean to change the course.
 * Adding a new track with a new seed is free.
 *
 * WHAT IS GUARANTEED ABOUT EVERY COURSE
 *
 * Two things, and both are structural rather than aesthetic:
 *
 *   - it ENDS AT WIDTH.NORMAL and at zero elevation, because the finish has to
 *     meet the same conditions the start was built at
 *   - it opens with a short straight at NORMAL, so every course gives the player
 *     the same first second to react to the lights
 */

/** Trail half-widths.
 *
 * NORMAL is what every course starts and ends at. The three are about three
 * times the widths this port began with: the trail was laid out for a craft
 * doing 133 units a frame, and at four times that the old NARROW was a slot.
 *
 * Widening on its own is NOT a difficulty cut, and it is worth being clear about
 * why. `playerX` is normalised to half-widths — ±1 is the verge however wide the
 * trail happens to be — so a trail twice as wide still takes exactly as many
 * frames to cross at a given steering rate. What the extra width buys is SIGHT:
 * more pixels of trail out at the fog line, which is the only place a decision
 * can still be made at speed. */
export const WIDTH = {
  NARROW: 1700,
  NORMAL: 2700,
  WIDE: 3900,
};

/** The vocabulary a piece is built from. LENGTH is the dial that sizes a run:
 *  every piece is measured in these, so scaling them scales a course without
 *  touching its shape. */
export const LENGTH = { SHORT: 33, MEDIUM: 66, LONG: 132 } as const;
export const HILL = { NONE: 0, LOW: 20, MEDIUM: 40, HIGH: 60, HUGE: 100 } as const;
export const CURVE = { NONE: 0, EASY: 2, MEDIUM: 4, HARD: 6, HUGE: 9.5 } as const;

/** One piece of road. `width` omitted means "hold whatever we are at". */
export interface Piece {
  len: number;
  curve: number;
  hill: number;
  width?: number;
}

export interface TrackSpec {
  /** Stable key. */
  id: string;
  name: string;
  blurb: string;
  /** 1..5, shown on the card. Derived by hand from the numbers below rather than
   *  computed, because "hard" is about how the three interact. */
  difficulty: number;
  seed: number;
  /** How many pieces the course runs for. Around 40 is a minute. */
  pieces: number;
  /** 0..1. How often a piece bends at all, and how hard when it does. */
  twist: number;
  /** 0..1. How often a piece climbs or drops, and how far. */
  relief: number;
  /** 0..1. Pulls the width mix from narrow towards wide. */
  openness: number;
}

/* The roster. Named for Mercury's own geography where it exists — Caloris,
 * Rembrandt and Beagle Rupes are real features — and for what the course does
 * where it does not. */
export const TRACKS: readonly TrackSpec[] = [
  {
    id: "caloris",
    name: "CALORIS RUN",
    blurb: "The wide one. Long sweepers across the basin floor, room to be wrong in, and nowhere to hide from your own top speed.",
    difficulty: 1,
    seed: 0x1a37,
    pieces: 38,
    twist: 0.28,
    relief: 0.3,
    openness: 0.85,
  },
  {
    id: "terminator",
    name: "TERMINATOR LINE",
    blurb: "Due east along the line where the long day begins. Gentle, rolling, and the only course on the roster that never closes to narrow.",
    difficulty: 1,
    seed: 0x2b91,
    pieces: 40,
    twist: 0.34,
    relief: 0.52,
    openness: 0.78,
  },
  {
    id: "rembrandt",
    name: "REMBRANDT DEEP",
    blurb: "Down into the second-largest basin on the planet and back out of it. Two long climbs, and both of them end blind.",
    difficulty: 2,
    seed: 0x3d05,
    pieces: 41,
    twist: 0.42,
    relief: 0.86,
    openness: 0.6,
  },
  {
    id: "weft",
    name: "THE WEFT",
    blurb: "Left, right, left, right. Nothing here is hard on its own; the difficulty is that none of it ever stops.",
    difficulty: 3,
    seed: 0x4e6b,
    pieces: 44,
    twist: 0.74,
    relief: 0.3,
    openness: 0.5,
  },
  {
    id: "hollow",
    name: "HOLLOW BASIN",
    blurb: "Wide, fast and almost flat, then it shuts to a canyon without warning and stays shut for a third of the run.",
    difficulty: 3,
    seed: 0x5f22,
    pieces: 40,
    twist: 0.5,
    relief: 0.42,
    openness: 0.24,
  },
  {
    id: "shear",
    name: "SOLAR SHEAR",
    blurb: "The corona sits on your right the whole way round. Hard bends taken into the glare, and a climb at the end you will not see the top of.",
    difficulty: 4,
    seed: 0x60c8,
    pieces: 42,
    twist: 0.66,
    relief: 0.7,
    openness: 0.45,
  },
  {
    id: "beagle",
    name: "BEAGLE RUPES",
    blurb: "A scarp four hundred kilometres long, and the trail runs along the top of it. Climbs, drops, and no width to spare on either.",
    difficulty: 4,
    seed: 0x71ae,
    pieces: 43,
    twist: 0.62,
    relief: 0.92,
    openness: 0.2,
  },
  {
    id: "spine",
    name: "NIGHTSIDE SPINE",
    blurb: "The fast one. Long straights, huge corners at the end of them, and the brakes are the only thing on the craft you will not want to use.",
    difficulty: 5,
    seed: 0x82f4,
    pieces: 39,
    twist: 0.52,
    relief: 0.58,
    openness: 0.66,
  },
  {
    id: "antipode",
    name: "ANTIPODE",
    blurb: "The chaotic terrain opposite Caloris, where the impact came out the other side. It drives like it: relentless, narrow, and it never repeats itself.",
    difficulty: 5,
    seed: 0x93bd,
    pieces: 46,
    twist: 0.9,
    relief: 0.8,
    openness: 0.16,
  },
];

/** Integer hash — the same value for the same input on every machine, so a
 *  course is identical for every player and across reloads. Same construction as
 *  the terrain sampler's; kept separate so neither can be tuned into the other. */
function hash(n: number, seed: number): number {
  let h = Math.imul((n ^ seed) + 0x9e3779b9, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/**
 * Turn a track's character into the pieces that make it.
 *
 * The shape of the generator matters more than any one number in it: pieces are
 * drawn independently, but the CURVE DIRECTION alternates with a bias rather
 * than being redrawn each time. Purely random directions produce a course that
 * wanders back and forth around a point and never goes anywhere — which reads,
 * correctly, as a machine having a go. Alternating with the occasional repeat
 * gives sequences that commit: two lefts in a row, then a long right.
 */
export function buildPieces(spec: TrackSpec): Piece[] {
  const out: Piece[] = [];
  const r = (n: number, salt: number) => hash(n * 7 + salt, spec.seed);

  /* Every course opens the same way: a short flat straight at NORMAL, so the
     lights mean the same thing on all nine. */
  out.push({ len: LENGTH.SHORT, curve: 0, hill: 0, width: WIDTH.NORMAL });

  let dir = r(0, 0x11) < 0.5 ? -1 : 1;

  for (let i = 1; i < spec.pieces - 1; i++) {
    /* Direction: usually the other way from last time, sometimes the same. */
    if (r(i, 0x22) > 0.28) dir = -dir;

    const wantCurve = r(i, 0x33) < spec.twist;
    const wantHill = r(i, 0x44) < spec.relief;

    /* Curve magnitude, weighted towards the gentler end so that a HUGE means
       something when it does turn up. */
    const cq = r(i, 0x55) * spec.twist;
    const curve = !wantCurve
      ? 0
      : dir * (cq > 0.62 ? CURVE.HUGE : cq > 0.44 ? CURVE.HARD : cq > 0.24 ? CURVE.MEDIUM : CURVE.EASY);

    const hq = r(i, 0x66) * spec.relief;
    const climb = r(i, 0x77) < 0.5 ? -1 : 1;
    const hill = !wantHill
      ? 0
      : climb * (hq > 0.66 ? HILL.HUGE : hq > 0.46 ? HILL.HIGH : hq > 0.26 ? HILL.MEDIUM : HILL.LOW);

    /* Length: long pieces on the open courses, short ones on the busy ones. */
    const lq = r(i, 0x88);
    const len = lq > 0.72 - spec.twist * 0.3 ? LENGTH.SHORT : lq > 0.34 ? LENGTH.MEDIUM : LENGTH.LONG;

    /* Width changes on about a third of pieces, pulled towards the course's own
       openness. Holding it otherwise is what gives a course long stretches of
       one character instead of a new width every corner. */
    let next: number | undefined;
    if (r(i, 0x99) < 0.34) {
      const wq = r(i, 0xaa) * 0.55 + spec.openness * 0.45;
      next = wq > 0.66 ? WIDTH.WIDE : wq > 0.34 ? WIDTH.NORMAL : WIDTH.NARROW;
    }

    out.push({ len, curve, hill, width: next });
  }

  /* And every course closes the same way, because the finish has to meet the
     conditions the start was built at: back to NORMAL, then the run-out that
     takes the elevation to zero is added by the scene, which is the only thing
     that knows how high the course has climbed by this point. */
  out.push({ len: LENGTH.MEDIUM, curve: 0, hill: 0, width: WIDTH.NORMAL });
  return out;
}

/**
 * The per-segment curve values a piece list produces, without building a track.
 *
 * This is `addRoad`'s easing and nothing else, which is exactly why it can live
 * here: the curve a segment ends up with depends on the piece and the piece
 * alone — not on elevation, width, or anything the scene owns. The track-select
 * preview draws its map from this, so a course can be shown before it exists.
 *
 * It has to stay in step with `RoadScene.addRoad`. If the easing there ever
 * changes, the previews start lying about the corners.
 */
export function curveProfile(pieces: readonly Piece[]): number[] {
  const easeIn = (a: number, b: number, p: number) => a + (b - a) * p * p;
  const easeInOut = (a: number, b: number, p: number) => a + (b - a) * (-Math.cos(p * Math.PI) / 2 + 0.5);
  const out: number[] = [];
  for (const piece of pieces) {
    const n = piece.len;
    for (let i = 0; i < n; i++) out.push(easeIn(0, piece.curve, i / n));
    for (let i = 0; i < n; i++) out.push(piece.curve);
    for (let i = 0; i < n; i++) out.push(easeInOut(piece.curve, 0, i / n));
  }
  return out;
}

/**
 * A course's shape as a plan view, ready to draw.
 *
 * Shared by the track-select preview and the in-race map so the two cannot
 * disagree about what a course looks like. `curve` is not an angle — it is a
 * per-segment lateral offset the projection accumulates, and the engine has no
 * notion of the road's heading because it never needs one. Treating it as
 * proportional to a turn rate is the right shape of approximation, and since
 * every consumer normalises the result, the constant decides only how pronounced
 * the bends look, never whether they are in the right place relative to each
 * other.
 */
export const TURN_PER_CURVE = 0.002;

export interface PlanPoint {
  x: number;
  y: number;
  /** Heading at this point, radians, 0 = along +y. */
  h: number;
}

export function planPath(curves: readonly number[], sample: number): PlanPoint[] {
  const out: PlanPoint[] = [];
  let heading = 0;
  let x = 0;
  let y = 0;
  for (let i = 0; i < curves.length; i++) {
    heading += curves[i]! * TURN_PER_CURVE;
    x += Math.sin(heading);
    y += Math.cos(heading);
    if (i % sample === 0) out.push({ x, y, h: heading });
  }
  out.push({ x, y, h: heading });
  return out;
}

/**
 * Rotate a plan path so its start-to-end line runs up the page, and report the
 * angle used so headings can be corrected by the same amount.
 *
 * THE SIGN IS THE WHOLE OF THIS FUNCTION, AND IT WAS WRONG
 *
 * `angle` is measured from +y — `atan2(dx, dy)`, not the usual `atan2(dy, dx)` —
 * because up the page is the direction of interest here, not rightwards. The
 * rotation matrix below is the standard one, which measures from +x, and the two
 * conventions cancel: to bring a vector at angle-from-+y `a` onto +y you rotate
 * by PLUS `a`, not by minus it.
 *
 * Written with `-angle` it very nearly works, which is what made it survive: the
 * result is a path rotated by twice the angle instead of zero, so a course that
 * happened to run roughly north came out roughly right and only the wonkier ones
 * looked wrong. It was caught by rendering all nine previews at once and noticing
 * that Point A was not at the bottom of any of them. The heading correction
 * (`h - angle`) was always right and is unchanged.
 */
export function orientPath(pts: PlanPoint[]): { pts: PlanPoint[]; angle: number } {
  if (pts.length < 2) return { pts, angle: 0 };
  const a = pts[0]!;
  const b = pts[pts.length - 1]!;
  const angle = Math.atan2(b.x - a.x, b.y - a.y);
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return {
    angle,
    pts: pts.map((q) => {
      const dx = q.x - a.x;
      const dy = q.y - a.y;
      return { x: dx * c - dy * s, y: dx * s + dy * c, h: q.h - angle };
    }),
  };
}
