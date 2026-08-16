const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'..');
const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
const preview=fs.readFileSync(path.join(root,'preview.html'),'utf8');
const admin=fs.readFileSync(path.join(root,'admin.html'),'utf8');

test('index and preview remain byte-identical',()=>{
  assert.equal(index,preview);
});

test('premium drawer uses the task-focused information architecture',()=>{
  assert.match(index,/data-drawer-section="audio"><span[^>]*>◉<\/span>Prayers/);
  assert.match(index,/data-drawer-section="voice"><span[^>]*>♪<\/span>Audio/);
  assert.match(index,/data-drawer-section="timing"><span[^>]*>◷<\/span>Timings/);
  assert.match(index,/id="drawerSyncStatus" data-state="connecting"/);
  assert.doesNotMatch(index,/Choose one task at a time\. This keeps the tablet drawer clean/);
});

test('Azaan voices use one compact selector with Mishary recommended',()=>{
  assert.match(index,/id="drawerMuezzinSelect" class="muezzin-select"/);
  assert.doesNotMatch(index,/id="drawerMuezzinCards"/);
  assert.match(index,/AZAAN_VOICE_ORDER=\['doha','azaan1','azaan2','azaan3','azaan4','azaan5'\]/);
  assert.match(index,/<optgroup label="Recommended">/);
  assert.match(index,/<optgroup label="Other voices">/);
  assert.match(index,/name:'Mishary Alafasy',note:'Recommended · full standalone Azaan'/);
});

