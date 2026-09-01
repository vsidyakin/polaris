/* Mars: Signal Siege — the non-boss roster.
 *
 * Fifteen types: twelve inherited from the four group sheets and three
 * authored. The sheets do not share a row convention, so a type's identity
 * comes from its ROLE — what the artwork actually depicts — rather than from
 * its position in the grid. Getting that wrong shipped a flying pod walking
 * along the ground, a human soldier drawn at 42 px beside Rook's 74, and a
 * centipede stretched to trooper height; see ENEMY_ROLES in
 * scripts/build-mars-art.py.
 *
 * Behaviour is Contra's, not a health-bar exchange:
 *
 *   - Almost everything on two legs dies to one shot. The player mows through
 *     infantry; only emplacements soak damage.
 *   - An enemy does nothing until it notices the player, and then visibly
 *     turns toward him. The beat where it reacts is the whole tell.
 *   - Riflemen advance, plant, telegraph, and fire level — they do not walk
 *     into contact. Runners never fire at all; their body is the attack.
 *     Jumpers hop gaps and hop the player.
 *   - Everything faces the way it is going. This was inverted before —
 *     `setFlipX(facing > 0)` against artwork drawn facing right — so every
 *     ground enemy in the game moonwalked, which is what read as "the enemy
 *     just reverses direction".
 *
 * Every type that moves, animates while moving; v0.7 drew a single "move"
 * frame and translated the sprite, which is what made ground enemies look like
 * they were being dragged. Every type that attacks telegraphs first: `windup`
 * is a real state with its own pose, not a frame swapped on the tick the bolt
 * appears.
 */

import type Phaser from "phaser";
import { ENEMY } from "../tuning";
import { SHEET } from "../assets";
import { ANIM, flipFor, frameOf, originFor } from "../anims";
import type { EnemyKind, EnemySpawn, Platform } from "../levels";
import { enemyHeight, enemyWidth, isAirborne } from "../levels";

export type EnemyState =
  | "idle" | "move" | "windup" | "fire" | "frozen" | "descend" | "leap";

/**
 * What an actor does once it has noticed the player.
 *
 * Kept separate from `kind` because one sheet row fields more than one kind of
 * soldier: Contra's infantry is a handful of silhouettes doing several
 * different jobs, and a stage reads as populated rather than repetitive
 * because the same trooper sprite might charge you, kneel and shoot, or vault
 * at you.
 */
export type Behaviour =
  | "rifleman"      // advances, plants, telegraphs, fires level
  | "runner"        // charges; never fires; the body is the attack
  | "jumper"        // advances and hops gaps and the player alike
  | "emplacement"   // does not move; aimed shots; soaks damage
  | "hover"         // holds station near the player's height and fires
  | "swarm";        // small, fast, airborne, contact only

let nextId = 1;

export class Enemy {
  readonly id = nextId++;
  sprite: Phaser.GameObjects.Sprite;
  /** The canopy, for paratroops only. Released and hidden on landing. */
  canopy?: Phaser.GameObjects.Sprite;
  kind: EnemyKind;
  behaviour: Behaviour;
  x: number;
  y: number;
  w: number;
  h: number;
  hp: number;
  maxHp: number;
  facing: 1 | -1 = -1;
  vy = 0;
  onGround: boolean;
  dead = false;
  flash = 0;
  frozen = 0;
  /** Cooldown until the next attack may begin. */
  cooldown: number;
  /** Time left in the current windup/fire state. */
  stateT = 0;
  /**
   * The angle this enemy committed to when it began its wind-up.
   *
   * The telegraph used to tell the player only THAT a shot was coming, never
   * where: the scene computed the angle from the player's live position at the
   * moment of release, so reading the tell and moving did nothing — the bolt
   * simply followed. Boss.ts had already worked this out and its header calls
   * the locked aim "the contract the whole fight rests on"; the roster now
   * honours the same contract.
   */
  aimLocked: number | null = null;
  state: EnemyState = "idle";
  variant: number;
  dropWeapon?: number;
  /**
   * False until the player comes within NOTICE_RANGE, and true forever after.
   * An enemy that forgets goes back to idling mid-fight, which reads as the AI
   * losing interest rather than as the player having broken away.
   */
  alerted = false;
  /** Distance walked, for the two-pose walk cycle. */
  private distance = 0;
  /** Hover bob and descent sway phase. */
  private phase: number;
  private baseY: number;
  private group: string;
  private hopTimer: number;
  /** Where a paratroop is headed; its spawn seat, not where it starts. */
  private landingY: number;
  private landingX: number;

