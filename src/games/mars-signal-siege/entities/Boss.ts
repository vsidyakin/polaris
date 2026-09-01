/* Mars: Signal Siege — sector bosses and the Lock-In Engine.
 *
 * Twelve fights, one state machine. What differs per boss is its PLAN (below):
 * how it holds ground, which movement special it interleaves, and the volley
 * script it releases. What is shared is the grammar the player learns in the
 * first fight and relies on in the twelfth:
 *
 *     REPOSITION -> WINDUP -> FIRE -> RECOVER -> REPOSITION
 *
 * with two movement branches hanging off REPOSITION:
 *
 *     REPOSITION -> LEAP  -> REPOSITION        (an arc, landing squash and all)
 *     REPOSITION -> BRACE -> DASH -> RECOVER   (a committed ground lunge)
 *
 * v0.8 had only the first line, and every boss ran it with the same walk: the
 * playtest note was "most bosses face away from the user and just try to hop"
 * and "they should all feel the same" — meaning they do, and should not. Three
 * things caused that and are fixed here.
 *
 *   1. Facing was inverted. Rook's convention is setFlipX(facing < 0) because
 *      the art faces right natively; this class flipped on facing > 0, so every
 *      boss presented its back to the player it was shooting at.
 *   2. Ten of the twelve bosses are drawn front-on and symmetrical, so a flip
 *      conveys almost nothing anyway. Facing Rook has to be carried by AIM: the
 *      angle is measured from the same muzzle point PlayScene fires from, it is
 *      LOCKED when the wind-up starts, and the wind-up lean and the recoil kick
 *      are both computed from that angle rather than from the flip. The boss
 *      visibly cocks toward where the shot is going to go.
 *   3. Everyone walked at Rook. Walking at Rook makes contact damage the whole
 *      fight, which is the third playtest note. Bosses now hold a standoff BAND
 *      and pace inside it, retreating when crowded; the threat is the volley,
 *      and touching the boss is what happens when you stand in the wrong place.
 *
 * The wind-up is still the contract: no PLAN shortens BOSS.WINDUP, several
 * lengthen it, and the aim is fixed for its whole duration so that reading the
 * telegraph and moving is always the right answer.
 */

import type Phaser from "phaser";
import { BOSS } from "../tuning";
import { BOSS_PROFILES, FINAL_MISSION } from "../data";
import { ANIM, flipFor, originFor } from "../anims";

/** How long the landing squash lasts, in seconds. */
const LAND_SQUASH_TIME = 0.18;
/** World pixels per full stride bob cycle. */
const STRIDE_PX = 54;

/* Where PlayScene.bossFire actually spawns a bolt: boss centre, 42% down the
   body. The aim has to be measured from that exact point, or the angle the
   wind-up leans along is not the angle the shot leaves on. If bossFire moves
   its muzzle, this moves with it. */
const MUZZLE_Y = 0.42;
/** Rook's chest above his box top. PlayScene aims at the same offset. */
const AIM_CHEST = 25;

/** Half-width of the standoff band. Inside it the boss paces instead of
 *  closing, which is what stops the fight from being decided by body contact. */
const BAND = 32;
/** How far a creeping boss will drift from the ground it took up. */
const CREEP_SPAN = 78;

/** Ground-lunge speeds and durations. A dash is a repositioning tool; a rush
 *  is the Leviathan's whole identity and crosses most of the arena. */
const DASH_SPEED = 420;
const DASH_TIME = 0.34;
const RUSH_SPEED = 545;
const RUSH_TIME = 0.72;
/** Seconds between needles sprayed along a rush. */
const RUSH_SHOT = 0.16;
/** The dash tell. Sized against BOSS.WINDUP: long enough to read and leave. */
const BRACE_TIME = 0.32;

/** Cap on horizontal air speed, so a leap solved for a distant target cannot
 *  turn into a teleport when the player is at the far wall. */
const AIR_SPEED_MAX = 300;
/** How long a volley's recoil kick reads for. Per volley, not per state, so a
 *  four-stage barrage kicks four times. */
const RECOIL_TIME = 0.16;

/** Serpent undulation: rate in cycles per second, lift in pixels. */
const WAVE_RATE = 1.9;
const WAVE_LIFT = 8;

/** A boss ignores any surface narrower than this fraction of its own width.
 *  The arena ledges exist so Rook can climb out of a ground wall; a 126 px
 *  machine perching on one would both look wrong and end the fight by
 *  stranding itself somewhere it cannot follow him down from. */
/* A boss ignores any surface narrower than this multiple of its own width.
   It was 0.75, which for a 126 px boss is 94.5 px — and the arena girders are
   150 and 130 px wide, so every boss happily perched on the player's escape
   ledges. Measured in play: three bosses spent 49–57 % of the fight standing on
   a girder, where a level shot passes clean underneath them, and were hittable
   by level fire only 7–9 % of the time. The arena furniture is the player's,
   not the boss's. */
const LEDGE_MIN_W = 1.25;

export type BossState =
  | "reposition"
  | "brace"
  | "dash"
  | "leap"
  | "windup"
  | "fire"
  | "recover"
  | "defeated";

/** One release. `count`/`spread`/`speed`/`groundWall` are what PlayScene has
 *  always honoured; `aim`, `gravity` and `size` are additions — see `launch`. */
export interface BossAttack {
  /** Shots to fan out. */
  count: number;
  spread: number;
  /** 0 uses the family default. */
  speed: number;
  /** Fire a pair of ground-level shots as well (the Sovereign's tribute walls). */
  groundWall?: boolean;
  /** Absolute world angle for the centre of the fan, in radians. Chosen here so
   *  the shot agrees with the telegraph the player just read. */
  aim?: number;
  /** Downward acceleration on the bolts: an arc that walls off floor space
   *  rather than a flat line that only threatens one height. */
  gravity?: number;
  /** Bolt size; heavy ordnance reads bigger than needles. */
  size?: number;
}

/** A volley inside a pattern, with its offset from the start of FIRE. */
interface Volley extends BossAttack {
  at: number;
  /** Rotate off the locked aim — sweeps, lane fire, over-the-shoulder shots. */
  aimOffset?: number;
  /** Ignore the aim and fire straight down (the Guillotine's drop). */
  down?: boolean;
}

interface BossPattern {
  volleys: readonly Volley[];
  /** Leap as part of the attack, launched at wind-up so the arc IS the tell. */
  leap?: LeapKind;
}

/**
 * How a boss holds ground between attacks.
 *
 * Twelve entries for twelve bosses, and that is the point. The previous
 * vocabulary had four, of which `pace` covered eight of the roster — so the
 * uniqueness check passed on the strength of the standoff NUMBERS differing
 * while three bosses walked to a line and shot from it identically. A number
 * is not a movement idea. Each style below is a different function of time and
 * of where the player is, and each one is the fiction its briefing already
 * promised: the codec drops frames, the tyrant will not cross its own VLAN
 * boundary, the installer only ever progresses, the hydra's heads disagree,
 * the guillotine answers motion rather than position, the tower does not move
 * at all, the monarch makes you come to it, and the gatekeeper closes in a
 * little with every prompt.
 */
