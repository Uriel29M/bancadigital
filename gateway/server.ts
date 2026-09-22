import { File } from "npm:megajs@1.3.10";
import { TelegramClient } from "npm:@mtcute/web@0.31.0";
import { MemoryStorage, IntermediatePacketCodec, Long } from "npm:@mtcute/core@0.31.0";
import { connectTcp } from "jsr:@fuman/deno@0.0.21";
import { resolveDocument, readAligned, migrationDc, isExpiredReference } from "./mtproto-source.mjs";

const MAX_FILE_BYTES = 512 * 1024 * 1024;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

class HttpError extends Error {
  constructor(message, status = 502, code = "gateway_error") { super(message); this.status = status; this.code = code; }
}
class NativeTcpTransport {
  async connect(dc, signal) {
    const conn = await connectTcp({ address: dc.ipAddress, port: dc.port }, signal);
    conn.setNoDelay(true); conn.setKeepAlive(true); return conn;
  }
  packetCodec() { return new IntermediatePacketCodec(); }
}
function required(name) {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new HttpError(`Configure ${name}.`, 503, "not_configured");
  return value;
}
function decode(value) {
  const b64 = String(value || "").replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - String(value || "").length % 4) % 4);
  return Uint8Array.from(atob(b64), c => c.charCodeAt(0));
}
async function ticket(value) {
  const [version, ivText, cipherText, extra] = String(value || "").split(".");
  if (version !== "v1" || !ivText || !cipherText || extra) throw new HttpError("Ticket inválido.", 401, "invalid_ticket");
  const rawKey = decode(required("BANCA_MEDIA_GATEWAY_KEY"));
  if (rawKey.byteLength !== 32) throw new HttpError("Chave inválida.", 503, "invalid_key");
  const key = await crypto.subtle.importKey("raw", rawKey, "AES-GCM", false, ["decrypt"]);
  let payload;
  try {
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: decode(ivText) }, key, decode(cipherText));
    payload = JSON.parse(decoder.decode(plain));
  } catch {
    throw new HttpError("Ticket inválido.", 401, "invalid_ticket");
  }
  const now = Math.floor(Date.now() / 1000);
  if (payload?.v !== 1 || !Number.isSafeInteger(payload.e) || payload.e < now || payload.e > now + 3600) {
    throw new HttpError("Ticket expirado.", 401, "expired_ticket");
  }
  return payload;
}
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, range",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Expose-Headers": "Content-Length, Content-Type, Content-Disposition, Content-Range, Accept-Ranges",
  "Cross-Origin-Resource-Policy": "cross-origin",
  "Cache-Control": "no-store",
  Vary: "Range"
};
function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json; charset=utf-8" } });
}
function validate(value, hosts) {
  let url;
  try { url = new URL(String(value || "")); } catch { throw new HttpError("URL inválida.", 400, "invalid_url"); }
  if (url.protocol !== "https:" || url.username || url.password || url.port || !hosts(url.hostname.toLowerCase())) throw new HttpError("Fonte não autorizada.", 400, "source_not_allowed");
  return url;
}
function parseRange(value, size) {
  if (!value) return { start: 0, end: size - 1, partial: false };
  const m = /^bytes=(\d*)-(\d*)$/.exec(value);
  if (!m || (!m[1] && !m[2])) throw new HttpError("Intervalo inválido.", 416, "invalid_range");
  let start, end;
  if (!m[1]) { const suffix = Number(m[2]); start = Math.max(0, size - suffix); end = size - 1; }
  else { start = Number(m[1]); end = m[2] ? Number(m[2]) : size - 1; }
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start >= size || end < start) throw new HttpError("Intervalo inválido.", 416, "invalid_range");
  return { start, end: Math.min(end, size - 1), partial: true };
}

