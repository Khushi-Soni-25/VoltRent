/* ═══════════════════════════════════════════════════════
   VoltRide Service Worker
   Handles: caching, offline support, background sync
═══════════════════════════════════════════════════════ */

const CACHE_NAME      = 'voltride-v1';
const API_CACHE_NAME  = 'voltride-api-v1';
const OFFLINE_URL     = 'offline.html';

/* Files to cache immediately on install */
const PRECACHE_URLS = [
  'index.html',
  'login.html',
  'register.html',
  'dashboard-user.html',
  'dashboard-admin.html',
  'dashboard-dealer.html',
  'dashboard-delivery.html',
  'offline.html',
  'css/style.css',
  'js/state.js',
  'js/utils.js',
  'js/maps.js',
  'js/auth.js',
  'js/dealer.js',
  'js/admin.js',
  'js/delivery.js',
  'js/request.js',
  'js/payment.js',
  'manifest.json',
  'icons/icon-192.png',
  'icons/icon-512.png'
];

/* ── INSTALL: pre-cache all static assets ── */
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) {
        return cache.addAll(PRECACHE_URLS.map(function(url) {
          return new Request(url, { cache: 'reload' });
        })).catch(function(err) {
          console.warn('[SW] Pre-cache partial failure (ok):', err);
        });
      })
      .then(function() { return self.skipWaiting(); })
  );
});

/* ── ACTIVATE: clean old caches ── */
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(key) {
          return key !== CACHE_NAME && key !== API_CACHE_NAME;
        }).map(function(key) { return caches.delete(key); })
      );
    }).then(function() { return self.clients.claim(); })
  );
});

/* ── FETCH: network-first for API, cache-first for assets ── */
self.addEventListener('fetch', function(event) {
  var url = new URL(event.request.url);

  /* Skip non-GET and cross-origin */
  if (event.request.method !== 'GET') {
    /* For POST (API calls) — try network, queue if offline */
    if (event.request.method === 'POST' && url.pathname.includes('/api/')) {
      event.respondWith(
        fetch(event.request.clone()).catch(function() {
          return new Response(JSON.stringify({
            status: 'queued',
            message: 'Offline — request will sync when connection returns'
          }), { headers: { 'Content-Type': 'application/json' } });
        })
      );
    }
    return;
  }

  /* API calls — network first, cache fallback */
  if (url.pathname.includes('/api/')) {
    event.respondWith(
      fetch(event.request)
        .then(function(response) {
          var clone = response.clone();
          caches.open(API_CACHE_NAME).then(function(cache) {
            cache.put(event.request, clone);
          });
          return response;
        })
        .catch(function() {
          return caches.match(event.request).then(function(cached) {
            if (cached) return cached;
            return new Response(JSON.stringify({
              status: 'error',
              message: 'Offline — no cached data available'
            }), { headers: { 'Content-Type': 'application/json' } });
          });
        })
    );
    return;
  }

  /* Static assets — cache first, network fallback */
  event.respondWith(
    caches.match(event.request).then(function(cached) {
      if (cached) return cached;
      return fetch(event.request)
        .then(function(response) {
          if (!response || response.status !== 200 || response.type === 'opaque') {
            return response;
          }
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(event.request, clone);
          });
          return response;
        })
        .catch(function() {
          /* Return offline page for navigation requests */
          if (event.request.mode === 'navigate') {
            return caches.match(OFFLINE_URL);
          }
        });
    })
  );
});

/* ── BACKGROUND SYNC: retry queued requests ── */
self.addEventListener('sync', function(event) {
  if (event.tag === 'sync-requests') {
    event.waitUntil(syncPendingRequests());
  }
});

function syncPendingRequests() {
  /* Notify all open clients that sync happened */
  return self.clients.matchAll().then(function(clients) {
    clients.forEach(function(client) {
      client.postMessage({ type: 'SYNC_COMPLETE' });
    });
  });
}

/* ── PUSH NOTIFICATIONS ── */
self.addEventListener('push', function(event) {
  var data = {};
  try { data = event.data.json(); } catch(e) {}
  var options = {
    body:    data.body    || 'Your battery delivery status has been updated',
    icon:    'icons/icon-192.png',
    badge:   'icons/icon-72.png',
    vibrate: [200, 100, 200],
    data:    { url: data.url || '/voltride/dashboard-user.html' },
    actions: [
      { action: 'track', title: '📍 Track Now' },
      { action: 'dismiss', title: 'Dismiss' }
    ]
  };
  event.waitUntil(
    self.registration.showNotification(data.title || '⚡ VoltRide Update', options)
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  if (event.action === 'dismiss') return;
  var url = (event.notification.data && event.notification.data.url) || '/voltride/dashboard-user.html';
  event.waitUntil(
    clients.openWindow(url)
  );
});
