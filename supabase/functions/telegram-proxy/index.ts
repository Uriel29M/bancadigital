const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, range",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Expose-Headers": "Location, Retry-After, Content-Range, Accept-Ranges",
};

function fail(message: string, status: number, code = "telegram_error") {
  return new Response(JSON.stringify({ error: message, code }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
  });
}

Deno.serve(async request => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (request.method !== "GET" && request.method !== "HEAD") return fail("Método não permitido.", 405, "method_not_allowed");

  const itemId = new URL(request.url).searchParams.get("item_id")?.trim() || "";
  if (!/^[A-Za-z0-9_-]{1,160}$/.test(itemId)) return fail("Informe um identificador de edição válido.", 400, "invalid_item_id");

  const baseUrl = Deno.env.get("SUPABASE_URL")?.trim() || "";
  let target: URL;
  try {
    target = new URL(baseUrl);
    if (target.protocol !== "https:" || target.username || target.password) throw new Error("URL inválida");
  } catch {
    return fail("O servidor principal não está configurado corretamente.", 503, "supabase_url_invalid");
  }

  // O navegador segue para a função nativa MTProto do próprio Supabase.
  // O redirecionamento 307 preserva o método HEAD/GET e o cabeçalho Range.
  target.pathname = "/functions/v1/telegram-mtproto";
  target.search = "";
  target.hash = "";
  target.searchParams.set("item_id", itemId);

  return new Response(null, {
    status: 307,
    headers: {
      ...corsHeaders,
      Location: target.toString(),
      "Cache-Control": "no-store",
      Vary: "Range",
      "Accept-Ranges": "bytes"
    }
  });
});