/**
 * Site-wide behaviour: nav menus, search, scroll reveals, the price-mode
 * toggle, chip filters, and the review page-ID overlay.
 *
 * Page-specific interactivity (TCO calculator, comparison matrix, selector
 * quiz…) lives in the page that needs it.
 */
import { withBase } from "../lib/base";

const $ = <T extends Element = HTMLElement>(s: string) => document.querySelector<T>(s);
const $$ = <T extends Element = HTMLElement>(s: string) => Array.from(document.querySelectorAll<T>(s));

/* ------------------------------------------------------------------ nav --- */

function initNav() {
  const items = $$(".topitem");

  items.forEach((item, i) => {
    const btn = item.querySelector("button");
    if (!btn) return;
    item.addEventListener("mouseenter", () => {
      items.forEach((t, j) => j !== i && t.classList.remove("openmenu"));
    });
    btn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      const wasOpen = item.classList.contains("openmenu");
      items.forEach((t) => t.classList.remove("openmenu"));
      item.classList.toggle("openmenu", !wasOpen);
      btn.setAttribute("aria-expanded", String(!wasOpen));
    });
  });

  document.addEventListener("click", () =>
    items.forEach((t) => t.classList.remove("openmenu"))
  );

  /* Phone nav: the burger toggles the header into a full-width accordion
     panel (see mobile.css). Menus inside reuse the same click-to-open
     .openmenu logic as desktop. */
  const burger = $("[data-nav-toggle]");
  const shead = $(".site-header");
  if (burger && shead) {
    burger.addEventListener("click", (ev) => {
      ev.stopPropagation();
      const open = shead.classList.toggle("mnav");
      burger.setAttribute("aria-expanded", String(open));
      if (!open) items.forEach((t) => t.classList.remove("openmenu"));
    });
  }

  /* Sub-groups in a dropdown: collapsed, opened on intent, latched while you
     stay in the menu.
     `navjs` tells the stylesheet script is running, so it may collapse them;
     without it they render open, because a menu nobody can expand is worse than
     a long one.
     DWELL is the whole trick. Opening on bare hover meant that crossing a
     heading on the way to a row below expanded it and dropped everything
     beneath by five rows — the target moved out from under the cursor. A short
     dwell distinguishes "I am pointing at this" from "I am passing through".
     Once open it stays open until the pointer leaves the dropdown, so nothing
     collapses and re-expands underneath you mid-journey. */
  const DWELL = 170;
  document.documentElement.classList.add("navjs");
  document.querySelectorAll<HTMLElement>(".drop").forEach((drop) => {
    const subs = Array.from(drop.querySelectorAll<HTMLElement>(".navparent"));
    if (!subs.length) return;
    let timer = 0;
    const open = (p: HTMLElement) => {
      p.classList.add("nsopen");
      p.querySelector<HTMLElement>(".grpbtn")?.setAttribute("aria-expanded", "true");
    };
    const close = (p: HTMLElement) => {
      p.classList.remove("nsopen");
      p.querySelector<HTMLElement>(".grpbtn")?.setAttribute("aria-expanded", "false");
    };
    const closeAll = () => {
      window.clearTimeout(timer);
      subs.forEach(close);
    };
    subs.forEach((p) => {
      const row = (p.querySelector(".grpbtn") ?? p.querySelector("a")) as HTMLElement | null;
      row?.addEventListener(
        "mouseenter",
        () => {
          window.clearTimeout(timer);
          timer = window.setTimeout(() => open(p), DWELL);
        },
        { passive: true }
      );
      /* The state the pointer found, sampled before focus moves. A click on a
         collapsed group runs pointerdown → focus → focusin → click, and the
         `focusin` listener at the end of this block opens the group — so by the
         time `click` fires, `nsopen` is already set and a toggle reading the live
         class would shut what the user just asked to open, in one gesture.
         `null` means no pointer was involved (Enter or Space on a focused
         heading), and there the live class IS the truth. */
      let downState: boolean | null = null;
      const sample = () => {
        downState = p.classList.contains("nsopen");
      };
      row?.addEventListener("pointerdown", sample, { passive: true });
      row?.addEventListener(
        "mouseleave",
        () => {
          window.clearTimeout(timer);
          /* a press that ended somewhere else never produced a click, so the
             sample above is stale; drop it rather than let a later keypress
             read it */
          downState = null;
        },
        { passive: true }
      );
      /* A deliberate action skips the dwell — and on a heading that is only a
         heading, a second click shuts the group again. That toggle is confined to
         buttons on purpose: a `.navparent` whose row is an anchor IS a page, so a
         click there has to navigate, and collapsing the submenu on the way out
         would be a flicker on top of a page load.
         The pending dwell is cleared first in either case. Without it the timer
         armed by the mouseenter that brought the pointer here fires a moment
         later and re-opens the group the click just shut. */
      row?.addEventListener("click", (e) => {
        window.clearTimeout(timer);
        const wasOpen = downState ?? p.classList.contains("nsopen");
        downState = null;
        if (row.tagName !== "BUTTON") {
          if (!wasOpen) open(p);
          return;
        }
        e.preventDefault();
        /* The phone accordion renders every sub-group open regardless of the
           class (see mobile.css), so there is nothing to collapse: a tap only
           needs to leave `aria-expanded` agreeing with what is on screen. */
        if (p.closest(".site-header.mnav")) {
          open(p);
          return;
        }
        if (wasOpen) close(p);
        else open(p);
      });
      /* Keyboard reach: tabbing to the heading opens the group, which is what
         makes the children focusable at all (they are `display: none` until
         then). This is also what the `:focus-within` rules in global.css used to
         do in CSS — it moved here so that clicking to collapse actually works;
         see the comment above `.drop .navsub` there. */
      p.addEventListener("focusin", () => open(p));
    });
    drop.addEventListener("mouseleave", closeAll, { passive: true });
    drop.closest(".topitem")?.addEventListener("mouseleave", closeAll, { passive: true });
  });

  const header = $("header");
  if (header) {
    header.addEventListener("mouseleave", () =>
      items.forEach((t) => t.classList.remove("openmenu"))
    );

    /* Land on a new page with the pointer still parked over the menu you just
       clicked and it would spring open again. Nap until the pointer moves. */
    header.classList.add("menusleep");
    const wokeAt = Date.now();
    header.addEventListener("mousemove", () => {
      if (Date.now() - wokeAt > 600) header.classList.remove("menusleep");
    });
    header.addEventListener("mouseleave", () => header.classList.remove("menusleep"));
  }

  initConnect();
}

