const CACHE_NAME = "habitflow-v4-offline";
const ASSETS_TO_CACHE = [
  "./",
  "./index.html",
  "./dashboard.html",
  "./stats.html",
  "./settings.html",
  "./manifest.webmanifest",
  "./css/style.css",
  "./js/storage.js",
  "./js/ui.js",
  "./js/auth.js",
  "./js/habit.js",
  "./js/stats.js",
  "./js/settings.js",
  "./assets/images/icon.png",
  "./assets/pwa/icon-192.png",
  "./assets/pwa/icon-512.png"
];

// 1) Install service worker + cache asset inti
self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE))
  );
});

// 2) Activate + bersihkan cache lama
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keyList) =>
        Promise.all(
          keyList.map((key) => {
            if (key !== CACHE_NAME) {
              return caches.delete(key);
            }
            return Promise.resolve();
          })
        )
      )
      .then(() => self.clients.claim())
  );
});

// 3) Fetch strategy: Cache First, Network Fallback
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") {
    return;
  }

  // Hindari gangguan streaming/range media
  const isMedia = req.destination === "audio" || req.destination === "video";
  const isRange = req.headers.has("range");
  if (isMedia || isRange) {
    event.respondWith(fetch(req));
    return;
  }

  event.respondWith(
    caches.match(req).then((cachedRes) => {
      if (cachedRes) {
        return cachedRes;
      }

      return fetch(req)
        .then((networkRes) => {
          if (!networkRes || networkRes.status !== 200 || networkRes.type === "error") {
            return networkRes;
          }

          // Simpan request same-origin agar makin cepat saat akses ulang
          const reqUrl = new URL(req.url);
          if (reqUrl.origin === self.location.origin) {
            const copy = networkRes.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          }

          return networkRes;
        })
        .catch(() => {
          if (req.mode === "navigate") {
            return caches.match("./index.html");
          }
          return new Response("Offline", {
            status: 503,
            statusText: "Service Unavailable"
          });
        });
    })
  );
});
