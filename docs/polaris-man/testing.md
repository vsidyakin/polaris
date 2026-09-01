# Testing

## The honest summary first

**No part of this was run in a browser.** The repository has no headless browser
and no test runner, and none was added without approval. Everything below is
either a static check, a Node-executed test of real game code, or signal
analysis of rendered audio.

That means the game has been **verified to compile, build, code-split, and
behave correctly at the level of its state logic and its audio** — and has
**never been played**. The manual checklist in the brief is reproduced at the
bottom with an explicit status against each item, and most of it says NOT RUN.

## Automated — run, passing

| Check | Command | Result |
|---|---|---|
| Type checking | `pnpm check` | **0 errors, 0 warnings** |
| Game-state tests | `pnpm test:game` | **143 / 143 assertions** |
| Loop-seam analysis | `pnpm test:loops` | **13 / 13 loops pass**, 2 one-shots exempt |
| Production build | `pnpm build` | **134 pages** |
| Artwork integrity | hash diff vs pre-work baseline | **0 of 36 altered** |
| Code-split isolation | grep of emitted chunks | Phaser only in the lazy chunk |

The two pre-existing `ts(6385)` deprecation warnings in `partners/where.astro`
and `resources/docs.astro` are untouched files and unrelated.

### What the 143 assertions cover

`scripts/test-polaris-man.mjs` compiles the pure modules with the project's own
`tsc` and requires them, so it exercises the shipped code rather than a
reimplementation of it.

- **Collision resolver** — landing flush on platforms, zeroing velocity, wall
  contact and side reporting, stale wall-flag clearing, hurtbox inset and its
  minimum-size clamp
- **Frame-rate independence** — friction produces the same result in one 0.1 s
  step as in ten 0.01 s steps to 1e-9
- **Campaign rules** — capability derivation, forged-save rejection, Nexus
  unlock gating, double-jump unlock on first clear, best-time monotonicity
- **Weakness chain** — every weakness names a real weapon; no boss is weak only
  to its own reward
- **Level construction** — platform counts and bounds for all eight moons,
  nothing below the floor or off-world, 5 relays, 5 mechanics, 20 enemies,
  ordered checkpoints, no enemy inside the floor
- **The boss gate** — the one thing that can make a mission unwinnable: shut
  with checkpoints outstanding, open when all five are secured, and not open
  from the wrong end of the map
- **Tuning sanity** — jump-cut exceeds gravity, wall slide is slower than free
  fall, dash outruns sprint and its cooldown outlasts it, kill plane below the
  floor, every weapon has ammo and a cooldown, the pulse is free
- **Artwork contract** — every sub-rect has four numbers and positive area (an
  inverted rect draws nothing, silently), 4 figures and 3 enemy types per moon,
  8 run frames, an anchor per air frame

### What the loop analysis found

Two things worth recording, because the first answer was wrong:

**A false alarm, corrected.** The initial click threshold compared each loop
join against the track's 99th-percentile sample step and flagged four clean
tracks. That is the wrong yardstick for chiptune — a square wave is a train of
discontinuities and the p99 sits in the flat tops of the wave. Measured against
the largest step each track already makes, every join is 0.12–0.88 of a
transition the track produces hundreds of times a second. The checker was
corrected and documents why.

**A real defect, fixed.** Cressida's final bar released early, leaving ~85 ms of
near-silence and a 5× swell into the loop. The arrangement was corrected to
sustain through the bar and re-rendered. `tailVsAvg` 0.21 → 1.07,
`headTailRatio` 4.96 → 1.05.

## Manual checklist — status