/* ------------------------------------------------------- connect (nav) --- */

/**
 * The screen-key panel in the header: six one-character cells that behave as a
 * single field.
 *
 * The cells ARE the value. There is no hidden input shadowing them and no
 * separate string held in a closure, because the two would need keeping in step
 * and the screen would eventually disagree with what gets submitted. Reading
 * `cells.map(c => c.value).join("")` on demand cannot drift.
 *
 * Four behaviours make six boxes feel like one field, and each exists because
 * its absence is immediately annoying:
 *
 *   CARRY FORWARD.  A character lands and focus moves on. Without it you type
 *                   six characters into box one and `maxlength` eats five.
 *   CARRY BACK.     Backspace in a filled cell clears it and stays put;
 *                   backspace in an EMPTY cell steps back and clears that one.
 *                   That second half is the whole of "seamless": holding
 *                   backspace walks the key out right-to-left the way it would
 *                   in a normal field, instead of stopping dead at each gap.
 *   SPREAD A PASTE. `maxlength="1"` truncates a pasted key to its first
 *                   character, which is useless when the key came from an email.
 *                   The paste is intercepted and distributed.
 *   REPLACE, DON'T APPEND.  Focusing or clicking a filled cell selects its
 *                   character, so typing overwrites rather than being refused by
 *                   `maxlength`.
 *
 * The panel is decorated by one class on the `.connectdrop` — `cd-ready` — and
 * everything visual hangs off it in CSS: the cells go mint together, the beam
 * goes solid, the lamp stops breathing, the commit button rides up. The script's
 * only job is to know when six characters exist.
 */
