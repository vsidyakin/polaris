/* Mars: Signal Siege — campaign data.
 *
 * Twelve missions, eleven sector bosses and the Lock-In Engine. Sector names,
 * boss names, threats, accents, weapon grants and weaknesses are carried over
 * from Mars_Signal_Siege_v0.7.html unchanged; the briefing prose is expanded
 * from the one-line stories the standalone had, because the brief asks a
 * briefing to say who the boss is, what it did, and what beats it.
 *
 * On the satire: every antagonist is a *product-class behaviour* — a dongle, a
 * required installer, a format gate, a management island. No competitor is
 * named, and none of these map to one company. That constraint is the point:
 * the things Rook fights are the things integrators actually fight.
 */

export type MissionEffect =
  | "none" | "conduit" | "lowgrav" | "ice" | "rooftop"
  | "tunnel" | "conveyor" | "wind" | "stack" | "gauntlet"
  | "descent" | "final";

/** Which environment family a mission draws. Six families across twelve
 *  missions; a family repeats but never with the same layout or enemy mix. */
export type Environment =
  | "dustline" | "uplink" | "icevault" | "hivecity" | "catacombs" | "foundry";

export interface Mission {
  sector: string;
  boss: string;
  geometry: string;
  capability: string;
  threat: string;
  accent: string;
  /** Hue rotation applied to enemy sprites so each sector reads differently. */
  hue: number;
  /** Weapon index this boss is weak to. */
  weak: number;
  /** Weapon index granted on clear. */
  grant: number;
  effect: MissionEffect;
  environment: Environment;
  /**
   * What the boss says on the clear card, beaten but unbowed.
   *
   * The joke is always the product CLASS, never a company: a proprietary
   * button, a format gate, a required installer, a walled garden. `test:mars`
   * fails the build if a brand name appears in mission text, and that rule
   * covers this field too.
   */
  taunt: string;
  /** Music cue key. See audio.ts. */
  music: MusicKey;
  story: string;
  objective: string;
  /** Expanded briefing: what the boss is, and what actually beats it. */
  briefing: string;
}

export type MusicKey =
  | "title" | "introduction" | "assault" | "bases" | "toxic" | "ice"
  | "energy" | "lair" | "boss" | "clear" | "coreDown" | "credits" | "gameover"
  /** Enhanced derivative of `lair`, used only by the Lock-In Engine. */
  | "lairFinal"
  /* Both of these are assembled rather than remastered: a FamiStudio chip part
     over a Stable Audio ambient bed. See LAYERED in build-mars-audio.py. */
  /** The defeated boss's card at the end of every mission. */
  | "taunt"
  /** The ending crawl, once the campaign is over. */
  | "epilogue";

