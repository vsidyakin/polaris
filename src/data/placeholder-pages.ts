/* Routes the POC rendered through its generic template branch:
   heading + dek + template tag + a list of placeholder sections.
   Extracted verbatim from the v1.95 single-file POC. */

export interface PhSection {
  t: "ph";
  lbl: string;
  h: string;
  d: string;
  link?: string;
}
export interface RawSection {
  t: "raw";
  html: string;
}
export type Section = PhSection | RawSection;

export interface PlaceholderPage {
  /** <h1> text */
  t: string;
  /** deck paragraph under the heading */
  dek: string;
  /** IA template code shown in the review chip */
  tpl: string;
  /** pre-launch page: not published at initial launch */
  /** `true` prints the generic pre-launch chip; a string is printed verbatim,
   *  which is how Launch carries "Shipping Q1 2027" instead. Widened to match
   *  PageIntro's own `pre?: boolean | string` -- it always accepted the string,
   *  this type just did not pass it through. */
  pre?: boolean | string;
  /** blocking owner shown as a "gated" chip */
  gate?: string;
  /** device illustration keyed into DEV */
  media?: string;
  secs: Section[];
}

const ph = (lbl: string, h: string, d: string, link?: string): PhSection => ({
  t: "ph",
  lbl,
  h,
  d,
  link,
});