function initConnect() {
  const panel = $(".connectdrop");
  const keys = $("[data-cd-keys]");
  if (!panel || !keys) return;

  const cells = Array.from(keys.querySelectorAll<HTMLInputElement>(".cd-key"));
  if (!cells.length) return;

  const statusText = $("[data-cd-statustext]");
  const liveEl = $("[data-cd-live]");
  const goBtn = $<HTMLButtonElement>("[data-connect-go]");
  const LEN = cells.length;

  /* Screen keys are alphanumeric. Anything else a keyboard or a clipboard can
     produce — spaces, dashes someone added for readability, a pasted URL's
     punctuation — is dropped rather than rejected, so a key copied as "K7R-M2X"
     still lands correctly. */
  const clean = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const value = () => cells.map((c) => c.value).join("");

  const focusCell = (i: number) => {
    const c = cells[Math.max(0, Math.min(LEN - 1, i))];
    c.focus();
    c.select();
  };

  const sync = () => {
    const v = value();
    const ready = v.length === LEN;
    cells.forEach((c) => c.classList.toggle("on", c.value !== ""));
    panel.classList.toggle("cd-ready", ready);
    if (statusText) {
      statusText.textContent = ready
        ? "Link ready"
        : v.length
          ? `Key ${v.length}/${LEN}`
          : "Awaiting key";
    }
    /* Collapsed rows must not be tabbable, and `visibility: hidden` would kill
       the fade the button rides in on — so the disabled state carries it. */
    if (goBtn) goBtn.disabled = !ready;
    if (liveEl) liveEl.textContent = ready ? "Screen key complete. Establish link to join." : "";
  };

  /* UNVERIFIED, and it no longer says so on the page. The panel used to carry a
     bracketed note — "[Deep-link pattern app.mersive.com/{key}: confirm with the
     cloud team; the app may still ask for your name.]" — which `initVerifyFlags`
     highlighted in review. Damian's stand-in on this branch asked for that note
     removed on 16 Aug 2026, so the question is recorded here instead of being
     lost with it: nobody has confirmed that app.mersive.com accepts the key as a
     path segment, and the target may still prompt for a display name on arrival.
     Confirm with the cloud team before launch. If the pattern turns out to be a
     query parameter, this is the one line that changes. */
  const join = () => {
    const key = value();
    if (key.length !== LEN) {
      focusCell(cells.findIndex((c) => !c.value));
      return;
    }
    window.open(`https://app.mersive.com/${encodeURIComponent(key)}`, "_blank", "noopener");
  };

  /** Write `text` across the cells starting at `from`, and park focus after it. */
  const spread = (text: string, from: number) => {
    const chars = clean(text).split("");
    if (!chars.length) return;
    let i = from;
    for (const ch of chars) {
      if (i >= LEN) break;
      cells[i].value = ch;
      i++;
    }
    sync();
    focusCell(i);
  };

  cells.forEach((cell, i) => {
    cell.addEventListener("focus", () => cell.select());
    /* Pointer users land mid-key often; selecting on mousedown-then-focus is
       undone by the click's own caret placement, so re-select after it. */
    cell.addEventListener("click", () => cell.select());

    cell.addEventListener("input", () => {
      const v = clean(cell.value);
      cell.value = "";
      if (!v) {
        sync();
        return;
      }
      /* Normally one character. More arrives when a phone keyboard commits a
         whole composed word, or when something slips past the paste handler. */
      spread(v, i);
    });

    cell.addEventListener("keydown", (ev) => {
      const e = ev as KeyboardEvent;
      if (e.key === "Backspace") {
        e.preventDefault();
        if (cell.value) {
          cell.value = "";
          sync();
        } else if (i > 0) {
          cells[i - 1].value = "";
          sync();
          focusCell(i - 1);
        }
        return;
      }
      if (e.key === "Delete") {
        e.preventDefault();
        cell.value = "";
        sync();
        return;
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        focusCell(i - 1);
        return;
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        focusCell(i + 1);
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        join();
      }
    });
  });

  keys.addEventListener("paste", (ev) => {
    const e = ev as ClipboardEvent;
    const text = clean(e.clipboardData?.getData("text") ?? "");
    if (!text) return;
    e.preventDefault();
    const at = cells.indexOf(document.activeElement as HTMLInputElement);
    spread(text, at < 0 ? 0 : at);
  });

  goBtn?.addEventListener("click", join);

  /* Opening the panel by clicking Connect is an explicit "I want to type a key",
     so put the caret in the first empty cell. Deliberately NOT wired to hover or
     focus-within: the panel opens on hover too, and stealing the caret from
     someone merely crossing the header is hostile. The rAF waits for initNav's
     own click handler to have toggled the class. */
  const connectBtn = panel.closest(".connectitem")?.querySelector("button");
  connectBtn?.addEventListener("click", () => {
    requestAnimationFrame(() => {
      if (panel.closest(".connectitem")?.classList.contains("openmenu")) {
        focusCell(Math.max(0, cells.findIndex((c) => !c.value)));
      }
    });
  });

  sync();
}

/* --------------------------------------------------------------- search --- */

interface SearchEntry {
  r: string;
  h: string;
  t: string;
  d: string;
}

function initSearch() {
  const overlay = $("#ssearch");
  const input = $<HTMLInputElement>("#ssq");
  const results = $("#ssr");
  if (!overlay || !input || !results) return;

  let index: SearchEntry[] = [];
  try {
    index = JSON.parse($("#search-index")?.textContent ?? "[]");
  } catch {
    index = [];
  }

  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const run = (q: string) => {
    const toks = q.toLowerCase().trim().split(/\s+/).filter(Boolean);
    const hits = index.filter((e) => {
      const hay = `${e.r.replace(/\//g, " ")} ${e.t} ${e.d}`.toLowerCase();
      return toks.every((t) => hay.includes(t));
    });
    results.innerHTML =
      hits
        .slice(0, 14)
        .map(
          (e) =>
            `<a href="${e.h}"><b>${esc(e.t)}</b><span>${esc(e.h)}</span>${
              e.d ? `<p>${esc(e.d)}</p>` : ""
            }</a>`
        )
        .join("") ||
      `<p class="ssnone">No pages match. Try the <a href="${withBase("/resources/glossary")}">glossary</a> or <a href="${withBase("/products/selector")}">the selector</a>.</p>`;
  };

  const open = () => {
    overlay.classList.add("open");
    input.value = "";
    run("");
    setTimeout(() => input.focus(), 30);
  };
  const close = () => overlay.classList.remove("open");

  $("[data-search-open]")?.addEventListener("click", open);
  $("[data-search-close]")?.addEventListener("click", close);
  overlay.addEventListener("click", (e) => e.target === overlay && close());
  input.addEventListener("input", () => run(input.value));
  document.addEventListener("keydown", (e) => e.key === "Escape" && close());
}

