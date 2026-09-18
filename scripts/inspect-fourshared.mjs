import fs from 'node:fs/promises';
import path from 'node:path';
const source = 'https://www.4shared.com/office/_Gh4MImh/Aves_de_Rapina_08.html';
const dir = 'fourshared-diagnostic';
await fs.mkdir(dir, { recursive: true });
const report = [];
const headers = { 'User-Agent': 'Mozilla/5.0', Accept: '*/*' };
async function probe(url, label, extra = {}) {
  try {
    const response = await fetch(url, { headers: { ...headers, ...extra }, signal: AbortSignal.timeout(30000) });
    const reader = response.body?.getReader();
    const chunks = [];
    let size = 0;
    try {
      while (reader && size < 131072) {
        const { value, done } = await reader.read();
        if (done) break;
        chunks.push(value); size += value.byteLength;
      }
    } finally { await reader?.cancel().catch(() => {}); }
    const bytes = Buffer.concat(chunks).subarray(0, 131072);
    const entry = { label, status: response.status, url: response.url, type: response.headers.get('content-type'), length: response.headers.get('content-length'), range: response.headers.get('content-range'), signature: bytes.subarray(0, 16).toString('hex') };
    report.push(entry);
    if (/html|json|text/i.test(entry.type || '')) await fs.writeFile(path.join(dir, label + '.txt'), bytes);
    else await fs.writeFile(path.join(dir, label + '.sample'), bytes.subarray(0, 64));
    console.log(JSON.stringify(entry));
    return bytes.toString('utf8');
  } catch (error) { const entry = { label, error: String(error) }; report.push(entry); console.log(JSON.stringify(entry)); return ''; }
}
const html = await probe(source, 'page');
const match = /<input\b[^>]*\bid=["']jsDirectDownloadLink["'][^>]*>/i.exec(html);
if (match) {
  const value = /\bvalue=["']([^"']+)["']/i.exec(match[0])?.[1];
  if (value) {
    const direct = new URL(value.replaceAll('&amp;', '&'));
    if (direct.protocol === 'https:' && /(?:^|\.)4shared\.com$/i.test(direct.hostname)) {
      await probe(direct.href, 'direct-range', { Range: 'bytes=0-63', Referer: source });
      await probe(direct.href, 'direct-no-range', { Referer: source });
    }
  }
}
await probe('https://vqfmbpqurapcsuixgvql.supabase.co/functions/v1/fourshared-proxy?meta=1&url=' + encodeURIComponent(source), 'proxy-before');
await fs.copyFile('js/app.js', path.join(dir, 'app.js'));
await fs.copyFile('index.html', path.join(dir, 'index.html'));
await fs.writeFile(path.join(dir, 'report.json'), JSON.stringify(report, null, 2));
