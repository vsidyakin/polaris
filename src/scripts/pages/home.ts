// @ts-nocheck
/* eslint-disable */
/* ============================================================================
   HOME HERO STAGE (A0.1.f1) — "every share keeps an equal piece of the glass"
   ============================================================================

   Replaces the old .dframe/.dcanvas tile-carousel (SCENES/applyScene/
   startCanvasCycle), which went away with that markup.

   The story the loop tells: three devices come up, their wires light and start
   flowing, and one by one each device sends a share to the room display. Every
   time a share lands the glass re-divides so all live sources stay equal —
   1 share = full screen, 2 = halves, 3 = one half + two quarters, 4 = quadrants.
   Then it clears back to the idle screen and repeats.

   WHY THIS IS HAND-ROLLED. The design reference ("Mersive Homepage.html", a
   no-code export) drives this with a GSAP timeline. The SVG in index.astro came
   across from that export complete — every data-* hook the timeline touches is
   present, and the viewBox and the frame rect still carry the exact geometry the
   timeline assumes — but the driver never came with it, so the hero has been
   sitting on a frozen mid-animation frame. (That is what the baked
   transform="matrix(0.97,…)" and style="opacity:0" attributes in the markup are:
   GSAP's own inline output, captured at whatever instant the export was taken.
   init() below overwrites all of them, so they are harmless leftovers.)
   Rather than take on an animation library for one figure, this reproduces that
   timeline directly — the site has no animation dependency and the eight canvas
   games are hand-rolled too.

   MATCHING GSAP'S OUTPUT EXACTLY. Two details matter, and both were verified
   against the matrices baked into the markup:

   1. GSAP's `x`/`y`/`scale` on an SVG element are not attributes, they compose a
      transform matrix. With transformOrigin "50% 50%" the composition is
        translate(x,y) · translate(ox,oy) · scale(s) · translate(-ox,-oy)
      so the matrix is (s,0,0,s, x+ox(1-s), y+oy(1-s)). setMark/setScale below
      are exactly that.
   2. That origin (ox,oy) is the getBBox() centre — geometry only, stroke
      excluded. Every one of the four marks confirms it: tile 0 resolves to
      (0,16), tile 1 to (6.5,2) — which only works if you include its filled
      end-cap circle, exactly as getBBox() does — tile 2 to (0,3), tile 3 to
      (0,0). Feed those through the formula above and you get the baked matrices
      back to four decimals.

   The engine is a flat list of tweens with absolute start times, replayed from
   one rAF loop against `t = elapsed % CYCLE`. Applying them in start order,
   skipping any that have not begun, reproduces how a GSAP timeline renders on a
   forward pass: passed tweens hold their end value, the active one interpolates,
   future ones do not write yet. The layout each frame animates *from* is
   precomputed while the timeline is built (see `cur`) rather than sampled at
   runtime, because the sequence is deterministic — which is also how GSAP
   behaves on repeat, replaying from the values it recorded on the first pass. */