/* ------------------------------------------------------------- post sky --- */

/* The star field behind an article title drifts as you scroll, the way the home
   hero's does. Same model as initSkyDepth: three depth layers, offsets written as
   custom properties, and the rate is a share of scroll distance rather than a
   fraction of the element — the panel is only ~300px tall, so a fraction of it
   would be invisible. These are HTML <span> stars, so the units are real pixels and
   no viewBox conversion is needed.
   Held to a third of the hero's rates: a headline sits on top of this, and anything
   faster reads as the text sliding. */
function initPostSky() {
  const panels = $$<HTMLElement>("[data-sky]");
  if (!panels.length) return;
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const DEPTH = [0.02, 0.045, 0.075];
  let queued = false;
  const write = () => {
    queued = false;
    for (const el of panels) {
      const r = el.getBoundingClientRect();
      /* Distance scrolled since the panel's top passed the top of the window. */
      const past = Math.max(0, -r.top);
      for (let i = 0; i < 3; i++) {
        el.style.setProperty(`--px${i + 1}`, `${(-past * DEPTH[i]).toFixed(2)}px`);
      }
    }
  };
  addEventListener(
    "scroll",
    () => {
      if (!queued) {
        queued = true;
        requestAnimationFrame(write);
      }
    },
    { passive: true }
  );
  write();
}

/* --------------------------------------------------------------- reveal --- */

function initReveal() {
  const targets = $$(".reveal");
  if (!("IntersectionObserver" in window)) {
    targets.forEach((e) => e.classList.add("vis"));
    return;
  }
  /* threshold 0, not 0.12. A ratio threshold silently fails on anything taller than
     the viewport: the blog grid is 45 cards and about 6000px, so on a 900px
     window the most of it that can ever be visible is 15%, and on a shorter window
     it never reaches 12% — the grid stayed at opacity 0, invisible but still
     clickable, which is exactly how it was reported. Firing on any intersection,
     pulled 60px up from the bottom edge so it still reads as a reveal rather than a
     pop, is size-independent. */
  const io = new IntersectionObserver(
    (entries) =>
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add("vis");
          io.unobserve(e.target);
        }
      }),
    { rootMargin: "0px 0px -60px 0px", threshold: 0 }
  );
  targets.forEach((e) => io.observe(e));
  /* Anything already on screen at load reveals immediately: an observer callback
     one frame later is a visible flash of empty page above the fold. */
  requestAnimationFrame(() =>
    targets.forEach((e) => {
      const r = e.getBoundingClientRect();
      if (r.top < innerHeight && r.bottom > 0) e.classList.add("vis");
    })
  );
}

/* ----------------------------------------------------------- price mode --- */

interface PriceMode {
  ind: string;
  term: string;
}

/** Corporate/education pricing and 3yr/5yr/perpetual terms, persisted per session. */
function initPriceMode() {
  const KEY = "polaris:pricemode";
  let mode: PriceMode = { ind: "corp", term: "3" };
  try {
    Object.assign(mode, JSON.parse(sessionStorage.getItem(KEY) ?? "{}"));
  } catch {
    /* first visit */
  }

  const apply = () => {
    $$("[data-i]").forEach((b) => b.classList.toggle("on", b.getAttribute("data-i") === mode.ind));
    $$("[data-t]").forEach((b) => b.classList.toggle("on", b.getAttribute("data-t") === mode.term));
    $$("[data-p-corp-3]").forEach((el) => {
      el.innerHTML =
        el.getAttribute(`data-p-${mode.ind}-${mode.term}`) ?? el.getAttribute("data-p-corp-3") ?? "";
    });
  };

  $$(".prmode button").forEach((b) =>
    b.addEventListener("click", () => {
      const ind = b.getAttribute("data-i");
      const term = b.getAttribute("data-t");
      if (ind) mode.ind = ind;
      if (term) mode.term = term;
      try {
        sessionStorage.setItem(KEY, JSON.stringify(mode));
      } catch {
        /* private mode */
      }
      apply();
    })
  );

  apply();
}

