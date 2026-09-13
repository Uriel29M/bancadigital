import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeCatalog, sourcesFor, checkSource, inspectEdition } from '../supabase/functions/link-checker-bot/checks.mjs';

const item = { id: 'test', fileUrl: 'https://files.test/main.cbz', backupUrls: ['https://files.test/backup.cbz'] };
const result = state => ({ state, reason: state });

test('promotes a working backup only after confirming the primary failure', async () => {
  const calls = [];
  const decision = await inspectEdition(item, async url => { calls.push(url); return result(url === item.fileUrl ? 'broken' : 'working'); });
  assert.equal(decision.action, 'swap');
  assert.equal(decision.fallbackUrl, item.backupUrls[0]);
  assert.deepEqual(calls, [item.fileUrl, item.fileUrl, item.backupUrls[0]]);
});

test('hides only when every source is confirmed broken', async () => {
  assert.equal((await inspectEdition(item, async () => result('broken'))).action, 'hide');
  assert.equal((await inspectEdition(item, async url => result(url === item.fileUrl ? 'broken' : 'unknown'))).action, 'none');
  assert.equal((await inspectEdition({ id: 'missing' }, async () => { throw Error('unexpected probe'); })).action, 'hide');
});

test('healthy primary, recovered primary and transient failures stay unchanged', async () => {
  let count = 0;
  assert.equal((await inspectEdition(item, async () => { count++; return result('working'); })).action, 'none');
  assert.equal(count, 1);
  count = 0;
  assert.equal((await inspectEdition(item, async () => result(++count === 1 ? 'broken' : 'working'))).action, 'none');
  assert.equal((await inspectEdition(item, async () => result('unknown'))).action, 'none');
});

test('published overrides replace cleared sources and exclude deleted editions', () => {
  const merged = mergeCatalog([item, { id: 'deleted', fileUrl: 'old' }], [
    { item_id: 'test', edition: { id: 'test', fileUrl: 'new' }, updated_at: 'version' },
    { item_id: 'deleted', edition: { id: 'deleted', catalogDeleted: true } },
    { item_id: 'added', edition: { id: 'added', fileUrl: 'added' } },
  ]);
  assert.equal(merged.length, 2);
  assert.equal(merged[0].updatedAt, 'version');
  assert.equal(merged[0].item.backupUrls, undefined);
  assert.deepEqual(sourcesFor(merged[0].item), ['new']);
});

test('checks the actual archive through the provider proxy with a bounded range', async () => {
  const url = 'https://mega.nz/file/id#key';
  const checked = await checkSource(url, item, 'https://banca.test', async (target, options) => {
    assert.equal(target, `https://banca.test/functions/v1/mega-proxy?url=${encodeURIComponent(url)}`);
    assert.equal(options.headers.Range, 'bytes=0-8191');
    return new Response(new Uint8Array([0x50, 0x4b, 3, 4]), { status: 206 });
  });
  assert.equal(checked.state, 'working');
});

test('expired and missing links differ from throttling, HTML landing pages and outages', async () => {
  for (const status of [404, 410]) assert.equal((await checkSource(item.fileUrl, item, '', async () => new Response('', { status }))).state, 'broken');
  for (const status of [401, 403, 429, 500, 502, 503]) assert.equal((await checkSource(item.fileUrl, item, '', async () => new Response('', { status }))).state, 'unknown');
  assert.equal((await checkSource(item.fileUrl, item, '', async () => new Response('<html>Download</html>'))).state, 'unknown');
  assert.equal((await checkSource(item.fileUrl, item, '', async () => new Response('File has been deleted'))).state, 'broken');
  assert.equal((await checkSource(item.fileUrl, item, '', async () => { throw Error('timeout'); })).state, 'unknown');
});

test('Telegram metadata takes precedence over stale fileUrl and unresolved posts are not treated as files', async () => {
  const telegram = { ...item, telegramUrl: 'https://t.me/channel/12', telegramFileId: 'id' };
  assert.equal(sourcesFor(telegram)[0], telegram.telegramUrl);
  const checked = await checkSource(telegram.telegramUrl, { ...telegram, telegramFileId: '' }, '', async () => { throw Error('should not fetch the HTML landing page'); });
  assert.equal(checked.state, 'unknown');
});
