// @ts-nocheck
/* eslint-disable */
/* The compare hub's controls. NOT its tables.
 *
 * ── WHAT CHANGED, 15 Aug 2026 ────────────────────────────────────────────────
 * This file used to BUILD both matrices in the browser and write them into two
 * empty divs. That meant the page carrying the larger body of competitor
 * evidence — 706 sourced cells — served zero of it in its HTML: 0 <td>, 0 source
 * links, two empty divs, while the Trust Center next door served 160 cells and
 * 140 citations. Everything we spent three research waves making citable was
 * citable only to a reader whose browser ran our JavaScript.
 *
 * The tables are now emitted at build time by src/lib/matrix.ts, the same
 * renderer the Trust Center uses. This file does what secpick.ts does for the
 * Trust Center: it hides columns with a class. Nothing here decides what the
 * page publishes, and if this file fails to load the reader still gets every
 * column and every citation — which is the correct degradation for a table whose
 * whole argument is that evidence should be retrievable.
 *
 * ── ONE PICKER, TWO TABLES ───────────────────────────────────────────────────
 * The headline table carries fourteen vendors and the deep table eight. Both tag
 * their columns with the vendor's index into COMP.brands, not with their own
 * column position, so a single click governs both and cannot hide the wrong
 * column in the narrower table.
 *
 * The deep table keeps its old fallback: if nothing ticked appears in it at all,
 * show all eight rather than a table of row labels. Ticking Cisco — which the
 * deep table does not carry — should not blank an unrelated table.
 */
import { COMP, MDNA } from "../../data/compare";
import { DEEP_BRANDS } from "../../lib/matrix";
import { initPwCards } from "../pwcard";

const ALL = COMP.brands.length;
const everyone = () => COMP.brands.map((_, i) => i);
const DEEP_IDX = DEEP_BRANDS.map((b) => COMP.brands.indexOf(b)).filter((i) => i >= 0);

/* MDNA is keyed on the old brand strings. Two were renamed and six brands are
   new, so map the new names onto the panels that exist and let the rest fall
   through to no panel rather than silently rendering an empty box. */
const MDNA_KEY = {
  "WolfVision Cynap": "WolfVision",
  "Barco Hub": "Barco ClickShare",
  "Extron ShareLink Pro": "",
  "BenQ InstaShow": "",
  "Yealink RoomCast": "",
  "DisplayNote Montage": "",
  "Cisco Room Bar": "",
};

/* Selected brand indices into COMP.brands, held ascending. */
let selected: number[] = everyone();

/* Placement of the hover/pin cards lives in scripts/pwcard.ts, shared with the
   Trust Center. */
initPwCards();

function cmpGrpToggle(tr) {
  const closed = tr.classList.toggle("closed");
  let e = tr.nextElementSibling;
  while (e && !e.classList.contains("grp")) {
    e.style.display = closed ? "none" : "";
    e = e.nextElementSibling;
  }
}

/** Hide or show one table's columns. `on` is a set of COMP.brands indices. */
function paint(tableId: string, on: Set<number>) {
  const t = document.getElementById(tableId);
  if (!t) return;
  t.querySelectorAll<HTMLElement>(".cb").forEach((el) => {
    const m = /(?:^|\s)cb-(\d+)(?:\s|$)/.exec(el.className);
    if (!m) return;
    el.classList.toggle("cbhide", !on.has(Number(m[1])));
  });
}

/* Every button in the picker is a toggle, including the two aggregate ones:
   "Everyone" reads as pressed when everything is ticked, "Just Polaris" when
   nothing is, so the control never claims a state the table is not in. */
function compSync() {
  document.querySelectorAll<HTMLButtonElement>("[data-cmp]").forEach((btn) => {
    const k = btn.dataset.cmp;
    const on =
      k === "all"
        ? selected.length === ALL
        : k === "none"
          ? selected.length === 0
          : selected.indexOf(Number(k)) >= 0;
    btn.classList.toggle("on", on);
    btn.setAttribute("aria-pressed", on ? "true" : "false");
  });
}

