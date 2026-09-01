/**
 * Rippling job-board client. Runs at build time only.
 *
 * Mersive posts its open roles in Rippling's ATS, and Rippling publishes them on
 * two unauthenticated, CORS-open endpoints. Nothing here needs a token, and no
 * token must ever be added: these are the same endpoints that back the public
 * job board at `ats.rippling.com/mersive-technologies/jobs`.
 *
 *   LIST    https://ats.rippling.com/api/v2/board/<slug>/jobs?page=&pageSize=
 *   DETAIL  https://api.rippling.com/platform/api/ats/v1/board/<slug>/jobs/<uuid>
 *
 * Why two endpoints, and not one
 * ------------------------------
 * The documented v1 list (`api.rippling.com/.../board/<slug>/jobs`) flattens each
 * location to a display string — "Remote (New York, New York, US)". The v2 list
 * returns the same roles with locations broken out into `city` / `state` /
 * `countryCode` / `workplaceType`, which is what a valid `JobPosting.jobLocation`
 * needs; parsing it back out of the label would be guesswork. So the roster comes
 * from v2, and the posting body from the documented v1 detail endpoint.
 *
 * v2 is undocumented. If it ever changes shape or disappears, `fetchRoster()`
 * fails soft — see `loadJobs()` — and the careers page falls back to sending
 * candidates straight to the Rippling board. It does not break the build.
 *
 * One role, many rows
 * -------------------
 * The list endpoint returns one row *per location*: a role open in two states
 * arrives twice, with the same `id`. Deduplicating by UUID while collecting the
 * locations is the whole job of `dedupe()`, and getting it wrong is what puts the
 * same posting on the page twice.
 *
 * Nothing about applying lives here. Every application, résumé, and EEOC answer
 * stays inside Rippling; we publish a link to `job.url` and collect nothing.
 */
import { sanitizeJobHtml, htmlToText } from "./sanitize-html";

/** The board slug behind ats.rippling.com/<slug>/jobs. */
const BOARD_SLUG = process.env.RIPPLING_BOARD_SLUG || "mersive-technologies";

const LIST_ENDPOINT = `https://ats.rippling.com/api/v2/board/${BOARD_SLUG}/jobs`;
const DETAIL_ENDPOINT = `https://api.rippling.com/platform/api/ats/v1/board/${BOARD_SLUG}/jobs`;

/** Public board, for the "see the listing at source" fallback links. */
export const JOB_BOARD_URL = `https://ats.rippling.com/${BOARD_SLUG}/jobs`;

const PAGE_SIZE = 100;
/** Backstop against a pagination contract change turning into an endless loop. */
const MAX_PAGES = 20;
const TIMEOUT_MS = 15_000;

/* ---------------------------------------------------------------- wire types */

interface WireLocation {
  name?: string | null;
  country?: string | null;
  countryCode?: string | null;
  state?: string | null;
  stateCode?: string | null;
  city?: string | null;
  workplaceType?: string | null;
}

interface WireListItem {
  id?: string | null;
  name?: string | null;
  url?: string | null;
  department?: { name?: string | null } | null;
  locations?: WireLocation[] | null;
}

interface WireListPage {
  items?: WireListItem[] | null;
  totalPages?: number | null;
}

interface WireDetail {
  uuid?: string | null;
  description?: { company?: string | null; role?: string | null } | null;
  department?: { name?: string | null; base_department?: string | null } | null;
  employmentType?: { id?: string | null; label?: string | null } | null;
  createdOn?: string | null;
  payRangeDetails?: unknown[] | null;
  unlistedFromSearch?: boolean | null;
}

/* -------------------------------------------------------------- public types */

export interface JobLocation {
  /** Rippling's display string, e.g. "Remote (New York, New York, US)". */
  label: string;
  city: string | null;
  state: string | null;
  stateCode: string | null;
  country: string | null;
  countryCode: string | null;
  /** `workplaceType: "REMOTE"` on the Rippling row. */
  remote: boolean;
}

export interface Job {
  uuid: string;
  /** URL segment under /careers/. Stable while the role's title is unchanged. */
  slug: string;
  name: string;
  /** The Rippling application URL. The only place a candidate can apply. */
  url: string;
  /** Department with Rippling's internal numeric prefix stripped. */
  department: string | null;
  /** The specific team from the detail endpoint, when it differs. */
  team: string | null;
  /** Every location this role is open in, deduplicated. */
  locations: JobLocation[];
  /** Human label, e.g. "Salaried, full-time". */
  employmentType: string | null;
  /** schema.org employmentType, e.g. "FULL_TIME". Null when unmapped. */
  employmentTypeSchema: string | null;
  /** ISO date the role was created in Rippling — a real `datePosted`. */
  postedOn: string | null;
  /** Sanitised "about Mersive" block. May be empty. */
  companyHtml: string;
  /** Sanitised role description. May be empty. */
  roleHtml: string;
  /** Flattened text of the role description, for meta descriptions and search. */
  summary: string;
}

