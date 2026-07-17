/* ASLIMA V9.1.30 — refined and aligned Hanafi prayer-guidance banners.
   Isolated display add-on: does not modify prayer times, Azaan audio, Firebase,
   timing-source selection, the controls drawer, or the animated background. */
(function(){
  'use strict';

  var ADDON_ID='aslima-prayer-warning-banners-v930';
  if(window.__ASLIMA_PRAYER_WARNINGS_V930__)return;
  window.__ASLIMA_PRAYER_WARNINGS_V930__=true;

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

  function installStyles(){
    if(document.getElementById(ADDON_ID+'-style'))return;
    var style=document.createElement('style');
    style.id=ADDON_ID+'-style';
    style.textContent=`
      #aslimaPrayerWarning{
        --warn-accent:#efb94f;
        --warn-soft:rgba(239,185,79,.16);
        position:fixed;
        left:16px;
        top:16px;
        width:min(520px,42vw);
        max-width:calc(100vw - 32px);
        min-height:92px;
        display:grid;
        grid-template-columns:38px minmax(0,1fr);
        align-items:start;
        gap:10px 14px;
        padding:12px 14px;
        border:1px solid rgba(239,185,79,.55);
        border-radius:18px;
        background:linear-gradient(180deg,rgba(10,14,18,.94),rgba(5,10,14,.92));
        color:#fff2d7;
        box-shadow:0 12px 34px rgba(0,0,0,.34),0 0 18px var(--warn-soft),inset 0 1px 0 rgba(255,255,255,.08);
        -webkit-backdrop-filter:blur(14px) saturate(1.08);
        backdrop-filter:blur(14px) saturate(1.08);
        opacity:0;
        visibility:hidden;
        transform:translateY(8px) scale(.988);
        transition:opacity .22s ease,transform .22s ease,visibility 0s linear .22s;
        pointer-events:none;
        contain:layout style;
        box-sizing:border-box;
      }
      #aslimaPrayerWarning.aslima-warning-visible{
        opacity:1;
        visibility:visible;
        transform:translateY(0) scale(1);
        transition:opacity .22s ease,transform .22s ease,visibility 0s;
      }
      #aslimaPrayerWarning[data-level="red"]{
        --warn-accent:#ff7b72;
        --warn-soft:rgba(255,123,114,.15);
        border-color:rgba(255,123,114,.52);
        background:linear-gradient(180deg,rgba(27,11,12,.95),rgba(12,10,12,.94));
      }
      #aslimaPrayerWarning .aslima-warning-icon{
        width:38px;
        min-width:38px;
        height:38px;
        display:grid;
        place-items:center;
        border:1px solid color-mix(in srgb,var(--warn-accent) 54%,transparent);
        border-radius:12px;
        background:var(--warn-soft);
        color:var(--warn-accent);
        font:800 23px/1 Inter,system-ui,sans-serif;
        text-shadow:0 0 8px rgba(0,0,0,.12);
      }
      #aslimaPrayerWarning .aslima-warning-copy{
        min-width:0;
        display:grid;
        grid-template-columns:minmax(0,1fr) auto;
        grid-template-areas:"title countdown" "detail detail";
        align-items:start;
        gap:8px 12px;
      }
      #aslimaPrayerWarning .aslima-warning-title{
        grid-area:title;
        min-width:0;
        color:#fff0d3;
        font-size:clamp(15px,1.1vw,19px);
        line-height:1.05;
        font-weight:780;
        letter-spacing:.03em;
        text-transform:uppercase;
        white-space:nowrap;
        overflow:hidden;
        text-overflow:ellipsis;
      }
      #aslimaPrayerWarning .aslima-warning-detail{
        grid-area:detail;
        min-width:0;
        color:rgba(255,240,211,.84);
        font-size:clamp(12px,.95vw,15px);
        line-height:1.26;
        font-weight:560;
        letter-spacing:.01em;
        white-space:normal;
        overflow:hidden;
        display:-webkit-box;
        -webkit-box-orient:vertical;
        -webkit-line-clamp:2;
      }
      #aslimaPrayerWarning .aslima-warning-countdown{
        grid-area:countdown;
        align-self:start;
        display:inline-flex;
        align-items:center;
        justify-content:center;
        min-width:118px;
        max-width:170px;
        padding:8px 11px;
        border:1px solid color-mix(in srgb,var(--warn-accent) 42%,transparent);
        border-radius:999px;
        background:rgba(0,0,0,.20);
        color:#ffe9bd;
        font-size:clamp(11px,.84vw,14px);
        line-height:1;
        font-weight:740;
        letter-spacing:.04em;
        text-align:center;
        white-space:nowrap;
        font-variant-numeric:tabular-nums;
      }
      #aslimaPrayerWarning[data-level="red"] .aslima-warning-countdown{color:#ffd7d2}
      @supports not (color:color-mix(in srgb,red,blue)){
        #aslimaPrayerWarning .aslima-warning-icon{border-color:rgba(239,185,79,.48)}
        #aslimaPrayerWarning .aslima-warning-countdown{border-color:rgba(239,185,79,.36)}
        #aslimaPrayerWarning[data-level="red"] .aslima-warning-icon{border-color:rgba(255,123,114,.48)}
        #aslimaPrayerWarning[data-level="red"] .aslima-warning-countdown{border-color:rgba(255,123,114,.38)}
      }
      @media (max-width:980px){
        #aslimaPrayerWarning{padding:11px 12px;gap:9px 12px;min-height:88px}
        #aslimaPrayerWarning .aslima-warning-countdown{min-width:108px}
      }
      @media (max-width:760px){
        #aslimaPrayerWarning{grid-template-columns:34px minmax(0,1fr)}
        #aslimaPrayerWarning .aslima-warning-icon{width:34px;min-width:34px;height:34px;font-size:20px}
        #aslimaPrayerWarning .aslima-warning-copy{
          grid-template-columns:1fr;
          grid-template-areas:"title" "countdown" "detail";
          gap:6px 0;
        }
        #aslimaPrayerWarning .aslima-warning-title{white-space:normal}
        #aslimaPrayerWarning .aslima-warning-countdown{justify-self:start;max-width:none}
      }
      @media (max-height:650px){
        #aslimaPrayerWarning{min-height:84px;padding:10px 11px}
      }
      @media (max-aspect-ratio:1/1){
        #aslimaPrayerWarning{
          left:16px!important;
          right:16px!important;
          width:auto!important;
          max-width:none!important;
          top:clamp(70px,8vh,96px)!important;
          transform:translateY(-8px) scale(.988);
        }
        #aslimaPrayerWarning.aslima-warning-visible{transform:translateY(0) scale(1)}
      }
      @media (prefers-reduced-motion:reduce){#aslimaPrayerWarning{transition:none!important}}
    `;
    document.head.appendChild(style);
  }

  function createBanner(){
    var existing=document.getElementById('aslimaPrayerWarning');
    if(existing)return existing;
    var banner=document.createElement('section');
    banner.id='aslimaPrayerWarning';
    banner.setAttribute('role','status');
    banner.setAttribute('aria-live','polite');
    banner.setAttribute('aria-atomic','true');
    banner.setAttribute('aria-hidden','true');

    var icon=document.createElement('div');
    icon.className='aslima-warning-icon';
    icon.setAttribute('aria-hidden','true');
    icon.textContent='!';

    var copy=document.createElement('div');
    copy.className='aslima-warning-copy';
    var title=document.createElement('div');
    title.className='aslima-warning-title';
    var countdown=document.createElement('div');
    countdown.className='aslima-warning-countdown';
    var detail=document.createElement('div');
    detail.className='aslima-warning-detail';

    copy.appendChild(title);
    copy.appendChild(countdown);
    copy.appendChild(detail);
    banner.appendChild(icon);
    banner.appendChild(copy);
    document.body.appendChild(banner);
    return banner;
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

  function makeState(id,level,title,detail,end,now,countdownLabel){
    return {
      id:id,
      level:level,
      title:title,
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
      return makeState('sunrise','red','Sunrise Prayer Restriction','Please wait until the sun has fully risen.',sunriseEnd,now,'Until Clear');
    }
    if(now>=zawalStart&&now<schedule.Dhuhr){
      return makeState('zawal','red','Zawāl Restriction','Please wait until Dhuhr begins.',schedule.Dhuhr,now,'Until Dhuhr');
    }
    if(now>=sunsetStart&&now<schedule.Maghrib){
      return makeState('sunset','red','Sunset Prayer Restriction','Avoid voluntary and make-up prayers. If today’s Asr is still due, pray it now.',schedule.Maghrib,now,'Until Maghrib');
    }
    if(now>=schedule.Fajr&&now<schedule.Sunrise){
      return makeState('after-fajr','amber','Fajr Prayer Guidance','Pray the Sunnah and Fard of Fajr. After completing the Fard, avoid additional voluntary prayer until sunrise.',schedule.Sunrise,now,'Until Sunrise');
    }
    if(now>=schedule.Asr&&now<sunsetStart){
      return makeState('after-asr','amber','Asr Prayer Guidance','Pray Asr if it is still due. After completing Asr, avoid voluntary prayer until Maghrib.',sunsetStart,now,'Until Maghrib');
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
    return state.countdownLabel+' · '+formatRemaining(state.remainingMinutes);
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

    var desiredTop=Math.round(rect.bottom+gap);
    var maxTop=window.innerHeight-banner.offsetHeight-margin;

    var jumuah=document.getElementById('jumuah');
    if(jumuah){
      var jRect=jumuah.getBoundingClientRect();
      if(jRect.top>0)maxTop=Math.min(maxTop,Math.floor(jRect.top-banner.offsetHeight-10));
    }

    var brand=document.getElementById('brand');
    if(brand){
      var bRect=brand.getBoundingClientRect();
      if(bRect.top>0)maxTop=Math.min(maxTop,Math.floor(bRect.top-banner.offsetHeight-12));
    }

    var minTop=Math.round(rect.bottom+8);
    var top=Math.max(minTop,Math.min(desiredTop,maxTop));
    top=Math.max(margin,Math.min(top,window.innerHeight-banner.offsetHeight-margin));
    banner.style.top=top+'px';
  }

  var lastPaintKey='';
  function hideBanner(banner){
    banner.classList.remove('aslima-warning-visible');
    banner.setAttribute('aria-hidden','true');
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

    var countdownText=buildCountdownText(state);
    var paintKey=[state.id,state.level,state.title,state.detail,countdownText].join('|');
    if(paintKey!==lastPaintKey){
      banner.dataset.level=state.level;
      banner.dataset.state=state.id;
      banner.querySelector('.aslima-warning-title').textContent=state.title;
      banner.querySelector('.aslima-warning-detail').textContent=state.detail;
      banner.querySelector('.aslima-warning-countdown').textContent=countdownText;
      lastPaintKey=paintKey;
    }
    applyAnchoredLayout(banner);
    banner.classList.add('aslima-warning-visible');
    banner.setAttribute('aria-hidden','false');
    return state;
  }

  function start(){
    installStyles();
    createBanner();
    update();
    window.setInterval(update,Math.max(500,config.updateIntervalMs));
    window.addEventListener('resize',function(){update();},{passive:true});
    window.addEventListener('orientationchange',function(){window.setTimeout(update,120);},{passive:true});
  }

  window.ASLIMAPrayerWarnings={
    version:'9.1.30',
    config:config,
    parseMinutes:parseMinutes,
    normalizeSchedule:normalizeSchedule,
    getState:getState,
    update:update,
    applyAnchoredLayout:applyAnchoredLayout,
    buildCountdownText:buildCountdownText,
    formatRemaining:formatRemaining
  };

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})();
