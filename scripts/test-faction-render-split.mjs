import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync('js/app.js', 'utf8');
const feature = readFileSync('js/faction-render-feature.js', 'utf8');
const index = readFileSync('index.html', 'utf8');
const sw = readFileSync('sw.js', 'utf8');

assert.ok(app.includes('import(appAssetUrl("js/faction-render-feature.js"))'));
assert.ok(app.includes('function renderFactionPage(...args)'));
assert.ok(app.includes('function renderFactionMembersPage(...args)'));
assert.ok(app.includes('function factionMembersResultsMarkup(...args)'));
assert.ok(app.includes('Carregando facção…'));

assert.ok(!app.includes('function factionCatalogMarkup(faction)'));
assert.ok(!app.includes('function factionOwnedCatalogMarkup(faction, standalone = false, onlyCatalogId = null)'));
assert.ok(!app.includes('function factionContinueReadingMarkup(faction)'));
assert.ok(!app.includes('function factionPinnedCollectionsMarkup(faction)'));
assert.ok(!app.includes('function factionExtraAbafacsMarkup(faction, stats)'));
assert.ok(!app.includes('function renderFactionPage()'));

assert.ok(feature.includes('export function createFactionRenderFeature(deps)'));
assert.ok(feature.includes('function factionCatalogMarkup(faction)'));
assert.ok(feature.includes('function factionOwnedCatalogMarkup(faction, standalone = false, onlyCatalogId = null)'));
assert.ok(feature.includes('function renderFactionMembersPage()'));
assert.ok(feature.includes('function factionContinueReadingMarkup(faction)'));
assert.ok(feature.includes('function factionPinnedCollectionsMarkup(faction)'));
assert.ok(feature.includes('function factionExtraAbafacsMarkup(faction, stats)'));
assert.ok(feature.includes('function renderFactionPage()'));

assert.ok(index.includes('js/app.js?v='), 'index deve usar BUILD_ID no app');
assert.ok(index.includes('sw.js?v='), 'index deve usar BUILD_ID no service worker');
assert.ok(!sw.includes('faction-render-feature.js'));

console.log('PASS faction render split');
