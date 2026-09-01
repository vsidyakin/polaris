/* Build-time markup helpers for /resources/who.
   Extracted from the v1.95 POC page renderer. */
/* eslint-disable */
// @ts-nocheck
import { CNVIC } from "../../data/icons";
import { crumbs } from "../blocks";

export const face=(n,t,fun,cred)=>`<div class="cnv-face"><div class="slot">photo<br>slot</div><b>${n}</b><span>${t}</span><p><em style="color:#7ce3a8;font-style:normal">${fun}</em><br>${cred}</p></div>`;
