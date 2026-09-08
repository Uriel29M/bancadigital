from pathlib import Path
import re
p=Path('js/app.js')
s=p.read_text()
assert 'function telegramProxyUrl(item)' in s
assert 'async function fetchFileArrayBuffer(' in s
assert 'function readerSourceCandidates(item)' in s
s=s.replace('  function telegramProxyUrl(item) {','  function isTelegramMediaUrl(url) {\n    try { const u = new URL(url); return u.hostname === new URL(window.BANCA_SUPABASE_URL).hostname && /\\/functions\\/v1\\/telegram-(?:proxy|mtproto)$/.test(u.pathname); } catch { return false; }\n  }\n  function telegramProxyUrl(item) {',1)
s=s.replace('    const prefetchedBuffer = readerFilePrefetches.get(resolvedUrl) || null;','    const prefetchedBuffer = isTelegramMediaUrl(resolvedUrl) ? null : readerFilePrefetches.get(resolvedUrl) || null;',1)
needle='    const isMega = /^https:\\/\\/(?:www\\.)?mega\\.nz\\/file\\//i.test(source);'
assert needle in s
s=s.replace(needle,'    if (isTelegramMediaUrl(source)) return fetchTelegramTemporaryBuffer(source, onProgress, onComplete, signal);\n'+needle,1)
helper='''  async function fetchTelegramTemporaryBuffer(url, onProgress = () => {}, onComplete = () => {}, signal = null) {
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) controller.abort();
    const chunks = [];
    let received = 0;
    let total = 0;
    const chunkSize = 1024 * 1024;
    try {
      while (!total || received < total) {
        if (controller.signal.aborted) throw new DOMException('Leitura cancelada.', 'AbortError');
        const end = total ? Math.min(total - 1, received + chunkSize - 1) : received + chunkSize - 1;
        let response, lastError;
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            response = await fetch(url, { headers: { Range: `bytes=${received}-${end}` }, mode: 'cors', credentials: 'omit', cache: 'no-store', signal: controller.signal });
            if (!response.ok) {
              let detail = '';
              try { detail = (await response.json()).error || ''; } catch {}
              throw new Error(detail || `Telegram: HTTP ${response.status}`);
            }
            if (response.status !== 206) throw new Error('O servidor não respeitou o intervalo solicitado.');
            const match = /^bytes (\\d+)-(\\d+)\\/(\\d+)$/.exec(response.headers.get('content-range') || '');
            if (!match || Number(match[1]) !== received || Number(match[2]) > end || !Number.isSafeInteger(Number(match[3]))) throw new Error('Intervalo de arquivo inválido.');
            const size = Number(match[3]);
            if (total && total !== size) throw new Error('O tamanho do arquivo mudou durante a leitura.');
            total = size;
            const part = new Uint8Array(await response.arrayBuffer());
            if (part.length !== Number(match[2]) - received + 1) throw new Error('Trecho incompleto do Telegram.');
            chunks.push(part);
            received += part.length;
            onProgress(received, total);
            lastError = null;
            break;
          } catch (error) {
            lastError = error;
            if (controller.signal.aborted) throw error;
            if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
          }
        }
        if (lastError) throw lastError;
      }
      const bytes = new Uint8Array(total);
      let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
      chunks.length = 0;
      onComplete();
      return bytes.buffer;
    } finally {
      signal?.removeEventListener('abort', abort);
      chunks.length = 0;
    }
  }

'''
s=s.replace('  async function fetchFileArrayBuffer(',helper+'  async function fetchFileArrayBuffer(',1)
# Existing archive renderers retain their navigation, decoding, and cleanup.
# Never write a temporary Telegram archive into the persistent offline cache.
s=s.replace('    const cacheKey = `${requestUrl}${requestUrl.includes("?") ? "&" : "?"}v=240`;','    const cacheKey = `${requestUrl}${requestUrl.includes("?") ? "&" : "?"}v=240`;',1)
# Avoid a stale whole-file prefetch and cancel downloads when the overlay closes.
s=s.replace('    const sourceCandidates = readerSourceCandidates(item);','    const sourceCandidates = readerSourceCandidates(item);',1)
p.write_text(s)
p=Path('index.html');s=p.read_text();s=re.sub(r'js/telegram-auto\\.js\\?v=\\d+', 'js/telegram-auto.js?v=4',s);s=re.sub(r'js/app\\.js\\?v=[0-9.]+','js/app.js?v=2.2.10.456',s);s=re.sub(r'sw\\.js\\?v=\\d+','sw.js?v=251',s);p.write_text(s)
p=Path('sw.js');s=p.read_text();s=re.sub(r'banca-digital-shell-v\\d+','banca-digital-shell-v592',s);s=re.sub(r'js/telegram-auto\\.js\\?v=\\d+','js/telegram-auto.js?v=4',s);s=re.sub(r'js/app\\.js\\?v=[0-9.]+','js/app.js?v=2.2.10.456',s);p.write_text(s)
assert 'fetchTelegramTemporaryBuffer(source' in Path('js/app.js').read_text()
assert 'telegram-mtproto' in Path('js/telegram-auto.js').read_text()
print('Reader integration and cache versions updated without replacing existing reader.')
