  function shelfCollectionMarkup(title, items, key, progressMap = state.readingProgress, favoriteIds = state.favoriteIds, actions = "", coverChoices = null, renderSeriesCards = false) {
    const expanded = Boolean(state.shelfExpanded[key]);
    const fixedCollection = ["saved", "series-saved", "read", "completed", "liked", "public-saved", "public-series-saved", "public-read", "public-completed", "public-liked"].includes(key)
      || key.startsWith("category:")
      || key.startsWith("public-category:");
    const publicState = state.section === "public-profile" ? state.publicProfile : null;
    const sortOrders = publicState?.profile?.shelf_sort_orders || state.collectionSortOrders || {};
    const sortCategoryId = key.startsWith("public-category:") ? key.slice("public-category:".length) : "";
    const publicCategorySortOrder = sortCategoryId ? publicState?.collections?.find(category => category.id === sortCategoryId)?.sortOrder : "";
    const sortOrder = sortOrders[key] || sortOrders[key.replace(/^public-/, "")] || publicCategorySortOrder || "added_desc";
    const addedAtMap = key === "saved" || key === "series-saved" || key === "public-saved" || key === "public-series-saved"
      ? (publicState?.favoriteAddedAt || state.favoriteAddedAt)
      : key === "liked" || key === "public-liked"
        ? (publicState?.comicLikeAddedAt || state.comicLikeAddedAt)
        : null;
    const orderedItems = sortShelfItems(items, sortOrder, addedAtMap, progressMap);
    const visibleItems = fixedCollection || expanded ? orderedItems : orderedItems.slice(0, SHELF_PREVIEW_LIMIT);
    const likedCollection = key === "read" && state.section === "shelf" ? shelfCollectionMarkup("Curtidas", shelfItemsByIds([...state.comicLikeIds]), "liked") : "";
    // Nas estantes (própria ou pública), um card de edição deve ir direto
    // para a leitura. O seletor permanece apenas para cards de série.
    const directOpen = state.section === "shelf" || state.section === "public-profile";
    const publicCategoryId = key.startsWith("public-category:") ? key.slice("public-category:".length) : "";
    const publicCategory = publicCategoryId ? state.publicProfile?.collections?.find(category => category.id === publicCategoryId) : null;
    const shelfStyleProfile = publicState?.profile || state.profile;
    const shelfStyles = shelfStyleProfile?.shelf_styles && typeof shelfStyleProfile.shelf_styles === "object" ? shelfStyleProfile.shelf_styles : {};
    const shelfStyle = shelfStyleOptionsFor(shelfStyleProfile).some(([value]) => value === shelfStyles[key]) ? shelfStyles[key] : "none";
    const shelfStyleKeyMarker = fixedCollection ? `<span class="shelf-style-key" data-shelf-style-key="${escapeHTML(key)}" hidden></span>` : "";
    const sectionKey = key.replace(/^public-/, "");
    const featureAction = shelfStyleKeyMarker + shelfStyleMarkup(shelfStyle, key) + shelfSortSelectMarkup(key, sortOrder) + fixedShelfSectionControls(sectionKey, isOwnShelfProfile()) + (publicCategory && ["moderator", "banca", "admin"].includes(state.profile?.plan)
      ? `<button class="small-btn" data-collection-feature="${escapeHTML(publicCategory.id)}" data-collection-featured="${publicCategory.is_featured ? "true" : "false"}">${publicCategory.is_featured ? "Remover destaque" : "Destacar"}</button>`
      : "");
    return `<section class="section shelf-collection${fixedCollection ? " shelf-fixed-collection" : ""}"><div class="section-head"><div><h2 class="section-title">${escapeHTML(title)}</h2><div class="section-subtitle shelf-item-count">${items.length} item(ns)</div></div><div class="shelf-section-actions">${actions}${featureAction}${!fixedCollection && items.length > SHELF_PREVIEW_LIMIT ? `<button class="small-btn" data-shelf-expand="${escapeHTML(key)}">${expanded ? "Mostrar menos" : "Ver todos"}</button>` : ""}</div></div><div class="results-grid${fixedCollection ? " shelf-fixed-grid" : ""}">${visibleItems.map(item => renderSeriesCards && item.seriesId ? seriesCard(item, favoriteIds) : card(item, progressMap, favoriteIds, directOpen, coverChoices)).join("") || '<div class="empty">Nenhum item nesta coleção.</div>'}</div></section>${likedCollection}`;
  }

