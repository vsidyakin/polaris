/**
 * Generate the easter-egg music tracks with Stability AI.
 *
 * Reads the manifest in src/data/egg-music.ts, generates every track that has no
 * `generated` date yet, writes the audio into public/eggs/audio/, and prints the
 * manifest lines to paste back so the provenance is recorded in version control.
 *
 * Rules this follows, because a script that spends money has to be dull:
 *
 *   • NEVER RUNS IN THE BUILD. deploy.yml publishes every push to main; a paid
 *     API in that path bills on every commit. This is manual-only and is not
 *     referenced by `build`, `check` or any hook.
 *   • DRY RUN BY DEFAULT. It prints the request it would send and stops. Pass
 *     `--send` to actually call the API. The default cannot cost anything.
 *   • IDEMPOTENT. A track with a `generated` date, or whose file is already on
 *     disk, is skipped. Re-running costs nothing and cannot overwrite a track
 *     that has been reviewed and committed.
 *   • NEVER FATAL. A refused request, a timeout, a missing key: it reports and
 *     moves on to the next track. One bad prompt does not lose the batch.
 *   • ONE AT A TIME. No concurrency. This is six requests, not six hundred, and
 *     serial output is readable when something goes wrong.
 *
 * The key comes from STABILITY_API_KEY in the environment. It is never printed,
 * never written to a file, and never committed — the same handling AGENTS.md
 * requires for github_token.txt.
 *
 * Usage:
 *   node scripts/gen-egg-music.mjs                 # dry run, all pending tracks
 *   node scripts/gen-egg-music.mjs --pilot         # dry run, PILOT_TRACKS only
 *   node scripts/gen-egg-music.mjs --pilot --send  # generate the pilot for real
 *   node scripts/gen-egg-music.mjs --only=stack --send
 */
import { mkdir, writeFile, access, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = resolve(import.meta.dirname, "..");
/* Node imports the TypeScript manifest directly (type stripping, Node >=22.12),
   so there is no fragile text parser here and no duplicated work list. The
   pathToFileURL() is not optional: a bare absolute Windows path reaches the ESM
   loader as the scheme "c:" and is rejected. */
const { EGG_TRACKS, PILOT_TRACKS, TRACK_BUDGET_BYTES } = await import(
  pathToFileURL(resolve(ROOT, "src/data/egg-music.ts")).href
);

/* ---------------------------------------------------------------------------
   THE REQUEST SHAPE IS NOT YET VERIFIED AGAINST THE LIVE API.

   platform.stability.ai/docs/api-reference is a client-rendered app, so the
   schema could not be read at the time this was written. What IS confirmed:
   the sibling endpoint POST /v2beta/audio/stable-audio-2/audio-to-audio exists
   and takes a `strength` parameter, text-to-audio costs about 20 credits per
   call, and the duration ceiling is three minutes.

   Everything in this block is therefore a best reading and not a fact. Check it
   against the live docs, or run one `--send` on a single track, before trusting
   a batch to it. Field names are deliberately gathered here rather than spread
   through the code so correcting them is a one-place edit.

   `output_format: mp3` matters more than it looks: there is no ffmpeg on the
   machine this was written on, so asking the API for compressed audio avoids
   adding an encode dependency. If the API will not return mp3, the fallback is
   to request wav and install ffmpeg — not to ship 8 MB of wav.
   --------------------------------------------------------------------------- */
const API = {
  url: "https://api.stability.ai/v2beta/audio/stable-audio-2/text-to-audio",
  field: {
    prompt: "prompt",
    duration: "duration",
    seed: "seed",
    output: "output_format",
    steps: "steps",
  },
  output: "mp3",
  steps: 8,
  accept: "audio/*",
};

const TIMEOUT_MS = 180_000; // generation is slow; three minutes is not generous
const OUT_DIR = resolve(ROOT, "public/eggs/audio");

const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const only = (argv.find((a) => a.startsWith("--only=")) || "").slice(7);
const SEND = has("--send");

/* Pick the work list: pending tracks, optionally narrowed. "Pending" means no
   `generated` date — the same field the runtime uses to decide whether a track
   is fetchable, so the two can never disagree about what exists. */
let names = Object.keys(EGG_TRACKS).filter((n) => !EGG_TRACKS[n].generated);
if (has("--pilot")) names = names.filter((n) => PILOT_TRACKS.includes(n));
if (only) names = names.filter((n) => n === only);

const exists = (p) => access(p).then(() => true, () => false);

function summarise(name, t, seed) {
  console.log(`\n${name}`);
  console.log(`  POST   ${API.url}`);
  console.log(`  prompt ${t.prompt}`);
  console.log(`  ${API.field.duration}=${t.seconds}  ${API.field.seed}=${seed}  ` +
              `${API.field.output}=${API.output}  ${API.field.steps}=${API.steps}`);
  console.log(`  out    public/eggs/audio/${name}.mp3`);
}

async function generate(name, t, seed, key) {
  const dest = resolve(OUT_DIR, `${name}.mp3`);
  if (await exists(dest)) return { name, status: "skip", note: "file already on disk" };

  const form = new FormData();
  form.set(API.field.prompt, t.prompt);
  form.set(API.field.duration, String(t.seconds));
  form.set(API.field.seed, String(seed));
  form.set(API.field.output, API.output);
  form.set(API.field.steps, String(API.steps));

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(API.url, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, Accept: API.accept },
      body: form,
      signal: ac.signal,
    });
    if (!r.ok) {
      /* Surface the API's own error text — a 400 here is almost always a field
         name this script guessed wrong, and the body says which one. */
      const body = await r.text().catch(() => "");
      return { name, status: "fail", note: `HTTP ${r.status} ${body.slice(0, 300)}` };
    }
    const bytes = Buffer.from(await r.arrayBuffer());
    await mkdir(OUT_DIR, { recursive: true });
    await writeFile(dest, bytes);
    const { size } = await stat(dest);
    const over = size > TRACK_BUDGET_BYTES;
    return {
      name,
      status: "ok",
      seed,
      bytes: size,
      note: over
        ? `OVER BUDGET: ${(size / 1024).toFixed(0)} KB > ${(TRACK_BUDGET_BYTES / 1024).toFixed(0)} KB ` +
          `— shorten the loop rather than dropping the bitrate`
        : `${(size / 1024).toFixed(0)} KB`,
    };
  } catch (e) {
    return { name, status: "fail", note: e.name === "AbortError" ? "timed out" : String(e.message || e) };
  } finally {
    clearTimeout(timer);
  }
}

