/* Polaris-Man — the in-code chiptune sequencer, kept as the music fallback.
 *
 * This is v1.7's music engine, transcribed unchanged. It is no longer the
 * primary soundtrack — the FamiStudio-authored NES tracks are — but it stays
 * for one reason: if a music file 404s or the browser cannot decode OGG, the
 * game should still have music rather than silence. It costs a few hundred
 * bytes and it already obeys the NES channel layout, so it is a good floor.
 *
 * Channel layout, matching the hardware:
 *   l    — pulse 1, lead              (one note at a time)
 *   c    — pulse 2, countermelody     (one note at a time, on odd steps)
 *   bass — triangle, bass             (one note at a time, on even steps)
 *   arp  — a fast pulse-2 arpeggio used where a chord is implied
 *   d    — noise channel pattern; K kick, S snare, H hat, . rest
 */

export interface FallbackTrack {
  bpm: number;
  /** Pulse 1 lead, 32 steps. 0 = rest. */
  l: readonly number[];
  /** Pulse 2 countermelody, 16 steps. */
  c: readonly number[];
  /** Triangle bass, 16 steps. */
  bass: readonly number[];
  /** Arpeggio figure, 4 steps. */
  arp: readonly number[];
  /** Noise pattern, 32 characters. */
  d: string;
}

const title: FallbackTrack = {
  bpm: 148,
  l: [330, 0, 392, 494, 523, 494, 392, 330, 294, 0, 370, 440, 494, 587, 523, 440, 392, 0, 494, 587, 659, 587, 523, 494, 440, 392, 370, 440, 494, 392, 330, 0],
  c: [165, 247, 196, 247, 147, 220, 185, 220, 165, 262, 220, 262, 196, 294, 247, 294],
  bass: [82, 82, 98, 98, 73, 73, 110, 110, 82, 82, 123, 123, 98, 98, 82, 82],
  arp: [659, 784, 988, 784],
  d: "K.H.S.H.K.H.S.H.K.H.S.H.K.H.S.H.",
};

const select: FallbackTrack = {
  bpm: 126,
  l: [262, 330, 392, 0, 440, 392, 330, 294, 247, 294, 370, 440, 494, 440, 370, 330, 294, 370, 440, 0, 523, 494, 440, 370, 330, 392, 494, 440, 370, 330, 294, 0],
  c: [131, 196, 165, 196, 147, 220, 185, 220, 165, 247, 196, 247, 147, 220, 185, 220],
  bass: [65, 65, 73, 73, 82, 82, 73, 73, 65, 65, 82, 82, 73, 73, 65, 65],
  arp: [523, 659, 784, 659],
  d: "K...S.H.K.H.S...K...S.H.K.H.S.H.",
};

const ariel: FallbackTrack = {
  bpm: 156,
  l: [392, 523, 659, 0, 587, 523, 440, 523, 392, 523, 784, 698, 659, 587, 523, 440, 494, 587, 698, 0, 784, 698, 587, 523, 440, 523, 659, 587, 523, 440, 392, 0],
  c: [196, 262, 220, 262, 196, 294, 247, 294, 220, 330, 262, 330, 247, 349, 294, 349],
  bass: [98, 98, 110, 110, 82, 82, 98, 98, 110, 110, 123, 123, 98, 98, 82, 82],
  arp: [784, 988, 1047, 988],
  d: "K.H.S.H.K.H.S.H.K.H.S.H.KK..S.H.",
};

const umbriel: FallbackTrack = {
  bpm: 132,
  l: [294, 0, 349, 440, 415, 349, 294, 262, 233, 0, 294, 370, 392, 370, 330, 294, 262, 330, 392, 0, 440, 415, 349, 330, 294, 262, 247, 294, 330, 294, 262, 0],
  c: [147, 220, 175, 220, 131, 196, 165, 196, 117, 185, 147, 185, 131, 196, 165, 196],
  bass: [73, 73, 65, 65, 58, 58, 65, 65, 73, 73, 82, 82, 65, 65, 58, 58],
  arp: [587, 698, 880, 698],
  d: "K...S.H.K.H.S...K...S.H.K.H.S.H.",
};

