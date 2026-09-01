/* SOLAR CIRCUIT — the boot scene.
 *
 * A port of Phaser3-Road's `src/scenes/bootScene.js`: load the four images
 * behind a progress bar, then hand straight over to the game scene.
 *
 * Upstream commented out a `titleScene` between the two — the file exists there
 * and is empty. This port went the other way in the end and wrote one: a craft
 * to choose and nine courses to choose between need somewhere to be chosen, and
 * Mission Control is one screen further out than that.
 */

/* Phaser is imported for its value, not its types. `phaser.d.ts` declares an
   ambient global `Phaser` namespace, so `extends Phaser.Scene` type-checks with
   no import at all — and then throws ReferenceError at runtime, because the ESM
   build this project resolves to sets no global. `pnpm check` cannot see it. */
import Phaser from "phaser";
import { ROAD_ART } from "./assets";
import { VIEW } from "./view";

export const SCENE = {
  BOOT: "bootScene",
  MENU: "menuScene",
  GAME: "gameScene",
} as const;

export default class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: SCENE.BOOT });
  }

  preload(): void {
    const progress = this.add.graphics();

    this.load.on("progress", (value: number) => {
      progress.clear();
      progress.fillStyle(0xffffff, 1);
      progress.fillRect(0, VIEW.H / 2, VIEW.W * value, 60);
    });

    this.load.on("complete", () => {
      progress.destroy();
      this.scene.start(SCENE.MENU);
    });

    for (const asset of ROAD_ART) this.load.image(asset.key, asset.url);
  }
}
