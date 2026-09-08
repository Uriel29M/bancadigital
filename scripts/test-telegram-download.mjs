import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
const source = readFileSync('js/app.js', 'utf8');
const start = source.indexOf('  async function fetchTelegramTemporaryBuffer(');
const end = source.indexOf('  async function fetchFileArrayBuffer(', start);
const MB = 1024 * 1024;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
function load(fetch) {
  const context = vm.createContext({ fetch, AbortController, DOMException, Uint8Array,
    setTimeout: (fn, ms) => setTimeout(fn, Math.min(ms, 5)), clearTimeout });
  vm.runInContext(source.slice(start, end), context);
  return context.fetchTelegramTemporaryBuffer;
}
function range(options) { return options.headers.Range.match(/bytes=(\d+)-(\d+)/).slice(1).map(Number); }
function reply(start, end, size, data = null) {
  end = Math.min(end, size - 1);
  return new Response(data ?? new Uint8Array(end - start + 1).fill(start / MB), {
    status: 206, headers: { 'content-range': `bytes ${start}-${end}/${size}` },
  });
}
test('three concurrent blocks reconstruct exact bytes despite out-of-order completion', async () => {
  const size = 5 * MB + 123, progress = [], finished = [];
  let active = 0, peak = 0, completed = 0;
  const download = load(async (_, options) => {
    const [start, end] = range(options);
    active++; peak = Math.max(peak, active);
    await delay(start === MB ? 25 : 2);
    active--; finished.push(start);
    return reply(start, end, size);
  });
  const bytes = new Uint8Array(await download('https://example.com', n => progress.push(n), () => completed++));
  assert.equal(peak, 3);
  assert.ok(finished.indexOf(2 * MB) < finished.indexOf(MB));
  assert.equal(bytes.length, size);
  for (let i = 0; i < size; i++) assert.equal(bytes[i], Math.floor(i / MB));
  assert.ok(progress.every((n, i) => !i || n > progress[i - 1]));
  assert.equal(progress.at(-1), size);
  assert.equal(completed, 1);
});
test('small file uses one request', async () => {
  let calls = 0;
  const download = load(async (_, options) => { calls++; return reply(...range(options), 10); });
  assert.equal((await download('https://example.com')).byteLength, 10);
  assert.equal(calls, 1);
});
test('retries truncated blocks without double-counting progress', async () => {
  let calls = 0;
  const progress = [];
  const download = load(async (_, options) => {
    calls++;
    return reply(...range(options), 100, calls === 1 ? new Uint8Array(3) : null);
  });
  assert.equal((await download('https://example.com', n => progress.push(n))).byteLength, 100);
  assert.equal(calls, 2);
  assert.deepEqual(progress, [100]);
});
test('rejects changed size and cancels outstanding work', async () => {
  let completed = false;
  const download = load(async (_, options) => {
    const [start, end] = range(options);
    return reply(start, end, start ? 3 * MB + 1 : 3 * MB);
  });
  await assert.rejects(download('https://example.com', undefined, () => completed = true), /tamanho.*mudou/);
  assert.equal(completed, false);
});
test('aborting cancels all in-flight blocks without completing', async () => {
  const controller = new AbortController();
  let canceled = 0, started = 0, completed = false;
  const download = load(async (_, options) => {
    const [start, end] = range(options);
    if (!start) return reply(start, end, 5 * MB);
    started++;
    return new Promise((resolve, reject) => {
      options.signal.addEventListener('abort', () => { canceled++; reject(new DOMException('Canceled', 'AbortError')); }, { once: true });
      if (started === 3) queueMicrotask(() => controller.abort());
    });
  });
  await assert.rejects(download('https://example.com', undefined, () => completed = true, controller.signal), { name: 'AbortError' });
  assert.equal(canceled, 3);
  assert.equal(completed, false);
});
test('permanent HTTP failures are not retried', async () => {
  let calls = 0;
  const download = load(async () => { calls++; return new Response('{}', { status: 404 }); });
  await assert.rejects(download('https://example.com'), /404/);
  assert.equal(calls, 1);
});
test('rate limiting retries the same range', async () => {
  const ranges = [];
  const download = load(async (_, options) => {
    ranges.push(options.headers.Range);
    return ranges.length === 1 ? new Response('{}', { status: 429, headers: { 'retry-after': '1' } }) : reply(...range(options), 100);
  });
  await download('https://example.com');
  assert.deepEqual(ranges, ['bytes=0-1048575', 'bytes=0-1048575']);
});
