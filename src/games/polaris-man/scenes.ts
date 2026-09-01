/* Polaris-Man — the scene graph.
 *
 * Ten scenes, mapped one-to-one onto v1.7's `scene` string so the port is easy
 * to check against the original:
 *
 *   Preload  → (new) asset loading with a progress bar
 *   Boot     → "boot"      Mersive logo sting
 *   Title    → "title"     attract screen
 *   Select   → "select"    mission grid (DOM)
 *   Brief    → "brief"     mission intelligence (DOM)
 *   Play     → "play"      the game
 *   Pause    → "pause"     capability rack (DOM), overlays Play
 *   Victory  → "victory"   boss death, then the card
 *   Reward   → "reward"    capability integrated (DOM)
 *   GameOver → "failed"    checkpoint / restart / quit (DOM)
 *   Epilogue → "epilogue"  end crawl
 *
 * Pause, Victory, Reward and GameOver are launched *over* a paused Play rather
 * than replacing it, so the frozen world stays on screen behind the card — the
 * same effect v1.7 got by simply not calling update().
 */

import Phaser from "phaser";
import {
  BOOT_ART, MUSIC, PLAY_SHARED_ART, SELECT_ART, bossMusic, missionArt, missionMusic,
} from "./assets";
import { FINAL_MISSION, MISSIONS, type Mission, type MissionId, type WeaponId } from "./data";
import { TIMING, VIEW } from "./tuning";
import { getCtx, type PolarisManContext } from "./context";
import {
  beginBossVictory, currentWeapon, resumeFromCheckpoint, updateVictory, updateWorld,
  type SimContext,
} from "./sim";
import { buildFinalWorld, buildMoonWorld } from "./state";
import { allMoonBossesDefeated, freshProgress, recordClear, saveProgress } from "./progress";
import {
  clearOverlay, renderControls, renderFailed, renderMissionIntro, renderMissionSelect,
  renderPause, renderReward, renderVictory,
} from "./ui";
import { drawFinalPortrait, drawPortrait } from "./render";

export const SCENE = {
  PRELOAD: "pm-preload",
  BOOT: "pm-boot",
  TITLE: "pm-title",
  SELECT: "pm-select",
  BRIEF: "pm-brief",
  PLAY: "pm-play",
  PAUSE: "pm-pause",
  VICTORY: "pm-victory",
  REWARD: "pm-reward",
  GAMEOVER: "pm-gameover",
  EPILOGUE: "pm-epilogue",
} as const;

/** Base for every scene that paints the shared 640x360 buffer. */
abstract class FrameScene extends Phaser.Scene {
  protected ctx!: PolarisManContext;
  private view?: Phaser.GameObjects.Image;

  protected setupFrame(sceneName: string): void {
    this.ctx = getCtx(this);
    this.ctx.shell.root.dataset.scene = sceneName;
    this.view = this.add.image(0, 0, "pm-frame").setOrigin(0, 0);
    this.view.setDisplaySize(VIEW.W * VIEW.ZOOM, VIEW.H * VIEW.ZOOM);
  }

  /** Push the canvas we drew into up to the GPU. */
  protected present(): void {
    this.ctx.frameTexture.refresh();
  }

  /** Advance the shared clock and run the toast countdown. */
  protected tickCommon(dtMs: number): number {
    const dt = Math.min(TIMING.MAX_DT, dtMs / 1000);
    this.ctx.clock += dt;
    this.ctx.renderer.setClock(this.ctx.clock);
    if (this.ctx.toastT > 0) {
      this.ctx.toastT -= dt;
      if (this.ctx.toastT <= 0) this.ctx.shell.toast.classList.remove("pm-show");
    }
    this.ctx.audio.tickMusic(dt);
    return dt;
  }
}

/* ---------- Preload ---------- */

export class PreloadScene extends Phaser.Scene {
  /** Wall-clock at which loading began, for MIN_SPLASH below. */
  private startedAt = 0;

