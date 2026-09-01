/* Polaris-Man — the renderer.
 *
 * Every draw call from v1.7, ported unchanged, into a 320x180 canvas that
 * Phaser owns as a texture and scales up with nearest-neighbour. Keeping the
 * canvas-2D drawing rather than rebuilding the scene out of Phaser display
 * objects is deliberate: the game's look is hundreds of hand-placed rects,
 * gradients and composite-mode passes, and the brief locks the visuals. A
 * sprite-graph rewrite would be a redesign wearing a port's clothes.
 *
 * What Phaser does own: the texture, the scaling, the frame loop, and the
 * lifecycle. What this file owns: pixels.
 *
 * The locked PNGs are only ever read through drawImage with the source rects
 * from data.ts. Nothing here resamples, tints or filters the artwork except the
 * two places v1.7 did (the title-screen filter and the damage-flash alpha),
 * both preserved as-is.
 */

import {
  AIR_ANCHOR, AIR_FRAMES, BASE_FRAMES, CHECKPOINT_FRAMES, FIGURE_RECTS,
  FINAL_BOSS_FRAMES, FINAL_SHIELDS, OPERATOR_BUST_FRACTION, ORIGINAL_MOONS, PALETTE as P, ROSTERS,
  RUN_FRAMES, SECTOR_TINTS, SURFACE_STYLE, WEAPONS,
  ENEMY_DEF, MISSIONS, type Mission, type MissionId, type MoonId,
} from "./data";
import { TILE_COLS, TILE_H, TILE_W } from "./assets";
import { RELAY, VIEW, WORLD as W_CONST } from "./tuning";
import { clamp, rr } from "./physics";
import type { Boss, EnemyShot, Relay, Shot, World } from "./state";
import type { Solid } from "./physics";

const W = VIEW.W;
const H = VIEW.H;
const FLOOR = W_CONST.FLOOR;

export type ImageGetter = (key: string) => HTMLImageElement | HTMLCanvasElement | null;

export interface RenderContext {
  clock: number;
  reduced: boolean;
  /** Mission-select and title screens have no world. */
  world: World | null;
  mission: Mission | null;
  /** Set while the epilogue crawl is running. */
  epilogueT: number;
  bootT: number;
  charge: number;
}

export class Renderer {
  readonly ctx: CanvasRenderingContext2D;
  private img: ImageGetter;
  /** Deterministic starfield, seeded exactly as v1.7 seeded it. */
  private stars = Array.from({ length: 110 }, (_, i) => ({
    x: (i * 83) % 743,
    y: (i * 47) % 137,
    s: i % 13 === 0 ? 2 : 1,
    p: 0.08 + (i % 5) * 0.08,
  }));

  constructor(ctx: CanvasRenderingContext2D, img: ImageGetter) {
    this.ctx = ctx;
    this.img = img;
    ctx.imageSmoothingEnabled = false;
  }

  /* --- primitives --- */

  private rect(a: number, b: number, w: number, h: number, col: string): void {
    const x = this.ctx;
    x.fillStyle = col;
    x.fillRect(Math.round(a), Math.round(b), Math.round(w), Math.round(h));
  }

  private txt(s: string, a: number, b: number, col: string = P.white, align: CanvasTextAlign = "left", size = 8): void {
    const x = this.ctx;
    x.fillStyle = col;
    x.font = `bold ${size}px "Courier New",monospace`;
    x.textAlign = align;
    x.textBaseline = "top";
    x.fillText(s, Math.round(a), Math.round(b));
  }

  private uiText(s: string, a: number, b: number, col: string = P.white, align: CanvasTextAlign = "left", size = 6, weight = 800): void {
    const x = this.ctx;
    x.save();
    x.fillStyle = col;
    x.font = `${weight} ${size}px "Arial Narrow","Segoe UI",sans-serif`;
    x.textAlign = align;
    x.textBaseline = "middle";
    x.shadowColor = "rgba(0,0,0,.8)";
    x.shadowBlur = 2;
    x.fillText(s, Math.round(a), Math.round(b));
    x.restore();
  }

  private ready(key: string): HTMLImageElement | HTMLCanvasElement | null {
    const im = this.img(key);
    if (!im) return null;
    if (im instanceof HTMLImageElement && (!im.complete || !im.naturalWidth)) return null;
    return im;
  }

  /* --- backdrops --- */

