/* Polaris-Man — mount and teardown.
 *
 * The only export the site touches. `mountPolarisMan(host)` builds the game
 * inside `host` and hands back a handle; `handle.destroy()` returns the DOM,
 * the audio graph, every listener and the Phaser instance to nothing.
 *
 * The egg can be opened and closed any number of times in one page life, so the
 * teardown contract is the important part of this file:
 *
 *   - every listener goes through ctx.bind(), which records its removal
 *   - the AudioContext belongs to Phaser and dies with game.destroy(true)
 *   - the canvas texture is destroyed with the game
 *   - the shell subtree is removed from the DOM
 *   - `destroyed` guards against a double close
 *
 * Nothing here is registered on `window` that outlives the handle.
 */

import Phaser from "phaser";
import "./polaris-man.css";
import { VIEW } from "./tuning";
import { createShell } from "./ui";
import { attachCtx, createContext, OWNED_KEYS, SCROLL_KEYS, type PolarisManContext } from "./context";
import { PlayScene, SCENE, SCENE_LIST } from "./scenes";

export interface PolarisManHandle {
  /** Tear everything down. Safe to call more than once. */
  destroy(): void;
  /** Pause and silence, without releasing anything (tab hidden). */
  suspend(): void;
  resume(): void;
  /** True once destroy() has run. */
  readonly destroyed: boolean;
  /** Flip mute. Returns the new sound-on state.
   *  The game owns its own audio graph, separate from the site's EggAudio, so
   *  the overlay's mute button has to come through here rather than through
   *  eggToggleMute() — which would silence the site and leave the game playing. */
  toggleMute(): boolean;
  /** Current sound-on state, for syncing the overlay button on open. */
  readonly soundOn: boolean;
}

export interface MountOptions {
  /** Called when the game asks to close itself (Escape). */
  onRequestClose?: () => void;
  /**
   * Element the keyboard listeners attach to. Defaults to the game shell.
   * The host passes the whole modal so Escape still works when focus is on the
   * modal's own close button, which sits outside the shell — while keeping the
   * listeners on a subtree that is removed on destroy rather than on `window`.
   */
  keyboardTarget?: HTMLElement;
  /** Fired whenever mute changes from inside the game (the M key), so the host
   *  can keep its own button icon in step. */
  onMuteChange?: (soundOn: boolean) => void;
  /** F pressed. The host owns the full/windowed frame — the game only reports
   *  the keystroke, because the frame is the site's furniture, not the game's. */
  onToggleView?: () => void;
}

