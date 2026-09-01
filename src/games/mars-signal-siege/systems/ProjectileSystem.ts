/* Mars: Signal Siege — projectiles, muzzle flashes and impacts.
 *
 * Everything here is pooled. A firefight in the final boss's enrage phase puts
 * eight enemy bolts and seven player bolts in the air within a frame of each
 * other, and allocating a Sprite per shot is what turns that into a GC pause
 * exactly when the player can least afford one.
 *
 * The shots themselves are Phaser Sprites drawn from the projectile atlas, not
 * primitives: each weapon family has its own silhouette, its own travel
 * orientation, a trail, and a three-frame impact that matches the bolt that
 * caused it. v0.7 drew several of them as untextured rectangles when the
 * remote sheet had not arrived, which is the "low-resolution placeholder
 * triangle" the brief rules out.
 *
 * Movement is sub-stepped. A 560 px/s bolt covers 18 px in one 33 ms frame,
 * which is wider than a mite; without sub-stepping it can start one side of an
 * enemy and finish the other without ever overlapping it.
 */

import Phaser from "phaser";
import { SHEET } from "../assets";
import { FX, TIMING } from "../tuning";
import { WEAPONS } from "../data";
import { ANIM, frameOf } from "../anims";

export interface Shot {
  sprite: Phaser.GameObjects.Sprite;
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Launch point, for the wave weapon's parametric path. */
  baseX: number;
  baseY: number;
  dirX: number;
  dirY: number;
  speed: number;
  life: number;
  age: number;
  weapon: number;
  damage: number;
  size: number;
  pierce: number;
  gravity: number;
  splash: number;
  homing: boolean;
  returning: boolean;
  wave: boolean;
  freeze: number;
  /** Enemy shots only: which family, for art and sound. */
  family: number;
  /** Enemies already damaged by this shot, so a piercing bolt cannot hit the
   *  same target twice per pass. */
  hitIds: Set<number>;
}

function blankShot(sprite: Phaser.GameObjects.Sprite): Shot {
  return {
    sprite, active: false,
    x: 0, y: 0, vx: 0, vy: 0, baseX: 0, baseY: 0, dirX: 1, dirY: 0,
    speed: 0, life: 0, age: 0, weapon: 0, damage: 0, size: 12,
    pierce: 0, gravity: 0, splash: 0,
    homing: false, returning: false, wave: false, freeze: 0,
    family: 0, hitIds: new Set(),
  };
}

export class ProjectileSystem {
  readonly playerShots: Shot[] = [];
  readonly enemyShots: Shot[] = [];
  private effects: Phaser.GameObjects.Sprite[] = [];
  private scene: Phaser.Scene;
  private layer: Phaser.GameObjects.Container;

  constructor(scene: Phaser.Scene, layer: Phaser.GameObjects.Container) {
    this.scene = scene;
    this.layer = layer;

    for (let i = 0; i < FX.PLAYER_SHOT_POOL; i++) {
      this.playerShots.push(blankShot(this.makeSprite()));
    }
    for (let i = 0; i < FX.ENEMY_SHOT_POOL; i++) {
      this.enemyShots.push(blankShot(this.makeSprite()));
    }
    for (let i = 0; i < FX.MUZZLE_POOL + FX.IMPACT_POOL; i++) {
      const s = this.makeSprite();
      this.effects.push(s);
    }
  }

  private makeSprite(): Phaser.GameObjects.Sprite {
    const s = this.scene.add.sprite(0, 0, SHEET.shots.key, 0);
    s.setVisible(false).setActive(false);
    this.layer.add(s);
    return s;
  }

  private free(pool: Shot[]): Shot | null {
    for (const s of pool) if (!s.active) return s;
    return null;
  }

  /**
   * Launch a player bolt from an explicit world point.
   *
   * `x`/`y` come from the muzzle socket for the exact frame being drawn — see
   * WeaponSystem. Nothing in this class knows where Rook is, which is what
   * stops a future change from quietly reverting to a body-centre spawn.
   */
  firePlayer(weapon: number, x: number, y: number, angle: number): Shot | null {
    const w = WEAPONS[weapon];
    const shot = this.free(this.playerShots);
    if (!shot) return null;

    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    shot.active = true;
    shot.x = shot.baseX = x;
    shot.y = shot.baseY = y;
    shot.dirX = dx;
    shot.dirY = dy;
    shot.vx = dx * w.speed;
    shot.vy = dy * w.speed;
    shot.speed = w.speed;
    shot.life = 2;
    shot.age = 0;
    shot.weapon = weapon;
    shot.damage = w.damage;
    shot.size = w.size;
    shot.pierce = w.pierce ?? 0;
    shot.gravity = w.gravity ?? 0;
    shot.splash = w.splash ?? 0;
    shot.homing = !!w.homing;
    shot.returning = !!w.returning;
    shot.wave = !!w.wave;
    shot.freeze = w.freeze ?? 0;
    /* `family` belongs to enemy fire, but it is reset here anyway: a recycled
       shot must never inherit *any* field from its previous flight, and a
       partial reset is the kind of bug that only shows up once someone reads
       the field on the other code path. */
    shot.family = 0;
    shot.hitIds.clear();

    const frame = frameOf("projectiles.png", `pshot${weapon}`);
    shot.sprite.setTexture(SHEET.shots.key, frame);
    shot.sprite.setActive(true).setVisible(true);
    shot.sprite.setPosition(x, y);
    shot.sprite.setRotation(angle);
    /* The atlas cell is 48px; each weapon has its own drawn size, so scale to
       the tuned size rather than shipping eight differently-scaled sheets. */
    shot.sprite.setScale(w.size / 24);
    shot.sprite.setAlpha(1);
    return shot;
  }

