
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
let lastActivePrayerName='';
let azaanVisualTimer=null;
let azaanVisualIndex=0;
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
const savedAzaanVolume=parseFloat(localStorage.getItem('aslima_azaan_volume')||'0.70');
audio.volume=Number.isFinite(savedAzaanVolume)?Math.max(0,Math.min(1,savedAzaanVolume)):.70;

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
    {name:'Jina Reader HTTPS',url:'https://r.jina.ai/https://'+url.replace(/^https?:\/\//,'')},
    {name:'Jina Reader HTTP',url:'https://r.jina.ai/http://'+url.replace(/^https?:\/\//,'')},
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
  const activeChanged=current!==lastActivePrayerName;
  document.querySelectorAll('.row').forEach(row=>{
    const isCurrent=row.dataset.prayer===current;
    row.classList.toggle('active',isCurrent);
    if(isCurrent && activeChanged){
      row.classList.remove('active-shift');
      void row.offsetWidth;
      row.classList.add('active-shift');
      setTimeout(()=>row.classList.remove('active-shift'),900);
    }else if(!isCurrent){
      row.classList.remove('active-shift');
    }
  });
  lastActivePrayerName=current||'';

  $('jumuah').innerHTML='<b>Jumu’ah Prayer</b><span>'+CONFIG.jumuah.join('</span><span>•</span><span>')+'</span>';
  updateProgress();
  updateVolumeLabel();
  renderLocationControls();
}



// ===== ASLIMA FIREBASE PHONE REMOTE SYNC =====
let aslimaRemoteReady=false;
let aslimaRemoteLastCommand='';
window.aslimaRemoteManualEnabled=false;
window.aslimaRemoteManualTimings=null;

function aslimaRemoteValidTime(v){return typeof v==='string' && /^\d{2}:\d{2}$/.test(v);}
function aslimaRemoteCleanTimings(input){
  const out={};
  if(!input || typeof input!=='object')return out;
  ['Fajr','Sunrise','Dhuhr','Asr','Maghrib','Isha'].forEach(k=>{
    if(aslimaRemoteValidTime(input[k]))out[k]=input[k];
  });
  return out;
}
function applyAslimaRemoteSettings(data){
  if(!data || typeof data!=='object')return;
  try{
    const remoteTimings=aslimaRemoteCleanTimings(data.timings||{});
    if(data.mode==='manual' && ['Fajr','Dhuhr','Asr','Maghrib','Isha'].every(k=>remoteTimings[k])){
      window.aslimaRemoteManualEnabled=true;
      window.aslimaRemoteManualTimings={...timings,...remoteTimings};
      timings={...window.aslimaRemoteManualTimings};
      lastVricSyncStatus='Phone remote: manual prayer times active';
    }else if(data.mode==='vric'){
      const wasManual=window.aslimaRemoteManualEnabled;
      window.aslimaRemoteManualEnabled=false;
      window.aslimaRemoteManualTimings=null;
      CONFIG.timingSource='vric';
      if(wasManual)loadTimes();
      lastVricSyncStatus='Phone remote: VRIC live mode active';
    }
    if(Array.isArray(data.jumuah) && data.jumuah.length){
      CONFIG.jumuah=data.jumuah.filter(x=>typeof x==='string' && x.trim()).slice(0,4);
    }
    if(data.azaanEnabled && typeof data.azaanEnabled==='object'){
      PRAYER_ORDER.forEach(p=>{ if(typeof data.azaanEnabled[p]==='boolean')azaanEnabled[p]=data.azaanEnabled[p]; });
      saveAzaanPrefs();
      renderAzaanControls();
    }
    if(typeof data.volume==='number' && Number.isFinite(data.volume)){
      audio.volume=Math.max(0,Math.min(1,data.volume));
      localStorage.setItem('aslima_azaan_volume',String(audio.volume));
      updateVolumeLabel();
    }
    if(data.command && data.command.id && data.command.id!==aslimaRemoteLastCommand){
      aslimaRemoteLastCommand=data.command.id;
      if(data.command.type==='testAzaan')playAzaan(data.command.prayer||null,{force:true});
      if(data.command.type==='stopAzaan')stopAzaan();
    }
    render();
  }catch(e){console.warn('Aslima remote apply failed',e);}
}
function initAslimaFirebaseRemote(){
  try{
    if(!window.firebase || !window.ASLIMA_REMOTE || !window.ASLIMA_REMOTE.config)return;
    if(!firebase.apps.length)firebase.initializeApp(window.ASLIMA_REMOTE.config);
    const ref=firebase.database().ref(window.ASLIMA_REMOTE.path);
    ref.on('value',snap=>{
      aslimaRemoteReady=true;
      applyAslimaRemoteSettings(snap.val());
    },err=>{
      lastVricSyncStatus='Phone remote unavailable: '+(err && err.message ? err.message : 'Firebase error');
      render();
    });
    setTimeout(()=>showToast('Phone remote connected'),900);
  }catch(e){console.warn('Aslima Firebase remote unavailable',e);}
}

async function loadTimes(){
  if(window.aslimaRemoteManualEnabled && window.aslimaRemoteManualTimings){timings={...window.aslimaRemoteManualTimings};lastVricSyncStatus='Phone remote: manual prayer times active';render();return;}
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
  const pct=Math.round(audio.volume*100)+'%';
  const adminPct=$('volumePct');
  const drawerPct=$('drawerVolumePct');
  if(adminPct)adminPct.textContent=pct;
  if(drawerPct)drawerPct.textContent=pct;
}

function setVolume(v){
  audio.volume=Math.max(0,Math.min(1,v));
  audio.muted=false;
  try{localStorage.setItem('aslima_azaan_volume',String(audio.volume));}catch(e){}
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

function startAzaanVisual(prayerName){
  const sequence=getAzaanSequence(prayerName);
  clearInterval(azaanVisualTimer);
  azaanVisualIndex=-1;

  function paint(item,index){
    if(index===azaanVisualIndex)return;
    azaanVisualIndex=index;
    $('azaanArabic').textContent=item.ar;
    $('azaanEnglish').textContent=item.en;
  }

  function frame(){
    const fallbackDuration=String(prayerName).toLowerCase()==='fajr'?190:170;
    const duration=(Number.isFinite(audio.duration)&&audio.duration>20)?audio.duration:fallbackDuration;
    const totalWeight=sequence.reduce((sum,item)=>sum+item.weight,0);
    const elapsed=Math.max(0,Math.min(duration,audio.currentTime||0));
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
  if(!options.force && !isAzaanEnabled(prayer)){
    showToast(prayer+' Azaan is off');
    return;
  }
  activeAzaanPrayer=prayer;
  try{
    $('overlayPrayer').textContent=prayer.toUpperCase();
    startAzaanVisual(prayer);
    $('adhanOverlay').classList.add('show');
    document.body.classList.add('azaan-playing','adhan-playing','adhan-overlay-active');
    audio.currentTime=0;
    await audio.play();
    showToast('Azaan playing for '+prayer);
  }catch(e){
    showToast('Tap once to allow audio');
  }
}

function hideAzaanOverlay(){
  clearInterval(azaanVisualTimer);
  azaanVisualTimer=null;
  $('adhanOverlay').classList.remove('show');
  document.body.classList.remove('azaan-playing','adhan-playing','adhan-overlay-active');
}

function stopAzaan(){
  audio.pause();
  audio.currentTime=0;
  hideAzaanOverlay();
  showToast('Azaan stopped');
}

audio.onended=()=>hideAzaanOverlay();
audio.onerror=()=>showToast('Internet needed for Azaan');

function showAdmin(opts){
  const adminEl=$('admin');
  const allowed=(opts&&opts.fromDrawer===true)||window.__ASLIMA_ADMIN_DRAWER_AUTH===true||(adminEl&&adminEl.classList.contains('show'));
  if(!allowed){return false;}
  if(adminEl)adminEl.classList.add('show');
  clearTimeout(showAdmin.timer);
  showAdmin.timer=setTimeout(()=>{const a=$('admin'); if(a)a.classList.remove('show');},15000);
  return true;
}

let taps=0,tapTimer=null;
function adminTap(e){
  // Disabled: admin menu now opens from the Azaan drawer Admin button.
  if(e){e.preventDefault();e.stopPropagation();}
  taps=0;
}

// Admin access moved into the Azaan drawer. The old hidden 5-tap hotspot/brand trigger is intentionally disabled.
const openAdminFromDrawerBtn = $('openAdminFromDrawer');
if(openAdminFromDrawerBtn){
  openAdminFromDrawerBtn.onclick=(e)=>{
    if(e){e.preventDefault();e.stopPropagation();}
    window.__ASLIMA_ADMIN_DRAWER_AUTH=true;
    try{showAdmin({fromDrawer:true});}finally{setTimeout(()=>{window.__ASLIMA_ADMIN_DRAWER_AUTH=false;},0);}
  };
}



/* ASLIMA V8.7.2 — hard-disable legacy 5-tap admin access.
   Admin can only open from the Azaan drawer button. */
(function(){
  function blockLegacyAdminTap(e){
    var t=e && e.target;
    if(!t || !t.closest)return;
    if(t.closest('#brand') || t.closest('#adminHotspot')){
      e.preventDefault();
      e.stopImmediatePropagation();
      e.stopPropagation();
      window.__ASLIMA_ADMIN_DRAWER_AUTH=false;
      var a=document.getElementById('admin');
      if(a && !a.__drawerOpenApproved)a.classList.remove('show');
      return false;
    }
  }
  ['pointerdown','pointerup','touchstart','touchend','mousedown','mouseup','click','dblclick'].forEach(function(ev){
    document.addEventListener(ev,blockLegacyAdminTap,true);
  });
  var h=document.getElementById('adminHotspot');
  if(h){h.removeAttribute('onclick');h.hidden=true;h.style.display='none';h.style.pointerEvents='none';}
  var b=document.getElementById('brand');
  if(b){b.removeAttribute('onclick');}
})();

function bindAzaanAudioControls(){
  const test=$('testAzaan');
  const stop=$('stopAzaan');
  const overlayStop=$('overlayStop');
  const volDown=$('volDown');
  const volUp=$('volUp');
  const drawerTest=$('drawerTestAzaan');
  const drawerStop=$('drawerStopAzaan');
  const drawerVolDown=$('drawerVolDown');
  const drawerVolUp=$('drawerVolUp');

  if(test)test.onclick=()=>{playAzaan(null,{force:true});showAdmin();};
  if(stop)stop.onclick=()=>{stopAzaan();showAdmin();};
  if(overlayStop)overlayStop.onclick=stopAzaan;
  if(volDown)volDown.onclick=()=>{setVolume(audio.volume-.1);showAdmin();};
  if(volUp)volUp.onclick=()=>{setVolume(audio.volume+.1);showAdmin();};

  if(drawerTest)drawerTest.onclick=(e)=>{
    if(e){e.preventDefault();e.stopPropagation();}
    playAzaan(null,{force:true});
  };
  if(drawerStop)drawerStop.onclick=(e)=>{
    if(e){e.preventDefault();e.stopPropagation();}
    stopAzaan();
  };
  if(drawerVolDown)drawerVolDown.onclick=(e)=>{
    if(e){e.preventDefault();e.stopPropagation();}
    setVolume(audio.volume-.1);
  };
  if(drawerVolUp)drawerVolUp.onclick=(e)=>{
    if(e){e.preventDefault();e.stopPropagation();}
    setVolume(audio.volume+.1);
  };

  const refresh=$('refreshTimes');
  const dashboard=$('dashboard15');
  if(refresh)refresh.onclick=()=>{loadTimes();showAdmin();};
  if(dashboard)dashboard.onclick=()=>{showToast('Clean premium display active');showAdmin();};
  updateVolumeLabel();
}
bindAzaanAudioControls();

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





/* ASLIMA V8.7 — drawer closed by default, drag-only/tap handle controller */
(function(){
  function drawer(){return document.getElementById('azaanDrawer')||document.querySelector('.azaan-drawer');}
  function tab(){return document.getElementById('azaanDrawerTab')||document.querySelector('.azaan-drawer-tab');}
  function setOpen(open){
    var d=drawer(); if(!d)return;
    d.classList.toggle('open',!!open);
    document.body.classList.toggle('azaan-drawer-open',!!open);
    document.body.classList.toggle('drawer-open',!!open);
  }
  function bind(){
    var d=drawer(), t=tab(); if(!d||!t)return;
    // Always boot collapsed so the panel is not permanently open after reload or a prior bad state.
    setOpen(false);
    t.innerHTML='';
    t.setAttribute('aria-label','Open Azaan controls');
    if(t.__v77Bound)return;
    t.__v77Bound=true;
    var sx=0, sy=0, dragging=false, moved=false;
    function p(e){return (e.touches&&e.touches[0])||(e.changedTouches&&e.changedTouches[0])||e;}
    function down(e){dragging=true;moved=false;var q=p(e);sx=q.clientX||0;sy=q.clientY||0;}
    function move(e){
      if(!dragging)return;
      var q=p(e), dx=(q.clientX||0)-sx, dy=(q.clientY||0)-sy;
      if(Math.abs(dx)>14 && Math.abs(dx)>Math.abs(dy)){
        moved=true;
        if(dx<0)setOpen(true);
        if(dx>0)setOpen(false);
        if(e.cancelable)e.preventDefault();
      }
    }
    function up(e){
      if(!dragging)return;
      dragging=false;
      if(!moved){
        var isOpen=d.classList.contains('open')||document.body.classList.contains('azaan-drawer-open');
        setOpen(!isOpen);
      }
    }
    ['pointerdown','touchstart','mousedown'].forEach(function(ev){t.addEventListener(ev,down,{passive:true});});
    ['pointermove','touchmove','mousemove'].forEach(function(ev){window.addEventListener(ev,move,{passive:false});});
    ['pointerup','touchend','mouseup','pointercancel','touchcancel'].forEach(function(ev){window.addEventListener(ev,up,{passive:false});});
    var close=document.getElementById('azaanDrawerClose'); if(close)close.addEventListener('click',function(){setOpen(false);});
  }
  bind();
  window.addEventListener('load',bind);
  setTimeout(bind,300);
})();

/* ASLIMA V8.7 — Persistent Drag Handle controller */
(function(){
  function sourceMode(){
    return CONFIG && CONFIG.timingSource === 'calculated-location' ? 'calculated-location' : 'vric';
  }
  function setTimingScreen(open){
    if(window.setTimingSourceScreenOpenV82){window.setTimingSourceScreenOpenV82(open);return;}
    const screen=document.getElementById('timingSourceScreen');
    if(screen){screen.classList.toggle('open',!!open);screen.setAttribute('aria-hidden',open?'false':'true');}
    document.body.classList.toggle('timing-source-expanded',!!open);
  }
  function labelForMode(mode){
    if(mode==='calculated-location'){
      return {
        icon:'⌖',
        title:'Calculated from Location',
        sub:'Using current location of this tablet'
      };
    }
    return {
      icon:'⌁',
      title:'VRIC Live',
      sub:'Official live prayer timings'
    };
  }
  window.renderPremiumTimingSourceUI=function(){
    const mode=sourceMode();
    const info=labelForMode(mode);
    const icon=document.getElementById('timingCurrentIcon');
    const title=document.getElementById('timingCurrentTitle');
    const sub=document.getElementById('timingCurrentSub');
    const vric=document.getElementById('vricSourceCard');
    const loc=document.getElementById('locationSourceCard');
    const panel=document.getElementById('locationSettingsPanel');
    const method=document.getElementById('calcMethodSelect');
    const locationLabel=document.getElementById('calculatedLocationLabel');
    if(icon)icon.textContent=info.icon;
    if(title)title.textContent=info.title;
    if(sub)sub.textContent=info.sub;
    if(vric)vric.classList.toggle('active',mode==='vric');
    if(loc)loc.classList.toggle('active',mode==='calculated-location');
    if(panel)panel.classList.toggle('show',mode==='calculated-location');
    if(method)method.value=String(CONFIG.method||2);
    if(locationLabel){
      if(CONFIG.geoLat && CONFIG.geoLon){
        locationLabel.textContent=Number(CONFIG.geoLat).toFixed(4)+', '+Number(CONFIG.geoLon).toFixed(4);
      }else{
        locationLabel.textContent='Tablet location';
      }
    }
  };
  window.bindPremiumTimingSourceUI=function(){
    const open=document.getElementById('openTimingSourceScreen');
    const close=document.getElementById('closeTimingSourceScreen');
    const vric=document.getElementById('vricSourceCard');
    const loc=document.getElementById('locationSourceCard');
    const refreshLoc=document.getElementById('refreshLocationButton');
    if(open && !open.__v80Bound){open.__v80Bound=true;open.onclick=()=>setTimingScreen(true);}
    if(close && !close.__v80Bound){close.__v80Bound=true;close.onclick=()=>setTimingScreen(false);}
    if(vric && !vric.__v80Bound){
      vric.__v80Bound=true;
      vric.onclick=async()=>{
        CONFIG.timingSource='vric';
        saveTimingSourcePrefs();
        renderPremiumTimingSourceUI();
        showToast('Using VRIC live timings');
        await loadTimes();
      };
    }
    if(loc && !loc.__v80Bound){
      loc.__v80Bound=true;
      loc.onclick=async()=>{
        CONFIG.timingSource='calculated-location';
        saveTimingSourcePrefs();
        renderPremiumTimingSourceUI();
        showToast('Using calculated tablet-location timings');
        await loadTimes();
      };
    }
    if(refreshLoc && !refreshLoc.__v80Bound){
      refreshLoc.__v80Bound=true;
      refreshLoc.onclick=async()=>{
        CONFIG.timingSource='calculated-location';
        saveTimingSourcePrefs();
        showToast('Refreshing location');
        await loadTimes();
      };
    }
    renderPremiumTimingSourceUI();
  };
  window.addEventListener('load',()=>{bindPremiumTimingSourceUI();renderPremiumTimingSourceUI();});
  setTimeout(()=>{bindPremiumTimingSourceUI();renderPremiumTimingSourceUI();},500);
})();


/* ASLIMA V8.7 — timing modal fit and close behavior */
(function(){
  const oldSet = window.__aslimaSetTimingScreen;
  window.setTimingSourceScreenOpenV81=function(open){
    if(window.setTimingSourceScreenOpenV82){window.setTimingSourceScreenOpenV82(open);return;}
    const screen=document.getElementById('timingSourceScreen');
    if(screen){screen.classList.toggle('open',!!open);screen.setAttribute('aria-hidden',open?'false':'true');}
    document.body.classList.toggle('timing-source-expanded',!!open);
  };
  function bindV81(){
    const backdrop=document.getElementById('timingSourceBackdrop');
    const open=document.getElementById('openTimingSourceScreen');
    const close=document.getElementById('closeTimingSourceScreen');
    if(backdrop && !backdrop.__v81Bound){backdrop.__v81Bound=true;backdrop.onclick=()=>window.setTimingSourceScreenOpenV81(false);}
    if(open && !open.__v81Rebound){
      open.__v81Rebound=true;
      open.addEventListener('click',()=>window.setTimingSourceScreenOpenV81(true),true);
    }
    if(close && !close.__v81Rebound){
      close.__v81Rebound=true;
      close.addEventListener('click',()=>window.setTimingSourceScreenOpenV81(false),true);
    }
  }
  document.addEventListener('keydown',e=>{if(e.key==='Escape')window.setTimingSourceScreenOpenV81(false);});
  window.addEventListener('load',bindV81);
  setTimeout(bindV81,500);
})();


/* ASLIMA V8.7 — expand drawer when Timing Source is opened */
(function(){
  function screen(open){
    const s=document.getElementById('timingSourceScreen');
    const b=document.getElementById('timingSourceBackdrop');
    if(s){
      s.classList.toggle('open',!!open);
      s.setAttribute('aria-hidden',open?'false':'true');
    }
    if(b)b.classList.toggle('open',false);
    document.body.classList.toggle('timing-source-expanded',!!open);
    document.body.classList.toggle('azaan-drawer-open',true);
    document.body.classList.toggle('drawer-open',true);
    const d=document.getElementById('azaanDrawer') || document.querySelector('.azaan-drawer') || document.querySelector('.azaanControlsDrawer');
    if(d)d.classList.add('open');
  }
  window.setTimingSourceScreenOpenV82=function(open){ if(window.setTimingSourceScreenOpenV83){window.setTimingSourceScreenOpenV83(open);return;} screen(open); };

  function bind(){
    const open=document.getElementById('openTimingSourceScreen');
    const close=document.getElementById('closeTimingSourceScreen');
    const backdrop=document.getElementById('timingSourceBackdrop');
    if(open && !open.__v82Bound){
      open.__v82Bound=true;
      open.addEventListener('click',function(e){
        e.preventDefault();
        e.stopPropagation();
        screen(true);
      },true);
    }
    if(close && !close.__v82Bound){
      close.__v82Bound=true;
      close.addEventListener('click',function(e){
        e.preventDefault();
        e.stopPropagation();
        screen(false);
      },true);
    }
    if(backdrop && !backdrop.__v82Bound){
      backdrop.__v82Bound=true;
      backdrop.addEventListener('click',()=>screen(false),true);
    }
  }

  document.addEventListener('keydown',e=>{if(e.key==='Escape')screen(false);});
  window.addEventListener('load',bind);
  setTimeout(bind,500);
})();


/* ASLIMA V8.7 — stable timing source overlay controller */
(function(){
  function drawer(){
    return document.getElementById('azaanDrawer') || document.querySelector('.azaan-drawer') || document.querySelector('.azaanControlsDrawer');
  }
  function setOverlay(open){
    const s=document.getElementById('timingSourceScreen');
    const b=document.getElementById('timingSourceBackdrop');
    if(s){
      s.classList.toggle('open',!!open);
      s.setAttribute('aria-hidden',open?'false':'true');
    }
    if(b)b.classList.toggle('open',!!open);
    document.body.classList.toggle('timing-source-expanded',!!open);
    if(open){
      const d=drawer();
      if(d)d.classList.add('open');
      document.body.classList.add('azaan-drawer-open','drawer-open');
    }
  }
  window.setTimingSourceScreenOpenV81=setOverlay;
  window.setTimingSourceScreenOpenV82=setOverlay;
  window.setTimingSourceScreenOpenV83=setOverlay;

  function bind(){
    const open=document.getElementById('openTimingSourceScreen');
    const close=document.getElementById('closeTimingSourceScreen');
    const x=document.getElementById('timingSourceXClose');
    const backdrop=document.getElementById('timingSourceBackdrop');

    if(open && !open.__v83Bound){
      open.__v83Bound=true;
      open.addEventListener('click',function(e){
        e.preventDefault();
        e.stopPropagation();
        setOverlay(true);
      },true);
    }
    [close,x].forEach(btn=>{
      if(btn && !btn.__v83Bound){
        btn.__v83Bound=true;
        btn.addEventListener('click',function(e){
          e.preventDefault();
          e.stopPropagation();
          setOverlay(false);
        },true);
      }
    });
    if(backdrop && !backdrop.__v83Bound){
      backdrop.__v83Bound=true;
      backdrop.addEventListener('click',function(e){
        e.preventDefault();
        setOverlay(false);
      },true);
    }
  }
  document.addEventListener('keydown',e=>{if(e.key==='Escape')setOverlay(false);});
  window.addEventListener('load',bind);
  setTimeout(bind,300);
  setTimeout(bind,1000);
})();


/* ASLIMA V8.7 — keep timing source window open after selection */
(function(){
  function setOverlay(open){
    const s=document.getElementById('timingSourceScreen');
    const b=document.getElementById('timingSourceBackdrop');
    if(s){
      s.classList.toggle('open',!!open);
      s.setAttribute('aria-hidden',open?'false':'true');
    }
    if(b)b.classList.toggle('open',!!open);
    document.body.classList.toggle('timing-source-expanded',!!open);
    const d=document.getElementById('azaanDrawer') || document.querySelector('.azaan-drawer') || document.querySelector('.azaanControlsDrawer');
    if(open && d)d.classList.add('open');
    if(open)document.body.classList.add('azaan-drawer-open','drawer-open');
  }
  window.setTimingSourceScreenOpenV81=setOverlay;
  window.setTimingSourceScreenOpenV82=setOverlay;
  window.setTimingSourceScreenOpenV83=setOverlay;
  window.setTimingSourceScreenOpenV84=setOverlay;

  function msg(text,on){
    const el=document.getElementById('timingSourceSelectionStatus');
    if(!el)return;
    el.textContent=text||'';
    el.classList.toggle('show',!!on);
  }

  async function chooseSource(mode){
    try{
      CONFIG.timingSource=mode;
      saveTimingSourcePrefs();
      if(window.renderPremiumTimingSourceUI)window.renderPremiumTimingSourceUI();
      setOverlay(true);
      msg(mode==='vric'?'Switching to VRIC live timings…':'Requesting tablet location…',true);
      if(typeof showToast==='function')showToast(mode==='vric'?'Using VRIC live timings':'Using calculated tablet-location timings');
      await loadTimes();
      if(window.renderPremiumTimingSourceUI)window.renderPremiumTimingSourceUI();
      setOverlay(true);
      msg('Timing source updated. Use X or Back to close.',true);
      setTimeout(()=>msg('',false),2800);
    }catch(e){
      setOverlay(true);
      msg('Could not update timing source. Check connection/location permission.',true);
      if(typeof showToast==='function')showToast('Timing source update failed');
    }
  }

  function bind(){
    const open=document.getElementById('openTimingSourceScreen');
    const close=document.getElementById('closeTimingSourceScreen');
    const x=document.getElementById('timingSourceXClose');
    const backdrop=document.getElementById('timingSourceBackdrop');
    const vric=document.getElementById('vricSourceCard');
    const loc=document.getElementById('locationSourceCard');
    const refreshLoc=document.getElementById('refreshLocationButton');

    if(open && !open.__v84Bound){
      open.__v84Bound=true;
      open.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();setOverlay(true);},true);
    }
    [close,x].forEach(btn=>{
      if(btn && !btn.__v84Bound){
        btn.__v84Bound=true;
        btn.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();setOverlay(false);},true);
      }
    });
    if(backdrop && !backdrop.__v84Bound){
      backdrop.__v84Bound=true;
      backdrop.addEventListener('click',e=>{e.preventDefault();setOverlay(false);},true);
    }
    if(vric && !vric.__v84Bound){
      vric.__v84Bound=true;
      vric.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();chooseSource('vric');},true);
    }
    if(loc && !loc.__v84Bound){
      loc.__v84Bound=true;
      loc.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();chooseSource('calculated-location');},true);
    }
    if(refreshLoc && !refreshLoc.__v84Bound){
      refreshLoc.__v84Bound=true;
      refreshLoc.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();chooseSource('calculated-location');},true);
    }
  }
  document.addEventListener('keydown',e=>{if(e.key==='Escape')setOverlay(false);});
  window.addEventListener('load',bind);
  setTimeout(bind,250);
  setTimeout(bind,1000);
})();


