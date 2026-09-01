/* Primary navigation tree.
   Extracted verbatim from the v1.95 single-file POC. */

import type { NIC } from "./icons";

/**
 * A dropdown row: `[route, label, indent?]`.
 *
 * Routes starting with `_` are structural rather than navigable:
 *   `_grp`     group heading      `_grpA:<route>`  group heading that links
 *   `_hr`      divider rule       `_bkt` / `_bktend`  bracketed sub-group
 *
 * A route that is an absolute `http(s)://` URL leaves the site: it renders as a
 * plain outbound link and is deliberately absent from `ROUTES`, so it never gets
 * a page, a review page ID, or a search-index entry.
 */
export type NavItem = [string, string, (0 | 1)?];

/** True for a nav row that points off-site rather than at one of our routes. */
export const isExternalRoute = (route: string): boolean => /^https?:\/\//.test(route);

/** The developer documentation site. A constant rather than a literal in the tree
 *  below, because an off-site row cannot be keyed by `Route` in `nav-icons.ts` and
 *  has to be matched by its URL — so the string is written once and imported by
 *  both, instead of being typed twice and drifting by a trailing slash. */
export const DOCS_URL = "https://documentation.mersive.com/";

export interface NavMenu {
  label: string;
  /** The glyph beside the label in the header bar. Keyed into `NIC` in
   *  `data/icons.ts`, which carries the drawings and the reasoning behind them.
   *  Typed against `NIC` rather than `string`, so a renamed icon is a `pnpm check`
   *  failure and not a menu that silently loses its mark. */
  icon: keyof typeof NIC;
  items: NavItem[];
}

export const NAV: NavMenu[] = [
  {label:"Platform", icon:"globe", items:[
    ["platform/how","How Polaris collaboration works"],
    ["platform/workspace","The workspace: every share, side by side"],
    ["platform/taxonomy","Polaris Hybrid: where meetings live"],
    ["platform/cross-network","Cross-network sharing"],
    ["platform/security","Security & Trust Center"],
    ["platform/cloud","Polaris Cloud"],
    ["platform/tco","TCO calculator: the 10-year platform"],
    ["platform/lineage","The platform story: Sol to Polaris"]
  ]},
  {label:"Products", icon:"box", items:[
    ["_grpA:products/family","The Polaris Family"],
    /* Two collapsed headings rather than four flat group labels. "Add to a room"
       and "Software" split Link, Host, Route and Engage across two headings for
       four items; they read as one group to a buyer, so they are one. */
    ["_grp","Wireless collaboration"],
    ["products/pro","Polaris Pro",1],
    ["products/essentials","Polaris Essentials",1],
    ["products/launch","Polaris Launch · Q1 2027",1],
    ["_grp","Hybrid & Software"],
    ["products/hybrid","Hybrid meetings: Link & Host",1],
    ["products/route","Route · Q1 2027",1],
    ["products/engage","Engage · Q1 2027",1],
    ["_hr",""],
    ["_grpA:products/solstice","Mersive Solstice"],
    ["products/transition","Mersive Solstice Gen 3 → Polaris transition",1],
    ["_hr",""],
    ["products/selector","Which Polaris is right?"],
    ["trial","Start a trial"]
  ]},
  {label:"Solutions", icon:"bulb", items:[
    ["_grp","By use case"],
    /* Wireless collaboration leads: it is what every room does on day one, and
       hybrid is what some of those rooms add. */
    ["solutions/collab","Wireless collaboration"],
    ["solutions/hybrid","Hybrid conferencing"],
    ["solutions/signage","Digital signage"],
    /* A use case, not the product name: the buyer shops for the room type, and
       "active learning" is the category term they search. It points at Route. */
    ["products/route","Active learning rooms"],
    ["_hr",""],
    ["_grp","By industry"],
    /* Enterprise leads: it is the larger buyer and the one the corporate hub's own
       router now opens with. Creative sits below both because it is not a scale —
       it is a discipline whose content, not whose room count, sets the brief. */
    ["solutions/corporate","Corporate"],
    ["solutions/enterprise","Enterprise",1],
    ["solutions/smb","SMB & Mid-market",1],
    ["solutions/creative","Creative",1],
    ["solutions/education","Education"],
    ["solutions/k12","K-12",1],
    ["solutions/highered","Higher Education",1],
    ["solutions/regulated","Regulated Industries"],
    ["solutions/government","Government",1],
    ["solutions/healthcare","Healthcare",1],
    ["solutions/finance","Financial Services",1]
  ]},
  {label:"Compare", icon:"bars", items:[
    ["compare/hub","Compare hub: pick anyone"],
    ["compare/mtr","Why not a VTC room system?"],
    ["compare/dongles","vs Dongles"],
    ["_hr",""],
    ["platform/tco","TCO calculator: the 10-year platform"]
  ]},
  {label:"Resources", icon:"book", items:[
    /* Support & Documents is both a page and the heading its four documentation
       children hang off, so it is a `_grpA:` linking group heading with indented
       rows beneath it. The ticket portal is a Salesforce site, not a route. */
    ["_grpA:resources/support","Support & Documents"],
    ["https://mersive.my.site.com/support/s/login/?ec=302&startURL=%2Fsupport%2Fs%2F","Submit a ticket",1],
    ["resources/docs","Documentation hub",1],
    ["resources/downloads","Apps and downloads",1],
    ["resources/firmware","Firmware and release notes",1],
    ["resources/network","Network requirements",1],
    /* Off-site, and a ROOT row rather than a fifth child of Support & Documents:
       the developer documentation is its own destination, not one of our support
       pages. Sits here because documentation belongs next to documentation —
       moving it is one line. Its URL is a constant because `nav-icons.ts` has to
       name the same string to give the row its mark. */
    [DOCS_URL,"Developers"],
    ["resources/cases","Case studies"],
    ["resources/blog","Blog"],
    /* One row, not a heading with a child under it. "Work at Mersive" and the open
       roles were two pages; they are now one page at /careers, which is where the
       job postings already live. "Careers" is the label because that is the word
       someone scans a nav and a footer for — the page's own heading stays "Work at
       Mersive." */
    ["careers","Careers"],
    ["resources/ecosystem","Mersive Ecosystem"],
    ["_hr",""],
    ["resources/faq","FAQ"],
    ["resources/glossary","Glossary"],
    ["resources/opensource","Open source & licenses"],
    ["resources/who","Who we are"],
    ["contact","Contact us"]
  ]},
  {label:"Partners", icon:"rings", items:[
    ["partners/program","Partner program"],
    ["partners/become","Become a partner"],
    ["partners/portal","Partner portal (login)"],
    ["partners/where","Where to buy: partner directory"],
    ["_hr",""],
    ["how-to-buy","How to buy: trial, demo, or partner"],
    ["hub","Customer & Partner Hub"]
  ]}
];