  drawSpace(mission: Mission, cam: number): void {
    const x = this.ctx;
    const gr = x.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, mission.sky[0]);
    gr.addColorStop(1, mission.sky[1]);
    x.fillStyle = gr;
    x.fillRect(0, 0, W, H);
    for (const s of this.stars) {
      let px = (s.x - cam * s.p) % W;
      if (px < 0) px += W;
      this.rect(px, s.y, s.s, s.s, s.s > 1 ? P.lav : "#77708c");
    }
  }

  drawTitle(clock: number, fallbackMission: Mission): void {
    const x = this.ctx;
    const art = this.ready("pm-title-bg");
    if (art) {
      x.save();
      x.filter = "brightness(1.07) contrast(1.12) saturate(1.24)";
      x.drawImage(art, 0, 0, W, H);
      x.restore();
    } else {
      this.drawSpace(fallbackMission, 0);
    }

    const g = x.createLinearGradient(0, 0, 230, 0);
    g.addColorStop(0, "rgba(3,3,12,.91)");
    g.addColorStop(0.65, "rgba(3,3,12,.58)");
    g.addColorStop(1, "rgba(3,3,12,0)");
    x.fillStyle = g;
    x.fillRect(0, 0, 235, H);

    this.rect(16, 15, 112, 2, P.green);
    this.txt("MERSIVE", 18, 21, P.green, "left", 8);
    this.txt("POLARIS-", 16, 39, P.white, "left", 25);
    this.txt("MAN", 16, 64, P.lav, "left", 25);
    this.txt("SIGNAL BREAKER", 18, 96, P.copper, "left", 10);
    this.txt("THE URANUS CAMPAIGN", 18, 111, P.cyan, "left", 6);

    if (Math.floor(clock * 2) % 2 === 0) {
      this.rect(16, 132, 126, 17, "rgba(10,7,24,.82)");
      x.strokeStyle = P.green;
      x.strokeRect(16, 132, 126, 17);
      this.txt("PRESS ENTER / START", 79, 137, P.white, "center", 7);
    }
    this.txt("M  MUTE   ·   F  FULLSCREEN   ·   P  PAUSE", 18, 156, P.white, "left", 5);
    this.txt("ARROWS  MOVE   ·   Z  JUMP   ·   X  FIRE   ·   C  DASH", 18, 166, P.white, "left", 5);
  }

  /**
   * Mission-select backdrop: stars only.
   *
   * v1.7 drew Uranus here — the planet, its ring ellipses and eight orbiting
   * moon markers — as the centrepiece of the screen. The mission grid now
   * covers essentially all of it, so that was a planet rendered every frame to
   * be hidden behind nine tiles, with only its edges showing as stray arcs
   * behind the grid gaps. The starfield is what actually reads.
   */
  drawSelectBackdrop(clock: number, missions: readonly Mission[]): void {
    this.drawSpace(missions[0], 0);
    void clock;
    void missions;
  }

  private bgKey(id: MissionId): string {
    return id === "final" ? "pm-bg-final" : `pm-bg-${id}`;
  }

  private arenaKey(id: MissionId): string {
    if (id === "final") return "pm-bg-final";
    return ORIGINAL_MOONS.has(id) ? `pm-arena-${id}` : `pm-bg-${id}`;
  }

  drawMissionBg(w: World): void {
    const x = this.ctx;
    const id = w.mission.id;
    if (id === "final") {
      const im = this.ready("pm-bg-final");
      if (im) x.drawImage(im, 0, 0, W, H);
      else this.drawSpace(w.mission, w.cam);
      return;
    }

    const arena = w.cam > w.width - 760;
    const im = this.ready(arena ? this.arenaKey(id) : this.bgKey(id));
    if (!im) {
      this.drawSpace(w.mission, w.cam);
      return;
    }

    if (arena) {
      x.drawImage(im, 0, 0, W, H);
    } else {
      /* Parallax: the panel is mirrored on alternate tiles so the seam never
         shows as a hard repeat. */
      const pcam = w.cam * 0.16;
      const tile = Math.floor(pcam / W);
      const off = -(pcam % W);
      for (let i = 0; i < 2; i++) {
        const px = off + i * W;
        if ((tile + i) % 2) {
          x.save();
          x.translate(px + W, 0);
          x.scale(-1, 1);
          x.drawImage(im, 0, 0, W, H);
          x.restore();
        } else {
          x.drawImage(im, px, 0, W, H);
        }
      }
    }
    const sector = clamp(Math.floor((w.cam + W / 2) / 1000), 0, 4);
    this.rect(0, 0, W, H, SECTOR_TINTS[sector]);
  }

  private drawThemeAtmosphere(w: World): void {
    const x = this.ctx;
    const id = w.mission.id;
    const clock = this.clockRef;

    if (id === "final") {
      for (let i = 0; i < 20; i++) {
        const a = clock * 0.35 + i * 0.92;
        const r = 25 + (i % 5) * 11;
        x.globalAlpha = 0.18;
        this.rect(160 + Math.cos(a) * r, 72 + Math.sin(a) * r * 0.35, i % 6 === 0 ? 2 : 1, i % 6 === 0 ? 2 : 1,
          [P.green, P.lav, P.cyan, P.copper][i % 4]);
      }
    } else if (id === "ariel") {
      for (let i = 0; i < 9; i++) {
        const px = ((i * 47 + clock * 12 - w.cam * 0.08) % (W + 20)) - 10;
        x.globalAlpha = 0.22;
        this.rect(px, 34 + ((i * 23) % 91), 5, 2, P.green);
      }
    } else if (id === "umbriel") {
      for (let i = 0; i < 9; i++) {
        const px = ((i * 41 - w.cam * 0.12) % (W + 30)) - 15;
        const h = 8 + (i % 4) * 5;
        x.globalAlpha = 0.25;
        x.fillStyle = "#b9d8ff";
        x.beginPath();
        x.moveTo(px, 145);
        x.lineTo(px + 4, 145 - h);
        x.lineTo(px + 8, 145);
        x.fill();
      }
      for (let i = 0; i < 18; i++) {
        x.globalAlpha = 0.25;
        this.rect((i * 37 + clock * (3 + (i % 3))) % (W + 10), (i * 29 + clock * 8) % 130, 1, 1, "#dff6ff");
      }
    } else if (id === "titania") {
      x.strokeStyle = "rgba(97,200,220,.28)";
      x.lineWidth = 1;
      for (let i = 0; i < 5; i++) {
        const px = ((i * 71 - w.cam * 0.18) % (W + 40)) - 20;
        const py = 35 + (i % 3) * 27;
        x.beginPath();
        x.moveTo(px, py);
        x.lineTo(px + 5, py - 4);
        x.lineTo(px + 10, py + 3);
        x.lineTo(px + 15, py - 2);
        x.stroke();
      }
    } else {
      for (let i = 0; i < 18; i++) {
        const px = ((i * 43 + Math.sin(clock + i) * 8 - w.cam * 0.08) % (W + 20)) - 10;
        const py = 142 - ((clock * (10 + (i % 4)) + i * 17) % 105);
        x.globalAlpha = 0.25 + (i % 3) * 0.08;
        this.rect(px, py, i % 5 === 0 ? 2 : 1, i % 5 === 0 ? 2 : 1, i % 2 ? "#ffb24e" : "#ff673d");
      }
      x.strokeStyle = "rgba(255,112,55,.14)";
      for (let i = 0; i < 4; i++) {
        const yy = 52 + i * 25 + Math.sin(clock * 3 + i) * 3;
        x.beginPath();
        x.moveTo(0, yy);
        x.bezierCurveTo(90, yy - 4, 220, yy + 4, 320, yy);
        x.stroke();
      }
    }
    x.globalAlpha = 1;
  }

  private clockRef = 0;

  drawMissionAtmosphere(w: World): void {
    const x = this.ctx;
    const id = w.mission.id;
    if (ORIGINAL_MOONS.has(id) || id === "final") {
      this.drawThemeAtmosphere(w);
      return;
    }
    const clock = this.clockRef;
    x.save();
    x.globalCompositeOperation = "lighter";

    if (id === "miranda") {
      x.strokeStyle = "rgba(255,76,190,.34)";
      for (let i = 0; i < 7; i++) {
        const py = 34 + i * 19 + Math.sin(clock * 1.8 + i) * 4;
        const px = -30 + ((clock * (18 + i * 2) + i * 53 - w.cam * 0.1) % (W + 60));
        x.beginPath();
        x.moveTo(px, py);
        x.bezierCurveTo(px + 15, py - 8, px + 27, py + 8, px + 43, py);
        x.stroke();
        this.rect(px + 42, py - 1, 4, 3, "#ff7ad1");
      }
    } else if (id === "puckmoon") {
      for (let i = 0; i < 13; i++) {
        const px = ((i * 31 + clock * (8 + (i % 4)) - w.cam * 0.07) % (W + 16)) - 8;
        const py = 26 + ((i * 29) % 118);
        const r = 2 + (i % 3);
        x.globalAlpha = 0.16 + (i % 4) * 0.06;
        x.strokeStyle = i % 2 ? "#bfff3c" : "#bf78ff";
        x.beginPath();
        x.arc(px, py, r + Math.sin(clock * 3 + i), 0, Math.PI * 2);
        x.stroke();
      }
    } else if (id === "cressida") {
      for (let i = 0; i < 6; i++) {
        const yy = 35 + i * 22 + Math.sin(clock * 2 + i) * 2;
        x.globalAlpha = 0.15 + i * 0.025;
        x.strokeStyle = i % 2 ? "#ff5d52" : "#ffca5c";
        x.beginPath();
        x.moveTo(-15, yy);
        x.lineTo(W + 15, yy + Math.sin(clock + i) * 5);
        x.stroke();
        const px = ((clock * (24 + i * 3) + i * 73 - w.cam * 0.16) % (W + 30)) - 15;
        this.rect(px, yy - 2, 12, 1, P.white);
      }
    } else if (id === "desdemona") {
      /* The "portal sprawl": drifting console nodes.
         v1.7 also stroked a line between each consecutive pair, which produced a
         zig-zag constellation sweeping across the playfield — the points move at
         different speeds, so the links swing wildly and read as a glitch rather
         than as a network. The nodes alone carry the idea; the lines are gone. */
      for (let i = 0; i < 10; i++) {
        const px = ((i * 43 + clock * (5 + (i % 3)) - w.cam * 0.08) % (W + 20)) - 10;
        const py = 29 + ((i * 17) % 123);
        x.globalAlpha = 0.5;
        this.rect(px - 1, py - 1, i % 3 ? 2 : 3, i % 3 ? 2 : 3, i % 2 ? "#5fe8ff" : "#ffb451");
      }
    }
    x.restore();
    x.globalAlpha = 1;
    x.globalCompositeOperation = "source-over";
  }

  /* --- sector dressing --- */

  private plaqueShape(px: number, py: number, w: number, h: number): void {
    const x = this.ctx;
    x.beginPath();
    x.moveTo(px + 5, py);
    x.lineTo(px + w - 3, py);
    x.lineTo(px + w, py + 4);
    x.lineTo(px + w - 5, py + h);
    x.lineTo(px + 3, py + h);
    x.lineTo(px, py + h - 4);
    x.closePath();
  }

  private drawSectorPlaque(px: number, py: number, index: number, accent: string): void {
    const x = this.ctx;
    const w = 102;
    const h = 22;
    x.save();
    x.shadowColor = "rgba(0,0,0,.8)";
    x.shadowBlur = 5;
    x.shadowOffsetY = 3;
    this.plaqueShape(px, py, w, h);
    x.fillStyle = "#05040d";
    x.fill();
    x.shadowColor = "transparent";
    this.plaqueShape(px + 1, py + 1, w - 2, h - 2);
    const g = x.createLinearGradient(px, py, px + w, py + h);
    g.addColorStop(0, "#241a43");
    g.addColorStop(0.55, "#15122b");
    g.addColorStop(1, "#0a0818");
    x.fillStyle = g;
    x.fill();
    x.globalAlpha = 0.9;
    x.strokeStyle = accent;
    x.lineWidth = 1;
    this.plaqueShape(px + 2, py + 2, w - 4, h - 4);
    x.stroke();
    x.globalAlpha = 0.18;
    for (let k = 0; k < 4; k++) this.rect(px + 37 + k * 15, py + 4, 9, 1, accent);
    x.globalAlpha = 1;
    this.rect(px + 7, py + 4, 25, 14, "#090713");
    x.strokeStyle = accent;
    x.strokeRect(px + 7.5, py + 4.5, 25, 14);
    this.uiText(String(index + 1).padStart(2, "0"), px + 20, py + 11, P.white, "center", 10, 900);
    this.uiText("SECTOR", px + 39, py + 7.5, accent, "left", 5, 900);
    this.uiText("SIGNAL ROUTE  /  05", px + 39, py + 14.5, P.white, "left", 5, 700);
    this.rect(px + w - 7, py + 5, 2, 12, accent);
    x.restore();
  }

  private drawLegacyPlaque(px: number, py: number, label: string, accent: string): void {
    const x = this.ctx;
    const w = 122;
    const h = 27;
    const pulse = 0.65 + 0.25 * Math.sin(this.clockRef * 4);
    x.save();
    x.strokeStyle = "rgba(247,243,255,.55)";
    x.lineWidth = 1;
    x.beginPath();
    x.moveTo(px + 23, py - 15);
    x.lineTo(px + 23, py);
    x.moveTo(px + w - 23, py - 15);
    x.lineTo(px + w - 23, py);
    x.stroke();
    for (const v of [23, w - 23]) {
      x.fillStyle = "#080613";
      x.beginPath();
      x.arc(px + v, py, 3, 0, Math.PI * 2);
      x.fill();
      x.strokeStyle = accent;
      x.stroke();
    }
    x.shadowColor = "rgba(0,0,0,.9)";
    x.shadowBlur = 7;
    x.shadowOffsetY = 4;
    this.plaqueShape(px, py, w, h);
    x.fillStyle = "#05040d";
    x.fill();
    x.shadowColor = "transparent";
    this.plaqueShape(px + 2, py + 2, w - 4, h - 4);
    const g = x.createLinearGradient(px, py, px + w, py);
    g.addColorStop(0, "#111027");
    g.addColorStop(0.52, "#2b214c");
    g.addColorStop(1, "#0b091b");
    x.fillStyle = g;
    x.fill();
    x.globalAlpha = pulse;
    x.strokeStyle = accent;
    x.lineWidth = 1.2;
    this.plaqueShape(px + 3, py + 3, w - 6, h - 6);
    x.stroke();
    x.globalAlpha = 1;
    this.rect(px + 7, py + 6, 4, 15, accent);
    this.rect(px + w - 11, py + 6, 4, 15, accent);
    this.uiText("LEGACY PROTOCOL", px + w / 2, py + 7.5, accent, "center", 4.5, 900);
    this.uiText(label, px + w / 2, py + 17, P.white, "center", 6, 900);
    x.restore();
  }

  private drawSectorDressing(w: World): void {
    const x = this.ctx;
    if (w.mission.id === "final") return;
    const id = w.mission.id;
    const clock = this.clockRef;

    for (let i = 0; i < w.zoneStarts.length; i++) {
      const z = w.zoneStarts[i];
      const q = z - w.cam;
      if (q > W + 100 || q + 950 < -100) continue;
      this.drawSectorPlaque(q + 16, 23, i, w.mission.accent);

      if (id === "ariel") {
        for (let k = 0; k < 2 + (i % 2); k++) {
          const px = q + 88 + k * 215;
          const hh = 24 + ((i + k) % 3) * 10;
          this.rect(px, 132 - hh, 7, hh, "#151a2c");
          this.rect(px - 4, 130 - hh, 15, 4, P.copper);
          x.strokeStyle = P.green;
          x.globalAlpha = 0.38;
          x.beginPath();
          x.arc(px + 3, 128 - hh, 9 + k * 3, 0, Math.PI * 2);
          x.stroke();
          x.globalAlpha = 1;
        }
      } else if (id === "umbriel") {
        for (let k = 0; k < 3; k++) {
          const px = q + 75 + k * 220;
          const hh = 14 + ((i + k) % 3) * 8;
          x.fillStyle = k % 2 ? P.lav : "#dff6ff";
          x.globalAlpha = 0.48;
          x.beginPath();
          x.moveTo(px, 151);
          x.lineTo(px + 7, 151 - hh);
          x.lineTo(px + 14, 151);
          x.fill();
          x.globalAlpha = 1;
        }
      } else if (id === "titania") {
        for (let k = 0; k < 2; k++) {
          const px = q + 95 + k * 305;
          this.rect(px, 109, 9, 43, "#102a34");
          this.rect(px - 5, 105, 19, 5, P.cyan);
          x.strokeStyle = P.cyan;
          x.globalAlpha = 0.34;
          x.beginPath();
          x.arc(px + 4, 104, 8 + (i % 3) * 3, 0, Math.PI * 2);
          x.stroke();
          x.globalAlpha = 1;
        }
      } else if (id === "oberon") {
        for (let k = 0; k < 2; k++) {
          const px = q + 90 + k * 310;
          this.rect(px, 122, 54, 8, "#341a15");
          this.rect(px + 5, 125, 44, 3, P.copper);
          x.strokeStyle = "#7d3828";
          x.lineWidth = 3;
          x.beginPath();
          x.arc(px + 10, 132, 10, Math.PI, 0);
          x.stroke();
          x.lineWidth = 1;
        }
      }
      void clock;
    }
  }

  /* --- platforms --- */

  private style(id: MissionId) {
    return SURFACE_STYLE[id] ?? SURFACE_STYLE.final;
  }

  private rivet(px: number, py: number, col: string): void {
    this.rect(px, py, 2, 2, "#05040c");
    this.rect(px, py, 1, 1, col);
  }

  private drawSupport(q: number, s: Solid, st: ReturnType<Renderer["style"]>): void {
    const x = this.ctx;
    const top = s.y + s.h + 4;
    const h = FLOOR - top;
    if (h <= 4) return;
    const left = q + Math.min(13, s.w * 0.23);
    const right = q + s.w - Math.min(13, s.w * 0.23);
    const mid = q + s.w / 2;
    x.save();
    x.globalAlpha = 0.84;
    x.strokeStyle = st.deep;
    x.lineWidth = 7;
    x.beginPath();
    x.moveTo(left, top); x.lineTo(left, FLOOR);
    x.moveTo(right, top); x.lineTo(right, FLOOR);
    x.stroke();
    x.strokeStyle = st.metal;
    x.lineWidth = 2;
    x.beginPath();
    x.moveTo(left, top); x.lineTo(left, FLOOR - 2);
    x.moveTo(right, top); x.lineTo(right, FLOOR - 2);
    x.moveTo(left, top + 5); x.lineTo(right, FLOOR - 4);
    x.moveTo(right, top + 5); x.lineTo(left, FLOOR - 4);
    x.stroke();
    x.strokeStyle = st.glow;
    x.globalAlpha = 0.38;
    x.lineWidth = 1;
    x.beginPath();
    x.moveTo(mid, top + 3); x.lineTo(mid, FLOOR - 3);
    x.stroke();
    this.rect(left - 7, FLOOR - 4, 14, 4, "#080613");
    this.rect(right - 7, FLOOR - 4, 14, 4, "#080613");
    x.restore();
  }

  private drawSurfaceDetails(s: Solid, q: number, st: ReturnType<Renderer["style"]>, id: MissionId): void {
    const x = this.ctx;
    const clock = this.clockRef;
    if (id === "umbriel") {
      x.fillStyle = "rgba(223,246,255,.82)";
      for (let k = 12; k < s.w - 4; k += 27) {
        x.beginPath();
        x.moveTo(q + k, s.y + s.h + 4);
        x.lineTo(q + k + 4, s.y + s.h + 10);
        x.lineTo(q + k + 8, s.y + s.h + 4);
        x.fill();
      }
    } else if (id === "oberon") {
      for (let k = 10; k < s.w - 5; k += 23) {
        x.fillStyle = k % 2 ? st.trim : st.glow;
        x.beginPath();
        x.arc(q + k, s.y + 4, 1.8, 0, Math.PI * 2);
        x.fill();
        x.globalAlpha = 0.23;
        this.rect(q + k - 4, s.y - 3, 9, 4, st.glow);
        x.globalAlpha = 1;
      }
    } else if (id === "titania") {
      x.globalAlpha = 0.55 + 0.22 * Math.sin(clock * 8);
      this.rect(q + 5, s.y - 2, s.w - 10, 1, st.glow);
      for (let k = 14; k < s.w; k += 29) this.rect(q + k, s.y - 4, 2, 3, P.white);
      x.globalAlpha = 1;
    } else if (id === "miranda") {
      x.strokeStyle = st.glow;
      x.globalAlpha = 0.72;
      for (let k = 8; k < s.w - 8; k += 34) {
        x.beginPath();
        x.moveTo(q + k, s.y + 4);
        x.bezierCurveTo(q + k + 7, s.y + 1, q + k + 13, s.y + 8, q + k + 20, s.y + 4);
        x.stroke();
      }
      x.globalAlpha = 1;
    } else if (id === "puckmoon") {
      x.strokeStyle = st.glow;
      for (let k = 14; k < s.w - 6; k += 31) {
        x.globalAlpha = 0.5 + 0.3 * Math.sin(clock * 4 + k);
        x.beginPath();
        x.arc(q + k, s.y + 5, 3, 0, Math.PI * 2);
        x.stroke();
      }
      x.globalAlpha = 1;
    } else if (id === "cressida") {
      for (let k = 10; k < s.w - 7; k += 25) {
        this.rect(q + k, s.y + 3, 12, 2, st.trim);
        this.rect(q + k + 4, s.y + 5, 4, 2, st.glow);
      }
    } else if (id === "desdemona") {
      x.strokeStyle = st.glow;
      x.globalAlpha = 0.68;
      for (let k = 10; k < s.w - 12; k += 28) {
        this.rect(q + k, s.y + 4, 3, 3, P.white);
        x.beginPath();
        x.moveTo(q + k + 3, s.y + 5);
        x.lineTo(q + k + 13, s.y + 5);
        x.lineTo(q + k + 17, s.y + 2);
        x.stroke();
      }
      x.globalAlpha = 1;
    }
  }

  private drawPlatform(s: Solid, q: number, w: World): void {
    const x = this.ctx;
    const id = w.mission.id;
    const st = this.style(id);

    if (s.kind === "wall") {
      this.rect(q - 2, s.y, s.w + 4, s.h, "#05040c");
      this.rect(q, s.y, s.w, s.h, st.deep);
      this.rect(q + 3, s.y + 4, s.w - 6, s.h - 7, st.deck);
      this.rect(q - 2, s.y, s.w + 4, 3, P.white);
      this.rect(q, s.y + 3, s.w, 3, st.trim);
      for (let yy = s.y + 11; yy < s.y + s.h - 5; yy += 14) {
        this.rect(q + 3, yy, s.w - 6, 3, st.deep);
        this.rect(q + 5, yy, s.w - 10, 1, st.metal);
        this.rivet(q + 5, yy - 3, st.glow);
        this.rivet(q + s.w - 7, yy - 3, st.glow);
      }
      this.rect(q + s.w / 2 - 2, s.y + 7, 4, s.h - 12, st.deep);
      x.globalAlpha = 0.45;
      this.rect(q + s.w / 2 - 1, s.y + 9, 2, s.h - 16, st.glow);
      x.globalAlpha = 1;
      return;
    }

    if (s.kind === "ground") {
      this.rect(q, s.y, s.w, s.h, "#05040c");
      this.rect(q, s.y, s.w, 2, P.white);
      this.rect(q, s.y + 2, s.w, 3, st.trim);
      this.rect(q, s.y + 5, s.w, 5, st.deck);
      this.rect(q, s.y + 10, s.w, s.h - 10, st.deep);
      const start = Math.max(0, Math.floor((w.cam - s.x) / 32) * 32);
      const end = Math.min(s.w, start + W + 64);
      for (let k = start; k < end; k += 32) {
        const px = q + k;
        this.rect(px + 2, s.y + 7, 27, 2, st.metal);
        this.rect(px + 3, s.y + 12, 26, 8, st.deck);
        this.rect(px + 5, s.y + 14, 10, 2, st.metal);
        this.rect(px + 18, s.y + 14, 8, 2, st.trim);
        x.strokeStyle = "rgba(247,243,255,.18)";
        x.beginPath();
        x.moveTo(px + 3, s.y + 20);
        x.lineTo(px + 29, s.y + 11);
        x.stroke();
        this.rivet(px + 4, s.y + 8, st.glow);
        this.rivet(px + 27, s.y + 18, st.glow);
      }
      return;
    }

    this.drawSupport(q, s, st);
    this.rect(q - 3, s.y + 3, s.w + 6, s.h + 6, "#05040c");
    this.rect(q, s.y, s.w, s.h + 4, st.deep);
    this.rect(q + 2, s.y + 2, s.w - 4, s.h, st.deck);
    this.rect(q, s.y, s.w, 2, P.white);
    this.rect(q + 2, s.y + 2, s.w - 4, 2, st.trim);
    this.rect(q + 4, s.y + s.h, s.w - 8, 3, st.metal);
    for (let k = 7; k < s.w - 4; k += 18) {
      this.rect(q + k, s.y + 4, 11, 2, st.deep);
      this.rect(q + k + 2, s.y + 4, 7, 1, "rgba(247,243,255,.42)");
      this.rivet(q + k - 3, s.y + 4, st.glow);
    }
    this.rect(q - 3, s.y + 3, 4, s.h + 5, st.trim);
    this.rect(q + s.w - 1, s.y + 3, 4, s.h + 5, st.trim);
    this.drawSurfaceDetails(s, q, st, id);
  }

  private drawMechanics(w: World): void {
    const x = this.ctx;
    const clock = this.clockRef;
    for (const m of w.mechanics) {
      if (m.x + m.w < w.cam || m.x > w.cam + W + 130) continue;
      const q = m.x - w.cam;
      const pulse = 0.5 + 0.5 * Math.sin(clock * 7 + m.phase);
      const col = { packet: P.green, thaw: "#dff6ff", rail: P.cyan, coolant: P.green }[m.kind];

      if (m.kind !== "coolant") {
        this.rect(q, m.y, m.w, m.h, "#080613");
        this.rect(q + 2, m.y + 1, m.w - 4, 2, col);
        x.globalAlpha = 0.22 + pulse * 0.22;
        this.rect(q - 2, m.y - 2, m.w + 4, 8, col);
        x.globalAlpha = 1;
      }

      if (m.kind === "packet") {
        for (let i = 0; i < 4; i++) {
          this.rect(q + 8 + i * 20 + ((clock * 28) % 14), m.y - 4, 8, 1, P.green);
          this.rect(q + 6 + i * 20, m.y + 5, 4, 9, "#1c2f35");
        }
      } else if (m.kind === "thaw") {
        for (let i = 0; i < 5; i++) {
          x.strokeStyle = "#dff6ff";
          x.beginPath();
          x.moveTo(q + i * 18, m.y);
          x.lineTo(q + 8 + i * 18, m.y - 7);
          x.lineTo(q + 15 + i * 18, m.y);
          x.stroke();
        }
      } else if (m.kind === "rail") {
        for (let i = 0; i < 5; i++) {
          this.rect(q + 5 + i * 18 + ((clock * 42) % 10), m.y - 3, 11, 2, P.cyan);
          this.rect(q + 9 + i * 18, m.y + 5, 3, 9, "#153540");
        }
      } else {
        this.txt(w.player.heatShield > 0 ? "COOLED" : "COOLANT SLICK", q + m.w / 2, m.y - 17, col, "center", 5);
        x.save();
        x.globalCompositeOperation = "lighter";
        for (let i = 0; i < 6; i++) {
          const px = q + 8 + i * 14 + Math.sin(clock * 2 + i) * 3;
          const py = m.y + 2 + Math.sin(clock * 3 + i) * 1.5;
          x.globalAlpha = 0.18 + i * 0.04;
          x.fillStyle = i % 2 ? P.green : P.cyan;
          x.beginPath();
          x.ellipse(px, py, 12 - (i % 3) * 2, 3 + (i % 2), 0, 0, Math.PI * 2);
          x.fill();
        }
        x.globalAlpha = 0.75;
        for (let i = 0; i < 5; i++) {
          x.fillStyle = i % 2 ? "#d9fff0" : P.green;
          x.beginPath();
          x.arc(q + 10 + i * 17, m.y - 1 - Math.abs(Math.sin(clock * 2.5 + i)) * 4, 1 + (i % 2), 0, Math.PI * 2);
          x.fill();
        }
        x.restore();
        this.rect(q - 5, m.y - 8, 7, 16, "#1b3140");
        this.rect(q - 3, m.y - 11, 17, 5, "#263f4e");
        this.rect(q + 1, m.y - 10, 8, 2, P.green);
        const vx = q + 112;
        if (Math.sin(clock * 1.25 + m.phase) > 0.78) {
          x.globalAlpha = 0.55;
          for (let i = 0; i < 4; i++) {
            this.rect(vx + i * 4, m.y - 20 - (i % 2) * 6, 5, 20 + (i % 2) * 6, i % 2 ? "#ffb24e" : "#ff673d");
          }
          x.globalAlpha = 1;
        }
      }
    }
  }

  private drawRelay(r: Relay, w: World): void {
    const x = this.ctx;
    const q = r.x - w.cam;
    const y = r.y;
    const frame = CHECKPOINT_FRAMES[r.on ? 1 : 0];
    const im = this.ready("pm-checkpoint");
    const base = y + 54;

    if (im) {
      const sw = frame[2] - frame[0];
      const sh = frame[3] - frame[1];
      const dh = 70;
      const dw = (sw / sh) * dh;
      x.drawImage(im, frame[0], frame[1], sw, sh, Math.round(q - dw / 2), Math.round(base - dh), Math.round(dw), dh);
    } else {
      const col = r.on ? P.green : w.mission.accent;
      const pulse = 0.5 + 0.5 * Math.sin(this.clockRef * 6 + r.index);
      this.rect(q - 20, y + 43, 42, 7, "#080613");
      this.rect(q - 16, y - 11, 34, 52, "#0a0715");
      this.rect(q - 13, y - 8, 28, 47, "#241b46");
      x.strokeStyle = col;
      x.lineWidth = 2;
      x.strokeRect(q - 10, y - 2, 20, 25);
      x.globalAlpha = 0.25 + pulse * 0.2;
      this.rect(q - 8, y, 16, 20, col);
      x.globalAlpha = 1;
      this.txt("m", q, y + 5, P.white, "center", 8);
    }
    /* One station of the five repairs. It has to announce itself before you
       reach it, or "which checkpoint heals" is knowledge you can only get by
       dying — so the repair station is named on its plate and tinted green. */
    const repairs = r.index === RELAY.HEALING_INDEX;
    const label = r.on
      ? (repairs ? "REPAIR STATION ONLINE" : "CHECKPOINT SECURED")
      : (repairs ? "PRESS E · REPAIR STATION" : "PRESS E · SECURE");
    this.txt(label, q, base + 2, r.on ? P.green : repairs ? P.green : P.white, "center", 5);
  }

  private drawTiles(w: World): void {
    const x = this.ctx;
    this.drawSectorDressing(w);

    for (const s of w.solids) {
      if (s.x + s.w < w.cam || s.x > w.cam + W) continue;
      this.drawPlatform(s, s.x - w.cam, w);
    }

    if (w.mission.id !== "final") {
      for (const r of w.relays) {
        if (r.on) continue;
        const gx = r.x + 165;
        if (gx < w.cam - 20 || gx > w.cam + W + 20) continue;
        const q = gx - w.cam;
        this.rect(q - 3, 72, 14, 84, "#080613");
        this.rect(q, 75, 8, 78, "#211942");
        for (let y = 79; y < 151; y += 11) {
          this.rect(q, y, 8, 3, w.mission.accent);
          this.rect(q + 3, y + 3, 2, 8, "rgba(247,243,255,.7)");
        }
        x.globalAlpha = 0.16 + 0.1 * Math.sin(this.clockRef * 8);
        this.rect(q - 3, 75, 14, 78, w.mission.accent);
        x.globalAlpha = 1;
      }
      for (const r of w.relays) {
        if (r.x > w.cam - 55 && r.x < w.cam + W + 55) this.drawRelay(r, w);
      }
    }

    this.drawMechanics(w);

    if (w.mission.id !== "final") {
      for (const z of w.zoneStarts) {
        const sx = z + 585;
        if (sx < w.cam - 135 || sx > w.cam + W) continue;
        this.drawLegacyPlaque(sx - w.cam, 49, w.mission.sign, w.mission.accent);
      }
    }
  }

  /* --- sprites from the locked sheets --- */

  private drawBoundFrame(
    key: string, r: readonly [number, number, number, number],
    q: number, y: number, scale: number, anchor = 0.45, flip = false, bottom = 30,
  ): boolean {
    const im = this.ready(key);
    if (!im) return false;
    const x = this.ctx;
    const sw = r[2] - r[0];
    const sh = r[3] - r[1];
    const dw = sw * scale;
    const dh = sh * scale;
    const cx = q + 7;
    const dx = cx - dw * anchor;
    const dy = y + bottom - dh;
    x.save();
    if (flip) {
      x.translate(Math.round(cx * 2), 0);
      x.scale(-1, 1);
    }
    x.drawImage(im, r[0], r[1], sw, sh, Math.round(dx), Math.round(dy), Math.round(dw), Math.round(dh));
    x.restore();
    return true;
  }

  drawLevelFigure(id: MoonId, index: number, cx: number, base: number, targetH: number, flip = false): boolean {
    const im = this.ready(`pm-fig-${id}`);
    const r = FIGURE_RECTS[id]?.[index];
    if (!im || !r) return false;
    const x = this.ctx;
    const sw = r[2] - r[0];
    const sh = r[3] - r[1];
    const sc = targetH / sh;
    const dw = sw * sc;
    x.save();
    if (flip) {
      x.translate(Math.round(cx * 2), 0);
      x.scale(-1, 1);
    }
    x.drawImage(im, r[0], r[1], sw, sh, Math.round(cx - dw / 2), Math.round(base - targetH), Math.round(dw), Math.round(targetH));
    x.restore();
    return true;
  }

  private drawBaseFrame(frame: number, q: number, y: number, flip = false): boolean {
    return this.drawBoundFrame("pm-operator", BASE_FRAMES[frame] as never, q, y, 0.165, 0.45, flip, 30);
  }

  private drawAirFrame(frame: number, q: number, y: number, flip = false): boolean {
    const scale = frame === 2 ? 0.14 : frame === 3 ? 0.135 : 0.15;
    return this.drawBoundFrame("pm-air", AIR_FRAMES[frame] as never, q, y, scale, AIR_ANCHOR[frame], flip, frame === 2 ? 25 : 30);
  }

  private drawRunFrame(frame: number, q: number, y: number, flip = false): boolean {
    const im = this.ready("pm-run");
    if (!im) return false;
    const x = this.ctx;
    const r = RUN_FRAMES[frame];
    const sw = r[2] - r[0];
    const sh = r[3] - r[1];
    const sc = 0.17;
    const dw = sw * sc;
    const dh = sh * sc;
    const cx = q + 7;
    x.save();
    if (flip) {
      x.translate(Math.round(cx * 2), 0);
      x.scale(-1, 1);
    }
    x.drawImage(im, r[0], r[1], sw, sh, Math.round(cx - dw * 0.43), Math.round(y + 30 - dh), Math.round(dw), Math.round(dh));
    x.restore();
    return true;
  }

  private drawCannonCharge(w: World, q: number, y: number, f: number, run: boolean): void {
    const x = this.ctx;
    const p = w.player;
    const pw = clamp(p.charge / 2, 0, 1);
    if (pw <= 0 && p.fireAnim <= 0) return;
    const mx = q + (f > 0 ? (run ? 37 : 31) : run ? -23 : -17);
    const my = y + 8;
    const pulse = 0.5 + 0.5 * Math.sin(this.clockRef * (pw >= 1 ? 20 : 11));
    x.save();
    x.globalCompositeOperation = "lighter";
    if (pw > 0) {
      x.globalAlpha = 0.12 + pw * 0.18;
      const aura = x.createRadialGradient(mx, my, 0, mx, my, 5 + pw * 7);
      aura.addColorStop(0, P.white);
      aura.addColorStop(0.25, P.green);
      aura.addColorStop(1, "rgba(124,227,168,0)");
      x.fillStyle = aura;
      x.beginPath();
      x.arc(mx, my, 5 + pw * 7, 0, Math.PI * 2);
      x.fill();
      x.globalAlpha = 0.35 + pulse * 0.35;
      x.strokeStyle = pw >= 1 ? P.white : P.green;
      x.lineWidth = pw >= 1 ? 2 : 1;
      for (let i = 0; i < (pw >= 1 ? 3 : 2); i++) {
        x.beginPath();
        x.arc(mx, my, 2 + i * 2 + pulse * 1.5, 0, Math.PI * 2);
        x.stroke();
      }
      this.rect(mx - 1 - pulse, my - 1 - pulse, 2 + pulse * 2, 2 + pulse * 2, pw >= 1 ? P.white : P.green);
    }
    if (p.fireAnim > 0) {
      const a = clamp(p.fireAnim / 0.28, 0, 1);
      x.globalAlpha = a;
      x.fillStyle = P.white;
      x.beginPath();
      x.moveTo(mx + f * 10, my);
      x.lineTo(mx, my - 3);
      x.lineTo(mx, my + 3);
      x.closePath();
      x.fill();
      x.strokeStyle = P.green;
      x.beginPath();
      x.arc(mx, my, 4 + a * 4, 0, Math.PI * 2);
      x.stroke();
    }
    x.restore();
    x.globalAlpha = 1;
    x.globalCompositeOperation = "source-over";
  }

  private drawPlayer(w: World): void {
    const x = this.ctx;
    const p = w.player;
    const q = p.x - w.cam;
    const y = p.y;
    if (p.inv > 0 && Math.floor(this.clockRef * 18) % 2) return;

    const run = Math.abs(p.vx) > 16 && p.on;
    const f = p.face;

    if (p.dash > 0) {
      x.globalAlpha = 0.14;
      for (let i = 1; i < 4; i++) this.drawAirFrame(2, q - f * i * 7, y, f < 0);
      x.globalAlpha = 1;
    }

    let drawn: boolean;
    if (p.dash > 0) drawn = this.drawAirFrame(2, q, y, f < 0);
    else if (!p.on) drawn = this.drawAirFrame(p.vy < 0 ? 0 : 1, q, y, f < 0);
    else if (run) drawn = this.drawRunFrame(Math.floor(p.runT * 14) % 8, q, y, f < 0);
    else drawn = this.drawBaseFrame(p.fireAnim > 0 || p.charge > 0 ? 2 : Math.floor(this.clockRef * 2) % 2, q, y, f < 0);

    if (!drawn) {
      /* Vector stand-in, used only until the sheet decodes. */
      const armX = f > 0 ? 11 : -4;
      this.rect(q + 3, y, 8, 3, "#15102c");
      this.rect(q + 1, y + 3, 12, 7, P.copper);
      this.rect(q + 3, y + 2, 7, 2, "#f0a37d");
      this.rect(q + (f > 0 ? 7 : 2), y + 5, 5, 3, P.green);
      this.rect(q + 2, y + 10, 10, 8, "#3d2f7d");
      this.rect(q + 4, y + 10, 6, 5, P.lav);
      this.rect(q + armX, y + 11, 6, 5, P.copper);
      this.rect(q + armX + (f > 0 ? 4 : -2), y + 12, 4, 3, P.white);
      this.rect(q + 2, y + 18, 4, 5, "#223a68");
      this.rect(q + 8, y + 18, 4, 5, "#223a68");
    }
    this.drawCannonCharge(w, q, y, f, run);
  }

  private drawEnemy(e: World["enemies"][number], w: World): void {
    const x = this.ctx;
    const q = e.x - w.cam;
    const d = ENEMY_DEF[e.type];
    const idx = ROSTERS[w.mission.id as MoonId].indexOf(e.type);
    const cx = q + e.w / 2;
    const base = e.y + e.h + 3;

    if (e.flash > 0) {
      x.globalAlpha = 0.35;
      x.fillStyle = P.white;
      x.beginPath();
      x.arc(cx, base - d.artH / 2, d.artH * 0.55, 0, Math.PI * 2);
      x.fill();
      x.globalAlpha = 1;
    }

    this.drawLevelFigure(w.mission.id as MoonId, idx, cx, base, d.artH, e.vx < 0);

    /* v1.7 drew a translucent accent bar under every flyer as a ground marker.
       It reads as a floating white smear rather than a shadow — on Titania the
       cyan accent is bright enough that the bars look like a rendering fault.
       Removed: the flyers' sine bob already communicates that they are airborne. */

    if (e.hp < e.max) {
      for (let i = 0; i < e.max; i++) {
        this.rect(cx - e.max * 1.5 + i * 3, base - d.artH - 3, 2, 1, i < e.hp ? w.mission.accent : "#372d50");
      }
    }
  }

  /* --- boss --- */

  private drawAnimatedBossSprite(w: World, cx: number, base: number): boolean {
    const b = w.boss!;
    const final = w.mission.id === "final";
    const state = b.state ?? "think";
    const age = b.stateAge ?? 0;
    const face = b.face ?? -1;
    let sx = 1;
    let sy = 1;
    let bob = 0;
    let lean = 0;
    let recoil = 0;

    if (state === "run") {
      const step = Math.sin(age * 15);
      bob = -Math.abs(step) * 2;
      sx = 1 + Math.abs(step) * 0.025;
      sy = 1 - Math.abs(step) * 0.025;
      lean = face * 0.035;
    } else if (state === "windup") {
      const k = Math.min(1, age / 0.35);
      sx = 1 - 0.065 * k;
      sy = 1 + 0.065 * k;
      lean = -face * 0.045 * k;
    } else if (state === "attack") {
      const kick = Math.max(0, 1 - age / 0.24);
      sx = 1 + 0.09 * kick;
      sy = 1 - 0.055 * kick;
      recoil = -face * 4 * kick;
      lean = -face * 0.06 * kick;
    } else if (state === "jump") {
      if (b.vy < 0) { sx = 0.94; sy = 1.065; lean = face * 0.04; }
      else { sx = 1.055; sy = 0.955; lean = -face * 0.035; }
    } else if (state === "land") {
      const k = Math.max(0, 1 - age / 0.28);
      sx = 1 + 0.14 * k;
      sy = 1 - 0.12 * k;
      bob = 2 * k;
    } else {
      const breath = Math.sin(b.t * 3) * 0.012;
      sx = 1 - breath;
      sy = 1 + breath;
    }
    if ((b.stagger ?? 0) > 0) {
      recoil -= face * 2;
      lean -= face * 0.04;
    }

    let key: string;
    let r: readonly number[] | undefined;
    let targetH: number;
    if (final) {
      const frame = b.flash > 0 ? 3
        : state === "attack" ? 1
        : state === "windup" ? 2
        : b.shields.length && Math.floor(b.t * 1.2) % 5 === 0 ? 2
        : 0;
      key = "pm-boss-final";
      r = FINAL_BOSS_FRAMES[frame];
      targetH = 108;
    } else {
      key = `pm-fig-${w.mission.id}`;
      r = FIGURE_RECTS[w.mission.id as MoonId]?.[3];
      targetH = 92;
    }

    const im = this.ready(key);
    if (!im || !r) return false;

    const x = this.ctx;
    const sw = r[2] - r[0];
    const sh = r[3] - r[1];
    const dw = sw * (targetH / sh);
    x.save();
    x.translate(Math.round(cx + recoil), Math.round(base + bob));
    x.rotate(lean);
    x.scale(face < 0 ? -sx : sx, sy);
    x.globalAlpha = b.exploding ? clamp(1 - w.victoryT / 1.7, 0.08, 1) : b.flash > 0 ? 0.82 : 1;
    x.drawImage(im, r[0], r[1], sw, sh, Math.round(-dw / 2), Math.round(-targetH), Math.round(dw), Math.round(targetH));
    x.restore();
    x.globalAlpha = 1;
    return true;
  }

  private drawBossHitFx(b: Boss, q: number, y: number): void {
    if (!b.hitFx) return;
    const x = this.ctx;
    const life = clamp(b.hitFx / 0.28, 0, 1);
    const p = 1 - life;
    const hx = q + (b.hitX ?? b.w / 2);
    const hy = y + (b.hitY ?? b.h / 2);
    const col = b.hitColor ?? P.white;
    x.save();
    x.globalCompositeOperation = "lighter";
    const g = x.createRadialGradient(hx, hy, 0, hx, hy, 14 + p * 8);
    g.addColorStop(0, `rgba(255,255,255,${life})`);
    g.addColorStop(0.24, col);
    g.addColorStop(1, "rgba(255,255,255,0)");
    x.globalAlpha = 0.45 * life;
    x.fillStyle = g;
    x.beginPath();
    x.arc(hx, hy, 14 + p * 8, 0, Math.PI * 2);
    x.fill();
    x.globalAlpha = life;
    x.strokeStyle = P.white;
    x.lineWidth = 1.5;
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4 + b.t * 2;
      const r0 = 3 + p * 5;
      const r1 = 10 + p * 15;
      x.beginPath();
      x.moveTo(hx + Math.cos(a) * r0, hy + Math.sin(a) * r0);
      x.lineTo(hx + Math.cos(a) * r1, hy + Math.sin(a) * r1);
      x.stroke();
    }
    x.strokeStyle = col;
    x.globalAlpha = life * 0.8;
    for (let i = 0; i < 2; i++) {
      x.beginPath();
      x.arc(hx, hy, 5 + p * (8 + i * 5), 0, Math.PI * 2);
      x.stroke();
    }
    x.restore();
  }

  private drawBoss(w: World): void {
    const b = w.boss;
    if (!b || (b.dead && !b.exploding)) return;
    const x = this.ctx;
    const q = b.x - w.cam;
    const y = b.y;
    const cx = q + b.w / 2;
    const base = y + b.h + 6;
    const pulse = 0.5 + 0.5 * Math.sin(b.t * 5);
    const final = w.mission.id === "final";

    x.save();
    x.globalCompositeOperation = "lighter";
    x.globalAlpha = 0.12 + pulse * 0.08;
    x.fillStyle = w.mission.accent;
    x.beginPath();
    x.arc(cx, base - (final ? 58 : 43), final ? 58 + pulse * 5 : 48 + pulse * 5, 0, Math.PI * 2);
    x.fill();
    x.globalAlpha = 0.55;
    x.strokeStyle = w.mission.accent;
    x.lineWidth = 1;

    if (final) {
      for (let i = 0; i < 4; i++) {
        const a = b.t * 0.4 + (i * Math.PI) / 2;
        x.strokeStyle = [P.green, P.lav, P.cyan, P.copper][i];
        x.beginPath();
        x.arc(cx, base - 58, 44 + i * 2, a, a + 1.25);
        x.stroke();
      }
    } else if (w.mission.id === "umbriel") {
      for (let i = 0; i < 5; i++) {
        const a = i * 1.25 + b.t * 0.2;
        x.beginPath();
        x.moveTo(cx + Math.cos(a) * 38, base - 43 + Math.sin(a) * 30);
        x.lineTo(cx + Math.cos(a) * 47, base - 43 + Math.sin(a) * 38);
        x.stroke();
      }
    } else if (w.mission.id === "titania") {
      for (let i = 0; i < 3; i++) {
        const yy = base - 70 + i * 18;
        x.beginPath();
        x.moveTo(cx - 44, yy);
        x.lineTo(cx - 35, yy - 4);
        x.lineTo(cx - 27, yy + 3);
        x.stroke();
      }
    } else if (w.mission.id === "oberon") {
      for (let i = 0; i < 4; i++) {
        this.rect(cx - 24 + i * 16, base - 87 - Math.sin(b.t * 7 + i) * 5, 3, 5, i % 2 ? "#ffb24e" : "#ff673d");
      }
    }
    x.restore();

    this.drawAnimatedBossSprite(w, cx, base);
    this.drawBossHitFx(b, q, y);

    if (b.exploding) {
      x.save();
      x.globalCompositeOperation = "lighter";
      for (let i = 0; i < 5; i++) {
        const a = b.t * 5 + i * 1.25;
        const r = 8 + w.victoryT * 18 + i * 5;
        x.globalAlpha = clamp(1 - w.victoryT / 1.7, 0, 1) * 0.75;
        x.strokeStyle = i % 2 ? P.white : w.mission.accent;
        x.lineWidth = i % 2 ? 2 : 1;
        x.beginPath();
        x.arc(cx + Math.cos(a) * 12, base - b.h * 0.55 + Math.sin(a) * 16, r, 0, Math.PI * 2);
        x.stroke();
      }
      x.restore();
    }
  }

  /* --- projectiles --- */

  private drawPulseShot(s: Shot, cam: number): void {
    const x = this.ctx;
    const q = s.x - cam;
    const dir = Math.sign(s.vx) || 1;
    const cy = s.y + s.h / 2;
    const cx = q + s.w / 2;
    const pow = s.charged ? 1 : 0;
    const age = s.age;
    const flick = 0.5 + 0.5 * Math.sin(age * 48);
    const hh = pow ? 7 : 4;
    const lead = cx + dir * (s.w / 2 + (pow ? 7 : 5));
    const tail = cx - dir * (s.w / 2 + 2);

    x.save();
    x.globalCompositeOperation = "lighter";
    for (let i = 0; i < (pow ? 5 : 3); i++) {
      const tx = cx - dir * (7 + i * (pow ? 5 : 4));
      const r = (pow ? 5 : 3) + i * (pow ? 1.7 : 1.2);
      const a = dir > 0 ? 0 : Math.PI;
      x.globalAlpha = (pow ? 0.58 : 0.42) * (1 - i / (pow ? 6 : 4));
      x.strokeStyle = i % 2 ? P.cyan : P.green;
      x.lineWidth = pow && i < 2 ? 2 : 1;
      x.beginPath();
      x.arc(tx, cy + Math.sin(age * 34 + i) * 1.2, r, a - 1.02, a + 1.02);
      x.stroke();
    }
    for (let i = 0; i < (pow ? 5 : 3); i++) {
      const tx = cx - dir * (10 + i * 6);
      const ty = cy + Math.sin(age * 39 + i * 2.1) * (pow ? 7 : 4);
      x.globalAlpha = 0.7 - i * 0.1;
      this.rect(tx, ty, i === 0 && pow ? 2 : 1, i === 0 && pow ? 2 : 1, i % 2 ? P.cyan : P.green);
    }
    x.globalAlpha = pow ? 0.38 : 0.25;
    const glow = x.createRadialGradient(cx, cy, 0, cx, cy, pow ? 17 : 10);
    glow.addColorStop(0, P.white);
    glow.addColorStop(0.22, "#d9fff0");
    glow.addColorStop(0.48, P.green);
    glow.addColorStop(1, "rgba(124,227,168,0)");
    x.fillStyle = glow;
    x.beginPath();
    x.arc(cx, cy, pow ? 17 : 10, 0, Math.PI * 2);
    x.fill();
    x.globalAlpha = 0.95;
    x.fillStyle = P.green;
    x.beginPath();
    x.moveTo(lead, cy); x.lineTo(cx, cy - hh); x.lineTo(tail, cy); x.lineTo(cx, cy + hh);
    x.closePath(); x.fill();
    x.globalAlpha = 1;
    x.fillStyle = P.white;
    x.beginPath();
    x.moveTo(lead - dir * 2, cy); x.lineTo(cx, cy - (pow ? 3.5 : 2));
    x.lineTo(tail + dir * 3, cy); x.lineTo(cx, cy + (pow ? 3.5 : 2));
    x.closePath(); x.fill();
    x.fillStyle = "#d9fff0";
    x.beginPath();
    x.arc(cx, cy, pow ? 3.2 : 2.1, 0, Math.PI * 2);
    x.fill();
    x.globalAlpha = 0.65 + flick * 0.25;
    x.strokeStyle = pow ? P.white : P.cyan;
    x.lineWidth = 1;
    if (pow) {
      for (let i = 0; i < 2; i++) {
        x.beginPath();
        x.ellipse(cx, cy, 9 + i * 4, 4 + i * 3, age * (i ? 3.5 : -4), 0, Math.PI * 2);
        x.stroke();
      }
    }
    x.beginPath();
    x.moveTo(lead, cy); x.lineTo(lead - dir * (pow ? 5 : 3), cy - hh - 2);
    x.moveTo(lead, cy); x.lineTo(lead - dir * (pow ? 5 : 3), cy + hh + 2);
    x.stroke();
    x.restore();
    x.globalAlpha = 1;
    x.globalCompositeOperation = "source-over";
  }

  private drawPlayerWeaponShot(s: Shot, cam: number): void {
    const x = this.ctx;
    const q = s.x - cam;
    const cx = q + s.w / 2;
    const cy = s.y + s.h / 2;
    const dir = Math.sign(s.vx) || 1;
    const age = s.age;
    x.save();
    x.globalCompositeOperation = "lighter";

    if (s.k === "browser") {
      x.globalAlpha = 0.25;
      this.rect(q - dir * 9, s.y - 3, s.w + 12, s.h + 6, P.green);
      x.globalAlpha = 1;
      x.strokeStyle = P.green;
      x.strokeRect(q, s.y - 1, s.w + 3, s.h + 2);
      this.rect(q + 2, s.y, s.w - 1, s.h, P.white);
      for (let i = 1; i < 3; i++) this.rect(q - dir * i * 4, cy + (i % 2) - 1, 2, 2, P.green);
    } else if (s.k === "canvas") {
      x.globalAlpha = 0.3;
      this.rect(q - 4, s.y - 4, s.w + 8, s.h + 8, P.lav);
      x.globalAlpha = 1;
      x.fillStyle = "#dff6ff";
      x.beginPath();
      x.moveTo(q + dir * (s.w + 4), cy); x.lineTo(cx, cy - 4);
      x.lineTo(q - dir * 2, cy); x.lineTo(cx, cy + 4);
      x.closePath(); x.fill();
      x.strokeStyle = P.lav;
      x.stroke();
    } else if (s.k === "crossnet") {
      x.strokeStyle = P.cyan;
      x.lineWidth = 2;
      x.globalAlpha = 0.8;
      x.beginPath();
      x.moveTo(q - dir * 8, cy);
      for (let i = 0; i < 4; i++) x.lineTo(q - dir * 4 + i * 4, cy + (i % 2 ? 3 : -3));
      x.lineTo(q + dir * (s.w + 5), cy);
      x.stroke();
      this.rect(cx - 2, cy - 2, 4, 4, P.white);
    } else if (s.k === "airlink") {
      x.strokeStyle = "#ff69d0";
      x.lineWidth = 3;
      x.globalAlpha = 0.9;
      x.beginPath();
      x.arc(cx - dir * 2, cy, 9, -1.05 * dir, 1.05 * dir, dir < 0);
      x.stroke();
      x.lineWidth = 1;
      x.strokeStyle = P.white;
      x.beginPath();
      x.arc(cx + dir, cy, 6, -1.1 * dir, 1.1 * dir, dir < 0);
      x.stroke();
      for (let i = 1; i < 4; i++) {
        x.globalAlpha = 0.3 / i;
        x.beginPath();
        x.arc(cx - dir * i * 5, cy, 9 - i, -1, 1);
        x.stroke();
      }
    } else if (s.k === "guestkey") {
      x.translate(cx, cy);
      x.rotate(age * 6);
      x.strokeStyle = "#c6ff4f";
      x.lineWidth = 1.5;
      x.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3;
        x.lineTo(Math.cos(a) * 7, Math.sin(a) * 7);
      }
      x.closePath();
      x.stroke();
      this.rect(-2, -2, 4, 4, P.white);
      x.globalAlpha = 0.5;
      this.rect(6, -1, 8, 2, "#c6ff4f");
      this.rect(11, 1, 2, 3, "#c6ff4f");
    } else if (s.k === "byomswitch") {
      x.translate(cx, cy);
      x.rotate(Math.PI / 4 + age * 2);
      x.fillStyle = "#ff5d52";
      x.strokeStyle = "#ffd05c";
      x.lineWidth = 1.5;
      x.fillRect(-5, -5, 10, 10);
      x.strokeRect(-6, -6, 12, 12);
      x.fillStyle = P.white;
      x.fillRect(-2, -2, 4, 4);
      x.globalAlpha = 0.55;
      for (let i = 1; i < 4; i++) x.strokeRect(-6 - i * 3, -6 - i * 3, 12 + i * 6, 12 + i * 6);
    } else if (s.k === "fleetsync") {
      x.translate(cx, cy);
      x.fillStyle = P.white;
      x.beginPath();
      x.arc(0, 0, 3, 0, Math.PI * 2);
      x.fill();
      for (let i = 0; i < 3; i++) {
        const a = age * 7 + (i * Math.PI * 2) / 3;
        const ox = Math.cos(a) * 8;
        const oy = Math.sin(a) * 5;
        x.strokeStyle = i === 1 ? "#ffb451" : "#5fe8ff";
        x.beginPath();
        x.arc(0, 0, 5 + i * 2, a, a + 1.3);
        x.stroke();
        x.fillStyle = x.strokeStyle as string;
        x.beginPath();
        x.arc(ox, oy, 1.5, 0, Math.PI * 2);
        x.fill();
      }
    } else {
      /* evergreen */
      x.globalAlpha = 0.28;
      const g = x.createRadialGradient(cx, cy, 0, cx, cy, 12);
      g.addColorStop(0, P.white);
      g.addColorStop(0.25, "#ffcc63");
      g.addColorStop(0.58, "#ff673d");
      g.addColorStop(1, "rgba(255,80,35,0)");
      x.fillStyle = g;
      x.beginPath();
      x.arc(cx, cy, 12, 0, Math.PI * 2);
      x.fill();
      x.globalAlpha = 1;
      x.strokeStyle = "#ffb24e";
      x.lineWidth = 2;
      x.beginPath();
      x.arc(cx, cy, 7 + Math.sin(age * 20) * 2, -1.2, 1.2);
      x.stroke();
      this.rect(cx - 2, cy - 3, 5, 6, P.white);
    }
    x.restore();
    x.globalAlpha = 1;
    x.globalCompositeOperation = "source-over";
  }

  private drawEnemyShotBase(s: EnemyShot, cam: number): void {
    const x = this.ctx;
    const q = s.x - cam;
    const cx = q + s.w / 2;
    const cy = s.y + s.h / 2;
    const k = s.kind ?? "pair";
    const age = s.age;
    const angle = Math.atan2(s.vy, s.vx || 0.001);
    const rad = Math.max(4, s.w / 2);

    x.save();
    x.globalCompositeOperation = "lighter";

    if (s.boss) {
      (s.trail ?? []).forEach((t, i) => {
        const fade = 1 - i / Math.max(2, (s.trail ?? []).length);
        x.globalAlpha = 0.22 * fade;
        x.fillStyle = s.col;
        x.beginPath();
        x.arc(t.x - cam + s.w / 2, t.y + s.h / 2, rad * (0.35 + fade * 0.8), 0, Math.PI * 2);
        x.fill();
      });
      const aura = x.createRadialGradient(cx, cy, 0, cx, cy, rad + 11);
      aura.addColorStop(0, P.white);
      aura.addColorStop(0.22, s.col);
      aura.addColorStop(1, "rgba(0,0,0,0)");
      x.globalAlpha = 0.22;
      x.fillStyle = aura;
      x.beginPath();
      x.arc(cx, cy, rad + 11, 0, Math.PI * 2);
      x.fill();
      x.globalAlpha = 1;
    }

    if (k === "pair" || k === "packet" || k === "token") {
      x.translate(cx, cy);
      x.rotate(angle);
      const col = k === "token" ? P.gold : P.green;
      if (k === "pair") {
        x.lineWidth = 1.5;
        x.strokeStyle = col;
        for (const oy of [-2.2, 2.2]) {
          x.beginPath();
          x.ellipse(0, oy, 5.5, 3.2, 0, 0, Math.PI * 2);
          x.stroke();
        }
        x.globalAlpha = 0.45;
        x.strokeStyle = P.white;
        x.beginPath();
        x.moveTo(-7, 0); x.lineTo(7, 0);
        x.stroke();
        x.globalAlpha = 1;
        x.fillStyle = P.white;
        x.beginPath();
        x.arc(3, 0, 1.7, 0, Math.PI * 2);
        x.fill();
      } else if (k === "packet") {
        for (let i = 0; i < 3; i++) {
          x.globalAlpha = 0.18 - i * 0.04;
          x.fillStyle = col;
          x.beginPath();
          x.moveTo(-8 - i * 4, -3 + i); x.lineTo(-2 - i * 4, 0); x.lineTo(-8 - i * 4, 3 - i);
          x.closePath(); x.fill();
        }
        x.globalAlpha = 1;
        x.fillStyle = "#142b2d";
        x.strokeStyle = col;
        x.lineWidth = 1.3;
        x.beginPath();
        x.moveTo(-5, -4); x.lineTo(4, -4); x.lineTo(8, 0);
        x.lineTo(4, 4); x.lineTo(-5, 4); x.lineTo(-8, 0);
        x.closePath(); x.fill(); x.stroke();
        x.fillStyle = P.white;
        for (let i = 0; i < 3; i++) x.fillRect(-3 + i * 3, -1, 1.5, 2);
      } else {
        x.rotate(age * 5);
        x.fillStyle = "#5b4213";
        x.strokeStyle = P.gold;
        x.lineWidth = 1.4;
        x.beginPath();
        for (let i = 0; i < 12; i++) {
          const a = (i * Math.PI) / 6;
          const r = i % 2 ? 4.5 : 6.5;
          x.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        x.closePath(); x.fill(); x.stroke();
        x.strokeStyle = P.white;
        x.beginPath();
        x.arc(0, 0, 2.4, -1.1, 1.1);
        x.stroke();
        x.fillStyle = P.gold;
        x.fillRect(-1, -3, 2, 6);
      }
    } else if (k === "ice" || k === "freeze" || k === "icicle") {
      x.translate(cx, cy);
      x.rotate(k === "icicle" ? 0 : angle + Math.PI / 2);
      const long = k === "icicle" ? 8 : k === "freeze" ? 7 : 6.5;
      const wd = k === "icicle" ? 3.2 : 4.6;
      x.globalAlpha = 0.28;
      x.fillStyle = "#89c8ff";
      for (let i = 1; i < 4; i++) {
        x.beginPath();
        x.moveTo(-i * 2, -long * 0.3); x.lineTo(-i * 4, 0); x.lineTo(-i * 2, long * 0.3);
        x.closePath(); x.fill();
      }
      x.globalAlpha = 1;
      const ice = x.createLinearGradient(-wd, -long, wd, long);
      ice.addColorStop(0, "#7cb9ff");
      ice.addColorStop(0.48, "#efffff");
      ice.addColorStop(1, "#7a75d5");
      x.fillStyle = ice;
      x.strokeStyle = "#dff6ff";
      x.lineWidth = 1;
      x.beginPath();
      x.moveTo(0, -long); x.lineTo(wd, 0); x.lineTo(0, long); x.lineTo(-wd, 0);
      x.closePath(); x.fill(); x.stroke();
      x.globalAlpha = 0.75;
      x.strokeStyle = "#6ba8e8";
      x.beginPath();
      x.moveTo(0, -long + 1); x.lineTo(0, long - 1);
      x.moveTo(-wd + 1, 0); x.lineTo(wd - 1, 0);
      x.stroke();
      if (k === "freeze") {
        x.rotate(age * 2);
        for (let i = 0; i < 6; i++) {
          x.rotate(Math.PI / 3);
          x.beginPath();
          x.moveTo(0, -4); x.lineTo(0, -9);
          x.stroke();
        }
      }
    } else if (k === "spark" || k === "bolt" || k === "home") {
      if (k === "home") {
        x.translate(cx, cy);
        x.rotate(age * 2.6);
        x.strokeStyle = P.cyan;
        x.lineWidth = 1.5;
        for (let i = 0; i < 3; i++) {
          x.beginPath();
          x.ellipse(0, 0, 5 + i * 2, 2.6 + i, i * 0.7, 0, Math.PI * 2);
          x.stroke();
        }
        x.fillStyle = P.white;
        x.beginPath(); x.arc(0, 0, 2.6, 0, Math.PI * 2); x.fill();
        x.fillStyle = P.cyan;
        x.beginPath(); x.arc(0, 0, 1.4, 0, Math.PI * 2); x.fill();
      } else {
        x.translate(cx, cy);
        x.rotate(angle);
        x.lineCap = "round";
        for (let layer = 0; layer < 2; layer++) {
          x.strokeStyle = layer ? P.white : P.cyan;
          x.lineWidth = layer ? 1 : 3;
          x.globalAlpha = layer ? 1 : 0.35;
          x.beginPath();
          x.moveTo(-10, 0);
          for (let i = 1; i < 6; i++) x.lineTo(-10 + i * 4, (i % 2 ? 1 : -1) * (2.2 + Math.sin(age * 28 + i) * 1.4));
          x.stroke();
        }
        x.globalAlpha = 1;
        x.fillStyle = P.white;
        x.beginPath(); x.arc(1, 0, 2.2, 0, Math.PI * 2); x.fill();
        x.strokeStyle = "#8fe8ff";
        x.beginPath(); x.arc(1, 0, 4 + Math.sin(age * 18), 0, Math.PI * 2); x.stroke();
      }
    } else {
      x.translate(cx, cy);
      x.rotate(angle);
      for (let i = 4; i > 0; i--) {
        const tx = -i * 4;
        const spread = 2 + i * 0.8;
        x.globalAlpha = 0.08 + i * 0.05;
        x.fillStyle = i % 2 ? "#ff673d" : "#ffb24e";
        x.beginPath();
        x.moveTo(tx - spread * 1.8, 0);
        x.quadraticCurveTo(tx, -spread, tx + spread, 0);
        x.quadraticCurveTo(tx, spread, tx - spread * 1.8, 0);
        x.fill();
      }
      x.globalAlpha = 1;
      const g = x.createRadialGradient(1, 0, 0, 1, 0, rad + 4);
      g.addColorStop(0, P.white);
      g.addColorStop(0.25, "#ffd36b");
      g.addColorStop(0.58, "#ff673d");
      g.addColorStop(1, "rgba(255,55,20,0)");
      x.fillStyle = g;
      x.beginPath(); x.arc(1, 0, rad + 4, 0, Math.PI * 2); x.fill();
      x.fillStyle = k === "lava" ? "#ff5438" : "#ffb24e";
      x.beginPath(); x.arc(1, 0, rad, 0, Math.PI * 2); x.fill();
      x.strokeStyle = P.white;
      x.lineWidth = 1;
      x.beginPath(); x.arc(2, -1, rad * 0.48, -2.8, -0.5); x.stroke();
      if (k === "lava") {
        x.strokeStyle = "#6b170e";
        x.beginPath();
        x.moveTo(-2, -rad + 1); x.lineTo(1, -1); x.lineTo(4, rad - 1);
        x.stroke();
      }
    }

    if (s.boss) {
      x.restore();
      x.save();
      x.globalCompositeOperation = "lighter";
      x.translate(cx, cy);
      x.globalAlpha = 0.9;
      for (let i = 0; i < 3; i++) {
        const a = age * (4 + i * 1.7) + (s.orbit ?? 0) + i * 2.1;
        const or = rad + 5 + i * 2.6;
        x.strokeStyle = i === 1 ? P.white : s.col;
        x.lineWidth = i === 1 ? 1.4 : 0.8;
        x.beginPath(); x.arc(0, 0, or, a, a + 1.25); x.stroke();
        x.fillStyle = i === 1 ? P.white : s.col;
        x.beginPath(); x.arc(Math.cos(a) * or, Math.sin(a) * or, i === 1 ? 1.6 : 1.1, 0, Math.PI * 2); x.fill();
      }
    }
    x.restore();
    x.globalAlpha = 1;
    x.globalCompositeOperation = "source-over";
  }

  private drawEnemyShot(s: EnemyShot, cam: number): void {
    const x = this.ctx;
    const q = s.x - cam;
    const cx = q + s.w / 2;
    const cy = s.y + s.h / 2;
    const k = s.kind ?? "pair";
    const age = s.age;
    const family = k === "pair" || k === "packet" || k === "token" ? "signal"
      : k === "ice" || k === "freeze" || k === "icicle" ? "ice"
      : k === "spark" || k === "bolt" || k === "home" ? "electric"
      : "fire";
    const col = s.col ?? P.danger;
    const m = Math.hypot(s.vx, s.vy) || 1;
    const dx = s.vx / m;
    const dy = s.vy / m;
    const rad = Math.max(4, s.w / 2);

    x.save();
    x.globalCompositeOperation = "lighter";
    x.lineCap = "round";
    for (let i = 5; i > 0; i--) {
      const dist = i * (s.boss ? 5.4 : 3.6);
      const tx = cx - dx * dist;
      const ty = cy - dy * dist;
      x.globalAlpha = (s.boss ? 0.15 : 0.095) * (6 - i);
      x.strokeStyle = col;
      x.lineWidth = (s.boss ? 4 : 2.5) * (1 - i / 7);
      x.beginPath();
      x.moveTo(tx, ty);
      x.lineTo(tx - dx * (s.boss ? 8 : 5), ty - dy * (s.boss ? 8 : 5));
      x.stroke();
    }
    const aura = x.createRadialGradient(cx, cy, 0, cx, cy, rad + (s.boss ? 15 : 9));
    aura.addColorStop(0, "rgba(255,255,255,.9)");
    aura.addColorStop(0.18, col);
    aura.addColorStop(1, "rgba(0,0,0,0)");
    x.globalAlpha = s.boss ? 0.24 : 0.15;
    x.fillStyle = aura;
    x.beginPath(); x.arc(cx, cy, rad + (s.boss ? 15 : 9), 0, Math.PI * 2); x.fill();
    x.globalAlpha = 1;

    if (family === "signal") {
      for (let i = 0; i < 4; i++) {
        const d = 10 + i * 5;
        const ox = cx - dx * d + Math.sin(age * 19 + i) * 2 * dy;
        const oy = cy - dy * d - Math.sin(age * 19 + i) * 2 * dx;
        x.globalAlpha = 0.28 + i * 0.08;
        this.rect(ox - 1, oy - 1, i % 2 ? 2 : 1, i % 2 ? 2 : 1, i === 3 ? P.white : col);
      }
    } else if (family === "ice") {
      x.strokeStyle = col;
      x.lineWidth = 1;
      for (let i = 0; i < 4; i++) {
        const d = 8 + i * 5;
        const side = (i % 2 ? 1 : -1) * (3 + i);
        const ox = cx - dx * d + dy * side;
        const oy = cy - dy * d - dx * side;
        x.globalAlpha = 0.28 + i * 0.09;
        x.beginPath();
        x.moveTo(ox - 2, oy); x.lineTo(ox, oy - 2); x.lineTo(ox + 2, oy); x.lineTo(ox, oy + 2);
        x.closePath(); x.stroke();
      }
    } else if (family === "electric") {
      x.lineWidth = 1;
      for (const side of [-1, 1]) {
        x.globalAlpha = 0.4;
        x.strokeStyle = side < 0 ? col : P.white;
        x.beginPath();
        x.moveTo(cx - dx * 5 + dy * side * 3, cy - dy * 5 - dx * side * 3);
        for (let i = 1; i < 4; i++) {
          const d = 5 + i * 4;
          const j = (i % 2 ? 2 : -2) * side;
          x.lineTo(cx - dx * d + dy * (side * 3 + j), cy - dy * d - dx * (side * 3 + j));
        }
        x.stroke();
      }
    } else {
      for (let i = 0; i < 6; i++) {
        const d = 7 + i * 4;
        const side = Math.sin(age * 22 + i * 2.3) * (2 + i * 0.45);
        const sz = i % 3 === 0 ? 2 : 1;
        x.globalAlpha = 0.2 + i * 0.07;
        this.rect(cx - dx * d + dy * side, cy - dy * d - dx * side, sz, sz, i % 2 ? col : "#ffd36b");
      }
    }
    x.restore();

    this.drawEnemyShotBase(s, cam);

    x.save();
    x.globalCompositeOperation = "lighter";
    x.translate(cx, cy);
    x.globalAlpha = 0.8 + 0.18 * Math.sin(age * 26);
    x.strokeStyle = P.white;
    x.lineWidth = 1;
    x.beginPath();
    x.moveTo(-rad - 2, 0); x.lineTo(rad + 2, 0);
    x.moveTo(0, -rad - 2); x.lineTo(0, rad + 2);
    x.stroke();
    if (s.boss) {
      x.globalAlpha = 0.45;
      x.strokeStyle = col;
      for (let i = 0; i < 2; i++) {
        const r = rad + 9 + i * 5 + Math.sin(age * 8 + i) * 2;
        x.beginPath();
        x.arc(0, 0, r, age * (i ? 2.4 : -2), age * (i ? 2.4 : -2) + 1.8);
        x.stroke();
      }
    }
    x.restore();
    x.globalAlpha = 1;
    x.globalCompositeOperation = "source-over";
  }

  private drawShots(w: World): void {
    const x = this.ctx;
    for (const s of w.shots) {
      if (s.k === "pulse") this.drawPulseShot(s, w.cam);
      else this.drawPlayerWeaponShot(s, w.cam);
    }
    for (const s of w.enemyShots) this.drawEnemyShot(s, w.cam);
    for (const p of w.parts) {
      x.globalAlpha = clamp(p.t * 2, 0, 1);
      this.rect(p.x - w.cam, p.y, p.s, p.s, p.col);
    }
    x.globalAlpha = 1;
  }

  /* --- HUD --- */

  private drawHud(w: World, weapon: { id: string; short: string; color: string; cost: number }): void {
    const p = w.player;
    this.rect(0, 0, W, 19, "rgba(5,4,12,.9)");
    this.txt("MERSIVE", 5, 4, P.white, "left", 6);
    for (let i = 0; i < p.max; i++) {
      this.rect(48 + i * 5, 5, 3, 7, i < p.hp ? P.green : "#302744");
    }

    const status = w.mission.id === "final"
      ? "POLARIS NEXUS"
      : `${w.mission.moon} ${w.relays.filter((r) => r.on).length}/${w.relays.length}`;
    this.txt(status, 155, 4, w.mission.accent, "center", 6);

    this.rect(211, 3, 102, 13, "#110d24");
    this.rect(213, 5, 9, 9, weapon.color);
    this.txt(weapon.short, 226, 5, weapon.color, "left", 6);
    if (weapon.cost) this.txt(String(w.ammo[weapon.id]).padStart(2, "0"), 307, 5, P.gold, "right", 6);

    if (weapon.id === "pulse" && p.charge > 0) {
      this.rect(238, 20, 75, 9, "rgba(5,4,12,.86)");
      this.rect(240, 22, Math.round((49 * p.charge) / 2), 5, p.charge >= 2 ? P.white : P.green);
      this.txt(p.charge >= 2 ? "3X READY" : "CHARGE", 311, 21, p.charge >= 2 ? P.white : P.green, "right", 5);
    }
    if (p.heatShield > 0) this.txt("COOLANT SHIELD", 5, 21, P.green, "left", 5);
    if (w.mission.id === "ariel" && w.ariel.pairLock > 0) {
      this.txt("PAIRING LOCK · WEAPONS OFFLINE", 5, 21, P.gold, "left", 5);
    }

    const b = w.boss;
    if (b && !b.dead) {
      this.rect(49, 166, 222, 10, "#0b0713");
      this.rect(52, 169, Math.round((216 * b.hp) / b.max), 4, P.danger);
      this.txt(w.mission.boss, 160, 158, P.white, "center", 6);
      if (w.mission.id === "final") {
        for (let i = 0; i < FINAL_SHIELDS.length; i++) {
          const k = FINAL_SHIELDS[i];
          this.rect(105 + i * 14, 176, 10, 2, b.shields.includes(k) ? WEAPONS[k].color : "#302744");
        }
      }
    }
  }

  /* --- top-level frames --- */

  drawGame(w: World, clock: number, weapon: { id: string; short: string; color: string; cost: number }): void {
    this.clockRef = clock;
    const x = this.ctx;
    const sx = w.shake ? rr(-w.shake, w.shake) : 0;
    const sy = w.shake ? rr(-w.shake, w.shake) : 0;
    x.save();
    x.translate(Math.round(sx), Math.round(sy));
    this.drawMissionBg(w);
    this.drawMissionAtmosphere(w);
    this.rect(0, 19, W, H - 19, "rgba(4,3,13,.09)");
    this.drawTiles(w);
    for (const e of w.enemies) {
      if (!e.dead && e.x > w.cam - 40 && e.x < w.cam + W + 40) this.drawEnemy(e, w);
    }
    this.drawBoss(w);
    this.drawShots(w);
    this.drawPlayer(w);
    if (w.jumpFx > 0) {
      x.globalAlpha = w.jumpFx * 0.35;
      this.rect(0, 0, W, H, w.mission.accent);
      for (let i = 0; i < 10; i++) this.rect((i * 37 + clock * 180) % W, 0, 2, H, P.white);
      x.globalAlpha = 1;
    }
    x.restore();
    this.drawHud(w, weapon);
  }

  /**
   * The boot sting: the Mersive mark, fading up and back out.
   *
   * v1.7 drew this by hand — a purple panel with a pixel "m" and the word
   * MERSIVE under it. That was a stand-in for a logo the prototype did not
   * have. Now it has one, so the real mark is used and the drawn box is gone.
   *
   * Smoothing is turned on for this one draw. The renderer runs with
   * imageSmoothingEnabled = false throughout, which is correct for every locked
   * sprite sheet and wrong here: the mark is a 3141px vector-style graphic being
   * put on screen at about 90 logical pixels, and nearest-neighbour sampling at
   * a 30:1 ratio shreds the thin rings into broken dashes.
   */
  drawBoot(t: number): void {
    const x = this.ctx;
    this.rect(0, 0, W, H, P.void);

    const a = clamp(t / 0.4, 0, 1) * clamp((1.55 - t) / 0.3, 0, 1);
    const logo = this.ready("pm-logo");
    if (!logo) return;

    /* A slow settle: the mark eases from a shade oversized to its resting size
       as it fades up, which reads as an arrival rather than a cut. */
    const settle = clamp(t / 0.55, 0, 1);
    const size = 96 - 8 * (1 - settle) * (1 - settle);

    x.save();
    x.globalAlpha = a;
    x.imageSmoothingEnabled = true;
    x.imageSmoothingQuality = "high";
    x.drawImage(logo, W / 2 - size / 2, H / 2 - size / 2, size, size);
    x.restore();
    x.imageSmoothingEnabled = false;
  }

  drawEpilogue(t: number, fallbackMission: Mission): void {
    const x = this.ctx;
    const art = this.ready("pm-title-bg");
    if (art) x.drawImage(art, 0, 0, W, H);
    else this.drawSpace(fallbackMission, 0);
    this.rect(0, 0, W, H, "rgba(3,2,11,.82)");

    const lines: [string, number, string, number][] = [
      ["POLARIS-MAN", 15, P.white, 18], ["HERO OF THE INTEGRATOR", 8, P.green, 24], ["", 6, P.white, 18],
      ["WITH PROTOCOL PRIME DEFEATED,", 7, P.lav, 13], ["THE URANUS SYSTEM WAS OPEN AGAIN.", 7, P.lav, 20],
      ["NO MORE PAIRING RITUALS.", 7, P.white, 12], ["NO MORE LOCKED SCREENS.", 7, P.white, 12], ["NO MORE NETWORK SILOS.", 7, P.white, 20],
      ["POLARIS-MAN DEFEATED THE DONGLES,", 7, P.copper, 12], ["THE CLOSED SYSTEMS, THE REFRESH TRAPS,", 7, P.copper, 12], ["AND EVERY OTHER ENEMY OF THE INTEGRATOR.", 7, P.copper, 22],
      ["ANY USER. EVERY DISPLAY.", 9, P.green, 13], ["ONE SHARED WORKSPACE.", 9, P.green, 23],
      ["THE INTEGRATORS COULD BUILD FREELY.", 7, P.white, 12], ["THE ROOMS COULD KEEP IMPROVING.", 7, P.white, 12], ["AND EVERY SIGNAL COULD MEET.", 7, P.white, 28],
      ["POLARIS-MAN", 13, P.lav, 14], ["THE HERO EVERY WORKSPACE NEEDED.", 7, P.white, 30], ["THE END", 12, P.green, 22],
    ];

    let y = H + 24 - t * 18;
    for (const [s, size, col, gap] of lines) {
      if (y > -24 && y < H + 10) this.txt(s, W / 2, y, col, "center", size);
      y += gap;
    }
    if (y < -8) {
      this.rect(62, 151, 196, 16, "rgba(5,4,12,.88)");
      x.strokeStyle = P.green;
      x.strokeRect(62, 151, 196, 16);
      this.txt("PRESS ENTER · RETURN TO URANUS", 160, 156, P.white, "center", 6);
    }
  }

  setClock(c: number): void {
    this.clockRef = c;
  }
}

