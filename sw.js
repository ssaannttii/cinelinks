/* CineLinks service worker — offline app shell.
 * Strategy:
 *   - /api/* : network only (never cached — daily challenge & scores must be fresh).
 *   - navigations: network-first, fall back to cached index.html when offline.
 *   - other same-origin GETs (logo, icons, daily-challenges.js, i18n.js): stale-while-revalidate.
 * Bump CACHE_VERSION to invalidate old caches on deploy.
 */
const CACHE_VERSION = 'cinelinks-v29';
const SHELL = [
  '/',
  '/index.html',
  '/daily-challenges.js',
  '/cineclue.html',
  '/cineframe.html',
  '/cinecast.html',
  '/cineplot.html',
  '/cineline.html',
  '/cinereel.html',
  '/cinegrid.html',
  '/cineclue-pool.js',
  '/cineline-pool.js',
  '/cineguess.js',
  '/stats.html',
  '/privacy.html',
  '/ads.js',
  '/support.js',
  '/howto.js',
  '/cookie.js',
  '/home-art.js',
  '/daily-gallery.js',
  '/auth.js',
  '/i18n.js',
  '/lib/credits.js',
  '/lib/daily.js',
  '/lib/difficulty.js',
  '/lib/merge-stats.js',
  '/lib/media.js',
  '/lib/timeline.js',
  '/lib/pool.js',
  '/logo.png',
  '/icon-192.png',
  '/icon-512.png',
  '/manifest.webmanifest'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) =>
      // Don't fail install if one optional asset 404s.
      Promise.allSettled(SHELL.map((url) => cache.add(url)))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // let TMDB images etc. go straight to network
  if (url.pathname.startsWith('/api/')) return;      // never cache API

  // Navigations: network-first with offline fallback to cached shell.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((c) => c.put('/index.html', copy));
          return res;
        })
        .catch(() => caches.match('/index.html').then((r) => r || caches.match('/')))
    );
    return;
  }

  // Static assets: stale-while-revalidate.
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE_VERSION).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
