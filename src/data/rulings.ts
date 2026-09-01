/* ============================================================================
   RULINGS — decisions Damian Blazy has made directly, as CEO.
   ============================================================================

   WHAT THIS FILE IS FOR

   This site is a POC assembled from a PRD, two released data sheets, a firmware
   requirements spec, a third-party device assessment, an ISO certificate, a SOC
   report and forty-five ported blog posts. Those sources disagree with each
   other. When they do, someone has to rule, and the person who rules is Damian.

   Those rulings kept being lost. They were made in conversation, applied to two
   or three pages, and then a later pass - or a second agent working the same
   repo - restated the same fact from a source document and silently undid them.
   On 12 Aug 2026 that happened twice in one day: a reverted USB regression came
   back within two hours, and a warranty term appeared in a printable spec sheet
   that matched neither the site nor the released PDFs.

   So a ruling now lives here, in version control, with its date, and every
   surface that states the fact imports it from here. A ruling is not a source
   document and does not defer to one: it is the decision about what the site
   says when the documents conflict.

   HOW TO USE IT

   - Import the constant. Do not retype the value into a page.
   - If a source document contradicts a ruling, the ruling wins. Record the
     contradiction in Website/Reports/Datasheet reconciliation so the underlying
     document can be corrected, and move on.
   - If you find a conflict this file does not cover, ASK DAMIAN. Do not pick.
     Guessing is what produced the mess this file exists to prevent.
   - Adding a ruling means adding it here first, then propagating. Never the
     other way round.

   See also: AGENTS.md, "Ruled facts", which points here and is mandatory
   reading before touching product, pricing or capability copy.
   ============================================================================ */

/** Ruled 12 Aug 2026, in conversation, superseding every earlier reading.
 *
 *  THE TIER STORY, SETTLED
 *
 *  Essentials runs THE SAME SOFTWARE as Pro. Not a reduced build, not a feature
 *  tier, not a licence gate — the same platform. Every capability difference
 *  between the two traces to a HARDWARE limit of the Mini chassis, and there are
 *  only two of them:
 *
 *    1. MEMORY -> the simultaneous share ceiling. 5 on Essentials, 10 on Pro.
 *    2. NO USB INPUT -> no Polaris Link, and no true wireless BYOM, because
 *       both need a USB host to attach the room camera and microphone.
 *
 *  That framing is stronger than a feature-tier story and it is also the true
 *  one: a buyer is not being sold a crippled product, they are being sold the
 *  same product in a smaller box. Copy should say so.
 *
 *  What this rules OUT: presenting any software capability as Pro-only. If a
 *  page implies Essentials runs a lesser workspace, a lesser cloud, lesser
 *  security or a lesser sharing model, it is wrong.
 *
 *  Hardware I/O differences are NOT software differences and remain stateable
 *  as what they are: Essentials has one HDMI output and no HDMI input, so no
 *  dual display and no wired ingest. Those are ports, not features.
 */
