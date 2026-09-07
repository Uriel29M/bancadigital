#!/usr/bin/env python3
"""Patch verified anchors in the current checkout; preserve every catalog entry."""
from pathlib import Path
import re

path = Path('js/app.js')
app = path.read_text(encoding='utf-8')
original = app

def replace_once(old, new, label):
    global app
    count = app.count(old)
    if count != 1:
        raise RuntimeError(f'{label}: expected one anchor, found {count}')
    app = app.replace(old, new, 1)

replace_once('''  function telegramProxyUrl(item) {
    const postUrl = String(item?.telegramUrl || "").trim();
    const fileId = String(item?.telegramFileId || "").trim();
    if (!isTelegramPostUrl(postUrl) || !fileId || !window.BANCA_SUPABASE_URL) return "";
    const proxy = new URL(`${window.BANCA_SUPABASE_URL}/functions/v1/telegram-proxy`);
    proxy.searchParams.set("file_id", fileId);
    return proxy.toString();
  }''', '''  function telegramProxyUrl(item) {
    return window.BancaTelegram?.proxyUrl(item) || "";
  }''', 'Telegram source URL')

replace_once('  function openReader(item, options = {}) {', '''  function openReader(item, options = {}) {
    if (!item) return;
    if (!options.telegramResolved && !item.local && isTelegramPostUrl(item.telegramUrl) && navigator.onLine !== false && sb) {
      if (readerIsOpen && activeReaderCleanup && String(state.readerItemId || "") === String(item.id || "") && document.querySelector(".reader-overlay")) return;
      void window.BancaTelegram.published(item, sb).then(canonical => {
        if (!canonical.telegramFileId && !canonical.fileUrl) {
          toast("Esta postagem ainda não foi identificada pelo bot. Um administrador precisa salvar a edição novamente.");
          return;
        }
        openReader(canonical, { ...options, telegramResolved: true });
      }).catch(error => toast(`Não foi possível consultar a fonte do Telegram: ${error.message || error}`));
      return;
    }''', 'Canonical reader loading')

replace_once('''<div class="field full"><label>Telegram file_id (somente para postagem do Telegram)</label><input name="telegramFileId" value="${escapeHTML(x.telegramFileId || "")}" placeholder="BQACAg... (obtido pelo bot)"><small class="format-hint">O bot precisa estar no canal. Sem este ID, a postagem pode ser exibida, mas o leitor não consegue baixar o arquivo.</small></div>''', '''<div class="field full"><label>Arquivo do Telegram</label><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><button type="button" class="small-btn" data-resolve-telegram>Identificar arquivo</button><span data-telegram-status role="status" aria-live="polite">${x.telegramFileId ? "Arquivo identificado" : "Cole uma postagem para identificar o arquivo automaticamente."}</span></div><input name="telegramFileId" type="hidden" value="${escapeHTML(x.telegramFileId || "")}"><small class="format-hint">O bot identifica o PDF, CBZ ou CBR e salva apenas seus metadados. O arquivo permanece no Telegram.</small></div>''', 'Editor identifier field')

replace_once('''    source.addEventListener("input", () => preview.textContent = detectFormat(source.value));
    $("#edit-form", overlay).onsubmit''', '''    source.addEventListener("input", () => preview.textContent = detectFormat(source.value));
    const telegramEditor = window.BancaTelegram.bindEditor($("#edit-form", overlay), sb, x);
    $("#edit-form", overlay).onsubmit''', 'Editor automatic identification')

replace_once('''        const published = await saveCatalog("Edição salva.", item);''', '''        if (isTelegram) {
          submit.textContent = "Identificando arquivo…";
          Object.assign(item, await telegramEditor.forSave(item, sourceUrl));
        }
        submit.textContent = "Publicando edição...";
        const published = await saveCatalog("Edição salva.", item);''', 'Editor save resolution')

replace_once('''      } finally {
        form.dataset.saving = "false";
        submit.disabled = false;
        submit.textContent = "Salvar edição";
      }
    };
  }''', '''      } catch (error) {
        let status = form.querySelector('[data-publish-status]');
        if (!status) {
          status = document.createElement("p");
          status.dataset.publishStatus = "";
          status.setAttribute("role", "alert");
          form.appendChild(status);
        }
        status.textContent = error.message || "Não foi possível salvar a edição.";
      } finally {
        form.dataset.saving = "false";
        submit.disabled = false;
        submit.textContent = "Salvar edição";
      }
    };
  }''', 'Editor error handling')

fields_old = '["coverUrl", "cover", "featuredCoverUrl", "fileUrl", "telegramUrl", "telegramFileId", "backupUrls", "format"]'
fields_new = '["coverUrl", "cover", "featuredCoverUrl", "fileUrl", "telegramUrl", "telegramFileId", "telegramFileName", "telegramFileSize", "backupUrls", "format"]'
replace_once('const EDITION_SOURCE_FIELDS = ' + fields_old + ';', 'const EDITION_SOURCE_FIELDS = ' + fields_new + ';', 'Source fields')

if app == original: raise RuntimeError('No changes applied')
path.write_text(app, encoding='utf-8')

index = Path('index.html')
html = index.read_text(encoding='utf-8')
anchor = '<script src="js/catalog-sync.js?v=1"></script>'
if html.count(anchor) != 1: raise RuntimeError('HTML source anchor missing')
html = html.replace(anchor, anchor + '\n  <script src="js/telegram-auto.js?v=1"></script>')
html = re.sub(r'js/app\.js\?v=2\.2\.10\.\d+', 'js/app.js?v=2.2.10.448', html)
html = html.replace('./sw.js?v=240', './sw.js?v=241')
index.write_text(html, encoding='utf-8')

sw = Path('sw.js')
text = sw.read_text(encoding='utf-8').replace('banca-digital-shell-v582', 'banca-digital-shell-v583')
text = text.replace('js/app.js?v=2.2.10.447', 'js/app.js?v=2.2.10.448')
text = text.replace('"./js/catalog-sync.js?v=1",', '"./js/catalog-sync.js?v=1",\n  "./js/telegram-auto.js?v=1",')
text = text.replace('url.pathname.endsWith("/js/catalog-sync.js") ||', 'url.pathname.endsWith("/js/catalog-sync.js") ||\n    url.pathname.endsWith("/js/telegram-auto.js") ||')
sw.write_text(text, encoding='utf-8')

sync = Path('js/catalog-sync.js')
text = sync.read_text(encoding='utf-8')
if text.count(fields_old) != 1: raise RuntimeError('Shared source fields not found')
sync.write_text(text.replace(fields_old, fields_new), encoding='utf-8')
print('Patched application, editor, reader, shared metadata, HTML and service worker.')
