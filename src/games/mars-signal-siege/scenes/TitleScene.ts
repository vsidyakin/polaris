/* Mars: Signal Siege — title screen.
 *
 * Keeps the original Mars cover art and puts the wordmark and controls over it
 * as game UI. Escape here closes the whole experience and returns the visitor
 * to Mission Control, which is the only screen where Escape means "leave".
 *
 * Nothing on this screen mentions the thirty-life sequence.
 */

import Phaser from "phaser";
import { VIEW } from "../tuning";
import { getCtx } from "../context";
import { MUSIC, SELECT_ART, SFX_ASSETS, PLAY_ART } from "../assets";
import { registerAnimations } from "../anims";
import { SCENE, queueArt, queueAudio } from "./PreloadScene";
import { controlsStrip, label, PALETTE } from "./ui";

/**
 * Where the cover art draws its own "PRESS ENTER / START", measured off
 * Mars_Title_Cover_v0.7.png in the 640x360 logical space. The blinking marker
 * is placed just left of it. Cosmetic only — if the cover is replaced the
 * marker moves, it does not break anything.
 */
/* Measured off the cover: its prompt box spans x 55..281 and the words
   "PRESS ENTER / START" sit at x 113..245, centred on y 265. The marker goes
   just inside the box's left edge, on that centre line. */
const PROMPT = { x: 96, y: 259 } as const;

export class TitleScene extends Phaser.Scene {
  private blink?: Phaser.GameObjects.Text;
  private started = false;

  constructor() {
    super(SCENE.TITLE);
  }

  preload(): void {
    /* The title cue is the first audio anyone hears, so it loads here rather
       than in the boot pass — the boot pass must not block on a 74 KB track
       that cannot legally play until the visitor presses a key anyway. */
    queueAudio(this.load, [MUSIC.title, MUSIC.introduction]);
  }

  create(): void {
    const ctx = getCtx(this);
    /* Phaser reuses one instance of each Scene class for the life of the Game,
       so a class field initialised at construction keeps its value across every
       later visit. Left unreset, the first deploy latched this true and Enter
       did nothing forever after — which makes the credits -> title -> play loop
       unreachable. */
    this.started = false;

    /* The cover IS the title screen.
       Mars_Title_Cover_v0.7.png is a finished piece of key art: it already
       carries the wordmark, the tagline, "PRESS ENTER / START" and a controls
       list, all set in the game's own lettering. Drawing a second wordmark, a
       second subtitle and a second controls strip on top of it — which is what
       this scene used to do — produced two of everything, overlapping. So the
       art is shown at full bleed and undimmed, and the only thing added is a
       blinking marker beside the prompt the art already draws. */
    if (this.textures.exists("mss-title-cover")) {
      this.add.image(VIEW.W / 2, VIEW.H / 2, "mss-title-cover").setDisplaySize(VIEW.W, VIEW.H);
    } else {
      /* No cover: fall back to typeset titling so the screen is never blank. */
      this.add.rectangle(0, 0, VIEW.W, VIEW.H, 0x1a0f14).setOrigin(0, 0);
      label(this, VIEW.W / 2, 108, "MARS: SIGNAL SIEGE", {
        size: 30, color: PALETTE.text, align: "center",
      });
      label(this, VIEW.W / 2, 148, "SIGNAL RECLAMATION CAMPAIGN", {
        size: 10, color: PALETTE.warn, align: "center",
      });
      controlsStrip(this, 250);
    }

    /* Sits immediately left of the cover's own "PRESS ENTER / START". */
    this.blink = label(this, PROMPT.x, PROMPT.y, "▶", {
      size: 11, color: PALETTE.accent,
    });
    /* prefers-reduced-motion suppresses decorative blinking, not gameplay. */
    if (!ctx.reduced) {
      this.tweens.add({
        targets: this.blink, alpha: 0.15, duration: 560,
        yoyo: true, repeat: -1,
      });
    }

    ctx.audio.playMusic("title");

    /* Streaming the heavier sets behind the title means mission select opens
       instantly instead of showing its own loading bar. */
    this.load.once(Phaser.Loader.Events.COMPLETE, () => registerAnimations(this));
    queueArt(this.load, SELECT_ART);
    queueArt(this.load, PLAY_ART);
    queueAudio(this.load, SFX_ASSETS);
    this.load.start();
  }

  update(): void {
    const ctx = getCtx(this);

    if (ctx.input.take("Escape")) {
      ctx.requestClose();
      return;
    }
    if (!this.started && ctx.input.take("Enter", "Space")) {
      this.started = true;
      ctx.audio.play("uiConfirm");
      registerAnimations(this);
      this.scene.start(SCENE.SELECT);
    }
  }
}
