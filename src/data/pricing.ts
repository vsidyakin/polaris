/* Published MSRP, as numbers rather than as pre-formatted strings.
 *
 * Why this file exists: the same eleven figures were typed out three times in
 * `lib/blocks.ts` — once in the headline price, once in the per-tier table and
 * once in the family table — and the Pro pricing calculator needs them a fourth
 * time, as arithmetic rather than as text. Four copies of a price is four
 * chances for one of them to be updated and the others not, which is the exact
 * failure "import the constant; never retype the value" in CLAUDE.md exists to
 * stop. Every price surface on the site now formats from these numbers.
 *
 * These are MSRP, effective 2026, and their published presentation is still
 * pending legal review — the note under the calculator says so, and should stay
 * until it isn't. The figures themselves are not ruled facts in the
 * `rulings.ts` sense: no source document contradicts another about them. If one
 * ever does, the ruling goes there and this file follows it.
 *
 * The three-value `Money` type is the whole design. A price that is not
 * published must never round-trip through 0 or through "": "request" renders as
 * "On request" and null renders as an em dash, and neither can be multiplied by
 * a room count by accident, because `typeof v === "number"` is the only gate
 * that lets arithmetic happen.
 */

/** A published figure, a price we quote on request, or a cell that has no value. */
export type Money = number | "request" | null;

export type Industry = "corp" | "edu";

/** "3" and "5" are subscription terms in years; "p" is the perpetual licence. */
export type Term = "3" | "5" | "p";

export type PriceShape = {
  /** Billed upfront, per room, for the whole term. */
  upfront: Money;
  /** Annual renewal, per room, after the term ends. null on perpetual. */
  renew: Money;
};

export type TierPricing = Record<Industry, Record<Term, PriceShape>>;

/** Years covered by the upfront payment. null on perpetual, which has no term. */
export const TERM_YEARS: Record<Term, number | null> = { "3": 3, "5": 5, p: null };

/* The upfront figure is the annual rate times the term, exactly: 599.88 x 3 =
   1799.64 and 479.88 x 5 = 2399.40. That is what lets the calculator show an
   effective per-room-per-year rate without inventing a number — it divides the
   published upfront by the term and lands on the published renewal rate. */
export const PRO: TierPricing = {
  corp: {
    "3": { upfront: 1799.64, renew: 599.88 },
    "5": { upfront: 2399.4, renew: 479.88 },
    p: { upfront: "request", renew: null },
  },
  edu: {
    "3": { upfront: "request", renew: "request" },
    "5": { upfront: "request", renew: "request" },
    p: { upfront: 2159.4, renew: null },
  },
};

export const ESSENTIALS: TierPricing = {
  corp: {
    "3": { upfront: 990, renew: 330 },
    "5": { upfront: 1199.4, renew: 239.88 },
    p: { upfront: "request", renew: null },
  },
  edu: {
    "3": { upfront: "request", renew: "request" },
    "5": { upfront: "request", renew: "request" },
    p: { upfront: 1199.4, renew: null },
  },
};

/** Launch is a one-time hardware purchase, so neither term nor renewal apply. */
export const ELEMENT: Record<Industry, number> = { corp: 450, edu: 250 };

export const PRICING: Record<"essentials" | "pro", TierPricing> = {
  essentials: ESSENTIALS,
  pro: PRO,
};

/** "$1,799.64" — always two decimal places, always grouped. */
export function usd(n: number): string {
  return (
    "$" +
    n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  );
}
