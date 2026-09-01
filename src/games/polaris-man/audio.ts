/* Polaris-Man — the one place audio happens.
 *
 * Two layers, on purpose:
 *
 *   Music  — FamiStudio-authored NES tracks, streamed as OGG through Phaser's
 *            sound manager. One track can be playing at a time, ever.
 *   SFX    — procedurally synthesised on the NES channel vocabulary (pulse,
 *            triangle, filtered noise), ported note-for-note from v1.7. These
 *            stay procedural because they already obey the channel limits, cost
 *            zero bytes, and there are ~40 of them; rendering each to a file
 *            would add weight for no audible gain.
 *
 * If a music file is missing or the browser cannot decode OGG, `playMusic`
 * degrades to the in-code chiptune sequencer rather than throwing — a missing
 * asset must never take the overlay down.
 *
 * Everything allocated here is released by `destroy()`. The egg opens and
 * closes repeatedly inside a long-lived page, so a leaked AudioContext or a
 * still-running sequencer is a real bug, not a tidiness concern.
 */

import { AUDIO_DEFAULTS } from "./tuning";
import { loadMuted, saveMuted } from "./progress";
import { FALLBACK_TRACKS, type FallbackTrack } from "./chiptune";

type Bus = "music" | "sfx";

export interface MusicTrackDef {
  /** Phaser cache key. */
  key: string;
  /** Public URL, no extension — the manager appends .ogg. */
  url: string;
  /** Sequencer track used if the file is unavailable. */
  fallback: string;
  loop: boolean;
}

export class AudioManager {
  private game: Phaser.Game;
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private comp: DynamicsCompressorNode | null = null;

  private muted: boolean;
  private started = false;
  private destroyed = false;

  /** Currently playing streamed track, if any. */
  private music: Phaser.Sound.BaseSound | null = null;
  private musicKey = "";

  /** Fallback sequencer state. */
  private seqTrack: FallbackTrack | null = null;
  private seqName = "";
  private seqBeat = 0;
  private seqStep = 0;

  /** Every oscillator/source we start, so destroy() can stop them all. */
  private live = new Set<AudioScheduledSourceNode>();

  constructor(game: Phaser.Game) {
    this.game = game;
    this.muted = loadMuted();
  }

  /* ---- lifecycle ---- */

  /** Called from the first real user gesture. Safe to call repeatedly. */
  init(): void {
    if (this.destroyed || this.started) {
      void this.resumeContext();
      return;
    }
    const sm = this.game.sound as Phaser.Sound.BaseSoundManager & { context?: AudioContext };
    const ctx = sm.context;
    if (!ctx) return; // NoAudioSoundManager — the game runs silent, which is fine.

    this.ctx = ctx;
    this.master = ctx.createGain();
    this.musicBus = ctx.createGain();
    this.sfxBus = ctx.createGain();
    this.comp = ctx.createDynamicsCompressor();

    this.master.gain.value = this.muted ? 0 : AUDIO_DEFAULTS.MASTER;
    this.musicBus.gain.value = AUDIO_DEFAULTS.MUSIC;
    this.sfxBus.gain.value = AUDIO_DEFAULTS.SFX;
    this.comp.threshold.value = -16;
    this.comp.knee.value = 12;
    this.comp.ratio.value = 5;
    this.comp.attack.value = 0.004;
    this.comp.release.value = 0.16;

    this.musicBus.connect(this.master);
    this.sfxBus.connect(this.master);
    this.master.connect(this.comp);
    this.comp.connect(ctx.destination);

    this.started = true;
    void this.resumeContext();
  }

  private async resumeContext(): Promise<void> {
    if (!this.ctx || this.destroyed) return;
    if (this.ctx.state === "suspended") {
      try {
        await this.ctx.resume();
      } catch {
        /* Autoplay policy will let us try again on the next gesture. */
      }
    }
  }

  /** Tab hidden, or the overlay lost focus. Music pauses; nothing is released. */
  suspend(): void {
    if (this.music && this.music.isPlaying) this.music.pause();
    if (this.ctx && this.ctx.state === "running") void this.ctx.suspend().catch(() => {});
  }

  resume(): void {
    if (this.destroyed) return;
    void this.resumeContext();
    if (this.music && this.music.isPaused && !this.muted) this.music.resume();
  }

  /** Stop everything and release. After this the manager is inert. */
  destroy(): void {
    this.destroyed = true;
    this.stopMusic();
    this.seqTrack = null;
    for (const node of this.live) {
      try {
        node.stop();
      } catch {
        /* already stopped */
      }
      try {
        node.disconnect();
      } catch {
        /* already disconnected */
      }
    }
    this.live.clear();
    for (const n of [this.musicBus, this.sfxBus, this.master, this.comp]) {
      try {
        n?.disconnect();
      } catch {
        /* ignore */
      }
    }
    this.musicBus = this.sfxBus = this.master = null;
    this.comp = null;
    /* The AudioContext belongs to Phaser's sound manager, which game.destroy()
       tears down. Closing it here would break a second instance opened later. */
    this.ctx = null;
  }

