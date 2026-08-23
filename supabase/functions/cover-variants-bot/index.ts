import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function required(name: string) {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`Missing Supabase secret: ${name}`);
  return value;
}

type Source = { name: string; url: string };

function sourcesFromEnvironment(): Source[] {
  const raw = Deno.env.get("COVER_VARIANT_SOURCES")?.trim() || "[]";
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw new Error("COVER_VARIANT_SOURCES must be a JSON array");
  return parsed.filter(item => item && typeof item.name === "string" && typeof item.url === "string").slice(0, 10);
}

function expandTemplate(template: string, item: Record<string, unknown>) {
  const seriesText = String(item.originalTitle || item.seriesTitle || item.title || "").trim();
  const issueText = String(item.issue || "").trim();
  const issueNumber = issueText.match(/\d+/)?.[0]?.replace(/^0+(?=\d)/, "") || issueText;
  const values: Record<string, string> = {
    item_id: String(item.id || ""),
    series: seriesText,
    issue: issueText,
    series_slug: seriesText.replace(/\s+/g, "_"),
    issue_number: issueNumber,
    publisher: String(item.publisher || ""),
  };
  return template.replace(/\{(item_id|series|issue|series_slug|issue_number|publisher)\}/g, (_, key) => encodeURIComponent(values[key]));
}

