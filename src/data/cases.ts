/* The thirteen published case studies — the content behind the case-studies
 * hub and its thirteen sub-pages, in one place because both render from it, and
 * now shaped the same way a blog post is (`body: BlogSection[]`) so both content
 * pools render through one shared component (`PostGrid`) and one shared layout
 * (`PostLayout`). URLs are unchanged — this is a content-shape and rendering
 * change, not a routing one.
 *
 * The copy is VERBATIM from the revised "Mersive Customer Stories" source. An
 * earlier pass rewrote every bare "Solstice" to "Mersive Solstice" to match the
 * rest of the site; that has been reverted, because the instruction is to port the
 * source's text exactly and a case study quoting a customer is not the place to
 * take liberties with their words either.
 *
 * FIELD MAPPING FROM THE ORIGINAL FIXED-FIELD SHAPE (kept here for whoever edits
 * these next and wonders where "challenge"/"solution"/"result" went):
 *   - `challenge` -> body[1] { head: "The challenge", paras: [...] }
 *   - `solution`  -> body[2] { head: "The deployment", paras: [...] }, and this is
 *     also where a customer quote attaches (`quote`/`quoteWho`), since in every
 *     one of the thirteen records the quote is about the experience of using the
 *     product, which reads naturally next to the deployment description
 *   - `result`    -> body[3] { head: "The outcome", paras: [...] }; any `verify`
 *     note is appended there as a bracketed [verify: ...] sentence, matching the
 *     sitewide convention (`initVerifyFlags` highlights it) rather than a field
 *   - `scale`/`products`/`partner`/`era` -> body[0], a `table` section headed
 *     "At a glance" — first, so it keeps the prominence the old sidebar had
 *   - `statA`/`statALabel`/`statB`/`statBLabel` -> kept as their own fields
 *     (unlike a blog post) because the card grid's two-stat lead is a real,
 *     distinct visual treatment worth keeping; ALSO folded into `takeaways` for
 *     the story page's short-answer block, since that's a second presentation of
 *     the same two facts, not a second set of facts
 *   - `person`/`role` -> folded into `quoteWho` on the deployment section, but
 *     ONLY when there's a real `quote` to attach it to (two records — Broward,
 *     Warwick — had an empty quote; Broward's citation was already restated in
 *     its own challenge paragraph and Warwick's was a department name standing in
 *     for a missing quote, so both were dropped rather than kept as an orphaned
 *     attribution with no quote, which is not a shape a blog post's sections
 *     support anyway)
 *   - `sec`/`secLabel` -> `topic`/`topicLabel` (same slot: a colour-coded taxonomy
 *     key driving `cat-<key>` classes and the "more in this sector" foot nav)
 *   - `teaser` -> `dek`; `shot` -> `hero`; `logo`/`logoAspect`/`org` kept as their
 *     own optional fields — the one real extension over the blog shape, because a
 *     customer's mark is a genuine trust signal a blog post doesn't carry
 *
 * What did not come across is the source file's styling. Its colour SYSTEM did,
 * mapped onto this site's tokens: the FIRST stat carries the sector's colour, the
 * second is white, and the three prose sections used to be separated by colour
 * rather than by rules — now they're separated by heading instead (The
 * challenge / The deployment / The outcome), the same convention a blog post uses.
 *
 * `logoAspect` is the mark's width/height, measured from the ink rather than taken
 * from the source's table or the file's viewBox. It drives an equal-AREA lockup: a
 * square badge and a long wordmark set to the same width do not read at the same
 * weight, and thirteen marks side by side make that obvious. Measuring matters —
 * the source had BNL at 1.0 because its SVG canvas is square, while the ink is a
 * 2.58:1 wordmark, so the lockup solved for a 61px square and rendered the bank's
 * name too small to read. Padding inside a file cannot be fixed in CSS either, so
 * BNL's and Convene's viewBoxes were tightened onto their ink and the Lycée raster
 * was cropped.
 *
 * Texas A&M's and George Mason's marks do NOT come from the source: those two
 * arrived as empty shells — an <image> element with no href, a wrapper around a
 * bitmap that was never bundled — so they rendered blank everywhere, including in
 * the source itself. Both are this site's own vector marks from data/logos.ts.
 *
 * The marks are pre-rendered WHITE with their padding trimmed off
 * (public/cases/<slug>-mark.png, 560px wide). They used to be the customers' own
 * files whitened by a CSS `filter: brightness(0) invert(1)`, and that filter kept
 * failing in ways a screenshot exposes and code review does not: it lost a
 * specificity race to the photograph's own hover filter, and the minifier shortened
 * invert(1) to invert(), which is valid but is one more thing between the mark and
 * being white. Baked pixels cannot lose a cascade race. The original vendor files
 * stay in the folder as the source of these.
 *
 * Image rights are settled: the photography and the marks are approved for use.
 * Only claim-accuracy flags survive, as `[verify: ...]` notes inside the outcome
 * section's own paragraphs.
 */

