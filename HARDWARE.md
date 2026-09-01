# HARDWARE.md — the master record for Polaris hardware and lifecycle facts

**Counterpart file: `src/data/hardware.ts`.** This document is the master; that file
is the typed export the site renders from, and it mirrors this document exactly.
Change this file first, then `src/data/hardware.ts`, then let pages render from it.
If the two ever disagree, this file is right and the export is a defect.

---

## 1. Purpose and the edit rule

Every hardware and lifecycle fact the site publishes lives here first.

> **HARDWARE.md at repo root is the master record for all hardware and lifecycle
> facts. Never hand-write a hardware value into a page. Change HARDWARE.md first,
> then `src/data/hardware.ts`, then let pages render from it. A hardware number
> that appears in a page but not in HARDWARE.md is a defect.**

This is not a one-off audit document. Read it before touching a spec, and add to it
before publishing a number anywhere else.

### Confidentiality — a hard rule, not a preference

Both PRDs are stamped *"Mersive Technologies Confidential Document — Do not share
with unauthorized 3rd parties"* on every page.

**Never publish, here or on any page:** BOM cost caps, projected volumes, NRE,
initial order quantities, shipping schedules, or supplier commercial terms. Those
values exist in the PRDs and are deliberately excluded from this file. Technical
values are publishable; commercial terms are not.

**Stop citing PRD version numbers in public-facing copy.** A published page cites
*"Mersive hardware requirement, rev. Nov 2024"*. Precise internal citations —
section numbers and document versions — stay inside this file only.

---

## 2. Source precedence

When sources disagree, the higher rank wins:

1. **Dated CEO rulings.** A ruling dated after a PRD supersedes it on that point.
   Rulings live in `src/data/rulings.ts` and are logged in §7 below.
2. **Gen4 Pod HW PRD v3.8 and Gen4 Mini HW PRD v1.7** (both 6 Nov 2024).
3. **May 2025 third-party device assessment** — as-built silicon, observed.
4. **Released datasheets** DS-MCS.PRO-05072025, DS-MCS.ESS-02192025.
5. **Current site copy — evidence of nothing.** It is the thing being corrected.

**Requirement and as-built are different facts.** Where they differ, both are
recorded and labelled. Never average them, never silently pick one, never drop the
conflict. A requirement of "Wi-Fi 5 or newer" and an as-built MT7921 running Wi-Fi 6
are both true and mean different things to a reader.

### Which PRD revisions were actually read

Every row below is verified line by line against these three documents:

| Document | Version | Dated | Where it lives |
| :-- | :-- | :-- | :-- |
| Gen4 Pod HW PRD | **v3.8** | 6 Nov 2024 | `…/Executive Packet/Website/Hardware pdfs/Gen4 Pod HW PRD v3_8.docx` |
| Gen4 Mini HW PRD | **v1.7** | 6 Nov 2024 | `…/1.0 Mersive/Hardware/Gen4 Mini HW PRD v1_7.pdf` |
| Gen4 Pod HW PRD | v3.7 | 7 Mar 2024 | `…/1.0 Mersive/Hardware/` — superseded, kept for the delta |

**Note the Pod's latest revision is a `.docx` in the Website folder, not a `.pdf` in
the Hardware folder.** That is why an earlier pass of this file concluded v3.8 did not
exist and marked six values as unverified reconstructions. It does exist, it was read
on 27 Aug 2026, and it confirms all six — no value in this document changed as a
result, only the flags came off. If a future pass cannot find a revision, search both
folders and both formats before recording an absence.

Its revision note, verbatim: *"Updated ESD to IEC 61000-4-2 Level 4 (8kV contact /
15kV air) · Specified thermals with no throttling of CPU · Updated Flash (eMMC) memory
to 32GB (design change) · Updated RAM to 16GB (design change)"*.

⚠️ **v3.8 disagrees with itself on its own date:** the cover reads November 6, 2024 and
the revision-history row reads 11/4/24. Recorded as 6 Nov 2024 here, matching both the
cover and the Mini's v1.7 date. Flagged for the reissue (§9).

