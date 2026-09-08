  async function deleteBlogShelfCollection(id) {
    const result = await sb.from("shelf_collections").delete().eq("id", id).eq("owner_id", state.session.user.id);
    if (result.error) return toast("Não foi possível excluir a coleção.");
    await loadAccount();
  }

