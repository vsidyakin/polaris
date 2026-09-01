/* Polaris-Man — the simulation.
 *
 * A direct port of v1.7's update path: player, weapons, enemies, boss AI,
 * projectiles, the per-moon sector mechanic, and Ariel's pairing lock. It takes
 * a context object rather than reaching for module state, and it never touches
 * Phaser, the DOM or the canvas — which is what lets the state logic be tested
 * from Node.
 *
 * Ordering inside `updateWorld` matters and matches the original exactly:
 * timers, then input, then movement, then the mechanic, then projectiles, then
 * actors, then the boss check, then the camera. Reordering any of it changes
 * one-frame behaviour somewhere.
 */

import {
  ARIEL_RELAY_MESSAGES, BOSS_PROFILES, BOSS_SHOT_SOUND, ENEMY_DEF, FINAL_SHIELDS,
  SHOT_SIZE, SHOT_SOUND_ALIAS, SPAWN_COLOR, WEAPONS,
  type ShotKind, type WeaponId,
} from "./data";
import {
  BOSS, CAMERA, CHARGED_FIRE_COOLDOWN, ENEMY, FIRE_COOLDOWN, PLAYER,
  RELAY, SCREEN_SHAKE, VIEW, WORLD,
} from "./tuning";
import { approach, clamp, decay, hit, hurtbox, move, rr, type Box } from "./physics";
import { bossReady, makeBoss, makeEnemy, refreshActiveSolids, type Boss, type EnemyShot, type World } from "./state";
import { weaponsEarnedFrom, type Progress } from "./progress";
import type { AudioManager } from "./audio";

export interface Input {
  /** Held this frame. */
  down(...codes: string[]): boolean;
  /** Went down this frame. */
  was(...codes: string[]): boolean;
}

export interface SimContext {
  world: World;
  progress: Progress;
  input: Input;
  audio: AudioManager;
  toast(msg: string, seconds?: number): void;
  reduced: boolean;
  /** Monotonic animation clock, shared with the renderer. */
  clock: number;
  onPlayerDied(): void;
  onBossDefeated(): void;
}

/* --- weapons --- */

export function ownedWeapons(progress: Progress): WeaponId[] {
  const earned = weaponsEarnedFrom(progress.cleared);
  progress.weapons = earned;
  return earned;
}

export function currentWeapon(w: World, progress: Progress) {
  const ids = ownedWeapons(progress);
  w.weaponIndex = (w.weaponIndex + ids.length) % ids.length;
  const id = ids[w.weaponIndex];
  return { id, ...WEAPONS[id] };
}

export function cycleWeapon(ctx: SimContext, dir: number): void {
  const { world: w, progress } = ctx;
  if (w.mission.id === "ariel" && w.ariel.pairLock > 0) return;
  const ids = ownedWeapons(progress);
  if (ids.length < 2) return;
  w.weaponIndex = (w.weaponIndex + dir + ids.length) % ids.length;
  w.player.charge = 0;
  w.player.chargeReady = false;
  w.player.fireHeld = false;
  ctx.audio.menu();
  ctx.toast(currentWeapon(w, progress).name, 0.9);
}

/* --- Ariel pairing lock --- */

export function clearPairingLock(w: World, immunity = 0.35): void {
  if (w.mission.id !== "ariel") return;
  w.ariel.pairLock = 0;
  w.ariel.pairImmune = Math.max(w.ariel.pairImmune, immunity);
  w.player.charge = 0;
  w.player.chargeReady = false;
  w.player.fireHeld = false;
}

function applyPairingLock(ctx: SimContext, duration = 0.8): void {
  const { world: w } = ctx;
  if (w.mission.id !== "ariel" || w.ariel.pairLock > 0 || w.ariel.pairImmune > 0) return;
  w.ariel.pairLock = duration;
  w.player.charge = 0;
  w.player.chargeReady = false;
  w.player.fireHeld = false;
  ctx.toast("PAIRING LOCK · SIGNAL AUTHORIZATION REQUIRED", 0.8);
}

function updateArielState(w: World, dt: number): void {
  if (w.mission.id !== "ariel") return;
  const wasLocked = w.ariel.pairLock > 0;
  w.ariel.pairLock = Math.max(0, w.ariel.pairLock - dt);
  w.ariel.pairImmune = Math.max(0, w.ariel.pairImmune - dt);
  if (wasLocked && w.ariel.pairLock <= 0) w.ariel.pairImmune = 0.7;
}

/* --- particles --- */

export function emit(ctx: SimContext, px: number, py: number, col: string, n = 7): void {
  const count = ctx.reduced ? Math.min(2, n) : n;
  for (let i = 0; i < count; i++) {
    ctx.world.parts.push({
      x: px, y: py,
      vx: rr(-75, 75), vy: rr(-95, 25),
      t: rr(0.25, 0.65), col,
      s: Math.random() < 0.2 ? 3 : 2,
    });
  }
}

function shakeBy(ctx: SimContext, amount: number): void {
  ctx.world.shake = ctx.reduced ? 0 : amount;
}

/* --- damage --- */

export function hurt(ctx: SimContext, d: number): void {
  const { world: w } = ctx;
  const p = w.player;
  if (p.inv > 0) return;
  p.hp -= d;
  p.inv = PLAYER.INV_HIT;
  p.vy = PLAYER.KNOCKBACK_VY;
  p.vx = -p.face * PLAYER.KNOCKBACK_VX;
  p.charge = 0;
  p.chargeReady = false;
  p.fireHeld = false;
  shakeBy(ctx, SCREEN_SHAKE.HIT);
  ctx.audio.hurt();
  emit(ctx, p.x + 7, p.y + 9, "#ee6d78", 10);
  if (p.hp <= 0) {
    ctx.audio.fail();
    ctx.onPlayerDied();
  }
}

