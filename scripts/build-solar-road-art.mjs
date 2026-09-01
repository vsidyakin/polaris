/* Generates the SOLAR CIRCUIT artwork: three player craft at five bank angles
 * each, the exhaust flame, and the two Mercury parallax layers.
 *
 * The three boulder generators that stood here until Aug 2026 went with the
 * boulders themselves; see RoadScene.buildSprites() for why they were removed.
 * They are in the history if they are ever wanted back — being procedural is
 * exactly what makes that cheap.
 *
 *   node scripts/build-solar-road-art.mjs
 *
 * Run it only when the art changes — the PNGs it writes are committed, so a
 * build never depends on this script. That is the same arrangement as
 * scripts/build-zoom-frames.mjs.
 *
 * WHY THIS IS A SCRIPT AND NOT FOUR PNGs IN A FOLDER
 *
 * Every asset here is procedural: the star field is a seeded PRNG, the corona
 * is a radial falloff, the crater rims are summed sine ridges. Written as code
 * they are tunable — move the sun, thin the stars, change the palette — and
 * they stay reproducible. Written as PNGs they would be unmaintainable binary.
 *
 * The two backdrop layers TILE HORIZONTALLY, which is the constraint that
 * shapes most of the code below. They are drawn into a 1600px-wide texture that
 * Phaser scrolls with tilePositionX, so anything that touches the left or right
 * edge has to meet itself exactly. Every horizontal feature is therefore
 * generated as a function of an angle around the full width, never as a
 * function of x with a hard stop. Break that and a seam walks across the sky
 * every 1600px of travel.
 *
 * PNG encoding is hand-rolled: 8-bit RGBA, filter 0 on every row, one IDAT.
 * Nothing here needs a dependency, and the site has none for images.
 */

import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "eggs", "solar-road");

/* ---------------------------------------------------------------- PNG ---- */

const crcTable = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

const crc32 = (buf) => {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
};

const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};

/** A plain RGBA canvas with the handful of primitives this file needs. */
class Canvas {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.px = new Uint8Array(w * h * 4); // transparent black
  }

  /** Source-over composite of one pixel. `a` is 0..1. */
  blend(x, y, [r, g, b], a = 1) {
    x = Math.round(x);
    y = Math.round(y);
    if (a <= 0 || x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 4;
    const da = this.px[i + 3] / 255;
    const oa = a + da * (1 - a);
    if (oa <= 0) return;
    this.px[i] = Math.round((r * a + this.px[i] * da * (1 - a)) / oa);
    this.px[i + 1] = Math.round((g * a + this.px[i + 1] * da * (1 - a)) / oa);
    this.px[i + 2] = Math.round((b * a + this.px[i + 2] * da * (1 - a)) / oa);
    this.px[i + 3] = Math.round(oa * 255);
  }

  /** Opaque write, ignoring what was there. Faster and exact for backdrops. */
  set(x, y, [r, g, b], a = 255) {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 4;
    this.px[i] = r;
    this.px[i + 1] = g;
    this.px[i + 2] = b;
    this.px[i + 3] = a;
  }

  rect(x, y, w, h, col, a = 1) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.blend(x + i, y + j, col, a);
  }

  toPNG() {
    const raw = Buffer.alloc(this.h * (this.w * 4 + 1));
    for (let y = 0; y < this.h; y++) {
      const o = y * (this.w * 4 + 1);
      raw[o] = 0; // filter: none
      Buffer.from(this.px.buffer, y * this.w * 4, this.w * 4).copy(raw, o + 1);
    }
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(this.w, 0);
    ihdr.writeUInt32BE(this.h, 4);
    ihdr[8] = 8; // bit depth
    ihdr[9] = 6; // colour type: RGBA
    return Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      chunk("IHDR", ihdr),
      chunk("IDAT", deflateSync(raw, { level: 9 })),
      chunk("IEND", Buffer.alloc(0)),
    ]);
  }
}

/** Deterministic PRNG — the art must be byte-identical on every run, or every
 *  regeneration churns the repo with a "new" star field. */
const rng = (seed) => () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
};

const lerp = (a, b, t) => a + (b - a) * t;
const mix = (c1, c2, t) => [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)];
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (t) => t * t * (3 - 2 * t);

/* -------------------------------------------------------------- palette ---
 * Mercury has no atmosphere, so there is no blue and no aerial haze: the sky is
 * black to the horizon and the ground is lit like a spotlit stage. The one
 * thing it has in abundance is sun — three times the apparent size it has from
 * Earth — so the corona is the only light in the picture, and everything else
 * is either rim-lit by it or silhouetted against it.
 *
 * The Polaris cyan is the deliberate exception. It is the only colour on the
 * planet that is not sun or stone, which is what makes the lane markers and the
 * cable read instantly against it.
 */
const PAL = {
  space: [5, 6, 15],
  spaceLow: [14, 13, 30],
  corona1: [255, 240, 200],
  corona2: [255, 176, 92],
  corona3: [176, 74, 46],
  star: [214, 226, 255],
  starWarm: [255, 226, 186],
  rimLit: [198, 150, 106],
  ridgeFar: [38, 34, 48],
  ridgeMid: [26, 24, 36],
  ridgeNear: [15, 14, 24],
  cyan: [94, 240, 255],
};

/* ============================================================ sky layer ====
 * 1600x360, tiles horizontally. Star field, a low corona bloom, and the sun's
 * upper limb just clearing the bottom edge — the bottom of this texture sits
 * on the road's horizon, so the sun reads as sitting ON the horizon.
 *
 * Mercury's day is 176 Earth days long, so a sun that barely moves and never
 * sets is the honest picture as well as the dramatic one.
 */
