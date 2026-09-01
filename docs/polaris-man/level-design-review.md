# Level design and playability review

Assessed from the source and the ported simulation. Anything requiring an ear or
an eye on a running game is marked **needs play-testing** rather than asserted.

## Assessment

| Dimension | Finding |
|---|---|
| Objective clarity | Strong. The briefing states it, the opening toast repeats it, the HUD carries a live `MOON n/5` counter. |
| Time to control | ~1.6 s boot sting, then title. From **GO** to control is one frame after the mission art loads. Good. |
| Control responsiveness | Good. 0.11 s jump buffer and 0.09 s coyote window are both present and well-judged. |
| Accel / decel | Accel 560 to a top speed of 82 reaches full pace in ~0.15 s. Friction `pow(0.002, dt)` stops almost instantly — deliberate, arcade-tight. Umbriel's `pow(0.11, dt)` ice is a real, readable difference. |
| Jump feel | Variable height via jump-cut gravity, wall slide, wall jump, double jump after the first boss. A complete and well-tuned kit. |
| Collision fairness | **One issue, fixed.** See tuning changes below. |
| Hitbox accuracy | Player body 14×24 against a sprite drawn ~30 px wide. The body is the honest size; the sprite overhangs. |
| Enemy telegraphing | **Weakest area.** Enemies fire with no wind-up: the cooldown expires and a projectile exists. Bosses telegraph well (a `windup` state precedes every attack) but ordinary enemies do not. |
| Spawn visibility | Good. Enemies are placed at authored offsets, not spawned at the camera edge, so nothing appears on top of the player. |
| Spawn fairness | Good. `makeEnemy` seeks a ledge and falls back to the floor; the unit tests assert nothing spawns inside the floor or above the screen. |
| Enemy speed | 10–28 units against a player top speed of 82. Comfortably outrunnable. |
| Enemy density | 4 per sector, 20 per mission, simulated only within 360 units. Sensible. |
| Difficulty progression | Reasonable but **flat across moons** — mission 8 uses the same formation counts and spacing as mission 1. Difficulty comes from enemy stats and the weakness chain, not from layout. |
| Damage recovery | 1.0 s i-frames plus knockback. Standard and adequate. |
| Invulnerability timing | 2.5 s on spawn and checkpoint restore, 1.2 s on securing a relay. Generous in the right places. |
| Checkpoints | Five per mission, and death offers *Resume from checkpoint* with enemy and sector progress preserved. Low restart friction. |
| Score feedback | **Weak.** Score accrues (100/enemy, 500/relay, 3000/boss) and is never displayed during play — only `missionT` is recorded as a best time. |
| Health feedback | Good. 16 pips across the HUD, boss HP bar, per-enemy HP pips once damaged. |
| Victory clarity | Strong. Explosion, screen shake, card, then the capability reward screen. |
| Failure clarity | Strong. Distinct card naming the moon, three clear options. |
| Level duration | ~5,400 units at ~82 units/s ≈ 66 s of pure traversal, realistically 3–5 minutes with combat. Right for an easter egg. |
| Repetition | The five sectors share a platform-generation formula with per-sector height tables. Varied enough to read as designed, similar enough to feel like one place. |
| Dead time | Sector gates force a stop at each relay. That is the pacing beat, not dead time. |
| Cognitive load | High at the Nexus — eight shields, eight weapons, and a cycle-only weapon switch. Manageable because the pause screen is a weapon rack. |
| Keyboard accessibility | Full. Every action is bound, menus are real focusable buttons, arrow keys move grid focus. |
| Touch usability | Seven buttons on coarse pointers. **Needs play-testing** — 50 px targets are on the small side, and left/right sit 56 px apart. |
| Mobile viewport | The shell is `aspect-ratio: 16/9` with a `max-height` and the mission grid reflows to 2 columns under 760 px. **Needs play-testing.** |
| Audio feedback | Excellent. Distinct cues for jump, double jump, dash, each weapon, charge-ready, charged shot, hit, relay, boss appear, reward, fail. |
| Onboarding | A controls screen exists but nothing routes to it from the title. **Needs play-testing** to judge whether the toast copy carries it. |
| Replay value | Strong. Eight missions in any order, a weakness chain that rewards ordering, best times, and a Nexus that gates on full completion. |
| Frame-rate independence | Good. Everything is `dt`-scaled and friction uses `pow(base, dt)`, which the unit tests verify is step-size invariant. `dt` is clamped to 0.033 so sub-30fps runs slow rather than tunnelling through platforms — a deliberate stability choice, kept. |

## Tuning changes applied

Two gameplay values differ from v1.7.

### Checkpoint healing — one repair station per mission, not five

`RELAY.HEALING_INDEX = 2` in `tuning.ts`; applied in `sim.ts`.

**Evidence.** v1.7 restored the player to full health at **every** one of the
five checkpoints. Combined with the fact that securing a checkpoint is mandatory
to open the next sector, that meant damage never carried across a sector
boundary — the health bar reset on a fixed schedule regardless of how the sector
had gone, so it stopped being information. The review above flagged health
feedback as "good" on presentation and this is the counterpart: presentation was
never the problem, consequence was.

