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

async function loadPersistentSession(): Promise<string | null> {
  // Accept a pre-provisioned session from Supabase Secrets as well as the DB.
  // This permits recovery without re-authenticating when a session already
  // exists in the project configuration.
  for (const name of ['TELEGRAM_MTPROTO_SESSION', 'TELEGRAM_MTPROTO_SESSION_STRING', 'TELEGRAM_SESSION_STRING', 'TELEGRAM_SESSION', 'TG_SESSION', 'MT_PROTO_SESSION']) {
    const value = Deno.env.get(name)?.trim();
    if (value) return value;
  }
  // Also catch other existing secret names without ever logging their values.
  try {
    for (const [name, raw] of Object.entries(Deno.env.toObject())) {
      if (/^(?:TELEGRAM|TG|MTPROTO).*(?:SESSION|AUTH_STRING)$/i.test(name) ||
          /^(?:SESSION|AUTH_STRING).*(?:TELEGRAM|TG|MTPROTO)$/i.test(name)) {
        const value = raw.trim();
        if (value && !['TELEGRAM_BOT_TOKEN'].includes(name)) return value;
      }
    }
  } catch { /* read the explicit names and database below */ }
  const baseRaw = required('SUPABASE_URL');
  const base = baseRaw.endsWith('/') ? baseRaw.slice(0, -1) : baseRaw;
  const key = required('SUPABASE_SERVICE_ROLE_KEY');
  const response = await fetch(`${base}/rest/v1/telegram_mtproto_session?id=eq.primary&select=session_string&limit=1`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(10000)
  });
  if (!response.ok) throw new MediaError('Não foi possível recuperar a sessão segura do Telegram.', 503, 'telegram_session_read_failed');
  const rows = await response.json();
  return typeof rows?.[0]?.session_string === 'string' && rows[0].session_string ? rows[0].session_string : null;
}
async function savePersistentSession(session: string): Promise<void> {
  const baseRaw = required('SUPABASE_URL');
  const base = baseRaw.endsWith('/') ? baseRaw.slice(0, -1) : baseRaw;
  const key = required('SUPABASE_SERVICE_ROLE_KEY');
  const response = await fetch(`${base}/rest/v1/telegram_mtproto_session`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal'
    },
    body: JSON.stringify({ id: 'primary', session_string: session, updated_at: new Date().toISOString() }),
    signal: AbortSignal.timeout(10000)
  });
  if (!response.ok) throw new MediaError('Não foi possível persistir a sessão segura do Telegram.', 503, 'telegram_session_write_failed');
}


