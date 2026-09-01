/* Mars: Signal Siege — stage construction and the geometry audit.
 *
 * Deliberately free of Phaser and of anything browser-only, so
 * scripts/check-mars-levels.mjs can import this module directly and audit the
 * real generator rather than a copy of it. A second implementation in the test
 * would pass forever while the game shipped broken stages.
 *
 * The generator is the v0.7 layout logic with three additions the brief
 * requires and the standalone did not guarantee:
 *
 *   1. A repair pass. v0.7 emitted platforms and then *measured* whether the
 *      boss was reachable, reporting failures into a QA readout nobody blocked
 *      on. Here an unreachable surface is bridged, and an overlap is trimmed,
 *      before the stage is returned. `audit()` then has to come back clean.
 *   2. Deterministic layout. Enemy placement used Math.random(), so two runs of
 *      the same mission differed and a QA failure could not be reproduced. A
 *      small seeded PRNG keyed on the mission index replaces it.
 *   3. Spawn safety. Walkers are only placed on a surface wide enough to hold
 *      them, and never inside another platform.
 *
 * The terrain itself was rebuilt after playtest. v0.7 laid one ground section
 * every 470 px at a height drawn from a nine-entry table, which produced a
 * near-flat road with occasional ledges bolted on top: the player held right
 * for seven screens. It is now assembled out of motifs — plateaus, staircases,
 * pits with floating steps, ledge climbs, sunken trenches — chosen in a
 * per-mission order, over a run twice as long. The point of the motifs is not
 * decoration: Contra's rule is that either the terrain is interesting or the
 * enemies are, never both in the same stretch, so the flat runs this generator
 * still emits are deliberate, and they are where the dense waves land.
 */

import { BOSS, ENEMY, PLAYER, REACH, WORLD } from "./tuning";
import {
  MISSIONS, FINAL_MISSION, BOSS_PROFILES, enemyGroupFor, authoredTypesFor,
} from "./data";

export type SurfaceType =
  | "deck" | "ice" | "conveyor" | "rail" | "trench" | "bridge" | "boss";

export interface Platform {
  x: number;
  y: number;
  w: number;
  h: number;
  type: SurfaceType;
  /** Conveyor direction: -1, 0 or 1. */
  dir: number;
  /**
   * One-way platform: solid from above, and hold-Down-plus-Jump drops through
   * it. Contra only ever let you fall through the thin floating girders, never
   * through the ground you were standing the stage up on, and the distinction
   * is what stops a drop-through control from reading as a collision bug. Set
   * on floats, ledges and repair steps; never on the ground run, never on the
   * surface the stage's own checkpoint is seated on, never on an arena floor.
   */
  thin?: boolean;
}

export type EnemyKind =
  /* The three ground roles carried by the four group sheets. */
  | "trooper" | "hound" | "turret"
  /* The two airborne roles carried by the same sheets. */
  | "flier" | "drone"
  /* The authored types, which unlock as the campaign leaves the surface. */
  | "wasp" | "crawler" | "sentinel";

export interface EnemySpawn {
  kind: EnemyKind;
  x: number;
  y: number;
  hp: number;
  /** Index into the mission's enemy group, and the shot family it uses. */
  variant: number;
  /** Weapon index this enemy is guaranteed to drop, if any. */
  dropWeapon?: number;
  /**
   * Paratrooper: this trooper enters from above the top of the view under a
   * canopy and becomes an ordinary ground trooper on landing. `x`/`y` are the
   * landing seat, already validated like any other ground spawn, so the
   * descent is a presentation layer over a placement the audit has cleared.
   */
  drop?: boolean;
}

export interface Stage {
  mission: number;
  vertical: boolean;
  worldW: number;
  worldH: number;
  bossGateX: number;
  bossGateY: number;
  platforms: Platform[];
  enemies: EnemySpawn[];
  spawn: { x: number; y: number };
  checkpoint: { x: number; y: number };
  bossSpawn: { x: number; y: number; hp: number };
}

/* ---------------------------------------------------------------- helpers */

/** Mulberry32. Small, fast, and identical in the game and the audit. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function horizontalGap(a: Platform, b: Platform): number {
  if (b.x > a.x + a.w) return b.x - (a.x + a.w);
  if (a.x > b.x + b.w) return a.x - (b.x + b.w);
  return 0;
}

/**
 * Can the player get from surface `a` to surface `b` in one jump?
 *
 * The reach shrinks as the climb grows, which is what a fixed jump arc
 * actually does: you cannot travel as far horizontally when you also have to
 * gain height. These numbers are the audit's contract with the generator.
 */
export function canJump(a: Platform, b: Platform, vertical: boolean): boolean {
  const rise = a.y - b.y;
  const maxRise = vertical ? REACH.MAX_RISE_VERTICAL : REACH.MAX_RISE;
  if (rise > maxRise) return false;
  if (b.y - a.y > REACH.MAX_DROP) return false;
  return horizontalGap(a, b) <= reachFor(rise);
}

/**
 * Horizontal reach for a given rise, as a function rather than as four
 * literals inside canJump().
 *
 * The shaft generator seats every rung inside this window instead of emitting
 * a ledge and letting the repair pass discover it is unreachable, so the two
 * have to be reading the same table or the climb grows bridges.
 */
function reachFor(rise: number): number {
  return rise > 52 ? REACH.GAP_HIGH :
         rise > 30 ? REACH.GAP_MID :
         rise > 0 ? REACH.GAP_LOW :
         REACH.GAP_FLAT;
}

function overlaps(a: Platform, b: Platform): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/* ------------------------------------------------------------------ audit */

export interface AuditIssue {
  kind: "overlap" | "unreachable" | "boss-unreachable" | "spawn-unsupported"
      | "spawn-inside" | "checkpoint-unreachable";
  detail: string;
}

export interface AuditResult {
  ok: boolean;
  issues: AuditIssue[];
  reachable: number;
  total: number;
}

/** Surfaces reachable from the one the player starts on. */
export function reachableSet(stage: Stage): Set<number> {
  const { platforms, vertical } = stage;
  const feet = stage.spawn.y + PLAYER.H;
  let start = -1;
  let bestDy = Infinity;
  for (let i = 0; i < platforms.length; i++) {
    const p = platforms[i];
    if (stage.spawn.x + PLAYER.W / 2 < p.x || stage.spawn.x + PLAYER.W / 2 > p.x + p.w) continue;
    const dy = p.y - feet;
    if (dy >= -4 && dy < bestDy) {
      bestDy = dy;
      start = i;
    }
  }
  const seen = new Set<number>();
  if (start < 0) return seen;
  seen.add(start);
  const queue = [start];
  while (queue.length) {
    const i = queue.shift()!;
    for (let j = 0; j < platforms.length; j++) {
      if (seen.has(j)) continue;
      if (canJump(platforms[i], platforms[j], vertical)) {
        seen.add(j);
        queue.push(j);
      }
    }
  }
  return seen;
}

export function audit(stage: Stage): AuditResult {
  const issues: AuditIssue[] = [];
  const { platforms } = stage;

  for (let i = 0; i < platforms.length; i++) {
    for (let j = i + 1; j < platforms.length; j++) {
      if (overlaps(platforms[i], platforms[j])) {
        const a = platforms[i];
        const b = platforms[j];
        issues.push({
          kind: "overlap",
          detail: `platform ${i} (${a.x},${a.y},${a.w}x${a.h},${a.type}) overlaps ` +
                  `${j} (${b.x},${b.y},${b.w}x${b.h},${b.type})`,
        });
      }
    }
  }

  const seen = reachableSet(stage);
  for (let i = 0; i < platforms.length; i++) {
    if (!seen.has(i)) {
      const p = platforms[i];
      issues.push({
        kind: "unreachable",
        detail: `platform ${i} (${p.x},${p.y},${p.w}x${p.h},${p.type}) has no route from spawn`,
      });
    }
  }

  const bossIdx = platforms.map((p, i) => (p.type === "boss" ? i : -1)).filter((i) => i >= 0);
  if (!bossIdx.some((i) => seen.has(i))) {
    issues.push({ kind: "boss-unreachable", detail: "no route from spawn to the boss arena" });
  }

  /* The checkpoint must sit on something, or a death after reaching it drops
     the player through the floor forever. */
  const cpSupported = platforms.some(
    (p) => stage.checkpoint.x >= p.x - 2 &&
           stage.checkpoint.x <= p.x + p.w + 2 &&
           Math.abs(p.y - (stage.checkpoint.y + PLAYER.H)) <= 120,
  );
  if (!cpSupported) {
    issues.push({
      kind: "checkpoint-unreachable",
      detail: `checkpoint (${stage.checkpoint.x},${stage.checkpoint.y}) has no surface beneath it`,
    });
  }

  for (const e of stage.enemies) {
    if (isAirborne(e.kind)) continue;   // airborne by design
    const supported = platforms.some(
      (p) => e.x + 16 >= p.x && e.x + 16 <= p.x + p.w &&
             Math.abs(p.y - (e.y + enemyHeight(e.kind))) <= REACH.MAX_RISE,
    );
    if (!supported) {
      issues.push({
        kind: "spawn-unsupported",
        detail: `${e.kind} at (${Math.round(e.x)},${Math.round(e.y)}) stands on nothing`,
      });
    }
    const inside = platforms.some(
      (p) => e.x + 8 > p.x && e.x + 8 < p.x + p.w &&
             e.y + enemyHeight(e.kind) - 6 > p.y && e.y + 4 < p.y + p.h,
    );
    if (inside) {
      issues.push({
        kind: "spawn-inside",
        detail: `${e.kind} at (${Math.round(e.x)},${Math.round(e.y)}) is embedded in geometry`,
      });
    }
  }

  return { ok: issues.length === 0, issues, reachable: seen.size, total: platforms.length };
}

