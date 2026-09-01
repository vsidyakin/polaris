/* SOLAR CIRCUIT — the HUD.
 *
 * Everything drawn on the glass: the stopwatch, the speed readout, the score and
 * its pad chain, the tier callouts that fire as the craft breaks into a new
 * speed band, and the two centre panels — the start prompt and the finish card.
 *
 * WHAT THE LAYOUT IS FOR
 *
 * The corners are not decoration, they are a reading order. Time is the
 * objective, so it is top-centre in the largest type on screen. Score is the
 * reward, so it is top-right where the eye goes next. Speed is the thing the
 * player is controlling moment to moment, so it is bottom-right, near where they
 * are actually looking — which at speed is the craft, not the horizon. The
 * top-left is left empty because the overlay puts ✕ and mute there, and the left
 * edge below it belongs to the course map.
 *
 * EVERYTHING HERE IS PINNED WITH setScrollFactor(0)
 *
 * The whole scene rides the camera, which `warp.ts` jitters at speed. A stopwatch
 * that shakes is a stopwatch you cannot read at exactly the moment it matters.
 * The HUD is the one layer nailed to the glass.
 *
 * WHY THE ANIMATIONS ARE HAND-ROLLED
 *
 * The callouts and the score punch are eased off a counter rather than through
 * Phaser's tween manager. The scene is restarted on every run, and a tween
 * outliving its target is the classic way that goes wrong — it fires on a
 * destroyed Text and takes the frame with it. A number decremented in `update()`
 * cannot outlive the object holding it.
 */

import Phaser from "phaser";
import { VIEW } from "./view";

/** What the scene is doing. The HUD shows a different centre panel for each. */
export type RacePhase = "countdown" | "running" | "finished";

export interface HudState {
  speedFraction: number;
  onRoad: boolean;
  phase: RacePhase;
  /** Elapsed run time, in seconds. */
  seconds: number;
  /** Boost meter, 0..1. */
  charge: number;
  /** Whether the boost is burning right now. */
  boosting: boolean;
  /** Countdown lamps lit so far, 0..3. */
  lit: number;
  /** Whether the lamps should be on screen at all. */
  showLights: boolean;
  /** The course being run, for the corner label. */
  track: string;
  /** The craft being flown — its name and its accent. */
  ship: { name: string; color: string };
}

const FONT = "ui-monospace, Menlo, Consolas, monospace";
const SHADOW = "#05060f";
const MUTED_INK = "#8f85b8";

/* --- score ---
 * Points per frame at nominal speed before the multiplier, and how hard the rate
 * leans on speed.
 *
 * Linear in speed the score would just be a distance meter: at six times the
 * speed you cover six times the ground and collect six times the points, so
 * going fast would be worth exactly as much per metre as crawling. On an
 * exponent of 1.6 the top of the ladder is worth about nineteen times the
 * nominal rate, which is enough that a fast clean run and a slow clean run are
 * not the same achievement. */
const RATE = 7;
const RATE_EXP = 1.6;

/** Points per frame lost off the trail, and how much worse that gets the longer
 *  you stay off — so a moment's excursion is nearly free and wallowing in the
 *  regolith empties the bank. */
const DRAIN = 14;
const DRAIN_RAMP = 1 / 45;
const DRAIN_MAX = 6;

/** Seconds a pad chain survives without another pad.
 *
 * The brief was that pads multiply 2x, 3x, 4x "and so on", and that going off
 * the trail costs the bonus from hitting pads "in a row". A chain that only ever
 * reset on a mistake would not be a chain — it would ratchet up forever — so it
 * also lapses a rung at a time on its own. That is what makes "in a row" mean
 * something, and it is the one rule here that was inferred rather than asked
 * for; it is the dial to turn if the chain feels wrong. */
const CHAIN_HOLD = 6;

/** Multiplier tiers get their own colour, so the number is readable at a glance
 *  from peripheral vision — the only kind of attention the player has spare at
 *  the top of the ladder. */
const TIER_COLORS = ["#8f85b8", "#5ef0ff", "#a58cff", "#e8c76a", "#e0895c"];

