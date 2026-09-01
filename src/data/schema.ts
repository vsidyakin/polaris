/* Structured data (JSON-LD) per route.
   Mirrors seo.ts: a registry keyed by route, resolved once in BaseLayout.

   Everything here is emitted as a single schema.org @graph per page. Nodes carry
   stable @ids so they can reference each other instead of repeating themselves —
   the Organization is described once and pointed at from everywhere else.

   Rule of thumb when adding entries: structured data must describe what a visitor
   actually sees on the page. Markup that claims more than the page shows is what
   gets a site's rich results pulled, so placeholder copy and pending figures stay
   out of here until the page carries them for real. */

import { NAV } from "./nav";
import { PAGE_TITLES } from "./page-titles";
import type { Route } from "./routes";
import type { Author } from "./authors";
import { ESSENTIALS_OUTPUT, TIERS, WARRANTY } from "./rulings";
import type { Job } from "../lib/rippling";

/** Absolute production origin. Node @ids are stable identifiers, not fetchable
    URLs, so they stay on the canonical domain even in preview builds — otherwise
    every deploy would mint a different identity for the same organisation. */
const ORIGIN = "https://www.mersive.com";

export const ORG_ID = `${ORIGIN}/#organization`;
export const SITE_ID = `${ORIGIN}/#website`;

/* Only verified facts. Postal address and contactPoint are deliberately absent:
   no address is published anywhere on the site, and inventing one to fill the
   schema would put a wrong NAP into the entity graph. Add them here once
   marketing confirms the wording. */
const ORGANIZATION = {
  "@type": "Organization",
  "@id": ORG_ID,
  name: "Mersive Technologies",
  url: `${ORIGIN}/`,
  description:
    "Mersive builds Polaris, a wireless collaboration platform that turns any display into a shared workspace.",
  sameAs: ["https://www.linkedin.com/company/mersive/", "https://www.youtube.com/@mersive"],
};

const WEBSITE = {
  "@type": "WebSite",
  "@id": SITE_ID,
  url: `${ORIGIN}/`,
  name: "Mersive",
  publisher: { "@id": ORG_ID },
  inLanguage: "en-US",
};

/* ── Referring to another page on this site ───────────────────────────────────
   Every URL and @id below is built from ORIGIN rather than from the build's own
   canonical, for the reason given at ORIGIN: an @id is an identifier, and a
   preview deploy must not mint a second identity for the same product. It also
   means a node can reference the WebPage node of a *different* route — the docs
   hub, a spec sheet — and the reference resolves in the production graph.

   Names come from PAGE_TITLES, so a reference cannot drift from the page it
   points at: rename the page and the reference renames itself. */

const routeUrl = (route: Route) => `${ORIGIN}${route === "home" ? "/" : `/${route}`}`;

/** The @id buildGraph mints for a route's WebPage node in a production build. */
const webPageId = (route: Route) => `${routeUrl(route)}#webpage`;

const pageRef = (route: Route) => ({
  "@type": "WebPage",
  "@id": webPageId(route),
  url: routeUrl(route),
  name: PAGE_TITLES[route],
});

/* ── The platform, as one SoftwareApplication ─────────────────────────────────

   Polaris is software that happens to arrive on hardware, and the site was
   describing only the hardware. This node is the software: one entity, declared
   once on /platform/how — the platform overview page — and referenced by @id from
   each hardware Product so the graph says "this box runs that platform" instead
   of describing the platform three more times in three different ways.

   WHAT IS DELIBERATELY ABSENT, and why each one is a decision rather than an
   omission to be tidied up later:

   `offers`. Same rule as the Product nodes below: MSRP is on the page, its
   published presentation is still pending legal review, and a price in structured
   data is a price Google will surface. Google also needs `offers` (or an
   aggregateRating) for a SoftwareApplication rich result, so this node is
   knowledge-graph input rather than a rich-result candidate. That is the right
   trade until the numbers are signed off.

   `screenshot`, and any `image`. There is no product screenshot or official
   platform image in the repository — the workspace figures on the platform pages
   are inline SVG drawn by lib/blocks.ts, and public/og-default.png is a generated
   placeholder card. A schema image should be an image the page actually shows, so
   this waits for real artwork rather than pointing at a placeholder.

   NATIVE CASTING is missing from `featureList` on purpose, and it is the most
   interesting absence here. AirPlay, Miracast and Google Cast are on the product
   pages as shipping capabilities carrying an open [verify:] flag: both released
   data sheets list the protocol set as WebRTC, AirPlay and Miracast, with no
   Google Cast. Under SPEC_DETAIL_RULE a surface that drops the flag is not a
   shorter version of the claim but a stronger one, and structured data has nowhere
   to put a flag — so the honest options are to state it unflagged to Google or not
   at all. It publishes when engineering closes the flag. */

