const CACHE='aslima-v925-exact-azaan-cues';
const CORE=[
  './','./index.html','./preview.html','./admin.html',
  './assets/aslima-premium-bg.png',
  './assets/audio/azaan-1.mp3','./assets/audio/azaan-2.mp3',
  './assets/audio/azaan-3.mp3','./assets/audio/azaan-4.mp3',
  './assets/audio/azaan-5.mp3',
  './assets/audio/AUDIO_SOURCE.md','./assets/audio/SHA256SUMS.txt'
];
self.addEventListener('install',event=>event.waitUntil(
  caches.open(CACHE).then(cache=>cache.addAll(CORE)).then(()=>self.skipWaiting())
));
self.addEventListener('activate',event=>event.waitUntil(
  caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())
));
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
  event.respondWith(fetch(event.request).then(response=>{
    if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy));}
    return response;
  }).catch(()=>caches.match(event.request)));
});
