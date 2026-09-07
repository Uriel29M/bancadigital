import { createClient } from 'npm:@supabase/supabase-js@2.57.0';

const MAX_BYTES = 10 * 1024 * 1024;
const DEFAULT_CHANNEL = '-1004424843914';
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, x-client-info, content-type',
  'Access-Control-Allow-Methods': 'GET, HEAD, POST, OPTIONS',
  'Access-Control-Expose-Headers': 'Content-Length, Content-Type',
  'X-Content-Type-Options': 'nosniff',
};
class CoverError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}
function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
}
export function parsePost(value: unknown) {
  let url: URL;
  try { url = new URL(String(value || '').trim()); } catch { throw new CoverError('Cole o link completo da imagem no Telegram.'); }
  if (url.protocol !== 'https:' || !['t.me', 'telegram.me', 'www.t.me', 'www.telegram.me'].includes(url.hostname) || url.username || url.password || url.port) throw new CoverError('Use um link HTTPS de postagem do Telegram.');
  const parts = url.pathname.split('/').filter(Boolean);
  let chat: string, message: string;
  if (parts[0] === 'c' && parts.length === 3 && /^[1-9]\d{0,14}$/.test(parts[1])) { chat = `-100${parts[1]}`; message = parts[2]; }
  else if (parts.length === 2 && /^[A-Za-z][A-Za-z0-9_]{3,31}$/.test(parts[0])) { chat = `@${parts[0]}`; message = parts[1]; }
  else throw new CoverError('Informe o link de uma mensagem, como https://t.me/bancahq/2.');
  if (!/^[1-9]\d{0,11}$/.test(message) || !Number.isSafeInteger(Number(message))) throw new CoverError('Número da mensagem inválido.');
  return { chat, messageId: Number(message) };
}
export function selectImage(message: Record<string, any>) {
  const photo = Array.isArray(message.photo) ? message.photo.filter(p => p?.file_id && Number(p.file_size || 0) <= MAX_BYTES).sort((a, b) => (Number(b.width || 0) * Number(b.height || 0)) - (Number(a.width || 0) * Number(a.height || 0)))[0] : null;
  if (photo) return { fileId: photo.file_id, uniqueId: photo.file_unique_id || '', mime: 'image/jpeg', size: Number(photo.file_size || 0) };
  const document = message.document;
  if (!document?.file_id) throw new CoverError('A postagem não contém uma fotografia ou imagem compatível.', 422);
  const mime = String(document.mime_type || '').toLowerCase();
  const ext = String(document.file_name || '').match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase();
  const types: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
  const type = types[ext || ''] || (['image/jpeg', 'image/png', 'image/webp'].includes(mime) ? mime : '');
  if (!type || (mime.startsWith('image/') && mime !== type)) throw new CoverError('Use uma imagem JPG, PNG ou WebP. Outros formatos não são aceitos como capa.', 422);
  const size = Number(document.file_size || 0);
  if (size > MAX_BYTES) throw new CoverError('A imagem excede o limite de 10 MB para capas.', 413);
  return { fileId: document.file_id, uniqueId: document.file_unique_id || '', mime: type, size };
}
export async function resolveCover(rawUrl: unknown, deps: { api: (method: string, body?: Record<string, unknown>) => Promise<any>; allowed: Set<string>; stagingChat?: string }) {
  const post = parsePost(rawUrl);
  const chat = await deps.api('getChat', { chat_id: post.chat });
  if (!deps.allowed.has(String(chat.id))) throw new CoverError('Esse canal não está autorizado para a Banca Digital.', 403);
  const bot = await deps.api('getMe');
  const member = await deps.api('getChatMember', { chat_id: chat.id, user_id: bot.id });
  if (!['administrator', 'creator'].includes(member.status)) throw new CoverError('O bot precisa ser administrador do canal.', 403);
  if (chat.type === 'channel' && member.can_post_messages === false) throw new CoverError('O bot precisa da permissão de publicar mensagens.', 403);
  const destination = deps.stagingChat || String(chat.id);
  if (destination === String(chat.id) && member.can_delete_messages === false) throw new CoverError('O bot precisa da permissão de apagar mensagens temporárias.', 403);
  let temporaryId: number | null = null;
  let result: any = null;
  let failure: unknown = null;
  try {
    const forwarded = await deps.api('forwardMessage', { chat_id: destination, from_chat_id: chat.id, message_id: post.messageId, disable_notification: true });
    temporaryId = forwarded.message_id;
    const image = selectImage(forwarded);
    result = { sourceUrl: `https://t.me/${chat.username || `c/${String(chat.id).replace(/^-100/, '')}`}/${post.messageId}`, chatId: String(chat.id), messageId: post.messageId, ...image };
  } catch (error) { failure = error; }
  if (temporaryId !== null) {
    let removed = false;
    for (let attempt = 0; attempt < 2 && !removed; attempt++) {
      try { await deps.api('deleteMessage', { chat_id: destination, message_id: temporaryId }); removed = true; }
      catch (error) { console.error('Telegram: falha ao apagar mensagem temporária', error); }
    }
    if (!removed) throw new CoverError('Não foi possível remover a mensagem temporária. Verifique as permissões do bot.', 502);
  }
  if (failure) throw failure;
  return result;
}
async function telegramApi(token: string, method: string, body: Record<string, unknown> = {}) {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(25000) });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.ok) {
    const description = String(data?.description || 'O Telegram não respondeu.');
    if (/message to forward not found|message_id_invalid/i.test(description)) throw new CoverError('A postagem não foi encontrada ou não está acessível ao bot.', 404);
    if (/protected|forwarding.*restricted/i.test(description)) throw new CoverError('O canal impede o encaminhamento dessa imagem.', 422);
    throw new CoverError(`Telegram: ${description}`, response.status === 429 ? 429 : 502);
  }
  return data.result;
}
function validateImage(bytes: Uint8Array, mime: string) {
  const jpg = bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  const png = bytes.length >= 8 && [137,80,78,71,13,10,26,10].every((v,i) => bytes[i] === v);
  const webp = bytes.length >= 12 && String.fromCharCode(...bytes.slice(0,4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8,12)) === 'WEBP';
  return (mime === 'image/jpeg' && jpg) || (mime === 'image/png' && png) || (mime === 'image/webp' && webp);
}
function database() {
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!key) throw new CoverError('O serviço de capas não está configurado.', 503);
  return createClient(Deno.env.get('SUPABASE_URL')!, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
function botToken() {
  const token = Deno.env.get('TELEGRAM_BOT_TOKEN')?.trim();
  if (!token) throw new CoverError('O token do bot não está configurado.', 503);
  return token;
}
async function authorizedAdmin(request: Request) {
  const jwt = request.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!jwt) throw new CoverError('Entre como administrador para identificar capas.', 401);
  const client = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: `Bearer ${jwt}` } }, auth: { persistSession: false, autoRefreshToken: false } });
  const { data: { user }, error } = await client.auth.getUser(jwt);
  if (error || !user) throw new CoverError('Sessão inválida ou expirada.', 401);
  const { data: profile, error: profileError } = await client.from('profiles').select('plan').eq('id', user.id).single();
  if (profileError || profile?.plan !== 'admin') throw new CoverError('Somente administradores podem identificar capas.', 403);
  return user.id;
}
async function serveImage(request: Request, rawUrl: string) {
  const post = parsePost(rawUrl);
  const source = new URL(rawUrl);
  const canonical = `https://t.me/${source.pathname.split('/').filter(Boolean).join('/')}`;
  const db = database();
  const { data: record, error } = await db.from('telegram_cover_sources').select('*').eq('source_url', canonical).maybeSingle();
  if (error) throw new CoverError('Não foi possível consultar a capa.', 502);
  if (!record || !record.file_id) throw new CoverError('Esta imagem ainda não foi identificada. Salve a capa no painel de administração.', 404);
  if (!['image/jpeg','image/png','image/webp'].includes(record.mime_type) || record.file_size > MAX_BYTES) throw new CoverError('Tipo ou tamanho de imagem inválido.', 422);
  const token = botToken();
  const file = await telegramApi(token, 'getFile', { file_id: record.file_id });
  if (!/^[A-Za-z0-9_./-]+$/.test(String(file.file_path || '')) || String(file.file_path).includes('..')) throw new CoverError('Caminho de arquivo inválido.', 502);
  if (Number(file.file_size || 0) > MAX_BYTES) throw new CoverError('A imagem excede o limite de 10 MB.', 413);
  const upstream = await fetch(`https://api.telegram.org/file/bot${token}/${file.file_path}`, { signal: AbortSignal.timeout(45000) });
  if (!upstream.ok || !upstream.body) throw new CoverError('O Telegram não conseguiu entregar a imagem.', 502);
  const reader = upstream.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_BYTES) { await reader.cancel(); throw new CoverError('A imagem excede o limite de 10 MB.', 413); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  if (!validateImage(bytes, record.mime_type)) throw new CoverError('O arquivo retornado não corresponde a uma imagem válida.', 502);
  return new Response(request.method === 'HEAD' ? null : bytes, { status: 200, headers: { ...cors, 'Content-Type': record.mime_type, 'Content-Length': String(total), 'Cache-Control': 'public, max-age=3600, s-maxage=3600', 'Cross-Origin-Resource-Policy': 'cross-origin' } });
}
Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  try {
    if (request.method === 'GET' || request.method === 'HEAD') {
      const source = new URL(request.url).searchParams.get('url') || '';
      if (!source) throw new CoverError('Informe uma postagem de imagem.', 400);
      return await serveImage(request, source);
    }
    if (request.method !== 'POST') return json({ error: 'Método não permitido.' }, 405);
    const userId = await authorizedAdmin(request);
    const body = await request.json().catch(() => ({}));
    const allowed = new Set([DEFAULT_CHANNEL, ...(Deno.env.get('TELEGRAM_ALLOWED_CHAT_IDS') || '').split(',').map(s => s.trim()).filter(Boolean)]);
    const image = await resolveCover(body.url, { api: (method, params) => telegramApi(botToken(), method, params), allowed, stagingChat: Deno.env.get('TELEGRAM_RESOLVER_CHAT_ID')?.trim() || undefined });
    const db = database();
    const { error } = await db.from('telegram_cover_sources').upsert({ source_url: image.sourceUrl, chat_id: image.chatId, message_id: image.messageId, file_id: image.fileId, file_unique_id: image.uniqueId, mime_type: image.mime, file_size: image.size, updated_by: userId, updated_at: new Date().toISOString() }, { onConflict: 'source_url' });
    if (error) throw new CoverError('Não foi possível registrar a capa no catálogo.', 502);
    const publicUrl = new URL(`${Deno.env.get('SUPABASE_URL')}/functions/v1/telegram-cover`);
    publicUrl.searchParams.set('url', image.sourceUrl);
    return json({ sourceUrl: image.sourceUrl, url: publicUrl.toString(), mimeType: image.mime, fileSize: image.size });
  } catch (error) {
    if (!(error instanceof CoverError) || error.status >= 500) console.error('telegram-cover', error);
    return json({ error: error instanceof Error ? error.message : 'Falha ao acessar o Telegram.' }, error instanceof CoverError ? error.status : 502);
  }
});
