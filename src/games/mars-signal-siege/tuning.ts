/* Mars: Signal Siege — every gameplay number, in one place.
 *
 * Ported from Mars_Signal_Siege_v0.7.html, which scattered these through its
 * update loop. The logical view stays 640x360 exactly as the standalone had
 * it, so every platform height, jump arc and arena bound below is the number
 * the game was actually tuned at rather than a conversion.
 *
 * `CHANGED:` marks a value that differs from v0.7, always with the reason.
 */

/** Logical render space. Phaser zooms this to the shell; the game never
 *  reasons about display pixels. */
export const VIEW = {
  W: 640,
  H: 360,
  ZOOM: 2,
} as const;

export const PLAYER = {
  W: 34,
  H: 58,
  H_PRONE: 26,
  HP: 10,
  LIVES: 3,
  /** The secret sequence grants this many. Never advertised on the title. */
  LIVES_SECRET: 30,

  SPEED: 175,
  /** Ice missions accelerate toward the target instead of snapping to it. */
  SPEED_ICE: 185,
  ICE_ACCEL: 4.2,
  ICE_DECEL: 1.35,

  JUMP_VY: -360,
  GRAVITY: 900,
  GRAVITY_LOW: 760,
  /** Wind missions push the player mid-air. */
  WIND_FORCE: 24,

  /** Invulnerability after a hit, and after respawning at a checkpoint. */
  INVULN_HIT: 1.1,
  INVULN_RESPAWN: 2,
  /** Knockback applied on hit. */
  HURT_VY: -230,
  HURT_VX: 90,

  /* --- animation ---
     CHANGED: v0.7 advanced the run cycle on `anim += |vx|*dt/14` and then
     sampled six of the eight atlas frames, which made the cycle stutter and
     drift out of step with the ground. The cycle is driven by distance
     travelled instead: one full eight-frame stride per RUN_STRIDE_PX of
     ground covered, so feet stay planted on ice, on conveyors and at every
     speed. */
  RUN_STRIDE_PX: 132,
  RUN_FRAMES: 8,
} as const;

export const CAMERA = {
  /** Player's resting position from the left edge on horizontal stages. */
  LEAD_X: 220,
  /** Player's resting height on vertical stages. */
  LEAD_Y: 214,
  /** Exponential follow rate; higher snaps harder. */
  LERP: 6,
} as const;

export const WORLD = {
  /** Horizontal stage length, before the per-mission jitter. */
  BASE_W: 5200,
  FINAL_W: 4040,
  /** Distance from the right edge at which the boss gate sits. */
  GATE_INSET: 760,
  /** Vertical stage (mission 3, the toxic uplink ascent). */
  VERTICAL_H: 2460,
  VERTICAL_BOSS_Y: 275,
  GROUND_Y: 310,
  /** Fall past the world by this much and you lose a life. */
  KILL_MARGIN: 40,
  /** Checkpoint is taken after this much forward progress. */
  CHECKPOINT_STEP: 360,
  CHECKPOINT_STEP_V: 330,
} as const;

/**
 * Reachability limits used by both the generator and the level audit.
 * A stage that violates these is a bug, not a difficulty choice.
 *
 * These are derived from the jump arc, not chosen by eye. With JUMP_VY -360 and
 * GRAVITY 900 the apex is v^2/2g = 72 px and the time to return to a height h
 * is t = (v + sqrt(v^2 - 2gh))/g, so the horizontal reach at SPEED 175 is:
 *
 *     rise    0 -> 0.800 s -> 140 px
 *     rise   30 -> 0.706 s -> 124 px
 *     rise   52 -> 0.611 s -> 107 px
 *     rise   68 -> 0.494 s ->  87 px
 *
 * Each band is sized to its WORST case — the top of its rise range — with a
 * margin for the 3 px landing overlap and for a 33 ms frame step. The previous
 * values (156/132/116/100) were more generous than the arc at both ends: a flat
 * 156 px gap and a 68-rise/100-gap pair are both physically impossible, so a
 * future height table could have passed the audit and shipped a stage the
 * player cannot finish.
 */
export const REACH = {
  MAX_RISE: 68,
  /** The vertical mission is also the low-gravity one, which lifts the apex to
   *  85 px; this is only legal because those two facts travel together. The
   *  Mars test asserts that they do. */
  MAX_RISE_VERTICAL: 82,
  /** Falling further than this between surfaces is a one-way drop. */
  MAX_DROP: 245,
  /** Horizontal gap the player can clear, by how much they must also climb. */
  GAP_HIGH: 78,    // rise 52..68  (arc allows 87)
  GAP_MID: 96,     // rise 30..52  (arc allows 107)
  GAP_LOW: 112,    // rise  0..30  (arc allows 124)
  GAP_FLAT: 128,   // level or downhill (arc allows 140)
} as const;