  /**
   * Shortest time the Mersive mark stays up.
   *
   * The blocking load is deliberately small — title backdrop and operator sheet,
   * about 2.4 MB — and on a warm cache it finishes in a couple of frames, which
   * would show the mark as a flicker and read as a glitch. A brand moment either
   * lands or it should not be there, so the splash holds for this long even when
   * there is nothing left to wait for.
   */
  private static readonly MIN_SPLASH = 1100;

  constructor() { super(SCENE.PRELOAD); }

  preload(): void {
    const ctx = getCtx(this);
    const bar = ctx.shell.bar;
    ctx.shell.loading.hidden = false;
    this.startedAt = performance.now();

    /* Blocking load is deliberately tiny — the title screen and nothing else.
       Everything heavier streams in later, where it does not hold up the open. */
    for (const a of BOOT_ART) {
      if (!this.textures.exists(a.key)) this.load.image(a.key, a.url);
    }
    for (const t of [MUSIC.title, MUSIC.select]) {
      if (!this.cache.audio.exists(t.key)) this.load.audio(t.key, t.url);
    }

    this.load.on("progress", (v: number) => { bar.style.transform = `scaleX(${v})`; });

    /* A missing or undecodable asset must not stall the boot. The renderer and
       the audio manager both fall back, so we log once and carry on. */
    this.load.on("loaderror", (file: Phaser.Loader.File) => {
      console.warn(`[polaris-man] asset unavailable: ${file.key}`);
    });
  }

  create(): void {
    const ctx = getCtx(this);
    const held = performance.now() - this.startedAt;
    const wait = Math.max(0, PreloadScene.MIN_SPLASH - held);
    /* time.delayedCall, not setTimeout: it belongs to the scene, so a close
       mid-splash tears it down with everything else instead of firing into a
       destroyed game. */
    this.time.delayedCall(wait, () => {
      ctx.shell.loading.hidden = true;
      this.scene.start(SCENE.BOOT);
    });
  }
}

/* ---------- Boot ---------- */

export class BootScene extends FrameScene {
  private t = 0;
  constructor() { super(SCENE.BOOT); }

  create(): void {
    this.setupFrame("boot");
    this.t = 0;
  }

  update(_time: number, delta: number): void {
    const dt = this.tickCommon(delta);
    this.t += dt;
    this.ctx.renderer.drawBoot(this.t);
    this.present();
    if (this.t > TIMING.BOOT_TIME) this.scene.start(SCENE.TITLE);
  }
}

/* ---------- Title ---------- */

export class TitleScene extends FrameScene {
  constructor() { super(SCENE.TITLE); }

  create(): void {
    this.setupFrame("title");
    this.ctx.mission = null;
    this.ctx.world = null;
    clearOverlay(this.ctx.shell.overlay);
    this.ctx.audio.playMusic(MUSIC.title);

    const go = () => {
      this.ctx.audio.init();
      this.ctx.audio.menu();
      this.ctx.progress.started = true;
      saveProgress(this.ctx.progress);
      this.scene.start(SCENE.SELECT);
    };
    this.input.once("pointerdown", go);
    this.events.once("pm-start", go);
  }

  update(_t: number, delta: number): void {
    this.tickCommon(delta);
    if (this.ctx.input.was("Enter", "Space")) this.events.emit("pm-start");
    this.ctx.renderer.drawTitle(this.ctx.clock, MISSIONS[0]);
    this.present();
    this.ctx.input.endFrame();
  }
}

/* ---------- Select ---------- */

export class SelectScene extends FrameScene {
  constructor() { super(SCENE.SELECT); }

  create(): void {
    this.setupFrame("select");
    this.ctx.mission = null;
    this.ctx.world = null;
    this.ctx.shell.touch.classList.remove("pm-enabled");
    this.ctx.shell.toast.classList.remove("pm-show");
    this.ctx.toastT = 0;
    this.ctx.audio.playMusic(MUSIC.select);
    this.render();
    this.streamTileArt();
  }