export const POLARIS_ID = `${ORIGIN}/platform/how#polaris`;

/** The Blog node on /resources/blog, referenced by every post. */
export const BLOG_ID = `${ORIGIN}/resources/blog#blog`;

const POLARIS_PLATFORM = {
  "@type": "SoftwareApplication",
  "@id": POLARIS_ID,
  name: "Mersive Polaris",
  url: routeUrl("platform/how"),
  applicationCategory: "BusinessApplication",
  applicationSubCategory: "Collaboration and wireless presentation software",
  description:
    "A cloud-managed wireless collaboration platform that turns any display into a shared workspace: every source composited live side by side, joined from a browser with nothing to install, reachable across networks, and managed as one fleet from Polaris Cloud.",
  publisher: { "@id": ORG_ID },
  provider: { "@id": ORG_ID },
  /* Accurate rather than aspirational. There is no Polaris desktop client — the
     browser is the client, which is the whole point of web-join — so the desktop
     platforms are named as browser hosts and only the mobile apps are named as
     apps. The retired Mersive Solstice desktop app belongs to Gen 3 and is not
     this application. */
  operatingSystem:
    "Any operating system with a current web browser (Windows, macOS, ChromeOS, Linux); iOS and Android for the Mersive Polaris mobile app",
  browserRequirements:
    "A current desktop or mobile web browser. No client, no download, no admin rights.",
  availableOnDevice: "Mersive Polaris Pro and Mersive Polaris Essentials room hardware",
  featureList: [
    "Browser sharing: join at app.mersive.com with the key on the display and share from the device you walked in with — no app, no download, no admin rights.",
    `Multi-share workspace: live sources composited side by side and laid out automatically as sources join and leave, with a practical ceiling of around ${TIERS.shares.essentials} sources on Polaris Essentials and around ${TIERS.shares.pro} on Polaris Pro — memory on the chassis, not a licence.`,
    "Cross-network sharing: sources on another subnet, VLAN or the public internet reach the room over a cloud-negotiated direct connection. Signalling is outbound-only TLS on TCP 443, so there is no VPN and no inbound firewall rule.",
    "Meeting parity: every source in the workspace is delivered to remote participants in the browser, laid out by the same code that lays out the room.",
    "Cloud management: one admin plane for the estate — configuration templates, firmware, analytics, alerts, health and idle-screen signage. Editing a template re-applies it to every device assigned to it.",
    "Wireless BYOM on Polaris Pro: the room's own camera and microphone attach to the pod and are bridged into a Teams, Zoom, Webex or Meet call brought in from a laptop.",
  ],
  softwareHelp: [pageRef("resources/docs"), pageRef("resources/support")],
  inLanguage: "en-US",
  mainEntityOfPage: { "@id": webPageId("platform/how") },
};

/* ── The hardware, as Product nodes ───────────────────────────────────────────

   One node per orderable offering, connected to the platform above by @id. Three
   things about their shape are deliberate:

   NO `offers`, ON ANY OF THEM. The MSRP figures on the product and solutions pages
   are published, but their presentation is still marked pending legal review on the
   page itself, and a price in structured data is a price Google will surface and
   price-match against. Add offers when the figures are signed off — the numbers are
   already in data/pricing.ts, so it is an `offers` block here and nothing else.

   NO `sku` or `mpn`. No order code or manufacturer part number is published
   anywhere on this site; the part numbers the Pro page advertises are component
   parts (MT8395, SE050) and the DS-MCS.* strings are data-sheet document numbers,
   neither of which is a product identifier. Inventing one would put a wrong
   identifier into the entity graph, which is the `Organization` postal-address
   problem again.

   CAPABILITIES COME FROM `rulings.ts`, not from the spec tables. Every value in
   `additionalProperty` below is either a ruled constant or is derived from one, so
   the graph cannot drift from the ruling the way a retyped spec row can. This
   matters more here than elsewhere, because scripts/check-specs.py pairs spec rows
   across the product pages and the printable sheets — it does not read this file,
   so a hand-typed spec here would be the one copy nothing checks. Values carrying
   an open [verify:] flag on the page stay out entirely, for the reason given above
   the platform node. */

