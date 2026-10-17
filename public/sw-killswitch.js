self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(Promise.all([
    self.registration.unregister(),
    self.clients.claim(),
  ]));
});

self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});
