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
    let profile = await sb.from("profiles").select(`${options.basicOnly ? PUBLIC_PROFILE_BASIC_COLUMNS : PUBLIC_PROFILE_FULL_COLUMNS}, is_bot, is_official, bot_type`)[options.basicOnly ? "eq" : "ilike"]("username", username).maybeSingle();
    if (profile.error) {
      // Uma coluna opcional nova pode ainda não existir em instalações que
      // não aplicaram todas as migrations. Não descarte as preferências de
      // visibilidade nesse caso: elas são necessárias para renderizar o
      // perfil público de outras pessoas corretamente.
      profile = await sb.from("profiles").select(`${options.basicOnly ? PUBLIC_PROFILE_BASIC_COLUMNS : PUBLIC_PROFILE_FULL_COLUMNS}, is_bot, is_official, bot_type`)[options.basicOnly ? "eq" : "ilike"]("username", username).maybeSingle();
    }
    if (profile.error || !profile.data) {
      state.publicProfile = { error: "Perfil não encontrado.", username };
      render();
      return;
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
    const actors = actorIds.length ? await sb.from("profiles").select("id, username").in("id", actorIds) : { data: [] };
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
    const savedOwnersResult = savedOwnerIds.length ? await sb.from("profiles").select("id, username").in("id", savedOwnerIds) : { data: [] };
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

