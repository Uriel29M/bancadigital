import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync('js/app.js', 'utf8');
const admin = readFileSync('js/admin-feature.js', 'utf8');
const index = readFileSync('index.html', 'utf8');
const sw = readFileSync('sw.js', 'utf8');

assert.ok(app.includes('import(appAssetUrl("js/admin-feature.js"))'), 'administração deve carregar sob demanda');
assert.ok(app.includes('async function openAdmin(...args)'), 'wrapper openAdmin deve continuar no app');
assert.ok(app.includes('async function openEditForm(...args)'), 'wrapper openEditForm deve continuar no app');
assert.ok(app.includes('async function bindEditionEditButtons(...args)'), 'wrapper dos botões de edição deve continuar no app');
assert.ok(app.includes('async function openSubmission(...args)'), 'wrapper de envio deve continuar no app');
assert.ok(!app.includes('function openAdmin(editId = null)'), 'implementação do painel admin deve sair fisicamente do app');
assert.ok(!app.includes('function bindAdminLinkChecker(overlay)'), 'configuração do verificador de links deve sair fisicamente do app');
assert.ok(!app.includes('function bindAdminAccountRetention(overlay)'), 'retenção de contas deve sair fisicamente do app');
assert.ok(!app.includes('function bindAdminNoveltyBadge(overlay)'), 'configuração da etiqueta novidade deve sair fisicamente do app');
assert.ok(!app.includes('function openEditForm(id = null, initial = null)'), 'formulário de edição deve sair fisicamente do app');

assert.ok(admin.includes('export function createAdminFeature(deps)'), 'módulo admin deve exportar fábrica');
assert.ok(admin.includes('function openAdmin(editId = null)'), 'módulo admin deve conter painel atual');
assert.ok(admin.includes('function bindAdminLinkChecker(overlay)'), 'módulo admin deve conter verificador de links');
assert.ok(admin.includes('function bindAdminAccountRetention(overlay)'), 'módulo admin deve conter retenção');
assert.ok(admin.includes('function bindAdminNoveltyBadge(overlay)'), 'módulo admin deve conter configuração da etiqueta novidade');
assert.ok(admin.includes('function openEditForm(id = null, initial = null)'), 'módulo admin deve conter formulário de edição');
assert.ok(admin.includes('function openSubmission()'), 'módulo admin deve conter envio de quadrinhos');

assert.match(index, /js\/app\.js\?v=2\.2\.10\.513-admin-split/, 'index deve apontar para a versão modular do app');
assert.match(index, /sw\.js\?v=278-admin-split/, 'index deve invalidar o service worker');
assert.ok(!sw.includes('admin-feature.js'), 'módulo admin não deve entrar no precache inicial');

console.log('PASS admin feature split');
