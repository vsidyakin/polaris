/* Polaris-Man — mission, enemy, weapon and atlas tables.
 *
 * Transcribed verbatim from Mersive_Polaris_Signal_Breaker_v1.7.html. Copy,
 * colours and every sub-rect are unchanged; only the shape is different
 * (typed, exported, one table per concern instead of loose consts).
 *
 * The rect tables are the contract with the locked artwork. Each entry is
 * [x0, y0, x1, y1] in *source pixels* of the PNG named beside it. Do not
 * adjust these to "fix" a sprite — the art is fixed, so a bad rect is a rect
 * bug, and changing the art is out of bounds.
 */

export const PALETTE = {
  void: "#05040c",
  deep: "#0b0818",
  panel: "#17112f",
  purple: "#6d5bb8",
  lav: "#b9a8ff",
  white: "#f7f3ff",
  muted: "#a89fc4",
  green: "#7ce3a8",
  copper: "#e07856",
  gold: "#e8c76a",
  danger: "#ee6d78",
  cyan: "#61c8dc",
  blue: "#334e88",
  black: "#06030d",
} as const;

export type MoonId =
  | "ariel" | "umbriel" | "titania" | "oberon"
  | "miranda" | "puckmoon" | "cressida" | "desdemona";
export type MissionId = MoonId | "final";
export type WeaponId =
  | "pulse" | "browser" | "canvas" | "crossnet" | "evergreen"
  | "airlink" | "guestkey" | "byomswitch" | "fleetsync";

export interface Mission {
  id: MissionId;
  moon: string;
  name: string;
  theme: string;
  boss: string;
  weapon: WeaponId;
  tag: string;
  quip: string;
  accent: string;
  sky: [string, string];
  weak: WeaponId;
  sign: string;
}

export const MISSIONS: readonly Mission[] = [
  { id: "ariel", moon: "ARIEL", name: "DONGLE DRIFT", theme: "SIGNAL / PAIRING", boss: "DONGLE BARON", weapon: "browser", tag: "No puck. No pairing ritual. No problem.", quip: "EVERY SIGNAL PAYS THE TOLL.", accent: "#7ce3a8", sky: ["#071726", "#17384a"], weak: "evergreen", sign: "PAIRING TOKEN REQUIRED" },
  { id: "umbriel", moon: "UMBRIEL", name: "WALLED GARDEN", theme: "COLD / ICE", boss: "SCREEN WARDEN", weapon: "canvas", tag: "A display should be a workspace, not a locked window.", quip: "ONE SCREEN. ONE VOICE. FOREVER.", accent: "#b9a8ff", sky: ["#090612", "#25133a"], weak: "browser", sign: "ONE SCREEN ONLY" },
  { id: "titania", moon: "TITANIA", name: "SILO FIELDS", theme: "ELECTRIC / NETWORK", boss: "SILO SENTINEL", weapon: "crossnet", tag: "Bring guests and rooms together across networks.", quip: "THAT NETWORK IS NOT THIS NETWORK.", accent: "#61c8dc", sky: ["#071b21", "#17404a"], weak: "canvas", sign: "ACCESS DENIED: WRONG VLAN" },
  { id: "oberon", moon: "OBERON", name: "REFRESH FOUNDRY", theme: "HEAT / FIRE", boss: "REFRESH TITAN", weapon: "evergreen", tag: "Keep the room. Keep improving the platform.", quip: "SUPPORT EXPIRED YESTERDAY.", accent: "#e07856", sky: ["#160a0b", "#4b2119"], weak: "crossnet", sign: "REPLACE TO CONTINUE" },
  { id: "miranda", moon: "MIRANDA", name: "CABLE LABYRINTH", theme: "HARDWIRE / ROUTING", boss: "HDMI HYDRA", weapon: "airlink", tag: "A room should connect people, not trap them in cable paths.", quip: "FOLLOW THE CABLE. IF YOU CAN.", accent: "#ef6abf", sky: ["#070718", "#321530"], weak: "fleetsync", sign: "PHYSICAL INPUT REQUIRED" },
  { id: "puckmoon", moon: "PUCK", name: "APP TRAP", theme: "INSTALL / AUTH", boss: "INSTALL SENTINEL", weapon: "guestkey", tag: "Guests should share immediately, without downloads or admin rights.", quip: "INSTALL FIRST. COLLABORATE LATER.", accent: "#a9f542", sky: ["#0b071b", "#302052"], weak: "airlink", sign: "DOWNLOAD REQUIRED" },
  { id: "cressida", moon: "CRESSIDA", name: "CODEC KEEP", theme: "CODEC / APPLIANCE", boss: "CODEC COLOSSUS", weapon: "byomswitch", tag: "Use the meeting platform people choose, not the room appliance they inherit.", quip: "THIS ROOM RUNS ONE WAY.", accent: "#ef5a55", sky: ["#080914", "#2b1720"], weak: "guestkey", sign: "ROOM PLATFORM LOCKED" },
  { id: "desdemona", moon: "DESDEMONA", name: "PORTAL SPRAWL", theme: "CLOUD / CONTROL", boss: "CONSOLE HYDRA", weapon: "fleetsync", tag: "One cloud should operate every room and every workflow.", quip: "ANOTHER ROOM. ANOTHER CONSOLE.", accent: "#36d8ef", sky: ["#050c18", "#14304a"], weak: "byomswitch", sign: "SEPARATE ADMIN PORTAL" },
];

