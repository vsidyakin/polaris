/**
 * The capability cards on /products/pro: the cursor spotlight and the tilt.
 *
 * Everything else those cards do — the staged fly-in, the sheen, the rotating
 * border, the hover lift — is CSS, and works with this file absent. What needs a
 * script is the two effects that depend on where the pointer actually is:
 *
 *   --capx-mx / --capx-my   the pointer, in per-cent of the card, which the
 *                           stylesheet uses as the centre of a radial highlight
 *   --capx-rx / --capx-ry   a few degrees of tilt away from the pointer
 *
 * Four properties, no layout written, no class toggled: the card's own transform
 * rule composes the tilt with the hover lift, so the two never fight.
 *
 * It does nothing at all on a touch screen or under prefers-reduced-motion. A
 * spotlight that tracks a finger is a smear that lands wherever the last tap
 * was, and a card that leans is exactly the motion the query is asking us not to
 * make — in both cases the resting state is the finished card, so declining to
 * run is the whole accommodation.
 *
 * One rAF for the whole grid, and the rect is read inside it rather than in the
 * pointermove handler, so a pointer moving across a card during a scroll cannot
 * force a second layout per event.
 */

const MAX_TILT = 3.2; // degrees at the corner — past ~4 it reads as a gimmick

export function initCapCards(): void {
  const cards = Array.from(document.querySelectorAll<HTMLElement>(".capx"));
  if (!cards.length) return;
  if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  let pending: { el: HTMLElement; x: number; y: number } | null = null;
  let queued = 0;

  const write = () => {
    queued = 0;
    const p = pending;
    if (!p) return;
    const r = p.el.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const fx = (p.x - r.left) / r.width; // 0 at the left edge … 1 at the right
    const fy = (p.y - r.top) / r.height;
    const s = p.el.style;
    s.setProperty("--capx-mx", (fx * 100).toFixed(1) + "%");
    s.setProperty("--capx-my", (fy * 100).toFixed(1) + "%");
    /* Away from the pointer on one axis and toward it on the other: that pairing
       is what reads as a solid panel being pushed, rather than as an image being
       skewed. */
    s.setProperty("--capx-ry", ((fx - 0.5) * 2 * MAX_TILT).toFixed(2) + "deg");
    s.setProperty("--capx-rx", ((0.5 - fy) * 2 * MAX_TILT).toFixed(2) + "deg");
  };

  for (const el of cards) {
    el.addEventListener(
      "pointermove",
      (e) => {
        pending = { el, x: e.clientX, y: e.clientY };
        if (!queued) queued = requestAnimationFrame(write);
      },
      { passive: true }
    );
    /* Leaving returns the tilt to flat through the card's own transition; the
       spotlight centre is left where it was, because it has already faded out
       with the hover and moving it would be a visible jump on the way back in. */
    el.addEventListener("pointerleave", () => {
      if (pending?.el === el) pending = null;
      el.style.setProperty("--capx-rx", "0deg");
      el.style.setProperty("--capx-ry", "0deg");
    });
  }
}
