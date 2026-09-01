/* Reusable HTML-fragment builders shared by several pages.
 *
 * These run at build time only: Astro calls them while pre-rendering, so their
 * output is baked into the static HTML and none of this ships to the browser.
 * Ported from the v1.95 POC with hash routes rewritten to real paths.
 */
/* eslint-disable */
// @ts-nocheck
import { IC, XIC, LYR, DEV, RIC, CNVIC } from "../data/icons";
import {
  BAND_FIGURES,
  BAND_FIELD,
  BAND_SM_SCALE,
  BAND_SWING,
  BAND_SWEEP,
} from "../data/cta-sky";
import { HERO_STARS, HERO_FIGURES, HERO_POLE, heroProject } from "../data/hero-sky";
import { RS_CAP } from "../data/taxonomy";
import { MEDIA_IMG } from "../data/media";
import { NAV } from "../data/nav";
import { PRICING, ESSENTIALS, PRO, ELEMENT, usd } from "../data/pricing";
import type { Money, TierPricing } from "../data/pricing";

/** One placeholder section descriptor. */
export const ph = (lbl: string, h: string, d: string, link?: string) => ({ t: "ph", lbl, h, d, link });

/** The breadcrumb separator. An element rather than a " / " text node, because
 *  the gap either side of it is margin on .crumb-sep — see styles/global.css.
 *  Every trail on the site is built from this, hand-written ones included. */
export const CSEP = `<span class="crumb-sep">/</span>`;

/** Breadcrumb trail: Home / <owning nav menu> / <page title>. */
export function crumbs(path, title) {
  const top = NAV.find((m) => m.items.some(([p]) => p === path));
  return `<div class="crumb"><a href="/">Home</a>${top ? CSEP + top.label : ""}${CSEP}${title}</div>`;
}

/**
 * Real constellations behind the closing band — catalogue positions, and
 * joining lines for the one figure that carries them (see BandFigure.ln).
 * Each figure is one absolutely-positioned group placed in percent, with its
 * stars offset inside it in pixels, so the band's 5:1 aspect cannot stretch a
 * shape out of recognition. The group carries the parallax class, which keeps
 * the figure rigid while it drifts. See data/cta-sky.ts for provenance.
 */
/* Magnitude is a log scale and runs backwards: brighter is a lower number, so
   the brightest stars carry the figure's shape. Its own function because
   bandPolaris() needs the size too — the star is positioned by its top-left
   corner, and the rotation axis and the click target both want its centre. */
const bandStarPx = (m: number) => Math.max(1.7, Math.min(4, 4.3 - m * 0.56));

function bandFigures() {
  return BAND_FIGURES.map((f) => {
    const dots = f.s
      .map(([dx, dy, m]) => {
        const px = bandStarPx(m).toFixed(1);
        const dur = (2.4 + ((Math.abs(dx) * 7) % 46) / 10).toFixed(2);
        const delay = ((Math.abs(dy) % 61) / 10).toFixed(2);
        return `<span class="star cb" style="left:${dx}px;top:${dy}px;width:${px}px;height:${px}px;--tw:${dur}s;animation-delay:${delay}s"></span>`;
      })
      .join("");
    /* The joining lines, traced outward from Polaris — the same behaviour the
       hero's star map has on main, and built the same way constStars() builds
       it: one speed for every edge, breadth-first distance along the figure
       deciding when each edge starts, so the shape grows away from the pole star
       instead of arriving in file order. Each edge then holds a beat and fades.
       Nothing repeats.

       Drawn in the SAME pixel space as the dots, because both are children of a
       zero-size .cstgrp whose origin is the figure's centre — so one SVG offset
       to the figure's own bounding box, with a viewBox equal to that box, needs
       no second coordinate system to reason about.

       Centres, not corners: a star's dx/dy place its top-LEFT, so half a
       diameter is added to each end of every line. Skipping that pulls each line
       up and left, which at a 1.7px star is the difference between a line that
       lands on the dot and one that clips it.

       Emitted BEFORE the dots so the stars paint over the ends of their own
       lines rather than under them. */
    const lines = (() => {
      if (!f.ln?.length) return "";
      const SPEED = 90;   /* px per second, one rate for every edge */
      const HOLD = 0.35;  /* beat between an edge finishing and starting to fade */
      const FADE = 2.4;   /* seconds to fade out, then gone */
      const centre = (i: number): [number, number] => {
        const [dx, dy, m] = f.s[i];
        const r = bandStarPx(m) / 2;
        return [dx + r, dy + r];
      };
      const cs = f.s.map((_, i) => centre(i));
      const len = (a: number, b: number) => Math.hypot(cs[a][0] - cs[b][0], cs[a][1] - cs[b][1]);

      /* Breadth-first from index 0. The data puts Polaris there and bandPolaris()
         confirms it independently by magnitude, so "outward from Polaris" needs
         no name lookup — but it does need index 0 to stay Polaris, which the
         comment on the star list says. */
      const adj = new Map<number, number[]>();
      for (const [a, b] of f.ln) {
        if (!adj.has(a)) adj.set(a, []);
        if (!adj.has(b)) adj.set(b, []);
        adj.get(a)!.push(b);
        adj.get(b)!.push(a);
      }
      const dfr = new Map<number, number>([[0, 0]]);
      const q: number[] = [0];
      while (q.length) {
        const cur = q.shift()!;
        for (const nb of adj.get(cur) ?? []) {
          const cand = dfr.get(cur)! + len(cur, nb);
          if (!dfr.has(nb) || cand < dfr.get(nb)! - 1e-6) {
            dfr.set(nb, cand);
            if (!q.includes(nb)) q.push(nb);
          }
        }
      }

      const xs = cs.map((c) => c[0]);
      const ys = cs.map((c) => c[1]);
      const PAD = 4;
      const x0 = Math.min(...xs) - PAD;
      const y0 = Math.min(...ys) - PAD;
      const w = Math.max(...xs) - Math.min(...xs) + PAD * 2;
      const h = Math.max(...ys) - Math.min(...ys) + PAD * 2;

      const segs = f.ln
        .map(([a, b]) => {
          /* Draw from whichever end the trace reaches first, so a branch grows
             away from its junction rather than back toward it. */
          const aFirst = (dfr.get(a) ?? Infinity) <= (dfr.get(b) ?? Infinity);
          const [x1, y1] = aFirst ? cs[a] : cs[b];
          const [x2, y2] = aFirst ? cs[b] : cs[a];
          const L = len(a, b);
          const delay = Math.min(dfr.get(a) ?? 0, dfr.get(b) ?? 0) / SPEED;
          const dur = L / SPEED;
          return `<line class="cbl" x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"`
            + ` style="stroke-dasharray:${L.toFixed(1)};stroke-dashoffset:${L.toFixed(1)}`
            + `;animation-duration:${dur.toFixed(3)}s,${FADE}s`
            + `;animation-delay:${delay.toFixed(3)}s,${(delay + dur + HOLD).toFixed(3)}s"/>`;
        })
        .join("");
      return `<svg class="cbln" viewBox="${x0.toFixed(1)} ${y0.toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)}"`
        + ` style="left:${x0.toFixed(1)}px;top:${y0.toFixed(1)}px;width:${w.toFixed(1)}px;height:${h.toFixed(1)}px">`
        + `${segs}</svg>`;
    })();
    /* Both placements are written as custom properties and the stylesheet picks
       one at 640px. The phone values used to BE the stylesheet — three
       [data-fig] overrides with !important, because the desktop left/top are
       inline and an inline value beats a rule. They are data now, for the reason
       BandFigure.sm gives: Polaris is derived from UMi's placement, and the
       derivation cannot see a media query. */
    return `<span class="cstgrp d${f.d}" data-fig="${f.k}"`
      + ` style="--fx:${f.at[0]}%;--fy:${f.at[1]}%;--fx-sm:${f.sm[0]}%;--fy-sm:${f.sm[1]}%`
      + `;--sm-scale:${BAND_SM_SCALE}">`
      + `${lines}${dots}</span>`;
  }).join("");
}

/** A signed pixel term for a calc() expression: `+ 20px`, `- 48px`. */
const calcPx = (v: number) => (v < 0 ? `- ${Math.abs(v)}px` : `+ ${v}px`);

/**
 * Where Polaris is in the band, at both breakpoints — derived from the Ursa
 * Minor figure rather than typed again, because two things have to agree with it
 * exactly and would drift if they were numbers of their own: the sky turns about
 * this point, and the easter-egg click target sits on it.
 *
 * The star itself is an ordinary member of the UMi group and is drawn by
 * bandFigures() like any other. It does not need pinning: a point on the axis of
 * a rotation does not move. That is the whole reason the axis is put here rather
 * than at the middle of the band — Polaris is the one star on this site that must
 * hold still, and the sky wheeling about the pole star is what it does anyway.
 */
function bandPolaris() {
  const umi = BAND_FIGURES.find((f) => f.k === "UMi");
  if (!umi) throw new Error("cta-sky: the band's Polaris comes from the UMi figure, and UMi is gone.");
  /* Found by brightness rather than by name, since the data carries magnitudes
     and not designations. Polaris is 1.97 and the next brightest in the figure
     is Kochab at 2.07, so there is no ambiguity to resolve. */
  const pol = umi.s.reduce((a, b) => (b[2] < a[2] ? b : a));
  /* Half a diameter, because the offsets in the data place a star's top-left
     corner and what wants aligning here is its middle. Two tenths of a pixel of
     wobble if this is skipped, so it is precision for its own sake — but the
     alternative is a number that looks correct and quietly is not. */
  const c = bandStarPx(pol[2]) / 2;
  const s = BAND_SM_SCALE;   /* the phone scale shrinks the offset with the figure */
  const r = (v: number) => Math.round(v * s * 10) / 10;
  return {
    x: `calc(${umi.at[0]}% ${calcPx(+(pol[0] + c).toFixed(1))})`,
    y: `calc(${umi.at[1]}% ${calcPx(+(pol[1] + c).toFixed(1))})`,
    xSm: `calc(${umi.sm[0]}% ${calcPx(r(pol[0] + c))})`,
    ySm: `calc(${umi.sm[1]}% ${calcPx(r(pol[1] + c))})`,
    /* Which scroll-parallax layer UMi rides, so the click target can ride the
       same one. Get this wrong and the target slides off the star as you scroll. */
    sy: umi.d,
  };
}

/**
 * The sky behind the closing CTA band — the field, the three figures and the
 * Milky Way strip, in that paint order.
 *
 * The band now carries the home page's sky rather than a glass panel, so the
 * field is no longer the twelve stars scarcity demanded on a light surface: on
 * an opaque hero gradient it can run at the hero's own density without reading
 * as speckle. See .ctaband in styles/global.css for the animation, which is
 * entirely CSS — nothing here ships to the browser.
 *
 * Consumed by components/CtaBand.astro, which is the only thing that renders a
 * band. Do not inline a second copy of this markup into a page.
 */
export function bandSky() {
  const p = bandPolaris();
  /* One set of properties on both layers: the sky reads them to place its axis,
     the hit layer reads them to place the target. Written inline because they
     come from data; switched between breakpoints in the stylesheet, which is why
     the phone pair is carried alongside rather than overriding the first. */
  const vars = `--pol-x:${p.x};--pol-y:${p.y};--pol-x-sm:${p.xSm};--pol-y-sm:${p.ySm}`
    + `;--pol-sy:var(--sy${p.sy}, 0px)`;

  return `<div class="ctasky" aria-hidden="true" style="${vars};--swing:${BAND_SWING}deg;--sweep:${BAND_SWEEP}s">`
    + `<div class="ctaspin">`
    + `<div class="ctaway"></div>`
    + stars(72, BAND_FIELD)
    + bandFigures()
    + `</div>`
    + `</div>`
    /* The target is a layer of its own, above the copy, for exactly the reason
       the hero's is — see constStars(), "the fix for the dead click". The sky is
       at z-0 and the band's copy at z-1, and an <h2> or a <p> spans the full
       width of the band and takes every click over its box, transparent or not.
       This layer passes pointer events straight through; only the star accepts
       them, so nothing below it loses a click.
       Outside .ctasky rather than inside it for a second reason: that element is
       aria-hidden, and an interactive control inside an aria-hidden subtree is
       unreachable to a screen reader while still being in the tab order. */
    + `<div class="ctapolhit" style="${vars}">`
    + `<span class="ctapol" role="button" tabindex="0" aria-label="Polaris"`
    + ` onclick="eggMenu()"`
    + ` onkeydown="if(event.key===&quot;Enter&quot;||event.key===&quot; &quot;){event.preventDefault();eggMenu()}"`
    + `></span>`
    + `</div>`;
}

