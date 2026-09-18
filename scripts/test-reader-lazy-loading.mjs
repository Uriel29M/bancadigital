import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const index = readFileSync('index.html', 'utf8');
const app = readFileSync('js/app.js', 'utf8');
const deps = readFileSync('js/reader-deps.js', 'utf8');
const sw = readFileSync('sw.js', 'utf8');

assert.ok(index.includes('js/reader-deps.js?v=1-lazy-reader-deps'), 'index deve carregar o lazy loader');
assert.ok(!index.includes('window.pdfjsReady = new Promise'), 'PDF.js não pode carregar no bootstrap');
assert.ok(!index.includes('cdn.jsdelivr.net/npm/jszip@3.10.1'), 'JSZip não pode carregar no bootstrap');
assert.ok(!index.includes('@zip.js/zip.js@2.7.57/+esm'), 'zip.js não pode carregar no bootstrap');

assert.ok(deps.includes("const loadPdf = () =>"), 'lazy loader precisa suportar PDF');
assert.ok(deps.includes("const loadJsZip = () =>"), 'lazy loader precisa suportar JSZip');
assert.ok(deps.includes("const loadZipJs = () =>"), 'lazy loader precisa suportar zip.js');

assert.ok(app.includes('async function ensureReaderDependency(format)'), 'app precisa da ponte lazy');
assert.ok(app.includes('await ensureReaderDependency(selectedFormat)'), 'leitor deve carregar dependências antes de renderizar');
assert.ok(app.includes('await ensureReaderDependency("pdf")'), 'ferramentas de PDF devem carregar PDF.js sob demanda');
assert.ok(app.includes('await ensureReaderDependency("cbz")'), 'ferramentas de CBZ devem carregar ZIP sob demanda');
assert.ok(app.includes('if (offlineFormat === "cbz") await ensureReaderDependency("cbz")'), 'download CBZ deve preparar dependência para uso offline');
assert.ok(!app.includes('warmLibarchive()'), 'libarchive não deve aquecer durante o bootstrap');

assert.ok(sw.includes('reader-deps.js?v=1-lazy-reader-deps'), 'service worker deve guardar o loader local');
assert.ok(sw.includes('readerCdnHosts'), 'service worker deve guardar dependências remotas usadas pelo leitor');

console.log('PASS lazy reader dependencies');