/* ----------------------------------------------------- collab replay -------- */

/** Restart the CSS-driven collaboration scene without reloading the page. */
function initCollabReplay() {
  $$(".clb-replay").forEach((btn) =>
    btn.addEventListener("click", () => {
      const wrap = btn.closest<HTMLElement>(".clbwrap");
      if (!wrap) return;
      const els = wrap.querySelectorAll<HTMLElement>(".cba,.cbb,.cmt");
      els.forEach((e) => (e.style.animation = "none"));
      void wrap.offsetWidth; // force reflow so the animation restarts
      els.forEach((e) => (e.style.animation = ""));
    })
  );
}

/* ------------------------------------------------------- review page IDs --- */

/**
 * Pink review chips: page code on the intro, `<page>.<n>` per section, and
 * `<section>.f<n>` per figure. Temporary — delete with the POC banner.
 */
function initReviewIds() {
  const pid = document.body.dataset.pgid;
  if (!pid) return;

  const main = $("#app");
  if (!main) return;

  const intro = main.querySelector(".pageinfo");
  if (intro) intro.insertAdjacentHTML("afterbegin", `<span class="pgid">${pid}</span>`);
  else main.insertAdjacentHTML("afterbegin", `<div class="pgid-row"><span class="pgid">${pid}</span></div>`);

  let si = 0;
  main.querySelectorAll<HTMLElement>("section, .ph").forEach((sc) => {
    si++;
    sc.classList.add("pgid-host");
    sc.dataset.pgid = `${pid}.${si}`;
    sc.insertAdjacentHTML("afterbegin", `<span class="pgid pgid-s">${pid}.${si}</span>`);
  });

  const figSel =
    "figure, .clbwrap, .bpwrap, .wsb, .famlad, .mediaband, .mq, .dframe, .tax, .wml";
  const done: Element[] = [];
  const fcount: Record<string, number> = {};

  const chip = (host: Element) => {
    const sec = host.closest<HTMLElement>("section, .ph");
    const addr = sec?.dataset.pgid ?? pid;
    fcount[addr] = (fcount[addr] ?? 0) + 1;
    host.classList.add("pgid-host");
    host.insertAdjacentHTML("afterbegin", `<span class="pgid pgid-f">${addr}.f${fcount[addr]}</span>`);
  };

  main.querySelectorAll(figSel).forEach((f) => {
    if (done.some((d) => d !== f && d.contains(f))) return;
    done.push(f);
    chip(f);
  });

  /* SVG scenes rendered without a wrapper class: chip the aria-labelled ones */
  main.querySelectorAll('svg[role="img"]').forEach((sv) => {
    const host = sv.parentElement;
    if (!host) return;
    if (host.querySelector(":scope > .pgid-f")) return;
    if (done.some((d) => d.contains(sv))) return;
    done.push(host);
    chip(host);
  });
}

/* -------------------------------------------------------------- HubSpot --- */

/**
 * Paste the real IDs and the site is lead-capturing day 1. While the values
 * are bracketed placeholders nothing loads and the styled mock forms remain.
 */