function productNode(p: {
  route: Route;
  name: string;
  category: string;
  description: string;
  /** Rooted path to a real product image, absent until one exists. */
  image?: string;
  /** Confirmed, visible capabilities as label/value pairs. */
  capabilities?: [string, string][];
  /** Pages a buyer is sent to from this one: spec sheet, docs, support. */
  documentation?: Route[];
}): object {
  return {
    "@type": "Product",
    "@id": `${routeUrl(p.route)}#product`,
    name: p.name,
    url: routeUrl(p.route),
    brand: { "@id": ORG_ID },
    category: p.category,
    description: p.description,
    ...(p.image ? { image: `${ORIGIN}${p.image}` } : {}),
    ...(p.capabilities?.length
      ? {
          additionalProperty: p.capabilities.map(([name, value]) => ({
            "@type": "PropertyValue",
            name,
            value,
          })),
        }
      : {}),
    /* The hardware runs the platform. `isRelatedTo` is the edge Google follows
       between two commercial entities; the reverse direction is stated on the
       platform node as `availableOnDevice`, which is plain text and so cannot
       disagree with this. Neither node repeats the other's description. */
    isRelatedTo: { "@id": POLARIS_ID },
    ...(p.documentation?.length ? { subjectOf: p.documentation.map(pageRef) } : {}),
    mainEntityOfPage: { "@id": webPageId(p.route) },
  };
}

/* Nav menus are dropdowns, not pages, so most have no URL of their own. A
   BreadcrumbList item that is not the last one must carry an `item` URL to be
   valid, so a section only becomes a crumb when it has a real hub page behind
   it. Sections absent from this map collapse to Home → page. */
const SECTION_HUB: Record<string, Route> = {
  Products: "products/family",
  Compare: "compare/hub",
};

/**
 * Per-route nodes, merged into the graph after the sitewide ones.
 *
 * `Partial<Record<Route, …>>` rather than `Record<string, …>` on purpose: a
 * mistyped route key becomes a `pnpm check` failure instead of an entry that
 * silently never renders.
 */
