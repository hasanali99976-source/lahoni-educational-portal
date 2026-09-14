const CACHE_NAME = "ostadh-lahooni-v119-hard-reset";
const STATIC_FILES = [
  "/manifest.webmanifest?v=119-hard-reset",
  "/icon.svg?v=119-hard-reset",
  "/icons/lahooni-identity-320.jpg?v=119-hard-reset",
  "/icons/ostadh-lahooni-192.jpg?v=119-hard-reset",
  "/saudi-classroom.svg?v=119-hard-reset",
];

self.addEventListener("message", event => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("install", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.map(key => caches.delete(key))))
      .then(() => caches.open(CACHE_NAME))
      .then(cache => Promise.all(STATIC_FILES.map(path => cache.add(new Request(path, { cache: "reload" })))))
      .catch(() => undefined),
  );
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)),
    )),
  );
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  const mustBeFresh =
    request.mode === "navigate" ||
    request.destination === "style" ||
    request.destination === "script" ||
    request.destination === "font" ||
    url.pathname.startsWith("/_next/") ||
    url.pathname.startsWith("/api/") ||
    url.searchParams.has("_rsc");

  if (mustBeFresh) {
    event.respondWith(fetch(request, { cache: "reload" }));
    return;
  }

  if (["image", "manifest"].includes(request.destination)) {
    event.respondWith(
      fetch(request, { cache: "reload" })
        .then(response => {
          if (response.ok) caches.open(CACHE_NAME).then(cache => cache.put(request, response.clone()));
          return response;
        })
        .catch(() => caches.match(request)),
    );
  }
});