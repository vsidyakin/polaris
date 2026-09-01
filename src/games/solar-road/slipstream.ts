/* SOLAR CIRCUIT — the slipstream.
 *
 * Sparks that come off the craft's nose and fly out past the camera as it gets
 * faster. Where `warp.ts` is what the WORLD looks like at speed, this is what
 * the CRAFT looks like at speed, and the difference between them is where each
 * one's particles come from.
 *
 * WHY THESE ARE NOT JUST MORE WARP STREAKS
 *
 * A warp streak radiates from the vanishing point on the horizon: it is scenery
 * a long way off, coming at you because you are going towards it. A slipstream
 * spark radiates from the NOSE OF THE CRAFT, which is a few metres in front of
 * the camera at the bottom of the frame. Two different origins, two different
 * flow fields, and the pair of them is what gives the shot a foreground and a
 * background instead of one flat rush.
 *
 * WHY THE RADIUS GROWS GEOMETRICALLY
 *
 * A spark leaving the nose is travelling towards the camera at roughly constant
 * speed, but its distance from the camera is SHRINKING — and in perspective, a
 * point closing on the lens sweeps across the frame faster and faster the nearer
 * it gets. Linear growth reads as a firework: everything drifting outward at one
 * steady rate. Multiplying the radius each frame reproduces the real curve, and
 * it is the whole reason these read as passing you rather than as spraying away
 * from a point.
 *
 * They are a fixed pool, recycled forever. Nothing here allocates after the
 * constructor, so a lap cannot be interrupted by a collection.
 */

import Phaser from "phaser";
import type { RoadScene } from "./game-scene";

/** Speed fractions the effect fades in across. It starts earlier than the warp
 *  package in `warp.ts`: the craft should be visibly working before the world
 *  starts tearing, so the two arrive in sequence rather than together. */
const FROM = 1.1;
const TO = 5;
const EASE = 0.06;

const COUNT = 54;

/** Radius at which a spark is recycled, and where it restarts. NEAR is small but
 *  not zero — sparks are shed by a nose that has width, not by a point. */
const NEAR = 6;
const FAR = 900;

/** Per-frame radius multiplier at full intensity. See the note above: this being
 *  a multiplier rather than an addition is the entire effect. */
const ACCEL = 1.115;
/** ...plus a small constant, or a spark starting at NEAR takes a visible beat to
 *  get going and they all appear to hesitate at birth. */
const CREEP = 1.6;

/** Dash length as a fraction of how far out the spark is. */
const TRAIL = 0.28;

const COLOR_HOT = 0xf2fdff;
const COLOR_COOL = 0x5ef0ff;

interface Spark {
  angle: number;
  radius: number;
  rate: number;
  hot: boolean;
}

export class Slipstream {
  private readonly scene: RoadScene;
  private readonly gfx: Phaser.GameObjects.Graphics;
  private readonly sparks: Spark[] = [];
  private intensity = 0;

  constructor(scene: RoadScene) {
    this.scene = scene;
    this.gfx = scene.add.graphics({ x: 0, y: 0 });

    for (let i = 0; i < COUNT; i++) {
      this.sparks.push(this.seed({ angle: 0, radius: 0, rate: 1, hot: false }, i / COUNT));
    }
  }

  /** Put a spark back at the nose. `spread` biases the starting angle so the
   *  initial pool is distributed rather than stacked on one bearing. */
  private seed(s: Spark, spread = Math.random()): Spark {
    s.angle = spread * Math.PI * 2;
    /* Started anywhere along the flight rather than all at the nose, so the very
       first frame at speed shows a stream and not a puff. */
    s.radius = NEAR + Math.random() * (FAR - NEAR);
    s.rate = 0.8 + Math.random() * 0.5;
    /* A quarter of them run white-hot. A single colour reads as one material;
       two read as sparks in a wash of vapour. */
    s.hot = Math.random() < 0.25;
    return s;
  }

  reset(): void {
    this.intensity = 0;
    this.gfx.clear();
    for (const s of this.sparks) this.seed(s);
  }

  update(): void {
    const car = this.scene.playerCar;
    /* Boosting drives the sparks well past whatever the speed alone would give,
       and it does it immediately: the craft is throwing far more energy out of
       its nose than it was a frame ago, and the field is the only thing on
       screen that can say so about the AIR rather than about the engines. */
    const t = Phaser.Math.Clamp((car.speedFraction - FROM) / (TO - FROM), 0, 1);
    const want = car.isBoosting ? Math.min(1, t + 0.55) : t;
    this.intensity += (want - this.intensity) * (car.isBoosting ? EASE * 3 : EASE);

    const k = this.intensity;
    this.gfx.clear();
    if (k < 0.01) return;

    /* The nose: top-centre of the craft, which moves with the idle bob and with
       whatever `warp.ts` is doing to the camera. Read from the sprite every
       frame rather than cached, so the sparks stay welded to it. */
    const ox = car.x;
    const oy = car.y - (car.height * car.scaleY) / 2;

    for (const s of this.sparks) {
      s.radius = s.radius * (1 + (ACCEL - 1) * s.rate * k) + CREEP * s.rate * k;
      if (s.radius > FAR) this.seed(s);

      const cos = Math.cos(s.angle);
      const sin = Math.sin(s.angle);
      const len = s.radius * TRAIL * k;

      /* Brightest just off the nose and gone by the frame edge. Squaring the
         near end keeps the sparks from piling into a solid blob at the origin,
         where fifty of them are within a few pixels of each other. */
      const reach = s.radius / FAR;
      const alpha = k * 0.8 * Math.min(1, (reach * 6) ** 2) * (1 - reach);
      if (alpha <= 0.01) continue;

      this.gfx.lineStyle(s.hot ? 2 : 1, s.hot ? COLOR_HOT : COLOR_COOL, alpha);
      this.gfx.beginPath();
      this.gfx.moveTo(ox + cos * s.radius, oy + sin * s.radius);
      this.gfx.lineTo(ox + cos * (s.radius + len), oy + sin * (s.radius + len));
      this.gfx.strokePath();
    }
  }
}

export default Slipstream;
