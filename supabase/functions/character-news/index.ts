const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const sites = [
  { id: "ovicio", name: "O Vício", domain: "ovicio.com.br" },
  { id: "legiao", name: "Legião dos Heróis", domain: "legiaodosherois.com.br" },
  { id: "cbr", name: "CBR", domain: "cbr.com" },
];

function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

async function fetchWithTimeout(input: string | URL, init: RequestInit = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try { return await fetch(input, { ...init, signal: controller.signal }); }
  finally { clearTimeout(timer); }
}

async function resolveNewsUrl(value: string, site: typeof sites[number]) {
  try {
    const source = new URL(value);
    if (source.hostname === site.domain || source.hostname.endsWith(`.${site.domain}`)) return value;
    if (!source.hostname.endsWith("google.com")) return "";
    const response = await fetchWithTimeout(value, { headers: { "User-Agent": "Mozilla/5.0 BancaDigital/1.0" } }, 5000);
    const html = await response.text();
    const candidates = [
      html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)/i)?.[1],
      html.match(/<meta[^>]+property=["']og:url["'][^>]+content=["']([^"']+)/i)?.[1],
      html.match(new RegExp(`https?:\\/\\/(?:www\\.)?${site.domain.replace(".", "\\.")}[^"'\\s<>]+`, "i"))?.[0],
    ].filter(Boolean);
    const resolved = candidates[0] || "";
    const hostname = resolved ? new URL(resolved).hostname.toLowerCase() : "";
    return hostname === site.domain || hostname.endsWith(`.${site.domain}`) ? resolved : "";
  } catch { return ""; }
}

async function findDirectArticle(site: typeof sites[number], character: string, title: string) {
  try {
    const searchUrl = `https://${site.domain}/?s=${encodeURIComponent(title)}`;
    const response = await fetchWithTimeout(searchUrl, { headers: { "User-Agent": "Mozilla/5.0 BancaDigital/1.0" } }, 5000);
    if (!response.ok) return "";
    const html = await response.text();
    const wanted = title.toLowerCase().split(/\W+/).filter(word => word.length > 3);
    const links = [...html.matchAll(/<a[^>]+href=["'](https?:\/\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)]
      .map(match => ({ url: match[1], text: match[2].replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim() }))
      .filter(item => { try { const host = new URL(item.url).hostname.toLowerCase(); return (host === site.domain || host.endsWith(`.${site.domain}`)) && item.url !== searchUrl; } catch { return false; } });
    const best = links.sort((a, b) => {
      const score = item => wanted.reduce((total, word) => total + (item.text.toLowerCase().includes(word) ? 1 : 0), 0);
      return score(b) - score(a);
    })[0];
    const bestScore = best ? wanted.reduce((total, word) => total + (best.text.toLowerCase().includes(word) ? 1 : 0), 0) : 0;
    return best && bestScore >= Math.max(2, Math.ceil(wanted.length * 0.25)) ? best.url : "";
  } catch { return ""; }
}

function guessedCbrUrl(title: string) {
  const slug = title.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return slug ? `https://www.cbr.com/${slug}/` : "";
}

async function searchDirectSite(site: typeof sites[number], character: string) {
  const characterSlug = character.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const searchUrls = site.id === "legiao"
    ? [`https://${site.domain}/tag/${characterSlug}/`, `https://${site.domain}/tag/${characterSlug}/page/2/`, `https://${site.domain}/feed/?s=${encodeURIComponent(character)}`, `https://${site.domain}/busca?q=${encodeURIComponent(character)}`, `https://${site.domain}/?s=${encodeURIComponent(character)}`]
    : [`https://${site.domain}/?s=${encodeURIComponent(character)}`, `https://${site.domain}/?s=${encodeURIComponent(character)}&paged=2`, `https://${site.domain}/?s=${encodeURIComponent(character)}&paged=3`, `https://${site.domain}/?s=${encodeURIComponent(character)}&paged=4`, `https://${site.domain}/?s=${encodeURIComponent(character)}&paged=5`, `https://${site.domain}/search/?q=${encodeURIComponent(character)}`];
  const collected: Array<{ title: string; url: string; description: string; site: string; siteId: string }> = [];
  for (const searchUrl of searchUrls) {
    try {
      const response = await fetchWithTimeout(searchUrl, { headers: { "User-Agent": "Mozilla/5.0 BancaDigital/1.0", Accept: "text/html" } }, 7000);
      if (!response.ok) continue;
      const html = await response.text();
      if (searchUrl.includes("/feed/")) {
        const readTag = (item: string, tag: string) => item.match(new RegExp("<" + tag + "(?:[^>]*)>([\\s\\S]*?)</" + tag + ">", "i"))?.[1] || "";
        const decodeFeed = (input: string) => input.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&#0?39;/gi, "'").replace(/&#0?34;/gi, '"').replace(/&quot;/g, '"').replace(/\s+/g, " ").trim();
        const feedItems = [...html.matchAll(/<item[\s\S]*?<\/item>/gi)].map(match => {
          const item = match[0];
          return { title: decodeFeed(readTag(item, "title")), url: decodeFeed(readTag(item, "link")) };
        }).filter(item => item.title && /^https?:\/\//i.test(item.url));
        const queryWords = character.toLowerCase().split(/\W+/).filter(word => word.length > 2);
        if (queryWords.length) {
          const relevantFeedItems = feedItems.filter(item => queryWords.some(word => (item.title + " " + item.url).toLowerCase().includes(word)));
          if (relevantFeedItems.length) return relevantFeedItems.slice(0, 8).map(item => ({ ...item, description: item.title, site: site.name, siteId: site.id }));
        }
      }
      const links = [...html.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)]
        .map(match => {
          try {
            const url = new URL(match[1], `https://${site.domain}`).href;
            const text = match[2].replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&#0?39;/gi, "'").replace(/&#0?34;/gi, '"').replace(/&quot;/g, '"').replace(/\s+/g, " ").trim();
            return { url, text };
          } catch { return null; }
        })
        .filter(item => item && new URL(item.url).hostname.endsWith(site.domain) && item.url !== searchUrl && item.text.length > 18)
        .filter(item => !/\/tag\/|\/category\/|\/author\/|\/page\/|\/search\//i.test(new URL(item.url).pathname));
      const queryWords = character.toLowerCase().split(/\W+/).filter(word => word.length > 2);
      const unique = [...new Map(links.map(item => [item.url, item])).values()];
      const relevant = unique.filter(item => queryWords.some(word => `${item.text} ${item.url}`.toLowerCase().includes(word)));
      relevant.sort((a, b) => {
        const score = item => queryWords.reduce((sum, word) => sum + (item.text.toLowerCase().includes(word) ? 1 : 0), 0);
        return score(b) - score(a);
      });
      collected.push(...relevant.map(item => ({ title: item.text, url: item.url, description: item.text, site: site.name, siteId: site.id })));
    } catch (error) { console.warn(`Busca direta indisponível: ${site.domain}`, error); }
  }
  return [...new Map(collected.map(item => [item.url, item])).values()].slice(0, 30);
}

async function findArticleImage(url: string) {
  try {
    const response = await fetchWithTimeout(url, { headers: { "User-Agent": "Mozilla/5.0 BancaDigital/1.0", Accept: "text/html" } }, 6000);
    if (!response.ok) return "";
    const html = await response.text();
    const candidates = [
      html.match(/<meta[^>]+(?:property|name)=["'](?:og:image|twitter:image)["'][^>]+content=["']([^"']+)/i)?.[1],
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["'](?:og:image|twitter:image)["']/i)?.[1],
      html.match(/<img[^>]+(?:data-srcset|srcset)=["']([^"']+)["']/i)?.[1]?.split(",").pop()?.trim().split(/\s+/)[0],
      html.match(/<img[^>]+src=["'](https?:\/\/[^"']+)["']/i)?.[1],
    ];
    return candidates.map(value => {
      try { return value ? new URL(value.replace(/&amp;/gi, "&"), url).href : ""; } catch { return ""; }
    }).find(value => /^https?:\/\//i.test(value || "") && !/pixel\.wp\.com|gravatar\.com\/avatar|ids(?:\d+)?\.ad\.gt|adnxs|openx|pubmatic|rubiconproject|adsrvr|doubleclick|googlesyndication|googleadservices|360yield|sonobi|tapad/i.test(value || "")) || "";
  } catch { return ""; }
}

async function parseRss(xml: string, site: typeof sites[number], character: string) {
  const parsed = [...xml.matchAll(/<item>[\s\S]*?<\/item>/gi)].slice(0, 8).map(match => {
    const item = match[0];
    const read = (tag: string) => item.match(new RegExp(`<${tag}(?:[^>]*)>([\\s\\S]*?)<\\/${tag}>`, "i"))?.[1] || "";
    const decode = (value: string) => value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&#0?39;/gi, "'").replace(/&#0?34;/gi, '"').replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const title = decode(read("title")).replace(/\s+-\s+[^-]+$/, "");
    const link = decode(read("link"));
    let url = link;
    try { const parsed = new URL(link); url = parsed.searchParams.get("url") || parsed.searchParams.get("q") || link; } catch { return null; }
    // O description do Google RSS contém HTML escapado e um link intermediário.
    // O título é o resumo confiável; nunca devolva esse HTML para o navegador.
    return title && url ? { title, url, description: title, site: site.name, siteId: site.id } : null;
  }).filter(Boolean);
  return (await Promise.all(parsed.map(async item => {
    if (!item) return null;
    const url = await resolveNewsUrl(item.url, site);
    const directUrl = url || (site.id === "cbr" ? guessedCbrUrl(item.title) : "") || await findDirectArticle(site, character, item.title);
    return { ...item, url: directUrl || item.url };
  }))).filter(Boolean);
}

Deno.serve(async request => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Método não permitido." }, 405);
  try {
    const body = await request.json();
    const character = String(body?.character || "").trim();
    if (!character) return json({ error: "Informe o personagem." }, 400);
    const excludedUrls = new Set(Array.isArray(body?.excludeUrls) ? body.excludeUrls.map(value => String(value)) : []);
    const results = await Promise.all(sites.map(site => searchDirectSite(site, character)));
    const unique = [...new Map(results.flat().map(item => [item.url, item])).values()];
    const selected: typeof unique = [];
    const used = new Set<string>();
    // Garante diversidade: tenta uma matéria de cada fonte antes de preencher
    // as vagas restantes com outras matérias encontradas.
    results.forEach(sourceItems => {
      const available = sourceItems.filter(item => !excludedUrls.has(item.url));
      const pool = available.length ? available : sourceItems;
      const item = pool[Math.floor(Math.random() * pool.length)];
      if (item && !used.has(item.url)) { selected.push(item); used.add(item.url); }
    });
    const enriched = await Promise.all(selected.map(async item => ({ ...item, image: await findArticleImage(item.url) })));
    return json({ items: enriched });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Falha ao buscar notícias." }, 502);
  }
});
