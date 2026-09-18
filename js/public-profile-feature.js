export function createPublicProfileFeature(deps) {
  const {
    $,
    $$,
    activateOfflineMode,
    avatarMarkup,
    buildPublicProfileActivity,
    canAccessStickerAlbum,
    canModerateProfile,
    card,
    cleanUsername,
    completedSeriesItems,
    escapeHTML,
    factionDot,
    followSummary,
    isSeriesId,
    loadProfileWallComments,
    loadTop10Lists,
    officialAiBadge,
    openAuthPage,
    profileStickerMarkup,
    profileWallMarkup,
    publicCollectionItems,
    publicProfileHref,
    render,
    renderPublicBlogCollectionPage,
    renderPublicCollectionPage,
    renderShelfLikePage,
    safeTitleColor,
    sb,
    setSection,
    shelfCollectionMarkup,
    shelfItemsByIds,
    state,
    stickerAlbumMarkup,
    toast,
    trophyRoom,
    uniqueCatalogItems,
  } = deps;

  function subscribePublicStickerUpdates(ownerId) {
    state.publicStickerChannel?.unsubscribe?.();
    state.publicStickerChannel = null;
    if (!sb || !state.session?.user?.id || state.session.offline || navigator.onLine === false || !ownerId) return;
    const channel = sb.channel(`sticker-album-${ownerId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "sticker_slot_preferences", filter: `user_id=eq.${ownerId}` }, payload => {
        const profile = state.publicProfile;
        if (!profile?.stickerSlotPreferences) return;
        const row = payload.eventType === "DELETE" ? payload.old : payload.new;
        const key = String(row?.character_id || "");
        if (!key) return;
        if (payload.eventType === "DELETE" || row.blocked !== true) profile.stickerSlotPreferences.delete(key);
        else profile.stickerSlotPreferences.set(key, { blocked: true, placedBy: row.placed_by || null });
        if (state.section === "public-profile" && String(profile.profile?.id) === String(ownerId) && profile.album) render();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "sticker_awards", filter: `user_id=eq.${ownerId}` }, payload => {
        const profile = state.publicProfile;
        if (!profile?.stickerAwards) return;
        const row = payload.eventType === "DELETE" ? payload.old : payload.new;
        const index = profile.stickerAwards.findIndex(award => String(award.id) === String(row?.id));
        if (payload.eventType === "DELETE") {
          if (index >= 0) profile.stickerAwards.splice(index, 1);
        } else if (index >= 0) {
          profile.stickerAwards[index] = { ...profile.stickerAwards[index], ...row };
        } else if (row?.id) {
          profile.stickerAwards.push(row);
        }
        if (state.section === "public-profile" && String(profile.profile?.id) === String(ownerId) && profile.album) render();
      })
      .subscribe();
    state.publicStickerChannel = channel;
  }

  const PUBLIC_PROFILE_BASIC_COLUMNS = "id, username, avatar_url, profile_banner_url, profile_sticker_award_id, title, title_color, profile_background_theme, profile_accent_theme, plan, faction_id, profile_hidden, is_banned, shelf_saved_public, shelf_saved_public_collections, shelf_series_public, shelf_read_public, shelf_completed_public, shelf_liked_public, shelf_blogs_public, profile_wall_public, profile_activity_public, allow_messages, allow_sticker_requests";
  const PUBLIC_PROFILE_FULL_COLUMNS = "id, username, avatar_url, profile_banner_url, profile_sticker_award_id, title, title_color, profile_background_theme, profile_accent_theme, plan, xp, level, daily_streak, last_seen_at, faction_id, wall_description, profile_wall_public, shelf_saved_public, shelf_saved_public_collections, shelf_series_public, shelf_read_public, shelf_completed_public, shelf_liked_public, shelf_blogs_public, profile_activity_public, allow_messages, allow_sticker_requests, shelf_sort_orders, shelf_styles, profile_hidden, is_banned";

  async function loadPublicProfile(username, collectionId = null, album = false, options = {}) {
    if (navigator.onLine === false || state.session?.offline) {
      activateOfflineMode();
      setSection("downloads");
      return;
    }
    const top10LoadRevision = state.top10Revision;
    const sameProfile = state.publicProfile?.profile
      && cleanUsername(state.publicProfile.profile.username) === cleanUsername(username);
    const requestedPublicShelfTab = options.top10ListId ? "top10" : sameProfile ? state.publicShelfTab : "collections";
    state.publicProfile = sameProfile
      ? { ...state.publicProfile, username, collectionId, album, top10ListId: options.top10ListId || null, loading: false, detailsLoading: true }
      : { loading: true, username, collectionId, album, top10ListId: options.top10ListId || null };
    state.publicShelfTab = requestedPublicShelfTab;
    state.collectionFilter = { field: "all", query: "" };
    state.section = "public-profile";
    render();
    if (!sb) {
      state.publicProfile = { error: "A autenticação ainda não foi configurada.", username };
      render();
      return;
    }
    let profile = await sb.from("profiles_public").select(`${options.basicOnly ? PUBLIC_PROFILE_BASIC_COLUMNS : PUBLIC_PROFILE_FULL_COLUMNS}, is_bot, is_official, bot_type`)[options.basicOnly ? "eq" : "ilike"]("username", username).maybeSingle();
    if (profile.error) {
      // Uma coluna opcional nova pode ainda não existir em instalações que
      // não aplicaram todas as migrations. Não descarte as preferências de
      // visibilidade nesse caso: elas são necessárias para renderizar o
      // perfil público de outras pessoas corretamente.
      profile = await sb.from("profiles_public").select(`${options.basicOnly ? PUBLIC_PROFILE_BASIC_COLUMNS : PUBLIC_PROFILE_FULL_COLUMNS}, is_bot, is_official, bot_type`)[options.basicOnly ? "eq" : "ilike"]("username", username).maybeSingle();
    }
    if (profile.error || !profile.data) {
      state.publicProfile = { error: "Perfil não encontrado.", username };
      render();
      return;
    }
    if (["moderator", "banca", "admin"].includes(state.profile?.plan)) {
      const moderation = await sb.rpc("get_profile_moderation_status", { p_user_id: profile.data.id });
      if (!moderation.error && moderation.data) Object.assign(profile.data, moderation.data);
    }
    const viewerId = state.session?.user?.id;
    const blockRows = viewerId && viewerId !== profile.data.id
      ? await Promise.all([
        sb.from("profile_blocks").select("blocker_id, blocked_id").eq("blocker_id", viewerId).eq("blocked_id", profile.data.id).maybeSingle(),
        sb.from("profile_blocks").select("blocker_id, blocked_id").eq("blocker_id", profile.data.id).eq("blocked_id", viewerId).maybeSingle()
      ])
      : [];
    const block = blockRows.find(result => !result.error && result.data)?.data || null;
    if (block) {
      state.publicProfile = { profile: profile.data, username, collectionId, album, top10ListId: options.top10ListId || null, blocked: true, blockedByMe: block.blocker_id === viewerId };
      render();
      return;
    }
    // O cabeçalho não precisa esperar a estante inteira. Mostra o perfil básico
    // assim que a primeira consulta termina e preenche os dados abaixo em lote.
    state.publicProfile = {
      profile: profile.data,
      username,
      collectionId,
      album,
      top10ListId: options.top10ListId || null,
      loading: false,
      detailsLoading: true,
      stickerAwards: [],
      profileDisplayStickers: [],
      stickerSlotPreferences: new Map(),
      collections: [],
      blogCollections: [],
      authoredBlogPosts: [],
      savedBlogPosts: [],
      collectionBlogPosts: [],
      favoriteIds: new Set(),
      favoriteAddedAt: new Map(),
      comicLikeAddedAt: new Map(),
      savedPublishers: [],
      savedImprints: [],
      savedCharacters: [],
      comicLikeIds: new Set(),
      readingProgress: new Map(),
      achievements: [],
      collectionLikes: new Set(),
      collectionLikeCounts: new Map(),
      coverChoices: new Map(),
      coverStyles: new Map(),
      seriesCoverChoices: new Map(),
      savedPublicCollections: [],
      top10Lists: [],
      wallComments: [],
      activity: [],
      moderationHistory: [],
      isFollowing: false,
      followerCount: 0,
      followingCount: 0,
    };
    render();
    if (options.basicOnly) return;
    const [favorites, savedPublishersResult, savedImprintsResult, savedCharactersResult, progress, stickerAwards, stickerSlotPreferences, profileDisplayStickersResult, activityResults] = await Promise.all([
      sb.from("favorites").select("item_id, created_at").eq("user_id", profile.data.id),
      sb.from("publisher_saves").select("publisher_key, publisher_name, created_at").eq("user_id", profile.data.id).order("created_at", { ascending: false }),
      sb.from("imprint_saves").select("imprint_key, imprint_name, created_at").eq("user_id", profile.data.id).order("created_at", { ascending: false }),
      sb.from("character_saves").select("character_key, character_name, created_at").eq("user_id", profile.data.id).order("created_at", { ascending: false }),
      sb.from("reading_progress").select("item_id, page, total_pages, completed, completion_source, updated_at").eq("user_id", profile.data.id),
      sb.from("sticker_awards").select("id, user_id, character_id, character_name, publisher_name, edition_fingerprint, cover_item_id, cover_url, rarity, requests_blocked, gum_placed_by, album_section, awarded_at").eq("user_id", profile.data.id).order("awarded_at", { ascending: false }),
      sb.from("sticker_slot_preferences").select("character_id, blocked, placed_by").eq("user_id", profile.data.id),
      sb.from("profile_display_stickers").select("award_id, slot").eq("user_id", profile.data.id).order("slot", { ascending: true }),
      Promise.all([
      sb.from("comic_likes").select("item_id, created_at").eq("user_id", profile.data.id),
      sb.from("blog_likes").select("blog_id, created_at").eq("user_id", profile.data.id),
      sb.from("shelf_collection_likes").select("owner_id, collection_id, created_at").eq("user_id", profile.data.id),
      sb.from("profile_follows").select("following_id, created_at").eq("follower_id", profile.data.id),
      sb.from("comments").select("id, item_id, body, created_at").eq("user_id", profile.data.id),
      sb.from("blog_comments").select("id, blog_id, body, created_at").eq("user_id", profile.data.id),
      sb.from("profile_wall_comments").select("id, profile_id, body, created_at").eq("user_id", profile.data.id),
      sb.from("favorites").select("item_id, created_at").eq("user_id", profile.data.id),
      sb.from("blog_saves").select("blog_id, created_at").eq("user_id", profile.data.id),
      sb.from("shelf_collection_saves").select("owner_id, collection_id, created_at").eq("user_id", profile.data.id),
      sb.from("publisher_saves").select("publisher_name, created_at").eq("user_id", profile.data.id),
      sb.from("reading_progress").select("item_id, updated_at").eq("user_id", profile.data.id).eq("completed", true)
      ])
    ]);
    // A atividade já traz a mesma lista de curtidas necessária para a estante.
    const comicLikes = { data: activityResults[0]?.data || [] };
    let collections = await sb.from("shelf_collections").select("id, name, cover_url, is_public, item_ids, collection_type, blog_ids, is_featured, cover_styles, cover_choices, sort_order").eq("owner_id", profile.data.id).order("created_at", { ascending: true });
    if (collections.error) {
      collections = await sb.from("shelf_collections").select("id, name, cover_url, is_public, item_ids, collection_type, blog_ids, is_featured").eq("owner_id", profile.data.id).order("created_at", { ascending: true });
    }
    const authoredBlogs = await sb.from("blog_posts").select("id, author_id, title, excerpt, cover_url, image_2_url, image_3_url, status, is_featured, created_at, published_at").eq("author_id", profile.data.id).eq("status", "published").order("published_at", { ascending: false });
    const publicCollectionBlogIds = [...new Set((collections.data || []).filter(collection => collection.collection_type === "blog" && collection.is_public !== false).flatMap(collection => Array.isArray(collection.blog_ids) ? collection.blog_ids : []))];
    const collectionBlogs = publicCollectionBlogIds.length ? await sb.from("blog_posts").select("id, author_id, title, excerpt, cover_url, image_2_url, image_3_url, status, is_featured, created_at, published_at").in("id", publicCollectionBlogIds).eq("status", "published") : { data: [] };
    const publicBlogSaves = profile.data.shelf_blogs_public !== false ? await sb.from("blog_saves").select("blog_id").eq("user_id", profile.data.id) : { data: [] };
    const publicSavedBlogIds = (publicBlogSaves.data || []).map(row => row.blog_id);
    const savedBlogs = publicSavedBlogIds.length ? await sb.from("blog_posts").select("id, author_id, title, excerpt, cover_url, image_2_url, image_3_url, status, is_featured, created_at, published_at").in("id", publicSavedBlogIds).eq("status", "published") : { data: [] };
    const [achievements, likes, followers, following, moderationHistory, publicCoverChoicesResult, publicCoverStylesResult, publicSeriesCoverChoicesResult, savedCollectionLinks] = await Promise.all([
      sb.from("user_achievements").select("achievements(name, description, icon)").eq("user_id", profile.data.id),
      sb.from("shelf_collection_likes").select("collection_id, user_id").eq("owner_id", profile.data.id),
      sb.from("profile_follows").select("follower_id").eq("following_id", profile.data.id),
      sb.from("profile_follows").select("following_id").eq("follower_id", profile.data.id),
      ["moderator", "banca", "admin"].includes(state.profile?.plan)
        ? sb.from("moderation_actions").select("id, actor_id, action, duration_until, reason, internal_note, details, created_at").eq("target_id", profile.data.id).order("created_at", { ascending: false })
        : { data: [] },
      ["premium", "moderator", "banca", "admin"].includes(profile.data.plan)
        ? sb.from("user_cover_choices").select("item_id, variant_key, label, cover_url").eq("user_id", profile.data.id)
        : { data: [] },
      sb.from("user_cover_styles").select("item_id, style").eq("user_id", profile.data.id),
      sb.from("user_series_cover_choices").select("series_id, item_id, cover_url, variant_key, is_variant").eq("user_id", profile.data.id),
      sb.from("shelf_collection_saves").select("collection_id, owner_id").eq("user_id", profile.data.id)
    ]);
    const top10Lists = await loadTop10Lists(profile.data.id);
    const currentPublicProfile = state.publicProfile?.profile || state.publicProfile;
    const samePublicProfile = cleanUsername(currentPublicProfile?.username || "") === cleanUsername(username);
    const preservedTop10Lists = samePublicProfile && top10LoadRevision !== state.top10Revision
      ? (state.publicProfile?.top10Lists || top10Lists)
      : top10Lists;
    const isFollowing = state.session?.user?.id ? (followers.data || []).some(row => row.follower_id === state.session.user.id) : false;
    const actorIds = [...new Set((moderationHistory.data || []).map(entry => entry.actor_id).filter(Boolean))];
    const actors = actorIds.length ? await sb.from("profiles_public").select("id, username").in("id", actorIds) : { data: [] };
    const actorNames = new Map((actors.data || []).map(actor => [actor.id, actor.username]));
    const collectionLikes = new Set((likes.data || []).filter(row => row.user_id === state.session?.user?.id).map(row => row.collection_id));
    const collectionLikeCounts = (likes.data || []).reduce((counts, row) => counts.set(row.collection_id, (counts.get(row.collection_id) || 0) + 1), new Map());
    const publicCoverChoices = new Map((publicCoverChoicesResult.data || []).map(choice => [choice.item_id, choice]));
    const publicCoverStyles = new Map((publicCoverStylesResult.data || []).map(choice => [choice.item_id, choice.style]));
    const publicSeriesCoverChoices = new Map((publicSeriesCoverChoicesResult.data || []).map(choice => [choice.series_id, choice]));
    const savedCollectionIds = (savedCollectionLinks.data || []).map(row => row.collection_id);
    const savedCollectionsResult = savedCollectionIds.length
      ? await sb.from("shelf_collections").select("id, owner_id, name, cover_url, is_public, item_ids, collection_type, is_featured").in("id", savedCollectionIds).eq("is_public", true).eq("collection_type", "comic")
      : { data: [] };
    const savedOwnerIds = [...new Set((savedCollectionsResult.data || []).map(collection => collection.owner_id).filter(Boolean))];
    const savedOwnersResult = savedOwnerIds.length ? await sb.from("profiles_public").select("id, username").in("id", savedOwnerIds) : { data: [] };
    const savedOwners = new Map((savedOwnersResult.data || []).map(owner => [owner.id, owner.username]));
    const savedShelfCollections = (savedCollectionsResult.data || []).map(collection => ({ ...collection, username: savedOwners.get(collection.owner_id) || "" })).filter(collection => collection.username);
    const savedFactionIdsResult = await sb.from("faction_catalog_saves").select("catalog_id").eq("user_id", profile.data.id);
    const savedFactionIds = (savedFactionIdsResult.data || []).map(row => row.catalog_id);
    const savedFactionRows = savedFactionIds.length ? (await sb.from("faction_catalogs").select("id, faction_id, name, cover_url, item_ids, is_featured, created_at").in("id", savedFactionIds)).data || [] : [];
    const savedFactionIdsByFaction = [...new Set(savedFactionRows.map(catalog => catalog.faction_id).filter(Boolean))];
    const savedFactionInfoRows = savedFactionIdsByFaction.length ? (await sb.from("factions").select("id, page_key, name, emblem").in("id", savedFactionIdsByFaction)).data || [] : [];
    const savedFactionInfo = new Map(savedFactionInfoRows.map(faction => [faction.id, faction]));
    const savedFactionCollections = savedFactionRows.map(catalog => {
      const faction = savedFactionInfo.get(catalog.faction_id);
      return faction ? { ...catalog, id: `faction-catalog-${catalog.id}`, catalog_id: catalog.id, faction_id: faction.id, faction_page_key: faction.page_key, faction_name: faction.name, faction_emblem: faction.emblem, username: "", collection_type: "comic", is_public: true, is_faction_catalog: true } : null;
    }).filter(Boolean);
    const savedPublicCollections = [...savedShelfCollections, ...savedFactionCollections];
    const wallCommentsResult = await loadProfileWallComments(profile.data.id);
    const activity = await buildPublicProfileActivity(profile.data, activityResults.map(result => result.data || []), [...(collections.data || []), ...(savedCollectionsResult.data || [])]);
    state.publicProfile = {
      profile: profile.data,
      collectionId,
      album,
      top10ListId: options.top10ListId || null,
      stickerAwards: stickerAwards.data || [],
      profileDisplayStickers: profileDisplayStickersResult.data || [],
      stickerSlotPreferences: new Map((stickerSlotPreferences.data || []).map(row => [String(row.character_id), { blocked: row.blocked === true, placedBy: row.placed_by || null }])),
      collections: (collections.data || []).filter(collection => collection.collection_type !== "blog").map(collection => ({ id: collection.id, name: collection.name, coverUrl: collection.cover_url || "", isPublic: collection.is_public !== false, is_featured: collection.is_featured === true, itemIds: Array.isArray(collection.item_ids) ? collection.item_ids : [], sortOrder: collection.sort_order || "added_desc", coverStyles: collection.cover_styles || {}, coverChoices: collection.cover_choices || {} })),
      blogCollections: (collections.data || []).filter(collection => collection.collection_type === "blog").map(collection => ({ id: collection.id, name: collection.name, coverUrl: collection.cover_url || "", isPublic: collection.is_public !== false, is_featured: collection.is_featured === true, blogIds: Array.isArray(collection.blog_ids) ? collection.blog_ids : [] })),
      authoredBlogPosts: authoredBlogs.data || [],
      savedBlogPosts: savedBlogs.data || [],
      collectionBlogPosts: collectionBlogs.data || [],
      favoriteIds: new Set((favorites.data || []).map(row => row.item_id)),
      favoriteAddedAt: new Map((favorites.data || []).map(row => [row.item_id, row.created_at])),
      comicLikeAddedAt: new Map((comicLikes.data || []).map(row => [row.item_id, row.created_at])),
      savedPublishers: savedPublishersResult.data || [],
      savedImprints: savedImprintsResult.data || [],
      savedCharacters: savedCharactersResult.data || [],
      comicLikeIds: new Set((comicLikes.data || []).map(row => row.item_id)),
      readingProgress: new Map((progress.data || []).map(row => [row.item_id, row])),
      achievements: (achievements.data || []).map(row => row.achievements).filter(Boolean),
      collectionLikes,
      collectionLikeCounts,
      coverChoices: publicCoverChoices
      ,coverStyles: publicCoverStyles
      ,seriesCoverChoices: publicSeriesCoverChoices
      ,savedPublicCollections
      ,top10Lists: preservedTop10Lists
      ,wallComments: wallCommentsResult
      ,activity
      ,moderationHistory: (moderationHistory.data || []).map(entry => ({ ...entry, actor_username: actorNames.get(entry.actor_id) || "moderador" }))
      ,isFollowing
      ,followerCount: (followers.data || []).length
      ,followingCount: (following.data || []).length
      ,detailsLoading: false
    };
    subscribePublicStickerUpdates(profile.data.id);
    render();
    if (options.top10ListId) requestAnimationFrame(() => $(`[data-top10-list-card="${options.top10ListId}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" }));
  }

  async function deletePublicCollection(ownerId, collectionId) {
    if (!["moderator", "banca", "admin"].includes(state.profile?.plan)) return;
    const result = await sb.from("shelf_collections").delete().eq("owner_id", ownerId).eq("id", collectionId);
    if (result.error) return toast("Não foi possível excluir a coleção.");
    toast("Coleção pública excluída.");
    await loadPublicProfile(state.publicProfile.profile.username, null);
  }

  function openProfileBlockConfirm(profile, blocked) {
    return new Promise(resolve => {
      const overlay = document.createElement("div");
      overlay.className = "modal-backdrop";
      overlay.innerHTML = `<div class="modal profile-block-confirm-modal"><div class="section-head"><div><div class="eyebrow">Privacidade</div><h2>${blocked ? "Desbloquear usuário?" : "Bloquear usuário?"}</h2><div class="section-subtitle">${blocked ? "Este usuário poderá voltar a ver seu perfil e interagir com você." : "Este usuário não poderá enviar mensagens, comentar no seu mural ou acessar seu perfil, histórico e coleções."}</div></div><button type="button" class="small-btn" data-close>Cancelar</button></div><div class="modal-actions"><button type="button" class="small-btn" data-close>Cancelar</button><button type="button" class="btn btn-danger" data-confirm-block>${blocked ? "Desbloquear" : "Bloquear"}</button></div></div>`;
      $("#modal-root").appendChild(overlay);
      const finish = value => { overlay.remove(); resolve(value); };
      $$('[data-close]', overlay).forEach(button => button.onclick = () => finish(false));
      $("[data-confirm-block]", overlay).onclick = () => finish(true);
    });
  }

  async function toggleProfileBlock(profile) {
    if (!state.session || !sb) return openAuthPage();
    if (!profile?.id || profile.id === state.session.user.id) return;
    const blocked = Boolean(state.publicProfile?.blockedByMe);
    if (!await openProfileBlockConfirm(profile, blocked)) return;
    const query = sb.from("profile_blocks");
    const result = blocked
      ? await query.delete().eq("blocker_id", state.session.user.id).eq("blocked_id", profile.id)
      : await query.insert({ blocker_id: state.session.user.id, blocked_id: profile.id });
    if (result.error) return toast(result.error.message || "Não foi possível atualizar o bloqueio.");
    await loadPublicProfile(profile.username);
  }

  async function toggleProfileFollow(profile) {
    if (!state.session) return openAuthPage();
    if (!profile?.id || profile.id === state.session.user.id) return;
    const publicState = state.publicProfile;
    const following = Boolean(publicState?.isFollowing);
    const query = sb.from("profile_follows");
    const result = following
      ? await query.delete().eq("follower_id", state.session.user.id).eq("following_id", profile.id)
      : await query.insert({ follower_id: state.session.user.id, following_id: profile.id });
    if (result.error) return toast("Não foi possível atualizar o acompanhamento.");
    publicState.isFollowing = !following;
    publicState.followerCount = Math.max(0, (publicState.followerCount || 0) + (following ? -1 : 1));
    state.followingCount = Math.max(0, (state.followingCount || 0) + (following ? -1 : 1));
    render();
  }

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


  return {
    loadPublicProfile,
    deletePublicCollection,
    toggleProfileBlock,
    toggleProfileFollow,
    renderPublicProfilePage
  };
}
