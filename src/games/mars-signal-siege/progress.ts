/* Mars: Signal Siege — versioned local progress.
 *
 * v0.7 wrote a bare array under `marsSignalSiegeProgress` and read it back with
 * a filter. That works until the shape changes, at which point old saves either
 * throw or silently unlock the wrong thing. This wraps the same data in a
 * versioned envelope and migrates the old key forward, so nobody who played the
 * standalone loses their eleven cleared sectors.
 *
 * Everything here tolerates storage being unavailable: private windows and
 * hardened browsers throw on access, and an easter egg must not break the page
 * it is embedded in over a save file.
 */

import { REGULAR_MISSIONS } from "./data";

const KEY = "mersive.mars-signal-siege.progress";
/** The standalone's key. Read once, then left alone. */
const LEGACY_KEY = "marsSignalSiegeProgress";
const VERSION = 1;

export interface Progress {
  version: number;
  /** Indices of cleared regular missions (0..10). The final boss is never
   *  recorded here — beating it is an ending, not an unlock. */
  cleared: number[];
  /** Best run: missions cleared in one sitting. Cosmetic. */
  best: number;
}

function empty(): Progress {
  return { version: VERSION, cleared: [], best: 0 };
}

function sanitise(cleared: unknown): number[] {
  if (!Array.isArray(cleared)) return [];
  const out = new Set<number>();
  for (const n of cleared) {
    if (typeof n === "number" && Number.isInteger(n) && n >= 0 && n < REGULAR_MISSIONS) {
      out.add(n);
    }
  }
  return [...out].sort((a, b) => a - b);
}

export function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Progress>;
      return {
        version: VERSION,
        cleared: sanitise(parsed.cleared),
        best: typeof parsed.best === "number" ? parsed.best : 0,
      };
    }
    /* Migrate a standalone save exactly once. The old key is left in place
       rather than deleted — it is not ours to remove, and the standalone may
       still be opened from the deliverables folder. */
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const cleared = sanitise(JSON.parse(legacy));
      const migrated: Progress = { version: VERSION, cleared, best: cleared.length };
      saveProgress(migrated);
      return migrated;
    }
  } catch {
    /* Storage unavailable or corrupt: start fresh rather than throw. */
  }
  return empty();
}

export function saveProgress(p: Progress): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* Nothing to do — the session still plays, it just will not persist. */
  }
}

export function clearProgress(): Progress {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  return empty();
}

export function markCleared(p: Progress, mission: number): Progress {
  if (mission < 0 || mission >= REGULAR_MISSIONS) return p;
  if (p.cleared.includes(mission)) return p;
  const next: Progress = {
    version: VERSION,
    cleared: [...p.cleared, mission].sort((a, b) => a - b),
    best: Math.max(p.best, p.cleared.length + 1),
  };
  saveProgress(next);
  return next;
}

/**
 * Mission 0 is always open. Every other regular mission needs the one before
 * it. The final boss needs all eleven — not "the eleventh", all of them, so
 * there is no route that reaches the Lock-In Engine with sectors still closed.
 */
export function isUnlocked(p: Progress, mission: number): boolean {
  if (mission === 0) return true;
  if (mission < REGULAR_MISSIONS) return p.cleared.includes(mission - 1);
  return p.cleared.length >= REGULAR_MISSIONS;
}

export function lockReason(p: Progress, mission: number): string {
  if (mission >= REGULAR_MISSIONS) {
    const left = REGULAR_MISSIONS - p.cleared.length;
    return `FINAL BOSS REQUIRES ALL ELEVEN ROOT KEYS - ${left} REMAINING`;
  }
  return "CLEAR THE PREVIOUS SECTOR FIRST";
}
