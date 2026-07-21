(function(){
  'use strict';
  if(window.ASLIMARecovery&&window.ASLIMARecovery.version==='959')return;

  const VERSION='959';
  const STORAGE_KEY='aslima_runtime_recovery_v959';
  const TICK_MS=60000;
  const SLEEP_GAP_MS=3*60*1000;
  const UNAVAILABLE_RETRY_MS=5*60*1000;
  const RELOAD_COOLDOWN_MS=30*60*1000;
  const RELOAD_WINDOW_MS=6*60*60*1000;
  const MAX_RELOADS=2;
  let timer=0;
  let listenersBound=false;
  let recoveryPromise=null;
  let lastTick=Date.now();
  const state={version:VERSION,status:'starting',reason:'startup',lastRecoveryAt:0,pendingReload:false,reloadCount:0};

  function diagnostic(status,detail){
    if(window.ASLIMADiagnostics)window.ASLIMADiagnostics.record('recovery',status,detail||{});
  }
  function readStore(){
    try{const value=JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}');return value&&typeof value==='object'&&!Array.isArray(value)?value:{};}catch(_error){return {};}
  }
  function writeStore(value){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(value));return true;}catch(_error){return false;}}
  function reloadHistory(now){
    const stored=readStore();
    return (Array.isArray(stored.reloads)?stored.reloads:[]).map(Number).filter(at=>Number.isFinite(at)&&now-at<RELOAD_WINDOW_MS);
  }
  function playbackBusy(){
    const phase=window.aslimaPlaybackState&&window.aslimaPlaybackState.phase||'idle';
    return ['preloading','loading','playing','stopping'].includes(phase);
  }
  function schedulerBusy(){
    const scheduler=window.ASLIMAAzaanScheduler&&window.ASLIMAAzaanScheduler.state;
    return !!(scheduler&&(scheduler.inFlightKey||scheduler.retryKey||scheduler.activeAttempt));
  }
  function publish(reason){
    if(typeof window.publishAslimaHealth==='function')window.publishAslimaHealth(reason||'recovery-state');
    try{window.dispatchEvent(new CustomEvent('aslima:recovery-state',{detail:snapshot()}));}catch(_error){}
  }
  function snapshot(){
    return {version:VERSION,status:state.status,reason:state.reason,lastRecoveryAt:state.lastRecoveryAt,pendingReload:state.pendingReload,reloadCount:state.reloadCount};
  }
  function setState(status,reason){state.status=status;state.reason=String(reason||'').slice(0,60);publish('recovery-'+status);}
  async function updateServiceWorker(){
    if(!navigator.serviceWorker||typeof navigator.serviceWorker.getRegistration!=='function')return false;
    const registration=await navigator.serviceWorker.getRegistration();
    if(!registration||typeof registration.update!=='function')return false;
    await registration.update();return true;
  }
  async function softRecover(reason){
    if(recoveryPromise)return recoveryPromise;
    recoveryPromise=(async()=>{
      setState('recovering',reason);diagnostic('started',{reason});
      const tasks=[];
      const timing=window.ASLIMA_TIMING;
      if(timing&&typeof timing.checkTimingLifecycle==='function')tasks.push(Promise.resolve().then(()=>timing.checkTimingLifecycle()));
      let timingState=null;try{timingState=timing&&typeof timing.getState==='function'?timing.getState():null;}catch(error){tasks.push(Promise.reject(error));}
      if(timingState&&timingState.runtimeStatus==='unavailable'&&typeof timing.loadTimes==='function')tasks.push(Promise.resolve().then(()=>timing.loadTimes({reason:'self-heal-'+reason})));
      const scheduler=window.ASLIMAAzaanScheduler;
      if(scheduler&&typeof scheduler.reconcile==='function')tasks.push(Promise.resolve().then(()=>scheduler.reconcile(new Date(),'self-heal-'+reason)));
      tasks.push(updateServiceWorker());
      const results=await Promise.allSettled(tasks);
      const rejected=results.filter(result=>result.status==='rejected');
      state.lastRecoveryAt=Date.now();
      setState(rejected.length?'degraded':'healthy',reason);
      diagnostic(rejected.length?'partial':'completed',{reason,message:rejected.length?String(rejected[0].reason&&rejected[0].reason.message||rejected[0].reason):''});
      if(typeof window.publishAslimaHealth==='function')await window.publishAslimaHealth('recovery-complete');
      return rejected.length===0;
    })().finally(()=>{recoveryPromise=null;});
    return recoveryPromise;
  }
  function canReload(now){
    const history=reloadHistory(now);state.reloadCount=history.length;
    return history.length<MAX_RELOADS&&(!history.length||now-history[history.length-1]>=RELOAD_COOLDOWN_MS);
  }
  function performPendingReload(){
    if(!state.pendingReload)return false;
    if(playbackBusy()||schedulerBusy()){setState('waiting-for-idle',state.reason);return false;}
    const now=Date.now();
    if(!canReload(now)){state.pendingReload=false;setState('reload-cooldown',state.reason);diagnostic('reload-blocked',{reason:state.reason});return false;}
    const stored=readStore(),history=reloadHistory(now);history.push(now);
    stored.reloads=history;stored.lastReason=state.reason;stored.lastReloadAt=now;writeStore(stored);
    state.reloadCount=history.length;state.pendingReload=false;setState('reloading',state.reason);diagnostic('reload',{reason:state.reason});
    setTimeout(()=>location.reload(),80);return true;
  }
  function requestReload(reason){
    state.pendingReload=true;state.reason=String(reason||'requested').slice(0,60);diagnostic('reload-requested',{reason:state.reason});publish('reload-requested');return performPendingReload();
  }
  function tick(){
    const now=Date.now(),gap=now-lastTick;lastTick=now;
    if(state.pendingReload){performPendingReload();return;}
    if(gap>=SLEEP_GAP_MS){softRecover('sleep-wake');return;}
    let timingState=null;try{timingState=window.ASLIMA_TIMING&&window.ASLIMA_TIMING.getState?window.ASLIMA_TIMING.getState():null;}catch(_error){}
    if(navigator.onLine!==false&&timingState&&timingState.runtimeStatus==='unavailable'&&now-state.lastRecoveryAt>=UNAVAILABLE_RETRY_MS)softRecover('timing-unavailable');
  }
  function start(){
    if(timer)return;
    const stored=readStore();state.reloadCount=reloadHistory(Date.now()).length;
    if(stored.lastReloadAt)diagnostic('boot-after-reload',{reason:stored.lastReason||'unknown'});
    timer=setInterval(tick,TICK_MS);
    if(!listenersBound){
      window.addEventListener('online',()=>softRecover('network-restored'),{passive:true});
      window.addEventListener('pageshow',()=>softRecover('pageshow'),{passive:true});
      window.addEventListener('focus',()=>{if(Date.now()-lastTick>=SLEEP_GAP_MS)softRecover('focus-resume');},{passive:true});
      document.addEventListener('visibilitychange',()=>{if(!document.hidden)softRecover('visibility-resume');},{passive:true});
      if(navigator.serviceWorker&&typeof navigator.serviceWorker.addEventListener==='function')navigator.serviceWorker.addEventListener('controllerchange',()=>softRecover('service-worker-upgrade'));
      if(navigator.serviceWorker&&typeof navigator.serviceWorker.addEventListener==='function')navigator.serviceWorker.addEventListener('message',event=>{if(event&&event.data&&event.data.type==='aslima-runtime-update')requestReload('service-worker-upgrade');});
      window.addEventListener('aslima:playback-state',()=>{if(state.pendingReload)performPendingReload();},{passive:true});
      listenersBound=true;
    }
    setState('healthy','startup');diagnostic('started',{version:VERSION});
  }
  function stop(){clearInterval(timer);timer=0;}

  window.ASLIMARecovery=Object.freeze({version:VERSION,state,start,stop,softRecover,requestReload,performPendingReload,snapshot});
  start();
})();
