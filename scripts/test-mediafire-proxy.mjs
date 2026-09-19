import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync('supabase/functions/mediafire-proxy/index.ts', 'utf8');

test('MediaFire proxy only accepts HTTPS MediaFire hosts', () => {
  assert.ok(source.includes('url.protocol !== "https:"'));
  assert.ok(source.includes('host === "mediafire.com"'));
  assert.ok(source.includes('host === "www.mediafire.com"'));
  assert.ok(source.includes('/^download\\d+\\.mediafire\\.com$/'));
  assert.ok(source.includes('url.username || url.password || url.port'));
});

test('escaped dots are normalized only in the URL authority', () => {
  assert.ok(source.includes('authority.replace(/\\\\\\./g, ".")'));
  assert.ok(source.includes('value.replace(/^(https:\\/\\/)([^/?#]+)/i'));
});

test('proxy delegates transfer to the external media gateway', () => {
  assert.ok(source.includes('redirectToGateway({ kind: "mediafire"'));
  assert.ok(!source.includes('response.arrayBuffer('));
  assert.ok(!source.includes('response.body'));
});
