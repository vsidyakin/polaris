/* Hover/focus/click cards on comparison-matrix cells.
 *
 * Extracted from scripts/pages/compare.ts so the Trust Center can carry the same
 * sourced cards on its own security matrix without importing the whole compare
 * page script. Since 15 Aug 2026 both pages' tables are rendered at build time by
 * src/lib/matrix.ts and the page scripts only toggle columns, so this file is now
 * the one piece of behaviour every matrix needs and the only reason a matrix page
 * loads script at all. Nothing here creates cells; it places the card over one
 * that is already in the HTML.
 *
 * The card is position:fixed rather than absolute, because the matrices live in
 * horizontally scrolling panes whose edges clip anything positioned inside them —
 * a card on the furthest column was being cut in half. Fixed means script has to
 * place it: anchored BELOW the cell so it lands on the table rather than above it,
 * flipped up only when the last rows run out of room, and clamped to the viewport
 * so the last column does not push it off the right edge.
 *
 * ── PINNING, added 14 Aug 2026 ───────────────────────────────────────────────
 * Every cell now carries a link to the source document it was graded from.
 * A hover card cannot hold a link: the moment the pointer leaves the cell to
 * travel to the anchor, the card disappears. So a click PINS the card open —
 * it gains pointer events, stays put, and the reader can click through to the
 * vendor's own page. Escape, a click elsewhere, or scrolling the pane closes it.
 *
 * Hover still previews, because a reader skimming fifteen columns should not
 * have to click fifteen times to read the reasoning. Click is the escalation.
 *
 * Touch has no hover at all, which is the other half of the reason: before this,
 * every source on this table was unreachable on a phone or tablet.
 *
 * Delegated on document, so it works for tables rendered by script after load
 * (the compare hub re-renders on every brand toggle) and for tables rendered at
 * build time (the Trust Center's, which is static HTML). Idempotent: calling it
 * twice does not double-bind.
 */
let bound = false;
let pinned: HTMLElement | null = null;

