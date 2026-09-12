import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const source = readFileSync('js/app.js', 'utf8');
const helpers = source.slice(source.indexOf('  function seriesExportFormat('), source.indexOf('  function refreshSeriesDownloadButton('));
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
try {
  for (const width of [390, 1280]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setContent('<button id="navigate" onclick="document.querySelector(\'#modal-root\').replaceChildren(); this.textContent=\'Navegou\'">Navegar</button><div id="modal-root"></div>');
    await page.addStyleTag({ content: readFileSync('css/style.css', 'utf8') });
    await page.addScriptTag({ content: `
      const $ = (selector, root = document) => root.querySelector(selector);
      const isAdminProfile = () => true;
      const escapeHTML = value => value;
      const issueSortValue = item => item.issue;
      const itemDisplayTitle = item => item.title;
      const downloadSource = item => item.url;
      const isExternalArchiveLink = () => false;
      const isZipSignature = bytes => bytes[0] === 80 && bytes[1] === 75;
      window.files = []; window.requests = []; window.downloads = 0;
      HTMLAnchorElement.prototype.click = function () { window.downloads++; };
      window.jszipReady = Promise.resolve(class {
        file(name) { window.files.push(name); }
        async generateAsync(options, update) { update({ percent: 50 }); return new Blob(['zip']); }
      });
      const fetchFileArrayBuffer = (url, progress, complete, signal) => new Promise((resolve, reject) => {
        window.requests.push({ signal, progress, finish: () => resolve(new Uint8Array([80, 75, 3, 4]).buffer), fail: () => reject(new Error('Falha de teste')) });
        signal.addEventListener('abort', () => reject(new DOMException('Cancelado', 'AbortError')));
        progress(50, 100);
      });
      ${helpers}
      window.openExport = () => openSeriesExport({ title: 'Série de teste' }, [{ title: 'Primeira', issue: 1, url: '1' }, { title: 'Segunda', issue: 2, url: '2' }]);
      openExport();
    ` });
    await page.locator('[type="submit"]').click();
    await page.waitForFunction(() => requests.length === 1);
    await page.mouse.click(4, 4);
    assert.equal(await page.locator('.is-minimized').count(), 1);
    assert.equal(await page.locator('.series-export-modal').getAttribute('aria-modal'), 'false');
    assert.match(await page.locator('[data-export-status]').textContent(), /Baixando 1\/2.*50%/);
    await page.locator('#navigate').click();
    assert.equal(await page.locator('#navigate').textContent(), 'Navegou');
    assert.equal(await page.evaluate(() => requests[0].signal.aborted), false);
    const box = await page.locator('.series-export-overlay').boundingBox();
    assert.ok(box.width <= 340 && box.x >= 0 && box.x + box.width <= width && box.y > 450);
    await page.screenshot({ path: `/tmp/series-export-minimized-${width}.png` });
    await page.locator('[data-export-restore]').click();
    assert.equal(await page.locator('.is-minimized').count(), 0);
    await page.locator('[data-export-minimize]').click();
    await page.evaluate(() => openExport());
    assert.equal(await page.locator('.series-export-overlay').count(), 1);
    assert.equal(await page.locator('.is-minimized').count(), 0);
    assert.equal(await page.evaluate(() => requests.length), 1);
    await page.keyboard.press('Escape');
    await page.evaluate(() => requests[0].finish());
    await page.waitForFunction(() => requests.length === 2);
    assert.match(await page.locator('[data-export-status]').textContent(), /Baixando 2\/2/);
    await page.evaluate(() => requests[1].finish());
    await page.waitForFunction(() => downloads === 1);
    assert.equal(await page.locator('.is-minimized').count(), 1);
    assert.equal(await page.locator('[data-export-progress]').evaluate(element => element.value), 100);
    assert.match(await page.locator('[data-export-status]').textContent(), /Download do ZIP enviado/);
    await page.locator('[data-close]').click();
    await page.evaluate(() => openExport());
    await page.locator('[type="submit"]').click();
    await page.waitForFunction(() => requests.length === 3);
    await page.locator('[data-export-minimize]').click();
    await page.locator('[data-close]').click();
    assert.equal(await page.evaluate(() => requests[2].signal.aborted), true);
    assert.equal(await page.locator('.series-export-overlay').count(), 0);
    await page.evaluate(() => openExport());
    await page.locator('[type="submit"]').click();
    await page.waitForFunction(() => requests.length === 4);
    await page.locator('[data-export-minimize]').click();
    await page.evaluate(() => requests[3].fail());
    await page.waitForFunction(() => document.querySelector('[data-export-status]').textContent.includes('Falha de teste'));
    await page.locator('[data-export-restore]').click();
    assert.equal(await page.locator('[type="submit"]').isEnabled(), true);
    assert.equal(await page.evaluate(() => downloads), 1);
    assert.deepEqual(errors, []);
    console.log(`PASS ${width}px: minimize, navigate, restore, progress, completion, cancellation and error`);
    await page.close();
  }
} finally { await browser.close(); }
