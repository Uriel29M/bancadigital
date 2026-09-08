  async function toggleCatalogSeriesVisibility(seriesId) {
    if (!isAdminProfile() || state.session?.offline) return toast("Apenas administradores podem ocultar séries.");
    const id = String(seriesId || "");
    if (!id || !sb || !state.session?.user?.id) return toast("A visibilidade precisa ser alterada com o banco online.");
    const hidden = !state.hiddenCatalogSeriesIds.has(id);
    const result = hidden
      ? await sb.from("catalog_series_visibility").upsert({ series_id: id, is_hidden: true, updated_by: state.session.user.id }, { onConflict: "series_id" }).select("series_id, is_hidden").single()
      : await sb.from("catalog_series_visibility").delete().eq("series_id", id).select("series_id").single();
    if (result.error || !result.data || String(result.data.series_id) !== id) return toast(result.error?.message || "Não foi possível confirmar a visibilidade da série.");
    if (hidden) state.hiddenCatalogSeriesIds.add(id); else state.hiddenCatalogSeriesIds.delete(id);
    render();
    toast(hidden ? "Série ocultada para usuários comuns." : "Série visível novamente para todos.");
  }


