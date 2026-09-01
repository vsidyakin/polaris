/* Polaris-Man — the asset manifest.
 *
 * Two rules govern this file.
 *
 * 1. The artwork is locked. These are the 28 PNGs the standalone loads, copied
 *    byte-for-byte into public/eggs/polaris-man/art/. Nothing here resizes,
 *    re-encodes or re-crops them; Phaser is pointed at the originals and the
 *    sub-rects in data.ts do the framing.
 *
 * 2. Load only what the current screen needs. The full set is 28.4 MB, which is
 *    fine for a local prototype and not fine for a web overlay. So the loader
 *    is split: BOOT_ART is the handful the title and mission-select need, and
 *    each mission pulls its own ~3.5 MB panel/figure pair on launch. A player
 *    who opens the egg and closes it again has fetched about 3 MB, not 28.
 */

import { withBase } from "../../lib/base";
import { MOON_IDS, ORIGINAL_MOONS, type MissionId, type MoonId } from "./data";
import type { MusicTrackDef } from "./audio";

const ART_ROOT = "/eggs/polaris-man/art";
const AUDIO_ROOT = "/eggs/polaris-man/audio";

/** The Mersive mark shown while the game loads, before the boot sting.
 *  Not part of the locked game artwork — this is the brand icon, and it is the
 *  only asset fetched before anything else, so the first frame the player sees
 *  after pressing GO is Mersive rather than an empty box.
 *
 *  It lives at the eggs root rather than under this game, alongside
 *  mersive-logo.mp4, because Mars: Signal Siege shows the same mark on its own
 *  loading screen and two copies of a 206 KB brand asset is one too many. */
export const LOADING_LOGO = withBase("/eggs/mersive-icon.png");

export interface ImageAsset { key: string; url: string }

const img = (key: string, path: string): ImageAsset => ({ key, url: withBase(`${ART_ROOT}/${path}`) });

/** Proper-case moon name as it appears in the art filenames. */
export function moonFileName(id: MoonId): string {
  return id === "puckmoon" ? "Puck" : id[0].toUpperCase() + id.slice(1);
}

/* --- blocking: the least the title screen can open with (~2.4 MB) --- */

export const BOOT_ART: readonly ImageAsset[] = [
  img("pm-title-bg", "backgrounds/Polaris_Man_Title_Background_v2.png"),
  img("pm-operator", "production/Polaris_Operator_Sprites_v1.png"),
  /* Same file the DOM loading screen shows, loaded into Phaser as well so the
     boot sting can draw it. One request — the browser cache serves both. */
  { key: "pm-logo", url: LOADING_LOGO },
];

/* --- the operator's other sheets: only gameplay draws these --- */

export const PLAY_SHARED_ART: readonly ImageAsset[] = [
  img("pm-run", "production/Polaris_Operator_Run_v1.png"),
  img("pm-air", "production/Polaris_Operator_Air_v1.png"),
  img("pm-checkpoint", "production/Workspace_Checkpoint_v1.png"),
];

/**
 * Mission-select tile art: one baked sprite sheet.
 *
 * This used to be the eighteen source files behind the nine tiles — each moon's
 * full-size level panel plus its full-size figure sheet, about 20 MB, fetched
 * and decoded in the browser to paint 260x150 thumbnails. The grid rendered
 * immediately from colour and type and this streamed in behind it, but the
 * tiles still took well over a second to fill in locally, and on a real
 * connection the download dwarfed that.
 *
 * scripts/build-polaris-man-tiles.mjs now does that compositing at build time
 * and writes select-tiles.png: the same nine tiles, pixel for pixel, in 817 KB.
 * Run it when the panels, the figure sheets, FIGURE_RECTS or the mission
 * accents change; the sheet is committed, so a build never depends on it.
 *
 * THE FULL-SIZE ART IS NOT REDUNDANT and is still fetched by missionArt() when
 * a mission is actually chosen. Those panels are the scrolling level
 * backgrounds, and data.ts authors platform collision geometry in their native
 * pixel space — Desdemona's platforms run out to x=1774. Only the MENU stopped
 * paying for them.
 */
export const SELECT_ART: readonly ImageAsset[] = [
  img("pm-select-tiles", "select-tiles.png"),
];

