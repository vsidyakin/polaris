/* Mars: Signal Siege — the mission.
 *
 * The simulation is deterministic and hand-rolled (no Arcade Physics), but it
 * lives entirely inside Phaser's lifecycle: `update` is driven by Phaser's
 * loop, every actor is a real Sprite in a real display list, animations are
 * Phaser animations, the camera is Phaser's camera, and sound goes through the
 * sound manager. There is no second requestAnimationFrame anywhere in this
 * module, and nothing is composited into an offscreen canvas.
 *
 * Delta is clamped before anything reads it. At 20 fps an unclamped step moves
 * a 560 px/s bolt 28 px in one frame, which is wider than a mite — projectiles
 * additionally sub-step inside ProjectileSystem for the same reason.
 */

import Phaser from "phaser";
import { BOSS, CAMERA, FX, PLAYER, TIMING, WORLD } from "../tuning";
import { getCtx } from "../context";
import { MISSIONS, WEAPONS, FINAL_MISSION, enemyGroupFor, cueFor } from "../data";
import { markCleared } from "../progress";
import { buildStage, type Platform, type Stage } from "../levels";
import { environmentKey, SHEET, type SfxName, terrainKey } from "../assets";
import { ANIM, frameOf, registerAnimations } from "../anims";
import { Rook, type RookInputs } from "../entities/Rook";
import { Enemy } from "../entities/Enemy";
import { Boss, type BossAttack } from "../entities/Boss";
import { ProjectileSystem, type Shot } from "../systems/ProjectileSystem";
import { WeaponSystem, aimVector } from "../systems/WeaponSystem";
import { SCENE } from "./PreloadScene";
import { label, PALETTE, panel, Toast } from "./ui";

interface Drop {
  sprite: Phaser.GameObjects.Sprite;
  x: number;
  y: number;
  vy: number;
  weapon: number;
  life: number;
  active: boolean;
}

const VIEW_W = 640;
const VIEW_H = 360;

/* Backdrop zoom. 1280 source px of mirrored strip at this scale repeats every
   1280*BG_SCALE screen px, which at the parallax rate below is about 5.5k world
   px — roughly one mirror crossing per stage instead of one per screen. */
const BG_SCALE = 1.5;
/* Push the crop down off the sky so the horizon sits where the art composed it. */
const BG_HORIZON_NUDGE = 26;
/** How much slower than the world the backdrop travels. */
const BG_PARALLAX = 0.35;

/** The two non-weapon rows of the pause menu. */
/* Height of a platform's lit top band, matching the cap texture the art build
   emits. Ledges get a shorter one so a 14 px girder is not all cap. */
const CAP_H = 14;

/**
 * Where an enemy's shot actually leaves it, as an offset from its body-box
 * centre. Measured off the `*_attack` cells of the shipped atlas.
 *
 * Every enemy used to fire from the middle of its own torso while the drawn
 * weapon pointed somewhere else — 15 to 35 px out, which is 23–51% of the
 * sprite's own width. Rook's muzzles are measured per frame by the art build
 * and resolved through a socket table; the roster has no sockets yet, so this
 * is the interim, keyed by behaviour rather than by kind because a role's
 * silhouette is what determines where its gun is.
 */
const ENEMY_MUZZLE: Record<string, { x: number; y: number }> = {
  rifleman: { x: 26, y: -4 },
  jumper: { x: 26, y: -4 },
  emplacement: { x: 26, y: 5 },
  runner: { x: 19, y: 0 },
  hover: { x: 20, y: -2 },
  swarm: { x: 18, y: 1 },
};

const PAUSE_ACTIONS = ["RESUME MISSION", "RETURN TO MISSION SELECT"] as const;

export class PlayScene extends Phaser.Scene {
  private stage!: Stage;
  private rook!: Rook;
  private enemies: Enemy[] = [];
  private boss: Boss | null = null;
  private projectiles!: ProjectileSystem;
  private weapons!: WeaponSystem;
  private drops: Drop[] = [];
  private particles!: Phaser.GameObjects.Particles.ParticleEmitter;

  private worldLayer!: Phaser.GameObjects.Container;
  private hudLayer!: Phaser.GameObjects.Container;
  private pauseLayer!: Phaser.GameObjects.Container;
  private toast!: Toast;

  private bgNear?: Phaser.GameObjects.TileSprite;
  private bgBaseY = 0;

  private bossActive = false;
  private bossBarBg?: Phaser.GameObjects.Graphics;
  private bossBar?: Phaser.GameObjects.Graphics;
  private bossName?: Phaser.GameObjects.Text;

  private paused = false;
  private pauseChoice = 0;
  private clearTimer = 0;
  /** Grace window after a hold-Down-plus-Jump, during which one-way platforms
   *  are not solid. Without it Rook re-lands on the girder he just left. */
  private dropThrough = 0;
  /* The camera's true, unrounded position. What reaches the camera is this
     rounded to whole world pixels — see updateCamera(). */
  private camX = 0;
  private camY = 0;
  /** The pause screen's "MISSION 07 · CATACOMB RELAY" line. */
  private pauseMission?: Phaser.GameObjects.Text;
  private ending = false;

  private hudText!: Phaser.GameObjects.Text;
  private hudWeapon!: Phaser.GameObjects.Text;
  private healthBar!: Phaser.GameObjects.Graphics;

  /** The surface the player most recently landed on. A checkpoint is seated
   *  inside this rather than at the player's raw x. */
  private lastGround: Platform | null = null;

  /** Deterministic per-mission stream for drops. */
  private rollState = 0;
  private roll(): number {
    this.rollState = (this.rollState + 0x6d2b79f5) >>> 0;
    let t = Math.imul(this.rollState ^ (this.rollState >>> 15), 1 | this.rollState);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Exposed for the QA harness: what happened this mission.
   *  Deliberately not called `events` — Phaser.Scene already owns that name
   *  for its EventEmitter, and shadowing it makes PlayScene structurally
   *  incompatible with Scene everywhere it is passed as one. */
  readonly missionLog: string[] = [];

  constructor() {
    super(SCENE.PLAY);
  }

  // ------------------------------------------------------------------ setup

  create(): void {
    const ctx = getCtx(this);
    const index = ctx.run.mission;
    const mission = MISSIONS[index];
    this.stage = buildStage(index);
    /* Phaser reuses one instance of each Scene class for the life of the Game,
       so every field that is not reset here survives into the next mission.
       `drops` in particular is only sized in the constructor: without this
       reset, buildDrops() appends six more slots per mission and spawnDrop()
       picks the FIRST free one — a sprite the display list already destroyed at
       shutdown, whose `scene` is undefined, which throws inside update() the
       first time mission two drops a weapon. */
    this.drops.length = 0;
    this.enemies.length = 0;
    this.boss = null;
    this.bossActive = false;
    this.paused = false;
    this.clearTimer = 0;
    this.dropThrough = 0;
    this.camX = 0;
    this.camY = 0;
    this.ending = false;
    this.missionLog.length = 0;
    this.rollState = 7919 + index * 104729;
    this.lastGround = null;

    /* Idempotent, and the first call that can actually see the gameplay sheets
       — the title screen may have tried while they were still downloading. */
    registerAnimations(this);

    this.cameras.main.setBounds(0, 0, this.stage.worldW, this.stage.worldH);
    this.cameras.main.setBackgroundColor("#0a0812");

    this.buildBackground(mission.environment);

    this.worldLayer = this.add.container(0, 0);
    this.drawPlatforms();

    /* Boss gate: a lit threshold the player can see coming, so the arena is
       signposted rather than stumbled into. Drawn as a soft column that fades
       out at both ends — a hard full-height bar reads as a rendering fault
       rather than as part of the world, especially where it crosses the HUD. */
    if (!this.stage.vertical) {
      const gate = this.add.graphics();
      const accentColor = Phaser.Display.Color.HexStringToColor(mission.accent).color;
      for (let i = 0; i < 5; i++) {
        gate.fillStyle(accentColor, 0.05 + i * 0.03);
        gate.fillRect(this.stage.bossGateX - 22 + i * 5, 60, 44 - i * 10, VIEW_H - 60);
      }
      gate.fillStyle(accentColor, 0.5);
      gate.fillRect(this.stage.bossGateX - 1, 96, 2, VIEW_H - 96);
      this.worldLayer.add(gate);
    }

    this.projectiles = new ProjectileSystem(this, this.worldLayer);
    this.weapons = new WeaponSystem(this.projectiles, ctx.audio);

    this.particles = this.add.particles(0, 0, SHEET.shots.key, {
      frame: frameOf("projectiles.png", "pshot0"),
      lifespan: { min: 260, max: 620 },
      speed: { min: 40, max: 190 },
      scale: { start: 0.28, end: 0 },
      quantity: 0,
      emitting: false,
      gravityY: 220,
      maxAliveParticles: FX.PARTICLE_POOL,
    });
    this.worldLayer.add(this.particles);

    this.spawnRook();
    this.spawnEnemies();
    this.spawnBoss();
    this.buildDrops();
    this.buildHud();

    /* Phaser's Systems.shutdown() emits SHUTDOWN; it does not invoke a method
       called `shutdown`. Subscribing is the only thing that makes the teardown
       below actually run. `once` per create(), so repeated missions do not
       stack listeners. */
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.teardown());

    this.toast = new Toast(this);
    this.pauseLayer = this.add.container(0, 0).setScrollFactor(0).setDepth(1000).setVisible(false);
    this.buildPauseMenu();

    ctx.audio.playMusic(this.currentCue());
    ctx.input.setSecretHandler(() => {
      ctx.run.secretLives = true;
      this.rook.lives = PLAYER.LIVES_SECRET;
      this.toast.show("30 LIVES  ·  SIGNAL RESERVE UNLOCKED", 3);
      getCtx(this).audio.play("pickup");
    });
  }

