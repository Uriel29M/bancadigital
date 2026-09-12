const CACHE_VERSION = "banca-digital-shell-v632-account-retention";
const SHELL_CACHE = CACHE_VERSION;
const APP_SHELL = [
  "./", "./index.html", "./css/style.css?v=2.2.10.241-auth-logo-size",
  "./js/app.js?v=2.2.10.485-account-retention", "./js/catalog-sync.js?v=3-series-order",
  "./js/catalog-identity.js?v=1", "./js/telegram-auto.js?v=4",
  "./js/telegram-covers.js?v=2", "./js/data.js?v=2.2.7.39",
  "./js/data/dc-comics/recentes.js?v=2.2.7.54",
  "./js/data/dc-comics/black-label.js?v=1.0.14",
  "./js/data/dc-comics/milestone.js?v=1.1.1",
  "./js/data/dc-comics/novos-52.js?v=1.0.26",
  "./js/data/loading-tips.js?v=1.0.0", "./js/supabase.js",
  "./assets/barracavermelhaicon.png?v=2",
  "./assets/barracabrancaicon.png?v=1", "./assets/semfoto.jpg?v=1",
  "./assets/papercomicsbackground.jpg", "./assets/papercomicsbackgroung.jpg",
  "./js/pdfjs/pdf.min.mjs", "./js/pdfjs/pdf.worker.min.mjs",
  "./libarchive/libarchive.js", "./libarchive/libarchive.wasm",
  "./libarchive/worker-bundle.js"
];
self.addEventListener("install", event => {
  event.waitUntil(caches.open(SHELL_CACHE)
    .then(cache => Promise.all(APP_SHELL.map(asset => cache.add(asset).catch(() => null))))
    .then(() => self.skipWaiting()));
});
self.addEventListener("activate", event => {
  event.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(key => key.startsWith("banca-digital-shell-") && key !== SHELL_CACHE).map(key => caches.delete(key))))
    .then(() => self.clients.claim()));
});
self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).then(response => {
      const copy = response.clone();
      caches.open(SHELL_CACHE).then(cache => cache.put("./index.html", copy));
      return response;
    }).catch(() => caches.match(request, { ignoreSearch: true }).then(cached => cached || caches.match("./index.html", { ignoreSearch: true }))));
    return;
  }
  const isCatalogData = url.pathname.endsWith("/js/data.js") || url.pathname.includes("/js/data/");
  if (url.pathname.endsWith("/js/app.js") || url.pathname.endsWith("/js/catalog-sync.js") || url.pathname.endsWith("/js/catalog-identity.js") || url.pathname.endsWith("/js/telegram-auto.js") || url.pathname.endsWith("/js/telegram-covers.js") || url.pathname.endsWith("/css/style.css") || isCatalogData) {
    event.respondWith((async () => {
      try {
        const response = await fetch(request, { cache: "no-store" });
        if (response.ok) {
          const copy = response.clone();
          caches.open(SHELL_CACHE).then(cache => cache.put(request, copy)).catch(() => {});
        }
        return response;
      } catch {
        return caches.match(request).then(cached => cached || new Response("", { status: 504, statusText: "Offline" }));
      }
    })());
    return;
  }
  event.respondWith((async () => {
    try {
      const cached = await caches.match(request);
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok) {
        const copy = response.clone();
        caches.open(SHELL_CACHE).then(cache => cache.put(request, copy)).catch(() => {});
      }
      return response;
    } catch {
      return new Response("Offline", { status: 503, statusText: "Offline", headers: { "Content-Type": "text/plain; charset=utf-8" } });
    }
  })());
});
