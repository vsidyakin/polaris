/* By-lines for the long-form pages — the blog posts and the case studies.
 *
 * WHAT IS IN HERE, AND WHAT DELIBERATELY IS NOT
 *
 * Google's Article guidance wants a named author, ideally one with a profile page
 * behind the name, and an SEO requirement for this site asks for exactly that.
 * Nothing arrived with a by-line: the ported posts, the SEO drafts and the
 * thirteen case studies all carry a headline, a dek and a body, and nothing
 * about who wrote them.
 *
 * So the three names below are an assignment, not a recovered fact. Steve's
 * decision of 20 Aug 2026 attributed the fifteen SEO drafts to the person whose
 * subject each one fits, and those attributions are what `BlogPost.author` keys
 * into. The forty-one ported posts carry no key at all: mersive.com publishes no
 * by-lines and blocks its authors API, so they are the team's, and
 * `articleSchema()` names Mersive Technologies as the author — true, and a valid
 * schema.org author. A team is not a human being and is not published as one.
 *
 * `role`, `url` and `sameAs` are absent on every entry for the same reason the
 * whole file used to be empty: nobody has confirmed a title or a profile URL, and
 * a by-line is a claim about a real person. Fill them in from what marketing
 * confirms, not from what is plausible — an `url` that 404s is worse than a name
 * standing on its own.
 *
 * Adding an entry and putting its key in a post's `author` field in
 * data/blog.ts (or a story's in data/cases.ts) does three things at once: the
 * by-line appears on the page, the `author` in that page's JSON-LD becomes a
 * Person, and the Person carries whatever profile links the entry gives it. There
 * is nothing else to remember and no second surface to update.
 *
 * A NOTE ON PROFILE PAGES. `url` is where the name links to. There are no author
 * pages on this site yet; adding them is the full "work the whole list" routine in
 * CLAUDE.md (a route, a TITLES and DESC entry, a PAGE_TITLES entry), so until
 * somebody does that, point `url` at a real external profile — a LinkedIn page —
 * or leave it out. An `url` that 404s is worse than a name on its own.
 */

export interface Author {
  /** The name as it should appear in the by-line and in the graph. */
  name: string;
  /** Role, shown after the name on the page where there is room for it. */
  role?: string;
  /** Author profile page or canonical external profile. Omit rather than guess. */
  url?: string;
  /** Other profiles identifying the same person, for the `sameAs` array. */
  sameAs?: string[];
}

/**
 * Keyed by a short slug used in `BlogPost.author` and `CaseStory.author`.
 *
 * Shape of an entry, for whoever fills this in:
 *
 *     "jane-doe": {
 *       name: "Jane Doe",
 *       role: "Director of Product Marketing",
 *       url: "https://www.linkedin.com/in/jane-doe/",
 *     },
 */
export const AUTHORS: Partial<Record<string, Author>> = {
  /* Roles confirmed by Steve Long, 21 Aug 2026 — the named-person confirmation
     the note above asks for. `url` still waits for a confirmed profile. */
  "steve-long": { name: "Steve Long", role: "VP of Engineering" },
  "ryan-lee": { name: "Ryan Lee", role: "VP of Product" },
  "damian-blazy": { name: "Damian Blazy", role: "CEO" },
};

/** Resolves an author key, tolerating a key with no entry yet. */
export const lookupAuthor = (key?: string): Author | undefined =>
  key ? AUTHORS[key] : undefined;
