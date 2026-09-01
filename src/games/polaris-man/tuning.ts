/* Polaris-Man — every gameplay number, in one place.
 *
 * Ported from Mersive_Polaris_Signal_Breaker_v1.7.html. The standalone
 * scattered these across the update loop; centralising them is the whole point
 * of the port, so tuning the game never means reading the physics again.
 *
 * `CHANGED:` marks a value that differs from v1.7. Every one of them is listed
 * in docs/polaris-man/tuning-changes.md with the evidence behind it. Anything
 * unmarked is the original number, to the digit.
 */

/** Logical render space. The standalone drew at 320x180 into a 640x360 canvas
 *  via setTransform(2,...). Phaser does the same with zoom, so the numbers
 *  below stay in the coordinate space the original was tuned in. */
export const VIEW = {
  W: 320,
  H: 180,
  ZOOM: 2,
} as const;

export const WORLD = {
  /** Moon missions: five 1000-unit sectors plus a boss arena. */
  MOON: 5400,
  /** Polaris Nexus is a single arena, no sectors. */
  FINAL: 1280,
  FLOOR: 156,
  /** Fall past this and you take 2 and respawn at the last checkpoint. */
  KILL_Y: 192,
  ZONE_STARTS: [0, 1000, 2000, 3000, 4000],
} as const;

export const PLAYER = {
  W: 14,
  H: 24,
  SPAWN_X: 34,
  SPAWN_X_FINAL: 70,
  SPAWN_Y: 126,
  HP: 16,
  HP_FINAL: 18,

  /* --- horizontal --- */
  ACCEL: 560,
  MAX_SPEED: 82,
  /** Cryo lock (Umbriel shots, Glacier Lock) cuts top speed until it expires. */
  MAX_SPEED_SLOWED: 50,
  SLOW_DURATION: 1.35,
  /** Per-second decay applied as pow(base, dt) when no direction is held.
   *  Umbriel's floor is ice: it barely decays, so you slide. */
  FRICTION: 0.002,
  FRICTION_ICE: 0.11,

  /* --- vertical --- */
  GRAVITY: 430,
  /** Extra gravity while rising with jump released — the variable-height jump. */
  JUMP_CUT_GRAVITY: 520,
  TERMINAL_VY: 260,
  /** Sliding down a wall caps fall speed, which is what makes wall jumps land. */
  WALL_SLIDE_VY: 72,
  JUMP_VY: -182,
  DOUBLE_JUMP_VY: -174,
  WALL_JUMP_VX: 105,
  /** Grace after walking off a ledge. */
  COYOTE: 0.09,
  /** Grace for pressing jump just before landing. */
  JUMP_BUFFER: 0.11,

  /* --- dash --- */
  DASH_TIME: 0.18,
  DASH_COOLDOWN: 0.55,
  DASH_VX: 205,

  /* --- damage --- */
  /** Invulnerability granted on spawn and on checkpoint restore. */
  INV_SPAWN: 2.5,
  /** Invulnerability granted by a hit. */
  INV_HIT: 1.0,
  /** Invulnerability granted by securing a checkpoint. */
  INV_CHECKPOINT: 1.2,
  KNOCKBACK_VY: -110,
  KNOCKBACK_VX: 65,
  FALL_DAMAGE: 2,
  RESPAWN_Y: 80,

  /* --- weapon charge --- */
  /** Hold Polaris Pulse this long for the 3x shot. */
  CHARGE_TIME: 2,
  CHARGE_DAMAGE: 3,

  /* CHANGED: the standalone tested enemy and projectile overlap against the
   * full 14x24 body, so a shot that visually cleared the operator's shoulder
   * still registered. NES-era platformers almost universally run a hurtbox
   * inset from the sprite. 2px per side keeps every original collision that
   * mattered (the body is still 10x20) and removes the pixel-edge hits that
   * read as unfair. Set both to 0 to restore v1.7 behaviour exactly. */
  HURTBOX_INSET_X: 2,
  HURTBOX_INSET_Y: 2,
} as const;

export const CAMERA = {
  /** Camera leads the player by this much in normal play. */
  LEAD: 106,
  /** During a boss fight the camera locks nearer the arena. */
  BOSS_LEAD: 80,
  /** Max camera travel per second — stops the view snapping on teleports. */
  MAX_SPEED: 240,
} as const;

export const ENEMY = {
  W: 16,
  H: 14,
  /** Enemies outside this range of the player are not simulated at all. */
  SIM_RANGE: 360,
  /** Enemies only shoot inside this range. */
  FIRE_RANGE: 175,
  /** Added to each type's `rate` to get the real cooldown, plus rr(0, JITTER). */
  COOLDOWN_PAD: 0.9,
  COOLDOWN_JITTER: 0.48,
  FLY_SPEED: 11,
  FLY_BOB: 10,
  CONTACT_DAMAGE: 1,
  SCORE: 100,
} as const;

