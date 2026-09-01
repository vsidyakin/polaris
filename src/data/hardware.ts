/* ============================================================================
   HARDWARE — the typed export every hardware fact on the site renders from.
   ============================================================================

   COUNTERPART FILE: /HARDWARE.md at the repository root.

   That document is the MASTER. This file mirrors it exactly. The edit order is
   fixed and it is not a style preference:

       HARDWARE.md  ->  this file  ->  the pages render from it

   A hardware number that appears in a page but not in HARDWARE.md is a defect.
   Never hand-write a hardware value into a page; import it from here. If this
   file and HARDWARE.md ever disagree, HARDWARE.md is right and this is the bug.

   WHY THIS EXISTS. The same spec was being restated by hand on a product page, a
   printable sheet, a compare matrix and a solution page, at four different depths
   and occasionally with four different values. SPEC_DETAIL_RULE in rulings.ts
   says every surface states the most detailed version; this file is how that is
   actually achieved rather than merely required.

   CONFIDENTIALITY. Both PRDs are stamped confidential. BOM cost caps, volumes,
   NRE, initial order quantities, shipping schedules and supplier terms are NOT in
   this file and must never be published. Technical values are publishable;
   commercial terms are not. Public copy cites "Mersive hardware requirement,
   rev. Nov 2024" — never a PRD version number. Precise internal citations live in
   HARDWARE.md only.

   REQUIREMENT vs AS BUILT are different facts and both are kept. A requirement of
   "Wi-Fi 5 or newer" and an as-built Wi-Fi 6 radio are both true and mean
   different things to a reader. Never average them and never silently pick one.
   ============================================================================ */

/** One row in a spec table.
 *
 *  `req` is what the PRD demands. `built` is what the shipped device does, and is
 *  present only where it differs from the requirement or carries its own source.
 *  `flag` is an open [verify:]-style note and is PART OF THE FACT until closed —
 *  a surface that drops it is making a stronger claim, not a shorter one. */
export interface HwRow {
  label: string;
  /** The requirement. Plain text. */
  req: string;
  /** As built, where it differs or is separately sourced. Plain text. */
  built?: string;
  /** Open question or known document error. Plain text, rendered in brackets. */
  flag?: string;
}

/* ── 1. THE PROMISE ───────────────────────────────────────────────────────────
   Lead with this. The parts list is secondary and always renders below it. */

/** The invariants: what is guaranteed constant for the whole lifecycle.
 *
 *  This is the product promise, and it is written as one. It is NOT a disclaimer
 *  about parts changing — it is the reason a customer can buy in year 8 and drop
 *  the unit into an estate built in year 1. Any change that would break one of
 *  these is a NEW PRODUCT, not a refresh. */
export const INVARIANTS: { h: string; p: string }[] = [
  {
    h: "Interfaces and port complement",
    p: "The ports on the back of the unit, and what each one does, per tier.",
  },
  {
    h: "Feature set and behaviour",
    p: "Including the workspace share ceiling for that tier. The room behaves the same way in year 10 as on day one.",
  },
  {
    h: "Management plane",
    p: "The same cloud, the same policies, the same fleet tooling, across every vintage in the estate.",
  },
  {
    h: "Security architecture",
    p: "Secure boot, sealed key custody, 802.1X, allowlisted USB, and signed no-downgrade updates with dual-partition rollback.",
  },
  {
    h: "Regulatory and TAA posture",
    p: "The compliance position the unit ships with does not quietly change underneath a procurement team.",
  },
  {
    h: "Mixed-vintage estates",
    p: "Any unit interoperates with any other unit of its tier. Vintage is not something an AV manager has to track.",
  },
];

