/* Mars: Signal Siege — the loader.
 *
 * Fetches only what the title screen draws, plus the atlas manifest and the
 * three UI effects the menus need. Everything else is pulled by the screen that
 * needs it: the mission grid streams its boss sheet behind an already-visible
 * grid, and a mission pulls its own backdrop on launch.
 *
 * A player who opens Mars, looks at the title and closes it again has fetched
 * roughly half a megabyte rather than the full thirteen.
 */

import Phaser from "phaser";
import { withBase } from "../../../lib/base";
import { VIEW } from "../tuning";
import { BOOT_ART, BOOT_SFX, type ImageAsset, type SheetAsset, type AudioAsset } from "../assets";
import { ATLAS_KEY, setManifest, type AtlasManifest } from "../anims";
import { getCtx } from "../context";

export const SCENE = {
  PRELOAD: "mss-preload",
  TITLE: "mss-title",
  SELECT: "mss-select",
  BRIEFING: "mss-briefing",
  PLAY: "mss-play",
  CLEAR: "mss-clear",
  VICTORY: "mss-victory",
  GAMEOVER: "mss-gameover",
} as const;

function isSheet(a: ImageAsset | SheetAsset): a is SheetAsset {
  return (a as SheetAsset).frameWidth !== undefined;
}

/** Queue a mixed art list onto a loader. Shared with the lazy loads below. */
export function queueArt(load: Phaser.Loader.LoaderPlugin, assets: readonly (ImageAsset | SheetAsset)[]): void {
  for (const a of assets) {
    if (isSheet(a)) {
      if (!load.scene.textures.exists(a.key)) {
        load.spritesheet(a.key, a.url, { frameWidth: a.frameWidth, frameHeight: a.frameHeight });
      }
    } else if (!load.scene.textures.exists(a.key)) {
      load.image(a.key, a.url);
    }
  }
}

export function queueAudio(load: Phaser.Loader.LoaderPlugin, assets: readonly AudioAsset[]): void {
  for (const a of assets) {
    if (!load.scene.cache.audio.exists(a.key)) load.audio(a.key, a.urls);
  }
}

/* --------------------------------------------------------------- loading

   One loading screen, shown for every blocking load in the game: the boot, the
   mission grid's boss sheet, and each mission's backdrop, terrain and cues.

   It is the DOM overlay built in index.ts, not something drawn in the canvas,
   for two reasons. The boot splash has to cover the wait BEFORE Phaser exists,
   which a canvas cannot. And a scene that is still in `preload()` has not
   rendered a frame yet — anything it adds to the display list appears only
   once loading finishes, which is precisely too late. Phaser's own loader
   events drive the bar, so what the player sees is the real fetch.

   The player's report was that a mission "took a long time to load"; it always
   did, and the game simply showed the previous screen while it happened. */

/** How long the mark stays up once loading is done. */
export const GATE_HOLD = {
  /** The boot splash. A brand moment either lands or it should not be there,
   *  and on a warm cache the blocking load finishes inside a couple of frames,
   *  which shows the mark as a flicker and reads as a glitch. */
  boot: 1000,
  /** Mid-game loads. Shorter on purpose: this one is between the player and
   *  the mission they just chose, and a retry pays it every time. */
  level: 420,
} as const;

/**
 * Show the loading screen and wire the bar to this scene's loader.
 * Call at the top of `preload()`; pair with `releaseGate()` in `create()`.
 */
export function openGate(scene: Phaser.Scene, status: string): void {
  const shell = getCtx(scene)?.shell;
  if (!shell) return;
  shell.loadingText.textContent = status;
  shell.bar.style.width = "0%";
  shell.loading.hidden = false;
  shell.loading.dataset.shownAt = String(performance.now());

  const onProgress = (p: number) => {
    shell.bar.style.width = `${Math.round(p * 100)}%`;
  };
  scene.load.on(Phaser.Loader.Events.PROGRESS, onProgress);
  /* Removed on shutdown as well as on completion: a scene can be torn down
     mid-load (the player closes the overlay), and a listener left on a dead
     loader is a leak that fires into a destroyed shell. */
  scene.load.once(Phaser.Loader.Events.COMPLETE, () => {
    scene.load.off(Phaser.Loader.Events.PROGRESS, onProgress);
  });
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    scene.load.off(Phaser.Loader.Events.PROGRESS, onProgress);
  });
}

/**
 * Hide the loading screen, once it has been up long enough to read.
 * Call at the top of `create()`.
 */
export function releaseGate(scene: Phaser.Scene, hold: number = GATE_HOLD.level): void {
  const shell = getCtx(scene)?.shell;
  if (!shell) return;
  shell.bar.style.width = "100%";
  const shownAt = Number(shell.loading.dataset.shownAt ?? 0);
  const wait = Math.max(0, hold - (performance.now() - shownAt));

  const hide = () => { shell.loading.hidden = true; };
  /* A scene timer, not setTimeout: closing the game mid-splash tears this down
     with everything else rather than firing into a destroyed instance.
     But the scene that opened the gate is usually the one the player dismisses
     — the briefing — and a scene's timers die with it, so on its own this timer
     never fires and the overlay stays up over the whole game. It did exactly
     that: the splash sat on top of gameplay, and the compositing cost dragged
     the frame rate down far enough that the delta clamp slowed the simulation
     to roughly half real time. Hence the shutdown handler: whichever comes
     first, the mark comes down. */
  const timer = scene.time.delayedCall(wait, hide);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    timer.remove(false);
    hide();
  });
}


export class PreloadScene extends Phaser.Scene {
  constructor() {
    super(SCENE.PRELOAD);
  }

  preload(): void {
    /* The title text and progress bar that used to be drawn here are gone: the
       DOM splash is already on screen by this point, showing the Mersive mark
       and the same progress, and two loading screens stacked is one too many. */
    openGate(this, "Establishing uplink");

    /* The manifest is JSON rather than compiled in, so a rebuild of the art
       pipeline cannot leave the game addressing frames that moved. */
    this.load.json(ATLAS_KEY, withBase("/eggs/mars-signal-siege/art/atlases.json"));
    queueArt(this.load, BOOT_ART);
    queueAudio(this.load, BOOT_SFX);
  }

  create(): void {
    const manifest = this.cache.json.get(ATLAS_KEY) as AtlasManifest | undefined;
    if (manifest) setManifest(manifest);
    releaseGate(this, GATE_HOLD.boot);
    this.scene.start(SCENE.TITLE);
  }
}
