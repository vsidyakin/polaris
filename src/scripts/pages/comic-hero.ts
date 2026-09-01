/**
 * The comic-book split hero on /products/family (.cbk — see pages.css).
 *
 * Two product films play side by side in that hero, which is two more than any
 * other page above the fold. So neither one is in the markup as a `src`: both
 * carry `data-src` and nothing starts downloading until the hero is actually on
 * screen, and both pause again when it leaves. On a visitor who lands and scrolls
 * straight to the capability matrix that is roughly 5.5 MB never fetched.
 *
 * Deliberately NOT the same shape as initVideoHero(). That one has a single film
 * that is the entire first screen, so it is in the markup, autoplaying, and the
 * script's whole job is to pick the wide encode before the small one finishes.
 * Here the films are decoration inside three panels that each read perfectly well
 * as a still, so the trade runs the other way: cost nothing until seen.
 *
 * It also differs on who applies the deploy base — see `attach` below. That one
 * is not a preference either.
 *
 * Reduced motion gets the first frame and no movement — the src is still attached,
 * because a panel with no picture at all is worse than a still one.
 */
export function initComicHero(): void {
  const hero = document.querySelector<HTMLElement>(".cbk");
  if (!hero) return;

  const vids = Array.from(hero.querySelectorAll<HTMLVideoElement>(".cbk-vid[data-src]"));
  if (!vids.length) return;

  const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* Copied across verbatim, NOT put through withBase().
   *
   * `data-src` is a literal root-absolute path in the page's markup, so by the
   * rule in CLAUDE.md ("The base-path split") it belongs to rebase-html.mjs,
   * which rewrites it in dist/ alongside every href and src on the site. It is
   * named in that script's ATTRS list for exactly this reason. By the time this
   * runs, the attribute already carries the deploy base.
   *
   * This used to call withBase(), and on a real Pages build the base went on
   * twice and both films 404'd — the bug that took the hero videos off the
   * preview. Do not reintroduce it: if the base is ever missing here, the fault
   * is a missing entry in ATTRS, not a missing call. Reach for withBase() only
   * for a path this file BUILDS, which none of these are. */
  const attach = (v: HTMLVideoElement) => {
    if (v.getAttribute("src")) return;
    const s = v.dataset.src;
    if (!s) return;
    v.src = s;
    v.load();
  };

  const enter = () =>
    vids.forEach((v) => {
      attach(v);
      /* play() rejects if the tab is backgrounded or the decode is refused.
         Nothing to do about either, and an unhandled rejection in the console
         is worse than a still frame. */
      if (!still) void v.play().catch(() => {});
    });
  const leave = () => vids.forEach((v) => v.pause());

  if (!("IntersectionObserver" in window)) {
    enter();
    return;
  }

  /* Not unobserved after the first hit, unlike initReveal(): the point is the
     pause on the way out as much as the load on the way in. The margin starts
     the fetch just before the hero is reached rather than as it arrives. */
  new IntersectionObserver(
    (entries) => entries.forEach((e) => (e.isIntersecting ? enter() : leave())),
    { rootMargin: "250px 0px" }
  ).observe(hero);
}
