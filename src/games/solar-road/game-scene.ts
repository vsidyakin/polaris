/* SOLAR CIRCUIT — the game scene.
 *
 * A port of Phaser3-Road's `src/scenes/gameScene.js`, which is a Phaser 3
 * rendering of Jake Gordon's javascript-racer. The whole engine is here: the
 * track builder, the per-frame projection, the backdrop and the surface model.
 *
 * How it works, in one paragraph. The track is a flat array of segments, each
 * 200 units long, each carrying a curve strength, a world-space height and a
 * road half-width at either end. The camera sits at `renderSettings.position`
 * along that array and the next 300 segments are projected far-to-near; `maxy`
 * tracks the highest thing drawn so far, so a segment hidden behind a hill in
 * front of it is skipped rather than painted over. Steering does not move the
 * car — it moves `playerX`, which the projection subtracts from every road
 * point, so the road slides under a car pinned to the centre of the screen.
 * `increase()` wraps the camera position at the end of the array, which is what
 * makes the track a loop.
 *
 * Seven things here are not upstream, and each is marked where it happens:
 *
 *   - the backdrop is two tiling layers with parallax, not one static sprite
 *   - segments carry their own width, so the trail narrows and widens
 *   - the surface under the craft is tested every frame and handed to Car
 *   - no roadside props are placed (see buildSprites)
 *   - the frame's travel is walked in SUB-STEPS (see advance), which is what
 *     lets the speed ceiling climb without the engine losing track of where the
 *     craft has been
 *   - segments can carry a boost pad, detected on entry (see enterSegment)
 *   - the camera eases back and opens its field of view with speed (see
 *     updateCamera), so `cameraDepth` and `playerZ` are per-frame values rather
 *     than constants settled in build()
 *
 * The scene reads `this.cursors` rather than Phaser's own cursor keys; see
 * input.ts for why the site owns the keyboard here.
 */

/* A value import, not a type one — see the note in boot-scene.ts. */
import Phaser from "phaser";
import Car from "./car";
import RoadMath, { type RoadPoint } from "./math-helpers";
import RoadRenderer, { type RoadColor } from "./render-helpers";
import { getInput, type RoadCursors } from "./input";
import { SCENE } from "./boot-scene";
import { PROJECT_SPAN, VIEW } from "./view";
import { SELECTION_KEY, type Selection } from "./menu-scene";
import { SHIPS, type ShipSpec, type SteerLevel } from "./ships";
import { TRACKS, WIDTH, buildPieces, type TrackSpec } from "./tracks";
import Exhaust from "./exhaust";
import Hud, { type RacePhase } from "./hud";
import Minimap from "./minimap";
import Slipstream from "./slipstream";
import WarpField from "./warp";
import { FINISH_BAND, sampleTerrain, scatterBoostPads, START_BAND, type BoostPadSlice } from "./terrain";

/** A billboard or parked car pinned to a segment, `offset` in road half-widths
 *  (-1 is the left verge, +1 the right). Nothing places these any more; see
 *  buildSprites() for why the machinery stayed. */
export interface SegmentSprite {
  key: string;
  offset: number;
  spriteRef: Phaser.GameObjects.Sprite;
}

export interface RoadSegment {
  index: number;
  p1: RoadPoint;
  p2: RoadPoint;
  /** Road half-width at p1 and at p2. w2 of one segment is always w1 of the
   *  next, which is what lets the road change width with no seam. */
  w1: number;
  w2: number;
  sprites: SegmentSprite[];
  cars: unknown[];
  curve: number;
  color: RoadColor;
  /** Rubble-bank shape for this segment; see terrain.ts. Assigned by
   *  paintTerrain() once the track length is known. */
  bermOut: number;
  bermIn: number;
  /** This segment's slice of a boost pad, or null for the vast majority that
   *  carry none. Assigned by buildRoad() after the terrain pass. */
  pad: BoostPadSlice | null;
  /** Row index within the starting grid, or -1 for everything that is not part
   *  of it. See renderSegment. */
  checker: number;
  /** Set each frame by updateRoad(), not by the builder. */
  looped: boolean;
  fog: number;
  clip: number;
}

export interface RenderSettings {
  width: number;
  height: number;
  /** Computed in build(). */
  resolution: number;
  fieldOfView: number;
  cameraHeight: number;
  /** Computed in build() from the field of view. */
  cameraDepth: number;
  drawDistance: number;
  /** Camera Z along the track; add playerZ for the car's absolute position. */
  position: number;
  fogDensity: number;
}

const newPoint = (y: number, z: number): RoadPoint => ({
  world: { y, z },
  camera: { x: 0, y: 0, z: 0 },
  screen: { x: 0, y: 0, w: 0, scale: 0 },
});

/* --- backdrop ---------------------------------------------------------------
 * Both layers are 1600px-wide textures tiled across an 800px viewport, scrolled
 * with tilePositionX. Two of them, at different rates, is the whole parallax:
 * the ridge is "near" and swings about three times as far as the sky, which is
 * what sells the distance between them.
 *
 * Each layer takes two inputs. CURVE accumulates as the track bends, so a long
 * right-hander swings the horizon left the whole way through it. STEER is a
 * direct offset from the car's position across the road, so moving the car left
 * and right shifts the view even on a dead straight — that one is small, but it
 * is what makes the backdrop feel attached to the car rather than to the track.
 *
 * LIFT drops the ridge as the track climbs, so cresting a rise reveals sky.
 * It is clamped because the course gains a lot of absolute height over a lap
 * and unclamped it would walk the horizon off the bottom of the screen. */
/** The sky layer runs from the top of the canvas down to the horizon, and the
 *  horizon is at exactly half the canvas height — that is where every projected
 *  point converges as z goes to infinity, whatever the camera is doing. The sky
 *  texture is generated at this height for the same reason: a TileSprite taller
 *  than its texture repeats it, which would put a second star field and a second
 *  sun limb in the upper half of the frame. */
const SKY_H = VIEW.H / 2;
const RIDGE_H = 200;
/** Ridge top when the track is at zero elevation. Its bottom then sits 30px
 *  below the horizon, so the vertical bob can never open a gap between the
 *  silhouette and the ground. */
const RIDGE_Y = SKY_H + 30 - RIDGE_H;

const SKY_CURVE = 0.5;
const RIDGE_CURVE = 1.3;
const SKY_STEER = 18;
const RIDGE_STEER = 46;
const RIDGE_LIFT = 0.00025;
const RIDGE_LIFT_MAX = 14;

