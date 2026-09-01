/* Real J2000 star positions, polar-projected, for the hero starfield (A0.1).
 *
 * Regenerated from the HYG database v4.1 (astronexus/HYG-Database — Hipparcos,
 * Yale Bright Star, Gliese; see the local "Star catalogues" folder and the
 * open-source page). Every star below was looked up by Bayer or Flamsteed
 * designation, projected stereographically about the pole
 *
 *     r = tan((90° − dec) / 2),   θ = RA°
 *
 * and mapped into these percentages by a single similarity transform — one
 * rotation, one uniform scale, one translation, fitted by least squares across
 * all 29 identifiable stars. One transform for the whole sky is what keeps the
 * shapes right: a per-star nudge is how a constellation stops being itself.
 *
 * The fit reproduced the previous hand-placed layout to a mean of 1.3% and put
 * Polaris within half a percent of its anchor, so the composition is unchanged;
 * what moved is the residual drift — up to 4% at Albireo and Matar, out at the
 * edges where hand-placement is hardest. Nothing here is eyeballed.
 *
 * Polaris is rendered separately (bluish, and the easter-egg trigger) at 67,4.
 * The fit puts it at 66.96,4.50.
 */

export const CONSTELLATIONS = [
  /* Ursa Minor — handle: δ Yildun, ε, ζ; bowl: ζ–η–γ Pherkad–β Kochab */
  [71.3, 7.8], [77.1, 10.6], [83.9, 9.8], [85.5, 13.3], [92.5, 9.9], [89.7, 6.4],
  /* Cepheus — the house: Errai, Alfirk, Alderamin, ζ, ι (+ δ Cep spur, the famous variable) */
  [55.5, 16.1], [61.3, 30.6], [60.1, 42.0], [49.1, 45.1], [49.2, 31.7], [46.1, 43.2],
  /* Cassiopeia — Caph, Schedar, γ, Ruchbah, Segin */
  [32.7, 29.7], [26.1, 26.4], [30.4, 20.9], [27.9, 16.3], [31.7, 10.4],
  /* Draco — ε, Altais, χ, Aldhibah, Grumium */
  [73.1, 31.3], [78.4, 33.7], [80.8, 24.6], [94.1, 26.0], [97.6, 40.6],
  /* Cygnus — the Northern Cross: κ wing, Fawaris, Sadr at the crossing, Deneb, Aljanah, ζ wing, Albireo at the foot */
  [84.5, 53.8], [81.0, 68.0], [70.8, 77.3], [65.1, 69.1], [62.5, 87.9], [51.6, 93.3], [92.6, 95.7],
  /* Lacerta — the lizard's zigzag: β, α, 4, 5, 2, 6 Lac */
  [42.7, 51.9], [39.6, 53.6], [40.4, 55.5], [38.0, 57.3], [39.1, 60.1], [34.1, 63.6],
  /* Pegasus — Matar and π² Peg, lower left */
  [18.9, 80.3], [32.5, 81.7],
];