test('drawer connection status reflects Firebase success and failure',()=>{
  assert.match(index,/setDrawerSyncStatus\('connected','Phone connected · Changes save automatically'\)/);
  assert.match(index,/setDrawerSyncStatus\('unavailable','Phone unavailable · Changes save locally'\)/);
  assert.match(index,/#drawerSyncStatus\[data-state="connected"\] \.drawer-sync-dot/);
  assert.match(index,/#drawerSyncStatus\[data-state="unavailable"\] \.drawer-sync-dot/);
});

test('tablet test-playback volume slider is accessible and wired to canonical setVolume',()=>{
  assert.match(index,/id="drawerVolumeRange"[^>]*min="0"[^>]*max="100"[^>]*step="1"[^>]*aria-label="Test Azaan and dua volume"/);
  assert.match(index,/drawerVolumeRange\.addEventListener\('input',[\s\S]*?setVolume\(Number\(drawerVolumeRange\.value\)\/100\)/);
  assert.match(index,/document\.activeElement!==drawerRange[\s\S]*?drawerRange\.value=String\(Math\.round\(audio\.volume\*100\)\)/);
});

test('drawer actions are contextual and manual fields use progressive disclosure',()=>{
  assert.match(index,/#azaanDrawer\[data-active-section="voice"\] \.azaan-drawer-actions/);
  assert.match(index,/#tabletManualTimingBox:not\(\[data-mode="manual"\]\) \.tablet-manual-grid/);
  assert.match(index,/box\.setAttribute\('data-mode',mode\)/);
  assert.match(index,/drawer\.setAttribute\('data-active-section',name\)/);
});

test('timing mode is the only source selector in the drawer',()=>{
  assert.doesNotMatch(index,/id="openTimingSourceScreen"/);
  assert.doesNotMatch(index,/<div class="azaan-drawer-title small-title">Timing Source<\/div>/);
  assert.match(index,/class="tablet-timing-refresh-row"/);
  assert.equal((index.match(/id="refreshTimingSource"/g)||[]).length,1);
});

test('new drawer controls have unique ids',()=>{
  for(const id of ['azaanDrawerHeadClose','drawerVolumeRange','drawerVolumePct','drawerTestAzaan','drawerStopAzaan']){
    const matches=index.match(new RegExp(`id="${id}"`,'g'))||[];
    assert.equal(matches.length,1,`${id} must appear exactly once`);
  }
});

test('both drawer close controls clear every open-state owner',()=>{
  assert.match(index,/function closeAzaanDrawer\(\)[\s\S]*?classList\.remove\('open'\)[\s\S]*?document\.body\.classList\.remove\('azaan-drawer-open','drawer-open'\)/);
  assert.match(index,/window\.closeAzaanDrawer=closeAzaanDrawer/);
  assert.match(index,/id="azaanDrawerHeadClose"/);
  assert.match(index,/id="azaanDrawerClose"/);
});

test('supplementary prayers provide accessible how-to-pray guidance',()=>{
  for(const id of ['tahajjud','ishraq','duha']){
    assert.match(index,new RegExp(`${id}:\\{[\\s\\S]*?title:`),`${id} guidance must exist`);
  }
  assert.match(index,/data-supp-prayer-info="\$\{entry\.id\}"/);
  assert.match(index,/aria-label="How to pray \$\{entry\.title\}"/);
  assert.match(index,/id="suppPrayerInfoDialog"[^>]*role="dialog"[^>]*aria-modal="true"/);
  assert.match(index,/function openSupplementaryPrayerInfo\(id,trigger\)/);
  assert.match(index,/function closeSupplementaryPrayerInfo\(\)/);
  assert.match(index,/if\(e\.key==='Escape'\)[\s\S]*?closeSupplementaryPrayerInfo\(\)/);
});

test('Jumuah schedule and supplementary information affordance use restrained sizing',()=>{
  assert.match(index,/\.supp-prayer-info-button\{[\s\S]*?width:clamp\(16px,1\.05vw,20px\)!important/);
  assert.match(index,/\.jumuah-row-slot strong\{[\s\S]*?font-size:clamp\(11px,\.82vw,14px\)!important/);
});

test('expanded bottom dock remains inside short kiosk viewports',()=>{
  assert.match(index,/id="aslima-v967-interface-polish"/);
  assert.match(index,/grid-template-rows:auto minmax\(0,1fr\) auto!important/);
  assert.match(index,/\.bottom-dock,\s*\.bottom-dock\.detail-open\{\s*transform:none!important/);
  assert.match(index,/\.bottom-dock\.detail-open \.dock-detail-area\{[\s\S]*?max-height:min\(26vh,220px\)[\s\S]*?overflow-y:auto/);
  assert.match(index,/@media \(max-height:650px\)\{[\s\S]*?max-height:min\(24vh,150px\)/);
});

test('phone admin always presents the complete daily prayer schedule',()=>{
  assert.match(admin,/id="dailyScheduleGrid" aria-live="polite"/);
  assert.match(admin,/function renderDailySchedule\(nextPrayer\)/);
  assert.match(admin,/PRAYERS\.map\(prayer=>/);
  assert.match(admin,/sunrise\?'Sunrise'/);
  assert.match(admin,/data-actionable="\$\{!sunrise\}"/);
  assert.match(admin,/class="schedulePrayer\$\{prayer===nextPrayer\?' next':''\}"/);
  assert.match(admin,/function displayTime\(value\)/);
  assert.match(admin,/id="time_\$\{p\}"/);
  assert.match(admin,/badge\.textContent=active\?'Selected':'Not selected'/);
  assert.doesNotMatch(admin,/#lock\{display:none!important\}/);
});

test('phone admin secondary refinements remain readable and contextual',()=>{
  assert.match(admin,/\.page:not\(#todayPage\) \.card\{[^}]*box-shadow:none[^}]*backdrop-filter:none/);
  assert.match(admin,/id="recentActivityCard"><h2>Commands From This Phone<\/h2>/);
  assert.match(admin,/\$\('stop'\)\.hidden=!playing/);
  assert.match(admin,/role="status" aria-live="polite" aria-atomic="true"/);
  assert.match(admin,/setTimeout\(\(\)=>el\.classList\.remove\('show'\),5000\)/);
  assert.match(admin,/id="themeSystem"/);assert.match(admin,/id="themeLight"/);
  assert.match(admin,/const PHONE_THEME_KEY='aslima_phone_theme'/);
  assert.match(admin,/@media\(max-height:640px\)/);
  assert.match(admin,/window\.visualViewport\.addEventListener\('resize',updatePhoneViewport\)/);
  assert.match(admin,/font-size:\.75rem!important/);
});

test('phone admin uses a stable mobile-first hierarchy without cramped prayer cards',()=>{
  assert.match(admin,/<body data-active-tab="todayPage">/);
  assert.match(admin,/@media\(max-width:520px\)/);
  assert.match(admin,/\.dailyScheduleGrid\{grid-template-columns:1fr/);
  assert.match(admin,/\.schedulePrayerTime\{font-size:14px;white-space:nowrap\}/);
  assert.match(admin,/\.dayPrayerSwitches label\{min-height:48px\}/);
  assert.match(admin,/body\[data-active-tab="todayPage"\] \.hero\{display:block\}/);
  assert.match(admin,/function switchTab\(id\)\{document\.body\.dataset\.activeTab=id/);
  assert.ok(admin.indexOf('<nav class="tabs"')<admin.indexOf('<section class="hero">'));
});

test('phone admin uses the compact weekly checkmark matrix',()=>{
  assert.match(admin,/class="phone-azaan-head"><span>Day<\/span>/);
  assert.match(admin,/class="phone-azaan-row"/);
  assert.match(admin,/input:checked\+span::after\{content:'✓'/);
  assert.doesNotMatch(admin,/class="phone-azaan-day-toggle"/);
});

test('today prayer schedule uses a premium unified table hierarchy',()=>{
  assert.match(admin,/class="scheduleTableHead"[^>]*><span>Prayer<\/span><span>Adhan<\/span><span>Iqamah<\/span><span>Status<\/span>/);
  assert.match(admin,/\.dailyScheduleGrid\{display:block;overflow:hidden;border:/);
  assert.match(admin,/\.schedulePrayer\.next\{[^}]*box-shadow:inset 3px 0 0 var\(--gold\)/);
  assert.match(admin,/class="iqamah\$\{iqamah\?'':' empty'\}"/);
});

test('Classic and Focus reuse the complete tablet display and sync from phone',()=>{
  assert.match(index,/id="aslima-focus-layout"/);
  assert.match(index,/data-display-layout-choice="classic"/);
  assert.match(index,/data-display-layout-choice="focus"/);
  assert.match(index,/body\[data-display-layout="focus"\] \.prayer-panel\{[\s\S]*?grid-template-columns:repeat\(5,minmax\(0,1fr\)\)/);
  assert.match(index,/id="jumuahPillTimes"/);
  assert.match(index,/body\[data-display-layout="focus"\] \.dock-content-row\{[\s\S]*?58fr[\s\S]*?42fr/);
  assert.match(index,/const DISPLAY_LAYOUT_KEY='aslima_display_layout'/);
  assert.match(index,/window\.aslimaRemoteRef\.child\('displayLayout'\)\.set\(displayLayout\)/);
  assert.match(index,/function applyRemoteDisplayLayout\(data\)/);
  assert.match(index,/displayLayoutLocalChangedAt&&remoteChangedAt<displayLayoutLocalChangedAt/);
  assert.match(index,/applyRemoteDisplayLayout\(data\)/);
  assert.match(admin,/id="layoutClassic"/);
  assert.match(admin,/id="layoutFocus"/);
  assert.match(admin,/id="layoutCurrent"/);
  assert.ok(admin.indexOf('class="layoutQuick"')<admin.indexOf('<section class="hero">'));
  assert.match(admin,/waitForTabletLayout\(layout\)/);
  assert.match(admin,/tabletHealth\.displayLayout===layout/);
  assert.match(admin,/sendTabletCommand\('reloadDisplay',\{\},'Update tablet display'\)/);
  assert.match(admin,/selectTabletLayout\('focus'\)/);
});

test('display isolates the Farooq Home tablet from the original home profile',()=>{
  const farooqLayout=fs.readFileSync(path.join(root,'assets/farooq-home-10in.css'),'utf8');
  assert.match(index,/const ASLIMA_DEVICE_PROFILES=new Set\(\['home','farooq-home'\]\)/);
  assert.match(index,/new URLSearchParams\(location\.search\)\.get\('device'\)/);
  assert.match(index,/localStorage\.setItem\(ASLIMA_DEVICE_PROFILE_KEY,deviceProfile\)/);
  assert.match(index,/path: `aslima\/devices\/\$\{deviceProfile\}\/settings`/);
  assert.match(index,/statusPath: `aslima\/devices\/\$\{deviceProfile\}\/status\/display`/);
  assert.match(index,/assets\/farooq-home-10in\.css\?v=1017/);
  assert.match(farooqLayout,/@media \(min-width:1180px\) and \(max-width:1366px\)[\s\S]*?\(orientation:landscape\)/);
  assert.match(farooqLayout,/html\[data-device-profile="farooq-home"\] body\[data-display-layout="focus"\]/);
  assert.match(farooqLayout,/\.remaining\[data-connection-state="unavailable"\][\s\S]*?white-space:normal!important/);
  assert.match(farooqLayout,/@media \(min-width:720px\) and \(max-width:1179px\)[\s\S]*?body:not\(\[data-display-layout="focus"\]\) \.supp-ticker/);
  assert.match(farooqLayout,/body\[data-display-layout="focus"\] #suppViewAllBtn\.supp-ticker[\s\S]*?grid-template-columns:24px minmax\(0,1fr\) max-content max-content/);
  assert.match(farooqLayout,/body\[data-display-layout="focus"\] \.jumuah-pill[\s\S]*?grid-template-columns:24px max-content minmax\(0,1fr\) 12px/);
  assert.doesNotMatch(farooqLayout,/(^|\})\s*body\[data-display-layout=/);
});

test('Focus matches the approved centered clock, complete cards, progress ring, and unified dock',()=>{
  assert.match(index,/id="aslima-focus-layout-exact"/);
  assert.match(index,/\.clock\{[\s\S]*?left:50%!important[\s\S]*?transform:translateX\(-50%\)!important/);
  assert.match(index,/\.date\{[\s\S]*?left:50vw!important[\s\S]*?transform:translateX\(-50%\)!important/);
  assert.match(index,/\.hijri-date\{[\s\S]*?left:50vw!important[\s\S]*?transform:translateX\(-50%\)!important/);
  assert.match(index,/function updateFocusCountdownProgress\(next\)/);
  assert.match(index,/class="focus-progress-ring" viewBox="0 0 240 240"/);
  assert.match(index,/class="focus-ring-ticks"/);
  assert.match(index,/class="focus-ring-track"/);
  assert.match(index,/class="focus-ring-progress"/);
  assert.match(index,/class="focus-ring-side-shine"/);
  assert.match(index,/class="focus-ring-endpoint"/);
  assert.match(index,/progress\.style\.strokeDasharray=pct\+' '\+\(100-pct\)/);
  assert.match(index,/endpoint\.setAttribute\('transform','rotate\('\+angle\+' 120 120\)'\)/);
  assert.match(index,/\.iqamah-time\{[\s\S]*?font-size:clamp\(24px,2\.5vw,38px\)!important/);
  assert.match(index,/\.dock-content-row\{[\s\S]*?51\.4fr[\s\S]*?48\.6fr/);
  assert.doesNotMatch(index,/assets\/focus-arch-overlay\.svg/);
  assert.match(index,/assets\/focus-calendar\.svg/);
  assert.match(index,/assets\/focus-mosque\.svg/);
  assert.match(index,/assets\/aslima-mark\.svg/);
  assert.match(index,/\.layout-toggle\{position:fixed;top:14vh/);
  assert.match(index,/body\[data-display-layout="focus"\] \.layout-toggle\{top:3\.2vh!important/);
  assert.match(admin,/displayLayoutUpdatedAt:firebase\.database\.ServerValue\.TIMESTAMP/);
});

test('Focus fidelity layer preserves complete live content at both tablet aspect ratios',()=>{
  const fidelity=fs.readFileSync(path.join(root,'assets/focus-fidelity-v987.css'),'utf8');
  assert.match(index,/assets\/focus-fidelity-v987\.css/);
  assert.match(fidelity,/background-image:linear-gradient\(180deg[\s\S]*?url\("aslima-focus-background-v1\.png"\)!important/);
  assert.match(fidelity,/html body\[data-display-layout="focus"\] \.app::before\{[\s\S]*?background:transparent!important/);
  assert.match(fidelity,/background-size:cover!important/);
  assert.match(index,/id="aslima-focus-ring-visibility-guard"[^>]*>body:not\(\[data-display-layout="focus"\]\) \.focus-progress-ring\{display:none!important\}/);
  assert.match(index,/focus-fidelity-v987\.css\?v=1017/);
  assert.match(fidelity,/\.clock\[data-wide-hour="true"\]/);
  assert.match(index,/clock'\)\.dataset\.wideHour=String\(h\)\.length>1/);
  assert.match(fidelity,/body:not\(\[data-display-layout="focus"\]\) \.focus-progress-ring\{display:none!important\}/);
  assert.match(fidelity,/\.focus-progress-ring\{[\s\S]*?overflow:visible/);
  assert.match(fidelity,/\.focus-ring-ticks\{[\s\S]*?stroke-dasharray/);
  assert.match(fidelity,/\.focus-ring-progress\{[\s\S]*?stroke:#ffd36d/);
  assert.match(fidelity,/\.left \.next-label[\s\S]*?right:11\.35%!important;width:clamp\(180px,15\.3vw,230px\)!important/);
  assert.match(fidelity,/\.focus-ring-side-shine\{[\s\S]*?stroke-linecap:round/);
  assert.match(fidelity,/\.brand-mark\{[\s\S]*?letter-spacing:\.22em!important/);
  assert.match(fidelity,/\.brand-mark::before\{[\s\S]*?3\.05vw/);
  assert.match(fidelity,/\.left \.clock\{[\s\S]*?left:50%!important[\s\S]*?width:46%!important[\s\S]*?font-family:Georgia[\s\S]*?-webkit-text-stroke/);
  assert.match(fidelity,/\.left \.clock \.ampm\{[\s\S]*?font-size:\.19em!important/);
  assert.match(index,/endpoint\.setAttribute\('transform','rotate\('\+angle\+' 120 120\)'\)/);
  assert.match(fidelity,/text-transform:uppercase!important/);
  assert.match(fidelity,/\.pname::after[\s\S]*?\.ptime:first-child::after/);
  assert.match(fidelity,/\.dock-content-row\{[\s\S]*?51\.2fr[\s\S]*?48\.8fr/);
  assert.match(fidelity,/\.jumuah-pill\{[\s\S]*?grid-template-columns:3\.7vw auto auto minmax\(0,1fr\) 1\.5vw!important/);
  assert.match(fidelity,/#jumuahPillTimes\{grid-column:4!important\}/);
  assert.match(fidelity,/\.bottom-dock\.detail-open\{overflow:visible!important\}/);
  assert.match(fidelity,/\.supp-status-prefix\{display:block!important/);
  assert.match(fidelity,/\.supp-ticker\{[\s\S]*?grid-template-columns:2\.4vw max-content minmax\(0,1fr\) auto max-content minmax\(52px,auto\) max-content max-content!important/);
  assert.match(fidelity,/\.supp-ticker-time\{min-width:max-content!important/);
  assert.match(index,/id="aslima-focus-supplementary-spacing-guard"/);
  assert.match(index,/#suppViewAllBtn\.supp-ticker\{grid-template-columns:2\.4vw max-content minmax\(0,1fr\)/);
  assert.match(fidelity,/focus-bell\.svg/);
  assert.match(fidelity,/@media \(max-aspect-ratio:5\/3\)/);
  assert.match(index,/class="aslima-persistent-handle"[^>]*><span><\/span><span><\/span><span><\/span>/);
  assert.match(index,/if\(!entries\.length\)[\s\S]*?CONFIG\.jumuah/);
});

test('always-on refinements improve glanceability and protect the tablet display',()=>{
  assert.match(index,/id="aslima-always-on-refinements"/);
  assert.match(index,/DRAWER_IDLE_MS=120000/);
  assert.match(index,/editing\|\|playback\|\|document\.body\.classList\.contains\('global-timing-open'\)/);
  assert.match(index,/Controls closed after inactivity/);
  assert.match(index,/const start=Number\.isFinite\(isha\)\?\(isha\+45\)%1440/);
  assert.match(index,/const end=Number\.isFinite\(fajr\)\?\(fajr\+1440-45\)%1440/);
  assert.match(index,/body\.night-dim:not\(\.azaan-playing\):not\(\.adhan-playing\) \.app/);
  assert.match(index,/background-size:103\.5% 103\.5%!important/);
  assert.match(index,/--burn-glow-opacity/);
  assert.match(index,/\.supp-ticker\{grid-template-columns:2\.8vw 3\.05vw minmax\(0,10vw\)/);
  assert.match(index,/\.supp-ticker-name\{min-width:0!important;max-width:100%!important;overflow:hidden!important;text-overflow:ellipsis!important;font-size:clamp\(14px,1\.08vw,17px\)!important/);
  assert.match(index,/\.supp-ticker-name\{[^}]*white-space:nowrap!important/);
  assert.match(index,/\.supp-context-item-name\{[^}]*text-overflow:ellipsis!important;white-space:nowrap!important/);
});
