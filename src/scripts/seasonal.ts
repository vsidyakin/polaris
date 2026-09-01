/**
 * Seasonal effects — one canvas overlay that dresses the site for a holiday.
 *
 * Nothing starts this on its own. The only caller today is the dev panel's
 * SEASONAL group, which imports the module dynamically, so the chunk costs a
 * visitor nothing until somebody switches a season on. One season runs at a
 * time: they are ambient background, and two at once reads as a bug.
 *
 * **Written to outlive the dev panel, deliberately.** It imports nothing from
 * it, keeps no shared state, and styles its own canvas rather than depending on
 * dev-panel.css — so deleting the panel at launch (AGENTS.md) leaves this
 * intact. Shipping one for real is `setSeason("snow")` behind whatever trigger
 * marketing wants: a date window, a query flag, a CMS switch.
 *
 * Three things the effects can rely on, from `Stage`:
 *   `top`   the bottom edge of the site header. Nothing falls behind the nav —
 *           it is translucent and blurs whatever is under it, which turns
 *           snowflakes into smears.
 *   `dt`    seconds since the last frame, clamped, so a backgrounded tab does
 *           not teleport every particle when it comes back.
 *   `calm`  prefers-reduced-motion. Fewer particles, gentler travel, and no
 *           full-screen flashes — never a dead canvas, since a switch that
 *           visibly does nothing reads as broken.
 */

export type SeasonKey =
  | "fireworks"
  | "lunar"
  | "hearts"
  | "shamrock"
  | "spooky"
  | "leaves"
  | "snow";

/** Key, panel label, and the one-line description under it. Calendar order. */
export const SEASONS: [key: SeasonKey, label: string, note: string][] = [
  ["fireworks", "New Year", "shells off the bottom edge"],
  ["lunar", "Lunar New Year", "swaying lanterns, gold confetti"],
  ["hearts", "Valentine's Day", "hearts drifting up"],
  ["shamrock", "St Patrick's Day", "tumbling shamrocks"],
  ["spooky", "Halloween", "bats and low fog"],
  ["leaves", "Autumn / Thanksgiving", "leaves on a crosswind"],
  ["snow", "Christmas", "snow from under the nav"],
];

interface Stage {
  w: number;
  h: number;
  /** y of the bottom of the site header, or 0 on a page with no header. */
  top: number;
  /** Seconds since the previous frame, clamped to 50ms. */
  dt: number;
  /** Milliseconds since this season started. */
  t: number;
  /** prefers-reduced-motion. */
  calm: boolean;
}

interface Effect {
  tick(c: CanvasRenderingContext2D, s: Stage): void;
  /**
   * Per-frame alpha to erase the previous frame by, instead of clearing it.
   * Composited `destination-out`, so trails fade to transparent rather than
   * smearing black over the page. Fireworks are unreadable without it.
   */
  fade?: number;
}

/* ----------------------------------------------------------------- maths --- */

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T>(xs: readonly T[]): T => xs[(Math.random() * xs.length) | 0];
const TAU = Math.PI * 2;

/* ---------------------------------------------------------------- shapes --- */

