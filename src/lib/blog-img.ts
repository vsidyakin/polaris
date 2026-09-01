/**
 * Which copy of a blog image to point at.
 *
 * `scripts/fetch-blog-images.mjs` self-hosts the set into public/blog/ before the
 * build. It is deliberately non-fatal, so at render time a file may or may not be
 * there: an offline runner, a 403 from a CDN, a post added since the last fetch.
 * This checks the filesystem once per path and returns the local copy if it landed
 * and the source URL if it did not — so a failed fetch degrades to exactly what the
 * source page did, rather than to a broken image.
 *
 * Build-time only. `node:fs` here is fine because these pages are pre-rendered and
 * nothing in this module reaches the browser.
 */
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { withBase } from "./base";

const PUBLIC = resolve(process.cwd(), "public");
const cache = new Map<string, boolean>();

function haveLocal(path: string): boolean {
  const hit = cache.get(path);
  if (hit !== undefined) return hit;
  const ok = existsSync(resolve(PUBLIC, path.replace(/^\//, "")));
  cache.set(path, ok);
  return ok;
}

/** The best available URL for one image, or "" when there is nothing to show. */
export function imgSrc(local?: string, remote?: string): string {
  if (local && haveLocal(local)) return withBase(local);
  return remote || "";
}

/**
 * The URL to name in structured data, which is not quite the URL to render.
 *
 * Same fallback as `imgSrc` and for the same reason — a build with no egress has
 * no local copy, and an `image` in the graph pointing at a file that 404s is worse
 * than naming the CDN the page is itself falling back to. The difference is that
 * this does NOT apply the base path: `articleSchema()` resolves a rooted path
 * against the production origin, and applying both would produce a URL with the
 * preview prefix inside a production URL.
 *
 * Returns undefined when there is no image at all, so the field is omitted rather
 * than emitted empty.
 */
export function imgForSchema(local?: string, remote?: string): string | undefined {
  if (local && haveLocal(local)) return local;
  return remote || undefined;
}

/** How many of a set are self-hosted — for the build log and the review note. */
export function selfHosted(paths: (string | undefined)[]): number {
  return paths.filter((p) => typeof p === "string" && p.length > 0 && haveLocal(p)).length;
}
