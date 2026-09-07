import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

function load(rows = new Map()) {
  const window = { BANCA_SUPABASE_URL: 'https://example.supabase.co', BancaCatalogSync: { rows } };
  vm.runInNewContext(readFileSync('js/telegram-auto.js', 'utf8'), { window, URL, Set, String, Number, Error });
  return window.BancaTelegram;
}
const metadata = { telegramUrl: 'https://t.me/bancahq/2', telegramFileId: 'BQACAgEAAyEFAAMBB73CigADAmqfMmcBSaket8QEOHTNeXjRui-BAALoCgACuBIhRBwRKTsYIBKZPQQ', telegramFileName: 'Casulo Metamorfose.pdf', telegramFileSize: 19983904, format: 'pdf' };
const client = { functions: { invoke: async () => ({ data: metadata, error: null }) } };
function control(value = '') {
  const events = new Map();
  return { value, disabled: false, textContent: '', addEventListener(type, fn) { events.set(type, fn); }, fire(type) { events.get(type)?.(); } };
}
function form(initial = '') {
  const source = control(initial), format = control('auto'), id = control(''), status = control(), button = control(), preview = control();
  const elements = { sourceUrl: source, format, telegramFileId: id };
  return { elements, source, format, id, status, button, querySelector(selector) { return ({ '[data-telegram-status]': status, '[data-resolve-telegram]': button, '[data-format-preview]': preview })[selector] || null; } };
}
test('normalizes supported posts and rejects unrelated URLs', () => {
  const api = load();
  assert.equal(api.normalized('https://t.me/BancaHQ/2?single'), 'https://t.me/bancahq/2');
  assert.equal(api.normalized('https://t.me/c/12345/6'), 'https://t.me/c/12345/6');
  assert.equal(api.normalized('https://evil.example/t.me/bancahq/2'), '');
  assert.equal(api.normalized('https://t.me/bancahq'), '');
});
test('identifies the document automatically and retains unrelated edition metadata', async () => {
  const api = load(), ui = form(metadata.telegramUrl);
  const editor = api.bindEditor(ui, client);
  const original = { id: 'edition-5', title: 'All Star Western', coverUrl: 'cover.jpg', issue: '5', fileUrl: '', telegramUrl: metadata.telegramUrl };
  const result = await editor.forSave(original, metadata.telegramUrl);
  assert.equal(result.telegramFileId, metadata.telegramFileId);
  assert.equal(result.format, 'pdf');
  assert.equal(result.title, original.title);
  assert.equal(result.coverUrl, original.coverUrl);
  assert.equal(result.telegramFileSize, 19983904);
  assert.equal(ui.format.value, 'pdf');
  assert.equal(ui.id.value, metadata.telegramFileId);
  assert.equal(original.telegramFileId, undefined);
});
test('a failed identification cannot publish a stale file ID', async () => {
  const failingClient = { functions: { invoke: async () => ({ data: { error: 'Postagem não encontrada.' }, error: null }) } };
  const api = load(), ui = form(metadata.telegramUrl);
  const editor = api.bindEditor(ui, failingClient);
  await assert.rejects(editor.forSave({ id: 'edition-5', telegramFileId: 'old' }, metadata.telegramUrl), /Postagem não encontrada/);
  assert.equal(ui.id.value, '');
});
test('changing the source invalidates pending identification', async () => {
  let complete;
  const delayedClient = { functions: { invoke: () => new Promise(resolve => { complete = resolve; }) } };
  const api = load(), ui = form(metadata.telegramUrl), editor = api.bindEditor(ui, delayedClient);
  const pending = editor.forSave({ id: 'edition-5' }, metadata.telegramUrl);
  ui.source.value = 'https://t.me/bancahq/3';
  ui.source.fire('input');
  complete({ data: metadata, error: null });
  await assert.rejects(pending, /mudou durante a identificação/);
  assert.equal(ui.id.value, '');
});
test('reader uses the canonical shared identifier rather than stale local metadata', async () => {
  const row = { item_id: 'edition-5', edition: { id: 'edition-5', ...metadata }, updated_at: '2026-09-07T22:05:24Z' };
  const rows = new Map(), api = load(rows);
  const db = { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: row, error: null }) }) }) }) };
  const item = await api.published({ id: 'edition-5', telegramUrl: metadata.telegramUrl, telegramFileId: 'stale', format: 'auto', title: 'All Star Western' }, db);
  assert.equal(item.telegramFileId, metadata.telegramFileId);
  assert.equal(item.title, 'All Star Western');
  const url = new URL(api.proxyUrl(item));
  assert.equal(url.searchParams.get('item_id'), 'edition-5');
  assert.equal(url.searchParams.has('file_id'), false);
});
test('existing direct file IDs remain compatible without a shared record', () => {
  const api = load();
  const url = new URL(api.proxyUrl({ id: 'legacy', ...metadata }));
  assert.equal(url.searchParams.get('file_id'), metadata.telegramFileId);
});
