---
name: tile-designer
description: Use when drawing or editing background art for the Polaris easter-egg games — the 8x8 tile_* set used by the Stage 2 games, the 16x16 e_t_/e_d_/e_c_/e_w_ set used by THE LOST DISPLAY, the EGG_TILE code table, tile variants and animated tiles, props, or the parallax backdrop strips in drawParallaxMars/drawParallaxVenus. Covers grid alignment, seam and tiling rules, floor-versus-actor contrast, and W2/P3 findings from scripts/pixel-qa. For actors and pickups use sprite-designer; for choosing the colours use palette-manager.
---

# Tile designer

Tiles are the largest continuous area of pixels in every buffered game, so they set the
perceived quality of the whole screen — and they are the one thing that must **lose** to
the sprites drawn on top of them.

## 1. Two grids, both real

| Grid | Names | Table | Games |
|---|---|---|---|
| 8x8 | `tile_*` (25 of them) | `EGG_TILE` at runtime.ts:3062 | RELAY RUN (Mars), SIGNAL JUMPER (Venus) |
| 16x16 | `e_t_*` overworld, `e_d_*` dungeon, `e_c_*` cave, `e_w_*` water, `e_p_*` player | `TS=16` at runtime.ts:5326 | THE LOST DISPLAY (Earth) |

`EGG_TILE[code] = { art, solid?, oneway?, fps?, alt? }`. A map is an array of equal-length
strings, one character per tile, `.` = empty, `col*8 = x`. `drawTiles(ctx,map,camX,t)` at
runtime.ts:3087 draws only visible columns, animates any tile with more than one frame at
its own `fps`, and alternates the floor tile's `alt` variant on a fixed column hash — which
is why `tile_floor_a`/`tile_floor_b` and `tile_vfloor_a`/`tile_vfloor_b` must be
interchangeable at a glance but not identical.

Collision reads the table, not the art: `tileAt(map,x,y)`, `tileSolid(map,x,y)`,
`landAt(map,x,prevY,newY)`. `oneway:true` tiles (`g` grate, `-` `tile_vplat`) are
jump-through, so their top row is the collision surface and must read as a hard edge.

Buffer sizes: Mars and Venus are 220x130 at 4x — 27.5 x 16.25 tiles on screen. Earth is
240x176 at 3x with `PW=15, PH=10` rooms. A tile is 32 device pixels wide on Mars/Venus and
48 on Earth, so a tile's texture is seen large and its repetition is seen often.

## 2. The format is the same strings as sprites

`.` transparent, `0`-`9` -> PAL 0..9, `A`-`G` -> 10..16, `H`-`Z` -> 17..35, `a`-`e` ->
36..40, `f`-`i` -> 41..44 (`PXC`, runtime.ts:2949). Rows must be equal length; frames must
be equal size.

Stores, and the safe way to change one:
- `EGG_ART` in `src/scripts/eggs/data.ts` — all 25 `tile_*` plus the base `e_*` tiles.
- `EART6` in `src/scripts/eggs/runtime.ts` (`const EART6={`, line 5019 at time of writing) —
  the 16-bit override store. `eggPx6()` (runtime.ts:5299) recompiles `SPR` from it for every
  key present, overriding `EGG_ART` **by name and without changing any dimension**; it skips
  `SPRF`/`SPRW` for `e_[tcdw]_*` because tiles are never mirrored and never damage-flash.
  **Adding a tile to `EART6` is the safe way to change its appearance without touching its
  geometry.** Reason: the grid, the collision table and the map strings all key off the box.

Third surface: `EGG_THEME` at runtime.ts ~2938 recompiles ten `tile_*` names
(`tile_floor_a`, `tile_floor_b`, `tile_wall`, `tile_ceiling`, `tile_grate`, `tile_rib_top`,
`tile_rib_mid`, `tile_rib_base`, `tile_wall_panel`, `tile_debris`) through
`EGG_THEME.map` — a character-to-raw-hex table — into the `SPRT` store, and `drawTiles`
prefers `SPRT` while the Mars theme is active. So on Mars you can re-colour ten tiles by
editing seven hex values and drawing nothing. Use that before you redraw anything.

## 3. Rules for tiles specifically

- **The floor must lose.** A background tile's job is to be interesting and quiet at the
  same time. The worked example is the cave floor fixed on 12 Aug 2026: `e_c_floor`,
  `e_c_floor2`, `e_c_rubble` were three near-black purples at 1.12:1 under a sandstone wall
  and were redrawn in the same family in shadow — base `L` #6e4a38, worn clumps `c` #8c5a3c,
  crevices `S` #262233, lit stone `K` #a87a4a — reaching 2.40:1 on the base and 4.94:1 on
  the highlights, with a character density of 77/17/5/2 against the wall's 43/31/13/11.
  Copy that shape: same hue family as the wall, one value band darker, and a density
  histogram far more lopsided than the wall's.
