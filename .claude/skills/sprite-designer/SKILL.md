---
name: sprite-designer
description: Use when drawing, editing or debugging an individual actor sprite in the Polaris easter-egg games — players, enemies, bosses, pickups, props, projectiles, HUD icons, explosions — i.e. anything compiled by mkSprite and drawn by drawSpr from EGG_ART in data.ts or EART6 in runtime.ts. Covers sprite anchors, frame counts, walk cycles, damage-flash and mirrored variants, and fixing E1/E5/A1-A5 findings from scripts/pixel-qa. For 8x8 or 16x16 background tiles use tile-designer; for choosing the colours use palette-manager.
---

# Sprite designer

Sprites in this repo are strings, not images. You draw by typing characters.

## 1. The format

```
name: [ [ "row", "row", ... ],   /* frame 0 */
        [ "row", "row", ... ] ]  /* frame 1 */
```

Every row string in a frame must be the same length; every frame in a sprite must be the
same size (`E1`/`E2` otherwise). One character is one pixel:

`.` transparent · `0`-`9` -> PAL 0..9 · `A`-`G` -> 10..16 · `H`-`Z` -> 17..35 ·
`a`-`e` -> 36..40 · `f`-`i` -> 41..44. That mapping is `PXC` at runtime.ts:2949.

```
0 #07050f void   1 #140e28 deep    2 #1f1840 hull   3 #3a2f6b mid    4 #6d5bb8 accent
5 #a58cff bright 6 #e2d9ff lav     7 #ffffff white  8 #2e7a4f grnDk  9 #7ce3a8 green
A #7fc6dd teal   B #1d5c7a tealDk  C #e8c76a amber  D #e8a184 orange E #c0402a red
F #8a8296 grey   G #000000 black
H #fff0c4 I #f2d78e J #d2a862 K #a87a4a L #6e4a38   (sandstone, lightest first)
M #b9f5cf N #4fae74 O #1c5138                        (plant)
P #b6b0c6 Q #6a6478 R #453f52 S #262233 G #000000    (grey stone)
T #a9e8f5 U #3f9dbc V #12455f W #08283a              (water)
X #241d47 Y #8a72d8                                  (cloth fill)
Z #f7ddb2 a #7d2318 b #c98a63 c #8c5a3c d #52449a e #e06a48
f #eafbff g #a8e4f7 h #4fb6e8 i #1d5f96              (ice / signal)
```

Compilers: `mkSprite(rows,scale)` (2950), `mkSpriteFlipped` (2963, mirrored, feeds `SPRF`),
`mkSpriteFlash` (2964, every opaque pixel -> `7` white, feeds `SPRW` for the damage flash),
`mkSpriteTheme` (2965, characters routed through `EGG_THEME.map`, feeds `SPRT`).
`anim(frames,fps).at(t)` picks a frame. `drawSpr(ctx,img,x,y)` rounds both coordinates.

## 2. Which store to edit

- `EGG_ART` in `src/scripts/eggs/data.ts` — 167 entries, the base store. Edit here to
  create a sprite or to change one that has no `EART6` override.
- `EART6` in `src/scripts/eggs/runtime.ts` (`const EART6={`, line 5019 at time of writing) —
  106 `e_*` entries for THE LOST DISPLAY. `eggPx6()` at runtime.ts:5299 recompiles
  `SPR`/`SPRF`/`SPRW` from it for every key present, overriding `EGG_ART` **by name and
  without changing any dimension**.

**Adding a key to `EART6` is the safe way to change a sprite's appearance without touching
its geometry.** The pattern already ships and it measurably worked: across the 82 names in
both stores, mean distinct colours went 4.90 -> 7.76 (+58%) and mean distinct luminance
steps 4.13 -> 5.93 (+43%), 66 sprites better, 15 unchanged, 1 worse. Reason it is safe: the
box is what collision, draw offsets and the `SPRITE INVENTORY` docblock (runtime.ts:2862)
depend on; the pixels are not.

If a name exists in both stores, the `EGG_ART` copy never reaches the screen. Edit the
`EART6` copy or your work is invisible. `suppress.py` calls this `shadowed_by_override`.

## 3. Anchors — get this wrong and the game moves

Nearly every sprite is placed **top-left** by `drawSpr` with `Math.round`, so growing a
frame downward or rightward moves the art, it does not extend it.

Centre-drawn exceptions, where frames of different sizes are legitimate and `E1`/`A1` are
suppressed in `annotations.json`:
- `inv_bolt`, `inv_dart` — runtime.ts:1997, `x-img.width/2, y-img.height/2`.
- `inv_missile` — runtime.ts:1988, `-img.width/2, -img.height/2` inside a `rotate()`.

Hard constraints:
- `player_idle` — body ~14x18 inside a **16x20** box, feet on the bottom row, faces RIGHT
  (`SPRF` is used when facing left). Changing the box or the feet row breaks collision.
  It is drawn by **both** Mars (runtime.ts:4092) and Venus (4729): any change ships in two
  games at once.
