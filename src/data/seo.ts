/* Per-route <title> and meta description copy.
   Seeded from the v1.95 single-file POC and completed for every route since.

   Both maps are `Record<Route, string>`, not `Record<string, string>`: adding a
   route to ROUTES without adding copy here is a `pnpm check` failure rather than
   a page that silently inherits the home page's description. Entries are listed
   in ROUTES order so the two files can be read side by side.

   Titles run to roughly 60 characters before Google truncates them, descriptions
   to roughly 155. Neither is a hard limit — being cut off is a display detail,
   not a ranking one — but the important words belong at the front either way. */

import type { Route } from "./routes";

/** Default social-card image, resolved against `site` in BaseLayout. */
export const OG_IMAGE = "/og-default.png";

export const TITLES: Record<Route, string> = {
  home: "Wireless Collaboration Platform for Any Meeting | Mersive",

  "platform/how": "How Polaris Works: Wireless Presentation, Reinvented | Mersive",
  "platform/workspace": "The Workspace: Multi-User Screen Sharing in the Browser | Mersive",
  "platform/taxonomy": "BYOD vs BYOM vs Room-Hosted Meetings: A Guide | Mersive",
  "platform/cross-network": "Screen Sharing Across Guest Wi-Fi & VLANs | Mersive",
  "platform/security": "Secure Wireless Presentation for Enterprise | Mersive",
  "platform/cloud": "Meeting Room Management Software: Polaris Cloud | Mersive",
  "platform/tco": "Wireless Presentation System Cost & TCO Calculator | Mersive",
  "platform/lineage": "The Mersive Platform Story: 15 Years from Sol to Polaris | Mersive",

  "products/family": "Polaris Wireless Collaboration Hardware | Mersive",
  "products/hybrid": "BYOM & Hybrid Meeting Room Solutions | Mersive Polaris",
  "products/launch": "Launch: Wireless Display for Signage & Overflow Spaces | Mersive",
  "products/link": "Polaris Link: Wireless BYOM for Any Meeting Platform | Mersive",
  "products/host": "Polaris Host: Native Teams & Zoom Room System | Mersive",
  "products/essentials": "Polaris Essentials: Wireless Screen Sharing | Mersive",
  "products/essentials/spec": "Polaris Essentials Spec Sheet | Mersive",
  "products/pro": "Polaris Pro: Wireless Presentation System | Mersive",
  "products/pro/spec": "Polaris Pro Spec Sheet | Mersive",
  /* The brand is Route; "active learning" and "classroom screen sharing" are the
     category terms buyers search, so they stay here in the title rather than in
     the product name. Same split on the description below. */
  "products/route": "Polaris Route: Active Learning & Classroom Screen Routing | Mersive",
  "products/engage": "Polaris Engage: Classroom Polling & Quizzing | Mersive",
  "products/selector": "Which Polaris Is Right for Your Rooms? | Mersive",
  "products/solstice": "Mersive Solstice Gen 3: Support Status & What's Next | Mersive",
  "products/transition": "Mersive Solstice Gen 3 to Polaris: Upgrade Path & Timeline | Mersive",

  trial: "Start a Free Polaris Trial | Mersive",

  "solutions/corporate": "Corporate Meeting Room Solutions at Any Scale | Mersive Polaris",
  "solutions/smb": "Meeting Rooms for SMB & Mid-Market: No AV Team Needed | Mersive",
  "solutions/enterprise": "Enterprise Meeting Room Technology | Mersive Polaris",
  "solutions/creative": "Creative Review Rooms: Multi-Source, Secure | Mersive Polaris",
  "solutions/education": "Classroom & Campus Collaboration Technology | Mersive Polaris",
  "solutions/k12": "Classroom Screen Sharing for K-12 Schools | Mersive",
  "solutions/highered": "Campus AV & Classroom Collaboration for Higher Ed | Mersive",
  "solutions/regulated": "Collaboration for Regulated Industries | Mersive Polaris",
  "solutions/government": "TAA-Compliant Wireless Presentation for Government | Mersive",
  "solutions/healthcare": "Secure Collaboration for Healthcare & Clinical Spaces | Mersive",
  "solutions/finance": "Wireless Collaboration for Financial Services | Mersive Polaris",
  "solutions/hybrid": "Hybrid Meeting Room Solutions | Mersive Polaris",
  "solutions/collab": "Wireless Screen Sharing for Meeting Rooms | Mersive",
  "solutions/signage": "Digital Signage on Meeting Room Displays | Mersive",

  "compare/hub": "Compare Wireless Presentation Systems | Mersive",
  "compare/mtr": "Microsoft Teams Rooms Alternative | Mersive Polaris",
  "compare/barco": "Barco ClickShare Alternative | Mersive Polaris",
  "compare/airtame": "Airtame Alternative: Polaris vs Airtame | Mersive",
  "compare/dongles": "ClickShare Alternative: Beyond the Dongle | Mersive",

  "resources/support": "Mersive Support: Tickets, Docs & Downloads | Mersive",
  "resources/docs": "Mersive Documentation: Deployment, Admin & API Guides | Mersive",
  "resources/firmware": "Polaris Firmware & Release Notes | Mersive",
  "resources/cases": "Case Studies | Mersive",
  "resources/blog": "Mersive Blog: Wireless Collaboration & Meeting Rooms | Mersive",
  "resources/faq": "Wireless Presentation FAQ: Conference Rooms & Meeting Displays | Mersive",
  "resources/glossary": "BYOD vs BYOM vs Room-Hosted: Field Guide | Mersive",
  legal: "Legal: Privacy, Terms, EULA | Mersive",
  /* Was "Network Requirements: Ports, Endpoints & VLAN Architecture | Mersive
     Polaris" — 76 characters, cut off in search results. Same keywords, 65. */
  "resources/network": "Polaris Network Requirements: Ports & VLAN Architecture | Mersive",
  "resources/downloads": "Download the Mersive App: iOS, Android & Desktop | Mersive",
  "resources/opensource": "Open Source Software & Licenses | Mersive",
  "resources/who": "About Mersive: Owned by the People Who Build Polaris | Mersive",
  /* One page now. It was two — the company page and the live listing — kept apart
     so they would not compete for the same query. Merged, it has to answer both
     intents, so the title carries the brand phrase and the thing people search
     for: "work at" and "jobs". */
  "careers": "Work at Mersive: Open Roles, Offices & Hiring | Mersive",
  "resources/ecosystem": "Mersive Ecosystem: Technology & Integration Partners | Mersive",

  "partners/program": "AV Integrator & Channel Partner Program | Mersive",
  "partners/become": "Become a Mersive Partner: Apply Once, Whole Team In | Mersive",
  "partners/portal": "Mersive Partner Portal Login | Mersive",

  hub: "Customer & Partner Hub: Support & Portals | Mersive",
  "how-to-buy": "How to Buy Mersive Polaris: Trial or Partner | Mersive",
  "partners/where": "Where to Buy Polaris: Partner Directory | Mersive",
  contact: "Contact Sales, Support & Partners | Mersive",
  demo: "Book a Live Polaris Demo | Mersive",
};

