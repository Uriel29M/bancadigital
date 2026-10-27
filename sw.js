const CACHE_VERSION = "banca-digital-shell-v781-global-recommendation-covers";
const SHELL_CACHE = CACHE_VERSION;
const APP_SHELL = [
  "./", "./index.html", "./css/style.css?v=2.2.10.277-global-recommendation-covers",
  "./js/app.js?v=2.2.10.627-global-recommendation-covers", "./js/reader-deps.js?v=5-progressive-telegram",
  "./js/reader-formats.js?v=3-progressive-telegram", "./js/chat-feature.js?v=11-instant-open", "./js/catalog-sync.js?v=7-telegram-cover",
  "./js/catalog-identity.js?v=1", "./js/telegram-auto.js?v=6-telegram-cover",
  "./js/telegram-pages.js?v=9-batch-edition-progress",
  "./js/telegram-covers.js?v=2", "./js/data.js?v=2.2.7.39",
  "./js/data/dc-comics/recentes.js?v=2.2.7.54",
  "./js/data/dc-comics/black-label.js?v=1.0.14",
  "./js/data/dc-comics/milestone.js?v=1.1.1",
  "./js/data/dc-comics/novos-52.js?v=1.0.26",
  "./js/series-default-covers.js?v=1",
  "./js/data/loading-tips.js?v=1.0.0", "./js/supabase.js",
  "./js/series-more.js?v=2-edition-about",
  "./js/section-page-transfer.js?v=8-strict-role",
  "./assets/bucho/ocultas.png",
  "./assets/barracavermelhaicon.png?v=2",
  "./assets/barracabrancaicon.png?v=1", "./assets/semfoto.jpg?v=1",
  "./assets/papercomicsbackground.jpg", "./assets/papercomicsbackgroung.jpg"
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
  const isSupabaseClient = url.hostname === "cdn.jsdelivr.net"
    && url.pathname.startsWith("/npm/@supabase/supabase-js@");
  if (url.origin !== self.location.origin) {
    if (!isReaderDependency && !isSupabaseClient) return;
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
    const refresh = fetch(request, { cache: "no-store" }).then(response => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const copy = response.clone();
      return caches.open(SHELL_CACHE).then(cache => cache.put(request, copy)).then(() => response);
    });
    // Registra a atualização enquanto o evento fetch ainda está ativo.
    event.waitUntil(refresh.then(() => {}, () => {}));
    event.respondWith((async () => {
      const cached = await caches.match(request)
        || await caches.match(request, { ignoreSearch: true });
      if (cached) return cached;
      try {
        return await refresh;
      } catch {
        return new Response("", { status: 504, statusText: "Offline" });
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
