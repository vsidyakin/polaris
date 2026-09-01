/* SOLAR CIRCUIT — segment rendering.
 *
 * A port of Phaser3-Road's `src/classes/renderHelpers.js`. Everything is drawn
 * into the scene's single `Graphics` object, which is cleared and refilled once
 * per frame: grass band, both rumble strips, the road quad, the lane markers,
 * then a fog wash whose alpha rises with distance.
 *
 * Two changes from upstream.
 *
 * The colours were written as strings ("0x72D7EE"). Phaser coerced them through
 * its bitwise maths and they happened to work; TypeScript will not accept a
 * string where a colour number belongs, and neither should a reader. They are
 * numbers now — a typing fix, not a behaviour one.
 *
 * The palette itself is Mercury rather than upstream's blue-sky-and-green-grass
 * afternoon. See the note on COLORS.
 */

import Phaser from "phaser";
import type { RoadScene } from "./game-scene";
import type { BoostPadSlice } from "./terrain";

/**
 * The colours a segment is painted with.
 *
 * The names are upstream's and the meanings have moved with the setting:
 * `road` is the swept bedrock of the driving line, `grass` is the loose
 * regolith either side, and `rumble` is the bank of broken rock where they
 * meet. They kept their names so this file still diffs against upstream.
 *
 * `lane` is the exception, and it is now never set by anything. Upstream put it
 * on the light segments only, which is what made the markings dash. Nothing on
 * Mercury paints lines on the ground, so `terrain.ts` leaves it off and the
 * marker block below never runs. The block itself stays: it is upstream's, it
 * is correct, and it is what you would restore to mark a line here.
 */
export interface RoadColor {
  road: number;
  grass: number;
  rumble: number;
  lane?: number;
}

export default class RoadRenderer {
  readonly scene: RoadScene;

  readonly COLORS: {
    SKY: number;
    FOG: number;
    LIGHT: RoadColor;
    DARK: RoadColor;
    START: RoadColor;
    FINISH: RoadColor;
  };

  /** Upstream's debug switch: draws every quad as a violet outline instead of
   *  filling it. Left in — it is the fastest way to see what the projection is
   *  actually doing when a segment renders wrong. */
  WIREFRAME = false;

  constructor(scene: RoadScene) {
    this.scene = scene;

    /* --- Mercury ------------------------------------------------------------
     * Upstream's palette is a summer afternoon: cyan sky, emerald grass, red
     * and white kerbing. None of that survives on a planet with no atmosphere.
     *
     * SKY is near-black and only matters at the edges — the tiling sky layer
     * covers the viewport — but it has to match that texture's top row or a
     * band appears when the canvas letterboxes.
     *
     * FOG is the one deliberate lie. Mercury has no air, so there is nothing
     * out there to scatter light and a real horizon would stay sharp to the
     * limb. But the fog wash is what hides the draw-distance cut, and without
     * it the track ends in a hard edge 300 segments out. Fading to the sky
     * colour rather than to grey turns that cut into the road simply
     * dissolving into the night, which is the one reading that is both
     * plausible and invisible.
     *
     * The verge is warm regolith and the road is cold basalt, so the two
     * separate by hue as well as by value — they have to stay legible under a
     * light source sitting on the horizon, where everything trends dark. The
     * amber kerbing is the hazard marking; the cyan lane lines are the only
     * Polaris colour on the planet, which is what makes them read instantly.
     *
     * TREE is gone: upstream declared it and never rendered a tree, and there
     * are no trees on Mercury either way. */
    this.COLORS = {
      SKY: 0x05060f,
      FOG: 0x0b0912,
      LIGHT: { road: 0x33384a, grass: 0x6b5f4e, rumble: 0xe8c76a, lane: 0x5ef0ff },
      DARK: { road: 0x2c3040, grass: 0x5a5041, rumble: 0x38304a },
      START: { road: 0xd8e4f0, grass: 0xd8e4f0, rumble: 0xd8e4f0 },
      FINISH: { road: 0x141826, grass: 0x141826, rumble: 0x141826 },
    };
  }

