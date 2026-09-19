import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync('js/app.js', 'utf8');
const feature = readFileSync('js/faction-editors-feature.js', 'utf8');
const index = readFileSync('index.html', 'utf8');
const sw = readFileSync('sw.js', 'utf8');

assert.ok(app.includes('import(appAssetUrl("js/faction-editors-feature.js"))'));
assert.ok(app.includes('async function openFactionIdentityEditorV2(...args)'));
assert.ok(app.includes('async function openFactionAbafacAddEditor(...args)'));
assert.ok(app.includes('async function openFactionCatalogEditor(...args)'));
assert.ok(app.includes('async function openFactionManifestEditor(...args)'));
assert.ok(app.includes('async function openFactionMuralEditor(...args)'));
assert.ok(app.includes('async function openFactionChoice(...args)'));

assert.ok(!app.includes('function openFactionIdentityEditorV2(faction)'));
assert.ok(!app.includes('function openFactionAbafacAddEditor()'));
assert.ok(!app.includes('function openFactionCatalogEditor(factionId, existing = null)'));
assert.ok(!app.includes('function openFactionManifestEditor(faction)'));
assert.ok(!app.includes('function openFactionMuralEditor(faction)'));
assert.ok(!app.includes('function openFactionChoice()'));

assert.ok(feature.includes('export function createFactionEditorsFeature(deps)'));
assert.ok(feature.includes('function openFactionIdentityEditorV2(faction)'));
assert.ok(feature.includes('function openFactionAbafacAddEditor()'));
assert.ok(feature.includes('function openFactionCatalogEditor(factionId, existing = null)'));
assert.ok(feature.includes('function openFactionManifestEditor(faction)'));
assert.ok(feature.includes('function openFactionMuralEditor(faction)'));
assert.ok(feature.includes('function openFactionChoice()'));

assert.ok(index.includes('js/app.js?v='), 'index deve usar BUILD_ID no app');
assert.ok(index.includes('sw.js?v='), 'index deve usar BUILD_ID no service worker');
assert.ok(!sw.includes('faction-editors-feature.js'));

console.log('PASS faction editors split');
