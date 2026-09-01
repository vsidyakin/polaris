/**
 * Mars: Signal Siege — runtime harness.
 *
 * Drives the real game in a real browser and asserts what is actually on
 * screen and in the audio graph. The other three Mars checks are static: they
 * read the source, the atlases and the level generator. This one is the only
 * thing that can catch the class of bug that killed the first playable build —
 * an exception thrown inside a scene's update, which freezes the game loop
 * while every static check still passes.
 *
 * Real defects this has caught, none of which were visible to the static suite:
 *   - registerAnimations() running before the sprite sheets finished loading,
 *     creating animations with no frames; the first play() of one threw inside
 *     Phaser's getFirstTick and froze the game on the first frame of gameplay.
 *   - Enemy.update() overwriting its own "windup" state every tick, so no enemy
 *     ever completed an attack or fired a shot.
 *   - A Phaser canvas twice the size of the logical view, which put two extra
 *     copies of the backdrop on screen and culled half the live enemies.
 *
 * Requires Playwright, which is NOT a repo dependency — it pulls a browser
 * binary and the other suites must stay installable without one. Install it
 * separately to run this:
 *
 *     npm i -g playwright && playwright install chromium
 *     node scripts/check-mars-runtime.mjs
 *
 * It serves a production build, so it tests the bundle that actually ships.
 * Skips with exit 0 when Playwright is absent, so wiring it into an aggregate
 * script never breaks a machine that has not opted in.
 */

import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIST = process.env.MARS_DIST || join(ROOT, "dist");
const PORT = Number(process.env.MARS_PORT || 4400);

let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {
  console.log("check-mars-runtime: SKIPPED — playwright is not installed.");
  console.log("  npm i -g playwright && playwright install chromium");
  process.exit(0);
}

if (!existsSync(join(DIST, "index.html"))) {
  console.log(`check-mars-runtime: SKIPPED — no build at ${DIST}.`);
  console.log("  Run `pnpm build` first, or set MARS_DIST.");
  process.exit(0);
}

const TYPES = {
  ".html": "text/html", ".js": "text/javascript", ".css": "text/css",
  ".png": "image/png", ".json": "application/json", ".ogg": "audio/ogg",
  ".mp3": "audio/mpeg", ".webp": "image/webp", ".svg": "image/svg+xml",
  ".woff2": "font/woff2", ".jpg": "image/jpeg", ".mp4": "video/mp4",
  ".xml": "application/xml", ".txt": "text/plain",
};

const server = createServer(async (req, res) => {
  try {
    const p = decodeURIComponent(req.url.split("?")[0]);
    let f = join(DIST, p);
    try {
      if ((await stat(f)).isDirectory()) f = join(f, "index.html");
    } catch {
      f = join(DIST, p, "index.html");
    }
    const body = await readFile(f);
    res.writeHead(200, { "Content-Type": TYPES[extname(f)] || "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end("not found");
  }
});
await new Promise((r) => server.listen(PORT, r));

let failures = 0;
const check = (label, cond, detail = "") => {
  console.log(cond ? `  ok   ${label}` : `  FAIL ${label}${detail ? " — " + detail : ""}`);
  if (!cond) failures++;
};

/* The sprite manifest, for checks that have to know what the atlas measured
   rather than trusting what the game happens to be drawing. */
const manifest = JSON.parse(await readFile(
  join(DIST, "eggs/mars-signal-siege/art/atlases.json"), "utf8"));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});

const waitScene = (key) =>
  page.waitForFunction((k) => {
    const g = window.__mss?.game;
    const live = g?.scene.getScenes(true);
    return !!(live && live.length && live[live.length - 1].scene.key === k);
  }, key, { timeout: 45000 });

const probe = (fn, arg) => page.evaluate(fn, arg);

