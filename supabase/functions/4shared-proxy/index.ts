// Public-file adapter. No 4shared credentials, arbitrary URL proxying, or access-control bypass.
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, apikey, x-client-info, content-type, range',
  'Access-Control-Expose-Headers': 'Content-Length, Content-Type, Content-Disposition, Content-Range, Accept-Ranges, X-Banca-File-Format',
};
const MAX = 512 * 1024 * 1024;
const formats = new Set(['pdf', 'cbz', 'cbr']);
const cache = new Map<string, { url: URL; format: string; name: string; until: number }>();
class HttpError extends Error { constructor(public status: number, message: string) { super(message); } }
function errorResponse(error: unknown) {
  const status = error instanceof HttpError ? error.status : 502;
  return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Falha ao acessar o 4shared.' }), {
    status, headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}
function allowed(value: string | URL): URL {
  const url = new URL(value);
  if (url.protocol !== 'https:' || !/(?:^|\.)4shared\.com$/i.test(url.hostname) || url.username || url.password || url.port) {
    throw new HttpError(400, 'Somente URLs HTTPS do 4shared são aceitas.');
  }
  return url;
}
async function requestAllowed(url: URL, init: RequestInit = {}) {
  let current = allowed(url);
  for (let i = 0; i < 6; i++) {
    const response = await fetch(current, { ...init, redirect: 'manual', credentials: 'omit', signal: AbortSignal.timeout(25000) });
    if (![301, 302, 303, 307, 308].includes(response.status)) return { response, url: current };
    const location = response.headers.get('location');
    await response.body?.cancel();
    if (!location) throw new HttpError(502, 'Redirecionamento inválido do 4shared.');
    current = allowed(new URL(location, current));
  }
  throw new HttpError(502, 'Redirecionamentos demais.');
}
function filename(headers: Headers, url: URL) {
  const cd = headers.get('content-disposition') || '';
  const encoded = /filename\*\s*=\s*UTF-8''([^;]+)/i.exec(cd)?.[1];
  const plain = /filename\s*=\s*"?([^";]+)"?/i.exec(cd)?.[1];
  let name = encoded || plain || decodeURIComponent(url.pathname.split('/').pop() || 'arquivo');
  try { if (encoded) name = decodeURIComponent(encoded); } catch { /* keep original */ }
  return name.replace(/[\r\n"\\]/g, '_').slice(0, 240);
}
function signature(bytes: Uint8Array) {
  if (bytes.length >= 5 && String.fromCharCode(...bytes.subarray(0, 5)) === '%PDF-') return 'pdf';
  if (bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && [3, 5, 7].includes(bytes[2]) && [4, 6, 8].includes(bytes[3])) return 'cbz';
  if (bytes.length >= 7 && bytes[0] === 0x52 && bytes[1] === 0x61 && bytes[2] === 0x72 && bytes[3] === 0x21 && bytes[4] === 0x1a && bytes[5] === 0x07) return 'cbr';
  return '';
}
async function preview(response: Response, limit = 65536) {
  const reader = response.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (size < limit) {
      const { value, done } = await reader.read();
      if (done) break;
      chunks.push(value); size += value.length;
      if (size >= limit) break;
    }
  } finally { await reader.cancel().catch(() => {}); }
  const out = new Uint8Array(Math.min(size, limit));
  let offset = 0;
  for (const chunk of chunks) { const part = chunk.subarray(0, out.length - offset); out.set(part, offset); offset += part.length; }
  return out;
}
function decodeHtml(value: string) {
  return value.replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n))).replace(/\\\//g, '/').replace(/\\u0026/gi, '&');
}
function candidates(html: string, base: URL) {
  const found: URL[] = [];
  const add = (value: string) => {
    try {
      const url = allowed(new URL(decodeHtml(value), base));
      if (!found.some(other => other.href === url.href)) found.push(url);
    } catch { /* ignore unrelated links */ }
  };
  for (const match of html.matchAll(/(?:href|data-href|data-download-url|downloadUrl|downloadLink|download_url|directLink)\s*[=:]\s*["']([^"']+)["']/gi)) add(match[1]);
  for (const match of html.matchAll(/https:\/\/[^\s"'<>]+/gi)) add(match[0]);
  return found.filter(url => /\.(pdf|cbz|cbr)(?:$|[?#])|\/download(?:\/|\?|$)|\/get\/|\/downloadFile\//i.test(url.pathname + url.search)).slice(0, 12);
}
async function inspect(url: URL) {
  const result = await requestAllowed(url, { headers: { Accept: 'application/octet-stream,*/*', Range: 'bytes=0-15' } });
  const { response } = result;
  if (!response.ok) { await response.body?.cancel(); throw new HttpError(response.status >= 400 && response.status < 500 ? response.status : 502, `4shared respondeu HTTP ${response.status}.`); }
  const bytes = await preview(response, 65536);
  const type = response.headers.get('content-type') || '';
  const format = signature(bytes);
  const html = !format && (type.includes('text/html') || /^\s*(?:<!doctype|<html)/i.test(new TextDecoder().decode(bytes.subarray(0, 80))));
  return { url: result.url, format, name: filename(response.headers, result.url), html: html ? new TextDecoder().decode(bytes) : '', type };
}
async function resolve(source: URL) {
  const saved = cache.get(source.href);
  if (saved && saved.until > Date.now()) return saved;
  const queue = [source];
  const visited = new Set<string>();
  while (queue.length && visited.size < 16) {
    const current = queue.shift()!;
    if (visited.has(current.href)) continue;
    visited.add(current.href);
    let result;
    try { result = await inspect(current); }
    catch (error) { if (current.href !== source.href) continue; throw error; }
    if (result.format) {
      const resolved = { url: result.url, format: result.format, name: result.name, until: Date.now() + 30000 };
      cache.set(source.href, resolved);
      return resolved;
    }
    if (result.html) queue.push(...candidates(result.html, result.url).filter(url => !visited.has(url.href)));
  }
  throw new HttpError(409, 'O 4shared não disponibilizou um download direto para este arquivo. Abra o link original, faça login se necessário e utilize um link de download autorizado.');
}
async function streamFile(info: Awaited<ReturnType<typeof resolve>>, request: Request) {
  const range = request.headers.get('range');
  if (range && !/^bytes=\d+-\d*$/.test(range)) throw new HttpError(416, 'Intervalo inválido.');
  const result = await requestAllowed(info.url, { headers: { Accept: 'application/octet-stream,*/*', ...(range ? { Range: range } : {}) } });
  const upstream = result.response;
  if (!upstream.ok) { await upstream.body?.cancel(); throw new HttpError(upstream.status >= 400 && upstream.status < 500 ? upstream.status : 502, `Download indisponível (HTTP ${upstream.status}).`); }
  const length = Number(upstream.headers.get('content-length') || 0);
  const total = Number(upstream.headers.get('content-range')?.match(/\/(\d+)$/)?.[1] || length);
  if (total > MAX || length > MAX) { await upstream.body?.cancel(); throw new HttpError(413, 'Arquivo excede o limite de 512 MB.'); }
  if (/text\/html|application\/json/i.test(upstream.headers.get('content-type') || '')) { await upstream.body?.cancel(); throw new HttpError(502, 'O 4shared retornou uma página em vez do arquivo.'); }
  const headers = new Headers(cors);
  headers.set('Content-Type', info.format === 'pdf' ? 'application/pdf' : 'application/octet-stream');
  headers.set('Content-Disposition', `inline; filename="${info.name.replace(/"/g, '_')}"`);
  headers.set('X-Banca-File-Format', info.format);
  headers.set('Cache-Control', 'no-store');
  headers.set('Vary', 'Range');
  if (length) headers.set('Content-Length', String(length));
  if (upstream.headers.has('content-range')) headers.set('Content-Range', upstream.headers.get('content-range')!);
  if (upstream.headers.has('accept-ranges')) headers.set('Accept-Ranges', upstream.headers.get('accept-ranges')!);
  if (request.method === 'HEAD') { await upstream.body?.cancel(); return new Response(null, { status: upstream.status, headers }); }
  if (!upstream.body) throw new HttpError(502, 'O download não retornou conteúdo.');
  let received = 0;
  const reader = upstream.body.getReader();
  const body = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { value, done } = await reader.read();
        if (done) { controller.close(); return; }
        received += value.byteLength;
        if (received > MAX) { await reader.cancel(); controller.error(new Error('Arquivo excede o limite.')); return; }
        controller.enqueue(value);
      } catch (error) { controller.error(error); }
    },
    cancel(reason) { return reader.cancel(reason); },
  });
  return new Response(body, { status: upstream.status, headers });
}
export async function handleRequest(request: Request): Promise<Response> {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (!['GET', 'HEAD'].includes(request.method)) return errorResponse(new HttpError(405, 'Método não permitido.'));
  try {
    const params = new URL(request.url).searchParams;
    const value = params.get('url');
    if (!value) throw new HttpError(400, 'Informe o parâmetro url.');
    const source = allowed(value);
    const info = await resolve(source);
    if (params.get('meta') === '1') return new Response(JSON.stringify({ format: info.format, name: info.name }), { headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
    return await streamFile(info, request);
  } catch (error) { console.error('4shared-proxy', error); return errorResponse(error); }
}
if (typeof Deno !== 'undefined') Deno.serve(handleRequest);
