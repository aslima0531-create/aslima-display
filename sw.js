/* ASLIMA v9.1.62 — verified masjid and ZIP-code discovery.
   The tracked pages load the scheduler directly and register this worker explicitly. The
   worker upgrades existing controlled tablets without injecting another scheduler
   instance. The Focus fidelity sheet is cached and reinserted after legacy compatibility styles. */
const CACHE='aslima-v1007-geometric-layout-medallions';
const VERSION='1007';
const SCHEDULE_CSS_TEXT="/* ASLIMA v9.1.51 \u2014 refined prayer schedule card.\n   Visual-only. No timing, Iqamah, Jumuah, audio, remote, or scheduler logic changes. */\n\n/* The panel should feel like one composed schedule, not a spreadsheet. */\n.right{\n  width:min(40.5vw,700px)!important;\n}\n.prayer-panel{\n  position:relative!important;\n  overflow:hidden!important;\n  padding:clamp(12px,1.45vh,18px) clamp(14px,1.25vw,22px) clamp(10px,1.25vh,16px)!important;\n  border:1px solid rgba(241,189,101,.20)!important;\n  border-radius:clamp(16px,1.8vh,22px)!important;\n  background:linear-gradient(160deg,rgba(5,17,18,.89),rgba(0,8,9,.78))!important;\n  box-shadow:\n    inset 0 1px 0 rgba(255,255,255,.045),\n    0 22px 54px rgba(0,0,0,.36)!important;\n  backdrop-filter:blur(16px) saturate(108%)!important;\n  -webkit-backdrop-filter:blur(16px) saturate(108%)!important;\n}\n.prayer-panel::before{\n  content:\"\"!important;\n  position:absolute!important;\n  inset:0!important;\n  pointer-events:none!important;\n  background:\n    radial-gradient(circle at 78% -10%,rgba(241,189,101,.07),transparent 34%),\n    linear-gradient(120deg,rgba(255,255,255,.018),transparent 38%)!important;\n}\n\n/* Replace the redundant \"Prayer\" column label with a section title. */\n.prayer-panel-head{\n  position:relative!important;\n  z-index:2!important;\n  display:grid!important;\n  grid-template-columns:minmax(0,1fr) minmax(82px,auto) minmax(82px,auto)!important;\n  align-items:end!important;\n  gap:clamp(10px,.9vw,18px)!important;\n  min-height:auto!important;\n  margin:0!important;\n  padding:2px 6px 12px calc(32px + 1vw)!important;\n  border:0!important;\n  border-radius:0!important;\n  background:transparent!important;\n  box-shadow:none!important;\n  color:rgba(255,244,222,.72)!important;\n  line-height:1!important;\n}\n.prayer-panel-head::before{\n  content:\"\";\n  position:absolute;\n  left:calc(32px + 1vw);\n  right:4px;\n  bottom:0;\n  height:1px;\n  background:linear-gradient(90deg,rgba(241,189,101,.28),rgba(255,255,255,.065) 52%,transparent);\n}\n.prayer-panel-head::after{\n  content:none!important;\n}\n.prayer-panel-head span{\n  display:block!important;\n  min-height:0!important;\n  white-space:nowrap!important;\n  font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,\"Segoe UI\",sans-serif!important;\n}\n.prayer-panel-head span:first-child{\n  position:relative!important;\n  justify-self:start!important;\n  font-size:0!important;\n  color:rgba(255,244,222,.94)!important;\n}\n.prayer-panel-head span:first-child::before{\n  content:\"\";\n  display:inline-block;\n  width:6px;\n  height:6px;\n  margin:0 9px 2px 0;\n  border-radius:999px;\n  background:var(--gold);\n  box-shadow:0 0 12px rgba(241,189,101,.48);\n}\n.prayer-panel-head span:first-child::after{\n  content:\"Prayer Schedule\";\n  font-size:clamp(13px,1.05vw,17px)!important;\n  font-weight:620!important;\n  letter-spacing:.015em!important;\n  text-transform:none!important;\n}\n.prayer-panel-head span:nth-child(2),\n.prayer-panel-head span:nth-child(3){\n  justify-self:center!important;\n  text-align:center!important;\n  color:rgba(255,244,222,.58)!important;\n  font-size:clamp(10px,.82vw,13px)!important;\n  font-weight:600!important;\n  letter-spacing:.025em!important;\n  text-transform:none!important;\n}\n.prayer-panel-head span:nth-child(2)::before,\n.prayer-panel-head span:nth-child(3)::before{\n  content:none!important;\n}\n\n/* Calm, timeline-style rows. */\n#prayerPanel .row{\n  position:relative!important;\n  z-index:2!important;\n  display:grid!important;\n  grid-template-columns:minmax(28px,2vw) minmax(88px,1fr) auto!important;\n  align-items:center!important;\n  gap:clamp(9px,.82vw,15px)!important;\n  min-height:clamp(52px,6.6vh,66px)!important;\n  margin:0!important;\n  padding:clamp(8px,1.15vh,12px) 6px!important;\n  border:0!important;\n  border-radius:12px!important;\n  color:rgba(255,244,222,.95)!important;\n  background:transparent!important;\n  box-shadow:none!important;\n  transition:background .22s ease,box-shadow .22s ease,color .22s ease!important;\n}\n#prayerPanel .row::after{\n  content:\"\"!important;\n  position:absolute!important;\n  left:calc(32px + 1vw)!important;\n  right:6px!important;\n  bottom:0!important;\n  height:1px!important;\n  background:linear-gradient(90deg,rgba(255,255,255,.075),rgba(255,255,255,.035),transparent)!important;\n  opacity:1!important;\n  transform:none!important;\n}\n#prayerPanel .row:last-child::after{\n  display:none!important;\n}\n\n/* Replace mixed Unicode sun/moon glyphs with one consistent schedule marker. */\n#prayerPanel .icon{\n  position:relative!important;\n  width:26px!important;\n  min-width:26px!important;\n  height:26px!important;\n  display:grid!important;\n  place-items:center!important;\n  color:transparent!important;\n  font-size:0!important;\n  border:1px solid rgba(255,244,222,.20)!important;\n  border-radius:999px!important;\n  background:rgba(255,255,255,.025)!important;\n  box-shadow:inset 0 1px 0 rgba(255,255,255,.03)!important;\n}\n#prayerPanel .icon::before{\n  content:\"\"!important;\n  width:6px!important;\n  height:6px!important;\n  border-radius:999px!important;\n  background:rgba(255,244,222,.62)!important;\n  box-shadow:none!important;\n}\n#prayerPanel .row:not(:last-child) .icon::after{\n  content:\"\"!important;\n  position:absolute!important;\n  left:50%!important;\n  top:calc(100% + 1px)!important;\n  width:1px!important;\n  height:clamp(24px,3.4vh,34px)!important;\n  transform:translateX(-50%)!important;\n  background:linear-gradient(180deg,rgba(255,255,255,.12),rgba(255,255,255,.025))!important;\n}\n\n#prayerPanel .pname{\n  color:rgba(255,244,222,.94)!important;\n  font-size:clamp(20px,1.92vw,32px)!important;\n  font-weight:590!important;\n  letter-spacing:.005em!important;\n  line-height:1!important;\n  text-transform:none!important;\n  text-shadow:none!important;\n  transform:none!important;\n}\n.ptime-group{\n  display:grid!important;\n  grid-template-columns:minmax(82px,auto) minmax(82px,auto)!important;\n  align-items:center!important;\n  gap:clamp(10px,.9vw,18px)!important;\n}\n#prayerPanel .ptime{\n  min-width:82px!important;\n  color:rgba(255,244,222,.96)!important;\n  font-size:clamp(17px,1.5vw,27px)!important;\n  font-weight:620!important;\n  letter-spacing:-.025em!important;\n  line-height:1!important;\n  text-align:center!important;\n  white-space:nowrap!important;\n  font-variant-numeric:tabular-nums!important;\n  text-shadow:none!important;\n  transform:none!important;\n}\n#prayerPanel .iqamah-time{\n  color:rgba(244,210,149,.88)!important;\n  font-weight:570!important;\n}\n\n/* Active prayer: a quiet warm wash and illuminated marker, never a boxed selection. */\n#prayerPanel .row.active{\n  color:var(--gold)!important;\n  background:linear-gradient(90deg,rgba(241,189,101,.085),rgba(241,189,101,.028) 62%,transparent 100%)!important;\n  box-shadow:inset 3px 0 0 rgba(241,189,101,.72)!important;\n  border:0!important;\n  outline:0!important;\n}\n#prayerPanel .row.active::before{\n  content:none!important;\n}\n#prayerPanel .row.active .icon{\n  border-color:rgba(241,189,101,.48)!important;\n  background:rgba(241,189,101,.10)!important;\n  box-shadow:0 0 16px rgba(241,189,101,.12),inset 0 1px 0 rgba(255,255,255,.05)!important;\n}\n#prayerPanel .row.active .icon::before{\n  background:var(--gold)!important;\n  box-shadow:0 0 10px rgba(241,189,101,.55)!important;\n}\n#prayerPanel .row.active .pname,\n#prayerPanel .row.active .ptime,\n#prayerPanel .row.active .iqamah-time{\n  color:#f7d78f!important;\n  text-shadow:none!important;\n}\n\n@media (max-width:920px){\n  .right{width:43vw!important}\n  .prayer-panel{padding:10px 10px 8px!important}\n  .prayer-panel-head{\n    grid-template-columns:minmax(0,1fr) 66px 66px!important;\n    gap:6px!important;\n    padding:1px 4px 9px calc(28px + .6vw)!important;\n  }\n  .prayer-panel-head::before{left:calc(28px + .6vw)}\n  .prayer-panel-head span:first-child::after{font-size:12px!important}\n  .prayer-panel-head span:nth-child(2),.prayer-panel-head span:nth-child(3){font-size:9px!important;letter-spacing:.015em!important}\n  #prayerPanel .row{grid-template-columns:26px minmax(62px,1fr) auto!important;gap:6px!important;min-height:46px!important;padding:7px 4px!important;border-radius:10px!important}\n  #prayerPanel .row::after{left:calc(28px + .6vw)!important}\n  #prayerPanel .icon{width:23px!important;min-width:23px!important;height:23px!important}\n  #prayerPanel .pname{font-size:clamp(16px,2.35vw,22px)!important}\n  .ptime-group{grid-template-columns:66px 66px!important;gap:6px!important}\n  #prayerPanel .ptime{min-width:66px!important;font-size:clamp(14px,2vw,19px)!important}\n}\n@media (max-width:820px){\n  .right{width:44.5vw!important}\n  .prayer-panel-head{grid-template-columns:minmax(0,1fr) 58px 58px!important;padding-left:29px!important}\n  .prayer-panel-head::before{left:29px}\n  .prayer-panel-head span:first-child::before{width:5px;height:5px;margin-right:6px}\n  .prayer-panel-head span:first-child::after{font-size:11px!important}\n  #prayerPanel .row{grid-template-columns:23px minmax(56px,1fr) auto!important;min-height:42px!important;gap:5px!important;padding:6px 3px!important}\n  #prayerPanel .row::after{left:29px!important}\n  #prayerPanel .icon{width:20px!important;min-width:20px!important;height:20px!important}\n  #prayerPanel .icon::before{width:5px!important;height:5px!important}\n  #prayerPanel .pname{font-size:15px!important}\n  .ptime-group{grid-template-columns:58px 58px!important;gap:5px!important}\n  #prayerPanel .ptime{min-width:58px!important;font-size:13px!important}\n}\n@media (min-width:1800px) and (min-height:1050px){\n  .right{width:min(41vw,780px)!important}\n  .prayer-panel{padding:18px 22px 16px!important}\n  .prayer-panel-head{grid-template-columns:minmax(0,1fr) 122px 122px!important;padding-bottom:15px!important}\n  .ptime-group{grid-template-columns:122px 122px!important}\n  #prayerPanel .ptime{min-width:122px!important}\n  #prayerPanel .row{min-height:76px!important}\n  #prayerPanel .pname{font-size:34px!important}\n}\n";
const ICONS_CSS_TEXT="/* ASLIMA v9.1.54 \u2014 Android-safe prayer-aware icons.\n   Uses SVG background images rather than CSS masks, with a text-glyph fallback.\n   This intentionally overrides the circular v9.1.51 timeline markers. */\n#prayerPanel .icon{\n  position:relative!important;\n  width:28px!important;\n  min-width:28px!important;\n  height:28px!important;\n  display:grid!important;\n  place-items:center!important;\n  border:0!important;\n  border-radius:0!important;\n  background:transparent!important;\n  box-shadow:none!important;\n  color:transparent!important;\n  font-size:0!important;\n  opacity:.96!important;\n  transform:none!important;\n}\n#prayerPanel .icon::before{\n  content:\"\"!important;\n  display:block!important;\n  width:25px!important;\n  height:25px!important;\n  border:0!important;\n  border-radius:0!important;\n  background-color:transparent!important;\n  background-repeat:no-repeat!important;\n  background-position:center!important;\n  background-size:contain!important;\n  box-shadow:none!important;\n}\n#prayerPanel .icon::after{display:none!important;content:none!important}\n\n#prayerPanel .row[data-prayer=\"Fajr\"] .icon::before{background-image:url(\"data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%23d8c9a7%22%20stroke-width%3D%221.65%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22M3.5%2018.5h17%22%2F%3E%3Cpath%20d%3D%22M6.4%2015.5a5.6%205.6%200%200%201%2011.2%200%22%2F%3E%3Cpath%20d%3D%22M12%203.2v3%22%2F%3E%3Cpath%20d%3D%22m5.6%208.2%202.1%202%22%2F%3E%3Cpath%20d%3D%22m18.4%208.2-2.1%202%22%2F%3E%3Cpath%20d%3D%22M8.6%2021h6.8%22%2F%3E%3C%2Fsvg%3E\")!important}\n#prayerPanel .row[data-prayer=\"Dhuhr\"] .icon::before{background-image:url(\"data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%23d8c9a7%22%20stroke-width%3D%221.65%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Ccircle%20cx%3D%2212%22%20cy%3D%2212%22%20r%3D%223.7%22%2F%3E%3Cpath%20d%3D%22M12%202.3v3M12%2018.7v3M2.3%2012h3M18.7%2012h3M5.2%205.2l2.2%202.2M16.6%2016.6l2.2%202.2M18.8%205.2l-2.2%202.2M7.4%2016.6l-2.2%202.2%22%2F%3E%3C%2Fsvg%3E\")!important}\n#prayerPanel .row[data-prayer=\"Asr\"] .icon::before{background-image:url(\"data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%23d8c9a7%22%20stroke-width%3D%221.65%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Ccircle%20cx%3D%2214.4%22%20cy%3D%228.7%22%20r%3D%223.4%22%2F%3E%3Cpath%20d%3D%22M14.4%202.4v2M14.4%2013.1v2M8%208.7h2M18.8%208.7h2M9.9%204.2l1.4%201.4M17.5%2011.8l1.4%201.4M18.9%204.2l-1.4%201.4M11.3%2011.8l-1.4%201.4%22%2F%3E%3Cpath%20d%3D%22M3.5%2018.4h17M6.8%2015.6h8.6%22%2F%3E%3C%2Fsvg%3E\")!important}\n#prayerPanel .row[data-prayer=\"Maghrib\"] .icon::before{background-image:url(\"data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%23d8c9a7%22%20stroke-width%3D%221.65%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22M3.5%2014.7h17%22%2F%3E%3Cpath%20d%3D%22M6.4%2014.7a5.6%205.6%200%200%201%2011.2%200%22%2F%3E%3Cpath%20d%3D%22M12%204.2v2.8%22%2F%3E%3Cpath%20d%3D%22m5.7%209%202%201.9%22%2F%3E%3Cpath%20d%3D%22m18.3%209-2%201.9%22%2F%3E%3Cpath%20d%3D%22M5.1%2018.1h13.8M8.1%2021h7.8%22%2F%3E%3C%2Fsvg%3E\")!important}\n#prayerPanel .row[data-prayer=\"Isha\"] .icon::before{background-image:url(\"data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%23d8c9a7%22%20stroke-width%3D%221.65%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22M18.7%2015.4A7.9%207.9%200%200%201%208.6%205.3a8.2%208.2%200%201%200%2010.1%2010.1Z%22%2F%3E%3Cpath%20d%3D%22m17.6%203.7.5%201.1%201.1.5-1.1.5-.5%201.1-.5-1.1-1.1-.5%201.1-.5.5-1.1Z%22%2F%3E%3C%2Fsvg%3E\")!important}\n#prayerPanel .row.active[data-prayer=\"Fajr\"] .icon::before{background-image:url(\"data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%23f1bd65%22%20stroke-width%3D%221.65%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22M3.5%2018.5h17%22%2F%3E%3Cpath%20d%3D%22M6.4%2015.5a5.6%205.6%200%200%201%2011.2%200%22%2F%3E%3Cpath%20d%3D%22M12%203.2v3%22%2F%3E%3Cpath%20d%3D%22m5.6%208.2%202.1%202%22%2F%3E%3Cpath%20d%3D%22m18.4%208.2-2.1%202%22%2F%3E%3Cpath%20d%3D%22M8.6%2021h6.8%22%2F%3E%3C%2Fsvg%3E\")!important}\n#prayerPanel .row.active[data-prayer=\"Dhuhr\"] .icon::before{background-image:url(\"data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%23f1bd65%22%20stroke-width%3D%221.65%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Ccircle%20cx%3D%2212%22%20cy%3D%2212%22%20r%3D%223.7%22%2F%3E%3Cpath%20d%3D%22M12%202.3v3M12%2018.7v3M2.3%2012h3M18.7%2012h3M5.2%205.2l2.2%202.2M16.6%2016.6l2.2%202.2M18.8%205.2l-2.2%202.2M7.4%2016.6l-2.2%202.2%22%2F%3E%3C%2Fsvg%3E\")!important}\n#prayerPanel .row.active[data-prayer=\"Asr\"] .icon::before{background-image:url(\"data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%23f1bd65%22%20stroke-width%3D%221.65%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Ccircle%20cx%3D%2214.4%22%20cy%3D%228.7%22%20r%3D%223.4%22%2F%3E%3Cpath%20d%3D%22M14.4%202.4v2M14.4%2013.1v2M8%208.7h2M18.8%208.7h2M9.9%204.2l1.4%201.4M17.5%2011.8l1.4%201.4M18.9%204.2l-1.4%201.4M11.3%2011.8l-1.4%201.4%22%2F%3E%3Cpath%20d%3D%22M3.5%2018.4h17M6.8%2015.6h8.6%22%2F%3E%3C%2Fsvg%3E\")!important}\n#prayerPanel .row.active[data-prayer=\"Maghrib\"] .icon::before{background-image:url(\"data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%23f1bd65%22%20stroke-width%3D%221.65%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22M3.5%2014.7h17%22%2F%3E%3Cpath%20d%3D%22M6.4%2014.7a5.6%205.6%200%200%201%2011.2%200%22%2F%3E%3Cpath%20d%3D%22M12%204.2v2.8%22%2F%3E%3Cpath%20d%3D%22m5.7%209%202%201.9%22%2F%3E%3Cpath%20d%3D%22m18.3%209-2%201.9%22%2F%3E%3Cpath%20d%3D%22M5.1%2018.1h13.8M8.1%2021h7.8%22%2F%3E%3C%2Fsvg%3E\")!important}\n#prayerPanel .row.active[data-prayer=\"Isha\"] .icon::before{background-image:url(\"data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%23f1bd65%22%20stroke-width%3D%221.65%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22M18.7%2015.4A7.9%207.9%200%200%201%208.6%205.3a8.2%208.2%200%201%200%2010.1%2010.1Z%22%2F%3E%3Cpath%20d%3D%22m17.6%203.7.5%201.1%201.1.5-1.1.5-.5%201.1-.5-1.1-1.1-.5%201.1-.5.5-1.1Z%22%2F%3E%3C%2Fsvg%3E\")!important}\n\n#prayerPanel .row.active .icon{\n  border:0!important;\n  background:transparent!important;\n  box-shadow:none!important;\n}\n#prayerPanel .row.active .icon::before{\n  background-color:transparent!important;\n  border-radius:0!important;\n  box-shadow:none!important;\n  filter:drop-shadow(0 0 6px rgba(241,189,101,.34))!important;\n  transform:scale(1.045)!important;\n}\n#prayerPanel .row:not(.active) .icon::before{filter:drop-shadow(0 1px 2px rgba(0,0,0,.25))!important}\n@media (max-width:920px){\n  #prayerPanel .icon{width:24px!important;min-width:24px!important;height:24px!important}\n  #prayerPanel .icon::before{width:22px!important;height:22px!important}\n}\n@media (max-width:820px){\n  #prayerPanel .icon{width:21px!important;min-width:21px!important;height:21px!important}\n  #prayerPanel .icon::before{width:20px!important;height:20px!important}\n}\n@media (prefers-reduced-motion:reduce){#prayerPanel .icon,#prayerPanel .icon::before{transition:none!important}}\n";
const CORE=[
  './','./index.html','./preview.html','./admin.html','./admin-manifest.webmanifest','./assets/aslima-admin-icon.svg','./assets/aslima-mark.svg','./assets/focus-calendar.svg','./assets/focus-mosque.svg','./assets/focus-bell.svg','./assets/focus-fidelity-v987.css?v=1007','./assets/aslima-focus-background-v1.png','./data/vric-prayer-times.json',
  './assets/aslima-premium-bg.png','./assets/js/azaan-scheduler-v953.js',
  './assets/js/runtime-diagnostics-v960.js',
  './assets/js/runtime-recovery-v959.js',
  './assets/js/masjid-discovery-v962.js',
  './assets/audio/azaan-1.mp3','./assets/audio/azaan-2.mp3',
  './assets/audio/azaan-3.mp3','./assets/audio/azaan-4.mp3',
  './assets/audio/azaan-5.mp3',
  './assets/audio/azaan-mishary-alafasy.mp3','./assets/audio/azaan-mishary-alafasy-fajr.mp3','./assets/audio/dua-after-azaan.mp3'
];

