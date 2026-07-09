ASLIMA FIREBASE REMOTE SETUP

FILES TO UPLOAD TO GITHUB
1. index.html
2. admin.html
3. script.js (included for parity, but index.html is standalone)
4. assets/aslima-premium-bg.png

TABLET / FULLY KIOSK
Use your normal GitHub Pages tablet URL:
https://YOUR-GITHUB-PAGES-URL/index.html

PHONE ADMIN PAGE
Open this on your phone:
https://YOUR-GITHUB-PAGES-URL/admin.html

Then use Share -> Add to Home Screen.
Default admin PIN: 7860

WHAT IT DOES
- Tablet listens to Firebase Realtime Database.
- Phone admin writes changes to Firebase.
- Tablet updates prayer times, Jumu'ah times, Azaan toggles, and volume live.
- Manual mode overrides VRIC times.
- VRIC mode returns tablet to normal live VRIC timing behavior.

FIREBASE DATABASE RULES FOR FIRST TEST
Use this while testing only:
{
  "rules": {
    "aslima": {
      ".read": true,
      ".write": true
    }
  }
}

IMPORTANT
This is good enough for first home testing, but it is not locked down. After you confirm it works, tighten security. The admin PIN is a UI lock, not real Firebase security.
