import test from 'node:test';
import assert from 'node:assert/strict';
import {discoverOfficialWebsite,genericSchedule,geoapify,handle,iciSchedule,query,resolveWebsiteSchedule,safeSite} from '../workers/masjid-search/src/worker.mjs';

const env={ALLOWED_ORIGINS:'https://aslima0531-create.github.io,http://127.0.0.1:8765'};
const ctx={waitUntil(){}};
const request=(path='?lat=32.9185&lon=-96.959',origin='http://127.0.0.1:8765',method='GET')=>new Request('https://worker.example/nearby'+path,{method,headers:{Origin:origin}});

test('worker rejects unapproved origins before querying a provider',async()=>{
  let called=false;
  const response=await handle(request('?lat=32&lon=-97','https://evil.example'),env,ctx,{fetchFn:async()=>{called=true;}});
  assert.equal(response.status,403);
  assert.equal(called,false);
});

test('worker validates and rounds coordinates and bounds radius',async()=>{
  let sent='';
  const response=await handle(request('?lat=32.918543&lon=-96.959012&radius=999999'),env,ctx,{fetchFn:async(_url,options)=>{sent=decodeURIComponent(options.body);return new Response(JSON.stringify({elements:[]}),{status:200});},upstreams:['https://one.example/api']});
  assert.equal(response.status,200);
  assert.match(sent,/around:25000,32\.919,-96\.959/);
  assert.doesNotMatch(sent,/32\.918543/);
});

test('worker accepts the first successful provider and returns safe CORS headers',async()=>{
  let calls=0;
  const response=await handle(request(),env,ctx,{fetchFn:async()=>{calls++;return calls===1?new Response('busy',{status:504}):new Response(JSON.stringify({elements:[{type:'node',id:1,lat:32.9,lon:-96.9,tags:{name:'Masjid'}}]}),{status:200});},upstreams:['https://one.example/api','https://two.example/api']});
  assert.equal(response.status,200);
  assert.equal(calls,2);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'),'http://127.0.0.1:8765');
  assert.equal((await response.json()).elements.length,1);
});

test('worker returns a bounded service error when every provider fails',async()=>{
  const response=await handle(request(),env,ctx,{fetchFn:async()=>new Response('busy',{status:503}),upstreams:['https://one.example/api']});
  assert.equal(response.status,503);
  assert.equal(response.headers.get('Retry-After'),'60');
  assert.deepEqual(await response.json(),{error:'Nearby map providers are temporarily unavailable'});
});

test('worker query remains mosque-specific',()=>{
  const text=query('32.919','-96.959',15000);
  assert.match(text,/"religion"="muslim"/);
  assert.match(text,/"building"="mosque"/);
});

test('Geoapify free Places response is normalized without exposing its API key',async()=>{
  let requested='';
  const fetchFn=async url=>{requested+=url+'\n';return new Response(JSON.stringify({features:url.includes('/reverse')?[{properties:{city:'Irving'},geometry:{coordinates:[-96.9,32.9]}}]:url.includes('/v2/places')?[{properties:{place_id:'abc',name:'Community Masjid',formatted:'1 Main St'},geometry:{coordinates:[-96.9,32.9]}}]:[]}),{status:200});};
  const data=await geoapify('32.919','-96.959',15000,'private-key',fetchFn);
  assert.match(requested,/religion\.place_of_worship\.islam/);
  assert.match(requested,/text=Islamic\+Center\+of\+Irving/);
  assert.equal(data.elements[0].tags.name,'Community Masjid');
  assert.doesNotMatch(JSON.stringify(data),/private-key/);
});

test('worker prefers configured Geoapify and does not call overloaded fallbacks',async()=>{
  let calls=0;
  const response=await handle(request(),{...env,GEOAPIFY_API_KEY:'private-key'},ctx,{fetchFn:async url=>{calls++;assert.match(url,/api\.geoapify\.com/);return new Response(JSON.stringify({features:[]}),{status:200});},upstreams:['https://should-not-run.example']});
  assert.equal(response.status,200);
  assert.equal(response.headers.get('X-ASLIMA-Source'),'geoapify');
  assert.equal(calls,5);
});

