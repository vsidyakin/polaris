# Audio

## The premise, corrected

The brief described converting modern-sounding Stability WAVs that the game
plays. Reading v1.7 in full showed something different:

**The standalone loads zero audio files.** Every note is synthesised at runtime
in WebAudio — and its channel layout was already NES-shaped: a square lead, a
square countermelody, a triangle bass, and filtered noise for drums, across 15
scene-mapped tracks. The 30 Stability WAVs (two passes of 15) were a parallel
effort the game never referenced.

So this was not a codec conversion. It was: compose 15 NES tracks in FamiStudio,
using the first-pass references for mood, tempo, section structure and energy,
and replace the runtime synthesiser as the primary soundtrack.

## Source register — first pass (the approved reference set)

`Game audio files/Polaris Man/Rejected modern-instrument versions/`
All PCM, 16-bit, 2 ch, 44.1 kHz. None used by the standalone game.

| # | File | MB | Sec | Role in the game |
|---|---|---|---|---|
| 01 | `01_Title_Screen.wav` | 12.63 | 75.0 | music — title/attract |
| 02 | `02_Mission_Select.wav` | 12.63 | 75.0 | music — mission grid, briefing, reward |
| 03 | `03_Mission_Track_01.wav` | 12.63 | 75.0 | music — Ariel |
| 04 | `04_Mission_Track_02.wav` | 12.63 | 75.0 | music — Umbriel |
| 05 | `05_Mission_Track_03.wav` | 12.63 | 75.0 | music — Titania |
| 06 | `06_Mission_Track_04.wav` | 12.63 | 75.0 | music — Oberon |
| 07 | `07_Mission_Track_05.wav` | 12.63 | 75.0 | music — Miranda |
| 08 | `08_Mission_Track_06.wav` | 12.63 | 75.0 | music — Puck |
| 09 | `09_Mission_Track_07.wav` | 12.63 | 75.0 | music — Cressida |
| 10 | `10_Mission_Track_08.wav` | 12.63 | 75.0 | music — Desdemona |
| 11 | `11_Boss_Battle.wav` | 12.63 | 75.0 | music — all eight moon bosses |
| 12 | `12_Victory.wav` | 1.70 | 10.0 | one-shot — victory card |
| 13 | `13_End_Boss.wav` | 12.63 | 75.0 | music — Polaris Nexus / Protocol Prime |
| 14 | `14_Game_Over.wav` | 1.70 | 10.0 | one-shot — signal lost card |
| 15 | `15_Epilogue.wav` | 12.63 | 75.0 | music — end crawl |

A second pass of 15 exists in the parent folder. Per direction it is **out of
scope**; the first pass is the reference. Both sets are left untouched.

The generation manifest is explicit that nobody has listened to any of the 30
files. That is also true of this work — see *Limits* below.

## What was measured, not guessed

`scripts/analyse-reference-audio.mjs` decodes each WAV and computes an onset
envelope, tempo by autocorrelation, section boundaries by spectral novelty, a
per-second RMS curve, register balance, and a coarse per-beat pitch track.

Two findings drove the work:

**1. The measured tempos corroborate the prompts.** Once half-time detection is
resolved, measurement and stated intent agree almost exactly:

| Track | Prompt | Measured | Reading | Used |
|---|---|---|---|---|
| 01 | 150 | 74.5 | ×2 = 149 | 150 |
| 02 | 152 | 150.0 | direct | 152 |
| 03 | 178 | 119.0 | ×1.5 = 178.5 | 178 |
| 04 | 160 | 79.0 | ×2 = 158 | 160 |
| 05 | 142 | 70.5 | ×2 = 141 | 142 |
| 06 | 174 | 169.5 | direct | 174 |
| 07 | 148 | 145.8 | direct | 148 |
| 08 | 164 | 81.5 | ×2 = 163 | 164 |
| 09 | 176 | 84.3 | ×2 ≈ 169 | 176 |
| 10 | 146 | 72.5 | ×2 = 145 | 146 |
| 11 | 184 | 181.5 | direct | 184 |
| 12 | 156 | 154.5 | direct | 156 |
| 13 | 170 | 169.5 | direct | 170 |
| 14 | 104 | 159.3 | low confidence, sparse cue | 104 |
| 15 | 126 | 124.8 | direct | 126 |