/** Six-armed flake for the big ones; the small ones stay dots (see snow()). */
function flake(c: CanvasRenderingContext2D, x: number, y: number, r: number, spin: number) {
  c.save();
  c.translate(x, y);
  c.rotate(spin);
  c.lineWidth = Math.max(0.7, r * 0.28);
  c.lineCap = "round";
  c.beginPath();
  for (let i = 0; i < 3; i++) {
    const a = (i * Math.PI) / 3;
    c.moveTo(-Math.cos(a) * r, -Math.sin(a) * r);
    c.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  c.stroke();
  c.restore();
}

/** Heart on a 12px box, drawn around its own centre. */
function heart(c: CanvasRenderingContext2D, sc: number) {
  c.save();
  c.scale(sc / 6, sc / 6);
  c.beginPath();
  c.moveTo(0, -2.5);
  c.bezierCurveTo(-1.5, -5.5, -5, -4.5, -5, -1);
  c.bezierCurveTo(-5, 2, -1.5, 4.5, 0, 6);
  c.bezierCurveTo(1.5, 4.5, 5, 2, 5, -1);
  c.bezierCurveTo(5, -4.5, 1.5, -5.5, 0, -2.5);
  c.closePath();
  c.fill();
  c.restore();
}

/** Three lobes and a stem. Every fourth one gets the lucky fourth leaf. */
function shamrock(c: CanvasRenderingContext2D, r: number, lucky: boolean) {
  const lobes = lucky ? 4 : 3;
  for (let i = 0; i < lobes; i++) {
    const a = -Math.PI / 2 + (i * TAU) / lobes;
    c.beginPath();
    c.arc(Math.cos(a) * r * 0.62, Math.sin(a) * r * 0.62, r * 0.5, 0, TAU);
    c.fill();
  }
  c.beginPath();
  c.lineWidth = Math.max(1, r * 0.16);
  c.lineCap = "round";
  c.moveTo(0, r * 0.3);
  c.quadraticCurveTo(r * 0.28, r * 1.1, r * 0.06, r * 1.5);
  c.stroke();
}

/** Pointed oval with a centre vein. */
function leaf(c: CanvasRenderingContext2D, r: number, vein: string) {
  c.beginPath();
  c.moveTo(0, -r);
  c.quadraticCurveTo(r * 0.85, 0, 0, r);
  c.quadraticCurveTo(-r * 0.85, 0, 0, -r);
  c.fill();
  c.strokeStyle = vein;
  c.lineWidth = Math.max(0.6, r * 0.1);
  c.beginPath();
  c.moveTo(0, -r * 0.9);
  c.lineTo(0, r * 0.9);
  c.stroke();
}

/** Bat silhouette. `f` is the flap, -1 (up) to 1 (down). */
function bat(c: CanvasRenderingContext2D, sc: number, f: number) {
  c.save();
  c.scale(sc, sc);
  c.beginPath();
  c.moveTo(0, -3);
  for (const side of [1, -1]) {
    c.moveTo(0, -3);
    c.quadraticCurveTo(side * 6, -7 + f * 4, side * 14, -3 + f * 8);
    c.quadraticCurveTo(side * 10, 0 + f * 4, side * 11, 5 + f * 6);
    c.quadraticCurveTo(side * 6, 1 + f * 3, side * 3, 4);
    c.quadraticCurveTo(side * 1.5, 6.5, 0, 5);
    c.closePath();
  }
  c.fill();
  /* Head and ears, so it reads as a bat rather than a bow tie. */
  c.beginPath();
  c.arc(0, -3.5, 2.6, 0, TAU);
  c.moveTo(-2.4, -5);
  c.lineTo(-3.2, -8.5);
  c.lineTo(-0.6, -6.2);
  c.moveTo(2.4, -5);
  c.lineTo(3.2, -8.5);
  c.lineTo(0.6, -6.2);
  c.fill();
  c.restore();
}

/** Radial glow, the one thing every light-based season needs. */
function glow(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  colour: string,
  alpha: number
) {
  const g = c.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, colour);
  g.addColorStop(1, "rgba(0,0,0,0)");
  c.globalAlpha = alpha;
  c.fillStyle = g;
  c.beginPath();
  c.arc(x, y, r, 0, TAU);
  c.fill();
  c.globalAlpha = 1;
}

/* =============================================================== effects === */

/* ---------- Christmas: snow, starting under the nav ---------- */

