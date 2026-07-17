/* ASLIMA V9.1.32 — compact expandable prayer-guidance banner.
   Collapsed by default with concise warning text; expands on tap for full details.
   Isolated display add-on: does not modify prayer times, Azaan audio, Firebase,
   timing-source selection, the controls drawer, or the animated background. */
(function(){
  'use strict';

  var ADDON_ID='aslima-prayer-warning-banners-v932';
  if(window.__ASLIMA_PRAYER_WARNINGS_V932__)return;
  window.__ASLIMA_PRAYER_WARNINGS_V932__=true;

  var defaults={
    sunriseProhibitedMinutes:18,
    zawalLeadMinutes:5,
    sunsetProhibitedMinutes:15,
    updateIntervalMs:1000
  };
  var supplied=window.ASLIMA_PRAYER_WARNING_CONFIG||{};
  var config={};
  Object.keys(defaults).forEach(function(key){
    var value=Number(supplied[key]);
    config[key]=Number.isFinite(value)&&value>=0?value:defaults[key];
  });

  var uiState={expanded:false,lastStateId:'',banner:null,currentState:null};

  function installStyles(){
    if(document.getElementById(ADDON_ID+'-style'))return;
    var style=document.createElement('style');
    style.id=ADDON_ID+'-style';
    style.textContent=`
      #aslimaPrayerWarning{
        --warn-accent:#efb94f;
        --warn-soft:rgba(239,185,79,.14);
        position:fixed;
        left:16px;
        top:16px;
        width:min(520px,42vw);
        max-width:calc(100vw - 32px);
        min-height:62px;
        display:grid;
        grid-template-columns:32px minmax(0,1fr);
        align-items:start;
        gap:6px 8px;
        padding:9px 11px;
        border:1px solid rgba(239,185,79,.46);
        border-radius:18px;
        background:linear-gradient(180deg,rgba(10,14,18,.94),rgba(6,10,14,.92));
        color:#fff2d7;
        box-shadow:0 10px 28px rgba(0,0,0,.30),0 0 12px var(--warn-soft),inset 0 1px 0 rgba(255,255,255,.06);
        -webkit-backdrop-filter:blur(14px) saturate(1.05);
        backdrop-filter:blur(14px) saturate(1.05);
        opacity:0;
        visibility:hidden;
        transform:translateY(8px) scale(.99);
        transition:opacity .20s ease,transform .20s ease,visibility 0s linear .20s,box-shadow .20s ease;
        pointer-events:none;
        box-sizing:border-box;
        cursor:pointer;
        -webkit-tap-highlight-color:transparent;
        user-select:none;
      }
      #aslimaPrayerWarning.aslima-warning-visible{
        opacity:1;
        visibility:visible;
        transform:translateY(0) scale(1);
        transition:opacity .20s ease,transform .20s ease,visibility 0s;
        pointer-events:auto;
      }
      #aslimaPrayerWarning:focus-visible{
        outline:2px solid rgba(255,255,255,.28);
        outline-offset:2px;
      }
      #aslimaPrayerWarning:active{transform:translateY(1px) scale(.995)}
      #aslimaPrayerWarning[data-level="red"]{
        --warn-accent:#ff7b72;
        --warn-soft:rgba(255,123,114,.14);
        border-color:rgba(255,123,114,.42);
        background:linear-gradient(180deg,rgba(27,11,12,.95),rgba(12,10,12,.94));
      }
      #aslimaPrayerWarning .aslima-warning-icon{
        width:32px;
        min-width:32px;
        height:32px;
        display:grid;
        place-items:center;
        border:1px solid color-mix(in srgb,var(--warn-accent) 46%,transparent);
        border-radius:10px;
        background:var(--warn-soft);
        color:var(--warn-accent);
        font:800 20px/1 Inter,system-ui,sans-serif;
      }
      #aslimaPrayerWarning .aslima-warning-copy{min-width:0;display:grid;gap:4px}
      #aslimaPrayerWarning .aslima-warning-top{
        display:grid;
        grid-template-columns:minmax(0,1fr) auto;
        align-items:start;
        gap:6px 8px;
      }
      #aslimaPrayerWarning .aslima-warning-title{
        min-width:0;
        color:#fff0d3;
        font-size:clamp(13px,.96vw,16px);
        line-height:1.08;
        font-weight:780;
        letter-spacing:.045em;
        text-transform:uppercase;
        white-space:nowrap;
      }
      #aslimaPrayerWarning .aslima-warning-meta{
        display:inline-flex;
        align-items:center;
        gap:7px;
        justify-self:end;
        flex-shrink:0;
      }
      #aslimaPrayerWarning .aslima-warning-countdown{
        display:inline-flex;
        align-items:center;
        justify-content:center;
        min-width:48px;
        max-width:72px;
        padding:6px 8px;
        border:1px solid color-mix(in srgb,var(--warn-accent) 34%,transparent);
        border-radius:999px;
        background:rgba(0,0,0,.18);
        color:#ffe9bd;
        font-size:clamp(10px,.78vw,12px);
        line-height:1;
        font-weight:730;
        letter-spacing:.045em;
        white-space:nowrap;
        font-variant-numeric:tabular-nums;
      }
      #aslimaPrayerWarning[data-level="red"] .aslima-warning-countdown{color:#ffd7d2}
      #aslimaPrayerWarning .aslima-warning-chevron{
        width:22px;
        height:22px;
        display:grid;
        place-items:center;
        color:rgba(255,240,211,.70);
        font-size:14px;
        line-height:1;
        transition:transform .18s ease,color .18s ease;
      }
      #aslimaPrayerWarning[data-expanded="true"] .aslima-warning-chevron{
        transform:rotate(180deg);
        color:rgba(255,240,211,.86);
      }
      #aslimaPrayerWarning .aslima-warning-summary{
        min-width:0;
        color:rgba(255,240,211,.76);
        font-size:clamp(11px,.82vw,12px);
        line-height:1.15;
        font-weight:570;
        white-space:nowrap;
      }
      #aslimaPrayerWarning .aslima-warning-detail,
      #aslimaPrayerWarning .aslima-warning-hint{
        display:none;
      }
      #aslimaPrayerWarning[data-expanded="true"] .aslima-warning-detail,
      #aslimaPrayerWarning[data-expanded="true"] .aslima-warning-hint{
        display:block;
      }
      #aslimaPrayerWarning .aslima-warning-detail{
        min-width:0;
        color:rgba(255,240,211,.82);
        font-size:clamp(12px,.90vw,14px);
        line-height:1.32;
        font-weight:540;
        white-space:normal;
        overflow-wrap:break-word;
      }
      #aslimaPrayerWarning .aslima-warning-hint{
        color:rgba(255,240,211,.56);
        font-size:clamp(10px,.76vw,12px);
        line-height:1.1;
        letter-spacing:.02em;
        text-transform:none;
      }
      @supports not (color:color-mix(in srgb,red,blue)){
        #aslimaPrayerWarning .aslima-warning-icon{border-color:rgba(239,185,79,.42)}
        #aslimaPrayerWarning .aslima-warning-countdown{border-color:rgba(239,185,79,.30)}
        #aslimaPrayerWarning[data-level="red"] .aslima-warning-icon{border-color:rgba(255,123,114,.42)}
        #aslimaPrayerWarning[data-level="red"] .aslima-warning-countdown{border-color:rgba(255,123,114,.32)}
      }
      @media (max-width:980px){
        #aslimaPrayerWarning{padding:10px 12px;gap:9px 11px}
        #aslimaPrayerWarning .aslima-warning-meta{gap:6px}
      }
      @media (max-width:760px){
        #aslimaPrayerWarning .aslima-warning-top{grid-template-columns:1fr}
        #aslimaPrayerWarning .aslima-warning-meta{justify-self:start}
      }
      @media (max-height:650px){
        #aslimaPrayerWarning{padding:8px 10px;min-height:58px}
      }
      @media (max-aspect-ratio:1/1){
        #aslimaPrayerWarning{
          left:16px!important;
          right:16px!important;
          width:auto!important;
          max-width:none!important;
          top:clamp(70px,8vh,96px)!important;
        }
      }
      body.aslima-warning-brand-suppressed #brand{
        opacity:0!important;
        visibility:hidden!important;
        pointer-events:none!important;
      }
      @media (prefers-reduced-motion:reduce){
        #aslimaPrayerWarning,
        #aslimaPrayerWarning .aslima-warning-chevron{transition:none!important}
      }
    `;
    document.head.appendChild(style);
  }

  function parseMinutes(value){
    if(typeof value!=='string'&&typeof value!=='number')return NaN;
    var match=String(value).trim().match(/^(\d{1,2}):(\d{2})(?:\s*([AaPp][Mm]))?$/);
    if(!match)return NaN;
    var hours=Number(match[1]);
    var minutes=Number(match[2]);
    var meridiem=(match[3]||'').toUpperCase();
    if(!Number.isInteger(hours)||!Number.isInteger(minutes)||minutes<0||minutes>59)return NaN;
    if(meridiem){
      if(hours<1||hours>12)return NaN;
      if(hours===12)hours=0;
      if(meridiem==='PM')hours+=12;
    }else if(hours<0||hours>23){
      return NaN;
    }
    return hours*60+minutes;
  }

  function readTimings(){
    try{
      if(typeof timings!=='undefined'&&timings&&typeof timings==='object')return timings;
    }catch(_error){}
    if(window.timings&&typeof window.timings==='object')return window.timings;
    return null;
  }

  function normalizeSchedule(source){
    if(!source)return null;
    var schedule={
      Fajr:parseMinutes(source.Fajr),
      Sunrise:parseMinutes(source.Sunrise),
      Dhuhr:parseMinutes(source.Dhuhr),
      Asr:parseMinutes(source.Asr),
      Maghrib:parseMinutes(source.Maghrib)
    };
    var valid=Object.keys(schedule).every(function(key){return Number.isFinite(schedule[key]);});
    if(!valid)return null;
    if(!(schedule.Fajr<schedule.Sunrise&&schedule.Sunrise<schedule.Dhuhr&&schedule.Dhuhr<schedule.Asr&&schedule.Asr<schedule.Maghrib))return null;
    return schedule;
  }

  function makeState(id,level,title,summary,detail,end,now,countdownLabel){
    return {
      id:id,
      level:level,
      title:title,
      summary:summary,
      detail:detail,
      end:end,
      countdownLabel:countdownLabel,
      remainingMinutes:Math.max(0,Math.ceil(end-now))
    };
  }

  function getState(nowMinutes,rawSchedule){
    var schedule=normalizeSchedule(rawSchedule);
    if(!schedule||!Number.isFinite(nowMinutes))return null;
    var now=Math.max(0,Math.min(1439.999,nowMinutes));
    var sunriseEnd=Math.min(schedule.Dhuhr,schedule.Sunrise+config.sunriseProhibitedMinutes);
    var zawalStart=Math.max(schedule.Sunrise,schedule.Dhuhr-config.zawalLeadMinutes);
    var sunsetStart=Math.max(schedule.Asr,schedule.Maghrib-config.sunsetProhibitedMinutes);

    if(now>=schedule.Sunrise&&now<sunriseEnd){
      return makeState('sunrise','red','Sunrise Warning','Restriction active until the sun has fully risen.','Please wait until the sun has fully risen before praying voluntary or make-up prayers.',sunriseEnd,now,'Sunrise');
    }
    if(now>=zawalStart&&now<schedule.Dhuhr){
      return makeState('zawal','red','Zawāl Warning','Restriction active until Dhuhr begins.','Please wait until Dhuhr time begins before praying.',schedule.Dhuhr,now,'Dhuhr');
    }
    if(now>=sunsetStart&&now<schedule.Maghrib){
      return makeState('sunset','red','Sunset Warning','Restriction active until Maghrib.','Avoid voluntary and make-up prayers. If today’s Asr is still due, pray it now.',schedule.Maghrib,now,'Maghrib');
    }
    if(now>=schedule.Fajr&&now<schedule.Sunrise){
      return makeState('after-fajr','amber','Fajr Guidance','Guidance applies until sunrise.','Pray the Sunnah and Fard of Fajr. After completing the Fard, avoid additional voluntary prayer until sunrise.',schedule.Sunrise,now,'Sunrise');
    }
    if(now>=schedule.Asr&&now<sunsetStart){
      return makeState('after-asr','amber','Asr Guidance','Guidance applies until Maghrib.','Pray Asr if it is still due. After completing Asr, avoid voluntary prayer until Maghrib.',sunsetStart,now,'Maghrib');
    }
    return null;
  }

  function isObscuredByHigherPriorityUI(){
    if(document.body.classList.contains('azaan-playing')||document.body.classList.contains('adhan-playing')||document.body.classList.contains('adhan-overlay-active'))return true;
    var overlay=document.getElementById('adhanOverlay');
    if(overlay&&(overlay.classList.contains('show')||overlay.getAttribute('aria-hidden')==='false'))return true;
    var modal=document.getElementById('globalTimingModal');
    if(modal&&(modal.classList.contains('open')||modal.classList.contains('show')||modal.getAttribute('aria-hidden')==='false'))return true;
    return false;
  }

  function nowAsMinutes(date){return date.getHours()*60+date.getMinutes()+date.getSeconds()/60;}

  function formatRemaining(minutes){
    if(minutes<=1)return '<1m';
    if(minutes<60)return minutes+'m';
    var hours=Math.floor(minutes/60);
    var remainder=minutes%60;
    return hours+'h'+(remainder?' '+remainder+'m':'');
  }

  function buildCountdownText(state){
    return formatRemaining(state.remainingMinutes);
  }

  function getCollapsedSummary(state){
    return state&&state.level==='red'?'Tap to view restriction':'Tap to view guidance';
  }

  function getHintText(){
    return uiState.expanded?'Tap again to collapse':'';
  }

  function createBanner(){
    var existing=document.getElementById('aslimaPrayerWarning');
    if(existing)return existing;

    var banner=document.createElement('section');
    banner.id='aslimaPrayerWarning';
    banner.setAttribute('role','button');
    banner.setAttribute('tabindex','0');
    banner.setAttribute('aria-live','polite');
    banner.setAttribute('aria-atomic','true');
    banner.setAttribute('aria-hidden','true');
    banner.setAttribute('aria-expanded','false');
    banner.dataset.expanded='false';

    var icon=document.createElement('div');
    icon.className='aslima-warning-icon';
    icon.setAttribute('aria-hidden','true');
    icon.textContent='!';

    var copy=document.createElement('div');
    copy.className='aslima-warning-copy';

    var top=document.createElement('div');
    top.className='aslima-warning-top';

    var title=document.createElement('div');
    title.className='aslima-warning-title';

    var meta=document.createElement('div');
    meta.className='aslima-warning-meta';
    var countdown=document.createElement('div');
    countdown.className='aslima-warning-countdown';
    var chevron=document.createElement('div');
    chevron.className='aslima-warning-chevron';
    chevron.setAttribute('aria-hidden','true');
    chevron.textContent='⌄';
    meta.appendChild(countdown);
    meta.appendChild(chevron);

    top.appendChild(title);
    top.appendChild(meta);

    var summary=document.createElement('div');
    summary.className='aslima-warning-summary';
    var detail=document.createElement('div');
    detail.className='aslima-warning-detail';
    var hint=document.createElement('div');
    hint.className='aslima-warning-hint';

    copy.appendChild(top);
    copy.appendChild(summary);
    copy.appendChild(detail);
    copy.appendChild(hint);

    banner.appendChild(icon);
    banner.appendChild(copy);
    document.body.appendChild(banner);

    banner.addEventListener('click',function(event){event.stopPropagation();toggleExpanded();});
    banner.addEventListener('keydown',function(event){
      var key=event.key||event.code;
      if(key==='Enter'||key===' '||key==='Spacebar'){
        event.preventDefault();
        toggleExpanded();
      }
    });

    uiState.banner=banner;
    return banner;
  }

  function setExpanded(expanded,skipLayout){
    uiState.expanded=!!expanded;
    if(!uiState.expanded)document.body.classList.remove('aslima-warning-brand-suppressed');
    var banner=uiState.banner||document.getElementById('aslimaPrayerWarning');
    if(!banner)return;
    banner.dataset.expanded=uiState.expanded?'true':'false';
    banner.setAttribute('aria-expanded',uiState.expanded?'true':'false');
    var hint=banner.querySelector('.aslima-warning-hint');
    if(hint)hint.textContent=getHintText();
    var summary=banner.querySelector('.aslima-warning-summary');
    if(summary&&uiState.currentState)summary.textContent=uiState.expanded?uiState.currentState.summary:getCollapsedSummary(uiState.currentState);
    if(!skipLayout){
      applyAnchoredLayout(banner);
      if(window.requestAnimationFrame)window.requestAnimationFrame(function(){applyAnchoredLayout(banner);});
      window.setTimeout(function(){applyAnchoredLayout(banner);},40);
    }
  }

  function toggleExpanded(){
    var banner=uiState.banner||document.getElementById('aslimaPrayerWarning');
    if(!banner||banner.getAttribute('aria-hidden')==='true')return;
    setExpanded(!uiState.expanded,false);
  }

  function applyAnchoredLayout(banner){
    if(!banner)return;
    if(window.matchMedia&&window.matchMedia('(max-aspect-ratio:1/1)').matches){
      banner.style.left='';
      banner.style.top='';
      banner.style.width='';
      return;
    }
    var panel=document.getElementById('prayerPanel')||document.querySelector('.prayer-panel');
    if(!panel){
      banner.style.left='';
      banner.style.top='';
      banner.style.width='';
      return;
    }

    var rect=panel.getBoundingClientRect();
    var margin=16;
    var gap=window.innerHeight<=650?10:12;
    var width=Math.round(rect.width);
    var left=Math.round(rect.left);

    banner.style.width=Math.max(280,Math.min(width,window.innerWidth-margin*2))+'px';
    banner.style.left=Math.max(margin,Math.min(left,window.innerWidth-margin-banner.offsetWidth))+'px';

    var minTop=Math.round(rect.bottom+8);
    var desiredTop=Math.round(rect.bottom+gap);
    var maxTop=window.innerHeight-banner.offsetHeight-margin;

    var jumuah=document.getElementById('jumuah');
    if(jumuah){
      var jRect=jumuah.getBoundingClientRect();
      var overlapsHorizontally=!(left+banner.offsetWidth<=jRect.left||left>=jRect.right);
      if(overlapsHorizontally&&jRect.top>0)maxTop=Math.min(maxTop,Math.floor(jRect.top-banner.offsetHeight-10));
    }

    var brand=document.getElementById('brand');
    var suppressBrand=false;
    if(brand){
      var bRect=brand.getBoundingClientRect();
      suppressBrand=uiState.expanded&&bRect.top>0&&(minTop+banner.offsetHeight+14>bRect.top);
      document.body.classList.toggle('aslima-warning-brand-suppressed',suppressBrand);
      if(!suppressBrand&&bRect.top>0)maxTop=Math.min(maxTop,Math.floor(bRect.top-banner.offsetHeight-12));
    }else{
      document.body.classList.remove('aslima-warning-brand-suppressed');
    }

    var top=Math.max(minTop,Math.min(desiredTop,maxTop));
    top=Math.max(margin,Math.min(top,window.innerHeight-banner.offsetHeight-margin));
    banner.style.top=top+'px';
  }

  var lastPaintKey='';
  function hideBanner(banner){
    banner.classList.remove('aslima-warning-visible');
    banner.setAttribute('aria-hidden','true');
    setExpanded(false,true);
    uiState.lastStateId='';
    uiState.currentState=null;
    document.body.classList.remove('aslima-warning-brand-suppressed');
    lastPaintKey='';
  }

  function update(forcedNow,forcedSchedule){
    var banner=createBanner();
    var source=forcedSchedule||readTimings();
    var now=forcedNow instanceof Date?nowAsMinutes(forcedNow):(Number.isFinite(forcedNow)?forcedNow:nowAsMinutes(new Date()));
    var state=getState(now,source);
    if(!state||isObscuredByHigherPriorityUI()){
      hideBanner(banner);
      return null;
    }

    uiState.currentState=state;
    var stateChanged=state.id!==uiState.lastStateId;
    if(stateChanged)setExpanded(false,true);

    var countdownText=buildCountdownText(state);
    var paintKey=[state.id,state.level,state.title,state.summary,state.detail,countdownText,uiState.expanded].join('|');
    if(paintKey!==lastPaintKey){
      banner.dataset.level=state.level;
      banner.dataset.state=state.id;
      banner.querySelector('.aslima-warning-title').textContent=state.title;
      banner.querySelector('.aslima-warning-summary').textContent=uiState.expanded?state.summary:getCollapsedSummary(state);
      banner.querySelector('.aslima-warning-detail').textContent=state.detail;
      banner.querySelector('.aslima-warning-countdown').textContent=countdownText;
      banner.querySelector('.aslima-warning-hint').textContent=getHintText();
      lastPaintKey=paintKey;
    }

    applyAnchoredLayout(banner);
    banner.classList.add('aslima-warning-visible');
    banner.setAttribute('aria-hidden','false');
    uiState.lastStateId=state.id;
    return state;
  }

  function start(){
    installStyles();
    createBanner();
    update();
    window.setInterval(update,Math.max(500,config.updateIntervalMs));
    window.addEventListener('resize',function(){update();},{passive:true});
    window.addEventListener('orientationchange',function(){window.setTimeout(update,120);},{passive:true});
    document.addEventListener('click',function(){setExpanded(false,false);});
    document.addEventListener('keydown',function(event){if(event.key==='Escape')setExpanded(false,false);});
  }

  window.ASLIMAPrayerWarnings={
    version:'9.1.32',
    config:config,
    parseMinutes:parseMinutes,
    normalizeSchedule:normalizeSchedule,
    getState:getState,
    update:update,
    applyAnchoredLayout:applyAnchoredLayout,
    buildCountdownText:buildCountdownText,
    formatRemaining:formatRemaining,
    toggleExpanded:toggleExpanded,
    setExpanded:setExpanded,
    get uiState(){return uiState;}
  };

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})();
