// FXT service worker — offline app shell + Web Share Target capture.
// Bumping CACHE_VERSION invalidates old caches on activate.
const CACHE_VERSION = "fxt-v1";
const APP_SHELL = [
  "/",
  "/scan",
  "/history",
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

// Stash a shared image so the page can pick it up after redirect.
const SHARE_CACHE = "fxt-share";
const SHARE_KEY = "/__shared-image";

async function handleShareTarget(request) {
  try {
    const form = await request.formData();
    const file = form.get("image");
    if (file && typeof file !== "string") {
      const cache = await caches.open(SHARE_CACHE);
      await cache.put(
        SHARE_KEY,
        new Response(file, { headers: { "content-type": file.type || "application/octet-stream" } }),
      );
    }
  } catch {
    // If the shared payload can't be read, fall through to a normal scan load.
  }
  // Redirect (GET) to the existing scan page so navigation never 405s.
  return Response.redirect("/scan?shared=1", 303);
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Web Share Target: POST to /scan from another app's share sheet.
  if (request.method === "POST" && url.origin === self.location.origin && url.pathname === "/scan") {
    event.respondWith(handleShareTarget(request));
    return;
  }

  // Only ever cache same-origin GET requests; never touch APIs or other methods.
  if (request.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/")) {
    return; // default: straight to network
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((response) => {
          // Cache successful basic responses for next time.
          if (response && response.status === 200 && response.type === "basic") {
            const copy = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => {
          // Offline and not cached: for navigations, serve the cached app shell.
          if (request.mode === "navigate") {
            return caches.match("/");
          }
          return Response.error();
        });
    }),
  );
});
