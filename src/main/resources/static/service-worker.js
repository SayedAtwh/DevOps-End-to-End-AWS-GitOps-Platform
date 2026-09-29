const SHELL_CACHE = 'alhuda-shell-v1';
const DATA_CACHE = 'alhuda-data-v1';
const SHELL_ASSETS = [
  '/',
  '/index.html',
  '/app.js',
  '/product.js',
  '/product.css',
  '/manifest.webmanifest',
  '/icon.svg'
];
const DATA_HOSTS = new Set([
  'api.alquran.cloud',
  'api.aladhan.com',
  'hadeethenc.com',
  'www.hisnmuslim.com'
]);

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(
    keys.filter((key) => key.startsWith('alhuda-') && ![SHELL_CACHE, DATA_CACHE].includes(key)).map((key) => caches.delete(key))
  )));
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then((response) => {
      const copy = response.clone();
      caches.open(SHELL_CACHE).then((cache) => cache.put('/index.html', copy));
      return response;
    }).catch(async () => (await caches.match('/index.html')) || caches.match('/')));
    return;
  }

  if (url.origin === self.location.origin) {
    event.respondWith(caches.match(request).then((cached) => cached || fetch(request).then((response) => {
      if (response.ok) {
        const copy = response.clone();
        caches.open(SHELL_CACHE).then((cache) => cache.put(request, copy));
      }
      return response;
    })));
    return;
  }

  if (DATA_HOSTS.has(url.hostname)) {
    event.respondWith(fetch(request).then((response) => {
      if (response.ok && response.type !== 'opaque') {
        const copy = response.clone();
        caches.open(DATA_CACHE).then((cache) => cache.put(request, copy));
      }
      return response;
    }).catch(async () => (await caches.match(request)) || Response.error()));
  }
});
