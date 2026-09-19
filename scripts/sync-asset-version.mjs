import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const checkOnly = process.argv.includes("--check");

// Arquivos que definem o runtime visual/funcional da Banca.
// Qualquer alteração aqui gera automaticamente outro BUILD_ID.
const RUNTIME_ASSETS = [
  "css/style.css",
  "js/app.js",
  "js/chat-feature.js",
  "js/profile-feature.js",
  "js/public-profile-feature.js",
  "js/faction-page-feature.js",
  "js/faction-render-feature.js",
  "js/faction-editors-feature.js",
  "js/admin-feature.js",
  "js/sticker-actions-feature.js",
  "js/catalog-full-loader.js",
];

function read(relative) {
  return readFileSync(path.join(root, relative), "utf8");
}

function fnv1a(hash, input) {
  for (let i = 0; i < input.length; i++) {
    const code = input.charCodeAt(i);
    hash ^= code & 0xff;
    hash = Math.imul(hash, 0x01000193) >>> 0;
    if (code > 0xff) {
      hash ^= (code >>> 8) & 0xff;
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }
  }
  return hash >>> 0;
}

function buildId() {
  let hash = 0x811c9dc5 >>> 0;
  for (const relative of RUNTIME_ASSETS) {
    hash = fnv1a(hash, `${relative}\0${read(relative)}\0`);
  }
  return hash.toString(16).padStart(8, "0");
}

function versionHtml(source, id) {
  let output = source;
  const marker = `window.BANCA_BUILD_VERSION = "${id}";`;
  if (/window\.BANCA_BUILD_VERSION\s*=\s*"[^"]*";/.test(output)) {
    output = output.replace(/window\.BANCA_BUILD_VERSION\s*=\s*"[^"]*";/, marker);
  } else {
    output = output.replace(
      /(<meta name="description"[^>]*>)/,
      `$1\n  <script>${marker}</script>`
    );
  }

  output = output.replace(
    /((?:src|href)=")(?!https?:|\/\/|#)([^"]+\.(?:js|css|png|jpe?g|webp|svg))(?:\?v=[^"]*)?(")/gi,
    (_match, prefix, asset, suffix) => `${prefix}${asset}?v=${id}${suffix}`
  );

  output = output.replace(
    /navigator\.serviceWorker\.register\("\.\/sw\.js(?:\?v=[^"]*)?"/,
    `navigator.serviceWorker.register("./sw.js?v=${id}"`
  );
  return output;
}

function versionServiceWorker(source, id) {
  let output = source.replace(
    /const CACHE_VERSION = "[^"]+";/,
    `const CACHE_VERSION = "banca-digital-shell-${id}";`
  );

  const shellMatch = output.match(/const APP_SHELL = \[([\s\S]*?)\n\];/);
  if (!shellMatch) throw new Error("APP_SHELL não encontrado em sw.js");

  const versionedShell = shellMatch[0].replace(
    /("\.\/[^"]+\.(?:js|css|png|jpe?g|webp|svg))(?:\?v=[^"]*)?(")/gi,
    (_match, asset, suffix) => `${asset}?v=${id}${suffix}`
  );
  output = output.replace(shellMatch[0], versionedShell);
  return output;
}

function syncFile(relative, next) {
  const current = read(relative);
  if (current === next) return false;
  if (checkOnly) {
    console.error(`[asset-version] ${relative} está fora de sincronia.`);
    return true;
  }
  writeFileSync(path.join(root, relative), next);
  console.log(`[asset-version] atualizado: ${relative}`);
  return true;
}

const id = buildId();
const app = read("js/app.js");
if (/appAssetUrl\((["'])[^"']+\?v=/.test(app)) {
  console.error("[asset-version] app.js ainda contém versão manual em appAssetUrl().");
  process.exit(1);
}

const indexNext = versionHtml(read("index.html"), id);
const swNext = versionServiceWorker(read("sw.js"), id);
const dirty = [
  syncFile("index.html", indexNext),
  syncFile("sw.js", swNext),
].some(Boolean);

if (checkOnly && dirty) {
  console.error(`[asset-version] BUILD_ID esperado: ${id}. Rode: npm run assets:sync`);
  process.exit(1);
}

console.log(`[asset-version] BUILD_ID=${id}${checkOnly ? " (sincronizado)" : ""}`);
