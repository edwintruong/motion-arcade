// Keeps the game's pages and files available when the network is slow or gone.
// Pairing a phone always needs the network; only the shell is cached.
const CACHE = "motion-arcade-v1";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== location.origin || url.pathname === "/ws") return;

  const remember = (response) => {
    if (response.ok) {
      const copy = response.clone();
      caches.open(CACHE).then((cache) => cache.put(request, copy));
    }
    return response;
  };

  if (request.mode === "navigate") {
    // Always try for the newest page, so an installed app updates on its next launch.
    event.respondWith(
      fetch(request).then(remember).catch(() => caches.match(request, { ignoreSearch: true })),
    );
    return;
  }
  // Built files have their content hash in the name: once cached, never stale.
  event.respondWith(caches.match(request).then((hit) => hit ?? fetch(request).then(remember)));
});
