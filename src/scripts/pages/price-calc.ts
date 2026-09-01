/**
 * The tier price calculator: industry, term, room count — and numbers that
 * travel to their new value rather than snapping to it. It runs on both
 * /products/pro and /products/essentials, and knows which is which only from
 * the JSON it is handed.
 *
 * The markup (components/TierPricing.astro) already carries the corporate,
 * 3-year, one-room figures, so everything here is an upgrade of a panel that is
 * already correct. With this file absent or failing, the published MSRP is
 * still on the page; it just stops being adjustable.
 *
 * Prices are not written here. They arrive as JSON on the section's
 * `data-prices`, straight from data/pricing.ts, which is the only place the
 * figures exist. Anything that is not a number — "On request", or null for a
 * cell that has no value — is carried through the arithmetic untouched:
 * `mul()` multiplies numbers and passes everything else along, so no
 * unpublished price can ever be turned into a total by accident.
 *
 * The count is the point of the redesign, so two details in it matter:
 *
 *   - It always starts from what is currently *on screen*, not from the last
 *     committed value. Click three terms quickly and the number changes course
 *     mid-flight instead of jumping back to restart.
 *   - Dragging the slider uses a much shorter duration than clicking a segment.
 *     A 520 ms ease under a finger that is still moving reads as lag; 140 ms
 *     reads as the number tracking the drag.
 *
 * prefers-reduced-motion turns the animation off entirely — the values still
 * update, they simply arrive immediately, which is the whole accommodation.
 */

type Money = number | "request" | null;
type Shape = { upfront: Money; renew: Money };
type Term = "3" | "5" | "p";
type Industry = "corp" | "edu";
type Data = Record<Industry, Record<Term, Shape>>;

const KEY = "polaris:pricemode"; /* shared with initPriceMode in site.ts */
const ON_REQ = "On request";
const DASH = "—";
const DUR = 520; /* a click: long enough to read as a count */
const DUR_DRAG = 140; /* a drag: short enough to read as tracking */
const MIN_ROOMS = 1;
const MAX_ROOMS = 100;

const usd = (n: number) =>
  "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const mul = (v: Money, k: number): Money => (typeof v === "number" ? v * k : v);
const word = (v: Money) => (v === "request" ? ON_REQ : DASH);
const rooms = (n: number) => (n === 1 ? "1 room" : n + " rooms");

type Fig = {
  el: HTMLElement;
  /** Whatever is currently displayed, or null when it is a word. */
  cur: number | null;
  raf: number;
  fmt: (n: number) => string;
};