type MoveStyle =
  /** Emplacement: never chases, drifts around the spot it set up on. */
  | "creep"
  /** Holds a standoff band, pacing inside it and backing off when crowded.
   *  The base behaviour every other style is a departure from. */
  | "pace"
  /** As `pace`, but on ice: velocity lags intent, so it overshoots the band
   *  in both directions and has to come back. */
  | "skate"
  /** As `pace`, with a body wave that surges and stalls the stride. */
  | "serpent"
  /** Moves in hard bursts separated by hard stops — a dropped frame. */
  | "stutter"
  /** Holds one half of the arena and will not walk across the middle. Only its
   *  scripted vault changes sides, and it adopts whichever half it lands in. */
  | "partition"
  /** Only ever advances. It does not back off when crowded, it does not
   *  retreat when hurt: it lurches forward and then waits, like a progress bar
   *  that has nothing to do with how long anything will take. */
  | "march"
  /** Reverses at irregular intervals and frequently overrides the band it is
   *  supposed to hold — seven heads that do not agree with each other. */
  | "waver"
  /** Answers the player's MOTION rather than their position: it tracks hard
   *  while they move and nearly stops when they stop. */
  | "stalk"
  /** A tower. It does not travel; it sways over the ground it occupies. */
  | "anchor"
  /** Circles the ground it holds court on, indifferent to where the player is.
   *  If you want it, you come to it. */
  | "orbit"
  /** Closes its own standoff band a little with every exchange, so the room
   *  the player has to work in shrinks as the fight goes on. */
  | "advance"
  /** Cycles the other styles, one per exchange. Only the Lock-In Engine, which
   *  is every surface you switched off assembled into one machine. */
  | "mimic";

/** Which styles `mimic` walks through, in order, one per exchange. */
const MIMIC_CYCLE: readonly MoveStyle[] = ["march", "skate", "orbit", "waver"];

/** stutter: seconds of motion, then seconds of nothing, and how much faster it
 *  travels while it is travelling (same ground covered, delivered in lumps). */
const STUTTER_ON = 0.34;
const STUTTER_OFF = 0.30;
const STUTTER_BOOST = 1.85;

/** march: lurch and wait, and the distance it refuses to close past. */
const MARCH_ON = 0.62;
const MARCH_OFF = 0.52;
const MARCH_FLOOR = 96;

/** waver: bounds on how long it holds a direction before changing its mind. */
const WAVER_MIN = 0.28;
const WAVER_MAX = 0.95;

/** skate: seconds for velocity to catch up with intent. Higher is slipperier. */
const SKATE_GRIP = 0.55;
const SKATE_TOP = 1.35;

/** stalk: player pixels per second that count as "moving", and the floor under
 *  its response, so a parked player does not freeze it solid. */
const STALK_MATCH = 90;
const STALK_FLOOR = 0.22;

/** anchor: a tower's sway, in pixels and cycles per second. */
const ANCHOR_SWAY = 17;
const ANCHOR_RATE = 0.26;

/** orbit: radius around the court it holds, and how fast it circles. */
const ORBIT_R = 104;
const ORBIT_RATE = 0.21;

/** advance: how much the standoff band tightens per exchange, and the closest
 *  it is ever allowed to end up. */
const ADVANCE_PER_CYCLE = 16;
const ADVANCE_MIN = 78;

type LeapKind =
  /** A short bound; the attack fires just after apex. */
  | "hop"
  /** Clears the player entirely and lands on the far side. */
  | "vault"
  /** High, and comes down beside the player rather than on him. */
  | "dive";

type Special = LeapKind | "dash" | "rush" | "none";

export interface BossPlan {
  move: MoveStyle;
  /** Distance from Rook the boss tries to hold. Unused by `creep`, which
   *  anchors to its ground instead of to the player. */
  standoff: number;
  /** Fraction of the profile stride used while pacing inside the band. */
  pace: number;
  /** Movement specials, cycled in order. "none" is a real entry: it buys a
   *  beat of plain repositioning, and it is the whole list for the bosses that
   *  carry their leap inside the attack script instead. */
  specials: readonly Special[];
  /** Seconds of repositioning between specials. */
  specialEvery: number;
  /** Multiplier on BOSS.WINDUP. Never below 1: the telegraph is the contract
   *  the whole fight rests on, and a boss is allowed to be slower than the
   *  reference, never faster. */
  tell: number;
  script: (cycle: number, enraged: boolean) => BossPattern;
}

/**
 * Per-boss identity, keyed by mission index.
 *
 * Derived from BOSS_PROFILES and from what the briefing in data.ts already
 * says each antagonist DOES — the Leviathan "charges the length of its arena
 * and cannot correct mid-rush", the Tyrant "partitions the arena and leaps
 * between halves", the Sovereign "lays ground-level tribute walls you cannot
 * jump cleanly". Those lines were already promises to the player; before this
 * table they were only prose, and every one of those bosses walked and fanned
 * identically. A profile with `jump: 0` never gets a leap here, because the
 * briefing panel tells the player it does not have one.
 */
