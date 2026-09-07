
  function seriesCoverFor(item, seriesCoverChoices = null) {
    const activeChoices = seriesCoverChoices || (state.section === "public-profile" ? state.publicProfile?.seriesCoverChoices : state.seriesCoverChoices);
    const selectedCover = activeChoices?.get?.(item?.seriesId)?.cover_url;
    if (selectedCover && !/^assets\/covers\/milestone\//i.test(String(selectedCover))) return proxiedImageUrl(selectedCover);
    return coverFor(item);
  }
