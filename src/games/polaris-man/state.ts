/* Polaris-Man — the world state, as one explicit object.
 *
 * v1.7 kept the run in about twenty module-level `let`s. That works for a
 * single-page prototype and breaks the moment the game can be opened, closed
 * and reopened inside a live site: stale values survive, and nothing tells you
 * which of the twenty you forgot to reset. Here the entire run lives in one
 * `World`, so starting a mission is a fresh object and teardown is dropping a
 * reference.
 */

import {
  ENEMY_DEF, ENEMY_FORMATIONS, FINAL_PLATFORMS, FINAL_SHIELDS, GROUNDED_BOSSES,
  MECHANIC_KIND, MISSIONS, PLATFORM_OFFSETS, PLATFORM_WIDTHS, PLATFORM_YS, ROSTERS,
  type Mission, type MoonId, type ShotKind, type WeaponId,
} from "./data";
import { AMMO_FINAL, AMMO_MOON, BOSS, ENEMY, PLAYER, RELAY, WORLD } from "./tuning";
import type { Body, Solid } from "./physics";
import type { Progress } from "./progress";

export interface Player extends Body {
  face: number;
  coyote: number;
  jbuf: number;
  airJumps: number;
  dash: number;
  dashCd: number;
  fireCd: number;
  fireAnim: number;
  fireHeld: boolean;
  charge: number;
  chargeReady: boolean;
  chargeFx: number;
  runT: number;
  slow: number;
  heatShield: number;
  hp: number;
  max: number;
  inv: number;
  score: number;
  checkX: number;
}

export interface Enemy {
  x: number;
  y: number;
  w: number;
  h: number;
  origin: number;
  type: string;
  hp: number;
  max: number;
  vx: number;
  cd: number;
  baseY: number;
  seed: number;
  range: number;
  dead: boolean;
  flash: number;
}

export interface Shot {
  x: number; y: number; w: number; h: number;
  vx: number; vy: number;
  dmg: number;
  t: number;
  k: WeaponId;
  age: number;
  charged?: boolean;
  pierce?: number;
  home?: boolean;
  shield?: boolean;
}

export interface EnemyShot {
  x: number; y: number; w: number; h: number;
  vx: number; vy: number;
  t: number;
  kind: ShotKind;
  col: string;
  age: number;
  slow?: boolean;
  home?: boolean;
  jitter?: boolean;
  ay?: number;
  boss?: boolean;
  orbit?: number;
  trail?: { x: number; y: number }[];
}

export interface Particle {
  x: number; y: number; vx: number; vy: number; t: number; col: string; s: number;
}

export interface Relay {
  x: number; y: number; on: boolean; index: number;
}

export interface Mechanic {
  x: number; y: number; w: number; h: number;
  kind: "packet" | "thaw" | "rail" | "coolant";
  cd: number;
  phase: number;
}

export interface Boss {
  x: number; y: number; w: number; h: number;
  hp: number; max: number;
  cd: number; t: number; phase: number;
  flash: number; weakFlash: number;
  dead: boolean; exploding: boolean;
  volley: number;
  vx: number; vy: number;
  aiT: number; targetX: number;
  grounded: boolean;
  shields: WeaponId[];
  burst?: number;
  state?: string;
  stateT?: number;
  stateAge?: number;
  fired?: boolean;
  action?: number;
  moveDir?: number;
  face?: number;
  stagger?: number;
  hitFx?: number;
  hitX?: number;
  hitY?: number;
  hitColor?: string;
  arielTokenCd?: number;
}

/** Ariel's pairing-lock mechanic — the only mission with bespoke state. */
export interface ArielState {
  pairLock: number;
  pairImmune: number;
  signalIntro: boolean;
  phase2: boolean;
  phase3: boolean;
}

export interface World {
  mission: Mission;
  width: number;
  solids: Solid[];
  relays: Relay[];
  mechanics: Mechanic[];
  zoneStarts: number[];
  enemies: Enemy[];
  shots: Shot[];
  enemyShots: EnemyShot[];
  parts: Particle[];
  boss: Boss | null;
  player: Player;
  ammo: Record<string, number>;
  weaponIndex: number;
  missionT: number;
  cam: number;
  shake: number;
  jumpFx: number;
  victoryT: number;
  victoryShown: boolean;
  ariel: ArielState;
  /** Rebuilt once per frame; `move()` is called several times a frame and
   *  concatenating the gate list each time was measurable. */
  activeSolids: Solid[];
}