function isDisplayDocument(url){
  return /\/(?:index|preview)\.html$/i.test(url.pathname)||url.pathname.endsWith('/');
}

self.addEventListener('install',event=>event.waitUntil(
  caches.open(CACHE).then(cache=>cache.addAll(CORE)).then(()=>self.skipWaiting())
));

self.addEventListener('activate',event=>event.waitUntil((async()=>{
  const keys=await caches.keys();
  await Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)));
  await self.clients.claim();
  // Existing versions loaded their enhancements only after a second manual reload.
  // Navigate each display client once after takeover so the repaired response is
  // applied immediately. The query marker prevents a navigation loop.
  // Do not await navigation inside activate: a controlled navigation can wait
  // for activation to finish, which would deadlock the install. Schedule the
  // one-time refresh just after the activation promise resolves instead.
  const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
  windows.forEach(client=>{try{client.postMessage({type:'aslima-runtime-update',version:VERSION});}catch(_error){}});
  setTimeout(async()=>{
    const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    windows.forEach(client=>{
      try{
        const url=new URL(client.url);
        if(url.origin!==self.location.origin||!isDisplayDocument(url))return;
        if(url.searchParams.get('aslima_integrated')===VERSION)return;
        url.searchParams.set('aslima_integrated',VERSION);
        client.navigate(url.href).catch(()=>{});
      }catch(_error){}
    });
  },5*60*1000);
})()));

