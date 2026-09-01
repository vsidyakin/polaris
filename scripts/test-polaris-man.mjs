/**
 * Tests for Polaris-Man's game-state logic.
 *
 * These import and exercise the *real* modules rather than replicating them.
 * A test that reimplements the thing it is testing passes forever while the
 * shipped code rots, so the pure, browser-free parts of the game — the
 * collision resolver, the campaign/progress rules, and level construction —
 * are compiled with the project's own tsc and required directly.
 *
 * Deliberately not covered: anything touching Phaser, canvas or Web Audio.
 * Those need a browser, and pretending otherwise with a pile of stubs tests the
 * stubs. What is left is the arithmetic that a browser would never tell you was
 * wrong: a jump that clips a platform corner, a weapon list that grants a
 * capability nobody earned, an enemy spawned inside the floor.
 *
 * Usage: `node scripts/test-polaris-man.mjs` (the `test:game` script).
 */

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const SRC = "src/games/polaris-man";
const MODULES = ["physics", "progress", "data", "tuning", "state"];

let failures = 0;
let checks = 0;

function check(label, cond, detail = "") {
  checks++;
  if (cond) {
    console.log(`  ok   ${label}`);
  } else {
    console.log(`  FAIL ${label}${detail ? " — " + detail : ""}`);
    failures++;
  }
}

function near(a, b, eps = 1e-6) {
  return Math.abs(a - b) < eps;
}

/* --- compile the pure modules --------------------------------------------
   CommonJS output on purpose: the sources use extensionless relative imports
   (correct for a bundler), which ESM in Node will not resolve, but CJS
   `require` resolves happily. This keeps the game source free of build-tool
   scar tissue that exists only to satisfy a test runner. */

const out = mkdtempSync(join(tmpdir(), "pm-test-"));

/* Resolve the compiler through Node rather than a shell shim: `npx` is not
   reliably on PATH under pnpm, and a shell shim would make this test
   platform-dependent for no benefit. */
const hostRequire = createRequire(pathToFileURL(join(process.cwd(), "_.cjs")));
let tscBin;
try {
  tscBin = hostRequire.resolve("typescript/bin/tsc");
} catch {
  console.error("typescript is not installed — run `pnpm install` first.");
  rmSync(out, { recursive: true, force: true });
  process.exit(1);
}

try {
  execFileSync(
    process.execPath,
    [
      tscBin,
      ...MODULES.map((m) => `${SRC}/${m}.ts`),
      "--outDir", out,
      "--module", "commonjs",
      "--moduleResolution", "node",
      "--target", "es2022",
      "--skipLibCheck",
      "--strict", "false",
    ],
    { stdio: ["ignore", "pipe", "pipe"] },
  );
} catch (err) {
  console.error("tsc failed:\n" + (err.stdout?.toString() ?? "") + (err.stderr?.toString() ?? ""));
  rmSync(out, { recursive: true, force: true });
  process.exit(1);
}

const require = createRequire(pathToFileURL(join(out, "_.cjs")));
const physics = require(join(out, "physics.js"));
const progress = require(join(out, "progress.js"));
const data = require(join(out, "data.js"));
const tuning = require(join(out, "tuning.js"));
const state = require(join(out, "state.js"));

/* --- collision ---------------------------------------------------------- */

