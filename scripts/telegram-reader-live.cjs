const fs=require('node:fs');const assert=require('node:assert/strict');
function edit(path,oldText,newText){let text=fs.readFileSync(path,'utf8');assert.equal(text.split(oldText).length,2,`Expected exactly one match in ${path}: ${oldText.slice(0,80)}`);fs.writeFileSync(path,text.replace(oldText,newText));}
const app='js/app.js';
edit('js/telegram-auto.js','/functions/v1/telegram-proxy','/functions/v1/telegram-mtproto');
const helper=String.raw`  function isTelegramMediaUrl(url) {
    try { const u = new URL(url); return u.origin === window.BANCA_SUPABASE_URL && /\/functions\/v1\/telegram-(?:proxy|mtproto)$/.test(u.pathname); } catch { return false; }
  }
  async function fetchTelegramBuffer(url, onProgress = () => {}, signal = null) {
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal?.addEventListener('abort', abort, { once: true });
    try {
      if (signal?.aborted) throw new DOMException('Cancelado', 'AbortError');
      const head = await fetch(url, { method: 'HEAD', cache: 'no-store', signal: controller.signal });
      if (!head.ok) throw new Error('Telegram HTTP ' + head.status);
      const total = Number(head.headers.get('content-length'));
      if (!Number.isSafeInteger(total) || total < 1) throw new Error('Tamanho do arquivo indisponível.');
      const bytes = new Uint8Array(total);
      for (let offset = 0; offset < total; offset += 1048576) {
        const end = Math.min(total - 1, offset + 1048575);
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            const response = await fetch(url, { headers: { Range: 'bytes='+offset+'-'+end }, cache: 'no-store', signal: controller.signal });
            if (response.status !== 206 || response.headers.get('content-range') !== 'bytes '+offset+'-'+end+'/'+total) {
              let detail = ''; try { const body = await response.json(); detail = body.error || body.code || ''; } catch {}
              throw new Error(detail || 'Telegram HTTP ' + response.status);
            }
            const part = new Uint8Array(await response.arrayBuffer());
            if (part.length !== end - offset + 1) throw new Error('Trecho incompleto.');
            bytes.set(part, offset); break;
          } catch (error) {
            if (attempt === 2 || controller.signal.aborted) throw error;
            await new Promise(resolve => setTimeout(resolve, 400 * (attempt + 1)));
          }
        }
        onProgress(end + 1, total);
      }
      return bytes.buffer;
    } finally { signal?.removeEventListener('abort', abort); }
  }
`;
edit(app,'  function telegramProxyUrl(item) {',helper+'  function telegramProxyUrl(item) {');
edit(app,'if (!url || /^blob:/i.test(url)) return true;','if (!url || /^blob:/i.test(url) || isTelegramMediaUrl(url)) return true;');
edit(app,'const prefetchedBuffer = readerFilePrefetches.get(resolvedUrl) || null;','const prefetchedBuffer = isTelegramMediaUrl(resolvedUrl) ? null : readerFilePrefetches.get(resolvedUrl) || null;');
edit(app,'    const cacheKey = `${requestUrl}${requestUrl.includes("?") ? "&" : "?"}v=240`;','    if (isTelegramMediaUrl(requestUrl)) {\n      const buffer = await fetchTelegramBuffer(requestUrl, onProgress, signal);\n      onComplete(); return buffer;\n    }\n    const cacheKey = `${requestUrl}${requestUrl.includes("?") ? "&" : "?"}v=240`;');
edit(app,'    const sourceCandidates = readerSourceCandidates(item);','    const sourceCandidates = readerSourceCandidates(item);\n    const telegramDownloadController = new AbortController();');
edit(app,'    const supportedFormatsForModes = ["pdf", "cbz", "cbr"];','    overlay._telegramDownloadController = telegramDownloadController;\n    const supportedFormatsForModes = ["pdf", "cbz", "cbr"];');
edit(app,'      overlay._cbzDownloadController?.abort();','      overlay._cbzDownloadController?.abort();\n      telegramDownloadController.abort();');
edit(app,'        buffer = await fetchFileArrayBuffer(url, (received, total) => {\n          const value = total ? (received / total) * 100 : 0;\n        showCbrProgress("Abrindo arquivo CBR…", value, total ? `${value.toFixed(0)}% · ${formatCbrBytes(received)} de ${formatCbrBytes(total)}` : `${formatCbrBytes(received)} processados`);\n        });','        buffer = await fetchFileArrayBuffer(url, (received, total) => {\n          const value = total ? (received / total) * 100 : 0;\n        showCbrProgress("Abrindo arquivo CBR…", value, total ? `${value.toFixed(0)}% · ${formatCbrBytes(received)} de ${formatCbrBytes(total)}` : `${formatCbrBytes(received)} processados`);\n        }, () => {}, overlay._telegramDownloadController?.signal);');
console.log('Reader integration assertions passed');