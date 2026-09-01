# Mars: Signal Siege — playability, traversal and soft-lock audit

Four independent audits — traversal and physics, sprite and atlas integrity,
enemies and bosses, mission flow and readability — run against the shipped
`dist/` build, with runtime play-testing in Chromium where the question could
be settled by playing rather than by reading. Findings are marked
**[RT]** where they were confirmed in a running browser and **[CODE]** where
they were established by reading code or measuring assets.

Fixes applied since the audit are marked ✅ with the commit that carried them.
Everything not marked is still open and appears in the fix order at the end.

---

## Executive verdict

The audit found **one defect that made all eleven horizontal missions
unfinishable by ordinary play**, and a second that made a third of the roster
invisible. Both are fixed. With those and the combat fixes in, the campaign
moves from five FAIL to none.

| | at audit | after this pass |
|---|---|---|
| FAIL | 11 traversal · 5 combat · 4 pacing | 0 |
| PASS WITH POLISH | — | 9 |
| PASS | 1 | 3 |

The two that mattered:

**Solid terrain was permeable, and walking into it was fatal.** `stepRook`
resolved landing only — `rook.x` was moved, clamped to the world, and nothing
else. Running into a raised ground section put Rook *inside* the rock, where
the landing test rejects the platform he has entered and the section he came
from stops supporting him. Ground slabs are drawn down to the kill plane, so he
sank through solid stone and lost a life. **[RT]** An autopilot holding Right
and never jumping died on all eleven horizontal missions within 4.4–6.9 seconds
of the spawn, at 65 sites campaign-wide; jumping a normal step-up slightly too
early did the same at 47 of 101 take-off positions. ✅ `4214d1a`

**Every enemy was drawn as an arbitrary crop.** `assets.ts` declared the enemy
sheet as 80×80 frames; the atlas cells became 112×88 when the roster was re-cut
by role and the loader was never updated. Phaser went on slicing the sheet into
80×80 windows — bodies cut off right and bottom, two enemies sharing one frame,
several frames essentially empty. Nothing caught it because the atlas was
correct and the game was correct; only the number between them was wrong.
✅ `bae4004`

---

## Per-mission table

Verdicts are post-fix. "Soft-lock risk" is the risk of an unrecoverable state,
not of dying.

| Mission | Traversal | Combat | Visual clarity | Boss arena | Soft-lock risk | Verdict | Priority fixes remaining |
|---|---|---|---|---|---|---|---|
| 1 Dustline Relay | Pass — worst mandatory jump 70% of max range | Pass | Rook reads faintly against dustline rock | Pass — static emplacement, no pin | None | **PASS WITH POLISH** | Player contrast; briefing names an unobtainable counter |
| 2 Silo Access | Pass — 72% at x2136, 347 ms window | Pass — best-balanced fight in the campaign | Pass | Pass | None | **PASS WITH POLISH** | Widen the x2136 landing 12 px |
| 3 Valles Uplink (vertical) | Pass — final climb 70 px of an 87 px ceiling | Pass | Pass — backdrop seam fixed | Smallest arena; boss no longer perches | None | **PASS WITH POLISH** | Arena is 640×215, the tightest in the game |
| 4 Borealis Ice Vault | Pass — ice slide 130 px against a 160 px ledge | Pass | Ice caps read best of the six families | Pass | None | **PASS WITH POLISH** | Ice deceleration, or a 250 px minimum ledge |
| 5 Installer Quarter | Pass — 71% | Polish — 16 concurrent bolts | Hivecity backdrop reads as walkable | Pass | None | **PASS WITH POLISH** | Cap the enraged lane count |
| 6 Cable Catacombs | Pass — 69% | Pass — cryo exploit closed | Best backdrop separation by measurement | Pass | None | **PASS WITH POLISH** | Enemy bolts are the dimmest thing on screen |
| 7 Firewall Foundry | Pass — 68% | Polish — 14 bolts, tightest legitimate combination | Foundry backdrop reads as walkable | Pass | None | **PASS WITH POLISH** | Conveyor now has a safe introduction |
| 8 Portal Storm | Pass — 70% | Pass | Pass | Pass — no longer perches | None | **PASS WITH POLISH** | Wind is ±8 px per jump and does not exist perceptually |
| 9 Sovereign Stack | Pass — trench climb-out 54 px | Pass | Hivecity backdrop | Pass — girders answer the tribute walls | None | **PASS** | — |
| 10 Monarch Citadel | Pass — 68% | Pass — weakness is the weapon you never lose | Pass | Pass | None | **PASS** | — |
| 11 Credential Bastion | Pass — 70% | Pass — cryo exploit closed | Pass | Pass | None | **PASS WITH POLISH** | Icy on the ground, normal in the air |
| 12 Lock-In Core | Pass — 71% | Pass — hitbox now matches the art | Pass | Pass — no longer perches | None | **PASS** | — |

