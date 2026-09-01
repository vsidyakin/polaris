// @ts-nocheck
/* eslint-disable */
/* Documentation hub search box (hands off to the docs portal in production). */
const $ = (s: string) => document.querySelector(s) as any;

function cnvDocSearch(){
  const q=($("#docq")||{}).value||"";
  alert("POC mock: production hands this query to the documentation portal search"+(q.trim()?" — \""+q.trim()+"\"":"")+".");
}

/* Inline handlers in the markup resolve against the global scope. */
Object.assign(window, { cnvDocSearch });

/* No static imports above, so mark this a module: without it the file is a
   global script and its top-level names collide with the other page scripts. */
export {};
