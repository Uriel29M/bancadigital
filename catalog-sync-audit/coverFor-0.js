  function coverFor(item, variant = "card", coverChoices = null) {
    // A capa local aparece imediatamente; a capa real substitui-a quando terminar de carregar.
    if (!item) return instantCover({ title: "HQ" });
    const localCover = [item.coverUrl, item.selectedCoverUrl, item.cover].find(value => /^data:/i.test(String(value || "")));
    if (localCover) return localCover;
    const cachedCover = state.offlineCoverData?.get?.(String(item.id));
    if (cachedCover && (state.session?.offline || navigator.onLine === false)) return cachedCover;
    if (state.session?.offline) return instantCover(item);
    // O hero já é conhecido no primeiro render: libere sua capa imediatamente.
    if (variant === "hero" || variant === "hero-background") {
      const earlyBlockedGcdCover = value => /^https:\/\/files1\.comics\.org\//i.test(String(value || ""));
      const earlyDefaultItemCover = (window.DEFAULT_LIBRARY || []).find(entry => entry.id === item.id)?.coverUrl;
      const earlyDefaultCover = /^assets\/covers\/milestone\//i.test(String(item.coverUrl || "")) || earlyBlockedGcdCover(item.coverUrl)
        ? earlyDefaultItemCover
        : item.coverUrl;
      const earlyHeroCover = variant === "hero" ? item.featuredCoverUrl || earlyDefaultCover || item.cover : earlyDefaultCover || item.cover;
      if (earlyHeroCover && !/^data:/i.test(String(earlyHeroCover)) && !earlyBlockedGcdCover(earlyHeroCover)) return proxiedImageUrl(earlyHeroCover);
    }
    // Antes de a sessão e as preferências serem carregadas, não mostre a capa
    // padrão: ela seria substituída depois pela variante escolhida.
    if (!state.authReady) return instantCover(item);
    const activeChoices = coverChoices || (state.section === "public-profile" ? state.publicProfile?.coverChoices : state.coverChoices);
    const previewChoice = state.previewCoverChoices?.get?.(item.id) || state.previewCoverChoices?.get?.(String(item.id));
    const selectedCover = previewChoice
      ? (previewChoice.cover_url || item.coverUrl || item.cover)
      : (activeChoices?.get?.(item.id) || activeChoices?.get?.(String(item.id)))?.cover_url;
    const isBlockedGcdCover = value => /^https:\/\/files1\.comics\.org\//i.test(String(value || ""));
    if (variant !== "hero-background" && selectedCover && !/^assets\/covers\/milestone\//i.test(String(selectedCover)) && !isBlockedGcdCover(selectedCover)) return proxiedImageUrl(selectedCover);
    if (variant === "hero" && item.featuredCoverUrl) return proxiedImageUrl(item.featuredCoverUrl);
    const defaultItemCover = (window.DEFAULT_LIBRARY || []).find(entry => entry.id === item.id)?.coverUrl;
    const defaultCover = /^assets\/covers\/milestone\//i.test(String(item.coverUrl || "")) || isBlockedGcdCover(item.coverUrl)
      ? defaultItemCover
      : item.coverUrl;
    if (defaultCover) return proxiedImageUrl(defaultCover);
    if (item.cover) return proxiedImageUrl(item.cover); // backward compatibility
    return instantCover(item);
  }

