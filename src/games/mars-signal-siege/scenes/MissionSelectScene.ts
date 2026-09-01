/* Mars: Signal Siege — mission select.
 *
 * A full game screen, not a list: twelve tiles in a 4x3 grid, each showing its
 * sector, its boss, and one of five states the brief names explicitly —
 * cleared, available, locked, final-locked, final-available.
 *
 * The final tile is drawn differently from the other eleven whether or not it
 * is open, because "the last one is special" should be legible before the
 * player has earned it.
 */

import Phaser from "phaser";
import { VIEW } from "../tuning";
import { getCtx } from "../context";
import { MISSIONS, FINAL_MISSION, REGULAR_MISSIONS } from "../data";
import type { Mission } from "../data";
import { isUnlocked, lockReason } from "../progress";
import { SELECT_ART, SHEET } from "../assets";
import { frameOf, registerAnimations } from "../anims";
import { SCENE, queueArt, openGate, releaseGate } from "./PreloadScene";
import { label, PALETTE, panel, Toast } from "./ui";

/* The grid has to fit inside 360 logical pixels alongside a header and two
   footer lines. The previous numbers (header at 74, three 86-tall rows with
   10px gaps) ran to y=352 and put the bottom row underneath the footer text.
   These are chosen so the whole screen closes at y=344 with room to spare:
       header 8..40 | grid 46..292 | detail 300 | controls 322 */
const COLS = 4;
const ROWS = 3;
const TILE_W = 146;
const TILE_H = 74;
const GAP_X = 10;
const GAP_Y = 8;
const GRID_X = (VIEW.W - (COLS * TILE_W + (COLS - 1) * GAP_X)) / 2;
const GRID_Y = 46;
/** Height of the dark strip the tile's captions sit on. */
const CAPTION_H = 24;

type TileState = "cleared" | "available" | "locked" | "final-locked" | "final-available";

/**
 * The one colour a tile is allowed to be, for a given state.
 *
 * "Cleared" used to fall through to `mission.accent`, which is a different
 * colour for every sector — so clearing a mission changed its tile, but it
 * changed it to a different colour each time and the board never taught the
 * player what "done" looks like. A cleared tile is now the same green
 * everywhere, and `mission.accent` is reserved for sectors still live.
 */
function tileAccent(state: TileState, mission: Mission): string {
  if (state === "final-available") return "#ffffff";
  if (state === "cleared") return PALETTE.accent;
  if (state === "locked" || state === "final-locked") return "#3a3348";
  return mission.accent;
}

export class MissionSelectScene extends Phaser.Scene {
  private selected = 0;
  private tiles: Phaser.GameObjects.Container[] = [];
  private toast!: Toast;
  private detail!: Phaser.GameObjects.Text;
  private cursor!: Phaser.GameObjects.Graphics;

  constructor() {
    super(SCENE.SELECT);
  }

  init(data: { selected?: number }): void {
    if (typeof data?.selected === "number") this.selected = data.selected;
  }

  /* Guarantees the boss portraits rather than trusting the title screen's
     opportunistic stream, which a fast ENTER cancels. Cached assets are
     skipped, so this normally costs nothing. */
  preload(): void {
    openGate(this, "Reading sector telemetry");
    queueArt(this.load, SELECT_ART);
  }

