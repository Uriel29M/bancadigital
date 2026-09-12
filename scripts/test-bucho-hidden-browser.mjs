import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const source = readFileSync('js/app.js', 'utf8');
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
try {
  for (const width of [390, 768, 1280]) {
    const page = await browser.newPage({ viewport: { width, height: 1000 }, reducedMotion: 'reduce' });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => {
      const path = new URL(route.request().url()).pathname;
      if (path === '/assets/bucho/ocultas.png') return route.fulfill({ contentType: 'image/png', body: readFileSync(`.${path}`) });
      return route.fulfill({ contentType: 'text/html', body: '<html></html>' });
    });
    await page.goto('http://banca.test/');
    await page.setContent(readFileSync('index.html', 'utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ''));
    await page.addStyleTag({ content: readFileSync('css/style.css', 'utf8') });
    await page.addScriptTag({ content: 'window.DEFAULT_COLLECTIONS=[];' });
    await page.addScriptTag({ content: source.slice(0, source.indexOf('  const pathParts = window.location.pathname')) + 'window.testApp={state,render,normalizeHomeSectionOrder};})();' });
    await page.evaluate(() => {
      const { state, render } = window.testApp;
      const cover = index => 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="200" height="300"><rect width="200" height="300" fill="hsl(${index * 45} 45% 25%)"/><path d="M0 240L100 40L200 240Z" fill="hsl(${index * 45} 60% 45%)"/><text x="100" y="280" text-anchor="middle" fill="white" font-size="22">Edição ${index + 1}</text></svg>`);
      state.db.library = Array.from({ length: 9 }, (_, index) => ({ id: `issue-${index}`, title: `Edição ${index + 1}`, seriesId: index < 2 ? 'hidden-series' : '', type: 'comic', issue: String(index + 1), coverUrl: cover(index), tags: [], collectionIds: [], clicks: 10 }));
      state.hiddenCatalogSeriesIds = new Set(['hidden-series']);
      state.hiddenCatalogItemIds = new Set(state.db.library.slice(2, 8).map(item => item.id));
      state.authReady = true;
      state.homeSectionOrder = ['most-read-covers', 'recent'];
      render();
    });
    const section = page.locator('.bucho-hidden-section');
    await section.scrollIntoViewIfNeeded();
    await page.waitForFunction(() => document.querySelector('.bucho-art').complete);
    assert.equal(await page.locator('.bucho-edition').count(), 8, 'Includes every hidden edition, including multiple issues of one hidden series');
    assert.equal(await section.evaluate(element => element.previousElementSibling.classList.contains('most-read-cover-section')), true);
    const dimensions = await page.evaluate(() => {
      const stage = document.querySelector('.bucho-stage').getBoundingClientRect();
      const rail = document.querySelector('.bucho-editions').getBoundingClientRect();
      const caption = document.querySelector('.bucho-caption').getBoundingClientRect();
      return { left: (rail.left-stage.left)/stage.width, top: (rail.top-stage.top)/stage.height, right: (rail.right-stage.left)/stage.width, bottom: (rail.bottom-stage.top)/stage.height, caption: (caption.top-stage.top)/stage.height, overflow: document.documentElement.scrollWidth > innerWidth };
    });
    assert.ok(dimensions.left >= .425 && dimensions.top >= .515 && dimensions.right <= .92 && dimensions.bottom <= .82, JSON.stringify(dimensions));
    assert.ok(dimensions.caption >= .85);
    assert.equal(dimensions.overflow, false);
    await page.locator('[data-bucho-scroll="1"]').click();
    await page.waitForFunction(() => document.querySelector('.bucho-editions').scrollLeft > 0);
    await page.locator('[data-bucho-scroll="-1"]').click();
    await page.screenshot({ path: `/tmp/bucho-home-${width}.png`, fullPage: false });
    await section.screenshot({ path: `/tmp/bucho-section-${width}.png` });
    await page.evaluate(() => { testApp.state.hiddenCatalogItemIds.clear(); testApp.state.hiddenCatalogSeriesIds.clear(); testApp.render(); });
    assert.equal(await page.locator('.bucho-edition').count(), 0);
    assert.equal(await page.locator('.bucho-empty').textContent(), 'O Bucho ainda não comeu nenhuma edição.');
    assert.deepEqual(errors, []);
    console.log(`PASS ${width}px: posição, área segura, edições ocultas, navegação e estado vazio`);
    await page.close();
  }
} finally { await browser.close(); }
