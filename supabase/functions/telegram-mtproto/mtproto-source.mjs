export class SourceError extends Error {
  constructor(message, status = 502, code = "source_error") { super(message); this.status = status; this.code = code; }
}
export function parsePost(value) {
  let url;
  try { url = new URL(String(value || "")); } catch { throw new SourceError("Postagem inválida.", 422); }
  if (url.protocol !== "https:" || !["t.me","telegram.me","www.t.me","www.telegram.me"].includes(url.hostname) || url.username || url.password || url.port) throw new SourceError("Postagem inválida.", 422);
  const p = url.pathname.split("/").filter(Boolean);
  let chat, id;
  if (p.length === 3 && p[0] === "c" && /^[1-9]\d{0,14}$/.test(p[1])) { chat = `-100${p[1]}`; id = p[2]; }
  else if (p.length === 2 && /^[A-Za-z][A-Za-z0-9_]{3,31}$/.test(p[0])) { chat = `@${p[0].toLowerCase()}`; id = p[1]; }
  else throw new SourceError("Postagem inválida.", 422);
  if (!/^[1-9]\d{0,11}$/.test(id) || !Number.isSafeInteger(Number(id))) throw new SourceError("Mensagem inválida.", 422);
  return { chat, messageId: Number(id) };
}
export function rpcCode(error) {
  const text = String(error?.text || error?.errorMessage || error?.message || "");
  const match = /(?:^|\b)(FLOOD_WAIT_\d+|FILE_MIGRATE_\d+|FILE_REFERENCE_(?:EXPIRED|INVALID|EMPTY)|[A-Z][A-Z0-9_]{2,100})(?:$|\b)/.exec(text);
  return match ? match[1] : "";
}
export function migrationDc(error) { const m = /^FILE_MIGRATE_(\d+)$/.exec(rpcCode(error)); return m ? Number(m[1]) : 0; }
export function isExpiredReference(error) { return /^FILE_REFERENCE_(EXPIRED|INVALID|EMPTY)$/.test(rpcCode(error)); }
export async function resolveDocument(client, item, allowed, Long) {
  const post = parsePost(item.telegramUrl);
  let channel, channelId;
  if (post.chat.startsWith("-100")) {
    channelId = post.chat;
    const result = await client.call({ _: "channels.getChannels", id: [{ _: "inputChannel", channelId: Long.fromString(channelId.slice(4)), accessHash: Long.ZERO }] });
    channel = result.chats?.find(c => c._ === "channel" && String(c.id) === channelId.slice(4));
  } else {
    const result = await client.call({ _: "contacts.resolveUsername", username: post.chat.slice(1) });
    channel = result.chats?.find(c => c._ === "channel" && String(c.username || "").toLowerCase() === post.chat.slice(1));
    channelId = channel ? `-100${channel.id}` : "";
  }
  if (!channel || !channel.accessHash) throw new SourceError("Canal não encontrado.", 404, "channel_not_found");
  if (!allowed.has(channelId)) throw new SourceError("Canal não autorizado.", 403, "channel_not_allowed");
  const result = await client.call({ _: "channels.getMessages", channel: { _: "inputChannel", channelId: channel.id, accessHash: channel.accessHash }, id: [{ _: "inputMessageID", id: post.messageId }] });
  const message = result.messages?.find(m => m._ === "message" && m.id === post.messageId);
  const document = message?.media?._ === "messageMediaDocument" ? message.media.document : null;
  if (!document || document._ !== "document" || Number(document.size) !== item.size) throw new SourceError("Documento divergente.", 422, "document_mismatch");
  const name = document.attributes?.find(a => a._ === "documentAttributeFilename")?.fileName;
  if (!String(name || "").toLowerCase().endsWith(`.${item.format}`)) throw new SourceError("Formato divergente.", 422, "document_format_mismatch");
  return { location: { _: "inputDocumentFileLocation", id: document.id, accessHash: document.accessHash, fileReference: document.fileReference, thumbSize: "" }, dcId: document.dcId };
}
export async function readAligned(read, offset, length, size, signal) {
  const start = Math.floor(offset / 4096) * 4096;
  const skip = offset - start;
  const limit = Math.ceil((skip + length) / 4096) * 4096;
  const parts = []; let received = 0;
  while (received < limit) {
    if (signal?.aborted) throw new DOMException("Cancelado", "AbortError");
    const part = await read(start + received, Math.min(262144, limit - received), signal);
    if (!(part instanceof Uint8Array) || !part.length) throw new SourceError("Trecho incompleto.", 502, "incomplete_chunk");
    parts.push(part); received += part.length;
    if (part.length % 4096 !== 0) break;
  }
  if (received < skip + length) throw new SourceError("Trecho incompleto.", 502, "incomplete_chunk");
  const bytes = new Uint8Array(received); let position = 0;
  for (const part of parts) { bytes.set(part, position); position += part.length; }
  return bytes.slice(skip, skip + length);
}