/**
 * Corporate/education × 3yr/5yr/perpetual price switch. The buttons carry
 * data-i / data-t; the site script swaps every [data-p-*] value in place.
 */
export function prToggle() {
  return `<div class="prmode"><span class="prlbl">Industry</span><button data-i="corp" class="on">Corporate</button><button data-i="edu">Education</button><span class="prlbl" style="margin-left:16px">Term</span><button data-t="3" class="on">3-year</button><button data-t="5">5-year</button><button data-t="p">Perpetual</button></div>`;
}

/**
 * n randomly scattered twinkling stars for the hero backdrop.
 *
 * `box` spreads them over something other than the element: percentages outside
 * 0-100 are legal on an absolutely-positioned child, so the closing band passes
 * BAND_FIELD to generate a field larger than the band it is clipped by. Without
 * it the default is the hero's, which stops at 85% of the height because the
 * hero's lower fifth is the display and the fade.
 */
export function stars(n, box?){
  const x0=box?.x0??0, xw=(box?.x1??100)-x0;
  const y0=box?.y0??0, yw=(box?.y1??85)-y0;
  /* Real stars scintillate: each one on its own short, irregular period, the
     brighter ones steadier than the faint ones, a minority running cool. A
     uniform sine across the whole field is what reads as decoration. */
  let h="";
  for(let i=0;i<n;i++){
    const s=Math.random()*2+1;
    const px=s.toFixed(1);
    const dur=(1.6+Math.random()*5.4).toFixed(2);          /* 1.6s - 7s */
    const lo=(0.06+(s-1)*0.09).toFixed(2);                 /* big stars dip less */
    const hi=(0.34+(s-1)*0.26).toFixed(2);
    const cool=Math.random()<0.18?" cool":"";
    const depth=s>2.4?" d3":s>1.7?" d2":" d1";   /* bigger reads as nearer, so it drifts more */
    h+=`<span class="star${cool}${depth}" style="width:${px}px;height:${px}px;left:${(x0+Math.random()*xw).toFixed(1)}%;top:${(y0+Math.random()*yw).toFixed(1)}%;--tw:${dur}s;--lo:${lo};--hi:${hi};animation-delay:${(Math.random()*7).toFixed(2)}s"></span>`;
  }
  return h;
}

/**
 * The real constellations in the hero sky, plus the Polaris trigger.
 *
 * Everything is inside one SVG with preserveAspectRatio="xMidYMid slice". The
 * previous version placed each star as a CSS percentage and drew the links in an
 * SVG set to preserveAspectRatio="none": the coordinates were catalogue-correct,
 * but percentages scale the two axes independently, so every figure stretched
 * with the window. The Northern Cross rendered as an X with a star in the
 * middle, which is what prompted this rewrite. Slice crops instead of
 * stretching, so the shapes are true at every viewport.
 *
 * Positions come from data/hero-sky.ts, generated from the HYG catalogue by
 * scripts/skymap-gen/gen_hero.py. Polaris is the projection centre, so the
 * easter-egg trigger sits on the real pole star rather than near it.
 */
export function constStars(){
  const P = (ra, dec) => heroProject(ra, dec);
  const pole = P(HERO_POLE.ra, HERO_POLE.dec);

  /* The trace radiates out from Polaris, the same graph traversal the 404 chart
     uses. Whole polylines animated on a stagger looked like a slideshow: every
     line drew at a different speed because they are different lengths, and they
     arrived in file order rather than in any order the eye could read. Here the
     figures are decomposed into edges over shared vertices, each connected piece
     is rooted at its vertex nearest the pole star, and breadth-first distance
     along the figure sets when each edge starts. One speed everywhere, branches
     growing away from a junction together, and the whole sky lighting outward
     from the star the product is named after. */
  const SPEED = 40;   /* viewBox units per second, one rate for every edge */
  const RADIAL = 0.5; /* how much a figure's distance from Polaris delays it */
  const HOLD = 0.25;  /* beat between a figure finishing and starting to fade */
  const FADE = 2;     /* seconds to fade out, then gone: no repeat */

  const vkey = (p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`;
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const verts = new Map(); const adj = new Map(); const seen = new Set();
  for (const seg of HERO_FIGURES) {
    const pts = seg.map(([ra, dec]) => P(ra, dec));
    for (const p of pts) if (!verts.has(vkey(p))) verts.set(vkey(p), p);
    for (let i = 0; i < pts.length - 1; i++) {
      const a = vkey(pts[i]), b = vkey(pts[i + 1]);
      if (a === b) continue;
      const e = a < b ? `${a}|${b}` : `${b}|${a}`;
      if (seen.has(e)) continue;      /* figures share segments; draw each once */
      seen.add(e);
      if (!adj.has(a)) adj.set(a, []);
      if (!adj.has(b)) adj.set(b, []);
      adj.get(a).push(b); adj.get(b).push(a);
    }
  }
  const comp = new Map(); const groups = [];
  for (const k of verts.keys()) {
    if (comp.has(k)) continue;
    const bag = []; const stack = [k]; comp.set(k, groups.length);
    while (stack.length) {
      const cur = stack.pop(); bag.push(cur);
      for (const nb of adj.get(cur) ?? []) if (!comp.has(nb)) { comp.set(nb, groups.length); stack.push(nb) }
    }
    groups.push(bag);
  }
  const segs = [];
  for (const bag of groups) {
    let root = bag[0], best = Infinity;
    for (const k of bag) { const d = dist(verts.get(k), pole); if (d < best) { best = d; root = k } }
    const start = (RADIAL * best) / SPEED;
    const dfr = new Map([[root, 0]]); const q = [root];
    while (q.length) {
      const cur = q.shift(); const dc = dfr.get(cur);
      for (const nb of adj.get(cur) ?? []) {
        const cand = dc + dist(verts.get(cur), verts.get(nb));
        if (!dfr.has(nb) || cand < dfr.get(nb) - 1e-6) { dfr.set(nb, cand); if (!q.includes(nb)) q.push(nb) }
      }
    }
    for (const k of bag) for (const nb of adj.get(k) ?? []) {
      if (k >= nb) continue;                         /* each undirected edge once */
      const a = verts.get(k), b = verts.get(nb);
      const kFirst = (dfr.get(k) ?? Infinity) <= (dfr.get(nb) ?? Infinity);
      const from = kFirst ? a : b, to = kFirst ? b : a;
      const L = dist(a, b);
      const delay = start + Math.min(dfr.get(k) ?? 0, dfr.get(nb) ?? 0) / SPEED;
      const dur = L / SPEED;
      segs.push(
        `<line class="cstl" x1="${from.x.toFixed(2)}" y1="${from.y.toFixed(2)}" x2="${to.x.toFixed(2)}" y2="${to.y.toFixed(2)}"`
        + ` style="stroke-dasharray:${L.toFixed(2)};stroke-dashoffset:${L.toFixed(2)}`
        + `;animation-duration:${dur.toFixed(3)}s,${FADE}s`
        + `;animation-delay:${delay.toFixed(3)}s,${(delay + dur + HOLD).toFixed(3)}s"/>`
      );
    }
  }
  const figs = segs.join("");

  /* Constellation members sit a touch brighter than the field, the same
     hierarchy the 404 chart uses. Radii are viewBox units, and magnitude is a
     log scale, so size follows it non-linearly. */
  const dots = HERO_STARS.map((s, i) => {
    if (s.n === "Polaris") return "";
    const p = P(s.ra, s.dec);
    const r = Math.max(0.13, 0.105 * Math.pow(2.512, (3.4 - s.m) / 2.7)).toFixed(3);
    const dur = (2.6 + ((i * 41) % 46) / 10).toFixed(2);
    const del = (((i * 29) % 63) / 10).toFixed(2);
    /* Depth. A star a constellation line runs through rides the same slow layer
       as the figures - split them and the shapes shear apart as you scroll,
       which is the bug the 404 chart had. Only the anonymous field is free to
       spread across three faster layers. */
    const d = s.f ? "df" : `d${(i % 3) + 1}`;
    return `<circle class="hs${s.f ? " hf" : ""} ${d}" cx="${p.x.toFixed(2)}" cy="${p.y.toFixed(2)}" r="${r}" style="--tw:${dur}s;--td:${del}s"/>`;
  }).join("");

  /* Sized by its own magnitude, exactly like every other star. Polaris is
     visual magnitude 1.97, so it comes out the size of Kochab beside it in the
     same figure - no larger, no brighter, findable only if you know where the
     pole star is. */
  const polM = HERO_STARS.find((s) => s.n === "Polaris")?.m ?? 1.97;
  const polR = Math.max(0.16, 0.13 * Math.pow(2.512, (3.4 - polM) / 2.7)).toFixed(3);

  /* Two SVGs, and the second one is the fix for the dead click.
     The sky sits at z-2, behind the hero copy - it has to, or faint lines and
     stars would paint over the headline. But `.xwrap` is also z-2 and comes
     later in the DOM, so it was covering Polaris and swallowing every click on
     it. The trigger therefore lives in its own otherwise-empty SVG stacked above
     the copy, with an identical viewBox and preserveAspectRatio so it lands
     exactly on the star whatever the window crops away. That layer is
     pointer-events:none and only the circle itself takes events, so it steals
     nothing from the buttons underneath.
     The circle is the same radius as the star, so the whole white dot is live
     and nothing beyond it is. */
  /* The 1.5 is a vertical composition offset, not a coordinate fix: the window
     onto the generated sky starts 1.5 units lower, which lifts the whole figure
     set by the same amount. The crop is centred, so the taller the hero the more
     of the sky it shows and the further down the middle of the composition
     lands — which is where the Little Dipper's bowl sits. 1.5 units keeps the
     bowl above the top edge of the room display on a 1366-wide laptop, where the
     sky is scaled to the hero's height, while still leaving Polaris inside the
     crop on a 3440-wide monitor, where it is scaled to the width. That window is
     narrow: much more and Polaris goes off the top of an ultrawide, much less and
     the bowl goes back behind the screen. */
  const box = 'viewBox="0 1.5 100 50" preserveAspectRatio="xMidYMid slice"';
  return `<svg class="cstlines" ${box}>`
    + `<g class="hfig df">${figs}</g><g class="hstars">${dots}</g>`
    + `<circle class="hpol df" cx="${pole.x.toFixed(2)}" cy="${pole.y.toFixed(2)}" r="${polR}"/>`
    + `</svg>`
    + `<svg class="cstlines cstlhit" ${box}>`
    + `<circle class="hpolhit df" cx="${pole.x.toFixed(2)}" cy="${pole.y.toFixed(2)}" r="${polR}"`
    + ` role="button" tabindex="0" aria-label="Polaris" onclick="eggMenu()"`
    + ` onkeydown="if(event.key===&quot;Enter&quot;||event.key===&quot; &quot;){event.preventDefault();eggMenu()}"><title>✦</title></circle>`
    + `</svg>`;
}


