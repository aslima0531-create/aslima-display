
const CONFIG={
  city:'Irving',
  country:'United States',
  method:2,
  jumuah:['1:45 PM','3:00 PM','4:00 PM']
};

const DEMO={
  Fajr:'05:01',
  Sunrise:'06:23',
  Dhuhr:'13:32',
  Asr:'17:14',
  Maghrib:'20:40',
  Isha:'22:02'
};

let timings={...DEMO};
let lastFired='';
let audioUnlocked=false;

const $=id=>document.getElementById(id);
const audio=$('athan');
audio.volume=.70;

function showToast(text){
  const t=$('toast');
  t.textContent=text;
  t.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer=setTimeout(()=>t.classList.remove('show'),2200);
}

function clean(t){
  const m=String(t||'').match(/\d{1,2}:\d{2}/);
  return m?m[0]:'00:00';
}

function to12(t){
  let [h,m]=clean(t).split(':').map(Number);
  const p=h>=12?'PM':'AM';
  h=h%12||12;
  return {
    text:`${h}:${String(m).padStart(2,'0')}`,
    period:p,
    full:`${h}:${String(m).padStart(2,'0')} ${p}`
  };
}

function mins(t){
  const [h,m]=clean(t).split(':').map(Number);
  return h*60+m;
}

function getNext(){
  const n=new Date();
  const cur=n.getHours()*60+n.getMinutes()+n.getSeconds()/60;
  let best=9999;
  let name='Fajr';
  ['Fajr','Dhuhr','Asr','Maghrib','Isha'].forEach(p=>{
    let d=mins(timings[p])-cur;
    if(d>0 && d<best){
      best=d;
      name=p;
    }
  });
  if(best===9999){
    best=1440-cur+mins(timings.Fajr);
    name='Fajr';
  }
  return {name,seconds:Math.max(0,Math.floor(best*60))};
}

function activePrayer(nextName){
  const order=['Fajr','Dhuhr','Asr','Maghrib','Isha'];
  const i=order.indexOf(nextName);
  if(i<0)return null;
  return i===0?'Isha':order[i-1];
}

function remainingHuman(seconds){
  seconds=Math.max(0,Math.floor(seconds||0));
  const h=Math.floor(seconds/3600);
  const m=Math.floor((seconds%3600)/60);
  if(h>0)return `${h}h ${String(m).padStart(2,'0')}m remaining`;
  if(m>0)return `${m}m remaining`;
  return 'starting now';
}

function updateClock(){
  const d=new Date();
  let h=d.getHours();
  const m=String(d.getMinutes()).padStart(2,'0');
  const ap=h>=12?'PM':'AM';
  h=h%12||12;
  $('clock').innerHTML=`${h}:${m}<span class="ampm">${ap}</span>`;
  try{
    $('dateLine').textContent=new Intl.DateTimeFormat(undefined,{weekday:'long',month:'long',day:'numeric'}).format(d).toUpperCase();
  }catch(e){
    $('dateLine').textContent=d.toDateString().toUpperCase();
  }
}

function updateProgress(){
  const d=new Date();
  const now=d.getHours()*60+d.getMinutes()+d.getSeconds()/60;
  const start=mins(timings.Fajr);
  const end=mins(timings.Isha);
  const pct=Math.max(0,Math.min(100,((now-start)/Math.max(1,end-start))*100));
  document.documentElement.style.setProperty('--progress',pct+'%');
}

function render(){
  updateClock();
  const next=getNext();
  const nextTime=to12(timings[next.name]);

  $('nextName').textContent=next.name.toUpperCase();
  $('nextTime').textContent=nextTime.full;
  $('remaining').textContent=remainingHuman(next.seconds);

  ['Fajr','Dhuhr','Asr','Maghrib','Isha'].forEach(p=>{
    $('time'+p).textContent=to12(timings[p]).full;
  });

  const current=activePrayer(next.name);
  document.querySelectorAll('.row').forEach(row=>{
    row.classList.toggle('active',row.dataset.prayer===current);
  });

  $('jumuah').innerHTML='<b>Jumu’ah Prayer</b><span>'+CONFIG.jumuah.join('</span><span>•</span><span>')+'</span>';
  updateProgress();
  updateVolumeLabel();
}

async function loadTimes(){
  try{
    if(location.protocol!=='file:'){
      const url=`https://api.aladhan.com/v1/timingsByCity?city=${encodeURIComponent(CONFIG.city)}&country=${encodeURIComponent(CONFIG.country)}&method=${CONFIG.method}`;
      const r=await fetch(url,{cache:'no-store'});
      const j=await r.json();
      if(j && j.data && j.data.timings){
        const t=j.data.timings;
        timings={
          Fajr:clean(t.Fajr),
          Sunrise:clean(t.Sunrise),
          Dhuhr:clean(t.Dhuhr),
          Asr:clean(t.Asr),
          Maghrib:clean(t.Maghrib),
          Isha:clean(t.Isha)
        };
        showToast('Prayer times updated');
      }
    }
  }catch(e){
    showToast('Offline mode');
  }
  render();
}