try {
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => typeof window.eggLaunch === "function", { timeout: 30000 });

  /* Nothing Mars-related may be fetched before Mars is opened. */
  const before = await probe(() => performance.getEntriesByType("resource")
    .filter((r) => r.name.includes("mars-signal-siege")).length);
  check("no Mars assets load before Mars is selected", before === 0, `${before} requests`);

  await page.evaluate(() => { window.__MSS_DEBUG = true; });
  await page.evaluate(() => window.eggLaunch("catch"));
  await page.waitForSelector("#egg-mars-mount canvas", { timeout: 30000 });
  await page.waitForFunction(() => !!window.__mss?.game, { timeout: 20000 });

  /* --- view ------------------------------------------------------------- */
  const full = await probe(() => {
    const c = document.querySelector("#egg-mars-mount canvas");
    const r = c.getBoundingClientRect();
    return {
      view: document.getElementById("egg-mars").dataset.view,
      attr: `${c.width}x${c.height}`,
      widthPct: Math.round((r.width / window.innerWidth) * 100),
    };
  });
  check("opens full screen by default", full.view === "full", full.view);
  check("canvas is the logical view (640x360)", full.attr === "640x360", full.attr);
  check("full view fills the window", full.widthPct >= 99, `${full.widthPct}%`);

  await page.keyboard.press("KeyF");
  await page.waitForTimeout(700);
  const win = await probe(() => {
    const bd = document.querySelector("#egg-mars .egg-bd").getBoundingClientRect();
    return {
      view: document.getElementById("egg-mars").dataset.view,
      w: Math.round((bd.width / window.innerWidth) * 100),
      h: Math.round((bd.height / window.innerHeight) * 100),
      centered: Math.abs((bd.left + bd.right) / 2 - window.innerWidth / 2) < 3,
    };
  });
  check("F gives an 85% windowed view", win.view === "window" && win.w === 85 && win.h === 85,
    `${win.w}% x ${win.h}%`);
  check("windowed view is centred", win.centered);
  await page.keyboard.press("KeyF");
  await page.waitForTimeout(500);

  /* --- flow ------------------------------------------------------------- */
  await waitScene("mss-title");
  const titleAudio = await probe(() => {
    const s = window.__mss.game.sound;
    return { ctx: s.context?.state, playing: s.sounds.filter((x) => x.isPlaying).map((x) => x.key) };
  });
  check("title music plays without needing a keypress",
    titleAudio.playing.length === 1 && titleAudio.playing[0] === "mss-mus-title",
    JSON.stringify(titleAudio));

  await page.keyboard.press("Enter");
  await waitScene("mss-select");
  await page.keyboard.press("Enter");
  await waitScene("mss-briefing");
  await page.keyboard.press("Enter");
  await waitScene("mss-play");
  await page.waitForTimeout(1200);
  check("title -> select -> briefing -> play is reachable", true);

  /* --- the loop is actually running -------------------------------------- */
  const t0 = await probe(() => {
    const p = window.__mss.game.scene.getScene("mss-play");
    /* The LOUDEST playing music cue, not the first one in the array.
       Cues crossfade, so for about a second after entering a mission the
       outgoing briefing track is still in `sounds` at a low volume -- and it
       sorts first, because it was added first. Reading [0] therefore reported
       whatever the game was fading OUT of, which is how this check came to
       fail on a build whose gameplay music was entirely correct. */
    const music = p.scene.systems.game.sound.sounds
      .filter((s) => s.isPlaying && s.key.startsWith("mss-mus-"))
      .sort((a, b) => b.volume - a.volume)[0];
    return { x: p.rook.x, music: music?.key };
  });
  /* Sampled and monotonic rather than "moved N pixels in N milliseconds".
     Headless Chromium renders this canvas slowly, and the simulation clamps its
     delta (TIMING.MAX_DT) so it cannot tunnel through platforms — which means
     sim time runs behind wall-clock time here by a factor that depends on the
     machine. A fixed distance threshold measures the grader's frame rate. What
     this check is actually for is proving the loop is not frozen, and steady
     forward progress proves that on any hardware. */
  await page.keyboard.down("ArrowRight");
  const trace = [];
  for (let i = 0; i < 8; i++) {
    await page.waitForTimeout(200);
    trace.push(await probe(() => window.__mss.game.scene.getScene("mss-play").rook.x));
  }
  const advancing = trace.every((x, i) => i === 0 || x > trace[i - 1]);
  check("the game loop advances (an exception in update freezes it)",
    advancing && trace[trace.length - 1] > t0.x + 40,
    `x ${Math.round(t0.x)} -> ${trace.map((x) => Math.round(x)).join(" -> ")}`);
  check("mission music plays in gameplay", !!t0.music && t0.music !== "mss-mus-title", t0.music);

  /* --- enemies live ------------------------------------------------------
     Rook is seated next to the roster rather than run at it. A stage is around
     10,000 px with the first body 700 px in, so a harness that merely holds
     Right for a few seconds measures the empty lead-in and then reports that no
     enemy in the game ever moved. */
  const seen = {
    states: new Set(), frames: new Set(), flips: new Set(),
    enemyShots: 0, playerShots: 0,
  };

  const seatBeside = (pred) => page.evaluate((p_) => {
    const p = window.__mss.game.scene.getScene("mss-play");
    const match = new Function("x", "return " + p_);
    /* Never a paratroop still under its canopy: it is airborne by design and
       does not act until it lands, so seating the player beside one measures
       nothing. */
    /* On the enemy's OWN surface, not merely near it.
       A rifleman deliberately holds fire at a player on a different rung — a
       level shot could never reach him there — so the seat has to land on the
       same deck or the test measures the hold rather than the telegraph. The
       first attempt put Rook at the enemy's foot height in mid-air, he fell to
       whatever was below, and the rifleman correctly said nothing. */
    const room = 150;
    const cand = p.enemies.filter((x) => !x.dead && x.state !== "descend" && match(x));
    let e = null;
    let deck = null;
    for (const c of cand) {
      const feet = c.y + c.h;
      const s = p.stage.platforms.find((pl) =>
        Math.abs(pl.y - feet) < 4 &&
        c.x > pl.x && c.x < pl.x + pl.w &&
        pl.w > room + 90);
      if (s) { e = c; deck = s; break; }
    }
    if (!e) return null;
    const want = e.x - room;
    p.rook.x = Math.max(deck.x + 6, Math.min(want, deck.x + deck.w - p.rook.width - 6));
    p.rook.y = deck.y - p.rook.height;
    p.rook.vy = 0;
    p.rook.onGround = true;
    p.rook.invuln = 999;
    /* Snap the camera with him. It follows on a lerp, so after a teleport it
       spends a long time catching up — and shots fired meanwhile spawn outside
       the view and are culled on the frame they are born, which reads as "the
       player cannot fire". */
    const cam = p.cameras.main;
    p.camX = Math.max(0, Math.min(p.stage.worldW - 640, p.rook.x - 220));
    p.camY = p.stage.vertical ? Math.max(0, p.rook.y - 214) : 0;
    cam.scrollX = Math.round(p.camX);
    cam.scrollY = Math.round(p.camY);
    return { kind: e.kind, behaviour: e.behaviour };
  }, pred);

  const walker = await seatBeside('x.behaviour === "runner" || x.behaviour === "jumper"');
  check("the roster fields a ground walker", !!walker, JSON.stringify(walker));
  for (let i = 0; i < 10; i++) {
    await page.keyboard.press("KeyX");
    await page.waitForTimeout(220);
    const s = await probe(() => {
      const p = window.__mss.game.scene.getScene("mss-play");
      const es = p.enemies.filter((e) => !e.dead && e.state !== "descend" &&
        Math.abs(e.x - p.rook.x) < 360);
      return {
        states: [...new Set(es.map((e) => e.state))],
        frames: es.slice(0, 5).map((e) => e.sprite.frame.name).join(","),
        /* Facing paired with the flip actually applied. The artwork faces
           right, so flipX must be true exactly when facing is -1; an inverted
           convention here is what made every ground enemy moonwalk. */
        /* Visible only: stepEnemies skips off-camera actors entirely, so an
           enemy the scene has never updated still carries its constructor
           facing and an unset flip. That is correct behaviour, not a defect. */
        /* Facing paired with the flip actually applied, and tagged with which
           sheet the actor draws from, so the expectation can come from the
           ATLAS rather than from a direction written here. The group sheets are
           painted facing left and the authored types facing right, so any
           hard-coded expectation is wrong for one of them — which is how this
           shipped inverted twice: once with every ground enemy moonwalking,
           once with every one of them running backwards. */
        flips: es.filter((e) => e.sprite.visible)
          .map((e) => (e.authored ? "authored" : "group") + " " +
            e.facing + ":" + e.sprite.flipX),
        pl: p.projectiles.playerShots.filter((x) => x.active).length,
      };
    });
    s.states.forEach((v) => seen.states.add(v));
    s.flips.forEach((v) => seen.flips.add(v));
    seen.frames.add(s.frames);
    seen.playerShots = Math.max(seen.playerShots, s.pl);
  }
  await page.keyboard.up("ArrowRight");

  const rifle = await seatBeside('x.behaviour === "rifleman"');
  check("the roster fields a rifleman", !!rifle, JSON.stringify(rifle));
  /* Polled, and the wind-up is latched in the page rather than sampled from
     here. The telegraph is 0.28s of SIM time and sim time runs behind
     wall-clock in headless, so sampling from Node caught the shot but missed
     the tell that preceded it — which read as "enemies fire without
     telegraphing", the exact opposite of the truth. */
  await page.evaluate(() => { window.__mssSeenWindup = false; });
  const riflemanFired = await page.waitForFunction(() => {
    const p = window.__mss.game.scene.getScene("mss-play");
    const es = p.enemies.filter((e) => !e.dead && e.behaviour === "rifleman" &&
      e.state !== "descend" && e.sprite.visible &&
      Math.abs(e.x - p.rook.x) < 380);
    if (es.some((e) => e.state === "windup")) window.__mssSeenWindup = true;
    return window.__mssSeenWindup &&
      p.projectiles.enemyShots.filter((x) => x.active).length > 0;
  }, null, { timeout: 12000 }).then(() => true).catch(() => false);
  if (await probe(() => window.__mssSeenWindup)) seen.states.add("windup");
  if (riflemanFired) seen.enemyShots = Math.max(seen.enemyShots, 1);

  check("enemy sprites animate", seen.frames.size > 1, `${seen.frames.size} distinct frame sets`);
  check("enemies move", seen.states.has("move"), [...seen.states].join("/"));
  const facesRight = Object.fromEntries(manifest.sheets
    .filter((s) => s.facesRight !== undefined)
    .map((s) => [s.file.endsWith("new-enemies.png") ? "authored" : "group", s.facesRight]));
  const flipOk = (f) => {
    const [group, pair] = f.split(" ");
    const [facing, flipped] = pair.split(":");
    const right = facesRight[group];
    if (right === undefined) return false;
    const want = right ? Number(facing) < 0 : Number(facing) > 0;
    return (flipped === "true") === want;
  };
  check("enemies face the way they are going",
    seen.flips.size > 0 && [...seen.flips].every(flipOk),
    `${JSON.stringify(facesRight)} vs ${[...seen.flips].join(" ")}`);
  check("enemies telegraph before firing", seen.states.has("windup"), [...seen.states].join("/"));
  check("enemies fire", seen.enemyShots > 0, `${seen.enemyShots} shots`);
  check("the player fires", seen.playerShots > 0, `${seen.playerShots} shots`);

  /* --- the weapon is on screen whenever Rook is ---------------------------
     rkey_0 is Rook stood at ease with the rifle stowed. Shipping it as `idle`
     meant the gun disappeared the moment the player stopped moving, so shots
     appeared out of empty air. A pose that can fire must show the weapon, and
     the atlas only measures a muzzle socket for frames that have one. */
  const idle = await probe(() => {
    const p = window.__mss.game.scene.getScene("mss-play");
    const g = p.stage.platforms.find((pl) => !pl.thin && pl.w > 200);
    p.rook.x = g.x + g.w / 2;
    p.rook.y = g.y - p.rook.height;
    p.rook.vx = 0; p.rook.vy = 0;
    p.rook.onGround = true; p.rook.locked = false; p.rook.invuln = 999;
    p.rook.advance(0.016,
      { left: false, right: false, up: false, down: false, firing: false });
    return { pose: p.rook.pose, frame: Number(p.rook.sprite.frame.name) };
  });
  const rookSheet = manifest.sheets.find((x) => x.file.endsWith("rook.png"));
  check("standing still shows the rifle",
    idle.pose === "idle" && !!rookSheet?.sockets?.[String(idle.frame)],
    JSON.stringify(idle));

  /* --- one-way platforms --------------------------------------------------
     Contra let you drop through the thin floating girders and never through
     the ground the stage was built on, and that distinction is the whole
     reason the control does not read as a collision bug. */
  const dropRig = await probe(() => {
    const p = window.__mss.game.scene.getScene("mss-play");
    const g = p.stage.platforms.find((pl) => pl.thin && pl.w > 60);
    const solid = p.stage.platforms.find((pl) => !pl.thin && pl.w > 200);
    if (!g || !solid) return null;
    p.rook.x = g.x + g.w / 2;
    p.rook.y = g.y - p.rook.height;
    p.rook.vy = 0; p.rook.onGround = true; p.rook.invuln = 999;
    p.lastGround = g;
    return { gy: g.y, solidY: solid.y };
  });
  let fellThroughThin = null;
  let heldOnSolid = null;
  if (dropRig) {
    /* Polled, not timed. Sim time runs behind wall-clock here (see the loop
       check above), so a fixed wait grades the machine rather than the game. */
    await page.keyboard.down("ArrowDown");
    await page.keyboard.press("Space");
    fellThroughThin = await page.waitForFunction((gy) => {
      const p = window.__mss.game.scene.getScene("mss-play");
      return p.rook.y > gy + 4;
    }, dropRig.gy, { timeout: 4000 }).then(() => true).catch(() => false);
    await page.keyboard.up("ArrowDown");

    await probe(() => {
      const p = window.__mss.game.scene.getScene("mss-play");
      const solid = p.stage.platforms.find((pl) => !pl.thin && pl.w > 200);
      p.rook.x = solid.x + solid.w / 2;
      p.rook.y = solid.y - p.rook.height;
      p.rook.vy = 0; p.rook.onGround = true;
      p.lastGround = solid;
    });
    /* This one stays a fixed wait on purpose: it is asserting that nothing
       happens, and a poll would pass the instant it started. */
    await page.keyboard.down("ArrowDown");
    await page.keyboard.press("Space");
    await page.waitForTimeout(900);
    await page.keyboard.up("ArrowDown");
    heldOnSolid = await page.evaluate((sy) => {
      const p = window.__mss.game.scene.getScene("mss-play");
      return p.rook.y <= sy - p.rook.height + 2;
    }, dropRig.solidY);
  }
  check("Down+Jump drops through a one-way girder", fellThroughThin === true);
  check("Down+Jump does NOT drop through solid ground", heldOnSolid === true);

  /* --- boss -------------------------------------------------------------- */
  await probe(() => {
    const p = window.__mss.game.scene.getScene("mss-play");
    p.rook.x = p.stage.bossGateX + 120;
    p.rook.y = 240;
  });
  await page.waitForTimeout(1500);
  const bossSeen = {
    states: new Set(), anims: new Set(), xs: new Set(), shots: 0,
    minGap: Infinity,
  };
  for (let i = 0; i < 18; i++) {
    await page.waitForTimeout(280);
    const s = await probe(() => {
      const p = window.__mss.game.scene.getScene("mss-play");
      const b = p.boss;
      return b && p.bossActive ? {
        st: b.state, x: Math.round(b.x),
        anim: b.sprite.anims.currentAnim?.key ?? "-",
        gap: Math.abs((b.x + b.w / 2) - (p.rook.x + p.rook.width / 2)),
        shots: p.projectiles.enemyShots.filter((x) => x.active).length,
      } : null;
    });
    if (!s) continue;
    bossSeen.states.add(s.st);
    bossSeen.anims.add(s.anim);
    bossSeen.xs.add(s.x);
    bossSeen.minGap = Math.min(bossSeen.minGap, s.gap);
    bossSeen.shots = Math.max(bossSeen.shots, s.shots);
  }
  check("boss activates in its arena", bossSeen.states.size > 0);
  check("boss walks", bossSeen.xs.size > 3, `${bossSeen.xs.size} distinct positions`);
  check("boss cycles windup -> fire -> recover",
    bossSeen.states.has("windup") && bossSeen.states.has("recover"),
    [...bossSeen.states].join("/"));
  check("boss animation changes with state", bossSeen.anims.size > 1, [...bossSeen.anims].join("/"));
  check("boss fires", bossSeen.shots > 0, `${bossSeen.shots} shots`);

  /* Mission 1's Brigadier is deliberately the one boss that will not come to
     you — an emplacement that walls the floor from where it set up. So the
     runtime assertion here is that it HOLDS ITS STANDOFF rather than walking
     into contact; the movement vocabulary across all twelve plans is checked
     statically in test-mars-signal-siege.mjs, which can see the whole table
     instead of the single fight this harness plays. */
  check("the boss does not close to contact",
    bossSeen.minGap > 60, `closest approach ${Math.round(bossSeen.minGap)} px`);

  /* --- every boss moves differently ---------------------------------------
     The static suite can see that the twelve PLANS carry twelve different
     movement styles, but a table is not behaviour: the previous table also
     passed its uniqueness check while eight bosses ran the same walk with
     different numbers in it. This plays all twelve arenas with the player
     parked and records what each boss actually DOES with the ground, then
     insists the traces differ from each other.

     The player is deliberately left standing still. Every style here is
     supposed to be a function of time and of the player's position or motion,
     so a stationary player is the control condition that makes the twelve
     traces comparable. */
  const SAMPLES = 26;
  const traces = [];
  for (let m = 0; m < 12; m++) {
    await probe((mi) => {
      const g = window.__mss.game;
      const ctx = g.registry.get("mss-ctx");
      ctx.run.mission = mi;
      /* Start the briefing FROM the live scene rather than from the manager.
         SceneManager.start() brings the briefing up without stopping whatever
         is already running, so the play scene stayed live and on top and the
         wait for "mss-briefing" to be the frontmost scene never resolved. */
      const live = g.scene.getScenes(true);
      live[live.length - 1].scene.start("mss-briefing");
    }, m);
    await waitScene("mss-briefing");
    await page.keyboard.press("Enter");
    await waitScene("mss-play");
    /* Missions lazy-load their own backdrop and ground; give the slowest of
       them room before assuming the stage is built. */
    await page.waitForFunction(() => {
      const p = window.__mss.game.scene.getScene("mss-play");
      return !!(p && p.stage && p.rook);
    }, { timeout: 30000 });

    await probe(() => {
      const p = window.__mss.game.scene.getScene("mss-play");
      p.rook.x = p.stage.bossGateX + 130;
      p.rook.y = 240;
    });
    await page.waitForTimeout(1600);

    const xs = [];
    const gaps = [];
    for (let i = 0; i < SAMPLES; i++) {
      await page.waitForTimeout(150);
      const s = await probe(() => {
        const p = window.__mss.game.scene.getScene("mss-play");
        const b = p.boss;
        return b && p.bossActive
          ? { x: b.x, gap: Math.abs((b.x + b.w / 2) - (p.rook.x + p.rook.width / 2)) }
          : null;
      });
      if (s) { xs.push(s.x); gaps.push(s.gap); }
    }
    traces.push({ mission: m, xs, gaps });
  }

  const reached = traces.filter((t) => t.xs.length >= SAMPLES / 2);
  check("every boss arena is reachable and activates",
    reached.length === 12,
    `${reached.length}/12: missing ${traces.filter((t) => t.xs.length < SAMPLES / 2)
      .map((t) => t.mission + 1).join(",") || "none"}`);

  /* Four numbers that describe HOW a thing moves rather than where it ended
     up: how much ground it covers, how often it changes its mind, how much of
     the time it is stopped, and how hard it holds its range. Two bosses with
     the same walk and different constants land on the same vector; two with
     genuinely different ideas cannot. */
  function signature(t) {
    if (t.xs.length < 3) return null;
    const span = Math.max(...t.xs) - Math.min(...t.xs);
    let reversals = 0;
    let stalled = 0;
    let prevDir = 0;
    for (let i = 1; i < t.xs.length; i++) {
      const d = t.xs[i] - t.xs[i - 1];
      if (Math.abs(d) < 0.6) { stalled++; continue; }
      const dir = d < 0 ? -1 : 1;
      if (prevDir !== 0 && dir !== prevDir) reversals++;
      prevDir = dir;
    }
    const mean = t.gaps.reduce((a, b) => a + b, 0) / t.gaps.length;
    const gapSd = Math.sqrt(
      t.gaps.reduce((a, b) => a + (b - mean) ** 2, 0) / t.gaps.length);
    return {
      span, reversals,
      stalledPct: stalled / (t.xs.length - 1),
      gapMean: mean, gapSd,
    };
  }

  const sigs = traces.map((t) => ({ mission: t.mission, s: signature(t) }))
    .filter((r) => r.s);

  check("every boss covers ground in its arena",
    sigs.every((r) => r.s.span > 4),
    sigs.filter((r) => r.s.span <= 4)
      .map((r) => `mission ${r.mission + 1} span ${r.s.span.toFixed(1)}`).join("; "));

  /* Quantised so that near-identical traces collide. Two bosses are allowed to
     both pace; they are not allowed to pace the same way. */
  const keyed = sigs.map((r) => [
    r.mission,
    `${Math.round(r.s.span / 24)}|${Math.round(r.s.reversals / 2)}` +
    `|${Math.round(r.s.stalledPct * 4)}|${Math.round(r.s.gapMean / 40)}` +
    `|${Math.round(r.s.gapSd / 20)}`,
  ]);
  const collisions = [];
  for (let i = 0; i < keyed.length; i++) {
    for (let j = i + 1; j < keyed.length; j++) {
      if (keyed[i][1] === keyed[j][1]) {
        collisions.push(`${keyed[i][0] + 1}~${keyed[j][0] + 1}`);
      }
    }
  }
  check("no two bosses move alike in play", collisions.length === 0,
    `identical traces: ${collisions.join(", ")}`);

  console.log("  boss movement traces:");
  for (const r of sigs) {
    console.log(
      `    mission ${String(r.mission + 1).padStart(2)}  ` +
      `span ${r.s.span.toFixed(0).padStart(4)}  ` +
      `reversals ${String(r.s.reversals).padStart(2)}  ` +
      `stalled ${(r.s.stalledPct * 100).toFixed(0).padStart(3)}%  ` +
      `gap ${r.s.gapMean.toFixed(0).padStart(3)}+-${r.s.gapSd.toFixed(0)}`);
  }

  /* --- whole-pixel camera -------------------------------------------------
     A fractional scroll puts every already-rounded sprite back between pixels,
     and the rounding then lands differently from frame to frame. On a sprite as
     tall as Rook that alternating row reads as the character throbbing. */
  const cam = await probe(() => {
    const c = window.__mss.game.scene.getScene("mss-play").cameras.main;
    return { x: c.scrollX, y: c.scrollY };
  });
  check("the camera scroll is whole pixels",
    Number.isInteger(cam.x) && Number.isInteger(cam.y), cam.x + "," + cam.y);

  check("no console or page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
} finally {
  await browser.close();
  server.close();
}

console.log(`\ncheck-mars-runtime: ${failures} failure(s)`);
process.exit(failures ? 1 : 0);