export function freshAriel(): ArielState {
  return { pairLock: 0, pairImmune: 0, signalIntro: false, phase2: false, phase3: false };
}

export function makePlayer(px: number, doubleJump: boolean, hp: number = PLAYER.HP): Player {
  return {
    x: px, y: PLAYER.SPAWN_Y, w: PLAYER.W, h: PLAYER.H,
    vx: 0, vy: 0, face: 1, on: false, wall: 0,
    coyote: 0, jbuf: 0, airJumps: doubleJump ? 1 : 0,
    dash: 0, dashCd: 0, fireCd: 0, fireAnim: 0, fireHeld: false,
    charge: 0, chargeReady: false, chargeFx: 0,
    runT: 0, slow: 0, heatShield: 0,
    hp, max: hp, inv: PLAYER.INV_SPAWN, score: 0, checkX: px,
  };
}

/** Platform layout for a moon: ground, five sectors of six decks plus a wall,
 *  then the boss run-up. Identical geometry to v1.7. */
export function missionPlatforms(id: MoonId, zoneStarts: readonly number[], width: number): Solid[] {
  const out: Solid[] = [{ x: 0, y: WORLD.FLOOR, w: width, h: 24, kind: "ground" }];
  const ys = PLATFORM_YS[id];

  for (let i = 0; i < zoneStarts.length; i++) {
    const z = zoneStarts[i];
    const jitter = (i % 2) * 7;
    for (let k = 0; k < PLATFORM_OFFSETS.length; k++) {
      out.push({
        x: z + PLATFORM_OFFSETS[k] + (k % 2 ? jitter : 0),
        y: ys[i][k],
        w: PLATFORM_WIDTHS[k],
        h: 8,
        kind: "platform",
        tier: k,
      });
    }
    out.push({ x: z + 707, y: 89, w: 30, h: 67, kind: "wall" });
  }

  out.push(
    { x: width - 700, y: WORLD.FLOOR, w: 700, h: 24, kind: "ground" },
    { x: width - 620, y: 130, w: 82, h: 8, kind: "platform" },
    { x: width - 510, y: 108, w: 84, h: 8, kind: "platform" },
    { x: width - 392, y: 88, w: 98, h: 8, kind: "platform" },
  );
  return out;
}

export function makeEnemy(px: number, type: string, i: number, solids: readonly Solid[]): Enemy {
  const d = ENEMY_DEF[type];
  const ledge = solids
    .filter((s) => s.kind === "platform" && px >= s.x + 8 && px <= s.x + s.w - 24)
    .sort((a, b) => a.y - b.y)[0];
  const baseY = 58 + (i % 3) * 18;
  const sp = d.fly ? ENEMY.FLY_SPEED : d.speed;
  return {
    x: px,
    origin: px,
    y: d.fly ? baseY : ledge ? ledge.y - 14 : WORLD.FLOOR - 14,
    w: ENEMY.W,
    h: ENEMY.H,
    type,
    hp: d.hp,
    max: d.hp,
    vx: i % 2 ? sp : -sp,
    cd: 1.05 + (i % 4) * 0.32,
    baseY,
    seed: i * 1.73,
    range: ledge ? Math.min(24, ledge.w / 3) : 34,
    dead: false,
    flash: 0,
  };
}

