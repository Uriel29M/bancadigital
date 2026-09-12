import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = process.env.APP_ROOT || '.';
const source = readFileSync(`${root}/js/app.js`, 'utf8');
const helper = source.slice(source.indexOf('  function openSeriesVolumeManager('), source.indexOf('  function openCollection('));
const catalog = { window: {} };
vm.runInNewContext(readFileSync(`${root}/js/data/dc-comics/novos-52.js`, 'utf8'), catalog);
vm.runInNewContext(readFileSync(`${root}/js/data/dc-comics/recentes.js`, 'utf8'), catalog);
const all = catalog.window.DEFAULT_LIBRARY;
const groups = [...new Set(all.filter(item => /watchmen|batman.*futuro/i.test(item.seriesTitle || item.title)).map(item => item.seriesId))].filter(Boolean).map(id => all.filter(item => item.seriesId === id));
assert.ok(groups.length >= 2);
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
try {
  for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
    const page = await browser.newPage({ viewport });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setContent('<div id="modal-root"></div>');
    await page.addStyleTag({ content: readFileSync(`${root}/css/style.css`, 'utf8') });
    await page.addScriptTag({ content: `
      const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
      const state={db:{library:[]},session:{user:{id:'admin'}},readingProgress:new Map(),favoriteIds:new Set()};
      const sb={}; const isAdminProfile=()=>true, isHiddenCatalogSeries=()=>false;
      const escapeHTML=s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
      const issueSortValue=item=>Number(item.seriesSortOrder??item.issue)||0;
      const card=item=>'<div class="card-wrap"><article data-open="'+escapeHTML(item.id)+'">'+escapeHTML(item.title)+'</article></div>';
      const refreshSeriesDownloadButton=()=>{},hydrateHomeCovers=()=>{},save=()=>{},toast=()=>{};
      const BancaCatalogSync={publishMany:async(_,items)=>items.map(edition=>({item_id:edition.id,edition,updated_at:'now'}))};
      ${helper}
      window.openTest=items=>{state.db.library=items;$('#modal-root').innerHTML='';openSeriesSelection(items[0],items)};
      window.testState=state;
    ` });
    for (const editions of groups) {
      await page.evaluate(items => window.openTest(items), editions);
      const button = page.locator('[data-manage-volumes]');
      assert.equal(await button.isVisible(), true);
      assert.equal(await button.evaluate(el => el.previousElementSibling.dataset.orderStart), '');
      await button.click();
      assert.equal(await page.locator('.series-volume-manager').isVisible(), true);
      await page.locator('[data-volume-name]').fill('Teste de volume');
      await page.locator('[data-volume-add]').click();
      await page.locator('[data-volume-edition="0"]').selectOption('Teste de volume');
      // Remove old volumes left empty when the first issue was their only issue.
      for (const name of [...new Set(editions.map(i=>String(i.volumeTitle||i.volume||'Edições')))].filter(n=>n!=='Edições')) {
        if(editions.filter(i=>String(i.volumeTitle||i.volume||'Edições')===name).length===1 && String(editions[0].volumeTitle||editions[0].volume||'Edições')===name) await page.getByRole('button',{name:`Remover volume ${name}`,exact:true}).click();
      }
      await page.getByRole('button', { name: 'Salvar volumes', exact: true }).click();
      assert.equal(await page.locator('.series-volume-manager').count(), 0);
      assert.equal(await page.getByRole('button',{name:'Teste de volume',exact:true}).isVisible(), true);
      await page.locator('[data-manage-volumes]').click();
      await page.getByRole('button',{name:'Remover volume Teste de volume',exact:true}).click();
      await page.getByRole('button', { name: 'Salvar volumes', exact: true }).click();
      assert.equal(await page.getByRole('button',{name:'Teste de volume',exact:true}).count(), 0);
      assert.equal(await page.locator('[data-manage-volumes]').isVisible(), true);
      console.log(`${viewport.width}px: ${editions[0].seriesTitle||editions[0].title}: botão visível, criação e remoção OK`);
    }
    assert.deepEqual(errors, []);
    await page.screenshot({path:`/tmp/banca-volumes-${viewport.width}.png`});
    await page.close();
  }
} finally { await browser.close(); }
