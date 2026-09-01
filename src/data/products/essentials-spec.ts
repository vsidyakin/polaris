/**
 * /products/essentials/spec — content of the printable spec sheet.
 *
 * Rendered by layouts/SpecSheet.astro. The masthead, h1, parent breadcrumb and
 * saved-from stamp are derived there from `tier` and `route`. The two spec
 * table groups, the tier comparison and the upsell band stay as markup in the
 * page, in named slots: every row carries its own citation and several carry
 * [verify:] flags that scripts/check-claims.py looks for.
 */
import { XIC } from "../icons";
import type { SpecSheetData } from "./types";

export const ESSENTIALS_SPEC: SpecSheetData = {
  route: "products/essentials/spec",
  tier: "Polaris Essentials",
  dek: "Wireless screen sharing for every room: the full multi-share workspace at the tier most rooms actually need. Standard meeting rooms, classrooms, huddle spaces, and every estate where the room has to run itself.",

  overview: {
    h2: "Not a lite tier. The full platform, scoped to rooms that share.",
    sdek: "Polaris Essentials brings wireless collaboration to enterprises, small businesses, clinics, and educational institutions without asking anyone to install anything. The compact Essentials appliance shares content from any device to the display, turns idle screens into digital signage, and joins the rest of your estate in Polaris Cloud, so every Essentials room is managed from the same pane as everything else. What Essentials deliberately doesn't do is conference: rooms that share get the whole workspace at the right price, and the rooms where meetings need hosting step up to Pro on the same platform.",
    caps: [
      { ic: XIC.workspace, h: "The full multi-share workspace",
        p: "Up to 5 live sources composited side by side, compared, annotated, and rearranged from any seat, laid out automatically as sources join and leave. The same workspace Pro runs, so a mixed estate is never a mixed experience." },
      { ic: XIC.webjoin, h: "Web-join: no app, no download",
        p: "Guests and staff share from the browser on the device they walked in with, Chromebooks included. No client, no admin rights, no dongle drawer. The URL on the display is the entire onboarding." },
      { ic: XIC.oneplat, h: "Native AirPlay, Miracast &amp; Google Cast",
        p: "The casting paths your devices already speak, built in. Apple, Windows, and Chromebook users share natively on the LAN with zero Mersive software, and every share lands on the same workspace, side by side." },
      { ic: XIC.crossnet, h: "Cross-network sharing",
        p: "Guests on LTE, staff on corporate Wi-Fi, the display on an AV VLAN: one workspace, no VPN. Signaling is outbound-only TLS on TCP 443, so there are no inbound firewall rules to request. Included on every Polaris tier." },
      { ic: XIC.cloudx, h: "Managed by Polaris Cloud",
        p: "Every Essentials room joins the same fleet pane as the rest of the estate: analytics, firmware, alerts, health, and idle-screen signage, from one login." },
      { ic: XIC.devicefree, h: "Mobile sharing",
        p: "The Polaris app for iOS and Android: share your screen, photos, or a live whiteboard, and control the workspace from your seat." },
    ],
  },

  specsH2: "Polaris Essentials hardware",

  security: "Secure boot is mandatory on production firmware, which runs a purpose-built, minimized Linux: no Windows attack surface, no general-purpose desktop. 802.1X network authentication lets an Essentials room prove itself to your NAC with a certificate exactly as a Pro room does. In May 2025 an outside security firm took a Gen&nbsp;4 Pod <em>and</em> a Gen&nbsp;4 Pod Mini in hand &mdash; the smaller unit in scope in its own right &mdash; opened them, and attacked them physically: the debug headers, the flash, and a lab man-in-the-middle. <b>No critical, high, medium or low-severity vulnerabilities were identified on either device.</b> Their caveat, which we keep: that does not make compromise impossible, but it would take an adversary of significant skill and effort. [verify: confirm this severity summary may be cited publicly - CISO to release. Damian ruled 12 Aug 2026 that it stays on this sheet with the flag on it for CISO review] [verify: confirm the Gen&nbsp;4 Pod Mini &rarr; Polaris Essentials mapping before this sheet attributes the result to Essentials - hardware team] Mersive&rsquo;s information security management system is ISO/IEC 27001:2022 certified, with no nonconformities raised at the June 2026 surveillance audit, and the Polaris cloud this unit reports to is SOC 2 Type 2 attested. The full architecture and every scope statement: <a href=\"/platform/security\">the Trust Center</a>.",
};
