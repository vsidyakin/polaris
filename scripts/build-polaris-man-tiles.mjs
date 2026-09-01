/* Bakes the POLARIS MAN mission-select tiles into one sprite sheet.
 *
 *   node scripts/build-polaris-man-tiles.mjs      (or `pnpm images:pm-tiles`)
 *
 * Run it only when the level panels, the figure sheets, FIGURE_RECTS or the
 * mission accents change — the PNG it writes is committed, so a build never
 * depends on this script. Same arrangement as build-solar-road-art.mjs and
 * build-zoom-frames.mjs.
 *
 * WHY THIS EXISTS
 *
 * Mission select draws nine 260x150 canvases. Each one was composited in the
 * browser from that mission's full-size level panel and its full-size figure
 * sheet — so opening the menu fetched and decoded 21.7 MB of source art to
 * paint about 350,000 pixels of thumbnail. Measured in Chrome, the big panels
 * decode at 20-25 ms each; eighteen files streaming in behind the grid is where
 * the second and a half of tiles-popping-in came from, and on a real connection
 * the 21.7 MB download dwarfs that entirely.
 *
 * Every tile is a deterministic composite of static inputs, so all of it can
 * happen here instead. The sheet this writes is a few hundred KB.
 *
 * THE FULL-SIZE ART STAYS. It is not redundant: the panels are the scrolling
 * level backgrounds, and data.ts authors platform collision geometry in their
 * native pixel space (Desdemona's platforms run out to x=1774). This script
 * only removes them from the MENU's critical path — missionArt() still loads
 * the real thing when a mission is chosen.
 *
 * FIDELITY IS THE WHOLE POINT, so this reproduces drawPortrait() in render.ts
 * step for step, including the parts that are easy to get subtly wrong:
 *
 *   - imageSmoothingEnabled = false, so both drawImage calls are NEAREST
 *     NEIGHBOUR. Smooth resampling here would soften pixel art that the game
 *     deliberately keeps hard.
 *   - The accent halo is a canvas radial gradient with an inner radius of 6 and
 *     an outer of h*0.7, drawn at globalAlpha 0.2. Reproduced by evaluating the
 *     same two colour stops per pixel.
 *   - strokeRect() with the default lineWidth of 1 on integer coordinates
 *     straddles the pixel boundary, so a browser paints TWO half-covered rows
 *     rather than one solid one. That is emulated rather than "corrected" —
 *     the goal is the tile the game draws today, not a tidier one.
 *
 * NO IMAGE LIBRARY, DELIBERATELY. sharp is Astro's dependency and not ours (see
 * build-zoom-frames.mjs), ImageMagick is not present on every machine that
 * builds this, and the PNGs here are all 8-bit, non-interlaced RGB or RGBA —
 * the one shape a short decoder handles completely. Encoding was already
 * hand-rolled in build-solar-road-art.mjs; this adds the read side.
 */
import { deflateSync, inflateSync } from "node:zlib";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ART = join(ROOT, "public", "eggs", "polaris-man", "art");
const OUT = join(ART, "select-tiles.png");

/* Tile geometry: the <canvas width="260" height="150"> in ui.ts. Baked 1:1 so
   the blit needs no scaling and cannot soften. */
const TW = 260;
const TH = 150;
const COLS = 4;

/* Mirrors MISSIONS in data.ts — id, accent, and the file stems. Kept here
   rather than imported because this is a plain Node script and data.ts is TS;
   a mismatch is caught by the assertion at the bottom, which fails the run. */
