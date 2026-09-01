/* Easter-egg runtime: the Mission Control launcher and eight canvas games.
 *
 * This is deliberately one module. The engine is a single dense graph of
 * mutually-recursive draw/update functions that the POC declared in one script
 * scope; splitting it would mean threading hundreds of imports through code
 * that is stable and self-contained. Static data lives in ./data.
 *
 * Ported verbatim from the v1.95 single-file POC apart from:
 *   - the closing boot section, replaced by initEasterEggs() below
 *   - inline HTML handlers, re-exposed on window at the bottom of this file
 */
/* eslint-disable */
// @ts-nocheck
import { withBase } from "../../lib/base";
import { EGG_TRACKS } from "../../data/egg-music";
import {
  EGG_MUSIC,
  SS_SCENE,
  EGG_ART,
  EARTH_OW,
  EARTH_DUN,
  EARTH_LOCKS,
  EARTH_META,
  EARTH_CAVES,
  EARTH_TOWER,
} from "./data";

const EggAudio=(()=>{
  const RM=window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const CEIL=0.25;             // master gain ceiling
  let ctx=null,master=null,muted=!!RM,noiseBuf=null,hum=null,humStop=null,lastHover=0,wak=false,mus=null,sting=null;
  /* rendered-track state (see "the rendered-track layer" below). `want` is the
     track the game last asked for, and it is what decides whether an async load
     that has just finished is still relevant or has been overtaken. */
  let trackBufs={},trackLoad={},trackFail={},want=null,fileMus=null;
  const DEFAULT_TRACK_GAIN=.16,   // sits a file alongside the sequencer, not over it
        XFADE=.5,                 // loop crossfade, seconds
        SCHED_AHEAD=2,            // keep this many seconds of loop queued
        PUMP_MS=500;
  function init(){             // call from a user gesture only
    if(!ctx){
      const AC=window.AudioContext||window.webkitAudioContext;
      if(!AC)return null;
      ctx=new AC();
      master=ctx.createGain();master.gain.value=muted?0:CEIL;
      master.connect(ctx.destination);
    }
    if(ctx.state==="suspended")ctx.resume();
    return ctx;
  }
  const ready=()=>!!ctx&&!muted;
  function noiseSrc(){
    if(!noiseBuf){
      noiseBuf=ctx.createBuffer(1,ctx.sampleRate,ctx.sampleRate);
      const d=noiseBuf.getChannelData(0);
      for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;
    }
    const s=ctx.createBufferSource();s.buffer=noiseBuf;s.loop=true;return s;
  }
  function tone(o){            // enveloped oscillator voice
    if(!ready())return;
    const t0=ctx.currentTime+(o.at||0),osc=ctx.createOscillator(),g=ctx.createGain();
    osc.type=o.w||"sine";
    osc.frequency.setValueAtTime(o.f0,t0);
    if(o.f1)osc.frequency.exponentialRampToValueAtTime(Math.max(o.f1,1),t0+o.dur);
    g.gain.setValueAtTime(0.0001,t0);
    g.gain.exponentialRampToValueAtTime(o.peak,t0+(o.a||.005));   // attack
    g.gain.exponentialRampToValueAtTime(0.0001,t0+o.dur);         // release
    /* `out` lets a caller route a voice through its own bus instead of straight
       to master, which is how the logo sting can be cut short when the film is
       skipped: the voices are scheduled in advance and cannot be unscheduled, so
       the only way to silence them is to close a gate they all pass through. */
    osc.connect(g);g.connect(o.out||master);
    osc.start(t0);osc.stop(t0+o.dur+.05);
  }
  function burst(o){           // enveloped filtered-noise voice
    if(!ready())return;
    const t0=ctx.currentTime+(o.at||0),s=noiseSrc(),g=ctx.createGain(),f=ctx.createBiquadFilter();
    f.type="lowpass";f.Q.value=o.q||.8;
    f.frequency.setValueAtTime(o.h0,t0);
    if(o.h1)f.frequency.exponentialRampToValueAtTime(Math.max(o.h1,20),t0+o.dur);
    g.gain.setValueAtTime(0.0001,t0);
    g.gain.exponentialRampToValueAtTime(o.peak,t0+(o.a||.008));
    g.gain.exponentialRampToValueAtTime(0.0001,t0+o.dur);
    s.connect(f);f.connect(g);g.connect(o.out||master);
    s.start(t0);s.stop(t0+o.dur+.05);
  }
  /* ---------------------------------------------------------- the logo sting ---
     Scored to the film rather than laid over it. The film's beats are: dark for a
     beat, neon traces drawing to about 2s, the ring closing at 2s, the wordmark at
     3s, the full lockup at 4s, then a three-second hold.

     So: a valve-warming sub thump, a filtered-noise riser under a rising saw while
     the traces draw, a bright zap on the ring, a stab on the wordmark, and a
     six-voice detuned major chord on the lockup with a shimmer above it and a
     cymbal-ish wash under it, decaying through the hold. Synthesised, not a file -
     everything here is already in the engine, and it is a few hundred bytes rather
     than a few hundred kilobytes.

     Everything routes through `sting`, so skipping the film can shut it. Peaks are
     deliberately small: six chord voices at .055 sum to about .5 before the master
     ceiling of .25 takes them to .125, which is loud without clipping. */
  function stingStop(){
    if(!sting)return;
    const s=sting;sting=null;
    try{s.gain.setTargetAtTime(.0001,ctx.currentTime,.05)}catch(e){}
    setTimeout(()=>{try{s.disconnect()}catch(e){}},900);
  }
  function logoSting(){
    if(!ready())return;
    stingStop();
    sting=ctx.createGain();sting.gain.value=1;sting.connect(master);
    const out=sting;
    /* 0.0s — the tube warms up */
    tone({w:"sine",f0:120,f1:38,dur:1.2,at:0,a:.03,peak:.10,out});
    /* 0.15s — the traces draw: noise sweeping up, with a saw climbing under it */
    burst({h0:280,h1:5400,dur:1.9,at:.15,a:1.2,peak:.05,q:.9,out});
    tone({w:"sawtooth",f0:70,f1:520,dur:1.9,at:.15,a:1.1,peak:.03,out});
    /* 2.0s — the ring closes */
    burst({h0:6200,h1:700,dur:.36,at:1.98,a:.004,peak:.10,q:6,out});
    tone({w:"square",f0:1480,f1:520,dur:.3,at:1.98,a:.004,peak:.045,out});
    /* 3.0s — the wordmark lands: a stab, root and fifth */
    [293.66,440,587.33].forEach((f,i)=>
      tone({w:"triangle",f0:f,dur:.55,at:2.98+i*.012,a:.006,peak:.05,out}));
    /* 4.0s — the lockup: D major over three octaves, each voice doubled a whisker
       sharp so the chord beats slightly instead of sitting dead still */
    [146.83,220,293.66,369.99,440,587.33].forEach((f,i)=>{
      tone({w:"triangle",f0:f,dur:3.1,at:3.98+i*.02,a:.035,peak:.055,out});
      tone({w:"sine",f0:f*1.004,dur:3.1,at:3.98+i*.02,a:.06,peak:.028,out});
    });
    burst({h0:9000,h1:1100,dur:1.5,at:3.98,a:.012,peak:.05,q:.7,out});
    /* and the shimmer over the top of it */
    [1174.66,1479.98,1760].forEach((f,i)=>
      tone({w:"sine",f0:f,dur:2.3,at:4.06+i*.09,a:.14,peak:.02,out}));
  }
  /* ------------------------------------------ the rendered-track layer ---
     Everything above synthesises sound from oscillators. This plays a
     generated audio file instead, for the games that have one, and it is
     built to three rules:

     IT GOES THROUGH `master`. Not to ctx.destination. The master bus is what
     M-to-mute and the 0.25 ceiling act on, so a node wired around it would be
     unmutable and far too loud — the two bugs a reviewer would find first.

     IT FALLS BACK, IT NEVER FAILS. A 404, an offline visitor, a decode the
     browser refuses: the game drops to its EGG_MUSIC chiptune pattern. No game
     goes silent because a network request did. A failed track is remembered in
     `trackFail` and never retried, so a missing file costs one request.

     IT LOOPS BY CROSSFADE, NOT BY `loop = true`. Generated audio does not end
     where it began, so sample-accurate looping clicks audibly at the seam.
     Instead two copies overlap: each scheduled iteration fades in over XFADE,
     holds, and fades out over XFADE, and the next one starts XFADE early so the
     two ramps cross. The overlap IS the loop join.

     The scheduler is a timer rather than a hook into musicTick(), because not
     every game calls musicTick() every frame and a stalled pump is an audible
     gap. It keeps SCHED_AHEAD seconds queued and prunes what has finished. */
  function loadTrack(name){
    const t=EGG_TRACKS[name];
    /* No `generated` date means the prompt is committed but the audio is not,
       which is the normal state for a track under review. Do not fetch it. */
    if(!t||!t.generated||!ctx)return Promise.resolve(false);
    if(trackBufs[name])return Promise.resolve(true);
    if(trackFail[name])return Promise.resolve(false);
    if(trackLoad[name])return trackLoad[name];
    trackLoad[name]=fetch(withBase(t.file))
      .then(r=>{if(!r.ok)throw new Error("HTTP "+r.status);return r.arrayBuffer()})
      /* decodeAudioData is promise-returning in modern browsers and
         callback-only in older Safari. Support both rather than assuming. */
      .then(b=>new Promise((res,rej)=>{
        const p=ctx.decodeAudioData(b,res,rej);
        if(p&&p.then)p.then(res,rej);
      }))
      .then(buf=>{trackBufs[name]=buf;return true})
      .catch(()=>{trackFail[name]=true;return false})
      .then(ok=>{delete trackLoad[name];return ok});
    return trackLoad[name];
  }
  function fileStop(){
    if(!fileMus)return;
    const f=fileMus;fileMus=null;
    if(f.timer)clearInterval(f.timer);
    try{f.g.gain.setTargetAtTime(.0001,ctx.currentTime,.08)}catch(e){}
    const srcs=f.srcs.slice();
    setTimeout(()=>srcs.forEach(s=>{try{s.stop()}catch(e){}}),400);
    setTimeout(()=>{try{f.g.disconnect()}catch(e){}},900);
  }
  /* Queue whole iterations until SCHED_AHEAD seconds are covered. Runs while
     muted too: the master gain is already at zero, and tearing the schedule
     down and rebuilding it on every mute keystroke is more to get wrong than
     it saves. */
  function pump(){
    const f=fileMus;
    if(!f||!ctx)return;
    const buf=trackBufs[f.name];
    if(!buf)return;
    let guard=0;
    while(f.next<ctx.currentTime+SCHED_AHEAD&&guard++<8){
      const at=f.next,s=ctx.createBufferSource(),sg=ctx.createGain();
      s.buffer=buf;s.connect(sg);sg.connect(f.g);
      sg.gain.setValueAtTime(.0001,at);
      sg.gain.linearRampToValueAtTime(1,at+f.X);
      sg.gain.setValueAtTime(1,at+f.D-f.X);
      sg.gain.linearRampToValueAtTime(.0001,at+f.D);
      s.start(at);s.stop(at+f.D+.05);
      s.__end=at+f.D;
      f.srcs.push(s);
      f.next=at+f.D-f.X;          // start the next one mid-fade: that is the join
    }
    const cut=ctx.currentTime-1;
    f.srcs=f.srcs.filter(s=>(s.__end||0)>cut);
  }
  function fileStart(name){
    if(!trackBufs[name]||!ctx)return false;
    fileStop();
    const t=EGG_TRACKS[name]||{},buf=trackBufs[name];
    const g=ctx.createGain();
    g.gain.value=(t.gain==null?DEFAULT_TRACK_GAIN:t.gain);
    g.connect(master);
    const D=buf.duration;
    fileMus={name,g,srcs:[],D,X:Math.min(XFADE,D/4),next:ctx.currentTime+.06,timer:null};
    pump();
    fileMus.timer=setInterval(pump,PUMP_MS);
    return true;
  }

  /* ------------------------------------------------- the engine drone ----
     A retro jet spooling up, for SOLAR CIRCUIT. Everything else in here is a
     fire-and-forget voice with an envelope; this one runs for as long as the
     game is open and is STEERED rather than triggered, which is why it needs
     its own state rather than going through tone() or burst().

     WHY THIS IS THE SECOND VERSION

     The first was built around a sub-oscillator and a lowpassed noise bed, and
     it came out as a rumble: plenty of energy, all of it under 200Hz, and at
     speed it read as a lorry rather than as a jet. Two things were wrong with
     that. Small speakers and laptop lids simply do not reproduce the bottom two
     octaves, so on most of the machines this will be played on the engine was
     nearly inaudible. And pitch is the only cue the player has for speed here —
     put it where it cannot be heard and the whole point of the sound is gone.

     So the sub is gone and the weight is now in the WHINE, which is where a
     turbine's actually is. Three layers:

       - the whine, two detuned saws through a high-Q bandpass that tracks them.
         The resonance is what makes it sing rather than buzz, and it is most of
         the sound at speed.
       - a first harmonic a fifth above, quieter, which is what stops the whine
         reading as a plain sawtooth and makes it read as blades.
       - highpassed noise for the air. Highpassed, not lowpassed: an intake is
         hiss, and it was the lowpass that made the old one a lorry.

     The BLADE-PASS modulation is the retro part. A real turbine's amplitude
     pulses at the rate blades cross the intake, and faking that with an audio-
     rate LFO on the gain is the trick every arcade cabinet used for a jet. It
     climbs with the engine, so spooling up sweeps the chop rate as well as the
     pitch, which is the specific sound of a jet starting.

     Every parameter moves through setTargetAtTime rather than being assigned.
     That is what makes going off the trail SOUND like deceleration: the game
     just reports a lower power and the whole spectrum slides down to it over a
     fraction of a second. Assigned directly, the same drop is a click.

     It is not gated on `ready()`. The master gain already goes to zero on mute,
     so a muted engine is silent but still running, and unmuting picks it up
     where it is instead of restarting a stopped jet mid-flight. */
  let eng=null;
  function engineStart(){
    if(!ctx||eng)return;
    const g=ctx.createGain();g.gain.value=0;g.connect(master);

    /* --- the whine: a stack of pure partials, not a filtered saw ---
       A turbine's tone is a handful of strong partials over a fundamental, and
       that is what the ear identifies a jet by. The previous version made it
       out of detuned sawtooths through a resonant bandpass, which is how you
       build a synth lead: every harmonic present, the filter picking one out,
       and the result buzzes. Sines at explicit ratios cost three more
       oscillators and actually sound like the thing. */
    const parts=[[1,.30],[2,.20],[3,.10],[4.7,.05]].map(([mul,vol])=>{
      const o=ctx.createOscillator();o.type="sine";
      const og=ctx.createGain();og.gain.value=vol;
      o.connect(og);og.connect(g);o.start();
      return {o,mul};
    });

    /* --- the air ---
       Two bands of noise. The bandpassed one is the intake, which is where a
       jet's roar actually sits; the highpassed one is the hiss over the top of
       it. Together they are broadband without being a rumble — the mistake the
       first version made was lowpassing this, which put all the energy under
       200Hz where laptop speakers cannot reproduce it at all. */
    const air=noiseSrc();
    const bp=ctx.createBiquadFilter();bp.type="bandpass";bp.Q.value=.8;bp.frequency.value=900;
    const bg=ctx.createGain();bg.gain.value=.5;
    const hp=ctx.createBiquadFilter();hp.type="highpass";hp.Q.value=.7;hp.frequency.value=1800;
    const hg=ctx.createGain();hg.gain.value=.22;
    air.connect(bp);bp.connect(bg);bg.connect(g);
    air.connect(hp);hp.connect(hg);hg.connect(g);
    air.start();

    /* --- the spool chuff ---
       Amplitude modulation at the rate blades cross the intake. It is the sound
       of a jet STARTING, and it fades out as the engine comes up to speed —
       which is exactly what a real one does, and what makes a rising note read
       as spooling up rather than as a siren. Depth is set in engineSet(). */
    const blade=ctx.createOscillator(),bladeG=ctx.createGain();
    blade.type="sine";blade.frequency.value=12;bladeG.gain.value=0;
    blade.connect(bladeG);bladeG.connect(g.gain);blade.start();

    eng={g,parts,bp,hp,blade,bladeG};
    engineSet(0);
  }
  /** @param p 0 at rest, 1 at the top of the speed ladder. */
  function engineSet(p){
    if(!eng||!ctx)return;
    p=p<0?0:p>1?1:p;
    const t=ctx.currentTime,K=.13;
    /* Rises faster than linearly at the bottom, so pulling away is audible. The
       fundamental spans a little over two octaves, which is a wide enough sweep
       to hear as acceleration without the top of it becoming a whistle. */
    const r=Math.pow(p,.78);
    const f0=300+r*1250;
    for(const part of eng.parts)part.o.frequency.setTargetAtTime(f0*part.mul,t,K);
    eng.bp.frequency.setTargetAtTime(850+r*2400,t,K);
    eng.hp.frequency.setTargetAtTime(1700+r*2600,t,K);
    /* The chuff is loudest just off idle and gone by half power. */
    eng.blade.frequency.setTargetAtTime(12+r*46,t,K);
    eng.bladeG.gain.setTargetAtTime(Math.max(0,.26*(1-p*2.1)),t,K);
    eng.g.gain.setTargetAtTime(.10+r*.42,t,K);
  }
  function engineStop(){
    if(!eng)return;
    const e=eng;eng=null;
    try{for(const part of e.parts)part.o.stop();e.blade.stop()}catch(err){}
    try{e.g.disconnect()}catch(err){}
  }

  /* ------------------------------------------------- the boost pad whir ----
     Short, high and mechanical: something spun up under the craft as it went
     over. A rising pair of saws through a bandpass that sweeps with them, with
     the amplitude chopped by a fast LFO — the chop is the whir, and without it
     the same voices are just a rising bleep.

     Fire-and-forget, and it builds its own nodes each time rather than reusing
     a voice: pads can be taken in quick succession and two overlapping whirs
     should stack, not cut each other off. Everything is scheduled against
     `ctx.currentTime` and disposes itself at the end of the envelope. */
  function boostPad(){
    if(!ready())return;
    const t=ctx.currentTime,D=.34;
    const g=ctx.createGain();g.connect(master);
    g.gain.setValueAtTime(0,t);
    g.gain.linearRampToValueAtTime(.5,t+.012);
    g.gain.exponentialRampToValueAtTime(.0001,t+D);

    /* the chop */
    const lfo=ctx.createOscillator(),lg=ctx.createGain();
    lfo.type="square";lfo.frequency.setValueAtTime(34,t);
    lfo.frequency.exponentialRampToValueAtTime(96,t+D);
    lg.gain.value=.42;
    lfo.connect(lg);lg.connect(g.gain);

    const bp=ctx.createBiquadFilter();bp.type="bandpass";bp.Q.value=5;
    bp.frequency.setValueAtTime(900,t);
    bp.frequency.exponentialRampToValueAtTime(4200,t+D*.8);
    bp.connect(g);

    const a=ctx.createOscillator(),b=ctx.createOscillator(),vg=ctx.createGain();
    a.type="sawtooth";b.type="square";b.detune.value=-9;
    vg.gain.value=.5;
    a.frequency.setValueAtTime(760,t);a.frequency.exponentialRampToValueAtTime(2600,t+D*.85);
    b.frequency.setValueAtTime(1140,t);b.frequency.exponentialRampToValueAtTime(3900,t+D*.85);
    a.connect(vg);b.connect(vg);vg.connect(bp);

    a.start(t);b.start(t);lfo.start(t);
    a.stop(t+D);b.stop(t+D);lfo.stop(t+D);
    setTimeout(()=>{try{g.disconnect()}catch(e){}},(D+.1)*1000);
  }

  /* ------------------------------------------------ countdown and start ----
     Three lamps and a green. The lamps are a short hollow note that steps up a
     tone; the green is the same note an octave and a fifth higher, longer, with
     a fifth under it so it reads as a chord rather than as a fourth beep.

     That relationship is the whole design: three of a thing and then something
     that is recognisably made of the same material but bigger. It is how every
     starting sequence from a race light to a lift chime works, and it means the
     player does not have to be told which one is GO. */
  function countLight(step){
    if(!ready())return;
    const f=[392,466.16][step]||392;
    tone({w:"square",f0:f,dur:.16,a:.004,peak:.075});
    tone({w:"sine",f0:f*2,dur:.13,a:.004,peak:.03});
  }
  function raceStart(){
    if(!ready())return;
    tone({w:"square",f0:783.99,dur:.5,a:.004,peak:.09});
    tone({w:"square",f0:1174.66,dur:.45,a:.006,peak:.055});
    tone({w:"sine",f0:1567.98,dur:.4,a:.006,peak:.032});
  }

  /* ----------------------------------------------------- lighting the boost ----
     A downward sweep under an upward one. The rise is the craft accelerating and
     the drop is the thump of it happening — two gestures at once, which is what
     stops it being the same rising bleep as the pad whir it usually follows
     within a second or two. Those two have to be tellable apart: one is
     collecting and the other is spending. */
  function boostFire(){
    if(!ready())return;
    const t=ctx.currentTime,D=.55;
    const g=ctx.createGain();g.connect(master);
    g.gain.setValueAtTime(0,t);
    g.gain.linearRampToValueAtTime(.34,t+.02);
    g.gain.exponentialRampToValueAtTime(.0001,t+D);

    const up=ctx.createOscillator();up.type="sawtooth";
    up.frequency.setValueAtTime(220,t);
    up.frequency.exponentialRampToValueAtTime(1500,t+D*.7);
    const ug=ctx.createGain();ug.gain.value=.3;up.connect(ug);ug.connect(g);

    const down=ctx.createOscillator();down.type="square";
    down.frequency.setValueAtTime(520,t);
    down.frequency.exponentialRampToValueAtTime(70,t+D*.55);
    const dg=ctx.createGain();dg.gain.value=.24;down.connect(dg);dg.connect(g);

    /* the air behind it */
    const n=noiseSrc(),bp=ctx.createBiquadFilter();
    bp.type="bandpass";bp.Q.value=1.1;
    bp.frequency.setValueAtTime(700,t);
    bp.frequency.exponentialRampToValueAtTime(3600,t+D*.8);
    const ng=ctx.createGain();ng.gain.value=.5;
    n.connect(bp);bp.connect(ng);ng.connect(g);

    up.start(t);down.start(t);n.start(t);
    up.stop(t+D);down.stop(t+D);n.stop(t+D);
    setTimeout(()=>{try{g.disconnect()}catch(e){}},(D+.1)*1000);
  }

  /* ------------------------------------------------------ crossing the line ----
     The start chord again, resolved: the same material, arriving as an arpeggio
     rather than all at once and landing a fourth higher. Built from the start's
     notes deliberately — a run should sound like it closed the thing it opened,
     and sharing the interval is what makes the two read as a pair rather than as
     two unrelated jingles. */
  function raceFinish(){
    if(!ready())return;
    const notes=[783.99,1046.5,1318.51,1567.98];
    for(let i=0;i<notes.length;i++){
      setTimeout(()=>{
        if(!ready())return;
        const last=i===notes.length-1;
        tone({w:"square",f0:notes[i],dur:last?.75:.22,a:.004,peak:last?.1:.07});
        tone({w:"sine",f0:notes[i]*2,dur:.18,a:.004,peak:.028});
      },i*85);
    }
  }

  return {
    init,
    countLight,
    raceStart,
    raceFinish,
    boostFire,
    engineStart,
    engineSet,
    engineStop,
    boostPad,
    logoSting,
    logoStingStop:stingStop,
    isMuted:()=>muted,
    setMuted(v){muted=!!v;if(ctx)master.gain.setTargetAtTime(muted?0:CEIL,ctx.currentTime,.03)},
    uiHover(){if(!ctx||ctx.currentTime-lastHover<.09)return;lastHover=ctx.currentTime;
      tone({w:"sine",f0:660,f1:740,dur:.06,a:.005,peak:.035})},
    uiClick(){tone({w:"sine",f0:520,dur:.08,a:.004,peak:.06});
      tone({w:"sine",f0:1040,dur:.07,a:.004,peak:.025})},
    blip(){tone({w:"square",f0:880,dur:.07,a:.003,peak:.05})},
    thrust(){burst({h0:420,h1:240,dur:.22,a:.03,peak:.05})},
    laser(kind){
      if(kind==="multi"){tone({w:"square",f0:783.99,dur:.05,a:.002,peak:.032});
        tone({w:"square",f0:987.77,dur:.05,a:.002,peak:.032});return}
      const p={crimp:{w:"square",f0:520,f1:190,dur:.09,peak:.05},
        lance:{w:"square",f0:290,f1:92,dur:.18,peak:.062},
        blast:{w:"square",f0:1560,f1:1140,dur:.05,peak:.04},
        fiber:{w:"square",f0:2100,f1:320,dur:.11,peak:.045},
        sub:{w:"triangle",f0:160,f1:82,dur:.14,peak:.07}}[kind]||{w:"square",f0:520,f1:190,dur:.09,peak:.05};
      tone({w:p.w,f0:p.f0,f1:p.f1,dur:p.dur,a:.002,peak:p.peak})},
    explode(size){const s=Math.max(0,Math.min(1,size==null?.5:size));
      burst({h0:900,h1:90,dur:.25+.35*s,a:.006,peak:.09+.07*s,q:.6});
      tone({w:"square",f0:220,f1:82,dur:.22,a:.006,peak:.06})},
    lineClear(n){const m=Math.pow(1.05946,Math.min(8,Math.max(0,n||0)));[523.25,659.25,783.99,1046.5].forEach((f,i)=>tone({w:"sine",f0:f*m,dur:.09,at:i*.06,a:.005,peak:.055}))},
    catchGood(){tone({w:"sine",f0:620,f1:930,dur:.12,a:.004,peak:.055})},
    catchBad(){tone({w:"square",f0:220,f1:110,dur:.2,a:.005,peak:.05})},
    jump(){tone({w:"triangle",f0:310,f1:620,dur:.1,a:.003,peak:.05})},
    stomp(){tone({w:"square",f0:300,f1:130,dur:.09,a:.003,peak:.06});
      burst({h0:500,h1:150,dur:.07,a:.004,peak:.03})},
    bounce(){tone({w:"triangle",f0:392,f1:784,dur:.1,a:.003,peak:.05})},
    levelClear(){[659.25,783.99,1046.5,783.99,1046.5,1318.51].forEach((f,i)=>{
      tone({w:"square",f0:f,dur:.12,at:i*.09,a:.004,peak:.05});
      tone({w:"triangle",f0:f/2,dur:.12,at:i*.09,a:.004,peak:.035})})},
    powerup(){[659.25,880].forEach((f,i)=>tone({w:"triangle",f0:f,dur:.11,at:i*.07,a:.005,peak:.055}))},
    chomp(){wak=!wak;
      if(wak)tone({w:"square",f0:520,f1:392,dur:.055,a:.002,peak:.04});
      else tone({w:"square",f0:392,f1:300,dur:.055,a:.002,peak:.04})},
    powerPellet(){tone({w:"triangle",f0:220,f1:470,dur:.32,a:.006,peak:.06});
      tone({w:"triangle",f0:330,f1:705,dur:.32,at:.05,a:.006,peak:.035})},
    eatGhost(n){const b=440*Math.pow(1.335,Math.max(1,Math.min(4,n||1))-1);
      tone({w:"square",f0:b,f1:b*1.6,dur:.16,a:.004,peak:.055});
      tone({w:"square",f0:b*1.5,f1:b*2.2,dur:.12,at:.05,a:.004,peak:.03})},
    muncherDown(){tone({w:"square",f0:660,f1:110,dur:.62,a:.006,peak:.055});
      tone({w:"triangle",f0:330,f1:87,dur:.7,at:.08,a:.008,peak:.045});
      burst({h0:700,h1:120,dur:.4,at:.35,a:.02,peak:.03})},
    levelUp(){[392,523.25,659.25].forEach((f,i)=>tone({w:"triangle",f0:f,dur:.12,at:i*.09,a:.006,peak:.06}))},
    missionStart(){[392,523.25,659.25,783.99,659.25,1046.5].forEach((f,i)=>tone({w:"square",f0:f,dur:.09,at:i*.08,a:.004,peak:.045}))},
    bossWarn(){[0,.45].forEach(t=>{tone({w:"square",f0:740,dur:.18,at:t,a:.006,peak:.055});
      tone({w:"square",f0:554.37,dur:.18,at:t+.2,a:.006,peak:.055})})},
    weaponGet(){[523.25,659.25,880,1046.5].forEach((f,i)=>tone({w:"square",f0:f,dur:.07,at:i*.05,a:.004,peak:.05}))},
    /* full-health beam — a bright sawtooth sweep over a noise tail, so it reads
       as a released charge rather than another crimper jab */
    beamShot(){tone({w:"sawtooth",f0:1245,f1:415,dur:.26,a:.002,peak:.05});
      tone({w:"square",f0:2490,f1:830,dur:.13,a:.002,peak:.026});
      burst({h0:2800,h1:520,dur:.22,a:.004,peak:.032,q:1.4})},
    /* torch catching in dry branches, and the tree coming down after it */
    flameUp(){burst({h0:1500,h1:340,dur:.42,a:.05,peak:.05,q:.5});
      tone({w:"triangle",f0:180,f1:330,dur:.36,a:.05,peak:.03})},
    /* the vendor takes your bits */
    coin(){[1046.5,1567.98].forEach((f,i)=>tone({w:"square",f0:f,dur:.09,at:i*.06,a:.003,peak:.045}))},
    gameOver(){[329.63,261.63,220,174.61].forEach((f,i)=>tone({w:"square",f0:f,dur:.16,at:i*.17,a:.006,peak:.055}));
      burst({h0:500,h1:120,dur:.3,a:.01,peak:.035})},
    victory(){[523.25,587.33,659.25,783.99,880,1046.5].forEach((f,i)=>{
      tone({w:"square",f0:f,dur:.12,at:i*.09,a:.004,peak:.05});
      tone({w:"triangle",f0:f/2,dur:.12,at:i*.09,a:.004,peak:.04})})},
    /* --- music: a generated track where one exists, else the chiptune ---
       Both paths share this one entry point deliberately. Twenty-odd call
       sites already say EggAudio.music("dungeon"), and not one of them should
       have to know which kind of music it is going to get. A game with a
       generated track gets it; a game without one keeps the Pass C sequencer;
       a game whose track fails to load falls back to the sequencer mid-flight. */
    music(name){
      want=name;
      const t=EGG_TRACKS[name];
      if(trackBufs[name]){                        // decoded and ready
        if(!fileMus||fileMus.name!==name){mus=null;fileStart(name)}
        return;
      }
      if(EGG_MUSIC[name]){
        /* Cover the fetch with the chiptune so the room is never silent while
           a track downloads. On a warm cache this is imperceptible. */
        if(!mus||mus.name!==name){fileStop();mus={name,step:0,next:ctx?ctx.currentTime+.06:.06}}
      }else{
        fileStop();mus=null;
        if(!t||!t.generated)return;               // nothing to play at all
      }
      /* Upgrade to the file when it lands — but only if this track is still the
         one wanted. A player who leaves a room mid-fetch must not be handed the
         previous room's music when it arrives. */
      if(t&&t.generated)loadTrack(name).then(ok=>{
        if(ok&&want===name&&(!fileMus||fileMus.name!==name)){mus=null;fileStart(name)}
      });
    },
    /* Warm the cache from a user gesture — opening Mission Control is the
       natural moment, since the AudioContext needs that gesture anyway. */
    musicPreload(names){
      if(!ctx)return;
      (Array.isArray(names)?names:[names]).forEach(n=>loadTrack(n));
    },
    musicStop(){want=null;mus=null;fileStop()},
    /* Reports what was asked for rather than which of the two players is live.
       Only the debug state dump reads this, and the request is the useful fact. */
    musicName(){return want},
    musicTick(){
      if(fileMus)return;            // a rendered track schedules itself
      if(!mus||!ctx||muted)return;
      const p=EGG_MUSIC[mus.name],sd=60/p.bpm/2;
      if(mus.next<ctx.currentTime-.5)mus.next=ctx.currentTime+.02;   /* resync */
      let guard=0;
      while(mus.next<ctx.currentTime+.14&&guard++<12){
        const s=mus.step,at=Math.max(0,mus.next-ctx.currentTime),mf=m=>440*Math.pow(2,(m-69)/12);
        if(p.sq1[s])tone({w:p.w1||"square",f0:mf(p.sq1[s]),dur:sd*.9,at,a:p.att||.004,peak:.05*(p.vol||1)});
        if(p.sq2[s])tone({w:p.w2||"square",f0:mf(p.sq2[s]),dur:sd*.85,at,a:p.att||.004,peak:.035*(p.vol||1)});
        if(p.tri[s])tone({w:p.w3||"triangle",f0:mf(p.tri[s]),dur:sd*.95,at,a:p.att?p.att+.002:.006,peak:.07*(p.vol||1)});
        mus.step=(s+1)%p.len;mus.next+=sd;
      }
    },
    itemGet(){[783.99,987.77,1174.66,1567.98].forEach((f,i)=>tone({w:"square",f0:f,dur:.09,at:i*.07,a:.004,peak:.05}))},
    ambientStart(){
      if(!ctx)return;
      if(humStop){clearTimeout(humStop);humStop=null}
      if(hum){hum.g.gain.setTargetAtTime(.016,ctx.currentTime,.4);return}
      const g=ctx.createGain();
      g.gain.setValueAtTime(.0001,ctx.currentTime);
      g.gain.setTargetAtTime(.016,ctx.currentTime,.6);           // slow fade-in
      const o1=ctx.createOscillator();o1.type="sine";o1.frequency.value=55;
      const o2=ctx.createOscillator();o2.type="sine";o2.frequency.value=55.7;
      const lfo=ctx.createOscillator();lfo.type="sine";lfo.frequency.value=.08;
      const lg=ctx.createGain();lg.gain.value=.006;
      lfo.connect(lg);lg.connect(g.gain);
      o1.connect(g);o2.connect(g);g.connect(master);
      o1.start();o2.start();lfo.start();
      hum={o1,o2,lfo,g};
    },
    ambientStop(){
      if(!ctx||!hum)return;
      const h=hum;hum=null;
      h.g.gain.setTargetAtTime(.0001,ctx.currentTime,.3);        // fade-out, no click
      humStop=setTimeout(()=>{try{h.o1.stop();h.o2.stop();h.lfo.stop()}catch(_){}},1200);
    }
  };
})();

/* shared controls key: renderKey([["← →","move"],["Esc","close"],...]) */
function renderKey(items){
  return '<div class="egg-key">'+items.map(i=>'<span class="egg-k"><kbd>'+i[0]+'</kbd>'+i[1]+'</span>').join("")+'</div>';
}

/* shared canvas prep: logical CSS-pixel size + devicePixelRatio backing store (crisp on HiDPI) */
const EGG_RM=!!(window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches);
function eggCanvas(id,w,h){
  const c=document.getElementById(id),d=Math.min(2,window.devicePixelRatio||1);
  c.width=Math.round(w*d);c.height=Math.round(h*d);
  c.style.width=w+"px";
  const x=c.getContext("2d");
  if(x.setTransform)x.setTransform(d,0,0,d,0,0);
  if(!x.roundRect)x.roundRect=function(a,b,ww,hh,r){this.rect(a,b,ww,hh)};
  return x;
}
/* shared pause veil (each game toggles with P) */
function eggPauseOverlay(x,w,h){
  x.fillStyle="rgba(7,5,15,.62)";x.fillRect(0,0,w,h);
  x.fillStyle="#e2d9ff";x.font="700 20px Poppins,sans-serif";x.textAlign="center";
  x.fillText("PAUSED",w/2,h/2-8);
  x.fillStyle="#8f85b8";x.font="12px Poppins,sans-serif";
  x.fillText("P to resume",w/2,h/2+16);
}

/* mute button sync (speaker icons) */
const EGG_SND_ON='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H2v6h4l5 4z" fill="currentColor" stroke="none"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/></svg>';
const EGG_SND_OFF='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H2v6h4l5 4z" fill="currentColor" stroke="none"/><line x1="16" y1="9" x2="22" y2="15"/><line x1="22" y1="9" x2="16" y2="15"/></svg>';
function eggSyncMute(){
  const off=EggAudio.isMuted();
  document.querySelectorAll(".egg-snd").forEach(b=>{
    b.innerHTML=off?EGG_SND_OFF:EGG_SND_ON;
    b.title=off?"Sound off — M to unmute":"Sound on — M to mute";
  });
}
function eggToggleMute(){
  EggAudio.init();
  EggAudio.setMuted(!EggAudio.isMuted());
  eggSyncMute();
  if(!EggAudio.isMuted())EggAudio.uiClick();
}

/* shared game-over overlay: R = replay, C = continue (only when the game
   passes onContinue), Esc = mission control (global handler) */
let eggEndKeyFn=null;
function eggEndScreen(o){
  eggEndDismiss();
  const ov=document.createElement("div");ov.className="egg-end";
  ov.innerHTML='<div class="egg-end-card"><div class="egg-end-t">'+o.title+'</div>'+
    (o.lines||[]).map(l=>'<div class="egg-end-l">'+l+'</div>').join("")+
    '<div class="egg-end-b">'+
    (o.onContinue?'<button class="btn accent" data-act="continue">▸ CONTINUE<kbd>C</kbd></button>':'')+
    '<button class="btn '+(o.onContinue?"ghost":"accent")+'" data-act="replay">↺ REPLAY<kbd>R</kbd></button>'+
    '<button class="btn ghost" data-act="menu">✦ MISSION CONTROL<kbd>Esc</kbd></button></div></div>';
  o.host.appendChild(ov);
  const done=fn=>()=>{eggEndDismiss();if(fn)fn()};
  if(o.onContinue)ov.querySelector('[data-act="continue"]').onclick=done(o.onContinue);
  ov.querySelector('[data-act="replay"]').onclick=done(o.onReplay);
  ov.querySelector('[data-act="menu"]').onclick=done(o.onMenu);
  eggEndKeyFn=e=>{
    if(e.key==="r"||e.key==="R"){e.preventDefault();done(o.onReplay)()}
    else if(o.onContinue&&(e.key==="c"||e.key==="C")){e.preventDefault();done(o.onContinue)()}
  };
  addEventListener("keydown",eggEndKeyFn);
}
function eggEndDismiss(){
  document.querySelectorAll(".egg-end").forEach(n=>n.remove());
  if(eggEndKeyFn){removeEventListener("keydown",eggEndKeyFn);eggEndKeyFn=null}
}

/* menu plumbing */
/* Closing Mission Control is a two-beat move rather than a cut: the system
   fades out to black, then the black lifts off the page underneath. Both beats
   need the overlay still in the DOM, so display:none waits on a timer instead
   of going with the click. eggMenu() cancels a pending one, so reopening
   mid-fade picks straight back up.

   eggLaunch() deliberately does not use this — dropping into a game is a cut,
   and a fade there would just be a stall between two full-screen things. */
let eggMenuFade=null;
function eggMenuClose(){
  const el=document.getElementById("eggmenu");
  EggAudio.ambientStop();
  EggAudio.musicStop();
  /* Closing mid-film: stop it, hide it, silence the sting and clear the fallback
     timer, or it fires into a closed overlay and starts the system behind it.
     Arming the film again here is what makes it replay on the next visit without a
     reload; coming back from a game does not pass through this function. */
  eggIntroRunning=false;
  eggIntroSeen=false;
  EggAudio.logoStingStop();
  if(eggIntroTimer){clearTimeout(eggIntroTimer);eggIntroTimer=null}
  if(eggIntroFade){clearTimeout(eggIntroFade);eggIntroFade=null}
  const iv=document.getElementById("egg-intro-v");
  if(iv){try{iv.pause()}catch(e){}}
  const ib=document.getElementById("egg-intro");
  if(ib){ib.hidden=true;ib.classList.remove("gone")}
  ssMenuStop();
  ssMapStop();
  if(!el||el.classList.contains("closing"))return;
  el.classList.add("closing");
  eggMenuFade=setTimeout(()=>{
    eggMenuFade=null;
    el.classList.remove("closing");
    el.style.display="none";
  },EGG_RM?0:620);   /* matches the CSS: 200ms panel, then a 420ms backdrop */
}

/* easter egg 7: DONGLE PATROL - Galaga on Saturn. The fiction: dongle users
   swarm out of the rings; the Polaris fighter holds the room. Faithful set:
   bezier entry flights, breathing formation, escorted dives with aimed fire,
   boss pucks with a PAIRING BEAM that captures the fighter, mid-dive rescue
   -> DUAL FIRE, demo (challenge) stages every 4th wave with PERFECT bonus. */
let egg7Anim=null,egg7Keys=null,egg7Best=0;
function eggOpen7(){
  document.getElementById("egg7").style.display="flex";
  EggAudio.init();EggAudio.ambientStart();eggSyncMute();
  document.getElementById("egg7-key").innerHTML=renderKey([["← →","move"],["Z / Space","fire"],["P","pause"],["M","mute"],["Esc","mission control"]]);
  eggDonglePatrol();
}
function eggClose7(){
  document.getElementById("egg7").style.display="none";
  if(egg7Anim){cancelAnimationFrame(egg7Anim);egg7Anim=null}
  if(egg7Keys){removeEventListener("keydown",egg7Keys);removeEventListener("keyup",egg7Keys);egg7Keys=null}
  eggEndDismiss();EggAudio.ambientStop();
}
function eggDonglePatrol(){
  const W=880,H=520,c=document.getElementById("egg7c"),x=eggCanvas("egg7c",W,H);
  const SC=3;
  function mkS(rows,pal){
    const cv=document.createElement("canvas");cv.width=rows[0].length*SC;cv.height=rows.length*SC;
    const g=cv.getContext("2d");
    for(let j=0;j<rows.length;j++)for(let i=0;i<rows[j].length;i++){
      const ch=rows[j][i];if(ch===".")continue;
      g.fillStyle=pal[ch]||"#fff";g.fillRect(i*SC,j*SC,SC,SC);
    }
    return cv;
  }
  const PF={m:"#b8aede",h:"#e2d9ff",c:"#7ce3a8",d:"#4a3585",e:"#8f7ae0"};
  const FTR=mkS(["......m......","......h......",".....mhm.....",".....mhm.....","..d.mmhmm.d..","..dmmehemmd..",".dmmmehemmmd.",".dmeeehueeemd".replace("u","h"),".ddmmmmmmmdd.","..d..ccc..d.."],PF);
  const FTRC=mkS(["......e......","......e......",".....eee.....",".....eee.....","..d.eeeee.d..","..deeeeeeed..",".deeeeeeeeed.",".deeeeeeeeed.",".ddeeeeeeedd.","..d..eee..d.."],PF);
  const PD={s:"#8a8296",g:"#e8c76a",k:"#35304d",b:"#7fc6dd"};
  const DR1=mkS(["..ssssss..",".skkkkkks.","sskgggkss.".replace(".",""),"ssgggggss.".replace(".",""),".skkkkkks.","..ssssss..","...g..g...","...g..g..."],PD);
  const DR2=mkS(["..ssssss..",".skkkkkks.","sskgggkss.".replace(".",""),"ssgkgkgss.".replace(".",""),".skkkkkks.","..ssssss..","..g....g..","..g....g.."],PD);
  const PW={r:"#e8a184",k:"#241c45",w:"#e2d9ff",b:"#7fc6dd"};
  const WG1=mkS(["...rrrr...","..rkkkkr..",".rkwwwwkr.",".rkwbbwkr.",".rkwbbwkr.",".rkwwwwkr.","..rkkkkr..","...rrrr..."],PW);
  const WG2=mkS(["...rrrr...","..rkkkkr..",".rkwwwwkr.",".rkbwwbkr.",".rkbwwbkr.",".rkwwwwkr.","..rkkkkr..","...rrrr..."],PW);
  const PB={p:"#a58cff",d:"#4a3585",k:"#1c1636",g:"#7ce3a8",a:"#e8c76a"};
  const BO1=mkS(["....pppppp....","..pp......pp..",".p..dddddd..p.",".p.dkkkkkkd.p.","p..dkggggkd..p","p.adkgkkgkda.p","p..dkggggkd..p",".p.dkkkkkkd.p.",".p..dddddd..p.","..pp......pp..","....pppppp....","......aa......"],PB);
  const BO2=mkS(["....pppppp....","..pp......pp..",".p..dddddd..p.",".p.dkkkkkkd.p.","p..dkggggkd..p","p..dkgkkgkd..p","p.adkggggkda.p",".p.dkkkkkkd.p.",".p..dddddd..p.","..pp......pp..","....pppppp....","......aa......"],PB);
  const PBH={p:"#e8a184",d:"#c0402a",k:"#1c1636",g:"#e8c76a",a:"#e8c76a"};
  const BO1H=mkS(["....pppppp....","..pp......pp..",".p..dddddd..p.",".p.dkkkkkkd.p.","p..dkggggkd..p","p.adkgkkgkda.p","p..dkggggkd..p",".p.dkkkkkkd.p.",".p..dddddd..p.","..pp......pp..","....pppppp....","......aa......"],PBH);
  const BO2H=mkS(["....pppppp....","..pp......pp..",".p..dddddd..p.",".p.dkkkkkkd.p.","p..dkggggkd..p","p..dkgkkgkd..p","p.adkggggkda.p",".p.dkkkkkkd.p.",".p..dddddd..p.","..pp......pp..","....pppppp....","......aa......"],PBH);
  const ART={drone:[DR1,DR2],wing:[WG1,WG2],boss:[BO1,BO2],bossH:[BO1H,BO2H]};
  const VAL={drone:[100,200],wing:[150,300],boss:[400,800]};
  /* ---- state ---- */
  let px=W/2,score=0,lives=3,wave=1,dual=false,alive=true,paused=false;
  let ens=[],bolts=[],ebolts=[],parts=[],floats=[],stars=[];
  let dying=0,invuln=2,fireLock=false,extraGiven=false;
  let diveCd=3,entryDone=false,challenge=false,chFlights=[],chScore=0,chKilled=0,chTotal=0;
  let capBoss=null,freed=null,banner=null,shake=0,elapsed=0,last=null,waveEndT=0;
  const keys={};
  for(let i=0;i<90;i++)stars.push({x:Math.random()*W,y:Math.random()*H,v:14+Math.random()*40,b:Math.random()});
  function hud(){
    document.getElementById("egg7s").textContent=score;
    document.getElementById("egg7w").textContent=wave;
    document.getElementById("egg7l").textContent=Math.max(0,lives);
    document.getElementById("egg7d").textContent=dual?"DUAL FIRE · ":"";
    document.getElementById("egg7b").textContent=Math.max(egg7Best,score);
  }
  function pop(tx,ty,txt,col){floats.push({x:tx,y:ty,txt,col,a:1.4})}
  function boomAt(bx,by,col,n){if(EGG_RM)return;for(let i=0;i<n;i++)parts.push({x:bx,y:by,vx:(Math.random()-.5)*260,vy:(Math.random()-.5)*260,a:1,col})}
  function shakeIt(n){if(!EGG_RM)shake=Math.max(shake,n)}
  /* ---- formation geometry ---- */
  const ROWS=[{t:"boss",n:4,y:86},{t:"wing",n:8,y:130},{t:"drone",n:10,y:172},{t:"drone",n:10,y:214}];
  function slotPos(r,ci,t){
    const row=ROWS[r],br=1+0.055*Math.sin(t*.9);
    const spread=44*br,cx=W/2+Math.sin(t*.45)*26;
    return[cx+(ci-(row.n-1)/2)*spread,row.y];
  }
  function bez(p,t){
    const u=1-t;
    return[u*u*u*p[0][0]+3*u*u*t*p[1][0]+3*u*t*t*p[2][0]+t*t*t*p[3][0],
           u*u*u*p[0][1]+3*u*u*t*p[1][1]+3*u*t*t*p[2][1]+t*t*t*p[3][1]];
  }
  function entryPath(side,ex,ey){
    const sx=side<0?-40:W+40,sy=60+Math.random()*70;
    const m1=[side<0?W*.30:W*.70,H*.62],m2=[side<0?W*.72:W*.28,H*.30];
    return[[sx,sy],m1,m2,[ex,ey]];
  }
  function divePath(e){
    const s0=[e.x,e.y],aim=[Math.max(40,Math.min(W-40,px+(Math.random()-.5)*140)),H+50];
    return[s0,[e.x+(Math.random()<.5?-1:1)*160,e.y+90],[aim[0]+(Math.random()-.5)*120,H*.62],aim];
  }
  function beamPath(e){
    const s0=[e.x,e.y],tx=Math.max(70,Math.min(W-70,px+(Math.random()-.5)*60));
    return[s0,[e.x+(e.x<W/2?-1:1)*120,e.y+70],[tx,H*.42],[tx,H-215]];
  }
  /* ---- wave construction ---- */
  function buildWave(){
    ens=[];entryDone=false;diveCd=3;waveEndT=0;
    challenge=(wave%4===0);
    if(challenge){
      chFlights=[];chScore=0;chKilled=0;chTotal=24;
      for(let f=0;f<3;f++){
        for(let i=0;i<8;i++){
          const side=f%2===0?-1:1,tp=f===2?"wing":"drone";
          const ex=side<0?W+60:-60;
          const p=[[side<0?-40:W+40,80+f*40],[W*.5+(side<0?-1:1)*140,H*.68-f*40],[W*.5-(side<0?-1:1)*180,H*.24],[ex,60+f*50]];
          ens.push({type:tp,st:"fly",path:p,t:-(f*2.2+i*.22),spd:.34,x:p[0][0],y:p[0][1],hp:1,fl:0,flight:f,fireCd:1e9});
        }
      }
      banner={txt:"DEMO STAGE",sub:"they will not fire — bonus only · clear a flight +1000 · all +5000",t:0,col:"#7fc6dd"};
      EggAudio.levelUp();
      return;
    }
    let fl=0,idx=0;
    ROWS.forEach((row,r)=>{
      for(let ci=0;ci<row.n;ci++){
        const side=(idx%2===0)?-1:1,sp=slotPos(r,ci,0);
        ens.push({type:row.t,st:"entry",slot:[r,ci],path:entryPath(side,sp[0],sp[1]),
          t:-(Math.floor(idx/8)*1.5+(idx%8)*.19),spd:.5,x:0,y:-40,hp:row.t==="boss"?2:1,fl:0,fireCd:2+Math.random()*3,captive:false});
        idx++;
      }
    });
    banner={txt:"WAVE "+wave,sub:wave===1?"the dongle users are in the rings":null,t:0,col:"#e8c76a"};
  }
  /* ---- capture / rescue ---- */
  function captureFighter(b){
    if(!alive||dying>0||invuln>0)return;
    b.captive=true;capBoss=b;
    EggAudio.catchBad();EggAudio.bossWarn();
    banner={txt:"FIGHTER CAPTURED",sub:"shoot that boss down mid-dive to get it back",t:0,col:"#e8a184"};
    boomAt(px,H-58,"#a58cff",14);shakeIt(6);
    dual=false;lives--;hud();
    if(lives<0){gameOver7();return}
    dying=1.1;invuln=2.6;
  }
  function rescue(b){
    freed={x:b.x,y:b.y,t:0};
    b.captive=false;capBoss=null;
    EggAudio.powerup();
    banner={txt:"FIGHTER RESCUED",sub:"docking — DUAL FIRE",t:0,col:"#7ce3a8"};
  }
  function killEn(e,divingBonus){
    e.dead=true;
    const v=VAL[e.type][divingBonus?1:0];
    score+=v;pop(e.x,e.y-12,"+"+v,"#7ce3a8");
    boomAt(e.x,e.y,e.type==="boss"?"#a58cff":"#e8a184",e.type==="boss"?22:10);
    EggAudio.explode(e.type==="boss"?.8:.35);
    if(e.type==="boss")shakeIt(5);
    if(e.captive){
      if(e.st!=="form")rescue(e);
      else{pop(e.x,e.y-26,"FIGHTER LOST","#e8a184");capBoss=null}
    }
    if(challenge){
      chKilled++;
      const rem=ens.filter(o=>!o.dead&&o.flight===e.flight).length;
      if(rem===0){score+=1000;chScore+=1000;pop(W/2,H*.4,"FLIGHT CLEAR +1000","#7fc6dd")}
      if(chKilled===chTotal){score+=5000;pop(W/2,H*.5,"PERFECT +5000","#e8c76a");EggAudio.powerup()}
    }
    if(!extraGiven&&score>=20000){extraGiven=true;lives++;pop(px,H-80,"EXTRA FIGHTER","#7ce3a8");EggAudio.powerup()}
    hud();
  }
  function gameOver7(){
    alive=false;egg7Anim=null;
    egg7Best=Math.max(egg7Best,score);hud();
    EggAudio.musicStop();EggAudio.gameOver();
    eggEndScreen({host:c.parentElement,title:"THE DONGLES HOLD THE ROOM.",
      lines:["Score "+score+" · wave "+wave,"Session best "+egg7Best],
      onReplay:()=>eggDonglePatrol(),
      onMenu:()=>{eggClose7();eggMenu()}});
  }
  /* ---- input ---- */
  if(egg7Keys){removeEventListener("keydown",egg7Keys);removeEventListener("keyup",egg7Keys)}
  egg7Keys=e=>{
    if(document.getElementById("egg7").style.display!=="flex")return;
    if(e.type==="keydown"){
      if(e.key==="p"||e.key==="P"){paused=!paused;return}
      keys[e.key]=true;
      if(["ArrowLeft","ArrowRight"," "].indexOf(e.key)>=0)e.preventDefault();
    }else{keys[e.key]=false;if(e.key==="z"||e.key==="Z"||e.key===" ")fireLock=false}
  };
  addEventListener("keydown",egg7Keys);addEventListener("keyup",egg7Keys);
  function fire(){
    const cap=dual?4:2;
    if(bolts.length>=cap)return;
    EggAudio.laser("blast");
    if(dual){bolts.push({x:px-13,y:H-70},{x:px+13,y:H-70})}
    else bolts.push({x:px,y:H-70});
  }
  /* ---- update ---- */
  function update(dt){
    elapsed+=dt;
    if(banner){banner.t+=dt;if(banner.t>2.6)banner=null}
    stars.forEach(st=>{st.y+=st.v*dt;if(st.y>H){st.y=-2;st.x=Math.random()*W}});
    parts.forEach(p2=>{p2.x+=p2.vx*dt;p2.y+=p2.vy*dt;p2.a-=dt*1.6});parts=parts.filter(p2=>p2.a>0);
    floats.forEach(f=>{f.y-=16*dt;f.a-=dt*.8});floats=floats.filter(f=>f.a>0);
    shake=Math.max(0,shake-dt*30);
    EggAudio.musicTick();
    if(!alive)return;
    invuln=Math.max(0,invuln-dt);
    if(dying>0){dying-=dt;if(dying<=0){px=W/2}return}
    /* player */
    const mv=(keys.ArrowRight?1:0)-(keys.ArrowLeft?1:0);
    px+=mv*260*dt;px=Math.max(26,Math.min(W-26,px));
    if((keys.z||keys.Z||keys[" "])&&!fireLock){fire();fireLock=true}
    /* freed fighter docks */
    if(freed){
      freed.t+=dt;
      const tx2=px-13,ty2=H-52;
      freed.x+=(tx2-freed.x)*Math.min(1,dt*2.2);freed.y+=(ty2-freed.y)*Math.min(1,dt*2.2);
      if(Math.hypot(freed.x-tx2,freed.y-ty2)<6){dual=true;freed=null;hud()}
    }
    /* enemies */
    let anyEntry=false,liveN=0;
    ens.forEach(e=>{
      if(e.dead)return;liveN++;
      e.fl=Math.max(0,e.fl-dt);
      if(e.st==="entry"||e.st==="fly"){
        anyEntry=true;
        e.t+=dt*e.spd;
        if(e.t<0)return;
        const q=bez(e.path,Math.min(1,e.t));
        e.x=q[0];e.y=q[1];
        if(e.t>=1){
          if(e.st==="fly")e.dead=true;      /* challenge flight exits */
          else e.st="form";
        }
      }else if(e.st==="form"){
        const q=slotPos(e.slot[0],e.slot[1],elapsed);
        e.x=q[0];e.y=q[1];
      }else if(e.st==="dive"||e.st==="beamrun"){
        e.t+=dt*(e.st==="dive"?.55:.5);
        const q=bez(e.path,Math.min(1,e.t));
        e.x=q[0];e.y=q[1];
        if(e.st==="dive"){
          if((e.t>.45&&!e.shot1)||(e.t>.7&&!e.shot2)){
            if(e.t>.7)e.shot2=true;else e.shot1=true;
            const dd=Math.hypot(px-e.x,(H-58)-e.y)||1,spd=165+wave*6;
            ebolts.push({x:e.x,y:e.y,vx:(px-e.x)/dd*spd,vy:((H-58)-e.y)/dd*spd});
            EggAudio.laser("crimp");
          }
          if(e.t>=1){e.st="return";e.x=e.slot?slotPos(e.slot[0],e.slot[1],elapsed)[0]:W/2;e.y=-30}
        }else if(e.t>=1){e.st="beam";e.bt=0;EggAudio.bossWarn()}
      }else if(e.st==="beam"){
        e.bt+=dt;
        if(e.bt>.5&&e.bt<2.1&&alive&&dying<=0&&invuln<=0&&!e.captive&&Math.abs(px-e.x)<44)captureFighter(e);
        if(e.bt>=2.6){e.st="return";e.y=-30;e.x=slotPos(e.slot[0],e.slot[1],elapsed)[0]}
      }else if(e.st==="return"){
        const q=slotPos(e.slot[0],e.slot[1],elapsed);
        e.y+=110*dt;e.x+=(q[0]-e.x)*Math.min(1,dt*3);
        if(e.y>=q[1]){e.st="form"}
      }
      /* body collision with player */
      if(alive&&dying<=0&&invuln<=0&&e.st!=="form"&&Math.abs(e.x-px)<20&&Math.abs(e.y-(H-58))<18){
        e.dead=true;boomAt(e.x,e.y,"#e8a184",12);
        playerHit();
      }
    });
    if(!challenge&&!anyEntry)entryDone=true;
    /* dives */
    if(!challenge&&entryDone&&alive&&dying<=0){
      diveCd-=dt;
      if(diveCd<=0){
        diveCd=Math.max(1.1,2.6-wave*.12);
        const formed=ens.filter(e=>!e.dead&&e.st==="form");
        if(formed.length){
          const bosses=formed.filter(e=>e.type==="boss");
          const pickBeam=bosses.length&&!capBoss&&!dual&&Math.random()<.3;
          if(pickBeam){
            const b=bosses[Math.floor(Math.random()*bosses.length)];
            b.st="beamrun";b.t=0;b.path=beamPath(b);
          }else{
            const n=Math.min(formed.length,1+Math.floor(Math.random()*3));
            for(let i=0;i<n;i++){
              const e=formed[Math.floor(Math.random()*formed.length)];
              if(e.st!=="form")continue;
              e.st="dive";e.t=0;e.shot1=e.shot2=false;e.path=divePath(e);
            }
          }
        }
      }
    }
    /* wave end */
    if(liveN===0){
      waveEndT+=dt;
      if(waveEndT>1.1){
        wave++;hud();
        if(!challenge)EggAudio.levelUp();
        buildWave();
      }
    }
    /* player bolts */
    bolts.forEach(b=>{b.y-=430*dt});
    bolts=bolts.filter(b=>{
      if(b.y<-10)return false;
      for(const e of ens){
        if(e.dead||e.t<0)continue;
        const hw=e.type==="boss"?20:14,hh=e.type==="boss"?17:12;
        if(Math.abs(b.x-e.x)<hw&&Math.abs(b.y-e.y)<hh){
          e.hp--;e.fl=.12;
          if(e.hp<=0)killEn(e,e.st!=="form");
          else{EggAudio.blip();boomAt(b.x,b.y,"#e8c76a",3)}
          return false;
        }
      }
      return true;
    });
    /* enemy bolts */
    ebolts.forEach(b=>{b.x+=b.vx*dt;b.y+=b.vy*dt});
    ebolts=ebolts.filter(b=>{
      if(b.y>H+10||b.x<-10||b.x>W+10)return false;
      if(alive&&dying<=0&&invuln<=0&&Math.abs(b.x-px)<12&&Math.abs(b.y-(H-56))<12){
        playerHit();return false;
      }
      return true;
    });
  }
  function playerHit(){
    if(dual){dual=false;invuln=1.6;hud();boomAt(px+13,H-56,"#a58cff",10);EggAudio.catchBad();pop(px,H-84,"WINGMAN DOWN","#e8a184");return}
    lives--;hud();
    boomAt(px,H-56,"#e8a184",18);shakeIt(7);EggAudio.explode(.7);
    if(lives<0){gameOver7();return}
    dying=1.1;invuln=2.6;
  }
  /* ---- draw ---- */
  function draw(){
    x.save();
    if(shake>0)x.translate((Math.random()-.5)*shake,(Math.random()-.5)*shake);
    const g=x.createLinearGradient(0,0,0,H);
    g.addColorStop(0,"#070511");g.addColorStop(.6,"#0b0723");g.addColorStop(1,"#0a0619");
    x.fillStyle=g;x.fillRect(-8,-8,W+16,H+16);
    stars.forEach(st=>{x.globalAlpha=.25+st.b*.5;x.fillStyle="#e2d9ff";x.fillRect(st.x,st.y,st.b>.7?2:1,st.b>.7?2:1)});
    x.globalAlpha=1;
    /* faint ring band: Saturn flavor */
    x.globalAlpha=.05;x.fillStyle="#e8c76a";
    x.save();x.translate(W/2,40);x.rotate(-.06);x.fillRect(-W,0,W*2,10);x.fillRect(-W,16,W*2,4);x.restore();
    x.globalAlpha=1;
    /* enemies */
    ens.forEach(e=>{
      if(e.dead||e.t<0)return;
      const fr=(elapsed*4|0)%2;
      let img;
      if(e.type==="boss")img=(e.hp<=1?ART.bossH:ART.boss)[fr];
      else img=ART[e.type][fr];
      if(e.fl>0){x.globalAlpha=.55}
      x.drawImage(img,Math.round(e.x-img.width/2),Math.round(e.y-img.height/2));
      x.globalAlpha=1;
      if(e.captive){
        x.drawImage(FTRC,Math.round(e.x-FTRC.width/2),Math.round(e.y-img.height/2-FTRC.height-2));
      }
      if(e.st==="beam"){
        const bw=18+Math.min(1,e.bt/.5)*46,ba=e.bt<2.1?.34+.1*Math.sin(elapsed*14):.1;
        x.globalAlpha=ba;x.fillStyle="#7fc6dd";
        x.beginPath();
        x.moveTo(e.x-9,e.y+16);x.lineTo(e.x+9,e.y+16);
        x.lineTo(e.x+bw,H-40);x.lineTo(e.x-bw,H-40);
        x.closePath();x.fill();
        x.globalAlpha=1;
        if((elapsed*3|0)%2===0){x.fillStyle="#7fc6dd";x.font="700 11px Poppins,sans-serif";x.textAlign="center";x.fillText("PAIRING BEAM",e.x,e.y-22)}
      }
    });
    /* freed fighter */
    if(freed)x.drawImage(FTR,Math.round(freed.x-FTR.width/2),Math.round(freed.y-FTR.height/2));
    /* player */
    if(alive&&dying<=0&&(invuln<=0||(elapsed*8|0)%2===0)){
      x.drawImage(FTR,Math.round(px-FTR.width/2),H-72);
      if(dual)x.drawImage(FTR,Math.round(px-13-FTR.width/2)+26,H-72);
    }
    /* bolts */
    x.fillStyle="#7ce3a8";bolts.forEach(b=>x.fillRect(b.x-1,b.y-6,3,9));
    x.fillStyle="#e8a184";ebolts.forEach(b=>x.fillRect(b.x-1.5,b.y-3,3,6));
    parts.forEach(p2=>{x.globalAlpha=Math.max(0,p2.a);x.fillStyle=p2.col;x.fillRect(p2.x,p2.y,2,2)});
    x.globalAlpha=1;
    floats.forEach(f=>{x.globalAlpha=Math.max(0,Math.min(1,f.a));x.fillStyle=f.col;x.font="700 13px Poppins,sans-serif";x.textAlign="center";x.fillText(f.txt,f.x,f.y);x.globalAlpha=1});
    if(banner){
      const a=banner.t<.3?banner.t/.3:banner.t>2.2?Math.max(0,(2.6-banner.t)/.4):1;
      x.globalAlpha=a;x.fillStyle=banner.col;x.font="800 26px Poppins,sans-serif";x.textAlign="center";
      x.fillText(banner.txt,W/2,H*.36);
      if(banner.sub){x.font="600 12px Poppins,sans-serif";x.fillStyle="#b8aede";x.fillText(banner.sub,W/2,H*.36+22)}
      x.globalAlpha=1;
    }
    x.restore();
    if(paused)eggPauseOverlay(x,W,H);
  
    crtPass(x);   /* phosphor halo - see crtPass() */
  }
  /* ---- loop ---- */
  hud();buildWave();
  function loop(ts){
    if(!last)last=ts;
    const dt=Math.min(.033,(ts-last)/1000);last=ts;
    if(!paused)update(dt);
    draw();
    if(alive)egg7Anim=requestAnimationFrame(loop);
  }
  if(egg7Anim)cancelAnimationFrame(egg7Anim);
  egg7Anim=requestAnimationFrame(loop);
}

/* easter egg 8: POLARIS-MAN — SIGNAL BREAKER.
   The Uranus campaign, and the only egg that is not hand-drawn canvas: it runs
   on Phaser, and both Phaser and its ~28 MB of locked artwork are code-split
   behind this function. Nothing about it is fetched until Uranus is activated,
   so pages that never open the egg — which is all of them — pay nothing.

   `egg9Game` is the live handle. It is the single source of truth for "is the
   game up", which is what makes open/close/reopen idempotent: eggClose9 always
   destroys through the handle and nulls it, so a second close is a no-op and a
   reopen can never end up with two Phaser instances, two audio graphs or two
   RAF loops. */
let egg9Game=null,egg9Loading=false,egg9Return=null;

function eggOpen9(){
  const modal=document.getElementById("egg9");
  if(!modal)return;
  /* Remember where focus came from so closing can put it back. Uranus itself
     is a WebGL mesh and cannot hold focus, so what we actually restore is the
     a11y button or the map canvas the player activated from. */
  egg9Return=document.activeElement instanceof HTMLElement?document.activeElement:null;
  modal.style.display="flex";
  egg9SetView(egg9View());   /* full unless this session chose otherwise */
  if(egg9Game||egg9Loading)return;
  egg9Loading=true;
  const mount=document.getElementById("egg9-mount");
  const status=document.getElementById("egg9-status");
  if(status)status.textContent="Loading Polaris-Man…";
  import("../../games/polaris-man/index").then(m=>{
    egg9Loading=false;
    /* Closed again before the chunk arrived: honour that, do not pop a game
       open behind the user's back. */
    if(modal.style.display!=="flex"){if(status)status.textContent="";return}
    if(status)status.textContent="";
    egg9Game=m.mountPolarisMan(mount,{
      /* No keyboardTarget: the game binds to the document. Scoping it to the
         modal killed every control the moment a screen transition destroyed the
         focused button and focus fell back to <body>. */
      onRequestClose:()=>{eggClose9();eggMenu()},
      /* M inside the game flips its own audio; mirror that onto the overlay
         button so the icon never disagrees with what you can hear. */
      onMuteChange:on=>egg9PaintMute(on),
      onToggleView:()=>egg9ToggleView(),
    });
    egg9PaintMute(egg9Game.soundOn);
  }).catch(err=>{
    egg9Loading=false;
    console.error("[polaris-man] failed to load",err);
    if(status)status.textContent="Polaris-Man could not load. Check your connection and try again.";
  });
}

/* Full-screen vs windowed, toggled with F and remembered for the session.
   Full is the default: an egg you had to find should open like a cabinet. The
   preference is sessionStorage, not localStorage — a deliberate choice returns
   to the default next visit rather than silently persisting forever. */
const EGG9_VIEW_KEY="psb_view";
function egg9View(){
  try{ return sessionStorage.getItem(EGG9_VIEW_KEY)==="window"?"window":"full" }
  catch(e){ return "full" }
}
function egg9SetView(v){
  const modal=document.getElementById("egg9");
  if(modal)modal.dataset.view=v;
  try{ sessionStorage.setItem(EGG9_VIEW_KEY,v) }catch(e){}
  const hint=document.getElementById("egg9-hint");
  if(hint){
    hint.textContent=v==="full"?"F · windowed":"F · full screen";
    hint.classList.add("on");
    clearTimeout(egg9HintT);
    egg9HintT=setTimeout(()=>hint.classList.remove("on"),2600);
  }
  /* Phaser measures its parent on resize, so the canvas has to be told the box
     changed or it keeps the old letterbox until the window itself resizes. */
  requestAnimationFrame(()=>dispatchEvent(new Event("resize")));
}
let egg9HintT=null;
function egg9ToggleView(){
  egg9SetView(egg9View()==="full"?"window":"full");
}

/* Polaris-Man owns an audio graph of its own, entirely separate from EggAudio.
   eggToggleMute()/eggSyncMute() drive every other .egg-snd button from
   EggAudio.isMuted(), which would silence the site and leave the game playing,
   so egg9's button routes through the game handle instead and paints itself
   from the game's state. Same icons, same title text, different source. */
function egg9PaintMute(on){
  const b=document.querySelector("#egg9 .egg-snd");
  if(!b)return;
  b.innerHTML=on?EGG_SND_ON:EGG_SND_OFF;
  b.title=on?"Sound on — M to mute":"Sound off — M to unmute";
  b.setAttribute("aria-label",b.title);
}
function egg9ToggleMute(){
  if(!egg9Game)return;
  egg9PaintMute(egg9Game.toggleMute());
}

function eggClose9(){
  const modal=document.getElementById("egg9");
  if(modal)modal.style.display="none";
  if(egg9Game){egg9Game.destroy();egg9Game=null}
  egg9Loading=false;
  eggEndDismiss();
  const back=egg9Return;egg9Return=null;
  if(back&&back.isConnected)try{back.focus({preventScroll:true})}catch(e){}
}

/* The tab going away should silence the game and park its loop; coming back
   should not auto-resume audio the player muted. The handle owns both. */
addEventListener("visibilitychange",()=>{
  if(!egg9Game)return;
  if(document.hidden)egg9Game.suspend();else egg9Game.resume();
});

/* easter egg: MARS — SIGNAL SIEGE.
   The Mars campaign, and the second egg that runs on Phaser rather than on
   hand-drawn canvas. Both Phaser and the ~13 MB of Mars art and audio are
   code-split behind this function, so a visitor who never opens Mars pays
   nothing for it.

   `eggMarsGame` is the live handle and the single source of truth for "is the
   game up". That is what makes open/close/reopen idempotent: eggCloseMars
   always destroys through the handle and nulls it, so a second close is a
   no-op and a reopen can never leave two Phaser instances, two audio graphs or
   two loops running.

   The old RELAY RUN implementation below is left in place and dormant. It is
   not dead code that can simply be deleted — seven of its sprite keys are
   drawn by SIGNAL JUMPER, and `#egg` is still eggLaunch's fallback branch. */
let eggMarsGame=null,eggMarsLoading=false,eggMarsReturn=null,eggMarsHintT=null;
/* Bumped on every open AND every close. The in-flight import() is checked
   against the generation it started in, because testing the modal's display
   style is not enough: close-then-reopen while the chunk is still arriving
   leaves the modal visible again, so both promises would pass that test and
   mount, orphaning the first Phaser instance where nothing can ever destroy
   it. */
let eggMarsGen=0,eggMarsFailed=false;

function eggOpenMars(){
  const modal=document.getElementById("egg-mars");
  if(!modal)return;
  eggMarsReturn=document.activeElement instanceof HTMLElement?document.activeElement:null;
  modal.style.display="flex";
  /* Always opens full screen, never the view the visitor last chose.
     The stored preference is still what F toggles against for the rest of the
     session, but an action game that opens into an 85% box because of a
     keystroke from twenty minutes ago is not what anyone asked for — Mars is
     meant to take over the screen when you open it. */
  eggMarsSetView("full");
  if(eggMarsGame||eggMarsLoading)return;
  eggMarsLoading=true;
  const gen=++eggMarsGen;
  const mount=document.getElementById("egg-mars-mount");
  const status=document.getElementById("egg-mars-status");
  if(status)status.textContent="Loading Mars: Signal Siege…";
  import("../../games/mars-signal-siege/index").then(m=>{
    eggMarsLoading=false;
    /* Closed again before the chunk arrived: honour that rather than popping a
       game open behind the visitor. */
    if(modal.style.display!=="flex"){if(status)status.textContent="";return}
    if(status)status.textContent="";
    eggMarsGame=m.mountMarsSignalSiege(mount,{
      onRequestClose:()=>{eggCloseMars();eggMenu()},
      onMuteChange:on=>eggMarsPaintMute(on),
      onToggleView:()=>eggMarsToggleView(),
    });
    eggMarsPaintMute(eggMarsGame.soundOn);
  }).catch(err=>{
    if(gen!==eggMarsGen)return;
    eggMarsLoading=false;
    eggMarsFailed=true;
    console.error("[mars-signal-siege] failed to load",err);
    if(status)status.textContent="Mars: Signal Siege could not load. Check your connection and try again.";
  });
}

/* Full-screen vs windowed, remembered for the session only — same reasoning
   as Polaris-Man: a deliberate choice returns to the default next visit. */
const EGG_MARS_VIEW_KEY="mss_view";
function eggMarsView(){
  try{ return sessionStorage.getItem(EGG_MARS_VIEW_KEY)==="window"?"window":"full" }
  catch(e){ return "full" }
}
function eggMarsSetView(v){
  const modal=document.getElementById("egg-mars");
  if(modal)modal.dataset.view=v;
  try{ sessionStorage.setItem(EGG_MARS_VIEW_KEY,v) }catch(e){}
  const hint=document.getElementById("egg-mars-hint");
  if(hint){
    hint.textContent=v==="full"?"F · windowed":"F · full screen";
    hint.classList.add("on");
    clearTimeout(eggMarsHintT);
    eggMarsHintT=setTimeout(()=>hint.classList.remove("on"),2600);
  }
  /* Phaser measures its parent on resize, so the canvas has to be told the box
     changed or it keeps the old letterbox until the window itself resizes. */
  requestAnimationFrame(()=>dispatchEvent(new Event("resize")));
}
function eggMarsToggleView(){
  eggMarsSetView(eggMarsView()==="full"?"window":"full");
}

/* Mars owns an audio graph of its own, separate from EggAudio, so its button
   routes through the game handle and paints from the game's state. */
function eggMarsPaintMute(on){
  const b=document.querySelector("#egg-mars .egg-snd");
  if(!b)return;
  b.innerHTML=on?EGG_SND_ON:EGG_SND_OFF;
  b.title=on?"Sound on — M to mute":"Sound off — M to unmute";
  b.setAttribute("aria-label",b.title);
}
function eggMarsToggleMute(){
  if(!eggMarsGame)return;
  eggMarsPaintMute(eggMarsGame.toggleMute());
}

function eggCloseMars(){
  eggMarsGen++;
  eggMarsFailed=false;
  const modal=document.getElementById("egg-mars");
  if(modal)modal.style.display="none";
  if(eggMarsGame){eggMarsGame.destroy();eggMarsGame=null}
  eggMarsLoading=false;
  eggEndDismiss();
  const back=eggMarsReturn;eggMarsReturn=null;
  if(back&&back.isConnected)try{back.focus({preventScroll:true})}catch(e){}
}

addEventListener("visibilitychange",()=>{
  if(!eggMarsGame)return;
  if(document.hidden)eggMarsGame.suspend();else eggMarsGame.resume();
});

function eggLaunch(which){
  EggAudio.init();EggAudio.uiClick();EggAudio.musicStop();
  document.getElementById("eggmenu").style.display="none";
  ssMenuStop();ssMapStop();   /* no map rendering behind a running game */
  if(which==="stack")eggOpen2();
  else if(which==="invade")eggOpen3();
  else if(which==="pluto")eggOpen4();
  else if(which==="venus")eggOpen5();
  else if(which==="earth")eggOpen6();
  else if(which==="saturn")eggOpen7();
  else if(which==="mercury")eggOpen8();
  else if(which==="uranus")eggOpen9();
  else if(which==="catch")eggOpenMars();
  else eggOpen();
}
/* bodies still in development: audio blip + holo-card flash, no launch */
function eggDevBlip(g){
  EggAudio.init();EggAudio.blip();
  if(g&&g.classList){
    g.classList.add("ss-flash");
    setTimeout(function(){g.classList.remove("ss-flash")},700);
  }
}
/* eggOpen5/eggClose5 (SIGNAL JUMPER) and eggOpen6/eggClose6 (THE LOST
   DISPLAY) live with their game blocks below — function declarations hoist. */
/* global egg keys: M mute · Esc back/close (active only while an egg modal is open) */
addEventListener("keydown",e=>{
  const menu=document.getElementById("eggmenu");
  const menuOpen=menu&&menu.style.display==="flex";
  const game=["egg","egg2","egg3","egg4","egg5","egg6","egg7","egg8","egg9","egg-mars"].map(i=>document.getElementById(i)).find(n=>n&&n.style.display==="flex");
  if(!menuOpen&&!game)return;
  /* While Polaris-Man is up it owns every key it uses, including M and a
     context-sensitive Esc (pause mid-mission, close otherwise), and it listens
     on the document because focus moves out of its subtree constantly as
     screens swap. So this handler steps aside entirely rather than testing
     where the event came from — that test used to let the site mute a second
     time whenever focus had fallen back to <body>. */
  /* Mars owns M and a context-sensitive Escape once it is actually running.
     Until then — while the chunk is loading, or permanently if it failed —
     nothing inside the modal is listening, so the site keeps Escape rather
     than leaving a keyboard user with no way out but the ✕. */
  if(game&&game.id==="egg9")return;
  if(game&&game.id==="egg-mars"&&eggMarsGame&&!eggMarsFailed)return;
  if(e.key==="m"||e.key==="M"){eggToggleMute();return}
  if(e.key==="Escape"){
    if(game){({egg:eggClose,egg2:eggClose2,egg3:eggClose3,egg4:eggClose4,egg5:eggClose5,egg6:eggClose6,egg7:eggClose7,egg8:eggClose8,egg9:eggClose9,"egg-mars":eggCloseMars})[game.id]();eggMenu()}
    /* During the logo film Esc means "get on with it", not "leave": one press
       skips to the system, a second closes. */
    else if(eggIntroRunning)eggIntroDone();
    else if(!ssMapDismiss())eggMenuClose();
  }
});

/* easter egg 2: WORKSPACE STACK — proper falling-block game: 10×18 board,
   7-bag randomizer, hold (C), 3-piece preview, ghost piece, wall kicks,
   soft/hard drop with trail flash, line-clear flash + combo-pitched arpeggio,
   scoring 100/300/500/800 × level (+50·combo·level), gravity 800ms -> 90ms. */
let egg2Anim=null,egg2Best=0,egg2Keys=null;
function eggOpen2(){
  document.getElementById("egg2").style.display="flex";
  EggAudio.init();EggAudio.ambientStart();eggSyncMute();
  document.getElementById("egg2-key").innerHTML=renderKey([["← →","move"],["↓","soft"],["Space","drop"],["Z / ↑","rotate"],["C","hold"],["P","pause"],["M","mute"],["Esc","mission control"]]);
  eggStackRun();
}
function eggStackRun(){
  const W=640,H=560,c=document.getElementById("egg2c"),x=eggCanvas("egg2c",W,H);
  eggEndDismiss();
  if(egg2Anim){cancelAnimationFrame(egg2Anim);egg2Anim=null}
  if(egg2Keys){removeEventListener("keydown",egg2Keys);removeEventListener("keyup",egg2Keys)}
  const COLS=10,ROWS=18,CW=28,OX=40,OY=28,PX=352;
  /* workspace-tile pieces: I share · O whiteboard · T wireless · J desktop · L cloud · S camera · Z doc-cam */
  const PIECES=[
    {s:[[1,1,1,1]],c:"#4fc3d9"},
    {s:[[1,1],[1,1]],c:"#e8c76a"},
    {s:[[0,1,0],[1,1,1]],c:"#a58cff"},
    {s:[[1,0,0],[1,1,1]],c:"#6d5bb8"},
    {s:[[0,0,1],[1,1,1]],c:"#8f7ae0"},
    {s:[[0,1,1],[1,1,0]],c:"#7ce3a8"},
    {s:[[1,1,0],[0,1,1]],c:"#e8a184"}
  ];
  const KICKS=[[0,0],[-1,0],[1,0],[0,-1],[-1,-1],[1,-1],[-2,0],[2,0]];
  let grid=Array.from({length:ROWS},()=>Array(COLS).fill(0));
  let bag=[],queue=[],hold=null,canHold=true,cur=null;
  let score=0,lines=0,level=1,combo=-1,alive=true,paused=false;
  let gravT=0,last=null,clearing=null,trail=null,elapsed=0;
  const keys={},das={dir:0,t:0};
  const gravMs=()=>Math.max(90,Math.round(800*Math.pow(.785,level-1)));
  function refill(){const b=[0,1,2,3,4,5,6];for(let i=b.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));const tt=b[i];b[i]=b[j];b[j]=tt}bag=bag.concat(b)}
  function nextIdx(){if(bag.length<7)refill();return bag.shift()}
  function mk(i){const s=PIECES[i].s.map(r=>r.slice());return {i,s,x:Math.floor((COLS-s[0].length)/2),y:-1}}
  function fits(s,ax,ay){for(let r=0;r<s.length;r++)for(let q=0;q<s[r].length;q++){if(!s[r][q])continue;const gx=ax+q,gy=ay+r;if(gx<0||gx>=COLS||gy>=ROWS)return false;if(gy>=0&&grid[gy][gx])return false}return true}
  const rotCW=s=>s[0].map((_,i)=>s.map(r=>r[i]).reverse());
  const rotCCW=s=>s[0].map((_,i)=>s.map(r=>r[s[0].length-1-i]));
  function updateHud(){
    document.getElementById("egg2s").textContent=score;
    document.getElementById("egg2ln").textContent=lines;
    document.getElementById("egg2lv").textContent=level;
  }
  function spawn(fromHold){
    cur=fromHold||mk(queue.shift());
    if(!fromHold)queue.push(nextIdx());
    cur.x=Math.floor((COLS-cur.s[0].length)/2);cur.y=-1;
    canHold=true;gravT=0;
    if(!fits(cur.s,cur.x,cur.y)){if(fits(cur.s,cur.x,cur.y-1))cur.y--;else gameOver()}
  }
  function move(d){if(cur&&alive&&!paused&&fits(cur.s,cur.x+d,cur.y)){cur.x+=d;EggAudio.uiHover()}}
  function rotate(dr){
    if(!cur||!alive||paused)return;
    const R=dr>0?rotCW(cur.s):rotCCW(cur.s);
    for(const k of KICKS){if(fits(R,cur.x+k[0],cur.y+k[1])){cur.s=R;cur.x+=k[0];cur.y+=k[1];EggAudio.uiHover();return}}
  }
  function ghostY(){let gy=cur.y;while(fits(cur.s,cur.x,gy+1))gy++;return gy}
  function doHold(){
    if(!cur||!canHold||!alive||paused)return;
    const h=hold;hold=cur.i;EggAudio.blip();
    if(h==null)spawn();else spawn(mk(h));
    canHold=false;
  }
  function hardDrop(){
    if(!cur||!alive||paused)return;
    const y0=cur.y,gy=ghostY(),n=gy-cur.y;
    cur.y=gy;score+=2*n;
    trail={x:cur.x,w:cur.s[0].length,y0:Math.max(0,y0),y1:gy,t:.16,col:PIECES[cur.i].c};
    lock();updateHud();
  }
  function lock(){
    let over=false;
    cur.s.forEach((r,ri)=>r.forEach((v,ci)=>{if(!v)return;const gy=cur.y+ri;if(gy<0){over=true;return}grid[gy][cur.x+ci]=cur.i+1}));
    cur=null;
    if(over)return gameOver();
    const full=[];grid.forEach((r,ri)=>{if(r.every(v=>v))full.push(ri)});
    if(full.length){
      combo++;
      const pts=[0,100,300,500,800][full.length]*level+(combo>0?50*combo*level:0);
      score+=pts;lines+=full.length;
      const nl=1+Math.floor(lines/10);
      if(nl>level){level=nl;EggAudio.levelUp()}
      EggAudio.lineClear(combo);
      clearing={rows:full,t:.28};
    }else{
      combo=-1;
      spawn();
    }
    updateHud();
  }
  function gameOver(){
    if(!alive)return;
    alive=false;cur=null;
    egg2Best=Math.max(egg2Best,score);document.getElementById("egg2b").textContent=egg2Best;
    EggAudio.gameOver();
    eggEndScreen({host:c.parentElement,title:"The workspace is full.",
      lines:["Score "+score+" · "+lines+" lines · level "+level,"Session best "+egg2Best],
      onReplay:eggStackRun,onMenu:()=>{eggClose2();eggMenu()}});
  }
  egg2Keys=e=>{
    if(document.getElementById("egg2").style.display!=="flex")return;
    if(["ArrowLeft","ArrowRight","ArrowUp","ArrowDown"," "].includes(e.key))e.preventDefault();
    if(e.type==="keyup"){keys[e.key]=false;return}
    if(e.repeat)return;
    keys[e.key]=true;
    if((e.key==="p"||e.key==="P")&&alive){paused=!paused;return}
    if(paused)return;
    if(e.key==="ArrowLeft")move(-1);
    else if(e.key==="ArrowRight")move(1);
    else if(e.key==="ArrowUp")rotate(1);
    else if(e.key==="z"||e.key==="Z")rotate(-1);
    else if(e.key==="c"||e.key==="C")doHold();
    else if(e.key===" ")hardDrop();
  };
  addEventListener("keydown",egg2Keys);addEventListener("keyup",egg2Keys);
  function block(bx,by,ci,cw){
    x.fillStyle=PIECES[ci].c;x.beginPath();x.roundRect(bx+1,by+1,cw-2,cw-2,4);x.fill();
    x.fillStyle="rgba(255,255,255,.22)";x.beginPath();x.roundRect(bx+3,by+3,cw-6,Math.max(3,cw*.22),3);x.fill();
    x.strokeStyle="rgba(7,5,15,.35)";x.lineWidth=1;x.strokeRect(bx+1.5,by+1.5,cw-3,cw-3);
  }
  function drawMini(i,bx,by,boxW,boxH){
    const p=PIECES[i],mw=p.s[0].length,mh=p.s.length,cw=14;
    const ox=bx+(boxW-mw*cw)/2,oy=by+(boxH-mh*cw)/2;
    p.s.forEach((r,ri)=>r.forEach((v,ci)=>{if(v)block(ox+ci*cw,oy+ri*cw,i,cw)}));
  }
  function panelBox(bx,by,w,h,label){
    x.strokeStyle="#2a2350";x.lineWidth=1.5;x.beginPath();x.roundRect(bx,by,w,h,8);x.stroke();
    x.fillStyle="#8f85b8";x.font="9.5px Poppins,sans-serif";x.textAlign="left";
    x.fillText(label,bx+2,by-6);
  }
  function draw(){
    x.fillStyle="#0b0918";x.fillRect(0,0,W,H);
    x.fillStyle="rgba(165,140,255,.10)";
    for(let i=0;i<30;i++)x.fillRect((i*83+elapsed*9)%W,(i*47)%H,1.5,1.5);
    x.fillStyle="rgba(255,255,255,.02)";x.fillRect(OX,OY,COLS*CW,ROWS*CW);
    x.strokeStyle="#2a2350";x.lineWidth=1.5;x.strokeRect(OX-1.5,OY-1.5,COLS*CW+3,ROWS*CW+3);
    x.strokeStyle="rgba(165,140,255,.05)";x.lineWidth=1;
    for(let q=1;q<COLS;q++){x.beginPath();x.moveTo(OX+q*CW,OY);x.lineTo(OX+q*CW,OY+ROWS*CW);x.stroke()}
    for(let r=1;r<ROWS;r++){x.beginPath();x.moveTo(OX,OY+r*CW);x.lineTo(OX+COLS*CW,OY+r*CW);x.stroke()}
    if(trail){
      x.globalAlpha=Math.max(0,trail.t/.16)*.35;x.fillStyle=trail.col;
      x.fillRect(OX+trail.x*CW,OY+trail.y0*CW,trail.w*CW,(trail.y1-trail.y0+1)*CW);
      x.globalAlpha=1;
    }
    for(let r=0;r<ROWS;r++)for(let q=0;q<COLS;q++)if(grid[r][q])block(OX+q*CW,OY+r*CW,grid[r][q]-1,CW);
    if(clearing){
      x.globalAlpha=.25+.6*Math.abs(Math.sin(clearing.t*42));
      x.fillStyle="#fff";
      clearing.rows.forEach(r=>x.fillRect(OX,OY+r*CW,COLS*CW,CW));
      x.globalAlpha=1;
    }
    if(cur){
      const gy=ghostY();
      x.strokeStyle=PIECES[cur.i].c;x.globalAlpha=.30;x.lineWidth=1.5;
      cur.s.forEach((r,ri)=>r.forEach((v,ci)=>{if(v&&gy+ri>=0)x.strokeRect(OX+(cur.x+ci)*CW+2,OY+(gy+ri)*CW+2,CW-4,CW-4)}));
      x.globalAlpha=1;
      cur.s.forEach((r,ri)=>r.forEach((v,ci)=>{if(v&&cur.y+ri>=0)block(OX+(cur.x+ci)*CW,OY+(cur.y+ri)*CW,cur.i,CW)}));
    }
    panelBox(PX,52,120,74,"HOLD  (C)");
    if(hold!=null)drawMini(hold,PX,52,120,74);
    panelBox(PX,158,120,196,"NEXT");
    for(let i=0;i<3;i++)if(queue[i]!=null)drawMini(queue[i],PX,164+i*62,120,58);
    x.textAlign="left";
    const stat=(label,val,col,yy)=>{x.fillStyle="#8f85b8";x.font="9.5px Poppins,sans-serif";x.fillText(label,PX,yy);x.fillStyle=col;x.font="700 17px Poppins,sans-serif";x.fillText(val,PX,yy+20)};
    stat("SCORE",score,"#e2d9ff",392);
    stat("LINES",lines,"#4fc3d9",436);
    stat("LEVEL",level,"#e8c76a",480);
    stat("SESSION BEST",egg2Best,"#a58cff",524);
    if(paused)eggPauseOverlay(x,W,H);
  
    crtPass(x);   /* phosphor halo - see crtPass() */
  }
  function update(dt){
    elapsed+=dt;
    if(trail){trail.t-=dt;if(trail.t<=0)trail=null}
    if(clearing){
      clearing.t-=dt;
      if(clearing.t<=0){
        grid=grid.filter((_,ri)=>!clearing.rows.includes(ri));
        while(grid.length<ROWS)grid.unshift(Array(COLS).fill(0));
        clearing=null;spawn();
      }
      return;
    }
    if(!cur)return;
    // held-key auto-repeat (DAS 170ms, then a step every 55ms)
    const d=(keys.ArrowLeft?-1:0)+(keys.ArrowRight?1:0);
    if(d!==0){if(das.dir!==d){das.dir=d;das.t=0}else{das.t+=dt;while(das.t>.17){das.t-=.055;move(d)}}}
    else das.dir=0;
    // gravity — soft drop ≈45ms/row, +1 pt per soft cell
    gravT+=dt*1000;
    const g=keys.ArrowDown?45:gravMs();
    while(cur&&gravT>=g){
      gravT-=g;
      if(fits(cur.s,cur.x,cur.y+1)){cur.y++;if(keys.ArrowDown){score++;updateHud()}}
      else{lock();break}
    }
  }
  function loop(ts){
    if(!alive)return;
    if(document.getElementById("egg2").style.display!=="flex"){egg2Anim=null;return}
    const now=ts!=null?ts:(window.performance&&performance.now?performance.now():Date.now());
    if(last==null)last=now;
    const dt=Math.min(.05,(now-last)/1000);last=now;
    if(!paused)update(dt);
    draw();
    if(alive)egg2Anim=requestAnimationFrame(loop);
  }
  window.__eggDbg={game:"stack",
    state:()=>({score,lines,level,combo,alive,paused,hold,clearing:!!clearing,cur:cur?{i:cur.i,x:cur.x,y:cur.y}:null,queue:queue.slice()}),
    setCur:i=>{cur=mk(i)},
    fillRow:(fromBottom,holes)=>{const r=ROWS-1-fromBottom;for(let q=0;q<COLS;q++)grid[r][q]=(holes||[]).indexOf(q)>=0?0:3}};
  refill();while(queue.length<3)queue.push(nextIdx());
  spawn();updateHud();
  document.getElementById("egg2b").textContent=egg2Best;
  egg2Anim=requestAnimationFrame(loop);
}
/* ============================================================================
   MISSION CONTROL — galaxy-map scene painter.
   Two canvas layers under the SVG interaction layer:
     #ss-bg  — static deep space (nebula, dust lanes, vignette, holo orbit grid)
               pre-rendered ONCE; parallax star tiers pre-rendered to offscreens.
     #ss-dyn — per-frame: star tiers (parallax blit), bright stars (twinkle +
               diffraction spikes), sun (breathing corona, pulsing soft
               rays + rotating glint, capped anamorphic beam; sun light is
               baked once into gradient sprites), lit-sphere planets (sun-offset
               gradient, terminator, atmosphere rim, specular, rings, bands),
               orbit sweep highlight, radar scan, film grain.
   One rAF clock drives canvas planets AND the SVG hit groups (no drift).
   Under prefers-reduced-motion: a single static frame is drawn, no loop.
   All painting is a pure function of (ctx, SS_SCENE, t); _egg_work/scene_qa.py
   replicates the same primitives in Pillow/numpy for visual QA.
   ========================================================================== */
/* .ss-zoom crop: scene window visible at SS_ZOOM, with an 8 frame-px safe margin */
const SS_ZOOM=1.05,SS_VIEW={xl:520-512/SS_ZOOM,xr:520+512/SS_ZOOM,yt:220-212/SS_ZOOM,yb:220+212/SS_ZOOM};
function ssPRNG(seed){let a=seed>>>0;return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
function ssRGBA(c,a){return"rgba("+c[0]+","+c[1]+","+c[2]+","+Math.max(0,Math.min(1,a)).toFixed(4)+")"}
/* -- primitives ---------------------------------------------------------- */
function ssGlow(x2,x,y,r,c,stops){ /* additive radial glow, same-color alpha stops */
  x2.save();x2.globalCompositeOperation="lighter";
  const g=x2.createRadialGradient(x,y,0,x,y,r);
  for(const s of stops)g.addColorStop(s[0],ssRGBA(c,s[1]));
  x2.fillStyle=g;x2.fillRect(x-r,y-r,r*2,r*2);x2.restore();
}
function ssBlob(x2,b){ /* nebula blob [x,y,r,sx,sy,rotDeg,ci,a] — additive */
  const c=SS_SCENE.pal[b[6]],r=b[2];
  x2.save();x2.globalCompositeOperation="lighter";
  x2.translate(b[0],b[1]);x2.rotate(b[5]*Math.PI/180);x2.scale(b[3],b[4]);
  const g=x2.createRadialGradient(0,0,0,0,0,r);
  g.addColorStop(0,ssRGBA(c,b[7]));g.addColorStop(.55,ssRGBA(c,b[7]*.45));g.addColorStop(1,ssRGBA(c,0));
  x2.fillStyle=g;x2.fillRect(-r,-r,r*2,r*2);x2.restore();
}
function ssDust(x2,d){ /* dark dust lane [x,y,r,sx,sy,rotDeg,a] — source-over */
  const r=d[2];
  x2.save();x2.translate(d[0],d[1]);x2.rotate(d[5]*Math.PI/180);x2.scale(d[3],d[4]);
  const g=x2.createRadialGradient(0,0,0,0,0,r);
  g.addColorStop(0,"rgba(5,4,12,"+d[6]+")");g.addColorStop(.6,"rgba(5,4,12,"+(d[6]*.45).toFixed(3)+")");g.addColorStop(1,"rgba(5,4,12,0)");
  x2.fillStyle=g;x2.fillRect(-r,-r,r*2,r*2);x2.restore();
}
function ssSpike(x2,x,y,len,a,vert){ /* one diffraction spike arm pair (line through star) */
  x2.save();x2.globalCompositeOperation="lighter";
  const g=vert?x2.createLinearGradient(x,y-len,x,y+len):x2.createLinearGradient(x-len,y,x+len,y);
  g.addColorStop(0,"rgba(214,222,255,0)");g.addColorStop(.5,"rgba(214,222,255,"+a.toFixed(3)+")");g.addColorStop(1,"rgba(214,222,255,0)");
  x2.strokeStyle=g;x2.lineWidth=1;x2.beginPath();
  if(vert){x2.moveTo(x,y-len);x2.lineTo(x,y+len)}else{x2.moveTo(x-len,y);x2.lineTo(x+len,y)}
  x2.stroke();x2.restore();
}
/* -- deterministic star field (PRNG consumption order is the contract) --- */
function ssStarData(){
  const S=SS_SCENE,R=ssPRNG(S.seed),d={tiny:[],med:[],bright:[]};
  for(let i=0;i<S.stars.tiny;i++)d.tiny.push([R()*S.W,R()*S.H,.16+R()*.30]);
  for(let i=0;i<S.stars.med;i++)d.med.push([R()*S.W,R()*S.H,.9+R()*.8,.26+R()*.34]);
  for(let i=0;i<S.stars.bright;i++)d.bright.push([R()*S.W,R()*S.H,1.4+R()*1.1,.5+R()*.4,R()*6.283,7+R()*9]);
  return d;
}
/* -- static holo orbit grid: 1px arcs + 30-degree ticks + cardinal labels - */
function ssOrbitGrid(x2){
  const S=SS_SCENE;
  x2.save();x2.lineWidth=1;
  for(const o of S.orbits){
    x2.strokeStyle="rgba(165,140,255,"+S.ui.orbA+")";
    x2.beginPath();x2.ellipse(S.CX,S.CY,o[0],o[1],0,0,6.2832);x2.stroke();
    for(let k=0;k<12;k++){
      const th=k*Math.PI/6,c=Math.cos(th),s=Math.sin(th);
      const px=S.CX+o[0]*c,py=S.CY+o[1]*s;
      let nx=o[1]*c,ny=o[0]*s;const nl=Math.hypot(nx,ny)||1;nx/=nl;ny/=nl;
      const L=k%3===0?3.4:2.1,a=k%3===0?S.ui.tickA:S.ui.tickA*.55;
      x2.strokeStyle="rgba(165,140,255,"+a.toFixed(3)+")";
      x2.beginPath();x2.moveTo(px-nx*L,py-ny*L);x2.lineTo(px+nx*L,py+ny*L);x2.stroke();
    }
  }
  for(const p of S.planets)if(p.orb){ /* inclined orbit (PLUTO) — its own hairline */
    const o=p.orb;
    x2.strokeStyle="rgba(186,205,255,"+(S.ui.orbA*.85).toFixed(3)+")";
    x2.beginPath();x2.ellipse(o.cx,o.cy,o.rx,o.ry,o.rot*Math.PI/180,0,6.2832);x2.stroke();
  }
  x2.setLineDash([4,7]);x2.strokeStyle="rgba(150,190,255,.13)";
  x2.beginPath();x2.ellipse(S.ship.cx,S.ship.cy,S.ship.rx,S.ship.ry,0,0,6.2832);x2.stroke();
  x2.setLineDash([]);
  const oo=S.orbits[S.orbits.length-1];
  x2.font="600 7px ui-monospace,Menlo,Consolas,monospace";x2.textAlign="center";x2.fillStyle="rgba(165,140,255,.36)";
  const LB=[[0,"090"],[Math.PI/2,"180"],[Math.PI,"270"],[-Math.PI/2,"000"]];
  for(const q of LB)x2.fillText(q[1],S.CX+(oo[0]+15)*Math.cos(q[0]),S.CY+(oo[1]+10)*Math.sin(q[0])+2.5);
  x2.restore();
}
/* -- the sun: soft precomputed light sprites, gently animated --------------
   Regression fix: under the 1.3x .ss-zoom crop the old two-stop rays and the
   620px anamorphic line read as hard solid rules across the map. Every light
   element is now baked ONCE into an offscreen sprite whose radial gradient
   falls off steeply and terminates at alpha 0 (soft light, never a stroke);
   per frame ssSun() only blits sprites (transform + globalAlpha -- zero
   per-frame allocations). Animation, all skipped under prefers-reduced-motion
   (the single RM frame still uses the same soft gradient sprites):
   - corona breath: +-4.5% radius, +-12% opacity, period sun.breath (8s)
   - ray pulse: per-ray +-8% length, +-22% opacity, 4.6-6.4s periods
   - ray drift: the original slow streak rotations (90-160s per revolution)
   - glint: one narrow bright ray, ~44s per revolution, 5s opacity shimmer
   - beam: capped at 235px half-length (470px total, 45% of the 1040px frame,
     faded out well inside the zoom crop), 7.3s breathing pulse */
const SS_SUNFX={rayP:[5.2,6.4,4.6],rayPh:[0,2.1,4.2],glintT:44,glintP:5,beamP:7.3,beamR:235};
let ssSunSpr=null;
function ssSunRaySpr(len,th,c,stops){ /* horizontal soft ray, fades to alpha 0 */
  const cv=document.createElement("canvas");cv.width=len*2;cv.height=Math.max(2,Math.ceil(th*2));
  const x2=cv.getContext("2d");
  x2.translate(len,cv.height/2);x2.scale(1,th/len);
  const g=x2.createRadialGradient(0,0,0,0,0,len);
  for(const q of stops)g.addColorStop(q[0],ssRGBA(c,q[1]));
  g.addColorStop(1,ssRGBA(c,0));
  x2.fillStyle=g;x2.fillRect(-len,-len,len*2,len*2);
  return cv;
}
function ssSunGlowSpr(r,c,stops){ /* radial glow, terminal stop alpha 0 */
  const cv=document.createElement("canvas");cv.width=cv.height=Math.ceil(r*2);
  const x2=cv.getContext("2d");
  const g=x2.createRadialGradient(r,r,0,r,r,r);
  for(const q of stops)g.addColorStop(q[0],ssRGBA(c,q[1]));
  g.addColorStop(1,ssRGBA(c,0));
  x2.fillStyle=g;x2.fillRect(0,0,cv.width,cv.height);
  return cv;
}
function ssSunBuild(){
  const su=SS_SCENE.sun,co=su.core;
  const disc=document.createElement("canvas");disc.width=disc.height=co*2+2; /* the disc itself: hard edge OK, radius = core */
  const dx=disc.getContext("2d"),dc=co+1;
  const dg=dx.createRadialGradient(dc,dc-co*.2,0,dc,dc,co);
  dg.addColorStop(0,"#fffdf6");dg.addColorStop(.55,"#ffedb0");dg.addColorStop(1,"#ffc470");
  dx.fillStyle=dg;dx.beginPath();dx.arc(dc,dc,co,0,6.2832);dx.fill();
  ssSunSpr={
    corona:ssSunGlowSpr(su.corona,[255,205,130],[[0,.20],[.45,.085]]),
    glow:ssSunGlowSpr(su.glow,[255,215,140],[[0,.5],[.5,.26]]),
    core:ssSunGlowSpr(co*1.7,[255,236,176],[[0,.85],[.55,.45]]),
    ray:ssSunRaySpr(165,9,[255,225,170],[[0,.20],[.35,.11],[.72,.03]]),
    glint:ssSunRaySpr(118,3.6,[255,240,205],[[0,.30],[.45,.10]]),
    beam:ssSunRaySpr(SS_SUNFX.beamR,6.5,[255,238,200],[[0,.30],[.28,.15],[.62,.04]]),
    haze:ssSunRaySpr(185,15,[255,238,200],[[0,.10],[.5,.035]]),
    disc:disc};
}
function ssSunBlit(x2,spr,x,y,rot,sx,sy,al,over){
  x2.save();
  if(!over)x2.globalCompositeOperation="lighter";
  x2.globalAlpha=Math.max(0,Math.min(1,al));
  x2.translate(x,y);if(rot)x2.rotate(rot);x2.scale(sx,sy);
  x2.drawImage(spr,-spr.width/2,-spr.height/2);
  x2.restore();
}
function ssSun(x2,t){
  if(!ssSunSpr)ssSunBuild();
  const S=SS_SCENE,su=S.sun,F=SS_SUNFX,CX=S.CX,CY=S.CY,P=ssSunSpr,tt=EGG_RM?0:t;
  const b=Math.sin(tt*6.2832/su.breath); /* 8s corona breath */
  ssSunBlit(x2,P.corona,CX,CY,0,1+.045*b,1+.045*b,.88+.12*b);
  for(let i=0;i<su.streaks.length;i++){ /* soft rays: slow drift + gentle pulse */
    const st=su.streaks[i],pu=Math.sin(tt*6.2832/F.rayP[i]+F.rayPh[i]);
    ssSunBlit(x2,P.ray,CX,CY,st[0]*Math.PI/180+tt*st[1]*6.2832,1+.08*pu,1,.78+.22*pu);
  }
  const gl=.5+.35*Math.sin(tt*6.2832/F.glintP); /* slow rotating glint, 5s shimmer */
  ssSunBlit(x2,P.glint,CX,CY,.6+tt*6.2832/F.glintT,1,1,gl);
  const bp=Math.sin(tt*6.2832/F.beamP); /* capped anamorphic beam, 7.3s pulse */
  ssSunBlit(x2,P.haze,CX,CY,0,1+.03*bp,1,.85+.15*bp);
  ssSunBlit(x2,P.beam,CX,CY,0,1+.03*bp,1,.85+.15*bp);
  ssSunBlit(x2,P.glow,CX,CY,0,1,1,1);
  ssSunBlit(x2,P.core,CX,CY,0,1,1,1);
  ssSunBlit(x2,P.disc,CX,CY,0,1,1,1,true);
}
/* -- planets as lit spheres ------------------------------------------------ */
function ssRings(x2,p,x,y,ux,uy,back){
  const rg=p.ring,r=p.r,rot=rg.rot*Math.PI/180,c=rg.c||[236,220,180];
  x2.save();x2.translate(x,y);x2.rotate(rot);
  x2.beginPath();x2.rect(-r*3.2,back?-r*3.2:0,r*6.4,r*3.2);x2.clip();
  for(let i=0;i<rg.r.length;i++){
    x2.strokeStyle=ssRGBA(c,rg.a[i]*(back?.5:1));x2.lineWidth=rg.w[i];
    x2.beginPath();x2.ellipse(0,0,r*rg.r[i],r*rg.r[i]*.3,0,0,6.2832);x2.stroke();
  }
  if(back){ /* planet shadow falling across the far rings (anti-sun side) */
    const co=Math.cos(-rot),si=Math.sin(-rot);
    const sx=-(ux*co-uy*si)*r*1.55,sy=-(ux*si+uy*co)*r*1.55;
    const g=x2.createRadialGradient(sx,sy,0,sx,sy,r*1.25);
    g.addColorStop(0,"rgba(5,4,12,.5)");g.addColorStop(1,"rgba(5,4,12,0)");
    x2.fillStyle=g;x2.fillRect(sx-r*1.25,sy-r*1.25,r*2.5,r*2.5);
  }
  x2.restore();
}
function ssPlanet(x2,p,x,y,t){
  const S=SS_SCENE,r=p.r;
  let ux=S.CX-x,uy=S.CY-y;const dl=Math.hypot(ux,uy)||1;ux/=dl;uy/=dl; /* toward sun */
  if(p.ring)ssRings(x2,p,x,y,ux,uy,true);
  x2.save();x2.beginPath();x2.arc(x,y,r,0,6.2832);x2.clip();
  let g=x2.createRadialGradient(x+ux*r*.38,y+uy*r*.38,0,x+ux*r*.38,y+uy*r*.38,r*1.42);
  g.addColorStop(0,ssRGBA(p.hi,1));g.addColorStop(.4,ssRGBA(p.mid,1));g.addColorStop(1,ssRGBA(p.lo,1));
  x2.fillStyle=g;x2.fillRect(x-r,y-r,r*2,r*2);
  if(p.bands)for(const b of p.bands){
    x2.fillStyle="rgba(24,12,4,"+b[2]+")";
    x2.fillRect(x-r,y+b[0]*r,r*2,(b[1]-b[0])*r);
  }
  g=x2.createRadialGradient(x-ux*r*1.05,y-uy*r*1.05,0,x-ux*r*1.05,y-uy*r*1.05,r*2.05);
  g.addColorStop(0,"rgba(4,3,10,.95)");g.addColorStop(.45,"rgba(4,3,10,.62)");g.addColorStop(.72,"rgba(4,3,10,.12)");g.addColorStop(1,"rgba(4,3,10,0)");
  x2.fillStyle=g;x2.fillRect(x-r,y-r,r*2,r*2);
  /* diffuse day side: warm-tinted additive gradient inside the disc,
     brightest toward the sun, falling monotonically through the
     terminator into the night shade (no stroked limb, no hard specular) */
  const wc=[(p.rim[0]+255)>>1,(p.rim[1]+236)>>1,(p.rim[2]+188)>>1];
  x2.globalCompositeOperation="lighter";
  g=x2.createRadialGradient(x+ux*r*.85,y+uy*r*.85,0,x+ux*r*.85,y+uy*r*.85,r*2.1);
  g.addColorStop(0,ssRGBA(wc,.32));g.addColorStop(.28,ssRGBA(wc,.19));g.addColorStop(.55,ssRGBA(wc,.08));g.addColorStop(.8,ssRGBA(wc,.02));g.addColorStop(1,ssRGBA(wc,0));
  x2.fillStyle=g;x2.fillRect(x-r,y-r,r*2,r*2);
  x2.restore();
  /* soft wide low-alpha atmosphere haze over the lit limb (glow, not a stroke) */
  ssGlow(x2,x+ux*r*.62,y+uy*r*.62,Math.max(2,r*1.05),wc,[[0,.10],[.4,.05],[.75,.015],[1,0]]);
  if(p.ring)ssRings(x2,p,x,y,ux,uy,false);
  if(p.moon){
    const ma=t*6.2832/3.4,mx=x-11*Math.cos(ma),my=y+4.2*Math.sin(ma);
    let mux=x-mx,muy=y-my;const ml=Math.hypot(mux,muy)||1;  /* moon lit from sun too */
    mux=(S.CX-mx)/Math.hypot(S.CX-mx,S.CY-my);muy=(S.CY-my)/Math.hypot(S.CX-mx,S.CY-my);
    x2.save();x2.beginPath();x2.arc(mx,my,1.7,0,6.2832);x2.clip();
    const mg=x2.createRadialGradient(mx+mux,my+muy,0,mx+mux,my+muy,2.6);
    mg.addColorStop(0,"#d8d2de");mg.addColorStop(.6,"#8f8a9a");mg.addColorStop(1,"#2c2a34");
    x2.fillStyle=mg;x2.fillRect(mx-2,my-2,4,4);x2.restore();
  }
}
/* -- orbital positions from one clock ------------------------------------- */
function ssPositions(t){
  const S=SS_SCENE,out={};
  S.planets.forEach((p,i)=>{
    const ang=6.2832*((t-p.begin)/p.dur);
    if(p.orb){ /* PLUTO: own 17°-inclined ellipse, sun at a focus */
      const o=p.orb,th=o.rot*Math.PI/180,lx=-o.rx*Math.cos(ang),ly=o.ry*Math.sin(ang);
      out[p.n]=[o.cx+lx*Math.cos(th)-ly*Math.sin(th),o.cy+lx*Math.sin(th)+ly*Math.cos(th)];
      return;
    }
    const o=S.orbits[p.i];
    out[p.n]=[S.CX-o[0]*Math.cos(ang),S.CY+o[1]*Math.sin(ang)];
  });
  const sh=S.ship,ang=6.2832*((t-sh.begin)/sh.dur);
  out.SHIP=[sh.cx-sh.rx*Math.cos(ang),sh.cy+sh.ry*Math.sin(ang),
            Math.atan2(sh.ry*Math.cos(ang),sh.rx*Math.sin(ang))*180/Math.PI];
  return out;
}
/* -- runtime -------------------------------------------------------------- */
let ssAnim=0,ssT0=0,ssEls=null,ssTiers=null,ssData=null,ssGrainPat=null,ssGroups=null;
/* Mercury and Uranus are absent on purpose: neither Phaser game keeps a score,
   so their holo-cards read "BEST —" like a planet still in development. */
function ssBest(route){try{return route==="stack"?egg2Best:route==="invade"?egg3Best:route==="pluto"?egg4Best:route==="venus"?egg5Best:route==="earth"?egg6Best:route==="catch"?eggBest:route==="saturn"?egg7Best:0}catch(e){return 0}}
function ssBuildStatic(bg){
  const S=SS_SCENE,x2=bg.getContext("2d");
  const g=x2.createLinearGradient(0,0,0,S.H);
  g.addColorStop(0,"#070511");g.addColorStop(.55,"#0a0821");g.addColorStop(1,"#050310");
  x2.fillStyle=g;x2.fillRect(0,0,S.W,S.H);
  for(const b of S.nebula)ssBlob(x2,b);
  for(const d of S.dust)ssDust(x2,d);
  x2.save();x2.translate(S.CX,S.CY);x2.scale(1,.62); /* vignette (elliptical) */
  const v=x2.createRadialGradient(0,0,S.W*.22,0,0,S.W*.60);
  v.addColorStop(0,"rgba(3,2,8,0)");v.addColorStop(.55,"rgba(3,2,8,.08)");v.addColorStop(1,"rgba(3,2,8,.46)");
  x2.fillStyle=v;x2.fillRect(-S.W,-S.W,S.W*2,S.W*2);x2.restore();
  ssOrbitGrid(x2);
  ssData=ssStarData();
  ssTiers={};
  for(const tier of["tiny","med"]){
    const c=document.createElement("canvas");c.width=S.W;c.height=S.H;
    const t2=c.getContext("2d");
    for(const s of ssData[tier]){
      if(tier==="tiny"){t2.fillStyle="rgba(200,206,255,"+s[2].toFixed(3)+")";t2.fillRect(s[0]|0,s[1]|0,1,1)}
      else{ssGlow(t2,s[0],s[1],2.6,[200,210,255],[[0,s[3]*.6],[1,0]]);t2.fillStyle="rgba(214,220,255,"+s[3].toFixed(3)+")";t2.fillRect((s[0]-.5)|0,(s[1]-.5)|0,1,1)}
    }
    ssTiers[tier]=c;
  }
  const gt=document.createElement("canvas");gt.width=120;gt.height=120; /* grain tile */
  const gx=gt.getContext("2d"),im=gx.createImageData(120,120),R=ssPRNG(S.grainSeed);
  for(let i=0;i<im.data.length;i+=4){const v=R()<.5?0:255;im.data[i]=v;im.data[i+1]=v;im.data[i+2]=v;im.data[i+3]=8+R()*20}
  gx.putImageData(im,0,0);
  ssGrainPat=x2.createPattern(gt,"repeat");
}
function ssInitSvg(){
  ssGroups=[];
  const S=SS_SCENE,gs=document.querySelectorAll("#eggmenu .solsys .ss-p");
  if(!gs||!gs.length)return;
  gs.forEach(g=>{
    const nm=g.getAttribute("data-name"),route=g.getAttribute("data-route");
    const o={g,nm,route,s:parseFloat(g.getAttribute("data-s")||"14"),
      lead:g.querySelector(".ss-lead"),box:g.querySelector(".ss-cbox"),
      best:g.querySelector(".ss-cb"),rot:g.querySelector(".ss-rot")};
    g.addEventListener("mouseenter",()=>{const v=ssBest(route);if(o.best)o.best.textContent="BEST "+(v>0?v:"—")});
    ssGroups.push(o);
  });
}
function ssSyncSvg(pos){
  if(!ssGroups)return;
  for(const o of ssGroups){
    const p=pos[o.nm==="UNIDENTIFIED"?"SHIP":o.nm];if(!p)continue;
    o.g.setAttribute("transform","translate("+p[0].toFixed(1)+","+p[1].toFixed(1)+")");
    if(o.rot&&p.length>2)o.rot.setAttribute("transform","rotate("+p[2].toFixed(1)+")");
    if(o.lead&&o.box){ /* keep the holo data card inside the frame */
      const s=o.s,fx=p[0]+s+284>SS_VIEW.xr?-1:1,fy=p[1]-s-102<SS_VIEW.yt?1:-1;
      const bx=fx>0?s+22:-(s+22)-262,by=fy<0?-(s+22)-80:s+22;
      const cx=bx+(fx>0?0:262),cy=by+(fy<0?80:0);
      o.lead.setAttribute("d","M "+(fx*s*.72).toFixed(1)+" "+(fy*s*.72).toFixed(1)+" L "+cx+" "+cy);
      o.box.setAttribute("transform","translate("+bx+","+by+")");
    }
  }
}
function ssFrame(now){
  const S=SS_SCENE,menu=document.getElementById("eggmenu");
  if(!ssEls||!menu||menu.style.display!=="flex"){ssAnim=0;return}
  const t=(now-ssT0)/1000,x2=ssEls;
  x2.clearRect(0,0,S.W,S.H);
  const o1=EGG_RM?0:(t*1.1)%S.W,o2=EGG_RM?0:(t*2.4)%S.W;
  x2.drawImage(ssTiers.tiny,-o1,0);x2.drawImage(ssTiers.tiny,S.W-o1,0);
  x2.drawImage(ssTiers.med,-o2,0);x2.drawImage(ssTiers.med,S.W-o2,0);
  for(const b of ssData.bright){
    const tw=EGG_RM?1:.72+.28*Math.sin(t*1.7+b[4]);
    ssGlow(x2,b[0],b[1],b[2]*2.2,[214,222,255],[[0,b[3]*tw],[.5,b[3]*tw*.35],[1,0]]);
    ssSpike(x2,b[0],b[1],b[5]*tw,b[3]*.55*tw,false);
    ssSpike(x2,b[0],b[1],b[5]*.8*tw,b[3]*.5*tw,true);
  }
  if(!EGG_RM){ /* slow sweep highlight along the orbit arcs */
    const sa=-6.2832*t/S.ui.orbT;
    x2.save();x2.globalCompositeOperation="lighter";x2.lineWidth=1.2;
    x2.strokeStyle="rgba(165,140,255,"+S.ui.sweepA+")";
    for(const o of S.orbits){x2.beginPath();x2.ellipse(S.CX,S.CY,o[0],o[1],0,sa-.28,sa+.28);x2.stroke()}
    x2.restore();
  }
  const pos=ssPositions(t);
  const behind=[],front=[];
  for(const p of SS_SCENE.planets)(pos[p.n][1]<S.CY-4?behind:front).push(p);
  for(const p of behind)ssPlanet(x2,p,pos[p.n][0],pos[p.n][1],t);
  ssSun(x2,t);
  for(const p of front)ssPlanet(x2,p,pos[p.n][0],pos[p.n][1],t);
  if(!EGG_RM){ /* radar scan across the orbital plane, ~12s period */
    const ps=6.2832*t/S.ui.radarT;
    x2.save();x2.globalCompositeOperation="lighter";
    x2.translate(S.CX,S.CY);x2.scale(1,.34);x2.lineWidth=1;
    for(let k=0;k<22;k++){
      const a=ps-k*.012,al=S.ui.radarA*(1-k/22);
      x2.strokeStyle="rgba(124,227,168,"+al.toFixed(3)+")";
      x2.beginPath();x2.moveTo(Math.cos(a)*30,Math.sin(a)*30);x2.lineTo(Math.cos(a)*470,Math.sin(a)*470);x2.stroke();
    }
    x2.restore();
  }
  if(!EGG_RM&&ssGrainPat){ /* 1-2% animated grain */
    x2.save();x2.globalAlpha=.24;
    const ox=(Math.random()*120)|0,oy=(Math.random()*120)|0;
    x2.translate(-ox,-oy);x2.fillStyle=ssGrainPat;x2.fillRect(0,0,S.W+120,S.H+120);x2.restore();
  }
  ssSyncSvg(pos);
  ssBeltDrift(t);
  EggAudio.musicTick();
  ssAnim=EGG_RM?0:requestAnimationFrame(ssFrame);
}
function ssMenuStart(){
  const bg=document.getElementById("ss-bg"),dyn=document.getElementById("ss-dyn");
  if(!bg||!dyn||!bg.getContext||!SS_SCENE)return;
  if(!ssEls){
    try{ssBuildStatic(bg)}catch(e){return}
    ssEls=dyn.getContext("2d");
    ssInitSvg();
    ssT0=performance.now();
  }
  if(ssAnim)cancelAnimationFrame(ssAnim);
  ssAnim=requestAnimationFrame(ssFrame);
}
function ssMenuStop(){if(ssAnim){cancelAnimationFrame(ssAnim);ssAnim=0}}

/* -- asteroid belt: seeded clusters of dust + shaded rocks, slow drift ----
   Deterministic (ssPRNG seed 4242) so it renders identically every open.
   6 gaussian clusters + sparse stragglers give clumps-and-gaps density.
   Dust 0.5-1.2px; 30 rocks 2-3px built from a dark base disc + a sun-side
   highlight disc. Palette: dusty greys / mauves, ~7% warm specks.
   Drift: Keplerian-ish angular rates, driven from the scene rAF clock via
   ssBeltDrift(t) (throttled to ~10Hz; typed arrays, cached element refs,
   no per-frame collection allocations). Under prefers-reduced-motion the
   scene draws a single frame, so the belt stays static. */
let ssBeltSt=null;
function ssBeltBuild(belt){
  const NS="http://www.w3.org/2000/svg",R=ssPRNG(4242);
  const CL=[[0.35,.34,52],[1.45,.26,38],[2.35,.42,58],[3.55,.30,44],[4.45,.24,34],[5.50,.38,50]];
  const els=[],a0=[],rx=[],ry=[];
  function tone(){const t=R();
    if(t<.07)return[(214+R()*18)|0,(172+R()*22)|0,(138+R()*18)|0];
    if(t<.45)return[(168+R()*22)|0,(152+R()*20)|0,(198+R()*26)|0];
    return[(172+R()*34)|0,(168+R()*30)|0,(188+R()*28)|0]}
  function place(c){const a=c[0]+(R()+R()+R()-1.5)*c[1]*2,q=208+(R()+R()-1)*16;
    return[a,q,69*q/208+(R()-.5)*3]}
  function reg(el,a,qx,qy){belt.appendChild(el);els.push(el);a0.push(a);rx.push(qx);ry.push(qy)}
  for(const c of CL)for(let i=0;i<c[2];i++){ /* clustered dust */
    const pq=place(c),cc=tone(),el=document.createElementNS(NS,"circle");
    el.setAttribute("r",(0.5+R()*0.7).toFixed(2));
    el.setAttribute("fill","rgba("+cc[0]+","+cc[1]+","+cc[2]+","+(0.12+R()*0.32).toFixed(2)+")");
    reg(el,pq[0],pq[1],pq[2]);
  }
  for(let i=0;i<20;i++){ /* faint stragglers in the gaps */
    const a=R()*6.2832,q=208+(R()+R()-1)*20,cc=tone(),el=document.createElementNS(NS,"circle");
    el.setAttribute("r",(0.5+R()*0.5).toFixed(2));
    el.setAttribute("fill","rgba("+cc[0]+","+cc[1]+","+cc[2]+","+(0.10+R()*0.20).toFixed(2)+")");
    reg(el,a,q,69*q/208);
  }
  for(let i=0;i<30;i++){ /* 2-3px rocks, simple lit-side shading */
    const c=CL[(R()*CL.length)|0],pq=place(c),r=2+R(),cc=tone();
    const g=document.createElementNS(NS,"g"),b=document.createElementNS(NS,"circle"),h=document.createElementNS(NS,"circle");
    b.setAttribute("r",r.toFixed(2));
    b.setAttribute("fill","rgba("+((cc[0]*.55)|0)+","+((cc[1]*.55)|0)+","+((cc[2]*.62)|0)+","+(0.60+R()*0.30).toFixed(2)+")");
    h.setAttribute("cx",(-Math.cos(pq[0])*r*.34).toFixed(2));h.setAttribute("cy",(-Math.sin(pq[0])*r*.34).toFixed(2));
    h.setAttribute("r",(r*.52).toFixed(2));
    h.setAttribute("fill","rgba("+cc[0]+","+cc[1]+","+cc[2]+","+(0.50+R()*0.30).toFixed(2)+")");
    g.appendChild(b);g.appendChild(h);
    reg(g,pq[0],pq[1],pq[2]);
  }
  const w=new Float64Array(els.length);
  for(let i=0;i<els.length;i++)w[i]=0.021*Math.pow(208/rx[i],1.5);
  ssBeltSt={els,a0:new Float64Array(a0),rx:new Float64Array(rx),ry:new Float64Array(ry),w,t:-1};
  ssBeltDrift(0);
}
function ssBeltDrift(t){
  const B=ssBeltSt;
  if(!B||(B.t>=0&&t-B.t<0.1))return;
  B.t=t;
  for(let i=0;i<B.els.length;i++){
    const a=B.a0[i]+t*B.w[i];
    B.els[i].setAttribute("transform","translate("+(520+B.rx[i]*Math.cos(a)).toFixed(1)+","+(220+B.ry[i]*Math.sin(a)).toFixed(1)+")");
  }
}


/* --- Mission Control's map ------------------------------------------------
 * The map is now the three.js solar system in ./solar3d — imported here and
 * nowhere else, so neither three.js nor its 3 MB of textures is fetched until
 * someone opens Mission Control.
 *
 * The hand-drawn SVG map it replaced is *not* gone: it is still in the overlay
 * markup under #ss-legacy (hidden), and every function that drives it —
 * ssBeltBuild, ssMenuStart, ssMenuStop, the two canvas painters above — is
 * still here, untouched. ssLegacyStart() below is what reveals it, and it runs
 * whenever WebGL is unavailable or the three.js chunk fails to load. That is
 * the whole reason the old map was kept rather than deleted: without it, a
 * machine with no WebGL would have no way into the seven games.
 */
let solar3d=null,ssFallback=false;

function ssLegacyStart(){
  ssFallback=true;
  const host=document.getElementById("ss3d"),legacy=document.getElementById("ss-legacy");
  if(host)host.hidden=true;
  if(legacy)legacy.hidden=false;
  const svg=document.querySelector("#eggmenu .solsys");
  if(svg&&svg.pauseAnimations&&window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches)svg.pauseAnimations();
  const belt=document.getElementById("ss-belt");
  if(belt&&!belt.childNodes.length)ssBeltBuild(belt);
  ssMenuStart();
}

function ssMapStart(){
  if(ssFallback){ssMenuStart();return}
  const host=document.getElementById("ss3d");
  if(!host){ssLegacyStart();return}
  import("./solar3d").then(m=>{
    solar3d=m;
    return m.solarStart(host,{
      /* The pick layer speaks in eggLaunch route keys, same as the SVG map's
         inline onclick handlers did. */
      onLaunch:route=>eggLaunch(route),
      onDev:()=>{EggAudio.init();EggAudio.blip()},
      onHover:name=>{if(name)EggAudio.uiHover()},
      /* The chiptune sequencer is pull-based: musicTick() has to be called every
         frame by whoever is rendering, or the pattern never advances. It was
         only ever wired into the legacy 2D map, so on any machine that could run
         WebGL - i.e. all of them - eggMenu() armed the "polaris" track and
         nothing ever played it. This is that missing call. */
      onTick:()=>EggAudio.musicTick(),
    });
  }).then(ok=>{if(!ok)ssLegacyStart()}).catch(()=>ssLegacyStart());
}

/* Park the render loop whenever the map is not on screen — closing the modal,
   or dropping into a game. Reopening restarts it against the built scene. */
function ssMapStop(){
  if(solar3d)solar3d.solarStop();
}

/* Esc consults this first. A briefing panel is a layer inside Mission Control,
   so Esc should back out of it rather than close the whole thing. */
function ssMapDismiss(){
  return !!(solar3d&&solar3d.solarDismiss());
}

/* The X on a game modal is a step back to Mission Control, not the way out of
   the easter egg — the games are reached *through* the map, so closing one
   should land where it was launched from. This is what Esc has always done
   from inside a game; the X now agrees with it.
   #eggmenu's own X still calls eggMenuClose(): that one really is the exit. */
const EGG_GAME_CLOSERS={egg:eggClose,egg2:eggClose2,egg3:eggClose3,egg4:eggClose4,egg5:eggClose5,egg6:eggClose6,egg7:eggClose7,egg8:eggClose8,egg9:eggClose9,"egg-mars":eggCloseMars};
function eggBackToMenu(){
  const open=Object.keys(EGG_GAME_CLOSERS)
    .map(id=>document.getElementById(id))
    .find(n=>n&&n.style.display==="flex");
  if(open)EGG_GAME_CLOSERS[open.id]();
  eggMenu();
}

/* ---------------------------------------------------------------- the intro ---
   Finding Polaris opens on the retro Mersive logo film, and the system opens
   behind it once it has played. Three rules make that safe to ship:

     1. It never blocks. Anything that can go wrong with a video going wrong -
        no codec, a failed fetch, a browser that refuses to autoplay, a machine
        that just stalls - lands in eggIntroDone(), so the worst case is that the
        system opens immediately, which is the old behaviour.
     2. It is skippable, by the button, by clicking the film, or by Esc.
     3. Reduced motion skips it outright: seven seconds of animation is exactly
        what that preference is asking us not to do.

   The film is silent - the source's audio track measured -91 dB - so sound over
   it is a synth sting from EggAudio, and the score starts with the system. */
let eggIntroTimer=null,eggIntroFade=null,eggIntroRunning=false,eggIntroSeen=false;

function eggIntroDone(){
  if(!eggIntroRunning)return;
  eggIntroRunning=false;
  if(eggIntroTimer){clearTimeout(eggIntroTimer);eggIntroTimer=null}
  const box=document.getElementById("egg-intro");
  const v=document.getElementById("egg-intro-v");
  if(v){try{v.pause()}catch(e){}}
  /* The sting is scheduled ahead on the audio clock, so ending the film early has
     to close its bus - otherwise a skipped logo keeps playing its own fanfare over
     the solar system. */
  EggAudio.logoStingStop();
  if(box){
    box.classList.add("gone");
    /* hidden only after the fade, so the last frame does not snap away. The
       handle is kept because this timer outlives the film: leave and come back
       inside 420ms and it would otherwise fire onto the replay and hide a film
       that had just started - audible sting, black screen. */
    if(eggIntroFade)clearTimeout(eggIntroFade);
    eggIntroFade=setTimeout(()=>{
      eggIntroFade=null;box.hidden=true;box.classList.remove("gone");
    },EGG_RM?0:420);
  }
  /* The score belongs to the system, not to the logo. */
  EggAudio.music("polaris");
  ssMapStart();
}
function eggIntroSkip(){eggIntroDone()}

function eggIntroPlay(){
  const box=document.getElementById("egg-intro");
  const v=document.getElementById("egg-intro-v");
  /* Once per visit to the egg, not once per page load. Leaving for the page and
     coming back plays it again - it is the reveal, and finding Polaris a second
     time should feel the same as the first. What it must NOT do is replay on the
     way back from a game: eggMenu() is also eggBackToMenu()'s landing, and a title
     card between every game and the map is a toll booth. eggIntroSeen is therefore
     cleared by eggMenuClose() - closing the overlay - and not by anything else. */
  if(!box||!v||EGG_RM||eggIntroSeen){eggIntroRunning=true;eggIntroDone();return}
  eggIntroSeen=true;
  eggIntroRunning=true;
  /* Any pending hide from the previous run belongs to the previous run. */
  if(eggIntroFade){clearTimeout(eggIntroFade);eggIntroFade=null}
  box.hidden=false;box.classList.remove("gone");
  /* Computed path: a bare "/eggs/..." 404s under BASE_PATH on the Pages preview. */
  if(!v.getAttribute("src"))v.setAttribute("src",withBase("/eggs/mersive-logo.mp4"));
  v.currentTime=0;
  v.onended=eggIntroDone;
  v.onerror=eggIntroDone;
  /* The sting starts on `playing`, not on play(): the score is cued to the film's
     beats, and starting it a moment before the first frame would put every hit
     early by however long the browser took to decode. */
  v.onplaying=()=>EggAudio.logoSting();
  /* Belt and braces: the film is 7.2s, so anything still running at 9s has
     stalled and the system should open regardless. */
  eggIntroTimer=setTimeout(eggIntroDone,9000);
  /* A play() that lands too soon after the pause() from the last close rejects
     with AbortError - "interrupted by a call to pause" - and treating that as a
     failure would silently skip the film on a quick second visit, which is the
     exact path this replay exists for. One retry a beat later, and only then give
     up. Anything that is genuinely unplayable fails both times. */
  const start=(retry)=>{
    const p=v.play();
    if(p&&p.catch)p.catch(()=>{ retry ? setTimeout(()=>start(false),140) : eggIntroDone() });
  };
  start(true);
}

function eggMenu(){
  const el=document.getElementById("eggmenu");
  /* Reopening during the close fade: drop the timer and the class, or the
     pending display:none lands on a menu that is open again. */
  if(eggMenuFade){clearTimeout(eggMenuFade);eggMenuFade=null}
  el.classList.remove("closing");
  el.style.display="flex";
  EggAudio.init();EggAudio.ambientStart();eggSyncMute();
  document.getElementById("eggmenu-key").innerHTML=renderKey([["Drag","orbit"],["Scroll","zoom"],["Click","a world to play"],["M","mute"],["Esc","close"]]);
  eggIntroPlay();
}
/* easter egg 3: NETWORK INTERFERENCE — rebuilt invaders: drawn Polaris pod with
   thrust particles, enemy types (standard / jammer / splitter), FIREWALL boss
   every 4th wave with telegraphed sweeping beam, 3 link-integrity lives with
   respawn blink, wave banners, score popups, tiny screen-shake (RM-guarded).
   Pass A upgrades:
   - projectiles redrawn: standard glyphs fire jagged 2-frame animated amber
     static-bolts, jammers fire thin red beam-darts (1.6x fall speed); every
     shot leaves a small muzzle flash at the mount
   - power-ups are small display/monitor icons with distinct screen colors —
     relay shield GREEN · dual-beam PURPLE · LANCE TEAL · SWEEP AMBER — and
     fall with a slight sway; the HUD shows the active icon + countdown
   - LANCE (8s): the gun becomes a piercing column beam — one full column per
     shot, deeper zap voice · SWEEP (10s): main gun plus two ±25° diagonals
   Art pass B (aliens + alien fire only): the swarm and its shots render as
   PAL pixel sprites (EGG_ART inv_* maps, mkSprite x2, compiled once per
   run) — crab GLYPH / dish-mast JAMMER / twin-lobe SPLITTER / one-eyed
   fragment, 2 frames each; bolts and darts are 2-frame sprites with a 2px
   afterglow; dead glyphs pop a white flash-sprite + lavender debris. */
let egg3Anim=null,egg3Keys=null,egg3Best=0;
function eggOpen3(){
  document.getElementById("egg3").style.display="flex";
  EggAudio.init();EggAudio.ambientStart();eggSyncMute();
  document.getElementById("egg3-key").innerHTML=renderKey([["← →","move"],["Space","fire"],["P","pause"],["M","mute"],["Esc","mission control"]]);
  eggInvadeRun();
}
function eggInvadeRun(){
  const W=880,H=520,c=document.getElementById("egg3c"),x=eggCanvas("egg3c",W,H);
  eggEndDismiss();
  if(egg3Anim){cancelAnimationFrame(egg3Anim);egg3Anim=null}
  if(egg3Keys){removeEventListener("keydown",egg3Keys);removeEventListener("keyup",egg3Keys)}
  const PY=H-42,PW=36;
  let px=W/2,score=0,lives=3,wave=1,alive=true,paused=false;
  let enemies=[],shots=[],bombs=[],pups=[],parts=[],floats=[],beams=[],flashes=[];
  let dir=1,boss=null,bossN=0,banner=null,waveDelay=0,waveTotal=1,raider=null,raiderT=9,missile=null,missileCd=5;
  let invuln=0,shield=false,dualT=0,slowT=0,lanceT=0,sweepT=0,hazardsOn=true;
  let fireCd=0,thrustCd=0,bombT=0,shake=0,last=null,elapsed=0;
  const keys={};
  const slow=()=>slowT>0?.45:1;
  const ECOL={std:"#e8a184",jam:"#e8c76a",split:"#a58cff",small:"#c9b6ff"};
  /* art pass: PAL pixel sprites compiled once per run — nothing allocates in the rAF loop */
  const INVS={},INVW={};
  /* aliens render 25% larger: 2.5x pixel cells, integer-rounded per cell so edges stay crisp */
  function px25(rows,flash){
    const w=rows[0].length,h=rows.length,cv=document.createElement("canvas");
    cv.width=Math.round(w*2.5);cv.height=Math.round(h*2.5);
    const g=cv.getContext("2d");
    for(let yy=0;yy<h;yy++)for(let xx=0;xx<w;xx++){
      const ch=rows[yy][xx];
      if(ch===".")continue;
      g.fillStyle=flash?"#ffffff":PAL[PXC[ch]];
      const x0=Math.round(xx*2.5),y0=Math.round(yy*2.5);
      g.fillRect(x0,y0,Math.round((xx+1)*2.5)-x0,Math.round((yy+1)*2.5)-y0);
    }
    return cv;
  }
  ["std","jam","split","small"].forEach(k=>{INVS[k]=EGG_ART["inv_"+k].map(f=>px25(f,false));INVW[k]=EGG_ART["inv_"+k].map(f=>px25(f,true))});
  const ESZ={std:[INVS.std[0].width,INVS.std[0].height],jam:[INVS.jam[0].width,INVS.jam[0].height],split:[INVS.split[0].width,INVS.split[0].height],small:[INVS.small[0].width,INVS.small[0].height]};
  const BOLTS={static:EGG_ART.inv_bolt.map(f=>mkSprite(f,2)),dart:EGG_ART.inv_dart.map(f=>mkSprite(f,2))};
  const RAID=EGG_ART.inv_boss.map(f=>px25(f,false)),RAIDW=EGG_ART.inv_boss.map(f=>px25(f,true));
  const MISS=EGG_ART.inv_missile.map(f=>mkSprite(f,2));
  const EVAL={std:10,jam:20,split:15,small:5};
  function popText(tx,ty,txt,col){floats.push({x:tx,y:ty,txt,col,a:1})}
  function sparks(bx,by,col,n){if(EGG_RM)return;for(let i=0;i<(n||10);i++)parts.push({x:bx,y:by,vx:(Math.random()-.5)*200,vy:(Math.random()-.7)*180,a:1,col})}
  function shakeIt(n){if(!EGG_RM)shake=Math.max(shake,n)}
  function spawnWave(){
    enemies=[];bombs=[];dir=1;bombT=0;raider=null;
    if(wave%4===0){
      bossN++;
      const hp=25+(bossN-1)*8;
      boss={x:W/2,y:66,w:360,h:30,hp,maxHp:hp,t:0,cool:3,beam:null};
      banner={txt:"FIREWALL DETECTED",sub:"segmented core — dodge the telegraphed sweep",t:0,col:"#e8a184"};
    }else{
      boss=null;
      const rows=Math.min(5,3+Math.floor((wave-1)/3)),cols=8,sx=(W-(cols-1)*64)/2;
      for(let r=0;r<rows;r++)for(let q=0;q<cols;q++){
        let type="std";
        if(wave>=3&&r===0&&q%3===1)type="split";
        else if(wave>=2&&(q+r)%5===4)type="jam";
        enemies.push({x:sx+q*64,y:66+r*44,w:ESZ[type][0],h:ESZ[type][1],type});
      }
      banner={txt:"WAVE "+wave,sub:null,t:0,col:"#a58cff"};
    }
    waveTotal=Math.max(1,enemies.length);
  }
  const PUPCOL={shield:"#7ce3a8",dual:"#a58cff",lance:"#4fc3d9",sweep:"#e8c76a"};
  function applyPup(k){
    EggAudio.blip();
    if(k==="shield"){shield=true;popText(px,PY-40,"RELAY SHIELD","#7ce3a8")}
    else if(k==="dual"){dualT=10;popText(px,PY-40,"DUAL BEAM 10s","#a58cff")}
    else if(k==="lance"){lanceT=8;popText(px,PY-40,"LANCE 8s","#4fc3d9")}
    else if(k==="sweep"){sweepT=10;popText(px,PY-40,"SWEEP 10s","#e8c76a")}
    else{slowT=5;popText(px,PY-40,"SLOW TIME 5s","#4fc3d9")}
  }
  /* alien projectiles now spawn through one gate: bolt kind + muzzle flash */
  function dropBomb(bx,by,kind,v){
    bombs.push({x:bx,y:by,v,kind});
    if(!EGG_RM)flashes.push({x:bx,y:by,t:.12});
  }
  function killEnemy(i){
    const s=enemies.splice(i,1)[0];
    if(!s)return;
    const val=EVAL[s.type];
    score+=val;document.getElementById("egg3s").textContent=score;
    popText(s.x,s.y-10,"+"+val,ECOL[s.type]);
    sparks(s.x,s.y,ECOL[s.type],12);
    sparks(s.x,s.y,"#e2d9ff",5);
    if(!EGG_RM)flashes.push({x:s.x,y:s.y,t:.12,img:INVW[s.type][0]});
    EggAudio.explode(s.type==="small"?.15:s.type==="split"?.45:s.type==="jam"?.4:.3);
    shakeIt(2);
    if(s.type==="split"){
      enemies.push({x:s.x-16,y:s.y,w:ESZ.small[0],h:ESZ.small[1],type:"small"},{x:s.x+16,y:s.y,w:ESZ.small[0],h:ESZ.small[1],type:"small"});
    }else if(Math.random()<.15){
      pups.push({x:s.x,y:s.y,k:["shield","dual","lance","sweep"][Math.floor(Math.random()*4)]});
    }
  }
  function bossDie(){
    if(!boss)return;
    sparks(boss.x,boss.y,"#e8a184",30);sparks(boss.x-boss.w/3,boss.y,"#e8c76a",16);sparks(boss.x+boss.w/3,boss.y,"#e8c76a",16);shakeIt(8);
    EggAudio.explode(1);
    const bV=250+100*(bossN-1);
    score+=bV;document.getElementById("egg3s").textContent=score;
    popText(boss.x,boss.y+24,"+"+bV+" FIREWALL DOWN","#7ce3a8");
    pups.push({x:boss.x-40,y:boss.y,k:"shield"},{x:boss.x+40,y:boss.y,k:["dual","lance","sweep"][Math.floor(Math.random()*3)]});
    boss=null;
  }
  function hitPlayer(force){
    if(!alive)return;
    if(!force&&invuln>0)return;
    if(shield){shield=false;invuln=1;EggAudio.blip();popText(px,PY-34,"SHIELD DOWN","#7ce3a8");return}
    lives--;document.getElementById("egg3l").textContent=lives;
    EggAudio.explode(.55);sparks(px,PY,"#e8a184",18);shakeIt(6);
    invuln=2.2;
    if(lives<=0)gameOver();
  }
  function gameOver(){
    if(!alive)return;
    alive=false;
    egg3Best=Math.max(egg3Best,score);document.getElementById("egg3b").textContent=egg3Best;
    EggAudio.gameOver();
    eggEndScreen({host:c.parentElement,title:"The interference reached the room.",
      lines:["Signals cleared: "+score+" · wave "+wave,"Session best "+egg3Best],
      onReplay:eggInvadeRun,onMenu:()=>{eggClose3();eggMenu()}});
  }
  egg3Keys=e=>{
    if(document.getElementById("egg3").style.display!=="flex")return;
    if(["ArrowLeft","ArrowRight"," "].includes(e.key))e.preventDefault();
    if(e.type==="keydown"&&(e.key==="p"||e.key==="P")&&alive){paused=!paused;return}
    keys[e.key]=e.type==="keydown";
  };
  addEventListener("keydown",egg3Keys);addEventListener("keyup",egg3Keys);
  function fire(){
    if(lanceT>0){ /* LANCE: one piercing column beam at a time */
      if(beams.length)return;
      beams.push({x:px,t:.2,hitBoss:false});
      EggAudio.laser("lance");
      return;
    }
    const cap=(dualT>0?6:3)+(sweepT>0?6:0);
    if(shots.length>=cap)return;
    if(dualT>0)shots.push({x:px-11,y:PY-20},{x:px+11,y:PY-20});
    else shots.push({x:px,y:PY-22});
    if(sweepT>0)shots.push({x:px,y:PY-22,vx:-194,vy:417},{x:px,y:PY-22,vx:194,vy:417}); /* ±25° */
    EggAudio.laser();
  }
  function update(dt){
    elapsed+=dt;
    if(invuln>0)invuln-=dt;
    if(dualT>0)dualT-=dt;
    if(slowT>0)slowT-=dt;
    if(lanceT>0)lanceT-=dt;
    if(sweepT>0)sweepT-=dt;
    if(shake>0)shake=Math.max(0,shake-dt*14);
    if(banner)banner.t+=dt;
    // pod
    const mv=(keys.ArrowRight?1:0)-(keys.ArrowLeft?1:0);
    if(mv!==0){
      px=Math.max(24,Math.min(W-24,px+mv*330*dt));
      thrustCd-=dt;
      if(thrustCd<=0){EggAudio.thrust();thrustCd=.3}
      if(!EGG_RM&&Math.random()<.7)parts.push({x:px-mv*14,y:PY+8,vx:-mv*90+(Math.random()-.5)*30,vy:30+Math.random()*40,a:.8,col:"#8f7ae0"});
    }
    fireCd-=dt;
    if(keys[" "]&&fireCd<=0){fire();fireCd=lanceT>0?.5:.25}
    // wave sequencing
    if(!enemies.length&&!boss&&waveDelay===0){
      wave++;document.getElementById("egg3w").textContent=wave;
      EggAudio.levelUp();waveDelay=1.3;
      banner={txt:"CHANNEL CLEAR",sub:null,t:0,col:"#7ce3a8"};
    }
    if(waveDelay>0){waveDelay-=dt;if(waveDelay<=0){waveDelay=0;spawnWave()}}
    // swarm march
    if(enemies.length){
      const sp=(24+wave*6+(waveTotal-enemies.length)*2.2)*slow();
      let edge=false;
      enemies.forEach(s=>{s.x+=dir*sp*dt;if(s.x-s.w/2<16||s.x+s.w/2>W-16)edge=true});
      if(edge){dir*=-1;enemies.forEach(s=>{s.y+=16;s.x+=dir*3})}
      if(enemies.some(s=>s.y+s.h/2>PY-30))return gameOver();
    }
    // boss motion + telegraphed sweeping beam
    if(boss){
      boss.t+=dt*slow();
      boss.x=W/2+Math.sin(boss.t*.55)*(W/2-240);
      if(boss.beam){
        boss.beam.t+=dt;
        if(boss.beam.phase==="tele"&&boss.beam.t>=.9){boss.beam.phase="fire";boss.beam.t=0;EggAudio.explode(.25)}
        else if(boss.beam.phase==="fire"){
          if(Math.abs(px-boss.beam.x)<32)hitPlayer();
          if(boss.beam.t>=.5)boss.beam=null;
        }
      }else if(hazardsOn){
        boss.cool-=dt*slow();
        if(boss.cool<=0){boss.beam={phase:"tele",t:0,x:px};boss.cool=4.2;EggAudio.blip()}
      }
    }
    // SIGNAL RAIDER: rare boss-class carrier (wave 10+) + parabolic missile
    if(missileCd>0)missileCd-=dt;
    if(wave>=10&&!raider&&!boss&&enemies.length&&waveDelay===0){
      raiderT-=dt;
      if(raiderT<=0){
        const side=Math.random()<.5?-1:1;
        raider={x:side<0?-40:W+40,y:30,vx:side<0?66:-66,hp:8,wind:0,t:0};
        raiderT=11+Math.random()*7;
        banner={txt:"SIGNAL RAIDER",sub:"boss-class carrier \u2014 it stays until you destroy it \u00b7 +300 \u00b7 missiles +75",t:0,col:"#e8a184"};
        EggAudio.bossWarn();
      }
    }
    if(raider){
      raider.t+=dt;
      if(raider.wind>0){ /* telegraphed wind-up: the carrier halts and flashes before launch */
        raider.wind-=dt;
        if(raider.wind<=0&&!missile){
          missile={x:raider.x,y:raider.y+16,vx:Math.max(-140,Math.min(140,(px-raider.x)*.35)),vy:30,g:230};
          missileCd=14; /* cadence floor between launches */
          EggAudio.laser("sub");EggAudio.thrust(); /* soft launch cue through existing voices */
          if(!EGG_RM)flashes.push({x:raider.x,y:raider.y+16,t:.12});
        }
      }else{
        raider.x+=raider.vx*slow()*dt;
        if(raider.x<-50&&raider.vx<0)raider.vx=Math.abs(raider.vx);
        else if(raider.x>W+50&&raider.vx>0)raider.vx=-Math.abs(raider.vx);
        else if(hazardsOn&&!missile&&missileCd<=0&&raider.x>W*.16&&raider.x<W*.84){raider.wind=.8;EggAudio.blip()}
      }
    }
    if(missile){ /* parabola: constant horizontal velocity, gravity pulls it down */
      missile.vy+=missile.g*slow()*dt;
      missile.x+=missile.vx*slow()*dt;
      missile.y+=missile.vy*slow()*dt;
      if(missile.y>PY-16&&missile.y<PY+16&&Math.abs(missile.x-px)<PW/2+8){hitPlayer();missile=null}
      else if(missile.y>H+24||missile.x<-30||missile.x>W+30)missile=null;
    }
    // enemy static bombs
    if(hazardsOn&&(enemies.length||boss)){
      bombT+=dt*1000*slow();
      const iv=boss?700:Math.max(340,1150-wave*80);
      if(bombT>=iv){
        bombT=0;
        if(boss)dropBomb(boss.x+(Math.random()-.5)*boss.w*.8,boss.y+boss.h/2,"static",150);
        else{
          const pool=[];
          enemies.forEach(s=>{pool.push(s);if(s.type==="jam")pool.push(s,s)});
          const s=pool[Math.floor(Math.random()*pool.length)];
          if(s.type==="jam")dropBomb(s.x,s.y+s.h/2,"dart",(120+wave*11)*1.6);
          else dropBomb(s.x,s.y+s.h/2,"static",120+wave*11);
        }
      }
    }
    bombs.forEach(b=>{b.y+=b.v*slow()*dt});
    bombs=bombs.filter(b=>{
      if(b.y>PY-14&&b.y<PY+14&&Math.abs(b.x-px)<PW/2+4){hitPlayer();return false}
      return b.y<H+12;
    });
    // packets away
    shots.forEach(s=>{s.y-=(s.vy||460)*dt;if(s.vx)s.x+=s.vx*dt});
    /* LANCE beams pierce one full column while they live */
    beams.forEach(b=>{
      b.t-=dt;
      if(missile&&Math.abs(b.x-missile.x)<12){
        popText(missile.x,missile.y,"+75 MISSILE DOWN","#e8c76a");sparks(missile.x,missile.y,"#e8c76a",10);
        missile=null;score+=75;document.getElementById("egg3s").textContent=score;EggAudio.explode(.5);
      }
      for(let i=enemies.length-1;i>=0;i--)if(Math.abs(enemies[i].x-b.x)<12)killEnemy(i);
      if(boss&&!b.hitBoss&&Math.abs(b.x-boss.x)<boss.w/2){
        b.hitBoss=true;boss.hp-=4;sparks(b.x,boss.y+boss.h/2,"#4fc3d9",8);EggAudio.blip();
        if(boss.hp<=0)bossDie();
      }
    });
    beams=beams.filter(b=>b.t>0);
    flashes.forEach(fz=>{fz.t-=dt});
    flashes=flashes.filter(fz=>fz.t>0);
    shots=shots.filter(s=>{
      if(missile&&Math.abs(s.x-missile.x)<12&&Math.abs(s.y-missile.y)<16){
        missile=null;score+=75;document.getElementById("egg3s").textContent=score;
        popText(s.x,s.y,"+75 MISSILE DOWN","#e8c76a");sparks(s.x,s.y,"#e8c76a",10);EggAudio.explode(.5);shakeIt(3);
        return false;
      }
      if(raider&&Math.abs(s.x-raider.x)<RAID[0].width/2&&s.y<raider.y+RAID[0].height/2&&s.y>raider.y-RAID[0].height/2-6){
        raider.hp--;sparks(s.x,raider.y+12,"#a58cff",5);EggAudio.blip();
        if(raider.hp<=0){
          score+=300;document.getElementById("egg3s").textContent=score;
          popText(raider.x,raider.y,"+300 RAIDER DOWN","#a58cff");
          sparks(raider.x,raider.y,"#e8a184",20);shakeIt(5);EggAudio.explode(.8);
          if(!EGG_RM)flashes.push({x:raider.x,y:raider.y,t:.12,img:RAIDW[0]});
          pups.push({x:raider.x,y:raider.y,k:["shield","dual","lance","sweep"][Math.floor(Math.random()*4)]});
          raider=null;
        }
        return false;
      }
      if(boss&&Math.abs(s.x-boss.x)<boss.w/2&&s.y<boss.y+boss.h/2&&s.y>boss.y-boss.h/2-6){
        boss.hp--;sparks(s.x,boss.y+boss.h/2,"#e8c76a",5);EggAudio.blip();
        if(boss.hp<=0)bossDie();
        return false;
      }
      for(let i=0;i<enemies.length;i++){
        const v=enemies[i];
        if(Math.abs(s.x-v.x)<v.w/2+2&&s.y<v.y+v.h/2&&s.y>v.y-v.h/2-8){killEnemy(i);return false}
      }
      return s.y>-12&&s.x>-16&&s.x<W+16;
    });
    // power-ups drift down with a slight sway
    pups.forEach(p=>{
      p.y+=95*dt;
      p.sw=(p.sw||0)+dt;
      if(p.x0==null)p.x0=p.x;
      p.x=p.x0+Math.sin(p.sw*2.2+(p.ph||(p.ph=p.x0%6.28)))*7;
    });
    pups=pups.filter(p=>{
      if(p.y>PY-18&&p.y<PY+16&&Math.abs(p.x-px)<PW/2+12){applyPup(p.k);return false}
      return p.y<H+12;
    });
    // fx
    parts.forEach(p=>{p.x+=p.vx*dt;p.y+=p.vy*dt;p.a-=dt*1.7});
    parts=parts.filter(p=>p.a>0);
    floats.forEach(f=>{f.y-=30*dt;f.a-=dt*.85});
    floats=floats.filter(f=>f.a>0);
  }
  /* power-ups are small displays: casing, colored screen, glint, stand */
  function drawPupIcon(ix,iy,k,s){
    const col=PUPCOL[k]||"#4fc3d9";
    ix=Math.round(ix);iy=Math.round(iy);
    x.fillStyle="#241c45";x.fillRect(ix-10*s,iy-8*s,20*s,13*s);
    x.strokeStyle=col;x.lineWidth=1;x.strokeRect(ix-10*s,iy-8*s,20*s,13*s);
    x.fillStyle=col;x.fillRect(ix-8*s,iy-6*s,16*s,9*s);
    x.fillStyle="rgba(255,255,255,.55)";x.fillRect(ix-7*s,iy-5*s,4*s,2*s);
    x.fillStyle="#241c45";x.fillRect(ix-2*s,iy+5*s,4*s,3*s);
    x.fillStyle="#3a2f6b";x.fillRect(ix-6*s,iy+8*s,12*s,2*s);
  }
  function drawEnemy(s){ /* 2-frame pixel sprite, marching in sync */
    const img=INVS[s.type][Math.floor(elapsed*3)%2];
    drawSpr(x,img,s.x-img.width/2,s.y-img.height/2);
  }
  function draw(){
    x.save();
    if(shake>0&&!EGG_RM)x.translate((Math.random()-.5)*shake*1.6,(Math.random()-.5)*shake*1.2);
    x.fillStyle="#0b0918";x.fillRect(-10,-10,W+20,H+20);
    x.fillStyle="rgba(165,140,255,.12)";
    for(let i=0;i<40;i++)x.fillRect((i*97+elapsed*10)%W,(i*53)%H,1.6,1.6);
    if(slowT>0){x.strokeStyle="rgba(79,195,217,.45)";x.lineWidth=3;x.strokeRect(4,4,W-8,H-8)}
    x.strokeStyle="rgba(165,140,255,.25)";x.lineWidth=1;x.beginPath();x.moveTo(0,H-22);x.lineTo(W,H-22);x.stroke();
    if(boss){
      const segs=12,sw=boss.w/segs;
      for(let i=0;i<segs;i++){
        const on=i<Math.ceil(segs*boss.hp/boss.maxHp);
        x.fillStyle=on?"#e8a184":"rgba(232,161,132,.15)";
        x.beginPath();x.roundRect(boss.x-boss.w/2+i*sw+2,boss.y-boss.h/2,sw-4,boss.h,5);x.fill();
      }
      x.fillStyle="#0b0918";
      for(let i=0;i<4;i++)x.fillRect(boss.x-30+i*18,boss.y-3,8,6);
      x.fillStyle="#e8c76a";x.font="700 9px Poppins,sans-serif";x.textAlign="center";
      x.fillText("FIREWALL · "+boss.hp+"/"+boss.maxHp,boss.x,boss.y-boss.h/2-8);
      if(boss.beam){
        const bx=boss.beam.x,by=boss.y+boss.h/2;
        if(boss.beam.phase==="tele"){
          x.globalAlpha=.14+.14*Math.sin(boss.beam.t*22);
          x.fillStyle="#e8c76a";x.fillRect(bx-30,by,60,H-by-22);
          x.globalAlpha=1;
          x.fillStyle="#e8c76a";x.font="700 10px Poppins,sans-serif";x.textAlign="center";x.fillText("⚠ SWEEP",bx,H-90);
        }else{
          x.globalAlpha=.75;x.fillStyle="#e8a184";x.fillRect(bx-26,by,52,H-by-22);
          x.globalAlpha=.9;x.fillStyle="#fff";x.fillRect(bx-5,by,10,H-by-22);
          x.globalAlpha=1;
        }
      }
    }
    enemies.forEach(drawEnemy);
    if(raider){ /* boss-class carrier: 2-frame sprite, hp pips, wind-up telegraph (steady under RM) */
      const rimg=RAID[Math.floor(elapsed*3)%2];
      drawSpr(x,rimg,raider.x-rimg.width/2,raider.y-rimg.height/2);
      x.fillStyle="#e8a184";
      for(let i=0;i<raider.hp;i++)x.fillRect(raider.x-23+i*6,raider.y-rimg.height/2-7,4,3);
      if(raider.wind>0){
        x.globalAlpha=EGG_RM?.5:.35+.25*Math.sin(elapsed*26);
        x.fillStyle="#e8c76a";x.beginPath();x.arc(raider.x,raider.y+15,10,0,7);x.fill();
        x.globalAlpha=1;
        x.fillStyle="#e8c76a";x.font="700 10px Poppins,sans-serif";x.textAlign="center";
        x.fillText("\u26a0 MISSILE",raider.x,raider.y+38);
      }
    }
    if(missile){ /* finned missile: nose along the velocity vector, 2-frame exhaust + afterglow */
      x.globalAlpha=.35;x.fillStyle="#e8c76a";
      x.fillRect(Math.round(missile.x-missile.vx*.05)-2,Math.round(missile.y-missile.vy*.05)-2,4,4);
      x.globalAlpha=1;
      const mimg=MISS[((elapsed*10)|0)%2];
      x.save();x.translate(Math.round(missile.x),Math.round(missile.y));
      x.rotate(Math.atan2(missile.vy,missile.vx)-Math.PI/2);
      x.drawImage(mimg,-mimg.width/2,-mimg.height/2);
      x.restore();
    }
    bombs.forEach(b=>{ /* alien fire: 2-frame PAL sprites + 2px afterglow trail */
      const fr=BOLTS[b.kind==="dart"?"dart":"static"],img=fr[((elapsed*12)|0)%fr.length];
      x.globalAlpha=.3;
      x.fillStyle=b.kind==="dart"?"#c0402a":"#e8c76a";
      x.fillRect(Math.round(b.x)-1,Math.round(b.y-img.height/2)-5,2,5);
      x.globalAlpha=1;
      drawSpr(x,img,b.x-img.width/2,b.y-img.height/2);
    });
    flashes.forEach(fz=>{ /* muzzle cross at the mount · white sprite pop on death */
      x.globalAlpha=Math.max(0,fz.t/.12);
      if(fz.img)drawSpr(x,fz.img,fz.x-fz.img.width/2,fz.y-fz.img.height/2);
      else{
        x.fillStyle="#fff3cf";x.fillRect(fz.x-1.5,fz.y-1.5,3,3);
        x.strokeStyle="#e8c76a";x.lineWidth=1;x.beginPath();
        x.moveTo(fz.x-5,fz.y);x.lineTo(fz.x+5,fz.y);x.moveTo(fz.x,fz.y-5);x.lineTo(fz.x,fz.y+5);x.stroke();
      }
      x.globalAlpha=1;
    });
    x.fillStyle="#7ce3a8";
    shots.forEach(s=>x.fillRect(s.x-1.5,s.y-8,3,9));
    beams.forEach(b=>{ /* LANCE column */
      x.globalAlpha=.25+.5*Math.max(0,b.t/.2);
      x.fillStyle="#4fc3d9";x.fillRect(b.x-3,0,6,PY-14);
      x.globalAlpha=.9;x.fillStyle="#eafcff";x.fillRect(b.x-1,0,2,PY-14);
      x.globalAlpha=1;
    });
    pups.forEach(p=>drawPupIcon(p.x,p.y,p.k,1));
    // the Polaris pod
    const blink=invuln>0&&!EGG_RM&&Math.floor(elapsed*9)%2===0;
    x.globalAlpha=blink?.3:(invuln>0&&EGG_RM?.6:1);
    x.fillStyle="#241c45";x.strokeStyle="#8f7ae0";x.lineWidth=2;
    x.beginPath();x.moveTo(px,PY-18);x.lineTo(px+15,PY+2);x.lineTo(px+10,PY+10);x.lineTo(px-10,PY+10);x.lineTo(px-15,PY+2);x.closePath();x.fill();x.stroke();
    x.fillStyle="#7ce3a8";x.beginPath();x.arc(px,PY-5,3,0,7);x.fill();
    if(dualT>0){x.fillStyle="#a58cff";x.fillRect(px-15,PY-13,3,8);x.fillRect(px+12,PY-13,3,8)}
    x.globalAlpha=1;
    if(shield){x.strokeStyle="rgba(124,227,168,.7)";x.lineWidth=2;x.beginPath();x.arc(px,PY-3,25,0,7);x.stroke()}
    parts.forEach(p=>{x.globalAlpha=Math.max(0,p.a);x.fillStyle=p.col;x.fillRect(p.x,p.y,2.6,2.6)});
    x.globalAlpha=1;
    floats.forEach(f=>{x.globalAlpha=Math.max(0,Math.min(1,f.a));x.fillStyle=f.col;x.font="700 12px Poppins,sans-serif";x.textAlign="center";x.fillText(f.txt,f.x,f.y)});
    x.globalAlpha=1;
    if(banner&&banner.t<1.6){
      const k=banner.t<.3?banner.t/.3:banner.t>1.2?(1.6-banner.t)/.4:1;
      x.globalAlpha=Math.max(0,k);
      x.fillStyle=banner.col;x.font="700 26px Poppins,sans-serif";x.textAlign="center";
      x.fillText(banner.txt,W/2,180);
      if(banner.sub){x.fillStyle="#8f85b8";x.font="11px Poppins,sans-serif";x.fillText(banner.sub,W/2,202)}
      x.globalAlpha=1;
    }
    x.textAlign="left";x.font="700 10px Poppins,sans-serif";
    let ty=H-14;
    if(dualT>0){drawPupIcon(18,ty,"dual",.7);x.fillStyle="#a58cff";x.fillText("DUAL "+Math.ceil(dualT)+"s",32,ty+4);ty-=20}
    if(lanceT>0){drawPupIcon(18,ty,"lance",.7);x.fillStyle="#4fc3d9";x.fillText("LANCE "+Math.ceil(lanceT)+"s",32,ty+4);ty-=20}
    if(sweepT>0){drawPupIcon(18,ty,"sweep",.7);x.fillStyle="#e8c76a";x.fillText("SWEEP "+Math.ceil(sweepT)+"s",32,ty+4);ty-=20}
    if(slowT>0){x.fillStyle="#4fc3d9";x.fillText("SLOW "+Math.ceil(slowT)+"s",32,ty+4);ty-=20}
    if(shield){drawPupIcon(18,ty,"shield",.7);x.fillStyle="#7ce3a8";x.fillText("SHIELD",32,ty+4)}
    x.restore();
    if(paused)eggPauseOverlay(x,W,H);
  
    crtPass(x);   /* phosphor halo - see crtPass() */
  }
  function loop(ts){
    if(!alive)return;
    if(document.getElementById("egg3").style.display!=="flex"){egg3Anim=null;return}
    const now=ts!=null?ts:(window.performance&&performance.now?performance.now():Date.now());
    if(last==null)last=now;
    const dt=Math.min(.05,(now-last)/1000);last=now;
    if(!paused)update(dt);
    if(alive)draw();
    if(alive)egg3Anim=requestAnimationFrame(loop);
  }
  window.__eggDbg={game:"invade",
    state:()=>({score,lives,wave,alive,paused,px,enemies:enemies.length,boss:!!boss,bossHp:boss?boss.hp:0,shots:shots.length,pups:pups.length,shield,dualT,slowT,lanceT,sweepT,beams:beams.length,bombs:bombs.length,flashes:flashes.length,waveDelay,raider:!!raider,raiderHp:raider?raider.hp:0,raiderWind:raider?raider.wind:0,missile:!!missile,missileCd,raiderT}),
    enemiesList:()=>enemies.map(e=>({x:e.x,y:e.y,w:e.w,h:e.h,type:e.type})),
    shotsList:()=>shots.map(s=>({x:s.x,y:s.y,vx:s.vx||0,vy:s.vy||460})),
    bombsList:()=>bombs.map(b=>({x:b.x,y:b.y,kind:b.kind})),
    sprInfo:()=>({types:Object.keys(INVS),stdW:INVS.std[0].width,stdH:INVS.std[0].height,smallW:INVS.small[0].width,smallH:INVS.small[0].height,flashTypes:Object.keys(INVW),boltFrames:BOLTS.static.length,dartFrames:BOLTS.dart.length,boltW:BOLTS.static[0].width,dartW:BOLTS.dart[0].width,boltHs:BOLTS.static.map(f=>f.height),dartHs:BOLTS.dart.map(f=>f.height),bossW:RAID[0].width,bossH:RAID[0].height,bossFrames:RAID.length,missileFrames:MISS.length}),
    invPhase:()=>Math.floor(elapsed*3)%2,
    pupsList:()=>pups.map(p=>({x:p.x,y:p.y,k:p.k})),
    pupCols:()=>PUPCOL,
    dropBomb:(k,bx,by)=>dropBomb(bx!=null?bx:W/2,by!=null?by:80,k,150),
    spawnPup:(k,sx,sy)=>pups.push({x:sx!=null?sx:W/2,y:sy!=null?sy:60,k}),
    clearShots:()=>{shots=[];beams=[]},
    setX:v=>{px=v},
    killOne:()=>{if(enemies.length)killEnemy(0)},
    clearWave:()=>{let g=200;while(enemies.length&&g-->0)killEnemy(0);if(boss){boss.hp=0;bossDie()}},
    damageBoss:n=>{if(boss){boss.hp-=n;if(boss.hp<=0)bossDie()}},
    hit:f=>hitPlayer(f),
    givePup:k=>applyPup(k),
    setHazards:v=>{hazardsOn=!!v},
    setLives:v=>{lives=v;document.getElementById("egg3l").textContent=lives},
    setRaiderT:v=>{raiderT=v},
    setMissileCd:v=>{missileCd=v},
    spawnRaider:side=>{raider={x:side<0?-40:W+40,y:30,vx:side<0?66:-66,hp:6,wind:0,t:0}},
    raiderInfo:()=>raider?{x:raider.x,y:raider.y,vx:raider.vx,hp:raider.hp,wind:raider.wind}:null,
    missileInfo:()=>missile?{x:missile.x,y:missile.y,vx:missile.vx,vy:missile.vy}:null,
    killMissile:()=>{missile=null},
    boltPhase:()=>((elapsed*12)|0)%BOLTS.static.length,
    esize:()=>({std:ESZ.std.slice(),jam:ESZ.jam.slice(),split:ESZ.split.slice(),small:ESZ.small.slice()})};
  document.getElementById("egg3s").textContent="0";
  document.getElementById("egg3w").textContent="1";
  document.getElementById("egg3l").textContent="3";
  document.getElementById("egg3b").textContent=egg3Best;
  spawnWave();
  egg3Anim=requestAnimationFrame(loop);
}
function eggClose3(){
  document.getElementById("egg3").style.display="none";
  if(egg3Anim){cancelAnimationFrame(egg3Anim);egg3Anim=null}
  if(egg3Keys){removeEventListener("keydown",egg3Keys);removeEventListener("keyup",egg3Keys);egg3Keys=null}
  eggEndDismiss();EggAudio.ambientStop();
}
function eggClose2(){
  document.getElementById("egg2").style.display="none";
  if(egg2Anim){cancelAnimationFrame(egg2Anim);egg2Anim=null}
  if(egg2Keys){removeEventListener("keydown",egg2Keys);removeEventListener("keyup",egg2Keys);egg2Keys=null}
  eggEndDismiss();EggAudio.ambientStop();
}
/* easter egg 4: PACKET MUNCHER — maze-chase on Pluto, early-arcade style.
   28x29 tile maze (T=20px -> 560x580 play + 40px HUD strip on a 560x620
   canvas), tile/progress movement with buffered turns and instant reversal.
   Four interference chasers share the invaders' glyph geometry but NOT a brain:
     K0 DIRECT   (red)   — targets your tile, always
     K1 AMBUSH   (pink)  — targets 4 tiles AHEAD of your heading
     K2 PATROL   (cyan)  — cycles the four maze corners, 6s per corner
     K3 SKITTISH (amber) — random at forks while >8 tiles away, hunts up close
   Powered display: chasers reverse + wash blue + edible, chain 200/400/800/1600.
   10 sectors: speed +6%/sector, power -8%/sector; sector 5+ the chasers
   accelerate as the last dots go (elroy: <30 dots x1.12, <12 x1.24).
   Bonus HDMI plug at 70 and 170 dots eaten (100 x sector). 3 lives, death
   spin, respawn pause. Collision is corner-cutting forgiving (11px overlap,
   not tile equality). Tunnel rows wrap left-right, chasers slow in them.
   Ten sectors, ten DISTINCT maze maps (MAZES[]) — corridor patterns,
   tunnel rows, plazas, dead ends and pellet spots all vary per sector. */
let egg4Anim=null,egg4Best=0,egg4Keys=null;
function eggOpen4(){
  document.getElementById("egg4").style.display="flex";
  EggAudio.init();EggAudio.ambientStart();eggSyncMute();
  document.getElementById("egg4-key").innerHTML=renderKey([["← → ↑ ↓","steer"],["WASD","steer"],["P","pause"],["M","mute"],["Esc","mission control"]]);
  eggMuncherRun();
}
function eggMuncherRun(){
  const W=560,H=620,c=document.getElementById("egg4c"),x=eggCanvas("egg4c",W,H);
  eggEndDismiss();
  if(egg4Anim){cancelAnimationFrame(egg4Anim);egg4Anim=null}
  if(egg4Keys){removeEventListener("keydown",egg4Keys);removeEventListener("keyup",egg4Keys)}
  const T=20,COLS=28,ROWS=29,FORGIVE=11;
  /* '#' wall · '.' packet · 'o' powered display · '-' house door · ' ' bare path
     one map per sector; any row with open cols 0/27 is a wrap tunnel;
     house core rows 9-15 cols 9-18 is identical in all ten (exit at 13,9) */
  const MAZES=[
  [ /* sector 1 — CLASSIC */
  "############################",
  "#............##............#",
  "#.####.#####.##.#####.####.#",
  "#o####.#####.##.#####.####o#",
  "#..........................#",
  "#.####.##.##....##.##.####.#",
  "#......##....##....##......#",
  "######.##.########.##.######",
  "######.##.########.##.######",
  "######.##          ##.######",
  "######.## ###--### ##.######",
  "######.## #      # ##.######",
  "          #      #          ",
  "######.## #      # ##.######",
  "######.## ######## ##.######",
  "######.##          ##.######",
  "######.##.########.##.######",
  "#..........................#",
  "#.####.#####.##.#####.####.#",
  "#.####.#####.##.#####.####.#",
  "#o..##.......##.......##..o#",
  "###.##.##.########.##.##.###",
  "#......##....##....##......#",
  "#.####.#####.##.#####.####.#",
  "#.####.#####.##.#####.####.#",
  "#......##....##....##......#",
  "#.####.##.########.##.####.#",
  "#..........................#",
  "############################"],
  [ /* sector 2 — RELAY LOOPS */
  "############################",
  "#..........................#",
  "#.##.####.########.####.##.#",
  "#o##.####.########.####.##o#",
  "#..........................#",
  "#.####.#####.##.#####.####.#",
  "#.####.#####.##.#####.####.#",
  "#.####.#####.##.#####.####.#",
  "#.####................####.#",
  "#.#######          #######.#",
  "#.####### ###--### #######.#",
  "#.####### #      # #######.#",
  "    ..... #      # .....    ",
  "#.####### #      # #######.#",
  "#.####### ######## #######.#",
  "#.#######          #######.#",
  "#.####................####.#",
  "#..........................#",
  "#.##.####.########.####.##.#",
  "#.##.####.########.####.##.#",
  "#..........................#",
  "#.####.#####o##o#####.####.#",
  "#.####.#####.##.#####.####.#",
  "#.####................####.#",
  "#.####.##.########.##.####.#",
  "#.####.##.########.##.####.#",
  "#..........................#",
  "############################",
  "############################"],
  [ /* sector 3 — TWIN CONDUITS */
  "############################",
  "#............##............#",
  "#.##.###.###.##.###.###.##.#",
  "#.##.###.###o##o###.###.##.#",
  "#.##.###............###.##.#",
  "#.##.###.###....###.###.##.#",
  " .  ....................  . ",
  "#.######.##########.######.#",
  "#.######.##########.######.#",
  "#........          ........#",
  "#####.### ###--### ###.#####",
  "#####.### #      # ###.#####",
  "#####.### #      # ###.#####",
  "#####.### #      # ###.#####",
  "#####.### ######## ###.#####",
  "#........          ........#",
  "#.####.#####.##.#####.####.#",
  "#..........................#",
  "#.##.###.##########.###.##.#",
  "#.##.###.##########.###.##.#",
  "#............##............#",
  "#.##########.##.##########.#",
  "  . .................... .  ",
  "##.###.###.######.###.###.##",
  "##o###.###.######.###.###o##",
  "#..........................#",
  "#############..#############",
  "##########........##########",
  "############################"],
  [ /* sector 4 — SERVER RACKS */
  "############################",
  "#..........................#",
  "#.##.##.##.##..##.##.##.##.#",
  "#.##.##.##.##..##.##.##.##.#",
  "#.##.##.##.##..##.##.##.##.#",
  "#.##.##....##..##....##.##.#",
  "#.##.##.##.##..##.##.##.##.#",
  "#.##.##.##.##..##.##.##.##.#",
  "#.##.##.##........##.##.##.#",
  "#.##.##.#          #.##.##.#",
  "#.##o##.# ###--### #.##o##.#",
  "#.##.##.# #      # #.##.##.#",
  "    ..... #      # .....    ",
  "#.##.##.# #      # #.##.##.#",
  "#.##.##.# ######## #.##.##.#",
  "#.##.##.#          #.##.##.#",
  "#.##.##.##........##.##.##.#",
  "#....##.##.##..##.##.##....#",
  "#.##.##.##.##..##.##.##.##.#",
  "#.##.##.##.##..##.##.##.##.#",
  "#.##....##o##..##o##....##.#",
  "#.##.##.##.##..##.##.##.##.#",
  "#.##.##.##.##..##.##.##.##.#",
  "#.##.##....##..##....##.##.#",
  "#.##.##.##.##..##.##.##.##.#",
  "#.##.##.##.##..##.##.##.##.#",
  "#.##.##.##.##..##.##.##.##.#",
  "#..........................#",
  "############################"],
  [ /* sector 5 — CROSSFIRE RINGS */
  "############################",
  "#..........................#",
  "#.#######o###..###o#######.#",
  "#.#......................#.#",
  "#.#.#######.####.#######.#.#",
  "#.#.#..................#.#.#",
  "#.#.#..##############..#.#.#",
  "#.#.#..................#.#.#",
  "#.#.#.#..............#.#.#.#",
  "#.#.#.#.#          #.#.#.#.#",
  "#...#.#.# ###--### #.#.#...#",
  "#.#.#.#.# #      # #.#.#.#.#",
  "    ..... #      # .....    ",
  "#.#o#.#.# #      # #.#.#o#.#",
  "#.#...#.# ######## #.#...#.#",
  "#.#.#.#.#          #.#.#.#.#",
  "#.#.#.#..............#.#.#.#",
  "#.#.#.#.#..........#.#.#.#.#",
  "#.#.#.#.############.#.#.#.#",
  "#.#.#.#.############.#.#.#.#",
  "#.#.#.#.############.#.#.#.#",
  "#.#.#..................#.#.#",
  "#.#.#..##############..#.#.#",
  "#.#.#..................#.#.#",
  "#.#.#######.####.#######.#.#",
  "#.#......................#.#",
  "#.#######.########.#######.#",
  "#..........................#",
  "############################"],
  [ /* sector 6 — THE PLAZAS */
  "############################",
  "############################",
  "#..........................#",
  "#.###.o..............o.###.#",
  "#.###..................###.#",
  "#.###.###.###..###.###.###.#",
  "#.....###.###..###.###.....#",
  "#.#######.###..###.#######.#",
  "#.#######.###..###.#######.#",
  "#.#######          #######.#",
  "#.####### ###--### #######.#",
  "#.####### #      # #######.#",
  "    ..... #      # .....    ",
  "#.####### #      # #######.#",
  "#.####### ######## #######.#",
  "#.#######          #######.#",
  "#.#######.###..###.#######.#",
  "#.#######.###..###.#######.#",
  "#.#######..........#######.#",
  "#.###.....########.....###.#",
  "#.###.################.###.#",
  "#.....################.....#",
  "#.###.################.###.#",
  "#.###..................###.#",
  "#.###.o..............o.###.#",
  "#..........................#",
  "############################",
  "############################",
  "############################"],
  [ /* sector 7 — STUB FARM */
  "############################",
  "#..........................#",
  "#.#.#.#.###.#..#.###.#.#.#.#",
  "#.#o#.#.###.#..#.###.#.#o#.#",
  "#.###.#######..#######.###.#",
  "#..........................#",
  "#.#.##.###.######.###.##.#.#",
  "#.#.##.###.######.###.##.#.#",
  "#.####................####.#",
  "#.#######          #######.#",
  "#.####### ###--### #######.#",
  "#....#### #      # ####....#",
  "#.####### #      # #######.#",
  "#....#### #      # ####....#",
  "#.####### ######## #######.#",
  "#.#######          #######.#",
  "#.####................####.#",
  "    ....................    ",
  "#.#.#.###.#.####.#.###.#.#.#",
  "#.#.#.###.#.####.#.###.#.#.#",
  "#.###.###.########.###.###.#",
  "#..........................#",
  "#.#.###.#.#.####.#.#.###.#.#",
  "#.#.###.#.#o####o#.#.###.#.#",
  "#.#######.########.#######.#",
  "#.##.####.##.##.##.####.##.#",
  "#.##.####.##.##.##.####.##.#",
  "#..........................#",
  "############################"],
  [ /* sector 8 — LONG HAUL */
  "############################",
  "#...........o..o...........#",
  "#.#####.############.#####.#",
  "#.#####.############.#####.#",
  "#.#####.############.#####.#",
  "    ....................    ",
  "#.###########..###########.#",
  "#.###########..###########.#",
  "#.###########..###########.#",
  "#.#######          #######.#",
  "#.####### ###--### #######.#",
  "#.####### #      # #######.#",
  "    ..... #      # .....    ",
  "#.##.#### #      # ####.##.#",
  "#.##.#### ######## ####.##.#",
  "#.##.####          ####.##.#",
  "#.##.####.########.####.##.#",
  "#..........................#",
  "#.####.##############.####.#",
  "#.####.##############.####.#",
  "#.####.##############.####.#",
  "#.####.##############.####.#",
  "#..........................#",
  "#.#########.####.#########.#",
  "#.#########.####.#########.#",
  "#.#########.####.#########.#",
  "#.#########.####.#########.#",
  "#......o............o......#",
  "############################"],
  [ /* sector 9 — THE LABYRINTH */
  "############################",
  "##...#...#...##...#...#...##",
  "##.#.#.#.#.#.##.#.#.#.#.#.##",
  "##.#.#.#.#.#.##.#.#.#.#.#.##",
  "##.#.#o#.#.#.##.#.#.#o#.#.##",
  "##.#.#.#.#.#.##.#.#.#.#.#.##",
  "##.#.#.#.#.#.##.#.#.#.#.#.##",
  "##.#...#...#....#...#...#.##",
  "#..######################..#",
  "#.#######          #######.#",
  "#.####### ###--### #######.#",
  "#.####### #      # #######.#",
  "#.####### #      # #######.#",
  "#.####### #      # #######.#",
  "#.####### ######## #######.#",
  "#........          ........#",
  "####.##################.####",
  "####....................####",
  "########.#.######.#.########",
  "########.#.######.#.########",
  "######................######",
  "######.#####.##.#####.######",
  "    .#.#####.##.#####.#.    ",
  "####.#o#.###.##.###.#o#.####",
  "####.###.###.##.###.###.####",
  "####.###.###.##.###.###.####",
  "####....................####",
  "############################",
  "############################"],
  [ /* sector 10 — THE GAUNTLET */
  "############################",
  "#..........................#",
  "####.##.###.#..#.###.##.####",
  "####.##.###o#..#o###.##.####",
  "####.##.#####..#####.##.####",
  " .  ....................  . ",
  "#.##.####.########.####.##.#",
  "#.##.####.########.####.##.#",
  "#.##......########......##.#",
  "#.#######          #######.#",
  "#.####### ###--### #######.#",
  "#.####### #      # #######.#",
  "#........ #      # ........#",
  "#.####### #      # #######.#",
  "#.####### ######## #######.#",
  "#.#######          #######.#",
  "#.###########..###########.#",
  "#.#######..........#######.#",
  "#.#######.########.#######.#",
  "   ......................   ",
  "###.#######.####.#######.###",
  "###.####............####.###",
  "###.####............####.###",
  "###......................###",
  "#####.##............##.#####",
  "#.###o##............##o###.#",
  "#.######.##########.######.#",
  "#..........................#",
  "############################"]];
  let MAZE=MAZES[0],TUNROWS=[12];
  const CORNERS=[[1,1],[26,1],[26,27],[1,27]],FRUIT_AT=[70,170];
  let MZ=[],level=1,score=0,lives=3,alive=true,paused=false;
  let state="ready",stT=0,dyT=0,flashT=0,dotsLeft=0,dotsEaten=0,frT=0,chain=0;
  let fruit=null,fruitN=0,elapsed=0,last=null,floats=[],G=[];
  const P={ti:14,tj:17,dx:0,dy:0,t:0,fx:-1,fy:0,want:[-1,0]};
  const mazeCv=document.createElement("canvas"),mazeFl=document.createElement("canvas");
  mazeCv.width=mazeFl.width=W;mazeCv.height=mazeFl.height=580;
  /* +6% speed per sector · power -8% per sector (floor 1.2s) */
  function tuning(){
    const sp=Math.pow(1.06,level-1);
    return{pspd:78*sp,gspd:70*sp,fr:Math.max(1.2,6.0*Math.pow(.92,level-1)),frspd:46*sp,eyespd:170,tunnel:.55};
  }
  function elroy(){if(level<5)return 1;return dotsLeft<12?1.24:dotsLeft<30?1.12:1}
  function hud(){
    document.getElementById("egg4s").textContent=score;
    document.getElementById("egg4lv").textContent=level;
    document.getElementById("egg4l").textContent=lives;
    document.getElementById("egg4b").textContent=egg4Best;
  }
  function popText(tx,ty,txt,ci){floats.push({x:tx,y:ty,txt,ci,a:1})}
  function open(i,j,ghost){
    i=((i%COLS)+COLS)%COLS;
    if(j<0||j>=ROWS)return false;
    const ch=MZ[j][i];
    if(ch==="#")return false;
    if(ch==="-")return!!ghost;
    return true;
  }
  function posOf(a){return[(((a.ti+.5)*T+a.dx*a.t*T)%(COLS*T)+COLS*T)%(COLS*T),(a.tj+.5)*T+a.dy*a.t*T]}
  function mkGhosts(){
    return[
      {kind:0,col:"#e8604a",st:"roam", ti:13,tj:9,dx:-1,dy:0,t:0,ci:0,cornerT:6},
      {kind:1,col:"#e8a1c8",st:"house",ti:13,tj:11,dx:0,dy:0,t:0,ci:0,cornerT:6,gx:270,gy:250,rel:{d:dotsEaten+2,t:2.2}},
      {kind:2,col:"#4fc3d9",st:"house",ti:12,tj:11,dx:0,dy:0,t:0,ci:1,cornerT:6,gx:250,gy:250,rel:{d:dotsEaten+24,t:6}},
      {kind:3,col:"#e8c76a",st:"house",ti:15,tj:11,dx:0,dy:0,t:0,ci:2,cornerT:6,gx:310,gy:250,rel:{d:dotsEaten+52,t:10}}
    ];
  }
  /* every chaser brain is a pure target function — the harness asserts them */
  function targetOf(g){
    if(g.st==="eyes")return{x:13,y:9};
    if(g.kind===0)return{x:P.ti,y:P.tj};
    if(g.kind===1)return{x:P.ti+4*P.fx,y:P.tj+4*P.fy};
    if(g.kind===2)return{x:CORNERS[g.ci][0],y:CORNERS[g.ci][1]};
    const d=Math.hypot(g.ti-P.ti,g.tj-P.tj);
    return d>8?{rand:true}:{x:P.ti,y:P.tj};
  }
  function decideGhost(g){
    const dirs=[[1,0],[-1,0],[0,1],[0,-1]].filter(d=>
      !(d[0]===-g.dx&&d[1]===-g.dy)&&open(g.ti+d[0],g.tj+d[1],g.st==="eyes"));
    if(!dirs.length){g.dx=-g.dx;g.dy=-g.dy;return}
    const t=g.st==="fright"?{rand:true}:targetOf(g);
    let d;
    if(t.rand)d=dirs[(Math.random()*dirs.length)|0];
    else{
      let bd=1e9;d=dirs[0];
      for(const q of dirs){
        const dd=(g.ti+q[0]-t.x)*(g.ti+q[0]-t.x)+(g.tj+q[1]-t.y)*(g.tj+q[1]-t.y);
        if(dd<bd){bd=dd;d=q}
      }
    }
    g.dx=d[0];g.dy=d[1];
  }
  function revA(a){a.ti=((a.ti+a.dx)%COLS+COLS)%COLS;a.tj+=a.dy;a.t=1-a.t;a.dx=-a.dx;a.dy=-a.dy}
  function stepPlayer(dt){
    const tn=tuning();let rem=tn.pspd*dt,guard=9;
    while(rem>1e-6&&guard-->0){
      if(!P.dx&&!P.dy){
        if(open(P.ti+P.want[0],P.tj+P.want[1],false)){P.dx=P.want[0];P.dy=P.want[1];P.fx=P.dx;P.fy=P.dy}
        else break;
      }
      if(P.t>=1-1e-9){ /* at a tile center: eat, then steer */
        P.ti=((P.ti+P.dx)%COLS+COLS)%COLS;P.tj+=P.dy;P.t=0;
        eatAt(P.ti,P.tj);
        if(state!=="play")break;
        if((P.want[0]!==P.dx||P.want[1]!==P.dy)&&open(P.ti+P.want[0],P.tj+P.want[1],false)){P.dx=P.want[0];P.dy=P.want[1];P.fx=P.dx;P.fy=P.dy}
        if(!open(P.ti+P.dx,P.tj+P.dy,false)){P.dx=0;P.dy=0;break}
        continue;
      }
      const adv=Math.min(rem/T,1-P.t);P.t+=adv;rem-=adv*T;
    }
  }
  function stepGhost(g,dt){
    const tn=tuning();
    if(g.st==="house"){g.rel.t-=dt;if(dotsEaten>=g.rel.d||g.rel.t<=0)g.st="exit";return}
    if(g.st==="exit"){ /* slide to the door column, rise through it to the ring */
      const s=58*dt;
      if(Math.abs(g.gx-270)>1.2){g.gx+=(270>g.gx?1:-1)*s;return}
      g.gx=270;g.gy-=s;
      if(g.gy<=190){g.ti=13;g.tj=9;g.dx=-1;g.dy=0;g.t=0;g.st=frT>0?"fright":"roam"}
      return;
    }
    if(g.st==="enter"){const s=150*dt;g.gy+=s;if(g.gy>=250){g.gy=250;g.st="house";g.rel={d:dotsEaten+3,t:1.1}}return}
    let spd=g.st==="eyes"?tn.eyespd:g.st==="fright"?tn.frspd:tn.gspd*elroy();
    if(TUNROWS.indexOf(g.tj)>=0&&g.st!=="eyes")spd*=tn.tunnel;
    let rem=spd*dt,guard=12;
    while(rem>1e-6&&guard-->0){
      if(g.t>=1-1e-9){
        g.ti=((g.ti+g.dx)%COLS+COLS)%COLS;g.tj+=g.dy;g.t=0;
        if(g.st==="eyes"&&g.ti===13&&g.tj===9){g.st="enter";g.gx=270;g.gy=190;break}
        decideGhost(g);
      }
      const adv=Math.min(rem/T,1-g.t);g.t+=adv;rem-=adv*T;
    }
  }
  function powerUp(){
    frT=tuning().fr;chain=0;EggAudio.powerPellet();
    for(const g of G){
      if(g.st==="roam"){g.st="fright";revA(g)}
      else if(g.st==="fright")revA(g);
    }
  }
  function eatGhost(g){
    chain=Math.min(4,chain+1);
    const val=200*(1<<(chain-1));
    score+=val;hud();
    const p=g.st?posOf(g):[g.gx,g.gy];
    popText(p[0],p[1]-10,"+"+val,10);
    EggAudio.eatGhost(chain);
    g.st="eyes";decideGhost(g);
  }
  function eatAt(i,j){
    const ch=MZ[j][i];
    if(ch==="."){MZ[j][i]=" ";dotsLeft--;dotsEaten++;score+=10;EggAudio.chomp();hud();checkFruit();checkClear()}
    else if(ch==="o"){MZ[j][i]=" ";dotsLeft--;dotsEaten++;score+=50;powerUp();hud();checkFruit();checkClear()}
  }
  function checkFruit(){
    if(fruitN<2&&dotsEaten>=FRUIT_AT[fruitN]){fruitN++;fruit={x:280,y:310,t:10}}
  }
  function checkClear(){
    if(dotsLeft<=0&&state==="play"){state="clear";flashT=0;fruit=null;EggAudio.levelUp()}
  }
  function killPlayer(){
    if(state!=="play")return;
    state="dying";dyT=0;EggAudio.muncherDown();
  }
  function gameOver(){
    if(!alive)return;
    alive=false;egg4Anim=null;
    egg4Best=Math.max(egg4Best,score);hud();
    EggAudio.gameOver();
    eggEndScreen({host:c.parentElement,title:"The interference kept the packets.",
      lines:["Score "+score+" · sector "+level+"/10","Session best "+egg4Best],
      onReplay:eggMuncherRun,onMenu:()=>{eggClose4();eggMenu()}});
  }
  function complete(){
    if(!alive)return;
    alive=false;egg4Anim=null;
    egg4Best=Math.max(egg4Best,score);hud();
    EggAudio.victory();
    eggEndScreen({host:c.parentElement,title:"THE NETWORK IS CLEAN.",
      lines:["All ten sectors cleared · "+score+" pts","Session best "+egg4Best],
      onReplay:eggMuncherRun,onMenu:()=>{eggClose4();eggMenu()}});
  }
  function resetPositions(){
    P.ti=14;P.tj=17;P.dx=0;P.dy=0;P.t=0;P.fx=-1;P.fy=0;P.want=[-1,0];
    G=mkGhosts();
  }
  function drawMazeTo(cv,bright){
    const g2=cv.getContext("2d");
    g2.clearRect(0,0,W,580);
    const body=bright?"#2c3f86":"#100d26",edge=bright?"#cfe0ff":"#6d5bb8";
    const openN=(ni,nj)=>nj>=0&&nj<ROWS&&ni>=0&&ni<COLS&&MAZE[nj][ni]!=="#";
    for(let j=0;j<ROWS;j++)for(let i=0;i<COLS;i++){
      if(MAZE[j][i]!=="#")continue;
      g2.fillStyle=body;g2.fillRect(i*T,j*T,T,T);
      g2.fillStyle=edge;
      if(openN(i-1,j))g2.fillRect(i*T,j*T,2,T);
      if(openN(i+1,j))g2.fillRect(i*T+T-2,j*T,2,T);
      if(openN(i,j-1))g2.fillRect(i*T,j*T,T,2);
      if(openN(i,j+1))g2.fillRect(i*T,j*T+T-2,T,2);
    }
    g2.fillStyle="#e8a1c8";g2.fillRect(13*T+2,10*T+8,2*T-4,4); /* house door */
  }
  function loadLevel(lv){
    level=lv;
    MAZE=MAZES[Math.min(MAZES.length,Math.max(1,lv))-1];
    TUNROWS=[];for(let j=0;j<ROWS;j++)if(MAZE[j][0]!=="#")TUNROWS.push(j);
    MZ=MAZE.map(r=>r.split(""));
    MZ[17][14]=" "; /* spawn tile carries no packet */
    dotsLeft=0;dotsEaten=0;
    for(let j=0;j<ROWS;j++)for(let i=0;i<COLS;i++)if(MZ[j][i]==="."||MZ[j][i]==="o")dotsLeft++;
    fruit=null;fruitN=0;frT=0;chain=0;flashT=0;floats=[];
    resetPositions();
    drawMazeTo(mazeCv,false);drawMazeTo(mazeFl,true);
    state="ready";stT=0;hud();
  }
  egg4Keys=e=>{
    if(document.getElementById("egg4").style.display!=="flex")return;
    if(["ArrowLeft","ArrowRight","ArrowUp","ArrowDown"," "].includes(e.key))e.preventDefault();
    const k=e.key.length===1?e.key.toLowerCase():e.key;
    if(e.type==="keydown"&&k==="p"&&alive&&(state==="play"||paused)){paused=!paused;return}
    const map={ArrowLeft:[-1,0],a:[-1,0],ArrowRight:[1,0],d:[1,0],ArrowUp:[0,-1],w:[0,-1],ArrowDown:[0,1],s:[0,1]};
    if(e.type==="keydown"&&map[k]&&!paused){
      P.want=map[k];
      if(state==="play"&&(P.dx||P.dy)&&P.want[0]===-P.dx&&P.want[1]===-P.dy){revA(P);P.fx=P.dx;P.fy=P.dy}
    }
  };
  addEventListener("keydown",egg4Keys);addEventListener("keyup",egg4Keys);
  function update(dt){
    elapsed+=dt;
    floats.forEach(f=>{f.y-=14*dt;f.a-=dt*1.1});
    floats=floats.filter(f=>f.a>0);
    if(state==="ready"){stT+=dt;if(stT>=1.3)state="play";return}
    if(state==="dying"){
      dyT+=dt;
      if(dyT>=1.6){
        lives--;hud();
        if(lives<=0)return gameOver();
        resetPositions();state="ready";stT=0;
      }
      return;
    }
    if(state==="clear"){
      flashT+=dt;
      if(flashT>=1.6){
        if(level>=10)return complete();
        loadLevel(level+1);
      }
      return;
    }
    /* play */
    if(frT>0){
      frT-=dt;
      if(frT<=0){frT=0;chain=0;for(const g of G)if(g.st==="fright")g.st="roam"}
    }
    for(const g of G)if(g.kind===2&&g.st==="roam"){g.cornerT-=dt;if(g.cornerT<=0){g.ci=(g.ci+1)%4;g.cornerT=6}}
    stepPlayer(dt);
    if(state!=="play")return;
    for(const g of G)stepGhost(g,dt);
    const pp=posOf(P);
    for(const g of G){
      if(g.st!=="roam"&&g.st!=="fright")continue;
      const gp=posOf(g);
      let ddx=Math.abs(gp[0]-pp[0]);if(ddx>COLS*T/2)ddx=COLS*T-ddx;
      if(Math.hypot(ddx,gp[1]-pp[1])<FORGIVE){
        if(g.st==="fright")eatGhost(g);
        else return killPlayer();
      }
    }
    if(fruit){
      fruit.t-=dt;
      let fdx=Math.abs(fruit.x-pp[0]);if(fdx>COLS*T/2)fdx=COLS*T-fdx;
      if(Math.hypot(fdx,fruit.y-pp[1])<14){
        const val=100*level;score+=val;hud();
        popText(fruit.x,fruit.y-10,"+"+val,12);
        EggAudio.powerup();fruit=null;
      }else if(fruit.t<=0)fruit=null;
    }
  }
  function drawGhost(g){
    let gx,gy;
    if(g.st==="house"||g.st==="exit"||g.st==="enter"){gx=g.gx;gy=g.gy+(g.st==="house"?Math.sin(elapsed*3+g.kind*2)*2:0)}
    else{const p=posOf(g);gx=p[0];gy=p[1]}
    gx=Math.round(gx);gy=Math.round(gy);
    if(g.st==="eyes"){
      x.fillStyle="#e2d9ff";x.fillRect(gx-6,gy-3,5,5);x.fillRect(gx+1,gy-3,5,5);
      x.fillStyle="#1d5c7a";x.fillRect(gx-5+g.dx,gy-2+g.dy,2,2);x.fillRect(gx+2+g.dx,gy-2+g.dy,2,2);
      return;
    }
    const fright=g.st==="fright";
    let col=g.col;
    if(fright)col=(frT<1.5&&((elapsed*7|0)%2===0))?"#cdd8f2":"#5a7bc4";
    const ph=(elapsed*6|0)%2;
    x.fillStyle=col;
    x.beginPath();x.roundRect(gx-8,gy-4,16,11,3);x.fill();
    x.strokeStyle=col;x.lineWidth=1.5;x.beginPath();
    if(ph){x.moveTo(gx-5,gy-4);x.lineTo(gx-7,gy-9);x.moveTo(gx+5,gy-4);x.lineTo(gx+7,gy-9)}
    else{x.moveTo(gx-5,gy-4);x.lineTo(gx-3,gy-9);x.moveTo(gx+5,gy-4);x.lineTo(gx+3,gy-9)}
    x.stroke();
    x.fillStyle="#0b0918";
    if(fright){
      x.fillRect(gx-5,gy-2,3,2);x.fillRect(gx+2,gy-2,3,2);
      for(let k=-6;k<6;k+=3)x.fillRect(gx+k,(k/3%2===0)?gy+3:gy+4,3,1); /* zigzag mouth */
    }else{
      x.fillRect(gx-5+g.dx*2,gy-2+g.dy,3,3);x.fillRect(gx+2+g.dx*2,gy-2+g.dy,3,3);
    }
  }
  function drawPlayer(){
    const p=posOf(P);
    const ppx=Math.round(p[0]),ppy=Math.round(p[1]);
    let ang=Math.atan2(P.fy,P.fx),r=9,m;
    if(state==="dying"){
      const k=Math.min(1,dyT/1.1);
      ang+=dyT*9;m=.15+k*2.6;
      r=9*Math.max(0,1-Math.max(0,(dyT-1.0)/.5));
      if(r<=0)return;
    }else m=(P.dx||P.dy)?(.16+.34*Math.abs(Math.sin(elapsed*10.5))):.16;
    x.fillStyle="#c6e05a";
    x.beginPath();x.moveTo(ppx,ppy);x.arc(ppx,ppy,r,ang+m,ang-m+6.2832);x.closePath();x.fill();
  }
  function drawFruit(){
    const fx=Math.round(fruit.x),fy=Math.round(fruit.y+Math.sin(elapsed*3)*2);
    x.fillStyle="#8a8296";x.fillRect(fx-7,fy-6,14,8);        /* plug shell */
    x.fillStyle="#5a5564";x.fillRect(fx-5,fy+2,10,3);        /* taper */
    x.fillStyle="#e8c76a";for(let k=-5;k<=4;k+=2)x.fillRect(fx+k,fy-4,1,2); /* pins */
    x.fillStyle="#241c45";x.fillRect(fx-3,fy+5,6,3);         /* mouth */
  }
  function draw(){
    x.fillStyle="#04030a";x.fillRect(0,0,W,H);
    x.drawImage(state==="clear"&&((flashT*6|0)%2===0)?mazeFl:mazeCv,0,0);
    /* packets + powered displays */
    for(let j=0;j<ROWS;j++)for(let i=0;i<COLS;i++){
      const ch=MZ[j][i];
      if(ch==="."){x.fillStyle="#7fc6dd";x.fillRect(i*T+8,j*T+8,4,4)}
      else if(ch==="o"){
        const cx2=i*T+10,cy2=j*T+10,hot=(elapsed*3|0)%2===0;
        x.fillStyle=hot?"rgba(127,198,221,.35)":"rgba(127,198,221,.18)";
        x.fillRect(cx2-8,cy2-7,16,13);                      /* glow */
        x.fillStyle="#2a2350";x.fillRect(cx2-6,cy2-5,12,8); /* tiny display */
        x.fillStyle=hot?"#b7ecf7":"#7fc6dd";x.fillRect(cx2-4,cy2-4,8,5);
        x.fillStyle="#3a2f6b";x.fillRect(cx2-2,cy2+3,4,2);  /* stand */
      }
    }
    if(fruit)drawFruit();
    for(const g of G)drawGhost(g);
    if(state!=="clear")drawPlayer();
    floats.forEach(f=>{x.globalAlpha=Math.max(0,Math.min(1,f.a));drawText(x,f.x-textW(f.txt)/2,f.y,f.txt,f.ci,1);x.globalAlpha=1});
    /* HUD strip */
    x.fillStyle="#0a0820";x.fillRect(0,580,W,40);
    x.fillStyle="#3a2f6b";x.fillRect(0,580,W,1);
    for(let i=0;i<lives;i++){
      x.fillStyle="#c6e05a";
      x.beginPath();x.moveTo(16+i*20,600);x.arc(16+i*20,600,7,.5,5.78);x.closePath();x.fill();
    }
    drawText(x,72,596,"SECTOR",15,1);
    if(frT>0){
      const wq=Math.round(80*frT/tuning().fr);
      x.fillStyle="#1d5c7a";x.fillRect(140,597,80,6);
      x.fillStyle="#5a7bc4";x.fillRect(140,597,wq,6);
    }
    for(let i=0;i<Math.min(10,level);i++){ /* sector counter as little displays */
      const lx=W-16-i*14;
      x.fillStyle="#2a2350";x.fillRect(lx-5,592,11,8);
      x.fillStyle="#7fc6dd";x.fillRect(lx-4,593,9,5);
      x.fillStyle="#3a2f6b";x.fillRect(lx-2,600,5,2);
    }
    /* banners */
    if(state==="ready"){drawText(x,280-textW("READY!",3)/2,300,"READY!",9,3)}
    if(state==="clear"&&flashT>.4)drawText(x,280-textW("SECTOR CLEAR",2)/2,300,"SECTOR CLEAR",12,2);
    if(paused)eggPauseOverlay(x,W,H);
  
    crtPass(x);   /* phosphor halo - see crtPass() */
  }
  function loop(ts){
    if(!alive)return;
    if(document.getElementById("egg4").style.display!=="flex"){egg4Anim=null;return}
    const now=ts!=null?ts:(window.performance&&performance.now?performance.now():Date.now());
    if(last==null)last=now;
    const dt=Math.min(.05,(now-last)/1000);last=now;
    if(!paused)update(dt);
    if(alive)draw();
    if(alive)egg4Anim=requestAnimationFrame(loop);
  }
  window.__eggDbg={game:"pluto",
    state:()=>({state,level,score,lives,alive,paused,dotsLeft,dotsEaten,frT,chain,
      px:posOf(P)[0],py:posOf(P)[1],ti:P.ti,tj:P.tj,dx:P.dx,dy:P.dy,fx:P.fx,fy:P.fy,fruit:!!fruit}),
    maze:()=>({cols:COLS,rows:ROWS,uniform:MAZE.every(r=>r.length===COLS)}),
    dotsTotal:()=>MAZE.join("").split("").filter(ch=>ch===".").length,
    pelletsTotal:()=>MAZE.join("").split("").filter(ch=>ch==="o").length,
    ghosts:()=>G.map(g=>({kind:g.kind,st:g.st,ti:g.ti,tj:g.tj,dx:g.dx,dy:g.dy,ci:g.ci})),
    targets:()=>G.map(g=>{const t=targetOf(g);return t.rand?{kind:g.kind,rand:true}:{kind:g.kind,x:t.x,y:t.y}}),
    setPlayer:(i,j,dx,dy)=>{P.ti=i;P.tj=j;P.t=0;P.dx=dx||0;P.dy=dy||0;
      if(dx||dy){P.fx=dx||0;P.fy=dy||0;P.want=[dx||0,dy||0]}},
    setGhost:(k,i,j)=>{const g=G[k];g.st="roam";g.ti=i;g.tj=j;g.dx=-1;g.dy=0;g.t=0},
    setCorner:(k,ci)=>{G[k].ci=ci},
    eat:(i,j)=>eatAt(i,j),
    eatGhostK:k=>eatGhost(G[k]),
    clearDots:()=>{for(let j=0;j<ROWS;j++)for(let i=0;i<COLS;i++)if(MZ[j][i]==="."||MZ[j][i]==="o")eatAt(i,j)},
    setLevel:n=>loadLevel(n),
    advanceSector:()=>loadLevel(Math.min(10,level+1)),
    maps:()=>MAZES,
    mazeRows:()=>MZ.map(r=>r.join("")),
    tunnelRows:()=>TUNROWS.slice(),
    eatAllBut:n=>{for(let j=0;j<ROWS&&dotsLeft>n;j++)for(let i=0;i<COLS&&dotsLeft>n;i++)if(MZ[j][i]==="."){MZ[j][i]=" ";dotsLeft--;dotsEaten++}},
    spawnFruit:()=>{fruit={x:280,y:310,t:10}},
    elroy:()=>elroy(),
    tuning:()=>tuning()};
  loadLevel(1);
  hud();
  egg4Anim=requestAnimationFrame(loop);
}
function eggClose4(){
  document.getElementById("egg4").style.display="none";
  if(egg4Anim){cancelAnimationFrame(egg4Anim);egg4Anim=null}
  if(egg4Keys){removeEventListener("keydown",egg4Keys);removeEventListener("keyup",egg4Keys);egg4Keys=null}
  eggEndDismiss();EggAudio.ambientStop();
}

/* ============================================================================
   EGG PIXEL ENGINE (Stage 1) — 8-bit renderer + art for the easter-egg games
   ============================================================================

   COORDINATES & SCALING
   - Internal resolution 220x130 ("internal px"). ALL game logic and draw
     calls use internal px; positions are rounded at draw time (no sub-pixel).
   - The frame is drawn on an offscreen 220x130 canvas, then blitted onto the
     880x520 display canvas at exactly x4 with blitScaled() — image smoothing
     disabled everywhere, so pixels stay fat and crisp (DPR-aware via
     eggCanvas()'s transform).

   PALETTE — PAL, 45 colors. Indices 0..16 are the original 8-bit set and are
   frozen: every game below Stage 2 is drawn against them. Indices 17..44 are
   the 16-bit extension used by THE LOST DISPLAY only (see the PAL comment).
   - In sprite maps each pixel is one char: '.' = transparent,
     '0'-'9' = PAL[0..9], 'A'-'G' = PAL[10..16], 'H'-'Z' = PAL[17..35],
     'a'-'e' = PAL[36..40], 'f'-'i' = PAL[41..44]. PXC maps char -> index.
       0 void #07050f   1 deep #140e28   2 hull #1f1840   3 mid #3a2f6b
       4 accent #6d5bb8 5 bright #a58cff 6 lav #e2d9ff    7 white #ffffff
       8 grnDk #2e7a4f  9 green #7ce3a8  10/A teal #7fc6dd 11/B tealDk #1d5c7a
       12/C amber #e8c76a 13/D orange #e8a184 14/E red #c0402a
       15/F grey #8a8296  16/G black #000000

   SPRITES
   - EGG_ART: { name: [frame, frame, ...] } — every frame is an array of
     equal-length row strings, one char per pixel (format above).
   - mkSprite(rows, scale=1)        -> offscreen canvas compiled from a map
   - mkSpriteFlipped(rows, scale=1) -> horizontally mirrored compile
   - mkSpriteFlash(rows, scale=1)   -> all opaque px white (damage flash)
   - eggPxInit() compiles every EGG_ART entry once into three stores:
       SPR[name][frame]  normal   · SPRF[name][frame] mirrored
       SPRW[name][frame] white flash (Stage 3 can tint instead)
   - anim(frames, fps) -> { at(t) } returns the frame canvas for time t (s).
   - drawSpr(ctx, img, x, y) draws with Math.round snapping.

   SPRITE INVENTORY (w x h, frames)
   - player_idle 16x20 x2 · player_run x4 · player_jump x1 · player_fire x2
     player_fire_up x1 · player_fire_diag x1 · player_fire_down x1
     player_death x2 (dissolve). Body ~14x18 inside the 16x20 box, feet on
     the bottom row, faces RIGHT (use SPRF when facing left).
   - smasher 12x12 x2 · zapper 10x10 x2 · snatcher 12x8 x2 · vent 14x14 x2
   - boss_crusher 40x32 x2 · boss_wyrm_head 16x16 x2 · boss_wyrm_seg 8x8 x2
     boss_eater 48x40 x2 (all also in SPRW for damage flash)
   - pk_display/pk_hdmi/pk_coil/pk_switch/pk_speaker/pk_surge 10x10 x1,
     capsule 12x12 x2 (draw the pk_* icon at capsule x+1,y+1),
     carrier 14x10 x2, hud_face 8x8 x1
   - tile_* 8x8 (see EGG_TILE) · prop_crates 16x16 · prop_bossdoor 16x24

   TEXT
   - drawText(ctx, x, y, str, colorIdx, scale=1): 3x5 pixel font
     (A-Z 0-9 - . : / ! ? + ' and the mid-dot). Lowercase is upcased.
   - textW(str, scale=1) -> pixel width.

   TILES & MAPS
   - 8x8 tiles in the Stage 2 games. THE LOST DISPLAY (egg6) runs a 16x16 grid
     (TS=16) and its e_[tcdw]_* tiles are 16x16 — the asset QA in
     scripts/pixel-qa keys off this, so keep the two in step.
     A map is an array of equal-length strings; each char is a
     tile code from EGG_TILE ('.' = empty). Rows top to bottom, col*8 = x.
   - drawTiles(ctx, map, camX, t): draws only the visible columns; tiles with
     more than one frame animate at their own fps from t (seconds); the
     floor tile alternates its 'alt' variant on a fixed column hash.
   - EGG_TILE[code] = { art, solid?, oneway?, fps?, alt? }
   - Collision helpers for Stage 2: tileAt(map, x, y) -> code,
     tileSolid(map, x, y), landAt(map, x, prevY, newY) -> surface y or null
     (checks solid tops and jump-through grate tops between two feet-y's).
   - PROPS (crates pile, boss door) are plain sprites — draw before actors.

   PARALLAX
   - drawParallax(ctx, camX, t): three pixel-snapped strips —
     far x0.2 (starfield through hull windows), mid x0.45 (inner hull ribs),
     near x0.7 (overhead conduit + blinking lights; static under
     prefers-reduced-motion). Deterministic, no allocations per frame.

   HUD
   - hud_face life icons, pk_* icons double as weapon chips,
     drawBossBar(ctx, x, y, w, frac, label) — framed boss health bar.

   Stage 2 (below) is the full game: three missions, weapon progression,
   a boss per mission. Every drawn thing uses these primitives.
   ========================================================================== */
const PAL=["#07050f","#140e28","#1f1840","#3a2f6b","#6d5bb8","#a58cff","#e2d9ff","#ffffff","#2e7a4f","#7ce3a8","#7fc6dd","#1d5c7a","#e8c76a","#e8a184","#c0402a","#8a8296","#000000",
/* 17..40 (chars H..Z, a..e) — the 16-bit extension. Indices 0..16 are untouched, so
   every 8-bit game keeps its exact colours; these only fill the gaps in six material
   ramps so a surface can carry 5-6 tones instead of 3, warm on the lit side and cool
   in shadow. Ramps, lightest first:
     purple/cloth  6 5 Y 4 d 3 X 2 1 0      sandstone/gold  H I C J K L
     skin/clay     Z D b c L                 grey/metal      P F Q R S G
     plant         M 9 N 8 O                 water/jelly     T A U B V W
     red           D e E a                   ice/signal      f g h i
   41..44 (chars f..i) are the ice ramp added for the DIGITAL LONG SWORD, the
   full-health beam and the vendor's flask glass. Append only: 0..16 stay frozen
   for the 8-bit games and 17..40 stay put for the art pass that already shipped. */
"#fff0c4","#f2d78e","#d2a862","#a87a4a","#6e4a38",   /* H I J K L  sandstone   */
"#b9f5cf","#4fae74","#1c5138",                       /* M N O      plant       */
"#b6b0c6","#6a6478","#453f52","#262233",             /* P Q R S    grey stone  */
"#a9e8f5","#3f9dbc","#12455f","#08283a",             /* T U V W    water       */
"#241d47","#8a72d8",                                 /* X Y        cloth fill  */
"#f7ddb2","#7d2318","#c98a63","#8c5a3c","#52449a","#e06a48", /* Z a b c d e    */
"#eafbff","#a8e4f7","#4fb6e8","#1d5f96",
/* 45..46 (chars j,k) - VENUS. Appended, never inserted: every index above is
   load-bearing in two art stores, and reordering would silently recolour the whole
   collection. 45 fills a real hole - a greened mid-value between amber C #e8c76a
   and ochre K #a87a4a - which the sulphur ramp needs and the 45-colour set did not
   have. 46 is a warm desaturated neutral for atmospheric perspective: Venus has a
   thick sky, so distance must wash toward grey-rose, not toward the void. */
"#b9a03c","#8f6a72",
/* 47..49 (chars l,m,n) - MARS. The theme layer had been carrying its own colours as
   raw hex inside EGG_THEME.map, which put them outside the palette and therefore
   outside every palette and contrast check. These three are the tones that had no
   equivalent in the 47: a rust mid-value, an olive scrub, and a deep warm shadow.
   Everything else the theme needs already existed and now references it. */
"#a35636","#6b6b3a","#2e1517"];                    /* f g h i   ice  */
/* RELAY RUN THEME LAYER — Mars / American-Southwest reskin (Pass A).
   Mars is the game's only home now, so the theme is always on. It is a
   palette/tile-variant swap, not a rewrite: tiles listed in EGG_THEME.tiles
   are re-compiled once through EGG_THEME.map (sprite char -> sandstone hex)
   into the SPRT store at eggPxInit; drawTiles prefers SPRT while the theme
   is active. drawParallax swaps to three Mars strips (same speeds 0.2/0.45/
   0.7, same pixel-snapped rect fills, same 8-bit fidelity):
     far  — butte/mesa silhouettes on a dusty-rose #c4684a / #8a4a34 sky
            gradient that falls toward dusk purple at the top
     mid  — rocky canyon walls, ochre #c98a5a faces with rust #a35636 shadow
     near — desert scrub / rock bands along the deck line
   Enemies, pods and pickups render from SPR, untouched. */
const EGG_THEME={
  active:"mars",
  sky:["#241026","#4a2140","#8a4a34","#c4684a"],
  butte:"#3d1e2b",buttelit:"#5a2c33",
  canyon:"#a35636",canyonlit:"#c98a5a",canyondk:"#6b3524",
  scrub:PAL[48],rock:PAL[36],sand:PAL[19],
  /* Expressed in PAL rather than in loose hex. Two of the old literals were
     near-duplicates of colours already in the palette - #c98a5a against PAL[37]
     #c98a63 and #e8c76a against PAL[12] exactly - so the theme was quietly widening
     the palette with colours nobody could see in a census. Referencing PAL means the
     contrast and near-duplicate checks now cover the Mars reskin too. */
  map:{"1":PAL[49],"2":PAL[38],"3":PAL[47],"4":PAL[37],"5":PAL[19],"9":PAL[12],"8":PAL[47]},
  /* tile_conduit is placed 388 times across the Mars maps and tile_porthole 17, and
     neither was in this list - so on a themed level they rendered in the original
     purple against sandstone neighbours. They are the two most-placed tiles that
     were not being themed. */
  tiles:["tile_floor_a","tile_floor_b","tile_wall","tile_ceiling","tile_grate",
         "tile_rib_top","tile_rib_mid","tile_rib_base","tile_wall_panel","tile_debris",
         "tile_conduit","tile_porthole"]
};
const PXC=(()=>{const m={};"0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmn".split("").forEach((ch,i)=>m[ch]=i);return m})();
function mkSprite(rows,scale){
  scale=scale||1;
  const w=rows[0].length,h=rows.length,cv=document.createElement("canvas");
  cv.width=w*scale;cv.height=h*scale;
  const g=cv.getContext("2d");
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const ch=rows[y][x];
    if(ch===".")continue;
    g.fillStyle=PAL[PXC[ch]];
    g.fillRect(x*scale,y*scale,scale,scale);
  }
  return cv;
}
function mkSpriteFlipped(rows,scale){return mkSprite(rows.map(r=>r.split("").reverse().join("")),scale)}
function mkSpriteFlash(rows,scale){return mkSprite(rows.map(r=>r.replace(/[^.]/g,"7")),scale)}
function mkSpriteTheme(rows,scale){ /* like mkSprite, chars routed through EGG_THEME.map */
  scale=scale||1;
  const w=rows[0].length,h=rows.length,cv=document.createElement("canvas");
  cv.width=w*scale;cv.height=h*scale;
  const g=cv.getContext("2d");
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const ch=rows[y][x];
    if(ch===".")continue;
    g.fillStyle=EGG_THEME.map[ch]||PAL[PXC[ch]];
    g.fillRect(x*scale,y*scale,scale,scale);
  }
  return cv;
}
let SPR=null,SPRF=null,SPRW=null,SPRT=null,SPR5=null,SPRF5=null;
function eggPxInit(){
  if(SPR)return;
  SPR={};SPRF={};SPRW={};SPRT={};
  for(const k in EGG_ART){
    SPR[k]=EGG_ART[k].map(f=>mkSprite(f));
    SPRF[k]=EGG_ART[k].map(f=>mkSpriteFlipped(f));
    SPRW[k]=EGG_ART[k].map(f=>mkSpriteFlash(f));
  }
  for(const k of EGG_THEME.tiles)if(EGG_ART[k])SPRT[k]=EGG_ART[k].map(f=>mkSpriteTheme(f));
}
function anim(frames,fps){return{at:t=>frames[Math.floor(t*fps)%frames.length]}}
function drawSpr(ctx,img,x,y){ctx.drawImage(img,Math.round(x),Math.round(y))}
/* ---------------------------------------------------------------- the tube ---
   Every game renders to a small offscreen buffer and reaches the display through
   this one function, which makes it the only place a screen-wide effect belongs.
   The opening logo film has a CRT look - fat glowing pixels, a faint bloom around
   anything bright, a barely-there instability - and the games should feel like they
   are arriving down the same cable.

   Two passes, and the ORDER IS THE WHOLE POINT:
     1. the crisp nearest-neighbour blit, exactly as before. Pixel art has to stay
        pixel-exact or the whole discipline is wasted.
     2. a bloom pass: the same buffer drawn again, this time SMOOTHED and composited
        with "lighter", at low alpha. Smoothing a 4x upscale is normally the cardinal
        sin here; additively, at 14%, it is a phosphor halo rather than a blur,
        because it only ever ADDS light around pixels that were already lit. Dark
        areas gain nothing - lighter with a black source is a no-op - so the blacks
        stay black and only the bright pixels glow.

   Cost is one extra drawImage per frame. The scanlines, the vignette and the
   vibration are CSS on .egg-stage, so they cost nothing per frame at all.

   Measured on a real scene: a black pixel goes 0,0,0 -> 2,1,0 and the brightest
   pixel gains 13%, which is the shape a phosphor halo should have. CRT_BLOOM is
   the single dial. Reduced motion does not disable it: a static glow
   is not motion, and turning it off would make one group of players see a different
   game. The VIBRATION is motion, and that is switched off in CSS. */
const CRT_BLOOM=.18;
/* The same phosphor halo for the games that DO NOT render through a buffer.
   Only three of the seven (Mars, Venus, Earth) draw to a small offscreen canvas
   and reach the display via blitScaled; Jupiter, the ship, Pluto and Saturn draw
   straight onto the display canvas at its own resolution. Those four therefore
   never touched blitScaled and never got the bloom, which made the effect
   three-sevenths of a feature.

   Compositing a canvas onto itself is legal and cheap, and additively it is the
   same operation blitScaled performs: smooth, "lighter", low alpha, so only lit
   pixels gain and the blacks are untouched. Called once at the end of a frame,
   after everything including the HUD, so the glow sits over the finished picture
   rather than under half of it. */
function crtPass(x){
  if(CRT_BLOOM<=0)return;
  const c=x.canvas,g=Math.max(1,Math.round(c.width*0.004));
  x.save();
  x.setTransform(1,0,0,1,0,0);   /* these canvases are DPR-transformed; the halo is in device px */
  x.imageSmoothingEnabled=true;
  x.globalCompositeOperation="lighter";
  x.globalAlpha=CRT_BLOOM;
  x.drawImage(c,-g,-g,c.width+g*2,c.height+g*2);
  x.restore();
  x.imageSmoothingEnabled=false;
}
function blitScaled(dctx,src,w,h){
  dctx.imageSmoothingEnabled=false;
  dctx.drawImage(src,0,0,w,h);
  if(CRT_BLOOM>0){
    dctx.save();
    dctx.imageSmoothingEnabled=true;
    dctx.globalCompositeOperation="lighter";
    dctx.globalAlpha=CRT_BLOOM;
    /* Drawn a hair larger and re-centred, so the halo sits around the pixel rather
       than on it. Half a display pixel at 4x is an eighth of a source pixel: enough
       to read as glow, too little to read as a double image. */
    const g=Math.max(1,Math.round(w*0.004));
    dctx.drawImage(src,-g,-g,w+g*2,h+g*2);
    dctx.restore();
    dctx.imageSmoothingEnabled=false;
  }
}
/* 3x5 pixel font — 15-bit strings, row-major, 3 wide */
const EGG_FONT={
"0":"111101101101111","1":"010110010010111","2":"110001010100111","3":"111001011001111",
"4":"101101111001001","5":"111100110001110","6":"011100111101111","7":"111001010010010",
"8":"111101111101111","9":"111101111001110",
"A":"010101111101101","B":"110101110101110","C":"011100100100011","D":"110101101101110",
"E":"111100110100111","F":"111100110100100","G":"011100101101011","H":"101101111101101",
"I":"111010010010111","J":"001001001101010","K":"101101110101101","L":"100100100100111",
"M":"101111111101101","N":"110101101101101","O":"111101101101111","P":"110101110100100",
"Q":"010101101110011","R":"110101110101101","S":"011100010001110","T":"111010010010010",
"U":"101101101101111","V":"101101101101010","W":"101101111111101","X":"101101010101101",
"Y":"101101010010010","Z":"111001010100111",
"-":"000000111000000",".":"000000000000010",":":"000010000010000","/":"001001010100100",
"!":"010010010000010","?":"110001010000010","·":"000000010000000","+":"000010111010000",
"'":"010010000000000"};
function drawText(ctx,x,y,str,colorIdx,scale){
  scale=scale||1;
  ctx.fillStyle=PAL[colorIdx==null?6:colorIdx];
  let cx=Math.round(x);y=Math.round(y);
  const s=String(str).toUpperCase();
  for(let n=0;n<s.length;n++){
    const g=EGG_FONT[s[n]];
    if(g)for(let i=0;i<15;i++)if(g[i]==="1")ctx.fillRect(cx+(i%3)*scale,y+((i/3)|0)*scale,scale,scale);
    cx+=4*scale;
  }
}
function textW(str,scale){return String(str).length*4*(scale||1)-(scale||1)}
/* tile table — art name + physics flags (Stage 2 reads solid/oneway) */
const EGG_TILE={
  "#":{art:"tile_floor_a",alt:"tile_floor_b",solid:true},
  "W":{art:"tile_wall",solid:true},
  "^":{art:"tile_ceiling",solid:true},
  "g":{art:"tile_grate",oneway:true},
  "P":{art:"tile_wall_panel"},
  "o":{art:"tile_porthole"},
  "c":{art:"tile_conduit",fps:5},
  "d":{art:"tile_debris"},
  "T":{art:"tile_teleporter",fps:4},
  "R":{art:"tile_rib_top"},
  "r":{art:"tile_rib_mid"},
  "B":{art:"tile_rib_base"},
  "k":{art:"tile_crate"},
  "s":{art:"tile_screen"},
  "=":{art:"tile_vfloor_a",alt:"tile_vfloor_b",solid:true},
  "H":{art:"tile_vblock",solid:true},
  "h":{art:"tile_vfill",solid:true},
  "-":{art:"tile_vplat",oneway:true},
  "u":{art:"tile_vgird"},
  "n":{art:"tile_vsign",fps:2},
  "a":{art:"tile_vantenna"},
  "Q":{art:"tile_cache",fps:2,solid:true},
  "q":{art:"tile_cache_used",solid:true}
};
function drawTiles(ctx,map,camX,t,store){
  const cam=Math.round(camX),c0=Math.max(0,(cam/8)|0),c1=Math.min(map[0].length-1,((cam+220)/8|0)+1);
  for(let j=0;j<map.length;j++){
    const row=map[j];
    for(let i=c0;i<=c1;i++){
      const d=EGG_TILE[row[i]];
      if(!d)continue;
      let art=d.art;
      if(d.alt&&((i*7+j)%3===0))art=d.alt;
      const fr=(store&&store[art])||((EGG_THEME.active&&SPRT&&SPRT[art])?SPRT[art]:SPR[art]);
      ctx.drawImage(fr.length>1?fr[((t*(d.fps||4))|0)%fr.length]:fr[0],i*8-cam,j*8);
    }
  }
}
function tileAt(map,x,y){
  const i=(x/8)|0,j=(y/8)|0;
  if(j<0||j>=map.length||i<0||i>=map[0].length)return".";
  return map[j][i];
}
function tileSolid(map,x,y){const d=EGG_TILE[tileAt(map,x,y)];return!!(d&&d.solid)}
function landAt(map,x,prevY,newY){
  const i=(x/8)|0;
  if(i<0||i>=map[0].length)return null;
  const r0=Math.max(0,(prevY/8)|0),r1=Math.min(map.length-1,(newY/8)|0);
  for(let j=r0;j<=r1;j++){
    const d=EGG_TILE[map[j][i]];
    if(d&&(d.solid||d.oneway)){
      const top=j*8;
      if(prevY<=top+.6&&newY>=top)return top;
    }
  }
  return null;
}
/* three parallax strips behind the tile map — all offsets pixel-snapped */
function drawParallaxMars(ctx,camX,t){
  /* sky: dusk purple up high falling to dusty rose at the canyon rim */
  ctx.fillStyle=EGG_THEME.sky[0];ctx.fillRect(0,0,220,22);
  ctx.fillStyle=EGG_THEME.sky[1];ctx.fillRect(0,22,220,18);
  ctx.fillStyle="#8a4a34";ctx.fillRect(0,40,220,14);
  ctx.fillStyle="#c4684a";ctx.fillRect(0,54,220,76);
  /* a small pale sun low over the rim + two hurrying moons */
  ctx.fillStyle="#f2d8b0";ctx.fillRect(168,26,6,6);ctx.fillRect(167,27,8,4);
  ctx.fillStyle="#d9a05e";ctx.fillRect(52,14,2,2);ctx.fillRect(120,20,1,1);
  /* far x0.2 — butte / mesa silhouettes */
  const f=Math.round(camX*.2),MS=56;
  for(let i=((f/MS)|0)-1;i<((f+220)/MS|0)+2;i++){
    const mx=i*MS-f,hw=14+(i*7)%11,ht=16+(i*13)%15,top=54-ht;
    ctx.fillStyle=EGG_THEME.butte;
    ctx.fillRect(mx+6,top+4,hw+12,ht+20);          /* skirt */
    ctx.fillRect(mx+10,top,hw+4,6);                 /* flat cap */
    ctx.fillStyle=EGG_THEME.buttelit;
    ctx.fillRect(mx+10,top,hw+4,1);                 /* lit rim */
  }
  ctx.fillStyle=EGG_THEME.butte;ctx.fillRect(0,74,220,4);
  /* mid x0.45 — rocky canyon walls, ochre faces with rust shadow + strata */
  const m=Math.round(camX*.45),RB=44;
  for(let i=((m/RB)|0)-1;i<((m+220)/RB|0)+2;i++){
    const rx=i*RB-m,wd=18+(i*5)%13,top=58+(i*11)%10;
    ctx.fillStyle=EGG_THEME.canyon;ctx.fillRect(rx,top,wd,112-top);
    ctx.fillStyle=EGG_THEME.canyonlit;ctx.fillRect(rx,top,3,112-top);
    ctx.fillStyle=EGG_THEME.canyondk;ctx.fillRect(rx+wd-2,top,2,112-top);
    ctx.fillStyle=EGG_THEME.canyonlit;ctx.fillRect(rx,top,wd,1);
    ctx.fillStyle=EGG_THEME.canyondk;
    for(let s2=top+7;s2<108;s2+=9)ctx.fillRect(rx+2,s2,wd-3,1); /* strata */
  }
  /* near x0.7 — desert scrub / rock bands above the deck */
  const n=Math.round(camX*.7);
  ctx.fillStyle=EGG_THEME.rock;ctx.fillRect(0,104,220,8);
  ctx.fillStyle=EGG_THEME.sand;ctx.fillRect(0,104,220,1);
  for(let i=((n/28)|0)-1;i<((n+220)/28|0)+2;i++){
    const px2=i*28-n;
    ctx.fillStyle=EGG_THEME.canyondk;ctx.fillRect(px2+4,106+(i*3)%3,5,3);   /* rocks */
    ctx.fillStyle=EGG_THEME.scrub;                                          /* scrub tufts */
    ctx.fillRect(px2+16,103+(i*5)%3,1,2);ctx.fillRect(px2+15,104+(i*5)%3,3,1);
    ctx.fillRect(px2+22,105,1,1);
  }
}
function drawParallax(ctx,camX,t){
  if(EGG_THEME.active==="mars")return drawParallaxMars(ctx,camX,t);
  ctx.fillStyle=PAL[1];ctx.fillRect(0,0,220,130);
  /* far x0.2 — hull windows onto the void */
  const f=Math.round(camX*.2),WIN=46;
  for(let i=((f/WIN)|0)-1;i<((f+220)/WIN|0)+2;i++){
    const wx=i*WIN-f+8;
    ctx.fillStyle=PAL[2];ctx.fillRect(wx-1,17,20,14);
    ctx.fillStyle=PAL[0];ctx.fillRect(wx,18,18,12);
    ctx.fillStyle=PAL[6];ctx.fillRect(wx+3+(i*5)%9,21,1,1);
    ctx.fillStyle=PAL[7];ctx.fillRect(wx+2+(i*11)%13,25+(i*3)%4,1,1);
    ctx.fillStyle=PAL[5];ctx.fillRect(wx+9+(i*7)%7,19+(i*13)%9,1,1);
  }
  ctx.fillStyle=PAL[2];ctx.fillRect(0,31,220,2);
  /* mid x0.45 — inner hull ribs + machinery blocks */
  const m=Math.round(camX*.45),RB=34;
  for(let i=((m/RB)|0)-1;i<((m+220)/RB|0)+2;i++){
    const rx=i*RB-m+4;
    ctx.fillStyle=PAL[2];ctx.fillRect(rx,34,6,78);
    ctx.fillStyle=PAL[3];ctx.fillRect(rx+2,34,1,78);
    ctx.fillStyle=PAL[2];ctx.fillRect(rx+9,96+(i*5)%9,14,16);
  }
  /* near x0.7 — overhead conduit run with blinking service lights */
  const n=Math.round(camX*.7);
  ctx.fillStyle=PAL[2];ctx.fillRect(0,10,220,3);
  ctx.fillStyle=PAL[3];ctx.fillRect(0,11,220,1);
  for(let i=((n/40)|0)-1;i<((n+220)/40|0)+2;i++){
    const px2=i*40-n+12;
    ctx.fillStyle=PAL[2];ctx.fillRect(px2,13,2,5+(i*7)%6);
    const on=EGG_RM?false:(((t*2)|0)+i)%2===0;
    ctx.fillStyle=PAL[on?9:8];ctx.fillRect(px2,18+(i*7)%6,2,2);
  }
}
/* framed boss health bar (HUD art) */
function drawBossBar(ctx,x,y,w,frac,label){
  x=Math.round(x);y=Math.round(y);
  ctx.fillStyle=PAL[2];ctx.fillRect(x-1,y-1,w+2,7);
  ctx.fillStyle=PAL[6];
  ctx.fillRect(x-1,y-1,w+2,1);ctx.fillRect(x-1,y+5,w+2,1);
  ctx.fillRect(x-1,y-1,1,7);ctx.fillRect(x+w,y-1,1,7);
  ctx.fillStyle=PAL[1];ctx.fillRect(x,y,w,5);
  const k=Math.max(0,Math.min(1,frac));
  ctx.fillStyle=PAL[14];ctx.fillRect(x,y,Math.round(w*k),5);
  ctx.fillStyle=PAL[13];ctx.fillRect(x,y,Math.round(w*k),1);
  if(label)drawText(ctx,x,y-7,label,12);
}

/* easter egg: RELAY RUN — the full 8-bit run-and-gun (Stage 2).
   The fiction: an alien freighter has been vacuuming up Earth's audiovisual
   equipment. Displays crated on the CARGO DECK, every stolen cable feeding
   the engine on the CABLE RUN, and at the SIGNAL CORE something that eats
   the signal itself. You are the AV INTEGRATOR sent up to take it all back.
   Three missions: briefing -> level -> boss door -> boss arena -> debrief.
   Weapons are recovered AV gear: HDMI->BLASTER · DISPLAY->MULTICAST ·
   COIL->FIBER · SPEAKER->SUBWOOFER · SWITCH levels the current weapon ·
   SURGE absorbs one hit. Death drops you back to the CRIMPER.
   Maps are string arrays (chars = EGG_TILE codes); entity chars are parsed
   out at load: S smasher · Z zapper · N snatcher · V vent · K crates prop ·
   D boss door · capsules 1 hdmi 2 display 3 coil 4 speaker 5 switch 6 surge. */
let eggAnim=null,eggBest=0,eggRelayKeys=null;

/* weapon table — [L1,L2] per stat */
const EGG_WPN={
  crimper:  {name:"CRIMPER",  cd:[.30,.22], spd:[190,190], dmg:[1,1], kind:"crimp"},
  blaster:  {name:"BLASTER",  cd:[.11,.085],spd:[230,240], dmg:[1,1], kind:"blast"},
  multicast:{name:"MULTICAST",cd:[.34,.30], spd:[180,180], dmg:[1,1], kind:"multi"},
  fiber:    {name:"FIBER",    cd:[.24,.19], spd:[300,300], dmg:[1,2], kind:"fiber",pierce:true},
  subwoofer:{name:"SUBWOOFER",cd:[.55,.45], spd:[85,95],   dmg:[3,4], kind:"sub",pierce:true,wall:true},
  projector:{name:"PROJECTOR",cd:[.50,.40], spd:[150,165], dmg:[2,3], kind:"lens",g:250,splash:20},
  autopair: {name:"AUTOPAIR", cd:[.26,.20], spd:[175,190], dmg:[1,1], kind:"pair",home:true},
  reflector:{name:"REFLECTOR",cd:[.30,.24], spd:[210,225], dmg:[1,2], kind:"mirror",bounce:3}
};
const EGG_ITEM_WPN={hdmi:"blaster",display:"multicast",coil:"fiber",speaker:"subwoofer",lens:"projector",pair:"autopair",mirror:"reflector"};
const EGG_WPN_ITEM={blaster:"hdmi",multicast:"display",fiber:"coil",subwoofer:"speaker",projector:"lens",autopair:"pair",reflector:"mirror"};
const EGG_ITEM_ICON={hdmi:"pk_hdmi",display:"pk_display",coil:"pk_coil",speaker:"pk_speaker","switch":"pk_switch",surge:"pk_surge",lens:"pk_lens",pair:"pk_pair",mirror:"pk_mirror"};
const EGG_ITEM_NAME={hdmi:"HDMI - BLASTER",display:"DISPLAY - MULTICAST",coil:"COIL - FIBER",speaker:"SPEAKER - SUBWOOFER","switch":"LEVEL UP",surge:"SURGE SHIELD",lens:"LENS - PROJECTOR",pair:"BT - AUTOPAIR",mirror:"MIRROR - REFLECTOR"};

const EGG_MISSIONS=[
{num:"01",title:"THE CARGO DECK",secured:"CARGO DECK SECURED",
 brief:["THEY'RE CRATING UP EARTH'S DISPLAYS.","GET THEM BACK.","",
        "CLEAR THE DECK. SHOOT CAPSULES OPEN -","THE GEAR INSIDE IS YOURS.",
        "SOMETHING HYDRAULIC GUARDS","THE FREIGHT LIFT."],
 arena:122,bossName:"PANEL CRUSHER",bossHp:28,
 carriers:[{x0:320,x1:930,y:20,spd:22,cargo:"display"}],
 zapDrops:[null,"switch"],ventDrops:["surge"],plats:[],teles:[],
 map:[
"^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^",
"W....................................................................................................................................................W",
"W...cc......cccccc......cccccc......cccccc......cccccc......cccccc......cccccc......cccccc......cccccc......cccccc......cccccc......cccccc...........W",
"W...............R...................................................R................................................................................W",
"W...............r...................................................r................................................................................W",
"W.......o.......r....o............o............o............o.......r....o............o............o............o....................................W",
"W............P..r.........P............P............P...........6P..r.........P............P............P............P...............................W",
"W...............r...................................................r.......................................5........................................W",
"W...............r.............................................ggggg.r................................................................................W",
"W...............r...1.......................P.......................r.................P..............................................................W",
"W...............r...................................................r................................................Z...............................W",
"W...............r.......gggggg..............................gggggg..r...................gggggggg...................gggggg............................W",
"W...............r.............K.....................................r....................................K...........................................W",
"W...............B.............d..kSs................S..kk.Z.......d.B.Ss............................V...k.......S.......D............................W",
"##############################################....########################################....########################################################",
"WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW....WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW....WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
"WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW....WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW....WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW"]},
{num:"02",title:"THE CABLE RUN",secured:"CABLE RUN SEVERED",
 brief:["EVERY STOLEN CABLE FEEDS THEIR ENGINE.","CUT THE LINE.","",
        "MIND THE GAPS. RIDE THE SERVICE","PLATFORMS. THE CONDUIT HAS GROWN",
        "A GUARDIAN - IT USED TO BE OUR CABLE."],
 arena:136,bossName:"CABLE WYRM",bossHp:34,
 carriers:[{x0:480,x1:1030,y:18,spd:26,cargo:"speaker"}],
 zapDrops:[null,"switch",null],ventDrops:["display"],
 plats:[{cx:600,cy:96,dx:26,dy:0,per:5.2},{cx:884,cy:84,dx:0,dy:22,per:4.6}],teles:[],
 map:[
"^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^",
"W..................................................................................................................................................................W",
"W...cc......cccccc......cccccc......cccccc......cccccc......cccccc......cccccc......cccccc......cccccc......cccccc......cccccc......cccccc......cccccc......cc.....W",
"W...cc......cccccc......ccccccR.....cccccc......cccccc......cccccc......cccccc......cccccc......cccccc......cccccc......cccccc......cccccc......cccccc......cc.....W",
"W.............................r...................................................................r................................................................W",
"W.......o................o....r...........o................o................o.......ggggg....o....r...........o................o...................................W",
"W............P................P................P................P................P..............5.P................P................P..............................W",
"W.............................r...................................................................r................................................................W",
"W.....................ggggg...r.................3.....ggggg.......................ggggg...........r...........................ggggg................................W",
"W.............P.....6.........r...................................................................r.N...............................P..............................W",
"W.............................r.............N.....................Z...............................r.....................Z..........................................W",
"W...................ggggg.....r.............gggggg..gggggg......ggggg...........gggggg....ggggg...r.gggggg............gggggg.......................................W",
"W.............................r...................................................................r................................................................W",
"W.........................S...B...Z..........d..........S.sk........................V..d....S.....B..........................dS....S..D............................W",
"######################################.....#############################......##############################.....###################################################",
"WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW.....WWWWWWWWWWWWWWWWWWWWWWWWWWWWW......WWWWWWWWWWWWWWWWWWWWWWWWWWWWWW.....WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
"WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW.....WWWWWWWWWWWWWWWWWWWWWWWWWWWWW......WWWWWWWWWWWWWWWWWWWWWWWWWWWWWW.....WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW"]},
{num:"03",title:"THE SIGNAL CORE",secured:"SIGNAL CORE UNPLUGGED",
 brief:["THEY EAT THE SIGNAL ITSELF.","UNPLUG THEM.","",
        "TELEPORTER PADS: STAND ON ONE,","PRESS DOWN. CLOSE THE VENTS.",
        "AT THE CORE: FIGHT THE VACUUM.","WAIT FOR THE MOUTH."],
 arena:150,bossName:"SIGNAL EATER",bossHp:44,
 carriers:[{x0:640,x1:1160,y:16,spd:30,cargo:"switch"}],
 zapDrops:[null,"switch",null,"surge",null],ventDrops:["display",null,"switch"],
 plats:[],teles:[[34,74],[102,142]],
 map:[
"^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^",
"W................................................................................................................................................................................W",
"W...cc......cccccc......cccccc......cccccc......cccccc......cccccc......cccccc......cccccc......cccccc......cccccc......cccccc......cccccc......cccccc......cccccc......cccc.....W",
"W...cc......cccccc......cccccc......cccccc......cccccc......cccccc......cccccc......cccccc....R.cccccc......cccccc......cccccc......cccccc......cccccc......cccccc......cccc.....W",
"W.................................................r...........................................r..................................................................................W",
"W.......o........2.........o................ggggg.r..............o..................o.........r........o..................o..................o...................................W",
"W............P..................P.................rP........5.........P..................P....r.............P..................P..................P..............................W",
"W.................................................r...........................Z.............6.r....................................Z.............................................W",
"W...............ggggg.....................ggggg...r.........................ggggg.............r...ggggg...........................ggggg...5......................................W",
"W...........P.....................................r.................................N.........r..................................................N...............................W",
"W...................................N.............r.....Z.....................................r.............Z...N................................................................W",
"W.............ggggg..........gggggg.....gggggg....r...ggggg.....gggggggg..ggggg.........ggggg.r.ggggg.....ggggg......ggggggg....ggggg...ggggg....................................W",
"W.................................................r...........................................r..................................................................................W",
"W.................S...S.s...Z.....TT........V...S.B.d.........s.........S.TT......d...V.......B...S...TTs.........S...........V.......S.......TT.d..D............................W",
"##############################....################################.....###############################################.....#######################################################",
"WWWWWWWWWWWWWWWWWWWWWWWWWWWWWW....WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW.....WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW.....WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
"WWWWWWWWWWWWWWWWWWWWWWWWWWWWWW....WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW.....WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW.....WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW"]}
];

function eggOpen(){
  document.getElementById("egg").style.display="flex";
  EggAudio.init();EggAudio.ambientStart();eggSyncMute();
  document.getElementById("egg-key").innerHTML=renderKey([["← →","run"],["Z","jump"],["X / Space","fire"],["↑ ↓","aim"],["↓","teleport"],["P","pause"],["M","mute"],["Esc","mission control"]]);
  eggRelayRun();
}
function eggRelayRun(){
  const IW=220,IH=130,c=document.getElementById("eggc"),dctx=eggCanvas("eggc",880,520);
  eggPxInit();
  const off=document.createElement("canvas");off.width=IW;off.height=IH;
  const x=off.getContext("2d");
  eggEndDismiss();
  if(eggAnim){cancelAnimationFrame(eggAnim);eggAnim=null}
  if(eggRelayKeys){removeEventListener("keydown",eggRelayKeys);removeEventListener("keyup",eggRelayKeys)}
  /* tuning (internal px): run 62/s · jump -160 @ g430 (~30px arc) · coyote
     80ms · jump buffer 90ms · weapon cds in EGG_WPN · 5 lives for the game */
  const RUN=62,GRAV=430,JV=-160,COYOTE=.08,JBUF=.09,DG=.70710678;
  let mission=0,score=0,lives=5,alive=true,paused=false,peace=false;
  let state="brief",briefT=0,briefDone=false,clearT=0,clearData=null,winT=0;
  let map=null,LW=0,arenaX=0,bossCam=0,doorX=0,props=[];
  let enemies=[],capsules=[],pickups=[],bullets=[],eshots=[],parts=[],floats=[],fx=[],plats=[],teles=[];
  let boss=null,bossLock=false,bossDown=false;
  let weapon="crimper",wlvl=1,shield=0;
  let px=16,py=112,vy=0,facing=1,grounded=true,coyote=0,jbuf=0,fireCd=0,flash=0,dying=0,invuln=1,landCd=0,downEdge=false;
  let camX=0,elapsed=0,last=null,banner=null,shake=0,lastSafe={x:16,y:112};
  let hitStop=0,respawnFlash=0,phaseFlash=0;   // stage-3 juice (all RM-guarded at the set sites)
  let missionTime=0,missionDeaths=0,teleCd=0;
  const keys={};
  function hud(){
    document.getElementById("eggs").textContent=score;
    document.getElementById("egglv").textContent=(mission+1);
    document.getElementById("eggb").textContent=eggBest;
  }
  function popText(tx,ty,txt,ci){floats.push({x:tx,y:ty,txt,ci,a:1})}
  function sparks(bx,by,ci,n){if(EGG_RM)return;for(let i=0;i<(n||8);i++)parts.push({x:bx,y:by,vx:(Math.random()-.5)*60,vy:(Math.random()-.8)*50,a:1,ci})}
  function chunks(bx,by,ci){if(EGG_RM)return;const n=4+((Math.random()*3)|0);
    for(let i=0;i<n;i++)parts.push({x:bx,y:by,vx:(Math.random()-.5)*70,vy:-26-Math.random()*46,a:1,ci,s:2})}
  function boom(bx,by,size){fx.push({x:bx,y:by,t:0});EggAudio.explode(size==null?.4:size);if(!EGG_RM)shake=Math.max(shake,size>=.6?3:1.6)}
  /* ---------------- mission load / parse ---------------- */
  function mkSmasher(sx,fy){return{type:"smasher",x:sx,y:fy,dir:-1,hp:2,fl:0,lunge:0,lcd:0}}
  function loadMission(mi){
    mission=mi;
    const md=EGG_MISSIONS[mi];
    const rows=md.map.map(r=>r.split(""));
    enemies=[];capsules=[];pickups=[];bullets=[];eshots=[];parts=[];floats=[];fx=[];props=[];teles=[];
    boss=null;bossLock=false;bossDown=false;doorX=0;
    let zi=0,vi=0;
    const Wd=rows[0].length,ITEMS=["hdmi","display","coil","speaker","switch","surge","lens","pair","mirror"];
    for(let i=0;i<Wd;i++)for(let j=0;j<rows.length;j++){
      const ch=rows[j][i];
      if("SZNVKD123456789".indexOf(ch)<0)continue;
      rows[j][i]=".";
      const cx=i*8+4,fy=(j+1)*8;
      if(ch==="S")enemies.push(mkSmasher(cx,fy));
      else if(ch==="Z")enemies.push({type:"zapper",x:i*8+5,y:j*8+5,hp:3,fl:0,st:"idle",t:.6+(i%5)*.2,burst:0,drop:md.zapDrops[zi++]||null});
      else if(ch==="N")enemies.push({type:"snatcher",x:cx,y:j*8+4,ax:cx,ay:j*8+4,st:"fly",t:i*.13,hp:2,fl:0,carry:null,dcd:0});
      else if(ch==="V")enemies.push({type:"vent",x:cx,y:fy,hp:6,fl:0,t:1.6,kids:[],drop:md.ventDrops[vi++]||null});
      else if(ch==="K")props.push({art:"prop_crates",x:i*8,y:fy-16});
      else if(ch==="D"){doorX=i*8;props.push({art:"prop_bossdoor",x:i*8,y:fy-24})}
      else capsules.push({x:cx,y0:j*8+6,t:(i%7)*.3,item:ITEMS[+ch-1]});
    }
    md.carriers.forEach(cr=>enemies.push({type:"carrier",x:cr.x0,y:cr.y,dir:1,x0:cr.x0,x1:cr.x1,spd:cr.spd,cargo:cr.cargo,hp:1,fl:0}));
    plats=md.plats.map(p=>({cx:p.cx,cy:p.cy,dx:p.dx,dy:p.dy,per:p.per,x:p.cx,y:p.cy,pxv:0,pyv:0}));
    teles=md.teles.map(pr=>pr.map(col=>col*8+8));
    map=rows.map(r=>r.join(""));
    LW=Wd*8;arenaX=md.arena*8;bossCam=LW-IW;
    px=16;py=112;vy=0;facing=1;grounded=true;coyote=0;jbuf=0;fireCd=0;flash=0;dying=0;invuln=1;
    camX=0;lastSafe={x:16,y:112};missionTime=0;missionDeaths=0;teleCd=0;shake=0;
    state="brief";briefT=0;briefDone=false;banner=null;
    hud();
  }
  /* briefing text: header + lines, typed at 30 chars/s */
  function briefLines(){
    const md=EGG_MISSIONS[mission];
    return["MISSION "+md.num+" - "+md.title,""].concat(md.brief);
  }
  function briefTotal(){return briefLines().reduce((a,l)=>a+l.length+1,0)}
  function advance(){                       // fire/Enter in non-play states
    if(state==="brief"){
      if(!briefDone&&briefT*30<briefTotal()){briefDone=true;return}
      state="play";banner={txt:EGG_MISSIONS[mission].title,sub:"GO RIGHT",t:0};
      EggAudio.missionStart();return;
    }
    if(state==="clear"){
      if(clearT<.8)return;
      if(mission<2){loadMission(mission+1)}
      else{state="win";winT=0;eggBest=Math.max(eggBest,score);hud();EggAudio.victory()}
      return;
    }
    if(state==="win"){
      if(winT<.8)return;
      alive=false;eggAnim=null;
      eggBest=Math.max(eggBest,score);hud();
      eggEndScreen({host:c.parentElement,title:"Earth's AV is safe.",
        lines:["— every display accounted for.","Score "+score+" · Session best "+eggBest],
        onReplay:eggRelayRun,onMenu:()=>{eggClose();eggMenu()}});
    }
  }
  /* ---------------- input ---------------- */
  eggRelayKeys=e=>{
    if(document.getElementById("egg").style.display!=="flex")return;
    if(["ArrowLeft","ArrowRight","ArrowUp","ArrowDown"," "].includes(e.key))e.preventDefault();
    const k=e.key.length===1?e.key.toLowerCase():e.key;
    if(e.type==="keydown"){
      if((k==="p")&&alive&&state==="play"){paused=!paused;return}
      if(!paused&&(k==="x"||k===" "||k==="Enter")&&state!=="play"&&!keys[k]){keys[k]=true;advance();return}
      if((k==="z")&&!keys.z)jbuf=JBUF;
      if(k==="ArrowDown"&&!keys.ArrowDown)downEdge=true;
    }
    keys[k]=e.type==="keydown";
  };
  addEventListener("keydown",eggRelayKeys);addEventListener("keyup",eggRelayKeys);
  function aimVec(){
    const u=keys.ArrowUp,d=keys.ArrowDown,h=(keys.ArrowRight?1:0)-(keys.ArrowLeft?1:0);
    if(u)return h?{x:h*DG,y:-DG}:{x:0,y:-1};
    if(d){if(h)return{x:h*DG,y:DG};if(!grounded)return{x:0,y:1}}
    return{x:facing,y:0};
  }
  /* ---------------- weapons / pickups ---------------- */
  function shoot(a,w,lv){
    const spd=w.spd[lv-1];
    bullets.push({x:px+a.x*9,y:py-11+a.y*9,vx:a.x*spd,vy:a.y*spd,dmg:w.dmg[lv-1],pierce:!!w.pierce,wall:!!w.wall,kind:w.kind,hit:w.pierce?[]:null,ttl:3,g:w.g||0,home:!!w.home,bounce:w.bounce||0,splash:w.splash||0});
  }
  function fireGun(){
    const w=EGG_WPN[weapon],a=aimVec();
    if(w.kind==="multi"){
      const base=Math.atan2(a.y,a.x),offs=wlvl>1?[0,.26,-.26,.52,-.52]:[0,.3,-.3];
      offs.forEach(o=>shoot({x:Math.cos(base+o),y:Math.sin(base+o)},w,wlvl));
    }else shoot(a,w,wlvl);
    flash=.05;EggAudio.laser(w.kind);
  }
  function applyPickup(item){
    score+=100;hud();
    popText(px,py-14,"+100",6);
    if(!EGG_RM)fx.push({x:px,y:py-10,t:0,kind:"ring"});
    const w=EGG_ITEM_WPN[item];
    if(w){
      if(weapon===w){if(wlvl<2){wlvl=2;popText(px,py-24,w.toUpperCase()+" L2",12)}else{score+=200;popText(px,py-24,"+200",6)}}
      else{weapon=w;wlvl=1;popText(px,py-24,EGG_WPN[w].name,9)}
      EggAudio.weaponGet();
    }else if(item==="switch"){
      if(wlvl<2){wlvl=2;popText(px,py-24,EGG_WPN[weapon].name+" L2",12)}
      else{score+=200;popText(px,py-24,"+200",6)}
      EggAudio.levelUp();
    }else{ // surge
      shield=1;popText(px,py-24,"SURGE SHIELD",10);EggAudio.powerup();
    }
    hud();
  }
  function openCapsule(cp){
    cp.dead=true;
    pickups.push({item:cp.item,x:cp.x,y:cp.y0,vy:-40});
    sparks(cp.x,cp.y0,5,10);EggAudio.blip();
    popText(cp.x,cp.y0-10,"OPEN!",12);
  }
  /* ---------------- damage ---------------- */
  function hurtPlayer(fell){
    if(!alive||dying>0||state!=="play")return;
    if(!fell){
      if(invuln>0)return;
      if(shield>0){shield=0;invuln=1.2;EggAudio.catchBad();sparks(px,py-10,10,12);popText(px,py-24,"SURGE SPENT",10);return}
    }
    lives--;missionDeaths++;
    if(weapon!=="crimper"||wlvl>1)popText(px,py-30,"WEAPON LOST",14);
    weapon="crimper";wlvl=1;shield=0;
    EggAudio.explode(.55);EggAudio.catchBad();sparks(px,py-10,13,14);
    if(!EGG_RM)hitStop=Math.max(hitStop,.05);
    dying=.62;hud();
  }
  function gameOver(){
    if(!alive)return;
    alive=false;eggAnim=null;
    eggBest=Math.max(eggBest,score);hud();
    EggAudio.gameOver();
    eggEndScreen({host:c.parentElement,title:"The signal went dark.",
      lines:["Score "+score+" · mission "+(mission+1)+"/3","Session best "+eggBest],
      onReplay:eggRelayRun,onMenu:()=>{eggClose();eggMenu()}});
  }
  function killEnemy(e){
    e.dead=true;
    const pts=e.type==="smasher"?50:e.type==="carrier"?100:e.type==="snatcher"?(e.carry?150:100):e.type==="zapper"?100:150;
    score+=pts;hud();popText(e.x,e.y-14,"+"+pts,6);
    boom(e.x,e.y-6,e.type==="vent"?.6:.35);
    chunks(e.x,e.y-6,{smasher:9,zapper:14,snatcher:9,vent:3,carrier:4}[e.type]||15);
    if(e.type==="carrier"&&e.cargo)capsules.push({x:e.x,y0:Math.min(96,e.y+16),t:0,item:e.cargo});
    if(e.type==="snatcher"&&e.carry)capsules.push({x:Math.max(camX+14,Math.min(camX+206,e.x)),y0:Math.max(36,Math.min(80,e.y)),t:0,item:e.carry});
    if((e.type==="zapper"||e.type==="vent")&&e.drop)capsules.push({x:e.x,y0:e.y-22,t:0,item:e.drop});
    else if(!e.cargo&&!e.carry&&!e.drop&&Math.random()<.07)capsules.push({x:Math.max(camX+12,Math.min(camX+208,e.x)),y0:Math.max(32,Math.min(88,e.y-18)),t:0,item:["lens","pair","mirror","switch"][Math.floor(Math.random()*4)]});
  }
  function splashAt(sx,sy,b){
    boom(sx,sy-2,.5);
    for(const e of enemies){
      if(e.dead)continue;
      const bb=ebox(e),ex=(bb[0]+bb[2])/2,ey=(bb[1]+bb[3])/2;
      if(Math.hypot(ex-sx,ey-sy)<(b.splash||20))hitEnemy(e,b.dmg);
    }
  }
  function hitEnemy(e,dmg){
    e.hp-=dmg;e.fl=.12;
    if(e.hp<=0)killEnemy(e);else EggAudio.blip();
  }
  function playerBox(){return{x0:px-4,y0:py-16,x1:px+4,y1:py}}
  function overlaps(b,x0,y0,x1,y1){return b.x1>x0&&b.x0<x1&&b.y1>y0&&b.y0<y1}
  function ebox(e){
    if(e.type==="smasher")return[e.x-6,e.y-12,e.x+6,e.y];
    if(e.type==="zapper")return[e.x-5,e.y-5,e.x+5,e.y+5];
    if(e.type==="snatcher")return[e.x-6,e.y-4,e.x+6,e.y+4];
    if(e.type==="vent")return[e.x-7,e.y-14,e.x+7,e.y];
    return[e.x-7,e.y-5,e.x+7,e.y+5]; // carrier
  }
  /* ---------------- enemy behaviors ---------------- */
  function groundAhead(e,d){return tileSolid(map,e.x+d*7,e.y+2)||EGG_TILE[tileAt(map,e.x+d*7,e.y+2)]&&EGG_TILE[tileAt(map,e.x+d*7,e.y+2)].oneway}
  function wallAhead(e,d){return tileSolid(map,e.x+d*7,e.y-6)}
  function updSmasher(e,dt){
    e.lcd-=dt;
    const near=Math.abs(e.x-px)<44&&Math.abs(e.y-py)<14;
    if(near&&e.lcd<=0&&e.lunge<=0){e.lunge=.7;e.lcd=2.2;e.dir=px>e.x?1:-1}
    const spd=e.lunge>0?58:18;
    if(e.lunge>0)e.lunge-=dt;
    if(wallAhead(e,e.dir)||!groundAhead(e,e.dir)){e.dir=-e.dir;e.lunge=0}
    else e.x+=e.dir*spd*dt;
    if(!peace&&invuln<=0&&overlaps(playerBox(),e.x-6,e.y-12,e.x+6,e.y))hurtPlayer();
  }
  function updZapper(e,dt){
    e.t-=dt;
    const seen=Math.abs(e.x-px)<100&&Math.abs(e.y-(py-10))<70;
    if(e.st==="idle"){if(e.t<=0&&seen){e.st="charge";e.t=mission===0?.7:.55}}
    else if(e.st==="charge"){if(e.t<=0){e.st="fire";e.t=0;e.burst=mission===0?2:3}}
    else{ // fire
      if(e.burst>0){
        if(e.t<=0){
          const dx=px-e.x,dy=(py-10)-e.y,dd=Math.max(1,Math.hypot(dx,dy)),zs=mission===0?76:90;
          eshots.push({x:e.x,y:e.y,vx:dx/dd*zs,vy:dy/dd*zs,kind:"zap",ttl:3});
          EggAudio.blip();e.burst--;e.t=.13;
        }
      }else{e.st="idle";e.t=1.4}
    }
  }
  function updSnatcher(e,dt){
    e.t+=dt;e.dcd-=dt;
    if(e.st==="fly"){
      e.x=e.ax+Math.sin(e.t*1.2)*24;e.y=e.ay+Math.sin(e.t*2.6)*5;
      if(e.dcd<=0&&Math.abs(e.x-px)<70&&py-10>e.y){
        const dx=px-e.x,dy=(py-10)-e.y,dd=Math.max(1,Math.hypot(dx,dy));
        e.st="dive";e.vx=dx/dd*95;e.vy=dy/dd*95;e.dt2=0;
      }
    }else if(e.st==="dive"){
      e.dt2+=dt;e.x+=e.vx*dt;e.y+=e.vy*dt;
      if(e.dt2>1.1||e.y>106){e.st="ret";e.dcd=2.5}
    }else if(e.st==="ret"){
      e.y-=42*dt;e.x+=(e.ax-e.x)*dt*1.4;
      if(e.y<=e.ay){e.y=e.ay;e.st="fly"}
    }else{ // flee (carrying)
      if(e.y>30)e.y-=34*dt;
      e.x+=Math.sin(e.t*2)*22*dt;
      e.x=Math.max(camX+12,Math.min(camX+208,e.x));
    }
    if(!peace&&dying<=0&&overlaps(playerBox(),e.x-6,e.y-4,e.x+6,e.y+4)){
      if(invuln>0)return;
      if(e.carry){hurtPlayer();return}
      let stole=null;
      if(wlvl>1){stole=EGG_WPN_ITEM[weapon]||"switch";wlvl=1}
      else if(weapon!=="crimper"){stole=EGG_WPN_ITEM[weapon];weapon="crimper";wlvl=1}
      if(stole){
        e.carry=stole;e.st="flee";invuln=Math.max(invuln,1);
        EggAudio.catchBad();sparks(px,py-14,14,8);
        popText(e.x,e.y-10,"SNATCHED!",14);
      }else hurtPlayer();
    }
  }
  function updVent(e,dt){
    e.kids=e.kids.filter(k=>!k.dead);
    e.t-=dt;
    if(e.t<=0&&e.kids.length<3){
      const s=mkSmasher(e.x,e.y);s.dir=px<e.x?-1:1;
      enemies.push(s);e.kids.push(s);
      sparks(e.x,e.y-7,9,8);EggAudio.thrust();
      e.t=2.8;
    }
  }
  function updCarrier(e,dt){
    e.x+=e.dir*e.spd*dt;
    if(e.x<e.x0){e.x=e.x0;e.dir=1}else if(e.x>e.x1){e.x=e.x1;e.dir=-1}
    if(!peace&&invuln<=0&&overlaps(playerBox(),e.x-7,e.y-5,e.x+7,e.y+5))hurtPlayer();
  }
  /* ---------------- bosses ---------------- */
  function mkBoss(){
    const md=EGG_MISSIONS[mission];
    const b={name:md.bossName,hp:md.bossHp,max:md.bossHp,phase:1,st:"intro",t:0,fl:0};
    if(mission===0){b.kind="crusher";b.x=bossCam+150;b.y=112;b.mode="idle";b.mt=.9;b.vx=0;b.lift=0}
    else if(mission===1){b.kind="wyrm";b.dir=1;b.hx=bossCam-30;b.baseY=46;b.passN=0;b.hist=[];b.spat=false;b.warn=.85}
    else{b.kind="eater";b.x=LW-28;b.y=92;b.mouth=0;b.mcd=2.2;b.pull=0;b.pullWarn=0;b.pcd=1.6;b.acd=1.4;b.gcd=2.4;b.bcd=3.2;b.beam=null}
    return b;
  }
  function enterBoss(){
    bossLock=true;boss=mkBoss();
    lastSafe={x:arenaX+14,y:112};
    eshots=[];banner=null;
    EggAudio.bossWarn();
  }
  function bossDamage(n){
    if(!boss||boss.st==="dead")return;
    boss.hp-=n;boss.fl=.12;
    if(!EGG_RM)hitStop=Math.max(hitStop,.04);        // ~40ms freeze on boss hits
    if(boss.phase===1&&boss.hp<=boss.max/2){
      boss.phase=2;boss.fl=.3;
      if(!EGG_RM){phaseFlash=.14;hitStop=Math.max(hitStop,.09);shake=Math.max(shake,2.6)}
      popText(camX+110,54,"IT'S ANGRY NOW",14);
      EggAudio.bossWarn();                            // the roar
      if(boss.kind==="crusher"){boss.mode="idle";boss.mt=.5;boss.lift=0}
    }
    if(boss.hp<=0){
      boss.hp=0;boss.st="dead";boss.t=0;boss.boomT=0;
      score+=800;hud();popText(camX+110,60,"+800",6);
      eshots=[];
    }
  }
  function bossHitTest(b2){ // player bullet vs boss; returns true if it connects
    if(!boss||boss.st!=="fight")return false;
    if(boss.kind==="crusher")
      return b2.x>boss.x-19&&b2.x<boss.x+19&&b2.y>boss.y-31-boss.lift&&b2.y<boss.y-boss.lift;
    if(boss.kind==="wyrm")
      return Math.abs(b2.x-boss.hx)<8&&Math.abs(b2.y-boss.hy)<8;
    // eater: only while the mouth is open, front plate
    if(boss.mouth>0)return b2.x>LW-52&&b2.x<LW-14&&b2.y>76&&b2.y<108;
    if(b2.x>LW-52&&b2.y>72){sparks(b2.x,b2.y,15,3);return"deflect"}
    return false;
  }
  function updBoss(dt){
    boss.t+=dt;if(boss.fl>0)boss.fl-=dt;
    if(boss.st==="intro"){if(boss.t>1.7){boss.st="fight";boss.t=0}return}
    if(boss.st==="dead"){
      boss.boomT-=dt;
      if(boss.boomT<=0){
        boss.boomT=boss.kind==="eater"?.14:.18;
        const bx=boss.kind==="wyrm"?boss.hx:(boss.kind==="eater"?LW-30:boss.x);
        const by=boss.kind==="wyrm"?boss.hy:(boss.kind==="eater"?86:boss.y-16);
        boom(bx+(Math.random()-.5)*30,by+(Math.random()-.5)*22,.7);
      }
      if(boss.t>(boss.kind==="eater"?2.4:1.8)){
        state="clear";clearT=0;
        const bonus=missionDeaths===0?1000:0;score+=bonus;
        clearData={bonus,time:missionTime};
        eggBest=Math.max(eggBest,score);hud();EggAudio.levelUp();
      }
      return;
    }
    if(boss.kind==="crusher")updCrusher(dt);
    else if(boss.kind==="wyrm")updWyrm(dt);
    else updEater(dt);
  }
  function updCrusher(dt){
    const b=boss;b.mt-=dt;
    const contact=()=>{if(!peace&&invuln<=0&&overlaps(playerBox(),b.x-18,b.y-30-b.lift,b.x+18,b.y-b.lift))hurtPlayer()};
    if(b.phase===1){
      if(b.mode==="idle"){
        b.x+=Math.max(-22,Math.min(22,px-b.x))*dt*.7;
        if(b.mt<=0){b.mode="rise";b.mt=.85}   // >=0.8s slam telegraph
      }else if(b.mode==="rise"){
        b.lift=Math.min(18,b.lift+60*dt);
        if(b.mt<=0){b.mode="slam";b.mt=.5}
      }else if(b.mode==="slam"){
        b.lift=Math.max(0,b.lift-150*dt);
        if(b.lift<=0&&b.mt>0){
          eshots.push({x:b.x-20,y:108,vx:-80,vy:0,kind:"wave",ttl:2.6});
          eshots.push({x:b.x+20,y:108,vx:80,vy:0,kind:"wave",ttl:2.6});
          boom(b.x,b.y-4,.6);b.mt=-.001;b.mode="lob";b.mt=.45;
        }
      }else{ // lob
        if(b.mt<=0){
          const dx=px-b.x;
          eshots.push({x:b.x,y:b.y-30,vx:Math.max(-90,Math.min(90,dx*1.1)),vy:-120,g:260,kind:"lob",ttl:4});
          EggAudio.thrust();
          b.mode="idle";b.mt=.9;
        }
      }
    }else{
      if(b.mode!=="charge"&&b.mode!=="tel"){b.mode="tel";b.mt=.45;b.fl=Math.max(b.fl,.2)}
      if(b.mode==="tel"&&b.mt<=0){b.mode="charge";b.vx=px>b.x?130:-130}
      if(b.mode==="charge"){
        b.x+=b.vx*dt;
        const lo=bossCam+24,hi=LW-24;
        if(b.x<lo||b.x>hi){
          b.x=Math.max(lo,Math.min(hi,b.x));
          boom(b.x,b.y-10,.7);
          for(let i=0;i<3;i++)eshots.push({x:Math.max(bossCam+12,Math.min(LW-12,px+(i-1)*26)),y:10,vx:0,vy:20,g:300,kind:"fall",ttl:3});
          b.mode="tel";b.mt=.8;
        }
      }
    }
    contact();
  }
  function updWyrm(dt){
    const b=boss,spd=b.phase===2?105:70;
    if(b.warn>0){b.warn-=dt;return}         // flashing ! at the entry side
    b.hx+=b.dir*spd*dt;
    b.hy=b.baseY+Math.sin(b.hx/18)*24;
    b.hist.unshift({x:b.hx,y:b.hy});
    if(b.hist.length>80)b.hist.pop();
    if(b.phase===2&&!b.spat&&Math.abs(b.hx-(bossCam+110))<14){
      b.spat=true;
      const base=Math.atan2((py-10)-b.hy,px-b.hx);
      [-.35,0,.35].forEach(o=>eshots.push({x:b.hx,y:b.hy,vx:Math.cos(base+o)*85,vy:Math.sin(base+o)*85,kind:"spit",ttl:3}));
      EggAudio.blip();
    }
    if((b.dir>0&&b.hx>bossCam+IW+40)||(b.dir<0&&b.hx<bossCam-40)){
      b.dir=-b.dir;b.passN++;b.spat=false;b.warn=b.phase===2?.35:.8;
      b.baseY=[46,72,94][b.passN%3];
      b.hx=b.dir>0?bossCam-30:bossCam+IW+30;
      b.hist=[];
    }
    if(!peace&&invuln<=0){
      const pb=playerBox();
      if(overlaps(pb,b.hx-7,b.hy-7,b.hx+7,b.hy+7))hurtPlayer();
      else for(let i=1;i<=8;i++){
        const p=b.hist[i*7];if(!p)break;
        if(overlaps(pb,p.x-4,p.y-4,p.x+4,p.y+4)){hurtPlayer();break}
      }
    }
  }
  function updEater(dt){
    const b=boss;
    b.mcd-=dt;b.acd-=dt;
    if(b.mcd<=0){b.mouth=1.3;b.mcd=3.6}
    if(b.mouth>0)b.mouth-=dt;
    if(b.phase===1){
      b.pcd-=dt;
      if(b.pcd<=0){b.pullWarn=.85;b.pcd=4.2}          // >=0.8s PULL! warning
      if(b.pullWarn>0){b.pullWarn-=dt;if(b.pullWarn<=0)b.pull=2.2}
      if(b.pull>0){
        b.pull-=dt;
        if(dying<=0&&state==="play"){px+=34*dt;if(!EGG_RM&&Math.random()<.5)parts.push({x:camX+Math.random()*200,y:20+Math.random()*100,vx:70,vy:0,a:.5,ci:10})}
      }
      if(b.acd<=0){
        b.acd=1.1;
        const ox=LW-46,oy=76,dx=px-ox,dy=(py-10)-oy,dd=Math.max(1,Math.hypot(dx,dy));
        eshots.push({x:ox,y:oy,vx:dx/dd*78,vy:dy/dd*78,kind:"zap",ttl:3.5});
        EggAudio.blip();
      }
    }else{
      b.gcd-=dt;b.bcd-=dt;
      if(b.gcd<=0){
        b.gcd=2.8;
        for(let i=0;i<4;i++)eshots.push({x:LW-56,y:34+i*22,y0:34+i*22,t:i*.6,vx:-46,vy:0,kind:"glyph",ttl:6,g2:"?!:/·+"[i%6]});
      }
      if(b.bcd<=0&&!b.beam){b.beam={y:[104,80,56][(Math.random()*3)|0],t:.7,on:0};b.bcd=5;EggAudio.bossWarn()}
      if(b.beam){
        if(b.beam.t>0){b.beam.t-=dt;if(b.beam.t<=0)b.beam.on=.45}
        else{
          b.beam.on-=dt;
          if(!peace&&invuln<=0&&dying<=0&&py>b.beam.y-3&&py-16<b.beam.y+3)hurtPlayer();
          if(b.beam.on<=0)b.beam=null;
        }
      }
    }
    if(!peace&&invuln<=0&&overlaps(playerBox(),LW-52,72,LW-4,112))hurtPlayer();
  }
  /* ---------------- master update ---------------- */
  function update(dt){
    elapsed+=dt;
    if(state==="brief"){briefT+=dt;return}
    if(state==="clear"){clearT+=dt;return}
    if(state==="win"){winT+=dt;return}
    missionTime+=dt;
    if(invuln>0)invuln-=dt;
    if(flash>0)flash-=dt;
    if(respawnFlash>0)respawnFlash-=dt;
    if(phaseFlash>0)phaseFlash-=dt;
    if(landCd>0)landCd-=dt;
    if(teleCd>0)teleCd-=dt;
    if(shake>0)shake-=dt*8;
    if(banner)banner.t+=dt;
    fx.forEach(f=>f.t+=dt);fx=fx.filter(f=>f.t<(f.kind==="dust"?.18:.34));
    /* moving platforms (before the player so carry works) */
    plats.forEach(p=>{
      const ph=Math.sin(elapsed*2*Math.PI/p.per);
      const nx=p.cx+ph*p.dx,ny=p.cy+ph*p.dy;
      p.pxv=nx-p.x;p.pyv=ny-p.y;p.x=nx;p.y=ny;
    });
    if(dying>0){
      dying-=dt;
      parts.forEach(p=>{p.x+=p.vx*dt;p.y+=p.vy*dt;p.a-=dt});
      if(dying<=0){
        if(lives<=0){gameOver();return}
        dying=0;px=lastSafe.x;py=lastSafe.y;vy=0;invuln=2;
        if(!EGG_RM)respawnFlash=.1;
        if(!bossLock)camX=Math.max(0,Math.min(LW-IW,px-IW*.42));
      }
      return;
    }
    /* run */
    const mv=(keys.ArrowRight?1:0)-(keys.ArrowLeft?1:0);
    if(mv)facing=mv;
    px+=mv*RUN*dt;
    const loX=bossLock?camX+5:4,hiX=LW-5;
    px=Math.max(loX,Math.min(hiX,px));
    /* jump: buffer + coyote */
    if(jbuf>0)jbuf-=dt;
    if(coyote>0)coyote-=dt;
    if(jbuf>0&&(grounded||coyote>0)){
      jbuf=0;coyote=0;vy=JV;grounded=false;EggAudio.jump();
      if(!EGG_RM)for(let i=0;i<4;i++)parts.push({x:px+(Math.random()-.5)*6,y:py,vx:(Math.random()-.5)*20,vy:10+Math.random()*16,a:.7,ci:4});
    }
    /* gravity + landings (tiles, then moving platforms) */
    const prevY=py,wasG=grounded;
    vy+=GRAV*dt;if(vy>240)vy=240;
    py+=vy*dt;
    grounded=false;
    if(vy>=0){
      const ly=landAt(map,px-3,prevY,py),ry=landAt(map,px+3,prevY,py);
      let top=ly==null?ry:(ry==null?ly:Math.min(ly,ry));
      for(const p of plats){
        const t2=p.y-4;
        if(Math.abs(px-p.x)<10&&prevY<=t2-p.pyv+1.2&&py>=t2){
          if(top==null||t2<top){top=t2;px+=p.pxv;py=t2}
        }
      }
      if(top!=null){py=top;vy=0;grounded=true}
    }
    if(wasG&&!grounded&&vy>=0)coyote=COYOTE;
    if(!wasG&&grounded&&landCd<=0){
      EggAudio.thrust();landCd=.25;
      if(!EGG_RM)fx.push({x:px,y:py,t:0,kind:"dust"});
    }
    if(grounded&&!bossLock&&tileAt(map,px,py+2)==="#"&&tileAt(map,px-6,py+2)==="#"&&tileAt(map,px+6,py+2)==="#")lastSafe={x:px,y:py};
    if(py>IH+16)return hurtPlayer(true);
    /* teleporter pads (M3): stand on a pad, press down */
    if(downEdge&&grounded&&teleCd<=0){
      for(const pr of teles){
        for(let k2=0;k2<2;k2++){
          if(Math.abs(px-pr[k2])<9){
            sparks(px,py-8,10,10);
            px=pr[1-k2];py=112;vy=0;teleCd=1;invuln=Math.max(invuln,.6);
            camX=Math.max(0,Math.min(LW-IW,px-IW*.42));
            sparks(px,py-8,10,10);EggAudio.powerup();
            break;
          }
        }
      }
    }
    downEdge=false;
    /* autofire */
    fireCd-=dt;
    if((keys.x||keys[" "])&&fireCd<=0){fireGun();fireCd=EGG_WPN[weapon].cd[wlvl-1]}
    /* camera + boss trigger */
    if(bossLock)camX+=(bossCam-camX)*Math.min(1,8*dt);
    else{
      const ct=Math.max(0,Math.min(LW-IW,px-IW*.42));
      camX+=(ct-camX)*Math.min(1,10*dt);
      if(!bossDown&&px>arenaX+10)enterBoss();
    }
    /* enemies (active near the camera) */
    enemies.forEach(e=>{
      if(e.fl>0)e.fl-=dt;
      const active=e.type==="carrier"||(e.st==="flee")||(e.x>camX-40&&e.x<camX+260);
      if(!active)return;
      if(e.type==="smasher")updSmasher(e,dt);
      else if(e.type==="zapper")updZapper(e,dt);
      else if(e.type==="snatcher")updSnatcher(e,dt);
      else if(e.type==="vent")updVent(e,dt);
      else updCarrier(e,dt);
    });
    enemies=enemies.filter(e=>!e.dead);
    if(boss)updBoss(dt);
    /* capsules bob */
    capsules.forEach(cp=>cp.t+=dt);
    capsules=capsules.filter(cp=>!cp.dead);
    /* freed pickups drop, then wait */
    pickups.forEach(pk=>{
      pk.vy+=GRAV*.6*dt;pk.y+=pk.vy*dt;
      const gy=landAt(map,pk.x,pk.y-1,pk.y+5);
      if(gy!=null&&pk.vy>0){pk.y=gy-5;pk.vy=0}
      if(pk.y>IH+10){pk.y=60;pk.vy=0} // fell in a pit: float it back up
      if(dying<=0&&Math.abs(pk.x-px)<7&&Math.abs(pk.y-(py-9))<11){pk.dead=true;applyPickup(pk.item)}
    });
    pickups=pickups.filter(pk=>!pk.dead);
    /* player bullets */
    bullets.forEach(b=>{
      if(b.g)b.vy+=b.g*dt;
      if(b.home){
        let bt=null,bd=1e9;
        for(const e of enemies){if(e.dead)continue;const d2=(e.x-b.x)*(e.x-b.x)+(e.y-b.y)*(e.y-b.y);if(d2<bd){bd=d2;bt=e}}
        if(bt&&bd<12000){
          const sp=Math.max(1,Math.hypot(b.vx,b.vy)),ang=Math.atan2(b.vy,b.vx),ta=Math.atan2(bt.y-6-b.y,bt.x-b.x);
          let da=ta-ang;while(da>Math.PI)da-=2*Math.PI;while(da<-Math.PI)da+=2*Math.PI;
          const na=ang+Math.max(-4.2*dt,Math.min(4.2*dt,da));
          b.vx=Math.cos(na)*sp;b.vy=Math.sin(na)*sp;
        }
      }
      b.x+=b.vx*dt;b.y+=b.vy*dt;b.ttl-=dt});
    bullets=bullets.filter(b=>{
      if(b.ttl<=0||b.x<camX-40||b.x>camX+IW+40||b.y<-10||b.y>IH+10)return false;
      if(!b.wall&&tileSolid(map,b.x,b.y)){
        if(b.bounce>0){
          b.bounce--;b.x-=b.vx*dt;b.y-=b.vy*dt;
          if(!tileSolid(map,b.x,b.y-b.vy*dt*3))b.vy=-b.vy;else b.vx=-b.vx;
          sparks(b.x,b.y,15,2);EggAudio.blip();
        }else{
          if(b.splash)splashAt(b.x,b.y,b);
          sparks(b.x,b.y,15,3);return false;
        }
      }
      /* capsules first (they pop open) */
      for(const cp of capsules){
        if(!cp.dead&&Math.abs(b.x-cp.x)<7&&Math.abs(b.y-(cp.y0+Math.sin(cp.t*2.4)*3))<8){
          openCapsule(cp);
          if(!b.pierce)return false;
        }
      }
      let used=false;
      for(const e of enemies){
        if(e.dead)continue;
        const bb=ebox(e);
        if(b.x>bb[0]&&b.x<bb[2]&&b.y>bb[1]&&b.y<bb[3]){
          if(b.hit){if(b.hit.indexOf(e)>=0)continue;b.hit.push(e)}
          hitEnemy(e,b.dmg);sparks(b.x,b.y,12,4);
          if(b.splash)splashAt(b.x,b.y,b);
          if(!b.pierce){used=true;break}
        }
      }
      if(used)return false;
      const bh=bossHitTest(b);
      if(bh===true){
        if(b.hit){if(b.hit.indexOf(boss)<0){b.hit.push(boss);bossDamage(b.dmg);sparks(b.x,b.y,12,5)}}
        else{bossDamage(b.dmg);sparks(b.x,b.y,12,5);return false}
      }else if(bh==="deflect"&&!b.pierce)return false;
      return true;
    });
    /* enemy shots */
    eshots.forEach(s=>{
      if(s.g)s.vy+=s.g*dt;
      s.x+=s.vx*dt;s.ttl-=dt;
      if(s.kind==="glyph"){s.t+=dt;s.y=s.y0+Math.sin(s.t*3)*10}
      else s.y+=s.vy*dt;
    });
    eshots=eshots.filter(s=>{
      if(s.ttl<=0||s.x<camX-30||s.x>camX+IW+30||s.y>IH+12||s.y<-12)return false;
      if(s.kind==="wave"){
        if(!tileSolid(map,s.x,s.y+4))return false;           // ran off a ledge
        if(tileSolid(map,s.x+(s.vx>0?3:-3),s.y-2))return false; // hit a wall
      }else if(s.kind!=="glyph"&&s.kind!=="lob"&&s.kind!=="fall"&&tileSolid(map,s.x,s.y))return false;
      else if((s.kind==="lob"||s.kind==="fall")&&s.vy>0&&tileSolid(map,s.x,s.y+2)){sparks(s.x,s.y,13,6);return false}
      if(!peace&&dying<=0&&invuln<=0&&overlaps(playerBox(),s.x-3,s.y-3,s.x+3,s.y+3)){hurtPlayer();return false}
      return true;
    });
    /* fx */
    parts.forEach(p=>{p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=90*dt;p.a-=dt*1.4});
    parts=parts.filter(p=>p.a>0);
    floats.forEach(f=>{f.y-=9*dt;f.a-=dt*.8});
    floats=floats.filter(f=>f.a>0);
  }
  /* ---------------- draw ---------------- */
  function playerSprite(){
    const st=facing<0?SPRF:SPR,a=aimVec();
    if(dying>0)return st.player_death[dying<.3?1:0];
    if(!grounded)return(keys.ArrowDown?st.player_fire_down:st.player_jump)[0];
    const mvng=(keys.ArrowRight?1:0)-(keys.ArrowLeft?1:0);
    if(a.y<0)return(a.x?st.player_fire_diag:st.player_fire_up)[0];
    if(mvng)return st.player_run[(elapsed*9|0)%4];
    if(fireCd>EGG_WPN[weapon].cd[wlvl-1]-.09&&flash>=0)return st.player_fire[(elapsed*12|0)%2];
    return st.player_idle[(elapsed*1.6|0)%2];
  }
  function mmss(t){const m=(t/60)|0,s2=(t%60)|0;return m+":"+(s2<10?"0":"")+s2}
  function drawBrief(){
    x.fillStyle=PAL[0];x.fillRect(0,0,IW,IH);
    x.fillStyle=PAL[2];x.fillRect(6,6,IW-12,IH-12);
    x.fillStyle=PAL[0];x.fillRect(8,8,IW-16,IH-16);
    x.fillStyle=PAL[3];x.fillRect(8,8,IW-16,1);x.fillRect(8,IH-9,IW-16,1);
    drawSpr(x,SPR.portrait[0],16,26);
    x.fillStyle=PAL[3];x.fillRect(14,24,20,1);x.fillRect(14,44,20,1);
    drawText(x,14,48,"THE AV",15);drawText(x,14,54,"INTEGRATOR",15);
    const lines=briefLines();
    let budget=briefDone?1e9:Math.floor(briefT*30),ty=26;
    for(let i=0;i<lines.length;i++){
      const take=Math.max(0,Math.min(lines[i].length,budget));
      budget-=lines[i].length+1;
      if(take>0)drawText(x,50,ty,lines[i].slice(0,take),i===0?12:6);
      ty+=i===0?12:8;
      if(budget<=0)break;
    }
    if(briefDone||briefT*30>=briefTotal()){
      if((elapsed*2|0)%2===0)drawText(x,110-textW("PRESS FIRE")/2,IH-20,"PRESS FIRE",9);
    }else drawText(x,IW-46,IH-20,"FIRE: SKIP",15);
  }
  function centerPanel(){x.fillStyle="rgba(7,5,15,.82)";x.fillRect(0,0,IW,IH)}
  function drawClear(){
    centerPanel();
    const md=EGG_MISSIONS[mission];
    drawText(x,110-textW(md.secured,2)/2,34,md.secured,12,2);
    drawText(x,110-textW("SCORE "+score)/2,56,"SCORE "+score,6);
    drawText(x,110-textW("TIME "+mmss(clearData.time))/2,66,"TIME "+mmss(clearData.time),6);
    const bl=clearData.bonus?"NO-DEATH BONUS +1000":"NO-DEATH BONUS - MISSED";
    drawText(x,110-textW(bl)/2,76,bl,clearData.bonus?9:15);
    if(clearT>.8&&(elapsed*2|0)%2===0)drawText(x,110-textW("PRESS FIRE")/2,98,"PRESS FIRE",9);
  }
  function drawWin(){
    centerPanel();
    drawText(x,110-textW("EARTH'S AV IS SAFE.",2)/2,40,"EARTH'S AV IS SAFE.",9,2);
    drawText(x,110-textW("- EVERY DISPLAY ACCOUNTED FOR.")/2,60,"- EVERY DISPLAY ACCOUNTED FOR.",6);
    drawText(x,110-textW("FINAL SCORE "+score)/2,74,"FINAL SCORE "+score,12);
    if(winT>.8&&(elapsed*2|0)%2===0)drawText(x,110-textW("PRESS FIRE")/2,96,"PRESS FIRE",9);
  }
  function drawBossActor(){
    const b=boss;
    if(b.kind==="crusher"){
      const st2=b.fl>0?SPRW:SPR;
      drawSpr(x,st2.boss_crusher[(elapsed*3|0)%2],b.x-20,b.y-32-b.lift);
    }else if(b.kind==="wyrm"){
      if(b.warn>0&&(elapsed*6|0)%2===0)drawText(x,b.dir>0?bossCam+3:bossCam+IW-7,b.baseY-3,"!",14);
      for(let i=8;i>=1;i--){
        const p=b.hist[i*7];if(!p)continue;
        drawSpr(x,SPR.boss_wyrm_seg[(elapsed*4+i)%2|0],p.x-4,p.y-4);
      }
      const hs=b.fl>0?SPRW:(b.dir<0?SPRF:SPR);
      drawSpr(x,hs.boss_wyrm_head[(elapsed*4|0)%2],b.hx-8,b.hy-8);
    }else{
      const st2=b.fl>0?SPRW:SPR;
      drawSpr(x,st2.boss_eater[b.mouth>0?1:0],LW-52,72);
      if(b.pullWarn>0&&(elapsed*6|0)%2===0)drawText(x,LW-86,82,"PULL!",14);
      if(b.mouth>0){x.fillStyle=PAL[9];x.fillRect(LW-46,88,4,4)}
      if(b.beam){
        if(b.beam.t>0){
          if((elapsed*8|0)%2===0){x.fillStyle=PAL[14];for(let i=Math.round(camX);i<LW-52;i+=6)x.fillRect(i,b.beam.y,3,1)}
        }else{
          x.fillStyle=PAL[14];x.fillRect(Math.round(camX)-2,b.beam.y-2,LW-50-camX,4);
          x.fillStyle=PAL[7];x.fillRect(Math.round(camX)-2,b.beam.y-1,LW-50-camX,1);
        }
      }
    }
  }
  function draw(){
    x.imageSmoothingEnabled=false;
    if(state==="brief"){drawBrief();blitScaled(dctx,off,880,520);return}
    drawParallax(x,camX,elapsed);
    drawTiles(x,map,camX,elapsed);
    const cam=Math.round(camX);
    x.save();
    let sx=0,sy=0;
    if(shake>0&&!EGG_RM){sx=(Math.random()-.5)*shake*1.6;sy=(Math.random()-.5)*shake*1.2}
    x.translate(-cam+sx,sy);
    props.forEach(p=>drawSpr(x,SPR[p.art][0],p.x,p.y));
    plats.forEach(p=>{
      drawSpr(x,SPR.tile_grate[0],p.x-8,p.y-4);
      drawSpr(x,SPR.tile_grate[0],p.x,p.y-4);
      x.fillStyle=PAL[4];x.fillRect(Math.round(p.x)-8,Math.round(p.y)-5,16,1);
    });
    capsules.forEach(cp=>{
      const cy=cp.y0+Math.sin(cp.t*2.4)*3;
      drawSpr(x,SPR.capsule[(elapsed*3|0)%2],cp.x-6,cy-6);
      drawSpr(x,SPR[EGG_ITEM_ICON[cp.item]][0],cp.x-5,cy-5);
    });
    pickups.forEach(pk=>drawSpr(x,SPR[EGG_ITEM_ICON[pk.item]][0],pk.x-5,pk.y-5));
    enemies.forEach(e=>{
      const fl=e.fl>0;
      if(e.type==="smasher")drawSpr(x,(fl?SPRW:(e.dir<0?SPRF:SPR)).smasher[(elapsed*6|0)%2],e.x-6,e.y-12);
      else if(e.type==="zapper")drawSpr(x,(fl?SPRW:SPR).zapper[e.st==="idle"?0:1],e.x-5,e.y-5);
      else if(e.type==="snatcher"){
        drawSpr(x,(fl?SPRW:SPR).snatcher[(elapsed*7|0)%2],e.x-6,e.y-4);
        if(e.carry)drawSpr(x,SPR[EGG_ITEM_ICON[e.carry]][0],e.x-5,e.y+4);
      }
      else if(e.type==="vent")drawSpr(x,(fl?SPRW:SPR).vent[(elapsed*3|0)%2],e.x-7,e.y-14);
      else{
        drawSpr(x,(fl?SPRW:SPR).carrier[(elapsed*7|0)%2],e.x-7,e.y-5);
        if(e.cargo)drawSpr(x,SPR.capsule[(elapsed*3|0)%2],e.x-6,e.y+4);
      }
    });
    if(boss)drawBossActor();
    /* the integrator */
    const blinkOn=invuln>0&&!EGG_RM&&((elapsed*9|0)%2===0);
    if(!blinkOn||dying>0){
      x.globalAlpha=invuln>0&&EGG_RM?.6:1;
      drawSpr(x,playerSprite(),px-8,py-20);
      x.globalAlpha=1;
      if(flash>0&&dying<=0){
        const a=aimVec(),mx=Math.round(px+a.x*11),my=Math.round(py-11+a.y*11);
        x.fillStyle=PAL[7];x.fillRect(mx-2,my,5,1);x.fillRect(mx,my-2,1,5);
        x.fillStyle=PAL[12];x.fillRect(mx-1,my-1,3,3);
        x.fillStyle=PAL[7];x.fillRect(mx,my,1,1);
      }
    }
    if(respawnFlash>0&&dying<=0)drawSpr(x,SPRW.player_idle[0],px-8,py-20);
    if(shield>0&&dying<=0){
      x.globalAlpha=.5+((elapsed*4|0)%2)*.2;
      x.fillStyle=PAL[10];
      x.fillRect(Math.round(px)-7,Math.round(py)-21,14,1);x.fillRect(Math.round(px)-7,Math.round(py)+1,14,1);
      x.fillRect(Math.round(px)-8,Math.round(py)-20,1,21);x.fillRect(Math.round(px)+7,Math.round(py)-20,1,21);
      x.globalAlpha=1;
    }
    /* player bullets */
    bullets.forEach(b=>{
      const bx=Math.round(b.x),by=Math.round(b.y);
      if(b.kind==="fiber"){
        const dd=Math.max(1,Math.hypot(b.vx,b.vy)),ux=b.vx/dd,uy=b.vy/dd;
        x.fillStyle=PAL[10];
        for(let k2=0;k2<7;k2++)x.fillRect(Math.round(b.x-ux*k2),Math.round(b.y-uy*k2),1,1);
        x.fillStyle=PAL[7];x.fillRect(bx,by,1,1);
      }else if(b.kind==="sub"){
        x.fillStyle=PAL[12];
        x.fillRect(bx-2,by-3,4,1);x.fillRect(bx-2,by+2,4,1);
        x.fillRect(bx-3,by-2,1,4);x.fillRect(bx+2,by-2,1,4);
        x.fillStyle=PAL[13];x.fillRect(bx-1,by-1,2,2);
      }else if(b.kind==="lens"){
        x.fillStyle=PAL[13];x.fillRect(bx-1,by-1,3,3);
        x.fillStyle=PAL[14];x.fillRect(bx,by,1,1);
        if((elapsed*10|0)%2===0){x.fillStyle=PAL[9];x.fillRect(bx-Math.sign(b.vx),by-1,1,1)}
      }else if(b.kind==="pair"){
        x.fillStyle=PAL[10];x.fillRect(bx-1,by-1,2,2);
        x.fillStyle=PAL[15];x.fillRect(Math.round(b.x-b.vx*.02),Math.round(b.y-b.vy*.02),1,1);
      }else if(b.kind==="mirror"){
        x.fillStyle=PAL[9];x.fillRect(bx-1,by,3,1);x.fillRect(bx,by-1,1,3);
      }else if(b.kind==="multi"){
        x.fillStyle=PAL[9];x.fillRect(bx-1,by-1,2,2);
      }else{
        x.fillStyle=b.kind==="blast"?PAL[6]:PAL[9];
        if(b.vx&&b.vy)x.fillRect(bx-1,by-1,2,2);
        else if(b.vx){x.fillRect(bx-2,by,3,1);x.fillStyle=PAL[7];x.fillRect(b.vx>0?bx+1:bx-2,by,1,1)}
        else{x.fillRect(bx,by-2,1,3);x.fillStyle=PAL[7];x.fillRect(bx,b.vy>0?by+1:by-2,1,1)}
      }
    });
    /* enemy shots */
    eshots.forEach(s=>{
      const bx=Math.round(s.x),by=Math.round(s.y);
      if(s.kind==="wave"){
        x.fillStyle=PAL[14];x.fillRect(bx-3,by-1,7,4);
        x.fillStyle=PAL[12];x.fillRect(bx-1,by-2,3,1);
      }else if(s.kind==="glyph"){
        drawText(x,bx-1,by-2,s.g2,10);
      }else if(s.kind==="lob"){
        x.fillStyle=PAL[13];x.fillRect(bx-1,by-1,3,3);
      }else if(s.kind==="fall"){
        x.fillStyle=PAL[15];x.fillRect(bx-1,by-1,3,3);x.fillStyle=PAL[6];x.fillRect(bx,by,1,1);
      }else{
        x.fillStyle=s.kind==="spit"?PAL[12]:PAL[14];x.fillRect(bx-1,by-1,2,2);
        x.fillStyle=PAL[7];x.fillRect(bx,by,1,1);
      }
    });
    fx.forEach(f=>{
      if(f.kind==="ring"){
        const r=2+f.t*46;x.globalAlpha=Math.max(0,1-f.t*2.9);
        for(let k2=0;k2<10;k2++){const an=k2*.6283;x.fillStyle=PAL[k2%2?7:12];
          x.fillRect(Math.round(f.x+Math.cos(an)*r),Math.round(f.y+Math.sin(an)*r),1,1)}
        x.globalAlpha=1;
      }else if(f.kind==="dust")drawSpr(x,SPR.dust[f.t<.09?0:1],f.x-5,f.y-3);
      else drawSpr(x,SPR.explosion[Math.min(2,(f.t*9)|0)],f.x-6,f.y-6);
    });
    parts.forEach(p=>{x.globalAlpha=Math.max(0,p.a);x.fillStyle=PAL[p.ci];x.fillRect(Math.round(p.x),Math.round(p.y),p.s||1,p.s||1)});
    x.globalAlpha=1;
    floats.forEach(f=>{x.globalAlpha=Math.max(0,Math.min(1,f.a));drawText(x,f.x-textW(f.txt)/2,f.y,f.txt,f.ci)});
    x.globalAlpha=1;
    x.restore();
    if(phaseFlash>0&&!EGG_RM){x.globalAlpha=Math.min(.5,phaseFlash*3.6);x.fillStyle=PAL[7];x.fillRect(0,0,IW,IH);x.globalAlpha=1}
    /* ==== HUD ==== */
    for(let i=0;i<5;i++){
      x.globalAlpha=i<lives?1:.18;
      drawSpr(x,SPR.hud_face[0],2+i*9,2);
    }
    x.globalAlpha=1;
    drawText(x,50,2,"SCORE",15);
    drawText(x,50,8,String(score),6);
    drawText(x,96,2,"MISSION",15);
    drawText(x,96,8,"M"+(mission+1),12);
    /* weapon chip: name + level pips + icon */
    const wname=EGG_WPN[weapon].name;
    drawText(x,200-textW(wname),2,wname,6);
    x.fillStyle=PAL[12];
    for(let i=0;i<wlvl;i++)x.fillRect(200-wlvl*5+i*5,9,3,3);
    x.fillStyle=shield>0?PAL[10]:PAL[3];x.fillRect(203,1,16,13);
    x.fillStyle=PAL[1];x.fillRect(204,2,14,11);
    const wi=EGG_WPN_ITEM[weapon];
    if(wi)drawSpr(x,SPR[EGG_ITEM_ICON[wi]][0],206,3);
    else drawText(x,209,5,"C",15);
    /* boss bar (bottom) */
    if(boss&&boss.st!=="dead"){
      const frac=boss.st==="intro"?(boss.hp/boss.max)*Math.min(1,boss.t/1.2):boss.hp/boss.max;
      drawBossBar(x,60,122,100,frac,boss.name);
    }
    if(boss&&boss.st==="intro"){
      x.fillStyle="rgba(7,5,15,.55)";x.fillRect(0,0,IW,IH);
      if((elapsed*3|0)%2===0)drawText(x,110-textW("WARNING",1)/2,44,"WARNING",14);
      drawText(x,110-textW(boss.name,2)/2,54,boss.name,12,2);
    }
    if(banner&&banner.t<2.6){
      const k=banner.t<.3?banner.t/.3:banner.t>2.1?(2.6-banner.t)/.5:1;
      x.globalAlpha=Math.max(0,k);
      drawText(x,110-textW(banner.txt,2)/2,40,banner.txt,5,2);
      if(banner.sub)drawText(x,110-textW(banner.sub)/2,54,banner.sub,15);
      x.globalAlpha=1;
    }
    if(state==="clear")drawClear();
    else if(state==="win")drawWin();
    if(paused){
      x.fillStyle="rgba(7,5,15,.7)";x.fillRect(0,0,IW,IH);
      drawText(x,110-textW("PAUSED",2)/2,56,"PAUSED",6,2);
      drawText(x,110-textW("P TO RESUME")/2,70,"P TO RESUME",15);
    }
    blitScaled(dctx,off,880,520);
  }
  function loop(ts){
    if(!alive)return;
    if(document.getElementById("egg").style.display!=="flex"){eggAnim=null;return}
    const now=ts!=null?ts:(window.performance&&performance.now?performance.now():Date.now());
    if(last==null)last=now;
    const dt=Math.min(.05,(now-last)/1000);last=now;
    if(!paused){if(hitStop>0)hitStop=Math.max(0,hitStop-dt);else update(dt)}
    if(alive)draw();
    if(alive)eggAnim=requestAnimationFrame(loop);
  }
  window.__eggDbg={game:"relay-run",
    state:()=>({state,mission:mission+1,score,lives,alive,paused,px,py,vy,grounded,facing,coyote,jbuf,
      weapon,wlvl,shield,invuln,dying,briefDone,briefShown:briefT*30>=briefTotal(),bossLock,camX,
      hitStop,shake,respawnFlash,phaseFlash,
      boss:boss?{name:boss.name,hp:boss.hp,max:boss.max,phase:boss.phase,st:boss.st,warn:boss.warn||0,pullWarn:boss.pullWarn||0,x:boss.kind==="wyrm"?boss.hx:boss.x,y:boss.kind==="wyrm"?boss.hy:boss.y,mode:boss.mode||null,mouth:boss.mouth||0,pull:boss.pull||0,beam:!!boss.beam}:null,
      enemies:enemies.length,bullets:bullets.length,eshots:eshots.length,
      capsules:capsules.length,pickups:pickups.length,missionTime,missionDeaths,aim:aimVec()}),
    bulletsList:()=>bullets.map(b=>({x:b.x,y:b.y,vx:b.vx,vy:b.vy,dmg:b.dmg,pierce:!!b.pierce,wall:!!b.wall,kind:b.kind})),
    eshotsList:()=>eshots.map(s2=>({x:s2.x,y:s2.y,kind:s2.kind})),
    enemiesList:()=>enemies.map(e=>({type:e.type,x:e.x,y:e.y,hp:e.hp,st:e.st||null,carry:e.carry||null})),
    capsulesList:()=>capsules.map(cp=>({x:cp.x,y:cp.y0,item:cp.item})),
    pickupsList:()=>pickups.map(pk=>({x:pk.x,y:pk.y,item:pk.item})),
    maps:()=>EGG_MISSIONS.map(m=>({w:m.map[0].length,h:m.map.length})),
    advance:()=>advance(),
    warp:(wx,wy)=>{px=wx;py=wy!=null?wy:112;vy=0;if(!bossLock)camX=Math.max(0,Math.min(LW-IW,px-IW*.42))},
    toBoss:()=>{px=arenaX+16;py=112;vy=0;camX=bossCam},
    setPeace:v=>{peace=!!v},
    setLives:n=>{lives=n;hud()},
    give:it=>applyPickup(it),
    hit:f=>hurtPlayer(!!f),
    damageBoss:n=>bossDamage(n),
    killEnemy:i=>{if(enemies[i]&&!enemies[i].dead)killEnemy(enemies[i])},
    openCapsule:i=>{if(capsules[i]&&!capsules[i].dead)openCapsule(capsules[i])},
    spawnSnatcher:(sx,sy)=>{enemies.push({type:"snatcher",x:sx,y:sy,ax:sx,ay:sy,st:"fly",t:0,hp:2,fl:0,carry:null,dcd:9})}};
  loadMission(0);
  camX=0;
  eggAnim=requestAnimationFrame(loop);
}
function eggClose(){
  document.getElementById("egg").style.display="none";
  if(eggAnim){cancelAnimationFrame(eggAnim);eggAnim=null}
  if(eggRelayKeys){removeEventListener("keydown",eggRelayKeys);removeEventListener("keyup",eggRelayKeys);eggRelayKeys=null}
  eggEndDismiss();EggAudio.ambientStop();
}

/* easter egg: SIGNAL JUMPER — Venus (Pass C, art pass V). A classic run-and-jump
   platformer across the broadcast campus: ten handcrafted levels, three
   interference-glyph enemies — WALKER patrols ledges, SPITTER opens its iris
   for 420ms and then lobs a slow static glob (dodge or duck; the glob itself
   can't be stomped; its cycle tightens on the later levels), FLYER rides a
   sine — and every one of
   them squashes flat under a good stomp. Signal bits +10, cache blocks pop
   3 bits when bumped from below, the midpoint flag holds your respawn, and
   each level ends at a dark wall display on a pedestal: touch it and the
   Polaris-green workspace blinks back on. Levels 6-10 escalate: mixed
   glyph packs in the uplink yard, walkway lattices under a flyer swarm,
   the rack-canyon climb and its freight elevator, long ferry rides over
   open sky, and the MASTER CONTROL gauntlet. Ten for ten and the campus
   is broadcasting. Game over offers CONTINUE — restart the current level
   with fresh lives, score and bits intact — beside the classic full
   replay (eggEndScreen grew an optional onContinue/C-key slot for this).
   Tuning (internal px): run 90/s (accel 340, decel 480) · jump -172 @ g430
   (~34px apex), releasing the key cuts rise to -40 (variable height) ·
   coyote 80ms · jump buffer 90ms · stomp = falling onto the top 60% of an
   enemy box, rebound -134 (full -172 while holding jump) · stomp chain
   100/200/400/800 without touching ground · globs 70px/s (cycle 2.2s -
   0.07s per level, floor 1.5s) after a 420ms iris wind-up, aim locked when the
   wind-up starts · bit +10 · level clear 500 + (par - time)*5 bonus · 3 lives
   per credit.
   Art: EART5, a Venus-only override store compiled by eggPx5() into SPR5/SPRF5
   and resolved through VS/VSF here. Not an in-place override of SPR — six of the
   player keys are shared with RELAY RUN and `bit` with THE LOST DISPLAY. The
   editable Aseprite documents and the pipeline that generates the store live in
   "Easter egg/Graphical revision". */
let egg5Anim=null,egg5Best=0,egg5Keys=null;
const EGG_VENUS=[
{"name":"THE LOADING DOCK","par":70,"plats":[],"map":["........................................................................................................................","........................................................................................................................","........................................................................................................................","........................................................................................................................","........................................................................................................................","........................................................................................................................","........................................................................................................................","........................................................................................................................","........................................................................................................................","........................................................................................................................","........................................Q............*.*................................................................","....................................................-----.....................**................**......................","......................*.*.*...................HH..........................................*.............*.*.............","..............................HH......1.......HH............M.1.......................1.................1.......E.......","==============================================================================..================..======================","hhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhh..hhhhhhhhhhhhhhhh..hhhhhhhhhhhhhhhhhhhhhh","hhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhh..hhhhhhhhhhhhhhhh..hhhhhhhhhhhhhhhhhhhhhh"]},
{"name":"THE CABLE TRENCH","par":80,"plats":[],"map":["....................................................................................................................................","....................................................................................................................................","....................................................................................................................................","....................................................................................................................................","....................................................................................................................................","....................................................................................................................................","....................................................................................................................................","....................................................................................................................................","..............................................................*.*...................................................................","..............................................................----..................................................................","................Q...*.*..............................***............Q...............................................................","....................----......***....................---.......................*......................*.*...........................","..........................................................................................HH..................*.*.*.................","........................1...........2...HH......1.................M...2...............1...HH....2...................1...1...E.......","==============================...===================.....=====================...=====================...===========================","hhhhhhhhhhhhhhhhhhhhhhhhhhhhhh...hhhhhhhhhhhhhhhhhhh.....hhhhhhhhhhhhhhhhhhhhh...hhhhhhhhhhhhhhhhhhhhh...hhhhhhhhhhhhhhhhhhhhhhhhhhh","hhhhhhhhhhhhhhhhhhhhhhhhhhhhhh...hhhhhhhhhhhhhhhhhhh.....hhhhhhhhhhhhhhhhhhhhh...hhhhhhhhhhhhhhhhhhhhh...hhhhhhhhhhhhhhhhhhhhhhhhhhh"]},
{"name":"THE ROOFTOP HVAC","par":85,"plats":[{"cx":512,"cy":96,"dx":22,"dy":0,"per":4.6}],"map":["............................................................................................................................................","............................................................................................................................................","............................................................................................................................................","............................................................................................................................................","............................................................................................................................................","............................................................................................................................................","............................................................................................................................................","..........................................................................3.................................................................","..................................3........................................................**.......Q.....................3.................","............................Q..**.........................................................----..............................................","..............................----...........................*.*.*.*............................**..........................................",".........................*......................................................................HH....................**....................","..........*.*.*.........HHH.............HHH.........................................HHH.........HH............HHH...........*...............","........................HHH.............HHH.......1...................M.......2.....HHH.........HH......1.....HHH.............1.....E.......","============================================================........==================================================..====================","hhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhh........hhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhh..hhhhhhhhhhhhhhhhhhhh","hhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhh........hhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhh..hhhhhhhhhhhhhhhhhhhh"]},
{"name":"THE SERVER MEZZANINE","par":90,"plats":[],"map":["......................................................................................................................................................","......................................................................................................................................................","......................................................................................................................................................","......................................................................................................................................................","......................................................................................................................................................","..........................................................................................................3...........................................","....................................Q.............3.........................................................Q.........................................","......................................................................................................................................................","............................................................*...1.*...2.*...*.........................................................................","..............................*..*1....*..*...............-------------------.........................*...*...*...*...................................","............................---------------.........................................................-----------------.................................","....................................***...............HH................................................................HH..*.*.......................","......*.*.*.........HH................................HH..........................*.*...HH..............................HH........*.*.................","....................HH....1...............2...1.......HH....................M...........HH..1.........................2.HH............1.......E.......","====================================...=============================...=========================..==========================...=======================","hhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhh...hhhhhhhhhhhhhhhhhhhhhhhhhhhhh...hhhhhhhhhhhhhhhhhhhhhhhhh..hhhhhhhhhhhhhhhhhhhhhhhhhh...hhhhhhhhhhhhhhhhhhhhhhh","hhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhh...hhhhhhhhhhhhhhhhhhhhhhhhhhhhh...hhhhhhhhhhhhhhhhhhhhhhhhh..hhhhhhhhhhhhhhhhhhhhhhhhhh...hhhhhhhhhhhhhhhhhhhhhhh"]},
{"name":"THE ANTENNA TOWER","par":100,"plats":[],"map":["................................................................................................................................................................","................................................................................................................................................................","..............................................................................................Q............................**.*.................................","............................................................................................................................2...........3.......................","........................................................................................3......*.*...............**.......======.............*.*................","................................................................................................M.....................3...hhhhhh..........1.....2.....E.........",".............................................................**....................**.......========......**....====......hhhhhh....============================","..........................................................3........................2........hhhhhhhh............hhhh......hhhhhh....hhhhhhhhhhhhhhhhhhhhhhhhhhhh","..............................................Q......**.....====......*.*.*.......====......hhhhhhhh....====....hhhh......hhhhhh....hhhhhhhhhhhhhhhhhhhhhhhhhhhh","............................................................hhhh.......1..........hhhh......hhhhhhhh....hhhh....hhhh......hhhhhh....hhhhhhhhhhhhhhhhhhhhhhhhhhhh",".............................................**.....====....hhhh....========......hhhh......hhhhhhhh....hhhh....hhhh......hhhhhh....hhhhhhhhhhhhhhhhhhhhhhhhhhhh","....................................................hhhh....hhhh....hhhhhhhh......hhhh......hhhhhhhh....hhhh....hhhh......hhhhhh....hhhhhhhhhhhhhhhhhhhhhhhhhhhh","..........*.*.......***.....................====....hhhh....hhhh....hhhhhhhh......hhhh......hhhhhhhh....hhhh....hhhh......hhhhhh....hhhhhhhhhhhhhhhhhhhhhhhhhhhh","..............................1.............hhhh....hhhh....hhhh....hhhhhhhh......hhhh......hhhhhhhh....hhhh....hhhh......hhhhhh....hhhhhhhhhhhhhhhhhhhhhhhhhhhh","====================...===================..hhhh....hhhh....hhhh....hhhhhhhh......hhhh......hhhhhhhh....hhhh....hhhh......hhhhhh....hhhhhhhhhhhhhhhhhhhhhhhhhhhh","hhhhhhhhhhhhhhhhhhhh...hhhhhhhhhhhhhhhhhhh..hhhh....hhhh....hhhh....hhhhhhhh......hhhh......hhhhhhhh....hhhh....hhhh......hhhhhh....hhhhhhhhhhhhhhhhhhhhhhhhhhhh","hhhhhhhhhhhhhhhhhhhh...hhhhhhhhhhhhhhhhhhh..hhhh....hhhh....hhhh....hhhhhhhh......hhhh......hhhhhhhh....hhhh....hhhh......hhhhhh....hhhhhhhhhhhhhhhhhhhhhhhhhhhh"]}
,
{"name":"THE UPLINK YARD","par":105,"plats":[{"cx":768,"cy":100,"dx":40,"dy":0,"per":4.0}],"map":["........................................................................................................................................................................","........................................................................................................................................................................","........................................................................................................................................................................","........................................................................................................................................................................","........................................................................................................................................................................","........................................................................................................................................................................","........................................................................................................................................................................","....................................................3.......................................................................................3...........................","...................................................................*.*..........................3.......................................................................","..................................................................-----.................................................Q...............................................","........................Q..............................*.*................................*...*...*...*....*.*..........................................................","...............................a..............*.*.....-----...............................................-----..a....................*.*...............................","........*.*.*.................HHH.............................HH................................................HHH...........HH......................*.*.*.............","......n...........HH......1...HHH.....2.....1.................HH......1...HHH.....2...M...........u...........1.HHH...2.......HH................1.n...2.....1.....E.....","==============================================....=======================================..............===============================....==============================","hhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhh....hhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhh..............hhhhhhhhhhhhhhhhhhhhhhhhhhhhhhh....hhhhhhhhhhhhhhhhhhhhhhhhhhhhhh","hhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhh....hhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhh..............hhhhhhhhhhhhhhhhhhhhhhhhhhhhhhh....hhhhhhhhhhhhhhhhhhhhhhhhhhhhhh"]},
{"name":"THE STATIC FIELDS","par":112,"plats":[{"cx":1012,"cy":94,"dx":0,"dy":14,"per":3.4}],"map":["................................................................................................................................................................................","................................................................................................................................................................................","................................................................................................................................................................................","................................................................................................................................................................................","................................................................................................................................................................................","................................................................................................................................................................................","...........................3......................................3........*..*..*..*...............................................................Q...........................","..........................................................................-----------...............................................................3...........................","................3........*.*.*........................3........*..*..*....................Q.........3........*...*1..*...........................*..*..*........................","........................-------...............................---------.....................................-----------.........................---------.......................","..........Q....*.*.*...............................*..*..*.......................................*..*..*....................*.*.*....*..*..*....................................","..............-------.............a.....*.*.......---------.....................................---------...........................---------.................a.................","..................................HH..........................................................................................................................HH................","....n.................1...........HH................2.............2.....u...............M.1.HH............u.....2.......1.........n.....2.................2...HH..1...E...1.....","========================================....====================================.....=======================================.....===============================================","hhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhh....hhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhh.....hhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhh.....hhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhh","hhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhh....hhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhh.....hhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhh.....hhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhh"]},
{"name":"THE RACK CANYON","par":120,"plats":[{"cx":896,"cy":72,"dx":0,"dy":22,"per":4.4}],"map":["................................................................................................................................................................................","................................................................................................................................................................................","......................................................................................................Q.........................................................................","................................................................................................................................................................................","...................................................................................................*.*..*...*.*.*.*.*...........................................................","....................................................................................................M...2......3................................................................",".....................................................................**....................**.....========......................................................................","......................................................................................3...........hhhhhhhh......................................................................","..........................................Q..................**.....====......*.*.*.......====....hhhhhhhh..............*.*.*........................3..........................","..............................................................1.....hhhh........2.........hhhh....hhhhhhhh...............1......................................................",".........................3...........................**.....====....hhhh....========......hhhh....hhhhhhhh............========..................................................","........a...............*.*..........................1......hhhh....hhhh....hhhhhhhh......hhhh....hhhhhhhh............hhhhhhhh......................*.*.........a...............","....*.*.HH........................HH..*.*...........====....hhhh....hhhh....hhhhhhhh......hhhh....hhhhhhhh............hhhhhhhh........*.*...................*...HH....*.........","........HH..n.1.....u.........2...HH....1...........hhhh....hhhh....hhhh....hhhhhhhh......hhhh....hhhhhhhh............hhhhhhhh......u.......n...............1...HH..2...1...E...","========================....====================....hhhh....hhhh....hhhh....hhhhhhhh......hhhh....hhhhhhhh............hhhhhhhh..====================....========================","hhhhhhhhhhhhhhhhhhhhhhhh....hhhhhhhhhhhhhhhhhhhh....hhhh....hhhh....hhhh....hhhhhhhh......hhhh....hhhhhhhh............hhhhhhhh..hhhhhhhhhhhhhhhhhhhh....hhhhhhhhhhhhhhhhhhhhhhhh","hhhhhhhhhhhhhhhhhhhhhhhh....hhhhhhhhhhhhhhhhhhhh....hhhh....hhhh....hhhh....hhhhhhhh......hhhh....hhhhhhhh............hhhhhhhh..hhhhhhhhhhhhhhhhhhhh....hhhhhhhhhhhhhhhhhhhhhhhh"]},
{"name":"THE MICROWAVE BRIDGE","par":128,"plats":[{"cx":412,"cy":76,"dx":48,"dy":0,"per":4.6},{"cx":824,"cy":56,"dx":56,"dy":0,"per":5.0}],"map":["........................................................................................................................................................................................","........................................................................................................................................................................................","........................................................................................................................................................................................","........................................................................................................................................................................................","...........................................................................*..*.........Q.......*...3.*...*...*.........................................................................","......................................................................3.....2...........................................................................................................","............................Q.................*...*...*...*..*..*..*......======.......*..*.............................................................................................","..................................3............................2..........hhhhhh........M...2...........................................................................................","...........................*..*........*..*.................========......hhhhhh......========....................*...*...3.............................................................",".....................*.*................a...................hhhhhhhh......hhhhhh......hhhhhhhh......................1.....................Q.........3...................................","..........................======......======................hhhhhhhh......hhhhhh......hhhhhhhh..................========......*..*......................................................","..........................hhhhhh......hhhhhh................hhhhhhhh......hhhhhh......hhhhhhhh..................hhhhhhhh.......1................................*.*.....................","......*.*............===..hhhhhh......hhhhhh................hhhhhhhh......hhhhhh......hhhhhhhh..................hhhhhhhh....========..........*...*.......................*.......*.....","....n.....u..........hhh..hhhhhh......hhhhhh................hhhhhhhh......hhhhhh......hhhhhhhh..................hhhhhhhh....hhhhhhhh....u.1.2.....1...n...2.1...........1.2...u.E...1...","====================.hhh..hhhhhh......hhhhhh................hhhhhhhh......hhhhhh......hhhhhhhh..................hhhhhhhh....hhhhhhhh..==========================....====================","hhhhhhhhhhhhhhhhhhhh.hhh..hhhhhh......hhhhhh................hhhhhhhh......hhhhhh......hhhhhhhh..................hhhhhhhh....hhhhhhhh..hhhhhhhhhhhhhhhhhhhhhhhhhh....hhhhhhhhhhhhhhhhhhhh","hhhhhhhhhhhhhhhhhhhh.hhh..hhhhhh......hhhhhh................hhhhhhhh......hhhhhh......hhhhhhhh..................hhhhhhhh....hhhhhhhh..hhhhhhhhhhhhhhhhhhhhhhhhhh....hhhhhhhhhhhhhhhhhhhh"]},
{"name":"MASTER CONTROL","par":140,"plats":[{"cx":856,"cy":60,"dx":28,"dy":0,"per":3.2},{"cx":904,"cy":78,"dx":0,"dy":18,"per":3.8}],"map":["..............................................................................................................................................................................................","..............................................................................................................................................................................................","..............................................................................................................................................................................................","..............................................................................................................................................................................................","..............................................................................................................................................................................................","..........................................................................................................*.3*..*.............................................................................",".......................................................................3......................*...*...*.................Q...........................................3.........................","........................................................................................**....M.1...1.........................................................................................","........................................*...*...*.....................................2.....============............................3...........3......................................*..*...","................................................................................a.**..HH....hhhhhhhhhhhh..............*.2.*...........................................................a.E.....","........................................Q...Q...Q...............................HH....HH....hhhhhhhhhhhh............========........................................................==========","..............................*.*...............................*.*.......a.**..HH....HH....hhhhhhhhhhhh............hhhhhhhh............................*.*.........................hhhhhhhhhh","......*.*.*.........................................*...*.................HH....HH....HH....hhhhhhhhhhhh............hhhhhhhh......*...*...*...*...*...............*...*.........HH..hhhhhhhhhh","....n.....1.....1.....2.u.............1...............2...1...............HH....HH....HH....hhhhhhhhhhhh............hhhhhhhh...n..1.....1.....1.....1.u.......n.2.....1.2...1...HH..hhhhhhhhhh","==============================....==============================....========================hhhhhhhhhhhh............hhhhhhhh..==========================....========================hhhhhhhhhh","hhhhhhhhhhhhhhhhhhhhhhhhhhhhhh....hhhhhhhhhhhhhhhhhhhhhhhhhhhhhh....hhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhh............hhhhhhhh..hhhhhhhhhhhhhhhhhhhhhhhhhh....hhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhh","hhhhhhhhhhhhhhhhhhhhhhhhhhhhhh....hhhhhhhhhhhhhhhhhhhhhhhhhhhhhh....hhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhh............hhhhhhhh..hhhhhhhhhhhhhhhhhhhhhhhhhh....hhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhh"]}
];
/* ---- EART5: the Venus art store (generated) ---- */
/* SIGNAL JUMPER's own art, laid over the shared stores at load. Palette-indexed
   exactly like EGG_ART and EART6 — "." transparent, 0-9 -> PAL[0..9], A-G ->
   PAL[10..16], H-Z -> PAL[17..35], a-n -> PAL[36..49].

   Authored in Aseprite. The editable documents and the whole pipeline live in
   "Easter egg/Graphical revision": src/*.js are the authored grids,
   tools/build-aseprite.js writes aseprite/*.aseprite and exports the PNGs,
   tools/png2art.js reads them back, tools/inject.js writes this block. Do not
   hand-edit below this line — re-run the pipeline instead.

   Direction, in one line: the deck is the LIGHTER thing in the lower screen and
   the city behind it is a silhouette, which is what stops the level geometry
   dissolving into the skyline the way it used to. docs/ART-DIRECTION.md has the
   long version. */
const EART5={
/* 8x8 — solid ground top */
tile_vfloor_a:[
 ["CCCCCCCC","jjjjjjjj","PPPPPPPP","PPQPPPQP","QQQQQQQQ","QQQQQQQQ","RQQQQQQR","RRRRRRRR"]],
/* 8x8 — alt of vfloor_a, (i*7+j)%3==0 */
tile_vfloor_b:[
 ["CCCjCCCC","jjjKjjjj","PPPQPPPP","PPQRQPPP","QQQRQQQQ","QQQRQQQQ","RQQRQQQR","RRRRRRRR"]],
/* 8x8 — solid ground body, by far the most-placed tile */
tile_vfill:[
 ["RRRRRRRR","PPPRPPPP","QQQRQQQQ","QQQRQQQQ","RRRRRRRR","PPPPPPPR","QQQQQQQR","QQQQQQQR"]],
/* 8x8 — free-standing solid column */
tile_vblock:[
 ["SPPPPPPS","PCQQQQCP","PQQRRQQP","PQRiiRQP","PQRiiRQP","PQQRRQQP","PCQQQQCP","SRRRRRRS"]],
/* 8x8 — one-way platform; also both halves of a moving platform */
tile_vplat:[
 ["CCCCCCCC","jjjjjjjj","PQPQPQPQ","RGRGRGRG","S.S.S.S.","........","........","........"]],
/* 8x8 x2 — bump from below for 3 bits, fps 2 */
tile_cache:[
 ["SSQQQQSS","SQPPPPQS","QPRhhRPQ","QPhffhPQ","QPhffhPQ","QPRhhRPQ","SQPPPPQS","SSQQQQSS"],
 ["SSQQQQSS","SQPPPPQS","QPRiiRPQ","QPihhiPQ","QPihhiPQ","QPRiiRPQ","SQPPPPQS","SSQQQQSS"]],
/* 8x8 — spent cache */
tile_cache_used:[
 ["SSQQQQSS","SQPPPPQS","QPRRRRPQ","QPR11RPQ","QPR11RPQ","QPRRRRPQ","SQPPPPQS","SSQQQQSS"]],
/* 8x8 — decor girder, non-solid */
tile_vgird:[
 ["QQQQQQQQ","QR....RQ","Q.R..R.Q","Q..RR..Q","Q..RR..Q","Q.R..R.Q","QR....RQ","QQQQQQQQ"]],
/* 8x8 x2 — decor sign, fps 2, non-solid */
tile_vsign:[
 [".QQQQQQ.","QPPPPPPQ","QPiiiihQ","QPiihhfQ","QPihhffQ","QPhhfffQ","QPPPPPPQ","..RSSR.."],
 [".QQQQQQ.","QPPPPPPQ","QPiiiiiQ","QPiiihhQ","QPiihhhQ","QPihhhhQ","QPPPPPPQ","..RSSR.."]],
/* 8x8 — decor antenna, non-solid */
tile_vantenna:[
 ["...QQ...","..QPPQ..",".QPhhPQ.",".QPghPQ.","..QPPQ..","...QRQ..","....R...","..RRRRR."]],
/* 12x10 x2 — patrols ledges; mirrored by dir */
walker:[
 ["...aaaaaa...","..aDDeeeEa..",".aDeeeeeeEa.","aDeeeeeeeeEa","aee0f00f0eEa","aeeeeeeeeeEa","aEeeeeeeeeEa",".aEEeeeeEEa.","..aEE00EEa..","...a0..0a..."],
 ["...aaaaaa...","..aDDeeeEa..",".aDeeeeeeEa.","aDeeeeeeeeEa","aeee0f00f0Ea","aeeeeeeeeeEa","aEeeeeeeeeEa",".aEEeeeeEEa.","..aE0aa0Ea..","..0a....a0.."]],
/* 12x6 x2 — drawn at (x-6, y-6) */
walker_squash:[
 ["............","...EEEEEE...",".EEeeeeeeEE.","EeeeeeeeeeeE","EeEEEEEEEEeE",".EEaaaaaaEE."],
 ["............","............","...EEEEEE...",".EEeeeeeeEE.","EeeeeeeeeeeE","EEaaaaaaaaEE"]],
/* 12x12 x2 — frame 1 = mouth open, 0.5s */
spitter:[
 ["....aaaa....","..aaEEEEaa..",".aEeeeeeeEa.","aEeeDDDDeeEa","aEeeD00DeeEa","aEeeeeeeeeEa","aEeeeeeeeeEa",".aEeeeeeeEa.","..aEEEEEEa..",".aQQQQQQQQa.",".QPPPPPPPPQ.",".QQQQQQQQQQ."],
 ["....aaaa....","..aaEEEEaa..",".aEeeeeeeEa.","aEeD0000DeEa","aEeD0770DeEa","aEeD0770DeEa","aEeeD00DeeEa",".aEeeeeeeEa.","..aEEEEEEa..",".aQQQQQQQQa.",".QPPPPPPPPQ.",".QQQQQQQQQQ."]],
/* 12x6 x2 — drawn at (x-6, y-6) */
spitter_squash:[
 ["............","...EEEEEE...",".EEeeeeeeEE.","EeeeD00Deeee",".EeeeeeeeeE.",".EQQQQQQQQE."],
 ["............","............","...EEEEEE...",".EeeeeeeeeE.","EeeeD00Deeee","EQQQQQQQQQQE"]],
/* 14x10 x2 — sine path; drawn at (x-7, y-8) */
flyer:[
 ["......00......",".....0ff0.....","....0fggf0....","..00fghhgf00..",".0ffghhhhgff0.","0fgghhhhhhggf0",".0gghhhhhhgg0.","..0hhhhhhhh0..","...0ihhhhi0...","....0iiii0...."],
 ["..00......00..",".0ff0....0ff0.","0fgg0.hh.0ggf0",".0gg0fhhf0gg0.","..00ghhhhg00..","...ghhhhhhg...","..0ghhhhhhg0..","..0hhhhhhhh0..","...0ihhhhi0...","....0iiii0...."]],
/* 14x6 x2 — drawn at (x-7, y-4) */
flyer_squash:[
 ["..............","..0ffhhhhff0..",".0fgghhhhhhg0.","0fgghhhhhhhhg0",".0gghhhhhhgg0.","..0iihhhhii0.."],
 ["..............","..............","..0ffhhhhff0..",".0fgghhhhhhg0.","0fgghhhhhhhhg0",".0iihhhhhhii0."]],
/* 6x6 x2 — spitter projectile, unstompable */
glob:[
 [".DeeD.","DeEEeD","eEaaEe","eEaaEe","DeEEeD",".DeeD."],
 ["D.ee.D",".eEEe.","eEaaEe","eEaaEe",".eEEe.","D.ee.D"]],
/* 6x6 x2 — also the HUD bit icon at 196,2 */
bit:[
 ["..ff..",".fggf.","fghhgf","fghhgf",".fggf.","..ff.."],
 ["..ff..","..gg..",".fhhf.",".fhhf.","..gg..","..ff.."]],
/* 8x16 — midpoint checkpoint, dormant */
prop_flag_off:[
 ["...SS...","..QSSQ..","...QQ...","..QRRQ..","...QQ...",".QQRRQQ.","...QQ...","..QRRQ..","...QQ...",".QQRRQQ.","...QQ...","...QQ...","..QRRQ..","...QQ...",".QQQQQQ.","QPPPPPPQ"]],
/* 8x16 x2 — checkpoint taken */
prop_flag_on:[
 ["...ff...","..QffQ..","..hQQh..","..QRRQ..","...QQ...",".QQRRQQ.","...QQ...","..QRRQ..","...QQ...",".QQRRQQ.","...QQ...","...QQ...","..QRRQ..","...QQ...",".QQQQQQ.","QPPPPPPQ"],
 ["...ff...","..QffQ..",".hQQQQh.","h.QRRQ.h","...QQ...",".QQRRQQ.","...QQ...","..QRRQ..","...QQ...",".QQRRQQ.","...QQ...","...QQ...","..QRRQ..","...QQ...",".QQQQQQ.","QPPPPPPQ"]],
/* 18x24 x2 — level goal, dark */
prop_display_off:[
 ["QQQQQQQQQQQQQQQQQQ","QPPPPPPPPPPPPPPPPQ","QPQQQQQQQQQQQQQQPQ","QPQ1SSSSSSSSSS1QPQ","QPQ1RRRRRRRRRR1QPQ","QPQ1SSSSSSSSSS1QPQ","QPQ1RRRRRRRRRR1QPQ","QPQ1SSSSSSSSSS1QPQ","QPQ1RRRRRRRRRR1QPQ","QPQ1SSSSSSSSSS1QPQ","QPQ1RRRRRRRRRR1QPQ","QPQQQQQQQQQQQQQQPQ","QPPPPPPPPPPPPPPPPQ","QQQQQQQQQQQQQQQQQQ","...QQQQQQQQQQQQ...","......QQQQQQ......","......QPPPPQ......","......QPRRPQ......","......QPRRPQ......","......QPRRPQ......","....QQQPPPPQQQ....","...QPPPPPPPPPPQ...","...QPRRRRRRRRPQ...","...QQQQQQQQQQQQ..."],
 ["QQQQQQQQQQQQQQQQQQ","QPPPPPPPPPPPPPPPPQ","QPQQQQQQQQQQQQQQPQ","QPQ1RRRRRRRRRR1QPQ","QPQ1SSSSSSSSSS1QPQ","QPQ1RRRRRRRRRR1QPQ","QPQ1SSSSSSSSSS1QPQ","QPQ1RRRRRRRRRR1QPQ","QPQ1SSSSSSSSSS1QPQ","QPQ1RRRRRRRRRR1QPQ","QPQ1SSSSSSSSSS1QPQ","QPQQQQQQQQQQQQQQPQ","QPPPPPPPPPPPPPPPPQ","QQQQQQQQQQQQQQQQQQ","...QQQQQQQQQQQQ...","......QQQQQQ......","......QPPPPQ......","......QPRRPQ......","......QPRRPQ......","......QPRRPQ......","....QQQPPPPQQQ....","...QPPPPPPPPPPQ...","...QPRRRRRRRRPQ...","...QQQQQQQQQQQQ..."]],
/* 18x24 x2 — level goal, lit */
prop_display_on:[
 ["QQQQQQQQQQQQQQQQQQ","QPPPPPPPPPPPPPPPPQ","QPQQQQQQQQQQQQQQPQ","QPQ8NNNNNNNNNN8QPQ","QPQ8N99999999N8QPQ","QPQ8N999MM999N8QPQ","QPQ8N99M77M99N8QPQ","QPQ8N99M77M99N8QPQ","QPQ8N999MM999N8QPQ","QPQ8N99999999N8QPQ","QPQ8NNNNNNNNNN8QPQ","QPQQQQQQQQQQQQQQPQ","QPPPPPPPPPPPPPPPPQ","QQQQQQQQQQQQQQQQQQ","...QQQQQQQQQQQQ...","......QQQQQQ......","......QPPPPQ......","......QP99PQ......","......QP99PQ......","......QPRRPQ......","....QQQPPPPQQQ....","...QPPPPPPPPPPQ...","...QPRRRRRRRRPQ...","...QQQQQQQQQQQQ..."],
 ["QQQQQQQQQQQQQQQQQQ","QPPPPPPPPPPPPPPPPQ","QPQQQQQQQQQQQQQQPQ","QPQ8NNNNNNNNNN8QPQ","QPQ8N99999999N8QPQ","QPQ8N99MMMM99N8QPQ","QPQ8N9M7777M9N8QPQ","QPQ8N9M7777M9N8QPQ","QPQ8N99MMMM99N8QPQ","QPQ8N99999999N8QPQ","QPQ8NNNNNNNNNN8QPQ","QPQQQQQQQQQQQQQQPQ","QPPPPPPPPPPPPPPPPQ","QQQQQQQQQQQQQQQQQQ","...QQQQQQQQQQQQ...","......QQQQQQ......","......QPPPPQ......","......QP99PQ......","......QP99PQ......","......QPRRPQ......","....QQQPPPPQQQ....","...QPPPPPPPPPPQ...","...QPRRRRRRRRPQ...","...QQQQQQQQQQQQ..."]],
/* 16x20 x2 — 2-frame breath, elapsed*1.6 · SHARED with RELAY RUN */
player_idle:[
 ["................","....0CCCCCC0....","...0CHHHHHHC0...","...0CjjjjjjC0...","...0hggggggh0...","...0hffffffh0...","...0PbbbbbbP0...","....0PbbbbP0....","...0PPPPPPPP0...","..0PPP3333PPP0..","..0hPP3CC3PPh0..","..0hPP3CC3PPh0..","..0PPP3333PPP0..","...0PPPPPPPP0...","...0PP2222PP0...","....02222220....","....02222220....","....022..220....","...0PP0..0PP0...","...0SS0..0SS0..."],
 ["................","................","....0CCCCCC0....","...0CHHHHHHC0...","...0CjjjjjjC0...","...0hggggggh0...","...0hffffffh0...","...0PbbbbbbP0...","....0PbbbbP0....","..0PPPPPPPPPP0..","..0hPP3CC3PPh0..","..0hPP3CC3PPh0..","..0PPP3333PPP0..","...0PPPPPPPP0...","...0PP2222PP0...","....02222220....","....02222220....","....022..220....","...0PP0..0PP0...","...0SS0..0SS0..."]],
/* 16x20 x4 — 4-frame run, elapsed*10 · SHARED with RELAY RUN */
player_run:[
 ["................",".....0CCCCCC0...","....0CHHHHHHC0..","....0CjjjjjjC0..","....0hggggggh0..","....0hffffffh0..","....0PbbbbbbP0..",".....0PbbbbP0...","...0PPPPPPPP0...","..0hPP3333PPP0..","..0hPP3CC3PPP0..","...0PP3CC3PPh0..","...0PP3333PPh0..","...0PPPPPPPP0...","...0PP2222PP0...","....02222220....","...0222..1110...","..0222....1110..","..0PP0....0S10..","..0SS0....0110.."],
 ["................",".....0CCCCCC0...","....0CHHHHHHC0..","....0CjjjjjjC0..","....0hggggggh0..","....0hffffffh0..","....0PbbbbbbP0..",".....0PbbbbP0...","...0PPPPPPPP0...","..0hPP3333PPP0..","..0hPP3CC3PPP0..","...0PP3CC3PPh0..","...0PP3333PPh0..","...0PPPPPPPP0...","...0PP2222PP0...","....02222220....","....0220.1110...","....0220.0110...","....0PP0.0SS0...","....0SS0........"],
 ["................",".....0CCCCCC0...","....0CHHHHHHC0..","....0CjjjjjjC0..","....0hggggggh0..","....0hffffffh0..","....0PbbbbbbP0..",".....0PbbbbP0...","...0PPPPPPPP0...","...0PP3333PPh0..","...0PP3CC3PPh0..","..0hPP3CC3PPP0..","..0hPP3333PPP0..","...0PPPPPPPP0...","...0PP2222PP0...","....02222220....","...0111..2220...","..0111....2220..","..0S10....0PP0..","..0110....0SS0.."],
 ["................",".....0CCCCCC0...","....0CHHHHHHC0..","....0CjjjjjjC0..","....0hggggggh0..","....0hffffffh0..","....0PbbbbbbP0..",".....0PbbbbP0...","...0PPPPPPPP0...","...0PP3333PPh0..","...0PP3CC3PPh0..","..0hPP3CC3PPP0..","..0hPP3333PPP0..","...0PPPPPPPP0...","...0PP2222PP0...","....02222220....","...0111.0220....","...0111.0220....","...0S10.0PP0....","........0SS0...."]],
/* 16x20 — airborne, any vy · SHARED with RELAY RUN */
player_jump:[
 ["................",".....0CCCCCC0...","....0CHHHHHHC0..","....0CjjjjjjC0..","....0hggggggh0..","....0hffffffh0..","....0PbbbbbbP0..",".....0PbbbbP0...","..0h0PPPPPPPP0..","..0h0PP3333PP0..","...00PP3CC3PP0..","....0PP3CC3PPh0.","....0PP3333PPh0.","....0PPPPPPPP0..","....0PP2222PP0..","....02222220....","...022222220....","..0PP0..0PP0....","..0SS0..0SS0....","................"]],
/* 16x20 — duck AND the 0.18s stomp recoil */
player_squash:[
 ["................","................","................","................","................","................","................","....0CCCCCC0....","...0CHHHHHHC0...","...0CjjjjjjC0...","...0hggggggh0...","...0hffffffh0...","...0PbbbbbbP0...","..0PPPPPPPPPP0..","..0hPP3CC3PPh0..","..0hPP3CC3PPh0..","..0PPP3333PPP0..","...0PP2222PP0...","..0PP0....0PP0..","..0SS0....0SS0.."]],
/* 16x20 — reused as the level-clear cheer · SHARED with RELAY RUN */
player_fire_up:[
 ["................","....0CCCCCC0....","...0CHHHHHHC0...",".0h0CjjjjjjC0h0.",".0h0hggggggh0h0.",".0h0hffffffh0h0.",".0P00PbbbbbbP00.",".0P00PbbbbP00P0.","..0PPPPPPPPPP0..","..0PPP3333PPP0..","..0PPP3CC3PPP0..","..0PPP3CC3PPP0..","..0PPP3333PPP0..","...0PPPPPPPP0...","...0PP2222PP0...","....02222220....","....02222220....","....022..220....","...0PP0..0PP0...","...0SS0..0SS0..."]],
/* 16x20 x2 — frame 1 first, then frame 0 · SHARED with RELAY RUN */
player_death:[
 ["................","....0CCCCCC0....","...0CHHHHHHC0...","...0CjjjjjjC0...","...0hEEEEEEh0...","...0hffffffh0...","...0PbbbbbbP0...","....0PbbbbP0....",".0hPPPPPPPPPPh0.",".0hPPP3333PPPh0.","..0PPP3CC3PPP0..","...0PP3CC3PP0...","...0PP3333PP0...","...0PPPPPPPP0...","...0PP2222PP0...","..02222222220...","..022......220..",".022........220.",".0PP0......0PP0.",".0SS0......0SS0."],
 ["................","................","................","................","................","................","................","................","................","................","................","................","................","....0CCCCCC0....","...0CHHHHHHC0...","...0h111111h0...","..0PPbbbbbbPP0..",".0hPPPP33PPPPh0.",".0hPPP2222PPPh0.",".0SSPPPPPPPPSS0."]],
/* 8x8 — life pip, 3 across at x=2+i*9 · SHARED with RELAY RUN */
hud_face:[
 ["..CCCC..",".CHHHHC.","CCHHHHCC","CjggggjC","CjffffjC",".bbbbbb.",".cbbbbc.","..cccc.."]]};
let eart5Done=false;
function eggPx5(){   /* compile the Venus overrides once, after eggPxInit */
  if(eart5Done||!SPR)return;
  eart5Done=true;
  SPR5={};SPRF5={};
  for(const k in EART5){
    SPR5[k]=EART5[k].map(f=>mkSprite(f));
    /* tiles are never mirrored, so compiling a flipped copy of them would double
       the cost of this pass for something nothing ever draws */
    if(!/^tile_/.test(k))SPRF5[k]=EART5[k].map(f=>mkSpriteFlipped(f));
  }
}
/* ---- end EART5 ---- */
function drawParallaxVenus(ctx,camX,t){
  /* Venus dusk over the broadcast campus.

     The value structure is the whole design, and it is INVERTED from what this
     function used to do. It used to paint a bright sky, a dark city and a dark
     playfield — so the ground the player stands on and the buildings behind it
     landed on the same luminance and the level geometry dissolved into the
     skyline. Now: the sky carries the light, the city is a silhouette against
     it, and the deck tiles are the LIGHTER thing in the lower screen. Anything
     drawn here must stay darker than PAL[26] #6a6478, the concrete face.

     Everything is expressed in PAL rather than in loose hex. The old version
     carried about forty raw hex literals, which put the largest surface in the
     game outside every palette, contrast and near-duplicate check the repo runs.

     Layers, all pixel-snapped: sky · sun · haze x0.06 · ridge masts x0.15 ·
     skyline x0.35 · roofline x0.55 · service rail x0.75. */

  /* ---- the sky: a twelve-stop dusk ramp, violet zenith to sulphur horizon.
     Each stop hands over to the next through an ordered row dither rather than
     a hard seam — six rows assigned by a 4-step Bayer threshold, which is how
     the era faked a gradient out of a handful of flat colours and is why this
     reads as light rather than as stripes. Twelve fills plus sixty-six dither
     rows, against the seventy-three-row single flat rectangle it replaces. */
  const SKY=[[0,PAL[0]],[6,PAL[1]],[13,PAL[2]],[20,PAL[33]],[27,PAL[3]],[36,PAL[39]],
             [45,PAL[47]],[53,PAL[14]],[61,PAL[40]],[71,PAL[45]],[81,PAL[19]],[91,PAL[12]],[101,PAL[20]]],
        BAY=[0,2,1,3];
  for(let s=0;s<SKY.length-1;s++){
    const y0=SKY[s][0],y1=SKY[s+1][0],dz=Math.min(6,(y1-y0)>>1);
    ctx.fillStyle=SKY[s][1];ctx.fillRect(0,y0,220,y1-y0-dz);
    for(let i=0;i<dz;i++){
      ctx.fillStyle=((BAY[i&3]+.5)/4<(i+.5)/dz)?SKY[s+1][1]:SKY[s][1];
      ctx.fillRect(0,y1-dz+i,220,1);
    }
  }
  ctx.fillStyle=SKY[SKY.length-1][1];ctx.fillRect(0,101,220,29);

  /* ---- the sun: low, large and half-drowned in its own haze. Drawn as spans
     of a circle so it is a disc and not a stack of squares, four rings deep,
     with the two anamorphic streaks the CRT pass likes to bloom. */
  const SX=46,SY=56,RING=[[12,PAL[19]],[9,PAL[12]],[6,PAL[18]],[3,PAL[17]]];
  for(let r=0;r<RING.length;r++){
    const rad=RING[r][0];ctx.fillStyle=RING[r][1];
    for(let dy=-rad;dy<=rad;dy++){
      const w=Math.round(Math.sqrt(Math.max(0,rad*rad-dy*dy)));
      if(w>0)ctx.fillRect(SX-w,SY+dy,w*2,1);
    }
  }
  ctx.fillStyle=PAL[19];ctx.fillRect(SX-30,SY-4,60,1);ctx.fillRect(SX-24,SY+5,48,1);

  /* ---- haze deck x0.06 — long flat cloud bars sliding on the wind. Kept one
     step off the sky behind them so they read as density, not as objects. */
  const hz=Math.round(camX*.06+(EGG_RM?0:t*3)),HB=64;
  for(let i=((hz/HB)|0)-1;i<((hz+220)/HB|0)+2;i++){
    const cx2=i*HB-hz,cy2=22+(i*11)%20,cw=34+(i*13)%30;
    ctx.fillStyle=PAL[33];ctx.fillRect(cx2,cy2,cw,3);
    ctx.fillStyle=PAL[3];ctx.fillRect(cx2+3,cy2-1,cw-8,1);
    ctx.fillStyle=PAL[2];ctx.fillRect(cx2+2,cy2+3,cw-5,1);
  }

  /* ---- far x0.15 — the ridge and the antenna farm beyond the campus fence.
     This is the one layer painted LIGHTER than the things in front of it:
     PAL[46] #8f6a72 is the warm desaturated neutral appended for exactly this,
     because Venus has a thick sky and distance has to wash toward grey-rose
     rather than toward the void. Beacons blink on a 1.5s cycle. */
  const f=Math.round(camX*.15),MS=52;
  ctx.fillStyle=PAL[46];ctx.fillRect(0,68,220,3);
  for(let i=((f/MS)|0)-1;i<((f+220)/MS|0)+2;i++){
    const mx=i*MS-f+10,ht=18+(i*11)%15,top=68-ht,big=i%3===0;
    ctx.fillStyle=PAL[46];
    ctx.fillRect(mx-9,66,22,3);
    ctx.fillRect(mx,top,2,ht);
    ctx.fillRect(mx-3,top+3,8,1);ctx.fillRect(mx-2,top+7,6,1);
    if(big)ctx.fillRect(mx-4,top+11,10,1);
    ctx.fillStyle=PAL[38];ctx.fillRect(mx,top,1,ht);
    const on=EGG_RM?(i%2===0):((((t*1.5)|0)+i)%2===0);
    ctx.fillStyle=on?PAL[14]:PAL[38];ctx.fillRect(mx,top-2,2,2);
  }

  /* ---- mid x0.35 — the broadcast centre, a flat silhouette on the bright
     horizon. The window grid is REGULAR now: the old one lit windows off a hash
     of the coordinates, which scattered them like noise instead of stacking
     them into floors. A tower reads as a tower because its windows line up. */
  const sk=Math.round(camX*.35),SB=46;
  for(let i=((sk/SB)|0)-1;i<((sk+220)/SB|0)+2;i++){
    const bx=i*SB-sk,wd=26+(i*7)%14,top=72+(i*5)%11;
    ctx.fillStyle=PAL[2];ctx.fillRect(bx,top,wd,124-top);
    ctx.fillStyle=PAL[3];ctx.fillRect(bx,top,wd,1);ctx.fillRect(bx,top,1,124-top);
    ctx.fillStyle=PAL[1];ctx.fillRect(bx+wd-1,top,1,124-top);
    /* Roughly a third of the offices are still working, and they are lit in the
       DIM amber PAL[20] rather than the hot PAL[12] the roofline uses. Two
       reasons: the nearer layer has to stay the brighter one or the depth
       ordering inverts, and at 5-of-9 lit in full amber this grid put several
       hundred bright dots directly behind the playfield, where they competed
       with the pickups for the player's eye. */
    for(let fl=0,wy=top+4;wy<118;wy+=6,fl++)
      for(let wx2=bx+3,col=0;wx2<bx+wd-3;wx2+=5,col++){
        ctx.fillStyle=((fl*3+col*7+i*5)%9<3)?PAL[20]:PAL[1];
        ctx.fillRect(wx2,wy,2,2);
      }
    if(i%2===0){ctx.fillStyle=PAL[2];ctx.fillRect(bx+4,top-6,2,6);
      ctx.fillStyle=PAL[3];ctx.fillRect(bx+3,top-6,4,1)}
  }

  /* ---- near-mid x0.55 — the campus roofline: parapets, lit offices, dishes.
     Darker than the skyline behind it, so the two never merge. */
  const m=Math.round(camX*.55),RB=38;
  for(let i=((m/RB)|0)-1;i<((m+220)/RB|0)+2;i++){
    const rx=i*RB-m,wd=22+(i*5)%9,top=86+(i*7)%12;
    ctx.fillStyle=PAL[1];ctx.fillRect(rx,top,wd,126-top);
    ctx.fillStyle=PAL[2];ctx.fillRect(rx,top,wd,1);
    ctx.fillStyle=PAL[0];ctx.fillRect(rx+wd-2,top+1,2,125-top);
    ctx.fillStyle=PAL[12];
    ctx.fillRect(rx+3+(i*3)%4,top+4,2,2);ctx.fillRect(rx+wd-7+(i*2)%3,top+10,2,2);
    if(wd>26)ctx.fillRect(rx+12,top+7,2,2);
    if(i%2===1){ctx.fillStyle=PAL[2];ctx.fillRect(rx+wd-8,top-3,5,3);
      ctx.fillStyle=PAL[43];ctx.fillRect(rx+wd-7,top-2,3,1)}
  }

  /* ---- near x0.75 — the campus cable run: pylons carrying a sagging feeder
     line past the camera, with a status lamp on each head.

     This layer used to be a horizontal service rail painted at y=106, one row
     above the player's feet, which put a lit edge straight across the floor line
     and gave the eye two competing horizons. Verticals fix that: they cross
     every band instead of underlining one, so the parallax reads as depth rather
     than as a second ground. They are pure PAL[0] and stop at y=104, clear of
     the deck, and the spacing is 68px so no more than three are ever on screen.
     The lamp is the only lit pixel in the layer and it is the fastest-moving
     thing in the backdrop — which is exactly the depth cue this was missing. */
  const n=Math.round(camX*.75),SAG=[0,3,5,7,8,8,7,5,3,0];
  for(let i=((n/68)|0)-1;i<((n+220)/68|0)+2;i++){
    const px2=i*68-n+14;
    ctx.fillStyle=PAL[0];
    ctx.fillRect(px2,52,2,52);
    ctx.fillRect(px2-5,56,12,2);
    ctx.fillRect(px2-3,62,8,1);
    /* the feeder is a real catenary — ten steps dipping eight pixels between
       heads. Three flat steps read as a horizon line, which is the one thing a
       near layer must never do when there is already a ridge behind it. */
    for(let k=0;k<SAG.length;k++)ctx.fillRect(px2+2+k*7,58+SAG[k],7,1);
    const on2=EGG_RM?(i%2===1):((((t*2)|0)+i)%2===1);
    ctx.fillStyle=on2?PAL[9]:PAL[1];ctx.fillRect(px2,49,2,2);
  }
}
function eggOpen5(){
  document.getElementById("egg5").style.display="flex";
  EggAudio.init();EggAudio.ambientStart();eggSyncMute();
  document.getElementById("egg5-key").innerHTML=renderKey([["← →","run"],["Z / ↑","jump · hold = higher"],["↓","duck"],["P","pause"],["M","mute"],["Esc","mission control"]]);
  eggSignalJumper();
}
function eggClose5(){
  document.getElementById("egg5").style.display="none";
  if(egg5Anim){cancelAnimationFrame(egg5Anim);egg5Anim=null}
  if(egg5Keys){removeEventListener("keydown",egg5Keys);removeEventListener("keyup",egg5Keys);egg5Keys=null}
  eggEndDismiss();EggAudio.ambientStop();
}
function eggSignalJumper(cont){
  const IW=220,IH=130,c=document.getElementById("egg5c"),dctx=eggCanvas("egg5c",880,520);
  eggPxInit();eggPx5();
  /* Venus's own art, layered over the shared stores. A merged view rather than
     an in-place override because seven of these keys are also drawn by RELAY RUN
     and THE LOST DISPLAY, and overwriting SPR by name would repaint both. */
  const VS=Object.assign({},SPR,SPR5),VSF=Object.assign({},SPRF,SPRF5);
  const off=document.createElement("canvas");off.width=IW;off.height=IH;
  const x=off.getContext("2d");
  eggEndDismiss();
  if(egg5Anim){cancelAnimationFrame(egg5Anim);egg5Anim=null}
  if(egg5Keys){removeEventListener("keydown",egg5Keys);removeEventListener("keyup",egg5Keys)}
  const MAXRUN=90,ACC=340,DEC=480,GRAV=430,JV=-172,JCUT=-40,COYOTE=.08,JBUF=.09,BV=-134,GLOBV=70,WIND=.42;
  let level=0,score=cont?cont.score:0,lives=3,bits=cont?cont.bits:0,alive=true,paused=false,peace=false;
  let state="play",clearT=0,winT=0,banner=null,levelTime=0;
  let map=null,LW=0,plats=[],enemies=[],globs=[],pick=[],parts=[],floats=[];
  let flagX=0,flagY=112,endX=0,endY=112,checkpoint=false,screenOn=false;
  let px=16,py=112,vx=0,vy=0,facing=1,grounded=true,coyote=0,jbuf=0,duck=false,chain=0,stompT=0;
  let dying=0,invuln=1,camX=0,elapsed=0,last=null;
  const keys={};
  function hud(){
    document.getElementById("egg5s").textContent=score;
    document.getElementById("egg5lv").textContent=(level+1);
    document.getElementById("egg5l").textContent=lives;
    document.getElementById("egg5bt").textContent=bits;
    document.getElementById("egg5b").textContent=egg5Best;
  }
  function popText(tx,ty,txt,ci){floats.push({x:tx,y:ty,txt,ci,a:1})}
  function sparks(bx,by,ci,n){if(EGG_RM)return;for(let i=0;i<(n||8);i++)parts.push({x:bx,y:by,vx:(Math.random()-.5)*60,vy:(Math.random()-.8)*50,a:1,ci})}
  /* ---------------- level load / respawn ---------------- */
  function loadLevel(li,cp){
    level=li;
    const ld=EGG_VENUS[li];
    const rows=ld.map.map(r=>r.split(""));
    enemies=[];globs=[];pick=[];parts=[];floats=[];
    const Wd=rows[0].length;
    for(let i=0;i<Wd;i++)for(let j=0;j<rows.length;j++){
      const ch=rows[j][i];
      if("123*ME".indexOf(ch)<0)continue;
      rows[j][i]=".";
      const cx=i*8+4,fy=(j+1)*8;
      if(ch==="1")enemies.push({type:"walker",x:cx,y:fy,dir:-1,squash:0});
      else if(ch==="2")enemies.push({type:"spitter",x:cx,y:fy,t:1.2+(i%4)*.35,open:0,aim:0,squash:0});
      else if(ch==="3")enemies.push({type:"flyer",x:cx,y:fy-4,ax:cx,ay:fy-4,t:(i%7)*.6,squash:0});
      else if(ch==="*")pick.push({x:cx,y:fy-5,t:(i%5)*.4});
      else if(ch==="M"){flagX=cx;flagY=fy}
      else{endX=cx;endY=fy}
    }
    map=rows.map(r=>r.join(""));
    LW=Wd*8;
    plats=(ld.plats||[]).map(p=>({cx:p.cx,cy:p.cy,dx:p.dx,dy:p.dy,per:p.per,x:p.cx,y:p.cy,pxv:0,pyv:0}));
    if(!cp)checkpoint=false;
    px=(cp&&checkpoint)?flagX:16;py=(cp&&checkpoint)?flagY:112;
    vx=0;vy=0;facing=1;grounded=true;coyote=0;jbuf=0;duck=false;chain=0;stompT=0;dying=0;invuln=1.2;
    camX=Math.max(0,Math.min(LW-IW,px-IW*.42));
    state="play";clearT=0;screenOn=false;levelTime=0;
    banner={txt:"LEVEL "+(li+1)+"/10",sub:ld.name,t:0};
    hud();
  }
  /* ---------------- input ---------------- */
  egg5Keys=e=>{
    if(document.getElementById("egg5").style.display!=="flex")return;
    if(["ArrowLeft","ArrowRight","ArrowUp","ArrowDown"," "].includes(e.key))e.preventDefault();
    const k=e.key.length===1?e.key.toLowerCase():e.key;
    if(e.type==="keydown"){
      if(k==="p"&&alive&&state==="play"){paused=!paused;return}
      if((k==="z"||k==="ArrowUp")&&!keys[k]&&!paused)jbuf=JBUF;
      if((k==="x"||k===" "||k==="Enter")&&state==="clear"&&clearT>1.1)clearT=2.55;
    }
    keys[k]=e.type==="keydown";
    if(e.type==="keyup"&&(k==="z"||k==="ArrowUp")&&!jumpHeld()&&vy<JCUT)vy=JCUT;
  };
  addEventListener("keydown",egg5Keys);addEventListener("keyup",egg5Keys);
  function jumpHeld(){return!!(keys.z||keys.ArrowUp)}
  function playerBox(){return duck?{x0:px-4,y0:py-8,x1:px+4,y1:py}:{x0:px-4,y0:py-16,x1:px+4,y1:py}}
  /* ---------------- damage / scoring ---------------- */
  function hurtPlayer(pit){
    if(!alive||state!=="play"||dying>0)return;
    if(!pit&&invuln>0)return;
    lives--;chain=0;
    EggAudio.explode(.45);EggAudio.catchBad();sparks(px,py-10,13,14);
    dying=.7;hud();
  }
  function gameOver(){
    if(!alive)return;
    alive=false;egg5Anim=null;
    egg5Best=Math.max(egg5Best,score);hud();
    EggAudio.gameOver();
    const lv=level,sc=score,bt=bits;
    eggEndScreen({host:c.parentElement,title:"The campus stayed dark.",
      lines:["Score "+score+" · level "+(level+1)+"/10","Session best "+egg5Best],
      onContinue:()=>eggSignalJumper({level:lv,score:sc,bits:bt}),
      onReplay:eggSignalJumper,onMenu:()=>{eggClose5();eggMenu()}});
  }
  function ebox(e){
    if(e.type==="walker")return[e.x-5,e.y-10,e.x+5,e.y];
    if(e.type==="spitter")return[e.x-5,e.y-12,e.x+5,e.y];
    return[e.x-6,e.y-8,e.x+6,e.y+2];  /* flyer */
  }
  function stomp(e){
    e.squash=.34;stompT=.18;
    const pts=100*Math.pow(2,Math.min(3,chain));chain++;
    score+=pts;hud();
    popText(e.x,ebox(e)[1]-8,"+"+pts,chain>1?12:6);
    if(chain>2)popText(px,py-30,"CHAIN x"+chain,10);
    EggAudio.stomp();
    vy=jumpHeld()?JV:BV;
    if(jumpHeld())EggAudio.bounce();
    grounded=false;coyote=0;duck=false;
    sparks(e.x,ebox(e)[1],15,8);
  }
  function cacheBump(ci,cj){
    map[cj]=map[cj].slice(0,ci)+"q"+map[cj].slice(ci+1);
    EggAudio.bounce();sparks(ci*8+4,cj*8+8,12,6);
    for(let k=0;k<3;k++)pick.push({x:ci*8+4,y:cj*8-3,t:k*.3,vx:(k-1)*26,vy:-70});
    popText(ci*8+4,cj*8-6,"CACHE!",12);
  }
  /* ---------------- enemies ---------------- */
  function solidBelow(mx,my){const d=EGG_TILE[tileAt(map,mx,my)];return!!(d&&(d.solid||d.oneway))}
  function updWalker(e,dt){
    const spd=20+level*3;
    if(!solidBelow(e.x+e.dir*6,e.y+2)||tileSolid(map,e.x+e.dir*6,e.y-5))e.dir=-e.dir;
    else e.x+=e.dir*spd*dt;
  }
  /* The iris used to open on the same tick the glob left the barrel, so the
     "mouth open" frame was a receipt for a shot you had already been hit by
     rather than a warning about one. It is a wind-up now: the iris opens, holds
     for WIND, and the glob leaves as it shuts. The aim is locked when the wind-up
     starts, so stepping across the spitter during the tell dodges the shot —
     which is the point of having a tell. Cycle length is unchanged, so this
     costs the player nothing in tempo; it only gives back the warning frame. */
  function updSpitter(e,dt){
    e.t-=dt;
    if(e.open>0){
      e.open-=dt;
      if(e.open<=0){
        globs.push({x:e.x,y:e.y-9,vx:e.aim,vy:-95,ttl:4});
        EggAudio.blip();
      }
      return;
    }
    if(e.t<=0){
      e.t=Math.max(1.5,2.2-level*.07);
      if(Math.abs(px-e.x)<95){
        e.open=WIND;
        e.aim=px>e.x?GLOBV:-GLOBV;
      }
    }
  }
  function updFlyer(e,dt){
    e.t+=dt;
    e.x=e.ax+Math.sin(e.t*.6)*38;
    e.y=e.ay+Math.sin(e.t*2.1)*9;
  }
  /* ---------------- master update ---------------- */
  function update(dt){
    elapsed+=dt;
    if(banner)banner.t+=dt;
    parts.forEach(p=>{p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=90*dt;p.a-=dt*1.4});
    parts=parts.filter(p=>p.a>0);
    floats.forEach(f=>{f.y-=9*dt;f.a-=dt*.8});
    floats=floats.filter(f=>f.a>0);
    if(state==="clear"){
      clearT+=dt;
      if(clearT>.4&&!screenOn){screenOn=true;if(!EGG_RM)sparks(endX,endY-18,9,10)}
      if(clearT>=2.6){
        if(level<9)loadLevel(level+1,false);
        else{state="win";winT=0;egg5Best=Math.max(egg5Best,score);hud();EggAudio.victory()}
      }
      return;
    }
    if(state==="win"){
      winT+=dt;
      if(winT>=1.6&&alive){
        alive=false;egg5Anim=null;
        eggEndScreen({host:c.parentElement,title:"TEN FOR TEN.",
          lines:["The campus is broadcasting.","Score "+score+" · Session best "+egg5Best],
          onReplay:eggSignalJumper,onMenu:()=>{eggClose5();eggMenu()}});
      }
      return;
    }
    levelTime+=dt;
    if(invuln>0)invuln-=dt;
    if(stompT>0)stompT-=dt;
    /* moving platforms (before the player so carry works) */
    plats.forEach(p=>{
      const ph=Math.sin(elapsed*2*Math.PI/p.per);
      const nx=p.cx+ph*p.dx,ny=p.cy+ph*p.dy;
      p.pxv=nx-p.x;p.pyv=ny-p.y;p.x=nx;p.y=ny;
    });
    if(dying>0){
      dying-=dt;
      if(dying<=0){
        if(lives<=0){gameOver();return}
        loadLevel(level,true);
      }
      return;
    }
    /* run: accel / decel */
    duck=grounded&&!!keys.ArrowDown;
    const mv=duck?0:(keys.ArrowRight?1:0)-(keys.ArrowLeft?1:0);
    if(mv){facing=mv;vx+=mv*ACC*dt;if(vx>MAXRUN)vx=MAXRUN;if(vx<-MAXRUN)vx=-MAXRUN}
    else{const sg=Math.sign(vx),mg=Math.abs(vx)-DEC*dt;vx=mg<=0?0:sg*mg}
    px+=vx*dt;
    if(vx>0&&(tileSolid(map,px+4,py-4)||tileSolid(map,px+4,py-12))){px=(((px+4)/8)|0)*8-4.01;vx=0}
    else if(vx<0&&(tileSolid(map,px-4,py-4)||tileSolid(map,px-4,py-12))){px=((((px-4)/8)|0)+1)*8+4.01;vx=0}
    px=Math.max(4,Math.min(LW-5,px));
    /* jump: buffer + coyote, variable height via keyup cut */
    if(jbuf>0)jbuf-=dt;
    if(coyote>0)coyote-=dt;
    if(jbuf>0&&(grounded||coyote>0)){
      jbuf=0;coyote=0;vy=JV;grounded=false;duck=false;EggAudio.jump();
      if(!EGG_RM)for(let i=0;i<4;i++)parts.push({x:px+(Math.random()-.5)*6,y:py,vx:(Math.random()-.5)*20,vy:10+Math.random()*16,a:.7,ci:4});
    }
    const prevY=py,wasG=grounded;
    vy+=GRAV*dt;if(vy>250)vy=250;
    py+=vy*dt;
    /* rising: ceilings + cache blocks bumped from below */
    if(vy<0){
      const hy=py-(duck?9:17);
      let bumped=false;
      for(const ox of[-3,3]){
        const tc=tileAt(map,px+ox,hy);
        if(tc==="Q"){cacheBump(((px+ox)/8)|0,(hy/8)|0);bumped=true}
        else if(EGG_TILE[tc]&&EGG_TILE[tc].solid)bumped=true;
      }
      if(bumped){py=prevY;vy=18}
    }
    grounded=false;
    if(vy>=0){
      const ly=landAt(map,px-3,prevY,py),ry=landAt(map,px+3,prevY,py);
      let top=ly==null?ry:(ry==null?ly:Math.min(ly,ry));
      for(const p of plats){
        const t2=p.y-4;
        if(Math.abs(px-p.x)<10&&prevY<=t2-p.pyv+1.2&&py>=t2){
          if(top==null||t2<top){top=t2;px+=p.pxv;py=t2}
        }
      }
      if(top!=null){py=top;vy=0;if(!wasG)chain=0;grounded=true}
    }
    if(wasG&&!grounded&&vy>=0)coyote=COYOTE;
    if(py>IH+14)return hurtPlayer(true);
    /* midpoint flag */
    if(!checkpoint&&px>flagX-2&&Math.abs(py-flagY)<20){
      checkpoint=true;EggAudio.powerup();
      popText(flagX,flagY-20,"CHECKPOINT",9);sparks(flagX,flagY-12,9,8);
    }
    /* the display — touch it to finish the level */
    if(Math.abs(px-endX)<8&&py>endY-14){
      state="clear";clearT=0;duck=false;vx=0;globs=[];chain=0;
      px=endX-9;facing=1;grounded=true;py=endY;
      const bonus=500+Math.max(0,(EGG_VENUS[level].par-levelTime)|0)*5;
      score+=bonus;egg5Best=Math.max(egg5Best,score);hud();
      popText(endX,endY-30,"+"+bonus,6);
      EggAudio.levelClear();
      return;
    }
    /* enemies */
    const pb=playerBox();
    enemies.forEach(e=>{
      if(e.squash>0){e.squash-=dt;if(e.squash<=0)e.dead=true;return}
      const active=e.x>camX-40&&e.x<camX+260;
      if(!active)return;
      if(e.type==="walker")updWalker(e,dt);
      else if(e.type==="spitter")updSpitter(e,dt);
      else updFlyer(e,dt);
      const b=ebox(e);
      if(pb.x1>b[0]&&pb.x0<b[2]&&pb.y1>b[1]&&pb.y0<b[3]){
        if(vy>0&&py-b[1]<(b[3]-b[1])*.6){stomp(e);py=b[1]}
        else if(!peace&&invuln<=0&&dying<=0)hurtPlayer();
      }
    });
    enemies=enemies.filter(e=>!e.dead);
    /* globs — slow static arcs; they hurt and cannot be stomped */
    globs.forEach(s=>{s.vy+=240*dt;s.x+=s.vx*dt;s.y+=s.vy*dt;s.ttl-=dt});
    globs=globs.filter(s=>{
      if(s.ttl<=0||s.y>IH+10)return false;
      if(tileSolid(map,s.x,s.y)){sparks(s.x,s.y,15,4);return false}
      if(!peace&&dying<=0&&invuln<=0&&s.x+3>pb.x0&&s.x-3<pb.x1&&s.y+3>pb.y0&&s.y-3<pb.y1){hurtPlayer();return false}
      return true;
    });
    /* signal bits (map bits float; cache bits arc, land, then float) */
    pick.forEach(p=>{
      p.t+=dt;
      if(p.vy!=null){
        p.vy+=260*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;
        const gy=landAt(map,p.x,p.y-1,p.y+3);
        if(gy!=null&&p.vy>0){p.y=gy-4;p.vx=0;p.vy=null}
        if(p.y>IH+8){p.dead=true;return}
      }
      if(dying<=0&&Math.abs(p.x-px)<7&&Math.abs(p.y-(py-9))<11){
        p.dead=true;bits++;score+=10;hud();
        EggAudio.blip();popText(p.x,p.y-6,"+10",10);
      }
    });
    pick=pick.filter(p=>!p.dead);
    /* camera */
    const ct=Math.max(0,Math.min(LW-IW,px-IW*.42));
    camX+=(ct-camX)*Math.min(1,10*dt);
  }
  /* ---------------- draw ---------------- */
  function playerSprite(){
    const st=facing<0?VSF:VS;
    if(dying>0)return st.player_death[dying<.3?1:0];
    if(state==="clear")return clearT>.5?st.player_fire_up[0]:st.player_idle[0];
    if(duck||stompT>0)return st.player_squash[0];
    if(!grounded)return st.player_jump[0];
    if(Math.abs(vx)>6)return st.player_run[(elapsed*10|0)%4];
    return st.player_idle[(elapsed*1.6|0)%2];
  }
  function draw(){
    x.imageSmoothingEnabled=false;
    drawParallaxVenus(x,camX,elapsed);
    drawTiles(x,map,camX,elapsed,SPR5);
    const cam=Math.round(camX);
    x.save();x.translate(-cam,0);
    /* the flag + the display */
    const fon=checkpoint?VS.prop_flag_on[(elapsed*3|0)%2]:VS.prop_flag_off[0];
    drawSpr(x,fon,flagX-4,flagY-16);
    const dsp=screenOn?VS.prop_display_on[(elapsed*3|0)%2]:VS.prop_display_off[(elapsed*2|0)%2];
    drawSpr(x,dsp,endX-9,endY-24);
    if(screenOn&&!EGG_RM&&clearT<1.1){x.globalAlpha=Math.max(0,1.1-clearT);x.fillStyle=PAL[9];x.fillRect(endX-8,endY-24,16,12);x.globalAlpha=1}
    /* moving platforms */
    plats.forEach(p=>{
      drawSpr(x,VS.tile_vplat[0],p.x-8,p.y-4);
      drawSpr(x,VS.tile_vplat[0],p.x,p.y-4);
      x.fillStyle=PAL[12];x.fillRect(Math.round(p.x)-8,Math.round(p.y)-3,16,1);
    });
    /* bits */
    pick.forEach(p=>{
      const by=p.vy!=null?p.y:p.y+Math.sin(p.t*2.4)*2;
      drawSpr(x,VS.bit[(p.t*3|0)%2],p.x-3,by-3);
    });
    /* enemies */
    enemies.forEach(e=>{
      if(e.squash>0){
        const sq=VS[e.type+"_squash"][e.squash<.17?1:0];
        if(e.type==="flyer")drawSpr(x,sq,e.x-7,e.y-4);
        else drawSpr(x,sq,e.x-6,e.y-6);
        return;
      }
      if(e.type==="walker")drawSpr(x,(e.dir<0?VSF:VS).walker[(elapsed*6|0)%2],e.x-6,e.y-10);
      else if(e.type==="spitter")drawSpr(x,VS.spitter[e.open>0?1:0],e.x-6,e.y-12);
      else drawSpr(x,VS.flyer[(elapsed*6|0)%2],e.x-7,e.y-8);
    });
    /* globs */
    globs.forEach(s=>drawSpr(x,VS.glob[(elapsed*8|0)%2],s.x-3,s.y-3));
    /* the integrator */
    const blinkOn=invuln>0&&!EGG_RM&&((elapsed*9|0)%2===0);
    if(!blinkOn||dying>0){
      x.globalAlpha=invuln>0&&EGG_RM?.6:1;
      drawSpr(x,playerSprite(),px-8,py-20);
      x.globalAlpha=1;
    }
    parts.forEach(p=>{x.globalAlpha=Math.max(0,p.a);x.fillStyle=PAL[p.ci];x.fillRect(Math.round(p.x),Math.round(p.y),1,1)});
    x.globalAlpha=1;
    floats.forEach(f=>{x.globalAlpha=Math.max(0,Math.min(1,f.a));drawText(x,f.x-textW(f.txt)/2,f.y,f.txt,f.ci)});
    x.globalAlpha=1;
    x.restore();
    /* ==== HUD ==== */
    for(let i=0;i<3;i++){x.globalAlpha=i<lives?1:.18;drawSpr(x,VS.hud_face[0],2+i*9,2)}
    x.globalAlpha=1;
    drawText(x,34,2,"SCORE",15);
    drawText(x,34,8,String(score),6);
    drawText(x,88,2,"LEVEL",15);
    drawText(x,88,8,(level+1)+"/10",12);
    drawSpr(x,VS.bit[0],196,2);
    drawText(x,204,3,String(bits),10);
    if(banner&&banner.t<2.4){
      const k=banner.t<.3?banner.t/.3:banner.t>1.9?(2.4-banner.t)/.5:1;
      x.globalAlpha=Math.max(0,k);
      drawText(x,110-textW(banner.txt,2)/2,38,banner.txt,5,2);
      if(banner.sub)drawText(x,110-textW(banner.sub)/2,52,banner.sub,15);
      x.globalAlpha=1;
    }
    if(state==="clear"&&clearT>.7){
      const t1="SIGNAL RESTORED";
      drawText(x,110-textW(t1,2)/2,36,t1,9,2);
      const t2="LEVEL "+(level+1)+"/10";
      drawText(x,110-textW(t2)/2,52,t2,6);
    }
    if(state==="win"){
      x.fillStyle="rgba(7,5,15,.82)";x.fillRect(0,0,IW,IH);
      drawText(x,110-textW("TEN FOR TEN.",2)/2,44,"TEN FOR TEN.",9,2);
      drawText(x,110-textW("THE CAMPUS IS BROADCASTING.")/2,62,"THE CAMPUS IS BROADCASTING.",6);
    }
    if(paused){
      x.fillStyle="rgba(7,5,15,.7)";x.fillRect(0,0,IW,IH);
      drawText(x,110-textW("PAUSED",2)/2,56,"PAUSED",6,2);
      drawText(x,110-textW("P TO RESUME")/2,70,"P TO RESUME",15);
    }
    blitScaled(dctx,off,880,520);
  }
  function loop(ts){
    if(!alive)return;
    if(document.getElementById("egg5").style.display!=="flex"){egg5Anim=null;return}
    const now=ts!=null?ts:(window.performance&&performance.now?performance.now():Date.now());
    if(last==null)last=now;
    const dt=Math.min(.05,(now-last)/1000);last=now;
    if(!paused)update(dt);
    if(alive)draw();
    if(alive)egg5Anim=requestAnimationFrame(loop);
  }
  window.__eggDbg={game:"signal-jumper",
    state:()=>({state,level:level+1,score,lives,bits,alive,paused,px,py,vx,vy,grounded,facing,coyote,jbuf,duck,chain,checkpoint,invuln,dying,camX,screenOn,clearT,levelTime,flagX,endX,endY}),
    enemiesList:()=>enemies.map(e=>({type:e.type,x:e.x,y:e.y,squash:e.squash})),
    globsList:()=>globs.map(s=>({x:s.x,y:s.y,vx:s.vx,vy:s.vy})),
    platsList:()=>plats.map(p=>({x:p.x,y:p.y,pxv:p.pxv,pyv:p.pyv})),
    bitsList:()=>pick.map(p=>({x:p.x,y:p.y,phys:p.vy!=null})),
    maps:()=>EGG_VENUS.map(l=>({w:l.map[0].length,h:l.map.length,name:l.name})),
    tile:(ci,cj)=>tileAt(map,ci*8+1,cj*8+1),
    warp:(wx,wy)=>{px=wx;py=wy!=null?wy:112;vx=0;vy=0;camX=Math.max(0,Math.min(LW-IW,px-IW*.42))},
    setVy:v=>{vy=v;grounded=false},
    load:(n,cp)=>loadLevel(n,!!cp),
    spawn:(t,sx,sy)=>{enemies.push(t==="flyer"?{type:"flyer",x:sx,y:sy,ax:sx,ay:sy,t:0,squash:0}:t==="spitter"?{type:"spitter",x:sx,y:sy,t:.5,open:0,aim:0,squash:0}:{type:"walker",x:sx,y:sy,dir:-1,squash:0})},
    spawnGlob:(sx,sy,svx,svy)=>{globs.push({x:sx,y:sy,vx:svx,vy:svy||0,ttl:4})},
    clearGlobs:()=>{globs=[]},
    setPeace:v=>{peace=!!v},
    setLives:n=>{lives=n;hud()},
    hit:f=>hurtPlayer(!!f),
    skipClear:()=>{if(state==="clear")clearT=2.55}};
  loadLevel(cont?cont.level:0,false);
  egg5Anim=requestAnimationFrame(loop);
}

/* ============================================================================
   easter egg 6: THE LOST DISPLAY — top-down action-adventure (Pass C, art pass E,
   systems pass F)
   ----------------------------------------------------------------------------
   The campus's flagship display was stolen and hidden in a mesa fortress.
   The AV INTEGRATOR (12x14, hard hat + tool belt, 4-direction walk) explores
   a 10x10-screen overworld (each screen 15x10 tiles of 16px = 240x160 + a
   16px HUD row -> 240x176 internal, blitted x3 to 720x528), digs the two
   access chips out of the caves on the far west and far east edges of the map,
   finds the fortress door in the upper-right mesa, clears a 5x5-room dungeon
   of traps and locks, defeats THE CRT TYRANT, and hoists the display overhead.
   Art is the 16-bit register: deeper per-material ramps, hand anti-aliased
   edges, ordered dither on the big surfaces and two or three cuts of every
   ground and wall tile. See the EART6 header below for the house rules.

   WEAPON  crimper strike: short melee jab, 10px reach in the facing
           direction, 1 damage. At FULL HEALTH the strike launches a BEAM
           (pass F) that runs the whole width or height of the map, stopping
           at the first wall, enemy or boss body. The flight is resolved at
           fire time — a 3px march from the blade tip — so the beam is a line
           segment with a 0.24s life, not a projectile the loop chases. It
           carries exactly what the strike carries, so it is 1 with the
           crimper and 4 with the long sword; its voice is EggAudio.beamShot.
   SWORD   the DIGITAL LONG SWORD (vendor, 30 bits) is a permanent upgrade:
           4x strike damage, +3px reach, an ice-ramp blade (PAL 41-44, the
           only thing those four indices are used for) and an ice beam. The
           puck stays at half of whatever is in hand, so one purchase scales
           the whole kit rather than retiring a button. THE CRT TYRANT is the
           deliberate exception: hitBoss() counts vents, not damage, so the
           fight is five phases long whatever you are carrying.
   ACTION  X is the context action: grab the small rock in front of you
           (it may hide a bit or a cell), buy at a vendor stand, otherwise
           use the EQUIPPED item — the MERSIVE POLARIS boomerang (half
           damage, hits everything it passes), the TORCH, or the POTION.
   ITEMS   I opens the item screen. It stops the loop the way the P veil does
           and X cycles the equipped item among the ones you own. The HUD
           carries the equipped item in a well beside the cells, plus an ice
           chip once the long sword is bought.
   VENDOR  a cave mouth burned into the tree at (2,2) of the STARTING screen
           leads to THE BIT VENDOR: one room, three crates — POTION 10 bits
           (full heal, one held at a time, re-buyable), DIGITAL LONG SWORD 30
           bits (once), TORCH 15 bits (once). Prices and your bit count are on
           screen; too few bits or a second copy is refused out loud.
   TORCH   equipped + X burns the tree you are facing. Trees on row 0, row 9,
           column 0 and column 14 are the level's walls and will not light —
           burning them would open the map. Interior trees burn over ~1.1s of
           baked flame frames and leave passable ash; ten of them across ten
           screens leave a cave mouth instead.
   CAVES   five original hollow caves (mouths visible on the overworld) each
           hide a power cell 1-2 rooms in, ten one-room burn caves that do
           not exist until the tree above them is ash, and two one-room KEY
           CAVES — plain mouths, no torch needed — one on the far west edge at
           screen (0,7) and one on the far east edge at screen (9,2), each
           holding one of the fortress's two access chips. ECAVES is the three
           sets concatenated, so cave ids stay unique (0-4 / 5-14 / 15-16).
   RESPAWN a screen or room whose last enemy falls is marked cleared and stays
           empty until it drops out of the trail of the last MAP_WINDOW (3)
           maps entered — three map transitions away, counted in transitions
           travelled rather than distance. Walking a two-screen loop never
           re-arms either screen; a straight line of three does. Applies to
           overworld screens, fortress rooms, caves and tower floors alike.
   TOWER   THE RELAY TOWER on the south-west shore: five single-room floors
           climbed floor by floor by stairs; the MERSIVE POLARIS waits
           on the empty top floor.
   HEALTH  3 cells (half-cell granularity) + 17 power cells x 2
           half-cells = 40 half-cells = EXACTLY 20 cells, which is the cap
           in updDrops. The 17: 1 in the dead server yard, 1 in the fortress
           treasure room, 5 in the original hollow caves, 10 in the burn
           caves. Damage = knockback + 1s i-frames. Death -> "THE CAMPUS
           DIMS." (replay = fresh run; if you fell inside the fortress, R
           continues from the entrance).
   OVERWORLD ENEMIES  (1) SCUTTLER random-walk crab · (2) DART-MOTH pause/
           dash flier · (3) SPITTER BULB stationary arc-glob lobber ·
           (4) CHARGER telegraphs then charges when aligned · (5) SPLITTER
           SLIME splits into two minis on first hit · (6) BURROWER
           submerges (invulnerable) and surfaces near the player.
   DUNGEON ENEMIES  (7) SENTRY EYE line-of-sight beams · (8) RATTLER fast
           wall-hugger · (9) SHIELD DRONE front-shielded, strike from
           behind/side · (10) GLOOM JELLY freezes on contact (mash out).
   TRAPS   timed spike strips · wall arrow shooters · corner blade traps
           that spring diagonally across their lines · false-floor pits
           (crumble, drop, half-cell, re-enter at the room door).
   PUZZLES 2 access chips for the 2 locked doors, and neither is inside the
           fortress any more: one waits in the west key cave (0,7) and one in
           the east key cave (9,2), so the fortress is a place you arrive at
           already carrying its locks' answers. Each cave gives its key exactly
           once — keysGot remembers the cave id, so walking back in finds an
           empty room. A push-block onto a floor switch opens the treasure
           room; the boss door seals during the fight; the prize room opens on
           victory. Bump a still-locked key door and the game says so.
   BOSS    THE CRT TYRANT (32x32 monitor-beast on treads): trundles, fires
           a beam spread (3 + one per hit taken), then vents its screen
           open — strike the screen. 5 hits; each hit +10% speed +1 beam.
   MAPS    EARTH_OW / EARTH_DUN / EARTH_LOCKS / EARTH_META are generated and
           connectivity-proven by _egg_work/earth_maps.py (stitched-megamap
           BFS for the overworld; key/lock/switch/boss simulation for the
           dungeon). That generator has not been re-run since, so the vendor
           mouth, the burn caves and the two key-cave mouths are stitched over
           the generated rows at load time by owRows() rather than baked in —
           see EVENDOR / EBURN_CAVES / EKEY_CAVES above. Both key-cave screens
           sit inside the generator's proven-connected overworld (every one of
           the 100 screens is reachable from the start screen), and
           __eggDbg6.keyCaves() reports them so a test can walk to each in
           turn. Music: EggAudio.music('overworld'/'dungeon'/
           'boss'). REDUCED MOTION: every pass-F animation (fire, beam, vendor
           idle, item-screen slide) has a static branch on EGG_RM, and all of
           the new art is compiled into SPR once by eggPx6.
   ========================================================================== */
let egg6Anim=null,egg6Best=0,egg6Keys=null;
/* THE LOST DISPLAY — world data (generated + validated by earth_maps.py) */
/* tile tables: art + walkability for the two worlds */
const ETILE_OW={
  ".":{a:"e_t_field",alt:"e_t_field2",alt2:"e_t_field3",w:1},"p":{a:"e_t_path",alt:"e_t_path2",w:1},
  "s":{a:"e_t_sand",alt2:"e_t_sand2",w:1},"y":{a:"e_t_yard",alt:"e_t_yard2",w:1},"b":{a:"e_t_bridge",w:1},
  "d":{a:"e_t_door",w:1},"t":{a:"e_t_tree"},"r":{a:"e_t_rock",alt:"e_t_rock2"},
  "w":{a:"e_t_water",fps:3},"m":{a:"e_t_monolith"},"c":{a:"e_t_cave",w:1},
  "T":{a:"e_t_tower"},"g":{a:"e_t_towerdoor",w:1},"k":{a:"e_t_rockS"},
  /* pass F: "u" is what a burnt interior tree leaves behind (passable ash and
     stump), "V" is the vendor's cave mouth on the starting screen */
  "u":{a:"e_t_burnt",w:1},"V":{a:"e_t_vendor",w:1}
};
const ETILE_CAVE={
  ".":{a:"e_c_floor",alt:"e_c_floor2",w:1},"#":{a:"e_c_wall",alt:"e_c_wall2"},
  "o":{a:"e_d_torch",fps:5},"%":{a:"e_c_rubble"}
};
const ETILE_TWR={
  ".":{a:"e_w_floor",alt2:"e_w_floor2",w:1},"#":{a:"e_w_wall",alt:"e_w_wall2"},
  "o":{a:"e_d_torch",fps:5},">":{a:"e_d_stairup",w:1},"<":{a:"e_d_stairdn",w:1},
  "W":{a:"e_d_pedestal",w:1}
};
const ETILE_DUN={
  ".":{a:"e_d_floor",alt:"e_d_floor2",w:1},"S":{a:"e_d_floor",w:1},
  "V":{a:"e_d_floor",w:1},"F":{a:"e_d_crack",w:1},"X":{a:"e_d_floor",w:1},
  "E":{a:"e_d_stairs",w:1},"Y":{a:"e_d_pedestal",w:1},
  "#":{a:"e_d_wall",alt2:"e_d_wall2"},"o":{a:"e_d_torch",fps:5},"A":{a:"e_d_arrow"},
  /* "K" was the key chest in room (0,4). The keys live in the overworld now,
     so the generated char is left standing as ordinary walkable floor rather
     than re-running the generator to take it out of EARTH_DUN. */
  "K":{a:"e_d_floor",w:1}
};
/* --- pass F/G world data ----------------------------------------------------
   EARTH_* in ./data is generated by earth_maps.py and has not been re-run, so
   the four things added since live here and are stitched over the generated
   maps at load time rather than baked into them:

     EVENDOR       the vendor's cave mouth, punched into an interior tree on the
                   starting screen. Two tiles up and five left of where the run
                   begins, so it is the first thing on the screen you can walk
                   into that is not a rock.
     EBURN_CAVES   ten one-room hollow caves, one per overworld screen, each
                   holding a power cell. None of them exist until the tree
                   standing on the mouth has been burned with the torch.
     EKEY_CAVES    pass G: the two access chips, taken out of the fortress and
                   put at opposite ends of the overworld — one mouth on the far
                   west edge at screen (0,7), one on the far east edge at (9,2),
                   both on tile (6,2) beside the rock spur that is already
                   there, with open ground underneath so exitCave() lands the
                   player on walkable tile. They are plain mouths, not burn
                   mouths: the keys must never sit behind the 15-bit torch, or
                   the fortress would be gated on the bit economy.
     ECAVES        EARTH_CAVES (the five original hollow caves, indices 0-4),
                   then the ten burn caves (5-14), then the two key caves
                   (15-16). Cave ids in containersGot / keysGot are
                   "cave"+index, so the three sets never collide.

   UPTIME ARITHMETIC  3 starting cells (hp 6) + 17 containers x 2 half-cells
   (34) = 40 half-cells = 20 cells. The 17 are: 1 overworld (dead server
   yard) + 1 fortress treasure room + 5 original hollow caves + 10 burn caves.
   The key caves hold a key and nothing else, so they do not touch that sum. */
const EVENDOR={sx:EARTH_META.start.sx,sy:EARTH_META.start.sy,tx:2,ty:2};
const EVENDOR_ROOM=["###o###.###o###","#.............#","#.............#","#.............#","#.............#","#.............#","#.............#","#.............#","#.............#","#######.#######"];
const EPRICE={potion:10,sword:30,torch:15};
/* one room, one container, one resident — the mid char is the resident */
function eBurnCave(sx,sy,tx,ty,mid){
  return{sx,sy,tx,ty,burn:true,rooms:[
    ["###o###.###o###","#.............#","#..%.......%..#","#.............#","#......H......#","#....."+mid+".......#","#...%.....%...#","#.............#","#.............#","#######.#######"]]};
}
const EBURN_CAVES=[
  eBurnCave(1,0,11,2,"8"),eBurnCave(4,1,5,6,"0"),eBurnCave(8,2,6,1,"7"),
  eBurnCave(2,3,5,4,"8"),eBurnCave(6,3,8,2,"1"),eBurnCave(0,5,5,4,"0"),
  eBurnCave(9,4,6,4,"7"),eBurnCave(5,6,7,4,"8"),eBurnCave(3,7,7,3,"0"),
  eBurnCave(2,8,5,3,"7")];
/* pass G: one room, one access chip, one resident. "L" is the key entity —
   parseEnts turns it into a drop the first time only, so the room is bare on
   every visit after the one that paid out. The east cave keeps a SHIELD DRONE
   in it: it used to be the thing carrying the key, and it is still the thing
   standing between you and it. */
function eKeyCave(sx,sy,tx,ty,mid){
  return{sx,sy,tx,ty,key:true,rooms:[
    ["###o###.###o###","#.............#","#..%%.....%%..#","#.............#","#......L......#","#....."+mid+".......#","#..%%.....%%..#","#.............#","#.............#","#######.#######"]]};
}
const EKEY_CAVES=[eKeyCave(0,7,6,2,"8"),eKeyCave(9,2,6,2,"9")];
const ECAVES=EARTH_CAVES.concat(EBURN_CAVES,EKEY_CAVES);
/* THE LOST DISPLAY — art, pass E: the 16-bit pass. Overrides the same keys in
   EGG_ART (actors *and* tiles) and is compiled over SPR/SPRF/SPRW the first time
   the game opens, so nothing else in the module sees it. House rules:

   LIGHT     one source, upper left, everywhere — the same direction drawEdges()
             and shadowAt() already assume. A surface facing it carries the
             lit end of its ramp; the side away from it carries the cool end.
   RAMPS     5-6 tones per material instead of the 8-bit 3, taken from the PAL
             extension: cloth 6/5/Y/4/d/3/X/2, sandstone H/I/C/J/K/L, skin
             Z/D/b/c/L, plant M/9/N/8/O, metal P/F/Q/R/S, water T/A/U/B/V/W,
             red D/e/E/a. One outline colour (G) still runs the whole silhouette.
   EDGES     curve boundaries step through an intermediate tone rather than
             jumping — hand anti-aliasing. Everything stays pixel-snapped.
   DITHER    ordered (4x4) checkerboards only on the big surfaces — ground,
             water, cave floor, concrete, brick. Never on an actor sprite, and
             always baked into the tile, so it can never strobe.
   VARIANTS  ground and wall tiles ship 2-3 versions picked by a position hash
             in drawMap(), so a screen of one material stops reading as a grid.
   FRAMES    player walks on 4 frames (pass / contact / pass / contact) and
             breathes on a 3-phase idle; the moth and the relay wisp gained a mid
             frame. Limbs stay 2px so the outline can never eat them, and no
             silhouette changed — hitboxes are computed from code, not art,
             and every actor still occupies exactly the box it did before.   */
const EART6={
e_p_down:[
["...GGGGGG...","..G7IIIIDG..",".GCICCCCJCG.","..GZDDDDbG..","..GZGDDGbG..","..GZDDDDLG..",".G6Y444443G.",".G6444444XG.",".GZ444444bG.",".GCDJJJCbJG.","..GdXGGdXG..","..GdXGGdXG..","..G21GG21G..","..GGGGGGGG.."],
["...GGGGGG...","..G7IIIIDG..",".GCICCCCJCG.","..GZDDDDbG..","..GZGDDGbG..","..GZDDDDLG..",".G6Y444443G.",".G6444444XG.",".GZ444444bG.",".GCDJJJCbJG.","..GdXGGdXG..","..GdXGGdXG..","..G21GGdXG..","..GGGGG21G.."],
["...GGGGGG...","..G7IIIIDG..",".GCICCCCJCG.","..GZDDDDbG..","..GZGDDGbG..","..GZDDDDLG..",".G6Y444443G.",".G6444444XG.",".GZ444444bG.",".GCDJJJCbJG.","..GdXGGdXG..","..GdXGGdXG..","..G21GG21G..","..GGGGGGGG.."],
["...GGGGGG...","..G7IIIIDG..",".GCICCCCJCG.","..GZDDDDbG..","..GZGDDGbG..","..GZDDDDLG..",".G6Y444443G.",".G6444444XG.",".GZ444444bG.",".GCDJJJCbJG.","..GdXGGdXG..","..GdXGGdXG..","..GdXGG21G..","..G21GGGGG.."]],
e_p_down_i:[
["...GGGGGG...","..G7IIIIDG..",".GCICCCCJCG.","..GZDDDDbG..","..GZGDDGbG..","..GZDDDDLG..",".G6Y444443G.",".G6444444XG.",".GZ444444bG.",".GCDJJJCbJG.","..GdXGGdXG..","..GdXGGdXG..","..G21GG21G..","..GGGGGGGG.."],
["...GGGGGG...","..G7IIIIDG..",".GCICCCCJCG.","..GZDDDDbG..","..GZGDDGbG..","..GZDDDDLG..",".G66444443G.",".G6544444XG.",".GZ444444bG.",".GCDJJJCbJG.","..GdXGGdXG..","..GdXGGdXG..","..G21GG21G..","..GGGGGGGG.."]],
e_p_up:[
["...GGGGGG...","..G7IIIIDG..",".GCICCCCJCG.","..GX22221G..","..GX22221G..","..GZ2222bG..",".G6Y444443G.",".G64FFFF4XG.",".GZ4FFFF4bG.",".GCDJJJCbJG.","..GdXGGdXG..","..GdXGGdXG..","..G21GG21G..","..GGGGGGGG.."],
["...GGGGGG...","..G7IIIIDG..",".GCICCCCJCG.","..GX22221G..","..GX22221G..","..GZ2222bG..",".G6Y444443G.",".G64FFFF4XG.",".GZ4FFFF4bG.",".GCDJJJCbJG.","..GdXGGdXG..","..GdXGGdXG..","..G21GGdXG..","..GGGGG21G.."],
["...GGGGGG...","..G7IIIIDG..",".GCICCCCJCG.","..GX22221G..","..GX22221G..","..GZ2222bG..",".G6Y444443G.",".G64FFFF4XG.",".GZ4FFFF4bG.",".GCDJJJCbJG.","..GdXGGdXG..","..GdXGGdXG..","..G21GG21G..","..GGGGGGGG.."],
["...GGGGGG...","..G7IIIIDG..",".GCICCCCJCG.","..GX22221G..","..GX22221G..","..GZ2222bG..",".G6Y444443G.",".G64FFFF4XG.",".GZ4FFFF4bG.",".GCDJJJCbJG.","..GdXGGdXG..","..GdXGGdXG..","..GdXGG21G..","..G21GGGGG.."]],
e_p_up_i:[
["...GGGGGG...","..G7IIIIDG..",".GCICCCCJCG.","..GX22221G..","..GX22221G..","..GZ2222bG..",".G6Y444443G.",".G64FFFF4XG.",".GZ4FFFF4bG.",".GCDJJJCbJG.","..GdXGGdXG..","..GdXGGdXG..","..G21GG21G..","..GGGGGGGG.."],
["...GGGGGG...","..G7IIIIDG..",".GCICCCCJCG.","..GX22221G..","..GX22221G..","..GZ2222bG..",".G66444443G.",".G65FFFF4XG.",".GZ4FFFF4bG.",".GCDJJJCbJG.","..GdXGGdXG..","..GdXGGdXG..","..G21GG21G..","..GGGGGGGG.."]],
e_p_side:[
["...GGGGG....","..G7IIICG...",".GCCCCCJCCG.","...GZDDbG...","...GZDGbG...","...GZDDbG...","..GYY4444G..","..G64444XG..","..G64444bG..","..GCDCCbJG..","...Gd33XG...","...Gd33XG...","...G2111G...","...GGGGGG..."],
["...GGGGG....","..G7IIICG...",".GCCCCCJCCG.","...GZDDbG...","...GZDGbG...","...GZDDbG...","..GYY4444G..","..G64444XG..","..G64444bG..","..GCDCCbJG..","...G3XXXG...","..Gd3GG33G..","..G21G.G22G.","..GGGG.GGGG."],
["...GGGGG....","..G7IIICG...",".GCCCCCJCCG.","...GZDDbG...","...GZDGbG...","...GZDDbG...","..GYY4444G..","..G64444XG..","..G64444bG..","..GCDCCbJG..","...Gd33XG...","...Gd33XG...","...G2111G...","...GGGGGG..."],
["...GGGGG....","..G7IIICG...",".GCCCCCJCCG.","...GZDDbG...","...GZDGbG...","...GZDDbG...","..GYY4444G..","..G64444XG..","..G64444bG..","..GCDCCbJG..","...Gd33XG...","...G3XXXG...","..G22GG22G..","..GGGGGGGG.."]],
e_p_side_i:[
["...GGGGG....","..G7IIICG...",".GCCCCCJCCG.","...GZDDbG...","...GZDGbG...","...GZDDbG...","..GYY4444G..","..G64444XG..","..G64444bG..","..GCDCCbJG..","...Gd33XG...","...Gd33XG...","...G2111G...","...GGGGGG..."],
["...GGGGG....","..G7IIICG...",".GCCCCCJCCG.","...GZDDbG...","...GZDGbG...","...GZDDbG...","..G6Y4444G..","..G65444XG..","..G64444bG..","..GCDCCbJG..","...Gd33XG...","...Gd33XG...","...G2111G...","...GGGGGG..."]],
e_p_swing_down:[
["...GGGGGG...","..G7IIIIDG..",".GCICCCCJCG.","..GZDDDDbG..","..GZGDDGbG..","..GZDDDDLG..",".G6Y444443G.",".G6444444XG.",".GZ44444DXG.",".GCDJJJCDdG.","..GdXGGdXb..","..GdXGGdXG..","..G21GG21G..","..GGGGGGGG.."]],
e_p_swing_up:[
["...GGGGGG...","..G7IIIIDG..",".GCICCCCJCG.","..GX22221G..","..GX22221G..","..GZ2222bG..",".G6Y4444D3G.",".G64FFFF4bG.",".GZ4FFFF4XG.",".GCDJJJCbJG.","..GdXGGdXG..","..GdXGGdXG..","..G21GG21G..","..GGGGGGGG.."]],
e_p_swing_side:[
["...GGGGG....","..G7IIICG...",".GCCCCCJCCG.","...GZDDbG...","...GZDGbG...","...GZDDbG...","..GYY4444G..","..G6444443G.","..G64444db4.","..GCDCCbJG..","...Gd33XG...","...Gd33XG...","...G2111G...","...GGGGGG..."]],
e_p_hoist:[
[".GGGGGGGGGGGGGG.",".GMMMMMMMMMMM9G.",".GM9799999999NG.",".GM9999999979NG.",".G9NNNNNNNNNNNG.",".GGGGGGGGGGGGGG.","...D........D...","....D7IIIICD....",".....CCCCJJ.....","......DDbb......","......GZbG......","......ZZDD......",".....YY4444.....",".....4ddddd.....",".....GGCGGG.....",".....4YYY44.....","......d33X......","......d33X......","......3XXX......",".....GGGGGG....."],
[".GGGGGGGGGGGGGG.",".GTTTTTTTTTTTAG.",".GTA7AA7AAAAAUG.",".GTAAAAAAAA7AUG.",".GAUUUUUUUUUUUG.",".GGGGGGGGGGGGGG.","...D........D...","....D7IIIICD....",".....CCCCJJ.....","......DDbb......","......GZbG......","......ZZDD......",".....YY4444.....",".....4ddddd.....",".....GGCGGG.....",".....4YYY44.....","......d33X......","......d33X......","......3XXX......",".....GGGGGG....."]],
e_scuttler:[
["...GGGGGG...","..GMMMMM9G..",".GMM999999G.",".GM7G99G7NG.","G9988888ON9G","G9GN8888OG9G",".GG8OOOOOGG.","..GGGGGGGG..",".G.G....G.G.","............"],
["............","...GGGGGG...","..GMMMMM9G..",".GMM999999G.",".GM7G99G7NG.","G9988888ON9G","G9GN8888OG9G",".GG8OOOOOGG.","..GGGGGGGG..","..G.G..G.G.."]],
e_moth:[
["..G......G..","...G....G...",".GG6566GG...","G665G6YG666G","G65YG5YG6Y5G",".G6YGGGG55G.","..GG5GG5GG..","....G65G....","....G6YG....","....G5YG....",".....GG.....","............"],
["..G......G..","...G.GG.G...","....G65G....","..GGG6YGGG..",".G655GY5G66G","G65YG6YG555G",".GGGG6YGGGG.","....G6YG....","....G6YG....","....G5YG....",".....GG.....","............"],
["............","..G......G..","...G566GG...",".GG6G6YGG...","G665G5YG666G","G65YGGGG6Y5G",".G6Y5GG555G.","..GGG65GGG..","....G6YG....","....G5YG....",".....GG.....","............"]],
e_bulb:[
["............","....GGGG....","...GIIICG...","..GIIDDCCG..",".GIZDDDDDCG.",".GZDDEEDDbG.",".GDDEEEEbbG.","..GDbDbbbG..","...GGMNGG...","....G9NG....","...G9GG9G...","............"],
["............","...GG..GG...","..GICGGICG..",".GICbGGDCCG.",".GZbGGGGZbG.",".GZbG21GZbG.",".GDDZGGZDbG.","..GDbDbbbG..","...GGMNGG...","....G9NG....","...G9GG9G...","............"]],
e_charger:[
["..............",".....GGGGGG...","..GGGGZZZZDG..",".GZZZZZDD7DDG.",".GZDDDDDDDDbGC",".GbDDDDDDDDbCG",".GbcDDDDDDDbG.",".GcLLLLLLLLLG.","..GGGGGGGGGG..","...G.G..G.G...","...G.G..G.G...",".............."],
["..............",".....GGGGGG...","..GGGGZZZZDG..",".GZZZZZDD7DDG.",".GZDDDDDDDDbGC",".GbDDDDDDDDbCG",".GbcDDDDDDDbG.",".GcLLLLLLLLLG.","..GGGGGGGGGG..","..G.G....G.G..","..G.G....G.G..",".............."]],
e_slime:[
["............","....GGGG....","..GG6666GG..",".G66644566G.","G6654444556G","G654G44G45YG","G54444444dYG",".G344444dXG.",".GG3XXXXXGG.","..GGGGGGGG.."],
["............","............","....GGGG....","..GG6666GG..",".G66644566G.","G664G44G455G","G644444444YG","G5XddddddXYG",".GGGGGGGGGG.","............"]],
e_slime_mini:[
["..GGGG..",".G6666G.","G664455G","G6G44GYG","G5444dYG",".G3ddXG.","..GGGG.."],
["........","..GGGG..",".G6666G.","G6G44G5G","G5d4ddYG",".GG3XGG.","..GGGG.."]],
e_burrow_mound:[
["............","....GGGG....","..GGDDDbGG..",".GDDDbbbDbG.","GbcLLLLLLLbG","GGGGGGGGGGGG"],
["...G....G...","....GGGG....","..GGDDDbGG..",".GDIDbbbDbG.","GbcLLLLLLLbG","GGGGGGGGGGGG"]],
e_burrower:[
["............","....GGGG....","..GG6666GG..",".G6PPFFFP6G.",".GPG7FF7GQG.",".GPFFDDFFQG.",".GPFFDDFFQG.",".GPFFFFFFQG.",".GXFFFFFF1G.",".G22FFFF11G.","GCG211111GCG","..GGGGGGGG.."],
["............","............","....GGGG....","..GG6666GG..",".G6PPFFFP6G.",".GPG7FF7GQG.",".GPFFDDFFQG.",".GPFFFFFFQG.",".GXFFFFFF1G.",".GX2FFFF21G.","GC21111111CG","..GGGGGGGG.."]],
e_sentry:[
["....GGGG....","..GGYYY4GG..",".GYY6776Y4G.","GYY67777644G","GY677EE776dG","GY677EE776dG","G44677776ddG",".G4d6775ddG.","..GG4dddGG..","....GGGG....","............","............"],
["....GGGG....","..GGYYY4GG..",".GYY6776Y4G.","GYY67777644G","GY67EE7776dG","GY67EE7776dG","G44677776ddG",".G4d6775ddG.","..GG4dddGG..","....GGGG....","............","............"]],
e_rattler:[
["............","............",".......GGGG.",".GGGGGGIII7G","GIZIZIZICCJG","GDJbJbJbJbJG",".GGGGGGGGGG.","..G..G..G...","............","............"],
["............","............",".......GGGG.",".GGGGGGIII7G","GZIZIZIZCCJG","GCbJbJbJbJbG",".GGGGGGGGGG.","...G..G..G..","............","............"]],
e_shield:[
["............","....GGGG....","..GG6666GG..",".G6PPFFFP6G.",".GP2FFFF2QG.",".GP2FEEF2QG.",".GPFFFFFFQG.",".GP222222QG.",".GFQQQQQQQG.","..GGGGGGGG..","...G.GG.G...","...G.GG.G..."],
["............","....GGGG....","..GG6666GG..",".G6PPFFFP6G.",".GP2FFFF2QG.",".GP2F77F2QG.",".GPFFFFFFQG.",".GP222222QG.",".GFQQQQQQQG.","..GGGGGGGG..","..G.G..G.G..","..G.G..G.G.."]],
e_jelly:[
["............","....GGGG....","..GGTTTAGG..",".GTTTAAATAG.","GTT6AAAA6AAG","GTABBBBBBAUG","GABBBBBBBVUG",".GUBBBBBBVG.",".GBVVBVVVVG.","..GBGBVGBG..","...G.GG.G...","............"],
["............","............","....GGGG....","..GGTTTAGG..",".GTTTAAATAG.","GTT6AAAA6AAG","GTABBBBBBAUG","GABBBBBBBVUG",".GBVVBVVVVG.","..GBGBVGBG..","..G.G..G.G..","...G....G..."]],
e_heart_full:[
[".aaa.","a777a","a7D7a","a777a",".aaa."]],
e_heart_half:[
[".aaF.","a77RF","a7DRF","a77RF",".aaF."]],
e_heart_empty:[
[".FFF.","FRRRF","FRSRF","FRRRF",".FFF."]],
e_pick_heart:[
[".aaa.","a77Da","a7D7a",".aaa."],
[".aaa.","aD77a","a77Da",".aaa."]],
e_key:[
[".GGG.","GI7CG","GCJJG",".GCG.","..CCG","..CG."],
[".GGG.","GII7G","GCJJG",".GCG.","..CCG","..CG."]],
e_container:[
["...GGGGG...","..G77777G..",".G7777777G.","G777D7D777G","G77D777D77G","G7777D7777G","G77D777D77G","G777D7D777G",".G7777777G.","..GaaaaaG.."]],
e_prize:[
["GGGGGGGGGGGGGG","GXXXXXXXXXXX2G","GXAAAAAAAAAA1G","GXA7AAAAAAAB1G","GXAA7AAAAABB1G","GXAAA7AAABBB1G","GXAAAAAABBBB1G","G212222222111G",".GG9NNNNNNNGG.","...GGGGGGGG..."],
["GGGGGGGGGGGGGG","GXXXXXXXXXXX2G","GXAAAAAAAAAA1G","GXAAA7AAAAAB1G","GXAAAA7AAABB1G","GXAAAAA7ABBB1G","GXAAAAAABBBB1G","G212222222111G",".GG9NNNNNNNGG.","...GGGGGGGG..."]],
e_wisp:[
[".G....G.","G65GG66G","G65II55G",".G5CJYG.","..GIJG..","..G77G..","..GCJG..","...GG..."],
["..G..G..",".G5GG5G.",".G6IC6G.","..GIJG..","..GIJG..","..G77G..","..GCJG..","...GG..."],
["........","..GICG..","G66IC66G","G65CCY5G",".G5CJYG.","..G77G..","..GCJG..","...GG..."],
["........",".G.GG.G.","G66II66G","G65CCY5G",".G5CJYG.","..G77G..","..GCJG..","..GGGG.."]],
e_crimp_h:[
[".PPP66666.","CP666667.6",".FQQ55556."]],
e_crimp_v:[
[".77.",".65.",".65.",".65.",".65.",".65.",".65.",".65.","F65F",".CJ."]],
e_bolt:[
[".A.","A7A",".A."],
["A.A",".7.","A.A"]],
e_shieldbar_h:[
["666666666666","777777777777","655555555555"]],
e_shieldbar_v:[
["676","675","675","675","675","675","675","675","675","675","675","675"]],
e_boss:[
["................................","................................","................................",".....E....................E.....","......F..................F......","......F..................F......","....YYYYYYYYYYYYYYYYYYYYYYY4....","....Y2222222222222222222222X....","....Y2222222222222222222222X....","..F.Y2211111111111111111122X.F..","..F.Y2210000000000000000122X.F..","....Y2211111111111111111122X....","..F.Y221000EEE0000EEE000122X.F..","..F.Y221000E7E0000E7E000122X.F..","....Y221000EEE0000EEE000122X....","..F.Y2210000000000000000122X.F..","..F.Y2210000000000000000122X.F..","....Y2210000EEEEEEEE0000122X....","....Y221000E00000000E000122X....","....Y2210000000000000000122X....","....Y2211111111111111111122X....","....Y2222222222222222222222X....","....Y2222222222222222222222X....","....Y3333333333333333333333X....","...dd333333333333333333333333...","...XFFFFFFFFFFFFFFFFFFFFFFFF1...","...XFFFFFFFFFFFFFFFFFFFFFFFF1...","...XFGFFGFFGFFGFFGFFGFFGFFGF1...","...XFFFFFFFFFFFFFFFFFFFFFFFF1...","...XFGFFGFFGFFGFFGFFGFFGFFGF1...","...21111111111111111111111111...","................................"],
["................................","................................","................................",".....E....................E.....","......F..................F......","......F..................F......","....YYYYYYYYYYYYYYYYYYYYYYY4....","....Y2222222222222222222222X....","....Y2222222222222222222222X....","..F.Y2211111111111111111122X.F..","..F.Y2210000000000000000122X.F..","....Y2210000000000000000122X....","..F.Y221000EEE0000EEE000122X.F..","..F.Y221000E7E0000E7E000122X.F..","....Y221000EEE0000EEE000122X....","..F.Y2210000000000000000122X.F..","..F.Y2210000000000000000122X.F..","....Y2210000000000000000122X....","....Y2210000EEEEEEEE0000122X....","....Y2211111111111111111122X....","....Y2211111111111111111122X....","....Y2222222222222222222222X....","....Y2222222222222222222222X....","....Y3333333333333333333333X....","...dd333333333333333333333333...","...XFFFFFFFFFFFFFFFFFFFFFFFF1...","...XFFFFFFFFFFFFFFFFFFFFFFFF1...","...XFGFFGFFGFFGFFGFFGFFGFFGF1...","...XFFFFFFFFFFFFFFFFFFFFFFFF1...","...XFFGFFGFFGFFGFFGFFGFFGFFG1...","...21111111111111111111111111...","................................"]],
e_boss_open:[
["................................","................................","................................",".....E....................E.....","......F..................F......","......F..................F......","....YYYYYYYYYYYYYYYYYYYYYYY4....","....Y2222222222222222222222X....","....Y2222222222222222222222X....","..F.Y2244444444444444444422X.F..","..F.Y2233333333333333333322X.F..","....Y2233333333333333333322X....","..F.Y2228888888888888888222X.F..","..F.Y2228899999999999988222X.F..","....Y2228899999999999988222X....","..F.Y2228899997777999988222X.F..","..F.Y2228899997777999988222X.F..","....Y2228899997777999988222X....","....Y2228899999999999988222X....","....Y2228899999999999988222X....","....Y2228888888888888888222X....","....Y2222222222222222222222X....","....Y2222222222222222222222X....","....Y3333333333333333333333X....","...dd333333333333333333333333...","...XFFFFFFFFFFFFFFFFFFFFFFFF1...","...XFFFFFFFFFFFFFFFFFFFFFFFF1...","...XFGFFGFFGFFGFFGFFGFFGFFGF1...","...XFFFFFFFFFFFFFFFFFFFFFFFF1...","...XFGFFGFFGFFGFFGFFGFFGFFGF1...","...21111111111111111111111111...","................................"],
["................................","................................","................................",".....E....................E.....","......F..................F......","......F..................F......","....YYYYYYYYYYYYYYYYYYYYYYY4....","....Y2222222222222222222222X....","....Y2222222222222222222222X....","..F.Y2244444444444444444422X.F..","..F.Y2233333333333333333322X.F..","....Y2233333333333333333322X....","..F.Y2228888888888888888222X.F..","..F.Y2228899999999999988222X.F..","....Y2228899999999999988222X....","..F.Y2228899996666999988222X.F..","..F.Y2228899996666999988222X.F..","....Y2228899996666999988222X....","....Y2228899999999999988222X....","....Y2228899999999999988222X....","....Y2228888888888888888222X....","....Y2222222222222222222222X....","....Y2222222222222222222222X....","....Y3333333333333333333333X....","...dd333333333333333333333333...","...XFFFFFFFFFFFFFFFFFFFFFFFF1...","...XFFFFFFFFFFFFFFFFFFFFFFFF1...","...XFGFFGFFGFFGFFGFFGFFGFFGF1...","...XFFFFFFFFFFFFFFFFFFFFFFFF1...","...XFFGFFGFFGFFGFFGFFGFFGFFG1...","...21111111111111111111111111...","................................"]],
e_dart_h:[
["PPPPPP7c","6666667L","FQQQQQ7L"]],
e_dart_v:[
["P6F","P6Q","P6Q","P6Q","P6Q","P6Q","777",".c."]],
e_blade:[
["..7..7..",".7F..F7.","..PPPF..","..PccQ..","..PccQ..","..FQQQ..",".7F..F7.","..7..7.."],
[".7....7.","..P7.F..",".7PFPF7.","..PccQ..","..PccQ..",".7PQQQ7.","..F7.F..",".7....7."]],
e_spark:[
["..7..",".7I7.","7I7J7",".7J7.","..7.."],
[".7.7.","7.C.7",".C.C.","7.C.7",".7.7."]],
e_glob_arc:[
[".eE.","eZDE","EDba",".Ea."],
[".ZD.","ZeED","DEab",".Db."]],
e_puck:[
["..GGGG..",".G7T7AG.","GT77AABG","GTAAAAVG","GTAcAAVG","GABAAVVG",".GAVVVG.","..GGGG.."],
["..GGGG..",".GTT7AG.","GTT7AABG","GTAA7AVG","GTAcAAVG","GABAAVVG",".GAVVVG.","..GGGG.."]],
e_puck_ico:[
[".GGGG.","G7TTBG","GT7AVG","GTcAVG","GAVVVG",".GGGG."]],
e_item_puck:[
["..GGGGGGGG..",".GTT77TTTTBG","GTT77AAAAAVG","GTAAAAAAABVG","GTAAccAAABVG","GTAAccAAABVG","GTABAAAABBVG","GABBAAABBVVG",".GAVVVVVVVG.","..GGGGGGGG.."],
["..GGGGGGGG..",".GTTTT77TTBG","GTTAAA77AAVG","GTAAAAAAABVG","GTAAccAAABVG","GTAAccAAABVG","GTABAAAABBVG","GABBAAABBVVG",".GAVVVVVVVG.","..GGGGGGGG.."]],
e_t_field:[
["ICCCICCCICCCICCC","CCCDCCCCCCCCDCCC","CCDDCCIC9CICMCIC","CCCCCCCC99C9N9CC","ICCCICCCI9CC8CCC","CDCCCCCCCCCCCDCC","CCICC9ICCCICDDIC","CCCC99CCCCCCCCCC","ICCCI9CCIcCCICCC","CCCCMCCCCDCCCCCC","CC9M9NICDDICCCIC","C99NCN9CCCCCC9CC","IC98N8CCICCC99CC","CCCCCDCCCCCCC9CC","CCIDDDICCCICCCIC","CCCCCCCCCCCCCCCC"]],
e_t_field2:[
["ICCCICCCICCCICCC","CCCCCCC9CCCCCCCC","CCDMCC99CCICDDIC","CC9N9CC9CCCCCDCC","ICC8ICCCICCCICCC","CCCCCCCCCCc9CCCC","C9ICCCICCC99CCIC","C99CCCDCCCC9CCCC","IC9CICDDICCCICCC","CCCCCCCCCCCCCCCC","CCICC9ICCCIMCDIC","CCCC99CCCCM9NDCC","ICCCI9CCI9NCN9CC","CCDCCCCCC98N8CCC","CCICCCICC99CCCIC","CCCCCCCCCCCCCCCC"]],
e_t_field3:[
["ICCCICCCICCCICCC","CCCCCCCCCCCCCCCC","CCIc7cICCCICCCIC","CCCC7CCCCCCc7cCC","ICCC8CCCICCC7CCC","CCCC8CCCCCCC8CCC","CCICCCICCCIC8CIC","CCCCCCCCCCCCCCCC","ICCCICCCICCCICCC","CCCCCCc7cCCCCCCC","CCMCCCI7CCICCCIC","C9N9CCC8CCCC9MCC","IC8CICC8ICCC9N9C","CCCCCCCCCCCCC8CC","CCIDDCICCCICCCIC","CCCCCCCCCCCCCCCC"]],
e_t_path:[
["CCCCCCCCCCCCCCCC","DDDDDDDCDDDDDDDD","DCCDDDJDDDJDCCJD","DDKDDDccDDKDDDKD","JDJDJDJcJDJDJDJD","DDCCDDDDDDDDCDDD","DDJDDDJDDDJDDDJD","DDKDDCKDccKDDDKD","JDJDJDJDJcJDJDJD","DDCDDDDDDDDDDCDD","DDJDDDJDDDJDDDJD","DDKDccKDDDCCDDKD","JDJDJcJDJDJDJDJD","DCDDDDDDDDDDDDCD","DDJDDDJCDDJDDDJD","CCCCCCCCCCCCCCCC"]],
e_t_path2:[
["CCCCCCCCCCCCCCCC","DDDDDDDCDDDDDDDD","JCCIJDDIJDDICCDI","DDDDDDccDDDDDDDD","JIJDJIJcJIJDJIJD","DDCCDDDDDDDDCDDD","JDDIJKDIJDDIJDDI","DDDDKKKDccDDDDDD","JIJDJKJDJcJDJIJD","DDCDDDDDDDDDDCDD","JDDIJDDIJDDIJDDI","DDDDccDDDDCKKDDD","JIJDJcJDJIJDKIJD","DCDDDDDDDDDDDDCD","JDDIJDDCJDDIJDDI","CCCCCCCCCCCCCCCC"]],
e_t_sand:[
["HCCCHCCCHCCCHCCC","CCCCCCCCCCCCCCCC","ICH7ICHCICHCICHC","CCCCCCCCCCCCCCCC","HCCCDCCCH7CCHCCC","CCDDDDDCCCCCCCCC","I7HCICHCICHCICHC","CCCCCCCCCCCCCCCC","HCCCHCCCHCCCHC7C","CCCCCCCCCDCCCCCC","ICHCICHDDDDDICHC","CCCCC7CCCCCCCCCC","HCCCHCCCHCCCHCCC","CCCCCCCCCCC7CCCC","ICHCICHCICHCICHC","CCCCCCCCCCCCCCCC"]],
e_t_sand2:[
["CCCICCCICCCICCCI","CHCCCHCCCHCCCHCC","CIC7CICICICICICI","CCCHCCCDDCCHCCCH","CCCIDCCICDDICCCI","CHDDDDCCCHCCCHCC","C7CICICICICI7ICI","CCCHCCCHCCCHCCCH","CCCICCDDCCCICC7I","CHCCCDCCDHCCCHCC","CICICICDDDDDCICI","CCCHC7CHCCCHCCCH","CCDICCCICCCICCCI","CDDDCHCCCHC7CHCC","CICICICICICICICI","CCCHCCCHCCCHCCCH"]],
e_t_water:[
["VBVBVBVBVBVBVBVB","BVVBBUBBBUBVWUBB","VTTTVBVBVBTTTVVB","BAAABBBUBBAAABBU","VBVB7TTTVBVBVBVB","BUBBBTTTWUBBBUBB","TTTBVAAAVBVBVVVB","AAWTTTBUBBBUBBBU","VBVAAAVBVTTT7BVB","BUBBBUBBBAAAWUBB","TTTVVBVBVBVBVTTT","AAWUBBBUBBBUBAWA","VBVBV7TTTBVBVBVB","BUBBBUTTTVBBTUBB","VBVBVBAAABTTTVVB","BBBUBBBUBBAAABBU"],
["VBVBVBAAABTTTVVB","BUBBBUBBBUAAAUBB","VBVBVBVBVBVBVBVB","BVWUBBBUBBBVVBBU","VTTTVBVBVBTTTVVB","BAAABUBBBUAAAUBB","VBVB7TTTVBVBVBVB","BBBUBTTTVBBUBBBU","TTTBVAAAVBVBVVVB","AAATTTBBBUBBBUBB","VBVAAAVBVTTT7BVB","BBBUBBBUBAWAVBBU","TTTVVBVBVBVBVTTT","AAABBUBBBUBBBAAA","VBVBV7TTTBVBVBVB","BBBUBBTTTVBUTBBU"]],
e_t_rock:[
["IIIIIIIIIIIIIIII","bbbbCbbbbbCbbbbc","bbcbbbcbbbcbbbcc","bbbbbbbbbccccbbc","DDDDDDDDDDDDDDDD","cccccccccccccccc","bbccbbcbbbcbbbcc","bbbcZbbbbbbbbbbc","cbcbcccccbcbcbcc","bbbbcbcbbbbccccc","DDDDDDDDDDDDDDDD","cccccccccccccccc","cccccbcbcbcbcbcc","bbcbbbbbccccbbbc","cccccccccLcccccL","GGGGGGGGGGGGGGGG"]],
e_t_rock2:[
["IIIIIIIIIIIIIIII","bbbbCbbbbbCbbbbc","bbcbbbcbbbccbbcc","bbbbbbbbbcccZbbc","DDDDDDDDDDDDcDDD","cccccccccccccccc","bbcbbbcbbbcbbbcc","bbbbbbbbbbbbbbbc","cbcbcccccbcbcbcc","bbbbbbcbbbbccccc","DDDDDDDDDDDDDDDD","cccccccccccccccc","cccccbcbcbcbcbcc","bbcbbbbbccccbbbc","cccccccccLcccccL","GGGGGGGGGGGGGGGG"]],
e_t_rockS:[
["CCCCCCCCCCCCCCCC","CCCbCCCCCCCCbCCC","CCCCCC77CCCCCCCC","CCCCC7DbbCCCCCCC","CCCC7DbbbDcCCCCC","CCCCDbbbbbLCCCCC","CCCCDbbbbcLCCCCC","CCCCcbbbcLCCCCCC","CCCCCcLLLCCCCCCC","CCCCGGGGGGCCCCCC","CCCCCCCCCCCCCCCC","CC9CCCCCCCCC9CCC","C99CCCCCCCCCCCCC","CCCCCbCCCCCC9CCC","CCCbbCCCCCCCCCCC","CCCCCCCCCCCCCCCC"]],
e_t_tree:[
["CCCCCCNN8CCCCCCC","CCCCNMM98N8CCCCC","CCZMM999M988CCCC","CCN98999998O8CCC","CCM999M998M8OCCC","COGM99999998OGCC","CNMMM999M99888CC","C8ON9999998OOOCC","CC8GM989998OGCCC","CC8NN9998O8O8CCC","CCC8888888OOCCCC","CCCC8OLbbOOCCCCC","CCCCGGGGGGGGCCCC","CCCCCGGGGGGCCDCC","CCCCCCDDcCCCCCCC","CCCCCCCCCCCCCCCC"]],
e_t_bridge:[
["cccccccccccccccc","cDDDDDDDDDDDDDDc","cCDDDDDDDDDDDDCc","cDDDDDDDDDDDDDDc","cDDDDDDDDDDDDDDc","cccccccccccccccc","cDDDDDDDDDDDDDDc","cCDDDDDDDDDDDDCc","cDDDDDDDDDDDDDDc","cDDDDDDDDDDDDDDc","cccccccccccccccc","cDDDDDDDDDDDDDDc","cCDDDDDDDDDDDDCc","cDDDDDDDDDDDDDDc","cDDDDDDDDDDDDDDc","cccccccccccccccc"]],
e_t_yard:[
["QFFFQFFFQFFFQFFF","FFFFFFFFFFFFFFFF","FFQFFFQFFFQFF3QF","FF3FFFFFFFFFFFFF","QFFRQFFFQFFFQFFF","FFFR88FFFFFFFFFF","FFQRRFQF3FQFFFQF","FFFFRFFFFFFFFFFF","QFFFRFFFQFFFQF3F","FFFFFFFFFF88FFFF","FFQFF3QFFFQFFFQF","FFFFFFFFFFFFFFFF","QFFFQFFFQFF3QFFF","FFFFFFF3FFFFFFFF","F3QFFFQFFFQFFFQF","FFFFFFFFFFFFFFFF"]],
e_t_yard2:[
["FFFFFFFFFFFFFFFF","QFFPQFFPQFFPQFFP","FFFFFFFFFFFFF3FF","FF3FFFQFFFQFFFQF","FFFFFFFFFFFFFFFF","QFFP88FPQFFPQFFP","FFFFFFFF3FFFFFFF","FFQFFFQFFFQFFFQF","FFFFFFFFFFRFFF3F","QFFPQFFPQRR8QFFP","FFFFF3FFFRFFFFFF","FFQFFFQFFRQFFFQF","FFFFFFFFFFF3FFFF","QFFPQFF3QFFPQFFP","F3FFFFFFFFFFFFFF","FFQFFFQFFFQFFFQF"]],
e_t_monolith:[
["FFFFFFFFFFFFFFFF","FFFF66666661FFFF","FFFF62222220F3FF","FF3F62811120FFFF","FFFF62222220FFFF","FFFF62222220FFFF","FFFF62811120FFFF","FFFF62222220FFFF","FFFF62222220FF3F","FFFF62811120FFFF","FFFF62222220FFFF","FFFF62222220FFFF","FFFF62222220FFFF","FFFF61111110FFFF","F3FGGGGGGGGGGFFF","FFFFFFFFFFFFFFFF"]],
e_t_cave:[
["IIIIIIIIIIIIIIII","bbbbCbbbbbCbbbbc","bbcbbbcbbbcbbbcc","bbbbcccccLLccbbc","cbcLLGGGGGGbcbcc","bbbLGGGGGGGGDbbc","bbccG1GGGG1GDbcc","bbbcGGGGGGGGDbbc","cbccGGGGGGGGDbcc","bbbcGGGGGGGGbccc","bbccGGGGGGGGbbcc","bbbcGGGGGGGGDbbc","cccLGGGGGGGGDbcc","bbccGGGGGGGGDbbc","ccccGGGGGGGGbccL","GGGGGGGGGGGGGGGG"]],
e_t_door:[
["IIIICIIIIIIICIII","bbbbCbbbbbCbbbbc","bbcCCCCCCCCCCbcc","bbbC111JJ112Cbbc","cbcC1GGGGGGXCbcc","bbbC1GGGGGGXCbbc","bbcC1G1GG1GXCbcc","bbbC1GGGGGGXCbbc","cbcC1GGGGGGXCbcc","bbbC1GGGGGGXCccc","bbcC1GGGGGGXCbcc","bbbC1GGGGGGXCbbc","cccC1GGGGGGXCbcc","bbcC1GGGGGGXCbbc","cccC1GGGGGGXJccL","GGGI1GGGGGGXJGGG"]],
e_t_tower:[
["PFCCPPCCPFCCPPCC","PQJJPQJJPQJJPQJJ","1111111111111111","PPPP1PPPPPPP1PPP","FFFQ1PPFFFFQ1PFP","FFFP1PFFFFFQ1PFF","1111121111111211","1111111111111111","1PPPPPPP1PPPPPPP","1PPFFFFQ1PFPFFFQ","1PFFFFFQ1PFFFFFQ","1211111112111111","1111111111111111","PPPP1PPPPPPP1PPP","FFFQ1PFPFFFQ1PFF","FFFQ2PFFFFFQ2PFF"]],
e_t_towerdoor:[
["1111111111111111","PPPP1PPPPPPP1PPP","FFFQ1PPFFFFQ1PFP","FFFP1PFFFFFQ1PFF","1111121111111211","1111111111111111","1PPPPPPP2PPPPPPP","1PPFCJJJCCCCFFFQ","1PFFQQGGGGFFFFFQ","12111G1111G21111","1111G111111G1111","PPPPG111111G1PPP","FFFQG111111G1PFF","FFFQG111111G1PFF","1111G111111G1211","1111G111111G1111"]],
e_c_floor:[
["LLLLLLLLLLccLLLL","LLLLLKKLLLLLLLLL","LLLLLcScLLLLSSSL","LLLLLccccLLLLLLL","LLcccLLLLLLLLLLL","LcLccLLLLLLLLcLL","LccccLLLLLLcccLL","LLLSSSSSLLLLccLL","LLLLLLLLLLLccLLL","LLLccLLLcLLLcLLL","LLcLccLLcLLLScLL","LLccLLLLLLLLSLLL","LLcLLLLLLLLKKcLL","LLLLLLLLLLLcSccL","LLLLLLLLLLLLScLL","LLLLLLLLLLLLLLLL"]],
e_c_floor2:[
["LLLLLLLLLLLLLLLL","LLLLLLLLLcLLLKKL","LLLLLLLLLcLLLcSL","LLLLLLLLccLccLLL","LLLLLLSSScccLLLL","LLLccLLLcccLLLLL","LLLccLLLcLLLLLLL","LLLcLLLLSSSLLLLL","LLLLLLLLLLLLLLLL","LLLLLLLcLLLLcccL","LLKKLLLSSSSSLLLL","LLcSLLLcLLLLLLLL","LccccLLLLLLLLLLL","LLLLLLLLLLLLLLLL","LLccccLLLLLLLLLc","LLLcccLLLLLccLLc"]],
e_c_wall:[
["DDDDDDDDDDDDDDDD","bCbbbcbbbbCbbbcb","bbcbcccbcccbbbcb","bbbbbbbbcGGDbbbb","cccbcccbcbGDcbcc","bbcbccGDbbDDcbcc","bbcbcGGDbbcbcZcb","bbbbbDDDbbbcccbb","cCcbcbcbcbcbcccb","bccbbbccbbbbbbbC","bcGbbbccbccbbbcb","bcGGDbbbbcGbbbbb","cbDDDbcbccGGDbcb","bccbbbCbbbDDDcbb","ccLccccccccccccc","GGGGGGGGGGGGGGGG"]],
e_c_wall2:[
["DDDDDDDDDDDDDDDD","bCbbbcbbbbCbbbcb","bbcbcccbcccbbbcb","bbbcbbbbcGGDbbbb","ccccZccbcbGDcbcc","bbcbccGDbbDDbbcc","bbcbcGGDbbcbbbcb","bbbbbDDDbbbccbbb","cCcbcbcbcbcbcbcb","bccbbbccbbbbbbbC","bcGbbbccbccbbbcb","bcGGDbbbbccbbbbb","cbDDDbcbccGcDbcb","bccbbbCbbbDDDcbb","ccLccccccccccccc","GGGGGGGGGGGGGGGG"]],
e_c_rubble:[
["LLLLLLLLLLLLLLLL","LLLLLLLLLLLLLLLL","LLLLLLLLLLLcLLLL","LLLLbbbLLLLLLLLL","LLLbbbbbcLLLLLLL","LLLbbbbbcLLLcLLL","LLbbcbbbbcLLLLLL","LLbccbbbbcLLLLLL","LLbbbccbbcLLLLLL","LLSSSccSSLLLLLLL","LLSGGGGGGcLLLLLL","LLLcccccccLLLLLL","LLcLLLLLLLLSLLLL","LLLLLLLLLLLLLLLL","LLLLLLcLLLLLLLLL","LLLLLLLLLLLLLLLL"]],
e_d_floor:[
["2222222222222222","2222222122222221","2211311022111110","221X1110221X0110","2211111022111110","22011X1022111X10","2211111022113110","2100000021000000","2222222222222222","2222222122222221","2211131022111110","221X1110221X3110","2210111022111110","22111X1022111X10","2211111022101110","2100000021000000"]],
e_d_floor2:[
["2222222222222222","2222222122222221","22100X1022113X10","2210G21022111110","2210G110221X1110","2210GG2022110110","2211222022111X10","210X000021000000","2222222222222222","2222222122221121","22113X1022110G20","2211111022110G20","220X1110221X0220","2211111022111110","22111X1022113X10","2100000021000000"]],
e_d_wall:[
["2222222222222222","6665266666652666","3d3X2d433d3X2d34","333d2d33333X2d33","0000210000002100","2222222222222222","2666666526666665","2d43333X2d34333X","2d3d333X2d3d333X","2100000021000000","2222222222222222","6665266666652666","333X2d34333X2d3d","333X2d33333X2Y33","0000210000002100","2222222222222222"]],
e_d_wall2:[
["2222222222222222","6665266666652666","3d3X2d433d3X2d34","333d2d33333X2d33","0000221111002100","2222XUBBBBV12222","26666UAAAAB66665","2d433BA7AAB4333X","2d3d3BAAAABd333X","21000VVVVVV00000","2222222222222222","6665266666652666","333X2d34333X2d3d","333X2d33333X2Y33","0000210000002100","2222222222222222"]],
e_w_floor:[
["3333333333333333","3XXXXXX23XXXXXX2","3X2242213X222221","3X2X22213X2X4221","3X2222213X222221","3X422X213X222X21","3X2222213X222421","3211111132111111","3333333333333333","3XXXXXX23XXXXXX2","3X2224213X222221","3X2X22213X2X4221","3X2422213X222221","3X222X213X222X21","3X2222213X242221","3211111132111111"]],
e_w_floor2:[
["3333333333333333","3XXXXXX23XXXXXX2","3X211X213X242X21","3X2dGX213X222221","3X21G2213X2X2221","3X21GGX13X224221","3X22XXX13X222X21","32d1111132111111","3333333333333333","3XXXXXX23XXX22X2","3X224X213X221GX1","3X2222213X221GX1","3X4X22213X242XX1","3X2222213X222221","3X222X213X224X21","3211111132111111"]],
e_w_wall:[
["1111111111111111","PPPP1PPPPPPP1PPP","FQFQ1PPFFQFQ1PFP","FFFP1PFFFFFQ1PFF","1111121111111211","1111111111111111","1PPPPPPP1PPPPPPP","1PPFFFFQ1PFPFFFQ","1PFQFFFQ1PFQFFFQ","1211111112111111","1111111111111111","PPPP1PPPPPPP1PPP","FFFQ1PFPFFFQ1PFQ","FFFQ1PFFFFFQ1PFF","1111121111111211","1111111111111111"]],
e_w_wall2:[
["1111111111111111","PPPP1PPPPPPP1PPP","FQFQ1PPFFQFQ1PFP","FFFP1PFFFFFQ1PFF","1111121111111211","1111111111111111","1PPPPPPP1PPPPPPP","1PPFFFRQ1PFPFFFQ","1PFQFFRQ1PFQFFFQ","121111R112111111","1111111111111111","PPPP1PPPPPPP1PPP","FFFQ1PFPFFFQ1PFQ","FFFQ1PFFFFFQ1PFF","1111121111111211","1111111111111111"]],
e_d_torch:[
["2222222222222222","3433243333323333","3333233333323333","3333233333323333","3333233C33323333","222222DCCD222222","332333DCCD333243","332333DDDD333233","3323333DD3333233","332333FFFF333233","222222FFFF222222","334332FFFF234333","3333323FF3233333","3333323FF3233333","3333323333233333","2222222222222222"],
["2222222222222222","3433243333323333","3333233333323333","33332333C3323333","333323DCCD323333","222222DCCD222222","3323337CCD333243","332333DDDD333233","3323333CD3333233","332333FFFF333233","222222FFFF222222","334332FFFF234333","3333323FF3233333","3333323FF3233333","3333323333233333","2222222222222222"]],
e_d_block:[
["5555555555555552","5444444444444442","5444444444444442","5443333333333442","5443444444443442","5443455555543442","5443454444543442","5443454644543442","5443454464543442","5443454444543442","5443455555543442","5443444444443442","5443333333333442","5444444444444442","5444444444444442","2222222222222222"]],
e_d_switch:[
["2222222222222222","2111111121111111","2111112221111111","211122CCC2211111","2112CCCCCCC21111","2112C7DDDCC21111","212CCDDDDDCC2111","212CCDDDDDCC2111","222CCDDDDDCC2222","2112CCDDDCC21111","2112CCCCCCC21111","211122CCC2211111","2111112221111111","2111111121111111","2111111121111111","2111111121111111"],
["2222222222222222","2111111121111111","2111112221111111","2111228882211111","2112888888821111","2112869998821111","2128899999882111","2128899999882111","2228899999882222","2112889998821111","2112888888821111","2111228882211111","2111112221111111","2111111121111111","2111111121111111","2111111121111111"]],
e_d_spike:[
["2222222222222222","2111111121111111","2111111121111111","2111111121111111","2111111121111111","2111111121111111","2000100020001001","20GG20GGX0GG20G2","22PXX2PXX2PXX2PX","2111111121111111","2111111121111111","2111111121111111","2111111121111111","2111111121111111","2111111121111111","2111111121111111"],
["2222222222222222","2111111121111111","2111111121111111","2171117121711171","2F7F1F7F2F7F1F7F","2F6F1F6F2F6F1F6F","2F6F1F6F2F6F1F6F","2FFF1FFF2FFF1FFF","2FFF2FFF2FFF2FFF","2FFF1FFF2FFF1FFF","1QQQ0QQQ1QQQ0QQQ","2GGG1GGG2GGG1GGG","X2222222X2222222","2111111121111111","2111111121111111","2111111121111111"]],
e_d_arrow:[
["2222222222222222","3433243333323333","3333233333323333","3333233333323333","3333233333323333","2222QQQQQQQF2222","3323XGGGGGGd3243","3323XGGbcGGd3233","3323XGGcLGGd3233","3323XGGGGGGd3233","2222FPPPPPPP2222","3343323333234333","3333323333233333","3333323333233333","3333323333233333","2222222222222222"]],
e_d_crack:[
["2222222222222222","2111111121111111","2111111F21111111","21F1111F2111F111","211FF111F11F1111","21111F11F1F11111","211111012F111111","2111111F01111111","2222222F20222222","211111F121FF1111","21111F112111F111","2111F11121111F11","21FF111121111111","2111111121111111","2111111121111111","2111111121111111"]],
e_d_pit:[
["2222222222222222","2111111121111111","21QQQQQQQQQQQF11","210GGGGGGGGGG111","210GGGGGGGGGG111","210GGGGGGGGGG111","210GGGGGGGGGG111","210GGGGGGGGGG111","220GGGGGGGGGG122","210GGGGGGGGGG111","210GGGGGGGGGG111","210GGGGGGGGGG111","210GGGGGGGGGG111","2101111111111111","2111111121111111","2111111121111111"]],
e_d_stairs:[
["1111111111111001","1433333333333X12","1455555555555Y22","1455555555555Y22","1444444444444d22","1444444444444d22","1433333333333X22","1dXXXXXXXXXXXX22","1d12222222222222","1d22222222222222","1422222222222122","1411111111111022","1400000000000022","1400000000000022","14000000000000X2","1111111111111122"]],
e_d_pedestal:[
["2222222222222222","2222222122222221","2211111022111110","2211111022111110","2211111022111110","2211111022111110","2211111022111110","21011110X2110000","22X655556655Y122","222Ydd444dd44221","2211X1d33X1d1110","2211X2d33X2d1110","2211X2d33X2d1110","2211X2d33X2d1110","2100X23XXX230010","2112222222222210"]],
e_d_lockdoor:[
["3333333333333333","3222222222222223","3222222222222223","3225555555555223","3224444444444223","32244ddddd444223","32244dGGGGY44223","32244dGCCGY44223","32244dGGGGY44223","322444YIIYY44223","3224444CC4444223","3224444444444223","3224444444444223","3224444444444223","3224444444444223","3224444444444223"]],
e_d_bossdoor:[
["3333333333333333","3222222222222223","3222222222222223","3225555555555223","3222222222222223","3222111111112223","3222111111112223","322211c11c112223","3222111111112223","322211cccc112223","3222111111112223","3222222222222223","3222222222222223","322cccccccccc223","3222222222222223","3222222222222223"]],
e_d_stairup:[
["1111111111111111","1000000000000001","1000000000000001","1077777777777701","10FFFFFFFFFFF201","1011111111111101","1077777777777701","10FFFFFFFFFFF201","1011111111111101","1077777777777701","10FFFFFFFFFFF201","1011111111111101","1077777777777701","10FFFFFFFFFFF201","1011111111111101","1111111111111111"]],
e_d_stairdn:[
["1111111111111111","1777777777777771","17FFFFFFFFFFFF71","1711111111111171","1700000000000171","170GGGGGGGGGG271","170GGGGGGGGGG271","170GGGGGGGGGG271","170GGGGGGGGGG271","170GGGGGGGGGG271","170GGGGGGGGGG271","1710GGGGGGGG1271","1710111111111171","1711111111111171","1777777777777771","1111111111111111"]],
/* ---- pass F: the torch, the vendor, the flask and the ice blade ---------
   Same house rules as above. The ice ramp is f/g/h/i, lightest first; it is
   only ever used for the long sword, its beam and the flask glass, so no other
   material picks up a colour it did not have before. */
e_t_burnt:[
["CCICCCCICCCCICCC","CICCCCCCCCICCCCC","CCCCcLCCCCCCCCCC","CCCLGRLCCCCcLCCC","CCCcRGRcCCCLGLCC","CCCCLRLCCCCcLCCC","CICCCLCCCICCCCIC","CCCCCCCCCCCCCCCC","CCCCCCCCICCCCCCC","CCCcLcCCCCCCCcLC","CCLGSGLCCCCCLGLC","CCcRGRcCCCCCcLCC","CICCLRLCCCICCCIC","CCCCCLCCCCCCCCCC","CCCCCCCCCCCCCCCC","CCICCCCCCCCICCCC"]],
e_t_vendor:[
["IIIIIIIIIIIIIIII","bbbbCbbbbbCbbbbc","bbcbbbcbbbcbbbcc","bbbbcccccLLccbbc","cbcLLGGGGGGbcbcc","bbbLGGCCGGGGDbbc","bbccGG7CGG1GDbcc","bbbcGGCCGGGGDbbc","cbccGGGGGGGGDbcc","bbbcGGC1CGGGbccc","bbccGGC1CGGGbbcc","bbbcGGGGGGGGDbbc","cccLGG9NG9NGDbcc","bbccGGGGGGGGDbbc","ccccGGGGGGGGbccL","GGGGGGGGGGGGGGGG"]],
/* the burn: three frames of flame over the tree, then the tile is ash. Baked
   frames, never a per-pixel loop, and EGG_RM pins the draw to frame 1. */
e_fire:[
["................","................","......E.........",".....EaE...E....","....EeaeE.EaE...","...EeDCDeEEeE...","...EeDC7CDeeE...","...EeD7C7DeeE...","..EeeDCCCDeeE...","..EeaeDCDeaeE...","..EaaeeDeeaaE...","..EEaaaeaaaEE...",".EEEaaaaaaaEEE..",".EEEEaaaaaEEEE..","..EEEEEEEEEEE...","................"],
["................","................",".........E......","....E....EaE....","...EaE..EeaeE...","...EeE.EeDCDeE..","..EeaeEEeD7CDeE.","..EeDCDeeDCCDeE.","..EeDC7CDeDCDeE.","..EeaDCCDeeaeeE.","..EaaeDCDeeaaE..","..EEaaaeeaaaEE..",".EEEaaaaaaaEEE..",".EEEEaaaaaEEEE..","..EEEEEEEEEEE...","................"],
["................","................","......E.........","......EaE.......","....EEeaeEE.....","...EeeDCDeeE....","...EeDCCCDeE....","..EeeDC7CDeeE...","..EeaDCCCDaeE...","..EaaeeDeeaaE...","..EEaaaeaaaEE...",".EEEaaaaaaaEEE..",".EEEaaaaaaaEEE..",".EEEEaaaaaEEEE..","..EEEEEEEEEEE...","................"]],
/* THE BIT VENDOR — a campus tech in a long coat behind a counter of parts.
   Two frames: a breath, and a beckon when you stand at a stand. */
e_vendor:[
["..GGGGGGGG..",".GHIIIIIICG.","GHIICCCCJCJG","..GZDDDDbG..","..GZGDDGbG..","..GZDDDDLG..",".G5YY4444dG.","G554444444XG","G54FGGGF44XG","G5444444d3XG",".G34444dXXG.",".G3d444dX2G.","..G3XXXX2G..","..GdXGGdXG..","..G21GG21G..","..GGGGGGGG.."],
["..GGGGGGGG..",".GHIIIIIICG.","GHIICCCCJCJG","..GZDDDDbG..","..GZGDDGbG..","..GZDDDDLG..",".G5YY4444dG.","G554444444XG","G54FGGGF44XG","G5444444d3XG",".G34444dXXG.",".G3d444dX2G.","..G3XXXX2G..","..GdXGGdXG..","..G12GG12G..","..GGGGGGGG.."]],
/* one stand per item — a crate with a lit top face */
e_podium:[
["..GGGGGGGG..",".GCJJJJJJCG.","GCJKKKKKKJCG","GJKLLLLLLKJG",".GKLLLLLLKG.",".GKLLLLLLKG.",".GKLLLLLLKG.","..GKLLLLKG..","..GGGGGGGG.."]],
/* shop stock + the pickups they turn into */
e_item_potion:[
["..GGGG..",".GghfgG.","GgfgggiG","GhGgghiG","GhaaaehG","GhaeaahG","GiaaaaiG",".GihhiG.","..GGGG.."],
["..GGGG..",".GghfgG.","GgfgggiG","GhGgghiG","GhaeaahG","GhaaaehG","GiaaaaiG",".GihhiG.","..GGGG.."]],
e_item_torch:[
["...GG...","..GCEG..",".GC7CEG.","GEC7CEeG",".GECCEG.","..GDDG..","..GcLG..","..GcLG..","..GcLG..","..GcLG..","..GLLG..","...GG..."],
["...GG...","..GEEG..",".GEC7CG.","GeEC7CEG",".GECCEG.","..GDDG..","..GcLG..","..GcLG..","..GcLG..","..GcLG..","..GLLG..","...GG..."]],
e_item_sword:[
[".....GG.....","....GfgG....","....GfgG....","....GfgG....","....GfgG....","....GfghG...","....GghhG...","...GGghhGG..",".GGiiGghGiiG",".GihiiiiihiG","..GGGGhGGGG.","....GcLG....","....GcLG....","....GGGG...."]],
/* 6x6 HUD chips */
e_ico_torch:[
[".GCG..","GC7CG.",".GDG..","..cL..","..cL..","..GG.."]],
e_ico_potion:[
[".GgG..","GgfgG.","GhaahG","GhaahG",".GhhG.","..GG.."]],
e_ico_sword:[
["...Gf.","..Gfg.",".Gfgh.","Ggghi.","Gih...","G.G..."]],
/* the DIGITAL LONG SWORD blade — the crimper silhouette, longer, in ice */
e_crimp_h2:[
[".fffgggggggg..","fgfggggggg7gg.",".ihhhhhhhhhi.."]],
e_crimp_v2:[
[".7f.",".fg.",".fg.",".fg.",".fg.",".fg.",".fg.",".fg.",".gh.",".gh.",".gh.","ighi",".ii."]],
/* the beam's leading spark — the shaft itself is three snapped rects */
e_beam_tip:[
["..f..",".fgf.","fghgf",".fgf.","..f.."],
[".f.f.","f.g.f",".ghg.","f.g.f",".f.f."]],
/* the thrown blade, point-up, 12x12: [0] steel  [1] the long sword's ice */
e_blade_fly:[
["......f.....","......f.....",".....fgf....",".....fgf....",".....fgf....",".....fgf....",".....fgf....","....ffgff...","......h.....",".....hhh....","......h.....","......h....."],
["......c.....","......c.....",".....cdc....",".....cdc....",".....cdc....",".....cdc....",".....cdc....","....ccdcc...","......h.....",".....hhh....","......h.....","......h....."]]
};
let eart6Done=false;
function eggPx6(){   /* compile the pass-D overrides once, after eggPxInit */
  if(eart6Done||!SPR)return;
  eart6Done=true;
  for(const k in EART6){
    SPR[k]=EART6[k].map(f=>mkSprite(f));
    /* tiles are never mirrored and never damage-flash — compiling those two
       stores for them would double the init cost of the art pass for nothing */
    if(/^e_[tcdw]_/.test(k))continue;
    SPRF[k]=EART6[k].map(f=>mkSpriteFlipped(f));
    SPRW[k]=EART6[k].map(f=>mkSpriteFlash(f));
  }
}
/* five hollow caves (power cells) + ten burn caves + two key caves on the
   west and east edges + THE RELAY TOWER (MERSIVE POLARIS) */
function eggOpen6(){
  document.getElementById("egg6").style.display="flex";
  EggAudio.init();eggSyncMute();
  document.getElementById("egg6-key").innerHTML=renderKey([["↑ ↓ ← →","move"],["Z / Space","crimper strike"],["X","lift &middot; use equipped item"],["I","items"],["P","pause"],["M","mute"],["Esc","mission control"]]);
  eggLostDisplay();
}
function eggClose6(){
  document.getElementById("egg6").style.display="none";
  if(egg6Anim){cancelAnimationFrame(egg6Anim);egg6Anim=null}
  if(egg6Keys){removeEventListener("keydown",egg6Keys);removeEventListener("keyup",egg6Keys);egg6Keys=null}
  eggEndDismiss();EggAudio.musicStop();
}
function eggLostDisplay(){
  const IW=240,IH=176,TS=16,PW=15,PH=10,PYOFF=16;
  const c=document.getElementById("egg6c"),dctx=eggCanvas("egg6c",720,528);
  eggPxInit();eggPx6();
  const off=document.createElement("canvas");off.width=IW;off.height=IH;
  const x=off.getContext("2d");
  eggEndDismiss();
  if(egg6Anim){cancelAnimationFrame(egg6Anim);egg6Anim=null}
  if(egg6Keys){removeEventListener("keydown",egg6Keys);removeEventListener("keyup",egg6Keys)}
  /* ------------------------------------------------ run state */
  const SPD=62,DIRV=[[0,1],[0,-1],[-1,0],[1,0]]; /* 0 down 1 up 2 left 3 right */
  const SWORD_DMG=1,PUCK_DMG=SWORD_DMG*.5,LONG_MULT=4;
  /* the crimper does 1; the DIGITAL LONG SWORD does 4. The full-health beam
     carries exactly what the strike that launched it carries, and the puck
     stays at half of whatever is in your hand — so buying the sword scales the
     whole kit at once instead of making one button obsolete. */
  function dmgSword(){return SWORD_DMG*(swordLvl>1?LONG_MULT:1)}
  function dmgPuck(){return dmgSword()*.5}
  let mode="ow",sx=EARTH_META.start.sx,sy=EARTH_META.start.sy,rx=2,ry=4;
  let map=null,alive=true,paused=false,peace=false,state="play",elapsed=0,timeS=0,last=null;
  let px=EARTH_META.start.x,py=EARTH_META.start.y,facing=0,walkT=0,moving=false;
  let hp=6,maxHp=6,keysN=0,bits=0,score=0,kills=0;
  let invuln=1,kx=0,ky=0,kt=0,frozen=0,swing=null,swCd=0,dying=0;
  let ens=[],shots=[],eshots=[],drops=[],parts=[],floats=[],banner=null;
  let spikes=[],arrows=[],blades=[],block=null,switchPos=null,crumbled=null,crumbleT=0,crumbleAt=null,fallT=0;
  let boss=null,bossSeal=false,diedInDungeon=false;
  /* last screen/room entered: CONTINUE restarts here with progress intact */
  let ckpt=null,continues=0;
  let hasPuck=false,puck=null,caveI=-1,caveR=0,twrF=0,stairLock=null,xCd=0,carryRock=false,thrown=null;
  /* ---- pass F: inventory, the shop, the torch, the beam, cleared maps ---- */
  let hasTorch=false,hasPotion=false,swordLvl=1,equipped="none";
  let itemsOpen=false,itemT=0,shopMsg=null,shopBack=null;
  let beams=[],fires=[];
  const BEAM_LIFE=EGG_RM?0.12:0.24;
  const burnt=new Map();            /* "sx,sy,tx,ty" -> "u" ash | "c" cave mouth */
  /* A map is cleared when its last enemy falls. It stays cleared until it has
     dropped out of the trail of the last MAP_WINDOW maps entered — i.e. until
     you are three map transitions away from it. The trail is transitions
     travelled, not distance: walking a loop of two screens never re-arms
     either of them, and a straight line of three does. */
  const MAP_WINDOW=3;
  const clearedMaps=new Set();
  let mapTrail=[],curMapId="",mapArmed=false;
  function mapId(){
    return mode==="ow"?"ow:"+sx+","+sy:
      mode==="dun"?"dun:"+rx+","+ry:
      mode==="cave"?"cave:"+caveI+"/"+caveR:
      mode==="twr"?"twr:"+twrF:"shop";
  }
  function armMap(id){
    if(clearedMaps.has(id)){
      if(mapTrail.indexOf(id)>=0)return false;   /* still inside the window */
      clearedMaps.delete(id);                    /* fallen out: enemies return */
    }
    return true;
  }
  function ownedItems(){
    const o=[];
    if(hasPuck)o.push("puck");
    if(hasTorch)o.push("torch");
    if(hasPotion)o.push("potion");
    return o;
  }
  function autoEquip(k){if(equipped==="none"||!ownedItems().includes(equipped))equipped=k}
  function cycleEquip(d){
    const o=ownedItems();
    if(!o.length){equipped="none";return}
    const i=o.indexOf(equipped);
    equipped=o[(i+(d||1)+o.length*2)%o.length];
    EggAudio.uiClick();
  }
  let swap=null;   /* {oldCv,newCv,dx,dy,t,nsx,nsy,nx,ny} */
  let cerT=-1;
  /* keysGot is to the key caves what containersGot is to the heart caves: the
     cave id of every one-time reward already banked, so a second visit finds
     an empty room instead of a second key. Both survive CONTINUE. */
  const visited=new Set(),visitedR=new Set(),unlocked=new Set(),containersGot=new Set(),keysGot=new Set();
  let switchOn=false,bossDead=false,fortressSeen=false,lockHintT=0;
  const blockState={};
  let rseed=12345;function rnd(n){rseed=(Math.imul(rseed,1103515245)+12345)&2147483647;return rseed%n}
  const keys={};
  function hud(){
    document.getElementById("egg6s").textContent=score;
    document.getElementById("egg6bt").textContent=bits;
    document.getElementById("egg6k").textContent=keysN;
    const m=(timeS/60)|0,s=(timeS|0)%60;
    document.getElementById("egg6t").textContent=m+":"+(s<10?"0":"")+s;
    document.getElementById("egg6b").textContent=egg6Best;
  }
  function popText(tx,ty,txt,ci){floats.push({x:tx,y:ty,txt,ci,a:1})}
  function sparks(bx,by,ci,n){if(EGG_RM)return;for(let i=0;i<(n||8);i++)parts.push({x:bx,y:by,vx:(Math.random()-.5)*70,vy:(Math.random()-.7)*60,a:1,ci})}
  /* death puff: a ring of fat, slow, rising motes — reads at 3x where 1px sparks do not */
  function puff(bx,by,ci,n){
    if(EGG_RM)return;
    n=n||6;
    for(let i=0;i<n;i++){const a=Math.PI*2*i/n;parts.push({x:bx,y:by,vx:Math.cos(a)*32,vy:Math.sin(a)*22-10,a:1,ci,sz:2,g:-10})}
  }
  /* every actor gets the same contact shadow — two solid rows and a soft ring
     of ambient occlusion around them — so nothing floats */
  function shadowAt(bx,by,w){
    const X=Math.round(bx-w/2),Y=Math.round(by);
    x.fillStyle=PAL[16];
    x.globalAlpha=.34;x.fillRect(X,Y-2,w,2);
    x.globalAlpha=.18;x.fillRect(X+1,Y-3,w-2,1);
    x.globalAlpha=.1;x.fillRect(X-1,Y-2,w+2,2);x.fillRect(X,Y,w,1);  /* soft outer ring */
    x.globalAlpha=1;
  }
  /* ------------------------------------------------ tiles / walk */
  function tset(){return mode==="ow"?ETILE_OW:mode==="dun"?ETILE_DUN:mode==="cave"||mode==="shop"?ETILE_CAVE:ETILE_TWR}
  function tileCh(tx,ty){
    if(tx<0||ty<0||tx>=PW||ty>=PH)return mode==="ow"?"r":"#";
    return map[ty][tx];
  }
  function walkable(wx,wy){
    const tx=(wx/TS)|0,ty=(wy/TS)|0;
    const d=tset()[tileCh(tx,ty)];
    if(!d||!d.w)return false;
    if(mode==="dun"){
      if(lockedGapAt(tx,ty))return false;
      if(block&&wx>=block.x&&wx<block.x+TS&&wy>=block.y&&wy<block.y+TS)return false;
    }
    return true;
  }
  function boxFree(nx,ny){
    return walkable(nx-5,ny-8)&&walkable(nx+4,ny-8)&&walkable(nx-5,ny-1)&&walkable(nx+4,ny-1);
  }
  /* door gaps + locks (dungeon) */
  function lockFor(side){
    const dd={N:[0,-1],S:[0,1],W:[-1,0],E:[1,0]}[side],opp={N:"S",S:"N",W:"E",E:"W"}[side];
    for(const L of EARTH_LOCKS){
      if(L.rx===rx&&L.ry===ry&&L.side===side)return L;
      if(L.rx===rx+dd[0]&&L.ry===ry+dd[1]&&L.side===opp)return L;
    }
    return null;
  }
  function lockId(L){return L.rx+","+L.ry+","+L.side}
  function lockActive(L){
    if(!L)return false;
    if(L.kind==="key")return!unlocked.has(lockId(L));
    if(L.kind==="switch")return!switchOn;
    if(L.kind==="boss")return bossSeal;
    if(L.kind==="victory")return!bossDead;
    return false;
  }
  function gapSide(tx,ty){
    if(ty===0&&tx===7)return"N";
    if(ty===PH-1&&tx===7)return"S";
    if(tx===0&&(ty===4||ty===5))return"W";
    if(tx===PW-1&&(ty===4||ty===5))return"E";
    return null;
  }
  /* the four door gaps of a fortress room, as the point the player stands
     against when they are stopped by one — used by the locked-door hint */
  const LOCK_HINTS=[{side:"N",cx:7*TS+8,cy:8},{side:"S",cx:7*TS+8,cy:(PH-1)*TS+8},
    {side:"W",cx:8,cy:4*TS+12},{side:"E",cx:(PW-1)*TS+8,cy:4*TS+12}];
  function lockedGapAt(tx,ty){
    const s=gapSide(tx,ty);
    if(!s)return false;
    const L=lockFor(s);
    if(!L)return false;
    if(lockActive(L)&&L.kind==="key"&&keysN>0){    /* a key turns in the lock */
      unlocked.add(lockId(L));keysN--;EggAudio.itemGet();
      popText(tx*TS+8,ty*TS+8,"UNLOCKED",12);hud();
      return false;
    }
    return lockActive(L);
  }
  /* ------------------------------------------------ load screen / room */
  function parseEnts(src){
    const rows=src.map(r=>r.split(""));
    ens=[];drops.length=0;eshots=[];shots=[];spikes=[];arrows=[];blades=[];puck=null;thrown=null;
    block=null;switchPos=null;boss=null;
    beams=[];fires=[];
    crumbled=new Set();crumbleT=0;crumbleAt=null;
    /* the respawn rule: ask before spawning, then log the transition */
    const mid=mapId(),arm=armMap(mid);
    curMapId=mid;mapArmed=false;
    for(let j=0;j<PH;j++)for(let i=0;i<PW;i++){
      const ch=rows[j][i],cx=i*TS+8,cy=j*TS+12;
      if("123456".indexOf(ch)>=0&&mode==="ow"||"1234567890".indexOf(ch)>=0&&mode!=="ow"){
        if(arm){spawnEnemy(ch,cx,cy);mapArmed=true}
        rows[j][i]=".";
      }
      else if(ch==="H"){
        const id=mode==="ow"?"ow":mode==="dun"?"dun":"cave"+caveI;
        if(!containersGot.has(id))drops.push({kind:"container",x:cx,y:cy,id});
        rows[j][i]=".";
      }
      else if(ch==="L"){
        /* the key caves' one-time reward: banked in keysGot on pickup, so the
           room is bare from the second visit on and no key can be farmed */
        const id="cave"+caveI;
        if(!keysGot.has(id))drops.push({kind:"key",x:cx,y:cy,ttl:1e9,id});
        rows[j][i]=".";
      }
      else if(ch==="*"){drops.push({kind:"bit",x:cx,y:cy,ttl:1e9});rows[j][i]="."}
      else if(ch==="W"){if(!hasPuck)drops.push({kind:"puck",x:cx,y:cy-2,ttl:1e9})}
      else if(ch==="M"){
        rows[j][i]=".";
        if(!bossDead)boss={x:cx,y:cy-4,hp:5,hits:0,st:"trundle",t:1.2,spd:26,beams:3,flash:0,engaged:false};
      }
      else if(ch==="S")spikes.push({tx:i,ty:j,ph:((i+j)%2)});
      else if(ch==="A"){
        let fd=[0,1];
        if(j<=1)fd=[0,1];else if(j>=PH-2)fd=[0,-1];else if(i<=1)fd=[1,0];else fd=[-1,0];
        arrows.push({tx:i,ty:j,fd,cd:1.2+((i*3+j)%4)*.55});
      }
      else if(ch==="V")blades.push({hx:i*TS+8,hy:j*TS+8,x:i*TS+8,y:j*TS+8,st:"idle",vx:0,vy:0,cd:0});
      else if(ch==="B"){
        const bid=rx+","+ry;
        const bs=blockState[bid];
        block={x:(bs?bs.x:i)*TS,y:(bs?bs.y:j)*TS,sx:0,sy:0,t:0,id:bid};
        rows[j][i]=".";
      }
      else if(ch==="X")switchPos={tx:i,ty:j};
    }
    mapTrail.push(mid);
    if(mapTrail.length>MAP_WINDOW)mapTrail=mapTrail.slice(-MAP_WINDOW);
    return rows.map(r=>r.join(""));
  }
  /* the generated overworld row, with the later passes stitched over it: the
     vendor mouth on the starting screen, the two key-cave mouths on the west
     and east edges, and every tree this run has already burned */
  function owRows(nsx,nsy){
    const base=EARTH_OW[nsy*10+nsx],patch=[];
    if(nsx===EVENDOR.sx&&nsy===EVENDOR.sy)patch.push([EVENDOR.tx,EVENDOR.ty,"V"]);
    for(const kc of EKEY_CAVES)if(kc.sx===nsx&&kc.sy===nsy)patch.push([kc.tx,kc.ty,"c"]);
    burnt.forEach((ch,k)=>{
      const p=k.split(",");
      if(+p[0]===nsx&&+p[1]===nsy)patch.push([+p[2],+p[3],ch]);
    });
    if(!patch.length)return base;
    const rows=base.slice();
    for(const[tx,ty,ch]of patch)rows[ty]=rows[ty].slice(0,tx)+ch+rows[ty].slice(tx+1);
    return rows;
  }
  function loadScreen(nsx,nsy){
    sx=nsx;sy=nsy;mode="ow";
    ckpt={mode:"ow",sx:nsx,sy:nsy,x:px,y:py};
    map=parseEnts(owRows(sx,sy));
    visited.add(sx+","+sy);
    if(sx===EARTH_META.fortress.sx&&sy===EARTH_META.fortress.sy)fortressSeen=true;
  }
  function loadRoom(nrx,nry){
    rx=nrx;ry=nry;mode="dun";
    ckpt={mode:"dun",rx:nrx,ry:nry,x:px,y:py};
    map=parseEnts(EARTH_DUN[ry*5+rx]);
    visitedR.add(rx+","+ry);
    bossSeal=false;
    if(boss)EggAudio.bossWarn();
  }
  /* pre-render a map to a canvas (for slide transitions) */
  function renderMapTo(cv,m,md,ms){
    const g=cv.getContext("2d");
    const saveMode=mode,saveMap=map;mode=md;map=m;
    drawMap(g,0);
    mode=saveMode;map=saveMap;
  }
  function startSwap(nsx,nsy,dx,dy,nx,ny){
    const oldCv=document.createElement("canvas");oldCv.width=IW;oldCv.height=IH-PYOFF;
    renderMapTo(oldCv,map,mode);
    const nm=mode==="ow"?owRows(nsx,nsy):mode==="dun"?EARTH_DUN[nsy*5+nsx]:mode==="cave"?ECAVES[caveI].rooms[nsy]:EARTH_TOWER.floors[nsy];
    /* peek at the new map without entities for the slide */
    const cleanNew=nm.map(r=>r.replace(/[1234567890HLM*]/g,".").replace(/B/g,"."));
    const newCv=document.createElement("canvas");newCv.width=IW;newCv.height=IH-PYOFF;
    renderMapTo(newCv,cleanNew,mode);
    if(EGG_RM){ /* reduced motion: hard cut */
      loadAny(nsx,nsy);
      px=nx;py=ny;entryX=px;entryY=py;return;
    }
    swap={oldCv,newCv,dx,dy,t:0,nsx,nsy,nx,ny};
    state="swap";
  }
  function checkEdges(){
    if(state!=="play")return;
    let dx=0,dy=0;
    if(px<5)dx=-1;else if(px>IW-5)dx=1;
    if(py<5)dy=-1;else if(py>160-3)dy=1;
    if(!dx&&!dy)return;
    if(mode==="ow"){
      const nsx=sx+dx,nsy=sy+dy;
      if(nsx<0||nsx>9||nsy<0||nsy>9)return;
      if(dx&&EARTH_META.openH[sy][Math.min(sx,nsx)]!=="1")return;
      if(dy&&EARTH_META.openV[Math.min(sy,nsy)][sx]!=="1")return;
      startSwap(nsx,nsy,dx,dy,dx?(dx<0?IW-8:8):px,dy?(dy<0?156:10):py);
    }else if(mode==="dun"){
      const nrx=rx+dx,nry=ry+dy;
      if(nrx<0||nrx>4||nry<0||nry>4)return;
      startSwap(nrx,nry,dx,dy,dx?(dx<0?IW-8:8):px,dy?(dy<0?156:10):py);
    }else if(mode==="cave"){
      if(dy>0){if(caveR===0)exitCave();else startSwap(0,caveR-1,0,1,px,10)}
      else if(dy<0&&caveR<ECAVES[caveI].rooms.length-1)startSwap(0,caveR+1,0,-1,px,156);
    }else if(mode==="shop"){
      if(dy>0)exitVendor();
    }else if(mode==="twr"){
      if(dy>0&&twrF===0)exitTower();
    }
  }
  function enterDungeon(){
    mode="dun";fortressSeen=true;
    loadRoom(EARTH_META.dEntrance.rx,EARTH_META.dEntrance.ry);
    px=EARTH_META.dEntrance.x;py=EARTH_META.dEntrance.y-14;
    entryX=px;entryY=py;
    EggAudio.music("dungeon");EggAudio.powerup();
    banner={txt:"THE FORTRESS",sub:"FIND THE LOST DISPLAY",t:0};
    invuln=1;
  }
  function exitDungeon(){
    loadScreen(EARTH_META.fortress.sx,EARTH_META.fortress.sy);
    px=EARTH_META.fortress.dx*TS+8;py=(EARTH_META.fortress.dy+1)*TS+10;
    entryX=px;entryY=py;
    EggAudio.music("overworld");
    invuln=1;
  }
  function loadAny(a,b){
    if(mode==="ow")loadScreen(a,b);
    else if(mode==="dun")loadRoom(a,b);
    else if(mode==="cave")loadCaveRoom(b);
    else loadFloor(b);
  }
  /* ---- hollow caves (heart-container mini-dungeons) ---- */
  function loadCaveRoom(i){caveR=i;mode="cave";map=parseEnts(ECAVES[caveI].rooms[i])}
  function enterCave(i){
    caveI=i;loadCaveRoom(0);
    px=7*TS+8;py=150;entryX=px;entryY=py;facing=1;
    EggAudio.music("dungeon");EggAudio.powerPellet();
    banner={txt:"A HOLLOW CAVE",
      sub:ECAVES[i].key?(keysGot.has("cave"+i)?"YOU ALREADY TOOK WHAT WAS HERE":"SOMETHING METAL GLINTS"):
        ECAVES[i].burn?"THE ROOTS HID A ROOM":"SOMETHING PULSES BELOW",t:0};
    invuln=1;
  }
  function exitCave(){
    const cv=ECAVES[caveI];
    loadScreen(cv.sx,cv.sy);
    px=cv.tx*TS+8;py=(cv.ty+1)*TS+12;entryX=px;entryY=py;facing=0;
    EggAudio.music("overworld");invuln=1;
  }
  /* ---- THE BIT VENDOR: one room off the starting screen ---- */
  function enterVendor(){
    shopBack={sx,sy};
    mode="shop";
    map=parseEnts(EVENDOR_ROOM);
    px=7*TS+8;py=150;entryX=px;entryY=py;facing=1;
    shopMsg={txt:"BITS BUY GEAR",t:0};
    EggAudio.music("dungeon");EggAudio.itemGet();
    banner={txt:"THE BIT VENDOR",sub:"WALK UP AND PRESS X",t:0};
    invuln=1;
  }
  function exitVendor(){
    const b=shopBack||{sx:EVENDOR.sx,sy:EVENDOR.sy};
    loadScreen(b.sx,b.sy);
    px=EVENDOR.tx*TS+8;py=(EVENDOR.ty+1)*TS+12;entryX=px;entryY=py;facing=0;
    EggAudio.music("overworld");invuln=1;shopMsg=null;
  }
  /* three stands, left to right: potion, long sword, torch */
  const SHOP_STOCK=[
    {kind:"potion",tx:3,label:"POTION",note:"FULL HEALTH"},
    {kind:"sword",tx:7,label:"LONG SWORD",note:"4X STRIKE"},
    {kind:"torch",tx:11,label:"TORCH",note:"BURNS TREES"}];
  const SHOP_ROW=5;
  function nearStand(){
    for(const s of SHOP_STOCK){
      const cx2=s.tx*TS+8;
      if(Math.abs(px-cx2)<12&&py>SHOP_ROW*TS+6&&py<SHOP_ROW*TS+40)return s;
    }
    return null;
  }
  function shopSay(t){shopMsg={txt:t,t:0};popText(px,py-20,t,15)}
  function buyItem(kind){
    const price=EPRICE[kind];
    if(kind==="sword"&&swordLvl>1){shopSay("ALREADY YOURS");EggAudio.blip();return}
    if(kind==="torch"&&hasTorch){shopSay("ALREADY YOURS");EggAudio.blip();return}
    if(kind==="potion"&&hasPotion){shopSay("FLASK IS FULL");EggAudio.blip();return}
    if(bits<price){shopSay("NOT ENOUGH BITS - "+price);EggAudio.catchBad();return}
    bits-=price;EggAudio.coin();EggAudio.weaponGet();
    sparks(px,py-10,12,10);
    if(kind==="potion"){hasPotion=true;autoEquip("potion");
      banner={txt:"POTION",sub:"X DRINKS IT WHEN EQUIPPED",t:0};shopMsg={txt:"POTION - THANK YOU",t:0}}
    else if(kind==="torch"){hasTorch=true;autoEquip("torch");
      banner={txt:"TORCH",sub:"X BURNS A TREE WHEN EQUIPPED",t:0};shopMsg={txt:"TORCH - THANK YOU",t:0}}
    else{swordLvl=2;
      banner={txt:"DIGITAL LONG SWORD",sub:"FOUR TIMES THE STRIKE",t:0};shopMsg={txt:"LONG SWORD - THANK YOU",t:0}}
    score+=20;hud();
  }
  /* ---- THE RELAY TOWER (five floors of stairs, puck on floor 5) ---- */
  function loadFloor(f){twrF=f;mode="twr";map=parseEnts(EARTH_TOWER.floors[f])}
  function enterTower(){
    stairLock=null;loadFloor(0);
    px=7*TS+8;py=150;entryX=px;entryY=py;facing=1;
    EggAudio.music("dungeon");EggAudio.powerup();
    banner={txt:"THE RELAY TOWER",sub:"STAIRS UPON STAIRS UPON STAIRS",t:0};
    invuln=1;
  }
  function exitTower(){
    loadScreen(EARTH_TOWER.sx,EARTH_TOWER.sy);
    px=EARTH_TOWER.door.tx*TS+8;py=(EARTH_TOWER.door.ty+1)*TS+12;entryX=px;entryY=py;facing=0;
    EggAudio.music("overworld");invuln=1;
  }
  /* ------------------------------------------------ enemies */
  function spawnEnemy(t,cx,cy){
    const base={type:t,x:cx,y:cy,hp:1,hitCd:0,flash:0,t:Math.random()*1.5,dir:rnd(4)};
    if(t==="1"){base.hp=1}
    else if(t==="2"){base.st="pause";base.hp=1}
    else if(t==="3"){base.hp=2;base.cd=1.4+(cx%3)*.5}
    else if(t==="4"){base.hp=2;base.st="wander"}
    else if(t==="5"){base.hp=1;base.big=true}
    else if(t==="6"){base.hp=2;base.st="under";base.t=1+Math.random()}
    else if(t==="7"){base.hp=2;base.cd=1;base.by=cy}
    else if(t==="8"){base.hp=1;base.dir=2}
    else if(t==="9"){base.hp=2;base.sd=0;base.sdT=0}
    else if(t==="0"){base.hp=3}
    else if(t==="m"){base.hp=1}   /* slime mini */
    ens.push(base);
  }
  function eSolid(wx,wy){
    const tx=(wx/TS)|0,ty=(wy/TS)|0;
    const d=tset()[tileCh(tx,ty)];
    if(!d||!d.w)return true;
    if(mode!=="ow"&&gapSide(tx,ty))return true;   /* enemies keep off door gaps */
    if(mode==="dun"&&block&&wx>=block.x&&wx<block.x+TS&&wy>=block.y&&wy<block.y+TS)return true;
    return false;
  }
  function eMove(e,dx,dy,dt,spd){
    const nx=e.x+dx*spd*dt,ny=e.y+dy*spd*dt;
    let moved=false;
    if(dx&&!eSolid(nx+Math.sign(dx)*5,e.y)&&nx>8&&nx<IW-8){e.x=nx;moved=true}
    if(dy&&!eSolid(e.x,ny+Math.sign(dy)*5)&&ny>8&&ny<152){e.y=ny;moved=true}
    return moved;
  }
  function losClear(x0,y0,x1,y1){
    const steps=Math.ceil(Math.max(Math.abs(x1-x0),Math.abs(y1-y0))/8);
    for(let i=1;i<steps;i++){
      const ix=x0+(x1-x0)*i/steps,iy=y0+(y1-y0)*i/steps;
      if(eSolid(ix,iy))return false;
    }
    return true;
  }
  function updEnemy(e,dt){
    e.hitCd=Math.max(0,e.hitCd-dt);e.flash=Math.max(0,e.flash-dt);
    const t=e.type,dxp=px-e.x,dyp=py-8-e.y,dist=Math.hypot(dxp,dyp);
    if(t==="1"){                                     /* SCUTTLER: random walk */
      e.t-=dt;
      if(e.t<=0){e.dir=rnd(4);e.t=.6+rnd(7)/10}
      if(!eMove(e,DIRV[e.dir][0],DIRV[e.dir][1],dt,26))e.t=0;
    }else if(t==="2"){                               /* DART-MOTH: pause + dash */
      e.t-=dt;
      if(e.st==="pause"&&e.t<=0){
        e.st="dash";e.t=.45;
        if(rnd(10)<6)e.dir=Math.abs(dxp)>Math.abs(dyp)?(dxp>0?3:2):(dyp>0?0:1);
        else e.dir=rnd(4);
      }else if(e.st==="dash"){
        if(!eMove(e,DIRV[e.dir][0],DIRV[e.dir][1],dt,95))e.t=0;
        if(e.t<=0){e.st="pause";e.t=.7}
      }
    }else if(t==="3"){                               /* SPITTER BULB: arcing globs */
      e.cd-=dt;
      if(e.cd<=0&&dist<110&&dist>16){
        e.cd=2.4;e.open=.5;
        eshots.push({kind:"glob",x:e.x,y:e.y-4,x0:e.x,y0:e.y-4,tx:px,ty:py-6,t:0,dur:.9,dmg:1});
      }
      e.open=Math.max(0,(e.open||0)-dt);
    }else if(t==="4"){                               /* CHARGER: telegraph + charge */
      if(e.st==="wander"){
        e.t-=dt;
        if(e.t<=0){e.dir=rnd(4);e.t=.9+rnd(8)/10}
        eMove(e,DIRV[e.dir][0],DIRV[e.dir][1],dt,16);
        const alignX=Math.abs(dyp)<7&&losClear(e.x,e.y,px,e.y),alignY=Math.abs(dxp)<7&&losClear(e.x,e.y,e.x,py-8);
        if(alignX||alignY){
          e.st="tele";e.t=.45;
          e.cdir=alignX?(dxp>0?3:2):(dyp>0?0:1);
        }
      }else if(e.st==="tele"){
        e.t-=dt;e.flash=.08;
        if(e.t<=0){e.st="charge"}
      }else if(e.st==="charge"){
        if(!eMove(e,DIRV[e.cdir][0],DIRV[e.cdir][1],dt,135)){e.st="stun";e.t=.7;sparks(e.x,e.y,15,6)}
      }else if(e.st==="stun"){
        e.t-=dt;
        if(e.t<=0){e.st="wander";e.t=.5}
      }
    }else if(t==="5"||t==="m"){                      /* SPLITTER SLIME / mini */
      const spd2=t==="5"?18:42;
      if(dist>4)eMove(e,dxp/dist,dyp/dist,dt,spd2);
    }else if(t==="6"){                               /* BURROWER */
      e.t-=dt;
      if(e.st==="under"){
        if(dist>6){e.x+=dxp/dist*30*dt;e.y+=dyp/dist*30*dt}
        e.x=Math.max(10,Math.min(IW-10,e.x));e.y=Math.max(10,Math.min(150,e.y));
        if(e.t<=0){
          if(!eSolid(e.x,e.y)){e.st="up";e.t=1.4;sparks(e.x,e.y+4,13,8)}
          else e.t=.3;
        }
      }else{
        if(e.t<=0){e.st="under";e.t=1.6}
      }
    }else if(t==="7"){                               /* SENTRY EYE */
      e.t+=dt;e.y=e.by+Math.sin(e.t*2.2)*3;
      e.cd-=dt;
      const alignX=Math.abs(dyp)<6,alignY=Math.abs(dxp)<6;
      if(e.cd<=0&&(alignX||alignY)&&losClear(e.x,e.y,px,py-8)){
        e.cd=1.9;
        const vx=alignX?Math.sign(dxp)*130:0,vy=alignX?0:Math.sign(dyp)*130;
        eshots.push({kind:"beam",x:e.x,y:e.y,vx,vy,dmg:1,ttl:2.4});
        EggAudio.laser("blast");
      }
    }else if(t==="8"){                               /* RATTLER: wall-hugger */
      const cxg=((e.x/TS)|0)*TS+8,cyg=((e.y/TS)|0)*TS+8;
      if(Math.abs(e.x-cxg)<1.6&&Math.abs(e.y-cyg)<1.6){
        const R={0:2,1:3,2:1,3:0},L={0:3,1:2,2:0,3:1},B={0:1,1:0,2:3,3:2};
        const opens=d2=>!eSolid(e.x+DIRV[d2][0]*TS,e.y+DIRV[d2][1]*TS);
        if(opens(R[e.dir]))e.dir=R[e.dir];
        else if(opens(e.dir));
        else if(opens(L[e.dir]))e.dir=L[e.dir];
        else e.dir=B[e.dir];
      }
      eMove(e,DIRV[e.dir][0],DIRV[e.dir][1],dt,72);
    }else if(t==="9"){                               /* SHIELD DRONE */
      e.sdT-=dt;
      if(e.sdT<=0){
        e.sd=Math.abs(dxp)>Math.abs(dyp)?(dxp>0?3:2):(dyp>0?0:1);
        e.sdT=.55;
      }
      if(dist>10)eMove(e,dxp/dist,dyp/dist,dt,20);
    }else if(t==="0"){                               /* GLOOM JELLY */
      if(dist>4)eMove(e,dxp/dist,dyp/dist,dt,13);
    }
  }
  function eBox(e){
    const t=e.type;
    if(t==="6"&&e.st==="under")return[e.x-6,e.y-2,e.x+6,e.y+3];
    if(t==="m")return[e.x-4,e.y-3,e.x+4,e.y+4];
    if(t==="4")return[e.x-7,e.y-5,e.x+7,e.y+6];
    return[e.x-6,e.y-5,e.x+6,e.y+6];
  }
  function dropFrom(e){
    const r=rnd(100);
    const lowHp=hp<=maxHp*.35;
    if(r<(lowHp?6:2))drops.push({kind:"wisp",x:e.x,y:e.y,ttl:14});
    else if(r<27)drops.push({kind:"heart",x:e.x,y:e.y,ttl:9});
    else if(r<70)drops.push({kind:"bit",x:e.x,y:e.y,ttl:9});
  }
  function hitEnemy(e,sdir,dmg){
    if(e.hitCd>0)return;
    if(e.type==="6"&&e.st==="under"){popText(e.x,e.y-8,"DIG!",15);return}
    if(e.type==="9"){
      const opp={0:1,1:0,2:3,3:2};
      if(sdir!=null&&e.sd===opp[sdir]){   /* strike met the shield face */
        EggAudio.laser("sub");sparks(e.x,e.y-4,6,4);
        popText(e.x,e.y-10,"CLANK",15);e.hitCd=.3;
        return;
      }
    }
    e.hitCd=.28;e.flash=.15;e.hp-=(dmg==null?dmgSword():dmg);
    EggAudio.stomp();
    const dxp=e.x-px,dyp=e.y-(py-8),dd=Math.hypot(dxp,dyp)||1;
    e.x+=dxp/dd*7;e.y+=dyp/dd*7;
    if(e.hp<=0){
      ens.splice(ens.indexOf(e),1);
      kills++;score+=10;hud();
      sparks(e.x,e.y-4,13,10);puff(e.x,e.y-2,6,6);EggAudio.explode(.25);
      if(e.type==="5"){spawnEnemy("m",e.x-6,e.y);spawnEnemy("m",e.x+6,e.y);ens[ens.length-1].hitCd=.4;ens[ens.length-2].hitCd=.4}
      else dropFrom(e);
    }
  }
  /* ------------------------------------------------ boss */
  function bossBox(){return boss?[boss.x-16,boss.y-16,boss.x+16,boss.y+16]:null}
  function updBoss(dt){
    if(!boss)return;
    boss.flash=Math.max(0,boss.flash-dt);
    if(!boss.engaged){
      if(py<140){boss.engaged=true;bossSeal=true;EggAudio.bossWarn();EggAudio.music("boss");
        banner={txt:"THE CRT TYRANT",sub:"STRIKE THE OPEN SCREEN",t:0}}
      return;
    }
    boss.t-=dt;
    const dxp=px-boss.x,dyp=(py-8)-boss.y,dd=Math.hypot(dxp,dyp)||1;
    if(boss.st==="trundle"){
      boss.x+=dxp/dd*boss.spd*dt;boss.y+=dyp/dd*boss.spd*dt;
      boss.x=Math.max(26,Math.min(IW-26,boss.x));boss.y=Math.max(26,Math.min(130,boss.y));
      if(boss.t<=0){boss.st="fire";boss.t=.5}
    }else if(boss.st==="fire"){
      if(boss.t<=0){
        const n=boss.beams,base=Math.atan2(dyp,dxp),spread=.5;
        for(let i=0;i<n;i++){
          const a=base+(n===1?0:(-spread/2+spread*i/(n-1)));
          eshots.push({kind:"bossbeam",x:boss.x,y:boss.y+6,vx:Math.cos(a)*88,vy:Math.sin(a)*88,dmg:2,ttl:3});
        }
        EggAudio.laser("fiber");
        boss.st="vent";boss.t=1.7;
      }
    }else if(boss.st==="vent"){
      if(boss.t<=0){boss.st="trundle";boss.t=3.2}
    }else if(boss.st==="die"){
      if(!EGG_RM&&Math.random()<.3)sparks(boss.x-12+Math.random()*24,boss.y-12+Math.random()*24,13,6);
      if(boss.t<=0){
        EggAudio.explode(1);sparks(boss.x,boss.y,12,24);
        boss=null;bossDead=true;bossSeal=false;score+=500;hud();
        EggAudio.music("dungeon");
        banner={txt:"THE TYRANT FALLS",sub:"THE EAST DOOR OPENS",t:0};
      }
    }
  }
  function hitBoss(){
    if(!boss||boss.st!=="vent"||boss.flash>0)return false;
    boss.hits++;boss.hp--;boss.flash=.3;
    EggAudio.explode(.6);sparks(boss.x,boss.y-6,9,14);
    popText(boss.x,boss.y-22,"HIT "+boss.hits+"/5",12);
    if(boss.hp<=0){boss.st="die";boss.t=1.2;EggAudio.explode(.9)}
    else{boss.spd*=1.1;boss.beams++;boss.st="trundle";boss.t=3.2}
    return true;
  }
  /* ------------------------------------------------ combat */
  function strike(){
    if(swCd>0||swing||state!=="play"||frozen>0)return;
    swing={t:0,dir:facing};swCd=.34;
    EggAudio.laser("crimp");
    if(hp===maxHp)fireBeam();
  }
  /* FULL-HEALTH BEAM. The 18px signal bolt is gone: a full-health strike now
     throws the charge the whole way across the map. The flight is resolved the
     moment it is fired — one 3px march from the blade tip to the first wall,
     enemy or boss vent — so the beam is a line segment with a lifetime rather
     than a projectile the loop has to chase. It carries exactly what the strike
     carries: dmgSword(), 1 with the crimper and 4 with the long sword. */
  function fireBeam(){
    const[dx2,dy2]=DIRV[facing],tip=strikeTip();
    let bx=tip[0],by=tip[1],hitE=null,hitB=false;
    const lim=(dx2?IW:160)+TS;
    for(let d=0;d<lim;d+=3){
      const ax=bx+dx2*3,ay=by+dy2*3;
      if(eSolid(ax,ay))break;
      bx=ax;by=ay;
      const box=[bx-3,by-3,bx+3,by+3];
      let stop=false;
      for(const e of ens)if(overlap(box,eBox(e))){hitE=e;stop=true;break}
      if(!stop&&boss&&overlap(box,bossBox())){hitB=true;stop=true}
      if(stop)break;
    }
    beams.push({x0:tip[0],y0:tip[1],x1:bx,y1:by,dir:facing,t:0,ice:swordLvl>1,spin:0});
    EggAudio.beamShot();
    if(hitE)hitEnemy(hitE,facing,dmgSword());
    else if(hitB)hitBoss();
  }
  function updBeams(dt){
    for(let i=beams.length-1;i>=0;i--){
      const b=beams[i];
      b.t+=dt;b.spin+=dt*18;
      if(b.t>=BEAM_LIFE)beams.splice(i,1);
    }
  }
  /* the long sword reaches 3px further than the crimper — the only thing about
     it that is not damage */
  function reach(){return swordLvl>1?3:0}
  function strikeTip(){
    const r=reach();
    if(facing===0)return[px,py+10+r];
    if(facing===1)return[px,py-24-r];
    if(facing===2)return[px-15-r,py-7];
    return[px+15+r,py-7];
  }
  function strikeRect(){
    const r=reach();
    if(facing===0)return[px-6,py,px+6,py+10+r];
    if(facing===1)return[px-6,py-24-r,px+6,py-14];
    if(facing===2)return[px-15-r,py-13,px-5,py-1];
    return[px+5,py-13,px+15+r,py-1];
  }
  /* ---- X: context action / MERSIVE POLARIS ---- */
  function frontTile(){
    const dd=DIRV[facing];
    return[((px+dd[0]*12)/TS)|0,(((py-4)+dd[1]*12)/TS)|0];
  }
  function setTile(tx,ty,ch){map[ty]=map[ty].slice(0,tx)+ch+map[ty].slice(tx+1)}
  function contextAction(){
    if(state!=="play"||frozen>0||xCd>0)return;
    xCd=.28;
    if(mode==="shop"){                  /* at a stand, X is the till */
      const st=nearStand();
      if(st){buyItem(st.kind);return}
      shopSay("STAND AT A CRATE");EggAudio.blip();return;
    }
    if(carryRock){throwRock();return}   /* carrying: X = throw, two cells ahead */
    const ft=frontTile(),ch=tileCh(ft[0],ft[1]);
    if(mode==="ow"&&ch==="k"){          /* lift the small rock overhead */
      setTile(ft[0],ft[1],".");
      carryRock=true;
      EggAudio.stomp();sparks(ft[0]*TS+8,ft[1]*TS+8,13,6);
      score+=5;hud();popText(px,py-18,"HUP!",12);
      return;
    }
    useEquipped();
  }
  /* X uses whatever the item screen has equipped */
  function useEquipped(){
    if(equipped==="puck"&&hasPuck){throwPuck();return}
    if(equipped==="torch"&&hasTorch){useTorch();return}
    if(equipped==="potion"&&hasPotion){usePotion();return}
    popText(px,py-18,ownedItems().length?"EQUIP AN ITEM - I":"NOTHING HERE",15);EggAudio.blip();
  }
  function usePotion(){
    if(hp>=maxHp){popText(px,py-18,"ALREADY FULL",15);EggAudio.blip();return}
    hasPotion=false;hp=maxHp;
    EggAudio.weaponGet();sparks(px,py-10,16,14);
    popText(px,py-20,"FULL HEALTH",13);
    banner={txt:"THE POTION",sub:"THE FLASK RUNS CLEAR",t:0};
    if(!ownedItems().includes(equipped))equipped=ownedItems()[0]||"none";
    hud();
  }
  /* ---- TORCH: the trees that are not the map's walls will burn ---- */
  function boundaryTree(tx,ty){return tx<=0||ty<=0||tx>=PW-1||ty>=PH-1}
  function burnableAt(tx,ty){
    return mode==="ow"&&tileCh(tx,ty)==="t"&&!boundaryTree(tx,ty)&&
      !fires.some(f=>f.tx===tx&&f.ty===ty);
  }
  function useTorch(){
    const ft=frontTile(),tx=ft[0],ty=ft[1],ch=tileCh(tx,ty);
    if(mode!=="ow"||ch!=="t"){popText(px,py-18,"NOTHING TO BURN",15);EggAudio.blip();return}
    if(boundaryTree(tx,ty)){                     /* the level's walls stay put */
      popText(px,py-18,"THE TREE LINE HOLDS",15);EggAudio.blip();
      sparks(tx*TS+8,ty*TS+10,15,4);return;
    }
    if(fires.some(f=>f.tx===tx&&f.ty===ty))return;
    const cave=ECAVES.findIndex(v=>v.burn&&v.sx===sx&&v.sy===sy&&v.tx===tx&&v.ty===ty);
    fires.push({tx,ty,t:0,cave});
    EggAudio.flameUp();
    score+=5;hud();
  }
  function updFires(dt){
    const DUR=EGG_RM?.5:1.1;
    for(let i=fires.length-1;i>=0;i--){
      const f=fires[i];
      f.t+=dt;
      if(!EGG_RM&&Math.random()<.5)
        parts.push({x:f.tx*TS+3+Math.random()*10,y:f.ty*TS+4+Math.random()*8,vx:(Math.random()-.5)*18,vy:-22-Math.random()*20,a:1,ci:Math.random()<.5?12:13,sz:1,g:-8});
      if(f.t<DUR)continue;
      const ch=f.cave>=0?"c":"u";
      setTile(f.tx,f.ty,ch);
      burnt.set(sx+","+sy+","+f.tx+","+f.ty,ch);
      fires.splice(i,1);
      EggAudio.stomp();sparks(f.tx*TS+8,f.ty*TS+10,15,10);
      if(f.cave>=0){
        EggAudio.powerPellet();
        banner={txt:"A MOUTH IN THE ROOTS",sub:"SOMETHING WAS UNDER IT",t:0};
      }else popText(f.tx*TS+8,f.ty*TS+2,"ASH",15);
    }
  }
  function throwRock(){
    if(thrown)return;
    carryRock=false;
    const dd=DIRV[facing];
    thrown={x:px+dd[0]*6,y:py-10+dd[1]*6,dx:dd[0],dy:dd[1],dir:facing,dist:0};
    EggAudio.laser("blast");
  }
  function breakRock(bx,by){
    EggAudio.stomp();sparks(bx,by,13,10);
    const tx=(bx/TS)|0,ty=(by/TS)|0,r=rnd(10);
    if(r<1&&hp<maxHp)drops.push({kind:"wisp",x:tx*TS+8,y:ty*TS+8,ttl:14});
    else if(r<3)drops.push({kind:"heart",x:tx*TS+8,y:ty*TS+8,ttl:9});
    else if(r<6)drops.push({kind:"bit",x:tx*TS+8,y:ty*TS+8,ttl:9});
    thrown=null;
  }
  function updThrown(dt){
    if(!thrown)return;
    const v=150;
    thrown.x+=thrown.dx*v*dt;thrown.y+=thrown.dy*v*dt;thrown.dist+=v*dt;
    for(const e of ens.slice()){
      if(overlap([thrown.x-4,thrown.y-4,thrown.x+4,thrown.y+4],eBox(e))){
        hitEnemy(e,thrown.dir,dmgPuck());breakRock(thrown.x,thrown.y);return;
      }
    }
    if(eSolid(thrown.x+thrown.dx*4,thrown.y+thrown.dy*4)){breakRock(thrown.x,thrown.y);return}
    if(thrown.dist>=TS*2)breakRock(thrown.x,thrown.y);
  }
  function drawRockAt(dx2,dy2){   /* the stone ramp, not three one-off hexes */
    x.fillStyle=PAL[16];x.fillRect(dx2+1,dy2+1,6,6);
    x.fillStyle=PAL[13];x.fillRect(dx2+2,dy2+2,4,4);
    x.fillStyle=PAL[14];x.fillRect(dx2+2,dy2+4,4,2);
    x.fillStyle=PAL[12];x.fillRect(dx2+2,dy2+2,2,1);
  }
  function throwPuck(){
    if(puck)return;
    const dd=DIRV[facing];
    puck={x:px+dd[0]*7,y:py-7+dd[1]*7,dx:dd[0],dy:dd[1],dir:facing,dist:0,st:"out",hit:new Set()};
    EggAudio.laser("blast");
  }
  function updPuck(dt){
    if(!puck)return;
    if(puck.st==="out"){
      puck.x+=puck.dx*135*dt;puck.y+=puck.dy*135*dt;puck.dist+=135*dt;
      if(puck.dist>=62||eSolid(puck.x+puck.dx*4,puck.y+puck.dy*4))puck.st="back";
    }else{
      const bx=px-puck.x,by=(py-7)-puck.y,bd=Math.hypot(bx,by);
      if(bd<8){puck=null;EggAudio.blip();return}
      puck.x+=bx/bd*150*dt;puck.y+=by/bd*150*dt;
    }
    for(const e of ens.slice()){
      if(!puck.hit.has(e)&&overlap([puck.x-4,puck.y-4,puck.x+4,puck.y+4],eBox(e))){
        puck.hit.add(e);hitEnemy(e,puck.st==="out"?puck.dir:null,dmgPuck());
      }
    }
  }
  function overlap(a,b){return a[0]<b[2]&&a[2]>b[0]&&a[1]<b[3]&&a[3]>b[1]}
  function pBox(){return[px-5,py-12,px+4,py]}
  function hurt(n,fx,fy){
    if(!alive||state!=="play"||invuln>0||peace||dying>0)return;
    hp-=n;invuln=1;
    const dd=Math.hypot(px-fx,py-fy)||1;
    kx=(px-fx)/dd*150;ky=(py-fy)/dd*150;kt=.16;
    EggAudio.catchBad();sparks(px,py-8,14,10);
    if(hp<=0){hp=0;die()}
  }
  function die(){
    state="dead";dying=.9;diedInDungeon=mode==="dun";itemsOpen=false;
    sparks(px,py-8,14,14);puff(px,py-8,6,8);
    EggAudio.musicStop();EggAudio.gameOver();
  }
  function endDeath(){
    alive=false;egg6Anim=null;
    egg6Best=Math.max(egg6Best,score);hud();
    const lines=["Score "+score+" · bits "+bits,"Session best "+egg6Best];
    lines.push(ckpt&&ckpt.mode==="dun"?"C returns to this fortress room":"C returns to where you fell");
    lines.push("Uptime, cells, chips and the map are kept");
    eggEndScreen({host:c.parentElement,title:"THE CAMPUS DIMS.",lines,
      onContinue:()=>continueRun(),
      onReplay:()=>eggLostDisplay(),
      onMenu:()=>{eggClose6();eggMenu()}});
  }
  /* CONTINUE: progress (containers, keys, the puck, bits, the explored map)
     survives; you restart at the screen or room you were last in, at full
     health, with a longer grace window. REPLAY is still a fresh run. */
  function continueRun(){
    eggEndDismiss();
    continues++;
    hp=maxHp;state="play";alive=true;dying=0;invuln=2.2;frozen=0;kx=ky=kt=0;
    boss=null;bossSeal=false;drops.length=0;shots.length=0;thrown=null;
    itemsOpen=false;itemT=0;beams=[];fires=[];   /* bits, items and the sword all survive */
    if(ckpt&&ckpt.mode==="dun"){
      loadRoom(ckpt.rx,ckpt.ry);
      px=ckpt.x;py=ckpt.y;
      EggAudio.music("dungeon");
    }else if(ckpt){
      loadScreen(ckpt.sx,ckpt.sy);
      px=ckpt.x;py=ckpt.y;
      EggAudio.music("overworld");
    }else{
      loadScreen(EARTH_META.start.sx,EARTH_META.start.sy);
      px=W/2;py=H/2;
      EggAudio.music("overworld");
    }
    banner={txt:"CONTINUE",sub:"THE CAMPUS HOLDS ON",t:0};
    EggAudio.missionStart();hud();
    last=null;egg6Anim=requestAnimationFrame(loop);
  }
  function winRun(){
    alive=false;egg6Anim=null;
    const bonus=Math.max(0,900-(timeS|0)*2);score+=bonus;
    egg6Best=Math.max(egg6Best,score);hud();
    eggEndScreen({host:c.parentElement,title:"THE CAMPUS SHINES AGAIN.",
      lines:["The display is home. Score "+score+(bonus?" (+"+bonus+" swift rescue)":""),
             "Time "+(((timeS/60)|0))+":"+((timeS|0)%60<10?"0":"")+((timeS|0)%60)+" · session best "+egg6Best],
      onReplay:eggLostDisplay,onMenu:()=>{eggClose6();eggMenu()}});
  }
  /* ------------------------------------------------ input */
  egg6Keys=e=>{
    if(document.getElementById("egg6").style.display!=="flex")return;
    if(["ArrowLeft","ArrowRight","ArrowUp","ArrowDown"," "].includes(e.key))e.preventDefault();
    const k=e.key.length===1?e.key.toLowerCase():e.key;
    if(e.type==="keydown"){
      if(k==="p"&&alive&&!itemsOpen&&(state==="play"||state==="swap")){paused=!paused;return}
      /* I opens the item screen. Same contract as the P veil: the loop stops
         updating, the frame keeps drawing, nothing else in the game moves. */
      if(k==="i"&&!keys[k]&&alive&&!paused&&(state==="play"||state==="swap")){
        itemsOpen=!itemsOpen;itemT=0;EggAudio.uiClick();keys[k]=true;return;
      }
      if(itemsOpen){
        if(k==="x"&&!keys[k])cycleEquip(1);
        keys[k]=true;return;
      }
      if((k==="z"||k===" ")&&!keys[k]){
        if(frozen>0)frozen=Math.max(0,frozen-.12);
        else strike();
      }
      if(k==="x"&&!keys[k]){
        if(frozen>0)frozen=Math.max(0,frozen-.12);
        else contextAction();
      }
      if(["ArrowLeft","ArrowRight","ArrowUp","ArrowDown"].includes(k)){
        if(frozen>0&&!keys[k])frozen=Math.max(0,frozen-.12);
        facing={ArrowDown:0,ArrowUp:1,ArrowLeft:2,ArrowRight:3}[k];
      }
    }
    keys[k]=e.type==="keydown";
  };
  addEventListener("keydown",egg6Keys);addEventListener("keyup",egg6Keys);
  /* ------------------------------------------------ update */
  function movePlayer(dt){
    let dx=0,dy=0;
    if(keys.ArrowLeft)dx-=1;if(keys.ArrowRight)dx+=1;
    if(keys.ArrowUp)dy-=1;if(keys.ArrowDown)dy+=1;
    moving=false;
    if(kt>0){ /* knockback */
      kt-=dt;
      const nx=px+kx*dt,ny=py+ky*dt;
      if(boxFree(nx,py))px=nx;
      if(boxFree(px,ny))py=ny;
      return;
    }
    if(frozen>0){frozen-=dt*.35;return}
    if(!dx&&!dy)return;
    if(dx&&dy){dx*=.7071;dy*=.7071}
    moving=true;walkT+=dt;
    /* facing follows the dominant fresh axis */
    if(dx&&!dy)facing=dx<0?2:3;
    else if(dy&&!dx)facing=dy<0?1:0;
    const nx=px+dx*SPD*dt,ny=py+dy*SPD*dt;
    if(boxFree(nx,py))px=nx;
    else if(dx&&!dy){ /* corner nudge onto the open tile */
      if(boxFree(nx,py-5))py-=Math.min(5,42*dt);
      else if(boxFree(nx,py+5))py+=Math.min(5,42*dt);
    }
    if(boxFree(px,ny))py=ny;
    else if(dy&&!dx){
      if(boxFree(px-5,ny))px-=Math.min(5,42*dt);
      else if(boxFree(px+5,ny))px+=Math.min(5,42*dt);
    }
    px=Math.max(2,Math.min(IW-2,px));py=Math.max(2,Math.min(158,py));
  }
  function tilesUnderPlayer(){
    return[((px/TS)|0),(((py-4)/TS)|0)];
  }
  function updTraps(dt){
    /* spikes: 2s cycle, up for .8s, phase alternates by tile parity */
    for(const s of spikes){
      s.up=((elapsed+s.ph)%2)<.8;
      if(s.up&&overlap(pBox(),[s.tx*TS+3,s.ty*TS+3,s.tx*TS+13,s.ty*TS+13]))hurt(2,s.tx*TS+8,s.ty*TS+8);
    }
    for(const a of arrows){
      a.cd-=dt;
      if(a.cd<=0){
        a.cd=2.4;
        eshots.push({kind:"arrow",x:a.tx*TS+8+a.fd[0]*9,y:a.ty*TS+8+a.fd[1]*9,vx:a.fd[0]*110,vy:a.fd[1]*110,dmg:1,ttl:3});
      }
    }
    for(const b of blades){
      b.cd=Math.max(0,b.cd-dt);
      const dxr=px-b.hx,dyr=(py-8)-b.hy,dd=Math.hypot(dxr,dyr);
      if(b.st==="idle"&&b.cd<=0&&dd<90&&dd>8&&(Math.abs(dxr-dyr)<6||Math.abs(dxr+dyr)<6)){
        b.st="fly";b.t=.8;
        b.vx=Math.sign(dxr)*82;b.vy=Math.sign(dyr)*82;
        EggAudio.laser("blast");
      }
      if(b.st==="fly"){
        b.t-=dt;b.x+=b.vx*dt;b.y+=b.vy*dt;
        if(eSolid(b.x+Math.sign(b.vx)*5,b.y)||eSolid(b.x,b.y+Math.sign(b.vy)*5)||b.t<=0)b.st="back";
        if(overlap(pBox(),[b.x-4,b.y-4,b.x+4,b.y+4]))hurt(2,b.x,b.y);
      }else if(b.st==="back"){
        const bx=b.hx-b.x,by=b.hy-b.y,bd=Math.hypot(bx,by);
        if(bd<2){b.x=b.hx;b.y=b.hy;b.st="idle";b.cd=1.2}
        else{b.x+=bx/bd*55*dt;b.y+=by/bd*55*dt}
      }
    }
    /* false floor */
    if(mode==="dun"&&state==="play"){
      const[tx,ty]=tilesUnderPlayer();
      if(tileCh(tx,ty)==="F"){
        const id=tx+","+ty;
        if(crumbled.has(id)){startFall()}
        else if(crumbleAt===id){
          crumbleT-=dt;
          if(crumbleT<=0){crumbled.add(id);startFall()}
        }else{crumbleAt=id;crumbleT=.3;EggAudio.laser("sub")}
      }else{crumbleAt=null}
    }
  }
  function startFall(){
    if(state!=="play")return;
    state="fall";fallT=.7;EggAudio.muncherDown();
  }
  function endFall(){
    hp=Math.max(0,hp-1);
    if(hp<=0){die();return}
    px=entryX;py=entryY;invuln=1.2;state="play";
    sparks(px,py-6,15,8);
  }
  let entryX=px,entryY=py;
  function updBlock(dt){
    if(!block)return;
    if(block.t>0){ /* sliding */
      block.t-=dt;
      block.x+=block.sx*dt*64;block.y+=block.sy*dt*64;
      if(block.t<=0){
        block.x=Math.round(block.x/TS)*TS;block.y=Math.round(block.y/TS)*TS;
        blockState[block.id]={x:block.x/TS,y:block.y/TS};
        if(switchPos&&!switchOn&&(block.x/TS)===switchPos.tx&&(block.y/TS)===switchPos.ty){
          switchOn=true;EggAudio.powerup();
          popText(switchPos.tx*TS+8,switchPos.ty*TS,"CLICK!",9);
          banner={txt:"A DOOR OPENS",sub:"",t:0};
        }
      }
      return;
    }
    /* push detection: player walking into the block */
    let pdir=null;
    if(keys.ArrowLeft&&px-5<=block.x+TS+1&&px>block.x+TS-4&&py-8<block.y+TS&&py>block.y)pdir=[-1,0];
    else if(keys.ArrowRight&&px+4>=block.x-1&&px<block.x+4&&py-8<block.y+TS&&py>block.y)pdir=[1,0];
    else if(keys.ArrowUp&&py-8<=block.y+TS+1&&py>block.y+TS-2&&px+4>block.x&&px-5<block.x+TS)pdir=[0,-1];
    else if(keys.ArrowDown&&py>=block.y-1&&py-8<block.y+4&&px+4>block.x&&px-5<block.x+TS)pdir=[0,1];
    if(pdir){
      block.push=(block.push||0)+dt;
      if(block.push>.18){
        const ntx=block.x/TS+pdir[0],nty=block.y/TS+pdir[1];
        const d=tset()[tileCh(ntx,nty)];
        if(d&&d.w&&!gapSide(ntx,nty)&&tileCh(ntx,nty)!=="F"){
          block.sx=pdir[0];block.sy=pdir[1];block.t=TS/64;block.push=0;
          EggAudio.bounce();
        }else block.push=0;
      }
    }else block.push=0;
  }
  function updDrops(dt){
    for(let i=drops.length-1;i>=0;i--){
      const d=drops[i];
      d.ttl-=dt;
      if(d.ttl<=0){drops.splice(i,1);continue}
      if(overlap(pBox(),[d.x-5,d.y-5,d.x+5,d.y+5])){
        if(d.kind==="heart"){hp=Math.min(maxHp,hp+2);EggAudio.catchGood();popText(d.x,d.y-8,"+2",14)}
        else if(d.kind==="wisp"){hp=maxHp;EggAudio.weaponGet();sparks(d.x,d.y,16,12);popText(d.x,d.y-10,"FULL HEALTH",13);
          banner={txt:"A RELAY WISP",sub:"UPTIME FULLY RESTORED",t:0}}
        else if(d.kind==="bit"){bits++;score+=5;EggAudio.blip()}
        else if(d.kind==="key"){
          /* the only keys in the run are the two cave keys; banking the id is
             what stops the cave paying out again */
          if(d.id)keysGot.add(d.id);
          keysN++;score+=25;EggAudio.itemGet();popText(d.x,d.y-8,"AN ACCESS CHIP",12);
          banner={txt:"AN ACCESS CHIP",sub:"A FORTRESS DOOR WILL OPEN",t:0};
        }
        else if(d.kind==="puck"){
          hasPuck=true;autoEquip("puck");score+=100;
          EggAudio.weaponGet();popText(d.x,d.y-10,"THE MERSIVE POLARIS",10);
          banner={txt:"THE MERSIVE POLARIS",sub:"X THROWS IT - IT RETURNS",t:0};
        }
        else if(d.kind==="container"){
          /* 20 cells is the ceiling: 3 to start + 17 containers x 2 = 40 half-cells */
          containersGot.add(d.id);maxHp=Math.min(40,maxHp+2);hp=maxHp;score+=50;
          EggAudio.weaponGet();popText(d.x,d.y-10,"POWER CELL",14);
          banner={txt:"POWER CELL",sub:"MAX UPTIME UP",t:0};
        }
        sparks(d.x,d.y-4,d.kind==="bit"?10:12,5);
        drops.splice(i,1);hud();
      }
    }
  }
  function updShots(dt){
    for(let i=shots.length-1;i>=0;i--){
      const s=shots[i];
      const step=Math.hypot(s.vx,s.vy)*dt;
      s.x+=s.vx*dt;s.y+=s.vy*dt;s.left-=step;
      let dead=s.left<=0||eSolid(s.x,s.y);
      if(!dead)for(const e of ens){
        if(overlap([s.x-2,s.y-2,s.x+2,s.y+2],eBox(e))){hitEnemy(e,facing);dead=true;break}
      }
      if(!dead&&boss&&boss.st==="vent"&&overlap([s.x-2,s.y-2,s.x+2,s.y+2],bossBox())){if(hitBoss())dead=true}
      if(dead)shots.splice(i,1);
    }
    for(let i=eshots.length-1;i>=0;i--){
      const s=eshots[i];
      if(s.kind==="glob"){
        s.t+=dt;
        const pr=Math.min(1,s.t/s.dur);
        s.x=s.x0+(s.tx-s.x0)*pr;s.y=s.y0+(s.ty-s.y0)*pr;
        s.z=Math.sin(Math.PI*pr)*14;
        if(pr>=1){sparks(s.x,s.y,13,4);eshots.splice(i,1);continue}
        if(s.z<4&&overlap(pBox(),[s.x-3,s.y-3,s.x+3,s.y+3])){hurt(s.dmg,s.x,s.y);eshots.splice(i,1)}
        continue;
      }
      s.ttl-=dt;s.x+=s.vx*dt;s.y+=s.vy*dt;
      if(s.ttl<=0||eSolid(s.x,s.y)){eshots.splice(i,1);continue}
      if(overlap(pBox(),[s.x-3,s.y-2,s.x+3,s.y+2])){hurt(s.dmg,s.x-s.vx*.1,s.y-s.vy*.1);eshots.splice(i,1)}
    }
  }
  function updSwing(dt){
    swCd=Math.max(0,swCd-dt);
    if(!swing)return;
    swing.t+=dt;
    if(swing.t<.16){
      const r=strikeRect();
      for(const e of ens.slice())if(overlap(r,eBox(e)))hitEnemy(e,swing.dir);
      if(boss&&overlap(r,bossBox()))hitBoss();
    }
    if(swing.t>=.22)swing=null;
  }
  function updWorldTriggers(){
    if(state!=="play")return;
    const[tx,ty]=tilesUnderPlayer();
    const ch=tileCh(tx,ty);
    if(mode==="ow"&&ch==="d")enterDungeon();
    else if(mode==="ow"&&ch==="c"){
      const ci=ECAVES.findIndex(v=>v.sx===sx&&v.sy===sy&&v.tx===tx&&v.ty===ty);
      if(ci>=0)enterCave(ci);
    }
    else if(mode==="ow"&&ch==="V")enterVendor();
    else if(mode==="ow"&&ch==="g")enterTower();
    else if(mode==="dun"&&ch==="E"&&py>ty*TS+6)exitDungeon();
    else if(mode==="twr"&&(ch===">"||ch==="<")){
      const sk=tx+","+ty;
      if(stairLock!==sk){
        stairLock=sk;
        if(ch===">"&&twrF<EARTH_TOWER.floors.length-1){
          loadFloor(twrF+1);EggAudio.bounce();popText(px,py-18,"FLOOR "+(twrF+1),12);
        }else if(ch==="<"&&twrF>0){
          loadFloor(twrF-1);EggAudio.stomp();popText(px,py-18,"FLOOR "+(twrF+1),12);
        }
        entryX=px;entryY=py;invuln=Math.max(invuln,.4);
      }
    }
    else if(mode==="twr")stairLock=null;
    else if(mode==="dun"&&ch==="Y");
    /* the keys are outside now, so a locked door has to say what it wants —
       measured off the player's own position rather than their facing, so it
       fires however you arrive at the door, and on a 2s cooldown so standing
       against it does not chatter. Enemy pathing goes through walkable() and
       never comes near this. */
    if(mode==="dun"&&lockHintT<=0&&keysN===0){
      for(const g of LOCK_HINTS){
        const L=lockFor(g.side);
        if(!L||L.kind!=="key"||!lockActive(L))continue;
        if(Math.abs(px-g.cx)<16&&Math.abs((py-8)-g.cy)<22){
          popText(g.cx,g.cy+(g.side==="N"?10:-2),"AN ACCESS CHIP FITS HERE",15);
          EggAudio.blip();lockHintT=2;break;
        }
      }
    }
    if(mode==="dun"&&rx===EARTH_META.prizeRoom[0]&&ry===EARTH_META.prizeRoom[1]&&bossDead){
      const cx2=7*TS+8,cy2=4*TS+12;
      if(Math.abs(px-cx2)<14&&Math.abs(py-(cy2+14))<10)startCeremony();
    }
  }
  function startCeremony(){
    if(state==="ceremony")return;
    state="ceremony";cerT=0;
    EggAudio.musicStop();
  }
  function updCeremony(dt){
    cerT+=dt;
    if(cerT<.5){ /* step to the mark */
      const tx2=7*TS+8,ty2=4*TS+12+16;
      px+=(tx2-px)*Math.min(1,dt*8);py+=(ty2-py)*Math.min(1,dt*8);
    }
    if(cerT>=.55&&cerT<.55+dt*2)EggAudio.itemGet();
    if(cerT>=1.05&&cerT<1.05+dt*2)EggAudio.victory();
    if(!EGG_RM&&cerT>.6&&Math.random()<.25)
      parts.push({x:px-14+Math.random()*28,y:py-30+Math.random()*24,vx:(Math.random()-.5)*24,vy:-12-Math.random()*18,a:1,ci:12});
    if(cerT>5.8)winRun();
  }
  function update(dt){
    elapsed+=dt;
    if(state==="play"||state==="swap")timeS+=dt;
    invuln=Math.max(0,invuln-dt);xCd=Math.max(0,xCd-dt);lockHintT=Math.max(0,lockHintT-dt);
    if(banner){banner.t+=dt;if(banner.t>2.6)banner=null}
    for(let i=parts.length-1;i>=0;i--){const p2=parts[i];p2.x+=p2.vx*dt;p2.y+=p2.vy*dt;p2.vy+=(p2.g==null?40:p2.g)*dt;p2.a-=dt*(p2.sz?2.2:1.4);if(p2.a<=0)parts.splice(i,1)}
    for(let i=floats.length-1;i>=0;i--){const f=floats[i];f.y-=14*dt;f.a-=dt*.9;if(f.a<=0)floats.splice(i,1)}
    EggAudio.musicTick();
    if(state==="swap"){
      swap.t+=dt/.38;
      if(swap.t>=1){
        const s=swap;swap=null;
        loadAny(s.nsx,s.nsy);
        px=s.nx;py=s.ny;entryX=px;entryY=py;
        state="play";
      }
      return;
    }
    if(state==="fall"){
      fallT-=dt;
      if(fallT<=0)endFall();
      return;
    }
    if(state==="dead"){
      dying-=dt;
      if(dying<=0)endDeath();
      return;
    }
    if(state==="ceremony"){updCeremony(dt);return}
    if(state!=="play")return;
    movePlayer(dt);
    updSwing(dt);
    updTraps(dt);
    updBlock(dt);
    updDrops(dt);
    updShots(dt);
    updBeams(dt);
    updFires(dt);
    updPuck(dt);
    updThrown(dt);
    for(const e of ens.slice())updEnemy(e,dt);
    updBoss(dt);
    /* the last enemy on a screen or room falls: mark it cleared. It stays that
       way until it has fallen out of the last MAP_WINDOW maps entered. */
    if(mapArmed&&!ens.length&&!clearedMaps.has(curMapId)){
      clearedMaps.add(curMapId);
      score+=20;hud();
      popText(px,py-22,"AREA CLEAR",9);EggAudio.powerup();
    }
    /* contact damage */
    if(invuln<=0&&!peace&&state==="play"){
      for(const e of ens){
        if(e.type==="6"&&e.st==="under")continue;
        if(overlap(pBox(),eBox(e))){
          hurt(e.type==="4"&&e.st==="charge"?2:1,e.x,e.y);
        }
      }
      if(boss&&boss.st!=="die"&&overlap(pBox(),bossBox()))hurt(2,boss.x,boss.y);
    }
    updWorldTriggers();
    checkEdges();
  }
  /* ------------------------------------------------ draw */
  function sprC(name,f,cx,cy,flip,flash){
    const store=flash?SPRW:(flip?SPRF:SPR);
    const img=store[name][f%store[name].length];
    drawSpr(x,img,cx-img.width/2,cy-img.height);
  }
  function drawMap(g,tt){
    const T=tset();
    for(let j=0;j<PH;j++)for(let i=0;i<PW;i++){
      const ch=map[j][i];
      let d=T[ch]||T["."];
      let art=d.a,f=0;
      /* two or three cuts of the big materials, chosen by position, so a field
         or a wall stops reading as one tile stamped over and over */
      const vh=(i*7+j)%3;
      if(vh===0&&d.alt)art=d.alt;else if(vh===1&&d.alt2)art=d.alt2;
      const frames=SPR[art];
      if(frames.length>1)f=EGG_RM?0:((tt*(d.fps||3))|0)%frames.length;
      g.drawImage(frames[f],i*TS,j*TS);
      /* stateful overlays drawn as tiles */
      if(ch==="S"){const s=spikes.find(q=>q.tx===i&&q.ty===j);g.drawImage(SPR.e_d_spike[s&&s.up?1:0],i*TS,j*TS)}
      else if(ch==="F"&&crumbled&&crumbled.has(i+","+j))g.drawImage(SPR.e_d_pit[0],i*TS,j*TS);
      else if(ch==="X")g.drawImage(SPR.e_d_switch[switchOn?1:0],i*TS,j*TS);
      else if(ch==="Y"&&!bossOrPrizeTaken())g.drawImage(SPR.e_prize[EGG_RM?0:((tt*2)|0)%2],i*TS+1,j*TS-6);
    }
    drawEdges(g,T,tt);
    /* locked doors over their gaps */
    if(mode==="dun"){
      const gp={N:[7,0],S:[7,PH-1]};
      for(const side of["N","S","W","E"]){
        const L=lockFor(side);
        if(!L||!lockActive(L))continue;
        const art=L.kind==="key"?"e_d_lockdoor":"e_d_bossdoor";
        if(side==="N"||side==="S"){const[i,j]=gp[side];g.drawImage(SPR[art][0],i*TS,j*TS)}
        else{const i=side==="W"?0:PW-1;g.drawImage(SPR[art][0],i*TS,4*TS);g.drawImage(SPR[art][0],i*TS,5*TS)}
      }
    }
  }
  /* ---- edge pass: what turns a grid of tiles into a room.
     Light comes from the upper left, so every solid drops a band onto the tile
     below it and a thinner one to its right; water gets foam where it meets
     land and land gets a damp band back; torches pool light on the floor. */
  function drawEdges(g,T,tt){
    const inB=(i,j)=>i>=0&&j>=0&&i<PW&&j<PH;
    const solidT=(i,j)=>{const d=T[inB(i,j)?map[j][i]:(mode==="ow"?"r":"#")];return!d||!d.w};
    const wet=(i,j)=>mode==="ow"&&inB(i,j)&&map[j][i]==="w";
    g.fillStyle=PAL[16];
    for(let j=0;j<PH;j++)for(let i=0;i<PW;i++){
      if(solidT(i,j)||wet(i,j))continue;
      const X=i*TS,Y=j*TS,up=solidT(i,j-1)&&!wet(i,j-1),lf=solidT(i-1,j)&&!wet(i-1,j);
      /* each band gets a second, softer step so the falloff is a ramp, not a wall */
      if(up){g.globalAlpha=.3;g.fillRect(X,Y,TS,3);g.globalAlpha=.12;g.fillRect(X,Y+3,TS,2)}
      if(lf){g.globalAlpha=.2;g.fillRect(X,Y,2,TS);g.globalAlpha=.09;g.fillRect(X+2,Y,1,TS)}
      if(!up&&!lf&&solidT(i-1,j-1)&&!wet(i-1,j-1)){g.globalAlpha=.13;g.fillRect(X,Y,3,3)}
    }
    /* rim light — the one-pixel edge a solid turns toward the light */
    g.fillStyle=PAL[6];
    for(let j=0;j<PH;j++)for(let i=0;i<PW;i++){
      if(!solidT(i,j)||wet(i,j))continue;
      const X=i*TS,Y=j*TS;
      if(!solidT(i,j-1)){g.globalAlpha=.14;g.fillRect(X,Y,TS,1)}
      if(!solidT(i-1,j)){g.globalAlpha=.09;g.fillRect(X,Y,1,TS)}
    }
    g.globalAlpha=1;
    if(mode==="ow")for(let j=0;j<PH;j++)for(let i=0;i<PW;i++){
      const X=i*TS,Y=j*TS;
      if(wet(i,j)){                                  /* foam on the water side */
        if(inB(i,j-1)&&!wet(i,j-1)){g.globalAlpha=.5;g.fillStyle=PAL[6];g.fillRect(X,Y,TS,1);g.globalAlpha=.45;g.fillStyle=PAL[10];g.fillRect(X,Y+1,TS,1)}
        if(inB(i,j+1)&&!wet(i,j+1)){g.globalAlpha=.4;g.fillStyle=PAL[10];g.fillRect(X,Y+TS-1,TS,1)}
        g.fillStyle=PAL[10];g.globalAlpha=.45;
        if(inB(i-1,j)&&!wet(i-1,j))g.fillRect(X,Y,1,TS);
        if(inB(i+1,j)&&!wet(i+1,j))g.fillRect(X+TS-1,Y,1,TS);
      }else if(!solidT(i,j)){                        /* damp sand on the land side */
        g.fillStyle=PAL[11];
        if(wet(i,j+1)){g.globalAlpha=.22;g.fillRect(X,Y+TS-2,TS,2)}
        if(wet(i,j-1)){g.globalAlpha=.16;g.fillRect(X,Y,TS,2)}
        g.globalAlpha=.16;
        if(wet(i-1,j))g.fillRect(X,Y,2,TS);
        if(wet(i+1,j))g.fillRect(X+TS-2,Y,2,TS);
      }
    }
    else for(let j=0;j<PH;j++)for(let i=0;i<PW;i++){  /* torch light pools */
      if(map[j][i]!=="o")continue;
      const cx2=i*TS+8,cy2=j*TS+17,fl=EGG_RM?0:Math.sin(tt*6+i*2+j)*1.1;
      g.fillStyle=PAL[12];
      for(let r=0;r<4;r++){
        const w=Math.round(28-r*6+fl),h=Math.round(18-r*4+fl*.6);
        g.globalAlpha=.032+r*.022;
        g.beginPath();g.rect(cx2-w,cy2-h,w*2,h*2);g.rect(cx2-w+2,cy2-h-2,w*2-4,h*2+4);g.fill();
      }
    }
    g.globalAlpha=1;
  }
  function bossOrPrizeTaken(){return state==="ceremony"||!alive&&state==="ceremony"}
  function cellRow(){
    const full=(hp/2)|0,half=hp%2,tot=maxHp/2;
    const beat=hp>0&&hp<=2&&!EGG_RM&&((elapsed*4)|0)%2===0;   /* the last cell pulses */
    /* pass F raised the ceiling to 20 cells, so the row is ten wide and two
       deep on a 6px pitch. The block is 61px whatever it holds, which is why
       nothing else in the HUD has to move as containers come in. */
    const two=tot>10;
    for(let i=0;i<tot;i++){
      const art=i<full?"e_heart_full":(i===full&&half?"e_heart_half":"e_heart_empty");
      x.drawImage(SPR[art][0],2+(i%10)*6,(two?(i<10?2:9):5)+(beat&&i===0?-1:0));
    }
  }
  function drawHud(){
    x.fillStyle=PAL[0];x.fillRect(0,0,IW,PYOFF);
    x.fillStyle=PAL[1];x.fillRect(0,PYOFF-2,IW,1);
    x.fillStyle=PAL[4];x.fillRect(0,PYOFF-1,IW,1);
    cellRow();
    /* the equipped item sits in its own well — that slot is what X uses */
    x.fillStyle=PAL[1];x.fillRect(64,3,10,10);
    x.fillStyle=PAL[3];
    x.fillRect(64,3,10,1);x.fillRect(64,12,10,1);x.fillRect(64,3,1,10);x.fillRect(73,3,1,10);
    const eico=equipped==="puck"?"e_puck_ico":equipped==="torch"?"e_ico_torch":equipped==="potion"?"e_ico_potion":null;
    if(eico)x.drawImage(SPR[eico][0],66,5);
    if(swordLvl>1)x.drawImage(SPR.e_ico_sword[0],76,5);
    /* keys */
    x.drawImage(SPR.e_key[0],84,5);
    drawText(x,90,6,"X"+keysN,keysN>0?12:15);
    /* bits */
    x.drawImage(SPR.bit[EGG_RM?0:((elapsed*4)|0)%2],103,5);
    drawText(x,110,6,""+bits,10);
    /* hint */
    let hint=mode==="ow"?(fortressSeen?"THE FORTRESS: NE MESA":"FIND THE FORTRESS"):
      mode==="cave"?"A HOLLOW CAVE":
      mode==="shop"?"THE BIT VENDOR":
      mode==="twr"?(hasPuck?"THE PUCK IS YOURS":"TOWER FLOOR "+(twrF+1)+"/5"):
      (bossDead?"TAKE THE DISPLAY":"FIND THE DISPLAY");
    if(boss&&boss.engaged)hint=boss.st==="vent"?"STRIKE THE SCREEN!":"THE CRT TYRANT";
    drawText(x,128,6,hint,6);
    /* mini-map, in its own framed well */
    const mx=IW-13,my=3;
    x.fillStyle=PAL[1];x.fillRect(mx-2,my-2,14,14);
    x.fillStyle=PAL[3];
    x.fillRect(mx-2,my-2,14,1);x.fillRect(mx-2,my+11,14,1);
    x.fillRect(mx-2,my-2,1,14);x.fillRect(mx+11,my-2,1,14);
    if(mode==="ow"){
      for(let j=0;j<10;j++)for(let i=0;i<10;i++){
        x.fillStyle=visited.has(i+","+j)?PAL[3]:PAL[1];
        x.fillRect(mx+i,my+j,1,1);
      }
      if(fortressSeen){x.fillStyle=PAL[12];x.fillRect(mx+EARTH_META.fortress.sx,my+EARTH_META.fortress.sy,1,1)}
      x.fillStyle=((elapsed*3)|0)%2?PAL[7]:PAL[9];
      x.fillRect(mx+sx,my+sy,1,1);
    }else if(mode==="cave"){
      const n=ECAVES[caveI].rooms.length;
      for(let i=0;i<n;i++){x.fillStyle=i===caveR?PAL[12]:PAL[3];x.fillRect(mx+i*3,my+5,2,2)}
    }else if(mode==="shop"){
      x.fillStyle=PAL[12];x.fillRect(mx+2,my+4,2,2);x.fillRect(mx+5,my+4,2,2);x.fillRect(mx+8,my+4,2,2);
    }else if(mode==="twr"){
      for(let f=0;f<5;f++){x.fillStyle=f===twrF?PAL[12]:PAL[3];x.fillRect(mx+4,my+9-f*2,4,1)}
    }else{
      for(let j=0;j<5;j++)for(let i=0;i<5;i++){
        x.fillStyle=visitedR.has(i+","+j)?PAL[3]:PAL[1];
        x.fillRect(mx+i*2,my+j*2+1,2,2);
      }
      if(bossDead||visitedR.has("2,0")){x.fillStyle=PAL[14];x.fillRect(mx+2*2,my+1,2,2)}
      x.fillStyle=((elapsed*3)|0)%2?PAL[7]:PAL[9];
      x.fillRect(mx+rx*2,my+ry*2+1,2,2);
    }
  }
  /* ---- the vendor's room: three crates, three prices, one shopkeeper ---- */
  function drawShop(){
    const vy=3*TS+14,vx=7*TS+8;
    shadowAt(vx,vy+1,12);
    /* the idle is a single 2-frame breath; reduced motion pins it to frame 0 */
    x.drawImage(SPR.e_vendor[EGG_RM?0:((elapsed*1.6)|0)%2],vx-6,vy-16);
    const near=nearStand();
    for(const s of SHOP_STOCK){
      const cx2=s.tx*TS+8,ry2=SHOP_ROW*TS+14;
      shadowAt(cx2,ry2+1,12);
      x.drawImage(SPR.e_podium[0],cx2-6,ry2-9);
      const bob=EGG_RM?0:Math.round(Math.sin(elapsed*2.6+s.tx)*1.2);
      const art=s.kind==="potion"?"e_item_potion":s.kind==="torch"?"e_item_torch":"e_item_sword";
      const img=SPR[art][EGG_RM?0:((elapsed*3)|0)%SPR[art].length];
      const owned=s.kind==="sword"?swordLvl>1:s.kind==="torch"?hasTorch:hasPotion;
      if(owned)x.globalAlpha=.4;
      drawSpr(x,img,cx2-img.width/2,ry2-11-img.height+bob);
      x.globalAlpha=1;
      drawText(x,cx2-textW(s.label)/2,ry2+8,s.label,owned?15:6);
      const price=EPRICE[s.kind]+"";
      drawText(x,cx2-textW(owned?"SOLD":price)/2,ry2+16,owned?"SOLD":price,owned?15:bits>=EPRICE[s.kind]?12:14);
      if(near===s&&!owned){
        drawText(x,cx2-textW("X BUY")/2,ry2+24,"X BUY",EGG_RM||((elapsed*3)|0)%2?9:6);
        drawText(x,cx2-textW(s.note)/2,ry2-24,s.note,10);
      }
    }
    drawText(x,8,2*TS+2,"BITS "+bits,12);
    if(shopMsg)drawText(x,IW/2-textW(shopMsg.txt)/2,2*TS+2,shopMsg.txt,6);
  }
  /* the burn: three baked flame frames over the doomed tree, then ash */
  function drawFires(){
    for(const f of fires){
      const fr=EGG_RM?1:((elapsed*10)|0)%3;
      x.drawImage(SPR.e_fire[fr],f.tx*TS,f.ty*TS);
      if(!EGG_RM){x.globalAlpha=.12+.06*Math.sin(elapsed*9);x.fillStyle=PAL[12];
        x.fillRect(f.tx*TS-6,f.ty*TS-4,TS+12,TS+12);x.globalAlpha=1}
    }
  }
  /* the full-health strike throws the blade itself: the sword sprite flies to
     the impact point, leaving a short fading after-image behind it. Reduced
     motion draws the blade at rest on the impact point with no trail. */
  function drawBeams(){
    for(const b of beams){
      const k=Math.max(0,Math.min(1,b.t/BEAM_LIFE));
      const bx=b.x0+(b.x1-b.x0)*k,by=b.y0+(b.y1-b.y0)*k;
      const glow=b.ice?43:13,mid=b.ice?42:12;
      if(!EGG_RM){
        /* after-image: three fading ghosts strung back toward the hilt */
        for(let g=1;g<=3;g++){
          const t2=Math.max(0,k-g*.10);
          const gx=b.x0+(b.x1-b.x0)*t2,gy=b.y0+(b.y1-b.y0)*t2;
          x.globalAlpha=.26-g*.06;
          x.fillStyle=PAL[g===1?mid:glow];
          x.fillRect(Math.round(gx)-3,Math.round(gy)-3,6,6);
        }
        x.globalAlpha=1;
      }
      const ang=[Math.PI,0,-Math.PI/2,Math.PI/2][b.dir]||0;   /* sprite points up */
      const spr=SPR.e_blade_fly&&SPR.e_blade_fly[b.ice?1:0];
      if(spr){
        x.save();
        x.translate(Math.round(bx),Math.round(by));
        x.rotate(EGG_RM?ang:b.spin);
        x.drawImage(spr,-6,-6);
        x.restore();
      }else{
        x.fillStyle=PAL[b.ice?41:7];
        x.fillRect(Math.round(bx)-3,Math.round(by)-3,6,6);
      }
    }
  }
  function drawActors(){
    if(mode==="shop")drawShop();
    drawFires();
    /* drops — shadow, a slow bob, one orbiting twinkle, and a blink on the way out */
    for(const d of drops){
      if(!EGG_RM&&d.ttl<2&&((elapsed*8)|0)%2===0)continue;
      const bob=EGG_RM?0:Math.round(Math.sin(elapsed*3+d.x*.7)*1.4);
      shadowAt(d.x,d.y+(d.kind==="container"?5:4),d.kind==="container"?11:d.kind==="puck"?10:7);
      if(d.kind==="heart")x.drawImage(SPR.e_pick_heart[((elapsed*3)|0)%2],d.x-2,d.y-4+bob);
      else if(d.kind==="bit")x.drawImage(SPR.bit[((elapsed*4)|0)%2],d.x-3,d.y-3+bob);
      else if(d.kind==="key")x.drawImage(SPR.e_key[((elapsed*2)|0)%2],d.x-2,d.y-4+bob);
      else if(d.kind==="container")x.drawImage(SPR.e_container[0],d.x-5,d.y-6+bob);
      else if(d.kind==="puck")x.drawImage(SPR.e_item_puck[((elapsed*3)|0)%2],d.x-6,d.y-8+bob);
      else if(d.kind==="wisp"){   /* the relay wisp hovers, flutters and trails dust */
        const fy=d.y-7+bob*2;
        x.drawImage(SPR.e_wisp[EGG_RM?1:((elapsed*12)|0)%4],Math.round(d.x-4),Math.round(fy-4));
        if(!EGG_RM)for(let s=1;s<4;s++){
          const a2=elapsed*3.4-s*.55;
          x.globalAlpha=.55-s*.13;x.fillStyle=PAL[s%2?5:12];
          x.fillRect(Math.round(d.x+Math.cos(a2)*7),Math.round(fy+Math.sin(a2)*5),1,1);
        }
        x.globalAlpha=1;
      }
      if(!EGG_RM&&d.kind!=="wisp"){
        const a2=elapsed*2.4+d.x;
        x.globalAlpha=.35+.35*Math.sin(elapsed*6+d.y);x.fillStyle=PAL[7];
        x.fillRect(Math.round(d.x+Math.cos(a2)*6),Math.round(d.y-3+Math.sin(a2)*4),1,1);
        x.globalAlpha=1;
      }
    }
    /* block */
    if(block){shadowAt(block.x+8,block.y+17,14);x.drawImage(SPR.e_d_block[0],Math.round(block.x),Math.round(block.y))}
    /* blades */
    for(const b of blades)x.drawImage(SPR.e_blade[((elapsed*6)|0)%2],Math.round(b.x-4),Math.round(b.y-4));
    /* enemies */
    for(const e of ens){
      const f=((elapsed*5+e.t)|0)%2,fl=e.flash>0;
      if(e.type==="6"&&e.st==="under");                       /* burrowed: no shadow */
      else if(e.type==="7")shadowAt(e.x,(e.by||e.y)+9,7);     /* the eye hovers over its shadow */
      else shadowAt(e.x,e.y+6,e.type==="4"?12:e.type==="m"?6:10);
      if(e.type==="1")sprC("e_scuttler",f,e.x,e.y+5,false,fl);
      else if(e.type==="2")sprC("e_moth",EGG_RM?0:((elapsed*9+e.t)|0)%3,e.x,e.y+6,false,fl);  /* 3-frame flutter */
      else if(e.type==="3")sprC("e_bulb",e.open>0?1:f,e.x,e.y+6,false,fl);
      else if(e.type==="4")sprC("e_charger",f,e.x,e.y+6,e.cdir===2||(!e.cdir&&px<e.x),fl||e.st==="tele"&&((elapsed*8)|0)%2===0);
      else if(e.type==="5")sprC("e_slime",f,e.x,e.y+5,false,fl);
      else if(e.type==="m")sprC("e_slime_mini",f,e.x,e.y+4,false,fl);
      else if(e.type==="6")sprC(e.st==="under"?"e_burrow_mound":"e_burrower",f,e.x,e.y+(e.st==="under"?3:6),false,fl);
      else if(e.type==="7")sprC("e_sentry",f,e.x,e.y+6,false,fl);
      else if(e.type==="8")sprC("e_rattler",f,e.x,e.y+5,e.dir===2,fl);
      else if(e.type==="9"){
        sprC("e_shield",f,e.x,e.y+6,false,fl);
        if(e.sd===0)x.drawImage(SPR.e_shieldbar_h[0],e.x-6,e.y+6);
        else if(e.sd===1)x.drawImage(SPR.e_shieldbar_h[0],e.x-6,e.y-8);
        else if(e.sd===2)x.drawImage(SPR.e_shieldbar_v[0],e.x-8,e.y-6);
        else x.drawImage(SPR.e_shieldbar_v[0],e.x+5,e.y-6);
      }
      else if(e.type==="0")sprC("e_jelly",f,e.x,e.y+6,false,fl);
    }
    /* boss */
    if(boss){
      const f=((elapsed*4)|0)%2;
      const art=boss.st==="vent"?"e_boss_open":"e_boss";
      const img=(boss.flash>0?SPRW:SPR)[art][f];
      shadowAt(boss.x,boss.y+16,26);
      drawSpr(x,img,boss.x-16,boss.y-16);
      if(boss.st==="vent"){   /* the open screen glows: that is the tell */
        x.globalAlpha=EGG_RM?.16:.1+.1*Math.sin(elapsed*12);
        x.fillStyle=PAL[12];x.fillRect(boss.x-11,boss.y-11,22,15);x.globalAlpha=1;
      }
      drawBossBar(x,IW/2-40,4,80,boss.hp/5,"TYRANT");
    }
    /* player */
    /* i-frames blink; under reduced motion they go steady-translucent instead */
    const blinkOff=invuln>0&&!EGG_RM&&((elapsed*10)|0)%2===0&&state==="play"&&kt<=0&&invuln>.2;
    if(state!=="fall"&&!blinkOff){
      /* 4-frame walk (pass / contact / pass / contact); standing still runs a
         3-phase breath — its own art frame plus a 1px lift — and reduced motion
         pins it to the flat pose */
      const wf=moving?((walkT*8)|0)%4:0;
      const idl=!moving&&!swing&&state==="play",ip=(idl&&!EGG_RM)?((elapsed*2.2)|0)%3:0;
      const bob=ip===1?-1:0;
      const hitF=invuln>.86&&kt>0&&state==="play";                                         /* one white frame on damage */
      if(state!=="ceremony")shadowAt(px,py,10);
      if(invuln>0&&EGG_RM&&state==="play")x.globalAlpha=.6;
      if(state==="ceremony"&&cerT>.55){
        const img=SPR.e_p_hoist[((elapsed*3)|0)%2];
        drawSpr(x,img,px-8,py-20);
      }else if(swing){
        const nm=swing.dir===0?"e_p_swing_down":swing.dir===1?"e_p_swing_up":"e_p_swing_side";
        sprC(nm,0,px,py,swing.dir===2,hitF);
      }else{
        const nm=facing===0?"e_p_down":facing===1?"e_p_up":"e_p_side";
        sprC(idl?nm+"_i":nm,idl?(ip===1?1:0):wf,px,py+bob,facing===2,hitF);
      }
      x.globalAlpha=1;
      /* crimper blade during the swing — the DIGITAL LONG SWORD swaps in a
         longer blade in the ice ramp, drawn from the same four anchors */
      if(swing){
        const bh=SPR[swordLvl>1?"e_crimp_h2":"e_crimp_h"][0],bv=SPR[swordLvl>1?"e_crimp_v2":"e_crimp_v"][0];
        if(swing.dir===0)x.drawImage(bv,px-2,py+1);
        else if(swing.dir===1){x.save();x.translate(px+2,py-14);x.rotate(Math.PI);x.drawImage(bv,0,0);x.restore()}
        else if(swing.dir===2){x.save();x.translate(px-5,py-4);x.rotate(Math.PI);x.drawImage(bh,0,0);x.restore()}
        else x.drawImage(bh,px+5,py-9);
      }
    }else if(state==="fall"){
      const sc=Math.max(.2,fallT/.7);
      const img=SPR.e_p_down[0];
      x.save();x.translate(px,py-7);x.scale(sc,sc);x.rotate((1-sc)*6);
      x.drawImage(img,-6,-7);x.restore();
    }
    /* shots */
    if(thrown)drawRockAt(thrown.x-4,thrown.y-4);
    if(carryRock&&alive)drawRockAt(px-4,py-24);
    if(puck)x.drawImage(SPR.e_puck[((elapsed*10)|0)%2],puck.x-4,puck.y-4);
    for(const s of shots)x.drawImage(SPR.e_bolt[((elapsed*8)|0)%2],s.x-1,s.y-1);
    drawBeams();
    for(const s of eshots){
      if(s.kind==="glob")x.drawImage(SPR.e_glob_arc[((elapsed*5)|0)%2],s.x-2,s.y-2-(s.z||0));
      else if(s.kind==="arrow")x.drawImage(s.vx?SPR.e_dart_h[0]:SPR.e_dart_v[0],s.x-4,s.y-2);
      else{ /* beams */
        x.fillStyle=s.kind==="bossbeam"?PAL[14]:PAL[12];
        if(Math.abs(s.vx)>Math.abs(s.vy))x.fillRect(s.x-3,s.y-1,6,2);
        else if(Math.abs(s.vy)>Math.abs(s.vx)&&s.kind!=="bossbeam")x.fillRect(s.x-1,s.y-3,2,6);
        else x.fillRect(s.x-2,s.y-2,4,4);
      }
    }
    /* particles + floats */
    for(const p2 of parts){const s=p2.sz||1;x.globalAlpha=Math.max(0,p2.a);x.fillStyle=PAL[p2.ci];x.fillRect(Math.round(p2.x),Math.round(p2.y),s,s);x.globalAlpha=1}
    for(const f of floats){x.globalAlpha=Math.max(0,f.a);drawText(x,f.x-textW(f.txt)/2,f.y,f.txt,f.ci);x.globalAlpha=1}
  }
  function draw(){
    x.clearRect(0,0,IW,IH);
    drawHud();
    x.save();x.translate(0,PYOFF);
    x.beginPath();x.rect(0,0,IW,160);x.clip();
    if(state==="swap"&&swap){
      const pr=Math.min(1,swap.t),e2=pr*pr*(3-2*pr);
      x.drawImage(swap.oldCv,Math.round(-swap.dx*IW*e2),Math.round(-swap.dy*160*e2));
      x.drawImage(swap.newCv,Math.round(swap.dx*IW*(1-e2)),Math.round(swap.dy*160*(1-e2)));
    }else{
      drawMap(x,elapsed);
      /* shaft of light in the prize room */
      if(mode==="dun"&&rx===EARTH_META.prizeRoom[0]&&ry===EARTH_META.prizeRoom[1]||mode==="twr"&&twrF===4){
        x.globalAlpha=.14;x.fillStyle=PAL[6];
        x.beginPath();x.moveTo(112,0);x.lineTo(128,0);x.lineTo(136,86);x.lineTo(104,86);x.closePath();x.fill();
        x.globalAlpha=1;
      }
      drawActors();
    }
    x.fillStyle=PAL[16];x.globalAlpha=.3;x.fillRect(0,0,IW,2);x.globalAlpha=1;  /* HUD casts onto the field */
    x.restore();
    if(banner){
      const a=banner.t<.3?banner.t/.3:banner.t>2.2?Math.max(0,(2.6-banner.t)/.4):1;
      x.globalAlpha=a;
      x.fillStyle=PAL[0];x.fillRect(0,70,IW,26);
      x.fillStyle=PAL[2];x.fillRect(0,70,IW,1);x.fillRect(0,95,IW,1);
      x.fillStyle=PAL[4];x.fillRect(0,71,IW,1);x.fillRect(0,94,IW,1);
      drawText(x,IW/2-textW(banner.txt,2)/2+1,77,banner.txt,3,2);              /* offset shadow */
      drawText(x,IW/2-textW(banner.txt,2)/2,76,banner.txt,12,2);
      if(banner.sub)drawText(x,IW/2-textW(banner.sub)/2,88,banner.sub,6);
      x.globalAlpha=1;
    }
    if(state==="ceremony"){
      if(cerT>1.2&&cerT<3.4)drawText(x,IW/2-textW("YOU'VE GOT THE DISPLAY.",1)/2,116,"YOU'VE GOT THE DISPLAY.",12);
      if(cerT>=3.4)drawText(x,IW/2-textW("THE CAMPUS SHINES AGAIN.",1)/2,116,"THE CAMPUS SHINES AGAIN.",9);
    }
    if(itemsOpen)drawItems();
    blitScaled(dctx,off,720,528);
    if(paused)eggPauseOverlay(dctx,720,528);
  }
  /* ---- the item screen. Drawn on the internal canvas so it stays in the
     16-bit register instead of arriving as browser text, and it slides down
     over the field the way the HUD would if the HUD were a drawer. Reduced
     motion skips the slide (itemT is pinned to 1 in the loop). ---- */
  function drawItems(){
    const k=EGG_RM?1:itemT*itemT*(3-2*itemT),H2=Math.round(150*k);
    x.fillStyle=PAL[0];x.globalAlpha=.86*k;x.fillRect(0,PYOFF,IW,IH-PYOFF);x.globalAlpha=1;
    x.fillStyle=PAL[1];x.fillRect(6,PYOFF+4,IW-12,H2);
    x.fillStyle=PAL[4];x.fillRect(6,PYOFF+4,IW-12,1);x.fillRect(6,PYOFF+3+H2,IW-12,1);
    x.fillStyle=PAL[3];x.fillRect(6,PYOFF+4,1,H2);x.fillRect(IW-7,PYOFF+4,1,H2);
    if(H2<40)return;
    const top=PYOFF+10;
    drawText(x,IW/2-textW("ITEMS",1)/2,top,"ITEMS",12);
    const slots=[
      {k:"puck",own:hasPuck,ico:"e_item_puck",name:"MERSIVE POLARIS",note:"THROW - IT RETURNS"},
      {k:"torch",own:hasTorch,ico:"e_item_torch",name:"TORCH",note:"BURNS INLAND TREES"},
      {k:"potion",own:hasPotion,ico:"e_item_potion",name:"POTION",note:"RESTORES ALL UPTIME"}];
    for(let i=0;i<slots.length;i++){
      const s=slots[i],yy=top+14+i*30,sel=equipped===s.k&&s.own;
      x.fillStyle=sel?PAL[3]:PAL[2];x.fillRect(12,yy,IW-24,26);
      if(sel){x.fillStyle=PAL[5];x.fillRect(12,yy,IW-24,1);x.fillRect(12,yy+25,IW-24,1)}
      const img=SPR[s.ico][0];
      if(s.own)drawSpr(x,img,20-img.width/2+8,yy+13-img.height/2);
      drawText(x,40,yy+6,s.name,s.own?(sel?7:6):15);
      drawText(x,40,yy+15,s.own?s.note:"NOT YET FOUND",s.own?10:15);
      if(sel)drawText(x,IW-40,yy+10,"USE X",9);
    }
    const foot=top+14+3*30+4;
    drawText(x,14,foot,"BITS "+bits,12);
    drawText(x,74,foot,"UPTIME "+(maxHp/2),14);
    drawText(x,140,foot,swordLvl>1?"LONG SWORD":"CRIMPER",swordLvl>1?42:6);
    drawText(x,IW/2-textW("X CYCLES - I CLOSES")/2,foot+10,"X CYCLES - I CLOSES",6);
  }
  /* ------------------------------------------------ loop + boot */
  function loop(ts){
    if(last==null)last=ts;
    const dt=Math.min(.05,(ts-last)/1000);last=ts;
    /* the item screen freezes the world exactly the way P does */
    if(itemsOpen)itemT=EGG_RM?1:Math.min(1,itemT+dt/.18);
    if(!paused&&!itemsOpen)update(dt);
    if(alive)draw();
    if(alive)egg6Anim=requestAnimationFrame(loop);
  }
  window.__eggDbg=window.__eggDbg6={game:"lost-display",
    state:()=>({state,mode,sx,sy,rx,ry,px,py,hp,maxHp,keys:keysN,bits,score,kills,facing,invuln,frozen,paused,alive,
      swing:!!swing,swCd,timeS,cerT,diedInDungeon,continues,ckpt,switchOn,bossDead,fortressSeen,moving,kt,hasPuck,twrF,caveI,caveR,
      musName:EggAudio.musicName?EggAudio.musicName():null,bossSeal,visited:visited.size,visitedR:visitedR.size,
      hasTorch,hasPotion,swordLvl,equipped,itemsOpen,mapId:mapId(),cleared:clearedMaps.size,
      trail:mapTrail.slice(),burnt:burnt.size,fires:fires.length,beams:beams.length,cells:maxHp/2,
      keysGot:Array.from(keysGot)}),
    enemies:()=>ens.map(e=>({type:e.type,x:e.x,y:e.y,hp:e.hp,st:e.st,dir:e.dir,sd:e.sd,sdT:e.sdT})),
    shots:()=>shots.slice(),eshots:()=>eshots.map(s=>({kind:s.kind,x:s.x,y:s.y,dmg:s.dmg,z:s.z})),
    drops:()=>drops.map(d=>({kind:d.kind,x:d.x,y:d.y,id:d.id||null})),
    traps:()=>({spikes:spikes.map(s=>({tx:s.tx,ty:s.ty,up:!!s.up})),
      arrows:arrows.map(a=>({tx:a.tx,ty:a.ty,fd:a.fd,cd:a.cd})),
      blades:blades.map(b=>({x:b.x,y:b.y,st:b.st})),
      crumbled:crumbled?crumbled.size:0,crumbleAt}),
    block:()=>block?{tx:block.x/TS,ty:block.y/TS,sliding:block.t>0}:null,
    boss:()=>boss?{hp:boss.hp,hits:boss.hits,st:boss.st,spd:boss.spd,beams:boss.beams,engaged:boss.engaged,x:boss.x,y:boss.y}:null,
    locks:()=>EARTH_LOCKS.map(L=>({id:L.rx+","+L.ry+","+L.side,kind:L.kind,
      active:L.kind==="key"?!unlocked.has(L.rx+","+L.ry+","+L.side):L.kind==="switch"?!switchOn:L.kind==="boss"?bossSeal:!bossDead})),
    warp:(wx,wy)=>{px=wx;py=wy;kx=ky=0;kt=0},
    goScreen:(a,b,wx,wy)=>{loadScreen(a,b);px=wx==null?120:wx;py=wy==null?80:wy;entryX=px;entryY=py;state="play"},
    goRoom:(a,b,wx,wy)=>{if(mode!=="dun")EggAudio.music("dungeon");loadRoom(a,b);px=wx==null?120:wx;py=wy==null?80:wy;entryX=px;entryY=py;state="play"},
    enterDungeon,exitDungeon,
    spawn:(t,wx,wy)=>spawnEnemy(t,wx,wy),
    clearEnemies:()=>{ens=[]},clearShots:()=>{eshots=[];shots=[]},
    setPeace:v=>{peace=!!v},setHp:(a,b)=>{hp=a;if(b)maxHp=b;hud()},
    give:w=>{if(w==="key"){keysN++}else if(w==="heart")hp=Math.min(maxHp,hp+2);else if(w==="wisp")hp=maxHp;hud()},
    setKeys:n=>{keysN=n;hud()},
    hurt:(n,fx,fy)=>hurt(n,fx==null?px+8:fx,fy==null?py:fy),
    strike,seed:n=>{rseed=n},
    pressBlock:()=>{},walkable:(wx,wy)=>walkable(wx,wy),
    tile:(ti,tj)=>tileCh(ti,tj),
    setBossDead:v=>{bossDead=!!v;boss=null;bossSeal=false},
    setSwitch:v=>{switchOn=!!v},
    skipCeremony:()=>{if(state==="ceremony")cerT=5.9},
    goCave:(i,r)=>{caveI=i;EggAudio.music("dungeon");loadCaveRoom(r||0);px=120;py=150;entryX=px;entryY=py;state="play"},
    goTower:f=>{EggAudio.music("dungeon");stairLock=null;loadFloor(f||0);px=120;py=150;entryX=px;entryY=py;state="play"},
    grantRanged:v=>{hasPuck=v!==false;if(hasPuck)autoEquip("puck")},hasRanged:()=>hasPuck,
    getMaxHearts:()=>maxHp/2,containers:()=>Array.from(containersGot),
    puckState:()=>puck?{x:puck.x,y:puck.y,st:puck.st}:null,
    xAction:()=>contextAction(),
    dmg:()=>({sword:dmgSword(),puck:dmgPuck(),base:SWORD_DMG,basePuck:PUCK_DMG,mult:LONG_MULT,swordLvl,reach:reach()}),
    caveState:()=>({i:caveI,r:caveR}),floor:()=>twrF,
    floats:()=>floats.map(f=>f.txt),
    /* ---------------- pass F test hooks ---------------- */
    /* bits + shop */
    getBits:()=>bits,setBits:n=>{bits=n|0;hud();return bits},
    prices:()=>Object.assign({},EPRICE),
    vendorAt:()=>Object.assign({},EVENDOR),
    goVendor:()=>{enterVendor();state="play"},
    stands:()=>SHOP_STOCK.map(s=>({kind:s.kind,tx:s.tx,x:s.tx*TS+8,y:SHOP_ROW*TS+14,price:EPRICE[s.kind]})),
    standHere:()=>{const s=nearStand();return s?s.kind:null},
    buy:kind=>{const b0=bits;buyItem(kind);return{bits,spent:b0-bits,owned:invOwned()}},
    shopMsg:()=>shopMsg?shopMsg.txt:null,
    /* inventory */
    items:()=>invOwned(),
    equipped:()=>equipped,
    setEquipped:k=>{if(k==="none"||ownedItems().includes(k))equipped=k;return equipped},
    cycleItem:()=>{cycleEquip(1);return equipped},
    itemsOpen:()=>itemsOpen,
    openItems:v=>{itemsOpen=v!==false;itemT=itemsOpen?(EGG_RM?1:0):0;return itemsOpen},
    useItem:()=>{useEquipped();return equipped},
    giveItem:k=>{if(k==="torch")hasTorch=true;else if(k==="potion")hasPotion=true;
      else if(k==="sword")swordLvl=2;else if(k==="puck")hasPuck=true;
      if(k!=="sword")autoEquip(k);hud();return invOwned()},
    takeItem:k=>{if(k==="torch")hasTorch=false;else if(k==="potion")hasPotion=false;
      else if(k==="sword")swordLvl=1;else if(k==="puck")hasPuck=false;
      if(!ownedItems().includes(equipped))equipped=ownedItems()[0]||"none";hud();return invOwned()},
    setSword:n=>{swordLvl=n>1?2:1;return swordLvl},
    /* torch + burnable trees */
    burnable:(tx,ty)=>burnableAt(tx,ty),
    boundaryTree:(tx,ty)=>boundaryTree(tx,ty),
    trees:()=>{const o=[];if(mode!=="ow")return o;
      for(let j=0;j<PH;j++)for(let i=0;i<PW;i++)if(map[j][i]==="t")o.push({tx:i,ty:j,burnable:burnableAt(i,j),boundary:boundaryTree(i,j)});
      return o},
    burnTree:(tx,ty)=>{const f0=fires.length;const sf=facing,ppx=px,ppy=py;
      /* aim the torch at the tile without moving the player for real */
      px=tx*TS+8;py=(ty+1)*TS+12;facing=1;
      const had=hasTorch;hasTorch=true;useTorch();hasTorch=had;
      px=ppx;py=ppy;facing=sf;
      return fires.length>f0},
    fires:()=>fires.map(f=>({tx:f.tx,ty:f.ty,t:f.t,cave:f.cave})),
    finishFires:()=>{for(const f of fires)f.t=99;updFires(0);return burntList()},
    burnt:()=>burntList(),
    burnCaves:()=>EBURN_CAVES.map((c,i)=>({index:5+i,sx:c.sx,sy:c.sy,tx:c.tx,ty:c.ty})),
    caveCount:()=>ECAVES.length,
    /* ---- pass G: the two overworld key caves ---- */
    keyCaves:()=>EKEY_CAVES.map((c,i)=>{
      const idx=EARTH_CAVES.length+EBURN_CAVES.length+i;
      return{index:idx,sx:c.sx,sy:c.sy,tx:c.tx,ty:c.ty,got:keysGot.has("cave"+idx)};
    }),
    keysGot:()=>Array.from(keysGot),
    /* BFS over the screen graph checkEdges() actually walks (openH/openV), so a
       test can prove a screen is reachable from the start and follow the route
       there one transition at a time. Returns [[sx,sy],…] or null. */
    owPath:(tsx,tsy)=>{
      const s0=EARTH_META.start.sx+","+EARTH_META.start.sy,goal=tsx+","+tsy;
      const prev={},seen=new Set([s0]),q=[[EARTH_META.start.sx,EARTH_META.start.sy]];
      while(q.length){
        const[a,b]=q.shift();
        for(const[na,nb]of[[a-1,b],[a+1,b],[a,b-1],[a,b+1]]){
          if(na<0||na>9||nb<0||nb>9)continue;
          if(na!==a&&EARTH_META.openH[b][Math.min(a,na)]!=="1")continue;
          if(nb!==b&&EARTH_META.openV[Math.min(b,nb)][a]!=="1")continue;
          const k=na+","+nb;
          if(seen.has(k))continue;
          seen.add(k);prev[k]=a+","+b;q.push([na,nb]);
        }
      }
      if(!seen.has(goal))return null;
      const path=[];
      for(let k=goal;;k=prev[k]){path.unshift(k.split(",").map(Number));if(k===s0)break}
      return path;
    },
    /* the beam */
    beams:()=>beams.map(b=>({x0:b.x0,y0:b.y0,x1:b.x1,y1:b.y1,dir:b.dir,ice:!!b.ice,t:b.t})),
    fireBeam:()=>{fireBeam();return beams[beams.length-1]},
    /* cleared-map state */
    mapId:()=>mapId(),
    cleared:()=>Array.from(clearedMaps),
    isCleared:id=>clearedMaps.has(id==null?mapId():id),
    trail:()=>mapTrail.slice(),
    mapWindow:()=>MAP_WINDOW,
    mapArmed:()=>mapArmed,
    setCleared:(id,v)=>{if(v===false)clearedMaps.delete(id);else clearedMaps.add(id);return Array.from(clearedMaps)},
    resetTrail:()=>{mapTrail=[];return mapTrail}};
  function invOwned(){return{puck:hasPuck,torch:hasTorch,potion:hasPotion,swordLvl,equipped,list:ownedItems()}}
  function burntList(){const o=[];burnt.forEach((ch,k)=>o.push({k,ch}));return o}
  loadScreen(sx,sy);
  entryX=px;entryY=py;
  visited.add(sx+","+sy);
  banner={txt:"THE LOST DISPLAY",sub:"FIND THE FORTRESS",t:0};
  EggAudio.music("overworld");
  EggAudio.missionStart();
  hud();
  egg6Anim=requestAnimationFrame(loop);
}

/* ==========================================================================
   easter egg 8: SOLAR CIRCUIT — Mercury. A pseudo-3D road racer, and the
   second egg that is not hand-drawn canvas: like Polaris-Man it runs on
   Phaser, code-split behind this function, so a page that never opens Mercury
   fetches neither the engine nor the artwork.

   The game is a port of Phaser3-Road (MIT — jamessimo/Phaser3-Road, itself a
   Phaser rendering of Jake Gordon's javascript-racer). It lives in
   `src/games/solar-road/`; provenance and licence are in
   `public/eggs/solar-road/ATTRIBUTION.md`.

   It replaced a hand-written canvas racer of the same name that stood here
   until Aug 2026. The engine is upstream's; everything you can see is not.
   The artwork is generated by `scripts/build-solar-road-art.mjs` (`pnpm
   images:road`) — Mercury's night side, and three Mersive hovercraft at five
   bank angles each — because upstream's own art is Phaser-branded down to the
   wordmark on the boot. The nine courses are generated too, from the seeds in
   `src/games/solar-road/tracks.ts`.

   `egg8Game` is the live handle and the single source of truth for "is the
   game up", which is what makes open/close/reopen idempotent: eggClose8 always
   destroys through the handle and nulls it, so a second close is a no-op and a
   reopen can never end up with two Phaser instances or two render loops.

   Audio stays with the site, unlike Polaris-Man: the upstream game ships no
   sound of its own, so EggAudio keeps the Mercury chiptune and the .egg-snd
   button keeps calling eggToggleMute() like every canvas egg. The one thing
   the game has to do is pump the sequencer — see the onTick note below.
   ========================================================================== */
let egg8Game=null,egg8Loading=false,egg8Return=null;

function eggOpen8(){
  const modal=document.getElementById("egg8");
  if(!modal)return;
  /* Remember where focus came from so closing can put it back. Mercury itself
     is a WebGL mesh and cannot hold focus, so what we restore is the a11y
     button or the map canvas the player activated from. */
  egg8Return=document.activeElement instanceof HTMLElement?document.activeElement:null;
  modal.style.display="flex";
  EggAudio.init();EggAudio.ambientStart();eggSyncMute();
  document.getElementById("egg8-key").innerHTML=renderKey([["↑ ↓ ← →","steer / throttle"],["Shift","boost"],["Enter","select"],["R","restart"],["M","mute"],["Esc","exit"]]);
  if(egg8Game||egg8Loading)return;
  egg8Loading=true;
  const mount=document.getElementById("egg8-mount");
  const status=document.getElementById("egg8-status");
  if(status)status.textContent="Loading Solar Circuit…";
  import("../../games/solar-road/index").then(m=>{
    egg8Loading=false;
    /* Closed again before the chunk arrived: honour that, do not pop a game
       open behind the user's back. */
    if(modal.style.display!=="flex"){if(status)status.textContent="";return}
    if(status)status.textContent="";
    egg8Game=m.mountSolarRoad(mount,{
      /* No music on Mercury, deliberately, since Aug 2026.
         
         Every other egg pumps the chiptune sequencer through `onTick`, and this
         one used to as well. It now carries an engine instead: a continuous
         drone whose pitch tracks the craft's speed, which is the one piece of
         feedback the player gets about how far up the speed ladder they are
         without taking their eyes off the trail. A track playing over that
         fights it for the same attention and tells them nothing.
         
         The mount option is untouched and every other caller still uses it, so
         restoring the track is putting these two lines back. */
      audio:{
        /* The scene owns when the engine runs, not the mount: it is silent under
           the starting lights and comes up on green. */
        engineOn:(on)=>on?EggAudio.engineStart():EggAudio.engineStop(),
        engine:(power)=>EggAudio.engineSet(power),
        boost:()=>EggAudio.boostPad(),
        boostFire:()=>EggAudio.boostFire(),
        countLight:(step)=>EggAudio.countLight(step),
        raceStart:()=>EggAudio.raceStart(),
        raceFinish:()=>EggAudio.raceFinish(),
      },
    });
  }).catch(err=>{
    egg8Loading=false;
    console.error("[solar-circuit] failed to load",err);
    if(status)status.textContent="Solar Circuit could not load. Check your connection and try again.";
  });
}

function eggClose8(){
  const modal=document.getElementById("egg8");
  if(modal)modal.style.display="none";
  if(egg8Game){egg8Game.destroy();egg8Game=null}
  egg8Loading=false;
  eggEndDismiss();EggAudio.ambientStop();EggAudio.musicStop();EggAudio.engineStop();
  const back=egg8Return;egg8Return=null;
  if(back&&back.isConnected)try{back.focus({preventScroll:true})}catch(e){}
}

/* ---------------------------------------------------------------- wiring ---
 * The overlay markup and the solar-system SVG carry inline handlers, and the
 * game-over overlay generates more at runtime. Module scope is not global
 * scope, so the handful of entry points get published on window explicitly.
 */
declare global {
  interface Window {
    [key: string]: any;
  }
}

/* NOTE: "egg9" is still absent here, and that is a pre-existing bug rather than
   a decision — Polaris-Man's modal gets no focus trap and no scroll lock. It is
   left alone deliberately: adding it changes that game's keyboard behaviour,
   which is outside the Mars change and untested here. Flagged in
   docs/mars-signal-siege-production-report.md. */
const OVERLAY_IDS = ["eggmenu", "egg", "egg2", "egg3", "egg4", "egg5", "egg6", "egg7", "egg8", "egg-mars"];

const overlays = () =>
  OVERLAY_IDS.map((id) => document.getElementById(id)).filter(Boolean) as HTMLElement[];

const isOpen = (el: HTMLElement) => el.style.display !== "none" && el.style.display !== "";

/**
 * Focus contract for the overlays.
 *
 * The games read the keyboard off `window`, so they work regardless of what is
 * focused — until you click one of the modal's own buttons (✕, mute, REPLAY).
 * Focus then sits on that button and the next Space or Enter re-fires it
 * instead of playing: the game looks like it has stopped responding. Clicking
 * anywhere in an overlay therefore hands focus back to the overlay itself.
 *
 * Openings happen through half a dozen paths (eggLaunch, each eggOpenN, replay
 * from the game-over card), all of which just assign `style.display`. Watching
 * the attribute catches every one of them without touching the game code.
 */
function initOverlayFocus() {
  let returnTo: HTMLElement | null = null;
  let bodyOverflow = "";

  const openOverlay = () => overlays().find(isOpen) ?? null;

  const sync = () => {
    const open = openOverlay();

    if (open) {
      if (!returnTo) {
        // first overlay of this session: remember where to send focus back to
        returnTo = document.activeElement as HTMLElement;
        bodyOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden"; // no scrolling the page behind
      }
      if (!open.contains(document.activeElement)) open.focus({ preventScroll: true });
      return;
    }

    if (returnTo) {
      document.body.style.overflow = bodyOverflow;
      if (returnTo.isConnected) returnTo.focus({ preventScroll: true });
      returnTo = null;
    }
  };

  for (const el of overlays()) {
    el.tabIndex = -1;
    el.style.outline = "none";

    /* A click on ✕ / mute / REPLAY leaves that button focused; take focus back
       so the next keypress reaches the game. */
    el.addEventListener("click", () => {
      if (isOpen(el) && document.activeElement !== el) el.focus({ preventScroll: true });
    });

    /* Keep Tab inside the open overlay. */
    el.addEventListener("keydown", (e) => {
      if (e.key !== "Tab") return;
      const focusable = el.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable.length) {
        e.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === el)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    });
  }

  const observer = new MutationObserver(sync);
  for (const el of overlays()) {
    observer.observe(el, { attributes: true, attributeFilter: ["style"] });
  }
  sync();
}

/**
 * Release held keys when the page loses focus.
 *
 * Every game tracks held keys in its own `keys` map, filled on keydown and
 * cleared on keyup. Hold a key, alt-tab away, release it over another window,
 * and the keyup never arrives — the key stays down forever. In Signal Jumper a
 * stuck ArrowDown latches `duck`, which zeroes horizontal movement while jump
 * keeps working: the game looks half-broken.
 *
 * Rather than reach into seven closures, synthesise the missing keyups. Each
 * game is already listening for them and will clear its own state.
 */
function initKeyRelease() {
  const held = new Map<string, string>(); // key -> code

  addEventListener("keydown", (e) => held.set(e.key, e.code), true);
  addEventListener("keyup", (e) => held.delete(e.key), true);

  const releaseAll = () => {
    if (!held.size) return;
    const pending = [...held];
    held.clear();
    for (const [key, code] of pending) {
      dispatchEvent(new KeyboardEvent("keyup", { key, code, bubbles: true }));
    }
  };

  addEventListener("blur", releaseAll);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) releaseAll();
  });
}

export function initEasterEggs() {
  Object.assign(window, {
    EggAudio,
    eggMenu,
    eggMenuClose,
    eggIntroSkip,
    eggBackToMenu,
    eggLaunch,
    eggDevBlip,
    eggToggleMute,
    eggEndDismiss,
    eggClose,
    eggClose2,
    eggClose3,
    eggClose4,
    eggClose5,
    eggClose6,
    eggClose7,
    eggClose8,
    eggCloseMars,
    eggMarsToggleMute,
  });

  /* Esc and M are already handled by the global egg-key listener further up;
     adding another here made Esc close the game *and* the Mission Control
     menu it had just returned to. */
  initOverlayFocus();
  initKeyRelease();
}