  private render(): void {
    renderMissionSelect(this.ctx.shell.overlay, this.ctx.progress, this.ctx.getImage, {
      onMission: (m) => this.open(m),
      onFinal: () => this.open(FINAL_MISSION),
    });
  }

  /**
   * Fetch the tile art behind the already-visible grid, repainting each
   * portrait the moment its own image lands.
   *
   * Repainting one canvas rather than re-rendering the grid matters: the grid
   * holds DOM focus, and blowing it away mid-stream would drop the keyboard
   * user back to the top every time a 1.5 MB PNG finished.
   */
  private streamTileArt(): void {
    const missing = SELECT_ART.filter((a) => !this.textures.exists(a.key));
    if (!missing.length) return;

    const repaint = (key: string) => {
      const overlay = this.ctx.shell.overlay;
      /* The player may have left the menu while this was in flight. */
      if (!overlay.isConnected || !overlay.querySelector(".pm-grid")) return;

      for (const m of MISSIONS) {
        if (key !== `pm-bg-${m.id}` && key !== `pm-fig-${m.id}`) continue;
        const c = overlay.querySelector<HTMLCanvasElement>(`canvas[data-portrait="${m.id}"]`);
        if (c) drawPortrait(c, m, this.ctx.getImage);
      }
      if (key === "pm-bg-final" || key === "pm-boss-final") {
        const core = overlay.querySelector<HTMLCanvasElement>("canvas[data-core]");
        if (core && allMoonBossesDefeated(this.ctx.progress.cleared)) {
          drawFinalPortrait(core, this.ctx.getImage);
        }
      }
    };

    for (const a of missing) this.load.image(a.key, a.url);
    this.load.on(Phaser.Loader.Events.FILE_COMPLETE, (key: string) => repaint(key));
    this.load.on("loaderror", (f: Phaser.Loader.File) =>
      console.warn(`[polaris-man] tile art unavailable: ${f.key}`),
    );
    this.load.start();
  }

  private open(m: Mission): void {
    this.ctx.audio.init();
    this.ctx.audio.menu();
    this.scene.start(SCENE.BRIEF, { missionId: m.id });
  }

  /** Arrow keys move focus around the 3x3 grid, as v1.7 did. */
  private moveFocus(code: string): void {
    const items = [...this.ctx.shell.overlay.querySelectorAll<HTMLButtonElement>(".pm-grid button")];
    if (!items.length) return;
    const active = document.activeElement as HTMLButtonElement | null;
    let i = Math.max(0, items.indexOf(active as HTMLButtonElement));
    const d = code === "ArrowLeft" ? -1 : code === "ArrowRight" ? 1 : code === "ArrowUp" ? -3 : 3;
    i = (i + d + items.length) % items.length;
    items[i].focus();
  }

  update(_t: number, delta: number): void {
    this.tickCommon(delta);
    const inp = this.ctx.input;
    if (inp.was("KeyN")) {
      Object.assign(this.ctx.progress, freshProgress(), { started: true });
      saveProgress(this.ctx.progress);
      this.render();
    }
    for (const c of ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"]) {
      if (inp.was(c)) this.moveFocus(c);
    }
    this.ctx.renderer.drawSelectBackdrop(this.ctx.clock, MISSIONS);
    this.present();
    inp.endFrame();
  }
}

/* ---------- Brief ---------- */

export class BriefScene extends FrameScene {
  private mission!: Mission;
  constructor() { super(SCENE.BRIEF); }

  create(data: { missionId: MissionId }): void {
    this.setupFrame("brief");
    this.mission = data.missionId === "final"
      ? FINAL_MISSION
      : MISSIONS.find((m) => m.id === data.missionId)!;
    this.ctx.mission = this.mission;

    renderMissionIntro(this.ctx.shell.overlay, this.mission, this.ctx.progress, this.ctx.getImage, {
      onLaunch: () => {
        if (this.mission.id === "final" && !allMoonBossesDefeated(this.ctx.progress.cleared)) {
          this.scene.start(SCENE.SELECT);
          return;
        }
        this.scene.start(SCENE.PLAY, { missionId: this.mission.id });
      },
      onBack: () => this.scene.start(SCENE.SELECT),
    });
  }

