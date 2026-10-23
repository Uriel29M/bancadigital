import { createClient } from "npm:@supabase/supabase-js@2.57.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type, range",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Expose-Headers": "Content-Length, Content-Type",
  "Cache-Control": "public, max-age=900, s-maxage=900",
  "X-Content-Type-Options": "nosniff",
};
class PageError extends Error { constructor(message: string, readonly status = 502) { super(message); } }
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });
function required(name: string) {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new PageError("O serviço de imagens do Telegram não está configurado.", 503);
  return value;
}
const db = () => createClient(required("SUPABASE_URL"), required("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false, autoRefreshToken: false },
});
function itemIdValue(value: string | null) {
  if (!value || !/^[A-Za-z0-9_-]{1,160}$/.test(value)) throw new PageError("Identificador da edição inválido.", 400);
  return value;
}
async function lookup(itemId: string, pageNumber: number) {
  const client = db();
  const { data: row, error } = await client.from("catalog_edition_overrides").select("edition").eq("item_id", itemId).maybeSingle();
  if (error) throw new PageError("Não foi possível consultar a edição.", 502);
  const edition = row?.edition;
  if (!edition || String(edition.id || "") !== itemId || edition.format !== "telegram-pages") throw new PageError("Edição indisponível.", 404);
  const pages = Array.isArray(edition.telegramPageFiles) ? edition.telegramPageFiles : [];
  const page = pages[pageNumber - 1];
  if (!page || Number(page.index) !== pageNumber || !/^[A-Za-z0-9_-]{8,1024}$/.test(String(page.fileId || ""))) {
    throw new PageError("Página não encontrada.", 404);
  }
  const { data: hidden, error: hiddenError } = await client.from("catalog_item_visibility")
    .select("item_id").eq("item_id", itemId).eq("is_hidden", true).maybeSingle();
  if (hiddenError) throw new PageError("Não foi possível validar a visibilidade da edição.", 502);
  if (hidden) throw new PageError("Edição indisponível.", 404);
  if (edition.seriesId) {
    const { data: hiddenSeries, error: seriesError } = await client.from("catalog_series_visibility")
      .select("series_id").eq("series_id", String(edition.seriesId)).eq("is_hidden", true).maybeSingle();
    if (seriesError) throw new PageError("Não foi possível validar a visibilidade da série.", 502);
    if (hiddenSeries) throw new PageError("Edição indisponível.", 404);
  }
  return { page };
}
async function sendToTelegram(fileId: string) {
  const token = required("TELEGRAM_BOT_TOKEN");
  const fileResponse = await fetch("https://api.telegram.org/bot" + token + "/getFile", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ file_id: fileId }),
    signal: AbortSignal.timeout(15000),
  });
  const fileJson = await fileResponse.json().catch(() => null);
  if (!fileResponse.ok || !fileJson?.ok) throw new PageError("O Telegram não conseguiu localizar esta página.", 502);
  const filePath = String(fileJson.result?.file_path || "");
  const size = Number(fileJson.result?.file_size || 0);
  if (!/^[A-Za-z0-9_./-]+$/.test(filePath) || filePath.includes("..")) throw new PageError("Caminho de imagem inválido.", 502);
  if (size > 10 * 1024 * 1024) throw new PageError("A imagem excede o limite aceito pelo leitor.", 413);
  const response = await fetch("https://api.telegram.org/file/bot" + token + "/" + filePath, { signal: AbortSignal.timeout(45000) });
  if (!response.ok || !response.body) throw new PageError("Não foi possível baixar a página do Telegram.", 502);
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > 10 * 1024 * 1024) {
        await reader.cancel();
        throw new PageError("A imagem excede o limite aceito pelo leitor.", 413);
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[bytes.length - 2] !== 0xff || bytes[bytes.length - 1] !== 0xd9) {
    throw new PageError("O Telegram não retornou uma imagem JPEG válida.", 502);
  }
  return bytes;
}
async function handler(request: Request) {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (request.method !== "GET" && request.method !== "HEAD") return json({ error: "Método não permitido." }, 405);
  try {
    const url = new URL(request.url);
    const itemId = itemIdValue(url.searchParams.get("item_id"));
    const pageNumber = Number(url.searchParams.get("page"));
    if (!Number.isSafeInteger(pageNumber) || pageNumber < 1 || pageNumber > 3000) throw new PageError("Número de página inválido.", 400);
    const { page } = await lookup(itemId, pageNumber);
    if (request.method === "HEAD") return new Response(null, {
      status: 200, headers: { ...cors, "Content-Type": "image/jpeg", ...(Number(page.fileSize) > 0 ? { "Content-Length": String(page.fileSize) } : {}) },
    });
    const bytes = await sendToTelegram(String(page.fileId));
    return new Response(bytes, {
      status: 200,
      headers: { ...cors, "Content-Type": "image/jpeg", "Content-Length": String(bytes.byteLength) },
    });
  } catch (error) {
    const status = error instanceof PageError ? error.status : 502;
    if (status >= 500 || !(error instanceof PageError)) console.error("telegram-page-image", error);
    return json({ error: error instanceof Error ? error.message : "Falha ao carregar a página." }, status);
  }
}
Deno.serve(handler);
