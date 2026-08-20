const CACHE_NAME = "ostadh-lahooni-v7";
const APP_SHELL = [
  "/",
  "/student",
  "/teacher",
  "/manifest.webmanifest",
  "/icon.svg",
  "/portal-cover.webp",
  "/icons/ostadh-lahooni-192.jpg",
];

self.addEventListener("message", event => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)).catch(() => undefined));
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request, { cache: "no-store" })
        .then(response => {
          if (response.ok) caches.open(CACHE_NAME).then(cache => cache.put(request, response.clone()));
          return response;
        })
        .catch(async () => (await caches.match(request)) || (await caches.match("/")))
    );
    return;
  }

  if (["style", "script", "font", "image", "manifest"].includes(request.destination)) {
    event.respondWith(
      caches.match(request).then(cached => {
        const fresh = fetch(request).then(response => {
          if (response.ok) caches.open(CACHE_NAME).then(cache => cache.put(request, response.clone()));
          return response;
        }).catch(() => cached);
        return cached || fresh;
      })
    );
  }
});