function mediafireHost(host) { return host === "mediafire.com" || host === "www.mediafire.com" || /^download\d+\.mediafire\.com$/.test(host); }
async function mediafireDirect(source) {
  if (/^download\d+\.mediafire\.com$/i.test(source.hostname)) return source;
  const legacy = /^\?([a-z0-9]{15})$/i.exec(source.search)?.[1] || /^\/download\/([a-z0-9]{15})\/?$/i.exec(source.pathname)?.[1];
  if (legacy) source = new URL(`https://www.mediafire.com/file/${legacy}/file`);
  const page = await fetch(source, { headers: { Accept: "text/html,application/xhtml+xml" }, redirect: "follow", signal: AbortSignal.timeout(25000) });
  if (!page.ok) throw new HttpError(`MediaFire HTTP ${page.status}.`, page.status >= 400 && page.status < 500 ? page.status : 502, "mediafire_page");
  const final = validate(page.url, mediafireHost);
  if (/^download\d+\.mediafire\.com$/i.test(final.hostname)) return final;
  const html = await page.text();
  const urls = [...html.matchAll(/(?:href|data-href)\s*=\s*["']([^"']+)["']/gi)]
    .map(m => m[1].replaceAll("&amp;", "&").replaceAll("\\/", "/"))
    .map(v => { try { return validate(new URL(v, final).toString(), mediafireHost); } catch { return null; } })
    .filter(Boolean);
  const direct = urls.find(u => /^download\d+\.mediafire\.com$/i.test(u.hostname));
  if (!direct) throw new HttpError("Download MediaFire não encontrado.", 502, "mediafire_direct_missing");
  return direct;
}
async function passThrough(source, request, hostCheck) {
  let current = source;
  for (let n = 0; n < 6; n++) {
    const upstream = await fetch(current, {
      method: request.method,
      redirect: "manual",
      headers: { Accept: "application/octet-stream,*/*", "Accept-Encoding": "identity", ...(request.headers.get("range") ? { Range: request.headers.get("range") } : {}) },
      signal: request.signal
    });
    if ([301,302,303,307,308].includes(upstream.status)) {
      const location = upstream.headers.get("location"); await upstream.body?.cancel();
      if (!location) throw new HttpError("Redirecionamento inválido.", 502, "invalid_redirect");
      current = validate(new URL(location, current).toString(), hostCheck); continue;
    }
    if (!upstream.ok) throw new HttpError(`Fonte HTTP ${upstream.status}.`, upstream.status >= 400 && upstream.status < 500 ? upstream.status : 502, "upstream_error");
    const length = Number(upstream.headers.get("content-length") || 0);
    const contentRange = upstream.headers.get("content-range") || "";
    const total = Number(contentRange.match(/\/(\d+)$/)?.[1] || 0) || length;
    if (length > MAX_FILE_BYTES || total > MAX_FILE_BYTES) { await upstream.body?.cancel(); throw new HttpError("Arquivo acima de 512 MB.", 413, "file_too_large"); }
    const headers = new Headers(cors);
    headers.set("Content-Type", upstream.headers.get("content-type") || "application/octet-stream");
    const disposition = upstream.headers.get("content-disposition"); if (disposition) headers.set("Content-Disposition", disposition);
    if (length) headers.set("Content-Length", String(length));
    if (contentRange) headers.set("Content-Range", contentRange);
    headers.set("Accept-Ranges", upstream.headers.get("accept-ranges") || "bytes");
    return new Response(request.method === "HEAD" ? null : upstream.body, { status: upstream.status, headers });
  }
  throw new HttpError("Redirecionamentos demais.", 502, "too_many_redirects");
}