/** Devices → workspace on the display → cloud (home + how-it-works). */
export function collabScene(){
  return `<div class="clbwrap reveal"><svg viewBox="0 0 780 478" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="clbT clbD">
  <title id="clbT">How a Polaris session connects: signalling through the cloud, then a direct WebRTC mesh</title>
  <desc id="clbD">Two-step animation. Step one: a glowing signal pings from the laptop, the phone, the pod, and a remote browser participant up to Polaris Cloud and returns - authenticate, resolve the key, exchange SDP and ICE. Step two: the endpoints form a persistent direct WebRTC mesh - in-room media flows to the pod on the LAN, the remote participant on dual monitors shares from the browser on one screen and mirrors the full workspace on the other, over a direct connection, and the cloud stays out of the media path.</desc>
  <defs>
    <linearGradient id="clbt1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4a3585"/><stop offset="1" stop-color="#6d5bb8"/></linearGradient>
    <filter id="clbglow" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="4"/></filter>
  </defs>

  <!-- Polaris Cloud, above the room -->
  <path d="M352 84a26 26 0 0 1 3-51 34 34 0 0 1 64-8 27 27 0 0 1 3 59z" fill="rgba(143,122,224,.10)" stroke="#a58cff" stroke-width="2.2"/>
  <text x="388" y="52" text-anchor="middle" font-size="10.5" font-weight="800" letter-spacing="1" fill="#cfc2ff">POLARIS CLOUD</text>
  <text x="388" y="97" text-anchor="middle" font-size="8.5" fill="#9d92c8">broker &amp; directory &middot; not a data path</text>
  <circle class="clb-orb" cx="388" cy="18" r="3" fill="#7ce3a8" filter="url(#clbglow)"/>
  <text class="cbb" x="388" y="111" text-anchor="middle" font-size="9.5" fill="#7ce3a8">out of the media path</text>
  <text class="cba" x="512" y="40" text-anchor="start" font-size="9.5" fill="#a58cff">sync: key &middot; SDP &middot; ICE</text>

  <!-- the room -->
  <rect x="36" y="118" width="540" height="292" rx="14" fill="none" stroke="rgba(165,140,255,.22)" stroke-width="1.4" stroke-dasharray="7 7"/>
  <text x="52" y="138" font-size="9.5" letter-spacing="1.4" fill="#8a7fb8">THE ROOM</text>

  <!-- phase 2: persistent direct mesh, manhattan-routed with rounded corners -->
  <g class="cbb">
    <path class="clb-flow" d="M140 244 V282 Q140 290 148 290 H361" fill="none" stroke="#8f7ae0" stroke-width="2.4" stroke-dasharray="4 6"/>
    <path class="clb-flow" d="M130 331 H336 Q344 331 344 323 V304 Q344 296 352 296 H361" fill="none" stroke="#7ce3a8" stroke-width="2.4" stroke-dasharray="4 6"/>
    <path class="clb-flow" d="M622 296 H419" fill="none" stroke="#7fc6dd" stroke-width="2.4" stroke-dasharray="4 6"/>
    <!-- faint full-mesh threads, orthogonal, routed low -->
    <path class="fig-deco" d="M100 244 V300" fill="none" stroke="#8f85b8" stroke-width="1" opacity=".3" stroke-dasharray="2 5"/>
    <path class="fig-deco" d="M70 244 V392 Q70 400 78 400 H675 Q683 400 683 392 V332" fill="none" stroke="#8f85b8" stroke-width="1" opacity=".28" stroke-dasharray="2 5"/>
    <path class="fig-deco" d="M112 366 V376 Q112 384 120 384 H652 Q660 384 660 376 V332" fill="none" stroke="#8f85b8" stroke-width="1" opacity=".28" stroke-dasharray="2 5"/>
  </g>

  <!-- phase 1: faint guides + comet pings (out to the cloud and back) -->
  <g class="cba">
    <path class="fig-deco" d="M108 178 C150 120 260 86 352 66" fill="none" stroke="#a58cff" stroke-width="1" opacity=".15" stroke-dasharray="2 6"/>
    <path class="fig-deco" d="M112 298 C130 200 240 110 356 74" fill="none" stroke="#a58cff" stroke-width="1" opacity=".15" stroke-dasharray="2 6"/>
    <path class="fig-deco" d="M390 280 C390 210 388 140 388 92" fill="none" stroke="#a58cff" stroke-width="1" opacity=".15" stroke-dasharray="2 6"/>
    <path class="fig-deco" d="M636 288 C548 190 498 110 424 76" fill="none" stroke="#a58cff" stroke-width="1" opacity=".15" stroke-dasharray="2 6"/>
    <circle class="cmt" r="4" fill="#e2d9ff" filter="url(#clbglow)" style="offset-path:path('M108 178 C150 120 260 86 352 66')"/><circle class="cmt t1" r="2.4" fill="#a58cff" opacity=".7" style="offset-path:path('M108 178 C150 120 260 86 352 66')"/><circle class="cmt t2" r="1.5" fill="#a58cff" opacity=".45" style="offset-path:path('M108 178 C150 120 260 86 352 66')"/>
    <circle class="cmt" r="4" fill="#e2d9ff" filter="url(#clbglow)" style="offset-path:path('M112 298 C130 200 240 110 356 74')"/><circle class="cmt t1" r="2.4" fill="#a58cff" opacity=".7" style="offset-path:path('M112 298 C130 200 240 110 356 74')"/><circle class="cmt t2" r="1.5" fill="#a58cff" opacity=".45" style="offset-path:path('M112 298 C130 200 240 110 356 74')"/>
    <circle class="cmt" r="4" fill="#e2d9ff" filter="url(#clbglow)" style="offset-path:path('M390 280 C390 210 388 140 388 92')"/><circle class="cmt t1" r="2.4" fill="#a58cff" opacity=".7" style="offset-path:path('M390 280 C390 210 388 140 388 92')"/><circle class="cmt t2" r="1.5" fill="#a58cff" opacity=".45" style="offset-path:path('M390 280 C390 210 388 140 388 92')"/>
    <circle class="cmt" r="4" fill="#e2d9ff" filter="url(#clbglow)" style="offset-path:path('M636 288 C548 190 498 110 424 76')"/><circle class="cmt t1" r="2.4" fill="#a58cff" opacity=".7" style="offset-path:path('M636 288 C548 190 498 110 424 76')"/><circle class="cmt t2" r="1.5" fill="#a58cff" opacity=".45" style="offset-path:path('M636 288 C548 190 498 110 424 76')"/>
  </g>

  <!-- display + workspace (hero, centered over The-workspace card) -->
  <rect x="265" y="128" width="250" height="140" rx="8" fill="#0e0b1e" stroke="#4a3d7d" stroke-width="2.5"/>
  <rect x="274" y="137" width="232" height="122" rx="4" fill="#181330"/>
  <rect x="281" y="144" width="130" height="108" rx="4" fill="url(#clbt1)"/><g fill="#fff"><rect x="299" y="162" width="44" height="8" rx="2" opacity=".5"/><rect x="299" y="184" width="80" height="4.5" rx="2.25" opacity=".28"/><rect x="299" y="196" width="66" height="4.5" rx="2.25" opacity=".28"/><rect x="299" y="208" width="76" height="4.5" rx="2.25" opacity=".28"/></g>
  <rect x="417" y="144" width="82" height="50" rx="4" fill="#1d5c7a"/><g stroke="#fff" opacity=".5" fill="none"><rect x="429" y="152" width="58" height="34" rx="3" stroke-width="1.8"/><path d="M429 161 H487" stroke-width="1.4"/></g><circle cx="434.5" cy="156.5" r="1.4" fill="#fff" opacity=".55"/><circle cx="439.5" cy="156.5" r="1.4" fill="#fff" opacity=".55"/>
  <rect class="clb-pulse" x="417" y="200" width="82" height="52" rx="4" fill="#2e7a4f" stroke="#7ce3a8" stroke-width="1.6"/><path d="M429 240 L445 222 L457 228 L471 212 L484 218" fill="none" stroke="#fff" opacity=".55" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="484" cy="218" r="2" fill="#fff" opacity=".7"/>
  <path d="M390 268 V280" stroke="#4a8fb0" stroke-width="2.4"/>
  <rect x="362" y="280" width="56" height="20" rx="4" fill="#241c45" stroke="#8f7ae0" stroke-width="2"/><circle cx="409" cy="290" r="2.2" fill="#7ce3a8"/>
  <text x="390" y="316" text-anchor="middle" font-size="10" font-weight="700" fill="#8f85b8">Polaris pod</text>
  <text x="390" y="352" text-anchor="middle" font-size="10" font-weight="700" fill="#b8aede">the workspace: every share, side by side</text>

  <!-- laptop: sharing the purple tile -->
  <rect x="64" y="180" width="88" height="56" rx="4" fill="#171231" stroke="#8f7ae0" stroke-width="2"/>
  <rect x="70" y="186" width="76" height="44" rx="2" fill="#181330"/>
  <rect x="74" y="190" width="68" height="36" rx="2" fill="url(#clbt1)"/><g fill="#fff"><rect x="81" y="196" width="20" height="4" rx="1.5" opacity=".5"/><rect x="81" y="206" width="48" height="2.5" rx="1.25" opacity=".28"/><rect x="81" y="212" width="40" height="2.5" rx="1.25" opacity=".28"/></g>
  <rect x="54" y="238" width="108" height="6" rx="3" fill="#35304d"/>
  <text x="108" y="172" text-anchor="middle" font-size="10" fill="#8f85b8">laptop &middot; sharing</text>

  <!-- phone: sharing the green chart -->
  <rect x="94" y="300" width="36" height="62" rx="5" fill="#171231" stroke="#8f7ae0" stroke-width="2"/>
  <rect x="99" y="308" width="26" height="46" rx="2" fill="#2e7a4f" stroke="#7ce3a8" stroke-width="1"/><path d="M103 344 L109 330 L114 336 L121 324" fill="none" stroke="#fff" opacity=".55" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/><circle cx="121" cy="324" r="1.3" fill="#fff" opacity=".7"/>
  <text x="112" y="378" text-anchor="middle" font-size="10" fill="#8f85b8">phone &middot; sharing</text>

  <!-- remote participant: dual monitors — sharing on one, the workspace mirror on the other -->
  <rect x="622" y="262" width="74" height="50" rx="4" fill="#171231" stroke="#7fc6dd" stroke-width="2"/>
  <rect x="627" y="267" width="64" height="40" rx="2" fill="#1d5c7a"/>
  <g stroke="#fff" opacity=".5" fill="none"><rect x="640" y="274" width="38" height="24" rx="3" stroke-width="1.6"/><path d="M640 281 H678" stroke-width="1.2"/></g><circle cx="644.5" cy="277.5" r="1.2" fill="#fff" opacity=".55"/><circle cx="648.5" cy="277.5" r="1.2" fill="#fff" opacity=".55"/>
  <rect x="652" y="312" width="14" height="5" fill="#35304d"/><rect x="645" y="317" width="28" height="3" rx="1.5" fill="#35304d"/>
  <rect x="702" y="262" width="74" height="50" rx="4" fill="#171231" stroke="#7fc6dd" stroke-width="2"/>
  <rect x="707" y="267" width="64" height="40" rx="2" fill="#181330"/>
  <rect x="710" y="270" width="33" height="34" rx="2" fill="url(#clbt1)"/><g fill="#fff"><rect x="714" y="275" width="11" height="3" rx="1.5" opacity=".5"/><rect x="714" y="283" width="24" height="2" rx="1" opacity=".28"/><rect x="714" y="288" width="20" height="2" rx="1" opacity=".28"/><rect x="714" y="293" width="22" height="2" rx="1" opacity=".28"/></g>
  <rect x="746" y="270" width="22" height="15" rx="2" fill="#1d5c7a"/><g stroke="#fff" opacity=".5" fill="none"><rect x="749" y="272.5" width="16" height="10" rx="1.5" stroke-width="1"/><path d="M749 275.5 H765" stroke-width=".8"/></g>
  <rect x="746" y="289" width="22" height="15" rx="2" fill="#2e7a4f" stroke="#7ce3a8" stroke-width="1"/><path d="M749 300.5 L754 295 L758 297 L764 291.5" fill="none" stroke="#fff" opacity=".55" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="764" cy="291.5" r="1" fill="#fff" opacity=".7"/>
  <rect x="732" y="312" width="14" height="5" fill="#35304d"/><rect x="725" y="317" width="28" height="3" rx="1.5" fill="#35304d"/>
  <text x="659" y="330" text-anchor="middle" font-size="8.5" fill="#877cab">sharing</text>
  <text x="739" y="330" text-anchor="middle" font-size="8.5" fill="#877cab">the workspace</text>
  <text x="683" y="220" text-anchor="middle" font-size="10" fill="#8f85b8">remote &middot; app.mersive.com</text>
  <text x="683" y="234" text-anchor="middle" font-size="9" fill="#877cab">same workspace, live</text>
  <text x="683" y="247" text-anchor="middle" font-size="9" fill="#877cab">the browser is the client</text>

  <!-- phase captions -->
  <foreignObject x="78" y="414" width="624" height="54">
    <div xmlns="http://www.w3.org/1999/xhtml" style="position:relative;width:100%;height:100%">
      <div class="cba" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;text-align:center;background:rgba(143,122,224,.08);border:1px solid rgba(165,140,255,.25);border-radius:10px;padding:6px 16px;font-size:11.5px;line-height:1.45;color:#b9a7ff">Step 1 &middot; Sync. Every endpoint sends a short signaling pulse to Polaris Cloud and back: authenticate, resolve the screen key, exchange SDP and ICE.</div>
      <div class="cbb" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;text-align:center;background:rgba(124,227,168,.07);border:1px solid rgba(124,227,168,.28);border-radius:10px;padding:6px 16px;font-size:11.5px;line-height:1.45;color:#8fe6b4">Step 2 &middot; The mesh. Direct WebRTC links every participant to every other. In-room media stays on the LAN; the remote participant connects straight to the pod.</div>
    </div>
  </foreignObject>
  </svg><button class="clb-replay" title="Replay the sequence" aria-label="Replay the animation">&#8635;</button></div>`;
}