/**
 * How big anything pinned to a segment is drawn, relative to its projected
 * scale. Upstream used 2000, tuned for its 119px billboards.
 *
 * Nothing is pinned to a segment at the moment — see buildSprites() — so this
 * currently scales nothing. It is kept with the rest of that machinery, and
 * 1200 is the value that suited props at the size this game draws them.
 */
const PROP_SCALE = 1200;

/* --- travel ------------------------------------------------------------------
 * Upstream advances the camera in `update()` AND again inside `updateRoad()`, so
 * the track passes at twice the car's nominal speed. It is a duplicate line
 * rather than a deliberate multiplier, but the whole feel of the game is tuned
 * around it — so the doubling stays and is now stated once, as a constant, with
 * one advance per frame instead of two.
 *
 * Consolidating was not tidiness. Boost pads and the surface test are both
 * "what did the craft pass through this frame" questions, and with two hidden
 * advances there were two answers: `updateRoad()` projected the world from a
 * position half a frame's travel ahead of the segment it had just decided the
 * camera was in. One advance means one position, which is the only version of
 * the frame a collision test can be asked about. */
const TRAVEL_PER_FRAME = 2;

/** Longest single step `advance()` will take, as a fraction of a segment.
 *
 * THIS IS THE INVARIANT THE WHOLE ENGINE RESTS ON. `findSegment()` answers
 * "where am I" by dividing position by segment length, and every event in the
 * game — the surface under the craft, a boost pad, the lap marker — is detected
 * by noticing the answer has changed. Move further than one segment between
 * observations and events are not late, they are GONE: the segment was never the
 * answer at any moment anybody looked.
 *
 * Upstream guaranteed this by capping the speed at two thirds of a segment per
 * frame. Capping the speed is exactly what this change is about, so the
 * guarantee moved here instead: however fast the craft goes, the frame's travel
 * is walked in steps of at most half a segment and every segment between where
 * it was and where it ends up is observed in order. At the top of the ladder
 * that is sixteen steps a frame, each one an add and an array index. */
const MAX_STEP_SEGMENTS = 0.5;

/* --- steering ----------------------------------------------------------------
 * Upstream's authority is `0.1 * speed / maxSpeed / 4`, i.e. proportional to
 * speed with no ceiling. That is fine when speed has one, and unplayable when it
 * does not: at six times nominal it put the craft from the centre line to the
 * verge in seven frames, which is not steering, it is teleporting.
 *
 * So authority RAMPS IN and then saturates. Parked, the controls still do
 * nothing — the property upstream's version had and worth keeping. By 40% of
 * nominal speed they are fully in, and past that they stop growing, so the
 * absolute rate of lateral movement is the same at six times nominal as at one.
 * Relative to a trail arriving six times faster it feels far tighter, which is
 * the right kind of difficult: the craft always answers the same way, you simply
 * have less time to ask.
 *
 * STEER_RATE is nearly twice upstream's effective rate and the ramp comes in a
 * third sooner. This is the dial that actually decides whether a mistake is
 * recoverable — a wider trail gives you more room to be wrong in, but only a
 * faster craft can use it — and it is the one to turn first if the handling
 * still feels heavy.
 *
 * DRIFT is the other half. Curves throw the craft towards their outside edge and
 * that has to get worse with speed or the ladder has no cost — but upstream's
 * term is proportional to speed SQUARED (authority already carried one factor of
 * speed), and squared it puts you in the regolith the moment you touch a bend at
 * the top of the ladder. On a square root it is about two and a half times its
 * nominal-speed value at six times nominal: demanding, survivable, and still the
 * thing that decides whether the ladder was worth climbing.
 *
 * DRIFT_RATE IS ITS OWN CONSTANT, AND THAT IS A BUG FIX
 *
 * The drift term used to be written as a multiple of `dx`, the steering step —
 * which is upstream's shape, and which quietly makes the two inseparable. Every
 * increase in steering authority raised the centrifugal drift by exactly the
 * same factor, so turning STEER_RATE up did nothing at all for the player's
 * ability to hold a line: they got a bigger correction and an equally bigger
 * thing to correct. Two requests to make the craft turn better had gone into
 * that dial before it was spotted.
 *
 * Stated separately, the two are independent: STEER_RATE is what the player can
 * do, DRIFT_RATE is what the corner does to them. DRIFT_RATE is set to the value
 * upstream's expression produced at nominal top speed, so the corner still bites
 * exactly as hard as it always did. */
const STEER_RATE = 0.075;
const STEER_FULL = 0.32;
/** Frames a turn must be held before the craft goes to its hard-bank frame. */
const HARD_LEAN_FRAMES = 20;
const DRIFT_RATE = 0.00625;

/* --- boost pads --------------------------------------------------------------
 * Per SEGMENT of pad crossed, not per pad: a five-segment plate taken square
 * down the middle is worth all five, and clipping the corner of one is worth
 * what you clipped. Nothing has to special-case a partial hit.
 *
 * TOLERANCE is a tenth of a half-width of forgiveness either side of the plate,
 * because the plate the player is aiming at is drawn in projection and the one
 * they are being tested against is a number; at the fog line those disagree by a
 * pixel or two, and the disagreement should favour the player. */
const PAD_TOLERANCE = 0.1;
/* Meter filled per SEGMENT of pad crossed, so a whole five-segment plate taken
 * square is worth a fifth of a full charge and clipping the corner of one is
 * worth what you clipped. Five clean pads fill the meter.
 *
 * It was double this to begin with, which made a full boost two and a half pads
 * — close enough to "every pad is a boost" that the meter was not really a
 * resource, only a slower way of applying one. At a fifth each, a full charge is
 * most of a stage's pads, so spending it is a decision.
 *
 * Pads used to hand out speed directly — a kick and a rung of the surge ladder,
 * both applied whether the player wanted them or not. Filling a meter instead is
 * what turns a pad from something you drive over into something you plan around:
 * the question stops being "did I hit it" and becomes "where am I going to spend
 * it", which is worth asking on a course with a hairpin at the end of every
 * stage. See the note on BOOST_ADD in car.ts. */
const PAD_CHARGE = 0.04;


/* --- the camera, and what speed does to it -----------------------------------
 * As the craft gets faster the camera eases back, lifts, and opens its field of
 * view. All three are small — 12 degrees, a third again of height, a fifth of
 * pull-back — and all three are doing the same job: at the top of the ladder the
 * near field is a blur that carries no information, so the shot has to give the
 * player more of the middle distance, which is where the trail still resolves
 * into a line you can steer.
 *
 * WHAT NOT TO DO HERE: none of these may be stepped. `cameraDepth` scales every
 * projected point, so a jump in the field of view is a jump in the whole world,
 * and `playerZ` moves where the craft is judged to BE along the track. The zoom
 * therefore chases its target on a lerp rather than tracking speed directly, and
 * ZOOM_EASE is slow enough that punching a pad chain opens the shot over about a
 * second instead of snapping it.
 *
 * The horizon does not move under any of this, which is what makes it safe: as z
 * goes to infinity the projected scale goes to zero and every point converges on
 * height/2 whatever the depth or the camera height. That is 300 — exactly where
 * the sky texture's bottom edge sits — so the backdrop stays welded to the
 * horizon through the entire range. */
