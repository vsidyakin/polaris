/* Mars: Signal Siege — Phaser animation registration and muzzle sockets.
 *
 * Every animation in the game is a real `Phaser.Animations.Animation` built
 * from the atlas frame indices in art/atlases.json. That file is produced by
 * scripts/build-mars-art.py, so the frame numbers below are never typed by
 * hand — they are read from the manifest the art pipeline emitted, which is
 * what keeps the two from drifting when a sheet is rebuilt.
 *
 * The socket table is the other half of the projectile fix. v0.7 spawned shots
 * from six hard-coded offsets and fell back to the collision box for every
 * pose it did not cover, which is why bolts left Rook's stomach when he fired
 * up or while prone. Here each frame carries the muzzle position measured off
 * its own artwork.
 */

import type Phaser from "phaser";
import { SHEET, GEOMETRY } from "./assets";

/** Shape of art/atlases.json, as far as the game cares. */
export interface AtlasSheet {
  file: string;
  cols: number;
  rows: number;
  cellW: number;
  cellH: number;
  tags: Record<string, number[]>;
  baseline?: number;
  pivotX?: number;
  drawHeight?: number;
  sockets?: Record<string, [number, number]>;
  /** Which way the artwork is drawn before any flip. Absent means right. */
  facesRight?: boolean;
}

export interface AtlasManifest {
  sheets: AtlasSheet[];
}

export const ATLAS_KEY = "mss-atlases";

let manifest: AtlasManifest | null = null;

export function setManifest(m: AtlasManifest): void {
  manifest = m;
}

export function sheetFor(fileEnding: string): AtlasSheet | null {
  return manifest?.sheets.find((s) => s.file.endsWith(fileEnding)) ?? null;
}

/** Animation key namespace, so nothing collides with another egg's anims. */
export const ANIM = {
  rook: (tag: string) => `mss-rook-${tag}`,
  enemy: (group: string, kind: string, tag: string) => `mss-en-${group}-${kind}-${tag}`,
  authored: (kind: string) => `mss-au-${kind}`,
  boss: (index: number, tag: string) => `mss-boss${index}-${tag}`,
  impact: (weapon: number) => `mss-impact-${weapon}`,
} as const;

interface AnimSpec {
  key: string;
  frames: number[];
  frameRate: number;
  repeat: number;
}

/** Frame rates chosen per action rather than globally: a boss wind-up wants to
 *  be readable, a muzzle flash wants to be gone. */
const RATE = {
  run: 14,
  idle: 3,
  walk: 6,
  attack: 10,
  hover: 12,
  impact: 20,
} as const;

function add(
  scene: Phaser.Scene,
  sheetKey: string,
  spec: AnimSpec,
): void {
  const anims = scene.anims;
  if (anims.exists(spec.key)) return;

  /* Refuse to create an animation whose texture has not loaded yet.
     Phaser will happily create one from frames it cannot resolve, and the
     result is an Animation with no `currentFrame`; the first `play()` of it
     then throws inside getFirstTick reading `currentFrame.duration`, which
     happens during a scene's update and takes the whole game loop down with it
     — the game freezes on the first frame of play with no visible cause.
     Registration is idempotent and every scene that needs animations calls it,
     so skipping here simply defers creation to the first call that can do it
     correctly. */
  if (!scene.textures.exists(sheetKey)) return;
  const texture = scene.textures.get(sheetKey);
  const usable = spec.frames.filter((f) => texture.has(String(f)));
  if (usable.length !== spec.frames.length || usable.length === 0) return;

  anims.create({
    key: spec.key,
    frames: usable.map((f) => ({ key: sheetKey, frame: f })),
    frameRate: spec.frameRate,
    repeat: spec.repeat,
  });
}

/**
 * Build every animation the game uses.
 *
 * Called once from PreloadScene after the sheets and the manifest are in the
 * cache. Idempotent, because reopening the egg creates a new Phaser.Game whose
 * animation manager starts empty but a hot reload may not.
 */
export function registerAnimations(scene: Phaser.Scene): void {

  /* --- Rook -------------------------------------------------------------
     Only the non-cycling poses are registered. run / runfire / aimdiagup_run
     are driven frame-by-frame from distance travelled (see Rook.applyPose), so
     registering them as timed animations would create three keys that can never
     play and invite someone to "fix" the cycle by playing them. */
  const rook = sheetFor("rook.png");
  if (rook) {
    for (const [tag, frames] of Object.entries(rook.tags)) {
      if (tag === "run" || tag === "runfire" || tag === "aimdiagup_run") continue;
      add(scene, SHEET.rook.key, {
        key: ANIM.rook(tag),
        frames,
        frameRate: RATE.idle,
        repeat: 0,
      });
    }
  }

  /* --- inherited enemy groups -------------------------------------------
     Not registered at all. Every pose on these four sheets is selected by
     Enemy.applyPose with setTexture — the walk is distance-clocked for the same
     reason Rook's is — so registering 48 timed animations would produce 48 keys
     nothing ever plays. The authored types below are the ones that genuinely
     run on Phaser's animation clock. */

  /* --- authored types --------------------------------------------------- */
  const authored = sheetFor("new-enemies.png");
  if (authored) {
    for (const [tag, frames] of Object.entries(authored.tags)) {
      const kind = tag.split("_")[0];
      add(scene, SHEET.authored.key, {
        key: ANIM.authored(kind),
        frames,
        frameRate: RATE.hover,
        repeat: -1,
      });
    }
  }

  /* --- bosses ------------------------------------------------------------
     Each boss gets idle / walk / air / wind / fire / recover. `idle` and
     `walk` loop; the attack phases play once and the state machine advances
     when they finish, which is what makes the telegraph a real beat rather
     than a decorative frame swap. */
  const bosses = sheetFor("bosses.png");
  if (bosses) {
    for (const [tag, frames] of Object.entries(bosses.tags)) {
      const m = /^boss(\d+)_(.+)$/.exec(tag);
      if (!m) continue;
      const index = Number(m[1]);
      const pose = m[2];
      const loops = pose === "idle" || pose === "walk";
      add(scene, SHEET.bosses.key, {
        key: ANIM.boss(index, pose),
        frames,
        frameRate: pose === "walk" ? RATE.walk : pose === "idle" ? RATE.idle : RATE.attack,
        repeat: loops ? -1 : 0,
      });
    }
  }

  /* --- projectile impacts ------------------------------------------------ */
  const shots = sheetFor("projectiles.png");
  if (shots) {
    for (const [tag, frames] of Object.entries(shots.tags)) {
      const m = /^impact(\d+)$/.exec(tag);
      if (!m) continue;
      add(scene, SHEET.shots.key, {
        key: ANIM.impact(Number(m[1])),
        frames,
        frameRate: RATE.impact,
        repeat: 0,
      });
    }
  }
}

