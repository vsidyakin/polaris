/* Build-time markup helpers for /resources/network.
   Extracted from the v1.95 POC page renderer. */
/* eslint-disable */
// @ts-nocheck

export const T=(hd,rows)=>`<div class="famtbl reveal"><table><tr>${hd.map(h=>`<th>${h}</th>`).join("")}</tr>${rows.map(r=>`<tr>${r.map((c,i)=>`<td${i===0?' style="white-space:nowrap"':''}>${c}</td>`).join("")}</tr>`).join("")}</table></div>`;
