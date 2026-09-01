/* SOLAR CIRCUIT — the arrow keys, and why they are not Phaser's.
 *
 * Upstream calls `this.input.keyboard.createCursorKeys()`, which installs
 * Phaser's global keyboard capture on `window` for the life of the game. That
 * is correct for a page whose whole job is one game, and wrong here: this is an
 * overlay inside a long-lived site, opened and closed any number of times, and
 * a capture that outlives the overlay swallows the browser's own shortcuts.
 * Polaris-Man hit the same wall and resolved it the same way — the Phaser
 * config sets `input: { keyboard: false }` and the mount owns the listeners.
 *
 * So this module is a stand-in for Phaser's `CursorKeys` with the four keys the
 * game reads and nothing else. The scene's `update()` still says
 * `this.cursors.left.isDown`, so the port keeps upstream's shape.
 *
 * Note what is deliberately absent: M and Escape. Every other egg lets the
 * site's own handler in `eggs/runtime.ts` own those two — M mutes EggAudio,
 * Escape returns to Mission Control — and this game has no reason to differ.
 * Polaris-Man takes them because it runs its own audio graph and has a pause
 * screen to put behind Escape; this one has neither.
 */

/** The subset of Phaser's `Key` the scene actually reads. */
export interface KeyState {
  isDown: boolean;
}

export interface RoadCursors {
  left: KeyState;
  right: KeyState;
  up: KeyState;
  down: KeyState;
  /** Restart the run. Only read on the finish card. */
  restart: KeyState;
  /** Spend the boost meter. Held, not tapped. */
  boost: KeyState;
  /** Menus only: take the highlighted option. */
  confirm: KeyState;
  /** Menus only: go back a step. */
  cancel: KeyState;
}

/** Physical key -> cursor. Upstream took the four arrows; R was added with the
 *  time trial, and it is safe to claim because the site's own handler owns only
 *  M and Escape. */
const KEY_MAP: Record<string, keyof RoadCursors> = {
  ArrowLeft: "left",
  ArrowRight: "right",
  ArrowUp: "up",
  ArrowDown: "down",
  KeyR: "restart",
  /* Both, because a player will reach for whichever hand is free and a boost
     that only works on one Shift is a boost that looks broken half the time. */
  ShiftLeft: "boost",
  ShiftRight: "boost",
  /* Menu keys. Escape is deliberately NOT here: the site's own handler owns it
     and uses it to leave the game entirely, which is the right thing for it to
     do from any screen. Backspace is the step-back. */
  Enter: "confirm",
  Space: "confirm",
  Backspace: "cancel",
};

/** Every key the game claims. The arrows scroll the page if they reach the
 *  document unhandled; R does not, but it is claimed for the same reason — a
 *  key the game acts on should not also reach the page. */
export const OWNED_KEYS: ReadonlySet<string> = new Set(Object.keys(KEY_MAP));

export class RoadInput {
  readonly cursors: RoadCursors = {
    left: { isDown: false },
    right: { isDown: false },
    up: { isDown: false },
    down: { isDown: false },
    restart: { isDown: false },
    boost: { isDown: false },
    confirm: { isDown: false },
    cancel: { isDown: false },
  };

  /** @returns true if the code was one of ours, so the caller knows whether to
   *  call preventDefault. */
  keyDown(code: string): boolean {
    const k = KEY_MAP[code];
    if (!k) return false;
    this.cursors[k].isDown = true;
    return true;
  }

  keyUp(code: string): boolean {
    const k = KEY_MAP[code];
    if (!k) return false;
    this.cursors[k].isDown = false;
    return true;
  }

  /** Drop everything held. Called on window blur, so alt-tabbing away mid-turn
   *  does not leave the car steering into the grass on its own. */
  clear(): void {
    this.cursors.left.isDown = false;
    this.cursors.right.isDown = false;
    this.cursors.up.isDown = false;
    this.cursors.down.isDown = false;
    this.cursors.restart.isDown = false;
    this.cursors.boost.isDown = false;
    this.cursors.confirm.isDown = false;
    this.cursors.cancel.isDown = false;
  }
}

export const INPUT_KEY = "solar-road-input";
const REGISTRY_KEY = INPUT_KEY;

export function attachInput(game: Phaser.Game, input: RoadInput): void {
  game.registry.set(REGISTRY_KEY, input);
}

export function getInput(scene: Phaser.Scene): RoadInput {
  return scene.registry.get(REGISTRY_KEY) as RoadInput;
}
