import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
const app = readFileSync('js/app.js', 'utf8');
for (const catalog of ['recentes', 'novos-52']) {
 test(`${catalog}: volume belongs to edition titles, never series names`, () => {
  const context = vm.createContext({ window: {} });
  vm.runInContext(readFileSync(`js/data/dc-comics/${catalog}.js`, 'utf8'), context);
  for (const name of ['itemDisplayTitle', 'itemIssueDisplay', 'seriesDefinitionFor']) {
   vm.runInContext(app.match(new RegExp(`  function ${name}\\(item\\) \\{[\\s\\S]*?\\n  \\}`))[0], context);
  }
  const rows = context.window.DEFAULT_LIBRARY.filter(x => x.seriesId === 'series-antes-de-watchmen-2012-novos-52');
  assert.equal(rows.length, 36);
  for (const item of rows) {
   assert.equal(context.itemDisplayTitle(item), `${item.title} #${item.issue}`);
   const series = context.seriesDefinitionFor(item);
   for (const key of ['name', 'title', 'seriesTitle']) assert.equal(series[key], 'Antes de Watchmen');
   assert.equal(context.seriesDefinitionFor({...item, name: item.title}).name, 'Antes de Watchmen');
  }
  assert.equal(context.itemDisplayTitle(rows[0]), 'Antes de Watchmen: Comediante #1');
 });
}
