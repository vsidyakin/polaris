/* SOLAR CIRCUIT — everything additive that is attached to the craft.
 *
 * Two flames pinned to the nozzles, scaled by how fast the craft is going, and
 * an aura over the hull that only appears while the boost is burning. The ship
 * frames already carry a plume; this is the part of it that can change size,
 * because a PNG's cannot.
 *
 * WHY THE AURA IS THE SHIP'S OWN TEXTURE
 *
 * It is a second copy of whichever frame the craft is currently wearing, drawn
 * behind it, a shade larger, tinted, and composited additively. That gives a
 * glow in exactly the shape of the craft — round the fins, round the canopy,
 * following the bank — for the cost of one sprite and a `setTexture` call. Any
 * drawn halo would have to be redrawn for all five lean frames and would still
 * be wrong the moment the art changed.
 *
 * WHY THE NOZZLE POSITIONS ARE A TABLE HERE
 *
 * The nozzles are drawn by `buildHover()` in `scripts/build-solar-road-art.mjs`,
 * and where they land in a banked frame is the output of that function's bank
 * transform — roll about the centre line, plus a lateral slide. There is no way
 * for this file to import that: the art script is a build-time Node program that
 * writes PNGs, and the PNGs it writes carry no metadata about what is in them.
 *
 * So the six numbers below are the transform's answers, worked out once and
 * written down. They are DERIVED, not eyeballed, and the derivation is in the
 * comment on NOZZLES so it can be redone. If `buildHover` ever moves NOZZLE_X,
 * REAR_Y, ROLL or SLIDE, this table is wrong and the flames will hang off the
 * hull — that is the cost of the split, and it is cheaper than the alternative,
 * which is baking a plume into the frames at every size and every bank.
 */

import Phaser from "phaser";
import { shipFrame, type SteerLevel } from "./ships";
import type { RoadScene } from "./game-scene";

/**
 * Nozzle centres, in texture pixels from the middle of the frame, per bank.
 *
 * Worked out from `buildHover`: the frame is 88x58 so its centre is (44, 29);
 * the nozzles sit at `cx ± NOZZLE_X` = 43.5 ± 17, at `REAR_Y + 5.5` = 36.5; and
 * `put()` maps a body point to `x = bx + steer*SLIDE`, `y = by + steer*ROLL*(x -
 * cx)` with SLIDE = 2 and ROLL = 0.2 (yaw is zero this far aft). Subtract the
 * frame centre from each result and these are what is left.
 *
 * The hard rows are the same expressions with the transform's `hard` factor of
 * 1.7 folded in.
 *
 * The asymmetry in the banked rows is the point: in a left bank the left nozzle
 * has rolled down and outboard and the right one up and inboard, and the flames
 * have to follow or they detach from the craft in exactly the frames where the
 * player is looking hardest at it.
 */
const NOZZLES: Record<SteerLevel, ReadonlyArray<readonly [number, number]>> = {
  [-2]: [
    [-20.9, 14.44],
    [13.1, 2.88],
  ],
  [-1]: [
    [-19.5, 11.3],
    [14.5, 4.5],
  ],
  [0]: [
    [-17.5, 7.5],
    [16.5, 7.5],
  ],
  [1]: [
    [-15.5, 4.5],
    [18.5, 11.3],
  ],
  [2]: [
    [-14.1, 2.88],
    [19.9, 14.44],
  ],
};

/** Scale of the flame at rest and at the top of the speed ladder. It never goes
 *  to zero: an engine holding a craft off the ground is running even when the
 *  craft is stationary, and a hovercraft with its lift off is on the floor. */
const SCALE_IDLE = 0.42;
const SCALE_TOP = 1.85;
/** The flame is longer than it is wide at speed — thrust, not a bloom. */
const STRETCH_TOP = 1.35;
const ALPHA_IDLE = 0.45;
const ALPHA_TOP = 1;

/** Speed fractions the growth runs between. */
const FROM = 0.4;
const TO = 5;

/* --- boost ---
 * What lighting the boost does to the flames and the hull.
 *
 * The flame multiplier is large on purpose. The boost lasts under three seconds
 * and costs a resource the player spent a stage collecting, so it has to be
 * unmistakable from the first frame — a subtle change would leave them wondering
 * whether the key had registered. The flicker is what stops the enlarged flame
 * reading as a still image that has simply been scaled up. */