export const FINAL_MISSION: Mission = {
  id: "final", moon: "URANUS CORE", name: "POLARIS NEXUS", theme: "CONVERGED LEGACY SYSTEMS",
  boss: "PROTOCOL PRIME", weapon: "pulse",
  tag: "Eight closed systems become one last obstacle.",
  quip: "EIGHT CLOSED SYSTEMS. ONE LAST FAILURE.",
  accent: "#f7f3ff", sky: ["#070413", "#2b1745"], weak: "pulse", sign: "UNIFY EVERY CAPABILITY",
};

export const MOON_IDS: readonly MoonId[] = [
  "ariel", "umbriel", "titania", "oberon", "miranda", "puckmoon", "cressida", "desdemona",
];

/** The four moons shipped with bespoke boss-arena backdrops. The later four
 *  reuse their level panel for the arena. */
export const ORIGINAL_MOONS: ReadonlySet<string> = new Set(["ariel", "umbriel", "titania", "oberon"]);

export interface MissionIntro { title: string; body: string; objective: string }

export const MISSION_INTROS: Readonly<Record<MissionId, MissionIntro>> = {
  ariel: { title: "THE PAIRING TOLL", body: "Dongle Baron has turned Ariel into a toll road for signals. Computer screen sharing and wireless sharing now require one of his approved dongles at every display. Guests wait, meetings stall, and working screens remain inaccessible until the pairing ritual is complete. Reopen the browser-based signal path and return the workspace to the people in the room.", objective: "REOPEN FIVE WORKSPACES · EXPOSE DONGLE BARON" },
  umbriel: { title: "THE FROZEN WINDOW", body: "Screen Warden froze Umbriel into a world of single-source displays. Every room is locked to one approved voice, while everyone else is left outside the frame. Break the ice around each workspace and return the display to the whole room.", objective: "THAW FIVE WORKSPACES · DEFEAT SCREEN WARDEN" },
  titania: { title: "THE NETWORK DIVIDE", body: "Silo Sentinel split Titania along network boundaries. Guests, employees, and rooms can see one another—but their signals are forbidden to cross. Reconnect the routes, collapse the artificial walls, and prove that collaboration should travel farther than a VLAN.", objective: "BRIDGE FIVE WORKSPACES · DISABLE SILO SENTINEL" },
  oberon: { title: "THE FORCED REFRESH", body: "Refresh Titan fires up Oberon's foundry whenever a support clock expires. Perfectly capable rooms are melted down and replaced because the calendar says so. Cool the replacement line, preserve each workspace, and end the cycle of planned disruption.", objective: "COOL FIVE WORKSPACES · SHUT DOWN REFRESH TITAN" },
  miranda: { title: "THE CABLE MAZE", body: "HDMI Hydra wrapped Miranda in a maze of fixed inputs, adapters, and physical routes. Users can see the display, but reaching it means tracing the correct cable through the walls. Cut open a wireless path and free every room from the labyrinth.", objective: "OPEN FIVE WORKSPACES · SEVER HDMI HYDRA" },
  puckmoon: { title: "THE INSTALL TRAP", body: "Install Sentinel placed a software gate in front of every display on Puck. Guests must download an app, request permission, and survive an authorization ritual before they can contribute. Break the install gates and restore immediate access to the room.", objective: "BYPASS FIVE INSTALL GATES · DEFEAT INSTALL SENTINEL" },
  cressida: { title: "THE ONE-WAY ROOM", body: "Codec Colossus bound Cressida to one room appliance and one approved meeting workflow. The room decides how people must meet instead of adapting to the platform they bring. Switch the paths, restore BYOM choice, and bring down the keep.", objective: "FREE FIVE WORKSPACES · TOPPLE CODEC COLOSSUS" },
  desdemona: { title: "THE PORTAL SPRAWL", body: "Console Hydra gave every room on Desdemona its own dashboard, login, and operating ritual. Administrators spend their days moving between portals while the estate drifts apart. Converge the controls and return the fleet to one operational view.", objective: "SYNC FIVE WORKSPACES · DEFEAT CONSOLE HYDRA" },
  final: { title: "THE LAST CLOSED SYSTEM", body: "Protocol Prime has collected every closed workflow Polaris-Man defeated and fused them into one final barrier. It intends to divide the workspace again—by hardware, network, platform, and portal. Enter the Polaris Nexus and use every earned capability to keep the room open.", objective: "UNIFY THE SIGNAL · DEFEAT PROTOCOL PRIME" },
};