/* ASLIMA V8.7 — True Persistent Drag Handle Controller */
(function(){
  function currentMode(){return CONFIG && CONFIG.timingSource==='calculated-location'?'calculated-location':'vric';}
  function setGlobalModal(open){
    const modal=document.getElementById('globalTimingModal');
    const backdrop=document.getElementById('globalTimingBackdrop');
    if(modal){modal.classList.toggle('open',!!open);modal.setAttribute('aria-hidden',open?'false':'true');}
    if(backdrop){backdrop.classList.toggle('open',!!open);backdrop.setAttribute('aria-hidden',open?'false':'true');}
    document.body.classList.toggle('global-timing-open',!!open);
  }
  window.setTimingSourceScreenOpenV81=setGlobalModal;
  window.setTimingSourceScreenOpenV82=setGlobalModal;
  window.setTimingSourceScreenOpenV83=setGlobalModal;
  window.setTimingSourceScreenOpenV84=setGlobalModal;
  window.setGlobalTimingModalOpen=setGlobalModal;

  function setStatus(text,on){const el=document.getElementById('globalTimingStatus'); if(el){el.textContent=text||'';el.classList.toggle('show',!!on);}}
  function render(){
    const m=currentMode();
    const v=document.getElementById('globalVricSourceCard'), l=document.getElementById('globalLocationSourceCard'), p=document.getElementById('globalLocationPanel');
    const method=document.getElementById('globalCalcMethodSelect'), label=document.getElementById('globalLocationLabel');
    if(v)v.classList.toggle('active',m==='vric');
    if(l)l.classList.toggle('active',m==='calculated-location');
    if(p)p.classList.toggle('show',m==='calculated-location');
    if(method)method.value=String(CONFIG.method||2);
    if(label)label.textContent=(CONFIG.geoLat&&CONFIG.geoLon)?(Number(CONFIG.geoLat).toFixed(4)+', '+Number(CONFIG.geoLon).toFixed(4)):'Tablet location';
    if(window.renderPremiumTimingSourceUI)window.renderPremiumTimingSourceUI();
  }
  async function choose(source){
    try{
      CONFIG.timingSource=source; saveTimingSourcePrefs(); render(); setGlobalModal(true);
      setStatus(source==='vric'?'Switching to VRIC live timings…':'Requesting tablet location…',true);
      if(typeof showToast==='function')showToast(source==='vric'?'Using VRIC live timings':'Using calculated tablet-location timings');
      await loadTimes(); render(); setGlobalModal(true);
      setStatus('Timing source updated. Close when ready.',true);
      setTimeout(()=>setStatus('',false),2600);
    }catch(e){setGlobalModal(true);setStatus('Could not update timing source. Check connection/location permission.',true);}
  }
  function bind(){
    const opener=document.getElementById('openTimingSourceScreen');
    const back=document.getElementById('globalTimingBack'), x=document.getElementById('globalTimingCloseX'), backdrop=document.getElementById('globalTimingBackdrop');
    const v=document.getElementById('globalVricSourceCard'), l=document.getElementById('globalLocationSourceCard'), method=document.getElementById('globalCalcMethodSelect'), refresh=document.getElementById('globalRefreshLocation');
    if(opener&&!opener.__v85Bound){opener.__v85Bound=true;opener.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();render();setGlobalModal(true);},true);}
    [back,x].forEach(btn=>{if(btn&&!btn.__v85Bound){btn.__v85Bound=true;btn.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();setGlobalModal(false);},true);}});
    if(backdrop&&!backdrop.__v85Bound){backdrop.__v85Bound=true;backdrop.addEventListener('click',e=>{e.preventDefault();setGlobalModal(false);},true);}
    if(v&&!v.__v85Bound){v.__v85Bound=true;v.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();choose('vric');},true);}
    if(l&&!l.__v85Bound){l.__v85Bound=true;l.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();choose('calculated-location');},true);}
    if(method&&!method.__v85Bound){method.__v85Bound=true;method.addEventListener('change',async e=>{CONFIG.method=parseInt(e.target.value,10)||2;saveTimingSourcePrefs();render();if(currentMode()==='calculated-location')await choose('calculated-location');});}
    if(refresh&&!refresh.__v85Bound){refresh.__v85Bound=true;refresh.addEventListener('click',e=>{e.preventDefault();choose('calculated-location');},true);}
    render();
  }
  document.addEventListener('keydown',e=>{if(e.key==='Escape')setGlobalModal(false);});
  window.addEventListener('load',bind); setTimeout(bind,300); setTimeout(bind,1000);
})();


