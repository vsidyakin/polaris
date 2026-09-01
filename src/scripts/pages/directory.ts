// @ts-nocheck
/* eslint-disable */
/* Partner directory: region × partner-type chip filters. */
const $ = (s: string) => document.querySelector(s) as any;

const WHF = { r: "all", t: "all" };
function whApply(){
  document.querySelectorAll(".cnv-pcard").forEach(c=>{
    const rs=(c.getAttribute("data-regions")||"").split(" ");
    const t=c.getAttribute("data-t")||"ri";
    const rOk=WHF.r==="all"||rs.includes(WHF.r);
    const tOk=WHF.t==="all"||t===WHF.t;
    c.classList.toggle("hide", !(rOk&&tOk));
  });
}
function cnvRegion(r,btn){
  WHF.r=r;
  const host=btn.closest(".cnv-chips");
  if(host)host.querySelectorAll(".cnv-chip").forEach(c=>c.classList.toggle("on",c===btn));
  whApply();
}
function cnvType(t,btn){
  WHF.t=t;
  const host=btn.closest(".cnv-chips");
  if(host)host.querySelectorAll(".cnv-chip").forEach(c=>c.classList.toggle("on",c===btn));
  whApply();
}

/* Inline handlers in the markup resolve against the global scope. */
Object.assign(window, { cnvRegion, cnvType });

/* No static imports above, so mark this a module: without it the file is a
   global script and its top-level names collide with the other page scripts. */
export {};
