// ─── ZOCK Cafe Service Worker — Web Push Handler ─────────────────────────────

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

// ─── Push event — show notification ──────────────────────────────────────────
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: '🛎️ New Order!', body: event.data?.text() || '' };
  }

  const title   = data.title || '🛎️ ZOCK Cafe';
  const options = {
    body:    data.body  || 'New order received.',
    icon:    '/favicon.svg',
    badge:   '/favicon.svg',
    tag:     `order-${data.orderId || Date.now()}`,   // replace old notification of same order
    renotify: true,
    vibrate: [200, 100, 200],
    data:    { url: data.url || '/admin/orders' },
    actions: [
      { action: 'view', title: '👁️ View Orders' },
      { action: 'dismiss', title: 'Dismiss' },
    ],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// ─── Notification click — open admin orders page ──────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  const targetUrl = event.notification.data?.url || '/admin/orders';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // If admin tab already open — focus it and navigate
      for (const client of clients) {
        if (client.url.includes('/admin') && 'focus' in client) {
          client.focus();
          client.navigate(targetUrl);
          return;
        }
      }
      // Otherwise open new tab
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    }),
  );
});
