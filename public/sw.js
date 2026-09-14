// VKU Field Survey Service Worker - 100% Offline-First (Cache-First Strategy)
const CACHE_NAME = 'vku-field-survey-v1.0.0';

const PRECACHE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './favicon.svg',
  './icons/icon-192.svg',
  './icons/icon-512.svg',
];

// Install Event: Precache App Shell with resilience
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then(async (cache) => {
        console.log('[SW] Precaching App Shell for VKU Survey');
        await Promise.allSettled(
          PRECACHE_ASSETS.map((asset) =>
            cache.add(asset).catch((err) => console.warn('[SW] Precache skipped:', asset, err))
          )
        );
      })
      .then(() => self.skipWaiting())
      .catch((err) => console.error('[SW] Precache error:', err))
  );
});

// Activate Event: Clear outdated caches and claim clients immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => self.clients.claim())
  );
});

// Fetch Event: Cache-First Strategy with Network Fallback & Runtime Caching
self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Only handle GET requests
  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);

  // Bypass Vite development client / HMR requests
  if (url.pathname.startsWith('/@') || url.pathname.includes('?import')) {
    return;
  }

  const isSameOrigin = url.origin === self.location.origin;

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      // 1. If found in cache, return immediately (Cache-First)
      if (cachedResponse) {
        // Fetch in background to update cache for next time (Stale-While-Revalidate for local assets)
        if (isSameOrigin) {
          fetch(request)
            .then((networkResponse) => {
              if (networkResponse && networkResponse.status === 200) {
                caches.open(CACHE_NAME).then((cache) => {
                  cache.put(request, networkResponse);
                });
              }
            })
            .catch(() => {
              // Expected when offline
            });
        }
        return cachedResponse;
      }

      // 2. Not in cache: fetch from network and save to runtime cache
      return fetch(request)
        .then((networkResponse) => {
          if (!networkResponse || networkResponse.status !== 200 || networkResponse.type === 'opaque') {
            return networkResponse;
          }

          // Cache clones of JS, CSS, HTML, SVG, Web Fonts
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });

          return networkResponse;
        })
        .catch(() => {
          // 3. Network failed: If navigation request, fallback to cached index.html
          if (request.mode === 'navigate') {
            return caches.match('./index.html').then((fallback) => {
              return fallback || new Response('Offline - VKU Field Survey', {
                status: 200,
                headers: { 'Content-Type': 'text/html; charset=utf-8' },
              });
            });
          }

          return new Response('Offline resource not available', {
            status: 503,
            statusText: 'Service Unavailable',
          });
        });
    })
  );
});

// Background Sync API Event (when network connection is restored)
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync event triggered:', event.tag);
  if (event.tag === 'vku-sync-queue') {
    event.waitUntil(
      self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
          client.postMessage({
            type: 'BACKGROUND_SYNC_TRIGGER',
            timestamp: Date.now(),
          });
        });
      })
    );
  }
});
