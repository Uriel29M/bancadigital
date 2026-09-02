const CACHE_VERSION = "banca-digital-shell-v560";
const SHELL_CACHE = CACHE_VERSION;

const APP_SHELL = [
  "./",
  "./index.html",
  "./css/style.css?v=2.2.10.225",
  "./js/app.js?v=2.2.10.430",
  "./js/data.js?v=2.2.7.39",
  "./js/data/dc-comics/recentes.js?v=2.2.7.43",
  "./js/data/dc-comics/black-label.js?v=1.0.14",
  "./js/data/dc-comics/milestone.js?v=1.1.1",
  "./js/data/loading-tips.js?v=1.0.0",
  "./js/supabase.js",
  "./assets/barracabrancaicon.png?v=1",
  "./assets/semfoto.jpg?v=1",
  "./assets/papercomicsbackground.jpg",
  "./assets/papercomicsbackgroung.jpg",
  "./js/pdfjs/pdf.min.mjs",
  "./js/pdfjs/pdf.worker.min.mjs",
  "./libarchive/libarchive.js",
  "./libarchive/libarchive.wasm",
  "./libarchive/worker-bundle.js"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then(cache => Promise.all(APP_SHELL.map(asset => cache.add(asset).catch(() => null))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key.startsWith("banca-digital-shell-") && key !== SHELL_CACHE)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then(response => {
          const copy = response.clone();
          caches.open(SHELL_CACHE).then(cache => cache.put("./index.html", copy));
          return response;
        })
        .catch(() => caches.match(request).then(cached => cached || caches.match("./index.html")))
    );
    return;
  }

  // O app muda com frequência; tente sempre a versão publicada antes
  // de recorrer ao cache offline.
  if (url.pathname.endsWith("/js/app.js") || url.pathname.endsWith("/css/style.css")) {
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
      // Somente navegações usam index.html como fallback. Para assets, um
      // HTML retornado com status 200 mascara o erro e quebra a aplicação.
      return new Response("Offline", {
        status: 503,
        statusText: "Offline",
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }
  })());
});