const HUBSPOT = {
  portalId: "[HubSpot portal ID - marketing ops]",
  region: "na1",
  forms: {
    demo: "[demo form GUID]",
    trial: "[trial form GUID]",
    contact: "[contact form GUID]",
  } as Record<string, string>,
  live() {
    return !/^\[/.test(this.portalId);
  },
};

function initHubSpot() {
  if (!HUBSPOT.live()) return;

  const tracker = document.createElement("script");
  tracker.src = `https://js.hs-scripts.com/${HUBSPOT.portalId}.js`;
  tracker.async = true;
  tracker.defer = true;
  document.head.appendChild(tracker);

  for (const [slot, formKey] of [
    ["hs-demo", "demo"],
    ["hs-trial", "trial"],
    ["hs-contact", "contact"],
  ]) {
    const gid = HUBSPOT.forms[formKey] ?? "";
    if (/^\[/.test(gid)) continue;
    const el = document.getElementById(slot) as HTMLElement | null;
    if (!el || el.dataset.hs) continue;
    el.dataset.hs = "1";

    // hide the mock form sitting beneath the slot
    let n = el.nextElementSibling as HTMLElement | null;
    while (n) {
      n.style.display = "none";
      n = n.nextElementSibling as HTMLElement | null;
    }

    const make = () => {
      const hbspt = (window as any).hbspt;
      if (hbspt) {
        hbspt.forms.create({
          region: HUBSPOT.region,
          portalId: HUBSPOT.portalId,
          formId: gid,
          target: `#${slot}`,
        });
      }
    };
    if ((window as any).hbspt) make();
    else {
      const sc = document.createElement("script");
      sc.src = "https://js.hsforms.net/forms/embed/v2.js";
      sc.onload = make;
      document.head.appendChild(sc);
    }
  }
}

/* ----------------------------------------------------------- easter eggs --- */

/**
 * The games are ~300 KB of canvas engine. Nobody should pay for that on a page
 * view, so the module is fetched only when the Polaris star is clicked. These
 * stubs stand in for the two entry points reachable from outside the runtime —
 * `window.eggMenu` (the star's inline handler, and the dev panel) and
 * `window.eggLaunch` (the dev panel's straight-into-a-game buttons) — until
 * then; loading the real module overwrites both, along with everything else it
 * publishes.
 */
function initEasterEggLoader() {
  let loading: Promise<void> | null = null;

  const load = async () => {
    loading ??= import("./eggs").then((m) => m.initEasterEggs());
    await loading;
  };

  (window as any).eggMenu = async () => {
    await load();
    (window as any).eggMenu();
  };

  (window as any).eggLaunch = async (which: string) => {
    await load();
    (window as any).eggLaunch(which);
  };
}

/* ----------------------------------------------------- logo twinkle --- */

/**
 * Every few minutes, the dot of the `i` in "polaris" catches the light.
 *
 * Randomness is why this is script and not a long CSS animation. A keyframe loop
 * with a 0.5% duty cycle would be just as rare and would still be CLOCKWORK —
 * anyone who noticed it once would see the next one arrive on schedule, which is
 * the opposite of the brief. Each interval here is drawn fresh, so there is no
 * period to notice.
 *
 * Three things it deliberately does:
 *   - Skips entirely under `prefers-reduced-motion`, like `initPostSky`. There is
 *     no reduced version of a twinkle worth having: it is decoration or nothing.
 *   - Waits while the tab is hidden. Background tabs throttle timers anyway, and
 *     the only thing a fired twinkle would achieve there is a queued animation
 *     that plays the instant you return — the one moment it looks deliberate.
 *   - Removes the class on the way out, so the animation can be restarted. Left
 *     on, it plays exactly once per page load and never again.
 *
 * The interval is the tuning knob and it is the whole design: MIN/MAX below.
 * `window.polarisTwinkle()` fires one on demand, which is how to see it without
 * sitting on the page for two minutes.
 */
function initLogoTwinkle() {
  const sub = $(".logosub");
  if (!sub) return;
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const MIN = 40_000;
  const MAX = 150_000;
  /* Matches the animation in global.css. A shade longer, so the class is never
     pulled out from under a frame still being painted. */
  const RUN = 1400;

  let running = false;
  const fire = () => {
    if (running) return;
    running = true;
    sub.classList.add("twinkle");
    setTimeout(() => {
      sub.classList.remove("twinkle");
      running = false;
    }, RUN);
  };

  const schedule = () => {
    const wait = MIN + Math.random() * (MAX - MIN);
    setTimeout(() => {
      /* Hidden tab: skip this turn rather than firing into a tab nobody is
         looking at, and draw a fresh interval for the next one. */
      if (document.visibilityState === "visible") fire();
      schedule();
    }, wait);
  };

  schedule();
  (window as any).polarisTwinkle = fire;
}

/* ----------------------------------------------------------------- boot --- */

initLogoTwinkle();
initNav();
initSearch();
initReveal();
initPostSky();
initPriceMode();
initCollabReplay();
/**
 * Review chrome (temporary, like the pink page-ID chips): highlight every
 * bracketed placeholder or verification note on the page in bright yellow so
 * reviewers can see at a glance what still needs a real answer. Walks text
 * nodes only, so markup is never touched; skips code/pre and anything already
 * flagged. Delete alongside the other review chrome at production launch.
 */
function initVerifyFlags() {
  const main = $("#app");
  if (!main) return;
  // a bracket containing at least one letter and three+ characters
  const RX = /\[[^\][\n]*[A-Za-z][^\][\n]*\]/g;
  const SKIP = /^(SCRIPT|STYLE|CODE|PRE|TEXTAREA|SVG|OPTION)$/;

  const walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT, {
    acceptNode(n) {
      const p = n.parentElement;
      if (!p || SKIP.test(p.tagName) || p.closest("svg, code, pre, .vflag")) {
        return NodeFilter.FILTER_REJECT;
      }
      RX.lastIndex = 0;
      return RX.test(n.nodeValue || "") ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    },
  });

  const hits: Text[] = [];
  let node: Node | null;
  while ((node = walker.nextNode())) hits.push(node as Text);

  hits.forEach((t) => {
    const frag = document.createDocumentFragment();
    const text = t.nodeValue || "";
    let last = 0;
    RX.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = RX.exec(text))) {
      if (m.index > last) frag.append(text.slice(last, m.index));
      const mark = document.createElement("mark");
      mark.className = "vflag";
      mark.title = "Needs verification before publish";
      mark.textContent = m[0];
      frag.append(mark);
      last = m.index + m[0].length;
    }
    if (last < text.length) frag.append(text.slice(last));
    t.replaceWith(frag);
  });
}

