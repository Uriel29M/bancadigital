let catalogPromise = null;

function parseJsonAssignment(source, name, nextName) {
  const marker = `window.${name} = `;
  const start = source.indexOf(marker);
  if (start < 0) throw new Error(`Catálogo sem ${name}.`);
  const jsonStart = source.indexOf("[", start + marker.length);
  const endMarker = `;\nwindow.${nextName}`;
  const jsonEnd = source.indexOf(endMarker, jsonStart);
  if (jsonStart < 0 || jsonEnd < 0) throw new Error(`Catálogo inválido em ${name}.`);
  return JSON.parse(source.slice(jsonStart, jsonEnd));
}

function parseScalarAssignment(source, name, fallback = null) {
  const marker = `window.${name} = `;
  const start = source.indexOf(marker);
  if (start < 0) return fallback;
  const end = source.indexOf(";\n", start + marker.length);
  if (end < 0) return fallback;
  try { return JSON.parse(source.slice(start + marker.length, end)); }
  catch { return fallback; }
}

async function fetchCatalog() {
  const url = new URL("js/data/dc-comics/recentes.js", document.baseURI);
  if (window.CATALOG_VERSION) url.searchParams.set("v", String(window.CATALOG_VERSION));
  const response = await fetch(url, { cache: "no-store", credentials: "same-origin" });
  if (!response.ok) throw new Error(`Catálogo completo indisponível (HTTP ${response.status}).`);
  const source = await response.text();
  const series = parseJsonAssignment(source, "DEFAULT_SERIES", "DEFAULT_LIBRARY");
  const library = parseJsonAssignment(source, "DEFAULT_LIBRARY", "DEFAULT_COLLECTIONS");
  const collections = parseJsonAssignment(source, "DEFAULT_COLLECTIONS", "__CATALOG_END__");
  return {
    version: parseScalarAssignment(source, "CATALOG_VERSION", ""),
    removedItemIds: parseScalarAssignment(source, "REMOVED_DEFAULT_ITEM_IDS", []),
    series,
    library,
    collections,
    byId: new Map(library.map(item => [String(item.id), item]))
  };
}

function parseCollectionsFallback(source) {
  const marker = "window.DEFAULT_COLLECTIONS = ";
  const start = source.indexOf(marker);
  if (start < 0) return [];
  const jsonStart = source.indexOf("[", start + marker.length);
  const jsonEnd = source.indexOf("];", jsonStart);
  if (jsonStart < 0 || jsonEnd < 0) return [];
  return JSON.parse(source.slice(jsonStart, jsonEnd + 1));
}

async function loadFullCatalog() {
  if (!catalogPromise) {
    catalogPromise = (async () => {
      const url = new URL("js/data/dc-comics/recentes.js", document.baseURI);
      if (window.CATALOG_VERSION) url.searchParams.set("v", String(window.CATALOG_VERSION));
      const response = await fetch(url, { cache: "no-store", credentials: "same-origin" });
      if (!response.ok) throw new Error(`Catálogo completo indisponível (HTTP ${response.status}).`);
      const source = await response.text();
      const series = parseJsonAssignment(source, "DEFAULT_SERIES", "DEFAULT_LIBRARY");
      const library = parseJsonAssignment(source, "DEFAULT_LIBRARY", "DEFAULT_COLLECTIONS");
      return {
        version: parseScalarAssignment(source, "CATALOG_VERSION", ""),
        removedItemIds: parseScalarAssignment(source, "REMOVED_DEFAULT_ITEM_IDS", []),
        series,
        library,
        collections: parseCollectionsFallback(source),
        byId: new Map(library.map(item => [String(item.id), item]))
      };
    })().catch(error => {
      catalogPromise = null;
      throw error;
    });
  }
  return catalogPromise;
}

function applyCanonicalOverride(item) {
  const id = String(item?.id || "");
  const record = window.BancaCatalogSync?.rows?.get?.(id);
  if (!record?.edition) return item;
  return window.BancaCatalogSync.applyEdition(item, record.edition);
}

export async function hydrateCatalogItem(item) {
  if (!item?.id || item.local) return item;
  const catalog = await loadFullCatalog();
  const full = catalog.byId.get(String(item.id));
  if (!full) return applyCanonicalOverride(item);
  return applyCanonicalOverride({ ...full, ...item });
}

export async function hydrateCatalogLibrary(items = []) {
  const catalog = await loadFullCatalog();
  return (items || []).map(item => {
    const full = catalog.byId.get(String(item?.id || ""));
    return applyCanonicalOverride(full ? { ...full, ...item } : item);
  });
}

export { loadFullCatalog };
