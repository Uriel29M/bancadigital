/* Shared editorial defaults. Personal cover choices always take precedence. */
window.BancaSeriesDefaults = (() => {
  const table = 'catalog_series_default_covers';
  const rows = new Map();
  let client = null;
  let channel = null;
  let timer = null;
  let loading = null;
  let changed = () => {};
  function get(seriesId) { return rows.get(String(seriesId || '')) || null; }
  function replace(data) {
    rows.clear();
    for (const row of data || []) if (row.series_id && row.cover_url) rows.set(String(row.series_id), row);
    changed();
    return rows;
  }
  async function refresh() {
    if (!client || (typeof navigator !== 'undefined' && navigator.onLine === false)) return rows;
    if (loading) return loading;
    loading = (async () => {
      const { data, error } = await client.from(table).select('series_id,item_id,cover_url,variant_key,is_variant,updated_at').order('series_id').limit(10000);
      if (error) throw error;
      return replace(data);
    })();
    try { return await loading; } finally { loading = null; }
  }
  async function setDefault(seriesId, option, userId) {
    if (!client || !userId || !seriesId || !option?.itemId || !option?.coverUrl) throw new Error('Selecione uma capa e entre como administrador.');
    const row = { series_id: String(seriesId), item_id: String(option.itemId), cover_url: String(option.coverUrl), variant_key: option.isVariant ? String(option.variantKey || '') : null, is_variant: Boolean(option.isVariant), updated_by: userId };
    const { data, error } = await client.from(table).upsert(row, { onConflict: 'series_id' }).select('series_id,item_id,cover_url,variant_key,is_variant,updated_at').single();
    if (error) throw error;
    if (!data || data.series_id !== row.series_id || data.cover_url !== row.cover_url) throw new Error('O banco não confirmou a capa padrão.');
    rows.set(row.series_id, data);
    changed(row.series_id);
    return data;
  }
  function start(sb, onChange = () => {}) {
    if (!sb) return;
    client = sb;
    changed = onChange;
    if (channel) return;
    channel = client.channel('banca-series-default-covers').on('postgres_changes', { event: '*', schema: 'public', table }, () => { refresh().catch(error => console.warn('Capas padrão indisponíveis:', error)); }).subscribe();
    if (typeof window !== 'undefined') {
      window.addEventListener('focus', () => { refresh().catch(() => {}); });
      window.addEventListener('online', () => { refresh().catch(() => {}); });
      document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh().catch(() => {}); });
      timer = window.setInterval(() => { if (!document.hidden && navigator.onLine !== false) refresh().catch(() => {}); }, 60000);
    }
    return refresh();
  }
  return { rows, get, refresh, replace, setDefault, start };
})();
