import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';
import test from 'node:test';

const root = resolve(process.argv[2] || '.');
const app = readFileSync(resolve(root, 'js/app.js'), 'utf8');
const prefix = app.slice(0, app.indexOf('  const state = {'));
const canonical = app.slice(app.indexOf('  function normalizedSeriesKey('), app.indexOf('  function seriesKey('));
function runtime(window, stored) {
  const storage = new Map(stored ? [[`bancaDigitalDB_v1:${window.CATALOG_VERSION || 'local'}`, JSON.stringify(stored)]] : []);
  const context = vm.createContext({ window, structuredClone, console, localStorage: {
    getItem: key => storage.get(key) || null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: key => storage.delete(key),
  } });
  vm.runInContext(`${prefix}\n${canonical}\nglobalThis.api = { DataStore, compactSeriesItems, materializeSeriesItems, mergeCatalogEdition };\n})();`, context);
  return context.api;
}
const edition = { id: 'test-1', seriesId: 'test', issue: '1', title: 'Teste', fileUrl: 'https://example.com/new.pdf', coverUrl: 'https://example.com/new.jpg', cover: '', telegramUrl: '', catalogEditedAt: '2026-09-07T12:00:00.000Z' };
function catalog(item = edition) {
  return { DEFAULT_SERIES: [{ id: 'test', name: 'Teste', coverUrl: 'https://example.com/series.jpg' }], DEFAULT_LIBRARY: [structuredClone(item)], DEFAULT_COLLECTIONS: [] };
}
test('published cover and link replace an existing user cache', () => {
  const old = { ...edition, coverUrl: 'old.jpg', fileUrl: 'old.pdf', catalogEditedAt: '2026-09-06T12:00:00.000Z' };
  const api = runtime(catalog(), { library: [old], collections: [] });
  const actual = api.DataStore.load().library[0];
  assert.equal(actual.coverUrl, edition.coverUrl);
  assert.equal(actual.fileUrl, edition.fileUrl);
});
test('published values win over a mutated cache with the same edit timestamp', () => {
  const api = runtime(catalog());
  assert.equal(api.mergeCatalogEdition({ ...edition, coverUrl: 'stale.jpg' }, edition).coverUrl, edition.coverUrl);
});
test('a newer pending admin edit survives the previous deployment', () => {
  const api = runtime(catalog());
  const pending = { ...edition, fileUrl: 'pending.pdf', catalogEditedAt: '2026-09-07T13:00:00.000Z' };
  assert.equal(api.mergeCatalogEdition(pending, edition).fileUrl, 'pending.pdf');
});
test('an explicitly cleared cover survives series inheritance and publication', () => {
  const cleared = { ...edition, coverUrl: '' };
  const api = runtime(catalog(cleared));
  const actual = api.materializeSeriesItems(api.compactSeriesItems([cleared]))[0];
  assert.equal(actual.coverUrl, '');
  assert.equal(actual.telegramUrl, '');
});
test('real imprint scripts cannot overwrite a published edition for a fresh user', () => {
  const window = {};
  const context = vm.createContext({ window });
  const html = readFileSync(resolve(root, 'index.html'), 'utf8');
  const paths = [...html.matchAll(/src="(js\/data\/[^"?]+\.js)(?:\?[^" ]*)?"/g)].map(match => match[1]);
  vm.runInContext(readFileSync(resolve(root, paths[0]), 'utf8'), context);
  const target = window.DEFAULT_LIBRARY.find(item => item.seriesId === 'series-batman-damned-2018');
  assert.ok(target, 'real Black Label edition exists');
  Object.assign(target, { coverUrl: edition.coverUrl, fileUrl: edition.fileUrl, catalogEditedAt: edition.catalogEditedAt });
  window.PUBLISHED_CATALOG = structuredClone({ library: window.DEFAULT_LIBRARY, series: window.DEFAULT_SERIES });
  for (const path of paths.slice(1)) vm.runInContext(readFileSync(resolve(root, path), 'utf8'), context);
  const result = runtime(window).DataStore.load().library.find(item => item.id === target.id);
  assert.equal(result.coverUrl, edition.coverUrl);
  assert.equal(result.fileUrl, edition.fileUrl);
});
test('online service worker fetches the new catalog even when old data is cached', async () => {
  let handler;
  let requestOptions;
  const context = vm.createContext({ URL, Response, self: {
    location: { origin: 'https://example.com' },
    addEventListener: (name, callback) => { if (name === 'fetch') handler = callback; },
  }, caches: {
    match: async () => new Response('old'),
    open: async () => ({ put: async () => {} }),
  }, fetch: async (_request, options) => { requestOptions = options; return new Response('new'); } });
  vm.runInContext(readFileSync(resolve(root, 'sw.js'), 'utf8'), context);
  let response;
  handler({ request: { method: 'GET', url: 'https://example.com/js/data/dc-comics/recentes.js?v=unchanged' }, respondWith: value => { response = value; } });
  assert.equal(await (await response).text(), 'new');
  assert.equal(requestOptions.cache, 'no-store');
});
