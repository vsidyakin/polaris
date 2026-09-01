// @ts-nocheck
/* eslint-disable */
/* Partner portal mock: any well-formed address opens the shell. */
const $ = (s: string) => document.querySelector(s) as any;

function portalIn(){
  const e=$("#pemail").value;
  if(/.+@.+\..+/.test(e)){$("#loginbox").style.display="none";$("#portalshell").style.display="block";}
  else alert("POC: enter a well-formed email.");
}

/* Inline handlers in the markup resolve against the global scope. */
Object.assign(window, { portalIn });

/* No static imports above, so mark this a module: without it the file is a
   global script and its top-level names collide with the other page scripts. */
export {};