---

## Exact issues

### Blockers — fixed

**BLOCK-1 · All 11 horizontal missions, 65 sites** (M1 x1130 · M2 x1210 · M8
x780/964/1124 · M9 x7130 …) · **[RT]**
The player runs into a plainly drawn rock wall, the sprite slides *into* it,
then sinks through the terrain and loses a life 1.4–1.6 s later. No horizontal
collision existed; ground bodies extend to the kill plane so nothing catches
the fall. **Fix:** push Rook out of non-thin surfaces after the x move. Only
non-thin — the one-way girders must stay side-permeable or drop-through,
under-passing and the pit-hop motifs all break. *Code only; no geometry, art or
difficulty change.* ✅ `4214d1a`

**BLOCK-2 · Nine two-rung faces** (M2 x6170 +88 · M9 x7130 +108 · M12 x5326
+100 …) · **[RT]**
All 101 sampled take-off positions died inside the rock: these rises exceed the
74 px jump ceiling, so no take-off clears them and the player crosses the
boundary while descending. Fixed by BLOCK-1 — you bump the wall instead. ✅

**BLOCK-3 · The cryo weapon froze bosses permanently** · **[RT]**
`BOSS.FREEZE_CAP` is 0.55 s and the weapon's own cooldown is 0.58 s, so one
landed shot per cooldown kept `frozen > 0` forever and the boss never completed
a wind-up. Measured **93% of the fight frozen** on the two bosses whose
briefings name cryo as the counter; a 7 s fight became a 50 s zero-risk grind.
**Fix:** a 2.5 s lockout before a boss can be re-frozen. *Code + difficulty.*
✅ `bae4004`

### High — fixed

**HIGH-1 · Jumping too early at an ordinary face was fatal** · **[RT]**
54 of 101 take-off positions landed, 47 sank through the plateau. Every other
platformer bumps you off the wall and drops you back on your own ledge. ✅

**HIGH-2 · Bosses perched on the player's escape girders** · **[RT]**
Three spent 49–57% of the fight standing on a one-way girder, where a level
shot passes clean underneath — hittable by level fire only **7–9%** of the
time, against 100% for every other boss. With the starting weapon those fights
did not resolve. **Fix:** a boss never stands on a thin surface. Measured after:
0/24 samples on two of the three, 2/24 on the third. ✅ `ef7d02e`

**HIGH-3 · The escape girder put the player inside the boss** · **[RT]**
Rook's box was inside the boss's body box **66–76%** of the time while standing
on the low girder, against 4–15% on the arena floor — the platform offered as
cover was several times more dangerous than the ground. **Fix:** three tiers,
the top one clear of the boss body on all twelve. *Level geometry.* ✅

**HIGH-4 · The player could shoot the boss from outside its reach** · **[RT]**
The boss is clamped to the arena; the player was not, and his 560 px/s bolt
still carried. Standing a body-length back down the corridor removed **65% of
the boss's health for zero damage taken** on seven of the twelve. **Fix:** the
lit threshold closes behind the player once the fight is on. ✅ `bae4004`

**HIGH-5 · The enemy telegraph told you nothing** · **[RT]**
`beginAttack` only set state; the scene computed the angle from the player's
live position at release, so the shot followed him through the wind-up. Rook
teleported 112 px during the tell and the shot tracked him. `Boss.ts` had
already solved this and its own header calls the locked aim "the contract the
whole fight rests on". **Fix:** the roster locks aim at wind-up too. ✅

