/* The award strip under the hero (A0).
 *
 * WHERE THESE COME FROM
 * `Website/Awards/`, outside this repo -- `Awards 2020-2026.zip` and the later
 * `Re_ Awards 2020-2026.zip`, which supersedes three of its files. That folder is
 * the source of truth for which awards the site claims: audited against it on
 * 27 Aug 2026, on Damian's instruction that anything in the folder appears here
 * and anything here that is not in the folder comes off.
 *
 * The artwork in `public/awards/` is each source file resized to 168px tall --
 * twice the 84px the strip renders at, so it stays sharp on a 2x display and
 * nothing bigger ships. The sources run to 2886px square and 484 KB; unresized,
 * this strip would be several megabytes directly under the hero.
 *
 * ── EVERY FILE IN THAT FOLDER IS NOW ON THE PAGE ────────────────────────
 *
 * There is no longer any gap between the folder and this list. Three of the
 * fifteen took an extra step to get here, and it is worth recording which:
 *
 *   ISE 2020, Installation and AV Technology
 *       `Awards 2020-2026.zip` carries these only as ISE_Awards_2020_AV_Tech.ai
 *       and ISE_Awards_2020_Installation.ai -- Illustrator sources, not web
 *       images, and nothing in this build environment rasterises .ai. For a while
 *       the two were simply absent from the page for that reason.
 *       `Re_ Awards 2020-2026.zip` supplies both as PNG, and that is what ships.
 *
 *       The two marks share a template and differ only in the award name set
 *       across the middle, so they read as one file duplicated. They are not --
 *       the pixels differ -- and on the page the alt text is the only thing that
 *       tells them apart. Do not "deduplicate" them.
 *
 *   InfoComm 2026
 *       The copy in `Awards 2020-2026.zip` is RGB with its transparency
 *       flattened onto white: pure white artwork on a pure white ground, no dark
 *       pixel anywhere in the file, so it renders as an empty rectangle. The
 *       badge used to be served from public/logos/ to avoid exactly that. The
 *       copy in `Re_ Awards 2020-2026.zip` has its alpha intact, so it now sits
 *       in public/awards/ with the other fourteen and the strip no longer
 *       depends on the logos copy.
 *
 * ── THE STRIP IS WHITE ARTWORK, AND `src` POINTS AT mono/ ──────────────────
 * Every badge but one is served from `public/awards/mono/`: the same mark with
 * its colour taken out, white on a transparent ground (Matt, 27 Aug 2026).
 *
 * It used to be the other way round. `.mq img` put each colour mark on a white
 * plate, because they are all drawn for white backgrounds, and the InfoComm 2026
 * mark was the single exception -- white artwork, opted out of the plate with a
 * `plain` flag. Fifteen plates on a dark band read as fifteen bright rectangles
 * with something in them; the plate was the thing the eye caught and the badge
 * inside it was incidental, while the one unplated badge looked like the mistake
 * rather than the model. So the exception became the rule: no plate on anything,
 * and the roster converted to match the 2026 mark.
 *
 * THE COLOUR ORIGINALS STAY IN `public/awards/` AND ARE NOT REFERENCED HERE.
 * They are the input to the conversion, so they are kept deliberately -- but
 * nothing renders them, so a change to one shows up nowhere until
 * `scripts/awards-mono.py` is rerun. That script is the only thing that should
 * ever write into mono/; it carries the per-file reasoning for how each mark was
 * converted, and `--check` reports any output older than its source.
 *
 * THE ONE THAT IS NOT IN mono/. The InfoComm 2026 mark is already white artwork
 * on a transparent ground -- it is what the other fourteen were made to match --
 * so it is still served from `public/awards/` untouched. Copying it into mono/
 * for the sake of a tidy path would put the same picture in the repo twice, and
 * the second copy is the one that goes stale.
 *
 * Dimensions are the intrinsic pixel size of the file, given so the row reserves
 * its space before the images decode rather than jolting the page under them.
 * InfoComm 2025 / SCN is the one whose dimensions changed with the conversion:
 * it shipped as a badge sitting on a stock photograph, no threshold turns a
 * photograph into line art, so the badge is cropped out of it and the tile is
 * portrait rather than landscape now.
 */
export interface Award {
  /** Rooted path, rewritten under BASE_PATH by scripts/rebase-html.mjs. */
  src: string;
  alt: string;
  w: number;
  h: number;
}

/** Newest first, then the undated marks. */
export const AWARDS: Award[] = [
  {
    // Not mono/ -- this is the mark the rest were converted to match. See above.
    src: "/awards/infocomm-2026-best-of-show.png",
    alt: "AVTechnology Best of Show winner, InfoComm 2026",
    w: 168,
    h: 168,
  },
  {
    src: "/awards/mono/infocomm-2025-avtech-best-in-show.png",
    alt: "AVTechnology Best in Show, InfoComm 2025",
    w: 322,
    h: 168,
  },
  {
    // Cropped out of its photograph, so this one is portrait -- see above.
    src: "/awards/mono/infocomm-2025-scn-installation-product.png",
    alt: "SCN Installation Product Award, InfoComm 2025",
    w: 127,
    h: 168,
  },
  {
    src: "/awards/mono/ise-2025-tnt-winner.png",
    alt: "Tech & Learning TNT ISE 2025 winner",
    w: 183,
    h: 168,
  },
  {
    src: "/awards/mono/ise-2021-tnt-winner.png",
    alt: "TNT ISE 2021 winner",
    w: 184,
    h: 168,
  },
  {
    src: "/awards/mono/ise-2020-installation-award.png",
    alt: "Installation Award winner, ISE 2020",
    w: 203,
    h: 168,
  },
  {
    src: "/awards/mono/ise-2020-av-technology-award.png",
    alt: "AV Technology Award winner, ISE 2020",
    w: 203,
    h: 168,
  },
  {
    src: "/awards/mono/infocomm-2020-award.png",
    alt: "InfoComm 2020 award",
    w: 334,
    h: 168,
  },
  {
    src: "/awards/mono/av-technology-2020-award.png",
    alt: "AV Technology award, 2020",
    w: 448,
    h: 168,
  },
  {
    src: "/awards/mono/scn-install-of-the-year-2020.png",
    alt: "SCN Install of the Year, 2020",
    w: 228,
    h: 168,
  },
  {
    src: "/awards/mono/deloitte-technology-fast-500-2020.png",
    alt: "Deloitte Technology Fast 500, 2020",
    w: 168,
    h: 168,
  },
  {
    src: "/awards/mono/scn-award-winner.png",
    alt: "SCN award winner",
    w: 165,
    h: 168,
  },
  {
    src: "/awards/mono/proav-power-20.png",
    alt: "ProAV Power 20 award",
    w: 425,
    h: 168,
  },
  {
    src: "/awards/mono/smartbrief-award.png",
    alt: "SmartBrief award",
    w: 177,
    h: 168,
  },
  {
    src: "/awards/mono/cio-education-tech-provider.png",
    alt: "CIO education technology provider award",
    w: 126,
    h: 168,
  },
];
