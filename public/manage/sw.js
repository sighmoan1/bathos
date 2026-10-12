const CACHE_NAME = "bathos-manager-development";
const PRECACHE = ["/manage/", "/manage/manifest.webmanifest", "/manage/icon-192.png", "/manage/icon-512.png", "/manage/apple-icon.png"];
const CACHE_PREFIX = "bathos-manager-";
self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE)));
});
self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    await Promise.all((await caches.keys()).filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});
self.addEventListener("message", event => {
  if (event.data?.type === "SKIP_WAITING" || event.data === "SKIP_WAITING") self.skipWaiting();
});
self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);
  // No authenticated API responses, tokens or OAuth pages enter this cache.
  if (request.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;
  if (request.mode === "navigate" && (url.pathname === "/manage" || url.pathname.startsWith("/manage/"))) {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response.ok && response.headers.get("content-type")?.includes("text/html")) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put("/manage/", response.clone());
          return response;
        }
        return (await caches.match("/manage/")) || response;
      } catch {
        return (await caches.match("/manage/")) || new Response("Open the post manager online once before using it offline.", { status: 503, headers: { "Content-Type": "text/plain" } });
      }
    })());
    return;
  }
  if (!PRECACHE.some(path => url.pathname === path) && !url.pathname.startsWith("/_next/static/")) return;
  event.respondWith((async () => {
    const cached = await caches.match(request, { ignoreSearch: true });
    if (cached) return cached;
    const response = await fetch(request);
    if (response.ok && response.type !== "opaque") {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, response.clone());
    }
    return response;
  })());
});
