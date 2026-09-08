  function renderCollectionPage() {
    const collection = state.db.collections.find(item => item.id === state.collectionId);
    if (!collection) return renderCollections();
    const items = collection.issueIds.map(id => state.db.library.find(item => item.id === id)).filter(Boolean);
    return `<div class="content collection-page"><div class="section-head"><div><div class="eyebrow">Coleção</div><h1 class="section-title">${escapeHTML(collection.title)}</h1><div class="section-subtitle">${items.length} edição(ões)</div></div><button class="small-btn" data-section="collections">Voltar às coleções</button></div><p class="section-subtitle">${escapeHTML(collection.description || "")}</p><div class="results-grid">${items.map(item => card(item)).join("") || '<div class="empty">Coleção vazia.</div>'}</div></div>`;
  }

