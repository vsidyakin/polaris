/* Mars: Signal Siege — the asset manifest.
 *
 * Two things govern this file.
 *
 * 1. Every URL goes through `withBase()`. The site deploys to
 *    /polaris-website/ on GitHub Pages, so a root-relative "/eggs/..." is a
 *    404 there and works locally, which is the worst kind of bug.
 *
 * 2. Load only what the current screen needs. The full set is about 13 MB of
 *    art and audio; blocking the title screen on that would be indefensible
 *    for an easter egg. BOOT is the ~450 KB the title needs, SELECT adds the
 *    mission grid, and each mission pulls its own environment and cue on
 *    launch. Closing the game after the title has fetched under half a
 *    megabyte.
 *
 * The atlases themselves are produced by scripts/build-mars-art.py and graded
 * by scripts/check-mars-sprite-atlases.py; the frame geometry below must match
 * art/atlases.json, and check-mars-levels.mjs asserts that it does.
 */

import { withBase } from "../../lib/base";
import { MISSIONS, type Environment, type MusicKey } from "./data";

/**
 * The Mersive mark shown on every loading screen — the boot splash and each
 * mission load.
 *
 * Not part of the game artwork: it is the brand icon, it lives at the eggs
 * root next to mersive-logo.mp4 rather than under this game, and Polaris-Man
 * shows the same file. It is referenced as a DOM `<img>`, not loaded through
 * Phaser, because it has to be on screen before Phaser has booted at all.
 */
export const LOADING_LOGO = withBase("/eggs/mersive-icon.png");

const ART = "/eggs/mars-signal-siege/art";
const AUDIO = "/eggs/mars-signal-siege/audio";

export interface SheetAsset {
  key: string;
  url: string;
  frameWidth: number;
  frameHeight: number;
}

export interface ImageAsset {
  key: string;
  url: string;
}

export interface AudioAsset {
  key: string;
  /** Both encodings; Phaser picks whichever the browser reports it can play. */
  urls: string[];
}

const sheet = (key: string, path: string, w: number, h: number): SheetAsset => ({
  key, url: withBase(`${ART}/${path}`), frameWidth: w, frameHeight: h,
});
const img = (key: string, path: string): ImageAsset => ({
  key, url: withBase(`${ART}/${path}`),
});

/* --- sprite sheets ------------------------------------------------------- */

export const SHEET = {
  rook: sheet("mss-rook", "rook/rook.png", 96, 96),
  enemies: sheet("mss-enemies", "enemies/enemies.png", 112, 88),
  authored: sheet("mss-authored", "enemies/new-enemies.png", 56, 40),
  bosses: sheet("mss-bosses", "bosses/bosses.png", 192, 192),
  shots: sheet("mss-shots", "projectiles/projectiles.png", 48, 48),
} as const;

/**
 * Frame geometry the game reasons about, mirroring art/atlases.json.
 *
 * These numbers are a copy, and a copy can drift: the enemy cell grew from
 * 80x80 to 112x88 when the roster was re-cut by role, this file was not
 * updated, and Phaser went on slicing the sheet into 80x80 windows. Every
 * enemy in the game was drawn as an arbitrary crop — bodies cut off at the
 * right and bottom, two enemies sharing one frame, several frames essentially
 * empty — which is what "much of their artwork is cut off, they look like they
 * disappear" was. `test:mars` now fails if any of this disagrees with the
 * manifest the art build emits.
 */
export const GEOMETRY = {
  rook: { cell: 96, baseline: 92, pivotX: 48, drawHeight: 70 },
  enemies: { cell: 112, cellH: 88, cols: 9 },
  authored: { cell: 56, cellH: 40, cols: 4 },
  bosses: { cell: 192, cols: 7, posesPerBoss: 7 },
  shots: { cell: 48, cols: 12 },
} as const;

/* --- boot: what the title screen actually draws --------------------------- */

export const BOOT_ART: readonly (ImageAsset | SheetAsset)[] = [
  img("mss-title-cover", "ui/title-cover.png"),
  img("mss-logo", "ui/logo.png"),
];

/** Mission select needs the roster sprites for its tiles, and the briefing
 *  panels. Streamed in behind the grid rather than blocking it. */
export const SELECT_ART: readonly (ImageAsset | SheetAsset)[] = [
  SHEET.bosses,
  img("mss-panel-a", "ui/panel-a.png"),
  img("mss-panel-b", "ui/panel-b.png"),
];

/** Everything gameplay needs regardless of which mission is running. */
export const PLAY_ART: readonly (ImageAsset | SheetAsset)[] = [
  SHEET.rook,
  SHEET.enemies,
  SHEET.authored,
  SHEET.shots,
  img("mss-boss-gate", "ui/boss-gate.png"),
];

