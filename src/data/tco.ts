/* TCO calculator inputs: competitor SKUs, Polaris equivalents, hybrid add-ons.
   Shape extracted from the v1.95 single-file POC; vendors, product variants and
   paid add-ons expanded from the August 2026 verification waves.

   Price discipline — the only rule that matters on this page:
     hw / sub = null   the vendor publishes no price and our research established
                       no figure at all. Renders as "not published", never as $0.
     est: true         a figure exists but is a street/reseller/dated estimate,
                       not a vendor list price. `src` says where it came from.
     no est flag       the vendor publishes this number itself.
   Six vendors publish no list price for anything: Barco, Crestron, Kramer,
   Cisco, Extron, Yealink. Every figure in their rows is an estimate and is
   flagged as one. Do not add a number here without a source string. */

/** One paid add-on line. `price: null` means "named cost, price not published". */
export type TcoAddon = {
  /** Label shown next to the checkbox. */
  n: string;
  /** Vendor SKU, where one is published. */
  sku?: string;
  /** Dollars, or null when no price is published anywhere. */
  price: number | null;
  /** Unit as the vendor states it: "one-time", "per device / yr", … */
  unit: string;
  /** Where the number (or the absence of one) came from. Required. */
  src: string;
  /** true = street/reseller/dated estimate, not a published list price. */
  est?: boolean;
  /** How the cost multiplies. Default "room". */
  per?: "room" | "seat" | "over";
  /** With per:"over": the count that is free before the charge starts. */
  freeUpTo?: number;
  /** true = recurring per year; absent = one-time. */
  yr?: boolean;
  /** Checked by default, for add-ons that are not optional in practice. */
  on?: boolean;
};

export type TcoProduct = {
  hw: number | null;
  care: number;
  sub: number | null;
  ref: number;
  est?: boolean;
  src?: string;
  /** Override the compare-matrix column this product maps to. */
  brand?: string;
  addons?: TcoAddon[];
};

/* ---- add-ons that several vendors carry identically ---- */

const MTR_BASIC: TcoAddon = {
  n: "Microsoft Teams Rooms Basic — free, up to 25 licences",
  price: 0,
  unit: "per room, no charge",
  src: "Microsoft, published: “no charge will be made for Teams Rooms Basic licenses”",
  on: true,
};

const MTR_PRO: TcoAddon = {
  n: "Microsoft Teams Rooms Pro — required above 25 rooms, charged as max(0, rooms − 25) × Pro",
  price: null,
  unit: "per room / yr, above the first 25 rooms",
  per: "over",
  freeUpTo: 25,
  yr: true,
  src: "Microsoft publishes the 25-licence Basic ceiling; the Pro price could not be verified — the Teams Rooms pricing page serves no figures. [Get the Pro rate from your M365 admin centre.]",
};

const ZOOM_ROOMS: TcoAddon = {
  n: "Zoom Rooms licence — one per room",
  price: null,
  unit: "per room / yr",
  per: "room",
  yr: true,
  src: "Zoom publishes no retrievable figure and no certification list; we make no Zoom price claim. [Obtain from Zoom.]",
};