export const TIERS = {
  /** The two are one software platform. Lead with this. */
  sameSoftware:
    "Essentials runs the same Polaris software as Pro — the same workspace, the same cloud, the same security posture. The differences are the chassis, not the platform.",

  /** Simultaneous shares composited in the workspace. Memory-bound, not licensed.
   *
   *  RE-RULED 14 Aug 2026 (F11.1, F11.2), in Damian's words: "in code there is no
   *  density limit, in hardware there is, and practically it's around 5 for
   *  Essentials and 10 for Pro."
   *
   *  This fact has now been re-litigated three times, each time because someone
   *  found half of it and concluded the other half was wrong. Both halves are true
   *  and they have to travel together:
   *
   *    NO SOFTWARE CAP.   The signalling server's join handler has no capacity
   *                       check, the display grid is unbounded, and the media path
   *                       contains no reference to plan, tier or device type. A
   *                       verification pass read that and concluded, reasonably,
   *                       that the site's 5 and 10 were invented. They are not.
   *    A HARDWARE CAP.    The limit is memory on the chassis. It is real, a
   *                       customer will hit it, and it is approximately 5 and 10.
   *
   *  So state it as a practical ceiling with its cause, never as an enforced limit
   *  and never as a licence tier. "Around" is deliberate: an exact number implies
   *  a counter that refuses the sixth source, and no such counter exists.
   *
   *  Do not "correct" these numbers away on the grounds that they are absent from
   *  the code. Absence from the code is the point. */
  shares: { essentials: 5, pro: 10 },
  sharesWhy:
    "The ceiling is memory on the chassis, not licensing: the same compositor with less room to work in. Nothing in the software counts sources or refuses one, so state it as a practical ceiling of around 5 and around 10, never as an enforced limit.",

  /** Native casting has its own, separate and much lower cap, and it is the same
   *  on every tier: the receiver accepts up to four simultaneous AirPlay, Miracast
   *  or Google Cast senders. Which value is live depends on a feature flag, so
   *  confirm before publishing the number. Do not merge this with the workspace
   *  ceiling above — they are different limits on different paths, and conflating
   *  them produces a "4 shares" claim that is wrong on both counts. */
  nativeCastSenders: 4,

  /** Polaris Link — pre-launch, Q3 2026. Pro only.
   *
   *  Damian's mechanism, 12 Aug 2026, in his words: Link is a SOFTWARE BRIDGE
   *  between the user's laptop in BYOM and the Pro, and the Pro is controlling
   *  the cameras and other peripherals. That is why Link requires a Pro.
   *
   *  Note for anyone tempted to restate this: the reason is not "the Mini has no
   *  USB port" in the abstract. It is that Link's whole function is to hand the
   *  laptop's call over to the device that owns the peripherals, and on this
   *  platform that device is the Pro. State the function, not the port. */
  linkEssentials: false,
  linkWhy:
    "Link is a software bridge between the laptop in BYOM and the Pro, and the Pro is what controls the room's cameras and peripherals. That is why Link needs a Pro.",

  /** True wireless BYOM. Pro only, same underlying reason: the peripherals have
   *  to be attached to the pod for the pod to bridge them into the call, and the
   *  Mini chassis has no USB input to attach them to. */
  byomEssentials: false,
  byomWhy:
    "True wireless BYOM bridges the room's own camera and mic into the call, so the peripherals have to be attached to the pod. The Mini chassis has no USB input.",

  /** Hardware I/O, stateable as such — these are ports, not platform features.
   *
   *  CONNECTOR CORRECTED 26 Aug 2026 by HARDWARE_RULINGS.usbTypeC (Ruling C). This
   *  string said "2x USB-A 3.0 host" until then, and it was wrong. */
  ioDifferences:
    "Essentials: one HDMI output, no HDMI input, no USB, no audio out. Pro: dual HDMI output, HDMI input, 2x USB 3.0 Type-C host, analogue audio out.",

  /** Ruled by Damian Blazy 13 Aug 2026 (F5.17, F5.14). Two facts about the Mini
   *  that keep getting softened, each with a consequence attached:
   *
   *  NO USB AT ALL. The rear panel is Kensington lock, Ethernet, HDMI 2.0 and DC
   *  power, and that is the whole of it. Not "USB on request", not "one USB" —
   *  none. This is load-bearing: no USB host means no room camera, which is why
   *  wireless BYOM and Link are Pro capabilities rather than a licence away.
   *  Enforced by scripts/check-specs.py, which fails any two-column Essentials
   *  spec row whose value names a USB port.
   *
   *  SINGLE DISPLAY OUTPUT. Essentials drives ONE display. Say that positively —
   *  "Essentials drives a single display; Pro ingests and drives two" — rather
   *  than only as an absence ("dual-display output — Pro only"), which tells a
   *  reader what the tier lacks without ever telling them what it does. The two
   *  facts were previously bundled in one comparison row with the HDMI input, and
   *  they are different kinds of thing: one is a display count, the other is a
   *  missing receiver on the board. They are separate rows now. */
  essentialsUsb: false,
  essentialsDisplayOutputs: 1,
  essentialsIoWhy:
    "The Mini's rear panel is Kensington lock, Ethernet, HDMI 2.0 and DC power. No USB, no HDMI input, no audio out, one display.",
} as const;

/** SETTLED, Damian Blazy 14 Aug 2026: Essentials outputs 4K30. The data sheet was
 *  right and the 4K60 expectation was wrong, so nothing on the site changes and
 *  the yellow conflict flags come off three surfaces.
 *
 *  Kept as a record because the shape of the near-miss is worth remembering. A
 *  verification pass proposed DELETING the 4K30 figure as unsourced. It was not
 *  unsourced — it came from the released Essentials data sheet
 *  DS-MCS.ESS-02192025 — and the correct response to "I cannot find a source" is
 *  to look harder, not to delete a true figure. Had that item been accepted on its
 *  own terms, the site would have lost a correct spec and then had to guess it
 *  back.
 *
 *  Note the two tiers do not use the same 4K, and this is the detail a bare
 *  "4K30 vs 4K60" comparison destroys:
 *      ESSENTIALS  DCI 4K, 4096 x 2160, at 30 Hz
 *      PRO         UHD 4K, 3840 x 2160, at 60 Hz  (dual)
 *  Different pixel dimensions AND a different refresh rate. Always state both.
 *  scripts/check-specs.py enforces the dimensions on every display-output row. */
export const ESSENTIALS_OUTPUT = {
  format: "DCI 4K, 4096 x 2160, at 30 Hz",
  source: "Essentials data sheet DS-MCS.ESS-02192025",
  settled: "Damian Blazy, 14 Aug 2026",
} as const;

/** Ruled 12 Aug 2026. Corrects an inference I had written into this file and
 *  should not have.
 *
 *  POLARIS HOST WORKS WITH BOTH TIERS — pre-launch, Q4 2026.
 *
 *  I had recorded Host as carrying "the same hardware constraint" as Link. That
 *  was my guess, not Damian's ruling, and it was wrong. Host is a separate unit
 *  that can carry the peripherals itself, which is exactly what lets it reach an
 *  Essentials room. Two topologies:
 *
 *    HOST + PRO        The peripherals connect directly to the Pro, so the
 *                      cables stay at the FRONT of the room.
 *    HOST + ESSENTIALS The peripherals cable to the Host, and the Host and the
 *                      Essentials unit are paired. This needs a cable to the
 *                      TABLE.
 *
 *  Do not hide the trade-off — it is the honest version and it sells the right
 *  tier. Some customers will not want a cable on the table. In larger rooms they
 *  will want a Pro anyway, so the constraint routes the buyer to the correct
 *  product rather than costing a sale.
 *
 *  This is why the family tier tables are already right to show Host as an
 *  add-on on BOTH columns while Link is Pro-only. Do not "fix" them.
 */
