  async function setCollectionCoverStyle(collectionId, itemId) {
    if (!state.session || state.publicProfile?.profile?.id !== state.session.user.id) return toast("Somente o criador pode alterar esta coleção.");
    const collection = state.publicProfile?.collections?.find(entry => entry.id === collectionId);
    if (!collection) return;
    const styles = { ...(collection.coverStyles || {}) };
    const currentStyle = styles[itemId] || "normal";
    const premium = ["premium", "moderator", "banca", "admin"].includes(state.profile?.plan);
    const nextStyle = currentStyle === "normal" ? "grayscale" : currentStyle === "grayscale" && premium ? "gold" : "normal";
    if (nextStyle === "normal") delete styles[itemId];
    else styles[itemId] = nextStyle;
    const result = await sb.from("shelf_collections").update({ cover_styles: styles }).eq("id", collectionId).eq("owner_id", state.session.user.id);
    if (result.error) return toast(result.error.message);
    await loadPublicProfile(state.publicProfile.profile.username, collectionId);
  }

