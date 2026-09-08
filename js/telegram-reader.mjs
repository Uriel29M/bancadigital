// Temporary HTTP Range download. The archive remains hosted on Telegram.
export class TelegramReaderError extends Error {
  constructor(message, code = 'telegram_download_failed', status = 0, retryAfter = 0) {
    super(message);
    this.name = 'TelegramReaderError';
    this.code = code;
    this.status = status;
    this.retryAfter = retryAfter;
  }
}
const pause = (ms, signal) => new Promise((resolve, reject) => {
  if (signal?.aborted) return reject(signal.reason || new DOMException('Cancelado.', 'AbortError'));
  const timer = setTimeout(done, ms);
  function done() { signal?.removeEventListener('abort', abort); resolve(); }
  function abort() { clearTimeout(timer); signal.removeEventListener('abort', abort); reject(signal.reason || new DOMException('Cancelado.', 'AbortError')); }
  signal?.addEventListener('abort', abort, { once: true });
});
function retrySeconds(response) {
  const value = response.headers.get('retry-after');
  if (!value) return 0;
  const number = Number(value);
  if (Number.isFinite(number)) return Math.max(0, Math.ceil(number));
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, Math.ceil((date - Date.now()) / 1000)) : 0;
}
async function requestRange(fetchImpl, url, start, end, signal) {
  const response = await fetchImpl(url, {
    method: 'GET', headers: { Range: `bytes=${start}-${end}` }, mode: 'cors',
    credentials: 'omit', cache: 'no-store', signal
  });
  if (!response.ok) {
    let detail = {};
    try { detail = await response.json(); } catch {}
    throw new TelegramReaderError(typeof detail.error === 'string' && detail.error ? detail.error : `Telegram: HTTP ${response.status}`, detail.code || 'telegram_http_error', response.status, retrySeconds(response));
  }
  if (response.status !== 206) throw new TelegramReaderError('O gateway não respeitou o intervalo solicitado.', 'telegram_range_unsupported', response.status);
  const range = /^bytes (\d+)-(\d+)\/(\d+)$/.exec(response.headers.get('content-range') || '');
  if (!range) throw new TelegramReaderError('O gateway retornou um Content-Range inválido.', 'telegram_invalid_range');
  const first = Number(range[1]), last = Number(range[2]), total = Number(range[3]);
  if (![first,last,total].every(Number.isSafeInteger) || first !== start || last !== Math.min(end,total-1) || total < 1 || first >= total || last < first)
    throw new TelegramReaderError('O intervalo retornado não corresponde ao arquivo solicitado.', 'telegram_invalid_range');
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length !== last-first+1) throw new TelegramReaderError('Trecho incompleto do Telegram.', 'telegram_incomplete_chunk');
  return { bytes, total };
}
export async function downloadTelegramBuffer(url, onProgress = () => {}, onComplete = () => {}, signal = null, options = {}) {
  const fetchImpl = options.fetchImpl || fetch;
  const chunkSize = 1024 * 1024;
  let received = 0, total = 0, output = null;
  while (!total || received < total) {
    if (signal?.aborted) throw signal.reason || new DOMException('Cancelado.', 'AbortError');
    const end = total ? Math.min(total-1, received+chunkSize-1) : received+chunkSize-1;
    let result;
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        result = await requestRange(fetchImpl, url, received, end, signal);
        break;
      } catch (error) {
        if (signal?.aborted || error?.name === 'AbortError') throw error;
        const status = error?.status || 0;
        // A Telegram flood wait is a server instruction, not a transient error.
        if (status === 429 || error?.code === 'telegram_flood_wait') throw error;
        if (status && ![408, 500, 502, 503, 504].includes(status)) throw error;
        if (attempt === 3) throw error;
        const delay = status === 503 && error.retryAfter ? Math.min(error.retryAfter, 15)*1000 : 500*(attempt+1);
        await pause(delay, signal);
      }
    }
    if (!total) {
      total = result.total;
      if (options.expectedSize && total !== options.expectedSize) throw new TelegramReaderError('O tamanho do documento não corresponde ao catálogo.', 'telegram_size_mismatch');
      output = new Uint8Array(total);
    } else if (result.total !== total) throw new TelegramReaderError('O tamanho do documento mudou durante a leitura.', 'telegram_size_mismatch');
    output.set(result.bytes, received);
    received += result.bytes.length;
    onProgress(received, total);
  }
  if (received !== total || !output) throw new TelegramReaderError('Download incompleto do Telegram.', 'telegram_incomplete_file');
  onComplete();
  return output.buffer;
}
