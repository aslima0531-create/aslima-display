const UPSTREAMS=[
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass-api.de/api/interpreter'
];
const MAX_RADIUS=25000;
const DEFAULT_RADIUS=15000;
const CACHE_SECONDS=21600;
const ICI_URL='https://www.irvingmasjid.org/';
const MAX_HTML_BYTES=1000000;
const WIDGET_HOSTS=new Set(['portal.masjidapps.com']);
const VERIFIED_SCHEDULE_SOURCES=[
  {name:'Masjid Noor',latitude:40.8393611,longitude:-73.3664877,url:'https://www.masjidnoorli.net/'},
  {name:'Islamic Center of Long Island',latitude:40.7658668,longitude:-73.5707756,url:'https://us.mohid.co/ny/newyork/icli'},
  {name:'East Plano Islamic Center',latitude:33.0197948,longitude:-96.637045,url:'https://www.epicmasjid.org/'},
  {name:'East Texas Islamic Society',latitude:32.3290554,longitude:-95.2349539,url:'https://www.tylermuslim.com/'}
];

function number(value,min,max){
  const parsed=Number(value);
  return Number.isFinite(parsed)&&parsed>=min&&parsed<=max?parsed:null;
}
function allowedOrigins(env){
  return new Set(String(env&&env.ALLOWED_ORIGINS||'').split(',').map(value=>value.trim()).filter(Boolean));
}
function cors(origin){
  return {'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'GET,OPTIONS','Access-Control-Allow-Headers':'Accept','Access-Control-Max-Age':'86400','Vary':'Origin'};
}
function json(body,status,origin,extra={}){
  return new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json;charset=UTF-8','Cache-Control':'no-store',...cors(origin),...extra}});
}
function query(lat,lon,radius){
  return `[out:json][timeout:18];(nwr(around:${radius},${lat},${lon})["amenity"="place_of_worship"]["religion"="muslim"];nwr(around:${radius},${lat},${lon})["building"="mosque"];);out center tags;`;
}
async function upstream(url,body,fetchFn){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),25000);
  try{
    const response=await fetchFn(url,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8','Accept':'application/json','User-Agent':'ASLIMA-Azaan-Tablet/1.0 (+https://github.com/aslima0531-create/aslima-display)'},body,signal:controller.signal});
    if(!response.ok)throw new Error('HTTP '+response.status);
    const data=await response.json();
    if(!data||!Array.isArray(data.elements))throw new Error('Invalid upstream response');
    return data;
  }finally{clearTimeout(timer);}
}
function geoElements(data,textSearch=false){
  if(!data||!Array.isArray(data.features))throw new Error('Invalid Geoapify response');
  const muslimName=/masjid|mosque|islam(?:ic)?|muslim|momin|quran|salaam|xhamia|جامع|مسجد/i;
  return data.features.map((feature,index)=>{
    const properties=feature&&feature.properties||{};
    const coordinates=feature&&feature.geometry&&feature.geometry.coordinates||[];
    const name=properties.name||properties.address_line1||'';
    return {type:'node',id:properties.place_id||properties.osm_id||index+1,lat:Number(coordinates[1]),lon:Number(coordinates[0]),tags:{name,website:properties.website||properties.datasource&&properties.datasource.raw&&properties.datasource.raw.website||'','addr:full':properties.formatted||properties.address_line2||''}};
  }).filter(element=>Number.isFinite(element.lat)&&Number.isFinite(element.lon)&&element.tags.name&&(!textSearch||muslimName.test(element.tags.name)));
}
async function geoRequest(url,fetchFn,textSearch=false){
  const response=await fetchFn(url.toString(),{headers:{'Accept':'application/geo+json','User-Agent':'ASLIMA-Azaan-Tablet/1.0 (+https://github.com/aslima0531-create/aslima-display)'}});
  if(!response.ok)throw new Error('Geoapify HTTP '+response.status);
  return geoElements(await response.json(),textSearch);
}
async function geoCity(latitude,longitude,apiKey,fetchFn){
  const url=new URL('https://api.geoapify.com/v1/geocode/reverse');
  url.search=new URLSearchParams({lat:latitude,lon:longitude,limit:'1',format:'geojson',apiKey}).toString();
  const response=await fetchFn(url.toString(),{headers:{'Accept':'application/geo+json','User-Agent':'ASLIMA-Azaan-Tablet/1.0 (+https://github.com/aslima0531-create/aslima-display)'}});
  if(!response.ok)return '';
  const data=await response.json();
  const properties=data&&data.features&&data.features[0]&&data.features[0].properties||{};
  return String(properties.city||properties.town||properties.village||properties.county||'').trim();
}
async function geocodePostal(postalCode,apiKey,fetchFn){
  const url=new URL('https://api.geoapify.com/v1/geocode/search');
  url.search=new URLSearchParams({text:`${postalCode}, USA`,filter:'countrycode:us',limit:'1',format:'geojson',apiKey}).toString();
  const response=await fetchFn(url.toString(),{headers:{'Accept':'application/geo+json','User-Agent':'ASLIMA-Azaan-Tablet/1.0 (+https://github.com/aslima0531-create/aslima-display)'}});
  if(!response.ok)throw new Error('Postal lookup failed');
  const data=await response.json();
  const feature=data&&data.features&&data.features[0];
  const coordinates=feature&&feature.geometry&&feature.geometry.coordinates;
  const properties=feature&&feature.properties||{};
  if(!Array.isArray(coordinates)||!Number.isFinite(Number(coordinates[0]))||!Number.isFinite(Number(coordinates[1])))return null;
  return {postalCode:String(properties.postcode||postalCode),label:String(properties.formatted||properties.city||postalCode),latitude:Number(coordinates[1]),longitude:Number(coordinates[0])};
}
async function discoverOfficialWebsite(name,latitude,longitude,apiKey,fetchFn){
  if(!apiKey)throw new Error('Official website discovery is unavailable');
  const search=new URL('https://api.geoapify.com/v1/geocode/search');
  search.search=new URLSearchParams({text:name,filter:`circle:${longitude},${latitude},3000`,bias:`proximity:${longitude},${latitude}`,limit:'3',format:'geojson',apiKey}).toString();
  const response=await fetchFn(search.toString(),{headers:{'Accept':'application/geo+json','User-Agent':'ASLIMA-Azaan-Tablet/1.0 (+https://github.com/aslima0531-create/aslima-display)'}});
  if(!response.ok)throw new Error('Official website discovery failed');
  const features=(await response.json()).features||[],wanted=identityTokens(name);
  const match=features.find(feature=>{const properties=feature&&feature.properties||{},found=identityTokens(properties.name||properties.address_line1||'');return wanted.length&&found.length&&wanted.some(token=>found.includes(token));});
  if(!match)throw new Error('Official website could not be matched');
  const properties=match.properties||{};
  if(properties.website)return safeSite(properties.website).toString();
  if(properties.place_id){
    const details=new URL('https://api.geoapify.com/v2/place-details');
    details.search=new URLSearchParams({id:String(properties.place_id),features:'details',apiKey}).toString();
    const detailResponse=await fetchFn(details.toString(),{headers:{'Accept':'application/geo+json','User-Agent':'ASLIMA-Azaan-Tablet/1.0 (+https://github.com/aslima0531-create/aslima-display)'}});
    if(detailResponse.ok){
      const detailFeatures=(await detailResponse.json()).features||[],detail=detailFeatures.find(feature=>feature&&feature.properties&&feature.properties.feature_type==='details')||detailFeatures[0];
      const detailWebsite=detail&&detail.properties&&(detail.properties.website||detail.properties.brand_details&&detail.properties.brand_details.website);
      if(detailWebsite)return safeSite(detailWebsite).toString();
    }
  }
  const osm=new URL('https://nominatim.openstreetmap.org/search');
  osm.search=new URLSearchParams({q:name,format:'jsonv2',limit:'3',extratags:'1'}).toString();
  const osmResponse=await fetchFn(osm.toString(),{headers:{'Accept':'application/json','User-Agent':'ASLIMA-Azaan-Tablet/1.0 (+https://github.com/aslima0531-create/aslima-display)'}});
  if(!osmResponse.ok)throw new Error('Official website directory lookup failed');
  const osmMatches=await osmResponse.json(),osmMatch=osmMatches.find(item=>{const found=identityTokens(item&&item.name||'');return found.length&&wanted.some(token=>found.includes(token))&&Math.abs(Number(item.lat)-latitude)<0.05&&Math.abs(Number(item.lon)-longitude)<0.05;});
  const extra=osmMatch&&osmMatch.extratags||{};
  if(extra.website)return safeSite(/^http:\/\//i.test(extra.website)?extra.website.replace(/^http:/i,'https:'):extra.website).toString();
  if(!/^Q\d+$/.test(String(extra.wikidata||'')))throw new Error('Official website was not published');
  const entityResponse=await fetchFn(`https://www.wikidata.org/wiki/Special:EntityData/${extra.wikidata}.json`,{headers:{'Accept':'application/json','User-Agent':'ASLIMA-Azaan-Tablet/1.0 (+https://github.com/aslima0531-create/aslima-display)'}});
  if(!entityResponse.ok)throw new Error('Official website knowledge lookup failed');
  const entityJson=await entityResponse.json();
  const claims=entityJson.entities&&entityJson.entities[extra.wikidata]&&entityJson.entities[extra.wikidata].claims;
  let website=claims&&claims.P856&&claims.P856[0]&&claims.P856[0].mainsnak&&claims.P856[0].mainsnak.datavalue&&claims.P856[0].mainsnak.datavalue.value;
  if(!website)throw new Error('Official website was not published');
  if(/^http:\/\//i.test(website))website=website.replace(/^http:/i,'https:');
  return safeSite(website).toString();
}
function text(value){return String(value||'').replace(/<[^>]*>/g,' ').replace(/&(?:nbsp|#160);/gi,' ').replace(/&#0?39;|&apos;/gi,"'").replace(/&amp;/gi,'&').replace(/\s+/g,' ').trim();}
function clock(value){
  const match=text(value).match(/\b(\d{1,2})[:.](\d{2})\s*([ap])\.?m\.?\b/i);
  if(!match)return '';
  let hour=Number(match[1]);
  if(hour<1||hour>12||Number(match[2])>59)return '';
  if(match[3].toLowerCase()==='p'&&hour!==12)hour+=12;
  if(match[3].toLowerCase()==='a'&&hour===12)hour=0;
  return String(hour).padStart(2,'0')+':'+match[2];
}
function clocks(value){
  const clean=text(value),out=[];
  for(const match of clean.matchAll(/\b(?:[01]?\d|2[0-3])[:.][0-5]\d(?:\s*[ap]\.?m\.?)?\b/gi)){
    const raw=match[0],period=raw.match(/([ap])\.?m\.?/i),parts=raw.match(/(\d{1,2})[:.](\d{2})/);
    if(!parts)continue;
    let hour=Number(parts[1]);
    if(period){if(hour<1||hour>12)continue;if(period[1].toLowerCase()==='p'&&hour!==12)hour+=12;if(period[1].toLowerCase()==='a'&&hour===12)hour=0;}
    const normalized=String(hour).padStart(2,'0')+':'+parts[2];
    if(!out.includes(normalized))out.push(normalized);
  }
  return out;
}
function prayerName(value){
  const clean=text(value).toLowerCase();
  if(/\bfajr\b|\bfajar\b/.test(clean))return 'Fajr';
  if(/\bsunrise\b|\bshuruq\b|\bshurooq\b/.test(clean))return 'Sunrise';
  if(/\bdhuhr\b|\bzuhr\b|\bzuhur\b/.test(clean))return 'Dhuhr';
  if(/\basr\b/.test(clean))return 'Asr';
  if(/\bmaghrib\b|\bmagrib\b/.test(clean))return 'Maghrib';
  if(/\bisha\b|\bishaa\b/.test(clean))return 'Isha';
  return '';
}
function validateSchedule(adhan,iqamah,jumuahSchedule=[]){
  const required=['Fajr','Dhuhr','Asr','Maghrib','Isha'],minutes=value=>Number(value.slice(0,2))*60+Number(value.slice(3));
  if(!required.every(key=>adhan[key]&&iqamah[key]))throw new Error('Official website schedule is incomplete');
  if(!required.every((key,index)=>index===0||minutes(adhan[key])>minutes(adhan[required[index-1]])))throw new Error('Official website Adhan order is invalid');
  if(!required.every(key=>{const delta=minutes(iqamah[key])-minutes(adhan[key]);return delta>=1&&delta<=180;}))throw new Error('Official website Iqamah is invalid');
  jumuahSchedule.forEach(item=>{if(!item.adhan&&!item.iqamah)throw new Error('Official website Jumuah is invalid');if(item.adhan&&item.iqamah){const delta=minutes(item.iqamah)-minutes(item.adhan);if(delta<1||delta>180)throw new Error('Official website Jumuah is invalid');}});
}
function genericSchedule(html,sourceUrl,now=new Date()){
  const adhan={},iqamah={},jumuahSchedule=[];let iqamahOnlyEvidence=false,singleAdhanEvidence=false,pluginIqamahCount=0;
  const rawdah=String(html).match(/prayerTimeResponse\s*=\s*JSON\.parse\(JSON\.stringify\((\{[\s\S]*?\})\)\)/i);
  if(rawdah){
    try{
      const record=JSON.parse(rawdah[1]),keys={Fajr:['fajr_a','fajr_i'],Dhuhr:['dahur_a','dahur_i'],Asr:['asar_a','asar_i'],Maghrib:['magrib_a','magrib_i'],Isha:['isha_a','isha_i']};
      for(const [prayer,pair] of Object.entries(keys)){adhan[prayer]=clocks(record[pair[0]])[0];iqamah[prayer]=clocks(record[pair[1]])[0];}
    }catch(error){}
  }
  const scriptPrayerMap=(variable)=>{
    const block=String(html).match(new RegExp('(?:const|let|var)\\s+'+variable+'\\s*=\\s*\\[([\\s\\S]*?)\\]\\s*;','i'));
    const output={};
    for(const item of block&&block[1].match(/\{[\s\S]*?\}/g)||[]){const prayer=prayerName(item),time=clocks(item)[0];if(prayer&&prayer!=='Sunrise'&&time)output[prayer]=time;}
    return output;
  };
  Object.assign(adhan,scriptPrayerMap('prayerAzanTimes'));
  Object.assign(iqamah,scriptPrayerMap('prayerTimes'));
  const pluginLabels={Fajr:'Fajr',Dhuhr:'Zuhr',Asr:'Asr',Maghrib:'Maghrib',Isha:'Isha'};
  for(const [prayer,label] of Object.entries(pluginLabels)){
    const match=String(html).match(new RegExp(`sc${label}[^<]*[\\s\\S]{0,180}?dpt_jamah[^>]*>([^<]+)`,'i'));
    if(match){pluginIqamahCount++;if(!iqamah[prayer])iqamah[prayer]=clocks(match[1])[0];}
  }
  if(pluginIqamahCount===5)iqamahOnlyEvidence=true;
  for(const prayer of ['Fajr','Dhuhr','Asr','Maghrib','Isha']){
    const label=prayer==='Dhuhr'?'Zuhr':prayer,entry=(String(html).match(new RegExp(`<li[^>]*>\\s*${label}[\\s\\S]{0,500}?<\\/li>`,'i'))||[])[0];
    if(!entry||!/prayer_iqama_div/i.test(entry)||!/prayer_azaan_div/i.test(entry))continue;
    const iqamaText=(entry.match(/prayer_iqama_div[^>]*>([^<]+)/i)||[])[1]||'',azaanText=(entry.match(/prayer_azaan_div[^>]*>([^<]+)/i)||[])[1]||'';
    const iqama=clocks(iqamaText)[0],azaan=clocks(azaanText)[0],offset=iqamaText.match(/after\s+(\d{1,3})\s*min/i);
    if(iqama)iqamah[prayer]=iqama;else if(offset)iqamah[prayer]='AFTER:'+offset[1];
    if(azaan)adhan[prayer]=azaan;iqamahOnlyEvidence=true;
  }
  const mohidFriday=String(html).match(/id=['"]jummah['"][\s\S]{0,2200}/i);
  if(mohidFriday){for(let index=1;index<=3;index++){const khutbah=mohidFriday[0].match(new RegExp(`${index}(?:st|nd|rd) Khutbah[\\s\\S]{0,180}?(\\d{1,2}:\\d{2}\\s*[AP]M)`,'i')),iqama=mohidFriday[0].match(new RegExp(`Friday Iqama ${index}[\\s\\S]{0,180}?(\\d{1,2}:\\d{2}\\s*[AP]M)`,'i'));if(khutbah&&iqama)jumuahSchedule.push({adhan:clocks(khutbah[1])[0],iqamah:clocks(iqama[1])[0]});}}
  const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',month:'numeric',day:'numeric'}).formatToParts(now),part=type=>Number(parts.find(item=>item.type===type).value),month=part('month'),day=part('day');
  for(const row of String(html).match(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi)||[]){
    const plain=text(row),range=plain.match(/(\d{1,2})\/(\d{1,2})\s*(?:–|—|-|&#8211;)\s*(\d{1,2})\/(\d{1,2})/);
    if(!range||month<Number(range[1])||month>Number(range[3])||month===Number(range[1])&&day<Number(range[2])||month===Number(range[3])&&day>Number(range[4]))continue;
    const values=clocks(row);
    if(values.length>=4){iqamahOnlyEvidence=true;iqamah.Fajr=values[0];iqamah.Dhuhr=values[1];iqamah.Asr=values[2];iqamah.Maghrib=/at\s+sunset/i.test(plain)?'SUNSET':values[3];iqamah.Isha=/at\s+sunset/i.test(plain)?values[3]:values[4];}
  }
  const friday=String(html).match(/JUMM?A?H\s+TIMES?[\s\S]{0,1400}/i),fridayTimes=friday?clocks(friday[0]):[];
  if(fridayTimes.length>=4&&!jumuahSchedule.length){const half=Math.floor(fridayTimes.length/2);for(let index=0;index<Math.min(half,fridayTimes.length-half);index++)jumuahSchedule.push({adhan:fridayTimes[index],iqamah:fridayTimes[index+half]});}
  const rows=String(html).match(/<(?:tr|li)\b[^>]*>[\s\S]*?<\/(?:tr|li)>/gi)||[],singlePrayerRows={},singleJumuah=[];
  for(const row of rows){
    const values=clocks(row);
    if(/Jumu(?:'|&#0?39;|&apos;|’)?ah|Jummah|Friday\s+Prayer/i.test(row)){
      if(values.length>=2)jumuahSchedule.push({adhan:values[0],iqamah:values[1]});
      else if(values.length===1&&!singleJumuah.includes(values[0]))singleJumuah.push(values[0]);
      continue;
    }
    const prayer=prayerName(row);
    if(!prayer||!values.length)continue;
    if(prayer!=='Sunrise'&&values.length===1)singlePrayerRows[prayer]=values[0];
    if(!adhan[prayer])adhan[prayer]=values[0];
    if(prayer!=='Sunrise'&&values.length>=2&&!iqamah[prayer])iqamah[prayer]=values[1];
  }
  const required=['Fajr','Dhuhr','Asr','Maghrib','Isha'];
  if(required.every(key=>singlePrayerRows[key])&&!required.some(key=>iqamah[key])){
    singleAdhanEvidence=true;
  }
  if(!jumuahSchedule.length)singleJumuah.forEach(value=>jumuahSchedule.push({adhan:value,iqamah:''}));
  let completeAdhan=['Fajr','Dhuhr','Asr','Maghrib','Isha'].every(key=>adhan[key]),publishedAdhanEvidence=false;
  try{
    if(singleAdhanEvidence){const minutes=value=>Number(value.slice(0,2))*60+Number(value.slice(3));if(!required.every((key,index)=>index===0||minutes(adhan[key])>minutes(adhan[required[index-1]])))throw new Error('Official website Adhan order is invalid');}
    else validateSchedule(adhan,iqamah,jumuahSchedule);
  }
  catch(error){
    if(iqamahOnlyEvidence&&['Fajr','Dhuhr','Asr','Maghrib','Isha'].every(key=>iqamah[key])){for(const key of Object.keys(adhan))delete adhan[key];completeAdhan=false;}
    else if(completeAdhan||!['Fajr','Dhuhr','Asr','Maghrib','Isha'].every(key=>iqamah[key]))throw error;
  }
  if(!completeAdhan)jumuahSchedule.forEach(item=>{if(!item.adhan&&!item.iqamah)throw new Error('Official website Jumuah is invalid');if(item.adhan&&item.iqamah){const minutes=value=>Number(value.slice(0,2))*60+Number(value.slice(3)),delta=minutes(item.iqamah)-minutes(item.adhan);if(delta<1||delta>180)throw new Error('Official website Jumuah is invalid');}});
  if(!completeAdhan&&iqamahOnlyEvidence&&required.every(key=>iqamah[key])){
    required.forEach(key=>{adhan[key]=iqamah[key];delete iqamah[key];});
    completeAdhan=true;publishedAdhanEvidence=true;
  }
  const adhanOnly=singleAdhanEvidence||publishedAdhanEvidence;
  const provider=adhanOnly?'website-adhan':(completeAdhan?'website-table':'website-iqamah');
  return {provider,source:{id:'website',label:'Official masjid website',kind:adhanOnly?'official-adhan':(completeAdhan?'official-direct':'official-iqamah'),url:sourceUrl},adhan,iqamah,jumuah:jumuahSchedule.map(item=>item.iqamah||item.adhan),jumuahSchedule,jumuahMeta:{status:jumuahSchedule.length?'verified':'unavailable',source:'Official masjid website'}};
}
function unsafeHost(hostname){
  const host=String(hostname||'').toLowerCase().replace(/\.$/,'');
  if(!host||host==='localhost'||host.endsWith('.local')||host.endsWith('.internal'))return true;
  if(/^\d+\.\d+\.\d+\.\d+$/.test(host)){
    const p=host.split('.').map(Number);
    return p[0]===10||p[0]===127||p[0]===0||p[0]===169&&p[1]===254||p[0]===172&&p[1]>=16&&p[1]<=31||p[0]===192&&p[1]===168;
  }
  return host==='::1'||host.startsWith('fc')||host.startsWith('fd')||host.startsWith('fe80');
}
function safeSite(value){
  let url;try{url=new URL(String(value||''));}catch(error){throw new Error('Official website URL is invalid');}
  if(url.protocol!=='https:'||url.username||url.password||url.hostname.endsWith('.localhost')||unsafeHost(url.hostname)||url.port&&url.port!=='443')throw new Error('Official website URL is not allowed');
  url.hash='';return url;
}
function identityTokens(name){return String(name||'').toLowerCase().replace(/[^a-z0-9 ]/g,' ').split(/\s+/).filter(token=>token.length>=4&&!['masjid','mosque','islamic','center','centre','community','society'].includes(token));}
function verifyIdentity(name,html){
  const page=text(String(html).slice(0,250000)).toLowerCase(),tokens=identityTokens(name);
  if(!tokens.length)return false;
  return tokens.filter(token=>page.includes(token)).length>=Math.max(1,Math.ceil(tokens.length/2));
}
async function fetchHtml(url,fetchFn,allowedHost,redirects=0){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
  try{
    const response=await fetchFn(url.toString(),{redirect:'manual',headers:{'Accept':'text/html,application/xhtml+xml','Cache-Control':'no-cache','User-Agent':'ASLIMA-Azaan-Tablet/1.0 (+https://github.com/aslima0531-create/aslima-display)'},signal:controller.signal,cf:{cacheTtl:0}});
    if(response.status>=300&&response.status<400){
      if(redirects>=2)throw new Error('Official website redirected too many times');
      const next=safeSite(new URL(response.headers.get('Location')||'',url).toString());
      const siteLabel=host=>host.replace(/^www\./,'').split('.')[0];
      const sameSite=next.hostname===allowedHost||next.hostname.replace(/^www\./,'')===allowedHost.replace(/^www\./,'')||siteLabel(next.hostname)===siteLabel(allowedHost);
      if(!sameSite&&!WIDGET_HOSTS.has(next.hostname))throw new Error('Official website redirect is not allowed');
      return fetchHtml(next,fetchFn,next.hostname,redirects+1);
    }
    if(!response.ok)throw new Error('Official website HTTP '+response.status);
    const type=String(response.headers.get('Content-Type')||'');
    if(type&&!/html|xhtml/i.test(type))throw new Error('Official schedule is not an HTML page');
    const length=Number(response.headers.get('Content-Length')||0);if(length>MAX_HTML_BYTES)throw new Error('Official website page is too large');
    return {html:(await response.text()).slice(0,MAX_HTML_BYTES),url:response.url||url.toString()};
  }finally{clearTimeout(timer);}
}
async function wordpressSchedule(site,name,fetchFn){
  const requestJson=async url=>{const response=await fetchFn(url.toString(),{redirect:'manual',headers:{'Accept':'application/json','User-Agent':'ASLIMA-Azaan-Tablet/1.0 (+https://github.com/aslima0531-create/aslima-display)'}});if(!response.ok)throw new Error('WordPress schedule API unavailable');return response.json();};
  const root=await requestJson(new URL('/wp-json/',site));
  if(!verifyIdentity(name,String(root.name||'')+' '+String(root.description||'')))throw new Error('Official website identity could not be verified');
  const pagesUrl=new URL('/wp-json/wp/v2/pages',site);pagesUrl.search=new URLSearchParams({slug:'prayer-times',per_page:'3'}).toString();
  const pages=await requestJson(pagesUrl),markup=(Array.isArray(pages)?pages:[]).map(page=>String(page&&page.title&&page.title.rendered||'')+String(page&&page.content&&page.content.rendered||'')).join('\n');
  if(!markup)throw new Error('WordPress prayer page was not found');
  const schedule=genericSchedule(markup,site.toString());schedule.source.label=name;return schedule;
}
function verifiedAlternateSource(name,latitude,longitude){return VERIFIED_SCHEDULE_SOURCES.find(item=>String(item.name).toLowerCase()===String(name).toLowerCase()&&Math.abs(item.latitude-latitude)<0.05&&Math.abs(item.longitude-longitude)<0.05);}
async function resolveWebsiteSchedule(website,name,fetchFn){
  const site=safeSite(website),siteRequest=new URL(site);siteRequest.searchParams.set('_aslima_schedule',String(Math.floor(Date.now()/300000)));
  const page=await fetchHtml(siteRequest,fetchFn,site.hostname);
  if(!verifyIdentity(name,page.html)){try{return await wordpressSchedule(site,name,fetchFn);}catch(error){throw new Error('Official website identity could not be verified');}}
  if(site.hostname==='irvingmasjid.org'||site.hostname.endsWith('.irvingmasjid.org'))return iciSchedule(page.html);
  try{const schedule=genericSchedule(page.html,site.toString());schedule.source.label=name;return schedule;}catch(error){}
  const pageHost=new URL(page.url).hostname;
  const candidates=[...page.html.matchAll(/<(?:iframe[^>]+src|a[^>]+href)=['"]([^'"]+)['"]/gi)].map(match=>match[1].replace(/&amp;/g,'&')).map(value=>{try{return new URL(value,page.url);}catch(error){return null;}}).filter(url=>url&&(WIDGET_HOSTS.has(url.hostname)||(url.hostname===pageHost&&/prayer|salah|tim|clock/i.test(url.pathname)))).slice(0,2);
  for(const candidate of candidates){
    try{const child=await fetchHtml(candidate,fetchFn,candidate.hostname),schedule=genericSchedule(child.html,site.toString());if(!['website-iqamah','website-adhan'].includes(schedule.provider))schedule.provider=WIDGET_HOSTS.has(candidate.hostname)?'masjidapps':'website-embed';schedule.source.label=name;return schedule;}catch(error){}
  }
  try{return await wordpressSchedule(site,name,fetchFn);}catch(error){}
  throw new Error('No supported official timetable was found');
}
function iciSchedule(html,now=new Date()){
  const adhan={},iqamah={};
  const names={Fajr:'Fajr',Zuhr:'Dhuhr',Asr:'Asr',Magrib:'Maghrib',Maghrib:'Maghrib',Isha:'Isha'};
  for(const [label,key] of Object.entries(names)){
    const row=String(html).match(new RegExp(`<li[^>]*>\\s*<span[^>]*>\\s*${label}:?\\s*<\\/span>([\\s\\S]*?)<\\/li>`,'i'));
    if(!row)continue;
    const start=row[1].match(/class=['"][^'"]*dpt_start[^'"]*['"][^>]*>([\s\S]*?)<\/span>/i);
    const jamah=row[1].match(/class=['"][^'"]*dpt_jamah[^'"]*['"][^>]*>([\s\S]*?)<\/span>/i);
    if(start)adhan[key]=clock(start[1]);
    if(jamah)iqamah[key]=clock(jamah[1]);
  }
  const required=['Fajr','Dhuhr','Asr','Maghrib','Isha'];
  if(!required.every(key=>adhan[key]&&iqamah[key]))throw new Error('ICI schedule is incomplete');
  const minutes=value=>Number(value.slice(0,2))*60+Number(value.slice(3));
  if(!required.every((key,index)=>index===0||minutes(adhan[key])>minutes(adhan[required[index-1]])))throw new Error('ICI Adhan order is invalid');
  if(!required.every(key=>{const delta=minutes(iqamah[key])-minutes(adhan[key]);return delta>=0&&delta<=180;}))throw new Error('ICI Iqamah is invalid');
  const jumuah=[],jumuahSchedule=[];
  const rows=(String(html).match(/<li[^>]*>[\s\S]*?<\/li>/gi)||[]).filter(row=>/Jumu(?:'|&#0?39;|&apos;)?ah/i.test(row));
  rows.forEach(row=>{
    const values=[...row.matchAll(/<span[^>]*>([\s\S]*?)<\/span>/gi)].map(match=>clock(match[1])).filter(Boolean);
    if(values.length>=2){
      const delta=minutes(values[1])-minutes(values[0]);
      if(delta<1||delta>180)throw new Error('ICI Jumuah Iqamah is invalid');
      jumuahSchedule.push({adhan:values[0],iqamah:values[1]});jumuah.push(values[1]);
    }
  });
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
  const part=type=>parts.find(item=>item.type===type).value;
  return {provider:'ici',prayerDate:`${part('year')}-${part('month')}-${part('day')}`,timezone:'America/Chicago',fetchedAt:now.toISOString(),source:{id:'ici',label:'Islamic Center of Irving',kind:'official-direct',url:ICI_URL},adhan,iqamah,jumuah,jumuahSchedule,jumuahMeta:{status:jumuahSchedule.length?'verified':'unavailable',source:'Islamic Center of Irving'}};
}
async function fetchIciSchedule(fetchFn){
  const response=await fetchFn(ICI_URL,{headers:{'Accept':'text/html','User-Agent':'ASLIMA-Azaan-Tablet/1.0 (+https://github.com/aslima0531-create/aslima-display)'}});
  if(!response.ok)throw new Error('ICI HTTP '+response.status);
  return iciSchedule(await response.text());
}
async function geoapify(latitude,longitude,radius,apiKey,fetchFn){
  const places=new URL('https://api.geoapify.com/v2/places');
  places.search=new URLSearchParams({categories:'religion.place_of_worship.islam',filter:`circle:${longitude},${latitude},${radius}`,bias:`proximity:${longitude},${latitude}`,limit:'20',apiKey}).toString();
  const city=await geoCity(latitude,longitude,apiKey,fetchFn);
  const searches=['mosque','masjid',city?'Islamic Center of '+city:'Islamic center'].map(text=>{
    const url=new URL('https://api.geoapify.com/v1/geocode/search');
    url.search=new URLSearchParams({text,filter:`circle:${longitude},${latitude},${radius}`,bias:`proximity:${longitude},${latitude}`,limit:'20',format:'geojson',apiKey}).toString();
    return url;
  });
  const groups=await Promise.all([geoRequest(places,fetchFn),...searches.map(url=>geoRequest(url,fetchFn,true))]);
  const seen=new Set();
  return {elements:groups.flat().filter(element=>{
    const key=String(element.id)+'|'+element.lat.toFixed(5)+'|'+element.lon.toFixed(5);
    if(seen.has(key))return false;
    seen.add(key);
    return true;
  })};
}
async function handle(request,env,ctx,deps={}){
  const url=new URL(request.url);
  const origin=request.headers.get('Origin')||'';
  if(!allowedOrigins(env).has(origin))return json({error:'Origin not allowed'},403,origin||'null');
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors(origin)});
  if(request.method!=='GET')return json({error:'Not found'},404,origin);
  const fetchFn=deps.fetchFn||fetch;
  if(url.pathname==='/geocode'){
    const postalCode=String(url.searchParams.get('postalCode')||'').trim();
    if(!/^\d{5}$/.test(postalCode))return json({error:'A valid 5-digit US ZIP code is required'},400,origin);
    if(!env||!env.GEOAPIFY_API_KEY)return json({error:'ZIP-code search is unavailable'},503,origin);
    try{const area=await geocodePostal(postalCode,env.GEOAPIFY_API_KEY,fetchFn);return area?json(area,200,origin):json({error:'ZIP code not found'},404,origin);}catch(error){return json({error:'ZIP-code search is temporarily unavailable'},503,origin,{'Retry-After':'60'});}
  }
  if(url.pathname==='/schedule/ici'){
    try{return json(await fetchIciSchedule(fetchFn),200,origin,{'Cache-Control':'public,max-age=300','X-ASLIMA-Source':'irvingmasjid.org'});}catch(error){return json({error:'Official ICI schedule is temporarily unavailable'},503,origin,{'Retry-After':'60'});}
  }
  if(url.pathname==='/schedule/resolve'){
    let website=String(url.searchParams.get('website')||'').slice(0,500);
    const name=String(url.searchParams.get('name')||'').trim().slice(0,120);
    const latitude=number(url.searchParams.get('lat'),-90,90),longitude=number(url.searchParams.get('lon'),-180,180);
    if(!name||!website&&(latitude===null||longitude===null))return json({error:'Masjid name and either its website or location are required'},400,origin);
    if(!website){
      const alternate=verifiedAlternateSource(name,latitude,longitude);
      if(alternate)website=alternate.url;
      else try{website=await discoverOfficialWebsite(name,latitude,longitude,env&&env.GEOAPIFY_API_KEY,fetchFn);}catch(error){return json({error:'No official website was found for this masjid'},404,origin);}
    }
    try{return json(await resolveWebsiteSchedule(website,name,fetchFn),200,origin,{'Cache-Control':'public,max-age=300','X-ASLIMA-Source':'official-website'});}
    catch(error){
      const alternate=latitude!==null&&longitude!==null&&verifiedAlternateSource(name,latitude,longitude);
      if(alternate){try{return json(await resolveWebsiteSchedule(alternate.url,name,fetchFn),200,origin,{'Cache-Control':'public,max-age=300','X-ASLIMA-Source':'verified-alternate'});}catch(alternateError){}}
      const message=String(error&&error.message||'');
      const unsafe=/not allowed|invalid|identity/i.test(message);
      return json({error:unsafe?'Official website could not be verified':'No supported official timetable was found'},unsafe?400:422,origin);
    }
  }
  if(url.pathname!=='/nearby')return json({error:'Not found'},404,origin);
  const latitude=number(url.searchParams.get('lat'),-90,90);
  const longitude=number(url.searchParams.get('lon'),-180,180);
  if(latitude===null||longitude===null)return json({error:'Valid latitude and longitude are required'},400,origin);
  const radius=Math.round(Math.max(1000,Math.min(MAX_RADIUS,Number(url.searchParams.get('radius'))||DEFAULT_RADIUS)));
  const lat=latitude.toFixed(3),lon=longitude.toFixed(3);
  const cacheKey=new Request(`${url.origin}/nearby?lat=${lat}&lon=${lon}&radius=${radius}`,{headers:{Origin:origin}});
  const cache=deps.cache||(typeof caches!=='undefined'&&caches.default);
  const cached=cache&&await cache.match(cacheKey);
  if(cached)return cached;
  const body='data='+encodeURIComponent(query(lat,lon,radius));
  if(env&&env.GEOAPIFY_API_KEY){
    try{
      const data=await geoapify(lat,lon,radius,env.GEOAPIFY_API_KEY,fetchFn);
      const response=json(data,200,origin,{'Cache-Control':`public,max-age=${CACHE_SECONDS}`,'X-ASLIMA-Source':'geoapify'});
      if(cache)ctx.waitUntil(cache.put(cacheKey,response.clone()));
      return response;
    }catch(error){}
  }
  const endpoints=deps.upstreams||UPSTREAMS;
  try{
    const winner=await Promise.any(endpoints.map(async endpoint=>({data:await upstream(endpoint,body,fetchFn),endpoint})));
    const response=json(winner.data,200,origin,{'Cache-Control':`public,max-age=${CACHE_SECONDS}`,'X-ASLIMA-Source':new URL(winner.endpoint).hostname});
    if(cache)ctx.waitUntil(cache.put(cacheKey,response.clone()));
    return response;
  }catch(error){
    return json({error:'Nearby map providers are temporarily unavailable'},503,origin,{'Retry-After':'60','X-ASLIMA-Upstream-Errors':String(endpoints.length)});
  }
}

export {discoverOfficialWebsite,fetchIciSchedule,genericSchedule,geocodePostal,geoapify,handle,iciSchedule,query,resolveWebsiteSchedule,safeSite};
export default {fetch(request,env,ctx){return handle(request,env,ctx);}};
