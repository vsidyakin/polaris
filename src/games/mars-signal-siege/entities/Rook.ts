/* Mars: Signal Siege — Signal Marshal Rook.
 *
 * Holds the player's simulation state, chooses which pose is on screen, and
 * answers "where is the muzzle right now" for the weapon system.
 *
 * Two things here are deliberate departures from v0.7.
 *
 * 1. The run cycle advances on distance travelled, not elapsed time. Time-based
 *    cycling looks correct at exactly one speed and slides at every other, so
 *    Rook skated on ice, on conveyors, and during the wind missions. One full
 *    eight-frame stride now happens per RUN_STRIDE_PX of ground covered, which
 *    is what keeps a planted foot planted.
 *
 * 2. Firing while running keeps the lower body in the same phase. v0.7 swapped
 *    to a separate run-fire sheet whose cycle ran on its own counter, so the
 *    legs jumped when the player pulled the trigger mid-stride. Both sheets are
 *    eight frames in the same order, so the phase index carries across and only
 *    the upper body changes.
 */

import type Phaser from "phaser";
import { PLAYER } from "../tuning";
import { SHEET } from "../assets";
import { ANIM, frameOf, originFor, socketFor, type Socket, flipFor } from "../anims";

export type RookPose =
  | "idle" | "idlefire" | "run" | "runfire" | "jump" | "fall"
  | "prone" | "pronefire"
  | "aimup" | "aimup_air" | "aimdiagup_air" | "aimdiagdown_air" | "aimdiagup_run"
  | "clear";

export interface RookInputs {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  firing: boolean;
}

export class Rook {
  sprite: Phaser.GameObjects.Sprite;

  x = 0;
  y = 0;
  vx = 0;
  vy = 0;
  facing = 1;
  onGround = false;
  prone = false;
  health: number = PLAYER.HP;
  maxHealth: number = PLAYER.HP;
  lives: number = PLAYER.LIVES;
  invuln = 0;
  cooldown = 0;
  weapon = 0;

  /** Ground distance covered, the run cycle's clock. */
  private distance = 0;
  private pose: RookPose = "idle";
  /** The pose actually put on the sprite last frame. Phaser's `currentAnim`
   *  cannot serve this purpose — it is never cleared by stop() or
   *  setTexture(), only by destroy(). */
  private applied: RookPose | null = null;
  /** Set while the mission-clear pose is held, so input cannot override it. */
  locked = false;

  constructor(sprite: Phaser.GameObjects.Sprite) {
    this.sprite = sprite;
    /* Origin at the pivot column and the ground BASELINE — not the bottom of
       the frame. The atlas leaves a transparent gutter below the feet, so
       anchoring to the frame edge would float Rook above the floor and put
       every muzzle socket the same distance low. */
    const o = originFor("rook.png");
    sprite.setOrigin(o.x, o.y);
  }

  get width(): number {
    return PLAYER.W;
  }

  get height(): number {
    return this.prone ? PLAYER.H_PRONE : PLAYER.H;
  }

  /** Collision box, top-left origin. */
  get box(): { x: number; y: number; w: number; h: number } {
    return { x: this.x, y: this.y, w: this.width, h: this.height };
  }

  setProne(on: boolean): void {
    if (on === this.prone) return;
    const feet = this.y + this.height;
    this.prone = on;
    this.y = feet - this.height;
    if (on) this.vx = 0;
  }

  /** Called once per frame after movement, with the ground distance covered. */
  advance(dt: number, inputs: RookInputs): void {
    this.distance += Math.abs(this.vx) * dt;
    this.cooldown -= dt;
    this.invuln = Math.max(0, this.invuln - dt);
    if (!this.locked) this.pose = this.choosePose(inputs);
    this.applyPose();
  }

