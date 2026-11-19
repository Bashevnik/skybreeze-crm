const CACHE = "skybreeze-life-shell-20261119-12";
const SHELL = [
  "./",
  "./index.html",
  "./styles.css?v=20261118-1",
  "./crm-layout.css?v=20261119-5",
  "./life.css?v=20261119-11",
  "./app.js?v=20261119-5",
  "./life-ui.js?v=20261119-12",
  "./outreach.css?v=20261119-9",
  "./outreach-ui.js?v=20261119-9",
  "./manifest.webmanifest?v=20261116-1",
  "./icon.svg",
];
self.addEventListener("install", (event) => event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())));
self.addEventListener("activate", (event) => event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin || url.pathname.includes("/api/")) return;
  const isVersionedAsset = url.searchParams.has("v");
  // Versioned files have a new URL on every deploy, so serving the cached
  // version removes an avoidable network round-trip without trapping a user
  // on stale UI code. HTML and config remain network-first.
  if (isVersionedAsset) {
    event.respondWith(caches.match(request).then((cached) => cached || fetch(request).then((response) => {
      const copy = response.clone();
      caches.open(CACHE).then((cache) => cache.put(request, copy));
      return response;
    })));
    return;
  }
  event.respondWith(fetch(request).then((response) => {
    const copy = response.clone();
    caches.open(CACHE).then((cache) => cache.put(request, copy));
    return response;
  }).catch(() => caches.match(request).then((cached) => cached || caches.match("./"))));
});
