const CACHE_VERSION = "banca-digital-shell-v274";
const SHELL_CACHE = CACHE_VERSION;

const APP_SHELL = [
  "./",
  "./index.html",
  "./css/style.css?v=2.2.10.95",
  "./js/app.js?v=2.2.10.207",
  "./js/data.js?v=2.2.7.39",
  "./js/data/dc-comics/recentes.js?v=2.2.7.40",
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
  if (url.pathname.endsWith("/js/app.js")) {
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
      // Uma navegação do SPA ainda pode funcionar com o shell local. Não
      // devolva um 504 vazio, pois isso quebra a rota /?pagina=... mesmo
      // quando o index.html já está no cache.
      return caches.match("./index.html").then(cached => cached || new Response("Offline", {
        status: 503,
        statusText: "Offline",
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      }));
    }
  })());
});
