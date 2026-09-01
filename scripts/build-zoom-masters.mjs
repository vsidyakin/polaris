#!/usr/bin/env node
/**
 * Cut the product zoom sequences out of their white-background renders, and
 * write the alpha masters that scripts/build-zoom-frames.mjs then downscales.
 *
 * WHY THIS EXISTS
 * ---------------
 * The renders arrive as frames on a white sweep with a soft contact shadow, and
 * the marketing folder also carries a set of pre-cut `*_alpha` PNGs. Do not use
 * those. Their mattes are a hard luminance threshold: the alpha is 1-bit, so
 * every edge is aliased; the threshold cuts straight through anything lighter
 * than mid-grey, which shreds the Pro's silver base and the whole front face
 * carrying the wordmark; and the speckle left behind forces a morphological
 * open to clean up, which then eats the corners. That set was shipped once and
 * had to be redone. This script is that redo, and it is the source of truth.
 *
 * WHAT MAKES THE CUT HARD
 * -----------------------
 * Three things, and a naive threshold gets all three wrong:
 *
 * 1. The frames carry a one-pixel black border on the right column and bottom
 *    row — an artifact of the mp4 the frames were pulled from, not content.
 *    Left in, it reads as a hairline box drawn around the picture, and it is
 *    also what all the "speckle" in the old mattes actually was. Step 1 paints
 *    the outer ring white so it becomes background like any other.
 *
 * 2. Product and shadow overlap in brightness, so no single cutoff finds the
 *    silhouette. What does separate them is sharpness: a product edge steps
 *    100+ levels in one pixel, a shadow ramps 2 to 10. So the flood fill is
 *    blocked by a barrier built from edges that are sharp AND darker than that
 *    sequence's shadow floor — the shadow can then never block the fill, while
 *    a light silver rim still is protected. Both cutoffs are per sequence; see
 *    SEQUENCES below for why one pair of numbers cannot serve both products.
 *
 * 3. Some edges are defocused: the Mini's lower front ramps over six pixels.
 *    A binary mask lands somewhere in the middle of that ramp and forces
 *    half-covered, half-white pixels to full opacity, which is exactly the
 *    bright hairline the old set had along every edge. So the mask only decides
 *    WHERE the boundary is; the alpha across a band either side of it is
 *    computed, not taken from the mask.
 *
 * HOW THE ALPHA IS COMPUTED
 * -------------------------
 * The background is white, so an edge pixel is C = a*F + (1-a)*255 for some
 * product colour F. Estimate F by extending the interior colour outward with a
 * normalised convolution — blur the interior, blur the interior's own mask, and
 * divide — then a = (255 - C) / (255 - F). That gives a true soft matte, and it
 * kills the shadow for free: a shadow pixel sits far from any product colour,
 * so its computed alpha comes out near zero. Edge pixels are then given the
 * estimated F as their colour, so no white survives to fringe against the dark
 * page the frames are shown on.
 *
 *   node scripts/build-zoom-masters.mjs          (or `pnpm images:masters`)
 *   node scripts/build-zoom-masters.mjs pod-mini-zoom-alpha   (one sequence)
 *
 * The sources live beside the repo rather than in it — they are hundreds of MB
 * of 4K PNG and have no business in git. Point MARKETING_DIR elsewhere if your
 * copy is not at ../marketing.
 *
 * Re-run this, then `pnpm images:zoom`, whenever the renders are re-exported.
 */
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const run = promisify(execFile);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MARKETING = process.env.MARKETING_DIR || join(ROOT, '..', 'marketing');

/* Tuning, measured off the frames rather than guessed.
 *
 * These are PER SEQUENCE and must stay that way. The two products do not sit in
 * the same range of grey, and one set of numbers cannot serve both:
 *
 *   Pro   the body bottoms out near 175 and its contact shadow starts near 194,
 *         so brightness nearly separates them and `dark` can be a real gate.
 *   Mini  its silver top face sits near 235 — lighter than the Pro's shadow, and
 *         only twenty levels off the white background it lies against. Nothing
 *         about brightness distinguishes it, so `dark` is opened right up and
 *         `edge` is dropped until that twenty-level step registers as an edge.
 *         Sharpness is then the only thing separating that face from the paper.
 *
 * Tuned wrong, the failure is not subtle and it is not obvious either: the flood
 * walks through the Mini's top face and dissolves it, leaving slivers along the
 * edges that read as bright streaks shooting off the chassis. Both that and a
 * 1-bit version of this cut have shipped once each. If a third sequence is
 * added, MEASURE it — do not inherit a row below.
 */
