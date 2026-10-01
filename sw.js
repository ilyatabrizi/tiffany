/* Offline shell.

   Strategy is split by what the thing IS, because a shop on its own domain
   gets edited and a stale price is worse than a slow one:

     markup, styles, modules, manifest -> network first, cache as fallback
     images, fonts                     -> cache first, refreshed in background
     the campaign clip                 -> straight to the network (Range)

   Network-first is a lie without cache:'reload'. A plain fetch() inside a
   worker still reads the browser's HTTP cache, and the host sends its own
   max-age, so the "network" copy can be the stale one. Every revalidation
   below bypasses it explicitly. */
const V = 'tiffany-fa-v1';

const SHELL = [
  './', 'index.html', 'css/app.css', 'manifest.webmanifest',
  'js/app.js', 'js/colour.js', 'js/config.js', 'js/data.js', 'js/hero.js',
  'js/icons.js', 'js/install.js', 'js/looks.js', 'js/router.js', 'js/store.js',
  'js/ui.js', 'js/util.js',
  'js/views/home.js', 'js/views/shop.js', 'js/views/collection.js',
  'js/views/product.js', 'js/views/bag.js', 'js/views/orders.js',
  'js/views/saved.js', 'js/views/profile.js',
  'assets/fonts/iranyekanx-fanum.woff2', 'assets/fonts/cormorant.woff2',
  'assets/brand/wordmark-white-1200.png',
  'assets/brand/alpha-letters.png', 'assets/brand/alpha-bars.png',
  'assets/icons/icon-192.png', 'assets/icons/icon-512.png',
  'assets/icons/favicon-32.png',
  'media/hero-poster.webp',
];

/* A local preview must never be served from cache, or every edit needs a
   version bump before it shows up. */
const DEV = ['localhost', '127.0.0.1', '[::1]'].includes(self.location.hostname);

self.addEventListener('install', (e) => {
  if (DEV) { self.skipWaiting(); return; }
  e.waitUntil(caches.open(V)
    .then((c) => Promise.allSettled(
      SHELL.map((u) => c.add(new Request(u, { cache: 'reload' })))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    const upgrade = keys.some((k) => k.startsWith('tiffany-') && k !== V);
    await Promise.all(keys.filter((k) => k !== V).map((k) => caches.delete(k)));
    /* Claiming on a COLD install hands pages that already loaded without a
       worker to a cache that has only just started filling. Take over an
       upgrade; leave a first visit alone and pick it up on the next load. */
    if (upgrade) await self.clients.claim();
  })());
});

/* ------------------------------------------------------------ strategies */
async function fresh(request) {
  const cache = await caches.open(V);
  try {
    const res = await fetch(request.url, {
      cache: 'reload', credentials: 'same-origin',
    });
    if (res && res.ok && res.type === 'basic') cache.put(request, res.clone());
    return res;
  } catch {
    const hit = await cache.match(request)
      || (request.mode === 'navigate' ? await cache.match('index.html') : null);
    if (hit) return hit;
    return Response.error();
  }
}

async function fast(request) {
  const cache = await caches.open(V);
  const hit = await cache.match(request);
  const net = fetch(request).then((res) => {
    if (res && res.ok && res.type === 'basic') cache.put(request, res.clone());
    return res;
  }).catch(() => null);
  return hit || (await net) || Response.error();
}

self.addEventListener('fetch', (e) => {
  if (DEV) return;
  const { request } = e;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== location.origin) return;

  /* Video needs Range support; the network owns it entirely. */
  if (request.destination === 'video' || request.headers.has('range')) return;

  const d = request.destination;
  if (request.mode === 'navigate' || d === 'document' || d === 'script'
      || d === 'style' || d === 'manifest' || url.pathname.endsWith('.webmanifest')) {
    e.respondWith(fresh(request));
    return;
  }
  e.respondWith(fast(request));
});
