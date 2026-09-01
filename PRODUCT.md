# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**The technical reader sets the depth.** AV/IT integrators, IT decision-makers
and engineers evaluating a room platform. They judge on mechanism and spec, not
on adjectives, and they arrive expecting to be sold to. Depth is what earns them.

**Machine readers are a first-class audience, not a channel.** Confirmed by
Damian Blazy, 15 Aug 2026. AI answer engines, LLM assistants, search crawlers,
and agents doing procurement research on a buyer's behalf are readers this site
is written for. This is already load-bearing in the codebase rather than
aspirational — `scripts/check-outline.py` fails a build whose heading outline an
answer engine cannot walk, and `security-hub.ts`, `secpick.ts`, `global.css` and
`pages.css` each carry the rule that content hidden behind a click is content an
answer engine cannot retrieve.

Also served, none of them outranked by the others:

- existing Mersive Solstice customers weighing the Gen 3 → Polaris transition;
- channel partners, resellers and integrators who position and quote Polaris;
- regulated verticals already on the site — education, government, healthcare,
  finance — who read the Trust Center before they read the product page.

## Product Purpose

The marketing site for Mersive Polaris, and the vehicle for Mersive's return to
the market. Mersive's marketing has not been present for years; this site is the
release of a new product, the introduction of a product-family brand, and a
deliberate strong entrance. It is not a refresh of an existing presence.

Four success conditions, all confirmed and all real:

1. **Cited accurately by answer engines** — an assistant answering "how does
   Polaris handle X" returns this site's facts with the rulings intact: the tier
   story, both warranty cases, the parity exception.
2. **Booked demos** — `/demo`.
3. **Self-serve trial starts** — `/trial`.
4. **Qualified into the buying process** — the reader reaches `/how-to-buy`,
   `/contact` or a partner already understanding tiering, licensing and the
   procurement path.

## Positioning

**The honest information broker: deeply technical, and the only software-focused
solution in a hardware world.** Damian Blazy, 15 Aug 2026.

Three things that claim commits to, each of which a hardware-tiering competitor
could not truthfully copy:

- **Honest.** Publish the mechanism and publish the limit. The Trust Center is
  readable with no NDA, no form and no sales call. The wired-ingest exception to
  meeting parity is stated where parity is promised. A page whose claims outrun
  the product is held rather than shipped (`/solutions/government`), and drift
  detection was removed site-wide rather than defended.
- **Software-focused.** Essentials and Pro run the same software. Every
  capability difference traces to the Mini chassis — memory sets the practical
  share ceiling, and no USB host means no Link and no true wireless BYOM. The
  buyer is not being sold a crippled product; they are being sold the same
  product in a smaller box.
- **Deeply technical.** The depth is the position. A spec, a boot chain and a
  ten-year TCO model are the argument, not the appendix to one.

## Operating Context

- Fully static Astro 7 + Tailwind v4 build, one pre-rendered page per route.
  Every hash route from the v1.95 single-file POC is now a real page.
- **The sources contradict each other.** The site is assembled from a PRD, two
  released data sheets, a firmware requirements spec, a third-party device
  assessment, an ISO certificate, a SOC report and 45 ported blog posts.
  `src/data/rulings.ts` is the decision about what the site says when they
  disagree, and it outranks every source document.
- Damian is project owner and primary contributor, working on `main`. Everyone
  else works on a branch with its own private preview and reaches `main` by
  manual merge or PR. Claude Cowork is the primary editing interface for all
  contributors.
- Correctness is enforced at build time, not by review habit: `check-specs`,
  `check-warranty`, `check-outline`, `check-claims`, `check-blocked`,
  `check-sources`, `check-provenance`, `check-static-evidence`, `check-figures`.
- Open roles are fetched from Mersive's Rippling ATS at build time and fail soft;
  applications never touch this site.
- The build is pre-launch and says so on every page: the gold POC banner, pink
  page-ID chips, yellow `[verify:]` flag highlights and the `/404` link box are
  temporary and come out at production launch.

## Capabilities and Constraints

- **`rulings.ts` is the authority.** Import the constant, never retype the value.
  A source document that contradicts a ruling loses. A conflict the file does not
  cover goes to Damian — guessing is the failure this file exists to prevent.
- **Machine readability is a build constraint, not an enhancement.** The heading
  outline must be walkable, and every fact must survive the page being flattened
  to text with script off. A fact that exists only after a click does not exist.
- **Structured data must not exceed what the page shows.** No `Product` offers
  while MSRP is pending committee sign-off; no invented postal address or
  `contactPoint`; a mistyped route key is a type error by design.