| Item | Status |
|---|---|
| Uranus pointer activation | **NOT RUN** — needs a browser |
| Uranus keyboard activation | **NOT RUN** |
| Game loading | **NOT RUN** |
| First-interaction audio unlock | **NOT RUN** |
| Title → game transition | **NOT RUN** |
| All controls | **NOT RUN** — bindings verified by reading; feel unverified |
| Pause and resume | **NOT RUN** |
| Damage and recovery | **NOT RUN** — values unit-tested, feel unverified |
| Scoring | **NOT RUN** |
| Victory | **NOT RUN** |
| Game over | **NOT RUN** |
| Restart | **NOT RUN** |
| Mute / unmute | **NOT RUN** |
| Close via visible button | **NOT RUN** — control is present in `#egg9` markup |
| Close via Escape | **NOT RUN** |
| Focus restoration | **NOT RUN** — implemented and reviewed, not observed |
| **Ten open/close/reopen cycles** | **NOT RUN** — the idempotence that makes this safe is implemented and code-reviewed, but ten real cycles have not happened |
| Tab-visibility pause | **NOT RUN** |
| Desktop viewport | **NOT RUN** |
| Mobile viewport | **NOT RUN** |
| Reduced motion | **NOT RUN** — CSS and particle path implemented |
| Missing-asset behaviour | **PARTLY** — fallbacks implemented and reviewed (renderer skips undecoded art, audio falls back to the sequencer, loader errors warn and continue); not exercised against a real 404 |
| No regressions to other eggs | **PARTLY** — all changes are additive, typecheck and build pass; the seven games have not been played |
| Side-by-side against the standalone | **NOT RUN** — differences below are derived from the source read, not from watching both |

## How to close this gap

Two options, both needing a decision:

1. **Manual pass.** `pnpm dev`, open Mission Control, click Uranus, work the
   checklist. Perhaps 30 minutes.
2. **Add Playwright** as a dev dependency (~150 MB with a browser) and automate
   the mechanical items — the ten open/close cycles, focus restoration, Escape,
   viewport sizes, console-error capture. That is a new dependency and was not
   approved, so it was not installed.

The ten-cycle test is the one I would least like to leave unverified, because
leak-on-reopen is exactly the failure this architecture is built to prevent and
exactly the one static analysis cannot confirm.

## Intentional differences from v1.7

| # | Difference | Why |
|---|---|---|
| 1 | Player hurtbox inset 2 px per side | Collision fairness. Reversible via `tuning.ts`. See [level-design-review.md](level-design-review.md). |
| 2 | Escape closes the experience outside a mission | It is a dialog in a page now; Escape must be able to dismiss it. Mid-mission it still pauses. |
| 3 | No **F** fullscreen | Fullscreen from inside an overlay fights the site's layering and the Escape contract. |
| 4 | No in-game mute button | The overlay already carries the site's mute control. **M** still works. |
| 5 | Music is rendered NES audio, not the runtime synthesiser | The point of the exercise. The synthesiser survives as the fallback when a file is unavailable. |
| 6 | SFX remain synthesised | ~40 short cues that already obey the channel vocabulary; rendering them would add weight for no gain. |
| 7 | Artwork loads in tiers, not all at once | 28.4 MB up front is not shippable. Same pixels, later. |
| 8 | Mission-select portraits stream in | Consequence of (7). The grid is usable immediately and fills in. |
| 9 | QA hooks and F6–F10 cheats removed | Debug scaffolding; F6 grants the whole campaign. |
| 10 | `Dongle_Baron_Sprites_v1.png` not fetched | Loaded and never drawn by v1.7. Porting the fetch would port a mistake. |
| 11 | Dead `menu` / `complete` scene states not ported | Referenced, never reachable. |
| 12 | Storage failures degrade instead of throwing | Private-mode browsers crashed v1.7's progress load. |

## Known risks

1. **Nothing has been played.** The largest risk by far. A port this size will
   have visual and feel bugs that only playing reveals.
2. **The music has not been heard.** Structure, tempo and loop integrity are
   measured; whether it sounds good is unknown. The renders measure brighter
   than the references — most likely thing to want adjusting.
3. **Mission-select art weight.** ~22 MB streams in behind the grid. It is
   deferred and cached, not blocking, but it is a lot of bytes for nine
   thumbnails. Fixing it properly needs new downscaled crops and art approval.
4. **Phaser 4 is young.** Released recently, thinner community coverage than
   Phaser 3. The API surface used here is small (scenes, loader, scale manager,
   sound manager, canvas texture), so exposure is limited.
5. **Keyboard layer changes tab order inside Mission Control.** Eight new
   focusable buttons, clipped to 1 px. Intended and additive, but it is a change
   to shared machinery that other eggs live in.
6. **Touch has not been tried on a device.** The pad is ported and sized as
   v1.7 had it; whether 50 px targets work for thumbs is untested.
