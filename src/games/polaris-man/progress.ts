/* Polaris-Man — campaign progress.
 *
 * Same localStorage key and shape as the standalone (`psb_campaign_v2`), so a
 * player who played the prototype keeps their campaign. Pure apart from the
 * two storage calls, which are guarded: the egg runs inside the site, and a
 * blocked-storage browser must degrade to a fresh campaign, not a thrown
 * exception that takes the whole overlay down.
 */

import { MISSIONS, type Mission, type MissionId, type WeaponId } from "./data";
import { STORAGE } from "./tuning";

export interface Progress {
  cleared: Record<string, boolean>;
  weapons: WeaponId[];
  best: Record<string, number>;
  abilities: { doubleJump: boolean };
  started: boolean;
  finalCleared: boolean;
}

export function freshProgress(): Progress {
  return {
    cleared: {},
    weapons: ["pulse"],
    best: {},
    abilities: { doubleJump: false },
    started: false,
    finalCleared: false,
  };
}

/** Missions whose boss is down, in campaign order. */
export function defeatedMissions(cleared: Record<string, boolean> = {}): Mission[] {
  return MISSIONS.filter((m) => cleared[m.id] === true);
}

export function allMoonBossesDefeated(cleared: Record<string, boolean> = {}): boolean {
  return defeatedMissions(cleared).length === MISSIONS.length;
}

/** The weapon list is always derived from cleared missions rather than stored,
 *  so a corrupted `weapons` array can never grant a capability you did not
 *  earn — and never withholds one you did. */
export function weaponsEarnedFrom(cleared: Record<string, boolean> = {}): WeaponId[] {
  return ["pulse" as WeaponId, ...defeatedMissions(cleared).map((m) => m.weapon)];
}

export function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(STORAGE.PROGRESS);
    const p: Progress = raw ? JSON.parse(raw) : freshProgress();
    p.cleared = p.cleared || {};
    p.weapons = weaponsEarnedFrom(p.cleared);
    p.best = p.best || {};
    p.abilities = p.abilities || { doubleJump: Object.keys(p.cleared).length > 0 };
    return p;
  } catch {
    return freshProgress();
  }
}

export function saveProgress(p: Progress): void {
  try {
    localStorage.setItem(STORAGE.PROGRESS, JSON.stringify(p));
  } catch {
    /* Private mode or a full quota. The campaign still plays; it just will not
       survive a reload, which beats crashing the overlay. */
  }
}

export function loadMuted(): boolean {
  try {
    return localStorage.getItem(STORAGE.SOUND) === "off";
  } catch {
    return false;
  }
}

export function saveMuted(muted: boolean): void {
  try {
    localStorage.setItem(STORAGE.SOUND, muted ? "off" : "on");
  } catch {
    /* ignore */
  }
}

/** Record a boss kill: capability earned, double jump on first clear, best time. */
export function recordClear(p: Progress, mission: Mission, missionTime: number): { firstClear: boolean } {
  const firstClear = defeatedMissions(p.cleared).length === 0 && !p.cleared[mission.id];
  p.cleared[mission.id] = true;
  if (!p.weapons.includes(mission.weapon)) p.weapons.push(mission.weapon);
  if (firstClear) p.abilities.doubleJump = true;
  const old = p.best[mission.id] ?? 9999;
  p.best[mission.id] = Math.min(old, missionTime);
  return { firstClear };
}

export function isCleared(p: Progress, id: MissionId): boolean {
  return p.cleared[id] === true;
}
