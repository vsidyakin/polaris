// @ts-nocheck
/* eslint-disable */
/* 10-year TCO calculator: competitor SKU vs the Polaris equivalent, plus the
   "what the difference buys" chips underneath.

   Add-ons: each competitor product carries the paid add-ons the invoice actually
   carries (vendor-wide ones in CALCDATA.compAddons, product-specific ones on the
   product). Checked add-ons feed the total. Two states never contribute money and
   both say so on screen: `price: null` (the vendor publishes no figure) and
   `est: true` (a street or dated figure, not a published list price). Bracketed
   text is the site's verify-flag convention and renders yellow. */
import { CALCDATA } from "../../data/tco";
import { withBase } from "../../lib/base";
import {
  COMP,
  DELTA_LIB,
  DELTA_MAP,
  DELTA_OVR,
  VS_PROFILE,
  BRANDIX,
  IODATA,
  IO_POLARIS,
} from "../../data/compare";
import { XIC } from "../../data/icons";
const $ = (s: string) => document.querySelector(s) as any;

/* Calculator vendor keys are shorter than the compare-matrix column names. */
const CMP_ALIAS={"MTR / Zoom Room":"MTR / Zoom Rooms",Crestron:"Crestron AirMedia",Kramer:"Kramer VIA",WolfVision:"WolfVision Cynap",Extron:"Extron ShareLink Pro",BenQ:"BenQ InstaShow",Yealink:"Yealink RoomCast",DisplayNote:"DisplayNote Montage",Cisco:"Cisco Room Bar"};
/* Row values are 1-based: values[0] is Polaris, values[1..] follow COMP.brands. */
function brandIdx(oem,prod){
  const p=(CALCDATA.comp[oem]||{})[prod];
  const nm=(p&&p.brand)||CMP_ALIAS[oem]||oem;
  const i=COMP.brands.indexOf(nm);
  return i>=0?i+1:BRANDIX[oem];
}
function prodOf(sfx){
  const o=document.getElementById("c_oem"+sfx),p=document.getElementById("c_prod"+sfx);
  if(!o||!p||o.value==="None")return null;
  return (CALCDATA.comp[o.value]||{})[p.value]||null;
}
function addonsFor(oem,prod){
  const vend=(CALCDATA.compAddons||{})[oem]||[];
  const p=(CALCDATA.comp[oem]||{})[prod];
  return vend.concat((p&&p.addons)||[]);
}
const money=n=>"$"+n.toLocaleString(undefined,{minimumFractionDigits:n%1?2:0,maximumFractionDigits:2});
/* Never render an unpriced add-on as zero: name it and say it must be obtained. */
function adPrice(a){
  if(a.price===null)return `[price not published &mdash; obtain it before you sign] &middot; ${a.unit}`;
  if(a.price===0)return `$0 &middot; ${a.unit}`;
  return (a.est?`[~${money(a.price)}, estimate]`:money(a.price))+` &middot; ${a.unit}`;
}
function priceState(p){
  const miss=[];
  if(p.hw===null)miss.push("device cost");
  if(p.sub===null)miss.push("licence cost");
  const head=miss.length
    ?`[${miss.join(" and ")} not published &mdash; enter your quoted figure above]`
    :p.est?"[street estimate, not a published list price]":"Vendor-published price.";
  return head+(p.src?" "+p.src+".":"");
}
function renderAddons(sfx){
  const box=document.getElementById("c_addons"+sfx); if(!box)return;
  const oemEl=document.getElementById("c_oem"+sfx),prodEl=document.getElementById("c_prod"+sfx);
  if(!oemEl||!prodEl||oemEl.value==="None"||!CALCDATA.comp[oemEl.value]){box.innerHTML="";return}
  const p=CALCDATA.comp[oemEl.value][prodEl.value];
  if(!p){box.innerHTML="";return}
  const list=addonsFor(oemEl.value,prodEl.value);
  let h=`<p class="note" style="margin:0 0 8px">${priceState(p)}</p>`;
  if(!list.length){
    h+=`<p class="note" style="margin:0">No paid add-on is published for this product.</p>`;
  }else{
    h+=`<div class="kicker" style="margin-bottom:6px">Add-ons this product is billed for</div><div style="display:grid;gap:8px">`+list.map((a,i)=>
      `<label style="display:block;margin:0;font-weight:400;font-size:12px;line-height:1.5;color:#b9a9e6"><input type="checkbox" id="c_ad${sfx}_${i}"${a.on?" checked":""} onchange="calcTCO()" style="width:auto;padding:0;margin:0 8px 0 0;vertical-align:baseline"><b style="color:#e9e2ff;font-size:12px">${a.n}</b>${a.sku?` <span style="opacity:.75">${a.sku}</span>`:""}<br><span style="padding-left:22px;display:inline-block">${adPrice(a)} &middot; ${a.src}</span></label>`
    ).join("")+`</div>`;
  }
  box.innerHTML=h;
}
/* Sum the checked add-ons. Unpriced ones are counted, not costed. */
function addonSum(sfx,rooms,yrs,seats){
  const out={cost:0,on:[],unpriced:0};
  const oemEl=document.getElementById("c_oem"+sfx),prodEl=document.getElementById("c_prod"+sfx);
  if(!oemEl||!prodEl||oemEl.value==="None"||!CALCDATA.comp[oemEl.value])return out;
  addonsFor(oemEl.value,prodEl.value).forEach((a,i)=>{
    const cb=document.getElementById(`c_ad${sfx}_${i}`);
    if(!cb||!cb.checked)return;
    out.on.push(a.n.split(" — ")[0].split(" [")[0]);
    if(a.price===null){out.unpriced++;return}
    let n=rooms;
    if(a.per==="seat")n=rooms*seats;
    else if(a.per==="over")n=Math.max(0,rooms-(a.freeUpTo||0));
    out.cost+=a.price*n*(a.yr?yrs:1);
  });
  return out;
}