function buildSky() {
  const W = 1600;
  /* Must equal the game's SKY_H, which is half the canvas height — a TileSprite
     taller than its texture repeats it, and a second sun limb halfway up the sky
     is not subtle. See the note on SKY_H in game-scene.ts. */
  const H = 360;
  const c = new Canvas(W, H);
  const rand = rng(0x5023);

  /* The sun sits at a fixed point in the texture. Because the layer tiles, it
     comes round again every 1600px of scroll — at the sky's parallax rate that
     is several minutes of driving, so it never reads as a repeat. */
  const sunX = 1180;
  const sunY = H + 26; // centre below the bottom edge: only the limb shows
  const sunR = 96;

  for (let y = 0; y < H; y++) {
    /* Vertical wash: pure space up top, a touch warmer towards the ground. */
    const base = mix(PAL.space, PAL.spaceLow, smooth(clamp01((y / H - 0.45) / 0.55)));
    for (let x = 0; x < W; x++) c.set(x, y, base);
  }

  /* Corona. Distance is measured on the shortest way round the texture, so the
     glow wraps the seam instead of being cut off at it. */
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let dx = x - sunX;
      if (dx > W / 2) dx -= W;
      if (dx < -W / 2) dx += W;
      const dy = (y - sunY) * 1.35; // squashed: the corona spreads along the horizon
      const d = Math.hypot(dx, dy);

      if (d < sunR) {
        /* The disc itself, blown out to white at the centre. */
        c.set(x, y, mix(PAL.corona1, [255, 255, 246], clamp01(1 - d / sunR)));
        continue;
      }
      /* Falloff: two stacked exponentials give a hot core and a long tail. */
      const t = (d - sunR) / 420;
      const glow = Math.exp(-t * 3.2) * 0.85 + Math.exp(-t * 0.9) * 0.28;
      if (glow < 0.004) continue;
      const col = mix(mix(PAL.corona2, PAL.corona3, clamp01(t * 1.5)), PAL.corona1, clamp01(1 - t * 3));
      c.blend(x, y, col, clamp01(glow));

      /* Coronal streamers — four faint spokes, the detail that makes it read as
         a corona rather than a lens flare. */
      if (d > sunR && d < 560) {
        const ang = Math.atan2(-(y - sunY), dx);
        const spoke = Math.pow(Math.abs(Math.cos(ang * 3.5 + 0.4)), 22);
        c.blend(x, y, PAL.corona1, clamp01(spoke * 0.3 * Math.exp(-t * 1.4)));
      }
    }
  }

  /* Stars, thinned near the corona where they would be washed out anyway. */
  const stars = 460;
  for (let i = 0; i < stars; i++) {
    const x = Math.floor(rand() * W);
    const y = Math.floor(Math.pow(rand(), 1.4) * (H - 40));
    let dx = x - sunX;
    if (dx > W / 2) dx -= W;
    if (dx < -W / 2) dx += W;
    const near = clamp01(1 - Math.hypot(dx, (y - sunY) * 1.35) / 620);
    const vis = 1 - near * 0.95;
    if (rand() > vis) continue;

    const bright = rand();
    const col = rand() < 0.22 ? PAL.starWarm : PAL.star;
    c.blend(x, y, col, clamp01(0.3 + bright * 0.7) * vis);
    /* A handful get a one-pixel cross so the field is not uniformly flat. */
    if (bright > 0.94) {
      const a = 0.35 * vis;
      c.blend(x - 1, y, col, a);
      c.blend(x + 1, y, col, a);
      c.blend(x, y - 1, col, a);
      c.blend(x, y + 1, col, a);
    }
  }

  return c;
}

/* ========================================================== ridge layer ====
 * 1600x200, tiles horizontally. Crater rims and scarps between the sky and the
 * road, scrolling faster than the sky.
 *
 * Three depth bands, back to front, each a sum of sines. Using sines of an
 * ANGLE around the texture — rather than of x — is what makes the silhouette
 * meet itself at the seam: every term completes a whole number of cycles across
 * the width, so x=0 and x=W are the same point on every curve.
 *
 * Only the top ~140px is ever on screen; the rest sits below the horizon under
 * the road, and exists so the layer can bob vertically without opening a gap.
 */
function buildRidge() {
  const W = 1600;
  const H = 200;
  const c = new Canvas(W, H);
  const rand = rng(0x1f77);

  const sunX = 1180; // must match buildSky, so the rim light comes from the sun

  /* Each band: base height, the sine terms (cycles across the width, amplitude,
     phase), its fill, and how strongly the sun rims its crest. */
  const bands = [
    { base: 96, terms: [[3, 26, 0.7], [7, 12, 2.1], [13, 6, 4.4], [23, 3, 1.2]], fill: PAL.ridgeFar, rim: 0.55, craters: 5 },
    { base: 128, terms: [[2, 30, 3.1], [5, 16, 0.4], [11, 8, 5.2], [19, 4, 2.7]], fill: PAL.ridgeMid, rim: 0.34, craters: 4 },
    { base: 158, terms: [[2, 22, 1.9], [4, 14, 4.8], [9, 7, 0.9]], fill: PAL.ridgeNear, rim: 0.18, craters: 3 },
  ];

  for (const band of bands) {
    /* Crater rims: a raised lip either side of a shallow bowl, placed at whole
       fractions of the width so they too survive the wrap. */
    const craters = [];
    for (let i = 0; i < band.craters; i++) {
      craters.push({ at: rand(), r: 40 + rand() * 90, depth: 6 + rand() * 12 });
    }

    const heightAt = (x) => {
      const a = (x / W) * Math.PI * 2;
      let h = band.base;
      for (const [cycles, amp, phase] of band.terms) h -= Math.sin(a * cycles + phase) * amp;
      for (const cr of craters) {
        let dx = x - cr.at * W;
        if (dx > W / 2) dx -= W;
        if (dx < -W / 2) dx += W;
        const t = Math.abs(dx) / cr.r;
        if (t < 1) {
          /* Lip up at the edges, floor down in the middle. */
          h -= Math.cos(t * Math.PI) * cr.depth * (1 - t * 0.35) * -1;
          h -= (1 - smooth(t)) * cr.depth * 0.9;
        }
      }
      return h;
    };

    for (let x = 0; x < W; x++) {
      const top = Math.round(heightAt(x));
      /* Rim light: only where the slope faces the sun, so the crests catch it
         on one side and fall dark on the other — the single cue that says
         "airless, one light source". */
      let dx = x - sunX;
      if (dx > W / 2) dx -= W;
      if (dx < -W / 2) dx += W;
      const facing = clamp01((heightAt(x - 4) - heightAt(x + 4)) * (dx > 0 ? -1 : 1) * 0.5);
      const near = clamp01(1 - Math.abs(dx) / 900);

      for (let y = top; y < H; y++) {
        const depth = clamp01((y - top) / 46);
        c.set(x, y, mix(band.fill, [0, 0, 0], depth * 0.5));
      }
      const lit = facing * near * band.rim;
      if (lit > 0.02) {
        c.blend(x, top, mix(PAL.rimLit, PAL.corona1, near * 0.5), clamp01(lit));
        c.blend(x, top + 1, PAL.rimLit, clamp01(lit * 0.45));
      }
    }
  }

  return c;
}