export const PLANS: readonly BossPlan[] = [
  /* 0 BUTTON BRIGADIER — an emplacement that will not come to you. It walls
     the floor with lobbed button volleys and alternates a flat pair at head
     height, so neither standing nor jumping is a resting position. */
  {
    move: "creep", standoff: 210, pace: 1, specials: ["none"], specialEvery: 99, tell: 1.25,
    script: (n) => ({
      volleys: n % 2 === 0
        ? [{ at: 0, count: 3, spread: 0.34, speed: 165, gravity: 430, size: 24 }]
        : [{ at: 0, count: 2, spread: 0.1, speed: 200 },
           { at: 0.2, count: 2, spread: 0.1, speed: 200 }],
    }),
  },

  /* 1 CODEC WARDEN — hop-and-spray. Every exchange is a short bound with a
     tight spread at apex, then the same volley "transcoded": wider, slower,
     arriving late, so the dodge that beat the first one walks into the second. */
  {
    move: "stutter", standoff: 132, pace: 0.85, specials: ["none"], specialEvery: 3.4, tell: 1,
    script: () => ({
      leap: "hop",
      volleys: [
        { at: 0, count: 3, spread: 0.2, speed: 215 },
        { at: 0.18, count: 3, spread: 0.36, speed: 150 },
      ],
    }),
  },

  /* 2 VLAN TYRANT — partitions the arena. It vaults clean over Rook to the far
     half, drops a pair on the way across, and lands hard enough to push a
     ground wall out both ways: the half you were standing in stops being safe
     the moment it commits. */
  {
    move: "partition", standoff: 150, pace: 0.9, specials: ["none"], specialEvery: 2.9, tell: 1.1,
    script: () => ({
      leap: "vault",
      volleys: [
        { at: 0, count: 2, spread: 0.32, speed: 190 },
        { at: 0.18, count: 2, spread: 0.5, speed: 170, groundWall: true },
      ],
    }),
  },

  /* 3 REFRESH ENFORCER — the ice fight. It slides rather than walks, so it
     arrives past where it meant to stop, and its shots are the slow arcs the
     profile advertises: they expire onto you rather than reach you. */
  {
    move: "skate", standoff: 172, pace: 0.95, specials: ["dash"], specialEvery: 3.2, tell: 1.15,
    script: (n) => ({
      volleys: [
        { at: 0, count: 3, spread: 0.26, speed: 150, gravity: 300, size: 22 },
        { at: 0.24, count: n % 2 === 0 ? 2 : 3, spread: 0.16, speed: 210 },
      ],
    }),
  },

  /* 4 INSTALLER OVERMIND — provisions three lanes at once, exactly as the
     briefing threatens. One lane high, one level, one low, each a beat apart,
     so the answer is to be moving through the gaps rather than parked in one. */
  {
    move: "march", standoff: 198, pace: 0.7, specials: ["hop", "none"], specialEvery: 3.8, tell: 1.2,
    script: (_n, enraged) => ({
      volleys: [
        { at: 0, count: enraged ? 4 : 3, spread: 0.22, speed: 180, aimOffset: -0.34 },
        { at: 0.14, count: enraged ? 4 : 3, spread: 0.22, speed: 180 },
        { at: 0.28, count: enraged ? 4 : 3, spread: 0.22, speed: 180, aimOffset: 0.32 },
      ],
    }),
  },

  /* 5 CABLE LEVIATHAN — the serpent, and the only boss drawn side-on. It
     undulates instead of striding, and its signature is the rush: a committed
     run of the arena that sprays needles as it goes and, per its own briefing,
     cannot correct once it has started. Standing still is what loses to it. */
  {
    move: "serpent", standoff: 124, pace: 1.05, specials: ["rush"], specialEvery: 3, tell: 1,
    script: () => ({
      volleys: [
        { at: 0, count: 2, spread: 0.08, speed: 250 },
        { at: 0.12, count: 2, spread: 0.08, speed: 250 },
      ],
    }),
  },

  /* 6 CONSOLE HYDRA — seven heads that do not agree with each other. The volley
     sweeps across an arc one head at a time, and the next exchange sweeps back
     the other way, so the safe end of the room keeps changing. */
  {
    move: "waver", standoff: 188, pace: 1.1, specials: ["none", "hop"], specialEvery: 4.4, tell: 1.1,
    script: (n) => {
      const dir = n % 2 === 0 ? 1 : -1;
      return {
        volleys: [-0.48, -0.16, 0.16, 0.48].map((off, i) => ({
          at: i * 0.1,
          count: 2,
          spread: 0.12,
          speed: 195,
          aimOffset: off * dir,
        })),
      };
    },
  },

  /* 7 SUPPORT GUILLOTINE — it does not answer where you are, it drops on where
     you were. The leap goes high and comes down BESIDE Rook, never on him, and
     the volley falls straight out of the apex. */
  {
    move: "stalk", standoff: 166, pace: 1, specials: ["none"], specialEvery: 3.1, tell: 1,
    script: (_n, enraged) => ({
      leap: "dive",
      volleys: [
        { at: 0, count: enraged ? 5 : 4, spread: 0.26, speed: 225, down: true },
        { at: 0.2, count: 2, spread: 0.2, speed: 200 },
      ],
    }),
  },

  /* 8 SILO SOVEREIGN — a tower, and it behaves like one: it never leaves its
     floor. The tribute walls own the ground lane, so the ledges are the only
     place to be; the lobbed shell that follows is what it does to anyone who
     decided a ledge was safe. */
  {
    move: "anchor", standoff: 240, pace: 0.8, specials: ["none"], specialEvery: 99, tell: 1.35,
    script: () => ({
      volleys: [
        { at: 0, count: 2, spread: 0.12, speed: 140, groundWall: true },
        { at: 0.28, count: 2, spread: 0.44, speed: 160, gravity: 420, size: 24 },
      ],
    }),
  },

  /* 9 CLOSED-ECOSYSTEM MONARCH — collaboration by invitation. It holds court at
     a distance, backs away from anyone who closes in, and dashes to retake the
     middle of the room whenever it has been pushed off it. */
  {
    move: "orbit", standoff: 216, pace: 0.75, specials: ["dash", "none"], specialEvery: 3.6, tell: 1.1,
    script: (_n, enraged) => ({
      volleys: enraged
        ? [{ at: 0, count: 5, spread: 0.26, speed: 200 },
           { at: 0.3, count: 4, spread: 0.34, speed: 175 }]
        : [{ at: 0, count: 5, spread: 0.26, speed: 200 }],
    }),
  },

  /* 10 TRUST GATEKEEPER — it re-prompts, and the prompts escalate. Each cycle
     adds a shot and shaves the pause after it (see `cooldownFor`), and its
     dashes chain: one challenge is followed straight by the next. */
  {
    move: "advance", standoff: 154, pace: 1, specials: ["dash", "dash", "hop"], specialEvery: 2.6, tell: 1,
    script: (n) => ({
      volleys: [
        { at: 0, count: 2 + Math.min(3, n), spread: 0.18, speed: 215 },
        { at: 0.16, count: 2, spread: 0.5, speed: 180 },
      ],
    }),
  },

  /* 11 THE LOCK-IN ENGINE — every surface you switched off, in one machine. It
     runs the whole vocabulary in sequence rather than picking one: vault and
     partition, rush, artillery wall, then the eight-way burst its briefing
     promises below half strength. The cycle number is the phase. */
  {
    move: "mimic", standoff: 186, pace: 1, specials: ["vault", "rush", "none", "dash"],
    specialEvery: 2.4, tell: 1,
    script: (n, enraged) => {
      const phase = n % 4;
      if (enraged && phase === 3) {
        return {
          volleys: [{ at: 0, count: 8, spread: 0.34, speed: 220 },
                    { at: 0.26, count: 4, spread: 0.2, speed: 250 }],
        };
      }
      if (phase === 0) {
        return {
          leap: "vault",
          volleys: [{ at: 0, count: 3, spread: 0.3, speed: 205 },
                    { at: 0.2, count: 2, spread: 0.5, speed: 190, groundWall: true }],
        };
      }
      if (phase === 1) {
        return {
          volleys: [{ at: 0, count: 4, spread: 0.16, speed: 240 },
                    { at: 0.14, count: 4, spread: 0.16, speed: 240, aimOffset: 0.22 }],
        };
      }
      if (phase === 2) {
        return {
          volleys: [{ at: 0, count: 3, spread: 0.4, speed: 170, gravity: 400, size: 24 },
                    { at: 0.24, count: 3, spread: 0.4, speed: 150, gravity: 400, size: 24 }],
        };
      }
      return { volleys: [{ at: 0, count: 5, spread: 0.24, speed: 220 }] };
    },
  },
];