/**
 * Hero sky depth: three star layers drift at different rates on scroll and lean
 * a couple of pixels against the pointer. Everything is written as custom
 * properties on the hero and consumed by transforms in CSS, so the only work per
 * frame is three property writes. Skipped entirely for reduced-motion users,
 * and the pointer half never arms on touch.
 */
function initSkyDepth() {
  const hero = document.querySelector<HTMLElement>(".xhero");
  if (!hero) return;
  /* The hero can exist without a sky. .vhx (the home page's film hero) keeps the
     .xhero class so it inherits that hero's typography, but it has no
     constellation box and no star field, so there is nothing here to parallax —
     and without this the page still paid for a scroll listener, a pointer
     listener and three property writes a frame to move elements that are not
     there. Keyed on the layers rather than on .vhx so it stays right for any
     future hero that drops one. */
  if (!hero.querySelector(".cstlines") && !document.querySelector(".skyfield")) return;
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
    hero.classList.add("lit");
    return;
  }

  /* draw the constellation links once, when the hero is actually on screen */
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      (es) => es.forEach((e) => { if (e.isIntersecting) { hero.classList.add("lit"); io.disconnect() } }),
      { threshold: 0.15 }
    );
    io.observe(hero);
  } else hero.classList.add("lit");

  /* Depth rates as a FRACTION OF THE HERO'S HEIGHT, not of scroll distance.
     The hero is only ever about 620px tall, so a rate of 0.72 against raw
     scrollY moved the field 450px — most of the hero — and dragged empty sky in
     behind it. Capping travel at a fraction of the element keeps the effect
     readable and keeps the field on screen. */
  const DEPTH = [0.05, 0.1, 0.17]; /* far -> near, as a share of hero height */
  const FIG = 0.03;                /* the figures: nearly anchored */

  /* And the offsets have to be converted out of screen pixels. These custom
     properties are consumed by transforms on SVG children, where a CSS px is one
     USER UNIT of the viewBox — not one screen pixel. The hero's box is 100x50
     against ~1900px of width, so an uncorrected 200px offset was asking for 200
     units of travel on a 50-unit-tall box: four times the whole sky, instantly
     off screen. This is why the field emptied. `slice` scales uniformly, so one
     divisor serves both axes. */
  let sy = 0, upp = 1 / 19, queued = false;
  const measure = () => {
    const svg = hero.querySelector<SVGSVGElement>(".cstlines");
    const r = svg?.getBoundingClientRect();
    if (r && r.width && r.height) upp = 1 / Math.max(r.width / 100, r.height / 50);
  };

  /* Written to .skyzone, the wrapper around the hero and its tail, so the hero, the
     tail and the single .skyfield star layer all INHERIT one set of offsets. This
     replaces writing the same values to two sibling elements and forgetting the
     third: the field is now a sibling of the hero rather than a child of it, so that
     it escapes the hero's overflow-hidden, and a sibling cannot inherit the hero's
     properties. The zone is the common ancestor of all three, which makes it the
     only correct place to put them. Falls back to the hero if the wrapper is absent,
     so a page that has a hero without a zone still animates. */
  const zone = (hero.closest<HTMLElement>(".skyzone") ?? hero);
  const write = () => {
    queued = false;
    for (let i = 0; i < 3; i++) {
      zone.style.setProperty(`--sy${i + 1}`, `${(sy * DEPTH[i] * upp).toFixed(3)}px`);
      /* the scattered <span> stars are HTML, so they keep real pixels */
      zone.style.setProperty(`--px${i + 1}`, `${(sy * DEPTH[i]).toFixed(2)}px`);
    }
    zone.style.setProperty("--syf", `${(sy * FIG * upp).toFixed(3)}px`);
  };
  measure();
  addEventListener("resize", () => { measure(); write() }, { passive: true });
  const queue = () => { if (!queued) { queued = true; requestAnimationFrame(write) } };

  addEventListener("scroll", () => {
    const r = hero.getBoundingClientRect();
    if (r.bottom < 0) return;          /* hero is past; stop paying for it */
    sy = -window.scrollY;
    queue();
  }, { passive: true });

  write();
}

