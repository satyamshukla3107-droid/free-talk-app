const CACHE_NAME = 'freetalk-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/room.html',
  '/css/style.css',
  '/js/index.js',
  '/js/room.js',
  '/manifest.json'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  // Pass through socket.io and dynamic room paths to network
  if (e.request.url.includes('/socket.io/') || e.request.url.includes('/room/')) {
    return;
  }
  e.respondWith(
    caches.match(e.request).then((res) => res || fetch(e.request))
  );
});
