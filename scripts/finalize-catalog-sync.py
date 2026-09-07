from pathlib import Path

path = Path('js/app.js')
source = path.read_text(encoding='utf-8')
old = '''  refreshSharedCatalog()
    .then(() => BancaCatalogSync.start(sb, refreshSharedCatalog))
    .catch(error => console.warn("Catálogo compartilhado indisponível; usando cópia local:", error));'''
new = '''  BancaCatalogSync.start(sb, refreshSharedCatalog);
  refreshSharedCatalog()
    .catch(error => console.warn("Catálogo compartilhado indisponível; usando cópia local:", error));'''
if source.count(old) != 1:
    raise RuntimeError('Shared catalog bootstrap does not match the verified version')
source = source.replace(old, new, 1)
path.write_text(source, encoding='utf-8')

# The test suite also covers retry registration and the deployed publisher's
# protection against stale browser payloads.
path = Path('scripts/test-shared-catalog.mjs')
source = path.read_text(encoding='utf-8')
source += '''\ntest('catalog recovery remains registered if the first request fails', () => {
  const app = readFileSync('js/app.js', 'utf8');
  assert.match(app, /BancaCatalogSync\\.start\\(sb, refreshSharedCatalog\\);\\s*refreshSharedCatalog\\(\\)/);
  assert.match(app, /window\\.BancaCatalogSync\\?\\.applyEdition/);
});
test('server publisher reconciles shared records before writing GitHub', () => {
  const server = readFileSync('supabase/functions/github-catalog/index.ts', 'utf8');
  assert.match(server, /from\\("catalog_edition_overrides"\\)/);
  assert.match(server, /const library = reconcile\\(payload\\.library/);
  assert.match(server, /catalogEditedAt: record\\.updated_at/);
  assert.match(server, /profile\\?\\.plan !== "admin"/);
});
'''
path.write_text(source, encoding='utf-8')
print('Bootstrap recovery and server reconciliation tests prepared.')