  /**
   * One seamless scrolling backdrop.
   *
   * The backdrop art is exactly one viewport wide, so tiling it directly puts a
   * hard vertical seam on screen every 640 px — the artwork's left edge slammed
   * against its right edge. The standalone solved this by building a
   * double-width strip whose second half is the image mirrored, so the join is
   * continuous in both directions and the strip tiles invisibly. Same trick
   * here, built once per mission into a canvas texture rather than shipped as a
   * second 2x-wide PNG.
   *
   * Deliberately ONE layer. The earlier version stacked two tinted copies of the
   * same image at different scroll rates, which is not parallax depth — it is
   * the same picture ghosted over itself, and it read as a broken duplicate
   * rather than as distance.
   */
  private buildBackground(env: string): void {
    const key = environmentKey(env as never);
    if (!this.textures.exists(key)) return;

    const stripKey = `${key}-strip`;
    if (!this.textures.exists(stripKey)) {
      const src = this.textures.get(key).getSourceImage() as CanvasImageSource;
      const w = this.textures.get(key).source[0].width;
      const h = this.textures.get(key).source[0].height;
      const tex = this.textures.createCanvas(stripKey, w * 2, h);
      if (tex) {
        const c = tex.getContext();
        c.imageSmoothingEnabled = false;
        c.drawImage(src, 0, 0, w, h);
        /* Mirrored second half: the strip's right edge is now identical to its
           left edge, so the wrap has nothing to see. */
        c.save();
        c.translate(w * 2, 0);
        c.scale(-1, 1);
        c.drawImage(src, 0, 0, w, h);
        c.restore();
        tex.refresh();
      }
    }

    this.bgNear = this.add
      .tileSprite(0, 0, VIEW_W, VIEW_H, this.textures.exists(stripKey) ? stripKey : key)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(-20);

    /* Zoom the strip in.
       At 1:1 the mirrored half and its reflection are both on screen at once,
       and the backdrop reads as a symmetrical inkblot rather than as a
       landscape — two identical skylines facing each other across the middle of
       the frame. Scaling up pushes the mirror axis apart so at most one crossing
       occurs over a whole stage, and the visible crop reads as continuous
       terrain. The vertical offset keeps the horizon where the art composed it
       rather than centring the crop on the sky. */
    this.bgNear.setTileScale(BG_SCALE, BG_SCALE);
    this.bgBaseY = (VIEW_H * BG_SCALE - VIEW_H) / (2 * BG_SCALE) + BG_HORIZON_NUDGE;
    this.bgNear.tilePositionY = this.bgBaseY;

    /* No tint here any more, deliberately.
       The backdrop still has to sit behind the ground — both are cut from one
       painting, so without separation the platforms vanish into the scenery —
       but that separation is now made at build time, where it can be measured
       against the ground it has to separate from. One flat multiply applied to
       six paintings of very different exposure could not do that job: the same
       constant that read correctly on the dustline arrived at four percent
       luminance in the catacombs and the foundry core, which is why the final
       mission looked like it had no background art at all. build-mars-art now
       exposes every backdrop to a fixed fraction of its own ground texture, so
       what ships is already at the right value and multiplying it again here
       would simply take it back to black. */
  }

  /**
   * Platforms, drawn as lit foreground decks rather than as flat slabs.
   *
   * These sit in front of a fully painted backdrop, so a plain filled rectangle
   * with a hairline on top reads as a hole punched in the artwork — which is
   * exactly what the first pass looked like. The structure below gives every
   * surface a lit lip, a rock or plate band that catches the mission's accent,
   * and a body with vertical striations, so it reads as something standing in
   * front of the scene rather than as a UI element laid over it.
   */
  private drawPlatforms(): void {
    const ctx = getCtx(this);
    const mission = MISSIONS[ctx.run.mission];
    const accent = Phaser.Display.Color.HexStringToColor(mission.accent).color;
    const bodyKey = terrainKey(mission.environment, "body");
    const capKey = terrainKey(mission.environment, "cap");
    const textured = this.textures.exists(bodyKey) && this.textures.exists(capKey);
    const g = this.add.graphics();
    this.worldLayer.add(g);

    for (const p of this.stage.platforms) {
      const thin = p.h <= 20;
      const capH = thin ? 6 : CAP_H;

      if (textured) {
        /* The mass, tiled from the sector's own rock. A TileSprite rather than
           a stretched image: a 900 px deck and a 90 px ledge have to show the
           same size grain, or the small one reads as a different material. */
        const bodyTop = p.y + capH;
        if (p.h > capH) {
          const body = this.add.tileSprite(
            p.x, bodyTop, p.w, p.h - capH, bodyKey).setOrigin(0, 0);
          /* Offset by world position so neighbouring platforms at the same
             height continue each other's grain instead of each restarting it. */
          body.tilePositionX = p.x % 128;
          body.tilePositionY = bodyTop % 64;
          this.worldLayer.add(body);
        }
        const cap = this.add.tileSprite(p.x, p.y, p.w, capH, capKey).setOrigin(0, 0);
        cap.tilePositionX = p.x % 128;
        this.worldLayer.add(cap);
      } else {
        /* Flat fallback, so a missing texture is a plain-looking stage rather
           than an invisible floor the player falls through. */
        g.fillStyle(p.type === "ice" ? 0x1d2a3c : 0x221b33, 1);
        g.fillRect(p.x, p.y, p.w, p.h);
        g.fillStyle(0xa9603c, 1);
        g.fillRect(p.x, p.y, p.w, capH);
      }

      /* Surfaces that BEHAVE differently have to LOOK different, whatever the
         sector's rock happens to be, so these tint over the texture rather
         than replacing it. */
      const wash =
        p.type === "ice" ? 0x9fe6ff :
        p.type === "conveyor" ? 0xff9b54 :
        p.type === "rail" ? 0xd59cff :
        p.type === "trench" ? 0xc08040 :
        null;
      if (wash !== null) {
        g.fillStyle(wash, 0.22);
        g.fillRect(p.x, p.y, p.w, p.h);
      }

      /* Hard silhouette.
         A textured deck in front of a textured painting needs an edge, or the
         two dissolve into each other — which is exactly what happened the first
         time the terrain went in: the ground looked superb and the player could
         no longer tell what they could stand on. Contra outlines its terrain
         for the same reason, and at speed the outline is doing more work than
         the texture is. */
      g.fillStyle(0x0a0712, 1);
      g.fillRect(p.x - 1, p.y - 2, p.w + 2, 2);
      g.fillRect(p.x - 1, p.y, 1, p.h);
      g.fillRect(p.x + p.w, p.y, 1, p.h);

      /* Lit lip: the line the player actually reads as "this is the floor".
         It stays a drawn primitive on purpose — it carries the mission accent
         and the one-way marking, and both have to survive whatever the rock
         underneath looks like. */
      g.fillStyle(p.type === "boss" ? 0xffffff : accent, 1);
      g.fillRect(p.x, p.y, p.w, 2);
      g.fillStyle(0xffffff, 0.22);
      g.fillRect(p.x, p.y + 2, p.w, 1);

      /* One-way girders read as a girder: a lighter, thinner slab with a gap
         under the lip, so "I can drop through this" is visible before the
         player tries it. */
      if (p.thin) {
        g.fillStyle(0x120d1f, 0.55);
        g.fillRect(p.x, p.y + capH - 1, p.w, 1);
      }

      /* Shadow under the cap, so the deck has thickness. */
      g.fillStyle(0x0d0916, 0.7);
      g.fillRect(p.x, p.y + capH, p.w, 2);

      /* And a soft one cast below the whole deck, which is what actually lifts
         a floating girder off the scenery behind it. */
      for (let i = 0; i < 4; i++) {
        g.fillStyle(0x07050e, 0.3 - i * 0.07);
        g.fillRect(p.x, p.y + p.h + i, p.w, 1);
      }

      /* Ends, so a ledge terminates in something rather than being cut off. */
      g.fillStyle(0x120d1f, 0.9);
      g.fillRect(p.x, p.y + 2, 2, p.h - 2);
      g.fillRect(p.x + p.w - 2, p.y + 2, 2, p.h - 2);

      /* Conveyors and rails carry direction chevrons so their behaviour is
         legible before the player steps on them. */
      if (p.dir !== 0) {
        g.fillStyle(accent, 0.8);
        for (let x = p.x + 12; x < p.x + p.w - 12; x += 22) {
          const tip = p.dir > 0 ? x + 7 : x - 7;
          g.fillTriangle(x, p.y + 5, x, p.y + 11, tip, p.y + 8);
        }
      }
    }
  }

