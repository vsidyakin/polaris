#!/usr/bin/env python3
"""Mars: Signal Siege — assemble the sound-effect library.

Sources, deliberately split by what each tool is actually good at:

  Stable Audio  broadband, textured, physical — destruction, impacts, the
                cryo freeze, the thermal launcher, boots on deck. These need
                noise structure a 2A03 cannot produce.
  FamiStudio    tonal and rhythmic — weapon blips, UI, and the two musical
                stingers. Chip voicing here is the right answer rather than a
                fallback: a UI confirm wants a clean interval, not a sample.

Output: public/eggs/mars-signal-siege/audio/sfx/*.ogg + *.mp3, plus a manifest.

Every source is treated the same way on the way out, because generated audio
and rendered chiptune both arrive with problems that are audible in a game
even when they are inaudible in isolation:

  * Generated clips are padded to their requested length, so a 2 s render of a
    0.4 s impact carries 1.6 s of silence. Left in, every hit holds a voice
    open and the pool starves.
  * Both sources start and end on non-zero samples, which clicks when a short
    effect is retriggered rapidly. Short fades at both ends fix it.
  * Stable Audio returns clips peaking at exactly 1.0. Layered over music that
    is already at -16.5 dBFS, that is what makes combat crackle.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
import wave

try:
    import numpy as np
except ImportError:
    print("build-mars-sfx: numpy is required (pip install numpy)")
    sys.exit(2)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AUDIO_ROOT = os.path.join(ROOT, "Game audio files", "Mars Signal Siege")
SA = os.path.join(AUDIO_ROOT, "sfx-masters", "stable-audio")
FS = os.path.join(AUDIO_ROOT, "famistudio", "render")
OUT = os.path.join(ROOT, "public", "eggs", "mars-signal-siege", "audio", "sfx")
MANIFEST = os.path.join(OUT, "sfx.json")

SILENCE = 0.004          # below this is silence for trimming purposes
FADE_IN_MS = 3
FADE_OUT_MS = 22
# Peak targets. Combat effects sit below UI so that a firefight does not bury
# the interface, and everything sits under 0.9 so layers do not sum to clipping.
PEAK = {"weapon": 0.62, "impact": 0.78, "ui": 0.70, "sting": 0.82, "body": 0.72}
MAX_SECONDS = {"weapon": 0.45, "impact": 1.30, "ui": 0.60, "sting": 3.20, "body": 1.60}

# name -> (source dir, file, category, optional semitone shift)
SFX = {
    # --- player weapons, one per slot, matching data.ts weapon order ---------
    "fire0":      (FS, "fire_pulse.wav",        "weapon", 0),
    "fire1":      (FS, "fire_stream.wav",       "weapon", 0),
    "fire2":      (FS, "fire_spread.wav",       "weapon", 0),
    "fire3":      (FS, "fire_wave.wav",         "weapon", 0),
    "fire4":      (SA, "freeze.wav",            "weapon", 0),
    "fire5":      (SA, "fire5_thermal.wav",     "weapon", 0),
    "fire6":      (FS, "fire_guided.wav",       "weapon", 0),
    "fire7":      (SA, "fire7_barrier.wav",     "weapon", 0),
    # --- enemy shot families: one chip source, three pitched variants so the
    #     four enemy groups do not all sound identical ------------------------
    "enemyFire0": (FS, "enemy_fire.wav",        "weapon", 0),
    "enemyFire1": (FS, "enemy_fire.wav",        "weapon", 5),
    "enemyFire2": (FS, "enemy_fire.wav",        "weapon", -4),
    # --- movement -----------------------------------------------------------
    "jump":       (FS, "jump.wav",              "body", 0),
    "land":       (SA, "land.wav",              "body", 0),
    # --- combat -------------------------------------------------------------
    "pickup":     (FS, "pickup.wav",            "ui", 0),
    "freeze":     (SA, "freeze.wav",            "impact", 0),
    "shield":     (SA, "shield.wav",            "impact", 0),
    "playerHit":  (SA, "playerHit.wav",         "impact", 0),
    "death":      (SA, "death.wav",             "body", 0),
    "enemyHit":   (SA, "enemyHit.wav",          "impact", 0),
    "enemyDown":  (SA, "enemyDown.wav",         "impact", 0),
    "bossHit":    (SA, "bossHit.wav",           "impact", 0),
    "bossDown":   (SA, "bossDown.wav",          "sting", 0),
    # --- interface ----------------------------------------------------------
    "uiMove":     (FS, "ui_move.wav",           "ui", 0),
    "uiConfirm":  (FS, "ui_confirm.wav",        "ui", 0),
    "deny":       (FS, "ui_deny.wav",           "ui", 0),
    "pause":      (FS, "pause.wav",             "ui", 0),
    "resume":     (FS, "resume.wav",            "ui", 0),
    "respawn":    (FS, "resume.wav",            "ui", -3),
    "deploy":     (FS, "deploy.wav",            "sting", 0),
    "clear":      (FS, "clear_sting.wav",       "sting", 0),
    "gameover":   (FS, "gameover_sting.wav",    "sting", 0),
}


def ffmpeg_exe():
    try:
        subprocess.run(["ffmpeg", "-version"], capture_output=True, check=True)
        return "ffmpeg"
    except Exception:
        pass
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        return None


def read_wav(path):
    w = wave.open(path, "rb")
    n, rate, ch, width = w.getnframes(), w.getframerate(), w.getnchannels(), w.getsampwidth()
    raw = w.readframes(n)
    w.close()
    if width != 2:
        raise RuntimeError(f"{path}: expected 16-bit PCM")
    a = np.frombuffer(raw, dtype=np.int16).astype(np.float64) / 32768.0
    a = a.reshape(-1, ch) if ch > 1 else a.reshape(-1, 1)
    return a.mean(axis=1), rate            # SFX are mono; panning is Phaser's job


def write_wav(path, a, rate):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    pcm = (np.clip(a, -1, 1) * 32767).astype(np.int16)
    w = wave.open(path, "wb")
    w.setnchannels(1)
    w.setsampwidth(2)
    w.setframerate(rate)
    w.writeframes(pcm.tobytes())
    w.close()


def pitch_shift(a, semitones):
    """Resample for pitch. Changes length too, which is correct for an SFX
    variant: a higher-pitched shot should also be a shorter one."""
    if not semitones:
        return a
    ratio = 2 ** (semitones / 12.0)
    n = max(1, int(len(a) / ratio))
    idx = np.linspace(0, len(a) - 1, n)
    return np.interp(idx, np.arange(len(a)), a)


def trim(a, rate, max_seconds):
    """Strip generated padding, then cap the length."""
    env = np.abs(a)
    live = np.flatnonzero(env > SILENCE)
    if len(live) == 0:
        return a[: int(rate * 0.05)]
    start, end = live[0], live[-1] + 1
    # Keep a couple of ms before the transient so the attack is not clipped.
    start = max(0, start - int(rate * 0.002))
    a = a[start:end]
    cap = int(rate * max_seconds)
    if len(a) > cap:
        a = a[:cap]
    return a


def envelope(a, rate):
    """Short fades at both ends so rapid retriggers do not click."""
    n_in = min(len(a) // 4, int(rate * FADE_IN_MS / 1000))
    n_out = min(len(a) // 2, int(rate * FADE_OUT_MS / 1000))
    if n_in > 0:
        a[:n_in] *= np.linspace(0, 1, n_in)
    if n_out > 0:
        a[-n_out:] *= np.cos(np.linspace(0, np.pi / 2, n_out))
    return a


def main():
    ff = ffmpeg_exe()
    if not ff:
        print("build-mars-sfx: no ffmpeg (pip install imageio-ffmpeg)")
        return 2
    os.makedirs(OUT, exist_ok=True)
    tmp = os.path.join(OUT, "_tmp.wav")
    manifest, total = {}, 0
    missing = []

    print(f"{'sfx':12s} {'src':4s} {'cat':7s} {'ms':>6s} {'peak':>5s} {'ogg B':>7s}")
    for name, (src_dir, fn, cat, shift) in SFX.items():
        path = os.path.join(src_dir, fn)
        if not os.path.exists(path):
            missing.append(f"{name} <- {os.path.relpath(path, ROOT)}")
            continue
        a, rate = read_wav(path)
        a = pitch_shift(a, shift)
        a = trim(a, rate, MAX_SECONDS[cat])
        a = envelope(a, rate)
        peak = np.abs(a).max()
        if peak > 1e-6:
            a = a * (PEAK[cat] / peak)

        write_wav(tmp, a, rate)
        ogg = os.path.join(OUT, name + ".ogg")
        mp3 = os.path.join(OUT, name + ".mp3")
        subprocess.run([ff, "-y", "-loglevel", "error", "-i", tmp,
                        "-c:a", "libvorbis", "-qscale:a", "3", "-ar", "44100", ogg], check=True)
        subprocess.run([ff, "-y", "-loglevel", "error", "-i", tmp,
                        "-c:a", "libmp3lame", "-qscale:a", "6", "-ar", "44100", mp3], check=True)
        size = os.path.getsize(ogg)
        total += size + os.path.getsize(mp3)
        manifest[name] = {
            "source": "stable-audio" if src_dir == SA else "famistudio",
            "sourceFile": fn,
            "category": cat,
            "semitoneShift": shift,
            "ms": round(len(a) / rate * 1000, 1),
            "peak": round(float(PEAK[cat]), 3),
            "oggBytes": size,
        }
        print(f"{name:12s} {'SA' if src_dir==SA else 'FS':4s} {cat:7s} "
              f"{len(a)/rate*1000:6.0f} {PEAK[cat]:5.2f} {size:7d}")

    if os.path.exists(tmp):
        os.remove(tmp)
    with open(MANIFEST, "w", encoding="utf-8") as fh:
        json.dump(manifest, fh, indent=1)

    if missing:
        print("\nMISSING SOURCES:")
        for m in missing:
            print("  " + m)
    print(f"\nbuild-mars-sfx: {len(manifest)} effects, {total/1024:.0f} KB "
          f"(ogg+mp3), {len(missing)} missing")
    return 1 if missing else 0


if __name__ == "__main__":
    sys.exit(main())