function compSet(next) {
  selected = next.slice().sort((a, b) => a - b);
  compSync();
  const on = new Set<number>(selected);
  paint("cmptable", on);
  /* The deep table's own eight columns. If the selection touches none of them,
     show them all — the alternative is blanking a table the reader did not ask
     anything about. */
  const hit = DEEP_IDX.filter((i) => on.has(i));
  paint("dpttable", new Set<number>(hit.length ? hit : DEEP_IDX));
  mdna();
}

/** Add or remove one brand. */
function compToggle(i) {
  compSet(selected.indexOf(i) >= 0 ? selected.filter((k) => k !== i) : selected.concat(i));
}

/* Kept for the inline-handler contract the markup used to rely on: a negative
   index still means "everyone", any other index toggles that brand. */
function compSel(i) {
  if (i < 0) compSet(everyone());
  else compToggle(i);
}

/* "Our take" is written one brand at a time, and once across the whole field.
   Anything in between is a subset nobody wrote a narrative for, so the panel
   says which two views exist instead of showing a stale one.

   The all-brands panel is in the served HTML already — it is what a script-off
   reader gets and it matches the default selection. This only rewrites it when
   the reader narrows the field. */
function mdna() {
  const el = document.getElementById("mdna");
  if (!el) return;
  if (selected.length === ALL) {
    const a = MDNA._all;
    el.innerHTML = `<div class="mdna reveal vis"><h3>Our take</h3><p>${a.why}</p><div class="concede">${a.concede}</div></div>`;
  } else if (selected.length === 1) {
    const bn = COMP.brands[selected[0]];
    const mk = MDNA_KEY[bn] !== undefined ? MDNA_KEY[bn] : bn;
    const a = mk ? MDNA[mk] : null;
    /* Six of the fourteen brands have no written take yet. Say so, rather than
       leaving the previous brand's panel on screen next to the new columns. */
    if (a)
      el.innerHTML = `<div class="mdna reveal vis"><h3>Our take: Polaris vs ${bn}</h3><p>${a.why}</p><div class="concede">${a.concede}</div></div>`;
    else
      el.innerHTML = `<div class="mdna reveal vis"><h3>Our take: Polaris vs ${bn}</h3><p class="note">[Our take on ${bn} is not written yet. The matrix above is graded from ${bn}'s own documentation; the narrative panel is owed - product marketing.]</p></div>`;
  } else {
    const msg =
      selected.length === 0
        ? "Nothing is ticked, so the table shows Polaris on its own. Tick a brand to compare it, or Everyone for all " +
          ALL +
          "."
        : selected.length +
          " brands are ticked. Our take is written one brand at a time, and once across the whole field: tick a single brand for its panel, or Everyone for the read across all " +
          ALL +
          ".";
    el.innerHTML = `<div class="mdna reveal vis"><h3>Our take</h3><p class="note">${msg}</p></div>`;
  }
}

/* Inline handlers in the markup resolve against the global scope. */
Object.assign(window, { cmpGrpToggle, compSel });

document.querySelectorAll<HTMLButtonElement>("[data-cmp]").forEach((btn) =>
  btn.addEventListener("click", () => {
    const k = btn.dataset.cmp;
    if (k === "all") compSet(everyone());
    else if (k === "none") compSet([]);
    else compToggle(Number(k));
  })
);

/* Deep-link support: /compare/hub?vs=airtame preselects that brand alone. */
const wanted = new URLSearchParams(location.search).get("vs");
const preselect = wanted
  ? COMP.brands.findIndex((b) => b.toLowerCase().startsWith(wanted.toLowerCase().split(" ")[0]))
  : -1;

/* Only touch the DOM if the reader asked for something other than the default.
   The served HTML is already everyone-selected, so the common case costs nothing
   and never flashes. */
if (preselect >= 0) compSet([preselect]);
else compSync();
