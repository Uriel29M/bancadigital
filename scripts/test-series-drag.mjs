// Run with Playwright installed, or set PLAYWRIGHT_MODULE to its module path.
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const source = readFileSync(process.env.APP_SOURCE || 'js/app.js', 'utf8');
const helper = source.slice(source.indexOf('  function bindSeriesEditionOrder('), source.indexOf('  function openSeriesSelection('));
const guard = source.slice(source.indexOf('  ["pointerdown", "pointermove", "pointerup", "pointercancel"].forEach'), source.indexOf('  const preventBackgroundScroll ='));
const browser = await chromium.launch({headless:true,args:['--no-sandbox']});
try {
for (const touch of [false,true]) {
 const context = await browser.newContext({viewport:{width:1000,height:800},hasTouch:touch});
 const page = await context.newPage();
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setContent(`<div id="modal-root"><div class="modal-backdrop"><div class="modal series-modal"><div class="section-head"></div><div class="series-volume-panel"><div class="results-grid">${['a','b','c'].map(id=>`<div class="card-wrap"><article class="card" data-open="${id}" style="height:180px;background:#444">${id}</article></div>`).join('')}</div></div></div></div></div>`);
 await page.addStyleTag({content:readFileSync('css/style.css','utf8')});
 await page.addScriptTag({content:`const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];const modalRoot=$('#modal-root');${guard}
 const editions=['a','b','c'].map(id=>({id,seriesId:'test'}));const state={db:{library:editions},session:{user:{id:'admin'}}};const sb={};const isAdminProfile=()=>true;const save=()=>{};
 const BancaCatalogSync={publishMany:async (s,items)=>items.map(edition=>({item_id:edition.id,edition,updated_at:'2026-09-10'}))};window.testState=state;
 ${helper}
 bindSeriesEditionOrder($('.modal-backdrop'),editions);window.backgroundPointerEvents=0;document.addEventListener('pointerdown',()=>window.backgroundPointerEvents++);`});
 await page.locator('[data-order-start]').click();
 const handles=page.locator('.series-order-handle');
 const a=await handles.nth(0).boundingBox(),c=await handles.nth(2).boundingBox();
 const from={x:a.x+a.width/2,y:a.y+a.height/2},to={x:c.x+c.width/2,y:c.y+c.height/2};
 if(touch){
  const cdp=await context.newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[from]});
  for(let i=1;i<=16;i++) await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:from.x+(to.x-from.x)*i/16,y:from.y+(to.y-from.y)*i/16}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 }else{await page.mouse.move(from.x,from.y);await page.mouse.down();await page.mouse.move(to.x,to.y,{steps:16});await page.mouse.up();}
 const ids=await page.locator('.results-grid [data-open]').evaluateAll(nodes=>nodes.map(n=>n.dataset.open));
 console.log(touch?'touch':'mouse',ids,errors);
 assert.deepEqual(ids,['b','c','a']);assert.deepEqual(errors,[]);
 assert.equal(await page.evaluate(()=>window.backgroundPointerEvents),0);
 await page.locator('[data-order-save]').click();
 assert.equal(await page.evaluate(()=>window.testState.db.library.find(i=>i.id==='a').seriesSortOrder),2);
 await context.close();
}
}finally{await browser.close();}
