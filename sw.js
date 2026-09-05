// Service Worker for 100% offline usage
// Cache version identifier
const CACHE_NAME = "pulser-cache-v11";

const ASSETS_TO_CACHE = [
  "./",
  "./index.html",
  "./manifest.json",
  "./css/style.css",
  "./js/voice-data.js",
  "./js/audio-engine.js",
  "./js/auto-bpm.js",
  "./js/metronome.js",
  "./js/setlist.js",
  "./js/tuner.js",
  "./js/gadgets.js",
  "./js/app.js",
  "./icons/icon.svg"
];

// Install event: Pre-cache static assets
self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      console.log("[SW] Pre-caching offline assets");
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

// Activate event: Clean up previous caches
self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (cacheNames) {
      return Promise.all(
        cacheNames.map(function (name) {
          if (name !== CACHE_NAME) {
            console.log("[SW] Removing outdated cache:", name);
            return caches.delete(name);
          }
        })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

// Fetch event: Cache first, fallback to network
self.addEventListener("fetch", function (event) {
  // Only handle GET requests
  if (event.request.method !== "GET") {
    return;
  }

  event.respondWith(
    caches.match(event.request).then(function (cachedResponse) {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then(function (networkResponse) {
        // Cache valid responses
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== "basic") {
          return networkResponse;
        }
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then(function (cache) {
          cache.put(event.request, responseToCache);
        });
        return networkResponse;
      }).catch(function () {
        // Offline fallback if not in cache
        return caches.match("./index.html");
      });
    })
  );
});