/* --- DOM tile portraits (mission select and the briefing screen) --- */

export function drawPortrait(
  canvas: HTMLCanvasElement, m: Mission, getImage: ImageGetter,
): void {
  const p = canvas.getContext("2d");
  if (!p) return;
  const w = canvas.width;
  const h = canvas.height;

  /* THE TILE IS BAKED. scripts/build-polaris-man-tiles.mjs composites every
     step below at build time and writes select-tiles.png, so the menu blits a
     260x150 region instead of decoding two multi-megapixel source images per
     tile. Same pixels, 20 MB less to fetch.

     The live composite underneath is kept as the fallback, not as dead code: it
     is what runs if the sheet has not landed yet, and it stays the definition
     the build script is written against. Change one and change the other —
     which is why the script reads its mission order out of data.ts and fails
     rather than guessing. */
  const sheet = getImage("pm-select-tiles");
  if (sheet) {
    const i = MISSIONS.findIndex((q) => q.id === m.id);
    if (i >= 0) {
      p.imageSmoothingEnabled = false;
      p.drawImage(
        sheet,
        (i % TILE_COLS) * TILE_W, Math.floor(i / TILE_COLS) * TILE_H, TILE_W, TILE_H,
        0, 0, w, h,
      );
      return;
    }
  }
  const r = FIGURE_RECTS[m.id as MoonId]?.[3];
  p.imageSmoothingEnabled = false;
  p.fillStyle = "#080614";
  p.fillRect(0, 0, w, h);

  const bg = getImage(`pm-bg-${m.id}`);
  if (bg) p.drawImage(bg, 0, 0, w, h);
  p.fillStyle = "rgba(4,3,13,.34)";
  p.fillRect(0, 0, w, h);

  /* A wash of the mission accent behind where the boss stands, so the figure
     separates from the backdrop without anything being painted on top of it. */
  const halo = p.createRadialGradient(w * 0.6, h * 0.6, 6, w * 0.6, h * 0.6, h * 0.7);
  halo.addColorStop(0, m.accent);
  halo.addColorStop(1, "rgba(5,4,12,0)");
  p.globalAlpha = 0.2;
  p.fillStyle = halo;
  p.fillRect(0, 0, w, h);
  p.globalAlpha = 1;
  p.strokeStyle = m.accent;
  p.strokeRect(4, 4, w - 8, h - 8);

  /* The boss at tile scale, not a badge in the corner: the same locked
     FIGURE_RECTS sub-rect the game draws, filling the panel height and standing
     on the floor of the tile, so the tile reads as "who you are about to fight". */
  const fig = getImage(`pm-fig-${m.id}`);
  if (fig && r) {
    const sw = r[2] - r[0];
    const sh = r[3] - r[1];
    const dh = h * 0.96;
    const dw = (sw / sh) * dh;
    p.drawImage(fig, r[0], r[1], sw, sh, w * 0.6 - dw / 2, h - dh, dw, dh);
  }
}