/* --- checkpoints --- */

export function activateRelay(ctx: SimContext): void {
  const { world: w } = ctx;
  const p = w.player;
  const r = w.relays.find(
    (q) => !q.on && Math.abs(p.x - q.x) < RELAY.RANGE_X && Math.abs(p.y - q.y) < RELAY.RANGE_Y,
  );
  if (!r) {
    ctx.toast("NO WORKSPACE CHECKPOINT IN RANGE", 0.8);
    return;
  }
  r.on = true;
  p.checkX = r.x + 28;
  /* Only the repair station restores health — see RELAY.HEALING_INDEX. */
  const heals = r.index === RELAY.HEALING_INDEX;
  const wasHurt = p.hp < p.max;
  if (heals) p.hp = p.max;
  p.score += RELAY.SCORE;
  p.inv = PLAYER.INV_CHECKPOINT;
  ctx.audio.relay();
  emit(ctx, r.x, r.y, heals ? "#7ce3a8" : "#61c8dc", 22);
  refreshActiveSolids(w);

  if (heals && wasHurt) ctx.toast("REPAIR STATION · SYSTEMS RESTORED", 1.8);

  if (w.mission.id === "ariel") {
    clearPairingLock(w, 0.7);
    w.enemyShots = w.enemyShots.filter(
      (s) => (s.kind !== "pair" && s.kind !== "token") || Math.abs(s.x - r.x) > 280,
    );
    ctx.toast(ARIEL_RELAY_MESSAGES[r.index], 2.2);
  } else {
    w.enemyShots = [];
    ctx.toast(
      r.index === w.relays.length - 1
        ? "FINAL CHECKPOINT SECURED · BOSS GATE OPEN"
        : `CHECKPOINT ${r.index + 1}/5 SECURED · NEXT SECTOR OPEN`,
      2,
    );
  }
}

/* --- sector mechanic --- */

function updateMissionMechanic(ctx: SimContext, dt: number): void {
  const { world: w } = ctx;
  const p = w.player;
  w.jumpFx = Math.max(0, w.jumpFx - dt * 1.7);
  p.heatShield = Math.max(0, p.heatShield - dt);

  for (const m of w.mechanics) {
    m.cd = Math.max(0, m.cd - dt);
    const inRange = Math.abs(p.x - (m.x + m.w / 2)) < m.w / 2 + 8 && p.y + p.h > m.y - 8;

    if (inRange) {
      if (m.kind === "packet") {
        if (w.mission.id === "ariel") {
          clearPairingLock(w, 0.45);
          if (!w.ariel.signalIntro) {
            w.ariel.signalIntro = true;
            ctx.toast("OPEN SIGNAL PATH · PAIRING BYPASSED", 1.7);
          }
        }
        if (m.cd <= 0) {
          p.vx = Math.max(155, p.vx);
          p.vy = -80;
          p.dashCd = 0;
          m.cd = 1.1;
          emit(ctx, p.x, p.y + 18, "#7ce3a8", 10);
        }
      } else if (m.kind === "thaw" && m.cd <= 0) {
        p.slow = 0;
        p.hp = Math.min(p.max, p.hp + 1);
        m.cd = 2.4;
        emit(ctx, p.x, p.y + 18, "#dff6ff", 8);
      } else if (m.kind === "rail") {
        p.vx = Math.max(175, p.vx);
        p.dashCd = 0;
        if (m.cd <= 0) {
          m.cd = 0.22;
          emit(ctx, p.x, p.y + 20, "#61c8dc", 4);
        }
      } else if (m.kind === "coolant") {
        p.heatShield = 2.8;
        if (m.cd <= 0) {
          m.cd = 0.35;
          emit(ctx, p.x, p.y + 18, "#7ce3a8", 4);
        }
      }
    }

    /* Oberon's vents fire on a global sine, in or out of range. */
    if (m.kind === "coolant") {
      const hot = Math.sin(ctx.clock * 1.25 + m.phase) > 0.78;
      const vx = m.x + 112;
      if (hot && p.heatShield <= 0 && p.x + p.w > vx && p.x < vx + 20 && p.y + p.h > 105) {
        hurt(ctx, 1);
      }
    }
  }
}

/* --- firing --- */

