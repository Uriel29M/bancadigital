const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, range",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Expose-Headers": "Content-Length, Content-Type, Content-Disposition, Content-Range, Accept-Ranges",
};

const MAX_FILE_BYTES = 512 * 1024 * 1024;
const ALLOWED_DRIVE_FILE_IDS = new Set([
  "0B8S09qODXLIHcTdvUWtLMlpLc00",
  "0B8S09qODXLIHaENXOTVLQnhJZ1k",
  "0B8S09qODXLIHVERYcS1FbHAtRVk",
  "0B8S09qODXLIHMlc5OHEyRmhiRU0",
  "0B8S09qODXLIHVkpLSnhSRFFMRzA",
  "0B8S09qODXLIHY3FoX0JpYnhiRXc",
  "0B8S09qODXLIHdlprTkJoS0ZuZlE",
  "0B8S09qODXLIHbmM2QXRDSTlOdDA",
  "0B8S09qODXLIHa3lXZE5peko2emc",
  "0B8S09qODXLIHalNhZHJYa2pwWkE",
  "0B8S09qODXLIHOUVoVVYwN2huVFk",
  "0B8S09qODXLIHcHI0T29lSjJZNlk",
  "0B8S09qODXLIHWHNsZGFBRzJ5OEE",
  "0B8S09qODXLIHY3c1bk9ZNHpEeE0",
  "0B8S09qODXLIHT254b2FOTm8wYjg",
  "0B8S09qODXLIHdHlUUF9pOHFicGM",
  "0B8S09qODXLIHRjBHaF9BVVFDaEk",
  "0B8S09qODXLIHSHFhQlhrT3ZGVm8",
  "0B8S09qODXLIHbzVJR1c3b0VfRDQ",
  "0B8S09qODXLIHX3lKbWtMVjQ5Y1E",
  "0B8S09qODXLIHSG1Zd2hXMF9lYmc",
  "0B8S09qODXLIHV180bUFoMjBfd1U",
  "0B8S09qODXLIHckY2WGxiTWM1cFE",
  "0B8S09qODXLIHSEhIa2Y2dURsc1U",
  "0B8S09qODXLIHeHZ4VDR5Q1lXdDA",
  "0B8S09qODXLIHVWFYLWFBR3hhdE0",
  "0B8S09qODXLIHdnBQWE1HMFBJRmc",
  "0B8S09qODXLIHV0sxV0ZQR1RROTQ",
  "0B8S09qODXLIHb3lKWjluNGRGcWs",
  "0B8S09qODXLIHeUhsVlE1bFl1bVk",
  "0B8S09qODXLIHUGNYWVlIODhRT0k",
  "0B8S09qODXLIHZ0pmdG5ESzE1QVU",
  "0B8S09qODXLIHQ2wtZHc4UWF1Rzg",
  "0B8S09qODXLIHNnZaRERmZU4xdUU",
  "0B8S09qODXLIHeEZKTDlBb3BTalk",
  "0B8S09qODXLIHN1Jmc2liNHpDalU",
  "0B8S09qODXLIHa0g5c3piWEpLbDA",
  "0B8S09qODXLIHT21jUzVfcUpVQlE",
  "0B8S09qODXLIHX0FxRG9sUDY2ZW8",
  "0B8S09qODXLIHb2tOMDZGdW82X1U",
  "0B8S09qODXLIHbV8zMXZHaThaUUU",
  "0B8S09qODXLIHWDJ0MTJ3dTQyOFE",
  "0B8S09qODXLIHUTA4NUV5QXI2eVk",
  "0B8S09qODXLIHRTUzeFRBOWNXRnM",
  "0B8S09qODXLIHdGNmMWJ1eFNyNmM",
  "0B8S09qODXLIHQ0FVallWMVJxWFU",
  "0B8S09qODXLIHRWlJVjhWWHJzeVE",
  "0BwNN_dNDOY0Wd3QyZWVaZVVqUnM",
  "0BwNN_dNDOY0WYXZMWnpWSXlHZTQ",
  "0BwNN_dNDOY0WUXdVNnYtdXZYcGM",
  "0BwNN_dNDOY0WUlRLeVVSeDkyaEE",
  "0BwNN_dNDOY0WcE96NTE0QS1EVGs",
  "0BwNN_dNDOY0Wc0tzTVlHNlRINms",
  "0BwNN_dNDOY0WX01VeDB4Z2gzWWs",
  "0BwNN_dNDOY0WUjRUNXJEaldKN2M",
  "0BwNN_dNDOY0WVm5LMUF2UVo3Wkk",
  "0B2AOzvnwI3s1SjdyQ2xybC1iYVU",
  "0B2AOzvnwI3s1Uldpa3pldTZ4Qlk",
  "0B8S09qODXLIHMFZYVmZPSzZ6LUE",
  "0B8S09qODXLIHdUhCMUNkTFpuN0U",
  "0B8S09qODXLIHb3A1YnFXX0dDUms",
  "0B8S09qODXLIHcEJVM25Qd3JGWGM",
]);

