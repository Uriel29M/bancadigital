  function personalCollectionControls(id, categories, canMove) {
    if (!canMove) return "";
    const profile = state.section === "public-profile" ? state.publicProfile?.profile : state.profile;
    const order = normalizePersonalCollectionOrder(shelfCollectionOrderForProfile(profile), categories);
    const index = order.indexOf(String(id));
    return `<div class="homepage-section-order-controls shelf-section-order-controls"><button type="button" class="small-btn" data-shelf-category-move="up" data-shelf-category-key="${escapeHTML(id)}" ${index <= 0 ? "disabled" : ""} title="Mover coleção para cima" aria-label="Mover coleção para cima">↑</button><button type="button" class="small-btn" data-shelf-category-move="down" data-shelf-category-key="${escapeHTML(id)}" ${index === order.length - 1 ? "disabled" : ""} title="Mover coleção para baixo" aria-label="Mover coleção para baixo">↓</button></div>`;
  }

