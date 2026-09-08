import { TelegramClient } from 'npm:@mtcute/web@0.31.0';
import { MemoryStorage, IntermediatePacketCodec, Long } from 'npm:@mtcute/core@0.31.0';
import { connectTcp } from 'jsr:@fuman/deno@0.0.21';
import { createMediaHandler, MediaError } from './media-core.mjs';
import { resolveDocument, readAligned, safeError, migrationDc, isExpiredReference, SourceError } from './mtproto-source.mjs';
import { createSessionManager, SessionError } from './session-manager.mjs';
import { createSessionCrypto } from './session-crypto.mjs';
class NativeTcpTransport {
  async connect(dc: { ipAddress: string; port: number }, signal: AbortSignal) {
    const conn = await connectTcp({ address: dc.ipAddress, port: dc.port }, signal);
    conn.setNoDelay(true); conn.setKeepAlive(true); return conn;
  }
  packetCodec() { return new IntermediatePacketCodec(); }
}
const required = (name: string) => {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new MediaError(`Configure ${name} nos Secrets do Supabase.`, 503, 'mtproto_not_configured');
  return value;
};
const configured = () => Boolean(Deno.env.get('TELEGRAM_API_ID') && Deno.env.get('TELEGRAM_API_HASH') && Deno.env.get('TELEGRAM_BOT_TOKEN') && Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));
const validFileId = (id: string) => id.length >= 8 && id.length <= 1024 && /^[A-Za-z0-9_-]+$/.test(id);
const allowed = () => new Set(['-1004424843914', ...(Deno.env.get('TELEGRAM_ALLOWED_CHAT_IDS') || '').split(',').map(s => s.trim()).filter(Boolean)]);
const cryptoBox = createSessionCrypto(`${required('TELEGRAM_API_HASH')}:${required('TELEGRAM_BOT_TOKEN')}`);
function diagnostic(error: unknown, stage: string) {
  if (error instanceof MediaError) return error;
  if (error instanceof SessionError) return new MediaError(error.message, error.status, error.code, error.retryAfter);
  const safe = safeError(error, stage);
  console.error('telegram-mtproto', stage, safe.code);
  return new MediaError(safe.message, safe.status, safe.code);
}
async function state(action: string, owner: string, value: string | null = null) {
  const key = required('SUPABASE_SERVICE_ROLE_KEY');
  const response = await fetch(`${required('SUPABASE_URL')}/rest/v1/rpc/banca_mtproto_session`, {
    method: 'POST', headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_action: action, p_owner: owner, p_value: value }), signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new SessionError('Não foi possível acessar o estado privado do gateway.', 503, 'session_storage_unavailable', 5);
  return await response.json();
}
const manager = createSessionManager({
  state, ...cryptoBox,
  botToken: () => required('TELEGRAM_BOT_TOKEN'),
  createClient: async () => {
    const apiId = Number(required('TELEGRAM_API_ID'));
    const apiHash = required('TELEGRAM_API_HASH');
    if (!Number.isSafeInteger(apiId) || apiId <= 0 || !/^[a-f0-9]{32}$/i.test(apiHash)) throw new MediaError('Credenciais MTProto inválidas.', 503);
    return new TelegramClient({ apiId, apiHash, storage: new MemoryStorage(), transport: new NativeTcpTransport(), disableUpdates: true });
  },
});
async function query(path: string) {
  const key = required('SUPABASE_ANON_KEY');
  const response = await fetch(`${required('SUPABASE_URL')}/rest/v1/${path}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new MediaError('Não foi possível validar o catálogo.', 502, `catalog_http_${response.status}`);
  return await response.json();
}
async function lookup(itemId: string) {
  const rows = await query(`catalog_edition_overrides?item_id=eq.${encodeURIComponent(itemId)}&select=edition&limit=1`);
  const edition = rows[0]?.edition;
  if (!edition || String(edition.id) !== itemId || !validFileId(String(edition.telegramFileId || ''))) return null;
  const format = String(edition.format || '').toLowerCase();
  const size = Number(edition.telegramFileSize);
  if (!['pdf', 'cbz', 'cbr'].includes(format) || !Number.isSafeInteger(size) || size < 1) throw new MediaError('Metadados do arquivo incompletos.', 422);
  const hidden = await query(`catalog_item_visibility?item_id=eq.${encodeURIComponent(itemId)}&is_hidden=eq.true&select=item_id&limit=1`);
  if (hidden.length) return null;
  if (edition.seriesId) {
    const hiddenSeries = await query(`catalog_series_visibility?series_id=eq.${encodeURIComponent(String(edition.seriesId))}&is_hidden=eq.true&select=series_id&limit=1`);
    if (hiddenSeries.length) return null;
  }
  return { id: itemId, size, format, telegramUrl: edition.telegramUrl };
}
function normalizeError(error: unknown) {
  if (error instanceof MediaError) return error;
  if (error instanceof SessionError || error instanceof SourceError) return new MediaError(error.message, error.status, error.code, error.retryAfter);
  return diagnostic(error, 'download');
}
const handle = createMediaHandler({
  lookup,
  health: async () => ({ ok: configured(), mode: 'mtproto', configured: configured(), ...await manager.status(), chunkBytes: 262144 }),
  open: async item => {
    let lease;
    try { lease = await manager.open(); }
    catch (error) { throw normalizeError(error); }
    try {
      const client = lease.client;
      const resolve = async () => {
        lease.check();
        try { return await resolveDocument(client, item, allowed(), Long); }
        catch (error) { throw diagnostic(error, 'message'); }
      };
      let file = await resolve();
      let dcId = file.dcId;
      return {
        read: async (offset: number, limit: number, readSignal: AbortSignal) => {
          const read = async (start: number, length: number) => {
            lease.check();
            const download = () => client.downloadChunk({ location: file.location, dcId, offset: start, limit: length, abortSignal: readSignal, maxRetryCount: 2, floodSleepThreshold: 0 });
            try { return await download(); }
            catch (error) {
              const next = migrationDc(error);
              if (next && next !== dcId) { dcId = next; return await download(); }
              if (isExpiredReference(error)) { file = await resolve(); dcId = file.dcId; return await download(); }
              throw error;
            }
          };
          try { return await readAligned(read, offset, limit, item.size, readSignal); }
          catch (error) { throw normalizeError(error); }
        },
        close: lease.release,
      };
    } catch (error) { await lease.release(); throw error; }
  },
});
Deno.serve(handle);
