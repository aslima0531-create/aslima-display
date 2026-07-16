ASLIMA v9.1.28 compact prayer warning banners

Upload every file and folder in this package, including sw.js and assets/audio/.
After deployment, clear the tablet browser cache once and open index.html?v=9128.
Open admin.html?v=9128 on the phone.

This build preserves the v9.1.23 golden-image functionality and fixes Android/WebView calendar formatting that could display a Gregorian month name such as January on the Hijri date line. The app now reads numeric Islamic calendar fields, maps them to verified Islamic month names, validates the Hijri year/day/month, and uses an offline civil-Hijri fallback when the browser calendar implementation is unreliable.

This build adds exact per-recording Azaan phrase cue sheets for all five bundled recordings. The Arabic and English phrase display now follows the audio element's real playback time instead of equal-duration estimates.


V9.1.28 adds compact, non-blocking Hanafi prayer-restriction guidance:
- Amber conditional guidance from Fajr until sunrise and from Asr until the final sunset window.
- Red prohibition windows at sunrise, immediately before Dhuhr (zawal), and immediately before Maghrib.
- The banner remains compact, touch-through, and automatically hides behind the live Azaan and timing-source overlays.
- Obligatory Fajr and Asr exceptions are stated directly so the warning never tells someone to miss a required prayer.
