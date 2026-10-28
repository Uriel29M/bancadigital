const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, range",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Expose-Headers": "Content-Length, Content-Type, Content-Disposition, Content-Range, Accept-Ranges",
};
const MAX_REDIRECTS = 5;
const MAX_FILE_BYTES = 512 * 1024 * 1024;

const RESOLVED_URL_TTL_MS = 30000;
const RANGE_CACHE_TTL_MS = 45000;
const RANGE_CACHE_MAX_BYTES = 16 * 1024 * 1024;
const RANGE_CACHE_MAX_ENTRY_BYTES = 1024 * 1024;
type ResolvedUrlEntry = { url: string; expiresAt: number };
type RangeCacheEntry = { bytes: Uint8Array; status: number; headers: [string, string][]; expiresAt: number };
type RangeFetchResult = { entry?: RangeCacheEntry; response?: Response; url: URL };
const resolvedUrlCache = new Map<string, ResolvedUrlEntry>();
const resolvedUrlInflight = new Map<string, Promise<string>>();
const rangeCache = new Map<string, RangeCacheEntry>();
const rangeInflight = new Map<string, Promise<RangeFetchResult>>();
let rangeCacheBytes = 0;
async function resolveDownloadShared(url: URL): Promise<URL> {
  const key = url.toString();
  const cached = resolvedUrlCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return new URL(cached.url);
  if (cached) resolvedUrlCache.delete(key);
  const pending = resolvedUrlInflight.get(key);
  if (pending) return new URL(await pending);
  const task = resolveDownload(url).then(result => {
    resolvedUrlCache.set(key, { url: result.toString(), expiresAt: Date.now() + RESOLVED_URL_TTL_MS });
    while (resolvedUrlCache.size > 256) {
      const oldest = resolvedUrlCache.keys().next().value;
      if (typeof oldest !== "string") break;
      resolvedUrlCache.delete(oldest);
    }
    return result.toString();
  });
  resolvedUrlInflight.set(key, task);
  try { return new URL(await task); }
  finally { if (resolvedUrlInflight.get(key) === task) resolvedUrlInflight.delete(key); }
}
function removeRangeCacheEntry(key: string) {
  const entry = rangeCache.get(key);
  if (!entry) return;
  rangeCacheBytes = Math.max(0, rangeCacheBytes - entry.bytes.byteLength);
  rangeCache.delete(key);
}
function getRangeCacheEntry(key: string): RangeCacheEntry | null {
  const entry = rangeCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) { removeRangeCacheEntry(key); return null; }
  rangeCache.delete(key);
  rangeCache.set(key, entry);
  return entry;
}
function storeRangeCacheEntry(key: string, source: RangeCacheEntry): RangeCacheEntry {
  removeRangeCacheEntry(key);
  const entry: RangeCacheEntry = {
    bytes: new Uint8Array(source.bytes), status: source.status, headers: source.headers,
    expiresAt: Date.now() + RANGE_CACHE_TTL_MS
  };
  for (const [oldKey, oldEntry] of rangeCache) {
    if (oldEntry.expiresAt <= Date.now()) removeRangeCacheEntry(oldKey);
  }
  while (rangeCacheBytes + entry.bytes.byteLength > RANGE_CACHE_MAX_BYTES && rangeCache.size) {
    const oldest = rangeCache.keys().next().value;
    if (typeof oldest !== "string") break;
    removeRangeCacheEntry(oldest);
  }
  if (entry.bytes.byteLength <= RANGE_CACHE_MAX_BYTES) {
    rangeCache.set(key, entry);
    rangeCacheBytes += entry.bytes.byteLength;
  }
  return entry;
}
function rangeResponse(entry: RangeCacheEntry): Response {
  const headers = new Headers();
  for (const [name, value] of entry.headers) headers.set(name, value);
  return new Response(entry.bytes, { status: entry.status, headers });
}
function cacheableResponseHeaders(response: Response): [string, string][] {
  const headers: [string, string][] = [];
  for (const name of ["content-type", "content-disposition", "content-length", "content-range", "accept-ranges"]) {
    const value = response.headers.get(name);
    if (value !== null) headers.push([name, value]);
  }
  return headers;
}
async function fetchMediafireRange(url: URL, range: string): Promise<{ response: Response; url: URL; cacheStatus: string }> {
  const key = url.toString() + "|" + range;
  const cached = getRangeCacheEntry(key);
  if (cached) return { response: rangeResponse(cached), url, cacheStatus: "HIT" };
  const pending = rangeInflight.get(key);
  if (pending) {
    const outcome = await pending;
    if (outcome.entry) return { response: rangeResponse(outcome.entry), url: outcome.url, cacheStatus: "COALESCED" };
    const retry = await fetchAllowed(url, { method: "GET", headers: { Accept: "application/octet-stream,*/*", Range: range } });
    return { response: retry.response, url: retry.url, cacheStatus: "BYPASS" };
  }
  const task = (async (): Promise<RangeFetchResult> => {
    const result = await fetchAllowed(url, { method: "GET", headers: { Accept: "application/octet-stream,*/*", Range: range } });
    const contentType = (result.response.headers.get("content-type") || "").toLowerCase();
    const length = Number(result.response.headers.get("content-length") || 0);
    const canCache = result.response.status === 206 && result.response.body !== null && length > 0 &&
      length <= RANGE_CACHE_MAX_ENTRY_BYTES && !contentType.includes("text/html") && !contentType.startsWith("text/plain");
    if (!canCache) return { response: result.response, url: result.url };
    const bytes = new Uint8Array(await result.response.arrayBuffer());
    if (bytes.byteLength !== length) {
      const fallbackHeaders = new Headers(result.response.headers);
      fallbackHeaders.set("content-length", String(bytes.byteLength));
      return { response: new Response(bytes, { status: result.response.status, headers: fallbackHeaders }), url: result.url };
    }
    const entry = storeRangeCacheEntry(key, {
      bytes, status: result.response.status, headers: cacheableResponseHeaders(result.response), expiresAt: 0
    });
    return { entry, url: result.url };
  })();
  rangeInflight.set(key, task);
  try {
    const outcome = await task;
    if (outcome.entry) return { response: rangeResponse(outcome.entry), url: outcome.url, cacheStatus: "MISS" };
    return { response: outcome.response as Response, url: outcome.url, cacheStatus: "BYPASS" };
  } finally { if (rangeInflight.get(key) === task) rangeInflight.delete(key); }
}