const MISSIONS = [
  { id: "ariel", accent: "#7ce3a8", panel: "Ariel", figures: "Ariel" },
  { id: "umbriel", accent: "#b9a8ff", panel: "Umbriel", figures: "Umbriel" },
  { id: "titania", accent: "#61c8dc", panel: "Titania", figures: "Titania" },
  { id: "oberon", accent: "#e07856", panel: "Oberon", figures: "Oberon" },
  { id: "miranda", accent: "#ef6abf", panel: "Miranda", figures: "Miranda" },
  { id: "puckmoon", accent: "#a9f542", panel: "Puck", figures: "Puck" },
  { id: "cressida", accent: "#ef5a55", panel: "Cressida", figures: "Cressida" },
  { id: "desdemona", accent: "#36d8ef", panel: "Desdemona", figures: "Desdemona" },
];

/* FIGURE_RECTS[id][3] — the boss sub-rect, the same one drawPortrait uses. */
const BOSS_RECT = {
  ariel: [1229, 120, 1859, 723],
  umbriel: [1229, 80, 1850, 706],
  titania: [1190, 75, 1843, 744],
  oberon: [1175, 41, 1771, 736],
  miranda: [1160, 15, 1873, 795],
  puckmoon: [1020, 27, 1760, 843],
  cressida: [1100, 0, 1774, 868],
  desdemona: [1040, 15, 1774, 859],
};

/* ------------------------------------------------------------- PNG read --- */

/** Decode an 8-bit, non-interlaced RGB or RGBA PNG to {w,h,px} RGBA bytes. */
function decodePNG(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error("not a PNG");
  let p = 8;
  let w = 0, h = 0, colour = 0, depth = 0;
  const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p);
    const type = buf.toString("ascii", p + 4, p + 8);
    const data = buf.subarray(p + 8, p + 8 + len);
    if (type === "IHDR") {
      w = data.readUInt32BE(0);
      h = data.readUInt32BE(4);
      depth = data[8];
      colour = data[9];
      if (depth !== 8 || (colour !== 2 && colour !== 6) || data[12] !== 0) {
        throw new Error(`unsupported PNG: depth ${depth}, colour ${colour}, interlace ${data[12]}`);
      }
    } else if (type === "IDAT") idat.push(Buffer.from(data));
    else if (type === "IEND") break;
    p += 12 + len;
  }
  const bpp = colour === 6 ? 4 : 3;
  const raw = inflateSync(Buffer.concat(idat));
  const stride = w * bpp;
  const out = new Uint8Array(w * h * 4);
  const line = new Uint8Array(stride);
  const prev = new Uint8Array(stride);
  let o = 0;
  for (let y = 0; y < h; y++) {
    const filter = raw[o++];
    for (let i = 0; i < stride; i++) {
      const x = raw[o + i];
      const a = i >= bpp ? line[i - bpp] : 0;
      const b = prev[i];
      const c = i >= bpp ? prev[i - bpp] : 0;
      let v;
      if (filter === 0) v = x;
      else if (filter === 1) v = x + a;
      else if (filter === 2) v = x + b;
      else if (filter === 3) v = x + ((a + b) >> 1);
      else if (filter === 4) {
        const pp = a + b - c;
        const pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c);
        v = x + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
      } else throw new Error("bad filter " + filter);
      line[i] = v & 0xff;
    }
    o += stride;
    for (let x = 0; x < w; x++) {
      const s = x * bpp, d = (y * w + x) * 4;
      out[d] = line[s];
      out[d + 1] = line[s + 1];
      out[d + 2] = line[s + 2];
      out[d + 3] = bpp === 4 ? line[s + 3] : 255;
    }
    prev.set(line);
  }
  return { w, h, px: out };
}

/* ------------------------------------------------------------ PNG write --- */

