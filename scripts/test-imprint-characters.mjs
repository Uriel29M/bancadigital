import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync('js/app.js', 'utf8');

test('selo inclui personagens de todas as edições, sem duplicar histórias da mesma série', () => {
  const library = [
    { id: '1', seriesId: 'serie', imprint: 'Selo', character: 'Batman', secondaryCharacters: ['Alfred'], characters: ['Batman'] },
    { id: '2', seriesId: 'serie', imprint: 'Selo', character: 'Batman', secondaryCharacters: ['Robin'] },
    { id: '3', seriesId: 'outra', imprint: 'Selo', characters: ['Robin', 'Batgirl'] },
    { id: '4', imprint: 'Outro selo', character: 'Superman' },
    { id: '5', imprint: 'Selo', character: 'Oculto', hidden: true },
  ];
  const context = vm.createContext({
    state: {
      entityFilter: { kind: 'imprint', value: 'Selo' }, db: { library },
      characterSettings: new Map(), imprintSettings: new Map(), savedImprintKeys: new Set(), factionRoles: [],
    },
    wikiCharacterImageCache: new Map(),
    isAdminProfile: () => false,
    visibleCatalogItems: () => library.filter(item => !item.hidden),
    filterCollectionItems: items => items.filter(item => item.id === '1'),
    sortCatalogCards: items => items,
    wikiQuickMarkup: () => '', currentFactionId: () => null,
    seriesCard: () => '', card: () => '',
    escapeHTML: value => String(value), imageProxyFetchUrl: value => value,
  });
  for (const name of ['publisherKey', 'canonicalCharacterName', 'characterNames', 'characterSettingForName', 'isTeamCharacter', 'isRedirectedCharacter', 'uniqueCatalogItems', 'imprintCharacterMarkup', 'renderEntityPage']) {
    const match = source.match(new RegExp(`  function ${name}\\([^\\n]*\\) \\{[\\s\\S]*?\\n  \\}`));
    assert.ok(match, name);
    vm.runInContext(match[0], context);
  }
  const markup = context.renderEntityPage();
  assert.match(markup, /<strong>Batman<\/strong><small>1 história<\/small>/);
  assert.match(markup, /<strong>Alfred<\/strong><small>1 história<\/small>/);
  assert.match(markup, /<strong>Robin<\/strong><small>2 histórias<\/small>/);
  assert.match(markup, /<strong>Batgirl<\/strong><small>1 história<\/small>/);
  assert.equal((markup.match(/data-wiki-character="Robin"/g) || []).length, 1);
  assert.doesNotMatch(markup, /Superman|Oculto/);
});
