
  function seriesEditions(item) {
    if (!item?.seriesId) return [];
    const current = visibleCatalogItems().filter(x => x.seriesId === item.seriesId);
    const uniqueCurrent = [...new Map(current.map(entry => [entry.id, entry])).values()];
    if (uniqueCurrent.length !== current.length) {
      state.db.library = [
        ...state.db.library.filter(entry => entry.seriesId !== item.seriesId),
        ...uniqueCurrent
      ];
      DataStore.save(state.db);
    }
    if (item.seriesId === "series-shazam-2023") {
      const defaults = (window.DEFAULT_LIBRARY || []).filter(entry => entry.seriesId === item.seriesId);
      const currentById = new Map(uniqueCurrent.map(entry => [entry.id, entry]));
      const reconciled = defaults.map(entry => ({ ...structuredClone(entry), ...(currentById.get(entry.id) || {}) }));
      const extras = uniqueCurrent.filter(entry => !defaults.some(defaultEntry => defaultEntry.id === entry.id));
      if (reconciled.length !== uniqueCurrent.length || reconciled.some((entry, index) => entry.id !== uniqueCurrent[index]?.id)) {
        state.db.library = [
          ...state.db.library.filter(entry => entry.seriesId !== item.seriesId),
          ...reconciled,
          ...extras
        ];
        DataStore.save(state.db);
      }
      return visibleCatalogItems([...reconciled, ...extras]).sort((a, b) => issueSortValue(a) - issueSortValue(b));
    }
    return visibleCatalogItems(uniqueCurrent)
      .sort((a, b) => issueSortValue(a) - issueSortValue(b));
  }