/** Tile geometry in select-tiles.png. Must match the constants of the same name
 *  in scripts/build-polaris-man-tiles.mjs; the script asserts the mission order
 *  against data.ts so the two cannot drift apart silently. */
export const TILE_W = 260;
export const TILE_H = 150;
export const TILE_COLS = 4;

/* --- per-mission: the figure sheet, and a boss arena for the first four --- */

export function panelKey(id: MoonId): string {
  return `pm-bg-${id}`;
}
export function figuresKey(id: MoonId): string {
  return `pm-fig-${id}`;
}
export function arenaKey(id: MoonId): string {
  return ORIGINAL_MOONS.has(id) ? `pm-arena-${id}` : panelKey(id);
}

export function missionArt(id: MissionId): ImageAsset[] {
  if (id === "final") {
    return [
      img("pm-bg-final", "backgrounds/Final_Boss_Arena_v1.png"),
      img("pm-boss-final", "production/Protocol_Prime_Boss_v1.png"),
    ];
  }
  const moon = id as MoonId;
  const out: ImageAsset[] = [
    img(panelKey(moon), `backgrounds/${moonFileName(moon)}_Level_Panel_v1.png`),
    img(figuresKey(moon), `production/Level_${moonFileName(moon)}_Figures_v1.png`),
  ];
  if (ORIGINAL_MOONS.has(moon)) {
    out.push(img(`pm-arena-${moon}`, `backgrounds/${moonFileName(moon)}_Boss_Arena_v1.png`));
  }
  return out;
}

/** Loaded but never drawn by v1.7 — the boss uses its moon's figure sheet.
 *  Kept in the inventory so the asset audit is honest about it, but not
 *  fetched, because fetching 1 MB nothing reads is not a faithful port of a
 *  behaviour, it is a faithful port of a mistake. */
export const UNUSED_BY_ORIGINAL: readonly string[] = [
  "production/Dongle_Baron_Sprites_v1.png",
];

/* --- music: FamiStudio NES arrangements, one per scene --- */

const track = (key: string, file: string, fallback: string, loop = true): MusicTrackDef => ({
  key,
  url: withBase(`${AUDIO_ROOT}/${file}`),
  fallback,
  loop,
});

export const MUSIC = {
  title: track("pm-mus-title", "01_Title_Screen.ogg", "title"),
  select: track("pm-mus-select", "02_Mission_Select.ogg", "select"),
  ariel: track("pm-mus-ariel", "03_Mission_Track_01.ogg", "ariel"),
  umbriel: track("pm-mus-umbriel", "04_Mission_Track_02.ogg", "umbriel"),
  titania: track("pm-mus-titania", "05_Mission_Track_03.ogg", "titania"),
  oberon: track("pm-mus-oberon", "06_Mission_Track_04.ogg", "oberon"),
  miranda: track("pm-mus-miranda", "07_Mission_Track_05.ogg", "miranda"),
  puckmoon: track("pm-mus-puckmoon", "08_Mission_Track_06.ogg", "puckmoon"),
  cressida: track("pm-mus-cressida", "09_Mission_Track_07.ogg", "cressida"),
  desdemona: track("pm-mus-desdemona", "10_Mission_Track_08.ogg", "desdemona"),
  boss: track("pm-mus-boss", "11_Boss_Battle.ogg", "boss"),
  victory: track("pm-mus-victory", "12_Victory.ogg", "title", false),
  endboss: track("pm-mus-endboss", "13_End_Boss.ogg", "final"),
  gameover: track("pm-mus-gameover", "14_Game_Over.ogg", "select", false),
  epilogue: track("pm-mus-epilogue", "15_Epilogue.ogg", "title"),
} as const satisfies Record<string, MusicTrackDef>;

/** Music for a mission in normal play. */
export function missionMusic(id: MissionId): MusicTrackDef {
  if (id === "final") return MUSIC.endboss;
  return (MUSIC as Record<string, MusicTrackDef>)[id] ?? MUSIC.select;
}

/** Music while a boss is alive. */
export function bossMusic(id: MissionId): MusicTrackDef {
  return id === "final" ? MUSIC.endboss : MUSIC.boss;
}
