/* Icons on dropdown rows.
 *
 * A nav row whose route appears here renders a small glyph to the left of its
 * label. Everything else about the row is unchanged: the label still comes from
 * `NAV` in `nav.ts`, so this file never restates a nav label.
 *
 * Scope: the ROOT row of every menu. Thirty routes, listed in menu order below,
 * and the order here is kept in step with `nav.ts` by hand — it is documentation,
 * not something the code reads.
 *
 * Three consequences worth knowing before adding an entry:
 *
 *   - The indented children (Enterprise, K-12, the four support documents, the
 *     transition page) are deliberately unmarked, and that is the rule that keeps
 *     the marks worth having. Depth in a panel is the indent and the hairline
 *     rule; a mark on every row flattens the distinction between a category and
 *     the things inside it, and turns the panel into a column of glyphs.
 *   - Marking any row in a menu deepens that whole menu's nested indent, because
 *     the glyph pushes its parent's label right and a child at the usual indent
 *     would read as outdented from it. `SiteHeader` adds `.dropicons` to a panel
 *     with marks and `global.css` scopes the deeper indent to it, so this is
 *     automatic — but it is the panel's rhythm that moves, not one row's.
 *   - A route appearing in two menus gets the same mark in both, which is correct
 *     and is why this is keyed by route rather than by row. The TCO calculator is
 *     the only one today: it sits in Platform and again in Compare.
 *
 * Typed against `Route` rather than `string`, like `NAV_CARDS`, so a renamed or
 * mistyped route is a `pnpm check` failure and not a row that silently loses its
 * mark. The glyphs themselves, and the reasoning behind each one, are `SIC` in
 * `data/icons.ts` — including the near-misses, which are the useful part: most
 * of these were chosen against their neighbours in the same panel rather than in
 * isolation.
 */
import type { Route } from "./routes";
import type { SIC } from "./icons";
import { DOCS_URL, isExternalRoute } from "./nav";

export const NAV_ICONS: Partial<Record<Route, keyof typeof SIC>> = {
  /* Platform */
  "platform/how": "steps",
  "platform/workspace": "grid",
  "platform/taxonomy": "layers",
  "platform/cross-network": "bridge",
  "platform/security": "lock",
  "platform/cloud": "cloud",
  "platform/tco": "trend",
  "platform/lineage": "clock",

  /* Products. The three hardware rows are cards rather than text rows and carry
     a product photograph, which is a stronger mark than any glyph — see
     `nav-cards.ts`. They are not listed here for that reason, not by omission. */
  "products/family": "star",
  "products/solstice": "sun",
  "products/selector": "compass",
  trial: "play",

  /* Solutions — by use case, then by industry */
  "solutions/collab": "cast",
  "solutions/hybrid": "camera",
  "solutions/signage": "panel",
  "products/route": "nodes",
  "products/engage": "bubble",
  "solutions/corporate": "briefcase",
  "solutions/education": "cap",
  "solutions/regulated": "shield",

  /* Compare. `platform/tco` closes this menu too and is above. */
  "compare/hub": "versus",
  "compare/mtr": "forbid",
  "compare/dongles": "plug",

  /* Resources. Developers is off-site and lives in `NAV_ICONS_EXTERNAL` below;
     "Submit a ticket" is off-site too and is an indented child, so it has no mark
     for both reasons. */
  "resources/support": "doc",
  "resources/cases": "award",
  "resources/blog": "pen",
  careers: "person",
  "resources/ecosystem": "nodes",
  "resources/faq": "list",
  "resources/glossary": "list",
  "resources/opensource": "code",
  "resources/who": "people",
  contact: "envelope",

  /* Partners */
  "partners/program": "cert",
  "partners/become": "plusc",
  "partners/portal": "key",
  "partners/where": "pin",
  "how-to-buy": "cart",
  hub: "home"
};

/** Marks for OFF-SITE rows, keyed by absolute URL.
 *
 *  A second map rather than a looser type on the first. `NAV_ICONS` is
 *  `Partial<Record<Route, …>>` precisely so a mistyped route fails `pnpm check`,
 *  and widening it to `string` to fit two outbound URLs would trade that guard
 *  away for every internal row in the site. A URL cannot be validated by the type
 *  system either way, so it is written once as a constant in `nav.ts` and matched
 *  here by identity — that is what stops a trailing slash from quietly costing
 *  the row its mark.
 *
 *  "Submit a ticket" is deliberately absent: off-site is no bar to a mark, but it
 *  is an indented child, and children carry none. */
export const NAV_ICONS_EXTERNAL: Record<string, keyof typeof SIC> = {
  [DOCS_URL]: "terminal"
};

/** The mark for one nav row, from whichever map applies. The single entry point:
 *  callers pass the raw route or URL out of `NAV` and do not need to know that
 *  off-site rows are held separately. */
export const navIcon = (route: string): keyof typeof SIC | undefined =>
  isExternalRoute(route) ? NAV_ICONS_EXTERNAL[route] : NAV_ICONS[route as Route];

/** True when a menu carries at least one marked row, so the panel can take the
 *  deeper nested indent. Handles `_grpA:<route>` headings, which are the one
 *  structural marker that still names a real route. */
export const menuHasIcons = (items: readonly (readonly [string, string, (0 | 1)?])[]): boolean =>
  items.some(([p]) => Boolean(navIcon(p.startsWith("_grpA:") ? p.slice(6) : p)));
