  function renderSearch() {
    const q = state.search.trim().toLowerCase();
    const matchingEditions = uniqueCatalogItems(visibleCatalogItems().filter(x => {
      const hay = [x.title,x.seriesTitle,x.issue,x.author,x.publisher,x.imprint,x.character,x.description,...(x.tags||[])].join(" ").toLowerCase();
      return !q || hay.includes(q);
    }));
    const seenSeries = new Set();
    const results = matchingEditions.filter(item => {
      if (!item.seriesId) return true;
      if (seenSeries.has(item.seriesId)) return false;
      seenSeries.add(item.seriesId);
      return true;
    });
    const initialOrder = ["0-9", ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ".split(""), "#"];
    const initialFor = item => {
      const initial = String(item.seriesTitle || item.title || "").trim().charAt(0).toUpperCase();
      return /[0-9]/.test(initial) ? "0-9" : /^[A-Z]$/.test(initial) ? initial : "#";
    };
    const grouped = new Map();
    results.forEach(item => {
      const publisher = String(item.publisher || "Sem editora").trim() || "Sem editora";
      const imprint = String(item.imprint || "Sem selo").trim() || "Sem selo";
      if (!grouped.has(publisher)) grouped.set(publisher, new Map());
      if (!grouped.get(publisher).has(imprint)) grouped.get(publisher).set(imprint, new Map());
      const initial = initialFor(item);
      if (!grouped.get(publisher).get(imprint).has(initial)) grouped.get(publisher).get(imprint).set(initial, []);
      grouped.get(publisher).get(imprint).get(initial).push(item);
    });
    const publisherMarkup = [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b, "pt-BR")).map(([publisher, imprints]) => `
      <section class="section search-publisher">
        <div class="search-group-summary"><div><h2 class="section-title">${escapeHTML(publisher)}</h2><div class="section-subtitle">Editora</div></div><button type="button" class="small-btn search-collapse-btn" data-search-collapse>Recolher</button></div>
        <div data-search-collapse-content>
        ${[...imprints.entries()].sort(([a], [b]) => a.localeCompare(b, "pt-BR")).map(([imprint, initials]) => `
          <section class="search-imprint">
            <div class="search-group-summary"><div><h3 class="section-title">${escapeHTML(imprint)}</h3><div class="section-subtitle">Selo</div></div><button type="button" class="small-btn search-collapse-btn" data-search-collapse>Recolher</button></div>
            <div data-search-collapse-content>
            ${initialOrder.filter(initial => initials.has(initial)).map(initial => `
              <section class="search-initial">
                <div class="search-initial-head"><h4 class="search-initial-title">${initial}</h4><button type="button" class="small-btn search-collapse-btn" data-search-collapse>Recolher</button></div>
                <div data-search-collapse-content><div class="results-grid">${initials.get(initial).sort((a, b) => (a.seriesTitle || a.title).localeCompare(b.seriesTitle || b.title, "pt-BR")).map(item => item.seriesId ? seriesCard(item) : card(item)).join("")}</div></div>
              </section>`).join("")}
            </div>
          </section>`).join("")}
        </div>
      </section>`).join("");
    const userQuery = state.searchUsersQuery || state.search.trim();
    const userResultsMarkup = !userQuery
      ? ""
      : `<section class="section search-users-section">
          <div class="section-head"><div><h2 class="section-title">Usuários</h2><div class="section-subtitle">Nomes iguais ou parecidos com “${escapeHTML(userQuery)}”</div></div></div>
          ${state.searchUsersLoading
            ? '<div class="empty">Pesquisando usuários...</div>'
            : `<div class="search-users-grid">${state.searchUsers.map(profile => {
                const profileTitle = String(profile.title || "").trim();
                const title = profileTitle ? `<span class="search-user-title" style="--title-bg:${safeTitleColor(profile.title_color)}" title="${escapeHTML(profileTitle)}">${escapeHTML(profileTitle)}</span>` : "";
                return `<a class="search-user-card" href="${escapeHTML(publicProfileHref(profile.username))}">${avatarMarkup(profile, "search-user-avatar")}<span class="search-user-copy"><strong>${factionDot(profile)}@${escapeHTML(profile.username)}</strong>${title}<small>Ver perfil</small></span></a>`;
              }).join("") || '<div class="empty">Nenhum usuário encontrado.</div>'}</div>`}
        </section>`;
    const matchingImprints = [...new Set(visibleCatalogItems()
      .map(item => String(item.imprint || "").trim())
      .filter(imprint => imprint && imprint.toLocaleLowerCase("pt-BR").includes(q)))];
    const imprintCards = matchingImprints.map(imprint => {
      const imprintItems = visibleCatalogItems().filter(item => String(item.imprint || "").trim() === imprint);
      const setting = state.imprintSettings.get(publisherKey(imprint));
      const representative = imprintItems.find(item => item.featuredCoverUrl || item.coverUrl || item.cover) || imprintItems[0];
      const cover = setting?.cover_url || (representative ? coverFor(representative) : "assets/batmanicon.jpg");
      return `<button class="publisher-card imprint-card" type="button" data-imprint="${escapeHTML(imprint)}"><div class="publisher-card-cover" style="background-image:url('${escapeHTML(cover)}')"></div><div class="publisher-card-overlay"></div><div class="publisher-card-info"><strong>${escapeHTML(imprint)}</strong><span>${imprintItems.length} edição(ões)</span></div></button>`;
    }).join("");
    const imprintResultsMarkup = q && imprintCards
      ? `<section class="section search-imprints-section imprint-carousel-section"><div class="section-head"><div><h2 class="section-title">Selos</h2><div class="section-subtitle">Nomes iguais ou parecidos com “${escapeHTML(state.search.trim())}”</div></div><div class="carousel-controls" aria-label="Navegação dos selos encontrados"><button class="carousel-control" type="button" data-imprint-carousel-prev aria-label="Selo anterior" title="Anterior">‹</button><button class="carousel-control" type="button" data-imprint-carousel-next aria-label="Próximo selo" title="Próximo">›</button></div></div><div class="imprint-carousel" data-imprint-carousel aria-label="Selos encontrados"><div class="imprint-carousel-track">${imprintCards}</div></div></section>`
      : "";
    const matchingPublishers = [...new Set(visibleCatalogItems()
      .map(item => String(item.publisher || "").trim())
      .filter(publisher => publisher && publisher.toLocaleLowerCase("pt-BR").includes(q)))];
    const publisherCards = matchingPublishers.map(publisher => {
      const publisherItems = visibleCatalogItems().filter(item => String(item.publisher || "").trim() === publisher);
      const setting = state.publisherSettings.get(publisherKey(publisher));
      const representative = publisherItems.find(item => item.featuredCoverUrl || item.coverUrl || item.cover) || publisherItems[0];
      const cover = setting?.cover_url || (representative ? coverFor(representative) : "assets/batmanicon.jpg");
      return `<button class="publisher-card" type="button" data-publisher="${escapeHTML(publisher)}"><div class="publisher-card-cover" style="background-image:url('${escapeHTML(cover)}')"></div><div class="publisher-card-overlay"></div><div class="publisher-card-info"><strong>${escapeHTML(publisher)}</strong><span>${publisherItems.length} edição(ões)</span></div></button>`;
    }).join("");
    const publisherResultsMarkup = q && publisherCards
      ? `<section class="section search-publishers-section publisher-carousel-section"><div class="section-head"><div><h2 class="section-title">Editoras</h2><div class="section-subtitle">Nomes iguais ou parecidos com “${escapeHTML(state.search.trim())}”</div></div><div class="carousel-controls" aria-label="Navegação das editoras encontradas"><button class="carousel-control" type="button" data-publishers-carousel-prev aria-label="Editora anterior" title="Anterior">‹</button><button class="carousel-control" type="button" data-publishers-carousel-next aria-label="Próxima editora" title="Próximo">›</button></div></div><div class="publisher-carousel" data-publishers-carousel aria-label="Editoras encontradas">${publisherCards}</div></section>`
      : "";
    const characterEntries = visibleCatalogItems().flatMap(item => characterNames(item)
      .map(character => character.trim())
      .filter(character => character && !isTeamCharacter(character) && !isRedirectedCharacter(character))
      .map(character => ({ character, item })));
    const matchingCharacters = [...new Set(characterEntries
      .map(entry => entry.character)
      .filter(character => character.toLocaleLowerCase("pt-BR").includes(q)))];
    const characterCards = matchingCharacters.map(character => {
      const characterItems = characterEntries.filter(entry => entry.character === character).map(entry => entry.item);
      const setting = state.characterSettings.get(publisherKey(character));
      const representative = characterItems.find(item => item.featuredCoverUrl || item.coverUrl || item.cover) || characterItems[0];
      const cover = setting?.cover_url || wikiCharacterImageCache.get(character) || (representative ? coverFor(representative) : "assets/batmanicon.jpg");
      return `<button class="publisher-card character-card" type="button" data-character="${escapeHTML(character)}"><div class="publisher-card-cover" style="background-image:url('${escapeHTML(cover)}')"></div><div class="publisher-card-overlay"></div><div class="publisher-card-info"><strong>${escapeHTML(character)}</strong><span>${characterItems.length} edição(ões)</span></div></button>`;
    }).join("");
    const characterResultsMarkup = q && characterCards
      ? `<section class="section search-characters-section"><div class="section-head"><div><h2 class="section-title">Personagens</h2><div class="section-subtitle">Nomes iguais ou parecidos com “${escapeHTML(state.search.trim())}”</div></div></div><div class="publisher-carousel" aria-label="Personagens encontrados">${characterCards}</div></section>`
      : "";
    return `
      <div class="content">
        <div class="section">
          <h1 class="section-title">Pesquisar</h1>
          <div class="search-wrap">
            <input id="search-input" class="search-input" value="${escapeHTML(state.search)}" placeholder="Título, autor, personagem, gênero, edição…">
            <button class="btn btn-danger" data-action="do-search">Pesquisar</button>
          </div>
          <div class="section-subtitle">${results.length} resultado(s)</div>
          <div style="margin-top:15px">${publisherMarkup || `<div class="empty">Nada encontrado.</div>`}</div>
        </div>
        ${userResultsMarkup}
        ${imprintResultsMarkup}
        ${publisherResultsMarkup}
        ${characterResultsMarkup}
      </div>`;
  }

