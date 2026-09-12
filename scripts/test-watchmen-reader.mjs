import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const app = readFileSync('js/app.js', 'utf8');
const formatStart = app.indexOf('    const itemFormat = String(item.format');
const formatEnd = app.indexOf('    const skipCover =', formatStart);
const dispatchStart = app.indexOf('      const selectedFormat = String(item.format || format)');
const dispatchEnd = app.indexOf('\n    };', dispatchStart);
const extension = app.match(/  function extension\(url\) \{[\s\S]*?\n  \}/)[0];
const sid = 'series-antes-de-watchmen-2012-novos-52';

for (const catalog of ['recentes', 'novos-52']) {
  test(`${catalog}: all Watchmen proxy URLs select the correct archive reader`, async () => {
    const context = { window: {} };
    vm.runInNewContext(readFileSync(`js/data/dc-comics/${catalog}.js`, 'utf8'), context);
    const items = context.window.DEFAULT_LIBRARY.filter(item => item.seriesId === sid);
    assert.equal(items.length, 36);
    for (const item of items) {
      const calls = [];
      const runtime = {
        item, resolvedUrl: item.fileUrl, selectedIndex: 0, prefetchedBuffer: null,
        body: {}, controls: {}, overlay: {}, skipCover: false, resumePage: 1,
        markReaderReady() {}, saveReadingProgress() {},
        renderPDFReader: async () => calls.push('pdf'),
        renderCBZReader: async () => calls.push('cbz'),
        renderCBRReader: async () => calls.push('cbr'),
      };
      vm.createContext(runtime);
      vm.runInContext(`${extension}\n${app.slice(formatStart, formatEnd)}\nglobalThis.detected = format;`, runtime);
      assert.match(runtime.detected, /^(cbr|cbz)$/, item.id);
      await vm.runInContext(`(async () => { ${app.slice(dispatchStart, dispatchEnd)} })()`, runtime);
      assert.deepEqual(calls, [item.format], item.id);
    }
  });
}