export interface Weapon { name: string; short: string; color: string; cost: number; desc: string }

export const WEAPONS: Readonly<Record<WeaponId, Weapon>> = {
  pulse: { name: "POLARIS PULSE", short: "PULSE", color: "#f7f3ff", cost: 0, desc: "Balanced native signal" },
  browser: { name: "BROWSER BURST", short: "BROWSER", color: "#7ce3a8", cost: 1, desc: "Three app-free signal packets" },
  canvas: { name: "CANVAS DIVIDE", short: "CANVAS", color: "#b9a8ff", cost: 1, desc: "Twin cryo lanes fracture locked screens" },
  crossnet: { name: "CROSS-NET ARC", short: "CROSS-NET", color: "#61c8dc", cost: 1, desc: "Piercing guided lightning route" },
  evergreen: { name: "EVERGREEN WAVE", short: "EVERGREEN", color: "#e07856", cost: 2, desc: "Shielded thermal platform wave" },
  airlink: { name: "AIRLINK BLADE", short: "AIRLINK", color: "#ef6abf", cost: 1, desc: "Cuts through fixed cable routes" },
  guestkey: { name: "GUEST KEY", short: "GUEST KEY", color: "#a9f542", cost: 1, desc: "Zero-install authorization burst" },
  byomswitch: { name: "BYOM SWITCH", short: "BYOM", color: "#ef5a55", cost: 1, desc: "Redirects the room to any meeting platform" },
  fleetsync: { name: "FLEET SYNC", short: "FLEET SYNC", color: "#36d8ef", cost: 2, desc: "Guided command nodes converge on one target" },
};

/** Protocol Prime raises one shield per capability you earned on the moons.
 *  Hitting a shield with its own weapon collapses it. */
export const FINAL_SHIELDS: readonly WeaponId[] = [
  "browser", "canvas", "crossnet", "evergreen", "airlink", "guestkey", "byomswitch", "fleetsync",
];

export type ShotKind =
  | "pair" | "packet" | "token" | "ice" | "freeze" | "icicle"
  | "spark" | "bolt" | "home" | "fire" | "lava" | "flame";

export interface EnemyDef {
  name: string;
  hp: number;
  speed: number;
  /** Draw height in logical pixels; the figure rect is scaled to this. */
  artH: number;
  shot: ShotKind;
  rate: number;
  fly?: boolean;
}

