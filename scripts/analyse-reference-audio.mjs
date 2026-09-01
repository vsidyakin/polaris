/**
 * Measure the Stability reference tracks so the NES arrangements can be built
 * on evidence rather than on the prompt copy alone.
 *
 * This is explicitly NOT transcription. It recovers the things that survive
 * being measured — tempo, section boundaries, energy shape, register spread,
 * and a coarse per-beat pitch estimate for the dominant voice — and writes them
 * out as JSON. Anything it cannot establish, it says so rather than inventing.
 *
 * Why it exists: the arrangements have to preserve the functional role of each
 * cue (how fast, how dense, where it lifts, where it rests). Those are exactly
 * the properties an amplitude/spectrum analysis can establish reliably, and
 * exactly the ones that are hardest to guess from a text prompt.
 *
 * Usage: node scripts/analyse-reference-audio.mjs <dir> <outDir>
 */

import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { join, basename } from "node:path";

const IN_DIR = process.argv[2];
const OUT_DIR = process.argv[3];
if (!IN_DIR || !OUT_DIR) {
  console.error("usage: node scripts/analyse-reference-audio.mjs <wavDir> <outDir>");
  process.exit(1);
}
mkdirSync(OUT_DIR, { recursive: true });

/* --- WAV decode (PCM 16-bit only, which is what the batch produced) -------- */

function decodeWav(buf) {
  if (buf.toString("ascii", 0, 4) !== "RIFF" || buf.toString("ascii", 8, 12) !== "WAVE") {
    throw new Error("not a RIFF/WAVE file");
  }
  let pos = 12;
  let fmt = null;
  let data = null;
  while (pos + 8 <= buf.length) {
    const id = buf.toString("ascii", pos, pos + 4);
    const size = buf.readUInt32LE(pos + 4);
    const body = pos + 8;
    if (id === "fmt ") {
      fmt = {
        format: buf.readUInt16LE(body),
        channels: buf.readUInt16LE(body + 2),
        rate: buf.readUInt32LE(body + 4),
        bits: buf.readUInt16LE(body + 14),
      };
    } else if (id === "data") {
      data = buf.subarray(body, body + size);
    }
    pos = body + size + (size & 1);
  }
  if (!fmt || !data) throw new Error("missing fmt or data chunk");
  if (fmt.format !== 1 || fmt.bits !== 16) throw new Error(`unsupported: fmt=${fmt.format} bits=${fmt.bits}`);

  const frames = Math.floor(data.length / (2 * fmt.channels));
  const mono = new Float32Array(frames);
  for (let i = 0; i < frames; i++) {
    let sum = 0;
    for (let c = 0; c < fmt.channels; c++) sum += data.readInt16LE((i * fmt.channels + c) * 2);
    mono[i] = sum / (fmt.channels * 32768);
  }
  return { ...fmt, frames, mono, seconds: frames / fmt.rate };
}

/* --- radix-2 FFT ---------------------------------------------------------- */

function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const ur = re[i + k];
        const ui = im[i + k];
        const vr = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci;
        const vi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
        re[i + k] = ur + vr;
        im[i + k] = ui + vi;
        re[i + k + len / 2] = ur - vr;
        im[i + k + len / 2] = ui - vi;
        const ncr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = ncr;
      }
    }
  }
}

const FFT_N = 2048;
const HOP = 512;
const hann = Float32Array.from({ length: FFT_N }, (_, i) =>
  0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (FFT_N - 1)),
);

/** Magnitude spectrogram, plus the spectral-flux onset envelope. */
function spectrogram(x, rate) {
  const cols = Math.max(0, Math.floor((x.length - FFT_N) / HOP));
  const bins = FFT_N / 2;
  const mags = [];
  const flux = new Float32Array(cols);
  let prev = new Float32Array(bins);

  const re = new Float64Array(FFT_N);
  const im = new Float64Array(FFT_N);

  for (let c = 0; c < cols; c++) {
    const off = c * HOP;
    for (let i = 0; i < FFT_N; i++) {
      re[i] = x[off + i] * hann[i];
      im[i] = 0;
    }
    fft(re, im);
    const m = new Float32Array(bins);
    let f = 0;
    for (let b = 0; b < bins; b++) {
      m[b] = Math.hypot(re[b], im[b]);
      const d = m[b] - prev[b];
      if (d > 0) f += d;
    }
    mags.push(m);
    flux[c] = f;
    prev = m;
  }
  return { mags, flux, cols, bins, binHz: rate / FFT_N, colSec: HOP / rate };
}