/**
 * The briefing hero: the mission's own backdrop, full bleed, with its boss
 * standing in front of it at something like real scale.
 *
 * The old briefing put a 520x300 thumbnail beside a column of prose, so the
 * boss you were about to fight was about forty pixels tall and the screen was
 * mostly text. This fills the panel with the moon and lets the boss occupy it,
 * with a scrim on the reading side so the copy stays legible over the art.
 *
 * Still nothing but `drawImage` against the locked sheets — the boss is the
 * same `FIGURE_RECTS[id][3]` sub-rect the game draws, just large.
 */
export function drawMissionHero(
  canvas: HTMLCanvasElement, m: Mission, getImage: ImageGetter,
): void {
  const p = canvas.getContext("2d");
  if (!p) return;
  const w = canvas.width;
  const h = canvas.height;
  p.imageSmoothingEnabled = false;
  p.fillStyle = "#070413";
  p.fillRect(0, 0, w, h);

  const final = m.id === "final";

  /* Backdrop: the arena for the four moons that have one, else the level panel. */
  const bgKey = final
    ? "pm-bg-final"
    : ORIGINAL_MOONS.has(m.id) ? `pm-arena-${m.id}` : `pm-bg-${m.id}`;
  const bg = getImage(bgKey) ?? getImage(`pm-bg-${m.id}`);
  if (bg) p.drawImage(bg, 0, 0, w, h);

  /* Reading scrim: opaque at the left where the copy sits, clear on the right
     where the boss stands. */
  const g = p.createLinearGradient(0, 0, w, 0);
  g.addColorStop(0, "rgba(5,4,12,.95)");
  g.addColorStop(0.42, "rgba(5,4,12,.78)");
  g.addColorStop(0.72, "rgba(5,4,12,.22)");
  g.addColorStop(1, "rgba(5,4,12,.05)");
  p.fillStyle = g;
  p.fillRect(0, 0, w, h);

  /* A wash of the mission accent behind the figure, so it separates from the
     backdrop without touching the sprite itself. */
  const halo = p.createRadialGradient(w * 0.7, h * 0.55, 8, w * 0.7, h * 0.55, h * 0.62);
  halo.addColorStop(0, m.accent);
  halo.addColorStop(1, "rgba(5,4,12,0)");
  p.globalAlpha = 0.16;
  p.fillStyle = halo;
  p.fillRect(0, 0, w, h);
  p.globalAlpha = 1;

  const bossImg = final ? getImage("pm-boss-final") : getImage(`pm-fig-${m.id}`);
  const r = final ? FINAL_BOSS_FRAMES[0] : FIGURE_RECTS[m.id as MoonId]?.[3];
  if (bossImg && r) {
    const sw = r[2] - r[0];
    const sh = r[3] - r[1];
    /* Fill most of the panel height, bottom-aligned, sitting right of centre. */
    const dh = h * 0.94;
    const dw = (sw / sh) * dh;
    p.drawImage(bossImg, r[0], r[1], sw, sh, w * 0.68 - dw / 2, h - dh, dw, dh);
  }

  /* A thin accent rule along the foot, the same device the sector plaques use. */
  p.fillStyle = m.accent;
  p.fillRect(0, h - 3, w, 3);
}