/**
 * Sprite origin for a ground-anchored sheet, as Phaser fractions.
 *
 * NOT (0.5, 1). The art pipeline seats every sprite's lowest opaque row on
 * `baseline`, which is GUTTER pixels above the bottom of the cell — the gutter
 * exists precisely so no pixel touches a cell wall. Anchoring to the frame
 * bottom therefore hangs the character GUTTER pixels above the floor it is
 * standing on, and drags every muzzle socket down by the same amount, because
 * `socketFor` measures from `baseline` while Phaser would be measuring from the
 * cell edge. Anchoring to the baseline makes the two agree by construction.
 */
/**
 * Whether a sprite drawn from this sheet should be mirrored to face `facing`.
 *
 * The one place in the game that decides this. Every actor used to write its
 * own comparison, and the comparison is not the same for every sheet: the
 * painterly group sheets and the bosses are drawn facing left, Rook and the
 * Aseprite-authored types face right. A single rule expressed at each call
 * site was wrong for half the roster whichever way it pointed, and it has been
 * wrong in both directions in turn — first every ground enemy moonwalked, then
 * every one of them ran backwards.
 *
 * Defaults to right-facing when a sheet says nothing, because that is the
 * convention for anything authored from here on.
 */
export function flipFor(sheetEnding: string, facing: number): boolean {
  const sheet = sheetFor(sheetEnding);
  const facesRight = sheet?.facesRight ?? true;
  return facesRight ? facing < 0 : facing > 0;
}

export function originFor(sheetEnding: string): { x: number; y: number } {
  const sheet = sheetFor(sheetEnding);
  if (!sheet) return { x: 0.5, y: 1 };
  const baseline = sheet.baseline ?? sheet.cellH;
  const pivotX = sheet.pivotX ?? sheet.cellW / 2;
  return { x: pivotX / sheet.cellW, y: baseline / sheet.cellH };
}

/** Single frame index for a tag, for things drawn as a static sprite. */
export function frameOf(sheetEnding: string, tag: string, offset = 0): number {
  const sheet = sheetFor(sheetEnding);
  const frames = sheet?.tags[tag];
  if (!frames || frames.length === 0) return 0;
  return frames[Math.min(offset, frames.length - 1)];
}

/* ------------------------------------------------------------------ sockets */

export interface Socket {
  /** Offset from Rook's draw origin, in logical pixels, facing right. */
  x: number;
  y: number;
}

/**
 * Where the muzzle is for a given Rook frame.
 *
 * The manifest stores the point in cell-local pixels with the origin at the
 * cell's top-left. Rook is drawn with his origin at the cell's pivot column
 * and ground baseline, so converting is a subtraction — and mirroring for a
 * left-facing sprite is a negation of x only, never of y, which is the bug
 * that puts a left-facing muzzle in the character's knees.
 */
export function socketFor(frame: number, facing: number): Socket {
  const rook = sheetFor("rook.png");
  const cell = rook?.cellW ?? GEOMETRY.rook.cell;
  const pivotX = rook?.pivotX ?? GEOMETRY.rook.pivotX;
  const baseline = rook?.baseline ?? GEOMETRY.rook.baseline;
  const raw = rook?.sockets?.[String(frame)];
  if (!raw) {
    /* No measurement for this frame: aim from roughly chest height rather than
       from the body centre, so a missing socket still reads as a gun. Measured
       from `baseline` like every other y in this function — the previous
       `-(cell - baseline) - 34` also subtracted the gutter, which is already
       accounted for by anchoring to the baseline. Unreachable while every live
       frame has a socket; scripts/test-mars-signal-siege.mjs asserts that. */
    return { x: facing * (cell * 0.28), y: -34 };
  }
  return {
    x: facing * (raw[0] - pivotX),
    y: raw[1] - baseline,
  };
}

/** Frames that have no measured socket, for the QA script to report. */
export function socketCoverage(): { total: number; measured: number; missing: string[] } {
  const rook = sheetFor("rook.png");
  if (!rook) return { total: 0, measured: 0, missing: [] };
  const live = new Set<number>();
  for (const frames of Object.values(rook.tags)) for (const f of frames) live.add(f);
  const missing: string[] = [];
  for (const [tag, frames] of Object.entries(rook.tags)) {
    for (const f of frames) {
      if (!rook.sockets?.[String(f)]) missing.push(`${tag}:${f}`);
    }
  }
  return { total: live.size, measured: live.size - missing.length, missing };
}