export const SCHEMA: Partial<Record<Route, object[]>> = {
  /* The home page states the four product areas as a visible band of four
     linked cards, so an ItemList naming them is a description of what the page
     renders rather than a claim layered on top of it — which is the test every
     node in this file has to pass.

     It is an ItemList of PAGES, not of products: three of the four resolve to
     use-case pages and the fourth to Polaris Cloud, and none of them is a thing
     with a SKU. The product entities live on products/pro, products/essentials
     and products/element and are referenced by @id from products/family; that
     is a different list and it should not be conflated with this one.

     No offers and no prices here, for the same reason as everywhere else in
     this file: MSRP presentation is still pending sign-off, and a price in
     JSON-LD is a price Google will surface.

     The home page still gets no BreadcrumbList — see the note in breadcrumb()
     below. A trail consisting only of "Home" describes nothing. */
  home: [
    {
      "@type": "ItemList",
      name: "What Mersive Polaris does",
      description:
        "The four product areas Polaris covers: wireless collaboration and screen mirroring, hybrid meetings, digital signage and fleet management.",
      itemListOrder: "https://schema.org/ItemListOrderAscending",
      numberOfItems: 4,
      itemListElement: (
        [
          ["solutions/collab", "Wireless collaboration & screen mirroring"],
          ["solutions/hybrid", "Hybrid meetings: BYOD, BYOM, BYOM+"],
          ["solutions/signage", "Digital signage"],
          ["platform/cloud", "Fleet management"],
        ] as [Route, string][]
      ).map(([route, name], i) => ({
        "@type": "ListItem",
        position: i + 1,
        name,
        url: routeUrl(route),
      })),
    },
  ],

  /* The platform overview page owns the software entity for the whole site. */
  "platform/how": [POLARIS_PLATFORM],

  "products/pro": [
    productNode({
      route: "products/pro",
      name: "Mersive Polaris Pro",
      category: "Wireless presentation and conferencing system",
      description:
        "Wireless BYOM conferencing with HDMI input and dual 4K60 output, 802.1X enterprise networking, powered over a single PoE+ cable.",
      /* The one real product render in the repository. Essentials and Launch have
         none — see NAV_CARDS in data/nav-cards.ts, which leaves their card frames
         empty for the same reason rather than borrowing a photograph of a
         different product. The on-page photography is inlined as data URIs
         (data/media.ts), which is not a URL a crawler can fetch. */
      image: "/products/thumbs/polaris-pro.webp",
      capabilities: [
        [
          "Simultaneous shares in the workspace",
          `Around ${TIERS.shares.pro} live sources composited side by side, laid out automatically as sources join and leave. The ceiling is memory on the chassis, not a licence: nothing in the software counts sources or refuses one.`,
        ],
        /* The ruled phrasing, which is positive on purpose: "Pro ingests and
           drives two" rather than "dual display — Pro only", which tells a reader
           what a tier lacks without telling them what it does (rulings.ts, F5.14).
           The pixel dimensions and the port generations are NOT restated here —
           those are spec rows, they live on the product page and the printable
           sheet, and scripts/check-specs.py is what keeps those two identical.
           A third copy on a surface that checker does not read is precisely the
           hole it exists to close; `subjectOf` points at the sheet instead. */
        [
          "Display support",
          "Polaris Pro ingests and drives two displays; Polaris Essentials drives a single display.",
        ],
        [
          "Wireless BYOM",
          "Supported. The room's camera and microphone attach to the pod over USB, and the pod bridges them into a Teams, Zoom, Webex or Meet call brought in from a laptop.",
        ],
        [
          "Cross-network sharing",
          "Included. Cloud-negotiated direct connections, with outbound-only TLS signalling on TCP 443: no VPN, and no inbound firewall rule.",
        ],
        [
          "Network authentication",
          "802.1X on wired Ethernet and on Wi-Fi (WPA2-Enterprise), with EAP-TLS, PEAP, TTLS or EAP-PWD.",
        ],
        [
          "Device security",
          "Mandatory secure boot on production firmware, with device identity and update-verification keys held in an on-board NXP SE050 secure element.",
        ],
        ["Warranty", WARRANTY.both],
      ],
      documentation: ["products/pro/spec", "resources/docs", "resources/firmware", "resources/support"],
    }),
  ],
  "products/essentials": [
    productNode({
      route: "products/essentials",
      name: "Mersive Polaris Essentials",
      category: "Wireless presentation system",
      description:
        "The multi-share Polaris workspace with browser web-join for standard meeting rooms and classrooms, managed in Polaris Cloud.",
      capabilities: [
        /* The tier ruling, stated first and in its own words: every capability
           difference from Pro is the chassis, never the software. A graph that
           listed only what Essentials lacks would be the exact reading
           TIERS.sameSoftware rules out. */
        ["Software platform", TIERS.sameSoftware],
        [
          "Simultaneous shares in the workspace",
          `Around ${TIERS.shares.essentials} live sources composited side by side, laid out automatically as sources join and leave. The ceiling is memory on the smaller chassis, not a licence or a reduced build.`,
        ],
        [
          "Display output",
          `Essentials drives a single display: ${ESSENTIALS_OUTPUT.format}.`,
        ],
        ["Room hardware I/O", TIERS.essentialsIoWhy],
        [
          "Wireless BYOM",
          `Not available on Essentials, and it is a chassis limit rather than a licence: ${TIERS.byomWhy.charAt(0).toLowerCase()}${TIERS.byomWhy.slice(1)}`,
        ],
        [
          "Cross-network sharing",
          "Included on every Polaris tier. Cloud-negotiated direct connections, with outbound-only TLS signalling on TCP 443: no VPN, and no inbound firewall rule.",
        ],
        /* 802.1X only, and no wireless-security list. The page's wireless row also
           lists WEP, because the released data sheet does and the radio will still
           negotiate it — carried there with a highlighted "not recommended, broken
           since 2001" caveat, on Damian's 12 Aug 2026 ruling. A schema value has
           nowhere to put that caveat, and "WEP" in the graph without it is the
           detachable-claim failure the warranty ruling is built around. So the
           mode stays on the page, where its caveat is attached to it.

           No secure-element row either, for the same class of reason: the
           Essentials row names SE050 under an open [verify:] flag (the firmware
           names the SE05x family, not the exact part), and the graph cannot carry
           a flag. It is unflagged on Pro, so it is stated there. */
        [
          "Network authentication",
          "802.1X network authentication with a certificate, so an Essentials room authenticates to a NAC exactly as a Pro room does.",
        ],
        ["Warranty", WARRANTY.both],
      ],
      documentation: [
        "products/essentials/spec",
        "resources/docs",
        "resources/firmware",
        "resources/support",
      ],
    }),
  ],
  /* Launch is pre-launch and its page is explicit about it: there is no Launch
     hardware PRD, so every spec cell on that page is a bracketed placeholder and
     the price is marked pending the pricebook. So this node carries the three
     things the page actually establishes — what it is, who makes it, and how it is
     bought — and nothing else. Capabilities, an image and offers publish when the
     PRD, a render and the pricebook exist. */
  "products/launch": [
    productNode({
      route: "products/launch",
      /* "Polaris Launch", as the family table names it — the product page's own
         <h1> is the bare "Launch", and the placeholder page records that the name
         is pending the Q12 workshop. Do not promote it to "Mersive Polaris
         Launch" here: a name in the graph that appears nowhere on the site is a
         name Google will attribute to us. */
      name: "Polaris Launch",
      category: "Wireless presentation device",
      description:
        "Share-first Polaris hardware at entry price: browser sharing to any display, managed in Polaris Cloud, bought once rather than subscribed.",
      capabilities: [
        [
          "Purchase model",
          "One-time hardware purchase with no recurring licence. Wireless sharing is not licensed on Launch, so it keeps working whether or not anything is renewed. Cloud management is included.",
        ],
      ],
      documentation: ["resources/docs", "resources/support"],
    }),
  ],
  /* The family page shows all three side by side, so it says so: an ItemList of
     the Product nodes declared on their own pages, by @id, with no second
     description of any of them. */
  "products/family": [
    { "@type": "CollectionPage", name: "The Polaris family" },
    {
      "@type": "ItemList",
      name: "The Mersive Polaris product family",
      itemListElement: (["products/pro", "products/essentials", "products/launch"] as Route[]).map(
        (route, i) => ({
          "@type": "ListItem",
          position: i + 1,
          item: { "@id": `${routeUrl(route)}#product` },
        })
      ),
    },
  ],

  /* A glossary is one of the few pages where a specialised type earns its place:
     DefinedTermSet describes exactly what the page is. The terms themselves are
     authored in the page markup, so they are not duplicated here. */
  "resources/glossary": [
    {
      "@type": "DefinedTermSet",
      name: "Mersive meeting-room glossary",
      description:
        "BYOD, BYOM and room-hosted meetings defined in plain language, used consistently across the Mersive site.",
    },
  ],

  /* Carries an @id so every post can declare itself part of this blog rather than
     only part of the site — the hierarchy an answer engine walks up. */
  "resources/blog": [
    {
      "@type": "Blog",
      "@id": BLOG_ID,
      name: "Mersive blog",
      url: routeUrl("resources/blog"),
      publisher: { "@id": ORG_ID },
      inLanguage: "en-US",
    },
  ],
  "resources/cases": [{ "@type": "CollectionPage", name: "Mersive case studies" }],
  "resources/firmware": [{ "@type": "CollectionPage", name: "Polaris release notes and firmware" }],
  /* The open-roles listing. The `JobPosting` nodes are not here: one per role,
     built from the live board by `jobPostingSchema()` below and attached to the
     individual /careers/<slug> pages, which is where the posting is shown. */
  careers: [{ "@type": "CollectionPage", name: "Work at Mersive: open roles" }],

  /* A partner list is a collection, with no `Organization` node per partner: the
     partner set is still being reconciled and a node each would claim more than the
     page shows. */
  "resources/ecosystem": [
    { "@type": "CollectionPage", name: "Mersive technology and integration partners" },
  ],
  "partners/where": [{ "@type": "CollectionPage", name: "Where to buy Polaris" }],
  "contact": [{ "@type": "ContactPage", name: "Contact Mersive" }],
  "resources/who": [{ "@type": "AboutPage", name: "Who owns Mersive" }],
};