  private spawnRook(): void {
    const ctx = getCtx(this);
    const sprite = this.add.sprite(0, 0, SHEET.rook.key, 0);
    this.worldLayer.add(sprite);
    this.rook = new Rook(sprite);
    this.rook.x = this.stage.spawn.x;
    this.rook.y = this.stage.spawn.y;
    this.rook.lives = ctx.run.secretLives ? PLAYER.LIVES_SECRET : ctx.run.lives;
    this.rook.weapon = 0;
    this.rook.health = this.rook.maxHealth = PLAYER.HP;
    this.rook.facing = 1;
  }

  private spawnEnemies(): void {
    const group = enemyGroupFor(getCtx(this).run.mission);
    this.enemies = this.stage.enemies.map((spawn, i) => {
      const sheet = (spawn.kind === "wasp" || spawn.kind === "crawler" || spawn.kind === "sentinel")
        ? SHEET.authored.key : SHEET.enemies.key;
      const sprite = this.add.sprite(0, 0, sheet, 0);
      this.worldLayer.add(sprite);
      /* The canopy is its own actor rather than a pose on the trooper: the
         trooper is an ordinary trooper the moment it lands, and a canopy baked
         into its cells would have to be erased from every pose after that. */
      let canopy: Phaser.GameObjects.Sprite | undefined;
      if (spawn.drop) {
        canopy = this.add.sprite(0, 0, SHEET.authored.key,
          frameOf("new-enemies.png", "canopy_drift"));
        canopy.play(ANIM.authored("canopy"), true);
        this.worldLayer.add(canopy);
      }
      return new Enemy(sprite, spawn, group, (i * 0.37) % 1, canopy);
    });
  }

  private spawnBoss(): void {
    const index = getCtx(this).run.mission;
    const sprite = this.add.sprite(0, 0, SHEET.bosses.key, 0);
    sprite.setVisible(false);
    this.worldLayer.add(sprite);
    this.boss = new Boss(sprite, index, this.stage.bossSpawn.x,
                         this.stage.bossSpawn.y, this.stage.bossSpawn.hp);
    this.boss.facing = -1;
  }

  private buildDrops(): void {
    for (let i = 0; i < 6; i++) {
      const sprite = this.add.sprite(0, 0, SHEET.shots.key, 0)
        .setVisible(false).setActive(false).setScale(0.9);
      this.worldLayer.add(sprite);
      this.drops.push({ sprite, x: 0, y: 0, vy: 0, weapon: 0, life: 0, active: false });
    }
  }

  private buildHud(): void {
    this.hudLayer = this.add.container(0, 0).setScrollFactor(0).setDepth(800);
    this.healthBar = this.add.graphics().setScrollFactor(0).setDepth(801);
    this.hudLayer.add(this.healthBar);
    this.hudText = label(this, 10, 10, "", { size: 9, color: PALETTE.text })
      .setScrollFactor(0).setDepth(802);
    this.hudWeapon = label(this, 10, 26, "", { size: 8, color: PALETTE.accent })
      .setScrollFactor(0).setDepth(802);
    this.hudLayer.add(this.hudText);
    this.hudLayer.add(this.hudWeapon);
  }

  /**
   * Pause doubles as the loadout screen.
   *
   * Selectable weapons are the ones the campaign has actually granted, plus the
   * Signal Pulse (always) and whatever drop Rook is carrying right now. Letting
   * the player pick freely from all eight would make enemy drops pointless and
   * the boss weaknesses trivial; letting them pick *nothing* would strand a
   * player who lost their upgrade one screen before the boss that needs it.
   */
  private unlockedWeapons(): Set<number> {
    const ctx = getCtx(this);
    const set = new Set<number>([0, this.rook.weapon]);
    for (const cleared of ctx.progress.cleared) set.add(MISSIONS[cleared].grant);
    return set;
  }

  private buildPauseMenu(): void {
    this.pauseLayer.add(
      this.add.rectangle(0, 0, VIEW_W, VIEW_H, 0x05040a, 0.94).setOrigin(0, 0),
    );
    this.pauseLayer.add(label(this, VIEW_W / 2, 16, "SIGNAL LOADOUT", {
      size: 18, color: PALETTE.text, align: "center",
    }));
    /* Which mission this is. The pause screen was the one place the player
       could stop and look, and it was the one place that did not say. */
    this.pauseMission = label(this, VIEW_W / 2, 36, "", {
      size: 9, color: PALETTE.accent, align: "center",
    });
    this.pauseLayer.add(this.pauseMission);

    const unlocked = this.unlockedWeapons();
    for (let i = 0; i < WEAPONS.length; i++) {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = 72 + col * 256;
      const y = 52 + row * 38;
      const open = unlocked.has(i);
      this.pauseLayer.add(panel(this, x, y, 238, 30,
        open ? PALETTE.panelEdge : "#2a2438",
        open ? PALETTE.panel : "#0d0a16"));
      const icon = this.add.sprite(x + 18, y + 15, SHEET.shots.key,
        frameOf("projectiles.png", `pshot${i}`)).setScale(0.66);
      if (!open) icon.setTint(0x2c2540);
      this.pauseLayer.add(icon);
      this.pauseLayer.add(label(this, x + 36, y + 4, WEAPONS[i].name, {
        size: 9, color: open ? PALETTE.text : "#4a4260",
      }));
      this.pauseLayer.add(label(this, x + 36, y + 17,
        open ? WEAPONS[i].role : "NOT YET RECOVERED", {
        size: 7, color: open ? PALETTE.warn : "#3f3854",
      }));
    }

    this.pauseLayer.add(label(this, VIEW_W / 2, 210,
      "UPGRADES ARE TEMPORARY  ·  ONE HIT RESTORES SIGNAL PULSE", {
      size: 8, color: PALETTE.warn, align: "center",
    }));

    for (let i = 0; i < PAUSE_ACTIONS.length; i++) {
      const x = 72 + i * 256;
      this.pauseLayer.add(panel(this, x, 236, 238, 30, PALETTE.panelEdge, PALETTE.panel));
      this.pauseLayer.add(label(this, x + 119, 245, PAUSE_ACTIONS[i], {
        size: 9, color: PALETTE.text, align: "center",
      }));
    }

    this.pauseLayer.add(label(this, VIEW_W / 2, 296,
      "ARROWS  SELECT     ENTER  CONFIRM     P / ESC  RESUME", {
      size: 8, color: PALETTE.accent, align: "center",
    }));
    this.pauseLayer.add(label(this, VIEW_W / 2, 312,
      "M  SOUND     F  VIEW", {
      size: 8, color: PALETTE.dim, align: "center",
    }));
  }