function responseBody(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

function isAllowedHost(hostname: string) {
  const host = hostname.toLowerCase();
  return host === "mediafire.com"
    || host === "www.mediafire.com"
    || /^download\d+\.mediafire\.com$/.test(host);
}

function parseAllowedUrl(value: string) {
  let url: URL;
  try { url = new URL(value); }
  catch { throw new Error("URL inválida."); }
  if (url.protocol !== "https:" || url.username || url.password || url.port || !isAllowedHost(url.hostname)) {
    throw new Error("A URL precisa apontar para o MediaFire.");
  }
  return url;
}

async function fetchAllowed(url: URL, init: RequestInit = {}) {
  let current = url;
  for (let attempt = 0; attempt <= MAX_REDIRECTS; attempt += 1) {
    const response = await fetch(current, { ...init, redirect: "manual" });
    if (![301, 302, 303, 307, 308].includes(response.status)) return { response, url: current };
    const location = response.headers.get("location");
    if (!location) throw new Error("O MediaFire retornou um redirecionamento inválido.");
    current = parseAllowedUrl(new URL(location, current).toString());
  }
  throw new Error("Redirecionamentos demais no MediaFire.");
}

function extractDownloadUrl(html: string, pageUrl: URL) {
  const candidates = [...html.matchAll(/(?:href|data-href)\s*=\s*["']([^"']+)["']/gi)]
    .map(match => match[1].replaceAll("&amp;", "&").replaceAll("\\/", "/"))
    .map(value => { try { return new URL(value, pageUrl); } catch { return null; } })
    .filter((url): url is URL => Boolean(url) && url.protocol === "https:" && isAllowedHost(url.hostname));

  const download = candidates.find(url => url.hostname.startsWith("download") && /\/[^/]+/.test(url.pathname))
    || candidates.find(url => /\/download(?:\/|\?|$)/i.test(url.pathname));
  if (!download) throw new Error("Não foi possível encontrar o download no MediaFire.");
  return download;
}

async function resolveDownload(url: URL) {
  if (/^download\d+\.mediafire\.com$/i.test(url.hostname)) return url;
  const page = await fetchAllowed(url, { headers: { Accept: "text/html,application/xhtml+xml" } });
  if (/^download\d+\.mediafire\.com$/i.test(page.url.hostname)) return page.url;
  if (!page.response.ok) throw new Error("MediaFire respondeu HTTP " + page.response.status + ".");
  const html = await page.response.text();
  return extractDownloadUrl(html, page.url);
}

Deno.serve(async request => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  const requestedMethod = request.method;
  if (requestedMethod !== "GET" && requestedMethod !== "HEAD") return responseBody("Método não permitido.", 405);

  try {
    const input = new URL(request.url).searchParams.get("url");
    if (!input) return responseBody("Informe o parâmetro url.", 400);

    const source = parseAllowedUrl(input);
    const downloadUrl = await resolveDownloadShared(source);
    const range = request.headers.get("range");
    let cacheStatus = "BYPASS";
    const upstream = requestedMethod === "GET" && range && !range.includes(",")
      ? await fetchMediafireRange(downloadUrl, range).then(result => { cacheStatus = result.cacheStatus; return result; })
      : await fetchAllowed(downloadUrl, {
          method: requestedMethod,
          headers: {
            Accept: "application/octet-stream,*/*",
            ...(range ? { Range: range } : {}),
          },
        });

    if (!upstream.response.ok) {
      const status = upstream.response.status >= 400 && upstream.response.status < 500
        ? upstream.response.status
        : 502;
      return responseBody("Download indisponível (HTTP " + upstream.response.status + ").", status);
    }

    const length = Number(upstream.response.headers.get("content-length") || 0);
    if (length > MAX_FILE_BYTES) return responseBody("Arquivo excede o limite permitido.", 413);
    if (requestedMethod === "GET" && !upstream.response.body) return responseBody("O MediaFire não retornou conteúdo.", 502);

    const contentType = (upstream.response.headers.get("content-type") || "").toLowerCase();
    if (contentType.includes("text/html") || contentType.startsWith("text/plain")) {
      return responseBody("O link do MediaFire expirou ou retornou uma página em vez do arquivo. Use a URL permanente /file/... .", 502);
    }

    const headers = new Headers(corsHeaders);
    headers.set("Content-Type", upstream.response.headers.get("content-type") || "application/octet-stream");
    const contentDisposition = upstream.response.headers.get("content-disposition");
    if (contentDisposition) headers.set("Content-Disposition", contentDisposition);
    if (length) headers.set("Content-Length", String(length));
    const contentRange = upstream.response.headers.get("content-range");
    if (contentRange) headers.set("Content-Range", contentRange);
    headers.set("Accept-Ranges", "bytes");
    headers.set("Vary", "Range");
    headers.set("X-Reader-Cache", cacheStatus);
    headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
    headers.set("Cross-Origin-Resource-Policy", "cross-origin");

    return new Response(requestedMethod === "HEAD" ? null : upstream.response.body, {
      status: upstream.response.status,
      headers
    });
  } catch (error) {
    console.error("mediafire-proxy", error);
    return responseBody(error instanceof Error ? error.message : "Falha ao acessar o MediaFire.", 502);
  }
});