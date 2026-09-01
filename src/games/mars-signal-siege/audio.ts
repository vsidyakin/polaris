/* Mars: Signal Siege — music and effect lifecycle.
 *
 * The whole point of this module is that an easter egg lives inside a page it
 * does not own. It can be opened, closed and reopened many times in one page
 * life, the tab can be hidden mid-boss, and the player's mute preference has to
 * survive all of it. v0.7 used bare <audio> elements on a module-level object,
 * which leaked a live element per cue per open; here every sound belongs to
 * Phaser's sound manager and dies with `game.destroy()`.
 *
 * Rules this enforces, each because the brief calls it out:
 *
 *   - Nothing plays before a user gesture. `unlock()` is called from the first
 *     real keypress or pointer event, never from scene creation.
 *   - Exactly one music cue is audible at a time. `playMusic` cross-fades and
 *     stops the outgoing cue rather than leaving it paused at volume 0, which
 *     is what lets two tracks stack up after a few transitions.
 *   - Mute covers music and effects together, and `resume()` never un-mutes.
 *     A player who muted before hiding the tab does not want the boss theme
 *     back when they return.
 *   - Effects are throttled per name. The full-auto weapon fires every 85 ms
 *     and would otherwise retrigger its own sample into mud.
 */

import Phaser from "phaser";
import { AUDIO } from "./tuning";
import { MUSIC, MUSIC_LOOPS, type SfxName } from "./assets";
import type { MusicKey } from "./data";

type Sound = Phaser.Sound.BaseSound & {
  volume?: number;
  setVolume?: (v: number) => unknown;
};

interface Fade {
  snd: Sound;
  from: number;
  to: number;
  t: number;
  duration: number;
  done?: () => void;
}

export class MarsAudio {
  private game: Phaser.Game;
  private muted = false;
  private unlocked = false;
  private current: MusicKey | null = null;
  private currentSound: Sound | null = null;
  private lastPlayed: Record<string, number> = {};
  /** Set while the host has us suspended, so a late scene transition cannot
   *  start audio behind a hidden tab. */
  private suspended = false;

  /* Fades are ticked off the GAME loop, not off a scene's tween manager.
     Scene tweens looked like the obvious tool and are the wrong one here: the
     only scene reference available at construction time is scenes[0], which is
     PreloadScene, and PreloadScene stops itself the moment it hands over to the
     title. A stopped scene's TweenManager is unhooked from the update event, so
     every fade would sit at t=0 forever — music would be added at volume 0 and
     never rise, and the outgoing cue's stop/destroy (which lived in the tween's
     onComplete) would never run, stacking a dormant sound per transition. The
     game's POST_STEP fires for the life of the Game, which is exactly the
     lifetime this manager has. */
  private fades: Fade[] = [];
  private readonly onTick: (time: number, delta: number) => void;

  constructor(game: Phaser.Game) {
    this.game = game;
    this.onTick = (_time: number, delta: number) => this.tickFades(delta / 1000);
    game.events.on(Phaser.Core.Events.POST_STEP, this.onTick);
  }

  private tickFades(dt: number): void {
    if (!this.fades.length) return;
    for (let i = this.fades.length - 1; i >= 0; i--) {
      const f = this.fades[i];
      f.t += dt;
      const k = f.duration > 0 ? Math.min(1, f.t / f.duration) : 1;
      f.snd.setVolume?.(f.from + (f.to - f.from) * k);
      if (k >= 1) {
        this.fades.splice(i, 1);
        f.done?.();
      }
    }
  }

  private cancelFades(snd: Sound | null): void {
    if (!snd) return;
    this.fades = this.fades.filter((f) => f.snd !== snd);
  }

  private startFade(snd: Sound, to: number, done?: () => void): void {
    this.cancelFades(snd);
    const from = typeof snd.volume === "number" ? snd.volume : 0;
    if (AUDIO.FADE_MS <= 0) {
      snd.setVolume?.(to);
      done?.();
      return;
    }
    this.fades.push({ snd, from, to, t: 0, duration: AUDIO.FADE_MS / 1000, done });
  }

  get isMuted(): boolean {
    return this.muted;
  }

  /** Called from the first genuine user gesture. Safe to call repeatedly. */
  unlock(): void {
    if (this.unlocked) return;
    this.unlocked = true;
    const mgr = this.game.sound as Phaser.Sound.WebAudioSoundManager;
    if (mgr.context && mgr.context.state === "suspended") {
      void mgr.context.resume();
    }
    /* A cue may have been requested by a scene before the gesture arrived —
       honour it now rather than leaving the screen silent until the next
       transition. */
    if (this.current && !this.currentSound) this.startCurrent();
  }

  // ------------------------------------------------------------------ music