test('Geoapify enrichment keeps Muslim text results and rejects unrelated places',async()=>{
  const fetchFn=async url=>new Response(JSON.stringify({features:url.includes('/reverse')?[{properties:{city:'Irving'},geometry:{coordinates:[-96.96,32.91]}}]:url.includes('text=Islamic+Center+of+Irving')?[
    {properties:{place_id:'ici',name:'Islamic Center of Irving'},geometry:{coordinates:[-96.98,32.87]}},
    {properties:{place_id:'bank',name:'Irving Bank'},geometry:{coordinates:[-96.97,32.88]}}
  ]:[]}),{status:200});
  const data=await geoapify('32.919','-96.959',15000,'private-key',fetchFn);
  assert.deepEqual(data.elements.map(element=>element.tags.name),['Islamic Center of Irving']);
});

test('ZIP endpoint resolves a valid US postal code without exposing the API key',async()=>{
  let requested='';
  const response=await handle(new Request('https://worker.example/geocode?postalCode=75062',{headers:{Origin:'http://127.0.0.1:8765'}}),{...env,GEOAPIFY_API_KEY:'private-key'},ctx,{fetchFn:async url=>{requested=url;return new Response(JSON.stringify({features:[{properties:{postcode:'75062',formatted:'Irving, TX 75062'},geometry:{coordinates:[-97.01,32.85]}}]}),{status:200});}});
  assert.equal(response.status,200);
  assert.match(requested,/text=75062%2C\+USA/);
  assert.doesNotMatch(JSON.stringify(await response.json()),/private-key/);
});

test('official website discovery enriches a selected masjid through place details',async()=>{
  const calls=[];
  const website=await discoverOfficialWebsite('East Plano Islamic Center',33.01,-96.647,'private-key',async url=>{
    calls.push(String(url));
    return String(url).includes('place-details')?new Response(JSON.stringify({features:[{properties:{feature_type:'details',website:'https://www.epicmasjid.org/'}}]}),{status:200}):new Response(JSON.stringify({features:[{properties:{name:'East Plano Islamic Center',place_id:'epic-place'}}]}),{status:200});
  });
  assert.equal(website,'https://www.epicmasjid.org/');
  assert.match(calls[0],/circle%3A-96\.647%2C33\.01%2C3000/);
  assert.match(calls[1],/place-details/);
  assert.doesNotMatch(website,/private-key/);
});

test('official website discovery falls back to matched OpenStreetMap and Wikidata metadata',async()=>{
  const website=await discoverOfficialWebsite('East Plano Islamic Center',33.01,-96.647,'private-key',async url=>{
    if(String(url).includes('/v1/geocode/search'))return new Response(JSON.stringify({features:[{properties:{name:'East Plano Islamic Center',place_id:'epic-place'}}]}),{status:200});
    if(String(url).includes('/v2/place-details'))return new Response(JSON.stringify({features:[{properties:{feature_type:'details'}}]}),{status:200});
    if(String(url).includes('nominatim'))return new Response(JSON.stringify([{name:'East Plano Islamic Center',lat:'33.0099',lon:'-96.6468',extratags:{wikidata:'Q21015964'}}]),{status:200});
    return new Response(JSON.stringify({entities:{Q21015964:{claims:{P856:[{mainsnak:{datavalue:{value:'http://www.epicmasjid.net/'}}}]}}}}),{status:200});
  });
  assert.equal(website,'https://www.epicmasjid.net/');
});

test('ICI parser validates official Adhan, Iqamah, and Jumuah rows',()=>{
  const row=(name,adhan,iqamah)=>`<li><span>${name}:</span><span class="dpt_start">${adhan}</span><span><span class="dpt_jamah">${iqamah}</span></span></li>`;
  const html=row('Fajr','5:18 am','5:45 am')+row('Zuhr','1:40 pm','2:00 pm')+row('Asr','5:17 pm','6:15 pm')+row('Magrib','8:37 pm','8:42 pm')+row('Isha','9:57 pm','10:15 pm')+`<li><span>1st Jumu'ah:</span><span>02:00 PM</span><span>02:25 PM</span></li>`;
  const schedule=iciSchedule(html,new Date('2026-07-21T18:00:00Z'));
  assert.deepEqual(schedule.adhan,{Fajr:'05:18',Dhuhr:'13:40',Asr:'17:17',Maghrib:'20:37',Isha:'21:57'});
  assert.deepEqual(schedule.iqamah,{Fajr:'05:45',Dhuhr:'14:00',Asr:'18:15',Maghrib:'20:42',Isha:'22:15'});
  assert.deepEqual(schedule.jumuah,['14:25']);
  assert.deepEqual(schedule.jumuahSchedule,[{adhan:'14:00',iqamah:'14:25'}]);
  assert.equal(schedule.prayerDate,'2026-07-21');
});