export const MISSIONS: readonly Mission[] = [
  {
    sector: "DUSTLINE RELAY", boss: "BUTTON BRIGADIER", geometry: "TERRACE RELAY",
    capability: "STREAM DRIVER", threat: "PROPRIETARY BUTTON", accent: "#7ce3a8",
    hue: 0, weak: 7, grant: 1, effect: "none", environment: "dustline", music: "assault",
    story: "The Button Brigadier sealed Dustline Relay behind a proprietary connection ritual. Every visitor needs the approved token, every room waits for the right button, and field teams take the blame when the handshake fails.",
    objective: "Restore browser-first access and reopen the signal drop network.",
    taunt: "Take the tower. There are eleven more buttons in that drawer, and not one of them fits the next room.",
    briefing: "A relay tower re-armed to accept exactly one piece of hardware. Anyone without the token stands at the front of the room and apologises. The Brigadier throws its button volleys in a flat arc — the returning BARRIER DISK cuts them out of the air on the way back.",
  },
  {
    sector: "SILO ACCESS", boss: "CODEC WARDEN", geometry: "SECURITY CONDUIT",
    capability: "TRI-BAND SPREAD", threat: "FORMAT GATE", accent: "#61c8dc",
    hue: 34, weak: 1, grant: 2, effect: "conduit", environment: "dustline", music: "bases",
    story: "The Codec Warden converts every source into one prescribed format before it may enter the silo. Guest content stalls at translation gates while rooms wait for another adapter.",
    objective: "Break the conduit gates and restore format-independent sharing.",
    taunt: "Open the silo. Everything you carry out of it still arrives as an unsupported format, and they will still blame the room.",
    briefing: "Nothing enters the silo as itself. The Warden transcodes it first, and charges the room the delay. It armours between volleys, so sustained pressure beats burst damage — hold the STREAM DRIVER on it and do not let the plating settle.",
  },
  {
    sector: "VALLES UPLINK", boss: "VLAN TYRANT", geometry: "UPLINK ASCENT",
    capability: "GUIDED NODE", threat: "NETWORK PARTITION", accent: "#b9a8ff",
    hue: 68, weak: 3, grant: 6, effect: "lowgrav", environment: "uplink", music: "toxic",
    story: "The VLAN Tyrant hid the uplink behind isolated discovery zones. Devices can see the room or reach the service, but rarely both, leaving integrators to bridge the gap by hand.",
    objective: "Climb the uplink and restore cross-network discovery.",
    taunt: "Cross the uplink then. I have already put your guests on a different network from the screen they are standing in front of.",
    briefing: "A vertical climb up a coolant cascade, against the one boss that never stands still. The Tyrant partitions the arena and leaps between halves; the WAVE PACKET bends around its cover instead of stopping at it.",
  },
  {
    sector: "BOREALIS ICE VAULT", boss: "REFRESH ENFORCER", geometry: "SPLIT ICE ROUTES",
    capability: "CRYO HANDSHAKE", threat: "SESSION EXPIRY", accent: "#b9edff",
    hue: 118, weak: 5, grant: 4, effect: "ice", environment: "icevault", music: "ice",
    story: "The Refresh Enforcer freezes working sessions whenever versions drift. Users repeat pairings, administrators repeat updates, and every meeting begins by asking what changed overnight.",
    objective: "Cross the coolant vault and restore durable session trust.",
    taunt: "You thawed the vault. Enjoy it. There is a mandatory update queued, and it lands ten minutes before the quarterly.",
    briefing: "The floor gives no grip and the Enforcer expires your footing as readily as your session. It re-freezes after every exchange — THERMAL ARC splashes through the frost shell before it can re-form.",
  },
  {
    sector: "INSTALLER QUARTER", boss: "INSTALLER OVERMIND", geometry: "ROOFTOP DISTRICT",
    capability: "WAVE PACKET", threat: "CLIENT INSTALL", accent: "#f0a45d",
    hue: 158, weak: 2, grant: 3, effect: "rooftop", environment: "hivecity", music: "assault",
    story: "The Installer Overmind requires a managed client before anyone can share. Guests lack rights, administrators inherit another package, and spontaneous collaboration becomes a support ticket.",
    objective: "Open the quarter and restore no-install browser access.",
    taunt: "Walk out. Every visitor behind you still needs an installer, an admin and a reboot before they can show one slide.",
    briefing: "Rooftops above a district that will not let a guest present without provisioning them first. The Overmind spawns package drones on three levels at once — the TRI-BAND SPREAD is the only thing that answers all three lanes together.",
  },
  {
    sector: "CABLE CATACOMBS", boss: "CABLE LEVIATHAN", geometry: "BRANCHING TUNNELS",
    capability: "THERMAL ARC", threat: "POINT-TO-POINT WIRING", accent: "#e07856",
    hue: 196, weak: 4, grant: 5, effect: "tunnel", environment: "catacombs", music: "bases",
    story: "The Cable Leviathan treats every new workflow as another permanent wire. The catacombs have grown into a maze of fixed paths that cannot follow the people using the rooms.",
    objective: "Cut through the conduit maze and restore flexible routing.",
    taunt: "You cut me loose. I grow back under the table, one adapter at a time, and nobody will know which end is which.",
    briefing: "Every fix down here was another cable, and the cables became the building. The Leviathan charges the length of its arena and cannot correct mid-rush — the CRYO HANDSHAKE stops it long enough to make the charge its mistake.",
  },
  {
    sector: "FIREWALL FOUNDRY", boss: "CONSOLE HYDRA", geometry: "CONVEYOR GANTRIES",
    capability: "BARRIER DISK", threat: "CONSOLE SPRAWL", accent: "#ff9b54",
    hue: 224, weak: 5, grant: 7, effect: "conveyor", environment: "foundry", music: "energy",
    story: "The Console Hydra adds a new management head for every room function. Policies conflict, credentials multiply, and operators lose the estate while staring at separate dashboards.",
    objective: "Cross the foundry and reunify control under one cloud.",
    taunt: "Close one console. Two more will want your credentials by morning, and neither will agree on what a room is.",
    briefing: "One estate, seven dashboards, no agreement between them. Cut a head and the Hydra grows the workload back somewhere else; THERMAL ARC splash damages the regrowth points together instead of one at a time.",
  },
  {
    sector: "PORTAL STORM", boss: "SUPPORT GUILLOTINE", geometry: "STORM RAIL RUN",
    capability: "GUIDED NODE", threat: "SERVICE GATE", accent: "#d59cff",
    hue: 258, weak: 6, grant: 6, effect: "wind", environment: "uplink", music: "toxic",
    story: "The Support Guillotine placed every fix behind a different portal, entitlement, and renewal date. The storm grows while users wait for ownership to be assigned.",
    objective: "Ride the storm rails and restore one support path.",
    taunt: "Escalate it, hero. Tier one will ask you to reboot the display. Tier two will ask you again.",
    briefing: "The wind takes your footing and the Guillotine takes your ticket. It drops behind cover between entitlement checks, so the shot has to find it — the GUIDED NODE tracks around the rails it hides behind.",
  },
  {
    sector: "SOVEREIGN STACK", boss: "SILO SOVEREIGN", geometry: "TOWER FLOORS",
    capability: "BARRIER DISK", threat: "MANAGEMENT ISLAND", accent: "#76d6ff",
    hue: 292, weak: 7, grant: 7, effect: "stack", environment: "hivecity", music: "bases",
    story: "The Silo Sovereign divided the Martian estate into isolated room kingdoms. Each stack reports its own truth, preventing administrators from seeing health, usage, and risk together.",
    objective: "Scale the stack and restore estate-wide visibility.",
    taunt: "The stack is yours. The data stays mine. Ask me for a usage report and I will send you a quarter-old export.",
    briefing: "Every floor of this tower reports a different truth about the same estate. The Sovereign lays ground-level tribute walls you cannot jump cleanly — the BARRIER DISK clears the lane on its return leg.",
  },
  {
    sector: "MONARCH CITADEL", boss: "CLOSED-ECOSYSTEM MONARCH", geometry: "MIXED GAUNTLET",
    capability: "SIGNAL PULSE", threat: "ECOSYSTEM LOCK", accent: "#ff7aa8",
    hue: 326, weak: 0, grant: 0, effect: "gauntlet", environment: "catacombs", music: "lair",
    story: "The Closed-Ecosystem Monarch permits collaboration only when every participant, room, and service belongs to the same court. Real workplaces do not arrive that neatly matched.",
    objective: "Breach the citadel and restore platform-neutral rooms.",
    taunt: "Enjoy the citadel. Half your people brought the wrong laptop, and my garden has exactly one gate.",
    briefing: "Collaboration by invitation, and the invitation list is the product. The Monarch shrugs off exotic ordnance and respects only the weapon you never lost — the plain SIGNAL PULSE you started the campaign with.",
  },
  {
    sector: "CREDENTIAL BASTION", boss: "TRUST GATEKEEPER", geometry: "ZERO-TRUST DESCENT",
    capability: "CRYO HANDSHAKE", threat: "IDENTITY FRICTION", accent: "#a8ffcb",
    hue: 92, weak: 4, grant: 4, effect: "descent", environment: "icevault", music: "ice",
    story: "The Trust Gatekeeper confuses security with repeated friction. Credentials are exposed to more prompts while trusted rooms remain unable to prove what they are.",
    objective: "Descend the bastion and restore hardware-rooted room identity.",
    taunt: "You are through. They will still see the warning, still click past it, and still call you when they do.",
    briefing: "It prompts constantly and verifies nothing that matters. Every challenge it throws re-arms faster than the last, so the answer is to stop the cycle: CRYO HANDSHAKE holds it through its own re-prompt.",
  },
  {
    sector: "LOCK-IN CORE", boss: "THE LOCK-IN ENGINE", geometry: "FINAL CORE",
    capability: "OPEN MARS", threat: "SYSTEMIC LOCK-IN", accent: "#ffffff",
    hue: 180, weak: 0, grant: 0, effect: "final", environment: "foundry", music: "lair",
    story: "The Lock-In Engine feeds on every closed workflow restored across Mars. Its final protocol will bind displays, users, networks, and services to one inflexible stack.",
    objective: "Use the reopened signal network to shut down lock-in at its source.",
    taunt: "You have not beaten me. You have made me a line item. I am the renewal, the migration quote and the cost of leaving, and the followers of the dongle will hold the door.",
    briefing: "Everything you have switched off across eleven sectors was this machine's outer surface. Below half strength it stops pacing itself and fires eight ways at once. None of the exotic ordnance you recovered touches it — the only thing it still answers to is the SIGNAL PULSE you started with, the one capability it never managed to take away.",
  },
] as const;

