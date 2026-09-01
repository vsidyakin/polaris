/* SOLAR CIRCUIT — mount and teardown.
 *
 * The only export the site touches. `mountSolarRoad(host)` builds the game
 * inside `host` and hands back a handle; `handle.destroy()` returns the DOM,
 * every listener and the Phaser instance to nothing.
 *
 * The game itself is a port of Phaser3-Road (MIT, see
 * public/eggs/solar-road/ATTRIBUTION.md). Upstream is a standalone page that
 * builds one `Phaser.Game` at module scope and never tears it down. This egg
 * can be opened and closed any number of times in one page life, so that had to
 * change, and the teardown contract is the reason this file exists:
 *
 *   - every listener goes through bind(), which records its own removal
 *   - the Phaser instance and its canvas die with game.destroy(true)
 *   - the shell subtree is removed from the DOM
 *   - `destroyed` guards against a double close
 *
 * Nothing here is registered on `window` that outlives the handle. It is the
 * same contract Polaris-Man honours in `src/games/polaris-man/index.ts`, and
 * for the same reason.
 */

import Phaser from "phaser";
import "./solar-road.css";
import { VIEW } from "./view";
import { attachInput, OWNED_KEYS, RoadInput } from "./input";
import BootScene from "./boot-scene";
import RoadScene, { AUDIO_KEY, type RoadAudio } from "./game-scene";
import MenuScene from "./menu-scene";

export interface SolarRoadHandle {
  /** Tear everything down. Safe to call more than once. */
  destroy(): void;
  /** Pause without releasing anything (tab hidden, or the modal parked). */
  suspend(): void;
  resume(): void;
  /** True once destroy() has run. */
  readonly destroyed: boolean;
}

export interface MountOptions {
  /**
   * Called once per Phaser frame.
   *
   * The site's chiptune sequencer is pull-based — `EggAudio.musicTick()` has to
   * be called every frame by whoever is rendering, or the pattern never
   * advances. The canvas eggs call it from their own requestAnimationFrame
   * loops; this game's loop belongs to Phaser, so the host passes the call in.
   * Same arrangement as `solarStart()`'s `onTick` in solar3d.ts.
   */
  onTick?: () => void;

  /** What the game should sound like. See `RoadAudio` in game-scene.ts. */
  audio?: RoadAudio;
}

export function mountSolarRoad(host: HTMLElement, opts: MountOptions = {}): SolarRoadHandle {
  let destroyed = false;

  /* --- shell --- */
  const root = document.createElement("div");
  root.className = "sr-root";
  root.setAttribute("role", "group");
  root.setAttribute("aria-label", "Solar Circuit");

  const mount = document.createElement("div");
  mount.className = "sr-mount";
  root.appendChild(mount);
  host.appendChild(root);

  /* --- listener bookkeeping --- */
  const unbinds: Array<() => void> = [];
  const bind = (target: EventTarget, type: string, fn: EventListener, o?: AddEventListenerOptions) => {
    target.addEventListener(type, fn, o);
    unbinds.push(() => target.removeEventListener(type, fn, o));
  };

  const input = new RoadInput();

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: mount,
    width: VIEW.W,
    height: VIEW.H,
    backgroundColor: "#72d7ee",
    pixelArt: true,
    antialias: false,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    /* The site owns the page. Phaser's keyboard plugin captures on `window` for
       the life of the game, which would outlive the overlay and swallow the
       browser's own shortcuts — so the mount drives input instead. See input.ts. */
    input: { keyboard: false, gamepad: false },
    /* Upstream forces WEBGL. AUTO here for the same reason Mission Control has a
       2D fallback: a machine without WebGL should get a playable game, not a
       blank panel. */
    banner: false,
    scene: [BootScene, MenuScene, RoadScene],
  });

  attachInput(game, input);
  if (opts.audio) game.registry.set(AUDIO_KEY, opts.audio);

  /* --- keyboard ---
   *
   * Bound to the document rather than the shell. Scoping it to the subtree
   * looks tidier and does not work: a keyboard event only reaches an element
   * when focus is inside it, and the moment the player clicks the overlay's ✕
   * or mute button focus leaves the game and every control goes dead. Polaris-
   * Man has the same note on the same decision.
   *
   * Only the four arrow keys are claimed. M and Escape stay with the site's own
   * handler in eggs/runtime.ts, which is what every other egg does. */
  const onKeyDown = (ev: Event) => {
    if (destroyed) return;
    const e = ev as KeyboardEvent;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (!OWNED_KEYS.has(e.code)) return;
    /* Leave the overlay's own controls alone.
     *
     * The menus claim Enter and Space, and the modal's ✕ and mute are real
     * buttons: a keyboard user who tabs onto one and presses Enter expects it to
     * fire, and `preventDefault` on the keydown is exactly what stops a focused
     * button activating. Claiming a key globally is fine; claiming it out from
     * under whatever the user has deliberately focused is not. */
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === "BUTTON" || target.tagName === "A" || target.tagName === "INPUT")) {
      return;
    }
    input.keyDown(e.code);
    /* Arrows scroll the page underneath the modal otherwise. */
    e.preventDefault();
  };

  const onKeyUp = (ev: Event) => {
    if (destroyed) return;
    input.keyUp((ev as KeyboardEvent).code);
  };

  bind(document, "keydown", onKeyDown);
  bind(document, "keyup", onKeyUp);

  /* Leaving the page with a key physically down would otherwise leave the car
     steering into the grass on its own until the player came back and pressed
     the same key again. */
  bind(window, "blur", () => input.clear());

  /* --- tab visibility --- */
  bind(document, "visibilitychange", () => {
    if (destroyed) return;
    if (document.hidden) handle.suspend();
    else handle.resume();
  });

  /* --- music pump --- */
  const onStep = () => {
    if (destroyed) return;
    opts.onTick?.();
  };
  game.events.on(Phaser.Core.Events.PRE_STEP, onStep);

  const handle: SolarRoadHandle = {
    get destroyed() {
      return destroyed;
    },

    suspend() {
      if (destroyed) return;
      input.clear();
      game.loop.sleep();
      /* The loop is what feeds the engine, so parking it would otherwise leave
         the drone holding whatever note it was on for as long as the tab stayed
         hidden. Wind it down explicitly. */
      opts.audio?.engine?.(0);
    },

    resume() {
      if (destroyed) return;
      game.loop.wake();
    },

    destroy() {
      if (destroyed) return;
      destroyed = true;
      game.events.off(Phaser.Core.Events.PRE_STEP, onStep);
      while (unbinds.length) unbinds.pop()!();
      /* `true` removes the canvas Phaser created; the second arg leaves the
         Phaser global alone, which matters because the site may open this egg
         — or Polaris-Man — again in the same page. */
      game.destroy(true, false);
      root.remove();
    },
  };

  /* Focus the shell so the arrow keys work immediately after opening, without
     the player having to click into the canvas first. */
  root.tabIndex = -1;
  root.focus({ preventScroll: true });

  return handle;
}

export default mountSolarRoad;
