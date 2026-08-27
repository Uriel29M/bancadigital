import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const BOT_NAME = "link-checker-bot";
const MAX_ITEMS = 10000;
const timeoutMs = 10000;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function required(name: string) {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`Missing Supabase secret: ${name}`);
  return value;
}

function catalogFiles() {
  const raw = Deno.env.get("CATALOG_FILES")?.trim()
    || "js/data.js,js/data/dc-comics/recentes.js,js/data/dc-comics/black-label.js";
  return raw.split(",").map(value => value.trim()).filter(Boolean);
}

function rawCatalogBase() {
  const explicit = Deno.env.get("CATALOG_BASE_URL")?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  const repository = required("GITHUB_REPOSITORY");
  const branch = Deno.env.get("GITHUB_BRANCH")?.trim() || "main";
  return `https://raw.githubusercontent.com/${repository}/${branch}`;
}

async function fetchText(url: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { Accept: "text/javascript,*/*" } });
    if (!response.ok) throw new Error(`Catálogo respondeu HTTP ${response.status}`);
    return await response.text();
  } finally { clearTimeout(timer); }
}

async function loadCatalog() {
  const catalogWindow: Record<string, unknown> = {};
  for (const file of catalogFiles()) {
    const source = await fetchText(`${rawCatalogBase()}/${file.replace(/^\//, "")}`);
    // Os arquivos do catálogo são IIFEs de dados, sem acesso a DOM ou usuário.
    new Function("window", source)(catalogWindow);
  }
  const library = Array.isArray(catalogWindow.DEFAULT_LIBRARY) ? catalogWindow.DEFAULT_LIBRARY : [];
  return library.slice(0, MAX_ITEMS) as Record<string, unknown>[];
}

function urlsFor(item: Record<string, unknown>) {
  return [...new Set([
    item.fileUrl,
    ...(Array.isArray(item.backupUrls) ? item.backupUrls : []),
    item.telegramUrl,
  ].map(value => String(value || "").trim()).filter(value => /^https?:\/\//i.test(value)))];
}

async function checkUrl(url: string) {
  const attempt = async (method: string) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, { method, redirect: "follow", signal: controller.signal, headers: { "User-Agent": "BancaDigitalLinkChecker/1.0", Accept: "*/*" } });
    } finally { clearTimeout(timer); }
  };
  try {
    let response = await attempt("HEAD");
    if (response.status === 405 || response.status === 403) response = await attempt("GET");
    if (response.ok) return { ok: true, status: response.status, finalUrl: response.url };
    return { ok: false, reason: `HTTP ${response.status}`, status: response.status, finalUrl: response.url };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : "falha de rede" };
  }
}

function snapshot(item: Record<string, unknown>, url: string) {
  return {
    id: String(item.id || url), title: String(item.title || "Edição sem título"),
    seriesTitle: item.seriesTitle || "", seriesId: item.seriesId || "", issue: item.issue || "",
    format: item.format || "", fileUrl: String(item.fileUrl || ""),
    backupUrls: Array.isArray(item.backupUrls) ? item.backupUrls : [], failedUrl: url,
  };
}

Deno.serve(async request => {
  if (request.method !== "POST") return json({ error: "Método não permitido." }, 405);
  const expected = required("LINK_CHECKER_SECRET");
  if (request.headers.get("x-link-checker-secret") !== expected) return json({ error: "Não autorizado." }, 401);
  try {
    const supabase = createClient(required("SUPABASE_URL"), required("SUPABASE_SERVICE_ROLE_KEY"));
    const library = await loadCatalog();
    const checked: string[] = [];
    const broken: Array<Record<string, unknown>> = [];
    for (const item of library) {
      for (const url of urlsFor(item)) {
        const result = await checkUrl(url);
        checked.push(url);
        if (!result.ok) broken.push({ item, url, result });
      }
    }
    let created = 0;
    for (const entry of broken) {
      const item = entry.item as Record<string, unknown>;
      const url = String(entry.url);
      const itemId = String(item.id || url);
      const result = entry.result as Record<string, unknown>;
      const reason = `Bot: link indisponível (${String(result.reason || "erro desconhecido")}) — ${url}`.slice(0, 500);
      const insert = await supabase.from("file_reports").insert({
        item_id: itemId, reporter_id: null, source: "bot", bot_name: BOT_NAME,
        item_snapshot: snapshot(item, url), reason, status: "pending",
      });
      if (!insert.error) created++;
      else if (insert.error.code !== "23505") console.error("file_reports insert", insert.error);
    }
    return json({ bot: BOT_NAME, checked: checked.length, broken: broken.length, created });
  } catch (error) {
    console.error(BOT_NAME, error);
    return json({ error: error instanceof Error ? error.message : "Falha no verificador." }, 500);
  }
});