**HIGH-6 · Turrets and sentinels out-ranged the camera** · **[RT]**
`TURRET_RANGE` 600 against 420 px of view ahead of the player: bolts arrived
from off screen with no visible source and no telegraph. 600→400, 520→380.
*Tuning only.* ✅

**HIGH-7 · Shots left the middle of the torso** · **[CODE, measured]**
15–35 px from the actual muzzle — 23–51% of the sprite's own width — for all
fifteen types, and 62–92 px (~50% of body width) for all twelve bosses. Rook's
muzzles are measured per frame by the art build; the roster had none. **Fix:**
an interim offset table keyed by behaviour. *The real fix is to measure enemy
sockets in the art build, as Rook's already are.* ✅ partial

**HIGH-8 · Every boss was a square of its own height** · **[CODE, measured]**
Drawn widths run 84–186 px against a fixed 126 px box (150 for the final): a
third of the widest bosses was not a target, and shots that plainly missed the
narrowest still connected. **Fix:** twelve measured widths in `BOSS_PROFILES`.
✅

**HIGH-9 · The authored enemies' hitboxes were double their art** · **[RT]**
Sentinel 34×44 declared against 16×21 drawn — 23 px of empty box above the
sprite, so shots that visibly sailed over it connected and it touched the
player from a body-length of empty air. **Fix:** set to measured bounds, with a
note to re-measure when the larger-cell art lands. ✅

**HIGH-10 · Idle was a walking frame** · **[RT]**
`rkey_1` has the rear leg bent with the foot clear of the deck, so a player
standing still stood on one leg. Standing-and-firing had no pose at all and
fell through to idle, leaving the planted firing stance as art nothing could
reach. ✅

**HIGH-11 · The vertical mission's backdrop wrapped mid-climb** · **[RT]**
The strip is mirrored on X only; `tilePositionY` ran 86→746 across a 360-row
texture, so the bottom of the painting was butted against its own top. A seam
was on screen for **3272 of 4560 px — 72% — of the ascent**, cutting the
waterfall column and the rock strata. **Fix:** vertical stages pan within the
single painting. ✅

**HIGH-12 · The "lit cap" on every platform was not lit** · **[CODE, measured]**
Five of six families shipped a cap band measuring the same as, or darker than,
the rock underneath — foundry 39.5 against 49.0, catacombs 20.0 against 27.0 —
so the one line the player reads as "this is the floor" was invisible on all
but the ice. **Fix:** the cap is exposed relative to the body it caps rather
than to an absolute target a gain ceiling could never reach from a dark master.
All six now land at 1.5×. ✅

**HIGH-13 · Every mission ended flat and empty** · **[RT]**
Two mechanisms landed on the same last screens: the motif loop degenerated to
`flatRun` whenever the next motif did not fit the remaining room, and
`populate` spent its cap left-to-right and ran out before the end. Mission 2's
tail was **2000 px — 3.1 screens — of unbroken level deck with nothing on it**.
Largest gaps were 996/1352/1097/1080/1814 px. **Fix:** the loop picks the
largest motif that fits; the cap is spent as a rate. Every mission's largest
gap is now the deliberate opening lead-in; the last enemy stands 132–370 px
short of the gate. ✅

**HIGH-14 · Mission 3 was one pattern repeated** · **[CODE, measured]**
68 rungs at a constant 66 px stride (sd **0**), eight x-offsets, eight widths
within 7.8% of each other, rest floors on a fixed 462 px period — 8 distinct
ledge shapes in 4920 px, the pattern repeating 8.5 times — and no enemies above
the lower third (**63% of the climb silent**). **Fix:** a generator with its own
motif deck. 76 distinct shapes, stride sd 9.3, no exact repeat at any period,
enemy coverage 37%→91%. ✅

