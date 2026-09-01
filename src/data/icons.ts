/* Inline SVG icon sets used across the marketing pages.
   Extracted verbatim from the v1.95 single-file POC. */

/* ---------- NIC: the glyphs in the top navigation bar ----------
   Six menu words, plus Connect, Contact and the Try Polaris CTA.
   These break the recipe every other set in this file follows, and both
   departures are forced by the size they are drawn at — 16px, against 14px type.

   ONE COLOUR, AND IT IS `currentColor`. Every other set hard-codes lilac for the
   object and mint for the part carrying the meaning. Two colours inside 16px is
   two colours nobody can resolve, and worse, a fixed lilac would be a colour the
   nav row cannot change: the header's rule is that state — hover, open, current
   page — is the ONLY thing that varies, and everything else stays put. Inheriting
   `currentColor` keeps the glyph on that rule, so it brightens to white with its
   label instead of sitting there as a third colour that never responds.

   ALMOST NO DETAIL. Two to four strokes each, no interior marks, nothing that
   depends on a gap smaller than the stroke. A globe here gets one meridian, not
   three; Partners is two overlapping circles rather than the handshake or the two
   figures CNVIC.partner can afford at 24px, because shoulders and fingers at 16px
   are grey fuzz. The test each of these had to pass is whether the silhouette
   still reads with the label covered up.

   Stroke is 2 on a 24 box — heavier than the 1.7 used everywhere else, and that
   is what keeps them from looking soft. Scaled to 16px a 1.7 stroke lands on
   1.13 device pixels at 1x, so every edge is antialiased across two pixel
   columns and nothing in the glyph is ever a solid line; 2 gives 1.33px, which
   is enough to hold an edge against the header's translucent backdrop. If these
   ever need to be smaller again, raise the stroke to match — the blur is the
   sub-pixel stroke, not the size. */
export const NIC = {
  /** Platform — a globe. */
  globe:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="8.6"/><path d="M3.4 12h17.2"/><path d="M12 3.4c2.7 2.8 2.7 14.4 0 17.2-2.7-2.8-2.7-14.4 0-17.2z"/></svg>`,
  /** Products — an isometric box: the pod, as a shipped thing. */
  box:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 2.9l8.4 4.5v9.2L12 21.1l-8.4-4.5V7.4z"/><path d="M3.6 7.4L12 12l8.4-4.6M12 12v9.1"/></svg>`,
  /** Solutions — a bulb. The menu is use cases and industries: the answer, not
      the hardware. A puzzle piece is the other convention here and it is illegible
      this small; a bulb survives being 16px because its outline is one blob. */
  bulb:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.9a6.5 6.5 0 00-3.8 11.8c.7.5 1.1 1.3 1.1 2.1v.5h5.4v-.5c0-.8.4-1.6 1.1-2.1A6.5 6.5 0 0012 2.9z"/><path d="M10.1 20.6h3.8"/></svg>`,
  /** Compare — two bars of different heights on a baseline. A balance scale is
      the truer metaphor and needs a beam, a post and two pans, which is four more
      strokes than this size has room for. Two unequal bars say "one against the
      other" in three. */
  bars:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4.6 20.6h14.8"/><path d="M9.2 20.6V9.4M15.4 20.6V3.8"/></svg>`,
  /** Resources — an open book. Docs, downloads, firmware notes, the blog and the
      glossary are all reading. */
  book:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 6.6C10.3 5.2 8.2 4.5 5.4 4.5H3.3v13h2.1c2.8 0 4.9.7 6.6 2.1 1.7-1.4 3.8-2.1 6.6-2.1h2.1v-13h-2.1c-2.8 0-4.9.7-6.6 2.1z"/><path d="M12 6.6v13"/></svg>`,
  /** Partners — two overlapping circles. Not a handshake: at 16px a handshake is
      an indistinct grey lump, and the overlap itself is the idea. */
  rings:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="12" r="6.3"/><circle cx="15" cy="12" r="6.3"/></svg>`,
  /** Connect — a broadcast: a source with two pairs of arcs leaving it. The
      button opens the screen-key panel, and what that panel does is throw a
      laptop at a room, so the glyph is the signal rather than a plug or a chain.
      Inherits the button's mint through `currentColor` like the rest. */
  signal:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="2" fill="currentColor" stroke="none"/><path d="M8.5 15.5a5 5 0 010-7M15.5 8.5a5 5 0 010 7"/><path d="M5.3 18.7a9.5 9.5 0 010-13.4M18.7 5.3a9.5 9.5 0 010 13.4"/></svg>`,
  /** Contact — an envelope. */
  mail:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="2.8" y="5.2" width="18.4" height="13.6" rx="2.2"/><path d="M3.6 7.6L12 13.3l8.4-5.7"/></svg>`,
  /** Try Polaris — a four-point star, and the one glyph in this set that is
      FILLED rather than stroked. Two reasons, and they agree. It sits on the
      primary CTA, the only solid button in the header, so a solid mark is the
      one that belongs on it — an outline there reads as a lighter-weight thing
      than the button it is on. And a filled shape is the crispest object you can
      put at 16px: no stroke means no sub-pixel stroke, which is the whole of the
      blur problem described above. It is also, conveniently, the north star. */
  star:`<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M12 1.8c.9 6.4 3.8 9.3 10.2 10.2-6.4.9-9.3 3.8-10.2 10.2-.9-6.4-3.8-9.3-10.2-10.2C8.2 11.1 11.1 8.2 12 1.8z"/></svg>`
};