/* --- speed tiers ---
 * Callouts that fire once, on the way up, as the craft breaks into a new band.
 *
 * They exist because the speed READOUT is a number in a corner, and numbers are
 * not felt. At four times nominal the trail is a blur, the tunnel is closing and
 * the engine is screaming, and none of that tells the player they have just
 * achieved something — it only tells them things are happening. A word in the
 * middle of the screen is the acknowledgement, and it is the cheapest one there
 * is.
 *
 * On the way DOWN they say nothing. A game that announces every loss of speed is
 * nagging, and the player already knows: they are the one who ran wide. */
const TIERS: ReadonlyArray<{ at: number; label: string; color: string }> = [
  { at: 1.5, label: "SPOOLING UP", color: "#7ce3a8" },
  { at: 2.5, label: "SUPERSONIC", color: "#5ef0ff" },
  { at: 3.5, label: "BLISTERING", color: "#a58cff" },
  { at: 4.5, label: "INCANDESCENT", color: "#e8c76a" },
  { at: 5.5, label: "LUDICROUS", color: "#e0895c" },
  { at: 5.95, label: "MAXIMUM BURN", color: "#ff6fe0" },
];

/** Frames a callout lives for: a punch in, a hold, then a drift out. */
const CALLOUT_LIFE = 78;

/** Nominal top speed is shown as this, so the readout is a speed the player has
 *  intuitions about rather than world units per frame. */
const KPH_AT_NOMINAL = 200;

/* --- the boost meter ---
 * Bottom-left, under the course map. A bar, a label, and one piece of animation
 * that is doing real work.
 *
 * THE GHOST IS THE ANIMATION
 *
 * The filled bar tracks the meter exactly, frame for frame. A second, dimmer bar
 * behind it — the ghost — chases that level down with a lag. When the meter is
 * filling they sit on top of each other and it is invisible; the moment the
 * player lights the boost, the real bar drops away and leaves a bright band of
 * ghost hanging behind it, which drains after it.
 *
 * That gap is the whole effect, and it is the one every fighting game uses for
 * chip damage, for the same reason: a bar that simply gets shorter shows the
 * player the new value, and a bar with a ghost shows them HOW MUCH THEY JUST
 * SPENT. Spending is the thing this mechanic is about.
 *
 * AND THE FILL SWEEPS IN
 *
 * The gain has the mirror problem. A pad adds its charge in a single frame, and
 * a bar that jumps is a bar the player's eye never sees move — they look down
 * later and it is simply longer, with nothing connecting that to the plate they
 * drove over. So the drawn level chases the real one UPWARDS too, over about a
 * fifth of a second, and its leading edge flares while it is moving. The meter
 * is then legible in both directions: charge sweeps in, spending drops away and
 * leaves a ghost behind it. */
const BAR = { x: 24, y: VIEW.H - 74, w: 320, h: 20 };
/** Share of the remaining gap the ghost closes per frame. */
const GHOST_CHASE = 0.055;
/** ...and the share the drawn level closes while filling. Faster than the ghost:
 *  a gain should feel prompt, a loss should linger. */
const FILL_CHASE = 0.16;
/** Frames the leading edge stays flared after the level stops rising. */
const GAIN_FLASH = 14;
/** The bar pulses while burning, so the corner of the eye can tell a meter
 *  going down from a meter simply sitting there. */
const PULSE_RATE = 0.22;

/* --- the starting lights ---
 * Three lamps in a housing, dead centre, red then amber then green.
 *
 * Vertical and round, because that is what the shape says without a caption: a
 * row of horizontal lights is a drag strip, a stack of three is a stoplight, and
 * everybody already knows what a stoplight means. The unlit lamps are drawn too
 * — a housing with two holes in it tells the player how many are still to come,
 * where lamps that appear one at a time do not. */
const LAMPS = [
  { on: 0xff5540, off: 0x3a1512 },
  { on: 0xffc23c, off: 0x3a2c10 },
  { on: 0x5ef04a, off: 0x143a12 },
];
const LAMP_R = 21;
const LAMP_GAP = 52;

export class Hud {
  private readonly timeText: Phaser.GameObjects.Text;
  private readonly timeLabel: Phaser.GameObjects.Text;
  private readonly scoreText: Phaser.GameObjects.Text;
  private readonly multText: Phaser.GameObjects.Text;
  private readonly speedText: Phaser.GameObjects.Text;
  private readonly speedUnit: Phaser.GameObjects.Text;
  private readonly calloutText: Phaser.GameObjects.Text;
  private readonly panelText: Phaser.GameObjects.Text;
  private readonly barGfx: Phaser.GameObjects.Graphics;
  private readonly barLabel: Phaser.GameObjects.Text;
  private readonly lightsGfx: Phaser.GameObjects.Graphics;
  private readonly runLabel: Phaser.GameObjects.Text;

