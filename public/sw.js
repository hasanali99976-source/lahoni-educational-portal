const CACHE_NAME = "ostadh-lahooni-v126-mobile";
const STATIC_FILES = [
  "/manifest.webmanifest?v=126-mobile",
  "/icon.svg?v=126-mobile",
  "/icons/lahooni-identity-320.jpg?v=126-mobile",
  "/icons/ostadh-lahooni-192.jpg?v=126-mobile",
];

self.addEventListener("message", event => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => Promise.all(STATIC_FILES.map(path => cache.add(new Request(path, { cache: "reload" }))))).catch(() => undefined));
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith("ostadh-lahooni-") && key !== CACHE_NAME).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  const alwaysFresh = request.mode === "navigate" || request.destination === "document" || request.destination === "style" || request.destination === "script" || request.destination === "font" || url.pathname.startsWith("/_next/") || url.pathname.startsWith("/api/") || url.searchParams.has("_rsc");
  if (alwaysFresh) {
    event.respondWith(fetch(request, { cache: "no-store" }));
    return;
  }

  if (["image", "manifest"].includes(request.destination)) {
    event.respondWith(fetch(request, { cache: "no-store" }).then(response => {
      if (response.ok) caches.open(CACHE_NAME).then(cache => cache.put(request, response.clone()));
      return response;
    }).catch(() => caches.match(request)));
  }
});