---

## 3. Platform invariants — the 10-year promise

This is the product promise. It is not a disclaimer and must never be written as one.

A customer does not care which RAM part ships. They care that a unit bought in year 8
behaves identically to one bought in year 1 and drops into the same estate. That is
what the following guarantees, held constant across the full lifecycle:

- **Interfaces and port complement**, per tier
- **Feature set and behaviour**, including the workspace share ceiling for that tier
- **Management plane** — the same cloud, the same policies, the same fleet tooling
- **Security architecture** — secure boot, sealed key custody, 802.1X, allowlisted
  USB, signed no-downgrade updates with dual-partition rollback
- **Regulatory and TAA posture**
- **Mixed-vintage estates** — any unit interoperates with any other unit of its tier

**Any change that would break an invariant is a new product, not a refresh.**

### What can change

Individual components move to in-family successors as parts reach end of life.
Silicon stays within family so the platform is not re-architected. **That
substitution is the mechanism that makes ten years of manufacture possible** — it is
the reason the promise can be made, not a hole in it.

### Scope limits — state these; do not let the claim over-reach

1. **Fungibility is WITHIN a tier.** Pro and Essentials are *not* interchangeable:
   different share ceilings, BYOM on Pro only, PoE on Pro only, different chassis.
   Any page making the fungibility claim says this too.
2. **The NXP SE050 secure element is invariant-adjacent.** It is named in the
   published security architecture and in the May 2025 third-party device assessment.
   Any change to it requires **CISO sign-off and a Trust Center update** — never a
   routine BOM swap. Standing constraint.
3. **Substitution is not free.** Any radio or SoC change triggers **regulatory
   re-filing** (§6) and a **fresh TAA country-of-origin attestation**. Record the cost
   so nobody treats an in-family swap as a no-op.

### The canonical lifecycle sentence

One sentence, used verbatim everywhere. Two phrasings must not ship.

> Mersive commits to a 10-year manufacturing lifecycle for Polaris hardware, held
> constant by the platform invariants rather than by a fixed parts list.
> [10-year basis pending definition — manufacture-from-launch or
> support-from-purchase: Damian Blazy]

Exported as `LIFECYCLE.canonical` in `src/data/hardware.ts`. The bracketed flag is
part of the sentence until the definition is ruled; a surface that drops it is making
a stronger claim than the one that was approved.

---

## 4. Current silicon — as of 26 August 2026

Secondary to the invariants. Kept for security reviewers and for TAA/procurement, and
published *below* the invariants, never as the headline. Every part here is expected
to be substituted at some point in the lifecycle; that is the design.

| Component | Part | Source |
| :-- | :-- | :-- |
| SoC (Pro) | MediaTek MT8395 (Genio 1200) — ARM, Mali GPU, on-die APU | May 2025 device assessment, independently identified |
| SoC (Essentials) | MediaTek MT8370 (Genio 510) — ARM, Mali GPU, APU | Confirmed by Damian Blazy, 14 Aug 2026 |
| Wi-Fi / Bluetooth | MediaTek MT7921 — Wi-Fi 6 (802.11ax) | May 2025 device assessment |
| Secure element | NXP SE050F2HQ1/Z018HZ, I2C bus | Pod PRD 2.4 · Mini PRD 2.4 · device assessment |
| RAM (Pro) | Micron MT53E2G32D4DE-046 WT:C, 16 GB | Advantech, 7 Jul 2026 |
| RTC battery | CR2032 | Pod PRD 3.4 · Mini PRD 3.4 |
| Flash part number | **[not yet sourced — hardware team]** | — |
| Ethernet PHY | **[not yet sourced — hardware team]** | — |
| HDMI transceiver | **[not yet sourced — hardware team]** | — |
| Chassis weight | **[weight unverified — hardware team]** | see §7 Ruling B |
| Module designation | **[VEGA-DMS233/234 — confirm before publishing: hardware team]** | Advantech, unconfirmed |