const SEQUENCES = [
  {
    name: 'pod-pro-zoom-alpha',
    src: 'proMersive 2 Pod -  Zoom In (1)',
    fuzz: '25%', // the flood takes anything above ~191, clearing a shadow from ~194
    dark: '74%', // only an edge darker than ~189 may block it; the shadow never is
    edge: '12%', // a 31-level step in one pixel
  },
  {
    name: 'pod-mini-zoom-alpha',
    src: 'miniNew Angle Mersive 1  ON -White (2)',
    fuzz: '12%', // stops at ~224, below the ~230 shadow
    dark: '99%', // no darkness gate: the top face it must protect is lighter than the shadow
    edge: '6%', // 15 levels, low enough to catch the 255->235 step at that face
  },
];

const BAND = 5; // pixels either side of the boundary where alpha is computed
const SPECK = 2000; // blobs smaller than this are dropped BY AREA, never by eroding
const PAD = 8; // breathing room left around the content when cropping
const WHITE = '96.5%,98.8%'; // in the edge band, this bright means background, full stop

/** Cut one frame. Writes an RGBA PNG at the source's full canvas size. */
async function matte(src, out, T, tune) {
  const m = (...a) => run('magick', a.map(String), { maxBuffer: 1 << 28 });
  const f = (n) => join(T, n);
  // 1. the 1px black frame border is an mp4 artifact -> repaint it as background
  await m(src, '-shave', '4x4', '-bordercolor', 'white', '-border', '4', f('clean.png'));
  await m(f('clean.png'), '-colorspace', 'Gray', f('L.png'));
  // 2. barrier: sharp, and dark enough for this sequence. Dilated by one, because
  //    a single pinhole in the ring lets the flood into the body behind it.
  await m(f('L.png'), '-morphology', 'EdgeOut', 'Octagon:1', '-threshold', tune.edge, f('Bs.png'));
  await m(f('L.png'), '-threshold', tune.dark, '-negate', f('Bd.png'));
  await m(f('Bs.png'), f('Bd.png'), '-compose', 'Multiply', '-composite', '-morphology', 'Dilate', 'Disk:1', f('B.png'));
  await m(f('L.png'), '(', f('B.png'), '-negate', ')', '-compose', 'Multiply', '-composite', f('Lbar.png'));
  // 3. flood the background in from all four corners
  const { stdout: size } = await m(f('Lbar.png'), '-format', '%w %h', 'info:');
  const [W, H] = size.trim().split(/\s+/).map(Number);
  await m(
    f('Lbar.png'), '-alpha', 'set', '-fuzz', tune.fuzz, '-fill', 'none',
    '-draw', 'alpha 0,0 floodfill',
    '-draw', `alpha ${W - 1},0 floodfill`,
    '-draw', `alpha 0,${H - 1} floodfill`,
    '-draw', `alpha ${W - 1},${H - 1} floodfill`,
    '-alpha', 'extract', f('M.png')
  );
  // 4. drop strays by area; eroding here is what chewed the corners last time
  await m(
    f('M.png'), '-define', `connected-components:area-threshold=${SPECK}`,
    '-define', 'connected-components:mean-color=true',
    '-connected-components', '8', '-threshold', '50%', f('M2.png')
  );
  await m(f('M2.png'), '-morphology', 'Erode', `Disk:${BAND}`, f('Me.png'));
  await m(f('M2.png'), '-morphology', 'Dilate', `Disk:${BAND}`, f('Md.png'));
  await m(f('M2.png'), '-morphology', 'Erode', 'Disk:2', f('Msrc.png'));
  // 5. estimate the product colour under the edge by extending the interior out
  await m(f('Msrc.png'), '-blur', '0x4', f('den.png'));
  await m('(', f('L.png'), f('Msrc.png'), '-compose', 'Multiply', '-composite', ')', '-blur', '0x4', f('lnum.png'));
  await m(f('lnum.png'), f('den.png'), '-compose', 'Divide', '-composite', f('LFraw.png'));
  await m('(', f('clean.png'), f('Msrc.png'), '-compose', 'Multiply', '-composite', ')', '-blur', '0x4', f('cnum.png'));
  await m(f('cnum.png'), f('den.png'), '-compose', 'Divide', '-composite', f('Fraw.png'));
  /* Guard the divide. Where too little interior fed the estimate — a chassis
     lip only a few pixels deep — the denominator goes to zero and both results
     run away to white, which is how an earlier cut of this put opaque white
     tabs on top of the Mini, over background that was pure white in the source.
     Where the estimate is not supported, fall back to the pixel itself. */
  await m(f('den.png'), '-threshold', '5%', f('valid.png'));
  await m(f('L.png'), f('LFraw.png'), f('valid.png'), '-composite', f('LF.png'));
  await m(f('clean.png'), f('Fraw.png'), f('valid.png'), '-composite', f('Fcol.png'));
  // 6. alpha = unpremultiply against white, over the band only, solid inside it
  await m('(', f('L.png'), '-negate', ')', '(', f('LF.png'), '-negate', ')', '-compose', 'Divide', '-composite', f('alum.png'));
  await m(f('alum.png'), f('Md.png'), '-compose', 'Multiply', '-composite', f('A1.png'));
  /* Backstop: nothing in the band may be opaque where the source is white. The
     interior is exempt, so the Pro's white coin cell keeps its alpha. */
  await m(f('L.png'), '-level', WHITE, '-negate', f('wg.png'));
  await m(f('A1.png'), f('wg.png'), '-compose', 'Multiply', '-composite', f('A2.png'));
  await m(f('A2.png'), f('Me.png'), '-compose', 'Lighten', '-composite', f('A.png'));
  // 7. edge pixels take the estimated colour, so no white is left to fringe
  await m(f('Fcol.png'), f('clean.png'), f('Me.png'), '-composite', f('RGB.png'));
  await m(f('RGB.png'), f('A.png'), '-alpha', 'off', '-compose', 'CopyOpacity', '-composite', out);
}