export function fire(ctx: SimContext, charged = false): void {
  const { world: w, progress } = ctx;
  const p = w.player;
  const weapon = currentWeapon(w, progress);
  const isCharged = charged && weapon.id === "pulse";

  if (p.fireCd > 0 || w.ammo[weapon.id] < weapon.cost) return;
  w.ammo[weapon.id] -= weapon.cost;
  p.fireCd = isCharged ? CHARGED_FIRE_COOLDOWN : FIRE_COOLDOWN[weapon.id];
  p.fireAnim = isCharged ? 0.28 : 0.16;

  const sx = p.x + (p.face > 0 ? 30 : -22);
  const sy = p.y + 8;
  const dir = p.face;
  const k = weapon.id;

  if (isCharged) ctx.audio.chargedShot();
  else ctx.audio.shot(SHOT_SOUND_ALIAS[k] ?? k);

  const push = (s: Partial<EnemyShotLike> & { x: number; y: number; w: number; h: number; vx: number; vy: number; dmg: number; t: number }) =>
    w.shots.push({ k, age: 0, ...s } as never);

  if (k === "pulse") {
    push({
      x: sx, y: sy - (isCharged ? 4 : 1),
      w: isCharged ? 16 : 8, h: isCharged ? 9 : 4,
      vx: dir * (isCharged ? 195 : 230), vy: 0,
      dmg: isCharged ? PLAYER.CHARGE_DAMAGE : 1,
      t: isCharged ? 1.9 : 1.5,
      charged: isCharged,
    });
  } else if (k === "browser") {
    for (const a of [-0.22, 0, 0.22]) {
      push({ x: sx, y: sy, w: 5, h: 3, vx: dir * 190, vy: a * 120, dmg: 1, t: 1.5 });
    }
  } else if (k === "canvas") {
    for (const o of [0, 7]) {
      push({ x: sx, y: sy + o, w: 9, h: 3, vx: dir * 175, vy: 0, dmg: 1.5, t: 1.7 });
    }
  } else if (k === "crossnet") {
    push({ x: sx, y: sy, w: 7, h: 4, vx: dir * 150, vy: 0, dmg: 2, t: 2.2, pierce: 2, home: true });
  } else if (k === "evergreen") {
    push({ x: sx, y: sy - 5, w: 13, h: 14, vx: dir * 110, vy: 0, dmg: 3, t: 2.1, shield: true });
  } else if (k === "airlink") {
    push({ x: sx, y: sy - 2, w: 14, h: 6, vx: dir * 205, vy: 0, dmg: 2.1, t: 1.7, pierce: 1 });
  } else if (k === "guestkey") {
    for (const a of [-0.12, 0, 0.12]) {
      push({ x: sx, y: sy - 1, w: 6, h: 6, vx: dir * 175, vy: a * 90, dmg: 1.15, t: 1.7 });
    }
  } else if (k === "byomswitch") {
    push({ x: sx, y: sy - 3, w: 11, h: 8, vx: dir * 165, vy: 0, dmg: 2.5, t: 2, pierce: 1 });
  } else if (k === "fleetsync") {
    for (const o of [-5, 5]) {
      push({ x: sx, y: sy + o, w: 7, h: 5, vx: dir * 145, vy: 0, dmg: 1.7, t: 2.4, home: true });
    }
  }

  emit(ctx, sx, sy, isCharged ? "#7ce3a8" : weapon.color, isCharged ? 16 : 5);
  if (isCharged) shakeBy(ctx, SCREEN_SHAKE.CHARGED_SHOT);
}

type EnemyShotLike = Record<string, unknown>;

function updateTrigger(ctx: SimContext, dt: number): void {
  const { world: w, input, progress } = ctx;
  const p = w.player;
  const held = input.down("KeyX", "KeyJ");
  const tap = input.was("KeyX", "KeyJ");
  const weapon = currentWeapon(w, progress);

  updateArielState(w, dt);
  if (w.mission.id === "ariel" && w.ariel.pairLock > 0) {
    p.fireHeld = false;
    p.charge = 0;
    p.chargeReady = false;
    return;
  }

  if (weapon.id === "pulse") {
    if (held) {
      p.fireHeld = true;
      if (p.fireCd <= 0) {
        const before = p.charge;
        p.charge = Math.min(PLAYER.CHARGE_TIME, p.charge + dt);
        p.chargeFx -= dt;
        if (p.chargeFx <= 0) {
          p.chargeFx = 0.1;
          const mx = p.x + (p.face > 0 ? 29 : -17);
          w.parts.push({
            x: mx, y: p.y + 8,
            vx: rr(-12, 12), vy: rr(-18, 8),
            t: 0.28,
            col: p.charge >= PLAYER.CHARGE_TIME ? "#f7f3ff" : "#7ce3a8",
            s: p.charge >= PLAYER.CHARGE_TIME ? 2 : 1,
          });
        }
        if (before < PLAYER.CHARGE_TIME && p.charge >= PLAYER.CHARGE_TIME) {
          p.chargeReady = true;
          ctx.audio.chargeReady();
        }
      }
    } else if (p.fireHeld || tap) {
      fire(ctx, p.charge >= PLAYER.CHARGE_TIME);
      p.fireHeld = false;
      p.charge = 0;
      p.chargeReady = false;
    }
  } else {
    if (tap) fire(ctx, false);
    p.fireHeld = held;
    p.charge = 0;
    p.chargeReady = false;
  }
}

/* --- hostile projectiles --- */

function hostileShot(
  w: World,
  px: number, py: number, tx: number, ty: number,
  speed: number, kind: ShotKind, angle = 0,
  extra: Partial<EnemyShot> = {},
): EnemyShot {
  const a = Math.atan2(ty - py, tx - px) + angle;
  const size = SHOT_SIZE[kind] ?? 5;
  const shot: EnemyShot = {
    x: px, y: py, w: size, h: size,
    vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
    t: 4, kind,
    col: SPAWN_COLOR[kind] ?? w.mission.accent,
    age: 0,
    ...extra,
  };
  w.enemyShots.push(shot);
  return shot;
}

function spawnEnemyAttack(ctx: SimContext, e: { x: number; y: number; w: number; h: number; type: string }): void {
  const { world: w } = ctx;
  const sx = e.x + e.w / 2;
  const sy = e.y + e.h / 2;
  const tx = w.player.x + 7;
  const ty = w.player.y + 10;
  const k = ENEMY_DEF[e.type].shot;
  ctx.audio.enemy(k);

  if (k === "packet") {
    for (const a of [-0.18, 0, 0.18]) hostileShot(w, sx, sy, tx, ty, 92, k, a);
  } else if (k === "token") {
    hostileShot(w, sx, sy, tx, ty, 72, k, 0, { ay: 125 });
  } else if (k === "ice") {
    for (const a of [-0.16, 0, 0.16]) hostileShot(w, sx, sy, tx, ty, 88, k, a, { slow: true });
  } else if (k === "freeze") {
    hostileShot(w, sx, sy, tx, ty, 58, k, 0, { slow: true });
  } else if (k === "icicle") {
    const ix = w.player.x + rr(-22, 22);
    w.enemyShots.push({
      x: ix, y: 18, w: 4, h: 11, vx: 0, vy: 105, t: 2.2,
      kind: k, col: "#dff6ff", slow: true, age: 0,
    });
  } else if (k === "spark") {
    hostileShot(w, sx, sy, tx, ty, 132, k, 0, { jitter: true });
  } else if (k === "bolt") {
    for (const a of [-0.13, 0.13]) hostileShot(w, sx, sy, tx, ty, 108, k, a, { jitter: true });
  } else if (k === "home") {
    hostileShot(w, sx, sy, tx, ty, 72, k, 0, { home: true });
  } else if (k === "fire") {
    hostileShot(w, sx, sy, tx, ty, 105, k, 0, { ay: 22 });
  } else if (k === "lava") {
    hostileShot(w, sx, sy, tx, ty, 72, k, 0, { ay: 115 });
  } else if (k === "flame") {
    for (const a of [-0.15, 0, 0.15]) hostileShot(w, sx, sy, tx, ty, 95, k, a);
  } else {
    hostileShot(w, sx, sy, tx, ty, 90, k);
  }
}