const FOV_BASE = 100;
const FOV_TOP = 118;
const CAM_HEIGHT_BASE = 1000;
const CAM_HEIGHT_TOP = 1420;
const PULLBACK_TOP = 0.38;

/* Segments projected per frame. More of them is literally more view distance —
 * `exponentialFog` measures its falloff as a fraction of this, so raising it
 * stretches the fog curve as well as extending the cut behind it, and the
 * horizon recedes instead of the far end simply appearing out of a grey wall.
 *
 * It is the one thing here with a real per-frame cost: every extra segment is
 * two projections and a fill. Four hundred and forty at the top of the ladder is
 * about a third more work than the flat three hundred, at the only speed where
 * the player can actually see that far. */
const DRAW_BASE = 300;
const DRAW_TOP = 440;

/* --- the trail widens with speed ---------------------------------------------
 * At the top of the ladder the trail is half again as wide as it is drawn in the
 * track data. This is not scenery: `playerX` is normalised to half-widths, so
 * widening the world and holding the craft's LATERAL SPEED IN WORLD UNITS
 * constant means the same steering input covers proportionally less of the
 * trail. Which is the point — at six times nominal the player needs somewhere to
 * put a mistake.
 *
 * WHICH OF THE TWO LATERAL RATES IT DIVIDES IS THE WHOLE POINT
 *
 * It went onto both the steering step and the centrifugal drift at first, on the
 * reasoning that a wider trail should take proportionally longer to cross. That
 * is true and it is useless: dividing both leaves the ratio of control to
 * disturbance exactly where it was, so the trail got wider and holding a line at
 * six times nominal was precisely as hard as before.
 *
 * It now divides the DRIFT only. The player keeps their full steering rate in
 * normalised terms while the corner's push shrinks with the extra width, so the
 * trail opening up as the craft speeds up is a genuine reprieve rather than a
 * cosmetic one. The other half of that reprieve comes free from the existing
 * "hold world position through a width change" rescale in update(): as the trail
 * widens, the craft's normalised position slides towards the centre line while
 * staying exactly where it is in the world.
 *
 * It still has to be applied to the projection and to the half-width the craft's
 * position is measured against, or the drawn verge and the physical one part
 * company. */
const WIDTH_BOOST_TOP = 1.85;
/** Speed fractions the zoom eases between: none of it below the first, all of it
 *  at the second. Starting just under nominal top speed keeps the opening lap
 *  looking exactly as it did. */
const ZOOM_FROM = 0.9;
const ZOOM_TO = 5;
const ZOOM_EASE = 0.035;

/* --- the race ----------------------------------------------------------------
 * SOLAR CIRCUIT was a loop until Aug 2026: `increase()` wrapped the camera at
 * the end of the segment array and the course simply came round again, with no
 * objective beyond staying on it. It is now a time trial from Point A to Point B
 * and the whole shape of the thing follows from that.

/** Segments of black-and-white checker on the start line. Six is about a metre
 *  of grid at the scale everything else here is drawn at — long enough to read
 *  as a surface the craft is standing on rather than as a painted stripe. */
const GRID_ROWS = 6;

/* --- the countdown -----------------------------------------------------------
 * Three lights at one-second intervals, and the third one is GO.
 *
 * The clock and the player's control both start on green, so the countdown is
 * not merely decorative: it is the second and a bit of stillness a time trial
 * needs before it starts, and the reason the stopwatch can begin at zero on a
 * craft that is already allowed to move. What it replaced was a "hold ↑ to
 * launch" prompt, which started the clock on the player's own keypress and so
 * quietly rewarded whoever happened to be holding the key already. */
const COUNT_STEPS = [45, 105, 165];
/** Frames the green lamp stays up after the race has started. Long enough to
 *  register, short enough to be gone before the first corner. */
const COUNT_LINGER = 45;

/**
 * What the game asks the site to play.
 *
 * The game synthesises nothing itself, deliberately. The site owns the audio
 * graph — one context, one master gain, one mute — and a game that opened its
 * own would be a second sound source the site's mute button could not reach. So
 * the scene reports what is happening and the host decides what it sounds like.
 * Every method is optional: a host that passes none gets a silent game, not a
 * broken one.
 */
export interface RoadAudio {
  /** Once per frame. 0 at rest, 1 at the top of the speed ladder. */
  engine?(power: number): void;
  /** Once per boost pad entered — not once per segment of one. */
  boost?(): void;
  /** Once, on the frame the player lights the boost. */
  boostFire?(): void;
  /** Once per countdown lamp: 0 red, 1 amber. */
  countLight?(step: number): void;
  /** Once, on green. */
  raceStart?(): void;
  /** Once, on crossing Point B. */
  raceFinish?(): void;
  /**
   * Whether the engine should be making any sound at all.
   *
   * Separate from `engine(power)` because "idling at zero power" and "silent"
   * are different states and the countdown needs the second one. A craft sitting
   * on the line under a red light has not started its engine yet; a drone under
   * the countdown makes the lights look like a formality and steps on the three
   * notes that are the only thing the player should be listening to.
   */
  engineOn?(on: boolean): void;
}

/** Registry key the mount uses to hand the scene its audio hooks. Same
 *  arrangement as the input handle in input.ts, and for the same reason: Phaser
 *  constructs the scene, so anything the host wants to give it has to be left
 *  somewhere the scene can find. */
export const AUDIO_KEY = "solar-road-audio";

export class RoadScene extends Phaser.Scene {
  renderSettings!: RenderSettings;

  /** The one piece of course vocabulary the scene still owns: the run-out that
   *  closes a course off. Everything else moved to tracks.ts when courses stopped
   *  being written by hand. */
  readonly RUNOUT_CURVE = 2;

  /* --- what is being raced, and in what ---------------------------------------
   * Handed over by the menu through the registry, because Phaser constructs the
   * scene and there is nowhere else to put them. Both fall back to the first
   * entry on their roster, so the game scene is still startable on its own — a
   * useful property when debugging one course and a necessary one if the menu
   * ever fails to hand anything over. */
  ship: ShipSpec = SHIPS[0]!;
  track: TrackSpec = TRACKS[0]!;

  segments: RoadSegment[] = [];
  segmentSprites: Phaser.GameObjects.Sprite[] = [];

