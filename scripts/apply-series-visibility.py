#!/usr/bin/env python3
"""Add series-level visibility without deleting editions or changing personal data."""
from pathlib import Path
import re

path = Path('js/app.js')
app = path.read_text(encoding='utf-8')
def once(old, new, label):
    global app
    n = app.count(old)
    if n != 1:
        raise RuntimeError(f'{label}: expected one anchor, found {n}')
    app = app.replace(old, new, 1)

def function(name):
    global app
    start = app.index('  function ' + name + '(') if '  function ' + name + '(' in app else app.index('  async function ' + name + '(')
    end = app.find('\n  function ', start + 5)
    async_end = app.find('\n  async function ', start + 5)
    ends = [e for e in [end, async_end] if e >= 0]
    return start, min(ends) if ends else len(app)

once('    hiddenCatalogItemIds: new Set(),', '    hiddenCatalogItemIds: new Set(),\n    hiddenCatalogSeriesIds: new Set(),', 'Visibility state')
start, end = function('isHiddenCatalogItem')
old = app[start:end]
new = '''  function isHiddenCatalogItem(item) {
    return Boolean(item?.id && state.hiddenCatalogItemIds?.has(String(item.id)));
  }
  function isHiddenCatalogSeries(seriesId) {
    return Boolean(seriesId && state.hiddenCatalogSeriesIds?.has(String(seriesId)));
  }
  function canViewCatalogItem(item, includeHidden = false) {
    const hiddenCharacter = characterNames(item).some(name => state.characterSettings.get(publisherKey(name))?.is_hidden);
    return (!isHiddenCatalogItem(item) && !isHiddenCatalogSeries(item?.seriesId) && !hiddenCharacter) || (includeHidden && isAdminProfile());
  }
  function visibleCatalogItems(items = state.db.library, includeHidden = isAdminProfile()) {
    return items.filter(item => canViewCatalogItem(item, includeHidden));
  }
  async function loadCatalogVisibility() {
    if (!sb || navigator.onLine === false) return;
    const [editions, series] = await Promise.all([
      sb.from("catalog_item_visibility").select("item_id, is_hidden"),
      sb.from("catalog_series_visibility").select("series_id, is_hidden")
    ]);
    if (editions.error) console.warn("Não foi possível carregar a visibilidade das edições:", editions.error.message);
    else state.hiddenCatalogItemIds = new Set((editions.data || []).filter(row => row.is_hidden).map(row => String(row.item_id)));
    if (series.error) console.warn("Não foi possível carregar a visibilidade das séries:", series.error.message);
    else state.hiddenCatalogSeriesIds = new Set((series.data || []).filter(row => row.is_hidden).map(row => String(row.series_id)));
  }
  async function toggleCatalogItemVisibility(itemId) {
    if (!isAdminProfile()) return toast("Apenas administradores podem ocultar edições.");
    const id = String(itemId || "");
    if (!id || !sb || !state.session?.user?.id) return toast("A visibilidade precisa ser alterada com o banco online.");
    const hidden = !state.hiddenCatalogItemIds.has(id);
    const result = hidden
      ? await sb.from("catalog_item_visibility").upsert({ item_id: id, is_hidden: true, updated_by: state.session.user.id }, { onConflict: "item_id" })
      : await sb.from("catalog_item_visibility").delete().eq("item_id", id);
    if (result.error) return toast(result.error.message || "Não foi possível alterar a visibilidade.");
    if (hidden) state.hiddenCatalogItemIds.add(id); else state.hiddenCatalogItemIds.delete(id);
    render();
    toast(hidden ? "Edição ocultada para usuários comuns." : "Edição visível novamente para todos.");
  }
  async function toggleCatalogSeriesVisibility(seriesId) {
    if (!isAdminProfile() || state.session?.offline) return toast("Apenas administradores podem ocultar séries.");
    const id = String(seriesId || "");
    if (!id || !sb || !state.session?.user?.id) return toast("A visibilidade precisa ser alterada com o banco online.");
    const hidden = !state.hiddenCatalogSeriesIds.has(id);
    const result = hidden
      ? await sb.from("catalog_series_visibility").upsert({ series_id: id, is_hidden: true, updated_by: state.session.user.id }, { onConflict: "series_id" })
      : await sb.from("catalog_series_visibility").delete().eq("series_id", id);
    if (result.error) return toast(result.error.message || "Não foi possível alterar a visibilidade da série.");
    if (hidden) state.hiddenCatalogSeriesIds.add(id); else state.hiddenCatalogSeriesIds.delete(id);
    render();
    toast(hidden ? "Série ocultada para usuários comuns." : "Série visível novamente para todos.");
  }
'''
app = app[:start] + new + app[end:]

# Keep hidden editions in the catalog when a series is opened or reconciled.
start, end = function('seriesEditions')
section = app[start:end]
section = section.replace('const current = visibleCatalogItems().filter(x => x.seriesId === item.seriesId);', 'const current = state.db.library.filter(x => x.seriesId === item.seriesId);', 1)
if 'const current = state.db.library.filter(x => x.seriesId === item.seriesId);' not in section:
    raise RuntimeError('Series reconciliation anchor changed')
app = app[:start] + section + app[end:]

# Add the control to the series card, not to the edition card or cover chooser.
start, end = function('seriesCard')
section = app[start:end]
section = section.replace('    const saved = favoriteIds.has(item.seriesId);', '    const saved = favoriteIds.has(item.seriesId);\n    const hidden = isHiddenCatalogSeries(item.seriesId);', 1)
section = section.replace('    const seriesName = series.name || series.seriesTitle;', '''    const visibilityButton = isAdminProfile() ? `<button type="button" class="series-hide-toggle ${hidden ? "is-hidden" : ""}" data-hide-series="${escapeHTML(item.seriesId)}" title="${hidden ? "Mostrar série para todos" : "Ocultar série para usuários comuns"}" aria-label="${hidden ? "Mostrar série para todos" : "Ocultar série para usuários comuns"}">${hidden ? "◉ Mostrar série" : "⊘ Ocultar série"}</button>` : "";
    const seriesName = series.name || series.seriesTitle;''', 1)
