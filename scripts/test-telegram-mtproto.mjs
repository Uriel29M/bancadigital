import test from 'node:test';
import assert from 'node:assert/strict';
import { createMediaHandler, parseRange } from '../supabase/functions/telegram-mtproto/media-core.mjs';
const size = 3 * 1024 * 1024 * 1024 + 123;
const item = { id: 'large', fileId: 'valid_file_id', size, format: 'cbz' };
let reads = [], closes = 0;
const handler = createMediaHandler({
  lookup: async id => id === 'large' ? item : null,
  open: async () => ({ read: async (offset, length) => { reads.push([offset,length]); return new Uint8Array(length).fill(7); }, close: async () => { closes++; } }),
});
const req = (range, method = 'GET', id = 'large') => new Request(`https://example.com/media?item_id=${id}`, { method, headers: range ? {Range:range} : {} });
test('range parser handles large offsets, suffix and invalid intervals', () => {
  assert.deepEqual(parseRange('bytes=3221225472-3221225481', size), {start:3221225472,end:3221225481});
  assert.deepEqual(parseRange('bytes=-10', size), {start:size-10,end:size-1});
  assert.equal(parseRange('bytes=0-1,3-4', size), false);
  assert.equal(parseRange(`bytes=${size}-`, size), false);
});
test('HEAD reports full size without downloading', async () => {
  reads=[]; const r=await handler(req(null,'HEAD')); assert.equal(r.status,200); assert.equal(r.headers.get('content-length'),String(size)); assert.equal(reads.length,0);
});
test('a 3GB+ file is read only in requested small chunks', async () => {
  reads=[]; const start=size-524288; const r=await handler(req(`bytes=${start}-${start+524287}`));
  assert.equal(r.status,206); assert.equal(r.headers.get('content-range'),`bytes ${start}-${start+524287}/${size}`);
  const bytes=new Uint8Array(await r.arrayBuffer()); assert.equal(bytes.length,524288); assert.equal(reads.length,2); assert.ok(reads.every(x=>x[1]<=262144));
});
test('suffix ranges, empty catalog and unsatisfiable ranges', async () => {
  assert.equal((await handler(req('bytes=-10'))).status,206);
  assert.equal((await handler(req(`bytes=${size}-`))).status,416);
  assert.equal((await handler(req(null,'GET','missing'))).status,404);
});
test('a canceled reader releases its source', async () => {
  const r=await handler(req('bytes=0-1048575')); const reader=r.body.getReader(); await reader.read(); const before=closes; await reader.cancel(); assert.equal(closes,before+1);
});
test('upstream errors return a failure before HTTP 200 headers', async () => {
  const broken=createMediaHandler({lookup:async()=>item,open:async()=>({read:async()=>{throw Error('private upstream');},close:async()=>{}})});
  const r=await broken(req('bytes=0-9')); assert.equal(r.status,502); assert.doesNotMatch(await r.text(),/private upstream/);
});
test('unsupported methods and malformed identifiers are rejected', async () => {
  assert.equal((await handler(req(null,'POST'))).status,405);
  assert.equal((await handler(req(null,'GET','../secret'))).status,400);
  assert.equal((await handler(req('bytes=0-1,5-6'))).status,416);
});
