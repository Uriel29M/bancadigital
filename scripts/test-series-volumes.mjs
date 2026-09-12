import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const app = readFileSync('js/app.js', 'utf8');
const helper = app.slice(app.indexOf('  function openSeriesVolumeManager('), app.indexOf('  function bindSeriesEditionOrder('));
function setup(fail = false) {
  const nodes = new Map();
  const node = key => {
    if (!nodes.has(key)) nodes.set(key, { value: '', innerHTML: '', textContent: '', focus() {}, appendChild() {} });
    return nodes.get(key);
  };
  const editions = [{ id: 'a', seriesId: 's', title: 'A', volume: 'Volume 1', fileUrl: 'a.cbz' }, { id: 'b', seriesId: 's', title: 'B', volumeTitle: 'Volume 2', volume: 'legacy', seriesSortOrder: 3 }];
  const state = { db: { library: editions }, session: { user: { id: 'admin' } } };
  let removed = false, saved = false;
  const context = vm.createContext({ state, sb: {}, isAdminProfile: () => true, escapeHTML: s => s, save() {}, toast() {},
    document: { createElement: () => ({ addEventListener() {}, remove() { removed = true; } }) },
    $: node,
    $$: selector => selector === '[data-volume-remove]' ? [0, 1].map(index => Object.assign(node(`remove${index}`), { dataset: { volumeRemove: String(index) } })) : selector === '[data-volume-edition]' ? [0, 1].map(index => Object.assign(node(`edition${index}`), { dataset: { volumeEdition: String(index) } })) : [],
    BancaCatalogSync: { publishMany: async (_, items) => { if (fail) throw new Error('offline'); return items.map(edition => ({ item_id: edition.id, edition, updated_at: 'now' })); } },
    editions, onSaved() { saved = true; }
  });
  vm.runInContext(`${helper}\nopenSeriesVolumeManager(editions, onSaved);`, context);
  return { state, node, submit: () => node('form').onsubmit({ preventDefault() {} }), removed: () => removed, saved: () => saved };
}
test('removing a volume clears both fields and preserves its edition', async () => {
  const t = setup(); t.node('remove1').onclick(); await t.submit();
  assert.equal(t.state.db.library.length, 2);
  assert.equal(t.state.db.library[1].volumeTitle, '');
  assert.equal(t.state.db.library[1].volume, '');
  assert.equal(t.state.db.library[1].seriesSortOrder, 3);
  assert.equal(t.saved(), true);
});
test('new volume requires an edition and saves its assignment', async () => {
  const t = setup(); t.node('[data-volume-name]').value = 'Volume 3'; t.node('[data-volume-add]').onclick();
  await t.submit(); assert.equal(t.saved(), false);
  // Keep Volume 1 populated; move B and remove its now-empty old volume.
  t.node('edition1').value = 'Volume 3'; t.node('edition1').onchange(); t.node('remove1').onclick();
  await t.submit(); assert.equal(t.state.db.library[1].volumeTitle, 'Volume 3'); assert.equal(t.saved(), true);
});
test('failed save preserves catalog and leaves editor open for retry', async () => {
  const t = setup(true); t.node('remove1').onclick(); await t.submit();
  assert.equal(t.state.db.library[1].volumeTitle, 'Volume 2');
  assert.equal(t.removed(), false); assert.equal(t.saved(), false);
  assert.match(t.node('[data-volume-status]').textContent, /offline/);
});
test('cancel does not change catalog', () => {
  const t = setup(); t.node('remove0').onclick(); t.node('[data-volume-cancel]').onclick();
  assert.equal(t.state.db.library[0].volume, 'Volume 1'); assert.equal(t.saved(), false);
});
