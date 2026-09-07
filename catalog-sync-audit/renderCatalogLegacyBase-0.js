  function renderCatalogLegacyBase(type = null) {
    const items = visibleCatalogItems(type ? state.db.library.filter(x => x.type === type) : state.db.library);
     const characterCarousel = type === "comic" ? `${characterWikiCarouselMarkup(items)}${teamWikiCarouselMarkup(items)}` : "";
    return `
      <div class="content">
        <div class="section-head">
          <div>
            <h1 class="section-title">${type === "manga" ? "Mangás" : type === "comic" ? "Quadrinhos" : "Catálogo"}</h1>
            <div class="section-subtitle">${items.length} edição(ões)</div>
          </div>
        </div>
        <div class="results-grid">${uniqueCatalogItems(items).map(item => card(item)).join("") || `<div class="empty">Nenhuma edição cadastrada.</div>`}</div>
        ${characterCarousel}
      </div>`;
  }

