const CACHE='aslima-v952-prayer-aware-icons';
const SCHEDULE_CSS='./assets/prayer-schedule-v951.css';
const ICONS_CSS='./assets/prayer-icons-v952.css';
const SCHEDULE_MARKER='data-aslima-schedule-style="v951"';
const ICONS_MARKER='data-aslima-prayer-icons="v952"';
const CORE=[
  './','./index.html','./preview.html','./admin.html','./data/vric-prayer-times.json',
  './assets/aslima-premium-bg.png',SCHEDULE_CSS,ICONS_CSS,
  './assets/audio/azaan-1.mp3','./assets/audio/azaan-2.mp3',
  './assets/audio/azaan-3.mp3','./assets/audio/azaan-4.mp3',
  './assets/audio/azaan-5.mp3'
];
self.addEventListener('install',event=>event.waitUntil(
  caches.open(CACHE).then(cache=>cache.addAll(CORE)).then(()=>self.skipWaiting())
));
self.addEventListener('activate',event=>event.waitUntil(
  caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())
));
function isDisplayDocument(url){
  return /\/(?:index|preview)\.html$/i.test(url.pathname)||url.pathname.endsWith('/');
}
async function addPrayerStyles(response){
  if(!response||!response.ok)return response;
  const type=response.headers.get('content-type')||'';
  if(!type.includes('text/html'))return response;
  let html=await response.text();
  html=html.replace(/<link[^>]+data-aslima-heading-style="v950"[^>]*>\s*/ig,'');
  html=html.replace(/<link[^>]+data-aslima-schedule-style="v951"[^>]*>\s*/ig,'');
  html=html.replace(/<link[^>]+data-aslima-prayer-icons="v952"[^>]*>\s*/ig,'');
  const links=[
    `<link rel="stylesheet" href="${SCHEDULE_CSS}" ${SCHEDULE_MARKER}>`,
    `<link rel="stylesheet" href="${ICONS_CSS}" ${ICONS_MARKER}>`
  ].join('\n');
  html=/<\/head>/i.test(html)?html.replace(/<\/head>/i,`${links}\n</head>`):`${links}\n${html}`;
  const headers=new Headers(response.headers);
  headers.delete('content-length');
  headers.set('content-type','text/html; charset=utf-8');
  return new Response(html,{status:response.status,statusText:response.statusText,headers});
}
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin)return;
  const isAudio=/\/assets\/audio\/.*\.(mp3|ogg)$/i.test(url.pathname);
  if(isAudio){
    event.respondWith(caches.match(event.request).then(hit=>hit||fetch(event.request).then(response=>{
      if(!response.ok)throw new Error('Audio HTTP '+response.status);
      const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy));return response;
    })));
    return;
  }
  if(isDisplayDocument(url)){
    event.respondWith((async()=>{
      let response;
      try{
        response=await fetch(event.request);
        if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy));}
      }catch(_error){response=await caches.match(event.request,{ignoreSearch:true});}
      if(!response)throw new Error('Display document unavailable');
      return addPrayerStyles(response);
    })());
    return;
  }
  event.respondWith(fetch(event.request).then(response=>{
    if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy));}
    return response;
  }).catch(()=>caches.match(event.request,{ignoreSearch:true})));
});
