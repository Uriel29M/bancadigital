import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import vm from 'node:vm';
import test from 'node:test';
const source=readFileSync('supabase/functions/mega-proxy/index.ts','utf8');
const block=source.slice(source.indexOf('async function downloadMegaBlock'),source.indexOf('async function downloadMegaRange'));
test('one-byte probe does not pass end zero to megajs',async()=>{
 const calls=[];
 const context=vm.createContext({readMegaBlock:async x=>x,Uint8Array});
 vm.runInContext(stripTypeScriptTypes(block),context);
 const file={size:12006240,download(options){calls.push(options);return new Uint8Array(16).fill(82);}};
 const bytes=await context.downloadMegaBlock(file,0,0);
 assert.equal(calls.length,1);assert.equal(calls[0].end,15);assert.equal(bytes.length,1);assert.equal(bytes[0],82);
});