  constructor(
    sprite: Phaser.GameObjects.Sprite,
    spawn: EnemySpawn,
    group: number,
    seedPhase: number,
    canopy?: Phaser.GameObjects.Sprite,
  ) {
    this.sprite = sprite;
    this.canopy = canopy;
    this.kind = spawn.kind;
    this.x = spawn.x;
    this.y = spawn.y;
    this.baseY = spawn.y;
    this.landingX = spawn.x;
    this.landingY = spawn.y;
    this.w = enemyWidth(spawn.kind);
    this.h = enemyHeight(spawn.kind);
    this.hp = spawn.hp;
    this.maxHp = spawn.hp;
    this.variant = spawn.variant;
    this.dropWeapon = spawn.dropWeapon;
    this.cooldown = 0.65 + (seedPhase % 1) * 0.8;
    this.phase = seedPhase * 6.28;
    this.hopTimer = ENEMY.HOP_INTERVAL * (0.4 + (seedPhase % 1));
    this.group = "bcde"[group] ?? "b";
    this.behaviour = behaviourFor(spawn.kind, spawn.variant);
    this.onGround = !this.flying;

    if (spawn.drop) {
      /* The spawn seat is where it lands; it starts above the view and is a
         target the whole way down. */
      this.state = "descend";
      this.y = spawn.y - ENEMY.DROP_HEIGHT;
      this.baseY = this.y;
      this.alerted = true;
      this.onGround = false;
    }

    /* Baseline origin, same reason as Rook — the gutter is below the feet. */
    const o = originFor(this.authored ? "new-enemies.png" : "enemies.png");
    sprite.setOrigin(o.x, o.y);
    /* The canopy hangs from the trooper's head, so it anchors by its own
       bottom edge rather than sharing the trooper's baseline. */
    canopy?.setOrigin(0.5, 1);
  }

  get authored(): boolean {
    return this.kind === "wasp" || this.kind === "crawler" || this.kind === "sentinel";
  }

  get flying(): boolean {
    return isAirborne(this.kind);
  }

  /** Whether the shot this enemy releases is led at the player.
   *
   *  Contra's infantry fires level down its own lane and the emplacements are
   *  what track you; keeping riflemen unaimed is what makes ducking, jumping
   *  and standing on a ledge all mean something. */
  get aimsAtPlayer(): boolean {
    return this.behaviour !== "rifleman";
  }

  get box(): { x: number; y: number; w: number; h: number } {
    return { x: this.x, y: this.y, w: this.w, h: this.h };
  }

  /** Which enemy-shot family this type uses, so sectors sound distinct. */
  get shotFamily(): number {
    return (this.variant + this.h) % 12;
  }

