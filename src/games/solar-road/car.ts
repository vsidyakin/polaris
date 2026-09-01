/* SOLAR CIRCUIT — the player's craft.
 *
 * A port of Phaser3-Road's `src/classes/Car.js`. It is a real Phaser Sprite,
 * but only its *screen* position is Phaser's business: the craft never moves
 * horizontally on screen. Steering moves the camera, so the trail slides
 * underneath a craft pinned to the centre — the same trick every arcade racer of
 * this shape uses.
 *
 * What the class actually owns is the speed model — and that model is no longer
 * upstream's. Upstream has one top speed you reach in three seconds and hold for
 * the rest of the lap. This one has a ceiling that CLIMBS: grip earns the first
 * part of it, `surge` earns the rest, boost pads punch you straight through it,
 * and the whole thing tops out at six times the nominal speed. See the constants
 * below for where each number comes from.
 *
 * The other thing it owns is how hard the craft is leaning. `setSteer()` swaps
 * between five textures of the same craft — level, banking, and banking hard,
 * each way.
 *
 * WHERE THE CHOSEN CRAFT COMES IN
 *
 * A ShipSpec scales four things and introduces none: nominal speed, how fast
 * grip and surge are EARNED, lateral authority (applied by the scene), and what
 * a full boost meter is worth. Everything below is written against the balanced
 * craft and multiplied — which is what keeps the three comparable, and means a
 * change to the model applies to all three at once. See ships.ts.
 */

import Phaser from "phaser";
import { shipFrame, type ShipSpec, type SteerLevel } from "./ships";
import type { RoadScene } from "./game-scene";

/* --- grip -------------------------------------------------------------------
 * A multiplier on top speed that the player earns by staying on the trail and
 * loses the moment they leave it. It scales the ceiling, never the floor, so
 * the craft always responds the same — it just runs out of road speed sooner
 * when grip is low.
 *
 * The rates are asymmetric on purpose: fourteen seconds to earn, two and a half
 * to lose. Slow to build and quicker to lose is what makes the verge feel like a
 * mistake rather than a texture change.
 *
 * The loss was 0.9 seconds and is the single biggest reason a brief excursion
 * used to be so expensive. Grip multiplies the ceiling, so collapsing it in
 * under a second took nearly half the ceiling away before the craft had even
 * finished crossing the rubble — on top of the surge falling and the off-trail
 * cap biting. Three penalties stacking inside one second is what made running
 * wide feel like hitting a wall. */
const GRIP_MIN = 0.55;
const GRIP_MAX = 1;
const GRIP_GAIN = (GRIP_MAX - GRIP_MIN) / (14 * 60);
const GRIP_LOSS = (GRIP_MAX - GRIP_MIN) / (2.5 * 60);

/* --- surge, and the cap that used to be here ---------------------------------
 * WHAT CHANGED, AND WHY IT WAS SAFE TO CHANGE
 *
 * `baseMaxSpeed` is `segmentLength / 1.5`, and it used to be a hard ceiling for
 * a reason that had nothing to do with feel: at that speed the craft cannot
 * cross a whole segment in one frame, which is what kept `findSegment()` a
 * valid answer to "where am I". Anything faster could step clean over a segment
 * between frames — over the segment carrying a boost pad, over the segment that
 * says you have left the trail — and the engine would never know.
 *
 * That invariant is now enforced where it belongs, in `RoadScene.advance()`,
 * which walks the frame's travel in sub-steps no longer than half a segment
 * however fast the craft is going. With the constraint moved off the speed and
 * onto the stepping, the ceiling is free, and `baseMaxSpeed` becomes just the
 * reference speed everything else is a multiple of.
 *
 * SURGE is the ladder. It only climbs while the craft is pressed against its
 * current ceiling on the trail, so it rewards holding the line at the limit
 * rather than merely holding the throttle. It bleeds away over five seconds off
 * the trail — long enough that clipping a verge and rejoining costs a rung or
 * two rather than the run, short enough that wallowing out in the regolith
 * empties the whole ladder.
 *
 * SURGE_BITE is what makes it a ladder and not a timer. The gain only applies
 * within a few per cent of the ceiling, so a player cruising at half speed never
 * accumulates it.
 *
 * EACH RUNG COSTS MORE THAN THE LAST, AND THAT IS THE WHOLE SHAPE
 *
 * The first pass gained surge at a flat rate and reached the top in
 * three-quarters of a minute. Two things were wrong with that. It was far too
 * quick — the entire range the game has to offer was spent inside one lap, and
 * after that there was nothing left to earn. And a flat rate makes a straight
 * line: every rung costs the same, so the fiftieth second of holding the limit
 * feels exactly like the fifth, and nothing about the climb reads as a climb.
 *
 * Dividing the gain by `1 + surge * SURGE_TAPER` gives the curve that actually
 * feels like acceleration towards something hard to reach:
 *
 *     2x nominal ....  20 seconds of holding the limit
 *     3x ...........  48 seconds
 *     4x ...........  85 seconds
 *     5x ...........   2 minutes 8, and the top of what driving alone earns
 *
 * Early progress is quick enough to teach the player what surge is; the top of
 * the ladder is a genuine grind. The last stretch beyond it — 5x to the 6.5x
 * absolute ceiling — is NOT earnable by driving at all. It belongs to the boost,
 * which is the whole reason the boost exists as a separate system: the ladder is
 * what you build over a run, the boost is what you spend in a corner, and if
 * either one could reach the top on its own the other would be decoration.
 *
 * The two constants are solved rather than dialled. For a target time T to reach
 * full surge and a target ratio R for the time to the first rung:
 * `time(S) = (S + TAPER*S^2/2) / GAIN`. */