/* ------------------------------------------------------------------ roster */

/**
 * Which role each row of each group sheet actually depicts.
 *
 * The four sheets do not share a row convention, and the pipeline used to
 * assume they did — which is why a flying pod once walked the ground as a
 * "trooper" and a full human soldier was drawn at 34 px beside Rook's 74. The
 * roles below are the ones baked into the rebuilt atlas
 * (public/eggs/mars-signal-siege/art/atlases.json, `roles`), so this table and
 * the artwork have to be changed together or the sprites go wrong again.
 */
const GROUP_ROLES: readonly (readonly EnemyKind[])[] = [
  ["trooper", "hound", "turret"],   // b — dustline garrison
  ["flier", "trooper", "turret"],   // c — uplink and ice
  ["hound", "trooper", "turret"],   // d — catacombs, the hound a centipede
  ["flier", "drone", "trooper"],    // e — hive, citadel, core
];

/** Types that belong in the air, and are therefore exempt from the ledge
 *  support rules the audit applies to everything that walks. */
export function isAirborne(kind: EnemyKind): boolean {
  return kind === "flier" || kind === "drone" || kind === "wasp" || kind === "sentinel";
}

/**
 * Drawn height in game pixels. These are not free numbers: they are the
 * heights scripts/build-mars-art.py seats each role at inside the 112x88
 * cell, and a mismatch here makes the sprite float above its feet or sink
 * through the deck. Rook is 74, so a trooper reads as a person.
 *
 * The three authored types are measured off the drawn bounding box rather than
 * off the cell. new-enemies.png is a 32x32 sheet, so nothing on it can be
 * larger than 32 and none of the three fills even that; the declared 30-44 px
 * boxes gave the sentinel 23 px of empty hitbox above its art, so shots that
 * visibly sailed over it connected, it touched the player from a body-length of
 * empty air, and its volley left from a point above the top of the sprite.
 * INTERIM: the real fix is redrawing the three at their intended size on a
 * larger cell — when that art lands these numbers must be re-measured, not
 * scaled.
 */
export function enemyHeight(kind: EnemyKind): number {
  switch (kind) {
    case "trooper": return 64;
    case "turret": return 58;
    case "hound": return 34;
    case "flier": return 44;
    case "drone": return 30;
    case "wasp": return 16;         // drawn 14x16
    case "crawler": return 12;      // drawn 26x12
    case "sentinel": return 21;     // drawn 16x21
    default: return 54;
  }
}

/**
 * Hitbox width, measured off the artwork rather than derived from the height.
 * The hound and the centipede are long and low, and the turret is a squat
 * emplacement; giving them a width proportional to their height would make
 * the low types nearly impossible to hit and the tall ones too easy. Measured
 * from the idle pose, so an extended weapon arm is not part of the box. The
 * authored three carry the same INTERIM caveat as their heights above.
 */
export function enemyWidth(kind: EnemyKind): number {
  switch (kind) {
    case "trooper": return 48;
    case "turret": return 68;
    case "hound": return 48;
    case "flier": return 40;
    case "drone": return 32;
    case "wasp": return 14;
    case "crawler": return 26;
    case "sentinel": return 16;
    default: return 48;
  }
}

/**
 * Hit points.
 *
 * Contra's infantry die to one shot; the tension comes from how many of them
 * there are and where they stand, not from how long each takes to remove. The
 * previous 2-4 HP infantry turned every screen into chip damage and was the
 * reason the stages felt sparse even when they were not — the player was
 * spending on each body what should have bought three. Only the turret and
 * the authored elites are built to survive a hit.
 */
function enemyHp(kind: EnemyKind, mission: number): number {
  switch (kind) {
    case "turret": return 5 + Math.floor(mission / 4);
    case "flier": return 2;
    case "sentinel": return 6 + Math.floor(mission / 3);
    case "crawler": return 4 + Math.floor(mission / 4);
    case "wasp": return 3 + Math.floor(mission / 5);
    default: return 1;                       // trooper, hound, drone
  }
}

/** How far above its anchor surface an airborne type hovers. */
function hoverLift(kind: EnemyKind): number {
  switch (kind) {
    case "flier": return 72;
    case "drone": return 88;
    case "wasp": return 58;
    case "sentinel": return 34;
    default: return 0;
  }
}

/* -------------------------------------------------------------- geometry */

const VIEW_W = 640;

/**
 * Length of the run before the boss gate, in screen widths.
 *
 * v0.7 ran 4 440 px — under seven screens — and playtest read it as one long
 * corridor with a boss on the end. Contra's stages are 12 to 20 screens, and
 * the pacing only works at that length because the terrain keeps changing
 * underneath it. Fifteen screens is the low end of that band; the motif
 * loop below fills the extra distance with more content rather than with more
 * of the same content stretched thin. The final core stays shorter on
 * purpose: it is a sprint to the Lock-In Engine, not a tour.
 */
const RUN_SCREENS = 15;
const RUN_SCREENS_FINAL = 10;

/** Flat, solid ground leading into the gate. The one full-width horizontal
 *  run the player asked to keep: you should see the boss coming. */
const APPROACH_W = 560;

/** Reserved in front of the approach for the lip that separates the two. It is
 *  a minimum, not a width — the lip also absorbs whatever the motif loop had
 *  too little room to use. */
const LIP_W = 150;

function runSpanFor(mission: number): number {
  const screens = mission === FINAL_MISSION ? RUN_SCREENS_FINAL : RUN_SCREENS;
  return screens * VIEW_W + (mission % 3) * 320;
}

/**
 * Height rungs, as offsets from the arena floor.
 *
 * Rung 1 is always 0, which is the load-bearing part: the base rung *is*
 * WORLD.GROUND_Y, the height the boss fights at. However far a stage climbs it
 * always comes home level with the arena, so the approach never needs a leap
 * of faith and the run back is never a wall.
 *
 * Rung 0 is a shallow sink used for trench pockets. Rungs 2-4 climb. Adjacent
 * rungs are never more than 54 apart against a 68 px jump ceiling, so any
 * single-rung transition is legal by construction and only the deliberate
 * two-rung moves need a step placed in them. The spacing is what gives each
 * mission its silhouette — the hive quarter and the sovereign stack climb
 * hardest, the catacombs stay low and wide.
 */
const LADDERS: readonly (readonly number[])[] = [
  [ 26, 0, -48,  -96, -144],   //  1 dustline relay
  [ 22, 0, -44,  -88, -132],   //  2 silo access
  [ 26, 0, -46,  -92, -138],   //  3 valles uplink (vertical; kept for parity)
  [ 30, 0, -40,  -80, -120],   //  4 borealis ice vault
  [ 24, 0, -52, -104, -156],   //  5 installer quarter, rooftops
  [ 34, 0, -42,  -84, -126],   //  6 cable catacombs, low and wide
  [ 20, 0, -50, -100, -150],   //  7 firewall foundry gantries
  [ 28, 0, -46,  -92, -138],   //  8 portal storm
  [ 24, 0, -54, -108, -162],   //  9 sovereign stack, the tallest climb
  [ 32, 0, -44,  -88, -132],   // 10 monarch citadel
  [ 26, 0, -48,  -96, -144],   // 11 credential bastion, entered from the top
  [ 22, 0, -50, -100, -150],   // 12 lock-in core
];

function surfaceFor(mission: number, i: number): SurfaceType {
  if (mission === 3 || mission === 10) return "ice";
  if (mission === 6 && i % 2) return "conveyor";
  if (mission === 7 && i % 3 === 1) return "rail";
  if (mission === 5) return "trench";
  return "deck";
}

