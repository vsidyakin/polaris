/* SOLAR CIRCUIT — what going too fast looks like.
 *
 * Three effects that all come in together as the speed ladder climbs, and are
 * completely absent below it: a tremble in the camera, a tunnel closing in from
 * the edges of the frame, and streaks tearing past the craft out of the vanishing
 * point.
 *
 * WHY THEY ARE ALL DRIVEN OFF ONE NUMBER
 *
 * `intensity` is the only state here, and everything scales off it. Three
 * effects fading in on three separate curves would beat against each other —
 * the streaks arriving before the tunnel, the shake peaking while the streaks
 * were still thin — and the result reads as three unrelated things going wrong
 * rather than as one sensation. Driven together they are legible as a single
 * message, which is: you are now going faster than you can react to.
 *
 * WHY IT IS ALL ON ITS OWN GRAPHICS OBJECT
 *
 * The scene's `graphics` is the road, cleared and refilled every frame, and
 * anything drawn into it lands underneath the craft. This layer is added after
 * the craft, so the streaks pass in front of it — which is the whole illusion,
 * since a streak flying at the camera has to cross whatever is between it and
 * the camera. The tunnel has to be on top for the same reason.
 */

import Phaser from "phaser";
import type { RoadScene } from "./game-scene";
import { VIEW } from "./view";

/** Speed fractions the whole package fades in across. Nothing at all until the
 *  craft is past its nominal top speed — below that this is an ordinary racer
 *  and should look like one. */
const FROM = 1.6;
const TO = 5.5;
/** Chases its target, so a boost pad does not switch it on like a light. */
const EASE = 0.045;

/* --- shake ---
 * "Mild" is the specification and two pixels is what that means. This is the one
 * effect here with a hard ceiling: the canvas is letterboxed into whatever box
 * the overlay gives it, so a shake big enough to be dramatic at 800x600 is one
 * big enough to be nauseating on a large screen. It also has to stay well under
 * the craft's own idle bob or the two fight each other. */
const SHAKE_MAX = 2.2;

/* --- tunnel ---
 * Nested frames of darkness closing in from the edges. Not a real vignette —
 * that needs a radial gradient and Graphics has none — but sixteen rectangles
 * with a squared alpha ramp is indistinguishable from one at this size, and it
 * costs sixteen fills.
 *
 * It does the same job the fog does further down the track: it takes away the
 * periphery, which at this speed carries nothing the player can act on anyway,
 * and leaves the middle distance where the trail still resolves. */
const TUNNEL_RINGS = 16;
const TUNNEL_DEPTH = 0.16;
const TUNNEL_REACH = 0.38;

/* --- streaks ---
 * Radial lines flying out of the vanishing point. They are not dust or rock and
 * are not meant to be: nothing is out there on an airless planet. They are the
 * same visual shorthand every game since the first hyperspace sequence has used,
 * and the reason it survives is that a radial flow field out of the point you
 * are travelling towards is exactly what genuinely moving that fast looks like.
 *
 * They are seeded once and recycled forever — a pool, never an allocation, so
 * this cannot garbage-collect mid-corner. */
const STREAK_COUNT = 48;
/** How far out a streak has to get before it is recycled to the middle. */
const STREAK_FAR = 620;
/** Radius a recycled streak reappears at. Well clear of the vanishing point, or
 *  they all visibly hatch out of one pixel. */
const STREAK_NEAR = 40;
/** Screen pixels per frame at full intensity, and the length of the dash. */
const STREAK_SPEED = 26;
const STREAK_LEN = 34;
const STREAK_COLOR = 0xbdf3ff;

interface Streak {
  angle: number;
  radius: number;
  /** Per-streak speed multiplier, so they do not move as one sheet. */
  rate: number;
  width: number;
}

export class WarpField {
  private readonly scene: RoadScene;
  private readonly gfx: Phaser.GameObjects.Graphics;
  private readonly streaks: Streak[] = [];
  private intensity = 0;