  /**
   * One step of behaviour.
   *
   * `fire` is invoked exactly once, on the frame the windup completes — never
   * on a timer that could double-fire when the frame rate dips.
   */
  update(
    dt: number,
    player: { x: number; y: number },
    platforms: Platform[],
    fire: (e: Enemy) => void,
  ): void {
    /* Airborne types integrate no gravity and had no collision of any kind, so
       drones and fliers swam through floors and walls — and one was observed
       firing from a muzzle point inside a platform. Their step is now rejected
       if it would end inside solid terrain, which is the cheapest thing that
       keeps them in the air where they belong. */
    const wasX = this.x;
    const wasY = this.y;
    const wasBase = this.baseY;
    if (this.dead) return;

    this.flash = Math.max(0, this.flash - dt);
    this.frozen = Math.max(0, this.frozen - dt);
    this.phase += dt;

    if (this.frozen > 0) {
      this.state = "frozen";
      this.applyPose();
      return;
    }

    if (this.state === "descend") {
      this.descend(dt);
      this.applyPose();
      return;
    }

    const dist = Math.hypot(player.x - this.x, player.y - this.y);
    if (!this.alerted && dist < ENEMY.NOTICE_RANGE) {
      this.alerted = true;
      /* The frame it notices, it turns. Everything else this tick is downstream
         of that, which is why the turn happens before the switch runs. */
      this.faceToward(player.x);
    }

    /* Attack states run to completion before anything else may start. */
    if (this.state === "windup" || this.state === "fire") {
      this.stateT -= dt;
      if (this.stateT <= 0) {
        if (this.state === "windup") {
          fire(this);
          this.state = "fire";
          this.stateT = 0.16;
        } else {
          this.state = "idle";
        }
      }
      this.applyPose();
      return;
    }

    if (!this.flying) this.integrate(dt, platforms);

    this.cooldown -= dt;
    this.hopTimer -= dt;
    let moved = false;

    if (this.alerted) {
      switch (this.behaviour) {
        case "rifleman": moved = this.actRifleman(dt, dist, player, platforms); break;
        case "runner": moved = this.actRunner(dt, dist, player, platforms); break;
        case "jumper": moved = this.actJumper(dt, dist, player, platforms); break;
        case "emplacement": this.actEmplacement(dist, player); break;
        case "hover": moved = this.actHover(dt, dist, player); break;
        case "swarm": moved = this.actSwarm(dt, dist, player); break;
      }
    }

    /* Only the locomotion states are decided here.
       This used to be an unconditional `state = moved ? "move" : "idle"`, which
       ran AFTER the behaviour above and therefore overwrote the "windup" that
       beginAttack() had just set on the very same tick. The telegraph was
       cancelled the instant it started, the windup branch never ran on the next
       frame, and the cooldown had already been pushed forward — so no enemy in
       the game ever completed an attack or fired a single shot. */
    if (this.state === "idle" || this.state === "move" || this.state === "leap") {
      this.state = !this.onGround && !this.flying ? "leap" : moved ? "move" : "idle";
    }
    if (this.flying && solidAt(platforms, this.box)) {
      this.x = wasX;
      this.y = wasY;
      this.baseY = wasBase;
    }
    this.applyPose();
  }

  // -------------------------------------------------------------- behaviours

  /** Advance, plant, telegraph, fire level. Never closes to contact. */
  private actRifleman(
    dt: number, dist: number, player: { x: number; y: number }, platforms: Platform[],
  ): boolean {
    if (dist > ENEMY.TROOPER_RANGE) return false;
    let moved = false;
    const gap = Math.abs(player.x - (this.x + this.w / 2));
    if (gap > ENEMY.TROOPER_HOLD) {
      this.facing = player.x < this.x + this.w / 2 ? -1 : 1;
      moved = this.walk(dt, ENEMY.TROOPER_SPEED, platforms);
    } else {
      /* Planted. It still turns, so walking past one does not leave it
         shooting at the wall behind it. */
      this.faceToward(player.x);
    }
    /* Riflemen fire level, so one standing a rung above or below the player
       can never connect — it shoots harmlessly over his head forever, which
       reads as a broken enemy rather than a missed shot. It keeps advancing
       instead, and fires when it has closed to the player's own deck. */
    if (this.cooldown <= 0 && gap < ENEMY.TROOPER_FIRE_RANGE
        && Math.abs(player.y - this.y) <= 40) {
      this.beginAttack(1.15 + (this.phase % 1) * 0.5, player);
    }
    return moved;
  }

  /** Closes hard and never fires. One hit kills it; the threat is the body. */
  private actRunner(
    dt: number, dist: number, player: { x: number }, platforms: Platform[],
  ): boolean {
    if (dist > ENEMY.HOUND_RANGE) return false;
    this.facing = player.x < this.x + this.w / 2 ? -1 : 1;
    const speed = this.kind === "crawler" ? ENEMY.CRAWLER_SPEED
      : this.kind === "hound" ? ENEMY.HOUND_SPEED : ENEMY.RUNNER_SPEED;
    return this.walk(dt, speed, platforms);
  }

