// Door app service worker (D26). Registered with scope /admin/checkin, so it
// controls only the door screen. It caches the app shell (hashed /_astro/
// assets, icons, the offline page) and never an API call or admin HTML:
// every scan goes to the server (no offline validation in v1).
const CACHE = "door-v1";
const OFFLINE = "/checkin-offline.html";
const PRECACHE = [OFFLINE, "/icons/checkin-192.png", "/icons/checkin-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k.startsWith("door-") && k !== CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  // Pages: always the network; the offline page only when it is down.
  if (req.mode === "navigate") {
    event.respondWith(fetch(req).catch(() => caches.match(OFFLINE)));
    return;
  }

  // Hashed build assets never change: cache first.
  if (url.pathname.startsWith("/_astro/")) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(req, copy));
            }
            return res;
          })
      )
    );
  }
});
