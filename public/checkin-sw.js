// Door app service worker (D26). Registered with scope /admin/checkin, so it
// controls only the door screen. It caches the app shell (hashed /_astro/
// assets, icons, the offline page) and never an API call or admin HTML:
// every scan goes to the server (no offline validation in v1).
const CACHE = "door-v1";
const OFFLINE = "/checkin-offline.html";
const PRECACHE = [OFFLINE, "/icons/checkin-192.png", "/icons/checkin-512.png"];

// Stored as a fresh 200 response: if the host redirected (e.g. .html to a
// clean URL), a "redirected" response cannot answer a navigation.
async function precache() {
  const cache = await caches.open(CACHE);
  for (const url of PRECACHE) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`precache ${url}: ${res.status}`);
    const body = await res.blob();
    await cache.put(url, new Response(body, { status: 200, headers: res.headers }));
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(precache());
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