  /** The road's base half-width — the road spans -w to +w, which keeps the
   *  projection maths symmetrical. Individual segments override it. */
  roadWidth = WIDTH.NORMAL;
  segmentLength = 200;
  /** Segments per rumble band. */
  rumbleLength = 3;
  trackLength = 0;
  lanes = 3;

  /** Player offset from the centre line, in road half-widths, so ±1 is always
   *  the edge of the road however wide the road happens to be here. */
  playerX = 0;
  playerY = 0;
  /** Player's z distance ahead of the camera. Computed in build(). */
  playerZ = 0;
  /** How hard a curve throws the craft towards its outside edge. Eased from
   *  upstream's 1.2: the course now has curves half again as hard as anything
   *  upstream could build, and the same coefficient over a HUGE curve at four
   *  times nominal speed was not a corner to be driven but a corner to be
   *  survived. */
  centrifugal = 0.95;

  /** Last frame's half-width under the craft, so a narrowing trail can push the
   *  craft outwards. See the note in update(). */
  private lastHalfWidth = 0;

  /** Segment the craft was last observed in, so `advance()` can tell entering a
   *  new one from staying put. -1 until the first step. */
  private lastSegmentIndex = -1;
  /** Whether the craft was on a pad at that observation, so the flash and the
   *  shake fire once on arrival rather than once per segment of plate. */
  private onPad = false;
  /** Eased 0..1 camera zoom; see the camera constants. */
  private zoom = 0;
  /** 0..1 clock driving the chevron that runs along every boost pad. */
  private padScroll = 0;

  /* --- race state --- */
  private phase: RacePhase = "countdown";
  /** Frames since the scene opened, while the lights are running. */
  private countFrames = 0;
  /** Lamps lit so far, so the sound fires once per light rather than per frame. */
  private lit = 0;
  /** Whether the engine has been told to run, so it is told only on the change. */
  private engineLit = false;
  /** Frames since the launch. The clock, and the only thing being raced. */
  private raceFrames = 0;
  /** Camera distance covered since the line, for the course map's progress. */
  private travelled = 0;
  /** Debounce on R, so holding it down does not restart every frame. */
  private restartHeld = false;
  /** Which way the player was steering last frame, and for how many frames, so a
   *  sustained turn can escalate to the hard-bank art. */
  private lastSteerDir = 0;
  private steerHeld = 0;
  /** Multiplier on every trail width this frame; see WIDTH_BOOST_TOP. */
  private widthScale = 1;

  private audio: RoadAudio = {};

  exhaust!: Exhaust;
  slipstream!: Slipstream;
  minimap!: Minimap;
  warp!: WarpField;
  hud!: Hud;

  sky!: Phaser.GameObjects.TileSprite;
  ridge!: Phaser.GameObjects.TileSprite;
  private skyOffset = 0;
  private ridgeOffset = 0;
  /* The TEXTURE widths, which are not the sprite widths.
   *
   * `tilePositionX` is measured in texture space and repeats every texture
   * width, so that is what the scroll accumulators have to wrap at. A
   * TileSprite's `width` is its *display* width — 800 here, the viewport — and
   * wrapping at that would reset the offset halfway through the 1600px texture
   * and jump the whole backdrop sideways. Read from the loaded image rather
   * than hardcoded, so regenerating the art at another size cannot desync it. */
  private skyTexW = 1;
  private ridgeTexW = 1;

  graphics!: Phaser.GameObjects.Graphics;
  utils!: RoadMath;
  render!: RoadRenderer;
  cursors!: RoadCursors;
  playerCar!: Car;

  constructor() {
    super({ key: SCENE.GAME });
  }

  create(): void {
    /* What the menu chose. Both fall back to the head of their roster, so the
       game scene remains startable on its own — useful when debugging one course
       and necessary if the menu ever hands nothing over. */
    const sel = this.registry.get(SELECTION_KEY) as Selection | undefined;
    this.ship = SHIPS.find((s) => s.id === sel?.shipId) ?? SHIPS[0]!;
    this.track = TRACKS.find((t) => t.id === sel?.trackId) ?? TRACKS[0]!;

    this.renderSettings = {
      width: VIEW.W,
      height: VIEW.H,
      resolution: 0,
      fieldOfView: FOV_BASE,
      cameraHeight: CAM_HEIGHT_BASE,
      cameraDepth: 0,
      drawDistance: 300,
      position: 0,
      fogDensity: 10,
    };

    /* Rebuilt from scratch on every create(), so restarting the scene does not
       append a second track onto the first. */
    this.segments = [];
    this.segmentSprites = [];
    this.playerX = 0;
    this.skyOffset = 0;
    this.ridgeOffset = 0;
    this.lastHalfWidth = 0;
    this.lastSegmentIndex = -1;
    this.onPad = false;
    this.zoom = 0;
    this.widthScale = 1;
    this.padScroll = 0;
    this.phase = "countdown";
    this.countFrames = 0;
    this.lit = 0;
    this.engineLit = false;
    this.raceFrames = 0;
    this.travelled = 0;
    this.restartHeld = false;
    this.lastSteerDir = 0;
    this.steerHeld = 0;

    this.utils = new RoadMath();
    this.render = new RoadRenderer(this);

    /* Depth order is add order: sky, ridge, road, car. */
    this.sky = this.add.tileSprite(0, 0, VIEW.W, SKY_H, "sky").setOrigin(0, 0);
    this.ridge = this.add.tileSprite(0, RIDGE_Y, VIEW.W, RIDGE_H, "ridge").setOrigin(0, 0);
    this.skyTexW = this.textures.get("sky").getSourceImage().width;
    this.ridgeTexW = this.textures.get("ridge").getSourceImage().width;

    this.graphics = this.add.graphics({ x: 0, y: 0 });
    this.cameras.main.setBackgroundColor(this.render.COLORS.SKY);

    this.cursors = getInput(this).cursors;
    this.audio = (this.registry.get(AUDIO_KEY) as RoadAudio | undefined) ?? {};

    this.build();

    /* Depth is add order, and every line of it is deliberate. The exhaust goes
       UNDER the craft, so the hull stays crisp and the flame flares out around
       it. The slipstream and the warp layer go OVER it, because a spark or a
       streak flying at the camera has to cross whatever is between it and the
       camera — and the slipstream sits under the warp so the tunnel dims its
       sparks at the frame edge along with everything else. The HUD is last
       because a score behind a tunnel is not a score. */
    this.exhaust = new Exhaust(this);
    this.playerCar = new Car({ scene: this, ship: this.ship, y: 0, x: 0 });
    this.slipstream = new Slipstream(this);
    this.warp = new WarpField(this);
    this.minimap = new Minimap(this);
    this.hud = new Hud(this);
    this.slipstream.reset();
    this.warp.reset();
    this.hud.reset();
  }