/* ---------- SIC: the glyphs on the dropdown rows ----------
   One mark to the left of the label on every ROOT row of every menu — thirty of
   them, grouped below in menu order. Same recipe as NIC above, for the same
   reason: these are drawn at 15px against the same 14px type, so they take NIC's
   heavier stroke-2 on a 24 box, two to four strokes each, and no interior detail
   that depends on a gap smaller than the stroke.

   `currentColor`, like NIC and unlike every other set in this file. The header's
   rule is that state is the only thing that varies in a nav row: a hard-coded
   lilac would be a third colour that sits still while its label brightens to
   white on hover and on the current page. Inheriting means the glyph moves with
   the row.

   THE ROOT ROWS ONLY. The indented children — Enterprise under Corporate, the
   four support documents, the transition page under Mersive Solstice — carry no
   mark, and that is the rule that keeps the marks worth having. A mark on every
   row is a column of marks; nesting here is shown by the indent and the hairline
   rule down the sub-group (see the `.navsub` block in global.css), and a child
   with its own glyph competes with the parent it hangs off.

   WHAT "READS AT 15px" MEANT IN PRACTICE. Several obvious picks were rejected
   for being the same silhouette as a neighbour rather than for being wrong:
   Careers wanted a briefcase, which Corporate already has; a lifebuoy for
   Support collapses into NIC's Partners rings; Case studies as a quote mark is
   an outline blob in a stroked set. Duplication ACROSS panels is fine and there
   is some — two panels are never open at once — but duplication inside one panel
   is not, and that is what each choice below was checked against. */
