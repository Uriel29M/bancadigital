export class SourceError extends Error {
  constructor(message, status = 502, code = 'source_error') {
    super(message); this.status = status; this.code = code;
  }
}
export function parsePost(value) {
  let url;
  try { url = new URL(String(value || '')); } catch { throw new SourceError('Postagem inválida.', 422); }
  if (url.protocol !== 'https:' || !['t.me', 'telegram.me', 'www.t.me', 'www.telegram.me'].includes(url.hostname) || url.username || url.password || url.port) throw new SourceError('Postagem inválida.', 422);
  const p = url.pathname.split('/').filter(Boolean);
  let chat, id;
  if (p.length === 3 && p[0] === 'c' && /^[1-9]\d{0,14}$/.test(p[1])) { chat = `-100${p[1]}`; id = p[2]; }
  else if (p.length === 2 && /^[A-Za-z][A-Za-z0-9_]{3,31}$/.test(p[0])) { chat = `@${p[0].toLowerCase()}`; id = p[1]; }
  else throw new SourceError('Postagem inválida.', 422);
  if (!/^[1-9]\d{0,11}$/.test(id) || !Number.isSafeInteger(Number(id))) throw new SourceError('Mensagem inválida.', 422);
  return { chat, messageId: Number(id) };
}
export function rpcCode(error) {
  const text = String(error?.text || error?.errorMessage || '');
  return /^[A-Z][A-Z0-9_]{2,100}$/.test(text) ? text : '';
}
export function migrationDc(error) {
  const match = /^FILE_MIGRATE_(\d+)$/.exec(rpcCode(error));
  return match ? Number(match[1]) : 0;
}
export function isExpiredReference(error) {
  return /^FILE_REFERENCE_(EXPIRED|INVALID|EMPTY)$/.test(rpcCode(error));
}
export function safeError(error, stage) {
  if (error instanceof SourceError) return error;
  const name = String(error?.name || 'Error').replace(/[^A-Za-z0-9_]/g, '').slice(0, 40);
  return new SourceError('Não foi possível acessar o arquivo pelo MTProto.', 502, `mtproto_${stage}_${rpcCode(error) || name}`);
}
export async function resolveDocument(client, item, allowed, Long) {
  const post = parsePost(item.telegramUrl);
  let channel, channelId;
  if (post.chat.startsWith('-100')) {
    channelId = post.chat;
    if (!allowed.has(channelId)) throw new SourceError('Canal não autorizado.', 403, 'channel_not_allowed');
    const result = await client.call({ _: 'channels.getChannels', id: [{ _: 'inputChannel', channelId: Long.fromString(channelId.slice(4)), accessHash: Long.ZERO }] });
    channel = result.chats?.find(c => c._ === 'channel' && String(c.id) === channelId.slice(4));
  } else {
    const result = await client.call({ _: 'contacts.resolveUsername', username: post.chat.slice(1) });
    channel = result.chats?.find(c => c._ === 'channel' && String(c.username || '').toLowerCase() === post.chat.slice(1));
    channelId = channel ? `-100${channel.id}` : '';
  }
  if (!channel || !channel.accessHash) throw new SourceError('Canal não encontrado ou inacessível ao bot.', 404, 'channel_not_found');
  if (!allowed.has(channelId)) throw new SourceError('Canal não autorizado.', 403, 'channel_not_allowed');
  const result = await client.call({ _: 'channels.getMessages', channel: { _: 'inputChannel', channelId: channel.id, accessHash: channel.accessHash }, id: [{ _: 'inputMessageID', id: post.messageId }] });
  const message = result.messages?.find(m => m._ === 'message' && m.id === post.messageId);
  const document = message?.media?._ === 'messageMediaDocument' ? message.media.document : null;
  if (!document || document._ !== 'document' || Number(document.size) !== item.size) throw new SourceError('O documento original não corresponde ao catálogo.', 422, 'document_mismatch');
  const name = document.attributes?.find(a => a._ === 'documentAttributeFilename')?.fileName;
  if (!String(name || '').toLowerCase().endsWith(`.${item.format}`)) throw new SourceError('O formato do documento não corresponde ao catálogo.', 422, 'document_format_mismatch');
  if (!Number.isInteger(document.dcId) || document.dcId < 1 || document.dcId > 100) throw new SourceError('Centro de dados inválido.', 502, 'invalid_dc');
  return { location: { _: 'inputDocumentFileLocation', id: document.id, accessHash: document.accessHash, fileReference: document.fileReference, thumbSize: '' }, dcId: document.dcId };
}
export async function readAligned(read, offset, length, size, signal) {
  if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(length) || offset < 0 || length < 1 || offset + length > size || length > 1048576) throw new SourceError('Intervalo inválido.', 416, 'invalid_range');
  const start = Math.floor(offset / 4096) * 4096;
  const skip = offset - start;
  const limit = Math.ceil((skip + length) / 4096) * 4096;
  if (signal?.aborted) throw new DOMException('Cancelado', 'AbortError');
  const bytes = await read(start, limit, signal);
  if (!(bytes instanceof Uint8Array) || bytes.length < skip + length) throw new SourceError('O Telegram retornou um trecho incompleto.', 502, 'incomplete_chunk');
  return bytes.slice(skip, skip + length);
}
