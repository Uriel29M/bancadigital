import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync('js/app.js', 'utf8');
const feature = readFileSync('js/public-profile-feature.js', 'utf8');
const index = readFileSync('index.html', 'utf8');

assert.ok(app.includes('import(appAssetUrl("js/public-profile-feature.js?v=1-public-profile-split"))'), 'perfil público deve carregar sob demanda');
assert.ok(app.includes('async function loadPublicProfile(...args)'), 'wrapper de carregamento deve continuar no app');
assert.ok(app.includes('function renderPublicProfilePage(...args)'), 'wrapper de renderização deve continuar no app');
assert.ok(app.includes('async function toggleProfileFollow(...args)'), 'wrapper de seguir deve continuar no app');
assert.ok(app.includes('async function toggleProfileBlock(...args)'), 'wrapper de bloqueio deve continuar no app');
assert.ok(!app.includes('const PUBLIC_PROFILE_FULL_COLUMNS ='), 'colunas do perfil público devem sair fisicamente do app');
assert.ok(!app.includes('function subscribePublicStickerUpdates(ownerId)'), 'realtime do perfil público deve sair fisicamente do app');
assert.ok(!app.includes('async function loadPublicProfile(username, collectionId = null, album = false, options = {})'), 'implementação do carregamento deve sair fisicamente do app');
assert.ok(!app.includes('function openProfileBlockConfirm(profile, blocked)'), 'confirmação de bloqueio deve sair fisicamente do app');
assert.ok(!app.includes('function renderPublicProfilePage()'), 'implementação de renderização deve sair fisicamente do app');

assert.ok(feature.includes('export function createPublicProfileFeature(deps)'), 'módulo público deve exportar fábrica');
assert.ok(feature.includes('async function loadPublicProfile(username, collectionId = null, album = false, options = {})'), 'módulo deve conter carregamento do perfil');
assert.ok(feature.includes('function renderPublicProfilePage()'), 'módulo deve conter renderização do perfil');
assert.ok(feature.includes('async function toggleProfileFollow(profile)'), 'módulo deve conter seguir/deixar de seguir');
assert.ok(feature.includes('async function toggleProfileBlock(profile)'), 'módulo deve conter bloqueio');
assert.ok(feature.includes('async function deletePublicCollection(ownerId, collectionId)'), 'módulo deve conter exclusão moderada de coleção pública');

assert.ok(index.includes('js/app.js?v=2.2.10.511-public-profile-split'), 'index deve invalidar cache do app novo');
assert.ok(index.includes('sw.js?v=275-public-profile-split'), 'index deve invalidar cache do service worker');

console.log('PASS public profile feature split');
