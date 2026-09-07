#!/usr/bin/env python3
"""Move only the editorial action into the existing series-cover footer."""
from pathlib import Path
import re

app_path = Path('js/app.js')
app = app_path.read_text(encoding='utf-8')
start = app.index('  function openSeriesCoverChoice(seriesId) {')
end = app.find('\n  function ', start + 5)
if end < 0:
    raise RuntimeError('Series chooser boundary not found')
chooser = app[start:end]
old = '''${canSetDefault ? `<div class="series-cover-editorial-actions"><button type="button" class="small-btn" data-set-series-default>Definir como capa padrão da série</button><p class="format-hint" data-series-default-status role="status" aria-live="polite">A capa padrão aparece para quem ainda não escolheu uma capa pessoal.</p></div>` : ""}<div class="modal-actions"><button type="button" class="small-btn" data-close>Cancelar</button><button class="btn btn-danger">Salvar capa</button></div>'''
new = '''<div class="modal-actions series-cover-choice-actions">${canSetDefault ? `<button type="button" class="small-btn" data-set-series-default>Definir como capa padrão da série</button>` : ""}<button type="button" class="small-btn" data-close>Cancelar</button><button class="btn btn-danger">Salvar capa</button></div>${canSetDefault ? `<p class="format-hint" data-series-default-status role="status" aria-live="polite">A capa padrão aparece para quem ainda não escolheu uma capa pessoal.</p>` : ""}'''
if chooser.count(old) != 1:
    raise RuntimeError('Expected original action layout exactly once')
original_handler = chooser[chooser.index('    const defaultButton ='):chooser.index('    $("#series-cover-choice-form", overlay).onsubmit')]
chooser = chooser.replace(old, new, 1)
assert original_handler in chooser, 'The default action handler must remain unchanged'
assert '<button type="button" class="small-btn" data-close>Cancelar</button><button class="btn btn-danger">Salvar capa</button>' in chooser
app = app[:start] + chooser + app[end:]
app_path.write_text(app, encoding='utf-8')

css_path = Path('css/style.css')
css = css_path.read_text(encoding='utf-8')
rule = '''\n/* Keep the three series-cover actions together; wrap only on narrow screens. */\n.series-cover-choice-actions { display: flex; align-items: center; justify-content: flex-end; flex-wrap: wrap; gap: 8px; }\n.series-cover-choice-actions > button { max-width: 100%; white-space: normal; }\n'''
if rule not in css:
    css += rule
css_path.write_text(css, encoding='utf-8')

html_path = Path('index.html')
html = html_path.read_text(encoding='utf-8')
html, app_count = re.subn(r'js/app\.js\?v=2\.2\.10\.(\d+)', lambda m: 'js/app.js?v=2.2.10.' + str(int(m.group(1)) + 1), html, count=1)
html, css_count = re.subn(r'css/style\.css\?v=2\.2\.10\.(\d+)', lambda m: 'css/style.css?v=2.2.10.' + str(int(m.group(1)) + 1), html, count=1)
if app_count != 1 or css_count != 1:
    raise RuntimeError('Cache version anchors not found')
html = re.sub(r'sw\.js\?v=\d+', 'sw.js?v=244', html)
html_path.write_text(html, encoding='utf-8')
sw_path = Path('sw.js')
sw = sw_path.read_text(encoding='utf-8')
sw, count = re.subn(r'banca-digital-shell-v\d+', lambda m: 'banca-digital-shell-v' + str(int(m.group(0).rsplit('v', 1)[1]) + 1), sw, count=1)
if count != 1:
    raise RuntimeError('Service worker cache anchor not found')
sw_path.write_text(sw, encoding='utf-8')
print('Moved the existing administrator button into the original footer; Cancelar, Salvar capa, and their handlers remain unchanged.')
