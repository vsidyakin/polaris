/* Build-time markup helpers for /platform/lineage.
   Extracted from the v1.95 POC page renderer. */
/* eslint-disable */
// @ts-nocheck
import { stars } from "../blocks";

export const node=(x,y,name,date,cap,hot?)=>{
    const r=hot?6.5:4.5,ray=hot?15:9;
    return `<g class="lin-star"><path d="M${x} ${y-ray}V${y+ray}M${x-ray} ${y}H${x+ray}" stroke="${hot?"#7ce3a8":"#a58cff"}" stroke-width="1.1" opacity=".8"/></g>
    ${hot?`<circle class="lin-halo" cx="${x}" cy="${y}" r="14" fill="none" stroke="#7ce3a8" stroke-width="1.6"/>`:""}
    <circle cx="${x}" cy="${y}" r="${r+3.5}" fill="${hot?"rgba(124,227,168,.16)":"rgba(165,140,255,.14)"}"/>
    <circle cx="${x}" cy="${y}" r="${r}" fill="${hot?"#7ce3a8":"#cbb8ff"}"/>
    <text x="${x}" y="${y+34}" text-anchor="middle" font-size="${hot?13:11.5}" font-weight="800" fill="${hot?"#7ce3a8":"#e2d9ff"}" letter-spacing="${hot?1:0}">${name}</text>
    <text x="${x}" y="${y+48}" text-anchor="middle" font-size="9.5" font-weight="${date.charAt(0)==="["?700:400}" fill="${date.charAt(0)==="["?"#ff7ac2":"#8a7fb8"}">${date}</text>
    <text x="${x}" y="${y+61}" text-anchor="middle" font-size="9" fill="#a89fce">${cap}</text>`;
  };
