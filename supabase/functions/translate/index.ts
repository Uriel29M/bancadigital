const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async request => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Método não permitido" }, 405);
  try {
    const body = await request.json();
    // O leitor envia um parágrafo inteiro. Cortá-lo aqui fazia a tradução
    // terminar no meio da frase e deixava o restante em inglês.
    const text = String(body?.text || "").trim();
    const source = String(body?.sourceLanguage || "en").toLowerCase().split("-")[0];
    if (!text || source === "pt" || source === "auto") return json({ translatedText: text });

    const libreUrl = Deno.env.get("LIBRETRANSLATE_URL");
    const libreKey = Deno.env.get("LIBRETRANSLATE_API_KEY");
    if (libreUrl) {
      const response = await fetch(`${libreUrl.replace(/\/$/, "")}/translate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q: text, source, target: "pt", format: "text", ...(libreKey ? { api_key: libreKey } : {}) }),
      });
      if (response.ok) {
        const payload = await response.json();
        if (payload?.translatedText) return json({ translatedText: String(payload.translatedText) });
      }
    }

    const query = new URLSearchParams({ q: text, langpair: `${source}|pt` });
    const response = await fetch(`https://api.mymemory.translated.net/get?${query.toString()}`, { headers: { "User-Agent": "BancaDigitalTranslation/1.0" } });
    if (!response.ok) return json({ translatedText: text, providerError: response.status }, 200);
    const payload = await response.json();
    return json({ translatedText: String(payload?.responseData?.translatedText || text) });
  } catch (error) {
    return json({ translatedText: "", error: String(error) }, 500);
  }
});
