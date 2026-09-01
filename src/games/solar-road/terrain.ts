/* SOLAR CIRCUIT — the ground.
 *
 * Everything that decides what a segment of Mercury looks like. None of this is
 * upstream: Phaser3-Road paints a road, and a road is exactly what this is not
 * meant to look like.
 *
 * WHAT MAKES SOMETHING READ AS A ROAD
 *
 * Three things, and all three had to go.
 *
 *   1. Painted lane markings. The single strongest cue — nothing in nature
 *      draws a dashed line down the middle of anything. Gone entirely.
 *   2. Uniform colour. A flat fill repeated segment after segment reads as a
 *      poured surface. Replaced with two octaves of value noise, so the ground
 *      drifts light and dark in patches the size of real terrain.
 *   3. A perfectly straight edge. Upstream's kerb is a constant-width strip.
 *      Here the rubble bank either side varies in width segment to segment and
 *      sometimes spills inwards over the trail, so the boundary is ragged.
 *
 * What is left is a line worn across the regolith: bedrock swept clean by
 * traffic, loose dust either side, broken rock piled where the two meet.
 *
 * WHY THE NOISE IS PERIODIC
 *
 * The track is a loop — the last segment's far edge is the first segment's near
 * edge — so any pattern laid along it has to meet itself. Plain `hash(i)` would
 * put an unrelated colour on either side of that join and drop a visible line
 * across the ground, once a lap, in exactly the way the height and width seams
 * used to. So the noise is sampled on a ring of cells that divides the track
 * evenly, and wraps by construction.
 *
 * That is also why colours are assigned in a pass *after* the geometry is built
 * rather than inside addSegment(): the pattern cannot be made periodic until
 * the track length is known.
 */

import type { RoadColor } from "./render-helpers";

/* --- palette ---------------------------------------------------------------
 * Kept in the same hue relationship the tarmac version established, because it
 * was legible: the driving line is cool, the ground either side is warm. What
 * changed is the character — these are rock and dust values, they vary, and
 * none of them is a colour anybody paints.
 *
 * Contrast between TRAIL and VERGE is the one thing here that is gameplay and
 * not decoration. The off-road penalty is severe, so a player has to see where
 * the line ends without thinking about it, in the dark, at speed.
 *
 * That contrast is carried entirely by VALUE, and the hue is shared. The first
 * pass kept the tarmac version's cool trail against a warm verge, and the extra
 * separation was not worth what it cost: grey-blue against tan is precisely the
 * asphalt-against-earth pairing, and no amount of mottling talks the eye out of
 * it. One warm family, dark line worn through light dust, reads instead as
 * exactly what it is meant to be — ground that has had things driven over it. */
const TRAIL_DARK = [0x24, 0x1e, 0x17] as const; // worn down to dark compacted rock
const TRAIL_LIGHT = [0x5f, 0x52, 0x40] as const; // ...with dust still lying on it
const VERGE_DARK = [0x57, 0x4b, 0x3b] as const; // undisturbed regolith
const VERGE_LIGHT = [0xab, 0x98, 0x78] as const; // loose, sun-caught dust

/* The bank spans BOTH the others' ranges on purpose. It is broken bedrock lying
 * in dust, so it has to be able to come out the colour of either — a band with
 * its own distinct value, however earthy, reads as a painted shoulder line, and
 * a painted shoulder line is a road. */
const BERM_DARK = [0x3a, 0x31, 0x26] as const;
const BERM_LIGHT = [0xac, 0x97, 0x79] as const;

/** A pale mineral streak where the lap turns over, and a dark basalt outcrop
 *  just before it. They do the job the start/finish bands did — you can tell
 *  you have come round again — without being paint. */
export const START_BAND: RoadColor = { road: 0x8d8375, grass: 0x9a8f7e, rumble: 0xa8998a };
export const FINISH_BAND: RoadColor = { road: 0x1d2130, grass: 0x2a2536, rumble: 0x26203a };

