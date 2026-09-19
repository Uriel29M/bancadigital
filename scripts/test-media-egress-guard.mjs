import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

for (const path of [
  'supabase/functions/mediafire-proxy/index.ts',
  'supabase/functions/mega-proxy/index.ts',
  'supabase/functions/telegram-proxy/index.ts'
]) {
  const source = readFileSync(path,'utf8');
  test(path + ' não transmite arquivo pesado', () => {
    assert.match(source,/redirectToGateway/);
    assert.doesNotMatch(source,/ReadableStream|upstream\.body|downloadChunk|File\.fromURL/);
  });
}
test('gateway externo contém os transportes',()=>{
  const source=readFileSync('gateway/server.ts','utf8');
  assert.match(source,/File\.fromURL/);
  assert.match(source,/TelegramClient/);
  assert.match(source,/mediafireDirect/);
});
