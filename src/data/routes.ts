/* The site's route registry.
   Order matters: it drives the review page-ID sequence (X-codes are assigned
   in declaration order for routes that never appear in the nav). */

import { NAV, isExternalRoute } from "./nav";
import { withBase } from "../lib/base";

/** Every route the site publishes, in the order the POC declared them. */
export const ROUTES = [
  "home",
  "platform/how",
  "platform/workspace",
  "platform/taxonomy",
  "platform/cross-network",
  "platform/security",
  "platform/cloud",
  "platform/tco",
  "platform/lineage",
  "products/family",
  "products/hybrid",
  "products/launch",
  "products/link",
  "products/host",
  "products/essentials",
  "products/essentials/spec",
  "products/pro",
  "products/pro/spec",
  "products/route",
  "products/engage",
  "products/selector",
  "products/solstice",
  "products/transition",
  "trial",
  "solutions/corporate",
  "solutions/smb",
  "solutions/enterprise",
  "solutions/creative",
  "solutions/education",
  "solutions/k12",
  "solutions/highered",
  "solutions/regulated",
  "solutions/government",
  "solutions/healthcare",
  "solutions/finance",
  "solutions/hybrid",
  "solutions/collab",
  "solutions/signage",
  "compare/hub",
  "compare/mtr",
  "compare/barco",
  "compare/airtame",
  "compare/dongles",
  "resources/support",
  "resources/docs",
  "resources/firmware",
  "resources/cases",
  "resources/blog",
  "resources/faq",
  "resources/glossary",
  "legal",
  "resources/network",
  "resources/downloads",
  "resources/opensource",
  "resources/who",
  /* The open-roles listing. Job pages live beneath it at /careers/<slug>, built
     from the Rippling board rather than declared here — see src/data/jobs.ts. */
  "careers",
  "resources/ecosystem",
  "partners/program",
  "partners/become",
  "partners/portal",
  "hub",
  "how-to-buy",
  "partners/where",
  "contact",
  "demo",
] as const;

export type Route = (typeof ROUTES)[number];

/** Legacy device-codename URLs that shipped in earlier POC builds. */
export const ALIASES: Record<string, string> = {
  "products/stick": "products/launch",
  "products/element": "products/launch",
  "products/toggle": "products/link",
  "products/tablet": "products/host",
};

/**
 * Pages kept in the build so the story is designed now, but excluded from the
 * initial launch (sell-today rule, CEO 8/2026).
 */
export const PRELAUNCH: Record<string, string> = {
  "products/route":
    "Route ships Q1 2027 and is not orderable until then. This page publishes with the release announcement, not at launch.",
  "products/engage":
    "Engage ships Q1 2027 [confirm date] and is not orderable until then. This page publishes with the release announcement, not at launch.",
  "products/launch": "Polaris Launch ships Q1 2027 and is not orderable until then. This page publishes with the release announcement.",
};

/**
 * Review page IDs (the pink chips). Nav menus get a letter each — B, C, D … —
 * and items are numbered within the menu; anything reachable only by link
 * falls through to an X-code.
 */
export const PAGE_IDS: Record<string, string> = (() => {
  const m: Record<string, string> = { home: "A0" };
  let letter = 66; // "B"
  for (const menu of NAV) {
    let n = 1;
    const l = String.fromCharCode(letter++);
    for (const item of menu.items) {
      const p = item[0] as string;
      /* Off-site rows (the support ticket portal) are navigation, not pages:
         they have no route, so they take no number in the sequence. */
      if (isExternalRoute(p)) continue;
      if (p.startsWith("_grpA:")) {
        const rp = p.slice(6);
        if (!m[rp]) m[rp] = l + n++;
        continue;
      }
      if (p.startsWith("_")) continue;
      if (!m[p]) m[p] = l + n++;
    }
  }
  let x = 1;
  for (const p of ROUTES) if (!m[p]) m[p] = "X" + x++;
  return m;
})();

/** Route -> site path. "home" is the site root. Base-prefixed for subpath deploys. */
export const href = (route: string): string => withBase(route === "home" ? "/" : `/${route}`);
