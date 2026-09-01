/* Blog post: the on-page TOC tracks reading position. The current section is
   the last h2 whose top has crossed the reading line (a little under the sticky
   header, matching the headings' scroll-margin-top). Scroll-driven rather than
   IntersectionObserver so exactly one entry is lit, including at the very
   bottom of the page, and none before the first section begins. */

const heads = Array.from(
  document.querySelectorAll<HTMLElement>(".bpx-prose h2[id]"),
);
const links = new Map<string, HTMLAnchorElement>();
for (const a of document.querySelectorAll<HTMLAnchorElement>('.bpx-toc a[href^="#"]')) {
  links.set(decodeURIComponent(a.hash.slice(1)), a);
}

if (heads.length && links.size) {
  const LINE = 130; // px from viewport top: just under the headings' scroll margin
  let current: string | null = null;
  let queued = false;

  const apply = () => {
    queued = false;
    let active: string | null = null;
    for (const h of heads) {
      if (h.getBoundingClientRect().top <= LINE) active = h.id;
      else break;
    }
    if (active === current) return;
    current = active;
    for (const [id, a] of links) {
      const on = id === active;
      a.classList.toggle("on", on);
      if (on) a.setAttribute("aria-current", "true");
      else a.removeAttribute("aria-current");
    }
  };

  const onScroll = () => {
    if (!queued) {
      queued = true;
      requestAnimationFrame(apply);
    }
  };

  addEventListener("scroll", onScroll, { passive: true });
  addEventListener("resize", onScroll, { passive: true });
  apply();
}

/* No static imports above, so mark this a module: without it the file is a
   global script and its top-level names collide with the other page scripts. */
export {};