export const HOST = {
  essentials: true,
  pro: true,
  withPro:
    "Peripherals connect directly to the Pro, so the cables stay at the front of the room.",
  withEssentials:
    "Peripherals cable to the Host, and the Host and the Essentials unit are paired — which means a cable to the table.",
  tradeoff:
    "The cable to the table is the honest cost of running Host on Essentials. Larger rooms will want a Pro anyway, so state it plainly and let it route the buyer.",
} as const;

/** Ruled 12 Aug 2026.
 *
 *  THE SPEC SHEET IS A SUBSET OF THE PRODUCT PAGE.
 *
 *  Everything on a printable spec sheet must also appear on that product's page.
 *  The page is the superset; the sheet is a selection from it. Never the reverse.
 *
 *  This settles the restructure direction. As found on 12 Aug 2026 the two
 *  surfaces overlapped on only 23 of 84 specs, and 26 rows existed ONLY on the
 *  sheets — Sharing paths, Protocols, Resolution, Wi-Fi, Network protocols,
 *  Device security, Rear panel, Accessories, Warranty, Licensing and more. Those
 *  are not sheet-specific facts, they are facts the page is missing. They move
 *  onto the page.
 *
 *  Why this ordering and not the other: the page is the reviewed surface. It
 *  carries the [verify:] flags, the provenance citations and the POC banner. A
 *  fact that exists only on the printable artifact has escaped review by
 *  definition, and every one of the four claim problems found on 12 Aug 2026 was
 *  a sheet-only row.
 *
 *  SEPARATELY: the two TIERS may legitimately differ. Not everything on Pro
 *  appears on Essentials. That is not an inconsistency to fix — Pro has ports and
 *  capabilities Essentials does not. The subset rule is about SURFACES (sheet
 *  within page), not about tiers.
 */
export const SPEC_SURFACE_RULE =
  "Everything on a spec sheet must also be on that product's page. The product page is the superset and the reviewed surface; the sheet is a selection from it. Tiers may differ from each other — that is not the same thing.";

/** Ruled 12 Aug 2026. Commercial terms.
 *
 *  THREE PURCHASE TERMS, ON BOTH TIERS: 3-year, 5-year, and perpetual.
 *
 *  Perpetual is offered TODAY and will not be offered indefinitely. Do not write
 *  copy that treats it as permanent, and do not write copy that denies it exists.
 *
 *  This corrects both sheets, which disagreed: Pro's said "Subscription or
 *  perpetual license" and Essentials' said "One annual subscription per room".
 *  Both tiers carry all three terms.
 *
 *  WARRANTY ON A PERPETUAL LICENCE — ruled 13 Aug 2026, no longer open.
 *  Perpetual is capped at FIVE YEARS. See WARRANTY below for the full statement
 *  of both cases and why the distinction has to travel with the claim.
 */
export const LICENCE = {
  terms: ["3-year", "5-year", "perpetual"] as const,
  bothTiers: true,
  perpetualNote:
    "Perpetual licensing is available now and is not a permanent part of the lineup — copy should neither promise it indefinitely nor deny it.",
  /** Ruled 13 Aug 2026, closing the gap flagged the day before. */
  warrantyOnPerpetual: "5 years, capped",
} as const;

/** Ruled 12 Aug 2026. An HDMI cable can be included on request, on both tiers.
 *  Both sheets said "HDMI cable (not included)", which is wrong. The PSU half of
 *  that row is correct and sourced: included on Essentials, sold separately on
 *  Pro, because a Pro room is normally powered over Ethernet. */
export const HDMI_CABLE = "Available on request — an HDMI cable can be included with the order.";

/** MEETING PARITY AND THE HDMI INPUT. Ruled by Damian Blazy 14 Aug 2026, in his
 *  words: the HDMI-in hard line "takes over the screen as a feed but it does not
 *  broadcast this to the canvas".
 *
 *  So the exception is cleaner than the site's own reviewers guessed. Wired ingest
 *  is not a source that fails to travel; it is a DISPLAY TAKEOVER that never
 *  enters the workspace at all. Parity is a property of the canvas, and the canvas
 *  is what remote seats receive.
 *
 *  WHY THIS MATTERS ENOUGH TO WRITE DOWN
 *  The site promises meeting parity on thirteen surfaces, in words like "sees
 *  exactly what the front row sees". Four separate items in the verification pass
 *  (F11.4, F12.6, F13.7, F17.2) circled this, and the mirror wording was defended
 *  each time — correctly, because the OUTCOME is right for everything on the
 *  canvas. What none of those items could settle was the one case where the room
 *  sees something the remote seats cannot. Now it is settled.
 *
 *  HOW TO SAY IT. State the exception where wired ingest and parity meet, and give
 *  the workaround in the same breath, because there is one: share the same laptop
 *  wirelessly and it lands in the workspace like anything else. Do NOT restate it
 *  as a limitation of parity in general — parity holds for the canvas, and the
 *  canvas is the product.
 *
 *  Do not soften "mirrored live" on the strength of this. Damian has protected
 *  that wording four times and the outcome justifies it: remote seats run the same
 *  layout code over the same streams, at their own screen resolution. */