/** Tempo by autocorrelating the onset envelope over a musical range. */
function estimateTempo(flux, colSec, minBpm = 70, maxBpm = 210) {
  const n = flux.length;
  if (!n) return { bpm: null, confidence: 0 };
  const mean = flux.reduce((a, b) => a + b, 0) / n;
  const c = Float32Array.from(flux, (v) => v - mean);

  let best = { bpm: null, score: -Infinity };
  const scores = [];
  for (let bpm = minBpm; bpm <= maxBpm; bpm += 0.25) {
    const lag = Math.round(60 / bpm / colSec);
    if (lag < 2 || lag >= n) continue;
    let s = 0;
    let norm = 0;
    for (let i = 0; i + lag < n; i++) {
      s += c[i] * c[i + lag];
      norm += c[i] * c[i];
    }
    const score = norm > 0 ? s / norm : 0;
    scores.push(score);
    if (score > best.score) best = { bpm, score };
  }
  const mu = scores.reduce((a, b) => a + b, 0) / (scores.length || 1);
  const sd = Math.sqrt(scores.reduce((a, b) => a + (b - mu) ** 2, 0) / (scores.length || 1)) || 1;
  return { bpm: best.bpm ? Math.round(best.bpm * 10) / 10 : null, confidence: Math.round(((best.score - mu) / sd) * 100) / 100 };
}

/** RMS in fixed windows — the energy curve the arrangement has to follow. */
function energyCurve(x, rate, windowSec = 1) {
  const w = Math.floor(rate * windowSec);
  const out = [];
  for (let i = 0; i + w <= x.length; i += w) {
    let s = 0;
    for (let j = 0; j < w; j++) s += x[i + j] * x[i + j];
    out.push(Math.round(Math.sqrt(s / w) * 10000) / 10000);
  }
  return out;
}

/**
 * Section boundaries by self-similarity novelty over averaged spectra.
 * Coarse on purpose: what matters is "there is a change around 0:32", not a
 * sample-accurate edit point.
 */
function sections(mags, colSec, binHz, minGapSec = 8) {
  const perSec = Math.round(1 / colSec);
  const frames = [];
  for (let i = 0; i + perSec <= mags.length; i += perSec) {
    const acc = new Float32Array(64);
    for (let j = 0; j < perSec; j++) {
      const m = mags[i + j];
      for (let b = 0; b < 64; b++) {
        // log-spaced band summary up to ~8 kHz
        const lo = Math.floor(Math.pow(b / 64, 2) * (4000 / binHz));
        const hi = Math.max(lo + 1, Math.floor(Math.pow((b + 1) / 64, 2) * (4000 / binHz)));
        let s = 0;
        for (let k = lo; k < hi && k < m.length; k++) s += m[k];
        acc[b] += s / (hi - lo);
      }
    }
    let norm = 0;
    for (const v of acc) norm += v * v;
    norm = Math.sqrt(norm) || 1;
    frames.push(Float32Array.from(acc, (v) => v / norm));
  }

  const novelty = frames.map((f, i) => {
    if (i === 0) return 0;
    let dot = 0;
    for (let b = 0; b < f.length; b++) dot += f[b] * frames[i - 1][b];
    return 1 - dot;
  });

  const mu = novelty.reduce((a, b) => a + b, 0) / (novelty.length || 1);
  const sd = Math.sqrt(novelty.reduce((a, b) => a + (b - mu) ** 2, 0) / (novelty.length || 1)) || 1;
  const marks = [];
  for (let i = 1; i < novelty.length - 1; i++) {
    if (novelty[i] < mu + 1.6 * sd) continue;
    if (novelty[i] < novelty[i - 1] || novelty[i] < novelty[i + 1]) continue;
    if (marks.length && i - marks[marks.length - 1] < minGapSec) continue;
    marks.push(i);
  }
  return marks;
}

/** Coarse per-beat pitch of the strongest voice in the lead register. */
function leadContour(mags, colSec, binHz, bpm) {
  if (!bpm) return null;
  const beatCols = Math.max(1, Math.round(60 / bpm / colSec));
  const LO = 220;
  const HI = 1400;
  const names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const out = [];

  for (let c = 0; c + beatCols <= mags.length; c += beatCols) {
    const acc = new Float32Array(mags[0].length);
    for (let j = 0; j < beatCols; j++) {
      const m = mags[c + j];
      for (let b = 0; b < m.length; b++) acc[b] += m[b];
    }
    let bestBin = -1;
    let bestVal = 0;
    const loBin = Math.floor(LO / binHz);
    const hiBin = Math.ceil(HI / binHz);
    for (let b = loBin; b <= hiBin && b < acc.length; b++) {
      if (acc[b] > bestVal) { bestVal = acc[b]; bestBin = b; }
    }
    if (bestBin < 0) { out.push(null); continue; }

    // Parabolic interpolation for sub-bin accuracy.
    const y0 = acc[bestBin - 1] ?? 0;
    const y1 = acc[bestBin];
    const y2 = acc[bestBin + 1] ?? 0;
    const denom = y0 - 2 * y1 + y2;
    const shift = denom !== 0 ? (0.5 * (y0 - y2)) / denom : 0;
    const hz = (bestBin + shift) * binHz;

    const midi = Math.round(69 + 12 * Math.log2(hz / 440));
    out.push({ hz: Math.round(hz * 10) / 10, midi, note: `${names[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}` });
  }
  return out;
}