/* -------------------------------------------------------------- motifs */

interface Build {
  mission: number;
  rand: () => number;
  /** Absolute y for each rung, low index = closest to the arena floor. */
  ladder: number[];
  /** Every platform emitted so far, used for the overlap guard. */
  all: Platform[];
  /** The intended left-to-right path, in order, for the transition pass. */
  route: Platform[];
  /** Right edge the ground run must not pass; the approach owns the rest. */
  limit: number;
  x: number;
  rung: number;
  /** Which way the run is currently drifting; flips at the ends of the ladder. */
  climb: number;
  /** Section counter, so surface flavour still alternates along the run. */
  section: number;
}

function pick<T>(b: Build, xs: readonly T[]): T {
  return xs[Math.floor(b.rand() * xs.length)];
}

function rungY(b: Build, rung: number): number {
  return b.ladder[Math.max(0, Math.min(b.ladder.length - 1, rung))];
}

/** Advance the rung one step in the current drift, turning round at the ends. */
function stepRung(b: Build): number {
  let r = b.rung + b.climb;
  if (r > 4) { b.climb = -1; r = 3; }
  if (r < 0) { b.climb = 1; r = 1; }
  return r;
}

/**
 * Emit a section of solid ground at the current rung and advance the cursor.
 *
 * Ground extends to the bottom of the world, so the gaps between sections are
 * real pits rather than decoration: this is the only lever the generator has
 * for making a fall cost something.
 */
function groundAt(b: Build, w: number): Platform | null {
  const room = b.limit - b.x;
  if (room < 110) return null;
  const width = Math.min(Math.round(w), room);
  const y = rungY(b, b.rung);
  const type = surfaceFor(b.mission, b.section);
  /* Only an actual conveyor drags the player. v0.7 gave every mission-6
     section a direction regardless of its type, so decks the art draws as
     static floor still pushed underfoot — survivable over four screens, and
     miserable over fifteen. */
  const dir = type === "conveyor" ? (b.section % 2 ? 1 : -1) : 0;
  const p: Platform = { x: b.x, y, w: width, h: 360 - y + 40, type, dir };
  b.section++;
  b.all.push(p);
  b.route.push(p);
  b.x += width;
  return p;
}

/**
 * Emit a one-way girder, refusing any placement that would collide.
 *
 * Refusing is safe: a step that is load-bearing and missing is re-created by
 * the repair pass, whereas an overlapping ledge survives repairOverlaps (which
 * only drops bridges and rails) and ships as an invisible lip the player
 * catches on.
 */
function thinAt(b: Build, x: number, y: number, w: number): Platform | null {
  if (y < 84 || w < 90) return null;
  const type: SurfaceType =
    b.mission === 3 || b.mission === 10 ? "ice" :
    b.mission === 7 ? "rail" : "bridge";
  const p: Platform = { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: 16, type, dir: 0, thin: true };
  if (b.all.some((q) => overlaps(p, q))) return null;
  b.all.push(p);
  return p;
}

/**
 * A long level shelf. Terrain does nothing here, which is the point: this is
 * where populate() puts a wave, and one of the two has to be quiet.
 *
 * It still leaves the run on a different rung than it found it. Two quiet
 * motifs in a row at the same height is how the old generator produced three
 * unbroken screens of road, and a shelf only reads as a shelf if the ground
 * either side of it is somewhere else.
 */
function flatRun(b: Build): void {
  if (groundAt(b, 470 + pick(b, [0, 60, 120]))) b.rung = stepRung(b);
}

/** Short treads climbing or descending a rung each, shoulder to shoulder. */
function stair(b: Build): void {
  for (let k = 0; k < 3; k++) {
    if (!groundAt(b, 160 + pick(b, [0, 24, 48]))) return;
    b.rung = stepRung(b);
  }
}

/** Plateaus at different heights separated by notches narrow enough to hop
 *  but wide enough to punish reading them as floor. */
function terrace(b: Build): void {
  const treads = 2 + Math.floor(b.rand() * 2);
  for (let k = 0; k < treads; k++) {
    if (!groundAt(b, 250 + pick(b, [0, 40, 80]))) return;
    b.rung = stepRung(b);
    if (k < treads - 1) b.x += 44 + pick(b, [0, 20, 40]);
  }
}

/**
 * A pit the player cannot walk across, with one or two floating steps in it.
 *
 * The two-tier version is the stage's only way up two rungs at once, so the
 * upper step is load-bearing and goes into the route: if it were ever refused,
 * the transition pass has to know to bridge the gap rather than leave a wall.
 */
function pitHop(b: Build): void {
  if (!groundAt(b, 250 + pick(b, [0, 40, 80]))) return;
  const lip = rungY(b, b.rung);

  const g1 = 54 + pick(b, [0, 10, 20]);
  const fw = 126 + pick(b, [0, 16, 32]);
  const low = thinAt(b, b.x + g1, lip - 44, fw);
  if (low) b.route.push(low);
  b.x += g1 + fw;

  const twoTier = b.rung <= 2 && b.rand() < 0.45;
  if (twoTier) {
    const g2 = 62 + pick(b, [0, 12]);
    const high = thinAt(b, b.x + g2, lip - 92, 124);
    if (high) b.route.push(high);
    b.x += g2 + 124;
    b.rung = Math.min(4, b.rung + 2);
  } else {
    b.rung = stepRung(b);
  }

  b.x += 74 + pick(b, [0, 12, 24]);
  groundAt(b, 260 + pick(b, [0, 40]));
}

/**
 * A shelf with staggered girders above it, climbing to the right.
 *
 * This is the shape playtest singled out on the uplink ascent: the interest is
 * that the same ground can be crossed at three different heights, and the
 * player chooses. Each girder is one comfortable hop above and to the right of
 * the last, and the run stops when it would leave the shelf or run out of
 * headroom rather than being clipped to fit.
 */
function ledgeClimb(b: Build): void {
  const p = groundAt(b, 430 + pick(b, [0, 40, 80]));
  if (!p) return;
  let ly = p.y - 52;
  let lx = p.x + 48 + pick(b, [0, 20]);
  for (let k = 0; k < 3; k++) {
    const lw = 118 + pick(b, [0, 14, 28]);
    if (lx + lw > p.x + p.w - 18) break;
    if (!thinAt(b, lx, ly, lw)) break;
    ly -= 52;
    lx += lw + 12 + pick(b, [0, 20, 40]);
  }
  b.rung = stepRung(b);
}

/**
 * A sunken pocket between two walls, with a single girder to climb back out.
 *
 * Dropping in is free and climbing out is not, which is what makes the pocket
 * read as a decision. The floor of it is flat and wide — another wave stretch,
 * and the enemies down there have the high ground on both sides of you.
 */
function trenchDip(b: Build): void {
  if (!groundAt(b, 220 + pick(b, [0, 40]))) return;
  const top = b.rung;
  b.rung = Math.max(0, top - 2);
  const floor = groundAt(b, 330 + pick(b, [0, 60]));
  if (!floor) return;

  /* Two treads, not one. The single girder at floor.y - 50 left a 58 px
     climb-out on the sovereign stack — 78% of the 68 px ceiling, 82% at 30 fps
     — because the exit ground is two rungs above the pocket floor. Raising the
     girder to floor.y - 66 fixes the exit and moves the problem to the entry,
     which becomes a 66 px hop off the floor; a tread at -34 splits both halves
     into hops nothing has to be threaded through. */
  const tread = thinAt(b, floor.x + 60, floor.y - 34, 118);
  if (tread) b.route.push(tread);
  const step = thinAt(b, floor.x + floor.w - 150, floor.y - 66, 132);
  if (step) b.route.push(step);

  b.rung = Math.min(4, b.rung + 2);
  groundAt(b, 250 + pick(b, [0, 40]));
}

/**
 * The motif deck, and how far each needs to finish cleanly.
 *
 * Twelve entries, drawn with a stride coprime to twelve so every mission walks
 * the whole deck in a different order rather than four missions sharing a
 * rotation. Four of the twelve are flat: that ratio is the pacing.
 */
const MOTIFS: readonly { need: number; run: (b: Build) => void }[] = [
  { need: 430, run: ledgeClimb },
  { need: 250, run: flatRun },
  { need: 820, run: pitHop },
  { need: 520, run: terrace },
  { need: 250, run: flatRun },
  { need: 800, run: trenchDip },
  { need: 820, run: pitHop },
  { need: 400, run: stair },
  { need: 250, run: flatRun },
  { need: 430, run: ledgeClimb },
  { need: 820, run: pitHop },
  { need: 520, run: terrace },
];

const STRIDES = [1, 5, 7, 11];

