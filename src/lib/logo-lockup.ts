/** Equal-AREA logo lockup.
 *  A square badge and a long wordmark set to the same width do not read at the
 *  same weight, so this solves for a constant area instead, with square-ish
 *  marks given a little more of it, to keep them optically even. Ported from
 *  the source deck's own lockup maths — the one piece of that file worth
 *  keeping, because it is a measurement, not a style.
 *
 *  Parameterised so the same formula serves both sizes it's used at: the
 *  card badge (small) and the story-page hero mark (large) — previously two
 *  copies of this exact function at two different constants. */
export function lockup(
  aspect: number,
  opts: { maxW?: number; maxH?: number; area?: number } = {}
): { w: number; h: number } {
  const a = aspect || 3.5;
  const MAXW = opts.maxW ?? 132;
  const MAXH = opts.maxH ?? 46;
  const AREA = (opts.area ?? 2400) * (a < 1.6 ? 1.55 : 1);
  let w = Math.sqrt(AREA * a);
  let h = Math.sqrt(AREA / a);
  if (w > MAXW) {
    w = MAXW;
    h = AREA / w;
  }
  if (h > MAXH) {
    h = MAXH;
    w = Math.min(MAXW, AREA / h);
  }
  return { w: Math.round(w), h: Math.round(h) };
}
