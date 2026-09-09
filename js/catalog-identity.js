/* Preserve the verified identity of the 2011 Aves de Rapina run. */
(() => {
  const seriesId = "series-aves-de-rapina-2011-novos-52";
  const issueId = /^series-aves-de-rapina-2011-novos-52-(00[1-9]|01[0-9]|02[0-8])$/;
  function normalize(item) {
    if (!item || !issueId.test(String(item.id || ""))) return item;
    if (item.seriesId === seriesId) return item;
    return { ...item, seriesId };
  }
  function normalizeLibrary(library) {
    return Array.isArray(library) ? library.map(normalize) : library;
  }
  window.DEFAULT_LIBRARY = normalizeLibrary(window.DEFAULT_LIBRARY);
  if (window.PUBLISHED_CATALOG) {
    window.PUBLISHED_CATALOG.library = normalizeLibrary(window.PUBLISHED_CATALOG.library);
  }
  window.BancaCatalogIdentity = { normalize, normalizeLibrary };
})();
