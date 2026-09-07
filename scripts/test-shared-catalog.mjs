import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const source = readFileSync('js/catalog-sync.js', 'utf8');
function setup() {
  const window = { addEventListener() {}, setInterval() {} };
  const context = vm.createContext({ window, document: { addEventListener() {}, hidden: false }, navigator: { onLine: true }, console, Map, Set });
  vm.runInContext(source, context);
  return window.BancaCatalogSync;
}
const old = { id: 'test-1', title: 'Teste', coverUrl: 'old.jpg', fileUrl: 'old.pdf', catalogEditedAt: '2026-01-01T00:00:00Z' };
const edition = { ...old, coverUrl: 'new.jpg', fileUrl: 'new.pdf', catalogEditedAt: '2026-09-07T00:00:00Z' };
const record = { item_id: 'test-1', edition, updated_at: '2026-09-07T00:00:00Z' };

test('authoritative edition replaces stale local sources', () => {
  const sync = setup();
  sync.accept([record]);
  const actual = sync.merge([old])[0];
  assert.equal(actual.coverUrl, 'new.jpg');
  assert.equal(actual.fileUrl, 'new.pdf');
});
test('an explicitly cleared cover or link cannot inherit an obsolete value', () => {
  const sync = setup();
  const actual = sync.applyEdition(old, { ...edition, coverUrl: '', fileUrl: '', telegramUrl: '' });
  assert.equal(actual.coverUrl, '');
  assert.equal(actual.fileUrl, '');
  assert.equal(actual.telegramUrl, '');
});
test('new published editions are included without duplicating existing ones', () => {
  const sync = setup();
  sync.accept([record]);
  assert.equal(sync.merge([]).length, 1);
  assert.equal(sync.merge([old]).length, 1);
});
test('older network responses cannot roll back a newer record', () => {
  const sync = setup();
  sync.accept([record]);
  sync.accept([{ ...record, edition: old, updated_at: '2026-01-01T00:00:00Z' }]);
  assert.equal(sync.merge([old])[0].coverUrl, 'new.jpg');
});
test('an administrator write is confirmed before being accepted', async () => {
  const sync = setup();
  const client = { from(table) { assert.equal(table, 'catalog_edition_overrides'); return { upsert(payload, options) {
    assert.equal(options.onConflict, 'item_id');
    assert.equal(payload.updated_by, 'admin-id');
    return { select() { return { single: async () => ({ data: record, error: null }) }; } };
  } }; } };
  const actual = await sync.publish(client, edition, 'admin-id');
  assert.equal(actual.edition.fileUrl, 'new.pdf');
  assert.equal(sync.rows.get('test-1').edition.coverUrl, 'new.jpg');
});
test('failed writes are not reported as successful', async () => {
  const sync = setup();
  const client = { from() { return { upsert() { return { select() { return { single: async () => ({ data: null, error: new Error('Forbidden') }) }; } }; } }; } };
  await assert.rejects(sync.publish(client, edition, 'admin-id'), /Forbidden/);
  assert.equal(sync.rows.size, 0);
});
test('editor writes the shared record before changing the local catalog', () => {
  const app = readFileSync('js/app.js', 'utf8');
  const start = app.lastIndexOf('  function openEditForm(');
  const editor = app.slice(start, app.indexOf('\n  }', start));
  assert.match(editor, /saveCatalog\("Edição salva\."[,] item\)/);
  assert.doesNotMatch(editor.slice(0, editor.indexOf('const published = await saveCatalog')), /state\.db\.library\[index\] = item/);
  assert.match(app, /BancaCatalogSync\.publish\(sb, edition, state\.session\.user\.id\)/);
  assert.match(app, /BancaCatalogSync\.start\(sb, refreshSharedCatalog\)/);
  assert.match(app, /const library = BancaCatalogSync\.merge\(state\.db\.library\)/);
});

test('catalog recovery remains registered if the first request fails', () => {
  const app = readFileSync('js/app.js', 'utf8');
  assert.match(app, /BancaCatalogSync\.start\(sb, refreshSharedCatalog\);\s*refreshSharedCatalog\(\)/);
  assert.match(app, /window\.BancaCatalogSync\?\.applyEdition/);
});
test('server publisher reconciles shared records before writing GitHub', () => {
  const server = readFileSync('supabase/functions/github-catalog/index.ts', 'utf8');
  assert.match(server, /from\("catalog_edition_overrides"\)/);
  assert.match(server, /const library = reconcile\(payload\.library/);
  assert.match(server, /catalogEditedAt: record\.updated_at/);
  assert.match(server, /profile\?\.plan !== "admin"/);
});
