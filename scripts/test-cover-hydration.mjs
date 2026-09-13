import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync('js/app.js', 'utf8');
const declarations = source.slice(source.indexOf('  const coverMemoryCache ='), source.indexOf('  function setReadingMode('));
const hydrate = source.slice(source.indexOf('  function hydrateHomeCovers('), source.indexOf('  function card('));

function setup() {
  const element = (id, hero = false) => ({
    dataset: { coverId: id }, style: { backgroundImage: "" },
    classList: { contains: name => hero && name === 'hero-bg' },
    getBoundingClientRect: () => ({ top: 0, bottom: 200 }),
    matches: () => false,
  });
  const hero = element('hero', true);
  const edition = element('edition');
  const elements = [hero];
  const observers = [];
  let resolveHero;
  const pending = new Promise(resolve => { resolveHero = resolve; });
  class Observer {
    constructor(callback) { this.callback = callback; this.targets = new Set(); observers.push(this); }
    observe(target) { this.targets.add(target); }
    unobserve(target) { this.targets.delete(target); }
    disconnect() { this.targets.clear(); }
  }
  const context = vm.createContext({
    AbortController, console, IntersectionObserver: Observer,
    window: { innerHeight: 900, IntersectionObserver: Observer },
    readerIsOpen: false, lazyCoverObserver: null,
    state: { section: 'home', db: { library: [{ id: 'hero' }, { id: 'edition' }] }, localBoxFiles: [] },
    $$: selector => selector === '[data-cover-id]' ? [...elements] : [],
    coverMaxWidthForViewport: () => 960,
    autoCover: item => item.id === 'hero' ? pending : Promise.resolve('edition-cover'),
  });
  vm.runInContext(declarations + hydrate, context);
  return { context, elements, edition, observers, resolveHero };
}

const flush = () => new Promise(resolve => setImmediate(resolve));

test('opening the edition selector before the hero finishes preserves its cover observer', async () => {
  const { context, elements, edition, observers, resolveHero } = setup();
  context.hydrateHomeCovers();
  elements.push(edition);
  context.hydrateHomeCovers();
  const selectorObserver = observers.at(-1);
  assert.ok(selectorObserver.targets.has(edition));
  resolveHero('hero-cover');
  await flush();
  assert.equal(observers.at(-1), selectorObserver);
  assert.ok(selectorObserver.targets.has(edition));
  selectorObserver.callback([{ target: edition, isIntersecting: true }]);
  await flush();
  assert.equal(edition.style.backgroundImage, 'url("edition-cover")');
});

test('cancelled hydration cannot restart observation after its pending cover finishes', async () => {
  const { context, observers, resolveHero } = setup();
  context.hydrateHomeCovers();
  context.cancelCoverLoads();
  resolveHero('hero-cover');
  await flush();
  assert.equal(observers.length, 0);
});
