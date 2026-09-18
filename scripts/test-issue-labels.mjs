import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const app = readFileSync('js/app.js', 'utf8');
const helpers = app.slice(app.indexOf('  function itemIssueDisplay('), app.indexOf('  function rail('));
function setup(library) {
  const context = vm.createContext({ state: { db: { library } } });
  vm.runInContext(helpers, context);
  return context.itemIssueLabel;
}
const edition = (issue, extra = {}) => ({ seriesId: 'series-test', issue, ...extra });

test('21 numbered editions plus zero and specials end at 21/21', () => {
  const library = Array.from({ length: 21 }, (_, i) => edition(String(i + 1)));
  const extras = [0, 'Anual 2026', 'Sneak Peek', 'Especial', 'One-shot', '1.5'].map(issue => edition(issue));
  library.push(...extras);
  const label = setup(library);
  assert.equal(label(library[20]), '21/21');
  for (const item of extras) assert.equal(label(item), String(item.issue));
  assert.equal(library.length, 27);
});

test('each tab and series has its own last numbered edition', () => {
  const library = [edition('1'), edition('6'), edition('1', { volume: 'Volume 2' }),
    edition('12', { volumeTitle: 'Volume 2', volume: 'legacy' }),
    edition('50', { seriesId: 'other' })];
  const label = setup(library);
  assert.equal(label(library[1]), '6/6');
  assert.equal(label(library[2]), '1/12');
  assert.equal(label(library[3]), '12/12');
});

test('historical numbering without #1 has no denominator', () => {
  const library = ['1000', '1001', '1002'].map(issue => edition(issue));
  const label = setup(library);
  for (const item of library) assert.equal(label(item), item.issue);
});

test('gaps and duplicate editions do not turn the denominator into a quantity', () => {
  const library = ['001', '003', '021', '021'].map(issue => edition(issue));
  assert.equal(setup(library)(library[2]), '021/21');
});

test('published Arlequina catalogs exclude zero and the annual from the denominator', () => {
  const context = vm.createContext({ window: {} });
  vm.runInContext(readFileSync('js/data/dc-comics/recentes.js', 'utf8'), context);
  const library = context.window.DEFAULT_LIBRARY;
  const label = setup(library);
  const novos52 = library.filter(item => item.seriesId === 'series-arlequina-2013-novos-52');
  assert.equal(novos52.length, 28);
  assert.equal(label(novos52.find(item => item.issue === '24')), '24/24');
  assert.equal(label(novos52.find(item => item.issue === '0')), '0');
  assert.equal(label(novos52.find(item => item.issue === 'Anual 1')), 'Anual 1');
  assert.equal(label(novos52.find(item => item.issue === 'Especial 1')), 'Especial 1');
  assert.equal(label(novos52.find(item => item.issue === 'Especial 2')), 'Especial 2');
  const current = library.filter(item => item.seriesId === 'series-harley-quinn-2021');
  assert.equal(current.length, 21);
  assert.equal(label(current.find(item => item.issue === '20')), '20/20');
  assert.equal(label(current.find(item => item.issue === 'Anuário')), 'Anuário');
});
