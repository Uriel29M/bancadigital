const encoder = new TextEncoder();

export class GatewayError extends Error {
  constructor(message: string, public status = 503, public code = "gateway_error") {
    super(message);
  }
}

function decodeKey(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - value.length % 4) % 4);
  const raw = Uint8Array.from(atob(normalized), c => c.charCodeAt(0));
  if (raw.byteLength !== 32) throw new GatewayError("Chave do gateway inválida.", 503, "gateway_key_invalid");
  return raw;
}

function base64url(bytes: Uint8Array) {
  let text = "";
  for (const byte of bytes) text += String.fromCharCode(byte);
  return btoa(text).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function redirectToGateway(payload: Record<string, unknown>, corsHeaders: Record<string, string>) {
  const gateway = Deno.env.get("BANCA_MEDIA_GATEWAY_URL")?.trim() || "";
  const encodedKey = Deno.env.get("BANCA_MEDIA_GATEWAY_KEY")?.trim() || "";
  if (!gateway || !encodedKey) throw new GatewayError("Gateway externo de mídia não configurado.", 503, "gateway_not_configured");

  let base: URL;
  try { base = new URL(gateway); } catch { throw new GatewayError("URL do gateway inválida.", 503, "gateway_url_invalid"); }
  if (base.protocol !== "https:" || base.username || base.password || base.search || base.hash) {
    throw new GatewayError("A URL do gateway precisa ser HTTPS.", 503, "gateway_url_invalid");
  }

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await crypto.subtle.importKey("raw", decodeKey(encodedKey), "AES-GCM", false, ["encrypt"]);
  const body = encoder.encode(JSON.stringify({
    v: 1,
    e: Math.floor(Date.now() / 1000) + 15 * 60,
    ...payload
  }));
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, body));
  const ticket = `v1.${base64url(iv)}.${base64url(cipher)}`;
  const target = new URL("/media", base);
  target.searchParams.set("ticket", ticket);

  return new Response(null, {
    status: 307,
    headers: {
      ...corsHeaders,
      Location: target.toString(),
      "Cache-Control": "no-store",
      Vary: "Range"
    }
  });
}