  /** Advances like a rifleman but hops gaps and the player rather than
   *  turning at them, and fires less often because the leap is the threat. */
  private actJumper(
    dt: number, dist: number, player: { x: number; y: number }, platforms: Platform[],
  ): boolean {
    if (dist > ENEMY.TROOPER_RANGE) return false;
    this.facing = player.x < this.x + this.w / 2 ? -1 : 1;
    const above = player.y + 40 < this.y;
    if (this.onGround && this.hopTimer <= 0 && (above || Math.abs(player.x - this.x) < 130)) {
      this.hop();
    }
    const moved = this.walk(dt, ENEMY.TROOPER_SPEED * 1.15, platforms);
    if (this.cooldown <= 0 && this.onGround && dist < ENEMY.TROOPER_FIRE_RANGE) {
      this.beginAttack(1.6 + (this.phase % 1) * 0.5, player);
    }
    return moved;
  }

  /** Bolted down. Aims, soaks, and is the reason a stage has cover. */
  private actEmplacement(dist: number, player: { x: number; y: number }): void {
    this.faceToward(player.x);
    const range = this.kind === "sentinel" ? ENEMY.SENTINEL_RANGE : ENEMY.TURRET_RANGE;
    if (dist < range && this.cooldown <= 0) {
      this.beginAttack(1.5 + (this.phase % 1) * 0.45, player);
    }
  }

  /** Holds station near the player's head height, bobbing, and fires down. */
  private actHover(dt: number, dist: number, player: { x: number; y: number }): boolean {
    const range = this.kind === "wasp" ? ENEMY.WASP_RANGE : ENEMY.FLIER_RANGE;
    if (dist > range) {
      this.y = this.baseY + Math.sin(this.phase * 3.4) * 5;
      return false;
    }
    const speed = this.kind === "wasp" ? ENEMY.WASP_SPEED : ENEMY.FLIER_SPEED;
    const dx = player.x - (this.x + this.w / 2);
    /* Stands off rather than sitting on top of him: a flier parked on the
       player's own column cannot be shot without being walked under. */
    const want = Math.abs(dx) > 90 ? Math.sign(dx) : 0;
    this.x += want * speed * dt;
    this.baseY += Math.sign(player.y - 62 - this.baseY) * speed * 0.55 * dt;
    this.y = this.baseY + Math.sin(this.phase * 3.4) * 5;
    if (want !== 0) this.facing = want < 0 ? -1 : 1;
    else this.faceToward(player.x);
    if (this.cooldown <= 0) this.beginAttack(1.5, player);
    return want !== 0;
  }

  /** Small, fast, and suicidal. Dives the player and never shoots. */
  private actSwarm(dt: number, dist: number, player: { x: number; y: number }): boolean {
    if (dist > ENEMY.FLIER_RANGE) {
      this.y = this.baseY + Math.sin(this.phase * 5.1) * 4;
      return false;
    }
    const ang = Math.atan2(player.y + 20 - this.y, player.x - (this.x + this.w / 2));
    this.x += Math.cos(ang) * ENEMY.DRONE_SPEED * dt;
    this.baseY += Math.sin(ang) * ENEMY.DRONE_SPEED * dt;
    this.y = this.baseY + Math.sin(this.phase * 5.1) * 4;
    this.facing = Math.cos(ang) < 0 ? -1 : 1;
    return true;
  }

  // ----------------------------------------------------------------- motion

  /** Paratroop descent. Vulnerable throughout; an ordinary trooper on landing. */
  private descend(dt: number): void {
    this.baseY += ENEMY.DROP_SPEED * dt;
    this.x = this.landingX + Math.sin(this.phase * ENEMY.DROP_SWAY_RATE) * ENEMY.DROP_SWAY;
    this.y = this.baseY;
    if (this.y >= this.landingY) {
      this.y = this.landingY;
      this.baseY = this.landingY;
      this.x = this.landingX;
      this.state = "idle";
      this.onGround = true;
      this.releaseCanopy();
    }
  }

  /** The canopy is cut on landing and never comes back. */
  private releaseCanopy(): void {
    if (!this.canopy) return;
    this.canopy.setVisible(false);
    this.canopy.destroy();
    this.canopy = undefined;
  }

  private hop(): void {
    this.vy = ENEMY.HOP_VY;
    this.onGround = false;
    this.hopTimer = ENEMY.HOP_INTERVAL;
  }