  fireEnemy(x: number, y: number, angle: number, speed: number, family: number,
            size: number, gravity: number): Shot | null {
    const shot = this.free(this.enemyShots);
    if (!shot) return null;
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    shot.active = true;
    shot.x = shot.baseX = x;
    shot.y = shot.baseY = y;
    shot.dirX = dx;
    shot.dirY = dy;
    shot.vx = dx * speed;
    shot.vy = dy * speed;
    shot.speed = speed;
    shot.life = 4;
    shot.age = 0;
    shot.family = family;
    shot.damage = 1;
    shot.size = size;
    shot.gravity = gravity;
    shot.pierce = 0;
    shot.splash = 0;
    shot.homing = false;
    shot.returning = false;
    shot.wave = false;
    shot.freeze = 0;
    shot.hitIds.clear();

    const frame = frameOf("projectiles.png", `eshot${((family % 12) + 12) % 12}`);
    shot.sprite.setTexture(SHEET.shots.key, frame);
    shot.sprite.setActive(true).setVisible(true);
    shot.sprite.setPosition(x, y);
    shot.sprite.setRotation(angle);
    shot.sprite.setScale(size / 22);
    shot.sprite.setAlpha(1);
    return shot;
  }

  /** A one-shot effect sprite: muzzle flash or impact. */
  private spawnEffect(x: number, y: number, frame: number, anim: string | null,
                      rotation: number, scale: number, life: number): void {
    const s = this.effects.find((e) => !e.active);
    if (!s) return;
    s.setActive(true).setVisible(true);
    s.setPosition(x, y);
    s.setRotation(rotation);
    s.setScale(scale);
    s.setAlpha(1);
    if (anim && this.scene.anims.exists(anim)) {
      /* Clear first: an effect that was recycled before its animation finished
         still carries the previous `once`, which would then fire on this
         playthrough and blank the sprite early. */
      s.off(Phaser.Animations.Events.ANIMATION_COMPLETE);
      s.play(anim);
      s.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
        s.setActive(false).setVisible(false);
      });
    } else {
      s.setTexture(SHEET.shots.key, frame);
      this.scene.time.delayedCall(life * 1000, () => {
        s.setActive(false).setVisible(false);
      });
    }
  }

  /** Drawn at the socket, oriented along the shot — so the flash is visibly
   *  attached to the barrel rather than floating near the character. */
  muzzleFlash(weapon: number, x: number, y: number, angle: number): void {
    this.spawnEffect(x, y, frameOf("projectiles.png", `muzzle${weapon}`), null,
                     angle, 1, FX.MUZZLE_TIME);
  }

  impact(weapon: number, x: number, y: number): void {
    this.spawnEffect(x, y, frameOf("projectiles.png", `impact${weapon}`),
                     ANIM.impact(weapon), 0, 1, FX.IMPACT_TIME);
  }

  release(shot: Shot): void {
    shot.active = false;
    shot.life = 0;
    shot.sprite.setActive(false).setVisible(false);
  }

  /**
   * Advance one shot, calling `probe` at each sub-step so collision is tested
   * along the path rather than only at the endpoint.
   *
   * Returns false once the shot is spent.
   */
  step(shot: Shot, dt: number, probe: (s: Shot) => boolean): boolean {
    const steps = TIMING.SHOT_SUBSTEPS;
    const h = dt / steps;
    for (let i = 0; i < steps; i++) {
      shot.age += h;
      shot.life -= h;
      shot.vy += shot.gravity * h;
      if (shot.wave) {
        /* Parametric rather than integrated: a sine applied to velocity drifts
           off the launch axis over distance, which made the v0.7 wave weapon
           curve away from whatever it was aimed at. */
        const d = shot.age * shot.speed;
        const osc = Math.sin(shot.age * 13) * 24;
        shot.x = shot.baseX + shot.dirX * d - shot.dirY * osc;
        shot.y = shot.baseY + shot.dirY * d + shot.dirX * osc;
      } else {
        shot.x += shot.vx * h;
        shot.y += shot.vy * h;
      }
      if (probe(shot)) return false;
      if (shot.life <= 0) return false;
    }
    shot.sprite.setPosition(shot.x, shot.y);
    if (!shot.wave) shot.sprite.setRotation(Math.atan2(shot.vy, shot.vx));
    return true;
  }

  reset(): void {
    for (const s of this.playerShots) this.release(s);
    for (const s of this.enemyShots) this.release(s);
    for (const e of this.effects) e.setActive(false).setVisible(false);
  }

  destroy(): void {
    for (const s of this.playerShots) s.sprite.destroy();
    for (const s of this.enemyShots) s.sprite.destroy();
    for (const e of this.effects) e.destroy();
    this.playerShots.length = 0;
    this.enemyShots.length = 0;
    this.effects.length = 0;
  }
}
