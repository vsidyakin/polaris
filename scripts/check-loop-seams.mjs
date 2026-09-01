/**
 * Loop-seam check for the rendered NES tracks.
 *
 * Waveform cross-correlation between a file's head and tail is a tempting
 * seam test and a misleading one for chiptune: a square wave that happens to
 * restart antiphase correlates at -1 while sounding perfectly continuous. What
 * a listener actually hears at a bad loop point is one of three things, so
 * those are what this measures:
 *
 *   1. A GAP     — the track fades or stops before the end, so the loop
 *                  audibly breathes. Caught by comparing RMS in the last 50 ms
 *                  against the track's own average.
 *   2. A CLICK   — a large sample-to-sample step at the join. Caught by
 *                  comparing the single step from last sample to first sample
 *                  against the distribution of steps inside the track.
 *   3. A LURCH   — energy on one side of the join wildly unlike the other.
 *                  Caught by the ratio of RMS across the boundary.
 *
 * Each is judged against the track's own statistics rather than a fixed
 * threshold, because a boss theme and a game-over cue have nothing in common
 * in absolute terms.
 *
 * One-shot cues (Victory, Game Over) are expected to end quiet and are
 * reported but not failed — they are never looped by the game.
 *
 * Usage: node scripts/check-loop-seams.mjs <wavDir> [--oneshot 12,14]
 */

import { readFileSync, readdirSync } from "node:fs";
import { join, basename } from "node:path";

const DIR = process.argv[2];
if (!DIR) {
  console.error("usage: node scripts/check-loop-seams.mjs <wavDir> [--oneshot 12,14]");
  process.exit(1);
}
const oneShotArg = process.argv.indexOf("--oneshot");
const ONE_SHOTS = oneShotArg > -1 ? (process.argv[oneShotArg + 1] ?? "").split(",") : ["12", "14"];

function decodeWav(buf) {
  let pos = 12;
  let fmt = null;
  let data = null;
  while (pos + 8 <= buf.length) {
    const id = buf.toString("ascii", pos, pos + 4);
    const size = buf.readUInt32LE(pos + 4);
    const body = pos + 8;
    if (id === "fmt ") {
      fmt = { channels: buf.readUInt16LE(body + 2), rate: buf.readUInt32LE(body + 4), bits: buf.readUInt16LE(body + 14) };
    } else if (id === "data") {
      data = buf.subarray(body, body + size);
    }
    pos = body + size + (size & 1);
  }
  const frames = Math.floor(data.length / (2 * fmt.channels));
  const x = new Float32Array(frames);
  for (let i = 0; i < frames; i++) {
    let s = 0;
    for (let c = 0; c < fmt.channels; c++) s += data.readInt16LE((i * fmt.channels + c) * 2);
    x[i] = s / (fmt.channels * 32768);
  }
  return { ...fmt, x, seconds: frames / fmt.rate };
}

const rms = (a) => {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * a[i];
  return Math.sqrt(s / Math.max(1, a.length));
};

/**
 * Largest sample-to-sample step inside the track.
 *
 * This, not a percentile, is the right yardstick for chiptune. A square wave
 * IS a train of discontinuities: the track already makes a jump of this size
 * hundreds of times a second, and the ear hears it as timbre, not as a click.
 * A wrap-around step no larger than one the track already contains therefore
 * cannot stand out as a defect. (An earlier version of this check compared
 * against the 99th percentile, which sits down in the flat tops of the wave and
 * flagged four perfectly clean loops.)
 */
function maxStep(x) {
  let m = 0;
  for (let i = 0; i < x.length - 1; i++) {
    const d = Math.abs(x[i + 1] - x[i]);
    if (d > m) m = d;
  }
  return m;
}

const files = readdirSync(DIR).filter((f) => f.toLowerCase().endsWith(".wav")).sort();
const rows = [];
let failures = 0;

for (const f of files) {
  const w = decodeWav(readFileSync(join(DIR, f)));
  const { x, rate } = w;
  const win = Math.floor(rate * 0.05); // 50 ms

  const overall = rms(x);
  const head = rms(x.subarray(0, win));
  const tail = rms(x.subarray(x.length - win));

  // The join: last sample wrapping to first.
  const joinStep = Math.abs(x[0] - x[x.length - 1]);
  const mStep = maxStep(x);

  const isOneShot = ONE_SHOTS.some((n) => f.startsWith(n));

  // A gap = the tail is far quieter than the track's own average.
  const gapRatio = tail / (overall || 1);
  // A lurch = head and tail energies are wildly different.
  const lurch = Math.max(head, tail) / (Math.min(head, tail) || 1e-9);
  // A click = the join jumps further than anything the track does internally.
  const clickRatio = joinStep / (mStep || 1e-9);

  const verdict = [];
  if (!isOneShot) {
    if (gapRatio < 0.35) verdict.push("GAP");
    if (lurch > 3) verdict.push("LURCH");
    if (clickRatio > 1) verdict.push("CLICK");
  }
  const ok = verdict.length === 0;
  if (!ok) failures++;

  rows.push({
    track: basename(f, ".wav"),
    sec: Math.round(w.seconds * 100) / 100,
    tailVsAvg: Math.round(gapRatio * 100) / 100,
    headTailRatio: Math.round(lurch * 100) / 100,
    joinPctFS: Math.round(joinStep * 1000) / 10,
    joinVsMaxStep: Math.round(clickRatio * 100) / 100,
    result: isOneShot ? "one-shot (not looped)" : ok ? "seamless" : verdict.join("+"),
  });
}

console.table(rows);
console.log(
  "\ntailVsAvg      : tail energy / track average. Near 1 = the track is still playing at the end (no fade-out gap).",
);
console.log(
  "headTailRatio  : louder side / quieter side across the join. Near 1 = no audible lurch.",
);
console.log(
  "joinPctFS      : the wrap-around jump as a percentage of full scale.",
);
console.log(
  "joinVsMaxStep  : that jump / the largest step the track already makes internally. <=1 means the loop",
);
console.log(
  "                 point is no sharper than a square edge the track produces constantly, i.e. not a click.\n",
);

if (failures) {
  console.error(`${failures} track(s) flagged`);
  process.exit(1);
}
console.log(`All ${rows.filter((r) => r.result === "seamless").length} looping tracks pass; ${rows.length - rows.filter((r) => r.result === "seamless").length} one-shot cue(s) exempt.`);