/** Energy split across bass / mid / treble — how the mix is stacked. */
function registerBalance(mags, binHz) {
  let low = 0;
  let mid = 0;
  let high = 0;
  for (const m of mags) {
    for (let b = 0; b < m.length; b++) {
      const hz = b * binHz;
      if (hz < 250) low += m[b];
      else if (hz < 2000) mid += m[b];
      else high += m[b];
    }
  }
  const total = low + mid + high || 1;
  return {
    lowPct: Math.round((low / total) * 1000) / 10,
    midPct: Math.round((mid / total) * 1000) / 10,
    highPct: Math.round((high / total) * 1000) / 10,
  };
}

/** How closely the last bar resembles the first — does it actually loop? */
function loopSeam(x, rate, seconds = 2) {
  const w = Math.min(Math.floor(rate * seconds), Math.floor(x.length / 4));
  const head = x.subarray(0, w);
  const tail = x.subarray(x.length - w);
  let dot = 0;
  let hn = 0;
  let tn = 0;
  for (let i = 0; i < w; i++) {
    dot += head[i] * tail[i];
    hn += head[i] * head[i];
    tn += tail[i] * tail[i];
  }
  const corr = dot / (Math.sqrt(hn * tn) || 1);

  const edge = Math.floor(rate * 0.05);
  const rms = (a) => {
    let s = 0;
    for (let i = 0; i < a.length; i++) s += a[i] * a[i];
    return Math.sqrt(s / a.length);
  };
  return {
    headTailCorrelation: Math.round(corr * 1000) / 1000,
    startRms: Math.round(rms(x.subarray(0, edge)) * 10000) / 10000,
    endRms: Math.round(rms(x.subarray(x.length - edge)) * 10000) / 10000,
  };
}

/* --- run ------------------------------------------------------------------ */

const files = readdirSync(IN_DIR).filter((f) => f.toLowerCase().endsWith(".wav")).sort();
const summary = [];

for (const f of files) {
  process.stdout.write(`analysing ${f} … `);
  const wav = decodeWav(readFileSync(join(IN_DIR, f)));
  const sg = spectrogram(wav.mono, wav.rate);
  const tempo = estimateTempo(sg.flux, sg.colSec);
  const secs = sections(sg.mags, sg.colSec, sg.binHz);
  const report = {
    file: f,
    format: { codec: "PCM", bits: wav.bits, channels: wav.channels, sampleRate: wav.rate },
    seconds: Math.round(wav.seconds * 100) / 100,
    tempo,
    sectionBoundariesSec: secs,
    registerBalance: registerBalance(sg.mags, sg.binHz),
    energyCurveRmsPerSecond: energyCurve(wav.mono, wav.rate),
    loopSeam: loopSeam(wav.mono, wav.rate),
    leadContourPerBeat: leadContour(sg.mags, sg.colSec, sg.binHz, tempo.bpm),
    caveat:
      "Tempo, sections and energy are measured and reliable. leadContourPerBeat is the single strongest " +
      "spectral peak in 220-1400 Hz per beat: it tracks register and gross contour, but on dense mixes it " +
      "will latch onto whichever voice is loudest, so it is NOT a transcription and must not be treated as one.",
  };
  writeFileSync(join(OUT_DIR, basename(f, ".wav") + ".json"), JSON.stringify(report, null, 2));
  summary.push({
    file: f,
    sec: report.seconds,
    bpm: tempo.bpm,
    conf: tempo.confidence,
    sections: secs.length,
    ...report.registerBalance,
    seam: report.loopSeam.headTailCorrelation,
  });
  console.log(`${tempo.bpm} bpm (conf ${tempo.confidence}), ${secs.length} sections`);
}

writeFileSync(join(OUT_DIR, "_summary.json"), JSON.stringify(summary, null, 2));
console.table(summary);