export const CALCDATA: {
  comp: Record<string, Record<string, TcoProduct>>;
  /** Add-ons that apply across a vendor's whole line. */
  compAddons: Record<string, TcoAddon[]>;
  eq: Record<string, { hw: number; sub: number }>;
  hyb: Record<string, { hw: number; sub: number }>;
} = {
  comp: {
    "Barco ClickShare": {
      /* Barco renders "List price: Price not available" on every ClickShare SKU.
         The three CX/C figures are the street estimates this calculator has
         always carried; Bar and Hub have no figure at all, so they carry none. */
      "C-10": { hw: 1000, care: 0, sub: 0, ref: 5, est: true, src: "street price, partner-sourced, unverified" },
      "CX-30": { hw: 1700, care: 0, sub: 0, ref: 5, est: true, src: "street price, partner-sourced, unverified" },
      "CX-50 Gen2": { hw: 2500, care: 0, sub: 0, ref: 5, est: true, src: "street price, partner-sourced, unverified" },
      "Bar Core": { hw: null, care: 0, sub: 0, ref: 5, est: true, src: "Barco publishes no list price and our research found no street figure for this model" },
      "Bar Pro": { hw: null, care: 0, sub: 0, ref: 5, est: true, src: "Barco publishes no list price and our research found no street figure for this model" },
      "Hub Core": {
        hw: null, care: 0, sub: 0, ref: 5, est: true, brand: "Barco Hub",
        src: "Barco publishes no list price; no street figure in our research. Warranty is 3 years flat — Hub is absent from SmartCare's applicable-products list",
        addons: [MTR_BASIC, MTR_PRO],
      },
      "Hub Pro": {
        hw: null, care: 0, sub: 0, ref: 5, est: true, brand: "Barco Hub",
        src: "Barco publishes no list price; no street figure in our research. Warranty is 3 years flat — Hub is absent from SmartCare's applicable-products list",
        addons: [MTR_BASIC, MTR_PRO],
      },
    },
    Crestron: {
      "AirMedia AM-3100-WF": { hw: null, care: 0, sub: 0, ref: 5, est: true, src: "Crestron publishes no price: crestron.com/Price-Lists returns “Please login to access your pricing information”" },
      "AirMedia AM-3200-WF": { hw: 1400, care: 0, sub: 0, ref: 6, est: true, src: "street price, partner-sourced, unverified — Crestron publishes no list price" },
      "AirMedia AM-3200-GV": { hw: null, care: 0, sub: 0, ref: 6, est: true, src: "TAA government SKU (Material 6513188, country of origin TW). Crestron publishes no price" },
    },
    Kramer: {
      "VIA Connect²": { hw: 1000, care: 0, sub: 0, ref: 5, est: true, src: "street price, partner-sourced, unverified — every Kramer VIA page is a quote cart" },
      "VIA Campus²": {
        hw: null, care: 0, sub: 0, ref: 5, est: true,
        src: "Kramer publishes no price. Ships on Windows 10",
        addons: [{
          n: "Windows 11 licence upgrade — Kramer states Teams on Campus² requires it",
          price: null, unit: "one-time, per room",
          src: "Kramer's own product copy carries the requirement; no price published. [Obtain from Kramer.]",
        }],
      },
      "VIA GO3": { hw: null, care: 0, sub: 0, ref: 5, est: true, src: "Kramer publishes no price. GO3 drops the on-prem VSM download: management is VSM on Cloud only" },
    },
    WolfVision: {
      "Cynap Pure Mini": {
        hw: 875, care: 0, sub: 0, ref: 6, est: true,
        src: "WolfVision-authored “US MSRP PRICES — Effective 04/01/2022”, item 102033-01, hosted on a reseller domain. Four years old, not a current vendor list price",
        addons: [{
          n: "Warranty extension to 5 years — must be ordered at time of purchase, excludes CPU and SSD",
          price: 175, unit: "one-time, per room", est: true,
          src: "WolfVision 2022 MSRP list, reseller-hosted",
        }],
      },
      "Cynap Pure": {
        hw: 1510, care: 0, sub: 0, ref: 6, est: true,
        src: "WolfVision-authored 2022 US MSRP list, item 102025, reseller-hosted. Not a current vendor list price",
        addons: [
          { n: "Warranty extension to 5 years — excludes CPU and SSD", price: 302, unit: "one-time, per room", est: true, src: "WolfVision 2022 MSRP list, reseller-hosted" },
          { n: "Cynap Pure (Next Gen) Feature Pack — gates HDMI input, browser, web conferencing, M365", price: null, unit: "one-time, per room", src: "Heavily marketed by WolfVision; no item code and no price published anywhere. [Obtain from WolfVision.]" },
        ],
      },
      "Cynap Core Pro": {
        hw: 3190, care: 0, sub: 0, ref: 6, est: true,
        src: "WolfVision-authored 2022 US MSRP list, item 102029, reseller-hosted. Not a current vendor list price",
        addons: [
          { n: "Warranty extension to 5 years — excludes CPU and SSD", price: 638, unit: "one-time, per room", est: true, src: "WolfVision 2022 MSRP list, reseller-hosted" },
          { n: "Lecture Capture Pack (Panopto agent)", sku: "102234", price: 615, unit: "one-time licence key, per room", est: true, src: "WolfVision 2022 MSRP list, reseller-hosted" },
        ],
      },
      "Cynap Pro": {
        hw: 7530, care: 0, sub: 0, ref: 6, est: true,
        src: "WolfVision-authored 2022 US MSRP list, Version A (HDMI); HDBaseT versions were $8,200–$8,870. Reseller-hosted, four years old",
        addons: [
          { n: "Warranty extension to 5 years — excludes CPU and SSD [list shows $1,506–$1,773 by configuration]", price: 1506, unit: "one-time, per room", est: true, src: "WolfVision 2022 MSRP list, reseller-hosted" },
          { n: "vSolution MATRIX Pack — many-to-many AVoIP, plus per-workstation hardware", sku: "102230", price: 2540, unit: "one-time licence key, per room", est: true, src: "WolfVision 2022 MSRP list, reseller-hosted" },
        ],
      },
    },
    Extron: {
      "ShareLink Pro 500": { hw: null, care: 0, sub: 0, ref: 5, est: true, src: "Extron publishes no retrievable US price: extron.com blocks automated retrieval and our research established no figure for this model" },
      "ShareLink Pro 1000": { hw: null, care: 0, sub: 0, ref: 5, est: true, src: "Extron publishes no retrievable US price: extron.com blocks automated retrieval and our research established no figure for this model" },
    },
    Airtame: {
      /* Licence is modelled as an add-on, not as `sub`, because the device ships
         with 3 years included and the renewal rate is the published figure. */
      "Airtame 3 + Core": {
        hw: 719, care: 0, sub: 0, ref: 5, est: true,
        src: "street price, reseller-sourced, unverified — airtame.com/pricing renders no figures and routes to resellers",
        addons: [{ n: "Airtame Core licence renewal — 3 years included with the device", price: 120, unit: "per device / yr", yr: true, on: true, src: "airtame.com published MSRP: “$120/y/device for Airtame Core”" }],
      },
      "Airtame 3 + Hybrid": {
        hw: 719, care: 0, sub: 0, ref: 5, est: true,
        src: "street price, reseller-sourced, unverified — airtame.com/pricing renders no figures and routes to resellers",
        addons: [{ n: "Airtame Hybrid licence renewal — 3 years included with the device", price: 300, unit: "per device / yr", yr: true, on: true, src: "airtame.com published MSRP: “$300/y/device for Airtame Hybrid”" }],
      },
    },
    ScreenBeam: {
      "1100 Plus": { hw: 1199.99, care: 0, sub: 0, ref: 5, src: "screenbeam.com published price, SKU SBWD1100P" },
      "1000 EDU Gen 2": {
        hw: 549.99, care: 0, sub: 0, ref: 5,
        src: "screenbeam.com published price, SKU SBWD1000EDUG2 — accredited K-12 institutions only",
        addons: [{ n: "Instructional Tools Bundle — licensed add-on: orchestration, student-screen preview, web filtering, rostering", price: null, unit: "not published", src: "ScreenBeam states it is a licensed add-on and publishes neither SKU nor price. [Obtain from ScreenBeam.]" }],
      },
    },
    BenQ: {
      "InstaShow WDC15": {
        hw: 899, care: 0, sub: 0, ref: 5, src: "BenQ US store published price",
        addons: [{ n: "WDC15 add-on Button", price: 299, unit: "per seat, one-time", per: "seat", src: "BenQ US store published price" }],
      },
      "InstaShow WDC25": {
        hw: 1499, care: 0, sub: 0, ref: 5, src: "BenQ US store published price",
        addons: [{ n: "VS25 / WDC25 Button Kit", price: 389, unit: "per seat, one-time", per: "seat", src: "BenQ US store published price" }],
      },
      "InstaShow VS25": {
        hw: 1999, care: 0, sub: 0, ref: 5, src: "BenQ US store published price",
        addons: [{ n: "VS25 / WDC25 Button Kit [BYOM needs the Host Button; BenQ publishes no way to buy a spare]", price: 389, unit: "per seat, one-time", per: "seat", src: "BenQ US store published price for the plain button kit" }],
      },
    },
    Yealink: {
      "RoomCast E2": {
        hw: null, care: 0, sub: 0, ref: 5, est: true,
        src: "Yealink publishes no list price for any product; the figures circulating internally are unverified",
        addons: [
          { n: "Digital signage — a native RoomCast function, no licence gate stated", price: 0, unit: "included", src: "Yealink presents signage as a RoomCast capability delivered through cloud management; no gate published" },
          MTR_BASIC,
          MTR_PRO,
          ZOOM_ROOMS,
        ],
      },
    },
    DisplayNote: {
      "Montage — Launcher + Montage room licence": {
        hw: 0, care: 0, sub: 635, ref: 5, est: true, brand: "DisplayNote Montage",
        src: "Dell reseller listing AB212691 at $635.00 per room per year. DisplayNote publishes no price at all — displaynote.com/pricing serves nothing",
        addons: [{ n: "Launcher Screen Casting widget — free in beta, “will become a paid feature afterwards”", price: null, unit: "not yet priced", src: "DisplayNote's own wording. No price published. [Forward cost, unquantified.]" }],
      },
    },
    Vivi: {
      "Vivi box + per-classroom subscription": {
        hw: null, care: 0, sub: null, ref: 5, est: true,
        src: "Vivi publishes no US price; its own TCO tool asks the buyer to type the unit cost in. The only verified figure anywhere is £175 per licence per year (UK, BESA LendED). Boxes are rental units, not purchased",
        addons: [
          { n: "2026 renewal increase — +$10 per subscription per year, all renewals from 1 July 2026", price: 10, unit: "per room / yr", yr: true, src: "vivi.io 2026 North America pricing update, published" },
          { n: "Hardware replacement", price: 129, unit: "one-time, per replacement", src: "vivi.io: “replacements purchased on or after July 1, 2026 will be available at a one-time cost of $129” — note Vivi's FAQ still says replacement is covered by the subscription" },
          { n: "Live Captions — “an optional add-on to the Vivi campus operating system”", price: null, unit: "not published", src: "Vivi names it a paid add-on and publishes no price. [Obtain from Vivi.]" },
          { n: "Device Alerts — “available as an optional add-on or standalone product”", price: null, unit: "not published", src: "Vivi names it a paid add-on and publishes no price. [Obtain from Vivi.]" },
        ],
      },
    },
    Cisco: {
      "Room Bar": { hw: 3795, care: 0, sub: 0, ref: 5, est: true, brand: "Cisco Room Bar", src: "reseller-derived figure carried in our own competitive deck, unverified — Cisco publishes no list pricing" },
      "Room Bar Pro": { hw: 8295, care: 0, sub: 0, ref: 5, est: true, brand: "Cisco Room Bar", src: "reseller-derived figure carried in our own competitive deck, unverified — Cisco publishes no list pricing" },
    },
    "MTR / Zoom Room": {
      "Certified bar + room license": {
        hw: 2500, care: 0, sub: 0, ref: 5, est: true, brand: "MTR / Zoom Rooms",
        src: "street estimate for a certified bar, unverified. The platform licence is not in this figure — it is an add-on below",
        addons: [MTR_BASIC, MTR_PRO, ZOOM_ROOMS],
      },
    },
  },

  compAddons: {
    "Barco ClickShare": [
      { n: "SmartCare — free on registration: 1-year warranty extended to 5, plus 5 years of XMS data and analytics (not applicable to Hub)", price: 0, unit: "one-time, no charge", on: true, src: "barco.com, published: “SmartCare is a free service package that is included in the purchase of every ClickShare unit”. Barco's own pages disagree on the activation window — 6 months in the family brochure, 1 year on the SmartCare page" },
      { n: "ClickShare Button — USB-C only, and the only sharing path on Hub Core / Hub Pro", sku: "CSBTN004 / CSBTN005", price: 250, unit: "per seat, one-time", per: "seat", est: true, src: "street price, partner-sourced, unverified — Barco renders “Price not available” for the Button as for every ClickShare SKU" },
    ],
    Crestron: [
      { n: "XiO Cloud Premium — remote control, scheduled actions, dashboards, historical reports, third-party device management, the full API", sku: "SW-XIOC-PREMIUM-1YR-1-99", price: null, unit: "per device / yr, 1–3-year terms, three volume bands", yr: true, src: "Crestron publishes the SKU and the tier structure; the price is behind a partner login. [Obtain a channel quote.]" },
      { n: "AM-TX3 Connect Adaptor / Endpoint — the wireless path caps at 1080p30, so 4K30 needs this hardware", sku: "AM-TX3-100 / AM-TX3-200", price: null, unit: "per seat, one-time", per: "seat", src: "Crestron publishes the SKUs and no price. [Obtain a channel quote.]" },
    ],
    Kramer: [
      { n: "VSM on Cloud subscription — subscription-only, no free tier published", sku: "VSM-ON-CLOUD-SUB-1Y / -3Y / -5Y", price: null, unit: "per device / yr", yr: true, src: "Kramer's own configurations table publishes the SKUs, the per-device unit and the terms. The page is a quote cart with no figure. [Obtain a Kramer quote.]" },
      { n: "VSM on Cloud Digital Signage — a second subscription on top of the cloud subscription", sku: "VSM-ON-CLOUD-DSS-SUB-1Y / -3Y / -5Y", price: null, unit: "per device / yr", yr: true, src: "Kramer's own feature list flags it “(additional subscription)” and publishes the per-device term SKUs, no price. [Obtain a Kramer quote.]" },
    ],
    WolfVision: [
      { n: "vSolution Link Pro Premium — required above 50 devices; carries Entra ID and Active Directory", price: null, unit: "3- or 5-year term, single upfront payment", per: "over", freeUpTo: 50, src: "WolfVision release note, 20 July 2026: free below 50 devices, required above, term licence not perpetual. No price published. [Obtain from WolfVision.]" },
    ],
    Extron: [
      { n: "WFA 100 USB Miracast adapter — required for Miracast: ShareLink Pro has no onboard radio", sku: "60-1944-01 (US) / 60-1944-02 (EU)", price: null, unit: "per room, one-time", src: "Extron publishes the SKUs and the requirement; extron.com blocks automated retrieval, so no price. [Obtain an Extron quote.]" },
      { n: "LinkLicense Digital Signage Upgrade — perpetual, not recurring", sku: "79-2596-01", price: null, unit: "one-time, per room", src: "Extron publishes the SKU and the perpetual structure, no price. [Obtain an Extron quote.]" },
      { n: "LinkLicense Active Learning Upgrade [Extron documents this on the 2500; availability on the 500 and 1000 is unconfirmed]", sku: "79-2595-01", price: null, unit: "one-time, per room", src: "Extron publishes the SKU and the gating, no price. [Obtain an Extron quote.]" },
      { n: "LinkLicense H.264 Upgrade", sku: "79-2580-01", price: null, unit: "one-time, per room", src: "Extron publishes the SKU, no price. [Obtain an Extron quote.]" },
    ],
    ScreenBeam: [
      { n: "Administrative Tools Bundle (Signage+, Message Manager, Alert+, third-party EMS integration)", sku: "ADMTOOLSOOO", price: 999.99, unit: "one-time [ScreenBeam calls it a licence subscription and states no term, so whether this recurs is unknown]", src: "screenbeam.com published price" },
      { n: "Administrative Tools Bundle — Canada", sku: "ADMTOOLSOOOCA", price: 849.99, unit: "one-time [same term ambiguity as the US SKU]", src: "screenbeam.com published price" },
      { n: "ScreenBeam Cloud — a hard prerequisite for Administrative Tools", price: null, unit: "not published", src: "Listed as a requirement with no price of its own; whether it is separately charged is not established. [Obtain from ScreenBeam.]" },
      { n: "Active Learning — listed inside the free Essential Tools set, then marked “(subscription required)”", price: null, unit: "subscription, term not published", src: "ScreenBeam's own pages carry both strings. No price published. [Obtain from ScreenBeam.]" },
      { n: "USB Pro Switch — switches an MTR room between native MTR and BYOM", price: null, unit: "per room, one-time", src: "ScreenBeam labels it an optional add-on and publishes no price. [Obtain from ScreenBeam.]" },
    ],
    BenQ: [
      { n: "X-Sign digital signage — a separate BenQ product, not DMS", price: null, unit: "not published", src: "BenQ publishes no X-Sign price. [Obtain from BenQ.]" },
      { n: "Cloud DMS management [row appears on WDC25 and VS25 only, and VS25's is dated “available Q3 2026”]", price: null, unit: "not published", src: "BenQ nowhere states whether DMS is free or paid. [Obtain from BenQ.]" },
    ],
    Cisco: [
      { n: "Webex device / workspace subscription — carries Control Hub, and signage is native to it", price: null, unit: "per room / yr", yr: true, src: "Cisco publishes no list pricing. [Obtain a Cisco quote.]" },
      { n: "Solution Support / Smart Net Total Care", price: null, unit: "per room / yr", yr: true, src: "Cisco publishes no list pricing. Support is conventionally quoted as a percentage of hardware list, but no percentage was verified, so this calculator assumes none. [Obtain a Cisco quote.]" },
    ],
  },

  eq: { "Polaris Essentials": { hw: 0, sub: 330 }, "Polaris Pro": { hw: 0, sub: 599.88 }, "Launch (Shipping Q1 2027)": { hw: 450, sub: 0 } },
  hyb: { None: { hw: 0, sub: 0 }, "Link — hybrid add-on (ships September 2026)": { hw: 0, sub: 150 }, "Host — BYOM+ (ships Q4 2026, pricing TBD)": { hw: 1200, sub: 0 } },
};
