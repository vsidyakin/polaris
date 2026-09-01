# Asset inventory

## Artwork — unchanged, and proven so

Every PNG in `Easter egg/Games to add/game_art/` was hashed **before** any work
began (`scripts`-free baseline, stored as `art-baseline.csv`) and re-hashed
after everything was finished.

```
Source PNGs checked      : 36
Originals altered        : 0
Originals missing        : 0
Repo copies present      : 28
Repo copies not matching : 0
```

The 28 files the game uses were copied into `public/eggs/polaris-man/art/` with
their bytes intact. Nothing was cropped, rescaled, re-encoded, recoloured or
regenerated. All framing is done at draw time by the sub-rect tables in
`src/games/polaris-man/data.ts`, which read regions out of the originals.

The 8 files marked `no` are pre-production source sheets that v1.7 never loads;
they stay in the source folder and are not shipped.

`production/Dongle_Baron_Sprites_v1.png` is a special case: v1.7 *loads* it into
`ART.baron` and never draws it — the Ariel boss is drawn from
`Level_Ariel_Figures_v1.png` like every other boss. It is listed here for
completeness and deliberately not fetched, because porting a 1 MB dead request
would be porting a mistake rather than a behaviour.

### Full inventory

| File | Px | Colour | Bytes | SHA-256 (first 16) | In repo |
|---|---|---|---|---|---|
| `backgrounds/Ariel_Boss_Arena_v1.png` | 640x360 | RGB8 | 382,795 | `0CCD68B231B3F630` | yes |
| `backgrounds/Ariel_Environment_Sheet_Source_v1.png` | 1672x941 | RGB8 | 2,162,251 | `70F85ECFD3D6EA3A` | no |
| `backgrounds/Ariel_Level_Panel_v1.png` | 640x360 | RGB8 | 349,856 | `3F57FCFD99245D0A` | yes |
| `backgrounds/Cressida_Level_Panel_v1.png` | 1672x941 | RGB8 | 2,237,165 | `1E41F14C1CBFBBB4` | yes |
| `backgrounds/Desdemona_Level_Panel_v1.png` | 1774x887 | RGB8 | 2,559,509 | `A05D4A84C355D206` | yes |
| `backgrounds/Final_Boss_Arena_Source_v1.png` | 1672x941 | RGB8 | 2,292,840 | `CA0FCE2FA1577006` | no |
| `backgrounds/Final_Boss_Arena_v1.png` | 640x360 | RGB8 | 444,760 | `82F9B249D198F983` | yes |
| `backgrounds/Miranda_Level_Panel_v1.png` | 1774x887 | RGB8 | 2,316,647 | `E6B61FAB1A45E073` | yes |
| `backgrounds/Oberon_Boss_Arena_v1.png` | 640x360 | RGB8 | 353,791 | `280FA9750BB61476` | yes |
| `backgrounds/Oberon_Environment_Sheet_Source_v1.png` | 1672x941 | RGB8 | 1,754,946 | `B5C8BFC1C907E39B` | no |
| `backgrounds/Oberon_Level_Panel_v1.png` | 640x360 | RGB8 | 329,018 | `31F3C66451C8D78E` | yes |
| `backgrounds/Polaris_Man_Title_Background_v1.png` | 1672x941 | RGB8 | 1,800,797 | `230FC6F480D8BB37` | no |
| `backgrounds/Polaris_Man_Title_Background_v2.png` | 1672x941 | RGB8 | 1,905,437 | `D7A689728C26178B` | yes |
| `backgrounds/Puck_Level_Panel_v1.png` | 1672x941 | RGB8 | 2,310,584 | `7754847FFE32B41D` | yes |
| `backgrounds/Titania_Boss_Arena_v1.png` | 640x360 | RGB8 | 366,124 | `D94BF8B7D801C12F` | yes |
| `backgrounds/Titania_Environment_Sheet_Source_v1.png` | 1672x941 | RGB8 | 1,768,091 | `036EF222ECF21817` | no |
| `backgrounds/Titania_Level_Panel_v1.png` | 640x360 | RGB8 | 374,187 | `C03B8C86FFB814BE` | yes |
| `backgrounds/Umbriel_Boss_Arena_v1.png` | 640x360 | RGB8 | 479,029 | `0E501885591B6DCF` | yes |
| `backgrounds/Umbriel_Environment_Sheet_Source_v1.png` | 1672x941 | RGB8 | 2,042,842 | `2B3BA5B5003C7D0A` | no |
| `backgrounds/Umbriel_Level_Panel_v1.png` | 640x360 | RGB8 | 452,181 | `221E30213660ECFA` | yes |
| `production/Dongle_Baron_Sprites_v1.png` | 2172x724 | RGBA8 | 1,084,787 | `294A99D199624549` | yes |
| `production/Level_Ariel_Figures_v1.png` | 1897x829 | RGBA8 | 790,336 | `AA007FD6F15CAAAD` | yes |
| `production/Level_Cressida_Figures_v1.png` | 1774x887 | RGBA8 | 1,486,774 | `56BACF27EAFF34DF` | yes |
| `production/Level_Desdemona_Figures_v1.png` | 1774x887 | RGBA8 | 1,445,517 | `74BD1867AF0B993B` | yes |
| `production/Level_Miranda_Figures_v1.png` | 1881x836 | RGBA8 | 1,546,229 | `A006C2220FA4E604` | yes |
| `production/Level_Oberon_Figures_v1.png` | 1823x863 | RGBA8 | 1,184,782 | `980216B4F955A90E` | yes |
| `production/Level_Puck_Figures_v1.png` | 1774x887 | RGBA8 | 1,414,143 | `997B055897C45D88` | yes |
| `production/Level_Titania_Figures_v1.png` | 1871x840 | RGBA8 | 1,122,493 | `64BA1758A439FBAF` | yes |
| `production/Level_Umbriel_Figures_v1.png` | 1899x828 | RGBA8 | 1,180,010 | `2924207DA76768FD` | yes |
| `production/Polaris_Operator_Air_v1.png` | 2172x724 | RGBA8 | 370,267 | `447E2FA92DE0BFC4` | yes |
| `production/Polaris_Operator_Run_v1.png` | 2172x724 | RGBA8 | 563,614 | `866A850BC9A4DDD6` | yes |
| `production/Polaris_Operator_Sprites_v1.png` | 2092x752 | RGBA8 | 501,665 | `AF056FC586279D94` | yes |
| `production/Protocol_Prime_Boss_Source_v1.png` | 1536x1024 | RGB8 | 1,860,202 | `DF8249758FB70A8B` | no |
| `production/Protocol_Prime_Boss_v1.png` | 1536x1024 | RGBA8 | 1,189,171 | `9EB342B07AFC66F7` | yes |
| `production/Workspace_Checkpoint_Source_v1.png` | 1536x1024 | RGB8 | 1,640,206 | `8EB8D3FE26383295` | no |
| `production/Workspace_Checkpoint_v1.png` | 1536x1024 | RGBA8 | 1,082,172 | `D50B6559EB206732` | yes |