  // ----------------------------------------------------------------- update

  update(_time: number, deltaMs: number): void {
    const ctx = getCtx(this);
    const dt = Math.min(TIMING.MAX_DT, deltaMs / 1000);
    this.toast.update(dt);

    if (this.handlePause(dt)) return;
    if (this.ending) return;

    const inputs = this.readInputs();
    this.stepRook(dt, inputs);
    this.stepEnemies(dt);
    this.stepBoss(dt);
    this.stepShots(dt);
    this.stepDrops(dt);
    this.updateCamera(dt);
    this.updateHud();

    if (this.clearTimer > 0) {
      this.clearTimer -= dt;
      if (this.clearTimer <= 0) this.finishMission();
    }
  }

  private readInputs(): RookInputs {
    const i = getCtx(this).input;
    return {
      left: i.down("ArrowLeft", "KeyA"),
      right: i.down("ArrowRight", "KeyD"),
      up: i.down("ArrowUp", "KeyW"),
      down: i.down("ArrowDown", "KeyS"),
      firing: i.down("KeyX", "KeyJ", "ControlLeft"),
    };
  }

  /** Returns true if the frame was consumed by the pause menu. */
  private handlePause(dt: number): boolean {
    const ctx = getCtx(this);

    if (!this.paused && ctx.input.take("KeyP", "Escape")) {
      this.paused = true;
      this.pauseChoice = 0;
      const m = MISSIONS[ctx.run.mission];
      this.pauseMission?.setText(
        `MISSION ${String(ctx.run.mission + 1).padStart(2, "0")}  ·  ${m.sector.toUpperCase()}`
        + `  ·  ${m.boss.toUpperCase()}`);
      this.pauseLayer.setVisible(true);
      this.paintPause();
      ctx.audio.play("pause");
      ctx.audio.duck(true);
      return true;
    }
    if (!this.paused) return false;

    if (ctx.input.take("KeyP", "Escape")) {
      this.resumeFromPause();
      return true;
    }

    const total = WEAPONS.length + PAUSE_ACTIONS.length;
    const before = this.pauseChoice;
    /* Left/right steps within a row, up/down jumps a row — including into and
       out of the two action buttons, so everything is reachable without the
       player learning a special case. */
    if (ctx.input.take("ArrowRight", "KeyD")) this.pauseChoice = Math.min(total - 1, this.pauseChoice + 1);
    if (ctx.input.take("ArrowLeft", "KeyA")) this.pauseChoice = Math.max(0, this.pauseChoice - 1);
    if (ctx.input.take("ArrowDown", "KeyS")) this.pauseChoice = Math.min(total - 1, this.pauseChoice + 2);
    if (ctx.input.take("ArrowUp", "KeyW")) this.pauseChoice = Math.max(0, this.pauseChoice - 2);
    for (let i = 0; i < WEAPONS.length; i++) {
      if (ctx.input.take(`Digit${i + 1}`)) this.pauseChoice = i;
    }
    if (this.pauseChoice !== before) {
      ctx.audio.play("uiMove");
      this.paintPause();
    }

    if (ctx.input.take("Enter", "Space")) {
      if (this.pauseChoice < WEAPONS.length) {
        if (this.unlockedWeapons().has(this.pauseChoice)) {
          this.rook.weapon = this.pauseChoice;
          ctx.run.weapon = this.pauseChoice;
          ctx.audio.play("uiConfirm");
          this.resumeFromPause();
        } else {
          ctx.audio.play("deny");
          this.toast.show("CAPABILITY NOT YET RECOVERED", 1.8);
        }
      } else if (this.pauseChoice === WEAPONS.length) {
        ctx.audio.play("uiConfirm");
        this.resumeFromPause();
      } else {
        /* Abandon the mission. Progress already earned is kept; the run's life
           count is carried out so quitting is not a free reset. */
        ctx.audio.play("uiConfirm");
        ctx.run.lives = this.rook.lives;
        ctx.audio.duck(false);
        this.ending = true;
        this.scene.start(SCENE.SELECT, { selected: ctx.run.mission });
      }
    }
    void dt;
    return true;
  }

  private resumeFromPause(): void {
    const ctx = getCtx(this);
    this.paused = false;
    this.pauseLayer.setVisible(false);
    ctx.audio.play("resume");
    ctx.audio.duck(false);
  }

  private paintPause(): void {
    let g = this.pauseLayer.getData("cursor") as Phaser.GameObjects.Graphics | undefined;
    if (!g) {
      g = this.add.graphics();
      this.pauseLayer.add(g);
      this.pauseLayer.setData("cursor", g);
    }
    const i = this.pauseChoice;
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = 72 + col * 256;
    const y = i < WEAPONS.length ? 52 + row * 38 : 236;
    g.clear();
    g.lineStyle(2, 0x7ce3a8, 1);
    g.strokeRect(x - 1.5, y - 1.5, 241, 33);
  }

  // ------------------------------------------------------------------- rook

  private stepRook(dt: number, i: RookInputs): void {
    const ctx = getCtx(this);
    const mission = MISSIONS[ctx.run.mission];
    const rook = this.rook;

    this.dropThrough = Math.max(0, this.dropThrough - dt);

    /* holdClearPose() locks the POSE when a boss dies, but movement kept
       running underneath it, so Rook slid across the deck on a frozen run
       frame — the glide. The lock has to cover both or it covers neither. */
    const locked = rook.locked;

    if (!locked && i.down && rook.onGround) rook.setProne(true);
    else if ((!i.down || locked) && rook.prone) rook.setProne(false);

    const move = locked ? 0 : (i.right ? 1 : 0) - (i.left ? 1 : 0);
    /* Slipperiness is a property of the surface, not of the mission. Keying it
       off `mission.effect` meant the Credential Bastion drew ice underfoot and
       handled like concrete, because its effect is "descent"; and its own first
       platform was typed "deck" while the rest was ice. Reading the landed
       surface makes what you see and what you feel the same thing by
       construction. */
    const onIce = rook.onGround
      ? this.lastGround?.type === "ice"
      : mission.effect === "ice";

    if (rook.prone) {
      rook.vx = 0;
    } else if (onIce) {
      const target = move * PLAYER.SPEED_ICE;
      const rate = move ? PLAYER.ICE_ACCEL : PLAYER.ICE_DECEL;
      rook.vx += (target - rook.vx) * Math.min(1, dt * rate);
    } else {
      rook.vx = move * PLAYER.SPEED;
    }
    if (move) rook.facing = Math.sign(move);

    if (ctx.input.take("Space", "KeyZ") && rook.onGround && !locked) {
      if (i.down && this.lastGround?.thin) {
        /* Down + Jump drops through, and ONLY through a one-way surface. That
           restriction is the original's, and it is what keeps the control from
           reading as a collision bug: you can fall off a girder, never through
           the ground the stage is built on. */
        rook.setProne(false);
        rook.y += 4;
        rook.vy = 40;
        rook.onGround = false;
        this.dropThrough = 0.24;
        ctx.audio.play("jump");
      } else {
        if (rook.prone) rook.setProne(false);
        rook.vy = PLAYER.JUMP_VY;
        rook.onGround = false;
        ctx.audio.play("jump");
      }
    }

    const gravity = mission.effect === "lowgrav" ? PLAYER.GRAVITY_LOW : PLAYER.GRAVITY;
    if (mission.effect === "wind" && !rook.onGround) {
      rook.vx += Math.sin(this.time.now / 430) * PLAYER.WIND_FORCE * dt;
    }
    rook.vy += gravity * dt;

    const prevX = rook.x;
    rook.x = Phaser.Math.Clamp(rook.x + rook.vx * dt, 0, this.stage.worldW - rook.width);
    this.blockHorizontally(prevX);

    const oldBottom = rook.y + rook.height;
    const wasAirborne = !rook.onGround;
    rook.y += rook.vy * dt;
    rook.onGround = false;
    let landed: Platform | null = null;
    for (const p of this.stage.platforms) {
      if (rook.vy < 0) continue;
      if (this.dropThrough > 0 && p.thin) continue;
      if (rook.x + rook.width <= p.x + 3 || rook.x >= p.x + p.w - 3) continue;
      if (oldBottom > p.y + 5) continue;
      if (rook.y + rook.height < p.y) continue;
      rook.y = p.y - rook.height;
      rook.vy = 0;
      rook.onGround = true;
      landed = p;
    }
    if (landed) {
      this.lastGround = landed;
      if (wasAirborne) ctx.audio.play("land");
      if (landed.dir) {
        rook.x = Phaser.Math.Clamp(rook.x + landed.dir * 34 * dt, 0, this.stage.worldW - rook.width);
      }
    }

    if (rook.y > this.stage.worldH + WORLD.KILL_MARGIN) {
      this.loseLife();
      return;
    }

    /* Fire. The muzzle is resolved inside WeaponSystem from the frame Rook is
       drawing this instant, so the pose must be applied first. */
    rook.advance(dt, i);
    const weapon = WEAPONS[rook.weapon];
    /* Only consume the key edge if the weapon can actually use it. Taking it
       first means a press landing during a cooldown is thrown away rather than
       honoured on the next available frame — most obvious on the BARRIER DISK,
       whose 0.72 s cooldown swallows most taps. */
    const wantsFire = weapon.mode === "auto"
      ? i.firing
      : (this.weapons.canFire(rook) && ctx.input.take("KeyX", "KeyJ", "ControlLeft"));
    if (wantsFire) {
      const shots = this.weapons.fire(rook, i);
      if (shots.length) {
        const aim = aimVector(rook, i);
        this.burst(shots[0].x - aim.x * 3, shots[0].y - aim.y * 3, 0x7ce3a8, 3);
      }
    }

    this.updateProgressMarkers();
  }

