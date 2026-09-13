import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { mergeCatalog, checkSource, inspectEdition } from "./checks.mjs";

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
  const repository = Deno.env.get("GITHUB_REPOSITORY")?.trim() || "Uriel29M/bancadigital";
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

Deno.serve(async request => {
  if (request.method !== "POST") return json({ error: "Método não permitido." }, 405);
  try {
    const secret = request.headers.get("x-link-checker-secret");
    if (!secret) return json({ error: "Não autorizado." }, 401);
    const supabase = createClient(required("SUPABASE_URL"), required("SUPABASE_SERVICE_ROLE_KEY"));
    const claim = await supabase.rpc("claim_link_checker_batch", { p_secret: secret });
    if (claim.error?.code === "42501") return json({ error: "Não autorizado." }, 401);
    if (claim.error) throw claim.error;
    if (!claim.data.lease) return json({ bot: BOT_NAME, ...claim.data });
    const offset = claim.data.offset;
    const overrides = [];
    for (let start = 0; ; start += 1000) {
      const page = await supabase.from("catalog_edition_overrides").select("item_id, edition, updated_at").order("item_id").range(start, start + 999);
      if (page.error) throw page.error;
      overrides.push(...page.data);
      if (page.data.length < 1000) break;
    }
    const library = mergeCatalog(await loadCatalog(), overrides).sort((a, b) => String(a.item.id).localeCompare(String(b.item.id)));
    const batch = library.slice(offset, offset + 20);
    const visibility = batch.length ? await supabase.from("catalog_item_visibility").select("item_id").eq("is_hidden", true).in("item_id", batch.map(entry => entry.item.id)) : { data: [], error: null };
    if (visibility.error) throw visibility.error;
    const hiddenIds = new Set(visibility.data.map(row => row.item_id));
    const counts = { checked: 0, hidden: 0, swapped: 0, uncertain: 0 };
    let cursor = 0;
    let disabled = false;
    const deadline = Date.now() + 75000;
    await Promise.all(Array.from({ length: 4 }, async () => {
      while (cursor < batch.length && !disabled && Date.now() < deadline) {
        const entry = batch[cursor++];
        if (hiddenIds.has(entry.item.id)) continue;
        const result = await inspectEdition(entry.item, (url, item) => Date.now() < deadline
          ? checkSource(url, item, required("SUPABASE_URL"))
          : Promise.resolve({ state: "unknown", reason: "Tempo do lote esgotado" }));
        counts.checked++;
        if (result.uncertain) counts.uncertain++;
        if (result.action === "none") continue;
        const applied = await supabase.rpc("apply_link_checker_result", {
          p_item: entry.item, p_override_updated_at: entry.updatedAt,
          p_action: result.action, p_fallback_url: result.fallbackUrl || null, p_reason: result.reason || "",
          p_fallback_format: result.fallbackFormat || null,
        });
        if (applied.error) throw applied.error;
        if (applied.data === "hidden") counts.hidden++;
        if (applied.data === "swapped") counts.swapped++;
        if (applied.data === "disabled") disabled = true;
      }
    }));
    const nextOffset = offset + cursor < library.length ? offset + cursor : null;
    const finished = await supabase.rpc("finish_link_checker_batch", { p_lease: claim.data.lease, p_next_offset: nextOffset });
    if (finished.error) throw finished.error;
    return json({ bot: BOT_NAME, ...counts, disabled, next_offset: nextOffset });
  } catch (error) {
    console.error(BOT_NAME, error);
    return json({ error: error instanceof Error ? error.message : "Falha no verificador." }, 500);
  }
});
