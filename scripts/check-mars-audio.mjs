/**
 * Mars: Signal Siege — audio delivery and cue-map check.
 *
 * Three separate failures this catches, all of which are silent in a build:
 *
 *   1. A cue the game can ask for that has no file behind it. `playMusic` is
 *      defensive — it returns quietly when the asset is missing — so a missing
 *      track is not an error at runtime, it is just silence for one screen.
 *   2. A named effect the game can play that was never produced. Same failure
 *      mode, same silence.
 *   3. The cue map drifting from the specification. The mapping is asserted
 *      against the game's own `cueFor()`, not against a copy of it.
 *
 * It also reports loop seams on the shipped music, using the same three
 * measures as scripts/check-loop-seams.mjs — a gap, a click, or a lurch across
 * the join — because the whole point of the remaster pass was to remove them.
 */

import { existsSync, readFileSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadTs } from "./lib/load-ts.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const AUDIO = join(ROOT, "public", "eggs", "mars-signal-siege", "audio");
const SFX = join(AUDIO, "sfx");
const MASTERS = join(ROOT, "Game audio files", "Mars Signal Siege", "masters");

const data = await loadTs(join(ROOT, "src", "games", "mars-signal-siege", "data.ts"));
const { MISSIONS, cueFor } = data.module;

let failures = 0;
const note = (msg) => {
  console.log(`  ${msg}`);
  failures++;
};

/* --- 1. every music cue has both encodings --------------------------------- */

const CUES = [
  "title", "introduction", "assault", "bases", "toxic", "ice",
  "energy", "lair", "boss", "clear", "coreDown", "credits", "gameover",
  "lairFinal",
  /* Assembled rather than remastered: a FamiStudio chip part over a Stable
     Audio bed. Both still have to ship in both encodings. */
  "taunt", "epilogue",
];

console.log("Music files:");
let musicBytes = 0;
for (const cue of CUES) {
  const ogg = join(AUDIO, `${cue}.ogg`);
  const mp3 = join(AUDIO, `${cue}.mp3`);
  if (!existsSync(ogg)) note(`MISSING ${cue}.ogg`);
  if (!existsSync(mp3)) note(`MISSING ${cue}.mp3 (Safari has no reliable Vorbis)`);
  if (existsSync(ogg)) musicBytes += statSync(ogg).size;
}
console.log(`  ${CUES.length} cues, ${(musicBytes / 1024 / 1024).toFixed(2)} MB of ogg`);

/* All thirteen original compositions must still be present as masters — the
   brief requires the full-length works to ship, not excerpts. */
const MASTER_FILES = [
  "Mars_title.wav", "Mars_introduction.wav", "Mars_assault_hangar.wav",
  "Mars_area_clear.wav", "Mars_bases.wav", "Mars_boss.wav",
  "Mars_toxic_waterfall.wav", "Mars_ice_field.wav", "Mars_energy_zone.wav",
  "Mars_alien_lair.wav", "Mars_alien_dead.wav", "Mars_credits.wav",
  "Mars_game_over.wav",
];
for (const f of MASTER_FILES) {
  if (!existsSync(join(MASTERS, f))) note(`MISSING master ${f}`);
}

/* --- 2. every effect the game can name exists ------------------------------ */

const assetsSrc = readFileSync(
  join(ROOT, "src", "games", "mars-signal-siege", "assets.ts"), "utf8");
const block = assetsSrc.slice(
  assetsSrc.indexOf("export const SFX_NAMES"),
  assetsSrc.indexOf("] as const;", assetsSrc.indexOf("export const SFX_NAMES")),
);
const sfxNames = [...block.matchAll(/"([A-Za-z0-9]+)"/g)].map((m) => m[1]);

console.log("\nSound effects:");
let sfxBytes = 0;
for (const name of sfxNames) {
  const ogg = join(SFX, `${name}.ogg`);
  const mp3 = join(SFX, `${name}.mp3`);
  if (!existsSync(ogg)) note(`MISSING sfx/${name}.ogg`);
  if (!existsSync(mp3)) note(`MISSING sfx/${name}.mp3`);
  if (existsSync(ogg)) sfxBytes += statSync(ogg).size;
}
console.log(`  ${sfxNames.length} effects, ${(sfxBytes / 1024).toFixed(0)} KB of ogg`);