  /**
   * @param bermOut how far the rubble bank spreads outwards, as a multiple of
   *   the nominal bank width. Varies per segment.
   * @param bermIn how far it spills back over the driving line, as a fraction
   *   of the bank width. This is drawn *after* the trail, so it covers it.
   *
   * The two berm arguments are the whole of the "this is not a road" change in
   * this method. Upstream draws a constant-width strip outside a trail quad
   * that is then laid over it, giving a machined edge on both sides. Here the
   * bank varies in width and is painted last, so on some segments it eats a
   * little way into the driving line and the boundary comes out ragged.
   *
   * The trail QUAD is unchanged, which matters: the physics still says the
   * player is off the road at exactly |playerX| > 1, and `bermIn` is capped in
   * terrain.ts so the rubble can never cover so much that the two disagree
   * enough to feel unfair.
   */
  renderSegment(
    width: number,
    lanes: number,
    x1: number,
    y1: number,
    w1: number,
    x2: number,
    y2: number,
    w2: number,
    fog: number,
    color: RoadColor,
    bermOut = 1,
    bermIn = 0,
    pad: BoostPadSlice | null = null,
    padScroll = 0,
    checker = -1,
  ): void {
    const r1 = this.scene.utils.rumbleWidth(w1, lanes) * bermOut;
    const r2 = this.scene.utils.rumbleWidth(w2, lanes) * bermOut;
    const l1 = this.scene.utils.laneMarkerWidth(w1, lanes);
    const l2 = this.scene.utils.laneMarkerWidth(w2, lanes);
    /* How far the bank reaches back over the trail on this segment. */
    const i1 = r1 * bermIn;
    const i2 = r2 * bermIn;

    /* the open regolith — a flat band behind the whole segment */
    if (!this.WIREFRAME) {
      this.scene.graphics.fillStyle(color.grass);
      this.scene.graphics.fillRect(0, y2, width, y1 - y2);
    }

    /* the driving line, then the rubble banks over its edges */
    this.renderPolygon(x1 - w1, y1, x1 + w1, y1, x2 + w2, y2, x2 - w2, y2, color.road);

    /* The starting grid: a black-and-white checker laid across the trail.
     *
     * `checker` is the band's row index, and it is what makes this a chequerboard
     * rather than a row of stripes — the cell colour flips with it, so
     * consecutive segments come out offset by one and the pattern reads
     * correctly in projection. Drawn over the trail and UNDER the rubble banks,
     * so the loose rock at the verge lies on top of the paint exactly as it would
     * on a real surface.
     *
     * This is the one painted marking anywhere on Mercury, and it earns the
     * exception: everything else here goes out of its way not to look like a road
     * (see terrain.ts), but a start line has to be unmistakable at a glance and
     * there is no geological way to say "the race begins here". */
    if (checker >= 0) {
      const CELLS = 10;
      for (let c = 0; c < CELLS; c++) {
        const u0 = -1 + (2 * c) / CELLS;
        const u1 = -1 + (2 * (c + 1)) / CELLS;
        this.renderPolygon(
          x1 + u0 * w1, y1,
          x1 + u1 * w1, y1,
          x2 + u1 * w2, y2,
          x2 + u0 * w2, y2,
          (c + checker) % 2 === 0 ? 0xf4f4f6 : 0x141419,
          fog,
        );
      }
    }
    this.renderPolygon(x1 - w1 - r1, y1, x1 - w1 + i1, y1, x2 - w2 + i2, y2, x2 - w2 - r2, y2, color.rumble, fog);
    this.renderPolygon(x1 + w1 + r1, y1, x1 + w1 - i1, y1, x2 + w2 - i2, y2, x2 + w2 + r2, y2, color.rumble, fog);

    /* Boost pad, if this segment carries a slice of one.
     *
     * Drawn AFTER the banks and BEFORE the fog. After the banks because it is
     * bolted onto the trail and the rubble is lying on it, so nothing should
     * spill over the plate. Before the fog because a pad four hundred units out
     * has to dim with everything else around it — a pad that stayed bright to the
     * draw limit would read as a light source hanging in the dark rather than as
     * a plate on the ground, and it would be the only thing in the scene that
     * did.
     *
     * Everything is in half-widths scaled by the projected half-width `w`, so the
     * plate follows the trail through a taper without knowing the trail exists. */
    if (pad) {
      const px1 = x1 + pad.offset * w1;
      const px2 = x2 + pad.offset * w2;
      const ph1 = pad.half * w1;
      const ph2 = pad.half * w2;
      this.renderPolygon(px1 - ph1, y1, px1 + ph1, y1, px2 + ph2, y2, px2 - ph2, y2, pad.plate, fog);

      /* The moving chevron. `padScroll` runs 0..1 on a clock; subtracting it
         from the slice's own phase sweeps the fat end of the arrow from the
         mouth of the pad towards its tip, over and over. Wrapped rather than
         clamped, so it restarts without a jump. */
      const p = (((pad.phase - padScroll) % 1) + 1) % 1;
      const coreHalf = pad.half * (0.85 - 0.72 * p);
      const ch1 = coreHalf * w1;
      const ch2 = coreHalf * w2;
      this.renderPolygon(px1 - ch1, y1, px1 + ch1, y1, px2 + ch2, y2, px2 - ch2, y2, pad.core, fog);
    }

    if (color.lane) {
      const lanew1 = (w1 * 2) / lanes;
      const lanew2 = (w2 * 2) / lanes;
      let lanex1 = x1 - w1 + lanew1;
      let lanex2 = x2 - w2 + lanew2;
      for (let lane = 1; lane < lanes; lanex1 += lanew1, lanex2 += lanew2, lane++) {
        this.renderPolygon(
          lanex1 - l1 / 2, y1,
          lanex1 + l1 / 2, y1,
          lanex2 + l2 / 2, y2,
          lanex2 - l2 / 2, y2,
          color.lane, fog,
        );
      }
    }

    this.renderFog(0, y1, width, y2 - y1, fog);
  }

