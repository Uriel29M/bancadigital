(() => {
  'use strict';
  const cache = new Map();
  const formats = new Set(['pdf', 'cbz', 'cbr']);
  function isSource(value) {
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && /(?:^|\.)4shared\.com$/i.test(url.hostname);
    } catch { return false; }
  }
  function proxyUrl(value) {
    if (!isSource(value) || !window.BANCA_SUPABASE_URL) return '';
    const url = new URL(`${window.BANCA_SUPABASE_URL}/functions/v1/4shared-proxy`);
    url.searchParams.set('url', value);
    return url.toString();
  }
  async function detectFormat(value) {
    if (!isSource(value)) return '';
    const cached = cache.get(value);
    if (cached && cached.until > Date.now()) return cached.promise;
    const promise = (async () => {
      const target = proxyUrl(value);
      if (!target) throw new Error('O proxy do 4shared não está configurado.');
      const url = new URL(target);
      url.searchParams.set('meta', '1');
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 25000);
      try {
        const response = await fetch(url, { mode: 'cors', credentials: 'omit', cache: 'no-store', signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'O 4shared não disponibilizou o arquivo para leitura.');
        return formats.has(data.format) ? data.format : '';
      } finally { clearTimeout(timeout); }
    })();
    cache.set(value, { promise, until: Date.now() + 30000 });
    try { return await promise; }
    catch (error) { cache.delete(value); throw error; }
  }
  window.BancaFourshared = Object.freeze({ isSource, proxyUrl, detectFormat });
})();