/** A surface the boss may stand on. Structurally a subset of levels.Platform,
 *  so PlayScene can hand its stage platforms straight through. */
export interface BossSurface {
  x: number;
  y: number;
  w: number;
  h: number;
  /** One-way girder. The arena's escape ledges are exactly these, and a boss
   *  must never stand on one — structurally a subset of levels.Platform. */
  thin?: boolean;
}

export interface BossBounds {
  left: number;
  right: number;
  /** Arena floor, in the boss's own top-of-box space. */
  floor: number;
  /** Ledges, if the arena has any. Optional because the boss has to keep
   *  working in the arenas that are still one flat line. */
  platforms?: readonly BossSurface[];
}

export class Boss {
  sprite: Phaser.GameObjects.Sprite;
  mission: number;
  x: number;
  y: number;
  w: number;
  h: number;
  hp: number;
  maxHp: number;
  vy = 0;
  facing = -1;
  onGround = false;
  dead = false;
  flash = 0;
  frozen = 0;

  state: BossState = "reposition";
  private stateT = 0;
  private cooldown = 0;
  private turnLock = 0;
  private phase = 0;
  /** Did the boss actually cover ground this frame? A cumulative distance was
   *  wrong here: it is only ever added to, so after the first stride step it
   *  stays above zero forever and the idle/breathing pose never plays again. */
  private movedThisFrame = false;
  /** Distance-keyed stride phase, 0..1, so the bob stays in step at any speed. */
  private strideCycle = 0;
  /** Counts down after a landing, driving the squash. */
  private landSquash = 0;
  /**
   * Cooldown before this boss can be frozen again.
   *
   * BOSS.FREEZE_CAP is 0.55s and the CRYO HANDSHAKE's own cooldown is 0.58s,
   * so a player holding the trigger re-applied the freeze faster than it wore
   * off and the boss never completed a wind-up. Measured: frozen for 93% of
   * the fight on the two bosses whose briefings name CRYO as the counter — a
   * seven-second fight became a fifty-second grind with no risk in it. A
   * weakness should shorten the fight, not delete it.
   */
  freezeLockout = 0;

  /** Horizontal velocity. Only ever non-zero in the air or in a dash — ground
   *  repositioning is positional, so a boss cannot slide out of a state. */
  private vx = 0;
  /** Which way the boss is travelling, which is NOT which way it faces: a boss
   *  backing out of the standoff band still faces the player it is shooting. */
  private moveDir: 1 | -1 = -1;
  /** Where a `creep`, `anchor` or `orbit` boss set up. It defends this ground,
   *  not the player. */
  private anchorX: number;
  /** stutter/march: time left in the current burst, and whether it is a moving
   *  burst or a stalled one. */
  private burstT = 0;
  private burstOn = true;
  /** partition: which half of the arena this boss currently owns. */
  private half: 1 | -1 = -1;
  /** skate: carried horizontal velocity, so intent and motion can disagree. */
  private glideV = 0;
  /** orbit: angle around the court, in turns. */
  private orbitT = 0;
  /** waver: time left before it changes its mind again. */
  private waverT = 0;
  /** stalk: where the player was last frame, so their SPEED can be measured. */
  private lastPlayerX = 0;
  /** Aim toward Rook, refreshed while free and frozen for the whole wind-up so
   *  that reading the telegraph and moving is always the right answer. */
  private aim = 0;
  private aimLocked = 0;
  /** Countdown on the last volley's recoil, so a barrage kicks per shot. */
  private recoil = 0;
  /** Exchanges completed. Drives the per-boss script and the Gatekeeper's
   *  accelerating cadence. */
  private cycle = 0;
  /** Time until the next movement special, and which one is next. */
  private specialT = 0;
  private specialIndex = 0;
  private pendingSpecial: Special = "none";
  private rushT = 0;
  /** The pattern chosen at WINDUP, released during FIRE. Chosen up front so the
   *  telegraph and the shots cannot disagree. */
  private pending: BossPattern | null = null;
  private volleyIndex = 0;
  private fireTotal: number = BOSS.FIRE;

  constructor(sprite: Phaser.GameObjects.Sprite, mission: number, x: number, y: number, hp: number) {
    this.sprite = sprite;
    this.mission = mission;
    this.x = x;
    this.y = y;
    this.anchorX = x;
    this.hp = hp;
    this.maxHp = hp;
    this.h = mission === FINAL_MISSION ? BOSS.H_FINAL : BOSS.H;
    /* Width from the boss's own artwork, not from its height. Every boss used
       to be a square, which described none of them: the widest draw 186 px
       across a 126 px box, so a third of the visible body was not a target and
       shots that plainly connected did nothing; the narrowest draws 84 px
       inside that same box, so shots that plainly missed still hit. */
    this.w = BOSS_PROFILES[mission]?.width ?? this.h;
    /* Baseline origin, same reason as Rook — the gutter is below the feet. */
    const o = originFor("bosses.png");
    sprite.setOrigin(o.x, o.y);
    this.cooldown = 1.1;
    this.specialT = this.plan.specialEvery * 0.6;
  }

  get box(): { x: number; y: number; w: number; h: number } {
    return { x: this.x, y: this.y, w: this.w, h: this.h };
  }

  get enraged(): boolean {
    return this.hp < this.maxHp * BOSS.ENRAGE_AT;
  }

  /** Is the boss committed — i.e. is this a window the player can punish? */
  get vulnerableWindow(): boolean {
    return this.state === "recover";
  }

  private get plan(): BossPlan {
    return PLANS[Math.min(this.mission, PLANS.length - 1)];
  }