  /**
   * A checkpoint that is not standing on anything is worse than no checkpoint.
   *
   * The naive version — `x: rook.x - 20` — is unsafe because landing needs only
   * 3px of overlap, so a grounded player can be most of a body-width past the
   * edge, and the extra 20px pushes the stored point clear of the platform
   * entirely. Respawning there drops the player into the gap, which respawns
   * them at the same point, which drops them again: the run is lost to an
   * unwinnable loop with no way out but GAME OVER. Seating the point inside the
   * surface the player actually landed on makes that impossible by
   * construction.
   */
  /**
   * Stop Rook at the vertical face of solid terrain.
   *
   * Until this existed the solver resolved LANDING only — `rook.x` was moved,
   * clamped to the world, and nothing else. Running into a raised ground
   * section therefore put Rook inside the rock, where the landing test rejects
   * the platform he has entered (`oldBottom > p.y + 5`) and the section he came
   * from stops supporting him. Ground slabs are drawn down to the kill plane,
   * so there is nothing beneath to catch him: he sinks through solid stone and
   * dies. Holding Right without jumping killed the player on all eleven
   * horizontal missions within seven seconds of the spawn, and jumping a normal
   * step-up slightly too early did the same thing about half the time.
   *
   * Only `!thin` surfaces block. That distinction is load-bearing: the one-way
   * girders have to stay side-permeable or drop-through, passing underneath a
   * ledge, and the pit-hop motifs all break.
   *
   * A platform whose top is at or above Rook's feet is not a wall, it is a
   * floor he has not reached yet — the same five-pixel tolerance the landing
   * test uses decides which is which, so the two cannot disagree about what
   * counts as standing on something.
   */
  private blockHorizontally(prevX: number): void {
    const rook = this.rook;
    const feet = rook.y + rook.height;
    for (const p of this.stage.platforms) {
      if (p.thin) continue;
      /* Above his feet? Then it is something to land on, not to walk into. */
      if (feet <= p.y + 5) continue;
      /* Below his head? Otherwise he is over the top of it entirely. */
      if (rook.y >= p.y + p.h) continue;
      if (rook.x + rook.width <= p.x || rook.x >= p.x + p.w) continue;

      /* Push back to the side he came from. Using the previous x rather than
         the sign of vx is what stops a player who is already overlapping —
         spawned in, knocked back, or landed on a face — from being flung
         across the whole slab. */
      if (prevX + rook.width <= p.x + 1) rook.x = p.x - rook.width;
      else if (prevX >= p.x + p.w - 1) rook.x = p.x + p.w;
      /* Already overlapping, from neither side: leave him alone.
         An earlier version pushed to the nearer edge, which on a full-width
         slab means the edge of the world — so a player who ended up inside one
         was fired across the whole stage. Nothing legitimately puts him there
         any more, and doing nothing lets the vertical resolve stand him on top
         of it on the next frame, which is the recovery you want. */
      else continue;
      rook.vx = 0;
    }
  }

  private seatCheckpoint(): { x: number; y: number } | null {
    const p = this.lastGround;
    /* Never a one-way girder. levels.ts guarantees the stage's opening
       checkpoint is on solid ground, but this one moves as the player advances,
       and respawning onto a surface that Down+Jump falls through is how a
       checkpoint turns into a pit. */
    if (!p || p.thin) return null;
    const margin = 8;
    const usable = p.w - this.rook.width - margin * 2;
    if (usable < 0) return null;
    const x = Phaser.Math.Clamp(
      Math.round(this.rook.x - 20),
      p.x + margin,
      p.x + p.w - this.rook.width - margin,
    );
    return { x, y: p.y - this.rook.height };
  }

  private updateProgressMarkers(): void {
    const rook = this.rook;
    if (this.stage.vertical) {
      if (rook.onGround && rook.y < this.stage.checkpoint.y - WORLD.CHECKPOINT_STEP_V) {
        const seat = this.seatCheckpoint();
        if (seat) this.stage.checkpoint = seat;
      }
      /* Tied to the arena deck rather than to a magic 390: the climb ledges
         sit at 66 px intervals, so a fixed threshold that far below the arena
         armed the boss while the player was still two ledges beneath it. */
      if (rook.y < this.stage.bossGateY + 46) this.enterBossArena();
    } else {
      if (rook.onGround &&
          /* 0.12, not 0.35. At a third of the stage the safety net only
             switched on after five and a half screens, so the whole teaching
             section of every mission respawned the player at the very start —
             the distribution was backwards, with no net through the part that
             teaches and a net every half-screen through the part that tests. */
          rook.x > this.stage.worldW * 0.12 &&
          rook.x < this.stage.bossGateX - 80 &&
          rook.x > this.stage.checkpoint.x + WORLD.CHECKPOINT_STEP) {
        const seat = this.seatCheckpoint();
        if (seat) this.stage.checkpoint = seat;
      }
      if (rook.x > this.stage.bossGateX + 20) this.enterBossArena();
      /* Once the fight is on, the threshold is a wall.
         The boss is clamped to the arena but the player was not, so standing a
         body-length back down the corridor put the player outside the boss's
         reach while his own bolt still carried: measured, that removed 65% of
         the boss's health for zero damage taken on seven of the twelve. The
         lit threshold was already drawn there and the fiction supports it. */
      if (this.bossActive) {
        rook.x = Math.max(rook.x, this.stage.bossGateX + 6);
      }
    }
  }

  private enterBossArena(): void {
    if (this.bossActive || !this.boss) return;
    this.bossActive = true;
    this.boss.sprite.setVisible(true);
    this.missionLog.push("boss:enter");
    const ctx = getCtx(this);
    /* Boss music replaces mission music on entry, not on the next transition —
       the cue is the point at which the fight starts. */
    ctx.audio.playMusic(this.currentCue());
    this.buildBossBar();
  }

  /**
   * Stand the boss fight back up from the beginning after a death.
   *
   * The checkpoint can never be seated past the gate, so a player who dies in
   * the arena respawns outside it — and the fight simply carried on without
   * him. The boss kept pacing and firing at nobody, and its cycle counter kept
   * advancing, which for the TRUST GATEKEEPER shortens its own cooldown by up
   * to 45%: the fight you walked back into was measurably faster than the one
   * that killed you.
   *
   * Restarting it is also what makes the HP table mean something. With the
   * damage persisting, three lives were three chained attempts at one health
   * bar and every boss was effectively a third as tough as its numbers say.
   * (The player's report that "the boss has full health" after losing a life
   * was the game-over path — retry rebuilds the stage — but the behaviour in
   * between was the stranger one.)
   */
  private resetBossEncounter(): void {
    if (!this.bossActive || !this.boss) return;
    this.bossActive = false;
    this.boss.reset(this.stage.bossSpawn.x);
    this.boss.sprite.setVisible(false);
    this.bossBarBg?.destroy();
    this.bossBar?.destroy();
    this.bossName?.destroy();
    this.bossBarBg = undefined;
    this.bossBar = undefined;
    this.bossName = undefined;
    /* enterBossArena() is guarded only on bossActive, so it re-arms itself
       the moment the player crosses the gate again. */
  }

