import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync('js/app.js', 'utf8');
const feature = readFileSync('js/faction-page-feature.js', 'utf8');
const index = readFileSync('index.html', 'utf8');
const sw = readFileSync('sw.js', 'utf8');

assert.ok(app.includes('import(appAssetUrl("js/faction-page-feature.js?v='));
assert.ok(app.includes('async function applyFactionAbafacOrder(...args)'));
assert.ok(!app.includes('function applyFactionAbafacOrder(factionId)'));

assert.ok(feature.includes('export function createFactionPageFeature(deps)'));
assert.ok(feature.includes('function applyFactionAbafacOrder(factionId)'));
assert.ok(feature.includes('data-faction-abafac'));
assert.ok(feature.includes('openFactionAbafacManager'));
assert.ok(feature.includes('toggleFactionCatalogLike'));

const appAsset = index.match(/<script src="(js\/app\.js\?v=[^"]+)"><\/script>/)?.[1];
assert.ok(appAsset);
assert.ok(sw.includes(`"./${appAsset}"`));
assert.ok(!sw.includes('faction-page-feature.js'));

console.log('PASS faction page split');
