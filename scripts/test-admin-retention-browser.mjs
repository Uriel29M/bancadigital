import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const source = readFileSync('js/app.js', 'utf8');
const helper = source.slice(source.indexOf('  function bindAdminAccountRetention('), source.indexOf('  function openAdmin(editId'));
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
try {
  for (const width of [390, 1280]) {
    const page = await browser.newPage({ viewport: { width, height: 800 } });
    await page.setContent('<div class="modal-backdrop"><div class="modal admin-modal"><h2>Administração</h2><div class="admin-actions"></div></div></div>');
    await page.addStyleTag({ content: readFileSync('css/style.css', 'utf8') });
    await page.addScriptTag({ content: `
      var admin = true, settings = { enabled: false, email_scope: 'all' };
      var state = { session: {} };
      var isAdminProfile = () => admin;
      var $ = (selector, root = document) => root.querySelector(selector);
      var sb = { async rpc(name, args) {
        await new Promise(resolve => setTimeout(resolve, 30));
        if (args) settings = { enabled: args.p_enabled, email_scope: args.p_email_scope };
        return { data: settings };
      }};
      ${helper}
      bindAdminAccountRetention(document);
    ` });
    const select = page.locator('[data-retention-email-scope]');
    for (const value of ['with_email', 'without_email', 'all']) {
      await page.waitForFunction(() => !document.querySelector('[data-retention-email-scope]').disabled);
      await select.selectOption(value);
      await page.waitForFunction(() => !document.querySelector('[data-retention-email-scope]').disabled);
      assert.equal(await page.evaluate(() => settings.enabled), false);
      assert.equal(await page.evaluate(() => settings.email_scope), value);
    }
    await select.selectOption('without_email');
    await page.waitForFunction(() => !document.querySelector('[data-retention-email-scope]').disabled);
    await page.evaluate(() => { document.querySelector('.admin-account-retention').remove(); bindAdminAccountRetention(document); });
    await page.waitForFunction(() => !document.querySelector('[data-retention-email-scope]').disabled);
    assert.equal(await select.inputValue(), 'without_email');
    await page.locator('[data-retention-toggle]').click();
    await page.waitForFunction(() => document.querySelector('[data-retention-status]').textContent.startsWith('Ativada'));
    assert.equal(await select.inputValue(), 'without_email');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: '/tmp/admin-retention-' + width + '.png' });
    await page.evaluate(() => { admin = false; document.querySelector('.admin-account-retention').remove(); bindAdminAccountRetention(document); });
    assert.equal(await select.count(), 0);
    await page.close();
    console.log('PASS ' + width + 'px: email selection, persistence, activation and admin restriction');
  }
} finally { await browser.close(); }
