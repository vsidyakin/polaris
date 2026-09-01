/* Mars: Signal Siege — game over.
 *
 * Retry drops back to the briefing for the same sector rather than to mission
 * select: the player already chose, and making them choose again is friction
 * pretending to be a menu. Cleared sectors are untouched — losing a run has
 * never cost campaign progress here.
 */

import Phaser from "phaser";
import { VIEW } from "../tuning";
import { getCtx } from "../context";
import { MISSIONS } from "../data";
import { SCENE } from "./PreloadScene";
import { label, PALETTE } from "./ui";

export class GameOverScene extends Phaser.Scene {
  constructor() {
    super(SCENE.GAMEOVER);
  }

  create(): void {
    const ctx = getCtx(this);
    const m = MISSIONS[ctx.run.mission];

    this.add.rectangle(0, 0, VIEW.W, VIEW.H, 0x05040a).setOrigin(0, 0);
    label(this, VIEW.W / 2, 118, "SIGNAL LOST", {
      size: 38, color: PALETTE.bad, align: "center",
    });
    label(this, VIEW.W / 2, 168, `${m.sector} REMAINS CLOSED`, {
      size: 12, color: PALETTE.text, align: "center",
    });
    label(this, VIEW.W / 2, 196,
      `${ctx.progress.cleared.length} SECTORS STILL RESTORED  ·  PROGRESS KEPT`, {
      size: 8, color: PALETTE.dim, align: "center",
    });

    label(this, VIEW.W / 2, 236, "ENTER  ·  RETRY BRIEFING", {
      size: 10, color: PALETTE.accent, align: "center",
    });
    label(this, VIEW.W / 2, 256, "ESC  ·  MISSION CONTROL", {
      size: 9, color: PALETTE.dim, align: "center",
    });

    ctx.audio.playMusic("gameover");
  }

  update(): void {
    const ctx = getCtx(this);
    if (ctx.input.take("Enter", "Space")) {
      ctx.audio.play("uiConfirm");
      this.scene.start(SCENE.BRIEFING);
      return;
    }
    if (ctx.input.take("Escape")) {
      ctx.audio.play("pause");
      this.scene.start(SCENE.SELECT, { selected: ctx.run.mission });
    }
  }
}