export const FINAL_MISSION = 11;
export const REGULAR_MISSIONS = 11;

export interface Weapon {
  name: string;
  role: string;
  /** Seconds between shots. */
  cool: number;
  speed: number;
  damage: number;
  /** Drawn size in logical pixels. */
  size: number;
  /** Maximum of this weapon's shots alive at once. */
  active: number;
  mode: "semi" | "auto";
  spread?: boolean;
  wave?: boolean;
  freeze?: number;
  gravity?: number;
  splash?: number;
  homing?: boolean;
  returning?: boolean;
  pierce?: number;
}

export const WEAPONS: readonly Weapon[] = [
  { name: "SIGNAL PULSE", role: "SEMI-AUTO / PRECISE", cool: 0.1, speed: 560, damage: 1.35, size: 17, active: 5, mode: "semi" },
  { name: "STREAM DRIVER", role: "FULL-AUTO / RAPID", cool: 0.085, speed: 510, damage: 0.48, size: 12, active: 7, mode: "auto" },
  { name: "TRI-BAND SPREAD", role: "LOW / MID / HIGH", cool: 0.42, speed: 430, damage: 0.68, size: 15, active: 9, mode: "semi", spread: true },
  { name: "WAVE PACKET", role: "SINE-WAVE / COVER", cool: 0.34, speed: 410, damage: 1.1, size: 18, active: 4, mode: "semi", wave: true },
  { name: "CRYO HANDSHAKE", role: "FREEZE / CONTROL", cool: 0.58, speed: 380, damage: 0.35, size: 19, active: 3, mode: "semi", freeze: 2.25 },
  { name: "THERMAL ARC", role: "LOB / SPLASH", cool: 0.68, speed: 330, damage: 3, size: 21, active: 2, mode: "semi", gravity: 560, splash: 68 },
  { name: "GUIDED NODE", role: "HOMING / MOBILE", cool: 0.58, speed: 300, damage: 1.45, size: 19, active: 3, mode: "semi", homing: true },
  { name: "BARRIER DISK", role: "RETURN / INTERCEPT", cool: 0.72, speed: 370, damage: 2, size: 25, active: 1, mode: "semi", pierce: 4, returning: true },
] as const;