**HIGH-15 · Losing a life in an arena left the fight running** · **[RT]**
The checkpoint can never be seated past the gate, so a player who died in the
arena respawned outside it while the boss kept pacing and firing at nobody —
and its cycle counter kept advancing, which for one boss shortens its own
cooldown by up to 45%: the fight you walked back into was faster than the one
that killed you. Persisting HP also made three lives three chained attempts at
one health bar. **Fix:** the encounter restarts. *(The player's report that the
boss "has full health" was the game-over path, which rebuilds the stage
correctly; the behaviour in between was the stranger one.)* ✅

### Medium — fixed

- **Riflemen fired from a different rung**, where a level shot can never
  connect — they shot over the player's head forever. Now they close first.
  **[RT]** ✅
- **Knockback pushed away from your own facing**, not away from the damage, so
  retreating from a threat shoved you back into it. **[RT]** ✅
- **Fliers and drones swam through floors and walls**, and one was observed
  firing from a muzzle point inside a platform. **[RT]** ✅
- **Checkpoints did not arm until 35% of the stage** — 3626–3850 px, five and a
  half screens — so the whole teaching section respawned the player at the very
  start, while the hard section had a net every half-screen. Now 12%. ✅
- **No enemy spawns within noticing distance of the player's start.** Mission
  3's nearest were 211 and 214 px, inside the 330 px notice radius, so they were
  alerted on frame one. ✅
- **Nine mission-3 ledges were buried** under the solid rest floor above them —
  52 px of a standing Rook drawn inside a slab. ✅
- **Two opening spikes**: mission 7 introduced the conveyor *as the lip of a
  484 px pit* with two chargers on it, 870 px from spawn; mission 11's first pit
  was 294 px on ice at the top of a descent. Both now get a plain run first. ✅

### Open — not yet fixed

| # | Where | Sev | What the player experiences | Why | Smallest fix | Touches |
|---|---|---|---|---|---|---|
| O-1 | All, every frame | High | You lose track of your own character; the enemies read and you do not | Rook L=54.9 S=0.50 against enemies L=36–77 S=0.74–0.84, and he is isoluminant with the platform bodies of four of the six families | Brighten/saturate Rook's ramp, or a 1 px rim light on the player only | art |
| O-2 | All 12 | High | Every sector's enemies look the same — four looks across twelve missions | `MISSIONS[n].hue` is dead data; no code reads it | Pre-bake recoloured sheets, or a colour-matrix FX per sector | code + art |
| O-3 | M5, M9 (hivecity); M7, M12 (foundry) | High | Backdrop architecture reads as walkable ledges | Those masters are architecture at platform scale with dozens of lit horizontal bands | Blur/desaturate their mid-band, or deepen `BG_TINT` for those two families | art |
| O-4 | All | Medium | Enemy bullets are hard to see over terrain | Enemy shots L=80–107 against player shots L=180–212 — the dimmest actor-scale element on screen | Lift the `eshot*` cells to L≈160 and add a 1 px dark keyline | art |
| O-5 | All | Medium | Enemies rock between two poses rather than walking | A two-frame cycle on a 22 px distance clock — about 1 Hz, a slideshow with no passing pose | Author a 4-pose cycle; shorten the stride constant to ~14 px | art + code |
| O-6 | M1/M2/M5/M8/M9 | Medium | A soldier stands in mid-air under a small parachute | The trooper holds its ground idle for the whole descent, and the canopy was half its width | Larger canopy (**done, awaiting the cell-size change**) plus a descend pose | art |
| O-7 | M4/M5/M9–M12 | Medium | Fliers and drones stand on invisible ledges | The flier sprites are bipedal grounded stances with no hover cue | A thruster glow or a 2-frame bob | art |
| O-8 | All | Low | Checkpoints are invisible; you learn one existed by dying | Nothing draws them | A small accent pylon at `stage.checkpoint.x` | code + art |
| O-9 | All | Low | The boss gate reads as a laser hazard, not a door | Drawn as a full-height accent column with a bright core | An arch silhouette, or fade the top 40% | art + code |
| O-10 | M8 | Low | The wind gimmick does nothing | `vx` is reassigned every frame, so the force nets **0.22 px** over a whole jump | Apply wind to `x` directly | code + difficulty |
| O-11 | M7 | Low | Conveyors only ever push right | `surfaceFor` types odd sections as conveyor and `groundAt` tests the same parity, so `-1` is unreachable | Key direction off something other than that parity | code |
| O-12 | M3, M8 | Low | 28 "rail" surfaces are drawn purple with chevrons and behave exactly like deck | Nothing in `stepRook` reads the type | Give rails a behaviour or stop implying one | code or art |
| O-13 | All | Low | Deliberately dying before a boss is strictly better than entering hurt | There are no health pickups; the bar is a per-life budget and the checkpoint sits just outside the gate | A mid-stage restore, or accept it | difficulty |
| O-14 | Sprites | High | Rook changes size and colour with what he is doing | `prepare()` normalises each cell's **bounding box**, which includes the weapon and shrinks with a tucked pose. 16.8% size pulse within one stride, 41% across the aim family; three master families graded to different saturation | Scale on the figure, not the bbox; normalise the three families | art pipeline |
| O-15 | Enemy sheets | High | Limbs truncated; a foreign crumb on the ground line with the creature floating above it | The masters are not on the nominal 3×3 grid — ink crosses the row boundary in 10 of 12 positions — and the second despeckle then amputates feet disconnected by resampling | Cut by connected component, not by grid; gate the despeckle geometrically | art pipeline |