/* -------------------------------------------------------------------------- */

if (!names.length) {
  console.log("Nothing pending — every track in the manifest has a `generated` date.");
  process.exit(0);
}

const key = process.env.STABILITY_API_KEY;

console.log(`${names.length} track(s) pending: ${names.join(", ")}`);
if (!SEND) {
  console.log("\nDRY RUN — nothing will be sent and nothing will be spent.");
  console.log("Re-run with --send to generate. Verify the request shape first:");
  console.log("see the API block in this file, which is a best reading of the docs, not confirmed.");
}
if (SEND && !key) {
  console.error("\nSTABILITY_API_KEY is not set. Refusing to continue.");
  process.exit(1);
}

/* Seeds are derived from the track name, not random: a fixed seed is half of
   what makes a track reproducible, and Math.random() would make every re-run a
   different piece of music with the same prompt. */
const seedFor = (name) => {
  let h = 2166136261;
  for (const ch of name) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h) % 4294967295;
};

const results = [];
for (const name of names) {
  const t = EGG_TRACKS[name];
  const seed = seedFor(name);
  summarise(name, t, seed);
  if (!SEND) continue;
  const res = await generate(name, t, seed, key);
  console.log(`  ${res.status.toUpperCase()}  ${res.note || ""}`);
  results.push(res);
}

if (!SEND) process.exit(0);

const ok = results.filter((r) => r.status === "ok");
console.log(`\n${ok.length} generated, ${results.filter((r) => r.status === "fail").length} failed, ` +
            `${results.filter((r) => r.status === "skip").length} skipped`);

if (ok.length) {
  const today = new Date().toISOString().slice(0, 10);
  console.log("\nPaste these into src/data/egg-music.ts to record the provenance:\n");
  for (const r of ok) {
    console.log(`  ${r.name}: seed: ${r.seed}, generated: "${today}",`);
  }
  console.log("\nThen listen to each one before committing. A track without a");
  console.log("`generated` date is not fetched by the runtime, so nothing ships");
  console.log("until you add these lines deliberately.");
}
process.exit(results.some((r) => r.status === "fail") ? 1 : 0);
