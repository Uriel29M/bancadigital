// Run with CBR_FIXTURE=/path/to/Arlequina.cbr and PLAYWRIGHT_MODULE if needed.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { resolve, extname } from 'node:path';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fixture = process.env.CBR_FIXTURE;
assert.ok(fixture, 'Set CBR_FIXTURE to the original MediaFire Arlequina #16 CBR');
const bytes = await readFile(fixture);
assert.equal(bytes.length, 34945915);
const server = createServer(async (req, res) => {
  try {
    if (req.url === '/fixture') { res.end(bytes); return; }
    if (req.url === '/') { res.setHeader('Content-Type', 'text/html'); res.end('<body></body>'); return; }
    const path = resolve('.' + new URL(req.url, 'http://localhost').pathname);
    assert.ok(path.startsWith(resolve('libarchive') + '/'));
    res.setHeader('Content-Type', extname(path) === '.wasm' ? 'application/wasm' : 'text/javascript');
    res.end(await readFile(path));
  } catch { res.writeHead(404).end(); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
try {
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  const result = await page.evaluate(async () => {
    const { withSolidRarSupport } = await import('/libarchive/rar-reader.mjs');
    const { Archive: original } = await import('/libarchive/libarchive.js');
    original.init({ workerUrl: new URL('/libarchive/worker-bundle.js', location.href).href });
    const data = await (await fetch('/fixture')).arrayBuffer();
    const file = new File([data], 'comic.cbr');
    const old = await original.open(file);
    const count = obj => Object.values(obj).reduce((n, x) => n + (typeof x.extract === 'function' ? 1 : count(x)), 0);
    const before = count(await old.getFilesObject());
    await old.close();
    const Archive = withSolidRarSupport(original);
    const archive = await Archive.open(file);
    const files = Object.values(await archive.getFilesObject());
    const dimensions = [];
    for (const entry of files) {
      const bitmap = await createImageBitmap(await entry.extract());
      dimensions.push([bitmap.width, bitmap.height]);
      bitmap.close();
    }
    await archive.close();
    let rejected = false;
    try { await archive.getFilesObject(); } catch { rejected = true; }
    const truncated = await Archive.open(new File([data.slice(0, 2000000)], 'bad.cbr'));
    let truncationRejected = false;
    try { await truncated.getFilesObject(); } catch { truncationRejected = true; }
    await truncated.close();
    let delegated = false;
    await withSolidRarSupport({open: async () => { delegated = true; }}).open(new File(['other format'], 'other'));
    return { before, names: files.map(f => f.name), dimensions, rejected, truncationRejected, delegated };
  });
  assert.equal(result.before, 1, 'Reproduce original libarchive failure');
  assert.equal(result.names.length, 22);
  assert.ok(result.names[20].endsWith('_021.jpg'));
  assert.ok(result.names[21].endsWith('zzzz_recruta.jpg'));
  assert.ok(result.dimensions.every(([w,h]) => w > 0 && h > 0));
  assert.ok(result.rejected && result.truncationRejected && result.delegated);
  console.log('PASS: original reader=1 image; corrected reader=22 decoded images (23 with Banca end page); truncated archive rejected; close and other formats verified.');
} finally {
  await browser.close();
  await new Promise(r => server.close(r));
}
