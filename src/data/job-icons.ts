/* Icons for the open-role cards.
   Kept out of icons.ts because that file is the POC set, extracted verbatim; the
   two location glyphs below are new and drawn to match it — 24px box, 1.7 stroke,
   #a58cff for the form and #7ce3a8 for the one detail that carries meaning.

   Role icons come from CNVIC, which already covers the shapes a job listing needs.
   Nothing here is decorative-only: the pair on a card tells you what kind of work
   it is and whether it is remote before you read the title. */
import { CNVIC } from "./icons";
import type { Job } from "../lib/rippling";

/** Somewhere on a map. */
const PIN = `<svg viewBox="0 0 24 24" fill="none" stroke="#a58cff" stroke-width="1.7"><path d="M12 21.2c4.1-4.7 6.3-8.1 6.3-10.8a6.3 6.3 0 10-12.6 0c0 2.7 2.2 6.1 6.3 10.8z" stroke-linejoin="round"/><circle cx="12" cy="10.3" r="2.5" stroke="#7ce3a8"/></svg>`;

/** Anywhere. */
const GLOBE = `<svg viewBox="0 0 24 24" fill="none" stroke="#a58cff" stroke-width="1.7"><circle cx="12" cy="12" r="8.6"/><path d="M3.4 12h17.2"/><path d="M12 3.4c2.9 3.3 2.9 13.9 0 17.2M12 3.4c-2.9 3.3-2.9 13.9 0 17.2" stroke="#7ce3a8" opacity=".9"/></svg>`;

export const LOCATION_ICON = { remote: GLOBE, onsite: PIN };

/**
 * Role → icon, first match wins, tested against the title, team and department
 * together.
 *
 * Order matters more than it looks. "Accounting" has to be caught before "sales"
 * gets a chance at "account", or every Accounts Payable role comes out as a sales
 * job; the same trap applies to "partner" (channel sales) versus "business
 * partner" (an HR title).
 */
const ROLE_ICONS: { icon: string; match: RegExp }[] = [
  { icon: CNVIC.people, match: /\b(people|human resources|hr business partner|recruit\w*|talent|hiring)\b/ },
  { icon: CNVIC.reg, match: /\b(financ\w*|account(?:ing|ant|s payable|s receivable)|controller|payroll|legal|counsel|complian\w*)\b/ },
  { icon: CNVIC.sales, match: /\b(sales|revenue|account (?:executive|manager|director)|channel|reseller|distribut\w*|partner\w*|business development|bdr|sdr|pre.?sales)\b/ },
  /* Support before engineering: "Technical Support Engineer" is a support role,
     and the engineering pattern would otherwise claim it on "Engineer" alone. */
  { icon: CNVIC.support, match: /\b(support|customer success|technical services|help ?desk|field service)\b/ },
  { icon: CNVIC.api, match: /\b(engineer\w*|developer|software|firmware|qa|quality assurance|sdet|devops|sre|architect|data scien\w*|machine learning)\b/ },
  { icon: CNVIC.mdf, match: /\b(marketing|demand gen\w*|brand|content|communications|growth|analyst|analytics)\b/ },
  { icon: CNVIC.collat, match: /\b(design\w*|ux|ui|creative|graphic|industrial design)\b/ },
  { icon: CNVIC.gear, match: /\b(product|program|project|operations|ops|manufactur\w*|supply chain|it\b|information technology)\b/ },
];

/** Fallback: a role tag. Reads as "a job" rather than as the wrong department. */
const DEFAULT_ROLE_ICON = CNVIC.tagp;

/** The icon for a role, chosen from its title, team and department. */
export function jobIcon(job: Job): string {
  const haystack = [job.name, job.team, job.department].filter(Boolean).join(" ").toLowerCase();
  return ROLE_ICONS.find((r) => r.match.test(haystack))?.icon ?? DEFAULT_ROLE_ICON;
}

/** Globe when any location is remote, pin otherwise. */
export const jobLocationIcon = (job: Job): string =>
  job.locations.some((l) => l.remote) ? LOCATION_ICON.remote : LOCATION_ICON.onsite;

/**
 * "Remote" / "Hybrid" / "On-site" — the shape of the arrangement rather than the
 * list of places, which the card shows separately.
 */
export function jobWorkplaceLabel(job: Job): string | null {
  if (!job.locations.length) return null;
  const remote = job.locations.filter((l) => l.remote).length;
  if (remote === job.locations.length) return "Remote";
  return remote ? "Hybrid" : "On-site";
}
