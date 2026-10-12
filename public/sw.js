const PREFIX = 'river:' + self.registration.scope + ':';
const CACHE = PREFIX + '7233f3c1ef07';
const ASSETS = ["./app.js","./fonts/dm-sans.ttf","./history.js","./icon-192.png","./icon-512.png","./icon-maskable.png","./icon.svg","./index.html","./manifest.webmanifest","./rules.json","./spots.json","./style.css","./theme.js"];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith(PREFIX) && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || !url.href.startsWith(self.registration.scope)) return;
  event.respondWith(caches.open(CACHE).then(async cache => {
    const key = event.request.mode === 'navigate' ? new URL('./index.html', self.registration.scope).href : event.request;
    const cached = await cache.match(key);
    return cached || fetch(event.request);
  }));
});
