/**
 * Home-page motion: the proof bar's counters, the four-workload showcase, and
 * the scroll backdrop's scene switching.
 *
 * All are progressive enhancement over markup that is already correct. The
 * numbers are rendered at their final value by the server and only wound back
 * to zero at the moment something is about to count them up; the showcase's four
 * panels are all in the served HTML with the first one on. A crawler, a reader
 * with JavaScript off and a reader with prefers-reduced-motion all get the
 * finished state, which is the only version of this that is safe on the page
 * that carries the site's strongest internal links.
 *
 * The parallax half of the choreography is mostly NOT here — .pfx, .pfx-drift
 * and .pxb are all driven by initScrollScene(), sitewide. This file owns the
 * behaviours that need state of their own: the counters, the showcase track
 * (whose measured bar and travel direction the generic scrub loop has no
 * business carrying), and the backdrop's scene switching.
 */

const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* Same curve as the title card and .pfx: fast out of the gate, long settle. A
   counter on a linear ramp reads as a loading spinner rather than as an
   arrival. */
const easeOut = (p: number) => 1 - Math.pow(1 - p, 3);

/**
 * The four-workload showcase: one panel at a time, a column of labels beside it,
 * and a bar that travels between the labels as the panels play.
 *
 * IT IS SCROLL-DRIVEN NOW (27 Aug 2026, Matt), not clocked. The section is the
 * .pswstg pinned track — the same mechanism as .advstg, see the block in
 * pages.css — and this function is its driver: it writes --psw-p (0 as the pin
 * catches, 1 as it releases) and deals the slides against that number, so the
 * reader's own scrolling is what plays the sequence, forward and backward. The
 * 6.2-second autoplay clock, its pause flags and its IntersectionObserver went
 * with the change: a scrub has no play state to manage.
 *
 * It lives here rather than in initScrollScene() because the showcase carries
 * state the generic loop has no business holding: which slide is live, which
 * way the deck is travelling, and a bar whose geometry is measured, not
 * derived.
 *
 * Three things about it are deliberate:
 *
 *  - THE PANELS ARE STACKED IN A GRID CELL, not absolutely positioned. All four
 *    occupy `grid-area: 1/1`, so the stage is as tall as the tallest panel and
 *    stays that height for every slide. Absolute positioning would collapse the
 *    stage to nothing and need a hand-maintained min-height that the copy would
 *    outgrow the first time somebody edited a blurb.
 *  - THE BAR IS MEASURED, NOT INDEXED. Its offset and length come from the
 *    active tab's own box, so labels are free to wrap to different depths. An
 *    index times a fixed row height is the version that breaks silently the
 *    first time a label runs to two lines at some width nobody tested.
 *  - A TAB IS A SCROLL DESTINATION. A click (or an arrow key on the tablist)
 *    scrolls the page to that slide's slice of the track instead of setting the
 *    slide directly — the scroll is the single source of truth, so the deck and
 *    the scrollbar can never disagree about where the reader is. Smooth
 *    scrolling deals through the slides in between, which is what the reader's
 *    own flick does too.
 *
 * Reduced motion returns before anything is wired: the flatten block in
 * pages.css has already collapsed the track and stood all four panels up as a
 * list, so there is no deck left to drive.
 */