/* ------------------------------------------------------------ repair pass */

/**
 * Put a step in the gap between two surfaces the player cannot cross.
 *
 * The step goes in the *horizontal gap* rather than at the midpoint of the two
 * platforms. That distinction is the whole trick: the ground sections are tall
 * (they extend to the bottom of the world), so anything placed within their x
 * range necessarily overlaps them, and an overlapping step is worse than no
 * step at all.
 */
function bridgeBetween(a: Platform, b: Platform): Platform | null {
  const gap = horizontalGap(a, b);
  const midY = Math.round((a.y + b.y) / 2);
  let x: number;
  let w: number;
  if (gap > 0) {
    const left = a.x + a.w <= b.x ? a.x + a.w : b.x + b.w;
    x = left;
    w = gap;
  } else {
    /* They already touch in x, so the only room is directly above the join. */
    const join = a.x + a.w <= b.x + b.w ? a.x + a.w : b.x + b.w;
    w = 120;
    x = Math.round(join - w / 2);
  }
  if (w < 24) return null;
  /* Whatever the repair pass adds is a floating girder by definition, so it
     obeys the same drop-through rule as an authored one. */
  return { x, y: midY, w, h: 16, type: "bridge", dir: 0, thin: true };
}

/**
 * Guarantee a continuous route along the ordered ground run.
 *
 * Consecutive sections can differ in height by more than a single jump clears,
 * which is exactly the "impossible jump" the brief forbids. v0.7 had this pass
 * and then still shipped stages that failed its own audit, because it ran once
 * and only looked at rises, never at the resulting reachability.
 */
function addRequiredTransitions(stage: Stage, run: Platform[]): void {
  for (let i = 0; i < run.length - 1; i++) {
    const a = run[i];
    const b = run[i + 1];
    if (canJump(a, b, stage.vertical)) continue;
    const step = bridgeBetween(a, b);
    if (step && !stage.platforms.some((p) => overlaps(p, step))) {
      stage.platforms.push(step);
    }
  }
}

/**
 * Bridge every remaining surface the player cannot reach.
 *
 * Runs to a fixed point: adding a step creates a new surface which may open a
 * route further on. Anything still stranded after that is a decorative ledge
 * and is removed — but the boss arena is never removed, because dropping it
 * turns an unreachable platform into an unwinnable mission.
 */
function repairReachability(stage: Stage): void {
  for (let pass = 0; pass < 8; pass++) {
    const seen = reachableSet(stage);
    if (seen.size === stage.platforms.length) return;

    let added = false;
    for (let j = 0; j < stage.platforms.length; j++) {
      if (seen.has(j)) continue;
      const target = stage.platforms[j];
      let best = -1;
      let bestCost = Infinity;
      for (const i of seen) {
        const from = stage.platforms[i];
        const cost = horizontalGap(from, target) + Math.abs(from.y - target.y) * 1.5;
        if (cost < bestCost) {
          bestCost = cost;
          best = i;
        }
      }
      if (best < 0) continue;
      const step = bridgeBetween(stage.platforms[best], target);
      if (step && !stage.platforms.some((p) => overlaps(p, step))) {
        stage.platforms.push(step);
        added = true;
      }
    }
    if (!added) break;
  }

  const keep = reachableSet(stage);
  stage.platforms = stage.platforms.filter(
    (p, i) => keep.has(i) || p.type === "boss",
  );
}

/** Remove overlaps by trimming the later platform out of the earlier one. */
function repairOverlaps(stage: Stage): void {
  const out: Platform[] = [];
  for (const p of stage.platforms) {
    if (!out.some((q) => overlaps(p, q))) {
      out.push(p);
      continue;
    }
    /* Decorative ledges lose to structural ground; if the loser is a bridge
       or rail we simply drop it, since repairReachability will re-add a step
       somewhere legal if it was load-bearing. */
    if (p.type === "bridge" || p.type === "rail") continue;
    out.push(p);
  }
  stage.platforms = out;
}

/* ------------------------------------------------------------ boss arenas */

/**
 * Girder thickness. 12 px rather than 14: the slab still cuts a standing
 * Rook's helmet (his box top is floorY-58 and the lowest tier has to stay
 * within a 68 px rise of the floor to be reachable at all), so every pixel off
 * it is a pixel less of him buried. Cosmetic only — thin surfaces are
 * transparent to blockHorizontally.
 */
const GIRDER_H = 12;

/**
 * Clearance kept either side of the boss's own standing box.
 *
 * Only girders low enough to intersect a grounded boss need it. Anything at or
 * above the top of its body box may cross the arena freely, which is what buys
 * the long high catwalks below.
 */
const BOSS_COLUMN_PAD = 12;

/** One girder, authored in the arena's own space. */
interface ArenaGirder {
  /** Left edge, from the arena's left wall. */
  x: number;
  /**
   * Height above the arena floor.
   *
   * Authored as a lift rather than as a y because the two arena floors are at
   * different heights — the horizontal missions fight at WORLD.GROUND_Y and the
   * shaft fights on its deck at WORLD.VERTICAL_BOSS_Y — and a room described in
   * lifts is the same room in both. It is also the number the two rules that
   * matter are stated in: a lift of REACH.MAX_RISE or less is reachable from
   * the floor in one jump, and a lift of BOSS.H or more puts the player's whole
   * box above a grounded boss's.
   */
  up: number;
  w: number;
  /** Surface behaviour. Ice slides, a conveyor carries, the rest is inert. */
  type?: SurfaceType;
  /** Conveyor direction. */
  dir?: number;
}

interface Arena {
  /** What the room is, and what it asks the player to do. */
  note: string;
  girders: readonly ArenaGirder[];
}

/**
 * Twelve rooms, one per boss.
 *
 * Every arena used to be the same three girders at the same three offsets, so
 * twelve fights were staged in one room and the only thing that changed was who
 * was standing in it. A room is half of a fight: a dashing boss in a room with
 * two islands and a gap between them is not the same fight as a dashing boss on
 * an open floor, and the table below is the other half of entities/Boss.ts.
 *
 * Three rules bind every entry, and furnishArena() enforces all three rather
 * than trusting the table:
 *
 *   reachable   every girder is one legal jump from the arena floor or from a
 *               girder already accepted, measured with the audit's own
 *               canJump(). Anything else is bridged or deleted by
 *               repairReachability(), which would quietly rebuild the room.
 *   clear       a girder low enough to intersect a grounded boss stays out of
 *               the boss's spawn column, so no fight opens with Rook's box
 *               inside the boss's.
 *   perch       every furnished arena carries at least one girder at a lift of
 *               BOSS.H or more. Standing there, the player's whole box is above
 *               the boss's: the measured "inside the boss" figure is 0, which is
 *               what makes the climb an escape rather than a worse floor.
 */