**2. None of the references actually loop.** Head/tail correlation across all
thirteen 75-second "loops" measured −0.085 to +0.097 — i.e. no relationship at
all. Codec conversion was never going to produce a usable game loop; authoring
real loop points was the only route.

## The arrangements

15 FamiStudio projects, `Game audio files/Polaris Man/nes/famistudio/*.txt`,
created and validated through the FamiStudio MCP (v4.5.3).

Every project uses exactly four instruments — `PulseLead`, `PulseCounter`,
`TriangleBass`, `NoiseDrums` — and **zero DPCM**, confirmed by the tool's own
validation output on all 15.

Channel discipline, matching the hardware:

- **Pulse 1** — principal melody, duty cycles varied per section
- **Pulse 2** — countermelody or offbeat harmony; fast arpeggios where a chord is implied
- **Triangle** — bass, one note at a time
- **Noise** — kick / snare / hat as a *single* monophonic line, so a kick and a
  hat can never sound together, exactly as on the chip

Tempo uses FamiTracker mode, `speed 6` with `tempo` = target BPM, which lands
each track on its number.

| # | Track | Key | BPM | Bars | Sec | Loop pt | Character |
|---|---|---|---|---|---|---|---|
| 01 | Title Screen | A minor | 150 | 40 | 63.9 | bar 4 | heroic; states the Polaris motif |
| 02 | Mission Select | D minor | 152 | 38 | 59.9 | bar 2 | question/answer, unresolved |
| 03 | Ariel | E minor | 178 | 44 | 59.2 | bar 4 | fastest; driving signal pulse |
| 04 | Umbriel | C minor | 160 | 40 | 59.9 | bar 4 | sparse, icy, long holds |
| 05 | Titania | A minor | 142 | 36 | 60.8 | bar 4 | staccato, electric, syncopated |
| 06 | Oberon | D minor | 174 | 44 | 60.6 | bar 4 | heavy, industrial, pounding |
| 07 | Miranda | F# minor | 148 | 36 | 58.3 | bar 4 | winding, chromatic, maze-like |
| 08 | Puck | G minor | 164 | 40 | 58.5 | bar 4 | jittery, stop-start gates |
| 09 | Cressida | B minor | 176 | 44 | 59.9 | bar 4 | rigid, mechanical, locked |
| 10 | Desdemona | E minor | 146 | 36 | 59.1 | bar 4 | wide intervals, sprawling |
| 11 | Boss Battle | D minor | 184 | 48 | 62.5 | bar 4 | descending chromatic threat vs rising answer |
| 12 | Victory | C major | 156 | 7 | 10.8 | — | one-shot fanfare, resolves and stops |
| 13 | End Boss | A minor | 170 | 44 | 62.0 | bar 4 | Polaris motif distorted; the culmination |
| 14 | Game Over | A minor | 104 | 5 | 11.5 | — | one-shot, descends and settles |
| 15 | Epilogue | C major | 126 | 32 | 60.9 | bar 4 | Polaris motif in full major |

All thirteen loops land in 58–64 s. Rendered durations sit within 0.105 s of the
arithmetic — that residual is NTSC frame quantisation (60.0988 Hz vs 60), it is
consistent across every track, and it is not drift.

### The Polaris motif

A rising fifth, a fourth, then a stepwise descent that resolves upward —
`A4 E5 A5 G5 E5 D5 E5` in A minor. It opens the title theme, returns distorted
under Protocol Prime, and resolves into C major over the epilogue. This is the
one deliberate piece of cross-score writing; nothing else quotes anything.

None of the 15 quotes Mega Man 2 or any other existing game music.

## Loop verification

`pnpm test:loops` (`scripts/check-loop-seams.mjs`) checks the three things a
listener actually notices at a loop point, each against the track's own
statistics:

- **gap** — tail RMS vs the track average
- **lurch** — head/tail energy ratio across the join
- **click** — the wrap-around sample step vs the largest step the track already makes

```
All 13 looping tracks pass; 2 one-shot cue(s) exempt.
```

Two notes on how that result was reached, because the first run disagreed:

