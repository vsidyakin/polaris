# Polaris-Man — Signal Breaker

The Uranus easter egg. A Phaser 4 conversion of the standalone prototype
`Mersive_Polaris_Signal_Breaker_v1.7.html`, wired into the existing
solar-system launcher as egg #8.

| | |
|---|---|
| Source of record | `Easter egg/Games to add/Mersive_Polaris_Signal_Breaker_v1.7.html` (SHA-256 `27676BF7291751A9…`) |
| Game code | `src/games/polaris-man/` |
| Artwork | `public/eggs/polaris-man/art/` — 28 PNGs, byte-identical to source |
| Music | `public/eggs/polaris-man/audio/` — 15 OGG, authored in FamiStudio |
| Editable projects | `Game audio files/Polaris Man/nes/famistudio/` — 15 `.txt` |
| Archival masters | `Game audio files/Polaris Man/nes/wav/` — 15 WAV, 44.1 kHz mono |
| Engine | Phaser 4.2.1 (new dependency, approved) |
| Activation | Uranus in Mission Control → briefing → **GO** |

## Documents

1. [Feature parity matrix](feature-parity.md) — every v1.7 behaviour and where it went
2. [Architecture](architecture.md) — scenes, modules, and why physics is not Arcade
3. [Assets](assets.md) — inventory, hashes, and the artwork-unchanged proof
4. [Audio](audio.md) — source register, NES conversion method, loop verification
5. [Uranus integration](uranus-integration.md) — activation, lifecycle, accessibility
6. [Level design review](level-design-review.md) — playability assessment and tuning changes
7. [Testing](testing.md) — what was run, what passed, and what was **not** verified

## Quick start

```bash
pnpm dev                  # play it: open Mission Control, click Uranus
pnpm check                # typecheck (0 errors)
pnpm test:game            # 143 game-state assertions
pnpm test:loops           # loop-seam analysis of the 15 rendered tracks
pnpm build                # production build
```

## The three things worth knowing

**The artwork is locked and untouched.** Every source PNG was hashed before any
work started and re-hashed at the end: 36 files, zero altered. The 28 the game
uses were copied into `public/` byte-for-byte. Nothing was cropped, rescaled,
re-encoded or restyled. Sub-rects in `src/games/polaris-man/data.ts` do all the
framing.

**The prototype had no audio files.** v1.7 synthesised everything in WebAudio
at runtime. The 30 Stability WAVs (two passes of 15) were a parallel effort the
game never loaded. So this was not a codec conversion — the 15 NES tracks were
composed in FamiStudio against the measured tempo, section structure and energy
curve of the first-pass references. See [Audio](audio.md).

**Nothing loads until Uranus is activated.** Phaser and the game are a single
dynamic import; the artwork and music are fetched per screen. A visitor who
never opens the egg downloads none of it, and opening it costs ~1.9 MB before
the title screen appears rather than the 38 MB the full set weighs.
