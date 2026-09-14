import { TelegramClient } from 'npm:@mtcute/web@0.31.0';
import { MemoryStorage, IntermediatePacketCodec, Long } from 'npm:@mtcute/core@0.31.0';
import { connectTcp } from 'jsr:@fuman/deno@0.0.21';
import { createMediaHandler, MediaError } from 'https://raw.githubusercontent.com/Uriel29M/bancadigital/0c5a4ea9b2891163ae9e083d31a14714fcf3b947/supabase/functions/telegram-mtproto/media-core.mjs';
class NativeTcpTransport {
  async connect(dc: {ipAddress:string;port:number}, signal:AbortSignal) {
    const conn=await connectTcp({address:dc.ipAddress,port:dc.port},signal);
    conn.setNoDelay(true);conn.setKeepAlive(true);return conn;
  }
  packetCodec(){return new IntermediatePacketCodec();}
}
const required=(name:string)=>{const value=Deno.env.get(name)?.trim();if(!value)throw new MediaError(`Configure ${name} nos Secrets do Supabase.`,503,'mtproto_not_configured');return value;};
const configured=()=>Boolean(Deno.env.get('TELEGRAM_API_ID')&&Deno.env.get('TELEGRAM_API_HASH')&&Deno.env.get('TELEGRAM_BOT_TOKEN'));
function diagnostic(error:unknown,stage:string){
  if(error instanceof MediaError)return error;
  const e=error as Record<string,unknown>;
  const name=String(e?.name||'Error').replace(/[^A-Za-z0-9_]/g,'').slice(0,40);
  const text=String(e?.text||e?.errorMessage||'');
  const rpc=/^[A-Z][A-Z0-9_]{2,100}$/.test(text)?text:'';
  console.error('telegram-mtproto',stage,name,rpc||'unknown');
  return new MediaError('Não foi possível acessar o arquivo pelo MTProto.',502,`mtproto_${stage}_${rpc||name}`);
}
let pendingClient:Promise<TelegramClient>|null=null;
async function telegram(){
  if(!pendingClient){pendingClient=(async()=>{
    const apiId=Number(required('TELEGRAM_API_ID'));const apiHash=required('TELEGRAM_API_HASH');
    if(!Number.isSafeInteger(apiId)||apiId<=0||!/^[a-f0-9]{32}$/i.test(apiHash))throw new MediaError('Credenciais MTProto inválidas.',503);
    const client=new TelegramClient({apiId,apiHash,storage:new MemoryStorage(),transport:new NativeTcpTransport(),disableUpdates:true});
    try{await client.start({botToken:required('TELEGRAM_BOT_TOKEN')});return client;}
    catch(error){await client.destroy().catch(()=>{});throw diagnostic(error,'auth');}
  })().catch(error=>{pendingClient=null;throw error;});}
  return pendingClient;
}
async function query(path:string){
  const url=`${required('SUPABASE_URL')}/rest/v1/${path}`;const key=required('SUPABASE_ANON_KEY');
  const response=await fetch(url,{headers:{apikey:key,Authorization:`Bearer ${key}`},signal:AbortSignal.timeout(10000)});
  if(!response.ok)throw new MediaError('Não foi possível validar o catálogo.',502,'catalog_http_'+response.status);
  return await response.json();
}
function parsePost(value:unknown){
  let url:URL;try{url=new URL(String(value||''));}catch{throw new MediaError('Postagem inválida.',422);}
  if(url.protocol!=='https:'||!['t.me','telegram.me','www.t.me','www.telegram.me'].includes(url.hostname)||url.username||url.password||url.port)throw new MediaError('Postagem inválida.',422);
  const p=url.pathname.split('/').filter(Boolean);let chat:string,id:string;
  if(p.length===3&&p[0]==='c'&&/^[1-9]\d{0,14}$/.test(p[1])){chat=`-100${p[1]}`;id=p[2];}
  else if(p.length===2&&/^[A-Za-z][A-Za-z0-9_]{3,31}$/.test(p[0])){chat=`@${p[0]}`;id=p[1];}
  else throw new MediaError('Postagem inválida.',422);
  if(!/^[1-9]\d{0,11}$/.test(id)||!Number.isSafeInteger(Number(id)))throw new MediaError('Mensagem inválida.',422);
  return{chat,messageId:Number(id)};
}
const allowed=()=>new Set(['-1004424843914',...(Deno.env.get('TELEGRAM_ALLOWED_CHAT_IDS')||'').split(',').map(s=>s.trim()).filter(Boolean)]);
const validFileId=(id:string)=>id.length>=8&&id.length<=1024&&/^[A-Za-z0-9_-]+$/.test(id);
async function lookup(itemId:string){
  const rows=await query(`catalog_edition_overrides?item_id=eq.${encodeURIComponent(itemId)}&select=edition&limit=1`);
  const edition=rows[0]?.edition;
  if(!edition||String(edition.id)!==itemId||!validFileId(String(edition.telegramFileId||'')))return null;
  const format=String(edition.format||'').toLowerCase();const size=Number(edition.telegramFileSize);
  if(!['pdf','cbz','cbr'].includes(format)||!Number.isSafeInteger(size)||size<1)throw new MediaError('Metadados do arquivo incompletos.',422);
  const hidden=await query(`catalog_item_visibility?item_id=eq.${encodeURIComponent(itemId)}&is_hidden=eq.true&select=item_id&limit=1`);
  if(hidden.length)return null;
  if(edition.seriesId){const hiddenSeries=await query(`catalog_series_visibility?series_id=eq.${encodeURIComponent(String(edition.seriesId))}&is_hidden=eq.true&select=series_id&limit=1`);if(hiddenSeries.length)return null;}
  return{id:itemId,size,format,post:parsePost(edition.telegramUrl)};
}
async function resolveDocument(client:TelegramClient,item:{size:number;format:string;post:{chat:string;messageId:number}}){
  let channelId:string;let accessHash=Long.ZERO;
  if(item.post.chat.startsWith('-100'))channelId=item.post.chat;
  else{
    let resolved;
    try{resolved=await client.call({_: 'contacts.resolveUsername',username:item.post.chat.slice(1)});}catch(error){throw diagnostic(error,'resolve_chat');}
    const channel=resolved.chats?.find((c:Record<string,unknown>)=>c._==='channel'&&String(c.username||'').toLowerCase()===item.post.chat.slice(1).toLowerCase());
    if(!channel)throw new MediaError('Canal não encontrado.',404,'channel_not_found');
    channelId=`-100${channel.id}`;accessHash=channel.accessHash;
  }
  if(!allowed().has(channelId))throw new MediaError('Canal não autorizado.',403,'channel_not_allowed');
  const bare=channelId.slice(4);
  let channels;
  try{channels=await client.call({_: 'channels.getChannels',id:[{_: 'inputChannel',channelId:Long.fromString(bare),accessHash}]});}
  catch(error){throw diagnostic(error,'channel');}
  const channel=channels.chats?.find((c:Record<string,unknown>)=>c._==='channel'&&String(c.id)===bare);
  if(!channel?.accessHash)throw new MediaError('Canal não encontrado.',404,'channel_not_found');
  let result;
  try{result=await client.call({_: 'channels.getMessages',channel:{_: 'inputChannel',channelId:Long.fromString(bare),accessHash:channel.accessHash},id:[{_: 'inputMessageID',id:item.post.messageId}]});}
  catch(error){throw diagnostic(error,'message');}
  const message=result.messages?.find((m:Record<string,unknown>)=>m._==='message'&&m.id===item.post.messageId);
  const media=message?.media;
  const document=media?._==='messageMediaDocument'?media.document:null;
  if(!document||document._!=='document'||Number(document.size)!==item.size)throw new MediaError('O documento original não corresponde ao catálogo.',422,'document_mismatch');
  const name=document.attributes?.find((a:Record<string,unknown>)=>a._==='documentAttributeFilename')?.fileName;
  if(!String(name||'').toLowerCase().endsWith(`.${item.format}`))throw new MediaError('O formato do documento não corresponde ao catálogo.',422,'document_format_mismatch');
  if(!Number.isInteger(document.dcId)||document.dcId<1||document.dcId>100)throw new MediaError('Centro de dados inválido.',502,'invalid_dc');
  return{location:{_: 'inputDocumentFileLocation',id:document.id,accessHash:document.accessHash,fileReference:document.fileReference,thumbSize:''},dcId:document.dcId};
}
function migration(error:unknown){const e=error as Record<string,unknown>;const match=/^FILE_MIGRATE_(\d+)$/.exec(String(e?.text||e?.errorMessage||''));return match?Number(match[1]):0;}
function expired(error:unknown){const e=error as Record<string,unknown>;return /^FILE_REFERENCE_(EXPIRED|INVALID|EMPTY)$/.test(String(e?.text||e?.errorMessage||''));}
const handle=createMediaHandler({lookup,health:async()=>({ok:configured(),mode:'mtproto',configured:configured(),storage:'memory',chunkBytes:262144}),open:async item=>{
  const client=await telegram();let file=await resolveDocument(client,item);let dcId=file.dcId;
  return{read:async(offset:number,limit:number,signal:AbortSignal)=>{
    const read=async()=>{
      const aligned=Math.floor(offset/4096)*4096;
      const padding=offset-aligned;
      const length=Math.ceil((padding+limit)/4096)*4096;
      const bytes=await client.downloadChunk({location:file.location,dcId,offset:aligned,limit:length,abortSignal:signal,maxRetryCount:2,floodSleepThreshold:0});
      return bytes.subarray(padding,padding+limit);
    };
    try{try{return await read();}catch(error){const next=migration(error);if(next&&next!==dcId){dcId=next;return await read();}if(expired(error)){file=await resolveDocument(client,item);dcId=file.dcId;return await read();}throw error;}}
    catch(error){throw diagnostic(error,'download');}
  },close:async()=>{}};
}});
Deno.serve(handle);
