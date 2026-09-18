export function createProfileFeature(deps) {
  const {
    $,
    $$,
    PROFILE_ACCENT_THEMES,
    PROFILE_BACKGROUND_THEMES,
    RANDOM_AVATAR_BASE_URL,
    cleanUsername,
    escapeHTML,
    factionColorForProfile,
    hasLegendaryAccess,
    openAuthPage,
    profileThemeOptions,
    proxiedImageUrl,
    randomAvatarUrl,
    render,
    sb,
    signOut,
    state,
    stickerRarityLabel,
    toast,
  } = deps;

  function openProfileStickerPicker() {
    if (!state.session) return openAuthPage();
    const awards = (state.stickerAwards || []).filter(award => award.album_section !== "repeated" && award.cover_url);
    const selectedId = state.profile?.profile_sticker_award_id;
    const overlay = document.createElement("div");
    overlay.className = "modal-backdrop";
    overlay.innerHTML = `<div class="modal profile-sticker-picker"><div class="section-head"><div><div class="eyebrow">Perfil</div><h2>Escolha a figurinha do perfil</h2><div class="section-subtitle">Ela aparecerá à esquerda da sua foto e manterá o efeito de raridade.</div></div><button type="button" class="small-btn" data-close>Fechar</button></div><div class="profile-sticker-picker-grid"><button type="button" class="profile-sticker-choice ${selectedId ? "" : "is-selected"}" data-profile-sticker-choice="">Nenhuma</button>${awards.map(award => `<button type="button" class="profile-sticker-choice rarity-${escapeHTML(award.rarity || "standard")} ${String(award.id) === String(selectedId) ? "is-selected" : ""}" data-profile-sticker-choice="${award.id}"><span class="sticker-slot-art"><img src="${escapeHTML(proxiedImageUrl(award.cover_url))}" alt="Figurinha de ${escapeHTML(award.character_name || "personagem")}" draggable="false"><span class="sticker-rarity">${stickerRarityLabel(award.rarity)}</span></span><strong>${escapeHTML(award.character_name || "Personagem")}</strong></button>`).join("")}</div></div>`;
    $("#modal-root").appendChild(overlay);
    $$('[data-close]', overlay).forEach(button => button.addEventListener("click", () => overlay.remove()));
    overlay.addEventListener("click", event => { if (!event.target.closest?.(".modal")) overlay.remove(); });
    $$('[data-profile-sticker-choice]', overlay).forEach(button => button.addEventListener("click", async () => {
      if (button.disabled) return;
      button.disabled = true;
      const value = button.dataset.profileStickerChoice;
      const awardId = value ? Number(value) : null;
      const result = await sb.rpc("set_profile_sticker", { p_award_id: awardId });
      if (result.error) {
        toast(result.error.message || "Não foi possível atualizar a figurinha do perfil.");
        button.disabled = false;
        return;
      }
      state.profile = { ...state.profile, profile_sticker_award_id: awardId };
      overlay.remove();
      render();
      toast(awardId ? "Figurinha do perfil atualizada." : "Figurinha do perfil removida.");
    }));
  }

  function askDeleteAccountConfirmation() {
    return new Promise(resolve => {
      const overlay = document.createElement("div");
      overlay.className = "modal-backdrop account-delete-confirm-backdrop";
      overlay.innerHTML = `<div class="modal account-delete-confirm-modal" role="alertdialog" aria-modal="true" aria-labelledby="account-delete-title"><div class="section-head"><div><div class="eyebrow">Configurações da conta</div><h2 id="account-delete-title">Excluir conta?</h2><div class="section-subtitle">Excluir sua conta permanentemente? Seus dados, coleções e interações serão removidos e essa ação não pode ser desfeita.</div></div></div><div class="modal-actions"><button type="button" class="small-btn" data-delete-cancel>Cancelar</button><button type="button" class="btn btn-danger" data-delete-confirm>Excluir conta</button></div></div>`;
      const finish = value => { overlay.remove(); resolve(value); };
      $("[data-delete-cancel]", overlay).addEventListener("click", () => finish(false));
      $("[data-delete-confirm]", overlay).addEventListener("click", () => finish(true));
      overlay.addEventListener("click", event => { if (event.target === overlay) finish(false); });
      $("#modal-root").appendChild(overlay);
    });
  }

  async function deleteAccount() {
    if (!state.session?.user?.id || state.session.offline) return toast("A exclusão de conta exige uma sessão online.");
    if (!await askDeleteAccountConfirmation()) return;
    const button = $("[data-delete-account]", $("#profile-form") || document);
    if (button) { button.disabled = true; button.textContent = "Excluindo..."; }
    const result = await sb.functions.invoke("delete-account");
    if (result.error) {
      if (button) { button.disabled = false; button.textContent = "Excluir conta"; }
      return toast(result.error.message || "Não foi possível excluir a conta.");
    }
    $("#profile-form")?.closest(".modal-backdrop")?.remove();
    await signOut();
    toast("Conta excluída.");
  }

  function openProfileSettings() {
    if (!state.session) return openAuthPage();
    const overlay = document.createElement("div"); overlay.className = "modal-backdrop";
    overlay.innerHTML = `<div class="modal"><div class="section-head"><div><h2>Meu perfil</h2><div class="section-subtitle">Personalize seu @, sua foto e a visibilidade da estante</div></div><button class="small-btn" data-close>Fechar</button></div><form id="profile-form"><div class="form-grid"><div class="field full"><label>@usuário</label><input name="username" pattern="[A-Za-z0-9_]{3,24}" required value="${escapeHTML(state.profile?.username || "")}"></div><div class="field full"><label>Foto de perfil</label><input name="avatar" type="file" accept="image/png,image/jpeg,image/webp"></div><div class="field full"><label>Visibilidade no perfil público</label><label class="checkbox-inline"><input name="shelfSavedPublic" type="checkbox" ${state.profile?.shelf_saved_public !== false ? "checked" : ""}> Mostrar coleção Salvos</label><label class="checkbox-inline"><input name="shelfSeriesPublic" type="checkbox" ${state.profile?.shelf_series_public !== false ? "checked" : ""}> Mostrar coleção Séries salvas</label><label class="checkbox-inline"><input name="shelfReadPublic" type="checkbox" ${state.profile?.shelf_read_public !== false ? "checked" : ""}> Mostrar coleção Lidos</label><label class="checkbox-inline"><input name="shelfCompletedPublic" type="checkbox" ${state.profile?.shelf_completed_public !== false ? "checked" : ""}> Mostrar coleção Concluídos</label><label class="checkbox-inline"><input name="shelfLikedPublic" type="checkbox" ${state.profile?.shelf_liked_public !== false ? "checked" : ""}> Mostrar coleção Curtidos</label><label class="checkbox-inline"><input name="wallPublic" type="checkbox" ${state.profile?.profile_wall_public !== false ? "checked" : ""}> Mostrar Mural do perfil / Figurinhas em destaque</label></div></div><div class="modal-actions"><button type="button" class="small-btn" data-close>Cancelar</button><button class="btn btn-danger">Salvar perfil</button></div></form></div>`;
     $("#modal-root").appendChild(overlay); $$('[data-close]', overlay).forEach(button => button.onclick = () => closeProfileSettings());
    const deleteAccountButton = document.createElement("button");
    deleteAccountButton.type = "button";
    deleteAccountButton.className = "small-btn danger";
    deleteAccountButton.textContent = "Excluir conta";
    deleteAccountButton.dataset.deleteAccount = "true";
    $("#profile-form .modal-actions", overlay)?.prepend(deleteAccountButton);
    deleteAccountButton.addEventListener("click", deleteAccount);
    const legacyAvatarField = $("[name=avatar]", overlay);
    if (legacyAvatarField) {
      legacyAvatarField.type = "url";
      legacyAvatarField.name = "avatarUrl";
      legacyAvatarField.accept = "";
      legacyAvatarField.value = state.profile?.avatar_url || "";
      const currentAvatar = String(state.profile?.avatar_url || "");
      if (hasLegendaryAccess(state.profile)) {
        const avatarColors = (() => { try { const params = new URL(currentAvatar).searchParams; const shape = params.get("shapeColor") || "e85b68"; const background = params.get("backgroundColor") || "f3f4f6"; return { shape: `#${shape.replace(/^#/, "").slice(0, 6)}`, background: `#${background.replace(/^#/, "").slice(0, 6)}` }; } catch { return { shape: "#e85b68", background: "#f3f4f6" }; } })();
        legacyAvatarField.insertAdjacentHTML("afterend", `<span class="avatar-color-controls"><label class="avatar-color-control">Cor do personagem <input name="avatarColor" type="color" value="${avatarColors.shape}"></label><label class="avatar-color-control">Cor do fundo <input name="avatarBackgroundColor" type="color" value="${avatarColors.background}"></label><small class="format-hint avatar-color-hint">Disponível apenas para contas do tipo Lenda.</small></span>`);
      }
      legacyAvatarField.previousElementSibling.textContent = "Foto de perfil (link)";
      legacyAvatarField.insertAdjacentHTML("afterend", '<small class="format-hint">Cole um link público de imagem. Se deixar vazio, será usado seu avatar aleatório.</small>');
    }
     const profileForm = $("#profile-form", overlay);
     $(".form-grid", profileForm).insertAdjacentHTML("beforeend", '<div class="field full"><label>Descrição do perfil</label><textarea name="wallDescription" maxlength="500" rows="5" placeholder="Escreva uma breve apresentação...">' + escapeHTML(state.profile?.wall_description || "") + '</textarea><small class="format-hint">Essa descrição aparece no seu mural. Máximo de 500 caracteres.</small></div>');
     const wallDescriptionField = $('[name="wallDescription"]', profileForm);
     let wallDescriptionTimer = null;
     let wallDescriptionSaveVersion = 0;
     const saveWallDescriptionAutomatically = async () => {
       const wall_description = String(wallDescriptionField?.value || "").trim().slice(0, 500);
       const version = ++wallDescriptionSaveVersion;
       state.profile = { ...state.profile, wall_description };
       if (state.publicProfile?.profile?.id === state.session.user.id) {
         state.publicProfile.profile = { ...state.publicProfile.profile, wall_description };
       }
       const wallDescriptionDisplay = $(".profile-wall-description");
       if (wallDescriptionDisplay) wallDescriptionDisplay.textContent = wall_description || "Este perfil ainda não adicionou uma descrição.";
       const result = await sb.from("profiles").update({ wall_description }).eq("id", state.session.user.id);
       if (result.error && version === wallDescriptionSaveVersion) toast(result.error.message);
     };
     wallDescriptionField?.addEventListener("input", () => {
       clearTimeout(wallDescriptionTimer);
       wallDescriptionTimer = setTimeout(saveWallDescriptionAutomatically, 500);
     });
     wallDescriptionField?.addEventListener("blur", () => {
       clearTimeout(wallDescriptionTimer);
       saveWallDescriptionAutomatically();
     });
     const closeProfileSettings = () => {
       clearTimeout(wallDescriptionTimer);
       if (wallDescriptionField) {
         const wall_description = String(wallDescriptionField.value || "").trim().slice(0, 500);
         state.profile = { ...state.profile, wall_description };
         sb.from("profiles").update({ wall_description }).eq("id", state.session.user.id);
         const wallDescriptionDisplay = $(".profile-wall-description");
         if (wallDescriptionDisplay) wallDescriptionDisplay.textContent = wall_description || "Este perfil ainda não adicionou uma descrição.";
       }
       overlay.remove();
       const main = $("#main");
       if (main) main.innerHTML = "";
       render();
     };
     profileForm.addEventListener("submit", () => {
       setTimeout(() => {
         if (overlay.isConnected) return;
         const main = $("#main");
         if (main) main.innerHTML = "";
         render();
       }, 0);
     });
     profileForm?.addEventListener("submit", () => { const value = String(legacyAvatarField?.value || "").trim(); const isGeneratedAvatar = value.startsWith(RANDOM_AVATAR_BASE_URL); const customized = hasLegendaryAccess(state.profile); const avatar_url = !value || isGeneratedAvatar ? randomAvatarUrl(state.session?.user?.id, customized ? $("[name=avatarColor]", profileForm)?.value : "#ffffff", customized ? $("[name=avatarBackgroundColor]", profileForm)?.value : factionColorForProfile(state.profile)) : value; if (!value || /^https?:\/\//i.test(value)) state.profile = { ...state.profile, avatar_url }; });
    const bannerField = document.createElement("div");
    bannerField.className = "field full profile-banner-field";
    bannerField.innerHTML = `<label>Imagem de fundo da estante</label><input name="profileBannerUrl" type="url" value="${escapeHTML(state.profile?.profile_banner_url || "")}" placeholder="https://.../banner.jpg"><small class="format-hint">Opcional. Sem link, será usada a imagem padrão da estante.</small>`;
    $(".form-grid", profileForm).appendChild(bannerField);
    if (hasLegendaryAccess()) {
      const themeField = document.createElement("div");
      themeField.className = "field full profile-theme-settings";
      themeField.innerHTML = `<label>Aparência do perfil</label><small class="format-hint">Disponível para Lendas, moderadores e administradores. As cores ficam restritas ao perfil público.</small><div class="profile-theme-grid"><label>Fundo<select name="profileBackgroundTheme">${profileThemeOptions(PROFILE_BACKGROUND_THEMES, state.profile?.profile_background_theme, "Padrão")}</select></label><label>Cor de destaque<select name="profileAccentTheme"><option value="" ${!state.profile?.profile_accent_theme ? "selected" : ""}>Padrão (vermelho)</option>${Object.entries(PROFILE_ACCENT_THEMES).map(([key, theme]) => `<option value="${key}" ${state.profile?.profile_accent_theme === key ? "selected" : ""}>${theme.label}</option>`).join("")}</select></label></div><button type="button" class="small-btn profile-theme-reset" data-profile-theme-reset>Voltar ao padrão</button>`;
      $(".form-grid", profileForm).appendChild(themeField);
      $("[data-profile-theme-reset]", themeField).onclick = () => {
        $("[name=profileBackgroundTheme]", themeField).value = "";
        $("[name=profileAccentTheme]", themeField).value = "";
      };
    }
    profileForm.addEventListener("submit", async event => {
      const bannerUrl = String(new FormData(event.currentTarget).get("profileBannerUrl") || "").trim();
      if (bannerUrl && !/^https?:\/\//i.test(bannerUrl)) return toast("Informe um link http(s) válido para o banner.");
      const bannerUpdate = await sb.from("profiles").update({ profile_banner_url: bannerUrl || null }).eq("id", state.session.user.id);
      if (bannerUpdate.error) return toast(bannerUpdate.error.message);
      state.profile = { ...state.profile, profile_banner_url: bannerUrl || null };
    });
     overlay.addEventListener("click", event => { if (event.target === overlay) closeProfileSettings(); });
    $("[name=likesPublic]", overlay)?.closest("label")?.remove();
    if (!["admin", "moderator", "banca", "premium"].includes(state.profile?.plan)) $(".form-grid", overlay)?.insertAdjacentHTML("beforeend", `<div class="field full"><label class="checkbox-inline"><input name="shelfSeriesPublic" type="checkbox" ${state.profile?.shelf_series_public !== false ? "checked" : ""}> Mostrar coleção Séries salvas no perfil público</label></div>`);
    const shelfVisibilityField = $$(".field.full", overlay).find(field => field.textContent.includes("Visibilidade"));
    profileForm.addEventListener("submit", async event => {
      if (!["admin", "moderator", "banca", "premium"].includes(state.profile?.plan)) return;
      const formData = new FormData(event.currentTarget);
      const visibility = { shelf_completed_public: formData.get("shelfCompletedPublic") === "on", shelf_liked_public: formData.has("shelfLikedPublic") ? formData.get("shelfLikedPublic") === "on" : state.profile?.shelf_liked_public !== false };
      const likedVisibility = await sb.from("profiles").update(visibility).eq("id", state.session.user.id);
      if (likedVisibility.error) toast(likedVisibility.error.message);
      else {
        state.profile = { ...state.profile, ...visibility };
        render();
      }
    });
    const emailField = document.createElement("div");
    const currentEmail = state.session.user.email || "";
    const hasRecoveryEmail = currentEmail && !currentEmail.endsWith("@login.banca-digital.local");
    emailField.className = "field full profile-email-field";
    emailField.innerHTML = `<label>Email de recuperação <span class="field-optional">(opcional)</span></label><input name="email" type="email" placeholder="voce@email.com" autocomplete="email" value="${hasRecoveryEmail ? escapeHTML(currentEmail) : ""}"><small class="format-hint">Adicionar um email permite recuperar a conta e usá-lo para entrar depois.</small>`;
    $(".form-grid", profileForm).appendChild(emailField);
    const privacyField = document.createElement("div");
    privacyField.className = "field full profile-privacy-settings";
      privacyField.innerHTML = `<label>Privacidade e notificações</label><label class="checkbox-inline"><input name="likesPublic" type="checkbox" ${state.profile?.likes_public !== false ? "checked" : ""}> Mostrar minhas curtidas publicamente</label><label class="checkbox-inline"><input name="allowMentions" type="checkbox" ${state.profile?.allow_mentions !== false ? "checked" : ""}> Receber marcações</label><label class="checkbox-inline"><input name="allowMessages" type="checkbox" ${state.profile?.allow_messages !== false ? "checked" : ""}> Receber mensagens privadas</label><label class="checkbox-inline"><input name="notificationsEnabled" type="checkbox" ${state.profile?.notifications_enabled !== false ? "checked" : ""}> Receber notificações</label><label class="checkbox-inline"><input name="guriaProactiveEnabled" type="checkbox" ${state.profile?.guria_proactive_enabled !== false ? "checked" : ""}> Receber mensagens proativas da Guria</label>`;
    $(".form-grid", profileForm).appendChild(privacyField);
    const profileSectionsPrivacy = document.createElement("div");
    profileSectionsPrivacy.className = "field full profile-privacy-settings";
    profileSectionsPrivacy.innerHTML = `<label>Seções do perfil público</label><label class="checkbox-inline"><input name="savedPublicCollectionsPublic" type="checkbox" ${state.profile?.shelf_saved_public_collections !== false ? "checked" : ""}> Mostrar Coleções salvas</label><label class="checkbox-inline"><input name="activityPublic" type="checkbox" ${state.profile?.profile_activity_public !== false ? "checked" : ""}> Mostrar Histórico</label>`;
    $(".form-grid", profileForm).appendChild(profileSectionsPrivacy);
    $("[name=likesPublic]", overlay)?.closest("label")?.remove();
     const originalProfileSubmit = async () => {};
    profileForm.addEventListener("submit", async event => {
      event.preventDefault();
      const fd = new FormData(profileForm);
      const privacy = { likes_public: fd.has("likesPublic") ? fd.get("likesPublic") === "on" : state.profile?.likes_public !== false, allow_mentions: fd.get("allowMentions") === "on", allow_messages: fd.get("allowMessages") === "on", notifications_enabled: fd.get("notificationsEnabled") === "on", guria_proactive_enabled: fd.get("guriaProactiveEnabled") === "on" };
      privacy.profile_wall_public = fd.get("wallPublic") === "on";
      privacy.shelf_saved_public_collections = fd.get("savedPublicCollectionsPublic") === "on";
      privacy.profile_activity_public = fd.get("activityPublic") === "on";
      const privacyUpdate = await sb.from("profiles").update(privacy).eq("id", state.session.user.id);
      if (privacyUpdate.error) return toast(privacyUpdate.error.message);
      state.profile = { ...state.profile, ...privacy };
      await originalProfileSubmit(event);
    });
    $("#profile-form", overlay).onsubmit = async event => { event.preventDefault(); const fd = new FormData(event.currentTarget); const username = cleanUsername(fd.get("username")); if (!/^[a-z0-9_]{3,24}$/.test(username)) return toast("@ inválido."); let avatar_url = state.profile?.avatar_url || null; const file = fd.get("avatar"); if (file?.size) { const path = `${state.session.user.id}/${Date.now()}-${file.name.replace(/[^a-z0-9.]/gi, "_")}`; const upload = await sb.storage.from("avatars").upload(path, file, { upsert: true }); if (upload.error) return toast(upload.error.message); avatar_url = sb.storage.from("avatars").getPublicUrl(path).data.publicUrl; } const preferences = { shelf_saved_public: fd.get("shelfSavedPublic") === "on", shelf_series_public: fd.get("shelfSeriesPublic") === "on", shelf_read_public: fd.get("shelfReadPublic") === "on", shelf_completed_public: fd.get("shelfCompletedPublic") === "on", shelf_liked_public: fd.get("shelfLikedPublic") === "on", profile_background_theme: hasLegendaryAccess() ? (PROFILE_BACKGROUND_THEMES[fd.get("profileBackgroundTheme")] ? fd.get("profileBackgroundTheme") : null) : (state.profile?.profile_background_theme || null), profile_accent_theme: hasLegendaryAccess() ? (PROFILE_ACCENT_THEMES[fd.get("profileAccentTheme")] ? fd.get("profileAccentTheme") : null) : (state.profile?.profile_accent_theme || null) }; const update = await sb.from("profiles").update({ username, avatar_url, ...preferences }).eq("id", state.session.user.id); if (update.error) return toast(update.error.message.includes("duplicate") ? "Esse @ já está em uso." : update.error.message); state.profile = { ...state.profile, username, avatar_url, ...preferences }; if (state.publicProfile?.profile?.id === state.session.user.id) state.publicProfile.profile = { ...state.publicProfile.profile, username, avatar_url, ...preferences }; overlay.remove(); render(); toast("Perfil atualizado."); };
    $("#profile-form", overlay).addEventListener("submit", async event => {
      const email = String(new FormData(event.currentTarget).get("email") || "").trim().toLowerCase();
      if (!email) return;
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return toast("Informe um email válido.");
      if (email === currentEmail.trim().toLowerCase()) return;
      if (email !== currentEmail) {
        const result = await sb.auth.updateUser({ email });
        if (result.error) return toast(result.error.message);
      }
      toast("Solicitação enviada. Confirme a alteração pelos emails enviados pelo serviço de autenticação.");
    });
  }

  async function toggleProfileDisplaySticker(button) {
    if (!state.session?.user?.id || !sb) return openAuthPage();
    const awardId = Number(button.dataset.profileDisplayToggle);
    const selected = button.dataset.profileDisplaySelected === "true";
    const isOwnPublicProfile = state.section === "public-profile" && String(state.publicProfile?.profile?.id || "") === String(state.session.user.id);
    button.disabled = true;
    let result;
    if (selected) {
      result = await sb.from("profile_display_stickers").delete().eq("user_id", state.session.user.id).eq("award_id", awardId);
    } else {
      const rows = isOwnPublicProfile ? (state.publicProfile.profileDisplayStickers || []) : (state.profileDisplayStickers || []);
      if (rows.length >= 5) { button.disabled = false; return toast("Você já expôs 5 figurinhas no mural."); }
      const usedSlots = new Set(rows.map(row => Number(row.slot)));
      const slot = [1, 2, 3, 4, 5].find(value => !usedSlots.has(value)) || 5;
      result = await sb.from("profile_display_stickers").insert({ user_id: state.session.user.id, award_id: awardId, slot });
    }
    if (result.error) { button.disabled = false; return toast(result.error.message || "Não foi possível atualizar as figurinhas do mural."); }
    const currentRows = isOwnPublicProfile ? (state.publicProfile.profileDisplayStickers || []) : (state.profileDisplayStickers || []);
    const nextRows = selected
      ? currentRows.filter(row => String(row.award_id) !== String(awardId))
      : [...currentRows, { award_id: awardId, slot: currentRows.length + 1 }];
    state.profileDisplayStickers = nextRows;
    if (isOwnPublicProfile) state.publicProfile.profileDisplayStickers = nextRows;
    render();
    toast(selected ? "Figurinha removida do mural." : "Figurinha exposta no mural.");
  }


  return { openProfileSettings, openProfileStickerPicker, toggleProfileDisplaySticker };
}