/** Two-phase variant: the naive cloud view resolving into the real architecture. */
export function collabSceneCloud(){
  return `<div class="clbwrap reveal"><svg viewBox="0 0 780 382" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Two-step animation: devices first appear to route through Polaris Cloud, then the figure resolves to the true architecture — in-room devices share straight to the pod; out-of-room devices connect over direct links the cloud negotiates">
  <defs>
    <linearGradient id="clbt2" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4a3585"/><stop offset="1" stop-color="#6d5bb8"/></linearGradient>
    <filter id="clbglow2" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="4"/></filter>
  </defs>

  <!-- flow lines first: painted behind cloud, devices, room, pod -->
  <!-- flows up into the cloud (ordered, no crossings) -->
  <path class="clb-flow" d="M104 128 C190 124 255 122 300 124" fill="none" stroke="#7ce3a8" stroke-width="1.8" stroke-dasharray="4 6"/>
  <path class="clb-flow" d="M101 226 C195 206 262 158 316 132" fill="none" stroke="#7ce3a8" stroke-width="1.8" stroke-dasharray="4 6"/>
  <path class="clb-flow" d="M176 292 C252 244 296 172 334 136" fill="none" stroke="#7ce3a8" stroke-width="1.8" stroke-dasharray="4 6"/>

  <path class="clb-flow" d="M426 96 C570 92 690 142 726 194" fill="none" stroke="#a58cff" stroke-width="2" stroke-dasharray="4 6"/>
  <path class="clb-flow cnc-a" d="M510 290 C474 226 442 168 418 134" fill="none" stroke="#7ce3a8" stroke-width="1.8" stroke-dasharray="4 6"/>
  <path class="clb-flow cnc-b" d="M562 296 C622 284 676 246 708 214" fill="none" stroke="#7ce3a8" stroke-width="2" stroke-dasharray="4 6"/>

  <!-- the cloud -->
  <g transform="translate(272,12) scale(1.72)">
    <path d="M20 70a22 22 0 0 1 6-43 30 30 0 0 1 57-7 24 24 0 0 1 4 50z" fill="rgba(143,122,224,.10)" stroke="#a58cff" stroke-width="1.4"/>
  </g>
  <text x="356" y="80" text-anchor="middle" font-size="12.5" font-weight="800" letter-spacing="1.2" fill="#cfc2ff">POLARIS CLOUD</text>
  <text class="cnc-a" x="356" y="97" text-anchor="middle" font-size="10" fill="#9d92c8">routes every share</text>
  <text class="cnc-b" x="356" y="97" text-anchor="middle" font-size="10" fill="#7ce3a8">introduces cross-network shares: local stays local, content goes direct</text>
  <text x="356" y="110" text-anchor="middle" font-size="10" fill="#9d92c8">manages every room</text>
  <circle class="clb-orb" cx="420" cy="30" r="3" fill="#7ce3a8" filter="url(#clbglow2)"/>

  <!-- outside the room: three devices, staggered, labels attached -->
  <text x="38" y="92" font-size="10" letter-spacing="2" font-weight="700" fill="#8a7fb8">OUT OF THE ROOM</text>
  <rect x="38" y="110" width="64" height="42" rx="4" fill="#171231" stroke="#8f7ae0" stroke-width="2"/><rect x="30" y="154" width="80" height="6" rx="3" fill="#35304d"/>
  <text x="70" y="178" text-anchor="middle" font-size="10" fill="#8f85b8">laptop: another building</text>
  <rect x="41" y="206" width="58" height="40" rx="4" fill="#171231" stroke="#4a8fb0" stroke-width="2"/><path d="M41 216h58" stroke="#4a8fb0" stroke-width="1.6"/><circle cx="47" cy="211" r="1.4" fill="#7ce3a8"/><circle cx="53" cy="211" r="1.4" fill="#8f7ae0"/>
  <text x="70" y="268" text-anchor="middle" font-size="10" fill="#8f85b8">browser: guest, no app</text>
  <rect x="150" y="280" width="26" height="46" rx="5" fill="#171231" stroke="#8f7ae0" stroke-width="2"/>
  <text x="184" y="306" text-anchor="start" font-size="10" fill="#8f85b8">phone: LTE</text>

  <!-- the room -->
  <rect x="486" y="140" width="280" height="206" rx="12" fill="rgba(255,255,255,.012)" stroke="rgba(165,140,255,.30)" stroke-width="1.4" stroke-dasharray="6 6"/>
  <text x="500" y="160" font-size="10" letter-spacing="2" font-weight="700" fill="#8a7fb8">THE ROOM</text>

  <!-- display + workspace -->
  <rect x="514" y="172" width="186" height="112" rx="7" fill="#0e0b1e" stroke="#4a3d7d" stroke-width="2.5"/><circle cx="693" cy="279" r="1.8" fill="#7ce3a8"/>
  <rect x="522" y="180" width="170" height="96" rx="4" fill="#181330"/>
  <rect x="528" y="186" width="94" height="78" rx="4" fill="url(#clbt2)"/>
  <rect x="628" y="186" width="60" height="36" rx="4" fill="#1d5c7a"/>
  <rect class="clb-pulse" x="628" y="228" width="60" height="36" rx="4" fill="#2e7a4f" stroke="#7ce3a8" stroke-width="1.6"/>
  <rect x="580" y="284" width="54" height="7" rx="3.5" fill="#35304d"/>
  <text x="626" y="372" text-anchor="middle" font-size="9.5" font-weight="700" fill="#b8aede">the workspace: every share, side by side</text>

  <!-- pod, fed by the cloud -->
  <rect x="710" y="198" width="46" height="18" rx="4" fill="#241c45" stroke="#8f7ae0" stroke-width="2"/><circle cx="748" cy="191" r="2" fill="#7ce3a8"/>
  <path d="M710 207 H700" stroke="#4a8fb0" stroke-width="2.4"/>
  <text x="733" y="236" text-anchor="middle" font-size="10" font-weight="700" fill="#8f85b8">Polaris</text>

  <!-- in the room: a device that still routes via the cloud -->
  <rect x="504" y="286" width="56" height="36" rx="4" fill="#171231" stroke="#8f7ae0" stroke-width="2"/><rect x="497" y="324" width="70" height="6" rx="3" fill="#35304d"/>
  <text x="532" y="344" text-anchor="middle" font-size="10" fill="#8f85b8">in the room</text>
  <text class="cnc-b" x="532" y="358" text-anchor="middle" font-size="10" font-weight="700" fill="#7ce3a8">→ straight to the pod, never leaves the building</text>
  </svg></div>`;
}

/** Cable / wireless / meeting-host key for the room scenes. */
export function rsLegend(){
  return `<div class="rs-legend"><span><i class="rs-li"></i>cable</span><span><i class="rs-li rs-dash"></i>wireless to Polaris</span><span><i class="rs-li rs-host"></i>meeting host</span><span style="color:#e8a184;font-weight:700">&#10005;</span><span style="margin-left:-8px">not in the meeting</span></div>`;
}

