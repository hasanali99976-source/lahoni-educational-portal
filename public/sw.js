const CACHE_NAME = "ostadh-lahooni-v129-background-sync";
const STATIC_FILES = [
  "/manifest.webmanifest?v=129-background-sync",
  "/icon.svg?v=129-background-sync",
  "/icons/lahooni-identity-320.jpg?v=129-background-sync",
  "/icons/ostadh-lahooni-192.jpg?v=129-background-sync",
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
    const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    clients.forEach(client => client.postMessage({ type: "PORTAL_VERSION", version: "129-background-sync" }));
  })());
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  const alwaysFresh = request.mode === "navigate" || request.destination === "document" || request.destination === "style" || request.destination === "script" || request.destination === "font" || url.pathname.startsWith("/_next/") || url.pathname.startsWith("/api/") || url.pathname.startsWith("/teacher/follow-up") || url.searchParams.has("_rsc");
  if (alwaysFresh) {
    event.respondWith(fetch(request, { cache: "no-store" }));
    return;
  }

  if (request.destination === "image") {
    // Keep stable, same-origin artwork available instantly after the first visit.
    // Refresh it in the background without delaying the next paint.
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(request);
      const fresh = fetch(request).then(response => {
        if (response.ok) void cache.put(request, response.clone());
        return response;
      }).catch(() => cached);
      return cached || fresh;
    })());
    return;
  }
  if (request.destination === "manifest") {
    event.respondWith(fetch(request).catch(() => caches.match(request)));
  }
});