function normalizeUrl(value: string, base: string) {
  try {
    const url = new URL(value, base);
    return url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

function imageKey(value: string) {
  let key = value.trim().split(/[?#]/, 1)[0];
  try { key = decodeURIComponent(key); } catch {}
  key = key.replace(/\/Special:FilePath\//i, "/images/");
  key = key.replace(/\/images\/thumb\/([^/]+\/[^/]+)\/[^/]+\/(?:\d+px-)?(.+)$/i, "/images/$1/$2");
  return key.replace(/\/+$/, "").toLowerCase();
}

function imageFileKey(value: string) {
  let key = imageKey(value).split("/").pop() || "";
  key = key.replace(/^\d+px[-_]/i, "");
  return key.replace(/[^a-z0-9]+/gi, "").toLowerCase();
}

function imageKeys(value: string) {
  const full = imageKey(value);
  const file = imageFileKey(value);
  return file ? [full, `file:${file}`] : [full];
}

function creatorKey(value: string) {
  let key = String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  key = key.replace(/\([^)]*\)/g, "").split(/\s[-–—]\s/)[0];
  key = key.replace(/\b(?:variante|variant|cover|capa|card stock|foil|sketch|blank|design|preto e branco|black and white|dc pride|homenagem)\b.*$/i, "");
  return key.replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

function canonicalImageUrl(url: string) {
  return url.replace(/\/images\/thumb\/([^/]+\/[^/]+)\/[^/]+\/(?:\d+px-)?(.+)$/i, "/images/$1/$2");
}

async function verifyImage(url: string) {
  try {
    const response = await fetchWithTimeout(url, { method: "HEAD", redirect: "follow", headers: { Accept: "image/*,*/*;q=0.5" } }, 8000);
    const contentType = response.headers.get("content-type") || "";
    if (response.ok && contentType.toLowerCase().startsWith("image/")) return { ok: true, contentType };
    if (!response.ok && response.status !== 405) return { ok: false, reason: `HTTP ${response.status}` };
    const fallback = await fetchWithTimeout(url, { headers: { Accept: "image/*,*/*;q=0.5" }, redirect: "follow" }, 8000);
    const fallbackType = fallback.headers.get("content-type") || "";
    return fallback.ok && fallbackType.toLowerCase().startsWith("image/")
      ? { ok: true, contentType: fallbackType }
      : { ok: false, reason: `content-type ${fallbackType || "ausente"}` };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : "falha de rede" };
  }
}

async function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = 10000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function extractImages(html: string, baseUrl: string) {
  const values = new Map<string, { url: string; label: string }>();
  const attributes = /(?:src|data-src|data-lazy-src|data-original|content|href)=["']([^"']+)["']/gi;
  const srcset = /(?:srcset|data-srcset)=["']([^"']+)["']/gi;
  const add = (raw: string, label = "") => {
    const candidate = raw.trim().split(/\s+/)[0];
    if (!/(?:jpe?g|png|webp)(?:[?#]|$)/i.test(candidate)) return;
    if (/(?:logo|favicon|icon|avatar|banner|sprite|button|badge)/i.test(candidate)) return;
    const normalized = normalizeUrl(candidate, baseUrl);
    if (normalized) {
      const url = canonicalImageUrl(normalized);
      const key = imageKey(url);
      if (!values.has(key) || label) values.set(key, { url, label });
    }
  };
  const figure = /<figure[\s\S]*?<img[^>]+src=["']([^"']+)["'][^>]*>[\s\S]*?<figcaption[^>]*>([\s\S]*?)<\/figcaption>[\s\S]*?<\/figure>/gi;
  for (const match of html.matchAll(figure)) {
    const credits = [...match[2].matchAll(/(?:Art|Pencils|Inks):[\s\S]*?<a[^>]*>(?:<b>)?([^<]+)(?:<\/b>)?<\/a>/gi)].map(entry => entry[1].trim());
    add(match[1], [...new Set(credits)].join(" e "));
    if (values.size >= 24) break;
  }
  for (const match of html.matchAll(attributes)) {
    add(match[1]);
    if (values.size >= 24) break;
  }
  if (values.size < 24) {
    for (const match of html.matchAll(srcset)) {
      for (const candidate of match[1].split(',')) add(candidate);
      if (values.size >= 24) break;
    }
  }
  return [...values.values()].slice(0, 24);
}

Deno.serve(async request => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const authorization = request.headers.get("Authorization");
    if (!authorization) return json({ error: "Authentication required" }, 401);
    const authClient = createClient(required("SUPABASE_URL"), required("SUPABASE_ANON_KEY"), { global: { headers: { Authorization: authorization } } });
    const { data: { user }, error: userError } = await authClient.auth.getUser();
    if (userError || !user) return json({ error: "Invalid session" }, 401);
    const { data: profile, error: profileError } = await authClient.from("profiles").select("plan").eq("id", user.id).maybeSingle();
    if (profileError) throw profileError;
    if (profile?.plan !== "admin") return json({ error: "Only administrators can manage cover variants" }, 403);

    const service = createClient(required("SUPABASE_URL"), required("SUPABASE_SERVICE_ROLE_KEY"));
    const payload = await request.json().catch(() => ({}));
    if (payload.action === "remove_bot_variants") {
      const itemId = String(payload.item_id || "").trim();
      if (!itemId) return json({ error: "Send item_id to remove bot variants" }, 400);
      const removed = await service.from("comic_cover_variants")
        .delete()
        .eq("item_id", itemId)
        .like("variant_key", "bot-%")
        .select("variant_key");
      if (removed.error) throw removed.error;
      return json({ ok: true, removed: removed.data?.length || 0 });
    }
    if (payload.action === "remove_variant") {
      const itemId = String(payload.item_id || "").trim();
      const variantKey = String(payload.variant_key || "").trim();
      if (!itemId || !variantKey || variantKey === "__default") return json({ error: "Invalid variant removal request" }, 400);
      const removed = await service.from("comic_cover_variants")
        .delete()
        .eq("item_id", itemId)
        .eq("variant_key", variantKey)
        .select("variant_key");
      if (removed.error) throw removed.error;
      return json({ ok: true, removed: removed.data?.length || 0 });
    }
    if (payload.action === "approve_variant") {
      const actionId = Number(payload.action_id);
      if (!Number.isInteger(actionId) || actionId < 1) return json({ error: "Invalid bot action" }, 400);
      const actionResult = await service.from("bot_actions").select("id, action, status, metadata").eq("id", actionId).maybeSingle();
      if (actionResult.error) throw actionResult.error;
      const action = actionResult.data;
      if (!action || action.action !== "cover_variant_candidate") return json({ error: "Cover candidate not found" }, 404);
      if (action.status !== "pending") return json({ error: "This candidate was already reviewed" }, 409);
      const metadata = action.metadata || {};
      const itemId = String(metadata.item_id || "").trim();
      const variantKey = String(metadata.variant_key || "").trim();
      const label = String(metadata.label || metadata.creator || "").trim();
      const coverUrl = String(metadata.cover_url || "").trim();
      const sourceUrl = String(metadata.source_url || "").trim();
      if (!itemId || !variantKey || !label || !coverUrl.startsWith("https://")) return json({ error: "Invalid cover candidate" }, 400);
      const existing = await service.from("comic_cover_variants").select("item_id, variant_key, label, cover_url").eq("item_id", itemId);
      if (existing.error) throw existing.error;
      const candidateKeys = imageKeys(coverUrl);
      const primaryKeys = imageKeys(String(payload.primary_cover_url || metadata.primary_cover_url || ""));
      const candidateCreator = creatorKey(label);
      const duplicate = (existing.data || []).some(row =>
        imageKeys(String(row.cover_url || "")).some(key => candidateKeys.includes(key)) ||
        (candidateCreator && candidateCreator === creatorKey(String(row.label || "")))
      ) || candidateKeys.some(key => primaryKeys.includes(key));
      if (duplicate) {
        await service.from("bot_actions").update({ status: "rejected", reviewed_by: user.id, reviewed_at: new Date().toISOString() }).eq("id", actionId);
        return json({ ok: true, duplicate: true, inserted: false });
      }
      const inserted = await service.from("comic_cover_variants").insert({ item_id: itemId, variant_key: variantKey, label: label.slice(0, 80), cover_url: coverUrl, source_url: sourceUrl || null });
      if (inserted.error) {
        if (inserted.error.code === "23505") return json({ ok: true, duplicate: true, inserted: false });
        throw inserted.error;
      }
      await service.from("bot_actions").update({ status: "approved", reviewed_by: user.id, reviewed_at: new Date().toISOString() }).eq("id", actionId);
      return json({ ok: true, duplicate: false, inserted: true });
    }
    const items = Array.isArray(payload.items) ? payload.items.filter((item: unknown) => item && typeof item === "object") as Record<string, unknown>[] : [];
    if (!items.length) return json({ error: "Send the catalog items in payload.items" }, 400);
    const sources = sourcesFromEnvironment();
    await service.from("bot_actions").delete()
      .eq("bot_name", "cover-variants-bot")
      .eq("action", "cover_variant_candidate")
      .eq("status", "pending")
      .ilike("metadata->>cover_url", "%logo%");
    const oldCandidates = await service.from("bot_actions").select("id, metadata")
      .eq("bot_name", "cover-variants-bot")
      .eq("action", "cover_variant_candidate")
      .eq("status", "pending");
    const withoutCreator = (oldCandidates.data || [])
      .filter(row => !String(row.metadata?.creator || "").trim())
      .map(row => row.id);
    if (withoutCreator.length) await service.from("bot_actions").delete().in("id", withoutCreator);
    const candidates: unknown[] = [];
    const existing = await service.from("comic_cover_variants").select("item_id, variant_key, label, cover_url");
    if (existing.error) throw existing.error;
    const known = new Set((existing.data || []).map(row => `${row.item_id}:${row.variant_key}`));
    const knownImages = new Set<string>();
    const knownCreators = new Set<string>();
    const rememberImage = (itemId: unknown, coverUrl: unknown) => {
      if (!itemId || !coverUrl) return;
      for (const key of imageKeys(String(coverUrl))) knownImages.add(`${itemId}:${key}`);
    };
    for (const row of existing.data || []) rememberImage(row.item_id, row.cover_url);
    for (const row of existing.data || []) {
      const key = creatorKey(String(row.label || ""));
      if (row.item_id && key) knownCreators.add(`${row.item_id}:${key}`);
    }
    for (const item of items) rememberImage(item.id, item.coverUrl);
    const pending = await service.from("bot_actions").select("id, metadata").eq("bot_name", "cover-variants-bot").eq("action", "cover_variant_candidate").eq("status", "pending");
    if (pending.error) throw pending.error;
    const duplicatePendingIds: number[] = [];
    for (const row of pending.data || []) {
      const itemId = row.metadata?.item_id;
      const coverUrl = row.metadata?.cover_url;
      const creator = creatorKey(String(row.metadata?.creator || row.metadata?.label || ""));
      const identities = imageKeys(String(coverUrl || "")).map(key => `${itemId}:${key}`);
      if (identities.some(key => knownImages.has(key)) || (creator && knownCreators.has(`${itemId}:${creator}`))) duplicatePendingIds.push(row.id);
      else {
        rememberImage(itemId, coverUrl);
        if (creator) knownCreators.add(`${itemId}:${creator}`);
      }
    }
    if (duplicatePendingIds.length) await service.from("bot_actions").delete().in("id", duplicatePendingIds);
    const failedSources = new Map<string, number>();

    const scanLimit = 10;
    for (const item of items.slice(0, scanLimit)) {
      if (!item.id) continue;
      for (const source of sources) {
        const sourceUrl = expandTemplate(source.url, item);
        let page: Response;
        try {
          page = await fetchWithTimeout(sourceUrl, { headers: { Accept: "text/html,application/xhtml+xml", "User-Agent": "Mozilla/5.0 (compatible; CoverVariantsBot/1.0)" }, redirect: "follow" });
        } catch {
          failedSources.set(source.name, (failedSources.get(source.name) || 0) + 1);
          continue;
        }
        if (!page.ok) {
          failedSources.set(source.name, (failedSources.get(source.name) || 0) + 1);
          continue;
        }
        let html = "";
        try {
          html = await page.text();
        } catch {
          failedSources.set(source.name, (failedSources.get(source.name) || 0) + 1);
          continue;
        }
        const images = extractImages(html, sourceUrl);
        for (const image of images) {
          const coverUrl = image.url;
          if (source.name.toLowerCase().includes("dcu guide") && !/cover[_%20-]*[b-z]/i.test(new URL(coverUrl).pathname)) continue;
          if (!image.label) continue;
          const candidateCreator = creatorKey(image.label);
          if (!candidateCreator || knownCreators.has(`${item.id}:${candidateCreator}`)) continue;
          const checked = await verifyImage(coverUrl);
          if (!checked.ok) continue;
          const imageIdentity = imageKeys(coverUrl).map(key => `${item.id}:${key}`);
          if (imageIdentity.some(key => knownImages.has(key))) continue;
          const variantKey = `bot-${btoa(coverUrl).replace(/[^a-z0-9]/gi, "").slice(0, 48).toLowerCase()}`;
          if (known.has(`${item.id}:${variantKey}`)) continue;
          known.add(`${item.id}:${variantKey}`);
          imageIdentity.forEach(key => knownImages.add(key));
          knownCreators.add(`${item.id}:${candidateCreator}`);
          candidates.push({ item_id: item.id, variant_key: variantKey, label: image.label || `${source.name} · criador não identificado`, creator: image.label || null, cover_url: coverUrl, source_url: sourceUrl, content_type: checked.contentType });
        }
      }
    }

    if (candidates.length) {
      const rows = candidates.map(candidate => ({ bot_name: "cover-variants-bot", action: "cover_variant_candidate", title: `Capa candidata para ${candidate.item_id}`, body: "A imagem respondeu como arquivo de imagem e aguarda aprovação manual.", metadata: candidate }));
      const inserted = await service.from("bot_actions").insert(rows);
      if (inserted.error) throw inserted.error;
    }
    return json({ ok: true, scanned: Math.min(items.length, scanLimit), total_items: items.length, truncated: items.length > scanLimit, candidates: candidates.length, sources: sources.length, failed_sources: Object.fromEntries(failedSources) });
  } catch (error) {
    console.error("cover-variants-bot", error);
    return json({ error: error instanceof Error ? error.message : "Cover bot failed" }, 500);
  }
});