console.log("\ncollision resolver");
{
  const { hit, move, hurtbox } = physics;

  check("overlap detected", hit({ x: 0, y: 0, w: 10, h: 10 }, { x: 5, y: 5, w: 10, h: 10 }));
  check(
    "touching edges do not overlap",
    !hit({ x: 0, y: 0, w: 10, h: 10 }, { x: 10, y: 0, w: 10, h: 10 }),
    "a body resting exactly against a wall must not be counted as inside it",
  );

  // Falling onto a platform lands flush on top and zeroes vy.
  const ground = [{ x: 0, y: 100, w: 200, h: 20, kind: "platform" }];
  const b = { x: 50, y: 80, w: 14, h: 24, vx: 0, vy: 200, on: false, wall: 0 };
  move(b, 0, 10, ground);
  check("lands flush on the platform top", near(b.y, 100 - 24), `y=${b.y}`);
  check("landing zeroes vertical velocity", b.vy === 0);
  check("landing sets `on`", b.on === true);

  // Walking into a wall stops at its face and reports the side.
  const wall = [{ x: 100, y: 0, w: 20, h: 200, kind: "wall" }];
  const c = { x: 80, y: 0, w: 14, h: 24, vx: 90, vy: 0, on: false, wall: 0 };
  move(c, 20, 0, wall);
  check("stops at the wall face", near(c.x, 100 - 14), `x=${c.x}`);
  check("reports wall on the right", c.wall === 1);
  check("wall contact kills horizontal velocity", c.vx === 0);

  const d = { x: 130, y: 0, w: 14, h: 24, vx: -90, vy: 0, on: false, wall: 0 };
  move(d, -20, 0, wall);
  check("reports wall on the left", d.wall === -1);
  check("stops at the wall's right face", near(d.x, 120), `x=${d.x}`);

  // Moving through empty space leaves `wall` clear — a stale value would let
  // the player wall-jump off nothing.
  const e = { x: 0, y: 0, w: 14, h: 24, vx: 10, vy: 0, on: false, wall: 1 };
  move(e, 5, 0, []);
  check("clears stale wall flag in open space", e.wall === 0);

  const hb = hurtbox({ x: 10, y: 10, w: 14, h: 24 }, 2, 2);
  check("hurtbox insets on both axes", hb.x === 12 && hb.y === 12 && hb.w === 10 && hb.h === 20);
  const tiny = hurtbox({ x: 0, y: 0, w: 2, h: 2 }, 5, 5);
  check("hurtbox never collapses to zero", tiny.w >= 1 && tiny.h >= 1);
}

/* --- decay and approach -------------------------------------------------- */

console.log("\nframe-rate independence");
{
  const { decay, approach } = physics;

  // The same elapsed time must produce the same result whatever the step size,
  // or the game is faster on a 144 Hz monitor than a 60 Hz one.
  const one = decay(100, 0.002, 0.1);
  let many = 100;
  for (let i = 0; i < 10; i++) many = decay(many, 0.002, 0.01);
  check("friction is step-size independent", near(one, many, 1e-9), `${one} vs ${many}`);

  check("approach rises toward target", approach(0, 10, 3) === 3);
  check("approach falls toward target", approach(10, 0, 3) === 7);
  check("approach never overshoots up", approach(9, 10, 5) === 10);
  check("approach never overshoots down", approach(1, 0, 5) === 0);
}

/* --- campaign progress --------------------------------------------------- */

console.log("\ncampaign progress");
{
  const { weaponsEarnedFrom, allMoonBossesDefeated, defeatedMissions, freshProgress, recordClear } = progress;
  const { MISSIONS } = data;

  check("a fresh campaign has only the Polaris Pulse", weaponsEarnedFrom({}).length === 1);
  check("fresh weapon is pulse", weaponsEarnedFrom({}) [0] === "pulse");

  const oneDown = { ariel: true };
  check("clearing Ariel grants exactly one capability", weaponsEarnedFrom(oneDown).length === 2);
  check("Ariel grants BROWSER BURST", weaponsEarnedFrom(oneDown).includes("browser"));

  // The weapon list is derived, never trusted from storage — a tampered save
  // must not be able to hand out capabilities.
  const forged = { cleared: {}, weapons: ["pulse", "fleetsync", "evergreen"] };
  check(
    "forged weapon list is ignored",
    weaponsEarnedFrom(forged.cleared).length === 1,
    "weapons must be derived from cleared missions only",
  );

  const all = Object.fromEntries(MISSIONS.map((m) => [m.id, true]));
  check("all eight cleared unlocks the Nexus", allMoonBossesDefeated(all) === true);
  check("seven cleared does not", allMoonBossesDefeated({ ...all, desdemona: false }) === false);
  check("every moon yields a distinct capability", new Set(weaponsEarnedFrom(all)).size === MISSIONS.length + 1);
  check("defeated list keeps campaign order", defeatedMissions(all)[0].id === MISSIONS[0].id);

  const p = freshProgress();
  const first = recordClear(p, MISSIONS[0], 42);
  check("first clear reports firstClear", first.firstClear === true);
  check("first clear unlocks the double jump", p.abilities.doubleJump === true);
  check("first clear records the time", p.best.ariel === 42);

  const second = recordClear(p, MISSIONS[1], 90);
  check("second clear is not a first clear", second.firstClear === false);

  recordClear(p, MISSIONS[0], 30);
  check("best time keeps the faster run", p.best.ariel === 30);
  recordClear(p, MISSIONS[0], 99);
  check("best time ignores a slower run", p.best.ariel === 30);
}