- **Never fabricate.** No invented testimonials, customers, benchmarks, pricing,
  licensing or deployment claims — the enforcement scripts exist because this has
  happened.
- `/solutions/government` is held until private-cloud deployment ships: Polaris
  has no on-premises or air-gapped posture today.
- Route and Engage ship Q1 2027 and come out of the September early publish;
  every mention carries `al-flag` (a historical class name — see AGENTS.md).
- Engage is the engagement layer split out of Route on 25 Aug 2026: polling,
  quizzing and participation records, sold separately. Its ship date is Q1 2027
  pending confirmation, and its packaging — subscription, bundled with Pro, or an
  Essentials upcharge — is an open commercial call and publishes as a placeholder.
- Lead-capture forms are styled mocks with real validation until the HubSpot
  portal ID and form GUIDs are pasted in.
- AI crawlers are addressed deliberately: `robots.txt` carries named groups for
  the answer engines and separate training-use tokens, and `llms.txt` is a
  plain-language index of the site. Citation and model training are separate
  levers; both are allowed today, and turning training off is Damian's call.
- **Launch target:** this becomes the public marketing presence at
  `www.mersive.com` — the canonical origin already hard-coded in `schema.ts` and
  in the production state of `robots.txt` — staged through the September early
  publish. Crawler blocking is preview-only: production builds carry none, and
  `pnpm check:indexable` fails the build if any of it leaks through.

## Brand Commitments

- Names: Mersive, Mersive Polaris, Mersive Solstice. Family: Pro, Essentials,
  Element, Link, Host, Route, Engage.
- Customer-story copy is verbatim from source. A case study quoting a customer is
  not a place to take liberties with their words, including for house style.
- Voice: mechanism first, and the cost stated in the same breath as the benefit —
  the cable to the table on Host + Essentials, the wired-ingest exception to
  parity. The trade-off routes the buyer to the right product rather than costing
  the sale.
- Phrases banned in code and enforced by script: bare "for life", "no rollback"
  and "rollback protection", and the "drift detection" family.

## Evidence on Hand

- Thirteen published customer stories (`src/data/cases.ts`), with pre-rendered
  white marks in `public/cases/`.
- ISO/IEC 27001:2022, certificate 011964-03, valid to 26 June 2028. June 2026
  surveillance audit raised no nonconformities.
- SOC 2 Type 2 for the Polaris cloud, with HIPAA Security Rule administrative
  safeguards inside the same opinion and a NIST SP 800-171 mapping in the report.
  The 2026 period and opinion date are pending the auditors — CISO to supply.
- July 2026 third-party assessment against OWASP ASVS 5.0.0: no critical and no
  high-severity findings. A separate physical assessment of the Gen 4 Pod and Pod
  Mini, hardware in hand, found no vulnerabilities at any severity and no PII
  stored on either device. Public citation of the device severity summary is
  pending CISO release.
- Released data sheets DS-MCS.PRO-05072025 and DS-MCS.ESS-02192025. Dated on
  warranty and to be reissued; the site does not follow them down.
- Forty-five ported blog posts and a live Rippling job board.
- **Absent — future work must not invent these:** postal address or contact
  point, final MSRP, any on-premises or air-gapped posture, drift detection, and
  any published accessibility conformance statement.

## Product Principles

1. **The mechanism is the pitch.** Explain how it works and let the buyer decide.
   Depth is the differentiator, not the barrier to one.
2. **State the limit in the same breath as the claim.** The trade-off is what
   makes everything next to it credible, and it routes the buyer correctly.
3. **One platform, two chassis.** Never present a software capability as a tier
   gate. Ports are ports; they are stateable as what they are.
4. **Write for the human reader and the machine reader at once.** If a fact is
   lost when the page is read with script off or flattened to its outline, the
   surface is wrong — not the reader.
5. **A ruling in version control beats a plausible reading of a document.** When
   the sources disagree and no ruling covers it, ask. Do not pick.

## Accessibility & Inclusion

**Open decision — no conformance target has been set.** Do not publish a WCAG
level, a VPAT or any conformance claim until Damian or legal rules on it; an
unbacked accessibility claim is exactly the class of fabrication the rest of this
file guards against. Education and government verticals are live on the site, so
a procurement requirement is plausible and worth settling.

Existing engineering practice, absent a target: `prefers-reduced-motion` is
honored in `global.css` and `site.ts`, and script-off retrievability is enforced
site-wide for the machine audience — which carries most of the same benefit.
