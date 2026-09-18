import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync('js/app.js', 'utf8');
const publicProfile = readFileSync('js/public-profile-feature.js', 'utf8');
const profile = readFileSync('js/profile-feature.js', 'utf8');

assert.ok(!app.includes('function renderBlogsPage('), 'feed/editor de blogs desativado deve sair do app');
assert.ok(!app.includes('function renderShelfPage('), 'estante própria legada deve sair do app');
assert.ok(!app.includes('blog_posts'), 'bootstrap principal não deve consultar blog_posts');
assert.ok(!app.includes('blog_comments'), 'bootstrap principal não deve consultar blog_comments');
assert.ok(!app.includes('blog_saves'), 'bootstrap principal não deve consultar blog_saves');
assert.ok(!publicProfile.includes('blog_posts'), 'perfil público não deve consultar posts de blog');
assert.ok(!publicProfile.includes('blogCollections'), 'perfil público não deve manter coleções de blog');
assert.ok(!profile.includes('shelfBlogsPublic'), 'configurações não devem manter preferência de blogs desativada');
assert.ok(app.includes('if (!readerId && page === "estante")'), 'URL legada de estante deve continuar redirecionando para o perfil público');
assert.ok(app.includes('openOwnPublicProfile();'), 'rota legada deve convergir para o perfil público atual');
assert.ok(app.includes('const hasDynamicShelfContent = state.section === "public-profile";'), 'perfil público deve ser a única superfície dinâmica de estante/perfil');
assert.ok(!app.includes('state.section === "shelf"'), 'nenhuma lógica ativa deve depender da antiga seção shelf');

console.log('PASS dead blogs and legacy shelf cleanup');