function place(cell: HTMLElement) {
  const card = cell.querySelector<HTMLElement>(".pwc");
  if (!card) return;
  const r = cell.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const pad = 8;
  const gap = 7;

  /* THE CARD MUST TOUCH ITS CELL.
   *
   * Two rounds of this were wrong in the same way: the placement was computed
   * from the cell, then clamped to the viewport, and the clamp was allowed to win.
   * On the outer columns and the top row that pushed the card clear of the cell it
   * belonged to — a floating panel with no visible relationship to anything, half
   * of it off screen. A card that does not touch its cell is not a tooltip, it is
   * a bug with text in it.
   *
   * So contact is the constraint that wins and the viewport is what bends. The
   * card is sized to the space available first, then anchored so it always shares
   * an edge with the cell.
   */

  /* 1. Measure the card at its natural size FIRST.
   *
   *    The previous version capped the height to whatever gap was left between the
   *    cell and the edge of the screen, with a floor of 96px, and turned on
   *    overflow. Most cells in a 74vh scrolling pane sit low in the viewport, so
   *    most cards were being squeezed to a few lines with the rest scrolled out of
   *    sight — and what is at the bottom of every card is the source link. Damian,
   *    15 Aug 2026: "we didn't include the sources of our deep competitor
   *    analysis in the menus". They were included. They were being cropped.
   *
   *    So: measure unconstrained, then choose a position that fits the WHOLE card
   *    if the viewport can hold it at all. */
  card.style.maxHeight = "";
  card.style.overflowY = "";
  const w = card.offsetWidth || 340;
  const nat = card.offsetHeight || 120;

  const roomBelow = vh - r.bottom - gap - pad;
  const roomAbove = r.top - gap - pad;

  /* 2. Vertical. Below the cell if it fits, above if that fits, and if neither
   *    does, let the card OVERLAP the table rather than shrink. Covering a few
   *    rows is recoverable — the reader moves the pointer. A citation cropped out
   *    of the bottom of a 96px box is not: nothing tells them it was there. */
  let top: number;
  let maxH = nat;
  if (nat <= roomBelow) {
    top = r.bottom + gap;
  } else if (nat <= roomAbove) {
    top = r.top - nat - gap;
  } else {
    maxH = Math.min(nat, vh - 2 * pad);
    top = Math.max(pad, Math.min(vh - maxH - pad, r.bottom + gap));
  }
  card.style.maxHeight = `${Math.round(maxH)}px`;
  card.style.overflowY = nat > maxH ? "auto" : "";

  /* 3. Horizontal: centred on the cell, then clamped so the card still OVERLAPS
   *    the cell horizontally, then clamped to the viewport. The overlap clamp is
   *    applied first and the viewport clamp second, but the overlap range is
   *    intersected with the viewport range rather than overwritten — so on the
   *    first and last columns the card hugs the screen edge while still sitting
   *    under its own cell. `keep` is how much of the card must overlap the cell:
   *    a corner touch is technically contact and reads as a mistake, so it is a
   *    third of the cell or 28px, whichever is smaller. */
  const keep = Math.min(28, r.width / 3);
  const overlapMin = r.left - w + keep;   // card's right edge inside the cell
  const overlapMax = r.right - keep;      // card's left edge inside the cell
  const viewMin = pad;
  const viewMax = Math.max(pad, vw - w - pad);

  let left = r.left + r.width / 2 - w / 2;
  left = Math.max(overlapMin, Math.min(overlapMax, left));
  left = Math.max(viewMin, Math.min(viewMax, left));
  /* If the viewport clamp broke contact — only possible when the card is wider
     than the screen allows — put contact back and accept the edge. */
  if (left > overlapMax) left = overlapMax;
  if (left + w < r.left + keep) left = r.left + keep - w;

  card.style.left = `${Math.round(left)}px`;
  card.style.top = `${Math.round(top)}px`;

  /* 4. CORRECTION PASS — belt and braces against the bug in §the CSS comment on
   *    .reveal:has(.cmpscroll).
   *
   *    Everything above is computed in viewport coordinates and assumes `fixed`
   *    means fixed to the viewport. It does not, if any ancestor has a transform,
   *    translate, rotate, scale, filter, perspective, backdrop-filter, contain or
   *    will-change — then that ancestor becomes the containing block and every
   *    number above is offset by its origin. That is what put these cards off the
   *    table for three rounds while the maths was being blamed.
   *
   *    The stylesheet now prevents the known case. This measures the result and
   *    corrects whatever is left, so a future ancestor cannot silently move the
   *    cards again. One extra reflow, on hover of a single cell.
   *
   *    It cannot fix CLIPPING — a fixed element inside a containing block is
   *    cropped by the scrolling ancestors between them, and no amount of
   *    arithmetic reaches that. That is why the CSS fix exists as well, and why
   *    scripts/check-static-evidence.py fails the build if it is removed. */
  const got = card.getBoundingClientRect();
  const dx = left - got.left;
  const dy = top - got.top;
  if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
    card.style.left = `${Math.round(left + dx)}px`;
    card.style.top = `${Math.round(top + dy)}px`;
  }
}

function unpin() {
  if (!pinned) return;
  pinned.classList.remove("pwpin");
  pinned.removeAttribute("aria-expanded");
  pinned = null;
}

function pin(cell: HTMLElement) {
  if (pinned === cell) return unpin();
  unpin();
  pinned = cell;
  cell.classList.add("pwpin");
  cell.setAttribute("aria-expanded", "true");
  place(cell);
}

export function initPwCards() {
  if (bound) return;
  bound = true;

  const hit = (e: Event) => {
    const cell = (e.target as HTMLElement)?.closest?.(".pw") as HTMLElement | null;
    if (cell) place(cell);
  };
  document.addEventListener("mouseover", hit, { passive: true });
  document.addEventListener("focusin", hit);

  document.addEventListener("click", (e) => {
    const t = e.target as HTMLElement;
    /* A click on the source link itself must be allowed to navigate — closing the
       card first would cancel the very thing the card exists for. */
    if (t?.closest?.(".pwc")) return;
    const cell = t?.closest?.(".pw") as HTMLElement | null;
    if (cell) {
      e.preventDefault();
      pin(cell);
    } else {
      unpin();
    }
  });

  /* Enter and Space on a focused cell, so a keyboard reader can reach the source
     too. The cell is already tabindex=0 for the aria-label. */
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") return unpin();
    if (e.key !== "Enter" && e.key !== " ") return;
    const cell = (e.target as HTMLElement)?.closest?.(".pw") as HTMLElement | null;
    if (!cell) return;
    e.preventDefault();
    pin(cell);
  });

  /* A pinned card is position:fixed against a cell that moves when the pane or
     the page scrolls. Re-place it rather than let it drift off its cell. */
  const follow = () => {
    if (pinned) place(pinned);
  };
  window.addEventListener("scroll", follow, { passive: true, capture: true });
  window.addEventListener("resize", follow, { passive: true });
}
