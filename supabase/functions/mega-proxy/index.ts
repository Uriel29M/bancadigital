import { GatewayError, redirectToGateway } from "../_shared/media-gateway.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, range",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Expose-Headers": "Location, Retry-After",
};

function fail(message: string, status: number, code = "mega_error") {
  return new Response(JSON.stringify({ error: message, code }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" }
  });
}

export function parseMegaUrl(value: string) {
  let url: URL;
  try { url = new URL(value); } catch { throw new GatewayError("URL inválida.", 400, "invalid_url"); }
  if (
    url.protocol !== "https:" ||
    !["mega.nz", "www.mega.nz"].includes(url.hostname.toLowerCase()) ||
    url.username || url.password || url.port ||
    !url.pathname.startsWith("/file/") ||
    !url.hash || url.hash.length < 2
  ) throw new GatewayError("Use uma URL pública mega.nz/file/... com chave.", 400, "invalid_mega_url");
  return url;
}

Deno.serve(async request => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (!["GET", "HEAD"].includes(request.method)) return fail("Método não permitido.", 405, "method_not_allowed");
  try {
    const input = new URL(request.url).searchParams.get("url");
    if (!input) return fail("Informe o parâmetro url.", 400, "missing_url");
    return await redirectToGateway({ kind: "mega", url: parseMegaUrl(input).toString() }, corsHeaders);
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "Falha ao preparar Mega.",
      error instanceof GatewayError ? error.status : 502,
      error instanceof GatewayError ? error.code : "mega_error"
    );
  }
});
