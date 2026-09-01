/* Shared security material: the document cards, and the security slice of the
 * comparison matrix.
 *
 * ── Why one module and two pages ─────────────────────────────────────────────
 * Two audiences arrive by different doors and neither should hit a dead end. A
 * security reviewer starts at the Trust Center and wants the documents there. An
 * IT administrator starts at the documentation hub and wants everything filed in
 * one library, security included. Both are right, so the same cards render in both
 * places from this list, and each page also carries a card pointing at the other.
 *
 * Duplicating the CONTENT would be the mistake — two lists drift, and the day they
 * disagree is the day a reviewer notices. One array, two render sites.
 *
 * The Trust Center stays at /platform/security. It is the page every existing link,
 * proposal and questionnaire answer already points at, and moving it to buy tidier
 * information architecture would break all of them for no reader's benefit.
 */
import { COMP } from "../data/compare";
import { SEC } from "../data/security";
/* cell() and esc() used to live in this file, and a near-identical second copy
 * lived in src/scripts/pages/compare.ts. They drifted. There is now exactly one
 * of each, in src/lib/matrix.ts, and both matrices render through it. */
import { cell, esc } from "./matrix";

export type SecDoc = {
  t: string;
  p: string;
  href: string;
  /** Marks the two items that genuinely cannot be published openly. */
  nda?: boolean;
};

/** Every security artefact and where it lives. Rendered on the Trust Center and on
 *  the documentation hub, from here, so the two can never disagree. */
export const SEC_DOCS: SecDoc[] = [
  {
    t: "ISO 27001 certificate (PDF)",
    p: `Certificate ${SEC.iso.cert}, ${SEC.iso.body}, issued ${SEC.iso.issued} and valid to ${SEC.iso.expires}. The scope sentence and the statement-of-applicability version are printed on the certificate itself, not summarised. [file to be attached]`,
    href: "/platform/security",
  },
  {
    t: "Surveillance audit result, June 2026",
    p: "The second annual surveillance audit closed with no nonconformities: seventeen clause areas and the Annex A control testing, every one assessed as design and operating effectiveness met, and nothing carried over from the prior year. [summary published; the report itself is the certification body's and is marked confidential, distributable at Mersive's discretion]",
    href: "/platform/security",
  },
  {
    t: "SOC 3 report (PDF)",
    p: "The general-distribution attestation: the auditor's opinion and the system description, with no NDA and no form. [file to be attached: SOC 3 2025, and the 2026 edition when the auditors issue]",
    href: "/platform/security",
  },
  {
    t: "SOC 2 Type 2 report",
    p: "The control-by-control test results, including the one exception and management's response. Carries test detail that is not ours alone to publish, so it goes out under NDA on request.",
    href: "/contact",
    nda: true,
  },
  {
    t: "Independent testing record",
    p: "Four engagements across 2025 and 2026: the application assessed annually against OWASP ASVS with no critical and no high-severity findings two years running, and a physical assessment of the Gen 4 Pod and Pod Mini with the hardware in hand that found nothing at any severity. Severity results and the assessor's caveats are on the Trust Center.",
    href: "/platform/security",
  },
  {
    t: "Full penetration-test reports",
    p: "The engagement reports behind those results. Available under NDA; the device report's severity summary is published openly because it carries no confidentiality marking.",
    href: "/contact",
    nda: true,
  },
  {
    t: "Framework mappings: NIST 800-171, HITRUST, HIPAA",
    p: "The SOC 2 report carries a control-by-control mapping to NIST SP 800-171 Rev. 2 as required by DFARS, a mapping to HITRUST CSF v11.5, and the HIPAA Security Rule administrative safeguards inside the audit opinion itself. Mappings, not separate certifications, and the page says so.",
    href: "/platform/security",
  },
  {
    t: "Security architecture narrative",
    p: "Boot chain, key custody in the secure element, network posture, data paths in transit, and what the cloud does and does not hold. Written to be read by a human and lifted into a proposal.",
    href: "/platform/security",
  },
  {
    t: "Data paths, ports and endpoints",
    p: "What transits, what stays on your LAN, and what never happens: the full endpoint and port inventory plus the recommended VLAN architecture, for the reviewer who would rather see the traffic than read about it.",
    href: "/resources/network",
  },
  {
    t: "Firmware changelog & update policy",
    p: "Every release publicly logged. Update packages are checked for authenticity and integrity before they apply and the device refuses a downgrade, so a known-vulnerable firmware cannot be put back on a Pod. Two firmware partitions mean a load that fails to come up returns to the last known-good version.",
    href: "/resources/firmware",
  },
  {
    t: "How our assurance compares, with sources",
    p: "Fifteen vendors, ten security questions, and every single cell carries the document it was graded from and the date we read it — click a cell and the source opens on the vendor's own site. Including the cells where a competitor beats us, and there are several.",
    href: "/compare",
  },
  {
    t: "Accessibility conformance (VPAT)",
    p: "VPAT / Accessibility Conformance Reports for the platform and for the Gen 4 hardware, written against WCAG 2.0, 2.1 and 2.2, Revised Section 508 and EN 301 549. Procurement teams in education, government and healthcare review accessibility alongside security, so it belongs here rather than in a footer. [files to be attached: MERSIVE_VPAT_Sept2025 and MERSIVE_GEN4_VPAT_Sept2025 - product and legal to confirm the public versions]",
    href: "/platform/security",
  },
  {
    t: "Vulnerability disclosure policy",
    p: "How to report something, how we respond, and how we credit you. [placeholder]",
    href: "/platform/security",
  },
];