function spawnBossAttack(ctx: SimContext): void {
  const { world: w } = ctx;
  const b = w.boss!;
  const before = w.enemyShots.length;
  const sx = b.x + (w.player.x < b.x ? 4 : b.w - 4);
  const sy = b.y + b.h * 0.42;
  const tx = w.player.x + 7;
  const ty = w.player.y + 10;
  const p = b.phase;
  const v = ++b.volley;
  const id = w.mission.id;

  if (id === "final") {
    const cycle: ShotKind[] = ["pair", "ice", "bolt", "fire", "packet", "home"];
    const k = cycle[(v - 1) % cycle.length];
    const n = p === 2 ? 2 : 1;
    for (let i = 0; i < n; i++) {
      const extra: Partial<EnemyShot> =
        k === "ice" ? { slow: true } : k === "bolt" ? { jitter: true }
        : k === "fire" ? { ay: 18 } : k === "home" ? { home: true } : {};
      hostileShot(w, sx, sy, tx, ty, 86 + p * 7, k, (i - (n - 1) / 2) * 0.18, extra);
    }
    if (v % 5 === 0) hostileShot(w, sx, sy, tx, ty, 64, "home", 0, { home: true });
  } else if (id === "ariel") {
    const n = 1 + p;
    for (let i = 0; i < n; i++) hostileShot(w, sx, sy, tx, ty, 88 + p * 7, "pair", (i - (n - 1) / 2) * 0.16);
    if (v % 3 === 0) hostileShot(w, sx, sy, tx, WORLD.FLOOR - 7, 66, "token", 0, { ay: 95 });
  } else if (id === "umbriel") {
    const n = 2 + p;
    for (let i = 0; i < n; i++) hostileShot(w, sx, sy, tx, ty, 76 + p * 6, "ice", (i - (n - 1) / 2) * 0.17, { slow: true });
    if (v % 2 === 0) {
      const ix = w.player.x + rr(-20, 20);
      w.enemyShots.push({
        x: ix, y: 15, w: 5, h: 12, vx: 0, vy: 96 + p * 7, t: 2.5,
        kind: "icicle", col: "#dff6ff", slow: true, age: 0,
      });
    }
  } else if (id === "titania") {
    const n = 1 + p;
    for (let i = 0; i < n; i++) hostileShot(w, sx, sy, tx, ty, 98 + p * 7, "bolt", (i - (n - 1) / 2) * 0.15, { jitter: true });
    if (v % 3 === 0) hostileShot(w, sx, sy, tx, ty, 64, "home", 0, { home: true });
  } else if (id === "oberon") {
    const n = 1 + p;
    for (let i = 0; i < n; i++) hostileShot(w, sx, sy, tx, ty, 86 + p * 7, "fire", (i - (n - 1) / 2) * 0.16, { ay: 16 });
    if (v % 3 === 0) hostileShot(w, sx, sy, tx, WORLD.FLOOR - 5, 62, "lava", 0, { ay: 100 });
  } else if (id === "miranda") {
    const n = 1 + p;
    for (let i = 0; i < n; i++) {
      hostileShot(w, sx, sy, tx, ty, 92 + p * 6, i % 2 ? "bolt" : "spark", (i - (n - 1) / 2) * 0.15, { jitter: true });
    }
    if (v % 3 === 0) hostileShot(w, sx, sy, tx, ty, 68, "home", 0, { home: true });
  } else if (id === "puckmoon") {
    const n = 2 + p;
    for (let i = 0; i < n; i++) hostileShot(w, sx, sy, tx, ty, 82 + p * 6, "packet", (i - (n - 1) / 2) * 0.16);
    if (v % 2 === 0) hostileShot(w, sx, sy, tx, WORLD.FLOOR - 6, 66, "token", 0, { ay: 105 });
  } else if (id === "cressida") {
    const n = 1 + p;
    for (let i = 0; i < n; i++) hostileShot(w, sx, sy, tx, ty, 90 + p * 7, "pair", (i - (n - 1) / 2) * 0.14);
    if (v % 3 === 0) hostileShot(w, sx, sy, tx, ty, 62, "home", 0, { home: true });
  } else {
    const n = 1 + p;
    for (let i = 0; i < n; i++) {
      hostileShot(w, sx, sy, tx, ty, 86 + p * 6, i % 2 ? "packet" : "home", (i - (n - 1) / 2) * 0.17, i % 2 ? {} : { home: true });
    }
    if (v % 3 === 0) hostileShot(w, sx, sy, tx, ty, 104, "bolt", 0, { jitter: true });
  }

  for (let i = before; i < w.enemyShots.length; i++) {
    const s = w.enemyShots[i];
    s.boss = true;
    s.orbit = i - before;
    s.trail = [];
  }
  ctx.audio.shot(BOSS_SHOT_SOUND[id]);
}

