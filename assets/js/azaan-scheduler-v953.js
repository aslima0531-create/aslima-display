/* ASLIMA v9.1.53 — reliable automatic Azaan scheduler.
   Replaces exact-minute polling with timestamp-based reconciliation.
   It records an event only after actual playback starts. */
(function(){
  'use strict';

  const VERSION='9.1.53';
  const PRAYERS=['Fajr','Dhuhr','Asr','Maghrib','Isha'];
  const FIRED_KEY='aslima_azaan_scheduler_v953_fired';
  const DISMISSED_KEY='aslima_azaan_scheduler_v953_dismissed';
  const LEGACY_FIRED_KEY='aslima_last_fired_azaan';
  const GRACE_MS=3*60*1000;
  const EARLY_TOLERANCE_MS=1200;
  const WATCHDOG_MS=30000;
  const BUSY_RETRY_MS=5000;
  const FAILURE_RETRY_MS=[10000,30000,60000];
  const MAX_TIMER_MS=2147480000;

  if(window.ASLIMAAzaanScheduler&&window.ASLIMAAzaanScheduler.version===VERSION)return;

  const state={
    started:false,
    stopped:false,
    listenersBound:false,
    exactTimer:0,
    watchdogTimer:0,
    retryTimer:0,
    retryKey:'',
    retryGeneration:0,
    inFlightKey:'',
    attemptGeneration:0,
    activeAttempt:null,
    attempts:Object.create(null),
    nextEvent:null,
    lastSignature:'',
    lastReason:'',
    lastReconcileAt:0,
    lastPlaybackAt:0
  };

  function nowValue(override){
    if(override instanceof Date)return new Date(override.getTime());
    if(typeof override==='number')return new Date(override);
    if(typeof window.ASLIMA_SCHEDULER_NOW==='function'){
      const supplied=window.ASLIMA_SCHEDULER_NOW();
      return supplied instanceof Date?new Date(supplied.getTime()):new Date(supplied);
    }
    return new Date();
  }

  function pad(n){return String(n).padStart(2,'0');}
  function dateKey(date){return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`;}
  function legacyDateKey(date){return date.toDateString();}

  function parseTime(value){
    const raw=String(value==null?'':value).trim();
    const match=raw.match(/^(\d{1,2}):(\d{2})(?:\s*([AaPp][Mm]))?$/);
    if(!match)return NaN;
    let hour=Number(match[1]);
    const minute=Number(match[2]);
    const ap=(match[3]||'').toUpperCase();
    if(!Number.isInteger(hour)||!Number.isInteger(minute)||minute<0||minute>59)return NaN;
    if(ap){
      if(hour<1||hour>12)return NaN;
      if(hour===12)hour=0;
      if(ap==='PM')hour+=12;
    }else if(hour<0||hour>23){
      return NaN;
    }
    return hour*60+minute;
  }

  function getTimings(){
    try{if(typeof timings!=='undefined'&&timings&&typeof timings==='object')return timings;}catch(_error){}
    if(window.timings&&typeof window.timings==='object')return window.timings;
    return null;
  }

  function prayerEnabled(prayer){
    try{if(typeof isAzaanEnabled==='function')return isAzaanEnabled(prayer)!==false;}catch(_error){}
    if(typeof window.isAzaanEnabled==='function')return window.isAzaanEnabled(prayer)!==false;
    return true;
  }

  function eventFor(date,prayer,value){
    const minuteOfDay=parseTime(value);
    if(!Number.isFinite(minuteOfDay))return null;
    const when=new Date(date.getFullYear(),date.getMonth(),date.getDate(),Math.floor(minuteOfDay/60),minuteOfDay%60,0,0);
    const timeText=`${pad(Math.floor(minuteOfDay/60))}:${pad(minuteOfDay%60)}`;
    return {
      prayer,
      timeText,
      at:when.getTime(),
      dateKey:dateKey(date),
      key:`${dateKey(date)}|${prayer}|${timeText}`,
      legacyKey:`${legacyDateKey(date)}-${prayer}`
    };
  }

  function eventsFor(date){
    const source=getTimings();
    if(!source)return [];
    return PRAYERS.map(prayer=>eventFor(date,prayer,source[prayer])).filter(Boolean).sort((a,b)=>a.at-b.at);
  }

  function signature(events){return events.map(e=>`${e.prayer}:${e.timeText}`).join('|');}

  function readFired(){
    try{
      const parsed=JSON.parse(localStorage.getItem(FIRED_KEY)||'{}');
      return parsed&&typeof parsed==='object'&&!Array.isArray(parsed)?parsed:{};
    }catch(_error){return {};}
  }

  function writeFired(map){
    const cutoff=Date.now()-4*24*60*60*1000;
    Object.keys(map).forEach(key=>{if(!Number.isFinite(Number(map[key]))||Number(map[key])<cutoff)delete map[key];});
    try{localStorage.setItem(FIRED_KEY,JSON.stringify(map));}catch(_error){}
  }

  function firedByKey(key){return !!(key&&readFired()[key]);}

  function readDismissed(){
    try{
      const parsed=JSON.parse(localStorage.getItem(DISMISSED_KEY)||'{}');
      return parsed&&typeof parsed==='object'&&!Array.isArray(parsed)?parsed:{};
    }catch(_error){return {};}
  }

  function writeDismissed(map){
    const cutoff=Date.now()-4*24*60*60*1000;
    Object.keys(map).forEach(key=>{if(!Number.isFinite(Number(map[key]))||Number(map[key])<cutoff)delete map[key];});
    try{localStorage.setItem(DISMISSED_KEY,JSON.stringify(map));}catch(_error){}
  }

  function isDismissed(eventOrKey){
    const key=typeof eventOrKey==='string'?eventOrKey:eventOrKey&&eventOrKey.key;
    if(!key)return false;
    const dismissed=readDismissed();
    if(firedByKey(key)&&dismissed[key]){delete dismissed[key];writeDismissed(dismissed);return false;}
    return !!dismissed[key];
  }

  function isFired(event){
    const map=readFired();
    if(map[event.key])return true;
    try{if((localStorage.getItem(LEGACY_FIRED_KEY)||'')===event.legacyKey)return true;}catch(_error){}
    return false;
  }

  function markFired(event,reason){
    const map=readFired();
    map[event.key]=nowValue().getTime();
    writeFired(map);
    const dismissed=readDismissed();
    if(dismissed[event.key]){delete dismissed[event.key];writeDismissed(dismissed);}
    try{localStorage.setItem(LEGACY_FIRED_KEY,event.legacyKey);}catch(_error){}
    delete state.attempts[event.key];
    if(state.activeAttempt&&state.activeAttempt.occurrenceKey===event.key)state.activeAttempt=null;
    state.lastPlaybackAt=Date.now();
    setStatus('played',reason||event.prayer,event);
    try{window.dispatchEvent(new CustomEvent('aslima:scheduled-azaan-started',{detail:{version:VERSION,event,reason:reason||'scheduled'}}));}catch(_error){}
  }

  function setStatus(status,reason,event){
    state.lastReason=reason||'';
    const root=document.documentElement;
    root.dataset.azaanScheduler=status;
    root.dataset.azaanSchedulerVersion=VERSION;
    if(event){root.dataset.azaanSchedulerPrayer=event.prayer;root.dataset.azaanSchedulerEvent=event.key;}
    try{window.dispatchEvent(new CustomEvent('aslima:scheduler-state',{detail:{status,reason:reason||'',event:event||null,version:VERSION}}));}catch(_error){}
  }

  function showMessage(text){
    try{if(typeof showToast==='function'){showToast(text);return;}}catch(_error){}
    try{if(typeof window.showToast==='function')window.showToast(text);}catch(_error){}
  }

  function playbackState(){
    const p=window.aslimaPlaybackState;
    if(!p||typeof p!=='object')return {phase:'idle',prayer:'',source:'',occurrenceKey:''};
    return {phase:String(p.phase||'idle'),prayer:String(p.prayer||''),source:String(p.source||''),occurrenceKey:String(p.occurrenceKey||'')};
  }

  function audioIsActuallyPlaying(){
    const audio=document.getElementById('athan');
    return !!(audio&&!audio.paused&&!audio.ended&&audio.currentTime>=0);
  }

  function clearExactTimer(){if(state.exactTimer){clearTimeout(state.exactTimer);state.exactTimer=0;}}
  function clearRetryTimer(){if(state.retryTimer)clearTimeout(state.retryTimer);state.retryTimer=0;state.retryKey='';state.retryGeneration=0;}

  function scheduleRetry(delay,reason,event,generation){
    clearRetryTimer();
    if(state.stopped)return;
    const key=event&&event.key||'';
    state.retryKey=key;
    state.retryGeneration=Number(generation)||0;
    if(key&&state.activeAttempt&&state.activeAttempt.occurrenceKey===key&&state.activeAttempt.attemptGeneration===state.retryGeneration)state.activeAttempt.status='awaiting-retry';
    state.retryTimer=setTimeout(()=>{
      state.retryTimer=0;
      const retryKey=state.retryKey,retryGeneration=state.retryGeneration;
      state.retryKey='';state.retryGeneration=0;
      if(state.stopped)return;
      if(!retryKey){reconcile(undefined,reason||'retry');return;}
      if(isDismissed(retryKey))return;
      if(retryGeneration&&retryGeneration!==state.attemptGeneration)return;
      const currentEvent=eventsFor(nowValue()).find(item=>item.key===retryKey);
      if(!currentEvent||isFired(currentEvent))return;
      reconcile(undefined,reason||'retry');
    },Math.max(0,delay));
  }

  function armNext(now,events){
    clearExactTimer();
    if(state.stopped)return;
    const current=now.getTime();
    const next=events.find(event=>event.at>current+EARLY_TOLERANCE_MS&&!isFired(event));
    state.nextEvent=next||null;
    let delay;
    if(next){
      delay=Math.max(0,next.at-current);
      setStatus('armed',`Next: ${next.prayer}`,next);
    }else{
      const midnight=new Date(now.getFullYear(),now.getMonth(),now.getDate()+1,0,0,4,0);
      delay=Math.max(1000,midnight.getTime()-current);
      setStatus('waiting','No remaining prayer today',null);
    }
    state.exactTimer=setTimeout(()=>{state.exactTimer=0;reconcile(undefined,'exact-timer');},Math.min(delay,MAX_TIMER_MS));
  }

  function candidateFor(now,events){
    const current=now.getTime();
    return events.filter(event=>{
      if(!prayerEnabled(event.prayer)||isFired(event)||isDismissed(event))return false;
      return current>=event.at-EARLY_TOLERANCE_MS&&current<=event.at+GRACE_MS;
    }).sort((a,b)=>a.at-b.at)[0]||null;
  }

  async function attemptPlayback(event,reason){
    if(state.inFlightKey)return false;
    const playback=playbackState();
    if(playback.phase==='playing'&&playback.source==='automatic-scheduler'&&playback.occurrenceKey===event.key&&playback.prayer.toLowerCase()===event.prayer.toLowerCase()&&audioIsActuallyPlaying()){
      markFired(event,'already-playing');
      return true;
    }
    if(['loading','playing','paused','stopping'].includes(playback.phase)){
      setStatus('deferred',`Audio busy: ${playback.phase}`,event);
      scheduleRetry(BUSY_RETRY_MS,'audio-busy',event,0);
      return false;
    }
    if(typeof window.playAzaan!=='function'){
      setStatus('error','Azaan controller unavailable',event);
      scheduleRetry(FAILURE_RETRY_MS[0],'controller-unavailable',event,0);
      return false;
    }

    state.inFlightKey=event.key;
    const generation=++state.attemptGeneration;
    state.activeAttempt={occurrenceKey:event.key,attemptGeneration:generation,status:'loading',event};
    const attempt=(state.attempts[event.key]||0)+1;
    state.attempts[event.key]=attempt;
    setStatus('starting',`${event.prayer} attempt ${attempt}`,event);
    let started=false;
    try{
      started=await window.playAzaan(event.prayer,{source:'automatic-scheduler',scheduledAt:event.at,occurrenceKey:event.key,attemptGeneration:generation});
    }catch(error){
      console.error('Scheduled Azaan failed',error);
      started=false;
    }finally{
      if(generation===state.attemptGeneration&&state.inFlightKey===event.key)state.inFlightKey='';
    }

    if(generation!==state.attemptGeneration||state.stopped||isDismissed(event))return false;

    if(started===true&&(audioIsActuallyPlaying()||playbackState().phase==='playing')){
      if(state.activeAttempt&&state.activeAttempt.attemptGeneration===generation)state.activeAttempt.status='playing';
      markFired(event,reason||'scheduled');
      return true;
    }

    const now=nowValue().getTime();
    const stillInWindow=now<=event.at+GRACE_MS;
    if(stillInWindow&&attempt<=FAILURE_RETRY_MS.length){
      const delay=FAILURE_RETRY_MS[Math.min(attempt-1,FAILURE_RETRY_MS.length-1)];
      setStatus('retrying',`Playback failed; retry ${attempt}`,event);
      if(attempt===1)showMessage(`${event.prayer} Azaan could not start — retrying`);
      scheduleRetry(delay,'playback-retry',event,generation);
    }else{
      if(state.activeAttempt&&state.activeAttempt.attemptGeneration===generation)state.activeAttempt=null;
      setStatus('error',`${event.prayer} Azaan did not start`,event);
      showMessage(`${event.prayer} Azaan could not play`);
    }
    return false;
  }

  async function reconcile(nowOverride,reason){
    if(state.stopped)return false;
    const now=nowValue(nowOverride);
    state.lastReconcileAt=Date.now();
    const events=eventsFor(now);
    const sig=`${dateKey(now)}|${signature(events)}`;
    if(sig!==state.lastSignature){state.lastSignature=sig;clearExactTimer();}

    if(!events.length){
      setStatus('waiting','Prayer times unavailable',null);
      scheduleRetry(15000,'times-unavailable');
      return false;
    }

    const candidate=candidateFor(now,events);
    if(candidate){
      const result=await attemptPlayback(candidate,reason||'reconcile');
      // A pending busy/failure retry owns the near-term schedule. Do not replace
      // its diagnostic state or timer with the next-prayer arm operation.
      if(result||!state.retryTimer)armNext(nowValue(),eventsFor(nowValue()));
      return result;
    }

    armNext(now,events);
    return false;
  }

  function onLifecycle(reason){
    if(state.stopped)return;
    setTimeout(()=>reconcile(undefined,reason),50);
  }

  function start(){
    if(state.started&&!state.stopped)return;
    state.started=true;
    state.stopped=false;
    clearInterval(state.watchdogTimer);
    state.watchdogTimer=setInterval(()=>reconcile(undefined,'watchdog'),WATCHDOG_MS);
    if(!state.listenersBound){
      state.listenersBound=true;
      document.addEventListener('visibilitychange',()=>{if(!document.hidden)onLifecycle('visibility-resume');},{passive:true});
      window.addEventListener('pageshow',()=>onLifecycle('pageshow'),{passive:true});
      window.addEventListener('focus',()=>onLifecycle('focus'),{passive:true});
      window.addEventListener('online',()=>onLifecycle('online'),{passive:true});
      const audio=document.getElementById('athan');
      if(audio){
        audio.addEventListener('ended',()=>onLifecycle('audio-ended'),{passive:true});
        audio.addEventListener('error',()=>onLifecycle('audio-error'),{passive:true});
      }
    }
    setStatus('starting','Scheduler starting',null);
    setTimeout(()=>reconcile(undefined,'startup'),300);
    setTimeout(()=>reconcile(undefined,'startup-data-settle'),5000);
  }

  function stop(){
    state.stopped=true;
    clearExactTimer();
    clearRetryTimer();
    clearInterval(state.watchdogTimer);
    state.watchdogTimer=0;
    setStatus('stopped','Scheduler stopped',null);
  }

  function cancelOccurrence(key,generation,reason){
    key=String(key||'');
    generation=Number(generation);
    const active=state.activeAttempt;
    if(!key||!Number.isInteger(generation)||!active||active.occurrenceKey!==key||active.attemptGeneration!==generation)return false;
    if(!['loading','pending-playback','playing','awaiting-retry'].includes(active.status)||firedByKey(key))return false;
    const map=readDismissed();
    map[key]=Date.now();
    writeDismissed(map);
    ++state.attemptGeneration;
    if(state.retryKey===key)clearRetryTimer();
    if(state.inFlightKey===key)state.inFlightKey='';
    state.activeAttempt=null;
    delete state.attempts[key];
    setStatus('dismissed',reason||'stopped',null);
    setTimeout(()=>reconcile(undefined,'occurrence-dismissed'),0);
    return true;
  }

  function clearFiredForTesting(){
    try{localStorage.removeItem(FIRED_KEY);localStorage.removeItem(DISMISSED_KEY);localStorage.removeItem(LEGACY_FIRED_KEY);}catch(_error){}
    state.attempts=Object.create(null);
    state.activeAttempt=null;
  }

  window.ASLIMAAzaanScheduler={
    version:VERSION,
    config:Object.freeze({graceMs:GRACE_MS,watchdogMs:WATCHDOG_MS}),
    state,
    start,
    stop,
    reconcile,
    eventsFor,
    parseTime,
    dateKey,
    isFired,
    isDismissed,
    markFired,
    cancelOccurrence,
    clearFiredForTesting
  };

  if(window.ASLIMA_SCHEDULER_DISABLE_AUTOSTART!==true){
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
    else start();
  }
})();