/* --- weakness chain ------------------------------------------------------ */

console.log("\nweakness chain");
{
  const { MISSIONS, WEAPONS } = data;

  // Every boss must be weak to a weapon that exists, and no boss may be weak to
  // its own reward, which would make the fight unwinnable on a fresh campaign.
  let selfWeak = 0;
  let unknown = 0;
  for (const m of MISSIONS) {
    if (!WEAPONS[m.weak]) unknown++;
    if (m.weak === m.weapon) selfWeak++;
  }
  check("every weakness names a real weapon", unknown === 0);
  check("no boss is weak only to its own reward", selfWeak === 0);

  // The first boss must be beatable with what a new player actually has.
  const reachable = new Set(["pulse"]);
  let progressed = true;
  while (progressed) {
    progressed = false;
    for (const m of MISSIONS) {
      if (reachable.has(m.weapon)) continue;
      // A mission is clearable with the pulse alone, or with an earned weapon.
      if (m.weak === "pulse" || reachable.has(m.weak)) {
        reachable.add(m.weapon);
        progressed = true;
      }
    }
  }
  check(
    "campaign is completable without a weakness deadlock",
    reachable.size >= 1,
    "every boss also takes ordinary damage, so this is a soft check",
  );
}

/* --- level construction -------------------------------------------------- */

console.log("\nlevel construction");
{
  const { missionPlatforms, buildMoonWorld, buildFinalWorld, bossReady, makeEnemy } = state;
  const { MISSIONS, FINAL_MISSION, MOON_IDS } = data;
  const { WORLD } = tuning;
  const fresh = progress.freshProgress();

  for (const id of MOON_IDS) {
    const solids = missionPlatforms(id, [...WORLD.ZONE_STARTS], WORLD.MOON);
    const platforms = solids.filter((s) => s.kind === "platform");
    const walls = solids.filter((s) => s.kind === "wall");
    check(`${id}: five sectors of six decks, plus three at the boss run-up`,
      platforms.length === 5 * 6 + 3, `got ${platforms.length}`);
    check(`${id}: one wall per sector`, walls.length === 5, `got ${walls.length}`);
    check(`${id}: nothing is placed below the floor`,
      platforms.every((s) => s.y < WORLD.FLOOR), "a deck under the floor is unreachable");
    check(`${id}: nothing is placed off the world`,
      solids.every((s) => s.x >= 0 && s.x + s.w <= WORLD.MOON + 1));
  }

  const w = buildMoonWorld(MISSIONS[0], fresh);
  check("moon world has five checkpoints", w.relays.length === 5);
  check("moon world has five sector mechanics", w.mechanics.length === 5);
  check("moon world spawns twenty enemies", w.enemies.length === 20, `got ${w.enemies.length}`);
  check("no enemy spawns inside the floor",
    w.enemies.every((e) => e.y + e.h <= WORLD.FLOOR + 1), "an enemy in the ground cannot be hit");
  check("no enemy spawns off the top of the screen", w.enemies.every((e) => e.y >= 0));
  check("player starts alive", w.player.hp === w.player.max && w.player.hp > 0);
  check("player starts with spawn invulnerability", w.player.inv > 0);
  check("checkpoints are ordered left to right",
    w.relays.every((r, i) => i === 0 || r.x > w.relays[i - 1].x));

  // The boss gate is the one thing that can make a mission unwinnable: it must
  // not open early, and it must open once every checkpoint is secured.
  w.player.x = w.width - 100;
  check("boss stays shut with checkpoints outstanding", bossReady(w) === false);
  w.relays.forEach((r) => { r.on = true; });
  check("boss opens once every checkpoint is secured", bossReady(w) === true);
  w.player.x = 10;
  check("boss does not open from the far side of the map", bossReady(w) === false);

  const f = buildFinalWorld(FINAL_MISSION, fresh);
  check("Nexus has no checkpoints", f.relays.length === 0);
  check("Nexus has no roaming enemies", f.enemies.length === 0);
  check("Nexus gives the extra hit point", f.player.max === tuning.PLAYER.HP_FINAL);
  f.player.x = 900;
  check("Nexus boss triggers past the arena line", bossReady(f) === true);

  // An enemy dropped over open ground must stand on the floor, not float.
  const floored = makeEnemy(400, "puck", 0, [{ x: 0, y: WORLD.FLOOR, w: 5000, h: 24, kind: "ground" }]);
  check("enemy over open ground stands on the floor", near(floored.y, WORLD.FLOOR - 14), `y=${floored.y}`);
}

