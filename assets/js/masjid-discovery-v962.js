(function(root){
  'use strict';

  const VERSION=962;
  const ENDPOINT='https://overpass-api.de/api/interpreter';
  const VRIC={latitude:32.9186,longitude:-96.9590};
  const VERIFIED_MASJIDS=[{
    id:'ici',name:'Islamic Center of Irving',latitude:32.8427164,longitude:-97.0107132,
    address:'2555 Esters Road, Irving, TX 75062',website:'https://www.irvingmasjid.org/',
    officialProvider:'ici',discoverySource:'aslima-verified'
  }];

  function finite(value){return Number.isFinite(Number(value));}
  function radians(value){return Number(value)*Math.PI/180;}
  function distanceMiles(aLat,aLon,bLat,bLon){
    const earthMiles=3958.8;
    const dLat=radians(Number(bLat)-Number(aLat));
    const dLon=radians(Number(bLon)-Number(aLon));
    const a=Math.sin(dLat/2)**2+Math.cos(radians(aLat))*Math.cos(radians(bLat))*Math.sin(dLon/2)**2;
    return 2*earthMiles*Math.asin(Math.sqrt(a));
  }
  function coordinates(element){
    if(finite(element&&element.lat)&&finite(element&&element.lon))return {lat:Number(element.lat),lon:Number(element.lon)};
    if(finite(element&&element.center&&element.center.lat)&&finite(element&&element.center&&element.center.lon))return {lat:Number(element.center.lat),lon:Number(element.center.lon)};
    return null;
  }
  function cleanName(tags){
    const value=tags&&(tags.name||tags['name:en']||tags.operator||tags.brand);
    return typeof value==='string'&&value.trim()?value.trim():'';
  }
  function websiteHost(website){
    try{return new URL(String(website||'')).hostname.toLowerCase().replace(/^www\./,'');}catch(e){return '';}
  }
  function providerFor(name,website,latitude,longitude){
    const host=websiteHost(website);
    if(host==='vric.org'||host.endsWith('.vric.org'))return 'vric';
    if(host==='irvingmasjid.org'||host.endsWith('.irvingmasjid.org'))return 'ici';
    const exactName=String(name||'').trim().toLowerCase()==='valley ranch islamic center';
    if(exactName&&distanceMiles(latitude,longitude,VRIC.latitude,VRIC.longitude)<=2)return 'vric';
    return '';
  }
  function normalize(response,origin,limit,radiusMeters){
    const elements=response&&Array.isArray(response.elements)?response.elements:[];
    const seen=new Set();
    const results=[];
    for(const element of elements){
      const point=coordinates(element);
      if(!point)continue;
      const tags=element.tags&&typeof element.tags==='object'?element.tags:{};
      if(['disused','abandoned','demolished','razed'].some(key=>String(tags[key]||'').toLowerCase()==='yes')||String(tags.amenity||'').toLowerCase()==='disused')continue;
      const name=cleanName(tags);
      if(!name)continue;
      const normalizedName=name.toLowerCase().replace(/[^a-z0-9]/g,'');
      const dedupe=normalizedName+'|'+point.lat.toFixed(4)+'|'+point.lon.toFixed(4);
      if(seen.has(dedupe))continue;
      if(results.some(item=>item._normalizedName===normalizedName&&distanceMiles(item.latitude,item.longitude,point.lat,point.lon)<0.25))continue;
      seen.add(dedupe);
      const website=String(tags.website||tags['contact:website']||'').trim();
      results.push({
        id:'osm-'+String(element.type||'place')+'-'+String(element.id||results.length+1),
        name,
        latitude:point.lat,
        longitude:point.lon,
        distanceMiles:distanceMiles(origin.latitude,origin.longitude,point.lat,point.lon),
        address:String(tags['addr:full']||[tags['addr:housenumber'],tags['addr:street'],tags['addr:city']].filter(Boolean).join(' ')).trim(),
        website,
        officialProvider:providerFor(name,website,point.lat,point.lon),
        discoverySource:'openstreetmap',
        _normalizedName:normalizedName
      });
    }
    const radiusMiles=radiusMeters==null?0:Math.max(1000,Math.min(50000,Number(radiusMeters)||25000))/1609.344;
    if(radiusMiles)VERIFIED_MASJIDS.forEach(verified=>{
      const distance=distanceMiles(origin.latitude,origin.longitude,verified.latitude,verified.longitude);
      if(distance>radiusMiles)return;
      const existing=results.findIndex(item=>item.officialProvider===verified.officialProvider||item._normalizedName===verified.name.toLowerCase().replace(/[^a-z0-9]/g,''));
      const item={...verified,distanceMiles:distance,_normalizedName:verified.name.toLowerCase().replace(/[^a-z0-9]/g,'')};
      if(existing>=0)results[existing]=item;else results.push(item);
    });
    const limitCount=Math.max(1,Math.min(20,Number(limit)||8));
    const sorted=results.sort((a,b)=>a.distanceMiles-b.distanceMiles||a.name.localeCompare(b.name));
    const selected=sorted.slice(0,limitCount);
    // Keep a verified official provider discoverable even in dense areas where
    // many closer map results would otherwise push it beyond the result limit.
    sorted.filter(item=>item.discoverySource==='aslima-verified').forEach(verified=>{
      if(selected.some(item=>item.id===verified.id||item.officialProvider===verified.officialProvider))return;
      const replaceIndex=selected.map((item,index)=>({item,index})).reverse().find(entry=>entry.item.discoverySource!=='aslima-verified');
      if(replaceIndex)selected.splice(replaceIndex.index,1,verified);
    });
    return selected.sort((a,b)=>a.distanceMiles-b.distanceMiles||a.name.localeCompare(b.name)).map(({_normalizedName,...item})=>item);
  }
  function query(latitude,longitude,radiusMeters){
    const lat=Number(latitude).toFixed(3);
    const lon=Number(longitude).toFixed(3);
    const radius=Math.max(1000,Math.min(50000,Number(radiusMeters)||25000));
    return `[out:json][timeout:20];(nwr(around:${radius},${lat},${lon})["amenity"="place_of_worship"]["religion"="muslim"];nwr(around:${radius},${lat},${lon})["building"="mosque"];);out center tags;`;
  }
  async function discover(options){
    const opts=options||{};
    const latitude=Number(opts.latitude),longitude=Number(opts.longitude);
    if(!finite(latitude)||!finite(longitude)||latitude<-90||latitude>90||longitude<-180||longitude>180)throw new Error('A valid tablet location is required');
    const fetchFn=opts.fetchFn||root.fetch;
    if(typeof fetchFn!=='function')throw new Error('Nearby masjid search is unavailable');
    const proxyEndpoint=String(opts.proxyEndpoint||root.ASLIMA_MASJID_PROXY_URL||'').trim();
    if(proxyEndpoint){
      const proxyUrl=new URL(proxyEndpoint);
      proxyUrl.searchParams.set('lat',latitude.toFixed(6));
      proxyUrl.searchParams.set('lon',longitude.toFixed(6));
      proxyUrl.searchParams.set('radius',String(Math.max(1000,Math.min(50000,Number(opts.radiusMeters)||25000))));
      const response=await fetchFn(proxyUrl.toString(),{method:'GET',headers:{'Accept':'application/json'},signal:opts.signal});
      if(!response||!response.ok)throw new Error(`Nearby masjid search failed${response&&response.status?' (HTTP '+response.status+')':''}`);
      return normalize(await response.json(),{latitude,longitude},opts.limit,opts.radiusMeters);
    }
    const body='data='+encodeURIComponent(query(latitude,longitude,opts.radiusMeters));
    const controller=!opts.signal&&typeof AbortController==='function'?new AbortController():null;
    const timeoutMs=Math.max(3000,Math.min(30000,Number(opts.timeoutMs)||12000));
    const timeout=controller?setTimeout(()=>controller.abort(),timeoutMs):null;
    try{
      const response=await fetchFn(opts.endpoint||ENDPOINT,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8','Accept':'application/json'},body,signal:opts.signal||(controller&&controller.signal)});
      if(!response||!response.ok)throw new Error(`Nearby masjid search failed${response&&response.status?' (HTTP '+response.status+')':''}`);
      return normalize(await response.json(),{latitude,longitude},opts.limit,opts.radiusMeters);
    }catch(error){
      if(error&&error.name==='AbortError')throw new Error('Nearby masjid search timed out — please try again');
      throw error;
    }finally{if(timeout)clearTimeout(timeout);}
  }
  async function discoverPostal(options){
    const opts=options||{};
    const postalCode=String(opts.postalCode||'').trim();
    if(!/^\d{5}$/.test(postalCode))throw new Error('Enter a valid 5-digit ZIP code');
    const fetchFn=opts.fetchFn||root.fetch;
    const proxyEndpoint=String(opts.proxyEndpoint||root.ASLIMA_MASJID_PROXY_URL||'').trim();
    if(!proxyEndpoint||typeof fetchFn!=='function')throw new Error('ZIP-code search is unavailable');
    const url=new URL(proxyEndpoint);
    url.pathname=url.pathname.replace(/\/nearby\/?$/,'/geocode');
    url.search='';
    url.searchParams.set('postalCode',postalCode);
    const response=await fetchFn(url.toString(),{method:'GET',headers:{'Accept':'application/json'},signal:opts.signal});
    if(!response||!response.ok)throw new Error(response&&response.status===404?'ZIP code was not found':'ZIP-code search is temporarily unavailable');
    const area=await response.json();
    const results=await discover({...opts,latitude:area.latitude,longitude:area.longitude,fetchFn});
    return {area,results};
  }

  root.ASLIMAMasjidDiscovery=Object.freeze({version:VERSION,endpoint:ENDPOINT,verifiedMasjids:VERIFIED_MASJIDS,distanceMiles,normalize,query,discover,discoverPostal});
})(typeof window!=='undefined'?window:globalThis);