**Do not invent or infer a part number.** A flagged empty row is correct; a guessed
one is a defect.

**Why substitution is expected, with a live example.** The Micron RAM part
(MT53E2G32D4DE-046 WT:C) was queried for EOL status with Advantech in July 2026. That
is the ordinary operation of a ten-year platform, not an exception to it.

---

## 5. Specifications

Legend: **Requirement** = what the PRD demands. **As built** = what the shipped
device does, where it differs and is separately sourced.

### 5.1 Gen4 Pod — Polaris Pro

| Spec | Requirement | As built / notes |
| :-- | :-- | :-- |
| Operating system | Linux, full support required (Pod 2.1) | — |
| CPU | Quad-core or better, 64-bit; OpenGL ES 3.0+, Vulkan 1.0+, TensorFlow; ARM strongly preferred, x86 considered (Pod 2.1) | MT8395, ARM |
| GPU | Must be supported by Chromium v120 or higher (Pod 2.2) | Mali |
| NPU | **Minimum 4.0 TOPS, goal 5.0 TOPS** (Pod 2.1) | MT8395 APU capability is higher — the site's "10+ TOPS" is silicon capability, not the requirement. Publish both, labelled. |
| RAM | **16 GB or more, LPDDR4x or better** (Pod 2.1, raised from 4 GB as a design change in v3.8) | 16 GB observed, May 2025 assessment; Micron part in §4 |
| Flash | **32 GB or more** (Pod 2.1, raised from 16 GB as a design change in v3.8) | 32 GB observed, May 2025 assessment |
| Wi-Fi | 802.11ac (Wi-Fi 5) or newer, 2.4 + 5 GHz, MIMO 2×2 or greater (Pod 2.1) | **MT7921, Wi-Fi 6 (802.11ax)** — exceeds requirement |
| Bluetooth | Bluetooth 5.0 or newer, required (Pod 2.1) | MT7921 |
| Secure element | NXP SE050F2HQ1/Z018HZ on I2C bus (Pod 2.4) | Same part as Mini. Invariant-adjacent — §3 |
| Secure boot | Required. Root of Trust in the bootloader; Mersive-signed image; OTA updates verify both the to-be-installed image and the result (Pod 2.3) | — |
| HDMI input | 1× HDMI 2.0+, 4K @ 60 Hz, plus common resolutions; HDCP-enabled with software enable/disable (Pod 3.1) | HDCP 2.0 (datasheet) |
| HDMI output | 2× HDMI 2.0+, both CEC, each an independent stream (Pod 3.1). Ideal dual 4K60; allowed 4K60 + 4K30; less ideal 4K60 + 1080p60; absolute floor dual 1080p60 | Dual 4K UHD 3840×2160 @ 60 Hz (datasheet) |
| USB | **2 or more USB 3.0+ Type-C (female), host mode** (Pod 3.1). Output 5 V @ 0.9 A maximum, **no USB Power Delivery** | Corrected sitewide 26 Aug 2026 and confirmed against v3.8 on 27 Aug — §7 Ruling C |
| Ethernet | RJ45 Gigabit, PoE+ IEEE 802.3at Type 2, required (Pod 2.1, 3.1) | 10/100/1000 RJ-45 (datasheet) |
| DC power | 12 V, 2 A or more; barrel connector 5.5 mm OD / 2.1 mm ID, centre positive (Pod 3.1, 3.2.1). 24 W continuous budget. **When both inputs are connected, all power is drawn from 12 V DC** (Pod 3.2) | 12 VDC, 2 A, 24 W max (datasheet) |
| Audio out | 3.5 mm analog, headphone level (Pod 3.1) | — |
| Video codecs | H.264 encode + decode **required**; H.265 encode + decode **required**; VP8 decode required (encode preferred); VP9 decode **preferred**; **AV1 decode required** (set v3.7); **JPEG/MJPEG decode required** (Pod 2.2.2) | Added to the site 26 Aug 2026 — §7 Ruling C |
| Colour conversion | YUY2 / YUYV required (Pod 2.2.3) | — |
| Decode target | Minimum 2× 4K60 **or** 4× 1080p60 concurrent (Pod 2.2.1) | — |
| Real-time clock | Battery-backed, must hold time across reboot; CR2032 acceptable (Pod 3.4) | CR2032 |
| Dimensions | **86 × 184 × 30 mm** (Pod 4.1, per Advantech proposal) | §7 Ruling B. Datasheet's 150 × 67 × 30 mm is **wrong** |
| Weight | Not specified in the PRD | **[weight unverified — hardware team]**. Datasheet's 204 g is suspect — §7 Ruling B |
| Thermal | Fanless strongly preferred. No throttling of CPU/GPU/VPU at 100 % load, LEDs at 100 %, all other systems at 100 %, sustained not less than 8 hours (Pod 4.2). The Pod adds **PoE+** to the systems held at 100 %, which the Mini’s wording does not. A thermally controlled fan is acceptable for worst-case conditions | — |
| Operating environment | Indoor only. 0 °C (32 °F) to 35 °C (95 °F); 30–70 % RH (Pod 4.4) | ⚠️ Pod PRD misprints 35 °C as "122 °F" — §9 |
| Storage environment | −20 °C (−4 °F) to 65 °C (149 °F); 10–90 % RH (Pod 4.4) | ⚠️ Pod PRD misprints 65 °C as "95 °F" — §9 |
| Drop | 1 m onto concrete, any critical axis (face, corner, edge), no cables connected (Pod 4.4) | — |
| ESD | IEC 61000-4-2 Level 4, ±8 kV contact, ±15 kV air (Pod 4.4, set in v3.8) | — |
| Physical security | Kensington Nano Security Slot (Pod 4.3) | — |
| TAA | Compliant, required (Pod 5.5) | — |
| Lifecycle | **10 years** — §7 Ruling A, superseding Pod 1.2 and 4.4 | — |

