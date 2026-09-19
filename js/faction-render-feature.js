export function createFactionRenderFeature(deps) {
  const {
    CHAT_ROOMS,
    SHELF_SORT_OPTIONS,
    avatarMarkup,
    canChooseFaction,
    card,
    catalogAddedTimestamp,
    characterNames,
    coverFor,
    escapeHTML,
    factionOverviewMarkup,
    factionRouteKey,
    globalRecommendation,
    globalRecommendationCard,
    instantCover,
    isRedirectedCharacter,
    isTeamCharacter,
    itemDisplayTitle,
    personalizedRecommendations,
    proxiedImageUrl,
    publicProfileHref,
    publisherKey,
    rail,
    readArtistSeriesRecommendation,
    recommendationPeriodKeys,
    routeUrl,
    save,
    seriesCard,
    sortShelfItems,
    state,
    uniqueCatalogItems,
    visibleCatalogItems,
    weightedRandom
  } = deps;

  function factionCatalogMarkup(faction) {
    return [...state.factionAbafacCatalogs.entries()].filter(([, catalog]) => catalog.faction_id === faction.id).map(([key, catalog]) => {
      const ids = Array.isArray(catalog.item_ids) ? catalog.item_ids.map(String) : [];
      const items = ids.map(id => state.db.library.find(item => String(item.id) === id)).filter(Boolean);
      const collectionContext = { id: catalog.id, ownerId: catalog.owner_id, coverStyles: new Map(Object.entries(catalog.cover_styles || {})), coverChoices: new Map(Object.entries(catalog.cover_choices || {})) };
      const creatorHref = publicProfileHref(catalog.username, catalog.id);
      return `<section class="section faction-catalog-abafac" data-faction-abafac="${escapeHTML(key)}" style="--faction-color:${escapeHTML(faction.color)}"><div class="section-head"><div><div class="eyebrow">Catálogo público</div><h2 class="section-title">${escapeHTML(catalog.name)}</h2><div class="section-subtitle">Coleção de <a class="faction-catalog-creator" href="${escapeHTML(creatorHref)}">@${escapeHTML(catalog.username)}</a> · ${items.length} item(ns)</div></div></div><div class="rail-viewport faction-catalog-carousel"><div class="rail faction-catalog-rail">${items.map(item => card(item, state.readingProgress, state.favoriteIds, false, null, false, collectionContext)).join("") || '<div class="empty">Nenhuma edição nesta coleção pública.</div>'}</div></div></section>`;
    }).join("");
  }

  function factionOwnedCatalogMarkup(faction, standalone = false, onlyCatalogId = null) {
    return state.factionCatalogs.filter(catalog => catalog.faction_id === faction.id && (onlyCatalogId === null || String(catalog.id) === String(onlyCatalogId))).map(catalog => {
      const ids = Array.isArray(catalog.item_ids) ? catalog.item_ids.map(String) : [];
      const items = sortShelfItems(ids.map(id => state.db.library.find(item => String(item.id) === id)).filter(Boolean), catalog.sort_order || "added_desc");
      const key = `faction-catalog:${catalog.id}`;
      const factionHref = `?pagina=faccoes&faccao=${encodeURIComponent(factionRouteKey(faction.id))}&catalogo=${encodeURIComponent(catalog.id)}`;
      const role = state.factionRoles.find(item => item.faction_id === faction.id && item.user_id === state.session?.user?.id);
      const canManage = ["leader", "curator"].includes(role?.role);
      const isFactionPinned = state.factionPinnedCollections.has(`${faction.id}:${catalog.id}`);
      const manageActions = canManage ? `<button type="button" class="small-btn ${isFactionPinned ? "is-liked" : ""}" data-faction-catalog-pin="${catalog.id}" data-faction-catalog-pinned="${isFactionPinned ? "true" : "false"}">${isFactionPinned ? "★ Destaque da facção" : "☆ Destacar na facção"}</button><button type="button" class="small-btn" data-faction-catalog-edit-inline="${catalog.id}">Editar</button><button type="button" class="small-btn danger" data-faction-catalog-delete="${catalog.id}">Excluir</button><label class="shelf-sort-control"><span>Ordenar</span><select data-faction-catalog-sort="${catalog.id}">${SHELF_SORT_OPTIONS.map(([value, label]) => `<option value="${value}" ${catalog.sort_order === value ? "selected" : ""}>${label}</option>`).join("")}</select></label>` : "";
      const catalogKey = String(catalog.id);
      const isLiked = state.factionCatalogLikeIds.has(catalogKey);
      const likes = state.factionCatalogLikeCounts.get(catalogKey) || 0;
      const isSaved = state.factionCatalogSaveIds.has(catalogKey);
      const actions = standalone
        ? `<div class="shelf-section-actions"><button type="button" class="small-btn ${isSaved ? "is-liked" : ""}" data-faction-catalog-save="${catalog.id}">${isSaved ? "★ Salvo" : "☆ Salvar"}</button><button type="button" class="small-btn ${isLiked ? "is-liked" : ""}" data-faction-catalog-like="${catalog.id}">${isLiked ? "♥ Curtido" : "♡ Curtir"} · ${likes}</button><a class="small-btn" href="?pagina=faccoes&faccao=${encodeURIComponent(factionRouteKey(faction.id))}">Ver facção</a>${manageActions}</div>`
        : `<div class="shelf-section-actions"><a class="small-btn" href="${escapeHTML(factionHref)}">Abrir</a><button type="button" class="small-btn" data-faction-catalog-share="${catalog.id}">Compartilhar</button>${manageActions}</div>`;
      const content = standalone ? `<div class="results-grid faction-owned-catalog-grid">${items.map(item => card(item, state.readingProgress, state.favoriteIds, false)).join("") || '<div class="empty">Nenhuma edição foi adicionada ao catálogo.</div>'}</div>` : `<div class="rail-viewport faction-catalog-carousel"><div class="rail faction-catalog-rail">${items.map(item => card(item, state.readingProgress, state.favoriteIds, false)).join("") || '<div class="empty">Nenhuma edição foi adicionada ao catálogo.</div>'}</div></div>`;
      return `<section class="section faction-catalog-abafac faction-owned-catalog-abafac" data-faction-abafac="${escapeHTML(key)}" style="--faction-color:${escapeHTML(faction.color)}"><div class="section-head"><div><div class="eyebrow">Catálogo da facção</div><h2 class="section-title">${escapeHTML(catalog.name)}</h2><div class="section-subtitle">${items.length} edição(ões) escolhida(s) pela liderança.</div></div>${actions}</div>${catalog.cover_url ? `<div class="faction-owned-catalog-cover" style="background-image:url('${escapeHTML(catalog.cover_url)}')"></div>` : ""}${content}</section>`;
    }).join("");
  }

  function renderFactionCatalogPage(faction, catalog) {
    return `<div class="content faction-page faction-detail-page faction-catalog-page" style="--faction-color:${escapeHTML(faction.color)}"><div class="section-head"><div><div class="eyebrow">Catálogo da facção · ${escapeHTML(faction.name)}</div><h1 class="section-title">${escapeHTML(catalog.name)}</h1><div class="section-subtitle">Edições escolhidas pela liderança da facção.</div></div><a class="small-btn" href="?pagina=faccoes&faccao=${encodeURIComponent(factionRouteKey(faction.id))}">Voltar à facção</a></div>${factionOwnedCatalogMarkup(faction, true, catalog.id)}</div>`;
  }

  function factionMembersResultsMarkup(factionId, search = "") {
    const roles = state.factionRoleMembers.filter(item => item.faction_id === factionId);
    const query = String(search || "").trim().toLocaleLowerCase("pt-BR");
    const members = state.factionMembers
      .filter(item => item.faction_id === factionId && item.profile)
      .filter(item => {
        if (!query) return true;
        const text = `${item.profile.username || ""} ${item.profile.title || ""}`.toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return text.includes(query.normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
      })
      .sort((a, b) => new Date(b.joined_at || 0) - new Date(a.joined_at || 0));
    return members.map(member => {
      const role = roles.find(item => item.user_id === member.user_id);
      const roleLabel = role ? role.role === "leader" ? "Líder" : `Curador ${role.slot}` : "Membro";
      return `<article class="faction-member-card" style="--faction-color:${escapeHTML(state.factions.find(faction => faction.id === factionId)?.color || "#e85b68")}">${avatarMarkup(member.profile, "faction-member-avatar")}<div><strong>@${escapeHTML(member.profile.username)}</strong>${member.profile.title ? `<small>${escapeHTML(member.profile.title)}</small>` : ""}<span class="faction-member-role">${roleLabel}</span></div></article>`;
    }).join("") || '<div class="empty">Nenhum membro corresponde à busca.</div>';
  }

  function renderFactionMembersPage() {
    const faction = state.factions.find(item => item.id === state.factionPageId);
    if (!faction) return renderFactionPage();
    const total = state.factionMembers.filter(item => item.faction_id === faction.id).length;
    return `<div class="content faction-page faction-members-directory" style="--faction-color:${escapeHTML(faction.color)}"><div class="section-head"><div><div class="eyebrow">${escapeHTML(faction.emblem)} ${escapeHTML(faction.name)}</div><h1 class="section-title">Todos os membros</h1><div class="section-subtitle">${total} membro(s) · os mais recentes aparecem primeiro.</div></div><button class="small-btn" data-faction-members-back>Voltar à facção</button></div><section class="section"><label class="ranking-user-search-wrap"><span>Pesquisar membro</span><input id="faction-member-search-input" class="ranking-user-search" type="search" data-faction-members-search value="${escapeHTML(state.factionMemberSearch)}" placeholder="Nome ou título..." autocomplete="off"></label><div class="faction-member-directory-grid" data-faction-member-results>${factionMembersResultsMarkup(faction.id, state.factionMemberSearch)}</div></section></div>`;
  }

  function factionContinueReadingMarkup(faction) {
    const publisher = String(faction.publisher_name || "").trim().toLocaleLowerCase("pt-BR");
    const progressRecentIds = [...state.readingProgress.entries()].filter(([, progress]) => progress?.updated_at && !progress.completed).sort(([, a], [, b]) => new Date(b.updated_at) - new Date(a.updated_at)).map(([itemId]) => String(itemId));
    const ids = [...new Set([...state.recentlyOpenedIds, ...progressRecentIds])];
    const items = ids.map(id => state.db.library.find(item => String(item.id) === id)).filter(item => item && !state.readingProgress.get(item.id)?.completed && (!publisher || String(item.publisher || "").trim().toLocaleLowerCase("pt-BR") === publisher)).slice(0, 6);
    const body = items.length ? `<div class="rail-viewport"><div class="rail">${items.map(item => card(item, state.readingProgress, state.favoriteIds, true)).join("")}</div></div>` : '<div class="empty">Você ainda não tem uma leitura em andamento nesta facção.</div>';
    const subtitle = publisher ? `Suas leituras em andamento da editora ${escapeHTML(faction.publisher_name)}.` : "Suas leituras em andamento, dentro da facção.";
    return `<section class="section faction-extra-abafac faction-continue-reading-abafac" data-faction-abafac="continue-reading" style="--faction-color:${escapeHTML(faction.color)}"><div class="section-head"><div><div class="eyebrow">Leitura</div><h2 class="section-title">Continue de onde parou</h2><div class="section-subtitle">${subtitle}</div></div></div>${body}</section>`;
  }

  function factionRecentlyAddedMarkup(faction) {
    const publisher = String(faction.publisher_name || "").trim().toLocaleLowerCase("pt-BR");
    const items = state.db.library
      .filter(item => !publisher || String(item.publisher || "").trim().toLocaleLowerCase("pt-BR") === publisher)
      .map((item, index) => ({ item, index, addedAt: catalogAddedTimestamp(item) }))
      .sort((a, b) => b.addedAt - a.addedAt || a.index - b.index)
      .slice(0, 6)
      .map(entry => entry.item);
    const body = items.length ? `<div class="rail-viewport"><div class="rail">${items.map(item => card(item, state.readingProgress, state.favoriteIds, true)).join("")}</div></div>` : '<div class="empty">Nenhuma edição recente disponível para esta facção.</div>';
    const subtitle = publisher ? `As edições mais novas da editora ${escapeHTML(faction.publisher_name)}.` : "As edições mais novas disponíveis na banca.";
    return `<section class="section faction-extra-abafac faction-recently-added-abafac" data-faction-abafac="recently-added" style="--faction-color:${escapeHTML(faction.color)}"><div class="section-head"><div><div class="eyebrow">Catálogo</div><h2 class="section-title">Adicionados recentemente</h2><div class="section-subtitle">${subtitle}</div></div></div>${body}</section>`;
  }

  function factionFeaturedCharacterMarkup(faction) {
    const publisher = String(faction.publisher_name || "").trim().toLocaleLowerCase("pt-BR");
    const groups = new Map();
    visibleCatalogItems().filter(item => !item.local && (!publisher || String(item.publisher || "").trim().toLocaleLowerCase("pt-BR") === publisher) && characterNames(item).length).forEach(item => {
      const character = characterNames(item)[0];
      if (!groups.has(character)) groups.set(character, []);
      groups.get(character).push(item);
    });
    const characters = [...groups.keys()];
    if (!characters.length) return '<section class="section faction-extra-abafac faction-featured-character-abafac" data-faction-abafac="featured-character"><div class="empty">Nenhum personagem disponível para destacar.</div></section>';
    state.factionFeaturedCharacters ||= {};
    if (!characters.includes(state.factionFeaturedCharacters[faction.id])) state.factionFeaturedCharacters[faction.id] = weightedRandom(characters);
    const character = state.factionFeaturedCharacters[faction.id];
    const editions = groups.get(character) || [];
    const representative = editions.slice().sort((a, b) => Number(b.clicks) - Number(a.clicks))[0] || editions[0];
    const subtitle = publisher ? `Explore as edições de ${escapeHTML(character)} publicadas por ${escapeHTML(faction.publisher_name)}.` : `Explore as edições de ${escapeHTML(character)} disponíveis na banca.`;
    return `<section class="section faction-extra-abafac faction-featured-character-abafac" data-faction-abafac="featured-character" style="--faction-color:${escapeHTML(faction.color)}"><div class="section-head"><div><div class="eyebrow">Curadoria</div><h2 class="section-title">Personagem em destaque</h2><div class="section-subtitle">${subtitle}</div></div></div><div class="character-banner-section" data-entity-kind="character" data-entity-value="${escapeHTML(character)}" role="link" tabindex="0" aria-label="Ver todas as edições de ${escapeHTML(character)}"><div class="character-banner-bg" style="background-image:url('${escapeHTML(coverFor(representative, "hero"))}')"></div><div class="character-banner-overlay"></div><div class="character-banner-content"><div class="eyebrow">Personagem em destaque</div><h2>${escapeHTML(character)}</h2><p>${editions.length} ${editions.length === 1 ? "edição disponível" : "edições disponíveis"} para explorar.</p><span class="character-banner-cta">Ver todas as edições <b>→</b></span></div><div class="character-banner-spark">✦</div></div></section>`;
  }

  function factionNewSeriesMarkup(faction) {
    const publisher = String(faction.publisher_name || "").trim().toLocaleLowerCase("pt-BR");
    const series = new Map();
    state.db.library.filter(item => item.seriesId && (!publisher || String(item.publisher || "").trim().toLocaleLowerCase("pt-BR") === publisher)).forEach((item, index) => {
      const current = series.get(item.seriesId);
      const addedAt = catalogAddedTimestamp(item);
      if (!current || addedAt > current.addedAt) series.set(item.seriesId, { item, addedAt, index });
    });
    const items = [...series.values()].sort((a, b) => b.addedAt - a.addedAt || a.index - b.index).slice(0, 6).map(entry => entry.item);
    const body = items.length ? `<div class="rail-viewport"><div class="rail">${items.map(item => seriesCard(item)).join("")}</div></div>` : '<div class="empty">Nenhuma série nova disponível para esta facção.</div>';
    const subtitle = publisher ? `As séries adicionadas mais recentemente da editora ${escapeHTML(faction.publisher_name)}.` : "As séries adicionadas mais recentemente à banca.";
    return `<section class="section faction-extra-abafac faction-new-series-abafac" data-faction-abafac="new-series" style="--faction-color:${escapeHTML(faction.color)}"><div class="section-head"><div><div class="eyebrow">Catálogo</div><h2 class="section-title">Séries novas</h2><div class="section-subtitle">${subtitle}</div></div></div>${body}</section>`;
  }

  function factionMostReadMonthMarkup(faction) {
    const publisher = String(faction.publisher_name || "").trim().toLocaleLowerCase("pt-BR");
    const monthlyReadCount = item => state.comicMonthlyReadCounts.get(String(item.id)) || 0;
    const items = state.db.library.filter(item => !publisher || String(item.publisher || "").trim().toLocaleLowerCase("pt-BR") === publisher).sort((a, b) => monthlyReadCount(b) - monthlyReadCount(a) || itemDisplayTitle(a).localeCompare(itemDisplayTitle(b), "pt-BR")).slice(0, 10);
    const body = items.length ? `<div class="rail-viewport"><div class="rail">${items.map(item => card(item, state.readingProgress, state.favoriteIds, true)).join("")}</div></div>` : '<div class="empty">Nenhuma edição disponível para esta facção.</div>';
    const subtitle = publisher ? `As edições mais lidas neste mês da editora ${escapeHTML(faction.publisher_name)}.` : "As edições mais lidas neste mês na banca.";
    return `<section class="section faction-extra-abafac faction-most-read-month-abafac" data-faction-abafac="most-read-month" style="--faction-color:${escapeHTML(faction.color)}"><div class="section-head"><div><div class="eyebrow">Popularidade</div><h2 class="section-title">Mais lidos do mês</h2><div class="section-subtitle">${subtitle}</div></div></div>${body}</section>`;
  }

  function factionBestSeriesMarkup(faction) {
    const publisher = String(faction.publisher_name || "").trim().toLocaleLowerCase("pt-BR");
    const groups = new Map();
    state.db.library.filter(item => item.seriesId && (!publisher || String(item.publisher || "").trim().toLocaleLowerCase("pt-BR") === publisher)).forEach(item => {
      if (!groups.has(item.seriesId)) groups.set(item.seriesId, []);
      groups.get(item.seriesId).push(item);
    });
    const items = [...groups.values()].map(editions => ({
      item: editions[0],
      likes: editions.reduce((total, edition) => total + (state.comicLikeCounts.get(String(edition.id)) || 0), 0)
    })).sort((a, b) => b.likes - a.likes || itemDisplayTitle(a.item).localeCompare(itemDisplayTitle(b.item), "pt-BR")).slice(0, 6).map(entry => entry.item);
    const body = items.length ? `<div class="rail-viewport faction-best-series-carousel"><div class="rail faction-best-series-rail">${items.map(item => seriesCard(item)).join("")}</div></div>` : '<div class="empty">Nenhuma série disponível para esta facção.</div>';
    const subtitle = publisher ? `As séries mais curtidas da editora ${escapeHTML(faction.publisher_name)}.` : "As séries mais curtidas na banca.";
    return `<section class="section faction-extra-abafac faction-best-series-abafac" data-faction-abafac="best-series" style="--faction-color:${escapeHTML(faction.color)}"><div class="section-head"><div><div class="eyebrow">Popularidade</div><h2 class="section-title">Melhores séries</h2><div class="section-subtitle">${subtitle}</div></div></div>${body}</section>`;
  }

  function factionTipsMarkup(faction) {
    const publisher = String(faction.publisher_name || "").trim().toLocaleLowerCase("pt-BR");
    const library = state.db.library.filter(item => !publisher || String(item.publisher || "").trim().toLocaleLowerCase("pt-BR") === publisher);
    const items = personalizedRecommendations(library);
    const body = items.length ? `<div class="rail-viewport"><div class="rail">${items.map(item => card(item, state.readingProgress, state.favoriteIds, true)).join("")}</div></div>` : '<div class="empty">Ainda não há dados suficientes para personalizar suas dicas nesta facção.</div>';
    const subtitle = publisher ? `Sugestões baseadas nos seus salvos e curtidos da editora ${escapeHTML(faction.publisher_name)}.` : "Sugestões baseadas nos seus salvos e curtidos.";
    return `<section class="section faction-extra-abafac faction-tips-abafac" data-faction-abafac="tips" style="--faction-color:${escapeHTML(faction.color)}"><div class="section-head"><div><div class="eyebrow">Personalizado</div><h2 class="section-title">Dicas para você</h2><div class="section-subtitle">${subtitle}</div></div></div>${body}</section>`;
  }

  function factionRandomMarkup(faction) {
    const publisher = String(faction.publisher_name || "").trim().toLocaleLowerCase("pt-BR");
    const available = state.db.library.filter(item => !item.local && (!publisher || String(item.publisher || "").trim().toLocaleLowerCase("pt-BR") === publisher));
    state.factionRandomIds ||= {};
    let ids = Array.isArray(state.factionRandomIds[faction.id]) ? state.factionRandomIds[faction.id] : [];
    const items = ids.map(id => available.find(item => String(item.id) === String(id))).filter(Boolean);
    if (items.length < Math.min(6, available.length)) {
      const selected = uniqueCatalogItems([...available].sort(() => Math.random() - .5).slice(0, 6));
      ids = selected.map(item => item.id);
      state.factionRandomIds[faction.id] = ids;
      items.splice(0, items.length, ...selected);
    }
    const body = items.length ? `<div class="rail-viewport"><div class="rail">${items.map(item => card(item, state.readingProgress, state.favoriteIds, true)).join("")}</div></div>` : '<div class="empty">Nenhuma edição disponível para sortear nesta facção.</div>';
    const subtitle = publisher ? `Uma seleção aleatória da editora ${escapeHTML(faction.publisher_name)}.` : "Uma seleção aleatória para descobrir algo novo.";
    return `<section class="section faction-extra-abafac faction-random-abafac" data-faction-abafac="random" style="--faction-color:${escapeHTML(faction.color)}"><div class="section-head"><div><div class="eyebrow">Descoberta</div><h2 class="section-title">Escolha aleatória</h2><div class="section-subtitle">${subtitle}</div></div></div>${body}</section>`;
  }

  function factionArtistMarkup(faction) {
    const publisher = String(faction.publisher_name || "").trim().toLocaleLowerCase("pt-BR");
    const library = state.db.library.filter(item => !publisher || String(item.publisher || "").trim().toLocaleLowerCase("pt-BR") === publisher);
    const recommendation = readArtistSeriesRecommendation(library);
    if (!recommendation) return '<section class="section faction-extra-abafac faction-artist-abafac" data-faction-abafac="artist"><div class="empty">Conclua uma leitura para receber dicas do mesmo artista.</div></section>';
    const { readItem, seriesItems } = recommendation;
    const body = `<div class="rail-viewport faction-artist-carousel"><div class="rail">${seriesItems.slice(0, 6).map(item => seriesCard(item)).join("")}</div></div>`;
    const subtitle = publisher ? `Outras séries do mesmo artista, dentro da editora ${escapeHTML(faction.publisher_name)}.` : "Outras séries do mesmo artista para você conhecer.";
    return `<section class="section faction-extra-abafac faction-artist-abafac" data-faction-abafac="artist" style="--faction-color:${escapeHTML(faction.color)}"><div class="section-head"><div><div class="eyebrow">Recomendação</div><h2 class="section-title">Do mesmo artista de ${escapeHTML(itemDisplayTitle(readItem))}</h2><div class="section-subtitle">${subtitle}</div></div></div>${body}</section>`;
  }

  function factionRecommendationsMarkup(faction) {
    const publisher = String(faction.publisher_name || "").trim().toLocaleLowerCase("pt-BR");
    const library = state.db.library.filter(item => !publisher || String(item.publisher || "").trim().toLocaleLowerCase("pt-BR") === publisher);
    const periods = recommendationPeriodKeys();
    const day = globalRecommendation(library, periods.day);
    const week = globalRecommendation(library, periods.week);
    const month = globalRecommendation(library, periods.month, true);
    const body = day || week || month ? `<div class="global-recommendations-grid">${globalRecommendationCard(day, "Recomendação do dia", "Uma edição para abrir agora e deixar a leitura acontecer.", "day")}${globalRecommendationCard(week, "Recomendação da semana", "A edição que merece um espaço na sua agenda desta semana.", "week")}${globalRecommendationCard(month, "Série do mês", "Uma série para acompanhar com calma, edição por edição.", "month", true)}</div>` : '<div class="empty">Nenhuma escolha disponível para esta facção.</div>';
    const subtitle = publisher ? `Uma seleção renovada da editora ${escapeHTML(faction.publisher_name)}.` : "Uma seleção renovada para descobrir algo especial.";
    return `<section class="section faction-extra-abafac faction-recommendations-abafac" data-faction-abafac="recommendations" style="--faction-color:${escapeHTML(faction.color)}"><div class="global-recommendations-heading"><div><div class="eyebrow">Curadoria global</div><h2 class="section-title">Escolhas da banca</h2><div class="section-subtitle">${subtitle}</div></div><span class="global-recommendations-mark">✦</span></div>${body}</section>`;
  }

  function factionRandomPublisherMarkup(faction) {
    const factionPublisher = String(faction.publisher_name || "").trim().toLocaleLowerCase("pt-BR");
    const groups = new Map();
    state.db.library.filter(item => !item.local && String(item.publisher || "").trim() && (!factionPublisher || String(item.publisher || "").trim().toLocaleLowerCase("pt-BR") === factionPublisher)).forEach(item => {
      const publisher = String(item.publisher).trim();
      if (!groups.has(publisher)) groups.set(publisher, []);
      groups.get(publisher).push(item);
    });
    const publishers = [...groups.keys()];
    if (!publishers.length) return '<section class="section faction-extra-abafac faction-random-publisher-abafac" data-faction-abafac="random-publisher"><div class="empty">Nenhuma editora disponível para sortear nesta facção.</div></section>';
    state.factionRandomPublishers ||= {};
    if (!publishers.includes(state.factionRandomPublishers[faction.id])) state.factionRandomPublishers[faction.id] = weightedRandom(publishers);
    const publisher = state.factionRandomPublishers[faction.id];
    const items = groups.get(publisher) || [];
    const body = `<div class="rail-viewport"><div class="rail">${items.map(item => card(item, state.readingProgress, state.favoriteIds, true)).join("")}</div></div>`;
    return `<section class="section faction-extra-abafac faction-random-publisher-abafac" data-faction-abafac="random-publisher" style="--faction-color:${escapeHTML(faction.color)}"><div class="section-head"><div><div class="eyebrow">Descoberta</div><h2 class="section-title">Uma editora escolhida aleatoriamente</h2><div class="section-subtitle">${factionPublisher ? `Edições da editora ${escapeHTML(publisher)}.` : `A editora sorteada foi ${escapeHTML(publisher)}.`}</div></div></div>${body}</section>`;
  }

  function factionDownloadsMarkup(faction) {
    const publisher = String(faction.publisher_name || "").trim().toLocaleLowerCase("pt-BR");
    const items = state.db.library.filter(item => !item.local && (!publisher || String(item.publisher || "").trim().toLocaleLowerCase("pt-BR") === publisher)).sort((a, b) => Number(b.downloadCount) - Number(a.downloadCount) || itemDisplayTitle(a).localeCompare(itemDisplayTitle(b), "pt-BR")).slice(0, 20);
    const body = items.length ? `<div class="rail-viewport"><div class="rail">${items.map(item => card(item, state.readingProgress, state.favoriteIds, true)).join("")}</div></div>` : '<div class="empty">Nenhuma edição disponível para esta facção.</div>';
    const subtitle = publisher ? `As edições mais baixadas da editora ${escapeHTML(faction.publisher_name)}.` : "As edições mais baixadas na banca.";
    return `<section class="section faction-extra-abafac faction-downloads-abafac" data-faction-abafac="downloads" style="--faction-color:${escapeHTML(faction.color)}"><div class="section-head"><div><div class="eyebrow">Popularidade</div><h2 class="section-title">Mais baixados</h2><div class="section-subtitle">${subtitle}</div></div></div>${body}</section>`;
  }

  function factionPinnedImprintsMarkup(faction) {
    const publisher = String(faction.publisher_name || "").trim().toLocaleLowerCase("pt-BR");
    const pinned = [...state.factionPinnedImprints.values()].filter(row => row.faction_id === faction.id);
    const groups = new Map();
    state.db.library.filter(item => String(item.imprint || "").trim() && (!publisher || String(item.publisher || "").trim().toLocaleLowerCase("pt-BR") === publisher)).forEach(item => {
      const name = String(item.imprint).trim();
      if (!groups.has(name)) groups.set(name, []);
      groups.get(name).push(item);
    });
    const entries = pinned.map(row => { const items = groups.get(row.imprint_name) || [...groups.entries()].find(([name]) => publisherKey(name) === row.imprint_key)?.[1] || []; return [row.imprint_name, items]; }).filter(([, items]) => items.length);
    const body = entries.length ? `<div class="publisher-carousel">${entries.map(([name, items]) => { const setting = state.imprintSettings.get(publisherKey(name)); const representative = items.find(item => item.featuredCoverUrl || item.coverUrl || item.cover) || items[0]; const cover = setting?.cover_url || coverFor(representative); return `<button class="publisher-card imprint-card" type="button" data-imprint="${escapeHTML(name)}"><div class="publisher-card-cover" style="background-image:url('${escapeHTML(cover)}')"></div><div class="publisher-card-overlay"></div><div class="publisher-card-info"><strong>${escapeHTML(name)}</strong><span>${items.length} edição(ões)</span></div></button>`; }).join("")}</div>` : '<div class="empty">Nenhum selo foi fixado nesta facção.</div>';
    const subtitle = publisher ? `Selos fixados pela liderança dentro da editora ${escapeHTML(faction.publisher_name)}.` : "Selos destacados pelos líderes e curadores da facção.";
    return `<section class="section faction-extra-abafac faction-pinned-imprints-abafac" data-faction-abafac="pinned-imprints" style="--faction-color:${escapeHTML(faction.color)}"><div class="section-head"><div><div class="eyebrow">Curadoria</div><h2 class="section-title">Selos fixados</h2><div class="section-subtitle">${subtitle}</div></div></div>${body}</section>`;
  }

  function factionPinnedCharactersMarkup(faction) {
    const publisher = String(faction.publisher_name || "").trim().toLocaleLowerCase("pt-BR");
    const pinned = [...state.factionPinnedCharacters.values()].filter(row => row.faction_id === faction.id);
    const groups = new Map();
    visibleCatalogItems().filter(item => !item.local && (!publisher || String(item.publisher || "").trim().toLocaleLowerCase("pt-BR") === publisher)).forEach(item => {
      characterNames(item).forEach(name => {
        const character = String(name || "").trim();
        if (!character || isTeamCharacter(character) || isRedirectedCharacter(character)) return;
        if (!groups.has(character)) groups.set(character, []);
        groups.get(character).push(item);
      });
    });
    const entries = pinned.map(row => { const items = groups.get(row.character_name) || [...groups.entries()].find(([name]) => publisherKey(name) === row.character_key)?.[1] || []; return [row.character_name, items]; }).filter(([, items]) => items.length);
    const body = entries.length ? `<div class="publisher-carousel">${entries.map(([name, items]) => { const setting = state.characterSettings.get(publisherKey(name)); const representative = items.find(item => item.featuredCoverUrl || item.coverUrl || item.cover) || items[0]; const cover = setting?.cover_url || coverFor(representative) || "assets/batmanicon.jpg"; return `<button class="publisher-card character-card" type="button" data-character="${escapeHTML(name)}"><div class="publisher-card-cover" style="background-image:url('${escapeHTML(cover)}')"></div><div class="publisher-card-overlay"></div><div class="publisher-card-info"><strong>${escapeHTML(name)}</strong><span>${items.length} edição(ões)</span></div></button>`; }).join("")}</div>` : '<div class="empty">Nenhum personagem foi fixado nesta facção.</div>';
    const subtitle = publisher ? `Personagens destacados dentro da editora ${escapeHTML(faction.publisher_name)}.` : "Personagens destacados pelos líderes e curadores da facção.";
    return `<section class="section faction-extra-abafac faction-pinned-characters-abafac" data-faction-abafac="pinned-characters" style="--faction-color:${escapeHTML(faction.color)}"><div class="section-head"><div><div class="eyebrow">Curadoria</div><h2 class="section-title">Personagens em destaque</h2><div class="section-subtitle">${subtitle}</div></div></div>${body}</section>`;
  }

  function factionPinnedOwnCollectionsMarkupLegacy(faction) {
    const publisher = String(faction.publisher_name || "").trim().toLocaleLowerCase("pt-BR");
    const pinned = [...state.factionPinnedCollections.values()].filter(row => String(row.faction_id) === String(faction.id));
    const catalogs = pinned.map(row => state.factionCatalogs.find(catalog => String(catalog.id) === String(row.catalog_id))).filter(Boolean).map(catalog => ({ ...catalog, item_ids: (Array.isArray(catalog.item_ids) ? catalog.item_ids.map(String) : []).map(id => state.db.library.find(item => String(item.id) === id)).filter(item => item && (!publisher || String(item.publisher || "").trim().toLocaleLowerCase("pt-BR") === publisher)).map(item => item.id) })).filter(catalog => catalog.item_ids.length);
    if (!catalogs.length) return "";
    const body = catalogs.length ? `<div class="publisher-carousel faction-featured-collections">${catalogs.map(catalog => { const ids = Array.isArray(catalog.item_ids) ? catalog.item_ids.map(String) : []; const items = ids.map(id => state.db.library.find(item => String(item.id) === id)).filter(Boolean); const cover = catalog.cover_url || (items[0] ? coverFor(items[0]) : "assets/batmanicon.jpg"); const href = `?pagina=faccoes&faccao=${encodeURIComponent(factionRouteKey(faction.id))}&catalogo=${encodeURIComponent(catalog.id)}`; return `<a class="publisher-card faction-collection-card" href="${escapeHTML(href)}"><div class="publisher-card-cover" style="background-image:url('${escapeHTML(cover)}')"></div><div class="publisher-card-overlay"></div><div class="publisher-card-info"><strong>${escapeHTML(catalog.name)}</strong><span>${items.length} edição(ões)</span></div></a>`; }).join("")}</div>` : '<div class="empty">Nenhuma coleção foi fixada nesta facção.</div>';
    const subtitle = publisher ? `Coleções com edições da editora ${escapeHTML(faction.publisher_name)}.` : "Coleções escolhidas pelos líderes e curadores da facção.";
    return `<section class="section faction-extra-abafac faction-pinned-collections-abafac" data-faction-abafac="pinned-collections" style="--faction-color:${escapeHTML(faction.color)}"><div class="section-head"><div><div class="eyebrow">Curadoria</div><h2 class="section-title">Coleções de quadrinhos em destaque</h2><div class="section-subtitle">${subtitle}</div></div></div>${body}</section>`;
  }

  function factionPinnedCollectionsMarkup(faction) {
    const publisher = String(faction.publisher_name || "").trim().toLocaleLowerCase("pt-BR");
    const ownPins = [...state.factionPinnedCollections.values()].filter(row => String(row.faction_id) === String(faction.id));
    const publicPins = [...state.factionPinnedPublicCollections.values()].filter(row => String(row.faction_id) === String(faction.id));
    const own = ownPins.map(row => state.factionCatalogs.find(catalog => String(catalog.id) === String(row.catalog_id))).filter(Boolean).map(catalog => ({ ...catalog, publicCatalog: false }));
    const publicCatalogs = publicPins.map(row => state.factionPublicPinnedCollectionDetails.get(String(row.collection_id))).filter(Boolean).map(catalog => ({ ...catalog, publicCatalog: true }));
    const catalogs = [...own, ...publicCatalogs].map(catalog => ({ ...catalog, featuredItems: (Array.isArray(catalog.item_ids) ? catalog.item_ids.map(String) : []).map(id => state.db.library.find(item => String(item.id) === id)).filter(item => item && (!publisher || String(item.publisher || "").trim().toLocaleLowerCase("pt-BR") === publisher)) })).filter(catalog => catalog.featuredItems.length);
    if (!catalogs.length) return "";
    const body = `<div class="publisher-carousel faction-featured-collections">${catalogs.map(catalog => { const items = catalog.featuredItems; const cover = catalog.cover_url || (items[0] ? coverFor(items[0]) : "assets/batmanicon.jpg"); const href = catalog.publicCatalog ? publicProfileHref(catalog.username, catalog.id) : `?pagina=faccoes&faccao=${encodeURIComponent(factionRouteKey(faction.id))}&catalogo=${encodeURIComponent(catalog.id)}`; return `<a class="publisher-card faction-collection-card" href="${escapeHTML(href)}"><div class="publisher-card-cover" style="background-image:url('${escapeHTML(cover)}')"></div><div class="publisher-card-overlay"></div><div class="publisher-card-info"><strong>${escapeHTML(catalog.name)}</strong><span>${items.length} edi\u00e7\u00e3o(\u00f5es)</span></div></a>`; }).join("")}</div>`;
    const subtitle = publisher ? `Cole\u00e7\u00f5es com edi\u00e7\u00f5es da editora ${escapeHTML(faction.publisher_name)}.` : "Cole\u00e7\u00f5es escolhidas pelos l\u00edderes e curadores da fac\u00e7\u00e3o.";
    return `<section class="section faction-extra-abafac faction-pinned-collections-abafac" data-faction-abafac="pinned-collections" style="--faction-color:${escapeHTML(faction.color)}"><div class="section-head"><div><div class="eyebrow">Curadoria</div><h2 class="section-title">Cole\u00e7\u00f5es de quadrinhos em destaque</h2><div class="section-subtitle">${subtitle}</div></div></div>${body}</section>`;
  }

  function factionMostReadMarkup(faction) {
    const publisher = String(faction.publisher_name || "").trim().toLocaleLowerCase("pt-BR");
    const items = state.db.library.filter(item => !item.local && (!publisher || String(item.publisher || "").trim().toLocaleLowerCase("pt-BR") === publisher)).sort((a, b) => Number(b.clicks) - Number(a.clicks) || itemDisplayTitle(a).localeCompare(itemDisplayTitle(b), "pt-BR")).slice(0, 20);
    const body = items.length ? `<div class="rail-viewport"><div class="rail">${items.map(item => card(item, state.readingProgress, state.favoriteIds, true)).join("")}</div></div>` : '<div class="empty">Nenhuma edição disponível para esta facção.</div>';
    const subtitle = publisher ? `As edições mais lidas da editora ${escapeHTML(faction.publisher_name)}.` : "As edições mais lidas na banca.";
    return `<section class="section faction-extra-abafac faction-most-read-abafac" data-faction-abafac="most-read" style="--faction-color:${escapeHTML(faction.color)}"><div class="section-head"><div><div class="eyebrow">Popularidade</div><h2 class="section-title">Mais lidos</h2><div class="section-subtitle">${subtitle}</div></div></div>${body}</section>`;
  }

  function factionChatMarkup(faction) {
    const roomId = `faccao-${faction.id}`;
    const room = CHAT_ROOMS.find(item => item.id === roomId);
    const body = room ? `<button type="button" class="btn faction-chat-open-button" data-faction-chat-open="${escapeHTML(room.id)}">Abrir chat exclusivo</button>` : '<div class="empty">O chat desta fac\u00e7\u00e3o ainda n\u00e3o est\u00e1 configurado.</div>';
    return `<section class="section faction-extra-abafac faction-chat-abafac" data-faction-abafac="faction-chat" style="--faction-color:${escapeHTML(faction.color)}"><div class="section-head"><div><div class="eyebrow">Comunidade</div><h2 class="section-title">Chat exclusivo da fac\u00e7\u00e3o</h2><div class="section-subtitle">Converse com os membros desta fac\u00e7\u00e3o em uma sala reservada.</div></div></div>${body}</section>`;
  }

  function factionExtraAbafacsMarkup(faction, stats) {
    function factionMandatoryReadsMarkup(factionId) {
      const reads = state.factionMandatoryReads.get(factionId) || [];
      if (!reads.length) return '<div class="empty">As leituras obrigatórias deste mês ainda estão sendo sorteadas.</div>';
      const bonusPerEdition = 25;
      const totalBonus = reads.length * bonusPerEdition;
      return '<p class="faction-mandatory-reads-note">Cada edição concluída automaticamente vale <strong>+' + bonusPerEdition + ' XP</strong>. Total possível neste mês: <strong>+' + totalBonus + ' XP</strong>.</p><div class="faction-mandatory-reads-grid">' + reads.map(read => {
        const item = state.db.library.find(entry => String(entry.id) === String(read.item_id));
        const title = item?.title || read.item_title || "Edição";
        const cover = item?.coverUrl || item?.cover || item?.cover_url || read.cover_url;
        const href = routeUrl({ ler: String(read.item_id) });
        return '<a class="faction-mandatory-read-card" href="' + escapeHTML(href) + '" title="Abrir ' + escapeHTML(title) + '">' + (cover ? '<img class="faction-mandatory-read-cover" src="' + escapeHTML(cover) + '" alt="Capa de ' + escapeHTML(title) + '" loading="lazy">' : '') + '<span class="faction-mandatory-read-copy"><strong>' + escapeHTML(title) + '</strong><small>+' + bonusPerEdition + ' XP bônus</small><small>' + Number(read.completed_count || 0) + ' concluíram · ' + Number(read.reader_count || 0) + ' lendo</small></span></a>';
      }).join('') + '</div>';
    }
    const color = escapeHTML(faction.color);
    const members = state.factionMembers.filter(item => item.faction_id === faction.id && item.profile);
    const roles = state.factionRoleMembers.filter(item => item.faction_id === faction.id);
    const xp = Number(stats.xp || 0);
    const topMembers = members.slice().sort((a, b) => new Date(b.joined_at || 0) - new Date(a.joined_at || 0)).slice(0, 5);
    const memberNames = topMembers.map(item => `@${escapeHTML(item.profile.username)}`).join(" · ") || "Nenhum membro em destaque ainda.";
    const mandatoryReads = state.factionMandatoryReads.get(faction.id) || [];
    /*
      ? `<p class="faction-mandatory-reads-note">Estas edições mudam no início de cada mês. Ao chegar ao final de uma delas, a leitura é marcada automaticamente e rende <strong>25 XP bônus</strong> para a facção.</p><div class="faction-mandatory-reads-grid">${mandatoryReads.map(read => { const item = state.db.library.find(entry => String(entry.id) === String(read.item_id)); const title = item?.title || read.item_title || "Edição"; const cover = item?.coverUrl || item?.cover || item?.cover_url || read.cover_url; return `<article class="faction-mandatory-read-card">${cover ? `<div class="faction-mandatory-read-cover" style="background-image:url('${escapeHTML(cover)}')"></div>` : ""}<div><strong>${escapeHTML(title)}</strong><span>${Number(read.completed_count || 0)} concluíram · ${Number(read.reader_count || 0)} lendo</span></div></article>`; }).join("")}</div>`
      : '<div class="empty">As leituras obrigatórias deste mês ainda estão sendo sorteadas.</div>';
    */
    const section = (key, eyebrow, title, subtitle, body) => `<section class="section faction-extra-abafac faction-${key}-abafac" data-faction-abafac="${key}" style="--faction-color:${color}"><div class="section-head"><div><div class="eyebrow">${eyebrow}</div><h2 class="section-title">${title}</h2><div class="section-subtitle">${subtitle}</div></div></div>${body}</section>`;
    const mandatoryBody = factionMandatoryReadsMarkup(faction.id);
    const factionChatSection = factionChatMarkup(faction);
    const continueReadingSection = factionContinueReadingMarkup(faction);
    const recentlyAddedSection = factionRecentlyAddedMarkup(faction);
    const featuredCharacterSection = factionFeaturedCharacterMarkup(faction);
    const newSeriesSection = factionNewSeriesMarkup(faction);
    const mostReadMonthSection = factionMostReadMonthMarkup(faction);
    const bestSeriesSection = factionBestSeriesMarkup(faction);
    const tipsSection = factionTipsMarkup(faction);
    const randomSection = factionRandomMarkup(faction);
    const artistSection = factionArtistMarkup(faction);
    const recommendationsSection = factionRecommendationsMarkup(faction);
    const randomPublisherSection = factionRandomPublisherMarkup(faction);
    const downloadsSection = factionDownloadsMarkup(faction);
    const mostReadSection = factionMostReadMarkup(faction);
    const pinnedImprintsSection = factionPinnedImprintsMarkup(faction);
    const pinnedCharactersSection = factionPinnedCharactersMarkup(faction);
    const pinnedCollectionsSection = factionPinnedCollectionsMarkup(faction);
    return [
      factionChatSection,
      continueReadingSection,
      recentlyAddedSection,
      featuredCharacterSection,
      newSeriesSection,
      mostReadMonthSection,
      bestSeriesSection,
      tipsSection,
      randomSection,
      artistSection,
      recommendationsSection,
      randomPublisherSection,
      downloadsSection,
      mostReadSection,
      pinnedImprintsSection,
      pinnedCharactersSection,
      pinnedCollectionsSection,
      section("manifest", "Identidade", "Manifesto", "O que move esta facção.", `<p>${escapeHTML(faction.description || "Esta facção ainda está escrevendo sua história.")}</p>`),
      section("mural", "Comunicação", "Mural de avisos", "Um espaço para os comunicados da liderança.", `<div class="notice">${escapeHTML(faction.mural_notice || "Nenhum aviso publicado pela liderança ainda.")}</div>`),
      section("missions", "Temporada", "Missões da temporada", "Desafios coletivos para fazer a facção avançar.", `<div class="faction-extra-list"><div><strong>Marcar presença</strong><span>Participe dos chats e das atividades da comunidade.</span></div><div><strong>Compartilhar leituras</strong><span>Leia, comente e ajude a movimentar a banca.</span></div><div><strong>Buscar o topo</strong><span>Acumule XP e acompanhe a disputa mensal.</span></div></div>`),
      section("mandatory-reads", "Missão especial", "Leituras obrigatórias", "Edições do mês que valem XP bônus para a facção.", mandatoryBody),
      section("achievements", "Marcos", "Conquistas", "Os feitos que a facção pode colecionar.", `<div class="faction-extra-stats"><div><strong>${xp.toLocaleString("pt-BR")} XP</strong><span>pontuação acumulada na temporada</span></div><div><strong>${stats.members}</strong><span>membros reunidos</span></div></div>`),
      section("hall", "Destaques", "Hall da fama", "Membros que ajudam a construir a identidade da equipe.", `<p>${memberNames}</p><p class="section-subtitle">O destaque é atualizado conforme a atividade e a participação na facção.</p>`),
      section("agenda", "Programação", "Agenda", "Eventos e leituras coletivas da facção.", `<div class="empty">Nenhum evento agendado no momento.</div>`),
      section("showcase", "Comunidade", "Vitrine de membros", "Uma amostra das pessoas que formam a equipe.", `<div class="faction-member-grid">${topMembers.map(member => `<article class="faction-member-card" style="--faction-color:${color}">${avatarMarkup(member.profile, "faction-member-avatar")}<div><strong>@${escapeHTML(member.profile.username)}</strong>${member.profile.title ? `<small>${escapeHTML(member.profile.title)}</small>` : ""}</div></article>`).join("") || '<div class="empty">Nenhum membro para exibir.</div>'}</div>`),
      section("alliances", "Histórico", "Rivalidades e alianças", "O espaço narrativo das disputas e parcerias.", `<p>Registre aqui os grandes confrontos, alianças e momentos memoráveis da temporada.</p>`),
      section("report", "Transparência", "Relatório da temporada", "Um resumo rápido do desempenho da facção.", `<div class="faction-report-placeholder"></div>`)
    ].join("").replace(/<section\b[^>]*data-faction-abafac="showcase"[\s\S]*?<\/section>/, "").replace(/<section\b[^>]*data-faction-abafac="agenda"[\s\S]*?<\/section>/, "").replace(/<section\b[^>]*data-faction-abafac="alliances"[\s\S]*?<\/section>/, "");
  }

  function renderFactionPage() {
    const selected = state.factions.find(faction => faction.id === state.factionPageId);
    if (selected) {
      const directCatalog = state.factionCatalogId ? state.factionCatalogs.find(catalog => String(catalog.id) === String(state.factionCatalogId) && catalog.faction_id === selected.id) : null;
      if (directCatalog) return renderFactionCatalogPage(selected, directCatalog);
      const stats = state.factionStats.get(selected.id) || { members: 0, xp: 0 };
      const publisherName = String(selected.publisher_name || "").trim();
      const publisherSetting = publisherName ? state.publisherSettings.get(publisherKey(publisherName)) : null;
      const publisherItem = publisherName ? state.db.library.find(item => String(item.publisher || "").trim().toLocaleLowerCase("pt-BR") === publisherName.toLocaleLowerCase("pt-BR")) : null;
      const publisherImage = publisherName ? (publisherSetting?.cover_url || (publisherItem ? coverFor(publisherItem) : instantCover({ title: publisherName }))) : "";
      const publisherMarkup = publisherName ? `<div class="faction-publisher-summary"><img src="${escapeHTML(proxiedImageUrl(publisherImage))}" alt="Editora ${escapeHTML(publisherName)}" loading="lazy"><span><strong>${escapeHTML(publisherName)}</strong><small>Editora</small></span></div>` : "";
      return `<div class="content faction-page faction-detail-page" style="--faction-color:${escapeHTML(selected.color)}"><div class="section-head"><div><div class="eyebrow">Página da facção</div><h1 class="section-title">${escapeHTML(selected.emblem)} ${escapeHTML(selected.name)}</h1><div class="section-subtitle">${escapeHTML(selected.description)}</div></div><button class="small-btn" data-faction-back>Voltar às facções</button></div><section class="section faction-detail-hero faction-stats-abafac" data-faction-abafac="stats">${publisherMarkup}<span class="faction-page-emblem">${escapeHTML(selected.emblem)}</span><div class="faction-page-stats faction-stats-copy"><strong>${stats.members} membro(s)</strong><span>${stats.xp.toLocaleString("pt-BR")} XP na temporada</span></div></section>${factionExtraAbafacsMarkup(selected, stats)}${factionCatalogMarkup(selected)}${factionOwnedCatalogMarkup(selected)}</div>`;
    }
    return `<div class="content faction-page"><div class="section-head"><div><div class="eyebrow">Comunidade</div><h1 class="section-title">Facções</h1><div class="section-subtitle">Escolha seu lado, ajude sua equipe e dispute a temporada mensal.</div></div>${canChooseFaction() ? `<button class="small-btn" data-open-faction-choice>${state.profile.faction_id ? "Trocar facção" : "Escolher facção"}</button>` : ""}</div>${factionOverviewMarkup()}<section class="section faction-rules"><div class="section-head"><div><h2 class="section-title">Como funciona</h2><div class="section-subtitle">A temporada recomeça no primeiro dia de cada mês.</div></div></div><p>Leituras, comentários, curtidas e participação nos chats geram XP para sua facção. Moderadores e administradores acompanham a disputa, mas não participam dela.</p></section></div>`;
  }

  return {
    renderFactionPage,
    renderFactionMembersPage,
    factionMembersResultsMarkup
  };
}