## Load tiers

The full set is 28.4 MB. Loading it up front to open an easter egg would be
indefensible, so the loader is split three ways.

| Tier | When | Contents | Weight |
|---|---|---|---|
| Boot | on activation, blocking | title backdrop + operator sheet | ~2.4 MB |
| Select | after the grid is on screen, streaming | 8 level panels + 8 figure sheets + Nexus pair | ~22 MB |
| Mission | on launch, blocking | operator run/air/checkpoint + that moon's panel, figures and arena | 1.1–3.5 MB |

The select tier is the interesting one. Each tile portrait wants its moon's
panel and boss figure, and there is no smaller copy of the locked art to reach
for — so the grid renders immediately from colour and type alone, and each tile
repaints as its own art lands. `SelectScene.streamTileArt()` repaints a single
canvas rather than re-rendering the grid, because the grid holds DOM focus and
rebuilding it would throw a keyboard user back to the top every time a 1.5 MB
PNG finished.

**Recommendation (not done, needs art approval):** downscaled 260×150 portrait
crops would cut the select tier from ~22 MB to well under 1 MB. That means
creating new image files from the locked artwork, which is outside what was
authorised here.

## Audio

15 OGG in `public/eggs/polaris-man/audio/`, 9.45 MB total, loaded per screen:

- opening the egg fetches title + mission select: **1.48 MB**
- launching a moon adds its mission theme + boss theme: **~1.46 MB**

15 archival WAVs (44.1 kHz, 16-bit, mono, 67.9 MB) live in
`Game audio files/Polaris Man/nes/wav/` and are **not** shipped to the web.

## Source files, untouched

| File | Status |
|---|---|
| `Mersive_Polaris_Signal_Breaker_v1.7.html` | unchanged, SHA-256 `27676BF7291751A9…` |
| `game_art/**` (36 PNG) | unchanged, 0 of 36 altered |
| `Rejected modern-instrument versions/*.wav` (15) | unchanged, 175,760,070 bytes |
| `Polaris Man/*.wav` (second pass, 15) | untouched, unused |