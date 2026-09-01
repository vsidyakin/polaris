/* Polaris-Man — the shared runtime, hung off the Phaser registry.
 *
 * One object holds everything the scenes need and nothing they do not: the DOM
 * shell, the renderer, the audio manager, progress, and input. Scenes reach it
 * with `getCtx(this)`, so no scene imports another scene, and teardown is a
 * single `dispose()`.
 *
 * Input deserves a note. v1.7 attached keydown/keyup to `window` and never
 * removed them, which is fine for a page that only ever holds one game and
 * fatal for an overlay that opens and closes inside a long-lived site. Here
 * every listener is registered through `bind()`, which records its own removal,
 * and keyboard events are only consumed while the shell is actually open.
 */

import { VIEW } from "./tuning";
import { AudioManager } from "./audio";
import { Renderer, type ImageGetter } from "./render";
import { loadProgress, type Progress } from "./progress";
import type { ShellNodes } from "./ui";
import type { Mission } from "./data";
import type { World } from "./state";
import type { Input } from "./sim";

const REGISTRY_KEY = "pm-ctx";

/** Keys the game consumes. Anything outside this set is left to the browser,
 *  so site shortcuts and browser chrome keep working while the egg is open. */
const OWNED_KEYS = new Set([
  "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown",
  "KeyA", "KeyD", "KeyW", "KeyS",
  "KeyZ", "KeyX", "KeyC", "KeyE", "KeyQ", "KeyR", "KeyJ", "KeyK", "KeyL",
  "KeyM", "KeyN", "KeyP", "KeyF",
  "BracketLeft", "BracketRight",
  "Enter", "Space",
]);

/** Keys we actively prevent the browser from acting on, because their default
 *  scrolls the page under the overlay. Deliberately does not include Space
 *  unless a mission is running — see `setScrollLock`. */
const SCROLL_KEYS = new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"]);

export class InputTracker implements Input {
  private held = new Set<string>();
  private fresh = new Set<string>();
  private virtual = new Set<string>();
  private pad: Record<string, boolean> = {};
  /** While false, gameplay keys are ignored (menus, or the game is closing). */
  private capturing = false;

  down(...codes: string[]): boolean {
    return codes.some((c) => this.held.has(c) || this.virtual.has(c));
  }

  was(...codes: string[]): boolean {
    return codes.some((c) => this.fresh.has(c));
  }

  setCapturing(on: boolean): void {
    this.capturing = on;
    if (!on) this.clear();
  }

  get isCapturing(): boolean {
    return this.capturing;
  }

  keyDown(code: string): void {
    if (!this.held.has(code)) this.fresh.add(code);
    this.held.add(code);
  }

  keyUp(code: string): void {
    this.held.delete(code);
  }

  vDown(code: string): void {
    if (!this.virtual.has(code)) this.fresh.add(code);
    this.virtual.add(code);
  }

  vUp(code: string): void {
    this.virtual.delete(code);
  }

  /** Call at the end of every frame. */
  endFrame(): void {
    this.fresh.clear();
  }

  clear(): void {
    this.held.clear();
    this.virtual.clear();
    this.fresh.clear();
    this.pad = {};
  }

  /** Gamepad, polled once per frame. Mirrors v1.7's mapping. */
  pollPad(onStart: () => void): void {
    const gp = navigator.getGamepads?.();
    const p = gp && gp[0];
    if (!p) return;
    const map: Record<string, boolean> = {
      ArrowLeft: p.axes[0] < -0.35,
      ArrowRight: p.axes[0] > 0.35,
      KeyZ: !!p.buttons[0]?.pressed,
      KeyX: !!p.buttons[2]?.pressed,
      KeyC: !!p.buttons[1]?.pressed,
      KeyE: !!p.buttons[3]?.pressed,
      KeyQ: !!p.buttons[5]?.pressed,
      KeyR: !!p.buttons[4]?.pressed,
    };
    for (const [k, v] of Object.entries(map)) {
      if (v && !this.pad[k]) this.fresh.add(k);
      if (v) this.virtual.add(k);
      else this.virtual.delete(k);
    }
    const start = !!p.buttons[9]?.pressed;
    if (start && !this.pad.Start) onStart();
    this.pad = { ...map, Start: start };
  }
}

export interface PolarisManContext {
  shell: ShellNodes;
  audio: AudioManager;
  input: InputTracker;
  progress: Progress;
  renderer: Renderer;
  /** The 320x180 texture every scene paints into. */
  frameTexture: Phaser.Textures.CanvasTexture;
  reduced: boolean;
  /** Monotonic animation clock, seconds. */
  clock: number;
  /** Live mission, when one is running. */
  world: World | null;
  mission: Mission | null;
  /** Set by the host so the game can ask to be closed (Escape, close button). */
  requestClose(): void;
  toast(msg: string, seconds?: number): void;
  getImage: ImageGetter;
  /** Register a listener and get automatic removal on dispose. */
  bind(target: EventTarget, type: string, fn: EventListenerOrEventListenerObject, opts?: AddEventListenerOptions): void;
  dispose(): void;
  /** Internal: toast countdown, ticked by the active scene. */
  toastT: number;
}

export function createContext(
  game: Phaser.Game,
  shell: ShellNodes,
  requestClose: () => void,
): PolarisManContext {
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* The buffer is 640x360 with a 2x transform, exactly as v1.7 did it. Drawing
     at 2x and displaying 1:1 is not the same as drawing at 1x and scaling: the
     8px HUD type, the gradients and every stroked path are rasterised at twice
     the resolution. Rendering into a 320x180 buffer would be "the same pixels"
     only for the axis-aligned rects, and visibly coarser for everything else. */
  const frameTexture = game.textures.createCanvas("pm-frame", VIEW.W * VIEW.ZOOM, VIEW.H * VIEW.ZOOM)!;
  const c2d = frameTexture.getContext();
  c2d.setTransform(VIEW.ZOOM, 0, 0, VIEW.ZOOM, 0, 0);
  c2d.imageSmoothingEnabled = false;

  const getImage: ImageGetter = (key) => {
    if (!game.textures.exists(key)) return null;
    const src = game.textures.get(key).getSourceImage();
    return src instanceof HTMLImageElement || src instanceof HTMLCanvasElement ? src : null;
  };

  const bindings: (() => void)[] = [];

  const ctx: PolarisManContext = {
    shell,
    audio: new AudioManager(game),
    input: new InputTracker(),
    progress: loadProgress(),
    renderer: new Renderer(c2d, getImage),
    frameTexture,
    reduced,
    clock: 0,
    world: null,
    mission: null,
    requestClose,
    toastT: 0,
    getImage,

    toast(msg: string, seconds = 2) {
      const t = shell.toast;
      t.style.setProperty("--pm-toast-accent", ctx.mission?.accent ?? "#b9a8ff");
      t.textContent = msg;
      t.classList.add("pm-show");
      ctx.toastT = seconds;
    },

    bind(target, type, fn, opts) {
      target.addEventListener(type, fn, opts);
      bindings.push(() => target.removeEventListener(type, fn, opts));
    },

    dispose() {
      for (const off of bindings.splice(0)) off();
      ctx.audio.destroy();
      ctx.input.clear();
      ctx.world = null;
      ctx.mission = null;
    },
  };

  return ctx;
}

export function attachCtx(game: Phaser.Game, ctx: PolarisManContext): void {
  game.registry.set(REGISTRY_KEY, ctx);
}

export function getCtx(scene: Phaser.Scene): PolarisManContext {
  return scene.registry.get(REGISTRY_KEY) as PolarisManContext;
}

export { OWNED_KEYS, SCROLL_KEYS };
