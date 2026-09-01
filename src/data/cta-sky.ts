/* Constellations for the closing band — real ones, no joining lines.
 *
 * Positions come from the HYG database v4.1 (astronexus/HYG-Database; see the
 * open-source page and the local "Star catalogues" folder). Each figure's stars
 * were looked up by Bayer designation, projected onto a tangent plane about the
 * figure's own centre — gnomonic, north up, east left, the way a sky chart is
 * drawn — and expressed as pixel offsets from the group's centre.
 *
 * Pixels, not percentages, and that is the point: the band is roughly five
 * times wider than it is tall, so a shape laid out in percent would be stretched
 * into something that is no longer the Big Dipper. The group is placed in
 * percent; the stars inside it are placed in pixels.
 *
 * Each group is one parallax layer, so a constellation drifts as a single rigid
 * object. Split a figure across layers and it shears apart as you scroll.
 *
 * No lines here on purpose. At this size the dots carry the shape, and the
 * hairline links belong to the pages that make a feature of them: the hero and
 * the 404 chart.
 */

export interface BandFigure {
  /** IAU abbreviation, for the comment trail back to the catalogue */
  k: string;
  /** Where the figure's centre sits in the band, as percentages */
  at: [number, number];
  /**
   * Where it sits on a phone, as percentages.
   *
   * These used to be three `[data-fig]` overrides in the mobile block of
   * global.css. They moved here when the band's sky started turning, and the
   * reason is Polaris: the rotation is centred on the pole star, and the pole
   * star's position is derived from `UMi.at` plus its own offset below. With the
   * phone placement in a stylesheet and the desktop placement here, the two
   * disagreed under 640px — the sky went on turning about a point the star was
   * no longer at, so the one star that must never move was the one that moved
   * furthest. One source, both breakpoints.
   */
  sm: [number, number];
  /** Parallax layer, 1 (far, slow) to 3 (near, fast) */
  d: 1 | 2 | 3;
  /** [dx px, dy px, visual magnitude] from the figure's centre */
  s: [number, number, number][];
  /**
   * Optional joining lines, as index pairs into `s`.
   *
   * The header above says "no lines here on purpose", and that still holds for
   * the two figures that are scenery. Ursa Minor is not scenery: it is the
   * figure the band turns about, it carries the company's star, and at this size
   * seven dots of the right brightness are a scatter rather than the Little
   * Dipper. The lines are what make it read as the constellation it is.
   *
   * Index pairs rather than coordinates so the topology cannot drift away from
   * the positions: move a star in `s` and its lines follow.
   */
  ln?: [number, number][];
}

/**
 * Phones scale every figure by this. The desktop placement assumes copy in a
 * centre column with clear space either side; at 360px there are no sides, only
 * corners, and the band is barely wider than the Big Dipper.
 */
export const BAND_SM_SCALE = 0.62;

/**
 * The rotating field's box, in percentages of the band — wider than the band and
 * far taller.
 *
 * The band is roughly six times wider than it is tall, so a field the size of
 * the band would empty at the corners the moment it turned: a star 750px from
 * Polaris swings about 80px through the full sweep, which is a third of the
 * band's height. The field is generated across this larger box instead and the
 * band shows the part of it that happens to be in frame. Rather more than half
 * of the stars are outside the band at rest, and that is the price of the sky
 * being a sky rather than a decal.
 *
 * Sized for the desktop band (~1164 x 190) with BAND_SWING, which is the binding
 * case: a phone band is nearly square, so its farthest corner is a third of the
 * distance from Polaris and needs a third of the margin.
 */
export const BAND_FIELD = { x0: -9, x1: 109, y0: -48, y1: 148 };

