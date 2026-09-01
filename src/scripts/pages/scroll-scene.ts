/**
 * The scroll choreography on /products/pro: the film leaves, the page arrives.
 *
 * Three jobs, one rAF-throttled scroll listener, and nothing written to the DOM
 * except custom properties and one class — every value here lands on `transform`
 * or `opacity`, so the browser can run the whole scene on the compositor without
 * a layout pass. Anything that touched `top` or `height` per frame would drop
 * frames on a full-screen video.
 *
 *  1. --vh-p, the hero's own exit progress: 0 at rest, 1 when the hero has
 *     scrolled fully past. The stylesheet does the rest — the film drifts down
 *     and scales as it fades, the title card leaves upward and about twice as
 *     fast, which is the whole parallax: two planes, different speeds.
 *  2. --pfx-y on drift elements, from their distance off the centre of the
 *     viewport, so a product shot moves against its own page as it passes.
 *  3. .pfx-in on the staged blocks, once, as each enters view.
 *
 * The site already has .reveal for (3) and it stays the default — this is the
 * one page that wants a stagger the sitewide reveal deliberately does not do.
 * The two never touch the same element: .reveal owns the block, .pfx owns
 * elements that carry no reveal of their own.
 *
 * prefers-reduced-motion turns off 1 and 2 entirely and makes 3 immediate,
 * which is why every parallax value is written as `calc(… var(--vh-p, 0) …)`:
 * with the properties never set, the calc collapses to the resting state and no
 * second set of rules is needed to undo anything.
 */

const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function initScrollScene(): void {
  const hero = document.querySelector<HTMLElement>(".vhero");

  /* The drift below is a general hook: put `data-drift="34"` and .pfx-drift on
     anything that should move against the page as it passes, and the number is
     the travel in pixels. It used to be attached here, automatically, to the
     product figure from mediaBandHtml() — that figure has since been replaced by
     the animated headline, so nothing on this page claims it today. The loop
     costs nothing with an empty list and the primitive is worth keeping; an
     element that carries its own transform (anything with .reveal) is the one
     thing it must not be pointed at. */

  /* ---- staged entrances ---- */
  const staged = Array.from(document.querySelectorAll<HTMLElement>(".pfx"));
  if (staged.length) {
    if (reduced() || !("IntersectionObserver" in window)) {
      staged.forEach((el) => el.classList.add("pfx-in"));
    } else {
      const io = new IntersectionObserver(
        (entries) =>
          entries.forEach((e) => {
            if (!e.isIntersecting) return;
            e.target.classList.add("pfx-in");
            io.unobserve(e.target);
          }),
        /* Pulled 12% off the bottom edge so a block starts moving once it is
           properly in the window rather than the instant its first pixel is —
           the same reasoning as initReveal's -60px, expressed as a share of the
           viewport because these blocks are further apart. */
        { rootMargin: "0px 0px -12% 0px", threshold: 0 }
      );
      staged.forEach((el) => io.observe(el));
      /* Anything already on screen at load arrives immediately; an observer
         callback a frame later is a visible flash of empty page. */
      requestAnimationFrame(() =>
        staged.forEach((el) => {
          const r = el.getBoundingClientRect();
          if (r.top < window.innerHeight && r.bottom > 0) el.classList.add("pfx-in");
        })
      );
    }
  }

  /* ---- the pinned stage ---- */
  const stage = document.querySelector<HTMLElement>(".stg");
  const frames = stage ? Array.from(stage.querySelectorAll<HTMLImageElement>(".stg-frame")) : [];
  const marks = stage ? Array.from(stage.querySelectorAll<HTMLElement>("[data-at]")) : [];
  let shown = 0; // frame 1 carries .on from the server, so this starts truthful
  let warmed = false;

  /* The twenty frames are lazy in the markup, which is right for a section two
     screens below the fold and wrong the moment it is about to be scrubbed: a
     lazy image begins loading when it nears the viewport, and "nears" is not a
     promise it will have decoded before the pin catches. So they are promoted to
     eager one viewport early, together, and decoded off the main thread. Doing
     it in markup instead would put 1.3 MB in front of the hero video. */
  const warm = () => {
    if (warmed) return;
    warmed = true;
    frames.forEach((img) => {
      img.loading = "eager";
      img.decode?.().catch(() => {});
    });
  };

  /* ---- the scrolling half ---- */
  const drifts = Array.from(document.querySelectorAll<HTMLElement>("[data-drift]"));
  if (reduced() || (!hero && !drifts.length && !stage)) {
    /* Reduced motion still needs the stage readable: the stylesheet flattens the
       track and shows the last frame, and every row is simply present. */
    if (reduced()) marks.forEach((el) => el.classList.add("on"));
    return;
  }

  let queued = false;
  const frame = () => {
    queued = false;
    const vh = window.innerHeight || 1;

    if (hero) {
      /* Measured from the hero's own box, not from scrollY: the review banner
         above the header is real height that would otherwise offset the whole
         curve, and it is a temporary element nobody will remember to account
         for when it goes. */
      const r = hero.getBoundingClientRect();
      const h = hero.offsetHeight || 1;
      const p = Math.min(1, Math.max(0, -r.top / h));
      hero.style.setProperty("--vh-p", p.toFixed(4));
    }

    if (stage) {
      const r = stage.getBoundingClientRect();
      /* The travel available to a sticky child is the track minus the one
         screen the child occupies. Dividing by the track height instead would
         mean the last screen of scroll never advances anything, and the section
         would appear to freeze before it released. */
      const span = Math.max(1, stage.offsetHeight - vh);
      const p = Math.min(1, Math.max(0, -r.top / span));
      stage.style.setProperty("--stg-p", p.toFixed(4));

      /* Three overlapping phases, normalised so the stylesheet gets plain 0-to-1
         numbers and no page geometry. Keep them here, not in CSS: the phase
         boundaries are choreography, and choreography is easier to read as
         arithmetic than as six nested clamps. */
      const a = Math.min(1, p / 0.3); // zoom scrub, and the figure fading in
      const b = Math.min(1, Math.max(0, (p - 0.34) / 0.16)); // the move left
      stage.style.setProperty("--stg-a", a.toFixed(4));
      stage.style.setProperty("--stg-b", b.toFixed(4));

      if (r.top < vh * 2 && r.bottom > -vh) warm();

      if (frames.length) {
        const i = Math.min(frames.length - 1, Math.max(0, Math.floor(a * frames.length)));
        if (i !== shown) {
          frames[shown]?.classList.remove("on");
          frames[i].classList.add("on");
          shown = i;
        }
      }
      /* toggle(force) both ways on purpose — scrolling back up plays the rows
         out again, which is the half of "in and out" a latch would lose. */
      for (const el of marks) el.classList.toggle("on", p >= Number(el.dataset.at));
    }

    for (const el of drifts) {
      const r = el.getBoundingClientRect();
      if (r.bottom < -240 || r.top > vh + 240) continue; // off screen, nothing to move
      const off = (r.top + r.height / 2 - vh / 2) / vh; // -0.5 above centre … +0.5 below
      const range = Number(el.dataset.drift) || 30;
      el.style.setProperty("--pfx-y", `${(-off * range).toFixed(1)}px`);
    }
  };
  const request = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(frame);
  };

  window.addEventListener("scroll", request, { passive: true });
  window.addEventListener("resize", request, { passive: true });
  frame();
}