/* --- boss damage --- */

function bossDamage(ctx: SimContext, s: { dmg: number; k: WeaponId; charged?: boolean; x: number; y: number; w: number; h: number; t: number }, b: Boss): void {
  const { world: w } = ctx;
  let dmg = s.dmg;

  if (w.mission.id === "final") {
    if (b.shields.length) {
      const n = b.shields.indexOf(s.k);
      if (n >= 0) {
        b.shields.splice(n, 1);
        dmg = b.max * BOSS.SHIELD_BREAK_DAMAGE;
        ctx.toast(`${WEAPONS[s.k].short} SHIELD COLLAPSED · ${b.shields.length} REMAIN`, 1.2);
      } else {
        dmg = BOSS.SHIELDED_DAMAGE;
      }
    } else if (s.k === "pulse" && s.charged) {
      dmg = BOSS.FINAL_CHARGED_DAMAGE;
    } else {
      dmg *= BOSS.FINAL_STRIPPED_MULT;
    }
  } else if (s.k === w.mission.weak) {
    dmg = Math.max(dmg, b.max * BOSS.WEAKNESS_DAMAGE);
    if (!b.weakFlash) {
      b.weakFlash = 0.8;
      ctx.toast(`${WEAPONS[s.k].short} IS THE DISRUPTION · CRITICAL HIT`, 1);
    }
  }

  b.hp -= dmg;
  b.flash = 0.09;
  b.hitFx = 0.28;
  b.hitX = clamp(s.x + s.w / 2 - b.x, 3, b.w - 3);
  b.hitY = clamp(s.y + s.h / 2 - b.y, 4, b.h - 4);
  b.hitColor = WEAPONS[s.k].color;
  b.stagger = Math.max(b.stagger ?? 0, s.charged ? 0.12 : 0.055);
  s.t = 0;
  shakeBy(ctx, s.charged ? SCREEN_SHAKE.BOSS_HIT_CHARGED : SCREEN_SHAKE.BOSS_HIT);
  emit(ctx, s.x, s.y, WEAPONS[s.k].color, s.charged ? 12 : 7);
}

/* --- projectile update --- */

function updateShots(ctx: SimContext, dt: number): void {
  const { world: w } = ctx;
  const p = w.player;
  const pbox = hurtbox(p, PLAYER.HURTBOX_INSET_X, PLAYER.HURTBOX_INSET_Y);

  for (const s of w.shots) {
    s.age += dt;
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.t -= dt;

    if (s.home) {
      const target =
        w.enemies.filter((e) => !e.dead && Math.abs(e.x - s.x) < 260)
          .sort((a, b) => Math.abs(a.x - s.x) - Math.abs(b.x - s.x))[0] ?? w.boss;
      if (target) {
        const ty = target.y + target.h / 2;
        s.vy += clamp(ty - s.y, -35, 35) * dt * 2;
      }
    }

    for (const e of w.enemies) {
      if (e.dead || Math.abs(e.x - s.x) >= 40 || !hit(s, e)) continue;
      e.hp -= s.dmg;
      e.flash = 0.1;
      if (!s.pierce) s.t = 0;
      else s.pierce--;
      emit(ctx, s.x, s.y, WEAPONS[s.k].color, s.charged ? 12 : 4);
      if (e.hp <= 0) {
        e.dead = true;
        p.score += ENEMY.SCORE;
        ctx.audio.hurt();
        emit(ctx, e.x + 7, e.y + 7, w.mission.accent, 11);
      }
    }

    if (w.boss && !w.boss.dead && hit(s, w.boss)) bossDamage(ctx, s, w.boss);
  }

  w.shots = w.shots.filter((s) => s.t > 0 && s.x > w.cam - 30 && s.x < w.cam + VIEW.W + 80);

  for (const s of w.enemyShots) {
    s.age += dt;

    if (s.boss) {
      s.trail = s.trail ?? [];
      s.trail.unshift({ x: s.x, y: s.y });
      if (s.trail.length > 5) s.trail.pop();
    }
    if (s.home) {
      const a = Math.atan2(p.y + 10 - s.y, p.x + 7 - s.x);
      s.vx += Math.cos(a) * 35 * dt;
      s.vy += Math.sin(a) * 35 * dt;
      const m = Math.hypot(s.vx, s.vy) || 1;
      s.vx = (s.vx / m) * 76;
      s.vy = (s.vy / m) * 76;
    }
    if (s.jitter) s.vy += Math.sin(s.age * 32) * 22 * dt;
    if (s.ay) s.vy += s.ay * dt;
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.t -= dt;

    /* Evergreen Wave is a moving shield: it eats hostile fire. */
    if (w.shots.some((q) => q.shield && hit(q, s))) {
      s.t = 0;
      continue;
    }

    if (!hit(s, pbox)) continue;
    s.t = 0;

    if (p.heatShield > 0 && (s.kind === "fire" || s.kind === "lava" || s.kind === "flame")) {
      emit(ctx, p.x + 7, p.y + 10, "#7ce3a8", 6);
      ctx.toast("COOLANT SHIELD ABSORBED HEAT", 0.55);
      continue;
    }
    if (w.mission.id === "ariel" && (s.kind === "pair" || s.kind === "token")) {
      applyPairingLock(ctx, s.boss ? 0.95 : 0.8);
    }
    if (s.slow) {
      p.slow = PLAYER.SLOW_DURATION;
      ctx.toast("CRYO LOCK · MOBILITY REDUCED", 0.65);
    }
    hurt(ctx, 1);
  }

  w.enemyShots = w.enemyShots.filter((s) => s.t > 0 && s.y < 195);
}

/* --- enemies --- */

