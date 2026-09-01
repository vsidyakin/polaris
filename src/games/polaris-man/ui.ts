/* Polaris-Man — the DOM shell and overlay screens.
 *
 * v1.7 rendered its menus as HTML over the canvas, and that is worth keeping:
 * the mission grid, briefing and pause rack are real focusable buttons, which
 * is the only reason the game is keyboard- and screen-reader-navigable at all.
 * Rebuilding them as canvas text would have been a downgrade.
 *
 * Every node this file creates lives under one root element, and `destroy()`
 * removes that root. There is no global state and no listener outside the
 * subtree, so opening and closing the egg leaves nothing behind.
 */

import {
  FINAL_MISSION, MISSIONS, MISSION_INTROS, ROSTERS, WEAPONS, ENEMY_DEF,
  type Mission, type MissionId, type MoonId, type WeaponId,
} from "./data";
import { LOADING_LOGO } from "./assets";
import { allMoonBossesDefeated, defeatedMissions, type Progress } from "./progress";
import {
  drawFinalPortrait, drawMissionHero, drawPolarisPortrait, drawPortrait,
  type ImageGetter,
} from "./render";

const esc = (s: string): string =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

export interface ShellNodes {
  root: HTMLDivElement;
  mount: HTMLDivElement;
  overlay: HTMLElement;
  toast: HTMLDivElement;
  touch: HTMLDivElement;
  loading: HTMLDivElement;
  bar: HTMLElement;
}

/** Build the game's DOM. The caller appends `root` wherever it likes. */
export function createShell(): ShellNodes {
  const root = document.createElement("div");
  root.className = "pm-root";
  root.dataset.scene = "boot";
  root.setAttribute("role", "group");
  root.setAttribute("aria-label", "Polaris-Man, Signal Breaker");

  const mount = document.createElement("div");
  mount.className = "pm-mount";
  mount.style.cssText = "position:absolute;inset:0;";

  const scan = document.createElement("div");
  scan.className = "pm-scan";
  const vignette = document.createElement("div");
  vignette.className = "pm-vignette";

  const toast = document.createElement("div");
  toast.className = "pm-toast";
  toast.setAttribute("role", "status");

  const overlay = document.createElement("section");
  overlay.className = "pm-overlay";
  overlay.setAttribute("aria-live", "polite");

  const touch = document.createElement("div");
  touch.className = "pm-touch";
  touch.setAttribute("aria-hidden", "true");
  touch.innerHTML = [
    ["pm-b-left", "ArrowLeft", "◀"],
    ["pm-b-right", "ArrowRight", "▶"],
    ["pm-b-jump", "KeyZ", "↑"],
    ["pm-b-fire", "KeyX", "●"],
    ["pm-b-dash", "KeyC", "»"],
    ["pm-b-use", "KeyE", "E"],
    ["pm-b-swap", "KeyQ", "Q"],
  ].map(([cls, key, label]) => `<button class="${cls}" data-vkey="${key}" tabindex="-1">${label}</button>`).join("");

  const build = document.createElement("div");
  build.className = "pm-build";
  build.textContent = "ORIGINAL MERSIVE IP · POLARIS-MAN";

  const loading = document.createElement("div");
  loading.className = "pm-loading";
  /* The mark is decorative — the status is carried by the text beneath it, which
     is what a screen reader should read, so the image is hidden from the tree. */
  loading.innerHTML =
    `<img class="pm-logo" src="${LOADING_LOGO}" alt="" aria-hidden="true" draggable="false">` +
    '<div class="pm-loading-text">Loading Uranus campaign</div>' +
    '<span class="pm-bar"><i></i></span>';
  const bar = loading.querySelector("i") as HTMLElement;

  root.append(mount, scan, vignette, toast, overlay, touch, build, loading);
  return { root, mount, overlay, toast, touch, loading, bar };
}

/* --- screen helpers --- */

export function clearOverlay(o: HTMLElement): void {
  o.className = "pm-overlay";
  o.innerHTML = "";
}

function show(o: HTMLElement, html: string, gameScreen = true): void {
  o.className = `pm-overlay pm-on${gameScreen ? " pm-game-screen" : ""}`;
  o.innerHTML = html;
}

export interface SelectHandlers {
  onMission(m: Mission): void;
  onFinal(): void;
}