  update(
    dt: number,
    player: { x: number; y: number },
    bounds: BossBounds,
    fire: (boss: Boss, attack: BossAttack) => void,
  ): void {
    if (this.dead) return;

    this.flash = Math.max(0, this.flash - dt);
    this.frozen = Math.max(0, this.frozen - dt);
    this.freezeLockout = Math.max(0, this.freezeLockout - dt);
    this.phase += dt;
    this.turnLock = Math.max(0, this.turnLock - dt);
    this.movedThisFrame = false;
    this.landSquash = Math.max(0, this.landSquash - dt);
    this.recoil = Math.max(0, this.recoil - dt);

    const landed = this.integrate(dt, bounds);

    if (this.frozen > 0) {
      this.applyPose();
      return;
    }

    /* Aim is live except in the states where the boss is committed; those keep
       `aimLocked`, so a shot always leaves along the line the wind-up leaned
       down rather than tracking a player who already dodged. */
    if (this.state === "reposition" || this.state === "brace") {
      this.aim = this.angleTo(player);
    }

    switch (this.state) {
      case "reposition":
        this.faceToward(player.x);
        this.reposition(dt, player, bounds);
        this.cooldown -= dt;
        this.specialT -= dt;
        if (this.cooldown <= 0) {
          this.beginAttack(player, bounds);
        } else if (this.specialT <= 0) {
          this.beginSpecial(player, bounds);
        }
        break;

      case "leap":
        /* Committed until the feet are back on something. The arc itself is
           the tell, which is why nothing here can steer it. */
        if (landed) this.endMove();
        break;

      case "brace":
        /* The dash tell. It gathers and holds still — a boss that crouched and
           moved on the same frame was the "hop" the playtest complained of. */
        this.stateT -= dt;
        if (this.stateT <= 0) this.startDash();
        break;

      case "dash": {
        this.stateT -= dt;
        this.movedThisFrame = true;
        if (this.pendingSpecial === "rush") {
          this.rushT -= dt;
          if (this.rushT <= 0) {
            this.rushT = RUSH_SHOT;
            this.aimLocked = this.aim;
            this.launch({ at: 0, count: 1, spread: 0, speed: 260, size: 16 }, fire);
          }
        }
        const wall = this.x <= bounds.left + 1 || this.x >= bounds.right - 1;
        if (this.stateT <= 0 || wall) {
          this.vx = 0;
          /* A lunge ends in RECOVER, not in a fresh stride: overshooting has to
             cost something, or a dash is free pressure with no answer. */
          this.state = "recover";
          this.stateT = BOSS.RECOVER;
        }
        break;
      }

      case "windup":
        /* Committed: no turning, no repositioning, no re-aiming. */
        this.stateT -= dt;
        if (this.stateT <= 0) {
          this.pending ??= { volleys: [{ at: 0, count: 2, spread: 0.15, speed: 0 }] };
          this.volleyIndex = 0;
          const volleys = this.pending.volleys;
          const last = volleys.length > 0 ? volleys[volleys.length - 1].at : 0;
          this.fireTotal = Math.max(BOSS.FIRE, last + BOSS.FIRE);
          this.state = "fire";
          this.stateT = this.fireTotal;
          this.drainVolleys(fire);
        }
        break;

      case "fire":
        this.stateT -= dt;
        this.drainVolleys(fire);
        if (this.stateT <= 0) {
          this.state = "recover";
          this.stateT = BOSS.RECOVER;
        }
        break;

      case "recover":
        this.stateT -= dt;
        if (this.stateT <= 0) this.endMove();
        break;

      case "defeated":
        break;
    }

    this.x = Math.max(bounds.left, Math.min(bounds.right, this.x));
    this.applyPose();
  }

  // ------------------------------------------------------------- physics

  /**
   * Gravity, horizontal carry and ground resolution. Returns true on the frame
   * the boss touched down.
   *
   * The arena is no longer a single line — it gains one or two ledges — so the
   * floor is resolved per position rather than read off one number. A boss that
   * walks off a ledge falls, and a leap solved onto one lands on it.
   */
  private integrate(dt: number, bounds: BossBounds): boolean {
    const prevY = this.y;
    const wasAir = !this.onGround;

    if (!this.onGround || this.state === "dash") {
      this.x += this.vx * dt;
      if (this.x <= bounds.left || this.x >= bounds.right) {
        this.x = Math.max(bounds.left, Math.min(bounds.right, this.x));
        this.vx = 0;
      }
      if (Math.abs(this.vx) > 4) this.movedThisFrame = true;
    }

    /* Gravity always applies, so a boss thrown into the air by its own leap
       lands rather than hovering — nothing here is allowed to fly. */
    this.vy += BOSS.GRAVITY * dt;
    this.y += this.vy * dt;

    const support = this.supportY(prevY, bounds);
    if (support !== null && this.y >= support) {
      /* Landing after a real fall squashes; simply resting on a surface does
         not, or the boss pulses every frame it stands still. */
      if (wasAir && this.vy > 120) this.landSquash = LAND_SQUASH_TIME;
      this.y = support;
      this.vy = 0;
      this.onGround = true;
      if (this.state !== "dash") this.vx = 0;
      return wasAir;
    }
    this.onGround = false;
    return false;
  }

  /**
   * The top of whatever the boss is standing on, in its own top-of-box space,
   * or null while it is over a gap.
   *
   * Ledges narrower than LEDGE_MIN_W of the boss are skipped deliberately: the
   * small platforms in a boss arena are Rook's way out of a ground wall, and a
   * 126 px machine balanced on one would both read as a bug and risk ending the
   * fight by stranding itself where it cannot follow him.
   */
  private supportY(prevY: number, bounds: BossBounds): number | null {
    if (this.y >= bounds.floor) return bounds.floor;
    /* Only a downward crossing counts, so a rising leap passes through a ledge
       instead of snapping onto its underside. */
    if (this.vy < 0) return null;

    const feetPrev = prevY + this.h;
    let best: number | null = null;
    for (const p of bounds.platforms ?? []) {
      /* One-way girders are the player's furniture, never the boss's.
         Scaling the rule to the boss's own width could not express that: the
         narrowest boss is 84 px, so excluding a 150 px girder needed a 1.8x
         multiplier that then excluded legitimate ground from the widest. The
         arena's escape ledges are exactly the thin surfaces, so say so. */
      if (p.thin) continue;
      if (p.w < this.w * LEDGE_MIN_W) continue;
      if (this.x + this.w <= p.x + 4 || this.x >= p.x + p.w - 4) continue;
      const top = p.y - this.h;
      if (top >= bounds.floor) continue;
      if (feetPrev > p.y + 3) continue;
      if (best === null || top < best) best = top;
    }
    return best;
  }

  // ------------------------------------------------------------ movement

  private faceToward(px: number): void {
    if (this.turnLock > 0) return;
    const delta = px - (this.x + this.w / 2);
    const want = delta < 0 ? -1 : 1;
    if (Math.abs(delta) < BOSS.TURN_DEADZONE) return;
    if (want === this.facing) return;
    this.facing = want;
    this.turnLock = BOSS.TURN_COOLDOWN;
  }

  /** Snap to the player without hysteresis. Used the instant it matters — the
   *  frame an attack or a lunge commits — because a boss shooting at something
   *  behind its own shoulder was the loudest thing wrong with these fights. */
  private snapFacing(px: number): void {
    this.facing = px < this.x + this.w / 2 ? -1 : 1;
    this.turnLock = BOSS.TURN_COOLDOWN;
  }

  private strideSpeed(): number {
    const profile = BOSS_PROFILES[this.mission];
    return profile.speed * (this.enraged ? BOSS.ENRAGE_STRIDE : 1);
  }

