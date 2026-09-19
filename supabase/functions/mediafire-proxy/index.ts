import { GatewayError, redirectToGateway } from "../_shared/media-gateway.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, range",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Expose-Headers": "Location, Retry-After",
};

function fail(message: string, status: number, code = "mediafire_error") {
  return new Response(JSON.stringify({ error: message, code }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" }
  });
}

function allowed(hostname: string) {
  const host = hostname.toLowerCase();
  return host === "mediafire.com" || host === "www.mediafire.com" || /^download\d+\.mediafire\.com$/.test(host);
}

export function parseAllowedUrl(value: string) {
  let url: URL;
  try {
    const normalized = value.replace(/^(https:\/\/)([^/?#]+)/i, (_m, scheme, authority) =>
      scheme + authority.replace(/\\\./g, "."));
    url = new URL(normalized);
  } catch {
    throw new GatewayError("URL inválida.", 400, "invalid_url");
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port || !allowed(url.hostname)) {
    throw new GatewayError("A URL precisa apontar para o MediaFire.", 400, "invalid_mediafire_url");
  }
  return url;
}

Deno.serve(async request => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (!["GET", "HEAD"].includes(request.method)) return fail("Método não permitido.", 405, "method_not_allowed");
  try {
    const input = new URL(request.url).searchParams.get("url");
    if (!input) return fail("Informe o parâmetro url.", 400, "missing_url");
    return await redirectToGateway({ kind: "mediafire", url: parseAllowedUrl(input).toString() }, corsHeaders);
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "Falha ao preparar MediaFire.",
      error instanceof GatewayError ? error.status : 502,
      error instanceof GatewayError ? error.code : "mediafire_error"
    );
  }
});
