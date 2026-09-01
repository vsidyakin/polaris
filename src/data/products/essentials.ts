/**
 * /products/essentials — the content of the cinematic product page.
 *
 * Rendered by layouts/ProductShowcase.astro, the same layout /products/pro
 * uses: not a fork of it, and not a reduced version of it. Every difference
 * between the two pages is a difference of content, which is the same thing
 * rulings.ts says about the two products — Essentials runs the same software as
 * Pro, and every capability difference traces to a hardware limit of the Mini
 * chassis.
 *
 * NOT shared is a single fact: every spec, every citation and every [verify:]
 * flag here is the Essentials one. The differences that matter: the film is the
 * Mini's, the stage scrubs the Mini's 24-frame turntable rather than the Pod's
 * 20-frame zoom, and the six stage rows are the Mini's ports — which includes
 * the row about the ports it does not have, because that absence is the ruled
 * reason wireless BYOM and Link are Pro capabilities (rulings.ts,
 * TIERS.essentialsIoWhy).
 */
import { XIC, HIC, RIC, CNVIC } from "../icons";
import { TIERS } from "../rulings";
import type { ShowcaseData } from "./types";

export const ESSENTIALS: ShowcaseData = {
  route: "products/essentials",

  hero: {
    /* ONE ENCODE, unlike /products/pro, which ships a phone cut and upgrades to
       a larger one from 900px up. Only the 5 MB Mini film exists today, so
       videoWideSrc is absent and initVideoHero() has nothing to upgrade — which
       is fine, but it does mean a phone fetches the desktop file. If a small cut
       is ever encoded, put it in videoSrc and move this one to videoWideSrc: the
       small file must be the markup src, because that fetch is already in flight
       before any script runs. */
    videoSrc: "/video/mersive-mini-2-optimized-5mb.mp4",
    videoLabel: "Mersive Polaris Essentials",
    eyebrow: "Mersive Polaris Essentials",
    /* "One Mini. One workspace." is Matt's copy, requested 21 Aug 2026, and it
       deliberately takes the cadence this card used to avoid. The card it now
       rhymes with is Pro's, three lines of the same shape ("One platform. One
       workspace. Total collaboration"), so the two hero screens read as one
       family rather than as two arguments — the point being that Essentials runs
       the same software (rulings.ts) and the chassis is the only difference. The
       earlier draft ("Walk in. Share. Collaborate.") made the opposite bet:
       clipped imperatives about the person in the room, chosen precisely so it
       would sound nothing like Pro's. If that separation is wanted again, this
       is the line to revisit, and note that naming the chassis in the brightest
       position on the page is the thing "Same software. Smaller box." was
       rejected for. */
    lines: ["One Mini.", "One workspace."],
    /* The deck carries the platform argument in full; the title only gestures at
       it. The share ceiling is interpolated, not typed: it is a ruled figure
       (rulings.ts, TIERS.shares) and a ruled figure retyped into prose is the
       exact drift CLAUDE.md's "import the constant" rule exists to stop. Pro's
       deck says "Ten live sources" as a word; a numeral reads the same in a deck
       and comes from the ruling instead of from me. */
    dek:
      "The same workspace Pro runs, up to " +
      TIERS.shares.essentials +
      " live sources side by side, with web-join and cross-network sharing &mdash; in the chassis that fits a huddle room, a classroom, or a whole floor of standard rooms.",
    specHref: "/products/essentials/spec",
  },

  /* 24 frames of a full rotation, alpha throughout, so the scrub walks the
     chassis around rather than opening it up. The Pod's sequence is a zoom and
     this one is a spin, which is why the stage rows here are ports and panels —
     at frame 12 the reader is looking at the face of the device and by frame 24
     they are back at the rear plate. */
  zoom: { dir: "/products/pod-mini-zoom-alpha", count: 24 },

  stage: {
    ariaLabel: "Polaris Essentials, up close",
    alt: "Mersive Polaris Essentials pod",
    eyebrow: "Inside Polaris Essentials",
    title: "One Mini. The whole workspace.",
    /* The `at` values are Pro's, unchanged, because the choreography is the same
       and six rows is what the 0.52-to-0.845 span holds.

       Every value is the full-depth form the spec-detail rule requires
       (rulings.ts, SPEC_DETAIL_RULE, and scripts/check-specs.py): the port count
       with its generation and connector, the pixel dimensions behind "4K", the
       PHY part. A bare "4K30" and "gigabit Ethernet" are both dilutions of a
       fact stated in full in the tables further down this same page — which is
       exactly the failure the rule exists to stop, since a showcase is where the
       temptation to shorten is strongest.

       The share ceiling comes from TIERS rather than being typed here: the
       number is ruled, and a ruled number retyped into a page is a number that
       will drift away from the ruling. */
    rows: [
      { at: 0.52, ic: HIC.shares,  k: "Up to " + TIERS.shares.essentials + " simultaneous shares",
        v: "Composited live, side by side, laid out as sources join and leave — the same compositor Pro runs" },
      { at: 0.585, ic: HIC.hdmiout, k: "Single 4K30 output",
        v: "1× HDMI 2.0 out — 4K (4096 × 2160) at 30 Hz" },
      { at: 0.65, ic: HIC.net,     k: "Wired to the estate",
        v: "1× 10/100/1000 RJ-45 (Realtek RTL8211F gigabit PHY), no PoE" },
      { at: 0.715, ic: HIC.wifi,    k: "Wi-Fi 6 on board",
        v: "MediaTek MT7921: 802.11ax, a/b/g/n/ac/ax, 2.4 + 5 GHz, 2×2 MIMO" },
      { at: 0.78, ic: HIC.chip,    k: "4 GB · 32 GB eMMC",
        v: "MediaTek MT8370 (Genio 510): ARM SoC with Mali GPU" },
      { at: 0.845, ic: HIC.panel,   k: "The rear panel, in full",
        v: "Kensington Nano Security Slot, RJ-45, HDMI 2.0, DC power — no USB, no HDMI input, no audio out" },
    ],
  },

  headline: "The same platform your boardroom runs, in every room down the hall.",

  caps: {
    kicker: "What Essentials does",
    h2: "The whole workspace. Nothing to install.",
    sdek:
      "Essentials isn&rsquo;t a lite tier, and it isn&rsquo;t a reduced build: it runs <b>the same Polaris software as Pro</b>. Every difference between the two is the chassis, not the platform &mdash; memory sets the share ceiling at " +
      TIERS.shares.essentials +
      " instead of " +
      TIERS.shares.pro +
      ", and with no USB input there is no room camera to bridge, so wireless BYOM and Link are Pro capabilities rather than a licence away. Same workspace, same cloud, same security posture. Every capability below ships today.",
    /* Every one of these is a SOFTWARE capability, which is why all four read as
       plain statements rather than as anything qualified by tier: Essentials runs
       the same platform as Pro, and presenting a software capability as Pro-only
       is the thing rulings.ts rules out. Nothing on this grid is a lesser version
       of Pro's. */
    items: [
      {
        w: 7,
        ic: XIC.workspace,
        h: "The full multi-share workspace",
        p:
          "Live sources composited side by side on the display, compared, annotated, rearranged from any seat, laid out automatically as sources join and leave &mdash; up to " +
          TIERS.shares.essentials +
          " here, " +
          TIERS.shares.pro +
          " on Pro. The same workspace Pro runs, so a mixed estate is never a mixed experience.",
        href: "/solutions/collab",
        cta: "Why the workspace wins",
      },
      {
        w: 5,
        ic: XIC.webjoin,
        h: "Web-join: no app, no download",
        p: "Guests and staff share from the browser on the device they walked in with, Chromebooks included. No client, no admin rights, no dongle drawer.",
        href: "/platform/how",
        cta: "How web-join works",
      },
      {
        w: 7,
        ic: XIC.oneplat,
        /* Plain "&", not an entity: the card heading renders through {c.h}, which
           Astro escapes, so an entity here would reach the page as literal text. */
        h: "Native AirPlay, Miracast & Google Cast",
        p: "The casting paths your devices already speak, built in: Apple, Windows, and Chromebook users share natively on the LAN with zero Mersive software, and every share lands on the same workspace, side by side.",
        href: "/platform/how",
        cta: "How the casting paths work",
      },
      {
        w: 5,
        ic: XIC.cloudx,
        h: "Managed by Polaris Cloud",
        p: "Every Essentials room joins the same fleet pane as the rest of the estate: analytics, firmware, alerts, health, and idle-screen signage, from one login.",
        href: "/platform/cloud",
        cta: "Explore the cloud",
      },
    ],
  },

  security: {
    sdek: "Certifications scoped to a cloud say nothing about the box on the wall, so the box gets its own proof. Two outside firms have had it: one over the network, one with the lid off &mdash; and the smaller unit was in scope in its own right.",
    /* Every fact from the page's original security paragraph survives, including
       the part that is specific to this tier and is the reason the paragraph was
       worth restructuring rather than replacing with Pro's: the May 2025 physical
       assessment took a Gen 4 Pod AND a Gen 4 Pod Mini, and cleared both. An
       Essentials buyer is not being shown Pro's test result.

       Both [verify:] flags travel with the claim they qualify — the severity
       summary is not cleared for publication and the SOC 2 period is not issued
       — so initVerifyFlags must keep finding them here. Do not tidy the brackets
       away. */
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
        h: "Both units opened, probed, and both held",
        p: "The hardware went further than a scan, and the smaller unit was in scope in its own right: a firm took a Gen&nbsp;4 Pod <em>and</em> a Gen&nbsp;4 Pod Mini in hand, opened them and attacked the hardware: UART and JTAG on the debug headers, an attempt to lift the firmware off the flash, a lab man-in-the-middle. <b>No critical, high, medium or low-severity vulnerabilities were identified on either device.</b> Root login over the debug interface is refused outright, with no password prompt even offered; the firmware could not be extracted; and no personally identifiable information was found stored on either unit. [verify: confirm this severity summary may be cited publicly - CISO to release]",
      },
      {
        ic: RIC.taa,
        when: "On the device",
        h: "Secure boot, sealed keys, an allowlist and 802.1X",
        p: "Secure boot is mandatory on production firmware. The device&rsquo;s own identity keys are sealed into an NXP SE050 secure element &mdash; the same part as Pro. USB access is by allowlist. 802.1X with EAP-TLS makes the room a first-class citizen of your NAC rather than an exception in it.",
      },
      {
        ic: RIC.cert,
        when: "The company, and the cloud",
        h: "ISO/IEC 27001:2022 · SOC 2 Type 2",
        p: "Mersive is ISO/IEC 27001:2022 certified, with no nonconformities raised at the June 2026 surveillance audit, and the Polaris cloud this Essentials unit reports to is SOC 2 Type 2 attested. [2026 SOC 2 Type 2: swap in the period and opinion date when the auditors issue - CISO]",
      },
    ],
  },

  tier: "essentials",

  specs: {
    sdek: "The full network and security posture on the page, including what Essentials deliberately doesn't do. That candor is the point.",
    notes: [
      "The 10-year platform lifecycle, the invariants it holds constant, and the current silicon are documented once, on <a href=\"/products/pro/spec#platform-lifecycle\">the Pro spec sheet</a>. This page does not restate them: a fact stated twice is a fact drifting.",
      "Same transparency policy as Pro: silicon, RAM, and I/O published on the page. [Values pending hardware team sign-off.]",
      "[Complete spec set lands with the datasheet — every row stays open and inline at launch, limitations included.]",
    ],
  },

  /* Same three destinations and the same wording as the three hand-written
     anchors this replaced, [placeholder] flags included — the datasheet and the
     deployment guide are both still owed, and initVerifyFlags has to keep
     finding them. */
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
      p: "Network requirements, ports, 802.1x setup. [placeholder]",
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
