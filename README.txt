ASLIMA V8.8 Animated Mosque Background Clean Build

Files:
- index.html: app shell and styles
- script.js: production prayer timing, VRIC/Jina fallback, azaan controls, drawer logic
- background.js: animated mosque background engine
- assets/mosque-background.jpeg: animated background source image

Validated integration:
- index.html loads script.js and background.js
- background.js targets the #aslimaAnimatedBg canvas layer
- script.js applies body[data-theme] based on prayer timing
- CSS maps prayer themes to animated background tint/filter variables
