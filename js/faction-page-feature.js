export function createFactionPageFeature(deps) {
  const {
    $,
    $$,
    CHAT_ROOMS,
    addFactionAbafacImage,
    card,
    currentFactionId,
    editFactionAbafacLink,
    escapeHTML,
    factionAbafacOrder,
    factionAchievementsMarkup,
    factionDot,
    factionHallMarkup,
    factionReportMarkup,
    factionRouteKey,
    loadFactions,
    moveFactionAbafac,
    navigate,
    openChatRoom,
    openFactionAbafacAddEditor,
    openFactionAbafacManager,
    openFactionCatalogEditor,
    openFactionManifestEditor,
    openFactionMuralEditor,
    openSiteConfirm,
    openSitePrompt,
    removeFactionAbafac,
    render,
    save,
    sb,
    state,
    toast,
    toggleFactionCatalogLike,
    toggleFactionCatalogSave,
    validatePublicCatalogLink
  } = deps;

  function applyFactionAbafacOrder(factionId) {
    const page = $(".faction-detail-page");
    if (!page) return;
    const factionRoles = state.factionRoleMembers.filter(item => item.faction_id === factionId);
    const leaderRole = factionRoles.find(item => item.role === "leader");
    const curatorRoles = [1, 2, 3].map(slot => factionRoles.find(item => item.role === "curator" && item.slot === slot));
    const roleProfiles = [leaderRole, ...curatorRoles].map(item => item?.profile || null);
    $$(".faction-featured-role-card", page).forEach((card, index) => {
      const profile = roleProfiles[index];
      if (!profile?.username) return;
      const identity = $("strong", card);
      if (identity) identity.innerHTML = `${factionDot({ ...profile, faction_id: factionId })}@${escapeHTML(profile.username)}`;
      const username = profile.username;
      card.setAttribute("role", "link");
      card.tabIndex = 0;
      const openProfile = () => navigate({ perfil: username });
      card.addEventListener("click", event => { if (event.target.closest(".faction-emblem-button")) return; openProfile(); });
      card.addEventListener("keydown", event => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        openProfile();
      });
    });
    $$(".faction-members-section .faction-member-card", page).forEach(card => {
      const username = $("strong", card)?.textContent.trim().replace(/^@/, "");
      if (!username) return;
      card.setAttribute("role", "link");
      card.tabIndex = 0;
      const openProfile = () => navigate({ perfil: username });
      card.addEventListener("click", openProfile);
      card.addEventListener("keydown", event => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        openProfile();
      });
    });
    const pinnedCollectionsSection = $(".faction-pinned-collections-abafac", page);
    if (pinnedCollectionsSection) {
      $(".section-title", pinnedCollectionsSection).textContent = "Cole\u00e7\u00f5es de quadrinhos em destaque";
      $(".section-subtitle", pinnedCollectionsSection).textContent = "Cole\u00e7\u00f5es com edi\u00e7\u00f5es da editora configurada na fac\u00e7\u00e3o.";
      $$('span', pinnedCollectionsSection).forEach(element => {
        const count = String(element.textContent || "").match(/^\d+/)?.[0];
        if (count) element.textContent = `${count} edi\u00e7\u00e3o(\u00f5es)`;
      });
    }
    const pinnedCharactersSection = $(".faction-pinned-characters-abafac", page);
    if (pinnedCharactersSection) $$('span', pinnedCharactersSection).forEach(element => {
      const count = String(element.textContent || "").match(/^\d+/)?.[0];
      if (count) element.textContent = `${count} edi\u00e7\u00e3o(\u00f5es)`;
    });
    const catalogSections = Object.fromEntries($$(".faction-catalog-abafac", page).map(section => [section.dataset.factionAbafac, section]));
    const sections = {
      stats: $(".faction-stats-abafac", page),
      manifest: $(".faction-manifest-abafac", page),
      mural: $(".faction-mural-abafac", page),
      missions: $(".faction-missions-abafac", page),
      achievements: $(".faction-achievements-abafac", page),
      hall: $(".faction-hall-abafac", page),
      showcase: $(".faction-showcase-abafac", page),
      report: $(".faction-report-abafac", page),
      leadership: $(".faction-leadership-tools", page),
      members: $(".faction-members-section", page),
      "mandatory-reads": $(".faction-mandatory-reads-abafac", page),
      "continue-reading": $(".faction-continue-reading-abafac", page),
      "recently-added": $(".faction-recently-added-abafac", page),
      "featured-character": $(".faction-featured-character-abafac", page),
      "new-series": $(".faction-new-series-abafac", page),
      "most-read-month": $(".faction-most-read-month-abafac", page),
      "best-series": $(".faction-best-series-abafac", page),
      tips: $(".faction-tips-abafac", page),
      random: $(".faction-random-abafac", page),
      artist: $(".faction-artist-abafac", page),
      recommendations: $(".faction-recommendations-abafac", page),
      "random-publisher": $(".faction-random-publisher-abafac", page),
      downloads: $(".faction-downloads-abafac", page),
      "most-read": $(".faction-most-read-abafac", page),
      "pinned-imprints": $(".faction-pinned-imprints-abafac", page),
      "pinned-characters": $(".faction-pinned-characters-abafac", page),
      "pinned-collections": $(".faction-pinned-collections-abafac", page),
      "faction-chat": $(".faction-chat-abafac", page),
      ...catalogSections
    };
    const factionRole = state.factionRoles.find(role => role.faction_id === factionId && role.user_id === state.session?.user?.id);
    if (["leader", "curator"].includes(factionRole?.role)) {
      Object.entries(catalogSections).forEach(([key, section]) => {
        const catalog = state.factionAbafacCatalogs.get(key);
        const head = $(".section-head", section);
        if (!catalog || !head || $("[data-faction-public-catalog-pin]", head)) return;
        const button = document.createElement("button");
        button.type = "button";
        button.className = "small-btn";
        const pinned = state.factionPinnedPublicCollections.has(`${factionId}:${catalog.id}`);
        button.dataset.factionPublicCatalogPin = catalog.id;
        button.dataset.factionPublicCatalogPinned = pinned ? "true" : "false";
        button.textContent = pinned ? "★ Destaque da facção" : "☆ Destacar na facção";
        head.appendChild(button);
      });
    }
    if (sections.hall) {
      const hallHead = $(".section-head", sections.hall);
      sections.hall.innerHTML = `${hallHead?.outerHTML || ""}${factionHallMarkup(factionId)}`;
      $$('[data-faction-hall-category]', sections.hall).forEach(button => button.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();
        state.factionHallCategory = button.dataset.factionHallCategory || "all";
        render();
      }));
    }
    if (sections.achievements) {
      const achievementsHead = $(".section-head", sections.achievements);
      sections.achievements.innerHTML = `${achievementsHead?.outerHTML || ""}${factionAchievementsMarkup(factionId)}`;
    }
    if (sections.report) {
      const reportHead = $(".section-head", sections.report);
      sections.report.innerHTML = `${reportHead?.outerHTML || ""}${factionReportMarkup(factionId)}`;
    }
    state.factionAbafacImages.filter(image => image.faction_id === factionId).forEach(image => {
      const key = `image:${image.id}`;
      const section = document.createElement("section");
      section.className = "section faction-abafac-image-section linhafac";
      section.dataset.factionAbafac = key;
      const imageCard = `<div class="faction-abafac-image-card"><img src="${escapeHTML(image.image_url)}" alt="Imagem abafac da facção" loading="lazy"></div>`;
      const imageContent = image.link_url ? `<a class="faction-abafac-image-link" href="${escapeHTML(image.link_url)}">${imageCard}</a>` : imageCard;
      section.innerHTML = `<div class="faction-abafac-image-layout">${imageContent}</div>`;
      page.appendChild(section);
      sections[key] = section;
    });
    const order = factionAbafacOrder(factionId);
    const role = state.factionRoles.find(item => item.faction_id === factionId && item.user_id === state.session?.user?.id);
    const canManage = role && ["leader", "curator"].includes(role.role);
    const standaloneCatalog = Boolean(state.factionCatalogId);
    const anchor = $(".faction-detail-hero", page);
    let previous = anchor;
    order.forEach((key, index) => {
      const section = sections[key];
      if (!section) return;
      section.hidden = !order.includes(key);
      section.dataset.factionAbafac = key;
      previous?.after(section);
      previous = section;
      if (standaloneCatalog && key.startsWith("faction-catalog:")) {
        $(".section-head > div:first-child", section)?.remove();
        const catalogPageHead = $(".faction-catalog-page > .section-head", page);
        const backButton = $("a.small-btn", catalogPageHead);
        const catalogActions = $(".shelf-section-actions", section);
        if (catalogPageHead && backButton && catalogActions) {
          backButton.replaceWith(catalogActions);
          if (["moderator", "banca", "admin"].includes(state.profile?.plan) && !$("[data-faction-catalog-feature]", catalogActions)) {
            const catalog = state.factionCatalogs.find(item => `faction-catalog:${item.id}` === key);
            if (catalog) {
              const featureButton = document.createElement("button");
              featureButton.type = "button";
              featureButton.className = "small-btn";
              featureButton.dataset.factionCatalogFeature = catalog.id;
              featureButton.dataset.factionCatalogFeatured = catalog.is_featured ? "true" : "false";
              featureButton.textContent = catalog.is_featured ? "Remover destaque" : "Destacar";
              catalogActions.appendChild(featureButton);
              if (!$("[data-faction-catalog-delete]", catalogActions)) {
                const deleteButton = document.createElement("button");
                deleteButton.type = "button";
                deleteButton.className = "small-btn danger";
                deleteButton.dataset.factionCatalogDelete = catalog.id;
                deleteButton.textContent = "Excluir";
                catalogActions.appendChild(deleteButton);
              }
            }
          }
        }
      }
      if ((!canManage && key !== "members") || $("[data-faction-abafac-controls]", section)) return;
      const head = $(".section-head", section) || $(".global-recommendations-heading", section);
      if (!key.startsWith("image:") && key !== "stats" && !head) return;
      const controls = document.createElement("div");
      controls.className = "faction-abafac-controls";
      controls.dataset.factionAbafacControls = "true";
      controls.addEventListener("click", event => event.stopPropagation());
      controls.innerHTML = `${canManage ? `<button type="button" class="small-btn" data-faction-abafac-move="up" data-faction-abafac-key="${key}" ${index === 0 ? "disabled" : ""} title="Mover aba para cima" aria-label="Mover aba para cima">↑</button><button type="button" class="small-btn" data-faction-abafac-move="down" data-faction-abafac-key="${key}" ${index === order.length - 1 ? "disabled" : ""} title="Mover aba para baixo" aria-label="Mover aba para baixo">↓</button>` : ""}${key.startsWith("image:") ? `<button type="button" class="small-btn" data-faction-abafac-link="${key}" title="Editar link da imagem" aria-label="Editar link da imagem">↗</button>` : ""}${key === "members" ? `<button type="button" class="small-btn" data-faction-view-members="${factionId}" title="Ver todos os membros" aria-label="Ver todos os membros">Ver todos</button>` : ""}${canManage && !["stats", "catalog"].includes(key) ? `<button type="button" class="small-btn danger" data-faction-abafac-remove="${key}" title="Mover abafac para o final" aria-label="Mover abafac para o final">×</button>` : ""}`;
      if (standaloneCatalog) {
        $$('[data-faction-abafac-move], [data-faction-abafac-remove]', controls).forEach(button => button.remove());
      }
      if (key === "mandatory-reads") {
        head.appendChild(controls);
      } else if (key.startsWith("image:")) {
        $(".faction-abafac-image-layout", section)?.appendChild(controls);
      } else if (key === "stats") {
        section.appendChild(controls);
      } else {
        head.appendChild(controls);
      }
      $$('[data-faction-abafac-move]', controls).forEach(button => button.addEventListener("click", () => moveFactionAbafac(factionId, key, button.dataset.factionAbafacMove === "up" ? -1 : 1)));
      $('[data-faction-abafac-link]', controls)?.addEventListener("click", () => editFactionAbafacLink(factionId, key));
      $('[data-faction-view-members]', controls)?.addEventListener("click", () => navigate({ pagina: "faccoes", faccao: factionRouteKey(factionId), membros: "1" }));
      $('[data-faction-abafac-remove]', controls)?.addEventListener("click", event => { event.currentTarget.closest("[data-faction-abafac]")?.setAttribute("hidden", ""); removeFactionAbafac(factionId, key); });
    });
    $$('[data-faction-catalog-share]', page).forEach(button => button.onclick = async () => {
      const link = new URL(`?pagina=faccoes&faccao=${encodeURIComponent(factionRouteKey(factionId))}&catalogo=${encodeURIComponent(button.dataset.factionCatalogShare)}`, window.location.href).href;
      try { await navigator.clipboard.writeText(link); toast("Link da facção copiado."); } catch { await openSitePrompt("Copie o link da facção:", link, { title: "Compartilhar facção", label: "Link" }); }
    });
    $$('[data-faction-catalog-like]', page).forEach(button => button.onclick = event => {
      event.stopPropagation();
      toggleFactionCatalogLike(button.dataset.factionCatalogLike);
    });
    $$('[data-faction-catalog-save]', page).forEach(button => button.onclick = event => {
      event.stopPropagation();
      toggleFactionCatalogSave(button.dataset.factionCatalogSave);
    });
    $$('[data-faction-catalog-pin]', page).forEach(button => button.onclick = async event => {
      event.stopPropagation();
      const factionId = currentFactionId();
      const catalogId = String(button.dataset.factionCatalogPin || "");
      const pinned = button.dataset.factionCatalogPinned === "true";
      const result = await sb.rpc("toggle_faction_collection_pin", { p_faction_id: factionId, p_catalog_id: catalogId, p_pinned: !pinned });
      if (result.error) return toast(result.error.message || "Não foi possível atualizar o destaque da coleção.");
      const mapKey = `${factionId}:${catalogId}`;
      if (pinned) state.factionPinnedCollections.delete(mapKey);
      else state.factionPinnedCollections.set(mapKey, { faction_id: factionId, catalog_id: catalogId });
      render();
    });
    $$('[data-faction-public-catalog-pin]', page).forEach(button => button.onclick = async event => {
      event.stopPropagation();
      const pinned = button.dataset.factionPublicCatalogPinned === "true";
      const collectionId = String(button.dataset.factionPublicCatalogPin || "");
      const result = await sb.rpc("toggle_faction_public_collection_pin", { p_faction_id: factionId, p_collection_id: collectionId, p_pinned: !pinned });
      if (result.error) return toast(result.error.message || "Não foi possível atualizar o destaque da coleção pública.");
      const mapKey = `${factionId}:${collectionId}`;
      if (pinned) state.factionPinnedPublicCollections.delete(mapKey);
      else state.factionPinnedPublicCollections.set(mapKey, { faction_id: factionId, collection_id: collectionId });
      render();
    });
    $$('[data-faction-chat-open]', page).forEach(button => button.onclick = event => {
      event.preventDefault();
      event.stopPropagation();
      const room = CHAT_ROOMS.find(item => item.id === button.dataset.factionChatOpen);
      if (room) openChatRoom(room);
    });
    $$('[data-faction-catalog-feature]', page).forEach(button => button.onclick = async event => {
      event.stopPropagation();
      const result = await sb.rpc("set_faction_catalog_featured", { p_catalog_id: button.dataset.factionCatalogFeature, p_featured: button.dataset.factionCatalogFeatured !== "true" });
      if (result.error) return toast(result.error.message || "Não foi possível atualizar o destaque do catálogo.");
      await loadFactions();
      render();
    });
    $$('[data-faction-catalog-sort]', page).forEach(select => select.onchange = async event => {
      const result = await sb.rpc("update_faction_catalog_sort", { p_catalog_id: event.currentTarget.dataset.factionCatalogSort, p_sort_order: event.currentTarget.value });
      if (result.error) return toast(result.error.message || "Não foi possível ordenar o catálogo.");
      await loadFactions();
      render();
    });
    $$('[data-faction-catalog-edit-inline]', page).forEach(button => button.onclick = async () => {
      const catalog = state.factionCatalogs.find(item => String(item.id) === button.dataset.factionCatalogEditInline);
      if (!catalog) return;
      const values = await openFactionCatalogEditor(factionId, catalog);
      if (!values) return;
      const result = await sb.rpc("save_faction_catalog", { p_catalog_id: catalog.id, p_faction_id: factionId, p_name: values.name, p_cover_url: values.coverUrl || null, p_item_ids: values.itemIds });
      if (result.error) return toast(result.error.message || "Não foi possível editar o catálogo.");
      await loadFactions();
      render();
    });
    $$('[data-faction-catalog-delete]', page).forEach(button => button.onclick = async () => {
      if (!await openSiteConfirm("Excluir este catálogo da facção?", { title: "Excluir catálogo?", confirmLabel: "Excluir catálogo" })) return;
      const result = await sb.rpc("delete_faction_catalog", { p_catalog_id: button.dataset.factionCatalogDelete });
      if (result.error) return toast(result.error.message || "Não foi possível excluir o catálogo.");
      await loadFactions();
      render();
    });
    const currentFaction = state.factions.find(item => item.id === factionId);
    const canEditManifest = currentFaction && (["admin"].includes(state.profile?.plan) || ["leader", "curator"].includes(role?.role));
    const manifestSection = sections.manifest;
    if (canEditManifest && manifestSection && !$("[data-faction-edit-manifest]", manifestSection)) {
      const editManifestButton = document.createElement("button");
      editManifestButton.type = "button";
      editManifestButton.className = "small-btn faction-manifest-edit-button";
      editManifestButton.dataset.factionEditManifest = "true";
      editManifestButton.textContent = "Editar manifesto";
      manifestSection.appendChild(editManifestButton);
      editManifestButton.onclick = async () => {
        const manifest = await openFactionManifestEditor(currentFaction);
        if (manifest === null) return;
        const result = await sb.rpc("update_faction_manifesto", { p_faction_id: currentFaction.id, p_manifesto: manifest });
        if (result.error) return toast(result.error.message || "Não foi possível atualizar o manifesto.");
        await loadFactions();
        render();
      };
    }
    const muralSection = sections.mural;
    if (canEditManifest && muralSection && !$("[data-faction-edit-mural]", muralSection)) {
      const editMuralButton = document.createElement("button");
      editMuralButton.type = "button";
      editMuralButton.className = "small-btn faction-manifest-edit-button";
      editMuralButton.dataset.factionEditMural = "true";
      editMuralButton.textContent = "Editar aviso";
      muralSection.appendChild(editMuralButton);
      editMuralButton.onclick = async () => {
        const notice = await openFactionMuralEditor(currentFaction);
        if (notice === null) return;
        const result = await sb.rpc("update_faction_mural", { p_faction_id: currentFaction.id, p_notice: notice });
        if (result.error) return toast(result.error.message || "Não foi possível atualizar o aviso.");
        await loadFactions();
        render();
      };
    }
    Object.entries(sections).forEach(([key, section]) => { if (section && !order.includes(key)) section.hidden = true; });
    $$('[data-faction-resign], .faction-management-note', page).forEach(element => { element.textContent = element.textContent.replaceAll("Desistir da liderança", "Renunciar").replaceAll("desistir do cargo", "renunciar"); });

    if (canManage) {
      const detailHead = $(".faction-detail-page > .section-head");
      const backButton = $("[data-faction-back]", detailHead);
      let detailActions = $(".faction-detail-actions", detailHead);
      if (!detailActions && backButton) {
        detailActions = document.createElement("div");
        detailActions.className = "faction-detail-actions";
        backButton.replaceWith(detailActions);
        detailActions.appendChild(backButton);
      }
      if (detailActions && !$("[data-faction-abafac-manage]", detailActions)) {
        const manageButton = document.createElement("button");
        manageButton.type = "button";
        manageButton.className = "small-btn";
        manageButton.dataset.factionAbafacManage = "true";
        manageButton.textContent = "Gerenciar abafacs";
        manageButton.onclick = () => openFactionAbafacManager(factionId);
        detailActions.appendChild(manageButton);
      }
      if (detailActions && !$('[data-faction-abafac-add]', detailActions)) {
        const addButton = document.createElement("button");
        addButton.type = "button";
        addButton.className = "small-btn";
        addButton.dataset.factionAbafacAdd = "true";
        addButton.textContent = "Adicionar abafac";
        addButton.onclick = async () => {
          const values = await openFactionAbafacAddEditor();
          if (!values) return;
          if (values.createFactionCatalog) {
            const catalog = await openFactionCatalogEditor(factionId);
            if (!catalog) return;
            const result = await sb.rpc("save_faction_catalog", { p_catalog_id: null, p_faction_id: factionId, p_name: catalog.name, p_cover_url: catalog.coverUrl || null, p_item_ids: catalog.itemIds });
            if (result.error) return toast(result.error.message || "Não foi possível criar o catálogo da facção.");
            await loadFactions();
            const order = factionAbafacOrder(factionId);
            const key = `faction-catalog:${result.data}`;
            if (!order.includes(key)) order.push(key);
            const orderResult = await sb.rpc("update_faction_abafac_order", { p_faction_id: factionId, p_order: order });
            if (orderResult.error) return toast(orderResult.error.message || "Não foi possível ativar o catálogo da facção.");
            await loadFactions();
            return render();
          }
          if (values.continueReading) {
            const order = factionAbafacOrder(factionId);
            if (!order.includes("continue-reading")) order.push("continue-reading");
            const orderResult = await sb.rpc("update_faction_abafac_order", { p_faction_id: factionId, p_order: order });
            if (orderResult.error) return toast(orderResult.error.message || "Não foi possível ativar a abafac de leitura.");
          }
          if (values.recentlyAdded) {
            const order = factionAbafacOrder(factionId);
            if (!order.includes("recently-added")) order.push("recently-added");
            const orderResult = await sb.rpc("update_faction_abafac_order", { p_faction_id: factionId, p_order: order });
            if (orderResult.error) return toast(orderResult.error.message || "Não foi possível ativar a abafac de novidades.");
          }
          if (values.featuredCharacter) {
            const order = factionAbafacOrder(factionId);
            if (!order.includes("featured-character")) order.push("featured-character");
            const orderResult = await sb.rpc("update_faction_abafac_order", { p_faction_id: factionId, p_order: order });
            if (orderResult.error) return toast(orderResult.error.message || "Não foi possível ativar a abafac de personagem.");
          }
          if (values.newSeries) {
            const order = factionAbafacOrder(factionId);
            if (!order.includes("new-series")) order.push("new-series");
            const orderResult = await sb.rpc("update_faction_abafac_order", { p_faction_id: factionId, p_order: order });
            if (orderResult.error) return toast(orderResult.error.message || "Não foi possível ativar a abafac de séries novas.");
          }
          if (values.mostReadMonth) {
            const order = factionAbafacOrder(factionId);
            if (!order.includes("most-read-month")) order.push("most-read-month");
            const orderResult = await sb.rpc("update_faction_abafac_order", { p_faction_id: factionId, p_order: order });
            if (orderResult.error) return toast(orderResult.error.message || "Não foi possível ativar a abafac de mais lidos.");
          }
          if (values.bestSeries) {
            const order = factionAbafacOrder(factionId);
            if (!order.includes("best-series")) order.push("best-series");
            const orderResult = await sb.rpc("update_faction_abafac_order", { p_faction_id: factionId, p_order: order });
            if (orderResult.error) return toast(orderResult.error.message || "Não foi possível ativar a abafac de melhores séries.");
          }
          if (values.tips) {
            const order = factionAbafacOrder(factionId);
            if (!order.includes("tips")) order.push("tips");
            const orderResult = await sb.rpc("update_faction_abafac_order", { p_faction_id: factionId, p_order: order });
            if (orderResult.error) return toast(orderResult.error.message || "Não foi possível ativar a abafac de dicas.");
          }
          if (values.randomChoice) {
            const order = factionAbafacOrder(factionId);
            if (!order.includes("random")) order.push("random");
            const orderResult = await sb.rpc("update_faction_abafac_order", { p_faction_id: factionId, p_order: order });
            if (orderResult.error) return toast(orderResult.error.message || "Não foi possível ativar a abafac de escolha aleatória.");
          }
          if (values.artist) {
            const order = factionAbafacOrder(factionId);
            if (!order.includes("artist")) order.push("artist");
            const orderResult = await sb.rpc("update_faction_abafac_order", { p_faction_id: factionId, p_order: order });
            if (orderResult.error) return toast(orderResult.error.message || "Não foi possível ativar a abafac de artista.");
          }
          if (values.recommendations) {
            const order = factionAbafacOrder(factionId);
            if (!order.includes("recommendations")) order.push("recommendations");
            const orderResult = await sb.rpc("update_faction_abafac_order", { p_faction_id: factionId, p_order: order });
            if (orderResult.error) return toast(orderResult.error.message || "Não foi possível ativar a abafac de curadoria global.");
          }
          if (values.randomPublisher) {
            const order = factionAbafacOrder(factionId);
            if (!order.includes("random-publisher")) order.push("random-publisher");
            const orderResult = await sb.rpc("update_faction_abafac_order", { p_faction_id: factionId, p_order: order });
            if (orderResult.error) return toast(orderResult.error.message || "Não foi possível ativar a abafac de editora aleatória.");
          }
          if (values.downloads) {
            const order = factionAbafacOrder(factionId);
            if (!order.includes("downloads")) order.push("downloads");
            const orderResult = await sb.rpc("update_faction_abafac_order", { p_faction_id: factionId, p_order: order });
            if (orderResult.error) return toast(orderResult.error.message || "Não foi possível ativar a abafac de downloads.");
          }
          if (values.mostRead) {
            const order = factionAbafacOrder(factionId);
            if (!order.includes("most-read")) order.push("most-read");
            const orderResult = await sb.rpc("update_faction_abafac_order", { p_faction_id: factionId, p_order: order });
            if (orderResult.error) return toast(orderResult.error.message || "Não foi possível ativar a abafac de mais lidos.");
          }
          if (values.pinnedImprints) {
            const order = factionAbafacOrder(factionId);
            if (!order.includes("pinned-imprints")) order.push("pinned-imprints");
            const orderResult = await sb.rpc("update_faction_abafac_order", { p_faction_id: factionId, p_order: order });
            if (orderResult.error) return toast(orderResult.error.message || "Não foi possível ativar a abafac de selos fixados.");
          }
          if (values.pinnedCharacters) {
            const order = factionAbafacOrder(factionId);
            if (!order.includes("pinned-characters")) order.push("pinned-characters");
            const orderResult = await sb.rpc("update_faction_abafac_order", { p_faction_id: factionId, p_order: order });
            if (orderResult.error) return toast(orderResult.error.message || "Não foi possível ativar a abafac de personagens em destaque.");
          }
          if (values.pinnedCollections) {
            const order = factionAbafacOrder(factionId);
            if (!order.includes("pinned-collections")) order.push("pinned-collections");
            const orderResult = await sb.rpc("update_faction_abafac_order", { p_faction_id: factionId, p_order: order });
            if (orderResult.error) return toast(orderResult.error.message || "Não foi possível ativar a abafac de coleções em destaque.");
          }
          const catalogUrl = await validatePublicCatalogLink(values.catalogUrl);
          if (catalogUrl === false) return toast("Informe o link de uma coleção pública de quadrinhos deste site.");
          let catalogKey = null;
          if (catalogUrl !== null) {
            const catalogResult = await sb.rpc("add_faction_abafac_catalog", { p_faction_id: factionId, p_catalog_url: catalogUrl });
            if (catalogResult.error) return toast(catalogResult.error.message || "Não foi possível adicionar o catálogo.");
            if (catalogResult.data) catalogKey = `catalog:${catalogResult.data}`;
          }
          if (values.imageUrl && await addFactionAbafacImage(factionId, values.imageUrl, values.imageLink) !== true) return;
          await loadFactions();
          const catalogOrder = factionAbafacOrder(factionId);
          if (catalogKey && !catalogOrder.includes(catalogKey)) catalogOrder.push(catalogKey);
          const orderResult = await sb.rpc("update_faction_abafac_order", { p_faction_id: factionId, p_order: catalogOrder });
          if (orderResult.error) return toast(orderResult.error.message || "Não foi possível atualizar a ordem das Abafacs.");
          await loadFactions();
          render();
        };
        detailActions.appendChild(addButton);
      }
      const roleActions = $(".faction-leader-actions", page);
      if (detailActions && roleActions) {
        $$('button', roleActions).forEach(button => detailActions.appendChild(button));
        roleActions.remove();
      }
      if (detailActions && role.role === "curator" && !$("[data-faction-resign-curator]", detailActions)) {
        const resignCurator = document.createElement("button");
        resignCurator.type = "button";
        resignCurator.className = "small-btn";
        resignCurator.dataset.factionResignCurator = "true";
        resignCurator.textContent = "Renunciar à curadoria";
        resignCurator.onclick = async () => {
          const result = await sb.rpc("resign_faction_curator");
          if (result.error) return toast(result.error.message || "Não foi possível renunciar à curadoria.");
          await loadFactions();
          render();
        };
        detailActions.appendChild(resignCurator);
      }
    }
  }

  return {
    applyFactionAbafacOrder
  };
}
