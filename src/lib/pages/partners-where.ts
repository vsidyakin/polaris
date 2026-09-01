/* Build-time markup helpers for /partners/where.
   Extracted from the v1.95 POC page renderer. */
/* eslint-disable */
// @ts-nocheck
import { crumbs } from "../blocks";

export const P=[
    {n:"[Distributor A — named placeholder]",dist:true,r:"na emea",rl:["NA","EMEA"],sp:["Distribution","Reseller enablement"],b:"Broadline AV distribution: stock, credit, next-day logistics, and a design desk for the authorized reseller community. [Named distributor pending agreement sign-off.]"},
    {n:"[Distributor B — named placeholder]",dist:true,r:"na latam",rl:["NA","LATAM"],sp:["Distribution","UC &amp; ProAV"],b:"Value-added ProAV and UC distribution across the Americas, with demo stock and configuration services. [Named distributor pending agreement sign-off.]"},
    {n:"[Enterprise integrator — placeholder]",r:"na",rl:["NA"],sp:["Corporate","Enterprise rollouts"],b:"Global-estate integrator: thousand-room deployments, segmented networks, and the security paperwork to match."},
    {n:"[Education specialist — placeholder]",r:"na",rl:["NA"],sp:["K-12","Higher ed"],b:"Classroom-first design-build shop: Chromebook fleets, active-learning spaces, funding-cycle literate."},
    {n:"[EMEA integrator — placeholder]",r:"emea",rl:["EMEA"],sp:["Corporate","Government"],b:"Multi-country UC and AV integration with in-region support desks and public-sector framework experience."},
    {n:"[APAC integrator — placeholder]",r:"apac",rl:["APAC"],sp:["Corporate","Hybrid rooms"],b:"Design-and-deploy across APAC hubs; strong on wireless BYOM retrofits of existing room AV."},
    {n:"[LATAM reseller — placeholder]",r:"latam",rl:["LATAM"],sp:["Corporate","SMB estates"],b:"Regional reseller with rapid-deployment kits and Spanish/Portuguese support coverage."},
    {n:"[Regional design-build — placeholder]",r:"na",rl:["NA"],sp:["Healthcare","Regulated"],b:"Two-state design-build firm that lives in hospitals and clinics; clinical-network deployments are the specialty."}
  ];
  export const cards=P.map(p=>`<div class="cnv-pcard${p.dist?" dist":""}" data-regions="${p.r}" data-t="${p.dist?"dist":"ri"}"><div class="cnv-plogo">logo slot</div><b>${p.n}</b>${p.dist?`<div class="pk">Distributor</div>`:""}<p>${p.b}</p><div class="cnv-ptags">${p.rl.map(x=>`<span class="rg">${x}</span>`).join("")}${p.sp.map(x=>`<span>${x}</span>`).join("")}</div><a class="out" href="/partners/where" onclick="event.preventDefault();alert('POC mock: production links out to the partner site.')">Visit partner site ↗</a></div>`).join("");