**The click threshold was wrong at first.** Comparing the join against the 99th
percentile step flagged four clean tracks. For chiptune that is the wrong
yardstick — a square wave *is* a train of discontinuities, and the p99 sits in
the flat tops of the wave. Measured against the largest step each track already
makes, every join comes in at 0.12–0.88 of a transition the track produces
hundreds of times a second. The checker now uses that reference and says so.

**One real defect was found and fixed.** Cressida's final bar released early,
leaving ~85 ms of near-silence and a 5× swell into the loop (`tailVsAvg` 0.21,
`headTailRatio` 4.96). The arrangement was corrected to sustain through the bar
and re-rendered: 1.07 and 1.05. That is a genuine catch the ear would have made
in seconds and the first metric missed.

Umbriel is the remaining outlier at `tailVsAvg` 0.40 / `headTailRatio` 2.48. It
passes, and it is the deliberately sparse icy track thinning out at the end, so
the small swell into the loop reads as intentional — but it is the one to listen
to first.

## Runtime

`audio.ts` is the only place audio happens.

- **Music** — OGG through Phaser's sound manager, one track at a time, ever.
  `playMusic()` is idempotent for the current key and stops any previous track,
  so the soundtrack cannot stack.
- **SFX** — still synthesised, ported note-for-note from v1.7. They already obey
  the channel vocabulary, there are ~40 of them, and rendering each to a file
  would add weight for no audible gain.
- **Fallback** — if a music file 404s or OGG cannot be decoded, `playMusic()`
  drops to the in-code sequencer (`chiptune.ts`) rather than throwing. A missing
  asset degrades to different music, never to a broken overlay.
- **Buses** — master → compressor → destination, with separate music (0.36) and
  SFX (0.62) gains under a conservative 0.82 master.
- **Gesture gate** — the context is created on the first real interaction and
  never before.
- **Mute** — persisted to `psb_sound`, restored on reopen, toggled by **M** or
  the overlay's own control.
- **Tab hidden** — music pauses and the context suspends; returning does not
  un-mute anything the player muted.
- **Teardown** — every scheduled oscillator is tracked and stopped, the graph is
  disconnected, and the context is left to Phaser's `game.destroy()` so a later
  reopen gets a working one.

OGG is the only shipped format. Every browser that can run Phaser 4 decodes it;
shipping an MP3 twin would double the audio weight to serve nothing.

## Working locations

| Purpose | Path | Committed |
|---|---|---|
| Original references (first pass) | `Game audio files/Polaris Man/Rejected modern-instrument versions/` | no (untracked) |
| Second pass (unused) | `Game audio files/Polaris Man/*.wav` | no (untracked) |
| Editable FamiStudio projects | `Game audio files/Polaris Man/nes/famistudio/*.txt` | yes — 15 files, small |
| Archival WAV masters | `Game audio files/Polaris Man/nes/wav/*.wav` | no — 67.9 MB |
| Web OGG | `public/eggs/polaris-man/audio/*.ogg` | yes — 9.45 MB |
| Measurement output | `Game audio files/Polaris Man/nes/analysis/*.json` | no |

The FamiStudio MCP workspace copy lives at
`…/famistudio-mcp/workspace/polaris-man/`; the repo copy is the one to edit.

## Limits — read this before approving

**I cannot hear any of it.** Not the references, not the renders. Everything
above is measured or composed from stated intent, and the loop verification is
signal analysis, not listening.

What that means concretely:

- Tempo, structure, duration, loop integrity and channel legality are
  **verified** — those are arithmetic and signal properties.
- Whether the music is *good*, whether it fits each moon, and whether the mix
  balance is right are **unverified**. Please listen.
- The rendered tracks measure consistently brighter than the references
  (~30/25/45 low/mid/high against the references' more varied spread). The NES
  noise channel is inherently bright and the hats sit at volume 3–5 of 15, so
  this is plausible rather than wrong — but it is the most likely thing to want
  adjusting, and it is a one-line change per pattern.
- Melodic content is **original**, not recovered. The per-beat pitch track the
  analyser produces is a spectral peak, not a transcription, and was not used to
  reconstruct melodies. Where the references had a memorable tune, it is not in
  these arrangements — I could not reliably identify one without hearing it. If
  a specific melody matters, a MIDI or a hummed reference would let me place it.
