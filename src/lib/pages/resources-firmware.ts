/* Build-time markup helpers for /resources/firmware.
   Extracted from the v1.95 POC page renderer. */
/* eslint-disable */
// @ts-nocheck
import { upgradeBand } from "../blocks";

export const entry=(v,d,tags,body,plat)=>{plat=plat||"polaris";const pl=plat==="polaris solstice"?"Polaris &middot; Gen 3":plat==="solstice"?"Gen 3":"Polaris";return `<div class="fx-entry" data-plat="${plat}"><div class="v"><b>${v}</b><span>${d}</span><i class="fx-plat">${pl}</i></div><p class="d">${tags}${body}</p></div>`};
  export const T={f:`<span class="fx-tag feat">feature</span>`,s:`<span class="fx-tag sec">security</span>`,x:`<span class="fx-tag fix">fix</span>`};
