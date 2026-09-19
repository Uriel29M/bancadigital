export function createStickerActionsFeature(deps) {
  const {
    $,
    $$,
    currentStickerAwards,
    escapeHTML,
    openAuthPage,
    proxiedImageUrl,
    sb,
    state,
    stickerCoverCandidates,
    stickerFingerprint,
    stickerGroups,
    stickerRarityLabel,
    toast
  } = deps;

  async function maybeAwardReadSticker(item) {
    if (!state.session || !sb || !item || item.local || Math.random() >= 0.25) return;
    const group = stickerGroups().find(entry => entry.kind === "character" && entry.items.some(itemEntry => String(itemEntry.id) === String(item.id)));
    if (!group) return;
    const fingerprint = `read:${item.id}`;
    const claimKey = `${group.id}:${fingerprint}`;
    if (state.stickerAwards.some(award => award.character_id === group.id && award.edition_fingerprint === fingerprint) || state.stickerClaimKeys.has(claimKey)) return;
    const selected = stickerCoverCandidates({ ...group, items: [item] })[0] || { itemId: item.id, url: item.coverUrl || item.cover };
    if (!selected?.url) return;
    const result = await sb.rpc("claim_character_sticker", {
      p_character_id: group.id,
      p_character_name: group.characterName,
      p_publisher_name: group.publisherName,
      p_edition_fingerprint: fingerprint,
      p_edition_ids: [String(item.id)],
      p_cover_item_id: String(selected.itemId),
      p_cover_url: selected.url
    });
    if (result.error) return console.warn("Não foi possível conceder a figurinha da leitura:", result.error.message);
    const award = Array.isArray(result.data) ? result.data[0] : result.data;
    if (award && !state.stickerAwards.some(entry => entry.id === award.id)) state.stickerAwards.unshift(award);
    state.stickerClaimKeys.add(claimKey);
    toast(`Figurinha comum conquistada: ${group.characterName}!`);
  }

  async function maybeAwardCharacterStickers(item) {
    if (!state.session || !sb || !item || item.local) return;
    const groups = stickerGroups().filter(group => ["character", "team"].includes(group.kind) && group.items.some(entry => String(entry.id) === String(item.id)));
    for (const group of groups) {
      if (!group.items.every(entry => state.readingProgress.get(entry.id)?.completed)) continue;
      const fingerprint = stickerFingerprint(group);
      if (state.stickerAwards.some(award => award.character_id === group.id && award.edition_fingerprint === fingerprint)) continue;
      const claimKey = `${group.id}:${fingerprint}`;
      if (state.stickerClaimKeys.has(claimKey)) continue;
      const candidates = stickerCoverCandidates(group);
      const previous = [...state.stickerAwards].filter(award => award.character_id === group.id).sort((a, b) => new Date(b.awarded_at || 0) - new Date(a.awarded_at || 0) || Number(b.id || 0) - Number(a.id || 0)).slice(0, 2);
      const blockedCover = previous.length === 2 && previous[0].cover_url && previous[0].cover_url === previous[1].cover_url ? previous[0].cover_url : null;
      const availableCandidates = blockedCover ? candidates.filter(candidate => candidate.url !== blockedCover) : candidates;
      const selected = (availableCandidates.length ? availableCandidates : candidates)[Math.floor(Math.random() * (availableCandidates.length || candidates.length))] || { itemId: group.items[0].id, url: group.items[0].coverUrl || group.items[0].cover };
      if (!selected?.url) continue;
      const result = await sb.rpc("claim_character_sticker", {
        p_character_id: group.id,
        p_character_name: group.characterName,
        p_publisher_name: group.publisherName,
        p_edition_fingerprint: fingerprint,
        p_edition_ids: group.items.map(entry => String(entry.id)),
        p_cover_item_id: String(selected.itemId),
        p_cover_url: selected.url
      });
      if (result.error) {
        console.warn("Não foi possível conceder a figurinha automaticamente:", result.error.message, { characterId: group.id, fingerprint });
      } else if (result.data) {
        const award = Array.isArray(result.data) ? result.data[0] : result.data;
        if (award && !state.stickerAwards.some(entry => entry.id === award.id)) state.stickerAwards.unshift(award);
        state.stickerClaimKeys.add(claimKey);
        toast(`Figurinha ${group.kind === "series" ? "prateada" : "dourada"} conquistada: ${group.characterName}!`);
      }
    }
  }

  async function maybeAwardCompletedStickers() {
    if (!state.session || !sb) return;
    for (const group of stickerGroups().filter(entry => ["character", "team"].includes(entry.kind))) {
      if (group.items.every(entry => state.readingProgress.get(entry.id)?.completed)) await maybeAwardCharacterStickers(group.items[0]);
    }
  }

  function openStickerPreview(imageUrl, label = "Figurinha") {
    const overlay = document.createElement("div");
    overlay.className = "modal-backdrop sticker-preview-backdrop";
    overlay.innerHTML = `<div class="modal sticker-preview-modal"><button type="button" class="small-btn" data-close>Fechar</button><img src="${escapeHTML(imageUrl)}" alt="${escapeHTML(label)}" draggable="false"><strong>${escapeHTML(label)}</strong></div>`;
    $("#modal-root").appendChild(overlay);
    $$('[data-close]', overlay).forEach(button => button.addEventListener("click", () => overlay.remove()));
    overlay.addEventListener("click", event => { if (event.target === overlay) overlay.remove(); });
    $("img", overlay).addEventListener("dragstart", event => event.preventDefault());
    $("img", overlay).addEventListener("contextmenu", event => event.preventDefault());
  }

  function chooseStickerForTrade(offerable = []) {
    return new Promise(resolve => {
      const overlay = document.createElement("div");
      overlay.className = "modal-backdrop";
      overlay.innerHTML = `<div class="modal sticker-trade-picker"><div class="section-head"><div><div class="eyebrow">Proposta de troca</div><h2>Escolha a figurinha que vai oferecer</h2><div class="section-subtitle">Clique em uma figurinha para selecioná-la.</div></div><button type="button" class="small-btn" data-close>Fechar</button></div><div class="sticker-trade-picker-grid">${offerable.map(award => `<button type="button" class="sticker-trade-choice rarity-${escapeHTML(award.rarity || "standard")}" data-offer-award="${award.id}"><span class="sticker-trade-choice-art"><img src="${escapeHTML(proxiedImageUrl(award.cover_url))}" alt="${escapeHTML(award.character_name)}" draggable="false"></span><strong>${escapeHTML(award.character_name)}</strong><small>${stickerRarityLabel(award.rarity)}</small></button>`).join("")}</div><div class="modal-actions"><button type="button" class="small-btn" data-close>Cancelar</button><button type="button" class="btn btn-danger" data-send-trade disabled>Enviar proposta</button></div></div>`;
      $("#modal-root").appendChild(overlay);
      const selectedIds = new Set();
      const close = value => { overlay.remove(); resolve(value || []); };
      $$('[data-close]', overlay).forEach(button => button.addEventListener("click", () => close(null)));
      overlay.addEventListener("click", event => { if (event.target === overlay) close(null); });
      $$('[data-offer-award]', overlay).forEach(button => button.addEventListener("click", () => {
        const id = button.dataset.offerAward;
        if (selectedIds.has(id)) selectedIds.delete(id);
        else if (selectedIds.size < 2) selectedIds.add(id);
        else return toast("Você pode oferecer no máximo duas figurinhas.");
        button.classList.toggle("is-selected", selectedIds.has(id));
        $('[data-send-trade]', overlay).disabled = selectedIds.size === 0;
      }));
      $('[data-send-trade]', overlay).addEventListener("click", () => close([...selectedIds].map(Number)));
    });
  }

  function chooseStickerForDonation(offerable = []) {
    return new Promise(resolve => {
      const overlay = document.createElement("div");
      overlay.className = "modal-backdrop";
      overlay.innerHTML = `<div class="modal sticker-trade-picker"><div class="section-head"><div><div class="eyebrow">Doação de figurinha</div><h2>Escolha qual figurinha doar</h2><div class="section-subtitle">Selecione uma das suas figurinhas desta personagem.</div></div><button type="button" class="small-btn" data-close>Fechar</button></div><div class="sticker-trade-picker-grid">${offerable.map(award => `<button type="button" class="sticker-trade-choice rarity-${escapeHTML(award.rarity || "standard")}" data-donation-award="${award.id}"><span class="sticker-trade-choice-art"><img src="${escapeHTML(proxiedImageUrl(award.cover_url))}" alt="${escapeHTML(award.character_name)}" draggable="false"></span><strong>${escapeHTML(award.character_name)}</strong><small>${stickerRarityLabel(award.rarity)}</small></button>`).join("")}</div><div class="modal-actions"><button type="button" class="small-btn" data-close>Cancelar</button><button type="button" class="btn btn-danger" data-send-donation disabled>Doar figurinha selecionada</button></div></div>`;
      $("#modal-root").appendChild(overlay);
      let selectedId = null;
      const close = value => { overlay.remove(); resolve(value); };
      $$('[data-close]', overlay).forEach(button => button.addEventListener("click", () => close(null)));
      overlay.addEventListener("click", event => { if (event.target === overlay) close(null); });
      $$('[data-donation-award]', overlay).forEach(button => button.addEventListener("click", () => {
        selectedId = Number(button.dataset.donationAward);
        $$('[data-donation-award]', overlay).forEach(item => item.classList.toggle("is-selected", item === button));
        $('[data-send-donation]', overlay).disabled = false;
      }));
      $('[data-send-donation]', overlay).addEventListener("click", () => close(selectedId));
    });
  }

  function chooseAdminStickerRarity() {
    return new Promise(resolve => {
      const overlay = document.createElement("div");
      overlay.className = "modal-backdrop";
      const rarities = ["standard", "creased", "silver", "gold"];
      overlay.innerHTML = `<div class="modal sticker-rarity-picker"><div class="section-head"><div><div class="eyebrow">Doação administrativa</div><h2>Escolha a raridade</h2><div class="section-subtitle">Selecione a raridade da figurinha que será adicionada ao álbum.</div></div></div><div class="sticker-rarity-picker-grid">${rarities.map(rarity => `<button type="button" class="small-btn sticker-rarity-choice rarity-${rarity}" data-admin-rarity="${rarity}">${stickerRarityLabel(rarity)}</button>`).join("")}</div><div class="modal-actions"><button type="button" class="small-btn" data-close>Cancelar</button></div></div>`;
      $("#modal-root").appendChild(overlay);
      const close = value => { overlay.remove(); resolve(value || null); };
      $$('[data-close]', overlay).forEach(button => button.addEventListener("click", () => close(null)));
      overlay.addEventListener("click", event => { if (event.target === overlay) close(null); });
      $$('[data-admin-rarity]', overlay).forEach(button => button.addEventListener("click", () => close(button.dataset.adminRarity)));
    });
  }

  function chooseStickerCoverCandidate(group, candidates = []) {
    return new Promise(resolve => {
      const overlay = document.createElement("div");
      overlay.className = "modal-backdrop";
      overlay.innerHTML = `<div class="modal sticker-trade-picker"><div class="section-head"><div><div class="eyebrow">Doação administrativa</div><h2>Escolha a imagem da figurinha</h2><div class="section-subtitle">Selecione uma capa disponível ou use um link HTTPS.</div></div><button type="button" class="small-btn" data-close>Fechar</button></div><div class="sticker-trade-picker-grid">${candidates.map((candidate, index) => `<button type="button" class="sticker-trade-choice" data-cover-candidate="${index}"><span class="sticker-trade-choice-art"><img src="${escapeHTML(proxiedImageUrl(candidate.url))}" alt="Capa de ${escapeHTML(group.characterName)}" draggable="false"></span><strong>${escapeHTML(state.db.library.find(item => String(item.id) === String(candidate.itemId))?.title || group.characterName)}</strong><small>${index === 0 ? "Capa disponível" : "Capa variante"}</small></button>`).join("")}</div><div class="field sticker-cover-link-field"><label for="admin-sticker-cover-url">Ou usar imagem por link</label><div class="inline-form"><input id="admin-sticker-cover-url" type="url" placeholder="https://exemplo.com/imagem.jpg" autocomplete="off"><button type="button" class="small-btn" data-use-cover-link>Usar link</button></div><small>O link precisa começar com https://.</small></div><div class="modal-actions"><button type="button" class="small-btn" data-close>Cancelar</button><button type="button" class="btn btn-danger" data-send-cover disabled>Usar esta imagem</button></div></div>`;
      $("#modal-root").appendChild(overlay);
      let selectedIndex = null;
      const close = value => { overlay.remove(); resolve(value); };
      const coverGrid = $(".sticker-trade-picker-grid", overlay);
      const linkControls = $(".inline-form", overlay);
      if (linkControls) {
        linkControls.classList.add("sticker-cover-link-controls");
        linkControls.style.justifyContent = "flex-end";
      }
      $$('[data-close]', overlay).forEach(button => button.addEventListener("click", () => close(null)));
      overlay.addEventListener("click", event => { if (event.target === overlay) close(null); });
      $$('[data-cover-candidate]', overlay).forEach(button => button.addEventListener("click", () => {
        selectedIndex = Number(button.dataset.coverCandidate);
        coverGrid.hidden = false;
        $('[data-use-cover-link]', overlay).classList.remove("is-selected");
        $('[data-send-cover]', overlay).dataset.customCoverUrl = "";
        $$('[data-cover-candidate]', overlay).forEach(item => item.classList.toggle("is-selected", item === button));
        $('[data-send-cover]', overlay).disabled = false;
      }));
      $('[data-use-cover-link]', overlay).addEventListener("click", () => {
        const url = $('[name="admin-sticker-cover-url"]', overlay)?.value.trim() || $("#admin-sticker-cover-url", overlay)?.value.trim() || "";
        if (!/^https:\/\//i.test(url)) return toast("Informe um link HTTPS válido para a imagem.");
        $$('[data-cover-candidate]', overlay).forEach(item => item.classList.remove("is-selected"));
        selectedIndex = null;
        coverGrid.hidden = true;
        $('[data-use-cover-link]', overlay).classList.add("is-selected");
        $('[data-send-cover]', overlay).disabled = false;
        $('[data-send-cover]', overlay).dataset.customCoverUrl = url;
      });
      $('[data-send-cover]', overlay).addEventListener("click", () => {
        const customUrl = $('[data-send-cover]', overlay).dataset.customCoverUrl || "";
        close(customUrl ? { itemId: group.items[0]?.id, url: customUrl } : (candidates[selectedIndex] || null));
      });
    });
  }

  function askStickerDiscardConfirmation() {
    return new Promise(resolve => {
      const overlay = document.createElement("div");
      overlay.className = "modal-backdrop";
      overlay.innerHTML = `<div class="modal sticker-discard-confirm-modal"><div class="section-head"><div><div class="eyebrow">Álbum de figurinhas</div><h2>Descartar figurinha?</h2><div class="section-subtitle">Essa figurinha repetida será removida permanentemente e não poderá ser recuperada.</div></div></div><div class="modal-actions"><button type="button" class="small-btn" data-close>Manter figurinha</button><button type="button" class="btn btn-danger" data-confirm-discard>Descartar</button></div></div>`;
      $("#modal-root").appendChild(overlay);
      const finish = value => { overlay.remove(); resolve(value); };
      $$('[data-close]', overlay).forEach(button => button.addEventListener("click", () => finish(false)));
      overlay.addEventListener("click", event => { if (event.target === overlay) finish(false); });
      $('[data-confirm-discard]', overlay).addEventListener("click", () => finish(true));
    });
  }

  async function requestSticker(characterId, ownerId, type) {
    if (!state.session) return openAuthPage();
    const group = stickerGroups().find(entry => entry.id === characterId);
    const ownerAwards = state.publicProfile?.stickerAwards || [];
    const target = ownerAwards.find(award => award.character_id === characterId) || (state.publicProfile?.profile?.id === ownerId ? currentStickerAwards(state.stickerAwards).get(characterId) : null);
    if (!group || !target) return toast("Esta figurinha não está disponível no álbum.");
    let offeredAwardIds = [];
    if (type === "trade") {
      const offerable = (state.stickerAwards || []).filter(award => award.id !== target.id);
      if (!offerable.length) return toast("Você precisa ter outra figurinha para oferecer.");
      offeredAwardIds = await chooseStickerForTrade(offerable);
      if (!offeredAwardIds.length) return;
    }
    const result = await sb.rpc("create_sticker_request", { p_owner_id: ownerId, p_character_id: characterId, p_character_name: group.characterName, p_edition_fingerprint: stickerFingerprint(group), p_request_type: type, p_offered_award_id: offeredAwardIds[0] || null, p_offered_award_id_2: offeredAwardIds[1] || null });
    if (result.error) return toast(result.error.message || "Não foi possível enviar o pedido.");
    toast(type === "trade" ? "Proposta de troca enviada." : "Pedido de doação enviado.");
  }

  return {
    maybeAwardReadSticker,
    maybeAwardCharacterStickers,
    maybeAwardCompletedStickers,
    openStickerPreview,
    chooseStickerForTrade,
    chooseStickerForDonation,
    chooseAdminStickerRarity,
    chooseStickerCoverCandidate,
    askStickerDiscardConfirmation,
    requestSticker
  };
}