function snow(): Effect {
  interface Flake {
    x: number;
    y: number;
    r: number;
    vy: number;
    sway: number;
    phase: number;
    spin: number;
    rot: number;
    op: number;
  }
  const flakes: Flake[] = [];
  let seeded = false;

  const make = (s: Stage, anywhere: boolean): Flake => {
    const r = rnd(1, 4.2);
    return {
      x: rnd(-20, s.w + 20),
      /* Recycled flakes re-enter at the header's lower edge, so snow never
         appears inside the nav or behind its backdrop blur. */
      y: anywhere ? rnd(s.top, s.h) : s.top - r * 2,
      r,
      vy: rnd(18, 46) * (0.55 + r / 5),
      sway: rnd(8, 26),
      phase: rnd(0, TAU),
      spin: rnd(-0.9, 0.9),
      rot: rnd(0, TAU),
      op: rnd(0.35, 0.9),
    };
  };

  return {
    tick(c, s) {
      const want = s.calm ? 55 : 160;
      while (flakes.length < want) flakes.push(make(s, !seeded));
      if (flakes.length > want) flakes.length = want;
      seeded = true;

      /* One slow gust for the whole field, so the snow reads as weather rather
         than as a hundred independent sprites. */
      const gust = Math.sin(s.t / 4200) * 22 + Math.sin(s.t / 1500) * 6;

      c.fillStyle = "#fff";
      c.strokeStyle = "#fff";
      for (const f of flakes) {
        f.phase += s.dt * 1.4;
        f.rot += f.spin * s.dt;
        f.x += (Math.sin(f.phase) * f.sway + gust) * s.dt;
        f.y += f.vy * s.dt * (s.calm ? 0.6 : 1);
        if (f.y - f.r > s.h || f.x < -40 || f.x > s.w + 40) Object.assign(f, make(s, false));

        c.globalAlpha = f.op;
        if (f.r > 2.6) flake(c, f.x, f.y, f.r, f.rot);
        else {
          c.beginPath();
          c.arc(f.x, f.y, f.r * 0.8, 0, TAU);
          c.fill();
        }
      }
      c.globalAlpha = 1;
    },
  };
}

/* ---------- New Year: shells from the bottom edge ---------- */

