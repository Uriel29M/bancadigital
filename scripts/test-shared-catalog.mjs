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

test('batch ordering saves all editions in one write and keeps metadata', async () => {
  const sync = setup();
  const editions = [{ ...edition, seriesSortOrder: 0 }, { ...edition, id: 'test-2', seriesSortOrder: 1 }];
  let calls = 0;
  const client = { from() { return { upsert(payload) {
    calls++;
    assert.equal(payload.length, 2);
    assert.equal(payload[0].edition.fileUrl, edition.fileUrl);
    assert.equal(sync.pending.size, 2);
    return { select: async () => ({ data: payload.map(row => ({ ...row, updated_at: record.updated_at })) }) };
  } }; } };
  await sync.publishMany(client, editions, 'admin-id');
  assert.equal(calls, 1);
  assert.equal(sync.pending.size, 0);
  assert.equal(sync.merge([old])[0].seriesSortOrder, 0);
  assert.equal(sync.rows.get('test-2').edition.seriesSortOrder, 1);
});

test('failed batch does not change cached order and permits retry', async () => {
  const sync = setup();
  sync.accept([record]);
  const client = { from() { return { upsert() { return { select: async () => ({ error: new Error('Forbidden') }) }; } }; } };
  await assert.rejects(sync.publishMany(client, [{ ...edition, seriesSortOrder: 3 }], 'admin-id'), /Forbidden/);
  assert.equal(sync.rows.get('test-1').edition.seriesSortOrder, undefined);
  assert.equal(sync.pending.size, 0);
});

test('manual order takes precedence over issue numbers and legacy annual order', () => {
  const app = readFileSync('js/app.js', 'utf8');
  const code = app.slice(app.indexOf('  function issueSortValue('), app.indexOf('  function catalogTitleCompare('));
  const context = vm.createContext({});
  vm.runInContext(code, context);
  const items = [{ id: 'annual', issue: 'Anuário', sortOrder: 4.5, seriesSortOrder: 0 }, { id: 'first', issue: '1', seriesSortOrder: 1 }, { id: 'new', issue: '2' }];
  assert.deepEqual(items.sort((a, b) => context.issueSortValue(a) - context.issueSortValue(b)).map(item => item.id), ['annual', 'first', 'new']);
});

test('confirmed deletion survives stale caches and older network responses', async () => {
  const sync = setup();
  sync.accept([record]);
  const deleted = { ...edition, catalogDeleted: true };
  const client = { from() { return { upsert(payload) {
    assert.equal(payload.edition.catalogDeleted, true);
    return { select() { return { single: async () => ({ data: { ...record, edition: payload.edition, updated_at: '2026-09-12T00:00:00Z' }, error: null }) }; } };
  } }; } };
  await sync.publish(client, deleted, 'admin-id');
  sync.accept([record]);
  assert.equal(sync.merge([old]).length, 0);
  assert.equal(sync.merge([]).length, 0);
  const otherBrowser = setup();
  otherBrowser.accept([...sync.rows.values()]);
  assert.equal(otherBrowser.merge([old]).length, 0);
});

test('failed deletion retains the existing shared edition', async () => {
  const sync = setup();
  sync.accept([record]);
  const client = { from() { return { upsert() { return { select() { return { single: async () => ({ error: new Error('denied') }) }; } }; } }; } };
  await assert.rejects(sync.publish(client, { ...edition, catalogDeleted: true }, 'admin-id'), /denied/);
  assert.equal(sync.merge([old])[0].id, old.id);
  assert.equal(sync.pending.size, 0);
});

test('admin waits for deletion confirmation and preserves the dialog on failure', async () => {
  const app = readFileSync('js/app.js', 'utf8');
  const handler = app.slice(app.indexOf('  async function deleteCatalogEdition('), app.indexOf('  function openEditForm(id = null, initial = null)'));
  for (const success of [false, true]) {
    let finish;
    let closed = false;
    const context = vm.createContext({ state: { db: { library: [old] } }, saveCatalog: async (_message, item) => {
      assert.equal(item.catalogDeleted, true);
      return new Promise(resolve => { finish = resolve; });
    }, render() {}, openAdmin() {} });
    vm.runInContext(handler, context);
    const button = { dataset: { delete: old.id }, disabled: false };
    const task = context.deleteCatalogEdition(button, { remove() { closed = true; } });
    assert.equal(button.disabled, true);
    assert.equal(closed, false);
    finish(success);
    await task;
    assert.equal(closed, success);
    if (!success) assert.equal(button.disabled, false);
  }
});