export const SIC = {
  /* ----- Platform ----- */
  /** How Polaris collaboration works — a staircase: one process, going up. */
  steps:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 19.5h6v-5h5.5v-5H21"/></svg>`,
  /** The workspace — a 2x2 grid: every share, side by side, which is the whole
      idea of the page. */
  grid:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="3.2" y="3.6" width="17.6" height="16.8" rx="2.2"/><path d="M12 3.6v16.8M3.2 12h17.6"/></svg>`,
  /** Polaris Hybrid: where meetings live — three stacked planes. The taxonomy is
      layers of meeting model, and this is the one glyph in the set that says
      "levels of the same thing" rather than naming an object. */
  layers:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 3.2l8.4 4.2-8.4 4.2L3.6 7.4z"/><path d="M3.6 12.2l8.4 4.2 8.4-4.2M3.6 16.6l8.4 4.2 8.4-4.2"/></svg>`,
  /** Cross-network sharing — two nodes and one arc over the gap between them.
      Same reading as XIC.crossnet on the page itself, reduced to three strokes. */
  bridge:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="5.5" cy="17" r="2.6"/><circle cx="18.5" cy="17" r="2.6"/><path d="M5.5 13.6C5.5 7.2 18.5 7.2 18.5 13.6"/></svg>`,
  /** Security & Trust Center — a padlock. Not a shield: Regulated Industries in
      the Solutions panel is the shield, and while the two panels never open
      together, a lock is the better fit for a page about the posture itself. */
  lock:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4.2" y="10.4" width="15.6" height="10" rx="2.2"/><path d="M8 10.4V7.8a4 4 0 018 0v2.6"/></svg>`,
  /** Polaris Cloud — a cloud, in one path. */
  cloud:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M7.6 18.6h9.6a3.8 3.8 0 00.4-7.6 5.7 5.7 0 00-10.9-1.2 3.9 3.9 0 00.9 8.8z"/></svg>`,
  /** TCO calculator — an axis and a line across it. A calculator keypad is the
      literal answer and it is six dots inside a 15px box, which is mush; what
      the page actually shows is cost over ten years, and this is that. */
  trend:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4.5v15h15.5"/><path d="M7.5 15.5l3.5-4 3 2.5 4.5-6"/></svg>`,
  /** The platform story: Sol to Polaris — a clock. The page is a lineage, and
      the hands say "over time" in two strokes where a timeline needs five. */
  clock:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="8.6"/><path d="M12 7.4V12l3.6 2.2"/></svg>`,

  /* ----- Products ----- */
  /** The Polaris Family — the north star, and it is `NIC.star` ITSELF rather than
      a copy of it. Damian's brief was "the same star icon as the Try Polaris
      button", and referencing the constant is the only way to keep that true:
      the two marks cannot drift because there is one drawing.

      This is the one entry in the set that is filled rather than stroked, which
      the row CSS has to know about — a solid shape dimmed to 0.8 reads as a
      printing error rather than as restraint, the same finding that produced
      `.navic-solid` for the header's copy of it. `global.css` keys that off the
      svg's own `fill` attribute, so nothing here has to declare it.

      Two earlier attempts, both replaced: three chassis of ascending height (a
      bar chart at 15px, and it ranked a line that `rulings.ts` insists is one
      platform in different boxes) and a card with a second behind it. */
  star: NIC.star,
  /** Mersive Solstice — the sun. The previous generation, and the name is right
      there. */
  sun:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.9v2.6M12 18.5v2.6M2.9 12h2.6M18.5 12h2.6"/></svg>`,
  /** Which Polaris is right? — a compass. The selector is a question about which
      way to go. */
  compass:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><circle cx="12" cy="12" r="8.6"/><path d="M15.4 8.6l-2.1 5.3-5.3 2.1 2.1-5.3z"/></svg>`,
  /** Start a trial — a play mark. The one row in the nav that is an action rather
      than a subject. */
  play:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><circle cx="12" cy="12" r="8.6"/><path d="M10.2 8.4l6 3.6-6 3.6z"/></svg>`,

  /* ----- Compare ----- */
  /** Compare hub — two arrows passing each other. A table of columns is the
      other convention and it is indistinguishable from `grid` above at this size. */
  versus:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3.6 9h11M11.2 5.6L14.6 9l-3.4 3.4"/><path d="M20.4 15h-11M12.8 11.6L9.4 15l3.4 3.4"/></svg>`,
  /** Why not a VTC room system? — a circle with a bar through it. The row is a
      question whose answer is "not this", and the glyph says so. */
  forbid:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="8.6"/><path d="M6.4 17.6L17.6 6.4"/></svg>`,
  /** vs Dongles — a plug. */
  plug:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3.4v5.2M15 3.4v5.2"/><path d="M5.8 8.6h12.4v3.2a6.2 6.2 0 01-12.4 0z"/><path d="M12 18v2.6"/></svg>`,

  /* ----- Resources ----- */
  /** Support & Documents — a page with a folded corner. Portrait, so it does not
      read as another of the set's landscape rectangles. */
  doc:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M6 3.4h7.6L19 8.8v11.8H6z"/><path d="M13.4 3.4v5.4H19"/></svg>`,
  /** Case studies — a medal. These are customer outcomes, and the ribbon is what
      separates the silhouette from every other circle in the set. */
  award:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="9.4" r="6"/><path d="M8.6 14.9L7.4 21.2l4.6-2.5 4.6 2.5-1.2-6.3"/></svg>`,
  /** Blog — a pen. */
  pen:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.4 19.6l1-4.1 11-11 3.1 3.1-11 11z"/><path d="M14.4 6.5l3.1 3.1"/></svg>`,
  /** Careers — one figure. A briefcase is the obvious pick and Corporate has it. */
  person:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="8.2" r="3.6"/><path d="M5.2 20.4a6.8 6.8 0 0113.6 0"/></svg>`,
  /** Mersive Ecosystem — a hub with three satellites. The only glyph here with
      more than four strokes, and it earns them: without the links it is four
      unrelated dots. */
  nodes:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="2.6"/><circle cx="5.2" cy="5.6" r="2"/><circle cx="18.8" cy="5.6" r="2"/><circle cx="12" cy="20" r="2"/><path d="M6.7 7.1l3.5 3.2M17.3 7.1l-3.5 3.2M12 14.6v3.4"/></svg>`,
  /** Glossary — short terms against longer definitions, which is what a glossary
      looks like from across the room. */
  list:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7.2h3M4 12h3M4 16.8h3"/><path d="M11 7.2h9M11 12h9M11 16.8h6"/></svg>`,
  /** Developers — a terminal: a window with a prompt and a cursor. Angle brackets
      were the obvious pick and `code` below already has them, four rows down in
      the same panel — which is the one duplication this set does not allow. A
      terminal is also the truer mark: the row goes to the developer
      documentation, not to a source repository. */
  terminal:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2.8" y="4.4" width="18.4" height="15.2" rx="2.4"/><path d="M7 10l2.6 2.4L7 14.8M12.4 15.2h4.6"/></svg>`,
  /** Open source & licenses — angle brackets. */
  code:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 7.4L4.4 12 9 16.6M15 7.4L19.6 12 15 16.6"/></svg>`,
  /** Who we are — two figures, against Careers' one. Four rows apart in the
      panel, and the second head is the difference. */
  people:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="9.2" cy="8.4" r="3.4"/><path d="M3 20a6.2 6.2 0 0112.4 0"/><path d="M16.2 6.2a3.4 3.4 0 010 4.6M17.6 15.2A6.2 6.2 0 0121 20"/></svg>`,
  /** Contact us — an envelope, deliberately the same drawing as `NIC.mail` on the
      header's Contact link. The same destination should not have two marks. */
  envelope:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="2.8" y="5.2" width="18.4" height="13.6" rx="2.2"/><path d="M3.6 7.6L12 13.3l8.4-5.7"/></svg>`,

  /* ----- Partners ----- */
  /** Partner program — a certificate with a ribbon: the program is a standing
      credential rather than a transaction. */
  cert:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3.4" y="4.4" width="17.2" height="11" rx="2.1"/><path d="M7.4 19.6l4.6-2.4 4.6 2.4"/></svg>`,
  /** Become a partner — a plus. The action rows in this menu are the two that
      matter commercially, and this is the one that adds somebody. */
  plusc:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="8.6"/><path d="M12 8v8M8 12h8"/></svg>`,
  /** Partner portal (login) — a key, for the one row in the nav behind a sign-in. */
  key:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="8.2" cy="12" r="3.8"/><path d="M12 12h8.2M17.4 12v3.2M20.2 12v2.4"/></svg>`,
  /** Where to buy — a map pin. */
  pin:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 21c4.2-4.9 6.4-8.3 6.4-11.1A6.4 6.4 0 105.6 9.9C5.6 12.7 7.8 16.1 12 21z"/><circle cx="12" cy="9.7" r="2.2"/></svg>`,
  /** How to buy — a cart. */
  cart:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.8 4.6h2.5l2.8 10.5h9.3l2.4-7.5H6.5"/><circle cx="9.6" cy="19" r="1.6"/><circle cx="17.1" cy="19" r="1.6"/></svg>`,
  /** Customer & Partner Hub — a house. The hub is where a customer or a partner
      starts, and `nodes` above is already the network reading of the word. */
  home:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3.6 10.8L12 4l8.4 6.8v9.4H3.6z"/><path d="M9.6 20.2v-6h4.8v6"/></svg>`,

  /* ----- Solutions ----- */
  /** Wireless collaboration — a display with a wireless fan inside it. The fan
      is the meaning and the screen is what it lands on. */
  cast:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4.4" width="18" height="13.2" rx="2.2"/><circle cx="7" cy="14.6" r="0.9" fill="currentColor" stroke="none"/><path d="M7 11.8a2.8 2.8 0 012.8 2.8M7 8.9a5.7 5.7 0 015.7 5.7"/></svg>`,
  /** Hybrid conferencing — a video camera. The spout is what makes the
      silhouette unmistakable next to the three other rectangles in this set. */
  camera:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="2.8" y="6.4" width="12.6" height="11.2" rx="2.4"/><path d="M15.4 10.6l5.8-2.9v8.6l-5.8-2.9z"/></svg>`,
  /** Digital signage — a panel on a stand. Signage is a display that belongs to
      the building rather than to a meeting, and the stand is that. */
  panel:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3.8" width="18" height="12.4" rx="2.2"/><path d="M12 16.2v3.6M8.2 19.8h7.6"/></svg>`,
  /** Engage — a speech bubble. Drawn for Active Learning, and it followed the
      participation half of that product when it split: Engage is polling and
      answers, which is what a bubble says. Route took `nodes` instead, one source
      fanning out to several displays. A mortarboard would have been the obvious
      pick and it belongs to Education below, which is the industry. */
  bubble:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3.2" y="4.4" width="17.6" height="11.6" rx="2.4"/><path d="M8.6 16v3.8L12.8 16"/></svg>`,
  /** Corporate — a briefcase. */
  briefcase:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="2.8" y="7.4" width="18.4" height="11.2" rx="2.2"/><path d="M9 7.4V5.9a1.6 1.6 0 011.6-1.6h2.8A1.6 1.6 0 0115 5.9v1.5"/></svg>`,
  /** Education — a mortarboard: the board, and the cap band under it. */
  cap:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4.2L21.6 8.6 12 13 2.4 8.6z"/><path d="M6.4 10.4v4.4c0 1.9 2.5 3.4 5.6 3.4s5.6-1.5 5.6-3.4v-4.4"/></svg>`,
  /** Regulated Industries — a shield, and just the shield. Government, healthcare
      and financial services share one thing and it is the compliance boundary. */
  shield:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 3.2l8 3.2v5.4c0 4.7-3.3 8-8 9.4-4.7-1.4-8-4.7-8-9.4V6.4z"/></svg>`
};

