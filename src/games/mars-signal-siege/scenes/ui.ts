/* Mars: Signal Siege — shared screen furniture.
 *
 * The controls, mission tiles and briefing panels are drawn as real Phaser
 * objects rather than as a DOM modal over the canvas, because the brief asks
 * for integrated game UI: an easter egg that stops being a game to show you a
 * browser dialog has broken its own spell.
 *
 * Text uses the same weighted monospace the standalone used, at logical sizes,
 * with resolution bumped so type stays crisp when Phaser scales the canvas up.
 */

import Phaser from "phaser";
import { VIEW } from "../tuning";

export const PALETTE = {
  ink: "#05040a",
  panel: "#120e20",
  panelEdge: "#44375c",
  text: "#f7f3ff",
  dim: "#aaa0b8",
  accent: "#7ce3a8",
  warn: "#f0a45d",
  bad: "#e07856",
  cyan: "#61c8dc",
} as const;

const FAMILY = "Consolas, ui-monospace, SFMono-Regular, Menlo, monospace";

export interface TextOptions {
  size?: number;
  color?: string;
  align?: "left" | "center" | "right";
  wrap?: number;
}

export function label(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  opts: TextOptions = {},
): Phaser.GameObjects.Text {
  const size = opts.size ?? 10;
  const t = scene.add.text(x, y, text, {
    fontFamily: FAMILY,
    fontSize: `${size}px`,
    fontStyle: "700",
    color: opts.color ?? PALETTE.text,
    align: opts.align ?? "left",
    wordWrap: opts.wrap ? { width: opts.wrap } : undefined,
  });
  /* Render the glyphs at the device scale rather than at logical size, so the
     8px HUD type is not a blurry upscale of an 8px raster. */
  t.setResolution(Math.max(2, VIEW.ZOOM * 2));
  if (opts.align === "center") t.setOrigin(0.5, 0);
  else if (opts.align === "right") t.setOrigin(1, 0);
  return t;
}

/** A bordered panel, the game's one repeated container shape. */
export function panel(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  accent: string = PALETTE.panelEdge,
  fill: string = PALETTE.panel,
  alpha = 1,
): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  g.fillStyle(Phaser.Display.Color.HexStringToColor(fill).color, alpha);
  g.fillRect(x, y, w, h);
  g.lineStyle(1, Phaser.Display.Color.HexStringToColor(accent).color, 1);
  g.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  return g;
}

export function dim(scene: Phaser.Scene, alpha = 0.86): Phaser.GameObjects.Rectangle {
  return scene.add
    .rectangle(0, 0, VIEW.W, VIEW.H, Phaser.Display.Color.HexStringToColor(PALETTE.ink).color, alpha)
    .setOrigin(0, 0);
}

/**
 * The controls strip.
 *
 * Shown as game UI on the title and pause screens. Deliberately never mentions
 * the thirty-life sequence — the brief is explicit that the secret is not to be
 * advertised, and a "hidden" code printed on the title screen is just a
 * feature with extra steps.
 */
export const CONTROLS_LINES = [
  "ARROWS / WASD  MOVE + AIM      DOWN  PRONE",
  "SPACE / Z  JUMP        X / J  FIRE",
  "P  PAUSE + LOADOUT     M  SOUND     F  VIEW",
  "ESC  PAUSE / BACK / CLOSE",
] as const;

export function controlsStrip(
  scene: Phaser.Scene,
  y: number,
  color: string = PALETTE.accent,
): Phaser.GameObjects.Text[] {
  return CONTROLS_LINES.map((line, i) =>
    label(scene, VIEW.W / 2, y + i * 12, line, { size: 8, color, align: "center" }),
  );
}

/** A short-lived message bar, used for pickups, denials and mute state. */
export class Toast {
  private scene: Phaser.Scene;
  private bg: Phaser.GameObjects.Graphics;
  private text: Phaser.GameObjects.Text;
  private life = 0;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.bg = scene.add.graphics().setScrollFactor(0).setDepth(900);
    this.text = label(scene, VIEW.W / 2, 22, "", {
      size: 10, color: PALETTE.accent, align: "center",
    }).setScrollFactor(0).setDepth(901);
    this.hide();
  }

  show(message: string, seconds = 2): void {
    this.text.setText(message);
    this.life = seconds;
    const w = Math.min(560, message.length * 7 + 28);
    this.bg.clear();
    this.bg.fillStyle(0x07050d, 0.95);
    this.bg.fillRect((VIEW.W - w) / 2, 14, w, 26);
    this.bg.lineStyle(1, 0x7ce3a8, 1);
    this.bg.strokeRect((VIEW.W - w) / 2 + 0.5, 14.5, w - 1, 25);
    this.bg.setVisible(true);
    this.text.setVisible(true);
  }

  update(dt: number): void {
    if (this.life <= 0) return;
    this.life -= dt;
    if (this.life <= 0) this.hide();
  }

  private hide(): void {
    this.bg.setVisible(false);
    this.text.setVisible(false);
  }

  destroy(): void {
    this.bg.destroy();
    this.text.destroy();
  }
}