  /**
   * Ground movement between attacks.
   *
   * The old version walked at the player every frame, which is what made body
   * contact the fight. Every style here either holds a distance or holds a
   * position; closing the gap is something the PLAYER does.
   */
  private reposition(dt: number, player: { x: number }, bounds: BossBounds): void {
    const style = this.plan.move === "mimic"
      ? MIMIC_CYCLE[this.cycle % MIMIC_CYCLE.length]
      : this.plan.move;

    const before = this.x;
    this.x += this.styleStep(style, dt, player, bounds);

    /* Pace inside the arena instead of pressing against a wall: reaching an
       edge turns the boss, which reads as deliberate rather than stuck. */
    if (this.x <= bounds.left || this.x >= bounds.right) {
      this.moveDir = -this.moveDir as 1 | -1;
      this.glideV = -this.glideV * 0.4;
      this.x = Math.max(bounds.left, Math.min(bounds.right, this.x));
    }
    const travelled = Math.abs(this.x - before);
    this.movedThisFrame = travelled > 0.05;
    this.strideCycle = (this.strideCycle + travelled / STRIDE_PX) % 1;
  }

  /**
   * The standoff band, which most styles are a variation on.
   *
   * Returns the direction that holds `standoff` pixels between the boss and the
   * player, and whether the boss is already inside the band -- inside it, a boss
   * paces rather than parks, because a boss that stands still is only a target.
   */
  private bandDir(playerX: number, centre: number, standoff: number):
      { dir: 1 | -1; inside: boolean } {
    const gap = Math.abs(playerX - centre);
    const toward: 1 | -1 = playerX < centre ? -1 : 1;
    if (gap > standoff + BAND) return { dir: toward, inside: false };
    if (gap < standoff - BAND) return { dir: -toward as 1 | -1, inside: false };
    return { dir: this.moveDir, inside: true };
  }

  /**
   * One frame of ground movement, in signed world pixels.
   *
   * Every style either holds a distance or holds a position; closing the gap is
   * something the PLAYER does. Nothing here walks at Rook every frame, because
   * that is what made body contact the whole fight in v0.8.
   */
  private styleStep(
    style: MoveStyle, dt: number, player: { x: number }, bounds: BossBounds,
  ): number {
    const plan = this.plan;
    const centre = this.x + this.w / 2;
    const base = this.strideSpeed();

    switch (style) {
      case "creep": {
        /* Emplacement: patrol a short span around the ground it took up, and
           let the player choose the range. */
        if (this.x > this.anchorX + CREEP_SPAN) this.moveDir = -1;
        if (this.x < this.anchorX - CREEP_SPAN) this.moveDir = 1;
        return this.moveDir * base * plan.pace * dt;
      }

      case "anchor": {
        /* A tower does not travel. It sways over its own footing, and the
           player has to solve it as terrain rather than as something chasing
           them. Tracked as a target position rather than as a velocity, so it
           cannot drift off its ground over a long fight. */
        const want = this.anchorX
          + Math.sin(this.phase * ANCHOR_RATE * Math.PI * 2) * ANCHOR_SWAY;
        const d = want - this.x;
        this.moveDir = d < 0 ? -1 : 1;
        return d;
      }

      case "stutter": {
        /* Motion in lumps: it covers the same ground, delivered as bursts with
           dead air between them, so the player cannot read its position off a
           constant velocity. */
        this.burstT -= dt;
        if (this.burstT <= 0) {
          this.burstOn = !this.burstOn;
          this.burstT = this.burstOn ? STUTTER_ON : STUTTER_OFF;
        }
        const b = this.bandDir(player.x, centre, plan.standoff);
        this.moveDir = b.dir;
        if (!this.burstOn) return 0;
        return this.moveDir * base * (b.inside ? plan.pace : 1) * STUTTER_BOOST * dt;
      }

      case "partition": {
        /* It owns a half and will not walk out of it. Its scripted vault is the
           only thing that changes sides, and the half is re-read from position
           rather than set by a hook, so landing anywhere simply works. */
        const mid = (bounds.left + bounds.right) / 2;
        if (this.x > mid) this.half = 1;
        else if (this.x + this.w < mid) this.half = -1;

        const b = this.bandDir(player.x, centre, plan.standoff);
        this.moveDir = b.dir;
        let step = this.moveDir * base * (b.inside ? plan.pace : 1) * dt;
        const limit = this.half < 0 ? mid - this.w - this.x : mid - this.x;
        if (this.half < 0) step = Math.min(step, Math.max(0, limit));
        else step = Math.max(step, Math.min(0, limit));
        /* Turn at its own border, not at the arena wall. */
        if (Math.abs(step) < 0.05) this.moveDir = -this.moveDir as 1 | -1;
        return step;
      }

      case "skate": {
        /* Velocity lags intent, so it slides past the band in both directions
           and has to come back -- the ice mission's own joke about a machine
           that cannot stop when you tell it to. */
        const b = this.bandDir(player.x, centre, plan.standoff);
        const want = b.dir * base * (b.inside ? plan.pace : 1) * SKATE_TOP;
        this.glideV += (want - this.glideV) * Math.min(1, dt / SKATE_GRIP);
        this.moveDir = this.glideV < 0 ? -1 : 1;
        return this.glideV * dt;
      }

      case "march": {
        /* Forward only. It does not back off when crowded and it does not
           retreat when hurt; it lurches, then waits, then lurches. Between
           lurches it idles in place rather than freezing, so the fight never
           looks like it has hung. */
        this.burstT -= dt;
        if (this.burstT <= 0) {
          this.burstOn = !this.burstOn;
          this.burstT = this.burstOn ? MARCH_ON : MARCH_OFF;
        }
        const toward: 1 | -1 = player.x < centre ? -1 : 1;
        this.moveDir = toward;
        const gap = Math.abs(player.x - centre);
        if (!this.burstOn || gap <= MARCH_FLOOR) {
          return Math.sin(this.phase * 3.1) * 7 * dt;
        }
        return toward * base * plan.pace * dt;
      }

      case "serpent": {
        /* Slither: the body surges on the down-stroke and stalls on the up. */
        const b = this.bandDir(player.x, centre, plan.standoff);
        this.moveDir = b.dir;
        const wave = 1 + 0.55 * Math.sin(this.phase * WAVE_RATE * Math.PI * 2);
        return this.moveDir * base * (b.inside ? plan.pace : 1) * wave * dt;
      }

      case "waver": {
        /* Seven heads that do not agree. It re-decides at irregular intervals,
           and a third of the time it overrides the band entirely and walks the
           wrong way -- which is both funnier and harder to read than a machine
           that always does the sensible thing. Driven off `phase` rather than
           Math.random, so a replayed fight behaves the same way twice. */
        this.waverT -= dt;
        if (this.waverT <= 0) {
          const r = (Math.sin(this.phase * 12.9898) * 43758.5453) % 1;
          const q = (Math.sin(this.phase * 78.233) * 24634.6345) % 1;
          this.waverT = WAVER_MIN + Math.abs(r) * (WAVER_MAX - WAVER_MIN);
          const b = this.bandDir(player.x, centre, plan.standoff);
          this.moveDir = (Math.abs(q) > 0.66 ? -b.dir : b.dir) as 1 | -1;
        }
        return this.moveDir * base * plan.pace * dt;
      }

      case "stalk": {
        /* It answers motion, not position. Move and it matches you stride for
           stride; stand still and it very nearly stops -- which is exactly the
           wrong instinct to indulge, because what it is winding up is a drop
           onto where you are standing. */
        const moved = Math.abs(player.x - this.lastPlayerX) / Math.max(dt, 1e-4);
        this.lastPlayerX = player.x;
        const b = this.bandDir(player.x, centre, plan.standoff);
        this.moveDir = b.dir;
        const response = Math.max(STALK_FLOOR, Math.min(1, moved / STALK_MATCH));
        return this.moveDir * base * plan.pace * response * dt;
      }

      case "orbit": {
        /* It holds court. The circle is a function of time alone -- where the
           player stands does not enter into it -- so the only way to engage is
           to walk into the room and take the range it is already using. */
        this.orbitT += dt * ORBIT_RATE;
        const want = this.anchorX + Math.sin(this.orbitT * Math.PI * 2) * ORBIT_R;
        const d = want - this.x;
        this.moveDir = d < 0 ? -1 : 1;
        const cap = base * 1.3 * dt;
        return Math.max(-cap, Math.min(cap, d));
      }

      case "advance": {
        /* Every prompt is closer than the last. The band it holds tightens by a
           fixed amount per exchange down to a floor, so the player's working
           room shrinks as the fight goes on without the boss ever charging. */
        const standoff = Math.max(
          ADVANCE_MIN, plan.standoff - this.cycle * ADVANCE_PER_CYCLE);
        const b = this.bandDir(player.x, centre, standoff);
        this.moveDir = b.dir;
        return this.moveDir * base * (b.inside ? plan.pace : 1) * dt;
      }

      case "pace":
      default: {
        const b = this.bandDir(player.x, centre, plan.standoff);
        this.moveDir = b.dir;
        return this.moveDir * base * (b.inside ? plan.pace : 1) * dt;
      }
    }
  }