- `capsule` is composited — the engine draws a `pk_*` icon at `x+1,y+1` (runtime.ts:4069-70).
  Its dark interior is an aperture, not a defect; `P3`/`P4` are suppressed for it.
- Earth actors are 12x14 in a 16x16 room grid (`e_p_side` and friends), and some Earth draws
  are centred-and-bottom-anchored (`cx-img.width/2, cy-img.height` at runtime.ts:6545).
  Keep the size and the question does not arise.
- Every 8-bit sprite belongs to a 220x130 buffer scaled 4x (Mars, Venus) or a 240x176 buffer
  scaled 3x (Earth). A single pixel is a 3-4px block on screen. There is no sub-pixel detail
  to draw.

## 4. House drawing rules, as the art already does them

- **Outlines.** Venus actors (`walker`, `spitter`, `flyer`, `glob`) and the invaders
  (`inv_*`) are fully outlined in `G` #000000. Mars actors (`smasher`, `zapper`,
  `player_*`) are not: they use the darkest step of their own ramp as a rim. Earth actors
  in `EART6` are fully `G`-outlined. Match the game you are in. Reason: a black outline
  buys legibility against a busy backdrop and costs a colour and a hue; Mars's rust
  backdrop already separates cool actors, Venus's hot haze does not.
- **Lighting.** Light comes from the **upper left** in Mars and Venus (see the lit left
  edges and top rims in `drawParallaxMars` at 3121 and `drawParallaxVenus` at 4299) and
  from **directly above** in Earth (top row light, bottom row dark on every `e_*` tile).
  Put the highlight on the top and upper-left facing planes, the darkest step on the
  bottom and lower-right.
- **Value before colour.** `PAL` has 45 entries but ~18 distinct luminance values, 8 flat
  clusters and 3 near-duplicate pairs. Two colours from the same cluster read as one flat
  shape. Step the value, then pick the hue.
- **Bloom.** `CRT_BLOOM=.18` in `blitScaled` (runtime.ts:3017) plus the CSS scanlines
  spread bright pixels and swallow dark ones. A single white pixel reads as a glow; a
  one-pixel dark line inside a dark shape disappears.
- **The 3x5 font** (`drawText`, runtime.ts:3049, `textW` at 3060) is the only text in the
  buffered games. Never draw letters into a sprite.

## 5. Animation standards

- 2 frames for idle, breathing, hovering and machine cycles; 4 for a walk. That is the
  house convention and `qa_anim.py` is calibrated to it.
- **The bottom edge of the opaque bounding box must not move between frames** on any
  ground actor, or you get `A1` foot slide. Move the body, keep the feet.
- Horizontal centre of mass must not shift more than 1px (`A2` jitter), and no frame's
  opaque pixel count may be more than 40% off the sprite mean (`A3` crop error).
- No duplicate frames (`A4`, `A5`). A 4-frame walk with `f0==f2` is a 3-frame walk paying
  for 4 — the open defect on `e_p_down`/`e_p_side`/`e_p_up@EART6`. Fix by giving frame 2
  its own contact pose, not by dropping to 3 frames (the engine indexes `%4`).
- Every frame of a multi-frame sprite must contain opaque pixels (`W1`), and no sprite may
  be entirely transparent (`E5`).

## 6. Procedure

1. Read the current art: `python3 render.py --sprite <name> --all-frames --scale 4`, and
   print the strings before you touch them.
2. Confirm which store is live for that name (`parse.py` keys the override as
   `name@EART6`).
3. Sketch the value structure first — darkest, mid, lightest — using no more than four
   steps, then add hue.
4. Type the replacement rows, keeping the row length and row count identical.
5. For an appearance-only change to an `e_*` sprite, add or edit the `EART6` entry. For any
   other game, edit `EGG_ART` in place, same box.
6. Re-run the checks below, then look at the render, not the diff.

## Sprite checklist

Verifiable by running `scripts/pixel-qa`:

- [ ] `python3 qa_assets.py` exits 0 — no `E1` frame-size drift, `E2` ragged rows, `E3`
      illegal characters, `E4` out-of-range index, `E5` blank sprite, `W1` blank frame.
- [ ] `qa_assets.py` reports no `W3`/`W4`: the size and frame count still match the
      `SPRITE INVENTORY` docblock at runtime.ts:2862.
- [ ] `python3 qa_anim.py` shows no new `A1`, `A2`, `A3`, `A4` or `A5` for the sprite, and
      no more than the 9 baseline findings overall.
- [ ] `python3 qa_palette.py` shows the sprite clearing `P4`, and `P3` only if it is a
      genuinely dark or background-tagged asset.
- [ ] `python3 parse.py` shows the entry in the store you intended, and the name is not
      shadowed by an `EART6` override you forgot about.
- [ ] `python3 render.py --sprite <name> --all-frames --scale 4` reviewed on `PAL[0]`;
      the silhouette is readable at 1x and the feet do not move.
- [ ] Anchor unchanged: top-left for everything except the three centre-drawn `inv_*`.
