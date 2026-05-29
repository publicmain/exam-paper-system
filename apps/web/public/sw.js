// Minimal, deploy-safe service worker for the 早测查询 PWA.
//
// Strategy is chosen to make the app installable WITHOUT risking a
// stale-deploy trap:
//   - navigations (the SPA HTML shell) + /api/*  → network-first,
//     fall back to cache only when offline. A fresh deploy is always
//     picked up online.
//   - other same-origin GETs (Vite-hashed JS/CSS/icons — immutable
//     filenames) → cache-first for instant repeat loads.
//
// Bump CACHE on any change to this file so old caches are evicted.
const CACHE = 'zaoce-pwa-v2';

self.addEventListener('install', (event) => {
  // Activate this SW immediately instead of waiting for old tabs to close.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  const isNavigation = req.mode === 'navigate';
  const isApi = url.pathname.startsWith('/api/');

  // API is NEVER cached and NEVER served from cache — it's time-sensitive
  // (attendance windows). Force cache:'no-store' so the SW's own fetch
  // can't return an HTTP-cached response (r15-followup-31: a 410
  // session_not_active cached before the window opened was replayed).
  if (isApi) {
    event.respondWith(fetch(req, { cache: 'no-store' }));
    return;
  }

  // Network-first for the app shell so deploys are never stale.
  if (isNavigation) {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req);
          if (fresh && fresh.ok) {
            const cache = await caches.open(CACHE);
            cache.put(req, fresh.clone());
          }
          return fresh;
        } catch (e) {
          const cached = await caches.match(req);
          if (cached) return cached;
          // For navigations offline, fall back to the cached shell root.
          if (isNavigation) {
            const shell = await caches.match('/my-history') || await caches.match('/');
            if (shell) return shell;
          }
          throw e;
        }
      })(),
    );
    return;
  }

  // Cache-first for immutable hashed static assets.
  if (sameOrigin) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(req);
        if (cached) return cached;
        const fresh = await fetch(req);
        if (fresh && fresh.ok) {
          const cache = await caches.open(CACHE);
          cache.put(req, fresh.clone());
        }
        return fresh;
      })(),
    );
  }
});