/* ASLIMA V8.7 — decouple Timing Source modal from Azaan drawer state */
(function(){
  function findDrawer(){
    return document.getElementById('azaanDrawer') ||
      document.querySelector('.azaan-drawer') ||
      document.querySelector('.azaanControlsDrawer');
  }

  function drawerWasOpen(){
    const d=findDrawer();
    return !!(d && (d.classList.contains('open') ||
      document.body.classList.contains('azaan-drawer-open') ||
      document.body.classList.contains('drawer-open')));
  }

  let drawerStateBeforeTimingModal = false;

  function normalizeDrawer(open){
    const d=findDrawer();
    if(d)d.classList.toggle('open',!!open);
    document.body.classList.toggle('azaan-drawer-open',!!open);
    document.body.classList.toggle('drawer-open',!!open);
  }

  function setGlobalModalStable(open){
    const modal=document.getElementById('globalTimingModal');
    const backdrop=document.getElementById('globalTimingBackdrop');

    if(open){
      drawerStateBeforeTimingModal = drawerWasOpen();
      /* Keep drawer exactly as-is visually; do not force it open or closed. */
      document.body.classList.remove('timing-source-expanded');
    }

    if(modal){
      modal.classList.toggle('open',!!open);
      modal.setAttribute('aria-hidden',open?'false':'true');
    }
    if(backdrop){
      backdrop.classList.toggle('open',!!open);
      backdrop.setAttribute('aria-hidden',open?'false':'true');
    }

    document.body.classList.toggle('global-timing-open',!!open);

    if(!open){
      document.body.classList.remove('timing-source-expanded');
      normalizeDrawer(drawerStateBeforeTimingModal);
      setTimeout(function(){
        document.body.classList.remove('timing-source-expanded');
        normalizeDrawer(drawerStateBeforeTimingModal);
      },60);
    }
  }

  window.setGlobalTimingModalOpen=setGlobalModalStable;
  window.setTimingSourceScreenOpenV81=setGlobalModalStable;
  window.setTimingSourceScreenOpenV82=setGlobalModalStable;
  window.setTimingSourceScreenOpenV83=setGlobalModalStable;
  window.setTimingSourceScreenOpenV84=setGlobalModalStable;
  window.setTimingSourceScreenOpenV85=setGlobalModalStable;
  window.setTimingSourceScreenOpenV86=setGlobalModalStable;

  function bindV86(){
    const opener=document.getElementById('openTimingSourceScreen');
    const back=document.getElementById('globalTimingBack');
    const x=document.getElementById('globalTimingCloseX');
    const backdrop=document.getElementById('globalTimingBackdrop');

    if(opener && !opener.__v86Bound){
      opener.__v86Bound=true;
      opener.addEventListener('click',function(e){
        e.preventDefault();
        e.stopImmediatePropagation();
        setGlobalModalStable(true);
      },true);
    }

    [back,x].forEach(function(btn){
      if(btn && !btn.__v86Bound){
        btn.__v86Bound=true;
        btn.addEventListener('click',function(e){
          e.preventDefault();
          e.stopImmediatePropagation();
          setGlobalModalStable(false);
        },true);
      }
    });

    if(backdrop && !backdrop.__v86Bound){
      backdrop.__v86Bound=true;
      backdrop.addEventListener('click',function(e){
        e.preventDefault();
        e.stopImmediatePropagation();
        setGlobalModalStable(false);
      },true);
    }
  }

  document.addEventListener('keydown',function(e){
    if(e.key==='Escape')setGlobalModalStable(false);
  },true);

  window.addEventListener('load',bindV86);
  setTimeout(bindV86,250);
  setTimeout(bindV86,1000);
})();


