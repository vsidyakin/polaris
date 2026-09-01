/**
 * Mission Control's solar system, in WebGL.
 *
 * Ported from SoumyaEXE/3d-Solar-System-ThreeJS (MIT, (c) 2025 Soumyadeep Dey).
 * What came across is the three.js scene itself: the body table and its
 * orbital elements, the textured standard materials, the ring meshes, the
 * asteroid belt, the star spheres, the sun with its lens flare, and the
 * render -> bloom -> output pass chain. What did not: the NASA JPL / NeoWs
 * fetches, the comet and Kuiper/Oort builders that depend on them, the
 * eclipse tours, the audio player, the Gemini "Space AI" chat, and the whole
 * NASA-styled control panel. None of that has a job inside a game launcher.
 *
 * What this file adds is the launcher itself. The hand-drawn SVG galaxy map
 * this replaces (still in GameOverlays.astro, hidden) was never decoration —
 * each planet was the entry point to one of the seven games, so the port has
 * to carry that: a pick layer with hit spheres, holo targeting brackets and a
 * data card per body, and a courier ship for NETWORK INTERFERENCE, which has
 * no counterpart in the source scene.
 *
 * The module is imported dynamically (see `solarBoot`), so neither three.js
 * nor the textures are fetched until someone actually opens Mission Control.
 */

import type * as T from "three";

/* THREE IS IMPORTED BY NAME, NOT AS A NAMESPACE, AND THAT IS THE WHOLE POINT.
   `await import("three")` inside build() pulled the ENTIRE library -- 707 KB --
   because a namespace import gives the bundler nothing to drop. These 30 named
   imports are the complete set this module uses, so everything else in three can
   be tree-shaken away.

   THIS IS STILL LAZY. The import is static here but solar3d.ts is ITSELF loaded
   dynamically (`import("./solar3d")` in runtime.ts), so three lands in this
   module's chunk and is fetched only when someone opens the solar map. Nothing
   about the page-view cost changes; only the size of what arrives on the click.

   The local THREE object below keeps the 98 existing `THREE.Foo` call sites
   working unchanged. It is an alias over the named imports, not a namespace --
   the bundler still sees exactly which symbols are reachable.

   ADDING A NEW THREE FEATURE MEANS ADDING IT HERE TOO. A bare `THREE.Whatever`
   that is not in this list is a build error, which is the failure mode you want:
   loud at compile time rather than undefined at runtime. */
import {
  ACESFilmicToneMapping,
  AdditiveBlending,
  AmbientLight,
  BackSide,
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  DynamicDrawUsage,
  Group,
  InstancedMesh,
  LatheGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  PerspectiveCamera,
  PointLight,
  Points,
  PointsMaterial,
  Raycaster,
  RingGeometry,
  SRGBColorSpace,
  Scene,
  SphereGeometry,
  TextureLoader,
  TorusGeometry,
  Vector2,
  Vector3,
  WebGLRenderer,
} from "three";

const THREE = {
  ACESFilmicToneMapping,
  AdditiveBlending,
  AmbientLight,
  BackSide,
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  DynamicDrawUsage,
  Group,
  InstancedMesh,
  LatheGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  PerspectiveCamera,
  PointLight,
  Points,
  PointsMaterial,
  Raycaster,
  RingGeometry,
  SRGBColorSpace,
  Scene,
  SphereGeometry,
  TextureLoader,
  TorusGeometry,
  Vector2,
  Vector3,
  WebGLRenderer,
};

import { withBase } from "../../lib/base";

/* Textures live in public/eggs/solar/. This path is *computed*, so it goes
   through withBase() — a bare "/eggs/solar/earth.jpg" 404s under BASE_PATH. */
const TEX = (file: string) => withBase(`/eggs/solar/${file}`);

const REDUCED =
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ------------------------------------------------------------------ types --- */

/** Where clicking a body goes. `route` is an eggLaunch key, or "dev". */
type EggTarget = {
  route: string;
  game: string;
  /** Briefing copy, shown once the camera has arrived. Absent on "dev". */
  kicker?: string;
  brief?: string;
};

type MoonSpec = {
  name: string;
  size: number;
  dist: number;
  speed: number;
  color: [number, number, number];
  initialAngle?: number;
};

type BodySpec = {
  name: string;
  size: number;
  dist: number;
  speed: number;
  initialAngle?: number;
  texture?: string;
  color?: [number, number, number];
  roughness?: number;
  metalness?: number;
  hasRings?: boolean;
  /** Orbital plane tilt off the ecliptic, in radians. Pluto only. */
  inclination?: number;
  type: "planet" | "asteroid" | "dwarf" | "tno";
  /** Present only on the ten bodies that front a game or a placeholder. */
  egg?: EggTarget;
  moons?: MoonSpec[];
};

export type SolarHooks = {
  /** Launch a game. Receives an eggLaunch route key. */
  onLaunch: (route: string) => void;
  /** A body that is a placeholder — blip, flash the card, launch nothing. */
  onDev: () => void;
  /** Pointer moved onto a new body (or off every body, with null). */
  onHover?: (name: string | null) => void;
  /** Every WebGL path failed; fall back to the legacy SVG map. */
  onFail?: (reason: string) => void;
  /**
   * Called once per rendered frame. The egg runtime's chiptune sequencer is
   * pull-based — it schedules 140ms ahead and has to be advanced by whoever owns
   * the animation loop — so this is how the score gets played while the system is
   * on screen. Deliberately not a setInterval in the runtime: a timer keeps
   * firing when the tab is hidden and this does not.
   */
  onTick?: () => void;
};

/* ------------------------------------------------------------------ data --- */

/* Sizes, distances and orbital speeds are the source project's — tuned for
   looks, not to scale. `egg` is ours. */