  /** Ballistic solve: leave the ground with the profile's impulse and come down
   *  near `targetX`, whatever the arena's floor does in between. */
  private startLeap(kind: LeapKind, targetX: number, bounds: BossBounds): void {
    const profile = BOSS_PROFILES[this.mission];
    const impulse = profile.jump || 300;
    const lift = kind === "dive" ? impulse * 1.18 : kind === "hop" ? impulse * 0.85 : impulse;
    this.vy = -lift;
    this.onGround = false;
    const airtime = (2 * lift) / BOSS.GRAVITY;
    const want = Math.max(bounds.left, Math.min(bounds.right, targetX)) - this.x;
    this.vx = Math.max(-AIR_SPEED_MAX, Math.min(AIR_SPEED_MAX, want / airtime));
  }

  private startDash(): void {
    const rush = this.pendingSpecial === "rush";
    this.state = "dash";
    this.stateT = rush ? RUSH_TIME : DASH_TIME;
    this.rushT = 0;
    this.moveDir = this.facing < 0 ? -1 : 1;
    this.vx = this.facing * (rush ? RUSH_SPEED : DASH_SPEED);
  }

  private beginSpecial(player: { x: number; y: number }, bounds: BossBounds): void {
    const plan = this.plan;
    const kind = plan.specials[this.specialIndex % plan.specials.length];
    this.specialIndex++;
    this.specialT = plan.specialEvery;
    this.pendingSpecial = kind;
    if (kind === "none" || !this.onGround) return;

    this.snapFacing(player.x);
    if (kind === "dash" || kind === "rush") {
      this.state = "brace";
      this.stateT = BRACE_TIME;
      return;
    }
    /* A boss the briefing describes as floor-bound stays on the floor. */
    if (BOSS_PROFILES[this.mission].jump <= 0) return;
    this.state = "leap";
    this.startLeap(kind, this.leapTarget(kind, player.x), bounds);
  }

  /** Where a leap should put the boss down. Never on top of Rook: contact is a
   *  punishment for standing in the wrong place, not the attack itself. */
  private leapTarget(kind: LeapKind, px: number): number {
    const centre = this.x + this.w / 2;
    const dir = px < centre ? -1 : 1;
    if (kind === "hop") return this.x + dir * 96;
    if (kind === "vault") return px - this.w / 2 + dir * 170;
    return px - this.w / 2 - dir * 62;
  }

  /** Back to pacing. The cooldown deliberately keeps whatever `beginAttack`
   *  set: clamping it here made every boss on the roster fire on the same
   *  0.35 s beat regardless of its profile, which is the flat cadence the
   *  per-boss table exists to get rid of. */
  private endMove(): void {
    this.state = "reposition";
    this.vx = 0;
  }

  // ------------------------------------------------------------- attacks

  private cooldownFor(): number {
    const profile = BOSS_PROFILES[this.mission];
    let cool = profile.cool * (this.enraged ? BOSS.ENRAGE_COOLDOWN : 1);
    /* The Gatekeeper's whole satire is that it re-prompts faster every time you
       answer it. Floored, because a prompt you cannot read is just noise. */
    if (this.mission === 10) cool *= Math.max(0.55, 1 - this.cycle * 0.08);
    return cool;
  }

  private beginAttack(player: { x: number; y: number }, bounds: BossBounds): void {
    const plan = this.plan;
    this.snapFacing(player.x);
    this.aim = this.angleTo(player);
    this.aimLocked = this.aim;
    this.pending = plan.script(this.cycle, this.enraged);
    this.cycle++;
    this.state = "windup";
    this.stateT = BOSS.WINDUP * plan.tell;
    this.cooldown = this.cooldownFor();

    /* An attack-linked leap launches WITH the wind-up rather than at release,
       so the arc is the telegraph: the player sees it leave the ground and has
       the whole rise to decide where not to be standing. */
    if (this.pending.leap && this.onGround && BOSS_PROFILES[this.mission].jump > 0) {
      this.startLeap(this.pending.leap, this.leapTarget(this.pending.leap, player.x), bounds);
    }
  }

  private drainVolleys(fire: (boss: Boss, attack: BossAttack) => void): void {
    const pattern = this.pending;
    if (!pattern) return;
    const elapsed = this.fireTotal - this.stateT;
    while (this.volleyIndex < pattern.volleys.length &&
           pattern.volleys[this.volleyIndex].at <= elapsed) {
      this.launch(pattern.volleys[this.volleyIndex], fire);
      this.volleyIndex++;
    }
  }

