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
// v3: evict caches poisoned by the pre-fix nginx serving .mjs as
// application/octet-stream (pdf.js worker) — cache-first kept replaying
// the bad MIME even after the server was fixed.
// v5 (2026-10-08): the cache is strictly best-effort. A Chrome profile whose
// CacheStorage was broken ("Unexpected internal error" on caches.open) got
// ERR_FAILED on EVERY page: the shell fetch succeeded, then `await
// caches.open()` threw inside the try, the catch's caches.match threw too,
// and respondWith rejected. Now a cache failure can never fail a request.
const CACHE = 'zaoce-pwa-v5';

/** Best-effort cache write — swallows every CacheStorage error. */
async function cachePut(req, res) {
  try {
    const cache = await caches.open(CACHE);
    await cache.put(req, res);
  } catch (_) {
    // broken / full storage: just don't cache
  }
}

/** Best-effort cache read — a broken CacheStorage reads as a miss. */
async function cacheMatch(req) {
  try {
    return await caches.match(req);
  } catch (_) {
    return undefined;
  }
}

self.addEventListener('install', (event) => {
  // Activate this SW immediately instead of waiting for old tabs to close.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const keys = await caches.keys();
        await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      } catch (_) {
        // broken storage: nothing to evict, still take control below
      }
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
        let fresh;
        try {
          fresh = await fetch(req);
        } catch (e) {
          const cached = await cacheMatch(req);
          if (cached) return cached;
          // For navigations offline, fall back to the cached shell root.
          const shell = await cacheMatch('/my-lesson') || await cacheMatch('/my-history') || await cacheMatch('/');
          if (shell) return shell;
          throw e;
        }
        // Not awaited, and never throws: caching must not delay or fail the page.
        if (fresh && fresh.ok) cachePut(req, fresh.clone());
        return fresh;
      })(),
    );
    return;
  }

  // Cache-first for immutable hashed static assets.
  if (sameOrigin) {
    event.respondWith(
      (async () => {
        const cached = await cacheMatch(req);
        if (cached) return cached;
        const fresh = await fetch(req);
        if (fresh && fresh.ok) cachePut(req, fresh.clone());
        return fresh;
      })(),
    );
  }
});
