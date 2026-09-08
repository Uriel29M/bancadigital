  function renderShelfLikePage({ profile, own, savedItems, savedSeries, readItems, completedItems, likedItems, categories = [], profileState = null, profileActions = "" }) {
    const canEditPersonalCollections = own || isOwnShelfProfile();
    // Em perfis de outras pessoas, mostre somente os salvos de quem está
    // visitando: assim o item começa desmarcado, mas fica marcado ao salvá-lo.
    const isCurrentUsersProfile = own || String(profile?.id || "") === String(state.session?.user?.id || "");
    const displayedFavoriteIds = isCurrentUsersProfile
      ? (own ? state.favoriteIds : (profileState?.favoriteIds || state.favoriteIds))
      : state.favoriteIds;
    const actions = own
      ? '<button class="small-btn" data-action="profile">Editar perfil</button><button class="small-btn" data-action="logout">Sair</button>'
      : profileActions;
    const publicPrefix = own ? "" : "public-";
    const personalCollectionOrder = normalizePersonalCollectionOrder(shelfCollectionOrderForProfile(profile), categories);
    const orderedCategories = categories.slice().sort((a, b) => personalCollectionOrder.indexOf(String(a.id)) - personalCollectionOrder.indexOf(String(b.id)));
    let categoryMarkup = orderedCategories.map(category => {
      const items = own ? shelfItemsByIds(category.itemIds) : publicCollectionItems(category, profileState);
      const liked = !own && profileState?.collectionLikes?.has(category.id);
      const likes = !own ? profileState?.collectionLikeCounts?.get(category.id) || 0 : 0;
      let extra = canEditPersonalCollections
        ? `<span class="shelf-visibility ${category.isPublic !== false ? "is-public" : "is-private"}">${category.isPublic !== false ? "Pública" : "Privada"}</span>${category.isPublic !== false ? `<button class="small-btn" data-copy-collection="${escapeHTML(category.id)}">Compartilhar</button>` : ""}<button class="small-btn" data-shelf-edit-category="${escapeHTML(category.id)}">Editar</button><button class="small-btn danger" data-shelf-delete-category="${escapeHTML(category.id)}">Excluir</button>`
        : `<span class="shelf-visibility is-public">Pública</span><button class="small-btn ${liked ? "is-liked" : ""}" data-like-collection="${escapeHTML(category.id)}" data-like-owner="${escapeHTML(profile.id)}">${liked ? "♥" : "♡"} ${likes}</button><a class="small-btn" href="${escapeHTML(publicProfileHref(profile.username, category.id))}">Abrir coleção</a><button class="small-btn" data-copy-collection="${escapeHTML(category.id)}" data-copy-username="${escapeHTML(profile.username)}">Compartilhar</button>`;
      if (!own && canEditPersonalCollections) {
        extra += `<button class="small-btn ${liked ? "is-liked" : ""}" data-like-collection="${escapeHTML(category.id)}" data-like-owner="${escapeHTML(profile.id)}">${liked ? "♥" : "♡"} ${likes}</button>`;
      }
      extra += personalCollectionControls(category.id, categories, isOwnShelfProfile());
      return shelfCollectionMarkup(category.name, items, `${publicPrefix}category:${category.id}`, own ? state.readingProgress : profileState?.readingProgress, displayedFavoriteIds, extra, null, category.isSeries === true);
    }).join("");
    if (own || categories.length) categoryMarkup = `<section class="section shelf-categories"><div class="section-head shelf-categories-head"><div><h2 class="section-title">Coleções pessoais</h2><div class="section-subtitle">Misture séries e edições na mesma coleção</div></div>${canEditPersonalCollections ? '<button class="small-btn" data-shelf-new-category>+ Nova coleção</button>' : ""}</div>${categoryMarkup || '<div class="empty">Crie uma coleção para começar a organizar seus salvos.</div>'}</section>`;
    const ownTop10Profile = own || String(profile?.id || "") === String(state.session?.user?.id || "");
    const profileTop10Lists = (own ? state.top10Lists : (profileState?.top10Lists || [])).filter(list => ownTop10Profile || list.is_public !== false);
    return `<div class="content shelf-page${own ? "" : " public-profile-page"}"><div class="profile-header">${avatarMarkup(profile)}<div><div class="eyebrow">${factionDot(profile)}@${escapeHTML(profile?.username || "")}</div>${profile?.title ? `<div class="profile-title" style="--title-bg:${safeTitleColor(profile.title_color)}">${escapeHTML(profile.title)}</div>` : own ? "" : '<div class="section-subtitle">Perfil público</div>'}${trophyRoom(own ? state.achievements : profileState?.achievements)} </div><div class="profile-actions">${actions}</div></div><div class="section-head"><div><h1 class="section-title">Minha estante</h1><div class="section-subtitle">Coleções fixas para organizar seus quadrinhos e séries</div></div>${own ? '<button class="btn btn-danger" data-action="open-local-box">Abrir caixa</button>' : ""}</div><div class="notice local-box-notice"><b>Minha caixa:</b> leia arquivos do seu computador sem enviá-los para o servidor. Tudo fica apenas neste navegador e some quando você sair.</div>${savedItems.visible !== false ? shelfCollectionMarkup("Salvos", savedItems.items || savedItems, `${publicPrefix}saved`, own ? state.readingProgress : profileState?.readingProgress, displayedFavoriteIds) : ""}${savedSeries.visible !== false ? shelfCollectionMarkup("Séries salvas", savedSeries.items || savedSeries, `${publicPrefix}series-saved`, own ? state.readingProgress : profileState?.readingProgress, displayedFavoriteIds, "", null, true) : ""}${readItems.visible !== false ? shelfCollectionMarkup("Lidos", readItems.items || readItems, `${publicPrefix}read`, own ? state.readingProgress : profileState?.readingProgress, displayedFavoriteIds) : ""}${completedItems.visible !== false ? shelfCollectionMarkup("Concluídos", completedItems.items || completedItems, `${publicPrefix}completed`, own ? state.readingProgress : profileState?.readingProgress, displayedFavoriteIds, "", null, true) : ""}${likedItems.visible !== false ? shelfCollectionMarkup("Curtidos", likedItems.items || likedItems, `${publicPrefix}liked`, own ? state.readingProgress : profileState?.readingProgress, displayedFavoriteIds) : ""}${categoryMarkup}<div class="shelf-tab-panel shelf-top10-panel" data-shelf-tab-panel="top10">${top10Markup(profileTop10Lists, ownTop10Profile)}</div></div>`;
  }