const ARENAS: readonly Arena[] = [
  /* 1 BUTTON BRIGADIER — THE OPEN FLOOR.
     The only room in the game with nothing in it. The Brigadier is an
     emplacement that lobs a wall of slow shells and alternates a flat pair at
     head height; with no cover at all the answer is footwork and only footwork,
     which is the grammar the other eleven fights are built on. Cover here would
     let the first boss be beaten by standing still. */
  { note: "bare floor", girders: [] },

  /* 2 CODEC WARDEN — THE TWO GATES.
     Two narrow towers against the side walls and nothing between them. The
     Warden hops a short bound every exchange and fires the same volley twice,
     tight then wide, so a tower is shelter from the first release and a trap
     for the second: the room is a choice of two gates and a long, exposed run
     between them. */
  {
    note: "twin two-step towers at the walls, open centre",
    girders: [
      { x: 50, up: 62, w: 110 },
      { x: 60, up: 126, w: 96 },
      { x: 610, up: 62, w: 110 },
      { x: 615, up: 126, w: 96 },
    ],
  },

  /* 3 VLAN TYRANT — THE TAKEN SIDE.
     Every surface is in the left third of the shaft deck; the right two thirds
     are bare. The Tyrant vaults clean over Rook to the far half and lands hard
     enough to push a wall out both ways, so the safe side is whichever side it
     is not on — and the room only has one. Standing on the stack is an
     invitation for it to take the stack. */
  {
    note: "one furnished side, two thirds bare",
    girders: [
      { x: 24, up: 62, w: 160 },
      { x: 40, up: 128, w: 150 },
      { x: 230, up: 62, w: 120 },
    ],
  },

  /* 4 REFRESH ENFORCER — THE FROST SHELVES.
     Three long ice shelves and no small platforms at all. The girders are typed
     ice, so PlayScene's own surface test gives them the vault floor's handling:
     the player accelerates onto them and cannot stop on them. The Enforcer's
     volley deliberately brackets Rook rather than aiming at him, which makes
     holding position the correct answer — on the one floor in the game that
     will not let anybody hold position. */
  {
    note: "long ice shelves, nothing to stand still on",
    girders: [
      { x: 40, up: 62, w: 300, type: "ice" },
      { x: 560, up: 62, w: 160, type: "ice" },
      { x: 200, up: 128, w: 200, type: "ice" },
    ],
  },

  /* 5 INSTALLER OVERMIND — THE THREE DECKS.
     Three wide decks stacked in one column, which is the Overmind's own attack
     drawn as architecture: it provisions a high, a level and a low lane at once
     and the room has exactly three lanes to be in. Down-plus-Jump drops a deck
     instantly, so changing lane is as fast as the volley is — the fight is
     about which lane, not about whether you can get there. */
  {
    note: "three stacked decks, one per attack lane",
    girders: [
      { x: 100, up: 60, w: 260 },
      { x: 120, up: 120, w: 220 },
      { x: 140, up: 178, w: 180 },
    ],
  },

  /* 6 CABLE LEVIATHAN — THE CROSSING.
     Two islands at each end and 110 px of open air between the high halves.
     The Leviathan never leaves the floor and its whole identity is a committed
     run of the arena, so the floor belongs to it and the islands are the
     answer — but crossing from one pair to the other means dropping into the
     charge lane and timing it. Falling costs position, not a life. */
  {
    note: "island pairs either end, a gap only the floor crosses",
    girders: [
      { x: 90, up: 62, w: 100 },
      { x: 250, up: 126, w: 110 },
      { x: 600, up: 62, w: 110 },
      { x: 470, up: 126, w: 110 },
    ],
  },

  /* 7 CONSOLE HYDRA — THE GANTRY BELT.
     Two conveyor girders running toward each other under one static shelf. The
     Hydra sweeps its volley across an arc and reverses the sweep every
     exchange, so the safe end of the room keeps changing — and the belts are
     always carrying the player back toward the middle, which is the end that is
     never safe for long. The high shelf is the one surface in the room that
     stays where you put your feet. */
  {
    note: "opposed conveyor belts under one still shelf",
    girders: [
      { x: 60, up: 62, w: 220, type: "conveyor", dir: 1 },
      { x: 570, up: 62, w: 180, type: "conveyor", dir: -1 },
      { x: 250, up: 126, w: 200 },
    ],
  },

  /* 8 SUPPORT GUILLOTINE — THE STORM RAILS.
     A diagonal of narrow rails climbing from the left wall to over the middle,
     and one stranded rail at the far right that connects to nothing. The
     Guillotine leaps high and comes down beside Rook, firing straight out of
     the apex, so the counter is lateral movement — and this is the wind
     mission, where lateral movement in the air is not entirely the player's to
     decide. The stranded rail is a place to be, not a place to travel from. */
  {
    note: "climbing diagonal of narrow rails, one stranded island",
    girders: [
      { x: 40, up: 62, w: 120, type: "rail" },
      { x: 190, up: 120, w: 110, type: "rail" },
      { x: 330, up: 178, w: 110, type: "rail" },
      { x: 600, up: 62, w: 120, type: "rail" },
    ],
  },

  /* 9 SILO SOVEREIGN — THE MANAGEMENT ISLANDS.
     Four small platforms that do not connect to each other: every one is
     entered from the floor, and the only climb in the room is a single step up
     in the far corner. The Sovereign owns the ground lane with tribute walls
     and answers a ledge with a lobbed shell, so each island is safe from one of
     its two attacks and neither is safe from both — and moving between them
     costs a trip through the lane it walls. Its estate, drawn as furniture. */
  {
    note: "four disconnected islands, one corner step",
    girders: [
      { x: 50, up: 62, w: 110 },
      { x: 230, up: 62, w: 100 },
      { x: 560, up: 62, w: 100 },
      { x: 655, up: 126, w: 90 },
    ],
  },

  /* 10 CLOSED-ECOSYSTEM MONARCH — THE COURT.
     A long high catwalk across the middle of the room with a low step at each
     wall. The Monarch holds court at range, backs away through the air from
     anyone who closes, and dashes to retake the centre the moment it is pushed
     off it — so the catwalk is the ground both of you want, and it is directly
     over the ground the Monarch is trying to stand on. */
  {
    note: "central high catwalk, a step at each wall",
    girders: [
      { x: 70, up: 62, w: 150 },
      { x: 560, up: 62, w: 150 },
      { x: 250, up: 126, w: 220 },
    ],
  },

  /* 11 TRUST GATEKEEPER — THE MEZZANINE.
     One ice slab most of the way across the room at head height, reached by a
     single step at either end: the arena is two floors rather than a floor with
     furniture on it. The Gatekeeper's dashes chain along the ground and its
     challenges arrive faster every cycle, so the mezzanine buys distance from
     the body and nothing at all from the volley — and the two stairs are the
     only way between floors, which is one more gate than the room looks like it
     has. */
  {
    note: "a second floor, reached only at the two ends",
    girders: [
      { x: 40, up: 62, w: 90, type: "ice" },
      { x: 130, up: 126, w: 380, type: "ice" },
      { x: 600, up: 62, w: 100, type: "ice" },
    ],
  },

  /* 12 THE LOCK-IN ENGINE — THE COMPOSITE.
     One piece of every room the player has already cleared: an ice shelf, a
     conveyor, a storm rail, and a three-step climb up the left wall. It is the
     tallest arena in the game because the Engine is the tallest boss, and its
     perch is the only one authored against BOSS.H_FINAL rather than BOSS.H —
     the same lift that clears every other boss leaves the player's boots inside
     this one. */
  {
    note: "one surface from each of the eleven rooms before it",
    girders: [
      { x: 60, up: 62, w: 130, type: "ice" },
      { x: 210, up: 62, w: 130, type: "conveyor", dir: -1 },
      { x: 600, up: 62, w: 130, type: "rail" },
      { x: 110, up: 124, w: 170 },
      { x: 150, up: 182, w: 150 },
      { x: 610, up: 126, w: 120, type: "rail" },
    ],
  },
];

/**
 * Build one boss arena's furniture.
 *
 * The floor itself stays flat, solid and full width — the arena is the one
 * place in the game a horizontal run is what you want, and it is also the
 * surface the boss's own physics resolves against. Everything added here is
 * thin, which is deliberate twice over: Boss.supportY refuses one-way surfaces,
 * so the furniture is the player's alone, and blockHorizontally ignores them,
 * so nothing in a room can shove Rook the way a solid slab over a ledge does.
 *
 * The three rules in the ARENAS comment are checked here, per girder, against
 * the same canJump() the audit uses. A girder that fails is dropped rather than
 * adjusted: a room the table describes and the generator silently repairs is a
 * room nobody has actually designed.
 */
function furnishArena(
  stage: Stage, floorY: number, left: number, bossX: number, bossW: number,
  bossH: number, vertical: boolean,
): void {
  const arena = ARENAS[stage.mission] ?? ARENAS[0];
  const floor: Platform = {
    x: left, y: floorY, w: stage.worldW - left, h: 90, type: "boss", dir: 0,
  };
  /* Only the boss's own body box, padded. A girder at or above `bossH` clears a
     grounded boss outright and may cross the column. */
  const colL = bossX - BOSS_COLUMN_PAD;
  const colR = bossX + bossW + BOSS_COLUMN_PAD;
  const placed: Platform[] = [];

  for (const g of arena.girders) {
    const p: Platform = {
      x: left + g.x,
      y: floorY - g.up,
      w: g.w,
      h: GIRDER_H,
      type: g.type ?? "bridge",
      dir: g.dir ?? 0,
      thin: true,
    };
    if (!vertical && p.y < 84) continue;
    if (g.up < bossH && p.x < colR && p.x + p.w > colL) continue;
    if (!canJump(floor, p, vertical) && !placed.some((q) => canJump(q, p, vertical))) continue;
    if (stage.platforms.some((q) => overlaps(p, q))) continue;
    if (placed.some((q) => overlaps(p, q))) continue;
    placed.push(p);
    stage.platforms.push(p);
  }
}

/* -------------------------------------------------------------- generator */

