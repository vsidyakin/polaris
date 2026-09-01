// @ts-nocheck
/* eslint-disable */
/* Trial / demo / contact / partner-application forms.
   Validation and the confirmation state are real; submission is a mock until
   the HubSpot form GUIDs land (see scripts/site.ts). */
const $ = (s: string) => document.querySelector(s) as any;

function cnvSubmit(kind){
  const btn=event&&event.target;
  const form=btn?btn.closest(".cnv-form"):null;
  if(!form){alert("POC mock: nothing was sent.");return}
  let bad=false;
  form.querySelectorAll(".cnv-field").forEach(f=>{
    f.classList.remove("err");
    const old=f.querySelector(".fmsg");if(old)old.remove();
    const inp=f.querySelector("input,textarea");
    if(!inp)return;
    const lbl=(f.querySelector("label")||{}).textContent||"This field";
    const v=inp.value.trim();
    const isEmail=inp.type==="email";
    const optional=/optional/i.test(lbl);
    if(!optional&&!v){f.classList.add("err");f.insertAdjacentHTML("beforeend",`<span class="fmsg err" role="alert">${lbl} is required.</span>`);bad=true}
    else if(isEmail&&v&&v.indexOf("@")<0){f.classList.add("err");f.insertAdjacentHTML("beforeend",`<span class="fmsg err" role="alert">That doesn&rsquo;t look like an email address.</span>`);bad=true}
  });
  if(bad)return;
  if(!form.querySelector(".fsuccess"))
    btn.insertAdjacentHTML("afterend",`<div class="fsuccess" role="status"><b>Request received.</b> POC mock: nothing was sent. Production wires this ${kind} into CRM routing, partner-attached when your account has one, with this confirmation pattern.</div>`);
}

/* Inline handlers in the markup resolve against the global scope. */
Object.assign(window, { cnvSubmit });

/* No static imports above, so mark this a module: without it the file is a
   global script and its top-level names collide with the other page scripts. */
export {};
