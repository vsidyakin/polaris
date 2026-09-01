/* Mars: Signal Siege — the ending.
 *
 * Two beats, driven by the audio rather than by a timer, which is what keeps
 * the picture and the music in step:
 *
 *   1. The Lock-In Engine comes apart over the "alien dead" cue.
 *   2. The credits scroll bottom to top over the credits cue.
 *
 * The crawl is the one place the game states its own thesis, so it names what
 * Rook actually switched off — dongles, installers, proprietary buttons,
 * siloed consoles, closed ecosystems — as behaviours, not as companies.
 */

import Phaser from "phaser";
import { VIEW } from "../tuning";
import { getCtx } from "../context";
import { ENDING_CRAWL } from "../data";
import { SCENE } from "./PreloadScene";
import { label, PALETTE } from "./ui";

const LINE_HEIGHT = 17;
/** Pixels per second. Slow enough to read aloud, which is the right test. */
const SCROLL_SPEED = 24;

export class VictoryScene extends Phaser.Scene {
  private phase: "collapse" | "credits" = "collapse";
  private crawl?: Phaser.GameObjects.Container;
  private collapseT = 0;
  private debris?: Phaser.GameObjects.Particles.ParticleEmitter;
  private finished = false;

  constructor() {
    super(SCENE.VICTORY);
  }

  create(): void {
    const ctx = getCtx(this);
    ctx.run.victoryPhase = "coreDown";
    /* Reused scene instance — reset every field the previous ending left set. */
    this.phase = "collapse";
    this.collapseT = 0;
    this.finished = false;
    this.crawl = undefined;

    if (this.textures.exists("mss-boss-gate")) {
      this.add.image(VIEW.W / 2, VIEW.H / 2, "mss-boss-gate").setDisplaySize(VIEW.W, VIEW.H);
    }
    this.add.rectangle(0, 0, VIEW.W, VIEW.H, 0x05040a, 0.6).setOrigin(0, 0).setDepth(1);

    label(this, VIEW.W / 2, 118, "THE LOCK-IN ENGINE IS OFFLINE", {
      size: 17, color: PALETTE.text, align: "center",
    }).setDepth(3);
    label(this, VIEW.W / 2, 148, "MARS SIGNAL NETWORK  ·  OPEN", {
      size: 10, color: PALETTE.accent, align: "center",
    }).setDepth(3);

    /* The core coming apart, as particles rather than as a still frame. */
    this.debris = this.add.particles(VIEW.W / 2, 170, "mss-shots", {
      lifespan: { min: 700, max: 1900 },
      speed: { min: 30, max: 210 },
      scale: { start: 0.5, end: 0 },
      gravityY: 90,
      quantity: 2,
      frequency: 40,
      tint: [0xf0a45d, 0xe07856, 0xffffff],
    }).setDepth(2);
    if (!this.textures.exists("mss-shots")) this.debris.destroy();

    ctx.audio.playMusic("coreDown");
  }

  update(_time: number, deltaMs: number): void {
    const ctx = getCtx(this);
    const dt = Math.min(0.05, deltaMs / 1000);

    if (this.phase === "collapse") {
      this.collapseT += dt;
      /* The destruction cue is nine seconds; hand over a beat before it ends so
         the credits music starts under the last of the debris rather than after
         a silence. */
      if (this.collapseT > 7.6 || ctx.input.take("Enter", "Space")) {
        this.startCredits();
      }
      return;
    }

    if (this.crawl) {
      this.crawl.y -= SCROLL_SPEED * dt * (ctx.input.down("KeyX", "KeyJ") ? 3 : 1);
      const done = this.crawl.y + ENDING_CRAWL.length * LINE_HEIGHT < -40;
      if (done && !this.finished) {
        this.finished = true;
        label(this, VIEW.W / 2, VIEW.H / 2, "ENTER  ·  RETURN TO TITLE", {
          size: 10, color: PALETTE.accent, align: "center",
        }).setDepth(5);
      }
    }

    if (ctx.input.take("Enter", "Escape")) {
      ctx.audio.play("uiConfirm");
      ctx.run.mission = 0;
      this.scene.start(SCENE.TITLE);
    }
  }

  private startCredits(): void {
    const ctx = getCtx(this);
    this.phase = "credits";
    ctx.run.victoryPhase = "credits";
    this.debris?.stop();
    this.add.rectangle(0, 0, VIEW.W, VIEW.H, 0x05040a, 0.94).setOrigin(0, 0).setDepth(4);

    /* Bottom to top, as specified: the container starts below the viewport and
       is translated upward, so nothing has to be re-laid-out per frame. */
    this.crawl = this.add.container(0, VIEW.H + 20).setDepth(5);
    ENDING_CRAWL.forEach((line, i) => {
      const heading = line === line.toUpperCase() && line.trim().length > 0;
      this.crawl!.add(label(this, VIEW.W / 2, i * LINE_HEIGHT, line, {
        size: heading ? 12 : 9,
        color: heading ? PALETTE.accent : PALETTE.text,
        align: "center",
      }));
    });

    ctx.audio.playMusic("epilogue");
  }
}
