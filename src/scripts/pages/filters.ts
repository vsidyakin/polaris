/* Chip and button filters for the resource pages.
 *
 * The POC declared two different functions both named fxFilter; the later
 * definition shadowed the earlier one, which quietly broke the firmware
 * platform filter. They are separate names here.
 */

/** Case studies: chip group -> [data-fxg] cards. Chips are marked with
    [data-fxchip] rather than a visual class, so this stays correct whatever
    a chip is styled as. */
function fxFilter(group: string, val: string, btn: Element) {
  document
    .querySelectorAll(`[data-fxchips="${group}"] [data-fxchip]`)
    .forEach((c) => c.classList.toggle("on", c === btn));
  document.querySelectorAll(`[data-fxg="${group}"]`).forEach((c) => {
    const vals = (c.getAttribute("data-fxv") || "").split(" ");
    c.classList.toggle("hide", val !== "all" && !vals.includes(val));
  });
}

/** Firmware: platform buttons -> .fx-entry[data-plat] rows. */
function fxFilterPlat(btn: Element, plat: string) {
  document.querySelectorAll(".fx-filter button").forEach((b) => b.classList.toggle("on", b === btn));
  document.querySelectorAll<HTMLElement>(".fx-entry").forEach((e) => {
    const p = e.getAttribute("data-plat") || "";
    e.style.display = plat === "all" || p.includes(plat) ? "" : "none";
  });
}

Object.assign(window, { fxFilter, fxFilterPlat });

/* No static imports above, so mark this a module: without it the file is a
   global script and its top-level names collide with the other page scripts. */
export {};
