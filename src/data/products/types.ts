/**
 * The shape of a cinematic product page.
 *
 * /products/pro and /products/essentials were two 500-line files with the same
 * eleven sections in the same order; a tag-level diff of the two bodies came
 * back with four differences, all of them content. That page is now
 * layouts/ProductShowcase.astro, and this is the record it renders.
 *
 * Only what DIFFERS between the two pages is here. Copy that is identical on
 * both — the chip row, the security caveat, the "Open specs" heading, the
 * documentation kicker, the closing CTA — lives in the layout, because a string
 * held in one place cannot drift out of step with itself.
 *
 * Fields marked "HTML" are written into the page with set:html, so they may
 * carry entities and inline markup and MUST NOT be pre-escaped. Fields that are
 * plain text are escaped by Astro on the way out: write a literal "&", never
 * "&amp;".
 */

/** One capability card in the .capgrid. */
export interface ShowcaseCap {
  /** Column span out of 12 at the widest breakpoint; the pair should total 12. */
  w: number;
  /** Icon markup from data/icons. */
  ic: string;
  /** Card heading. Plain text — Astro escapes it, so write "&" not "&amp;". */
  h: string;
  /** Card copy. HTML. */
  p: string;
  href: string;
  /** Link label. Plain text. */
  cta: string;
}

/** One card in the security strip. */
export interface ShowcaseSecurity {
  ic: string;
  /** Assessment date, or the card's role where there is no date. Plain text. */
  when: string;
  /** Plain text. */
  h: string;
  /** HTML. Carries the [verify:] flags — keep them verbatim. */
  p: string;
}

/** One row of the pinned stage panel. */
export interface ShowcaseStageRow {
  /** Scroll position, 0–1 across the pinned track, at which the row arrives. */
  at: number;
  ic: string;
  /** Plain text. Full-depth spec wording — see SPEC_DETAIL_RULE in rulings.ts. */
  k: string;
  /** Plain text. */
  v: string;
}

/** One link in the documentation row. */
export interface ShowcaseDoc {
  ic: string;
  /** Plain text. */
  h: string;
  /** Plain text. Carries the [placeholder] flags — keep them verbatim. */
  p: string;
  href: string;
}

export interface ShowcaseData {
  /** Registry key. Drives SEO, the breadcrumb and the canonical. */
  route: "products/pro" | "products/essentials";

  hero: {
    /** Poster/first-fetch encode. A rooted literal — rebase-html.mjs prefixes it. */
    videoSrc: string;
    /**
     * The wide encode, upgraded to by initVideoHero() above 900px. Omit where
     * only one encode exists: the small file must be the markup `src`, because
     * that fetch is in flight before any script runs.
     */
    videoWideSrc?: string;
    /** <video aria-label>. */
    videoLabel: string;
    /** The H1, and the only H1 on the page. Plain text. */
    eyebrow: string;
    /**
     * Display lines of the title card, one mask each. The LAST line takes the
     * sheen — the payoff line is the one that shines.
     *
     * Keep each under ~18 characters and keep the list to three: .vh-copy is
     * 940px at a 92px cap, a line that wraps inside its own mask breaks the
     * stagger, and the nth-child delays in .vh-line run to three.
     */
    lines: string[];
    /** HTML. */
    dek: string;
    /** The spec sheet, reachable without scrolling. */
    specHref: string;
  };

  /**
   * The frame sequence for the pinned stage. `prefix` is derived from the last
   * segment of `dir`, which is how the files are named on disk.
   */
  zoom: {
    dir: string;
    count: number;
  };

  stage: {
    /** <section aria-label>, e.g. "Polaris Pro, up close". */
    ariaLabel: string;
    /** alt text on the first frame; the rest are decorative. */
    alt: string;
    /** Plain text. */
    eyebrow: string;
    /** Plain text. */
    title: string;
    rows: ShowcaseStageRow[];
  };

  /** The word-by-word headline. One sentence; the layout splits it. */
  headline: string;

  caps: {
    /** Plain text. */
    kicker: string;
    /** Plain text. */
    h2: string;
    /** HTML. Optional — Pro's grid has no standfirst. */
    sdek?: string;
    items: ShowcaseCap[];
  };

  security: {
    /** HTML. The two-sentence lead above the cards. */
    sdek: string;
    items: ShowcaseSecurity[];
  };

  /** Selects the price panel; no figure is typed anywhere on the page. */
  tier: "pro" | "essentials";

  specs: {
    /** HTML. The standfirst above the inline spec tables. */
    sdek: string;
    /** HTML. The notes below them. Carry the bracketed flags verbatim. */
    notes: string[];
  };

  docs: ShowcaseDoc[];
}

/** One card in the spec sheet's overview grid. */
export interface SpecOverviewCap {
  ic: string;
  /** HTML — written straight into the <h3>, so entities are literal. */
  h: string;
  /** HTML. */
  p: string;
}

/**
 * The shape of a printable spec sheet — /products/pro/spec and
 * /products/essentials/spec, rendered by layouts/SpecSheet.astro.
 *
 * Deliberately small. The masthead, the h1, the parent breadcrumb link and the
 * saved-from stamp are all derived by the layout from `tier` and `route`,
 * because each was a restatement of one of those two and a restatement is a
 * thing that can fall out of step.
 */
export interface SpecSheetData {
  route: "products/pro/spec" | "products/essentials/spec";
  /** Product name as it reads in prose, e.g. "Polaris Pro". Drives the h1, the
   *  masthead, the breadcrumb and the media band. */
  tier: string;
  /** HTML. The deck under the h1. */
  dek: string;
  overview: {
    /** HTML. */
    h2: string;
    /** HTML. */
    sdek: string;
    caps: SpecOverviewCap[];
  };
  /** HTML. Heading of the specifications section, e.g. "Polaris Pro hardware". */
  specsH2: string;
  /** HTML. The security section is one prose block on this page, not cards. */
  security: string;
}
