const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async request => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const character = new URL(request.url).searchParams.get("character")?.trim();
  if (!character) return json({ error: "Informe o personagem." }, 400);

  try {
    const decodeXml = (value: string) => value.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
    const readTag = (item: string, tag: string) => decodeXml(item.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"))?.[1]?.trim() || "");
    const readMediaUrl = (item: string, tag: string) => decodeXml(item.match(new RegExp(`<media:${tag}[^>]+url=["']([^"']+)["'][^>]*\\/?>(?:</media:${tag}>)?`, "i"))?.[1] || "");
    const aiPattern = /\b(ai|a\.i\.?|ai[-_ ]?generated|aigenerated|gen(?:erated)?[-_ ]?by[-_ ]?ai|midjourney|stable[-_ ]?diffusion|dall[-_ ]?e| dalle|leonardo\.ai|firefly|novelai|comfyui|automatic1111)\b/i;
    const watermarkPattern = /\b(watermark(?:ed)?|watermarking|marca[-_ ]?d[’']?agua|signature|assinatura|logo|stock[-_ ]?image|preview[-_ ]?image|sample[-_ ]?image)\b/i;
    const normalized = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    const characterAliases: Record<string, string[]> = {
      "super choque": ["super choque", "static shock"],
    };
    const characterSearchTerms = characterAliases[normalized(character)] || [character];
    const isCharacterMatch = (metadata: string) => {
      const haystack = normalized(metadata);
      return characterSearchTerms.some(term => {
        const words = normalized(term).split(/\s+/).filter(word => word.length >= 3);
        return words.length > 0 && words.every(word => haystack.split(" ").includes(word));
      });
    };
    const readFeed = async (term: string) => {
      const searchUrl = new URL("https://backend.deviantart.com/rss.xml");
      searchUrl.searchParams.set("q", `${character} ${term} -AI -AIGenerated -Midjourney -StableDiffusion -Dalle`);
      const searchResponse = await fetch(searchUrl, { headers: { "User-Agent": "BancaDigitalQuadrinhos/1.0", "Accept-Encoding": "gzip" } });
      if (!searchResponse.ok) throw new Error(`Busca do DeviantArt falhou (HTTP ${searchResponse.status}).`);
      const xml = await searchResponse.text();
      return [...xml.matchAll(/<item\b[\s\S]*?<\/item>/gi)].map(match => {
        const item = match[0];
        const thumbnails = [...item.matchAll(/<media:thumbnail[^>]+url=["']([^"']+)["']/gi)].map(entry => decodeXml(entry[1]));
        const title = readTag(item, "title") || character;
        const keywords = readTag(item, "media:keywords");
        const description = readTag(item, "media:description");
        const image = readMediaUrl(item, "content") || thumbnails[1] || thumbnails[0];
        const contentTag = item.match(/<media:content\b[^>]*>/i)?.[0] || "";
        const width = Number(contentTag.match(/\bwidth=["'](\d+)["']/i)?.[1] || 0);
        const height = Number(contentTag.match(/\bheight=["'](\d+)["']/i)?.[1] || 0);
        const metadata = `${title} ${keywords} ${description}`;
        return { url: readTag(item, "link"), image, title, author: readTag(item, "media:credit") || "artista da comunidade", aiMentioned: aiPattern.test(metadata), watermarkMentioned: watermarkPattern.test(metadata), tooSmall: (width > 0 && width < 500) || (height > 0 && height < 500), characterMatch: isCharacterMatch(title) };
      }).filter(item => item.url && item.image && item.characterMatch && !item.aiMentioned && !item.watermarkMentioned && !item.tooSmall);
    };
    const feedResults = await Promise.all(["Fan Art", "Illustration", "Drawing"].map(readFeed));
    const results = [...new Map(feedResults.flat().map(item => [item.url, item])).values()];
    for (let i = results.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [results[i], results[j]] = [results[j], results[i]];
    }
    return json({ results: results.slice(0, 4).map((item: any) => ({ url: item.url, image: item.image, title: item.title, author: item.author })) });
  } catch (error) {
    console.error("DeviantArt fanarts", error);
    return json({ error: error instanceof Error ? error.message : "Não foi possível buscar fanarts agora." }, 502);
  }
});
