/**
 * Tests for Mars: Signal Siege.
 *
 * Two halves, and neither of them reimplements the thing it tests.
 *
 *   Logic  — the browser-free modules (data, progress, levels) are transpiled
 *            and imported directly, so campaign rules, unlock gating and stage
 *            construction are exercised as shipped.
 *   Wiring — the integration points are asserted against the actual source of
 *            runtime.ts, solar3d.ts, data.ts and GameOverlays.astro. These are
 *            string assertions on purpose: the alternative is booting a
 *            browser, and what can go wrong here is not behavioural, it is a
 *            route left pointing at the old game.
 *
 * Deliberately not covered: anything needing Phaser, canvas or Web Audio.
 * Stubbing those tests the stubs. What is left is what a browser would never
 * tell you was wrong — a final boss reachable with ten sectors cleared, a
 * muzzle socket missing for a pose, a mission that cannot be finished.
 *
 * Usage: `node scripts/test-mars-signal-siege.mjs` (the `test:mars` script).
 */

import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadTs } from "./lib/load-ts.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const GAME = join(ROOT, "src", "games", "mars-signal-siege");
const ART = join(ROOT, "public", "eggs", "mars-signal-siege", "art");

let failures = 0;
let checks = 0;
const disposers = [];

function check(label, cond, detail = "") {
  checks++;
  if (cond) {
    console.log(`  ok   ${label}`);
  } else {
    console.log(`  FAIL ${label}${detail ? " — " + detail : ""}`);
    failures++;
  }
}

function section(title) {
  console.log(`\n${title}`);
}

const read = (p) => readFileSync(p, "utf8");
async function load(rel) {
  const { module, dispose } = await loadTs(join(GAME, rel));
  disposers.push(dispose);
  return module;
}

const data = await load("data.ts");
const progress = await load("progress.ts");
const levels = await load("levels.ts");

/* ============================================================== integration */

section("Mission Control integration");

const solar3d = read(join(ROOT, "src", "scripts", "eggs", "solar3d.ts"));
const eggData = read(join(ROOT, "src", "scripts", "eggs", "data.ts"));
const runtime = read(join(ROOT, "src", "scripts", "eggs", "runtime.ts"));
const overlays = read(join(ROOT, "src", "components", "GameOverlays.astro"));

check("Three.js map names the new game",
  /route:\s*"catch",\s*\n\s*game:\s*"MARS: SIGNAL SIEGE"/.test(solar3d),
  "solar3d.ts still advertises the old title");
check("Three.js map carries the campaign kicker",
  solar3d.includes("Mars · signal reclamation campaign"));
check("legacy fallback map names the new game",
  eggData.includes('"route":"catch","game":"MARS: SIGNAL SIEGE"'),
  "the accessible/legacy SS_SCENE data still says RELAY RUN");
check("legacy SVG card names the new game",
  overlays.includes(">MARS: SIGNAL SIEGE</text>"));

check("Mars has its own semantic modal",
  overlays.includes('id="egg-mars"') &&
  overlays.includes('id="egg-mars-mount"') &&
  overlays.includes('id="egg-mars-status"'));
check("eggLaunch routes catch to the Phaser game",
  runtime.includes('which==="catch")eggOpenMars()'));
check("Mars is registered with the overlay closers",
  runtime.includes('"egg-mars":eggCloseMars'));
check("Mars counts as an open game for the global key handler",
  runtime.includes('"egg9","egg-mars"'));
/* Mars owns M and Escape only once a scene is actually listening. While the
   chunk is still loading — or permanently, if it failed — the site must keep
   Escape, or a keyboard user is stranded on the error message with no exit but
   the ✕ button. */
check("Mars owns M and Escape only once it is running",
  runtime.includes('game.id==="egg-mars"&&eggMarsGame&&!eggMarsFailed'));
check("a close during the in-flight import cannot mount twice",
  runtime.includes("const gen=++eggMarsGen;") &&
  runtime.includes("if(gen!==eggMarsGen)"),
  "reopening while the chunk is loading would orphan a second Phaser instance");
check("Mars is in the overlay focus-trap and scroll-lock list",
  /OVERLAY_IDS\s*=\s*\[[^\]]*"egg-mars"/.test(runtime));
check("close and mute are reachable from the overlay markup",
  runtime.includes("eggCloseMars,") && runtime.includes("eggMarsToggleMute,"),
  "inline onclick handlers need these on window");