export function mountPolarisMan(host: HTMLElement, opts: MountOptions = {}): PolarisManHandle {
  const shell = createShell();
  host.appendChild(shell.root);

  let destroyed = false;
  let ctx: PolarisManContext;

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: shell.mount,
    width: VIEW.W * VIEW.ZOOM,
    height: VIEW.H * VIEW.ZOOM,
    backgroundColor: "#080613",
    pixelArt: true,
    antialias: false,
    roundPixels: true,
    /* No Arcade Physics: the game ships its own resolver. See physics.ts. */
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    audio: { disableWebAudio: false },
    scene: SCENE_LIST,
    /* The site owns the page; the game must not install its own global
       keyboard capture or swallow the browser's shortcuts. */
    input: { keyboard: false, gamepad: false },
    banner: false,
  });

  const requestClose = () => opts.onRequestClose?.();
  ctx = createContext(game, shell, requestClose);
  attachCtx(game, ctx);

  /* --- keyboard ---
     Bound to the shell, not window, and only while it holds focus or the
     pointer. Escape always bubbles the close request; everything else is only
     consumed if it is a key the game actually uses. */
  const onKeyDown = (ev: Event) => {
    const e = ev as KeyboardEvent;
    if (destroyed) return;

    if (e.code === "Escape") {
      const play = game.scene.getScene(SCENE.PLAY) as PlayScene | null;
      if (play?.scene.isActive() && play.isRunning) {
        play.pauseGame();
        e.preventDefault();
        return;
      }
      /* Not mid-mission: Escape closes the whole experience. */
      requestClose();
      return;
    }

    if (!OWNED_KEYS.has(e.code)) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;

    /* Let the browser drive focus between the overlay's real buttons. */
    const onButton = (e.target as HTMLElement)?.closest?.("button");
    if (onButton && (e.code === "Enter" || e.code === "Space")) return;

    ctx.audio.init();

    if (e.code === "KeyM") {
      const on = ctx.audio.toggleMute();
      ctx.toast(`SOUND ${on ? "ON" : "OFF"}`, 1);
      opts.onMuteChange?.(on);
      e.preventDefault();
      return;
    }

    if (e.code === "KeyF") {
      opts.onToggleView?.();
      e.preventDefault();
      return;
    }

    ctx.input.keyDown(e.code);
    if (SCROLL_KEYS.has(e.code)) e.preventDefault();
    if (e.code === "Space" && !onButton) e.preventDefault();
  };

  const onKeyUp = (ev: Event) => {
    if (destroyed) return;
    ctx.input.keyUp((ev as KeyboardEvent).code);
  };

  /* Bound to the document, not the modal.
   *
   * Scoping key handling to the modal subtree looks tidier and is broken: a
   * keyboard event only reaches an element when focus is inside it, and the
   * game destroys the focused element on nearly every transition. Pressing
   * "Launch Mission" focuses that button, PlayScene then clears the overlay,
   * the button is removed, focus falls back to <body> — which is outside the
   * modal — and from that moment every control is dead until the player happens
   * to click back inside. Move, jump, fire and dash all silently stop working.
   *
   * The document listener has no such dependency, and it is still registered
   * through ctx.bind(), so it is removed on destroy exactly like the others.
   * While Polaris-Man is mounted it owns these keys outright; the site's own
   * handler defers to it (see the egg9 guard in eggs/runtime.ts). */
  const keyTarget: EventTarget = opts.keyboardTarget ?? document;
  ctx.bind(keyTarget, "keydown", onKeyDown);
  ctx.bind(keyTarget, "keyup", onKeyUp);

  /* Only a real departure from the page should drop held keys. focusout fires
   * every time the game swaps a screen, and clearing on that left the player
   * mid-jump with the key still physically down. */
  ctx.bind(window, "blur", () => ctx.input.clear());
  ctx.bind(window, "blur", () => {
    ctx.input.clear();
    const play = game.scene.getScene(SCENE.PLAY) as PlayScene | null;
    if (play?.scene.isActive() && play.isRunning) play.pauseGame();
  });

  /* --- touch --- */
  shell.touch.querySelectorAll<HTMLButtonElement>("button").forEach((b) => {
    const key = b.dataset.vkey!;
    const down = (e: Event) => {
      e.preventDefault();
      ctx.audio.init();
      ctx.input.vDown(key);
    };
    const up = (e: Event) => {
      e.preventDefault();
      ctx.input.vUp(key);
    };
    ctx.bind(b, "pointerdown", down);
    ctx.bind(b, "pointerup", up);
    ctx.bind(b, "pointercancel", up);
    ctx.bind(b, "pointerleave", up);
  });

  /* --- tab visibility --- */
  const onVisibility = () => {
    if (destroyed) return;
    if (document.hidden) handle.suspend();
    else handle.resume();
  };
  ctx.bind(document, "visibilitychange", onVisibility);

  /* --- gamepad, polled from the game loop --- */
  const onStep = () => {
    if (destroyed) return;
    ctx.input.pollPad(() => {
      const play = game.scene.getScene(SCENE.PLAY) as PlayScene | null;
      if (play?.scene.isActive() && play.isRunning) play.pauseGame();
    });
  };
  game.events.on(Phaser.Core.Events.PRE_STEP, onStep);

  const handle: PolarisManHandle = {
    get destroyed() {
      return destroyed;
    },

    get soundOn() {
      return !ctx.audio.isMuted;
    },

    toggleMute() {
      if (destroyed) return false;
      const on = ctx.audio.toggleMute();
      ctx.toast(`SOUND ${on ? "ON" : "OFF"}`, 1);
      return on;
    },

    suspend() {
      if (destroyed) return;
      ctx.audio.suspend();
      ctx.input.clear();
      const play = game.scene.getScene(SCENE.PLAY) as PlayScene | null;
      if (play?.scene.isActive() && play.isRunning) play.pauseGame();
      game.loop.sleep();
    },

    resume() {
      if (destroyed) return;
      game.loop.wake();
      ctx.audio.resume();
    },

    destroy() {
      if (destroyed) return;
      destroyed = true;
      game.events.off(Phaser.Core.Events.PRE_STEP, onStep);
      ctx.dispose();
      /* `true` removes the canvas Phaser created; the second arg leaves the
         Phaser global alone, which matters because the site may open the egg
         again in the same page. */
      game.destroy(true, false);
      shell.root.remove();
    },
  };

  /* Focus the shell so keyboard play works immediately after opening, without
     the player having to click into the canvas first. */
  shell.root.tabIndex = -1;
  shell.root.focus({ preventScroll: true });

  return handle;
}

export default mountPolarisMan;
