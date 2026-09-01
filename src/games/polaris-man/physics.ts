/* Polaris-Man — collision and movement primitives.
 *
 * Deliberately NOT Phaser Arcade Physics. The standalone's jump arc, wall
 * rebound and coyote window are tuned against this exact resolver: it moves on
 * one axis at a time and resolves against a static list, with no restitution,
 * no separation pass and no sub-stepping. Arcade would change the feel of every
 * jump in the game, and "preserve the recognisable mechanics" outranks "use the
 * engine's physics" here. Recorded as an intentional difference in the docs.
 *
 * Everything in this file is pure and framework-free, which is also what makes
 * it the one part of the game that unit tests can reach.
 */

export interface Box { x: number; y: number; w: number; h: number }

export interface Solid extends Box {
  kind?: "ground" | "platform" | "wall";
  tier?: number;
}

/** A body the resolver can move. `on` = standing on something this frame,
 *  `wall` = -1 touching a wall to the left, 1 to the right, 0 clear. */
export interface Body extends Box {
  vx: number;
  vy: number;
  on: boolean;
  wall: number;
}

export function clamp(v: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, v));
}

/** Axis-aligned overlap. Touching edges do not count, matching v1.7. */
export function hit(a: Box, b: Box): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/**
 * Move `o` by (dx, dy) against `solids`, resolving X then Y.
 *
 * The two-pass order is load-bearing: resolving X first means a body that is
 * pushed into a wall loses its horizontal velocity before gravity is applied,
 * which is what produces the wall-slide the wall jump depends on.
 */
export function move(o: Body, dx: number, dy: number, solids: readonly Solid[]): void {
  o.x += dx;
  o.wall = 0;
  for (const s of solids) {
    if (!hit(o, s)) continue;
    if (dx > 0) {
      o.x = s.x - o.w;
      o.wall = 1;
    } else if (dx < 0) {
      o.x = s.x + s.w;
      o.wall = -1;
    }
    o.vx = 0;
  }

  o.y += dy;
  o.on = false;
  for (const s of solids) {
    if (!hit(o, s)) continue;
    if (dy > 0) {
      o.y = s.y - o.h;
      o.vy = 0;
      o.on = true;
    } else if (dy < 0) {
      o.y = s.y + s.h;
      o.vy = 0;
    }
  }
}

/**
 * The hurtbox used for damage tests, inset from the drawn body.
 *
 * CHANGED from v1.7, which tested damage against the full body rect. See
 * PLAYER.HURTBOX_INSET_* in tuning.ts for the reasoning; pass 0/0 to get the
 * original behaviour back.
 */
export function hurtbox(o: Box, insetX: number, insetY: number): Box {
  return {
    x: o.x + insetX,
    y: o.y + insetY,
    w: Math.max(1, o.w - insetX * 2),
    h: Math.max(1, o.h - insetY * 2),
  };
}

/** Frame-rate independent exponential decay, as v1.7 wrote it: pow(base, dt). */
export function decay(v: number, base: number, dt: number): number {
  return v * Math.pow(base, dt);
}

/** Move `v` toward `target` by at most `amount`. */
export function approach(v: number, target: number, amount: number): number {
  return v < target ? Math.min(v + amount, target) : Math.max(v - amount, target);
}

export function rr(a: number, b: number): number {
  return a + Math.random() * (b - a);
}
