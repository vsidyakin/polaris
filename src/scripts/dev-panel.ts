/**
 * Developer panel wiring — TEMPORARY, delete with components/DevPanel.astro
 * and styles/dev-panel.css at production launch. See that component for what
 * the panel is and why the state restore is inlined there rather than here.
 *
 * State lives on <html> as attributes, because that is what the CSS reads and
 * it is the one thing available before this module loads:
 *
 *   data-dev="on"           the tab is armed (Ctrl+Alt+M)
 *   data-dev-panel="open"   the panel is expanded rather than just the tab
 *   data-dev-flags="off"    hide the […] placeholder highlights
 *   data-dev-ids="off"      hide the pink page-ID chips
 *   data-dev-banners="off"  hide the POC bar, pre-launch bands and 404 box
 *   data-dev-tags="off"     hide the .pageinfo status chips (T6, OPEN, GATED…)
 *
 * Absent means the default in every case, so nothing here changes a page until
 * someone deliberately switches something.
 *
 * Two pieces of state are not attributes on <html>:
 *
 *   `shut`    which groups are collapsed — a `data-shut` attribute on each
 *             section, since it is panel furniture and nothing outside the
 *             panel reads it.
 *   `season`  the running seasonal effect, which is a canvas rather than a CSS
 *             switch. scripts/seasonal.ts owns it and is imported lazily, so a
 *             browser that has never picked a season never fetches the chunk.
 */

import type { SeasonKey } from "./seasonal";

/** Keep in sync with the inline boot script in DevPanel.astro. */
const STATE_KEY = "polaris-dev-panel";

/** The four pieces of review chrome, in the order the panel lists them. */
const CHROME = ["flags", "ids", "banners", "tags"] as const;
type Chrome = (typeof CHROME)[number];

interface State {
  /** Armed: the tab is visible at all. */
  on: boolean;
  /** Expanded rather than collapsed to the tab. */
  open: boolean;
  /** Per-chrome: true = shown, the pre-panel behaviour. */
  flags: boolean;
  ids: boolean;
  banners: boolean;
  tags: boolean;
  /** `data-devp-sec` keys of the collapsed groups. */
  shut: string[];
  /** The running seasonal effect, or null for a plain page. */
  season: SeasonKey | null;
}

const DEFAULTS: State = {
  on: false,
  open: false,
  flags: true,
  ids: true,
  banners: true,
  tags: true,
  /* Three groups open at once overflows the panel on a laptop, and the eggs
     list is nine buttons of it. Chrome is the group people came for. */
  shut: ["seasonal", "eggs"],
  season: null,
};

const root = document.documentElement;

function read(): State {
  try {
    const raw = JSON.parse(localStorage.getItem(STATE_KEY) || "{}") as Partial<State>;
    return {
      on: raw.on === true,
      open: raw.open === true,
      flags: raw.flags !== false,
      ids: raw.ids !== false,
      banners: raw.banners !== false,
      /* Added after the panel shipped, so stored state predating it has no
         `tags` key: absent must mean shown, like the other three. */
      tags: raw.tags !== false,
      /* Same again for the two newest keys, except that their default is not
         "absent means off" — an old browser with no `shut` key should get the
         collapsed layout, not three groups open. */
      shut: Array.isArray(raw.shut) ? raw.shut.filter((k) => typeof k === "string") : [...DEFAULTS.shut],
      season: typeof raw.season === "string" ? (raw.season as SeasonKey) : null,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

let state = read();

function apply() {
  if (state.on) root.setAttribute("data-dev", "on");
  else root.removeAttribute("data-dev");

  if (state.on && state.open) root.setAttribute("data-dev-panel", "open");
  else root.removeAttribute("data-dev-panel");

  for (const key of CHROME) {
    if (state[key]) root.removeAttribute(`data-dev-${key}`);
    else root.setAttribute(`data-dev-${key}`, "off");
  }

  try {
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
  } catch {
    /* Storage blocked: the panel still works, it just forgets on navigation. */
  }

  season();
  sync();
}

/* The effects module is pulled in on demand and kept: `import()` caches, so the
   guard is only about never fetching the chunk for a browser that has no season
   set and never picks one. Everything after the first call reuses the promise,
   which also keeps rapid clicks in order. */
let effects: Promise<typeof import("./seasonal")> | null = null;

function season() {
  if (!state.season && !effects) return;
  effects ??= import("./seasonal");
  const want = state.season;
  effects.then((m) => m.setSeason(want)).catch(() => {});
}

/** Push state into the controls. The master switch is derived, never stored:
 *  it is on exactly when all three pieces of chrome are off, so there is no
 *  fourth boolean that can end up disagreeing with the other three. */
function sync() {
  const tab = document.getElementById("devp-tab");
  tab?.setAttribute("aria-expanded", String(state.open));

  const clean = CHROME.every((k) => !state[k]);
  document.querySelectorAll<HTMLElement>("[data-dev-toggle]").forEach((btn) => {
    const key = btn.dataset.devToggle!;
    const pressed = key === "prod" ? clean : state[key as Chrome];
    btn.setAttribute("aria-pressed", String(pressed));
  });

  document.querySelectorAll<HTMLElement>("[data-dev-season]").forEach((btn) => {
    btn.setAttribute("aria-pressed", String(btn.dataset.devSeason === state.season));
  });

  document.querySelectorAll<HTMLElement>("[data-devp-sec]").forEach((sec) => {
    const open = !state.shut.includes(sec.dataset.devpSec!);
    sec.toggleAttribute("data-shut", !open);
    sec.querySelector(".devp-gh")?.setAttribute("aria-expanded", String(open));
  });
}

function set(patch: Partial<State>) {
  state = { ...state, ...patch };
  apply();
}

/* ------------------------------------------------------------- controls --- */

document.getElementById("devp-tab")?.addEventListener("click", () => set({ open: !state.open }));

/* The ✕ disarms rather than collapsing: collapsing is what the tab is for, and
   a close button that leaves a tab behind reads as broken. */
document.getElementById("devp-hide")?.addEventListener("click", () => set({ on: false, open: false }));

document.querySelectorAll<HTMLElement>("[data-dev-toggle]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const key = btn.dataset.devToggle!;
    if (key === "prod") {
      /* Pressed when everything is already off means "put it all back". */
      const clean = CHROME.every((k) => !state[k]);
      /* Every key in CHROME, derived rather than listed: `tags` was added to
         the panel later and missed here, so the master switch hid three of the
         four pieces and then never lit, because `clean` tests all four. */
      set(Object.fromEntries(CHROME.map((k) => [k, clean])) as Partial<State>);
    } else {
      set({ [key]: !state[key as Chrome] } as Partial<State>);
    }
  });
});

