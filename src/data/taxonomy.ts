/* "Where meetings live" taxonomy grid and room-scene captions.
   Extracted verbatim from the v1.95 single-file POC. */

export const TAX = {
  cols:["Platform-locked — one ecosystem","Platform-agnostic — any ecosystem"],
  rows:[
    {name:"Room-hosted",sub:"hosted BY the room: walk in with nothing",cells:[
      {h:"MTR / Zoom Rooms + console",d:"Proven at scale, and it costs you three ways: a per-room, per-year license; one ecosystem by default (joining the other platform's meeting is a cut-down guest experience); and sharing built around starting a call, so everyone stares at their own laptop instead of collaborating.",who:"Certified bars · native VTC room systems · dongle-vendor Teams Rooms bundles",v:"Fine until the day your org signs a second platform. Then every locked room is a renovation. And every day before that, the room makes people look down, not up.",link:"compare/mtr"},
      {h:"The summit",d:"Web and in-unit clients reach this rung by re-rendering the meeting rather than running it. One vendor's own feature matrix marks 'See chat messages' unsupported on Teams, Zoom and Webex. Another calls its Teams path 'the built-in Teams web conferencing service' and its Zoom path the 'Zoom Web Client'; neither appears on Microsoft's Teams Rooms certified list. Native clients (the real Teams/Zoom/Webex/Meet app, chosen per meeting) is the cell only Polaris credibly fills at market price.",who:"Polaris (native) · in-unit clients · browser-based clients",v:"If a room can host natively without lock-in at market price, the locked column loses its reason to exist.",us:true,link:"products/family"}]},
    {name:"Your device + the room's AV",sub:"BYOM: your meeting, the room's camera/mic",cells:[
      {h:"Certified bars in USB mode",d:"The bar is a peripheral of the laptop: agnostic in theory, priced to pull you into one ecosystem.",who:"The major certified-bar vendors",v:"Good hardware, honest USB mode, but the pricing gravity pulls toward one ecosystem's certified rooms.",link:"compare/hub"},
      {h:"The contested middle",d:"Wired USB-C (tethered) vs true wireless bridging. Polaris Pro does multi-user wireless BYOM. Two other agnostic vendors bridge wirelessly too, each with a catch: one needs a transmitter in the laptop, the other joins through a web client rather than the platform's own. A third vendor's own release notes say multi-view is unavailable during a BYOM session, and the native VTC room systems have no wireless BYOM at all - it is a USB-C cable.",who:"Polaris Pro · dongle-based BYOM · web-client room systems",v:"Wireless, multi-user, no cable on the table. This is where Pro wins deals today.",us:true,link:"products/pro"}]},
    {name:"Your device alone",sub:"BYOD: you share pixels; the room adds the display",cells:[
      {h:"Ecosystem casting",d:"Teams Cast, AirPlay-only paths: fine if everyone lives in one vendor's world.",who:"Platform vendors",v:"Zero-cost and fine — inside one vendor's walls. Guests and mixed fleets break it.",link:"compare/hub"},
      {h:"The commodity layer",d:"Everyone shares wirelessly. Differentiation here is the workspace (any number of sources, composited side by side) and web-join (nothing to install), not the connection.",who:"Everyone: Polaris differentiates on workspace + browser",v:"Everyone connects. The question is what the display does next: one mirrored screen, or a workspace.",us:true,link:"solutions/collab"}]}
  ]
};

export const RS_CAP ={
  1:"Room camera &amp; mic: not in the meeting; the laptop's own webcam carries the call.",
  2:"The room's camera and mic are cabled into the Polaris pod and bridged wirelessly into your Teams/Zoom/Webex/Meet call. The laptop still hosts, and still pays the compute. Add Link, and the pod hosts the call itself.",
  3:"With Mersive's Polaris Host added to Polaris Pro, users walk in with just a phone, or nothing at all. The Host starts, controls, and shares the meeting with native Teams/Zoom/Webex/Meet clients."
};