const crcTable = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
const crc32 = (b) => {
  let c = -1;
  for (let i = 0; i < b.length; i++) c = crcTable[(c ^ b[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};
function encodePNG(w, h, px) {
  const raw = Buffer.alloc(h * (w * 4 + 1));
  for (let y = 0; y < h; y++) {
    const o = y * (w * 4 + 1);
    raw[o] = 0;
    Buffer.from(px.buffer, px.byteOffset + y * w * 4, w * 4).copy(raw, o + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/* --------------------------------------------------------------- canvas --- */

const hex = (s) => [
  parseInt(s.slice(1, 3), 16),
  parseInt(s.slice(3, 5), 16),
  parseInt(s.slice(5, 7), 16),
];

/** Source-over one pixel onto the sheet. */
function blend(sheet, sw, x, y, r, g, b, a) {
  if (a <= 0) return;
  const i = (y * sw + x) * 4;
  const inv = 1 - a;
  sheet[i] = Math.round(r * a + sheet[i] * inv);
  sheet[i + 1] = Math.round(g * a + sheet[i + 1] * inv);
  sheet[i + 2] = Math.round(b * a + sheet[i + 2] * inv);
  sheet[i + 3] = 255;
}

/** One tile, reproducing drawPortrait() step for step. */
function drawTile(sheet, sw, ox, oy, m, panel, figures) {
  const [ar, ag, ab] = hex(m.accent);

  /* 1. fillStyle "#080614", fillRect(0,0,w,h) */
  for (let y = 0; y < TH; y++) {
    for (let x = 0; x < TW; x++) {
      const i = ((oy + y) * sw + ox + x) * 4;
      sheet[i] = 0x08; sheet[i + 1] = 0x06; sheet[i + 2] = 0x14; sheet[i + 3] = 255;
    }
  }

  /* 2. drawImage(bg, 0, 0, w, h) — nearest neighbour, imageSmoothingEnabled=false */
  for (let y = 0; y < TH; y++) {
    const sy = Math.min(panel.h - 1, Math.floor((y * panel.h) / TH));
    for (let x = 0; x < TW; x++) {
      const sx = Math.min(panel.w - 1, Math.floor((x * panel.w) / TW));
      const s = (sy * panel.w + sx) * 4;
      blend(sheet, sw, ox + x, oy + y, panel.px[s], panel.px[s + 1], panel.px[s + 2], panel.px[s + 3] / 255);
    }
  }

  /* 3. fillStyle "rgba(4,3,13,.34)", fillRect(0,0,w,h) */
  for (let y = 0; y < TH; y++)
    for (let x = 0; x < TW; x++) blend(sheet, sw, ox + x, oy + y, 4, 3, 13, 0.34);

  /* 4. the accent halo: radial gradient, inner r=6, outer r=h*0.7, at alpha .2.
        Stops are accent (opaque) -> rgba(5,4,12,0), so colour lerps toward the
        near-black stop while alpha falls to zero across the same span. */
  const cx = TW * 0.6, cy = TH * 0.6, r0 = 6, r1 = TH * 0.7;
  for (let y = 0; y < TH; y++) {
    for (let x = 0; x < TW; x++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      let t = (d - r0) / (r1 - r0);
      if (t < 0) t = 0;
      if (t > 1) t = 1;
      const a = (1 - t) * 0.2;
      if (a <= 0) continue;
      blend(sheet, sw, ox + x, oy + y,
        ar + (5 - ar) * t, ag + (4 - ag) * t, ab + (12 - ab) * t, a);
    }
  }

  /* 5. strokeStyle accent, strokeRect(4, 4, w-8, h-8).
        lineWidth 1 on integer coords straddles the boundary, so each edge lands
        as two rows at half coverage. Emulated, not tidied. */
  const edge = (x0, y0, x1, y1) => {
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++)
        if (x >= 0 && y >= 0 && x < TW && y < TH) blend(sheet, sw, ox + x, oy + y, ar, ag, ab, 0.5);
  };
  const L = 4, T = 4, R = TW - 4, B = TH - 4;
  edge(L - 1, T - 1, R, T);          // top
  edge(L - 1, B - 1, R, B);          // bottom
  edge(L - 1, T - 1, L, B);          // left
  edge(R - 1, T - 1, R, B);          // right

  /* 6. the boss, from FIGURE_RECTS[id][3], filling 96% of the tile height and
        standing on the floor, centred on 0.6w — again nearest neighbour. */
  const r = BOSS_RECT[m.id];
  const sx0 = r[0], sy0 = r[1];
  const srcW = r[2] - r[0], srcH = r[3] - r[1];
  const dh = TH * 0.96;
  const dw = (srcW / srcH) * dh;
  const dx0 = TW * 0.6 - dw / 2;
  const dy0 = TH - dh;
  for (let y = Math.max(0, Math.floor(dy0)); y < Math.min(TH, Math.ceil(dy0 + dh)); y++) {
    const fy = sy0 + Math.floor(((y - dy0) / dh) * srcH);
    if (fy < 0 || fy >= figures.h) continue;
    for (let x = Math.max(0, Math.floor(dx0)); x < Math.min(TW, Math.ceil(dx0 + dw)); x++) {
      const fx = sx0 + Math.floor(((x - dx0) / dw) * srcW);
      if (fx < 0 || fx >= figures.w) continue;
      const s = (fy * figures.w + fx) * 4;
      const a = figures.px[s + 3] / 255;
      if (a > 0) blend(sheet, sw, ox + x, oy + y, figures.px[s], figures.px[s + 1], figures.px[s + 2], a);
    }
  }
}

/* ----------------------------------------------------------------- main --- */

/* The runtime finds a tile by MISSIONS.findIndex(), so this file's order IS the
   sheet's layout. If data.ts reorders or renames a mission and this does not,
   every tile silently shows the wrong boss — so check it rather than trust it. */
const dataTs = readFileSync(join(ROOT, "src", "games", "polaris-man", "data.ts"), "utf8");
const block = dataTs.slice(dataTs.indexOf("export const MISSIONS"));
const order = [...block.slice(0, block.indexOf("\n];")).matchAll(/\{\s*id:\s*"(\w+)"/g)].map((m) => m[1]);
const mine = MISSIONS.map((m) => m.id);
if (order.join() !== mine.join()) {
  console.error("\n  MISSION ORDER DRIFT — this script and data.ts disagree:");
  console.error("    data.ts:", order.join(", "));
  console.error("    here   :", mine.join(", "));
  console.error("  Fix the MISSIONS array above, then re-run.\n");
  process.exit(1);
}

const rows = Math.ceil(MISSIONS.length / COLS);
const SW = COLS * TW;
const SH = rows * TH;
const sheet = new Uint8Array(SW * SH * 4);

let sourceBytes = 0;
MISSIONS.forEach((m, i) => {
  const panelPath = join(ART, "backgrounds", `${m.panel}_Level_Panel_v1.png`);
  const figPath = join(ART, "production", `Level_${m.figures}_Figures_v1.png`);
  const panelBuf = readFileSync(panelPath);
  const figBuf = readFileSync(figPath);
  sourceBytes += panelBuf.length + figBuf.length;
  if (!BOSS_RECT[m.id]) throw new Error(`no BOSS_RECT for ${m.id} — has data.ts changed?`);
  drawTile(sheet, SW, (i % COLS) * TW, Math.floor(i / COLS) * TH, m, decodePNG(panelBuf), decodePNG(figBuf));
  process.stdout.write(`  ${m.id.padEnd(10)} baked\n`);
});

const png = encodePNG(SW, SH, sheet);
writeFileSync(OUT, png);

console.log(`\n  sheet   ${SW}x${SH}, ${MISSIONS.length} tiles at ${TW}x${TH} (${COLS} per row)`);
console.log(`  wrote   ${OUT.replace(ROOT + "\\", "").replace(ROOT + "/", "")}`);
console.log(`  source  ${(sourceBytes / 1048576).toFixed(1)} MB  ->  sheet ${(png.length / 1024).toFixed(0)} KB`);
console.log(`  saved   ${((sourceBytes - png.length) / 1048576).toFixed(1)} MB off the mission-select path\n`);
