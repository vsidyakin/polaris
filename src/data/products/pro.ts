/**
 * /products/pro — the content of the cinematic product page.
 *
 * Rendered by layouts/ProductShowcase.astro; the eight inline spec tables and
 * the Gen 3 band stay as markup in the page, in named slots. See types.ts for
 * which fields are HTML and which are escaped plain text.
 */
import { XIC, HIC, RIC, CNVIC } from "../icons";
import { TIERS } from "../rulings";
import type { ShowcaseData } from "./types";

export const PRO: ShowcaseData = {
  route: "products/pro",

  hero: {
    videoSrc: "/video/mersive-pro-optimized-700kb.mp4",
    videoWideSrc: "/video/mersive-pro-optimized-3mb.mp4",
    videoLabel: "Mersive Polaris Pro",
    eyebrow: "Mersive Polaris Pro",
    lines: ["One platform.", "One workspace.", "Total collaboration"],
    /* States no figure at all: the specifics arrive in the deck below, where
       the ten-source ceiling is the ruled figure (5 on Essentials, 10 on Pro —
       rulings.ts), true wireless BYOM is Pro's USB host ports, and cross-network
       sharing is on every tier, each made in full with its citation further down
       the page. */
    dek: "Ten live sources composited side by side, true wireless BYOM on the room's own camera and mic, and sharing that crosses networks &mdash; no VPN, no cable on the table.",
    specHref: "/products/pro/spec",
  },

  /* 20 frames, closed pod to open chassis, alpha throughout so the device floats
     on the page rather than sitting in a white box. */
  zoom: { dir: "/products/pod-pro-zoom-alpha", count: 20 },

  stage: {
    ariaLabel: "Polaris Pro, up close",
    alt: "Mersive Polaris Pro pod",
    eyebrow: "Inside Polaris Pro",
    title: "One pod. The whole room.",
    /* Every value is the full-depth form the spec-detail rule requires
       (rulings.ts, SPEC_DETAIL_RULE, and scripts/check-specs.py): the port count
       with its generation and connector, the pixel dimensions behind "4K", the
       PoE class. "2x USB" and a bare "4K" are both build failures, and correctly
       so — this section is a spec surface like any other, and a showcase is
       exactly where the temptation to shorten them is strongest. */
    rows: [
      { at: 0.52, ic: HIC.shares,  k: "Up to 10 simultaneous shares",
        v: "Composited live, side by side, laid out as sources join and leave" },
      { at: 0.585, ic: HIC.hdmiout, k: "Dual 4K60 output",
        v: "2× HDMI 2.0 — 4K (3840 × 2160) at 60 Hz on both" },
      { at: 0.65, ic: HIC.hdmiin,  k: "HDMI input",
        v: "1× HDMI 2.0 in, with HDCP 2.0 content protection" },
      { at: 0.715, ic: HIC.cammic,  k: "The room's camera and mic",
        v: "2× USB 3.0 Type-C, host mode — what carries true wireless BYOM" },
      { at: 0.78, ic: HIC.poe,     k: "One cable to the room",
        v: "1× 10/100/1000 RJ-45, PoE+ (802.3at Type 2)" },
      { at: 0.845, ic: HIC.chip,    k: "16 GB LPDDR4 · 32 GB flash",
        v: "MediaTek MT8395 (Genio 1200): ARM SoC, Mali GPU, on-die APU" },
    ],
  },

  headline:
    "Built for enterprise networks and the rooms where decisions actually get made.",

  caps: {
    kicker: "What Pro does",
    h2: "Four capabilities, one room.",
    /* `w` is the column span out of 12 on the widest breakpoint — the two cards
       carrying the heavier argument get the wider box, and the pair still adds
       to 12 so the grid reads as two columns of unequal weight rather than as a
       jumble. Below 1000px every card is half, below 760px every card is full.

       The two share figures come from TIERS rather than being typed here, per
       the "import the constant" rule in CLAUDE.md. */
    items: [
      {
        w: 7,
        ic: XIC.workspace,
        h: "The multi-share workspace",
        p:
          "Live sources composited side by side, compared, annotated, rearranged live &mdash; up to the published per-tier ceiling: " +
          TIERS.shares.essentials +
          " on Essentials, " +
          TIERS.shares.pro +
          " on Pro. The room's silicon does the work; nobody's laptop is load-bearing.",
        href: "/solutions/collab",
        cta: "Why the workspace wins",
      },
      {
        w: 5,
        ic: XIC.devicefree,
        h: "True wireless BYOM",
        p: "Your Teams/Zoom/Webex/Meet call, the room's camera and mic, no cable on the table, and multi-user, so the second presenter never waits for a dongle.",
        href: "/products/hybrid",
        cta: "The hybrid story",
      },
      {
        w: 7,
        ic: XIC.crossnet,
        h: "Cross-network sharing",
        p: 'On every Polaris tier, Pro included: guests on LTE, staff on corp Wi-Fi, the display on an AV VLAN, one workspace, no VPN, no UC call. Eleven of the twelve competitors we checked in August 2026 document LAN-local media only, on their own published specifications; one of them says it plainly &mdash; users on a cellular network or guest Wi-Fi cannot use it. The vendor list and sources are on the <a href="/platform/cross-network">architecture page</a> and the compare matrix.',
        href: "/platform/cross-network",
        cta: "See the architecture",
      },
      {
        w: 5,
        ic: XIC.webjoin,
        h: "Web-join: nothing to install",
        p: "Share from the browser on the device you walked in with, Chromebooks included. No client, no admin rights, no dongle drawer.",
        href: "/platform/how",
        cta: "How web-join works",
      },
    ],
  },

  security: {
    sdek: "Certifications scoped to a cloud say nothing about the box on the wall, so the box gets its own proof. Two outside firms have had it: one over the network, one with the lid off.",
    /* Wording is lifted from the page's original security paragraph rather than
       rewritten, and both [verify] flags travel with the claim they qualify —
       the severity summary is not cleared for publication and the SOC 2 period
       is not issued, so initVerifyFlags must keep finding them here. Do not tidy
       the brackets away.

       `when` is the assessment date where there is one, and the card's role
       where there is not; it is a label above the heading, not a claim. */
    items: [
      {
        ic: RIC.probe,
        when: "Independent scan · July 2026",
        h: "No network attack surface worth the name",
        p: "An outside firm scanned a managed Pod. The ports that answer are the casting and appliance functions, and no persistent media listener was enumerable at all &mdash; the real-time media path uses ephemeral per-session UDP ports that respond only after ICE consent. There is no standing media service in the room to probe.",
      },
      {
        ic: HIC.chip,
        when: "Independent physical attack · May 2025",
        h: "Opened, probed, and it held",
        p: "A firm took a Gen&nbsp;4 Pod in hand, opened it and attacked the hardware: UART and JTAG on the debug headers, an attempt to lift the firmware off the flash, a lab man-in-the-middle. <b>No critical, high, medium or low-severity vulnerabilities were identified.</b> Root login over the debug interface is refused outright, with no password prompt even offered; the firmware could not be extracted; no personally identifiable information was found stored on the device; and a presented invalid certificate was refused &mdash; the Pod failed the handshake and stopped talking to Mersive rather than trusting the interceptor. [verify: confirm this severity summary may be cited publicly - CISO to release]",
      },
      {
        ic: RIC.taa,
        when: "On the device",
        h: "Secure boot, sealed keys, an allowlist and 802.1X",
        p: "Secure boot is mandatory on production firmware. The device&rsquo;s own identity keys are sealed into an NXP SE050 secure element. USB access is by allowlist. 802.1X with EAP-TLS makes the room a first-class citizen of your NAC rather than an exception in it.",
      },
      {
        ic: RIC.cert,
        when: "The company, and the cloud",
        h: "ISO/IEC 27001:2022 · SOC 2 Type 2",
        p: "Mersive is ISO/IEC 27001:2022 certified, with no nonconformities raised at the June 2026 surveillance audit, and the Polaris cloud this Pro unit reports to is SOC 2 Type 2 attested. [2026 SOC 2 Type 2: swap in the period and opinion date when the auditors issue - CISO]",
      },
    ],
  },

  tier: "pro",

  specs: {
    sdek: "Integrator-grade candor: the full network and security posture on the page, with no form between you and the facts.",
    notes: [
      "The 10-year platform lifecycle, the invariants it holds constant, and the current silicon are documented once, on <a href=\"/products/pro/spec#platform-lifecycle\">the Pro spec sheet</a>. This page does not restate them: a fact stated twice is a fact drifting.",
      "Radical transparency is the policy: part numbers, RAM, and the video pipeline are published here, not discovered in a teardown. [All values pending hardware team sign-off.]",
      "[Complete spec set lands with the datasheet — every row stays open and inline at launch, limitations included.]",
    ],
  },

  /* Wording unchanged from the three hand-written anchors this replaced,
     [placeholder] flags included — the datasheet and the deployment guide are
     both still owed, and initVerifyFlags has to keep finding them.

     Icons come from the sets that already mean these things elsewhere on the
     site: CNVIC.docs is the page-with-lines used across the partner collateral,
     CNVIC.gear is configuration, RIC.fw is the firmware mark on /resources. */
  docs: [
    {
      ic: CNVIC.docs,
      h: "Datasheet (PDF)",
      p: "Full specifications, ordering info, environmentals. [placeholder]",
      href: "/resources/docs",
    },
    {
      ic: CNVIC.gear,
      h: "Deployment guide",
      p: "Network requirements, ports, 802.1x setup, SSO. [placeholder]",
      href: "/resources/docs",
    },
    {
      ic: RIC.fw,
      h: "Firmware & release notes",
      p: "Every release, publicly logged: the update-policy receipt.",
      href: "/resources/firmware",
    },
  ],
};