  update(): void {
    const car = this.playerCar;

    /* The lights. Each lamp fires its own note as it comes up, and the third one
       is both the green and the start of the clock. */
    if (this.phase === "countdown") {
      this.countFrames++;
      while (this.lit < COUNT_STEPS.length && this.countFrames >= COUNT_STEPS[this.lit]!) {
        this.lit++;
        if (this.lit >= COUNT_STEPS.length) {
          this.phase = "running";
          this.audio.raceStart?.();
        } else {
          this.audio.countLight?.(this.lit - 1);
        }
      }
    } else if (this.countFrames > 0 && this.countFrames < COUNT_STEPS[COUNT_STEPS.length - 1]! + COUNT_LINGER) {
      /* Keeps ticking after green purely so the HUD can fade the lamps out. */
      this.countFrames++;
    }

    if (this.phase === "running") this.raceFrames++;

    /* R restarts and ENTER goes back to the menu, both on the finish card only.
       Edge-triggered: held down, a level-triggered restart would rebuild the
       course sixty times a second. */
    const menuKey = this.cursors.confirm.isDown;
    if (this.cursors.restart.isDown || menuKey) {
      if (!this.restartHeld && this.phase === "finished") {
        this.restartHeld = true;
        if (menuKey) this.scene.start(SCENE.MENU);
        else this.scene.restart();
        return;
      }
      this.restartHeld = true;
    } else {
      this.restartHeld = false;
    }
    const playerSegment = this.findSegment(this.renderSettings.position + this.playerZ);
    const playerPercent = this.utils.percentRemaining(
      this.renderSettings.position + this.playerZ,
      this.segmentLength,
    );
    const halfWidth =
      this.utils.interpolate(playerSegment.w1, playerSegment.w2, playerPercent) * this.widthScale;

    /* Hold world position through a width change.
     *
     * `playerX` is normalised to half-widths, so on its own a narrowing trail
     * would simply carry the craft inwards with it and the narrowing would be
     * decoration. Rescaling by the width change keeps the craft where it actually
     * is in the world, which means a squeeze genuinely squeezes: hold your line
     * into the canyon section and the verge comes to you. */
    if (this.lastHalfWidth > 0 && halfWidth > 0) {
      this.playerX *= this.lastHalfWidth / halfWidth;
    }
    this.lastHalfWidth = halfWidth;

    /* Off the trail when the craft's centre is past a verge. Told to the craft
       before the throttle is read, so this frame's input is judged against
       this frame's surface. */
    const onRoad = Math.abs(this.playerX) <= 1;
    car.setSurface(onRoad);

    /* Steering authority ramps in and then saturates — see STEER_RATE. NOT
       divided by widthScale; see the note on WIDTH_BOOST_TOP for why that
       mattered. */
    const dx = STEER_RATE * Math.min(1, car.speedFraction / STEER_FULL);

    /* The craft is the player's only between green and Point B.
     *
     * Before green the lights are still counting and the controls are dead —
     * anything else makes the countdown a formality the keen can drive straight
     * through, and makes the stopwatch's zero a lie. After Point B it coasts down
     * and drifts to a stop under the finish card, which reads as an ending;
     * cutting the speed to zero on the line reads as a crash. */
    const driving = this.phase === "running";

    /* Lean escalates with a HELD turn.
     *
     * A flick is a correction and a held input is a commitment, and the craft
     * should look like it knows the difference — so a third of a second of the
     * same direction takes it from the banked frame to the hard one.
     *
     * Tied to how long the KEY has been down rather than to how far across the
     * trail the craft has got. Both were on the table; this one reads as intent
     * and the other reads as position, and position is already shown by the
     * craft's place on the trail. It also means the harder lean arrives at the
     * same moment every time, on a narrow trail and a wide one alike. */
    const dir = !driving ? 0 : this.cursors.left.isDown ? -1 : this.cursors.right.isDown ? 1 : 0;
    this.steerHeld = dir !== 0 && dir === this.lastSteerDir ? this.steerHeld + 1 : 0;
    this.lastSteerDir = dir;

    if (dir !== 0) this.playerX += dir * dx;
    /* Spelled out rather than computed as `dir * (hard ? 2 : 1)`: the arithmetic
       is obviously right and its type is `number`, which SteerLevel is not. */
    const hard = this.steerHeld >= HARD_LEAN_FRAMES;
    const lean: SteerLevel = dir === 0 ? 0 : dir < 0 ? (hard ? -2 : -1) : hard ? 2 : 1;
    car.setSteer(lean);

    /* The boost. Held rather than tapped, so the player meters it out — and
       lighting it is the one input that gets its own sound, because unlike the
       throttle it is a resource leaving the bank. */
    if (car.setBoosting(driving && this.cursors.boost.isDown)) this.audio.boostFire?.();

    if (driving && this.cursors.up.isDown) car.accelerate();
    else if (driving && this.cursors.down.isDown) car.break();
    else car.decelerate();

    /* Roughly one and a half sweeps a second. Independent of speed on purpose:
       the arrow is signage, and signage that changes rhythm with the vehicle
       reads as a fault in the vehicle. */
    this.padScroll = (this.padScroll + 0.025) % 1;

    /* Before the advance, so the frame is projected through the camera the
       player's current speed has earned rather than last frame's. */
    this.updateCamera();
    this.advance(car.speed * TRAVEL_PER_FRAME);

    /* Centrifugal drift: a curve pushes the craft towards its outside edge, and
       the harder you are going the further out it puts you. Sub-linear in speed;
       see DRIFT_SCALE. */
    const drift = Math.sqrt(Math.max(0, car.speedFraction));
    this.playerX -=
      (DRIFT_RATE * Math.min(1, car.speedFraction / STEER_FULL) * drift * playerSegment.curve * this.centrifugal) /
      this.widthScale;
    this.playerX = this.utils.limit(this.playerX, -2, 2);

    this.updateRoad();

    /* After updateRoad(), because the exhaust pins itself to where the craft
       actually ended up this frame — including the idle bob, which setSurface()
       applied at the top of it. */
    this.exhaust.update();
    this.slipstream.update();
    this.warp.update();
    this.hud.update({
      speedFraction: car.speedFraction,
      onRoad,
      phase: this.phase,
      seconds: this.raceFrames / 60,
      charge: car.boostCharge,
      boosting: car.isBoosting,
      lit: this.lit,
      showLights: this.countFrames > 0 && this.countFrames < COUNT_STEPS[COUNT_STEPS.length - 1]! + COUNT_LINGER,
      track: this.track.name,
      ship: this.ship,
    });
    /* The craft starts `playerZ` down the course and the clock stops when IT
       reaches the last segment, not when the camera does — so the marker has to
       be told where the craft is, or it stops a couple of per cent short of
       Point B on every single run. */
    this.minimap.update((this.travelled + this.playerZ) / Math.max(1, this.trackLength));

    /* Power as a share of the ABSOLUTE ceiling rather than of nominal, so the
       engine note maps onto the whole range the craft can reach and tops out
       exactly where the craft does. Off the trail the speed falls and this falls
       with it, which is the whole of the deceleration sound — the drone glides
       down because the number did. */
    const wantEngine = this.phase !== "countdown";
    if (wantEngine !== this.engineLit) {
      this.engineLit = wantEngine;
      this.audio.engineOn?.(wantEngine);
    }
    if (wantEngine) this.audio.engine?.(car.speed / car.absMaxSpeed);
  }