const titania: FallbackTrack = {
  bpm: 162,
  l: [440, 554, 659, 0, 740, 659, 554, 494, 440, 554, 831, 740, 659, 554, 494, 440, 494, 659, 740, 0, 880, 831, 740, 659, 554, 659, 831, 740, 659, 554, 494, 0],
  c: [220, 330, 277, 330, 247, 370, 294, 370, 220, 330, 277, 415, 247, 370, 330, 370],
  bass: [110, 110, 123, 123, 98, 98, 110, 110, 110, 110, 139, 139, 123, 123, 98, 98],
  arp: [880, 1109, 1319, 1109],
  d: "K.H.S.H.K.H.S.H.KHK.S.H.K.H.SHH.",
};

const oberon: FallbackTrack = {
  bpm: 144,
  l: [220, 262, 330, 0, 294, 262, 220, 196, 196, 247, 294, 330, 392, 330, 294, 262, 220, 294, 349, 0, 392, 349, 330, 294, 262, 247, 294, 262, 247, 220, 196, 0],
  c: [110, 165, 131, 165, 98, 147, 123, 147, 110, 196, 147, 196, 123, 175, 147, 175],
  bass: [55, 55, 65, 65, 49, 49, 55, 55, 55, 55, 73, 73, 65, 65, 49, 49],
  arp: [440, 523, 659, 523],
  d: "K.H.S.H.KK..S.H.K.H.S.H.K.H.SHH.",
};

const boss: FallbackTrack = {
  bpm: 168,
  l: [330, 311, 330, 392, 349, 330, 294, 0, 392, 370, 349, 466, 440, 392, 349, 311, 330, 392, 494, 466, 440, 392, 370, 349, 311, 330, 392, 349, 330, 294, 262, 0],
  c: [165, 196, 156, 196, 147, 175, 139, 175, 196, 233, 185, 233, 175, 220, 156, 220],
  bass: [82, 82, 78, 78, 73, 73, 69, 69, 98, 98, 92, 92, 87, 87, 78, 78],
  arp: [659, 784, 932, 784],
  d: "KHK.SHH.KHK.SHH.KHK.SHH.KKSSHHH.",
};

const final: FallbackTrack = {
  bpm: 178,
  l: [392, 494, 587, 740, 698, 587, 494, 392, 466, 587, 698, 831, 784, 698, 587, 466, 494, 622, 740, 932, 880, 784, 698, 587, 523, 659, 784, 988, 932, 831, 740, 0],
  c: [196, 294, 247, 294, 233, 349, 294, 349, 247, 370, 311, 370, 262, 392, 330, 392],
  bass: [49, 49, 58, 58, 55, 55, 49, 49, 58, 58, 69, 69, 65, 65, 58, 58],
  arp: [784, 988, 1175, 988],
  d: "KHKSSHH.KHKSSHH.KHKSSHH.KKSSHHH.",
};

/* The four later moons were derived from the first four in v1.7 by transposing
   and re-articulating, rather than composed fresh. Kept exactly as written. */

const miranda: FallbackTrack = {
  ...titania,
  bpm: 154,
  l: titania.l.map((f, i) => f && f * (i % 8 < 4 ? 0.75 : 1)),
  c: titania.c.map((f) => f * 0.75),
  bass: titania.bass.map((f) => f * 0.75),
  arp: titania.arp.map((f) => f * 0.75),
  d: "K.H.SHH.K.H.S.H.KK..SHH.K.H.S.H.",
};

const puckmoon: FallbackTrack = {
  ...ariel,
  bpm: 160,
  l: ariel.l.map((f, i) => f && f * (i % 6 === 0 ? 1.125 : 1)),
  arp: ariel.arp.map((f) => f * 1.125),
  d: "KHK.S.H.K.H.S.H.KHK.S.H.K.H.SHH.",
};

const cressida: FallbackTrack = {
  ...oberon,
  bpm: 150,
  l: oberon.l.map((f, i) => f && f * (i % 8 > 4 ? 1.5 : 1)),
  c: oberon.c.map((f) => f * 1.25),
  d: "K.H.S.H.KK..S.H.K.H.SHH.KK..S.H.",
};

const desdemona: FallbackTrack = {
  ...titania,
  bpm: 166,
  l: titania.l.map((f, i) => f && f * (i % 4 === 2 ? 0.875 : 1)),
  bass: titania.bass.map((f) => f * 0.875),
  d: "KHK.SHH.K.H.S.H.KHK.SHH.K.H.SHH.",
};

export const FALLBACK_TRACKS: Readonly<Record<string, FallbackTrack>> = {
  title, select, ariel, umbriel, titania, oberon,
  miranda, puckmoon, cressida, desdemona, boss, final,
};