function updateVolumeLabel(){
  $('volumePct').textContent=Math.round(audio.volume*100)+'%';
}

function setVolume(v){
  audio.volume=Math.max(0,Math.min(1,v));
  audio.muted=false;
  updateVolumeLabel();
  showToast('Volume '+Math.round(audio.volume*100)+'%');
}

async function unlockAudio(){
  if(audioUnlocked)return;
  try{
    await audio.play();
    audio.pause();
    audio.currentTime=0;
    audioUnlocked=true;
  }catch(e){}
}

async function playAzaan(){
  try{
    $('overlayPrayer').textContent=getNext().name;
    $('adhanOverlay').classList.add('show');
    audio.currentTime=0;
    await audio.play();
    showToast('Azaan playing');
  }catch(e){
    showToast('Tap once to allow audio');
  }
}

function stopAzaan(){
  audio.pause();
  audio.currentTime=0;
  $('adhanOverlay').classList.remove('show');
  showToast('Azaan stopped');
}

audio.onended=()=>$('adhanOverlay').classList.remove('show');
audio.onerror=()=>showToast('Internet needed for Azaan');

function showAdmin(){
  $('admin').classList.add('show');
  clearTimeout(showAdmin.timer);
  showAdmin.timer=setTimeout(()=>$('admin').classList.remove('show'),15000);
}

let taps=0,tapTimer=null;
function adminTap(e){
  if(e){e.preventDefault();e.stopPropagation();}
  taps++;
  clearTimeout(tapTimer);
  tapTimer=setTimeout(()=>taps=0,2300);
  if(taps>=5){
    taps=0;
    showAdmin();
  }
}

$('adminHotspot').addEventListener('click',adminTap,{passive:false});
$('adminHotspot').addEventListener('touchend',adminTap,{passive:false});
$('brand').addEventListener('click',adminTap,{passive:false});
$('brand').addEventListener('touchend',adminTap,{passive:false});

$('testAzaan').onclick=()=>{playAzaan();showAdmin();};
$('stopAzaan').onclick=()=>{stopAzaan();showAdmin();};
$('overlayStop').onclick=stopAzaan;
$('volDown').onclick=()=>{setVolume(audio.volume-.1);showAdmin();};
$('volUp').onclick=()=>{setVolume(audio.volume+.1);showAdmin();};
$('refreshTimes').onclick=()=>{loadTimes();showAdmin();};
$('dashboard15').onclick=()=>{showToast('Clean premium display active');showAdmin();};

document.addEventListener('pointerdown',unlockAudio,{once:true,passive:true});

function autoFireAzaan(){
  const n=new Date();
  const stamp=n.toDateString();
  const now=n.getHours()*60+n.getMinutes();
  ['Fajr','Dhuhr','Asr','Maghrib','Isha'].forEach(p=>{
    const key=stamp+'-'+p;
    if(now===mins(timings[p]) && lastFired!==key){
      lastFired=key;
      playAzaan();
    }
  });
}

loadTimes();
render();
setInterval(render,1000);
setInterval(autoFireAzaan,30000);
setInterval(loadTimes,6*60*60*1000);

/* ASLIMA V6.1 — admin close control */
(function(){
  function bindClose(){
    const close=document.getElementById('closeAdmin');
    const admin=document.getElementById('admin');
    if(close && admin && !close.__aslimaCloseBound){
      close.__aslimaCloseBound=true;
      close.addEventListener('click',function(e){
        e.preventDefault();
        e.stopPropagation();
        admin.classList.remove('show');
      },{passive:false});
      close.addEventListener('touchend',function(e){
        e.preventDefault();
        e.stopPropagation();
        admin.classList.remove('show');
      },{passive:false});
    }
  }
  bindClose();
  window.addEventListener('load',bindClose);
})();