export const ENEMY_DEF: Readonly<Record<string, EnemyDef>> = {
  puck: { name: "PAIRING PUCK", hp: 3, speed: 20, artH: 25, shot: "pair", rate: 1.4 },
  mite: { name: "BROWSER MITE", hp: 3, speed: 0, artH: 21, shot: "packet", rate: 1.05, fly: true },
  token: { name: "TOKEN HOPPER", hp: 4, speed: 14, artH: 29, shot: "token", rate: 1.65 },
  frost: { name: "FROST PANE", hp: 4, speed: 16, artH: 27, shot: "ice", rate: 1.35 },
  glacier: { name: "GLACIER LOCK", hp: 5, speed: 10, artH: 30, shot: "freeze", rate: 1.9 },
  cryo: { name: "CRYO WISP", hp: 3, speed: 0, artH: 24, shot: "icicle", rate: 1.3, fly: true },
  wasp: { name: "RELAY WASP", hp: 3, speed: 0, artH: 22, shot: "spark", rate: 0.92, fly: true },
  strider: { name: "VLAN STRIDER", hp: 4, speed: 24, artH: 27, shot: "bolt", rate: 1.45 },
  orb: { name: "SILO ORB", hp: 5, speed: 0, artH: 27, shot: "home", rate: 1.7, fly: true },
  gear: { name: "EMBER GEAR", hp: 3, speed: 28, artH: 24, shot: "fire", rate: 1.05 },
  crawler: { name: "FURNACE CRAWLER", hp: 5, speed: 12, artH: 27, shot: "lava", rate: 1.65 },
  bat: { name: "HEAT-SINK BAT", hp: 3, speed: 0, artH: 23, shot: "flame", rate: 1.2, fly: true },
  cablerat: { name: "CABLE RAT", hp: 3, speed: 26, artH: 25, shot: "spark", rate: 1.15 },
  switchspider: { name: "SWITCH SPIDER", hp: 3, speed: 0, artH: 24, shot: "bolt", rate: 1.1, fly: true },
  portgolem: { name: "PORT GOLEM", hp: 5, speed: 12, artH: 30, shot: "packet", rate: 1.55 },
  downloadslug: { name: "DOWNLOAD SLUG", hp: 4, speed: 14, artH: 24, shot: "packet", rate: 1.25 },
  installerpixie: { name: "INSTALLER PIXIE", hp: 3, speed: 0, artH: 23, shot: "home", rate: 1.25, fly: true },
  authroller: { name: "AUTH ROLLER", hp: 5, speed: 19, artH: 28, shot: "token", rate: 1.6 },
  codecdrone: { name: "CODEC DRONE", hp: 3, speed: 0, artH: 22, shot: "home", rate: 1.2, fly: true },
  lensknight: { name: "LENS KNIGHT", hp: 4, speed: 22, artH: 29, shot: "bolt", rate: 1.35 },
  appliancehound: { name: "APPLIANCE HOUND", hp: 5, speed: 18, artH: 27, shot: "pair", rate: 1.5 },
  consoleimp: { name: "CONSOLE IMP", hp: 3, speed: 23, artH: 25, shot: "pair", rate: 1.15 },
  portaldrone: { name: "PORTAL MITE", hp: 3, speed: 0, artH: 23, shot: "packet", rate: 1.05, fly: true },
  cloudnode: { name: "CLOUD NODE", hp: 5, speed: 14, artH: 29, shot: "home", rate: 1.55 },
};

/** Three enemy types per moon; the figure sheet holds them at indices 0-2 and
 *  the boss at index 3. */
export const ROSTERS: Readonly<Record<MoonId, readonly [string, string, string]>> = {
  ariel: ["puck", "mite", "token"],
  umbriel: ["frost", "glacier", "cryo"],
  titania: ["wasp", "strider", "orb"],
  oberon: ["gear", "crawler", "bat"],
  miranda: ["cablerat", "switchspider", "portgolem"],
  puckmoon: ["downloadslug", "installerpixie", "authroller"],
  cressida: ["codecdrone", "lensknight", "appliancehound"],
  desdemona: ["consoleimp", "portaldrone", "cloudnode"],
};

/* --- locked-artwork sub-rects: [x0, y0, x1, y1] in source pixels --- */