/** The document cards, as HTML.
 *
 *  `self` is the route of the page doing the rendering. Cards whose destination IS
 *  that page still render — dropping them was the first attempt and it left the
 *  Trust Center's "every security document" section showing five of twelve, missing
 *  the testing record, which is the opposite of the point. They render as cards
 *  without a link, marked as being on the page already. Completeness is the whole
 *  job of this section; a card that quietly disappears depending on which door you
 *  came through defeats it. */
export function secDocCards(self = ""): string {
  /* PUBLIC vs CONTROLLED, split explicitly. Recommended by the Trust Center review
     (Trey Negrette, 13 Aug 2026) and taken: a reviewer should be able to see at a
     glance which documents they can take now and which need a request, rather than
     discovering the boundary one card at a time from an NDA badge.
     The badge stays as well — belt and braces, and it survives if these ever render
     in a context that drops the headings. */
  const card = (d: SecDoc) => {
    const badge = d.nda ? ' <span class="tag t-gated">NDA</span>' : "";
    const body = `<div><b>${d.t}${badge}</b><p>${d.p}</p></div>`;
    return d.href === self
      ? `<div class="cnv-door dxp" aria-current="page">${body.replace(
          "</p>",
          " <em>On this page.</em></p>"
        )}</div>`
      : `<a class="cnv-door dxp" href="${d.href}">${body}</a>`;
  };
  const grid = (docs: SecDoc[]) =>
    `<div class="cnv-doors" style="grid-template-columns:repeat(auto-fit,minmax(280px,1fr))">${docs
      .map(card)
      .join("")}</div>`;

  const open = SEC_DOCS.filter((d) => !d.nda);
  const controlled = SEC_DOCS.filter((d) => d.nda);

  return `<div class="kicker" style="margin-top:2px">Public trust documentation</div>
    <p class="note" style="margin:2px 4px 10px">Take these now. No form, no NDA, no sales conversation first.</p>
    ${grid(open)}
    <div class="kicker" style="margin-top:22px">Controlled documentation, on request</div>
    <p class="note" style="margin:2px 4px 10px">These carry control-by-control test detail that is not ours alone to publish, so they go out under NDA. Asking for them is a normal part of a security review and does not slow one down.</p>
    ${grid(controlled)}`;
}

/* ── The security slice of the comparison matrix ──────────────────────────────
   Rendered from COMP so there is exactly one set of grades in the codebase. The
   Trust Center shows the security group; the compare hub shows everything. If a
   grade changes it changes in both places because there is only one of it.

   Static HTML, built by src/lib/matrix.ts. This page was static first and the
   compare hub was not, which is the whole reason the two drifted; since 15 Aug
   2026 both render through the same cell() at build time. A security reviewer may
   well be reading with script restricted, and a table of evidence is the last
   thing on this site that should need JavaScript to appear. The hover cards still
   need script to be POSITIONED, which is what scripts/pwcard.ts does — without it
   the grades, the notes and the source links all still read, only the floating
   card stays hidden. */
