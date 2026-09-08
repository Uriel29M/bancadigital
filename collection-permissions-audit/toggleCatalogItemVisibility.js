  async function toggleCatalogItemVisibility(itemId) {
    if (!isAdminProfile()) return toast("Apenas administradores podem ocultar edições.");
    const id = String(itemId || "");
    if (!id || !sb || !state.session?.user?.id) return toast("A visibilidade precisa ser alterada com o banco online.");
    const hidden = !state.hiddenCatalogItemIds.has(id);
    const result = hidden
      ? await sb.from("catalog_item_visibility").upsert({ item_id: id, is_hidden: true, updated_by: state.session.user.id }, { onConflict: "item_id" })
      : await sb.from("catalog_item_visibility").delete().eq("item_id", id);
    if (result.error) return toast(result.error.message || "Não foi possível alterar a visibilidade.");
    if (hidden) state.hiddenCatalogItemIds.add(id); else state.hiddenCatalogItemIds.delete(id);
    render();
    toast(hidden ? "Edição ocultada para usuários comuns." : "Edição visível novamente para todos.");
  }
