import { TelegramClient } from 'npm:@mtcute/web@0.31.0';
import { MemoryStorage } from 'npm:@mtcute/core@0.31.0';
import { createMediaHandler, MediaError } from './media-core.mjs';

const required = (name: string) => {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new MediaError(`Configure ${name} nos Secrets do Supabase.`, 503, 'mtproto_not_configured');
  return value;
};
const configured = () => Boolean(Deno.env.get('TELEGRAM_API_ID') && Deno.env.get('TELEGRAM_API_HASH') && Deno.env.get('TELEGRAM_BOT_TOKEN'));
const validFileId = (id: string) => id.length >= 8 && id.length <= 1024 && /^[A-Za-z0-9_-]+$/.test(id);
let pendingClient: Promise<TelegramClient> | null = null;
async function telegram() {
  if (!pendingClient) {
    pendingClient = (async () => {
      const apiId = Number(required('TELEGRAM_API_ID'));
      const apiHash = required('TELEGRAM_API_HASH');
      if (!Number.isSafeInteger(apiId) || apiId <= 0 || !/^[a-f0-9]{32}$/i.test(apiHash)) throw new MediaError('Credenciais MTProto inválidas.', 503);
      const client = new TelegramClient({ apiId, apiHash, storage: new MemoryStorage(), disableUpdates: true });
      try { await client.start({ botToken: required('TELEGRAM_BOT_TOKEN') }); return client; }
      catch (error) { await client.destroy().catch(() => {}); throw error; }
    })().catch(error => { pendingClient = null; throw error; });
  }
  return pendingClient;
}
function databaseUrl(path: string) {
  return `${required('SUPABASE_URL')}/rest/v1/${path}`;
}
async function query(path: string) {
  const key = required('SUPABASE_ANON_KEY');
  const response = await fetch(databaseUrl(path), { headers: { apikey: key, Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new MediaError('Não foi possível validar o catálogo.', 502);
  return await response.json();
}
async function lookup(itemId: string) {
  const rows = await query(`catalog_edition_overrides?item_id=eq.${encodeURIComponent(itemId)}&select=edition&limit=1`);
  const edition = rows[0]?.edition;
  if (!edition || String(edition.id) !== itemId || !validFileId(String(edition.telegramFileId || ''))) return null;
  const format = String(edition.format || '').toLowerCase();
  const size = Number(edition.telegramFileSize);
  if (!['pdf','cbz','cbr'].includes(format) || !Number.isSafeInteger(size) || size < 1) throw new MediaError('Metadados do arquivo incompletos.', 422);
  const hidden = await query(`catalog_item_visibility?item_id=eq.${encodeURIComponent(itemId)}&is_hidden=eq.true&select=item_id&limit=1`);
  if (hidden.length) return null;
  if (edition.seriesId) {
    const hiddenSeries = await query(`catalog_series_visibility?series_id=eq.${encodeURIComponent(String(edition.seriesId))}&is_hidden=eq.true&select=series_id&limit=1`);
    if (hiddenSeries.length) return null;
  }
  return { id: itemId, fileId: edition.telegramFileId, size, format };
}
const handle = createMediaHandler({
  lookup,
  health: async () => ({ ok: configured(), mode: 'mtproto', configured: configured(), storage: 'memory', chunkBytes: 262144 }),
  open: async item => {
    const client = await telegram();
    return {
      read: (offset: number, limit: number, signal: AbortSignal) => client.downloadChunk({ location: item.fileId, offset, limit, abortSignal: signal, maxRetryCount: 2, floodSleepThreshold: 0 }),
      // Shared connection and in-memory auth keys remain available to the next Range request.
      close: async () => {},
    };
  },
});
Deno.serve(handle);