export const ENEMY = {
  /* Contra's infantry is fast and disposable, and that is the rhythm these are
     tuned to. v0.7's 28 px/s trooper drifted toward the player slowly enough
     that it read as a moving obstacle rather than as a soldier reacting to
     being shot at. */
  TROOPER_SPEED: 46,
  /** The charger: closes hard, never shoots, dies to one hit. */
  RUNNER_SPEED: 98,
  HOUND_SPEED: 86,
  DRONE_SPEED: 94,
  FLIER_SPEED: 64,
  WASP_SPEED: 62,
  CRAWLER_SPEED: 44,

  /** How near the player must come before an idle enemy reacts at all. An
   *  enemy that is already pacing the moment it spawns has nothing left to do
   *  when the player actually arrives, so this is what buys the beat where it
   *  turns and notices him. */
  NOTICE_RANGE: 330,
  TROOPER_RANGE: 560,
  /** A rifleman plants itself here rather than walking into contact — the
   *  threat is the shot, not the body. */
  TROOPER_HOLD: 165,
  TROOPER_FIRE_RANGE: 340,
  HOUND_RANGE: 480,
  /* Both of these used to out-range the camera. The view is 640 wide and the
     camera leads by 220, so only 420 px of world is visible ahead of Rook and
     220 px behind him — a turret at 600 px opened fire from off screen, with no
     visible source and no telegraph the player could possibly read. A weapon
     the player cannot see is not difficulty. */
  TURRET_RANGE: 400,
  FLIER_RANGE: 480,
  WASP_RANGE: 470,
  SENTINEL_RANGE: 380,

  /** Ledge probe tolerance — a walker will not step off a surface. */
  SUPPORT_TOLERANCE: 8,
  FLASH_TIME: 0.12,
  /** Telegraph length before an enemy releases a shot. */
  WINDUP: 0.28,

  /* --- hops ---
     Jumpers and hounds clear a gap rather than turning around at it, which is
     what stops a charge from reading as a patrol that changed its mind. */
  GRAVITY: 900,
  HOP_VY: -318,
  HOP_INTERVAL: 1.25,

  /* --- paratroops ---
     Slow enough that the canopy is legible and the trooper is a target the
     whole way down; the sway keeps the descent from being a straight line. */
  DROP_SPEED: 62,
  DROP_SWAY: 13,
  DROP_SWAY_RATE: 1.7,
  /** How far above the camera top a paratrooper is spawned. */
  DROP_HEIGHT: 230,
} as const;

export const BOSS = {
  GRAVITY: 790,
  /** Arena inset from the gate and from the far wall. */
  ARENA_LEFT_INSET: 55,
  ARENA_RIGHT_INSET: 55,
  /* Hitbox height, and it must equal the height the art is actually built at
     (scripts/build-mars-art.py seats bosses at 126, and the final boss at 150).
     The prototype's 104/132 left roughly 22 px of drawn boss standing above its
     own hitbox, so shots that visibly connected with the head or shoulders
     passed through. There is no separate "draw height": one number, or they
     drift apart again. */
  H: 126,
  H_FINAL: 150,
  HP_BASE: 30,
  HP_PER_MISSION: 3,
  HP_FINAL: 82,
  /** The weak weapon multiplies damage by this. */
  WEAKNESS_MULTIPLIER: 2.5,

  /* --- readable state machine ---
     v0.7 had one timer and fired the instant it expired, so attacks arrived
     with no warning. Each attack now runs WINDUP -> FIRE -> RECOVER, and the
     boss cannot turn during the last two. */
  WINDUP: 0.42,
  FIRE: 0.16,
  RECOVER: 0.34,
  /** Enrage below this fraction of max HP: faster stride, shorter cooldown. */
  ENRAGE_AT: 0.5,
  ENRAGE_COOLDOWN: 0.72,
  ENRAGE_STRIDE: 1.45,

  /* CHANGED: v0.7 re-derived facing from the player's position every frame,
     so a boss standing near the player's x flickered left/right each tick.
     Facing now needs the player to be past a dead zone, and cannot flip again
     until a cooldown expires. */
  TURN_DEADZONE: 26,
  TURN_COOLDOWN: 0.55,
  /** Frozen bosses thaw far faster than regular enemies. */
  FREEZE_CAP: 0.55,
  /** And cannot be re-frozen for this long afterwards. Without it the cryo
   *  weapon's cooldown (0.58s) beats its own freeze (0.55s) and a boss stays
   *  frozen for as long as the player keeps firing. */
  FREEZE_LOCKOUT: 2.5,
} as const;

export const FX = {
  /** Pool sizes. Sized to the worst case seen in the final boss's enrage
   *  spread (8 shots) plus the player's densest weapon (7 active). */
  PLAYER_SHOT_POOL: 24,
  ENEMY_SHOT_POOL: 64,
  PARTICLE_POOL: 220,
  MUZZLE_POOL: 8,
  IMPACT_POOL: 16,
  MUZZLE_TIME: 0.07,
  IMPACT_TIME: 0.16,
  HIT_FLASH: 0.12,
} as const;

export const TIMING = {
  /** Delta clamp. Below this frame rate the sim slows rather than tunnelling
   *  through platforms — the same guard v0.7 used. */
  MAX_DT: 0.033,
  /** Sub-steps for fast projectiles so nothing skips a hitbox at 30 fps. */
  SHOT_SUBSTEPS: 2,
  CLEAR_DELAY: 1.6,
  TOAST: 2,
} as const;

export const AUDIO = {
  MUSIC_VOLUME: 0.2,
  MUSIC_VOLUME_PAUSED: 0.08,
  MUSIC_VOLUME_BOSS: 0.22,
  MUSIC_VOLUME_ONESHOT: 0.23,
  SFX_VOLUME: 0.55,
  /** Cross-fade when one music cue replaces another. */
  FADE_MS: 420,
  /** Minimum gap between repeats of the same effect, in ms. Without this the
   *  full-auto weapon retriggers its own sample every frame and turns to mud. */
  THROTTLE: {
    fire: 42,
    enemyFire: 85,
    enemyHit: 38,
    bossHit: 55,
    shield: 60,
    uiMove: 45,
  } as Record<string, number>,
} as const;

/** The secret life sequence. Deliberately not shown anywhere in the UI. */
export const SECRET_SEQUENCE = [
  "ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown",
  "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight",
  "KeyB", "KeyA",
] as const;
