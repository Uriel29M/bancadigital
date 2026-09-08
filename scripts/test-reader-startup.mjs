import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync('js/app.js', 'utf8');
const start = source.indexOf('  async function renderCBZReader(');
// Exercise the actual startup through the full-download boundary.
const end = source.indexOf('      let buffer = await waitForPrefetchedBuffer', start);
const startup = source.slice(start, end) + '\n} catch (error) { throw error; } }';
function setup(rangeWorks) {
  const calls = [];
  const element = () => ({ isConnected: true, setAttribute() {}, removeAttribute() {}, append() {}, insertAdjacentHTML() {} });
  const context = {
    AbortController, console,
    document: { createElement: element }, readerLoadingTipMarkup: () => '',
    state: { readingMode: 'single-page' },
    isTelegramMediaUrl: () => true,
    renderCBZRangeSinglePage: async () => { calls.push('range'); return rangeWorks; },
    probeArchiveSignature: async () => { calls.push('probe'); return 'rar'; },
    isRarSignature: value => value === 'rar',
    renderCBRReader: async () => { calls.push('cbr'); },
    window: { get jszipReady() { throw new Error('JSZip must not block range or RAR opening'); } },
  };
  vm.createContext(context);
  vm.runInContext(startup, context);
  return { calls, run: () => context.renderCBZReader({}, 'https://example.com/media', { replaceChildren() {} }, {}, {}) };
}
test('Telegram CBZ opens by range without signature request or JSZip wait', async () => {
  const { calls, run } = setup(true);
  await run();
  assert.deepEqual(calls, ['range']);
});
test('failed range opening still detects a mislabeled RAR without repeating range', async () => {
  const { calls, run } = setup(false);
  await run();
  assert.deepEqual(calls, ['range', 'probe', 'cbr']);
});