export function drawFinalPortrait(canvas: HTMLCanvasElement, getImage: ImageGetter): void {
  const p = canvas.getContext("2d");
  if (!p) return;
  const w = canvas.width;
  const h = canvas.height;
  const r = FINAL_BOSS_FRAMES[0];
  p.imageSmoothingEnabled = false;
  p.fillStyle = "#070413";
  p.fillRect(0, 0, w, h);

  const bg = getImage("pm-bg-final");
  if (bg) p.drawImage(bg, 0, 0, w, h);
  const g = p.createLinearGradient(0, 0, w, 0);
  g.addColorStop(0, "rgba(5,4,12,.94)");
  g.addColorStop(0.48, "rgba(5,4,12,.55)");
  g.addColorStop(1, "rgba(5,4,12,.08)");
  p.fillStyle = g;
  p.fillRect(0, 0, w, h);

  const boss = getImage("pm-boss-final");
  if (boss) {
    const sw = r[2] - r[0];
    const sh = r[3] - r[1];
    const dh = h * 1.25;
    const dw = (sw / sh) * dh;
    p.drawImage(boss, r[0], r[1], sw, sh, w - dw - 18, -8, dw, dh);
  }
  p.strokeStyle = "#f7f3ff";
  p.lineWidth = 3;
  p.strokeRect(4, 4, w - 8, h - 8);
  for (let i = 0; i < 4; i++) {
    p.fillStyle = [P.green, P.lav, P.cyan, P.copper][i];
    p.fillRect(20 + i * 22, h - 14, 14, 3);
  }
}

