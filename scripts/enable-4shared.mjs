// Integration patch for the large legacy reader. Run with node scripts/enable-4shared.mjs.
import fs from 'node:fs';
const path = 'js/app.js';
let source = fs.readFileSync(path, 'utf8');
const marker = '  function proxiedFileUrl(url) {\n';
const addition = '    const fourshared = window.BancaFourshared?.proxyUrl(url);\n    if (fourshared) return fourshared;\n';
if (!source.includes(addition)) {
  if (source.split(marker).length !== 2) throw new Error('Reader proxy anchor changed; no files modified.');
  source = source.replace(marker, marker + addition);
}
const oldFormat = '    const format = /^(pdf|cbz|cbr|jpg|jpeg|png|webp|gif)$/.test(itemFormat)\n      ? itemFormat\n      : (fileFormat || extension(resolvedUrl)).toLowerCase();';
const newFormat = '    const foursharedFormat = window.BancaFourshared?.isSource(resolvedUrl)\n      ? await window.BancaFourshared.detectFormat(resolvedUrl) : "";\n    const format = /^(pdf|cbz|cbr|jpg|jpeg|png|webp|gif)$/.test(itemFormat)\n      ? itemFormat\n      : (foursharedFormat || fileFormat || extension(resolvedUrl)).toLowerCase();';
if (!source.includes(newFormat)) {
  if (source.split(oldFormat).length !== 2) throw new Error('Reader format anchor changed; no files modified.');
  source = source.replace(oldFormat, newFormat);
}
const htmlPath = 'index.html';
let html = fs.readFileSync(htmlPath, 'utf8');
if (!html.includes('js/reader-4shared.js')) {
  const anchor = '<script src="js/app.js?v=';
  if (!html.includes(anchor)) throw new Error('Application script anchor changed; no files modified.');
  html = html.replace(anchor, '<script src="js/reader-4shared.js?v=1"></script>\n    ' + anchor);
}
fs.writeFileSync(path, source);
fs.writeFileSync(htmlPath, html);
console.log('4shared reader integration applied.');
