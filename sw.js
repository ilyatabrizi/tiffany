/* Offline shell.

   Precache is the app itself — markup, styles, modules, fonts, brand marks.
   Photographs and the campaign clip are cached as they are first seen, so a
   second visit on a bad connection opens instantly without paying 1.4MB of
   video up front. */
const V = 'tiffany-v1';
const SHELL = [
  './', 'index.html', 'css/app.css', 'manifest.webmanifest',
  'js/app.js', 'js/colour.js', 'js/config.js', 'js/data.js', 'js/hero.js',
  'js/icons.js', 'js/install.js', 'js/looks.js', 'js/router.js', 'js/store.js',
  'js/ui.js', 'js/util.js',
  'js/views/home.js', 'js/views/shop.js', 'js/views/collection.js',
  'js/views/product.js', 'js/views/bag.js', 'js/views/orders.js',
  'js/views/saved.js', 'js/views/profile.js',
  'assets/fonts/cormorant.woff2', 'assets/fonts/inter.woff2',
  'assets/brand/wordmark-white-1200.png',
  'assets/icons/icon-192.png', 'assets/icons/icon-512.png',
  'assets/icons/favicon-32.png',
  'media/hero-poster.webp',
];

self.addEventListener('install', (e) => {
  if (['localhost', '127.0.0.1'].includes(self.location.hostname)) {
    self.skipWaiting();
    return;
  }
  e.waitUntil(caches.open(V)
    .then((c) => Promise.allSettled(SHELL.map((u) => c.add(u))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== V).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

/* Local preview: never serve from cache, or every edit needs a version bump. */
const DEV = ['localhost', '127.0.0.1'].includes(self.location.hostname);

self.addEventListener('fetch', (e) => {
  if (DEV) return;
  const { request } = e;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== location.origin) return;

  /* Video needs Range support; let the network own it. */
  if (request.destination === 'video' || request.headers.has('range')) return;

  if (request.mode === 'navigate') {
    e.respondWith(fetch(request).catch(() => caches.match('index.html')));
    return;
  }

  e.respondWith(caches.match(request).then((hit) => hit || fetch(request).then((res) => {
    if (res.ok && res.type === 'basic') {
      const copy = res.clone();
      caches.open(V).then((c) => c.put(request, copy));
    }
    return res;
  }).catch(() => Response.error())));
});
