/* SOLAR CIRCUIT — the front end.
 *
 * Three steps in one scene: the title, choosing a craft, and choosing a course.
 * The last of those is the substantial one — nine cards down the left, and
 * whichever is under the cursor draws itself out on the right as a course map
 * and a description.
 *
 * WHY IT IS ONE SCENE AND NOT THREE
 *
 * The three steps share their chrome, their palette, their input handling and
 * their back-navigation, and they hand a growing selection along the chain. As
 * three scenes that state would have to live in the registry and be re-read on
 * every transition, and each would carry its own copy of the header and the key
 * hints. As one scene with a `step` and a container it rebuilds, the whole front
 * end is one file that can be read top to bottom.
 *
 * WHY IT IS DRAWN RATHER THAN BUILT OUT OF DOM
 *
 * The game is a full-bleed canvas inside a modal, and the overlay's own two
 * buttons are the only DOM on top of it. Menus in DOM would be easier to lay out
 * and would have to be positioned against a canvas that letterboxes into a
 * viewport of unknown shape — the two coordinate systems only line up loosely,
 * which is exactly why the course map keeps a generous gap from the ✕ button.
 * Drawing into the canvas keeps one coordinate system for everything.
 *
 * KEYBOARD AND MOUSE BOTH WORK
 *
 * Mouse because the cards invite it, keyboard because every other egg on this
 * site is playable without a pointer and this one should not be the exception.
 * The two share a single highlighted index rather than tracking hover
 * separately: moving the mouse moves the highlight, so the preview panel always
 * describes the thing the player would get if they committed right now, however
 * they got there.
 */

import Phaser from "phaser";
import { SCENE } from "./boot-scene";
import { getInput } from "./input";
import { SHIPS, shipFrame } from "./ships";
import { TRACKS, buildPieces, curveProfile, orientPath, planPath, type TrackSpec } from "./tracks";
import { VIEW } from "./view";

/** Registry key the menu leaves its choices under for the game scene. */
export const SELECTION_KEY = "solar-road-selection";

export interface Selection {
  shipId: string;
  trackId: string;
}

const FONT = "ui-monospace, Menlo, Consolas, monospace";
const INK = "#e2d9ff";
const MUTED = "#8f85b8";
const DIM = "#4a3d7d";
const GOLD = "#e8c76a";
const PANEL = 0x12102a;
const PANEL_HI = 0x241c45;
const EDGE = 0x4a3d7d;

type Step = "main" | "ship" | "track";

export default class MenuScene extends Phaser.Scene {
  private step: Step = "main";
  private shipIdx = 0;
  private trackIdx = 0;
  /** Everything the current step drew. Emptied and refilled on every step. */
  private layer!: Phaser.GameObjects.Container;

  /* Edge detection for the keyboard. The site owns the document's keys and feeds
     them to `RoadInput`, which reports levels rather than presses — so the menu
     has to notice the transitions itself. */
  private held: Record<string, boolean> = {};

  constructor() {
    super({ key: SCENE.MENU });
  }

  create(): void {
    this.layer = this.add.container(0, 0);
    this.held = {};
    this.show("main");
  }

  /* ------------------------------------------------------------------ input */

  update(): void {
    const cursors = getInput(this)?.cursors as unknown as
      | Record<string, { isDown: boolean }>
      | undefined;
    if (!cursors) return;

    const edge = (name: string): boolean => {
      const down = !!cursors[name]?.isDown;
      const fired = down && !this.held[name];
      this.held[name] = down;
      return fired;
    };

    const up = edge("up");
    const down = edge("down");
    const left = edge("left");
    const right = edge("right");
    const confirm = edge("confirm");
    const back = edge("cancel");

    if (this.step === "main") {
      if (confirm) this.show("ship");
      return;
    }

    if (this.step === "ship") {
      if (back) return this.show("main");
      if (left) this.pickShip((this.shipIdx + SHIPS.length - 1) % SHIPS.length);
      if (right) this.pickShip((this.shipIdx + 1) % SHIPS.length);
      if (confirm) this.show("track");
      return;
    }

    if (back) return this.show("ship");
    if (up) this.pickTrack((this.trackIdx + TRACKS.length - 1) % TRACKS.length);
    if (down) this.pickTrack((this.trackIdx + 1) % TRACKS.length);
    if (confirm) this.launch();
    void left;
    void right;
  }

  private launch(): void {
    const sel: Selection = { shipId: SHIPS[this.shipIdx]!.id, trackId: TRACKS[this.trackIdx]!.id };
    this.registry.set(SELECTION_KEY, sel);
    this.scene.start(SCENE.GAME);
  }

  /* ----------------------------------------------------------------- chrome */

