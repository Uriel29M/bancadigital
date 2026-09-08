import test from 'node:test';
import assert from 'node:assert/strict';
import { createSessionManager, floodSeconds } from './session-manager.mjs';
import { createSessionCrypto } from './session-crypto.mjs';
import { readAligned } from './mtproto-source.mjs';
import { createMediaHandler } from './media-core.mjs';
const cipher = createSessionCrypto('a'.repeat(64));
test('session encryption is authenticated and round-trips', async () => {
  const encrypted = await cipher.encrypt('secret-session');
  assert.ok(!encrypted.includes('secret-session'));
  assert.equal(await cipher.decrypt(encrypted), 'secret-session');
  await assert.rejects(cipher.decrypt(encrypted.slice(0,-2)+'xx'));
});
test('flood wait is recognized inside a library error message', () => {
  assert.equal(floodSeconds(new Error('Telegram API error 420: FLOOD_WAIT_1656')),1656);
  assert.equal(floodSeconds({text:'FLOOD_WAIT_30'}),30);
});
function fixture() {
  let clock=1000000, connected=0, starts=0, releases=0, timerId=0;
  const timers=new Map(); const state={session:null,owner:null,until:0,blockUntil:0};
  const rpc=async(action,id,value)=>{
    if(action==='status')return {busy:state.owner!==null&&state.until>clock,hasSession:!!state.session};
    if(action==='acquire'){
      if(state.blockUntil>clock)return {ok:false,reason:'cooldown',retryAfter:Math.ceil((state.blockUntil-clock)/1000)};
      if(state.owner&&state.owner!==id&&state.until>clock)return {ok:false,reason:'busy',retryAfter:2};
      state.owner=id;state.until=clock+600000;return {ok:true,session:state.session};
    }
    if(state.owner!==id||state.until<=clock)return {ok:false,reason:'lease_lost'};
    if(action==='renew')state.until=clock+600000;
    if(action==='save')state.session=value;
    if(action==='block')state.blockUntil=clock+Number(value)*1000;
    if(action==='release'){state.owner=null;state.until=0;releases++;}
    return {ok:true};
  };
  const createClient=async()=>({
    async start(options){starts++;connected++;},
    async exportSession(){return 'session-key';},
    async disconnect(){connected--;},async destroy(){},
  });
  const options={state:rpc,createClient,botToken:'bot-token',...cipher,now:()=>clock,
    setIntervalFn(fn){const id=++timerId;timers.set(id,fn);return id;},clearIntervalFn(id){timers.delete(id);},idleMs:30000};
  return {options,state,rpc,advance(ms){clock+=ms;},get connected(){return connected;},get starts(){return starts;},get releases(){return releases;},timers};
}
test('concurrent readers share one connection and persisted session survives restart',async()=>{
  const f=fixture();const a=createSessionManager(f.options),b=createSessionManager(f.options);
  const [x,y]=await Promise.all([a.open(),a.open()]);
  assert.equal(f.starts,1);assert.equal(f.connected,1);
  await assert.rejects(b.open(),e=>e.code==='telegram_busy');
  await x.release();await y.release();await a.close();
  assert.equal(f.connected,0);assert.equal(f.releases,1);
  const z=await b.open();assert.equal(f.starts,2);assert.equal(f.connected,1);
  await z.release();await b.close();
  assert.equal(f.connected,0);
});
test('flood wait is stored and prevents repeated authorization',async()=>{
  const f=fixture();f.options.createClient=async()=>({async start(){throw Error('Telegram API error 420: FLOOD_WAIT_1656');},async disconnect(){},async destroy(){}});
  const a=createSessionManager(f.options);
  await assert.rejects(a.open(),e=>e.code==='telegram_flood_wait'&&e.retryAfter===1656);
  await assert.rejects(a.open(),e=>e.code==='telegram_cooldown');
  assert.equal(f.state.blockUntil,1000000+1656000);
});
test('aligned reader splits large and unaligned ranges into legal Telegram chunks',async()=>{
  const size=34688050;const reads=[];
  const bytes=await readAligned(async(offset,length)=>{
    reads.push([offset,length]);
    assert.equal(offset%4096,0);assert.equal(length%4096,0);assert.ok(length<=262144);
    return new Uint8Array(Math.min(length,size-offset)).fill(7);
  },123,1048576,size);
  assert.equal(bytes.length,1048576);assert.equal(reads.length,5);
  const tail=await readAligned(async(offset,length)=>new Uint8Array(Math.min(length,size-offset)).fill(9),size-4096,4096,size);
  assert.equal(tail.length,4096);
});
test('full 34.7 MB archive can be reconstructed over HTTP ranges',async()=>{
  const size=34688050;let reads=0;
  const handler=createMediaHandler({lookup:async()=>({size,format:'cbr'}),open:async()=>({read:async(offset,length)=>{reads++;return new Uint8Array(length).fill(offset%251);},close:async()=>{}})});
  let received=0;const parts=[];
  while(received<size){const end=Math.min(size-1,received+1048576-1);const r=await handler(new Request('https://example.com/media?item_id=sample',{headers:{Range:`bytes=${received}-${end}`}}));assert.equal(r.status,206);const b=new Uint8Array(await r.arrayBuffer());assert.equal(b.length,end-received+1);parts.push(b);received+=b.length;}
  assert.equal(received,size);assert.equal(Buffer.concat(parts).length,size);assert.ok(reads>30);
});