  /**
   * Ease the camera towards where this speed wants it, and rebuild everything
   * downstream of that.
   *
   * `cameraDepth` and `playerZ` are derived here rather than in `build()` because
   * they are no longer constant for the life of the scene. Both relations are
   * upstream's: depth from the field of view, `playerZ` from height times depth.
   * The extra pull-back factor is this port's.
   */
  private updateCamera(): void {
    const rs = this.renderSettings;
    const target = this.utils.limit(
      (this.playerCar.speedFraction - ZOOM_FROM) / (ZOOM_TO - ZOOM_FROM),
      0,
      1,
    );
    this.zoom += (target - this.zoom) * ZOOM_EASE;

    rs.fieldOfView = FOV_BASE + (FOV_TOP - FOV_BASE) * this.zoom;
    rs.cameraHeight = CAM_HEIGHT_BASE + (CAM_HEIGHT_TOP - CAM_HEIGHT_BASE) * this.zoom;
    rs.cameraDepth = 1 / Math.tan(((rs.fieldOfView / 2) * Math.PI) / 180);
    rs.drawDistance = Math.round(DRAW_BASE + (DRAW_TOP - DRAW_BASE) * this.zoom);
    this.playerZ = rs.cameraHeight * rs.cameraDepth * (1 + PULLBACK_TOP * this.zoom);
    this.widthScale = 1 + (WIDTH_BOOST_TOP - 1) * this.zoom;
  }

  /**
   * Move the camera `distance` along the track, observing every segment it
   * passes through on the way.
   *
   * The loop is the whole point — see MAX_STEP_SEGMENTS. One advance of 800 units
   * would step over four segments and any pad in them; sixteen advances of 50
   * land in each in turn.
   */
  private advance(distance: number): void {
    if (!(distance > 0)) return;

    const maxStep = this.segmentLength * MAX_STEP_SEGMENTS;
    let left = distance;

    while (left > 0) {
      const step = Math.min(maxStep, left);
      left -= step;
      this.renderSettings.position = this.utils.increase(this.renderSettings.position, step, this.trackLength);

      this.travelled += step;

      const segment = this.findSegment(this.renderSettings.position + this.playerZ);
      if (segment.index !== this.lastSegmentIndex) {
        this.lastSegmentIndex = segment.index;
        this.enterSegment(segment);

        /* Point B. Detected by segment index rather than by distance because the
           index is what the FINISH band is painted on, so the line the player
           sees and the line the clock stops at are the same object.
           
           The camera keeps running afterwards — `increase()` still wraps it, and
           the draw loop still wraps round to the start of the array — so the
           world beyond the line simply carries on rather than ending in a hard
           edge. It costs nothing: the craft is coasting to a stop by then. */
        if (this.phase === "running" && segment.index >= this.segments.length - 1) {
          this.phase = "finished";
          this.audio.raceFinish?.();
        }
      }
    }
  }

  /** Called once for each segment the craft passes into. The only thing in the
   *  game that needs it is the boost pads; the surface test is a per-frame
   *  question rather than a per-segment one, because leaving the trail is
   *  something you do sideways. */
  private enterSegment(segment: RoadSegment): void {
    const pad = segment.pad;
    const on = pad !== null && Math.abs(this.playerX - pad.offset) <= pad.half + PAD_TOLERANCE;

    if (on) {
      this.playerCar.addCharge(PAD_CHARGE);
      /* Arriving on a plate, not being on one: a five-segment pad taken at speed
         is five boosts and one kick in the teeth. */
      if (!this.onPad) {
        this.playerCar.flashBoost();
        this.cameras.main.shake(140, 0.006);
        this.hud.onBoost();
        this.audio.boost?.();
      }
    }
    this.onPad = on;
  }

  build(): void {
    this.renderSettings.cameraDepth = 1 / Math.tan(((this.renderSettings.fieldOfView / 2) * Math.PI) / 180);
    this.playerZ = this.renderSettings.cameraHeight * this.renderSettings.cameraDepth;
    this.renderSettings.resolution = this.renderSettings.height / (this.renderSettings.height / 2);
    if (this.segments.length === 0) this.buildRoad();
  }

  /**
   * The chosen course.
   *
   * `tracks.ts` decides what the nine courses are; this only knows how to play a
   * list of pieces and how to close one off. The stage-based builder that stood
   * here until Aug 2026 — one hand-written run of track, optionally mirrored and
   * repeated — went with it, along with `addStage`, `addStraight`, `addHill`,
   * `addCurve`, `addSCurves` and `addLowRollingHills`. Those were upstream's
   * vocabulary for writing a course by hand, and nothing writes one by hand any
   * more; `addRoad` and `addDownhillToEnd` are what survived, because those are
   * the two that know how to lay geometry rather than what geometry to lay.
   */
  buildRoad(): void {
    this.segments = [];

    for (const piece of buildPieces(this.track)) {
      this.addRoad(piece.len, piece.len, piece.len, piece.curve, piece.hill, piece.width);
    }
    /* Whatever the course did with elevation, the finish meets the conditions
       the start was built at. Only the scene can add this: it is the only thing
       that knows how high the course has climbed by the time it gets here. */
    this.addDownhillToEnd();

    /* Mottle the ground. Must come before the bands below, or it overwrites
       them. */
    this.paintTerrain();

    /* Point A and Point B.
     *
     * A pale mineral streak on the line and a dark basalt outcrop at the far
     * end. Upstream painted a chequered start and finish; these do the same job
     * as geology rather than as paint, which is the rule the whole surface is
     * built on — see terrain.ts.
     *
     * Point B is deliberately WIDER than Point A. It is the thing the player is
     * driving at for a hundred seconds, and at the top of the speed ladder a
     * three-segment band six hundred units long goes past in under a frame. At
     * ten it is visible for long enough to be a finish line rather than a
     * flicker, and `enterSegment` stops the clock on the last segment of it. */
    const line = this.findSegment(this.playerZ).index;
    for (let n = 0; n < GRID_ROWS; n++) this.segments[line + 2 + n]!.checker = n;
    this.segments[line + 2 + GRID_ROWS]!.color = START_BAND;

    for (let n = 0; n < 10; n++) {
      this.segments[this.segments.length - 1 - n]!.color = FINISH_BAND;
    }

    /* Boost pads, last: they are furniture bolted onto the finished trail, and
       placing them needs the curvature the geometry passes above have just
       decided. Nothing after this point may reassign `color`, which is why the
       lap markers are above and this is below. */
    for (const [index, pad] of scatterBoostPads(this.segments.length, (i) => this.segments[i]!.curve)) {
      this.segments[index]!.pad = pad;
    }

    this.trackLength = this.segments.length * this.segmentLength;
    this.buildSprites();
  }

