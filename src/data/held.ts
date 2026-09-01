/* HELD PAGES — routes that exist in the build but may not be discoverable yet.
 *
 * WHY THIS FILE EXISTS
 * Ruled by Damian Blazy 13 and 14 Aug 2026: /solutions/government may not release
 * until private-cloud deployment ships, because its Architecture section describes
 * an on-premises and air-gapped posture Polaris does not have. Until today that
 * hold lived in two places — a [BLOCKED:] note in the page body and a sentence in
 * a chat log — and neither of those stops the page being crawled, linked, or
 * pulled into a sitemap on launch day by whoever is doing the launch.
 *
 * A page-body note is a message to the next editor. It is not a control.
 *
 * WHAT BEING HELD DOES
 *   - excluded from sitemap.xml
 *   - Disallow line in robots.txt, in both the preview and the public state
 *   - <meta name="robots" content="noindex, nofollow"> on that page specifically,
 *     independent of PUBLIC_NOINDEX, so the hold survives launch day
 *
 * WHAT IT DOES NOT DO
 * The page still builds and is still reachable by anyone with the URL. This is a
 * discoverability hold, not access control — same limit as robots.txt everywhere
 * else. If a page must not be readable at all, it has to come out of the build.
 *
 * ENFORCEMENT
 * scripts/check-blocked.py fails the build if a page carrying a [BLOCKED:] note is
 * absent from this list, or if a listed page turns up in the sitemap or ships
 * without its noindex tag. So the note in the body and the control in the build
 * cannot drift apart: adding one without the other is a build failure.
 *
 * RELEASING A PAGE
 * Delete its entry. The guard then requires the [BLOCKED:] notes to be gone from
 * the body too, which is the right order — the copy gets fixed, then the page
 * becomes discoverable, and neither can happen silently without the other.
 */
export const HELD: Record<string, string> = {
  /* Added 26 Aug 2026. The story is drafted and with Marriott for review, and
     the draft's own footer says nothing publishes without their written
     approval. The slot exists in src/data/cases.ts so the page can be built and
     filled in; this keeps it out of the sitemap, out of llms.txt and out of the
     index until it is approved. The customer's MARK is separately cleared and
     does appear on the home page -- two different permissions. */
  "resources/cases/marriott":
    "Drafted and with Marriott International for review. Publishes on their " +
    "written approval; see src/data/cases.ts, CaseStory.pending.",
  "solutions/government":
    "Ruled by Damian Blazy 13-14 Aug 2026. The Architecture section and the " +
    "Air-gapped estates card describe an on-premises and air-gapped posture that " +
    "does not exist: a pod cannot activate, license, configure, share or update " +
    "without Mersive's cloud. Release when private-cloud deployment ships, at " +
    "which point the compare-matrix row deleted on 13 Aug (F17.1) returns on the " +
    "same date.",
};

export const isHeld = (path: string): boolean =>
  Object.keys(HELD).includes(path.replace(/^\/|\/$/g, ""));
