import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const indexHtml = readFileSync("index.html", "utf8");
const sw = readFileSync("sw.js", "utf8");
const app = readFileSync("js/app.js", "utf8");
const indexCatalog = readFileSync("js/data/dc-comics/catalog-index.js", "utf8");
const fullCatalog = readFileSync("js/data/dc-comics/recentes.js", "utf8");
const publisher = readFileSync("supabase/functions/github-catalog/index.ts", "utf8");

assert.ok(indexHtml.includes("js/data/dc-comics/catalog-index.js"), "bootstrap deve carregar índice leve");
assert.ok(!indexHtml.includes("js/data/dc-comics/recentes.js"), "catálogo completo não deve entrar no HTML inicial");
assert.ok(sw.includes("js/data/dc-comics/catalog-index.js"), "service worker deve precachear o índice");
assert.ok(!sw.includes("js/data/dc-comics/recentes.js"), "service worker não deve precachear o catálogo completo");
assert.match(indexCatalog, /window\.BANCA_CATALOG_LITE\s*=\s*true/, "índice deve anunciar modo leve");
assert.ok(indexCatalog.length < fullCatalog.length * 0.6, "índice inicial deve ser pelo menos 40% menor que o catálogo completo");
assert.ok(!indexCatalog.includes('"fileUrl":'), "índice não deve conter URLs de arquivo");
assert.ok(!indexCatalog.includes('"telegramFileId":'), "índice não deve conter IDs de arquivo do Telegram");
assert.ok(!indexCatalog.includes('"backupUrls":'), "índice não deve conter fontes de backup");
assert.ok(app.includes('import(appAssetUrl("js/catalog-full-loader.js"))'), "app deve carregar detalhes completos sob demanda");
assert.ok(app.includes("hydrateCatalogItem(item)"), "leitor/download devem hidratar uma edição sob demanda");
assert.ok(publisher.includes("catalogIndexSource"), "publicador deve gerar índice leve junto do catálogo completo");
assert.ok(publisher.includes("writeGitHubFile(repository, branch, indexPath"), "publicador deve gravar o índice no GitHub");

console.log("PASS lazy catalog bootstrap");
