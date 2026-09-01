/* Compliance spine shared by the regulated-industry family.
   Extracted verbatim from the v1.95 single-file POC. */

import { RIC, XIC } from "./icons";

/** [iconSvg, heading, body, route?] */
export const REG_SPINE: [string, string, string, string?][] = [
  [XIC.shieldx,"Security in the open","The full architecture (boot chain, network posture, data paths, update policy) published in the Trust Center. No NDA, no form, no sales call to read it.","platform/security"],
  [RIC.taa,"TAA + secure boot","Trusted, TAA-compliant supply chain with a verified boot path: the device that powers on is the device we shipped, running only firmware we signed."],
  [RIC.os,"Linux-hardened OS","Purpose-built, minimized Linux at the display: no Windows attack surface, no general-purpose OS moonlighting as a meeting room."],
  [RIC.cert,"Audited, not asserted","ISO/IEC 27001:2022 certified (certificate 011964-03, valid to 26 June 2028), and the June 2026 surveillance audit raised no nonconformities: every clause and the Annex A control testing came back met. SOC 2 Type 2 attested for the Polaris cloud, with the HIPAA Security Rule administrative safeguards inside the same opinion and a NIST SP 800-171 mapping published in the report. [2026 SOC 2 Type 2: swap in the period and opinion date when the auditors issue - CISO]"],
  /* Added Aug 2026. The pen-test record is now the best-evidenced claim we hold and
     it was buried inside the certification bullet, where a reviewer scanning for
     product-level assurance would never find it. It earns its own line: a
     certification scoped to the cloud cannot speak for the box on the wall, and this
     can. */
  [RIC.probe,"Attacked by outsiders","A third party assesses the platform every year: the July 2026 assessment ran against OWASP ASVS 5.0.0 and returned no critical and no high-severity findings. The room hardware is tested in its own right rather than covered by a certificate scoped to the cloud — a physical device assessment of the Gen 4 Pod and Pod Mini, with the hardware in hand, identified no vulnerabilities at any severity, and no personally identifiable information was found stored on either device. [verify: confirm the device severity summary may be cited publicly - CISO to release]"],
  [RIC.fw,"Behind your firewall","Same-network sharing stays on your LAN, peer to peer. [verify: the on-prem question is NOT pending &mdash; Damian Blazy resolved it 13 Aug 2026 by blocking /solutions/government until private-cloud deployment ships, because Polaris has no on-premises or air-gapped posture today: a pod cannot activate, license, configure, share or update without Mersive's cloud. This placeholder says the answer is coming, which contradicts his own ruling and does it on four industry pages. Rewrite it from what private cloud actually delivers when it ships, or cut the row - Damian and product]"]
];