test('ICI parser rejects incomplete official schedules',()=>{
  assert.throws(()=>iciSchedule('<li><span>Fajr:</span><span class="dpt_start">5:18 am</span></li>'),/incomplete/);
});

const tableRow=(name,adhan,iqamah='')=>`<tr><td>${name}</td><td>${adhan}</td><td>${iqamah}</td></tr>`;
const completeTable=tableRow('Fajr','5:15 AM','5:45 AM')+tableRow('Sunrise','6:34 AM')+tableRow('Dhuhr','1:34 PM','1:45 PM')+tableRow('Asr','5:17 PM','5:30 PM')+tableRow('Maghrib','8:34 PM','8:39 PM')+tableRow('Isha','9:53 PM','10:00 PM')+tableRow('1st Jumuah','1:45 PM','2:00 PM');

test('generic official-table parser returns validated Adhan, Iqamah, and Jumuah pairs',()=>{
  const schedule=genericSchedule(`<table>${completeTable}</table>`,'https://examplemasjid.org/');
  assert.equal(schedule.adhan.Dhuhr,'13:34');
  assert.equal(schedule.iqamah.Isha,'22:00');
  assert.deepEqual(schedule.jumuahSchedule,[{adhan:'13:45',iqamah:'14:00'}]);
});

test('generic parser supports multiple one-time Jumuah or Khutba rows',()=>{
  const friday=`<table><thead><tr><th>Jumu'ah</th><th>Khutba</th></tr></thead><tbody><tr><td>1st Jumuah</td><td>01:45 PM</td></tr><tr><td>2nd Jumuah</td><td>03:15 PM</td></tr></tbody></table>`;
  const schedule=genericSchedule(`<table>${completeTable.replace(tableRow('1st Jumuah','1:45 PM','2:00 PM'),'')}</table>${friday}`,'https://examplemasjid.org/');
  assert.deepEqual(schedule.jumuahSchedule,[{adhan:'13:45',iqamah:''},{adhan:'15:15',iqamah:''}]);
  assert.deepEqual(schedule.jumuah,['13:45','15:15']);
});

test('generic official-table parser rejects incomplete and implausible schedules',()=>{
  assert.throws(()=>genericSchedule(tableRow('Fajr','5:15 AM','5:45 AM'),'https://examplemasjid.org/'),/incomplete/);
  const invalid=completeTable.replace('2:00 PM','12:00 PM');
  assert.throws(()=>genericSchedule(invalid,'https://examplemasjid.org/'),/Jumuah/);
});

test('generic parser supports paired public JavaScript Adhan and Iqamah arrays',()=>{
  const objects=(times)=>Object.entries(times).map(([name,time])=>`{ displayName: '${name}', time: '${time}' }`).join(',');
  const html=`<script>const prayerAzanTimes=[${objects({Fajar:'05:16',Dhuhr:'13:35',Asr:'17:18',Maghrib:'20:34',Isha:'21:53'})}];const prayerTimes=[${objects({Fajar:'05:45',Dhuhr:'14:00',Asr:'17:30',Maghrib:'20:44',Isha:'22:00'})}];</script>`;
  const schedule=genericSchedule(html,'https://examplemasjid.org/clock');
  assert.equal(schedule.adhan.Fajr,'05:16');
  assert.equal(schedule.iqamah.Isha,'22:00');
});

test('generic parser supports Rawdah-style machine-readable daily schedule data',()=>{
  const record={fajr_a:'04:55:00',fajr_i:'06:45:00',dahur_a:'13:34:00',dahur_i:'13:45:00',asar_a:'18:29:00',asar_i:'19:00:00',magrib_a:'20:34:00',magrib_i:'20:38:00',isha_a:'22:08:00',isha_i:'22:30:00'};
  const schedule=genericSchedule(`<script>prayerTimeResponse = JSON.parse(JSON.stringify(${JSON.stringify(record)}));</script>`,'https://madinahmasjid.com/');
  assert.equal(schedule.adhan.Fajr,'04:55');
  assert.equal(schedule.iqamah.Asr,'19:00');
});

