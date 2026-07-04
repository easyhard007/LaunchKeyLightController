const CACHE_NAME = 'launchkey-station-v0.3.7';
const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  './icon.png',
  './chord_detection.js',
  './light_control.js', // 新增这一行！！！
  'https://cdn.jsdelivr.net/npm/tonal/browser/tonal.min.js',
  'https://cdn.jsdelivr.net/npm/@jaames/iro@5'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        return response || fetch(event.request);
      })
  );
});