  create(): void {
    releaseGate(this);
    const ctx = getCtx(this);
    /* Reused scene instance: without this the array accumulates a dozen stale
       container references per visit. */
    this.tiles.length = 0;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.toast?.destroy();
      this.tiles.length = 0;
    });
    registerAnimations(this);
    this.add.rectangle(0, 0, VIEW.W, VIEW.H, 0x0a0812).setOrigin(0, 0);

    label(this, VIEW.W / 2, 8, "MISSION CONTROL  ·  MARS", {
      size: 14, color: PALETTE.text, align: "center",
    });
    const cleared = ctx.progress.cleared.length;
    label(this, VIEW.W / 2, 27, `${cleared} / ${REGULAR_MISSIONS} SECTORS RESTORED`, {
      size: 9, color: cleared >= REGULAR_MISSIONS ? PALETTE.accent : PALETTE.warn,
      align: "center",
    });

    this.cursor = this.add.graphics();
    for (let i = 0; i < MISSIONS.length; i++) this.tiles.push(this.buildTile(i));

    this.detail = label(this, VIEW.W / 2, GRID_Y + ROWS * TILE_H + (ROWS - 1) * GAP_Y + 8, "", {
      size: 9, color: PALETTE.dim, align: "center",
    });
    label(this, VIEW.W / 2, VIEW.H - 26,
      "ARROWS  SELECT      ENTER  DEPLOY      ESC  TITLE", {
      size: 8, color: PALETTE.accent, align: "center",
    });

    this.toast = new Toast(this);
    ctx.audio.playMusic("introduction");
    this.paint();
  }

  private stateOf(index: number): TileState {
    const ctx = getCtx(this);
    const unlocked = isUnlocked(ctx.progress, index);
    if (index === FINAL_MISSION) return unlocked ? "final-available" : "final-locked";
    if (ctx.progress.cleared.includes(index)) return "cleared";
    return unlocked ? "available" : "locked";
  }

  private buildTile(index: number): Phaser.GameObjects.Container {
    const col = index % COLS;
    const row = Math.floor(index / COLS);
    const x = GRID_X + col * (TILE_W + GAP_X);
    const y = GRID_Y + row * (TILE_H + GAP_Y);
    const mission = MISSIONS[index];
    const container = this.add.container(x, y);

    const state = this.stateOf(index);
    const locked = state === "locked" || state === "final-locked";
    const accent = tileAccent(state, mission);

    container.add(panel(this, 0, 0, TILE_W, TILE_H, accent,
      locked ? "#0d0a16" : "#150f22", 1));

    /* The boss portrait leads the tile: the roster is what the player is
       choosing between, and a sector name alone does not tell them which fight
       they are picking. It is seated in the space ABOVE the caption strip and
       scaled to fit it, rather than filling the whole tile — previously it was
       drawn at the tile's full height and the captions were printed straight
       across its chest. */
    if (this.textures.exists(SHEET.bosses.key)) {
      const portraitBand = TILE_H - CAPTION_H;
      const portrait = this.add.sprite(
        TILE_W / 2, portraitBand - 2, SHEET.bosses.key,
        frameOf("bosses.png", `boss${index}_idle`),
      );
      portrait.setOrigin(0.5, 1);
      /* Boss cells are 192 tall; fit the tallest into the band with a margin. */
      portrait.setScale((portraitBand - 8) / 192);
      portrait.setTint(locked ? 0x2a2338 : 0xffffff);
      container.add(portrait);
    }

    /* A solid strip under the captions, so text never has to compete with the
       artwork behind it. */
    const caption = this.add.graphics();
    caption.fillStyle(locked ? 0x0b0813 : 0x110c1d, 0.94);
    caption.fillRect(1, TILE_H - CAPTION_H, TILE_W - 2, CAPTION_H - 1);
    container.add(caption);

    container.add(label(this, 5, 4, String(index + 1).padStart(2, "0"), {
      size: 9, color: locked ? "#4a4260" : accent,
    }));
    container.add(label(this, TILE_W - 5, 4,
      state === "cleared" ? "CLEAR"
      : state === "final-available" ? "OPEN"
      : locked ? "LOCKED" : "READY", {
      size: 7,
      color: state === "cleared" ? PALETTE.accent
           : locked ? "#4a4260" : PALETTE.warn,
      align: "right",
    }));

    const name = locked && index === FINAL_MISSION ? "??????????" : mission.sector;
    container.add(label(this, TILE_W / 2, TILE_H - CAPTION_H + 3, name, {
      size: name.length > 17 ? 7 : 8,
      color: locked ? "#5b5273" : PALETTE.text,
      align: "center",
    }));
    container.add(label(this, TILE_W / 2, TILE_H - CAPTION_H + 13,
      locked && index === FINAL_MISSION ? "SEALED" : mission.boss, {
      size: mission.boss.length > 18 ? 6 : 7,
      color: locked ? "#463e5c" : PALETTE.dim,
      align: "center",
    }));

    return container;
  }

  private paint(): void {
    const mission = MISSIONS[this.selected];
    const state = this.stateOf(this.selected);
    const col = this.selected % COLS;
    const row = Math.floor(this.selected / COLS);
    const x = GRID_X + col * (TILE_W + GAP_X);
    const y = GRID_Y + row * (TILE_H + GAP_Y);

    this.cursor.clear();
    const accent = Phaser.Display.Color.HexStringToColor(
      tileAccent(state, MISSIONS[this.selected]),
    ).color;
    this.cursor.lineStyle(2, accent, 1);
    this.cursor.strokeRect(x - 2.5, y - 2.5, TILE_W + 5, TILE_H + 5);

    const locked = state === "locked" || state === "final-locked";
    this.detail.setText(
      locked ? lockReason(getCtx(this).progress, this.selected)
             : `${mission.threat}  ·  ${mission.geometry}`,
    );
    this.detail.setColor(locked ? PALETTE.bad : PALETTE.dim);
  }

  update(_time: number, delta: number): void {
    const ctx = getCtx(this);
    this.toast.update(delta / 1000);

    const before = this.selected;
    if (ctx.input.take("ArrowRight", "KeyD")) this.selected = Math.min(MISSIONS.length - 1, this.selected + 1);
    if (ctx.input.take("ArrowLeft", "KeyA")) this.selected = Math.max(0, this.selected - 1);
    if (ctx.input.take("ArrowDown", "KeyS")) this.selected = Math.min(MISSIONS.length - 1, this.selected + COLS);
    if (ctx.input.take("ArrowUp", "KeyW")) this.selected = Math.max(0, this.selected - COLS);
    if (this.selected !== before) {
      ctx.audio.play("uiMove");
      this.paint();
    }

    if (ctx.input.take("Escape")) {
      ctx.audio.play("pause");
      this.scene.start(SCENE.TITLE);
      return;
    }

    if (ctx.input.take("Enter", "Space")) {
      if (isUnlocked(ctx.progress, this.selected)) {
        ctx.audio.play("uiConfirm");
        ctx.run.mission = this.selected;
        this.scene.start(SCENE.BRIEFING);
      } else {
        ctx.audio.play("deny");
        this.toast.show(lockReason(ctx.progress, this.selected), 2.4);
      }
    }
  }

}

/* Rows/cols are exported so the integration test can assert the grid actually
   holds twelve tiles rather than silently clipping the last row. */
export const GRID = { COLS, ROWS, TILE_W, TILE_H };