/** The 10-year lifecycle. Ruling A, Damian Blazy, 26 Aug 2026. */
export const LIFECYCLE = {
  years: 10,

  /** THE CANONICAL SENTENCE. One phrasing, used verbatim everywhere.
   *
   *  Two phrasings must not ship, which is why this is a constant and not a
   *  sentence anyone retypes. The bracketed flag is part of the sentence until
   *  the basis is ruled — dropping it publishes a firmer commitment than the one
   *  that was approved. See OPEN_ITEMS[0]. */
  canonical:
    "Mersive commits to a 10-year manufacturing lifecycle for Polaris hardware, held constant by the platform invariants rather than by a fixed parts list. [10-year basis pending definition — manufacture-from-launch or support-from-purchase: Damian Blazy]",

  /** The mechanism. Substitution is what MAKES ten years possible; it is not a
   *  hole in the promise and must never be written as one. */
  mechanism:
    "Individual components move to in-family successors as parts reach end of life, and the silicon stays within family so the platform is never re-architected. That substitution is what makes ten years of manufacture possible.",

  /** Scope limits. Every surface making the fungibility claim states these too,
   *  or the claim over-reaches. */
  limits: [
    "Fungibility is within a tier. Pro and Essentials are not interchangeable: different share ceilings, BYOM on Pro only, PoE on Pro only, and different chassis.",
    "The NXP SE050 secure element is invariant-adjacent. It is named in the published security architecture and in the third-party device assessment, so any change requires CISO sign-off and a Trust Center update — never a routine BOM swap.",
    "Substitution is not free. Any radio or SoC change triggers regulatory re-filing and a fresh TAA country-of-origin attestation.",
  ],

  /** Supersedes, and what has to happen to the documents of record. */
  supersedes:
    "Supersedes the PRDs' 3 years of sale / 5 years of support and their 5-year expected service life. Those lines are marked superseded, not deleted; the Pod PRD reissues as v3.9 and the Mini as v1.8 so the documents match the ruling.",
} as const;

/* ── 2. CURRENT SILICON ───────────────────────────────────────────────────────
   Secondary to the invariants. For security reviewers and TAA/procurement, and
   it renders BELOW the promise, never as the headline. Every part here is
   expected to be substituted at some point; that is the design working. */

/** The as-of date for SILICON. Update it whenever a part in the table changes. */
export const SILICON_AS_OF = "26 August 2026";

export interface SiliconRow {
  label: string;
  /** The part, or a bracketed flag where no part is sourced yet. */
  part: string;
  /** Where the value comes from. Empty for unsourced rows. */
  src: string;
}

/** DO NOT INVENT OR INFER A PART NUMBER. A flagged empty row is correct; a
 *  guessed one is a defect. Rows below carrying a bracket are open items. */
export const SILICON: SiliconRow[] = [
  { label: "SoC · Pro", part: "MediaTek MT8395 (Genio 1200) — ARM, Mali GPU, on-die APU", src: "May 2025 third-party device assessment, independently identified" },
  { label: "SoC · Essentials", part: "MediaTek MT8370 (Genio 510) — ARM, Mali GPU, APU", src: "Confirmed by Damian Blazy, 14 Aug 2026" },
  { label: "Wi-Fi / Bluetooth", part: "MediaTek MT7921 — Wi-Fi 6 (802.11ax)", src: "May 2025 third-party device assessment" },
  { label: "Secure element", part: "NXP SE050F2HQ1/Z018HZ, I2C bus", src: "Mersive hardware requirement, rev. Nov 2024, and the device assessment" },
  { label: "RAM · Pro", part: "Micron MT53E2G32D4DE-046 WT:C, 16 GB", src: "Advantech, 7 Jul 2026" },
  { label: "RTC battery", part: "CR2032", src: "Mersive hardware requirement, rev. Nov 2024" },
  { label: "Flash part number", part: "[not yet sourced — hardware team]", src: "" },
  { label: "Ethernet PHY", part: "[not yet sourced — hardware team]", src: "" },
  { label: "HDMI transceiver", part: "[not yet sourced — hardware team]", src: "" },
  { label: "Chassis weight", part: "[weight unverified — hardware team]", src: "" },
  { label: "Module designation", part: "[VEGA-DMS233/234 — confirm before publishing: hardware team]", src: "" },
];

/** A live example of why substitution is expected rather than exceptional. */
export const SILICON_EOL_NOTE =
  "The Micron RAM part was queried for end-of-life status with Advantech in July 2026. That is the ordinary operation of a ten-year platform, not an exception to it.";

/* ── 3. SPECIFICATIONS ────────────────────────────────────────────────────────
   Pod = Polaris Pro. Mini = Polaris Essentials.

   Every row is verified line by line against the current revision of its document:
   Gen4 Pod HW PRD v3.8 and Gen4 Mini HW PRD v1.7, both 6 Nov 2024.

   The Pod rows were briefly marked "[v3.8 - unverified]" while that revision could
   not be found. It exists -- as a .docx in the Website folder rather than a .pdf in
   the Hardware folder -- and reading it on 27 Aug 2026 confirmed all six values
   without changing any of them. See HARDWARE.md section 2. */