### 5.2 Gen4 Mini — Polaris Essentials

Verified in full against Mini v1.7 (6 Nov 2024).

| Spec | Requirement | As built / notes |
| :-- | :-- | :-- |
| Operating system | Linux, full support required (Mini 2.1) | — |
| CPU | Quad-core or better, 64-bit; OpenGL ES 3.0+, Vulkan 1.0+, TensorFlow; ARM strongly preferred (Mini 2.1) | MT8370, ARM |
| GPU | Supported by Chromium v120 or newer (Mini 2.2) | Mali |
| NPU | **Minimum 2.0 TOPS, goal 3.0 TOPS** (Mini 2.1). TensorFlow models must run directly on the NPU or equivalent (Mini 2.2.4) | 2 TOPS (Damian Blazy, 14 Aug 2026). No inference runtime ships in the current image |
| RAM | **4 GB or more, LPDDR4x or better** (Mini 2.1, set to 4 GB in v1.7 "to match current product status") | — |
| Flash | **32 GB as eMMC** (Mini 2.1, design change in v1.7) | — |
| Wi-Fi | 802.11ac (Wi-Fi 5) or newer, 2.4 + 5 GHz, MIMO 2×2 or greater (Mini 2.1) — same floor as Pod | Wi-Fi 6 802.11ax, MIMO 2×2 (datasheet) |
| Bluetooth | Bluetooth 5.0 or newer, required (Mini 2.1, required from v1.5) | — |
| Secure element | NXP SE050F2HQ1/Z018HZ on I2C bus (Mini 2.4) — **same part as Pod** | Invariant-adjacent — §3 |
| Secure boot | Required, identical wording to Pod (Mini 2.3) | — |
| HDMI input | **None** (Mini 2.1) | — |
| HDMI output | 1× HDMI 2.0+, 4K (3840×2160) @ 30 Hz, plus common resolutions; CEC required; HDCP required (Mini 2.1, 3.1) | ⚠️ Datasheet publishes **DCI 4K, 4096 × 2160 @ 30 Hz**. Ruled 14 Aug 2026 (`ESSENTIALS_OUTPUT`): the datasheet is right and the site does not change. Requirement and published figure differ — both recorded |
| Ethernet | RJ45 Gigabit (Mini 3.1). **No PoE** — eliminated in v1.3 | 10/100/1000 RJ-45 (datasheet) |
| Power | 12 V DC barrel jack only; 5.5 mm OD / 2.1 mm ID, centre positive — same connector spec as Pod. Estimated ≤ 24 W continuous (Mini 3.2) | 12 VDC, 2 A, 24 W max (datasheet). PSU **included** on Essentials |
| USB | **No user-facing USB port specified.** Debug CLI over USB only, internal, access controllable in software (Mini 3.1, 3.5) | Confirms `TIERS.essentialsUsb: false` |
| Audio out | None specified (Mini 3.1) | — |
| Video codecs | Identical table to Pod: H.264 enc+dec required; H.265 enc+dec required; VP8 decode required; VP9 decode preferred; AV1 decode required; JPEG/MJPEG decode required (Mini 2.2.2) | — |
| Colour conversion | YUY2 / YUYV required (Mini 2.2.3) | — |
| Workload | Render one 4K surface at 30 Hz or higher; two incoming streams required, more nice to have. **PRD 2.2.2 notes the current product supports upwards of 15 incoming streams, not all at 30 Hz** | Context for the ~5 practical share ceiling in `TIERS.shares` |
| Real-time clock | Battery-backed, holds time across reboot; CR2032 acceptable (Mini 3.4) | CR2032 |
| Dimensions | **58 × 140 × 30 mm** (Mini 4.1, per Advantech proposal) | §7 Ruling B. Datasheet's 150 × 67 × 30 mm is **wrong** |
| Weight | Not specified in the PRD | **[weight unverified — hardware team]** — §7 Ruling B |
| Thermal | Fanless strongly preferred. CPU/GPU/VPU at 100 % (no throttling), LEDs at 100 %, all other systems at 100 %, sustained not less than 8 hours minimum (Mini 4.2) | — |
| Operating environment | Indoor only. 0 °C (32 °F) to 35 °C (95 °F); 30–70 % RH (Mini 4.4) | Mini PRD converts correctly |
| Storage environment | −20 °C (−4 °F) to 65 °C (149 °F); 10–90 % RH (Mini 4.4) | Mini PRD converts correctly |
| Drop | 1 m onto concrete, any critical axis, no cables connected (Mini 4.4) | Identical to Pod |
| ESD | IEC 61000-4-2 Level 4, ±8 kV contact, ±15 kV air (Mini 4.4, set in v1.7) | Identical to Pod |
| Physical security | Kensington Nano Security Slot required (Mini 4.3, required from v1.5) | — |
| TAA | Compliant, required (Mini 5.5) | — |
| Lifecycle | **10 years** — §7 Ruling A, superseding Mini 1.2 and 4.4 | — |