export const IC ={
  browser:`<svg viewBox="0 0 24 24" fill="none" stroke="#a58cff" stroke-width="1.8"><rect x="2.5" y="4" width="19" height="16" rx="2.5"/><path d="M2.5 9h19M6 6.7h.01M8.6 6.7h.01M11.2 6.7h.01"/></svg>`,
  phone:`<svg viewBox="0 0 24 24" fill="none" stroke="#7ce3a8" stroke-width="1.8"><rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M10.5 18.5h3"/></svg>`,
  laptop:`<svg viewBox="0 0 24 24" fill="none" stroke="#e8c76a" stroke-width="1.8"><rect x="4" y="4.5" width="16" height="11" rx="1.8"/><path d="M2 19h20"/></svg>`,
  globe:`<svg viewBox="0 0 24 24" fill="none" stroke="#6d5bb8" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.5 3 14 0 18M12 3c-3 3.5-3 14 0 18"/></svg>`,
  shield:`<svg viewBox="0 0 24 24" fill="none" stroke="#6d5bb8" stroke-width="1.8"><path d="M12 3l7.5 3v5.5c0 4.7-3.2 7.9-7.5 9.5-4.3-1.6-7.5-4.8-7.5-9.5V6l7.5-3z"/><path d="M8.8 12l2.3 2.3 4.1-4.4"/></svg>`,
  workspace:`<svg viewBox="0 0 24 24" fill="none" stroke="#6d5bb8" stroke-width="1.8"><rect x="3" y="4" width="18" height="14" rx="2"/><path d="M12 4v14M3 11h18"/></svg>`,
  web:`<svg viewBox="0 0 24 24" fill="none" stroke="#6d5bb8" stroke-width="1.8"><rect x="3" y="4" width="18" height="14" rx="2"/><path d="M3 8.5h18M6.2 6.3h.01M8.4 6.3h.01"/><path d="M9 13.5l2 2 4-4.5"/></svg>`
};