/** The 3x3 mission grid, with the Polaris core in the centre. */
export function renderMissionSelect(
  o: HTMLElement, progress: Progress, getImage: ImageGetter, h: SelectHandlers,
): void {
  const secured = defeatedMissions(progress.cleared).length;
  const ready = allMoonBossesDefeated(progress.cleared);
  const slots: (Mission | null)[] = [
    MISSIONS[0], MISSIONS[1], MISSIONS[2],
    MISSIONS[3], null, MISSIONS[4],
    MISSIONS[5], MISSIONS[6], MISSIONS[7],
  ];

  const tiles = slots.map((m) => {
    if (m) {
      const done = progress.cleared[m.id];
      return `<button class="pm-tile${done ? " pm-cleared" : ""}" style="--pm-tile-accent:${m.accent}" data-m="${m.id}" aria-label="Boss ${esc(m.boss)}, ${esc(m.moon)}, ${esc(m.name)}${done ? ", cleared" : ""}">
        <canvas width="260" height="150" data-portrait="${m.id}" aria-hidden="true"></canvas>
        <span class="pm-label"><b>${esc(m.boss)}</b><small>${esc(m.moon)}</small></span>
        ${done ? '<span class="pm-done" aria-hidden="true">✓</span>' : ""}
      </button>`;
    }
    const label = ready ? (progress.finalCleared ? "REPLAY NEXUS" : "FINAL SIGNAL") : "POLARIS-MAN";
    const sub = ready ? "PROTOCOL PRIME · URANUS CORE" : `${secured} OF ${MISSIONS.length} SIGNALS SECURED`;
    return `<button class="pm-core${ready ? " pm-ready" : ""}" ${ready ? 'data-final="1"' : 'disabled aria-disabled="true"'} aria-label="${esc(label)}. ${esc(sub)}">
      <canvas width="260" height="150" data-core="1" aria-hidden="true"></canvas>
      <span class="pm-label pm-core-label"><b>${esc(label)}</b><small>${esc(sub)}</small></span>
    </button>`;
  }).join("");

  show(o, `<section class="pm-mission-screen">
    <header class="pm-head"><div class="pm-kicker">Mersive · Uranus Campaign</div><h2>Select Mission</h2></header>
    <div class="pm-grid">${tiles}</div>
    <footer class="pm-footer">
      <span class="pm-progress">${secured} / ${MISSIONS.length} BOSSES DEFEATED</span>
      <span>ARROWS / CLICK: SELECT · M: MUTE · N: NEW CAMPAIGN</span>
    </footer>
  </section>`);

  o.querySelectorAll<HTMLButtonElement>("[data-m]").forEach((b) => {
    b.onclick = () => {
      const m = MISSIONS.find((q) => q.id === b.dataset.m);
      if (m) h.onMission(m);
    };
  });
  o.querySelector<HTMLButtonElement>("[data-final]")?.addEventListener("click", h.onFinal);

  o.querySelectorAll<HTMLCanvasElement>("canvas[data-portrait]").forEach((c) => {
    const m = MISSIONS.find((q) => q.id === c.dataset.portrait);
    if (m) drawPortrait(c, m, getImage);
  });
  const core = o.querySelector<HTMLCanvasElement>("canvas[data-core]");
  if (core) {
    if (ready) drawFinalPortrait(core, getImage);
    else drawPolarisPortrait(core, getImage);
  }

  (o.querySelector(".pm-grid button:not([disabled])") as HTMLButtonElement | null)?.focus({ preventScroll: true });
}

export interface IntroHandlers {
  onLaunch(): void;
  onBack(): void;
}

