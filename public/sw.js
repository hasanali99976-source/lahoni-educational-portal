const CACHE_NAME = "ostadh-lahooni-v115-no-legacy";
const STATIC_FILES = [
  "/manifest.webmanifest",
  "/icon.svg",
  "/icons/lahooni-identity-320.jpg",
  "/icons/ostadh-lahooni-192.jpg",
  "/saudi-classroom.svg",
];

self.addEventListener("message", event => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => Promise.all(STATIC_FILES.map(path => cache.add(new Request(path, { cache: "reload" })))))
      .catch(() => undefined),
  );
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))),
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
    event.respondWith(fetch(request, { cache: "no-store" }));
    return;
  }

  if (["image", "manifest"].includes(request.destination)) {
    event.respondWith(
      caches.match(request).then(cached => {
        const fresh = fetch(request).then(response => {
          if (response.ok) caches.open(CACHE_NAME).then(cache => cache.put(request, response.clone()));
          return response;
        });
        return cached || fresh;
      }),
    );
  }
});