  /* ---- mute ---- */

  get isMuted(): boolean {
    return this.muted;
  }

  toggleMute(): boolean {
    this.init();
    this.muted = !this.muted;
    saveMuted(this.muted);
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(
        this.muted ? 0 : AUDIO_DEFAULTS.MASTER,
        this.ctx.currentTime,
        0.025,
      );
    }
    if (this.muted) {
      if (this.music?.isPlaying) this.music.pause();
    } else if (this.music?.isPaused) {
      this.music.resume();
    }
    return !this.muted;
  }

  /* ---- music ---- */

  /**
   * Play `def`, or keep playing it if it is already the current track.
   * Never stacks: any previous track is stopped first.
   */
  playMusic(def: MusicTrackDef): void {
    if (this.destroyed) return;
    if (this.musicKey === def.key && (this.music?.isPlaying || this.music?.isPaused)) return;

    this.stopMusic();
    this.musicKey = def.key;

    if (this.game.cache.audio.exists(def.key)) {
      try {
        const snd = this.game.sound.add(def.key, {
          loop: def.loop,
          volume: AUDIO_DEFAULTS.MUSIC,
        });
        this.music = snd;
        this.seqTrack = null;
        this.seqName = "";
        if (!this.muted) snd.play();
        return;
      } catch {
        /* fall through to the sequencer */
      }
    }

    /* No file: run the in-code chiptune for this scene instead. */
    this.startFallback(def.fallback);
  }

  stopMusic(): void {
    if (this.music) {
      try {
        this.music.stop();
        this.music.destroy();
      } catch {
        /* ignore */
      }
      this.music = null;
    }
    this.musicKey = "";
    this.seqTrack = null;
    this.seqName = "";
  }

  private startFallback(name: string): void {
    const t = FALLBACK_TRACKS[name] ?? FALLBACK_TRACKS.title;
    if (this.seqName === name) return;
    this.seqName = name;
    this.seqTrack = t;
    this.seqBeat = 0;
    this.seqStep = 0;
  }

  /**
   * Advance the fallback sequencer. Called once per frame by the active scene;
   * a no-op when a real track is streaming, which is the normal case.
   */
  tickMusic(dt: number): void {
    const q = this.seqTrack;
    if (!q || this.muted || !this.ctx || this.destroyed) return;
    this.seqBeat -= dt;
    if (this.seqBeat > 0) return;

    const beat = 60 / (q.bpm * AUDIO_DEFAULTS.TEMPO_SCALE) / 2;
    this.seqBeat = beat;
    const i = this.seqStep++ % q.l.length;
    const lead = q.l[i];
    const counter = q.c[i % q.c.length];
    const bass = q.bass[Math.floor(i / 2) % q.bass.length];
    const arp = q.arp[i % q.arp.length];

    if (lead) this.tone(lead, beat * 0.82, "square", 0.056, 0, 0, "music");
    if (i % 2 === 1 && counter) this.tone(counter, beat * 1.55, "square", 0.025, 0, 0, "music");
    if (i % 2 === 0 && bass) this.tone(bass, beat * 1.82, "triangle", 0.078, 0, 0, "music");
    if (arp && i % 2 === 0) this.tone(arp, beat * 0.42, "square", 0.014, 0, beat * 0.34, "music");
    this.drum(q.d[i % q.d.length], beat);
  }

  /* ---- synthesis primitives (NES vocabulary) ---- */

  private track(node: AudioScheduledSourceNode): void {
    this.live.add(node);
    node.onended = () => {
      this.live.delete(node);
      try {
        node.disconnect();
      } catch {
        /* ignore */
      }
    };
  }

  private busNode(bus: Bus): GainNode | null {
    return bus === "music" ? this.musicBus : this.sfxBus;
  }

  /** One pulse/triangle voice. `slide` bends the pitch across the note. */
  tone(
    f: number,
    d = 0.08,
    type: OscillatorType = "square",
    v = 0.1,
    slide = 0,
    delay = 0,
    bus: Bus = "sfx",
  ): void {
    const ctx = this.ctx;
    const out = this.busNode(bus);
    if (!ctx || !out || this.muted || !f || this.destroyed) return;

    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    const a = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(35, f + slide), t + d);
    a.gain.setValueAtTime(0.001, t);
    a.gain.exponentialRampToValueAtTime(v, t + 0.006);
    a.gain.exponentialRampToValueAtTime(0.001, t + d);
    o.connect(a);
    a.connect(out);
    this.track(o);
    o.start(t);
    o.stop(t + d + 0.025);
  }

  /** The noise channel: filtered white noise for kick, snare and hat. */
  noise(d = 0.12, v = 0.09, cut = 1400, delay = 0, bus: Bus = "sfx", high = false): void {
    const ctx = this.ctx;
    const out = this.busNode(bus);
    if (!ctx || !out || this.muted || this.destroyed) return;

    const t = ctx.currentTime + delay;
    const len = Math.max(1, Math.floor(ctx.sampleRate * d));
    const b = ctx.createBuffer(1, len, ctx.sampleRate);
    const q = b.getChannelData(0);
    for (let i = 0; i < len; i++) q[i] = (Math.random() * 2 - 1) * (1 - (i / len) * 0.28);

    const s = ctx.createBufferSource();
    const a = ctx.createGain();
    const f = ctx.createBiquadFilter();
    s.buffer = b;
    f.type = high ? "highpass" : "lowpass";
    f.frequency.value = cut;
    a.gain.setValueAtTime(v, t);
    a.gain.exponentialRampToValueAtTime(0.001, t + d);
    s.connect(f);
    f.connect(a);
    a.connect(out);
    this.track(s);
    s.start(t);
    s.stop(t + d + 0.02);
  }

  private drum(ch: string, d: number): void {
    if (ch === "K") {
      this.tone(105, d * 0.7, "sine", 0.085, -62, 0, "music");
      this.noise(0.025, 0.018, 600, 0, "music");
    } else if (ch === "S") {
      this.noise(0.09, 0.052, 1150, 0, "music", true);
      this.tone(190, 0.045, "triangle", 0.018, -45, 0, "music");
    } else if (ch === "H") {
      this.noise(0.025, 0.022, 4300, 0, "music", true);
    }
  }

  /* ---- game sound effects (ported from v1.7) ---- */

  menu(): void {
    this.tone(620, 0.05, "square", 0.08, 100);
    this.tone(930, 0.07, "square", 0.045, -60, 0.035);
  }

  jump(air = false): void {
    this.tone(air ? 460 : 285, 0.1, "triangle", 0.12, air ? 430 : 350);
    this.tone(air ? 920 : 570, 0.07, "square", 0.04, -180, 0.025);
  }

  dash(): void {
    this.noise(0.12, 0.1, 1800);
    this.tone(105, 0.14, "sawtooth", 0.08, 170);
    this.tone(420, 0.09, "square", 0.04, -260, 0.02);
  }

  shot(kind: string): void {
    const table: Record<string, [number, number, number]> = {
      pulse: [790, 0.065, -210],
      browser: [940, 0.06, -300],
      canvas: [530, 0.1, 250],
      crossnet: [1120, 0.12, -720],
      evergreen: [155, 0.17, 190],
    };
    const z = table[kind] ?? table.pulse;
    this.tone(z[0], z[1], kind === "evergreen" ? "sawtooth" : "square", 0.1, z[2]);
    this.tone(z[0] * 0.5, z[1] * 0.8, "triangle", 0.045, z[2] * 0.35, 0.012);
  }

  enemy(kind: string): void {
    const ice = kind === "ice" || kind === "freeze" || kind === "icicle";
    const fire = kind === "fire" || kind === "lava" || kind === "flame";
    const f = ice ? 680 : fire ? 180 : 900;
    this.tone(f, 0.075, fire ? "sawtooth" : "square", 0.035, ice ? 180 : fire ? 120 : -260);
    if (kind === "home") this.tone(330, 0.16, "triangle", 0.025, 80);
  }

  chargeReady(): void {
    this.tone(520, 0.08, "triangle", 0.065, 360);
    this.tone(1040, 0.13, "square", 0.055, 240, 0.07);
    this.tone(1560, 0.08, "square", 0.025, -120, 0.14);
  }

  chargedShot(): void {
    this.noise(0.18, 0.11, 1800);
    this.tone(175, 0.23, "sawtooth", 0.13, 600);
    this.tone(980, 0.16, "triangle", 0.1, -260);
    this.tone(1480, 0.1, "square", 0.045, -500, 0.035);
  }

  hurt(): void {
    this.noise(0.15, 0.12, 1250);
    this.tone(125, 0.18, "square", 0.095, -72);
    this.tone(72, 0.14, "sine", 0.06, -30);
  }

  relay(): void {
    [392, 523, 659, 784, 1047].forEach((f, i) =>
      this.tone(f, 0.12, i % 2 ? "square" : "triangle", 0.085, 0, i * 0.055),
    );
  }

  bossAppear(): void {
    [220, 165, 247, 123, 294].forEach((f, i) =>
      this.tone(f, 0.2, i % 2 ? "triangle" : "square", 0.1, i === 4 ? 80 : 0, i * 0.135),
    );
    this.noise(0.32, 0.07, 700, 0.15);
  }

  reward(): void {
    [330, 440, 554, 660, 880, 1100].forEach((f, i) =>
      this.tone(f, 0.17, i % 2 ? "square" : "triangle", 0.09, 0, i * 0.075),
    );
  }

  fail(): void {
    [330, 247, 196, 165, 98].forEach((f, i) =>
      this.tone(f, 0.22, "square", 0.09, -20, i * 0.13),
    );
  }
}