  updateRoad(): void {
    this.graphics.clear();

    const baseSegment = this.findSegment(this.renderSettings.position);
    const basePercent = this.utils.percentRemaining(this.renderSettings.position, this.segmentLength);
    const playerSegment = this.findSegment(this.renderSettings.position + this.playerZ);
    const playerPercent = this.utils.percentRemaining(
      this.renderSettings.position + this.playerZ,
      this.segmentLength,
    );

    /* Ride the hill the car is currently on, so cresting one lifts the camera. */
    this.playerY = this.utils.interpolate(playerSegment.p1.world.y, playerSegment.p2.world.y, playerPercent);
    /* The camera's world x. Scaled by the width *here* rather than by the base
       width, so playerX = ±1 is the verge wherever the car happens to be. */
    const cameraX =
      this.playerX *
      this.utils.interpolate(playerSegment.w1, playerSegment.w2, playerPercent) *
      this.widthScale;

    this.updateBackdrop(baseSegment.curve);

    let maxy = this.renderSettings.height;
    let x = 0;
    let dx = -(baseSegment.curve * basePercent);

    for (let n = 0; n < this.renderSettings.drawDistance; n++) {
      const segment = this.segments[(baseSegment.index + n) % this.segments.length]!;
      /* A segment whose index is behind the camera has wrapped the end of the
         array, so its world z needs the track length taken off it or it
         projects a whole lap away. */
      segment.looped = segment.index < baseSegment.index;
      segment.fog = this.utils.exponentialFog(n / this.renderSettings.drawDistance, this.renderSettings.fogDensity);
      segment.clip = maxy;

      /* p1 and p2 project with the segment's own start and end widths. Since
         w2 here is w1 of the next segment, adjacent segments always agree at
         the join and a width change is a taper rather than a staircase. */
      this.utils.project(
        segment.p1,
        cameraX - x,
        this.playerY + this.renderSettings.cameraHeight,
        this.renderSettings.position - (segment.looped ? this.trackLength : 0),
        this.renderSettings.cameraDepth,
        this.renderSettings.width,
        this.renderSettings.height,
        segment.w1 * this.widthScale,
        PROJECT_SPAN,
      );
      this.utils.project(
        segment.p2,
        cameraX - x - dx,
        this.playerY + this.renderSettings.cameraHeight,
        this.renderSettings.position - (segment.looped ? this.trackLength : 0),
        this.renderSettings.cameraDepth,
        this.renderSettings.width,
        this.renderSettings.height,
        segment.w2 * this.widthScale,
        PROJECT_SPAN,
      );

      /* Accumulating the curve as we walk forward is what bends the road: each
         segment is drawn a little further sideways than the one before it. */
      x = x + dx;
      dx = dx + segment.curve;

      if (segment.sprites.length) {
        for (let i = 0; i < segment.sprites.length; i++) {
          const spriteScale = segment.p1.screen.scale;
          const spriteX =
            segment.p1.screen.x +
            (spriteScale * segment.sprites[i]!.offset * segment.w1 * this.widthScale * PROJECT_SPAN) / 2;
          const spriteY = segment.p1.screen.y;

          if (segment.p2.screen.y <= maxy) {
            segment.sprites[i]!.spriteRef.setPosition(spriteX, spriteY);
            segment.sprites[i]!.spriteRef.setScale(spriteScale * PROP_SCALE);
            segment.sprites[i]!.spriteRef.setVisible(true);
          } else {
            segment.sprites[i]!.spriteRef.setVisible(false);
          }
        }
      }

      if (
        segment.p1.camera.z <= this.renderSettings.cameraDepth || // behind the camera
        segment.p2.screen.y >= segment.p1.screen.y || // back face, i.e. the far side of a crest
        segment.p2.screen.y >= maxy // hidden behind something already drawn
      ) {
        continue;
      }

      this.render.renderSegment(
        this.renderSettings.width,
        this.lanes,
        segment.p1.screen.x,
        segment.p1.screen.y,
        segment.p1.screen.w,
        segment.p2.screen.x,
        segment.p2.screen.y,
        segment.p2.screen.w,
        segment.fog,
        segment.color,
        segment.bermOut,
        segment.bermIn,
        segment.pad,
        this.padScroll,
        segment.checker,
      );
      maxy = segment.p2.screen.y;
    }
  }

  /**
   * Scroll the two backdrop layers.
   *
   * Not upstream: Phaser3-Road plants one sprite at a fixed point and leaves it
   * there, so the horizon is nailed to the screen however hard you turn. The
   * layers here move with both the bend of the track and the car's position
   * across it, at different rates, which is what puts distance between them.
   *
   * `increase()` wraps each offset at the texture width. That is not just
   * tidiness — left to run, the offsets would climb without limit for as long
   * as the egg is open and eventually lose float precision, at which point the
   * backdrop starts juddering.
   */
  private updateBackdrop(curve: number): void {
    const travel = this.playerCar.speed / this.segmentLength;

    this.skyOffset = this.utils.increase(this.skyOffset, SKY_CURVE * curve * travel, this.skyTexW);
    this.ridgeOffset = this.utils.increase(this.ridgeOffset, RIDGE_CURVE * curve * travel, this.ridgeTexW);

    this.sky.tilePositionX = this.skyOffset + this.playerX * SKY_STEER;
    this.ridge.tilePositionX = this.ridgeOffset + this.playerX * RIDGE_STEER;

    /* Climbing drops the horizon, so a crest opens the sky up. */
    this.ridge.y = RIDGE_Y + this.utils.limit(this.playerY * RIDGE_LIFT, -RIDGE_LIFT_MAX, RIDGE_LIFT_MAX);
  }

