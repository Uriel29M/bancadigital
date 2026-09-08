  function card(item, progressMap = state.readingProgress, favoriteIds = state.favoriteIds, directOpen = false, coverChoices = null, seriesContext = false, collectionContext = null) {
    const publicCollection = state.section === "public-profile" && state.publicProfile?.collectionId
      ? state.publicProfile.collections?.find(collection => collection.id === state.publicProfile.collectionId)
      : null;
    const activeCollectionContext = collectionContext || (publicCollection ? { id: publicCollection.id, ownerId: state.publicProfile.profile.id, coverStyles: new Map(Object.entries(publicCollection.coverStyles || {})), coverChoices: new Map(Object.entries(publicCollection.coverChoices || {})) } : null);
    const completed = progressFor(item, progressMap)?.completed;
    const displayTitle = itemDisplayTitle(item);
    const issueLabel = itemIssueLabel(item);
    const coverVariants = usableCoverVariants(item);
    const hasCoverVariants = coverVariants.length > 0;
    const savedForCover = favoriteIds.has(item.id) || (seriesContext && item.seriesId && favoriteIds.has(item.seriesId));
    const collectionOwner = activeCollectionContext?.ownerId === state.session?.user?.id;
    const adminCanChooseCover = state.profile?.plan === "admin" && !activeCollectionContext?.id;
    const canChooseCover = state.session && hasLegendaryAccess() && (collectionOwner || adminCanChooseCover || (favoriteIds === state.favoriteIds && savedForCover)) && hasCoverVariants;
    const coverStyle = coverStyleFor(item, activeCollectionContext?.coverStyles || null);
    const hidden = isHiddenCatalogItem(item);
    const canSetCoverStyle = collectionOwner || (Boolean(state.session) && favoriteIds === state.favoriteIds);
    const coverEffects = coverStyleControl(item.id, coverStyle, canSetCoverStyle, activeCollectionContext?.id || "");
    const authors = String(item.author || "").split(/\s*(?:\/|&|\be\b)\s*/i).map(value => value.trim()).filter(Boolean);
    const entityButton = (kind, value, label = value) => value ? `<button type="button" class="card-entity-link" data-entity-kind="${escapeHTML(kind)}" data-entity-value="${escapeHTML(value)}">${escapeHTML(label)}</button>` : "";
    const characterButtons = entityButton("character", characterNames(item)[0]);
    const cardActions = `<div class="card-actions"><button class="card-like ${state.comicLikeIds.has(item.id) ? "is-liked" : ""}" data-like-item="${escapeHTML(item.id)}" title="Curtir quadrinho">${state.comicLikeIds.has(item.id) ? "♥" : "♡"} ${state.comicLikeCounts.get(item.id) || 0}</button><button class="card-share" data-share-item="${escapeHTML(item.id)}" title="Compartilhar quadrinho">Compartilhar</button><button class="card-comment" data-comment-item="${escapeHTML(item.id)}" title="Ver comentarios">Comentários</button>${item.seriesId ? `<button class="card-series" data-view-series="${escapeHTML(item.seriesId)}" title="Ver serie">Série</button>` : ""}</div>`;
    return `
      <div class="card-wrap"><article class="card ${hidden ? "is-hidden-catalog-item" : ""}" data-open="${escapeHTML(item.id)}" ${(directOpen || (state.section === "public-profile" && state.publicProfile?.collectionId)) ? "data-open-direct=\"true\"" : ""}>
          <div class="cover" data-cover-id="${escapeHTML(item.id)}" data-cover-style="${escapeHTML(coverStyle)}" style="background-image:url('${escapeHTML(coverFor(item, "card", activeCollectionContext?.coverChoices || coverChoices))}')">
          <span class="cover-number">${escapeHTML(issueLabel)}</span>
          ${hidden && isStaffProfile() ? '<span class="card-hidden-badge">OCULTA</span>' : ""}
          <button class="card-favorite ${favoriteIds.has(item.id) ? 'is-favorite' : ''}" data-favorite="${escapeHTML(item.id)}" title="Salvar na estante">★</button>
          ${isAdminProfile() ? `<button type="button" class="card-metadata-toggle" data-edit-item="${escapeHTML(item.id)}" title="Ver e editar metadados" aria-label="Ver e editar metadados">✎</button>` : ""}
        </div>
        ${completed ? '<div class="card-completed">✓ Lida</div>' : ''}
        ${state.session && item.type === "comic" ? (() => { const download = downloaded(item.id); const status = download?.status || "idle"; return `<button class="card-download ${isAdminProfile() ? "card-download-admin-offset" : ""} ${status === "completed" ? "is-downloaded" : status === "downloading" ? "is-downloading" : ""}" data-download="${escapeHTML(item.id)}" title="${status === "completed" ? "Excluir download offline" : status === "downloading" ? "Download em andamento" : "Permitir leitura offline"}">${status === "downloading" ? "…" : "↓"}</button>`; })() : ""}
        ${isAdminProfile() ? `<button type="button" class="card-hide-toggle ${hidden ? "is-hidden" : ""}" data-hide-item="${escapeHTML(item.id)}" title="${hidden ? "Mostrar edição para todos" : "Ocultar edição para usuários comuns"}" aria-label="${hidden ? "Mostrar edição para todos" : "Ocultar edição para usuários comuns"}">${hidden ? "◉" : "⊘"}</button>` : ""}
        <div class="card-body">
          <div class="card-title">${escapeHTML(displayTitle)}</div>
          <div class="card-meta">${entityButton("year", String(item.year || ""), String(item.year || ""))}${characterButtons}${entityButton("publisher", item.publisher)}${entityButton("imprint", item.imprint)}</div>
          ${authors.length ? `<div class="card-authors">${authors.map(author => entityButton("author", author)).join(" ")}</div>` : ""}
          <div class="card-stats"><span>♥ ${Number(item.clicks || 0).toLocaleString("pt-BR")} leituras</span>${canChooseCover ? `<button type="button" class="card-cover-choice" data-cover-choice="${escapeHTML(item.id)}" ${activeCollectionContext?.id ? `data-cover-choice-collection="${escapeHTML(activeCollectionContext.id)}"` : ""} title="${activeCollectionContext?.id ? "Capa variante somente nesta coleção" : "Escolher capa"}">${state.profile?.plan === "admin" && !activeCollectionContext?.id ? "Escolher capa" : "Capa"}</button>` : hasCoverVariants ? `<span class="card-variant-info" title="Esta edição possui capas variantes">Capa variante</span>` : ""}${coverEffects}</div>
          <div class="card-actions"><button class="card-like ${state.comicLikeIds.has(item.id) ? "is-liked" : ""}" data-like-item="${escapeHTML(item.id)}" title="Curtir quadrinho">${state.comicLikeIds.has(item.id) ? "♥" : "♡"} ${state.comicLikeCounts.get(item.id) || 0}</button><button class="card-share" data-share-item="${escapeHTML(item.id)}" title="Compartilhar quadrinho">Compartilhar</button><button class="card-comment" data-comment-item="${escapeHTML(item.id)}" title="Ver comentários">Comentários</button>${item.seriesId ? `<button class="card-series" data-view-series="${escapeHTML(item.seriesId)}" title="Ver série">Série</button>` : ""}</div>
        </div>
      </article>${cardActions}</div>`;
  }

