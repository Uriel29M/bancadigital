import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync('js/app.js', 'utf8');
const profile = readFileSync('js/profile-feature.js', 'utf8');
const index = readFileSync('index.html', 'utf8');

assert.ok(app.includes('import(appAssetUrl("js/profile-feature.js?v=1-profile-split"))'), 'perfil deve carregar sob demanda');
assert.ok(app.includes('async function openProfileSettings(...args)'), 'wrapper de configurações deve continuar no app');
assert.ok(app.includes('async function openProfileStickerPicker(...args)'), 'wrapper da figurinha deve continuar no app');
assert.ok(app.includes('async function toggleProfileDisplaySticker(...args)'), 'wrapper das figurinhas expostas deve continuar no app');
assert.ok(!app.includes('function askDeleteAccountConfirmation()'), 'confirmação de exclusão deve sair fisicamente do app');
assert.ok(!app.includes('async function deleteAccount()'), 'exclusão da conta deve sair fisicamente do app');
assert.ok(!app.includes('function openProfileSettings() {'), 'implementação de configurações deve sair fisicamente do app');
assert.ok(!app.includes('function openProfileStickerPicker() {'), 'implementação do seletor deve sair fisicamente do app');
assert.ok(!app.includes('async function toggleProfileDisplaySticker(button)'), 'implementação das figurinhas expostas deve sair fisicamente do app');

assert.ok(profile.includes('export function createProfileFeature(deps)'), 'módulo de perfil deve exportar fábrica');
assert.ok(profile.includes('function openProfileSettings()'), 'módulo deve conter configurações do perfil');
assert.ok(profile.includes('function openProfileStickerPicker()'), 'módulo deve conter seletor de figurinha');
assert.ok(profile.includes('async function toggleProfileDisplaySticker(button)'), 'módulo deve conter controle das figurinhas expostas');
assert.ok(profile.includes('async function deleteAccount()'), 'módulo deve conter exclusão da conta');

assert.match(index, /js\/app\.js\?v=[^\"']+/, 'index deve manter cache-busting do app');
assert.match(index, /sw\.js\?v=[^\"']+/, 'index deve manter cache-busting do service worker');

console.log('PASS profile feature split');