/** Room diagram n: 1 = BYOD, 2 = BYOM, 3 = hosted by the room (BYOM+). */
export function roomScene(n){
  if(n===1)return `<svg class="rs-svg" viewBox="0 0 340 212" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="BYOD room: the meeting lives on the laptop alone; room camera and mic not captured">
  <defs><linearGradient id="rs1-glass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4a3585"/><stop offset="1" stop-color="#372a68"/></linearGradient></defs>
  <rect x="96" y="8" width="140" height="82" rx="5" fill="#181330" stroke="#4a3d7d" stroke-width="2"/>
  <rect x="103" y="15" width="126" height="64" fill="#241c45"/>
  <rect x="110" y="22" width="76" height="50" rx="2" fill="url(#rs1-glass)"/>
  <rect x="192" y="22" width="30" height="50" rx="2" fill="#181330"/>
  <path d="M219 90 V98" fill="none" stroke="#4a8fb0" stroke-width="2"/>
  <rect x="196" y="98" width="46" height="18" rx="3" fill="#241c45" stroke="#8f7ae0" stroke-width="1.8"/>
  <circle cx="235" cy="107" r="2" fill="#7ce3a8"/>
  <text x="210" y="128" text-anchor="middle" font-size="8" font-weight="700" fill="#8a7fb8">Polaris pod</text>
  <text x="210" y="137" text-anchor="middle" font-size="7.5" fill="#6f668f">(Pro / Essentials)</text>
  <g opacity=".55"><rect x="118" y="96" width="58" height="9" rx="4.5" fill="#181330" stroke="#5a5378" stroke-width="1.5"/><circle cx="147" cy="100.5" r="2.6" fill="#5a5378"/></g>
  <text x="112" y="104" text-anchor="end" font-size="10" font-weight="700" fill="#e8a184">&#10005;</text>
  <path d="M28 204 L312 204 L286 152 L54 152 Z" fill="#1c1636" stroke="#332b58" stroke-width="1.5"/>
  <g opacity=".5"><rect x="250" y="168" width="22" height="5" rx="2.5" fill="#181330" stroke="#5a5378" stroke-width="1.3"/><path d="M261 168 V162" stroke="#5a5378" stroke-width="1.5"/><circle cx="261" cy="158" r="4.2" fill="#181330" stroke="#5a5378" stroke-width="1.5"/></g>
  <text x="278" y="162" text-anchor="start" font-size="10" font-weight="700" fill="#e8a184">&#10005;</text>
  <text x="261" y="186" text-anchor="middle" font-size="8" fill="#6f668f">table mic</text>
  <path d="M140 142 C168 136 182 122 196 108" fill="none" stroke="#7ce3a8" stroke-width="1.8" stroke-dasharray="3 4"/>
  <rect x="66" y="124" width="54" height="36" rx="3" fill="#171231" stroke="#8f7ae0" stroke-width="2"/>
  <rect x="71" y="129" width="44" height="26" rx="1.5" fill="#241c45"/>
  <circle cx="93" cy="127" r="1.4" fill="#7ce3a8"/>
  <rect x="59" y="160" width="68" height="6" rx="3" fill="#35304d"/>
  <text x="93" y="184" text-anchor="middle" font-size="8" fill="#8a7fb8">laptop webcam carries the call</text>
  <rect class="rs-halo" x="47" y="113" width="92" height="62" rx="13" fill="none" stroke="#a58cff" stroke-width="2"/>
  <rect x="50" y="116" width="86" height="56" rx="11" fill="rgba(165,140,255,.08)" stroke="#a58cff" stroke-width="2.5"/>
  </svg>`;
  if(n===2)return `<svg class="rs-svg" viewBox="0 0 340 212" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="BYOM room: room camera and mic cabled to the Polaris pod, bridged wirelessly to the laptop that still hosts">
  <defs><linearGradient id="rs2-glass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4a3585"/><stop offset="1" stop-color="#372a68"/></linearGradient></defs>
  <rect x="96" y="8" width="140" height="82" rx="5" fill="#181330" stroke="#4a3d7d" stroke-width="2"/>
  <rect x="103" y="15" width="126" height="64" fill="#241c45"/>
  <rect x="110" y="22" width="60" height="36" rx="2" fill="url(#rs2-glass)"/>
  <rect x="174" y="22" width="48" height="36" rx="2" fill="#1d5c7a"/>
  <rect x="110" y="62" width="112" height="10" rx="2" fill="#35304d"/>
  <path d="M219 90 V98" fill="none" stroke="#4a8fb0" stroke-width="2"/>
  <rect x="196" y="98" width="46" height="18" rx="3" fill="#241c45" stroke="#8f7ae0" stroke-width="1.8"/>
  <circle cx="235" cy="107" r="2" fill="#7ce3a8"/>
  <text x="210" y="128" text-anchor="middle" font-size="8" font-weight="700" fill="#8a7fb8">Polaris pod</text>
  <text x="210" y="137" text-anchor="middle" font-size="7.5" fill="#6f668f">(Pro / Essentials)</text>
  <rect x="118" y="96" width="58" height="9" rx="4.5" fill="#181330" stroke="#4a8fb0" stroke-width="1.8"/>
  <circle cx="147" cy="100.5" r="2.6" fill="#7ce3a8"/>
  <path d="M176 100 C184 100 190 101 196 103" fill="none" stroke="#4a8fb0" stroke-width="2"/>
  <text x="112" y="104" text-anchor="end" font-size="8" fill="#8a7fb8">room camera</text>
  <path d="M28 204 L312 204 L286 152 L54 152 Z" fill="#1c1636" stroke="#332b58" stroke-width="1.5"/>
  <rect x="250" y="168" width="22" height="5" rx="2.5" fill="#181330" stroke="#4a8fb0" stroke-width="1.3"/>
  <path d="M261 168 V162" stroke="#4a8fb0" stroke-width="1.5"/>
  <circle cx="261" cy="158" r="4.2" fill="#181330" stroke="#4a8fb0" stroke-width="1.5"/>
  <path d="M261 153 C260 142 252 128 242 114" fill="none" stroke="#4a8fb0" stroke-width="2"/>
  <text x="261" y="186" text-anchor="middle" font-size="8" fill="#8a7fb8">table mic</text>
  <path d="M140 142 C168 136 182 122 196 108" fill="none" stroke="#7ce3a8" stroke-width="1.8" stroke-dasharray="3 4"/>
  <rect x="66" y="124" width="54" height="36" rx="3" fill="#171231" stroke="#8f7ae0" stroke-width="2"/>
  <rect x="71" y="129" width="44" height="26" rx="1.5" fill="#241c45"/>
  <circle cx="93" cy="127" r="1.4" fill="#7ce3a8"/>
  <rect x="59" y="160" width="68" height="6" rx="3" fill="#35304d"/>
  <text x="93" y="184" text-anchor="middle" font-size="8" fill="#8a7fb8">laptop still hosts the call</text>
  <rect class="rs-halo" x="47" y="113" width="92" height="62" rx="13" fill="none" stroke="#a58cff" stroke-width="2"/>
  <rect x="50" y="116" width="86" height="56" rx="11" fill="rgba(165,140,255,.08)" stroke="#a58cff" stroke-width="2.5"/>
  </svg>`;
  return `<svg class="rs-svg" viewBox="0 0 340 240" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Hosted by the room (BYOM+): dual displays and camera cabled to the Polaris pod; the Polaris Host controls the room; a phone shares wirelessly; the room is the host">
  <defs><linearGradient id="rs3-glass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4a3585"/><stop offset="1" stop-color="#372a68"/></linearGradient></defs>
  <rect class="rs-halo" x="7" y="1" width="326" height="142" rx="16" fill="none" stroke="#a58cff" stroke-width="2"/>
  <rect x="10" y="4" width="320" height="136" rx="14" fill="rgba(165,140,255,.06)" stroke="#a58cff" stroke-width="2.5"/>
  <text x="16" y="15" font-size="8" font-weight="700" fill="#a58cff">meeting host: the room</text>
  <rect x="139" y="12" width="60" height="9" rx="4.5" fill="#181330" stroke="#4a8fb0" stroke-width="1.8"/>
  <circle cx="169" cy="16.5" r="2.6" fill="#7ce3a8"/>
  <path d="M169 21 V106" fill="none" stroke="#4a8fb0" stroke-width="2"/>
  <rect x="20" y="24" width="126" height="72" rx="4" fill="#181330" stroke="#4a3d7d" stroke-width="2"/>
  <rect x="26" y="30" width="114" height="54" fill="#241c45"/>
  <rect x="31" y="35" width="52" height="28" rx="2" fill="url(#rs3-glass)"/>
  <rect x="87" y="35" width="48" height="18" rx="2" fill="#1d5c7a"/>
  <rect x="87" y="57" width="48" height="16" rx="2" fill="#3a2d6e"/>
  <rect x="31" y="67" width="52" height="12" rx="2" fill="#35304d"/>
  <text x="88" y="107" text-anchor="middle" font-size="8" fill="#8a7fb8">Mersive workspace</text>
  <path d="M36 96 V115 H143" fill="none" stroke="#4a8fb0" stroke-width="2"/>
  <rect x="192" y="24" width="126" height="72" rx="4" fill="#181330" stroke="#4a3d7d" stroke-width="2"/>
  <rect x="198" y="30" width="114" height="54" fill="#241c45"/>
  <rect x="203" y="35" width="52" height="22" rx="2" fill="#171231"/>
  <rect x="259" y="35" width="48" height="22" rx="2" fill="#171231"/>
  <rect x="203" y="61" width="52" height="19" rx="2" fill="#171231"/>
  <rect x="259" y="61" width="48" height="19" rx="2" fill="#171231"/>
  <circle cx="229" cy="43" r="4.5" fill="#8f7ae0"/><path d="M221 57 a8 8 0 0 1 16 0" fill="#8f7ae0"/>
  <circle cx="283" cy="43" r="4.5" fill="#4a8fb0"/><path d="M275 57 a8 8 0 0 1 16 0" fill="#4a8fb0"/>
  <circle cx="229" cy="68" r="4" fill="#7ce3a8"/><path d="M222 80 a7 7 0 0 1 14 0" fill="#7ce3a8"/>
  <circle cx="283" cy="68" r="4" fill="#a58cff"/><path d="M276 80 a7 7 0 0 1 14 0" fill="#a58cff"/>
  <text x="255" y="107" text-anchor="middle" font-size="8" fill="#8a7fb8">the VTC call</text>
  <path d="M300 96 V115 H195" fill="none" stroke="#4a8fb0" stroke-width="2"/>
  <rect x="143" y="106" width="52" height="20" rx="4" fill="#241c45" stroke="#8f7ae0" stroke-width="1.8"/>
  <text x="169" y="119" text-anchor="middle" font-size="6.5" font-weight="800" letter-spacing=".5" fill="#cfc7ec">POLARIS PRO</text>
  <path d="M22 218 L318 218 L292 166 L48 166 Z" fill="#1c1636" stroke="#332b58" stroke-width="1.5"/>
  <rect x="240" y="182" width="22" height="5" rx="2.5" fill="#181330" stroke="#4a8fb0" stroke-width="1.3"/>
  <path d="M251 182 V176" stroke="#4a8fb0" stroke-width="1.5"/>
  <circle cx="251" cy="172" r="4.2" fill="#181330" stroke="#4a8fb0" stroke-width="1.5"/>
  <path d="M251 167 C238 148 216 132 195 122" fill="none" stroke="#4a8fb0" stroke-width="2"/>
  <text x="251" y="198" text-anchor="middle" font-size="8" fill="#8a7fb8">table mic</text>
  <rect x="42" y="176" width="58" height="34" rx="5" fill="#171231" stroke="#a58cff" stroke-width="2"/>
  <rect x="47" y="181" width="48" height="24" rx="2" fill="#241c45"/>
  <rect x="51" y="185" width="18" height="6" rx="1.5" fill="#4a3585"/>
  <rect x="51" y="194" width="18" height="6" rx="1.5" fill="#35304d"/>
  <rect x="73" y="185" width="18" height="8" rx="4" fill="#2e7a4f"/>
  <circle cx="82" cy="199" r="5.5" fill="none" stroke="#7ce3a8" stroke-width="1" opacity=".55"/>
  <circle cx="82" cy="199" r="2.4" fill="#7ce3a8"/>
  <g stroke="#7ce3a8" stroke-width="1.6" fill="none" stroke-dasharray="2 3">
    <path d="M110.8 172.3 A9 9 0 0 0 104.9 165.5"/>
    <path d="M116.7 171.1 A15 15 0 0 0 106.9 159.8"/>
    <path d="M122.6 170 A21 21 0 0 0 108.8 154.1"/>
    <path d="M126 150 C140 138 152 130 158 126"/>
  </g>
  <path d="M133 184 C148 160 158 142 170 126" fill="none" stroke="#7ce3a8" stroke-width="1.8" stroke-dasharray="3 4"/>
  <rect x="116" y="180" width="17" height="30" rx="3" fill="#171231" stroke="#8f7ae0" stroke-width="1.8"/>
  <rect x="119" y="184" width="11" height="19" rx="1" fill="#241c45"/>
  <rect x="120.5" y="186" width="8" height="6" rx="1" fill="#4a3585"/>
  <text x="60" y="222" text-anchor="middle" font-size="8" font-weight="700" fill="#b09aff">Polaris Host</text>
  <text x="60" y="231" text-anchor="middle" font-size="8" fill="#b09aff">runs the room &amp; the call</text>
  <path d="M136 204 H146" stroke="#8a7fb8" stroke-width="1" stroke-dasharray="2 2"/>
  <text x="150" y="207" text-anchor="start" font-size="8" fill="#8a7fb8">share from a phone</text>
  </svg>`;
}

/* ── The four pillar diagrams on the home page ──────────────────────────────
   One figure per product area, drawn to roomScene()'s vocabulary above so the
   four read as one set rather than four illustrations that happen to share a
   page: the same floor trapezoid (#1c1636 / #332b58), display bezel (#181330 /
   #4a3d7d, screen #241c45), share glass (#4a3585 -> #372a68), VTC tile
   (#1d5c7a), solid #4a8fb0 cable, dashed #7ce3a8 wireless, #8f7ae0 pod, the
   .rs-halo lilac ring, and 8px / 7.5px labels in #8a7fb8 / #6f668f.

   ALL FOUR ARE 340x212 and that is load-bearing: they sit in one row and a
   figure of a different aspect makes the band look broken. roomScene(3) is
   340x240 and renders on four other pages, so it is not reshaped to join them —
   these are new figures, not a refactor of those.

   Gradient ids are prefixed per figure (ps1-, ps2-…) because all four render
   into one document, where a duplicate id silently repaints the wrong figure.

   No copper. check-copper.py allows the home page exactly two .warm elements
   and both are spent (the hero's .grad.warm and CtaBand's .btn.warm), so this
   band stays in the lilac/green family. #e8a184 is the "not in the meeting"
   tone roomScene and rsLegend already use, not the copper accent.

   <title> AND <desc> ELEMENTS, NOT aria-label, AND THE DIFFERENCE IS THE POINT.
   Both name the figure for a screen reader. Only one is indexable: aria-label is
   an accessibility ATTRIBUTE and search engines do not treat it as page content,
   while <title> and <desc> are real text nodes inside the document. These four
   figures now carry the band's meaning on their own -- which they have to, since
   the cards around them are down to a heading and a link. Under the old
   attribute the figures were, to a crawler, four empty boxes.

   aria-labelledby rather than aria-label so the two elements are what names the
   image, and the ids are prefixed per figure because all four render into one
   document. Note <title> also surfaces as a browser tooltip; that is acceptable
   here, where it says exactly what the picture shows.

   roomScene() above is deliberately left on aria-label: it is a different figure
   set on other pages, and this change is scoped to the four the home page
   depends on. Worth doing there too, separately. */