export const XIC ={
  webjoin:`<svg viewBox="0 0 28 28" fill="none"><defs><linearGradient id="gx1" x1="0" y1="0" x2="28" y2="28"><stop offset="0" stop-color="#a58cff"/><stop offset="1" stop-color="#7ce3a8"/></linearGradient></defs><rect x="2.5" y="4.5" width="23" height="18" rx="3" stroke="url(#gx1)" stroke-width="1.7"/><path d="M2.5 9.5h23" stroke="url(#gx1)" stroke-width="1.7"/><circle cx="6" cy="7" r=".9" fill="#7ce3a8"/><circle cx="9" cy="7" r=".9" fill="#a58cff"/><path d="M14 12v6.5m0 0l-2.8-2.8M14 18.5l2.8-2.8" stroke="#7ce3a8" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  crossnet:`<svg viewBox="0 0 28 28" fill="none"><defs><linearGradient id="gx2" x1="0" y1="0" x2="28" y2="28"><stop offset="0" stop-color="#a58cff"/><stop offset="1" stop-color="#2f8aa8"/></linearGradient></defs><path d="M13.2 6v16" stroke="#4a3d7d" stroke-width="1.6" stroke-dasharray="2.5 3"/><circle cx="6.5" cy="18" r="3.2" stroke="url(#gx2)" stroke-width="1.7"/><circle cx="21.5" cy="18" r="3.2" stroke="url(#gx2)" stroke-width="1.7"/><path d="M6.5 14.5C6.5 8.5 21.5 8.5 21.5 14.5" stroke="#7ce3a8" stroke-width="1.8" stroke-linecap="round"/><path d="M21.5 14.5l-1.8-1.2m1.8 1.2l1.7-1.3" stroke="#7ce3a8" stroke-width="1.6" stroke-linecap="round"/></svg>`,
  workspace:`<svg viewBox="0 0 28 28" fill="none"><defs><linearGradient id="gx3" x1="0" y1="0" x2="28" y2="28"><stop offset="0" stop-color="#a58cff"/><stop offset="1" stop-color="#7ce3a8"/></linearGradient></defs><rect x="3" y="4" width="10.5" height="9" rx="1.8" stroke="url(#gx3)" stroke-width="1.7"/><rect x="15.5" y="4" width="9.5" height="9" rx="1.8" stroke="#4a8fb0" stroke-width="1.6"/><rect x="3" y="15" width="9.5" height="9" rx="1.8" stroke="#8f7ae0" stroke-width="1.6"/><rect x="14.5" y="15" width="10.5" height="9" rx="1.8" fill="rgba(124,227,168,.14)" stroke="#7ce3a8" stroke-width="1.7"/></svg>`,
  devicefree:`<svg viewBox="0 0 28 28" fill="none"><defs><linearGradient id="gx4" x1="0" y1="0" x2="28" y2="28"><stop offset="0" stop-color="#a58cff"/><stop offset="1" stop-color="#7ce3a8"/></linearGradient></defs><rect x="3" y="4" width="22" height="13.5" rx="2.4" stroke="url(#gx4)" stroke-width="1.7"/><path d="M10 21.5h8M14 17.5v4" stroke="url(#gx4)" stroke-width="1.7" stroke-linecap="round"/><circle cx="14" cy="10.7" r="2.6" stroke="#7ce3a8" stroke-width="1.7"/><path d="M9.2 15.2c.9-2 8.7-2 9.6 0" stroke="#7ce3a8" stroke-width="1.7" stroke-linecap="round"/><path d="M21.5 22.5l4-4m0 4l-4-4" stroke="#e8a184" stroke-width="1.7" stroke-linecap="round"/></svg>`,
  shieldx:`<svg viewBox="0 0 28 28" fill="none"><path d="M14 2.8l9 3.6v6.4c0 5.6-3.8 9.4-9 11.4-5.2-2-9-5.8-9-11.4V6.4l9-3.6z" stroke="#a58cff" stroke-width="1.7" stroke-linejoin="round"/><path d="M9.8 13.8l2.9 2.9 5.5-5.9" stroke="#7ce3a8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  cloudx:`<svg viewBox="0 0 28 28" fill="none"><path d="M8 19a4.5 4.5 0 01-.6-8.96A6.2 6.2 0 0119.5 8.9 4.8 4.8 0 0120 18.5" stroke="#a58cff" stroke-width="1.7" stroke-linecap="round"/><circle cx="9" cy="23.4" r="1.5" fill="#7ce3a8"/><circle cx="14" cy="23.4" r="1.5" fill="#a58cff"/><circle cx="19" cy="23.4" r="1.5" fill="#4a8fb0"/><path d="M9 21.9v-2m5 2v-3m5 3v-2" stroke="#4a3d7d" stroke-width="1.4"/></svg>`,
  oneplat:`<svg viewBox="0 0 28 28" fill="none"><defs><linearGradient id="gx7" x1="0" y1="0" x2="28" y2="28"><stop offset="0" stop-color="#a58cff"/><stop offset="1" stop-color="#7ce3a8"/></linearGradient></defs><path d="M14 3.5l10.5 5L14 13.5 3.5 8.5l10.5-5z" stroke="url(#gx7)" stroke-width="1.7" stroke-linejoin="round" fill="rgba(165,140,255,.12)"/><path d="M3.5 14l10.5 5 10.5-5" stroke="#8f7ae0" stroke-width="1.7" stroke-linejoin="round"/><path d="M3.5 19.5l10.5 5 10.5-5" stroke="#4a8fb0" stroke-width="1.7" stroke-linejoin="round"/></svg>`,
  persist:`<svg viewBox="0 0 28 28" fill="none"><defs><linearGradient id="gx8" x1="0" y1="0" x2="28" y2="28"><stop offset="0" stop-color="#a58cff"/><stop offset="1" stop-color="#7ce3a8"/></linearGradient></defs><rect x="3" y="5" width="16" height="12" rx="2" stroke="url(#gx8)" stroke-width="1.7"/><path d="M6.5 9h6M6.5 12h9" stroke="#8f7ae0" stroke-width="1.6" stroke-linecap="round"/><circle cx="20.5" cy="19.5" r="5.4" stroke="#7ce3a8" stroke-width="1.7" fill="rgba(11,9,24,.85)"/><path d="M20.5 16.8v2.9l2 1.2" stroke="#7ce3a8" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`
};

export const LYR ={
  glass:`<svg class="lyr" viewBox="0 0 48 48" fill="none"><rect x="6" y="9" width="36" height="23" rx="3" stroke="#a58cff" stroke-width="2"/><rect class="lglow" x="10" y="13" width="28" height="15" rx="1.5" fill="rgba(165,140,255,.25)"/><path d="M18 38h12M24 32v6" stroke="#a58cff" stroke-width="2" stroke-linecap="round"/></svg>`,
  ws:`<svg class="lyr" viewBox="0 0 48 48" fill="none"><rect x="7" y="8" width="15" height="14" rx="2" stroke="#8f7ae0" stroke-width="2"/><rect x="26" y="8" width="15" height="14" rx="2" stroke="#4a8fb0" stroke-width="2"/><rect x="7" y="26" width="15" height="14" rx="2" stroke="#a58cff" stroke-width="2"/><g class="wsgrow"><rect x="26" y="26" width="15" height="14" rx="2" fill="rgba(124,227,168,.18)" stroke="#7ce3a8" stroke-width="2"/></g></svg>`,
  cloud:`<svg class="lyr" viewBox="0 0 48 48" fill="none"><path d="M14 33a8 8 0 01-1-15.9A10.8 10.8 0 0133.6 14 8.4 8.4 0 0135 32.5" stroke="#a58cff" stroke-width="2" stroke-linecap="round"/><g class="orb"><circle cx="24" cy="41" r="2.6" fill="#7ce3a8"/></g><circle cx="24" cy="24" r="1.8" fill="#8f7ae0"/></svg>`
};