  /** Gravity and landing, for the ground types that can leave it. */
  private integrate(dt: number, platforms: Platform[]): void {
    if (this.onGround) return;
    this.vy += ENEMY.GRAVITY * dt;
    const prevFoot = this.y + this.h;
    this.y += this.vy * dt;
    const foot = this.y + this.h;
    if (this.vy <= 0) return;
    const deck = surfaceBetween(platforms, this.x + this.w / 2, prevFoot, foot);
    if (deck !== null) {
      this.y = deck - this.h;
      this.vy = 0;
      this.onGround = true;
    }
  }

  /**
   * Walk, and deal with the edge of the world.
   *
   * A runner that turns around at every ledge reads as a patrol, not as
   * something coming for you, so anything that can hop clears the gap instead.
   * Only the types with no hop in them turn back.
   */
  private walk(dt: number, speed: number, platforms: Platform[]): boolean {
    if (!this.onGround) {
      /* Airborne: keep the horizontal component so a leap carries across. */
      this.x += this.facing * speed * dt;
      this.distance += Math.abs(speed * dt);
      return true;
    }
    const step = this.facing * speed * dt;
    const probe = this.facing > 0 ? this.x + step + this.w - 4 : this.x + step + 4;
    if (!hasSupport(platforms, probe, this.y + this.h, ENEMY.SUPPORT_TOLERANCE)) {
      if (this.behaviour === "jumper" || this.kind === "hound") {
        this.hop();
        this.x += step;
        return true;
      }
      /* Turn at the ledge rather than walking into space, which is the
         "humanoid ground enemy walking across gaps" the brief forbids. */
      this.facing = -this.facing as 1 | -1;
      return false;
    }
    this.x += step;
    this.distance += Math.abs(step);
    return true;
  }

  private beginAttack(cooldown: number, player?: { x: number; y: number }): void {
    this.state = "windup";
    this.stateT = ENEMY.WINDUP;
    this.cooldown = cooldown + ENEMY.WINDUP;
    this.aimLocked = player && this.aimsAtPlayer
      ? Math.atan2(player.y + 25 - (this.y + this.h * 0.42),
                   player.x - (this.x + this.w / 2))
      : null;
  }

  /** Only turn once the player is clearly past centre, so an enemy the player
   *  is standing on top of does not vibrate. */
  private faceToward(px: number): void {
    const delta = px - (this.x + this.w / 2);
    if (Math.abs(delta) > 22) this.facing = delta < 0 ? -1 : 1;
  }

  private applyPose(): void {
    if (this.authored) {
      const key = ANIM.authored(this.kind);
      const attacking = this.state === "windup" || this.state === "fire";
      if (this.kind === "sentinel") {
        /* The sentinel's four frames ARE its telegraph — the shield arc growing
           outward. Looping it constantly spends the telegraph on nothing and
           leaves the wind-up indistinguishable from idling, so the cycle only
           advances while the attack is actually charging and otherwise holds
           the uncharged frame. */
        if (attacking) {
          if (!this.sprite.anims.isPlaying) this.sprite.play(key, true);
        } else {
          if (this.sprite.anims.isPlaying) this.sprite.anims.stop();
          this.sprite.setTexture(SHEET.authored.key, frameOf("new-enemies.png", "sentinel_charge"));
        }
      } else if (this.sprite.anims.currentAnim?.key !== key && this.sprite.scene.anims.exists(key)) {
        /* The wasp's rotors and the crawler's legs are locomotion, not a
           telegraph, so those loop continuously. */
        this.sprite.play(key, true);
      }
    } else {
      const pose =
        this.state === "windup" || this.state === "fire" ? "attack" :
        this.state === "move" || this.state === "leap" ? "walk" : "idle";
      if (pose === "walk") {
        /* Distance-clocked two-pose cycle, same reasoning as Rook's stride.
           The group sheets carry one move pose per role, so this alternates
           idle and move rather than running a real cycle — and at the old 22 px
           step a trooper changed frame about once a second, which reads as a
           slideshow rather than a walk. 14 px is roughly a stride at these
           speeds. It is still two poses; the honest fix is more artwork. */
        if (this.sprite.anims.isPlaying) this.sprite.anims.stop();
        const phase = Math.floor(this.distance / 14) % 2;
        this.sprite.setTexture(
          SHEET.enemies.key,
          frameOf("enemies.png", `${this.group}_${this.kind}_walk`, phase),
        );
      } else {
        if (this.sprite.anims.isPlaying) this.sprite.anims.stop();
        this.sprite.setTexture(
          SHEET.enemies.key,
          frameOf("enemies.png", `${this.group}_${this.kind}_${pose}`),
        );
      }
    }

    /* Which way the sheet is drawn is the sheet's business, not this file's.
       The group sheets are painted facing left and the Aseprite-authored types
       facing right, so any comparison written here is wrong for one of them —
       and writing it here has now been wrong in both directions in turn. */
    this.sprite.setFlipX(
      flipFor(this.authored ? "new-enemies.png" : "enemies.png", this.facing));
    /* A one-pixel bob on the contact frame.
       With only two poses to alternate, the weight shift that sells a walk is
       missing entirely, and the sprite reads as being slid along rather than
       stepping. Dropping the body a pixel on one half of the cycle costs
       nothing and is most of what the eye is looking for. Ground movers only —
       a hovering type already has its own bob, and doubling them fights. */
    const bob = this.state === "move" && !this.flying
      ? Math.floor(this.distance / 14) % 2
      : 0;
    this.sprite.setPosition(Math.round(this.x + this.w / 2),
                            Math.round(this.y + this.h) + bob);
    if (this.canopy) {
      this.canopy.setPosition(Math.round(this.x + this.w / 2), Math.round(this.y + 6));
    }
    /* Hit flash and freeze are tints rather than filters: Phaser tints on the
       GPU, where v0.7's canvas `filter: hue-rotate` cost a full-canvas
       repaint per enemy per frame. */
    if (this.frozen > 0) this.sprite.setTint(0x8fd8ff);
    else if (this.flash > 0) this.sprite.setTint(0xffffff);
    else this.sprite.clearTint();
  }

