---
name: palette-manager
description: Use when choosing or changing colours in the Polaris easter-egg games — building a ramp for a sprite or tile, judging or fixing contrast and readability, resolving P1 near-duplicate / P2 flat-value-cluster / P3 / P4 findings from scripts/pixel-qa, appending a new entry to PAL at index 45+, extending the PXC character mapping, or reconciling the raw hex used by EGG_THEME and the parallax functions with the indexed palette. Owns PAL; nothing enters it without this skill.
---

# Palette manager

You own `PAL` at `src/scripts/eggs/runtime.ts:2908` and the character mapping `PXC` at
runtime.ts:2949. No other role appends a colour.

## 1. What exists

45 entries. **0..16 are the frozen original 8-bit set** — every game except THE LOST
DISPLAY is drawn against them and they do not change, because that shared set is what makes
the abstract games (Jupiter blocks, Saturn Galaga, the ship invaders, Pluto maze) look like
one machine. **17..44 are the 16-bit extension**, currently used by egg6 only.

```
0 #07050f void   1 #140e28 deep    2 #1f1840 hull    3 #3a2f6b mid    4 #6d5bb8 accent
5 #a58cff bright 6 #e2d9ff lav     7 #ffffff white   8 #2e7a4f grnDk  9 #7ce3a8 green
A #7fc6dd teal   B #1d5c7a tealDk  C #e8c76a amber   D #e8a184 orange E #c0402a red
F #8a8296 grey   G #000000 black
```

The extension is organised as ramps, lightest first — this is the structure to keep using:

| Ramp | Chars | Hexes |
|---|---|---|
| sandstone / gold | `H I J K L` | #fff0c4 #f2d78e #d2a862 #a87a4a #6e4a38 |
| plant | `M 9 N 8 O` | #b9f5cf #7ce3a8 #4fae74 #2e7a4f #1c5138 |
| grey stone / metal | `P F Q R S G` | #b6b0c6 #8a8296 #6a6478 #453f52 #262233 #000000 |
| water / jelly | `T A U B V W` | #a9e8f5 #7fc6dd #3f9dbc #1d5c7a #12455f #08283a |
| purple / cloth | `6 5 Y 4 d 3 X 2 1 0` | house purple, lightest first |
| skin / clay | `Z D b c L` | #f7ddb2 #e8a184 #c98a63 #8c5a3c #6e4a38 |
| red | `D e E a` | #e8a184 #e06a48 #c0402a #7d2318 |
| ice / signal | `f g h i` | #eafbff #a8e4f7 #4fb6e8 #1d5f96 |

## 2. The actual problem with this palette

45 entries, **about 18 distinct luminance values**, 8 measured flat-value clusters (`P2`)
and 3 near-duplicate pairs (`P1`). **Value separation, not colour count, is the weakness.**
Two entries in the same cluster read as one flat shape at 4x under an 18% bloom and 3px
scanlines. So:

- Never answer a readability problem with a new hue. Answer it with a value step.
- When you build a ramp, check that consecutive steps are more than 0.03 apart in WCAG
  relative luminance — that is exactly the threshold `qa_palette.py` uses for `P2`.
- A sprite drawn over the void needs some colour clearing 3:1 against `PAL[0]` #07050f and
  `PAL[1]` #140e28 (`P4`). Floors and walls do not — they are tagged `is_background` — but
  they still need internal separation, or they read as a flat field.

## 3. Per-planet policy (CEO decision, 12 Aug 2026)

**Venus, Earth and Mars are surface games and each gets its own palette identity. Jupiter,
Saturn, the ship and Pluto are abstract and stay on the shared house palette.** Reason: the
surface games are the only ones where a world reads as a place, and the abstract ones earn
their coherence from the frozen set.

Earth's identity is already established and documented by `EART6` — do not reinvent it,
extend it. Mars's identity currently lives in `EGG_THEME` (runtime.ts ~2938) as raw hexes,
and Venus's lives in `drawParallaxVenus` (4299) as raw hexes; both bypass `PAL` and
therefore bypass the QA checks.

## 4. Appending a colour — the only supported route

1. Justify it. An append is only justified when no existing entry is within reach **and** the
   gap is a *value* gap or a genuinely absent hue. Two counter-examples that must not be
   appended: Mars's `#c98a5a` is within a hair of `b` #c98a63, and `#d9a05e` is within a hair
   of `J` #d2a862 — appending either would trip `P1` and add nothing.
2. Append to the end of the `PAL` array in `runtime.ts:2908`, keeping the trailing comment
   convention that names the ramp.
3. Extend the `PXC` order string at runtime.ts:2949 by the matching characters. The string is
   `0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghi`, so index 45 is `j`, 46 `k`, 47 `l`,
   48 `m`, and so on. Nothing else needs changing: `parse.py` and the engine both derive the
   mapping from that string.
4. Do not renumber, reorder or repurpose 0..44. `E4` catches out-of-range indices; nothing
   catches a silently changed meaning, and every one of 268 sprites would be wrong at once.
5. Re-run `qa_palette.py` and confirm you added no `P1` and no `P2`.

## 5. Ramps commissioned for Venus and Mars

Venus must read sulphurous, hot, hazy, high-pressure. Mars must read cold rust, dust and
thin air. Both are lit from the **upper left**.

