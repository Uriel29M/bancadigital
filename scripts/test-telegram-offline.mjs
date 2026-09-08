import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
const source = readFileSync('js/app.js', 'utf8');
const a = source.indexOf('  async function fetchFileArrayBuffer(');
const b = source.indexOf('    const isMega =', a);
const fetchSource = source.slice(a, b) + '\n}';
function setup({ cached = null, save = true } = {}) {
  const events = [];
  const bytes = new Uint8Array([82, 97, 114, 33]).buffer;
  const context = vm.createContext({
    DOMException, isTelegramMediaUrl: () => true,
    downloadCacheKey: url => url + '&v=240',
    readReaderFileCache: async key => { events.push(['read', key]); return cached; },
    writeReaderFileCache: async (key, buffer) => { events.push(['save', key]); assert.equal(buffer, bytes); return save; },
    fetchTelegramTemporaryBuffer: async (url, progress, complete) => { events.push(['network']); complete(); return bytes; },
  });
  vm.runInContext(fetchSource, context);
  return { events, bytes, run: (fresh = false) => context.fetchFileArrayBuffer('https://example.com?item_id=1', () => {}, () => events.push(['complete']), null, fresh) };
}
test('Telegram finishes only after the full file is saved under the offline key', async () => {
  const { run, events, bytes } = setup();
  assert.equal(await run(), bytes);
  assert.deepEqual(events.map(e => e[0]), ['read', 'network', 'save', 'complete']);
  assert.equal(events[0][1], events[2][1]);
});
test('cached Telegram file opens without network', async () => {
  const cached = new ArrayBuffer(4);
  const { run, events } = setup({ cached });
  assert.equal(await run(), cached);
  assert.deepEqual(events.map(e => e[0]), ['read', 'complete']);
});
test('failed storage never signals download completion', async () => {
  const { run, events } = setup({ save: false });
  await assert.rejects(run(), /salvar.*offline/);
  assert.ok(!events.some(e => e[0] === 'complete'));
});
test('forceFresh replaces the cached Telegram file', async () => {
  const { run, events } = setup({ cached: new ArrayBuffer(4) });
  await run(true);
  assert.deepEqual(events.map(e => e[0]), ['network', 'save', 'complete']);
});
test('offline reader uses cached bytes and prioritizes its local blob over Telegram metadata', async () => {
  const a = source.indexOf('  async function openDownloaded('), b = source.indexOf('  const MAX_CONCURRENT_DOWNLOADS', a);
  let opened;
  const context = vm.createContext({ Blob, URL: { createObjectURL: () => 'blob:offline' },
    downloaded: () => ({ status: 'completed', url: 'https://example.com/media' }),
    downloadCacheKey: url => url, readReaderFileCache: async () => new ArrayBuffer(4),
    openReader: item => { opened = item; }, toast: message => assert.fail(message),
    telegramProxyUrl: () => 'https://example.com/media',
  });
  vm.runInContext(source.match(/  function downloadSource\(item\).*\n/)[0] + source.slice(a, b), context);
  await context.openDownloaded({ id: '1', telegramUrl: 'https://t.me/channel/1', telegramFileId: 'file' });
  assert.equal(context.downloadSource(opened), 'blob:offline');
});