/* Every other planet must still reach the game it always did. */
section("Other planets are untouched");
for (const [route, fn] of [
  ["stack", "eggOpen2()"], ["invade", "eggOpen3()"], ["pluto", "eggOpen4()"],
  ["venus", "eggOpen5()"], ["earth", "eggOpen6()"], ["saturn", "eggOpen7()"],
  ["mercury", "eggOpen8()"], ["uranus", "eggOpen9()"],
]) {
  check(`${route} still launches ${fn}`, runtime.includes(`which==="${route}")${fn}`));
}
check("the legacy Relay Run implementation is still present",
  runtime.includes("RELAY RUN") && runtime.includes("function eggOpen("),
  "it is dormant, not deleted — Signal Jumper shares its sprite keys");

/* ============================================================ lazy loading */

section("Lazy loading");

const indexSrc = read(join(GAME, "index.ts"));
check("Mars is reached by dynamic import only",
  runtime.includes('import("../../games/mars-signal-siege/index")'),
  "a static import would pull Phaser into the main bundle");
check("no eager Mars import anywhere outside the game module",
  !/^import .*mars-signal-siege/m.test(runtime) &&
  !/from ["'].*mars-signal-siege/.test(solar3d));

/* Every public URL must go through withBase, or GitHub Pages 404s.
   Comments are stripped first, and the two path-root constants are allowed —
   they are template fragments, and what matters is that every place they are
   turned into a URL wraps the result in withBase(). */
const assetsSrc = read(join(GAME, "assets.ts"));
/* Strip comments so prose about paths is not mistaken for a path. */
const assetsCode = assetsSrc
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .split("\n").map((l) => l.replace(/\/\/.*$/, "")).join("\n");

/* Only two raw "/eggs/..." literals may exist: the art and audio roots. Every
   other URL is built by one of the four helpers, and each of those must wrap
   its result in withBase(). Checking the helpers rather than every call site is
   what makes this hold for URLs assembled at runtime. */
/* Every raw "/eggs/..." literal must be either one of the two path roots — which
   are template fragments, not URLs — or the argument to withBase() at the point
   it is written. Counting the literals instead was brittle: adding one correctly
   wrapped constant failed a check that was only ever trying to prove they are
   all base-path safe. */
const rawPaths = [...assetsCode.matchAll(/(withBase\(\s*)?["'`](\/eggs\/[^"'`]*)["'`]/g)]
  .map((m) => ({ path: m[2], wrapped: !!m[1] }));
const loosePaths = rawPaths.filter(
  (r) => !r.wrapped && !/^\/eggs\/mars-signal-siege\/(art|audio)$/.test(r.path));
check("every raw /eggs URL in assets.ts is wrapped in withBase",
  loosePaths.length === 0,
  loosePaths.map((r) => r.path).join(", "));

for (const helper of ["const img =", "const sheet =", "const music =", "const sfx ="]) {
  const at = assetsCode.indexOf(helper);
  const body = at === -1 ? "" : assetsCode.slice(at, assetsCode.indexOf("\n\n", at));
  check(`${helper.replace("const ", "").replace(" =", "()")} is base-path safe`,
    at !== -1 && body.includes("withBase("));
}
check("the atlas manifest is fetched through withBase",
  read(join(GAME, "scenes", "PreloadScene.ts")).includes("withBase(\"/eggs/mars-signal-siege/art/atlases.json\")"));

/* ============================================================ campaign data */

section("Campaign data");

const { MISSIONS, WEAPONS, BOSS_PROFILES, FINAL_MISSION, ENDING_CRAWL } = data;
check("twelve missions", MISSIONS.length === 12, `found ${MISSIONS.length}`);
check("twelve boss profiles", BOSS_PROFILES.length === 12);
check("eight weapons", WEAPONS.length === 8);
check("the final mission is the Lock-In Engine",
  MISSIONS[FINAL_MISSION].boss === "THE LOCK-IN ENGINE");
check("every mission grants and is weak to a real weapon",
  MISSIONS.every((m) => WEAPONS[m.grant] && WEAPONS[m.weak]));
check("every mission has a briefing naming the boss behaviour",
  MISSIONS.every((m) => m.briefing.length > 80));
check("six environment families are used",
  new Set(MISSIONS.map((m) => m.environment)).size === 6);
check("weapon roles cover the required archetypes",
  WEAPONS.some((w) => w.mode === "semi") &&
  WEAPONS.some((w) => w.mode === "auto") &&
  WEAPONS.some((w) => w.spread) &&
  WEAPONS.some((w) => w.wave) &&
  WEAPONS.some((w) => w.freeze) &&
  WEAPONS.some((w) => w.splash) &&
  WEAPONS.some((w) => w.homing) &&
  WEAPONS.some((w) => w.returning));
check("the ending crawl states what was reopened",
  ENDING_CRAWL.join(" ").includes("MARS IS OPEN") &&
  /installer/i.test(ENDING_CRAWL.join(" ")) &&
  /ecosystem/i.test(ENDING_CRAWL.join(" ")));

/* No competitor may be named — the satire targets product classes. */
/* Product names only. Bare "zoom" and "teams" are ordinary English — the
   Dustline briefing legitimately says "field teams take the blame" — so the
   check looks for the branded forms rather than the common nouns. */
const NAMES = ["barco", "clickshare", "crestron", "airtame", "webex",
               "chromecast", "microsoft teams", "google meet", "apple tv",
               "zoom rooms", "solstice pod"];
/* m.taunt is in here deliberately. The clear-card taunts are the most
   pointed writing in the game — they are the boss mocking the player's win —
   which makes them exactly the text most likely to reach for a brand name,
   and they went in after this guard was written. */
const corpus = MISSIONS
  .map((m) => `${m.sector} ${m.boss} ${m.threat} ${m.story} ${m.briefing} ${m.taunt}`)
  .join(" ").toLowerCase();
check("no competitor is named",
  !NAMES.some((n) => corpus.includes(n)),
  NAMES.filter((n) => corpus.includes(n)).join(", "));

/* Every boss gets the last word on its own clear card. */
check("every mission has a taunt",
  MISSIONS.every((m) => typeof m.taunt === "string" && m.taunt.trim().length > 30),
  MISSIONS.filter((m) => !m.taunt || m.taunt.trim().length <= 30)
    .map((m) => m.boss).join(", "));
check("no two bosses say the same thing",
  new Set(MISSIONS.map((m) => m.taunt)).size === MISSIONS.length);
/* The joke has to be about the technology, not about the player. A taunt that
   only says "you will regret this" is a wasted card. */
const CLASSES = /button|installer|adapter|dongle|format|network|update|garden|gate|licen|renewal|console|credential|laptop|reboot|export|contract|migrat|warning|tier/i;
check("every taunt mocks a product class",
  MISSIONS.every((m) => CLASSES.test(m.taunt)),
  MISSIONS.filter((m) => !CLASSES.test(m.taunt)).map((m) => m.boss).join(", "));

/* ============================================================ progress rules */

section("Unlock rules");

const { loadProgress, isUnlocked, markCleared } = progress;
const empty = { version: 1, cleared: [], best: 0 };
check("mission 1 is always open", isUnlocked(empty, 0));
check("mission 2 is locked at the start", !isUnlocked(empty, 1));
check("clearing 1 opens 2", isUnlocked({ ...empty, cleared: [0] }, 1));

const tenCleared = { ...empty, cleared: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] };
check("the final boss is locked with ten sectors cleared",
  !isUnlocked(tenCleared, FINAL_MISSION));
const elevenCleared = { ...empty, cleared: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10] };
check("the final boss opens with all eleven cleared",
  isUnlocked(elevenCleared, FINAL_MISSION));

/* Clearing the eleventh alone must not be enough — the gate is "all eleven",
   not "the one before it", or a player could skip straight past nine sectors. */
check("the final boss stays locked if only the eleventh is cleared",
  !isUnlocked({ ...empty, cleared: [10] }, FINAL_MISSION));
check("beating the final boss is not recorded as an unlock",
  markCleared(empty, FINAL_MISSION).cleared.length === 0);
check("clearing is idempotent",
  markCleared(markCleared(empty, 0), 0).cleared.length === 1);

/* ============================================================ stage geometry */

section("Stage construction");

const stages = levels.buildAllStages();
check("every mission builds a stage", stages.length === 12);
let unfinishable = [];
for (const stage of stages) {
  const result = levels.audit(stage);
  if (!result.ok) unfinishable.push(`${stage.mission + 1}: ${result.issues[0].kind}`);
}
check("every mission is finishable", unfinishable.length === 0, unfinishable.join("; "));
check("exactly one vertical ascent", stages.filter((s) => s.vertical).length === 1);
check("the vertical mission is the toxic uplink",
  stages.find((s) => s.vertical)?.mission === 2);
check("every stage has a boss arena",
  stages.every((s) => s.platforms.some((p) => p.type === "boss")));
check("every stage spawns enemies",
  stages.every((s) => s.enemies.length > 0));
check("stage construction is deterministic",
  JSON.stringify(levels.buildStage(4)) === JSON.stringify(levels.buildStage(4)),
  "a QA failure that cannot be reproduced cannot be fixed");

/* Fifteen non-boss types: twelve inherited liveries plus three authored. */
const kinds = new Set();
for (const s of stages) for (const e of s.enemies) kinds.add(`${levels.enemyHeight(e.kind)}:${e.kind}`);
const authored = ["wasp", "crawler", "sentinel"];
check("the authored enemy types are actually deployed",
  authored.every((k) => stages.some((s) => s.enemies.some((e) => e.kind === k))),
  authored.filter((k) => !stages.some((s) => s.enemies.some((e) => e.kind === k))).join(", "));
check("later missions introduce new silhouettes",
  stages[0].enemies.every((e) => !authored.includes(e.kind)) &&
  stages[9].enemies.some((e) => authored.includes(e.kind)));

/* ============================================================ sprite sockets */

section("Muzzle sockets");

const manifestPath = join(ART, "atlases.json");
check("the atlas manifest ships", existsSync(manifestPath));
if (existsSync(manifestPath)) {
  const manifest = JSON.parse(read(manifestPath));

  /* The loader's frame size must equal the atlas's cell size.
     assets.ts keeps its own copy of the geometry, and a copy can drift: the
     enemy cell grew from 80x80 to 112x88 when the roster was re-cut by role
     and this file was not updated, so Phaser went on slicing the sheet into
     80x80 windows. Every enemy in the game was drawn as an arbitrary crop —
     bodies cut off at the right and bottom, two enemies sharing one frame,
     several frames essentially empty. Nothing caught it, because the atlas was
     correct and the game was correct; only the number between them was wrong.
     This asserts the two agree, including that Phaser's own frame grid comes
     out the size the manifest claims. */
  const sheetDecls = [...assetsCode.matchAll(
    /(\w+):\s*sheet\(\s*"[^"]+",\s*"([^"]+)",\s*(\d+),\s*(\d+)\s*\)/g)];
  check("every sprite sheet is declared in assets.ts", sheetDecls.length >= 5,
    `${sheetDecls.length} declarations`);
  for (const [, name, path, w, h] of sheetDecls) {
    const sh = manifest.sheets.find((x) => x.file === path);
    if (!sh) { check(`${name}: ${path} is in the manifest`, false); continue; }
    const cols = Math.floor(sh.cols * sh.cellW / Number(w));
    const rows = Math.floor(sh.rows * sh.cellH / Number(h));
    check(`${name} loads at the atlas cell size`,
      Number(w) === sh.cellW && Number(h) === sh.cellH,
      `assets.ts says ${w}x${h}, atlas says ${sh.cellW}x${sh.cellH}`);
    check(`${name}'s frame grid matches the manifest`,
      cols === sh.cols && rows === sh.rows,
      `Phaser would slice ${cols}x${rows}, manifest declares ${sh.cols}x${sh.rows}`);
    const maxFrame = Math.max(...sh.live_frames);
    check(`${name}'s live frames all exist`, maxFrame < sh.cols * sh.rows,
      `highest live frame ${maxFrame} of ${sh.cols * sh.rows}`);
  }
  const rook = manifest.sheets.find((s) => s.file.endsWith("rook.png"));
  check("Rook's sheet is in the manifest", !!rook);
  if (rook) {
    const live = new Set();
    for (const frames of Object.values(rook.tags)) for (const f of frames) live.add(f);
    const missing = [...live].filter((f) => !rook.sockets?.[String(f)]);
    check("every drawn Rook frame has a measured muzzle socket",
      missing.length === 0,
      `frames without a socket: ${missing.join(", ")}`);

    /* Every pose Rook can fire from must show the weapon. rkey_0 is him stood
       at ease with the rifle stowed; shipping it as `idle` is what made the gun
       disappear whenever the player stopped moving, so the bolts came out of
       empty air. A frame with no measurable muzzle is a frame with no gun in
       it, which is why the socket table is the test. */
    const armed = ["idle", "run", "runfire", "idlefire", "crouch", "clear"];
    check("every grounded pose Rook can fire from shows the rifle",
      armed.every((t) => (rook.tags[t] ?? []).every((f) => !!rook.sockets?.[String(f)])),
      armed.filter((t) => !(rook.tags[t] ?? []).every((f) => !!rook.sockets?.[String(f)])).join(", "));

    /* An air pose must not be the same cell as a grounded one.
       jump/fall were first the planted key poses (Rook upright in mid-air) and
       then the two diagonal-up run strides — which are also what a player sees
       when they hold Up while running, so a jump and a grounded diagonal aim
       became pixel-identical. That is what "shooting diagonally triggers a
       jump" was: not the input doing two things, the sprite claiming it did. */
    const air = new Set([...(rook.tags.jump ?? []), ...(rook.tags.fall ?? [])]);
    const ground = new Set([
      ...(rook.tags.idle ?? []), ...(rook.tags.run ?? []),
      ...(rook.tags.runfire ?? []), ...(rook.tags.aimdiagup_run ?? []),
      ...(rook.tags.aimup ?? []), ...(rook.tags.crouch ?? []),
    ]);
    check("Rook's air poses are not reused for anything he does on the ground",
      [...air].every((f) => !ground.has(f)),
      `shared frames: ${[...air].filter((f) => ground.has(f)).join(", ")}`);

    /* An aim-up socket below the shoulder means the table is wrong for that
       pose — which is exactly the bug that put bolts in Rook's stomach. */
    const upFrames = rook.tags.aimup ?? [];
    const forwardFrames = rook.tags.idle ?? [];
    if (upFrames.length && forwardFrames.length) {
      const up = rook.sockets[String(upFrames[0])];
      const fwd = rook.sockets[String(forwardFrames[0])];
      check("the aim-up muzzle sits above the forward muzzle", up[1] < fwd[1],
        `aim-up y=${up[1]}, forward y=${fwd[1]}`);
    }
    const proneFrames = rook.tags.prone ?? [];
    if (proneFrames.length && forwardFrames.length) {
      const prone = rook.sockets[String(proneFrames[0])];
      const fwd = rook.sockets[String(forwardFrames[0])];
      check("the prone muzzle sits below the standing muzzle", prone[1] > fwd[1],
        `prone y=${prone[1]}, standing y=${fwd[1]}`);
    }
    check("the run cycle ships all eight poses",
      (rook.tags.run ?? []).length === 8, `${(rook.tags.run ?? []).length} frames`);
    check("run-and-fire matches the run cycle length",
      (rook.tags.runfire ?? []).length === (rook.tags.run ?? []).length);
  }

  const bosses = manifest.sheets.find((s) => s.file.endsWith("bosses.png"));
  check("all twelve bosses have an idle, walk, wind-up, fire and recover pose",
    !!bosses && [...Array(12).keys()].every((i) =>
      bosses.tags[`boss${i}_idle`] && bosses.tags[`boss${i}_walk`] &&
      bosses.tags[`boss${i}_wind`] && bosses.tags[`boss${i}_fire`] &&
      bosses.tags[`boss${i}_recover`]));
}

/* ============================================================ asset budget */

section("Asset budget");

function dirBytes(dir) {
  if (!existsSync(dir)) return 0;
  let total = 0;
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const st = statSync(p);
    total += st.isDirectory() ? dirBytes(p) : st.size;
  }
  return total;
}

const artBytes = dirBytes(ART);
check("production art is under 8 MB", artBytes < 8 * 1024 * 1024,
  `${(artBytes / 1024 / 1024).toFixed(2)} MB`);
console.log(`  art total: ${(artBytes / 1024 / 1024).toFixed(2)} MB`);

/* ============================================================ secret code */

section("Secret sequence");

const tuning = read(join(GAME, "tuning.ts"));
check("the thirty-life sequence exists", /SECRET_SEQUENCE/.test(tuning));
check("it grants thirty lives", /LIVES_SECRET:\s*30/.test(tuning));

/* It must not appear in anything the player can read. */
const ui = read(join(GAME, "scenes", "ui.ts"));
const title = read(join(GAME, "scenes", "TitleScene.ts"));
const play = read(join(GAME, "scenes", "PlayScene.ts"));
check("the title screen does not advertise it",
  !/ArrowUp.*ArrowUp.*ArrowDown/.test(title) && !/konami/i.test(title) &&
  !title.includes("30 LIVES"));
check("the controls strip does not advertise it",
  !ui.includes("30 LIVES") && !/konami/i.test(ui));
/* The toast that fires *after* the sequence is entered is allowed to name the
   reward — that is feedback, not advertising. What must not appear is the
   sequence itself, or any hint of it, on a screen the player reads first. */
check("no screen prints the sequence",
  ![ui, title, play].some((src) => /ArrowUp["'\s,]+["']ArrowUp/.test(src)));

/* ================================================ boss identity =========== */

/* The complaint that started this section was "most bosses face away from the
   user and just try to hop ... they should all feel the same", meaning they
   currently do and should not. Every boss ran one shared walk-and-fan, so the
   only thing separating twelve fights was the sprite. These checks are what
   stop that from quietly coming back: a plan table exists, no two bosses share
   a movement-and-weapon signature, and the telegraph every fight rests on can
   never be tuned faster than the reference. */

const bossSrc = read(join(GAME, "entities", "Boss.ts"));
check("every mission has a boss plan",
  (bossSrc.match(/move:\s*"/g) || []).length >= data.MISSIONS.length,
  `${(bossSrc.match(/move:\s*"/g) || []).length} plans for ${data.MISSIONS.length} missions`);

/* Read the plans out of the source rather than importing them: Boss.ts pulls in
   Phaser, and the point here is the table, not the class. */
const plans = [...bossSrc.matchAll(
  /move:\s*"(\w+)",\s*standoff:\s*(\d+),\s*pace:\s*([\d.]+),\s*specials:\s*\[([^\]]*)\],\s*specialEvery:\s*([\d.]+),\s*tell:\s*([\d.]+)/g,
)].map((m) => ({
  move: m[1],
  standoff: Number(m[2]),
  specials: m[4].replace(/["\s]/g, ""),
  tell: Number(m[6]),
}));

check("all twelve plans parse", plans.length === data.MISSIONS.length,
  `${plans.length} parsed`);

/* This used to hash move|specials|standoff, and passed with eight of the twelve
   bosses on "pace" because their standoff NUMBERS differed. Three of them
   walked to a line and shot from it identically; the check called that twelve
   distinct signatures. A number is not a movement idea, so the style alone now
   has to be unique. */
check("no two bosses share a movement style",
  new Set(plans.map((p) => p.move)).size === plans.length,
  `${new Set(plans.map((p) => p.move)).size} distinct of ${plans.length}: ` +
  plans.map((p) => p.move).join(","));

check("no two bosses share a movement signature",
  new Set(plans.map((p) => `${p.move}|${p.specials}|${p.standoff}`)).size === plans.length,
  `${new Set(plans.map((p) => `${p.move}|${p.specials}|${p.standoff}`)).size} distinct of ${plans.length}`);

/* Every style the union declares has to be carried by somebody -- either
   directly or through the Lock-In Engine's cycle -- otherwise the vocabulary is
   documentation rather than behaviour. */
const DECLARED = ["creep", "pace", "skate", "serpent", "stutter", "partition",
                  "march", "waver", "stalk", "anchor", "orbit", "advance", "mimic"];
const MIMICKED = ["march", "skate", "orbit", "waver"];
const used = new Set([...plans.map((p) => p.move), ...MIMICKED]);
check("every declared movement style is used",
  DECLARED.every((m) => used.has(m) || m === "pace"),
  DECLARED.filter((m) => !used.has(m) && m !== "pace").join(", "));

check("the movement vocabulary is more than walking",
  ["leap", "dash", "vault", "rush", "hop", "dive"].filter(
    (v) => plans.some((p) => p.specials.includes(v))).length >= 3,
  plans.map((p) => p.specials).join(" / "));

/* A boss may be slower to telegraph than the reference, never faster: the
   wind-up is the only reason an aimed volley is dodgeable at all. */
check("no boss telegraphs faster than the reference",
  plans.every((p) => p.tell >= 1), plans.map((p) => p.tell).join(","));

/* Aim is captured when the boss cocks the shot and handed to the scene. If the
   scene re-derived it at release the shot would follow the player through the
   telegraph, which is the same as having no telegraph. */
check("the boss locks its aim at wind-up and the scene honours it",
  /aimLocked/.test(bossSrc) && /attack\.aim\s*\?\?/.test(play));

check("contact is not the boss mechanic",
  /hurtRook\(1\)/.test(play.slice(play.indexOf("stepBoss"), play.indexOf("bossFire"))),
  "boss overlap should cost one hit, not two");

/* ================================================================== summary */

for (const d of disposers) d();
console.log(
  `\ntest-mars-signal-siege: ${checks} checks, ${failures} failure(s)`,
);
process.exit(failures ? 1 : 0);
