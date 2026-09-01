/* Vendor toggling on the Trust Center security matrix.
 *
 * ── WHY THIS HIDES RATHER THAN RE-RENDERS ────────────────────────────────────
 * The compare hub's picker used to rebuild its table from the data on every
 * click, which meant that page served no table at all until script ran. On
 * 15 Aug 2026 it was converted to this file's approach. The argument of the
 * Trust Center matrix — and now of the hub's — is that 140
 * sourced statements about fifteen vendors are RETRIEVABLE — and a table that
 * exists only after a click is not retrievable by a scraper, an answer engine, a
 * printout, or a reader with script disabled. So the full table is in the served
 * HTML, every column, every citation, and this file only sets a class.
 *
 * The practical consequence is worth stating: with script off you get all
 * fifteen columns and no picker, which is the correct degradation. With script
 * on you get a fourteen-column table you can cut down to the three vendors
 * actually on your shortlist, which is what makes it usable in a real
 * evaluation.
 *
 * ── WHY "JUST POLARIS" AND NOT "CLEAR" ───────────────────────────────────────
 * The Polaris column is never toggleable. Hiding every column including ours
 * would leave a table of row labels, which is not a state anyone wants; and
 * naming the empty state "Just Polaris" describes what you actually get.
 *
 * ── STATE ────────────────────────────────────────────────────────────────────
 * Selection is remembered in localStorage, because a security reviewer comparing
 * three vendors will leave and come back to this page several times over an
 * evaluation and re-ticking eleven boxes each time is a small insult. The key is
 * versioned so a change to the brand list cannot resurrect a stale index set.
 */
const KEY = "polaris.secpick.v1";

function cells(root: Document | HTMLElement): NodeListOf<HTMLElement> {
  return root.querySelectorAll<HTMLElement>("#sectable .cb");
}

function apply(on: Set<number>, count: number) {
  cells(document).forEach((el) => {
    const m = /(?:^|\s)cb-(\d+)(?:\s|$)/.exec(el.className);
    if (!m) return;
    el.classList.toggle("cbhide", !on.has(Number(m[1])));
  });
  document.querySelectorAll<HTMLButtonElement>("[data-sec]").forEach((b) => {
    const k = b.dataset.sec;
    const state =
      k === "all" ? on.size === count : k === "none" ? on.size === 0 : on.has(Number(k));
    b.classList.toggle("on", state);
    b.setAttribute("aria-pressed", state ? "true" : "false");
  });
  try {
    localStorage.setItem(KEY, JSON.stringify([...on]));
  } catch {
    /* private browsing, storage disabled, quota — none of which should break a
       table. The selection simply does not survive the next visit. */
  }
}

export function initSecPick() {
  const table = document.getElementById("sectable");
  if (!table) return;

  const count = new Set(
    [...table.querySelectorAll<HTMLElement>("th.cb")].map((el) =>
      Number(/(?:^|\s)cb-(\d+)/.exec(el.className)?.[1] ?? -1)
    )
  ).size;
  if (!count) return;

  let on = new Set<number>(Array.from({ length: count }, (_, i) => i));
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || "null");
    /* Only trust a stored selection that still fits the current brand list. If
       the matrix gains or loses a vendor, the stored indices mean something
       different and the safe answer is everyone. */
    if (Array.isArray(saved) && saved.every((n) => Number.isInteger(n) && n >= 0 && n < count)) {
      on = new Set<number>(saved);
    }
  } catch {
    /* ignore */
  }
  apply(on, count);

  document.querySelectorAll<HTMLButtonElement>("[data-sec]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const k = btn.dataset.sec;
      if (k === "all") on = new Set(Array.from({ length: count }, (_, i) => i));
      else if (k === "none") on = new Set();
      else {
        const i = Number(k);
        on.has(i) ? on.delete(i) : on.add(i);
      }
      apply(on, count);
    });
  });
}
