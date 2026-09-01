/**
 * Mars: Signal Siege — level geometry audit.
 *
 * Imports the game's own generator (src/games/mars-signal-siege/levels.ts) via
 * esbuild rather than reimplementing it. A second copy of the layout rules in
 * the test would agree with itself forever while the shipped stages drifted.
 *
 * Fails the build if any of the twelve missions is not finishable:
 *
 *   overlap                two surfaces occupy the same space, so collision
 *                          resolution picks one arbitrarily and the player
 *                          catches on an invisible lip
 *   unreachable            a platform with no jump route from the spawn
 *   boss-unreachable       the arena cannot be entered — the mission is a
 *                          dead end however well it plays up to that point
 *   spawn-unsupported      a walker standing on nothing, which reads as a
 *                          humanoid hovering over a gap
 *   spawn-inside           an enemy embedded in geometry
 *   checkpoint-unreachable dying after the checkpoint drops you through the
 *                          floor forever
 *
 * On top of the audit it enforces the one-way-platform rule, which the audit
 * cannot see because a thin platform is still a landing surface and so looks
 * identical to solid ground from a reachability point of view. Contra only let
 * you drop through thin floating girders; a `thin` flag on the ground run, on
 * an arena floor, or on the surface the checkpoint is seated on turns
 * hold-Down-plus-Jump into a fall out of the world.
 *
 * It also reports the jump budget actually used, so a change to the reach
 * constants that quietly makes stages harder shows up as a number rather than
 * as a bug report.
 *
 * Three further rules come from the QA pass that found the shipped stages ended
 * in an empty flat deck and the uplink shaft threw the player at the wall.
 * None of them is visible to a reachability audit, because all three describe
 * stages that are perfectly finishable and unpleasant to play:
 *
 *   buried-ledge   a one-way ledge with a SOLID slab less than PLAYER.H above
 *                  it. PlayScene.blockHorizontally treats any solid platform
 *                  overlapping Rook's box as a wall and pushes him to its
 *                  nearest edge, so standing on such a ledge shoves him off it
 *                  — and under a full-width slab it shoves him the width of the
 *                  world. Nine of these shipped in the shaft.
 *   enemy-gap      the largest stretch of run between two consecutive bodies,
 *                  measured spawn -> enemies -> boss gate. The opening lead-in
 *                  is deliberate and about 600 px; anything beyond ENEMY_GAP_MAX
 *                  is the enemy budget having run out before the stage did.
 *   spawn-pressure an enemy inside ENEMY.NOTICE_RANGE of the player start, which
 *                  is a mission that opens already shooting at someone who has
 *                  not moved yet.
 */

import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadTs } from "./lib/load-ts.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ENTRY = join(ROOT, "src", "games", "mars-signal-siege", "levels.ts");

const disposers = [];
async function loadModule(entry) {
  const { module, dispose } = await loadTs(entry);
  disposers.push(dispose);
  return module;
}

function fmt(n) {
  return String(n).padStart(3);
}

const levels = await loadModule(ENTRY);
const { buildAllStages, audit, canJump, horizontalGap, reachableSet } = levels;
const tuning = await loadModule(join(ROOT, "src", "games", "mars-signal-siege", "tuning.ts"));
const PLAYER_H = tuning.PLAYER.H;
const NOTICE_RANGE = tuning.ENEMY.NOTICE_RANGE;

/**
 * Largest run of stage the player may cross without meeting anything.
 *
 * The deliberate opening lead-in is about 600 px — the stage's first screen is
 * quiet on purpose — so the ceiling is that plus a screen of slack. QA's
 * pre-fix numbers were 996, 1 097, 1 352 and 1 814, all of them the boss
 * approach after the enemy budget had been spent on the left of the run.
 */
const ENEMY_GAP_MAX = 760;

const stages = buildAllStages();
let failures = 0;
const rows = [];

