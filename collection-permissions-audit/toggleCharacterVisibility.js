  async function toggleCharacterVisibility(button) {
    if (!isAdminProfile()) return toast("Apenas administradores podem ocultar personagens.");
    if (!sb || !state.session?.user?.id) return toast("A visibilidade precisa ser alterada com o banco online.");
    const name = String(button.dataset.characterVisibility || "").trim();
    const key = publisherKey(name);
    if (!name || !key) return;
    const setting = state.characterSettings.get(key) || {};
    const hidden = setting.is_hidden !== true;
    button.disabled = true;
    const next = { character_key: key, character_name: name, character_type: setting.character_type === "team" ? "team" : "character", character_alignment: setting.character_alignment || null, cover_url: setting.cover_url || null, wikipedia_url: setting.wikipedia_url || null, authored_text: setting.authored_text || null, is_pinned: setting.is_pinned === true, is_hidden: hidden, deviantart_fanarts_enabled: setting.deviantart_fanarts_enabled === true, deviantart_gallery_url: setting.deviantart_gallery_url || null, deviantart_fanart_image_urls: setting.deviantart_fanart_image_urls || null };
    const result = await sb.from("character_settings").upsert(next, { onConflict: "character_key" });
    if (result.error) {
      button.disabled = false;
      return toast(result.error.message || "Não foi possível alterar a visibilidade do personagem. Execute a migração do Supabase.");
    }
    state.characterSettings.set(key, next);
    render();
    toast(hidden ? "Personagem ocultado para os usuários." : "Personagem visível novamente para todos.");
  }