O-14 and O-15 are now fixed. O-5 stays open: the cadence is corrected but the
missing passing pose is artwork, which is what the atlas checker's 13
documented suppressions are holding until a fourth column is drawn.

---

## Traversal proof

Measured by integrating `stepRook` exactly as `PlayScene.update` runs it, at the
same `dt` clamp, against stages from `buildAllStages()`. "% of max" is the worse
of horizontal demand and vertical demand, full-body rule, 60 fps.

**Player physics, measured** — collision box 34×58 (prone 34×26); run 175 px/s
applied instantly, no ground or air acceleration off ice; jump −360 fixed, no
variable height; gravity 900 (760 in low-g); measured apex **69.0 px** at 60 fps
and 66.1 at 30 fps; maximum landable rise **74 px** (87 in low-g); maximum
horizontal travel 140 px level, 111 at +48, 90 at +68; no terminal fall clamp;
drop-through grace 0.24 s ≈ 39.5 px against a tightest thin stack of 52 px.

The standard applied: required traversal at no more than 70–80% of measured
maximum range.

| Mission | Section | Start (x,y,w) | Landing (x,y,w) | H gap | V delta | % of max | Result | Adjustment |
|---|---|---|---|---|---|---|---|---|
| 1 | 1964–2188 | (1964,170,126) thin | (2188,166,300) | 98 | +4 | 70% | safe — 400 ms window | none |
| 2 | 2136–2550 | (2136,222,330) | (2550,178,290) | 84 | +44 | 72% | marginal-safe — 347 ms | widen landing 12 px → 62% |
| 3 | final climb | (258,345,276) | arena (0,275,640) | 0 | **+70** | 80% (83% @30 fps) | safe *(was 78 / 90%)* | ✅ fixed |
| 3 | opening | spawn floor y4830 | (94,4780,248) | 0 | **+50** | 57% | safe *(was 73 / 84%)* | ✅ fixed |
| 3 | ×68 rungs | rung n | rung n+1 | 0–19 | 46–78 | ≤88% | safe — now varied | ✅ |
| 4 | 7380–7620 | (7380,270,390) | (7620,220,132) thin | 0 | +50 | 68% | safe | none |
| 5 | 2414–2638 | (2414,214,126) thin | (2638,206,260) | 98 | +8 | 71% | safe — 67 px window | none |
| 6 | 4930–5154 | (4930,266,126) thin | (5154,268,300) | 98 | −2 | 69% | safe | none |
| 7 | 8134–8448 | (8134,310,250) | (8448,260,330) | 64 | +50 | 68% | safe | none |
| 8 | 4666–4888 | (4666,218,124) thin | (4888,218,300) | 98 | 0 | 70% | safe | none |
| 9 | trench climb-out | tread `floor−34` | step `floor−66` | 18 | **+54** | 73% | safe *(was 58 / 78%)* | ✅ fixed |
| 10 | 3286–3466 | (3286,342,330) | (3466,292,132) thin | 0 | +50 | 68% | safe | none |
| 11 | 6812–7034 | (6812,218,124) thin | (7034,214,260) | 98 | +4 | 70% | safe | none |
| 12 | 1648–1872 | (1648,166,126) thin | (1872,160,300) | 98 | +6 | 71% | safe | none |