/* ASLIMA V8.7 — Persistent Handle Drawer Controller */
(function(){
  function drawer(){
    return document.getElementById('azaanDrawer') ||
      document.querySelector('.azaan-drawer') ||
      document.querySelector('.azaanControlsDrawer');
  }
  function isOpen(){
    const d=drawer();
    return !!(d && (d.classList.contains('open') ||
      document.body.classList.contains('azaan-drawer-open') ||
      document.body.classList.contains('drawer-open')));
  }
  function setDrawer(open){
    const d=drawer();
    if(d)d.classList.toggle('open',!!open);
    document.body.classList.toggle('azaan-drawer-open',!!open);
    document.body.classList.toggle('drawer-open',!!open);
    document.body.classList.remove('timing-source-expanded');
  }
  window.aslimaSetAzaanDrawerOpen=setDrawer;

  function bind(){
    const h=document.getElementById('aslimaPersistentHandle');
    if(!h || h.__v87Bound)return;
    h.__v87Bound=true;

    let sx=0, sy=0, moved=false, down=false;
    function point(e){return e.touches ? e.touches[0] : e;}
    function downFn(e){
      down=true; moved=false;
      const p=point(e); sx=p.clientX; sy=p.clientY;
    }
    function moveFn(e){
      if(!down)return;
      const p=point(e);
      const dx=p.clientX-sx, dy=p.clientY-sy;
      if(Math.abs(dx)>18 && Math.abs(dx)>Math.abs(dy)){
        moved=true;
        setDrawer(dx<0);
        if(e.preventDefault)e.preventDefault();
      }
    }
    function upFn(e){
      if(!moved)setDrawer(!isOpen());
      down=false;
      if(e && e.preventDefault)e.preventDefault();
    }

    h.addEventListener('pointerdown',downFn,{passive:true});
    h.addEventListener('pointermove',moveFn,{passive:false});
    h.addEventListener('pointerup',upFn,{passive:false});
    h.addEventListener('touchstart',downFn,{passive:true});
    h.addEventListener('touchmove',moveFn,{passive:false});
    h.addEventListener('touchend',upFn,{passive:false});
    h.addEventListener('click',function(e){e.preventDefault();},{passive:false});
  }

  window.addEventListener('load',bind);
  setTimeout(bind,250);
  setTimeout(bind,1000);
})();