/** Place enemies on surfaces that can actually hold them. */
function populate(stage: Stage, rand: () => number): void {
  const mission = stage.mission;
  const roles = GROUP_ROLES[enemyGroupFor(mission)];
  const walkers = roles.filter((r) => !isAirborne(r));
  const authored = authoredTypesFor(mission);

  /* The group's roster as a rotation rather than a flat three-way split. An
     even split gave every stage as many turrets as troopers, and a turret is
     the one inherited type built to survive several hits: a third of the
     bodies on the stage soaking damage is what made the old roster feel slow
     even after the infantry was cheapened. Weights read as "how much of this
     mission's opposition is this". */
  const roster: EnemyKind[] = [];
  for (const r of roles) {
    const weight = r === "turret" ? 1 : r === "trooper" || r === "hound" ? 3 : 2;
    for (let n = 0; n < weight; n++) roster.push(r);
  }

  /**
   * The cap is a density, not a count. It used to be a flat 20 over a 4 440 px
   * run; holding that number across a 9 600 px run would have halved the
   * pressure per screen, which is the exact failure the lengthening was meant
   * to avoid. One body per ~180 px of run is roughly three and a half per
   * screen, and the infantry now dies to one shot, so the player is mowing
   * rather than chipping.
   */
  const span = stage.vertical ? stage.worldH - 480 : stage.bossGateX - 420;
  const per = mission === FINAL_MISSION ? 220 : stage.vertical ? 190 : 180;
  const cap = Math.max(12, Math.round(span / per));

  /* Sorted along the run, because the placement order below is what decides
     where the cap is spent and the platform array is only roughly in
     progression order (the repair passes append at the end). */
  const progress = (p: Platform) => (stage.vertical ? -p.y : p.x);
  const surfaces = stage.platforms
    .filter(
      (p) => p.type !== "boss" &&
             p.w >= 120 &&
             (stage.vertical ? p.y > 380 && p.y < stage.worldH - 100
                             : p.x > 420 && p.x < stage.bossGateX - 120),
    )
    .sort((a, b) => progress(a) - progress(b));

  /* Paratroopers only where there is a sky to fall out of. The catacombs, the
     foundry and the ice vault are interiors; a canopy unfurling under a
     ceiling reads as a bug, not as a set piece. */
  const paradrops = ["dustline", "hivecity", "uplink"]
    .includes(MISSIONS[mission].environment) && !stage.vertical;

  /* A wide, level, solid shelf is a wave; a girder over a pit holds one
     sentry. Contra alternates them, and so does this: the flat stretches the
     motif deck deliberately leaves in the run are exactly the places the
     terrain is not asking anything of the player. */
  const slots: { p: Platform; s: number; of: number }[] = [];
  for (const p of surfaces) {
    const of = !p.thin && p.w >= 420 ? 3 : p.w >= 250 ? 2 : 1;
    for (let s = 0; s < of; s++) slots.push({ p, s, of });
  }

  /**
   * Spend the cap across the whole run rather than left to right.
   *
   * Walking the surfaces in order and stopping the instant the cap was reached
   * spent every mission's entire budget on the first two thirds of the stage —
   * and every mission hit the cap exactly, so the right-hand end got nothing.
   * QA measured 1 352 px between the last two bodies on the foundry, 1 814 px
   * on the core, and on mission 3 the top 3 090 px of the climb — 63% of it —
   * silent.
   *
   * The cap is spent as a *rate* instead: each slot along the run earns
   * cap/slots of a body, and a slot is only used once it has earned a whole
   * one. A failed placement does not spend the credit, so it rolls into the
   * next slot rather than being lost. The walk stays in run order, which is
   * what makes the guarantee spatial — the largest hole it can leave is two
   * slots' worth of run, wherever in the run it falls.
   */
  const rate = slots.length ? cap / slots.length : 0;
  /* Opened at a full body so the first eligible surface is tried immediately.
     Warming up from zero pushed the first enemy 700-926 px into the run, and
     the ~600 px opening lead-in is a deliberate number owned by the surface
     filter above, not something the accumulator gets to lengthen. */
  let credit = 1;

  let placed = 0;
  let attempts = 0;
  let troopers = 0;
  for (let i = 0; i < slots.length && placed < cap; i++) {
    credit += rate;
    if (credit < 1) continue;
    const { p, s, of } = slots[i];
    const seq = attempts++;
    /* Every eighth slot on a mission that has unlocked them goes to an
       authored type, so later families visibly change the roster rather than
       re-skinning the same silhouettes. Eight against a six- or seven-long
       rotation so the substitution walks around the roster instead of always
       eating the same role. */
    let kind: EnemyKind = authored.length && seq % 8 === 7
      ? authored[Math.floor(seq / 8) % authored.length]
      : roster[seq % roster.length];

    /* Fliers hover above their anchor surface; the audit exempts them from
       the support check, so they must not be seated on the deck. Over a
       plateau near the top of the ladder there is no room to hover in, and
       clamping the hover to the ceiling pins the flier to the top edge where
       the player cannot fight it — so the slot goes to a walker instead. */
    let lift = hoverLift(kind);
    if (lift > 0) {
      const headroom = p.y - enemyHeight(kind) - 14;
      if (headroom < 30) {
        kind = walkers[seq % walkers.length];
        lift = 0;
      } else {
        lift = Math.min(lift, headroom);
      }
    }

    /* A turret on a girder is the commonest way to lose a slot. Fall back to
       the narrowest role the group has rather than leaving the surface bare. */
    if (p.w < enemyWidth(kind) + 36) {
      kind = walkers.reduce((a, c) => (enemyWidth(c) < enemyWidth(a) ? c : a), walkers[0]);
      lift = 0;
      if (p.w < enemyWidth(kind) + 36) continue;
    }

    const h = enemyHeight(kind);
    const bw = enemyWidth(kind);
    const y = p.y - h - lift;

    /* Pick a slot whose body box is clear of every *other* surface. Seating
       an enemy purely by its anchor's x-range puts troopers inside the upper
       ledges that share that span, which reads as a soldier standing
       waist-deep in a girder. Slots are spread across the surface rather than
       drawn freely, or a wave of three lands on top of itself. */
    const lane = (p.w - bw - 40) / of;
    let x = -1;
    for (let attempt = 0; attempt < 6; attempt++) {
      const candidate = Math.round(
        p.x + 20 + s * lane + rand() * Math.max(24, lane - bw),
      );
      if (candidate + bw > p.x + p.w - 12) continue;
      const body: Platform = { x: candidate + 4, y: y + 4, w: bw - 8, h: h - 8, type: "deck", dir: 0 };
      if (!stage.platforms.some((q) => q !== p && overlaps(q, body))) {
        x = candidate;
        break;
      }
    }
    if (x < 0) continue;

    /* Nothing may already be awake on frame one. The combat audit found the
       uplink shaft seating two troopers 211 and 214 px from the player start,
       inside ENEMY.NOTICE_RANGE, so the climb opened with the shaft already
       shooting at a player who had not moved. The margin is the notice radius
       plus a body, measured from the spawn point rather than along the run,
       because on the vertical stage the pressure arrives from the side. */
    if (Math.hypot(x - stage.spawn.x, y - stage.spawn.y) < ENEMY.NOTICE_RANGE + 40) continue;

    const spawn: EnemySpawn = { kind, x, y, hp: enemyHp(kind, mission), variant: seq };

    /* A paratrooper needs an unobstructed column above its landing seat, or
       the canopy comes down through a girder. Counted in troopers rather
       than in slots: phasing it off the slot counter silently collided with
       the roster rotation and produced a mission with no drops at all. */
    if (paradrops && kind === "trooper" && !p.thin && troopers++ % 3 === 1) {
      const column: Platform = { x: x + 6, y: 0, w: bw - 12, h: y - 4, type: "deck", dir: 0 };
      if (column.h > 40 && !stage.platforms.some((q) => overlaps(q, column))) {
        spawn.drop = true;
      }
    }

    stage.enemies.push(spawn);
    placed++;
    credit -= 1;
  }

  /* Mission 1 hands the player their first upgrade from the first kill, so
     the weapon system is taught rather than stumbled into. */
  if (mission === 0 && stage.enemies.length) stage.enemies[0].dropWeapon = 1;
}

function bossHp(mission: number): number {
  return mission === FINAL_MISSION ? 82 : 30 + mission * 3;
}

/* ------------------------------------------------------------- the shaft */

/**
 * Mission 3's climb is generated, not tabulated.
 *
 * v0.8 drew every rung from an 8-entry x table and an 8-entry width table at a
 * constant 66 px stride, with a rail every 6 rungs and a rest floor every 7.
 * QA measured what that adds up to: vertical spacing sd 0, width sd 7.8% of the
 * mean, ten distinct ledge shapes in 4 920 px, and a period of 8 rungs — 528 px
 * — repeated 8.5 times. The player climbs the same screen nine times. Every
 * number below is drawn from the seeded rand() instead, inside the reach rules
 * rather than against them.
 */
interface Shaft {
  rand: () => number;
  platforms: Platform[];
  /** The intended climb, in order, for the transition pass. */
  route: Platform[];
  /** Top of the last rung emitted, and its span. */
  y: number;
  x: number;
  w: number;
  /** Lateral drift, flipped by the motifs that throw the player about. */
  side: number;
  rungs: number;
  sinceFloor: number;
}

