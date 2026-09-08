  function openCoverChoice(itemId, collectionId = "") {
    const existingOverlay = $("#modal-root .cover-choice-modal")?.closest(".modal-backdrop");
    if (existingOverlay) return;
    if (!state.session) return openAuthPage();
    if (!hasLegendaryAccess()) return toast("A escolha de capas variantes é exclusiva para usuários Lenda, moderadores e administradores.");
    const item = state.db.library.find(entry => entry.id === itemId);
    if (!item) return;
    const isAdmin = state.profile?.plan === "admin";
    const savedForCover = isAdmin || state.favoriteIds.has(itemId) || (item.seriesId && state.favoriteIds.has(item.seriesId));
    if (!savedForCover) return toast("Salve o quadrinho ou a série na estante antes de escolher uma capa.");
    const collection = collectionId ? state.publicProfile?.collections?.find(entry => entry.id === collectionId) : null;
    const collectionOwner = collection?.ownerId || state.publicProfile?.profile?.id;
    if (collectionId && collectionOwner !== state.session.user.id) return toast("Somente o criador pode alterar capas nesta coleção.");
    const collectionChoices = collectionId ? (collection?.coverChoices || {}) : null;
    const current = collectionId
      ? collectionChoices?.[itemId]
      : state.previewCoverChoices.get(itemId) || state.previewCoverChoices.get(String(itemId)) || state.coverChoices.get(itemId) || state.coverChoices.get(String(itemId));
    const variants = usableCoverVariants(item);
    const botVariants = variants.filter(variant => String(variant.variant_key || "").startsWith("bot-"));
    const options = [{ variant_key: "__default", label: "Capa principal", cover_url: item.coverUrl || "" }, ...variants];
    const overlay = document.createElement("div");
    overlay.className = "modal-backdrop";
    overlay.innerHTML = `<div class="modal cover-choice-modal"><div class="section-head"><div><h2>Escolher capa</h2><div class="section-subtitle">${escapeHTML(itemDisplayTitle(item))}</div></div><button class="small-btn" data-close>Fechar</button></div><form id="cover-choice-form"><div class="cover-choice-options">${options.map(option => `<label class="cover-choice-option"><input type="radio" name="variantKey" value="${escapeHTML(option.variant_key)}" ${current?.variant_key === option.variant_key || (!current && option.variant_key === "__default") ? "checked" : ""}><img src="${escapeHTML(proxiedImageUrl(option.cover_url))}" alt=""><span>${escapeHTML(option.label)}</span>${state.profile?.plan === "admin" && option.variant_key !== "__default" ? `<button type="button" class="small-btn danger cover-variant-remove" data-remove-bot-variant="${escapeHTML(option.variant_key)}">${String(option.variant_key).startsWith("bot-") ? "🤖 " : ""}Remover</button>` : ""}</label>`).join("")}</div>${variants.length ? "" : '<div class="empty">Nenhuma capa variante foi cadastrada para esta edição.</div>'}<div class="modal-actions">${state.profile?.plan === "admin" && botVariants.length ? `<button type="button" class="small-btn danger" data-remove-bot-variants>🤖 Remover capas do bot</button>` : ""}<button type="button" class="small-btn" data-close>Cancelar</button><button class="btn btn-danger">Salvar capa</button></div></form></div>`;
    $("#modal-root").appendChild(overlay);
    $$('[data-close]', overlay).forEach(button => button.onclick = () => overlay.remove());
    overlay.addEventListener("click", event => { if (event.target === overlay) overlay.remove(); });
    if (isAdmin && !collectionId) {
      const previewButton = document.createElement("button");
      previewButton.type = "button";
      previewButton.className = "small-btn";
      previewButton.textContent = "Usar sem salvar";
      previewButton.onclick = () => {
        const selectedKey = String(new FormData($("#cover-choice-form", overlay)).get("variantKey") || "__default");
        const choice = variants.find(option => option.variant_key === selectedKey);
        state.previewCoverChoices.set(itemId, choice
          ? { item_id: itemId, variant_key: choice.variant_key, label: choice.label, cover_url: choice.cover_url }
          : { item_id: itemId, variant_key: "__default", label: "Capa principal", cover_url: item.coverUrl || "" });
        overlay.remove();
        updateCoverChoiceImages(itemId);
        toast("Capa aplicada sem salvar.");
      };
      $(".modal-actions", overlay)?.prepend(previewButton);
    }
    $$('[data-remove-bot-variant]', overlay).forEach(button => button.addEventListener("click", async event => {
      event.preventDefault();
      event.stopPropagation();
      const variantKey = button.dataset.removeBotVariant;
      openStyledCoverConfirm(variantKey.startsWith("bot-") ? "Esta capa foi adicionada pelo bot." : "Esta capa variante será removida do catálogo.", async () => {
        button.disabled = true;
        const result = await sb.functions.invoke("cover-variants-bot", { body: { action: "remove_variant", item_id: itemId, variant_key: variantKey } });
        if (result.error) {
          let detail = result.error.message || "Não foi possível remover esta capa.";
          try { const body = await result.error.context?.json?.(); if (body?.error) detail = body.error; } catch {}
          button.disabled = false;
          return toast(detail);
        }
        await loadCoverCatalog();
        overlay.remove();
        openCoverChoice(itemId, collectionId);
        toast(variantKey.startsWith("bot-") ? "Capa do bot removida." : "Capa variante removida.");
      });
    }));
    $('[data-remove-bot-variants]', overlay)?.addEventListener("click", event => {
      const batchButton = event.currentTarget;
      openStyledCoverConfirm(`${botVariants.length} capa(s) adicionada(s) pelo bot serão removidas desta edição.`, async () => {
        batchButton.disabled = true;
        const result = await sb.functions.invoke("cover-variants-bot", { body: { action: "remove_bot_variants", item_id: itemId } });
        if (result.error) {
          let detail = result.error.message || "Não foi possível remover as capas do bot.";
          try { const body = await result.error.context?.json?.(); if (body?.error) detail = body.error; } catch {}
          batchButton.disabled = false;
          return toast(detail);
        }
        if (current?.variant_key?.startsWith("bot-") && !collectionId) {
          await sb.from("user_cover_choices").delete().eq("user_id", state.session.user.id).eq("item_id", itemId);
        }
        await loadCoverCatalog();
        overlay.remove();
        toast(`${Number(result.data?.removed || botVariants.length)} capa(s) do bot removida(s).`);
      });
    });
    $("#cover-choice-form", overlay).onsubmit = async event => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const selectedKey = String(form.get("variantKey") || "__default");
      let choice = variants.find(option => option.variant_key === selectedKey);
      if (selectedKey === "__default") {
        const nextChoices = collectionId ? { ...collectionChoices } : null;
        if (collectionId) delete nextChoices[itemId];
        const result = collectionId
          ? await sb.from("shelf_collections").update({ cover_choices: nextChoices }).eq("id", collectionId).eq("owner_id", state.session.user.id)
          : await sb.from("user_cover_choices").delete().eq("user_id", state.session.user.id).eq("item_id", itemId);
        if (result.error) return toast(result.error.message);
        if (collectionId) collection.coverChoices = nextChoices;
        else state.coverChoices.delete(itemId);
      } else if (choice) {
        const nextChoice = { item_id: itemId, variant_key: choice.variant_key, label: choice.label, cover_url: choice.cover_url };
        const nextChoices = collectionId ? { ...collectionChoices, [itemId]: nextChoice } : null;
        const result = collectionId
          ? await sb.from("shelf_collections").update({ cover_choices: nextChoices }).eq("id", collectionId).eq("owner_id", state.session.user.id)
          : await sb.from("user_cover_choices").upsert({ user_id: state.session.user.id, ...nextChoice, updated_at: new Date().toISOString() }, { onConflict: "user_id,item_id" });
        if (result.error) return toast(result.error.message);
        if (collectionId) collection.coverChoices = nextChoices;
        else state.coverChoices.set(itemId, { item_id: itemId, ...choice });
      } else return toast("Essa capa variante não está cadastrada para esta edição.");
      state.previewCoverChoices.delete(itemId);
      overlay.remove();
      if (collectionId) await loadPublicProfile(state.publicProfile.profile.username, collectionId);
      else updateCoverChoiceImages(itemId);
      toast("Capa atualizada.");
    };
  }