/* ---------------------------------------------------------------- keyline ---
 * A dark outline one pixel outside everything opaque. Both the ship and the
 * boulders need it for the same reason: the ground they are drawn against is
 * mid-value warm rock, and without a keyline a mid-value sprite dissolves into
 * it at speed.
 *
 * The alpha channel is SNAPSHOT first, and that is the whole subtlety here.
 * Testing the live buffer while writing into it makes the outline its own
 * neighbour: the pixel written at x satisfies the "touches something opaque"
 * test for x+1, which writes x+1, which qualifies x+2, and the keyline floods
 * outwards in scan order until it has filled the sprite's whole bounding box
 * with a dark rectangle. A morphological pass has to read a frozen copy.
 *
 * Call it AFTER the solid parts of a sprite and BEFORE any glow or plume: those
 * are soft washes over empty space, and outlining a wash draws a dark halo
 * around thin air.
 */
function keyline(c, col, a = 0.85) {
  const { w: W, h: H } = c;
  const alpha = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) alpha[i] = c.px[i * 4 + 3];

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (alpha[y * W + x] > 40) continue;
      let touches = false;
      for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + ox;
        const ny = y + oy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        if (alpha[ny * W + nx] > 120) touches = true;
      }
      if (touches) c.blend(x, y, col, a);
    }
  }
}

/* ====================================================== the player's skiff ====
 * 88x58, and five frames of it: level, banking left and right, and banking HARD
 * left and right. One function draws all five from `lean` (-2..+2).
 *
 * A Mersive hovercraft seen from behind and slightly above, running down the
 * trail. Reading the frame bottom to top: the lift wash and contact shadow on
 * the ground, then a GAP OF EMPTY PIXELS — the craft has no wheels and never
 * touches Mercury — then the rear face nearest the camera with its twin
 * thrusters, the deck foreshortening away from us with the canopy and the
 * Mersive roundel on it, and the nose furthest away at the top.
 *
 * WHY ALL FIVE FRAMES COME OUT OF ONE FUNCTION
 *
 * A banked frame is not a different craft, it is the same craft under a
 * transform: roll it about its own long axis, yaw the nose into the turn, slide
 * it a couple of pixels that way, and burn the outboard thruster harder.
 * Describing that transform ONCE — as `put()`, which every mark in this function
 * goes through — means the five frames cannot disagree about what the craft is,
 * only about how hard it is leaning. Five hand-drawn sprites would drift apart
 * the first time anything changed, and the two hard frames are the proof of it:
 * they cost one constant, not a redraw.
 *
 * HOW HARD "HARD" IS
 *
 * 1.7, not 2. The transform is linear and the frame is not: at double the roll
 * the low flank and its plume run off the bottom edge and the outboard fin tip
 * runs off the side. 1.7 is the most the geometry takes while everything still
 * fits inside 88x58, and it is a visibly bigger lean than the first stage
 * without the craft looking like it has been dropped.
 *
 * ALL FIVE FRAMES ARE THE SAME SIZE, AND THAT IS LOAD-BEARING
 *
 * Car swaps the texture on a live sprite whose resting Y was computed from the
 * frame height. A banked frame even one pixel taller would make the craft hop
 * down the screen every time the player touched an arrow key. Everything below
 * stays inside 88x58 whatever `lean` is, which is why the frame carries visible
 * headroom above the nose and below the plumes.
 */
/* The three craft. A ship is a hull ramp, an engine colour and two dimensions;
 * everything else about the sprite — the transform, the lighting, the roundel,
 * the fins, the plumes — is shared, which is what keeps them recognisably the
 * same class of machine and keeps this one function rather than three.
 *
 * The hull ramps run light to dark in five steps, pulled from the site's own
 * tokens rather than invented: brand purple for VECTOR, copper for LANCE, the
 * go-green for BULWARK. The engine colour moves with them — an amber craft with
 * cyan thrusters reads as two objects — and that is the one place it costs
 * something, because Polaris cyan is what everything else on Mercury uses to say
 * "powered". Two of the three give it up; the pads, the warp streaks and the
 * slipstream keep it. */
const SHIPS = {
  vector: {
    hull: [[176, 158, 255], [141, 122, 224], [109, 91, 184], [74, 53, 133], [40, 28, 74]],
    glow: [94, 240, 255],
    glowPale: [198, 250, 255],
    nose: 12,
    rear: 33,
  },
  lance: {
    hull: [[255, 196, 158], [235, 150, 108], [196, 106, 68], [138, 66, 44], [72, 32, 24]],
    glow: [255, 176, 92],
    glowPale: [255, 228, 190],
    /* Narrower at both ends: it is the one meant to look built for straights. */
    nose: 9,
    rear: 29,
  },
  bulwark: {
    hull: [[168, 245, 200], [116, 214, 162], [74, 168, 122], [42, 112, 82], [20, 58, 44]],
    glow: [124, 227, 168],
    glowPale: [212, 252, 228],
    /* Wide-set and blunt. */
    nose: 15,
    rear: 37,
  },
};