function styleTag(attribute,value,text){
  return `<style ${attribute}="${value}">${text}</style>`;
}

async function integrateDisplay(response){
  if(!response||!response.ok)return response;
  const type=response.headers.get('content-type')||'';
  if(!type.includes('text/html'))return response;
  let html=await response.text();

  // Keep source-owned Focus styles after the legacy compatibility styles so
  // the optional layout cannot be narrowed by an older injected rule.
  const focusStyles=[];
  html=html.replace(/<style id=["']aslima-focus-layout(?:-conflict-guards|-exact)?["']>[\s\S]*?<\/style>\s*/ig,(style)=>{
    focusStyles.push(style);
    return '';
  });
  html=html.replace(/<link[^>]+href=["'][^"']*focus-fidelity-v987\.css["'][^>]*>\s*/ig,(link)=>{
    focusStyles.push(link);
    return '';
  });

  // Remove every prior injected variation before adding exactly one copy.
  html=html.replace(/<link[^>]+data-aslima-(?:heading-style|schedule-style|prayer-icons)=["'][^"']+["'][^>]*>\s*/ig,'');
  html=html.replace(/<style[^>]+data-aslima-(?:schedule-style|prayer-icons)=["'][^"']+["'][^>]*>[\s\S]*?<\/style>\s*/ig,'');
  html=html.replace(/<script[^>]+data-aslima-azaan-scheduler=["'][^"']+["'][^>]*><\/script>\s*/ig,'');

  // Disable only the legacy automatic polling call. Manual Test Azaan remains intact.
  html=html.replace(/setInterval\(\s*autoFireAzaan\s*,\s*30000\s*\);/g,'/* legacy automatic Azaan interval disabled by v9.1.54 */');

  const styles=[
    styleTag('data-aslima-schedule-style','v951',SCHEDULE_CSS_TEXT),
    styleTag('data-aslima-prayer-icons','v954',ICONS_CSS_TEXT)
  ].join('\n');
  const finalStyles=[styles,...focusStyles].join('\n');
  html=/<\/head>/i.test(html)?html.replace(/<\/head>/i,`${finalStyles}\n</head>`):`${finalStyles}\n${html}`;

  const runtimeMarker='<script data-aslima-integration="v961">document.documentElement.dataset.aslimaIntegration="v961";</script>';
  const scripts=runtimeMarker;
  html=/<\/body>/i.test(html)?html.replace(/<\/body>/i,`${scripts}\n</body>`):`${html}\n${scripts}`;

  const headers=new Headers(response.headers);
  headers.delete('content-length');
  headers.set('content-type','text/html; charset=utf-8');
  headers.set('x-aslima-integration','v961');
  return new Response(html,{status:response.status,statusText:response.statusText,headers});
}

async function networkFirst(request){
  try{
    const response=await fetch(request);
    if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(request,copy));}
    return response;
  }catch(_error){
    return caches.match(request,{ignoreSearch:true});
  }
}

self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin)return;
  const isAudio=/\/assets\/audio\/.*\.(mp3|ogg|wav)$/i.test(url.pathname);
  if(isAudio){
    event.respondWith(caches.match(event.request,{ignoreSearch:true}).then(hit=>hit||networkFirst(event.request)));
    return;
  }
  if(isDisplayDocument(url)){
    event.respondWith((async()=>{
      const response=await networkFirst(event.request);
      if(!response)throw new Error('Display document unavailable');
      return integrateDisplay(response);
    })());
    return;
  }
  event.respondWith(networkFirst(event.request));
});