  update(_t: number, delta: number): void {
    this.tickCommon(delta);
    this.ctx.renderer.drawSelectBackdrop(this.ctx.clock, MISSIONS);
    this.present();
    this.ctx.input.endFrame();
  }
}

/* ---------- Play ---------- */

export class PlayScene extends FrameScene {
  private mission!: Mission;
  private sim!: SimContext;
  private phase: "run" | "victory" | "frozen" = "run";

  constructor() { super(SCENE.PLAY); }

  preload(): void {
    /* Mission art is fetched here, not at boot: one moon is ~3.5 MB and the
       full set is 28 MB. Phaser skips keys already in the texture manager, so
       replaying a mission costs nothing. */
    const ctx = getCtx(this);
    const id = (this.scene.settings.data as { missionId: MissionId }).missionId;
    let pending = false;
    for (const a of [...PLAY_SHARED_ART, ...missionArt(id)]) {
      if (!this.textures.exists(a.key)) { this.load.image(a.key, a.url); pending = true; }
    }
    const music = [missionMusic(id), bossMusic(id)];
    for (const t of music) {
      if (!this.cache.audio.exists(t.key)) { this.load.audio(t.key, t.url); pending = true; }
    }
    if (pending) {
      ctx.shell.loading.hidden = false;
      this.load.on("progress", (v: number) => { ctx.shell.bar.style.transform = `scaleX(${v})`; });
    }
    this.load.on("loaderror", (f: Phaser.Loader.File) => console.warn(`[polaris-man] asset unavailable: ${f.key}`));
  }

  create(data: { missionId: MissionId }): void {
    this.setupFrame("play");
    this.ctx.shell.loading.hidden = true;

    this.mission = data.missionId === "final"
      ? FINAL_MISSION
      : MISSIONS.find((m) => m.id === data.missionId)!;
    this.ctx.mission = this.mission;

    const world = this.mission.id === "final"
      ? buildFinalWorld(this.mission, this.ctx.progress)
      : buildMoonWorld(this.mission, this.ctx.progress);
    this.ctx.world = world;

    this.sim = {
      world,
      progress: this.ctx.progress,
      input: this.ctx.input,
      audio: this.ctx.audio,
      toast: (m, s) => this.ctx.toast(m, s),
      reduced: this.ctx.reduced,
      clock: this.ctx.clock,
      onPlayerDied: () => this.onPlayerDied(),
      onBossDefeated: () => this.onBossDefeated(),
    };

    this.phase = "run";
    clearOverlay(this.ctx.shell.overlay);
    this.ctx.shell.touch.classList.add("pm-enabled");
    this.ctx.shell.root.focus({ preventScroll: true });
    this.ctx.audio.playMusic(missionMusic(this.mission.id));

    this.ctx.toast(
      this.mission.id === "ariel"
        ? "ARIEL SIGNAL GRID LOCKED · FIVE PAIRING GATES DETECTED"
        : this.mission.id === "final"
          ? "POLARIS NEXUS · USE ALL EIGHT CAPABILITIES"
          : `${this.mission.moon} · FIVE VERTICAL SECTORS · BOSS AT SIGNAL END`,
      2.8,
    );
    if (this.mission.id === "final") this.ctx.audio.bossAppear();

    this.events.on("pm-resume", () => this.resumeRun());
    this.events.on("pm-retry", () => this.scene.restart({ missionId: this.mission.id }));
    this.events.on("pm-checkpoint", () => {
      resumeFromCheckpoint(this.sim);
      this.resumeRun();
      this.ctx.toast("CHECKPOINT RESTORED · PROGRESS PRESERVED", 1.6);
    });
  }

