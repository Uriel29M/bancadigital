import test from 'node:test';
import assert from 'node:assert/strict';
import { createHandler } from '../supabase/functions/username-login/handler.mjs';
const request = body => new Request('https://example.test/login', {method:'POST', body:JSON.stringify(body)});
const config = { url:'https://auth.test', publicKey:'public-key', serviceKey:'server-secret' };
test('only returns session tokens after password verification; email stays server-side', async () => {
  const calls=[];
  const handler=createHandler({...config,fetcher:async(url,init)=>{
    calls.push({url,...init});
    return calls.length===1 ? Response.json('private@example.test')
      : Response.json({access_token:'access',refresh_token:'refresh',user:{email:'private@example.test'}});
  }});
  const response=await handler(request({username:'reader',password:'correct'}));
  assert.equal(response.status,200);
  assert.deepEqual(await response.json(),{access_token:'access',refresh_token:'refresh'});
  assert.equal(JSON.parse(calls[1].body).email,'private@example.test');
  assert.equal(calls[1].headers.apikey,'public-key');
  assert.equal(calls[0].headers.apikey,'server-secret');
  assert.equal(response.headers.get('Cache-Control'),'no-store');
});
test('unknown, limited and incorrect credentials have identical errors without identity leaks', async()=>{
  const results=[];
  for(const email of [null,'private@example.test']) {
    let count=0;
    const handler=createHandler({...config,fetcher:async()=> ++count===1 ? Response.json(email)
      : Response.json({email:'private@example.test',error_description:'Sensitive Auth reason'},{status:400})});
    const response=await handler(request({username:'reader',password:'wrong'}));
    assert.equal(count,2);
    results.push([response.status,await response.text()]);
  }
  assert.deepEqual(results[0],results[1]);
  assert.doesNotMatch(results[0][1],/private@|Sensitive/);
});
test('malformed input and method restrictions never invoke privileged lookup',async()=>{
  const handler=createHandler({...config,fetcher:()=>{throw new Error('Unexpected lookup');}});
  for(const body of [{username:'bad%',password:'x'},{username:'reader'},{username:'reader',password:5}])
    assert.equal((await handler(request(body))).status,401);
  assert.equal((await handler(new Request('https://example.test'))).status,405);
  assert.equal((await handler(new Request('https://example.test',{method:'OPTIONS'}))).status,200);
});
test('lookup outage never falls back to guessed email; upstream details are not returned',async()=>{
  let calls=0;
  const handler=createHandler({...config,fetcher:async()=>{calls++;return Response.json({message:'private email'},{status:500});}});
  const response=await handler(request({username:'reader',password:'x'}));
  assert.equal(response.status,503);assert.equal(calls,1);
  assert.doesNotMatch(await response.text(),/private email/);
});
