# Mobile Guide (iOS + Android)

## URL
- Mobile app: `http://<server>:3000/mobile`
- Desktop app: `http://<server>:3000/`

## Features
- Mobile-first responsive layout (portrait + landscape)
- Safe-area support for iPhone notch/dynamic-island
- Touch interactions:
  - Tap signal list entry to select
  - Swipe canvas left/right to cycle target
- PWA install via `manifest.json`
- Offline fallback via service worker (`offline.html`)
- WebSocket auto-reconnect and status indicator

## iOS 14+
1. Open `/mobile` in Safari.
2. Tap **Share → Add to Home Screen**.
3. Launch from home screen for standalone mode.

## Android 8+
1. Open `/mobile` in Chrome.
2. Tap **Install app** prompt or browser menu install action.
3. Launch from launcher.

## Mobile performance notes
- Renderer pauses automatically while app tab is hidden.
- UI keeps list updates incremental to avoid unnecessary reflow.
- Service worker caches shell assets for slow/intermittent networks.