  renderRect(x: number, y: number, width: number, height: number, color: number, fog?: number): void {
    const rect = new Phaser.Geom.Rectangle(x, y, width, height);
    this.scene.graphics.fillStyle(color, fog);
    this.scene.graphics.fillRectShape(rect);
  }

  renderPolygon(
    x1: number, y1: number,
    x2: number, y2: number,
    x3: number, y3: number,
    x4: number, y4: number,
    color: number,
    _fog?: number,
  ): void {
    const polygon = new Phaser.Geom.Polygon([x1, y1, x2, y2, x3, y3, x4, y4]);
    if (!this.WIREFRAME) {
      this.scene.graphics.fillStyle(color, 1);
      this.scene.graphics.fillPoints(polygon.points, true);
    } else {
      this.scene.graphics.lineStyle(2, 0x9600ff, 1);
      this.scene.graphics.beginPath();
      this.scene.graphics.moveTo(polygon.points[0]!.x, polygon.points[0]!.y);
      for (let i = 1; i < polygon.points.length; i++) {
        this.scene.graphics.lineTo(polygon.points[i]!.x, polygon.points[i]!.y);
      }
      this.scene.graphics.closePath();
      this.scene.graphics.strokePath();
    }
  }

  /** `fog` runs 1 (clear, at the player) to 0 (opaque, at the draw limit), so
   *  the wash alpha is its complement. Below 1 there is something to draw. */
  renderFog(x: number, y: number, width: number, height: number, fog: number): void {
    if (fog < 1) {
      this.renderRect(x, y, width, height, this.COLORS.FOG, 1 - fog);
    }
  }
}
