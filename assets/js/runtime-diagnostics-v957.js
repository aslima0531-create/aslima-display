(function(){
  'use strict';
  if(window.ASLIMADiagnostics&&window.ASLIMADiagnostics.version==='957')return;

  const VERSION='957';
  const STORAGE_KEY='aslima_runtime_diagnostics_v957';
  const MAX_ENTRIES=80;
  const MAX_AGE_MS=7*24*60*60*1000;
  let memoryEntries=[];
  let storageWritable=true;
  let lastFingerprint='';
  let lastFingerprintAt=0;

  function text(value,limit){
    const normalized=String(value==null?'':value).replace(/\s+/g,' ').trim();
    return normalized.slice(0,limit||180);
  }

  function safeDetail(detail){
    if(!detail||typeof detail!=='object')return detail==null?'':text(detail);
    const result={};
    ['status','reason','prayer','source','occurrenceKey','version','message'].forEach(key=>{
      if(detail[key]!=null)result[key]=text(detail[key],120);
    });
    if(detail.event&&typeof detail.event==='object'){
      result.event={};
      ['prayer','key','time'].forEach(key=>{
        if(detail.event[key]!=null)result.event[key]=text(detail.event[key],120);
      });
    }
    return result;
  }

  function read(){
    if(!storageWritable)return memoryEntries.slice();
    try{
      const parsed=JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]');
      return Array.isArray(parsed)?parsed:[];
    }catch(_error){return memoryEntries.slice();}
  }

  function write(entries){
    memoryEntries=entries.slice();
    try{localStorage.setItem(STORAGE_KEY,JSON.stringify(entries));}catch(_error){storageWritable=false;}
  }

  function normalizedEntries(){
    const cutoff=Date.now()-MAX_AGE_MS;
    return read().filter(entry=>entry&&Number(entry.at)>=cutoff).slice(-MAX_ENTRIES);
  }

  function record(category,status,detail){
    const now=Date.now();
    const cleanDetail=safeDetail(detail);
    const fingerprint=JSON.stringify([category,status,cleanDetail]);
    if(fingerprint===lastFingerprint&&now-lastFingerprintAt<5000)return false;
    lastFingerprint=fingerprint;
    lastFingerprintAt=now;
    const entries=normalizedEntries();
    entries.push({at:now,category:text(category,40),status:text(status,40),detail:cleanDetail});
    write(entries.slice(-MAX_ENTRIES));
    return true;
  }

  function snapshot(){
    const scheduler=window.ASLIMAAzaanScheduler&&window.ASLIMAAzaanScheduler.state;
    const playback=window.aslimaPlaybackState;
    return {
      version:VERSION,
      generatedAt:new Date().toISOString(),
      online:navigator.onLine!==false,
      visibility:document.visibilityState||'',
      integration:document.documentElement&&document.documentElement.dataset.aslimaIntegration||'',
      scheduler:scheduler?{status:scheduler.status||'',reason:scheduler.reason||'',inFlightKey:scheduler.inFlightKey||'',retryKey:scheduler.retryKey||''}:null,
      playback:playback?{phase:playback.phase||'',source:playback.source||'',prayer:playback.prayer||'',occurrenceKey:playback.occurrenceKey||''}:null,
      entries:normalizedEntries()
    };
  }

  function clear(){write([]);lastFingerprint='';lastFingerprintAt=0;}

  window.ASLIMADiagnostics=Object.freeze({version:VERSION,record,snapshot,export:()=>JSON.stringify(snapshot(),null,2),clear});

  window.addEventListener('error',event=>record('runtime','error',{message:event&&event.message||'Unhandled error'}));
  window.addEventListener('unhandledrejection',event=>record('runtime','unhandled-rejection',{message:event&&event.reason&&event.reason.message||event&&event.reason||'Unhandled rejection'}));
  window.addEventListener('online',()=>record('network','online'));
  window.addEventListener('offline',()=>record('network','offline'));
  window.addEventListener('pageshow',event=>record('lifecycle','pageshow',{reason:event&&event.persisted?'back-forward-cache':'navigation'}));
  document.addEventListener('visibilitychange',()=>record('lifecycle',document.hidden?'hidden':'visible'));
  window.addEventListener('aslima:scheduler-state',event=>record('scheduler',event&&event.detail&&event.detail.status||'state',event&&event.detail));
  window.addEventListener('aslima:scheduled-azaan-started',event=>record('azaan','started',event&&event.detail));
  if(navigator.serviceWorker&&typeof navigator.serviceWorker.addEventListener==='function'){
    navigator.serviceWorker.addEventListener('controllerchange',()=>record('service-worker','controller-change'));
  }
  record('runtime','boot',{version:VERSION});
})();
