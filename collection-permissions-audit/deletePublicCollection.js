  async function deletePublicCollection(ownerId, collectionId) {
    if (!["moderator", "banca", "admin"].includes(state.profile?.plan)) return;
    const result = await sb.from("shelf_collections").delete().eq("owner_id", ownerId).eq("id", collectionId);
    if (result.error) return toast("Não foi possível excluir a coleção.");
    toast("Coleção pública excluída.");
    await loadPublicProfile(state.publicProfile.profile.username, null);
  }