  /** The single place this scene decides what should be playing. */
  private currentCue() {
    const ctx = getCtx(this);
    return cueFor({
      screen: this.paused ? "pause" : "play",
      mission: ctx.run.mission,
      bossActive: this.bossActive,
      missionMusic: MISSIONS[ctx.run.mission].music,
    });
  }

  private buildBossBar(): void {
    const m = MISSIONS[getCtx(this).run.mission];
    this.bossBarBg = this.add.graphics().setScrollFactor(0).setDepth(810);
    this.bossBarBg.fillStyle(0x160c16, 0.92);
    this.bossBarBg.fillRect(385, 38, 220, 13);
    this.bossBar = this.add.graphics().setScrollFactor(0).setDepth(811);
    this.bossName = label(this, 605, 24, m.boss, {
      size: m.boss.length > 22 ? 7 : 9, color: PALETTE.text, align: "right",
    }).setScrollFactor(0).setDepth(811);
  }

  // ---------------------------------------------------------------- enemies

  private stepEnemies(dt: number): void {
    const player = { x: this.rook.x + this.rook.width / 2, y: this.rook.y };
    for (const e of this.enemies) {
      if (e.dead) continue;
      /* Off-camera enemies still tick their timers but skip AI, so a stage
         with twenty actors costs what the visible handful costs. */
      /* Measured against the camera's own width/height rather than the VIEW
         constants. When the canvas was larger than the logical view these
         disagreed, and every enemy in the right half of the screen was culled
         — and `continue` skips update(), so they stood still and never fired.
         Reading the camera means the two can never drift apart again. */
      const cam = this.cameras.main;
      const visible =
        e.x > cam.scrollX - 220 && e.x < cam.scrollX + cam.width + 220 &&
        e.y > cam.scrollY - 220 && e.y < cam.scrollY + cam.height + 220;
      e.sprite.setVisible(visible);
      if (!visible) continue;

      e.update(dt, player, this.stage.platforms, (enemy) => this.enemyFire(enemy));

      if (this.rook.invuln <= 0 && overlap(this.rook.box, e.box)) this.hurtRook(1);
    }
  }

  private enemyFire(e: Enemy): void {
    const ctx = getCtx(this);
    const muzzle = ENEMY_MUZZLE[e.behaviour] ?? ENEMY_MUZZLE.rifleman;
    const sx = e.x + e.w / 2 + e.facing * muzzle.x;
    const sy = e.y + e.h * 0.42 + muzzle.y;
    /* Contra's infantry fires level down its own lane and the emplacements are
       what track you. Keeping riflemen unaimed is what makes ducking, jumping
       and standing on a ledge each mean something; if every soldier led the
       shot, position would stop being an answer to anything. */
    const base = e.aimsAtPlayer
      /* The angle the enemy locked when it started its wind-up, not the one
         that is true now. Re-deriving it here let the shot follow the player
         through the telegraph, which is the same as having no telegraph: the
         tell said a shot was coming but never where, so reading it and moving
         achieved nothing. */
      ? e.aimLocked ?? Math.atan2(this.rook.y + 25 - sy, this.rook.x + 17 - sx)
      : (e.facing > 0 ? 0 : Math.PI);
    const family = e.shotFamily;
    const count = e.kind === "sentinel" ? 3 : e.kind === "turret" ? 2 : 1;
    const spread = 0.14;
    const speed = [1, 5, 7, 10].includes(family) ? 205 : 170;
    const gravity = [3, 5].includes(family) ? 80 : 0;
    const size = [6, 8, 11].includes(family) ? 22 : 18;
    for (let i = 0; i < count; i++) {
      const off = (i - (count - 1) / 2) * spread;
      this.projectiles.fireEnemy(sx, sy, base + off, speed, family, size, gravity);
    }
    ctx.audio.play(`enemyFire${family % 3}` as SfxName, "enemyFire");
  }

  // ------------------------------------------------------------------- boss

  private stepBoss(dt: number): void {
    if (!this.boss || !this.bossActive || this.boss.dead) return;
    const boss = this.boss;
    const floor = (this.stage.vertical ? WORLD.VERTICAL_BOSS_Y : WORLD.GROUND_Y) - boss.h;
    const bounds = {
      left: this.stage.vertical ? 42 : this.stage.bossGateX + BOSS.ARENA_LEFT_INSET,
      right: (this.stage.vertical ? VIEW_W : this.stage.worldW) - BOSS.ARENA_RIGHT_INSET - boss.w,
      floor,
      /* The arena is no longer a bare box — it carries ledges the player uses
         to break line of sight, so the boss has to know they are there or it
         walks through the air above one. */
      platforms: this.stage.platforms,
    };
    boss.update(dt, { x: this.rook.x + this.rook.width / 2, y: this.rook.y }, bounds,
      (b, attack) => this.bossFire(b, attack));

    /* One, not two. The volleys are the fight now; walking into the boss is a
       mistake, not the mechanic. */
    if (this.rook.invuln <= 0 && overlap(this.rook.box, boss.box)) this.hurtRook(1);

    if (this.bossBar) {
      const m = MISSIONS[getCtx(this).run.mission];
      this.bossBar.clear();
      this.bossBar.fillStyle(Phaser.Display.Color.HexStringToColor(m.accent).color, 1);
      this.bossBar.fillRect(388, 41, 214 * Math.max(0, boss.hp / boss.maxHp), 7);
    }
  }

  private bossFire(boss: Boss, attack: BossAttack): void {
    const ctx = getCtx(this);
    const sx = boss.x + boss.w / 2;
    const sy = boss.y + boss.h * 0.42;
    /* The boss locks its aim at wind-up and hands it down here. Re-deriving it
       at release would let the shot follow the player through the telegraph,
       which is the same as having no telegraph: the arc the player watched the
       boss cock toward has to be the arc that arrives. */
    const base = attack.aim ?? Math.atan2(this.rook.y + 25 - sy, this.rook.x + 17 - sx);
    const family = boss.mission;
    const speed = attack.speed || ([1, 5, 7, 10].includes(family) ? 205 : 170);
    for (let i = 0; i < attack.count; i++) {
      const off = (i - (attack.count - 1) / 2) * attack.spread;
      this.projectiles.fireEnemy(sx, sy, base + off, speed, family,
        attack.size ?? 20, attack.gravity ?? 0);
    }
    if (attack.groundWall) {
      const floorY = (this.stage.vertical ? WORLD.VERTICAL_BOSS_Y : WORLD.GROUND_Y) - 12;
      for (const dir of [-1, 1]) {
        this.projectiles.fireEnemy(sx, floorY, dir > 0 ? 0 : Math.PI, 210, family, 22, 0);
      }
    }
    ctx.audio.play(`enemyFire${family % 3}` as SfxName, "enemyFire");
  }

  // -------------------------------------------------------------- shots

  private stepShots(dt: number): void {
    const ctx = getCtx(this);
    const cam = this.cameras.main;

    for (const shot of this.projectiles.playerShots) {
      if (!shot.active) continue;

      if (shot.homing) this.homeShot(shot, dt);
      if (shot.returning && shot.age > 0.62) this.returnShot(shot, dt);

      const alive = this.projectiles.step(shot, dt, (s) => this.probePlayerShot(s));
      if (!alive || this.offscreen(shot, cam)) this.projectiles.release(shot);
    }

    for (const shot of this.projectiles.enemyShots) {
      if (!shot.active) continue;
      const alive = this.projectiles.step(shot, dt, (s) => {
        if (this.rook.invuln > 0) return false;
        if (!overlap({ x: s.x - s.size / 4, y: s.y - s.size / 4, w: s.size / 2, h: s.size / 2 },
                     this.rook.box)) return false;
        this.hurtRook(1);
        return true;
      });
      if (!alive || this.offscreen(shot, cam)) this.projectiles.release(shot);
    }

    /* The barrier disk clears hostile fire rather than only adding damage —
       the "RETURN / INTERCEPT" role its card promises. */
    for (const disk of this.projectiles.playerShots) {
      if (!disk.active || disk.weapon !== 7) continue;
      for (const bolt of this.projectiles.enemyShots) {
        if (!bolt.active) continue;
        if (Math.hypot(disk.x - bolt.x, disk.y - bolt.y) > 22) continue;
        this.projectiles.release(bolt);
        this.burst(bolt.x, bolt.y, 0xb9a8ff, 4);
        ctx.audio.play("shield");
      }
    }
  }

