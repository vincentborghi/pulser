// Service Worker for 100% offline usage
// Cache version identifier
const CACHE_NAME = "pulser-cache-v16";

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
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      console.log("[SW] Pre-caching offline assets");
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

// Activate event: Clean up previous caches and claim clients immediately
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

// Fetch event: Network-first strategy for app assets
// Always fetches freshest code when online, and caches it.
// If network is unreachable (offline mode), falls back to cache instantly.
self.addEventListener("fetch", function (event) {
  if (event.request.method !== "GET") {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then(function (networkResponse) {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === "basic") {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then(function (cache) {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(function () {
        // Offline fallback: check cache ignoring search/version query params
        return caches.match(event.request, { ignoreSearch: true }).then(function (cachedResponse) {
          if (cachedResponse) {
            return cachedResponse;
          }
          if (event.request.mode === "navigate") {
            return caches.match("./index.html");
          }
        });
      })
  );
});