  hurt(amount: number): void {
    this.hp -= amount;
    this.flash = ENEMY.FLASH_TIME;
    /* Shooting the canopy out from under a paratroop should not leave it
       hanging there once it dies. */
    if (this.hp <= 0) this.releaseCanopy();
  }

  /** Called by the scene when the enemy is removed, so the canopy cannot
   *  outlive its owner. */
  dispose(): void {
    this.releaseCanopy();
  }
}

/**
 * Which job a spawn does, from its role and its variant.
 *
 * Splitting the humanoid roles three ways is what keeps a sector from feeling
 * like one enemy repeated: the same trooper silhouette turns up as a rifleman
 * that plants and shoots, a runner that just comes at you, and a jumper that
 * will not respect the gap you were using as cover.
 */
function behaviourFor(kind: EnemyKind, variant: number): Behaviour {
  switch (kind) {
    case "trooper":
      return (["rifleman", "runner", "jumper"] as const)[variant % 3];
    case "hound":
    case "crawler":
      return "runner";
    case "turret":
    case "sentinel":
      return "emplacement";
    case "flier":
    case "wasp":
      return "hover";
    case "drone":
      return "swarm";
  }
}

/** Whether a box is inside any solid (non-one-way) surface. */
export function solidAt(
  platforms: Platform[], b: { x: number; y: number; w: number; h: number },
): boolean {
  for (const p of platforms) {
    if (p.thin) continue;
    if (b.x + b.w <= p.x || b.x >= p.x + p.w) continue;
    if (b.y + b.h <= p.y || b.y >= p.y + p.h) continue;
    return true;
  }
  return false;
}

export function hasSupport(platforms: Platform[], x: number, footY: number, tolerance: number): boolean {
  for (const p of platforms) {
    if (x >= p.x + 2 && x <= p.x + p.w - 2 && Math.abs(p.y - footY) <= tolerance) return true;
  }
  return false;
}

/**
 * The deck a falling foot crosses between two positions, or null.
 *
 * Swept rather than sampled: a hop lands at roughly 320 px/s, which at 30 fps
 * is 10 px of travel in a frame, and testing only the end position lets a
 * jumper drop through the girder it was aiming for.
 */
export function surfaceBetween(
  platforms: Platform[], x: number, fromFoot: number, toFoot: number,
): number | null {
  let best: number | null = null;
  for (const p of platforms) {
    if (x < p.x + 2 || x > p.x + p.w - 2) continue;
    if (p.y < fromFoot - 1 || p.y > toFoot) continue;
    if (best === null || p.y < best) best = p.y;
  }
  return best;
}
