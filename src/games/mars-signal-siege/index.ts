/* Mars: Signal Siege — mount and teardown.
 *
 * The only export the site touches. `mountMarsSignalSiege(host)` builds the
 * game inside `host` and hands back a handle; `handle.destroy()` returns the
 * DOM, the audio graph, every listener and the Phaser instance to nothing.
 *
 * Mars can be opened and closed any number of times in one page life, so the
 * teardown contract is the important part of this file:
 *
 *   - every listener goes through ctx.bind(), which records its own removal
 *   - the audio graph belongs to Phaser and dies with game.destroy(true)
 *   - the canvas Phaser created is removed with it
 *   - the shell subtree leaves the DOM
 *   - `destroyed` guards a double close, so a second call is a no-op rather
 *     than a second teardown of an already-dead game
 *
 * Nothing here is registered on `window` that outlives the handle.
 */

import Phaser from "phaser";
import "./mars-signal-siege.css";
import { VIEW } from "./tuning";
import {
  attachCtx, createContext, OWNED_KEYS, SCROLL_KEYS,
  type MarsContext, type ShellNodes,
} from "./context";
import { LOADING_LOGO } from "./assets";
import { PreloadScene, SCENE } from "./scenes/PreloadScene";
import { TitleScene } from "./scenes/TitleScene";
import { MissionSelectScene } from "./scenes/MissionSelectScene";
import { BriefingScene } from "./scenes/BriefingScene";
import { PlayScene } from "./scenes/PlayScene";
import { ClearScene } from "./scenes/ClearScene";
import { VictoryScene } from "./scenes/VictoryScene";
import { GameOverScene } from "./scenes/GameOverScene";

export interface MarsHandle {
  /** Tear everything down. Safe to call more than once. */
  destroy(): void;
  /** Pause and silence without releasing anything (tab hidden). */
  suspend(): void;
  resume(): void;
  readonly destroyed: boolean;
  /** Flip mute. Returns the new sound-on state. */
  toggleMute(): boolean;
  /** Current sound-on state, for syncing the overlay button on open. */
  readonly soundOn: boolean;
  /** Debug/test surface: which scene is live, for the integration harness. */
  readonly activeScene: string;
}

export interface MountOptions {
  /** Called when the game asks to close itself (Escape at the top level). */
  onRequestClose?: () => void;
  /** Fired when mute changes from inside the game, so the host button agrees. */
  onMuteChange?: (soundOn: boolean) => void;
  /** F pressed. The host owns the full/windowed frame — the game only reports
   *  the keystroke, because the frame is the site's furniture, not the game's. */
  onToggleView?: () => void;
  /** Element the keyboard listeners attach to. Defaults to `document`. */
  keyboardTarget?: EventTarget;
}

function createShell(): ShellNodes {
  const root = document.createElement("div");
  root.className = "mss-shell";
  root.tabIndex = -1;
  root.setAttribute("role", "application");
  root.setAttribute("aria-label",
    "Mars: Signal Siege, a side-scrolling action game. " +
    "Arrow keys or W A S D to move and aim, Space or Z to jump, X or J to fire, " +
    "P to pause, M for sound, F for full screen, Escape to go back or close.");

  const mount = document.createElement("div");
  mount.className = "mss-mount";

  /* The loading screen is DOM, not canvas.
     It has to be on screen from the moment the overlay opens — before the lazy
     chunk has parsed, before Phaser has booted, before there IS a canvas — and
     that is the longest part of the wait. Drawing it inside the game could only
     ever cover the tail end of its own load.
     The mark is decorative and the status is carried by the text beneath it, so
     it is hidden from the accessibility tree rather than given an alt that would
     be announced on every mission start. */
  const loading = document.createElement("div");
  loading.className = "mss-loading";
  loading.innerHTML =
    `<img class="mss-logo" src="${LOADING_LOGO}" alt="" aria-hidden="true" draggable="false">` +
    '<div class="mss-loading-text">Establishing uplink</div>' +
    '<span class="mss-bar"><i></i></span>';

  root.append(mount, loading);
  return {
    root,
    mount,
    loading,
    loadingText: loading.querySelector(".mss-loading-text") as HTMLElement,
    bar: loading.querySelector("i") as HTMLElement,
  };
}

