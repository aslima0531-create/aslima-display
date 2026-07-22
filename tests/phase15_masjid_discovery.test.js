const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'assets/js/masjid-discovery-v962.js'),'utf8');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');

function load(){
  const context={console,URL,URLSearchParams,AbortController,setTimeout,clearTimeout};
  context.window=context;
  vm.runInNewContext(source,context,{filename:'masjid-discovery-v962.js'});
  return context.ASLIMAMasjidDiscovery;
}

test('nearby query is mosque-specific, bounded, and location-rounded',()=>{
  const api=load();
  const query=api.query(32.918543,-96.959012,999999);
  assert.match(query,/around:50000,32\.919,-96\.959/);
  assert.match(query,/"amenity"="place_of_worship"\]\["religion"="muslim"/);
  assert.match(query,/"building"="mosque"/);
  assert.doesNotMatch(query,/32\.918543/);
});

test('OpenStreetMap results normalize, deduplicate, and rank by distance',()=>{
  const api=load();
  const response={elements:[
    {type:'node',id:1,lat:32.92,lon:-96.96,tags:{name:'Valley Ranch Islamic Center',website:'https://vric.org'}},
    {type:'way',id:2,center:{lat:32.95,lon:-96.73},tags:{name:'Community Masjid','addr:city':'Richardson'}},
    {type:'node',id:3,lat:32.92,lon:-96.96,tags:{name:'Valley Ranch Islamic Center'}}
  ]};
  const results=api.normalize(response,{latitude:32.9185,longitude:-96.959},8);
  assert.equal(results.length,2);
  assert.equal(results[0].officialProvider,'vric');
  assert.equal(results[1].name,'Community Masjid');
  assert.ok(results[0].distanceMiles<results[1].distanceMiles);
});

test('same-name duplicate geometry from merged providers is collapsed',()=>{
  const api=load();
  const results=api.normalize({elements:[
    {type:'node',id:1,lat:32.91727,lon:-96.94784,tags:{name:'Valley Ranch Islamic Center',website:'https://vric.org'}},
    {type:'node',id:2,lat:32.91731,lon:-96.94780,tags:{name:'Valley Ranch Islamic Center'}}
  ]},{latitude:32.9185,longitude:-96.959},8);
  assert.equal(results.length,1);
});

test('official VRIC identity cannot be spoofed by a lookalike URL or distant duplicate name',()=>{
  const api=load();
  const results=api.normalize({elements:[
    {type:'node',id:1,lat:32.92,lon:-96.96,tags:{name:'Nearby Masjid',website:'https://evilvric.org'}},
    {type:'node',id:2,lat:40.71,lon:-74.00,tags:{name:'Valley Ranch Islamic Center'}}
  ]},{latitude:32.9185,longitude:-96.959},8);
  assert.deepEqual(Array.from(results,entry=>entry.officialProvider),['','']);
});

test('inactive or demolished map records are excluded',()=>{
  const api=load();
  const results=api.normalize({elements:[
    {type:'node',id:1,lat:32.91,lon:-96.95,tags:{name:'Closed Masjid',disused:'yes'}},
    {type:'node',id:2,lat:32.92,lon:-96.96,tags:{name:'Open Masjid'}}
  ]},{latitude:32.9185,longitude:-96.959},8);
  assert.deepEqual(Array.from(results,entry=>entry.name),['Open Masjid']);
});

test('unnamed map geometry is not shown as a selectable masjid',()=>{
  const api=load();
  const results=api.normalize({elements:[
    {type:'way',id:1,center:{lat:32.91,lon:-96.95},tags:{building:'mosque'}},
    {type:'node',id:2,lat:32.92,lon:-96.96,tags:{name:'Named Masjid'}}
  ]},{latitude:32.9185,longitude:-96.959},8);
  assert.deepEqual(Array.from(results,entry=>entry.name),['Named Masjid']);
});

test('discovery uses a POST request and honors the result limit',async()=>{
  const api=load();
  let request=null;
  const fetchFn=async(url,options)=>{request={url,options};return {ok:true,json:async()=>({elements:[
    {type:'node',id:1,lat:32.91,lon:-96.95,tags:{name:'One'}},
    {type:'node',id:2,lat:32.92,lon:-96.96,tags:{name:'Two'}}
  ]})};};
  const results=await api.discover({latitude:32.9185,longitude:-96.959,limit:1,fetchFn});
  assert.equal(results.length,1);
  assert.equal(request.options.method,'POST');
  assert.equal(request.options.headers.Accept,'application/json');
  assert.match(request.options.body,/^data=/);
});

