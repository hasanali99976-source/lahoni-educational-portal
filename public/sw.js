const CACHE_NAME = "ostadh-lahooni-v4";
const APP_SHELL = [
  "/",
  "/student",
  "/teacher",
  "/manifest.webmanifest",
  "/icon.svg",
  "/portal-cover.webp",
  "/icons/ostadh-lahooni-192.jpg",
];

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

  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match(request).then(hit => hit || caches.match("/"))));
    return;
  }

  if (["style", "script", "font", "image", "manifest"].includes(request.destination)) {
    event.respondWith(
      fetch(request).then(response => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
        return response;
      }).catch(() => caches.match(request))
    );
  }
});
