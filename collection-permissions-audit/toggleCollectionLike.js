  async function toggleCollectionLike(ownerId, collectionId) {
    if (!state.session) return openAuthPage();
    const publicState = state.publicProfile;
    if (!publicState?.collectionLikes) return;
    const liked = publicState.collectionLikes.has(collectionId);
    const query = sb.from("shelf_collection_likes");
    const result = liked
      ? await query.delete().eq("owner_id", ownerId).eq("collection_id", collectionId).eq("user_id", state.session.user.id)
      : await query.insert({ owner_id: ownerId, collection_id: collectionId, user_id: state.session.user.id });
    if (result.error) return toast("Não foi possível atualizar a curtida.");
    if (liked) {
      publicState.collectionLikes.delete(collectionId);
      publicState.collectionLikeCounts.set(collectionId, Math.max(0, (publicState.collectionLikeCounts.get(collectionId) || 1) - 1));
    } else {
      publicState.collectionLikes.add(collectionId);
      publicState.collectionLikeCounts.set(collectionId, (publicState.collectionLikeCounts.get(collectionId) || 0) + 1);
    }
    render();
  }