/* Seasons are one-at-a-time: they are ambient full-page background, and two of
   them running together reads as a bug rather than as a festival. Pressing the
   lit one clears the page. */
document.querySelectorAll<HTMLElement>("[data-dev-season]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const key = btn.dataset.devSeason as SeasonKey;
    set({ season: state.season === key ? null : key });
  });
});

/* Group headers. The panel is taller than a laptop viewport with everything
   open, so this is how the seasonal list fits at all. */
document.querySelectorAll<HTMLElement>("[data-dev-sec]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const key = btn.dataset.devSec!;
    const shut = state.shut.includes(key)
      ? state.shut.filter((k) => k !== key)
      : [...state.shut, key];
    set({ shut });
  });
});

/* Mission Control and the nine games. Both entry points are shimmed onto
   window by initEasterEggLoader in site.ts, so the first click here pulls in
   the runtime chunk and the ones after it hit the real functions. */
document.querySelectorAll<HTMLElement>("[data-dev-egg]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const which = btn.dataset.devEgg!;
    const w = window as unknown as Record<string, ((arg?: string) => void) | undefined>;
    if (which === "menu") w.eggMenu?.();
    else w.eggLaunch?.(which);
  });
});

/* Where am I: the route key and the pink page ID, which is otherwise only
   readable off a chip that "production preview" has just hidden. */
const where = document.getElementById("devp-where");
if (where) {
  const { route, pgid } = document.body.dataset;
  where.textContent = pgid ? `${route} · ${pgid}` : (route ?? "");
}

/* ----------------------------------------------------------- the chord --- */

/**
 * Ctrl+Alt+M arms the panel, and disarms it again. Armed from cold it opens
 * too, so the first press shows something rather than a tab the developer has
 * to then find.
 *
 * Capture phase on window, and the event is consumed on a match: M on its own
 * is the easter eggs' mute key, and their listener would otherwise mute the
 * game underneath while this opens the panel over it. `code` rather than `key`
 * so the chord survives Alt producing a different character.
 */
addEventListener(
  "keydown",
  (e) => {
    if (!e.ctrlKey || !e.altKey || e.metaKey || e.shiftKey) return;
    if (e.code !== "KeyM") return;
    e.preventDefault();
    e.stopPropagation();
    set(state.on ? { on: false, open: false } : { on: true, open: true });
  },
  true
);

/* The attributes are already right — the inline boot script set them before
   this file loaded — so this is only to bring the controls into line with them
   on a fresh page. The season is the exception: a canvas cannot be restored by
   an attribute, so it starts here, on every page load, if one is set. */
sync();
season();

/* The only static import above is type-only and is erased, so mark this a
   module explicitly: without it the file is a global script and its top-level
   names collide with the other page scripts. */
export {};