/* ASLIMA V6.4 — premium prayer transitions and Azaan mode */
(function(){
  let lastNextPrayer=null;
  let completionTimer=null;

  const originalRender=typeof render === 'function' ? render : null;
  if(originalRender && !window.__aslimaV64RenderWrapped){
    window.__aslimaV64RenderWrapped=true;
    render=function(){
      let before=null;
      try{ before=getNext().name; }catch(e){}
      originalRender();
      try{
        const after=getNext().name;
        if(lastNextPrayer && after && after!==lastNextPrayer){
          document.body.classList.add('prayer-changing');
          setTimeout(()=>document.body.classList.remove('prayer-changing'),650);
        }
        lastNextPrayer=after;
        const j=document.getElementById('jumuah');
        if(j){
          const isFriday=new Date().getDay()===5;
          j.classList.toggle('friday',isFriday);
          if(isFriday && j.querySelector('b')) j.querySelector('b').textContent='Jumu’ah Prayer';
        }
      }catch(e){}
    };
  }

  const originalPlay=typeof playAzaan === 'function' ? playAzaan : null;
  if(originalPlay && !window.__aslimaV64PlayWrapped){
    window.__aslimaV64PlayWrapped=true;
    playAzaan=async function(){
      clearTimeout(completionTimer);
      document.body.classList.add('azaan-active');
      const overlay=document.getElementById('adhanOverlay');
      if(overlay) overlay.classList.add('show');
      return originalPlay();
    };
  }

  const originalStop=typeof stopAzaan === 'function' ? stopAzaan : null;
  if(originalStop && !window.__aslimaV64StopWrapped){
    window.__aslimaV64StopWrapped=true;
    stopAzaan=function(){
      originalStop();
      document.body.classList.remove('azaan-active');
    };
  }

  const audio=document.getElementById('athan');
  if(audio && !audio.__aslimaV64EndBound){
    audio.__aslimaV64EndBound=true;
    audio.addEventListener('ended',function(){
      const overlay=document.getElementById('adhanOverlay');
      const prayer=document.getElementById('overlayPrayer');
      if(prayer) prayer.textContent='Accepted';
      document.body.classList.add('azaan-active');
      if(overlay) overlay.classList.add('show');
      clearTimeout(completionTimer);
      completionTimer=setTimeout(function(){
        if(overlay) overlay.classList.remove('show');
        document.body.classList.remove('azaan-active');
      },30000);
    });
  }

  setTimeout(function(){
    try{ render(); }catch(e){}
  },200);
})();


/* ASLIMA V6.5 — current prayer intelligence */
(function(){
  const ORDER=['Fajr','Dhuhr','Asr','Maghrib','Isha'];

  function computeCurrentPrayer(){
    const now=new Date();
    const cur=now.getHours()*60+now.getMinutes()+now.getSeconds()/60;
    const fajr=mins(timings.Fajr);
    const dhuhr=mins(timings.Dhuhr);
    const asr=mins(timings.Asr);
    const maghrib=mins(timings.Maghrib);
    const isha=mins(timings.Isha);

    if(cur>=fajr && cur<dhuhr) return 'Fajr';
    if(cur>=dhuhr && cur<asr) return 'Dhuhr';
    if(cur>=asr && cur<maghrib) return 'Asr';
    if(cur>=maghrib && cur<isha) return 'Maghrib';
    return 'Isha';
  }

  const priorRender=typeof render==='function' ? render : null;
  if(priorRender && !window.__aslimaV65RenderWrapped){
    window.__aslimaV65RenderWrapped=true;
    render=function(){
      priorRender();
      try{
        const current=computeCurrentPrayer();
        const el=document.getElementById('currentPrayerName');
        if(el) el.textContent=current.toUpperCase();

        document.querySelectorAll('.row').forEach(row=>{
          const active=row.dataset.prayer===current;
          row.classList.toggle('current-now',active);
          row.classList.toggle('active',active);
        });
      }catch(e){}
    };
  }

  setTimeout(function(){try{render()}catch(e){}},250);
})();


/* ASLIMA V6.7 — Smart Night Mode */
(function(){
  function currentMinutes(){
    const d=new Date();
    return d.getHours()*60+d.getMinutes();
  }
  function safeMins(v){
    try{return mins(v)}catch(e){
      const m=String(v||"").match(/(\d{1,2}):(\d{2})/);
      if(!m)return 0;
      return Number(m[1])*60+Number(m[2]);
    }
  }
  function updateNightMode(){
    try{
      const now=currentMinutes();
      const isha=safeMins(timings.Isha);
      const fajr=safeMins(timings.Fajr);
      const active=(now>=isha || now<fajr);
      document.body.classList.toggle("night-mode", active);
    }catch(e){}
  }
  window.__aslimaUpdateNightMode=updateNightMode;

  const previousRender=typeof render==="function"?render:null;
  if(previousRender && !window.__aslimaV67RenderWrapped){
    window.__aslimaV67RenderWrapped=true;
    render=function(){previousRender();updateNightMode();};
  }
  setInterval(updateNightMode,60000);
  setTimeout(updateNightMode,300);
})();