/** Union of every frame's alpha bounds, grown to exactly 16:9 inside the canvas. */
async function cropBox(mattes) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, W = 0, H = 0;
  for (const p of mattes) {
    const { stdout } = await run('magick', [p, '-alpha', 'extract', '-threshold', '8%', '-format', '%@ %w %h', 'info:']);
    const [box, w, h] = stdout.trim().split(/\s+/);
    W = Number(w); H = Number(h);
    const [, bw, bh, bx, by] = box.match(/(\d+)x(\d+)\+(\d+)\+(\d+)/).map(Number);
    x0 = Math.min(x0, bx); y0 = Math.min(y0, by);
    x1 = Math.max(x1, bx + bw); y1 = Math.max(y1, by + bh);
  }
  x0 = Math.max(0, x0 - PAD); y0 = Math.max(0, y0 - PAD);
  x1 = Math.min(W, x1 + PAD); y1 = Math.min(H, y1 + PAD);
  /* 16:9 is not cosmetic: the pages declare width="1440" height="810" on every
     frame, and both widths below divide a 16-multiple exactly, so the variants
     land on 1440x810 and 720x405 with no rounding. */
  let w = Math.max(x1 - x0, Math.ceil(((y1 - y0) * 16) / 9));
  w = Math.min(Math.ceil(w / 16) * 16, Math.floor(W / 16) * 16);
  let h = (w * 9) / 16;
  if (h > H) { h = Math.floor(H / 9) * 9; w = (h * 16) / 9; }
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const x = Math.min(Math.max(Math.round(cx - w / 2), 0), W - w);
  const y = Math.min(Math.max(Math.round(cy - h / 2), 0), H - h);
  return `${w}x${h}+${x}+${y}`;
}

async function sequence(seq) {
  const dir = join(MARKETING, seq.src);
  const frames = (await readdir(dir)).filter((f) => /^f\d+\.png$/i.test(f)).sort();
  if (!frames.length) throw new Error(`no f####.png frames in ${dir}`);
  const dst = join(ROOT, 'public/products', seq.name);
  await mkdir(dst, { recursive: true });
  const T = await mkdtemp(join(tmpdir(), 'zoommatte-'));
  try {
    const mattes = [];
    for (const [i, file] of frames.entries()) {
      const out = join(T, `m${String(i + 1).padStart(2, '0')}.png`);
      await matte(join(dir, file), out, T, seq);
      mattes.push(out);
      process.stdout.write(`\r[masters] ${seq.name}: cut ${i + 1}/${frames.length}`);
    }
    const box = await cropBox(mattes);
    process.stdout.write(`\r[masters] ${seq.name}: ${frames.length} frames, crop ${box}\n`);
    for (const [i, src] of mattes.entries()) {
      const base = join(dst, `${seq.name}-${String(i + 1).padStart(2, '0')}`);
      await run('magick', [src, '-crop', box, '+repage', '-quality', '82', '-define', 'webp:alpha-quality=92', `${base}.webp`]);
      await run('magick', [src, '-crop', box, '+repage', '-quality', '58', `${base}.avif`]);
    }
    console.log(`[masters] ${seq.name}: wrote ${frames.length * 2} master files to public/products/${seq.name}`);
  } finally {
    await rm(T, { recursive: true, force: true });
  }
}

async function main() {
  const only = process.argv.slice(2);
  const todo = only.length ? SEQUENCES.filter((s) => only.includes(s.name)) : SEQUENCES;
  if (!todo.length) {
    console.error(`[masters] no sequence matched ${only.join(', ')}`);
    process.exit(1);
  }
  for (const seq of todo) await sequence(seq);
  console.log('[masters] done. Run `pnpm images:zoom` to rebuild the w720/w1440 variants.');
}

main().catch((err) => {
  console.error('[masters] failed:', err.message);
  console.error('[masters] needs ImageMagick (`magick`) with webp and avif delegates,');
  console.error(`[masters] and the renders at ${MARKETING} (override with MARKETING_DIR).`);
  process.exit(1);
});
