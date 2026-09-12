import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const source = readFileSync('js/app.js', 'utf8');
const names = ['isTelegramMediaUrl', 'readerLoadingMarkup', 'showReaderPageLoading', 'finishReaderPageLoading', 'renderPDFReader', 'renderCBZRangeSinglePage', 'renderCBZReader', 'renderCBRReader'];
const functions = names.map(name => {
  const start = source.search(new RegExp(`^  (?:async )?function ${name}\\(`, 'm'));
  assert.ok(start >= 0, name);
  const end = source.indexOf('\n  }', start);
  return source.slice(start, end + 4);
}).join('\n');
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
try {
  for (const width of [390, 1280]) {
    for (const format of ['PDF', 'CBZ', 'CBR']) {
      for (const mode of ['single-page', 'double-page', 'continuous-scroll']) {
        const page = await browser.newPage({ viewport: { width, height: 900 } });
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.setContent('<div class="reader-overlay"><button data-close-reader>Fechar</button><div class="reader-body"></div><div id="controls"></div></div>');
        await page.addStyleTag({ content: readFileSync('css/style.css', 'utf8') });
        await page.addScriptTag({ content: `
          const $ = (s, r=document) => r.querySelector(s);
          const state = { readingMode: ${JSON.stringify(mode)} };
          const escapeHTML = String, readerLoadingTipMarkup = () => '';
          let releaseDownload, releasePage;
          const downloadGate = new Promise(r => releaseDownload=r);
          const pageGate = new Promise(r => releasePage=r);
          const canvas = document.createElement('canvas'); canvas.width=300; canvas.height=450;
          canvas.getContext('2d').fillRect(0,0,300,450);
          const READER_END_PAGE_URL = canvas.toDataURL();
          const blobPromise = new Promise(r => canvas.toBlob(r));
          const readerEndPageImage = () => { const img=new Image(); img.src=READER_END_PAGE_URL; return img; };
          const getReaderPages = (n,skip) => Array.from({length:n},(_,i)=>i+1).filter(n=>!skip||n>1);
          const getReaderSpreadIndexes = () => [0,1];
          const getReaderSpreadPages = () => [1,2];
          window.BANCA_SUPABASE_URL = 'https://example.com';
          const proxiedFileUrl = x => x, appAssetUrl = x => x;
          const probeArchiveSignature = async () => null;
          const isRarSignature = () => false, isZipSignature = () => false, isInvalidZipError = () => false;
          const waitForPrefetchedBuffer = async () => null;
          const bytes = new Uint8Array([82,97,114,33,26,7,0,0]).buffer;
          const fetchFileArrayBuffer = async (url, progress) => { progress(10,${width === 390 ? 0 : 100}); await downloadGate; return bytes; };
          const fetchPdfBuffer = async (url,signal,progress) => { progress(10,${width === 390 ? 0 : 100}); await downloadGate; return bytes; };
          const extract = async () => { await pageGate; return blobPromise; };
          const createArchivePageCache = (files,read) => ({thirdSize:2,get:i=>read(files[i]),prefetchThird:async()=>{}});
          window.jszipReady = Promise.resolve({loadAsync:async()=>({files:{'1.png':{async:extract},'2.png':{async:extract}}})});
          const loadLibarchiveModule = async () => ({Archive:{init(){},open:async()=>({getFilesObject:async()=>({'1.png':{name:'1.png',extract},'2.png':{name:'2.png',extract}}),close(){}})}});
          window.pdfjsReady = Promise.resolve({getDocument:()=>({promise:Promise.resolve({numPages:2,getPage:async()=>({getViewport:()=>({width:300,height:450}),render:({canvasContext})=>({promise:pageGate.then(()=>canvasContext.fillRect(0,0,300,450))})})})})});
          const reportFileFailure = () => {}, setReadingMode = () => {};
          ${functions}
          window.releaseDownload = releaseDownload; window.releasePage = releasePage;
          window.run = render${format}Reader({},'https://example.com/functions/v1/telegram-mtproto?item_id=test', $('.reader-body'), $('#controls'), $('.reader-overlay'));
        ` });
        const bar = page.locator('.reader-progress:visible').first();
        await bar.waitFor();
        assert.equal(await page.locator('.reader-spinner').count(), 0);
        await page.evaluate(() => window.releaseDownload());
        await page.waitForTimeout(150);
        assert.ok(await bar.isVisible(), `${width} ${format} ${mode}: bar during page preparation`);
        const box = await bar.boundingBox();
        assert.ok(box.width > 50 && box.x >= 0 && box.x + box.width <= width, JSON.stringify(box));
        await page.screenshot({ path: `/tmp/reader-loading-${format}-${mode}-${width}.png` });
        await page.evaluate(() => window.releasePage());
        await page.evaluate(() => window.run);
        await page.waitForFunction(() => !document.querySelector('.reader-page-loading'));
        assert.equal(await page.locator('.reader-progress:visible').count(), 0, `${format} ${mode}: completed`);
        assert.deepEqual(errors, []);
        console.log('PASS', width, format, mode);
        await page.close();
      }
    }
  }
} finally { await browser.close(); }