section = section.replace('<article class="series-card" data-open-series=', '<article class="series-card ${hidden ? "is-hidden" : ""}" data-open-series=', 1)
section = section.replace('<div class="eyebrow">Série</div>', '<div class="eyebrow">Série${hidden ? " · Oculta" : ""}</div>', 1)
section = section.replace('${seriesCoverChoiceButton}${seriesCoverEffects}<button type="button" class="series-save-button', '${seriesCoverChoiceButton}${seriesCoverEffects}${visibilityButton}<button type="button" class="series-save-button', 1)
if section.count('data-hide-series=') != 1 or 'visibilityButton' not in section:
    raise RuntimeError('Series card control could not be inserted')
app = app[:start] + section + app[end:]

# Existing delegated bindings are preserved; the new control uses a separate handler.
old = '''    $$('[data-hide-item]').forEach(el => el.addEventListener("click", event => {
      event.stopPropagation();
      toggleCatalogItemVisibility(el.dataset.hideItem);
    }));'''
new = old + '''
    $$('[data-hide-series]').forEach(el => el.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      if (el.disabled) return;
      el.disabled = true;
      Promise.resolve(toggleCatalogSeriesVisibility(el.dataset.hideSeries)).finally(() => { if (el.isConnected) el.disabled = false; });
    }));'''
once(old, new, 'Card event binding')

# Prevent direct entry to hidden series, while retaining the administrator view.
start, end = function('openSeriesSelection')
section = app[start:end]
brace = section.index('{')
section = section[:brace+1] + '''
    if (isHiddenCatalogSeries(item?.seriesId) && !isAdminProfile()) {
      toast("Esta série está temporariamente oculta.");
      return;
    }
''' + section[brace+1:]
app = app[:start] + section + app[end:]

# Check visibility before resolving remote Telegram metadata or opening external sources.
start, end = function('openReader')
section = app[start:end]
section = section.replace('    if (!item) return;', '''    if (!item) return;
    if (!canViewCatalogItem(item, isAdminProfile())) {
      toast("Esta edição está temporariamente oculta.");
      return;
    }''', 1)
section = section.replace('    if (!canViewCatalogItem(item)) {', '    if (!canViewCatalogItem(item, isAdminProfile())) {', 1)
app = app[:start] + section + app[end:]

# A directly linked reader route must not leave a hidden item active for ordinary visitors.
start, end = function('applyRoute')
section = app[start:end]
section = section.replace('const item = readerId ? state.db.library.find(entry => entry.id === readerId) : null;', 'const item = readerId ? state.db.library.find(entry => entry.id === readerId && canViewCatalogItem(entry, isAdminProfile())) : null;', 1)
app = app[:start] + section + app[end:]

# Refresh changes across open sessions without altering the edition visibility mechanism.
anchor = '  BancaCatalogSync.start(sb, refreshSharedCatalog);'
if app.count(anchor) != 1: raise RuntimeError('Shared catalog bootstrap anchor changed')
app = app.replace(anchor, '''  if (sb) sb.channel("banca-series-visibility").on("postgres_changes", { event: "*", schema: "public", table: "catalog_series_visibility" }, () => {
    loadCatalogVisibility().then(() => { if (!readerIsOpen) render(); }).catch(error => console.warn("Visibilidade das séries indisponível:", error));
  }).subscribe();
''' + anchor, 1)

path.write_text(app, encoding='utf-8')
html_path = Path('index.html')
html = html_path.read_text(encoding='utf-8')
html, n = re.subn(r'js/app\.js\?v=2\.2\.10\.(\d+)', lambda m: 'js/app.js?v=2.2.10.' + str(int(m.group(1))+1), html, count=1)
if n != 1: raise RuntimeError('App cache version missing')
html = re.sub(r'sw\.js\?v=\d+', 'sw.js?v=245', html)
html_path.write_text(html, encoding='utf-8')
sw_path = Path('sw.js')
sw = sw_path.read_text(encoding='utf-8')
sw, n = re.subn(r'banca-digital-shell-v\d+', lambda m: 'banca-digital-shell-v' + str(int(m.group(0).rsplit('v',1)[1])+1), sw, count=1)
if n != 1: raise RuntimeError('Service worker cache version missing')
sw_path.write_text(sw, encoding='utf-8')
css_path = Path('css/style.css')
css = css_path.read_text(encoding='utf-8')
css += '''\n/* Editorial series visibility. Existing cover and save buttons are unchanged. */\n.series-hide-toggle { border: 1px solid var(--border, #777); border-radius: 8px; padding: 6px 10px; background: transparent; color: inherit; font: inherit; cursor: pointer; }\n.series-hide-toggle.is-hidden { border-style: dashed; }\n.series-card.is-hidden { opacity: .65; }\n.series-hide-toggle:disabled { opacity: .5; cursor: wait; }\n'''
css_path.write_text(css, encoding='utf-8')
html = html_path.read_text(encoding='utf-8')
html, n = re.subn(r'css/style\.css\?v=2\.2\.10\.(\d+)', lambda m: 'css/style.css?v=2.2.10.' + str(int(m.group(1))+1), html, count=1)
if n != 1: raise RuntimeError('CSS cache version missing')
html_path.write_text(html, encoding='utf-8')
print('Series visibility patch applied without removing edition records or modifying cover-choice actions.')