export interface Roster {
  jobs: Job[];
  /**
   * False when the board could not be read at build time. Distinguishes "no
   * roles open" from "we could not tell", which the careers page says out loud
   * rather than showing an empty list as though it were the answer.
   */
  reachable: boolean;
}

/* ------------------------------------------------------------------ helpers */

/** Rippling prefixes departments with an internal ledger code: "26 - Revenue". */
const cleanDepartment = (value: string | null | undefined): string | null => {
  const cleaned = (value ?? "").replace(/^\s*\d+\s*[-–—]\s*/, "").trim();
  return cleaned || null;
};

/** Rippling employment types → the schema.org enumeration Google accepts. */
const EMPLOYMENT_TYPE_SCHEMA: Record<string, string> = {
  SALARIED_FT: "FULL_TIME",
  HOURLY_FT: "FULL_TIME",
  SALARIED_PT: "PART_TIME",
  HOURLY_PT: "PART_TIME",
  CONTRACTOR: "CONTRACTOR",
  TEMPORARY: "TEMPORARY",
  TEMP: "TEMPORARY",
  INTERN: "INTERN",
  INTERNSHIP: "INTERN",
  VOLUNTEER: "VOLUNTEER",
  PER_DIEM: "PER_DIEM",
};

export const slugify = (value: string): string =>
  value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");

/** One-line location summary for cards and search entries. */
export const locationLabel = (job: Job): string =>
  job.locations.map((l) => l.label).join(" · ") || "Location not stated";

async function getJson<T>(url: string, label: string): Promise<T | null> {
  /* One retry: a build should not lose the whole careers section to a single
     dropped connection, and the board is small enough that retrying is cheap. */
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const response = await fetch(url, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);
      return (await response.json()) as T;
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      if (attempt === 2) {
        console.warn(`[rippling] ${label} failed after 2 attempts: ${reason}`);
        return null;
      }
      console.warn(`[rippling] ${label} failed (${reason}); retrying once.`);
    }
  }
  return null;
}

/* -------------------------------------------------------------------- fetch */

function normaliseLocation(wire: WireLocation): JobLocation | null {
  const label = (wire.name ?? "").trim();
  const city = (wire.city ?? "").trim() || null;
  const state = (wire.state ?? "").trim() || null;
  const country = (wire.country ?? "").trim() || null;
  if (!label && !city && !state && !country) return null;

  return {
    label: label || [city, state, country].filter(Boolean).join(", "),
    city,
    state,
    stateCode: (wire.stateCode ?? "").trim() || null,
    country,
    countryCode: (wire.countryCode ?? "").trim().toUpperCase() || null,
    remote: (wire.workplaceType ?? "").toUpperCase() === "REMOTE",
  };
}

/** Every row on the board, across pages. Null when the board is unreachable. */
async function fetchRoster(): Promise<WireListItem[] | null> {
  const rows: WireListItem[] = [];

  for (let page = 0; page < MAX_PAGES; page++) {
    const url = `${LIST_ENDPOINT}?page=${page}&pageSize=${PAGE_SIZE}`;
    const body = await getJson<WireListPage>(url, `job list page ${page}`);
    /* A failure on page 0 means no roster at all; a failure part-way through
       would silently drop roles, so treat both as unreachable. */
    if (!body) return null;

    rows.push(...(body.items ?? []));

    const totalPages = Number(body.totalPages ?? 1);
    if (!Number.isFinite(totalPages) || page + 1 >= totalPages) break;
  }

  return rows;
}

/**
 * Collapses the list endpoint's one-row-per-location shape into one entry per
 * role, with every location attached. Locations are deduplicated by label, in
 * the order the board returned them.
 */
