const CACHE_VERSION = "banca-digital-shell-v80";
const SHELL_CACHE = CACHE_VERSION;

const APP_SHELL = [
  "./",
  "./index.html",
  "./css/style.css?v=2.2.10.21",
  "./js/app.js?v=2.2.10.24",
  "./js/data.js?v=2.2.7.38",
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
      return new Response("", { status: 504, statusText: "Offline" });
    }
  })());
});
