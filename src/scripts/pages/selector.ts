// @ts-nocheck
/* eslint-disable */
/* Four questions, one recommendation. */
import { withBase } from "../../lib/base";

const $ = (s: string) => document.querySelector(s) as any;

function selCalc(){
  const v=n=>{const r=document.querySelector(`input[name=${n}]:checked`);return r?+r.value:null};
  const a=[v("q1"),v("q2"),v("q3"),v("q4")];
  if(a.some(x=>x===null)){$("#selout").innerHTML="";return}
  const pro=!!a[0];
  $("#selout").innerHTML=`<div class="selresult"><b>Recommendation: Polaris ${pro?"Pro":"Essentials"}</b><br>${pro?"Conferencing with the room&rsquo;s camera and mic is Pro territory, the continuation of Mersive Solstice Gen 3.":(a[1]?"Cross-network sharing is included on every Polaris tier. Even with guests and segmented networks, share-first rooms are covered by Essentials.":"Your rooms are share-first on a flat network? Essentials covers it, and you can step up to Pro tier-by-tier later.")}<br><br><a class="btn accent" href="${withBase(`/products/${pro?"pro":"essentials"}`)}">See ${pro?"Pro":"Essentials"} →</a> &nbsp; <a class="btn secondary" href="${withBase("/trial")}">Start a trial</a></div>`;
}

/* Inline handlers in the markup resolve against the global scope. */
Object.assign(window, { selCalc });

/* No static imports above, so mark this a module: without it the file is a
   global script and its top-level names collide with the other page scripts. */
export {};
