import { withBase } from "../../lib/base";

/**
 * Full-page hero video (.vhero — see pages.css).
 *
 * The hero is pulled up under the sticky site header so the nav floats over the
 * first frame, which means the pull has to equal the header's ACTUAL height.
 * That height is not a constant: the nav row wraps below 980px and collapses to
 * a burger below 640px. So it is measured here and republished as --hdr-h, which
 * both the pull-up and the breadcrumb's offset are written against.
 *
 * The one trap is the phone menu. Opening the burger adds `.mnav` to the header
 * and turns it into a full-height scrolling panel; measuring that would yank the
 * video most of a screen upward. Measurements are skipped while it is open, and
 * the observer fires again when it closes.
 */
export function initVideoHero(): void {
  const hero = document.querySelector<HTMLElement>(".vhero");
  if (!hero) return;

  /* The desktop encode, chosen first and before anything else in here, because
     the fetch of the small file in `src` is already in flight and every
     millisecond spent above this line is bandwidth spent on a file that is
     about to be thrown away. See the note in the page's markup for why the
     pick is not `<source media>`.

     900px is the width the .vhero gutter already changes at, so the film and
     its frame step up together. Reduced motion is not consulted here: that
     visitor still sees a first frame, and the still deserves to be the good
     one. */
  const wide = hero.querySelector<HTMLVideoElement>(".vhero-vid[data-src-wide]");
  const wideSrc = wide?.dataset.srcWide;
  if (wide && wideSrc && window.matchMedia("(min-width: 900px)").matches) {
    /* Computed, not a literal in markup: rebase-html.mjs rewrites `src` in
       dist/, but it has never heard of data-src-wide. */
    wide.src = withBase(wideSrc);
  }

  const header = document.querySelector<HTMLElement>(".site-header");
  if (header) {
    const publish = () => {
      if (header.classList.contains("mnav")) return; // open panel, not the bar
      const h = Math.round(header.getBoundingClientRect().height);
      /* On the root, not on the hero: the scroll stage further down the page
         pads itself past the nav using the same value. */
      if (h > 0) document.documentElement.style.setProperty("--hdr-h", `${h}px`);
    };
    publish();
    if (typeof ResizeObserver === "function") new ResizeObserver(publish).observe(header);
    else window.addEventListener("resize", publish);
  }

  /* Autoplaying film is motion nobody asked for. Reduced-motion visitors get the
     first frame and nothing moving; the attribute goes too, so a browser that
     has not started playback yet does not start. */
  const vid = hero.querySelector<HTMLVideoElement>(".vhero-vid");
  if (vid && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    vid.removeAttribute("autoplay");
    vid.autoplay = false;
    vid.pause();
  }
}