- **Lighting.** Earth tiles are lit from **directly above**: light on the top row, the
  darkest step on the bottom row, every tile, which is what makes the 16x16 grid read as
  floor rather than wallpaper. Mars and Venus are lit from the **upper left** (see the lit
  left edges in `drawParallaxMars` 3121 and `drawParallaxVenus` 4299). Keep the whole tile
  set on one direction; a single mismatched tile reads as a hole.
- **Seams.** A tile is drawn beside copies of itself. Any feature that touches an edge must
  continue on the opposite edge or be deliberately a border. If the tile has a dark bottom
  row it will form a continuous horizontal line across the level — decide whether you want
  that line (Earth does) before you draw it.
- **Dither with care.** `tile_vfloor_a/b` currently checkerboard PAL 1/2/3, which at 4x plus
  3px scanlines reads as noise rather than texture. Prefer clumps of 2-4 pixels to
  alternating single pixels. Reason: the scanline pitch (3px) and the pixel pitch (4px) beat
  against each other, and single-pixel dither is exactly the frequency that shows it.
- **Animated tiles** (`fps` in `EGG_TILE`: `tile_conduit` 5, `tile_teleporter` 4,
  `tile_vsign` 2, `tile_cache` 2) animate everywhere they appear, in sync. Keep the motion
  small and non-directional or the whole level pulses.
- **Props are plain sprites** drawn before actors (`prop_crates` 16x16, `prop_bossdoor`
  16x24, `prop_display_on/off`, `prop_flag_on/off`), so they follow the sprite anchor rules,
  not the grid — but they must sit on the tile lighting direction.
- **Parallax strips** are `fillRect` code, not tiles: `drawParallaxMars` (3121) far x0.2 /
  mid x0.45 / near x0.7, `drawParallax` (3164) the hull default, `drawParallaxVenus` (4299)
  haze x0.06 / ridge x0.15 / skyline x0.35 / roofline x0.55 / rail x0.75. All are
  pixel-snapped with `Math.round` on the scroll offset — keep it, or the strips shimmer.
  They currently use **raw hex outside `PAL`**, which means the QA palette checks cannot see
  them; when you change them, check contrast by eye against the tile set they sit behind,
  or ask `palette-manager` to promote the hexes into `PAL`.

## 4. Procedure

1. Print the tile and its neighbours: `python3 render.py --sheet /tmp/tiles.png --filter tile_v --scale 4`
   (or `--filter e_c_`). Judge the family, never one tile alone.
2. Note the wall's character density, then design the floor to be more lopsided than it.
3. Fix the value structure first: base, one step darker for crevices, one step lighter for
   wear, and a top or upper-left lit edge.
4. Keep the box exactly 8x8 or exactly 16x16. `W2` fires on anything not 8x8 and escalates
   to an error if it is not a multiple of 8; a clean 16x16 is the second grid and is fine.
5. Update `EGG_TILE` only if you added a code, and keep `solid`/`oneway` honest — the art
   must show what the collision does.
6. Re-run the checks below and look at the contact sheet.

## Tile checklist

Verifiable by running `scripts/pixel-qa`:

- [ ] `python3 qa_assets.py` exits 0, and `W2` reports the tile as exactly 8x8 or exactly
      16x16 — never off-grid.
- [ ] `qa_assets.py` shows no `W3`/`W4` against the `SPRITE INVENTORY` docblock
      (runtime.ts:2862).
- [ ] `python3 qa_palette.py`: the tile clears `P4` (some colour in it reaches 3:1 on the
      void), and any remaining `P3` is on an `is_background` tagged floor/wall where dark is
      intended.
- [ ] `qa_palette.py` shows no new `P1` near-duplicate or `P2` flat-value cluster introduced
      by a `PAL` append.
- [ ] `python3 qa_anim.py` clean for animated tiles: no `A4`/`A5` duplicate frames, no `A3`
      crop error.
- [ ] `python3 parse.py` confirms the entry landed in the intended store, and for `e_*`
      names that the `EART6` copy is the live one.
- [ ] `render.py --sheet --filter <family> --scale 4` reviewed: the floor is visibly quieter
      than the wall, seams line up, and a `player_*` or `e_p_*` sprite laid over it still
      reads.