function dedupe(rows: WireListItem[]): Map<string, { row: WireListItem; locations: JobLocation[] }> {
  const byUuid = new Map<string, { row: WireListItem; locations: JobLocation[] }>();

  for (const row of rows) {
    const uuid = (row.id ?? "").trim();
    if (!uuid || !(row.name ?? "").trim() || !(row.url ?? "").trim()) continue;

    let entry = byUuid.get(uuid);
    if (!entry) {
      entry = { row, locations: [] };
      byUuid.set(uuid, entry);
    }

    for (const wire of row.locations ?? []) {
      const location = normaliseLocation(wire);
      if (location && !entry.locations.some((l) => l.label === location.label)) {
        entry.locations.push(location);
      }
    }
  }

  return byUuid;
}

/**
 * Reads the board and returns the published roles.
 *
 * Fails soft on purpose. A network blip, a Rippling outage, or a build on a
 * machine with no egress must not stop the site from building — the careers page
 * degrades to a link to the board instead. The warnings below are the signal
 * that it happened, so read the build log if the page comes out empty.
 */
export async function loadJobs(): Promise<Roster> {
  const rows = await fetchRoster();
  if (!rows) {
    console.warn(
      "[rippling] Could not read the job board. /careers will build with no roles " +
        "listed and will link to the Rippling board instead."
    );
    return { jobs: [], reachable: false };
  }

  const deduped = dedupe(rows);

  /* Sorted before slugs are assigned, so a title collision resolves to the same
     suffix on every build rather than swapping URLs between deploys. */
  const entries = [...deduped.entries()].sort(
    ([aUuid, a], [bUuid, b]) =>
      (a.row.name ?? "").localeCompare(b.row.name ?? "") || aUuid.localeCompare(bUuid)
  );

  const details = await Promise.all(
    entries.map(([uuid]) => getJson<WireDetail>(`${DETAIL_ENDPOINT}/${uuid}`, `job ${uuid}`))
  );

  const jobs: Job[] = [];
  const usedSlugs = new Set<string>();

  entries.forEach(([uuid, entry], index) => {
    const detail = details[index];

    /* A role hidden from search on Rippling's own board should not be surfaced
       on ours. Only an explicit `true` hides it — a missing detail response
       leaves the role listed, since the list endpoint published it. */
    if (detail?.unlistedFromSearch === true) return;

    const name = (entry.row.name ?? "").trim();

    /* Clean URLs are worth the collision handling: /careers/regional-sales-
       director-northeast reads better than one carrying a UUID fragment, and it
       survives a role being closed and reposted under a new UUID. */
    let slug = slugify(name) || `role-${uuid.slice(0, 8)}`;
    if (usedSlugs.has(slug)) {
      let n = 2;
      while (usedSlugs.has(`${slug}-${n}`)) n++;
      slug = `${slug}-${n}`;
    }
    usedSlugs.add(slug);

    const companyHtml = sanitizeJobHtml(detail?.description?.company);
    const roleHtml = sanitizeJobHtml(detail?.description?.role);
    const employmentLabel = (detail?.employmentType?.id ?? "").trim() || null;
    const employmentCode = (detail?.employmentType?.label ?? "").trim().toUpperCase();

    const created = detail?.createdOn ? new Date(detail.createdOn) : null;
    const postedOn =
      created && !Number.isNaN(created.getTime()) ? created.toISOString().slice(0, 10) : null;

    jobs.push({
      uuid,
      slug,
      name,
      url: (entry.row.url ?? "").trim(),
      /* The list endpoint carries the base department ("Revenue"); the detail
         endpoint carries the specific team ("Sales (RSDs)"). Group by the former,
         show the latter on the posting. */
      department:
        cleanDepartment(entry.row.department?.name) ??
        cleanDepartment(detail?.department?.base_department),
      team: cleanDepartment(detail?.department?.name),
      locations: entry.locations,
      employmentType: employmentLabel,
      employmentTypeSchema: EMPLOYMENT_TYPE_SCHEMA[employmentCode] ?? null,
      postedOn,
      companyHtml,
      roleHtml,
      /* `company` before `role`: despite the field names, HR uses the company
         block for the posting's lead-in ("The Opportunity… Who are we?") and the
         role block for responsibilities and qualifications. Taking the summary
         from `role` starts it mid-way through a bullet list. */
      summary: htmlToText([companyHtml, roleHtml].filter(Boolean).join(" ")),
    });
  });

  const missing = details.filter((d) => d === null).length;
  if (missing) {
    console.warn(
      `[rippling] ${missing} of ${entries.length} job descriptions could not be read; ` +
        "those postings will list without a description."
    );
  }
  console.log(`[rippling] ${jobs.length} open role(s) from board "${BOARD_SLUG}".`);

  return { jobs, reachable: true };
}