/* ── Article nodes for the long-form pages ────────────────────────────────────
   45 blog articles and 13 customer stories were shipping with nothing but the
   generic WebPage node. That is the single largest structured-data gap on the
   site: those 58 pages are 48% of it, they are the pages most likely to be
   quoted by an answer engine, and none of them declared what it was, who
   published it, or what it was about.

   DATES ARE OPTIONAL HERE, AND THAT IS THE POINT.

   Google's Article guidance wants `datePublished`, and omitting it costs
   rich-result eligibility. It is still omitted whenever the source has no date,
   because a build timestamp would be a fabricated date, and several of these
   pages are demonstrably old: one describes the SOC 2 period as 1 March – 31 May
   2024 and calls it "most recent", and one claims a FIPS 140-3 certified secure
   element. Dating those to today would convert stale copy into apparently
   current copy, which is worse than having no date at all.

   So `published` and `updated` are per-post fields (`BlogPost.published`,
   `CaseStory.published`), the page renders them visibly when they exist, and this
   builder emits them only then. The blog met that condition on 19 Aug 2026: all
   56 posts carry a real date — the original mersive.com publish date for every
   ported post (recovered via the WordPress REST API that day) and an assigned
   business day for the drafts (Steve's dating decision, same day). The customer
   stories are still dateless at the source and stay out of date eligibility
   rather than lie, which is the case this optionality exists for.

   `dateModified` falls back to `datePublished` when a post has never been revised,
   which is what Google asks for — a `dateModified` that is absent while
   `datePublished` is present reads as "unknown", not as "never modified".

   `author` is the Organization unless the caller passes one resolved out of
   data/authors.ts. Since Steve's rule of 20 Aug 2026 the fifteen drafts carry an
   assigned by-line and emit as a Person; the forty-one ported posts carry no
   author key, because the source publishes no by-lines and blocks its authors
   API, and they keep the Organization rather than pretending a team is a human
   being. See data/authors.ts for what an entry does and what it must not invent. */
