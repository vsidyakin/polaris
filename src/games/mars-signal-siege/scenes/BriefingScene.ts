/* Mars: Signal Siege — mission briefing.
 *
 * Every mission gets one, and it answers the four questions the brief sets:
 * who the boss is, what product-class behaviour it stands for, what it has
 * done to the signal network, and what capability actually beats it.
 *
 * The mission's own artwork loads while this screen is up, which is why the
 * briefing exists at this point in the flow rather than as a modal over the
 * grid — it is the loading screen, doing something useful.
 */

import Phaser from "phaser";
import { VIEW } from "../tuning";
import { getCtx } from "../context";
import { MISSIONS, WEAPONS, BOSS_PROFILES } from "../data";
import { missionArt, missionAudio, PLAY_ART, SFX_ASSETS, SHEET } from "../assets";
import { frameOf } from "../anims";
import { SCENE, queueArt, queueAudio, openGate, releaseGate } from "./PreloadScene";
import { label, PALETTE, panel } from "./ui";

export class BriefingScene extends Phaser.Scene {
  private ready = false;

  constructor() {
    super(SCENE.BRIEFING);
  }

  /**
   * The briefing screen is the loading gate, which is why it exists at this
   * point in the flow rather than as a modal over the mission grid.
   *
   * Everything gameplay needs is queued here and blocks until it lands. The
   * title screen also streams PLAY_ART and the effects opportunistically, but
   * that stream is abandoned the instant the player presses ENTER — Phaser's
   * loader resets on scene shutdown — so it is a warm-up, never a guarantee.
   * Queuing here is idempotent: anything already cached is skipped.
   */
  preload(): void {
    const ctx = getCtx(this);
    /* This is the load the player actually waits on — a backdrop, a terrain
       pair and a mission's worth of cues — and until now it happened behind the
       previous screen with nothing to show for it. */
    openGate(this, `Deploying to ${MISSIONS[ctx.run.mission].sector}`);
    queueArt(this.load, missionArt(ctx.run.mission));
    queueArt(this.load, PLAY_ART);
    queueAudio(this.load, SFX_ASSETS);
    queueAudio(this.load, missionAudio(ctx.run.mission));
  }

  create(): void {
    releaseGate(this);
    const ctx = getCtx(this);
    const index = ctx.run.mission;
    const m = MISSIONS[index];
    const accentColor = Phaser.Display.Color.HexStringToColor(m.accent).color;

    const panelKey = index % 2 ? "mss-panel-b" : "mss-panel-a";
    if (this.textures.exists(panelKey)) {
      this.add.image(VIEW.W / 2, VIEW.H / 2, panelKey).setDisplaySize(VIEW.W, VIEW.H);
    }
    this.add.rectangle(0, 0, VIEW.W, VIEW.H, 0x05040a, 0.9).setOrigin(0, 0);

    /* Accent spine, the one piece of chrome carried over from v0.7's briefing. */
    this.add.rectangle(38, 35, 5, 272, accentColor).setOrigin(0, 0);

    label(this, 58, 32, `SECTOR ${String(index + 1).padStart(2, "0")}`, {
      size: 9, color: PALETTE.warn,
    });
    label(this, 58, 46, m.sector, { size: 20, color: m.accent });
    label(this, 58, 72, `THREAT  ${m.threat}`, { size: 9, color: PALETTE.dim });

    label(this, 58, 96, m.briefing, {
      size: 9, color: PALETTE.text, wrap: 372,
    });

    label(this, 58, 186, `OBJECTIVE  ${m.objective}`, {
      size: 8, color: PALETTE.cyan, wrap: 372,
    });

    /* Boss card: portrait, name, the tell, and the weakness. The weakness is
       stated outright — a fight the player can only solve by dying to it
       eleven times is not a puzzle, it is a toll. */
    panel(this, 452, 40, 152, 172, m.accent, "#120e20", 0.94);
    if (this.textures.exists(SHEET.bosses.key)) {
      const portrait = this.add.sprite(528, 168, SHEET.bosses.key,
        frameOf("bosses.png", `boss${index}_idle`));
      portrait.setOrigin(0.5, 1);
      portrait.setScale(0.62);
    }
    label(this, 528, 48, m.boss, {
      size: m.boss.length > 18 ? 7 : 9, color: PALETTE.text, align: "center", wrap: 140,
    });
    label(this, 528, 176, `TELL  ${BOSS_PROFILES[index].tell}`, {
      size: 7, color: PALETTE.dim, align: "center", wrap: 140,
    });
    label(this, 528, 194, `WEAK TO  ${WEAPONS[m.weak].name}`, {
      size: 7, color: PALETTE.accent, align: "center", wrap: 140,
    });

    panel(this, 58, 236, 372, 44, PALETTE.panelEdge, "#120e20", 0.9);
    label(this, 66, 242, `ON CLEAR  ${m.capability}`, { size: 8, color: PALETTE.warn });
    label(this, 66, 258, WEAPONS[m.grant].role, { size: 7, color: PALETTE.dim });

    label(this, VIEW.W / 2, VIEW.H - 42, "ENTER  DEPLOY        ESC  MISSION CONTROL", {
      size: 9, color: PALETTE.accent, align: "center",
    });

    ctx.audio.playMusic("introduction");
    this.ready = true;
  }

  update(): void {
    if (!this.ready) return;
    const ctx = getCtx(this);

    if (ctx.input.take("Escape")) {
      ctx.audio.play("pause");
      this.scene.start(SCENE.SELECT, { selected: ctx.run.mission });
      return;
    }
    if (ctx.input.take("Enter", "Space")) {
      ctx.audio.play("deploy");
      this.scene.start(SCENE.PLAY);
    }
  }
}
