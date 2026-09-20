import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
const page = 'https://www.4shared.com/office/_Gh4MImh/Aves_de_Rapina_08.html';
const out = 'fourshared-flow';
await fs.mkdir(out, { recursive: true });
const cookies = new Map();
function cookieHeader() { return [...cookies].map(([k,v]) => `${k}=${v}`).join('; '); }
async function request(url, label, extra = {}) {
  const response = await fetch(url, { redirect: 'manual', headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': '*/*', 'Cookie': cookieHeader(), ...extra }, signal: AbortSignal.timeout(30000) });
  for (const set of response.headers.getSetCookie()) { const pair = set.split(';',1)[0]; const i=pair.indexOf('='); if(i>0) cookies.set(pair.slice(0,i),pair.slice(i+1)); }
  const reader = response.body?.getReader(); const chunks=[]; let length=0;
  try { while(reader && length<150000) { const {value,done}=await reader.read();if(done)break;chunks.push(value);length+=value.length; } } finally { await reader?.cancel().catch(()=>{}); }
  const bytes=Buffer.concat(chunks).subarray(0,150000);
  const result={label,status:response.status,location:response.headers.get('location'),type:response.headers.get('content-type'),length:response.headers.get('content-length'),range:response.headers.get('content-range'),signature:bytes.subarray(0,12).toString('hex'),cookieNames:[...cookies.keys()]};
  console.log(JSON.stringify(result));
  if(/html|text|json|javascript/i.test(result.type||''))await fs.writeFile(`${out}/${label}.txt`,bytes);
  return {result,text:bytes.toString('utf8')};
}
const initial=await request(page,'page');
const html=initial.text;
const sources=[...html.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)].map(m=>new URL(m[1].replaceAll('&amp;','&'),page).href).filter(u=>/\/d1\/|downloadButton|downloadFlow/i.test(u));
for(let i=0;i<sources.length;i++){
 const response=await request(sources[i],`flow-script-${i}`);
 const text=response.text;
 const markers=['jsDirectDownloadLink','jsSecondsLeft','jsShowDownloadFlow','jsFlowWait','jsDownloadButtonNew','jsManualDownloadLink','jsFileDownloadLink','jsD1Link','downloadFile','setTimeout','setInterval','/download','/get/'];
 for(const marker of markers){let pos=0,count=0;while(count<5){const n=text.indexOf(marker,pos);if(n<0)break;console.log(JSON.stringify({marker,source:sources[i],excerpt:text.slice(Math.max(0,n-220),Math.min(text.length,n+500))}));pos=n+marker.length;count++;}}
}
const tag=/<input\b[^>]*\bid=["']jsDirectDownloadLink["'][^>]*>/i.exec(html)?.[0]||'';
const direct=/\bvalue=["']([^"']+)["']/i.exec(tag)?.[1]?.replaceAll('&amp;','&');
if(direct){
 const u=new URL(direct);if(u.protocol==='https:'&&/(?:^|\.)4shared\.com$/i.test(u.hostname)){
  console.log(JSON.stringify({directHost:u.hostname,directPath:u.pathname,queryNames:[...u.searchParams.keys()]}));
  for(let i=0;i<3;i++){
   const r=await request(u.href,`direct-${i}`,{'Range':'bytes=0-63','Referer':page});
   if(r.result.status>=300&&r.result.status<400&&r.result.location){const next=new URL(r.result.location,u);if(next.protocol==='https:'&&/(?:^|\.)4shared\.com$/i.test(next.hostname))await request(next.href,`redirect-${i}`,{'Range':'bytes=0-63','Referer':page});}
   if(r.result.signature.startsWith('526172211a07'))break;
   if(i===0)await new Promise(resolve=>setTimeout(resolve,21000));
  }
 }
}
console.log(JSON.stringify({pageTitle:/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1],fileParams:[...html.matchAll(/<input[^>]+(?:class=["'][^"']*js(?:SecondsLeft|FreeUserTrafficLimitExceeded|HasDD|ShowDownloadFlow|IsUserLoggedIn)[^"']*["']|id=["']jsSecondsLeft["'])[^>]*>/gi)].map(m=>m[0].replace(/value=["'][^"']*["']/i,match=>match)).slice(0,12)}));
