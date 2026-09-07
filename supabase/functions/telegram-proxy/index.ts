const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, range",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Expose-Headers": "Content-Length, Content-Type, Content-Disposition, Content-Range, Accept-Ranges",
};

// The hosted Telegram Bot API currently permits downloads up to 20 MB.
const MAX_FILE_BYTES = 20 * 1024 * 1024;

function errorResponse(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function botToken() {
  const token = Deno.env.get("TELEGRAM_BOT_TOKEN")?.trim();
  if (!token) throw new Error("Configure o secret TELEGRAM_BOT_TOKEN.");
  return token;
}

function validFileId(value: string) {
  // Telegram file_ids are opaque; reject control characters and query-string
  // injection while allowing future file_id formats.
  return value.length >= 8 && value.length <= 1024 && /^[A-Za-z0-9_-]+$/.test(value);
}

async function telegramFile(token: string, fileId: string) {
  const response = await fetch(`https://api.telegram.org/bot${token}/getFile`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ file_id: fileId }),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.ok || !payload?.result?.file_path) {
    throw new Error(payload?.description || "O Telegram não encontrou este arquivo.");
  }
  const path = String(payload.result.file_path);
  if (!/^[A-Za-z0-9_./-]+$/.test(path) || path.includes("..")) {
    throw new Error("O Telegram retornou um caminho de arquivo inválido.");
  }
  return { path, size: Number(payload.result.file_size || 0) };
}

Deno.serve(async request => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (request.method !== "GET" && request.method !== "HEAD") return errorResponse("Método não permitido.", 405);

  try {
    const fileId = new URL(request.url).searchParams.get("file_id")?.trim() || "";
    if (!validFileId(fileId)) return errorResponse("Informe um file_id do Telegram válido.", 400);

    const token = botToken();
    const file = await telegramFile(token, fileId);
    if (file.size > MAX_FILE_BYTES) return errorResponse("O arquivo excede o limite de 20 MB da Bot API do Telegram.", 413);

    const range = request.headers.get("range");
    const upstream = await fetch(`https://api.telegram.org/file/bot${token}/${file.path}`, {
      method: request.method,
      headers: { Accept: "application/octet-stream,*/*", ...(range ? { Range: range } : {}) },
    });
    if (!upstream.ok) {
      const status = upstream.status >= 400 && upstream.status < 500 ? upstream.status : 502;
      return errorResponse(`Download indisponível (HTTP ${upstream.status}).`, status);
    }
    const contentLength = Number(upstream.headers.get("content-length") || 0);
    const contentRange = upstream.headers.get("content-range") || "";
    const total = Number(contentRange.match(/\/(\d+)$/)?.[1] || 0) || contentLength || file.size;
    if (total > MAX_FILE_BYTES) return errorResponse("O arquivo excede o limite de 20 MB da Bot API do Telegram.", 413);
    if (request.method === "GET" && !upstream.body) return errorResponse("O Telegram não retornou conteúdo.", 502);

    const headers = new Headers(corsHeaders);
    headers.set("Content-Type", upstream.headers.get("content-type") || "application/octet-stream");
    headers.set("Content-Disposition", upstream.headers.get("content-disposition") || "attachment");
    if (contentLength) headers.set("Content-Length", String(contentLength));
    if (contentRange) headers.set("Content-Range", contentRange);
    headers.set("Accept-Ranges", "bytes");
    headers.set("Vary", "Range");
    headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
    headers.set("Cross-Origin-Resource-Policy", "cross-origin");
    return new Response(request.method === "HEAD" ? null : upstream.body, { status: upstream.status, headers });
  } catch (error) {
    console.error("telegram-proxy", error);
    return errorResponse(error instanceof Error ? error.message : "Falha ao acessar o Telegram.", 502);
  }
});