/**
 * The rise band.
 *
 * REACH.MAX_RISE_VERTICAL is 82 and a QA simulation put the true landable rise
 * in low gravity at 87 px at 60 fps and 84 at 30, so 78 leaves the worst rung
 * in the shaft at 93% of the 30 fps figure and the mean nowhere near it. The
 * floor of 48 is what stops the band collapsing back into a constant.
 */
const SHAFT_RISE_MIN = 48;
const SHAFT_RISE_MAX = 78;

function shaftInt(s: Shaft, lo: number, hi: number): number {
  return lo + Math.floor(s.rand() * (hi - lo + 1));
}

/**
 * Emit one climb rung, seated inside the reach window of the rung below it.
 *
 * `want` is a wish, not a position: it is clamped into the band from which the
 * previous rung is still jumpable. A motif can therefore ask for the far wall
 * and get as far as the arc actually reaches, rather than an unreachable ledge
 * that repairReachability then bridges back into a staircase.
 */
function shaftRung(s: Shaft, rise: number, w: number, want: number): Platform {
  const reach = reachFor(rise) - 10;      // margin for the 3 px landing overlap
  const lo = Math.max(0, s.x - reach - w);
  const hi = Math.min(VIEW_W - w, s.x + s.w + reach);
  const x = Math.round(
    hi < lo ? Math.max(0, Math.min(VIEW_W - w, s.x)) : Math.max(lo, Math.min(hi, want)),
  );
  const y = s.y - rise;
  const p: Platform = {
    x, y, w, h: 16,
    /* The rail used to be every sixth rung, which against an 8-long x table is
       precisely the kind of second period that made the shaft read as
       wallpaper. Drawn, so it has no period at all. */
    type: s.rand() < 0.22 ? "rail" : "bridge",
    dir: 0, thin: true,
  };
  s.platforms.push(p);
  s.route.push(p);
  s.x = x;
  s.w = w;
  s.y = y;
  s.rungs++;
  s.sinceFloor++;
  return p;
}

/** Ordinary rungs: a fresh rise, a fresh width, and at least 90 px of lateral
 *  travel asked for, so the climb is never a ladder drawn up one column. */
function shaftLedges(s: Shaft, n: number): void {
  for (let k = 0; k < n; k++) {
    const dir = s.rand() < 0.5 ? -1 : 1;
    shaftRung(
      s,
      shaftInt(s, SHAFT_RISE_MIN, SHAFT_RISE_MAX),
      shaftInt(s, 120, 260),
      s.x + dir * shaftInt(s, 90, 210),
    );
  }
}

/** Three toeholds thrown as far to either side as the arc reaches. */
function shaftChimney(s: Shaft): void {
  for (let k = 0; k < 3; k++) {
    s.side = -s.side;
    shaftRung(s, shaftInt(s, 50, 70), shaftInt(s, 110, 145), s.side > 0 ? VIEW_W : -VIEW_W);
  }
}

/** Three rungs stepping consistently one way — the shaft's only long diagonal,
 *  and the one place the player can climb without reading each ledge. */
function shaftCascade(s: Shaft): void {
  const dir = s.side;
  for (let k = 0; k < 3; k++) {
    shaftRung(s, shaftInt(s, 52, 74), shaftInt(s, 150, 225), s.x + dir * shaftInt(s, 100, 170));
  }
  s.side = -dir;
}

/**
 * A rest floor with a hole in it, and the toehold the climb goes up through.
 *
 * The hole is structural, not decorative. PlayScene.blockHorizontally treats
 * any solid slab overlapping Rook's box as a wall and shoves him to its nearest
 * edge, so a full-width rest floor 26 px above a ledge he can stand on throws
 * him at the shaft wall — the nine buried ledges QA found, and the reason the
 * old floors could not simply be moved to y-44 either (Rook is 58 tall, so
 * nothing clears him under a full-width slab until 76 px). Routing the climb
 * through a hole that stands 40 px clear of the toehold on both sides means his
 * box is never inside the slab at all, and the slabs still catch a missed jump
 * everywhere else in the shaft.
 */
function shaftGallery(s: Shaft): void {
  shaftRung(
    s,
    shaftInt(s, SHAFT_RISE_MIN, SHAFT_RISE_MAX),
    shaftInt(s, 110, 145),
    s.x + (s.rand() < 0.5 ? -1 : 1) * shaftInt(s, 90, 190),
  );

  const y = s.y - shaftInt(s, SHAFT_RISE_MIN, SHAFT_RISE_MAX);
  const holeX = Math.max(0, s.x - 40);
  const holeW = Math.min(VIEW_W - holeX, s.x + s.w + 40 - holeX);
  let widest: Platform | null = null;
  for (const slab of [{ x: 0, w: holeX }, { x: holeX + holeW, w: VIEW_W - holeX - holeW }]) {
    if (slab.w < 80) continue;
    /* Rest floors stay solid. They are the only thing in the shaft that stops
       a missed jump costing the whole climb, and a floor you can drop through
       is not a floor. */
    const p: Platform = { x: slab.x, y, w: slab.w, h: 18, type: "deck", dir: 0 };
    s.platforms.push(p);
    if (!widest || p.w > widest.w) widest = p;
  }
  if (widest) {
    s.route.push(widest);
    s.x = widest.x;
    s.w = widest.w;
  }
  s.y = y;
  s.rungs++;
  s.sinceFloor = 0;
}

/**
 * The shaft's motif deck, and the rise each needs to finish.
 *
 * The horizontal run has had one since the terrain rebuild; the climb had
 * `i % 7 === 6` and nothing else, which is why 4 920 px of it contained one
 * structural idea. Five entries walked with a stride of two, so the order the
 * player meets them in is not the order they are written in.
 */
const SHAFT_MOTIFS: readonly { need: number; rungs: number; run: (s: Shaft) => void }[] = [
  { need: 156, rungs: 2, run: (s) => shaftLedges(s, 2) },
  { need: 210, rungs: 3, run: shaftChimney },
  { need: 78, rungs: 1, run: (s) => shaftLedges(s, 1) },
  { need: 222, rungs: 3, run: shaftCascade },
  { need: 156, rungs: 2, run: (s) => shaftLedges(s, 2) },
];

/**
 * The uplink ascent.
 *
 * Doubled along with the horizontal stages — the climb is the mission, and at
 * 31 ledges it was over before it established a rhythm. The rung count falls
 * out of the world height and the drawn rises rather than being fixed, so the
 * topmost rung always lands within one low-gravity jump of the arena deck; a
 * hard-coded count and a changed height is how a climb ends in a wall.
 */