export const DESC: Record<Route, string> = {
  home: "Mersive Polaris turns any display into a wireless collaboration workspace. Share from the browser at app.mersive.com, no install, across networks, cloud managed.",

  "platform/how":
    "How Mersive Polaris works: type a 6-character key at app.mersive.com and share from the browser. Signaling through Polaris Cloud, direct encrypted WebRTC media.",
  "platform/workspace":
    "The Polaris workspace composites multiple live shares side by side on the room display, laid out automatically and mirrored live to every participant.",
  "platform/taxonomy":
    "Where meetings live: a map of BYOD, BYOM and room-hosted rooms, platform-locked versus agnostic, and where Mersive Polaris fits in each row.",
  "platform/cross-network":
    "Cross-network screen sharing without VPN: guests, VLANs and remote devices connect over direct encrypted WebRTC with outbound-only TLS signaling on port 443.",
  "platform/security":
    "Mersive Polaris security: verified secure boot, NXP SE050 secure element, 802.1X with EAP-TLS, PEAP or TTLS, TLS in transit, and a public data-path inventory.",
  "platform/cloud":
    "Polaris Cloud runs every room from one console: deployment, monitoring, firmware, analytics and alerts, plus an open REST API enabled per organisation.",
  "platform/tco":
    "Wireless collaboration TCO calculator: compare an 10-year Polaris platform install against room systems with per-room licenses and hardware refresh cycles.",
  "platform/lineage":
    "Fifteen years from Mersive Solstice to Polaris: the same mission, the next platform generation, and what moving your rooms actually involves.",

  "products/family":
    "Compare Polaris tiers: Pro, Essentials and Launch. One software platform sized to every room and budget, with subscription or perpetual licensing.",
  "products/hybrid":
    "Polaris hybrid meetings: Link lets the pod host the call, Host runs the room with native Teams, Zoom, Webex and Meet clients, chosen per meeting.",
  "products/launch":
    "Launch: share-first wireless display for signage, offices and overflow spaces. One-time hardware purchase, no subscription, managed in Polaris Cloud.",
  "products/link":
    "Polaris Link lets the pod host the meeting on any conferencing platform, freeing the laptop from the cable. Pre-launch: shipping Q3 2026.",
  "products/host":
    "Polaris Host runs the room with native Teams, Zoom, Webex and Meet clients, with no user device required. Pre-launch: shipping Q4 2026.",
  "products/essentials":
    "Polaris Essentials: the multi-share workspace with browser web-join for standard rooms and classrooms, cloud managed, subscription or perpetual license.",
  "products/essentials/spec":
    "The complete Polaris Essentials specification: sharing paths, network and security posture, I/O, power, environmentals, and licensing. Prints as a clean PDF datasheet.",
  "products/pro":
    "Polaris Pro: wireless BYOM conferencing, HDMI input and dual 4K60 output, 802.1X enterprise networking, PoE+ single-cable install, subscription or perpetual license.",
  "products/pro/spec":
    "The complete Polaris Pro specification: dual 4K60 output, HDMI input, PoE+, 802.1X, secure element, I/O, power, environmentals, and licensing. Prints as a clean PDF datasheet.",
  "products/route":
    "Polaris Route hands teachers the room: route any student's screen to any display, and moderate every share from the teacher's device. Ships Q1 2027.",
  "products/engage":
    "Polaris Engage measures the room: polling and quizzing answered from any browser, results live on the workspace, and the participation record afterwards. Ships Q1 2027.",
  "products/selector":
    "Which Mersive Polaris is right for your rooms? Answer four questions and get a straight recommendation for your fleet.",
  "products/solstice":
    "Where Mersive Solstice Gen 3 stands: support dates, documentation, software policy and the road ahead, in one place and direct from Mersive.",
  "products/transition":
    "Moving from Mersive Solstice Gen 3 to Polaris: what carries forward, what improves, tier mapping, and management through linked cloud consoles.",

  trial: "Request a Mersive Polaris trial kit and prove the platform on your own network with your own devices.",

  "solutions/corporate":
    "Corporate meeting rooms from ten huddle spaces to a thousand-room global estate: guest web-join, one platform across every tier, one cloud pane.",
  "solutions/smb":
    "Meeting rooms that run themselves, for 10 to 50 room estates with no AV department: browser sharing, cloud management, warranty inside the subscription.",
  "solutions/enterprise":
    "Enterprise wireless collaboration: segmented networks, 802.1X authentication, cross-network sharing and fleet management built for review boards and scale.",
  "solutions/creative":
    "Review rooms for creative teams: every reference on screen at once, clients sharing from a browser, and unreleased work that never lands on a server.",
  "solutions/education":
    "Wireless collaboration for education: Chromebook-friendly browser sharing, classroom workspaces and district-wide cloud management.",
  "solutions/k12":
    "K-12 classroom screen sharing built for Chromebooks: browser and native Google Cast sharing, teacher moderation, and district-wide cloud management.",
  "solutions/highered":
    "Campus AV at scale for lean teams: lecture halls, labs and seminar rooms across buildings and VLANs, all run from one Polaris Cloud pane.",
  "solutions/regulated":
    "Government, healthcare and financial services rooms where the security review is the buying process, backed by documentation readable without an NDA.",
  "solutions/government":
    "TAA-compliant wireless presentation for government: trusted supply chain, secure boot, a hardened Linux OS, and security docs a review board can read.",
  "solutions/healthcare":
    "Collaboration for tumor boards, telehealth consults and clinical admin spaces, on networks segmented by mandate, with the data path told in the open.",
  "solutions/finance":
    "Wireless collaboration for trading floors, boardrooms and client rooms, in buildings where corp, front-office and guest networks never touch by design.",
  "solutions/hybrid":
    "Hybrid conferencing with any platform: Teams, Zoom, Webex or Meet chosen per meeting, with meeting parity for remote participants.",
  "solutions/collab":
    "Wireless collaboration for meeting rooms: multiple live shares side by side on the display, from laptops, phones and browsers, nothing installed.",
  "solutions/signage":
    "Digital signage on Polaris: dedicated screens and idle meeting displays publish dynamic, event-driven web content, cached locally and managed from the same Polaris Cloud portal as your rooms.",

  "compare/hub":
    "Compare Mersive Polaris against room systems, casting dongles and wireless presentation vendors, capability by capability.",
  "compare/mtr":
    "Polaris versus Microsoft Teams Rooms and Zoom Rooms: platform-agnostic rooms, sharing without starting a call, and per-room license math.",
  "compare/barco":
    "How Mersive Polaris compares with Barco ClickShare: no button in the hand, nothing installed on the laptop, and the meeting hosted by the room.",
  "compare/airtame":
    "How Mersive Polaris compares with Airtame, capability by capability, from browser sharing to cross-network reach and fleet management.",
  "compare/dongles":
    "Why a dongle is not enough: buttons, pucks and HDMI sticks replace the cable, while Polaris replaces the meeting-room stack around it.",

  "resources/support":
    "Open a support ticket, or answer it yourself first: documentation, apps and firmware, network requirements, and what to have ready before you file.",
  "resources/docs":
    "Mersive documentation hub: deployment, security, management and API references for Polaris and Mersive Solstice Gen 3, public and searchable.",
  "resources/firmware":
    "Every Polaris release logged in public: features, security patches and fixes, dated, so you can see what the subscription keeps buying.",
  "resources/cases":
    "Mersive customer case studies across enterprise, education, government and healthcare deployments.",
  "resources/blog":
    "The Mersive blog: plain-language writing on BYOD, BYOM, room-hosted meetings, and screen sharing that crosses guest Wi-Fi.",
  "resources/faq":
    "How wireless screen sharing works in a conference room: guest sharing without joining the network, BYOD vs BYOM vs BYOM+, huddle room to boardroom, signage and fleet management.",
  "resources/glossary":
    "BYOD, BYOM and room-hosted meetings defined in plain language: the meeting-room market's vocabulary, used consistently across this site.",
  legal: "Privacy policy, terms of use, EULA, warranty, cookie policy and accessibility statement: every Mersive legal surface in one place.",
  "resources/network":
    "Polaris network requirements: ports, cloud endpoints, VLAN reference design, NAT guidance and a diagnostic tool that validates the deployment.",
  "resources/downloads":
    "Mersive apps and downloads: Polaris shares from the browser with nothing to install; separate mobile apps per generation and Gen 3 desktop apps.",
  "resources/opensource":
    "Polaris is built on open-source software: the components, their licenses, and the obligations Mersive meets, published in the open.",
  "resources/who":
    "Mersive is owned by the people who design, engineer, sell and support Polaris, and that ownership changes how everything here works.",
  careers:
    "Work at Mersive: every open role straight from our applicant tracking system, plus the offices, how hiring runs, and what comes with the job.",
  "resources/ecosystem":
    "The Mersive ecosystem: digital signage, conferencing audio, mounts and calendaring partners, and what each integration actually does in the room.",

  "partners/program":
    "Mersive business moves through partners. What the channel program builds for AV integrators and resellers, and how to get in.",
  "partners/become":
    "Apply once and your whole team is in: when your company is approved, anyone with your work email domain self-registers. No per-seat account requests.",
  "partners/portal":
    "Domain-based partner portal access: if your company is an authorized Mersive partner, your work email address is your key.",

  hub: "One door to everything you log into: support, downloads, training, documentation and the partner portal, from a page you can bookmark.",
  "how-to-buy":
    "Three ways to meet Mersive Polaris — trial, demo, or a conversation — and every path ends with the regional partner who makes it work.",
  "partners/where":
    "A curated directory of Mersive integrators and resellers: every profile sales-approved, every listing a company we know by name.",
  contact:
    "Sales, support and partner enquiries, each routed to people who can act on them. Three doors: pick the one that matches your question.",
  demo: "Book a live Mersive Polaris demo: see browser web-join, the multi-share workspace and cross-network sharing on a real system.",
};