  private show(step: Step): void {
    this.step = step;
    /* `removeAll(true)` destroys the children rather than orphaning them; the
       container itself was added to the display list once, in create(), and is
       reused. Re-adding it here would put it in the list twice. */
    this.layer.removeAll(true);

    this.text(VIEW.W / 2, 26, "SOLAR CIRCUIT", 34, INK, 0.5);
    this.text(VIEW.W / 2, 66, "MERCURY · THE NIGHT SIDE CIRCUIT", 13, MUTED, 0.5);

    if (step === "main") this.buildMain();
    else if (step === "ship") this.buildShip();
    else this.buildTrack();
  }

  /** Add a Text and park it in the current step's layer. */
  private text(
    x: number,
    y: number,
    body: string,
    size: number,
    color: string,
    originX = 0,
    wrap = 0,
  ): Phaser.GameObjects.Text {
    const t = this.add
      .text(x, y, body, {
        fontFamily: FONT,
        fontSize: `${size}px`,
        color,
        ...(wrap ? { wordWrap: { width: wrap } } : {}),
      })
      .setOrigin(originX, 0);
    this.layer.add(t);
    return t;
  }

  /** A card: a filled rect that reports hover and clicks. */
  private card(
    x: number,
    y: number,
    w: number,
    h: number,
    selected: boolean,
    onHover: () => void,
    onPick: () => void,
  ): Phaser.GameObjects.Rectangle {
    const r = this.add.rectangle(x, y, w, h, selected ? PANEL_HI : PANEL, 0.92).setOrigin(0, 0);
    r.setStrokeStyle(selected ? 2 : 1, selected ? 0xa58cff : EDGE, selected ? 1 : 0.7);
    r.setInteractive({ useHandCursor: true });
    r.on("pointerover", onHover);
    r.on("pointerdown", onPick);
    this.layer.add(r);
    return r;
  }

  private hint(body: string): void {
    this.text(VIEW.W / 2, VIEW.H - 34, body, 13, MUTED, 0.5);
  }

  /* ------------------------------------------------------------------- main */

  private buildMain(): void {
    /* The hero, at 1:1. The canvas letterboxes into whatever box the overlay
       gives it and the game runs `pixelArt`, so the image is upscaled with
       nearest-neighbour along with everything else — drawing it at its own size
       keeps it in the same visual register as the sprites rather than making it
       the one smooth thing on screen. */
    const splash = this.add.image(VIEW.W / 2, 96, "splash").setOrigin(0.5, 0);
    this.layer.add(splash);

    this.text(
      VIEW.W / 2,
      420,
      "A run cut across Mercury's night side, Point A to Point B, against the clock.\nThe sun never sets here and never rises either. Keep it on the basalt.",
      17,
      MUTED,
      0.5,
    ).setAlign("center");

    const w = 300;
    const h = 78;
    const x = (VIEW.W - w) / 2;
    const y = 502;
    this.card(x, y, w, h, true, () => {}, () => this.show("ship"));
    this.text(VIEW.W / 2, y + 24, "PLAY", 32, INK, 0.5);

    this.hint("↑ ↓ ← →  choose    ENTER  select    ESC  mission control");
  }

  /* ------------------------------------------------------------------- ship */

  private pickShip(i: number): void {
    if (i === this.shipIdx) return;
    this.shipIdx = i;
    this.show("ship");
  }

  private buildShip(): void {
    this.text(VIEW.W / 2, 118, "SELECT CRAFT", 20, GOLD, 0.5);

    const w = 356;
    const h = 400;
    const gap = 26;
    const total = SHIPS.length * w + (SHIPS.length - 1) * gap;
    const x0 = (VIEW.W - total) / 2;

    SHIPS.forEach((ship, i) => {
      const x = x0 + i * (w + gap);
      const y = 160;
      const on = i === this.shipIdx;
      this.card(x, y, w, h, on, () => this.pickShip(i), () => this.show("track"));

      /* The craft itself, at rest and level. Drawn at 2.2x rather than the 3x it
         races at: three fills the card and leaves no room to read anything. */
      const img = this.add.image(x + w / 2, y + 92, shipFrame(ship, 0)).setScale(2.2);
      this.layer.add(img);

      this.text(x + w / 2, y + 150, ship.name, 26, on ? INK : MUTED, 0.5);
      this.text(x + 22, y + 190, ship.blurb, 13, MUTED, 0, w - 44);

      const stats: Array<[string, number]> = [
        ["TOP SPEED", ship.top],
        ["PICK-UP", ship.grip],
        ["HANDLING", ship.steer],
        ["BOOST", ship.boost],
      ];
      stats.forEach(([label, v], k) => {
        const sy = y + 288 + k * 26;
        this.text(x + 22, sy, label, 12, MUTED, 0);
        /* Bars are centred on parity: the balanced craft sits at half, and better
           or worse than balanced reads as longer or shorter without anybody
           having to know what 1.16 means. */
        const bw = 150;
        const bx = x + w - 22 - bw;
        const track = this.add.rectangle(bx, sy + 2, bw, 10, 0x05060f, 0.7).setOrigin(0, 0);
        const fill = this.add
          .rectangle(bx, sy + 2, bw * Phaser.Math.Clamp(v / 1.5, 0.1, 1), 10, on ? 0xa58cff : 0x4a3d7d, 1)
          .setOrigin(0, 0);
        this.layer.add(track);
        this.layer.add(fill);
      });
    });

    this.hint("← →  choose craft    ENTER  confirm    BACKSPACE  back");
  }

