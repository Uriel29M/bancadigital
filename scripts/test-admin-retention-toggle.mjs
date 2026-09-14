import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
const source=readFileSync('js/app.js','utf8');
const helper=source.slice(source.indexOf('  function bindAdminAccountRetention('),source.indexOf('  function openAdmin(editId'));
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function setup({admin=true,rpc,offline=false}={}){
 const nodes=new Map();const node=key=>{if(!nodes.has(key))nodes.set(key,{setAttribute(){},after(){}});return nodes.get(key);};
 const calls=[];let enabled=true;let email_scope='all';
 const context=vm.createContext({isAdminProfile:()=>admin,document:{createElement:()=>node('section')},$:node,state:{session:{}},navigator:{onLine:!offline},sb:{rpc:async(name,args)=>{calls.push({name,args});if(rpc)return rpc(name,args);if(args){enabled=args.p_enabled;email_scope=args.p_email_scope;}return {data:{enabled,email_scope}};}}});
 vm.runInContext(helper,context);context.bindAdminAccountRetention({});
 return {nodes,node,calls,context};
}
test('loads server state and toggles both ways, using persisted result',async()=>{
 const t=setup();await tick();assert.match(t.node('[data-retention-status]').textContent,/Ativada/);
 await t.node('[data-retention-toggle]').onclick();assert.match(t.node('[data-retention-status]').textContent,/Desativada/);
 assert.equal(t.calls[1].name,'set_inactive_account_cleanup_settings');assert.equal(t.calls[1].args.p_enabled,false);
 t.context.bindAdminAccountRetention({});await tick();assert.match(t.node('[data-retention-status]').textContent,/Desativada/);
 await t.node('[data-retention-toggle]').onclick();assert.match(t.node('[data-retention-status]').textContent,/Ativada/);
});
test('does not display control or call backend for non-admin',async()=>{const t=setup({admin:false});await tick();assert.equal(t.nodes.size,0);assert.equal(t.calls.length,0);});
test('failure does not claim success, and retry reads server state',async()=>{
 let fail=true;const t=setup({rpc:async(name)=>{if(name.startsWith('set_')&&fail){fail=false;return {error:{message:'Sem permissão'}};}return {data:{enabled:true,email_scope:'all'}};}});await tick();
 await t.node('[data-retention-toggle]').onclick();assert.equal(t.node('[data-retention-status]').textContent,'Sem permissão');assert.equal(t.node('[data-retention-toggle]').textContent,'Tentar novamente');
 await t.node('[data-retention-toggle]').onclick();assert.equal(t.calls.at(-1).name,'get_inactive_account_cleanup_settings');assert.match(t.node('[data-retention-status]').textContent,/Ativada/);
});
test('ignores repeated clicks during a request',async()=>{
 let finish;const t=setup({rpc:()=>new Promise(resolve=>{finish=resolve;})});
 t.node('[data-retention-toggle]').onclick();assert.equal(t.calls.length,1);assert.equal(t.node('[data-retention-toggle]').disabled,true);finish({data:{enabled:false,email_scope:'all'}});await tick();assert.equal(t.node('[data-retention-toggle]').disabled,false);
});
test('offline setting cannot be changed',async()=>{const t=setup({offline:true});await tick();assert.equal(t.calls.length,0);assert.match(t.node('[data-retention-status]').textContent,/Conecte-se/);});

test('email selection persists while disabled and survives re-enabling',async()=>{
 const t=setup();await tick();await t.node('[data-retention-toggle]').onclick();
 const select=t.node('[data-retention-email-scope]');
 for(const scope of ['without_email','with_email','all']){
  select.value=scope;await select.onchange();
  assert.equal(t.calls.at(-1).args.p_enabled,false);
  assert.equal(t.calls.at(-1).args.p_email_scope,scope);
  t.context.bindAdminAccountRetention({});await tick();assert.equal(select.value,scope);
 }
 select.value='without_email';await select.onchange();
 await t.node('[data-retention-toggle]').onclick();assert.equal(t.calls.at(-1).args.p_email_scope,'without_email');
});

test('failed scope save restores confirmed selection and disables it until retry',async()=>{
 const t=setup({rpc:async name=>name.startsWith('set_')?{error:{message:'Falha'}}:{data:{enabled:false,email_scope:'with_email'}}});await tick();
 const select=t.node('[data-retention-email-scope]');select.value='without_email';await select.onchange();
 assert.equal(select.value,'with_email');assert.equal(select.disabled,true);
 await t.node('[data-retention-toggle]').onclick();assert.equal(select.disabled,false);assert.equal(select.value,'with_email');
});
