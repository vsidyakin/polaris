/**
 * The open-roles roster, read from Rippling once per build.
 *
 * This is the only module that triggers the fetch. The top-level `await` runs
 * when the first page imports it and ESM caches the result, so a build with
 * thirty roles and thirty job pages still makes one pass over the board.
 *
 * It is build-time data like everything else in this directory — the difference
 * is that it comes off the network rather than out of a literal, so it can be
 * empty. `reachable` says which kind of empty it is; see `src/lib/rippling.ts`.
 * Nothing here ships to the browser.
 */
import { loadJobs, locationLabel, type Job } from "../lib/rippling";

export { JOB_BOARD_URL, locationLabel } from "../lib/rippling";
export type { Job, JobLocation } from "../lib/rippling";

const roster = await loadJobs();

/** Every published role, sorted by title. */
export const JOBS: Job[] = roster.jobs;

/** False when the board could not be read — not the same as "nothing is open". */
export const JOBS_REACHABLE: boolean = roster.reachable;

/** Roles grouped for the listing page, departments in alphabetical order. */
export const JOBS_BY_DEPARTMENT: { department: string; jobs: Job[] }[] = (() => {
  const groups = new Map<string, Job[]>();
  for (const job of JOBS) {
    /* Rippling allows a role with no department. "Other roles" keeps it on the
       page rather than dropping it out of the grouping. */
    const key = job.department ?? "Other roles";
    const bucket = groups.get(key);
    if (bucket) bucket.push(job);
    else groups.set(key, [job]);
  }
  return [...groups.entries()]
    .map(([department, jobs]) => ({ department, jobs }))
    .sort((a, b) => a.department.localeCompare(b.department));
})();

/** Lookup for the job-detail pages. */
export const jobBySlug = (slug: string): Job | undefined => JOBS.find((j) => j.slug === slug);

/** Site path for a role's posting. Base path is applied by the caller. */
export const jobPath = (job: Job): string => `/careers/${job.slug}`;

/**
 * "3 open roles" / "1 open role". The listing page and the Work at Mersive page
 * both state the count, and both should phrase it the same way.
 */
export const jobCountLabel = (count: number = JOBS.length): string =>
  `${count} open role${count === 1 ? "" : "s"}`;

/** One-line summary used in cards, search entries and meta descriptions. */
export const jobBlurb = (job: Job): string =>
  [job.employmentType, locationLabel(job)].filter(Boolean).join(" · ");

/** Opening of the posting, cut at a word boundary. Empty when there is no body. */
export function jobSnippet(job: Job, max = 190): string {
  const text = job.summary;
  if (!text) return "";
  if (text.length <= max) return text;
  return `${text.slice(0, max).replace(/\s+\S*$/, "")}…`;
}

/** "January 22, 2026" from the ISO date, or null when the feed carried none. */
export function jobPostedLabel(job: Job): string | null {
  if (!job.postedOn) return null;
  return new Date(`${job.postedOn}T00:00:00Z`).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}