test('generic parser presents a single Daily Prayer Time schedule as Adhan only',()=>{
  const row=(label,time)=>`<span class='sc${label}'><span class='dpt_jamah'>${time}</span></span>`;
  const schedule=genericSchedule(row('Fajr','5:00 am')+row('Zuhr','1:15 pm')+row('Asr','6:45 pm')+row('Maghrib','8:20 pm')+row('Isha','10:00 pm'),'https://masjid.example/');
  assert.equal(schedule.provider,'website-adhan');
  assert.equal(schedule.adhan.Maghrib,'20:20');
  assert.deepEqual(schedule.iqamah,{});
});

test('generic parser supports current date-range iqamah tables and paired Jumuah',()=>{
  const html=`<table><tr><th>Date</th><th>Fajr</th><th>Dhuhr</th><th>Asr</th><th>Maghrib</th><th>Isha</th></tr><tr><td>7/21 – 7/31</td><td>5:00 am</td><td>1:15 pm</td><td>6:30 pm</td><td>At Sunset</td><td>10:00 pm</td></tr></table><h2>JUMMAH TIMES: July</h2><table><tr><td>1st Khutbah 1:00 pm</td><td>2nd Khutbah 2:15 pm</td></tr><tr><td>1st Iqamah 1:30 pm</td><td>2nd Iqamah 2:35 pm</td></tr></table>`;
  const schedule=genericSchedule(html,'https://masjid.example/',new Date('2026-07-21T16:00:00Z'));
  assert.equal(schedule.provider,'website-adhan');
  assert.equal(schedule.adhan.Maghrib,'SUNSET');
  assert.deepEqual(schedule.iqamah,{});
  assert.deepEqual(schedule.jumuahSchedule,[{adhan:'13:00',iqamah:'13:30'},{adhan:'14:15',iqamah:'14:35'}]);
});

test('generic parser supports MOHID daily and Jumuah schedules',()=>{
  const daily=(name,iqamah,adhan)=>`<li>${name}<div class="prayer_iqama_div">${iqamah}</div><div class="prayer_azaan_div">${adhan}</div></li>`;
  const friday=`<div id="jummah"><li>1st Khutbah<div class="num">1:00 PM</div></li><li>Friday Iqama 1<div class="num">1:30 PM</div></li><li>2nd Khutbah<div class="num">2:15 PM</div></li><li>Friday Iqama 2<div class="num">2:35 PM</div></li></div>`;
  const schedule=genericSchedule(daily('Fajr','5:00 AM','4:09 AM')+daily('Zuhr','1:15 PM','1:01 PM')+daily('Asr','6:30 PM','6:09 PM')+daily('Maghrib','After 5 mins','SUNSET')+daily('Isha','10:00 PM','9:55 PM')+friday,'https://us.mohid.co/example');
  assert.equal(schedule.provider,'website-adhan');
  assert.equal(schedule.adhan.Maghrib,'AFTER:5');
  assert.deepEqual(schedule.iqamah,{});
  assert.deepEqual(schedule.jumuahSchedule,[{adhan:'13:00',iqamah:'13:30'},{adhan:'14:15',iqamah:'14:35'}]);
});

test('generic parser treats an unlabeled one-time prayer table as official Adhan only',()=>{
  const one=(name,time)=>`<tr><td>${name}</td><td>${time}</td></tr>`;
  const html='<h2>Prayer Timings</h2><table>'+one('Fajr','5.30 AM')+one('Zuhr','1.45 PM')+one('Asr','6.00 PM')+one('Maghrib','8.25 PM')+one('Isha','9.45 PM')+one('Jummah','1:45 PM')+'</table>';
  const schedule=genericSchedule(html,'https://www.tylermuslim.com/');
  assert.equal(schedule.provider,'website-adhan');
  assert.deepEqual(schedule.adhan,{Fajr:'05:30',Dhuhr:'13:45',Asr:'18:00',Maghrib:'20:25',Isha:'21:45'});
  assert.deepEqual(schedule.iqamah,{});
  assert.deepEqual(schedule.jumuahSchedule,[{adhan:'13:45',iqamah:''}]);
});