/**
 * How far the sky turns either side of rest, in degrees, and how long one sweep
 * takes.
 *
 * It oscillates rather than revolving, and the reason is coverage: a full
 * revolution puts every point at every angle, so BAND_FIELD would have to be a
 * disc with a radius reaching the far corner — about four times the area, four
 * times the stars, in markup that ships on 119 pages. Three degrees each way is
 * indistinguishable from a slow rotation over any time anyone looks at a page
 * footer, and the reversal happens at the ends of an ease, where the sky is
 * already still.
 *
 * THE SWEEP IS A VELOCITY, AND THAT IS THE ONLY THING TO REASON ABOUT HERE.
 * The angle is fixed by coverage, so the duration alone decides whether anyone
 * can tell the sky is moving. Work it out in pixels per second at the far end of
 * the band, not in degrees: Polaris sits about 420px along a ~1164px band, so
 * the farthest corner is ~755px from the axis and travels 2 * 755 * sin(SWING)
 * — about 79px — over one sweep.
 *
 * The three numbers this has been through, at the far corner and averaged over
 * the stars actually in frame:
 *
 *     360s   0.22 px/s   0.09 px/s   indistinguishable from a still image
 *      60s   1.3  px/s   0.5  px/s   visible, but only if you look for it
 *      20s   4.0  px/s   1.6  px/s   reads as motion on arrival
 *
 * 360s was running correctly and looked stopped: a fifth of a pixel per second is
 * below the threshold at which anything registers as movement. Each step since
 * has been asked for, and 20s is where the sky is unambiguously turning without a
 * reader having to hunt for it.
 *
 * WHERE THE CEILING IS, if this is ever asked for again. The oscillation reads as
 * rotation only for as long as nobody watches a reversal, and at 20s the round
 * trip is 40 seconds — about the limit of what a page footer gets looked at. Past
 * this the honest fix is not a shorter sweep but a real revolution, and that
 * means BAND_FIELD becomes a disc of radius ~755px: eight times the area, eight
 * times the stars, ~50KB of markup per page on 119 pages. It also puts the Big
 * Dipper upside down twice per turn, which is astronomically correct and almost
 * certainly not what anyone wants closing a page.
 *
 * Do not raise SWING to make it more visible. The angle is what BAND_FIELD is
 * sized against, so a wider swing empties the band's corners as it turns; the
 * duration costs nothing.
 */
export const BAND_SWING = 3;
export const BAND_SWEEP = 20;

export const BAND_FIGURES: BandFigure[] = [
  /* Ursa Major, the Big Dipper — Dubhe, Merak, Phecda, Megrez, Alioth, Mizar,
     Alkaid. 168x78px: wide and flat, which is the right shape for a band. */
  {
    k: "UMa",
    at: [80, 26],
    sm: [20, 16],
    d: 3,
    s: [
      [72, -39, 1.81],
      [84, -4, 2.34],
      [38, 23, 2.41],
      [16, 2, 3.32],
      [-20, 7, 1.76],
      [-49, 9, 2.23],
      [-84, 39, 1.85],
    ],
  },
  /* Ursa Minor — Polaris at the end of the handle, then the bowl. The one
     figure on this site that has to be here.
     ── TURNED A QUARTER TURN, AND SCALED, IN THE DATA ─────────────────────────
     Every offset below is the catalogue projection rotated 90 degrees
     counter-clockwise, (x, y) -> (y, -x) in screen axes, then multiplied by 2.2.
     The rotation turns a 40x96 upright figure into a 96x40 one and the scale
     takes that to 212x88, which is a shape a 190px-tall band can hold and which
     puts Polaris at the far LEFT, where the handle now points.

     WHY THE NUMBERS AND NOT A CSS TRANSFORM. bandPolaris() derives --pol-x and
     --pol-y from `at` plus this star's own offset, and two things read them: the
     axis the whole sky rotates about, and the easter-egg click target. A
     transform on the group would move the drawing and leave both of those where
     the old numbers put them — so the sky would wheel about a point the star is
     no longer at, and the target would sit next to Polaris rather than on it.
     Rotating the data keeps all three derived from one source. Scaling the
     offsets spreads the figure without inflating the stars, which is correct:
     stars are points, only their separations have a scale.

     Placed in the clear band to the LEFT of the centred .note ("Hardware trials
     ship for every product…"), which is 62ch and therefore occupies roughly the
     middle third. 16% centres the figure in that left gap and its 212px is about
     half the gap's width, per Damian 24 Aug 2026. */
  {
    k: "UMi",
    at: [16, 50],
    sm: [50, 84],
    d: 1,
    s: [
      /* 0 Polaris (alpha) 1.97 - the end of the handle, and the pole */
      [-106, -44, 1.97],
      /* 1 Yildun (delta) 4.35 */
      [-70, -13, 4.35],
      /* 2 epsilon 4.21 */
      [-24, 15, 4.21],
      /* 3 zeta 4.29 - where the handle meets the bowl */
      [33, 13, 4.29],
      /* 4 eta 4.95 */
      [44, 44, 4.95],
      /* 5 Pherkad (gamma) 3.00 */
      [106, 20, 3.0],
      /* 6 Kochab (beta) 2.07 */
      [86, -11, 2.07],
    ],
    /* Handle Polaris-delta-epsilon-zeta, then the bowl closed
       zeta-eta-Pherkad-Kochab-zeta. The two Guardians of the Pole, Kochab and
       Pherkad, are the outer pair of the bowl. */
    ln: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 5],
      [5, 6],
      [6, 3],
    ],
  },
  /* Cassiopeia, the W — Caph, Schedar, gamma, Ruchbah, Segin. 118x72px. */
  {
    k: "Cas",
    at: [84, 72],
    sm: [84, 14],
    d: 2,
    s: [
      [59, 6, 2.28],
      [23, 36, 2.24],
      [2, -2, 2.15],
      [-32, 1, 2.66],
      [-59, -36, 3.35],
    ],
  },
];