  /** The drawn level, which eases up to the real charge; and the ghost, which
   *  trails it down. See the note on BAR. */
  private shown = 0;
  private ghost = 0;
  private gainFlash = 0;
  private pulse = 0;

  /** Kept as a float and only rounded for display, so a fractional rate does not
   *  quantise away at low speed. */
  private score = 0;
  private multiplier = 1;
  /** Frames since the last pad, and frames since leaving the trail. */
  private sinceChain = 0;
  private offFrames = 0;
  /** Eased scale bump on the score when a pad lands. */
  private punch = 0;
  /** Highest tier already announced. Comparing against the highest REACHED
   *  rather than the current band is what stops a craft sitting on a boundary
   *  from strobing the same word over and over. */
  private tier = -1;
  private callout = 0;

  constructor(scene: Phaser.Scene) {
    /* A monospace stack rather than the site's Poppins. Canvas text cannot use a
       web font that has not finished loading, and a readout whose digits change
       width jitters every frame it ticks. */
    const mk = (x: number, y: number, size: number, color: string, ox: number, oy = 0) =>
      scene.add
        .text(x, y, "", { fontFamily: FONT, fontSize: `${size}px`, color, align: "center" })
        .setOrigin(ox, oy)
        .setScrollFactor(0)
        .setShadow(0, 2, SHADOW, 7, false, true);

    this.timeText = mk(VIEW.W / 2, 30, 46, "#e2d9ff", 0.5);
    this.timeLabel = mk(VIEW.W / 2, 14, 13, "#8f85b8", 0.5);
    this.scoreText = mk(VIEW.W - 24, 22, 32, "#e2d9ff", 1);
    this.multText = mk(VIEW.W - 24, 62, 24, TIER_COLORS[0]!, 1);
    this.speedText = mk(VIEW.W - 24, VIEW.H - 84, 54, "#e2d9ff", 1);
    this.speedUnit = mk(VIEW.W - 24, VIEW.H - 34, 16, "#8f85b8", 1);
    this.calloutText = mk(VIEW.W / 2, VIEW.H * 0.34, 46, "#e2d9ff", 0.5, 0.5);
    this.panelText = mk(VIEW.W / 2, VIEW.H * 0.62, 28, "#e2d9ff", 0.5, 0.5);

    this.barGfx = scene.add.graphics({ x: 0, y: 0 }).setScrollFactor(0);
    this.lightsGfx = scene.add.graphics({ x: 0, y: 0 }).setScrollFactor(0);
    this.barLabel = mk(BAR.x, BAR.y - 20, 14, "#8f85b8", 0);

    this.runLabel = mk(VIEW.W / 2, 78, 13, MUTED_INK, 0.5);

    this.timeLabel.setText("ELAPSED");
    this.speedUnit.setText("KM/H");
    this.reset();
  }

  reset(): void {
    this.score = 0;
    this.multiplier = 1;
    this.sinceChain = 0;
    this.offFrames = 0;
    this.punch = 0;
    this.tier = -1;
    this.callout = 0;
    this.calloutText.setText("");
    this.calloutText.setAlpha(0);
    this.panelText.setText("");
    this.shown = 0;
    this.ghost = 0;
    this.gainFlash = 0;
    this.pulse = 0;
    this.barGfx.clear();
    this.lightsGfx.clear();
  }

  /** The score as it stands, for the board. */
  get total(): number {
    return Math.floor(this.score);
  }

  /** A pad landed: up the chain and restart its clock. */
  onBoost(): void {
    this.multiplier += 1;
    this.sinceChain = 0;
    this.punch = 1;
  }

  update(s: HudState): void {
    if (s.phase === "running") this.accrue(s);

    this.timeText.setText(Hud.clock(s.seconds));
    this.runLabel.setText(`${s.track}   ·   ${s.ship.name}`);
    this.runLabel.setColor(s.ship.color);
    this.renderSpeed(s.speedFraction);
    this.renderScore();
    this.renderBoost(s);
    this.renderLights(s);
    this.renderCallout(s);
    this.renderPanel(s);
  }