  /**
   * Release one volley along the locked aim.
   *
   * `aim`, `gravity` and `size` are additions to BossAttack, and PlayScene has
   * to pass them through to fireEnemy for the arcs and the drop attacks to
   * exist at all. Without that patch every volley still fires — bossFire
   * computes its own angle at Rook — but the aim stops being locked, which
   * quietly removes the reason the wind-up is dodgeable.
   */
  private launch(v: Volley, fire: (boss: Boss, attack: BossAttack) => void): void {
    const aim = v.down ? Math.PI / 2 : this.aimLocked + (v.aimOffset ?? 0);
    fire(this, {
      count: v.count,
      spread: v.spread,
      speed: v.speed,
      groundWall: v.groundWall,
      gravity: v.gravity,
      size: v.size,
      aim,
    });
    this.recoil = RECOIL_TIME;
    /* Front-on art or not, the body ends the shot turned the way the shot went. */
    if (!v.down) this.facing = Math.cos(aim) < 0 ? -1 : 1;
  }

  private angleTo(player: { x: number; y: number }): number {
    return Math.atan2(
      player.y + AIM_CHEST - (this.y + this.h * MUZZLE_Y),
      player.x - (this.x + this.w / 2),
    );
  }

  // ---------------------------------------------------------- appearance

  /**
   * Secondary motion, layered on top of the frame cycle.
   *
   * The masters give five drawn poses per boss, and ten of the twelve are drawn
   * front-on and symmetrical. Cutting between them alone reads as a slideshow,
   * and a flip conveys nothing on a symmetrical body — so the lean is computed
   * from the AIM VECTOR instead. Winding up rocks back along the line the shot
   * will take, the recoil kicks along it, and both read whether the boss is
   * aiming at Rook's feet, his head, or straight down at the floor. Nothing
   * here moves the hitbox; what the player shoots at is still exactly what
   * `box` reports.
   */
  private visualOffset(): { x: number; y: number; squash: number } {
    let x = 0;
    let y = 0;
    let squash = 1;
    const ax = Math.cos(this.aimLocked);
    const ay = Math.sin(this.aimLocked);

    if (this.state === "reposition" && this.onGround && this.movedThisFrame) {
      /* Stride bob, keyed to distance so it stays in step at any speed. */
      y = -Math.abs(Math.sin(this.strideCycle * Math.PI)) * 2.5;
      if (this.plan.move === "serpent") {
        /* The serpent has no legs to bob on; the whole body swims instead. */
        y = -WAVE_LIFT * (0.5 + 0.5 * Math.sin(this.phase * WAVE_RATE * Math.PI * 2));
      }
    }
    if (this.state === "windup") {
      const t = 1 - this.stateT / (BOSS.WINDUP * this.plan.tell);
      x = -ax * 5 * t;
      y = -ay * 3 * t;
      squash = 1 + 0.05 * t;
    }
    if (this.state === "brace") {
      /* Gathering for a lunge: down and back, harder than a wind-up because the
         whole body is about to leave. */
      const t = 1 - this.stateT / BRACE_TIME;
      x = -this.facing * 7 * t;
      squash = 1 - 0.08 * t;
    }
    if (this.state === "dash") {
      /* Stretched along the lunge — the horizontal scale is 1/squash. */
      x = this.facing * 6;
      squash = 0.93;
    }
    if (this.recoil > 0) {
      /* Recoil kick, per volley, hardest on the frame a shot leaves. */
      const t = this.recoil / RECOIL_TIME;
      x += ax * 5 * t;
      y += ay * 3 * t;
      squash *= 1 - 0.06 * t;
    }
    if (this.state === "recover") {
      /* Settle back through the recovery — the punish window, so it is also the
         moment the boss is most obviously off balance. */
      const t = this.stateT / BOSS.RECOVER;
      x += this.facing * 3 * t;
      y += 1.5 * t;
    }
    if (this.landSquash > 0) {
      squash = 1 - 0.12 * (this.landSquash / LAND_SQUASH_TIME);
    }
    return { x, y, squash };
  }

  private applyPose(): void {
    const pose =
      this.state === "windup" || this.state === "brace" ? "wind" :
      this.state === "fire" ? "fire" :
      this.state === "recover" ? "recover" :
      !this.onGround ? "air" :
      this.state === "dash" || this.movedThisFrame ? "walk" : "idle";

    const key = ANIM.boss(this.mission, pose);
    if (this.sprite.anims.currentAnim?.key !== key && this.sprite.scene.anims.exists(key)) {
      this.sprite.play(key, true);
    }

    const off = this.visualOffset();
    /* Rook's convention, and the one the sheets are drawn to: the art faces
       right, so the LEFT-facing boss is the flipped one. This was inverted,
       which is why every front-on boss appeared to shoot over its shoulder. */
    /* Boss art is painted facing left; the manifest says so. */
    this.sprite.setFlipX(flipFor("bosses.png", this.facing));
    this.sprite.setPosition(
      Math.round(this.x + this.w / 2 + off.x),
      Math.round(this.y + this.h + off.y),
    );
    /* Squash about the feet, because the origin is already the ground line. */
    this.sprite.setScale(1 / off.squash, off.squash);

    if (this.frozen > 0) this.sprite.setTint(0x8fd8ff);
    else if (this.flash > 0) this.sprite.setTint(0xffffff);
    else if (this.state === "recover") this.sprite.setTint(0xffd9b0);
    else this.sprite.clearTint();
  }

  /**
   * Put the fight back to its opening state.
   *
   * Called when the player loses a life inside the arena. Everything that
   * accumulates over an encounter has to go back: HP, the state machine, the
   * volley queue, and above all `cycle`, which several bosses use to escalate
   * their own cadence.
   */
  reset(spawnX: number): void {
    this.hp = this.maxHp;
    this.x = spawnX;
    this.vy = 0;
    this.frozen = 0;
    this.flash = 0;
    this.state = "reposition";
    this.stateT = 0;
    this.cycle = 0;
    this.aim = 0;
    this.aimLocked = 0;
    this.pending = null;
    this.volleyIndex = 0;
    this.recoil = 0;
    this.vx = 0;
    this.rushT = 0;
    this.specialT = 0;
    this.specialIndex = 0;
    this.pendingSpecial = "none";
    this.landSquash = 0;
    /* Movement state is per-encounter too. Left set, a Gatekeeper that had
       closed its band over nine exchanges would restart the fight already
       standing on top of the player. */
    this.burstT = 0;
    this.burstOn = true;
    this.glideV = 0;
    this.orbitT = 0;
    this.waverT = 0;
    this.half = -1;
    this.lastPlayerX = spawnX;
    this.anchorX = spawnX;
  }

  hurt(amount: number): void {
    this.hp -= amount;
    this.flash = 0.12;
  }
}