/* CONNECTOR ROUTING, all four figures: every link runs in straight vertical and
   horizontal segments with a rounded corner where it turns. The corners are
   quadratic curves whose control point IS the corner (L to the approach, Q
   through the corner, L away from it), which is visually an arc but cannot be
   got wrong the way an A command's sweep flag can. Diagonals are gone; a run of
   right angles reads as cabling and topology, which is what these are.

   Solid #4a8fb0 is a cable, dashed #7ce3a8 is wireless — the same two the
   rs-legend on the deep pages defines, so a reader who has seen one figure on
   this site has seen all of them.

   Devices that sit on furniture are drawn AFTER the table so they paint on top
   of it, and each one's footprint is checked against the trapezoid at its own
   depth: the table narrows toward the back, so a device that clears the front
   edge can still hang off the sides further up. */

/** Pillar diagram n: 1 = wireless collaboration and screen mirroring,
 *  2 = hybrid meetings, 3 = digital signage, 4 = fleet management. All 340x212. */
export function pillarScene(n){
  if(n===1)return `<svg class="rs-svg" viewBox="0 0 340 212" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="ps1-t ps1-d">
  <title id="ps1-t">Wireless collaboration and screen mirroring</title>
  <desc id="ps1-d">A laptop, a phone and a guest browser sit on a meeting-room table and each shares wirelessly to one room display through a Polaris pod. The display divides evenly so all three stay on screen side by side, with nothing installed and no cable run to the table.</desc>
  <defs><linearGradient id="ps1-glass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4a3585"/><stop offset="1" stop-color="#372a68"/></linearGradient></defs>
  <rect x="68" y="8" width="204" height="102" rx="5" fill="#181330" stroke="#4a3d7d" stroke-width="2"/>
  <rect x="75" y="15" width="190" height="88" fill="#241c45"/>
  <rect x="79" y="21" width="58" height="76" rx="2" fill="url(#ps1-glass)"/>
  <rect x="141" y="21" width="58" height="76" rx="2" fill="#1d5c7a"/>
  <rect x="203" y="21" width="58" height="76" rx="2" fill="#2e7a4f"/>
  <path d="M170 110 L170 124" fill="none" stroke="#4a8fb0" stroke-width="2"/>
  <rect x="148" y="124" width="44" height="16" rx="3" fill="#241c45" stroke="#8f7ae0" stroke-width="1.8"/>
  <circle cx="185" cy="132" r="2" fill="#7ce3a8"/>
  <text x="142" y="136" text-anchor="end" font-size="7.5" fill="#6f668f">Polaris pod</text>
  <path d="M34 204 L306 204 L276 176 L64 176 Z" fill="#1c1636" stroke="#332b58" stroke-width="1.5"/>
  <g fill="none" stroke="#7ce3a8" stroke-width="1.8" stroke-dasharray="3 4">
    <path d="M89 170 L89 162 Q89 154 97 154 L150 154 Q158 154 158 146 L158 140"/>
    <path d="M170 168 L170 140"/>
    <path d="M252 170 L252 162 Q252 154 244 154 L190 154 Q182 154 182 146 L182 140"/>
  </g>
  <rect x="66" y="172" width="46" height="22" rx="2" fill="#171231" stroke="#8f7ae0" stroke-width="2"/>
  <rect x="70" y="176" width="38" height="14" rx="1" fill="#241c45"/>
  <rect x="60" y="194" width="58" height="5" rx="2.5" fill="#35304d"/>
  <rect x="161" y="170" width="18" height="28" rx="3" fill="#171231" stroke="#8f7ae0" stroke-width="1.8"/>
  <rect x="164" y="174" width="12" height="18" rx="1" fill="#241c45"/>
  <rect x="228" y="172" width="48" height="24" rx="3" fill="#171231" stroke="#8f7ae0" stroke-width="2"/>
  <path d="M232 179 H272" stroke="#8f7ae0" stroke-width="1.2"/>
  <circle cx="235" cy="176" r="1.2" fill="#7ce3a8"/>
  <rect x="232" y="182" width="40" height="11" rx="1.5" fill="#241c45"/>
  <text x="89" y="209" text-anchor="middle" font-size="7.5" fill="#6f668f">laptop</text>
  <text x="170" y="209" text-anchor="middle" font-size="7.5" fill="#6f668f">phone</text>
  <text x="252" y="209" text-anchor="middle" font-size="7.5" fill="#6f668f">guest browser</text>
  </svg>`;
  if(n===2)return `<svg class="rs-svg" viewBox="0 0 340 212" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="ps2-t ps2-d">
  <title id="ps2-t">Hybrid meetings</title>
  <desc id="ps2-d">Two wall-mounted displays, one carrying shared content and one carrying the video call, both cabled to a Polaris pod mounted beneath them. A camera bar under the pod is bridged wirelessly to the laptop on the table, so the room camera and microphone carry the call while the laptop still hosts it.</desc>
  <defs><linearGradient id="ps2-glass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4a3585"/><stop offset="1" stop-color="#372a68"/></linearGradient></defs>
  <rect x="22" y="10" width="140" height="74" rx="4" fill="#181330" stroke="#4a3d7d" stroke-width="2"/>
  <rect x="28" y="16" width="128" height="62" fill="#241c45"/>
  <rect x="34" y="22" width="82" height="32" rx="2" fill="url(#ps2-glass)"/>
  <rect x="34" y="58" width="70" height="4" rx="2" fill="#8f7ae0" opacity=".7"/>
  <rect x="34" y="66" width="52" height="4" rx="2" fill="#5a5378"/>
  <text x="92" y="76" text-anchor="middle" font-size="7" fill="#8a7fb8">shared content</text>
  <rect x="178" y="10" width="140" height="74" rx="4" fill="#181330" stroke="#4a3d7d" stroke-width="2"/>
  <rect x="184" y="16" width="128" height="62" fill="#241c45"/>
  <g fill="#1d5c7a">
    <rect x="190" y="22" width="58" height="20" rx="2"/>
    <rect x="252" y="22" width="54" height="20" rx="2"/>
    <rect x="190" y="46" width="58" height="20" rx="2"/>
    <rect x="252" y="46" width="54" height="20" rx="2"/>
  </g>
  <g fill="#9fd8ee" opacity=".85">
    <circle cx="219" cy="29" r="3.4"/><path d="M213 41 a6 6 0 0 1 12 0 z"/>
    <circle cx="279" cy="29" r="3.4"/><path d="M273 41 a6 6 0 0 1 12 0 z"/>
    <circle cx="219" cy="53" r="3.4"/><path d="M213 65 a6 6 0 0 1 12 0 z"/>
    <circle cx="279" cy="53" r="3.4"/><path d="M273 65 a6 6 0 0 1 12 0 z"/>
  </g>
  <text x="248" y="76" text-anchor="middle" font-size="7" fill="#8a7fb8">the VTC call</text>
  <g fill="none" stroke="#4a8fb0" stroke-width="2">
    <path d="M160 100 L160 94 Q160 90 156 90 L96 90 Q92 90 92 86 L92 84"/>
    <path d="M180 100 L180 94 Q180 90 184 90 L244 90 Q248 90 248 86 L248 84"/>
    <path d="M170 116 L170 124"/>
  </g>
  <rect x="148" y="100" width="44" height="16" rx="3" fill="#241c45" stroke="#8f7ae0" stroke-width="1.8"/>
  <circle cx="185" cy="108" r="2" fill="#7ce3a8"/>
  <text x="142" y="112" text-anchor="end" font-size="7.5" fill="#6f668f">Polaris pod</text>
  <rect x="150" y="124" width="40" height="9" rx="4.5" fill="#181330" stroke="#4a8fb0" stroke-width="1.4"/>
  <circle cx="170" cy="128.5" r="2.6" fill="#7ce3a8"/>
  <text x="196" y="131" text-anchor="start" font-size="7.5" fill="#8a7fb8">room camera</text>
  <path d="M170 133 L170 142 Q170 148 164 148 L98 148 Q92 148 92 154 L92 158" fill="none" stroke="#7ce3a8" stroke-width="1.8" stroke-dasharray="3 4"/>
  <text x="131" y="145" text-anchor="middle" font-size="7" font-weight="700" fill="#7ce3a8">wireless</text>
  <path d="M40 200 L300 200 L270 172 L70 172 Z" fill="#1c1636" stroke="#332b58" stroke-width="1.5"/>
  <rect x="66" y="158" width="52" height="26" rx="3" fill="#171231" stroke="#8f7ae0" stroke-width="2"/>
  <rect x="70" y="162" width="44" height="18" rx="1" fill="#241c45"/>
  <rect x="60" y="184" width="64" height="5" rx="2.5" fill="#35304d"/>
  <text x="92" y="207" text-anchor="middle" font-size="7.5" fill="#6f668f">the laptop still hosts the call</text>
  </svg>`;
  if(n===3)return `<svg class="rs-svg" viewBox="0 0 340 212" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="ps3-t ps3-d">
  <title id="ps3-t">Digital signage</title>
  <desc id="ps3-d">A wall-mounted portrait screen for a lobby or hallway, and a wall-mounted meeting display that reverts to signage the moment nobody is sharing. Both publish from the same Polaris Cloud portal.</desc>
  <defs><linearGradient id="ps3-sign" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4a3585"/><stop offset="1" stop-color="#2e7a4f"/></linearGradient></defs>
  <text x="24" y="12" font-size="7" font-weight="800" letter-spacing=".4" fill="#8a7fb8">DEDICATED SIGNAGE</text>
  <rect x="24" y="18" width="78" height="114" rx="5" fill="#181330" stroke="#4a3d7d" stroke-width="2"/>
  <rect x="31" y="25" width="64" height="100" fill="#241c45"/>
  <rect x="36" y="30" width="54" height="32" rx="2" fill="url(#ps3-sign)"/>
  <rect x="36" y="68" width="54" height="4" rx="2" fill="#8f7ae0" opacity=".7"/>
  <rect x="36" y="76" width="42" height="4" rx="2" fill="#5a5378"/>
  <rect x="36" y="84" width="48" height="4" rx="2" fill="#5a5378"/>
  <rect x="36" y="96" width="32" height="9" rx="2" fill="#2e7a4f"/>
  <text x="63" y="146" text-anchor="middle" font-size="7.5" fill="#6f668f">lobby &middot; hallway &middot; cafeteria</text>
  <text x="146" y="12" font-size="7" font-weight="800" letter-spacing=".4" fill="#8a7fb8">AND THE ROOMS YOU OWN</text>
  <rect x="146" y="18" width="180" height="98" rx="5" fill="#181330" stroke="#4a3d7d" stroke-width="2"/>
  <rect x="153" y="25" width="166" height="84" fill="#241c45"/>
  <rect x="159" y="31" width="154" height="42" rx="2" fill="url(#ps3-sign)"/>
  <rect x="159" y="79" width="94" height="5" rx="2.5" fill="#8f7ae0" opacity=".7"/>
  <rect x="159" y="90" width="68" height="5" rx="2.5" fill="#5a5378"/>
  <rect x="265" y="79" width="48" height="16" rx="3" fill="#2e7a4f"/>
  <path d="M270 116 L270 132" fill="none" stroke="#4a8fb0" stroke-width="2"/>
  <rect x="248" y="132" width="44" height="16" rx="3" fill="#241c45" stroke="#8f7ae0" stroke-width="1.8"/>
  <circle cx="285" cy="140" r="2" fill="#7ce3a8"/>
  <text x="244" y="144" text-anchor="end" font-size="7.5" fill="#6f668f">idle room reverts to signage</text>
  <g fill="none" stroke="#7ce3a8" stroke-width="1.6" stroke-dasharray="3 4">
    <path d="M63 150 L63 160 Q63 168 71 168 L140 168"/>
    <path d="M270 148 L270 160 Q270 168 262 168 L196 168"/>
  </g>
  <path d="M140 182 A13 13 0 0 1 144 158 A18 18 0 0 1 178 153 A13 13 0 0 1 196 164 A10 10 0 0 1 198 182 Z" fill="rgba(143,122,224,.10)" stroke="#a58cff" stroke-width="2.2"/>
  <text x="169" y="176" text-anchor="middle" font-size="7" font-weight="800" letter-spacing=".6" fill="#cfc2ff">ONE PORTAL</text>
  <text x="169" y="202" text-anchor="middle" font-size="7.5" fill="#6f668f">both wall mounted, one Polaris Cloud login</text>
  </svg>`;
  return `<svg class="rs-svg" viewBox="0 0 340 212" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="ps4-t ps4-d">
  <title id="ps4-t">Fleet management</title>
  <desc id="ps4-d">Every Mersive Polaris pod in the estate reports to one Polaris Cloud pane, where the whole fleet is deployed, monitored and updated from a desk rather than a truck roll. Room health, alerts and firmware are visible across every site at once, with one room here raising an alert.</desc>
  <path d="M138 48 A14 14 0 0 1 141 21 A19 19 0 0 1 178 15 A15 15 0 0 1 199 27 A12 12 0 0 1 202 48 Z" fill="rgba(143,122,224,.10)" stroke="#a58cff" stroke-width="2.4"/>
  <text x="170" y="38" text-anchor="middle" font-size="8" font-weight="800" letter-spacing="1" fill="#cfc2ff">POLARIS CLOUD</text>
  <g fill="none" stroke="#7ce3a8" stroke-width="1.6" stroke-dasharray="3 4">
    <path d="M42 130 L42 104 Q42 96 50 96 L170 96"/>
    <path d="M106 130 L106 104 Q106 96 114 96 L170 96"/>
    <path d="M170 130 L170 52"/>
    <path d="M234 130 L234 104 Q234 96 226 96 L170 96"/>
    <path d="M298 130 L298 104 Q298 96 290 96 L170 96"/>
  </g>
  <g fill="#241c45" stroke="#8f7ae0" stroke-width="1.6">
    <rect x="18" y="130" width="48" height="18" rx="4"/>
    <rect x="82" y="130" width="48" height="18" rx="4"/>
    <rect x="146" y="130" width="48" height="18" rx="4"/>
    <rect x="210" y="130" width="48" height="18" rx="4"/>
    <rect x="274" y="130" width="48" height="18" rx="4"/>
  </g>
  <g fill="#4a3585">
    <rect x="27" y="141" width="14" height="3" rx="1.5"/>
    <rect x="91" y="141" width="14" height="3" rx="1.5"/>
    <rect x="155" y="141" width="14" height="3" rx="1.5"/>
    <rect x="219" y="141" width="14" height="3" rx="1.5"/>
    <rect x="283" y="141" width="14" height="3" rx="1.5"/>
  </g>
  <circle cx="57" cy="139" r="2.2" fill="#7ce3a8"/>
  <circle cx="121" cy="139" r="2.2" fill="#7ce3a8"/>
  <circle cx="185" cy="139" r="2.2" fill="#7ce3a8"/>
  <circle cx="249" cy="139" r="2.2" fill="#e8a184"/>
  <circle cx="313" cy="139" r="2.2" fill="#7ce3a8"/>
  <text x="42" y="162" text-anchor="middle" font-size="7" fill="#6f668f">HQ &middot; fl 3</text>
  <text x="106" y="162" text-anchor="middle" font-size="7" fill="#6f668f">HQ &middot; fl 7</text>
  <text x="170" y="162" text-anchor="middle" font-size="7" fill="#6f668f">Austin</text>
  <text x="234" y="162" text-anchor="middle" font-size="7" fill="#e8a184">alert</text>
  <text x="298" y="162" text-anchor="middle" font-size="7" fill="#6f668f">London</text>
  <text x="170" y="188" text-anchor="middle" font-size="8" fill="#8a7fb8">every Polaris pod, one pane</text>
  </svg>`;
}

