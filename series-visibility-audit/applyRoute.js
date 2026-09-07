  function applyRoute() {
    cancelCoverLoads();
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    const params = new URLSearchParams(window.location.search);
    const readerId = params.get("ler");
    const page = params.get("pagina") || "";
    if (!readerId && page === "estante") {
      if (!state.authReady) return;
      if (state.session?.user && state.profile?.username) openOwnPublicProfile();
      else openAuthPage();
      return;
    }
    const section = params.get("colecao") ? "collection" : Object.keys(sectionRoutes).find(key => sectionRoutes[key] === page) || "home";
    const item = readerId ? state.db.library.find(entry => entry.id === readerId) : null;

    // Eventos repetidos de clique, autenticação ou histórico podem reaplicar
    // a mesma rota enquanto o PDF ainda carrega. Preserve o leitor existente
    // em vez de destruí-lo e iniciar outra transferência do mesmo arquivo.
    if (readerId && item && readerIsOpen && activeReaderCleanup && String(state.readerItemId || "") === String(readerId) && document.querySelector(".reader-overlay")) {
      state.section = "reader";
      return;
    }

    activeReaderCleanup?.();
    activeReaderCleanup = null;
    handlingRoute = true;
    const profileUsername = params.get("perfil");
    if (!readerId && profileUsername) {
      loadPublicProfile(profileUsername, params.get("lista") || null, params.get("album") === "1", { top10ListId: params.get("lista_top10") || null });
      handlingRoute = false;
      return;
    }
    if (readerId && item) {
      state.section = "reader";
      state.readerItemId = readerId;
      render();
      openReader(item, { routeSync: true });
    } else {
      const previousSection = state.section;
      state.section = section;
      if (previousSection === "entity" && section !== "entity") characterNewsCache?.clear();
      if (section === "home" && previousSection !== "home") {
        state.homeRandomPublisher = null;
        state.homeRandomCharacter = null;
      }
      state.collectionId = params.get("colecao") || null;
      state.rankingCategory = section === "ranking" ? params.get("categoria") || null : null;
      const factionRouteValue = section === "factions" ? params.get("faccao") || null : null;
      const routedFaction = factionRouteValue ? state.factions.find(faction => String(faction.page_key) === String(factionRouteValue) || faction.id === factionRouteValue) : null;
      state.factionPageId = routedFaction?.id || factionRouteValue;
      state.factionCatalogId = section === "factions" ? params.get("catalogo") || null : null;
      state.stickerAlbumView = section === "album" || params.get("album") === "1" ? "album" : "album";
      state.factionMembersView = section === "factions" && params.get("membros") === "1";
      state.factionMemberSearch = state.factionMembersView ? params.get("busca") || "" : "";
      if (section === "blog") state.blogOpenId = params.get("blog") || null;
      if (section === "search") state.search = params.get("q") || "";
      if (section === "entity") state.entityFilter = { kind: params.get("tipo") || "character", value: params.get("valor") || "" };
      render();
      if (section === "search") loadSearchUsers(state.search);
      if (section === "blog" && !state.blogPosts.length) loadBlogPosts();
      if (section === "ranking" && state.authReady) loadRankingData();
      if (section === "ranking" && params.get("secao") === "faccoes") setTimeout(() => $(".ranking-faction-overview")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
    }
    handlingRoute = false;
  }

  const sb = window.supabase?.createClient && window.BANCA_SUPABASE_URL
    ? window.supabase.createClient(window.BANCA_SUPABASE_URL, window.BANCA_SUPABASE_KEY)
    : null;