const BOOST_FLAME = 1.75;
const BOOST_FLICKER = 0.09;
const BOOST_EASE = 0.22;
/** Aura: how much bigger than the hull, and how hard it pulses. */
const AURA_GROW = 0.11;
const AURA_ALPHA = 0.55;
const AURA_PULSE = 0.34;
const AURA_TINT = 0x7ff2ff;

/** How fast the flame chases its target size. Faster than the camera's ease —
 *  an engine responds to the throttle, a camera operator does not. */
const EASE = 0.12;

export class Exhaust {
  private readonly scene: RoadScene;
  private readonly sprites: Phaser.GameObjects.Sprite[];
  private readonly aura: Phaser.GameObjects.Sprite;
  private grow = 0;
  /** Eased 0..1 on the boost, so lighting and cutting it are both a ramp. */
  private burn = 0;
  private pulse = 0;

  constructor(scene: RoadScene) {
    this.scene = scene;

    /* Added first, so it sits behind both the flames and the craft. */
    this.aura = scene.add.sprite(0, 0, shipFrame(scene.ship, 0));
    this.aura.setBlendMode(Phaser.BlendModes.ADD);
    this.aura.setTint(AURA_TINT);
    this.aura.setVisible(false);

    this.sprites = [0, 1].map(() => {
      const s = scene.add.sprite(0, 0, "plume");
      /* Anchored near the top edge, so it grows DOWNWARD out of the nozzle.
         About its centre it would walk up into the hull as it got bigger. */
      s.setOrigin(0.5, 0.06);
      /* ADD rather than NORMAL: this is layered over the plume already baked
         into the ship frame, and two alpha-blended flames read as two objects
         where two additive ones read as one hotter flame. */
      s.setBlendMode(Phaser.BlendModes.ADD);
      s.setVisible(false);
      return s;
    });
  }

  /** Called once per frame, after the craft has been positioned and told which
   *  way it is leaning. */
  update(): void {
    const car = this.scene.playerCar;
    const target = Phaser.Math.Clamp((car.speedFraction - FROM) / (TO - FROM), 0, 1);
    this.grow += (target - this.grow) * EASE;
    this.burn += ((car.isBoosting ? 1 : 0) - this.burn) * BOOST_EASE;
    this.pulse += 0.3;

    /* Flicker only while burning, and only on the flames. A hull that shimmered
       frame to frame would read as a rendering fault; a flame that does not is
       not a flame. */
    const flicker = 1 + (Math.random() * 2 - 1) * BOOST_FLICKER * this.burn;
    const boost = 1 + (BOOST_FLAME - 1) * this.burn * flicker;
    const scale = (SCALE_IDLE + (SCALE_TOP - SCALE_IDLE) * this.grow) * boost;
    const alpha = Math.min(1, (ALPHA_IDLE + (ALPHA_TOP - ALPHA_IDLE) * this.grow) * (1 + this.burn * 0.4));
    const pins = NOZZLES[car.steerDir];
    /* The craft is drawn at 3x, so one of its texture pixels is three screen
       pixels — read off the sprite rather than hardcoded, so changing the ship's
       scale cannot silently detach the flames from the nozzles. */
    const px = car.scaleX;

    for (let i = 0; i < this.sprites.length; i++) {
      const s = this.sprites[i]!;
      const [dx, dy] = pins[i]!;
      s.setVisible(true);
      s.setPosition(car.x + dx * px, car.y + dy * px);
      s.setScale(scale * px, scale * (1 + (STRETCH_TOP - 1) * this.grow) * px);
      s.setAlpha(alpha);
    }

    /* The hull aura. Follows the craft's current lean frame, its position and
       its bob, so it cannot come unstuck from the thing it is glowing around. */
    if (this.burn < 0.01) {
      this.aura.setVisible(false);
      return;
    }
    this.aura.setVisible(true);
    this.aura.setTexture(car.texture.key);
    this.aura.setPosition(car.x, car.y);
    this.aura.setScale(px * (1 + AURA_GROW * this.burn));
    this.aura.setAlpha(this.burn * AURA_ALPHA * (1 - AURA_PULSE + AURA_PULSE * (0.5 + 0.5 * Math.sin(this.pulse))));
  }
}

export default Exhaust;
