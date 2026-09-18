import fs from 'node:fs';
import assert from 'node:assert/strict';
import { Script } from 'node:vm';
const appPath = 'js/app.js';
const htmlPath = 'index.html';
let app = fs.readFileSync(appPath, 'utf8');
let html = fs.readFileSync(htmlPath, 'utf8');
function replaceOnce(text, before, after, label) {
  if (text.includes(after)) return text;
  assert.equal(text.split(before).length, 2, `${label}: expected exactly one anchor; no files modified`);
  return text.replace(before, after);
}
const proxyAnchor = '  function proxiedFileUrl(url) {\n';
app = replaceOnce(app, proxyAnchor, proxyAnchor + '    const fourshared = window.BancaFourshared?.proxyUrl(url);\n    if (fourshared) return fourshared;\n', 'proxy');
const openAnchor = '    readerIsOpen = true;\n    prioritizeReaderLoading();';
const guardedOpen = '    let foursharedFormat = "";\n    if (window.BancaFourshared?.isSource(resolvedUrl)) {\n      try { foursharedFormat = await window.BancaFourshared.detectFormat(resolvedUrl); }\n      catch (error) { toast(error?.message || "O 4shared não disponibilizou o arquivo para leitura."); return; }\n    }\n\n' + openAnchor;
app = replaceOnce(app, openAnchor, guardedOpen, 'reader opening');
const oldFormat = '    const format = /^(pdf|cbz|cbr|jpg|jpeg|png|webp|gif)$/.test(itemFormat)\n      ? itemFormat\n      : (fileFormat || extension(resolvedUrl)).toLowerCase();';
const newFormat = '    const format = /^(pdf|cbz|cbr|jpg|jpeg|png|webp|gif)$/.test(itemFormat)\n      ? itemFormat\n      : (foursharedFormat || fileFormat || extension(resolvedUrl)).toLowerCase();';
app = replaceOnce(app, oldFormat, newFormat, 'format');
const scriptAnchor = '<script src="js/app.js?v=';
html = replaceOnce(html, scriptAnchor, '<script src="js/reader-4shared-v2.js?v=1"></script>\n    ' + scriptAnchor, 'HTML');
assert.ok(fs.existsSync('js/reader-4shared-v2.js'), 'Missing 4shared adapter');
new Script(app, { filename: appPath });
new Script(fs.readFileSync('js/reader-4shared-v2.js', 'utf8'));
fs.writeFileSync(appPath, app);
fs.writeFileSync(htmlPath, html);
console.log('4shared reader integration applied and syntax validated.');