export const PARITY = {
  covers: "every source in the workspace canvas, laid out by the same code in the room and in every browser",
  exception:
    "A source on the Pro's wired HDMI input takes the display over as a full-screen feed rather than joining the canvas, so it is not one of the streams remote seats receive.",
  workaround: "Share the same device wirelessly and it lands in the workspace, remote seats included.",
  ruled: "Damian Blazy, 14 Aug 2026",
} as const;

/** FIRMWARE: two mechanisms that sound like one word. Ruled by Damian Blazy
 *  14 Aug 2026 after the site managed to publish both halves as a contradiction.
 *
 *  DOWNGRADE IS REFUSED.  An administrator cannot move a pod to an earlier
 *                         version. This is a security property: a
 *                         known-vulnerable firmware cannot be pushed back on to
 *                         re-open something already fixed.
 *  A BAD LOAD ROLLS BACK. The pod holds two firmware partitions. A new image
 *                         installs beside the running one rather than over it,
 *                         and a pod that fails to come up on the new version
 *                         comes back up on the last known-good one. This is a
 *                         reliability property.
 *
 *  Both are true. Neither implies the other. The word "rollback" on its own is
 *  ambiguous between them, and that ambiguity is exactly what went wrong: the Pro
 *  page ran a row headed "Signed updates, NO ROLLBACK" while the firmware page
 *  described automatic rollback in operational detail, and the printable sheet
 *  said "rollback protection", which reads as protection AGAINST rollback.
 *
 *  So: say "downgrade" when you mean the refused one and "rollback on a failed
 *  load" when you mean the automatic one. Never write bare "no rollback".
 *
 *  WHY A CODE REVIEW MISSED IT. The A/B partition scheme lives below the cloud
 *  layer, in the device image. A review of the platform repository cannot see it,
 *  which is why a verification pass concluded it did not exist. Absence from the
 *  cloud repo is not evidence about the device — the same lesson as TOPS and PoE.
 *
 *  STAGED ROLLOUT: CONFIRMED by Damian Blazy 14 Aug 2026, after being carried
 *  unconfirmed for two days. Fleet sequencing is a different mechanism from A/B
 *  rollback and had to be ruled on separately, which is why it was flagged rather
 *  than deleted.
 *
 *  The same lesson applies as to rollback, and it is now the third instance: the
 *  mechanism is not in the platform repository, so a review of that repository
 *  concluded it did not exist. Absence from the cloud repo is not evidence about
 *  the delivery layer. TOPS, PoE, A/B partitions and now staged rollout have all
 *  failed the same test. Before deleting any claim on the grounds that a grep
 *  found nothing, establish that the grep covered the layer the claim is about.
 *
 *  Copy guidance: /resources/firmware describes it operationally — "update ten
 *  rooms and watch them before the rest". That is now a supported claim. Do not
 *  inflate it into a named UI feature ("rings", "canary", "waves") that a
 *  reviewer would then look for and fail to find.
export const FIRMWARE = {
  downgrade: "The device refuses a downgrade to an earlier version.",
  rollback:
    "The pod keeps two firmware partitions: a new image installs beside the running one, and a pod that fails to come up on the new version returns to the last known-good one.",
  both: "Deliberate downgrade is refused; a bad load recovers itself.",
  forbidden: ["no rollback", "rollback protection", "without rollback"],
  stagedRolloutConfirmed: true,
} as const;

/** DRIFT DETECTION: removed from the POC entirely. Ruled by Damian Blazy
 *  14 Aug 2026 — "remove drift concept everywhere".
 *
 *  WHERE IT CAME FROM, because the provenance is the interesting part. It was not
 *  invented. It was harvested out of Mersive's own published blog post
 *  /blog/meeting-room-cloud-management/, where it appears in a checklist telling
 *  BUYERS what to test for in a management platform — "test configuration
 *  templates, exceptions, change history, and drift detection". Prescriptive
 *  language about the category, lifted into descriptive language about us. It
 *  entered the POC at v0.21 and reached thirteen places across seven files.
 *
 *  It does not exist in the platform: template application is push-only, there is
 *  no read-back, no periodic settings audit, and the only `drift` match in the
 *  source tree is a name in a fun-names list. An earlier technical report already
 *  identified it as a Q4 2026 ROADMAP line. This is the second independent pass to
 *  catch it, which is why it is now a guarded rule and not a note.
 *
 *  WHAT REPLACED IT, in every slot: template RE-APPLICATION. Editing a template
 *  re-applies it to every device assigned to it, so a room somebody reconfigured
 *  comes back to the approved profile. That is a real mechanism and it answers the
 *  same buyer worry. It restores rather than detects — do not describe it as
 *  finding, auditing, comparing, reporting or alerting on divergence, because none
 *  of that happens. When drift detection ships, write it from what shipped. */
export const NO_DRIFT_DETECTION = {
  exists: false,
  roadmap: "Q4 2026",
  replacement:
    "Editing a template re-applies it to every device assigned to it, so a room that was changed locally comes back to the approved profile.",
  forbidden: ["drift detection", "settings drift", "settings-drift", "configuration drift", "config drift"],
} as const;

