const CACHE_NAME = "bathos-reader-development";
const CACHE_PREFIX = "bathos-reader-";
const PRECACHE = ["/", "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png", "/icons/apple-icon.png"];
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
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});
self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);
  // The reader never handles authoring pages or authenticated API requests.
  if (request.method !== "GET" || url.origin !== self.location.origin || /^\/(api|admin|manage)(\/|$)/.test(url.pathname)) return;
  if (request.mode === "navigate" && PRECACHE.includes(url.pathname)) {
    // Keep HTML and its hashed assets in the same build. A newly installed
    // worker waits for the reader's Update app action before taking over.
    event.respondWith(caches.open(CACHE_NAME).then(async cache => (await cache.match(url.pathname)) || fetch(request)));
    return;
  }
  if (!PRECACHE.includes(url.pathname)) return;
  event.respondWith(caches.open(CACHE_NAME).then(async cache => (await cache.match(url.pathname)) || fetch(request)));
});
