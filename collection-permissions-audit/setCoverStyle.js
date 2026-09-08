  async function setCoverStyle(itemId, style) {
    if (!state.session) return openAuthPage();
    if (style === "gold" && !hasLegendaryAccess()) return toast("A capa dourada é exclusiva para usuários Lenda, moderadores e administradores.");
    const item = state.db.library.find(entry => entry.id === itemId) || state.db.library.find(entry => entry.seriesId === itemId);
    if (!item) return;
    const nextStyle = ["normal", "grayscale", "gold"].includes(style) ? style : "normal";
    const result = nextStyle === "normal"
      ? await sb.from("user_cover_styles").delete().eq("user_id", state.session.user.id).eq("item_id", itemId)
      : await sb.from("user_cover_styles").upsert({ user_id: state.session.user.id, item_id: itemId, style: nextStyle, updated_at: new Date().toISOString() }, { onConflict: "user_id,item_id" });
    if (result.error) return toast(result.error.message);
    if (nextStyle === "normal") state.coverStyles.delete(itemId);
    else state.coverStyles.set(itemId, nextStyle);
    updateCoverStyleImages(itemId);
  }