  /**
   * Make `key` the one audible cue.
   *
   * Re-requesting the cue that is already playing is a no-op, which matters
   * because scenes call this every frame from their state sync: restarting on
   * each call is how a track ends up stuttering at the top of the bar forever.
   */
  playMusic(key: MusicKey | null): void {
    if (this.current === key) {
      this.applyVolume();
      return;
    }
    this.current = key;
    this.stopCurrent();
    if (key) this.startCurrent();
  }

  private targetVolume(): number {
    if (this.muted || !this.current) return 0;
    if (this.current === "boss" || this.current === "lairFinal") return AUDIO.MUSIC_VOLUME_BOSS;
    if (!MUSIC_LOOPS[this.current]) return AUDIO.MUSIC_VOLUME_ONESHOT;
    return AUDIO.MUSIC_VOLUME;
  }

  private startCurrent(): void {
    const key = this.current;
    if (!key || !this.unlocked || this.suspended) return;
    const assetKey = MUSIC[key].key;
    if (!this.game.cache.audio.exists(assetKey)) return;   // not loaded yet
    const snd = this.game.sound.add(assetKey, {
      loop: MUSIC_LOOPS[key],
      volume: 0,
    }) as Sound;
    this.currentSound = snd;
    snd.play();
    this.startFade(snd, this.targetVolume());
  }

  private stopCurrent(): void {
    const old = this.currentSound;
    this.currentSound = null;
    if (!old) return;
    /* Fade out, then destroy. Destroying rather than stopping is what keeps
       repeated transitions from accumulating dormant sound objects. */
    if (old.isPlaying) {
      this.startFade(old, 0, () => {
        old.stop();
        old.destroy();
      });
    } else {
      this.cancelFades(old);
      old.stop();
      old.destroy();
    }
  }

  /** Re-apply the target volume without restarting — used by pause ducking.
   *  Cancels any in-flight fade on the current cue first, or the fade would
   *  keep writing the volume this call just set. */
  applyVolume(duck = false): void {
    if (!this.currentSound) return;
    this.cancelFades(this.currentSound);
    const v = duck ? AUDIO.MUSIC_VOLUME_PAUSED : this.targetVolume();
    this.currentSound.setVolume?.(this.muted ? 0 : v);
  }

  /** Pause ducks rather than stops, so resuming does not restart the bar. */
  duck(on: boolean): void {
    this.applyVolume(on);
  }

  // ------------------------------------------------------------------- sfx

  play(name: SfxName, throttleGroup?: string): void {
    if (this.muted || !this.unlocked || this.suspended) return;
    const group = throttleGroup ?? name;
    const limit = AUDIO.THROTTLE[group] ?? AUDIO.THROTTLE[name.replace(/\d+$/, "")] ?? 0;
    if (limit) {
      const now = performance.now();
      if (now - (this.lastPlayed[group] ?? 0) < limit) return;
      this.lastPlayed[group] = now;
    }
    const key = `mss-sfx-${name}`;
    if (!this.game.cache.audio.exists(key)) return;
    this.game.sound.play(key, { volume: AUDIO.SFX_VOLUME });
  }

  // --------------------------------------------------------------- control

  /** Returns the new sound-on state, matching the host's button semantics. */
  toggleMute(): boolean {
    this.setMuted(!this.muted);
    return !this.muted;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    this.game.sound.mute = muted;
    /* Un-muting has to lift a pause as well as the mute flag. suspend() pauses
       everything, and resume() deliberately leaves a muted player's audio
       paused; without this, mute -> hide tab -> show tab -> unmute leaves the
       cue paused and the game silent until the next screen transition. */
    if (!muted && !this.suspended) this.game.sound.resumeAll();
    this.applyVolume();
  }

  /** Tab hidden, or the host parked the game. */
  suspend(): void {
    this.suspended = true;
    this.game.sound.pauseAll();
    const mgr = this.game.sound as Phaser.Sound.WebAudioSoundManager;
    if (mgr.context && mgr.context.state === "running") void mgr.context.suspend();
  }

  /** Tab visible again. Deliberately does not clear `muted`. */
  resume(): void {
    this.suspended = false;
    const mgr = this.game.sound as Phaser.Sound.WebAudioSoundManager;
    if (mgr.context && mgr.context.state === "suspended" && this.unlocked) {
      void mgr.context.resume();
    }
    if (!this.muted) this.game.sound.resumeAll();
    this.game.sound.mute = this.muted;
  }

  /** Called from the handle's destroy path before `game.destroy()`. Stops
   *  everything explicitly so nothing is left decoding during teardown. */
  destroy(): void {
    this.game.events.off(Phaser.Core.Events.POST_STEP, this.onTick);
    this.fades.length = 0;
    this.currentSound?.stop();
    this.currentSound?.destroy();
    this.currentSound = null;
    this.current = null;
    this.game.sound.stopAll();
    this.game.sound.removeAll();
  }
}
