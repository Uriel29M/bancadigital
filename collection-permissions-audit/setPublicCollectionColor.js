  async function setPublicCollectionColor(collectionId, color) {
    if (!state.session || state.publicProfile?.profile?.id !== state.session.user.id) return toast("Somente o criador pode alterar esta coleção.");
    if (!/^#[0-9a-f]{6}$/i.test(String(color || ""))) return;
    const collection = state.publicProfile?.collections?.find(entry => String(entry.id) === String(collectionId));
    if (!collection) return;
    const coverStyles = { ...(collection.coverStyles || {}), __themeColor: color };
    const result = await sb.from("shelf_collections").update({ cover_styles: coverStyles }).eq("id", collectionId).eq("owner_id", state.session.user.id);
    if (result.error) return toast(result.error.message || "Não foi possível mudar a cor da coleção.");
    collection.coverStyles = coverStyles;
    const hero = $(".public-collection-hero");
    hero?.style.setProperty("--public-collection-color", color);
    toast("Cor da coleção atualizada.");
  }