function buildHover(lean, shipId) {
  const SHIP = SHIPS[shipId];
  /* Direction and magnitude, separated. Everything downstream that asks "which
     way is it leaning" wants the sign and everything that asks "how far" wants
     the magnitude — conflating them is what would break the outboard-thruster
     test the moment a second stage of lean existed. */
  const steer = Math.sign(lean);
  const hard = Math.abs(lean) > 1 ? 1.7 : 1;
  const W = 88;
  const H = 58;
  const c = new Canvas(W, H);
  const cx = (W - 1) / 2;

  /* --- layout -------------------------------------------------------------
   * The deck runs from NOSE_Y (far, narrow) to REAR_Y (near, wide); the rear
   * FACE hangs below that, and everything else is placed off those three
   * numbers.
   *
   * The proportion between deck and face is the one measurement here that
   * decides whether the sprite reads at all. The first pass gave the deck 27
   * rows and the face 8, and what came out was a beetle: an enormous purple
   * shell with two glowing dots under the front of it, which the eye insisted on
   * reading as a face with headlights. We are looking at this thing from BEHIND
   * — the back of it is the surface pointed at us, and it has to be big enough
   * to carry the engines and the skirt and still look like a back. Twenty-two
   * rows of deck to eleven of face is what stopped it being an insect. */
  const NOSE_Y = 10;
  const REAR_Y = 31;
  const FACE_BOT = 42;
  /* Half-width along the deck. The exponent below 1 puts the flare towards the
     nose, which is what makes it read as a wedge rather than a triangle. */
  const halfAt = (t) => lerp(SHIP.nose, SHIP.rear, Math.pow(clamp01(t), 0.85));
  const REAR_HALF = halfAt(1);

  /* --- the bank transform -------------------------------------------------
   * ROLL is a shear about the centre line: on a left bank the left flank drops
   * and the right rises, which is what a craft rolling towards you looks like
   * from behind. YAW swings the nose into the turn and leaves the rear where it
   * is, so a banked frame shows a little of the outboard flank. SLIDE nudges
   * the whole craft the same way — the car is pinned to the centre of the
   * screen by the engine, so this couple of pixels is the only lateral movement
   * the player ever sees from the sprite itself. */
  const ROLL = 0.2;
  const YAW = 5;
  const SLIDE = 2;
  const roll = steer * ROLL * hard;
  const slide = steer * SLIDE * hard;
  const tAt = (by) => (by - NOSE_Y) / (REAR_Y - NOSE_Y);
  const yawAt = (by) => steer * YAW * hard * (1 - clamp01(tAt(by)));

  /** Body space -> canvas. Every mark in this function goes through it. */
  const put = (bx, by, col, a = 1) => {
    const x = bx + slide + yawAt(by);
    c.blend(x, by + roll * (x - cx), col, a);
  };

  /** A filled ellipse in body space; `fn(x, y, d)` gets d = 0 at the centre and
   *  1 at the rim. Walked at a third of a pixel because `put()` shears what it
   *  plots, and a whole-pixel walk leaves holes in a banked frame. */
  const ellipse = (ex, ey, rx, ry, fn) => {
    for (let y = -ry; y <= ry; y += 0.34) {
      for (let x = -rx; x <= rx; x += 0.34) {
        const d = Math.hypot(x / rx, y / ry);
        if (d <= 1) fn(ex + x, ey + y, d);
      }
    }
  };

  /* --- palette ------------------------------------------------------------
   * The site's brand purple, as a five-step ramp, plus the Polaris cyan for
   * everything that is powered. Purple hull against warm regolith is the same
   * separation the trail relies on — cool object, warm ground — and it is the
   * one colour on Mercury that says Mersive without a wordmark on the boot,
   * which is the trap upstream's art fell into.
   *
   * The single warm value, `rim`, is the sun: it sits on the horizon to the
   * right of the backdrop (see buildSky's sunX), so the craft's right flank
   * catches a hard edge of it and its left flank gets nothing. No atmosphere
   * means no fill light, so the terminator between them is abrupt — the same
   * rule the boulders are lit by. */
  const P = {
    hullHi: SHIP.hull[0],
    hullLit: SHIP.hull[1],
    hull: SHIP.hull[2],
    hullDark: SHIP.hull[3],
    hullDeep: SHIP.hull[4],
    /* The sun is the sun on all three. */
    rim: [255, 204, 150],
    /* Rear face and nozzle housings are unpainted metal, tinted a third of the
       way towards the hull so they read as part of the same machine. */
    plate: mix([58, 52, 74], SHIP.hull[3], 0.35),
    plateDark: mix([26, 24, 34], SHIP.hull[4], 0.35),
    vent: [16, 14, 22],
    glass: [22, 26, 48],
    glassLit: [96, 122, 178],
    ink: [226, 217, 255],
    cyan: SHIP.glow,
    cyanPale: SHIP.glowPale,
    hot: [246, 252, 255],
    outline: [10, 9, 20],
  };

  /* --- deck --------------------------------------------------------------- */
  for (let by = NOSE_Y; by <= REAR_Y; by++) {
    const t = tAt(by);
    const half = halfAt(t);
    for (let u = -half; u <= half; u += 0.34) {
      const across = clamp01((u + half) / (2 * half));
      /* Lit from the right, hard. */
      const l = Math.pow(across, 1.7);
      let col = l > 0.6 ? mix(P.hull, P.hullHi, (l - 0.6) / 0.4) : mix(P.hullDeep, P.hull, l / 0.6);
      /* The near end of the deck is in the craft's own shadow. */
      col = mix(col, P.hullDeep, 0.24 * t);
      /* Leading edge: the nose is the one surface angled up into the sun. */
      if (by < NOSE_Y + 3) col = mix(col, P.hullHi, 0.45 * (1 - (by - NOSE_Y) / 3));
      /* Flank edges — a lit lip on the sun side, a dark one away from it. */
      if (u > half - 1.7) col = mix(P.rim, P.hullHi, 0.45);
      else if (u < -half + 1.7) col = mix(col, P.hullDeep, 0.7);
      put(cx + u, by, col);
    }
  }

  /* A pair of chine lines down the deck, inboard of the flanks. They cost two
     pixels a row and they are most of what stops the deck reading as a flat
     purple wedge. */
  for (let by = NOSE_Y + 3; by <= REAR_Y - 2; by++) {
    const half = halfAt(tAt(by));
    for (const s of [-1, 1]) {
      put(cx + s * half * 0.62, by, s > 0 ? mix(P.hullHi, P.rim, 0.3) : P.hullDark, 0.75);
    }
  }

  /* --- rear face ---------------------------------------------------------
     The vertical back of the craft, facing the camera square-on. It gets no
     sun at all — the light is ahead and to the side — so it is the darkest
     thing on the hull, which is exactly what makes the thrusters in it read.

     The LIP above it is what makes it read as a separate surface rather than a
     dark patch of deck. Two planes meeting at right angles under a single hard
     light source give a hard line, so there is a hard line: one bright row where
     the deck ends, then everything below it in shadow. Without it the whole
     rear of the craft mushes into one silhouette and the thrusters look stuck
     onto the underside. */
  const faceHalfAt = (by) => REAR_HALF - 1.5 - ((by - REAR_Y) / (FACE_BOT - REAR_Y)) * 3.5;

  for (let u = -(REAR_HALF - 1); u <= REAR_HALF - 1; u += 0.34) {
    const across = clamp01((u + REAR_HALF) / (2 * REAR_HALF));
    put(cx + u, REAR_Y, mix(mix(P.hullLit, P.hullHi, across), P.rim, Math.pow(across, 3) * 0.5), 0.95);
  }
  for (let by = REAR_Y + 1; by <= FACE_BOT; by++) {
    const t = (by - REAR_Y) / (FACE_BOT - REAR_Y);
    const half = faceHalfAt(by);
    for (let u = -half; u <= half; u += 0.34) {
      const across = clamp01((u + half) / (2 * half));
      const col = mix(mix(P.plateDark, P.plate, Math.pow(across, 1.4)), P.hullDeep, t * 0.3);
      put(cx + u, by, col);
    }
  }

  /* Grille slots across the middle of the face, between the engines. Their real
     job is to break up the pair of glowing circles: two lights alone on a dark
     panel is a face however the rest of the craft is drawn, and a row of
     louvres between them is the cheapest thing that stops it. */
  for (const by of [REAR_Y + 3, REAR_Y + 5, REAR_Y + 7]) {
    for (let u = -8.5; u <= 8.5; u += 0.34) {
      put(cx + u, by, mix(P.vent, P.plateDark, 0.35), 0.85);
    }
  }

  /* Lift skirt along the bottom edge — the surface the emitters fire through,
     so it catches their light. */
  for (let u = -faceHalfAt(FACE_BOT); u <= faceHalfAt(FACE_BOT); u += 0.34) {
    const across = clamp01(1 - Math.abs(u) / faceHalfAt(FACE_BOT));
    put(cx + u, FACE_BOT, mix(P.plate, P.cyan, 0.25 + across * 0.3), 0.9);
  }

  /* --- thruster housings -------------------------------------------------
     Two of them, set well apart in the face. The cores and plumes go on after
     the keyline; this is just the metal they sit in. */
  const NOZZLE_X = 17;
  const NOZZLE_Y = REAR_Y + 5.5;
  for (const s of [-1, 1]) {
    ellipse(cx + s * NOZZLE_X, NOZZLE_Y, 8, 5, (x, y, d) => {
      put(x, y, d > 0.72 ? mix(P.plate, P.hullHi, (d - 0.72) * 1.2) : P.vent);
    });
  }

  /* --- fins --------------------------------------------------------------
     Two swept blades standing up from the rear corners. They are the tallest
     thing on the craft and they are NEAREST the camera, so they project up the
     screen and across the deck behind them — which is why they are drawn after
     it. They also carry the only silhouette that changes shape when the craft
     banks, which is what makes a bank readable in peripheral vision.

     Each one is a TRIANGLE with a long root, not a stick. The first pass drew
     them as a column of pixels rising from the rear corner, and because the hull
     narrows towards the nose while the fin does not, the blade cleared the
     silhouette three rows up and read as an insect leg waving in space. A fin
     needs a chord: the root has to run some way FORWARD along the flank it grows
     out of, so the eye can see where it joins. */
  for (const s of [-1, 1]) {
    /* A QUAD, not a triangle: the blade keeps a chord at the top. Tapered to a
       point it grew a thin neck under the nav light and went back to reading as
       an antenna with a bead on the end — the thing the long root was added to
       fix. Squared off, the light sits on a tip wide enough to belong to it. */
    const TOP = REAR_Y - 13;
    const quad = [
      [cx + s * halfAt(tAt(REAR_Y - 10)) * 0.99, REAR_Y - 10], // root, forward
      [cx + s * REAR_HALF * 0.95, REAR_Y], // root, aft
      [cx + s * REAR_HALF * 1.06, TOP], // tip, aft
      [cx + s * REAR_HALF * 0.94, TOP + 1.5], // tip, forward
    ];

    /* Scanline it in body space; `put()` handles the bank. */
    const edgeX = (a, b, y) => (Math.abs(b[1] - a[1]) < 1e-6 ? a[0] : a[0] + ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]));

    for (let by = TOP; by <= REAR_Y; by += 0.5) {
      const xs = [];
      for (let i = 0; i < quad.length; i++) {
        const a = quad[i];
        const b = quad[(i + 1) % quad.length];
        if (by >= Math.min(a[1], b[1]) && by <= Math.max(a[1], b[1])) xs.push(edgeX(a, b, by));
      }
      if (xs.length < 2) continue;
      const x0 = Math.min(...xs);
      const x1 = Math.max(...xs);
      const rise = clamp01((REAR_Y - by) / (REAR_Y - TOP));
      for (let x = x0; x <= x1; x += 0.34) {
        /* Edge-on to the camera, so the blade is mostly a dark sliver: one lit
           edge on the sun side, and darker the higher it stands away from the
           light bouncing off the deck. */
        const across = x1 - x0 < 0.7 ? 1 : (x - x0) / (x1 - x0);
        const lit = s > 0 ? across : 1 - across;
        const col = mix(mix(P.hullDeep, P.hullDark, lit), s > 0 ? P.rim : P.hull, Math.pow(lit, 3) * 0.55);
        put(x, by, mix(col, P.hullDeep, rise * 0.35));
      }
      /* A cyan strip up the trailing edge — the edge facing the camera. */
      put(s > 0 ? x0 : x1, by, mix(P.cyan, P.hullDeep, 0.45), 0.6);
      /* Nav light: the top of the blade itself, not a bead above it. */
      if (rise > 0.93) {
        for (let x = x0; x <= x1; x += 0.34) put(x, by, mix(P.cyanPale, P.hot, 0.4), 0.95);
      }
    }
  }

  /* --- canopy ------------------------------------------------------------
     Dark glass with ONE specular. Two highlights make a dome read as plastic,
     and none at all — the first pass — makes it read as a hole punched in the
     deck, which at this size is the failure that matters: a black ellipse on a
     purple wedge is a missing pixel, not a cockpit.

     So the glass is lifted well off black, the specular is hard-edged rather
     than a soft falloff, and there is a lit frame along the top rim and a cyan
     spill along the bottom one. The spill is the instrument light inside, and it
     is the detail that says somebody is flying this. */
  const CANOPY_Y = 18;
  const CANOPY_RX = 8;
  const CANOPY_RY = 4.4;
  ellipse(cx, CANOPY_Y, CANOPY_RX, CANOPY_RY, (x, y, d) => {
    const spec = clamp01(1 - Math.hypot((x - (cx - 2.6)) / 3.6, (y - (CANOPY_Y - 1.9)) / 1.9));
    let col = mix(P.glass, mix(P.glass, P.glassLit, 0.55), Math.pow(clamp01(1 - d), 0.7));
    if (spec > 0.45) col = mix(P.glassLit, P.ink, (spec - 0.45) * 1.4);
    put(x, y, col);
  });
  /* Rim: lit frame on the top edge, instrument spill on the bottom. */
  for (let u = -CANOPY_RX + 0.5; u <= CANOPY_RX - 0.5; u += 0.34) {
    const dy = CANOPY_RY * Math.sqrt(clamp01(1 - (u / CANOPY_RX) ** 2));
    put(cx + u, CANOPY_Y - dy, mix(P.hullHi, P.ink, 0.5), 0.9);
    put(cx + u, CANOPY_Y + dy, mix(P.cyan, P.glassLit, 0.4), 0.75);
  }

  /* --- deck detail -------------------------------------------------------
     Two intake slots either side of the canopy and a spine down the nose. Three
     marks, and the deck stops being a flat purple wedge. */
  for (const s of [-1, 1]) {
    for (let k = 0; k < 3; k++) {
      const by = 21 + k * 2;
      const half = halfAt(tAt(by));
      for (let u = half * 0.42; u <= half * 0.56; u += 0.34) {
        put(cx + s * u, by, P.hullDeep, 0.7);
      }
    }
  }
  for (let by = NOSE_Y + 1; by < CANOPY_Y - 4; by++) {
    put(cx, by, mix(P.hullHi, P.ink, 0.3), 0.5);
  }

  /* --- the Mersive roundel ----------------------------------------------
     On the deck between the canopy and the thrusters, and squashed to 0.55 of
     its width because it is a decal lying flat on a surface we are looking
     along rather than at.

     It is the mark's SILHOUETTE only: the broken ring and the dot in the gap.
     The lowercase m inside the real ring needs about seven pixels of height to
     resolve and it has four here, so drawing it would produce three grey smudges
     and a worse read than leaving it out. The broken ring is the part anyone
     recognises at a glance, and it is the part that survives the scale. */
  const RX = 5.6;
  const RY = 2.9;
  const MARK_Y = 28;
  /* One pixel of stroke. The first pass swept r from 0.86 to 1 and the resulting
     two-pixel ring, on a shape only seven pixels tall, closed up into a white
     blob — a scribble on the deck rather than a mark. At this size the ring can
     be a ring or it can have weight, not both. */
  for (let a = 0; a < Math.PI * 2; a += 0.015) {
    /* The gap sits low and right, as it does on the mark. */
    if (a > 0.30 && a < 1.05) continue;
    put(cx + Math.cos(a) * RX, MARK_Y + Math.sin(a) * RY, P.ink, 0.9);
  }
  /* The dot, in the mouth of the gap. On the real mark it sits out at the ring's
     own radius; put there at this scale it merges with the two ring ends into a
     single lump, so it comes inboard far enough to read as a separate mark. */
  put(cx + Math.cos(0.66) * RX * 0.6, MARK_Y + Math.sin(0.66) * RY * 0.6, P.ink, 0.9);

  /* --- keyline ----------------------------------------------------------- */
  keyline(c, P.outline, 0.85);

  /* --- contact shadow ---------------------------------------------------
     A pool of dark under the craft. On an airless planet lit from the horizon
     the true shadow would be a long streak thrown sideways, not a pool — this
     is the same readability device the boulders' keyline is, and it is here
     because without something dark between the hull and the ground the craft
     reads as pasted onto the trail rather than floating over it.

     It leans with the craft: the low flank of a bank is nearer the ground, so
     the pool slides that way. */
  ellipse(cx + slide * 1.5, 50, REAR_HALF * 0.5, 2.8, (x, y, d) => {
    c.blend(x, y, [4, 4, 10], clamp01(Math.pow(1 - d, 1.5) * 0.32));
  });

  /* --- lift wash -------------------------------------------------------
     This one IS diegetic: it is the light of the lift emitters on the ground
     under the hull, which is why it is cyan and the shadow is not. Two brighter
     pools under the emitters themselves, over a broad wash.

     Drawn straight onto the canvas rather than through `put()`. The wash is
     cast ON THE GROUND, and the ground does not bank when the craft does. */
  ellipse(cx, 47, REAR_HALF * 0.7, 4.5, (x, y, d) => {
    c.blend(x, y, P.cyan, clamp01(Math.pow(1 - d, 2.2) * 0.13));
  });
  for (const s of [-1, 1]) {
    ellipse(cx + s * 19, 46, 6, 2.8, (x, y, d) => {
      c.blend(x, y, mix(P.cyan, P.cyanPale, 0.4), clamp01(Math.pow(1 - d, 1.9) * 0.16));
    });
  }

  /* --- thruster cores and plumes ---------------------------------------
     Last, over everything, because they are the brightest thing in the frame
     and nothing occludes them.

     The outboard thruster burns harder in a banked frame. That is not
     decoration: differential thrust is HOW a craft with no wheels turns, so
     the frame that shows the player turning left shows the right-hand engine
     doing the work. It is also the second cue — after the fins — that reads
     at a glance. */
  for (const s of [-1, 1]) {
    const flare = steer === 0 ? 1 : s === steer ? 0.68 : 1.2;

    /* the core, looked straight into */
    ellipse(cx + s * NOZZLE_X, NOZZLE_Y, 6.2, 3.6, (x, y, d) => {
      const col =
        d < 0.34 ? mix(P.hot, P.cyanPale, d / 0.34)
        : d < 0.7 ? mix(P.cyanPale, P.cyan, (d - 0.34) / 0.36)
        : mix(P.cyan, [46, 96, 190], (d - 0.7) / 0.3);
      put(x, y, col, clamp01((1 - d * 0.35) * flare));
    });

    /* the plume, flaring down and back towards the camera, and vectored
       against the turn — a left bank throws its wash out to the right */
    for (let k = 0; k <= 9; k++) {
      const t = k / 9;
      const by = FACE_BOT - 2 + k;
      const half = lerp(6, 10, t);
      const bx = cx + s * NOZZLE_X - steer * hard * t * 3.5;
      for (let u = -half; u <= half; u += 0.34) {
        const across = clamp01(1 - Math.abs(u) / half);
        const heat = Math.pow(across, 1.5) * (1 - Math.pow(t, 1.15));
        const col = heat > 0.62 ? mix(P.cyanPale, P.hot, (heat - 0.62) / 0.38) : mix(P.cyan, P.cyanPale, heat / 0.62);
        put(bx + u, by, col, clamp01(heat * 0.6 * flare));
      }
    }
  }

  return c;
}

