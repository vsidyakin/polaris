# Architecture

## Modules

```
src/games/polaris-man/
  index.ts          mount / destroy. The only export the site touches.
  context.ts        shared runtime on the Phaser registry; input tracking
  scenes.ts         the ten scenes
  sim.ts            the simulation — no Phaser, no DOM, no canvas
  render.ts         every draw call, into a 640x360 canvas texture
  ui.ts             DOM shell and overlay screens
  state.ts          World/Player/Enemy/Boss types and level construction
  physics.ts        AABB collision + movement primitives (pure)
  progress.ts       localStorage campaign state (pure apart from 2 calls)
  audio.ts          AudioManager: music bus, SFX bus, mute, teardown
  chiptune.ts       the in-code sequencer, kept as the music fallback
  data.ts           missions, enemies, weapons, artwork sub-rects
  tuning.ts         every gameplay number, in one place
  assets.ts         asset manifest and load tiers
  polaris-man.css   overlay styling, scoped under .pm-root
```

The dependency direction is one-way: `scenes` → `sim`/`render`/`ui` → `state` →
`physics`/`data`/`tuning`. Nothing below `scenes` imports Phaser except
`audio.ts`, which needs the sound manager's `AudioContext`.

## Scenes

`Preload → Boot → Title → Select → Brief → Play → Reward → Epilogue`, plus
`Controls`. Pause, victory and game-over are DOM cards over a frozen `PlayScene`
rather than separate scenes — that is exactly what v1.7 did by not calling
`update()`, and it keeps the frozen world visible behind the card, which a scene
swap would not.

`PlayScene` has three phases: `run` (simulating), `victory` (boss death
animation), `frozen` (a card is up). Transitions go through `freeze()` /
`resumeRun()` so the touch pad and input state can never be left half-enabled.

## Three decisions worth defending

### Physics is not Arcade Physics

`physics.ts` implements the resolver v1.7 used: move on one axis at a time,
resolve against a static list, no restitution, no separation pass, no
sub-stepping. Arcade would change the feel of every jump — the coyote window,
the wall-slide cap and the wall-jump impulse are all tuned against *this*
resolver's behaviour, and "preserve the recognisable mechanics" outranks "use
the engine's physics". It is also the reason the movement code is unit-testable
from Node at all.

### Rendering stays canvas-2D

The game's look is hundreds of hand-placed rects, gradients and
`globalCompositeOperation = "lighter"` passes over locked artwork. Rebuilding
that as a Phaser display list would be a redesign wearing a port's clothes, and
the brief locks the visuals. So Phaser owns the texture, the scaling, the loop
and the lifecycle; `render.ts` owns pixels.

The buffer is 640×360 with a 2× transform — not 320×180 upscaled. v1.7 drew at
2× and that is load-bearing: the 8 px HUD type, the gradients and every stroked
path are rasterised at twice the resolution. A 320×180 buffer would match only
for axis-aligned rects and be visibly coarser everywhere else.

### The simulation is framework-free

`sim.ts` takes a context object and touches nothing global. That is what lets
`scripts/test-polaris-man.mjs` exercise collision, campaign rules and level
construction in Node with no browser and no stubs.

## Lifecycle

`mountPolarisMan(host)` returns a handle with `destroy()`, `suspend()`,
`resume()`. Teardown is the part that matters, because the egg opens and closes
repeatedly inside a long-lived page:

- every listener is registered through `ctx.bind()`, which records its removal
- `ctx.dispose()` runs all removals, stops every scheduled oscillator, and
  disconnects the audio graph
- `game.destroy(true, false)` removes the canvas and the frame texture
- `shell.root.remove()` takes the DOM with it
- `egg9Game` in `runtime.ts` is the single source of truth for "is it up", so a
  second close is a no-op and a reopen cannot produce two instances

v1.7 attached `keydown`/`keyup`/`blur` to `window` and never removed them. That
is harmless in a single-purpose page and a leak here, so all key handling is
bound to the modal element instead.

## Tuning

`tuning.ts` holds every gameplay number with the original value and, where one
differs, a `CHANGED:` comment explaining why. Changing the feel of the game
should never mean reading the physics again.

## Dependency

Phaser 4.2.1, added to `dependencies`. It is reached only through
`import("../../games/polaris-man/index")` inside `eggOpen8()`, so Vite emits it
as its own chunk: **1,455 KB raw / 384 KB gzip**, fetched on activation and
never by any other route. Verified against the production build — no other
emitted chunk references Phaser.