import type { BlogSection } from "./blog";

export interface CaseStory {
  /** URL segment under /resources/cases/ */
  slug: string;
  /** sector key — also the colour class, `cat-<topic>`, and the blog-shaped taxonomy slot */
  topic: "highered" | "k12" | "enterprise" | "global" | "finance";
  topicLabel: string;
  org: string;
  logo: string;
  logoAspect: number;
  headline: string;
  dek: string;
  hero: string;
  lede: string[];
  asideLabel: string;
  takeaways: string[];
  body: BlogSection[];
  /**
   * A slot that exists but has not been approved for publication yet.
   *
   * A pending story still builds, so the shape of the page can be reviewed and
   * filled in, and it still contributes its customer mark to the industry cards
   * on the home page -- the MARK is cleared separately from the COPY. What it
   * does not do is get discovered: it is excluded from sitemap.xml and from
   * llms.txt, and its path is listed in src/data/held.ts, which carries the
   * noindex and the robots.txt Disallow.
   *
   * Publishing one is deleting this flag and its held.ts entry, and writing the
   * body. Do not write the body from a draft the customer is still reviewing.
   */
  pending?: boolean;
  /** The card grid's two-stat lead — the same two facts as the first two `takeaways`, presented differently. */
  statA: string;
  statALabel: string;
  statB: string;
  statBLabel: string;
}

/** Sector filters, in the order they appear above the grid. */
export const CASE_SECTORS: { key: string; label: string }[] = [
  { key: "all", label: "All sectors" },
  { key: "highered", label: "Higher education" },
  { key: "k12", label: "K-12" },
  { key: "enterprise", label: "Corporate & workspace" },
  { key: "global", label: "Government & health" },
  { key: "finance", label: "Financial services" },
];