export const BOSS = {
  HP: 42,
  HP_FINAL: 100,
  W: 44,
  H: 62,
  W_FINAL: 74,
  H_FINAL: 82,
  Y_FLYING: 88,
  Y_FINAL: 67,
  GRAVITY: 350,
  /** Boss spawns once the player passes this and every relay is secured. */
  TRIGGER_X_OFFSET: 430,
  /** Arena bounds, measured back from the world edge. */
  ARENA_LEFT_OFFSET: 390,
  ARENA_LEFT_OFFSET_FINAL: 350,
  ARENA_RIGHT_OFFSET: 45,
  CONTACT_DAMAGE: 2,
  SCORE: 3000,
  SCORE_FINAL: 10000,
  /** Phase thresholds as a fraction of max HP. */
  PHASE_2_AT: 0.68,
  PHASE_3_AT: 0.34,
  /** A weakness hit always removes at least this fraction of max HP. */
  WEAKNESS_DAMAGE: 0.55,
  /** Breaking one of Protocol Prime's eight shields costs it this much. */
  SHIELD_BREAK_DAMAGE: 0.18,
  /** Damage dealt to Protocol Prime by a weapon whose shield is still up. */
  SHIELDED_DAMAGE: 0.25,
  /** Charged Polaris Pulse against a stripped Protocol Prime. */
  FINAL_CHARGED_DAMAGE: 16,
  /** Multiplier on any hit against a stripped Protocol Prime. */
  FINAL_STRIPPED_MULT: 1.5,
  /** Victory explosion runs this long before the card appears. */
  DEATH_TIME: 1.55,
} as const;

export const RELAY = {
  COUNT: 5,
  /** Reach to secure a terminal with E. */
  RANGE_X: 38,
  RANGE_Y: 52,
  SCORE: 500,
  /** Sector gate that drops once its relay is secured. */
  GATE_OFFSET: 165,

  /* CHANGED: v1.7 restored full health at every one of the five checkpoints,
   * which meant damage taken never carried between sectors and the health bar
   * stopped being information. Exactly one station now repairs — the middle of
   * the five, so the run has a considered halfway point rather than a rolling
   * reset. Every station still secures progress and grants brief invulnerability.
   * Set HEALING_INDEX to -1 for no healing, or to any 0-4 to move it. */
  HEALING_INDEX: 2,
} as const;

export const SCREEN_SHAKE = {
  HIT: 5,
  CHARGED_SHOT: 4,
  BOSS_HIT: 2,
  BOSS_HIT_CHARGED: 4,
  BOSS_LAND: 3,
  BOSS_LAND_HEAVY: 5,
  BOSS_DEATH: 12,
  /** Shake decays at this multiple of dt. */
  DECAY: 16,
} as const;

export const TIMING = {
  /** Hard floor on the frame delta. Below ~30fps the game runs slow rather
   *  than letting physics tunnel through platforms. Matches v1.7. */
  MAX_DT: 0.033,
  BOOT_TIME: 1.55,
  EPILOGUE_SCROLL: 18,
  /** Epilogue must run this long before Enter returns to mission select. */
  EPILOGUE_MIN: 3,
} as const;

export const AUDIO_DEFAULTS = {
  MASTER: 0.82,
  MUSIC: 0.36,
  SFX: 0.62,
  /** Music tempo is scaled by this against the notated bpm. */
  TEMPO_SCALE: 0.88,
} as const;

/** Ammo granted at mission start, by weapon id. */
export const AMMO_MOON: Readonly<Record<string, number>> = {
  pulse: 99,
  browser: 42,
  canvas: 42,
  crossnet: 36,
  evergreen: 32,
  airlink: 40,
  guestkey: 42,
  byomswitch: 38,
  fleetsync: 32,
};

export const AMMO_FINAL: Readonly<Record<string, number>> = {
  pulse: 99,
  browser: 48,
  canvas: 48,
  crossnet: 44,
  evergreen: 40,
  airlink: 46,
  guestkey: 48,
  byomswitch: 44,
  fleetsync: 38,
};

/** Fire cooldown per weapon, seconds. */
export const FIRE_COOLDOWN: Readonly<Record<string, number>> = {
  pulse: 0.16,
  browser: 0.25,
  canvas: 0.28,
  crossnet: 0.34,
  evergreen: 0.42,
  airlink: 0.28,
  guestkey: 0.3,
  byomswitch: 0.34,
  fleetsync: 0.44,
};

/** Charged Polaris Pulse overrides the table above. */
export const CHARGED_FIRE_COOLDOWN = 0.38;

export const STORAGE = {
  PROGRESS: "psb_campaign_v2",
  SOUND: "psb_sound",
} as const;
