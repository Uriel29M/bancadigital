  async function toggleSavePublicCollection(button) {
    if (!state.session) return openAuthPage();
    const collectionId = button.dataset.savePublicCollection;
    const ownerId = button.dataset.savePublicOwner;
    const saved = state.savedPublicCollections?.some(collection => collection.id === collectionId);
    const result = saved
      ? await sb.from("shelf_collection_saves").delete().eq("user_id", state.session.user.id).eq("collection_id", collectionId)
      : await sb.from("shelf_collection_saves").insert({ user_id: state.session.user.id, owner_id: ownerId, collection_id: collectionId });
    if (result.error) return toast(result.error.message || "Não foi possível salvar a coleção.");
    if (saved) state.savedPublicCollections = state.savedPublicCollections.filter(collection => collection.id !== collectionId);
    else {
      const publicProfileCollection = state.publicProfile?.collections?.find(item => item.id === collectionId);
      const collection = [...state.featuredComicCollections, ...state.popularPublicCollections, ...(state.savedPublicCollections || [])].find(item => item.id === collectionId)
        || (publicProfileCollection ? { ...publicProfileCollection, owner_id: ownerId, username: state.publicProfile.profile.username, item_ids: publicProfileCollection.itemIds || [] } : null);
      if (collection) state.savedPublicCollections = [...state.savedPublicCollections, collection];
    }
    render();
  }

