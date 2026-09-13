import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const run = promisify(execFile);
import { createCanvas } from '@napi-rs/canvas';
const source = readFileSync('js/app.js', 'utf8');
const helpers = source.slice(source.indexOf('  function seriesExportFormat('), source.indexOf('  function refreshSeriesDownloadButton('));
function setup(admin = true, broken = false, hiddenIssues = []) {
  const nodes = new Map();
  const node = key => { if (!nodes.has(key)) nodes.set(key, { value: 'original', appendChild() {}, remove() {}, click() {}, focus() {}, setAttribute() {}, classList: { add() {}, remove() {}, contains() { return false; } }, addEventListener() {} }); return nodes.get(key); };
  const files = [];
  let downloads = 0;
  class Zip { file(name, bytes) { files.push({ name, bytes }); } async generateAsync() { return new Blob(['zip']); } }
  const context = vm.createContext({ TextEncoder, Uint8Array, Blob, AbortController, DOMException, setTimeout() {},
    window: { jszipReady: Promise.resolve(Zip) },
    document: { createElement: tag => tag === 'a' ? { click() { downloads++; }, remove() {} } : node('overlay'), body: node('body') },
    URL: { createObjectURL: () => 'blob:test', revokeObjectURL() {} },
    $: node, isAdminProfile: () => admin, isHiddenCatalogItem: item => hiddenIssues.includes(item.issue), escapeHTML: s => s, issueSortValue: i => i.issue,
    itemDisplayTitle: i => i.title, downloadSource: i => i.url, isExternalArchiveLink: () => false,
    fetchFileArrayBuffer: async () => new Uint8Array(broken ? [60, 104, 116, 109, 108] : [37, 80, 68, 70]).buffer,
    isZipSignature: b => b[0] === 80 && b[1] === 75,
  });
  vm.runInContext(helpers, context);
  context.openSeriesExport({ title: 'Série' }, [{ title: 'Segunda', issue: 2, url: '2' }, { title: 'Primeira', issue: 1, url: '1' }]);
  return { context, files, nodes, node, downloads: () => downloads };
}
test('admin exports all editions in order in a single PC download', async () => {
  const t = setup();
  await t.node('form').onsubmit({ preventDefault() {} });
  assert.deepEqual(t.files.map(f => f.name), ['0001 - Primeira.pdf', '0002 - Segunda.pdf']);
  assert.equal(t.downloads(), 1);
});
test('hidden editions are excluded from the count and ZIP', async () => {
  const t = setup(true, false, [1]);
  assert.match(t.node('overlay').innerHTML, /1 edições/);
  await t.node('form').onsubmit({ preventDefault() {} });
  assert.deepEqual(t.files.map(f => f.name), ['0001 - Segunda.pdf']);
  assert.equal(t.downloads(), 1);
});
test('a series with only hidden editions produces no download', async () => {
  const t = setup(true, false, [1, 2]);
  await t.node('form').onsubmit({ preventDefault() {} });
  assert.equal(t.files.length, 0);
  assert.equal(t.downloads(), 0);
  assert.match(t.node('[data-export-status]').textContent, /não possui edições visíveis/);
});
test('non-admin cannot open export', () => { assert.equal(setup(false).nodes.has('overlay'), false); });
test('invalid remote content fails without downloading an incomplete series', async () => {
  const t = setup(true, true);
  await t.node('form').onsubmit({ preventDefault() {} });
  assert.equal(t.downloads(), 0);
  assert.match(t.node('[data-export-status]').textContent, /Primeira:.*não é PDF/);
});
test('closing cancels export before fetching editions', async () => {
  const t = setup(); t.node('[data-close]').onclick();
  await t.node('form').onsubmit({ preventDefault() {} });
  assert.equal(t.files.length, 0); assert.equal(t.downloads(), 0);
});
test('missing file pauses and skipping continues with remaining editions', async () => {
  const t = setup();
  t.context.downloadSource = item => item.issue === 2 ? '' : item.url;
  const pending = t.node('form').onsubmit({ preventDefault() {} });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(t.files.length, 1);
  assert.equal(t.downloads(), 0);
  assert.equal(t.node('[data-export-skip]').hidden, false);
  t.node('[data-export-skip]').onclick();
  await pending;
  assert.equal(t.downloads(), 1);
  assert.equal(t.files.length, 1);
  assert.equal(t.node('[data-export-skip]').hidden, true);
  assert.match(t.node('[data-export-status]').textContent, /1 edições preparadas.*1 edições puladas/);
});
test('skipping all missing files does not download an empty ZIP', async () => {
  const t = setup();
  t.context.downloadSource = () => '';
  const pending = t.node('form').onsubmit({ preventDefault() {} });
  for (let i = 0; i < 2; i++) {
    await new Promise(resolve => setImmediate(resolve));
    t.node('[data-export-skip]').onclick();
  }
  await pending;
  assert.equal(t.downloads(), 0);
  assert.match(t.node('[data-export-status]').textContent, /Nenhuma edição com arquivo/);
});
test('canceling while waiting to skip finishes the export', async () => {
  const t = setup();
  t.context.downloadSource = () => '';
  const pending = t.node('form').onsubmit({ preventDefault() {} });
  await new Promise(resolve => setImmediate(resolve));
  t.node('[data-close]').onclick();
  await pending;
  assert.equal(t.downloads(), 0);
  assert.equal(t.node('[data-export-skip]').hidden, true);
});
test('CBZ export preserves existing ZIP bytes', async () => {
  const t = setup(); const bytes = new Uint8Array([80, 75, 3, 4]).buffer;
  assert.equal(t.context.seriesExportFormat(bytes), 'cbz');
  assert.equal(await t.context.seriesExportCbz(bytes, 'cbz', null, new AbortController().signal), bytes);
});

