import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const index = readFileSync('index.html', 'utf8');
const app = readFileSync('js/app.js', 'utf8');
const deps = readFileSync('js/reader-deps.js', 'utf8');
const sw = readFileSync('sw.js', 'utf8');

assert.ok(index.includes('js/reader-deps.js?v='), 'index deve carregar o lazy loader versionado');
assert.ok(!index.includes('window.pdfjsReady = new Promise'), 'PDF.js não pode carregar no bootstrap');
assert.ok(!index.includes('cdn.jsdelivr.net/npm/jszip@3.10.1'), 'JSZip não pode carregar no bootstrap');
assert.ok(!index.includes('@zip.js/zip.js@2.7.57/+esm'), 'zip.js não pode carregar no bootstrap');

assert.ok(deps.includes("const loadPdf = () =>"), 'lazy loader precisa suportar PDF');
assert.ok(deps.includes("const loadJsZip = () =>"), 'lazy loader precisa suportar JSZip');
assert.ok(deps.includes("const loadZipJs = () =>"), 'lazy loader precisa suportar zip.js');
assert.ok(deps.includes("const prepareCbr = () =>"), 'lazy loader precisa preparar CBR sob demanda');
assert.ok(deps.includes("banca-digital-reader-runtime-v1"), 'dependências locais do leitor devem usar cache de runtime');
assert.ok(deps.includes("reader-formats.js?v=1-reader-split"), 'módulo dos renderizadores deve ser preparado para offline');

assert.ok(app.includes('async function ensureReaderDependency(format)'), 'app precisa da ponte lazy');
assert.ok(app.includes('await ensureReaderDependency(selectedFormat)'), 'leitor deve carregar dependências antes de renderizar');
assert.ok(app.includes('await ensureReaderDependency("pdf")'), 'ferramentas de PDF devem carregar PDF.js sob demanda');
assert.ok(app.includes('await ensureReaderDependency("cbz")'), 'ferramentas de CBZ devem carregar ZIP sob demanda');
assert.ok(app.includes('if (["pdf", "cbz", "cbr"].includes(offlineFormat)) await ensureReaderDependency(offlineFormat)'), 'download deve preparar dependências PDF/CBZ/CBR para uso offline');
assert.ok(!app.includes('warmLibarchive()'), 'libarchive não deve aquecer durante o bootstrap');
assert.ok(app.includes('import(appAssetUrl("js/reader-formats.js"))'), 'app deve importar renderizadores sob demanda');
assert.ok(!app.includes('async function fetchPdfBuffer('), 'fetch do PDF deve sair fisicamente do app.js');
assert.ok(!app.includes('async function renderCBZRangeSinglePage('), 'renderização CBZ deve sair fisicamente do app.js');

assert.ok(sw.includes('reader-deps.js?v='), 'service worker deve guardar o loader local versionado');
assert.ok(sw.includes('readerCdnHosts'), 'service worker deve guardar dependências remotas usadas pelo leitor');
assert.ok(!sw.includes('"./js/pdfjs/pdf.min.mjs"'), 'PDF.js não deve ser pré-cacheado no shell');
assert.ok(!sw.includes('"./libarchive/libarchive.js"'), 'libarchive não deve ser pré-cacheado no shell');
assert.ok(!sw.includes('client.navigate('), 'ativação do service worker não deve recarregar abas em uso');

console.log('PASS lazy reader dependencies');