/** Build a full moon mission. */
export function buildMoonWorld(mission: Mission, progress: Progress): World {
  const id = mission.id as MoonId;
  const width = WORLD.MOON;
  const zoneStarts = [...WORLD.ZONE_STARTS];
  const solids = missionPlatforms(id, zoneStarts, width);
  const missionIndex = MISSIONS.indexOf(mission);

  const relays: Relay[] = zoneStarts.map((z, i) => ({
    x: z + 760 + missionIndex * 5,
    y: 94 + (i % 2) * 10,
    on: false,
    index: i,
  }));

  const mechanics: Mechanic[] = zoneStarts.map((z, i) => ({
    x: z + 515,
    y: 150,
    w: 82,
    h: 6,
    kind: MECHANIC_KIND[id],
    cd: 0,
    phase: i * 0.8,
  }));

  const types = ROSTERS[id];
  const enemies: Enemy[] = [];
  for (let z = 0; z < zoneStarts.length; z++) {
    const form = ENEMY_FORMATIONS[z];
    for (let i = 0; i < form.length; i++) {
      enemies.push(makeEnemy(zoneStarts[z] + form[i], types[(i + z) % 3], z * 5 + i, solids));
    }
  }

  return baseWorld(mission, width, solids, relays, mechanics, zoneStarts, enemies, progress,
    PLAYER.SPAWN_X, PLAYER.HP, { ...AMMO_MOON });
}

/** Build the Polaris Nexus: one arena, no sectors, no relays. */
export function buildFinalWorld(mission: Mission, progress: Progress): World {
  const width = WORLD.FINAL;
  const solids: Solid[] = [
    { x: 0, y: WORLD.FLOOR, w: width, h: 24, kind: "ground" },
    ...FINAL_PLATFORMS.map((p) => ({ ...p, kind: "platform" as const })),
  ];
  return baseWorld(mission, width, solids, [], [], [], [], progress,
    PLAYER.SPAWN_X_FINAL, PLAYER.HP_FINAL, { ...AMMO_FINAL });
}

function baseWorld(
  mission: Mission,
  width: number,
  solids: Solid[],
  relays: Relay[],
  mechanics: Mechanic[],
  zoneStarts: number[],
  enemies: Enemy[],
  progress: Progress,
  spawnX: number,
  hp: number,
  ammo: Record<string, number>,
): World {
  return {
    mission,
    width,
    solids,
    relays,
    mechanics,
    zoneStarts,
    enemies,
    shots: [],
    enemyShots: [],
    parts: [],
    boss: null,
    player: makePlayer(spawnX, progress.abilities.doubleJump, hp),
    ammo,
    weaponIndex: 0,
    missionT: 0,
    cam: 0,
    shake: 0,
    jumpFx: 0,
    victoryT: 0,
    victoryShown: false,
    ariel: freshAriel(),
    activeSolids: solids,
  };
}

/** Solids the player collides with this frame: the level, plus a hard gate in
 *  front of every relay that has not been secured. */
export function refreshActiveSolids(w: World): void {
  if (w.mission.id === "final") {
    w.activeSolids = w.solids;
    return;
  }
  const gates = w.relays
    .filter((r) => !r.on)
    .map((r) => ({ x: r.x + RELAY.GATE_OFFSET, y: 78, w: 12, h: 78 }));
  w.activeSolids = gates.length ? w.solids.concat(gates) : w.solids;
}

export function gateX(w: World): number {
  return w.width - 470;
}

export function bossX(w: World): number {
  return w.width - 185;
}

/** Should the boss spawn this frame? */
export function bossReady(w: World): boolean {
  if (w.boss) return false;
  if (w.mission.id === "final") return w.player.x > 880;
  return w.player.x > w.width - BOSS.TRIGGER_X_OFFSET && w.relays.every((r) => r.on);
}

export function makeBoss(w: World): Boss {
  const final = w.mission.id === "final";
  const grounded = !final && GROUNDED_BOSSES.has(w.mission.id);
  const hp = final ? BOSS.HP_FINAL : BOSS.HP;
  const h = final ? BOSS.H_FINAL : BOSS.H;
  const width = final ? BOSS.W_FINAL : BOSS.W;
  return {
    x: bossX(w),
    y: grounded ? WORLD.FLOOR - h : final ? BOSS.Y_FINAL : BOSS.Y_FLYING,
    w: width,
    h,
    hp,
    max: hp,
    cd: 1.35,
    t: 0,
    phase: 0,
    flash: 0,
    weakFlash: 0,
    dead: false,
    exploding: false,
    volley: 0,
    vx: 0,
    vy: 0,
    aiT: 0.5,
    targetX: bossX(w),
    grounded: grounded || final,
    shields: final ? [...FINAL_SHIELDS] : [],
  };
}
