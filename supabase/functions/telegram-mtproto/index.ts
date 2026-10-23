import { TelegramClient } from 'npm:@mtcute/web@0.31.0';
import { MemoryStorage, IntermediatePacketCodec, Long } from 'npm:@mtcute/core@0.31.0';
import { connectTcp } from 'jsr:@fuman/deno@0.0.21';
import { createMediaHandler, MediaError } from './media-core.mjs';
import { resolveDocument, readAligned, migrationDc, isExpiredReference } from './mtproto-source.mjs';

const required = (name: string) => {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new MediaError(`Configure ${name} nos Secrets do Supabase.`, 503, 'mtproto_not_configured');
  return value;
};
const configured = () => Boolean(
  Deno.env.get('TELEGRAM_API_ID') &&
  Deno.env.get('TELEGRAM_API_HASH') &&
  Deno.env.get('TELEGRAM_BOT_TOKEN')
);

class NativeTcpTransport {
  async connect(dc: any, signal: AbortSignal) {
    const conn = await connectTcp({ address: dc.ipAddress, port: dc.port }, signal);
    conn.setNoDelay(true);
    conn.setKeepAlive(true);
    return conn;
  }
  packetCodec() {
    return new IntermediatePacketCodec();
  }
}

let telegramState: { key: string; client: TelegramClient | null; promise: Promise<TelegramClient> | null } = {
  key: '', client: null, promise: null
};

async function telegramClient() {
  const apiId = Number(required('TELEGRAM_API_ID'));
  const apiHash = required('TELEGRAM_API_HASH');
  const botToken = required('TELEGRAM_BOT_TOKEN');
  if (!Number.isSafeInteger(apiId) || apiId <= 0 || !/^[a-f0-9]{32}$/i.test(apiHash)) {
    throw new MediaError('Credenciais MTProto inválidas.', 503, 'telegram_credentials_invalid');
  }

  const digestInput = `${apiId}:${apiHash}:${botToken}`;
  const digest = Array.from(
    new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(digestInput)))
  ).slice(0, 8).join('-');

  if (telegramState.key !== digest) {
    try { await telegramState.client?.destroy?.(); } catch {}
    telegramState = { key: digest, client: null, promise: null };
  }

  if (!telegramState.promise) {
    telegramState.promise = (async () => {
      const client = new TelegramClient({
        apiId,
        apiHash,
        storage: new MemoryStorage(),
        transport: new NativeTcpTransport(),
        disableUpdates: true,
      });
      try {
        await client.start({ botToken });
        telegramState.client = client;
        return client;
      } catch (error) {
        await client.destroy().catch(() => {});
        throw error;
      }
    })().catch(error => {
      telegramState.promise = null;
      telegramState.client = null;
      console.error('telegram_mtproto_connect_failed', {
        name: error instanceof Error ? error.name : 'Error',
        message: error instanceof Error ? error.message : String(error),
      });
      throw error;
    });
  }

  return telegramState.promise;
}

function databaseUrl(path: string) {
  return `${required('SUPABASE_URL')}/rest/v1/${path}`;
}
async function query(path: string) {
  const key = required('SUPABASE_ANON_KEY');
  const response = await fetch(databaseUrl(path), {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(10000)
  });
  if (!response.ok) throw new MediaError('Não foi possível validar o catálogo.', 502, `catalog_http_${response.status}`);
  return await response.json();
}
async function lookup(itemId: string) {
  if (!/^[A-Za-z0-9_-]{1,160}$/.test(itemId)) {
    throw new MediaError('Identificador de edição inválido.', 400, 'invalid_item_id');
  }
  const rows = await query(`catalog_edition_overrides?item_id=eq.${encodeURIComponent(itemId)}&select=edition&limit=1`);
  const edition = rows[0]?.edition;
  if (!edition || String(edition.id) !== itemId) return null;

  const telegramUrl = String(edition.telegramUrl || '').trim();
  const size = Number(edition.telegramFileSize);
  const format = String(edition.format || '').toLowerCase();
  if (!telegramUrl || !Number.isSafeInteger(size) || size < 1 || !['pdf', 'cbz', 'cbr'].includes(format)) {
    throw new MediaError('Metadados Telegram incompletos.', 422, 'telegram_metadata_invalid');
  }

  const hidden = await query(`catalog_item_visibility?item_id=eq.${encodeURIComponent(itemId)}&is_hidden=eq.true&select=item_id&limit=1`);
  if (hidden.length) return null;

  const seriesId = String(edition.seriesId || '');
  if (seriesId) {
    const hiddenSeries = await query(`catalog_series_visibility?series_id=eq.${encodeURIComponent(seriesId)}&is_hidden=eq.true&select=series_id&limit=1`);
    if (hiddenSeries.length) return null;
  }

  return { id: itemId, telegramUrl, size, format };
}

const handle = createMediaHandler({
  lookup,
  health: async () => ({
    ok: configured(),
    mode: 'mtproto-tcp',
    configured: configured(),
    transport: 'native-tcp',
    documentLookup: 'channel-message',
    chunkBytes: 262144
  }),
  open: async (item: { id: string; telegramUrl: string; size: number; format: string }, signal: AbortSignal) => {
    const client = await telegramClient();
    const allowed = new Set(
      (Deno.env.get('TELEGRAM_ALLOWED_CHAT_IDS') || '-1004424843914')
        .split(',').map(value => value.trim()).filter(Boolean)
    );

    // O file_id da Bot API NÃO é uma FileLocation de MTProto. Resolve a
    // mensagem original para obter document.id, accessHash, fileReference e dcId.
    let file = await resolveDocument(client, item, allowed, Long);
    let dcId = file.dcId;

    const read = async (offset: number, limit: number, readSignal: AbortSignal) => {
      const download = (from: number, count: number, abortSignal: AbortSignal) =>
        client.downloadChunk({
          location: file.location,
          dcId,
          offset: from,
          limit: count,
          abortSignal,
          maxRetryCount: 2,
          floodSleepThreshold: 0
        });

      try {
        return await readAligned(download, offset, limit, item.size, readSignal);
      } catch (error) {
        const nextDc = migrationDc(error);
        if (nextDc && nextDc !== dcId) {
          dcId = nextDc;
          return await readAligned(download, offset, limit, item.size, readSignal);
        }
        if (isExpiredReference(error)) {
          file = await resolveDocument(client, item, allowed, Long);
          dcId = file.dcId;
          return await readAligned(download, offset, limit, item.size, readSignal);
        }
        throw error;
      }
    };

    if (signal?.aborted) throw new DOMException('Leitura cancelada.', 'AbortError');
    return { read, close: async () => {} };
  },
});
Deno.serve(handle);
