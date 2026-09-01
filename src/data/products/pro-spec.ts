/**
 * /products/pro/spec — content of the printable spec sheet.
 *
 * Rendered by layouts/SpecSheet.astro. The masthead, h1, parent breadcrumb and
 * saved-from stamp are derived there from `tier` and `route`. The two spec
 * table groups, the tier comparison and the upsell band stay as markup in the
 * page, in named slots: every row carries its own citation and several carry
 * [verify:] flags that scripts/check-claims.py looks for.
 */
import { XIC } from "../icons";
import type { SpecSheetData } from "./types";

export const PRO_SPEC: SpecSheetData = {
  route: "products/pro/spec",
  tier: "Polaris Pro",
  dek: "The deep end of the platform: full workspace, true wireless BYOM, HDMI input and dual 4K60 output, built for enterprise networks and the rooms where decisions actually get made.",

  overview: {
    h2: "Performance is not optional. It's a requirement.",
    sdek: "Polaris Pro is built for modern enterprises, higher education institutions, and healthcare organizations. Dual 4K60 HDMI output, HDMI input, PoE+ single-cable install, and enterprise 802.1X networking carry critical board meetings and collaborative classrooms alike, and the room's own silicon does the compositing, so nobody's laptop is load-bearing.",
    caps: [
      { ic: XIC.workspace, h: "The multi-share workspace",
        p: "Up to 10 live sources composited side by side, compared, annotated, and rearranged live, laid out automatically as sources join and leave. Essentials runs the same workspace with a ceiling of 5." },
      { ic: XIC.devicefree, h: "True wireless BYOM",
        p: "Your Teams, Zoom, Webex, or Meet call with the room's camera and mic. No cable on the table, and multi-user, so the second presenter never waits for a dongle." },
      { ic: XIC.crossnet, h: "Cross-network sharing",
        p: "Guests on LTE, staff on corporate Wi-Fi, the display on an AV VLAN: one workspace, no VPN, no UC call. Signaling is outbound-only TLS on TCP 443, so there are no inbound firewall rules to request. Included on every Polaris tier." },
      { ic: XIC.webjoin, h: "Web-join: nothing to install",
        p: "Share from the browser on the device you walked in with, Chromebooks included. No client, no admin rights, no dongle drawer." },
      { ic: XIC.oneplat, h: "Native AirPlay, Miracast &amp; Google Cast",
        p: "The casting paths your devices already speak, built in. Every share lands on the same workspace, side by side." },
      { ic: XIC.cloudx, h: "Managed by Polaris Cloud",
        p: "Analytics, firmware, alerts, health, and idle-screen signage across the fleet, from one login, with multi-organization management." },
    ],
  },

  specsH2: "Polaris Pro hardware",

  security: "Secure boot is mandatory on production firmware. The device&rsquo;s own private keys are generated and used inside an NXP SE050 secure element and never cross its boundary. Customer 802.1X certificate material is held in the device&rsquo;s certificate store, protected by secure boot and the hardened OS. [verify: corrected 13 Aug 2026 from firmware source - customer 802.1X certificates are written to the device certificate store and the private-key password is held as a NetworkManager system secret, so they are NOT sealed in the secure element - engineering and CISO] Update packages are checked for authenticity and integrity before they are applied, and the device refuses downgrades. The pod also keeps two firmware partitions, so a load that fails to come up returns to the last known-good version. Shared content is composited on the fly rather than written to the device, and ephemeral session data is overwritten at the end of every session. In May 2025 an outside security firm took a Gen&nbsp;4 Pod in hand, opened it, and attacked it physically: the debug headers, the flash, and a lab man-in-the-middle. <b>No critical, high, medium or low-severity vulnerabilities were identified.</b> Their caveat, which we keep: that does not make compromise impossible, but it would take an adversary of significant skill and effort. [verify: confirm this severity summary may be cited publicly - CISO to release. Damian ruled 12 Aug 2026 that it stays on this sheet with the flag on it for CISO review] Mersive&rsquo;s information security management system is ISO/IEC 27001:2022 certified, with no nonconformities raised at the June 2026 surveillance audit, and the Polaris cloud this unit reports to is SOC 2 Type 2 attested. The full architecture and every scope statement: <a href=\"/platform/security\">the Trust Center</a>.",
};
