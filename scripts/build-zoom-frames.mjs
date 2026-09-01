#!/usr/bin/env node
/**
 * Downscale the product zoom sequences into the two widths the pages serve.
 *
 * WHY THIS EXISTS
 * ---------------
 * The masters in public/products/*-zoom-alpha are 3840x2160 with alpha —
 * the right thing to keep, and the wrong thing to ship. The stage displays them
 * at most 940 CSS px wide, and all twenty frames are decoded, because scrubbing
 * shows every one. At the master size that is 8.3 megapixels each: about 660 MB
 * of decoded bitmap held at once, which a laptop survives and a phone does not.
 * Bytes on the wire were never the problem — the set is only 1.3 MB as avif.
 * Decoded pixels are.
 *
 * At 1440 and 720 the same scrub costs about 93 MB and 23 MB, and `sizes` lets
 * a phone take the small one: a 2x phone showing the stage at 92vw of a 390px
 * window needs 718 device pixels, so it picks 720w and never touches the rest.
 *
 * The masters are left exactly where they are and are not referenced by the
 * page. Re-export them and re-run this; nothing else changes.
 *
 * Every directory under public/products matching *-zoom-alpha is processed, and
 * its own name is the frame prefix — pod-pro-zoom-alpha holds
 * pod-pro-zoom-alpha-NN.webp, pod-mini-zoom-alpha holds pod-mini-zoom-alpha-NN.
 * Dropping a new sequence in is therefore adding a directory, not editing this
 * file. Frame counts differ per sequence (Pro is 20, Mini is 24) and nothing
 * here assumes otherwise; the page that shows a sequence is what has to agree
 * with it.
 *
 *   node scripts/build-zoom-frames.mjs        (or `pnpm images:zoom`)
 *
 * ImageMagick does the work rather than sharp, because sharp is Astro's
 * dependency and not ours — it is in the store today because something else
 * asked for it, which is not a thing to build a script on.
 */
import { execFile } from 'node:child_process';
import { mkdir, readdir, stat } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const run = promisify(execFile);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PRODUCTS = join(ROOT, 'public/products');

/** Output width -> subdirectory. Both carry both formats. */
const WIDTHS = [720, 1440];

/* Quality: these are a matte product render on a dark page, largely flat black
   and one green light bar, so they take compression well. Alpha quality is held
   high separately — a soft edge on the chassis is the one artefact that would
   read as a halo against the page background. */
const AVIF_Q = 58;
const WEBP_Q = 82;

/** One sequence: downscale its masters, return what it wrote. */
async function sequence(name) {
  const dir = join(PRODUCTS, name);
  const frame = new RegExp(`^${name}-\\d+\\.webp$`);
  const masters = (await readdir(dir)).filter((f) => frame.test(f)).sort();
  if (!masters.length) {
    console.error(`[zoom] ${name}: no master frames matched ${name}-NN.webp`);
    process.exit(1);
  }

  for (const w of WIDTHS) await mkdir(join(dir, `w${w}`), { recursive: true });

  let written = 0;
  let skipped = 0;
  for (const file of masters) {
    const src = join(dir, file);
    const srcStat = await stat(src);
    for (const w of WIDTHS) {
      for (const [ext, args] of [
        ['avif', ['-quality', String(AVIF_Q)]],
        ['webp', ['-quality', String(WEBP_Q), '-define', 'webp:alpha-quality=92']],
      ]) {
        const out = join(dir, `w${w}`, file.replace(/\.webp$/, `.${ext}`));
        /* Skip anything already newer than its master, so a re-run after one
           re-exported frame costs four encodes and not eighty. */
        const done = await stat(out).catch(() => null);
        if (done && done.mtimeMs >= srcStat.mtimeMs) {
          skipped++;
          continue;
        }
        await run('magick', [src, '-resize', `${w}x`, ...args, out]);
        written++;
      }
    }
  }
  console.log(
    `[zoom] ${name}: ${masters.length} master frames -> ${written} written, ` +
      `${skipped} already current, at ${WIDTHS.join(' and ')} px wide in avif and webp.`
  );
}

async function main() {
  let dirs;
  try {
    dirs = (await readdir(PRODUCTS, { withFileTypes: true }))
      .filter((e) => e.isDirectory() && /-zoom-alpha$/.test(e.name))
      .map((e) => e.name)
      .sort();
  } catch {
    console.error(`[zoom] cannot read ${PRODUCTS}`);
    process.exit(1);
  }
  if (!dirs.length) {
    console.error(`[zoom] no *-zoom-alpha directories under ${PRODUCTS}`);
    process.exit(1);
  }

  for (const name of dirs) await sequence(name);
}

main().catch((err) => {
  console.error('[zoom] failed:', err.message);
  console.error('[zoom] ImageMagick (`magick`) with webp and avif delegates is required.');
  process.exit(1);
});
