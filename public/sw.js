// Parade Push Notification Service Worker

self.addEventListener('push', (event) => {
  if (!event.data) return;

  try {
    const data = event.data.json();
    const options = {
      body: data.body || '',
      icon: data.image || data.icon || '/icon-192.png',
      badge: data.badge || '/favicon.png',
      image: data.image || undefined,
      data: { url: data.url || '/' },
      vibrate: [200, 100, 200],
      tag: data.tag || 'parade-notification',
      renotify: true,
      actions: [],
    };

    event.waitUntil(
      self.registration.showNotification(data.title || 'Parade', options)
    );
  } catch (err) {
    console.error('Push event error:', err);
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // Focus existing window if available
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      // Open new window
      return self.clients.openWindow(url);
    })
  );
});

// Keep service worker alive
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});
