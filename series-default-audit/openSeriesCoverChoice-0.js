
  function openSeriesCoverChoice(seriesId) {
    const existingOverlay = $("#modal-root .series-cover-choice-modal")?.closest(".modal-backdrop");
    if (existingOverlay) return;
    if (!state.session) return openAuthPage();
    const editions = seriesEditions({ seriesId });
    if (!editions.length) return;
    const current = state.seriesCoverChoices.get(seriesId);
    const options = [];
    editions.forEach(edition => {
      if (edition.coverUrl) options.push({ key: `standard:${edition.id}`, itemId: edition.id, coverUrl: edition.coverUrl, label: `${itemDisplayTitle(edition)} · Capa padrão`, isVariant: false });
      if (hasLegendaryAccess()) usableCoverVariants(edition).forEach(variant => options.push({ key: `variant:${edition.id}:${variant.variant_key}`, itemId: edition.id, coverUrl: variant.cover_url, label: `${itemDisplayTitle(edition)} · ${variant.label}`, variantKey: variant.variant_key, isVariant: true }));
    });
    const seriesStyle = coverStyleFor({ id: seriesId });
    const seriesModalEffects = `<div class="series-cover-modal-effects"><span>Estilo da capa:</span>${coverStyleControl(seriesId, seriesStyle)}</div>`;
    const overlay = document.createElement("div");
    overlay.className = "modal-backdrop";
    overlay.innerHTML = `<div class="modal series-cover-choice-modal"><div class="section-head"><div><h2>Escolher capa da série</h2><div class="section-subtitle">Escolha uma capa entre as edições desta série.</div></div><button class="small-btn" data-close>Fechar</button></div>${seriesModalEffects}<form id="series-cover-choice-form"><div class="cover-choice-options">${options.map(option => `<label class="cover-choice-option"><input type="radio" name="seriesCoverKey" value="${escapeHTML(option.key)}" ${current?.item_id === option.itemId && Boolean(current?.is_variant) === option.isVariant && (option.isVariant ? current?.variant_key === option.variantKey : true) || (!current && option.key === `standard:${editions[0].id}`) || (current?.is_variant && !["premium", "moderator", "banca", "admin"].includes(state.profile?.plan) && option.key === `standard:${editions[0].id}`) ? "checked" : ""}><img src="${escapeHTML(proxiedImageUrl(option.coverUrl))}" alt=""><span>${escapeHTML(option.label)}</span></label>`).join("")}</div><div class="modal-actions"><button type="button" class="small-btn" data-close>Cancelar</button><button class="btn btn-danger">Salvar capa</button></div></form></div>`;
    $("#modal-root").appendChild(overlay);
    overlay.addEventListener("click", event => {
      if (event.target === overlay) overlay.remove();
    });
    $$('[data-close]', overlay).forEach(button => button.onclick = () => overlay.remove());
    $$('[data-cover-effect-item]', overlay).forEach(button => {
      button.addEventListener("mousedown", event => event.preventDefault());
      button.onclick = event => {
      event.stopPropagation();
      cycleCoverStyle(button.dataset.coverEffectItem, button.dataset.coverEffectCollection || "");
      };
    });
    $("#series-cover-choice-form", overlay).onsubmit = async event => {
      event.preventDefault();
      const selected = options.find(option => option.key === String(new FormData(event.currentTarget).get("seriesCoverKey")));
      if (!selected) return;
      const result = await sb.from("user_series_cover_choices").upsert({ user_id: state.session.user.id, series_id: seriesId, item_id: selected.itemId, cover_url: selected.coverUrl, variant_key: selected.variantKey || null, is_variant: selected.isVariant, updated_at: new Date().toISOString() }, { onConflict: "user_id,series_id" });
      if (result.error) return toast(result.error.message);
      state.seriesCoverChoices.set(seriesId, { series_id: seriesId, item_id: selected.itemId, cover_url: selected.coverUrl, variant_key: selected.variantKey || null, is_variant: selected.isVariant });
      overlay.remove();
      updateSeriesCoverImages(seriesId);
      toast("Capa da série atualizada.");
    };
  }
