  function openShelfCategoryForm(categoryId = null) {
    const existing = state.shelfCategories.find(category => category.id === categoryId);
    const savedItems = shelfItemsByIds([...ensureShelfSnapshot().saved]);
    const overlay = document.createElement("div");
    overlay.className = "modal-backdrop";
    overlay.innerHTML = `<div class="modal"><div class="section-head"><div><h2>${existing ? "Editar coleção" : "Nova coleção"}</h2><div class="section-subtitle">Organize seus itens salvos e escolha se a coleção será compartilhável</div></div><button class="small-btn" data-close>Fechar</button></div><form id="shelf-category-form"><div class="form-grid"><div class="field full"><label>Nome da coleção</label><input name="name" required maxlength="60" value="${escapeHTML(existing?.name || "")}" placeholder="Ex.: Favoritos, Para reler"></div><div class="field full"><label>Imagem da coleção (opcional)</label><input name="coverUrl" type="url" value="${escapeHTML(existing?.coverUrl || "")}" placeholder="https://.../imagem.jpg"><small class="format-hint">Apenas para coleções públicas.</small></div><div class="field full"><label><input name="isPublic" type="checkbox" ${existing?.isPublic !== false ? "checked" : ""}> Coleção pública — aparecerá no perfil e poderá ser compartilhada</label></div><div class="field full"><label>Quadrinhos nesta coleção</label><div class="collection-picker">${savedItems.map(item => `<label><input type="checkbox" name="itemIds" value="${escapeHTML(item.id)}" ${existing?.itemIds?.includes(item.id) ? "checked" : ""}> ${escapeHTML(item.seriesTitle || item.title)}${item.issue ? ` — ${escapeHTML(item.issue)}` : ""}</label>`).join("") || "Salve algum quadrinho primeiro."}</div></div></div><div class="modal-actions"><button type="button" class="small-btn" data-close>Cancelar</button><button class="btn btn-danger">Salvar coleção</button></div></form></div>`;
    $("#modal-root").appendChild(overlay);
    const comicPicker = $(".collection-picker", overlay);
    if (comicPicker) {
      comicPicker.outerHTML = shelfComicPickerMarkup(savedItems, existing?.itemIds || []);
      const search = $("[data-collection-picker-search]", overlay);
      const tree = $("[data-collection-picker-tree]", overlay);
      const count = $("[data-collection-picker-count]", overlay);
      const normalizeSearch = value => String(value || "").trim().toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const filterPicker = () => {
        const query = normalizeSearch(search?.value);
        let visibleCount = 0;
        $$('[data-picker-item]', tree).forEach(item => {
          const visible = !query || normalizeSearch(item.dataset.pickerText).includes(query);
          item.hidden = !visible;
          if (visible) visibleCount += 1;
        });
        $$('[data-picker-group]', tree).reverse().forEach(group => {
          const hasVisible = Boolean($('[data-picker-item]:not([hidden])', group));
          group.hidden = !hasVisible;
          if (query && hasVisible) group.open = true;
        });
        if (count) count.textContent = `${visibleCount} quadrinho(s)`;
      };
      search?.addEventListener("input", filterPicker);
      filterPicker();
    }
    $$('[data-close]', overlay).forEach(button => button.onclick = () => overlay.remove());
    overlay.addEventListener("click", event => { if (event.target === overlay) overlay.remove(); });
    $("#shelf-category-form", overlay).onsubmit = async event => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const category = { id: existing?.id || `shelf-${Date.now()}`, name: String(form.get("name") || "").trim(), coverUrl: String(form.get("coverUrl") || "").trim(), isPublic: form.get("isPublic") === "on", itemIds: form.getAll("itemIds"), sortOrder: existing?.sortOrder || state.collectionSortOrders?.[`category:${existing?.id}`] || "added_desc" };
      if (!category.name) return;
      const categories = existing ? state.shelfCategories.map(item => item.id === category.id ? category : item) : [...state.shelfCategories, category];
      state.shelfCategories = categories;
      overlay.remove();
      await saveShelfCategories(categories);
    };
  }