### 5.3 Element — out of scope

Element is a pre-launch, Fire TV Stick-class platform with **no PRD in scope**. Do not
apply Pod or Mini values to it. Its placeholders stand. The single exception is the
10-year lifecycle, which Ruling A supports across all tiers.

---

## 6. Regulatory

Identical table in both PRDs (Pod §6, Mini §6).

**Required for launch:** FCC (USA) · UL (USA/Canada) · CB Scheme / IECEE
(international) · UKCA (UK) · CE (EU) · RoHS (EU) · SCIP (EU)

**Not required for launch:** RCM (AU/NZ) · IMDA (Singapore) · SRRC (China) ·
CCC (China) · KC (Korea) · MIC-T (Japan) · VCCI (Japan) · ETA/MoC (India) ·
MIC/VNTA (Vietnam) · NTC (Philippines) · BSMI (Taiwan) · ANATEL (Brazil)

**Historically acquired via regional partners:** NOM (Mexico) · RCM (Russia) ·
ANRT (Morocco) · MOC (Israel)

⚠️ **The site is wrong on two counts.** It publishes "FCC, IC, UL, CE, RoHS": it omits
UKCA, CB Scheme and SCIP, and it adds **IC**, which appears in neither PRD. Corrected;
IC flagged for confirmation (§9).

