export class MediaError extends Error {
  constructor(message, status = 502, code = 'media_error', retryAfter = 0) {
    super(message); this.status = status; this.code = code; this.retryAfter = retryAfter;
  }
}
export const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, apikey, x-client-info, content-type, range',
  'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges, Content-Type, Retry-After',
  'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
};
const formats = { pdf: 'application/pdf', cbz: 'application/vnd.comicbook+zip', cbr: 'application/vnd.comicbook-rar' };
export function parseRange(value, size) {
  if (!value) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(value);
  if (!match || (!match[1] && !match[2]) || !Number.isSafeInteger(size) || size < 1) return false;
  let start, end;
  if (!match[1]) {
    const suffix = Number(match[2]);
    if (!Number.isSafeInteger(suffix) || suffix < 1) return false;
    start = Math.max(0, size - suffix); end = size - 1;
  } else {
    start = Number(match[1]); end = match[2] ? Number(match[2]) : size - 1;
  }
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start >= size || end < start) return false;
  return { start, end: Math.min(end, size - 1) };
}
function json(body, status = 200, extra = {}) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8', ...extra } });
}
export function createMediaHandler({ lookup, open, health = async () => ({ ok: true }), maxConcurrent = 8, chunkSize = 262144 }) {
  if (!Number.isSafeInteger(chunkSize) || chunkSize < 4096 || chunkSize > 1048576) throw new Error('Invalid chunk size');
  let active = 0;
  return async function handle(request) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'GET' && request.method !== 'HEAD') return json({ error: 'Método não permitido.' }, 405);
    try {
      const params = new URL(request.url).searchParams;
      if (params.has('health')) return json(await health());
      const itemId = params.get('item_id') || '';
      if (!/^[A-Za-z0-9_-]{1,160}$/.test(itemId)) throw new MediaError('Identificador de edição inválido.', 400);
      const item = await lookup(itemId);
      if (!item) throw new MediaError('Edição indisponível.', 404);
      const { size, format } = item;
      if (!Number.isSafeInteger(size) || size < 1 || !formats[format]) throw new MediaError('Metadados do arquivo incompletos.', 422);
      const range = parseRange(request.headers.get('range'), size);
      if (range === false) return json({ error: 'Intervalo inválido.' }, 416, { 'Content-Range': `bytes */${size}`, 'Accept-Ranges': 'bytes' });
      const start = range ? range.start : 0;
      const end = range ? range.end : size - 1;
      const headers = { ...cors, 'Content-Type': formats[format], 'Content-Disposition': `inline; filename="edition.${format}"`, 'Content-Length': String(end - start + 1), 'Accept-Ranges': 'bytes', ...(range ? { 'Content-Range': `bytes ${start}-${end}/${size}` } : {}) };
      if (request.method === 'HEAD') return new Response(null, { status: range ? 206 : 200, headers });
      if (active >= maxConcurrent) return json({ error: 'Serviço ocupado. Tente novamente.' }, 503, { 'Retry-After': '5' });
      active++;
      let source, released = false;
      const release = async () => {
        if (released) return;
        released = true; active--;
        try { await source?.close?.(); } catch {}
      };
      try {
        source = await open(item, request.signal);
        let offset = start;
        let first = await source.read(offset, Math.min(chunkSize, end - offset + 1), request.signal);
        if (!(first instanceof Uint8Array) || first.length < 1 || first.length > Math.min(chunkSize, end - offset + 1)) throw new MediaError('O Telegram não entregou o trecho solicitado.');
        const stream = new ReadableStream({
          async pull(controller) {
            try {
              if (request.signal.aborted) throw new DOMException('Cancelado', 'AbortError');
              const bytes = first || await source.read(offset, Math.min(chunkSize, end - offset + 1), request.signal);
              first = null;
              if (!(bytes instanceof Uint8Array) || !bytes.length || bytes.length > Math.min(chunkSize, end - offset + 1)) throw new MediaError('Download incompleto.');
              offset += bytes.length;
              controller.enqueue(bytes);
              if (offset > end) { controller.close(); await release(); }
            } catch (error) { controller.error(error); await release(); }
          },
          async cancel() { await release(); },
        }, { highWaterMark: 1 });
        return new Response(stream, { status: range ? 206 : 200, headers });
      } catch (error) { await release(); throw error; }
    } catch (error) {
      const status = error instanceof MediaError ? error.status : 502;
      return json({ error: error instanceof MediaError ? error.message : 'Falha ao acessar o arquivo.', code: error instanceof MediaError ? error.code : 'media_error' }, status, error instanceof MediaError && error.retryAfter > 0 ? { 'Retry-After': String(error.retryAfter) } : {});
    }
  };
}