function opts(o,sel){return Object.keys(o).map(k=>`<option${k===sel?" selected":""}>${k}</option>`).join("")}
function fillComp(oemChanged){
  const oem=document.getElementById("c_oem").value;
  const prodSel=document.getElementById("c_prod");
  if(oemChanged){prodSel.innerHTML=opts(CALCDATA.comp[oem],Object.keys(CALCDATA.comp[oem])[0])}
  const p=CALCDATA.comp[oem][prodSel.value];
  document.getElementById("c_hw").value=p.hw===null?0:p.hw;
  document.getElementById("c_care").value=p.care;
  document.getElementById("c_csub").value=p.sub===null?0:p.sub;
  document.getElementById("c_ref").value=5; /* CEO: default 5-yr refresh; presets no longer override */
  renderAddons("");
  calcTCO();
}
function fillComp2(oemChanged){
  const sel=document.getElementById("c_oem2"); if(!sel)return;
  const oem=sel.value;
  const prodSel=document.getElementById("c_prod2");
  if(oem==="None"){prodSel.innerHTML="<option>n/a</option>";["c_hw2","c_care2","c_csub2"].forEach(id=>document.getElementById(id).value=0);document.getElementById("c_ref2").value=5;renderAddons("2");calcTCO();return}
  if(oemChanged){prodSel.innerHTML=opts(CALCDATA.comp[oem],Object.keys(CALCDATA.comp[oem])[0])}
  const p=CALCDATA.comp[oem][prodSel.value];
  document.getElementById("c_hw2").value=p.hw===null?0:p.hw;
  document.getElementById("c_care2").value=p.care;
  document.getElementById("c_csub2").value=p.sub===null?0:p.sub;
  document.getElementById("c_ref2").value=5;
  renderAddons("2");
  calcTCO();
}
function calcTCO(){
  const v=id=>{const e=document.getElementById(id);return e?Math.max(0,+e.value||0):0};
  if(!document.getElementById("c_rooms"))return;
  if(document.getElementById("c_prod")&&!document.getElementById("c_prod").options.length){fillComp(true);return}
  if(document.getElementById("c_prod2")&&!document.getElementById("c_prod2").options.length){fillComp2(true);return}
  const rooms=v("c_rooms"),yrs=v("c_years");
  const seats=document.getElementById("c_seats")?v("c_seats"):0;
  const oem=document.getElementById("c_oem").value,cp=document.getElementById("c_prod").value;
  const oem2=document.getElementById("c_oem2").value,cp2=document.getElementById("c_prod2").value;
  const bOn=oem2!=="None";
  const eqName=document.getElementById("e_prod").value,hybName=document.getElementById("e_hyb").value;
  const eq=CALCDATA.eq[eqName],hyb=CALCDATA.hyb[hybName];
  const costOf=(hw,care,sub,ref)=>rooms*(hw*Math.ceil(yrs/Math.max(2,ref))+care*yrs+sub*yrs);
  const adA=addonSum("",rooms,yrs,seats),adB=bOn?addonSum("2",rooms,yrs,seats):{cost:0,on:[],unpriced:0};
  const them=costOf(v("c_hw"),v("c_care"),v("c_csub"),v("c_ref"))+adA.cost;
  const them2=bOn?costOf(v("c_hw2"),v("c_care2"),v("c_csub2"),v("c_ref2"))+adB.cost:0;
  const us=rooms*((eq.hw+hyb.hw)*Math.ceil(yrs/10)+(eq.sub+hyb.sub)*yrs);
  const fmt=n=>"$"+Math.round(n).toLocaleString();
  const mx=Math.max(them,them2,us,1);
  /* A product whose price the vendor does not publish, and for which nothing has
     been typed in, gets no total at all. Showing $0 would flatter them. */
  const pA=prodOf(""),pB=prodOf("2");
  const noPrice=(sfx,p)=>!!p&&((p.hw===null&&!v("c_hw"+sfx))||(p.sub===null&&!v("c_csub"+sfx)));
  const npA=noPrice("",pA),npB=bOn&&noPrice("2",pB);
  /* Name what is in the total, and name what had to be left out of it. */
  const desc=(sfx,ad,np)=>{
    const buys=Math.ceil(yrs/Math.max(2,v("c_ref"+sfx)));
    const parts=[];
    if(v("c_hw"+sfx))parts.push(`${buys}× hardware purchase${buys>1?"s":""}`);
    if(v("c_care"+sfx))parts.push("care contract");
    if(v("c_csub"+sfx))parts.push("per-room licence");
    if(ad.on.length)parts.push(`${ad.on.length} add-on${ad.on.length>1?"s":""} (${ad.on.join("; ")})`);
    const p=prodOf(sfx);
    let s=parts.length?parts.join(" + ")+` over ${yrs} yrs`:`nothing priced over ${yrs} yrs`;
    if(np)s=`[no published price: enter this vendor's quoted device cost above and the total appears]`;
    else if(p&&p.est)s+=` · [figures include a street estimate, not a published price]`;
    if(ad.unpriced)s+=` · [${ad.unpriced} selected add-on${ad.unpriced>1?"s have":" has"} no published price and ${ad.unpriced>1?"are":"is"} not costed here]`;
    return s;
  };
  document.getElementById("c_themlbl").textContent=oem+" · "+cp;
  document.getElementById("c_them").textContent=npA?"—":fmt(them);
  document.getElementById("c_themd").textContent=desc("",adA,npA);
  document.getElementById("c_themb").style.width=(npA?0:them/mx*100)+"%";
  document.getElementById("c_res2").style.display=bOn?"":"none";
  if(bOn){
    document.getElementById("c_them2lbl").textContent=oem2+" · "+cp2;
    document.getElementById("c_them2").textContent=npB?"—":fmt(them2);
    document.getElementById("c_them2d").textContent=desc("2",adB,npB);
    document.getElementById("c_them2b").style.width=(npB?0:them2/mx*100)+"%";
  }
  document.getElementById("c_uslbl").textContent=eqName+(hybName!=="None"?" + "+hybName.split(" —")[0]:"")+" (warranty + updates included)";
  document.getElementById("c_us").textContent=fmt(us);
  document.getElementById("c_usd").textContent=`${yrs} yrs on the 10-year platform: one install, no care contract`;
  document.getElementById("c_usb").style.width=(us/mx*100)+"%";
  /* Only compare against columns that have a number. */
  const cands=[];
  if(!npA)cands.push({n:oem,t:them});
  if(bOn&&!npB)cands.push({n:oem2,t:them2});
  let saveTxt;
  if(!cands.length){
    saveTxt=`${bOn?`Neither ${oem} nor ${oem2} publishes a price`:`${oem} publishes no price`}. Polaris is ${fmt(us)} over ${yrs} years; enter a quoted device cost above to compare.`;
  }else if(cands.length===2){
    const cheaper=them<=them2?oem:oem2,d=Math.min(them,them2)-us;
    saveTxt=`Over ${yrs} years: ${oem} ${fmt(them)} · ${oem2} ${fmt(them2)} · Polaris ${fmt(us)}. `+(d>0?`Polaris saves ${fmt(d)} against the cheaper of the two.`:d<0?`Polaris costs ${fmt(-d)} more than ${cheaper} at these assumptions; adjust and see.`:`Even money with ${cheaper}.`);
  }else{
    const c=cands[0],d=c.t-us,pct=c.t?` (${Math.round(d/c.t*100)}%)`:"";
    saveTxt=(bOn?`${c.n===oem?oem2:oem} publishes no price. `:"")+(d>0?`Polaris saves ${fmt(d)} against ${c.n} over ${yrs} years${pct}`:d<0?`Polaris costs ${fmt(-d)} more than ${c.n} over ${yrs} years at these assumptions; adjust and see`:`Even money with ${c.n} at these assumptions.`);
  }
  document.getElementById("c_save").textContent=saveTxt;
  const dEl=document.getElementById("c_delta");
  if(!dEl)return;
  if(!bOn){
    const keys=DELTA_MAP[cp]||["workspace","webjoin","crossnet","warranty"];
    let h=`<div class="tco-delta"><div class="kicker" style="color:#7ce3a8">What the difference buys</div>
    <h3>Choosing Polaris over ${oem} ${cp} means keeping:</h3><div class="tco-chips">`;
    keys.forEach(k=>{const it=DELTA_LIB[k],ov=(DELTA_OVR[cp]||{})[k];h+=`<a class="tco-chip" href="${withBase(`/${it.l||"compare/hub"}`)}"><div class="ic">${XIC[it.ic]||XIC.workspace}</div><b>${it.t}</b><p>${ov||it.d}</p></a>`});
    h+=`</div><p class="note">The invoice shows the delta; it doesn't show these. [Chip sets pending canonical-matrix sign-off.]</p><p style="margin-top:10px"><a href="${withBase("/compare/hub")}" onclick="window.__cmpPre=${JSON.stringify(oem)}">Now see everything else: the full comparison vs ${oem} →</a></p></div>`;
    dEl.innerHTML=h;
    return;
  }
  /* competitor vs competitor: the honest head-to-head, then what the Mersive column adds */
  const iA=brandIdx(oem,cp),iB=brandIdx(oem2,cp2);
  let neither=[];
  COMP.groups.forEach(g=>g.rows.forEach(r=>{
    const p0=r[1][0],va=r[1][iA],vb=r[1][iB];
    if(p0==="y"&&va!=="y"&&vb!=="y")neither.push(r[0]);
  }));
  const prof=o=>VS_PROFILE[o]||{well:["[Profile pending]"],short:["[Profile pending]"]};
  const vcard=(o,pr)=>`<div class="vs-col"><b>${o}: what it does well</b><ul>${pr.well.map(t=>`<li>${t}</li>`).join("")}</ul><b class="vs-short">Where it falls short</b><ul>${pr.short.map(t=>`<li>${t}</li>`).join("")}</ul></div>`;
  const ioA=IODATA[cp]||["?","?","?","?"],ioB=IODATA[cp2]||["?","?","?","?"];
  const IOROWS=["Display out","HDMI input","Network","Power"];
  let io=`<table class="vs-tbl"><tr><th></th><th>${cp}</th><th>${cp2}</th><th>Polaris Pro</th></tr>`;
  IOROWS.forEach((r,i)=>{io+=`<tr><td>${r}</td><td>${ioA[i]}</td><td>${ioB[i]}</td><td>${IO_POLARIS[i]}</td></tr>`});
  io+=`</table>`;
  let h=`<div class="tco-delta"><div class="kicker">The honest head-to-head</div>
  <h3>${oem} ${cp} vs ${oem2} ${cp2}</h3>
  <div class="vs2">${vcard(oem,prof(oem))}${vcard(oem2,prof(oem2))}</div>
  <p class="note">Faithful profiles from public materials and our competitive research; conceding where a rival is strong is house policy. [Profiles pending canonical-matrix sign-off.]</p>
  <div class="vs-io"><b>Hardware I/O, side by side</b>${io}<p class="note">Competitor I/O from vendor spec sheets, retrieved August 2026; MTR bars vary by model. Barco, Crestron, Kramer, Cisco, Extron and Yealink publish no list price for anything, so their figures here are dated street estimates. ScreenBeam ($1,199.99 / $549.99) and BenQ ($899 / $1,499 / $1,999) publish hardware prices; Airtame and ScreenBeam publish add-on prices. [Polaris Pro I/O per PRD; wired-port note unresolved. Reseller name and capture date per estimated figure pending the pricebook owner.]</p></div>
  <div class="kicker" style="color:#7ce3a8;margin-top:18px">What the Mersive column adds</div>
  <h3>Rows where neither ${oem} nor ${oem2} publishes the capability:</h3><div class="tco-chips">`;
  neither.slice(0,8).forEach(t=>{h+=`<a class="tco-chip" href="${withBase("/compare/hub")}"><b>${t}</b><p>Full vendor-by-vendor detail in the compare matrix.</p></a>`});
  h+=`</div><p class="note">Built from the same capability grid as the compare matrix, graded from each vendor&rsquo;s own published documentation retrieved August 2026. A row appears here only where that documentation does not establish the capability; partial support is not counted as having it, and the partials are shown in the matrix. [Grid pending canonical-matrix sign-off; per-row source URLs pending.]</p></div>`;
  dEl.innerHTML=h;
}

/* Inline handlers in the markup resolve against the global scope. */
Object.assign(window, { fillComp, fillComp2, calcTCO });

calcTCO();