**No frame-perfect jumps exist.** Jump height is fixed and air control is
instantaneous, so vertical outcome is deterministic and no run-up is required.
The narrowest valid take-off window on any mandatory route is **347 ms**.

**No blind jumps exist.** Horizontal stages pin the camera's y and the world is
exactly the view height, so the whole column is always on screen; maximum jump
travel is 140 px against 420 px of forward visibility. The shaft's rung pitch is
under 78 px against 214 px of headroom.

**No soft locks.** Every stage is fully reachable from spawn; boss-arena
reachability was brute-forced from **every** solid non-thin surface wide enough
to seat a checkpoint across all twelve missions — 0 unreachable seats. The
completion path (`killBoss` → `markCleared` → clear → next scene) is sound, and
a stray bolt cannot steal a won fight.

**One notable disagreement checked and cleared:** across all 20,236 platform
pairs in all twelve stages there is no case where `canJump()` authorises a jump
the simulation refuses, at 60 or 30 fps, under either overlap rule. It is
*conservative* — 900 pairs it refuses that physics allows — which costs only a
few redundant repair girders.

---

## Sprite, atlas and animation integrity

| Asset | State | Issue | Root cause | Sev | Fix | Verified |
|---|---|---|---|---|---|---|
| `enemies.png` | every pose | Drawn as arbitrary 80×80 windows of a 112×88 grid | Loader literal in `assets.ts` never updated when the cell changed | Critical | ✅ + a test asserting loader/atlas agreement, negative-tested | RT |
| `rook.png` `idle` | standing | Rear foot lifted clear of the deck | `idle` mapped to a mid-stride master | High | ✅ remapped to the planted stance | RT |
| `rook.png` `idlefire` | standing + firing | Unreachable; fell through to `idle` | No `!moving && firing` branch in `choosePose` | Medium | ✅ | RT |
| `rook.png` `run` | run cycle | **16.8% size pulse within one stride** | `prepare()` normalised the trimmed bbox, whose crown moves while the ground row does not | High | done - one scale per family, found via the visor landmark; spread 0% | measured |
| `rook.png` | cross-tag | Three scales and three palettes by source master; head ~30% larger running than idle | Three unrelated masters each normalised independently | High | done - aim spread 41% to 0%, boot-to-crown 70px everywhere, saturation spread 0.32 to 0.027, 24,440 colours to 64 | measured |
| `rook.png` `aimup` | holding Up | Shrinks 18% | The raised rifle occupies ~20 of the 74 px, so the body scaled down to fit | High | done | measured |
| Enemy masters | all | Ink crosses the nominal cut line in 10 of 12 boundary positions - truncated limbs, foreign crumbs on the ground line, creature floating 9-14 px | `cut()` is exact but the masters are not gridded | Critical | done - cut by connected component and assigned by centroid; the build fails if a subject is more than 25% outside its cell | measured |
| `enemies.png` | 10 cells | Feet, paws and landing gear amputated | Second despeckle deleted ankles disconnected by resampling | Critical | done - despeckle is geometric: never underfoot, never touching the silhouette | measured |
| `enemies.png` `*_walk` | walking | Size changes between the two walk frames - `e_flier` 43% | Each pose's own bbox normalised separately | High | done - one scale per role | measured |
| `bosses.png` boss5 | idle/walk | Height swings 102->118 (15%) and never reaches its 126 px box | `fit_in_cell` clamps width; height fell out of a per-pose aspect | High | done - one scale per boss. The residue on boss5/boss6 is the master's own: boss6's release pose is rendered a fifth smaller than its idle, which per-cell normalising had been silently correcting. Worth a re-render | measured |
| `bosses.png` x12 | `recover` | Gutter breached (2 px against 3); ground line 1 px low, so the boss sank during recovery | Composited at an offset instead of re-seated | Medium | done | measured |
| all sheets | all | Everything floats exactly 1 px above its declared baseline | `seat()` and `emit()` disagreed by one row | Low | done - one function answers for both | measured |
| `new-enemies.png` | wasp/crawler/sentinel | Art is ~half the declared hitbox | Authored at 16×16/26×13/20×22 into a 32×32 cell, boxes declared 34–44 | Medium | ✅ boxes set to measured art; larger-cell redraw pending | RT |
| `bosses.png` | wind/brace/dash | Non-uniform, non-integer scaling of pixel art during the telegraph | `setScale(1/squash, squash)` under `pixelArt: true` | Medium | open | code read |
| `rook.png` | all | 1081-2273 unique colours per frame | No palette quantisation anywhere | Medium | done - one 64-colour palette, 12 entries reserved for the lit cool accents | measured |