const SURGE_MAX = 4;
const SURGE_GAIN = 0.00104;
const SURGE_TAPER = 0.5;
const SURGE_LOSS = SURGE_MAX / (5 * 60);
const SURGE_BITE = 0.96;

/* --- the off-trail penalty ---------------------------------------------------
 * Leaving the trail used to drop the ceiling to a flat quarter of nominal — from
 * six times nominal to a quarter of it, an all-but-total stop — and get there in
 * half a second. That was tuned when the ladder topped out at 1x and the fall
 * was a factor of four; against a ladder that reaches 6x it is a factor of
 * twenty-four, and a moment's untidiness cost the entire run.
 *
 * So the off-trail cap is now a SHARE OF WHAT YOU HAD EARNED rather than a flat
 * number. Run wide at 6x and a second in the regolith leaves you around 2.5x
 * rather than a standstill: slow enough that it costs you, fast enough that you
 * are driving out of it rather than watching a number collapse. Getting back on
 * the bedrock and back up to speed is then a matter of seconds, because the grip
 * and the surge you lost are still mostly there.
 *
 * The FLOOR is what stops that share becoming meaningless at the bottom of the
 * range — a share of nearly nothing is nothing, and a craft that cannot crawl
 * off the verge is stuck. It only binds below about nominal speed.
 *
 * The drag rate is the other half. At 6% a frame the fall took half a second,
 * which reads as hitting a wall; at 2.5% it takes about a second and a half,
 * which reads as ploughing. Ploughing is the right verb — the craft is off its
 * swept line and into loose dust, not against a barrier. */
const OFF_ROAD_SHARE = 0.6;
const OFF_ROAD_FLOOR = 0.5;
const OFF_ROAD_DRAG_RATE = 0.025;

/* --- the boost -----------------------------------------------------------
 * A meter filled by driving over pads and spent by holding Shift.
 *
 * It replaces the instant kick pads used to give. A kick is over before the
 * player has registered it and it happens whether they wanted it there or not;
 * a meter is a resource, and a resource turns a pad from a thing you drive over
 * into a thing you plan around. The interesting question stops being "did I hit
 * it" and becomes "where am I going to spend it" — which is a question worth
 * asking on a course with a hairpin at the end of every stage.
 *
 * BOOST_ADD is stated as a share of NOMINAL speed rather than as a multiplier on
 * the current ceiling, and that is deliberate: as a multiplier it would be worth
 * almost nothing at the bottom of the ladder and nothing at all at the top,
 * where the earned ceiling is already at the cap. As a flat addition it is worth
 * the same 1.5x of nominal wherever you are, which is a large fraction of a slow
 * craft's speed and a decisive one at the top.
 *
 * MIN_CHARGE stops the meter being tapped at a dribble. Below a fifth there is
 * not enough there to be worth an animation, let alone a corner. */
const BOOST_ADD = 1.5;
const BOOST_DRAIN = 1 / (2.6 * 60);
const BOOST_MIN_CHARGE = 0.2;
/** Extra throttle while boosting, so the craft actually reaches the raised
 *  ceiling within the couple of seconds the meter lasts. */
const BOOST_ACCEL = 5;

/** Fraction of any excess over the ceiling shed per frame. A pad can put the
 *  craft above what it has earned; this is how that settles back, and it is slow
 *  enough — about three seconds to halve — that a pad chain keeps you flying. */