/** Per-boss movement and cadence. Index matches MISSIONS. */
export interface BossProfile {
  speed: number;
  cool: number;
  /** Jump impulse, 0 for a boss that never leaves the floor. */
  jump: number;
  /**
   * Hitbox width, measured from the boss's own idle artwork.
   *
   * Every boss used to be a square of BOSS.H, which is a fair description of
   * none of them: the Leviathan and the Lock-In Engine draw 186 px across a
   * 126/150 px box, so a third of the visible body was not a target and shots
   * that plainly connected did nothing; the Silo Sovereign draws 84 px inside
   * a 126 px box, so shots that plainly missed still hit. Measured on the idle
   * pose rather than the widest one, because a boss's reach when its arms are
   * out is not its body.
   */
  width: number;
  /** Human-readable attack description, shown in the briefing panel. */
  tell: string;
}

export const BOSS_PROFILES: readonly BossProfile[] = [
  { speed: 38, cool: 1.45, jump: 0, width: 136, tell: "flat volleys, no jump" },
  { speed: 72, cool: 1.3, jump: 250, width: 110, tell: "hop-and-spray" },
  { speed: 46, cool: 1.35, jump: 385, width: 111, tell: "leaps every exchange" },
  { speed: 52, cool: 1.55, jump: 330, width: 132, tell: "slow arcing shots" },
  { speed: 31, cool: 1.2, jump: 260, width: 170, tell: "wide six-way fan" },
  { speed: 82, cool: 1.48, jump: 0, width: 186, tell: "lunges forward as it fires" },
  { speed: 43, cool: 1.38, jump: 280, width: 144, tell: "seven-way head volley" },
  { speed: 66, cool: 1.25, jump: 405, width: 128, tell: "jumps then fires down" },
  { speed: 27, cool: 1.62, jump: 315, width: 84, tell: "ground-level tribute walls" },
  { speed: 55, cool: 1.3, jump: 245, width: 94, tell: "five-way court volley" },
  { speed: 48, cool: 1.25, jump: 360, width: 108, tell: "re-prompts faster each cycle" },
  { speed: 64, cool: 0.98, jump: 390, width: 132, tell: "eight-way burst below half" },
] as const;