function updateEnemies(ctx: SimContext, dt: number): void {
  const { world: w } = ctx;
  const p = w.player;
  const pbox = hurtbox(p, PLAYER.HURTBOX_INSET_X, PLAYER.HURTBOX_INSET_Y);

  for (const e of w.enemies) {
    if (e.dead || Math.abs(e.x - p.x) > ENEMY.SIM_RANGE) continue;
    const d = ENEMY_DEF[e.type];
    e.flash = Math.max(0, e.flash - dt);
    e.cd -= dt;

    if (d.fly) {
      e.y = e.baseY + Math.sin(ctx.clock * 2.4 + e.seed) * ENEMY.FLY_BOB;
      e.x += e.vx * dt;
    } else {
      e.x += e.vx * dt;
      if (Math.abs(e.x - e.origin) > e.range) e.vx *= -1;
    }

    if (Math.abs(e.x - p.x) < ENEMY.FIRE_RANGE && e.cd <= 0) {
      e.cd = d.rate + ENEMY.COOLDOWN_PAD + rr(0, ENEMY.COOLDOWN_JITTER);
      spawnEnemyAttack(ctx, e);
    }
    if (hit(e, pbox)) hurt(ctx, ENEMY.CONTACT_DAMAGE);
  }
}

/* --- boss AI --- */

function setBossState(b: Boss, state: string, time: number): void {
  b.state = state;
  b.stateT = time;
  b.stateAge = 0;
  b.fired = false;
}

function chooseBossAction(ctx: SimContext): void {
  const { world: w } = ctx;
  const b = w.boss!;
  const prof = BOSS_PROFILES[w.mission.id];
  const left = w.width - (w.mission.id === "final" ? BOSS.ARENA_LEFT_OFFSET_FINAL : BOSS.ARENA_LEFT_OFFSET);
  const right = w.width - BOSS.ARENA_RIGHT_OFFSET - b.w;
  b.action = ((b.action ?? -1) + 1) % prof.seq.length;
  const action = prof.seq[b.action];

  if (action === "run") {
    const near = Math.abs(w.player.x - b.x) < 76;
    const dir = near ? -Math.sign(w.player.x - b.x) : Math.sign(w.player.x - b.x);
    b.moveDir = dir || (b.action % 2 ? -1 : 1);
    b.targetX = clamp(b.x + b.moveDir * (70 + (b.action % 3) * 28), left + 5, right - 5);
    setBossState(b, "run", Math.max(0.42, prof.run - b.phase * 0.08));
  } else if (action === "jump") {
    const toward = Math.sign(w.player.x - b.x) || -1;
    const retreat = Math.abs(w.player.x - b.x) < 82 ? -toward : toward;
    b.moveDir = retreat;
    b.face = toward;
    b.vx = retreat * prof.speed * 0.78;
    b.vy = -prof.jump * (1 + b.phase * 0.035);
    b.grounded = false;
    setBossState(b, "jump", 2);
  } else {
    setBossState(b, "windup", Math.max(0.28, 0.48 - b.phase * 0.055));
  }
}

function moveBossAI(ctx: SimContext, dt: number): void {
  const { world: w } = ctx;
  const b = w.boss!;
  const id = w.mission.id;
  const prof = BOSS_PROFILES[id];
  const left = w.width - (id === "final" ? BOSS.ARENA_LEFT_OFFSET_FINAL : BOSS.ARENA_LEFT_OFFSET);
  const right = w.width - BOSS.ARENA_RIGHT_OFFSET - b.w;
  const floor = WORLD.FLOOR - b.h;

  if (!b.state) {
    b.y = floor;
    b.vx = 0;
    b.vy = 0;
    b.grounded = true;
    b.face = w.player.x < b.x ? -1 : 1;
    b.action = -1;
    b.hitFx = 0;
    b.stagger = 0;
    setBossState(b, "intro", 0.58);
  }

  b.stateAge = (b.stateAge ?? 0) + dt;
  b.stateT = (b.stateT ?? 0) - dt;
  const stagger = (b.stagger ?? 0) > 0 ? 0.35 : 1;

  if (b.state === "intro") {
    b.vx = approach(b.vx, 0, prof.accel * dt);
    if (b.stateT <= 0) setBossState(b, "think", 0.18);
  } else if (b.state === "think") {
    b.vx = approach(b.vx, 0, prof.accel * dt);
    b.face = w.player.x < b.x ? -1 : 1;
    if (b.stateT <= 0) chooseBossAction(ctx);
  } else if (b.state === "run") {
    const dir = Math.sign(b.targetX - b.x);
    b.face = dir || b.face;
    b.vx = approach(b.vx, dir * prof.speed * stagger, prof.accel * dt);
    if (b.stateT <= 0 || Math.abs(b.targetX - b.x) < 7) setBossState(b, "think", 0.12);
  } else if (b.state === "windup") {
    b.vx = approach(b.vx, 0, prof.accel * 1.5 * dt);
    b.face = w.player.x < b.x ? -1 : 1;
    if (b.stateT <= 0) setBossState(b, "attack", 0.3);
  } else if (b.state === "attack") {
    b.vx = approach(b.vx, -(b.face ?? 1) * prof.speed * 0.18, prof.accel * dt);
    if (!b.fired && (b.stateAge ?? 0) > 0.055) {
      b.fired = true;
      spawnBossAttack(ctx);
      shakeBy(ctx, id === "oberon" || id === "final" ? 4 : 2);
    }
    if (b.stateT <= 0) setBossState(b, "think", Math.max(0.22, 0.42 - b.phase * 0.06));
  } else if (b.state === "jump") {
    b.face = w.player.x < b.x ? -1 : 1;
    b.vx = approach(b.vx, (b.moveDir ?? 1) * prof.speed * 0.72 * stagger, prof.accel * 0.38 * dt);
    if (!b.fired && (b.stateAge ?? 0) > 0.3 && (id === "ariel" || id === "titania" || id === "final")) {
      b.fired = true;
      spawnBossAttack(ctx);
    }
  } else if (b.state === "land") {
    b.vx = approach(b.vx, 0, prof.accel * 1.8 * dt);
    if (b.stateT <= 0) setBossState(b, "think", 0.13);
  }

  if (!b.grounded || b.state === "jump") {
    b.vy += BOSS.GRAVITY * dt;
    b.y += b.vy * dt;
  }
  b.x += b.vx * dt;

  if (b.x <= left || b.x >= right) {
    b.x = clamp(b.x, left, right);
    b.vx *= -0.35;
    b.moveDir = (b.moveDir ?? 1) * -1;
  }

  if (b.y >= floor) {
    if (!b.grounded) {
      b.y = floor;
      b.vy = 0;
      b.grounded = true;
      emit(ctx, b.x + b.w / 2, WORLD.FLOOR - 3, w.mission.accent, 14);
      shakeBy(ctx, id === "oberon" || id === "final" ? SCREEN_SHAKE.BOSS_LAND_HEAVY : SCREEN_SHAKE.BOSS_LAND);
      setBossState(b, "land", id === "umbriel" || id === "oberon" ? 0.3 : 0.2);
    } else {
      b.y = floor;
      b.vy = 0;
    }
  }
}