**Effect.** Only the middle station of the five repairs. All five still secure
progress, still grant invulnerability, still open the gate. The repair station
names itself on its plate and is tinted green, so it can be planned around
rather than discovered by dying.

**Reversible.** `HEALING_INDEX: -1` disables healing entirely; `0`–`4` moves it.

### Player hurtbox inset — 2 px per side

### Player hurtbox inset — 2 px per side

`PLAYER.HURTBOX_INSET_X/Y` in `tuning.ts`; applied in `sim.ts` via
`physics.hurtbox()` for enemy contact, enemy projectiles and boss contact.

**Evidence.** v1.7 tested damage against the full 14×24 body, which is also the
collision body used for platforms. Because the operator sprite is drawn wider
than its body, a projectile that visually cleared the shoulder still registered.
The body must stay 14×24 for level geometry to work, so the fix is a separate,
smaller hurtbox — which is what NES-era platformers almost universally did.

**Effect.** Damage tests against 10×20 instead of 14×24. Every collision that
was unambiguous still registers; the pixel-edge ones no longer do.

**Reversible.** Set both to `0` for v1.7 behaviour exactly. The unit tests cover
the inset maths including the clamp that stops it collapsing a small box.

Everything else — every speed, cooldown, damage value, HP total, ammo count,
i-frame duration, spawn position and boss profile — is the original number.

## Presentation changes applied

Not gameplay, but not invisible either.

| Change | Why |
|---|---|
| Opens **full screen**, F toggles an 85% window, choice remembered for the session | An egg you had to find should open like a cabinet, not like a dialog. The old 16:9 shell capped at `min(78vh, 720px)` inside a full-width panel, so the game sat small and centred in a large empty box. |
| The modal's description paragraph removed | The same copy is already on the Mission Control briefing card you press GO from. Above the game it ran one sentence to ~180 characters a line. |
| Flyer ground-marker bars removed | v1.7 drew a translucent accent bar under every flying enemy. On Titania the cyan accent is bright enough that it read as a rendering fault rather than a shadow. The sine bob already says "airborne". |
| Desdemona's node-linking lines removed | The points drift at different speeds, so the links between them swung wildly — a glitch, not a network. The nodes alone carry it. |
| Mission-select core tile is a bust | At 260×150 the full standing figure was mostly boot. Cropped from the top 42% of the same locked idle frame; nothing redrawn. |
| Briefing screen is a full-bleed poster | Was a 520×300 thumbnail beside a prose column, so the boss you were about to fight was ~40 px tall. Now the moon fills the frame with its boss at scale and the copy sits on the scrim, at a tighter measure and leading. |
| Mission Control briefing type reworked | The kicker and title were monospace and the body specified no family at all, so it fell back to the page sans — one card, two typefaces. Title thinned 700→600 (chunky counters at 22px), body given the sans explicitly, raised to `#ddd6f5`, capped at 62ch. Applies to every planet. |

## Bugs found in v1.7, fixed in the port

These are correctness fixes, not tuning:

| Issue | Fix |
|---|---|
| Global `keydown`/`keyup`/`blur` listeners were never removed. Fine for a standalone page; a leak in an overlay that opens and closes repeatedly. | All listeners registered through `ctx.bind()` and removed on `destroy()`. |
| `activeSolids()` rebuilt the solids array with `concat` on every call, and `move()` calls it twice per frame per body. | Rebuilt once per frame into `world.activeSolids`. |
| `const s = hostileShot(...)` assigned `undefined`, then the caller reached into `enemyShots[length-1]` to find the shot it had just made. | `hostileShot()` returns the shot. |
| Weapon list was read from `localStorage` and could be edited to grant capabilities. | Always derived from cleared missions. A unit test asserts a forged list is ignored. |
| `localStorage` access was unguarded — private mode threw. | Guarded; degrades to a fresh campaign. |
| Module-level `Audio` shadowed the global `Audio` constructor. | Renamed to `AudioManager`. |

## Recommendations — larger, deliberately not done

These change the design rather than fix it, so they are flagged rather than
applied.

1. **Enemy attack telegraphs.** The single biggest fairness improvement
   available. Ordinary enemies fire with no wind-up. A 0.15–0.2 s tell — a
   damage-flash-style tint, or a brief scale pulse, both possible with existing
   art — would make every hit feel earned. Bosses already do this.
2. **Show the score during play.** It is tracked and never shown. The HUD has
   room under the weapon panel.
3. **Difficulty curve across the campaign.** Missions are ordered but not
   escalating. Scaling formation density or sector length by campaign position
   would make the eighth moon feel like the eighth.
4. **Route the controls screen from the title.** It exists and nothing links to
   it; a first-time player never sees it.
5. **Larger touch targets.** 50 px buttons with a 56 px gap between left and
   right is tight for thumbs. Needs a device to judge properly.
6. **Downscaled tile portraits.** Would cut the mission-select art tier from
   ~22 MB to under 1 MB. Requires creating new image files from locked art, so
   it needs art approval.
