/**
 * Test the crossfade-loop scheduler in EggAudio's rendered-track layer.
 *
 * The loop join is the one piece of that layer with real arithmetic in it, and
 * it is the piece a browser will not tell you is wrong — a half-second gap
 * every 48 seconds sounds like "the music stopped", not like a bug, and nobody
 * sits through eight minutes of a puzzle game to catch it.
 *
 * So the scheduling maths is replicated here against a fake clock and asserted
 * directly: iterations must overlap by exactly the crossfade, the two gain
 * ramps must cross, coverage must never gap, and the start times must not drift
 * over a long session. No Web Audio, no browser, no network.
 *
 * Mirrors pump() in src/scripts/eggs/runtime.ts. If you change the scheduler
 * there, change it here — a copy that silently disagrees is worse than none.
 *
 * Usage: `node scripts/test-egg-music-loop.mjs` (the `test:music` script).
 */

const XFADE = 0.5;
const SCHED_AHEAD = 2;
const GUARD = 8;

let failures = 0;
function check(label, cond, detail = "") {
  if (cond) {
    console.log(`  ok   ${label}`);
  } else {
    console.log(`  FAIL ${label}${detail ? " — " + detail : ""}`);
    failures++;
  }
}

/** Replica of pump(): returns every iteration scheduled up to `until`. */
function schedule({ duration, until, xfade = XFADE, pumpMs = 500 }) {
  const D = duration;
  const X = Math.min(xfade, D / 4);
  const iters = [];
  let next = 0.06;
  let now = 0;
  let tripped = false;

  while (now <= until) {
    let guard = 0;
    while (next < now + SCHED_AHEAD && guard < GUARD) {
      guard++;
      iters.push({ start: next, end: next + D, fadeInEnd: next + X, fadeOutStart: next + D - X });
      next = next + D - X;
    }
    if (guard >= GUARD) tripped = true;
    now += pumpMs / 1000;
  }
  return { iters, X, tripped };
}

console.log("crossfade loop scheduler\n");

/* ---- 1. a normal 48s track, the shape every manifest entry uses ---- */
{
  const { iters, X, tripped } = schedule({ duration: 48, until: 600 });
  check("schedules something", iters.length > 1, `got ${iters.length}`);
  check("guard never trips in steady state", !tripped);

  let gap = null,
    badOverlap = null,
    i;
  for (i = 1; i < iters.length; i++) {
    const prev = iters[i - 1],
      cur = iters[i];
    if (cur.start >= prev.end) gap = i;
    // the next iteration must begin exactly as the previous starts fading out
    if (Math.abs(cur.start - prev.fadeOutStart) > 1e-9) badOverlap = i;
  }
  check("coverage never gaps", gap === null, gap && `iteration ${gap} starts after the previous ends`);
  check(
    "each iteration starts exactly at the previous fade-out",
    badOverlap === null,
    badOverlap && `iteration ${badOverlap}`
  );

  // the ramps must actually cross: incoming fade-in ends after outgoing starts
  let noCross = null;
  for (i = 1; i < iters.length; i++) {
    if (iters[i].fadeInEnd < iters[i - 1].fadeOutStart) noCross = i;
  }
  check("gain ramps cross at the join", noCross === null, noCross && `iteration ${noCross}`);

  // start times must be an exact arithmetic series — no accumulated drift
  const step = 48 - X;
  const expected = 0.06 + step * (iters.length - 1);
  const drift = Math.abs(iters[iters.length - 1].start - expected);
  check("no drift over a 10-minute session", drift < 1e-9, `drift ${drift}`);
}

/* ---- 2. a very short buffer: X must clamp to D/4, not exceed the buffer ---- */
{
  const { iters, X } = schedule({ duration: 1.2, until: 30 });
  check("short buffer clamps the crossfade to D/4", Math.abs(X - 0.3) < 1e-9, `X=${X}`);
  check("short buffer still advances", iters[1].start > iters[0].start);
  let bad = null;
  for (let i = 1; i < iters.length; i++) if (iters[i].start >= iters[i - 1].end) bad = i;
  check("short buffer never gaps", bad === null);
}

/* ---- 3. a slow pump must not starve the schedule ---- */
{
  const { iters, tripped } = schedule({ duration: 48, until: 600, pumpMs: 1500 });
  check("survives a slow pump without tripping the guard", !tripped);
  check("slow pump still covers the session", iters.length > 10, `got ${iters.length}`);
}

/* ---- 4. a buffer shorter than the lookahead needs several per pump ---- */
{
  const { tripped, iters } = schedule({ duration: 0.8, until: 20 });
  check("sub-second buffer schedules without tripping the guard", !tripped, `${iters.length} iterations`);
}

console.log(`\n${failures ? failures + " FAILED" : "all passed"}`);
process.exit(failures ? 1 : 0);
