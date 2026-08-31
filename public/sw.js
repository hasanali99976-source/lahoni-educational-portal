const CACHE_NAME = "ostadh-lahooni-v40-diagnostic-print";
const STATIC_FILES = [
  "/",
  "/student",
  "/teacher",
  "/teacher/attendance",
  "/teacher/timetable",
  "/teacher/grades",
  "/teacher/diagnostics",
  "/admin",
  "/admin/students",
  "/manifest.webmanifest",
  "/icon.svg",
  "/icons/ostadh-lahooni-192.jpg",
];

self.addEventListener("message", event => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => Promise.all(STATIC_FILES.map(path => cache.add(new Request(path, { cache: "reload" })))))
      .catch(() => undefined)
  );
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))));
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    const fallback = url.pathname.startsWith("/teacher/attendance")
      ? "/teacher/attendance"
      : url.pathname.startsWith("/teacher/timetable")
        ? "/teacher/timetable"
        : url.pathname.startsWith("/teacher/grades")
          ? "/teacher/grades"
          : url.pathname.startsWith("/teacher/diagnostics")
            ? "/teacher/diagnostics"
            : url.pathname.startsWith("/teacher")
              ? "/teacher"
              : url.pathname.startsWith("/admin/students")
                ? "/admin/students"
                : url.pathname.startsWith("/admin")
                  ? "/admin"
                  : url.pathname.startsWith("/student") || url.pathname.startsWith("/parent") || url.pathname.startsWith("/family")
                    ? "/student"
                    : "/";
    event.respondWith(fetch(request, { cache: "no-store" }).catch(async () =>
      (await caches.match(request))
      || (await caches.match(url.pathname))
      || (await caches.match(fallback))
      || (await caches.match("/"))
    ));
    return;
  }

  if (["style", "script", "font"].includes(request.destination)) {
    event.respondWith(fetch(request, { cache: "no-store" }).catch(() => caches.match(request)));
    return;
  }

  if (["image", "manifest"].includes(request.destination)) {
    event.respondWith(caches.match(request).then(cached => cached || fetch(request).then(response => {
      if (response.ok) caches.open(CACHE_NAME).then(cache => cache.put(request, response.clone()));
      return response;
    })));
  }
});
