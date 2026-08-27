import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-series-monitor-secret",
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

function normalizeUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return null;
    url.hash = "";
    url.pathname = url.pathname.replace(/\/+$/, "");
    return url.href;
  } catch { return null; }
}

function issueFromText(value: string) {
  const text = String(value || "").replace(/%23/gi, "#");
  const match = text.match(/(?:#|(?:edi(?:c|ç)ão|issue|n(?:º|o)?)[ _.-]*)(\d{1,3})(?!\d)/i)
    || text.match(/(?:^|[^\d])0*(\d{1,3})(?:[^\d]|$)/);
  return match?.[1] ? String(Number(match[1])) : null;
}

function issueFromFilename(value: string) {
  const filename = decodeURIComponent(String(value || "").split("/").pop() || "");
  const seriesPattern = filename.match(/(?:\(|\s|[-_])0*(\d{1,3})-0{2,3}(?:[-_.\s]|$)/i);
  if (seriesPattern?.[1]) return String(Number(seriesPattern[1]));
  const padded = filename.match(/(?:^|[-_\s])0+(\d{1,3})(?=[-_.\s]|$)/i);
  return padded?.[1] ? String(Number(padded[1])) : null;
}

function isMediafire(url: URL) {
  return /(?:^|\.)mediafire\.com$/i.test(url.hostname);
}

function isShortMediafireFileUrl(url: URL) {
  return isMediafire(url) && /^\/file\/[^/]+\/?$/i.test(url.pathname);
}

function decodeHtmlAttribute(value: string) {
  return String(value || "")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x2f;/gi, "/")
    .replace(/&#x3a;/gi, ":");
}

function mediafireCanonicalUrl(html: string, pageUrl: URL) {
  const fileId = pageUrl.pathname.match(/^\/file\/([^/]+)/i)?.[1]?.toLowerCase();
  if (!fileId) return null;
  const candidates: string[] = [];
  for (const match of html.matchAll(/<(?:link|meta)\b[^>]*>/gi)) {
    const tag = match[0];
    const rel = tag.match(/\brel=["']([^"']+)["']/i)?.[1] || "";
    const property = tag.match(/\b(?:property|name)=["']([^"']+)["']/i)?.[1] || "";
    const value = /canonical/i.test(rel) ? tag.match(/\bhref=["']([^"']+)["']/i)?.[1]
      : /^(?:og:url|twitter:url)$/i.test(property) ? tag.match(/\bcontent=["']([^"']+)["']/i)?.[1]
      : null;
    if (value) candidates.push(decodeHtmlAttribute(value));
  }
  for (const match of html.matchAll(/https?:\/\/(?:www\.)?mediafire\.com\/file\/[^\s"'<>]+/gi)) {
    candidates.push(decodeHtmlAttribute(match[0]));
  }
  for (const candidate of candidates) {
    try {
      const url = new URL(candidate, pageUrl);
      const candidateId = url.pathname.match(/^\/file\/([^/]+)/i)?.[1]?.toLowerCase();
      if (isMediafire(url) && candidateId === fileId && url.pathname.split("/").filter(Boolean).length >= 3) {
        return url.href;
      }
    } catch { /* metadata inválida */ }
  }
  return null;
}

function mediafireIdentity(value: string) {
  try {
    const url = new URL(value);
    return isMediafire(url) ? url.pathname.match(/^\/file\/([^/]+)/i)?.[1]?.toLowerCase() || null : null;
  } catch { return null; }
}

async function expandMediafireFileUrl(url: URL) {
  if (!isShortMediafireFileUrl(url)) return url.href;
  try {
    const response = await fetchWithTimeout(url.href, 10000);
    if (!response.ok) return url.href;
    return mediafireCanonicalUrl(await response.text(), url) || url.href;
  } catch {
    return url.href;
  }
}

function extractCoverUrl(anchorHtml: string, sourceUrl: string) {
  const image = anchorHtml.match(/<img\b[^>]*\b(?:data-src|data-original|src)=["']([^"']+)["']/i);
  if (!image?.[1]) return "";
  try {
    const url = new URL(image[1].replace(/&amp;/gi, "&"), sourceUrl);
    return /^https?:$/.test(url.protocol) && !/(?:mediafire\.com|mega\.nz)$/i.test(url.hostname) ? url.href : "";
  } catch { return ""; }
}

async function extractLinks(html: string, sourceUrl: string) {
  const found = new Map<string, { fileUrl: string; issue: string | null; anchor: string; coverUrl: string }>();
  const anchors = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(anchors)) {
    const raw = match[1].replace(/&amp;/g, "&");
    let url: URL;
    try { url = new URL(raw, sourceUrl); } catch { continue; }
    if (!/^https?:$/.test(url.protocol) || !/(?:mediafire\.com|mega\.nz)$/i.test(url.hostname)) continue;
    if (isShortMediafireFileUrl(url)) url = new URL(await expandMediafireFileUrl(url));
    const fileUrl = normalizeUrl(url.href);
    if (!fileUrl) continue;
    const coverUrl = extractCoverUrl(match[0], sourceUrl);
    const anchor = String(match[2]).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const context = `${anchor} ${match[0]} ${url.pathname} ${url.search}`;
    const issue = issueFromFilename(url.pathname) || issueFromText(context);
    found.set(fileUrl, { fileUrl, issue, anchor, coverUrl });
  }
  return [...found.values()];
}

async function fetchWithTimeout(url: string, timeoutMs = 20000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal, redirect: "follow", headers: { Accept: "text/html,application/xhtml+xml", "User-Agent": "BancaDigitalSeriesMonitor/1.0" } });
  } finally { clearTimeout(timeout); }
}

async function isAdmin(request: Request) {
  const authorization = request.headers.get("Authorization");
  if (!authorization) return false;
  const auth = createClient(required("SUPABASE_URL"), required("SUPABASE_ANON_KEY"), { global: { headers: { Authorization: authorization } } });
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return false;
  const { data: profile } = await auth.from("profiles").select("plan").eq("id", user.id).maybeSingle();
  return profile?.plan === "admin";
}

async function catalogItems() {
  const repository = required("GITHUB_REPOSITORY");
  const branch = Deno.env.get("GITHUB_BRANCH")?.trim() || "main";
  const path = Deno.env.get("GITHUB_CATALOG_PATH")?.trim() || "js/data/dc-comics/recentes.js";
  const rawUrl = `https://raw.githubusercontent.com/${repository}/${encodeURIComponent(branch)}/${path.split("/").map(encodeURIComponent).join("/")}`;
  const response = await fetch(rawUrl, { headers: { Accept: "text/plain" } });
  if (!response.ok) throw new Error(`Catalog read failed with HTTP ${response.status}`);
  const source = await response.text();
  if (!/window\.DEFAULT_LIBRARY\s*=/.test(source)) throw new Error("Could not read the published catalog");
  return source;
}

async function scan(service: ReturnType<typeof createClient>) {
  const { data: sources, error } = await service.from("series_link_sources").select("id, series_id, source_url, provider").eq("enabled", true);
  if (error) throw error;
  const catalogSource = await catalogItems();
  const knownUrls = new Set([...catalogSource.matchAll(/https:\/\/[^\"'\s]+/gi)].map(match => normalizeUrl(match[0])).filter(Boolean));
  const knownMediafireIds = new Set([...catalogSource.matchAll(/(?:mediafire\.com\/file\/|[\"'])([a-z0-9]{12,})(?:[\"'\/])/gi)].map(match => match[1].toLowerCase()));
  const isKnown = (url: string, normalized: string) => {
    if (knownUrls.has(normalized)) return true;
    try {
      const parsed = new URL(url);
      const mediafireId = parsed.hostname.includes("mediafire.com") ? parsed.pathname.match(/\/file\/([^/]+)/i)?.[1]?.toLowerCase() : null;
      return Boolean(mediafireId && knownMediafireIds.has(mediafireId));
    } catch { return false; }
  };
  let discovered = 0;
  let sourceLinks = 0;
  let numberedLinks = 0;
  let unidentifiedLinks = 0;
  const missingIssues: Record<string, string[]> = {};
  const catalogIssuesBySeries = new Map<string, Set<string>>();
  for (const match of catalogSource.matchAll(/"seriesId"\s*:\s*"([^"]+)"[\s\S]{0,500}?"issue"\s*:\s*"?(\d{1,3})"?/gi)) {
    if (!catalogIssuesBySeries.has(match[1])) catalogIssuesBySeries.set(match[1], new Set());
    catalogIssuesBySeries.get(match[1])!.add(String(Number(match[2])));
  }
  const errors: Record<string, string> = {};
  for (const source of sources || []) {
    try {
      const response = await fetchWithTimeout(source.source_url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const html = await response.text();
      const links = await extractLinks(html, source.source_url);
      sourceLinks += links.length;
      numberedLinks += links.filter(link => Boolean(link.issue)).length;
      unidentifiedLinks += links.filter(link => !link.issue).length;
      const catalogIssues = catalogIssuesBySeries.get(source.series_id) || new Set<string>();
      const sourceIssues = new Set(links.map(link => link.issue).filter(Boolean) as string[]);
      const missing = [...sourceIssues].filter(issue => !catalogIssues.has(issue));
      if (missing.length) missingIssues[source.series_id] = missing.sort((a, b) => Number(a) - Number(b));
      const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(html));
      const hashText = [...new Uint8Array(hash)].map(value => value.toString(16).padStart(2, "0")).join("");
      await service.from("series_link_sources").update({ last_checked_at: new Date().toISOString(), last_content_hash: hashText, last_error: null, updated_at: new Date().toISOString() }).eq("id", source.id);
      for (const link of links) {
        const normalized = normalizeUrl(link.fileUrl);
        if (!normalized || !link.issue || isKnown(link.fileUrl, normalized)) continue;
        const existing = await service.from("series_link_discoveries").select("id").eq("source_id", source.id).eq("normalized_url", normalized).maybeSingle();
        if (existing.data?.id) continue;
        const identity = mediafireIdentity(link.fileUrl);
        if (identity) {
          const previous = await service.from("series_link_discoveries").select("id, file_url, normalized_url").eq("source_id", source.id);
          if (previous.error) throw previous.error;
          const matching = (previous.data || []).find(row => mediafireIdentity(row.file_url) === identity);
          if (matching?.id) {
            if (matching.normalized_url !== normalized) {
              const updated = await service.from("series_link_discoveries").update({ file_url: link.fileUrl, normalized_url: normalized, updated_at: new Date().toISOString() }).eq("id", matching.id);
              if (updated.error) throw updated.error;
            }
            continue;
          }
        }
        const inserted = await service.from("series_link_discoveries").insert({ source_id: source.id, series_id: source.series_id, issue: link.issue, title: `Edição ${link.issue}`, file_url: link.fileUrl, normalized_url: normalized, source_url: source.source_url, metadata: { provider: source.provider, anchor: link.anchor, coverUrl: link.coverUrl } });
        if (inserted.error) throw inserted.error;
        discovered++;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "source scan failed";
      errors[source.source_url] = message;
      await service.from("series_link_sources").update({ last_checked_at: new Date().toISOString(), last_error: message, updated_at: new Date().toISOString() }).eq("id", source.id);
    }
  }
  return { ok: true, sources: sources?.length || 0, sourceLinks, numberedLinks, unidentifiedLinks, missingIssues, discovered, errors };
}

Deno.serve(async request => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const secret = Deno.env.get("SERIES_MONITOR_SECRET")?.trim();
    const scheduled = Boolean(secret && request.headers.get("x-series-monitor-secret") === secret);
    if (!scheduled && !(await isAdmin(request))) return json({ error: "Authentication required" }, 401);
    const service = createClient(required("SUPABASE_URL"), required("SUPABASE_SERVICE_ROLE_KEY"));
    return json(await scan(service));
  } catch (error) {
    console.error("series-link-monitor", error);
    return json({ error: error instanceof Error ? error.message : "Series monitor failed" }, 500);
  }
});
