import assert from 'node:assert/strict';
import test from 'node:test';
import { createMediaHandler, parseRange } from '../supabase/functions/telegram-mtproto/media-core.mjs';

const size = 3 * 1024 * 1024 * 1024 + 123;
const item = { id: 'large', fileId: 'valid_file_id', size, format: 'cbz' };
let reads = [];
let closes = 0;
const handler = createMediaHandler({
  lookup: async id => id === 'large' ? item : null,
  open: async () => ({
    read: async (offset, length) => { reads.push([offset, length]); return new Uint8Array(length).fill(7); },
    close: async () => { closes++; },
  }),
});
const request = (range, method = 'GET', id = 'large') => new Request(`https://example.com/media?item_id=${id}`, { method, headers: range ? { Range: range } : {} });

test('range parser handles large offsets, suffix and invalid intervals', () => {
  assert.deepEqual(parseRange('bytes=3221225472-3221225481', size), { start: 3221225472, end: 3221225481 });
  assert.deepEqual(parseRange('bytes=-10', size), { start: size - 10, end: size - 1 });
  assert.equal(parseRange('bytes=0-1,3-4', size), false);
  assert.equal(parseRange(`bytes=${size}-`, size), false);
});

test('HEAD reports a large file without downloading', async () => {
  reads = [];
  const response = await handler(request(null, 'HEAD'));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-length'), String(size));
  assert.equal(reads.length, 0);
});

test('large ranges are streamed in bounded chunks', async () => {
  reads = [];
  const start = size - 524288;
  const response = await handler(request(`bytes=${start}-${start + 524287}`));
  assert.equal(response.status, 206);
  assert.equal(response.headers.get('content-range'), `bytes ${start}-${start + 524287}/${size}`);
  assert.equal((await response.arrayBuffer()).byteLength, 524288);
  assert.ok(reads.every(([, length]) => length <= 262144));
});

test('invalid and missing editions are rejected', async () => {
  assert.equal((await handler(request(`bytes=${size}-`))).status, 416);
  assert.equal((await handler(request(null, 'GET', 'missing'))).status, 404);
  assert.equal((await handler(request(null, 'POST'))).status, 405);
});

test('canceling a response releases its source', async () => {
  const response = await handler(request('bytes=0-1048575'));
  const reader = response.body.getReader();
  await reader.read();
  const before = closes;
  await reader.cancel();
  assert.equal(closes, before + 1);
});