export const PLACEHOLDER_PAGES: Record<string, PlaceholderPage> = {
"products/launch":{t:"Launch",dek:"[PRE-LAUNCH placeholder · product render owed: no Launch asset exists in the hardware library yet] Wireless share for every display: one-time hardware purchase, app-free basics.",tpl:"T4",pre:"Shipping Q1 2027",media:"stick",secs:[
  ph("Positioning","The entry point","Share-first (BYOD) device at entry price; hardware sale, not subscription. Name pending Q12 workshop."),
  ph("Fit","Where Launch belongs","Classrooms, signage estates, overflow spaces: displays that need sharing, not conferencing."),
  {t:"raw",html:`<div class="clmband reveal"><div class="kicker" style="color:#7ce3a8">How Launch is bought</div><h2>One-time hardware purchase. No subscription.</h2><div class="famtbl pricetbl"><table><tr><th style="width:46%">How you pay</th><th>Launch</th></tr><tr><td>Payment model</td><td class="y">One-time hardware purchase &middot; no recurring licence</td></tr><tr><td>Price &middot; corporate</td><td class="y">$450.00 one-time [placeholder pending pricebook]</td></tr><tr><td>Price &middot; education</td><td class="y">$250.00 one-time [placeholder pending pricebook]</td></tr><tr><td>Wireless sharing if nothing is renewed</td><td class="y">&#10003; sharing is not licensed on Launch: it keeps working</td></tr><tr><td>Warranty</td><td class="p">[hardware warranty terms: pending the Launch PRD]</td></tr><tr><td>Cloud management</td><td class="y">&#10003; Polaris Cloud</td></tr></table></div><p class="prwhat"><b>Launch is a hardware purchase, not a subscription</b> &mdash; no renewal, and wireless sharing keeps working with no licence. Cloud management is included.</p><p class="prpartner"><a href="/partners/portal">Partner pricing &rarr;</a></p><p class="note">Launch is pre-launch: not yet orderable. Essentials and Pro pricing is live on <a href="/products/family">the family page</a>.</p></div>`},
  {t:"raw",html:`<section class="sect reveal flush"><div class="kicker">Open specs: what we can publish today</div><h2>The specification sheet, inline.</h2><p class="sdek">Same transparency policy as Pro and Essentials. Launch has no hardware PRD yet, so the sheet says so instead of pretending.</p><details class="mtbl" open><summary><b>Sharing</b><span class="mtbl-n">3 rows <i class="mtbl-c">&#9662;</i></span></summary><div class="famtbl mtbl-t"><table><tr><th style="width:44%">Specification</th><th>Launch</th></tr><tr><td>Simultaneous shares in the workspace</td><td class="p">Share-first: designed around a single live source [count publishes with the datasheet]</td></tr><tr><td>Web-join from the browser: no app, no download</td><td class="y">&#10003;</td></tr><tr><td>Wireless sharing after any subscription lapse</td><td class="y">&#10003; sharing is not licensed on Launch: it keeps working</td></tr></table></div></details><details class="mtbl"><summary><b>I/O</b><span class="mtbl-n">2 rows <i class="mtbl-c">&#9662;</i></span></summary><div class="famtbl mtbl-t"><table><tr><th style="width:44%">Specification</th><th>Launch</th></tr><tr><td>HDMI output</td><td>&#10003; output only: no HDMI input on Launch [family matrix]</td></tr><tr><td>Ethernet &middot; Wi-Fi radio</td><td class="p">[no Launch hardware PRD on file (checked Hardware folder + Confluence): hardware team to supply]</td></tr></table></div></details><details class="mtbl"><summary><b>Compute &amp; power</b><span class="mtbl-n">2 rows <i class="mtbl-c">&#9662;</i></span></summary><div class="famtbl mtbl-t"><table><tr><th style="width:44%">Specification</th><th>Launch</th></tr><tr><td>Chipset / SoC &middot; RAM &middot; storage</td><td class="p">[no Launch hardware PRD on file: hardware team to supply]</td></tr><tr><td>Power</td><td class="p">[hardware team to supply]</td></tr></table></div></details><details class="mtbl"><summary><b>Commercial</b><span class="mtbl-n">2 rows <i class="mtbl-c">&#9662;</i></span></summary><div class="famtbl mtbl-t"><table><tr><th style="width:44%">Specification</th><th>Launch</th></tr><tr><td>Model</td><td class="y">One-time hardware purchase. No subscription</td></tr><tr><td>Cloud management</td><td class="y">&#10003; Polaris Cloud [family matrix]</td></tr></table></div></details><p class="note">[No Launch hardware PRD exists (checked the Hardware folder and Confluence). Every bracketed cell publishes only after the hardware team supplies the spec.]</p></section>`}]},
"products/link":{t:"Link",dek:"[Ships Q3 2026, confirm date · placeholder page] The pod hosts the meeting: laptop freed, any platform.",tpl:"T4",pre:true,media:"toggle",secs:[
  ph("Positioning","Upsell on Pro","With Link, the pod hosts the call: the meeting runs on the room hardware (camera, mic, and compute), started from your device, which drops to share-and-chat duty. Name pending Q12."),
  ph("Specs","Placeholder","Follows T4 pattern at launch.")]},
"products/host":{t:"Host",dek:"[Ships Q4 2026, confirm date · placeholder page] The room hosts the meeting: native clients, no user device required.",tpl:"T4",pre:true,media:"tablet",secs:[
  ph("Positioning","The top of the ladder","Hosted by the room (BYOM+) with the real Teams/Zoom/Webex/Meet apps, chosen per meeting. Hardware sale onto Essentials or Pro; pricing model TBD (Q13). Name pending Q12."),
  ph("Specs","Placeholder","Follows T4 pattern at launch.")]},
/* Engage is the engagement layer, split out from Route on 25 Aug 2026: polling and
   quizzing are their own product, sold on their own terms, and Route is the routing
   and moderation layer underneath. Both ship in the same window, so both carry the
   ship-date flag the September early publish strips by. `tablet` is a borrowed
   silhouette — no Engage asset exists yet. */
"products/engage":{t:"Engage",dek:"[Ships Q1 2027, confirm date · placeholder page] Polling, quizzing and participation records: engagement you can see, during the session and after it.",tpl:"T4",pre:true,media:"tablet",secs:[
  ph("Positioning","The engagement layer","Questions live or prepared, answered from any device through the browser, results rendering on the workspace while the room can still act on them, and the participation record afterwards. Sits on top of Route rather than inside it: Route decides what reaches a display, Engage measures who is with you."),
  /* Carried over verbatim from the Active Learning page when polling split out —
     the copy was written and reviewed, and the capability did not change, only the
     product it is sold under. */
  {t:"raw",html:`<section class="sect reveal flush"><div class="kicker">Polling &amp; engagement</div><h2>Polling that tells you who's with you.</h2><p class="sdek">Engagement you can see: during the lesson, and after it.</p><ul class="cnv-list"><li><b>Create questions live or ahead of time.</b> Improvise a comprehension check mid-lesson, or build the question set with the lesson plan.</li><li><b>Answer from any device: no app, no download.</b> Students respond via web-join from the browser on their own hardware. Nothing to install, nothing to hand out.</li><li><b>Anonymous or by name.</b> Anonymous mode for honest signals on hard topics; named mode for formative assessment and participation records.</li><li><b>Results render live on the workspace.</b> The room watches understanding take shape on the display, and talks about it while it's still warm.</li><li><b>Reviewable afterward.</b> Every session's participation, answers, and trends over time: the record the anecdote never keeps.</li></ul></section>`},
  ph("Packaging","How Engage is bought","[Commercial model open: included with a subscription, or bundled with Pro, with an upcharge on Essentials under consideration. Pricing and packaging pending the commercial call.]"),
  ph("Specs","Placeholder","Follows T4 pattern at launch.")]},
"compare/barco":{t:"Polaris vs Barco ClickShare",dek:"They put a button in your hand. We put the meeting in the room, and nothing on your laptop.",tpl:"T6",secs:[
  ph("Battlegrounds","Three themes","Web-join vs Button/app · workspace depth vs single-share · subscription-with-warranty vs hardware + SmartCare refresh cycle."),
  ph("Concessions","Where ClickShare is strong","Semi-balanced pro/pro cards (Airtame pattern): enterprise brand, Button simplicity."),
  ph("Matrix","Feature drill-down","Pulled from canonical matrix; rows expandable to technical detail."),
  ph("Proof","Third-party reviews","G2/peer quotes.")]},
"compare/airtame":{t:"Polaris vs Airtame",dek:"They compare themselves to us. Fair enough: here's the whole picture.",tpl:"T6",secs:[
  ph("Battlegrounds","Three themes","Workspace & multi-share depth · true BYOM bridging · cross-network sharing (they can't). Update-policy transparency answered head-on with linked policy."),
  ph("Concessions","Where Airtame is genuinely strong","Openness culture, simple SKUs, signage focus."),
  ph("Matrix","Feature drill-down","Canonical matrix rows incl. web-join, warranty-with-subscription."),
  ph("Proof","Third-party reviews","")]},
"legal":{t:"Legal",dek:"Privacy policy, terms of use, EULA, warranty, cookie policy, accessibility statement: every legal surface of the site, in one place.",tpl:"T2",secs:[
  ph("Blocked: counsel (D-15)","Privacy policy","[Placeholder — no privacy policy exists yet for the new site. Counsel owner and due date required before launch; forms cannot legally collect leads without it.]"),
  ph("Blocked: counsel (D-15)","Terms of use & EULA","[Placeholder — terms of use for the website and the product EULA. Pending counsel.]"),
  ph("Blocked: counsel (D-15)","Warranty & cookie policy","[Placeholder — life-of-subscription warranty terms (Q9-adjacent) and the cookie/consent policy.]"),
  ph("Drafting","Accessibility statement","[Placeholder — the v0.90 token work makes an honest WCAG AA statement possible; draft after the production accessibility audit.]")
]},
"resources/downloads":{t:"Apps & downloads",dek:"The apps for phones and Mersive Solstice Gen 3 desktops, and the reminder that guests never need one. This page is the 301 target for the legacy /download URL, the busiest address on the old site.",tpl:"T8",secs:[
  ph("Polaris mobile app","iOS & Android, for Polaris rooms","Share and control from the phone in your pocket. Polaris rooms use the Polaris app; it does not manage the Gen 3 estate. [Official store badges: assets owed; App Store and Google Play links placeholder.]"),
  ph("Mersive Solstice mobile app","iOS & Android, for the Gen 3 estate","A separate app for Mersive Solstice Gen 3 rooms: if your estate is mid-transition, phones carry both apps and each talks to its own generation. [Official store badges: assets owed; store links placeholder.]"),
  ph("What the apps do","Three jobs, no more","Share from the phone in your pocket: screen, photos, or a live whiteboard straight onto the room display. Control the workspace from your seat: rearrange, promote, clear. One app per platform generation: the Polaris app for Polaris rooms, the Mersive Solstice app for Gen 3. What they look like lives where it stays current: the store listings."),
  ph("Desktop · Gen 3 only","Mersive Solstice app for Windows & macOS","The desktop client exists only for Mersive Solstice Gen 3 rooms, installed or portable. Polaris has no desktop client by design: the browser is the client. [Links to the live download portal until cutover.]"),
  ph("The point","Most people never visit this page","Polaris shares from the browser at app.mersive.com: guests, one-time visitors, and most employees never install anything. The apps exist for phone sharing and control, and for the Gen 3 estate. That is the story: the best download is the one you skip.",'platform/how')
]},
"resources/opensource":{t:"Open source & licenses",dek:"Polaris is built on open-source software, and open source comes with obligations we meet in the open, like everything else here.",tpl:"T8",secs:[
  ph("Third-party notices","The software inside the software","Polaris firmware is built on a Yocto-based Linux BSP (MediaTek platform) and includes GPL, LGPL, and permissively-licensed components. This page lists every third-party component, its license, and its copyright notice. [LEGAL REVIEW REQUIRED: notice list generated from the build manifest — GPL/LGPL compliance is a legal obligation, not a courtesy.]"),
  ph("Mersive EULA","The Mersive end user license agreement","The EULA that governs Polaris software and subscriptions, published in the open like everything else on this page. [Document owed: legal, with the D-15 legal-pages batch; links here and in the footer when counsel delivers.]"),
   ph("Source availability","Get the corresponding source","For copyleft-licensed components (GPL/LGPL), corresponding source is available: download links per firmware release [placeholder — publish alongside release notes], plus a written-offer address for physical media as the licenses require. WolfVision and Crestron both publish this; so do we."),
  ph("This website","Open data behind what you're looking at","The star chart on our 404 page is not decoration we drew by hand: every position is projected from published catalogues. Stars come from the <b>HYG database v4.1</b> (a merge of Hipparcos, the Yale Bright Star catalogue and Gliese), used under <b>CC BY-SA 4.0</b> &mdash; <a href=\"https://github.com/astronexus/HYG-Database\" rel=\"noopener\">github.com/astronexus/HYG-Database</a>. The constellation figures are the IAU-derived line set from <b>d3-celestial</b>, used under the <b>BSD 3-Clause</b> license &mdash; <a href=\"https://github.com/ofrohn/d3-celestial\" rel=\"noopener\">github.com/ofrohn/d3-celestial</a>. Attribution is a condition of both, and a page about meeting license obligations is a poor place to skip one."),
  ph("What we contribute back","Upstream, where it makes sense","[Placeholder — engineering to confirm any upstream contributions worth citing; credibility content, not obligation.]"),
  ph("Build note","[BUILD DECISION]","Generate the notice list automatically from the Yocto build manifest per release so this page can never drift from the shipping firmware. Wire the per-release source bundles into the same pipeline as public release notes.")]},
};