  private resumeRun(): void {
    this.phase = "run";
    clearOverlay(this.ctx.shell.overlay);
    this.ctx.shell.touch.classList.add("pm-enabled");
    this.ctx.input.clear();
    /* Keys work regardless of focus now, but clearing the overlay destroys
       whatever held it, so put focus back on the game rather than leaving it on
       <body> — otherwise a screen reader loses the player mid-mission. */
    this.ctx.shell.root.focus({ preventScroll: true });
  }

  private freeze(): void {
    this.phase = "frozen";
    this.ctx.shell.touch.classList.remove("pm-enabled");
  }

  private onPlayerDied(): void {
    this.freeze();
    this.ctx.shell.root.dataset.scene = "failed";
    this.ctx.audio.playMusic(MUSIC.gameover);
    renderFailed(this.ctx.shell.overlay, this.mission, {
      onResume: () => this.events.emit("pm-checkpoint"),
      onRestart: () => this.events.emit("pm-retry"),
      onSelect: () => this.scene.start(SCENE.SELECT),
    });
  }

  private onBossDefeated(): void {
    beginBossVictory(this.sim);
    this.phase = "victory";
    this.ctx.shell.touch.classList.remove("pm-enabled");
    this.ctx.shell.root.dataset.scene = "victory";
  }

  private showVictoryCard(): void {
    this.freeze();
    this.ctx.audio.playMusic(MUSIC.victory);
    renderVictory(this.ctx.shell.overlay, this.mission, () => {
      if (this.mission.id === "final") {
        this.ctx.progress.finalCleared = true;
        saveProgress(this.ctx.progress);
        this.scene.start(SCENE.EPILOGUE);
      } else {
        this.scene.start(SCENE.REWARD, { missionId: this.mission.id, time: this.sim.world.missionT });
      }
    });
  }

  pauseGame(): void {
    if (this.phase !== "run") return;
    this.freeze();
    this.ctx.shell.root.dataset.scene = "pause";
    const active = currentWeapon(this.sim.world, this.ctx.progress).id;
    renderPause(this.ctx.shell.overlay, this.ctx.progress, active, !this.ctx.audio.isMuted, {
      onWeapon: (id: WeaponId) => {
        this.sim.world.weaponIndex = Math.max(0, this.ctx.progress.weapons.indexOf(id));
        this.ctx.audio.menu();
        this.pauseRefresh();
      },
      onResume: () => { this.ctx.audio.menu(); this.ctx.shell.root.dataset.scene = "play"; this.events.emit("pm-resume"); },
      onRetry: () => { this.ctx.audio.menu(); this.events.emit("pm-retry"); },
      onSelect: () => { this.ctx.audio.menu(); this.scene.start(SCENE.SELECT); },
      onSound: () => { this.ctx.audio.toggleMute(); this.pauseRefresh(); },
    });
  }

  private pauseRefresh(): void {
    this.phase = "frozen";
    const active = currentWeapon(this.sim.world, this.ctx.progress).id;
    renderPause(this.ctx.shell.overlay, this.ctx.progress, active, !this.ctx.audio.isMuted, {
      onWeapon: (id: WeaponId) => {
        this.sim.world.weaponIndex = Math.max(0, this.ctx.progress.weapons.indexOf(id));
        this.ctx.audio.menu();
        this.pauseRefresh();
      },
      onResume: () => { this.ctx.audio.menu(); this.ctx.shell.root.dataset.scene = "play"; this.events.emit("pm-resume"); },
      onRetry: () => { this.ctx.audio.menu(); this.events.emit("pm-retry"); },
      onSelect: () => { this.ctx.audio.menu(); this.scene.start(SCENE.SELECT); },
      onSound: () => { this.ctx.audio.toggleMute(); this.pauseRefresh(); },
    });
  }

  get isRunning(): boolean {
    return this.phase === "run";
  }

