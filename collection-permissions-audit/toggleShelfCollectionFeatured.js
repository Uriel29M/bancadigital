  async function toggleShelfCollectionFeatured(id, featured) {
    if (!["moderator", "banca", "admin"].includes(state.profile?.plan)) return;
    const result = await sb.from("shelf_collections").update({ is_featured: !featured }).eq("id", id);
    if (result.error) return toast("Não foi possível atualizar o destaque da coleção.");
    if (state.section === "public-profile" && state.publicProfile?.profile) await loadPublicProfile(state.publicProfile.profile.username, state.publicProfile.collectionId || null);
    else await loadAccount();
  }