/** Side-by-side "in the room" vs "remote" parity figure. */
export function parityFig(){
  const stage = `<div class="pstage"><i style="left:2%;top:4%;width:60%;height:92%;background:linear-gradient(135deg,#4a3585,#6d5bb8)"><svg viewBox="0 0 100 62" preserveAspectRatio="xMidYMid meet" style="width:100%;height:100%"><rect x="14" y="12" width="34" height="6" rx="2" fill="#fff" opacity=".5"/><rect x="14" y="26" width="58" height="3.5" rx="1.75" fill="#fff" opacity=".28"/><rect x="14" y="34" width="50" height="3.5" rx="1.75" fill="#fff" opacity=".28"/><rect x="14" y="42" width="56" height="3.5" rx="1.75" fill="#fff" opacity=".28"/></svg></i><i style="left:65%;top:4%;width:33%;height:44%;background:linear-gradient(135deg,#1d5c7a,#2f8aa8)"><svg viewBox="0 0 100 62" preserveAspectRatio="xMidYMid meet" style="width:100%;height:100%"><rect x="20" y="10" width="60" height="42" rx="4" fill="none" stroke="#fff" opacity=".45" stroke-width="2.5"/><path d="M20 21 H80" stroke="#fff" opacity=".45" stroke-width="2"/><circle cx="26" cy="15.5" r="1.8" fill="#fff" opacity=".5"/><circle cx="32" cy="15.5" r="1.8" fill="#fff" opacity=".5"/></svg></i><i style="left:65%;top:52%;width:33%;height:44%;background:linear-gradient(135deg,#2e7a4f,#4fb87d)"><svg viewBox="0 0 100 62" preserveAspectRatio="xMidYMid meet" style="width:100%;height:100%"><path d="M20 44 L38 28 L52 34 L68 18 L80 24" fill="none" stroke="#fff" opacity=".55" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="80" cy="24" r="2.5" fill="#fff" opacity=".7"/></svg></i></div>`;
  return `<div class="parity">
      <div class="pscreen"><div class="pslabel">The room display</div>${stage}</div>
      <div class="psync">⇄<span>live mirror</span></div>
      <div class="pscreen"><div class="pslabel">app.mersive.com: every participant</div>${stage}</div>
    </div>`;
}

/** Industry page: breadcrumb, chips, h1 and deck. */
export function indHead(path,navTitle,h1,dek){
  return `${crumbs(path,navTitle)}
  <div class="pageinfo"><span class="tag t-tpl">T7</span><span class="tag t-open">OPEN</span></div>
  <h1 class="pg">${h1}</h1>
  <p class="dek">${dek}</p>`;
}

/** Industry page: the pain grid, each with its fix. */
export function indPains(h2,sdek,items){
  return `<section class="sect reveal tight">
    <div class="kicker">The rooms you actually have</div>
    <h2>${h2}</h2><p class="sdek">${sdek}</p>
    <div class="ind-pains">${items.map(i=>`<div class="ind-pain"><span class="px">✕</span><b>${i[0]}</b><p>${i[1]}</p>${i[2]?`<div class="fix">✓ ${i[2]}</div>`:""}</div>`).join("")}</div>
  </section>`;
}

/** Industry page: the recommended stack. */
export function indStack(h2,sdek,cards,note){
  return `<section class="sect reveal flush">
    <div class="kicker">The recommended stack</div>
    <h2>${h2}</h2><p class="sdek">${sdek}</p>
    <div class="tiercards">${cards.map(c=>`<div class="tiercard${c.hot?" hot":""}">
      <div class="tname">${c.name}${c.ship?` <span class="tag t-ship">${c.ship}</span>`:c.pre?` <span class="tag t-pre">PRE-LAUNCH</span>`:""}</div>
      <div class="tfor">${c.tfor}</div>
      <ul>${c.pts.map(p=>`<li>${p}</li>`).join("")}</ul>
      <div class="ind-msrp">${c.msrp}<small>${c.msub||""}</small></div>
      <a class="btn accent" href="/${c.link}">${c.lbl}</a></div>`).join("")}</div>
    ${note?`<p class="note">${note}</p>`:""}
  </section>`;
}

/** Industry page: differentiator cards. */
export function indHooks(kicker,h2,sdek,hooks){
  return `<section class="sect reveal flush">
    <div class="kicker">${kicker}</div>
    <h2>${h2}</h2><p class="sdek">${sdek}</p>
    <div class="prdgrid">${hooks.map(k=>`<div class="prdcap"><div class="ic">${k.ic}</div><h3>${k.h}</h3><p>${k.p}</p>${k.link?`<a href="/${k.link}">${k.lbl} →</a>`:""}</div>`).join("")}</div>
  </section>`;
}

/** Industry page: the compliance / capability spine. */
export function indSpine(kicker,h2,sdek,items){
  return `<section class="sect reveal flush">
    <div class="kicker">${kicker}</div>
    <h2>${h2}</h2><p class="sdek">${sdek}</p>
    <div class="ind-spine">${items.map(i=>`<div class="ind-spinei">${i[0]}<div><b>${i[1]}</b><span>${i[2]}${i[3]?` <a href="/${i[3]}">More →</a>`:""}</span></div></div>`).join("")}</div>
  </section>`;
}

/** Industry page: cards routing deeper into the family. */
export function indRouter(cards){
  return `<h2 class="sr-only">Where to go next</h2><div class="ind-router${cards.length>2?" r3":""} reveal">${cards.map(c=>`<a class="ind-route" href="/${c.link}">
    <div class="rk">${c.k}</div><h3>${c.h}</h3><p>${c.p}</p><span class="go">${c.go} →</span></a>`).join("")}</div>`;
}

/** Industry page: customer quote plus supporting stats. */
export function indProof(quote,who,role,stats,note){
  return `<div class="ind-proof reveal"><div><div class="kicker" style="color:#7ce3a8">Proof</div>
    <blockquote>&ldquo;${quote}&rdquo;</blockquote>
    <div class="who"><b>${who}</b> · ${role}</div></div>
    <div class="ind-stats">${stats.map(s=>`<div class="ind-stat"><b>${s[0]}</b><span>${s[1]}</span></div>`).join("")}</div></div>
  <p class="note" style="margin:6px 0 0">${note}</p>`;
}

/** Industry page: related resources. */
export function indRes(items){
  return `<div class="kicker" style="margin-top:30px">Resources: open, no forms</div>
  <div class="prddocs reveal">${items.map(r=>`<a href="/${r[2]}"><b>${r[0]}</b>${r[1]}</a>`).join("")}</div>`;
}

/** "Why not a VTC room system?" counter-argument band. */
export function mtrBand(p){
  return `<div class="ind-mtr reveal">
    <div class="kicker" style="color:#e8a184">The incumbent question</div>
    <h2>&ldquo;We were just going to roll out MTRs.&rdquo;</h2>
    <p>${p}</p>
    <div class="cnt">
      <div class="c"><div class="n">1</div><b>An expensive license, per room, per year</b><p>Every certified room carries its own recurring platform license. At fleet scale the license stack becomes a budget line of its own, renewed annually, forever. [License figures placeholder pending legal.]</p></div>
      <div class="c"><div class="n">2</div><b>One vendor, bolted to the room</b><p>An MTR is a Teams appliance; a Zoom Room does not natively host a Teams meeting. The day your org signs a second platform, every locked room is a renovation.</p></div>
      <div class="c"><div class="n">3</div><b>A call just to share: heads down</b><p>A certified room is designed around one path to the display: the meeting. So co-located teams spin up a call to look at a document, and every head drops into a laptop. The market has priced that in &mdash; at least one wireless-presentation vendor now sells a product specifically to add wireless presenting to a Teams Room, at a second hardware purchase and a second licence.</p></div>
    </div>
    <a class="btn accent" href="/compare/mtr">The full argument: why not a VTC room system? →</a>
  </div>`;
}

