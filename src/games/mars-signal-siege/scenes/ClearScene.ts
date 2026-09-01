/* Mars: Signal Siege — the boss's parting shot.
 *
 * This screen used to be a receipt: a fanfare, a tick, a list of what the
 * player had earned. It is now the card the DEFEATED BOSS gets, and the reward
 * has been demoted to a strip along the bottom, because the reward is not the
 * interesting thing that happens at the end of a mission — the interesting
 * thing is that the machine you just switched off is entirely unrepentant.
 *
 * Treated like the title screen rather than like a menu: the sector's own key
 * art at full bleed, the boss standing in it at fighting size, and one line of
 * lettering big enough to be the point of the picture.
 *
 * On the taunts themselves: every one of them mocks a product CLASS — the
 * proprietary button, the required installer, the format gate, the walled
 * garden, the adapter under the table — and never a company. That is a hard
 * rule for this game and `test:mars` enforces it over mission text.
 */

import Phaser from "phaser";
import { VIEW } from "../tuning";
import { getCtx } from "../context";
import { MISSIONS, WEAPONS, FINAL_MISSION } from "../data";
import { SHEET, environmentKey } from "../assets";
import { frameOf } from "../anims";
import { SCENE } from "./PreloadScene";
import { label, PALETTE } from "./ui";

/** Where the lettering column ends and the boss's half of the frame begins. */
const COLUMN_W = 336;

export class ClearScene extends Phaser.Scene {
  private boss?: Phaser.GameObjects.Sprite;
  private flicker = 0;

  constructor() {
    super(SCENE.CLEAR);
  }

  create(): void {
    const ctx = getCtx(this);
    const index = ctx.run.mission;
    const m = MISSIONS[index];
    /* Reused scene instance: nothing may survive from the last mission. */
    this.boss = undefined;
    this.flicker = 0;

    /* The sector's own backdrop, still in the texture cache from the mission
       that just ended, so this costs nothing to load and the card is unmistakably
       THIS sector rather than a generic plate. */
    const backdrop = environmentKey(m.environment);
    const artKey = this.textures.exists(backdrop) ? backdrop
      : this.textures.exists("mss-boss-gate") ? "mss-boss-gate" : null;
    if (artKey) {
      this.add.image(VIEW.W / 2, VIEW.H / 2, artKey).setDisplaySize(VIEW.W, VIEW.H);
    } else {
      this.add.rectangle(0, 0, VIEW.W, VIEW.H, 0x140b1c).setOrigin(0, 0);
    }
    /* Two scrims rather than one: a light wash over the whole frame so the art
       reads as night, and a heavier one under the lettering column only, so the
       taunt never has to compete with whatever the backdrop is doing behind it.
       A single flat dim dark enough for text kills the art. */
    this.add.rectangle(0, 0, VIEW.W, VIEW.H, 0x05040a, 0.58).setOrigin(0, 0);
    const scrim = this.add.graphics();
    scrim.fillStyle(0x05040a, 0.74);
    scrim.fillRect(0, 0, COLUMN_W, VIEW.H);
    /* Feathered inner edge, so the column does not end on a hard vertical line
       drawn straight down the middle of the picture. */
    for (let i = 0; i < 26; i++) {
      scrim.fillStyle(0x05040a, 0.74 * (1 - i / 26));
      scrim.fillRect(COLUMN_W + i, 0, 1, VIEW.H);
    }

    /* The boss, beaten but still on its feet: seated on the floor line, tilted
       off true, and drained of colour rather than removed from the frame. */
    if (this.textures.exists(SHEET.bosses.key)) {
      this.boss = this.add.sprite(
        468, 344, SHEET.bosses.key, frameOf("bosses.png", `boss${index}_idle`),
      );
      this.boss.setOrigin(0.5, 1);
      this.boss.setScale(1.05);
      this.boss.setTint(0x6f6288);
      this.boss.setAngle(5);
    }

    label(this, 24, 26, `${m.sector.toUpperCase()}  ·  RESTORED`, {
      size: 8, color: m.accent,
    });
    label(this, 24, 42, m.boss.toUpperCase(), {
      size: m.boss.length > 20 ? 15 : 19, color: PALETTE.text, wrap: COLUMN_W - 48,
    });
    label(this, 24, m.boss.length > 20 ? 82 : 70, "DISCONNECTED — AND UNREPENTANT", {
      size: 7, color: PALETTE.bad,
    });

    const rule = this.add.graphics();
    rule.fillStyle(Number(m.accent.replace("#", "0x")), 0.85);
    rule.fillRect(24, 98, 44, 2);

    /* The taunt is the headline of this screen, so it is set at reading size
       and given the width of the column, not squeezed into a caption. */
    label(this, 24, 114, `"${m.taunt}"`, {
      size: 11, color: PALETTE.text, wrap: COLUMN_W - 48,
    });

    /* The reward, demoted to a footer strip. */
    const footer = this.add.graphics();
    footer.fillStyle(0x0b0813, 0.9);
    footer.fillRect(0, VIEW.H - 62, COLUMN_W, 40);
    if (this.textures.exists(SHEET.shots.key)) {
      this.add.sprite(38, VIEW.H - 42, SHEET.shots.key,
        frameOf("projectiles.png", `pshot${m.grant}`)).setScale(1.3);
    }
    label(this, 58, VIEW.H - 54, `${m.capability.toUpperCase()} ONLINE`, {
      size: m.capability.length > 18 ? 9 : 11, color: PALETTE.cyan,
    });
    label(this, 58, VIEW.H - 40, WEAPONS[m.grant].role, {
      size: 7, color: PALETTE.dim, wrap: COLUMN_W - 76,
    });

    const cleared = ctx.progress.cleared.length;
    const last = index === FINAL_MISSION;
    label(this, 24, VIEW.H - 16,
      last ? "ENTER  ·  WATCH IT COME APART"
      : cleared >= 11 ? "ENTER  ·  THE LOCK-IN CORE IS OPEN"
      : `ENTER  ·  RETURN TO MARS   (${11 - cleared} SECTORS SEALED)`, {
      size: 8, color: cleared >= 11 || last ? PALETTE.accent : PALETTE.dim,
    });

    ctx.audio.playMusic("taunt");
  }

  update(_time: number, deltaMs: number): void {
    const ctx = getCtx(this);

    /* A slow, shallow pulse on the tint: the thing is still powered, barely.
       Decoration only, so a reduced-motion visitor simply does not get it. */
    if (this.boss && !ctx.reduced) {
      this.flicker += deltaMs / 1000;
      const k = 0.5 + 0.5 * Math.sin(this.flicker * 2.1);
      const v = Math.round(0x6f + k * 0x20);
      this.boss.setTint((v << 16) | (0x62 << 8) | 0x88);
    }

    if (ctx.input.take("Enter", "Space", "Escape")) {
      ctx.audio.play("uiConfirm");
      if (ctx.run.mission === FINAL_MISSION) {
        /* The final boss gets a card like everybody else, and the ending picks
           up from it rather than from the fight. */
        ctx.run.victoryPhase = "coreDown";
        this.scene.start(SCENE.VICTORY);
        return;
      }
      /* Land on the next sector rather than the one just finished — the player
         has to press right eleven times otherwise. */
      const next = Math.min(FINAL_MISSION, ctx.run.mission + 1);
      this.scene.start(SCENE.SELECT, { selected: next });
    }
  }
}