function fireworks(): Effect {
  interface Shell {
    x: number;
    y: number;
    vx: number;
    vy: number;
    hue: number;
    burst: number;
  }
  interface Spark {
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    max: number;
    hue: number;
    r: number;
    drag: number;
    grav: number;
  }
  const shells: Shell[] = [];
  const sparks: Spark[] = [];
  let next = 300;
  let flash = 0;

  const explode = (sh: Shell, s: Stage) => {
    const shape = pick(["ball", "ring", "willow"] as const);
    const n = s.calm ? 34 : shape === "willow" ? 60 : 88;
    for (let i = 0; i < n; i++) {
      const a = shape === "ring" ? (i / n) * TAU : rnd(0, TAU);
      const sp =
        shape === "ring"
          ? rnd(96, 112)
          : shape === "willow"
            ? rnd(20, 78)
            : rnd(24, 132) * Math.sqrt(Math.random());
      const max = shape === "willow" ? rnd(1.7, 2.6) : rnd(0.8, 1.6);
      sparks.push({
        x: sh.x,
        y: sh.y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: max,
        max,
        /* A shell is one colour with a few strays, which is what makes a real
           firework read as a single object. */
        hue: Math.random() < 0.86 ? sh.hue : (sh.hue + rnd(90, 270)) % 360,
        r: rnd(1, 2.4),
        drag: shape === "willow" ? 0.55 : 1.5,
        grav: shape === "willow" ? 58 : 34,
      });
    }
    if (!s.calm) flash = 0.5;
  };

  return {
    fade: 0.11,
    tick(c, s) {
      next -= s.dt * 1000;
      if (next <= 0) {
        next = s.calm ? rnd(1500, 2600) : rnd(420, 1150);
        const x = rnd(s.w * 0.12, s.w * 0.88);
        const apex = rnd(s.top + 40, s.top + (s.h - s.top) * 0.45);
        shells.push({
          x,
          y: s.h + 6,
          vx: rnd(-26, 26),
          /* v² = 2·g·height, so it runs out of climb exactly at the apex we
             picked rather than wherever gravity happens to catch it. */
          vy: -Math.sqrt(2 * 240 * (s.h - apex)),
          hue: rnd(0, 360),
          burst: apex,
        });
      }

      for (let i = shells.length - 1; i >= 0; i--) {
        const sh = shells[i];
        sh.vy += 240 * s.dt;
        sh.x += sh.vx * s.dt;
        sh.y += sh.vy * s.dt;
        c.fillStyle = `hsl(${sh.hue} 100% 74%)`;
        c.beginPath();
        c.arc(sh.x, sh.y, 2.1, 0, TAU);
        c.fill();
        glow(c, sh.x, sh.y, 16, `hsl(${sh.hue} 100% 70%)`, 0.32);
        if (sh.vy >= -6 || sh.y <= sh.burst) {
          explode(sh, s);
          shells.splice(i, 1);
        }
      }

      for (let i = sparks.length - 1; i >= 0; i--) {
        const p = sparks[i];
        p.life -= s.dt;
        if (p.life <= 0 || p.y > s.h + 30) {
          sparks.splice(i, 1);
          continue;
        }
        const drag = Math.max(0, 1 - p.drag * s.dt);
        p.vx *= drag;
        p.vy = p.vy * drag + p.grav * s.dt;
        p.x += p.vx * s.dt;
        p.y += p.vy * s.dt;
        const k = p.life / p.max;
        /* Cooling: white-hot at the burst, down to its own hue as it dies. */
        c.fillStyle = `hsl(${p.hue} 100% ${40 + k * 45}%)`;
        c.globalAlpha = Math.min(1, k * 1.5);
        c.beginPath();
        c.arc(p.x, p.y, p.r * (0.4 + k * 0.6), 0, TAU);
        c.fill();
      }
      c.globalAlpha = 1;

      if (flash > 0) {
        flash = Math.max(0, flash - s.dt * 2.2);
        c.fillStyle = `rgba(255,244,214,${flash * 0.05})`;
        c.fillRect(0, s.top, s.w, s.h - s.top);
      }
    },
  };
}

/* ---------- Lunar New Year: lanterns on the header, gold confetti ---------- */