const BODIES: BodySpec[] = [
  {
    name: "MERCURY",
    size: 0.5,
    dist: 8,
    speed: 0.0041,
    initialAngle: 2.1,
    texture: "mercury.jpg",
    roughness: 1,
    metalness: 0.02,
    type: "planet",
    egg: {
      route: "mercury",
      game: "SOLAR CIRCUIT",
      kicker: "Mercury · the night side circuit",
      brief:
        "A line worn across Mercury's night side, driven by a patch cable with somewhere to be. The sun sits on the horizon throwing its corona up the sky and never moves. Hold the packed rock — the regolith either side drags you to a crawl and takes your speed with it — and the longer you keep the line, the faster it lets you go.",
    },
  },
  {
    name: "VENUS",
    size: 0.9,
    dist: 11,
    speed: 0.0016,
    initialAngle: 4.8,
    texture: "venus.jpg",
    roughness: 0.6,
    metalness: 0.05,
    type: "planet",
    egg: {
      route: "venus",
      game: "SIGNAL JUMPER",
      kicker: "Venus · broadcast campus",
      brief:
        "Ten displays across the campus went dark, and the interference is walking around like it owns the place. Run the loading dock, the cable trench, the rooftop and master control — stomp the glyphs flat, bank the signal bits, and touch every display back to Polaris green.",
    },
  },
  {
    name: "EARTH",
    size: 1,
    dist: 15,
    speed: 0.001,
    initialAngle: 3.45,
    texture: "earth.jpg",
    roughness: 0.5,
    metalness: 0.01,
    type: "planet",
    egg: {
      route: "earth",
      game: "THE LOST DISPLAY",
      kicker: "Earth · search and rescue",
      brief:
        "The campus’s flagship display was stolen and walled up in a fortress beyond the north-east mesa. A hundred screens of field, woods and river, crimper in hand — find the two small keys, mind the false floors, and put five strikes into the CRT Tyrant’s open screen.",
    },
    moons: [
      { name: "Moon", size: 0.27, dist: 2.5, speed: 0.037, color: [0.53, 0.53, 0.53], initialAngle: 1.2 },
    ],
  },
  {
    name: "MARS",
    size: 0.8,
    dist: 19,
    speed: 0.00053,
    initialAngle: 0.9,
    texture: "mars.jpg",
    roughness: 0.75,
    metalness: 0.02,
    type: "planet",
    egg: {
      route: "catch",
      game: "MARS: SIGNAL SIEGE",
      kicker: "Mars · signal reclamation campaign",
      brief:
        "Mars’ signal network has been carved up by eleven closed behaviours — a proprietary button, a format gate, a required installer, a management island, a court that only admits its own. Signal Marshal Rook takes back one sector at a time, then shuts down the Lock-In Engine feeding all of them. Twelve missions, twelve bosses, eight capabilities to recover.",
    },
    moons: [
      { name: "Phobos", size: 0.05, dist: 1.5, speed: 0.32, color: [0.4, 0.26, 0.13], initialAngle: 0.5 },
      { name: "Deimos", size: 0.03, dist: 2.2, speed: 0.08, color: [0.4, 0.26, 0.13], initialAngle: 2.1 },
    ],
  },
  {
    name: "VESTA",
    size: 0.15,
    dist: 20.5,
    speed: 0.00029,
    initialAngle: 5.2,
    color: [0.8, 0.8, 0.8],
    roughness: 1,
    metalness: 0.1,
    type: "asteroid",
  },
  {
    name: "PALLAS",
    size: 0.12,
    dist: 21.2,
    speed: 0.00022,
    initialAngle: 1.8,
    color: [0.67, 0.67, 0.67],
    roughness: 1,
    metalness: 0.05,
    type: "asteroid",
  },
  {
    name: "CERES",
    size: 0.3,
    dist: 22,
    speed: 0.00022,
    color: [0.6, 0.6, 0.6],
    roughness: 1,
    type: "dwarf",
  },
  {
    name: "JUPITER",
    size: 2,
    dist: 25,
    speed: 0.000084,
    initialAngle: 2.7,
    texture: "jupiter.jpg",
    roughness: 0.9,
    metalness: 0,
    type: "planet",
    egg: {
      route: "stack",
      game: "WORKSPACE STACK",
      kicker: "Jupiter · workspace assembly",
      brief:
        "Shares keep coming. Compose the workspace — complete a row and it renders to the display. Hold a piece for later, trust the ghost, and slam it home when you’re sure.",
    },
    moons: [
      { name: "Io", size: 0.15, dist: 3.5, speed: 0.56, color: [1, 1, 0.6], initialAngle: 0.8 },
      { name: "Europa", size: 0.13, dist: 4.2, speed: 0.28, color: [0.53, 0.81, 0.92], initialAngle: 1.5 },
      { name: "Ganymede", size: 0.22, dist: 5.1, speed: 0.14, color: [0.55, 0.49, 0.42], initialAngle: 3.2 },
      { name: "Callisto", size: 0.2, dist: 6, speed: 0.06, color: [0.41, 0.41, 0.41], initialAngle: 4.9 },
      { name: "Amalthea", size: 0.08, dist: 2.8, speed: 2, color: [0.6, 0.4, 0.2], initialAngle: 5.2 },
      { name: "Himalia", size: 0.05, dist: 7.5, speed: 0.013, color: [0.5, 0.5, 0.5], initialAngle: 2.1 },
    ],
  },
  {
    name: "SATURN",
    size: 1.7,
    dist: 31,
    speed: 0.000034,
    initialAngle: 5.8,
    texture: "saturn.jpg",
    hasRings: true,
    roughness: 0.9,
    metalness: 0,
    type: "planet",
    egg: {
      route: "saturn",
      game: "DONGLE PATROL",
      kicker: "Saturn · the dongle belt",
      brief:
        "The dongle users are pouring out of the rings in formation: HDMI drones, button wingmen, and the big conference pucks running the show. Hold the line in the Polaris fighter, and mind the boss pucks’ pairing beam — shoot one down mid-dive and your fighter comes home to fly beside you.",
    },
    moons: [
      { name: "Mimas", size: 0.06, dist: 2.8, speed: 1.05, color: [0.7, 0.7, 0.7], initialAngle: 0.9 },
      { name: "Enceladus", size: 0.08, dist: 3.2, speed: 0.73, color: [0.94, 0.97, 1], initialAngle: 4.1 },
      { name: "Tethys", size: 0.09, dist: 3.7, speed: 0.52, color: [0.8, 0.8, 0.85], initialAngle: 2.7 },
      { name: "Dione", size: 0.09, dist: 4.1, speed: 0.37, color: [0.75, 0.75, 0.8], initialAngle: 5.5 },
      { name: "Rhea", size: 0.12, dist: 4.8, speed: 0.22, color: [0.7, 0.7, 0.75], initialAngle: 1.3 },
      { name: "Titan", size: 0.21, dist: 5.5, speed: 0.063, color: [1, 0.65, 0], initialAngle: 2.3 },
      { name: "Iapetus", size: 0.11, dist: 7, speed: 0.014, color: [0.3, 0.3, 0.3], initialAngle: 0.5 },
    ],
  },
  {
    name: "URANUS",
    size: 1.2,
    dist: 37,
    speed: 0.000012,
    initialAngle: 1.2,
    texture: "uranus.jpg",
    roughness: 0.85,
    metalness: 0,
    type: "planet",
    egg: {
      route: "uranus",
      game: "POLARIS-MAN",
      kicker: "Uranus · the signal campaign",
      brief:
        "Eight moons, eight closed systems, and a boss sitting on each one. Dongle Baron charges a toll to reach any display; Screen Warden freezes the room to a single voice; Silo Sentinel will not let a signal cross a VLAN. Run the sectors, secure five workspace checkpoints, and take the boss at the end of the line — every one you beat hands you the capability that undoes the next. Earn all eight and the Polaris Nexus opens, where Protocol Prime is wearing every one of them as a shield.",
    },
    moons: [
      { name: "Ariel", size: 0.08, dist: 2.2, speed: 0.39, color: [0.6, 0.6, 0.65], initialAngle: 2.1 },
      { name: "Umbriel", size: 0.08, dist: 2.5, speed: 0.23, color: [0.4, 0.4, 0.45], initialAngle: 4.8 },
      { name: "Titania", size: 0.11, dist: 3, speed: 0.12, color: [0.55, 0.55, 0.6], initialAngle: 1.7 },
      { name: "Oberon", size: 0.1, dist: 3.4, speed: 0.075, color: [0.5, 0.5, 0.55], initialAngle: 5.3 },
      { name: "Miranda", size: 0.06, dist: 1.8, speed: 0.67, color: [0.53, 0.53, 0.53], initialAngle: 3.7 },
    ],
  },
  {
    name: "NEPTUNE",
    size: 1.1,
    dist: 42,
    speed: 0.0000061,
    initialAngle: 6.1,
    texture: "neptune.jpg",
    roughness: 0.85,
    metalness: 0,
    type: "planet",
    egg: { route: "dev", game: "—" },
    moons: [
      { name: "Triton", size: 0.11, dist: 3, speed: 0.17, color: [0.53, 0.81, 0.92], initialAngle: 0.9 },
      { name: "Nereid", size: 0.02, dist: 4.8, speed: 0.003, color: [0.5, 0.5, 0.5], initialAngle: 3.2 },
      { name: "Proteus", size: 0.03, dist: 2.2, speed: 0.89, color: [0.4, 0.4, 0.4], initialAngle: 5.7 },
    ],
  },
  {
    name: "PLUTO",
    size: 0.4,
    dist: 48,
    speed: 0.000004,
    initialAngle: 5.3,
    color: [0.82, 0.71, 0.55],
    roughness: 1,
    /* The one orbit off the ecliptic — real Pluto's 17 degrees, and the same
       tilt the hand-drawn SVG map gave it. The ring is drawn, so the tilt
       reads as a plane cutting across the others rather than only as a body
       sitting oddly high; it is the one thing on the map still saying the
       system has a third dimension. */
    inclination: 0.3,
    type: "dwarf",
    egg: {
      route: "pluto",
      game: "PACKET MUNCHER",
      kicker: "Pluto · deep-network maintenance",
      brief:
        "Something is nesting in the farthest switch fabric. Run the corridors, eat every stray packet, and mind the four interference glyphs — each hunts its own way. Ten sectors between you and a clean network.",
    },
    moons: [
      { name: "Charon", size: 0.2, dist: 1.8, speed: 0.16, color: [0.5, 0.5, 0.5], initialAngle: 1.8 },
    ],
  },
  {
    name: "ORCUS",
    size: 0.16,
    dist: 49,
    speed: 0.000004,
    initialAngle: 5.7,
    color: [0.18, 0.31, 0.31],
    roughness: 1,
    type: "dwarf",
  },
  {
    name: "MAKEMAKE",
    size: 0.25,
    dist: 50,
    speed: 0.0000032,
    initialAngle: 1.9,
    color: [0.55, 0.27, 0.07],
    roughness: 1,
    type: "dwarf",
  },
  {
    name: "HAUMEA",
    size: 0.28,
    dist: 51,
    speed: 0.0000035,
    initialAngle: 4.2,
    color: [1, 1, 1],
    roughness: 0.8,
    metalness: 0.1,
    type: "dwarf",
  },
  {
    name: "ERIS",
    size: 0.35,
    dist: 52,
    speed: 0.0000018,
    initialAngle: 2.7,
    color: [0.9, 0.9, 0.98],
    roughness: 1,
    type: "dwarf",
  },
  {
    name: "VARUNA",
    size: 0.12,
    dist: 53,
    speed: 0.0000027,
    initialAngle: 4.7,
    color: [0.41, 0.41, 0.41],
    roughness: 1,
    type: "tno",
  },
  {
    name: "QUAOAR",
    size: 0.18,
    dist: 54,
    speed: 0.0000035,
    initialAngle: 3.1,
    color: [0.4, 0.26, 0.13],
    roughness: 1,
    type: "tno",
  },
  {
    name: "GONGGONG",
    size: 0.19,
    dist: 56,
    speed: 0.0000018,
    initialAngle: 2.4,
    color: [0.5, 0, 0.13],
    roughness: 1,
    type: "dwarf",
  },
  {
    name: "SEDNA",
    size: 0.2,
    dist: 65,
    speed: 0.00000009,
    initialAngle: 0.1,
    color: [0.55, 0, 0],
    roughness: 1,
    type: "dwarf",
  },
];

