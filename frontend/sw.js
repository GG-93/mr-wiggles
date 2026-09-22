'use strict';

const CACHE_NAME = 'mr-wiggles-mobile-v1';
const OFFLINE_URL = '/offline.html';
const APP_SHELL = [
  '/mobile.html',
  '/offline.html',
  '/manifest.json',
  '/css/style.css',
  '/css/mobile.css',
  '/js/wsClient.js',
  '/js/renderer.js',
  '/js/app.js',
  '/js/mobile-app.js',
  '/icons/icon-192.svg',
  '/icons/icon-512.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const cloned = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, cloned));
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        if (event.request.mode === 'navigate') {
          return caches.match(OFFLINE_URL);
        }
        throw new Error('Network unavailable and no cache hit');
      })
  );
});
