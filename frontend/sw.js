/**
 * sw.js – Service Worker for Mr. Wiggles PWA.
 *
 * Strategy: cache-first for static assets, network-only for API and WebSocket.
 * This makes the app shell load instantly and enables "Add to Home Screen" on
 * both iOS (Safari share menu) and Android (Chrome install prompt).
 */
'use strict';

const CACHE_NAME = 'mr-wiggles-v1';

const STATIC_ASSETS = [
  '/',
  '/css/style.css',
  '/js/wsClient.js',
  '/js/renderer.js',
  '/js/app.js',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon.svg',
];

// ── Install: pre-cache static assets ─────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// ── Activate: remove old caches ───────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// ── Fetch: network-first for API; cache-first for static assets ───────────
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET requests and cross-origin requests
  if (event.request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;

  // Never intercept API calls – always go to network
  if (url.pathname.startsWith('/api/')) return;

  // Cache-first: try cache, fall back to network then update cache
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const networkFetch = fetch(event.request).then((response) => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      });
      return cached || networkFetch;
    })
  );
});