/** Level_<Moon>_Figures_v1.png — three enemies then the boss. */
export const FIGURE_RECTS: Readonly<Record<MoonId, readonly (readonly [number, number, number, number])[]>> = {
  ariel: [[71, 433, 398, 724], [436, 368, 747, 589], [850, 302, 1181, 724], [1229, 120, 1859, 723]],
  umbriel: [[50, 388, 469, 710], [514, 353, 925, 706], [925, 292, 1193, 658], [1229, 80, 1850, 706]],
  titania: [[38, 380, 350, 675], [390, 388, 839, 744], [866, 304, 1162, 728], [1190, 75, 1843, 744]],
  oberon: [[54, 495, 320, 736], [357, 436, 770, 736], [770, 280, 1175, 610], [1175, 41, 1771, 736]],
  miranda: [[16, 420, 320, 784], [330, 300, 710, 784], [722, 260, 1190, 795], [1160, 15, 1873, 795]],
  puckmoon: [[30, 570, 370, 843], [340, 400, 700, 843], [680, 390, 1080, 843], [1020, 27, 1760, 843]],
  cressida: [[0, 540, 250, 804], [260, 150, 670, 855], [660, 440, 1160, 868], [1100, 0, 1774, 868]],
  desdemona: [[22, 520, 320, 868], [290, 360, 650, 820], [640, 330, 1100, 868], [1040, 15, 1774, 859]],
};

/** Protocol_Prime_Boss_v1.png — idle, attack, windup, flash. */
export const FINAL_BOSS_FRAMES: readonly (readonly [number, number, number, number])[] = [
  [27, 231, 376, 765], [393, 282, 768, 765], [768, 251, 1146, 765], [1178, 266, 1521, 765],
];

/** Workspace_Checkpoint_v1.png — unsecured, secured. */
export const CHECKPOINT_FRAMES: readonly (readonly [number, number, number, number])[] = [
  [223, 71, 661, 938], [776, 70, 1421, 938],
];

/** Polaris_Operator_Sprites_v1.png — idle A, idle B, firing. */
export const BASE_FRAMES: readonly (readonly [number, number, number, number])[] = [
  [46, 300, 239, 549], [307, 304, 513, 549], [1792, 314, 2080, 549],
];

/** Polaris_Operator_Air_v1.png — rising, falling, dash, wall. */
export const AIR_FRAMES: readonly (readonly [number, number, number, number])[] = [
  [207, 182, 445, 478], [704, 210, 944, 517], [1124, 291, 1531, 443], [1788, 182, 2029, 556],
];

/** Horizontal anchor per air frame, as a fraction of drawn width. */
export const AIR_ANCHOR: readonly number[] = [0.45, 0.45, 0.66, 0.5];

/** How much of the operator's idle frame is head and shoulders, top-down.
 *  Used to crop a bust for the mission-select core tile without touching the
 *  artwork — 0.42 lands just below the chest on `BASE_FRAMES[0]`. */
export const OPERATOR_BUST_FRACTION = 0.42;

/** Polaris_Operator_Run_v1.png — eight-frame run cycle. */
export const RUN_FRAMES: readonly (readonly [number, number, number, number])[] = [
  [34, 282, 290, 548], [356, 289, 560, 548], [573, 276, 831, 524], [862, 237, 1102, 491],
  [1157, 284, 1359, 548], [1411, 273, 1623, 548], [1659, 298, 1881, 548], [1913, 297, 2143, 548],
];

/** Per-moon surface palette for the procedural platform art. */
export const SURFACE_STYLE: Readonly<Record<MissionId, { deck: string; deep: string; trim: string; glow: string; metal: string }>> = {
  ariel: { deck: "#24364b", deep: "#101a2a", trim: "#e07856", glow: "#7ce3a8", metal: "#8aa0b4" },
  umbriel: { deck: "#34566f", deep: "#142b40", trim: "#dff6ff", glow: "#91c9ff", metal: "#8eaac1" },
  titania: { deck: "#17444d", deep: "#0a242d", trim: "#61c8dc", glow: "#8cf7ff", metal: "#527e89" },
  oberon: { deck: "#563022", deep: "#26130f", trim: "#ff9a43", glow: "#ff5d3d", metal: "#97604b" },
  miranda: { deck: "#3a2348", deep: "#190d22", trim: "#ef6abf", glow: "#ff9ade", metal: "#82637d" },
  puckmoon: { deck: "#30264d", deep: "#161027", trim: "#a9f542", glow: "#c9ff6d", metal: "#6b6388" },
  cressida: { deck: "#3f2930", deep: "#1b1015", trim: "#ef5a55", glow: "#ffc15f", metal: "#81616a" },
  desdemona: { deck: "#183849", deep: "#091c29", trim: "#36d8ef", glow: "#7cf4ff", metal: "#557d8d" },
  final: { deck: "#342755", deep: "#150f29", trim: "#b9a8ff", glow: "#7ce3a8", metal: "#777098" },
};

