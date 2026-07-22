'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const test=require('node:test');
const vm=require('node:vm');

const ROOT=path.resolve(__dirname,'..');
const schedulerSource=fs.readFileSync(path.join(ROOT,'assets/js/azaan-scheduler-v953.js'),'utf8');
const diagnosticsSource=fs.readFileSync(path.join(ROOT,'assets/js/runtime-diagnostics-v960.js'),'utf8');
const recoverySource=fs.readFileSync(path.join(ROOT,'assets/js/runtime-recovery-v959.js'),'utf8');
const serviceWorkerSource=fs.readFileSync(path.join(ROOT,'sw.js'),'utf8');
const html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
const preview=fs.readFileSync(path.join(ROOT,'preview.html'),'utf8');
const admin=fs.readFileSync(path.join(ROOT,'admin.html'),'utf8');
const controllerSource=html.match(/<script id="aslima-v925-exact-audio-cue-controller">([\s\S]*?)<\/script>/)[1];
const volumeSyncSource=html.match(/(function updateVolumeLabel\(\)\{[\s\S]*?)async function unlockAudio/)[1];
const backupValidationSource=admin.match(/(function isBackupClock\(value\)\{[\s\S]*?)function formatClock/)[1];

test('Doha voice maps every scheduled prayer to a local offline recording',()=>{
  for(const prayer of ['fajr','dhuhr','asr','maghrib','isha']){
    const file=`azaan-doha-${prayer}.mp3`;
    assert.ok(fs.existsSync(path.join(ROOT,'assets/audio',file)),`${file} must be bundled`);
    assert.match(html,new RegExp(`assets/audio/${file.replace('.', '\\.')}`));
    assert.match(serviceWorkerSource,new RegExp(`assets/audio/${file.replace('.', '\\.')}`));
  }
  assert.match(html,/function load\(id,token,prayer\)[\s\S]*?getAzaanVoiceUrl\(id,prayer\)/);
});

test('a stale Firebase voice cannot overwrite the tablet selection awaiting sync',()=>{
  const pendingSource=html.match(/(let pendingAzaanVoiceSync=[\s\S]*?)\n\nfunction getAzaanVoice/)[1];
  const saved=storage(new Map([['aslima_pending_azaan_voice','doha']]));
  const context={localStorage:saved,pendingAzaanVoiceAtStartup:'doha',normalizeAzaanVoiceId:value=>String(value||'doha').replace(/\s+/g,'').toLowerCase()};
  vm.runInNewContext(`${pendingSource};globalThis.result={stale:acceptRemoteAzaanVoice('azaan2'),matching:acceptRemoteAzaanVoice('doha'),stillPending:localStorage.getItem('aslima_pending_azaan_voice')};clearPendingAzaanVoiceSync('doha');`,context);
  assert.equal(context.result.stale,false);
  assert.equal(context.result.matching,true);
  assert.equal(context.result.stillPending,'doha');
  assert.equal(saved.getItem('aslima_pending_azaan_voice'),null);
  assert.match(html,/if\(!acceptRemoteAzaanVoice\(id\)\)return/);
});

test('Firebase permits only the six known voice IDs from the tablet',()=>{
  const rules=JSON.parse(fs.readFileSync(path.join(ROOT,'database.rules.json'),'utf8'));
  const voiceRule=rules.rules.aslima.devices.home.settings.muezzin['.write'];
  for(const id of ['doha','azaan1','azaan2','azaan3','azaan4','azaan5'])assert.match(voiceRule,new RegExp(`newData\\.val\\(\\) == '${id}'`));
  assert.match(voiceRule,/newData\.isString\(\)/);
  assert.doesNotMatch(voiceRule,/auth == null|\.write": true/);
});

test('phone admin recognizes Doha for selection, live sync, and backups',()=>{
  assert.match(admin,/AZAAN_VOICES=\{doha:\{id:'doha',name:'Doha, Qatar'/);
  assert.match(admin,/AZAAN_VOICE_ORDER=\['doha','azaan1','azaan2','azaan3','azaan4','azaan5'\]/);
  assert.match(admin,/muezzin:'doha'/);
  assert.match(admin,/if\(typeof settings\.muezzin!=='string'\|\|!AZAAN_VOICES\[settings\.muezzin\]\)/);
});

function storage(seed){
  const values=new Map(seed?Array.from(seed.entries()):[]);
  return {values,getItem:key=>values.has(key)?values.get(key):null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key)};
}

function schedulerHarness(sharedStorage){
  const listeners={document:[],window:[]};
  const audio={paused:true,ended:false,currentTime:0,addEventListener(){}};
  const localStorage=sharedStorage||storage();
  const document={hidden:false,documentElement:{dataset:{}},getElementById:id=>id==='athan'?audio:null,addEventListener:(...args)=>listeners.document.push(args)};
  const window={localStorage,document,timings:{Fajr:'05:00',Dhuhr:'13:00',Asr:'17:00',Maghrib:'20:00',Isha:'22:00'},ASLIMA_SCHEDULER_DISABLE_AUTOSTART:true,addEventListener:(...args)=>listeners.window.push(args),dispatchEvent(){}};
  const quietTimeout=(fn,ms)=>{const timer=setTimeout(fn,ms);timer.unref();return timer;};
  const quietInterval=(fn,ms)=>{const timer=setInterval(fn,ms);timer.unref();return timer;};
  const context={window,document,localStorage,CustomEvent:class{constructor(type,options){this.type=type;this.detail=options&&options.detail;}},console,setTimeout:quietTimeout,clearTimeout,setInterval:quietInterval,clearInterval,Date};
  vm.runInNewContext(schedulerSource,context,{filename:'azaan-scheduler-v953.js'});
  return {window,document,audio,localStorage,listeners,scheduler:window.ASLIMAAzaanScheduler,runAgain:()=>vm.runInNewContext(schedulerSource,context)};
}

class FakeElement{
  constructor(){this.listeners=new Map();this.classList={values:new Set(),toggle:(name,on)=>on?this.classList.values.add(name):this.classList.values.delete(name)};this.style={};this.dataset={};this.paused=true;this.ended=false;this.currentTime=0;this.duration=133;this.readyState=0;this.pauseCount=0;this.loadCount=0;this.src='';}
  addEventListener(type,fn){if(!this.listeners.has(type))this.listeners.set(type,new Set());this.listeners.get(type).add(fn);}
  removeEventListener(type,fn){if(this.listeners.has(type))this.listeners.get(type).delete(fn);}
  emit(type){for(const fn of Array.from(this.listeners.get(type)||[]))fn();}
  pause(){this.paused=true;this.pauseCount++;}
  load(){this.loadCount++;}
  removeAttribute(name){if(name==='src')this.src='';}
  play(){this.paused=false;return Promise.resolve();}
}

function controllerHarness(){
  const elements=new Map();
  ['athan','adhanOverlay','azaanDrawerTab','azaanArabic','azaanEnglish','overlayPrayer'].forEach(id=>elements.set(id,new FakeElement()));
  const body=new FakeElement(),root={dataset:{}};
  const document={body,documentElement:root,getElementById:id=>elements.get(id)||null};
  const localStorage=storage();
  const cancelled=[];let raf=0;
  const window={document,localStorage,AZAAN_VOICES:{azaan1:{id:'azaan1',url:'./assets/audio/azaan-1.mp3'}},normalizeAzaanVoiceId:()=> 'azaan1',resolveAzaanPrayer:p=>p||'Dhuhr',isAzaanEnabled:()=>true,bindAzaanAudioControls(){},bindAzaanVoiceControls(){},forceMuezzinUiSync(){},ASLIMAAzaanScheduler:{cancelOccurrence:(...args)=>{cancelled.push(args);return true;}}};
  const context={window,document,localStorage,navigator:{},console,showToast(){},azaanAudioFallbackGeneration:0,requestAnimationFrame:fn=>{raf++;return raf;},cancelAnimationFrame(){},setTimeout,clearTimeout};
  vm.runInNewContext(controllerSource,context,{filename:'inline-controller.js'});
  return {window,audio:elements.get('athan'),elements,body,cancelled};
}

function diagnosticsHarness(seed,storageOverride){
  const listeners={window:new Map(),document:new Map()};
  const localStorage=storageOverride||storage(seed);
  const on=(target,type,fn)=>{if(!listeners[target].has(type))listeners[target].set(type,[]);listeners[target].get(type).push(fn);};
  const document={hidden:false,visibilityState:'visible',documentElement:{dataset:{aslimaIntegration:'v961'}},addEventListener:(type,fn)=>on('document',type,fn)};
  const window={document,localStorage,addEventListener:(type,fn)=>on('window',type,fn)};
  vm.runInNewContext(diagnosticsSource,{window,document,localStorage,navigator:{onLine:true},console,Date,JSON,Object},{filename:'runtime-diagnostics-v960.js'});
  return {window,document,localStorage,listeners,emit:(target,type,event={})=>(listeners[target].get(type)||[]).forEach(fn=>fn(event))};
}

function recoveryHarness(options={}){
  const listeners={window:new Map(),document:new Map(),serviceWorker:new Map()},timeouts=[],intervals=[];
  const on=(target,type,fn)=>{if(!listeners[target].has(type))listeners[target].set(type,[]);listeners[target].get(type).push(fn);};
  const localStorage=storage(options.seed);
  const document={hidden:false,addEventListener:(type,fn)=>on('document',type,fn)};
  let reloads=0,updates=0,timingChecks=0,timingLoads=0,reconciles=0,healthPublishes=0;
  const window={document,localStorage,aslimaPlaybackState:{phase:options.phase||'idle'},ASLIMA_TIMING:{checkTimingLifecycle(){timingChecks++;},getState:()=>({runtimeStatus:options.timingStatus||'official'}),loadTimes:async()=>{timingLoads++;return true;}},ASLIMAAzaanScheduler:{state:{},reconcile:async()=>{reconciles++;return true;}},ASLIMADiagnostics:{record(){}},publishAslimaHealth:async()=>{healthPublishes++;return true;},addEventListener:(type,fn)=>on('window',type,fn),dispatchEvent(){}};
  const navigator={onLine:true,serviceWorker:{getRegistration:async()=>({update:async()=>{updates++;}}),addEventListener:(type,fn)=>on('serviceWorker',type,fn)}};
  const context={window,document,localStorage,navigator,location:{reload(){reloads++;}},CustomEvent:class{constructor(type,init){this.type=type;this.detail=init&&init.detail;}},Date,JSON,Object,Promise,setTimeout:fn=>{timeouts.push(fn);return timeouts.length;},clearTimeout(){},setInterval:fn=>{intervals.push(fn);return intervals.length;},clearInterval(){},console};
  vm.runInNewContext(recoverySource,context,{filename:'runtime-recovery-v959.js'});
  return {window,document,localStorage,listeners,timeouts,intervals,metrics:()=>({reloads,updates,timingChecks,timingLoads,reconciles,healthPublishes}),emit:(target,type,event={})=>(listeners[target].get(type)||[]).forEach(fn=>fn(event))};
}

const at=(hour,minute)=>new Date(2026,6,19,hour,minute,0,0);

test('manual playback for the same prayer never marks the automatic occurrence fired',async()=>{
  const h=schedulerHarness();
  const event=h.scheduler.eventsFor(at(13,0))[1];
  h.window.aslimaPlaybackState={phase:'playing',prayer:'Dhuhr',source:'local-test',occurrenceKey:''};
  h.audio.paused=false;
  await h.scheduler.reconcile(at(13,0),'test');
  assert.equal(h.scheduler.isFired(event),false);
  h.scheduler.stop();
});

test('Firebase test playback for the same prayer never marks the occurrence fired',async()=>{
  const h=schedulerHarness();
  const event=h.scheduler.eventsFor(at(13,0))[1];
  h.window.aslimaPlaybackState={phase:'playing',prayer:'Dhuhr',source:'phone-command',occurrenceKey:event.key};
  h.audio.paused=false;
  await h.scheduler.reconcile(at(13,0),'test');
  assert.equal(h.scheduler.isFired(event),false);
  h.scheduler.stop();
});

test('only exact matching automatic playback is marked fired',async()=>{
  const h=schedulerHarness();const event=h.scheduler.eventsFor(at(13,0))[1];
  h.window.aslimaPlaybackState={phase:'playing',prayer:'Dhuhr',source:'automatic-scheduler',occurrenceKey:event.key};h.audio.paused=false;
  await h.scheduler.reconcile(at(13,0),'test');assert.equal(h.scheduler.isFired(event),true);
});

test('scheduler passes the exact occurrence key to automatic playback',async()=>{
  const h=schedulerHarness();let options;
  h.window.playAzaan=async(_prayer,opts)=>{options=opts;h.audio.paused=false;h.window.aslimaPlaybackState={phase:'playing',prayer:'Dhuhr',source:opts.source,occurrenceKey:opts.occurrenceKey};return true;};
  await h.scheduler.reconcile(at(13,0),'test');
  assert.equal(options.occurrenceKey,'2026-07-19|Dhuhr|13:00');
  assert.equal(options.attemptGeneration,1);
});

test('dismissed automatic occurrence survives scheduler reload and next prayer remains eligible',async()=>{
  const shared=storage();const first=schedulerHarness(shared);const dhuhr=first.scheduler.eventsFor(at(13,0))[1];let release;
  first.window.playAzaan=()=>new Promise(resolve=>{release=resolve;});const pending=first.scheduler.reconcile(at(13,0),'automatic');
  const generation=first.scheduler.state.activeAttempt.attemptGeneration;assert.equal(first.scheduler.cancelOccurrence(dhuhr.key,generation,'stop'),true);release(false);await pending;assert.equal(first.scheduler.isDismissed(dhuhr),true);first.scheduler.stop();
  const second=schedulerHarness(shared);let played='';second.window.playAzaan=async prayer=>{played=prayer;second.audio.paused=false;second.window.aslimaPlaybackState={phase:'playing',prayer,source:'automatic-scheduler',occurrenceKey:second.scheduler.eventsFor(at(17,0))[2].key};return true;};
  await second.scheduler.reconcile(at(13,1),'reload');assert.equal(played,'');
  await second.scheduler.reconcile(at(17,0),'next');assert.equal(played,'Asr');
});

test('failed automatic load schedules retry unless dismissed',async()=>{
  const h=schedulerHarness();h.window.ASLIMA_SCHEDULER_NOW=()=>at(13,0);h.window.playAzaan=async()=>false;
  await h.scheduler.reconcile(at(13,0),'failure');assert.equal(h.scheduler.state.retryKey,'2026-07-19|Dhuhr|13:00');
  const generation=h.scheduler.state.activeAttempt.attemptGeneration;h.scheduler.cancelOccurrence(h.scheduler.state.retryKey,generation,'stop');assert.equal(h.scheduler.state.retryTimer,0);h.scheduler.stop();
});

test('duplicate reconcile calls do not produce concurrent playback',async()=>{
  const h=schedulerHarness();let calls=0,release;h.window.playAzaan=()=>{calls++;return new Promise(resolve=>{release=resolve;});};
  const first=h.scheduler.reconcile(at(13,0),'one');const second=h.scheduler.reconcile(at(13,0),'two');assert.equal(calls,1);release(false);await Promise.all([first,second]);h.scheduler.stop();
});

test('a stale in-flight automatic resolution cannot retry or mark a dismissed occurrence',async()=>{
  const h=schedulerHarness();h.window.ASLIMA_SCHEDULER_NOW=()=>at(13,0);let release;
  h.window.playAzaan=()=>new Promise(resolve=>{release=resolve;});
  const pending=h.scheduler.reconcile(at(13,0),'automatic');
  const key=h.scheduler.state.inFlightKey,generation=h.scheduler.state.activeAttempt.attemptGeneration;h.scheduler.cancelOccurrence(key,generation,'stop-before-persistence');release(true);
  assert.equal(await pending,false);assert.equal(h.scheduler.state.retryTimer,0);assert.equal(h.scheduler.isDismissed(key),true);assert.equal(h.scheduler.isFired({key,legacyKey:'Sun Jul 19 2026-Dhuhr'}),false);h.scheduler.stop();
});

test('duplicate scheduler evaluation and start do not duplicate listeners',()=>{
  const h=schedulerHarness();h.scheduler.start();const counts=[h.listeners.document.length,h.listeners.window.length];h.runAgain();h.scheduler.start();assert.deepEqual([h.listeners.document.length,h.listeners.window.length],counts);h.scheduler.stop();
});

test('controller records automatic source, occurrence, prayer, generation and phase',async()=>{
  const h=controllerHarness();h.audio.readyState=1;await h.window.playAzaan('Dhuhr',{source:'automatic-scheduler',occurrenceKey:'key'});
  assert.equal(h.window.aslimaPlaybackState.source,'automatic-scheduler');assert.equal(h.window.aslimaPlaybackState.occurrenceKey,'key');assert.equal(h.window.aslimaPlaybackState.prayer,'Dhuhr');assert.equal(h.window.aslimaPlaybackState.phase,'playing');assert.ok(h.window.aslimaPlaybackState.generation>0);
});

test('Stop during load removes listeners, clears timeout, dismisses occurrence and settles play',async()=>{
  const h=controllerHarness();h.audio.readyState=0;const pending=h.window.playAzaan('Dhuhr',{source:'automatic-scheduler',occurrenceKey:'key',attemptGeneration:17});h.window.stopAzaan();
  assert.equal(await pending,false);assert.deepEqual(h.cancelled[0],['key',17,'user-stop']);assert.equal(h.window.aslimaPlaybackState.pendingTimer,0);assert.equal(h.audio.listeners.get('canplay').size,0);assert.equal(h.audio.listeners.get('loadedmetadata').size,0);assert.equal(h.window.aslimaPlaybackState.phase,'idle');
});

test('Stop while play promise is pending prevents late continuation',async()=>{
  const h=controllerHarness();h.audio.readyState=1;let release;h.audio.play=()=>{h.audio.paused=false;return new Promise(resolve=>{release=resolve;});};
  const pending=h.window.playAzaan('Dhuhr',{source:'automatic-scheduler',occurrenceKey:'key'});await Promise.resolve();h.window.stopAzaan();release();assert.equal(await pending,false);assert.equal(h.audio.paused,true);assert.equal(h.body.classList.values.has('azaan-playing'),false);
});

test('repeated Stop always pauses and resets audio',()=>{
  const h=controllerHarness();h.audio.paused=false;h.audio.currentTime=42;const before=h.audio.pauseCount;h.window.stopAzaan();h.audio.paused=false;h.audio.currentTime=9;h.window.stopAzaan();assert.equal(h.audio.pauseCount,before+2);assert.equal(h.audio.currentTime,0);assert.equal(h.audio.paused,true);
});

test('manual playback Stop does not dismiss an automatic occurrence',async()=>{
  const h=controllerHarness();h.audio.readyState=1;await h.window.playAzaan('Dhuhr',{source:'local-test',force:true,occurrenceKey:'ignored'});h.window.stopAzaan();assert.equal(h.cancelled.length,0);
});

test('Stop while idle cannot dismiss an occurrence',()=>{
  const h=controllerHarness();assert.equal(h.window.stopAzaan(),true);assert.equal(h.cancelled.length,0);
});

test('stale play resolution cannot mutate the newer production playback session',async()=>{
  const h=controllerHarness();h.audio.readyState=1;let releaseFirst,calls=0;
  h.audio.play=()=>{h.audio.paused=false;calls++;return calls===1?new Promise(resolve=>{releaseFirst=resolve;}):Promise.resolve();};
  const first=h.window.playAzaan('Dhuhr',{source:'local-test',force:true});await Promise.resolve();
  const second=await h.window.playAzaan('Asr',{source:'local-test',force:true});assert.equal(second,true);h.audio.currentTime=19;const pauses=h.audio.pauseCount;
  releaseFirst();assert.equal(await first,false);assert.equal(h.audio.pauseCount,pauses);assert.equal(h.audio.currentTime,19);assert.equal(h.window.aslimaPlaybackState.prayer,'Asr');assert.equal(h.window.aslimaPlaybackState.phase,'playing');assert.equal(h.elements.get('adhanOverlay').classList.values.has('show'),true);
});

test('stale play rejection cannot mutate the newer production playback session',async()=>{
  const h=controllerHarness();h.audio.readyState=1;let rejectFirst,calls=0;
  h.audio.play=()=>{h.audio.paused=false;calls++;return calls===1?new Promise((_resolve,reject)=>{rejectFirst=reject;}):Promise.resolve();};
  const first=h.window.playAzaan('Dhuhr',{source:'local-test',force:true});await Promise.resolve();await h.window.playAzaan('Asr',{source:'local-test',force:true});h.audio.currentTime=23;const pauses=h.audio.pauseCount;
  rejectFirst(new Error('old failure'));assert.equal(await first,false);assert.equal(h.audio.pauseCount,pauses);assert.equal(h.audio.currentTime,23);assert.equal(h.window.aslimaPlaybackState.prayer,'Asr');assert.equal(h.window.aslimaPlaybackState.phase,'playing');assert.equal(h.elements.get('adhanOverlay').classList.values.has('show'),true);
});

test('obsolete production media error and ended callbacks cannot clear a newer session',async()=>{
  const h=controllerHarness();h.audio.readyState=1;await h.window.playAzaan('Dhuhr',{source:'local-test',force:true});
  const oldError=Array.from(h.audio.listeners.get('error'))[0],oldEnded=Array.from(h.audio.listeners.get('ended'))[0];
  await h.window.playAzaan('Asr',{source:'local-test',force:true});h.audio.ended=true;oldError();oldEnded();
  assert.equal(h.window.aslimaPlaybackState.prayer,'Asr');assert.equal(h.window.aslimaPlaybackState.phase,'playing');assert.equal(h.elements.get('adhanOverlay').classList.values.has('show'),true);
});

test('completed Azaan continues into the bundled post-Azaan dua with visual translation',async()=>{
  const h=controllerHarness();h.audio.readyState=1;
  await h.window.playAzaan('Dhuhr',{source:'local-test',force:true});
  h.audio.ended=true;h.audio.emit('ended');
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(h.window.aslimaPlaybackState.stage,'dua');
  assert.equal(h.window.aslimaPlaybackState.phase,'dua-playing');
  assert.match(h.audio.src,/dua-after-azaan\.wav$/);
  assert.match(h.elements.get('azaanArabic').textContent,/رَبَّ هَذِهِ الدَّعْوَةِ/);
  assert.match(h.elements.get('azaanEnglish').textContent,/Lord of this perfect call/);
  assert.equal(h.body.classList.values.has('azaan-playing'),true);
});

test('Stop cancels post-Azaan dua audio and closes the shared overlay',async()=>{
  const h=controllerHarness();h.audio.readyState=1;
  await h.window.playAzaan('Dhuhr',{source:'local-test',force:true});
  h.audio.ended=true;h.audio.emit('ended');await new Promise(resolve=>setImmediate(resolve));
  h.window.stopAzaan();
  assert.equal(h.window.aslimaPlaybackState.phase,'idle');
  assert.equal(h.window.aslimaPlaybackState.stage,'');
  assert.equal(h.audio.paused,true);
  assert.equal(h.audio.src,'');
  assert.equal(h.body.classList.values.has('azaan-playing'),false);
});

test('completed post-Azaan dua returns the playback controller to idle',async()=>{
  const h=controllerHarness();h.audio.readyState=1;
  await h.window.playAzaan('Dhuhr',{source:'local-test',force:true});
  h.audio.ended=true;h.audio.emit('ended');await new Promise(resolve=>setImmediate(resolve));
  h.audio.ended=true;h.audio.emit('ended');
  assert.equal(h.window.aslimaPlaybackState.phase,'idle');
  assert.equal(h.window.aslimaPlaybackState.stage,'');
  assert.equal(h.body.classList.values.has('azaan-playing'),false);
});

test('post-Azaan dua is bundled for offline service-worker playback',()=>{
  assert.match(html,/url:'\.\/assets\/audio\/dua-after-azaan\.wav'/);
  assert.match(serviceWorkerSource,/\.\/assets\/audio\/dua-after-azaan\.wav/);
  assert.match(serviceWorkerSource,/\(mp3\|ogg\|wav\)/);
});

test('Azaan and dua Arabic use the premium Naskh typography with a fitted dua layout',()=>{
  assert.match(html,/family=Noto\+Naskh\+Arabic:wght@400;500;600;700/);
  assert.match(html,/\.adhan-overlay \.azaan-arabic\{[\s\S]*?font-family:"Noto Naskh Arabic"/);
  assert.match(html,/\.adhan-overlay \.azaan-arabic\[data-azaan-cue="dua"\]\{[\s\S]*?font-size:clamp\(38px,4\.65vw,72px\)/);
  assert.match(html,/\.adhan-overlay \.azaan-english\[data-azaan-cue="dua"\]/);
});

test('cancelOccurrence requires the exact active key and scheduler generation',async()=>{
  const h=schedulerHarness();let release;h.window.playAzaan=()=>new Promise(resolve=>{release=resolve;});const pending=h.scheduler.reconcile(at(13,0),'automatic');
  const active=h.scheduler.state.activeAttempt,key=active.occurrenceKey,generation=active.attemptGeneration;
  assert.equal(h.scheduler.cancelOccurrence(key),false);assert.equal(h.scheduler.cancelOccurrence(key,generation+1,'stale'),false);assert.equal(h.scheduler.cancelOccurrence('2026-07-19|Asr|17:00',generation,'wrong'),false);assert.equal(h.scheduler.isDismissed(key),false);
  assert.equal(h.scheduler.cancelOccurrence(key,generation,'stop'),true);release(false);await pending;assert.equal(h.scheduler.isDismissed(key),true);h.scheduler.stop();
});

test('fired outcome takes precedence and normalizes contradictory dismissal',async()=>{
  const shared=storage();const h=schedulerHarness(shared);const event=h.scheduler.eventsFor(at(13,0))[1];h.audio.paused=false;
  h.window.playAzaan=async(_prayer,opts)=>{h.window.aslimaPlaybackState={phase:'playing',prayer:'Dhuhr',source:'automatic-scheduler',occurrenceKey:opts.occurrenceKey};return true;};
  await h.scheduler.reconcile(at(13,0),'automatic');assert.equal(h.scheduler.isFired(event),true);assert.equal(h.scheduler.cancelOccurrence(event.key,1,'late-stop'),false);
  const dismissedKey='aslima_azaan_scheduler_v953_dismissed';shared.setItem(dismissedKey,JSON.stringify({[event.key]:Date.now()}));assert.equal(h.scheduler.isDismissed(event),false);assert.equal(JSON.parse(shared.getItem(dismissedKey))[event.key],undefined);
  const reloaded=schedulerHarness(shared);let calls=0;reloaded.window.playAzaan=async()=>{calls++;return true;};await reloaded.scheduler.reconcile(at(13,0),'reload');assert.equal(calls,0);reloaded.scheduler.stop();
});

test('stale Stop generation cannot stop or dismiss the current production session',async()=>{
  const h=controllerHarness();h.audio.readyState=1;await h.window.playAzaan('Dhuhr',{source:'automatic-scheduler',occurrenceKey:'old',attemptGeneration:1});const oldGeneration=h.window.aslimaPlaybackState.generation;
  await h.window.playAzaan('Asr',{source:'automatic-scheduler',occurrenceKey:'current',attemptGeneration:2});assert.equal(h.window.stopAzaan(oldGeneration),false);assert.equal(h.window.aslimaPlaybackState.prayer,'Asr');assert.equal(h.cancelled.length,0);
});

test('tracked HTML disables legacy interval and local tests have explicit source',()=>{
  assert.doesNotMatch(html,/setInterval\(autoFireAzaan,30000\)/);assert.match(html,/source:'local-test'/);assert.match(html,/source:'phone-command'/);
});

test('unlock continuation is guarded by authoritative generation',()=>{
  assert.match(html,/controller\.isCurrent\(prepared\.generation\)/);assert.match(html,/beginPreparation\('unlock-preload'\)/);assert.match(html,/registerPending\(token,/);
});

test('Firebase command IDs are persisted before dispatch',()=>{
  const persist=html.indexOf("localStorage.setItem('aslima_last_remote_command',id)");const dispatch=html.indexOf("c.type==='testAzaan'");assert.ok(persist>0&&persist<dispatch);
});

test('Stop clears all playback metadata and restores idle overlay state',async()=>{
  const h=controllerHarness();h.audio.readyState=1;await h.window.playAzaan('Dhuhr',{source:'automatic-scheduler',occurrenceKey:'key'});h.window.stopAzaan();
  assert.deepEqual({phase:h.window.aslimaPlaybackState.phase,prayer:h.window.aslimaPlaybackState.prayer,source:h.window.aslimaPlaybackState.source,occurrenceKey:h.window.aslimaPlaybackState.occurrenceKey},{phase:'idle',prayer:'',source:'',occurrenceKey:''});
  assert.equal(h.elements.get('adhanOverlay').classList.values.has('show'),false);assert.equal(h.elements.get('azaanDrawerTab').style.visibility,'');
});

test('fresh HTML loads scheduler after playback API and service worker does not inject another',()=>{
  const sw=fs.readFileSync(path.join(ROOT,'sw.js'),'utf8'),tag='<script src="./assets/js/azaan-scheduler-v953.js?v=961"></script>';
  assert.equal((html.match(/assets\/js\/azaan-scheduler-v953\.js/g)||[]).length,1);assert.ok(html.indexOf('window.playAzaan=async function')<html.indexOf(tag));assert.doesNotMatch(sw,/const schedulerTag=/);assert.doesNotMatch(sw,/SCHEDULER_JS=/);assert.match(sw,/data-aslima-azaan-scheduler/);
});

test('index and preview remain byte-identical',()=>assert.equal(html,preview));

test('cross-tab lease permits only one automatic attempt for an occurrence',async()=>{
  const shared=storage(),first=schedulerHarness(shared),second=schedulerHarness(shared);
  let releaseFirst,secondCalls=0;
  first.window.playAzaan=()=>new Promise(resolve=>{releaseFirst=resolve;});
  second.window.playAzaan=async()=>{secondCalls++;return true;};
  const pending=first.scheduler.reconcile(at(13,0),'first-tab');
  await Promise.resolve();
  assert.equal(await second.scheduler.reconcile(at(13,0),'second-tab'),false);
  assert.equal(secondCalls,0);
  assert.equal(second.scheduler.state.retryKey,second.scheduler.eventsFor(at(13,0))[1].key);
  releaseFirst(false);
  await pending;
  first.scheduler.stop();second.scheduler.stop();
});

test('expired cross-tab lease is recoverable after a crashed tab',async()=>{
  const shared=storage();
  shared.setItem('aslima_azaan_scheduler_v953_lease',JSON.stringify({key:'2026-07-19|Dhuhr|13:00',owner:'crashed-tab',expiresAt:Date.now()-1}));
  const h=schedulerHarness(shared);let calls=0;
  h.window.playAzaan=async(prayer,opts)=>{calls++;h.audio.paused=false;h.window.aslimaPlaybackState={phase:'playing',prayer,source:opts.source,occurrenceKey:opts.occurrenceKey};return true;};
  assert.equal(await h.scheduler.reconcile(at(13,0),'recovery'),true);
  assert.equal(calls,1);
  assert.equal(shared.getItem('aslima_azaan_scheduler_v953_lease'),null);
  h.scheduler.stop();
});

test('v967 service-worker upgrade removes older caches and precaches runtime, discovery, and audio assets',async()=>{
  const source=fs.readFileSync(path.join(ROOT,'sw.js'),'utf8'),handlers={},deleted=[],precache=[],messages=[];let fallbackRefresh=null;
  const cache={addAll:async items=>precache.push(...items),put:async()=>{}};
  const caches={open:async()=>cache,keys:async()=>['aslima-v959-self-healing','aslima-v960-operational-alerts','aslima-v961-volume-sync'],delete:async key=>{deleted.push(key);return true;},match:async()=>null};
  const client={postMessage:value=>messages.push(value),url:'https://example.test/index.html?aslima_integrated=958',navigate:async()=>{}};
  const self={location:{origin:'https://example.test'},clients:{claim:async()=>{},matchAll:async()=>[client]},skipWaiting:async()=>{},addEventListener:(type,fn)=>{handlers[type]=fn;}};
  vm.runInNewContext(source,{self,caches,fetch:async()=>{throw new Error('offline');},URL,Headers,Response,setTimeout:fn=>{fallbackRefresh=fn;return 1;},clearTimeout,console},{filename:'sw.js'});
  let installWork;handlers.install({waitUntil:value=>{installWork=value;}});await installWork;
  let activateWork;handlers.activate({waitUntil:value=>{activateWork=value;}});await activateWork;
  assert.deepEqual(deleted,['aslima-v959-self-healing','aslima-v960-operational-alerts','aslima-v961-volume-sync']);
  assert.equal(messages.length,1);assert.equal(messages[0].type,'aslima-runtime-update');assert.equal(typeof fallbackRefresh,'function');
  for(let n=1;n<=5;n++)assert.ok(precache.includes(`./assets/audio/azaan-${n}.mp3`));
  assert.ok(precache.includes('./assets/js/azaan-scheduler-v953.js'));
  assert.ok(precache.includes('./assets/js/runtime-diagnostics-v960.js'));
  assert.ok(precache.includes('./assets/js/runtime-recovery-v959.js'));
  assert.ok(precache.includes('./assets/js/masjid-discovery-v962.js'));
  assert.ok(precache.includes('./data/vric-prayer-times.json'));
});

test('runtime diagnostics persist a bounded seven-day event history and survive malformed storage',()=>{
  const h=diagnosticsHarness(new Map([['aslima_runtime_diagnostics_v961','not-json']]));
  assert.equal(h.window.ASLIMADiagnostics.version,'961');
  for(let i=0;i<100;i++)h.window.ASLIMADiagnostics.record('test','event',{message:String(i)});
  const snapshot=h.window.ASLIMADiagnostics.snapshot();
  assert.equal(snapshot.entries.length,80);
  assert.equal(snapshot.entries.at(-1).detail.message,'99');
  assert.doesNotThrow(()=>JSON.parse(h.window.ASLIMADiagnostics.export()));
});

test('runtime diagnostics capture lifecycle, scheduler, network, and runtime failures without duplicate floods',()=>{
  const h=diagnosticsHarness();
  h.emit('window','offline');
  h.emit('window','offline');
  h.emit('window','error',{message:'test failure'});
  h.emit('window','unhandledrejection',{reason:new Error('test rejection')});
  h.emit('window','aslima:scheduler-state',{detail:{status:'armed',reason:'test',event:{prayer:'Asr',key:'2026-07-20|Asr|17:17'}}});
  const entries=h.window.ASLIMADiagnostics.snapshot().entries;
  assert.equal(entries.filter(entry=>entry.category==='network'&&entry.status==='offline').length,1);
  assert.ok(entries.some(entry=>entry.category==='runtime'&&entry.status==='error'));
  assert.ok(entries.some(entry=>entry.category==='runtime'&&entry.status==='unhandled-rejection'));
  assert.ok(entries.some(entry=>entry.category==='scheduler'&&entry.status==='armed'));
});

test('runtime diagnostics remain invisible, load before application code, and expose explicit clearing',()=>{
  const tag='<script src="./assets/js/runtime-diagnostics-v960.js?v=961"></script>';
  assert.ok(html.indexOf(tag)>0&&html.indexOf(tag)<html.indexOf('<style>'));
  assert.doesNotMatch(diagnosticsSource,/innerHTML|appendChild|createElement/);
  const h=diagnosticsHarness();h.window.ASLIMADiagnostics.record('test','clear-me');h.window.ASLIMADiagnostics.clear();
  assert.deepEqual(h.window.ASLIMADiagnostics.snapshot().entries,[]);
});

test('runtime diagnostics retain bounded in-memory history when localStorage writes fail',()=>{
  const values=new Map(),broken={getItem:key=>values.has(key)?values.get(key):null,setItem(){throw new Error('quota');},removeItem:key=>values.delete(key)};
  const h=diagnosticsHarness(null,broken);
  h.window.ASLIMADiagnostics.record('storage','fallback',{message:'retained'});
  const entries=h.window.ASLIMADiagnostics.snapshot().entries;
  assert.ok(entries.some(entry=>entry.category==='storage'&&entry.detail.message==='retained'));
});

test('operational summary reports only actionable issues from the last 24 hours',()=>{
  const old=Date.now()-25*60*60*1000;
  const seed=new Map([['aslima_runtime_diagnostics_v961',JSON.stringify([{at:old,category:'runtime',status:'error',detail:{message:'expired'}}])]]),h=diagnosticsHarness(seed);
  h.window.ASLIMADiagnostics.record('network','offline');
  h.window.ASLIMADiagnostics.record('lifecycle','hidden');
  h.window.ASLIMADiagnostics.record('runtime','error',{message:'private stack text'});
  h.window.ASLIMADiagnostics.record('recovery','partial',{message:'private recovery text'});
  const summary=h.window.ASLIMADiagnostics.summary();
  assert.equal(summary.issueCount,2);assert.equal(summary.windowHours,24);assert.ok(summary.sessionStartedAt>0);
  assert.equal(summary.lastIssue.category,'recovery');assert.equal(summary.lastIssue.status,'partial');
  assert.equal('detail' in summary.lastIssue,false);assert.doesNotMatch(JSON.stringify(summary),/private|stack/);
});

test('operational issue summary stays bounded during a long noisy run',()=>{
  const h=diagnosticsHarness();
  for(let index=0;index<200;index++)h.window.ASLIMADiagnostics.record('runtime','error',{message:'failure '+index});
  const summary=h.window.ASLIMADiagnostics.summary();
  assert.equal(summary.issueCount,80);assert.equal(summary.lastIssue.status,'error');
  assert.equal(h.window.ASLIMADiagnostics.snapshot().entries.length,80);
});

test('caught timing and Firebase failures are routed into persistent diagnostics',()=>{
  assert.match(html,/ASLIMADiagnostics\.record\('timings','unavailable'/);
  assert.match(html,/ASLIMADiagnostics\.record\('firebase','listener-error'/);
  assert.match(html,/ASLIMADiagnostics\.record\('firebase','initialization-error'/);
});

test('tablet volume changes update Firebase after the debounce and remain normalized',async()=>{
  let queued=null,payload=null;
  const audio={volume:.7,muted:false};
  const elements={volumePct:{textContent:''},drawerVolumePct:{textContent:''}};
  const window={aslimaRemoteRef:{child:key=>{assert.equal(key,'volume');return {set:async value=>{payload=value;}};}},ASLIMADiagnostics:{record(){}}};
  const context={window,audio,localStorage:storage(),showToast(){},$:id=>elements[id]||null,Date,setTimeout:fn=>{queued=fn;return 1;},clearTimeout(){}};
  vm.runInNewContext(`${volumeSyncSource};globalThis.setVolume=setVolume;`,context,{filename:'volume-sync-production.js'});
  context.setVolume(1.4);
  assert.equal(audio.volume,1);
  assert.equal(elements.volumePct.textContent,'100%');
  assert.ok(queued);
  await queued();
  assert.equal(payload,1);
  assert.doesNotMatch(volumeSyncSource,/updatedAt|\.update\(/);
});

test('remote volume application does not call tablet write-back and create a Firebase loop',()=>{
  const applyBlock=html.match(/function applyAslimaRemoteSettings\(data\)\{([\s\S]*?)function initAslimaFirebaseRemote/)[1];
  assert.match(applyBlock,/audio\.volume=Math\.max\(0,Math\.min\(1,data\.volume\)\)/);
  assert.doesNotMatch(applyBlock,/setVolume\(/);
  assert.doesNotMatch(applyBlock,/aslimaRemoteRef\.update/);
});

test('tablet health uses an isolated Firebase path and server-timestamped bounded heartbeat cadence',()=>{
  assert.match(html,/path: 'aslima\/devices\/home\/settings'/);
  assert.match(html,/statusPath: 'aslima\/devices\/home\/status\/display'/);
  assert.match(html,/aslimaHealthRef=firebase\.database\(\)\.ref\(window\.ASLIMA_REMOTE\.statusPath\)/);
  assert.match(html,/ref\('\.info\/connected'\)\.on\('value'/);
  assert.match(html,/snapshot\.val\(\)!==true/);
  assert.match(html,/onDisconnect\(\)\.update\(\{online:false,visible:false,lastSeen:firebase\.database\.ServerValue\.TIMESTAMP\}\)/);
  assert.match(html,/publishAslimaHealth\('firebase-connected'\)/);
  assert.match(html,/setInterval\(\(\)=>publishAslimaHealth\('heartbeat'\),60000\)/);
  assert.match(html,/lastSeen:firebase\.database\.ServerValue\.TIMESTAMP/);
});

test('phone health view reads only status and expires stale online heartbeats',()=>{
  assert.match(admin,/const STATUS_PATH='aslima\/devices\/home\/status\/display'/);
  assert.match(admin,/const statusRef=firebase\.database\(\)\.ref\(STATUS_PATH\)/);
  assert.match(admin,/statusRef\.on\('value'/);
  assert.match(admin,/health\.online!==false&&age<=150000/);
  assert.match(admin,/id="deviceHealth"/);
  assert.doesNotMatch(admin,/ref\(STATUS_PATH\)\.(?:set|update|remove)\(/);
});

test('phone admin keeps diagnostics secondary and removes manual Jumuah editing',()=>{
  assert.match(admin,/<details class="systemDetails" id="systemDetails">/);
  assert.match(admin,/id="systemSummaryState"/);
  assert.equal((admin.match(/class="tabBtn/g)||[]).length,3);
  assert.match(admin,/id="manualTimesCard" hidden/);
  assert.doesNotMatch(admin,/id="jumuahPage"|id="jum[123]"|Jumu’ah times updated/);
});

function backupValidator(){
  const context={PRAYERS:['Fajr','Sunrise','Dhuhr','Asr','Maghrib','Isha'],AZAAN:['Fajr','Dhuhr','Asr','Maghrib','Isha'],AZAAN_VOICES:{azaan1:{},azaan2:{},azaan3:{},azaan4:{},azaan5:{}},Number,Array,String,Error};
  vm.runInNewContext(`${backupValidationSource};globalThis.validateSettingsBackup=validateSettingsBackup;`,context,{filename:'backup-validator-production.js'});
  return context.validateSettingsBackup;
}

function validBackup(){return {schemaVersion:1,app:'aslima-display',settings:{mode:'vric',timings:{Fajr:'05:15',Sunrise:'06:30',Dhuhr:'13:34',Asr:'17:17',Maghrib:'20:35',Isha:'21:54'},jumuah:['1:45 PM','3:00 PM'],azaanEnabled:{Fajr:true,Dhuhr:true,Asr:true,Maghrib:true,Isha:true},volume:.7,muezzin:'azaan1'}}}

test('configuration backup validator accepts only the explicit safe settings schema',()=>{
  const validate=backupValidator(),input=validBackup();input.settings.command={type:'stopAzaan'};input.settings.diagnostics=['private'];input.extra='ignored';
  const result=validate(input);
  assert.deepEqual(Object.keys(result).sort(),['azaanEnabled','mode','muezzin','timings','volume']);
  assert.equal('jumuah' in result,false);
  assert.equal('command' in result,false);assert.equal('diagnostics' in result,false);
});

test('configuration restore rejects malformed, partial, unsafe, and nonchronological backups',()=>{
  const validate=backupValidator();
  for(const mutate of [
    value=>{value.schemaVersion=2;},
    value=>{delete value.settings.timings.Fajr;},
    value=>{value.settings.timings.Asr='25:10';},
    value=>{value.settings.timings.Dhuhr='04:00';},
    value=>{value.settings.azaanEnabled.Fajr='yes';},
    value=>{value.settings.volume=2;},
    value=>{value.settings.muezzin='remote-url';}
  ]){const value=validBackup();mutate(value);assert.throws(()=>validate(value));}
});

test('configuration restore is size-limited, confirmed, and updates only the settings reference',()=>{
  assert.match(admin,/file\.size>65536/);
  assert.match(admin,/window\.confirm\('Restore this backup and replace the current tablet settings\?'\)/);
  assert.match(admin,/await window\.ref\.update\(\{\.\.\.restored,updatedAt:/);
  assert.doesNotMatch(admin,/STATUS_PATH[\s\S]{0,200}restoreSettingsBackup/);
});

test('repeated lifecycle reconciliation does not register additional scheduler listeners',async()=>{
  const h=schedulerHarness();h.scheduler.start();
  const initial={document:h.listeners.document.length,window:h.listeners.window.length};
  for(let i=0;i<500;i++)await h.scheduler.reconcile(at(12,0),'soak-simulation');
  assert.deepEqual({document:h.listeners.document.length,window:h.listeners.window.length},initial);
  assert.equal(h.scheduler.state.inFlightKey,'');
  h.scheduler.stop();
});

test('calculated and manual modes hide missing congregation data while verified websites may expose it',()=>{
  assert.match(html,/function iqamahScheduleAvailable\(\)/);
  assert.match(html,/\['official','cached'\]\.includes\(timingDataset\.runtimeStatus\)/);
  assert.match(html,/function jumuahScheduleAvailable\(\)/);
  assert.match(html,/zone\.hidden=!jumuahVisible/);
  assert.match(html,/body\[data-iqamah-schedule="hidden"\] #prayerPanel \.iqamah-time/);
  assert.match(html,/body\[data-jumuah-schedule="hidden"\] #jumuahZone/);
  assert.match(html,/body\[data-iqamah-schedule="hidden"\] #prayerPanel \.ptime-group/);
});

test('VRIC mode keeps its verified Jumuah schedule visible',()=>{
  assert.match(html,/hasJumuah&&\(CONFIG\.timingSource==='vric'\|\|officialSelected\)/);
});

test('calculated failure falls back and unavailable state still permits Manual mode',()=>{
  assert.match(html,/try\{pos=await getDevicePosition\(\);\}catch\(locationError\)/);
  assert.match(html,/await syncAlAdhanByCity\(\);/);
  assert.match(html,/const hasCompleteManualSeed=\['Fajr','Dhuhr','Asr','Maghrib','Isha'\]\.every/);
  assert.match(html,/window\.aslimaRemoteManualTimings=hasCompleteManualSeed\?\{\.\.\.manual\}:null/);
  assert.match(html,/writeRemoteOptional\(hasCompleteManualSeed\?\{mode:'manual',timings:manual\}:\{mode:'manual'\}\)/);
  assert.match(html,/Phone timing sync unavailable; local tablet change remains active/);
  assert.match(html,/const localGuardActive=localSelectedAt>0&&\(localPreview\|\|Date\.now\(\)-localSelectedAt<15000\)/);
  assert.match(html,/const preserveLocalMode=localGuardActive&&data\.mode&&data\.mode!==CONFIG\.timingSource/);
  assert.match(html,/if\(!localGuardActive\)CONFIG\.localTimingSelectedAt=0/);
  assert.match(html,/await writeRemote\(payload\);CONFIG\.localTimingSelectedAt=0/);
  assert.match(html,/else if\(!preserveLocalMode&&\(data\.mode==='vric' \|\| data\.mode==='calculated-location'\)\)/);
});

test('admin remote uses Google authentication and contains no reusable PIN bypass',()=>{
  assert.match(admin,/firebase-auth-compat\.js/);
  assert.match(admin,/const AUTHORIZED_ADMIN_EMAIL='aslima0531@gmail\.com'/);
  assert.match(admin,/auth\.signInWithPopup\(provider\)/);
  assert.match(admin,/auth\.onAuthStateChanged\(async user=>/);
  assert.doesNotMatch(admin,/7860|aslima_admin_unlocked|Enter admin PIN/);
});

test('Firebase database listeners initialize only after the exact admin account is authorized',()=>{
  const authStart=admin.indexOf('function isAuthorizedAdmin(user)');
  const initStart=admin.indexOf('function initializeAuthorizedRemote()');
  const observerStart=admin.indexOf('auth.onAuthStateChanged(async user=>');
  assert.ok(authStart>0&&initStart>authStart&&observerStart>initStart);
  assert.match(admin,/user\.email\.toLowerCase\(\)===AUTHORIZED_ADMIN_EMAIL/);
  assert.match(admin,/if\(user&&!isAuthorizedAdmin\(user\)\)[\s\S]*?await auth\.signOut\(\)/);
  assert.match(admin,/if\(!user\)[\s\S]*?return;[\s\S]*?initializeAuthorizedRemote\(\)/);
  assert.equal((admin.match(/firebase\.database\(\)\.ref\(PATH\)/g)||[]).length,1);
});

test('admin sign-out detaches settings, voice, and health listeners',()=>{
  assert.match(admin,/function disconnectRemote\(\)\{if\(window\.statusRef\)window\.statusRef\.off\(\);if\(window\.voiceRef\)window\.voiceRef\.off\(\);if\(window\.ref\)window\.ref\.off\(\)/);
  assert.match(admin,/\$\('signOut'\)\.onclick=\(\)=>auth\.signOut\(\)/);
  assert.doesNotMatch(admin,/addEventListener\('input',pushVolume\)/);
});

test('database rules protect settings writes while preserving required tablet access',()=>{
  const rules=JSON.parse(fs.readFileSync(path.join(ROOT,'database.rules.json'),'utf8')).rules;
  const home=rules.aslima.devices.home;
  assert.equal(rules['.read'],false);assert.equal(rules['.write'],false);
  assert.equal(home.settings['.read'],true);
  assert.match(home.settings['.write'],/auth != null/);
  assert.match(home.settings['.write'],/auth\.token\.email == 'aslima0531@gmail\.com'/);
  assert.match(home.settings.volume['.write'],/newData\.isNumber\(\)/);
  assert.match(home.settings.volume['.write'],/newData\.val\(\) >= 0/);
  assert.match(home.settings.volume['.write'],/newData\.val\(\) <= 1/);
  assert.deepEqual(Object.keys(home.settings).sort(),['.read','.write','muezzin','volume']);
  assert.match(home.status.display['.read'],/auth\.token\.email/);
  assert.equal(home.status.display['.write'],true);
});

test('recovery coordinator performs soft wake and network recovery without duplicating listeners',async()=>{
  const h=recoveryHarness({timingStatus:'unavailable'});
  const initial={window:Array.from(h.listeners.window.values()).flat().length,document:Array.from(h.listeners.document.values()).flat().length,serviceWorker:Array.from(h.listeners.serviceWorker.values()).flat().length};
  for(let index=0;index<200;index++)await h.window.ASLIMARecovery.softRecover('soak-cycle');
  assert.deepEqual({window:Array.from(h.listeners.window.values()).flat().length,document:Array.from(h.listeners.document.values()).flat().length,serviceWorker:Array.from(h.listeners.serviceWorker.values()).flat().length},initial);
  const metrics=h.metrics();assert.equal(metrics.timingChecks,200);assert.equal(metrics.timingLoads,200);assert.equal(metrics.reconciles,200);assert.equal(metrics.updates,200);
  assert.equal(h.window.ASLIMARecovery.snapshot().status,'healthy');
});

test('unavailable prayer timings receive a bounded periodic recovery attempt',async()=>{
  const h=recoveryHarness({timingStatus:'unavailable'});assert.equal(h.intervals.length,1);
  h.intervals[0]();for(let index=0;index<6;index++)await Promise.resolve();
  const first=h.metrics();assert.equal(first.timingLoads,1);assert.equal(first.reconciles,1);
  h.intervals[0]();for(let index=0;index<6;index++)await Promise.resolve();
  assert.equal(h.metrics().timingLoads,1);
});

test('safe reload waits for playback to become idle and persists its loop guard before reload',()=>{
  const h=recoveryHarness({phase:'playing'});
  assert.equal(h.window.ASLIMARecovery.requestReload('phone-command'),false);
  assert.equal(h.window.ASLIMARecovery.snapshot().status,'waiting-for-idle');assert.equal(h.timeouts.length,0);
  h.window.aslimaPlaybackState.phase='idle';h.emit('window','aslima:playback-state');
  assert.equal(h.window.ASLIMARecovery.snapshot().status,'reloading');assert.equal(h.timeouts.length,1);
  const persisted=JSON.parse(h.localStorage.getItem('aslima_runtime_recovery_v959'));assert.equal(persisted.reloads.length,1);assert.equal(persisted.lastReason,'phone-command');
  h.timeouts[0]();assert.equal(h.metrics().reloads,1);
});

test('recovery reload guard blocks loops after two reloads in six hours',()=>{
  const now=Date.now(),seed=new Map([['aslima_runtime_recovery_v959',JSON.stringify({reloads:[now-40*60*1000,now-31*60*1000]})]]),h=recoveryHarness({seed});
  assert.equal(h.window.ASLIMARecovery.requestReload('loop-test'),false);
  assert.equal(h.window.ASLIMARecovery.snapshot().status,'reload-cooldown');assert.equal(h.timeouts.length,0);assert.equal(h.metrics().reloads,0);
});

test('Phase 11 reports recovery health and handles only deduplicated safe reload commands',()=>{
  assert.match(html,/recoveryStatus:recovery\.status\|\|'starting'/);
  assert.match(html,/lastRecoveryAt:Number\(recovery\.lastRecoveryAt\)\|\|0/);
  const persist=html.indexOf("localStorage.setItem('aslima_last_remote_command',id)");const reload=html.indexOf("c.type==='reloadDisplay'");assert.ok(persist>0&&reload>persist);
  assert.match(admin,/id="reloadDisplay"/);assert.match(admin,/command\('reloadDisplay'\)/);assert.match(admin,/id="healthRecovery"/);
  assert.match(admin,/Reload waits until Azaan playback is idle/);
});

test('Phase 12 heartbeat exposes only bounded operational summary fields',()=>{
  assert.match(html,/runtimeIssueCount:Math\.max\(0,Number\(diagnostics\.issueCount\)\|\|0\)/);
  assert.match(html,/lastRuntimeIssueCategory:String\(lastIssue\.category\|\|''\)\.slice\(0,40\)/);
  assert.match(html,/lastRuntimeIssueStatus:String\(lastIssue\.status\|\|''\)\.slice\(0,40\)/);
  assert.doesNotMatch(html,/lastRuntimeIssueDetail|diagnostics\.entries/);
  assert.match(admin,/id="healthUptime"/);assert.match(admin,/id="healthIssues"/);assert.match(admin,/id="healthLastIssue"/);
  assert.match(admin,/attention=online&&\(issueCount>0\|\|health\.timingStatus==='unavailable'/);
});
