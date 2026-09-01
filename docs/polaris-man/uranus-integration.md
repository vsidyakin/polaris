# Uranus integration

## What Uranus was

`src/scripts/eggs/solar3d.ts` builds the three.js solar system inside Mission
Control. Uranus was already a full planet — textured, orbiting, with its five
moons — carrying a placeholder egg:

```js
egg: { route: "dev", game: "—" },
```

Its moons are Ariel, Umbriel, Titania, Oberon and Miranda: the campaign's own
moon list. The slot was waiting for this game.

## What changed

One field:

```js
egg: {
  route: "uranus",
  game: "POLARIS-MAN",
  kicker: "Uranus · the signal campaign",
  brief: "Eight moons, eight closed systems…",
},
```

That is the entire visual change to the planet. Same mesh, same texture, same
size, same orbit, same lighting, same hit radius. What it unlocks is the
existing machinery: a body with a real route becomes hoverable, its HUD card
reads "▸ GAME AVAILABLE" instead of "▸ IN DEVELOPMENT", clicking it flies the
camera in and raises the briefing panel, and **GO** calls
`hooks.onLaunch("uranus")`.

Downstream:

| File | Change |
|---|---|
| `eggs/runtime.ts` | `eggOpen8()` / `eggClose8()`; `"uranus"` case in `eggLaunch`; `egg9` in the Escape/mute handler and `EGG_GAME_CLOSERS`; a `visibilitychange` listener |
| `components/GameOverlays.astro` | `#egg9` modal with the standard close button, kicker, title, description and `#egg9-mount` |
| `styles/games.css` | `#egg9` added to the modal-shell selector; `.egg9-mount`; the `.ss3d-a11y` layer |
| `eggs/solar3d.ts` | the egg field above, plus the keyboard layer below |

The seven existing games are untouched. `#egg9` is additive throughout.

## Discoverability

Uranus is not labelled, badged or promoted. It looks exactly like it did. The
only signal that it is now live is the one every other launchable world already
gives: a hover card that says a game is there, once you point at it. The
briefing copy lives behind that hover, in the same panel Saturn uses.

## Activation

**Pointer.** Hover Uranus → HUD card → click → camera flight → briefing → **GO**.
Identical to Saturn and the other six.

**Keyboard.** This needed building. Planet picking is raycasting against a WebGL
canvas — mouse-only — so until now *no* world in the solar system could be
reached without a pointer.

`solar3d.ts` now emits a `.ss3d-a11y` group containing one real `<button>` per
launchable body, named `"URANUS — POLARIS-MAN"`. It is clipped to a 1 px box, so
it occupies no space and reveals nothing visually, but it is in the tab order and
in the accessibility tree. Activating it runs the same `beginFocus()` a click
would.

The clipping matters: `display:none` and `visibility:hidden` both remove an
element from the tab order, which would defeat the point. On `:focus-visible`
the button un-clips and appears as a small pill at the top of the modal, because
focus that lands somewhere invisible is worse than no focus at all.

Bodies still marked `route: "dev"` get no entry — there is nothing to activate,
and listing them would leak more than the visuals do.

This is a shared improvement: all eight launchable worlds gain keyboard access,
not just Uranus. Implementing it for Uranus alone would have been both stranger
and more code.

## Lifecycle

```
eggOpen8()
  remember document.activeElement
  show #egg9
  if already mounted or mounting -> return          <- idempotent
  dynamic import("../../games/polaris-man/index")
  if the modal closed while the chunk was in flight -> abort
  mountPolarisMan(#egg9-mount, { keyboardTarget: #egg9, onRequestClose })

eggClose8()
  hide #egg9
  handle.destroy()      -> listeners, audio graph, Phaser, DOM
  null the handle
  restore focus to the remembered element
```

`egg9Game` is the single source of truth for "is the game up". Because both
paths go through it, a second close is a no-op and a reopen cannot end up with
two Phaser instances, two audio graphs or two RAF loops.

**Lazy loading.** Phaser, the game, its CSS, its artwork and its music are all
behind the dynamic import. Verified against the production build: the
`polaris-man` chunk (1,455 KB raw / 384 KB gzip) is the only emitted JS
containing Phaser, and no other route references it.

**Escape.** Mid-mission it pauses; anywhere else it closes the experience. The
game binds its keys to the `#egg9` element rather than `window`, so the
listeners die with the modal — and the site's global handler skips `egg9` for
events originating inside it, so Escape and **M** are never handled twice.

**Focus.** Captured on open, restored on close. Because Uranus itself is a WebGL
mesh and cannot hold focus, what actually gets restored is whatever the player
activated from — the a11y button, or the briefing's **GO**.

**Focus is not trapped.** Tab moves through the game's own controls and then out
to the rest of the modal, as a non-modal dialog should.

**Tab visibility.** `visibilitychange` calls `handle.suspend()` / `resume()`:
music pauses, the audio context suspends, a live mission pauses, and Phaser's
loop sleeps. Returning does not un-mute anything the player muted.

## What was checked for regressions

The existing eggs share `eggLaunch`, the Escape/mute handler,
`EGG_GAME_CLOSERS`, `eggBackToMenu` and the modal CSS. Every change to those is
an added entry rather than a modified one. `astro check` passes with 0 errors
and the production build emits all 134 pages, which covers the mechanical side.

Behavioural regression testing of the other seven games needs a browser — see
[testing.md](testing.md) for exactly what that leaves unverified.