export function renderMissionIntro(
  o: HTMLElement, m: Mission, progress: Progress, getImage: ImageGetter, h: IntroHandlers,
): void {
  const intro = MISSION_INTROS[m.id];
  const final = m.id === "final";
  const hostiles = final
    ? "EIGHT LEGACY PROTOCOLS"
    : ROSTERS[m.id as MoonId].map((t) => ENEMY_DEF[t].name).join(" · ");
  const cta = final ? "Enter Polaris Nexus" : progress.cleared[m.id] ? "Replay Mission" : "Launch Mission";

  show(o, `<section class="pm-intro-screen" style="--pm-intro-accent:${m.accent}">
    <canvas class="pm-intro-hero" width="960" height="540" aria-hidden="true"></canvas>
    <div class="pm-intro-copy">
      <div class="pm-kicker">${esc(m.moon)} · ${esc(m.name)} · ${esc(m.theme)}</div>
      <h2>${esc(intro.title)}</h2>
      <h3>${esc(m.boss)}</h3>
      <p>${esc(intro.body)}</p>
      <p class="pm-hostiles"><b>Hostiles</b> ${esc(hostiles)}</p>
      <div class="pm-objective"><small>Mission objective</small><b>${esc(intro.objective)}</b></div>
      <div class="pm-actions">
        <button data-launch="1">${esc(cta)}</button>
        <button data-back="1">Return to Mission Select</button>
      </div>
    </div>
  </section>`);

  const c = o.querySelector("canvas") as HTMLCanvasElement;
  drawMissionHero(c, m, getImage);

  const launch = o.querySelector<HTMLButtonElement>("[data-launch]")!;
  launch.onclick = h.onLaunch;
  o.querySelector<HTMLButtonElement>("[data-back]")!.onclick = h.onBack;
  launch.focus({ preventScroll: true });
}

export interface PauseHandlers {
  onWeapon(id: WeaponId): void;
  onResume(): void;
  onRetry(): void;
  onSelect(): void;
  onSound(): void;
}

export function renderPause(
  o: HTMLElement, progress: Progress, activeWeapon: WeaponId, soundOn: boolean, h: PauseHandlers,
): void {
  const rack = progress.weapons.map((w) => {
    const def = WEAPONS[w];
    return `<button class="pm-weapon${activeWeapon === w ? " pm-active" : ""}" style="--pm-weapon:${def.color}" data-w="${w}">
      <b>${esc(def.name)}</b><small>${esc(def.desc)}</small></button>`;
  }).join("");

  show(o, `<section class="pm-pause-screen">
    <header class="pm-pause-title"><p>Polaris capability rack</p><h2>Paused</h2></header>
    <div class="pm-weapons">${rack}</div>
    <footer class="pm-actions">
      <button data-a="resume">Resume · P</button>
      <button data-a="retry">Restart Mission</button>
      <button data-a="select">Mission Select</button>
      <button data-a="sound">Sound: ${soundOn ? "On" : "Off"}</button>
    </footer>
  </section>`);

  o.querySelectorAll<HTMLButtonElement>("[data-w]").forEach((b) => {
    b.onclick = () => h.onWeapon(b.dataset.w as WeaponId);
  });
  o.querySelectorAll<HTMLButtonElement>("[data-a]").forEach((b) => {
    b.onclick = () => {
      const a = b.dataset.a;
      if (a === "resume") h.onResume();
      else if (a === "retry") h.onRetry();
      else if (a === "select") h.onSelect();
      else h.onSound();
    };
  });
  o.querySelector<HTMLButtonElement>('[data-a="resume"]')?.focus({ preventScroll: true });
}

export function renderControls(o: HTMLElement, doubleJump: boolean, onBack: () => void): void {
  show(o, `<section class="pm-pause-screen">
    <header class="pm-head"><div class="pm-kicker">Polaris-Man Field Manual</div><h2>Controls</h2></header>
    <div class="pm-controls">
      <kbd>← → / A D</kbd><span>Move</span>
      <kbd>Z / K / ↑</kbd><span>Jump / wall rebound${doubleJump ? " / double jump" : ""}</span>
      <kbd>X / J</kbd><span>Tap to fire · hold Polaris Pulse 2 sec for 3× damage</span>
      <kbd>C / L</kbd><span>Vector dash</span>
      <kbd>E / ↓</kbd><span>Secure checkpoint terminal</span>
      <kbd>Q / R</kbd><span>Cycle earned weapons</span>
      <kbd>P</kbd><span>Pause / weapon rack</span>
      <kbd>M</kbd><span>Mute</span>
      <kbd>Esc</kbd><span>Close the game</span>
    </div>
    <div class="pm-actions"><button>Return to Mission Select</button></div>
  </section>`);
  const b = o.querySelector("button")!;
  b.onclick = onBack;
  b.focus({ preventScroll: true });
}