  private offscreen(shot: Shot, cam: Phaser.Cameras.Scene2D.Camera): boolean {
    return shot.x < cam.scrollX - 140 || shot.x > cam.scrollX + cam.width + 200 ||
           shot.y < cam.scrollY - 140 || shot.y > cam.scrollY + cam.height + 140;
  }

  private homeShot(shot: Shot, dt: number): void {
    let target: { x: number; y: number } | null = null;
    let best = 260;
    for (const e of this.enemies) {
      if (e.dead) continue;
      const d = Math.hypot(e.x - shot.x, e.y - shot.y);
      if (d < best) { best = d; target = { x: e.x + e.w / 2, y: e.y + e.h / 2 }; }
    }
    if (this.boss && this.bossActive && !this.boss.dead) {
      const d = Math.hypot(this.boss.x - shot.x, this.boss.y - shot.y);
      if (d < best) target = { x: this.boss.x + this.boss.w / 2, y: this.boss.y + this.boss.h / 2 };
    }
    if (!target) return;
    const ang = Math.atan2(target.y - shot.y, target.x - shot.x);
    const speed = WEAPONS[shot.weapon].speed;
    shot.vx += (Math.cos(ang) * speed - shot.vx) * dt * 4;
    shot.vy += (Math.sin(ang) * speed - shot.vy) * dt * 4;
  }

  private returnShot(shot: Shot, dt: number): void {
    /* Clear the hit set once, as the disk turns for home: the return leg is
       half of "RETURN / INTERCEPT", and without this it flies back through the
       same enemies dealing nothing. */
    if (!shot.wave && shot.hitIds.size && shot.age < 0.66) shot.hitIds.clear();
    const ang = Math.atan2(this.rook.y + 25 - shot.y, this.rook.x + 17 - shot.x);
    shot.vx += (Math.cos(ang) * 420 - shot.vx) * dt * 8;
    shot.vy += (Math.sin(ang) * 420 - shot.vy) * dt * 8;
    if (shot.age > 0.8 && Math.hypot(this.rook.x - shot.x, this.rook.y - shot.y) < 30) {
      shot.life = 0;
    }
  }

  /** Returns true when the shot is spent. */
  private probePlayerShot(shot: Shot): boolean {
    const ctx = getCtx(this);
    const mission = MISSIONS[ctx.run.mission];
    const box = { x: shot.x - shot.size / 4, y: shot.y - shot.size / 4, w: shot.size / 2, h: shot.size / 2 };

    for (const e of this.enemies) {
      if (e.dead || shot.hitIds.has(e.id)) continue;
      if (!overlap(box, e.box)) continue;
      shot.hitIds.add(e.id);
      e.hurt(shot.damage);
      if (shot.freeze) e.frozen = Math.max(e.frozen, shot.freeze);
      ctx.audio.play("enemyHit");
      this.projectiles.impact(shot.weapon, shot.x, shot.y);
      if (shot.splash) {
        for (const other of this.enemies) {
          if (other.dead || other === e) continue;
          if (Math.hypot(other.x - e.x, other.y - e.y) >= shot.splash) continue;
          other.hurt(shot.damage * 0.6);
          /* hurt() only subtracts hp — it does not kill. Without this the
             thermal arc can drive a neighbour to zero and leave it standing,
             shooting and solid until something lands a direct hit on it. */
          if (other.hp <= 0) this.killEnemy(other);
        }
      }
      if (e.hp <= 0) this.killEnemy(e);
      if (--shot.pierce < 0) return true;
    }

    if (this.boss && this.bossActive && !this.boss.dead && !shot.hitIds.has(-1)) {
      if (overlap(box, this.boss.box)) {
        shot.hitIds.add(-1);
        const weak = shot.weapon === mission.weak;
        this.boss.hurt(shot.damage * (weak ? BOSS.WEAKNESS_MULTIPLIER : 1));
        /* Freezing a boss is on a lockout, unlike freezing an ordinary enemy.
           The cryo weapon's cooldown is shorter than the freeze it applies, so
           without this a player could hold the trigger and keep a boss frozen
           indefinitely — measured at 93% of the fight on the two bosses whose
           own briefings name cryo as the counter. The weakness still shortens
           the fight; it no longer replaces it. */
        if (shot.freeze && this.boss.freezeLockout <= 0) {
          this.boss.frozen = Math.max(this.boss.frozen, BOSS.FREEZE_CAP);
          this.boss.freezeLockout = BOSS.FREEZE_LOCKOUT;
        }
        ctx.audio.play("bossHit");
        this.projectiles.impact(shot.weapon, shot.x, shot.y);
        if (weak) this.burst(shot.x, shot.y, 0xffffff, 8);
        if (this.boss.hp <= 0) this.killBoss();
        if (--shot.pierce < 0) return true;
      }
    }
    return false;
  }

  // ------------------------------------------------------------ consequences

  private killEnemy(e: Enemy): void {
    const ctx = getCtx(this);
    e.dead = true;
    e.sprite.setVisible(false);
    e.dispose();
    ctx.audio.play("enemyDown");
    this.burst(e.x + e.w / 2, e.y + e.h / 2, 0x7ce3a8, 12);
    this.missionLog.push(`kill:${e.kind}`);
    /* Seeded, like stage construction: a drop-related QA failure has to be
       reproducible, and Math.random() here would make it a coin toss. */
    if (e.dropWeapon !== undefined || this.roll() < 0.21) {
      this.spawnDrop(e.x + e.w / 2 - 12, e.y,
        e.dropWeapon ?? 1 + Math.floor(this.roll() * 7));
    }
  }

  private killBoss(): void {
    const ctx = getCtx(this);
    const boss = this.boss!;
    boss.dead = true;
    boss.state = "defeated";
    boss.sprite.setVisible(false);
    ctx.audio.play("bossDown");
    this.burst(boss.x + boss.w / 2, boss.y + boss.h / 2, 0xf2a65a, 36);
    this.missionLog.push("boss:down");
    this.clearTimer = TIMING.CLEAR_DELAY;
    this.rook.holdClearPose();
    /* The mission is won; the 1.6 s victory hold must not be able to lose it.
       Without this a stray bolt still in the air routes to loseLife() and the
       player gets GAME OVER instead of SECTOR CLEAR on a fight they just won. */
    this.rook.invuln = TIMING.CLEAR_DELAY + 1;
    this.projectiles.reset();
    const m = MISSIONS[ctx.run.mission];
    this.toast.show(`${m.boss} DISCONNECTED`, 2.8);
    if (ctx.run.mission < FINAL_MISSION) {
      ctx.progress = markCleared(ctx.progress, ctx.run.mission);
    }
  }

  private finishMission(): void {
    const ctx = getCtx(this);
    this.ending = true;
    ctx.run.lives = this.rook.lives;
    /* Every mission ends on the clear card, the last one included — the
       Lock-In Engine has the best taunt in the game and used to be the only
       boss who never got to say it, because the ending ran straight off the
       fight. ClearScene forwards to the ending when it is the final sector. */
    this.scene.start(SCENE.CLEAR);
  }

  private spawnDrop(x: number, y: number, weapon: number): void {
    const slot = this.drops.find((d) => !d.active);
    if (!slot) return;
    slot.active = true;
    slot.x = x;
    slot.y = y;
    slot.vy = -150;
    slot.weapon = weapon;
    slot.life = 12;
    slot.sprite.setTexture(SHEET.shots.key, frameOf("projectiles.png", `pshot${weapon}`));
    slot.sprite.setActive(true).setVisible(true).setPosition(x + 12, y + 12);
  }