export function articleSchema(a: {
  headline: string;
  description: string;
  image?: string;
  /** Site-relative path, e.g. "/resources/blog/my-post". The canonical is built
   *  from ORIGIN here so no page has to know the origin and the two cannot drift. */
  path: string;
  /** `BlogPosting` for the blog, `Article` for anything else. */
  type?: "Article" | "BlogPosting";
  section?: string;
  about?: string;
  /** ISO yyyy-mm-dd, from the post's own record. Never a build timestamp. */
  published?: string;
  updated?: string;
  /** A by-line, already resolved from data/authors.ts. */
  author?: Author;
  /** The blog or collection this page belongs to, by @id. */
  partOf?: string;
  /** Routes this page authoritatively points a reader at, and links to on the
   *  page — the product and platform pages behind the explainer. */
  mentions?: Route[];
}): object {
  const canonical = `${ORIGIN}${a.path}`;
  return {
    "@type": a.type ?? "Article",
    "@id": `${canonical}#article`,
    headline: a.headline,
    description: a.description,
    url: canonical,
    ...(a.image ? { image: a.image.startsWith("http") ? a.image : `${ORIGIN}${a.image}` } : {}),
    ...(a.section ? { articleSection: a.section } : {}),
    ...(a.about ? { about: a.about } : {}),
    ...(a.published ? { datePublished: a.published } : {}),
    ...(a.published || a.updated ? { dateModified: a.updated ?? a.published } : {}),
    inLanguage: "en",
    author: a.author
      ? {
          "@type": "Person",
          name: a.author.name,
          ...(a.author.role ? { jobTitle: a.author.role } : {}),
          ...(a.author.url ? { url: a.author.url } : {}),
          ...(a.author.sameAs?.length ? { sameAs: a.author.sameAs } : {}),
          worksFor: { "@id": ORG_ID },
        }
      : { "@id": ORG_ID },
    publisher: { "@id": ORG_ID },
    isPartOf: a.partOf ? [{ "@id": SITE_ID }, { "@id": a.partOf }] : { "@id": SITE_ID },
    ...(a.mentions?.length ? { mentions: a.mentions.map(pageRef) } : {}),
    mainEntityOfPage: { "@id": `${canonical}#webpage` },
  };
}

/* ── FAQPage and HowTo ────────────────────────────────────────────────────────

   Both types are only correct when the visible page genuinely is the thing: a
   readable question-and-answer block, or numbered instructions a reader carries
   out. Both builders below therefore take the same content the page renders,
   from the same array, rather than a second copy of it written for the crawler.
   That is the whole design constraint — a page's FAQ and its FAQPage node cannot
   drift apart if there is only one of them.

   THE BRACKET RULE. This site marks every unverified or pending phrase in square
   brackets, and `initVerifyFlags` highlights them in review chrome. A bracketed
   note is by definition copy nobody has signed off, so both builders drop any
   entry containing one instead of publishing it to Google as settled fact. The
   entry rejoins the graph the day the brackets come off the page, with no edit
   here. `pnpm build` prints what was dropped, so a silent omission cannot look
   like coverage. */

const HAS_PLACEHOLDER = /\[[^\]]*\]/;

export interface QA {
  q: string;
  /** Plain text or inline HTML, exactly as the page shows it. */
  a: string;
}

