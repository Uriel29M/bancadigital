const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Expose-Headers": "Content-Length, Content-Type, Content-Disposition, Content-Range, Accept-Ranges",
};

const MAX_REDIRECTS = 5;
const MAX_FILE_BYTES = 512 * 1024 * 1024;

function responseBody(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
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
  try {
    url = new URL(value);
  } catch {
    throw new Error("URL inválida.");
  }
  if (url.protocol !== "https:" || !isAllowedHost(url.hostname)) {
    throw new Error("A URL precisa apontar para o MediaFire.");
  }
  return url;
}

async function fetchAllowed(url: URL, init: RequestInit = {}) {
  let current = url;
  for (let attempt = 0; attempt <= MAX_REDIRECTS; attempt += 1) {
    const response = await fetch(current, { ...init, redirect: "manual" });
    if (![301, 302, 303, 307, 308].includes(response.status)) {
      return { response, url: current };
    }
    const location = response.headers.get("location");
    if (!location) throw new Error("O MediaFire retornou um redirecionamento inválido.");
    current = parseAllowedUrl(new URL(location, current).toString());
  }
  throw new Error("Redirecionamentos demais no MediaFire.");
}

function extractDownloadUrl(html: string, pageUrl: URL) {
  const candidates = [...html.matchAll(/(?:href|data-href)\s*=\s*["']([^"']+)["']/gi)]
    .map(match => match[1].replaceAll("&amp;", "&").replaceAll("\\/", "/"))
    .map(value => {
      try { return new URL(value, pageUrl); } catch { return null; }
    })
    .filter((url): url is URL => Boolean(url) && url.protocol === "https:" && isAllowedHost(url.hostname));

  const download = candidates.find(url => url.hostname.startsWith("download") && /\/[^/]+/.test(url.pathname))
    || candidates.find(url => /\/download(?:\/|\?|$)/i.test(url.pathname));
  if (!download) throw new Error("Não foi possível encontrar o download no MediaFire.");
  return download;
}

async function resolveDownload(url: URL) {
  if (/^download\d+\.mediafire\.com$/i.test(url.hostname)) return url;
  const page = await fetchAllowed(url, { headers: { Accept: "text/html,application/xhtml+xml" } });
  if (!page.response.ok) throw new Error(`MediaFire respondeu HTTP ${page.response.status}.`);
  const html = await page.response.text();
  return extractDownloadUrl(html, page.url);
}

Deno.serve(async request => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  const requestedMethod = request.method;
  if (requestedMethod === "HEAD") request = new Request(request.url, { method: "GET", headers: request.headers });
  if (request.method !== "GET") return responseBody("Método não permitido.", 405);

  try {
    const input = new URL(request.url).searchParams.get("url");
    if (!input) return responseBody("Informe o parâmetro url.", 400);

    const source = parseAllowedUrl(input);
    const downloadUrl = await resolveDownload(source);
    const range = request.headers.get("range");
    const upstream = await fetchAllowed(downloadUrl, {
      method: requestedMethod,
      headers: {
        Accept: "application/octet-stream,*/*",
        ...(range ? { Range: range } : {}),
      },
    });
    if (requestedMethod === "HEAD" && !upstream.response.body) {
      upstream.response = new Response(new Uint8Array(0), { status: upstream.response.status, headers: upstream.response.headers });
    }
    if (!upstream.response.ok) return responseBody(`Download indisponível (HTTP ${upstream.response.status}).`, 502);

    const length = Number(upstream.response.headers.get("content-length") || 0);
    if (length > MAX_FILE_BYTES) return responseBody("Arquivo excede o limite permitido.", 413);
    if (!upstream.response.body) return responseBody("O MediaFire não retornou conteúdo.", 502);

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
    headers.set("Cache-Control", "public, max-age=300");

    // Entrega o arquivo conforme chega. Assim o navegador pode começar a
    // processar a resposta enquanto o restante ainda está sendo recebido.
    return new Response(requestedMethod === "HEAD" ? null : upstream.response.body, { status: upstream.response.status, headers });
  } catch (error) {
    console.error("mediafire-proxy", error);
    return responseBody(error instanceof Error ? error.message : "Falha ao acessar o MediaFire.", 502);
  }
});
