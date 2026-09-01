/* Paired expansion for the Trust Center architecture panels (B5.1).
 *
 * The panels sit in a two-column grid with align-items:stretch, so the two cards in a
 * row always share the taller one's height. That is right when both are in the same
 * state and wrong the moment they are not: open one and its partner stretches to match,
 * producing a tall empty card beside a full one. Equal heights and independent toggles
 * are simply incompatible.
 *
 * So the row is the unit, not the card. Opening either panel opens its partner and
 * closing either closes it, which means a row is only ever short-and-short or
 * tall-and-tall and the height rule never has to fake anything.
 *
 * Rows stay independent of each other: CSS grid sizes each row to its own content, so
 * the second row is exactly as tall as the second row's language needs and no taller.
 * That is the point of pairing within a row rather than syncing the whole section.
 *
 * The full-width panel at the foot has no partner and is left to itself.
 *
 * Progressive enhancement: with no script the panels are ordinary <details> elements
 * that open and close one at a time. The only thing lost is the pairing.
 */
export function initSecPanels() {
  const grid = document.querySelector<HTMLElement>(".sec-grid");
  if (!grid) return;

  /* Only the paired cards; the .sec-wide foot panel spans both columns and is excluded. */
  const panels = Array.from(
    grid.querySelectorAll<HTMLDetailsElement>("details.sec-acc:not(.sec-wide)")
  );

  /* Two per row, in document order. Pairing by index rather than by geometry because
     getBoundingClientRect during a toggle reads a layout that is mid-change, and because
     the single-column layout below 900px should not pair at all — there, each card is
     its own row and forcing a partner open would expand something off screen. */
  const pairOf = new Map<HTMLDetailsElement, HTMLDetailsElement>();
  for (let i = 0; i + 1 < panels.length; i += 2) {
    pairOf.set(panels[i], panels[i + 1]);
    pairOf.set(panels[i + 1], panels[i]);
  }

  const singleColumn = () => !matchMedia("(min-width: 901px)").matches;

  /* Guard against the echo: setting partner.open fires the partner's own toggle event,
     which would come straight back here and set this one again. */
  let syncing = false;

  for (const panel of panels) {
    panel.addEventListener("toggle", () => {
      if (syncing || singleColumn()) return;
      const partner = pairOf.get(panel);
      if (!partner || partner.open === panel.open) return;
      syncing = true;
      partner.open = panel.open;
      syncing = false;
    });
  }
}