/* How much ground one noise cell covers, in segments, at each octave.
 *
 * The first attempt used 9 and 3 and was invisible. Two smoothly-interpolated
 * octaves that far apart average out into a gradient, and a gradient over
 * ground that is already fading into fog is nothing at all — the surface came
 * out as flat as the tarmac it replaced.
 *
 * What reads as terrain is GRAIN: variation fast enough that adjacent segments
 * differ. Each segment is drawn as one flat band, so a cell size near 1 gives
 * band-to-band contrast, which the eye takes as scattered rock and dust. The
 * coarse octaves underneath keep it from looking like noise by drifting the
 * whole area lighter and darker over hundreds of units. */
const COARSE_CELLS = 12;
const MID_CELLS = 3;
/**
 * Exactly 1, and the 1 is load-bearing.
 *
 * `ringNoise` interpolates between cell corners, so a cell size of 1.4 puts
 * consecutive segments 0.7 of a cell apart — still on the same interpolation
 * ramp, still correlated, and measured at under 2 luminance of difference
 * between neighbours, which is nothing. At exactly 1 each segment lands on its
 * own corner, the interpolation drops out, and the octave becomes per-segment
 * white noise. That is the grain.
 *
 * Do not go below 1. Fractional cells smaller than a segment alias — the
 * sampling skips corners, and which ones it skips changes with the track
 * length, so the ground would look different for no visible reason.
 */
const FINE_CELLS = 1;

/** Integer hash — the same value for the same input on every machine, so the
 *  ground is identical for every player and across reloads. */