for (const stage of stages) {
  const result = audit(stage);
  const seen = reachableSet(stage);

  /* Largest gap and rise the player is actually required to clear, as opposed
     to the largest the constants permit. */
  let maxGap = 0;
  let maxRise = 0;
  for (const i of seen) {
    for (const j of seen) {
      if (i === j) continue;
      const a = stage.platforms[i];
      const b = stage.platforms[j];
      if (!canJump(a, b, stage.vertical)) continue;
      maxGap = Math.max(maxGap, horizontalGap(a, b));
      maxRise = Math.max(maxRise, a.y - b.y);
    }
  }

  /* The drop-through rule. Solid ground extends to the bottom of the world, so
     it is always taller than a girder; that height difference is the honest
     test for "is this something the stage is standing on". */
  const thinIssues = [];
  for (const p of stage.platforms) {
    if (!p.thin) continue;
    if (p.type === "boss") thinIssues.push(`arena floor at ${p.x} is marked thin`);
    else if (p.h > 24) thinIssues.push(`ground at (${p.x},${p.y}) ${p.w}x${p.h} is marked thin`);
  }
  const seat = stage.platforms.find(
    (p) => stage.checkpoint.x >= p.x - 2 && stage.checkpoint.x <= p.x + p.w + 2 &&
           Math.abs(p.y - (stage.checkpoint.y + PLAYER_H)) <= 120,
  );
  if (seat?.thin) {
    thinIssues.push(`the checkpoint is seated on a drop-through platform at ${seat.x}`);
  }
  for (const detail of thinIssues) result.issues.push({ kind: "drop-through", detail });

  /* A ledge the player cannot stand on because the slab above it is solid.
     The clearance test is PlayScene's own `rook.y >= p.y + p.h` — the one that
     decides Rook is below a platform rather than inside it — with the top of
     his box written out as ledge minus PLAYER_H. */
  for (const p of stage.platforms) {
    if (!p.thin) continue;
    for (const q of stage.platforms) {
      if (q === p || q.thin) continue;
      if (q.y >= p.y) continue;                                   // not above it
      if (q.x >= p.x + p.w || q.x + q.w <= p.x) continue;          // not over it
      if (p.y - PLAYER_H >= q.y + q.h) continue;                   // clears his head
      result.issues.push({
        kind: "buried-ledge",
        detail: `ledge (${p.x},${p.y},${p.w}) stands ${p.y - (q.y + q.h)} px under solid ` +
                `(${q.x},${q.y},${q.w}x${q.h}); ${PLAYER_H} needed`,
      });
      break;
    }
  }

  /* Enemy spacing along the run, with the spawn and the boss gate as the two
     ends: an empty first screen and an empty last screen are both gaps. */
  const axis = stage.vertical ? (v) => -v.y : (v) => v.x;
  const marks = [
    axis(stage.spawn),
    ...stage.enemies.map(axis).sort((a, b) => a - b),
    stage.vertical ? -stage.bossGateY : stage.bossGateX,
  ];
  let enemyGap = 0;
  let enemyGapAt = 0;
  for (let i = 1; i < marks.length; i++) {
    if (marks[i] - marks[i - 1] > enemyGap) {
      enemyGap = Math.round(marks[i] - marks[i - 1]);
      enemyGapAt = Math.round(Math.abs(marks[i - 1]));
    }
  }
  if (enemyGap > ENEMY_GAP_MAX) {
    result.issues.push({
      kind: "enemy-gap",
      detail: `${enemyGap} px with nothing in it from ${enemyGapAt}, over the ${ENEMY_GAP_MAX} px ceiling`,
    });
  }

  for (const e of stage.enemies) {
    const d = Math.hypot(e.x - stage.spawn.x, e.y - stage.spawn.y);
    if (d < NOTICE_RANGE) {
      result.issues.push({
        kind: "spawn-pressure",
        detail: `${e.kind} at (${Math.round(e.x)},${Math.round(e.y)}) is ${Math.round(d)} px ` +
                `from the player start, inside the ${NOTICE_RANGE} px notice range`,
      });
    }
  }

  rows.push({
    mission: stage.mission + 1,
    vertical: stage.vertical,
    platforms: stage.platforms.length,
    thin: stage.platforms.filter((p) => p.thin).length,
    reachable: result.reachable,
    enemies: stage.enemies.length,
    maxGap,
    maxRise,
    enemyGap,
    issues: result.issues,
  });
  if (result.issues.length) failures++;
}

console.log(
  "mission  kind        plat  thin  reach  enemy  maxGap  maxRise  quiet  status",
);
for (const r of rows) {
  const status = r.issues.length === 0 ? "ok" : `${r.issues.length} ISSUE(S)`;
  console.log(
    `   ${fmt(r.mission)}  ${(r.vertical ? "vertical" : "horizontal").padEnd(10)} ` +
    `${fmt(r.platforms)}  ${fmt(r.thin)}  ${fmt(r.reachable)}  ${fmt(r.enemies)}  ` +
    `${fmt(r.maxGap)}    ${fmt(r.maxRise)}   ${fmt(r.enemyGap)}  ${status}`,
  );
  for (const issue of r.issues.slice(0, 6)) {
    console.log(`           - [${issue.kind}] ${issue.detail}`);
  }
  if (r.issues.length > 6) {
    console.log(`           - ...and ${r.issues.length - 6} more`);
  }
}

/* Every environment family must actually appear, or a mission is silently
   drawing the wrong backdrop. */
const data = await loadModule(join(ROOT, "src", "games", "mars-signal-siege", "data.ts"));
const families = new Set(data.MISSIONS.map((m) => m.environment));
const EXPECTED = ["dustline", "uplink", "icevault", "hivecity", "catacombs", "foundry"];
const missingFamilies = EXPECTED.filter((f) => !families.has(f));
if (missingFamilies.length) {
  console.log(`\nMISSING ENVIRONMENT FAMILIES: ${missingFamilies.join(", ")}`);
  failures++;
}

const verticalCount = stages.filter((s) => s.vertical).length;
if (verticalCount < 1) {
  console.log("\nNo vertical ascent mission — the brief requires at least one.");
  failures++;
}

console.log(
  `\ncheck-mars-levels: ${stages.length} missions, ` +
  `${families.size} environment families, ${verticalCount} vertical, ` +
  `${failures} failing`,
);
process.exit(failures ? 1 : 0);
