const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'..');
const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
const preview=fs.readFileSync(path.join(root,'preview.html'),'utf8');

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

test('Azaan voices use one compact selector with Doha recommended',()=>{
  assert.match(index,/id="drawerMuezzinSelect" class="muezzin-select"/);
  assert.doesNotMatch(index,/id="drawerMuezzinCards"/);
  assert.match(index,/AZAAN_VOICE_ORDER=\['doha','azaan1','azaan2','azaan3','azaan4','azaan5'\]/);
  assert.match(index,/<optgroup label="Recommended">/);
  assert.match(index,/<optgroup label="Other voices">/);
});

test('drawer connection status reflects Firebase success and failure',()=>{
  assert.match(index,/setDrawerSyncStatus\('connected','Phone connected · Changes save automatically'\)/);
  assert.match(index,/setDrawerSyncStatus\('unavailable','Phone unavailable · Changes save locally'\)/);
  assert.match(index,/#drawerSyncStatus\[data-state="connected"\] \.drawer-sync-dot/);
  assert.match(index,/#drawerSyncStatus\[data-state="unavailable"\] \.drawer-sync-dot/);
});

test('tablet volume slider is accessible and wired to canonical setVolume',()=>{
  assert.match(index,/id="drawerVolumeRange"[^>]*min="0"[^>]*max="100"[^>]*step="1"[^>]*aria-label="Azaan volume"/);
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

test('expanded bottom dock remains inside short kiosk viewports',()=>{
  assert.match(index,/id="aslima-v966-bottom-dock-viewport-fit"/);
  assert.match(index,/grid-template-rows:auto minmax\(0,1fr\) auto!important/);
  assert.match(index,/\.bottom-dock,\s*\.bottom-dock\.detail-open\{\s*transform:none!important/);
  assert.match(index,/\.bottom-dock\.detail-open \.dock-detail-area\{[\s\S]*?max-height:min\(26vh,220px\)[\s\S]*?overflow-y:auto/);
  assert.match(index,/@media \(max-height:650px\)\{[\s\S]*?max-height:min\(24vh,150px\)/);
});