function updateBoss(ctx: SimContext, dt: number): void {
  const { world: w } = ctx;
  const b = w.boss;
  if (!b || b.dead) return;

  b.t += dt;
  b.flash = Math.max(0, b.flash - dt);
  b.hitFx = Math.max(0, (b.hitFx ?? 0) - dt);
  b.stagger = Math.max(0, (b.stagger ?? 0) - dt);
  b.weakFlash = Math.max(0, b.weakFlash - dt);
  b.phase = b.hp < b.max * BOSS.PHASE_3_AT ? 2 : b.hp < b.max * BOSS.PHASE_2_AT ? 1 : 0;

  /* Ariel's Dongle Baron escalates in two documented steps. */
  if (w.mission.id === "ariel") {
    if (b.phase >= 1 && !w.ariel.phase2) {
      w.ariel.phase2 = true;
      const add = makeEnemy(w.width - 335, "puck", 91, w.solids);
      add.origin = add.x;
      add.range = 38;
      w.enemies.push(add);
      ctx.toast("PAIRING PROTOCOL ESCALATED · AUTHORIZATION STORM", 2.2);
    }
    if (b.phase >= 2 && !w.ariel.phase3) {
      w.ariel.phase3 = true;
      b.volley += 2;
      b.arielTokenCd = 0.2;
      ctx.toast("DONGLE BARON · ‘IF I CAN’T AUTHORIZE THE SIGNAL — NO ONE WILL.’", 2.5);
    }
    if (b.phase === 2) {
      b.arielTokenCd = (b.arielTokenCd ?? 0.8) - dt;
      if (b.arielTokenCd <= 0) {
        const token = hostileShot(w, b.x + b.w / 2, b.y + b.h * 0.45, w.player.x + 7, WORLD.FLOOR - 7, 70, "token", 0, { ay: 95 });
        token.boss = true;
        token.trail = [];
        b.arielTokenCd = 1.15;
      }
    }
  }

  moveBossAI(ctx, dt);

  const pbox = hurtbox(w.player, PLAYER.HURTBOX_INSET_X, PLAYER.HURTBOX_INSET_Y);
  if (hit(b, pbox)) hurt(ctx, BOSS.CONTACT_DAMAGE);
  if (b.hp <= 0) ctx.onBossDefeated();
}

/* --- the frame --- */