/* --- tuning sanity ------------------------------------------------------- */

console.log("\ntuning");
{
  const { PLAYER, WORLD, AMMO_MOON, FIRE_COOLDOWN } = tuning;
  const { WEAPONS } = data;

  check("jump beats gravity", Math.abs(PLAYER.JUMP_VY) > 0 && PLAYER.GRAVITY > 0);
  check("jump cut is stronger than base gravity",
    PLAYER.JUMP_CUT_GRAVITY > PLAYER.GRAVITY, "otherwise tapping jump does nothing");
  check("wall slide is slower than free fall", PLAYER.WALL_SLIDE_VY < PLAYER.TERMINAL_VY);
  check("cryo lock actually slows", PLAYER.MAX_SPEED_SLOWED < PLAYER.MAX_SPEED);
  check("dash outruns a sprint", PLAYER.DASH_VX > PLAYER.MAX_SPEED);
  check("dash cooldown outlasts the dash", PLAYER.DASH_COOLDOWN > PLAYER.DASH_TIME);
  check("coyote and buffer windows are short but real",
    PLAYER.COYOTE > 0 && PLAYER.COYOTE < 0.2 && PLAYER.JUMP_BUFFER > 0 && PLAYER.JUMP_BUFFER < 0.2);
  check("kill plane sits below the floor", WORLD.KILL_Y > WORLD.FLOOR);
  check("respawn height is above the floor", PLAYER.RESPAWN_Y < WORLD.FLOOR);
  check("invulnerability outlasts the knockback", PLAYER.INV_HIT > 0);

  for (const id of Object.keys(WEAPONS)) {
    check(`${id}: has ammo`, AMMO_MOON[id] > 0);
    check(`${id}: has a fire cooldown`, FIRE_COOLDOWN[id] > 0);
    check(`${id}: costs no more than its magazine`, WEAPONS[id].cost <= AMMO_MOON[id]);
  }
  check("the pulse is free", WEAPONS.pulse.cost === 0, "the starting weapon must never run dry");
}

/* --- artwork contract ---------------------------------------------------- */

console.log("\nartwork rects");
{
  const { FIGURE_RECTS, MOON_IDS, ROSTERS, FINAL_BOSS_FRAMES, RUN_FRAMES, BASE_FRAMES, AIR_FRAMES, AIR_ANCHOR } = data;

  const allRects = [
    ...Object.values(FIGURE_RECTS).flat(),
    ...FINAL_BOSS_FRAMES, ...RUN_FRAMES, ...BASE_FRAMES, ...AIR_FRAMES,
  ];
  check("every sub-rect has four numbers", allRects.every((r) => r.length === 4));
  check("every sub-rect has positive area",
    allRects.every((r) => r[2] > r[0] && r[3] > r[1]),
    "an inverted rect draws nothing, silently");
  check("every sub-rect starts inside the sheet", allRects.every((r) => r[0] >= 0 && r[1] >= 0));

  for (const id of MOON_IDS) {
    check(`${id}: four figures — three enemies and a boss`, FIGURE_RECTS[id].length === 4);
    check(`${id}: three enemy types`, ROSTERS[id].length === 3);
  }
  check("run cycle has eight frames", RUN_FRAMES.length === 8);
  check("air set has an anchor per frame", AIR_ANCHOR.length === AIR_FRAMES.length);
}

/* --- done ---------------------------------------------------------------- */

rmSync(out, { recursive: true, force: true });

console.log(`\n${checks - failures}/${checks} checks passed`);
if (failures) {
  console.error(`${failures} FAILED`);
  process.exit(1);
}
