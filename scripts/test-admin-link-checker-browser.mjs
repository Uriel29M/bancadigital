import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const source = readFileSync('js/app.js', 'utf8');
const helper = source.slice(source.indexOf('  function bindAdminLinkChecker('), source.indexOf('  function bindAdminAccountRetention('));
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
try {
  for (const width of [390, 1280]) {
    const page = await browser.newPage({ viewport: { width, height: 800 } });
    await page.setContent('<div class="modal-backdrop"><div class="modal admin-modal"><h2>Administração</h2><div class="admin-actions"></div></div></div>');
    await page.addStyleTag({ content: readFileSync('css/style.css', 'utf8') });
    await page.addScriptTag({ content: `
      var admin = true, enabled = true, fail = false, calls = 0;
      var state = { session: {} };
      var isAdminProfile = () => admin;
      var $ = (selector, root = document) => root.querySelector(selector);
      var sb = { from() {
        let next;
        return { select() { return this; }, eq() { return this; }, update(value) { next = value.enabled; return this; },
          async single() { calls++; await new Promise(resolve => setTimeout(resolve, 30));
            if (fail) return { error: { message: 'Falha ao salvar' } };
            if (typeof next === 'boolean') enabled = next;
            return { data: { enabled } };
          }
        };
      }};
      ${helper}
      bindAdminLinkChecker(document);
    ` });
    const toggle = page.locator('[data-link-checker-toggle]');
    await toggle.waitFor();
    await page.waitForFunction(() => !document.querySelector('[data-link-checker-toggle]').disabled);
    assert.equal(await toggle.isChecked(), true);
    await toggle.uncheck();
    await page.waitForFunction(() => document.querySelector('[data-link-checker-status]').textContent === 'Desativado');
    assert.equal(await page.evaluate(() => enabled), false);
    await page.evaluate(() => { document.querySelector('.admin-link-checker').remove(); bindAdminLinkChecker(document); });
    await page.waitForFunction(() => !document.querySelector('[data-link-checker-toggle]').disabled);
    assert.equal(await toggle.isChecked(), false);
    await toggle.check();
    await page.waitForFunction(() => document.querySelector('[data-link-checker-status]').textContent === 'Ativado');
    await page.screenshot({ path: `/tmp/admin-link-checker-${width}.png` });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.evaluate(() => { fail = true; });
    await toggle.uncheck();
    await page.locator('[data-link-checker-retry]').waitFor({ state: 'visible' });
    assert.equal(await toggle.isDisabled(), true);
    assert.equal(await page.evaluate(() => enabled), true);
    await page.evaluate(() => { fail = false; });
    await page.locator('[data-link-checker-retry]').click();
    await page.waitForFunction(() => !document.querySelector('[data-link-checker-toggle]').disabled);
    assert.equal(await toggle.isChecked(), true);
    await page.evaluate(() => { admin = false; document.querySelector('.admin-link-checker').remove(); bindAdminLinkChecker(document); });
    assert.equal(await toggle.count(), 0);
    await page.close();
    console.log(`PASS ${width}px: persisted toggle, failure, retry and admin restriction`);
  }
} finally { await browser.close(); }