export const POD_SPEC: HwRow[] = [
  { label: "Operating system", req: "Linux, full support required" },
  { label: "CPU", req: "Quad-core or better, 64-bit, with OpenGL ES 3.0+, Vulkan 1.0+ and TensorFlow. ARM strongly preferred", built: "MediaTek MT8395, ARM" },
  { label: "GPU", req: "Must be supported by Chromium v120 or higher", built: "Mali" },
  { label: "NPU", req: "Minimum 4.0 TOPS, goal 5.0 TOPS", built: "The MT8395 APU's capability is higher than the requirement — the two are different facts and both are published" },
  { label: "RAM", req: "16 GB or more, LPDDR4x or better", built: "16 GB observed in the May 2025 device assessment. Raised from 4 GB as a design change in the current revision" },
  { label: "Flash", req: "32 GB or more", built: "32 GB observed in the May 2025 device assessment. Raised from 16 GB as a design change in the current revision" },
  { label: "Wi-Fi", req: "802.11ac (Wi-Fi 5) or newer, 2.4 and 5 GHz, MIMO 2x2 or greater", built: "MediaTek MT7921, Wi-Fi 6 (802.11ax) — exceeds the requirement" },
  { label: "Bluetooth", req: "Bluetooth 5.0 or newer, required", built: "MediaTek MT7921" },
  { label: "Secure element", req: "NXP SE050F2HQ1/Z018HZ on the I2C bus", built: "Same part as the Mini. Invariant-adjacent: changing it needs CISO sign-off and a Trust Center update" },
  { label: "Secure boot", req: "Required. Root of Trust in the bootloader, a Mersive-signed image, and OTA updates that verify both the image to be installed and the result" },
  { label: "HDMI input", req: "1x HDMI 2.0+ at 4K60, plus common resolutions. HDCP-enabled, with software enable/disable", built: "HDCP 2.0" },
  { label: "HDMI output", req: "2x HDMI 2.0+, both with CEC, each carrying an independent stream. Ideal dual 4K60; allowed 4K60 + 4K30; floor dual 1080p60", built: "Dual 4K UHD, 3840 x 2160 at 60 Hz" },
  { label: "USB", req: "2 or more USB 3.0+ Type-C (female), host mode. Output 5 V at 0.9 A maximum, no USB Power Delivery", built: "Ruling C, 26 Aug 2026 — the USB-A figure previously published was wrong" },
  { label: "Ethernet", req: "RJ45 Gigabit with PoE+ (IEEE 802.3at Type 2), required", built: "10/100/1000 RJ-45" },
  { label: "DC power", req: "12 V, 2 A or more. Barrel connector 5.5 mm OD / 2.1 mm ID, centre positive. 24 W continuous budget, and when both inputs are connected all power is drawn from 12 V DC", built: "12 VDC, 2 A, 24 W max. The power supply is sold separately on Pro" },
  { label: "Audio out", req: "3.5 mm analog, headphone level" },
  { label: "Video codecs", req: "H.264 encode and decode required; H.265 encode and decode required; VP8 decode required; VP9 decode preferred; AV1 decode required; JPEG/MJPEG decode required" },
  { label: "Colour conversion", req: "YUY2 / YUYV required" },
  { label: "Decode target", req: "Minimum 2x 4K60 or 4x 1080p60 concurrent" },
  { label: "Real-time clock", req: "Battery-backed, holds accurate time across a reboot. CR2032 acceptable", built: "CR2032" },
  { label: "Dimensions", req: "86 x 184 x 30 mm", built: "Ruling B, 26 Aug 2026. The released datasheet's 150 x 67 x 30 mm is wrong and is being reissued" },
  { label: "Weight", req: "Not specified in the hardware requirement", flag: "weight unverified — hardware team" },
  { label: "Thermal", req: "", built: "The Pod adds PoE+ to the systems held at 100%, which the Mini requirement does not. A thermally controlled fan is acceptable for worst-case conditions" },
  { label: "Operating environment", req: "Indoor use only. 0 C (32 F) to 35 C (95 F), 30% to 70% RH", flag: "the Pod requirement document misprints 35 C as 122 F; corrected here and flagged for the reissue" },
  { label: "Storage environment", req: "-20 C (-4 F) to 65 C (149 F), 10% to 90% RH", flag: "the Pod requirement document misprints 65 C as 95 F; corrected here and flagged for the reissue" },
  { label: "Drop durability", req: "1 m onto concrete along any critical axis — face, corner or edge — with no cables connected" },
  { label: "ESD", req: "IEC 61000-4-2 Level 4, plus/minus 8 kV contact and plus/minus 15 kV air discharge" },
  { label: "Physical security", req: "Kensington Nano Security Slot" },
  { label: "TAA", req: "TAA compliant, required" },
  { label: "Lifecycle", req: LIFECYCLE.canonical },
];