function attrs(file) { return new Promise((resolve, reject) => file.loadAttributes(error => error ? reject(error) : resolve())); }
function megaRead(stream) {
  return new Promise((resolve, reject) => {
    const parts = []; let total = 0, done = false;
    const cleanup = () => { stream.removeListener?.("data", onData); stream.removeListener?.("end", finish); stream.removeListener?.("close", close); stream.removeListener?.("error", fail); };
    const finish = () => { if (done) return; done = true; cleanup(); const out = new Uint8Array(total); let p = 0; for (const c of parts) { out.set(c,p); p += c.byteLength; } resolve(out); };
    const close = () => setTimeout(finish, 75);
    const fail = error => { if (done) return; done = true; cleanup(); reject(error); };
    const onData = chunk => { if (done) return; const c = chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk); parts.push(c); total += c.byteLength; };
    stream.on("data", onData); stream.once("end", finish); stream.once("close", close); stream.once("error", fail);
  });
}
async function megaBlock(file,start,end) {
  const expected=end-start+1, adjusted=end===0?Math.min(15,Number(file.size)-1):end;
  const raw=await megaRead(file.download({start,end:adjusted,maxConnections:1}));
  const block=end===0?raw.subarray(0,expected):raw;
  if(block.byteLength!==expected) throw new HttpError("Bloco MEGA incompleto.",502,"mega_incomplete");
  return block;
}
function megaStream(file,start,end) {
  let position=start;
  return new ReadableStream({ async pull(controller) {
    if(position>end){controller.close();return;}
    try { const e=Math.min(end,position+1024*1024-1); const chunk=await megaBlock(file,position,e); position+=chunk.byteLength; controller.enqueue(chunk); }
    catch(error){ controller.error(error); }
  }, cancel(){position=end+1;} },{highWaterMark:1});
}
async function megaResponse(data,request) {
  const source=validate(data.url,h=>h==="mega.nz"||h==="www.mega.nz");
  if(!source.pathname.startsWith("/file/")||!source.hash) throw new HttpError("Link MEGA inválido.",400,"invalid_mega_url");
  const file=File.fromURL(source.toString()); await attrs(file);
  const size=Number(file.size||0);
  if(!Number.isSafeInteger(size)||size<1||size>MAX_FILE_BYTES) throw new HttpError("Tamanho MEGA inválido.",413,"file_too_large");
  const r=parseRange(request.headers.get("range"),size), headers=new Headers(cors);
  headers.set("Content-Type","application/octet-stream"); headers.set("Accept-Ranges","bytes");
  headers.set("Content-Disposition",`inline; filename*=UTF-8''${encodeURIComponent(file.name||"arquivo-mega")}`);
  headers.set("Content-Length",String(r.end-r.start+1));
  if(r.partial) headers.set("Content-Range",`bytes ${r.start}-${r.end}/${size}`);
  return new Response(request.method==="HEAD"?null:megaStream(file,r.start,r.end),{status:r.partial?206:200,headers});
}