/* The courier: no counterpart in the source scene, but NETWORK INTERFERENCE
   hung off the drifting ship on the old SVG map and had to keep a home. */
const SHIP: EggTarget = {
  route: "invade",
  game: "NETWORK INTERFERENCE",
  kicker: "The intruder · network diagnostics",
  brief:
    "Rogue signals are jamming the airspace above the room. You’re the pod — clear the channel. Jammers rain static, splitters multiply, and every fourth wave the firewall sweeps in behind a telegraphed beam.",
};

/* Main-belt rings, ported from createEnhancedAsteroidBelt(). The source built
   500 separate Meshes; one InstancedMesh per ring draws the same rock in three
   calls instead of 500. */
const BELTS = [
  { count: 150, r0: 19.5, r1: 21.5, size: 0.06, spread: 0.8, speed: 0.003 },
  { count: 200, r0: 21.5, r1: 23.5, size: 0.07, spread: 1.0, speed: 0.0025 },
  { count: 150, r0: 23.5, r1: 25.5, size: 0.08, spread: 1.2, speed: 0.002 },
];

const ROCK_COLORS: [number, number, number][] = [
  [0.4, 0.26, 0.13], // C-type
  [0.6, 0.6, 0.6], // S-type
  [0.5, 0.4, 0.3], // M-type
];

/* The source shipped at 0.4 and let a slider move it. With no slider, 0.6 is
   the compromise: the inner planets visibly move over the time someone spends
   choosing a game, without the system looking like it is spinning down. */
const SPEED = REDUCED ? 0 : 0.6;

/* --- what the map draws ---------------------------------------------------
   Two deliberate omissions. Everything the source scene carried is still in
   BODIES; these just decide what gets built.

   This is a launcher first and an orrery second, so the map only draws what
   can be clicked. The dwarf planets and trans-Neptunians — Ceres, Eris,
   Makemake, Sedna and the rest — front no game, and out past Neptune their
   gold and violet orbit rings were the loudest thing on screen while being
   the only bodies with nothing behind them. Pluto is the exception and stays,
   because PACKET MUNCHER lives there. Same for the moons: sixty-odd specks
   orbiting six planets is texture at the wide framing and clutter the moment
   the camera flies in on one.

   Flip either to true to get them back; nothing else needs to change. */
const SHOW_SURVEY_BODIES = false;
const SHOW_MOONS = false;

/* ------------------------------------------------------------------ state --- */

type Picked = { name: string; egg?: EggTarget; type: BodySpec["type"]; radius: number };

type Scene3D = {
  dispose: () => void;
  start: () => void;
  stop: () => void;
  /** Close any open briefing; true if one was open. */
  dismiss: () => boolean;
};

let scene3d: Scene3D | null = null;
let booting: Promise<Scene3D | null> | null = null;

/* ------------------------------------------------------------------ build --- */