  get isPaused(): boolean {
    return this.phase === "frozen" && this.ctx.shell.root.dataset.scene === "pause";
  }

  update(_t: number, delta: number): void {
    const dt = this.tickCommon(delta);
    const w = this.sim.world;
    this.sim.clock = this.ctx.clock;

    if (this.phase === "run") {
      if (this.ctx.input.was("KeyP")) {
        this.pauseGame();
      } else {
        /* Boss music takes over the moment a boss exists. */
        if (w.boss && !w.boss.dead) this.ctx.audio.playMusic(bossMusic(this.mission.id));
        updateWorld(this.sim, dt);
      }
    } else if (this.phase === "victory") {
      if (updateVictory(this.sim, dt)) this.showVictoryCard();
    }

    this.ctx.renderer.drawGame(w, this.ctx.clock, currentWeapon(w, this.ctx.progress));
    this.present();
    this.ctx.input.endFrame();
  }

  shutdown(): void {
    this.events.off("pm-resume");
    this.events.off("pm-retry");
    this.events.off("pm-checkpoint");
    this.ctx.shell.touch.classList.remove("pm-enabled");
  }
}

/* ---------- Reward ---------- */

export class RewardScene extends FrameScene {
  constructor() { super(SCENE.REWARD); }

  create(data: { missionId: MissionId; time: number }): void {
    this.setupFrame("reward");
    const mission = MISSIONS.find((m) => m.id === data.missionId)!;
    this.ctx.mission = mission;
    this.ctx.world = null;

    const { firstClear } = recordClear(this.ctx.progress, mission, data.time);
    saveProgress(this.ctx.progress);
    this.ctx.audio.reward();

    renderReward(this.ctx.shell.overlay, mission, this.ctx.progress, firstClear, {
      onSelect: () => this.scene.start(SCENE.SELECT),
      onFinal: () => this.scene.start(SCENE.BRIEF, { missionId: "final" }),
    });
  }

  update(_t: number, delta: number): void {
    this.tickCommon(delta);
    this.ctx.renderer.drawSelectBackdrop(this.ctx.clock, MISSIONS);
    this.present();
    this.ctx.input.endFrame();
  }
}

/* ---------- Epilogue ---------- */

export class EpilogueScene extends FrameScene {
  private t = 0;
  constructor() { super(SCENE.EPILOGUE); }

  create(): void {
    this.setupFrame("epilogue");
    this.t = 0;
    this.ctx.world = null;
    clearOverlay(this.ctx.shell.overlay);
    this.ctx.audio.playMusic(MUSIC.epilogue);
    this.input.once("pointerdown", () => this.finish());
  }

  private finish(): void {
    if (this.t < TIMING.EPILOGUE_MIN) return;
    this.scene.start(SCENE.SELECT);
  }

  update(_t: number, delta: number): void {
    const dt = this.tickCommon(delta);
    this.t += dt;
    if (this.ctx.input.was("Enter", "Space")) this.finish();
    this.ctx.renderer.drawEpilogue(this.t, MISSIONS[0]);
    this.present();
    this.ctx.input.endFrame();
  }
}

/* ---------- Controls (reachable from the field manual) ---------- */

export class ControlsScene extends FrameScene {
  constructor() { super("pm-controls"); }

  create(): void {
    this.setupFrame("select");
    renderControls(this.ctx.shell.overlay, this.ctx.progress.abilities.doubleJump, () =>
      this.scene.start(SCENE.SELECT),
    );
  }

  update(_t: number, delta: number): void {
    this.tickCommon(delta);
    this.ctx.renderer.drawSelectBackdrop(this.ctx.clock, MISSIONS);
    this.present();
    this.ctx.input.endFrame();
  }
}

export const SCENE_LIST = [
  PreloadScene, BootScene, TitleScene, SelectScene, BriefScene,
  PlayScene, RewardScene, EpilogueScene, ControlsScene,
];
