  function seriesDefinitionFor(item) {
    const definition = (window.DEFAULT_SERIES || []).find(series => series.id === item?.seriesId);
    return { ...(definition || {}), ...item, title: definition?.name || item?.seriesTitle || item?.title || "Série", seriesTitle: definition?.name || item?.seriesTitle || item?.title || "Série", coverUrl: definition?.coverUrl || item?.coverUrl || item?.cover || "" };
  }

