  function navigate(params, replace = false) {
    const offlineNavigation = navigator.onLine === false && activateOfflineMode();
    if (offlineNavigation) params = { pagina: "downloads" };
    const url = routeUrl(params);
    const currentUrl = `${window.location.pathname}${window.location.search}`;
    if (currentUrl === url) {
      if (params?.ler && readerIsOpen && activeReaderCleanup && String(state.readerItemId || "") === String(params.ler)) return;
      return applyRoute();
    }
    const historyState = {
      [ROUTE_HISTORY_KEY]: true,
      [ROUTE_HISTORY_INDEX_KEY]: replace ? currentRouteHistoryIndex() : currentRouteHistoryIndex() + 1,
    };
    if (replace) window.history.replaceState(historyState, "", url);
    else window.history.pushState(historyState, "", url);
    applyRoute();
  }

