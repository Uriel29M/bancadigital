const CACHE_VERSION = "banca-digital-shell-721770ed";
const SHELL_CACHE = CACHE_VERSION;
const APP_SHELL = [
  "./", "./index.html", "./css/style.css?v=721770ed",
  "./js/app.js?v=721770ed", "./js/reader-deps.js?v=721770ed", "./js/catalog-sync.js?v=721770ed",
  "./js/catalog-identity.js?v=721770ed", "./js/telegram-auto.js?v=721770ed",
  "./js/telegram-covers.js?v=721770ed", "./js/data.js?v=721770ed",
  "./js/data/dc-comics/catalog-index.js?v=721770ed",
  "./js/data/dc-comics/black-label.js?v=721770ed",
  "./js/data/dc-comics/milestone.js?v=721770ed",
  "./js/data/dc-comics/novos-52.js?v=721770ed",
  "./js/data/loading-tips.js?v=721770ed", "./js/supabase.js?v=721770ed",
  "./assets/bucho/ocultas.png?v=721770ed",
  "./assets/barracavermelhaicon.png?v=721770ed",
  "./assets/barracabrancaicon.png?v=721770ed", "./assets/semfoto.jpg?v=721770ed",
  "./assets/papercomicsbackground.jpg?v=721770ed", "./assets/papercomicsbackgroung.jpg?v=721770ed"
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
