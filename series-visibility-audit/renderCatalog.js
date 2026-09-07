  function renderCatalog(type = null) {
    const items = visibleCatalogItems(type ? state.db.library.filter(x => x.type === type) : state.db.library);
    const series = uniqueCatalogItems(items.filter(x => x.seriesId));
    const oneshots = uniqueCatalogItems(items.filter(x => !x.seriesId));
    const group = (title, groupItems, isSeries = false) => {
      if (!groupItems.length) return "";
      const isComicSeries = type === "comic" && isSeries;
      const seriesCollapsed = isComicSeries && state.comicSeriesCollapsed;
      const seriesToggle = isComicSeries ? `<button class="small-btn catalog-series-toggle" type="button" data-catalog-series-toggle aria-expanded="${!seriesCollapsed}" aria-controls="catalog-series-grid">${seriesCollapsed ? "Expandir séries" : "Recolher séries"}</button>` : "";
      return `<section class="section"><div class="section-head"><div><h2 class="section-title">${title}</h2><div class="section-subtitle">${groupItems.length} obra(s)</div></div>${seriesToggle}</div><div id="${isComicSeries ? "catalog-series-grid" : ""}" class="results-grid${isComicSeries ? " catalog-series-grid" : ""}"${seriesCollapsed ? " hidden" : ""}>${groupItems.map(item => isSeries ? seriesCard(item) : card(item)).join("")}</div></section>`;
    };
    const publishers = new Map();
    items.filter(item => String(item.publisher || "").trim()).forEach(item => { const name = String(item.publisher).trim(); if (!publishers.has(name)) publishers.set(name, []); publishers.get(name).push(item); });
    const publisherEntries = [...publishers.entries()].sort((a, b) => a[0].localeCompare(b[0], "pt-BR"));
    const publisherCard = ([name, publisherItems]) => { const setting = state.publisherSettings.get(publisherKey(name)); const cover = proxiedImageUrl(setting?.cover_url || instantCover({ title: name })); return `<button class="publisher-card ${setting?.is_pinned ? "is-pinned" : ""}" type="button" data-publisher="${escapeHTML(name)}"><div class="publisher-card-cover" style="background-image:url('${escapeHTML(cover)}')"></div><div class="publisher-card-overlay"></div><div class="publisher-card-info"><strong>${escapeHTML(name)}</strong><span>${publisherItems.length} quadrinho(s)</span></div></button>`; };
    const imprintGroups = new Map();
    items.filter(item => String(item.imprint || "").trim()).forEach(item => {
      const imprint = String(item.imprint).trim();
      if (!imprintGroups.has(imprint)) imprintGroups.set(imprint, []);
      imprintGroups.get(imprint).push(item);
    });
    const imprintCards = [...imprintGroups.entries()].sort(([a], [b]) => a.localeCompare(b, "pt-BR")).map(([imprint, imprintItems]) => {
      const representative = imprintItems.find(item => item.featuredCoverUrl || item.coverUrl || item.cover) || imprintItems[0];
      const setting = state.imprintSettings.get(publisherKey(imprint));
      const cover = setting?.cover_url ? proxiedImageUrl(setting.cover_url) : coverFor(representative);
      const publisher = [...new Set(imprintItems.map(item => String(item.publisher || "").trim()).filter(Boolean))].join(" · ");
      return `<button class="publisher-card imprint-card" type="button" data-imprint="${escapeHTML(imprint)}"><div class="publisher-card-cover" style="background-image:url('${escapeHTML(cover)}')"></div><div class="publisher-card-overlay"></div><div class="publisher-card-info"><strong>${escapeHTML(imprint)}</strong><span>${escapeHTML(publisher || "Selo")} · ${imprintItems.length} edição(ões)</span></div></button>`;
    }).join("");
    const imprintCarousel = type === "comic" && imprintCards ? `<section class="section imprint-carousel-section"><div class="section-head"><div><h2 class="section-title">Selos</h2><div class="section-subtitle">Explore todos os selos disponíveis no catálogo.</div></div><div class="carousel-controls" aria-label="Navegação dos selos"><button class="carousel-control" type="button" data-imprint-carousel-prev aria-label="Selo anterior" title="Anterior">‹</button><button class="carousel-control" type="button" data-imprint-carousel-next aria-label="Próximo selo" title="Próximo">›</button></div></div><div class="imprint-carousel" data-imprint-carousel aria-label="Todos os selos"><div class="imprint-carousel-track">${imprintCards}</div></div></section>` : "";
    const publisherCarousel = type === "comic" && publisherEntries.length ? `<section class="section publisher-all-section"><div class="section-head"><div><h2 class="section-title">Editoras</h2><div class="section-subtitle">Explore todos os quadrinhos por editora.</div></div><div class="carousel-controls" aria-label="Navegação das editoras"><button class="carousel-control" type="button" data-publishers-carousel-prev aria-label="Editora anterior" title="Anterior">‹</button><button class="carousel-control" type="button" data-publishers-carousel-next aria-label="Próxima editora" title="Próximo">›</button></div></div><div class="publisher-carousel" data-publishers-carousel aria-label="Todas as editoras">${publisherEntries.map(publisherCard).join("")}</div></section>` : "";
    const popularCollections = state.popularPublicCollections || [];
    const popularCollectionsMarkup = type === "comic" && popularCollections.length ? `<section class="section popular-collections-section"><div class="section-head"><div><h2 class="section-title">Coleções públicas mais curtidas</h2><div class="section-subtitle">Descubra listas públicas da comunidade</div></div><div class="carousel-controls" aria-label="Navegação das coleções públicas"><button class="carousel-control" type="button" data-collections-carousel-prev aria-label="Coleção anterior" title="Anterior">‹</button><button class="carousel-control" type="button" data-collections-carousel-next aria-label="Próxima coleção" title="Próximo">›</button></div></div><div class="collections-carousel" data-collections-carousel aria-label="Coleções públicas mais curtidas"><div class="collections-carousel-track">${popularCollections.map(collection => `<div class="feature-card" data-public-collection="${escapeHTML(collection.id)}" data-public-owner="${escapeHTML(collection.username)}"><div class="cover" style="background-image:url('${escapeHTML(proxiedImageUrl(collection.cover_url || ""))}')"></div><div class="gradient"></div><div class="feature-info"><h3>${escapeHTML(collection.name)}</h3><p>${collection.likes} curtida(s) · @${escapeHTML(collection.username)}</p></div></div>`).join("")}</div></div></section>` : "";
    const characterCarousel = type === "comic" ? `${characterWikiCarouselMarkup(items)}${teamWikiCarouselMarkup(items)}` : "";
    const heading = type === "manga" ? "Mangás" : type === "comic" ? "Quadrinhos" : "Catálogo";
    const catalogHeader = type === "comic" ? "" : `<div class="section-head"><div><h1 class="section-title">${heading}</h1><div class="section-subtitle">${items.length} edição(ões)</div></div></div>`;
    const legendarySundayDay = isLegendarySunday();
    const legendarySundayEnabled = state.legendarySundayEnabled !== false;
    const legendaryManualActive = !legendarySundayDay && state.legendaryManualDate === legendarySaoPauloDate();
    const legendaryEventActive = (legendarySundayDay && legendarySundayEnabled) || legendaryManualActive;
    const legendaryEventName = `${legendaryDayName()} lendária`;
    const showLegendarySundayBanner = type === "comic" && (legendaryEventActive || isAdminProfile());
    const legendarySundayActive = legendaryEventActive;
    const legendarySundayCovers = legendaryWeeklyCovers(items);
    const legendarySundayStatus = isAdminProfile() ? `<div class="legendary-sunday-status"><span>${legendarySundayDay ? (legendarySundayEnabled ? "Evento automático ativo" : "Evento automático desativado") : (legendaryManualActive ? "Evento ativo hoje" : "Evento oculto fora do dia automático")}</span><button type="button" class="small-btn" data-legendary-event-toggle>${legendarySundayDay ? (legendarySundayEnabled ? "Desativar evento" : "Ativar evento") : (legendaryManualActive ? "Desativar evento" : `Ativar ${escapeHTML(legendaryEventName)}`)}</button></div>` : "";
    const legendarySundayBanner = showLegendarySundayBanner ? `<section class="legendary-sunday-banner ${legendarySundayActive ? "is-active" : "is-preview"}" role="status"><div class="legendary-sunday-art" aria-hidden="true">${legendarySundayCovers}</div><div class="legendary-sunday-copy"><div class="legendary-sunday-badge">★ ${escapeHTML(legendaryEventName)}</div><h1>Hoje todo membro comum é Lenda</h1><p>Aproveite o acesso liberado ${legendarySundayDay ? "durante todo o domingo" : "neste dia"}. O plano normal volta automaticamente quando o dia terminar.</p><div class="legendary-sunday-benefits"><span>✓ Capas variantes</span><span>✓ Estilos visuais de capa</span><span>✓ Escolha de capa por série</span><span>✓ Recursos exclusivos da estante</span><span>✓ Benefícios de Lenda no ranking</span></div></div></section>${legendarySundayStatus}` : "";
     return `<div class="content">${legendarySundayBanner}${catalogHeader}${imprintCarousel}${group("Séries", series, true)}${group("Oneshots", oneshots)}${!items.length ? `<div class="empty">Nenhuma edição cadastrada.</div>` : ""}${publisherCarousel}${characterCarousel}${popularCollectionsMarkup}${type === "comic" ? alignmentWikiCarouselsMarkup(items) : ""}</div>`;
  }

