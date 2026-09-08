  function renderPublicProfilePage() {
    const publicState = state.publicProfile;
    if (!publicState || publicState.loading || (publicState.collectionId && publicState.detailsLoading)) return '<div class="content"><div class="empty">Carregando perfil...</div></div>';
    if (publicState.error) return `<div class="content"><div class="empty">${escapeHTML(publicState.error)}</div></div>`;
    const profile = publicState.profile;
    if (publicState.blocked) return `<div class="content public-profile-page"><section class="section blocked-profile-notice"><div class="eyebrow">Privacidade</div><h1 class="section-title">Perfil indisponível</h1><p>${publicState.blockedByMe ? "Você bloqueou este usuário. Ele não pode enviar mensagens, comentar no seu mural ou acessar seu histórico, coleções e foto." : "Este perfil não está disponível para você."}</p><div class="profile-actions"><button class="small-btn" data-section="home">Voltar ao início</button>${publicState.blockedByMe ? `<button class="small-btn" data-unblock-profile>Desbloquear</button>` : ""}</div></section></div>`;
    const savedVisible = profile.shelf_saved_public !== false;
    const seriesVisible = profile.shelf_series_public !== false;
    const readVisible = profile.shelf_read_public !== false;
    const completedVisible = profile.shelf_completed_public !== false;
    const likedVisible = profile.shelf_liked_public !== false;
    const wallVisible = profile.profile_wall_public !== false;
    const savedPublicCollectionsVisible = profile.shelf_saved_public_collections !== false;
    const activityVisible = profile.profile_activity_public !== false;
    const savedItems = shelfItemsByIds([...publicState.favoriteIds].filter(id => !isSeriesId(id)), false);
    const savedSeries = shelfItemsByIds([...publicState.favoriteIds].filter(isSeriesId), true);
    const readItems = shelfItemsByIds([...publicState.readingProgress.entries()].filter(([, row]) => row.completed).map(([id]) => id));
    const likedItems = uniqueCatalogItems(state.db.library.filter(item => publicState.comicLikeIds?.has(item.id)));
    const completedItems = completedSeriesItems(publicState.readingProgress);
    const publicCategories = (publicState.collections || []).filter(category => category.isPublic !== false);
    const publicBlogCollections = (publicState.blogCollections || []).filter(collection => collection.isPublic !== false);
    const selectedCategory = publicCategories.find(category => category.id === publicState.collectionId);
    const selectedBlogCollection = publicBlogCollections.find(collection => collection.id === publicState.collectionId);
    if (publicState.collectionId && selectedCategory) return renderPublicCollectionPage(publicState, selectedCategory);
    if (publicState.collectionId && selectedBlogCollection) return renderPublicBlogCollectionPage(publicState, selectedBlogCollection);
    if (publicState.album && !canAccessStickerAlbum(profile)) {
      return '<div class="content"><div class="empty">O álbum não está disponível para usuários Banca.</div></div>';
    }
    if (publicState.album) {
      const isOwnAlbum = Boolean(state.session?.user?.id && String(state.session.user.id) === String(profile.id));
      return stickerAlbumMarkup(profile, publicState.stickerAwards || [], { isOwn: isOwnAlbum, progressMap: publicState.readingProgress });
    }
    if (publicState.collectionId && !selectedCategory && !selectedBlogCollection) return `<div class="content"><div class="empty">Esta coleção não existe ou é privada.</div><a class="small-btn" href="${escapeHTML(publicProfileHref(profile.username))}">Voltar ao perfil</a></div>`;
    const canFollow = Boolean(state.session?.user?.id && state.session.user.id !== profile.id);
    const canBlock = canFollow;
    const isOwnProfile = Boolean(state.session?.user?.id && String(state.session.user.id) === String(profile.id));
    const canModerate = !isOwnProfile && canModerateProfile(profile);
    const publicProfileActions = isOwnProfile
      ? '<button class="small-btn" data-profile-sticker-choose>Figurinha</button><button class="small-btn" data-action="profile">Editar perfil</button><button class="small-btn" data-action="logout">Sair</button>'
      : `${canFollow ? `<button class="small-btn follow-button ${publicState.isFollowing ? "is-following" : ""}" data-follow-profile>${publicState.isFollowing ? "Seguindo" : "Seguir"}</button>` : ""}${canBlock ? `<button class="small-btn block-button" data-block-profile>Bloquear</button>` : ""}<button class="small-btn" data-section="home">Voltar ao início</button>${canModerate ? `<button class="small-btn moderation-button" data-open-moderation>Moderação</button>` : ""}`;
    return renderShelfLikePage({ profile, own: false, savedItems: { items: savedItems, visible: savedVisible }, savedSeries: { items: savedSeries, visible: seriesVisible }, readItems: { items: readItems, visible: readVisible }, completedItems: { items: completedItems, visible: completedVisible }, likedItems: { items: likedItems, visible: likedVisible }, categories: isOwnProfile ? (publicState.collections || []) : publicCategories, profileState: publicState, profileActions: publicProfileActions });
    const publicShelfMarkup = renderShelfLikePage({ profile, own: false, savedItems: { items: savedItems, visible: savedVisible }, savedSeries: { items: savedSeries, visible: seriesVisible }, readItems: { items: readItems, visible: readVisible }, completedItems: { items: completedItems, visible: completedVisible }, likedItems: { items: likedItems, visible: likedVisible }, categories: publicCategories, profileState: publicState });
    const profileActions = `${canFollow ? `<button class="small-btn follow-button ${publicState.isFollowing ? "is-following" : ""}" data-follow-profile>${publicState.isFollowing ? "Seguindo" : "Seguir"}</button>` : ""}${canBlock ? `<button class="small-btn block-button" data-block-profile>Bloquear</button>` : ""}<button class="small-btn" data-section="home">Voltar ao início</button>${canModerate ? `<button class="small-btn moderation-button" data-open-moderation>Moderação</button>` : ""}`;
    if (false) {
    return `<div class="content public-profile-page"><div class="profile-header">${profileStickerMarkup(profile, publicState.stickerAwards || [])}${avatarMarkup(profile)}<div><div class="eyebrow">${factionDot(profile)}@${escapeHTML(profile.username)}</div>${profile.title ? `<div class="profile-title" style="--title-bg:${safeTitleColor(profile.title_color)}">${escapeHTML(profile.title)}</div>` : '<div class="section-subtitle">Perfil público</div>'}${trophyRoom(publicState.achievements)}${followSummary(profile.id, publicState.followerCount, publicState.followingCount)}</div><div class="profile-actions">${profileActions}</div></div>${wallVisible ? profileWallMarkup(publicState) : '<section class="section"><div class="empty">O mural deste perfil está oculto.</div></section>'}</div>`;
    }
    return `<div class="content public-profile-page">
      <div class="profile-header">
        ${profileStickerMarkup(profile, publicState.stickerAwards || [])}${avatarMarkup(profile)}
        <div>
          <div class="eyebrow">${factionDot(profile)}@${escapeHTML(profile.username)} ${officialAiBadge(profile)}</div>
          ${profile.title ? `<div class="profile-title" style="--title-bg:${safeTitleColor(profile.title_color)}">${escapeHTML(profile.title)}</div>` : '<div class="section-subtitle">Perfil público</div>'}
          ${trophyRoom(publicState.achievements)}
          ${followSummary(profile.id, publicState.followerCount, publicState.followingCount)}
        </div>
      </div>
      <div class="section-head"><div><h1 class="section-title">Estante de @${escapeHTML(profile.username)}</h1><div class="section-subtitle">${publicState.followerCount || 0} seguidores · ${publicState.followingCount || 0} seguindo · Coleções públicas do perfil</div></div><div class="profile-actions">${canFollow ? `<button class="small-btn follow-button ${publicState.isFollowing ? "is-following" : ""}" data-follow-profile>${publicState.isFollowing ? "Seguindo" : "Seguir"}</button>` : ""}${canBlock ? `<button class="small-btn block-button" data-block-profile>Bloquear</button>` : ""}<button class="small-btn" data-section="home">Voltar ao início</button>${canModerate ? `<button class="small-btn moderation-button" data-open-moderation>Moderação</button>` : ""}</div></div>
      ${savedVisible ? shelfCollectionMarkup("Salvos", savedItems, "public-saved", publicState.readingProgress, publicState.favoriteIds) : '<div class="notice">A coleção Salvos está oculta neste perfil.</div>'}
      ${seriesVisible ? shelfCollectionMarkup("Séries salvas", savedSeries, "public-series-saved", publicState.readingProgress, publicState.favoriteIds, "", null, true) : '<div class="notice">A coleção Séries salvas está oculta neste perfil.</div>'}
      ${readVisible ? shelfCollectionMarkup("Lidos", readItems, "public-read", publicState.readingProgress, publicState.favoriteIds) : '<div class="notice">A coleção Lidos está oculta neste perfil.</div>'}
      ${completedVisible ? shelfCollectionMarkup("Concluídos", completedItems, "public-completed", publicState.readingProgress, publicState.favoriteIds, "", null, true) : '<div class="notice">A coleção Concluídos está oculta neste perfil.</div>'}
      ${likedVisible ? shelfCollectionMarkup("Curtidos", likedItems, "public-liked", publicState.readingProgress, publicState.favoriteIds) : '<div class="notice">A coleção Curtidos está oculta neste perfil.</div>'}
      ${publicCategories.map(category => { const items = publicCollectionItems(category, publicState); const liked = publicState.collectionLikes?.has(category.id); const likes = publicState.collectionLikeCounts?.get(category.id) || 0; return shelfCollectionMarkup(category.name, items, `public-category:${category.id}`, publicState.readingProgress, publicState.favoriteIds, `<span class="shelf-visibility is-public">Pública</span><button class="small-btn ${liked ? "is-liked" : ""}" data-like-collection="${escapeHTML(category.id)}" data-like-owner="${escapeHTML(profile.id)}">${liked ? "♥" : "♡"} ${likes}</button><a class="small-btn" href="${escapeHTML(publicProfileHref(profile.username, category.id))}">Abrir coleção</a><button class="small-btn" data-copy-collection="${escapeHTML(category.id)}" data-copy-username="${escapeHTML(profile.username)}">Compartilhar</button>`); }).join("")}
    </div>`;
  }