for (const format of ['cbz', 'cbr', 'pdf']) {
  test(`existing ${format} is returned byte-for-byte without conversion`, async () => {
    const t = setup(); const bytes = new Uint8Array([1, 2, 3]).buffer;
    assert.equal(await t.context.seriesExportConvert(bytes, format, format, null, new AbortController().signal), bytes);
  });
}
test('CBZ is selected by default and every format is offered', () => {
  const html = setup().node('overlay').innerHTML;
  assert.match(html, /value="cbz" selected/);
  for (const format of ['original', 'cbz', 'cbr', 'pdf']) assert.ok(html.includes(`value="${format}"`));
});
test('generated CBR is a real RAR readable by an independent extractor', async () => {
  const t = setup(); const directory = mkdtempSync(join(tmpdir(), 'series-rar-'));
  try {
    const files = [{ name: '00001.jpg', bytes: new Uint8Array([1, 2, 3]) }, { name: '00002.png', bytes: new Uint8Array(300).fill(42) }];
    const blob = t.context.seriesExportRar(files);
    const path = join(directory, 'edition.cbr'); writeFileSync(path, Buffer.from(await blob.arrayBuffer()));
    assert.equal((await run('bsdtar', ['-tf', path], { encoding: 'utf8' })).stdout, '00001.jpg\n00002.png\n');
    for (const file of files) assert.deepEqual((await run('bsdtar', ['-xOf', path, file.name], { encoding: 'buffer' })).stdout, Buffer.from(file.bytes));
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
test('generated PDF opens and decodes ordered image pages with PDF.js', async () => {
  const t = setup(); const canvas = createCanvas(12, 20); canvas.getContext('2d').fillRect(0, 0, 12, 20);
  const bytes = canvas.toBuffer('image/jpeg');
  const blob = t.context.seriesExportPdfDocument([{ width: 12, height: 20, bytes }, { width: 24, height: 40, bytes }]);
  const pdfjs = await import('../js/pdfjs/pdf.min.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('../js/pdfjs/pdf.worker.min.mjs', import.meta.url).href;
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(await blob.arrayBuffer()), useSystemFonts: true, CanvasFactory: class { create(w, h) { const canvas = createCanvas(w, h); return { canvas, context: canvas.getContext('2d') }; } reset(target, w, h) { target.canvas.width = w; target.canvas.height = h; } destroy(target) { target.canvas.width = target.canvas.height = 0; } } }).promise;
  try {
    assert.equal(pdf.numPages, 2);
    for (let index = 1; index <= 2; index++) {
      const page = await pdf.getPage(index); const viewport = page.getViewport({ scale: 1 });
      assert.equal(viewport.width, index * 12); assert.equal(viewport.height, index * 20);
      const operators = await page.getOperatorList();
      assert.ok(operators.fnArray.some(op => [pdfjs.OPS.paintImageXObject, pdfjs.OPS.paintInlineImageXObject].includes(op)));

    }
  } finally { await pdf.destroy(); }
});
