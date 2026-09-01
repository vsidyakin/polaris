/**
 * Mars: Signal Siege — the whole check suite, in one command.
 *
 * Four checks, run in the order a failure is most useful:
 *
 *   1. sprite atlases   the art the game draws
 *   2. levels           the stages it builds from that art
 *   3. audio            the cues and effects it plays over them
 *   4. integration      the wiring that gets a visitor there at all
 *
 * The Python interpreter is resolved rather than assumed. The repo's other
 * Python checks hard-code `python3`, which on Windows resolves to the Microsoft
 * Store stub and fails with a message about installing Python — a confusing way
 * to be told a sprite sheet is fine. This tries the plausible names and reports
 * honestly if none of them work, instead of failing the suite for it.
 */

import { spawnSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function findPython() {
  for (const cmd of ["python3", "python", "py"]) {
    const probe = spawnSync(cmd, ["-c", "import sys; print(sys.version_info[0])"],
      { encoding: "utf8" });
    if (probe.status === 0 && probe.stdout.trim().startsWith("3")) return cmd;
  }
  return null;
}

const python = findPython();
const results = [];

function run(label, cmd, args) {
  console.log(`\n${"=".repeat(72)}\n${label}\n${"=".repeat(72)}`);
  const r = spawnSync(cmd, args, { cwd: ROOT, stdio: "inherit" });
  results.push({ label, status: r.status ?? 1 });
  return r.status === 0;
}

if (python) {
  run("Sprite atlases", python, ["scripts/check-mars-sprite-atlases.py"]);
} else {
  console.log("\nSprite atlases: SKIPPED — no working python3 on PATH.");
  console.log("  Install Python 3 and re-run, or run scripts/check-mars-sprite-atlases.py by hand.");
  results.push({ label: "Sprite atlases", status: 0, skipped: true });
}

run("Level geometry", process.execPath, ["scripts/check-mars-levels.mjs"]);
run("Audio", process.execPath, ["scripts/check-mars-audio.mjs"]);
run("Integration and campaign logic", process.execPath, ["scripts/test-mars-signal-siege.mjs"]);

console.log(`\n${"=".repeat(72)}\nSummary\n${"=".repeat(72)}`);
let failed = 0;
for (const r of results) {
  const state = r.skipped ? "SKIP" : r.status === 0 ? "PASS" : "FAIL";
  if (r.status !== 0) failed++;
  console.log(`  ${state}  ${r.label}`);
}
console.log(failed ? `\ntest:mars FAILED (${failed})` : "\ntest:mars PASSED");
process.exit(failed ? 1 : 0);