  constructor(scene: RoadScene) {
    this.scene = scene;
    this.gfx = scene.add.graphics({ x: 0, y: 0 });

    for (let i = 0; i < STREAK_COUNT; i++) {
      this.streaks.push({
        /* Spread over the full circle rather than randomly, then jittered: pure
           random leaves visible clumps and bald patches in a field this small. */
        angle: (i / STREAK_COUNT) * Math.PI * 2 + Math.random() * 0.4,
        radius: STREAK_NEAR + Math.random() * (STREAK_FAR - STREAK_NEAR),
        rate: 0.6 + Math.random() * 0.9,
        width: Math.random() < 0.25 ? 2 : 1,
      });
    }
  }

  /** Reset for a fresh run. The scene rebuilds on every create(); a warp field
   *  left at full intensity would have the player starting from a standstill
   *  inside a tunnel. */
  reset(): void {
    this.intensity = 0;
    this.gfx.clear();
  }

  update(): void {
    const t = Phaser.Math.Clamp((this.scene.playerCar.speedFraction - FROM) / (TO - FROM), 0, 1);
    this.intensity += (t - this.intensity) * EASE;

    const k = this.intensity;
    this.gfx.clear();

    /* Below a per cent or so there is nothing to draw, and leaving the camera
       nudged by a fraction of a pixel forever is worse than not shaking at all —
       it shows up as a permanent half-pixel blur on a letterboxed canvas. */
    if (k < 0.01) {
      this.scene.cameras.main.setScroll(0, 0);
      return;
    }

    this.shake(k);
    this.streak(k);
    this.tunnel(k);
  }

  /** Jitter the camera. Everything is drawn in screen space, so scrolling the
   *  camera moves the road, the backdrop and the craft together — which is what
   *  a shake is, as opposed to the road sliding under a steady craft. */
  private shake(k: number): void {
    const amp = SHAKE_MAX * k * k;
    this.scene.cameras.main.setScroll(
      (Math.random() * 2 - 1) * amp,
      (Math.random() * 2 - 1) * amp,
    );
  }

  private streak(k: number): void {
    /* Out of the vanishing point, which is where the projection puts infinity:
       dead centre horizontally, and on the horizon vertically. */
    const ox = VIEW.W / 2;
    const oy = VIEW.H / 2;

    for (const s of this.streaks) {
      s.radius += STREAK_SPEED * s.rate * k;
      if (s.radius > STREAK_FAR) {
        s.radius = STREAK_NEAR;
        s.angle = Math.random() * Math.PI * 2;
        s.rate = 0.6 + Math.random() * 0.9;
      }

      const cos = Math.cos(s.angle);
      const sin = Math.sin(s.angle);
      /* Longer the further out it is — a streak accelerates away from the
         vanishing point in perspective even at constant world speed, and the
         stretch is most of what makes the flow read as coming AT the player
         rather than as a spinning pinwheel. */
      const reach = s.radius / STREAK_FAR;
      const len = STREAK_LEN * k * (0.35 + reach * 1.3);
      /* Fade in off the vanishing point and out again at the frame edge, so
         nothing pops into or out of existence. */
      const alpha = k * 0.75 * Math.min(1, reach * 3) * (1 - Math.pow(reach, 3));
      if (alpha <= 0.01) continue;

      this.gfx.lineStyle(s.width, STREAK_COLOR, alpha);
      this.gfx.beginPath();
      this.gfx.moveTo(ox + cos * s.radius, oy + sin * s.radius);
      this.gfx.lineTo(ox + cos * (s.radius + len), oy + sin * (s.radius + len));
      this.gfx.strokePath();
    }
  }

  private tunnel(k: number): void {
    const reach = TUNNEL_REACH * k;
    for (let i = 0; i < TUNNEL_RINGS; i++) {
      const t = i / (TUNNEL_RINGS - 1);
      const inset = VIEW.H * reach * (1 - t);
      /* Squared, so the darkness is nearly all in the outermost rings and the
         middle of the frame stays completely clear. */
      this.gfx.fillStyle(0x000000, TUNNEL_DEPTH * k * (1 - t) * (1 - t));
      this.gfx.fillRect(0, 0, VIEW.W, inset); // top
      this.gfx.fillRect(0, VIEW.H - inset, VIEW.W, inset); // bottom
      this.gfx.fillRect(0, 0, inset, VIEW.H); // left
      this.gfx.fillRect(VIEW.W - inset, 0, inset, VIEW.H); // right
    }
  }
}

export default WarpField;