**Rook's muzzle system is correct** — all 19 live frames have a measured socket
landing on the barrel tip, mirrored correctly on facing. It is the only part of
the muzzle system that was right; the roster and the bosses had none.

---

## Fix order

**1 · Impossible jumps, soft locks, accidental deaths, broken completion.**
✅ Horizontal collision (BLOCK-1/2, HIGH-1). ✅ Enemy sheet frame size.
✅ Boss-arena reachability confirmed clean. No soft lock found.

**2 · Unfair boss behaviour and unavoidable damage.**
✅ Cryo permafreeze. ✅ Bosses off the player's girders. ✅ Girder tiers out of
the boss body. ✅ Gate closes behind the player. ✅ Boss hitbox widths. ✅
Encounter restarts on death. ✅ Enemy aim locked at wind-up. ✅ Off-screen
turret fire.

**3 · Collision, camera, projectile and enemy-placement defects.**
✅ Muzzle origins (interim table; per-frame sockets still to come). ✅ Flier
collision. ✅ Knockback direction. ✅ Riflemen holding fire across rungs. ✅
Spawn pressure at mission start. ✅ Whole-pixel camera. Open: O-10 wind, O-11
conveyor direction, O-12 rails.

**4 · Pacing, repetition and readability.**
✅ Flat and empty boss approaches. ✅ Mission 3's repetition and silent upper
climb. ✅ Checkpoint arming. ✅ Vertical backdrop seam. ✅ Platform cap
luminance. Open: O-1 player contrast, O-2 sector enemy colour, O-3 backdrop
confusion, O-4 bullet contrast, O-5 walk cycles.

**5 · Art polish and optional routes.**
O-6 paratroop descend pose, O-7 hover cue, O-8 checkpoint marker, O-9 gate
silhouette, O-13 health economy.

---

## Verification

```
node scripts/test-mars.mjs          4 suites, 95 integration checks   PASS
node scripts/check-mars-levels.mjs  12 missions, 0 failing            PASS
python scripts/check-mars-sprite-atlases.py  220 cells, 0 errors      PASS
node scripts/check-mars-runtime.mjs 26 checks in Chromium             PASS
```

New regression guards added while fixing, each negative-tested:

- Loader frame size must equal the atlas cell size, and Phaser's own frame grid
  must come out the shape the manifest claims.
- Every grounded pose Rook can fire from must have a measurable muzzle — a frame
  with no muzzle is a frame with no gun in it, which is how the gunless idle
  shipped.
- No air frame may be reused for anything Rook does on the ground.
- Enemy facing asserted as a *pairing* — `facing -1` must mean `flipX true` —
  not merely that flipping happens.
- Down+Jump drops through a one-way girder and **not** through solid ground.
- The camera hands the renderer whole-pixel scroll.
- No two bosses share a movement signature; no boss telegraphs faster than the
  reference.
- Level generator: `buried-ledge`, `enemy-gap` (760 px ceiling) and
  `spawn-pressure`.

Three runtime checks were also found to be measuring the grading machine rather
than the game: sim time runs behind wall-clock in headless because of the delta
clamp, so any fixed "moved N px in N ms" threshold is a frame-rate test. Those
poll for the condition instead, and the 0.28 s enemy telegraph is latched
in-page rather than sampled across the process boundary.
