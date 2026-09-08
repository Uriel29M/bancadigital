#!/usr/bin/env python3
"""Apply only the Telegram reader integration to the verified production source."""
from pathlib import Path
import hashlib
import sys
root = Path(sys.argv[1] if len(sys.argv) > 1 else '.')
p = root / 'js/app.js'
s = p.read_text(encoding='utf-8')
def git_blob(text):
    data = text.encode('utf-8')
    return hashlib.sha1(f'blob {len(data)}\0'.encode() + data).hexdigest()
if git_blob(s) != '75dacd73ef71995e2014e8b12530b80b1eb8ac33':
    raise RuntimeError('app.js mudou. Não substituir alterações recentes; revisar o patch.')
def replace(old, new):
    global s
    n = s.count(old)
    if n != 1:
        raise RuntimeError(f'Expected one match, found {n}: {old[:100]}')
    s = s.replace(old, new, 1)
replace('if (!url || /^blob:/i.test(url)) return true;', 'if (!url || /^blob:/i.test(url) || isTelegramMediaUrl(url)) return true;')
replace('''      if (!item.local && sourceCandidates.length && !isImage) {
        selectedIndex = -1;''', '''      if (!item.local && sourceCandidates.length && !isImage && !isTelegramMediaUrl(resolvedUrl)) {
        selectedIndex = -1;''')
replace('''      const signature = await probeArchiveSignature(url);
      if (isZipSignature(signature)) {''', '''      const signature = isTelegramMediaUrl(url) ? null : await probeArchiveSignature(url);
      if (isZipSignature(signature)) {''')
replace('''      const archiveSignature = await probeArchiveSignature(url);
      if (isRarSignature(archiveSignature)) {''', '''      const archiveSignature = isTelegramMediaUrl(url) ? null : await probeArchiveSignature(url);
      if (isRarSignature(archiveSignature)) {''')
start = s.index('  async function fetchTelegramTemporaryBuffer(')
end = s.index('\n  async function fetchFileArrayBuffer(', start)
s = s[:start] + '''  async function fetchTelegramTemporaryBuffer(url, onProgress = () => {}, onComplete = () => {}, signal = null) {
    const { downloadTelegramBuffer } = await import(appAssetUrl("js/telegram-reader.mjs"));
    return downloadTelegramBuffer(url, onProgress, onComplete, signal);
  }
''' + s[end:]
replace('''    let objectUrl = null;
    let archive = null;
    let objectUrls = null; // For continuous scroll''', '''    const downloadController = new AbortController();
    overlay._cbrDownloadController = downloadController;
    let objectUrl = null;
    let archive = null;
    let objectUrls = null; // For continuous scroll''')
replace('''          const value = total ? (received / total) * 100 : 0;
        showCbrProgress("Abrindo arquivo CBR…", value, total ? `${value.toFixed(0)}% · ${formatCbrBytes(received)} de ${formatCbrBytes(total)}` : `${formatCbrBytes(received)} processados`);
        });''', '''          const value = total ? (received / total) * 100 : 0;
        showCbrProgress("Abrindo arquivo CBR…", value, total ? `${value.toFixed(0)}% · ${formatCbrBytes(received)} de ${formatCbrBytes(total)}` : `${formatCbrBytes(received)} processados`);
        }, undefined, downloadController.signal);''')
replace('''      overlay._cbzDownloadController?.abort();
      overlay.remove();''', '''      overlay._cbzDownloadController?.abort();
      overlay._cbrDownloadController?.abort();
      overlay.remove();''')
replace('''        fail(
          "O MediaFire não entregou o CBR.",
          "O servidor devolveu uma página HTML em vez do arquivo. Confirme o link permanente do MediaFire e se a Edge Function mediafire-proxy foi publicada."
        );''', '''        fail(
          isTelegramMediaUrl(url) ? "O Telegram não entregou o CBR." : "O MediaFire não entregou o CBR.",
          isTelegramMediaUrl(url) ? "O gateway retornou HTML em vez do arquivo. Confira a fonte cadastrada." : "O servidor devolveu uma página HTML em vez do arquivo. Confirme o link permanente do MediaFire e se a Edge Function mediafire-proxy foi publicada."
        );''')
replace('''    if (!/^https?:\/\//i.test(url) || !["pdf", "cbz", "cbr"].includes(format)) return null;
    if (readerFilePrefetches.has(url))''', '''    if (!/^https?:\/\//i.test(url) || !["pdf", "cbz", "cbr"].includes(format)) return null;
    if (isTelegramMediaUrl(url)) return null;
    if (readerFilePrefetches.has(url))''')
p.write_text(s, encoding='utf-8')
html = root / 'index.html'
h = html.read_text(encoding='utf-8')
old = 'js/app.js?v=2.2.10.454'
if h.count(old) != 1: raise RuntimeError('Unexpected app.js version')
h = h.replace(old, 'js/app.js?v=2.2.10.455')
html.write_text(h, encoding='utf-8')
sw = root / 'sw.js'
w = sw.read_text(encoding='utf-8')
if w.count('banca-digital-shell-v590') != 1: raise RuntimeError('Unexpected service worker version')
w = w.replace('banca-digital-shell-v590', 'banca-digital-shell-v591')
if w.count('js/app.js?v=2.2.10.449') != 1: raise RuntimeError('Unexpected cached app version')
w = w.replace('js/app.js?v=2.2.10.449', 'js/app.js?v=2.2.10.455')
w = w.replace('  "./js/telegram-auto.js?v=2",', '  "./js/telegram-auto.js?v=2",\n  "./js/telegram-reader.mjs",', 1)
sw.write_text(w, encoding='utf-8')
print('Reader integration applied to verified main; only app.js, index.html and sw.js changed.')