  private renderLights(s: HudState): void {
    const g = this.lightsGfx;
    g.clear();
    if (!s.showLights) return;

    const cx = VIEW.W / 2;
    const top = VIEW.H * 0.3;
    const h = LAMP_GAP * 2 + LAMP_R * 2 + 26;
    const w = LAMP_R * 2 + 26;

    g.fillStyle(0x0b0918, 0.82);
    g.fillRect(cx - w / 2, top - LAMP_R - 13, w, h);
    g.lineStyle(2, 0x4a3d7d, 0.9);
    g.strokeRect(cx - w / 2, top - LAMP_R - 13, w, h);

    for (let i = 0; i < LAMPS.length; i++) {
      const y = top + i * LAMP_GAP;
      const lamp = LAMPS[i]!;
      const on = i < s.lit;
      g.fillStyle(on ? lamp.on : lamp.off, 1);
      g.fillCircle(cx, y, LAMP_R);
      /* A lit lamp gets a halo. It is the difference between a coloured circle
         and a light that has just come on. */
      if (on) {
        g.fillStyle(lamp.on, 0.22);
        g.fillCircle(cx, y, LAMP_R + 9);
      }
      g.lineStyle(2, 0x000000, 0.55);
      g.strokeCircle(cx, y, LAMP_R);
    }
  }

  private renderBoost(s: HudState): void {
    const charge = Phaser.Math.Clamp(s.charge, 0, 1);

    /* The drawn level sweeps UP to a gain and snaps DOWN to a spend. Easing the
       drop as well would hide the spend behind the ghost, which is the one thing
       the ghost exists to show. */
    if (charge > this.shown + 0.0005) {
      this.shown = Math.min(charge, this.shown + (charge - this.shown) * FILL_CHASE + 0.002);
      this.gainFlash = GAIN_FLASH;
    } else {
      this.shown = charge;
      if (this.gainFlash > 0) this.gainFlash--;
    }

    /* The ghost then trails the DRAWN level down, not the real one, or a spend
       part-way through a sweep-in would strand it above a bar that had never got
       that far. */
    this.ghost = this.shown > this.ghost ? this.shown : this.ghost + (this.shown - this.ghost) * GHOST_CHASE;
    this.pulse = s.boosting ? this.pulse + PULSE_RATE : 0;

    const g = this.barGfx;
    g.clear();

    g.fillStyle(0x0b0918, 0.55);
    g.fillRect(BAR.x, BAR.y, BAR.w, BAR.h);

    /* the ghost, behind everything */
    if (this.ghost > charge + 0.002) {
      g.fillStyle(0xe0895c, 0.55);
      g.fillRect(BAR.x, BAR.y, BAR.w * this.ghost, BAR.h);
    }

    /* the meter itself */
    if (this.shown > 0) {
      const hot = s.boosting ? 0.72 + Math.sin(this.pulse) * 0.28 : 1;
      /* Amber until it is worth spending, then Polaris cyan: the colour change
         IS the "you can use this now" cue, and it costs no extra pixels. */
      g.fillStyle(charge >= 0.2 ? 0x5ef0ff : 0xe8c76a, hot);
      g.fillRect(BAR.x, BAR.y, BAR.w * this.shown, BAR.h);

      /* The leading edge, flared while the level is still sweeping in. */
      if (this.gainFlash > 0) {
        const k = this.gainFlash / GAIN_FLASH;
        g.fillStyle(0xf4feff, 0.35 + k * 0.65);
        g.fillRect(BAR.x + BAR.w * this.shown - 3, BAR.y, 3, BAR.h);
      }
    }

    g.lineStyle(1, 0x4a3d7d, 0.7);
    g.strokeRect(BAR.x, BAR.y, BAR.w, BAR.h);

    this.barLabel.setText(s.boosting ? "BOOST  ▸  BURNING" : charge >= 0.2 ? "BOOST  ▸  SHIFT" : "BOOST");
    this.barLabel.setColor(s.boosting ? "#e0895c" : charge >= 0.2 ? "#5ef0ff" : "#8f85b8");
  }

