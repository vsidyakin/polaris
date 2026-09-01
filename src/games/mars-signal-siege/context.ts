/* Mars: Signal Siege — the shared runtime, hung off the Phaser registry.
 *
 * One object holds what every scene needs: input, audio, progress, the run
 * state, and the host callbacks. Scenes reach it with `getCtx(this)`, so no
 * scene imports another scene and teardown is a single `dispose()`.
 *
 * Input is tracked here rather than through Phaser's keyboard plugin because
 * the game is an overlay inside a site that owns the page. Phaser's plugin
 * installs global capture and swallows browser shortcuts; this tracker is fed
 * by listeners the host registers through `bind()`, and every one of them is
 * removed on dispose.
 */

import type Phaser from "phaser";
import { MarsAudio } from "./audio";
import { loadProgress, type Progress } from "./progress";
import { SECRET_SEQUENCE } from "./tuning";

const REGISTRY_KEY = "mss-ctx";

/** Keys the game consumes. Everything else is left to the browser so site
 *  shortcuts and browser chrome keep working while the egg is open. */
export const OWNED_KEYS = new Set([
  "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown",
  "KeyA", "KeyD", "KeyW", "KeyS",
  "KeyZ", "KeyX", "KeyJ", "ControlLeft",
  "KeyM", "KeyP", "KeyF", "KeyB",
  "Enter", "Space", "Escape",
  "Digit1", "Digit2", "Digit3", "Digit4",
  "Digit5", "Digit6", "Digit7", "Digit8",
]);

/** Keys whose browser default scrolls the page under the overlay. */
export const SCROLL_KEYS = new Set([
  "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Space",
]);

export class InputTracker {
  private held = new Set<string>();
  private fresh = new Set<string>();
  private secretPos = 0;
  private onSecret: (() => void) | null = null;

  down(...codes: string[]): boolean {
    return codes.some((c) => this.held.has(c));
  }

  /** True only on the frame the key went down. */
  pressed(...codes: string[]): boolean {
    return codes.some((c) => this.fresh.has(c));
  }

  /** Consume an edge, so one keypress cannot drive two actions in a frame. */
  take(...codes: string[]): boolean {
    for (const c of codes) {
      if (this.fresh.has(c)) {
        this.fresh.delete(c);
        return true;
      }
    }
    return false;
  }

  keyDown(code: string): void {
    if (!this.held.has(code)) this.fresh.add(code);
    this.held.add(code);
    this.trackSecret(code);
  }

  keyUp(code: string): void {
    this.held.delete(code);
  }

  /** The thirty-life sequence. Never surfaced in the UI; the only way to find
   *  it is to already know it. */
  setSecretHandler(fn: () => void): void {
    this.onSecret = fn;
  }

  private trackSecret(code: string): void {
    if (code === SECRET_SEQUENCE[this.secretPos]) {
      this.secretPos++;
      if (this.secretPos === SECRET_SEQUENCE.length) {
        this.secretPos = 0;
        this.onSecret?.();
      }
    } else {
      this.secretPos = code === SECRET_SEQUENCE[0] ? 1 : 0;
    }
  }

  endFrame(): void {
    this.fresh.clear();
  }

  clear(): void {
    this.held.clear();
    this.fresh.clear();
  }
}

/** State that outlives a single mission but not the game handle. */
export interface RunState {
  mission: number;
  /** Carried across missions; reset on game over. */
  lives: number;
  /** Set once the secret sequence has been entered this session. */
  secretLives: boolean;
  /** Which weapon the player holds. Reset to 0 on any hit. */
  weapon: number;
  /** Set while the ending is playing, to pick coreDown vs credits. */
  victoryPhase: "coreDown" | "credits";
}

/**
 * The DOM around the canvas that scenes are allowed to touch.
 *
 * Only the loading overlay, and only because it has to exist before Phaser
 * does: a splash drawn inside the canvas cannot cover the gap between the
 * player pressing GO and the first Phaser frame, which is exactly the gap that
 * needs covering.
 */
export interface ShellNodes {
  root: HTMLElement;
  mount: HTMLElement;
  loading: HTMLElement;
  loadingText: HTMLElement;
  bar: HTMLElement;
}

export interface MarsContext {
  shell: ShellNodes;
  audio: MarsAudio;
  input: InputTracker;
  progress: Progress;
  run: RunState;
  reduced: boolean;
  /** Host asked to be told the game wants to close (Escape at the top level). */
  requestClose(): void;
  /** Host owns the full/windowed frame; F only reports the keystroke. */
  requestToggleView(): void;
  onMuteChange(soundOn: boolean): void;
  bind(target: EventTarget, type: string, fn: EventListenerOrEventListenerObject,
       opts?: AddEventListenerOptions): void;
  dispose(): void;
}

export interface ContextOptions {
  shell: ShellNodes;
  requestClose: () => void;
  requestToggleView: () => void;
  onMuteChange: (soundOn: boolean) => void;
}

export function createContext(game: Phaser.Game, opts: ContextOptions): MarsContext {
  const bindings: (() => void)[] = [];
  const reduced =
    typeof matchMedia === "function" &&
    matchMedia("(prefers-reduced-motion: reduce)").matches;

  const ctx: MarsContext = {
    shell: opts.shell,
    audio: new MarsAudio(game),
    input: new InputTracker(),
    progress: loadProgress(),
    run: {
      mission: 0,
      lives: 3,
      secretLives: false,
      weapon: 0,
      victoryPhase: "coreDown",
    },
    reduced,
    requestClose: opts.requestClose,
    requestToggleView: opts.requestToggleView,
    onMuteChange: opts.onMuteChange,

    bind(target, type, fn, options) {
      target.addEventListener(type, fn, options);
      bindings.push(() => target.removeEventListener(type, fn, options));
    },

    dispose() {
      for (const off of bindings.splice(0)) off();
      ctx.audio.destroy();
      ctx.input.clear();
    },
  };

  return ctx;
}

export function attachCtx(game: Phaser.Game, ctx: MarsContext): void {
  game.registry.set(REGISTRY_KEY, ctx);
}

export function getCtx(scene: Phaser.Scene): MarsContext {
  return scene.registry.get(REGISTRY_KEY) as MarsContext;
}
