#!/usr/bin/env python3
"""Patch the current application without replacing any catalog data or unrelated features."""
from pathlib import Path
import re

app_path = Path('js/app.js')
app = app_path.read_text(encoding='utf-8')
def replace_once(old, new, label):
    global app
    count = app.count(old)
    if count != 1:
        raise RuntimeError(f'{label}: expected one anchor, found {count}')
    app = app.replace(old, new, 1)

replace_once('''    const rawSource = String(url || "").trim();
    const source = legacyCoverUrls[rawSource] || rawSource;''', '''    const rawSource = String(url || "").trim();
    if (window.BancaTelegramCovers?.isPost(rawSource)) return window.BancaTelegramCovers.publicUrl(rawSource);
    const source = legacyCoverUrls[rawSource] || rawSource;''', 'Image proxy')

replace_once('''<div class="field full"><label>Link da capa (opcional)</label><input name="coverUrl" type="url" value="${escapeHTML(x.coverUrl || "")}" placeholder="https://.../capa.jpg"><small class="format-hint">Se preenchido, será usada como capa da edição em vez da primeira página do arquivo.</small></div>''', '''<div class="field full"><label>Link da capa (opcional)</label><input name="coverUrl" type="url" value="${escapeHTML(x.coverUrl || "")}" placeholder="https://t.me/bancahq/123 ou https://.../capa.jpg"><small class="format-hint">Aceita imagem direta ou postagem de foto/imagem do Telegram. Se preenchido, substitui a primeira página do arquivo.</small><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><button type="button" class="small-btn" data-resolve-telegram-cover="coverUrl">Identificar imagem</button><span data-telegram-cover-status="coverUrl" role="status" aria-live="polite"></span></div></div>''', 'Cover editor')
replace_once('''<div class="field full"><label>Imagem exclusiva do destaque (opcional)</label><input name="featuredCoverUrl" type="url" value="${escapeHTML(x.featuredCoverUrl || "")}" placeholder="https://.../capa-do-destaque.jpg"><small class="format-hint">Use uma imagem horizontal ou uma capa em alta resolução para controlar melhor o destaque.</small></div>''', '''<div class="field full"><label>Imagem exclusiva do destaque (opcional)</label><input name="featuredCoverUrl" type="url" value="${escapeHTML(x.featuredCoverUrl || "")}" placeholder="https://t.me/bancahq/123 ou https://.../capa-do-destaque.jpg"><small class="format-hint">Aceita imagem direta ou postagem do Telegram. Use uma imagem horizontal ou em alta resolução para o destaque.</small><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><button type="button" class="small-btn" data-resolve-telegram-cover="featuredCoverUrl">Identificar imagem</button><span data-telegram-cover-status="featuredCoverUrl" role="status" aria-live="polite"></span></div></div>''', 'Featured cover editor')
replace_once('''    const telegramEditor = window.BancaTelegram.bindEditor($("#edit-form", overlay), sb, x);''', '''    const telegramEditor = window.BancaTelegram.bindEditor($("#edit-form", overlay), sb, x);
    const telegramCoverEditor = window.BancaTelegramCovers.bindEditor($("#edit-form", overlay), sb);''', 'Cover editor binding')
replace_once('''      try {
        if (isTelegram) {
          submit.textContent = "Identificando arquivo…";''', '''      try {
        if (window.BancaTelegramCovers.isPost(item.coverUrl) || window.BancaTelegramCovers.isPost(item.featuredCoverUrl)) {
          submit.textContent = "Identificando capas…";
          Object.assign(item, await telegramCoverEditor.forSave(item, { coverUrl: item.coverUrl, featuredCoverUrl: item.featuredCoverUrl }));
        }
        if (isTelegram) {
          submit.textContent = "Identificando arquivo…";''', 'Cover registration before publication')
app_path.write_text(app, encoding='utf-8')

index = Path('index.html')
html = index.read_text(encoding='utf-8')
anchor = '<script src="js/telegram-auto.js?v=1"></script>'
if html.count(anchor) != 1: raise RuntimeError('Telegram script anchor missing')
html = html.replace(anchor, anchor + '\n  <script src="js/telegram-covers.js?v=1"></script>')
html = re.sub(r'js/app\.js\?v=2\.2\.10\.\d+', 'js/app.js?v=2.2.10.449', html)
html = re.sub(r'\./sw\.js\?v=\d+', './sw.js?v=242', html)
index.write_text(html, encoding='utf-8')

sw = Path('sw.js')
text = sw.read_text(encoding='utf-8')
text, count = re.subn(r'banca-digital-shell-v\d+', 'banca-digital-shell-v584', text)
if count != 1: raise RuntimeError('Service worker version anchor missing')
text = re.sub(r'js/app\.js\?v=2\.2\.10\.\d+', 'js/app.js?v=2.2.10.449', text)
anchor = '"./js/telegram-auto.js?v=1",'
if text.count(anchor) != 1: raise RuntimeError('Service worker script anchor missing')
text = text.replace(anchor, anchor + '\n  "./js/telegram-covers.js?v=1",')
anchor = 'url.pathname.endsWith("/js/telegram-auto.js") ||'
if anchor in text:
    text = text.replace(anchor, anchor + '\n    url.pathname.endsWith("/js/telegram-covers.js") ||')
else:
    anchor = 'url.pathname.endsWith("/js/catalog-sync.js") ||'
    if text.count(anchor) != 1: raise RuntimeError('Service worker network-first anchor missing')
    text = text.replace(anchor, anchor + '\n    url.pathname.endsWith("/js/telegram-covers.js") ||')
sw.write_text(text, encoding='utf-8')
print('Patched image proxy, both cover fields, admin registration, HTML and service worker.')