async function build(host: HTMLElement, hooks: SolarHooks): Promise<Scene3D> {
  const { OrbitControls } = await import("three/examples/jsm/controls/OrbitControls.js");
  const { EffectComposer } = await import("three/examples/jsm/postprocessing/EffectComposer.js");
  const { RenderPass } = await import("three/examples/jsm/postprocessing/RenderPass.js");
  const { OutputPass } = await import("three/examples/jsm/postprocessing/OutputPass.js");
  const { UnrealBloomPass } = await import("three/examples/jsm/postprocessing/UnrealBloomPass.js");
  const { Lensflare, LensflareElement } = await import("three/examples/jsm/objects/Lensflare.js");

  const col = (c: [number, number, number]) => new THREE.Color(c[0], c[1], c[2]);

  /* --- renderer, camera, controls --- */

  const scene = new THREE.Scene();
  /* The darkest purple the site uses - #07050f, the top stop of the home hero's
     sky gradient - rather than the near-black navy this started as, so the panel,
     the backdrop around it and the scene inside it are all one colour family.
     Visible only past the 200-unit starfield sphere, which the camera's 240 max
     distance does reach; the two star spheres below are tinted to match. */
  scene.background = new THREE.Color(0x07050f);

  const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 2000);
  camera.position.set(0, 34, 68);

  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));

  const canvas = renderer.domElement;
  canvas.className = "ss3d-canvas";
  host.appendChild(canvas);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.rotateSpeed = 0.3;
  controls.zoomSpeed = 0.8;
  controls.panSpeed = 0.5;
  controls.minDistance = 8;
  controls.maxDistance = 240;
  /* A slow drift so the map reads as alive before anyone touches it. Paused
     while the pointer is over the canvas, so hover picking is not a moving
     target, and off entirely under reduced motion. */
  controls.autoRotate = !REDUCED;
  controls.autoRotateSpeed = 0.18;

  const loader = new THREE.TextureLoader();
  const mapTex = (file: string) => {
    const t = loader.load(TEX(file));
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };

  /* --- lighting --- */

  scene.add(new THREE.AmbientLight(new THREE.Color(0.13, 0.13, 0.13), 0.5));
  const sunLight = new THREE.PointLight(0xffffff, 10, 1000, 0.5);
  scene.add(sunLight);
  const fillLight = new THREE.PointLight(new THREE.Color(0.2, 0.4, 1), 2, 100, 1);
  fillLight.position.set(50, 50, -100);
  scene.add(fillLight);

  /* --- star spheres --- */

  const starfield = new THREE.Mesh(
    new THREE.SphereGeometry(200, 64, 64),
    new THREE.MeshBasicMaterial({
      map: mapTex("8k_stars.jpg"),
      side: THREE.BackSide,
      toneMapped: false,
      /* Warm the red and blue, hold the green back: the same total brightness as
         the neutral 1.2 it replaces, but the sky now reads violet rather than
         black. This tint is doing most of the work of "not black" — the scene
         background behind it is only visible at full zoom-out. */
      color: new THREE.Color(1.24, 1.06, 1.38),
    })
  );
  scene.add(starfield);

  const skyfield = new THREE.Mesh(
    new THREE.SphereGeometry(190, 64, 64),
    new THREE.MeshBasicMaterial({
      map: mapTex("stars.jpg"),
      side: THREE.BackSide,
      toneMapped: false,
      transparent: true,
      opacity: 0.3,
      /* was (0.8, 0.9, 1) — a cool blue wash; violet now, to match */
      color: new THREE.Color(0.95, 0.82, 1.12),
    })
  );
  scene.add(skyfield);

  /* --- sun --- */

  const sun = new THREE.Mesh(
    new THREE.SphereGeometry(5, 64, 64),
    new THREE.MeshBasicMaterial({
      map: mapTex("sun.jpg"),
      toneMapped: false,
      color: new THREE.Color(1.2, 1.1, 0.9),
    })
  );
  scene.add(sun);

  const flare0 = loader.load(TEX("lensflare0.png"));
  const flare2 = loader.load(TEX("lensflare2.png"));
  const lensflare = new Lensflare();
  lensflare.addElement(new LensflareElement(flare0, 512, 0, new THREE.Color(1, 0.9, 0.8)));
  lensflare.addElement(new LensflareElement(flare2, 128, 0.2, new THREE.Color(1, 1, 0.6)));
  lensflare.addElement(new LensflareElement(flare2, 64, 0.4, new THREE.Color(0.8, 0.8, 1)));
  lensflare.addElement(new LensflareElement(flare2, 32, 0.6, new THREE.Color(1, 0.8, 0.6)));
  sun.add(lensflare);

  /* --- pick layer ---
     Small bodies are a couple of pixels wide at the default framing, so every
     body carries an oversized invisible sphere for the raycaster — the direct
     descendant of the r=17 hit circles on the SVG map. colorWrite:false keeps
     it out of the frame while leaving it raycastable, which `visible = false`
     would not. */
  const HIT_MAT = new THREE.MeshBasicMaterial({
    colorWrite: false,
    depthWrite: false,
    transparent: true,
    opacity: 0,
  });
  const pickables: T.Object3D[] = [];

  const addPicker = (parent: T.Object3D, radius: number, data: Picked) => {
    const hit = new THREE.Mesh(new THREE.SphereGeometry(radius, 12, 12), HIT_MAT);
    hit.userData.pick = data;
    hit.renderOrder = -1;
    parent.add(hit);
    pickables.push(hit);
  };

  /* --- bodies --- */

  type Live = {
    mesh: T.Mesh;
    pivot: T.Object3D;
    speed: number;
    moons: { pivot: T.Object3D; mesh: T.Mesh; speed: number }[];
  };
  const live: Live[] = [];

  for (const body of BODIES) {
    /* Survey-only bodies carry no egg. See SHOW_SURVEY_BODIES. */
    if (!body.egg && !SHOW_SURVEY_BODIES) continue;

    const material = new THREE.MeshStandardMaterial({
      ...(body.texture ? { map: mapTex(body.texture) } : { color: col(body.color ?? [1, 1, 1]) }),
      metalness: body.metalness ?? 0.05,
      roughness: body.roughness ?? 1,
    });

    const mesh = new THREE.Mesh(new THREE.SphereGeometry(body.size, 48, 48), material);
    mesh.position.x = body.dist;

    const pivot = new THREE.Object3D();
    pivot.rotation.y = body.initialAngle ?? 0;
    pivot.add(mesh);

    /* An outer group carries the orbital tilt so the pivot's own rotation.y
       stays a clean phase angle — composing tilt and phase as two Euler terms
       on one object makes the phase precess as the tilt grows. The orbit ring
       goes inside the same group, so plane and marker cannot drift apart. */
    const plane = new THREE.Object3D();
    plane.rotation.z = body.inclination ?? 0;
    plane.add(pivot);
    scene.add(plane);

    /* Hit radius: generous enough that a 0.12-unit rock is still clickable,
       capped so neighbouring bodies do not swallow each other. */
    addPicker(mesh, Math.max(body.size * 2.4, 0.9), {
      name: body.name,
      egg: body.egg,
      type: body.type,
      radius: body.size,
    });

    /* Orbit ring. The source graded ring colour by body class and distance;
       kept, because it is what makes the outer system legible. */
    {
      let ringColor: [number, number, number];
      let opacity: number;
      if (body.type === "dwarf") {
        ringColor = [0.8, 0.6, 0];
        opacity = 0.04;
      } else if (body.type === "asteroid") {
        ringColor = [0.6, 0.3, 0.15];
        opacity = 0.03;
      } else if (body.type === "tno") {
        ringColor = [0.4, 0.15, 0.5];
        opacity = 0.05;
      } else if (body.dist < 20) {
        ringColor = [0.3, 0.5, 0.7];
        opacity = 0.02;
      } else if (body.dist < 35) {
        ringColor = [0.5, 0.4, 0.7];
        opacity = 0.03;
      } else {
        ringColor = [0.7, 0.3, 0.4];
        opacity = 0.04;
      }
      if (body.dist > 45) opacity *= 1.3;
      /* Launcher orbits sit brighter than survey-only ones: the ring is the
         first hint about which bodies are worth a click. */
      if (body.egg && body.egg.route !== "dev") opacity *= 3.2;

      const ring = new THREE.Mesh(
        new THREE.RingGeometry(body.dist - 0.05, body.dist + 0.05, 128),
        new THREE.MeshBasicMaterial({
          color: col(ringColor),
          side: THREE.DoubleSide,
          transparent: true,
          opacity,
          toneMapped: false,
        })
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.y = -0.01;
      plane.add(ring);
    }

    if (body.hasRings) {
      const ringTex = loader.load(TEX("saturn_ring.png"));
      ringTex.colorSpace = THREE.SRGBColorSpace;
      const inner = body.size + 0.5;
      const outer = body.size + 1.2;
      const ringGeo = new THREE.RingGeometry(inner, outer, 96);
      /* RingGeometry's stock UVs run across the bounding square, so a ring
         strip texture (2048x125, radial profile along x) lands smeared and the
         rings read as a grey wedge. Re-map u to the radial coordinate. */
      const rp = ringGeo.attributes.position;
      const ruv = ringGeo.attributes.uv;
      const rv = new THREE.Vector3();
      for (let i = 0; i < rp.count; i++) {
        rv.fromBufferAttribute(rp, i);
        ruv.setXY(i, (rv.length() - inner) / (outer - inner), 0.5);
      }
      ruv.needsUpdate = true;

      const planetRing = new THREE.Mesh(
        ringGeo,
        new THREE.MeshBasicMaterial({
          map: ringTex,
          alphaMap: ringTex,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.85,
          depthWrite: false,
        })
      );
      planetRing.rotation.x = Math.PI / 2;
      planetRing.rotation.y = 0.22; // a little tilt off the orbital plane
      mesh.add(planetRing);
    }

    const moons: Live["moons"] = [];
    for (const m of SHOW_MOONS ? (body.moons ?? []) : []) {
      const moonMesh = new THREE.Mesh(
        new THREE.SphereGeometry(m.size, 24, 24),
        new THREE.MeshStandardMaterial({ color: col(m.color), roughness: 0.9, metalness: 0.1 })
      );
      moonMesh.position.x = m.dist;
      const moonPivot = new THREE.Object3D();
      moonPivot.rotation.y = m.initialAngle ?? 0;
      moonPivot.add(moonMesh);
      mesh.add(moonPivot);
      moons.push({ pivot: moonPivot, mesh: moonMesh, speed: m.speed });
    }

    live.push({ mesh, pivot, speed: body.speed, moons });
  }

  /* --- asteroid belt --- */

  type Belt = {
    inst: T.InstancedMesh;
    angles: Float32Array;
    radii: Float32Array;
    heights: Float32Array;
    spins: Float32Array;
    speed: number;
  };
  const belts: Belt[] = [];
  const dummy = new THREE.Object3D();

  for (const spec of BELTS) {
    const inst = new THREE.InstancedMesh(
      new THREE.SphereGeometry(1, 6, 6),
      new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0.12, toneMapped: false }),
      spec.count
    );
    const angles = new Float32Array(spec.count);
    const radii = new Float32Array(spec.count);
    const heights = new Float32Array(spec.count);
    const spins = new Float32Array(spec.count);
    const scales = new Float32Array(spec.count);

    for (let i = 0; i < spec.count; i++) {
      angles[i] = (i / spec.count) * Math.PI * 2 + Math.random() * 0.5;
      radii[i] = spec.r0 + Math.random() * (spec.r1 - spec.r0);
      heights[i] = (Math.random() - 0.5) * spec.spread;
      spins[i] = (Math.random() - 0.5) * 0.02;
      scales[i] = 0.01 + Math.random() * spec.size;
      inst.setColorAt(i, col(ROCK_COLORS[(Math.random() * ROCK_COLORS.length) | 0]));
    }
    /* Scale is baked into the matrix each frame, so stash it where the update
       loop can reach it without a second array of Object3Ds. */
    inst.userData.scales = scales;
    inst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    /* The bounding sphere comes from the unit source geometry at the origin,
       but the instances sit 20-25 units out: left to cull, the whole belt
       disappears as soon as the origin leaves the frustum. */
    inst.frustumCulled = false;
    scene.add(inst);

    belts.push({ inst, angles, radii, heights, spins, speed: spec.speed });
  }

  const layBelt = (b: Belt, t: number) => {
    const scales = b.inst.userData.scales as Float32Array;
    for (let i = 0; i < b.angles.length; i++) {
      const a = b.angles[i] + t * b.speed;
      dummy.position.set(Math.cos(a) * b.radii[i], b.heights[i], Math.sin(a) * b.radii[i]);
      dummy.rotation.set(t * b.spins[i], t * b.spins[i] * 1.3, 0);
      dummy.scale.setScalar(scales[i]);
      dummy.updateMatrix();
      b.inst.setMatrixAt(i, dummy.matrix);
    }
    b.inst.instanceMatrix.needsUpdate = true;
  };
  for (const b of belts) layBelt(b, 0);

  /* --- the courier ---
     Ours, not the source's. The "UNIDENTIFIED" contact that fronted NETWORK
     INTERFERENCE on the SVG map, rebuilt as something that could not be one
     of ours: a saucer, not a craft with a nose and a tail. The first pass had
     a capsule hull, a canopy and a swept wing, which read as a human probe —
     recognisable engineering, so nothing about it said intruder.

     Everything is primitives, because the module already refuses to load a
     mesh format for one object. What sells it is not the silhouette but the
     lighting: a hull dark enough to be a hole in the starfield, and the
     glowing parts carrying nearly all the read. */

  const ship = new THREE.Group();

  /* Hull: near-black, hard specular. Two lathed halves rather than a squashed
     sphere so the rim stays a defined edge instead of a soft bulge. */
  const hullMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0.05, 0.05, 0.08),
    roughness: 0.25,
    metalness: 0.9,
  });
  const saucerProfile: T.Vector2[] = [];
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    saucerProfile.push(new THREE.Vector2(0.62 * Math.sin(t * Math.PI * 0.5), 0.17 * Math.cos(t * Math.PI * 0.5)));
  }
  const saucerTop = new THREE.Mesh(new THREE.LatheGeometry(saucerProfile, 36), hullMat);
  ship.add(saucerTop);
  const saucerBottom = new THREE.Mesh(new THREE.LatheGeometry(saucerProfile, 36), hullMat);
  saucerBottom.scale.y = -0.72; // shallower underside, so it sits like a disc
  ship.add(saucerBottom);

  /* Rim band: the one lit edge, and the thing that reads at distance. */
  const rimMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(0.42, 0.95, 0.6),
    toneMapped: false,
    transparent: true,
    opacity: 0.72,
  });
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.022, 8, 40), rimMat);
  rim.rotation.x = Math.PI / 2;
  ship.add(rim);

  /* Dome: no canopy, no seam, nothing to look out of. */
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(0.23, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({
      color: new THREE.Color(0.08, 0.4, 0.28),
      emissive: new THREE.Color(0.09, 0.4, 0.26),
      roughness: 0.15,
      metalness: 0.3,
      transparent: true,
      opacity: 0.75,
    })
  );
  dome.position.y = 0.1;
  ship.add(dome);

  /* Rim lights: an odd count at an irregular spacing, so the ring never
     resolves into a pattern a human would have laid out. */
  const lightMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(0.55, 1, 0.72),
    toneMapped: false,
  });
  const lightGeo = new THREE.SphereGeometry(0.045, 8, 6);
  const rimLights = new THREE.Group();
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + Math.sin(i * 2.1) * 0.12;
    const l = new THREE.Mesh(lightGeo, lightMat);
    l.position.set(Math.cos(a) * 0.5, -0.055, Math.sin(a) * 0.5);
    rimLights.add(l);
  }
  ship.add(rimLights);

  /* Underglow: the lit belly that makes it a saucer rather than a disc.
     Additive so it brightens what it crosses instead of greying it, and
     depthWrite off so it never punches a hole in the stars. */
  const underglow = new THREE.Mesh(
    new THREE.SphereGeometry(0.2, 16, 10),
    new THREE.MeshBasicMaterial({
      color: new THREE.Color(0.5, 1, 0.7),
      toneMapped: false,
      transparent: true,
      /* Kept well under 1: additive plus bloom, this was bright enough to
         wash the hull out to the same green as the glow, which threw away
         the dark silhouette the whole model is built around. */
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  underglow.position.y = -0.17;
  underglow.scale.set(0.82, 0.36, 0.82);
  ship.add(underglow);

  ship.scale.setScalar(1.5);
  scene.add(ship);
  addPicker(ship, 1.6, { name: "UNIDENTIFIED", egg: SHIP, type: "planet", radius: 0.62 });

  const SHIP_ORBIT = { rx: 34, rz: 27, tilt: 0.33, speed: 0.00042 };
  const SHIP_AXIS = new THREE.Vector3(0, 0, 1); // hoisted: shipAt runs twice a frame
  const shipAt = (t: number, out: T.Vector3) => {
    const a = t * SHIP_ORBIT.speed;
    out.set(Math.cos(a) * SHIP_ORBIT.rx, Math.sin(a * 1.7) * 4.5, Math.sin(a) * SHIP_ORBIT.rz);
    out.applyAxisAngle(SHIP_AXIS, SHIP_ORBIT.tilt);
    return out;
  };
  const shipPos = new THREE.Vector3();

  /* --- post-processing --- */

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.5, 0.6, 0.05);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  /* --- distant star points --- */

  const starCount = 1500;
  const starPositions = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount * 3; i += 3) {
    const radius = 150 + Math.random() * 100;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.random() * Math.PI;
    starPositions[i] = radius * Math.sin(phi) * Math.cos(theta);
    starPositions[i + 1] = radius * Math.sin(phi) * Math.sin(theta);
    starPositions[i + 2] = radius * Math.cos(phi);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
  const distantStars = new THREE.Points(
    starGeo,
    new THREE.PointsMaterial({ color: 0xffffff, size: 0.7, transparent: true, opacity: 0.9 })
  );
  scene.add(distantStars);

  /* --- targeting HUD ---
     The brackets and data card the SVG map drew in the same coordinate space
     as the planets. In WebGL there is no such space, so they are DOM elements
     positioned from the projected world point each frame.

     Brackets and card are siblings, not nested, and both are placed by JS in
     host coordinates. Nesting the card inside a transformed anchor would make
     that anchor its containing block, which quietly breaks any attempt to pin
     the card to the frame on a narrow screen. */

  const hud = document.createElement("div");
  hud.className = "ss3d-hud";
  /* The reticle is three nested pieces so each can be animated independently
     without fighting the JS that positions it. The outer .ss3d-brk carries the
     translate and the size, and nothing else touches it; .ss3d-brk-c is the
     masked corner bracket that snaps inward on acquisition; .ss3d-brk-r is a
     dashed ranging ring that turns slowly for as long as the lock holds. Put
     the snap animation on the outer element and it would be overwritten by
     placeHud on the next frame. */
  hud.innerHTML =
    '<svg class="ss3d-wire" aria-hidden="true">' +
    '<path class="ss3d-wl" pathLength="1" />' +
    '<path class="ss3d-wt" pathLength="1" />' +
    '<circle class="ss3d-wn" r="2.4" />' +
    "</svg>" +
    '<i class="ss3d-brk"><i class="ss3d-brk-c"></i><i class="ss3d-brk-r"></i></i>' +
    '<div class="ss3d-card">' +
    '<b class="ss3d-name"></b>' +
    '<em class="ss3d-status"></em>' +
    '<span class="ss3d-game"></span>' +
    "</div>";
  host.appendChild(hud);
  const hudBrk = hud.querySelector<HTMLElement>(".ss3d-brk")!;
  const hudCard = hud.querySelector<HTMLElement>(".ss3d-card")!;
  const wireLine = hud.querySelector<SVGPathElement>(".ss3d-wl")!;
  const wireTick = hud.querySelector<SVGPathElement>(".ss3d-wt")!;
  const wireNode = hud.querySelector<SVGCircleElement>(".ss3d-wn")!;
  const hudName = hud.querySelector<HTMLElement>(".ss3d-name")!;
  const hudStatus = hud.querySelector<HTMLElement>(".ss3d-status")!;
  const hudGame = hud.querySelector<HTMLElement>(".ss3d-game")!;

  /* Kept in step with the fixed line-heights on .ss3d-card in games.css: the
     placement maths needs the card's height before it has been laid out. */
  const CARD_W = 262;
  const CARD_H = 80;

  /* How far in from the card's near corner the leader line ties in.
     This number is the whole fix. The old connector was a --lead-sized square
     hung off the card's corner with a hairline diagonal across it, aimed at the
     corner point - and a corner is the one place on a rounded, bordered box
     where a line cannot land cleanly. border-radius:3.5px curves the border
     away from the mathematical corner, so a 45-degree hairline arriving there
     passes through the gap and clips both curved segments: it cuts the corner
     off instead of arriving at the box.

     Offsetting the card by TIE on the vertical axis moves its corner off the
     45-degree ray, so the same ray now crosses the card's near horizontal EDGE
     exactly TIE pixels inboard of the corner. A line meeting a straight edge at
     45 degrees, with a node dot on it, is unambiguous: it goes to the box. */
  const TIE = 26;

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const projected = new THREE.Vector3();
  let hovered: T.Object3D | null = null;
  let pointerInside = false;
  let pointerClient = { x: 0, y: 0 };

  const describe = (p: Picked) => {
    if (p.egg && p.egg.route !== "dev") return { status: "▸ GAME AVAILABLE", cls: "", game: p.egg.game };
    if (p.egg) return { status: "▸ IN DEVELOPMENT", cls: "dev", game: "—" };
    const label =
      p.type === "dwarf" ? "DWARF PLANET" : p.type === "asteroid" ? "MINOR PLANET" : "TRANS-NEPTUNIAN";
    return { status: "▸ SURVEY ONLY", cls: "survey", game: label };
  };

  const setHover = (hit: T.Object3D | null) => {
    if (hit === hovered) return;
    hovered = hit;
    if (!hit) {
      hud.classList.remove("on");
      canvas.style.cursor = "";
      hooks.onHover?.(null);
      return;
    }
    const p = hit.userData.pick as Picked;
    const d = describe(p);
    hudName.textContent = p.name;
    hudStatus.textContent = d.status;
    hudStatus.className = "ss3d-status " + d.cls;
    hudGame.textContent = d.game;
    /* The reticle and the leader take the status colour, so the lock itself
       tells you whether there is a game here before you have read a word of
       the card: green for playable, amber in development, grey for survey.
       One class on the HUD root drives reticle, ring, wire, node and tick. */
    hud.className = "ss3d-hud on" + (d.cls ? " " + d.cls : "");
    /* Restart the acquisition animation for each new target. Removing and
       re-adding in the same frame is a no-op without a forced reflow between
       them, and the reflow is the reason for reading offsetWidth. */
    hud.classList.remove("acq");
    void hud.offsetWidth;
    hud.classList.add("acq");
    canvas.style.cursor = "pointer";
    hooks.onHover?.(p.name);
  };

  const pick = () => {
    /* No scanning while the camera is on approach or a briefing is up — the
       reticle chasing bodies behind the panel reads as noise. */
    if (focus || !pointerInside) {
      setHover(null);
      return;
    }
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((pointerClient.x - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((pointerClient.y - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(pickables, false);
    setHover(hits.length ? hits[0].object : null);
  };

  /* Place the brackets and the card from the hovered body's projected point.
     The card prefers up-and-right of the target and flips on whichever axis
     would run it out of the frame — the SVG map did the same, laid out by
     hand per planet. Below 720px there is no side with room for a 262px card,
     so it parks along the bottom edge and drops its lead line. */
  const placeHud = () => {
    if (!hovered) return;
    const rect = canvas.getBoundingClientRect();
    hovered.getWorldPosition(projected);
    const depth = camera.position.distanceTo(projected);
    projected.project(camera);
    if (projected.z > 1) {
      hud.classList.remove("on");
      return;
    }
    const x = (projected.x * 0.5 + 0.5) * rect.width;
    const y = (-projected.y * 0.5 + 0.5) * rect.height;

    /* Bracket size tracks apparent size: the body's half-height in pixels,
       from the vertical FOV and its distance, clamped so a speck still gets a
       clickable-looking reticle and Jupiter does not fill the frame. */
    const p = hovered.userData.pick as Picked;
    const vh = 2 * Math.tan((camera.fov * Math.PI) / 360) * depth;
    const box = Math.min(Math.max((p.radius / vh) * rect.height * 2.6, 26), 150);
    const lead = box * 0.5 + 10;

    hudBrk.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
    hudBrk.style.width = `${box}px`;
    hudBrk.style.height = `${box}px`;

    if (rect.width < 720) {
      /* Clear of the key hints, which wrap to two rows at this width. */
      const mx = Math.max(8, (rect.width - CARD_W) / 2);
      hudCard.style.transform = `translate(${mx}px, ${rect.height - CARD_H - 76}px)`;
      hud.classList.remove("wired");
      return;
    }

    /* Both bounds tests carry TIE, because the card is now offset by it. Drop it
       and a body near the top edge flips down on the old arithmetic and then
       hangs TIE pixels off the frame. */
    const flip = x + lead + CARD_W > rect.width;
    const down = y - lead - TIE - CARD_H < 0;
    const dirX = flip ? -1 : 1;
    const dirY = down ? 1 : -1;
    const cx = flip ? x - lead - CARD_W : x + lead;
    const cy = down ? y + lead + TIE : y - lead - TIE - CARD_H;
    hudCard.style.transform = `translate(${cx}px, ${cy}px)`;

    /* The leader, in host pixels.
       Start just outside the reticle corner facing the card, so the wire reads
       as leaving the bracket rather than growing out of the planet. End on the
       card's near horizontal edge, TIE inboard of its corner. The two legs are
       equal by construction - both are (lead + TIE - box/2 - 2) + box/2 + 2 -
       so the run is exactly 45 degrees without needing to be trigonometry. */
    const s = box * 0.5 + 2;
    const sx = x + dirX * s;
    const sy = y + dirY * s;
    const tx = (flip ? cx + CARD_W : cx) + dirX * TIE;
    const ty = down ? cy : cy + CARD_H;

    wireLine.setAttribute("d", `M ${sx} ${sy} L ${tx} ${ty}`);
    /* A short tick running along the card's edge away from the tie-in, on the
       side the wire came from. It reads as the line docking into the panel. */
    wireTick.setAttribute("d", `M ${tx - dirX * 13} ${ty} L ${tx + dirX * 15} ${ty}`);
    wireNode.setAttribute("cx", String(tx));
    wireNode.setAttribute("cy", String(ty));
    hud.classList.add("wired");
  };

  /* --- approach and briefing ---------------------------------------------
     Clicking a world does not drop straight into its game. The camera flies
     to the body and holds station on it, then the briefing panel opens over
     the render with the game's own copy and a Go button. Only Go calls
     hooks.onLaunch, so the launcher keeps one decision point instead of
     turning a stray click into a full-screen game. */

  const brief = document.createElement("div");
  brief.className = "ss3d-brief";
  brief.innerHTML =
    '<div class="ss3d-brief-card" role="dialog" aria-modal="true" aria-labelledby="ss3d-brief-title">' +
    '<span class="ss3d-brief-k"></span>' +
    '<h3 class="ss3d-brief-t" id="ss3d-brief-title"></h3>' +
    '<p class="ss3d-brief-d"></p>' +
    '<div class="ss3d-brief-row">' +
    '<button type="button" class="ss3d-brief-back">← Back to the system</button>' +
    '<button type="button" class="ss3d-brief-go">Go →</button>' +
    "</div></div>";
  host.appendChild(brief);
  const briefK = brief.querySelector<HTMLElement>(".ss3d-brief-k")!;
  const briefT = brief.querySelector<HTMLElement>(".ss3d-brief-t")!;
  const briefD = brief.querySelector<HTMLElement>(".ss3d-brief-d")!;
  const briefGo = brief.querySelector<HTMLButtonElement>(".ss3d-brief-go")!;
  const briefBack = brief.querySelector<HTMLButtonElement>(".ss3d-brief-back")!;

  type Focus = {
    obj: T.Object3D;
    pick: Picked;
    /** performance.now() at which the panel opens, part-way into the flight */
    showAt: number;
    shown: boolean;
    /** false while flying in, true once holding station */
    arrived: boolean;
    last: T.Vector3;
  };
  let focus: Focus | null = null;
  /** Set on dismissal: eases the camera back to the opening framing. */
  let homing = false;

  const HOME_POS = camera.position.clone();
  const WORLD_UP = new THREE.Vector3(0, 1, 0);
  /** Quarter-turn off the sun line — a three-quarter face, terminator on show. */
  const FOCUS_SWING = Math.PI / 4;
  /** Tangent of the approach elevation: ~10 degrees, so it looks across, not down. */
  const FOCUS_RISE = 0.18;
  const fBody = new THREE.Vector3();
  const fWant = new THREE.Vector3();
  const fDir = new THREE.Vector3();
  const fRight = new THREE.Vector3();
  const fLook = new THREE.Vector3();
  const fDelta = new THREE.Vector3();
  const ORIGIN = new THREE.Vector3();

  const beginFocus = (obj: T.Object3D, p: Picked) => {
    focus = {
      obj,
      pick: p,
      showAt: performance.now() + (REDUCED ? 0 : 900),
      shown: false,
      arrived: false,
      last: new THREE.Vector3(),
    };
    obj.getWorldPosition(focus.last);
    homing = false;
    /* The flight owns the camera; handing it back mid-approach just fights
       the easing. Pan stays off for the whole focus so the body cannot be
       dragged out from under the panel. */
    controls.enabled = false;
    controls.enablePan = false;
    controls.autoRotate = false;
    setHover(null);
  };

  const showBrief = (p: Picked) => {
    const e = p.egg!;
    briefK.textContent = e.kicker ?? p.name;
    briefT.textContent = e.game;
    briefD.textContent = e.brief ?? "";
    brief.classList.add("on");
    briefGo.focus({ preventScroll: true });
  };

  /** Drop the briefing and fly home. Returns false if there was nothing up. */
  const clearFocus = (): boolean => {
    if (!focus) return false;
    focus = null;
    homing = true;
    brief.classList.remove("on");
    controls.enabled = false;
    controls.enablePan = true;
    return true;
  };

  const updateFocus = () => {
    if (homing) {
      camera.position.lerp(HOME_POS, 0.07);
      controls.target.lerp(ORIGIN, 0.07);
      if (camera.position.distanceTo(HOME_POS) < 0.6) {
        camera.position.copy(HOME_POS);
        controls.target.copy(ORIGIN);
        homing = false;
        controls.enabled = true;
        controls.autoRotate = !REDUCED && !pointerInside;
      }
      return;
    }
    if (!focus) return;

    focus.obj.getWorldPosition(fBody);

    /* Reveal the panel on arrival OR on the timer, whichever lands first, and
       check it here — above the arrived branch, which returns.

       Both halves of that matter. The check used to sit at the bottom of this
       function, past that return, and fire on the timer alone: any approach
       that parked inside 900ms reached the return first and the panel never
       opened at all. Short hops did it, and so did every 120Hz display, since
       the easing converges in a fixed number of frames while the timer is
       wall-clock — which is exactly the "sometimes the card doesn't appear"
       shape, and why it looked intermittent. */
    if (!focus.shown && (focus.arrived || performance.now() >= focus.showAt)) {
      focus.shown = true;
      showBrief(focus.pick);
    }

    if (focus.arrived) {
      /* Holding station: translate the whole rig by the body's own motion, so
         the framing rides along with it and the user can still orbit and zoom
         around it while reading. */
      fDelta.subVectors(fBody, focus.last);
      camera.position.add(fDelta);
      controls.target.add(fDelta);
      focus.last.copy(fBody);
      return;
    }

    /* Framing: a three-quarter view from the sunward side, near level with the
       body rather than above it.

       Deriving the approach direction from where the camera already is — the
       obvious thing, and what this did first — carries the opening bird's-eye
       angle all the way in, so every world ends up viewed from overhead. Bank
       it to the sun line instead. Dead-on sunward would light the disc flat;
       swinging a quarter-turn off keeps a terminator on it, so the body reads
       as a sphere. */
    const d = Math.max(focus.pick.radius * 7.5, 4.5);
    fDir.copy(fBody).setY(0);
    if (fDir.lengthSq() < 1e-6) fDir.set(1, 0, 0); // body over the sun: any side will do
    fDir.normalize().negate().applyAxisAngle(WORLD_UP, FOCUS_SWING);
    fDir.y = FOCUS_RISE;
    fDir.normalize();
    fWant.copy(fBody).addScaledVector(fDir, d);

    /* On a wide frame the panel takes the right-hand side, so aim a little
       right of the body and let it sit in the clear third.

       "Right" comes off the approach direction, not off camera.getWorldDirection().
       Taking it from the live orientation feeds the aim point back into the
       orientation that produced it, and the loop walks the view off the body a
       little more every frame — far enough, on Jupiter, to swing the sun into
       the shot. This basis depends only on where the body is. */
    fRight.crossVectors(fDir, WORLD_UP).normalize(); // fDir points body -> camera
    fLook.copy(fBody).addScaledVector(fRight, host.clientWidth >= 860 ? -d * 0.3 : 0);

    const k = REDUCED ? 1 : 0.075;
    camera.position.lerp(fWant, k);
    controls.target.lerp(fLook, k);
    focus.last.copy(fBody);

    if (camera.position.distanceTo(fWant) < d * 0.05) {
      focus.arrived = true;
      /* Hand the camera back now that it is parked: orbit and zoom around the
         body while reading. Pan stays off so it cannot be dragged out from
         under the panel. */
      controls.enabled = true;
    }
  };

  briefGo.addEventListener("click", () => {
    const route = focus?.pick.egg?.route;
    clearFocus();
    if (route) hooks.onLaunch(route);
  });
  briefBack.addEventListener("click", () => clearFocus());

  /* --- input --- */

  const onPointerMove = (e: PointerEvent) => {
    pointerInside = true;
    pointerClient = { x: e.clientX, y: e.clientY };
    if (!focus && !homing) controls.autoRotate = false;
  };
  const onPointerLeave = () => {
    pointerInside = false;
    setHover(null);
    if (!focus && !homing) controls.autoRotate = !REDUCED;
  };
  /* Click, not pointerdown: a drag that starts on a planet is a camera move,
     not a launch. OrbitControls consumes the drag, and the browser only
     synthesises `click` when the pointer stayed put. */
  const onClick = () => {
    /* Not gated on `homing`: the fly-home after backing out runs for about a
       second, and a click on a world during it used to be swallowed whole —
       the other half of "sometimes the card doesn't appear". beginFocus
       clears homing, so picking a new target simply interrupts the return. */
    if (focus || !hovered) return;
    const p = hovered.userData.pick as Picked;
    if (p.egg && p.egg.route !== "dev") {
      beginFocus(hovered, p);
      return;
    }
    hooks.onDev();
    hud.classList.remove("flash");
    void hud.offsetWidth; // restart the animation on a repeat click
    hud.classList.add("flash");
  };

  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerleave", onPointerLeave);
  canvas.addEventListener("click", onClick);

  /* --- keyboard access ---
     A raycast against a WebGL canvas is mouse-only, so until now no world could
     be reached without a pointer. This layer gives each launchable body a real
     <button>: off-screen, never painted, but focusable and named, so Tab walks
     the worlds and Enter opens the same briefing a click would.

     It is deliberately not a visible control. The worlds stay a discovery, and
     nothing on screen announces them — but "hidden" should mean "not advertised",
     not "unreachable without a mouse", and a keyboard or screen-reader user was
     previously locked out of all of it.

     Only bodies with a real route get an entry: an in-development world has
     nothing to activate, and listing it would leak more than the visuals do. */
  const a11y = document.createElement("div");
  a11y.className = "ss3d-a11y";
  a11y.setAttribute("role", "group");
  a11y.setAttribute("aria-label", "Worlds");
  for (const hit of pickables) {
    const p = hit.userData.pick as Picked;
    if (!p.egg || p.egg.route === "dev") continue;
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = `${p.name} — ${p.egg.game}`;
    b.addEventListener("click", () => {
      if (focus) return;
      setHover(null);
      beginFocus(hit, p);
    });
    a11y.appendChild(b);
  }
  host.appendChild(a11y);

  /* --- sizing --- */

  const resize = () => {
    const w = host.clientWidth;
    const h = host.clientHeight;
    if (!w || !h) return;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    bloom.resolution.set(w, h);
  };
  const ro = new ResizeObserver(resize);
  ro.observe(host);
  resize();

  /* --- loop --- */

  let raf = 0;
  let clock = 0;

  const frame = () => {
    raf = requestAnimationFrame(frame);
    clock += SPEED;

    if (SPEED) {
      sun.rotation.y += 0.002 * SPEED;
      for (const p of live) {
        p.pivot.rotation.y += p.speed * SPEED;
        p.mesh.rotation.y += 0.01 * SPEED;
        for (const m of p.moons) {
          m.pivot.rotation.y += m.speed * 0.1 * SPEED;
          m.mesh.rotation.y += 0.02 * SPEED;
        }
      }
      for (const b of belts) layBelt(b, clock);
      distantStars.rotation.y += 0.0001 * SPEED;

      /* A saucer has no nose to point, so it does not fly along its velocity
         the way the old hull did — it holds a lazy bank and spins about its
         own axis, which is most of what makes the shape read as alien. */
      shipAt(clock, shipPos);
      ship.position.copy(shipPos);
      ship.rotation.set(
        0.14 + Math.sin(clock * 0.011) * 0.06,
        clock * 0.014,
        0.09 + Math.cos(clock * 0.009) * 0.05
      );
      const pulse = 0.8 + Math.sin(clock * 0.12) * 0.2;
      underglow.scale.set(0.82 * pulse, 0.36 * pulse, 0.82 * pulse);
      rimLights.rotation.y = -clock * 0.05;
    }

    /* Before controls.update(), so the approach owns the camera for the frame
       and OrbitControls' damping settles onto the position it just set. */
    updateFocus();
    controls.update();

    /* Bloom rises as the camera closes on the sun — the source's one piece of
       camera-reactive grading, and the reason the inner system glows.

       That grading is written for the wide view, where being near the sun
       means the sun fills the frame. On approach the camera is near a planet
       instead, and the same curve blows the lit hemisphere to white behind
       the briefing panel, so ease it back down while focused. */
    const d = camera.position.distanceTo(sun.position);
    const t = Math.max(0, Math.min(1, (d - 10) / 90));
    const calm = focus || homing ? 0.35 : 1;
    bloom.strength = (0.5 + (1 - t) * 1.0) * calm;
    bloom.radius = 0.6 + (1 - t) * 0.4;

    pick();
    placeHud();
    hooks.onTick?.();
    composer.render();
  };

  /* --- teardown --- */

  const dispose = () => {
    cancelAnimationFrame(raf);
    ro.disconnect();
    canvas.removeEventListener("pointermove", onPointerMove);
    canvas.removeEventListener("pointerleave", onPointerLeave);
    canvas.removeEventListener("click", onClick);
    scene.traverse((o) => {
      const any = o as T.Mesh;
      any.geometry?.dispose?.();
      const mat = any.material;
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
      else mat?.dispose?.();
    });
    renderer.dispose();
    composer.dispose();
    canvas.remove();
    hud.remove();
    brief.remove();
    a11y.remove();
  };

  return {
    dismiss: clearFocus,
    start: () => {
      if (!raf) {
        resize();
        raf = requestAnimationFrame(frame);
      }
    },
    stop: () => {
      cancelAnimationFrame(raf);
      raf = 0;
      setHover(null);
    },
    dispose,
  };
}

/* ------------------------------------------------------------------- api --- */

/**
 * Bring up the 3D map inside `host`, building it on first call and re-starting
 * the loop on every one after. Returns false if WebGL is unavailable or the
 * three.js chunk fails to load, which is the caller's cue to fall back to the
 * SVG map still sitting hidden in the overlay.
 */
export async function solarStart(host: HTMLElement, hooks: SolarHooks): Promise<boolean> {
  if (!scene3d) {
    booting ??= build(host, hooks).catch((err) => {
      console.warn("[eggs] 3D solar system unavailable:", err);
      hooks.onFail?.(String(err));
      return null;
    });
    scene3d = await booting;
    if (!scene3d) return false;
  }
  scene3d.start();
  return true;
}

/** Park the loop. The scene is kept, so reopening Mission Control is instant. */
export function solarStop() {
  scene3d?.dismiss();
  scene3d?.stop();
}

/**
 * Close an open briefing and fly back out, reporting whether there was one.
 * Esc goes through here first: with a briefing up it should back out to the
 * system, and only close Mission Control when there is nothing to back out of.
 */
export function solarDismiss(): boolean {
  return scene3d?.dismiss() ?? false;
}