export const MINI_SPEC: HwRow[] = [
  { label: "Operating system", req: "Linux, full support required" },
  { label: "CPU", req: "Quad-core or better, 64-bit, with OpenGL ES 3.0+, Vulkan 1.0+ and TensorFlow. ARM strongly preferred", built: "MediaTek MT8370, ARM" },
  { label: "GPU", req: "Must be supported by Chromium v120 or newer", built: "Mali" },
  { label: "NPU", req: "Minimum 2.0 TOPS, goal 3.0 TOPS. TensorFlow models must run directly on the NPU or equivalent", built: "2 TOPS. No inference runtime ships in the current image, so nothing on the device uses it yet" },
  { label: "RAM", req: "4 GB or more, LPDDR4x or better" },
  { label: "Flash", req: "32 GB as eMMC" },
  { label: "Wi-Fi", req: "802.11ac (Wi-Fi 5) or newer, 2.4 and 5 GHz, MIMO 2x2 or greater — the same floor as the Pod", built: "Wi-Fi 6 (802.11ax), MIMO 2x2" },
  { label: "Bluetooth", req: "Bluetooth 5.0 or newer, required" },
  { label: "Secure element", req: "NXP SE050F2HQ1/Z018HZ on the I2C bus — the same part as the Pod", built: "Invariant-adjacent: changing it needs CISO sign-off and a Trust Center update" },
  { label: "Secure boot", req: "Required. Root of Trust in the bootloader, a Mersive-signed image, and OTA updates that verify both the image to be installed and the result" },
  { label: "HDMI input", req: "None" },
  { label: "HDMI output", req: "1x HDMI 2.0+ at 4K (3840 x 2160) 30 Hz, plus common resolutions. CEC required, HDCP required", built: "The released datasheet publishes DCI 4K, 4096 x 2160 at 30 Hz, and that figure is ruled correct (ESSENTIALS_OUTPUT, 14 Aug 2026). Requirement and published figure differ; both are recorded" },
  { label: "Ethernet", req: "RJ45 Gigabit. No PoE — eliminated from the requirement in v1.3", built: "10/100/1000 RJ-45" },
  { label: "Power", req: "12 V DC barrel jack only, 5.5 mm OD / 2.1 mm ID, centre positive — the same connector as the Pod. Estimated no more than 24 W continuous", built: "12 VDC, 2 A, 24 W max. The power supply is included on Essentials" },
  { label: "USB", req: "No user-facing USB port. A debug command-line interface over USB only, internal to the product, with access controllable in software" },
  { label: "Audio out", req: "None specified" },
  { label: "Video codecs", req: "H.264 encode and decode required; H.265 encode and decode required; VP8 decode required; VP9 decode preferred; AV1 decode required; JPEG/MJPEG decode required" },
  { label: "Colour conversion", req: "YUY2 / YUYV required" },
  { label: "Workload", req: "Render one 4K surface at 30 Hz or higher. Two incoming streams required, more are nice to have", built: "The requirement notes the current product supports upwards of 15 incoming streams, though not all at 30 Hz" },
  { label: "Real-time clock", req: "Battery-backed, holds accurate time across a reboot. CR2032 acceptable", built: "CR2032" },
  { label: "Dimensions", req: "58 x 140 x 30 mm", built: "Ruling B, 26 Aug 2026. The released datasheet's 150 x 67 x 30 mm is wrong and is being reissued" },
  { label: "Weight", req: "Not specified in the hardware requirement", flag: "weight unverified — hardware team" },
  { label: "Thermal", req: "Fanless strongly preferred. No throttling of CPU, GPU or VPU at 100% load, LEDs at 100%, all other systems at 100%, sustained for not less than 8 hours" },
  { label: "Operating environment", req: "Indoor use only. 0 C (32 F) to 35 C (95 F), 30% to 70% RH" },
  { label: "Storage environment", req: "-20 C (-4 F) to 65 C (149 F), 10% to 90% RH" },
  { label: "Drop durability", req: "1 m onto concrete along any critical axis — face, corner or edge — with no cables connected" },
  { label: "ESD", req: "IEC 61000-4-2 Level 4, plus/minus 8 kV contact and plus/minus 15 kV air discharge" },
  { label: "Physical security", req: "Kensington Nano Security Slot required" },
  { label: "TAA", req: "TAA compliant, required" },
  { label: "Lifecycle", req: LIFECYCLE.canonical },
];

/* ── 4. REGULATORY ────────────────────────────────────────────────────────────
   Identical table in both hardware requirement documents. */

