/* Mars: Signal Siege — firing rules.
 *
 * The one job worth stating plainly: a shot leaves the barrel that is drawn on
 * screen. `Rook.muzzleWorld()` resolves the socket for the live frame, and this
 * module never computes a spawn point of its own — there is no fallback to the
 * body centre, because that fallback is exactly the bug the brief calls out.
 *
 * Aim is eight-way in the sense the original had: forward, up, diagonal up, and
 * diagonal down while airborne. The aim vector and the pose Rook is drawing are
 * derived from the same inputs, so they cannot disagree.
 */

import { WEAPONS } from "../data";
import type { Rook, RookInputs } from "../entities/Rook";
import type { ProjectileSystem, Shot } from "./ProjectileSystem";
import type { MarsAudio } from "../audio";
import type { SfxName } from "../assets";

export interface AimVector {
  x: number;
  y: number;
}

/**
 * Which way the shot goes.
 *
 * Down only aims downward in the air: pressing down on the ground goes prone,
 * and firing a diagonal-down bolt into the floor you are standing on is not a
 * move anyone intends.
 */
export function aimVector(rook: Rook, i: RookInputs): AimVector {
  const moving = Math.abs(rook.vx) > 1;
  let x = rook.facing;
  let y = 0;
  if (i.up) {
    y = -1;
    x = moving ? rook.facing : 0;
  } else if (i.down && !rook.onGround) {
    y = 1;
    x = moving ? rook.facing : 0;
  }
  const n = Math.hypot(x, y) || 1;
  return { x: x / n, y: y / n };
}

export class WeaponSystem {
  private projectiles: ProjectileSystem;
  private audio: MarsAudio;

  constructor(projectiles: ProjectileSystem, audio: MarsAudio) {
    this.projectiles = projectiles;
    this.audio = audio;
  }

  /** How many of this weapon's bolts are alive. */
  private aliveOf(weapon: number): number {
    let n = 0;
    for (const s of this.projectiles.playerShots) {
      if (s.active && s.weapon === weapon) n++;
    }
    return n;
  }

  canFire(rook: Rook): boolean {
    const w = WEAPONS[rook.weapon];
    return rook.cooldown <= 0 && this.aliveOf(rook.weapon) < w.active;
  }

  /**
   * Fire, if the weapon's cooldown and active-shot budget allow it.
   * Returns the shots created, for the QA harness to inspect.
   */
  fire(rook: Rook, inputs: RookInputs): Shot[] {
    if (!this.canFire(rook)) return [];
    const w = WEAPONS[rook.weapon];
    rook.cooldown = w.cool;

    const aim = aimVector(rook, inputs);
    const base = Math.atan2(aim.y, aim.x);
    /* The spread weapon is the only one that fans; its three bands are the
       "low / mid / high" its role text promises. */
    const angles = w.spread ? [-0.28, 0, 0.28] : [0];

    const muzzle = rook.muzzleWorld();
    const out: Shot[] = [];
    for (const offset of angles) {
      const shot = this.projectiles.firePlayer(
        rook.weapon, muzzle.x, muzzle.y, base + offset,
      );
      if (shot) out.push(shot);
    }
    if (out.length) {
      this.projectiles.muzzleFlash(rook.weapon, muzzle.x, muzzle.y, base);
      this.audio.play(`fire${rook.weapon}` as SfxName, "fire");
    }
    return out;
  }
}