  private stepDrops(dt: number): void {
    const ctx = getCtx(this);
    for (const d of this.drops) {
      if (!d.active) continue;
      d.life -= dt;
      d.vy += 620 * dt;
      const old = d.y + 24;
      d.y += d.vy * dt;
      for (const p of this.stage.platforms) {
        if (d.vy < 0) continue;
        if (d.x + 22 < p.x || d.x > p.x + p.w) continue;
        if (old > p.y + 4 || d.y + 24 < p.y) continue;
        d.y = p.y - 24;
        d.vy = 0;
      }
      d.sprite.setPosition(d.x + 12, d.y + 12);
      d.sprite.setRotation(this.time.now / 400);

      if (overlap({ x: d.x, y: d.y, w: 24, h: 24 }, this.rook.box)) {
        this.rook.weapon = d.weapon;
        ctx.run.weapon = d.weapon;
        this.toast.show(`${WEAPONS[d.weapon].name} ACQUIRED`, 2);
        this.missionLog.push(`pickup:${WEAPONS[d.weapon].name}`);
        ctx.audio.play("pickup");
        this.burst(d.x + 12, d.y + 12, 0x7ce3a8, 14);
        d.life = 0;
      }
      if (d.life <= 0 || d.y > this.stage.worldH + 50) {
        d.active = false;
        d.sprite.setActive(false).setVisible(false);
      }
    }
  }

  private hurtRook(amount: number, sourceX?: number): void {
    const ctx = getCtx(this);
    ctx.audio.play("playerHit");
    if (this.rook.weapon !== 0) {
      this.missionLog.push(`lost:${WEAPONS[this.rook.weapon].name}`);
      this.rook.weapon = 0;
      ctx.run.weapon = 0;
      this.toast.show("UPGRADE LOST  ·  SIGNAL PULSE RESTORED", 2);
    }
    this.rook.health -= amount;
    this.rook.invuln = PLAYER.INVULN_HIT;
    this.rook.vy = PLAYER.HURT_VY;
    /* Away from whatever hit him, not away from whichever way he happened to
       be looking. Backing out of a fight used to shove him back into it. */
    const away = sourceX === undefined
      ? -this.rook.facing
      : Math.sign((this.rook.x + this.rook.width / 2) - sourceX) || 1;
    this.rook.vx = away * PLAYER.HURT_VX;
    this.burst(this.rook.x + 17, this.rook.y + 25, 0xe07856, 12);
    if (this.rook.health <= 0) this.loseLife();
  }

  private loseLife(): void {
    const ctx = getCtx(this);
    this.rook.lives--;
    if (this.rook.lives < 0) {
      ctx.audio.play("gameover");
      ctx.run.lives = PLAYER.LIVES;
      this.ending = true;
      this.scene.start(SCENE.GAMEOVER);
      return;
    }
    ctx.audio.play("death");
    this.resetBossEncounter();
    this.rook.health = this.rook.maxHealth;
    this.rook.x = this.stage.checkpoint.x;
    this.rook.y = this.stage.checkpoint.y;
    this.rook.setProne(false);
    this.rook.vy = 0;
    this.rook.vx = 0;
    this.rook.invuln = PLAYER.INVULN_RESPAWN;
    this.projectiles.reset();
    this.toast.show("SIGNAL RESTORED AT CHECKPOINT", 1.8);
  }

  private burst(x: number, y: number, color: number, count: number): void {
    if (getCtx(this).reduced) count = Math.min(count, 4);
    this.particles.setParticleTint(color);
    this.particles.emitParticleAt(x, y, count);
  }

  // ----------------------------------------------------------------- camera

  /**
   * Follow Rook, and hand the camera a WHOLE-pixel scroll.
   *
   * The lerp has to stay fractional or the camera moves in visible steps, but
   * what the renderer sees must not: every actor already rounds its own world
   * position, and subtracting a fractional scroll from those integers puts the
   * result back between pixels. Rounding then lands differently from frame to
   * frame, and on a sprite as tall as Rook that alternating row reads as the
   * character pulsing — the "sprite seems to change size as it runs, almost
   * like its throbbing". The 640x360 canvas is stretched to whatever the
   * window is (2.25x at 1440 wide), so the wobble arrives magnified.
   *
   * Keeping the true position here and giving the camera the rounded value
   * preserves the smooth follow and makes the world-to-screen mapping integral
   * for everything at once, which is the only way sprites stop shimmering
   * against each other and against the backdrop.
   */
  private updateCamera(dt: number): void {
    const cam = this.cameras.main;
    const rate = Math.min(1, dt * CAMERA.LERP);
    if (this.stage.vertical) {
      const targetY = Phaser.Math.Clamp(this.rook.y - CAMERA.LEAD_Y, 0, this.stage.worldH - VIEW_H);
      this.camY += (targetY - this.camY) * rate;
      this.camX = 0;
    } else {
      const targetX = Phaser.Math.Clamp(this.rook.x - CAMERA.LEAD_X, 0, this.stage.worldW - VIEW_W);
      this.camX += (targetX - this.camX) * rate;
      this.camY = 0;
    }
    cam.scrollX = Math.round(this.camX);
    cam.scrollY = Math.round(this.camY);
    if (this.bgNear) {
      /* Slower than the world, so the backdrop reads as distance rather than
         as a second floor sliding past at the player's own speed. Divided by
         the tile scale because tilePosition is in SOURCE pixels, not screen
         pixels — without that the backdrop scrolls 1.5x too fast. */
      this.bgNear.tilePositionX =
        Math.round((cam.scrollX * BG_PARALLAX) / BG_SCALE);

      if (this.stage.vertical) {
        /* Pan within the single painting rather than tiling it.
           The strip is mirrored on X only, so it has nothing to hide a
           vertical wrap — and a climb this tall drove tilePositionY clean off
           the end of a 360-row texture, putting the bottom of the picture hard
           against its own top. A seam was on screen for roughly seventy per
           cent of the ascent: the waterfall column and the rock strata cut and
           jumped, which is exactly the discontinuity the shaft was reported
           for. Mapping the whole climb onto the rows the texture actually has
           means there is no wrap to see, and the parallax finally reads as
           depth on the one stage where the camera moves vertically at all. */
        const rows = VIEW_H / BG_SCALE;
        const span = Math.max(0, this.textureRows() - rows);
        const climbed = Math.max(1, this.stage.worldH - VIEW_H);
        const t = Phaser.Math.Clamp(cam.scrollY / climbed, 0, 1);
        this.bgNear.tilePositionY = Math.round(t * span);
      } else {
        this.bgNear.tilePositionY =
          this.bgBaseY + Math.round((cam.scrollY * 0.22) / BG_SCALE);
      }
    }
  }

  /** Source rows in the backdrop texture, for the vertical pan above. */
  private textureRows(): number {
    const key = this.bgNear?.texture?.key;
    const src = key ? this.textures.get(key)?.source?.[0] : undefined;
    return src?.height ?? VIEW_H;
  }

  private updateHud(): void {
    const ctx = getCtx(this);
    const m = MISSIONS[ctx.run.mission];
    this.hudText.setText(
      `${m.sector}    LIVES ${Math.max(0, this.rook.lives)}`,
    );
    this.hudWeapon.setText(WEAPONS[this.rook.weapon].name);
    this.healthBar.clear();
    this.healthBar.fillStyle(0x160c16, 0.9);
    this.healthBar.fillRect(10, 42, 148, 9);
    const frac = Math.max(0, this.rook.health / this.rook.maxHealth);
    this.healthBar.fillStyle(frac > 0.35 ? 0x7ce3a8 : 0xe07856, 1);
    this.healthBar.fillRect(12, 44, 144 * frac, 5);
  }

  // ---------------------------------------------------------------- control

  /** Called by the host on suspend, and by the pause key path. */
  pauseGame(): void {
    if (this.paused || this.ending) return;
    this.paused = true;
    this.pauseChoice = 0;
    this.pauseLayer.setVisible(true);
    this.paintPause();
    getCtx(this).audio.duck(true);
  }

  get isRunning(): boolean {
    return !this.ending;
  }

  private teardown(): void {
    /* The secret-sequence handler closes over this scene, its player and its
       toast. InputTracker lives on the context and outlives every scene, so a
       handler left registered here fires on the title screen after one play
       session and calls straight into destroyed display objects. */
    getCtx(this).input.setSecretHandler(() => {});
    this.toast?.destroy();
    this.projectiles?.destroy();
    this.enemies.length = 0;
    this.drops.length = 0;
    this.boss = null;
  }
}

function overlap(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
): boolean {
  return a.x + a.w > b.x && a.x < b.x + b.w && a.y + a.h > b.y && a.y < b.y + b.h;
}

export { overlap };