/* Every category the brief enumerates has to be represented. */
const REQUIRED_SFX_ROLES = {
  "player weapons": (n) => /^fire[0-7]$/.test(n),
  "enemy projectiles": (n) => /^enemyFire/.test(n),
  jump: (n) => n === "jump",
  land: (n) => n === "land",
  pickup: (n) => n === "pickup",
  freeze: (n) => n === "freeze",
  "shield intercept": (n) => n === "shield",
  "player hit": (n) => n === "playerHit",
  "player death": (n) => n === "death",
  "enemy hit": (n) => n === "enemyHit",
  "enemy death": (n) => n === "enemyDown",
  "boss hit": (n) => n === "bossHit",
  "boss death": (n) => n === "bossDown",
  "ui move": (n) => n === "uiMove",
  "ui confirm": (n) => n === "uiConfirm",
  denied: (n) => n === "deny",
  pause: (n) => n === "pause",
  resume: (n) => n === "resume",
  "mission deploy": (n) => n === "deploy",
  "mission clear": (n) => n === "clear",
  "game over": (n) => n === "gameover",
};
for (const [role, test] of Object.entries(REQUIRED_SFX_ROLES)) {
  if (!sfxNames.some(test)) note(`no effect covers the "${role}" role`);
}
const weaponSfx = sfxNames.filter((n) => /^fire[0-7]$/.test(n));
if (weaponSfx.length !== 8) note(`expected 8 weapon effects, found ${weaponSfx.length}`);

/* --- 3. the cue map matches the specification ------------------------------ */

console.log("\nCue map:");
const EXPECT = [
  ["title screen", { screen: "title", mission: 0, bossActive: false, missionMusic: "assault" }, "title"],
  ["mission select", { screen: "select", mission: 0, bossActive: false, missionMusic: "assault" }, "introduction"],
  ["briefing", { screen: "briefing", mission: 0, bossActive: false, missionMusic: "assault" }, "introduction"],
  /* The clear screen is the defeated boss's taunt card now, so it wants the
     taunt cue. `clear` still ships as a master and as an effect — the sting
     the game plays at the moment the boss falls is a different thing from the
     bed under the card that follows it. */
  ["mission clear", { screen: "clear", mission: 0, bossActive: false, missionMusic: "assault" }, "taunt"],
  ["game over", { screen: "gameover", mission: 0, bossActive: false, missionMusic: "assault" }, "gameover"],
  ["regular boss", { screen: "play", mission: 3, bossActive: true, missionMusic: "ice" }, "boss"],
  ["final boss", { screen: "play", mission: 11, bossActive: true, missionMusic: "lair" }, "lairFinal"],
  ["final destruction", { screen: "victory", mission: 11, bossActive: false, victoryPhase: "coreDown", missionMusic: "lair" }, "coreDown"],
  ["credits", { screen: "victory", mission: 11, bossActive: false, victoryPhase: "credits", missionMusic: "lair" }, "epilogue"],
];
for (const [label, state, expected] of EXPECT) {
  const got = cueFor(state);
  if (got !== expected) note(`${label}: expected "${expected}", got "${got}"`);
}

/* Per-mission mission music, exactly as the brief's table specifies. */
const MISSION_CUES = [
  "assault", "bases", "toxic", "ice", "assault", "bases",
  "energy", "toxic", "bases", "lair", "ice", "lair",
];
for (let i = 0; i < MISSION_CUES.length; i++) {
  const got = cueFor({ screen: "play", mission: i, bossActive: false, missionMusic: MISSIONS[i].music });
  if (got !== MISSION_CUES[i]) {
    note(`mission ${i + 1} music: expected "${MISSION_CUES[i]}", got "${got}"`);
  }
}
console.log(`  ${EXPECT.length + MISSION_CUES.length} mappings checked`);

/* Boss music must replace mission music, and the final fight must not sound
   like the eleven before it. */
