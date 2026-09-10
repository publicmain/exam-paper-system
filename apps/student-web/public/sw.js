/*
 * Service Worker —— **只管推送，不管缓存**（2026-09-10）。
 *
 * 4A 阶段明确不做 PWA 缓存：旧端那套 cache-first + 离线兜底指向旧路由，
 * 是整个重建里最大的单点风险。这个 worker 保留那条决定 ——
 *
 *   · 不监听网络请求：任何请求都不经它的手，index.html 照旧 no-store，
 *     新版本一发布刷新就是新的，不存在「被 SW 缓存住的旧壳」
 *   · 不开 Cache Storage
 *   · 只做两件事：收到推送弹通知；点通知打开 /today
 *
 * 契约测试守着这一点（contract.test.ts「sw.js 只管推送」那条）。
 */

self.addEventListener('install', function () {
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', function (event) {
  var data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { body: event.data ? event.data.text() : '' };
  }
  var title = data.title || '每日英语';
  var options = {
    body: data.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: data.tag || 'daily-english',
    renotify: false,
    data: { url: data.url || '/today' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  var url = (event.notification.data && event.notification.data.url) || '/today';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (all) {
      for (var i = 0; i < all.length; i += 1) {
        var client = all[i];
        if ('focus' in client) {
          return client.focus().then(function (focused) {
            if (focused && 'navigate' in focused) {
              return focused.navigate(url).catch(function () {
                return focused;
              });
            }
            return focused;
          });
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