/** Ruled 12 Aug 2026.
 *
 *  MOST-DETAILED WINS. Every usage of a spec states the fullest version of it.
 *
 *  Not "the sheet is a floor" — that rule already existed as a comment in the
 *  product pages and it was not enough, because it only told you not to follow a
 *  source document downward. It said nothing about two pages on this site stating
 *  the same fact at different depths. So both happened: Pro's USB row went from
 *  "2x USB-A 3.0, host mode" to "USB x 2" on a second surface, four hours and
 *  forty-nine minutes after the identical regression had been reverted on the
 *  first one.
 *
 *  The rule now is positive and has no exceptions:
 *
 *    Wherever a spec appears — product page, printable spec sheet, compare
 *    matrix, solution page, meta description — it states the MOST DETAILED
 *    version that exists anywhere on the site, and every surface states the SAME
 *    most-detailed version.
 *
 *  Detail means: the port count, the generation, the connector type, the mode
 *  ("2x USB-A 3.0, host mode", never "2x USB"). The units on every axis.
 *  Both scales where a conversion helps (0 °C / 32 °F). The provenance citation.
 *  And the [verify:] flag, which is part of the fact until it is closed — a
 *  surface that drops the flag is not a shorter version of the claim, it is a
 *  different and stronger claim.
 *
 *  Two corollaries people get wrong:
 *
 *  1. MORE DETAIL CAN ARRIVE ON THE NEWER SURFACE. When the spec sheets were
 *     written they added Fahrenheit conversions and per-axis units that the
 *     product pages did not have. Those are improvements and they propagate
 *     BACKWARD to the product page. "Most detailed wins" is not "the older page
 *     wins".
 *  2. LONGER IS NOT DETAIL. "FCC, IC, and UL, CE, RoHS" is not more detailed
 *     than "FCC, IC, UL, CE, RoHS" — it is a typo with an extra word. Judge by
 *     information content, not character count.
 *
 *  Enforced by `pnpm check:specs`, which extracts every spec row from every
 *  surface, pairs them by label, and fails when the same spec is stated two
 *  different ways. Consistency is not left to whoever edits next.
 */
export const SPEC_DETAIL_RULE =
  "Every usage of a spec states the most detailed version that exists anywhere on the site — port count, generation, connector, mode, units, provenance and any open [verify:] flag — and every surface states the same one. Enforced by pnpm check:specs.";

/** THE THIRD RUNG IS CALLED BYOM+. Ruled by Damian Blazy, 24 Aug 2026.
 *
 *  "Hosted by the room" is a description, not a name, and it does not sit in a
 *  series with the two names beside it. A reader climbing BYOD -> BYOM -> hosted
 *  by the room meets two acronyms and then a sentence, and the ladder stops
 *  looking like a ladder. BYOM+ is the name; it reads as the rung above BYOM,
 *  which is what it is.
 *
 *  HOW TO WRITE IT
 *    Short form   BYOM+          labels, chips, rung names, tier cards, table
 *                                headers, anywhere it sits beside BYOD and BYOM.
 *    Long form    Hosted by the room (BYOM+)
 *                                running prose, and wherever the term is being
 *                                introduced rather than referenced. The
 *                                description still does the explaining; the name
 *                                is what the reader carries away.
 *
 *  WHAT THIS RULING DOES NOT DO, and this is the part that matters most.
 *
 *  It does not rename the market's word. "Room-hosted" is the meeting-room
 *  industry's term for the category, and BYOM+ is Mersive's name for Mersive's
 *  rung. Those are different objects and the site has to keep them apart:
 *
 *    - compare.ts and every /compare page keep "room-hosted". Those cells
 *      describe Crestron, Extron, Vivi and the rest, each against a cited public
 *      source. Calling a competitor's product line "BYOM+" would put our brand
 *      name on their product and would misrepresent the source the cell is
 *      checked against. check-sources.py and check-provenance.py guard those.
 *    - resources/glossary keeps it. That page promises "the meeting-room
 *      market's vocabulary" and defines the industry's terms; a glossary that
 *      defined our brand name instead would simply be wrong.
 *    - platform/taxonomy keeps it wherever it is mapping the market's rungs
 *      rather than stating what Polaris does. It is the market map.
 *    - seo.ts keeps it. Those titles and descriptions are how people searching
 *      the category find us, and nobody searches for a name we invented today.
 *    - The blog keeps it, including the byod-vs-byom-vs-room-hosted slug, which
 *      is a live URL.
 *
 *  So: BYOM+ wherever we are naming our own rung, "room-hosted" wherever we are
 *  speaking the industry's language. If a future edit finds both words on one
 *  page, that is expected and is not an inconsistency to tidy up.
 */
export const RUNGS = {
  byod: "BYOD",
  byom: "BYOM",
  /** Short form: labels, chips, rung names, tier cards. */
  byomPlus: "BYOM+",
  /** Long form: running prose, and first use on a page. */
  byomPlusLong: "Hosted by the room (BYOM+)",
  /** The industry's word for the category. NOT ours to rename — see above. */
  categoryTerm: "room-hosted",
} as const;