  private choosePose(i: RookInputs): RookPose {
    const moving = Math.abs(this.vx) > 1;

    if (this.prone) return i.firing ? "pronefire" : "prone";

    /* Aiming beats locomotion: a player holding up while running is asking to
       shoot up, and showing the run pose would be a lie about where the shot
       comes from.
       Grounded and airborne are split here rather than further down. Handling
       `up` in one branch and then testing it again after the airborne check
       made the second test unreachable, so the airborne diagonal was dead art
       and a moving, airborne player was shown `aimdiagup_run` — a grounded
       cycling pose, played in mid-air, driven by a distance clock that does not
       advance while airborne, so it also froze mid-stride. */
    if (i.up) {
      if (!this.onGround) return moving ? "aimdiagup_air" : "aimup_air";
      return moving ? "aimdiagup_run" : "aimup";
    }
    if (i.down && !this.onGround) return "aimdiagdown_air";

    if (!this.onGround) return this.vy < 0 ? "jump" : "fall";
    if (moving) return i.firing ? "runfire" : "run";
    /* Standing and firing had no pose of its own, so it fell through to `idle`
       and the planted firing stance was art nothing could reach. */
    return i.firing ? "idlefire" : "idle";
  }

  /**
   * Put the chosen pose on the sprite.
   *
   * Cycling poses are frame-set directly from `distance` rather than played,
   * because Phaser's animation clock is time-based and that is precisely what
   * we are replacing. Non-cycling poses are single frames.
   */
  private applyPose(): void {
    const cycling = this.pose === "run" || this.pose === "runfire";
    if (cycling) {
      if (this.sprite.anims.isPlaying) this.sprite.anims.stop();
      const step = PLAYER.RUN_STRIDE_PX / PLAYER.RUN_FRAMES;
      const phase = Math.floor(this.distance / step) % PLAYER.RUN_FRAMES;
      this.sprite.setTexture(SHEET.rook.key, frameOf("rook.png", this.pose, phase));
    } else if (this.pose === "aimdiagup_run") {
      if (this.sprite.anims.isPlaying) this.sprite.anims.stop();
      const step = PLAYER.RUN_STRIDE_PX / 2;
      const phase = Math.floor(this.distance / step) % 2;
      this.sprite.setTexture(SHEET.rook.key, frameOf("rook.png", this.pose, phase));
    } else {
      /* Guarded on the pose this object last applied, NOT on the sprite's
         `currentAnim`. Phaser never clears `currentAnim` — neither `stop()` nor
         `setTexture()` touches it, only `destroy()` does — so after
         idle -> run -> idle the key still reads `mss-rook-idle`, a
         currentAnim-based guard evaluates false, and neither `play()` nor
         `setTexture()` runs: Rook stays frozen on the last run frame every time
         he stops moving. */
      if (this.applied !== this.pose) {
        const key = ANIM.rook(this.pose);
        if (this.sprite.scene.anims.exists(key)) this.sprite.play(key, true);
        else this.sprite.setTexture(SHEET.rook.key, frameOf("rook.png", this.pose));
      }
    }
    this.applied = this.pose;

    this.sprite.setFlipX(flipFor("rook.png", this.facing));
    this.sprite.setPosition(Math.round(this.x + this.width / 2),
                            Math.round(this.y + this.height));
    /* Blink during invulnerability, but never leave the sprite invisible when
       it expires — a stale alpha is how a player ends up "gone" after a hit. */
    this.sprite.setAlpha(this.invuln > 0 && Math.floor(this.invuln * 20) % 2 === 0 ? 0.35 : 1);
  }

  /** Freeze on the mission-clear pose until the scene releases it. */
  holdClearPose(): void {
    this.locked = true;
    this.pose = "clear";
    this.vx = 0;
    this.applyPose();
  }

  release(): void {
    this.locked = false;
  }

  get currentPose(): RookPose {
    return this.pose;
  }

  /** The atlas frame index currently on screen. */
  get currentFrame(): number {
    const f = this.sprite.frame.name;
    return typeof f === "number" ? f : Number(f) || 0;
  }

  /**
   * World-space muzzle position for the frame being drawn this instant.
   *
   * Read at the moment of firing, from the live frame, so it is correct for
   * whichever of the twenty-eight poses is on screen — including mid-stride,
   * prone and every aim direction.
   */
  muzzleWorld(): { x: number; y: number; socket: Socket } {
    const socket = socketFor(this.currentFrame, this.facing);
    return {
      x: this.x + this.width / 2 + socket.x,
      y: this.y + this.height + socket.y,
      socket,
    };
  }
}