export function drawPolarisPortrait(canvas: HTMLCanvasElement, getImage: ImageGetter): void {
  const p = canvas.getContext("2d");
  if (!p) return;
  const w = canvas.width;
  const h = canvas.height;
  const r = BASE_FRAMES[0];
  p.imageSmoothingEnabled = false;
  p.fillStyle = "#070413";
  p.fillRect(0, 0, w, h);

  const bg = getImage("pm-title-bg");
  if (bg) {
    const iw = bg instanceof HTMLImageElement ? bg.naturalWidth : bg.width;
    const ih = bg instanceof HTMLImageElement ? bg.naturalHeight : bg.height;
    p.drawImage(bg, 0, 0, iw, ih, 0, 0, w, h);
  }
  const g = p.createRadialGradient(w * 0.5, h * 0.45, 4, w * 0.5, h * 0.45, h * 0.75);
  g.addColorStop(0, "rgba(109,91,184,.12)");
  g.addColorStop(0.55, "rgba(5,4,12,.5)");
  g.addColorStop(1, "rgba(5,4,12,.9)");
  p.fillStyle = g;
  p.fillRect(0, 0, w, h);

  /* A bust, not the full figure.
     At 260x150 the whole standing operator is about 30px of readable face and a
     lot of boot — it reads as a silhouette rather than as the character. So this
     crops the head and shoulders out of the idle frame and fills the tile with
     them. Nothing is redrawn: the crop is the top OPERATOR_BUST_FRACTION of the
     same locked sub-rect the game already draws, scaled up. */
  const op = getImage("pm-operator");
  if (op) {
    const sw = r[2] - r[0];
    const fullH = r[3] - r[1];
    const bustH = Math.round(fullH * OPERATOR_BUST_FRACTION);
    /* Slight inset on each side: the standing pose is narrower at the shoulders
       than the frame is wide, and cropping to the body keeps the head centred. */
    const inset = Math.round(sw * 0.14);
    const srcX = r[0] + inset;
    const srcW = sw - inset * 2;
    const scale = h / bustH;
    const dw = srcW * scale;
    p.drawImage(op, srcX, r[1], srcW, bustH, (w - dw) / 2, 0, dw, h);
  }
  p.strokeStyle = P.green;
  p.lineWidth = 3;
  p.strokeRect(4, 4, w - 8, h - 8);
  p.fillStyle = P.green;
  for (let i = 0; i < 4; i++) p.fillRect(w / 2 - 34 + i * 18, h - 12, 12, 3);
}