/** Strips inline markup and entities so a schema value is text, as the spec wants. */
function plain(s: string): string {
  return s
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/(p|li|div)>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&mdash;/g, "—")
    .replace(/&ndash;/g, "–")
    .replace(/&rsquo;/g, "’")
    .replace(/&lsquo;/g, "‘")
    .replace(/&rdquo;/g, "”")
    .replace(/&ldquo;/g, "“")
    .replace(/&amp;/g, "&")
    .replace(/&#10003;/g, "✓")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * `FAQPage` for a page whose visible content is a question-and-answer block.
 *
 * Returns null rather than an empty node when every entry is placeholder copy —
 * a FAQPage with no questions describes nothing. `label` names the surface in the
 * build-log line when something is dropped.
 */
export function faqPageSchema(items: QA[], label: string): object | null {
  const clean = items.filter((i) => !HAS_PLACEHOLDER.test(i.q) && !HAS_PLACEHOLDER.test(i.a));
  const dropped = items.length - clean.length;
  if (dropped > 0) {
    console.warn(
      `[schema] ${label}: ${dropped} of ${items.length} FAQ answers carry a bracketed ` +
        "placeholder and stay out of the FAQPage node until it is resolved."
    );
  }
  if (!clean.length) return null;
  return {
    "@type": "FAQPage",
    mainEntity: clean.map((i) => ({
      "@type": "Question",
      name: plain(i.q),
      acceptedAnswer: { "@type": "Answer", text: plain(i.a) },
    })),
  };
}

export interface HowToStep {
  name: string;
  text: string;
}

/**
 * `HowTo` for real, sequential instructions — the browser-to-room share flow is
 * the one on this site. Steps carry `url` so each one anchors to the page that
 * shows it, which is what Google asks for when the steps are on one page.
 */
export function howToSchema(h: {
  name: string;
  description: string;
  /** The page the steps are shown on. */
  route: Route;
  steps: HowToStep[];
  /** What a reader needs before starting, where the page states it. */
  supply?: string[];
  label?: string;
}): object | null {
  const clean = h.steps.filter(
    (s) => !HAS_PLACEHOLDER.test(s.name) && !HAS_PLACEHOLDER.test(s.text)
  );
  if (clean.length !== h.steps.length) {
    console.warn(
      `[schema] ${h.label ?? h.route}: a HowTo step carries a bracketed placeholder, so the ` +
        "HowTo node is withheld — an instruction list missing a step is worse than none."
    );
    return null;
  }
  return {
    "@type": "HowTo",
    name: h.name,
    description: h.description,
    ...(h.supply?.length
      ? { supply: h.supply.map((s) => ({ "@type": "HowToSupply", name: plain(s) })) }
      : {}),
    step: clean.map((s, i) => ({
      "@type": "HowToStep",
      position: i + 1,
      name: plain(s.name),
      text: plain(s.text),
      url: `${routeUrl(h.route)}#step-${i + 1}`,
    })),
    inLanguage: "en-US",
    mainEntityOfPage: { "@id": webPageId(h.route) },
  };
}

/** Nodes present on every page. */
export const GLOBAL_SCHEMA: object[] = [ORGANIZATION, WEBSITE];

/** Builds the Home → Section → Page trail, matching the visible Crumbs component. */
function breadcrumb(
  route: Route,
  canonical: string,
  url: (r: Route) => string,
  /** Name of a dynamic child page, which becomes the final crumb. */
  child?: string
) {
  const items: object[] = [{ "@type": "ListItem", position: 1, name: "Home", item: url("home") }];

  const owner = NAV.find((m) => m.items.some(([p]) => p === route || p === `_grpA:${route}`));
  const hub = owner ? SECTION_HUB[owner.label] : undefined;
  if (owner && hub && hub !== route) {
    items.push({ "@type": "ListItem", position: 2, name: owner.label, item: url(hub) });
  }

  if (route !== "home") {
    /* The last item may omit `item` per Google's guidance, but the canonical URL
       is right here and naming it costs nothing. On a child page the canonical
       belongs to the child, so the route's own crumb resolves to its route URL —
       a non-final crumb without a valid `item` invalidates the whole list. */
    items.push({
      "@type": "ListItem",
      position: items.length + 1,
      name: PAGE_TITLES[route] ?? route,
      item: child ? url(route) : canonical,
    });
  }

  if (child) {
    items.push({
      "@type": "ListItem",
      position: items.length + 1,
      name: child,
      item: canonical,
    });
  }

  /* A trail consisting only of "Home" describes nothing; the home page gets no
     BreadcrumbList at all rather than a one-item stub. */
  return items.length > 1 ? { "@type": "BreadcrumbList", itemListElement: items } : null;
}

export interface GraphInput {
  route: Route;
  title: string;
  description: string;
  /** Absolute canonical URL for this page. */
  canonical: string;
  /** Absolute social-card URL. */
  image: string;
  /** Resolves a route to its absolute URL, base path included. */
  url: (r: Route) => string;
  /**
   * Name of a dynamic child of `route` — a job title under /careers. Extends the
   * breadcrumb by one level and suppresses the route's own `SCHEMA` entry, which
   * describes the parent page and not this one.
   */
  child?: string;
  /** Page-level additions from the `schema` prop. */
  extra?: object[];
}

/** Assembles the full @graph for one page. */
export function buildGraph({
  route,
  title,
  description,
  canonical,
  image,
  url,
  child,
  extra = [],
}: GraphInput): object[] {
  const webPage = {
    "@type": "WebPage",
    "@id": `${canonical}#webpage`,
    url: canonical,
    name: title,
    description,
    isPartOf: { "@id": SITE_ID },
    about: { "@id": ORG_ID },
    primaryImageOfPage: image,
    inLanguage: "en-US",
  };

  const crumbs = breadcrumb(route, canonical, url, child);

  return [
    ...GLOBAL_SCHEMA,
    webPage,
    ...(crumbs ? [crumbs] : []),
    ...(child ? [] : (SCHEMA[route] ?? [])),
    ...extra,
  ];
}

/* ------------------------------------------------------------- job postings */

/**
 * `JobPosting` for one open role, from the live Rippling board.
 *
 * datePosted and validThrough
 * ---------------------------
 * `datePosted` is Rippling's own `createdOn`: the date the role was actually
 * opened. It matters that this is a real date and not the build date — the site
 * rebuilds on every push, and a posting whose `datePosted` advances each time is
 * what Google treats as stale-content manipulation.
 *
 * `validThrough` has no equivalent in the feed. Rippling holds no closing date;
 * a role simply leaves the board when it is filled, and leaving the board is what
 * removes the page here. So it is set a year out from the build, which keeps a
 * live posting from advertising itself as expired. That one *does* move on each
 * rebuild, harmlessly: it is a ceiling, not a claim about freshness.
 *
 * What is deliberately absent
 * ---------------------------
 * No `baseSalary`. `payRangeDetails` is empty on every current posting, and a
 * salary in structured data is a salary Google will publish — the same reason no
 * `Product` node on this site carries `offers`. Add it if and when Rippling
 * carries real ranges.
 *
 * `directApply: false` is the honest value. The apply button hands the candidate
 * to Rippling; no résumé, EEOC answer or form field is collected on mersive.com.
 */
export function jobPostingSchema(job: Job, canonical: string): object {
  const onSite = job.locations.filter((l) => !l.remote);
  const remote = job.locations.filter((l) => l.remote);

  /* Google requires a country on `jobLocation`; a location without one is worse
     than no node, so it is dropped rather than half-stated. */
  const jobLocation = onSite
    .filter((l) => l.countryCode || l.country)
    .map((l) => ({
      "@type": "Place",
      address: {
        "@type": "PostalAddress",
        ...(l.city ? { addressLocality: l.city } : {}),
        ...(l.stateCode || l.state ? { addressRegion: l.stateCode ?? l.state } : {}),
        addressCountry: l.countryCode ?? l.country,
      },
    }));

  /* A remote role still carries a geographic restriction — "Remote (New York,
     New York, US)" means a candidate in New York. State when Rippling gives one,
     country otherwise, deduplicated by name. */
  const requirements = remote
    .map((l) =>
      l.state
        ? { "@type": "State", name: l.state }
        : l.country
          ? { "@type": "Country", name: l.country }
          : null
    )
    .filter((node): node is { "@type": string; name: string } => node !== null)
    .filter((node, i, all) => all.findIndex((n) => n.name === node.name) === i);

  const validThrough = new Date();
  validThrough.setFullYear(validThrough.getFullYear() + 1);

  return {
    "@type": "JobPosting",
    title: job.name,
    /* Google accepts HTML here, and wants the whole posting rather than a
       summary. Same order the page shows it in — the lead-in Rippling files under
       `company`, then the responsibilities it files under `role`. */
    description: [job.companyHtml, job.roleHtml].filter(Boolean).join(""),
    identifier: {
      "@type": "PropertyValue",
      name: ORGANIZATION.name,
      value: job.uuid,
    },
    hiringOrganization: { "@id": ORG_ID },
    url: canonical,
    ...(job.postedOn ? { datePosted: job.postedOn } : {}),
    validThrough: validThrough.toISOString().slice(0, 10),
    ...(job.employmentTypeSchema ? { employmentType: job.employmentTypeSchema } : {}),
    ...(jobLocation.length ? { jobLocation } : {}),
    ...(remote.length ? { jobLocationType: "TELECOMMUTE" } : {}),
    ...(requirements.length ? { applicantLocationRequirements: requirements } : {}),
    directApply: false,
  };
}