function errorResponse(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function driveDownloadUrl(value: string) {
  let source: URL;
  try {
    source = new URL(value);
  } catch {
    throw new Error("URL inválida.");
  }

  const host = source.hostname.toLowerCase();
  const allowedHost = host === "drive.google.com"
    || host === "docs.google.com"
    || host === "drive.usercontent.google.com";
  if (source.protocol !== "https:" || !allowedHost) {
    throw new Error("A URL precisa apontar para o Google Drive.");
  }

  const pathId = source.pathname.match(/^\/file\/d\/([^/]+)/i)?.[1] || "";
  const fileId = pathId || source.searchParams.get("id") || "";
  if (!/^[A-Za-z0-9_-]{10,200}$/.test(fileId)) {
    throw new Error("O link não contém um ID de arquivo válido.");
  }
  if (!ALLOWED_DRIVE_FILE_IDS.has(fileId)) {
    throw new Error("Este arquivo do Google Drive não está autorizado.");
  }

  const download = new URL("https://drive.usercontent.google.com/download");
  download.searchParams.set("id", fileId);
  download.searchParams.set("export", "download");
  const resourceKey = source.searchParams.get("resourcekey");
  if (resourceKey && /^[A-Za-z0-9_-]{1,200}$/.test(resourceKey)) {
    download.searchParams.set("resourcekey", resourceKey);
  }
  return download;
}

Deno.serve(async request => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (request.method !== "GET" && request.method !== "HEAD") return errorResponse("Método não permitido.", 405);

  try {
    const input = new URL(request.url).searchParams.get("url");
    if (!input) return errorResponse("Informe o parâmetro url.", 400);

    const source = driveDownloadUrl(input);
    const range = request.headers.get("range");
    const upstream = await fetch(source, {
      method: request.method,
      redirect: "follow",
      headers: {
        Accept: "application/octet-stream,*/*",
        "Accept-Encoding": "identity",
        "User-Agent": "Mozilla/5.0 (compatible; BancaDigitalDriveProxy/1.0)",
        ...(range ? { Range: range } : {}),
      },
    });

    if (!upstream.ok) {
      const status = upstream.status >= 400 && upstream.status < 500 ? upstream.status : 502;
      return errorResponse(`Download indisponível (HTTP ${upstream.status}).`, status);
    }

    const contentType = String(upstream.headers.get("content-type") || "").toLowerCase();
    if (contentType.includes("text/html") || contentType.startsWith("text/plain")) {
      return errorResponse("O Google Drive retornou uma página em vez do arquivo.", 502);
    }

    const contentRange = upstream.headers.get("content-range") || "";
    const totalFromRange = Number(contentRange.match(/\/(\d+)$/)?.[1] || 0);
    const contentLength = Number(upstream.headers.get("content-length") || 0);
    const totalBytes = totalFromRange || contentLength;
    if (totalBytes > MAX_FILE_BYTES) return errorResponse("Arquivo excede o limite permitido.", 413);
    if (request.method === "GET" && !upstream.body) return errorResponse("O Google Drive não retornou conteúdo.", 502);

    const headers = new Headers(corsHeaders);
    headers.set("Content-Type", upstream.headers.get("content-type") || "application/octet-stream");
    const disposition = upstream.headers.get("content-disposition");
    if (disposition) headers.set("Content-Disposition", disposition);
    if (contentLength) headers.set("Content-Length", String(contentLength));
    if (contentRange) headers.set("Content-Range", contentRange);
    headers.set("Accept-Ranges", "bytes");
    headers.set("Cross-Origin-Resource-Policy", "cross-origin");
    headers.set("Vary", "Range");
    headers.set("Cache-Control", "no-store, no-cache, must-revalidate");

    return new Response(request.method === "HEAD" ? null : upstream.body, {
      status: upstream.status,
      headers,
    });
  } catch (error) {
    console.error("drive-proxy", error);
    return errorResponse(error instanceof Error ? error.message : "Falha ao acessar o Google Drive.", 502);
  }
});
