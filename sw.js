const CACHE_VERSION = "banca-digital-shell-b7774069";
const SHELL_CACHE = CACHE_VERSION;
const APP_SHELL = [
  "./", "./index.html", "./css/style.css?v=b7774069",
  "./js/app.js?v=b7774069", "./js/reader-deps.js?v=b7774069", "./js/catalog-sync.js?v=b7774069",
  "./js/catalog-identity.js?v=b7774069", "./js/telegram-auto.js?v=b7774069",
  "./js/telegram-covers.js?v=b7774069", "./js/data.js?v=b7774069",
  "./js/data/dc-comics/catalog-index.js?v=b7774069",
  "./js/data/dc-comics/black-label.js?v=b7774069",
  "./js/data/dc-comics/milestone.js?v=b7774069",
  "./js/data/dc-comics/novos-52.js?v=b7774069",
  "./js/data/loading-tips.js?v=b7774069", "./js/supabase.js?v=b7774069",
  "./assets/bucho/ocultas.png?v=b7774069",
  "./assets/barracavermelhaicon.png?v=b7774069",
  "./assets/barracabrancaicon.png?v=b7774069", "./assets/semfoto.jpg?v=b7774069",
  "./assets/papercomicsbackground.jpg?v=b7774069", "./assets/papercomicsbackgroung.jpg?v=b7774069"
];
self.addEventListener("install", event => {
  event.waitUntil(caches.open(SHELL_CACHE)
    .then(cache => Promise.all(APP_SHELL.map(asset => cache.add(asset).catch(() => null))))
    .then(() => self.skipWaiting()));
});
self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith("banca-digital-shell-") && key !== SHELL_CACHE).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});
self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  const readerCdnHosts = new Set(["cdn.jsdelivr.net", "unpkg.com", "cdnjs.cloudflare.com"]);
  const isReaderDependency = readerCdnHosts.has(url.hostname) && (
    url.pathname.includes("/jszip@3.10.1/") ||
    url.pathname.includes("/jszip/3.10.1/") ||
    url.pathname.includes("/@zip.js/zip.js@2.7.57/")
  );
  if (url.origin !== self.location.origin) {
    if (!isReaderDependency) return;
    event.respondWith((async () => {
      const cached = await caches.match(request);
      if (cached) return cached;
      try {
        const response = await fetch(request);
        const copy = response.clone();
        caches.open(SHELL_CACHE).then(cache => cache.put(request, copy)).catch(() => {});
        return response;
      } catch {
        return cached || new Response("", { status: 504, statusText: "Offline" });
      }
    })());
    return;
  }
  if (request.mode === "navigate") {
    event.respondWith(fetch(request, { cache: "no-store" }).then(response => {
      const copy = response.clone();
      caches.open(SHELL_CACHE).then(cache => cache.put("./index.html", copy));
      return response;
    }).catch(() => caches.match(request, { ignoreSearch: true }).then(cached => cached || caches.match("./index.html", { ignoreSearch: true }))));
    return;
  }
  const isCatalogData = url.pathname.endsWith("/js/data.js") || url.pathname.includes("/js/data/");
  const isAppJavascript = url.pathname.includes("/js/") && url.pathname.endsWith(".js");
  if (isAppJavascript || url.pathname.endsWith("/css/style.css") || isCatalogData) {
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