/** POLARIS CLOUD IS THE PRODUCT. FLEET MANAGEMENT IS THE CATEGORY.
 *  Ruled by Damian Blazy, 27 Aug 2026.
 *
 *  They are one thing, not two. Polaris Cloud is the product a customer logs
 *  into; fleet management is the industry's name for the job it does. The same
 *  shape as the BYOM+ ruling directly above, and it resolves the same way:
 *  our name for our thing, the market's name for the market's category.
 *
 *  HOW TO WRITE IT
 *    Polaris Cloud      naming the thing itself — what it is, what it costs,
 *                       what you sign into, what a pod talks to.
 *    Fleet management   naming the job — section labels, nav-adjacent copy,
 *                       titles and descriptions, and anywhere a buyer who does
 *                       not yet know our brand would be looking.
 *
 *  BOTH ON ONE PAGE IS CORRECT, and is the point. The category word is how a
 *  buyer finds the page; the product name is what they leave knowing. A page
 *  that only says "Polaris Cloud" does not get found by anyone searching for
 *  the job, and copy that only says "fleet management" builds no brand.
 *
 *  WHAT THIS RULES OUT
 *
 *  1. Two sections. Home gets ONE section covering this pillar, not a "fleet
 *     management" section and a separate "cloud" section. The four-workload
 *     taxonomy in A0.2 has four cards, and this is the fourth — splitting it
 *     would make the page contradict its own count.
 *  2. Fleet management as a product. It is not a SKU, a tier, a licence or a
 *     line item, and must never appear in a price table, a product family or a
 *     buying path as though it were one.
 *  3. "Correcting" the A0.2 pillar card. That card is deliberately titled
 *     "Fleet management" while pointing at /platform/cloud: the category is the
 *     label because that is the words a buyer arrives with, and the product is
 *     the destination because that is what answers them. This is not a
 *     mismatch, and a future edit that renames the card to "Polaris Cloud"
 *     would be undoing the ruling rather than tidying it.
 *  4. Reading /platform/cloud's own <h3>Fleet management</h3> as a duplicate of
 *     the pillar card. There it is a CAPABILITY of the product — templates,
 *     bulk onboarding, scheduled firmware — which is exactly the right use.
 *
 *  As of this ruling the site already complies: 107 uses of "Polaris Cloud" as
 *  the product name, "fleet management" only ever as the job, no nav or price
 *  surface treating it as a SKU. The ruling is written down so that stays true.
 */
export const CLOUD_NAMING = {
  /** The product. What it is called when we are naming the thing. */
  product: "Polaris Cloud",
  /** The market's word for what it does. NOT a second product. */
  category: "fleet management",
} as const;

/** Ruled 12 Aug 2026, completed 13 Aug 2026. Supersedes every earlier value.
 *
 *  THE WARRANTY, SETTLED — AND IT HAS TWO CASES
 *
 *    ON SUBSCRIPTION   Full warranty for as long as the room is on subscription.
 *                      It renews when they renew. There is no cap and no cliff:
 *                      keep subscribing and the room stays under warranty.
 *
 *    ON PERPETUAL      Five years, capped. A perpetual licence is not a
 *                      subscription, so the open-ended commitment does not
 *                      apply to it. Ruled 13 Aug 2026.
 *
 *  BOTH CASES MUST TRAVEL TOGETHER. This is the important part and it is where
 *  the site got into trouble once already.
 *
 *  A page that says "warranty included" beside "subscription or perpetual
 *  licence" has made an unqualified promise across both, and the reader will
 *  take the better reading. On 12 Aug a printable spec sheet said "included for
 *  the life of the product" and a TCO figure was headed "Warranty for life" with
 *  the qualifier only in the body beneath it — that phrase then left the page
 *  inside a rendered PNG, and the qualifier did not travel with it.
 *
 *  So: wherever perpetual is mentioned near the warranty, the five-year cap is
 *  mentioned too. Wherever the warranty is described without perpetual in view,
 *  the subscription condition is stated rather than implied.
 *
 *  ── AMENDED 24 Aug 2026 BY DAMIAN BLAZY, WHO MADE THE ORIGINAL RULING ────────
 *  The A0 Pro tier card states the subscription case only: "Subscription carries
 *  the warranty for as long as you renew; perpetual licence available", with no
 *  five-year cap after it. That is his exact wording and his decision as CEO,
 *  taken with the rule above in front of him.
 *
 *  THE COMMERCIAL TERM HAS NOT CHANGED. Perpetual is still five years, capped —
 *  LICENCE.warrantyOnPerpetual still says so, and the Essentials card beside it
 *  still prints it. What changed is what that one card restates.
 *
 *  RECORDED HERE BECAUSE IT WOULD OTHERWISE BE UNDONE. The paragraph above reads
 *  as a standing instruction to add the cap wherever perpetual sits near the
 *  warranty, so the next reader — human or agent — would "fix" this card back
 *  within a release. Do not. It is deliberate, it is dated, and it is his.
 *
 *  ONE THING TO WATCH, and it is why this note is long. check-warranty.py's
 *  proximity rule (B) is satisfied on A0 only because the Essentials card carries
 *  the cap within 600 characters of the Pro claim. Reorder those cards, separate
 *  them, or change Essentials' wording, and the build turns red on a page whose
 *  copy nobody touched. If that happens the fix is a decision about this card,
 *  not a silent restoration of four words.
 *
 *  Three values that were in circulation and are NOT policy:
 *    - "Limited 3-year manufacturer's warranty" — both released data sheets
 *      (DS-MCS.PRO-05072025, DS-MCS.ESS-02192025). DATED. The sheets are to be
 *      reissued; the site does not follow them down.
 *    - "life of the product" — a printable spec sheet, 12 Aug 2026. WRONG and
 *      materially so: it survives cancellation and is an open-ended hardware
 *      obligation nobody approved.
 *    - "Warranty for life", unqualified — the TCO figure heading, 12 Aug 2026.
 *      Same defect in shorter form.
 */
