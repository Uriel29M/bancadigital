import { createClient } from "npm:@supabase/supabase-js@2.57.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store",
};
const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
class MigrationError extends Error {
  constructor(message: string, readonly status = 400, readonly retryAfter?: number) { super(message); }
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

function required(name: string) {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new MigrationError("O serviço de armazenamento no Telegram não está configurado: " + name + ".", 503);
  return value;
}
function serviceDb() {
  return createClient(required("SUPABASE_URL"), required("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
async function requireAdmin(request: Request) {
  const jwt = request.headers.get("Authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!jwt) throw new MigrationError("Entre como administrador.", 401);
  const client = createClient(required("SUPABASE_URL"), required("SUPABASE_ANON_KEY"), {
    global: { headers: { Authorization: "Bearer " + jwt } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user }, error } = await client.auth.getUser(jwt);
  if (error || !user) throw new MigrationError("Sessão inválida ou expirada.", 401);
  const { data: profile, error: profileError } = await client.from("profiles").select("plan").eq("id", user.id).maybeSingle();
  if (profileError || profile?.plan !== "admin") throw new MigrationError("Apenas administradores podem migrar edições.", 403);
  return user;
}
function chatId() {
  return Deno.env.get("TELEGRAM_PAGES_CHAT_ID")?.trim()
    || Deno.env.get("TELEGRAM_RESOLVER_CHAT_ID")?.trim()
    || "-1004424843914";
}
function normalizeTelegramPost(value: unknown) {
  try {
    const url = new URL(String(value || ""));
    if (url.protocol !== "https:" || !["t.me", "telegram.me", "www.t.me", "www.telegram.me"].includes(url.hostname) || url.username || url.password || url.port) return "";
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts[0] === "c" && parts.length === 3 && /^[0-9]+$/.test(parts[1]) && /^[0-9]+$/.test(parts[2])) {
      return "https://t.me/c/" + parts[1] + "/" + parts[2];
    }
    if (parts.length === 2 && /^[A-Za-z][A-Za-z0-9_]{3,31}$/.test(parts[0]) && /^[0-9]+$/.test(parts[1])) {
      return "https://t.me/" + parts[0].toLowerCase() + "/" + parts[1];
    }
  } catch {}
  return "";
}
function migrationSourceUrl(itemId: string) {
  if (!/^[A-Za-z0-9_-]{1,160}$/.test(itemId)) throw new MigrationError("Identificador de edição inválido.");
  // Use o proxy nativo do Supabase/MTProto; o fluxo de migração não depende do Railway.
  const target = new URL("/functions/v1/telegram-proxy", required("SUPABASE_URL"));
  target.searchParams.set("item_id", itemId);
  return target.toString();
}
async function telegram(method: string, body: Record<string, unknown> | FormData) {
  const response = await fetch("https://api.telegram.org/bot" + required("TELEGRAM_BOT_TOKEN") + "/" + method, {
    method: "POST",
    body: body instanceof FormData ? body : JSON.stringify(body),
    headers: body instanceof FormData ? undefined : { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(60000),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.ok) {
    const description = String(data?.description || "O Telegram recusou a operação.");
    const retryAfter = Number(data?.parameters?.retry_after) || undefined;
    throw new MigrationError("Telegram: " + description, response.status === 429 ? 429 : 502, retryAfter);
  }
  return data.result;
}
function validItemId(value: unknown): string {
  const id = String(value || "");
  if (!/^[A-Za-z0-9_-]{1,160}$/.test(id)) throw new MigrationError("Identificador de edição inválido.");
  return id;
}
async function loadEdition(itemId: string, baseEdition?: unknown) {
  const db = serviceDb();
  const { data, error } = await db.from("catalog_edition_overrides")
    .select("item_id,edition,updated_at,created_at").eq("item_id", itemId).maybeSingle();
  if (error) throw new MigrationError("Não foi possível consultar a edição no catálogo.", 502);
  let edition: Record<string, any> = {};
  if (baseEdition && typeof baseEdition === "object" && !Array.isArray(baseEdition)) {
    edition = { ...(baseEdition as Record<string, any>) };
    if (String(edition.id || "") !== itemId) throw new MigrationError("A edição enviada não corresponde ao identificador solicitado.");
  }
  if (data?.edition && String(data.edition.id || "") === itemId) edition = { ...edition, ...data.edition };
  // Um override antigo pode estar incompleto enquanto a fonte ainda existe no
  // catálogo publicado que o cliente enviou. Só preenche campos de origem ausentes.
  if (baseEdition && typeof baseEdition === "object" && !Array.isArray(baseEdition)) {
    const supplied = baseEdition as Record<string, any>;
    for (const field of ["fileUrl", "telegramUrl", "telegramFileId", "telegramFileName", "telegramFileSize", "format"]) {
      const current = edition[field];
      const fallback = supplied[field];
      const missing = current === undefined || current === null || current === ""
        || (field === "telegramFileSize" && !(Number(current) > 0))
        || (field === "format" && String(current).toLowerCase() === "auto" && ["pdf", "cbz", "cbr"].includes(String(fallback || "").toLowerCase()));
      if (missing && fallback !== undefined && fallback !== null && fallback !== "") edition[field] = fallback;
    }
  }
  if (!edition.id) throw new MigrationError("Não foi possível identificar a edição original.");
  if (edition.catalogDeleted === true) throw new MigrationError("Esta edição foi excluída do catálogo.");
  return { db, edition, record: data };
}
async function saveEdition(db: ReturnType<typeof serviceDb>, edition: Record<string, any>, userId: string) {
  const { data, error } = await db.from("catalog_edition_overrides").upsert(
    { item_id: String(edition.id), edition, updated_by: userId },
    { onConflict: "item_id" },
  ).select("item_id,edition,updated_at,created_at").single();
  if (error || !data?.edition || String(data.edition.id) !== String(edition.id)) {
    throw new MigrationError("Não foi possível salvar o progresso da migração no catálogo.", 502);
  }
  return data;
}
function publicPostUrl(chat: any, messageId: number) {
  if (chat?.username) return "https://t.me/" + chat.username + "/" + messageId;
  const rawId = String(chat?.id || chatId());
  if (/^-100\d+$/.test(rawId)) return "https://t.me/c/" + rawId.slice(4) + "/" + messageId;
  return "https://t.me/" + rawId + "/" + messageId;
}
function photoDetails(message: any, pageNumber: number) {
  const sizes = Array.isArray(message?.photo) ? [...message.photo] : [];
  sizes.sort((a, b) => (Number(a.width || 0) * Number(a.height || 0)) - (Number(b.width || 0) * Number(b.height || 0)));
  const best = sizes[sizes.length - 1];
  if (!best?.file_id) throw new MigrationError("O Telegram publicou a mensagem, mas não retornou uma foto utilizável.", 502);
  return {
    index: pageNumber,
    url: publicPostUrl(message.chat, Number(message.message_id)),
    messageId: Number(message.message_id),
    fileId: String(best.file_id),
    fileSize: Number(best.file_size || 0),
    width: Number(best.width || 0),
    height: Number(best.height || 0),
  };
}
function pageCountValue(value: unknown) {
  const count = Number(value);
  if (!Number.isSafeInteger(count) || count < 1 || count > 3000) throw new MigrationError("Quantidade de páginas inválida (limite: 3.000).");
  return count;
}
function jpegLooksValid(bytes: Uint8Array) {
  // Browser-generated JPEG blobs may include a few trailing bytes in some runtimes.
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return false;
  const scanFrom = Math.max(2, bytes.length - 64);
  for (let i = bytes.length - 2; i >= scanFrom; i--) {
    if (bytes[i] === 0xff && bytes[i + 1] === 0xd9) return true;
  }
  return false;
}
async function handle(request: Request) {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (request.method !== "POST") return json({ error: "Método não permitido." }, 405);
  let action = "";
  let itemId = "";
  let uploadDiagnostic: Record<string, unknown> = {};
  try {
    const user = await requireAdmin(request);
    const contentType = request.headers.get("content-type") || "";
    const multipart = contentType.toLowerCase().includes("multipart/form-data");
    const body: any = multipart ? await request.formData() : await request.json();
    const get = (key: string) => multipart ? body.get(key) : body[key];
    action = String(get("action") || "");
    itemId = validItemId(get("item_id"));
    const baseEditionRaw = get("edition");
    let baseEdition: unknown = baseEditionRaw;
    if (typeof baseEditionRaw === "string") {
      try { baseEdition = JSON.parse(baseEditionRaw); } catch { throw new MigrationError("Metadados da edição inválidos."); }
    }
    const loaded = await loadEdition(itemId, baseEdition);
    let edition = loaded.edition;
    if (action === "register") {
      if (Array.isArray(edition.telegramPages) && edition.telegramPages.length) {
        throw new MigrationError("Esta edição já está armazenada como páginas JPEG no Telegram.");
      }
      // Registra o catálogo antes do download: telegram-proxy lê os metadados
      // do Supabase e não consegue resolver uma postagem presente só no catálogo publicado.
      const saved = await saveEdition(loaded.db, edition, user.id);
      return json({ ok: true, registered: true, item_id: itemId, updatedAt: saved.updated_at });
    }
    if (action === "resolve-source") {
      if (Array.isArray(edition.telegramPages) && edition.telegramPages.length) {
        throw new MigrationError("Esta edição já está armazenada como páginas JPEG no Telegram.");
      }
      const telegramUrl = normalizeTelegramPost(edition.telegramUrl);
      if (!telegramUrl) throw new MigrationError("A edição não tem uma postagem válida do Telegram cadastrada.");
      const filename = String(edition.telegramFileName || edition.fileUrl || "").toLowerCase();
      const namedFormat = filename.match(/[.](pdf|cbz|cbr)(?:[?#]|$)/)?.[1] || "";
      const configuredFormat = String(edition.format || "").toLowerCase();
      const format = ["pdf", "cbz", "cbr"].includes(configuredFormat) ? configuredFormat : namedFormat;
      if (!["pdf", "cbz", "cbr"].includes(format)) {
        throw new MigrationError("Não foi possível identificar o formato original no Telegram. Salve o formato PDF, CBZ ou CBR nos dados da edição.");
      }
      const size = Number(edition.telegramFileSize);
      if (!Number.isSafeInteger(size) || size < 1) {
        throw new MigrationError("O Telegram não informou o tamanho do arquivo original. Identifique novamente a postagem antes de migrar.");
      }
      const sourceUrl = migrationSourceUrl(itemId);
      return json({ ok: true, sourceUrl, format, size });
    }
    if (action === "begin") {
      if (Array.isArray(edition.telegramPages) && edition.telegramPages.length) {
        throw new MigrationError("Esta edição já está armazenada como páginas JPEG no Telegram.");
      }
      const count = pageCountValue(get("page_count"));
      const sourceUrl = String(get("source_url") || edition.fileUrl || edition.telegramUrl || "").trim();
      const existingMigration = edition.telegramPagesMigration;
      const existingPending = Array.isArray(edition.telegramPagesPending) ? edition.telegramPagesPending : [];
      if (Number(existingMigration?.pageCount) === count && String(existingMigration?.sourceUrl || "") === sourceUrl) {
        return json({ ok: true, pageCount: count, uploadedPages: existingPending.length, resumed: existingPending.length > 0 });
      }
      edition = { ...edition, telegramPagesPending: [], telegramPagesMigration: {
        pageCount: count, sourceUrl, startedAt: new Date().toISOString(), startedBy: user.id,
      } };
      const saved = await saveEdition(loaded.db, edition, user.id);
      return json({ ok: true, pageCount: count, uploadedPages: 0, updatedAt: saved.updated_at });
    }
    if (action === "upload") {
      const pageNumber = pageCountValue(get("page_number"));
      const migration = edition.telegramPagesMigration;
      const count = pageCountValue(migration?.pageCount);
      if (pageNumber > count) throw new MigrationError("O número desta página ultrapassa o total informado.");
      const pending = Array.isArray(edition.telegramPagesPending) ? edition.telegramPagesPending : [];
      if (pageNumber <= pending.length) return json({ ok: true, page: pending[pageNumber - 1], reused: true });
      if (pageNumber !== pending.length + 1) throw new MigrationError("A ordem de envio foi interrompida. Reinicie a migração desta edição.");
      const file = get("file") as File | Blob | null;
      uploadDiagnostic = {
        pageNumber,
        expectedPages: count,
        fileType: file && typeof (file as any).type === "string" ? String((file as any).type) : "",
        fileSize: file && typeof (file as any).size === "number" ? Number((file as any).size) : null,
        fileTag: Object.prototype.toString.call(file),
      };
      // Avoid realm-sensitive instanceof checks on a FormData-parsed File.
      if (!file || typeof (file as any).arrayBuffer !== "function" || typeof (file as any).size !== "number") {
        throw new MigrationError("A página JPEG não foi recebida como arquivo. Tente novamente.");
      }
      if (!file.size || file.size > MAX_PHOTO_BYTES) throw new MigrationError("Cada JPEG precisa ter até 10 MB.");
      const bytes = new Uint8Array(await file.arrayBuffer());
      uploadDiagnostic.jpegSignature = Array.from(bytes.slice(0, 3)).map(value => value.toString(16).padStart(2, "0")).join("");
      uploadDiagnostic.jpegEnd = Array.from(bytes.slice(-4)).map(value => value.toString(16).padStart(2, "0")).join("");
      if (!jpegLooksValid(bytes)) throw new MigrationError("O arquivo recebido não contém uma estrutura JPEG válida.");
      const form = new FormData();
      form.set("chat_id", chatId());
      form.set("photo", new Blob([bytes], { type: "image/jpeg" }), "pagina-" + String(pageNumber).padStart(4, "0") + ".jpg");
      const title = String(edition.title || edition.seriesTitle || "Quadrinho").replace(/\s+/g, " ").slice(0, 100);
      form.set("caption", title + " · página " + pageNumber + "/" + count);
      form.set("disable_notification", "true");
      const message = await telegram("sendPhoto", form);
      const page = photoDetails(message, pageNumber);
      const nextPending = [...pending, page];
      edition = { ...edition, telegramPagesPending: nextPending };
      const saved = await saveEdition(loaded.db, edition, user.id);
      return json({ ok: true, page: {
        index: page.index, url: page.url, fileSize: page.fileSize, width: page.width, height: page.height,
      }, uploaded: nextPending.length, pageCount: count, updatedAt: saved.updated_at });
    }
    if (action === "complete") {
      const count = pageCountValue(get("page_count"));
      const migration = edition.telegramPagesMigration;
      const expected = pageCountValue(migration?.pageCount);
      const pending = Array.isArray(edition.telegramPagesPending) ? edition.telegramPagesPending : [];
      if (count !== expected || pending.length !== expected) {
        throw new MigrationError("A migração ainda não tem todas as páginas. Enviadas: " + pending.length + "/" + expected + ".");
      }
      const ordered = pending.slice().sort((a: any, b: any) => Number(a.index) - Number(b.index));
      if (ordered.some((page: any, index: number) => Number(page.index) !== index + 1 || !page.fileId || !page.url)) {
        throw new MigrationError("A ordem das páginas no Telegram não foi confirmada. Reinicie a migração.");
      }
      const oldBackups = Array.isArray(edition.backupUrls) ? edition.backupUrls : [];
      // Usa também o link capturado no início da migração: um override antigo
      // pode estar sem a URL, mesmo que ela exista no catálogo publicado.
      const originalLinks = [migration?.sourceUrl, edition.fileUrl, edition.telegramUrl]
        .map((value: unknown) => String(value || "").trim())
        .filter((value: string) => /^https?:\/\//i.test(value));
      const backupUrls = [...new Set([...oldBackups, ...originalLinks].map((value: unknown) => String(value || "").trim()).filter((value: string) => /^https?:\/\//i.test(value)))];
      const telegramPages = ordered.map((page: any) => ({
        index: page.index, url: page.url, width: page.width, height: page.height, fileSize: page.fileSize,
      }));
      const telegramPageFiles = ordered.map((page: any) => ({
        index: page.index, url: page.url, messageId: page.messageId, fileId: page.fileId,
        fileSize: page.fileSize, width: page.width, height: page.height,
      }));
      edition = {
        ...edition,
        fileUrl: "",
        telegramUrl: "",
        telegramFileId: "",
        telegramFileName: "",
        telegramFileSize: 0,
        format: "telegram-pages",
        backupUrls,
        telegramPages,
        telegramPageFiles,
      };
      delete edition.telegramPagesPending;
      delete edition.telegramPagesMigration;
      const saved = await saveEdition(loaded.db, edition, user.id);
      return json({ ok: true, edition: saved.edition, updatedAt: saved.updated_at, pageCount: telegramPages.length });
    }
    throw new MigrationError("Ação de migração desconhecida.");
  } catch (error) {
    const status = error instanceof MigrationError ? error.status : 500;
    const retryAfter = error instanceof MigrationError ? error.retryAfter : undefined;
    if (status >= 500 || !(error instanceof MigrationError)) console.error("telegram-page-migration", error);
    else if (action === "upload") console.warn("[telegram-page-migration] upload recusado", {
      itemId, status, message: error instanceof Error ? error.message : String(error), ...uploadDiagnostic,
    });
    return json({
      error: error instanceof Error ? error.message : "Falha na migração para o Telegram.",
      ...(retryAfter ? { retry_after: retryAfter } : {}),
    }, status);
  }
}
Deno.serve(handle);