function lunar(): Effect {
  interface Lantern {
    x: number;
    len: number;
    r: number;
    phase: number;
    speed: number;
    amp: number;
  }
  interface Bit {
    x: number;
    y: number;
    vy: number;
    flip: number;
    spin: number;
    tilt: number;
    w: number;
    gold: boolean;
  }
  const lanterns: Lantern[] = [];
  const bits: Bit[] = [];
  let seeded = false;

  return {
    tick(c, s) {
      if (!seeded) {
        seeded = true;
        const n = 6;
        for (let i = 0; i < n; i++)
          lanterns.push({
            x: ((i + 0.5) / n) * s.w + rnd(-24, 24),
            len: rnd(46, 120),
            r: rnd(15, 23),
            phase: rnd(0, TAU),
            speed: rnd(0.5, 0.9),
            amp: rnd(0.05, 0.13),
          });
      }

      /* Lanterns hang off the header's lower edge and swing as pendulums —
         angle first, position derived, so the string and the body cannot drift
         apart the way two independent sine waves would. */
      for (const l of lanterns) {
        l.phase += s.dt * l.speed * (s.calm ? 0.5 : 1);
        const a = Math.sin(l.phase) * l.amp;
        const x = l.x + Math.sin(a) * l.len;
        const y = s.top + Math.cos(a) * l.len;

        c.strokeStyle = "rgba(255,209,102,0.5)";
        c.lineWidth = 1;
        c.beginPath();
        c.moveTo(l.x, s.top);
        c.lineTo(x, y);
        c.stroke();

        c.save();
        c.translate(x, y);
        c.rotate(a);
        glow(c, 0, 0, l.r * 2.6, "rgba(255,110,80,0.55)", 0.5);
        c.fillStyle = "#d92b28";
        c.beginPath();
        c.ellipse(0, l.r * 0.62, l.r, l.r * 0.82, 0, 0, TAU);
        c.fill();
        c.fillStyle = "rgba(255,160,120,0.35)";
        c.beginPath();
        c.ellipse(-l.r * 0.3, l.r * 0.45, l.r * 0.3, l.r * 0.42, 0, 0, TAU);
        c.fill();
        c.fillStyle = "#f5c451";
        c.fillRect(-l.r * 0.5, -l.r * 0.06, l.r, l.r * 0.2);
        c.fillRect(-l.r * 0.5, l.r * 1.24, l.r, l.r * 0.2);
        c.strokeStyle = "#f5c451";
        c.lineWidth = 1.6;
        c.beginPath();
        c.moveTo(0, l.r * 1.44);
        c.lineTo(0, l.r * 2.1);
        c.stroke();
        c.restore();
      }

      const want = s.calm ? 24 : 70;
      while (bits.length < want)
        bits.push({
          x: rnd(0, s.w),
          y: rnd(s.top, s.h),
          vy: rnd(26, 62),
          flip: rnd(0, TAU),
          spin: rnd(1.6, 4),
          tilt: rnd(-0.5, 0.5),
          w: rnd(3.5, 7),
          gold: Math.random() < 0.65,
        });

      for (const b of bits) {
        b.flip += b.spin * s.dt;
        b.y += b.vy * s.dt;
        b.x += Math.sin(b.flip * 0.4) * 12 * s.dt;
        if (b.y > s.h + 10) {
          b.y = s.top - 10;
          b.x = rnd(0, s.w);
        }
        c.save();
        c.translate(b.x, b.y);
        c.rotate(b.tilt);
        /* Foil: the rectangle turns edge-on and back, and dims as it does. */
        const k = Math.cos(b.flip);
        c.fillStyle = b.gold ? "#f2c14e" : "#e2483f";
        c.globalAlpha = 0.45 + Math.abs(k) * 0.55;
        c.fillRect(-b.w / 2, -b.w * 0.75, b.w * Math.abs(k), b.w * 1.5);
        c.restore();
      }
      c.globalAlpha = 1;
    },
  };
}

/* ---------- Valentine's: hearts drifting up ---------- */

function hearts(): Effect {
  interface H {
    x: number;
    y: number;
    vy: number;
    sc: number;
    phase: number;
    sway: number;
    rot: number;
    hue: number;
    op: number;
  }
  const hs: H[] = [];
  let seeded = false;

  const make = (s: Stage, anywhere: boolean): H => ({
    x: rnd(0, s.w),
    y: anywhere ? rnd(s.top, s.h) : s.h + 20,
    vy: rnd(24, 60),
    sc: rnd(8, 22),
    phase: rnd(0, TAU),
    sway: rnd(10, 30),
    rot: rnd(-0.3, 0.3),
    hue: rnd(330, 360),
    op: rnd(0.35, 0.85),
  });

  return {
    tick(c, s) {
      const want = s.calm ? 16 : 40;
      while (hs.length < want) hs.push(make(s, !seeded));
      seeded = true;

      for (const h of hs) {
        h.phase += s.dt * 1.1;
        h.y -= h.vy * s.dt * (s.calm ? 0.6 : 1);
        h.x += Math.sin(h.phase) * h.sway * s.dt;
        if (h.y + h.sc < s.top) Object.assign(h, make(s, false));

        /* Fade out over the last fifth of the climb rather than clipping at
           the header edge. */
        const room = Math.max(1, s.h - s.top);
        const k = Math.min(1, (h.y - s.top) / (room * 0.22));
        c.save();
        c.translate(h.x, h.y);
        c.rotate(h.rot + Math.sin(h.phase) * 0.12);
        c.globalAlpha = h.op * k;
        c.fillStyle = `hsl(${h.hue} 78% 66%)`;
        heart(c, h.sc);
        c.restore();
      }
      c.globalAlpha = 1;
    },
  };
}