  /* ------------------------------------------------------------------ track */

  private pickTrack(i: number): void {
    if (i === this.trackIdx) return;
    this.trackIdx = i;
    this.show("track");
  }

  private buildTrack(): void {
    const ship = SHIPS[this.shipIdx]!;
    this.text(60, 110, "SELECT COURSE", 20, GOLD, 0);
    this.text(VIEW.W - 60, 110, `CRAFT · ${ship.name}`, 16, ship.color, 1);

    /* --- the column --- */
    const cw = 380;
    const ch = 52;
    const gap = 6;
    TRACKS.forEach((track, i) => {
      const x = 40;
      const y = 146 + i * (ch + gap);
      const on = i === this.trackIdx;
      this.card(x, y, cw, ch, on, () => this.pickTrack(i), () => this.launch());
      this.text(x + 16, y + 15, track.name, 18, on ? INK : MUTED, 0);
      this.text(
        x + cw - 16,
        y + 17,
        `${"■".repeat(track.difficulty)}${"□".repeat(5 - track.difficulty)}`,
        13,
        on ? GOLD : DIM,
        1,
      );
    });

    this.buildPreview(TRACKS[this.trackIdx]!);
    this.hint("↑ ↓  choose course    ENTER  race    BACKSPACE  change craft");
  }

  private buildPreview(track: TrackSpec): void {
    const px = 460;
    const py = 146;
    const pw = VIEW.W - px - 40;

    this.text(px, py, track.name, 30, INK, 0);
    this.text(px, py + 42, track.blurb, 14, MUTED, 0, pw);

    /* --- the course, drawn from the same pieces the race will be built from ---
     *
     * It takes the whole panel now. It used to share the space with a standing-
     * times board, and with that gone the map is the only thing the player has
     * to judge a course by before committing to it — so it gets the room. */
    const map = { x: px, y: py + 132, w: pw, h: 342 };
    const g = this.add.graphics();
    this.layer.add(g);
    g.fillStyle(0x0b0918, 0.6);
    g.fillRect(map.x, map.y, map.w, map.h);
    g.lineStyle(1, EDGE, 0.6);
    g.strokeRect(map.x, map.y, map.w, map.h);

    const { pts } = orientPath(planPath(curveProfile(buildPieces(track)), 12));
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const q of pts) {
      if (q.x < minX) minX = q.x;
      if (q.x > maxX) maxX = q.x;
      if (q.y < minY) minY = q.y;
      if (q.y > maxY) maxY = q.y;
    }
    const pad = 34;
    /* Guard the degenerate case: a dead straight course has zero width and
       dividing by it puts every point at NaN, which draws nothing at all. */
    const scale = Math.min(
      (map.w - pad * 2) / Math.max(1e-6, maxX - minX),
      (map.h - pad * 2) / Math.max(1e-6, maxY - minY),
    );
    const ox = map.x + map.w / 2 - ((minX + maxX) / 2) * scale;
    const oy = map.y + map.h / 2 + ((minY + maxY) / 2) * scale;
    const sx = (q: { x: number }) => ox + q.x * scale;
    const sy = (q: { y: number }) => oy - q.y * scale;

    /* Two strokes, as the in-race map does it: a wide dim one for the trail's
       width and a bright one down the middle. */
    g.lineStyle(9, EDGE, 0.85);
    g.beginPath();
    g.moveTo(sx(pts[0]!), sy(pts[0]!));
    for (let i = 1; i < pts.length; i++) g.lineTo(sx(pts[i]!), sy(pts[i]!));
    g.strokePath();
    g.lineStyle(3, 0x8f7ae0, 1);
    g.beginPath();
    g.moveTo(sx(pts[0]!), sy(pts[0]!));
    for (let i = 1; i < pts.length; i++) g.lineTo(sx(pts[i]!), sy(pts[i]!));
    g.strokePath();

    const a = pts[0]!;
    const b = pts[pts.length - 1]!;
    g.fillStyle(0x7ce3a8, 1);
    g.fillCircle(sx(a), sy(a), 6);
    g.fillStyle(0xe8c76a, 1);
    g.fillCircle(sx(b), sy(b), 6);
    this.text(sx(a), sy(a) + 12, "A", 14, "#7ce3a8", 0.5);
    this.text(sx(b), sy(b) - 30, "B", 14, GOLD, 0.5);
  }
}