function buildStage() {
  const svg = document.querySelector("[data-stage]");
  if (!svg) return;
  const tiles = [0, 1, 2, 3].map((i) => svg.querySelector('[data-tile="' + i + '"]'));
  if (tiles.some((t) => !t)) return;
  const frames = tiles.map((t) => t.querySelector("[data-frame]"));
  const marks = tiles.map((t) => t.querySelector("[data-mark]"));
  if (frames.some((f) => !f) || marks.some((m) => !m)) return;
  const wires = [...svg.querySelectorAll("[data-wire]")];
  const devs = [...svg.querySelectorAll("[data-dev]")];
  const sparks = [...svg.querySelectorAll("[data-spark]")];
  const ring = svg.querySelector("[data-glowline]");
  const idle = svg.querySelector("[data-idle]");
  if (!wires.length || !devs.length || !sparks.length || !ring || !idle) return;

  /* The screen area the shares divide up, in viewBox units. These are the
     reference's numbers and they match the frame rect in the markup. */
  const X = 68, Y = 36, W = 484, H = 220, G = 8;
  const hw = (W - G) / 2, hh = (H - G) / 2;
  const LAYOUTS = {
    1: [[X, Y, W, H]],
    2: [[X, Y, hw, H], [X + hw + G, Y, hw, H]],
    3: [[X, Y, hw, H], [X + hw + G, Y, hw, hh], [X + hw + G, Y + hh + G, hw, hh]],
    4: [[X, Y, hw, hh], [X + hw + G, Y, hw, hh], [X, Y + hh + G, hw, hh], [X + hw + G, Y + hh + G, hw, hh]],
  };
  /* A mark is drawn at roughly 320x150 and shrinks to fit whatever box it lands
     in, never growing past the box on its tighter axis. */
  const markScale = (b) => Math.min(b[2] / 320, b[3] / 150);
  const boxCX = (b) => b[0] + b[2] / 2;
  const boxCY = (b) => b[1] + b[3] / 2;

  /* GSAP's easings, by their GSAP names. power1/2/3 are quad/cubic/quart. */
  const easeLinear = (p) => p;
  const easeP2Out = (p) => 1 - Math.pow(1 - p, 3);
  const easeP1InOut = (p) => (p < 0.5 ? 2 * p * p : 1 - 2 * Math.pow(1 - p, 2));
  const easeP3InOut = (p) => (p < 0.5 ? 8 * Math.pow(p, 4) : 1 - 8 * Math.pow(1 - p, 4));
  const easeBackOut = (p) => { const s = 1.6; p = p - 1; return p * p * ((s + 1) * p + s) + 1; };

  /* getBBox() throws in a detached/hidden subtree, so cache per mark and fall
     back to the element's own centre rather than letting the loop die. */
  const originCache = [];
  const markOrigin = (i) => {
    if (!originCache[i]) {
      let o = [0, 0];
      try {
        const b = marks[i].getBBox();
        if (b.width || b.height) o = [b.x + b.width / 2, b.y + b.height / 2];
      } catch {}
      originCache[i] = o;
    }
    return originCache[i];
  };
  const lenCache = [];
  const wireLen = (i) => {
    if (lenCache[i] == null) lenCache[i] = wires[i].getTotalLength();
    return lenCache[i];
  };

  /* (s,0,0,s, x+ox(1-s), y+oy(1-s)) — see the header note. */
  const setMark = (el, x, y, s, o) =>
    el.setAttribute("transform", "matrix(" + s + ",0,0," + s + "," + (x + o[0] * (1 - s)) + "," + (y + o[1] * (1 - s)) + ")");
  const setScale = (el, s, ox, oy) =>
    el.setAttribute("transform", "matrix(" + s + ",0,0," + s + "," + ox * (1 - s) + "," + oy * (1 - s) + ")");
  const op = (el, v) => { el.style.opacity = String(Math.max(0, Math.min(1, v))); };

  /* ---- the timeline ---------------------------------------------------- */
  const TW = [];
  const add = (t0, dur, ease, fn) => { TW.push({ t0, dur, ease, fn }); };

  /* Devices rise and fade in; wires fade in just behind them. */
  devs.forEach((d, i) => add(i * 0.12, 0.5, easeP2Out, (p) => {
    op(d, p);
    d.setAttribute("transform", "translate(0 " + 12 * (1 - p) + ")");
  }));
  wires.forEach((w, i) => add(0.3 + i * 0.1, 0.4, easeP2Out, (p) => op(w, p)));

  /* Where each frame currently sits, tracked as the timeline is assembled so
     every move knows its own start box. All four start parked on the
     single-share box, so the first share opens full-bleed. */
  const cur = [LAYOUTS[1][0], LAYOUTS[1][0], LAYOUTS[1][0], LAYOUTS[1][0]];

  /* Re-divide the glass for `count` live shares. */
  const place = (count, at) => {
    LAYOUTS[count].forEach((b, i) => {
      const a = cur[i];
      cur[i] = b;
      const f = frames[i], m = marks[i], o = markOrigin(i);
      const s0 = markScale(a), s1 = markScale(b);
      const ax = boxCX(a), ay = boxCY(a), bx = boxCX(b), by = boxCY(b);
      add(at, 0.6, easeP3InOut, (p) => {
        f.setAttribute("x", String(a[0] + (b[0] - a[0]) * p));
        f.setAttribute("y", String(a[1] + (b[1] - a[1]) * p));
        f.setAttribute("width", String(a[2] + (b[2] - a[2]) * p));
        f.setAttribute("height", String(a[3] + (b[3] - a[3]) * p));
        setMark(m, ax + (bx - ax) * p, ay + (by - ay) * p, s0 + (s1 - s0) * p, o);
      });
    });
  };

  /* One share: a spark rides its wire to the display, the tile lands, the glass
     re-divides, and the border ring pulses once. `silent` is the third share,
     which simply appears — no spark, because two shares already came up that
     wire and a third dot on it would read as the same device sending twice. */
  const send = (wireIdx, tileIdx, count, at, silent) => {
    if (!silent) {
      const path = wires[wireIdx], dot = sparks[wireIdx];
      add(at, 0.8, easeP1InOut, (p) => {
        const pt = path.getPointAtLength(p * wireLen(wireIdx));
        dot.setAttribute("cx", String(pt.x));
        dot.setAttribute("cy", String(pt.y));
        op(dot, 1);
      });
      add(at + 0.72, 0.18, easeP2Out, (p) => op(dot, 1 - p));
    }
    if (count > 1) place(count, at + 0.62);
    /* The first share is what takes the display off its idle screen. */
    if (count === 1) add(at + 0.5, 0.45, easeP2Out, (p) => op(idle, 1 - p));

    const b = LAYOUTS[count][tileIdx];
    const from = count === 1 ? 0.97 : 0.94;
    const ox = boxCX(b), oy = boxCY(b);
    add(at + 0.66, 0.5, easeBackOut, (p) => {
      op(tiles[tileIdx], p);
      setScale(tiles[tileIdx], from + (1 - from) * p, ox, oy);
    });
    add(at + 0.66, 0.7, easeP2Out, (p) => op(ring, 0.55 * (1 - p)));
  };

  send(0, 0, 1, 0.7);       // laptop → full screen
  send(1, 1, 2, 1.8);       // phone  → halves
  send(0, 2, 3, 2.9, true); // third share simply appears on the glass
  send(2, 3, 4, 4.0);       // guest  → quadrants

  /* Hold the four-up for a beat, then clear back to idle and loop. */
  const outAt = TW.reduce((m, t) => Math.max(m, t.t0 + t.dur), 0) + 2.4;
  tiles.forEach((t, i) => add(outAt + i * 0.06, 0.5, easeP2Out, (p) => op(t, 1 - p)));
  add(outAt + 0.2, 0.6, easeP2Out, (p) => op(idle, p));

  TW.sort((a, b) => a.t0 - b.t0);
  const CYCLE = TW.reduce((m, t) => Math.max(m, t.t0 + t.dur), 0) + 0.9;

  /* Park everything at the top of a cycle. Devices and wires are included
     because their fade-in tweens replay on every repeat. */
  const init = () => {
    const b = LAYOUTS[1][0];
    tiles.forEach((t, i) => {
      op(t, 0);
      setScale(t, 1, 0, 0);
      frames[i].setAttribute("x", String(b[0]));
      frames[i].setAttribute("y", String(b[1]));
      frames[i].setAttribute("width", String(b[2]));
      frames[i].setAttribute("height", String(b[3]));
      setMark(marks[i], boxCX(b), boxCY(b), markScale(b), markOrigin(i));
      cur[i] = b;
    });
    op(idle, 1);
    op(ring, 0);
    sparks.forEach((s) => op(s, 0));
    devs.forEach((d) => { op(d, 0); d.setAttribute("transform", "translate(0 12)"); });
    wires.forEach((w) => op(w, 0));
  };

  /* Reduced motion: show the finished four-up, no loop. Same as the reference —
     the point of the illustration is the equal-shares layout, so it is stated
     rather than performed. */
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    init();
    op(idle, 0);
    LAYOUTS[4].forEach((b, i) => {
      op(tiles[i], 1);
      frames[i].setAttribute("x", String(b[0]));
      frames[i].setAttribute("y", String(b[1]));
      frames[i].setAttribute("width", String(b[2]));
      frames[i].setAttribute("height", String(b[3]));
      setMark(marks[i], boxCX(b), boxCY(b), markScale(b), markOrigin(i));
    });
    devs.forEach((d) => { op(d, 1); d.setAttribute("transform", "translate(0 0)"); });
    wires.forEach((w) => op(w, 1));
    return;
  }

  let raf = 0, prev = 0, acc = 0, lastT = -1;
  const frame = (now) => {
    if (!prev) prev = now;
    /* Clamp the step so a backgrounded tab resumes rather than jumping a
       whole cycle (and skipping the wrap that calls init()). */
    acc += Math.min(0.05, (now - prev) / 1000);
    prev = now;
    const t = acc % CYCLE;
    if (t < lastT) init();
    lastT = t;
    for (const tw of TW) {
      if (t < tw.t0) continue;
      tw.fn(tw.ease(tw.dur ? Math.min(1, (t - tw.t0) / tw.dur) : 1));
    }
    /* Dashes drift along every wire, independent of the share timeline.
       dasharray is "5 7", so -48 is four whole periods and the loop is seamless. */
    const d = (acc / 2.4) % 1;
    wires.forEach((w) => { w.style.strokeDashoffset = String(-48 * d); });
    raf = requestAnimationFrame(frame);
  };
  const start = () => { if (!raf) { prev = 0; raf = requestAnimationFrame(frame); } };
  const stop = () => { if (raf) { cancelAnimationFrame(raf); raf = 0; } };

  init();
  /* No reason to run a hero animation nobody is looking at. */
  if ("IntersectionObserver" in window) {
    new IntersectionObserver((es) => (es[0].isIntersecting ? start() : stop()), { threshold: 0 }).observe(svg);
  } else {
    start();
  }
}

