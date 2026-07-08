const CONFIG={
  city:'Irving',
  country:'United States',
  method:2,
  vricUrls:['https://vric.org/prayertimes/','https://vric.org/','https://vric.org/home-2/'],
  vricSyncMinutes:360,
  jumuah:['1:45 PM','3:00 PM','4:00 PM'],
  timingSource:'vric',
  selectedMasjidId:'vric',
  masjidPresets:[
    {id:'vric',name:'Valley Ranch Islamic Center (VRIC)',city:'Irving, TX',lat:32.9185,lon:-96.9590,method:2,urls:['https://vric.org/prayertimes/','https://vric.org/','https://vric.org/home-2/']},
    {id:'iant',name:'Islamic Association of North Texas (IANT)',city:'Richardson, TX',lat:32.9482,lon:-96.7299,method:2,urls:[]},
    {id:'epic',name:'East Plano Islamic Center (EPIC)',city:'Plano, TX',lat:33.0198,lon:-96.7005,method:2,urls:[]},
    {id:'frisco',name:'Islamic Center of Frisco',city:'Frisco, TX',lat:33.1507,lon:-96.8236,method:2,urls:[]},
    {id:'makkah',name:'Makkah Masjid',city:'Garland, TX',lat:32.9098,lon:-96.6357,method:2,urls:[]}
  ]
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
let lastVricSyncStatus='Not synced yet';
let audioUnlocked=false;
let activeAzaanPrayer='';
let azaanVisualTimer=null;
let azaanVisualIndex=0;
let silentAzaanEndTimer=null;
let burnInIndex=0;
const PRAYER_ORDER=['Fajr','Dhuhr','Asr','Maghrib','Isha'];
let azaanEnabled={Fajr:true,Dhuhr:true,Asr:true,Maghrib:true,Isha:true};
const BURN_IN_OFFSETS=[
  {x:0,y:0,bx:'50%',by:'50%'},
  {x:-7,y:4,bx:'49.7%',by:'50.2%'},
  {x:6,y:-5,bx:'50.3%',by:'49.8%'},
  {x:-4,y:-7,bx:'49.8%',by:'49.7%'},
  {x:8,y:3,bx:'50.4%',by:'50.1%'},
  {x:3,y:8,bx:'50.2%',by:'50.4%'},
  {x:-8,y:-2,bx:'49.6%',by:'49.9%'},
  {x:5,y:6,bx:'50.3%',by:'50.3%'}
];


const $=id=>document.getElementById(id);
const audio=$('athan');
audio.volume=.70;

function applyBurnInShift(){
  burnInIndex=(burnInIndex+1)%BURN_IN_OFFSETS.length;
  const o=BURN_IN_OFFSETS[burnInIndex];
  document.documentElement.style.setProperty('--burn-x',o.x+'px');
  document.documentElement.style.setProperty('--burn-y',o.y+'px');
  document.documentElement.style.setProperty('--burn-bg-x',o.bx);
  document.documentElement.style.setProperty('--burn-bg-y',o.by);
}

function showToast(text){
  const t=$('toast');
  t.textContent=text;
  t.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer=setTimeout(()=>t.classList.remove('show'),2200);
}


function loadAzaanPrefs(){
  try{
    const saved=JSON.parse(localStorage.getItem('aslima_azaan_enabled')||'null');
    if(saved && typeof saved==='object'){
      PRAYER_ORDER.forEach(p=>{azaanEnabled[p]=saved[p]!==false;});
    }
  }catch(e){}
}

function saveAzaanPrefs(){
  try{localStorage.setItem('aslima_azaan_enabled',JSON.stringify(azaanEnabled));}catch(e){}
}

function isAzaanEnabled(prayer){
  return azaanEnabled[prayer]!==false;
}

function setAzaanEnabled(prayer,enabled,quiet){
  azaanEnabled[prayer]=!!enabled;
  saveAzaanPrefs();
  renderAzaanControls();
  if(!quiet)showToast(prayer+' Azaan '+(enabled?'on':'off'));
}

function renderAzaanControls(){
  const list=$('azaanToggleList');
  if(!list)return;
  list.innerHTML=PRAYER_ORDER.map(p=>{
    const checked=isAzaanEnabled(p)?'checked':'';
    const status=isAzaanEnabled(p)?'Will play automatically':'Muted until turned on';
    return `<div class="azaan-toggle-row">
      <div><div class="azaan-toggle-name">${p}</div><div class="azaan-toggle-note">${status}</div></div>
      <label class="azaan-switch" aria-label="${p} Azaan on or off">
        <input type="checkbox" data-azaan-toggle="${p}" ${checked}>
        <span class="track"><span class="thumb"></span></span>
      </label>
    </div>`;
  }).join('');
  list.querySelectorAll('[data-azaan-toggle]').forEach(input=>{
    input.addEventListener('change',e=>setAzaanEnabled(e.target.dataset.azaanToggle,e.target.checked));
  });
}

function openAzaanDrawer(){
  const d=$('azaanDrawer');
  if(d)d.classList.add('open');
}

function closeAzaanDrawer(){
  const d=$('azaanDrawer');
  if(d)d.classList.remove('open');
}

function bindAzaanDrawer(){
  const drawer=$('azaanDrawer');
  const tab=$('azaanDrawerTab');
  if(!drawer || !tab || tab.__aslimaDrawerBound)return;
  tab.__aslimaDrawerBound=true;

  const toggleDrawer=()=>drawer.classList.toggle('open');
  const getX=e=>{
    if(e.touches && e.touches.length)return e.touches[0].clientX;
    if(e.changedTouches && e.changedTouches.length)return e.changedTouches[0].clientX;
    return e.clientX || 0;
  };

  let startX=0;
  let startY=0;
  let dragging=false;
  let moved=false;

  const start=e=>{
    dragging=true;
    moved=false;
    startX=getX(e);
    startY=(e.touches && e.touches[0]) ? e.touches[0].clientY : (e.clientY || 0);
    if(e.pointerId && tab.setPointerCapture){try{tab.setPointerCapture(e.pointerId);}catch(_){}}
  };

  const move=e=>{
    if(!dragging)return;
    const x=getX(e);
    const y=(e.touches && e.touches[0]) ? e.touches[0].clientY : (e.clientY || 0);
    const dx=x-startX;
    const dy=y-startY;
    if(Math.abs(dx)>10)moved=true;
    if(Math.abs(dx)>Math.abs(dy) && Math.abs(dx)>8 && e.cancelable)e.preventDefault();
    // Drawer is on the right edge: swipe left opens, swipe right closes.
    if(dx<-22)openAzaanDrawer();
    if(dx>22)closeAzaanDrawer();
  };

  const end=e=>{
    if(!dragging)return;
    const dx=getX(e)-startX;
    dragging=false;
    if(!moved && Math.abs(dx)<10)toggleDrawer();
  };

  // Fully Kiosk / Android reliability: support pointer, touch, mouse, click.
  tab.addEventListener('pointerdown',start,{passive:false});
  tab.addEventListener('pointermove',move,{passive:false});
  tab.addEventListener('pointerup',end,{passive:false});
  tab.addEventListener('pointercancel',()=>{dragging=false;},{passive:true});
  tab.addEventListener('touchstart',start,{passive:false});
  tab.addEventListener('touchmove',move,{passive:false});
  tab.addEventListener('touchend',end,{passive:false});
  tab.addEventListener('mousedown',start,{passive:false});
  window.addEventListener('mousemove',move,{passive:false});
  window.addEventListener('mouseup',end,{passive:false});
  tab.addEventListener('click',e=>{
    if(moved){moved=false;return;}
    e.preventDefault();
    toggleDrawer();
  },{passive:false});
  tab.addEventListener('keydown',e=>{
    if(e.key==='Enter' || e.key===' '){e.preventDefault();toggleDrawer();}
    if(e.key==='Escape')closeAzaanDrawer();
  });
  const close=$('azaanDrawerClose');
  const allOn=$('azaanAllOn');
  const allOff=$('azaanAllOff');
  if(close)close.onclick=closeAzaanDrawer;
  if(allOn)allOn.onclick=()=>{PRAYER_ORDER.forEach(p=>azaanEnabled[p]=true);saveAzaanPrefs();renderAzaanControls();showToast('All Azaans on');};
  if(allOff)allOff.onclick=()=>{PRAYER_ORDER.forEach(p=>azaanEnabled[p]=false);saveAzaanPrefs();renderAzaanControls();showToast('All Azaans off');};
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

function to24(timeText){
  const raw=String(timeText||'').trim();
  const m=raw.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if(!m)return null;
  let h=parseInt(m[1],10);
  const min=m[2];
  const ap=(m[3]||'').toUpperCase();
  if(ap==='PM' && h<12)h+=12;
  if(ap==='AM' && h===12)h=0;
  return String(h).padStart(2,'0')+':'+min;
}

function normalizePrayerSource(text){
  return String(text||'')
    .replace(/<script[\s\S]*?<\/script>/gi,' ')
    .replace(/<style[\s\S]*?<\/style>/gi,' ')
    .replace(/<[^>]+>/g,' ')
    .replace(/&nbsp;/gi,' ')
    .replace(/&#8217;|&rsquo;/gi,'’')
    .replace(/&amp;/gi,'&')
    .replace(/\s+/g,' ')
    .trim();
}

function makeVricFetchRoutes(url){
  return [
    {name:'Direct VRIC',url:url},
    {name:'AllOrigins raw',url:'https://api.allorigins.win/raw?url='+encodeURIComponent(url)},
    {name:'AllOrigins JSON',url:'https://api.allorigins.win/get?url='+encodeURIComponent(url)},
    {name:'Jina Reader HTTPS',url:'https://r.jina.ai/http://r.jina.ai/http://https://'+url.replace(/^https?:\/\//,'')},
    {name:'Jina Reader HTTP',url:'https://r.jina.ai/http://r.jina.ai/http://http://'+url.replace(/^https?:\/\//,'')},
    {name:'CORSProxy',url:'https://corsproxy.io/?'+encodeURIComponent(url)}
  ];
}

function extractFetchText(payload){
  if(!payload)return '';
  const trimmed=String(payload).trim();
  if(trimmed.startsWith('{')){
    try{
      const json=JSON.parse(trimmed);
      return json.contents||json.data||json.body||trimmed;
    }catch(e){}
  }
  return payload;
}

function looksLikeVricData(text){
  const normalized=normalizePrayerSource(text);
  return /Valley Ranch|VRIC|Prayer Times|Salah|Fajr|Dhuhr|Jummah|Jumu/i.test(normalized) && /\d{1,2}:\d{2}/.test(normalized);
}

async function fetchTextWithFallback(url){
  let lastErr=null;
  for(const route of makeVricFetchRoutes(url)){
    try{
      const r=await fetch(route.url,{cache:'no-store',mode:'cors'});
      if(!r.ok)throw new Error(route.name+' HTTP '+r.status);
      const payload=await r.text();
      const text=extractFetchText(payload);
      if(text && text.length>80 && looksLikeVricData(text)){
        return {text,sourceUrl:url,route:route.name};
      }
      lastErr=new Error(route.name+' returned unusable data');
    }catch(e){
      lastErr=e;
    }
  }
  throw lastErr||new Error('Unable to fetch VRIC');
}

async function fetchBestVricSource(){
  const urls=CONFIG.vricUrls||['https://vric.org/prayertimes/','https://vric.org/'];
  let lastErr=null;
  for(const url of urls){
    try{
      const result=await fetchTextWithFallback(url);
      if(result && result.text)return result;
    }catch(e){
      lastErr=e;
    }
  }
  throw lastErr||new Error('Unable to fetch any VRIC route');
}

function parseVricPrayerTimes(sourceText){
  const text=normalizePrayerSource(sourceText);
  const out={};
  const names=[
    ['Fajr',['Fajr']],
    ['Dhuhr',['Dhuhr','Zuhr','Zuhur','Dhuhur']],
    ['Asr',['Asr']],
    ['Maghrib',['Maghrib','Magrib']],
    ['Isha',['Isha','Isha’a','Isha’a']]
  ];

  names.forEach(([key,aliases])=>{
    for(const alias of aliases){
      const re=new RegExp('(?:^|\\s|;|,|>)'+alias+'(?:\\s|,|:|-|–|—)+([0-9]{1,2}:[0-9]{2}\\s*(?:AM|PM|am|pm)?)','i');
      const m=text.match(re);
      const v=m && to24(m[1]);
      if(v){out[key]=v;break;}
    }
  });

  const jumuah=[];
  const jumRe=/(?:Jummah|Jumu[’'`]?ah)(?:\s*\d+|\s*Prayer)?(?:\s|,|:|-|–|—){0,10}([0-9]{1,2}:[0-9]{2}\s*(?:AM|PM|am|pm))/gi;
  let jm;
  while((jm=jumRe.exec(text))!==null){
    const pretty=to12(to24(jm[1])).full;
    if(!jumuah.includes(pretty))jumuah.push(pretty);
  }

  // Fallback: VRIC pages sometimes mention "three Jummah prayers: 1:45, 3:00, & 4:00 PM".
  if(jumuah.length===0){
    const loose=text.match(/(?:Jummah|Jumu[’'`]?ah)[^.;]{0,160}/i);
    if(loose){
      const times=[...loose[0].matchAll(/([0-9]{1,2}:[0-9]{2}\s*(?:AM|PM|am|pm)?)/g)].map(x=>x[1]);
      const hasPm=/PM/i.test(loose[0]);
      times.forEach(t=>{
        const fixed=/AM|PM/i.test(t)?t:(hasPm?t+' PM':t);
        const v=to24(fixed);
        if(v){
          const pretty=to12(v).full;
          if(!jumuah.includes(pretty))jumuah.push(pretty);
        }
      });
    }
  }

  return {timings:out,jumuah:jumuah.slice(0,4),sourceText:text};
}

async function syncVricTimes(showSuccess){
  const syncResult=await fetchBestVricSource();
  const parsed=parseVricPrayerTimes(syncResult.text);
  parsed.sourceUrl=syncResult.sourceUrl;
  parsed.route=syncResult.route;
  const found=parsed.timings||{};
  const required=['Fajr','Dhuhr','Asr','Maghrib','Isha'];
  const validPrayers=required.filter(k=>found[k]);

  if(validPrayers.length>=4){
    timings={...timings,...found};
  }
  if(parsed.jumuah && parsed.jumuah.length){
    CONFIG.jumuah=parsed.jumuah;
  }

  if(validPrayers.length<4 && (!parsed.jumuah || !parsed.jumuah.length)){
    throw new Error('VRIC page loaded but times were not found');
  }

  const stamp=new Date().toLocaleString();
  lastVricSyncStatus='VRIC live sync: '+stamp+' via '+(parsed.route||'route');
  try{
    localStorage.setItem('aslima_vric_cache',JSON.stringify({timings,jumuah:CONFIG.jumuah,stamp,route:parsed.route||'',sourceUrl:parsed.sourceUrl||''}));
  }catch(e){}
  if(showSuccess)showToast('VRIC live timings synced');
  return true;
}

function loadCachedVricTimes(){
  try{
    const cached=JSON.parse(localStorage.getItem('aslima_vric_cache')||'null');
    if(cached && cached.timings){
      timings={...timings,...cached.timings};
      if(cached.jumuah && cached.jumuah.length)CONFIG.jumuah=cached.jumuah;
      lastVricSyncStatus='Using last VRIC sync: '+(cached.stamp||'saved');
      return true;
    }
  }catch(e){}
  return false;
}


function loadTimingSourcePrefs(){
  try{
    const saved=JSON.parse(localStorage.getItem('aslima_timing_source')||'null');
    if(saved && typeof saved==='object'){
      if(saved.mode)CONFIG.timingSource=saved.mode;
      if(saved.masjidId)CONFIG.selectedMasjidId=saved.masjidId;
      if(saved.city)CONFIG.city=saved.city;
      if(saved.country)CONFIG.country=saved.country;
      if(saved.lat && saved.lon){CONFIG.geoLat=saved.lat;CONFIG.geoLon=saved.lon;}
      if(saved.method)CONFIG.method=parseInt(saved.method,10)||CONFIG.method;
    }
  }catch(e){}
}

function saveTimingSourcePrefs(){
  try{
    localStorage.setItem('aslima_timing_source',JSON.stringify({
      mode:CONFIG.timingSource,
      city:CONFIG.city,
      country:CONFIG.country,
      lat:CONFIG.geoLat,
      lon:CONFIG.geoLon,
      method:CONFIG.method
    }));
  }catch(e){}
}

function masjidById(id){
  return (CONFIG.masjidPresets||[]).find(m=>m.id===id) || (CONFIG.masjidPresets||[])[0];
}

function distanceMiles(aLat,aLon,bLat,bLon){
  const R=3958.8;
  const toRad=x=>x*Math.PI/180;
  const dLat=toRad(bLat-aLat);
  const dLon=toRad(bLon-aLon);
  const s=Math.sin(dLat/2)**2 + Math.cos(toRad(aLat))*Math.cos(toRad(bLat))*Math.sin(dLon/2)**2;
  return 2*R*Math.asin(Math.sqrt(s));
}

function getDevicePosition(){
  return new Promise((resolve,reject)=>{
    if(!navigator.geolocation)return reject(new Error('Location permission is not available on this tablet/browser'));
    navigator.geolocation.getCurrentPosition(
      pos=>resolve({lat:pos.coords.latitude,lon:pos.coords.longitude}),
      err=>reject(new Error(err && err.message ? err.message : 'Location permission denied')),
      {enableHighAccuracy:true,timeout:12000,maximumAge:10*60*1000}
    );
  });
}

async function syncAlAdhanByCoordinates(lat,lon,label,method){
  const url=`https://api.aladhan.com/v1/timings?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}&method=${encodeURIComponent(method||CONFIG.method)}`;
  const r=await fetch(url,{cache:'no-store'});
  if(!r.ok)throw new Error('AlAdhan location lookup failed');
  const j=await r.json();
  if(!j || !j.data || !j.data.timings)throw new Error('No location timings returned');
  const t=j.data.timings;
  timings={
    Fajr:clean(t.Fajr),
    Sunrise:clean(t.Sunrise),
    Dhuhr:clean(t.Dhuhr),
    Asr:clean(t.Asr),
    Maghrib:clean(t.Maghrib),
    Isha:clean(t.Isha)
  };
  lastVricSyncStatus='Timing source: '+label;
  try{localStorage.setItem('aslima_location_cache',JSON.stringify({timings,label,stamp:new Date().toLocaleString()}));}catch(e){}
  return true;
}

async function syncClosestMasjidFromDevice(){
  const pos=await getDevicePosition();
  let best=null;
  (CONFIG.masjidPresets||[]).forEach(m=>{
    const d=distanceMiles(pos.lat,pos.lon,m.lat,m.lon);
    if(!best || d<best.distance)best={...m,distance:d};
  });
  if(!best)throw new Error('No masjid presets are available');
  CONFIG.selectedMasjidId=best.id;
  saveTimingSourcePrefs();

  // If the closest preset has its own live timing source, try that first.
  if(best.urls && best.urls.length){
    const oldUrls=CONFIG.vricUrls;
    try{
      CONFIG.vricUrls=best.urls;
      await syncVricTimes(false);
      lastVricSyncStatus='Timing source: closest masjid — '+best.name+' ('+best.distance.toFixed(1)+' mi)';
      renderLocationControls();
      return true;
    }catch(e){
      CONFIG.vricUrls=oldUrls;
    }
  }

  await syncAlAdhanByCoordinates(best.lat,best.lon,'closest masjid location — '+best.name+' ('+best.distance.toFixed(1)+' mi)',best.method);
  renderLocationControls();
  return true;
}

async function syncSelectedMasjid(){
  const m=masjidById(CONFIG.selectedMasjidId);
  if(!m)throw new Error('Selected masjid not found');
  if(m.urls && m.urls.length){
    const oldUrls=CONFIG.vricUrls;
    try{
      CONFIG.vricUrls=m.urls;
      await syncVricTimes(false);
      lastVricSyncStatus='Timing source: '+m.name+' live sync';
      renderLocationControls();
      return true;
    }catch(e){
      CONFIG.vricUrls=oldUrls;
    }
  }
  await syncAlAdhanByCoordinates(m.lat,m.lon,m.name+' location',m.method);
  renderLocationControls();
  return true;
}

async function syncDeviceLocation(){
  const pos=await getDevicePosition();
  CONFIG.geoLat=pos.lat;
  CONFIG.geoLon=pos.lon;
  saveTimingSourcePrefs();
  await syncAlAdhanByCoordinates(pos.lat,pos.lon,'calculated from this tablet location',CONFIG.method);
  renderLocationControls();
  return true;
}

function renderLocationControls(){
  const mode=document.getElementById('timingSourceMode');
  const status=document.getElementById('timingSourceStatus');
  const method=document.getElementById('calcMethodSelect');
  if(mode)mode.value=(CONFIG.timingSource==='device-location'?'calculated-location':(CONFIG.timingSource||'vric'));
  if(method)method.value=String(CONFIG.method||2);
  if(status)status.textContent=lastVricSyncStatus||'Not synced yet';
  if(window.renderPremiumTimingSourceUI)window.renderPremiumTimingSourceUI();
}

function bindLocationControls(){
  const mode=document.getElementById('timingSourceMode');
  const method=document.getElementById('calcMethodSelect');
  const refreshBtn=document.getElementById('refreshTimingSource');
  if(mode && !mode.__aslimaBound){
    mode.__aslimaBound=true;
    mode.addEventListener('change',async e=>{
      CONFIG.timingSource=e.target.value;
      saveTimingSourcePrefs();
      showToast(e.target.value==='vric'?'Using VRIC live timings':'Using calculated tablet-location timings');
      await loadTimes();
    });
  }
  if(method && !method.__aslimaBound){
    method.__aslimaBound=true;
    method.addEventListener('change',async e=>{
      CONFIG.method=parseInt(e.target.value,10)||2;
      saveTimingSourcePrefs();
      if((CONFIG.timingSource||'vric')!=='vric') await loadTimes();
    });
  }
  if(refreshBtn && !refreshBtn.__aslimaBound){
    refreshBtn.__aslimaBound=true;
    refreshBtn.onclick=async()=>{showToast('Refreshing timings');await loadTimes();};
  }
  renderLocationControls();
}

async function syncConfiguredTimingSource(){
  const source=CONFIG.timingSource||'vric';
  if(source==='device-location' || source==='calculated-location'){
    return await syncDeviceLocation();
  }
  return await syncVricTimes(true);
}


function getNext(){
  const n=new Date();
  const cur=n.getHours()*60+n.getMinutes()+n.getSeconds()/60;
  let best=9999;
  let name='Fajr';
  PRAYER_ORDER.forEach(p=>{
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
  const order=PRAYER_ORDER;
  const i=order.indexOf(nextName);
  if(i<0)return null;
  return i===0?'Isha':order[i-1];
}

function isFriday(){
  return new Date().getDay()===5;
}

function currentPrayerTheme(nextName){
  const n=new Date();
  const now=n.getHours()*60+n.getMinutes()+n.getSeconds()/60;
  const fajr=mins(timings.Fajr);
  const dhuhr=mins(timings.Dhuhr);
  const asr=mins(timings.Asr);
  const maghrib=mins(timings.Maghrib);
  const isha=mins(timings.Isha);

  if(isFriday() && now>=fajr && now<asr)return 'jumuah';
  if(now<fajr || now>=isha)return 'after-isha';
  if(now<dhuhr)return 'fajr';
  if(now<asr)return 'dhuhr';
  if(now<maghrib)return 'asr';
  if(now<isha)return 'maghrib';
  return 'isha';
}

function applyPrayerTheme(nextName){
  const theme=currentPrayerTheme(nextName);
  if(document.body.dataset.theme!==theme){
    document.body.dataset.theme=theme;
  }
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
  applyPrayerTheme(next.name);
  const nextTime=to12(timings[next.name]);

  $('nextName').textContent=next.name.toUpperCase();
  $('nextTime').textContent=nextTime.full;
  $('remaining').textContent=remainingHuman(next.seconds);

  PRAYER_ORDER.forEach(p=>{
    $('time'+p).textContent=to12(timings[p]).full;
  });

  const current=activePrayer(next.name);
  document.querySelectorAll('.row').forEach(row=>{
    row.classList.toggle('active',row.dataset.prayer===current);
  });

  $('jumuah').innerHTML='<b>Jumu’ah Prayer</b><span>'+CONFIG.jumuah.join('</span><span>•</span><span>')+'</span>';
  updateProgress();
  updateVolumeLabel();
  renderLocationControls();
}

async function loadTimes(){
  let synced=false;
  try{
    synced=await syncConfiguredTimingSource();
  }catch(e){
    loadCachedVricTimes();
    try{
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
        lastVricSyncStatus='Live source unavailable; using AlAdhan fallback';
        showToast('Live source unavailable — fallback times loaded');
      }
    }catch(err){
      lastVricSyncStatus='Offline mode — using saved/demo times';
      showToast('Offline mode');
    }
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

const AZAAN_BASE_SEQUENCE=[
  {ar:'الله أكبر', en:'Allah is the Greatest', repeat:4, weight:1.00},
  {ar:'أشهد أن لا إله إلا الله', en:'I bear witness that there is no god but Allah', repeat:2, weight:1.35},
  {ar:'أشهد أن محمدًا رسول الله', en:'I bear witness that Muhammad is the Messenger of Allah', repeat:2, weight:1.45},
  {ar:'حي على الصلاة', en:'Come to prayer', repeat:2, weight:1.25},
  {ar:'حي على الفلاح', en:'Come to success', repeat:2, weight:1.25},
  {ar:'الله أكبر', en:'Allah is the Greatest', repeat:2, weight:.95},
  {ar:'لا إله إلا الله', en:'There is no god but Allah', repeat:1, weight:1.45}
];
const FAJR_EXTRA_SEQUENCE={ar:'الصلاة خير من النوم', en:'Prayer is better than sleep', repeat:2, weight:1.25};

function getAzaanSequence(prayerName){
  const sequence=[];
  for(const item of AZAAN_BASE_SEQUENCE){
    if(item.ar==='الله أكبر' && item.repeat===2 && String(prayerName).toLowerCase()==='fajr'){
      for(let i=0;i<FAJR_EXTRA_SEQUENCE.repeat;i++){
        sequence.push({...FAJR_EXTRA_SEQUENCE, currentRepeat:i+1});
      }
    }
    for(let i=0;i<item.repeat;i++){
      sequence.push({...item, currentRepeat:i+1});
    }
  }
  return sequence;
}

function startAzaanVisual(prayerName,silentMode){
  const sequence=getAzaanSequence(prayerName);
  clearInterval(azaanVisualTimer);
  clearTimeout(silentAzaanEndTimer);
  silentAzaanEndTimer=null;
  azaanVisualIndex=-1;
  const visualStart=Date.now();

  function paint(item,index){
    if(index===azaanVisualIndex)return;
    azaanVisualIndex=index;
    $('azaanArabic').textContent=item.ar;
    $('azaanEnglish').textContent=item.en;
    $('azaanProgress').textContent=(index+1)+' / '+sequence.length;
  }

  function frame(){
    const fallbackDuration=String(prayerName).toLowerCase()==='fajr'?190:170;
    const duration=(Number.isFinite(audio.duration)&&audio.duration>20)?audio.duration:fallbackDuration;
    const totalWeight=sequence.reduce((sum,item)=>sum+item.weight,0);
    const silentElapsed=(Date.now()-visualStart)/1000;
    const elapsed=Math.max(0,Math.min(duration,silentMode?silentElapsed:(audio.currentTime||0)));
    if(silentMode && silentElapsed>=duration){ hideAzaanOverlay(); return; }
    let cursor=0;
    let index=sequence.length-1;
    for(let i=0;i<sequence.length;i++){
      cursor+=duration*(sequence[i].weight/totalWeight);
      if(elapsed<=cursor){index=i;break;}
    }
    paint(sequence[index],index);
  }

  frame();
  azaanVisualTimer=setInterval(frame,250);
}

function resolveAzaanPrayer(prayerName){
  if(prayerName)return prayerName;
  const next=getNext();
  return activePrayer(next.name)||next.name;
}

async function playAzaan(prayerName,options){
  const prayer=resolveAzaanPrayer(prayerName);
  options=options||{};
  const soundEnabled=options.force || isAzaanEnabled(prayer);
  activeAzaanPrayer=prayer;

  $('overlayPrayer').textContent=prayer.toUpperCase();
  $('overlayPrayerLabel').textContent='Azaan for '+prayer;
  $('adhanOverlay').classList.add('show');

  if(!soundEnabled){
    audio.pause();
    audio.currentTime=0;
    startAzaanVisual(prayer,true);
    showToast(prayer+' Azaan visual playing silently');
    return;
  }

  try{
    startAzaanVisual(prayer,false);
    audio.currentTime=0;
    await audio.play();
    showToast('Azaan playing for '+prayer);
  }catch(e){
    showToast('Tap once to allow audio');
  }
}

function hideAzaanOverlay(){
  clearInterval(azaanVisualTimer);
  clearTimeout(silentAzaanEndTimer);
  azaanVisualTimer=null;
  silentAzaanEndTimer=null;
  $('adhanOverlay').classList.remove('show');
}

function stopAzaan(){
  audio.pause();
  audio.currentTime=0;
  hideAzaanOverlay();
  showToast('Azaan stopped');
}

audio.onended=()=>hideAzaanOverlay();
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

$('testAzaan').onclick=()=>{playAzaan(null,{force:true});showAdmin();};
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
  PRAYER_ORDER.forEach(p=>{
    const key=stamp+'-'+p;
    if(now===mins(timings[p]) && lastFired!==key){
      lastFired=key;
      playAzaan(p);
    }
  });
}

loadAzaanPrefs();
loadTimingSourcePrefs();
renderAzaanControls();
bindAzaanDrawer();
bindLocationControls();
if(window.bindPremiumTimingSourceUI)window.bindPremiumTimingSourceUI();
loadTimes();
render();
setInterval(render,1000);
setInterval(autoFireAzaan,30000);
setInterval(loadTimes,6*60*60*1000);
setInterval(applyBurnInShift,60000);
setTimeout(applyBurnInShift,12000);

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
