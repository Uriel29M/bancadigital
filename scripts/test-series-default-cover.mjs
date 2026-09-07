import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source = fs.readFileSync('js/series-default-covers.js','utf8');
function harness() {
  let store = [];
  let writeError = null;
  const client = { from(table) { assert.equal(table,'catalog_series_default_covers'); return {
    select() { return { order() { return { limit: async () => ({data:store,error:null}) }; } }; },
    upsert(row) { return { select() { return { single: async () => { if(writeError) return {data:null,error:writeError}; store = store.filter(x=>x.series_id!==row.series_id).concat({...row,updated_at:'2026-09-07T00:00:00Z'}); return {data:store.at(-1),error:null}; } }; } }; }
  }; }, channel() { return { on() {return this;},subscribe(){return this;} }; } };
  const window={BANCA_SUPABASE_URL:'https://example.supabase.co',addEventListener(){},setInterval(){return 1;}};
  const context={window,navigator:{onLine:true},document:{hidden:false,addEventListener(){}},console};
  vm.runInNewContext(source,context);
  return {api:window.BancaSeriesDefaults,client,setStore(value){store=value;},setError(value){writeError=value;}};
}
const choice = {itemId:'edition-2',coverUrl:'https://example.org/cover.jpg',isVariant:false};
test('shared defaults load without requiring a user session',async()=>{const h=harness();h.setStore([{series_id:'series-1',item_id:'edition-2',cover_url:choice.coverUrl,is_variant:false}]);await h.api.start(h.client);assert.equal(h.api.get('series-1').cover_url,choice.coverUrl);});
test('admin write is confirmed by the database before local state changes',async()=>{const h=harness();await h.api.start(h.client);await h.api.setDefault('series-1',choice,'admin-id');assert.equal(h.api.get('series-1').item_id,'edition-2');h.setError(new Error('permission denied'));await assert.rejects(h.api.setDefault('series-1',{...choice,itemId:'edition-3'},'admin-id'));assert.equal(h.api.get('series-1').item_id,'edition-2');});
test('refresh replaces obsolete defaults without changing personal choices',async()=>{const h=harness();await h.api.start(h.client);h.setStore([{series_id:'series-2',cover_url:'https://example.org/new.jpg'}]);await h.api.refresh();assert.equal(h.api.get('series-1'),null);assert.equal(h.api.get('series-2').cover_url,'https://example.org/new.jpg');});
test('existing personal selection precedes shared default',()=>{const app=fs.readFileSync('js/app.js','utf8');const match=app.match(/  function seriesCoverFor\(item, seriesCoverChoices = null\) \{[\s\S]*?\n  \}/);assert.ok(match);const context={state:{section:'home',seriesCoverChoices:new Map([['series-1',{cover_url:'https://example.org/personal.jpg'}]])},window:{BancaSeriesDefaults:{get(){return {cover_url:'https://example.org/default.jpg'};}}},proxiedImageUrl:x=>x,coverFor:()=> 'fallback'};vm.runInNewContext(match[0]+';this.choose=seriesCoverFor;',context);assert.equal(context.choose({seriesId:'series-1'}),'https://example.org/personal.jpg');context.state.seriesCoverChoices.clear();assert.equal(context.choose({seriesId:'series-1'}),'https://example.org/default.jpg');context.window.BancaSeriesDefaults.get=()=>null;assert.equal(context.choose({seriesId:'series-1'}),'fallback');});
test('chooser action is exclusive to administrators and does not write personal choices',()=>{const app=fs.readFileSync('js/app.js','utf8');const start=app.indexOf('function openSeriesCoverChoice(seriesId)');const end=app.indexOf('\n  function ',start+10);const chooser=app.slice(start,end);assert.match(chooser,/state\.profile\?\.plan === "admin"/);assert.match(chooser,/data-set-series-default/);assert.match(chooser,/BancaSeriesDefaults\.setDefault/);assert.match(chooser,/if \(state\.profile\?\.plan !== "admin"/);const action=chooser.slice(chooser.indexOf('if (defaultButton) defaultButton.onclick'),chooser.indexOf('$("#series-cover-choice-form", overlay).onsubmit'));assert.doesNotMatch(action,/user_series_cover_choices/);assert.match(chooser,/user_series_cover_choices/);});
test('new script loads before the application and cache version is updated',()=>{const html=fs.readFileSync('index.html','utf8');assert.ok(html.indexOf('js/series-default-covers.js?v=1')<html.indexOf('js/app.js?v='));assert.match(html,/sw\.js\?v=243/);const app=fs.readFileSync('js/app.js','utf8');assert.match(app,/BancaSeriesDefaults\?\.start\(sb/);});