export const CASES: CaseStory[] = [
  /* PENDING -- the copy is a draft Mersive is iterating with Marriott, and it is
     not reproduced here. The source lives outside this repo (Executive Packet /
     Marriott) and its own footer is explicit: "Nothing publishes without
     Marriott's written approval." So this entry is the slot and nothing else:
     no numbers, no quotes, no body copy lifted from the draft.

     The MARK is a separate decision and is already cleared -- Damian, 26 Aug
     2026 -- which is why marriott-mark.png appears on the Corporate industry
     card on the home page while this page stays held. Name-and-mark use and
     story approval are not the same permission. */
  {
    slug: "marriott",
    pending: true,
    topic: "enterprise",
    topicLabel: `CORPORATE \u00b7 WORKSPACE`,
    org: `MARRIOTT INTERNATIONAL`,
    logo: "/cases/marriott-mark.png",
    logoAspect: 3.15,
    headline: `Case study in preparation`,
    dek: `[PENDING: Mersive is preparing this story with Marriott International. It publishes when the customer has approved it in writing.]`,
    hero: "",
    lede: [],
    asideLabel: `THE NUMBERS`,
    takeaways: [`[Pending customer approval]`],
    statA: `\u2014`,
    statALabel: `[pending]`,
    statB: `\u2014`,
    statBLabel: `[pending]`,
    body: [
      {
        kicker: "Status",
        head: "This page is a placeholder.",
        paras: [
          `[HELD 26 Aug 2026 — THIS PAGE MAY NOT RELEASE until Marriott approves the text in writing. The story is drafted and with the customer for review. Nothing on this page is final, and no figure, quote or attribution from the draft has been copied into it. It publishes when Marriott has approved the text in writing. See src/data/held.ts.]`,
        ],
      },
    ],
  },
  {
    slug: "wework",
    topic: "enterprise",
    topicLabel: `CORPORATE · WORKSPACE`,
    org: `WEWORK`,
    logo: "/cases/wework-mark.png",
    logoAspect: 4.75,
    headline: `15,000 Pods across 500+ locations`,
    dek: `The category's largest published deployment, run from a single cloud tenant — with motion-sensor room signage WeWork built on top of the platform.`,
    hero: "/cases/wework-shot.webp",
    lede: [],
    asideLabel: `THE NUMBERS`,
    takeaways: [`~15,000 Solstice Pods deployed`, `500+ locations worldwide`],
    statA: `~15,000`,
    statALabel: `Solstice Pods deployed`,
    statB: `500+`,
    statBLabel: `locations worldwide`,
    body: [
      {
        kicker: "At a glance",
        table: {
          cols: ["Scale", "Products", "Partner", "Era"],
          rows: [["500+ locations", "Pods + Cloud + signage", "In-house engineering", "Gen 3-era deployment · published case study"]],
        },
      },
      {
        head: "The challenge",
        paras: [
          `WeWork needed one wireless collaboration standard across a fleet measured in hundreds of buildings. Competing devices tested needed constant reboots, had poor uptime, demanded extra permissions from cumbersome software, and required dongles, hubs and switchers in every room.`,
        ],
      },
      {
        head: "The deployment",
        paras: [
          `Roughly 15,000 Pods across more than 500 locations worldwide, deployed and managed through Solstice Cloud with minimal time investment per site. WeWork built motion sensors against the platform's dynamic signage layer — a hosted web page, so customization is open-ended: walk into an unbooked room and the screen tells you to book it before you use it.`,
        ],
        quote: `The main thing that attracted us to the Solstice collaboration platform was its reliability. With competing solutions, we had to constantly reboot, the uptime wasn't good, and the devices were not as modern for essentially the same price or less.`,
        quoteWho: `Jacob Robinson, Director of Engineering, WeWork`,
      },
      {
        head: "The outcome",
        paras: [
          `Fewer conference-room squatters and better use of space. Web-based sharing loads security certificates automatically, which means fewer support calls and sharing in seconds, and there is far less physical equipment to install and maintain per room.`,
          `[verify: the 2026 follow-on order is tracked in internal notes, not in the published PDF.]`,
        ],
      },
    ],
  },
  {
    slug: "tamu",
    topic: "highered",
    topicLabel: `HIGHER EDUCATION`,
    org: `TEXAS A&M UNIVERSITY`,
    logo: "/cases/tamu-mark.png",
    logoAspect: 1.21,
    headline: `One cloud tenant for 600+ learning spaces`,
    dek: `A fragmented estate of department-owned tenants became a single pane — and the AV team shipped 100+ projects in a year.`,
    hero: "/cases/tamu-shot.webp",
    lede: [],
    asideLabel: `THE NUMBERS`,
    takeaways: [`600+ learning spaces standardized`, `100+ AV projects in one year`],
    statA: `600+`,
    statALabel: `learning spaces standardized`,
    statB: `100+`,
    statBLabel: `AV projects in one year`,
    body: [
      {
        kicker: "At a glance",
        table: {
          cols: ["Scale", "Products", "Partner", "Era"],
          rows: [["600+ learning spaces", "Pods + Cloud", "University AV Services", "Gen 3-era deployment · published 2025"]],
        },
      },
      {
        head: "The challenge",
        paras: [
          `600+ learning spaces ran on outdated systems from multiple brands with inconsistent interfaces. Departments had bought their own Pods and opened their own cloud tenants, which blocked centralized troubleshooting and drove maintenance costs up.`,
        ],
      },
      {
        head: "The deployment",
        paras: [
          `University Audio Visual Services made Solstice the wireless standard and, in 2023, migrated every Pod into a single cloud tenant: full fleet visibility, standardized branding and interface templates, centralized updates across all campuses. The mandate set hard criteria — latency under half a second, support for Windows, macOS, iOS and Android, and centralized management.`,
        ],
        quote: `Students and professors expect wireless sharing to just work, like it does on their phones. Now, it does.`,
        quoteWho: `Regina Greenwood, University Audio Visual Services IT Director`,
      },
      {
        head: "The outcome",
        paras: [
          `New AV environments deploy significantly faster: over 100 projects completed in one year. Firmware updates and troubleshooting happen remotely instead of by service call, instructors broadcast content to multiple displays at once, and students share with no cables or dongles.`,
        ],
      },
    ],
  },
  {
    slug: "gmu",
    topic: "highered",
    topicLabel: `HIGHER EDUCATION`,
    org: `GEORGE MASON UNIVERSITY`,
    logo: "/cases/gmu-mark.png",
    logoAspect: 1.54,
    headline: `165 Pods behind every display in Horizon Hall`,
    dek: `Six floors and 218,000 square feet built around active learning, with a Pod behind every display in the building.`,
    hero: "/cases/gmu-shot.webp",
    lede: [],
    asideLabel: `THE NUMBERS`,
    takeaways: [`165 Pods in one building`, `28 active-learning classrooms`],
    statA: `165`,
    statALabel: `Pods in one building`,
    statB: `28`,
    statBLabel: `active-learning classrooms`,
    body: [
      {
        kicker: "At a glance",
        table: {
          cols: ["Scale", "Products", "Partner", "Era"],
          rows: [["165 Pods, one building", "Pods + Cloud", "Convergent Technologies Design Group", "Gen 3-era deployment · Horizon Hall opened 2021"]],
        },
      },
      {
        head: "The challenge",
        paras: [
          `George Mason set a target for Horizon Hall: at least 30% of classrooms supporting active-learning pedagogy. That demanded wireless sharing, BYOD from any device, technology needing little to no training, and security and scalability on the university network.`,
        ],
      },
      {
        head: "The deployment",
        paras: [
          `Working with Convergent Technologies Design Group, GMU placed 165 Pods across 28 classrooms, 15 collaboration spaces, 9 conference rooms, 8 huddle spaces and the transitional spaces between them, in a six-floor building opened in January 2021.`,
        ],
        quote: `Behind every display in this building, there is a Solstice Pod. It's supporting the teaching and learning here, the meeting rooms, and the informal spaces outside the classrooms.`,
        quoteWho: `Crystal Clemons, M.Ed, Director, Classroom and Lab Technologies, GMU`,
      },
      {
        head: "The outcome",
        paras: [
          `Touchless collaboration throughout the building on one standard: faculty and students share from any device with little to no training. The integrator credits the simple, familiar interface and the fact that Solstice was already a known quantity on campus.`,
        ],
      },
    ],
  },
  {
    slug: "stevens",
    topic: "highered",
    topicLabel: `HIGHER EDUCATION`,
    org: `STEVENS INSTITUTE OF TECHNOLOGY`,
    logo: "/cases/stevens-mark.png",
    logoAspect: 0.72,
    headline: `The campus that tested its way to a standard`,
    dek: `Solstice won a head-to-head against ClickShare and AirMedia — then cloud analytics decided which rooms got Pods first.`,
    hero: "/cases/stevens-shot.webp",
    lede: [],
    asideLabel: `THE NUMBERS`,
    takeaways: [`0 dongles or hubs to buy and manage`, `Campus-wide rollout steered by cloud analytics`],
    statA: `0`,
    statALabel: `dongles or hubs to buy and manage`,
    statB: `Campus-wide`,
    statBLabel: `rollout steered by cloud analytics`,
    body: [
      {
        kicker: "At a glance",
        table: {
          cols: ["Scale", "Products", "Partner", "Era"],
          rows: [["Campus-wide", "Pods + Cloud analytics", "Academic Multimedia Services", "Gen 3-era deployment · published case study"]],
        },
      },
      {
        head: "The challenge",
        paras: [
          `Stevens needed to move its classrooms off VGA and HDMI at the podium to wireless, networked AV — without adding dongles or hubs for the IT team to buy, stock and manage.`,
        ],
      },
      {
        head: "The deployment",
        paras: [
          `After rigorous testing that included Barco ClickShare and Crestron AirMedia, Stevens chose Solstice for reliability, ease of deployment and the interface. Cloud usage data — room usage, meeting frequency, devices per Pod — steered the campus-wide rollout and kept underused rooms off the purchase order. Pods sit alongside Epson projection, Samsung displays, Crestron control and Shure microphones.`,
        ],
        quote: `Designed from the ground up for collaboration and not just presentation, Mersive is leading the category.`,
        quoteWho: `Harry Ortiz, Associate Director of Academic Multimedia Services`,
      },
      {
        head: "The outcome",
        paras: [
          `Students are avid users, frequently connecting multiple devices to a single Pod. The networked AV also carried a rapid response during a cyber-attack, and the campus emergency alert system now integrates with Solstice so critical messages reach every Pod user.`,
          `[verify: fleet size is not stated in the published PDF — do not publish a Pod count.]`,
        ],
      },
    ],
  },
  {
    slug: "rit",
    topic: "highered",
    topicLabel: `HIGHER EDUCATION`,
    org: `ROCHESTER INSTITUTE OF TECHNOLOGY`,
    logo: "/cases/rit-mark.png",
    logoAspect: 7.18,
    headline: `A standard for the SHED, marquee to makerspace`,
    dek: `One sharing standard across theaters, makerspaces, a 20-foot LED marquee and 32 renovated library classrooms.`,
    hero: "/cases/rit-shot.webp",
    lede: [],
    asideLabel: `THE NUMBERS`,
    takeaways: [`32 classrooms renovated in the Wallace Library`, `Fully operational November 2023`],
    statA: `32`,
    statALabel: `classrooms renovated in the Wallace Library`,
    statB: `Nov 2023`,
    statBLabel: `fully operational`,
    body: [
      {
        kicker: "At a glance",
        table: {
          cols: ["Scale", "Products", "Partner", "Era"],
          rows: [["Whole building + library", "Pods + Cloud", "Kinly", "Gen 3-era deployment · operational November 2023"]],
        },
      },
      {
        head: "The challenge",
        paras: [
          `RIT's Student Hall for Exploration and Development unites technology, art and design under one roof, and needed collaboration tools any student, faculty member or visitor could use without instruction. RIT also serves a large community of hearing-impaired students who previously had to cluster in one part of the lecture room.`,
        ],
      },
      {
        head: "The deployment",
        paras: [
          `Integrator Kinly delivered AV across every space: a Planar LED marquee in the atrium (20 feet wide, 23 feet tall), laser projection in active classrooms and makerspaces, and a renovated Wallace Library with 32 classrooms plus recording studios. RIT standardized on Solstice for wireless sharing throughout the hall.`,
        ],
        quote: `The SHED is a place where students can accelerate their creative concepts and innovations through charismatic collaboration and exploration.`,
        quoteWho: `David Munson, President, RIT`,
      },
      {
        head: "The outcome",
        paras: [
          `Fully operational as of November 2023, from the glass-box theater to the ASL and Deaf Studies community center. Enhanced hearing loops, built with Contacta, put sign-language interpreters on screen via Zoom, so students learn where they are most comfortable.`,
        ],
      },
    ],
  },
  {
    slug: "warwick",
    topic: "highered",
    topicLabel: `HIGHER EDUCATION`,
    org: `UNIVERSITY OF WARWICK`,
    logo: "/cases/warwick-mark.png",
    logoAspect: 3.76,
    headline: `The Oculus, wireless in every learning space`,
    dek: `Warwick's flagship teaching building runs wireless in every room, from small touch screens to the four-screen atrium video wall.`,
    hero: "/cases/warwick-shot.webp",
    lede: [],
    asideLabel: `THE NUMBERS`,
    takeaways: [`Every learning space in The Oculus`, `4-screen video wall in the atrium`],
    statA: `Every`,
    statALabel: `learning space in The Oculus`,
    statB: `4-screen`,
    statBLabel: `video wall in the atrium`,
    body: [
      {
        kicker: "At a glance",
        table: {
          cols: ["Scale", "Products", "Partner", "Era"],
          rows: [["Whole building", "Solstice software + API", "Warwick IT Services", "Earlier Solstice generation · Oculus opened 2016"]],
        },
      },
      {
        head: "The challenge",
        paras: [
          `The Oculus is Warwick's dedicated teaching and learning building, hosting lectures, student-led events and community events. Any presenter, with any background and any device, has to get content on the display without help.`,
        ],
      },
      {
        head: "The deployment",
        paras: [
          `Every learning space shipped with Solstice as the wireless presentation layer, from touch-enabled screens in small rooms to the four-screen atrium video wall. The app is uniform across devices with the same point-and-drag interface as other mobile apps, and IT Services attributes quick adoption partly to that familiarity.`,
        ],
      },
      {
        head: "The outcome",
        paras: [
          `Solstice acts as a communication platform for the whole room rather than a cable replacement. Calendar integration ties on-screen schedule information into the availability screens outside each room through the API, with no additional hardware.`,
        ],
      },
    ],
  },
  {
    slug: "broward",
    topic: "highered",
    topicLabel: `HIGHER EDUCATION`,
    org: `BROWARD COLLEGE`,
    logo: "/cases/broward-mark.png",
    logoAspect: 11.91,
    headline: `Active learning to move the pass rate`,
    dek: `A new science building built around active learning, with instructor moderation as the deciding requirement.`,
    hero: "/cases/broward-shot.jpg",
    lede: [],
    asideLabel: `THE NUMBERS`,
    takeaways: [`70-85% success rate active learning can reach, vs 60-70%`, `1 in 3 students don't pass gateway science courses`],
    statA: `70-85%`,
    statALabel: `success rate active learning can reach, vs 60-70%`,
    statB: `1 in 3`,
    statBLabel: `students don't pass gateway science courses`,
    body: [
      {
        kicker: "At a glance",
        table: {
          cols: ["Scale", "Products", "Partner", "Era"],
          rows: [["Science building classrooms", "Solstice + moderator mode", "Campus technology office", "Earlier Solstice generation · figures per faculty at UBTech 2016"]],
        },
      },
      {
        head: "The challenge",
        paras: [
          `A third of students do not pass introductory gateway science courses, and engagement moves the number: faculty cited active-learning techniques raising class success rates from 60-70% to 70-85% when the college presented at UBTech 2016.`,
        ],
      },
      {
        head: "The deployment",
        paras: [
          `The campus technology officer evaluated content sharing against two hard requirements: students stream anything from their own devices — video, websites, the phone camera — and the instructor moderates. Moderation disqualified several rivals; Solstice moderator mode previews every share before it goes live.`,
        ],
      },
      {
        head: "The outcome",
        paras: [
          `Physics classes now run on the platform: small groups solve a problem, photograph their work with a phone, and share the image to the display for the whole room to discuss. Phones and laptops became the engagement channel instead of the distraction.`,
        ],
      },
    ],
  },
  {
    slug: "lfc",
    topic: "k12",
    topicLabel: `K-12`,
    org: `LYCÉE FRANÇAIS DU CAIRE`,
    logo: "/cases/lfc-mark.png",
    logoAspect: 4.44,
    headline: `A faculty boardroom built into the table`,
    dek: `Samsung displays inset into the boardroom table, fed by Pods, so several people share at once from any device.`,
    hero: "/cases/lfc-shot.webp",
    lede: [],
    asideLabel: `THE NUMBERS`,
    takeaways: [`Multi-share displays inset in the boardroom table`, `K-12 bilingual school, Cairo`],
    statA: `Multi-share`,
    statALabel: `displays inset in the boardroom table`,
    statB: `K-12`,
    statBLabel: `bilingual school, Cairo`,
    body: [
      {
        kicker: "At a glance",
        table: {
          cols: ["Scale", "Products", "Partner", "Era"],
          rows: [["Faculty boardroom", "Pods + Samsung displays", "Interactivo Digital Platforms", "Gen 3-era deployment · published 2025"]],
        },
      },
      {
        head: "The challenge",
        paras: [
          `The Lycée Français du Caire teaches a multicultural student body in French and Arabic and prides itself on preparing students for higher education. The school wanted a faculty boardroom with simple wireless sharing that works for teachers and students alike.`,
        ],
      },
      {
        head: "The deployment",
        paras: [
          `Interactivo Digital Platforms, which has standardized on Solstice across its K-12 education projects, fed Samsung displays inset into the boardroom table from Solstice Pods: several people share simultaneously from computers, phones or tablets through one interface.`,
        ],
        quote: `It allows multiple users to connect and share content wirelessly from their devices to a shared display, eliminating the need for cables and adapters.`,
        quoteWho: `George Khayat, CEO and Founder, Interactivo`,
      },
      {
        head: "The outcome",
        paras: [
          `Faculty meetings run on multiple screens with multiple items shared wirelessly at the same time. The boardroom went from a room with a display to a room built around sharing, and the integrator keeps specifying the same platform across its education work.`,
        ],
      },
    ],
  },
  {
    slug: "convene",
    topic: "enterprise",
    topicLabel: `CORPORATE · WORKSPACE`,
    org: `CONVENE`,
    logo: "/cases/convene-mark.png",
    logoAspect: 6.75,
    headline: `Hospitality-grade rooms, an NPS of 91`,
    dek: `Flexible meeting space inside Class A buildings, where the meeting experience itself is the differentiator.`,
    hero: "/cases/convene-shot.webp",
    lede: [],
    asideLabel: `THE NUMBERS`,
    takeaways: [`91 Convene NPS, vs 45 hospitality average`, `10 cities, 1.7M sq ft projected`],
    statA: `91`,
    statALabel: `Convene NPS, vs 45 hospitality average`,
    statB: `10`,
    statBLabel: `cities, 1.7M sq ft projected`,
    body: [
      {
        kicker: "At a glance",
        table: {
          cols: ["Scale", "Products", "Partner", "Era"],
          rows: [["Multi-city portfolio", "Pods + central console", "In-house technology team", "Earlier Solstice generation · 2018 vintage"]],
        },
      },
      {
        head: "The challenge",
        paras: [
          `Convene competes for tenants and meeting business against a heavily funded field. The cost to create rooms, supply technology and use the spaces cannot outweigh the value they provide, so differentiation had to come from the meeting experience — and had to prove its value.`,
        ],
      },
      {
        head: "The deployment",
        paras: [
          `Solstice runs in meeting rooms and huddle spaces across Convene locations alongside projectors, displays, mixers and wireless mics, backed by on-site technology staff. IT admins secure and manage the Pods centrally from a single console, with real-time alerts and room-level analytics on uptime, utilization and engagement.`,
        ],
        quote: `It's a great product and tool for us and our clients. Its intuitive ease of use makes it as easy to deploy as it is to manage remotely.`,
        quoteWho: `Michael Judeh, Regional Director of Technology, Convene`,
      },
      {
        head: "The outcome",
        paras: [
          `Convene's overall Net Promoter Score is 91, higher than the traditional hospitality average of 45, and the company points to the synergy between workplace design and collaboration technology as a large part of why.`,
        ],
      },
    ],
  },
  {
    slug: "marq",
    topic: "enterprise",
    topicLabel: `CORPORATE · REAL ESTATE`,
    org: `THE MARQ DEVELOPMENT CO.`,
    logo: "/cases/marq-mark.png",
    logoAspect: 4.27,
    headline: `A 110-inch video wall as a sales table`,
    dek: `Four 55-inch displays built into a showroom table, driven by two Pods, selling retail space that doesn't exist yet.`,
    hero: "/cases/marq-shot.webp",
    lede: [],
    asideLabel: `THE NUMBERS`,
    takeaways: [`110-inch video wall built as a table`, `2 Solstice Pods driving it`],
    statA: `110-inch`,
    statALabel: `video wall built as a table`,
    statB: `2`,
    statBLabel: `Solstice Pods driving it`,
    body: [
      {
        kicker: "At a glance",
        table: {
          cols: ["Scale", "Products", "Partner", "Era"],
          rows: [["One showroom", "2 Pods + video wall", "Interactivo Digital Platforms", "Gen 3-era deployment · published case study"]],
        },
      },
      {
        head: "The challenge",
        paras: [
          `The MarQ Development Company sells retail space at The Marquette in Mostakbal City, Egypt, and needed potential tenants to see spaces that do not exist yet: layouts, floor plans and drone footage, at a scale a brochure cannot deliver.`,
        ],
      },
      {
        head: "The deployment",
        paras: [
          `Interactivo built the showroom centerpiece: a custom CNC laser-cut table carrying four 55-inch Samsung displays as one 110-inch surface, driven by two Solstice Pods and a signage player. Buyers gather around the table, connect from laptops and phones, and put several pieces of content up at once.`,
        ],
        quote: `Several people can easily connect their laptop or smartphone and share content at the same time. The system had to be very simple to use. Mersive delivers on that.`,
        quoteWho: `George Khayat, CEO, Interactivo`,
      },
      {
        head: "The outcome",
        paras: [
          `A sales tool that stops people: high-definition visuals of the development at scale, with a salesperson sharing more than one piece of content while a customer adds their own. The integrator calls the system simple yet very sophisticated.`,
        ],
      },
    ],
  },
  {
    slug: "brent",
    topic: "global",
    topicLabel: `GOVERNMENT`,
    org: `BRENT COUNCIL · LONDON`,
    logo: "/cases/brent-mark.png",
    logoAspect: 2.68,
    headline: `107 Pods across a civic centre`,
    dek: `Meeting rooms, huddle spaces, a conference hall and a library — fully wireless, for council staff and the public alike.`,
    hero: "/cases/brent-shot.webp",
    lede: [],
    asideLabel: `THE NUMBERS`,
    takeaways: [`107 Pods across the civic centre`, `Fewer reactive callouts and cable replacements`],
    statA: `107`,
    statALabel: `Pods across the civic centre`,
    statB: `Fewer`,
    statBLabel: `reactive callouts and cable replacements`,
    body: [
      {
        kicker: "At a glance",
        table: {
          cols: ["Scale", "Products", "Partner", "Era"],
          rows: [["107 Pods, one civic centre", "Pods + Cloud + signage", "Unified Consultancy", "Gen 3-era deployment · published case study"]],
        },
      },
      {
        head: "The challenge",
        paras: [
          `Brent Civic Centre hosts council staff, outside visitors and the public across meeting rooms, board rooms and event spaces rented for everything from corporate functions to weddings. Four pain points drove the refresh: cabling maintenance cost, security across internal and public use, no flexible BYOD sharing, and the training burden on every new user.`,
        ],
      },
      {
        head: "The deployment",
        paras: [
          `Working with Unified Consultancy, the council deployed 107 Pods across meeting rooms, huddle spaces, offices, the conference hall, event spaces and the library: fully wireless, agnostic to hardware and platform, with regular security updates, penetration testing and a secure firewall separating internal from guest traffic.`,
        ],
        quote: `It's like an iPad, it doesn't need an instruction guide. You don't need an instruction guide with Mersive.`,
        quoteWho: `Luke Lester, FM Operations Manager, Brent Council`,
      },
      {
        head: "The outcome",
        paras: [
          `Reactive callouts dropped drastically, cords stopped disappearing, and use rose among both staff and community members. The council has since added digital signage on the same platform and plans conferencing support as hybrid work grows.`,
          `[verify: exact callout-reduction figures render as graphics in the source PDF.]`,
        ],
      },
    ],
  },
  {
    slug: "who",
    topic: "global",
    topicLabel: `GOVERNMENT · HEALTH`,
    org: `WHO · EASTERN MEDITERRANEAN`,
    logo: "/cases/who-mark.png",
    logoAspect: 3.26,
    headline: `The situation room that can't go down`,
    dek: `Global health emergencies run from Cairo on an ultra-wide LED wall, with sharing that skips the meeting invite entirely.`,
    hero: "/cases/who-shot.webp",
    lede: [],
    asideLabel: `THE NUMBERS`,
    takeaways: [`21 member states served from the SHOC`, `~745M people in the region it covers`],
    statA: `21`,
    statALabel: `member states served from the SHOC`,
    statB: `~745M`,
    statBLabel: `people in the region it covers`,
    body: [
      {
        kicker: "At a glance",
        table: {
          cols: ["Scale", "Products", "Partner", "Era"],
          rows: [["One operations centre", "Pod + Cisco VC + LED wall", "Interactivo Digital Platforms", "Gen 3-era deployment · published 2025"]],
        },
      },
      {
        head: "The challenge",
        paras: [
          `The Strategic Health Operations Centre at the WHO Regional Office for the Eastern Mediterranean is where international communication happens during health emergencies, for 21 member states and a population near 745 million. Sharing has to be reliable, the conversations are confidential, and the installation timeline was short.`,
        ],
      },
      {
        head: "The deployment",
        paras: [
          `Interactivo integrated the room around an ultra-wide Leyard 1.2-millimeter fine-pitch LED video wall, tied into the WHO's existing Cisco video conferencing. A Solstice Pod lets meeting attendees wirelessly share content into the conferencing system without being connected to the conference itself.`,
        ],
        quote: `Users can share their content easily and without the hassle of being invited to — and then connecting to — a meeting.`,
        quoteWho: `George Khayat, CEO and Founder, Interactivo`,
      },
      {
        head: "The outcome",
        paras: [
          `Multiple users contribute content to high-stakes decision-making without invitation-and-connection overhead, and sharing stays visible to the whole room so meetings run smoothly. The integrator installs Solstice in its top-performing systems where reliability and security are crucial.`,
        ],
      },
    ],
  },
  {
    slug: "bnl",
    topic: "finance",
    topicLabel: `FINANCIAL SERVICES`,
    org: `BNL GRUPPO BNP PARIBAS`,
    logo: "/cases/bnl-mark.png",
    logoAspect: 2.63,
    headline: `150 Pods inside a bank's network`,
    dek: `A security-first evaluation put Solstice in every meeting space of a 75,000 m² headquarters — then two more buildings.`,
    hero: "/cases/bnl-shot.webp",
    lede: [],
    asideLabel: `THE NUMBERS`,
    takeaways: [`150 Pods across three buildings (115 + 15 + 20)`, `75,000 m² headquarters, up to 3,300 workstations`],
    statA: `150`,
    statALabel: `Pods across three buildings (115 + 15 + 20)`,
    statB: `75,000 m²`,
    statBLabel: `headquarters, up to 3,300 workstations`,
    body: [
      {
        kicker: "At a glance",
        table: {
          cols: ["Scale", "Products", "Partner", "Era"],
          rows: [["150 Pods, three buildings", "Pods + central management", "Reply Spa", "Earlier Solstice generation · 2019 vintage"]],
        },
      },
      {
        head: "The challenge",
        paras: [
          `BNL built an award-winning Rome headquarters — 75,000 m², up to 3,300 workstations — and wanted anyone in a meeting to share securely from any device. In banking, data security and centralized management are paramount, so the wireless layer had to clear a security-first evaluation.`,
        ],
      },
      {
        head: "The deployment",
        paras: [
          `IT integrator Reply Spa selected Solstice: 115 Pods installed as the standard across meeting spaces, from informal two-person areas to rooms seating 20, with larger rooms sharing workspace content over the video-conference link. Install was plug and play — connect the Pod to the screen and the corporate network and it appears in central management.`,
        ],
        quote: `Being in the financial industry, data security and centralized management are paramount. We sought the right wireless solution to create a clean, easy and inclusive working environment.`,
        quoteWho: `Antonio Amoroso, Technical Architect, BNL Gruppo BNP Paribas`,
      },
      {
        head: "The outcome",
        paras: [
          `Employees share from their own phones across more than 100 rooms on the corporate network under central IT management. BNL has since added 15 Pods at its Milan HQ and 20 in a separate Rome building, and now runs corporate messaging to meeting rooms on the same platform.`,
          `[verify: the source PDF describes the building as both 12 and 16 stories.]`,
        ],
      },
    ],
  },
];

export const caseBySlug = (slug: string): CaseStory | undefined =>
  CASES.find((c) => c.slug === slug);

/** How many stories a sector filter would show. */
export const caseCount = (key: string): number =>
  key === "all" ? CASES.length : CASES.filter((c) => c.topic === key).length;