test('configured worker proxy uses GET and never sends raw Overpass queries from the tablet',async()=>{
  const api=load();
  let request=null;
  const fetchFn=async(url,options)=>{request={url,options};return {ok:true,json:async()=>({elements:[{type:'node',id:1,lat:32.92,lon:-96.96,tags:{name:'Nearby Masjid'}}]})};};
  const results=await api.discover({latitude:32.918543,longitude:-96.959012,radiusMeters:15000,proxyEndpoint:'https://worker.example/nearby',fetchFn});
  assert.ok(results.some(item=>item.name==='Nearby Masjid'));
  assert.equal(request.options.method,'GET');
  assert.match(request.url,/lat=32\.918543/);
  assert.match(request.url,/radius=15000/);
  assert.equal('body' in request.options,false);
});

test('invalid tablet coordinates are rejected before any request',async()=>{
  const api=load();
  let called=false;
  await assert.rejects(()=>api.discover({latitude:200,longitude:0,fetchFn:async()=>{called=true;}}),/valid tablet location/);
  assert.equal(called,false);
});

test('verified Islamic Center of Irving is merged even when map providers omit it',async()=>{
  const api=load();
  const results=await api.discover({latitude:32.85,longitude:-97.01,radiusMeters:25000,limit:10,proxyEndpoint:'https://worker.example/nearby',fetchFn:async()=>({ok:true,json:async()=>({elements:[]})})});
  const ici=results.find(item=>item.id==='ici');
  assert.ok(ici);
  assert.equal(ici.officialProvider,'ici');
  assert.equal(ici.website,'https://www.irvingmasjid.org/');
});

test('verified ICI is retained when dense nearby results exceed the display limit',async()=>{
  const api=load();
  const elements=Array.from({length:12},(_,index)=>({
    type:'node',id:index+1,lat:32.8500+(index*0.0001),lon:-97.0100,
    tags:{name:'Nearby Masjid '+(index+1),amenity:'place_of_worship',religion:'muslim'}
  }));
  const results=await api.discover({latitude:32.85,longitude:-97.01,radiusMeters:25000,limit:10,proxyEndpoint:'https://worker.example/nearby',fetchFn:async()=>({ok:true,json:async()=>({elements})})});
  assert.equal(results.length,10);
  assert.ok(results.some(item=>item.id==='ici'));
});

test('ZIP discovery geocodes the area without requesting tablet location',async()=>{
  const api=load();
  const calls=[];
  const fetchFn=async url=>{calls.push(url);return url.includes('/geocode')?{ok:true,json:async()=>({postalCode:'75062',label:'Irving, TX 75062',latitude:32.85,longitude:-97.01})}:{ok:true,json:async()=>({elements:[]})};};
  const found=await api.discoverPostal({postalCode:'75062',radiusMeters:25000,limit:10,proxyEndpoint:'https://worker.example/nearby',fetchFn});
  assert.equal(found.area.postalCode,'75062');
  assert.ok(found.results.some(item=>item.id==='ici'));
  assert.match(calls[0],/\/geocode\?postalCode=75062/);
  assert.match(calls[1],/\/nearby\?lat=32\.850000&lon=-97\.010000/);
});

test('ZIP discovery rejects malformed postal codes before a request',async()=>{
  const api=load();
  let called=false;
  await assert.rejects(()=>api.discoverPostal({postalCode:'75A',proxyEndpoint:'https://worker.example/nearby',fetchFn:async()=>{called=true;}}),/valid 5-digit ZIP/);
  assert.equal(called,false);
});

