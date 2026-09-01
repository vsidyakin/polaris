/**
 * Self-host the blog imagery.
 *
 * The source page hotlinked 151 files across three hosts — Mersive's WordPress CDN,
 * sparkfive, and pexels.com. Hotlinking them would make our blog depend on someone
 * else's cache-control and someone else's uptime, so the build fetches them once
 * into public/blog/ and the pages point at our own copies.
 *
 * Rules this follows, because a build step that reaches the network has to be dull:
 *   • Idempotent. A file that already exists is skipped, so the second run does
 *     nothing and a normal build costs no requests.
 *   • Never fatal. A 404, a timeout, an offline runner: it logs and moves on. The
 *     pages check for the local file and fall back to the remote URL, so the worst
 *     case is the source's own behaviour rather than a broken image or a failed
 *     deploy.
 *   • Bounded. Six at a time with a 20s timeout each, and it refuses anything that
 *     is not an image or is over 12MB.
 *
 * The manifest is BLOG_IMAGES in src/data/blog.ts — generated with the posts,
 * so adding an article cannot leave its images behind.
 *
 * Usage: `node scripts/fetch-blog-images.mjs` (the `images` script in package.json).
 */
import { mkdir, writeFile, access } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { readFileSync } from "node:fs";

const ROOT = resolve(import.meta.dirname, "..");
const CONCURRENCY = 6;
const TIMEOUT_MS = 20_000;
const MAX_BYTES = 12 * 1024 * 1024;

/* Read the manifest out of the data module textually rather than importing it: this
   is a plain node script with no TypeScript loader, and the manifest is a literal. */
function manifest() {
  const src = readFileSync(resolve(ROOT, "src/data/blog.ts"), "utf8");
  const block = src.slice(src.indexOf("export const BLOG_IMAGES"));
  const list = block.slice(block.indexOf("["), block.indexOf("\n];"));
  return [...list.matchAll(/\[\s*"([^"]+)"\s*,\s*"([^"]+)"\s*\]/g)].map((m) => ({
    path: m[1],
    url: m[2],
  }));
}

const exists = (p) =>
  access(p).then(
    () => true,
    () => false
  );

async function one({ path, url }) {
  const dest = resolve(ROOT, "public" + path);
  if (await exists(dest)) return "skip";
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: ac.signal,
      redirect: "follow",
      headers: {
        /* Some CDNs serve a 403 to a bare client. This is our own content and a
           normal browser UA is what they expect to see. */
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36",
        accept: "image/avif,image/webp,image/*,*/*;q=0.8",
      },
    });
    if (!res.ok) return `fail ${res.status}`;
    const type = res.headers.get("content-type") || "";
    if (!type.startsWith("image/")) return `fail not-an-image (${type.split(";")[0]})`;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength > MAX_BYTES) return `fail too-big (${buf.byteLength} bytes)`;
    if (buf.byteLength < 100) return `fail too-small (${buf.byteLength} bytes)`;
    await mkdir(dirname(dest), { recursive: true });
    await writeFile(dest, buf);
    return "got";
  } catch (err) {
    return `fail ${err?.name === "AbortError" ? "timeout" : err?.message || err}`;
  } finally {
    clearTimeout(timer);
  }
}

const items = manifest();
if (items.length === 0) {
  console.log("[blog-images] manifest is empty — nothing to do.");
  process.exit(0);
}

const tally = { got: 0, skip: 0, fail: 0 };
const failures = [];
let cursor = 0;
await Promise.all(
  Array.from({ length: Math.min(CONCURRENCY, items.length) }, async () => {
    while (cursor < items.length) {
      const item = items[cursor++];
      const out = await one(item);
      if (out === "got") tally.got++;
      else if (out === "skip") tally.skip++;
      else {
        tally.fail++;
        failures.push(`${item.path} <- ${item.url} (${out})`);
      }
    }
  })
);

console.log(
  `[blog-images] ${tally.got} fetched, ${tally.skip} already present, ${tally.fail} failed of ${items.length}.`
);
if (failures.length) {
  console.log("[blog-images] the pages will fall back to the source URL for:");
  for (const f of failures.slice(0, 20)) console.log("  -", f);
  if (failures.length > 20) console.log(`  … and ${failures.length - 20} more`);
}
/* Exit 0 whatever happened: a missing image must not stop a deploy. */
