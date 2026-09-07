import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const source = readFileSync('js/telegram-covers.js', 'utf8');
function load(client) {
  const window = { BANCA_SUPABASE_URL: 'https://example.supabase.co', BancaTelegram: { normalized(value) {
    try {
      const url = new URL(value);
      if (url.protocol !== 'https:' || !['t.me', 'telegram.me', 'www.t.me', 'www.telegram.me'].includes(url.hostname) || url.username || url.password || url.port) return '';
      const parts = url.pathname.split('/').filter(Boolean);
      if (parts.length === 2 && /^[A-Za-z][A-Za-z0-9_]{3,31}$/.test(parts[0]) && /^[1-9]\d*$/.test(parts[1])) return `https://t.me/${parts[0].toLowerCase()}/${parts[1]}`;
      if (parts.length === 3 && parts[0] === 'c' && /^\d+$/.test(parts[1]) && /^[1-9]\d*$/.test(parts[2])) return `https://t.me/c/${parts[1]}/${parts[2]}`;
    } catch {}
    return '';
  } } };
  vm.runInNewContext(source, { window, URL, Map, Error, String, Number });
  return window.BancaTelegramCovers;
}
const metadata = { sourceUrl: 'https://t.me/bancahq/3', url: 'https://example.supabase.co/functions/v1/telegram-cover?url=https%3A%2F%2Ft.me%2Fbancahq%2F3', mimeType: 'image/jpeg', fileSize: 125000 };
const client = { functions: { invoke: async (name, args) => { assert.equal(name, 'telegram-cover'); assert.equal(args.body.url, metadata.sourceUrl); return { data: metadata, error: null }; } } };
function control(value = '') { const handlers = new Map(); return { value, disabled: false, textContent: '', addEventListener(name, fn) { handlers.set(name, fn); }, fire(name) { handlers.get(name)?.(); } }; }
function form() {
  const coverUrl = control(metadata.sourceUrl), featuredCoverUrl = control(''), status = control(), button = control();
  return { elements: { coverUrl, featuredCoverUrl }, coverUrl, featuredCoverUrl, status, button, querySelector(selector) { return selector === '[data-telegram-cover-status="coverUrl"]' ? status : selector === '[data-resolve-telegram-cover="coverUrl"]' ? button : null; } };
}
test('post links become stable image gateway URLs, never raw HTML pages', () => {
  const api = load();
  assert.equal(new URL(api.publicUrl('https://t.me/BancaHQ/3?single')).searchParams.get('url'), metadata.sourceUrl);
  assert.equal(api.publicUrl('https://example.org/cover.jpg'), 'https://example.org/cover.jpg');
  assert.equal(api.isPost('https://evil.example/t.me/bancahq/3'), false);
  assert.equal(api.isPost('https://t.me/bancahq'), false);
});
test('both cover fields register before publication without changing unrelated edition data', async () => {
  const api = load(), ui = form(), editor = api.bindEditor(ui, client);
  const original = { id: 'edition-5', title: 'All Star Western', issue: '5', coverUrl: metadata.sourceUrl, featuredCoverUrl: '', fileUrl: 'https://example.org/book.pdf' };
  const result = await editor.forSave(original, { coverUrl: metadata.sourceUrl, featuredCoverUrl: '' });
  assert.equal(result.coverUrl, metadata.sourceUrl);
  assert.equal(result.title, original.title);
  assert.equal(result.fileUrl, original.fileUrl);
  assert.equal(original.coverUrl, metadata.sourceUrl);
  assert.match(ui.status.textContent, /Imagem identificada/);
});
test('invalid or unavailable image blocks publication instead of saving a broken cover', async () => {
  const failing = { functions: { invoke: async () => ({ data: { error: 'A postagem não contém uma imagem.' }, error: null }) } };
  const api = load(), ui = form();
  await assert.rejects(api.bindEditor(ui, failing).forSave({ id: 'x' }, { coverUrl: metadata.sourceUrl }), /não contém uma imagem/);
});
test('editing the URL during an in-flight request rejects stale metadata', async () => {
  let complete;
  const delayed = { functions: { invoke: () => new Promise(resolve => { complete = resolve; }) } };
  const api = load(), ui = form(), editor = api.bindEditor(ui, delayed);
  const pending = editor.forSave({ id: 'x' }, { coverUrl: metadata.sourceUrl });
  ui.coverUrl.value = 'https://t.me/bancahq/4';
  ui.coverUrl.fire('input');
  complete({ data: metadata, error: null });
  await assert.rejects(pending, /mudou durante a identificação/);
});
test('normal image links remain unchanged and need no Telegram request', async () => {
  const api = load(), ui = form(), editor = api.bindEditor(ui, client);
  const original = { id: 'x', coverUrl: 'https://example.org/cover.png' };
  const result = await editor.forSave(original, { coverUrl: original.coverUrl });
  assert.equal(result.coverUrl, original.coverUrl);
});