/* ---------- St Patrick's: tumbling shamrocks ---------- */

function shamrocks(): Effect {
  interface S {
    x: number;
    y: number;
    vy: number;
    r: number;
    rot: number;
    spin: number;
    phase: number;
    sway: number;
    lucky: boolean;
    tone: number;
  }
  const xs: S[] = [];
  let seeded = false;

  const make = (s: Stage, anywhere: boolean): S => ({
    x: rnd(0, s.w),
    y: anywhere ? rnd(s.top, s.h) : s.top - 24,
    vy: rnd(34, 78),
    r: rnd(5, 12),
    rot: rnd(0, TAU),
    spin: rnd(-2, 2),
    phase: rnd(0, TAU),
    sway: rnd(14, 38),
    /* One in twelve, so spotting one is worth something. */
    lucky: Math.random() < 0.08,
    tone: rnd(96, 140),
  });

  return {
    tick(c, s) {
      const want = s.calm ? 22 : 55;
      while (xs.length < want) xs.push(make(s, !seeded));
      seeded = true;

      for (const l of xs) {
        l.phase += s.dt * 1.3;
        l.rot += l.spin * s.dt;
        l.y += l.vy * s.dt * (s.calm ? 0.6 : 1);
        l.x += Math.sin(l.phase) * l.sway * s.dt;
        if (l.y - l.r > s.h) Object.assign(l, make(s, false));

        c.save();
        c.translate(l.x, l.y);
        c.rotate(l.rot);
        /* Squash on the tumble axis: a flat cut-out that only rotates in the
           plane looks like a sticker. */
        c.scale(1, 0.55 + Math.abs(Math.cos(l.phase * 0.8)) * 0.45);
        const lit = l.lucky ? 62 : 40;
        c.fillStyle = `hsl(${l.tone} 55% ${lit}%)`;
        c.strokeStyle = `hsl(${l.tone} 55% ${lit - 12}%)`;
        c.globalAlpha = 0.9;
        shamrock(c, l.r, l.lucky);
        c.restore();
      }
      c.globalAlpha = 1;
    },
  };
}

/* ---------- Halloween: bats over low fog ---------- */

