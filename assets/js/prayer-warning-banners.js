/* ASLIMA V9.1.28 — compact Hanafi prayer-restriction warning banners.
   Isolated display add-on: does not modify prayer times, Azaan audio, Firebase,
   timing-source selection, the controls drawer, or the animated background. */
(function(){
  'use strict';

  var ADDON_ID='aslima-prayer-warning-banners-v928';
  if(window.__ASLIMA_PRAYER_WARNINGS_V928__)return;
  window.__ASLIMA_PRAYER_WARNINGS_V928__=true;

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
        --warn-soft:rgba(239,185,79,.17);
        position:fixed;
        top:auto;
        left:auto;
        right:4.3vw;
        bottom:clamp(82px,12vh,108px);
        z-index:78;
        width:min(520px,42vw);
        min-height:64px;
        display:grid;
        grid-template-columns:auto minmax(0,1fr) auto;
        align-items:center;
        gap:14px;
        padding:11px 14px;
        border:1px solid rgba(239,185,79,.60);
        border-radius:18px;
        background:linear-gradient(145deg,rgba(18,16,10,.92),rgba(3,10,11,.89));
        color:#fff7e8;
        box-shadow:0 14px 42px rgba(0,0,0,.42),0 0 28px var(--warn-soft),inset 0 1px 0 rgba(255,255,255,.10);
        -webkit-backdrop-filter:blur(16px) saturate(1.15);
        backdrop-filter:blur(16px) saturate(1.15);
        opacity:0;
        visibility:hidden;
        transform:translateY(10px) scale(.985);
        transition:opacity .26s ease,transform .26s ease,visibility 0s linear .26s;
        pointer-events:none;
        contain:layout style;
      }
      #aslimaPrayerWarning.aslima-warning-visible{
        opacity:1;
        visibility:visible;
        transform:translateY(0) scale(1);
        transition:opacity .26s ease,transform .26s ease,visibility 0s;
      }
      #aslimaPrayerWarning[data-level="red"]{
        --warn-accent:#ff746a;
        --warn-soft:rgba(255,79,70,.19);
        border-color:rgba(255,116,106,.64);
        background:linear-gradient(145deg,rgba(38,9,10,.95),rgba(8,8,10,.92));
      }
      #aslimaPrayerWarning .aslima-warning-icon{
        width:40px;
        height:40px;
        display:grid;
        place-items:center;
        border:1px solid color-mix(in srgb,var(--warn-accent) 62%,transparent);
        border-radius:13px;
        background:var(--warn-soft);
        color:var(--warn-accent);
        font:800 25px/1 Inter,system-ui,sans-serif;
        text-shadow:0 0 14px var(--warn-soft);
      }
      #aslimaPrayerWarning .aslima-warning-copy{min-width:0}
      #aslimaPrayerWarning .aslima-warning-title{
        overflow:hidden;
        color:#fff8e9;
        font-size:clamp(15px,1.34vw,21px);
        line-height:1.12;
        font-weight:780;
        letter-spacing:.045em;
        text-overflow:ellipsis;
        white-space:nowrap;
      }
      #aslimaPrayerWarning .aslima-warning-detail{
        margin-top:4px;
        overflow:hidden;
        color:rgba(255,248,233,.80);
        font-size:clamp(11px,1.02vw,16px);
        line-height:1.25;
        font-weight:520;
        letter-spacing:.01em;
        display:-webkit-box;
        -webkit-box-orient:vertical;
        -webkit-line-clamp:2;
        white-space:normal;
      }
      #aslimaPrayerWarning .aslima-warning-countdown{
        min-width:104px;
        padding:8px 10px;
        border:1px solid color-mix(in srgb,var(--warn-accent) 48%,transparent);
        border-radius:999px;
        background:rgba(0,0,0,.25);
        color:var(--warn-accent);
        font-size:clamp(11px,.94vw,15px);
        line-height:1;
        font-weight:760;
        letter-spacing:.055em;
        text-align:center;
        white-space:nowrap;
        font-variant-numeric:tabular-nums;
      }
      @supports not (color:color-mix(in srgb,red,blue)){
        #aslimaPrayerWarning .aslima-warning-icon{border-color:rgba(239,185,79,.55)}
        #aslimaPrayerWarning .aslima-warning-countdown{border-color:rgba(239,185,79,.42)}
        #aslimaPrayerWarning[data-level="red"] .aslima-warning-icon{border-color:rgba(255,116,106,.55)}
        #aslimaPrayerWarning[data-level="red"] .aslima-warning-countdown{border-color:rgba(255,116,106,.44)}
      }
      @media (max-width:900px){
        #aslimaPrayerWarning{width:min(460px,48vw);right:3vw;gap:10px;padding:10px 12px;border-radius:16px}
        #aslimaPrayerWarning .aslima-warning-icon{width:36px;height:36px;border-radius:11px;font-size:22px}
        #aslimaPrayerWarning .aslima-warning-countdown{min-width:70px;padding:7px 8px}
      }
      @media (max-height:650px){
        #aslimaPrayerWarning{bottom:100px;min-height:54px;padding:8px 11px}
        #aslimaPrayerWarning .aslima-warning-detail{margin-top:2px}
      }
      @media (max-aspect-ratio:1/1){
        #aslimaPrayerWarning{top:clamp(70px,8vh,96px);bottom:auto;left:16px;right:16px;width:auto;transform:translateY(-10px) scale(.985)}
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
    var detail=document.createElement('div');
    detail.className='aslima-warning-detail';
    copy.appendChild(title);
    copy.appendChild(detail);

    var countdown=document.createElement('div');
    countdown.className='aslima-warning-countdown';

    banner.appendChild(icon);
    banner.appendChild(copy);
    banner.appendChild(countdown);
    document.body.appendChild(banner);
    return banner;
  }

  function parseMinutes(value){
    if(typeof value!=='string'&&typeof value!=='number')return NaN;
    var match=String(value).trim().match(/^(\d{1,2}):(\d{2})/);
    if(!match)return NaN;
    var hours=Number(match[1]);
    var minutes=Number(match[2]);
    if(!Number.isInteger(hours)||!Number.isInteger(minutes)||hours<0||hours>23||minutes<0||minutes>59)return NaN;
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

  function makeState(id,level,title,detail,end,now){
    return {id:id,level:level,title:title,detail:detail,end:end,remainingMinutes:Math.max(0,Math.ceil(end-now))};
  }

  function getState(nowMinutes,rawSchedule){
    var schedule=normalizeSchedule(rawSchedule);
    if(!schedule||!Number.isFinite(nowMinutes))return null;
    var now=Math.max(0,Math.min(1439.999,nowMinutes));
    var sunriseEnd=Math.min(schedule.Dhuhr,schedule.Sunrise+config.sunriseProhibitedMinutes);
    var zawalStart=Math.max(schedule.Sunrise, schedule.Dhuhr-config.zawalLeadMinutes);
    var sunsetStart=Math.max(schedule.Asr, schedule.Maghrib-config.sunsetProhibitedMinutes);

    // The three red windows override broader amber guidance.
    if(now>=schedule.Sunrise&&now<sunriseEnd){
      return makeState('sunrise','red','Prayer Prohibited During Sunrise','Please wait until the sun has fully risen.',sunriseEnd,now);
    }
    if(now>=zawalStart&&now<schedule.Dhuhr){
      return makeState('zawal','red','Zawāl in Progress','Please wait until Dhuhr time begins.',schedule.Dhuhr,now);
    }
    if(now>=sunsetStart&&now<schedule.Maghrib){
      return makeState('sunset','red','Sunset Prayer Restriction','Avoid voluntary and make-up prayers. If today’s Asr is still due, pray it now.',schedule.Maghrib,now);
    }
    // The app knows the prayer time, not whether the person has completed the fard.
    // Conditional language prevents the banner from blocking an obligatory prayer.
    if(now>=schedule.Fajr&&now<schedule.Sunrise){
      return makeState('after-fajr','amber','After-Fajr Prayer Guidance','After completing Fajr, avoid voluntary prayer until sunrise. If Fajr is still due, pray it now.',schedule.Sunrise,now);
    }
    if(now>=schedule.Asr&&now<sunsetStart){
      return makeState('after-asr','amber','After-Asr Prayer Guidance','After completing Asr, avoid voluntary prayer until Maghrib. If Asr is still due, pray it now.',sunsetStart,now);
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
    if(minutes<=1)return 'Ends in <1m';
    if(minutes<60)return 'Ends in '+minutes+'m';
    var hours=Math.floor(minutes/60);
    var remainder=minutes%60;
    return 'Ends in '+hours+'h'+(remainder?' '+remainder+'m':'');
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

    var countdownText=formatRemaining(state.remainingMinutes);
    var paintKey=[state.id,state.level,state.title,state.detail,countdownText].join('|');
    if(paintKey!==lastPaintKey){
      banner.dataset.level=state.level;
      banner.dataset.state=state.id;
      banner.querySelector('.aslima-warning-title').textContent=state.title;
      banner.querySelector('.aslima-warning-detail').textContent=state.detail;
      banner.querySelector('.aslima-warning-countdown').textContent=countdownText;
      lastPaintKey=paintKey;
    }
    banner.classList.add('aslima-warning-visible');
    banner.setAttribute('aria-hidden','false');
    return state;
  }

  function start(){
    installStyles();
    createBanner();
    update();
    window.setInterval(update,Math.max(500,config.updateIntervalMs));
  }

  window.ASLIMAPrayerWarnings={
    version:'9.1.28',
    config:config,
    parseMinutes:parseMinutes,
    normalizeSchedule:normalizeSchedule,
    getState:getState,
    update:update
  };

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})();