/** Which of the four inherited enemy groups a mission draws from, plus which
 *  authored type it introduces. Later families bring new silhouettes. */
export function enemyGroupFor(mission: number): number {
  if (mission === FINAL_MISSION) return 3;
  return mission <= 2 ? 0 : mission <= 4 ? 1 : mission <= 7 ? 2 : 3;
}

/** The authored types unlock as the campaign moves off the surface. */
export function authoredTypesFor(mission: number): readonly ("wasp" | "crawler" | "sentinel")[] {
  if (mission < 2) return [];
  if (mission < 5) return ["wasp"];
  if (mission < 8) return ["wasp", "crawler"];
  return ["wasp", "crawler", "sentinel"];
}

/** Ending crawl, scrolled bottom to top over the credits cue. */
export const ENDING_CRAWL: readonly string[] = [
  "MARS IS OPEN",
  "",
  "The Lock-In Engine is offline.",
  "",
  "Its outer surface is still out there, in pieces:",
  "a proprietary button nobody has to press,",
  "a format gate with nothing left to translate,",
  "an installer with no one left to provision,",
  "a management island rejoined to the mainland,",
  "and a closed ecosystem that finally let a guest in.",
  "",
  "Every district on this planet can be reached",
  "from whatever a visitor already carries.",
  "No token. No client. No court to belong to.",
  "",
  "SIGNAL MARSHAL ROOK",
  "reopened the network the integrators were promised,",
  "and then handed it back to them.",
  "",
  "The rooms work now.",
  "That was the whole job.",
  "",
  "",
  "MERSIVE POLARIS",
  "MARS: SIGNAL SIEGE",
];

/**
 * The functional cue map, as specified.
 *
 * Kept as a pure function of game state so the audio QA script can assert the
 * mapping without instantiating Phaser — see scripts/check-mars-audio.mjs.
 */
export function cueFor(state: {
  screen: "title" | "select" | "briefing" | "play" | "pause" | "clear" | "victory" | "gameover";
  mission: number;
  bossActive: boolean;
  victoryPhase?: "coreDown" | "credits";
  missionMusic: MusicKey;
}): MusicKey | null {
  switch (state.screen) {
    case "title":
      return "title";
    case "select":
    case "briefing":
      return "introduction";
    case "play":
    case "pause":
      if (!state.bossActive) return state.missionMusic;
      /* The final fight gets neither the shared boss theme nor, crucially, the
         cue it is already playing: mission 12's stage music IS `lair`, so
         returning `lair` here would be a no-op inside playMusic() and entering
         the last arena would change nothing at all. `lairFinal` is the same
         composition re-voiced — audibly a transition, and audibly the same
         place. */
      return state.mission === FINAL_MISSION ? "lairFinal" : "boss";
    case "clear":
      /* The clear screen is the boss's parting shot now, not a fanfare — it
         wants the taunt cue rather than the old area-clear sting. */
      return "taunt";
    case "victory":
      return state.victoryPhase === "credits" ? "epilogue" : "coreDown";
    case "gameover":
      return "gameover";
    default:
      return null;
  }
}