**Substitution cost.** Any radio or SoC change triggers regulatory re-filing across
this list and a fresh TAA country-of-origin attestation.

---

## 7. Rulings log

Full text and reasoning in `src/data/rulings.ts`. This is the index.

### Ruling A — 10-year product lifecycle
**Damian Blazy, 26 August 2026.**

Mersive commits to a 10-year manufacturing lifecycle. The mechanism is silicon
continuity: components upgrade to in-family successors, the platform and its
invariants stay constant, and units remain fungible within tier.

**Supersedes:** Pod PRD §1.2 and Mini PRD §1.2 ("Product lifespan: 3 years of sale,
5 years of support"), and Pod PRD §4.4 / Mini PRD §4.4 ("Expected Service Life
5 years"). Those lines are marked superseded, not deleted.

**Document of record must follow.** Pod PRD should reissue as v3.9 and Mini as v1.8
so the documents match this ruling. The site must not be the only place this decision
exists.

**Blocking open item:** whether "10 years" runs as manufacture-from-launch or
support-from-purchase. Until ruled, the canonical sentence in §3 carries the
placeholder, verbatim, everywhere.

### Ruling B — Pod and Mini are different chassis
**Damian Blazy, 26 August 2026.**

| | Dimensions | Source |
| :-- | :-- | :-- |
| Pod / Polaris Pro | **86 × 184 × 30 mm** | Pod PRD 4.1 |
| Mini / Polaris Essentials | **58 × 140 × 30 mm** | Mini PRD 4.1 |

**Deleted:** the Pro page claim "the same chassis as the Gen 4 Mini", and the
150 × 67 × 30 mm datasheet figure.

**The datasheets are wrong and the evidence is unambiguous.** *Both* released
datasheets print the *same* dimensions (150 × 67 × 30 mm) *and* the *same* weight
(0.45 lb / 204.1 g) for two physically different chassis. That is a copy-paste
artifact, not two measurements. Routed to hardware for reissue.

**Weight** appears in neither PRD. The 204 g figure is datasheet-only and now suspect
by association. Published as **[weight unverified — hardware team]**, not as fact.

### Ruling C — USB is Type-C, not USB-A
**Damian Blazy, 26 August 2026. Supersedes the ruling of 13 August 2026.**

The Pro pages state "2× USB-A 3.0, host mode", and a 13 Aug 2026 ruling affirmed
"USB-A 3.0, not Type-C". **Both are wrong.** Pod PRD §3.1 has specified
**USB Type-C (female), host mode** since v3.4 (27 Sept 2023). **v3.8, the current
revision, reads identically** — *"Two or more USB 3.0 or higher Type-C (female) ports.
Output power: 5V @ 0.9A maximum (no PD)"* — so the ruling is confirmed first-hand
against the latest document, not inferred from a superseded one.

The released Pro datasheet says only **"USB x 2"**: no generation, no connector, no
mode. That is less specific than the requirement, not in conflict with it, and the
product page says so where it cites both.

The 13 Aug ruling is marked superseded in `rulings.ts`, not deleted — it is the record
of a decision made on bad information, and deleting it invites the same error back.

Corrected everywhere to: **2× USB 3.0+ Type-C (female), host mode, 5 V @ 0.9 A max,
no USB Power Delivery.**

### Existing rulings this file defers to
- `TIERS` (12–14 Aug 2026) — same software, share ceilings 5/10, no USB on Essentials
- `ESSENTIALS_OUTPUT` (14 Aug 2026) — DCI 4K 4096×2160 @ 30 Hz, datasheet is right
- `WARRANTY` (12–13 Aug 2026, amended 24 Aug 2026) — see §9 item 3
- `SPEC_DETAIL_RULE`, `SPEC_SURFACE_RULE` (12 Aug 2026)

---

## 8. Removed by PRD revision — do not resurrect

From old copy, old datasheets, or an old agent's memory:

| Removed | When | The product today |
| :-- | :-- | :-- |
| **Android** | Pod v3.1 and v3.3; Mini v1.2 and v1.3 | The product is **Linux**. Both PRDs require full Linux support |
| **USB passthrough** | Pod v3.0 | Not a capability |
| **USB-C power in** | Pod v3.5 and v3.6 | Type-C is host-mode data/peripheral only. Power is barrel jack or PoE+ |
| **PoE on the Mini** | Mini v1.3 | Essentials is **barrel jack only** |

---

## 9. Open items

| # | Item | Owner | Status |
| :-- | :-- | :-- | :-- |
| 1 | **BLOCKING — does "10 years" mean manufacture-from-launch or support-from-purchase?** The canonical sentence carries a placeholder until this is answered | **Damian Blazy** | Open |
| 2 | ~~**Pod PRD v3.8 not on disk.**~~ **CLOSED 27 Aug 2026.** v3.8 was found in `Website/Hardware pdfs/` as a `.docx` and read in full. It confirms all six values — RAM 16 GB, flash 32 GB, ESD, the thermal clause, the 6 Nov 2024 date and the §3.1 Type-C citation. No value changed; the flags came off | Hardware team | **Closed** |
| 3 | **Perpetual 5-year warranty cap vs 10-year lifecycle.** Flag only — no copy changed. Three distinct things now coexist: CM manufacturing-defect warranty (1 year, both PRDs §5.6), commercial warranty (runs with subscription; capped 5 years on perpetual), platform lifecycle (10 years, Ruling A). A 5-year cap under a 10-year platform reads oddly and wants a decision | **Damian Blazy** (CEO review) | Open |
| 4 | **Chassis weight** — in neither PRD; datasheet figure suspect (Ruling B) | Hardware team | Open |
| 5 | **Datasheet dimension error** — both sheets print 150 × 67 × 30 mm and 204.1 g for two different chassis. Reissue both | Hardware team / product marketing | Open |
| 6 | **Pod PRD Fahrenheit typos — still present in v3.8.** §4.4 prints 35 °C as "122 °F" (should be 95 °F) and 65 °C as "95 °F" (should be 149 °F). Mini v1.7 converts both correctly, so the two documents disagree. Confirmed unfixed as of the current revision; fix in the v3.9 reissue | Hardware team | Open |
| 6b | **v3.8 disagrees with itself on its date** — cover reads November 6, 2024, revision-history row reads 11/4/24. Recorded here as 6 Nov 2024. Reconcile in the reissue | Hardware team | Open |
| 7 | **VEGA-DMS233/234** — confirm whether this Advantech module designation is the right name to publish. Not published until confirmed | Hardware team | Open |
| 8 | **IC (Innovation Canada)** — published on the site, appears in neither PRD. Confirm whether it was obtained | Regulatory / legal | Open |
| 9 | **[not yet sourced]** — flash part number, Ethernet PHY, HDMI transceiver | Hardware team | Open |
| 10 | **Essentials SoC.** The brief asked for this to be marked unsourced, but the site already carries MediaTek MT8370 (Genio 510) *confirmed by Damian Blazy, 14 Aug 2026*. A dated confirmation is not "unsourced", and deleting a confirmed figure is the exact failure `ESSENTIALS_OUTPUT` records. Kept as confirmed; flagged for him to overrule if he intended otherwise | **Damian Blazy** | Open |
| 11 | **PRD reissue** — Pod to v3.9, Mini to v1.8, carrying Rulings A, B and C so the document of record matches | Hardware team | Open |
| 12 | **TAA/NDAA on the datasheets** — both PRDs §5.5 require TAA compliance; neither released datasheet states it. Pre-existing `[verify:]` flag preserved | Legal / supply chain | Open |