/* ============================================================ exhaust cone ====
 * 44x64, hung from a thruster nozzle and scaled by the game as the craft speeds
 * up. Two of them, one per engine; see `exhaust.ts`.
 *
 * WHY THIS IS NOT PART OF THE SHIP FRAMES
 *
 * The ship sprites carry a plume already, and it is the right size for the speed
 * they were drawn at. It cannot grow, because it is baked into a PNG — and
 * baking a plume per speed step would mean the frame count multiplying by
 * however many steps looked smooth, in all three bank positions.
 *
 * So the baked plume stays as the engine's idle wash, and this is what gets
 * added on top of it and scaled. It is drawn behind the craft and composited
 * ADDITIVELY, which is the whole reason it can be scaled at all: an additive
 * layer over its own idle glow reads as one hotter flame, where an alpha-blended
 * one would read as a second translucent object sitting in front of the first.
 *
 * Anchored near its own top edge rather than its centre, so the game can pin it
 * to a nozzle and have it grow DOWNWARD and outward from there — scaling about
 * the centre would walk the flame up into the hull as it got bigger.
 */
function buildPlume() {
  const W = 44;
  const H = 64;
  const c = new Canvas(W, H);
  const cx = (W - 1) / 2;

  const cyan = PAL.cyan;
  const pale = [198, 250, 255];
  const hot = [250, 253, 255];

  for (let y = 0; y < H; y++) {
    const t = y / (H - 1);
    /* Flares fast out of the throat, then opens out slowly. */
    const half = lerp(4, 21, Math.pow(t, 0.75));
    for (let x = 0; x < W; x++) {
      const across = clamp01(1 - Math.abs(x - cx) / half);
      if (across <= 0) continue;
      /* Hot down the middle, and cooling along its length — the two falloffs
         together are what make it a flame rather than a cone of paint. */
      const heat = Math.pow(across, 1.7) * (1 - Math.pow(t, 1.25));
      if (heat < 0.01) continue;
      const col = heat > 0.66 ? mix(pale, hot, (heat - 0.66) / 0.34) : mix(cyan, pale, heat / 0.66);
      c.blend(x, y, col, clamp01(heat * 0.92));
    }
  }

  return c;
}

