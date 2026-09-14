import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const source = readFileSync('js/app.js', 'utf8');
const functions = ['bindEditionEditButtons', 'openEditForm'].map(name => {
  const start = source.indexOf(`  function ${name}(`);
  assert.ok(start >= 0);
  return source.slice(start, source.indexOf('\n  }', start) + 4);
}).join('\n');
assert.ok(source.includes('    bindEditionEditButtons();'));
assert.ok(source.includes('    bindEditionEditButtons(overlay);'));
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
try {
  const page = await browser.newPage();
  await page.setContent('<div id="modal-root"><div id="series"><button data-edit-item="issue">Editar</button></div></div>');
  await page.addScriptTag({ content: `
    const $ = (s,r=document) => r.querySelector(s);
    const $$ = (s,r=document) => [...r.querySelectorAll(s)];
    const state = {db:{library:[{id:'issue',title:'Original',fileUrl:'https://example.com/comic.cbr',format:'cbr',type:'comic',tags:[]}]}};
    const escapeHTML = value => String(value ?? '').replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;');
    const isAdminProfile = () => true, sb = null;
    const detectFormat = () => 'cbr', isTelegramPostUrl = () => false;
    const seriesKey = value => value, catalogAddedTimestamp = () => 0;
    window.BancaTelegram = {bindEditor:()=>({})};
    window.BancaTelegramCovers = {bindEditor:()=>({}),isPost:()=>false};
    window.saved = 0;
    window.failSave = false;
    async function saveCatalog(message,item) {
      window.saved++;
      if(window.failSave) return false;
      state.db.library[0] = item;
      return true;
    }
    function render() { bindEditionEditButtons(); }
    ${functions}
    // Series-specific binding followed by global renders while it remains open.
    bindEditionEditButtons($('#series'));
    for(let i=0;i<5;i++) render();
  ` });
  const open = async () => {
    await page.locator('[data-edit-item]').click();
    assert.equal(await page.locator('#edit-form').count(), 1, 'Only one form per click after repeated binds');
  };
  for (const action of ['close', 'cancel', 'backdrop', 'save']) {
    await open();
    await page.locator('[name=title]').fill(`Changed ${action}`);
    if (action === 'save') {
      await page.locator('#edit-form button.btn').click();
      await page.waitForFunction(() => !document.querySelector('#edit-form'));
      assert.equal(await page.evaluate(() => window.saved), 1);
    } else if (action === 'backdrop') {
      await page.locator('.modal-backdrop').dispatchEvent('click');
    } else {
      await page.locator('.modal-backdrop [data-close]').nth(action === 'close' ? 0 : 1).click();
    }
    assert.equal(await page.locator('#edit-form').count(), 0, `${action} closes without exposing another form`);
  }
  await open();
  assert.equal(await page.locator('[name=title]').inputValue(), 'Changed save');
  await page.evaluate(() => { window.failSave = true; });
  await page.locator('[name=title]').fill('Keep draft');
  await page.locator('#edit-form button.btn').click();
  await page.locator('[data-publish-status]').waitFor();
  assert.equal(await page.locator('#edit-form').count(), 1);
  assert.equal(await page.locator('[name=title]').inputValue(), 'Keep draft');
  console.log('PASS: one editor after repeated binds; close/cancel/backdrop/save; persisted edit on reopen; failed save retains draft.');
} finally { await browser.close(); }