export function mountMarsSignalSiege(host: HTMLElement, opts: MountOptions = {}): MarsHandle {
  const shell = createShell();
  host.appendChild(shell.root);

  let destroyed = false;
  let ctx: MarsContext;

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: shell.mount,
    /* The canvas IS the logical view: 640x360, one game unit per pixel.
       Polaris-Man renders a 320x180 game into a 640x360 canvas because it
       paints through a 2x-transformed Canvas2D context and wants the extra
       resolution for its HUD type. Mars has no such indirection — its atlases
       are authored at 1x for exactly this space — so making the canvas larger
       than the view does not supersample anything, it just hands the camera a
       bigger viewport than the world coordinates assume. That is what put two
       extra copies of the backdrop on screen and, worse, pushed half the live
       enemies outside the cull window in PlayScene.stepEnemies, where they were
       skipped entirely and so never moved or fired.
       Scale.FIT then scales the canvas element up to the shell with
       nearest-neighbour (pixelArt), which is the only scaling this game wants. */
    width: VIEW.W,
    height: VIEW.H,
    backgroundColor: "#0a0812",
    /* Nearest-neighbour and no smoothing: the atlases are authored at the
       game's own pixel grid, so any filtering is a downgrade. */
    pixelArt: true,
    antialias: false,
    roundPixels: true,
    /* No Arcade Physics — the game ships its own deterministic resolver. */
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    audio: { disableWebAudio: false },
    /* The site owns the page; the game must not install global keyboard
       capture or swallow the browser's shortcuts. */
    input: { keyboard: false, gamepad: false },
    banner: false,
    scene: [
      PreloadScene, TitleScene, MissionSelectScene, BriefingScene,
      PlayScene, ClearScene, VictoryScene, GameOverScene,
    ],
  });

  ctx = createContext(game, {
    shell,
    requestClose: () => opts.onRequestClose?.(),
    requestToggleView: () => opts.onToggleView?.(),
    onMuteChange: (on) => opts.onMuteChange?.(on),
  });
  attachCtx(game, ctx);

  /* --- keyboard ---
     Bound to the document rather than to the shell. Scoping to the subtree
     looks tidier and is broken: a keyboard event only reaches an element while
     focus is inside it, and the game destroys the focused element on nearly
     every scene transition, at which point focus falls back to <body> and every
     control goes dead. The listener is still registered through ctx.bind(), so
     it is removed on destroy exactly like the others. */
  const keyTarget: EventTarget = opts.keyboardTarget ?? document;

  const onKeyDown = (ev: Event) => {
    const e = ev as KeyboardEvent;
    if (destroyed) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (!OWNED_KEYS.has(e.code)) return;

    /* Let the browser drive focus between the overlay's own buttons. */
    const onButton = (e.target as HTMLElement)?.closest?.("button");
    if (onButton && (e.code === "Enter" || e.code === "Space")) return;

    /* Any owned key is a genuine gesture, which is what unlocks audio. */
    ctx.audio.unlock();

    if (e.code === "KeyM" && !e.repeat) {
      const on = ctx.audio.toggleMute();
      opts.onMuteChange?.(on);
      e.preventDefault();
      return;
    }
    if (e.code === "KeyF" && !e.repeat) {
      opts.onToggleView?.();
      e.preventDefault();
      return;
    }

    if (!e.repeat) ctx.input.keyDown(e.code);
    if (SCROLL_KEYS.has(e.code) && !onButton) e.preventDefault();
  };

  const onKeyUp = (ev: Event) => {
    if (destroyed) return;
    ctx.input.keyUp((ev as KeyboardEvent).code);
  };

  ctx.bind(keyTarget, "keydown", onKeyDown);
  ctx.bind(keyTarget, "keyup", onKeyUp);

  /* Leaving the page drops held keys, or the player returns mid-jump with the
     key still logically down. */
  ctx.bind(window, "blur", () => {
    ctx.input.clear();
    const play = game.scene.getScene(SCENE.PLAY) as PlayScene | null;
    if (play?.scene.isActive() && play.isRunning) play.pauseGame();
  });

  /* Clicking the canvas is also a gesture, and is how a mouse-only visitor
     starts the audio. */
  ctx.bind(shell.root, "pointerdown", () => {
    if (!destroyed) ctx.audio.unlock();
  });

  const onVisibility = () => {
    if (destroyed) return;
    if (document.hidden) handle.suspend();
    else handle.resume();
  };
  ctx.bind(document, "visibilitychange", onVisibility);

  /* Input edges are cleared after every scene update, so a single keypress
     cannot be consumed twice. POST_UPDATE fires once per frame regardless of
     how many scenes are awake. */
  const onPostStep = () => {
    if (!destroyed) ctx.input.endFrame();
  };
  game.events.on(Phaser.Core.Events.POST_STEP, onPostStep);

  const handle: MarsHandle = {
    get destroyed() {
      return destroyed;
    },

    get soundOn() {
      return !ctx.audio.isMuted;
    },

    get activeScene() {
      const live = game.scene.getScenes(true);
      return live.length ? live[live.length - 1].scene.key : "";
    },

    toggleMute() {
      if (destroyed) return false;
      return ctx.audio.toggleMute();
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
      /* Deliberately does not un-mute: a player who muted before hiding the
         tab does not want the boss theme back on return. */
      ctx.audio.resume();
    },

    destroy() {
      if (destroyed) return;
      destroyed = true;
      game.events.off(Phaser.Core.Events.POST_STEP, onPostStep);
      ctx.dispose();
      /* `true` removes the canvas Phaser created; the second argument leaves
         the Phaser global alone, because the site may open Mars again in the
         same page. */
      game.destroy(true, false);
      shell.root.remove();
    },
  };

  /* Focus the shell so keyboard play works immediately after opening, without
     the visitor having to click into the canvas first. */
  shell.root.focus({ preventScroll: true });

  /* Unlock audio now rather than on the first keypress.
     Mars can only be reached by clicking its planet in Mission Control, so the
     page has already had a genuine user gesture by the time this runs and the
     AudioContext is allowed to start — waiting for a *further* keypress just
     meant the title screen played in silence until the player pressed
     something, which reads as broken audio. The keydown and pointerdown
     handlers above still call unlock(), so a browser that suspends the context
     anyway recovers on the next interaction. */
  ctx.audio.unlock();

  /* Inspection surface for the runtime harness (scripts/check-mars-runtime.mjs),
     which drives the real game in a real browser and needs to read the live
     scene, audio graph and entity state.
     Attached in dev, or when a harness has explicitly opted in by setting
     `window.__MSS_DEBUG` before launching. A visitor never sets that, so the
     deployed site attaches nothing to `window` — but the harness can test the
     production bundle rather than a dev-only build, which is the build that
     actually ships. */
  const w = window as unknown as Record<string, unknown>;
  if (import.meta.env.DEV || w.__MSS_DEBUG) {
    w.__mss = { handle, game };
  }

  return handle;
}

export default mountMarsSignalSiege;
