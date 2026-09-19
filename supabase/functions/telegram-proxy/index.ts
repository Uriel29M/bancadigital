import { GatewayError, redirectToGateway } from "../_shared/media-gateway.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, range",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Expose-Headers": "Location, Retry-After",
};

function fail(message: string, status: number, code = "telegram_error") {
  return new Response(JSON.stringify({ error: message, code }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" }
  });
}
function required(name: string) {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new GatewayError(`Configure ${name}.`, 503, "telegram_not_configured");
  return value;
}
async function rest(path: string) {
  const key = required("SUPABASE_SERVICE_ROLE_KEY");
  const response = await fetch(`${required("SUPABASE_URL")}/rest/v1/${path}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(10000)
  });
  if (!response.ok) throw new GatewayError("Não foi possível validar o catálogo.", 502, `catalog_http_${response.status}`);
  return await response.json();
}
function normalizePost(value: unknown) {
  try {
    const url = new URL(String(value || ""));
    if (url.protocol !== "https:" || !["t.me","telegram.me","www.t.me","www.telegram.me"].includes(url.hostname) || url.username || url.password || url.port) return "";
    const p = url.pathname.split("/").filter(Boolean);
    if (p[0] === "c" && p.length === 3 && /^\d+$/.test(p[1]) && /^\d+$/.test(p[2])) return `https://t.me/c/${p[1]}/${p[2]}`;
    if (p.length === 2 && /^[A-Za-z][A-Za-z0-9_]{3,31}$/.test(p[0]) && /^\d+$/.test(p[1])) return `https://t.me/${p[0].toLowerCase()}/${p[1]}`;
  } catch {}
  return "";
}
async function lookup(itemId: string) {
  if (!/^[A-Za-z0-9_-]{1,160}$/.test(itemId)) throw new GatewayError("Identificador inválido.", 400, "invalid_item_id");
  const rows = await rest(`catalog_edition_overrides?item_id=eq.${encodeURIComponent(itemId)}&select=edition&limit=1`);
  const edition = rows[0]?.edition;
  if (!edition || String(edition.id) !== itemId) return null;
  const telegramUrl = normalizePost(edition.telegramUrl);
  const size = Number(edition.telegramFileSize);
  const format = String(edition.format || "").toLowerCase();
  if (!telegramUrl || !Number.isSafeInteger(size) || size < 1 || !["pdf","cbz","cbr"].includes(format)) {
    throw new GatewayError("Metadados Telegram incompletos.", 422, "telegram_metadata_invalid");
  }
  const hidden = await rest(`catalog_item_visibility?item_id=eq.${encodeURIComponent(itemId)}&is_hidden=eq.true&select=item_id&limit=1`);
  if (hidden.length) return null;
  if (edition.seriesId) {
    const hiddenSeries = await rest(`catalog_series_visibility?series_id=eq.${encodeURIComponent(String(edition.seriesId))}&is_hidden=eq.true&select=series_id&limit=1`);
    if (hiddenSeries.length) return null;
  }
  return { telegramUrl, size, format };
}

Deno.serve(async request => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (!["GET", "HEAD"].includes(request.method)) return fail("Método não permitido.", 405, "method_not_allowed");
  try {
    const itemId = new URL(request.url).searchParams.get("item_id")?.trim() || "";
    if (!itemId) return fail("Informe item_id.", 400, "missing_item_id");
    const item = await lookup(itemId);
    if (!item) return fail("Edição indisponível.", 404, "edition_unavailable");

    return await redirectToGateway({
      kind: "telegram",
      itemId,
      telegramUrl: item.telegramUrl,
      size: item.size,
      format: item.format,
      telegramApiId: required("TELEGRAM_API_ID"),
      telegramApiHash: required("TELEGRAM_API_HASH"),
      telegramBotToken: required("TELEGRAM_BOT_TOKEN"),
      telegramAllowedChatIds: Deno.env.get("TELEGRAM_ALLOWED_CHAT_IDS") || "-1004424843914"
    }, corsHeaders);
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "Falha ao preparar Telegram.",
      error instanceof GatewayError ? error.status : 502,
      error instanceof GatewayError ? error.code : "telegram_error"
    );
  }
});
