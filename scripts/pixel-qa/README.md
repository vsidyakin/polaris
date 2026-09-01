# pixel-qa

Deterministic validation tooling for the palette-indexed pixel-art system in
`src/scripts/eggs/`.

The sprites are not image files. They are three stores of "string art" in the
TypeScript sources:

| store | file | shape |
|---|---|---|
| `EGG_ART` | `src/scripts/eggs/data.ts` | one very long single-line JSON object, 162 sprites |
| `EART5` | `src/scripts/eggs/runtime.ts` | multi-line JS object literal, 29 sprites — SIGNAL JUMPER's (Venus) override store |
| `EART6` | `src/scripts/eggs/runtime.ts` | multi-line JS object literal, 106 sprites — THE LOST DISPLAY's (Earth) 16-bit "pass D" override store |

Where a name exists in more than one store the override is kept under
`<name>@EART5` / `<name>@EART6`, so a sprite that has been overridden is reported
twice — once for the version the other games still draw, once for the override.
That is deliberate, and it means overriding a sprite without fixing its findings
shows up as an increase.

Format in both: `name: [ frame, frame, ... ]`, each frame an array of
equal-length strings, one string per pixel row, one character per pixel.
`.` is transparent; `0`-`9` -> `PAL[0..9]`, `A`-`G` -> `PAL[10..16]`,
`H`-`Z` -> `PAL[17..35]`, `a`-`n` -> `PAL[36..49]`.
That mapping is `PXC` in the engine, and `parse.py` reads it out of the source
rather than restating it. `PAL` is the 50-entry hex array in `runtime.ts`
(0..16 frozen 8-bit, 17..44 the 16-bit extension, 45..46 Venus, 47..49 Mars).

Nothing here writes to, imports from, or otherwise touches the game — the
scripts read the TypeScript as text.

## Requirements

- Python 3.8+
- Pillow, for `render.py` only. The three checkers are dependency-free.

```bash
pip install pillow --break-system-packages
```

## Running

All four scripts default to the repo root two directories above themselves, so
running them from inside this folder needs no arguments. Every script accepts an
optional repo root as its first positional argument, `--json=PATH` to dump
machine-readable findings, and `--quiet` to suppress the console report.

```bash
cd scripts/pixel-qa

# what parsed, and how much of it
python3 parse.py

# structural checks -- exits 1 if any hard error is found
python3 qa_assets.py
python3 qa_assets.py --json=/tmp/assets.json

# animation checks -- always exits 0
python3 qa_anim.py

# palette, value separation and readability -- always exits 0
python3 qa_palette.py
```

### What each checker looks for

`qa_assets.py` — hard errors (`E*`, exit 1) and warnings (`W*`, exit 0):

| code | check |
|---|---|
| E1 | frames within one sprite differ in width or height (breaks animation) |
| E2 | rows within one frame of unequal length (malformed sprite) |
| E3 | characters outside the legal PXC set |
| E4 | palette index referenced past the end of `PAL` |
| E5 | every frame of a sprite entirely transparent |
| W1 | one but not every frame entirely transparent |
| W2 | a tile (`tile_*`, `e_[tcdw]_*`) that is not exactly 8x8. Tagged `multiple_of_8` — a clean 16x16 is a second, larger grid; anything off-grid is escalated to an error |
| W3/W4 | size or frame count disagrees with the engine's own `SPRITE INVENTORY` docblock in `runtime.ts`, which the script parses |

`qa_anim.py` — every multi-frame sprite:

| code | check |
|---|---|
| A1 | foot slide: the opaque bounding box's bottom edge moves between frames |
| A2 | jitter: horizontal centre of mass shifts more than 1.0 px |
| A3 | crop error: a frame's opaque pixel count is more than 40% off the sprite mean |
| A4 | wasted frame: even frame count and frame 0 == frame 1 |
| A5 | duplicate frame anywhere in the cycle (A4 generalised) |

`qa_palette.py`:

| code | check |
|---|---|
| P1 | two `PAL` entries within a CIE76 deltaE of 6 — colour noise |
| P2 | 3+ `PAL` entries within 0.03 WCAG relative luminance — a flat value cluster |
| P3 | a sprite's most-used opaque colour under 3:1 WCAG contrast against `PAL[0]` **and** `PAL[1]`, the two void colours. Tagged `is_background` for tiles and props, which are drawn on the ground rather than over the void |
| P4 | no colour anywhere in the sprite clears 3:1 against the void. P3 alone over-reports outlined sprites (a black outline is meant to be black); P4 is the version that cannot be argued with |

It also prints distinct-colour counts per sprite, a per-game colour census, and
a direct EART6-vs-EGG_ART table for every sprite name present in both stores
(distinct colours, luminance spread, and distinct luminance steps at 0.03
resolution) — the numbers that say whether the 16-bit pass improved anything.

### Rendering

`render.py` renders nearest-neighbour at integer scales only, and draws contact
sheets on `PAL[0]` (the game's void colour) so a low-contrast sprite looks as
bad on the sheet as it does in the game.

```bash
# one sprite, frame 0, at 1x and 4x, into ./out
python3 render.py --sprite player_idle

# every frame of a sprite
python3 render.py --sprite e_p_side --all-frames --scale 4

# contact sheet of everything, grouped by name prefix, at 4x
python3 render.py --sheet /path/to/sprite-contact-sheet.png --scale 4

# just one family
python3 render.py --sheet /tmp/players.png --filter e_p_
```

Sheet options: `--sheet-width` (default 1800), `--max-px` (default 4000 — a
sheet taller than this is split into `NAME-1.png`, `NAME-2.png`, ... on group
boundaries), `--scale` (default 4), `--repo`, `--out`.

In sheet labels a trailing `*` marks an `EART6` override of a sprite name that
also exists in `EGG_ART`. In the parsed data those entries are keyed
`name@EART6` so both versions survive and can be compared.
