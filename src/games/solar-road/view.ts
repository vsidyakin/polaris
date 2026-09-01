/* The logical canvas, 1280x720.
 *
 * Its own module because both the Phaser config in `index.ts` and the scene's
 * `renderSettings` need the numbers, and upstream read them back off
 * `this.sys.game.config` — which Phaser 4 types as `number | string`, since a
 * config may be given a CSS percentage. Declaring the pair once keeps the
 * projection maths on plain numbers and the two definitions from drifting.
 *
 * These are logical units, not pixels: Scale.FIT letterboxes them into whatever
 * box the overlay hands the game.
 */
export const VIEW = {
  W: 1280,
  H: 720,
} as const;

/**
 * The horizontal span the projection scales by — NOT the canvas width.
 *
 * This is the number that makes 16:9 a wider view rather than a stretched one,
 * and it is worth being precise about the difference.
 *
 * `project()` originally scaled x by the canvas width and y by the canvas
 * height, which is upstream's code and javascript-racer's before it. That is
 * fine at a fixed 4:3 and quietly wrong at any other ratio: widen the canvas and
 * the x multiplier grows while the y multiplier does not, so the world is
 * horizontally STRETCHED. The road gets wider on screen, the hills get flatter,
 * and nothing is actually revealed — you are looking at the same view through a
 * squashed lens.
 *
 * Tying the span to the height instead keeps the world's proportions square at
 * any canvas shape, so the extra pixels of a wide canvas are spent showing more
 * ground either side of the trail. Which is the point of going full-width.
 *
 * The 4/3 keeps the constant of proportionality the game was tuned at: at the
 * old 800x600 this expression is exactly 800, so every width, curve and camera
 * number in the game means what it meant before.
 */
export const PROJECT_SPAN = (VIEW.H * 4) / 3;
