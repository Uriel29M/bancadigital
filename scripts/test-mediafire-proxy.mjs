import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';
import test from 'node:test';
const source = stripTypeScriptTypes(readFileSync('supabase/functions/mediafire-proxy/index.ts', 'utf8'));
const context = vm.createContext({ URL, Deno: { serve() {} } });
vm.runInContext(source, context);
test('normalizes escaped dots in MediaFire host without changing the file path', () => {
  const url = context.parseAllowedUrl(String.raw`https://www\.mediafire.com/?33n9qnzffj8lz7q`);
  assert.equal(url.href, 'https://www.mediafire.com/?33n9qnzffj8lz7q');
  assert.equal(context.parseAllowedUrl('https://download123.mediafire.com/key/file.cbr').hostname, 'download123.mediafire.com');
});
test('escaped host correction does not bypass the MediaFire allowlist', () => {
  for (const url of [String.raw`https://www\.mediafire.com.evil.example/file`, 'https://mediafire.com@evil.example/file', 'http://www.mediafire.com/file']) {
    assert.throws(() => context.parseAllowedUrl(url), /MediaFire/);
  }
});
test('legacy links use canonical file paths before contacting MediaFire', async () => {
  const calls = [];
  context.fetch = async url => {
    calls.push(String(url));
    return { status: 200, ok: true, text: async () => '<a href="https://download123.mediafire.com/key/file.cbr">Download</a>' };
  };
  for (const url of ['https://www.mediafire.com/?33n9qnzffj8lz7q', 'https://www.mediafire.com/download.php?33n9qnzffj8lz7q', 'https://www.mediafire.com/download/33n9qnzffj8lz7q']) {
    await context.resolveDownload(new URL(url));
  }
  assert.deepEqual(calls, Array(3).fill('https://www.mediafire.com/file/33n9qnzffj8lz7q/file'));
});