export function initPriceCalc(): void {
  const root = document.querySelector<HTMLElement>(".pcalc");
  if (!root) return;

  let data: Data;
  try {
    data = JSON.parse(root.dataset.prices || "");
  } catch {
    return; /* leave the served figures alone */
  }

  const slow = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---- the animated figures ---- */

  const figs = new Map<string, Fig>();
  root.querySelectorAll<HTMLElement>("[data-fig]").forEach((el) => {
    const name = el.dataset.fig || "";
    figs.set(name, {
      el,
      cur: null,
      raf: 0,
      fmt: name === "rooms" ? (n) => String(Math.round(n)) : usd,
    });
  });

  const setFig = (name: string, value: Money, dur: number) => {
    const f = figs.get(name);
    if (!f) return;
    if (f.raf) cancelAnimationFrame(f.raf);
    f.raf = 0;

    if (typeof value !== "number") {
      f.cur = null;
      f.el.textContent = word(value);
      f.el.classList.add("is-word");
      return;
    }

    f.el.classList.remove("is-word");
    const from = f.cur;
    f.cur = value;

    /* Coming out of a word there is nothing to count from, so land directly. */
    if (from === null || slow || dur <= 0 || from === value) {
      f.el.textContent = f.fmt(value);
      return;
    }

    const t0 = performance.now();
    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / dur);
      const e = 1 - Math.pow(1 - p, 3); /* ease-out cubic: fast off the mark */
      f.el.textContent = f.fmt(from + (value - from) * e);
      f.raf = p < 1 ? requestAnimationFrame(step) : 0;
    };
    f.raf = requestAnimationFrame(step);
  };

  const cap = (name: string, html: string) => {
    const el = root.querySelector<HTMLElement>(`[data-cap="${name}"]`);
    if (el) el.innerHTML = html;
  };

  /* ---- state ---- */

  let ind: Industry = "corp";
  let term: Term = "3";
  let n = MIN_ROOMS;

  /* The industry and term selection is shared with the other price surfaces on
     the site (essentials, the family table) through the same session key, so a
     visitor who picked Education there does not have to pick it again here.
     Room count is deliberately not persisted: it belongs to this page. */
  try {
    const saved = JSON.parse(sessionStorage.getItem(KEY) || "{}");
    if (saved.ind === "corp" || saved.ind === "edu") ind = saved.ind;
    if (saved.term === "3" || saved.term === "5" || saved.term === "p") term = saved.term;
  } catch {
    /* first visit, or private mode */
  }

  const range = root.querySelector<HTMLInputElement>(".pcalc-range");
  const ask = root.querySelector<HTMLElement>("[data-ask]");
  const live = root.querySelector<HTMLElement>("[data-live]");
  let liveTimer = 0;

  const render = (dur: number) => {
    const shape = data[ind][term];
    const years = term === "p" ? null : Number(term);

    const upfront = mul(shape.upfront, n);
    /* The effective annual rate is the published upfront divided by the term,
       which lands exactly on the published renewal figure — it is the same
       number arrived at two ways, not a new claim about the price. */
    const perYear =
      years && typeof shape.upfront === "number" ? shape.upfront / years : term === "p" ? null : shape.upfront;
    const renew = mul(shape.renew, n);

    setFig("upfront", upfront, dur);
    setFig("year", perYear, dur);
    setFig("renew", renew, dur);
    setFig("rooms", n, dur === DUR_DRAG ? 0 : dur);

    cap("leadk", years ? "Billed upfront" : "One-time licence");
    cap("upfront", years ? `${years}-year term &middot; ${rooms(n)}` : `Perpetual &middot; ${rooms(n)}`);
    cap("year", years ? "Effective rate across the term" : "Perpetual &mdash; no annual rate");
    cap(
      "renew",
      years ? `From year ${years + 1} &middot; ${rooms(n)}` : "None &mdash; the licence does not renew"
    );

    const quoted = shape.upfront === "request";
    if (ask) ask.hidden = !quoted;

    /* One settled sentence for assistive tech, after the count has finished. */
    if (live) {
      clearTimeout(liveTimer);
      liveTimer = window.setTimeout(() => {
        const say = (v: Money) => (typeof v === "number" ? usd(v) : word(v));
        const head = years ? `${years}-year term` : "perpetual licence";
        live.textContent =
          `${ind === "corp" ? "Corporate" : "Education"}, ${head}, ${rooms(n)}: ` +
          `${say(upfront)} ${years ? "billed upfront" : "one-time"}, ` +
          `${say(perYear)} per room per year, ${say(renew)} annual renewal.`;
      }, dur + 120);
    }
  };

  /* ---- controls ---- */

  const save = () => {
    try {
      sessionStorage.setItem(KEY, JSON.stringify({ ind, term }));
    } catch {
      /* private mode */
    }
  };

  root.querySelectorAll<HTMLElement>("[data-seg]").forEach((seg) => {
    const which = seg.dataset.seg;
    const buttons = Array.from(seg.querySelectorAll<HTMLButtonElement>("button[data-val]"));

    const paint = () => {
      const active = which === "ind" ? (ind as string) : (term as string);
      buttons.forEach((b, i) => {
        const on = b.dataset.val === active;
        b.setAttribute("aria-pressed", on ? "true" : "false");
        if (on) seg.style.setProperty("--i", String(i));
      });
    };

    buttons.forEach((b) =>
      b.addEventListener("click", () => {
        const v = b.dataset.val || "";
        if (which === "ind") ind = v as Industry;
        else term = v as Term;
        paint();
        save();
        render(DUR);
      })
    );

    paint();
  });

  const setRooms = (v: number, dur: number) => {
    const next = Math.min(MAX_ROOMS, Math.max(MIN_ROOMS, Math.round(v)));
    if (next === n) return;
    n = next;
    if (range) range.value = String(n);
    render(dur);
  };

  root.querySelectorAll<HTMLElement>("[data-step]").forEach((b) =>
    b.addEventListener("click", () => setRooms(n + Number(b.dataset.step), 260))
  );

  range?.addEventListener("input", () => setRooms(Number(range.value), DUR_DRAG));

  /* Seed the figures from the markup so the first change counts from what is
     already on screen rather than fading in from nowhere. */
  figs.forEach((f, name) => {
    f.cur = name === "rooms" ? MIN_ROOMS : Number((f.el.textContent || "").replace(/[^0-9.]/g, "")) || null;
  });
  if (range) range.value = String(n);
  render(0);
}
