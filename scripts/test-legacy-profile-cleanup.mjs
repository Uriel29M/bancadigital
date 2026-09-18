import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync('js/app.js', 'utf8');
const feature = readFileSync('js/public-profile-feature.js', 'utf8');
const css = readFileSync('css/style.css', 'utf8');

assert.ok(app.includes('if (!readerId && page === "estante")'), 'URL antiga da estante deve continuar redirecionando');
assert.ok(app.includes('openOwnPublicProfile()'), 'estante antiga deve apontar para o perfil público');

for (const legacy of [
  'function renderShelfPage(',
  'function renderBlogsPage(',
  'function loadBlogPosts(',
  'function renderPublicBlogCollectionPage(',
  'openBlogShelfCollectionForm',
  'deleteBlogShelfCollection',
  'state.section === "shelf"',
  'state.section === "blog"',
  'state.blogPosts',
  'state.blogShelfCategories'
]) {
  assert.ok(!app.includes(legacy), `legado não deve voltar ao app: ${legacy}`);
}

for (const table of ['blog_posts', 'blog_likes', 'blog_comments', 'blog_saves']) {
  assert.ok(!feature.includes(`.from("${table}")`), `perfil público não deve consultar ${table}`);
}

assert.ok(!feature.includes('renderPublicBlogCollectionPage'), 'perfil público não deve renderizar coleções de blogs');
assert.ok(!css.includes('.blog-card'), 'CSS de cards de blog deve permanecer removido');
assert.ok(!css.includes('.blogs-page'), 'CSS da página de blogs deve permanecer removido');
assert.ok(!css.includes('body.blogs-theme'), 'tema de blogs deve permanecer removido');

console.log('PASS legacy shelf/blog cleanup');