export function updateWorld(ctx: SimContext, dt: number): void {
  const { world: w, input, progress } = ctx;
  const p = w.player;

  w.missionT += dt;
  refreshActiveSolids(w);

  p.inv = Math.max(0, p.inv - dt);
  p.fireCd = Math.max(0, p.fireCd - dt);
  p.fireAnim = Math.max(0, p.fireAnim - dt);
  p.dashCd = Math.max(0, p.dashCd - dt);
  p.slow = Math.max(0, p.slow - dt);
  if (p.on && progress.abilities.doubleJump) p.airJumps = 1;

  const L = input.down("ArrowLeft", "KeyA");
  const R = input.down("ArrowRight", "KeyD");

  if (input.was("KeyQ", "BracketRight")) cycleWeapon(ctx, 1);
  if (input.was("KeyR", "BracketLeft")) cycleWeapon(ctx, -1);

  if (input.was("KeyZ", "KeyK", "ArrowUp")) p.jbuf = PLAYER.JUMP_BUFFER;
  else p.jbuf = Math.max(0, p.jbuf - dt);
  p.coyote = p.on ? PLAYER.COYOTE : Math.max(0, p.coyote - dt);

  if (input.was("KeyC", "KeyL") && p.dashCd <= 0) {
    p.dash = PLAYER.DASH_TIME;
    p.dashCd = PLAYER.DASH_COOLDOWN;
    p.vx = p.face * PLAYER.DASH_VX;
    ctx.audio.dash();
    emit(ctx, p.x + 7, p.y + 16, "#61c8dc", 8);
  }
  p.dash = Math.max(0, p.dash - dt);

  if (p.dash <= 0) {
    const d = (R ? 1 : 0) - (L ? 1 : 0);
    const maxSpeed = p.slow > 0 ? PLAYER.MAX_SPEED_SLOWED : PLAYER.MAX_SPEED;
    p.vx += d * PLAYER.ACCEL * dt;
    if (!d) {
      p.vx = decay(p.vx, w.mission.id === "umbriel" ? PLAYER.FRICTION_ICE : PLAYER.FRICTION, dt);
    }
    p.vx = clamp(p.vx, -maxSpeed, maxSpeed);
    if (d) p.face = d;
  }

  if (Math.abs(p.vx) > 16 && p.on) p.runT += dt * (0.82 + Math.abs(p.vx) / 455);

  if (p.jbuf > 0 && (p.coyote > 0 || p.wall)) {
    p.vy = PLAYER.JUMP_VY;
    if (p.wall) {
      p.vx = -p.wall * PLAYER.WALL_JUMP_VX;
      p.face = -p.wall;
    }
    p.jbuf = 0;
    p.coyote = 0;
    ctx.audio.jump();
  } else if (p.jbuf > 0 && progress.abilities.doubleJump && p.airJumps > 0) {
    p.airJumps--;
    p.vy = PLAYER.DOUBLE_JUMP_VY;
    p.jbuf = 0;
    w.jumpFx = 0.22;
    ctx.audio.jump(true);
    emit(ctx, p.x + 7, p.y + 23, "#61c8dc", 16);
  }

  updateTrigger(ctx, dt);

  if (input.was("KeyE", "ArrowDown", "KeyS") && w.mission.id !== "final") activateRelay(ctx);

  /* Variable jump height: releasing jump while rising adds gravity. */
  if (!input.down("KeyZ", "KeyK", "ArrowUp") && p.vy < 0) p.vy += PLAYER.JUMP_CUT_GRAVITY * dt;
  const cap = p.wall && !p.on && p.vy > 0 ? PLAYER.WALL_SLIDE_VY : PLAYER.TERMINAL_VY;
  p.vy = Math.min(cap, p.vy + PLAYER.GRAVITY * dt);

  move(p, p.vx * dt, p.vy * dt, w.activeSolids);
  if (p.on && progress.abilities.doubleJump) p.airJumps = 1;
  p.x = clamp(p.x, 0, w.width - p.w);

  updateMissionMechanic(ctx, dt);

  if (p.y > WORLD.KILL_Y) {
    hurt(ctx, PLAYER.FALL_DAMAGE);
    if (p.hp > 0) {
      p.x = p.checkX;
      p.y = PLAYER.RESPAWN_Y;
      p.vx = 0;
      p.vy = 0;
    }
  }

  updateShots(ctx, dt);
  updateEnemies(ctx, dt);
  updateBoss(ctx, dt);

  for (const q of w.parts) {
    q.x += q.vx * dt;
    q.y += q.vy * dt;
    q.vy += 100 * dt;
    q.t -= dt;
  }
  w.parts = w.parts.filter((q) => q.t > 0);

  if (bossReady(w)) {
    w.boss = makeBoss(w);
    ctx.audio.bossAppear();
    ctx.toast(`${w.mission.boss} · “${w.mission.quip}”`, 2.5);
  }

  const bossView = w.boss && !w.boss.dead && p.x > w.width - 500;
  const target = clamp(
    bossView ? Math.max(p.x - CAMERA.BOSS_LEAD, w.width - 430) : p.x - CAMERA.LEAD,
    0,
    w.width - VIEW.W,
  );
  w.cam += clamp(target - w.cam, -CAMERA.MAX_SPEED * dt, CAMERA.MAX_SPEED * dt);
  w.shake = Math.max(0, w.shake - dt * SCREEN_SHAKE.DECAY);
}

/* --- victory --- */

export function beginBossVictory(ctx: SimContext): void {
  const { world: w } = ctx;
  const b = w.boss;
  if (!b || b.exploding) return;
  b.dead = true;
  b.exploding = true;
  b.burst = 0;
  w.victoryT = 0;
  w.victoryShown = false;
  w.player.score += w.mission.id === "final" ? BOSS.SCORE_FINAL : BOSS.SCORE;
  w.enemyShots = [];
  w.shots = [];
  shakeBy(ctx, SCREEN_SHAKE.BOSS_DEATH);
  emit(ctx, b.x + b.w / 2, b.y + b.h / 2, w.mission.accent, 70);
}

/** Runs during the death explosion, before the victory card. Returns true once
 *  the card should be shown. */
export function updateVictory(ctx: SimContext, dt: number): boolean {
  const { world: w } = ctx;
  const b = w.boss;
  if (!b) return false;
  w.victoryT += dt;
  b.t += dt;

  if (w.victoryT > (b.burst ?? 0) && w.victoryT < BOSS.DEATH_TIME) {
    b.burst = (b.burst ?? 0) + 0.12;
    emit(
      ctx,
      b.x + rr(3, b.w - 3),
      b.y + rr(3, b.h - 3),
      Math.random() < 0.5 ? w.mission.accent : "#f7f3ff",
      18,
    );
    shakeBy(ctx, Math.max(2, 10 - w.victoryT * 5));
  }

  for (const q of w.parts) {
    q.x += q.vx * dt;
    q.y += q.vy * dt;
    q.vy += 100 * dt;
    q.t -= dt;
  }
  w.parts = w.parts.filter((q) => q.t > 0);

  if (w.victoryT > BOSS.DEATH_TIME && !w.victoryShown) {
    w.victoryShown = true;
    return true;
  }
  return false;
}

/** Restore to the last secured checkpoint after a death. */
export function resumeFromCheckpoint(ctx: SimContext): void {
  const { world: w } = ctx;
  const p = w.player;
  w.boss = null;
  w.shots = [];
  w.enemyShots = [];
  w.parts = [];
  p.x = p.checkX;
  p.y = 88;
  p.vx = 0;
  p.vy = 0;
  p.hp = p.max;
  p.inv = PLAYER.INV_SPAWN;
  p.charge = 0;
  p.fireHeld = false;
  clearPairingLock(w, 0.7);
  w.cam = clamp(p.x - 72, 0, w.width - VIEW.W);
}

export { FINAL_SHIELDS };
export type { Box };