const OVERDRIVE_BLEED = 0.008;

/** How long the hit-flash lasts when a pad fires, in frames. Three is a strobe;
 *  much more and it reads as damage rather than as a kick. */
const FLASH_FRAMES = 3;

/** Pixel scale the 88x58 craft is drawn at. Three rather than upstream's two
 *  because the canvas went from 800 to 1280 wide: at 2x the craft dropped from a
 *  fifth of the frame to an eighth, which on a full-screen presentation reads as
 *  a distant object rather than as the thing you are flying. */
const SHIP_SCALE = 3;

export interface CarConfig {
  scene: RoadScene;
  ship: ShipSpec;
  x: number;
  y: number;
}

export default class Car extends Phaser.GameObjects.Sprite {
  declare scene: RoadScene;

  /** Current speed, in world units per frame. */
  speed = 0;
  /** The reference speed. NOT a ceiling any more — see the note above. */
  baseMaxSpeed: number;
  /** Rates. Upstream tuned these by feel against a ceiling that never moved;
   *  `accel` is now roughly half what it was, because a throttle that reaches the
   *  ceiling in two seconds makes the first half of every speed band a formality
   *  and leaves the climb entirely to the surge ladder. At 0.55 the craft takes
   *  about four seconds to reach nominal from a standstill, which is long enough
   *  that pulling away is something the player does rather than watches. */
  accel = 0.55;
  breaking = 2;
  decel = 1.2;
  offRoadDecel: number;
  /** The speed below which the craft counts as not really driving. Used as the
   *  threshold for earning grip, so grip cannot be accumulated by idling on the
   *  start line — it is NOT the off-trail cap any more; see offRoadCeiling. */
  crawlSpeed: number;
  /** Per-frame speed lost while off the road, until the off-trail ceiling.
   *
   *  Upstream declares `offRoadDecel` and never reads it, because it inherited
   *  the field from javascript-racer without the `dt`-scaled loop that used it.
   *  Applying that value per frame would stop the car dead inside one frame, so
   *  this is the same intent expressed at this port's frame rate: about half a
   *  second from top speed down to the crawl. */
  offRoadDrag: number;

  /** Amplitude of the idle bob. Upstream declares both and uses neither; here
   *  they are the difference between the hum of swept bedrock and the judder of
   *  loose regolith, which is the cheapest possible "you are off the trail"
   *  signal and the one the player feels before they read anything.
   *
   *  Both scale with speed in `bob()`. At six times nominal a one-pixel tremble
   *  is not a ride, and the shake is most of what sells the speed once the road
   *  itself is moving too fast to read. */
  driveRumble = 1;
  offRoadRumble = 3;

  /** Idle hover: how far the craft rises and falls at a standstill, and how
   *  fast. A hovercraft holds itself off the ground whether or not it is going
   *  anywhere, and a craft that sits dead still under the starting lights looks
   *  like a parked object rather than a floating one — which is the one moment
   *  in the run the player is looking straight at it with nothing else to do.
   *
   *  Slow and small: a two-and-a-half-second cycle of three pixels. Any faster
   *  and it reads as an engine misfiring rather than as a machine idling. */
  hoverAmp = 3;
  hoverRate = 0.042;
  private hoverPhase = 0;

  /** Whether the craft is between the verges. The scene decides and tells us. */
  onRoad = true;
  /** Earned share of the nominal top speed, GRIP_MIN..GRIP_MAX. */
  grip = GRIP_MIN;
  /** Earned multiplier ON TOP of that, 0..SURGE_MAX. */
  surge = 0;
  /** The boost meter, 0..1. Filled by pads, spent by Shift. */
  boostCharge = 0;
  private boosting = false;

  alive = true;
  localScale: number;
  /** Resting screen Y, restored whenever the idle bob drifts past a pixel. */
  startY: number;

  /** The chosen craft: its stats and its art. */
  readonly ship: ShipSpec;
  /** Which way the craft is leaning, and therefore which texture it is wearing.
   *  Held so `setSteer()` can skip the swap when nothing has changed — a
   *  `setTexture()` every frame is a wasted upload sixty times a second. */
  private steer: SteerLevel = 0;
  private flash = 0;

