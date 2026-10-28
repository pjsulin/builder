// Precache every built file; serve from cache, fall back to network. The build
// (vite.config.ts) fills in the list and a content hash, so a new build is a new
// cache and the old one is dropped on activate.
const CACHE = "builder-__CACHE_VERSION__";
const PRECACHE = __PRECACHE__;
const INDEX = new URL("./index.html", self.location.href).href;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("builder-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;
  // Navigations to the app's directory are the index page, whatever the query string.
  const key = request.mode === "navigate" ? INDEX : request;
  event.respondWith(caches.match(key, { ignoreSearch: true }).then((hit) => hit ?? fetch(request)));
});