export function initShowcase(): void {
  const root = document.querySelector<HTMLElement>("[data-showcase]");
  if (!root) return;
  const track = root.closest<HTMLElement>(".pswstg");

  const tabs = Array.from(root.querySelectorAll<HTMLButtonElement>(".pshow-tab"));
  const slides = Array.from(root.querySelectorAll<HTMLElement>(".pshow-slide"));
  const fill = root.querySelector<HTMLElement>(".pshow-fill");
  const bar = root.querySelector<HTMLElement>(".pshow-bar");
  if (!track || tabs.length < 2 || tabs.length !== slides.length) return;

  if (reduced()) return;

  /* The same tiling the advantages stage uses: a short lead-in while the header
     is still square in the reader's eye, then the slides split the rest of the
     track evenly. Derived, not typed, so a fifth workload is one array entry in
     index.astro and nothing here. */
  const INTRO = 0.07;
  const STEP = (1 - INTRO) / slides.length;

  let i = slides.findIndex((s) => s.classList.contains("is-on"));
  if (i < 0) i = 0;

  /* Both axes, every time. The rail is a column above 900px and a grid of
     labels above the stage below it, and which of the four properties the bar
     actually uses is the stylesheet's business — publishing all four means the
     breakpoint needs no JavaScript to know about it. */
  const placeBar = () => {
    const t = tabs[i];
    if (!bar || !t) return;
    bar.style.setProperty("--bar-y", `${t.offsetTop}px`);
    bar.style.setProperty("--bar-h", `${t.offsetHeight}px`);
    bar.style.setProperty("--bar-x", `${t.offsetLeft}px`);
    bar.style.setProperty("--bar-w", `${t.offsetWidth}px`);
  };

  /* No aria-hidden and no link-tabindex juggling here any more: the slides are
     hidden with `visibility` in the stylesheet, which takes the unseen cards
     out of the tab order and the accessibility tree without a script having to
     keep two attributes in step — and without baking into the markup a state
     that is wrong for every reader the flatten block serves. */
  const show = (n: number, dir: number) => {
    i = Math.max(0, Math.min(slides.length - 1, n));
    /* The direction of travel, so the outgoing panel leaves the way the incoming
       one arrives from. Set on the root rather than per slide: one attribute
       read by both halves of the transition keeps them from disagreeing. */
    root.dataset.dir = dir < 0 ? "back" : "fwd";
    slides.forEach((s, k) => s.classList.toggle("is-on", k === i));
    tabs.forEach((t, k) => {
      const on = k === i;
      t.classList.toggle("is-on", on);
      t.setAttribute("aria-selected", on ? "true" : "false");
      t.tabIndex = on ? 0 : -1;
    });
    placeBar();
  };

  /* ---- the scrub ---- */
  let queued = false;
  const frame = () => {
    queued = false;
    const vh = window.innerHeight || 1;
    const r = track.getBoundingClientRect();
    if (r.bottom < -vh || r.top > vh * 2) return; // far off screen, nothing to move
    /* The travel available to a sticky child is the track minus the one screen
       the child occupies — the same arithmetic as every other track, and for
       the same reason: dividing by the track height would leave the last
       screen of scroll advancing nothing. */
    const span = Math.max(1, track.offsetHeight - vh);
    const p = Math.min(1, Math.max(0, -r.top / span));
    track.style.setProperty("--psw-p", p.toFixed(4));

    /* The LAST slide whose threshold has passed — the slices tile the track, so
       the highest passed threshold is the slide the reader is on, and starting
       at 0 keeps slide 1 up through the lead-in. */
    let live = 0;
    for (let k = 1; k < slides.length; k++) {
      if (p >= INTRO + k * STEP) live = k;
    }
    if (live !== i) show(live, live > i ? 1 : -1);

    /* The fill is the live slide's own share of the track, scrubbed both ways —
       the same number that decides when to advance, so the bar can never finish
       early or late. Before the lead-in ends it clamps to 0, which reads as
       "slide one has not started spending yet" and is true. */
    const within = Math.min(1, Math.max(0, (p - INTRO - i * STEP) / STEP));
    if (fill) fill.style.setProperty("--fill", within.toFixed(4));
  };
  const request = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(frame);
  };

  /* ---- wiring ---- */
  /* Land a hair inside the slice rather than on its boundary: the boundary is
     the exact scroll position where two slides trade the stage, and sub-pixel
     rounding must not be what decides which side of it the reader ends up on. */
  const goTo = (k: number) => {
    const vh = window.innerHeight || 1;
    const r = track.getBoundingClientRect();
    const span = Math.max(1, track.offsetHeight - vh);
    const target = window.scrollY + r.top + span * (INTRO + k * STEP + STEP * 0.04);
    window.scrollTo({ top: target, behavior: "smooth" });
  };

  tabs.forEach((t, k) => t.addEventListener("click", () => goTo(k)));

  /* Arrow keys move between the labels the way a tablist is expected to, and
     move the page with them — the label and the panel are one control here, so
     splitting selection from focus would leave the bar somewhere the reader is
     not. Clamped rather than wrapped: the track has ends, and "down from the
     last slide" means leaving the section, which is the scroll's job. */
  root.querySelector(".pshow-tabs")?.addEventListener("keydown", (ev) => {
    const e = ev as KeyboardEvent;
    const d = e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : e.key === "ArrowUp" || e.key === "ArrowLeft" ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const n = Math.max(0, Math.min(slides.length - 1, i + d));
    if (n === i) return;
    goTo(n);
    /* focus() works on a tabindex="-1" element; the roving tabindex itself
       catches up when the scroll crosses the threshold and show() fires. */
    tabs[n].focus();
  });

  window.addEventListener("scroll", request, { passive: true });
  window.addEventListener("resize", () => {
    placeBar();
    request();
  }, { passive: true });
  /* The rail's labels are text, so they reflow when a webfont lands — and the
     bar was measured against the fallback metrics. One re-measure after the
     fonts settle costs nothing and fixes an off-by-a-few-pixels bar that is
     otherwise only visible on a cold load. */
  document.fonts?.ready.then(placeBar).catch(() => {});

  show(i, 1);
  frame();
}

/* ----------------------------------------------------------------- backdrop */
