ASLIMA v9.1.24 Hijri calendar month fix

Upload every file and folder in this package, including sw.js and assets/audio/.
After deployment, clear the tablet browser cache once and open index.html?v=9124.
Open admin.html?v=9124 on the phone.

This build preserves the v9.1.23 golden-image functionality and fixes Android/WebView calendar formatting that could display a Gregorian month name such as January on the Hijri date line. The app now reads numeric Islamic calendar fields, maps them to verified Islamic month names, validates the Hijri year/day/month, and uses an offline civil-Hijri fallback when the browser calendar implementation is unreliable.