export const DEV ={
  pod:`<svg class="dev" viewBox="0 0 300 170"><rect x="60" y="30" width="180" height="90" rx="16" fill="#241c45" stroke="#6d5bb8" stroke-width="2.5"/><circle cx="150" cy="75" r="13" fill="none" stroke="#a58cff" stroke-width="3"/><circle cx="150" cy="75" r="4" fill="#7ce3a8"/><rect x="95" y="128" width="110" height="7" rx="3.5" fill="#35304d"/><rect x="230" y="60" width="14" height="8" rx="2" fill="#4a3d7d"/><rect x="230" y="78" width="14" height="8" rx="2" fill="#4a3d7d"/></svg>`,
  stick:`<svg class="dev" viewBox="0 0 300 170"><rect x="70" y="65" width="130" height="42" rx="14" fill="#241c45" stroke="#6d5bb8" stroke-width="2.5"/><rect x="200" y="74" width="34" height="24" rx="3" fill="#4a3d7d"/><rect x="234" y="79" width="12" height="14" rx="2" fill="#8f7ae0"/><circle cx="100" cy="86" r="6" fill="none" stroke="#a58cff" stroke-width="2.5"/><circle cx="100" cy="86" r="2" fill="#7ce3a8"/></svg>`,
  toggle:`<svg class="dev" viewBox="0 0 300 170"><circle cx="150" cy="85" r="52" fill="#241c45" stroke="#6d5bb8" stroke-width="2.5"/><circle cx="150" cy="85" r="34" fill="none" stroke="#4a3d7d" stroke-width="2"/><circle cx="150" cy="85" r="12" fill="none" stroke="#a58cff" stroke-width="3"/><circle cx="150" cy="85" r="4" fill="#7ce3a8"/></svg>`,
  tablet:`<svg class="dev" viewBox="0 0 300 170"><rect x="70" y="25" width="160" height="110" rx="12" fill="#241c45" stroke="#6d5bb8" stroke-width="2.5"/><rect x="82" y="37" width="136" height="86" rx="5" fill="#171231"/><rect x="90" y="45" width="60" height="34" rx="3" fill="#4a3585"/><rect x="154" y="45" width="56" height="34" rx="3" fill="#1d5c7a"/><rect x="90" y="83" width="120" height="12" rx="6" fill="#35304d"/><rect x="120" y="140" width="60" height="7" rx="3.5" fill="#35304d"/></svg>`,
  al:`<svg class="dev" viewBox="0 0 300 170"><rect x="55" y="30" width="90" height="52" rx="6" fill="#241c45" stroke="#6d5bb8" stroke-width="2"/><rect x="155" y="30" width="90" height="52" rx="6" fill="#241c45" stroke="#6d5bb8" stroke-width="2"/><rect x="55" y="92" width="90" height="52" rx="6" fill="#241c45" stroke="#6d5bb8" stroke-width="2"/><rect x="155" y="92" width="90" height="52" rx="6" fill="#241c45" stroke="#6d5bb8" stroke-width="2"/><circle cx="100" cy="56" r="9" fill="#4fb87d"/><circle cx="200" cy="56" r="9" fill="#a58cff"/><circle cx="100" cy="118" r="9" fill="#2f8aa8"/><circle cx="200" cy="118" r="9" fill="#e8c76a"/></svg>`
};

