# Source-to-Phaser feature parity

Every behaviour found in the full read of `Mersive_Polaris_Signal_Breaker_v1.7.html`
(350 lines, 128,454 bytes), and where it lives now. Nothing was dropped for being
unusual; the three intentional removals are marked and justified.

Legend: **=** identical · **+** improved, behaviour preserved · **~** changed, see note · **✗** removed

## Shell and presentation

| v1.7 | Phaser port | |
|---|---|---|
| `#shell` 16:9 frame, `aspect-ratio`, CRT scanlines, vignette | `.pm-root` in `polaris-man.css`, same values | = |
| `<canvas id="game" width=640 height=360>` with `setTransform(2,…)` | 640×360 `CanvasTexture`, same 2× transform (`context.ts`) | = |
| `image-rendering: pixelated` | same, plus Phaser `pixelArt: true`, `roundPixels` | = |
| CSS scales canvas to fit shell | `Phaser.Scale.FIT` + `CENTER_BOTH` | = |
| `#toast` status banner with accent colour | `.pm-toast`, driven by `ctx.toast()` | = |
| `#build` version stamp | `.pm-build` | = |
| `#mute` button top-right | Site's own `.egg-snd` chrome + **M** key | ~ [1] |
| `prefers-reduced-motion` disables scanlines/toast transition | same, plus particle-count reduction (as v1.7) | = |
| Fullscreen on **F** | ✗ [2] | ✗ |

[1] The overlay already carries the site's mute control; a second in-game button
    would be two mute buttons on one screen. **M** still works, and the audio
    manager owns the state either way.
[2] The game is a dialog inside a page, not a page. Fullscreen from inside an
    overlay fights the site's own layering and the Escape-to-close contract.
    Deliberate; recorded as an intentional difference.

## Scenes

| v1.7 `scene` | Phaser scene | |
|---|---|---|
| `boot` — 1.55 s Mersive logo sting | `BootScene` | = |
| `title` — attract screen, Enter/click to start | `TitleScene` | = |
| `select` — 3×3 mission grid, arrow-key focus, **N** = new campaign | `SelectScene` | = |
| `brief` — mission intelligence + portrait | `BriefScene` | = |
| `play` — the game | `PlayScene` | = |
| `pause` — capability rack | `PlayScene` frozen + DOM card | = |
| `victory` — boss explosion then card | `PlayScene` victory phase | = |
| `reward` — capability integrated | `RewardScene` | = |
| `failed` — checkpoint / restart / quit | `PlayScene` frozen + DOM card | = |
| `epilogue` — end crawl, Enter to return | `EpilogueScene` | = |
| `menu`, `complete` — referenced, never set | ✗ dead states, not ported | ✗ |
| Controls screen | `ControlsScene` | = |

## Player

| Behaviour | v1.7 | Port | |
|---|---|---|---|
| Body | 14×24 | same | = |
| Run accel / top speed | 560 / 82 | same | = |
| Friction | `pow(.002, dt)`; Umbriel `pow(.11, dt)` | same | = |
| Gravity / terminal | 430 / 260 | same | = |
| Variable jump height | +520 gravity when jump released while rising | same | = |
| Jump / double jump | −182 / −174 | same | = |
| Wall slide + wall jump | cap 72; `vx = −wall × 105` | same | = |
| Coyote time | 0.09 s | same | = |
| Jump buffer | 0.11 s | same | = |
| Dash | 0.18 s, 0.55 s cd, vx 205 | same | = |
| Charge shot | hold 2 s → 3× damage | same | = |
| i-frames | 2.5 spawn / 1.0 hit / 1.2 checkpoint | same | = |
| Knockback | vy −110, vx −face×65 | same | = |
| Fall damage | y > 192 → 2 dmg, respawn at checkpoint | same | = |
| Hurtbox | full 14×24 body | 2 px inset per side | ~ [3] |

[3] The one gameplay value changed on purpose. See
    [level-design-review.md](level-design-review.md); set both insets to 0 in
    `tuning.ts` to restore v1.7 exactly.

## Weapons

All nine ported with identical damage, cooldown, ammo, projectile counts,
spread angles, velocities, pierce and homing. `pulse` `browser` `canvas`
`crossnet` `evergreen` `airlink` `guestkey` `byomswitch` `fleetsync`.

