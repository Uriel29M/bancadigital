import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync('js/app.js', 'utf8');
const chat = readFileSync('js/chat-feature.js', 'utf8');
const index = readFileSync('index.html', 'utf8');

assert.ok(app.includes('import(appAssetUrl("js/chat-feature.js?v=1-chat-split"))'), 'chat deve carregar sob demanda');
assert.ok(app.includes('async function openChat(...args)'), 'wrapper openChat deve continuar no app');
assert.ok(app.includes('async function openChatRoom(...args)'), 'wrapper openChatRoom deve continuar no app');
assert.ok(!app.includes('function setupChatModerationUI('), 'moderação do chat deve sair fisicamente do app');
assert.ok(!app.includes('function askChatMuteDuration('), 'diálogos específicos do chat devem sair fisicamente do app');
assert.ok(!app.includes('function chatMessageMarkup('), 'renderização de mensagens deve sair fisicamente do app');

assert.ok(chat.includes('export function createChatFeature(deps)'), 'módulo de chat deve exportar fábrica');
assert.ok(chat.includes('function setupChatModerationUI('), 'módulo deve conter moderação');
assert.ok(chat.includes('async function openChatRoom('), 'módulo deve conter salas');
assert.ok(chat.includes('async function openChat('), 'módulo deve conter mensagens privadas');

assert.match(index, /js\/app\.js\?v=[^\"']+/, 'index deve manter cache-busting do app');

console.log('PASS chat feature split');
