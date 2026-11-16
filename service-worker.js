const CACHE = "skybreeze-life-shell-20261116-1";
const SHELL = [
  "./",
  "./index.html",
  "./styles.css?v=20261116-2",
  "./crm-layout.css?v=20261116-1",
  "./life.css?v=20261116-1",
  "./app.js?v=20261116-2",
  "./life-ui.js?v=20261116-1",
  "./manifest.webmanifest?v=20261116-1",
  "./icon.svg",
];
self.addEventListener("install", (event) => event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL))));
self.addEventListener("activate", (event) => event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))));
self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin || url.pathname.includes("/api/")) return;
  event.respondWith(caches.match(request).then((cached) => cached || fetch(request).then((response) => {
    const copy = response.clone();
    caches.open(CACHE).then((cache) => cache.put(request, copy));
    return response;
  })));
});