export const REGULATORY = {
  /** Required before launch. This is what a page publishes. */
  required: [
    "FCC (USA)",
    "UL (USA/Canada)",
    "CB Scheme / IECEE (international)",
    "UKCA (UK)",
    "CE (EU)",
    "RoHS (EU)",
    "SCIP (EU)",
  ],
  /** Not required for launch. Published where a reader would otherwise assume
   *  the absence means non-compliance. */
  notRequired: [
    "RCM (Australia / New Zealand)",
    "IMDA (Singapore)",
    "SRRC (China)",
    "CCC (China)",
    "KC (Korea)",
    "MIC-T (Japan)",
    "VCCI (Japan)",
    "ETA / MoC (India)",
    "MIC / VNTA (Vietnam)",
    "NTC (Philippines)",
    "BSMI (Taiwan)",
    "ANATEL (Brazil)",
  ],
  viaPartners: ["NOM (Mexico)", "RCM (Russia)", "ANRT (Morocco)", "MOC (Israel)"],

  /** What the site used to say, and why it was wrong. Kept so the correction is
   *  not quietly undone by someone reading an old datasheet. */
  siteWasWrong:
    "The site published 'FCC, IC, UL, CE, RoHS': it omitted UKCA, CB Scheme and SCIP, and added IC, which appears in neither hardware requirement document.",

  /** IC is still flagged rather than deleted outright — it may have been obtained
   *  outside the requirement documents. */
  icFlag: "verify: IC (Innovation Canada) appears in neither hardware requirement document — regulatory and legal",

  /** The standing cost of any in-family substitution. */
  substitutionCost:
    "Any radio or SoC change triggers regulatory re-filing across this list and a fresh TAA country-of-origin attestation.",
} as const;

/* ── 5. REMOVED BY REVISION ───────────────────────────────────────────────────
   Do not resurrect these from old copy, an old datasheet, or an old agent's
   memory. Each was removed deliberately and each has come back at least once. */

export const REMOVED: { what: string; when: string; today: string }[] = [
  { what: "Android", when: "Pod v3.1 and v3.3; Mini v1.2 and v1.3", today: "The product is Linux. Both hardware requirement documents demand full Linux support." },
  { what: "USB passthrough", when: "Pod v3.0", today: "Not a capability of the product." },
  { what: "USB-C power in", when: "Pod v3.5 and v3.6", today: "Type-C is host-mode data and peripherals only. Power is the barrel jack or PoE+." },
  { what: "PoE on the Mini", when: "Mini v1.3", today: "Essentials is barrel jack only." },
];

/* ── 6. OPEN ITEMS ────────────────────────────────────────────────────────────
   Mirrors HARDWARE.md section 9. Owners are named because an unowned open item
   is a note, not a task. */

export const OPEN_ITEMS: { item: string; owner: string; blocking?: boolean }[] = [
  { item: "Does '10 years' run as manufacture-from-launch or support-from-purchase? The canonical sentence carries a placeholder until this is answered.", owner: "Damian Blazy", blocking: true },
  { item: "CLOSED 27 Aug 2026 -- Pod PRD v3.8 was found in Website/Hardware pdfs/ as a .docx and read in full. It confirms RAM, flash, ESD, the thermal clause, the document date and the USB Type-C citation. No value changed.", owner: "Hardware team" },
  { item: "The perpetual licence's 5-year warranty cap sits oddly under a 10-year platform lifecycle. Flag only — no copy changed.", owner: "Damian Blazy (CEO review)" },
  { item: "Chassis weight is in neither hardware requirement document and the datasheet figure is suspect.", owner: "Hardware team" },
  { item: "Both released datasheets print the same dimensions and the same weight for two different chassis. Reissue both.", owner: "Hardware team / product marketing" },
  { item: "The Pod requirement document misprints 35 C as 122 F and 65 C as 95 F, and both survive into the current revision. The Mini converts them correctly, so the two documents disagree. Fix in the reissue.", owner: "Hardware team" },
  { item: "Confirm whether VEGA-DMS233/234 is the right Advantech module designation to publish.", owner: "Hardware team" },
  { item: "IC (Innovation Canada) is published on the site but appears in neither requirement document. Confirm whether it was obtained.", owner: "Regulatory / legal" },
  { item: "Flash part number, Ethernet PHY and HDMI transceiver are not yet sourced.", owner: "Hardware team" },
  { item: "The Essentials SoC was asked to be marked unsourced, but MT8370 (Genio 510) carries a dated confirmation from 14 Aug 2026. Kept as confirmed; flagged to overrule if that was not the intent.", owner: "Damian Blazy" },
  { item: "Reissue the hardware requirement documents so the record matches Rulings A, B and C.", owner: "Hardware team" },
  { item: "Neither released datasheet carries a TAA or NDAA statement, though both requirement documents demand TAA compliance.", owner: "Legal / supply chain" },
];