/*  ── THE SUBSTANCE, THEN THE WORDING ────────────────────────────────────────
 *
 *  THE SUBSTANCE is the thing to get right, and it is two cases:
 *      on subscription  -> warranty runs while the subscription is active
 *      on perpetual     -> capped at five years
 *  Any phrasing that carries its case honestly is acceptable.
 *
 *  THREE APPROVED FORMS for the subscription case:
 *      "for the whole term"                       (approved 13 Aug 2026)
 *      "for life of the subscription"
 *      "full warranty while on active subscription"
 *
 *  ONE PHRASE IS BANNED OUTRIGHT: bare **"for life"**. Not as a heading, not as
 *  a chip, not as shorthand, not inside a figure. Also banned is "for life of
 *  subscription" without the "the" — it is one deleted word from the bare claim,
 *  and that deletion is the failure mode itself.
 *
 *  Why a banned phrase and not just a rule about meaning: every one of the five
 *  defects this ruling has had to correct was TRUE, and none was a lie.
 *  "Warranty for life" with the qualifier in the paragraph below. "Included for
 *  the life of the product." A perpetual price toggle sitting 230 characters
 *  above "full warranty". A true sentence loses its condition the moment it is
 *  skimmed, cropped into a chip, screenshotted into a figure, or read beside a
 *  price. Banning the detachable phrase is what stops that; the condition then
 *  lives inside the wording and cannot be separated from it.
 *
 *  A NOTE ON OVER-CORRECTING, because I did it. On 13 Aug I replaced "Warranty
 *  for the whole term" across three surfaces, reading it as another loose
 *  variant. It was not — it carries its condition perfectly well and Damian
 *  confirmed it is fine. The lesson is not to hunt phrasings; it is to ban the
 *  one detachable phrase and let the rest of the copy breathe.
 */
export const WARRANTY = {
  /** Short form. Use where space is tight — chips, table cells, price sublines. */
  short: "for life of the subscription",
  /** Equally approved short form, and the one that reads best as a heading. */
  term: "for the whole term",
  /** Sentence form. Use in prose. */
  long: "Full warranty while on active subscription.",
  /** The perpetual case. Required wherever a perpetual licence is offered. */
  perpetual: "On a perpetual licence the warranty is capped at five years.",
  /** Both cases in one sentence, for tier cards and price tables where the two
   *  purchase options sit side by side. */
  both:
    "Full warranty while on active subscription; on a perpetual licence it is capped at five years.",
  /** Never on the site, in any casing, abbreviation or heading. Enforced by
   *  scripts/check-warranty.py, which fails on "for life" unless the very next
   *  words are "of the subscription". */
  forbidden: [
    "for life",              // bare, unqualified — the detachable phrase
    "for life of subscription", // missing "the": one deletion from the bare claim
    "life of the product",
    "3-year warranty",       // the dated data-sheet term
    "limited 3-year",
  ],
} as const;

