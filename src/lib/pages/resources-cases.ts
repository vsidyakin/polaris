/* Build-time markup helpers for /resources/cases.
 *
 * The story CARD itself now renders through the shared `PostGrid` component
 * (src/components/PostGrid.astro) — the same grid the blog hub uses — rather
 * than the raw-HTML-string `caseCard()` that used to live here. Only the
 * pipeline placeholder survives in this file: it has no photograph, no quote
 * and nowhere to link, which is a shape `PostGrid` doesn't (and shouldn't)
 * support, since dressing it as a real card would promise a study that
 * doesn't exist.
 */

/* A pipeline slot: a named account with a real fleet and no published story yet.
   Deliberately not a real card — it has no photograph, no quote and nowhere to
   link, and dressing it as one would promise a study that does not exist. */
export const slot = (
  sec: string,
  secLbl: string,
  name: string,
  h: string,
  p: string,
  s1: [string, string],
  s2: [string, string]
): string =>
  `<div class="fx-case" data-fxg="cases" data-fxv="${sec}">
    <div class="logo">${name}</div><div class="ik cat-${sec.split(" ")[0]}">${secLbl}</div><h3>${h}</h3><p>${p}</p>
    <div class="fx-cstats"><div class="fx-cstat"><b>${s1[0]}</b><span>${s1[1]}</span></div><div class="fx-cstat"><b>${s2[0]}</b><span>${s2[1]}</span></div></div>
    <span class="fx-pend">[story pending: interview + approval]</span></div>`;