// Persistent auth bootstrap coordination. Row id=primary stores only the real
// session. Row id=cooldown stores a temporary lock/cooldown marker.
async function authStateUrl(query = ""): Promise<string> {
  const baseRaw = required('SUPABASE_URL');
  const base = baseRaw.endsWith('/') ? baseRaw.slice(0, -1) : baseRaw;
  return `${base}/rest/v1/telegram_mtproto_session${query}`;
}
function adminHeaders(extra: Record<string, string> = {}) {
  const key = required('SUPABASE_SERVICE_ROLE_KEY');
  return { apikey: key, Authorization: `Bearer ${key}`, ...extra };
}
async function readBootstrapState(): Promise<string | null> {
  const response = await fetch(await authStateUrl('?id=eq.cooldown&select=session_string&limit=1'), {
    headers: adminHeaders(), signal: AbortSignal.timeout(10000)
  });
  if (!response.ok) throw new MediaError('Não foi possível consultar o estado de autenticação do Telegram.', 503, 'telegram_state_read_failed');
  const rows = await response.json();
  return typeof rows?.[0]?.session_string === 'string' ? rows[0].session_string : null;
}
async function compareAndSetBootstrapState(expected: string, next: string): Promise<boolean> {
  const url = await authStateUrl(`?id=eq.cooldown&session_string=eq.${encodeURIComponent(expected)}`);
  const response = await fetch(url, {
    method: 'PATCH',
    headers: adminHeaders({ 'Content-Type': 'application/json', Prefer: 'return=representation' }),
    body: JSON.stringify({ session_string: next, updated_at: new Date().toISOString() }),
    signal: AbortSignal.timeout(10000)
  });
  if (!response.ok) throw new MediaError('Não foi possível atualizar o estado de autenticação do Telegram.', 503, 'telegram_state_write_failed');
  const rows = await response.json();
  return Array.isArray(rows) && rows.length > 0;
}
async function claimBootstrapLease(): Promise<string> {
  const expiry = Date.now() + 120000;
  const lease = `connecting:${expiry}:${crypto.randomUUID()}`;
  for (let attempt = 0; attempt < 3; attempt++) {
    const current = await readBootstrapState();
    if (current === null) {
      const response = await fetch(await authStateUrl('?on_conflict=id'), {
        method: 'POST',
        headers: adminHeaders({ 'Content-Type': 'application/json', Prefer: 'resolution=ignore-duplicates,return=representation' }),
        body: JSON.stringify({ id: 'cooldown', session_string: lease, updated_at: new Date().toISOString() }),
        signal: AbortSignal.timeout(10000)
      });
      if (!response.ok) throw new MediaError('Não foi possível reservar a autenticação do Telegram.', 503, 'telegram_state_write_failed');
      const rows = await response.json();
      if (Array.isArray(rows) && rows.some((row: any) => row.session_string === lease)) return lease;
      continue;
    }
    const parts = current.split(':');
    const mode = parts[0];
    const until = Number(parts[1] || 0);
    if (until > Date.now() && mode === 'cooldown') {
      const remaining = Math.ceil((until - Date.now()) / 1000);
      throw new MediaError(`Telegram está em espera temporária após limitar a autenticação. Tente novamente em aproximadamente ${remaining} segundos.`, 503, 'telegram_flood_wait');
    }
    if (until > Date.now() && mode === 'connecting') {
      throw new MediaError('A sessão do Telegram está sendo inicializada por outra requisição. Tente novamente em alguns segundos.', 503, 'telegram_session_initializing');
    }
    if (await compareAndSetBootstrapState(current, lease)) return lease;
  }
  throw new MediaError('Outra requisição está inicializando a sessão do Telegram. Tente novamente em alguns segundos.', 503, 'telegram_session_initializing');
}
async function releaseBootstrapLease(lease: string): Promise<void> {
  const response = await fetch(await authStateUrl(`?id=eq.cooldown&session_string=eq.${encodeURIComponent(lease)}`), {
    method: 'DELETE', headers: adminHeaders(), signal: AbortSignal.timeout(10000)
  });
  if (!response.ok) throw new MediaError('Não foi possível liberar a reserva de autenticação do Telegram.', 503, 'telegram_state_write_failed');
}
async function markBootstrapCooldown(lease: string, until: number, code: string): Promise<void> {
  const next = `cooldown:${until}:${code}`;
  const changed = await compareAndSetBootstrapState(lease, next);
  if (!changed) {
    // If the lease was replaced, do not overwrite a different worker's lock.
    console.warn('telegram_mtproto_lease_lost_before_cooldown');
  }
}

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
        // Reuse the Telegram authorization key across Edge Function cold starts.
        const session = await loadPersistentSession();
        if (session) {
          await client.start({ session });
        } else {
          // A bootstrap auth lock is stored in a separate row of the existing
          // server-only table so parallel Edge isolates cannot all authenticate.
          let lease: string;
          try {
            lease = await claimBootstrapLease();
          } catch (leaseError) {
            // Parallel range requests wait briefly for the one authorized
            // bootstrap request, then reuse its persisted session.
            if (leaseError instanceof MediaError && leaseError.code === 'telegram_session_initializing') {
              for (let attempt = 0; attempt < 20; attempt++) {
                await new Promise(resolve => setTimeout(resolve, 500));
                const readySession = await loadPersistentSession();
                if (readySession) {
                  await client.start({ session: readySession });
                  telegramState.client = client;
                  return client;
                }
                const state = await readBootstrapState();
                const parts = (state || '').split(':');
                if (parts[0] === 'cooldown' && Number(parts[1]) > Date.now()) {
                  const remaining = Math.ceil((Number(parts[1]) - Date.now()) / 1000);
                  throw new MediaError(`Telegram está em espera temporária. Tente novamente em aproximadamente ${remaining} segundos.`, 503, 'telegram_flood_wait');
                }
              }
            }
            throw leaseError;
          }
          try {
            await client.start({ botToken });
            const exported = await client.exportSession();
            if (!exported) throw new MediaError('O Telegram não retornou uma sessão persistível.', 503, 'telegram_session_export_failed');
            await savePersistentSession(exported);
            await releaseBootstrapLease(lease);
          } catch (authError) {
            const flood = /FLOOD_WAIT_(\d+)/i.exec(authError instanceof Error ? authError.message : String(authError));
            const seconds = flood ? Math.max(30, Number(flood[1]) + 5) : 60;
            const code = flood ? `FLOOD_WAIT_${flood[1]}` : 'AUTH_FAILED';
            await markBootstrapCooldown(lease, Date.now() + seconds * 1000, code).catch(stateError => {
              console.error('telegram_mtproto_cooldown_persist_failed', {
                message: stateError instanceof Error ? stateError.message : String(stateError)
              });
            });
            if (flood) {
              throw new MediaError(`Telegram limitou temporariamente a autenticação. Nova tentativa liberada em aproximadamente ${seconds} segundos.`, 503, 'telegram_flood_wait');
            }
            throw authError;
          }
        }
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

  const fileId = String(edition.telegramFileId || '').trim();
  return { id: itemId, telegramUrl, size, format, fileId };
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
  open: async (item: { id: string; telegramUrl: string; size: number; format: string; fileId?: string }, signal: AbortSignal) => {
    // Use the already-resolved Bot API file id when Telegram's file endpoint
    // permits it. Fall back to MTProto for large files unsupported by Bot API.
    if (item.fileId && item.size <= 20 * 1024 * 1024) {
      const token = required('TELEGRAM_BOT_TOKEN');
      const metaResponse = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${encodeURIComponent(item.fileId)}`, {
        signal: AbortSignal.timeout(12000)
      });
      const meta = await metaResponse.json().catch(() => null);
      if (metaResponse.ok && meta?.ok && typeof meta.result?.file_path === 'string') {
        const filePath = String(meta.result.file_path);
        if (!/^[A-Za-z0-9_./-]+$/.test(filePath) || filePath.includes('..')) throw new MediaError('Caminho de arquivo inválido.', 502, 'telegram_file_path_invalid');
        let wholePromise: Promise<Uint8Array> | null = null;
        const read = async (offset: number, limit: number, readSignal: AbortSignal) => {
          const end = Math.min(item.size - 1, offset + limit - 1);
          const url = `https://api.telegram.org/file/bot${token}/${filePath}`;
          const response = await fetch(url, { headers: { Range: `bytes=${offset}-${end}` }, signal: readSignal });
          if (!response.ok || !response.body) throw new MediaError(`Download Telegram falhou (HTTP ${response.status}).`, 502, 'telegram_bot_file_download_failed');
          if (response.status === 206) {
            const bytes = new Uint8Array(await response.arrayBuffer());
            if (bytes.length !== end - offset + 1) throw new MediaError('Trecho Telegram incompleto.', 502, 'telegram_bot_range_incomplete');
            return bytes;
          }
          wholePromise ||= (async () => {
            const fullResponse = await fetch(url, { signal: readSignal });
            if (!fullResponse.ok || !fullResponse.body) throw new MediaError('Download Telegram falhou.', 502, 'telegram_bot_file_download_failed');
            const all = new Uint8Array(await fullResponse.arrayBuffer());
            if (all.length !== item.size) throw new MediaError(`Tamanho Telegram divergente: esperado ${item.size}, recebido ${all.length}.`, 502, 'telegram_bot_file_size_mismatch');
            return all;
          })();
          return (await wholePromise).slice(offset, end + 1);
        };
        if (signal?.aborted) throw new DOMException('Leitura cancelada.', 'AbortError');
        return { read, close: async () => {} };
      }
      console.warn('telegram_bot_get_file_unavailable', {
        status: metaResponse.status, error_code: meta?.error_code ?? null,
        description: String(meta?.description || '').slice(0, 180)
      });
    }
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