function spooky(): Effect {
  interface Bat {
    x: number;
    y: number;
    vx: number;
    amp: number;
    phase: number;
    sc: number;
    flap: number;
    rate: number;
  }
  interface Fog {
    x: number;
    y: number;
    r: number;
    vx: number;
    op: number;
  }
  const bats: Bat[] = [];
  const fog: Fog[] = [];
  let seeded = false;
  /* The first fill scatters bats across the page; every one after it comes in
     off an edge, so switching the season on does not look like a bat factory
     on the left margin. */
  let scatter = true;

  const makeBat = (s: Stage, anywhere: boolean): Bat => {
    const dir = Math.random() < 0.5 ? 1 : -1;
    const sc = rnd(0.5, 1.5);
    return {
      x: anywhere ? rnd(0, s.w) : dir > 0 ? -40 : s.w + 40,
      y: rnd(s.top + 30, s.top + (s.h - s.top) * 0.7),
      vx: dir * rnd(45, 130) * sc,
      amp: rnd(14, 52),
      phase: rnd(0, TAU),
      sc,
      flap: rnd(0, TAU),
      rate: rnd(7, 12),
    };
  };

  return {
    tick(c, s) {
      if (!seeded) {
        seeded = true;
        for (let i = 0; i < 7; i++) fog.push({ x: rnd(0, s.w), y: 0, r: 0, vx: 0, op: 0 });
        for (const f of fog)
          Object.assign(f, {
            x: rnd(-100, s.w + 100),
            y: s.h - rnd(-30, 90),
            r: rnd(120, 300),
            vx: rnd(-16, 16),
            op: rnd(0.05, 0.13),
          });
      }

      /* Fog first: the bats fly over it. */
      for (const f of fog) {
        f.x += f.vx * s.dt;
        if (f.x - f.r > s.w + 120) f.x = -f.r - 120;
        if (f.x + f.r < -120) f.x = s.w + f.r + 120;
        glow(c, f.x, f.y, f.r, "rgba(150,110,200,1)", f.op);
      }

      const want = s.calm ? 4 : 10;
      while (bats.length < want) bats.push(makeBat(s, scatter));
      scatter = false;

      c.fillStyle = "#120a1c";
      for (const b of bats) {
        b.phase += s.dt * 1.5;
        b.flap += s.dt * b.rate * (s.calm ? 0.6 : 1);
        b.x += b.vx * s.dt * (s.calm ? 0.6 : 1);
        const y = b.y + Math.sin(b.phase) * b.amp;
        if (b.x < -60 || b.x > s.w + 60) Object.assign(b, makeBat(s, false));

        c.save();
        c.translate(b.x, y);
        /* Mirrored rather than rotated: a bat flying left is the same bat. */
        if (b.vx < 0) c.scale(-1, 1);
        bat(c, b.sc, Math.sin(b.flap));
        c.restore();
      }

      /* Two eyes blinking in the dark, once in a while. */
      const blink = Math.sin(s.t / 2600);
      if (blink > 0.985 && !s.calm) {
        const ex = s.w * 0.5 + Math.sin(s.t / 9000) * s.w * 0.3;
        const ey = s.h * 0.72;
        c.fillStyle = "#c8ff5a";
        c.globalAlpha = (blink - 0.985) / 0.015;
        c.beginPath();
        c.ellipse(ex - 9, ey, 4, 2.4, 0, 0, TAU);
        c.ellipse(ex + 9, ey, 4, 2.4, 0, 0, TAU);
        c.fill();
        c.globalAlpha = 1;
      }
    },
  };
}

/* ---------- Autumn: leaves on a crosswind ---------- */

function leaves(): Effect {
  interface L {
    x: number;
    y: number;
    vy: number;
    r: number;
    rot: number;
    spin: number;
    phase: number;
    sway: number;
    hue: number;
    lit: number;
  }
  const ls: L[] = [];
  let seeded = false;

  const make = (s: Stage, anywhere: boolean): L => ({
    x: rnd(-30, s.w + 30),
    y: anywhere ? rnd(s.top, s.h) : s.top - 20,
    vy: rnd(26, 62),
    r: rnd(6, 14),
    rot: rnd(0, TAU),
    spin: rnd(-1.8, 1.8),
    phase: rnd(0, TAU),
    sway: rnd(20, 55),
    hue: pick([12, 22, 30, 38, 46, 4]),
    lit: rnd(34, 52),
  });

  return {
    tick(c, s) {
      const want = s.calm ? 24 : 58;
      while (ls.length < want) ls.push(make(s, !seeded));
      seeded = true;

      /* Gusts arrive and pass, so the field drifts sideways in waves. */
      const wind = Math.sin(s.t / 3800) * 40 + Math.sin(s.t / 1100) * 12;

      for (const l of ls) {
        l.phase += s.dt * 1.6;
        l.rot += l.spin * s.dt;
        l.y += l.vy * s.dt * (s.calm ? 0.6 : 1);
        l.x += (Math.sin(l.phase) * l.sway + wind) * s.dt;
        if (l.y - l.r > s.h || l.x < -60 || l.x > s.w + 60) Object.assign(l, make(s, false));

        c.save();
        c.translate(l.x, l.y);
        c.rotate(l.rot);
        c.scale(0.4 + Math.abs(Math.cos(l.phase * 0.7)) * 0.6, 1);
        c.fillStyle = `hsl(${l.hue} 72% ${l.lit}%)`;
        c.globalAlpha = 0.92;
        leaf(c, l.r, `hsl(${l.hue} 60% ${l.lit - 18}%)`);
        c.restore();
      }
      c.globalAlpha = 1;
    },
  };
}