test('drawer integration is opt-in, attributed, and separates official from calculated data',()=>{
  assert.match(html,/id="findNearbyMasjids"/);
  assert.match(html,/#tabletManualTimingBox:not\(\[data-mode="calculated-location"\]\) \.nearby-masjid-card\{display:none!important;\}/);
  assert.match(html,/id="masjidZipForm"/);
  assert.match(html,/Save a ZIP\/home area here/);
  assert.match(html,/© OpenStreetMap contributors/);
  assert.match(html,/source\.textContent=item\.officialProvider\?'Official':\(item\.website\?'Website check':'Calculated'\)/);
  assert.match(html,/allowVricSchedule===false\?calculated:mergeVricScheduleIntoCalculated/);
  assert.match(html,/CONFIG\.selectedMasjid\.officialProvider!==\'vric\'/);
  assert.match(html,/id="timingMasjidName"/);
  assert.match(html,/Calculated Adhan for \$\{selected\.name\}/);
  assert.match(html,/proxyEndpoint:CONFIG\.masjidSearchProxyUrl/);
  assert.match(html,/https:\/\/aslima-masjid-search\.aslima-azaan\.workers\.dev\/nearby/);
  assert.match(html,/CONFIG\.selectedMasjid=isVric\?null:/);
  assert.match(html,/CONFIG\.selectedMasjidId=isVric\?'vric'/);
  assert.match(html,/if\(isVric\)await loadTimes\(\{reason:'nearby-vric-selection',userInitiated:true\}\)/);
  assert.doesNotMatch(html,/id="showMissingMasjid"/);
  assert.match(html,/await syncDiscoveredMasjidTimes\(CONFIG\.selectedMasjid\)/);
  assert.match(html,/official-with-calculated-sunrise/);
  assert.match(html,/jumuahSchedule:official\.jumuahSchedule\|\|\[\]/);
  assert.match(html,/jumuah-row has-slots/);
  assert.match(html,/\.jumuah-row\.has-slots\{display:grid!important/);
  assert.match(html,/<small>Azaan<\/small>/);
  assert.match(html,/<small>Iqamah<\/small>/);
  assert.match(html,/try\{return await syncOfficialIciTimes\(\);\}catch\(officialError\)\{\}/);
  assert.match(html,/try\{return await syncOfficialWebsiteTimes\(masjid\);\}catch\(officialError\)\{\}/);
  assert.match(html,/\/schedule\/resolve/);
  assert.match(html,/resolver\.searchParams\.set\('lat',String\(masjid\.latitude\)\)/);
  assert.match(html,/resolver\.searchParams\.set\('lon',String\(masjid\.longitude\)\)/);
  assert.doesNotMatch(html,/if\(masjid\.website\)\{\s*try\{return await syncOfficialWebsiteTimes/);
  assert.match(html,/officialMasjidCacheKey\(masjid\)/);
  assert.match(html,/official\.provider==='website-iqamah'/);
  assert.match(html,/official-iqamah-with-calculated-adhan/);
  assert.match(html,/websiteIqamah\.Maghrib==='SUNSET'/);
  assert.match(html,/\/\^AFTER:\\d\+\$\//);
  assert.match(html,/item\.website\?'Website check':'Calculated'/);
  assert.match(html,/Official schedule unavailable — using calculated times near/);
  assert.match(html,/radiusMeters:25000,limit:10/);
  assert.match(html,/id:'postal-'\+found\.area\.postalCode/);
  assert.match(html,/Applying calculated ZIP-area timings/);
  assert.match(html,/await choose\(zipFallback\)/);
});

test('selected masjid persists without storing the tablet discovery location',()=>{
  const persisted=html.match(/selectedMasjid:CONFIG\.selectedMasjid[\s\S]*?\}:null,/);
  assert.ok(persisted);
  assert.match(persisted[0],/latitude:CONFIG\.selectedMasjid\.latitude/);
  assert.match(persisted[0],/longitude:CONFIG\.selectedMasjid\.longitude/);
  assert.match(persisted[0],/website:CONFIG\.selectedMasjid\.website/);
  assert.doesNotMatch(persisted[0],/deviceLatitude|deviceLongitude|searchLatitude|searchLongitude/);
});

test('saved home area replaces Fully-only geolocation for kiosk discovery',()=>{
  const functionMatch=html.match(/(function normalizeHomeLocation\(value\)\{[\s\S]*?\n\})\n\nfunction applyHomeLocation/);
  assert.ok(functionMatch,'home-location validator must be present');
  const context={};vm.runInNewContext(functionMatch[1],context);
  assert.deepEqual(JSON.parse(JSON.stringify(context.normalizeHomeLocation({latitude:32.91854,longitude:-96.95904,label:'Irving, TX 75063',postalCode:'75063',source:'zip',updatedAt:12}))),{latitude:32.919,longitude:-96.959,label:'Irving, TX 75063',postalCode:'75063',source:'zip',updatedAt:12});
  assert.equal(context.normalizeHomeLocation({latitude:120,longitude:0}),null);
  assert.match(html,/homeLocation:CONFIG\.homeLocation/);
  assert.match(html,/const savedHome=normalizeHomeLocation\(CONFIG\.homeLocation\)/);
  assert.match(html,/if\(savedHome\)\{\s*pos=\{lat:savedHome\.latitude,lon:savedHome\.longitude\}/);
  assert.match(html,/if\(!home\)throw new Error\('HOME_AREA_MISSING'\)/);
  assert.match(html,/applyHomeLocation\(\{latitude:found\.area\.latitude,longitude:found\.area\.longitude/);
  assert.doesNotMatch(html,/Use Tablet Location/);
});

test('phone admin can save ZIP or rounded phone location for the tablet',()=>{
  const admin=fs.readFileSync(path.join(root,'admin.html'),'utf8');
  assert.match(admin,/id="homeZipForm"/);
  assert.match(admin,/id="usePhoneLocation"/);
  assert.match(admin,/Math\.round\(latitude\*1000\)\/1000/);
  assert.match(admin,/window\.ref\.update\(\{homeLocation:home,mode:'calculated-location'/);
  assert.match(admin,/navigator\.geolocation\.getCurrentPosition/);
  assert.match(admin,/HOME_LOCATION_PROXY/);
});

test('official website merge uses the production timing-map normalizer',()=>{
  assert.match(html,/const calculatedAdhan=normalizeTimingMap\(calculated\.data\.timings,TIMING_ALL_PRAYERS\)/);
  assert.doesNotMatch(html,/normalizeAdhan\(/);
  assert.match(html,/if\(delta<0&&delta>=-5\)websiteIqamah\[key\]=calculatedAdhan\[key\]/);
});
