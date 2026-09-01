/* ============================================================================
   EGG_TRACKS — generated music for the easter-egg games, and its provenance.
   ============================================================================

   WHAT THIS FILE IS

   One entry per music track: where the audio lives, and the exact prompt, model
   and seed that produced it. Two consumers read it:

     scripts/gen-egg-music.mjs   the work list. An entry with no `generated`
                                 date has not been made yet.
     src/scripts/eggs/runtime.ts the loader registry. An entry WITH a
                                 `generated` date has a committed file to fetch.

   That one field does both jobs, which is why a prompt can be committed and
   reviewed before any audio exists: the loader simply does not fetch a track
   that has not been generated, and the game falls back to the chiptune
   sequencer in EGG_MUSIC (src/scripts/eggs/data.ts) exactly as it does today.

   WHY THE PROVENANCE IS COMMITTED

   Partly because it is the only way to reproduce a track. Mostly because this
   is generated content on a company marketing site, and the prompt is the
   evidence of what was asked for. It is the record legal will want.

   THE PROMPT RULE — read this before adding an entry

   A prompt describes GENRE, MOOD, INSTRUMENTATION and TEXTURE. It must never
   name a game, a franchise, a composer, a studio or a specific track.

   This is not stylistic advice. The entire reason for generating music rather
   than editing an existing soundtrack is to end up with something original;
   asking a model to imitate a named work asks it for a derivative and throws
   that away. Stability's own prompt guidance says the same thing for its own
   reasons: describe sonic qualities, not instructions.

   Genre is not protectable. "Chiptune", "8-bit", "square lead over a triangle
   bass" describe an idiom that anyone may write in. A named title does not.
   ============================================================================ */

export interface EggTrack {
  /** Rooted path under `public/`. Fetched through withBase() at runtime. */
  file: string;
  /** The exact prompt sent to the model. See "THE PROMPT RULE" above. */
  prompt: string;
  /** Requested loop length in seconds. Kept short: see the size budget below. */
  seconds: number;
  /** Model identifier, recorded so a regeneration is comparable. */
  model: string;
  /** Per-track gain. Omitted means DEFAULT_TRACK_GAIN in the runtime.
   *
   *  Why any gain at all: the master bus is capped at 0.25 and a chiptune
   *  pattern sums its three channels to roughly 0.155 before that cap. A
   *  normalised audio file peaks at 1.0, so played flat it arrives about six
   *  times louder than the music it replaces. The default sits it alongside
   *  the sequencer rather than on top of it. */
  gain?: number;
  /** Seed, once generated — the other half of reproducibility. */
  seed?: number;
  /** ISO date. ABSENT MEANS NOT YET GENERATED: the runtime will not fetch it
   *  and the game keeps using its chiptune fallback. The generation script
   *  uses the same absence as its work list. */
  generated?: string;
}

/** Where generated audio is committed. `public/eggs/` already carries binary
 *  media (the logo film), so this follows an established location. */
export const TRACK_DIR = "/eggs/audio";

/** Size budget, enforced by review rather than by code: 400 KB per track.
 *  `dist/` is ~42 MB, so six tracks at budget is about 6% growth. A track over
 *  budget gets a shorter loop, not a lower bitrate — the material is sparse and
 *  artefacts are audible on it. */
export const TRACK_BUDGET_BYTES = 400 * 1024;

/* Keys are the egg routes already used throughout runtime.ts and solar3d.ts
   (`venus`, `catch`, `stack`, `saturn`, `pluto`, `invade`), so a track name and
   a game name cannot drift apart. The four existing chiptune patterns keep
   their own semantic names in EGG_MUSIC and are untouched by this file. */
export const EGG_TRACKS: Record<string, EggTrack> = {
  /* Venus · broadcast campus — a side-scrolling platformer under a sunlit,
     toxic sky. Bright and propulsive, because the game is about momentum. */
  venus: {
    file: `${TRACK_DIR}/venus.mp3`,
    prompt:
      "Upbeat 8-bit chiptune loop, bright square-wave lead melody over a walking triangle-wave bass, crisp noise-channel percussion, major key, 140 BPM, energetic and optimistic, retro home-console sound chip, clean and sparse, seamless loop, no vocals",
    seconds: 48,
    model: "stable-audio-2.5",
  },

  /* Mars · canyon relay — run-and-gun through an alien freighter. Driving and
     martial, rust-red rather than heroic. */
  catch: {
    file: `${TRACK_DIR}/catch.mp3`,
    prompt:
      "Driving 8-bit chiptune action loop, minor key, insistent square-wave arpeggio, heavy triangle-wave bass on the downbeat, marching noise-channel snare, 150 BPM, tense and militaristic, retro sound chip, seamless loop, no vocals",
    seconds: 48,
    model: "stable-audio-2.5",
  },

  /* Jupiter · workspace assembly — a falling-block puzzle. Hypnotic and
     methodical: it has to stay listenable for a long session. */
  stack: {
    file: `${TRACK_DIR}/stack.mp3`,
    prompt:
      "Hypnotic 8-bit chiptune puzzle loop, steady mid-tempo groove at 120 BPM, repeating square-wave motif, warm triangle-wave bassline, minimal percussion, dorian mode, calm and methodical, suitable for long listening without fatigue, retro sound chip, seamless loop, no vocals",
    seconds: 48,
    model: "stable-audio-2.5",
  },

  /* Saturn · the dongle belt — gliding through the rings. Elegant, icy, wide. */
  saturn: {
    file: `${TRACK_DIR}/saturn.mp3`,
    prompt:
      "Gliding 8-bit chiptune loop, spacious and icy, slow arpeggiated square-wave figures, sustained triangle-wave pad underneath, sparse gentle percussion, 108 BPM, elegant and weightless, lydian colour, retro sound chip with long decays, seamless loop, no vocals",
    seconds: 48,
    model: "stable-audio-2.5",
  },

  /* Pluto · deep-network maintenance — a maze chase at the cold edge.
     Skittering and slightly comic, the way a chase should be. */
  pluto: {
    file: `${TRACK_DIR}/pluto.mp3`,
    prompt:
      "Quirky 8-bit chiptune maze-chase loop, skittering staccato square-wave melody, bouncing triangle-wave bass, short bright blips, 132 BPM, playful and a little eerie, chromatic runs, cold and sparse, retro sound chip, seamless loop, no vocals",
    seconds: 48,
    model: "stable-audio-2.5",
  },

  /* The intruder · network diagnostics — a fixed-shooter that escalates wave
     by wave. Tense and mechanical, with an alarm underneath it. */
  invade: {
    file: `${TRACK_DIR}/invade.mp3`,
    prompt:
      "Tense 8-bit chiptune loop for a fixed-screen space shooter, descending four-note bass ostinato, sharp square-wave stabs, mechanical noise-channel pulse, minor key, 126 BPM, escalating dread, retro sound chip, seamless loop, no vocals",
    seconds: 48,
    model: "stable-audio-2.5",
  },
};

/** The pilot: generate and review these two before committing to the rest.
 *  Musical direction is subjective and cheaper to correct on two tracks than
 *  on six. `pnpm music:gen --pilot` limits generation to these. */
export const PILOT_TRACKS = ["stack", "invade"] as const;
