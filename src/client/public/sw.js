// QueueDrop Service Worker
// Handles: Push notifications, offline caching, background sync

const CACHE_NAME = "queuedrop-v1";
const STATIC_ASSETS = ["/", "/favicon.svg", "/manifest.json"];

// Install: Cache static assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }),
  );
  self.skipWaiting();
});

// Activate: Clean old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(cacheNames.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name)));
    }),
  );
  self.clients.claim();
});

// Fetch: Network-first with cache fallback for navigation
self.addEventListener("fetch", (event) => {
  // Skip non-GET requests and API calls
  if (event.request.method !== "GET") return;
  if (event.request.url.includes("/api/")) return;
  if (event.request.url.includes("/hubs/")) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache successful responses
        if (response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // Fallback to cache
        return caches.match(event.request).then((cached) => {
          return cached || caches.match("/");
        });
      }),
  );
});

// Push notification handling
self.addEventListener("push", (event) => {
  const data = event.data?.json() ?? {};
  const title = data.title || "QueueDrop";
  const options = {
    body: data.body || "It's your turn!",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    vibrate: [200, 100, 200, 100, 200],
    tag: "queue-notification",
    renotify: true,
    requireInteraction: true,
    actions: [
      { action: "open", title: "Open App" },
      { action: "dismiss", title: "Dismiss" },
    ],
    data: {
      url: data.url || self.location.origin,
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Notification click handling
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  if (event.action === "dismiss") return;

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // Focus existing window
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          return client.focus();
        }
      }
      // Open new window
      if (clients.openWindow) {
        return clients.openWindow(event.notification.data?.url || "/");
      }
    }),
  );
});