const EFFECTS: Record<SeasonKey, () => Effect> = {
  fireworks,
  lunar,
  hearts,
  shamrock: shamrocks,
  spooky,
  leaves,
  snow,
};

/* ================================================================ runtime === */

let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let raf = 0;
let current: Effect | null = null;
let calm = false;
let last = 0;
let began = 0;
let W = 0;
let H = 0;
let TOP = 0;

function measure() {
  if (!canvas || !ctx) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  W = canvas.clientWidth;
  H = canvas.clientHeight;
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  /* Read once here rather than per frame: the header is a fixed height, and a
     getBoundingClientRect inside the rAF loop forces a layout every frame. */
  TOP = document.querySelector<HTMLElement>(".site-header")?.offsetHeight ?? 0;
}

function onVisibility() {
  if (document.hidden) {
    cancelAnimationFrame(raf);
    raf = 0;
  } else if (current && !raf) {
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }
}

function mount() {
  if (canvas) return;
  canvas = document.createElement("canvas");
  canvas.className = "seasonal-fx";
  /* Decorative and unreadable: keep it out of the accessibility tree, and out
     of the way of every click on the page underneath. */
  canvas.setAttribute("aria-hidden", "true");
  Object.assign(canvas.style, {
    position: "fixed",
    inset: "0",
    /* Both, explicitly. A <canvas> is a replaced element, so `width: auto`
       resolves to its intrinsic 300x150 and `inset: 0` cannot stretch it —
       the effect ends up in a small box in the top-left corner. */
    width: "100%",
    height: "100%",
    pointerEvents: "none",
    /* Under the header (z 50) so nothing drifts across the nav, under the
       search and easter-egg overlays, over everything else. */
    zIndex: "45",
  } satisfies Partial<CSSStyleDeclaration>);
  document.body.appendChild(canvas);
  /* The one rule that cannot be an inline style. Injected here rather than put
     in a stylesheet so the module stays free-standing — see the header. */
  const sheet = document.createElement("style");
  sheet.textContent = "@media print{.seasonal-fx{display:none!important}}";
  document.head.appendChild(sheet);
  ctx = canvas.getContext("2d");
  addEventListener("resize", measure, { passive: true });
  document.addEventListener("visibilitychange", onVisibility);
  measure();
}

function frame(now: number) {
  raf = requestAnimationFrame(frame);
  if (!ctx || !current) return;

  const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
  last = now;

  if (current.fade) {
    /* destination-out erases towards transparent, so trails fade into the page
       instead of leaving a black wash over it. */
    ctx.globalCompositeOperation = "destination-out";
    ctx.fillStyle = `rgba(0,0,0,${current.fade})`;
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = "source-over";
  } else {
    ctx.clearRect(0, 0, W, H);
  }

  ctx.save();
  current.tick(ctx, { w: W, h: H, top: TOP, dt, t: now - began, calm });
  ctx.restore();
  /* An effect that leaves alpha or a composite mode behind would poison the
     next frame's fade, which is a maddening bug to find. Reset unconditionally. */
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
}

function stop() {
  cancelAnimationFrame(raf);
  raf = 0;
  current = null;
  if (ctx) ctx.clearRect(0, 0, W, H);
  if (canvas) canvas.style.display = "none";
}

/**
 * Start a season, or `null` to stop. Unknown keys stop too — persisted state
 * outlives the list, and a season that was renamed should leave a clean page
 * rather than throw on a page load months later.
 */
export function setSeason(key: SeasonKey | string | null | undefined) {
  const make = key ? EFFECTS[key as SeasonKey] : undefined;
  if (!make) {
    stop();
    return;
  }
  mount();
  if (!canvas || !ctx) return;
  canvas.style.display = "";
  calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
  measure();
  ctx.clearRect(0, 0, W, H);
  current = make();
  began = last = performance.now();
  if (!raf) raf = requestAnimationFrame(frame);
}