test('schedule resolver uses a verified coordinate-matched source before directory discovery',async()=>{
  const calls=[];
  const row=(label,time)=>`<span class='sc${label}'><span class='dpt_jamah'>${time}</span></span>`;
  const html='<title>Masjid Noor</title>'+row('Fajr','5:00 am')+row('Zuhr','1:15 pm')+row('Asr','6:45 pm')+row('Maghrib','8:20 pm')+row('Isha','10:00 pm');
  const response=await handle(new Request('https://worker.example/schedule/resolve?website=&name=Masjid%20Noor&lat=40.8393611&lon=-73.3664877',{headers:{Origin:'http://127.0.0.1:8765'}}),{...env,GEOAPIFY_API_KEY:'private-key'},ctx,{fetchFn:async url=>{calls.push(String(url));return new Response(html,{headers:{'Content-Type':'text/html'}});}});
  assert.equal(response.status,200);
  assert.equal((await response.json()).provider,'website-adhan');
  assert.match(calls[0],/^https:\/\/www\.masjidnoorli\.net\/\?_aslima_schedule=\d+$/);
  assert.equal(calls.some(url=>url.includes('geoapify.com')),false);
});

test('verified EPIC nearby identity resolves its official website when directories omit it',async()=>{
  const calls=[];
  const response=await handle(new Request('https://worker.example/schedule/resolve?website=&name=East%20Plano%20Islamic%20Center&lat=33.0197948&lon=-96.637045',{headers:{Origin:'http://127.0.0.1:8765'}}),{...env,GEOAPIFY_API_KEY:'private-key'},ctx,{fetchFn:async url=>{calls.push(String(url));return new Response(`<title>East Plano Islamic Center</title><table>${completeTable}</table>`,{headers:{'Content-Type':'text/html'}});}});
  assert.equal(response.status,200);
  assert.match(calls[0],/^https:\/\/www\.epicmasjid\.org\/\?_aslima_schedule=\d+$/);
  assert.equal(calls.some(url=>url.includes('geoapify.com')),false);
});

test('website resolver verifies identity and follows only a known MasjidApps iframe',async()=>{
  const calls=[];
  const schedule=await resolveWebsiteSchedule('https://examplemasjid.org/','Example Masjid',async url=>{
    calls.push(String(url));
    if(String(url).includes('portal.masjidapps.com'))return new Response(`<table>${completeTable}</table>`,{status:200,headers:{'Content-Type':'text/html'}});
    return new Response(`<title>Example Masjid</title><iframe src="https://portal.masjidapps.com/public/readOnlySalahTimes?id=123"></iframe>`,{status:200,headers:{'Content-Type':'text/html'}});
  });
  assert.equal(schedule.provider,'masjidapps');
  assert.equal(schedule.source.label,'Example Masjid');
  assert.equal(calls.length,2);
});

test('official website fetch uses Cloudflare-compatible cache bypass controls',async()=>{
  let options;
  await resolveWebsiteSchedule('https://examplemasjid.org/','Example Masjid',async(_url,requestOptions)=>{options=requestOptions;return new Response(`<title>Example Masjid</title><table>${completeTable}</table>`,{headers:{'Content-Type':'text/html'}});});
  assert.equal('cache' in options,false);
  assert.equal(options.headers['Cache-Control'],'no-cache');
  assert.equal(options.cf.cacheTtl,0);
});

test('website resolver follows a schedule-named same-site iframe after identity verification',async()=>{
  const objects=(times)=>Object.entries(times).map(([name,time])=>`{ displayName: '${name}', time: '${time}' }`).join(',');
  const embedded=`<script>const prayerAzanTimes=[${objects({Fajr:'05:16',Dhuhr:'13:35',Asr:'17:18',Maghrib:'20:34',Isha:'21:53'})}];const prayerTimes=[${objects({Fajr:'05:45',Dhuhr:'14:00',Asr:'17:30',Maghrib:'20:44',Isha:'22:00'})}];</script>`;
  const schedule=await resolveWebsiteSchedule('https://examplemasjid.com/','Example Masjid',async url=>String(url).includes('/clockexternal')?new Response(embedded,{headers:{'Content-Type':'text/html'}}):new Response('<title>Example Masjid</title><iframe src="/clockexternal"></iframe>',{headers:{'Content-Type':'text/html'}}));
  assert.equal(schedule.provider,'website-embed');
  assert.equal(schedule.adhan.Maghrib,'20:34');
});

