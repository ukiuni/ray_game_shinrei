const CACHE = "unseen-__VERSION__";
const ASSETS = __ASSETS__;
self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      try {
        for (let i = 0; i < ASSETS.length; i += 8)
          await cache.addAll(ASSETS.slice(i, i + 8));
      } catch (e) {
        await caches.delete(CACHE);
        throw e;
      }
    })(),
  );
});
self.addEventListener("message", (event) => {
  if (event.data?.type === "ACTIVATE") self.skipWaiting();
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys())
        if (key.startsWith("unseen-") && key !== CACHE)
          await caches.delete(key);
      await self.clients.claim();
    })(),
  );
});
self.addEventListener("fetch", (event) => {
  if (
    event.request.method !== "GET" ||
    new URL(event.request.url).origin !== self.location.origin
  )
    return;
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const hit = await cache.match(event.request, { ignoreSearch: true });
      if (hit) return hit;
      try {
        return await fetch(event.request);
      } catch (e) {
        if (event.request.mode === "navigate")
          return await cache.match(new URL("./", self.registration.scope));
        throw e;
      }
    })(),
  );
});