  /** The score model. Only runs while the race is live, so neither the start
   *  line nor the finish card is a place to farm points. */
  private accrue(s: HudState): void {
    if (s.onRoad) {
      this.offFrames = 0;
      this.score += RATE * Math.pow(Math.max(0, s.speedFraction), RATE_EXP) * this.multiplier;

      /* The chain lapses a rung at a time rather than all at once, so a player
         who is one pad late loses one multiple and not the whole run. */
      if (this.multiplier > 1 && ++this.sinceChain >= CHAIN_HOLD * 60) {
        this.multiplier -= 1;
        this.sinceChain = 0;
      }
    } else {
      /* Off the trail: the chain is gone immediately — that is the cost the
         brief asks for — and the score starts falling. */
      this.multiplier = 1;
      this.sinceChain = 0;
      this.offFrames++;
      this.score = Math.max(0, this.score - DRAIN * Math.min(DRAIN_MAX, 1 + this.offFrames * DRAIN_RAMP));
    }

    if (this.punch > 0) this.punch = Math.max(0, this.punch - 0.06);
  }

  /** m:ss.hh, fixed width so the readout cannot jitter as digits change. */
  static clock(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    const h = Math.floor((seconds * 100) % 100);
    return `${m}:${String(s).padStart(2, "0")}.${String(h).padStart(2, "0")}`;
  }

  private renderSpeed(speedFraction: number): void {
    this.speedText.setText(String(Math.round(Math.max(0, speedFraction) * KPH_AT_NOMINAL)));
    /* The readout warms towards the top of the range, so the corner of the eye
       gets the same information the number does. */
    const t = Phaser.Math.Clamp(speedFraction / 6, 0, 1);
    this.speedText.setColor(t > 0.75 ? "#e0895c" : t > 0.5 ? "#e8c76a" : t > 0.25 ? "#5ef0ff" : "#e2d9ff");
  }

  private renderScore(): void {
    /* Zero-padded and fixed width: an arcade readout, and one that cannot move
       the rest of the HUD when it gains a digit. */
    this.scoreText.setText(Math.floor(this.score).toString().padStart(8, "0"));
    this.scoreText.setScale(1 + this.punch * 0.22);

    const tier = TIER_COLORS[Math.min(TIER_COLORS.length - 1, this.multiplier - 1)]!;
    this.multText.setText(this.multiplier > 1 ? `x${this.multiplier}` : "");
    this.multText.setColor(tier);
    this.scoreText.setColor(this.multiplier > 1 ? tier : "#e2d9ff");
  }

  private renderCallout(s: HudState): void {
    if (s.phase === "running") {
      /* Fire on the highest band newly crossed — highest first, so a pad that
         vaults two bands at once announces the one actually reached. */
      for (let i = TIERS.length - 1; i > this.tier; i--) {
        if (s.speedFraction >= TIERS[i]!.at) {
          this.tier = i;
          this.callout = CALLOUT_LIFE;
          this.calloutText.setText(TIERS[i]!.label);
          this.calloutText.setColor(TIERS[i]!.color);
          break;
        }
      }
    }

    if (this.callout <= 0) {
      this.calloutText.setAlpha(0);
      return;
    }
    this.callout--;

    /* One shape, three phases: punch in past full size, settle back, then drift
       up and out. `k` runs 1 at birth to 0 at death. */
    const k = this.callout / CALLOUT_LIFE;
    const age = 1 - k;
    const grow = age < 0.14 ? 0.55 + (age / 0.14) * 0.72 : Math.max(1, 1.27 - (age - 0.14) * 1.9);
    const fade = Math.min(1, k / 0.34);
    this.calloutText.setScale(grow);
    this.calloutText.setAlpha(k > 0.72 ? (1 - k) / 0.28 : fade);
    this.calloutText.setY(VIEW.H * 0.34 - (1 - fade) * 26);
  }

  private renderPanel(s: HudState): void {
    if (s.phase === "countdown") {
      /* Under the lights rather than over them: the lights are the instruction
         and this is only the caption. */
      this.panelText.setAlpha(1);
      this.panelText.setColor("#8f85b8");
      this.panelText.setText("POINT A  →  POINT B");
      return;
    }
    if (s.phase === "finished") {
      this.panelText.setAlpha(1);
      this.panelText.setColor("#e8c76a");
      this.panelText.setText(
        `POINT B\n\n${s.track}\n\n${Hud.clock(s.seconds)}\n${this.total.toLocaleString("en-GB")} PTS\n\nR  RUN AGAIN        ENTER  MENU`,
      );
      return;
    }
    this.panelText.setAlpha(0);
  }
}

export default Hud;
