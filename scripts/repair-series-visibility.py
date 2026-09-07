#!/usr/bin/env python3
"""Repair series visibility in the current main without replacing catalog data."""
from pathlib import Path
import re

p = Path('js/app.js')
s = p.read_text(encoding='utf-8')

def replace_once(old, new, label):
    global s
    if s.count(old) != 1:
        raise RuntimeError(f'{label}: expected one anchor, found {s.count(old)}')
    s = s.replace(old, new, 1)

# The original edition visibility functions were left below the new functions.
# Function declarations are hoisted, so the old versions silently replaced the
# series-aware versions. Remove only this duplicate block.
old = '''  function canViewCatalogItem(item, includeHidden = false) {
    const hiddenCharacter = characterNames(item).some(name => state.characterSettings.get(publisherKey(name))?.is_hidden);
    return (!isHiddenCatalogItem(item) && !hiddenCharacter) || (includeHidden && isAdminProfile());
  }
  function visibleCatalogItems(items = state.db.library, includeHidden = false) {
    return items.filter(item => canViewCatalogItem(item, includeHidden));
  }
  async function loadCatalogVisibility() {
    state.hiddenCatalogItemIds = new Set();'''
start = s.find(old)
if start < 0:
    raise RuntimeError('The duplicate legacy visibility block was not found')
end = s.find('\n  function loadDownloads()', start)
if end < 0:
    raise RuntimeError('Could not locate the end of the legacy block')
s = s[:start] + s[end:]

# Restore an explicit admin override while retaining the existing default
# behavior for callers. Hidden series must be checked in the canonical filter.
replace_once('''  function canViewCatalogItem(item, includeHidden = false) {
    const hiddenCharacter = characterNames(item).some(name => state.characterSettings.get(publisherKey(name))?.is_hidden);
    return (!isHiddenCatalogItem(item) && !isHiddenCatalogSeries(item?.seriesId) && !hiddenCharacter) || (includeHidden && isAdminProfile());
  }''', '''  function canViewCatalogItem(item, includeHidden = false) {
    if (!item) return false;
    const hiddenCharacter = characterNames(item).some(name => state.characterSettings.get(publisherKey(name))?.is_hidden);
    return (!isHiddenCatalogItem(item) && !isHiddenCatalogSeries(item.seriesId) && !hiddenCharacter) || (includeHidden && isAdminProfile());
  }''', 'Canonical visibility predicate')

# The first implementation referenced an undefined variable when opening the
# series modal. This must use the actual series argument.
replace_once('''    if (isHiddenCatalogSeries(item?.seriesId) && !isAdminProfile()) {
      toast("Esta série está temporariamente oculta.");
      return;
    }''', '''    if (isHiddenCatalogSeries(series?.seriesId || series?.id) && !isAdminProfile()) {
      toast("Esta série está temporariamente oculta.");
      return;
    }''', 'Series selection guard')

# Keep the original buttons, labels in accessibility attributes, and handlers.
# Only change the visible contents of the series visibility button.
replace_once('''>${hidden ? "◉ Mostrar série" : "⊘ Ocultar série"}</button>''', '''>${hidden ? "◉" : "⊘"}</button>''', 'Icon-only series button')

# The administrative status stays visible without adding text to the button.
# Add a discreet indicator only if the original status is absent.
assert 'Série${hidden ? " · Oculta" : ""}' in s

# Keep the database state even if a refresh fails, but do not silently report
# successful writes when the server returned no matching record.
start = s.index('  async function toggleCatalogSeriesVisibility(seriesId) {')
end = s.find('\n  function ', start)
if end < 0:
    raise RuntimeError('Cannot locate series visibility action boundary')
block = s[start:end]
block = block.replace('''    const result = hidden
      ? await sb.from("catalog_series_visibility").upsert({ series_id: id, is_hidden: true, updated_by: state.session.user.id }, { onConflict: "series_id" })
      : await sb.from("catalog_series_visibility").delete().eq("series_id", id);
    if (result.error) return toast(result.error.message || "Não foi possível alterar a visibilidade da série.");''', '''    const result = hidden
      ? await sb.from("catalog_series_visibility").upsert({ series_id: id, is_hidden: true, updated_by: state.session.user.id }, { onConflict: "series_id" }).select("series_id, is_hidden").single()
      : await sb.from("catalog_series_visibility").delete().eq("series_id", id).select("series_id").single();
    if (result.error || !result.data || String(result.data.series_id) !== id) return toast(result.error?.message || "Não foi possível confirmar a visibilidade da série.");''')
if '.select("series_id, is_hidden").single()' not in block:
    raise RuntimeError('Could not strengthen database confirmation')
s = s[:start] + block + s[end:]

# No old duplicate may remain after this patch.
for name in ('canViewCatalogItem', 'visibleCatalogItems', 'loadCatalogVisibility', 'toggleCatalogItemVisibility', 'toggleCatalogSeriesVisibility'):
    count = len(re.findall(r'(?m)^  (?:async )?function ' + name + r'\(', s))
    if count != 1:
        raise RuntimeError(f'{name}: found {count} declarations')

p.write_text(s, encoding='utf-8')

css_path = Path('css/style.css')
css = css_path.read_text(encoding='utf-8')
css += '''\n/* Compact series visibility control, without changing other footer actions. */\n.series-card-footer-actions .series-hide-toggle { display: inline-flex; align-items: center; justify-content: center; flex: 0 0 auto; width: 34px; height: 34px; padding: 0; line-height: 1; font-size: 20px; }\n'''
css_path.write_text(css, encoding='utf-8')

html_path = Path('index.html')
html = html_path.read_text(encoding='utf-8')
for asset in ('js/app.js', 'css/style.css'):
    pattern = re.escape(asset) + r'\?v=([0-9.]+)'
    def bump(match):
        parts = match.group(1).split('.')
        parts[-1] = str(int(parts[-1]) + 1)
        return asset + '?v=' + '.'.join(parts)
    html, count = re.subn(pattern, bump, html, count=1)
    if count != 1:
        raise RuntimeError(f'Missing asset version: {asset}')
html = re.sub(r'sw\.js\?v=\d+', 'sw.js?v=246', html)
html_path.write_text(html, encoding='utf-8')

sw_path = Path('sw.js')
sw = sw_path.read_text(encoding='utf-8')
sw, count = re.subn(r'banca-digital-shell-v\d+', lambda m: 'banca-digital-shell-v' + str(int(m.group(0).rsplit('v', 1)[1]) + 1), sw, count=1)
if count != 1:
    raise RuntimeError('Missing service worker cache version')
sw_path.write_text(sw, encoding='utf-8')
print('Removed duplicate visibility functions, repaired series guard, confirmed database writes, and made the button icon-only.')