export const PROJECTILE_COLOR: Readonly<Record<string, string>> = {
  pair: "#7ce3a8", packet: "#7ce3a8", token: "#e8c76a",
  ice: "#9fdcff", freeze: "#dff6ff", icicle: "#8dbfff",
  spark: "#61c8dc", bolt: "#8cf7ff", home: "#61c8dc",
  fire: "#ff9a43", flame: "#ffb24e", lava: "#ff593d",
};

/** Colour used when a hostile shot is spawned (distinct from the draw colour
 *  above for the ice/fire families — this matches v1.7's `colors` map). */
export const SPAWN_COLOR: Readonly<Record<string, string>> = {
  pair: PALETTE.green, packet: PALETTE.green, token: PALETTE.gold,
  ice: "#b9d8ff", freeze: PALETTE.lav, icicle: "#dff6ff",
  spark: PALETTE.cyan, bolt: "#8fe8ff", home: PALETTE.cyan,
  fire: "#ff9a43", lava: "#ff673d", flame: "#ffb24e",
};

export const SHOT_SIZE: Readonly<Record<string, number>> = {
  token: 8, freeze: 8, icicle: 4, home: 6, lava: 8, flame: 7,
};

export interface BossProfile {
  speed: number; accel: number; jump: number; run: number; seq: readonly string[];
}

export const BOSS_PROFILES: Readonly<Record<MissionId, BossProfile>> = {
  ariel: { speed: 72, accel: 300, jump: 164, run: 0.72, seq: ["run", "jump", "attack", "run", "attack", "jump"] },
  umbriel: { speed: 43, accel: 195, jump: 128, run: 1.05, seq: ["run", "jump", "attack", "run", "attack"] },
  titania: { speed: 82, accel: 330, jump: 172, run: 0.62, seq: ["jump", "run", "attack", "jump", "attack", "run"] },
  oberon: { speed: 50, accel: 185, jump: 148, run: 0.92, seq: ["run", "jump", "attack", "run", "attack"] },
  miranda: { speed: 58, accel: 230, jump: 148, run: 0.82, seq: ["run", "attack", "jump", "run", "attack", "jump"] },
  puckmoon: { speed: 76, accel: 310, jump: 166, run: 0.65, seq: ["jump", "attack", "run", "jump", "attack"] },
  cressida: { speed: 46, accel: 190, jump: 138, run: 0.96, seq: ["run", "attack", "run", "jump", "attack"] },
  desdemona: { speed: 68, accel: 270, jump: 158, run: 0.75, seq: ["attack", "run", "jump", "attack", "run"] },
  final: { speed: 38, accel: 165, jump: 132, run: 0.9, seq: ["run", "attack", "jump", "run", "attack", "jump", "attack"] },
};

/** Bosses that fight from the floor rather than hovering. */
export const GROUNDED_BOSSES: ReadonlySet<string> = new Set([
  "ariel", "oberon", "miranda", "puckmoon", "cressida", "desdemona",
]);

/** Which sector mechanic each moon runs. */
export const MECHANIC_KIND: Readonly<Record<MoonId, "packet" | "thaw" | "rail" | "coolant">> = {
  ariel: "packet", umbriel: "thaw", titania: "rail", oberon: "coolant",
  miranda: "rail", puckmoon: "packet", cressida: "thaw", desdemona: "packet",
};

/** Weapon whose fire sound stands in for one that has none of its own. */
export const SHOT_SOUND_ALIAS: Readonly<Record<string, string>> = {
  airlink: "crossnet", guestkey: "browser", byomswitch: "canvas", fleetsync: "crossnet",
};

/** Boss fire sound per mission. */
export const BOSS_SHOT_SOUND: Readonly<Record<MissionId, string>> = {
  final: "pulse", ariel: "browser", umbriel: "canvas", titania: "crossnet",
  oberon: "evergreen", miranda: "crossnet", puckmoon: "browser",
  cressida: "canvas", desdemona: "crossnet",
};