  /**
   * Roadside props. There are none.
   *
   * Upstream placed three Phaser-branded billboards and four parked cars — the
   * cars being the same purple sprite with PHASER written across the boot. None
   * of that ships; it is that project's branding rather than scenery.
   *
   * Boulders stood along the verges until Aug 2026 and were removed at Matt's
   * request. They were always scenery rather than obstacles — the engine has no
   * collision resolution, so nothing can be put in the player's path — and with
   * the trail now twice as wide and the camera pulled back at speed, what they
   * mostly did was clutter the middle distance, which is the one part of the
   * frame the player reads the verge from.
   *
   * The MACHINERY below them stays: `addSegmentSprite`, `segment.sprites` and
   * the positioning block in updateRoad() are upstream's, they are correct, and
   * they are what anything pinned to a segment would be built on. An empty
   * placement pass is a great deal cheaper to restore from than a re-derived
   * projection.
   */
  buildSprites(): void {
    /* Intentionally empty. See above. */
  }

  findSegment(z: number): RoadSegment {
    return this.segments[Math.floor(z / this.segmentLength) % this.segments.length]!;
  }

  lastY(): number {
    return this.segments.length === 0 ? 0 : this.segments[this.segments.length - 1]!.p2.world.y;
  }

  /** The width the next segment has to start at, so widths meet at every join.
   *  Before the first segment exists that is the base width, which is also what
   *  the last segment must end at for the loop to close. */
  lastWidth(): number {
    return this.segments.length === 0 ? this.roadWidth : this.segments[this.segments.length - 1]!.w2;
  }

  addSegmentSprite(index: number, spriteKey: string, offset: number): void {
    const sprite = this.add.sprite(0, 0, spriteKey);
    /* Bottom-centre, not centre. updateRoad() positions these at the segment's
       screen y, which IS the ground line — with Phaser's default 0.5 origin
       every prop is drawn half sunk into the surface. Upstream's billboards had
       exactly that problem; nothing here should. */
    sprite.setOrigin(0.5, 1);
    this.segments[index]!.sprites.push({ key: spriteKey, offset, spriteRef: sprite });
    this.segmentSprites.push(sprite);
    sprite.setVisible(false);
  }

  addSegment(curve: number, y: number, width: number): void {
    const n = this.segments.length;
    this.segments.push({
      index: n,
      p1: newPoint(this.lastY(), n * this.segmentLength),
      p2: newPoint(y, (n + 1) * this.segmentLength),
      w1: this.lastWidth(),
      w2: width,
      sprites: [],
      cars: [],
      curve,
      /* Surfacing is a second pass — paintTerrain(), below. It cannot happen
         here because the ground pattern has to be periodic over the whole loop
         and the loop's length is not known until building finishes. Upstream
         alternated two fixed colours every `rumbleLength` segments, which is
         where the banding in the tarmac version came from. */
      color: this.render.COLORS.LIGHT,
      bermOut: 1,
      bermIn: 0,
      pad: null,
      checker: -1,
      /* Placeholders. updateRoad() overwrites all three before anything reads
         them; upstream left them undefined until the first frame. */
      looped: false,
      fog: 1,
      clip: 0,
    });
  }

  /**
   * Surface the finished track.
   *
   * Runs once, after buildRoad() has laid the geometry, because the noise that
   * mottles the ground is sampled on a ring that has to divide the track evenly
   * — see terrain.ts. Doing it per-segment during building would put an
   * unrelated colour either side of the point where the lap wraps.
   */
  paintTerrain(): void {
    const total = this.segments.length;
    for (let i = 0; i < total; i++) {
      const s = this.segments[i]!;
      const t = sampleTerrain(i, total);
      s.color = t.color;
      s.bermOut = t.bermOut;
      s.bermIn = t.bermIn;
    }
  }

  /**
   * Every piece of track is this: ease the curve in, hold it, ease it out,
   * while the height and the width ease across the whole run.
   *
   * `width` omitted means "hold whatever we are at", so most pieces say nothing
   * about width and only the ones that change it have to.
   *
   * THE `n + 1`, WHICH IS NOT UPSTREAM'S `n`
   *
   * `addSegment(curve, y, w)` sets the segment's *end* point — p1 comes from
   * the previous segment, p2 is what you pass. Segment n therefore spans t =
   * n/total to (n+1)/total, and its end belongs at (n+1)/total. Upstream eases
   * at n/total, which shifts every piece back by one segment and, more to the
   * point, means the last segment lands at easeInOut(…, (total-1)/total) and
   * the piece never actually reaches the height it was asked for.
   *
   * On upstream's short course that residue is invisible. Here it accumulated
   * across twenty-odd pieces into a 192-unit step at the point where the loop
   * wraps — a jolt, once a lap, in a game whose whole appeal is a smooth road.
   * With `n + 1` every piece lands exactly on its target, which makes lastY() an
   * exact multiple of segmentLength, which is in turn what lets
   * addDownhillToEnd() close the loop to zero instead of to nearly-zero.
   *
   * The curve argument keeps `n`: that one is the segment's own curvature, a
   * property of the whole segment rather than of its far end, so it has no
   * endpoint to reach.
   */
  addRoad(enter: number, hold: number, leave: number, curve: number, y: number, width?: number): void {
    const startY = this.lastY();
    const endY = startY + this.utils.toInt(y, 0) * this.segmentLength;
    const startW = this.lastWidth();
    const endW = width === undefined ? startW : width;
    const total = enter + hold + leave;
    let n: number;
    for (n = 0; n < enter; n++) {
      this.addSegment(
        this.utils.easeIn(0, curve, n / enter),
        this.utils.easeInOut(startY, endY, (n + 1) / total),
        this.utils.easeInOut(startW, endW, (n + 1) / total),
      );
    }
    for (n = 0; n < hold; n++) {
      this.addSegment(
        curve,
        this.utils.easeInOut(startY, endY, (enter + n + 1) / total),
        this.utils.easeInOut(startW, endW, (enter + n + 1) / total),
      );
    }
    for (n = 0; n < leave; n++) {
      this.addSegment(
        this.utils.easeInOut(curve, 0, n / leave),
        this.utils.easeInOut(startY, endY, (enter + hold + n + 1) / total),
        this.utils.easeInOut(startW, endW, (enter + hold + n + 1) / total),
      );
    }
  }

  /** Runs the height back down to zero and the width back to base, so the
   *  finish meets the conditions the start was built at. */
  addDownhillToEnd(num?: number): void {
    const len = num || 200;
    this.addRoad(len, len, len, -this.RUNOUT_CURVE, -this.lastY() / this.segmentLength, this.roadWidth);
  }
}

export default RoadScene;
