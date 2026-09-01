/* Product cards in the navigation.
 *
 * A nav row whose route appears here renders as a card — a product thumbnail on
 * the left, the nav label and a one-line blurb on the right — instead of a plain
 * text row. Everything else about the row is unchanged: the label still comes
 * from `NAV` in `nav.ts`, so this file never restates a product name.
 *
 * Scope: HARDWARE ONLY. Link, Host, Route and Engage are software and stay as
 * plain rows; a card with a device photograph next to a software add-on would
 * imply a box that does not exist. `SiteHeader` turns a `_grp` into a card group
 * only when every one of its children is listed here, so adding a software route
 * to this map would silently promote its whole group.
 *
 * Blurbs track the "at a glance" cards on `products/family`. Keep them one line
 * — a nav card is a signpost, not a spec — and keep them inside the rulings:
 * every difference between Pro and Essentials is a chassis difference, never a
 * software tier (see `rulings.ts`, TIERS.sameSoftware).
 *
 * `thumb` is optional and rooted at the site root, so `rebase-html.mjs` rewrites
 * it under `BASE_PATH` with every other literal path. Cards without one get the
 * empty frame in `.navcard-fig` rather than a borrowed photograph of a different
 * product — Launch has no transparent render yet.
 *
 * The two renders that exist are cut from the zoom sequences in
 * `public/products/*-zoom-alpha`, framed the same way so the cards sit level
 * with each other: the device trimmed to its own alpha bounds, scaled to 262 px
 * wide, then a 13 px transparent border. Heights differ because the devices do
 * — the Mini is a thinner bar than the Pro — which is the point of showing them
 * side by side.
 */
import type { Route } from "./routes";
import { TIERS } from "./rulings";

export interface NavCard {
  /** Rooted path to a transparent product render, or absent until one exists. */
  thumb?: string;
  /** Intrinsic size of `thumb`, so the row cannot shift as the image decodes. */
  w?: number;
  h?: number;
  /** One line under the product name. */
  blurb: string;
}

export const NAV_CARDS: Partial<Record<Route, NavCard>> = {
  "products/pro": {
    thumb: "/products/thumbs/polaris-pro.webp",
    w: 288,
    h: 103,
    blurb: "BYOM, HDMI in and dual 4K60 out, PoE+ and 802.1X. Continues Solstice Gen 3."
  },
  "products/essentials": {
    thumb: "/products/thumbs/polaris-essentials.webp",
    w: 288,
    h: 100,
    /* Reads like Pro's: what the chassis does, then the one-line placement. Two
       things it deliberately does NOT do. It states the display count rather
       than the output figure — `ESSENTIALS_OUTPUT.format` is "DCI 4K, 4096 x
       2160, at 30 Hz", and SPEC_DETAIL_RULE says a spec is stated in its most
       detailed form everywhere or not at all, so a nav-card "4K30" would be the
       vaguer restatement the rule exists to stop. And the share ceiling is
       imported, never typed: it is a ruled figure (TIERS.shares) that has been
       re-litigated three times. */
    blurb: `One display and GbE, around ${TIERS.shares.essentials} shares at once. The same software as Pro in the Mini chassis.`
  },
  "products/launch": {
    blurb: "A local-first dongle: plug it into any display's HDMI and share. One-time purchase, no subscription."
  }
};