/** Per-sector background tint, indexed by sector. */
export const SECTOR_TINTS: readonly string[] = [
  "rgba(5,4,12,.10)", "rgba(109,91,184,.10)", "rgba(5,4,12,.18)",
  "rgba(97,200,220,.07)", "rgba(224,120,86,.08)",
];

/** Ariel's five checkpoint messages, in order. */
export const ARIEL_RELAY_MESSAGES: readonly string[] = [
  "WORKSPACE 1/5 OPEN · PAIRING GATE BYPASSED",
  "WORKSPACE 2/5 OPEN · HARDWARE TOKEN BYPASSED",
  "WORKSPACE 3/5 OPEN · BARON: ‘WHO AUTHORIZED THIS?’",
  "WORKSPACE 4/5 OPEN · APPROVED PATH OVERRIDDEN",
  "PAIRING NETWORK OFFLINE · DONGLE BARON EXPOSED",
];

/** Platform deck heights per moon, five sectors of six platforms. */
export const PLATFORM_YS: Readonly<Record<MoonId, readonly (readonly number[])[]>> = {
  ariel: [[132, 112, 91, 111, 132, 108], [126, 103, 84, 106, 130, 108], [132, 110, 88, 108, 128, 105], [124, 101, 82, 104, 130, 107], [131, 109, 89, 110, 132, 108]],
  umbriel: [[132, 110, 88, 108, 130, 106], [128, 105, 83, 103, 127, 105], [132, 111, 90, 112, 132, 108], [126, 104, 82, 104, 129, 106], [131, 108, 86, 107, 130, 106]],
  titania: [[132, 111, 89, 109, 131, 107], [127, 104, 84, 105, 128, 105], [131, 109, 87, 108, 130, 106], [125, 102, 82, 103, 127, 105], [132, 110, 88, 109, 131, 107]],
  oberon: [[132, 110, 88, 109, 131, 106], [128, 106, 85, 105, 129, 107], [132, 111, 90, 110, 132, 108], [126, 104, 83, 104, 128, 106], [130, 108, 86, 107, 130, 107]],
  miranda: [[132, 106, 82, 104, 128, 106], [126, 98, 78, 101, 126, 104], [132, 110, 86, 107, 130, 105], [124, 100, 80, 103, 128, 105], [131, 106, 84, 106, 130, 107]],
  puckmoon: [[130, 108, 86, 106, 129, 105], [125, 102, 80, 101, 126, 103], [132, 109, 84, 108, 131, 106], [126, 101, 79, 104, 128, 105], [130, 107, 83, 105, 129, 104]],
  cressida: [[132, 112, 92, 111, 132, 108], [129, 106, 86, 105, 130, 107], [132, 110, 89, 109, 131, 107], [127, 104, 84, 103, 129, 105], [131, 109, 88, 108, 130, 106]],
  desdemona: [[130, 104, 81, 103, 127, 105], [124, 98, 77, 100, 125, 103], [132, 108, 84, 106, 130, 105], [125, 99, 78, 102, 127, 104], [130, 105, 82, 104, 129, 106]],
};

export const PLATFORM_OFFSETS: readonly number[] = [82, 198, 315, 432, 548, 656];
export const PLATFORM_WIDTHS: readonly number[] = [82, 86, 92, 88, 94, 58];

/** Enemy spawn offsets within each sector. */
export const ENEMY_FORMATIONS: readonly (readonly number[])[] = [
  [120, 238, 355, 590], [128, 330, 475, 610], [118, 250, 450, 605],
  [130, 345, 470, 620], [115, 235, 445, 595],
];

/** Polaris Nexus arena platforms. */
export const FINAL_PLATFORMS: readonly { x: number; y: number; w: number; h: number }[] = [
  { x: 195, y: 132, w: 72, h: 8 }, { x: 285, y: 111, w: 80, h: 8 },
  { x: 390, y: 89, w: 84, h: 8 }, { x: 515, y: 112, w: 88, h: 8 },
  { x: 650, y: 132, w: 78, h: 8 }, { x: 760, y: 106, w: 88, h: 8 },
  { x: 900, y: 126, w: 82, h: 8 },
];
