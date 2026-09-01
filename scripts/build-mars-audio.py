#!/usr/bin/env python3
"""Mars: Signal Siege — remaster the music masters and encode for the web.

Input:  Game audio files/Mars Signal Siege/masters/*.wav   (~97 MB of PCM)
Output: public/eggs/mars-signal-siege/audio/*.ogg + *.mp3

Build-time only. Needs numpy and an ffmpeg binary; `pip install numpy
imageio-ffmpeg` supplies both without a system install. The site itself has no
audio dependency — it fetches finished files.

What this fixes, and why it is not cosmetic
-------------------------------------------
The thirteen masters are finished compositions, but they were rendered as
standalone pieces rather than as game cues, so three things are wrong for
looping playback:

  1. Five of the eight looping tracks fade to silence at the end. Looping those
     puts a hole in the music every time round. Each is trimmed back to where
     the arrangement is still at full energy, then crossfaded into its own
     opening so the wrap is continuous.
  2. Six peak at exactly 1.0, i.e. already clipped. Normalising without
     headroom would only clip harder, so gain is set from RMS and the peak is
     brought down under a soft knee.
  3. Loudness spans 7.8 dB — the title cue is far quieter than the mission
     tracks, and the boss cue is among the loudest. The brief asks that boss
     music be stronger but not dramatically louder, so mission and boss cues
     are matched to targets one dB apart rather than left where they landed.

Shipping 97 MB of WAV was never an option; OGG at the quality used here is
about 1/12th the size, with MP3 alongside for browsers that want it.
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
    print("build-mars-audio: numpy is required (pip install numpy)")
    sys.exit(2)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AUDIO_SRC = os.path.join(ROOT, "Game audio files", "Mars Signal Siege")
MASTERS = os.path.join(AUDIO_SRC, "masters")
OUT = os.path.join(ROOT, "public", "eggs", "mars-signal-siege", "audio")
REPORT = os.path.join(ROOT, "Game audio files", "Mars Signal Siege", "loop-points.json")

# Target RMS in dBFS. Mission and boss sit one dB apart: audibly stronger,
# not a jump in level. One-shots sit slightly under so a stinger landing over
# a mission track does not spike.
TARGET_MISSION = -16.5
TARGET_BOSS = -15.5
TARGET_FINAL = -15.0
TARGET_ONESHOT = -17.0
PEAK_CEILING = 0.96
# Loop crossfade length. Long enough to hide a phase mismatch, short enough
# that the reprise of the opening bar is not heard as a stutter.
XFADE_MS = 44

# key -> (file, loops, role)
CUES = {
    "title":        ("Mars_title.wav",            False, "oneshot"),
    "introduction": ("Mars_introduction.wav",     True,  "mission"),
    "assault":      ("Mars_assault_hangar.wav",   True,  "mission"),
    "bases":        ("Mars_bases.wav",            True,  "mission"),
    "toxic":        ("Mars_toxic_waterfall.wav",  True,  "mission"),
    "ice":          ("Mars_ice_field.wav",        True,  "mission"),
    "energy":       ("Mars_energy_zone.wav",      True,  "mission"),
    "lair":         ("Mars_alien_lair.wav",       True,  "mission"),
    "boss":         ("Mars_boss.wav",             True,  "boss"),
    "clear":        ("Mars_area_clear.wav",       False, "oneshot"),
    "coreDown":     ("Mars_alien_dead.wav",       False, "oneshot"),
    "credits":      ("Mars_credits.wav",          False, "oneshot"),
    "gameover":     ("Mars_game_over.wav",        False, "oneshot"),
    # The Lock-In Engine's theme. The brief allows "Alien Lair or an enhanced
    # derivative" for the final fight, and mission 12's stage music is already
    # Alien Lair — so using it unchanged means entering the final arena changes
    # nothing at all, because playMusic() correctly no-ops when the requested
    # cue is the one already playing. This is the derivative: same composition,
    # driven harder and opened up at the top, so the transition is audible and
    # the last fight does not sound like the eleven before it.
    "lairFinal":    ("Mars_alien_lair.wav",       True,  "final"),
}


# Cues built here rather than remastered from a finished master.
#
# Two screens needed music that did not exist: the taunt card the defeated boss
# gets at the end of every mission, and the epilogue that plays once the
# campaign is over. Both are assembled from two sources — a four-channel NES
# part written in FamiStudio, and an ambient bed generated with Stable Audio —
# because neither alone carries the screen. The chip part is the character (it
# is the voice the rest of the soundtrack speaks in) and the bed is the room it
# stands in; a chip tune alone reads as a menu jingle on a full-bleed painted
# card, and a bed alone has nothing to say.
#
# The chip file is exported at two loops, so half its length is exactly one
# loop and that is the length the mix is cut to. The bed is tiled to reach it.
#
# (path, gain) for the chip, (path, gain) for the bed, then the level target.
LAYERED = {
    "taunt": (
        ("chip/Mars_taunt_chip.wav", 1.00),
        ("bed/Mars_taunt_bed.wav", 0.38),
        "mission",
    ),
    "epilogue": (
        ("chip/Mars_epilogue_chip.wav", 0.92),
        ("bed/Mars_epilogue_bed.wav", 0.55),
        "mission",
    ),
}


def to_stereo(a):
    return a if a.shape[1] == 2 else np.repeat(a, 2, axis=1)


def tile_to(a, rate, length):
    """Repeat `a` until it reaches `length`, crossfading its own wrap.

    The bed is a fixed-length generation and the chip loop is whatever the
    composition came out at, so one has to be made to fit the other. Butting
    copies end to end puts an audible edge on every repeat, which on a bed of
    sustained drone is the most obvious artefact there is.
    """
    if len(a) >= length:
        return a[:length]
    fade = min(int(rate * 0.75), len(a) // 4)
    ramp = np.linspace(0.0, 1.0, fade)[:, None]
    out = a.copy()
    while len(out) < length:
        head = a.copy()
        head[:fade] = head[:fade] * ramp + out[-fade:] * (1.0 - ramp)
        out = np.vstack([out[:-fade], head])
    return out[:length]


def build_layered(key, chip_spec, bed_spec):
    """Mix one chip part over one ambient bed, cut to a single chip loop."""
    (chip_path, chip_gain) = chip_spec
    (bed_path, bed_gain) = bed_spec
    chip, rate = read_wav(os.path.join(AUDIO_SRC, *chip_path.split("/")))
    bed, bed_rate = read_wav(os.path.join(AUDIO_SRC, *bed_path.split("/")))
    if bed_rate != rate:
        raise RuntimeError(f"{key}: chip is {rate} Hz, bed is {bed_rate} Hz")
    chip = to_stereo(chip)
    bed = to_stereo(bed)
    one_loop = len(chip) // 2          # exported at loopCount 2
    chip = chip[:one_loop]
    bed = tile_to(bed, rate, one_loop)
    return chip * chip_gain + bed * bed_gain, rate


def enhance(a):
    """Brighten and drive a cue into its final-boss variant.

    A high-shelf lift plus a gentle tanh drive, which is what "enhanced" has to
    mean here: the arrangement is not re-composed, it is re-voiced. Pitch and
    tempo are untouched, so it still reads as the same theme — which is the
    point, since the player has been hearing it for a whole mission.
    """
    prev = np.vstack([a[:1], a[:-1]])
    high = a - prev                       # one-pole high-pass
    lifted = a + high * 0.55              # high-shelf lift
    return np.tanh(lifted * 1.35) / np.tanh(1.35)


def ffmpeg_exe():
    for cand in ("ffmpeg",):
        try:
            subprocess.run([cand, "-version"], capture_output=True, check=True)
            return cand
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
        raise RuntimeError(f"{path}: expected 16-bit PCM, got {width*8}-bit")
    a = np.frombuffer(raw, dtype=np.int16).astype(np.float64) / 32768.0
    if ch > 1:
        a = a.reshape(-1, ch)
    else:
        a = a.reshape(-1, 1)
    return a, rate


def write_wav(path, a, rate):
    clipped = np.clip(a, -1.0, 1.0)
    pcm = (clipped * 32767.0).astype(np.int16)
    w = wave.open(path, "wb")
    w.setnchannels(a.shape[1])
    w.setsampwidth(2)
    w.setframerate(rate)
    w.writeframes(pcm.tobytes())
    w.close()


def mono(a):
    return a.mean(axis=1)


def find_loop_end(a, rate):
    """Last point where the arrangement is still at full energy.

    Walks back from the end in 20 ms windows until one is within 6 dB of the
    track's own average. That is the end of the music proper; everything after
    it is the render's fade, which is exactly what puts a hole in the loop.
    """
    m = mono(a)
    ref = np.sqrt((m ** 2).mean())
    win = max(1, int(rate * 0.020))
    floor = ref * 0.5                      # -6 dB relative to track average
    i = len(m)
    while i - win > int(rate * 1.0):       # never trim below one second
        seg = m[i - win:i]
        if np.sqrt((seg ** 2).mean()) >= floor:
            return i
        i -= win
    return len(m)


def loop_crossfade(a, rate, end):
    """Trim to `end` and blend the tail into the opening.

    Equal-power (cosine) weights rather than linear: a linear crossfade dips in
    perceived loudness through the middle, which is audible as a soft spot
    every time the track wraps.
    """
    L = min(int(rate * XFADE_MS / 1000.0), end // 4, len(a) - end if len(a) > end else end // 4)
    body = a[:end].copy()
    if L <= 0:
        return body
    t = np.linspace(0.0, 1.0, L, endpoint=False)[:, None]
    down = np.cos(t * np.pi / 2) ** 1.0
    up = np.sin(t * np.pi / 2) ** 1.0
    body[end - L:end] = body[end - L:end] * down + a[:L] * up
    return body


def soft_limit(a, ceiling=PEAK_CEILING):
    """Tanh knee above the ceiling.

    Hard clipping the six masters that already sit at full scale would add the
    very distortion the normalisation is meant to avoid.
    """
    peak = np.abs(a).max()
    if peak <= ceiling:
        return a
    knee = ceiling * 0.85
    over = np.abs(a) > knee
    sign = np.sign(a)
    excess = (np.abs(a) - knee) / max(1e-9, (peak - knee))
    shaped = knee + (ceiling - knee) * np.tanh(excess * 1.6)
    out = a.copy()
    out[over] = (sign * shaped)[over]
    return out


def normalise(a, target_db):
    m = mono(a)
    rms = np.sqrt((m ** 2).mean())
    if rms < 1e-9:
        return a
    gain = (10 ** (target_db / 20.0)) / rms
    return soft_limit(a * gain)


def encode(ff, wav_path, base):
    outputs = {}
    ogg = os.path.join(OUT, base + ".ogg")
    mp3 = os.path.join(OUT, base + ".mp3")
    subprocess.run(
        [ff, "-y", "-loglevel", "error", "-i", wav_path,
         "-c:a", "libvorbis", "-qscale:a", "4", "-ar", "44100", ogg],
        check=True)
    subprocess.run(
        [ff, "-y", "-loglevel", "error", "-i", wav_path,
         "-c:a", "libmp3lame", "-qscale:a", "5", "-ar", "44100", mp3],
        check=True)
    outputs["ogg"] = os.path.getsize(ogg)
    outputs["mp3"] = os.path.getsize(mp3)
    return outputs


def main():
    ff = ffmpeg_exe()
    if not ff:
        print("build-mars-audio: no ffmpeg (pip install imageio-ffmpeg)")
        return 2
    os.makedirs(OUT, exist_ok=True)
    tmp = os.path.join(OUT, "_tmp.wav")
    report = {}
    total_ogg = total_mp3 = total_src = 0

    print(f"{'cue':13s} {'src s':>7s} {'loop s':>7s} {'trim':>6s} "
          f"{'dBFS':>6s} {'peak':>5s} {'ogg KB':>8s} {'mp3 KB':>8s}")

    for key, (chip_spec, bed_spec, role) in LAYERED.items():
        a, rate = build_layered(key, chip_spec, bed_spec)
        src_sec = len(a) / rate
        end = find_loop_end(a, rate)
        trimmed = (len(a) - end) / rate
        a = loop_crossfade(a, rate, end)
        a = normalise(a, {"mission": TARGET_MISSION, "oneshot": TARGET_ONESHOT}[role])
        write_wav(tmp, a, rate)
        sizes = encode(ff, tmp, key)
        total_ogg += sizes["ogg"]
        total_mp3 += sizes["mp3"]
        loop_sec = len(a) / rate
        peak = float(np.max(np.abs(a)))
        rms = float(np.sqrt(np.mean(mono(a) ** 2)))
        db = 20 * np.log10(rms) if rms > 0 else -99
        # Same record shape as the remastered cues, so check-mars-audio can
        # seam-check these too. They loop under a screen the player sits on for
        # as long as they like, which is exactly where a bad seam is audible.
        report[key] = {
            "file": f"{chip_spec[0]} + {bed_spec[0]}",
            "layered": True,
            "loops": True,
            "role": role,
            "sourceSeconds": round(src_sec, 3),
            "loopSeconds": round(loop_sec, 3),
            "trimmedSeconds": round(trimmed, 3),
            "crossfadeMs": XFADE_MS,
            "rmsDbfs": round(float(db), 2),
            "peak": round(peak, 4),
            "oggBytes": sizes["ogg"],
            "mp3Bytes": sizes["mp3"],
        }
        print(f"  {key:11s} {src_sec:7.1f} {loop_sec:7.1f} {trimmed:6.1f} "
              f"{db:6.1f} {peak:5.2f} {sizes['ogg']/1024:8.0f} {sizes['mp3']/1024:8.0f}")

    for key, (fn, loops, role) in CUES.items():
        src = os.path.join(MASTERS, fn)
        if not os.path.exists(src):
            print(f"  MISSING master: {fn}")
            continue
        total_src += os.path.getsize(src)
        a, rate = read_wav(src)
        src_sec = len(a) / rate

        if role == "final":
            a = enhance(a)

        trimmed = 0.0
        if loops:
            end = find_loop_end(a, rate)
            trimmed = (len(a) - end) / rate
            a = loop_crossfade(a, rate, end)

        target = {"mission": TARGET_MISSION, "boss": TARGET_BOSS,
                  "oneshot": TARGET_ONESHOT, "final": TARGET_FINAL}[role]
        a = normalise(a, target)

        write_wav(tmp, a, rate)
        sizes = encode(ff, tmp, key)
        total_ogg += sizes["ogg"]
        total_mp3 += sizes["mp3"]

        m = mono(a)
        rdb = 20 * np.log10(np.sqrt((m ** 2).mean()) + 1e-12)
        report[key] = {
            "file": fn,
            "loops": loops,
            "role": role,
            "sourceSeconds": round(src_sec, 3),
            "loopSeconds": round(len(a) / rate, 3),
            "trimmedSeconds": round(trimmed, 3),
            "crossfadeMs": XFADE_MS if loops else 0,
            "rmsDbfs": round(float(rdb), 2),
            "peak": round(float(np.abs(a).max()), 4),
            "oggBytes": sizes["ogg"],
            "mp3Bytes": sizes["mp3"],
        }
        print(f"{key:13s} {src_sec:7.1f} {len(a)/rate:7.1f} {trimmed:6.2f} "
              f"{rdb:6.1f} {np.abs(a).max():5.2f} "
              f"{sizes['ogg']/1024:8.1f} {sizes['mp3']/1024:8.1f}")

    if os.path.exists(tmp):
        os.remove(tmp)
    with open(REPORT, "w", encoding="utf-8") as fh:
        json.dump(report, fh, indent=1)

    print(f"\nbuild-mars-audio: {len(report)} cues, masters {total_src/1024/1024:.1f} MB "
          f"-> ogg {total_ogg/1024/1024:.2f} MB + mp3 {total_mp3/1024/1024:.2f} MB")
    return 0


if __name__ == "__main__":
    sys.exit(main())
