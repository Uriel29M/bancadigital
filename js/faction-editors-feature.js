export function createFactionEditorsFeature(deps) {
  const {
    $,
    $$,
    FACTION_COLOR_OPTIONS,
    FACTION_EMBLEM_OPTIONS,
    canChooseFaction,
    escapeHTML,
    loadFactions,
    render,
    sb,
    shelfComicPickerMarkup,
    state,
    toast
  } = deps;

  function openFactionIdentityEditorV2(faction) {
    return new Promise(resolve => {
      const currentColor = String(faction?.color || FACTION_COLOR_OPTIONS[0].light).toLowerCase();
      const currentEmblem = FACTION_EMBLEM_OPTIONS.includes(faction?.emblem) ? faction.emblem : FACTION_EMBLEM_OPTIONS[0];
      const otherColors = new Set(state.factions.filter(item => item.id !== faction?.id).map(item => String(item.color || "").toLowerCase()));
      const usedFamilies = new Set(FACTION_COLOR_OPTIONS.filter(option => otherColors.has(option.light) || otherColors.has(option.dark)).map(option => option.family));
      const blockedLabels = FACTION_COLOR_OPTIONS.filter(option => usedFamilies.has(option.family)).map(option => option.label);
      const otherEmblems = new Set(state.factions.filter(item => item.id !== faction?.id).map(item => item.emblem).filter(Boolean));
      const usedPublishers = new Set(state.factions.filter(item => item.id !== faction?.id).map(item => String(item.publisher_name || "").trim().toLocaleLowerCase("pt-BR")).filter(Boolean));
      const publisherNames = [...new Set(state.db.library.map(item => String(item.publisher || "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR"));
      let colorChoices = FACTION_COLOR_OPTIONS.map(option => [
        { tone: "claro", value: option.light },
        { tone: "escuro", value: option.dark }
      ].map(choice => {
        const blocked = usedFamilies.has(option.family) && currentColor !== choice.value;
        const selected = currentColor === choice.value;
        return `<button type="button" class="faction-color-choice ${selected ? "is-selected" : ""}" data-color="${choice.value}" style="--choice-color:${choice.value}" ${blocked ? "disabled" : ""} aria-label="${option.label} ${choice.tone}" title="${blocked ? "Cor já usada por outra facção" : `${option.label} · ${choice.tone}`}"${blocked ? " aria-disabled=\"true\"" : ""}></button>`;
      }).join("")).join("");
      colorChoices = colorChoices.replace(/<button([^>]*data-color="([^"]+)"[^>]*)><\/button>/g, (_, attributes, value) => {
        const option = FACTION_COLOR_OPTIONS.find(item => item.light === value || item.dark === value);
        const tone = option?.light === value ? "claro" : "escuro";
        return `<button${attributes}><span>${escapeHTML(option?.label || "Cor")}<small>${tone}</small></span></button>`;
      });
      if (blockedLabels.length) colorChoices += `<small class="faction-identity-warning">Bloqueadas por já pertencerem a outras facções: ${escapeHTML(blockedLabels.join(", "))}.</small>`;
      const emblemChoices = FACTION_EMBLEM_OPTIONS.map(emblem => { const blocked = otherEmblems.has(emblem); return `<button type="button" class="faction-emblem-choice ${emblem === currentEmblem ? "is-selected" : ""}" data-emblem="${escapeHTML(emblem)}" ${blocked ? "disabled" : ""} aria-disabled="${blocked ? "true" : "false"}" aria-label="Emoji ${escapeHTML(emblem)}" title="${blocked ? "Emoji já usado por outra facção" : "Escolher este emoji"}">${escapeHTML(emblem)}</button>`; }).join("");
      const overlay = document.createElement("div");
      overlay.className = "modal-backdrop faction-modal-backdrop";
      overlay.innerHTML = `<div class="modal faction-modal faction-identity-modal" style="--faction-color:${escapeHTML(currentColor)}"><div class="section-head"><div><div class="eyebrow">Identidade da facção</div><h2>Editar facção</h2><div class="section-subtitle">Escolha a cor, o emoji e a descrição da sua facção.</div></div><button type="button" class="small-btn" data-faction-modal-close>Fechar</button></div><form class="faction-identity-form"><label class="field"><span>Nome da facção</span><input name="name" type="text" minlength="3" maxlength="80" value="${escapeHTML(faction?.name || "")}" required></label><div class="field"><span>Cor da facção</span><div class="faction-color-palette">${colorChoices}</div><small class="faction-identity-help">Em cada cor, o quadrado da esquerda é claro e o da direita é escuro. Quadrados apagados já pertencem a outra facção.</small><input name="color" type="hidden" value="${escapeHTML(currentColor)}"></div><div class="field"><span>Emoji da facção</span><div class="faction-emblem-palette">${emblemChoices}</div><input name="emblem" type="hidden" value="${escapeHTML(currentEmblem)}"></div><label class="field"><span>Descrição</span><textarea name="description" maxlength="500" rows="4">${escapeHTML(faction?.description || "")}</textarea></label><div class="modal-actions"><button type="button" class="small-btn" data-faction-modal-cancel>Cancelar</button><button type="submit" class="small-btn faction-modal-primary">Salvar alterações</button></div></form></div>`;
      const finish = value => { overlay.remove(); resolve(value); };
      const modal = $(".faction-modal", overlay);
      const form = $(".faction-identity-form", overlay);
      const continueOption = document.createElement("span");
      continueOption.hidden = true;
      continueOption.innerHTML = '<span>Abafac de leitura</span><label><input name="continueReading" type="checkbox"> Continue de onde parou</label><small class="faction-identity-help">Mostra, dentro da facção, as edições que cada membro ainda não terminou.</small>';
      form.prepend(continueOption);
      form.addEventListener("submit", event => {
        if (!$("[name=continueReading]", form)?.checked) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        finish({ catalogUrl: "", imageUrl: "", imageLink: "", continueReading: true });
      }, true);
      const descriptionField = $('[name="description"]', form)?.closest(".field");
      if (descriptionField) {
        const publisherOptions = [`<option value="">Nenhuma editora</option>`, ...publisherNames.map(name => {
          const selected = String(faction?.publisher_name || "").trim() === name;
          const unavailable = !selected && usedPublishers.has(name.toLocaleLowerCase("pt-BR"));
          return `<option value="${escapeHTML(name)}" ${selected ? "selected" : ""} ${unavailable ? "disabled" : ""}>${escapeHTML(name)}${unavailable ? " (já definida por outra facção)" : ""}</option>`;
        })].join("");
        descriptionField.insertAdjacentHTML("beforebegin", `<label class="field"><span>Editora da facção</span><select name="publisherName">${publisherOptions}</select><small class="faction-identity-help">Cada editora pode ser definida por apenas uma facção.</small></label>`);
      }
      $$('[data-color]', form).forEach(button => button.addEventListener("click", () => {
        const value = button.dataset.color;
        $('[name=color]', form).value = value;
        modal.style.setProperty("--faction-color", value);
        $$('[data-color]', form).forEach(item => item.classList.toggle("is-selected", item === button));
      }));
      $$('[data-emblem]', form).forEach(button => button.addEventListener("click", () => {
        $('[name=emblem]', form).value = button.dataset.emblem;
        $$('[data-emblem]', form).forEach(item => item.classList.toggle("is-selected", item === button));
      }));
      form.addEventListener("submit", event => { event.preventDefault(); const data = new FormData(form); finish({ name: String(data.get("name") || "").trim(), color: String(data.get("color") || "").trim(), emblem: String(data.get("emblem") || "").trim(), publisherName: String(data.get("publisherName") || "").trim(), description: String(data.get("description") || "").trim() }); });
      overlay.addEventListener("click", event => { if (event.target === overlay) finish(null); });
      $("[data-faction-modal-close]", overlay).onclick = () => finish(null);
      $("[data-faction-modal-cancel]", overlay).onclick = () => finish(null);
      $("#modal-root").appendChild(overlay);
      $("[name=name]", form).focus();
    });
  }

  function openFactionAbafacAddEditor() {
    return new Promise(resolve => {
      const overlay = document.createElement("div");
      overlay.className = "modal-backdrop faction-modal-backdrop";
      overlay.innerHTML = `<div class="modal faction-modal faction-abafac-add-modal"><div class="section-head"><div><div class="eyebrow">Abafac da facção</div><h2>Adicionar abafac</h2><div class="section-subtitle">Adicione um catálogo público ou uma imagem por link.</div></div><button type="button" class="small-btn" data-faction-modal-close>Fechar</button></div><form class="faction-identity-form"><label class="field"><span>Catálogo público como abafac (opcional)</span><input name="catalogUrl" type="text" maxlength="500" placeholder="?perfil=usuario&lista=id"><small class="faction-identity-help">Cole o link de uma coleção pública de quadrinhos deste site. Deixe vazio para não adicionar catálogo.</small></label><label class="field"><span>Link da imagem abafac</span><input name="abafacImageUrl" type="url" maxlength="2000" placeholder="https://exemplo.com/imagem.jpg"><small class="faction-identity-help">Cole uma URL HTTPS direta para a imagem. Nenhum arquivo será enviado para o site.</small></label><label class="field"><span>Link interno da imagem (opcional)</span><input name="abafacLink" type="text" maxlength="500" placeholder="?pagina=ranking"><small class="faction-identity-help">Aceita somente destinos dentro deste site. O link será aplicado ao card inteiro.</small></label><div class="modal-actions"><button type="button" class="small-btn" data-faction-modal-cancel>Cancelar</button><button type="submit" class="small-btn faction-modal-primary">Adicionar</button></div></form></div>`;
      const finish = value => { overlay.remove(); resolve(value); };
      const form = $(".faction-identity-form", overlay);
      const addContinueOption = document.createElement("label");
      addContinueOption.className = "field faction-abafac-option";
      addContinueOption.innerHTML = '<span>Abafac de leitura</span><label><input name="continueReading" type="checkbox"> Continue de onde parou</label><small class="faction-identity-help">Mostra, dentro da facção, as edições que cada membro ainda não terminou.</small>';
      form.prepend(addContinueOption);
      const addRecentlyAddedOption = document.createElement("label");
      addRecentlyAddedOption.className = "field faction-abafac-option";
      addRecentlyAddedOption.innerHTML = '<span>Abafac de catálogo</span><label><input name="recentlyAdded" type="checkbox"> Adicionados recentemente</label><small class="faction-identity-help">Mostra as edições mais novas disponíveis na banca.</small>';
      form.prepend(addRecentlyAddedOption);
      const addFeaturedCharacterOption = document.createElement("label");
      addFeaturedCharacterOption.className = "field faction-abafac-option";
      addFeaturedCharacterOption.innerHTML = '<span>Abafac editorial</span><label><input name="featuredCharacter" type="checkbox"> Personagem em destaque</label><small class="faction-identity-help">Destaca um personagem da editora da facção.</small>';
      form.prepend(addFeaturedCharacterOption);
      const addNewSeriesOption = document.createElement("label");
      addNewSeriesOption.className = "field faction-abafac-option";
      addNewSeriesOption.innerHTML = '<span>Abafac de catálogo</span><label><input name="newSeries" type="checkbox"> Séries novas</label><small class="faction-identity-help">Mostra as séries adicionadas mais recentemente à banca.</small>';
      form.prepend(addNewSeriesOption);
      const addMostReadOption = document.createElement("label");
      addMostReadOption.className = "field faction-abafac-option";
      addMostReadOption.innerHTML = '<span>Abafac de catálogo</span><label><input name="mostReadMonth" type="checkbox"> Mais lidos do mês</label><small class="faction-identity-help">Mostra as edições mais lidas no mês atual.</small>';
      form.prepend(addMostReadOption);
      const addBestSeriesOption = document.createElement("label");
      addBestSeriesOption.className = "field faction-abafac-option";
      addBestSeriesOption.innerHTML = '<span>Abafac de popularidade</span><label><input name="bestSeries" type="checkbox"> Melhores séries</label><small class="faction-identity-help">Mostra as séries com mais curtidas na banca.</small>';
      form.prepend(addBestSeriesOption);
      const addTipsOption = document.createElement("label");
      addTipsOption.className = "field faction-abafac-option";
      addTipsOption.innerHTML = '<span>Abafac personalizada</span><label><input name="tips" type="checkbox"> Dicas para você</label><small class="faction-identity-help">Sugere edições com base nos seus salvos e curtidos.</small>';
      form.prepend(addTipsOption);
      const addRandomOption = document.createElement("label");
      addRandomOption.className = "field faction-abafac-option";
      addRandomOption.innerHTML = '<span>Abafac de descoberta</span><label><input name="randomChoice" type="checkbox"> Escolha aleatória</label><small class="faction-identity-help">Sorteia edições para descobrir algo novo na banca.</small>';
      form.prepend(addRandomOption);
      const addArtistOption = document.createElement("label");
      addArtistOption.className = "field faction-abafac-option";
      addArtistOption.innerHTML = '<span>Abafac personalizada</span><label><input name="artist" type="checkbox"> Do mesmo artista de</label><small class="faction-identity-help">Sugere séries de artistas das suas leituras concluídas.</small>';
      form.prepend(addArtistOption);
      const addRecommendationsOption = document.createElement("label");
      addRecommendationsOption.className = "field faction-abafac-option";
      addRecommendationsOption.innerHTML = '<span>Curadoria global</span><label><input name="recommendations" type="checkbox"> Escolhas da banca</label><small class="faction-identity-help">Exibe as recomendações globais do dia, da semana e do mês.</small>';
      form.prepend(addRecommendationsOption);
      const addRandomPublisherOption = document.createElement("label");
      addRandomPublisherOption.className = "field faction-abafac-option";
      addRandomPublisherOption.innerHTML = '<span>Abafac de descoberta</span><label><input name="randomPublisher" type="checkbox"> Uma editora escolhida aleatoriamente</label><small class="faction-identity-help">Sorteia uma editora e mostra suas edições.</small>';
      form.prepend(addRandomPublisherOption);
      const addDownloadsOption = document.createElement("label");
      addDownloadsOption.className = "field faction-abafac-option";
      addDownloadsOption.innerHTML = '<span>Abafac de popularidade</span><label><input name="downloads" type="checkbox"> Mais baixados</label><small class="faction-identity-help">Mostra as edições com mais downloads.</small>';
      form.prepend(addDownloadsOption);
      const addPinnedImprintsOption = document.createElement("label");
      addPinnedImprintsOption.className = "field faction-abafac-option";
      addPinnedImprintsOption.innerHTML = '<span>Abafac de curadoria</span><label><input name="pinnedImprints" type="checkbox"> Selos fixados</label><small class="faction-identity-help">Mostra os selos destacados pelos líderes e curadores.</small>';
      form.prepend(addPinnedImprintsOption);
      const addPinnedCharactersOption = document.createElement("label");
      addPinnedCharactersOption.className = "field faction-abafac-option";
      addPinnedCharactersOption.innerHTML = '<span>Abafac de curadoria</span><label><input name="pinnedCharacters" type="checkbox"> Personagens em destaque</label><small class="faction-identity-help">Mostra os personagens destacados pelos lideres e curadores.</small>';
      form.prepend(addPinnedCharactersOption);
      const addPinnedCollectionsOption = document.createElement("label");
      addPinnedCollectionsOption.className = "field faction-abafac-option";
      addPinnedCollectionsOption.innerHTML = '<span>Abafac de curadoria</span><label><input name="pinnedCollections" type="checkbox"> Coleções de quadrinhos em destaque</label><small class="faction-identity-help">Mostra as coleções destacadas pelos lideres e curadores.</small>';
      form.prepend(addPinnedCollectionsOption);
      const addMostReadAllOption = document.createElement("label");
      addMostReadAllOption.className = "field faction-abafac-option";
      addMostReadAllOption.innerHTML = '<span>Abafac de popularidade</span><label><input name="mostRead" type="checkbox"> Mais lidos</label><small class="faction-identity-help">Mostra as edições mais lidas no catálogo.</small>';
      form.prepend(addMostReadAllOption);
      $$(".faction-abafac-option", form).forEach(option => {
        const cleanOption = document.createElement("div");
        cleanOption.className = "field faction-abafac-option";
        const choice = $("label", option);
        if (choice) cleanOption.appendChild(choice);
        option.replaceWith(cleanOption);
      });
      $$(".faction-abafac-option", form).forEach(option => option.remove());
      form.addEventListener("submit", event => {
        const continueReading = $('[name="continueReading"]', form)?.checked;
        const recentlyAdded = $('[name="recentlyAdded"]', form)?.checked;
        const featuredCharacter = $('[name="featuredCharacter"]', form)?.checked;
        const newSeries = $('[name="newSeries"]', form)?.checked;
        const mostReadMonth = $('[name="mostReadMonth"]', form)?.checked;
        const bestSeries = $('[name="bestSeries"]', form)?.checked;
        const tips = $('[name="tips"]', form)?.checked;
        const randomChoice = $('[name="randomChoice"]', form)?.checked;
        const artist = $('[name="artist"]', form)?.checked;
        const recommendations = $('[name="recommendations"]', form)?.checked;
        const randomPublisher = $('[name="randomPublisher"]', form)?.checked;
        const downloads = $('[name="downloads"]', form)?.checked;
        const mostRead = $('[name="mostRead"]', form)?.checked;
        const pinnedImprints = $('[name="pinnedImprints"]', form)?.checked;
        const pinnedCharacters = $('[name="pinnedCharacters"]', form)?.checked;
        const pinnedCollections = $('[name="pinnedCollections"]', form)?.checked;
        if (pinnedCollections) {
          event.preventDefault();
          event.stopImmediatePropagation();
          finish({ catalogUrl: "", imageUrl: "", imageLink: "", continueReading, recentlyAdded, featuredCharacter, newSeries, mostReadMonth, bestSeries, tips, randomChoice, artist, recommendations, randomPublisher, downloads, mostRead, pinnedImprints, pinnedCharacters, pinnedCollections });
          return;
        }
        if (pinnedCharacters) {
          event.preventDefault();
          event.stopImmediatePropagation();
          finish({ catalogUrl: "", imageUrl: "", imageLink: "", continueReading, recentlyAdded, featuredCharacter, newSeries, mostReadMonth, bestSeries, tips, randomChoice, artist, recommendations, randomPublisher, downloads, mostRead, pinnedImprints, pinnedCharacters });
          return;
        }
        if (!continueReading && !recentlyAdded && !featuredCharacter && !newSeries && !mostReadMonth && !bestSeries && !tips && !randomChoice && !artist && !recommendations && !randomPublisher && !downloads && !mostRead && !pinnedImprints && !pinnedCharacters) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        finish({ catalogUrl: "", imageUrl: "", imageLink: "", continueReading, recentlyAdded, featuredCharacter, newSeries, mostReadMonth, bestSeries, tips, randomChoice, artist, recommendations, randomPublisher, downloads, mostRead, pinnedImprints, pinnedCharacters });
      }, true);
      form.insertAdjacentHTML("afterbegin", '<button type="button" class="small-btn" data-create-faction-catalog>Criar catálogo da facção</button>');
      $("[data-create-faction-catalog]", form).onclick = () => finish({ createFactionCatalog: true });
      form.addEventListener("submit", event => { event.preventDefault(); const data = new FormData(form); const catalogUrl = String(data.get("catalogUrl") || "").trim(); const imageUrl = String(data.get("abafacImageUrl") || "").trim(); if (!catalogUrl && !imageUrl) return toast("Adicione um catálogo ou uma imagem por link."); finish({ catalogUrl, imageUrl, imageLink: String(data.get("abafacLink") || "").trim() }); });
      overlay.addEventListener("click", event => { if (event.target === overlay) finish(null); });
      $("[data-faction-modal-close]", overlay).onclick = () => finish(null);
      $("[data-faction-modal-cancel]", overlay).onclick = () => finish(null);
      $("#modal-root").appendChild(overlay);
      $("[name=catalogUrl]", form).focus();
    });
  }

  function openFactionCatalogEditor(factionId, existing = null) {
    return new Promise(resolve => {
      const overlay = document.createElement("div");
      overlay.className = "modal-backdrop faction-modal-backdrop";
      overlay.innerHTML = `<div class="modal faction-modal"><div class="section-head"><div><div class="eyebrow">Catálogo da facção</div><h2>${existing ? "Editar catálogo" : "Criar catálogo da facção"}</h2><div class="section-subtitle">Escolha edições de toda a biblioteca do site. O catálogo não depende dos favoritos.</div></div><button type="button" class="small-btn" data-faction-modal-close>Fechar</button></div><form class="faction-identity-form"><label class="field"><span>Nome do catálogo</span><input name="name" maxlength="60" required value="${escapeHTML(existing?.name || "")}"></label><label class="field"><span>Capa do catálogo (opcional)</span><input name="coverUrl" type="url" maxlength="2000" value="${escapeHTML(existing?.cover_url || "")}" placeholder="https://..."></label><div class="field"><span>Edições disponíveis na biblioteca</span><div class="faction-catalog-picker">${shelfComicPickerMarkup(state.db.library, existing?.item_ids || [])}</div></div><div class="modal-actions"><button type="button" class="small-btn" data-faction-modal-cancel>Cancelar</button><button type="submit" class="small-btn faction-modal-primary">Salvar catálogo</button></div></form></div>`;
      const finish = value => { overlay.remove(); resolve(value); };
      const form = $(".faction-identity-form", overlay);
      form.addEventListener("submit", event => { event.preventDefault(); const data = new FormData(form); finish({ factionId, catalogId: existing?.id || null, name: String(data.get("name") || "").trim(), coverUrl: String(data.get("coverUrl") || "").trim(), itemIds: data.getAll("itemIds").map(String) }); });
      overlay.addEventListener("click", event => { if (event.target === overlay) finish(null); });
      $("[data-faction-modal-close]", overlay).onclick = () => finish(null);
      $("[data-faction-modal-cancel]", overlay).onclick = () => finish(null);
      $("#modal-root").appendChild(overlay);
    });
  }

  function openFactionIdentityEditor(faction) {
    return new Promise(resolve => {
      const color = /^#[0-9A-Fa-f]{6}$/.test(faction?.color || "") ? faction.color : "#e85b68";
      const overlay = document.createElement("div");
      overlay.className = "modal-backdrop faction-modal-backdrop";
      overlay.innerHTML = `<div class="modal faction-modal faction-identity-modal" style="--faction-color:${escapeHTML(color)}"><div class="section-head"><div><div class="eyebrow">Identidade da facção</div><h2>Editar facção</h2><div class="section-subtitle">Atualize o nome, a cor e a descrição exibidos para a comunidade.</div></div><button type="button" class="small-btn" data-faction-modal-close>Fechar</button></div><form class="faction-identity-form"><label class="field"><span>Nome da facção</span><input name="name" type="text" minlength="3" maxlength="80" value="${escapeHTML(faction?.name || "")}" required></label><label class="field"><span>Cor da facção</span><div class="faction-color-field"><input name="color" type="color" value="${escapeHTML(color)}"><input name="colorText" type="text" value="${escapeHTML(color)}" pattern="^#[0-9A-Fa-f]{6}$" maxlength="7" required></div></label><label class="field"><span>Descrição</span><textarea name="description" maxlength="500" rows="4">${escapeHTML(faction?.description || "")}</textarea></label><div class="modal-actions"><button type="button" class="small-btn" data-faction-modal-cancel>Cancelar</button><button type="submit" class="small-btn faction-modal-primary">Salvar alterações</button></div></form></div>`;
      const finish = value => { overlay.remove(); resolve(value); };
      const form = $(".faction-identity-form", overlay);
      const colorInput = $("[name=color]", form);
      const colorText = $("[name=colorText]", form);
      colorInput.addEventListener("input", () => { colorText.value = colorInput.value; overlay.querySelector(".faction-modal").style.setProperty("--faction-color", colorInput.value); });
      colorText.addEventListener("input", () => { if (/^#[0-9A-Fa-f]{6}$/.test(colorText.value)) { colorInput.value = colorText.value; overlay.querySelector(".faction-modal").style.setProperty("--faction-color", colorText.value); } });
      form.addEventListener("submit", event => { event.preventDefault(); const data = new FormData(form); finish({ name: String(data.get("name") || "").trim(), color: String(data.get("colorText") || "").trim(), description: String(data.get("description") || "").trim() }); });
      overlay.addEventListener("click", event => { if (event.target === overlay) finish(null); });
      $("[data-faction-modal-close]", overlay).onclick = () => finish(null);
      $("[data-faction-modal-cancel]", overlay).onclick = () => finish(null);
      $("#modal-root").appendChild(overlay);
      $("[name=name]", form).focus();
    });
  }

  function openFactionManifestEditor(faction) {
    return new Promise(resolve => {
      const overlay = document.createElement("div");
      overlay.className = "modal-backdrop faction-modal-backdrop";
      overlay.innerHTML = `<div class="modal faction-modal faction-manifest-modal" style="--faction-color:${escapeHTML(faction?.color || "#e85b68")}"><div class="section-head"><div><div class="eyebrow">Manifesto da facção</div><h2>Editar informações</h2><div class="section-subtitle">Atualize o texto que apresenta os valores, o lema e a visão da sua facção.</div></div><button type="button" class="small-btn" data-faction-modal-close>Fechar</button></div><form class="faction-manifest-form"><label class="field"><span>Texto do manifesto</span><textarea name="manifest" maxlength="500" rows="8" placeholder="Escreva o lema, os valores e a visão da facção...">${escapeHTML(faction?.description || "")}</textarea><small class="faction-identity-help">Até 500 caracteres. Esse texto também aparece no cabeçalho e nos cartões públicos da facção.</small></label><div class="modal-actions"><button type="button" class="small-btn" data-faction-modal-cancel>Cancelar</button><button type="submit" class="small-btn faction-modal-primary">Salvar manifesto</button></div></form></div>`;
      const finish = value => { overlay.remove(); resolve(value); };
      const form = $(".faction-manifest-form", overlay);
      form.addEventListener("submit", event => { event.preventDefault(); finish(String(new FormData(form).get("manifest") || "").trim()); });
      overlay.addEventListener("click", event => { if (event.target === overlay) finish(null); });
      $("[data-faction-modal-close]", overlay).onclick = () => finish(null);
      $("[data-faction-modal-cancel]", overlay).onclick = () => finish(null);
      $("#modal-root").appendChild(overlay);
      $("[name=manifest]", form).focus();
    });
  }

  function openFactionMuralEditor(faction) {
    return new Promise(resolve => {
      const overlay = document.createElement("div");
      overlay.className = "modal-backdrop faction-modal-backdrop";
      overlay.innerHTML = `<div class="modal faction-modal faction-manifest-modal" style="--faction-color:${escapeHTML(faction?.color || "#e85b68")}"><div class="section-head"><div><div class="eyebrow">Mural de avisos</div><h2>Editar aviso</h2><div class="section-subtitle">Publique novidades, regras internas e decisões importantes da facção.</div></div><button type="button" class="small-btn" data-faction-modal-close>Fechar</button></div><form class="faction-manifest-form"><label class="field"><span>Texto do aviso</span><textarea name="notice" maxlength="1000" rows="8" placeholder="Escreva um aviso para os membros da facção...">${escapeHTML(faction?.mural_notice || "")}</textarea><small class="faction-identity-help">Até 1.000 caracteres. Deixe vazio para remover o aviso.</small></label><div class="modal-actions"><button type="button" class="small-btn" data-faction-modal-cancel>Cancelar</button><button type="submit" class="small-btn faction-modal-primary">Salvar aviso</button></div></form></div>`;
      const finish = value => { overlay.remove(); resolve(value); };
      const form = $(".faction-manifest-form", overlay);
      form.addEventListener("submit", event => { event.preventDefault(); finish(String(new FormData(form).get("notice") || "").trim()); });
      overlay.addEventListener("click", event => { if (event.target === overlay) finish(null); });
      $("[data-faction-modal-close]", overlay).onclick = () => finish(null);
      $("[data-faction-modal-cancel]", overlay).onclick = () => finish(null);
      $("#modal-root").appendChild(overlay);
      $("[name=notice]", form).focus();
    });
  }

  function openFactionChoice() {
    if (!state.session || !canChooseFaction() || state.factionChoiceOpen || !state.factions.length) return;
    state.factionChoiceOpen = true;
    const overlay = document.createElement("div");
    overlay.className = "modal-backdrop faction-choice-backdrop";
    overlay.innerHTML = `<div class="modal faction-choice-modal"><div class="section-head"><div><div class="eyebrow">Uma casa para sua jornada</div><h2>${state.profile.faction_id ? "Trocar de facção" : "Escolha sua facção"}</h2><div class="section-subtitle">${state.profile.faction_id ? "A troca pode ser feita uma vez a cada sete dias." : "Faça parte de uma comunidade, ajude sua facção e dispute a temporada."}</div></div><button class="small-btn" data-close>Fechar</button></div><div class="faction-choice-grid">${state.factions.map(faction => `<button class="faction-choice-card ${state.profile.faction_id === faction.id ? "is-current" : ""}" type="button" data-faction-choose="${escapeHTML(faction.id)}" style="--faction-color:${escapeHTML(faction.color)}"><span class="faction-choice-emblem">${escapeHTML(faction.emblem)}</span><strong>${escapeHTML(faction.name)}</strong><span>${escapeHTML(faction.description)}</span></button>`).join("")}</div>${state.profile.faction_id ? "" : '<button class="small-btn faction-auto-choice" type="button" data-faction-auto>Escolher a facção com menor presença</button>'}</div>`;
    $("#modal-root").appendChild(overlay);
    $("[data-close]", overlay).onclick = () => choose(null);
    const choose = async factionId => {
      const result = await sb.rpc("choose_faction", { p_faction_id: factionId || null });
      if (result.error) return toast(result.error.message || "Não foi possível escolher sua facção.");
      const selected = result.data?.[0];
      state.profile = { ...state.profile, faction_id: selected?.faction_id, faction_joined_at: selected?.changed_at || state.profile.faction_joined_at, faction_changed_at: selected?.changed_at || state.profile.faction_changed_at };
      if (selected?.faction_id) await sb.rpc("ensure_faction_leadership", { p_faction_id: selected.faction_id });
      // Recarrega cargos e membros antes de renderizar a página da facção.
      // Sem isso, a tela continuava usando a lista anterior ao ingresso.
      await loadFactions();
      state.factionChoiceOpen = false;
      overlay.remove();
      render();
      toast(`Você agora faz parte de ${selected?.name || "uma nova facção"}.`);
    };
    $$('[data-faction-choose]', overlay).forEach(button => button.onclick = () => choose(button.dataset.factionChoose));
    $('[data-faction-auto]', overlay).onclick = () => choose(null);
  }

  let sharedCatalogRefresh = null;

  return {
    openFactionIdentityEditorV2,
    openFactionAbafacAddEditor,
    openFactionCatalogEditor,
    openFactionIdentityEditor,
    openFactionManifestEditor,
    openFactionMuralEditor,
    openFactionChoice
  };
}
