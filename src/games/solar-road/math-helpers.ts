/* SOLAR CIRCUIT — projection and easing maths.
 *
 * A port of Phaser3-Road's `src/classes/mathHelpers.js`, which is in turn Jake
 * Gordon's javascript-racer `common.js`. Every function here is unchanged in
 * behaviour; the class shape is kept so this file diffs 1:1 against upstream.
 *
 * `project()` is the whole pseudo-3D trick. A road point carries three
 * coordinate spaces — world, camera, screen — and projection walks them in
 * order: subtract the camera position to get camera space, divide the camera
 * depth by the point's z to get a scale, and multiply out to pixels. Points
 * further down the track get a smaller scale, so the road narrows and the
 * horizon converges without a single matrix.
 */

/** A road point in the three spaces `project()` moves it through. */
export interface RoadPoint {
  world: { x?: number; y: number; z: number };
  camera: { x: number; y: number; z: number };
  screen: { x: number; y: number; w: number; scale: number };
}

export default class RoadMath {
  /**
   * World -> camera -> screen, in place. `p.screen` is what the renderer reads.
   *
   * `span` is the one deviation from upstream in this file. Upstream scales x by
   * `width`, which is correct only while the canvas is 4:3; see the note on
   * PROJECT_SPAN in view.ts. It defaults to `width`, so a caller that does not
   * care gets upstream's behaviour exactly.
   */
  project(
    p: RoadPoint,
    cameraX: number,
    cameraY: number,
    cameraZ: number,
    cameraDepth: number,
    width: number,
    height: number,
    roadWidth: number,
    span: number = width,
  ): void {
    p.camera.x = (p.world.x || 0) - cameraX;
    p.camera.y = (p.world.y || 0) - cameraY;
    p.camera.z = (p.world.z || 0) - cameraZ;
    p.screen.scale = cameraDepth / p.camera.z;
    /* Centred on the canvas, scaled by the span. */
    p.screen.x = Math.round(width / 2 + (p.screen.scale * p.camera.x * span) / 2);
    p.screen.y = Math.round(height / 2 - (p.screen.scale * p.camera.y * height) / 2);
    p.screen.w = Math.round((p.screen.scale * roadWidth * span) / 2);
  }

  /** 1D overlap test, used for collisions between things sharing a segment. */
  overlap(x1: number, w1: number, x2: number, w2: number, percent?: number): boolean {
    const half = (percent || 1) / 2;
    const min1 = x1 - w1 * half;
    const max1 = x1 + w1 * half;
    const min2 = x2 - w2 * half;
    const max2 = x2 + w2 * half;
    return !(max1 < min2 || min1 > max2);
  }

  exponentialFog(distance: number, density: number): number {
    return 1 / Math.pow(Math.E, distance * distance * density);
  }

  /** Add with wraparound — how the camera loops the track without a seam. */
  increase(start: number, increment: number, max: number): number {
    let result = start + increment;
    while (result >= max) result -= max;
    while (result < 0) result += max;
    return result;
  }

  rumbleWidth(projectedRoadWidth: number, lanes: number): number {
    return projectedRoadWidth / Math.max(6, 2 * lanes);
  }

  laneMarkerWidth(projectedRoadWidth: number, lanes: number): number {
    return projectedRoadWidth / Math.max(32, 8 * lanes);
  }

  percentRemaining(n: number, total: number): number {
    return (n % total) / total;
  }

  toInt(obj: number | string | null, def: number): number {
    if (obj !== null) {
      const x = parseInt(String(obj), 10);
      if (!isNaN(x)) return x;
    }
    return def;
  }

  limit(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(value, max));
  }

  interpolate(a: number, b: number, percent: number): number {
    return a + (b - a) * percent;
  }

  easeIn(a: number, b: number, percent: number): number {
    return a + (b - a) * Math.pow(percent, 2);
  }

  easeOut(a: number, b: number, percent: number): number {
    return a + (b - a) * (1 - Math.pow(1 - percent, 2));
  }

  easeInOut(a: number, b: number, percent: number): number {
    return a + (b - a) * (-Math.cos(percent * Math.PI) / 2 + 0.5);
  }
}
