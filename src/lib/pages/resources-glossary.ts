/* Build-time markup helpers for /resources/glossary.
   Extracted from the v1.95 POC page renderer. */
/* eslint-disable */
// @ts-nocheck


export const def=(term,syn,line,body)=>`<details class="fx-def"><summary><b>${term}${syn?` <span class="fx-syn">${syn}</span>`:""}</b><span class="d">${line}</span><span class="more">＋ more</span></summary><div class="bd">${body}</div></details>`;