export function environmentKey(env: Environment): string {
  return `mss-bg-${env}`;
}

export function environmentArt(env: Environment): ImageAsset {
  return img(environmentKey(env), `backgrounds/${env}.png`);
}

/**
 * Ground material for a sector, cut from the bottom of its own backdrop
 * master. Two textures: the rock mass, which tiles on both axes, and the lit
 * top band, which tiles horizontally.
 */
export function terrainKey(env: Environment, part: "body" | "cap"): string {
  return `mss-ter-${env}-${part}`;
}

export function terrainArt(env: Environment): ImageAsset[] {
  return [
    img(terrainKey(env, "body"), `terrain/${env}-body.png`),
    img(terrainKey(env, "cap"), `terrain/${env}-cap.png`),
  ];
}

/** Art a single mission adds on top of PLAY_ART: its backdrop and its ground. */
export function missionArt(mission: number): ImageAsset[] {
  const env = MISSIONS[mission].environment;
  return [environmentArt(env), ...terrainArt(env)];
}

/**
 * Every cue a mission can reach, so nothing is requested that was never
 * fetched.
 *
 * `playMusic` is deliberately forgiving — it returns quietly when a cue is not
 * in the cache rather than throwing mid-fight. That makes a missing cue
 * *silent* rather than fatal, which is the right runtime behaviour and a
 * terrible failure to discover late, so the loading is enumerated here instead
 * of being left to whichever screen happens to ask first.
 */
export function missionAudio(mission: number): AudioAsset[] {
  const cues: MusicKey[] = [MISSIONS[mission].music, "boss", "taunt", "gameover"];
  /* The final mission runs straight into the ending, and the ending has no
     loading screen of its own to hide a fetch behind. */
  if (mission === MISSIONS.length - 1) cues.push("coreDown", "epilogue", "lairFinal");
  return [...new Set(cues)].map((c) => MUSIC[c]);
}

/* --- audio ---------------------------------------------------------------- */

const music = (key: MusicKey): AudioAsset => ({
  key: `mss-mus-${key}`,
  urls: [withBase(`${AUDIO}/${key}.ogg`), withBase(`${AUDIO}/${key}.mp3`)],
});

export const MUSIC: Record<MusicKey, AudioAsset> = {
  title: music("title"),
  introduction: music("introduction"),
  assault: music("assault"),
  bases: music("bases"),
  toxic: music("toxic"),
  ice: music("ice"),
  energy: music("energy"),
  lair: music("lair"),
  boss: music("boss"),
  clear: music("clear"),
  coreDown: music("coreDown"),
  credits: music("credits"),
  gameover: music("gameover"),
  lairFinal: music("lairFinal"),
  taunt: music("taunt"),
  epilogue: music("epilogue"),
};

/** Which cues loop. One-shots must not, or the game-over jingle never stops. */
export const MUSIC_LOOPS: Record<MusicKey, boolean> = {
  title: false, introduction: true, assault: true, bases: true, toxic: true,
  ice: true, energy: true, lair: true, boss: true,
  clear: false, coreDown: false, credits: false, gameover: false,
  lairFinal: true,
  /* The taunt card is dismissed by the player, so its cue has to hold the
     screen for as long as they leave it there; likewise the ending crawl,
     which runs longer than the cue does. Both loop. */
  taunt: true, epilogue: true,
};

/** Every effect name the game can ask for. Kept as a literal list rather than
 *  derived, so a typo in a play call is a compile error and not a silent
 *  no-op at the moment something explodes. */
export const SFX_NAMES = [
  "fire0", "fire1", "fire2", "fire3", "fire4", "fire5", "fire6", "fire7",
  "enemyFire0", "enemyFire1", "enemyFire2",
  "jump", "land", "pickup", "freeze", "shield",
  "playerHit", "death", "enemyHit", "enemyDown", "bossHit", "bossDown",
  "uiMove", "uiConfirm", "deny", "pause", "resume", "respawn",
  "deploy", "clear", "gameover",
] as const;

export type SfxName = (typeof SFX_NAMES)[number];

const sfx = (name: SfxName): AudioAsset => ({
  key: `mss-sfx-${name}`,
  urls: [withBase(`${AUDIO}/sfx/${name}.ogg`), withBase(`${AUDIO}/sfx/${name}.mp3`)],
});

/** The whole SFX library is 386 KB, so it loads once with the UI rather than
 *  being split per mission — splitting it would cost more round trips than
 *  bytes saved. */
export const SFX_ASSETS: readonly AudioAsset[] = SFX_NAMES.map(sfx);

/** UI effects the title and select screens need before gameplay audio loads. */
export const BOOT_SFX: readonly AudioAsset[] = (
  ["uiMove", "uiConfirm", "deny"] as const
).map(sfx);
