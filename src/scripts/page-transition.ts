/**
 * The outgoing half of the page transition — see components/PageTransition.astro
 * for the incoming half and for why the wrapper sits where it does.
 *
 * Same-origin link clicks are held for the length of the fade and then followed
 * by hand. Everything else — new tab, download, external host, hash on the
 * current page, a handler that already called preventDefault — is left to the
 * browser untouched, because a transition is never worth breaking a link over.
 */

/** Keep in step with the transition duration in PageTransition.astro. */
const OUT_MS = 120;

const root = document.documentElement;

/* Back/forward out of the bfcache restores the DOM exactly as it was left —
   mid-fade, with the attribute still set — so the restored page would be blank.
   Fires on a normal load too, which is harmless. */
addEventListener("pageshow", () => root.removeAttribute("data-leaving"));

if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
  document.addEventListener("click", (ev) => {
    if (ev.defaultPrevented || ev.button !== 0) return;
    if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;

    const link = (ev.target as Element | null)?.closest?.("a");
    if (!link) return;

    const raw = link.getAttribute("href");
    if (!raw || raw.startsWith("#")) return;
    if (link.hasAttribute("download") || link.hasAttribute("data-no-transition")) return;

    const target = link.getAttribute("target");
    if (target && target !== "_self") return;

    /* mailto:, tel: and javascript: all parse to an opaque origin, so the
       same-origin test below drops them with the external links. */
    let url: URL;
    try {
      url = new URL(link.href, location.href);
    } catch {
      return;
    }
    if (url.origin !== location.origin) return;

    /* Same document — a hash jump or a link back to the page you are on.
       Fading out and reloading would be worse than doing nothing. */
    if (url.pathname === location.pathname && url.search === location.search) return;

    ev.preventDefault();
    root.setAttribute("data-leaving", "");
    setTimeout(() => {
      location.href = url.href;
    }, OUT_MS);
  });
}