function makeVertical(mission: number): Stage {
  const rand = rng(1337 + mission * 977);
  const worldH = WORLD.VERTICAL_H * 2;
  const platforms: Platform[] = [];
  const enemies: EnemySpawn[] = [];

  /* CHANGED: the spawn floor was at worldH-72 with the first rung 73 px above
     it, 84% of the low-gravity ceiling (87% at 30 fps) on the first input of
     the mission. 18 px of floor and a deliberately short opening rise buy that
     back without moving anything else. */
  const floorY = worldH - 90;
  platforms.push({ x: 0, y: floorY, w: VIEW_W, h: 130, type: "deck", dir: 0 });

  /* The arena deck is 12 px rather than 18 for the same reason the rest floors
     have holes in them: it is full width and solid, so blockHorizontally shoves
     any Rook whose box is inside it, and the last rung of the climb therefore
     cannot be seated closer than PLAYER.H + this. That sum *is* the mission's
     final mandatory jump — it was 78 px, 90% of the measured low-gravity
     maximum, and it is the last input of the stage. Six pixels off the deck is
     six pixels off the jump. Seating an extra ledge instead does not work: a
     ledge at y 310 would put Rook's head inside the deck and the deck would
     throw him across the shaft. */
  const arenaH = 12;
  const lastY = WORLD.VERTICAL_BOSS_Y + PLAYER.H + arenaH;

  const s: Shaft = {
    rand, platforms, route: [], y: floorY, x: 0, w: VIEW_W,
    side: 1, rungs: 0, sinceFloor: 0,
  };
  s.route.push(platforms[0]);

  /* The opening rise is drawn short on purpose — first input of the mission,
     and the player has not yet felt low gravity — and kept left of x 400 so it
     is clear of the spawn column at x 470. */
  shaftRung(s, shaftInt(s, 44, 52), shaftInt(s, 200, 250), shaftInt(s, 30, 150));

  let m = 0;
  for (let guard = 0; guard < 300; guard++) {
    const room = s.y - lastY - SHAFT_RISE_MAX;
    if (room < 156) break;
    /* A rest floor every four or five rungs, drawn rather than fixed, and the
       three-rung motifs are held back when they would push the next floor out
       of that band. At the old fixed seven the shaft dropped the player up to
       462 px on a missed jump against a camera that shows 146 px below him, so
       the fall was unreadable and the recovery unearned. */
    const fits = SHAFT_MOTIFS[m].need <= room && s.sinceFloor + SHAFT_MOTIFS[m].rungs <= 3;
    if (s.sinceFloor >= shaftInt(s, 2, 3) || (!fits && s.sinceFloor >= 2)) {
      shaftGallery(s);
    } else if (fits) {
      SHAFT_MOTIFS[m].run(s);
      m = (m + 2) % SHAFT_MOTIFS.length;
    } else {
      shaftLedges(s, 1);
    }
  }

  /* Close the climb out on a rung the arena deck is a short hop above, leaving
     a full minimum rise in hand so the last two rungs are never crowded. */
  while (s.y - lastY > 70) {
    const rise = Math.min(
      SHAFT_RISE_MAX, Math.max(SHAFT_RISE_MIN, s.y - lastY - SHAFT_RISE_MIN),
    );
    shaftRung(s, rise, shaftInt(s, 150, 240),
              s.x + (s.rand() < 0.5 ? -1 : 1) * shaftInt(s, 90, 180));
  }
  shaftRung(s, s.y - lastY, shaftInt(s, 240, 320), shaftInt(s, 40, 340));

  platforms.push({
    x: 0, y: WORLD.VERTICAL_BOSS_Y, w: VIEW_W, h: arenaH, type: "boss", dir: 0,
  });

  const stage: Stage = {
    mission,
    vertical: true,
    worldW: VIEW_W,
    worldH,
    bossGateX: 0,
    bossGateY: WORLD.VERTICAL_BOSS_Y,
    platforms,
    enemies,
    /* Clear of the lowest climb ledge, which is kept left of x 400: spawning at
       x=78 put the player's body inside it for the first frame. */
    spawn: { x: 470, y: floorY - PLAYER.H },
    /* Seated on the spawn floor, which is solid, full width and cannot be
       dropped through — the one surface in the shaft that is all three. */
    checkpoint: { x: 470, y: floorY - PLAYER.H },
    bossSpawn: { x: VIEW_W - 190, y: WORLD.VERTICAL_BOSS_Y - BOSS.H, hp: bossHp(mission) },
  };

  repairOverlaps(stage);
  /* The climb spine only. Feeding the whole platform list to a pass that walks
     consecutive pairs would see the two halves of every gallery as a 200 px
     gap at the same height and bridge it — plugging the hole the climb goes up
     through. */
  addRequiredTransitions(stage, s.route);
  /* After the transition pass, never before it. The arena furniture is not part
     of the climb, and feeding it to a pass that walks consecutive pairs asks
     for a girder bridging the top rung to a ledge two screens above it. */
  furnishArena(stage, WORLD.VERTICAL_BOSS_Y, 0, stage.bossSpawn.x,
               BOSS_PROFILES[mission].width, BOSS.H, true);
  repairReachability(stage);
  populate(stage, rand);
  return stage;
}

export function buildStage(mission: number): Stage {
  if (MISSIONS[mission].effect === "lowgrav" && mission === 2) return makeVertical(mission);

  const rand = rng(9001 + mission * 613);
  const runSpan = runSpanFor(mission);
  const worldW = runSpan + WORLD.GATE_INSET;
  const bossGateX = runSpan;

  const b: Build = {
    mission,
    rand,
    ladder: LADDERS[mission].map((off) => WORLD.GROUND_Y + off),
    all: [],
    route: [],
    /* The approach and the lip in front of it are both reserved out of the
       motif loop's room; see the close-out below for why the lip exists. */
    limit: bossGateX - APPROACH_W - LIP_W,
    x: 0,
    /* The bastion is a descent, so it starts at the top of its ladder and
       drifts down; every other mission starts level with the arena. */
    rung: mission === 10 ? 4 : 1,
    climb: mission === 10 ? -1 : 1,
    section: 0,
  };

  /* A wide, quiet opening deck. It is the surface the stage's checkpoint is
     seated on and the surface reachableSet() starts its search from, so it is
     never thin and never interrupted. */
  const opening = groundAt(b, 620)!;

  const stride = STRIDES[mission % STRIDES.length];
  let m = mission % MOTIFS.length;

  /* Mechanic, first traversal challenge and first enemy pressure may not land
     in the same 250 px. Mission 7 introduced the conveyor at x 620 as the lip
     of a 484 px pit with two hounds standing on it, and mission 11's first pit
     was 294 px wide at x 910, on ice, at the top of a descent, with two fliers
     already engaged. Both rotations open on a pit (MOTIFS[6] and MOTIFS[10]),
     so one shelf in front of the rotation is what gives the new surface a
     screen of its own before it is also a hazard. */
  if (mission === 6 || mission === 10) flatRun(b);

  for (let guard = 0; guard < 400; guard++) {
    const room = b.limit - b.x;
    if (room < 250) break;
    /* A motif that cannot finish in the room left would be cut off mid-pit,
       which is how a stage ends up with a float and no landing on the far
       side. Falling back to the shelf was the old answer, and because the
       larger motifs need 800-820 px it fired on the last one to three
       iterations of every mission by construction: the run always arrived at
       the gate on flat ground, and mission 2's tail was 2 000 px of unbroken
       deck. Take the largest motif that does fit instead, scanning from the
       current slot along the mission's own stride so the choice still differs
       between missions, and keep the shelf only for when nothing fits. */
    let choice = m;
    if (MOTIFS[m].need > room) {
      choice = -1;
      for (let k = 1; k < MOTIFS.length; k++) {
        const c = (m + k * stride) % MOTIFS.length;
        if (MOTIFS[c].need <= room && (choice < 0 || MOTIFS[c].need > MOTIFS[choice].need)) {
          choice = c;
        }
      }
    }
    if (choice >= 0) MOTIFS[choice].run(b); else flatRun(b);
    m = (m + stride) % MOTIFS.length;
  }

  /* The lip: everything the motif loop could not fill, plus the reserved
     LIP_W, spent at a rung the approach is not at.
     The approach closes level with the arena, so a motif that happened to end
     on rung 1 ran straight into it and the two read as a single flat stretch —
     1 018 px on the installer quarter, 2 000 px on the silo access, which is
     the stretch playtest complained about by name. A guaranteed change of
     height at the mouth of the approach is what stops that merge. Rung 0 is
     the shallow sink, 20 to 34 px, so the step back up is a single-rung move
     and legal by construction. */
  b.limit = bossGateX - APPROACH_W;
  if (b.rung === 1) b.rung = 0;
  groundAt(b, b.limit - b.x);

  /* Close the run out level with the arena. */
  b.rung = 1;
  b.limit = bossGateX;
  groundAt(b, bossGateX - b.x);

  const platforms = b.all;
  platforms.push({
    x: bossGateX, y: WORLD.GROUND_Y, w: worldW - bossGateX, h: 90, type: "boss", dir: 0,
  });

  const stage: Stage = {
    mission,
    vertical: false,
    worldW,
    worldH: 360,
    bossGateX,
    bossGateY: 0,
    platforms,
    enemies: [],
    spawn: { x: 100, y: opening.y - 70 },
    /* Deliberately the spawn, not a point further in. PlayScene will not seat a
       moving checkpoint until the player is 35% of the way along the run — the
       first 3 600 px of every mission respawn here — so this seat is a real
       respawn point for five or six screens, not a formality. It stays on the
       opening deck because that is the one surface guaranteed solid, wide,
       un-thin and with no pit under it; anything further in is only safe if the
       generator also proves those four things about it. */
    checkpoint: { x: 100, y: opening.y - 80 },
    bossSpawn: {
      x: bossGateX + 390,
      y: WORLD.GROUND_Y - (mission === FINAL_MISSION ? BOSS.H_FINAL : BOSS.H),
      hp: bossHp(mission),
    },
  };

  repairOverlaps(stage);
  addRequiredTransitions(stage, b.route);
  furnishArena(stage, WORLD.GROUND_Y, bossGateX, stage.bossSpawn.x,
               BOSS_PROFILES[mission].width,
               mission === FINAL_MISSION ? BOSS.H_FINAL : BOSS.H, false);
  repairReachability(stage);
  populate(stage, rand);
  return stage;
}

/** Every mission, built once. Used by the audit script. */
export function buildAllStages(): Stage[] {
  return MISSIONS.map((_, i) => buildStage(i));
}