let telegramState = { key: "", client: null, promise: null };
async function telegramClient(data) {
  const keyText = `${data.telegramApiId}:${data.telegramApiHash}:${data.telegramBotToken}`;
  const digest = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(keyText)))).slice(0,8).join("-");
  if (telegramState.key !== digest) {
    try { await telegramState.client?.disconnect?.(); } catch {}
    telegramState = { key: digest, client: null, promise: null };
  }
  if (!telegramState.promise) telegramState.promise = (async () => {
    const apiId=Number(data.telegramApiId), apiHash=String(data.telegramApiHash||""), botToken=String(data.telegramBotToken||"");
    if(!Number.isSafeInteger(apiId)||apiId<=0||!/^[a-f0-9]{32}$/i.test(apiHash)||!botToken) throw new HttpError("Credenciais Telegram inválidas.",503,"telegram_credentials_invalid");
    const client=new TelegramClient({apiId,apiHash,storage:new MemoryStorage(),transport:new NativeTcpTransport(),disableUpdates:true});
    await client.start({botToken}); telegramState.client=client; return client;
  })().catch(error=>{telegramState.promise=null;telegramState.client=null;throw error;});
  return telegramState.promise;
}
async function telegramResponse(data,request) {
  const size=Number(data.size), format=String(data.format||"").toLowerCase();
  if(!Number.isSafeInteger(size)||size<1||size>MAX_FILE_BYTES||!["pdf","cbz","cbr"].includes(format)) throw new HttpError("Metadados Telegram inválidos.",422,"telegram_metadata_invalid");
  const client=await telegramClient(data);
  const allowed=new Set(String(data.telegramAllowedChatIds||"-1004424843914").split(",").map(s=>s.trim()).filter(Boolean));
  const item={telegramUrl:String(data.telegramUrl||""),size,format};
  let file=await resolveDocument(client,item,allowed,Long), dcId=file.dcId;
  const read=async(offset,limit,signal)=>{
    const download=()=>client.downloadChunk({location:file.location,dcId,offset,limit,abortSignal:signal,maxRetryCount:2,floodSleepThreshold:0});
    try{return await download();}catch(error){const next=migrationDc(error);if(next&&next!==dcId){dcId=next;return await download();}if(isExpiredReference(error)){file=await resolveDocument(client,item,allowed,Long);dcId=file.dcId;return await download();}throw error;}
  };
  const r=parseRange(request.headers.get("range"),size), headers=new Headers(cors);
  const types={pdf:"application/pdf",cbz:"application/vnd.comicbook+zip",cbr:"application/vnd.comicbook-rar"};
  headers.set("Content-Type",types[format]); headers.set("Content-Disposition",`inline; filename="edition.${format}"`);
  headers.set("Content-Length",String(r.end-r.start+1)); headers.set("Accept-Ranges","bytes");
  if(r.partial) headers.set("Content-Range",`bytes ${r.start}-${r.end}/${size}`);
  if(request.method==="HEAD") return new Response(null,{status:r.partial?206:200,headers});
  const readWithRetry=async(offset,length,signal)=>{
    let lastError;
    for(let attempt=0;attempt<4;attempt+=1){
      try{
        return await readAligned(read,offset,length,size,signal);
      }catch(error){
        lastError=error;
        if(signal?.aborted||attempt===3) throw error;
        await new Promise(resolve=>setTimeout(resolve,250*(attempt+1)));
      }
    }
    throw lastError||new Error("Falha ao ler o Telegram.");
  };
  let offset=r.start;
  const stream=new ReadableStream({async pull(controller){
    if(offset>r.end){controller.close();return;}
    try{
      const length=Math.min(262144,r.end-offset+1);
      const bytes=await readWithRetry(offset,length,request.signal);
      offset+=bytes.byteLength;
      controller.enqueue(bytes);
    }catch(error){
      console.error("telegram_stream_error",{offset,end:r.end,message:error?.message||String(error)});
      controller.error(error);
    }
  }},{highWaterMark:1});
  return new Response(stream,{status:r.partial?206:200,headers});
}

async function media(data, request) {
  if (data.kind === "mediafire") return passThrough(await mediafireDirect(validate(data.url,mediafireHost)),request,mediafireHost);
  if (data.kind === "mega") return megaResponse(data,request);
  if (data.kind === "telegram") return telegramResponse(data,request);
  throw new HttpError("Fonte inválida.",400,"invalid_kind");
}

Deno.serve({ port: Number(Deno.env.get("PORT") || 8080) }, async request => {
  const url=new URL(request.url);
  if(request.method==="OPTIONS") return new Response(null,{status:204,headers:cors});
  if(url.pathname==="/health") return json({ok:true,service:"banca-media-gateway"});
  if(url.pathname!=="/media"||!["GET","HEAD"].includes(request.method)) return json({error:"Não encontrado."},404);
  try{return await media(await ticket(url.searchParams.get("ticket")),request);}
  catch(error){console.error("gateway",error?.code||error);return json({error:error instanceof Error?error.message:"Falha no gateway.",code:error instanceof HttpError?error.code:"gateway_error"},error instanceof HttpError?error.status:502);}
});
