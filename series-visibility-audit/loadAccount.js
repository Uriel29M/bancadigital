  async function loadAccount() {
    const offlineAccount = readOfflineAccount();
    if (!sb) {
      if (offlineAccount?.user) {
        state.session = { user: offlineAccount.user, offline: true };
        state.profile = offlineProfileFor(offlineAccount.user, offlineAccount.profile, offlineAccount.username);
        loadDownloads();
        syncTopAvatar();
      }
      characterSettingsReady = true;
      state.authReady = true;
      render();
      return;
    }
    let remoteSession = null;
    try {
      const sessionResult = await sb.auth.getSession();
      remoteSession = sessionResult?.data?.session || null;
    } catch (error) {
      // Sem rede, o cliente Auth pode rejeitar em vez de devolver uma sessão nula.
      console.warn("Sessão online indisponível; usando a sessão local.", error);
    }
    // Mantém a conta visível após recarregar sem internet. O funcionamento
    // offline continua restrito aos arquivos da área Downloads.
    const browserOffline = navigator.onLine === false;
    const offlineFallback = offlineAccount?.user ? { user: offlineAccount.user, offline: true } : null;
    // A conta local só pode ser usada como sessão offline quando o navegador
    // realmente está sem conexão. Se o Auth falhar online, mantenha o app
    // online/anônimo para não prender o usuário na área Downloads.
    const session = browserOffline ? offlineFallback : remoteSession;
    state.session = session?.user ? session : null;
    // O ranking é público e não deve depender da conclusão do carregamento da
    // conta/estante. Inicie-o logo para visitantes sem sessão também.
    if (state.section === "ranking") loadRankingData();
    if (remoteSession?.user) {
      // Persiste a identidade assim que a sessão é reconhecida. A senha e os
      // tokens continuam sob responsabilidade do Supabase Auth.
      saveOfflineAccount(null);
    }
    if (state.session?.offline) {
      state.profile = offlineProfileFor(state.session.user, offlineAccount?.profile, offlineAccount?.username);
      loadDownloads();
      characterSettingsReady = true;
      state.authReady = true;
      syncTopAvatar();
      render();
      return;
    }
    if (!remoteSession && !navigator.onLine) {
      if (!state.session?.offline) {
        state.profile = null;
        characterSettingsReady = true;
        state.authReady = true;
        render();
        return;
      }
      state.profile = offlineProfileFor(state.session.user, offlineAccount?.profile, offlineAccount?.username);
      loadDownloads();
      characterSettingsReady = true;
      state.authReady = true;
      syncTopAvatar();
      render();
      return;
    }
    await loadCatalogVisibility();
    await loadCoverCatalog();
    await loadCoverChoices(session?.user?.id);
    await loadCoverStyles(session?.user?.id);
    await loadSeriesCoverChoices(session?.user?.id);
    const publisherSettings = await sb.from("publisher_settings").select("publisher_key, publisher_name, cover_url, is_pinned");
    state.publisherSettings = new Map((publisherSettings.data || []).map(setting => [setting.publisher_key, setting]));
    const imprintSettings = await sb.from("imprint_settings").select("imprint_key, imprint_name, cover_url, wikipedia_url, is_pinned");
    state.imprintSettings = new Map((imprintSettings.data || []).map(setting => [setting.imprint_key, setting]));
    const characterSettings = await sb.from("character_settings").select("character_key, character_name, character_type, character_alignment, redirect_character_key, assigned_character_keys, cover_url, wikipedia_url, authored_text, is_pinned, is_hidden, deviantart_fanarts_enabled, deviantart_gallery_url, deviantart_fanart_image_urls");
    state.characterSettings = new Map((characterSettings.data || []).map(setting => [setting.character_key, setting]));
    characterSettingsReady = true;
    wikiCharacterImageCache.clear();
    const publicCollectionsResult = await sb.from("shelf_collections").select("id, owner_id, name, cover_url, item_ids, blog_ids, collection_type, is_featured, sort_order").eq("is_public", true).limit(50);
    const publicCollections = publicCollectionsResult.data || [];
    const collectionOwnerIds = [...new Set(publicCollections.map(collection => collection.owner_id).filter(Boolean))];
    const collectionOwnersResult = collectionOwnerIds.length ? await sb.from("profiles").select("id, username").in("id", collectionOwnerIds) : { data: [] };
    const collectionOwners = new Map((collectionOwnersResult.data || []).map(profile => [profile.id, profile.username]));
    const collectionLikesResult = await sb.from("shelf_collection_likes").select("owner_id, collection_id");
    const collectionLikeCounts = (collectionLikesResult.data || []).reduce((counts, like) => {
      const key = `${like.owner_id}:${like.collection_id}`;
      counts.set(key, (counts.get(key) || 0) + 1);
      return counts;
    }, new Map());
    state.popularPublicCollections = publicCollections
      .map(collection => ({ ...collection, username: collectionOwners.get(collection.owner_id) || "", likes: collectionLikeCounts.get(`${collection.owner_id}:${collection.id}`) || 0 }))
      .filter(collection => collection.collection_type !== "blog" && collection.username)
      .sort((a, b) => b.likes - a.likes || String(a.name).localeCompare(String(b.name), "pt-BR"))
      .slice(0, 8);
    const publicCollectionView = publicCollections.map(collection => ({ ...collection, username: collectionOwners.get(collection.owner_id) || "" })).filter(collection => collection.username);
    state.featuredComicCollections = publicCollectionView.filter(collection => collection.collection_type !== "blog" && collection.is_featured).slice(0, 8);
    state.featuredBlogCollections = publicCollectionView.filter(collection => collection.collection_type === "blog" && collection.is_featured).slice(0, 8);
    const factionCatalogRows = (await sb.from("faction_catalogs").select("id, faction_id, name, cover_url, item_ids, is_featured, created_at").order("created_at", { ascending: false })).data || [];
    const factionIds = [...new Set(factionCatalogRows.map(catalog => catalog.faction_id).filter(Boolean))];
    const factionInfoRows = factionIds.length ? (await sb.from("factions").select("id, page_key, name, emblem").in("id", factionIds)).data || [] : [];
    const factionInfo = new Map(factionInfoRows.map(faction => [faction.id, faction]));
    const factionLikeRows = (await sb.from("faction_catalog_likes").select("catalog_id")).data || [];
    const factionLikeCounts = factionLikeRows.reduce((counts, row) => counts.set(String(row.catalog_id), (counts.get(String(row.catalog_id)) || 0) + 1), new Map());
    const publicFactionCollections = factionCatalogRows.map(catalog => {
      const faction = factionInfo.get(catalog.faction_id);
      if (!faction) return null;
      return { ...catalog, id: `faction-catalog-${catalog.id}`, catalog_id: catalog.id, faction_id: faction.id, faction_page_key: faction.page_key, faction_name: faction.name, faction_emblem: faction.emblem, username: "", collection_type: "comic", is_public: true, is_faction_catalog: true, likes: factionLikeCounts.get(String(catalog.id)) || 0 };
    }).filter(Boolean);
    state.popularPublicCollections = [...state.popularPublicCollections, ...publicFactionCollections]
      .sort((a, b) => b.likes - a.likes || String(a.name).localeCompare(String(b.name), "pt-BR"))
      .slice(0, 8);
    state.featuredComicCollections = [...state.featuredComicCollections, ...publicFactionCollections.filter(collection => collection.is_featured)].slice(0, 8);
    const comicLikes = await sb.from("comic_likes").select("item_id, user_id, created_at");
    state.comicLikeIds = new Set((comicLikes.data || []).filter(row => row.user_id === session?.user?.id).map(row => row.item_id));
    state.comicLikeAddedAt = new Map((comicLikes.data || []).filter(row => row.user_id === session?.user?.id).map(row => [row.item_id, row.created_at]));
    state.comicLikeCounts = (comicLikes.data || []).reduce((counts, row) => counts.set(row.item_id, (counts.get(row.item_id) || 0) + 1), new Map());
    if (!session?.user) await loadFactions();
    if (session?.user) {
      let profile = await sb.from("profiles").select("id, username, avatar_url, title, title_color, profile_hidden, is_banned, silenced_until, last_seen_at, created_at, plan, profile_background_theme, profile_accent_theme, shelf_saved_public, shelf_series_public, shelf_read_public, shelf_completed_public, shelf_liked_public, likes_public, wall_description, profile_banner_url, allow_mentions, allow_messages, shelf_sort_orders, shelf_style, shelf_styles, notifications_enabled, guria_proactive_enabled, shelf_blogs_public, profile_wall_public, shelf_saved_public_collections, profile_activity_public, xp, level, daily_streak, last_checkin_at, faction_id, faction_joined_at, faction_changed_at, profile_sticker_award_id, allow_sticker_requests").eq("id", session.user.id).single();
      if (profile.error) {
        // Compatibilidade com instalações que ainda não aplicaram os scripts
        // opcionais do álbum de stickers.
        profile = await sb.from("profiles").select("id, username, avatar_url, title, title_color, profile_hidden, is_banned, silenced_until, last_seen_at, created_at, plan, profile_background_theme, profile_accent_theme, shelf_saved_public, shelf_series_public, shelf_read_public, shelf_completed_public, shelf_liked_public, likes_public, wall_description, profile_banner_url, allow_mentions, allow_messages, shelf_sort_orders, shelf_style, shelf_styles, notifications_enabled, shelf_blogs_public, profile_wall_public, shelf_saved_public_collections, profile_activity_public, xp, level, daily_streak, last_checkin_at, faction_id, faction_joined_at, faction_changed_at").eq("id", session.user.id).single();
      }
      saveOfflineAccount(profile.data);
      state.profile = effectiveSundayProfile(profile.data);
      const top10LoadRevision = state.top10Revision;
      const loadedTop10Lists = await loadTop10Lists(session.user.id);
      if (!state.top10PendingOperations && top10LoadRevision === state.top10Revision) state.top10Lists = loadedTop10Lists;
      loadDownloads();
      state.collectionSortOrders = profile.data?.shelf_sort_orders || {};
      try { state.collectionSortOrders = { ...JSON.parse(localStorage.getItem(`bancaDigitalShelfSort:${session.user.id}`) || "{}"), ...state.collectionSortOrders }; } catch {}
      const savedPublishersResult = await sb.from("publisher_saves").select("publisher_key, publisher_name").eq("user_id", session.user.id).order("created_at", { ascending: false });
      state.savedPublishers = savedPublishersResult.data || [];
      state.savedPublisherKeys = new Set(state.savedPublishers.map(publisher => publisher.publisher_key));
      const savedImprintsResult = await sb.from("imprint_saves").select("imprint_key, imprint_name").eq("user_id", session.user.id).order("created_at", { ascending: false });
      state.savedImprints = savedImprintsResult.data || [];
      state.savedImprintKeys = new Set(state.savedImprints.map(imprint => imprint.imprint_key));
      const savedCharactersResult = await sb.from("character_saves").select("character_key, character_name").eq("user_id", session.user.id).order("created_at", { ascending: false });
      state.savedCharacters = savedCharactersResult.data || [];
      state.savedCharacterKeys = new Set(state.savedCharacters.map(character => character.character_key));
      await loadFactions();
      const ownFollowers = await sb.from("profile_follows").select("follower_id").eq("following_id", session.user.id);
      const ownFollowing = await sb.from("profile_follows").select("following_id").eq("follower_id", session.user.id);
      state.followerCount = (ownFollowers.data || []).length;
      state.followingCount = (ownFollowing.data || []).length;
      if (state.profile?.is_banned && !["moderator", "banca", "admin"].includes(state.profile.plan)) {
        await sb.auth.signOut();
        state.session = null;
        state.profile = null;
        render();
        return toast("Sua conta está banida.");
      }
      const collections = await sb.from("shelf_collections").select("id, name, cover_url, is_public, item_ids, collection_type, blog_ids, is_featured, sort_order").eq("owner_id", session.user.id).order("created_at", { ascending: true });
      state.shelfCategories = (collections.data || []).filter(collection => collection.collection_type !== "blog").map(collection => ({ id: collection.id, name: collection.name, coverUrl: collection.cover_url || "", isPublic: collection.is_public !== false, is_featured: collection.is_featured === true, sortOrder: collection.sort_order || "added_desc", itemIds: Array.isArray(collection.item_ids) ? collection.item_ids : [] }));
      const savedCollectionLinks = await sb.from("shelf_collection_saves").select("collection_id, owner_id").eq("user_id", session.user.id);
      const savedCollectionIds = (savedCollectionLinks.data || []).map(row => row.collection_id);
      const savedCollectionsResult = savedCollectionIds.length
        ? await sb.from("shelf_collections").select("id, owner_id, name, cover_url, is_public, item_ids, collection_type, is_featured").in("id", savedCollectionIds).eq("is_public", true).eq("collection_type", "comic")
        : { data: [] };
      const savedOwnerIds = [...new Set((savedCollectionsResult.data || []).map(collection => collection.owner_id).filter(Boolean))];
      const savedOwnersResult = savedOwnerIds.length ? await sb.from("profiles").select("id, username").in("id", savedOwnerIds) : { data: [] };
      const savedOwners = new Map((savedOwnersResult.data || []).map(owner => [owner.id, owner.username]));
      const savedShelfCollections = (savedCollectionsResult.data || []).map(collection => ({ ...collection, username: savedOwners.get(collection.owner_id) || "" })).filter(collection => collection.username);
      const savedFactionCollections = publicFactionCollections.filter(collection => state.factionCatalogSaveIds.has(String(collection.catalog_id)));
      state.savedPublicCollections = [...savedShelfCollections, ...savedFactionCollections];
      state.wallComments = await loadProfileWallComments(session.user.id);
      state.blogShelfCategories = (collections.data || []).filter(collection => collection.collection_type === "blog").map(collection => ({ id: collection.id, name: collection.name, coverUrl: collection.cover_url || "", isPublic: collection.is_public !== false, is_featured: collection.is_featured === true, blogIds: Array.isArray(collection.blog_ids) ? collection.blog_ids : [] }));
      const authoredBlogs = await sb.from("blog_posts").select("id, author_id, title, excerpt, cover_url, image_2_url, image_3_url, status, is_featured, created_at, published_at").eq("author_id", session.user.id).eq("status", "published").order("published_at", { ascending: false });
      state.authoredBlogPosts = authoredBlogs.data || [];
      const blogSaves = await sb.from("blog_saves").select("blog_id").eq("user_id", session.user.id);
      state.blogSaveIds = new Set((blogSaves.data || []).map(row => String(row.blog_id)));
      const savedBlogIds = [...state.blogSaveIds];
      const savedBlogs = savedBlogIds.length ? await sb.from("blog_posts").select("id, author_id, title, excerpt, cover_url, image_2_url, image_3_url, status, is_featured, created_at, published_at").in("id", savedBlogIds).eq("status", "published") : { data: [] };
      state.savedBlogPosts = savedBlogs.data || [];
      const favorites = await sb.from("favorites").select("item_id, created_at").eq("user_id", session.user.id);
      state.favoriteIds = new Set((favorites.data || []).map(row => row.item_id));
      state.favoriteAddedAt = new Map((favorites.data || []).map(row => [row.item_id, row.created_at]));
      const progress = await sb.from("reading_progress").select("item_id, page, total_pages, completed, completion_source, updated_at").eq("user_id", session.user.id);
      state.readingProgress = new Map((progress.data || []).map(row => [row.item_id, row]));
      const stickerAwards = await sb.from("sticker_awards").select("id, user_id, character_id, character_name, publisher_name, edition_fingerprint, cover_item_id, cover_url, rarity, requests_blocked, gum_placed_by, album_section, awarded_at").eq("user_id", session.user.id).order("awarded_at", { ascending: false });
      state.stickerAwards = stickerAwards.data || [];
      const profileDisplayStickers = await sb.from("profile_display_stickers").select("award_id, slot").eq("user_id", session.user.id).order("slot", { ascending: true });
      state.profileDisplayStickers = profileDisplayStickers.data || [];
      const stickerClaims = await sb.from("sticker_claim_history").select("character_id, edition_fingerprint").eq("user_id", session.user.id);
      state.stickerClaimKeys = new Set((stickerClaims.data || []).map(row => `${row.character_id}:${row.edition_fingerprint}`));
      const stickerSlotPreferences = await sb.from("sticker_slot_preferences").select("character_id, blocked, placed_by").eq("user_id", session.user.id);
      state.stickerSlotPreferences = new Map((stickerSlotPreferences.data || []).map(row => [String(row.character_id), { blocked: row.blocked === true, placedBy: row.placed_by || null }]));
      const stickerRequests = await sb.from("sticker_requests").select("id, requester_id, owner_id, character_id, character_name, edition_fingerprint, request_type, offered_award_id, offered_award_id_2, status, created_at, resolved_at").or(`requester_id.eq.${session.user.id},owner_id.eq.${session.user.id}`).order("created_at", { ascending: false }).limit(100);
      state.stickerRequests = stickerRequests.data || [];
      const requesterIds = [...new Set(state.stickerRequests.map(request => request.requester_id).filter(id => id && id !== session.user.id))];
      const requesterProfiles = requesterIds.length ? await sb.from("profiles").select("id, username, avatar_url, title, title_color").in("id", requesterIds) : { data: [] };
      state.stickerRequestProfiles = new Map((requesterProfiles.data || []).map(profile => [profile.id, profile]));
      const offeredIds = [...new Set(state.stickerRequests.flatMap(request => [request.offered_award_id, request.offered_award_id_2]).filter(Boolean))];
      const offeredAwards = offeredIds.length ? await sb.from("sticker_awards").select("id, character_name, rarity, cover_url").in("id", offeredIds) : { data: [] };
      state.stickerRequestOffers = new Map((offeredAwards.data || []).map(award => [String(award.id), award]));
      if (state.db.library.length) setTimeout(() => maybeAwardCompletedStickers(), 0);
      state.shelfSnapshot = { saved: new Set(state.favoriteIds), read: new Set([...state.readingProgress.entries()].filter(([, row]) => row.completed).map(([id]) => id)) };
      const achievements = await sb.from("user_achievements").select("achievements(name, description, icon)").eq("user_id", session.user.id);
      state.achievements = (achievements.data || []).map(row => row.achievements).filter(Boolean);
      const checkin = await sb.rpc("daily_profile_checkin");
      if (!checkin.error && checkin.data?.[0]) {
        const result = checkin.data[0];
        state.profile = { ...state.profile, xp: result.total_xp, level: result.current_level, daily_streak: result.streak };
        if (result.awarded_xp > 0) toast(`Check-in diário: +${result.awarded_xp} XP · sequência de ${result.streak} dia(s).`);
      }
      await sb.rpc("touch_profile");
      await startPresence();
    }
    if (!session?.user) await loadFactions();
    await loadNotifications();
    await loadCommunityActivity();
    await loadStaffActivities();
    state.authReady = true;
    syncTopAvatar();
    if (state.section === "factions" && !state.factionPageId && !canAccessFactions()) {
      navigate(isFactionStaff() ? { pagina: "ranking", secao: "faccoes" } : {}, true);
      return;
    }
    render();
    // A rota pode ter sido renderizada antes de character_settings terminar.
    // Nesse caso render() pode considerar o HTML idêntico e não reexecutar a
    // hidratação da Wiki rápida; inicie-a explicitamente após as configurações.
    if (state.section === "entity" && state.entityFilter?.kind !== "year" && !["Série Mensal", "Recentes", "Vários autores"].some(value => value.toLowerCase() === String(state.entityFilter.value || "").trim().toLowerCase())) {
      loadWikiQuickInfo(state.entityFilter.value, state.entityFilter.kind);
    }
    if (state.session && canChooseFaction() && !state.profile.faction_id) setTimeout(openFactionChoice, 0);
    if (state.section === "ranking") loadRankingData();
  }