function hash(n: number, seed: number): number {
  let h = Math.imul((n ^ seed) + 0x9e3779b9, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/**
 * Smooth value noise around a ring of `cells` cells, so sample 0 and sample
 * `total` are the same point. `cells` is forced to at least 2 — a one-cell ring
 * interpolates a value with itself and produces a flat, and a zero-cell ring
 * divides by zero.
 */
function ringNoise(i: number, total: number, span: number, seed: number): number {
  const cells = Math.max(2, Math.round(total / span));
  const x = (i / total) * cells;
  const c = Math.floor(x);
  const f = x - c;
  const a = hash(c % cells, seed);
  const b = hash((c + 1) % cells, seed);
  return a + (b - a) * (f * f * (3 - 2 * f));
}

/** Three octaves: broad drift, patches, then the grain that does the work. */
function ground(i: number, total: number, seed: number): number {
  return (
    /* The fine octave's weight is the one dial worth understanding here.
     *
     * A segment is drawn as one flat horizontal band, so per-segment noise
     * necessarily comes out as horizontal striping. Too little and the ground
     * is a smooth ribbon — a road. Too much and the near field, where segments
     * are forty-odd pixels tall, reads as stripes rather than as scattered
     * rock. 0.27 measured at about five luminance between neighbours, which is
     * enough to see as texture and not enough to see as bands. */
    0.44 * ringNoise(i, total, COARSE_CELLS, seed) +
    0.29 * ringNoise(i, total, MID_CELLS, seed ^ 0x5bf0) +
    0.27 * ringNoise(i, total, FINE_CELLS, seed ^ 0x2d71)
  );
}

const mixHex = (a: readonly number[], b: readonly number[], t: number): number =>
  ((Math.round(a[0]! + (b[0]! - a[0]!) * t) << 16) |
    (Math.round(a[1]! + (b[1]! - a[1]!) * t) << 8) |
    Math.round(a[2]! + (b[2]! - a[2]!) * t)) >>>
  0;

/** Everything the renderer needs to paint one segment of ground. */
export interface TerrainSample {
  color: RoadColor;
  /** Multiplier on how far the rubble bank spreads outwards from the trail. */
  bermOut: number;
  /** How far it spills back *over* the trail, as a fraction of the bank width.
   *  This is what stops the driving line having a machined edge. Capped well
   *  below 1: the rubble is allowed to look like it is encroaching, but the
   *  surface the player actually steers on stays where the physics says it is. */
  bermIn: number;
}

/**
 * Surface one segment.
 *
 * The three materials are sampled with different seeds so they drift
 * independently — a light patch of dust does not imply a light patch of
 * bedrock, which is what would happen with a single shared value and would read
 * as a lighting change rather than as ground.
 */
export function sampleTerrain(i: number, total: number): TerrainSample {
  const trail = ground(i, total, 0x1a2b);
  const verge = ground(i, total, 0x7c3d);
  const berm = ground(i, total, 0x44e1);

  /* The bank's WIDTH is sampled at the finest octave alone, not from `berm`.
   *
   * Shape and colour have to be uncorrelated or the bank gets wide exactly
   * where it gets light, which the eye reads as one deliberate object with a
   * taper — a kerb again. More importantly the width has to change fast: a
   * width that drifts smoothly over ten segments is a smooth edge, which is
   * the thing this is all trying not to be. Sampled per segment, the boundary
   * comes out broken. */
  const edge = ringNoise(i, total, FINE_CELLS, 0xb17e);

  return {
    color: {
      road: mixHex(TRAIL_DARK, TRAIL_LIGHT, trail),
      grass: mixHex(VERGE_DARK, VERGE_LIGHT, verge),
      rumble: mixHex(BERM_DARK, BERM_LIGHT, berm),
      /* No `lane`. renderSegment only draws markings when a colour carries
         this, so leaving it off is what removes them — see render-helpers. */
    },
    bermOut: 0.3 + edge * 2.2,
    bermIn: Math.max(0, edge - 0.35) * 0.9,
  };
}

/* ============================================================ boost pads ====
 * Flat plates laid into the trail. Drive over one and it charges the craft's
 * boost meter, which the player spends with Shift; see Car.addCharge() and the
 * note on BOOST_ADD in car.ts.
 *
 * They are the one thing on Mercury that is unambiguously MANUFACTURED, and that
 * is deliberate rather than a lapse. Everything else here goes to some length to
 * avoid reading as a road — no paint, no kerbs, no straight edges — because the
 * fiction is a line worn across regolith by traffic. A boost pad cannot play by
 * that rule: the player has to see it far enough ahead to steer onto it, at
 * speed, in the dark, which means high contrast and a hard edge. So instead of
 * pretending, they are plates somebody bolted down: Polaris cyan, dead straight,
 * obviously put there. A worn-in trail with race furniture on it is a coherent
 * picture. A subtle boost pad is an invisible one.
 *
 * The ARROW is what makes them readable at a distance, and it MOVES. Each pad is
 * a run of PAD_LEN segments; each segment carries its position along that run as
 * `phase`, and the renderer turns phase plus a clock into a chevron whose fat end
 * sweeps from the mouth of the pad to its tip and starts again. Seen in
 * projection that is an arrow running forward down the trail — which says
 * "through here, this way" without a texture, a sprite or a single frame of
 * animation data.
 *
 * The width is computed at draw time rather than baked into the slice for
 * exactly that reason: a `coreHalf` fixed at build time can only ever be a
 * static arrow, and a static arrow at the fog line reads as a smear.
 */

/** One segment's slice of a pad. Offsets and widths are in road half-widths, so
 *  ±1 is the trail edge whatever the trail is doing here — the same units
 *  `playerX` is in, which is what makes the collision test one subtraction and
 *  makes a pad sit correctly on a narrow section and a wide one alike. */
export interface BoostPadSlice {
  offset: number;
  half: number;
  /** Where this segment sits along its pad, 0 at the mouth and 1 at the tip.
   *  The renderer combines it with a clock to animate the chevron. */
  phase: number;
  plate: number;
  core: number;
}

/** Segments per pad. Five is about a third of a second at nominal speed and a
 *  twentieth at the top of the ladder — long enough to be an arrow, short enough
 *  that the whole thing fits inside one bend. */
const PAD_LEN = 5;
/** Segments between attempts to place one.
 *
 * Widened from 105 to 260 in Aug 2026, taking the lap from around thirty pads to
 * around a dozen. At the old spacing there was a pad every couple of seconds:
 * they stopped being an opportunity you spotted and took, and became a texture
 * the trail happened to have. Rare enough to be worth going out of your way for
 * is the whole point of them — and with the surge ladder now three minutes long,
 * a pad is worth far more than it was, so there should be fewer. */
const PAD_STRIDE = 260;
/** Plate half-width. Wide enough to hit without threading a needle, narrow
 *  enough that you have to be pointing at it. */
const PAD_HALF = 0.36;
/** How far off centre a pad may sit, derived from its own width rather than
 *  chosen, so the plate always lies WHOLLY on the trail.
 *
 * Picked by hand, the two numbers disagreed: an offset of 0.68 plus a half-width
 * of 0.36 put the outer edge of the plate at 1.04 half-widths, four per cent
 * past the verge. That is not cosmetic. `playerX > 1` is off the trail and costs
 * the player their surge, so a plate hanging over the line is an instruction to
 * drive somewhere that is punished — the game drawing a bright cyan arrow into
 * its own trap. The margin keeps a plate's edge clear of the boundary by a
 * further twentieth of a half-width, which is about where the rubble bank starts
 * spilling inwards. */
const PAD_EDGE_MARGIN = 0.05;
const PAD_OFFSET_MAX = 1 - PAD_HALF - PAD_EDGE_MARGIN;
/** Pads are not placed where the trail is bending harder than this. On a hard
 *  curve the centrifugal drift decides where the craft goes more than the player
 *  does, so a pad there is a coin toss rather than a line to take.
 *
 *  Raised from 3.2 when HUGE curves joined the course vocabulary: the intent is
 *  to exclude the corners you fight, not the ones you merely steer through, and
 *  that boundary moved when the corners got bigger. */
const PAD_MAX_CURVE = 4.5;

/* Hazard yellow, not Polaris cyan.
 *
 * Cyan was the obvious choice — it is the one colour on Mercury that is neither
 * sun nor stone, so it reads instantly — and it is now spoken for. The lift wash
 * under the craft, the thruster cores, the warp streaks and the slipstream are
 * all cyan, and a pad in the same colour was competing with the player's own
 * exhaust for the same slot in the eye.
 *
 * Yellow has the opposite problem and it is the one that had to be solved here:
 * the ground is warm regolith, so hue alone separates a gold plate from it very
 * poorly. The separation is therefore carried by VALUE, hard. The plate is much
 * darker than any ground the terrain sampler can produce and the chevron is much
 * brighter, so the pad reads as a dark slot with a light bar in it whatever
 * shade of dust it happens to be lying on. */
const PAD_PLATE = [0x2a, 0x1c, 0x06] as const;
const PAD_CORE = [0xff, 0xe0, 0x5c] as const;

/**
 * Where the pads go.
 *
 * `curveAt` rather than the segment array, so this file stays ignorant of the
 * scene: it needs one number per segment and has no business with the rest.
 */
export function scatterBoostPads(
  total: number,
  curveAt: (i: number) => number,
): Array<[number, BoostPadSlice]> {
  const out: Array<[number, BoostPadSlice]> = [];

  for (let i = PAD_STRIDE; i < total - PAD_LEN - 12; i += PAD_STRIDE) {
    /* Not every opportunity is taken. Evenly spaced pads would be a metronome,
       and a lap you can drive by rhythm instead of by looking is a lap with
       nothing in it. */
    if (hash(i, 0x71c3) > 0.75) continue;

    const at = i + Math.floor(hash(i, 0x2ea6) * (PAD_STRIDE - PAD_LEN - 8));
    if (at + PAD_LEN >= total - 12) continue;

    let bendy = false;
    for (let n = 0; n < PAD_LEN; n++) {
      if (Math.abs(curveAt(at + n)) > PAD_MAX_CURVE) bendy = true;
    }
    if (bendy) continue;

    /* Across the trail: sometimes down the middle, more often off to one side so
       taking it costs you your line into whatever comes next. */
    const r = hash(at, 0x4f2b);
    const offset =
      r < 0.34 ? 0 : (r < 0.67 ? -1 : 1) * (0.3 + hash(at, 0x9e17) * (PAD_OFFSET_MAX - 0.3));

    for (let n = 0; n < PAD_LEN; n++) {
      out.push([
        at + n,
        {
          offset,
          half: PAD_HALF,
          phase: n / (PAD_LEN - 1),
          plate: mixHex(PAD_PLATE, PAD_CORE, 0.1),
          core: mixHex(PAD_CORE, [0xff, 0xf6, 0xd0], 0.35),
        },
      ]);
    }
  }

  return out;
}