test('website resolver follows a bounded same-site prayer timetable link',async()=>{
  const schedule=await resolveWebsiteSchedule('https://examplemasjid.com/','Example Masjid',async url=>String(url).includes('/prayer-times')?new Response(`<table>${completeTable}</table>`,{headers:{'Content-Type':'text/html'}}):new Response('<title>Example Masjid</title><a href="/prayer-times/">Prayer Times</a>',{headers:{'Content-Type':'text/html'}}));
  assert.equal(schedule.provider,'website-embed');
  assert.equal(schedule.iqamah.Dhuhr,'13:45');
});

test('same-site single schedule is classified as official Adhan only',async()=>{
  const partial=`<table><tr><td>7/21 – 7/31</td><td>5:00 am</td><td>1:15 pm</td><td>6:30 pm</td><td>At Sunset</td><td>10:00 pm</td></tr></table>`;
  const schedule=await resolveWebsiteSchedule('https://examplemasjid.com/','Example Masjid',async url=>String(url).includes('/prayer-times')?new Response(partial,{headers:{'Content-Type':'text/html'}}):new Response('<title>Example Masjid</title><a href="/prayer-times/">Prayer Times</a>',{headers:{'Content-Type':'text/html'}}));
  assert.equal(schedule.provider,'website-adhan');
  assert.equal(schedule.adhan.Maghrib,'SUNSET');
  assert.deepEqual(schedule.iqamah,{});
});

test('resolver uses the standard WordPress API when browser-facing HTML is blocked',async()=>{
  const partial=`<table><tr><td>7/21 – 7/31</td><td>5:00 am</td><td>1:15 pm</td><td>6:30 pm</td><td>At Sunset</td><td>10:00 pm</td></tr></table>`;
  const schedule=await resolveWebsiteSchedule('https://examplemasjid.com/','Example Masjid',async url=>{
    if(String(url).includes('/wp-json/wp/v2/pages'))return new Response(JSON.stringify([{title:{rendered:'Prayer Times'},content:{rendered:partial}}]),{headers:{'Content-Type':'application/json'}});
    if(String(url).includes('/wp-json/'))return new Response(JSON.stringify({name:'Example Masjid'}),{headers:{'Content-Type':'application/json'}});
    return new Response('<title>Access check</title>',{headers:{'Content-Type':'text/html'}});
  });
  assert.equal(schedule.provider,'website-adhan');
  assert.equal(schedule.adhan.Isha,'22:00');
  assert.deepEqual(schedule.iqamah,{});
});

test('website resolver rejects unsafe destinations and identity mismatches',async()=>{
  assert.throws(()=>safeSite('http://example.com/'),/not allowed/);
  assert.throws(()=>safeSite('https://127.0.0.1/times'),/not allowed/);
  assert.throws(()=>safeSite('https://schedule.localhost/times'),/not allowed/);
  await assert.rejects(()=>resolveWebsiteSchedule('https://examplemasjid.org/','Different Masjid',async()=>new Response(`<title>Unrelated Community</title><table>${completeTable}</table>`,{headers:{'Content-Type':'text/html'}})),/identity/);
});

test('website resolver bounds redirects and rejects redirects to unapproved hosts',async()=>{
  await assert.rejects(()=>resolveWebsiteSchedule('https://examplemasjid.org/','Example Masjid',async()=>new Response('',{status:302,headers:{Location:'https://unrelated.example/times'}})),/redirect is not allowed/);
  await assert.rejects(()=>resolveWebsiteSchedule('https://examplemasjid.org/','Example Masjid',async url=>new Response('',{status:302,headers:{Location:String(url)}})),/too many times/);
});

test('schedule resolver endpoint never returns unvalidated partial website data',async()=>{
  const response=await handle(new Request('https://worker.example/schedule/resolve?website=https%3A%2F%2Fexamplemasjid.org%2F&name=Example%20Masjid',{headers:{Origin:'http://127.0.0.1:8765'}}),env,ctx,{fetchFn:async()=>new Response('<title>Example Masjid</title><table>'+tableRow('Fajr','5:15 AM','5:45 AM')+'</table>',{headers:{'Content-Type':'text/html'}})});
  assert.equal(response.status,422);
  assert.deepEqual(await response.json(),{error:'No supported official timetable was found'});
});