/** Base URL of the public documentation portal. */
export const DXU = "https://documentation.mersive.com";

/** Documentation hub: one outbound doc link. */
export function dxL(href,label,desc){
  return `<a class="lnk" href="${href}" target="_blank" rel="noopener"><b>${label} ↗</b>${desc}</a>`;
}

/** Documentation hub: one collapsible taxonomy section. */
export function dxSec(open,title,purpose,mcsLinks,mcsGap,g3Links,g3Note){
  return `<details class="dxt-sec reveal"${open?" open":""}>
    <summary><h3>${title}</h3><p class="pur">${purpose}</p><span class="tw"><span class="twa">＋ more</span><span class="twc">− close</span></span></summary>
    <div class="dxt-cols">
      <div class="dxt-col now"><div class="hd">Polaris · current platform</div>${mcsLinks}${mcsGap?`<div class="dxt-gap"><b>[POLARIS DOC GAP]</b> ${mcsGap}</div>`:""}</div>
      <div class="dxt-col gen3"><div class="hd">Mersive Solstice · Gen 3 estate</div>${g3Links}${g3Note?`<p class="dxt-note">${g3Note}</p>`:""}</div>
    </div>
  </details>`;
}

/** Documentation hub: the Gen 3 → Polaris upgrade prompt. */
export function upgradeBand(){
  return `<div class="g3band reveal" style="margin:14px 0 18px"><b>Running Mersive Solstice Gen 3?</b> Polaris is the next generation of the platform you already own: run both side by side, upgrade room by room, workflows intact. <span class="btns"><a class="btn accent" href="/products/transition">The upgrade path →</a><a class="btn accent" href="/products/family">Meet the Polaris family →</a></span></div>`;
}

/** <option> list for a select, marking `sel` as selected. */
export function opts(o,sel){return Object.keys(o).map(k=>`<option${k===sel?" selected":""}>${k}</option>`).join("")}
/* pageTCO() lived here: a full-page string builder for /platform/tco, ported
   from the POC and never exported, so nothing could call it. src/pages/platform/tco.astro
   superseded it and is a superset of it — same calculator, same placeholder
   blocks, plus the "which of these prices are real" note this never had.
   Removed when the closing band became components/CtaBand.astro, because a dead
   builder holding the last reference to a deleted function is a build error
   waiting for whoever revives it. Recover it from git if it is ever wanted. */

/** Render one placeholder section. */
export function phBlock(s){
  if(s.t==="raw")return s.html;
  return `<div class="ph"><span class="lbl">placeholder · ${s.lbl}</span><h2>${s.h}</h2><p>${s.d}</p>${s.link?`<p><a href="/${s.link}">Explore →</a></p>`:""}</div>`;
}

/** Product media slot: real photography when we have it, silhouette when we don't. */
export function mediaBandHtml(kind,title){
  if(MEDIA_IMG[title])return `<figure class="prodimg reveal"><img src="${MEDIA_IMG[title]}" alt="${title} hardware" loading="lazy"><figcaption>${title}. Real asset from the Mersive hardware library; production replaces with the 3D turntable render (asset workbook).</figcaption></figure>`;
  return `<div class="mediaband reveal"><div class="devwrap">${DEV[kind]||DEV.pod}</div>
  <div class="mnote"><b>PRODUCT MEDIA SLOT: ${title}</b>
  <ul><li>Hero render: ¾ product view on aurora gradient (silhouette shown is placeholder art direction)</li>
  <li>Lifestyle shot: the product in a real room, in use</li>
  <li>Animation loop: the workspace / UI in motion (dock-style concept render)</li></ul>
  Assets owed by design; silhouette conveys intended framing.</div></div>`;
}

/* ---------- pricing tables (C1-C4) ----------
   Cells carry the same data-p-{industry}-{term} attributes the price toggle
   already drives (see initPriceMode in scripts/site.ts), so one table serves
   every combination without duplicating markup. Launch is a one-time hardware
   purchase, so its cells ignore the term and change only with industry. */

const ON_REQ = "On request";
const DASH = "—";
export const PRICE_PARTNER = `<p class="prpartner"><a href="/partners/portal">Partner pricing &rarr;</a></p>`;
export const PRICE_SUBLINE = `<p class="prwhat"><b>Every subscription includes</b> cloud management &middot; cross-network sharing &middot; full warranty &middot; new features &middot; security updates &middot; support &mdash; with no care contract sold separately. The warranty runs for as long as the room is subscribed; <b>on a perpetual licence it is capped at five years</b>.</p><p class="prwhat"><b>How it is sold:</b> the term is billed upfront, then renews annually at the same yearly rate.</p>`;
const PARTNER = PRICE_PARTNER;
const SUBLINE = PRICE_SUBLINE;

/* Every figure below formats from data/pricing.ts. Nothing in this section may
   hold a typed-out dollar amount: the calculator on /products/pro does
   arithmetic on the same numbers, and a price that exists twice is a price that
   will eventually disagree with itself. */

/** A published figure, "On request", or an em dash for a cell with no value. */
const money = (v: Money) => (v === "request" ? ON_REQ : v === null ? DASH : usd(v));
/** The same, as an annual rate: only a real number takes the "/ yr" suffix. */
const perYr = (v: Money) => (typeof v === "number" ? `${usd(v)} / yr` : money(v));

/** One toggle-driven cell. Keys: c3 c5 cp (corporate) / e3 e5 ep (education). */
function pc(v: Record<string, string>, cls = "") {
  const a = (k: string) => v[k] ?? "\u2014";
  return `<td${cls ? ` class="${cls}"` : ""}><span data-p-corp-3="${a("c3")}" data-p-corp-5="${a("c5")}" data-p-corp-p="${a("cp")}" data-p-edu-3="${a("e3")}" data-p-edu-5="${a("e5")}" data-p-edu-p="${a("ep")}">${a("c3")}</span></td>`;
}
/** Launch: one-time hardware, so only the industry matters. */
function pel(corp: string, edu: string, cls = "p") {
  return pc({ c3: corp, c5: corp, cp: corp, e3: edu, e5: edu, ep: edu }, cls);
}

/** The headline figure: the upfront price for the selected term. */
export function priceHead(tier: "essentials" | "pro") {
  const P = PRICING[tier];
  const v = {
    c3: money(P.corp["3"].upfront),
    c5: money(P.corp["5"].upfront),
    cp: money(P.corp.p.upfront),
    ep: money(P.edu.p.upfront),
  };
  const unit = { c3: "BILLED UPFRONT &middot; 3 YEARS", c5: "BILLED UPFRONT &middot; 5 YEARS", cp: "&nbsp;", e3: "&nbsp;", e5: "&nbsp;", ep: "ONE-TIME LICENCE" };
  return `<div class="prhead">
    <div class="price"><span data-p-corp-3="${v.c3}" data-p-corp-5="${v.c5}" data-p-corp-p="${v.cp}" data-p-edu-3="${money(P.edu["3"].upfront)}" data-p-edu-5="${money(P.edu["5"].upfront)}" data-p-edu-p="${v.ep}">${v.c3}</span></div>
    <small><span data-p-corp-3="${unit.c3}" data-p-corp-5="${unit.c5}" data-p-corp-p="${unit.cp}" data-p-edu-3="${unit.e3}" data-p-edu-5="${unit.e5}" data-p-edu-p="${unit.ep}">${unit.c3}</span></small>
  </div>`;
}

/** C1: all three tiers, following the price toggle. */
export function familyPriceTable() {
  const up = (t: TierPricing) =>
    pc({ c3: money(t.corp["3"].upfront), c5: money(t.corp["5"].upfront), cp: money(t.corp.p.upfront),
         e3: money(t.edu["3"].upfront), e5: money(t.edu["5"].upfront), ep: money(t.edu.p.upfront) }, "y");
  const re = (t: TierPricing) =>
    pc({ c3: perYr(t.corp["3"].renew), c5: perYr(t.corp["5"].renew), cp: perYr(t.corp.p.renew),
         e3: perYr(t.edu["3"].renew), e5: perYr(t.edu["5"].renew), ep: perYr(t.edu.p.renew) }, "y");
  const el = usd(ELEMENT.corp), elEdu = usd(ELEMENT.edu);
  const rows = [
    `<tr><td><span data-p-corp-3="Billed upfront" data-p-corp-5="Billed upfront" data-p-corp-p="One-time licence" data-p-edu-3="Billed upfront" data-p-edu-5="Billed upfront" data-p-edu-p="One-time licence">Billed upfront</span></td>` +
      `<td class="y"><span data-p-corp-3="${el}" data-p-corp-5="${el}" data-p-corp-p="${el}" data-p-edu-3="${elEdu}" data-p-edu-5="${elEdu}" data-p-edu-p="${elEdu}">${el}</span><small class="pnote">one-time purchase &middot; no renewal</small></td>` +
      up(ESSENTIALS) + up(PRO) + `</tr>`,
    `<tr><td><span data-p-corp-3="Annual renewal &middot; year 4+" data-p-corp-5="Annual renewal &middot; year 6+" data-p-corp-p="Annual renewal" data-p-edu-3="Annual renewal &middot; year 4+" data-p-edu-5="Annual renewal &middot; year 6+" data-p-edu-p="Annual renewal">Annual renewal &middot; year 4+</span></td>` + pel(DASH, DASH, "n") +
      re(ESSENTIALS) + re(PRO) + `</tr>`,
    `<tr><td>Hardware included</td><td class="y">Polaris Launch device</td><td class="y">Polaris Essentials device</td><td class="y">Polaris Pro device</td></tr>`,
  ].join("");
  return `<div class="famtbl pricetbl"><table>
    <tr><th style="width:24%">How you pay</th><th>Launch <span class="tag t-ship">Shipping Q1 2027</span></th><th>Essentials</th><th>Pro</th></tr>
    ${rows}
  </table></div>${SUBLINE}${PARTNER}`;
}

/** C2/C3: the payment shapes for a single tier. */
export function tierPriceTable(tier: "essentials" | "pro") {
  const t = PRICING[tier];
  const hw = tier === "pro"
    ? `<tr><td>Hardware included</td><td class="y">Polaris Pro device</td></tr>`
    : `<tr><td>Hardware included</td><td class="y">Polaris Essentials device</td></tr>`;
  return `<div class="famtbl pricetbl"><table>
    <tr><th style="width:46%">How you pay</th><th>Per room</th></tr>
    <tr><td><span data-p-corp-3="Billed upfront" data-p-corp-5="Billed upfront" data-p-corp-p="One-time licence" data-p-edu-3="Billed upfront" data-p-edu-5="Billed upfront" data-p-edu-p="One-time licence">Billed upfront</span></td>${pc({ c3: money(t.corp["3"].upfront), c5: money(t.corp["5"].upfront), cp: money(t.corp.p.upfront), e3: money(t.edu["3"].upfront), e5: money(t.edu["5"].upfront), ep: money(t.edu.p.upfront) }, "y")}</tr>
    <tr><td>Annual renewal</td>${pc({ c3: perYr(t.corp["3"].renew), c5: perYr(t.corp["5"].renew), cp: perYr(t.corp.p.renew), e3: perYr(t.edu["3"].renew), e5: perYr(t.edu["5"].renew), ep: perYr(t.edu.p.renew) }, "y")}</tr>
    ${hw}
  </table></div>${SUBLINE}${PARTNER}`;
}

/** Route and Engage both ship Q1 2027. Every mention of either across the site
 *  carries this flag, so the September early publish can strip both by searching
 *  for `alFlag` / `.al-flag` and removing those blocks.
 *
 *  The name is historical: the flag was written when the pair were one product
 *  called Active Learning (renamed to Route, with polling split out as Engage,
 *  25 Aug 2026). It is deliberately NOT renamed — the early publish depends on
 *  this string, and a sweep through eight page files plus AGENTS.md and
 *  PRODUCT.md to change a class name buys nothing before September. */
export function alFlag(extra = "") {
  return `<span class="tag t-ship al-flag"${extra ? ` ${extra}` : ""}>SHIPS Q1 2027</span>`;
}