buildStage();



/* ============================================================================
   EGG SHARED INFRASTRUCTURE (Pass A)
   - EggAudio: pure-synthesis WebAudio engine (no external files)
   - renderKey(items): compact <kbd> controls legend
   - eggEndScreen(opts): shared game-over overlay (REPLAY / MISSION CONTROL)
   - eggLaunch / eggMenuClose / eggToggleMute + global M / Esc handling
   ============================================================================

   EggAudio sound inventory — synthesis parameters
   (every voice has an explicit attack and release ramp; master ceiling 0.25;
    context is created lazily on first user gesture; muted by default when
    prefers-reduced-motion is set; M toggles mute for the session)

   uiHover    sine 660->740 Hz gliss · 60 ms  · A5ms/R55ms  · peak .035 (rate-limited 90ms)
   uiClick    sine 520 Hz + sine 1040 Hz octave sparkle · 80 ms · A4/R75 · peak .06/.025
   blip       square 880 Hz · 70 ms · A3/R65 · peak .05 (generic pickup/confirm)
   thrust     white noise -> lowpass 420->240 Hz sweep · 220 ms · A30/R190 · peak .05
   laser(kind) per-weapon zap — short square/triangle chip voices, fast decay:
              crimp square 520->190 Hz · 90 ms · peak .05  (low thunk)
              blast square 1560->1140 Hz · 50 ms · peak .04 (high, rapid)
              multi square 784+988 Hz dyad · 50 ms · peak .032 each (chord blip)
              fiber square 2100->320 Hz zip · 110 ms · peak .045 (descending)
              sub   triangle 160->82 Hz thump · 140 ms · peak .07 (low)
   explode(s) s in 0..1: white noise -> lowpass 900->90 Hz sweep · 250+350*s ms ·
              A6/R rest · peak .09+.07*s, plus square drop 220->82 Hz · 220 ms · peak .06
   lineClear(n) sine arpeggio C5 E5 G5 C6 (523/659/784/1047 Hz) · 4 x 90 ms notes
              staggered 60 ms · each A5/R85 · peak .055 · whole run pitched up
              one semitone per combo step n (capped at +8)
   catchGood  sine 620->930 Hz rise · 120 ms · A4/R115 · peak .055
   catchBad   square 220->110 Hz fall · 200 ms · A5/R190 · peak .05
   jump       triangle 310->620 Hz quick rise · 100 ms · A3/R95 · peak .05
   stomp      square 300->130 Hz thud + noise tap 500->150 Hz · 90/70 ms · peak .06/.03
              (SIGNAL JUMPER: an interference glyph squashed underfoot)
   bounce     triangle 392->784 Hz spring · 100 ms · A3/R95 · peak .05
              (full-height stomp rebound / cache block bumped from below)
   levelClear 6-note square fanfare E5 G5 C6 G5 C6 E6 (659/784/1047/784/1047/1319 Hz)
              + triangle harmony an octave down · 6 x 120 ms staggered 90 ms ·
              peak .05/.035 (a display blinks back to the green workspace)
   powerup    triangle arpeggio E5 A5 (659/880 Hz) · 2 x 110 ms notes staggered 70 ms · A5/R105 · peak .055
   chomp      alternating square waka: 520->392 Hz / 392->300 Hz · 55 ms · A2/R53 · peak .04
              (PACKET MUNCHER dot loop — the two voices alternate per dot)
   powerPellet triangle 220->470 Hz rise + 330->705 Hz echo at +50 ms · 320 ms · peak .06/.035
   eatGhost(n) rising two-voice square chirp, base 440·1.335^(n-1) Hz for chain n 1..4
              (440/587/784/1047) · 160 ms + 120 ms echo · A4/R150 · peak .055/.03
   muncherDown descending square 660->110 Hz + triangle 330->87 Hz at +80 ms · ~700 ms
              + soft noise tail at +350 ms · peak .055 (the death spiral)
   laser('lance') deeper zap — square 290->92 Hz · 180 ms · peak .062 (column-piercing beam)
   levelUp    triangle G4 C5 E5 (392/523/659 Hz) · 3 x 120 ms staggered 90 ms · peak .06
   gameOver   descending square 4-note E4 C4 A3 F3 (330/262/220/175 Hz) · 4 x 160 ms
              staggered 170 ms · A6/R150 · peak .055 + short noise tail 300 ms · .035
   missionStart 6-note square motif G4 C5 E5 G5 E5 C6 (392/523/659/784/659/1047 Hz)
              · 6 x 90 ms staggered 80 ms · A4/R85 · peak .045 (mission go)
   bossWarn   two-tone square klaxon 740 / 554 Hz · 180 ms notes, hi-lo pair
              repeated at +450 ms · A6/R170 · peak .055 (arena alarm)
   weaponGet  square arpeggio C5 E5 A5 C6 (523/659/880/1047 Hz) · 4 x 70 ms
              staggered 50 ms · A4/R65 · peak .05 (new weapon online)
   victory    rising 6-note C5 D5 E5 G5 A5 C6 square lead (peak .05) + triangle
              harmony an octave down (peak .04) · 6 x 120 ms staggered 90 ms
   ambientHum two detuned sines 55 / 55.7 Hz, gain .016 with .006 depth LFO at .08 Hz,
              600 ms fade-in / 300 ms fade-out (the quiet modal drone)
   --- Pass C: chiptune sequencer -----------------------------------------
   EGG_MUSIC patterns: two square voices + one triangle bass, 8 steps/bar
   (eighth notes), notes are MIDI numbers (0 = rest); step pump runs on the
   existing AudioContext clock with a 140 ms lookahead, driven by
   EggAudio.musicTick() from the game loop. Voice peaks .05/.035/.07 — all
   under the .08 per-voice cap and the .25 master ceiling. Obeys the global
   mute (M) and the reduced-motion default-mute.
   music(name)   start/switch loop: 'overworld' (bright, 104 BPM, 8 bars) ·
                 'dungeon' (minor, sparse, 88 BPM, 8 bars) ·
                 'boss' (driving, 132 BPM, 4 bars) ·
                 'polaris' (Mission Control map — calm C-lydian, 76 BPM,
                 32 bars, form A A B A; optional per-track fields w1/w2/w3
                 (waveforms), att (attack s), vol (peak scalar) — polaris
                 runs sine/triangle at vol .6: peaks .03/.021/.042)
   musicStop()   silence (modal close, ceremony)
   itemGet       4-note pickup fanfare G5 B5 D6 G6 · 4 x 90 ms · peak .05
   ========================================================================== */
/* three original loops for THE LOST DISPLAY — see EggAudio doc block */

/* No static imports above, so mark this a module: without it the file is a
   global script and its top-level names collide with the other page scripts. */
export {};
