#!/usr/bin/env python3
"""Apply a narrow, repeatable patch to the current application source."""
from pathlib import Path
import re

app_path = Path('js/app.js')
app = app_path.read_text(encoding='utf-8')
def once(old, new, label):
    global app
    count = app.count(old)
    if count != 1:
        raise RuntimeError(f'{label}: expected one anchor, found {count}')
    app = app.replace(old, new, 1)

once('''    const selectedCover = activeChoices?.get?.(item?.seriesId)?.cover_url;
    if (selectedCover && !/^assets\\/covers\\/milestone\\//i.test(String(selectedCover))) return proxiedImageUrl(selectedCover);
    return coverFor(item);''', '''    const selectedCover = activeChoices?.get?.(item?.seriesId)?.cover_url;
    if (selectedCover && !/^assets\\/covers\\/milestone\\//i.test(String(selectedCover))) return proxiedImageUrl(selectedCover);
    const editorialDefault = window.BancaSeriesDefaults?.get(item?.seriesId)?.cover_url;
    if (editorialDefault) return proxiedImageUrl(editorialDefault);
    return coverFor(item);''', 'Series cover fallback')

start = app.index('  function openSeriesCoverChoice(seriesId) {')
end = app.find('\n  function ', start + 5)
if end < 0: raise RuntimeError('Could not locate chooser boundary')
chooser = app[start:end]
if chooser.count('const current = state.seriesCoverChoices.get(seriesId);') != 1: raise RuntimeError('Chooser changed')
chooser = chooser.replace('const current = state.seriesCoverChoices.get(seriesId);', '''const current = state.seriesCoverChoices.get(seriesId);
    const editorialDefault = window.BancaSeriesDefaults?.get(seriesId);
    const canSetDefault = state.profile?.plan === "admin";''', 1)
chooser = chooser.replace('(!current && option.key === `standard:${editions[0].id}`)', '''(!current && editorialDefault?.item_id === option.itemId && Boolean(editorialDefault?.is_variant) === option.isVariant && (option.isVariant ? editorialDefault?.variant_key === option.variantKey : true)) || (!current && !editorialDefault && option.key === `standard:${editions[0].id}`)''', 1)
chooser = chooser.replace('''<div class="modal-actions"><button type="button" class="small-btn" data-close>Cancelar</button><button class="btn btn-danger">Salvar capa</button></div></form>''', '''${canSetDefault ? `<div class="series-cover-editorial-actions"><button type="button" class="small-btn" data-set-series-default>Definir como capa padrão da série</button><p class="format-hint" data-series-default-status role="status" aria-live="polite">A capa padrão aparece para quem ainda não escolheu uma capa pessoal.</p></div>` : ""}<div class="modal-actions"><button type="button" class="small-btn" data-close>Cancelar</button><button class="btn btn-danger">Salvar capa</button></div></form>''', 1)
needle = '''    $("#series-cover-choice-form", overlay).onsubmit = async event => {'''
if chooser.count(needle) != 1: raise RuntimeError('Chooser submit changed')
chooser = chooser.replace(needle, '''    const defaultButton = $('[data-set-series-default]', overlay);
    if (defaultButton) defaultButton.onclick = async () => {
      if (state.profile?.plan !== "admin" || !state.session?.user?.id) return toast("Somente administradores podem definir a capa padrão.");
      const form = $("#series-cover-choice-form", overlay);
      const selected = options.find(option => option.key === String(new FormData(form).get("seriesCoverKey")));
      if (!selected) return toast("Selecione uma capa antes de definir o padrão.");
      const status = $('[data-series-default-status]', overlay);
      defaultButton.disabled = true;
      defaultButton.textContent = "Definindo capa padrão…";
      try {
        await window.BancaSeriesDefaults.setDefault(seriesId, selected, state.session.user.id);
        if (status) status.textContent = "Capa padrão da série atualizada para todos os usuários sem escolha pessoal.";
        toast("Capa padrão da série atualizada.");
        updateSeriesCoverImages(seriesId);
        render();
      } catch (error) {
        if (status) status.textContent = error.message || "Não foi possível definir a capa padrão.";
        toast(error.message || "Não foi possível definir a capa padrão.");
      } finally {
        defaultButton.disabled = false;
        defaultButton.textContent = "Definir como capa padrão da série";
      }
    };
''' + needle, 1)
app = app[:start] + chooser + app[end:]

once('''  BancaCatalogSync.start(sb, refreshSharedCatalog);''', '''  window.BancaSeriesDefaults?.start(sb, seriesId => {
    if (seriesId) updateSeriesCoverImages(seriesId);
    if (state.authReady && state.section !== "reader" && !readerIsOpen) render();
  })?.catch(error => console.warn("Capas padrão compartilhadas indisponíveis:", error));
  BancaCatalogSync.start(sb, refreshSharedCatalog);''', 'Bootstrap')
app_path.write_text(app, encoding='utf-8')

html_path = Path('index.html')
html = html_path.read_text(encoding='utf-8')
if 'js/series-default-covers.js' not in html:
    html = html.replace('<script src="js/telegram-auto.js?v=1"></script>', '<script src="js/telegram-auto.js?v=1"></script>\n  <script src="js/series-default-covers.js?v=1"></script>', 1)
html, count = re.subn(r'js/app\.js\?v=2\.2\.10\.(\d+)', lambda m: 'js/app.js?v=2.2.10.' + str(int(m.group(1))+1), html, count=1)
if count != 1: raise RuntimeError('App version anchor missing')
html = re.sub(r'sw\.js\?v=\d+', 'sw.js?v=243', html)
html_path.write_text(html, encoding='utf-8')
sw_path = Path('sw.js')
sw = sw_path.read_text(encoding='utf-8')
sw = re.sub(r'banca-digital-shell-v\d+', 'banca-digital-shell-v584', sw)
if 'js/series-default-covers.js' not in sw:
    sw = sw.replace('"./js/catalog-sync.js",', '"./js/catalog-sync.js",\n  "./js/series-default-covers.js",', 1)
sw_path.write_text(sw, encoding='utf-8')
print('Patched shared default fallback, administrative chooser action, account-independent loading and cache versions.')