**Venus.** New colours: **45 `j` #b9a03c** sulphur ochre mid — `PAL` steps straight from
`C` #e8c76a (rel. lum. ~0.62) to `K` #a87a4a (~0.25) with nothing between at a greened hue,
and Venus needs a mid-value crust that is warm without being orange, or the ground merges
with the sky band. **46 `k` #8f6a72** haze warm grey — a dense atmosphere pulls distant
structure toward the sky hue, and every neutral in `PAL` in that value band (`F` #8a8296,
`Q` #6a6478) is cool.

| Role | Chars, lightest first |
|---|---|
| Terrain / crust (`tile_vfloor_a/b`, `tile_vfill`) | `C` #e8c76a lit cap, `j` #b9a03c, `K` #a87a4a, `L` #6e4a38, `S` #262233 crevice |
| Structure / steel (`tile_vblock`, `tile_vgird`, `tile_vplat`, `tile_vsign`, `tile_vantenna`) | `P` #b6b0c6, `F` #8a8296, `Q` #6a6478, `R` #453f52, `S` #262233, plus `C` #e8c76a lit lamps |
| Sky and haze | eight raw bands stay in `drawParallaxVenus` (promoting eight near-neighbours would trip `P1`); haze deck moves to `k` #8f6a72 over `S` #262233 |
| Hostile actors | `G` #000000 outline, `Z` #f7ddb2, `C` #e8c76a, `D` #e8a184, `e` #e06a48, `E` #c0402a |
| Player's own things | `f g h i` and `A` #7fc6dd / `B` #1d5c7a / `9` #7ce3a8 — cool hues reserved to the player's side, because against a hot haze a cool hue is the only thing that cannot be lost |

**Mars.** New colours: **47 `l` #a35636** rust mid — the single most-used Mars surface
colour (`EGG_THEME.canyon` and theme characters `3` and `8`) with no `PAL` equivalent;
promoting it lets tiles, sprites and parallax share one rust. **48 `m` #6b6b3a** dust olive
— the only non-rust hue on Mars (scrub, lichen) and every green in `PAL` is a tropical mint.

| Role | Chars |
|---|---|
| Sky, zenith to rim | `1` #140e28, `X` #241d47, `a` #7d2318, `l` #a35636, `J` #d2a862; sun `Z` #f7ddb2 core with `I` #f2d78e halo |
| Far buttes | `X` #241d47 body, `R` #453f52 skirt, `L` #6e4a38 lit cap rim |
| Canyon / mid terrain | `b` #c98a63 lit face, `l` #a35636 mid, `c` #8c5a3c shadow face, `L` #6e4a38 deep, `X` #241d47 cast shadow |
| Deck tiles, replacing the raw `EGG_THEME.map` | `"1"`->`X`, `"2"`->`L`, `"3"`->`l`, `"4"`->`b`, `"5"`->`J`, `"9"`->`C`, `"8"`->`c` |
| Scrub / lichen | `m` #6b6b3a, `O` #1c5138 in shadow |
| Actors | unchanged frozen house set — `C`, `D`, `4`, `3`, `9`, `2`, `1` |

Two standing reasons worth keeping: Mars shadows are **cool violet** (`X`, `S`, `1`) because
a thin atmosphere gives almost no warm bounce, which is also what makes the rust look cold;
and Mars actors stay on the cool house purple/green precisely because the world is rust —
hue contrast does the separating that a flat-value palette cannot. Venus is the inverse: the
world is hot, so hostile things are hot and only the player's kit is cool.

Mars and Venus currently both use a purple-magenta dusk with an orange band and are easy to
confuse. Pulling Mars's zenith cool and Venus's lower bands yellow is the cheapest available
separation.

## 6. Where colour lives outside `PAL` (and what to do about it)

- `EGG_THEME.map` and `EGG_THEME.sky/butte/canyon/scrub/rock/sand` — 13 raw hexes, Mars.
- `drawParallaxVenus` — about 20 raw hexes, Venus.
- `eggDonglePatrol`'s `mkS()` palettes `PF`, `PD`, `PW`, `PB`, `PBH` (runtime.ts:369-395) —
  Saturn's actors, entirely outside both art stores and outside QA.
- `egg2` `PIECES[].c` and its rgba highlights; `egg3`/`egg4` `fillRect` colours.

None of these is checked by `qa_palette.py`. When you touch them, either promote the value
into `PAL` (if a sprite needs to match it) or accept it as background-only and say so in the
commit. Reason: promoting every backdrop hex would fill `PAL` with near-duplicates and make
`P1` useless, which is worse than an unchecked backdrop.

## Palette checklist

Verifiable by running `scripts/pixel-qa`:

- [ ] `python3 qa_palette.py` reports **no new `P1`** (CIE76 deltaE < 6 pair) after any
      append.
- [ ] `qa_palette.py` reports **no new `P2`** flat-value cluster; consecutive steps in any
      ramp you built differ by more than 0.03 relative luminance.
- [ ] Every sprite you re-ramped clears `P4`; remaining `P3` only on `is_background`
      floors/walls or on documented exceptions such as `capsule`.
- [ ] `python3 qa_assets.py` exits 0 with no `E3` illegal character and no `E4` index past
      the end of `PAL` — proof that `PAL` and `PXC` were extended together.
- [ ] `python3 parse.py` reports the new `PAL` length (45 + your appends).
- [ ] Readability findings stay at or below the 8-finding baseline; animation findings at or
      below 9.
- [ ] `python3 render.py --sheet /tmp/pal.png --scale 4` reviewed on `PAL[0]`: the new ramp
      reads as steps, not as one shape.