export const RIC ={
  os:`<svg viewBox="0 0 24 24" fill="none" stroke="#a58cff" stroke-width="1.7"><rect x="3" y="4.5" width="18" height="15" rx="2.5"/><path d="M7 10l2.8 2.3L7 14.6" stroke="#7ce3a8" stroke-linecap="round" stroke-linejoin="round"/><path d="M12.5 15h4.5" stroke-linecap="round"/></svg>`,
  cert:`<svg viewBox="0 0 24 24" fill="none" stroke="#a58cff" stroke-width="1.7"><circle cx="12" cy="9" r="5.5"/><path d="M9.5 9l1.8 1.8 3.2-3.4" stroke="#7ce3a8" stroke-linecap="round" stroke-linejoin="round"/><path d="M9 13.8L7.5 21l4.5-2.4L16.5 21 15 13.8" stroke-linejoin="round"/></svg>`,
  fw:`<svg viewBox="0 0 24 24" fill="none" stroke="#a58cff" stroke-width="1.7"><rect x="3" y="5" width="18" height="15" rx="2"/><path d="M3 10h18M3 15h18" opacity=".6"/><path d="M9 5v5M15 10v5M9 15v5" stroke="#7ce3a8" opacity=".9"/></svg>`,
  taa:`<svg viewBox="0 0 24 24" fill="none" stroke="#a58cff" stroke-width="1.7"><rect x="5" y="8" width="14" height="12" rx="2"/><path d="M9 8V6.5a3 3 0 016 0V8"/><path d="M9.5 14l1.9 1.9 3.3-3.6" stroke="#7ce3a8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  /* An outsider inspecting the shield: a shield with a magnifier over it, for the
     independent-testing commitment. Distinct from RIC.cert (a seal, i.e. someone
     granting us something) because the two claims are different in kind — one is
     awarded, the other is survived. */
  probe:`<svg viewBox="0 0 24 24" fill="none" stroke="#a58cff" stroke-width="1.7"><path d="M11.2 3.2l7 2.8v5.1c0 3.2-1.6 5.7-4.2 7.4" stroke-linejoin="round"/><path d="M11.2 3.2l-7 2.8v5.1c0 4.4 3 7.4 7 8.9" stroke-linejoin="round"/><circle cx="15.7" cy="14.2" r="3.7" stroke="#7ce3a8"/><path d="M18.4 16.9l3 3" stroke="#7ce3a8" stroke-linecap="round"/></svg>`
};

export const CNVIC ={
  sales:`<svg viewBox="0 0 24 24" fill="none" stroke="#a58cff" stroke-width="1.7"><path d="M3.5 5.5h17v11h-9l-4.5 3.5v-3.5h-3.5z" stroke-linejoin="round"/><path d="M7.5 9.5h9M7.5 12.5h5.5" stroke="#7ce3a8" stroke-linecap="round"/></svg>`,
  support:`<svg viewBox="0 0 24 24" fill="none" stroke="#a58cff" stroke-width="1.7"><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3.4" stroke="#7ce3a8"/><path d="M12 3.5v5.1M12 15.4v5.1M3.5 12h5.1M15.4 12h5.1" opacity=".8"/></svg>`,
  partner:`<svg viewBox="0 0 24 24" fill="none" stroke="#a58cff" stroke-width="1.7"><circle cx="8" cy="9" r="3.2"/><circle cx="16" cy="9" r="3.2" stroke="#7ce3a8"/><path d="M3 20c.6-3.4 2.6-5 5-5s4.4 1.6 5 5" stroke-linecap="round"/><path d="M13.6 15.4c.8-.3 1.6-.4 2.4-.4 2.4 0 4.4 1.6 5 5" stroke="#7ce3a8" stroke-linecap="round"/></svg>`,
  people:`<svg viewBox="0 0 24 24" fill="none" stroke="#a58cff" stroke-width="1.7"><circle cx="9" cy="8.5" r="3.2"/><path d="M3.5 20c.6-3.4 2.6-5 5.5-5s4.9 1.6 5.5 5" stroke-linecap="round"/><circle cx="16.8" cy="9.5" r="2.6"/><path d="M15.4 14.8c2.4.2 4.3 1.7 4.9 4.5" stroke-linecap="round"/></svg>`,
  docs:`<svg viewBox="0 0 24 24" fill="none" stroke="#a58cff" stroke-width="1.7"><path d="M5 4.5h8l4 4V20H5z" stroke-linejoin="round"/><path d="M13 4.5v4h4" stroke-linejoin="round"/><path d="M8 12h7M8 15.5h7" stroke="#7ce3a8" stroke-linecap="round"/></svg>`,
  api:`<svg viewBox="0 0 24 24" fill="none" stroke="#a58cff" stroke-width="1.7"><path d="M8.5 8l-4 4 4 4M15.5 8l4 4-4 4" stroke-linecap="round" stroke-linejoin="round"/><path d="M13 6.5l-2 11" stroke="#7ce3a8" stroke-linecap="round"/></svg>`,
  gear:`<svg viewBox="0 0 24 24" fill="none" stroke="#a58cff" stroke-width="1.7"><circle cx="12" cy="12" r="3" stroke="#7ce3a8"/><path d="M12 3.5v2.4M12 18.1v2.4M3.5 12h2.4M18.1 12h2.4M6 6l1.7 1.7M16.3 16.3L18 18M18 6l-1.7 1.7M7.7 16.3L6 18" stroke-linecap="round"/></svg>`,
  reg:`<svg viewBox="0 0 24 24" fill="none" stroke="#a58cff" stroke-width="1.7"><rect x="4.5" y="3.5" width="15" height="17" rx="2"/><path d="M8.5 8h7M8.5 11.5h7" stroke-linecap="round" opacity=".8"/><path d="M8.5 15.5l2 2 4-4.5" stroke="#7ce3a8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  tagp:`<svg viewBox="0 0 24 24" fill="none" stroke="#a58cff" stroke-width="1.7"><path d="M12.5 3.5h8v8l-9 9-8-8z" stroke-linejoin="round"/><circle cx="16.5" cy="7.5" r="1.5" fill="#7ce3a8" stroke="none"/></svg>`,
  mdf:`<svg viewBox="0 0 24 24" fill="none" stroke="#a58cff" stroke-width="1.7"><path d="M4 19.5h16" stroke-linecap="round"/><path d="M6.5 19.5v-6M11 19.5V8.5M15.5 19.5v-8.5M20 19.5v-12" stroke="#7ce3a8" stroke-linecap="round"/></svg>`,
  demo:`<svg viewBox="0 0 24 24" fill="none" stroke="#a58cff" stroke-width="1.7"><rect x="3" y="4.5" width="18" height="12" rx="2"/><path d="M9 20h6M12 16.5V20" stroke-linecap="round"/><path d="M10 8l4 2.5-4 2.5z" fill="#7ce3a8" stroke="none"/></svg>`,
  collat:`<svg viewBox="0 0 24 24" fill="none" stroke="#a58cff" stroke-width="1.7"><rect x="4" y="6" width="12" height="14" rx="1.6"/><path d="M8 3.5h11.5V17" opacity=".7"/><path d="M7 10h6M7 13h6M7 16h4" stroke="#7ce3a8" stroke-linecap="round"/></svg>`,
  cert:`<svg viewBox="0 0 24 24" fill="none" stroke="#a58cff" stroke-width="1.7"><circle cx="12" cy="9.5" r="5"/><path d="M10 9.5l1.6 1.6 2.8-3" stroke="#7ce3a8" stroke-linecap="round" stroke-linejoin="round"/><path d="M9.3 13.7L8 20.5l4-2.2 4 2.2-1.3-6.8" stroke-linejoin="round"/></svg>`,
  dir:`<svg viewBox="0 0 24 24" fill="none" stroke="#a58cff" stroke-width="1.7"><circle cx="11" cy="11" r="6.5"/><path d="M15.8 15.8l4.7 4.7" stroke="#7ce3a8" stroke-linecap="round"/></svg>`,
  ship:`<svg viewBox="0 0 24 24" fill="none" stroke="#a58cff" stroke-width="1.7"><path d="M3.5 7.5l8.5-4 8.5 4-8.5 4z" stroke-linejoin="round"/><path d="M3.5 7.5V16l8.5 4.5V11.5M20.5 7.5V16L12 20.5" stroke-linejoin="round"/><path d="M7.5 5.6l8.5 4" stroke="#7ce3a8"/></svg>`
};

/* ---------- HIC: the hardware icons on the product scroll stages ----------
   Ports and capabilities, drawn to the same recipe as every set above — a
   24x24 box, 1.7 stroke, lilac for the object and mint for the part that carries
   the meaning (the signal, the tick, the direction of travel). They are their own
   set rather than additions to XIC because XIC is the four-capability card art at
   28x28 with gradients, and mixing the two would leave a grid where half the
   icons are a stroke weight heavier than the other half.

   Six of them were drawn for the /products/pro stage; `net`, `wifi` and `panel`
   were added for the /products/essentials one, whose six rows are a different
   six. Both stages take exactly six, because the choreography in
   initScrollScene() spaces the rows between 0.52 and 0.845 of the pinned track
   — so a seventh row needs a new set of `at` values, not just a new icon. */
export const HIC = {
  shares:`<svg viewBox="0 0 24 24" fill="none" stroke="#a58cff" stroke-width="1.7"><rect x="2.5" y="4" width="8.5" height="7" rx="1.4"/><rect x="13" y="4" width="8.5" height="7" rx="1.4" opacity=".65"/><rect x="2.5" y="13" width="8.5" height="7" rx="1.4" opacity=".65"/><rect x="13" y="13" width="8.5" height="7" rx="1.4" fill="rgba(124,227,168,.16)" stroke="#7ce3a8"/></svg>`,
  hdmiout:`<svg viewBox="0 0 24 24" fill="none" stroke="#a58cff" stroke-width="1.7"><rect x="2.5" y="4.5" width="13" height="9.5" rx="1.8"/><path d="M6 18h6M9 14v4" stroke-linecap="round"/><path d="M17.5 9.2h4m0 0l-1.8-1.9m1.8 1.9l-1.8 1.9" stroke="#7ce3a8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  hdmiin:`<svg viewBox="0 0 24 24" fill="none" stroke="#a58cff" stroke-width="1.7"><rect x="8.5" y="4.5" width="13" height="9.5" rx="1.8"/><path d="M12 18h6M15 14v4" stroke-linecap="round"/><path d="M2.5 9.2h4m0 0L4.7 7.3M6.5 9.2L4.7 11.1" stroke="#7ce3a8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  /* The row this sits on is headed "The room's camera and mic", so the icon is
     the two peripherals rather than the USB trident that used to be here — the
     port is what carries them, not what the reader is being told about. It is
     also the only two-object icon in the set, which is why the camera is nudged
     off centre and the mic runs taller: two marks of equal weight side by side
     read as a pattern, not as a camera and a microphone.

     The cradle arc goes left to right with sweep-flag 0, which is what bulges it
     DOWNWARD under the capsule. The familiar Lucide/Feather mic draws the same
     curve right to left with sweep 1; copy that path in without reversing the
     flag and the cradle arcs over the top of the mic instead of under it. */
  cammic:`<svg viewBox="0 0 24 24" fill="none" stroke="#a58cff" stroke-width="1.7"><rect x="1.9" y="8.4" width="10.4" height="9" rx="2.2"/><circle cx="7.1" cy="12.9" r="2.4" fill="rgba(124,227,168,.16)" stroke="#7ce3a8"/><rect x="16.6" y="5.4" width="4.2" height="7.6" rx="2.1"/><path d="M15 11.4v.9a3.7 3.7 0 007.4 0v-.9" stroke-linecap="round"/><path d="M18.7 16v2.6M16.7 18.6h4" stroke-linecap="round"/></svg>`,
  poe:`<svg viewBox="0 0 24 24" fill="none" stroke="#a58cff" stroke-width="1.7"><path d="M7 3.5h10v6.2l-2.2 2.3v8.5H9.2v-8.5L7 9.7z" stroke-linejoin="round"/><path d="M10.2 3.5v3M13.8 3.5v3" opacity=".7"/><path d="M12.6 13.4l-1.9 3h2.6l-1.9 3" stroke="#7ce3a8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  chip:`<svg viewBox="0 0 24 24" fill="none" stroke="#a58cff" stroke-width="1.7"><rect x="6" y="6" width="12" height="12" rx="2"/><rect x="9.6" y="9.6" width="4.8" height="4.8" rx="1" fill="rgba(124,227,168,.16)" stroke="#7ce3a8"/><path d="M9.5 3.5v2.4M14.5 3.5v2.4M9.5 18.1v2.4M14.5 18.1v2.4M3.5 9.5h2.4M3.5 14.5h2.4M18.1 9.5h2.4M18.1 14.5h2.4" stroke-linecap="round"/></svg>`,
  /* An RJ-45 jack: the body, then the plug tab dropping out of its underside,
     which is the silhouette that reads as "Ethernet" rather than as "socket".
     Four mint pins, not eight — at 24px, eight strokes 1.2 apart fill in to a
     grey block on a non-retina display. */
  net:`<svg viewBox="0 0 24 24" fill="none" stroke="#a58cff" stroke-width="1.7"><path d="M4.5 4.5h15v9.5h-4.2v4.2H8.7v-4.2H4.5z" stroke-linejoin="round"/><path d="M8.2 8.2v2.6M10.7 8.2v2.6M13.3 8.2v2.6M15.8 8.2v2.6" stroke="#7ce3a8" stroke-linecap="round"/></svg>`,
  /* Three arcs and the emitter. Every arc runs left to right with sweep-flag 1,
     which is what bulges it UPWARD in SVG's y-down space — the same trap as the
     mic cradle above, in the other direction. Reverse a flag and that band
     collapses through the one below it. */
  wifi:`<svg viewBox="0 0 24 24" fill="none" stroke="#a58cff" stroke-width="1.7" stroke-linecap="round"><path d="M3.6 8.4a13 13 0 0116.8 0"/><path d="M6.6 11.9a8.6 8.6 0 0110.8 0"/><path d="M9.5 15.4a4.3 4.3 0 015 0" stroke="#7ce3a8"/><circle cx="12" cy="19.1" r="1.5" fill="#7ce3a8" stroke="none"/></svg>`,
  /* The Mini's rear panel, and the count is the claim: an RJ-45, an HDMI and a
     barrel jack, with nothing else on the plate. Drawn as the whole panel rather
     than as one port because the row it carries is the absence — no USB, no HDMI
     input, no audio out — and an absence needs the frame around it to be visible
     at all. */
  panel:`<svg viewBox="0 0 24 24" fill="none" stroke="#a58cff" stroke-width="1.7"><rect x="2.2" y="7" width="19.6" height="10" rx="2"/><rect x="5" y="10.3" width="3.5" height="3.4" rx=".7" stroke="#7ce3a8"/><rect x="10.4" y="10.8" width="4.4" height="2.4" rx=".8" stroke="#7ce3a8"/><circle cx="18.4" cy="12" r="1.6" stroke="#7ce3a8"/></svg>`
};
