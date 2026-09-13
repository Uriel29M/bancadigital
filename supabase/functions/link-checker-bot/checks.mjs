const sourceFields = ['coverUrl', 'cover', 'featuredCoverUrl', 'fileUrl', 'telegramUrl', 'telegramFileId', 'telegramFileName', 'telegramFileSize', 'backupUrls', 'format'];

export function mergeCatalog(library, overrides) {
  const items = new Map(library.map(item => [String(item.id), { item, updatedAt: null }]));
  for (const row of overrides) {
    if (!row.edition || String(row.edition.id) !== String(row.item_id)) continue;
    const item = { ...items.get(String(row.item_id))?.item, ...row.edition };
    for (const field of sourceFields) {
      if (!Object.hasOwn(row.edition, field)) delete item[field];
    }
    items.set(String(row.item_id), { item, updatedAt: row.updated_at });
  }
  return [...items.values()].filter(({ item }) => item.id && !item.catalogDeleted);
}

export function sourcesFor(item) {
  const telegram = String(item.telegramUrl || '').trim();
  const primary = telegram && item.telegramFileId ? telegram : String(item.fileUrl || telegram).trim();
  return [...new Set([primary, item.fileUrl, ...(Array.isArray(item.backupUrls) ? item.backupUrls : []), telegram]
    .map(url => String(url || '').trim()).filter(Boolean))];
}

function probeUrl(url, item, serviceUrl) {
  const parsed = new URL(url);
  if (!/^https?:$/.test(parsed.protocol)) return null;
  let proxy = '';
  if (/(^|\.)mediafire\.com$/i.test(parsed.hostname)) proxy = 'mediafire-proxy';
  if (/(^|\.)(mega\.nz|mega\.co\.nz)$/i.test(parsed.hostname)) proxy = 'mega-proxy';
  if (['drive.google.com', 'docs.google.com'].includes(parsed.hostname)) proxy = 'drive-proxy';
  if (/(^|\.)4shared\.com$/i.test(parsed.hostname)) proxy = 'fourshared-proxy';
  if (['t.me', 'telegram.me', 'www.t.me', 'www.telegram.me'].includes(parsed.hostname)) {
    if (url !== item.telegramUrl || !item.telegramFileId) return null;
    return `${serviceUrl}/functions/v1/telegram-mtproto?item_id=${encodeURIComponent(item.id)}`;
  }
  return proxy ? `${serviceUrl}/functions/v1/${proxy}?url=${encodeURIComponent(url)}` : url;
}

async function readPrefix(response, limit = 8192) {
  const reader = response.body?.getReader();
  if (!reader) return new Uint8Array();
  const bytes = new Uint8Array(limit);
  let length = 0;
  try {
    while (length < limit) {
      const { value, done } = await reader.read();
      if (done) break;
      const chunk = value.subarray(0, limit - length);
      bytes.set(chunk, length);
      length += chunk.length;
    }
  } finally { await reader.cancel().catch(() => {}); }
  return bytes.subarray(0, length);
}

export async function checkSource(url, item, serviceUrl, fetcher = fetch) {
  let target;
  try { target = probeUrl(url, item, serviceUrl); }
  catch { return { state: 'broken', reason: 'URL invalida' }; }
  if (!target) return { state: 'unknown', reason: 'Fonte requer verificacao manual' };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetcher(target, {
      signal: controller.signal, redirect: 'follow',
      headers: { Range: 'bytes=0-8191', Accept: '*/*', 'User-Agent': 'BancaDigitalLinkChecker/2.0' },
    });
    const bytes = await readPrefix(response);
    const text = new TextDecoder().decode(bytes);
    const reason = `HTTP ${response.status}`;
    if ([404, 410].includes(response.status)) return { state: 'broken', reason };
    // Rate limits, challenges and network outages do not prove a file is gone.
    if ([401, 403, 429].includes(response.status)) return { state: 'unknown', reason };
    const format = text.startsWith('%PDF-') ? 'pdf'
      : bytes[0] === 0x50 && bytes[1] === 0x4b && [3, 5, 7].includes(bytes[2]) ? 'cbz'
      : text.startsWith('Rar!\x1a\x07') ? 'cbr'
      : bytes[0] === 0xff && bytes[1] === 0xd8 ? 'jpg'
      : bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 ? 'png' : '';
    if (response.ok && format) return { state: 'working', format };
    if (/file (?:has been |was )?(?:deleted|removed|not found)|file does not exist|link (?:has )?expired|arquivo (?:foi )?(?:removido|exclu[ií]do|inexistente)|(?:ENOENT|EKEY)|(?:Mega|MediaFire) respondeu HTTP (?:404|410)|link do MediaFire expirou/i.test(text)) {
      return { state: 'broken', reason: 'Arquivo removido, expirado ou inacessivel no provedor' };
    }
    if (!response.ok) return { state: 'unknown', reason };
    return { state: 'unknown', reason: 'Resposta sem um arquivo reconhecido' };
  } catch {
    return { state: 'unknown', reason: 'Falha temporaria de rede ou timeout' };
  } finally { clearTimeout(timer); }
}

export async function inspectEdition(item, check) {
  const urls = sourcesFor(item);
  if (!urls.length) return { action: 'hide', reason: 'Edicao sem fonte de arquivo' };
  const results = [];
  for (const url of urls) {
    let result = await check(url, item);
    if (result.state === 'broken') result = await check(url, item);
    results.push(result);
    if (result.state === 'working') {
      if (results.length === 1) return { action: 'none' };
      // Telegram posts need metadata, not just a URL, to become a primary.
      if (results[0].state === 'broken' && !/^https?:\/\/(?:www\.)?(?:t\.me|telegram\.me)\//i.test(url)) {
        return { action: 'swap', fallbackUrl: url, fallbackFormat: result.format, reason: results[0].reason };
      }
      return { action: 'none' };
    }
  }
  return results.every(result => result.state === 'broken')
    ? { action: 'hide', reason: results.map(result => result.reason).join('; ') }
    : { action: 'none', uncertain: true };
}