export function renderFailed(
  o: HTMLElement, m: Mission,
  h: { onResume(): void; onRestart(): void; onSelect(): void },
): void {
  const copy = m.id === "final"
    ? "Polaris Nexus remains within reach."
    : "Your last secured workspace checkpoint is still online. Enemy and sector progress is preserved.";
  show(o, `<section class="pm-pause-screen pm-failed-scene">
    <header class="pm-head"><div class="pm-kicker">Signal Lost</div><h2>${esc(m.moon)} WENT DARK</h2></header>
    <p>${esc(copy)}</p>
    <div class="pm-actions">
      <button data-a="resume">Resume from Checkpoint</button>
      <button data-a="restart">Restart Mission</button>
      <button data-a="select">Return to Mission Select</button>
    </div>
  </section>`);
  o.querySelectorAll<HTMLButtonElement>("button").forEach((b) => {
    b.onclick = () => {
      const a = b.dataset.a;
      if (a === "resume") h.onResume();
      else if (a === "restart") h.onRestart();
      else h.onSelect();
    };
  });
  o.querySelector<HTMLButtonElement>('[data-a="resume"]')?.focus({ preventScroll: true });
}

export function renderVictory(o: HTMLElement, m: Mission, onNext: () => void): void {
  const final = m.id === "final";
  const copy = final
    ? "Protocol Prime can no longer divide the workspace."
    : m.id === "ariel"
      ? "Dongle Baron’s pairing network has collapsed. Ariel’s displays are open again—no hardware token stands between the user and the workspace."
      : "Its capability is ready to integrate into Polaris-Man.";
  show(o, `<section class="pm-pause-screen pm-victory-scene">
    <header class="pm-head"><div class="pm-kicker">${final ? "Polaris Nexus Secured" : "Moon Signal Restored"}</div><h2>Congratulations</h2></header>
    <p><b style="color:${m.accent}">${esc(m.boss)}</b> has been destroyed.<br>${esc(copy)}</p>
    <div class="pm-actions"><button>${final ? "Complete Campaign" : "Integrate Capability"}</button></div>
  </section>`);
  const b = o.querySelector("button")!;
  b.onclick = onNext;
  b.focus({ preventScroll: true });
}

export function renderReward(
  o: HTMLElement, m: Mission, progress: Progress, firstClear: boolean,
  h: { onSelect(): void; onFinal(): void },
): void {
  const w = WEAPONS[m.weapon];
  const secured = defeatedMissions(progress.cleared).length;
  const ready = allMoonBossesDefeated(progress.cleared);
  const benefit = m.id === "ariel"
    ? "Browser-based sharing opens a direct software signal path and replaces the Baron’s pairing ritual. Guests can reach the wireless workspace without carrying his hardware through the gate."
    : m.tag;
  const chips = progress.weapons
    .map((v) => `<span class="pm-chip pm-on" style="color:${WEAPONS[v].color}">${esc(WEAPONS[v].short)}</span>`)
    .join("") + (progress.abilities.doubleJump ? '<span class="pm-chip pm-on" style="color:#61c8dc">DOUBLE JUMP</span>' : "");

  show(o, `<section class="pm-pause-screen pm-reward-scene">
    <header class="pm-head"><div class="pm-kicker">Capability Integrated · ${secured} / ${MISSIONS.length}</div><h2 style="color:${w.color}">${esc(w.name)}</h2></header>
    <p>${esc(w.desc)}.<br><br>${esc(benefit)}${firstClear ? '<br><br><b style="color:#61c8dc">VECTOR DOUBLE JUMP ONLINE</b> — press jump again while airborne.' : ""}</p>
    <div class="pm-rack">${chips}</div>
    <div class="pm-actions">
      <button data-a="select">Return to Uranus</button>
      ${ready ? '<button data-a="final">Enter Polaris Nexus</button>' : ""}
    </div>
  </section>`);
  o.querySelectorAll<HTMLButtonElement>("button").forEach((b) => {
    b.onclick = () => (b.dataset.a === "final" ? h.onFinal() : h.onSelect());
  });
  o.querySelector<HTMLButtonElement>('[data-a="select"]')?.focus({ preventScroll: true });
}

export { FINAL_MISSION };
export type { MissionId };
