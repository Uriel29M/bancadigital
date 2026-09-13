import assert from 'node:assert/strict';
import fs from 'node:fs';
const app = fs.readFileSync('js/app.js', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');
assert.ok(app.includes('window.BancaFourshared?.proxyUrl(url)'));
assert.ok(app.includes('foursharedFormat || fileFormat'));
assert.ok(html.includes('js/reader-4shared-v2.js'));
console.log('PASS: 4shared adapter is wired into the reader.');