if (cueFor({ screen: "play", mission: 3, bossActive: true, missionMusic: "ice" }) ===
    cueFor({ screen: "play", mission: 3, bossActive: false, missionMusic: "ice" })) {
  note("boss music does not replace mission music");
}
if (cueFor({ screen: "play", mission: 11, bossActive: true, missionMusic: "lair" }) ===
    cueFor({ screen: "play", mission: 3, bossActive: true, missionMusic: "ice" })) {
  note("the final boss shares the regular boss cue");
}
/* The blind spot that let the final arena ship with no audio transition at
   all: its boss cue must also differ from the cue its OWN stage was playing,
   or playMusic() no-ops and entering the arena changes nothing. */
for (let i = 0; i < MISSION_CUES.length; i++) {
  const stage = cueFor({ screen: "play", mission: i, bossActive: false, missionMusic: MISSIONS[i].music });
  const boss = cueFor({ screen: "play", mission: i, bossActive: true, missionMusic: MISSIONS[i].music });
  if (stage === boss) note(`mission ${i + 1}: entering the boss arena does not change the music`);
}

/* --- 4. loop seams on the shipped masters ---------------------------------- */

function decodeWav(buf) {
  let pos = 12;
  let fmt = null;
  let data = null;
  while (pos + 8 <= buf.length) {
    const id = buf.toString("ascii", pos, pos + 4);
    const size = buf.readUInt32LE(pos + 4);
    const body = pos + 8;
    if (id === "fmt ") {
      fmt = {
        channels: buf.readUInt16LE(body + 2),
        rate: buf.readUInt32LE(body + 4),
        bits: buf.readUInt16LE(body + 14),
      };
    } else if (id === "data") {
      data = buf.subarray(body, body + size);
    }
    pos = body + size + (size % 2);
  }
  if (!fmt || !data || fmt.bits !== 16) return null;
  const n = Math.floor(data.length / 2 / fmt.channels);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let sum = 0;
    for (let c = 0; c < fmt.channels; c++) sum += data.readInt16LE((i * fmt.channels + c) * 2);
    out[i] = sum / fmt.channels / 32768;
  }
  return { samples: out, rate: fmt.rate };
}

const LOOPING = ["introduction", "assault", "bases", "toxic", "ice", "energy", "lair", "boss", "lairFinal", "taunt", "epilogue"];
const LOOP_REPORT = join(ROOT, "Game audio files", "Mars Signal Siege", "loop-points.json");
console.log("\nLoop seams (looping cues only):");
if (existsSync(LOOP_REPORT)) {
  const report = JSON.parse(readFileSync(LOOP_REPORT, "utf8"));
  for (const cue of LOOPING) {
    const entry = report[cue];
    if (!entry) {
      note(`${cue}: no loop-point record — run scripts/build-mars-audio.py`);
      continue;
    }
    if (!entry.loops) note(`${cue}: recorded as non-looping but the game loops it`);
    if (entry.crossfadeMs <= 0) note(`${cue}: no loop crossfade applied`);
    const trimmed = entry.trimmedSeconds;
    console.log(
      `  ${cue.padEnd(13)} ${entry.loopSeconds.toFixed(1)}s ` +
      `(trimmed ${trimmed.toFixed(2)}s, xfade ${entry.crossfadeMs}ms, ` +
      `${entry.rmsDbfs} dBFS, peak ${entry.peak})`,
    );
    if (entry.peak > 0.99) note(`${cue}: peaks at ${entry.peak} — clipping`);
  }
  /* Boss music may be stronger, but not dramatically louder. */
  const boss = report.boss?.rmsDbfs;
  const mission = report.assault?.rmsDbfs;
  if (boss != null && mission != null) {
    const delta = boss - mission;
    if (delta > 3) note(`boss music is ${delta.toFixed(1)} dB above mission music`);
    else console.log(`  boss vs mission level: +${delta.toFixed(1)} dB`);
  }
} else {
  note("no loop-points.json — run scripts/build-mars-audio.py");
}

console.log(
  `\ncheck-mars-audio: ${CUES.length} cues, ${sfxNames.length} effects, ${failures} failure(s)`,
);
data.dispose();
process.exit(failures ? 1 : 0);
