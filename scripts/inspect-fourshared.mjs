import fs from 'node:fs/promises';
import path from 'node:path';
const base = 'https://www.4shared.com/office/_Gh4MImh/Aves_de_Rapina_08.html';
const out = 'fourshared-diagnostic';
await fs.mkdir(out, { recursive: true });
const report = [];
async function inspect(url, name, headers = {}) {
  const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'text/html,application/json,application/octet-stream,*/*', ...headers }, signal: AbortSignal.timeout(30000) });
  const bytes = new Uint8Array(await response.arrayBuffer());
  const text = new TextDecoder().decode(bytes.subarray(0, 1024 * 1024));
  const entry = { name, url: response.url, status: response.status, type: response.headers.get('content-type'), length: bytes.length, signature: Buffer.from(bytes.subarray(0, 16)).toString('hex') };
  report.push(entry);
  if (/html|json|javascript|text\//i.test(entry.type || '') && bytes.length <= 1024 * 1024) await fs.writeFile(path.join(out, name), text);
  else await fs.writeFile(path.join(out, name + '.sample'), bytes.subarray(0, 64));
  console.log(JSON.stringify(entry));
  return text;
}
const page = await inspect(base, 'page.html');
const scripts = [...page.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)].map(m => new URL(m[1].replaceAll('&amp;', '&'), base).href);
const relevant = scripts.filter(u => /4shared\.com|4s\.io/.test(new URL(u).hostname)).slice(0, 18);
for (let i = 0; i < relevant.length; i++) {
  try { await inspect(relevant[i], `script-${i}.js`); } catch (e) { report.push({ url: relevant[i], error: String(e) }); }
}
for (const [i, url] of [
  'https://api.4shared.com/v1_2/files/_Gh4MImh',
  'https://api.4shared.com/v1_2/files/_Gh4MImh/download',
  'https://www.4shared.com/get/_Gh4MImh/Aves_de_Rapina_08.html',
  'https://vqfmbpqurapcsuixgvql.supabase.co/functions/v1/fourshared-proxy?meta=1&url=' + encodeURIComponent(base),
].entries()) {
  try { await inspect(url, `probe-${i}.txt`, { Range: 'bytes=0-63' }); } catch (e) { report.push({ url, error: String(e) }); }
}
await fs.writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
