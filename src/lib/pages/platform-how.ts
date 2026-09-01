/* Build-time markup helpers for /platform/how.
   Extracted from the v1.95 POC page renderer. */
/* eslint-disable */
// @ts-nocheck
import { LYR } from "../../data/icons";
import { collabScene, parityFig } from "../blocks";

export const W={
    open:`<svg viewBox="0 0 28 28" fill="none"><rect x="2.5" y="4.5" width="23" height="18" rx="3" stroke="#a58cff" stroke-width="1.7"/><path d="M2.5 9.5h23" stroke="#a58cff" stroke-width="1.7"/><circle cx="6" cy="7" r=".9" fill="#7ce3a8"/><circle cx="9" cy="7" r=".9" fill="#8f7ae0"/><path d="M8 15.5h12M8 18.5h7" stroke="#4a3d7d" stroke-width="1.6" stroke-linecap="round"/></svg>`,
    code:`<svg viewBox="0 0 28 28" fill="none"><rect x="2.5" y="9.5" width="23" height="9" rx="4.5" stroke="#a58cff" stroke-width="1.7"/><path d="M6.5 14h2.5M11 14h2.5M15.5 14H18" stroke="#8f7ae0" stroke-width="1.8" stroke-linecap="round"/><path d="M21.5 11.8v4.4" stroke="#7ce3a8" stroke-width="1.8" stroke-linecap="round"/><path d="M5 23.5h18" stroke="#4a3d7d" stroke-width="1.4" stroke-linecap="round" stroke-dasharray="2 3"/></svg>`,
    glass:`<svg viewBox="0 0 28 28" fill="none"><rect x="2.5" y="4.5" width="23" height="15" rx="2.5" stroke="#a58cff" stroke-width="1.7"/><rect x="5.5" y="7.5" width="8.5" height="6" rx="1" fill="rgba(143,122,224,.45)"/><rect x="16" y="7.5" width="6.5" height="6" rx="1" fill="rgba(124,227,168,.3)" stroke="#7ce3a8" stroke-width="1.3"/><rect x="5.5" y="15" width="17" height="2.2" rx="1.1" fill="#35304d"/><path d="M10 23.5h8M14 19.5v4" stroke="#8f7ae0" stroke-width="1.7" stroke-linecap="round"/></svg>`,
    dock:`<svg viewBox="0 0 28 28" fill="none"><rect x="2.5" y="4.5" width="23" height="18" rx="3" stroke="#a58cff" stroke-width="1.7"/><path d="M2.5 9.5h23" stroke="#a58cff" stroke-width="1.7"/><circle cx="9" cy="16.5" r="2.3" stroke="#7ce3a8" stroke-width="1.5"/><circle cx="14" cy="16.5" r="2.3" stroke="#8f7ae0" stroke-width="1.5"/><circle cx="19" cy="16.5" r="2.3" stroke="#4a8fb0" stroke-width="1.5"/></svg>`
  };
  export const seg=(on,total)=>{let s="";for(let i=0;i<total;i++)s+=`<span class="enc-seg${i<on?" on":""}"></span>`;return s};