/**
 * Depth on the closing band's sky. The hero drives its parallax off raw scroll
 * distance because it starts at the top of the page; a band two thousand pixels
 * down cannot, or the offset would be enormous before it ever came into view.
 * This drives off the band's own position instead: -1 as it enters from the
 * bottom, +1 as it leaves the top, so every band gets the same short travel
 * wherever it sits on the page.
 *
 * Offsets are set on each .ctaband, which is what the star and figure classes
 * read, so the whole effect stays transform-only. Bands off screen are skipped.
 *
 * The band rather than its .ctasky, which is where these used to go. Both have
 * the same rect, so the measurement is unchanged, but the Polaris click target
 * is a SIBLING of .ctasky — it has to be, to sit above the copy — and it rides
 * the same parallax layer as the figure whose star it covers. Written to .ctasky
 * the offsets never reached it, and the target held still while the star slid out
 * from under it on scroll.
 */
function initBandSky() {
  const bands = Array.from(document.querySelectorAll<HTMLElement>(".ctaband"));
  if (!bands.length || matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const DEPTH = [10, 22, 38]; /* px of travel: far -> near */
  let queued = false;

  const write = () => {
    queued = false;
    const vh = window.innerHeight;
    for (const b of bands) {
      const r = b.getBoundingClientRect();
      if (r.bottom < -80 || r.top > vh + 80) continue; /* off screen: don't pay for it */
      const p = (vh / 2 - (r.top + r.height / 2)) / (vh / 2 + r.height / 2);
      for (let i = 0; i < 3; i++) b.style.setProperty(`--sy${i + 1}`, `${(p * DEPTH[i]).toFixed(1)}px`);
    }
  };
  const queue = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(write);
  };

  addEventListener("scroll", queue, { passive: true });
  addEventListener("resize", queue, { passive: true });
  write();
}

/* ------------------------------------------------------- band constellation --- */

/**
 * Lights the closing band's star trace when the band comes into view.
 *
 * The lines animate from `opacity: 0` with a full dash offset, so without this
 * they would either play once far above the fold and be over before anyone
 * scrolled to them, or — with the animation held — never appear at all. Same
 * shape as initSkyDepth's `.lit`: observe, add the class once, stop observing.
 *
 * Under reduced motion the class is added immediately and the stylesheet holds
 * the animation, which leaves the figure simply drawn. That is deliberate: the
 * point of the figure is that it is Ursa Minor, and that survives without the
 * trace. Every band gets its own observer entry because a page can carry more
 * than one.
 */
function initBandTrace() {
  const bands = Array.from(document.querySelectorAll<HTMLElement>(".ctaband"));
  if (!bands.length) return;
  if (
    matchMedia("(prefers-reduced-motion: reduce)").matches ||
    !("IntersectionObserver" in window)
  ) {
    bands.forEach((b) => b.classList.add("lit"));
    return;
  }
  const io = new IntersectionObserver(
    (es) =>
      es.forEach((e) => {
        if (!e.isIntersecting) return;
        e.target.classList.add("lit");
        io.unobserve(e.target);
      }),
    /* A third of the band in view before it starts, so the trace is not already
       running while the band is a sliver at the bottom of the window. */
    { threshold: 0.33 }
  );
  bands.forEach((b) => io.observe(b));
}

/* ------------------------------------------------ collab scene replay --- */

/* The replay button on collabScene() -- A0.8.f1 on home and B1.1.f1 on
   /platform/how. It was wired as onclick="clbReplay(this)", carried over from
   the single-file POC, but that function never made the move into this
   codebase: it exists only in archive/mersive-website-poc-v0.39.html and
   v1.95.html. Every click on either page threw a ReferenceError and nothing
   replayed.

   Delegated from the document rather than bound per button, because the markup
   is emitted by a lib function on two pages and neither of them imports a page
   script that could bind it. */
function initClbReplay() {
  document.addEventListener("click", (ev) => {
    const btn = (ev.target as Element | null)?.closest?.(".clb-replay");
    const wrap = btn?.closest(".clbwrap") as HTMLElement | null;
    if (!wrap) return;
    /* Drop the animation, force a reflow so the removal is actually committed,
       then hand it back. Without the reflow the two style writes coalesce into
       one and nothing restarts -- the POC did the same three steps. The mesh,
       orb and pulse loop forever and are left alone; only the two phases and
       the comets are one-shot. */
    const els = Array.from(wrap.querySelectorAll(".cba, .cbb, .cmt")) as (HTMLElement | SVGElement)[];
    els.forEach((e) => (e.style.animation = "none"));
    void wrap.offsetWidth;
    els.forEach((e) => (e.style.animation = ""));
  });
}

initSkyDepth();
initBandSky();
initClbReplay();
initBandTrace();
initReviewIds();
initVerifyFlags();
/* Some pages build their content in a page script that runs after this one
   (the compare matrix, the TCO table). Flagging is idempotent — already
   wrapped text is skipped — so a second pass after load catches those. */
window.addEventListener("load", () => initVerifyFlags());
initHubSpot();
initEasterEggLoader();

/* No static imports above, so mark this a module: without it the file is a
   global script and its top-level names collide with the other page scripts. */
export {};