  constructor(config: CarConfig) {
    super(config.scene, config.x, config.y, shipFrame(config.ship, 0));

    config.scene.add.existing(this);
    this.ship = config.ship;

    this.baseMaxSpeed = (config.scene.segmentLength / 1.5) * config.ship.top;
    this.offRoadDecel = -this.baseMaxSpeed / 2;
    this.crawlSpeed = this.baseMaxSpeed / 4;
    this.offRoadDrag = this.baseMaxSpeed / 45;

    /* Upstream reads `config.scene.cameraDepth`, which does not exist — camera
       depth lives on `renderSettings` — so this was NaN there. Nothing reads
       it either way; sourced correctly here rather than preserving the typo. */
    this.localScale = config.scene.renderSettings.cameraDepth / config.scene.playerZ;

    this.setScale(SHIP_SCALE);
    this.x = this.scene.renderSettings.width / 2;
    /* Sits the craft's bottom edge exactly on the bottom of the canvas — where
       its contact shadow is drawn. Upstream wrote `height - this.height`, which
       only lands there at a scale of exactly 2; at any other scale it hangs the
       craft off the bottom of the frame by half the difference. */
    this.y = this.scene.renderSettings.height - (this.height * SHIP_SCALE) / 2;
    this.startY = this.y;
  }

  /** The absolute ceiling. Nothing — throttle, boost or downhill — puts the
   *  craft past this. Reachable only with the ladder fully climbed AND the boost
   *  lit; see the note on BOOST_ADD. */
  get absMaxSpeed(): number {
    return this.baseMaxSpeed * (1 + SURGE_MAX + BOOST_ADD * this.ship.boost);
  }

  /** Whether the boost is burning right now. Read by the scene for the camera
   *  and by the HUD for the meter. */
  get isBoosting(): boolean {
    return this.boosting;
  }

  /** A pad passed under the craft. */
  addCharge(amount: number): void {
    this.boostCharge = Math.min(1, this.boostCharge + amount);
  }

  /**
   * Told each frame whether the player is asking for boost.
   *
   * @returns true if it actually lit this frame — which it does not if the meter
   *   is below MIN_CHARGE, so the caller can tell "fired" from "tried".
   */
  setBoosting(want: boolean): boolean {
    const wasBoosting = this.boosting;
    if (want && !wasBoosting && this.boostCharge >= BOOST_MIN_CHARGE) this.boosting = true;
    if (!want) this.boosting = false;

    if (this.boosting) {
      this.boostCharge = Math.max(0, this.boostCharge - BOOST_DRAIN);
      if (this.boostCharge <= 0) this.boosting = false;
    }
    return this.boosting && !wasBoosting;
  }

  /** Speed as a multiple of nominal: 1 at the old top speed, up to 6 now. The
   *  scene steers, drifts and zooms the camera off this. */
  get speedFraction(): number {
    return this.speed / this.baseMaxSpeed;
  }

  /** What the throttle could reach if the craft were on the trail, boost
   *  included. */
  get roadMaxSpeed(): number {
    const earned = this.baseMaxSpeed * this.grip * (1 + this.surge);
    const lit = this.boosting ? this.baseMaxSpeed * BOOST_ADD * this.ship.boost : 0;
    return Math.min(this.absMaxSpeed, earned + lit);
  }

  /** What it can reach out in the regolith — a share of the above, never below
   *  the floor. See the note on OFF_ROAD_SHARE. */
  get offRoadCeiling(): number {
    return Math.max(this.baseMaxSpeed * OFF_ROAD_FLOOR, this.roadMaxSpeed * OFF_ROAD_SHARE);
  }

  /** The ceiling the throttle can reach right now, on whichever surface the
   *  craft is currently on. */
  get currentMaxSpeed(): number {
    return this.onRoad ? this.roadMaxSpeed : this.offRoadCeiling;
  }