/* ============================================================ menu splash ====
 * 940x300, the hero image on the main menu. The one asset here that is not
 * something the game draws with — it exists to be looked at once, before a run.
 *
 * WHY IT IS A GENERATED SCENE AND NOT A SCREENSHOT
 *
 * A screenshot of the game would be the obvious splash, and it would go stale
 * the first time the palette or the craft changed, silently, with nothing to
 * catch it. Rebuilt from the same primitives the game itself uses — the corona
 * falloff from buildSky, the summed-sine ridges from buildRidge, the trail and
 * verge values from terrain.ts, and the actual VECTOR sprite composited in — it
 * cannot drift out of step with what the player is about to see. Regenerate the
 * art and the splash regenerates with it.
 *
 * THE PERSPECTIVE IS THE REAL ONE, AND IT IS ONE LINE
 *
 * For flat ground the projected half-width of a road is exactly proportional to
 * the distance below the horizon on screen — so the trail here is a linear
 * taper, not an eyeballed triangle, and it converges the way the engine's
 * projection converges. The bend is squared with distance for the same reason
 * curvature accumulates that way in the projection.
 */
function buildSplash() {
  const W = 940;
  const H = 300;
  const HORIZON = 150;
  const c = new Canvas(W, H);
  const rand = rng(0x7c41);

  /* The sun sits right of centre, as it does in the sky texture — everything in
     this picture is lit from there or hiding from it. */
  const sunX = W * 0.72;
  const sunY = HORIZON + 20;
  const sunR = 40;

  /* --- sky ---------------------------------------------------------------- */
  for (let y = 0; y < HORIZON; y++) {
    const base = mix(PAL.space, PAL.spaceLow, smooth(clamp01(y / HORIZON)));
    for (let x = 0; x < W; x++) c.set(x, y, base);
  }

  for (let y = 0; y < HORIZON; y++) {
    for (let x = 0; x < W; x++) {
      const d = Math.hypot(x - sunX, (y - sunY) * 1.5);
      if (d < sunR) {
        c.set(x, y, mix(PAL.corona1, [255, 255, 246], clamp01(1 - d / sunR)));
        continue;
      }
      const t = (d - sunR) / 300;
      const glow = Math.exp(-t * 3.2) * 0.85 + Math.exp(-t * 0.9) * 0.3;
      if (glow < 0.004) continue;
      c.blend(x, y, mix(mix(PAL.corona2, PAL.corona3, clamp01(t * 1.5)), PAL.corona1, clamp01(1 - t * 3)), clamp01(glow));
      /* Coronal streamers — the detail that makes it a corona and not a flare. */
      if (d < 340) {
        const ang = Math.atan2(-(y - sunY), x - sunX);
        c.blend(x, y, PAL.corona1, clamp01(Math.pow(Math.abs(Math.cos(ang * 3.5 + 0.4)), 22) * 0.3 * Math.exp(-t * 1.4)));
      }
    }
  }

  for (let i = 0; i < 320; i++) {
    const x = Math.floor(rand() * W);
    const y = Math.floor(Math.pow(rand(), 1.5) * (HORIZON - 12));
    const vis = 1 - clamp01(1 - Math.hypot(x - sunX, (y - sunY) * 1.5) / 380) * 0.95;
    if (rand() > vis) continue;
    c.blend(x, y, rand() < 0.22 ? PAL.starWarm : PAL.star, clamp01(0.3 + rand() * 0.7) * vis);
  }

  /* --- ridges ------------------------------------------------------------- */
  const bands = [
    { base: 34, terms: [[3, 13, 0.7], [7, 6, 2.1], [13, 3, 4.4]], fill: PAL.ridgeFar, rim: 0.55 },
    { base: 20, terms: [[2, 15, 3.1], [5, 8, 0.4], [11, 4, 5.2]], fill: PAL.ridgeMid, rim: 0.34 },
    { base: 11, terms: [[2, 11, 1.9], [4, 7, 4.8]], fill: PAL.ridgeNear, rim: 0.18 },
  ];
  for (const band of bands) {
    const heightAt = (x) => {
      const a = (x / W) * Math.PI * 2;
      let h = HORIZON - band.base;
      for (const [cy, amp, ph] of band.terms) h -= Math.sin(a * cy + ph) * amp;
      return h;
    };
    for (let x = 0; x < W; x++) {
      const top = Math.round(heightAt(x));
      for (let y = top; y < HORIZON; y++) c.set(x, y, mix(band.fill, [0, 0, 0], clamp01((y - top) / 30) * 0.5));
      /* Rim light only where the slope faces the sun. */
      const facing = clamp01((heightAt(x - 4) - heightAt(x + 4)) * (x > sunX ? -1 : 1) * 0.5);
      const near = clamp01(1 - Math.abs(x - sunX) / 420);
      const lit = facing * near * band.rim;
      if (lit > 0.02) c.blend(x, top, mix(PAL.rimLit, PAL.corona1, near * 0.5), clamp01(lit));
    }
  }

  /* --- ground ------------------------------------------------------------- */
  const TRAIL_DARK = [0x24, 0x1e, 0x17];
  const TRAIL_LIGHT = [0x5f, 0x52, 0x40];
  const VERGE_DARK = [0x57, 0x4b, 0x3b];
  const VERGE_LIGHT = [0xab, 0x98, 0x78];
  const BERM = [0x8c, 0x7b, 0x60];

  /* 0 at the bottom edge, 1 at the horizon. */
  const depthAt = (y) => 1 - (y - HORIZON) / (H - HORIZON);
  /* Half the frame, not all of it. At 470 the trail ran to both edges at the
     bottom and the verge only existed near the horizon, which reads as open
     ground with a dark patch on it rather than as a line worn across regolith —
     the verge either side is the thing that says "trail". */
  const MAX_HALF = 300;
  const BEND = 210;
  const centreAt = (y) => W / 2 + BEND * Math.pow(depthAt(y), 2.2);
  const halfAt = (y) => MAX_HALF * (1 - depthAt(y));

  /* Per-row value noise, SMOOTHED against the row above.
   *
   * Drawn independently it reads as scanlines rather than as ground: the whole
   * width of a row shares one value, so any row-to-row difference is a hard
   * horizontal edge running the width of the picture. Carrying two thirds of the
   * previous row forward turns that into a drift, which is what dust lying in
   * patches actually looks like. */
  let n = 0.5;
  for (let y = HORIZON; y < H; y++) {
    const depth = depthAt(y);
    const cxr = centreAt(y);
    const half = halfAt(y);
    n = n * 0.68 + (rand() * 0.3 + Math.sin(y * 0.21) * 0.08 + 0.36) * 0.32;
    const berm = Math.max(1.5, half * 0.055);

    for (let x = 0; x < W; x++) {
      const off = Math.abs(x - cxr);
      let col;
      /* The trail is dark bedrock swept clean; the verge is loose sunlit dust.
         The separation between them is carried by VALUE and it has to be plain,
         because it is the only thing in the picture that says which part of the
         ground is the one you drive on. */
      if (off < half) col = mix(TRAIL_DARK, TRAIL_LIGHT, clamp01(n * 0.55 + (1 - off / Math.max(1, half)) * 0.12));
      else if (off < half + berm) col = mix(BERM, VERGE_DARK, n * 0.5);
      else col = mix(VERGE_DARK, VERGE_LIGHT, clamp01(0.35 + n * 0.75));
      c.set(x, y, col);
    }
    /* Fog into the sky at the horizon, exactly as the game hides its draw cut. */
    const fog = Math.pow(depth, 2.2);
    if (fog > 0.004) for (let x = 0; x < W; x++) c.blend(x, y, PAL.space, clamp01(fog));
  }

  /* Boost pads: three chevrons receding up the trail, each at the width the
     trail actually has where it lies, and each pushed far enough off the centre
     line to clear the craft — which occupies most of the near trail. */
  for (const [at, side] of [[0.16, -0.78], [0.4, 0.72], [0.6, -0.6]]) {
    const y0 = H - (H - HORIZON) * at;
    const rows = Math.max(4, Math.round(16 * (1 - at)));
    for (let k = 0; k < rows; k++) {
      const y = Math.round(y0 - k * 1.6);
      if (y <= HORIZON + 3) break;
      const half = halfAt(y);
      const cxr = centreAt(y) + half * side;
      const plate = Math.max(2, half * 0.26);
      const core = plate * (0.85 - (k / rows) * 0.72);
      for (let x = Math.round(cxr - plate); x <= cxr + plate; x++) c.blend(x, y, [0x2a, 0x1c, 0x06], 0.92);
      for (let x = Math.round(cxr - core); x <= cxr + core; x++) {
        c.blend(x, y, [0xff, 0xe0, 0x5c], clamp01(1 - depthAt(y) * 0.45));
      }
    }
  }

  /* --- the craft ---------------------------------------------------------- */
  const ship = buildHover(0, "vector");
  const scale = 3;
  const sx = Math.round(W / 2 - (ship.w * scale) / 2);
  const sy = H - ship.h * scale + 6;
  for (let y = 0; y < ship.h; y++) {
    for (let x = 0; x < ship.w; x++) {
      const i = (y * ship.w + x) * 4;
      const a = ship.px[i + 3] / 255;
      if (a <= 0) continue;
      const col = [ship.px[i], ship.px[i + 1], ship.px[i + 2]];
      for (let ry = 0; ry < scale; ry++) {
        for (let rx = 0; rx < scale; rx++) c.blend(sx + x * scale + rx, sy + y * scale + ry, col, a);
      }
    }
  }

  /* --- vignette ------------------------------------------------------------
     The image sits on a dark panel, and a hard rectangular edge against it reads
     as a screenshot pasted in. Fading the border lets it belong to the page. */
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const ex = clamp01(1 - Math.min(x, W - 1 - x) / 90);
      const ey = clamp01(1 - Math.min(y, H - 1 - y) / 54);
      const v = Math.max(ex * ex, ey * ey);
      if (v > 0.004) c.blend(x, y, [0x0b, 0x09, 0x18], clamp01(v * 0.95));
    }
  }

  return c;
}

