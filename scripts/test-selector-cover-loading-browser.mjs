import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const source = readFileSync('js/app.js', 'utf8');
const helper = source.slice(source.indexOf('  function prepareLazyImages('), source.indexOf('  function prioritizeReaderLoading('));
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
try {
  for (const width of [390, 1280]) {
    const page = await browser.newPage({ viewport: { width, height: 800 } });
    const requests = [];
    await page.route('https://banca.test/**', route => {
      requests.push(route.request().url());
      return route.fulfill({ contentType: 'image/jpeg', body: readFileSync('assets/batmanicon.jpg') });
    });
    await page.setContent('<main id="main"></main><div id="modal-root"></div>');
    await page.addStyleTag({ content: readFileSync('css/style.css', 'utf8') });
    await page.addScriptTag({ content: `
      var readerIsOpen = false, homeHeroReady = false, lazyCoverObserver = null;
      var state = { section: 'home' };
      var $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
      ${helper}
      new MutationObserver(records => records.forEach(record => [...record.addedNodes].forEach(node => {
        if (node.nodeType === Node.ELEMENT_NODE) prepareLazyImages(node);
      }))).observe(document.querySelector('#modal-root'), { childList: true, subtree: true });
      function openSelector() {
        document.querySelector('#modal-root').innerHTML = '<div class="modal-backdrop"><div class="modal series-modal"><h2>Edições</h2><div class="card"><div class="cover" style="background-image:url(https://banca.test/edition.jpg)"></div></div></div></div>';
      }
      openSelector();
    ` });
    await page.waitForFunction(() => {
      const cover = document.querySelector('.series-modal .cover');
      return cover && !cover.classList.contains('is-lazy-cover') && cover.style.backgroundImage !== 'none';
    }, null, { timeout: 2000 });
    await page.waitForFunction(() => performance.getEntriesByType('resource').some(entry => entry.name.includes('/edition.jpg')));
    assert.equal(await page.evaluate(() => homeHeroReady), false, 'Selector loads while the home hero is still pending');
    assert.ok(requests.some(url => url.endsWith('/edition.jpg')));
    await page.evaluate(() => prepareLazyImages(document));
    assert.equal(await page.locator('.series-modal .cover').evaluate(el => el.classList.contains('is-lazy-cover')), false);
    await page.evaluate(() => { document.querySelector('#modal-root').innerHTML = ''; openSelector(); });
    await page.waitForFunction(() => !document.querySelector('.series-modal .cover').classList.contains('is-lazy-cover'));
    await page.screenshot({ path: '/tmp/selector-cover-' + width + '.png' });
    await page.close();
    console.log('PASS ' + width + 'px: covers load before home, including reopening and document preparation');
  }
} finally { await browser.close(); }