| Behaviour | |
|---|---|
| Weakness chain — correct weapon deals ≥55 % of boss max HP | = |
| Evergreen Wave absorbs hostile fire (`shield` flag) | = |
| Crossnet/Fleetsync home on nearest enemy, else boss | = |
| Cycle with **Q**/**R**, blocked during Ariel pairing lock | = |
| Ammo per mission, pulse free and unlimited-ish (99) | = |

## Enemies and bosses

| Behaviour | |
|---|---|
| 24 enemy types, 3 per moon, stats verbatim | = |
| Ledge-seeking spawn placement, patrol range from platform width | = |
| Flyers bob on `sin(clock × 2.4 + seed)` | = |
| Simulation and fire ranges (360 / 175), cooldown `rate + 0.9 + rr(0,0.48)` | = |
| 12 hostile projectile kinds with per-kind spread, gravity, jitter, homing | = |
| 9 boss AI profiles: speed, accel, jump, and per-boss action sequences | = |
| Boss state machine: intro → think → run/jump/windup → attack → land | = |
| Three phases at 68 % and 34 % HP; faster, denser volleys per phase | = |
| Protocol Prime's eight capability shields | = |
| Boss trigger: past `width − 430` **and** every relay secured | = |
| Boss contact damage 2, arena bounds, bounce off walls | = |

## Mission mechanics

| Behaviour | |
|---|---|
| Five sectors, five relays, five mechanic strips per moon | = |
| `packet` boost pads, `thaw` heal, `rail` speed, `coolant` heat shield | = |
| Oberon vents fire on `sin(clock × 1.25 + phase) > 0.78`, 1 dmg unshielded | = |
| Cryo lock halves top speed for 1.35 s | = |
| Sector gates drop only when their relay is secured | = |
| **Ariel pairing lock** — full mechanic incl. immunity windows, mechanic-strip clearing, checkpoint clearing, boss-phase escalation, phase-3 token barrage, and all five bespoke checkpoint messages | = |

## Progression

| Behaviour | |
|---|---|
| `localStorage` key `psb_campaign_v2`, same shape — prototype saves still load | = |
| Weapons derived from cleared missions, never trusted from storage | = |
| Double jump unlocked on first boss kill | = |
| Best time per mission | = |
| Polaris Nexus unlocks only when all eight moons are cleared | = |
| **N** on mission select starts a fresh campaign | = |
| Storage failures degrade to a fresh campaign instead of throwing | + |

## Input

| Behaviour | |
|---|---|
| Move ←→/AD · jump Z/K/↑ · fire X/J · dash C/L · use E/↓/S · cycle Q/R · pause P | = |
| Gamepad: stick + buttons 0,1,2,3,4,5,9 | = |
| Seven-button touch pad on coarse pointers | = |
| Blur clears held keys and pauses a live mission | = |
| Escape | pause mid-mission, else close the egg | ~ [4] |

[4] v1.7 was a whole page, so Escape could only mean "pause". Inside the site
    it must also be able to close the dialog, which is a hard accessibility
    requirement. Mid-mission it pauses; anywhere else it closes.

## Rendering

Every draw routine ported: parallax panel mirroring, per-sector tints, the four
bespoke theme atmospheres plus four `lighter`-composite ones, sector plaques,
legacy-protocol plaques, per-moon platform/wall/ground styling with supports and
rivets, relay terminals, the four mechanic strips, the operator (idle/run/air/
dash/fire) from three sheets, enemy figures with damage flash and HP pips, boss
sprite with squash-stretch/lean/recoil per AI state, boss hit FX, the charged
pulse shot, all eight weapon projectile styles, all four hostile projectile
families with boss auras and orbit rings, particles, the HUD, and the epilogue
crawl.

## Removed

| Item | Why |
|---|---|
| `location.hostname === "127.0.0.1"` QA hooks (`__PSB_QA`, F6–F10 cheats) | Debug scaffolding. F6 grants the whole campaign; shipping it inside a live site would let anyone with a keyboard skip the game. |
| `ART.baron` (`Dongle_Baron_Sprites_v1.png`) | Loaded by v1.7 and never drawn — the Ariel boss uses its moon figure sheet. 1 MB of dead fetch. Listed in the asset inventory as unused. |
| Fullscreen (**F**) | See note [2]. |