  /**
   * Told once per frame which surface the craft is on, and the one place
   * per-frame housekeeping happens.
   *
   * Both halves of the penalty live here rather than in `accelerate()`, because
   * the drag has to apply whether or not the player is on the throttle —
   * coasting onto the verge has to cost you exactly as much as powering onto it.
   */
  setSurface(onRoad: boolean): void {
    this.onRoad = onRoad;
    this.bob();

    if (this.flash > 0 && --this.flash === 0) {
      this.clearTint();
      this.setTintMode(Phaser.TintModes.MULTIPLY);
    }

    /* Overdrive: a pad can leave the craft above what it has earned, and this is
       how that settles back. Proportional rather than a flat rate, so a big
       overshoot bleeds off fast and the last of it lingers. */
    if (this.speed > this.currentMaxSpeed) {
      this.speed = Math.max(this.currentMaxSpeed, this.speed - (this.speed - this.currentMaxSpeed) * OVERDRIVE_BLEED);
    }

    if (onRoad) {
      /* Grip is earned by driving, not by idling on the start line. */
      if (this.speed > this.crawlSpeed) {
        this.grip = Math.min(GRIP_MAX, this.grip + GRIP_GAIN * this.ship.grip);
      }
      /* Surge only while pressed against the ceiling — see SURGE_BITE — and
         slower the more of it you already have; see SURGE_TAPER. */
      if (this.speed >= this.currentMaxSpeed * SURGE_BITE) {
        this.surge = Math.min(
          SURGE_MAX,
          this.surge + (SURGE_GAIN * this.ship.grip) / (1 + this.surge * SURGE_TAPER),
        );
      }
      return;
    }

    this.grip = Math.max(GRIP_MIN, this.grip - GRIP_LOSS);
    this.surge = Math.max(0, this.surge - SURGE_LOSS);
    if (this.speed > this.offRoadCeiling) {
      /* The flat drag was tuned against a 133-unit top speed and takes four
         seconds to shed six times that — long enough to cross the whole verge
         and rejoin having lost almost nothing. Whichever is harsher wins, so the
         penalty stays proportional at any speed rather than depending on where
         on the ladder you happened to be. */
      this.speed = Math.max(
        this.offRoadCeiling,
        this.speed - Math.max(this.offRoadDrag, this.speed * OFF_ROAD_DRAG_RATE),
      );
    }
  }

  /** Strobe the craft. Called by the scene when the first segment of a pad fires,
   *  not on every segment of it, or a long pad flickers. */
  flashBoost(): void {
    this.flash = FLASH_FRAMES;
    this.setTint(0xdff8ff);
    this.setTintMode(Phaser.TintModes.FILL);
  }

  /** How hard the craft is currently leaning. Read by `exhaust.ts`, which has to
   *  pin its flames to whichever frame is on screen. */
  get steerDir(): SteerLevel {
    return this.steer;
  }

  /**
   * Lean the craft: 0 level, ±1 banking, ±2 banking hard.
   *
   * This is a texture swap, not a rotation. The five frames are drawn as five
   * views of the same craft (see `buildHover` in the art script), so each bank
   * comes with its own foreshortening, its own fin silhouette, its own vectored
   * exhaust and its own asymmetric thruster flare — the outboard engine burns
   * harder, because differential thrust is how a craft with no wheels turns.
   * Rotating one sprite would have given none of that, and would have spun the
   * lift wash and the contact shadow with the hull. Those stay on the ground.
   */
  setSteer(level: SteerLevel): void {
    if (level === this.steer) return;
    this.steer = level;
    this.setTexture(shipFrame(this.ship, level));
  }

  /**
   * The ride: wander either side of rest, and snap back the moment the wander
   * exceeds the amplitude, so it never walks off up the screen.
   *
   * Upstream ran this inside `accelerate()`, which meant the car only shook
   * while the throttle was held — and, now that the amplitude carries the
   * off-road signal, would have meant coasting onto the verge looked identical
   * to coasting down the middle of it. It belongs on every frame the craft is
   * moving, whatever the player is doing with the keys.
   */
  private bob(): void {
    /* Standing still: a smooth sine, not the random jitter below. Randomness
       reads as vibration and vibration is what a thing under load does; an idle
       craft should breathe. */
    if (this.speed <= 0.5) {
      this.hoverPhase += this.hoverRate;
      this.y = this.startY + Math.sin(this.hoverPhase) * this.hoverAmp;
      return;
    }
    /* Amplitude grows with speed, but on a square root: linear, the ride at six
       times nominal was a sprite vibrating six pixels either way, which reads as
       a rendering fault rather than as velocity. */
    const scale = Math.sqrt(Math.max(1, this.speedFraction));
    const amp = Math.round((this.onRoad ? this.driveRumble : this.offRoadRumble) * scale);
    if (this.y >= this.startY + amp || this.y <= this.startY - amp) this.y = this.startY;
    else this.y += Phaser.Math.Between(-amp, amp);
  }

  accelerate(): void {
    if (this.speed < this.currentMaxSpeed) this.speed += this.accel * (this.boosting ? BOOST_ACCEL : 1);
  }

  decelerate(): void {
    if (this.speed > 0) this.speed -= this.decel;
    else this.speed = 0;
  }

  /* `break` is a reserved word but a legal method name, and it is the name
     upstream gave it. Kept so the two files read the same. */
  break(): void {
    if (this.speed > 0) this.speed -= this.breaking;
    else this.speed = 0;
  }
}