/** ============================================================================
 *  HARDWARE AND LIFECYCLE — Damian Blazy, 26 August 2026.
 *  ============================================================================
 *
 *  Three rulings made together, when the hardware fact base was built. The full
 *  record, with every spec row and its citation, is /HARDWARE.md at the repo
 *  root; the values the site renders are in src/data/hardware.ts. This block is
 *  the DECISION, which is a different thing from the fact base and outranks it.
 *
 *  ── RULING A — 10-YEAR PRODUCT LIFECYCLE ────────────────────────────────────
 *
 *  Mersive commits to a 10-year manufacturing lifecycle. The mechanism is silicon
 *  continuity: components upgrade to in-family successors, the platform and its
 *  invariants stay constant, and units remain fungible within tier.
 *
 *  SUPERSEDES, on this point only:
 *    Pod PRD 1.2 / Mini PRD 1.2   "Product lifespan: 3 years of sale, 5 years of
 *                                  support"
 *    Pod PRD 4.4 / Mini PRD 4.4   "Expected Service Life 5 years"
 *  Those lines are marked superseded in HARDWARE.md, NOT deleted. A superseded
 *  line that vanishes is a line somebody restores from the PDF six months later.
 *
 *  THE DOCUMENTS OF RECORD MUST FOLLOW. The Pod PRD should reissue as v3.9 and
 *  the Mini as v1.8. The site must not be the only place this decision exists —
 *  that is precisely how the rulings this file exists to protect got lost before.
 *
 *  BLOCKING OPEN ITEM, and the reason the canonical sentence carries a bracket:
 *  does "10 years" run as manufacture-from-launch, or support-from-purchase?
 *  Those are materially different promises to a procurement team. Until Damian
 *  rules, every surface publishes LIFECYCLE.canonical verbatim, placeholder
 *  included. ONE canonical sentence — two phrasings must not ship.
 *
 *  WHY THE FRAMING MATTERS. This is a promise about fungibility, not a disclaimer
 *  about parts. A customer does not care which RAM part ships; they care that a
 *  unit bought in year 8 behaves identically to one bought in year 1 and drops
 *  into the same estate. Write it that way. The invariants list in hardware.ts is
 *  the product promise and leads every hardware surface; the parts table is
 *  secondary and renders below it.
 *
 *  ── RULING B — POD AND MINI ARE DIFFERENT CHASSIS ───────────────────────────
 *
 *    Pod / Polaris Pro          86 x 184 x 30 mm    (Pod PRD 4.1)
 *    Mini / Polaris Essentials  58 x 140 x 30 mm    (Mini PRD 4.1)
 *
 *  DELETED: the Pro page's "the same chassis as the Gen 4 Mini", and the
 *  150 x 67 x 30 mm datasheet figure wherever it appeared.
 *
 *  THE DATASHEETS ARE WRONG, and the evidence is not a judgement call: BOTH
 *  released datasheets print the SAME dimensions (150 x 67 x 30 mm) and the SAME
 *  weight (0.45 lb / 204.1 g) for two physically different chassis. That is a
 *  copy-paste artifact. Routed to hardware for reissue.
 *
 *  WEIGHT appears in NEITHER PRD. The 204 g figure is datasheet-only and suspect
 *  by association with the dimensions beside it, so it publishes as
 *  "[weight unverified - hardware team]" rather than as a fact. Do not restore it
 *  from the datasheet; the datasheet is the thing under suspicion.
 *
 *  ── RULING C — USB IS TYPE-C, AND THE 13 AUG RULING IS SUPERSEDED ───────────
 *
 *  SUPERSEDES the ruling of 13 Aug 2026, which stated "USB-A 3.0, not Type-C".
 *  That ruling was made on bad information and is wrong.
 *
 *  Pod PRD 3.1 has specified Type-C since v3.4 (27 Sept 2023), and v3.7 reads, in
 *  full: "Two or more USB 3.0 or higher Type-C (female) ports. Output power:
 *  5V @ 0.9A maximum (no PD)." The site's "2x USB-A 3.0, host mode" was wrong on
 *  the connector while being right about the count and the mode.
 *
 *  THE OLD RULING IS MARKED SUPERSEDED, NOT DELETED. It is the record of a
 *  decision taken on bad information, and a deleted ruling is one that gets
 *  remade. This is the same USB row that regressed twice in one day on 12 Aug
 *  2026 — see SPEC_DETAIL_RULE. It has now been wrong in three different ways,
 *  which is why the corrected value is a constant here and not prose in a page.
 */
export const HARDWARE_RULINGS = {
  /** Ruling A. The one sentence, re-exported from hardware.ts so a page that
   *  imports rulings does not need a second import to state it correctly. */
  lifecycleYears: 10,

  /** Ruling B. */
  chassis: {
    pro: "86 x 184 x 30 mm",
    essentials: "58 x 140 x 30 mm",
    /** Never publish: both datasheets carry it for both products. */
    wrongDatasheetValue: "150 x 67 x 30 mm",
    sameChassisClaim:
      "Pro and Essentials are different chassis. The claim that they share one was a datasheet error, not a design fact.",
    weight: "[weight unverified - hardware team]",
  },

  /** Ruling C. The most-detailed form, per SPEC_DETAIL_RULE.
   *
   *  CONFIRMED FIRST-HAND 27 Aug 2026 against Pod PRD v3.8, the current revision,
   *  which reads: "Two or more USB 3.0 or higher Type-C (female) ports. Output
   *  power: 5V @ 0.9A maximum (no PD)." The ruling was made against v3.7; the
   *  latest document says the same thing, so it is no longer an inference.
   *
   *  THESE STRINGS ARE MEANT TO BE IMPORTED AND CURRENTLY ARE NOT. An audit on
   *  27 Aug 2026 found this one fact written SEVEN different ways across the site,
   *  every instance hand-typed and none importing from here. They agreed on the
   *  substance -- two ports, Type-C, host mode -- and differed in wording and HTML
   *  entity, which is the state a fact is in just before it drifts again. This row
   *  has already been wrong or divergent four separate times. Import the constant. */
  usbTypeC: "2x USB 3.0+ Type-C (female), host mode, 5 V at 0.9 A max, no USB Power Delivery",
  /** Short form for two-column comparison rows where the cell is narrow. Still
   *  carries connector, count and mode — the three things that kept being lost. */
  usbTypeCShort: "2x USB 3.0 Type-C, host mode",
  /** What it must never say again. */
  usbSuperseded:
    "USB-A 3.0. Ruled 13 Aug 2026 and superseded 26 Aug 2026: the PRD has specified Type-C since v3.4, Sept 2023.",

  /** The three warranty/lifecycle horizons, which are three different things and
   *  read as contradictory when they sit unlabelled beside each other. Flag-only:
   *  no commercial term changed here, and item 3 in HARDWARE.md asks Damian
   *  whether the 5-year perpetual cap still makes sense under a 10-year platform. */
  horizons: {
    cmDefect: "Manufacturing-defect warranty: 1 year, per both hardware requirement documents.",
    commercial: "Commercial warranty: runs with the subscription, capped at five years on a perpetual licence.",
    platform: "Platform lifecycle: 10 years, per Ruling A.",
    note: "Three different horizons. State which one is meant, every time — unlabelled beside each other they read as a contradiction.",
  },
} as const;
