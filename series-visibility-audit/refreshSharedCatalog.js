  async function refreshSharedCatalog(options = {}) {
    if (!sb || navigator.onLine === false) return false;
    if (sharedCatalogRefresh) return sharedCatalogRefresh;
    sharedCatalogRefresh = (async () => {
      await BancaCatalogSync.read(sb);
      const merged = BancaCatalogSync.merge(state.db.library);
      const changed = JSON.stringify(merged) !== JSON.stringify(state.db.library);
      if (changed) {
        state.db.library = merged;
        DataStore.save(state.db);
        clearGeneratedCoverCache();
        if (options.renderPage !== false && state.section !== "reader" && !readerIsOpen) render();
      }
      return changed;
    })();
    try { return await sharedCatalogRefresh; }
    finally { sharedCatalogRefresh = null; }
  }