/* ------------------------------------------------------------------ main -- */

mkdirSync(OUT, { recursive: true });

const outputs = [
  ["sky.png", buildSky()],
  ["ridge.png", buildRidge()],
  /* The menu hero. Composites the VECTOR sprite, so it must come after the
     craft are defined; `buildHover` is called from inside it. */
  ["splash.png", buildSplash()],
  /* Five frames each of three craft. `ships.ts` names them and `car.ts` swaps
     between them on the arrow keys; every frame of every craft must stay the
     same size — see the note on buildHover. */
  ...Object.keys(SHIPS).flatMap((id) => [
    [`${id}.png`, buildHover(0, id)],
    [`${id}-left.png`, buildHover(-1, id)],
    [`${id}-right.png`, buildHover(1, id)],
    [`${id}-hard-left.png`, buildHover(-2, id)],
    [`${id}-hard-right.png`, buildHover(2, id)],
  ]),
  /* The scalable flame that goes on top of the baked-in one. */
  ["plume.png", buildPlume()],
];

for (const [name, canvas] of outputs) {
  const png = canvas.toPNG();
  writeFileSync(join(OUT, name), png);
  console.log(`[solar-road] ${name.padEnd(12)} ${canvas.w}x${canvas.h}  ${png.length} bytes`);
}