/* WHAT EACH ROW IS ACTUALLY ABOUT — the company, or the device.
 *
 * Measured 15 Aug 2026, and it settled a question worth settling: is this table
 * competitor-specific or product-specific? Mostly product. Seven of ten rows are
 * properties of the box; three belong to the legal entity that sells it.
 *
 * The proof is inside the table. Barco appears twice, as ClickShare and as Hub —
 * same company, two products. Four rows match and six differ, and the four that
 * match are exactly the company-level ones. Barco's ISO certificate covers both
 * products. Nothing else does: Hub publishes no 802.1X statement, no device
 * assessment, no retrievable independent test and no TAA SKUs.
 *
 * Why label it on the page. A reader handed "ISO 27001 certified" naturally reads
 * it as a statement about the thing they are buying, and for twelve of the
 * fourteen vendors here it is not — the certificate belongs to the company and
 * stops there. Only Barco's and Zoom's name the product in scope. Marking the
 * rows makes that visible without accusing anyone of anything: a company
 * certificate is a real and useful thing, it is just not a product certificate.
 *
 * It also applies to us. Our own ISO and SOC rows are company rows too, and the
 * device rows are where the Gen 4 assessment does the work.
 */
const SCOPE: Record<string, "company" | "device"> = {
  "SOC 2 report on file": "company",
  "ISO 27001": "company",
  "Certification scope published: number, scope, issuing body and expiry all readable": "company",
};

/** The "Security & platform" group of the matrix, every column, sourced. */
export function secMatrix(): string {
  const grp = COMP.groups.find((g: any) => g.g === "Security & platform");
  if (!grp) return "";
  const brands: string[] = COMP.brands;
  /* COLUMN TOGGLING, added 15 Aug 2026 on Damian's instruction.
   *
   * Every column stays in the served HTML and is hidden with a class rather than
   * re-rendered. That matters more here than on the compare hub: the whole point
   * of this table is that 140 sourced statements are retrievable, and a scraper,
   * an answer engine or a reader with script off must still get all of them. A
   * picker that rebuilt the table would leave thirteen columns of evidence
   * existing only after a click.
   *
   * So the markup is complete and static, and the picker is presentation. */
  const pick =
    `<div class="pick secpick" role="group" aria-label="Choose which vendors to show">` +
    `<button class="on" type="button" data-sec="all" aria-pressed="true">Everyone</button>` +
    `<button type="button" data-sec="none" aria-pressed="false">Just Polaris</button>` +
    brands
      .map(
        (b, i) =>
          `<button class="on" type="button" data-sec="${i}" aria-pressed="true">${esc(b)}</button>`
      )
      .join("") +
    `</div>`;

  let h = `${pick}<div class="cmpscroll"><table id="sectable"><tr><th scope="col">Security question</th><th scope="col">Polaris</th>${brands
    .map((b, i) => `<th scope="col" class="cb cb-${i}">${b}</th>`)
    .join("")}</tr>`;
  for (const [lbl, vals] of grp.rows as [string, string[]][]) {
    const sc = SCOPE[lbl] === "company" ? "company" : "device";
    const tip =
      sc === "company"
        ? "A company-level row: the certificate belongs to the vendor as an organisation, and may or may not name this product in its scope."
        : "A device-level row: a property of the room device itself, not of the company that sells it.";
    h += `<tr><td>${lbl} <span class="scp scp-${sc}" title="${tip}">${sc}</span></td>${cell(vals[0], lbl, "Polaris", undefined, "s")}${brands
      .map((b, i) => cell(vals[i + 1], lbl, b, i, "s"))
      .join("")}</tr>`;
  }
  return (
    h +
    `</table></div>
    <p class="note cmplegend" style="margin:10px 4px 0">
      <b>How to read this table.</b>
      <span class="lg"><i class="lg-y">&#10003;</i> published evidence found.</span>
      <span class="lg"><i class="lg-p">partial</i> published evidence found, and qualified.</span>
      <span class="lg"><i class="lg-n">&mdash;</i> we looked and found no published evidence.</span>
      Each row is tagged <i class="scp scp-company">company</i> or <i class="scp scp-device">device</i>:
      a company row asks what the vendor as an organisation holds, a device row asks what the box in
      the room does. Of the fourteen vendors here, two publish a company certificate whose scope
      names the product.
      A dash is a statement about what a vendor publishes, not about what their product can do:
      a feature may well exist and simply not be documented anywhere a buyer can check. Cells with
      a tint carry the reasoning, the source document and the date we read it &mdash; hover to
      preview, <b>click to pin the card open</b>, then click through to the source.
    </p>`
  );
}
