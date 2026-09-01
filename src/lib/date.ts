/* Dateline formatting for the long-form pages.
 *
 * Build-time only. Takes the ISO yyyy-mm-dd a post carries in its own record and
 * renders the form the dateline shows; the `datetime` attribute keeps the ISO
 * string, so a crawler reads the machine form and a person reads the other one.
 *
 * `timeZone: "UTC"` is load-bearing, not decoration. `new Date("2026-08-18")` is
 * parsed as UTC midnight, and formatting that in a timezone behind UTC prints the
 * 17th — so a build machine in Denver would date every post one day early. Pinning
 * the formatter to UTC makes the output the same everywhere, which also means the
 * date does not change depending on which machine ran the build.
 */

const FMT = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "long",
  day: "numeric",
  timeZone: "UTC",
});

/** "2026-08-18" -> "August 18, 2026". Returns null on anything unparseable. */
export function longDate(iso?: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : FMT.format(d);
}

const FMT_SHORT = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

/** "2026-08-18" -> "Aug 18, 2026". Same UTC pinning as longDate, same reason. */
export function shortDate(iso?: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : FMT_SHORT.format(d);
}
