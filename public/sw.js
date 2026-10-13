// Migration endpoint for existing installations. New readers do not register it.
self.addEventListener("install", event => {
  event.waitUntil(self.skipWaiting());
});
self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    await Promise.all((await caches.keys()).filter(key => key.startsWith("bathos-reader-")).map(key => caches.delete(key)));
    await self.clients.claim();
    await self.registration.unregister();
    // Replace pages still running the old cached reader with the online release.
    for (const client of await self.clients.matchAll({ type: "window" })) {
      const url = new URL(client.url);
      if (url.origin === self.location.origin && !/^\/(api|admin|manage)(\/|$)/.test(url.pathname)) {
        await client.navigate(client.url);
      }
    }
  })());
});
