export function createAdminFeature(deps) {
  const {
    $,
    $$,
    cancelCoverLoads,
    card,
    catalogAddedTimestamp,
    coverFor,
    currentNoveltyBadgeHours,
    detectFormat,
    escapeHTML,
    formatType,
    hydrateHomeCovers,
    isAdminProfile,
    isTelegramPostUrl,
    itemDisplayTitle,
    loadCoverCatalog,
    normalizedPlan,
    openAccountPlanAdmin,
    openAchievementAdmin,
    render,
    save,
    saveCatalog,
    sb,
    seriesCard,
    seriesKey,
    state,
    toast,
    uniqueCatalogItems,
    visibleCatalogItems
  } = deps;

  function openCoverVariantsAdmin(itemId = null) {
    if (!["moderator", "banca", "admin"].includes(normalizedPlan(state.profile))) return toast("Você não tem permissão para cadastrar capas variantes.");
    if (!sb) return toast("Conecte-se para cadastrar capas variantes.");
    const items = state.db.library.filter(item => itemId ? item.id === itemId : item.type === "comic").sort((a, b) => itemDisplayTitle(a).localeCompare(itemDisplayTitle(b), "pt-BR"));
    const overlay = document.createElement("div");
    overlay.className = "modal-backdrop";
    overlay.innerHTML = `<div class="modal cover-variants-admin-modal"><div class="section-head"><div><h2>Capas variantes oficiais</h2><div class="section-subtitle">Cadastre capas hospedadas oficialmente pela DC para usuários Premium.</div></div><button class="small-btn" data-close>Fechar</button></div><form id="cover-variant-admin-form"><div class="field full"><label>Edição</label><select name="itemId" required>${items.map(item => `<option value="${escapeHTML(item.id)}">${escapeHTML(itemDisplayTitle(item))}${item.issue ? ` — ${escapeHTML(item.issue)}` : ""}</option>`).join("")}</select></div><div class="form-grid"><div class="field"><label>Chave da variante</label><input name="variantKey" required pattern="[A-Za-z0-9_-]{1,80}" placeholder="ex.: variant-a"></div><div class="field"><label>Nome da variante</label><input name="label" required maxlength="80" placeholder="Capa variante A"></div></div><div class="field full"><label>URL oficial da capa</label><input name="coverUrl" type="url" required pattern="https://static\\.dc\\.com/.*" placeholder="https://static.dc.com/2025-01/...jpg"><small class="format-hint">A URL precisa começar com https://static.dc.com/.</small></div><div class="field full"><label>URL da página fonte (opcional)</label><input name="sourceUrl" type="url" placeholder="https://www.dc.com/comics/..."></div><div class="modal-actions"><button type="button" class="small-btn" data-close>Cancelar</button><button class="btn btn-danger">Salvar variante</button></div></form><div class="section-subtitle cover-variants-admin-list"></div></div>`;
    overlay.innerHTML = overlay.innerHTML.replace(/\bFree\b/g, "Comum").replace(/\bPremium\b/g, "Lenda");
    $("#modal-root").appendChild(overlay);
    $$('[data-close]', overlay).forEach(button => button.onclick = () => overlay.remove());
    const itemSelect = $("select[name=itemId]", overlay);
    if (itemId) {
      itemSelect.value = itemId;
      itemSelect.disabled = true;
    }
    const list = $(".cover-variants-admin-list", overlay);
    const refreshList = () => {
      const variants = state.coverVariants.get(itemSelect.value) || [];
      list.innerHTML = variants.length ? `<div class="section-subtitle">Variantes cadastradas</div>${variants.map(variant => `<div class="admin-cover-variant-row"><span><b>${escapeHTML(variant.label)}</b><small>${escapeHTML(variant.cover_url)}</small></span><button type="button" class="small-btn danger" data-delete-cover-variant="${escapeHTML(variant.item_id)}" data-delete-variant-key="${escapeHTML(variant.variant_key)}">Excluir</button></div>`).join("")}` : "Nenhuma variante cadastrada para esta edição.";
      $$('[data-delete-cover-variant]', overlay).forEach(button => button.onclick = async () => {
        const result = await sb.from("comic_cover_variants").delete().eq("item_id", button.dataset.deleteCoverVariant).eq("variant_key", button.dataset.deleteVariantKey);
        if (result.error) return toast(result.error.message);
        await loadCoverCatalog();
        refreshList();
        render();
      });
    };
    itemSelect.addEventListener("change", refreshList);
    refreshList();
    $("#cover-variant-admin-form", overlay).onsubmit = async event => {
      event.preventDefault();
      const formElement = event.currentTarget;
      const form = new FormData(formElement);
      const coverUrl = String(form.get("coverUrl") || "").trim();
      if (!/^https:\/\/static\.dc\.com\//i.test(coverUrl)) return toast("A capa precisa usar uma URL oficial da DC.");
      const payload = { item_id: itemId || String(form.get("itemId")), variant_key: String(form.get("variantKey") || "").trim(), label: String(form.get("label") || "").trim(), cover_url: coverUrl, source_url: String(form.get("sourceUrl") || "").trim() || null, created_at: new Date().toISOString() };
      const result = await sb.from("comic_cover_variants").upsert(payload, { onConflict: "item_id,variant_key" });
      if (result.error) return toast(result.error.message);
      await loadCoverCatalog();
      formElement.reset();
      itemSelect.value = payload.item_id;
      refreshList();
      render();
      toast("Capa variante cadastrada.");
    };
  }

  function openAdminLegacy(editId = null) {
    const existing = editId ? state.db.library.find(x => x.id === editId) : null;
    const overlay = document.createElement("div");
    overlay.className = "modal-backdrop";
    overlay.innerHTML = `
      <div class="modal">
        <div class="section-head">
          <div><h2>Administração</h2><div class="section-subtitle">Catálogo e metadados</div></div>
          <button class="small-btn" data-close>Fechar</button>
        </div>

        <div class="notice">
          <b>Use URLs diretas para os arquivos.</b> Cadastre o link direto para o PDF, CBZ ou outro arquivo no campo "Link da fonte". O site não precisa guardar uma cópia do quadrinho. A funcionalidade de ler arquivos do Telegram foi removida.
        </div>

        <div class="admin-actions" style="margin-bottom:15px">
          <button class="btn btn-danger" data-new>+ Nova edição</button>
          <button class="small-btn" data-cover-variants>Capas variantes</button>
          <button class="small-btn" data-export>Exportar catálogo</button>
          <button class="small-btn" data-import>Importar catálogo</button>
        </div>

        <table class="admin-table">
          <thead><tr><th>Edição</th><th>Tipo</th><th>Leituras</th><th>Ações</th></tr></thead>
          <tbody>
            ${state.db.library.map(x => `
              <tr>
                <td><b>${escapeHTML(x.title)}</b><br><span style="color:#777">${escapeHTML(x.issue||"")}</span></td>
                <td>${formatType(x.type)}</td>
                <td>${Number(x.clicks||0).toLocaleString("pt-BR")}</td>
                <td><div class="admin-actions">
                  <button class="small-btn" data-edit="${escapeHTML(x.id)}">Editar</button>
                  <button class="small-btn danger" data-delete="${escapeHTML(x.id)}">Excluir</button>
                </div></td>
              </tr>`).join("")}
          </tbody>
        </table>
      </div>`;
    $("#modal-root").appendChild(overlay);

    $("[data-close]", overlay).onclick = () => overlay.remove();
    $("[data-cover-variants]", overlay).onclick = () => { overlay.remove(); openCoverVariantsAdmin(); };
    $("[data-new]", overlay).onclick = () => { overlay.remove(); openEditForm(); };
    $("[data-export]", overlay).onclick = exportDB;
    $("[data-import]", overlay).onclick = importDB;
    $$("[data-edit]", overlay).forEach(b => b.onclick = () => { overlay.remove(); openEditForm(b.dataset.edit); });
    $$("[data-delete]", overlay).forEach(button => button.onclick = () => deleteCatalogEdition(button, overlay));
  }

  function openEditFormLegacy(id = null) {
    const x = id ? state.db.library.find(i => i.id === id) : {
      id: "item-" + Date.now(), addedAt: new Date().toISOString(), title:"", issue:"", type:"comic", author:"", year:new Date().getFullYear(),
      description:"", cover:"", fileUrl:"", telegramUrl:"", format:"pdf", clicks:0, featured:false, randomWeight:5, tags:[], collectionIds:[]
    };

    const overlay = document.createElement("div");
    overlay.className = "modal-backdrop";
    overlay.innerHTML = `
      <div class="modal">
        <h2>${id ? "Editar edição" : "Nova edição"}</h2>
        <form id="edit-form">
          <div class="form-grid">
            <div class="field"><label>Título</label><input name="title" required value="${escapeHTML(x.title)}"></div>
            <div class="field"><label>Edição / capítulo</label><input name="issue" value="${escapeHTML(x.issue||"")}"></div>
            <div class="field"><label>Tipo</label><select name="type">
              <option value="comic" ${x.type==="comic"?"selected":""}>Quadrinho</option>
              <option value="manga" ${x.type==="manga"?"selected":""}>Mangá</option>
            </select></div>
            <div class="field"><label>Ano</label><input name="year" type="number" value="${escapeHTML(x.year||"")}"></div>
            <div class="field"><label>Autor</label><input name="author" value="${escapeHTML(x.author||"")}"></div>
            <div class="field"><label>Formato</label><select name="format">
              ${["pdf","cbz","cbr","jpg","jpeg","png","webp","gif"].map(f=>`<option ${x.format===f?"selected":""}>${f}</option>`).join("")}
            </select></div>
            <div class="field full"><label>Link da fonte</label><input name="sourceUrl" required placeholder="https://t.me/seucanal/123 ou URL direta" value="${escapeHTML(x.telegramUrl || x.fileUrl || "")}"></div>
            <div class="field full"><label>Capa</label><div style="color:#aaa;font-size:12px">Automática: será usada a primeira página/imagem do arquivo. Não é necessário enviar uma capa separada.</div></div>
            <div class="field full"><label>Descrição</label><textarea name="description">${escapeHTML(x.description||"")}</textarea></div>
            <div class="field"><label>Tags separadas por vírgula</label><input name="tags" value="${escapeHTML((x.tags||[]).join(", "))}"></div>
            <div class="field"><label>Peso do aleatório</label><input name="randomWeight" type="number" min="1" value="${escapeHTML(x.randomWeight||5)}"></div>
            <div class="field full">
              <label><input name="featured" type="checkbox" ${x.featured?"checked":""}> Mostrar como destaque</label>
            </div>
          </div>
          <div class="modal-actions">
            <button type="button" class="small-btn" data-close>Cancelar</button>
            <button class="btn btn-danger">Salvar</button>
          </div>
        </form>
      </div>`;
    $("#modal-root").appendChild(overlay);
    $("[data-close]", overlay).onclick = () => overlay.remove();
    $("#edit-form", overlay).onsubmit = e => {
      e.preventDefault();
      const fd = new FormData(e.currentTarget);
      const data = Object.fromEntries(fd.entries());

      const sourceUrl = (data.sourceUrl || "").trim();
      let telegramUrl = "";
      let fileUrl = "";
      if (/^https?:\/\/(www\.)?t(elegram)?\.me\//.test(sourceUrl)) {
        telegramUrl = sourceUrl;
      } else {
        fileUrl = sourceUrl;
      }

      const item = {
        ...x,
        title:data.title.trim(), issue:data.issue.trim(), type:data.type, year:Number(data.year)||new Date().getFullYear(),
        author:data.author.trim(), format:data.format, fileUrl, telegramUrl,
        coverUrl:x.coverUrl || "", description:data.description.trim(), tags:data.tags.split(",").map(s=>s.trim()).filter(Boolean),
        randomWeight:Math.max(1, Number(data.randomWeight)||1), featured:fd.get("featured")==="on"
      };
      const idx = state.db.library.findIndex(i => i.id === item.id);
      if (idx >= 0) state.db.library[idx] = item; else state.db.library.push(item);
      save(); overlay.remove(); render(); toast("Edição salva.");
    };
  }

  function renderCatalogLegacyAdmin(type = null) {
     const items = visibleCatalogItems(type ? state.db.library.filter(x => x.type === type) : state.db.library);
     const series = uniqueCatalogItems(items.filter(x => x.seriesId));
     const oneshots = uniqueCatalogItems(items.filter(x => !x.seriesId));
    const heading = type === "manga" ? "Mangás" : type === "comic" ? "Quadrinhos" : "Catálogo";
    const group = (title, groupItems, isSeries = false) => groupItems.length ? `<section class="section"><div class="section-head"><div><h2 class="section-title">${title}</h2><div class="section-subtitle">${groupItems.length} obra(s)</div></div></div><div class="results-grid${type === "comic" && isSeries ? " catalog-series-grid" : ""}">${groupItems.map(item => isSeries ? seriesCard(item) : card(item)).join("")}</div></section>` : "";
    const publishers = new Map();
    items.filter(item => String(item.publisher || "").trim()).forEach(item => {
      const publisher = String(item.publisher).trim();
      if (!publishers.has(publisher)) publishers.set(publisher, []);
      publishers.get(publisher).push(item);
    });
    const publisherCarousel = type === "comic" && publishers.size ? `<section class="section publisher-carousel-section"><div class="section-head"><div><h2 class="section-title">Editoras</h2><div class="section-subtitle">Explore os quadrinhos por editora</div></div></div><div class="publisher-carousel">${[...publishers.entries()].sort((a, b) => a[0].localeCompare(b[0], "pt-BR")).map(([publisher, publisherItems]) => { const representative = publisherItems.find(item => item.featuredCoverUrl || item.coverUrl || item.cover) || publisherItems[0]; return `<button class="publisher-card" type="button" data-publisher="${escapeHTML(publisher)}"><div class="publisher-card-cover" style="background-image:url('${escapeHTML(coverFor(representative))}')"></div><div class="publisher-card-overlay"></div><div class="publisher-card-info"><strong>${escapeHTML(publisher)}</strong><span>${publisherItems.length} quadrinho(s)</span></div></button>`; }).join("")}</div></section>` : "";
    const catalogHeader = type === "comic" ? "" : `<div class="section-head"><div><h1 class="section-title">${heading}</h1><div class="section-subtitle">${items.length} edição(ões)</div></div></div>`;
    return `<div class="content">${catalogHeader}${group("Séries", series, true)}${group("Oneshots", oneshots)}${!items.length ? `<div class="empty">Nenhuma edição cadastrada.</div>` : ""}${publisherCarousel}</div>`;
  }

  function openSubmission() {
    if (!isAdminProfile()) return toast("Apenas administradores podem adicionar edições.");
    openEditForm();
  }

  function exportDB() {
    const blob = new Blob([JSON.stringify(state.db, null, 2)], {type:"application/json"});
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "banca-digital-catalogo.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  function importDB() {
    const input = document.createElement("input");
    input.type = "file"; input.accept = ".json,application/json";
    input.onchange = async () => {
      try {
        const text = await input.files[0].text();
        const db = JSON.parse(text);
        if (!Array.isArray(db.library) || !Array.isArray(db.collections)) throw new Error("Formato inválido");
        state.db = db; save(); render(); toast("Catálogo importado.");
      } catch (e) { alert("Não foi possível importar: " + e.message); }
    };
    input.click();
  }

  // Inicialização
  function openCollectionForm() {
    const overlay = document.createElement("div");
    overlay.className = "modal-backdrop";
    overlay.innerHTML = `
      <div class="modal">
        <div class="section-head"><div><h2>Nova coleção</h2><div class="section-subtitle">Agrupe edições por tema, personagem ou universo</div></div><button class="small-btn" data-close>Fechar</button></div>
        <form id="collection-form">
          <div class="form-grid">
            <div class="field"><label>Nome da coleção</label><input name="title" required></div>
            <div class="field"><label>Capa da coleção (URL)</label><input name="cover" placeholder="https://.../imagem.jpg"></div>
            <div class="field full"><label>Descrição</label><textarea name="description"></textarea></div>
            <div class="field full"><label>Edições da coleção</label><div class="collection-picker">
              ${state.db.library.map(x => `<label><input type="checkbox" name="issueIds" value="${escapeHTML(x.id)}"> ${escapeHTML(x.seriesTitle || x.title)} — ${escapeHTML(x.issue || "Oneshot")}</label>`).join("") || "Nenhuma edição cadastrada."}
            </div></div>
          </div>
          <div class="modal-actions"><button type="button" class="small-btn" data-close>Cancelar</button><button class="btn btn-danger">Criar coleção</button></div>
        </form>
      </div>`;
    $("#modal-root").appendChild(overlay);
    $$('[data-close]', overlay).forEach(button => button.onclick = () => overlay.remove());
    $("#collection-form", overlay).onsubmit = event => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      state.db.collections.push({
        id: "collection-" + Date.now(),
        title: String(form.get("title") || "").trim(),
        description: String(form.get("description") || "").trim(),
        cover: String(form.get("cover") || "").trim(),
        issueIds: form.getAll("issueIds")
      });
      saveCatalog("Coleção criada."); overlay.remove(); render();
    };
  }

  // Nova versão do painel: mantém os dados antigos, mas cadastra séries e metadados novos.
  function openAdminNotificationForm() {
    if (!sb || state.profile?.plan !== "admin") return toast("Apenas administradores podem enviar notificações.");
    const overlay = document.createElement("div");
    overlay.className = "modal-backdrop";
    overlay.innerHTML = '<div class="modal"><div class="section-head"><div><h2>Enviar notificação geral</h2><div class="section-subtitle">A mensagem será enviada para todos os usuários.</div></div><button class="small-btn" data-close>Fechar</button></div><form id="admin-notification-form"><div class="field"><label>Título</label><input name="title" maxlength="120" required placeholder="Ex.: Novidade na banca"></div><div class="field"><label>Mensagem</label><textarea name="body" maxlength="500" required placeholder="Escreva o aviso..."></textarea></div><div class="field"><label>Tipo</label><select name="type"><option value="announcement">Aviso</option><option value="event">Evento</option><option value="maintenance">Manutenção</option></select></div><div class="modal-actions"><button type="button" class="small-btn" data-close>Cancelar</button><button type="submit" class="btn btn-danger">Enviar para todos</button></div></form></div>';
    $("#modal-root").appendChild(overlay);
    $$('[data-close]', overlay).forEach(button => button.onclick = () => overlay.remove());
    $("#admin-notification-form", overlay).onsubmit = async event => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const result = await sb.rpc("send_notification_to_all", { p_title: String(form.get("title") || "").trim(), p_body: String(form.get("body") || "").trim(), p_type: String(form.get("type") || "announcement") });
      if (result.error) return toast(result.error.message || "Não foi possível enviar a notificação.");
      overlay.remove();
      toast("Notificação enviada para " + (result.data || 0) + " usuário(s).");
    };
  }

  function bindAdminLinkChecker(overlay) {
    if (!isAdminProfile()) return;
    const section = document.createElement("section");
    section.className = "admin-link-checker";
    section.setAttribute("aria-label", "Verificador de links");
    section.innerHTML = `<h3>Verificador de links</h3><label><input type="checkbox" role="switch" data-link-checker-toggle disabled> Ativado</label><p data-link-checker-status role="status" aria-live="polite">Carregando configuração…</p><button type="button" class="small-btn" data-link-checker-retry hidden>Tentar novamente</button>`;
    $(".admin-actions", overlay)?.after(section);
    const toggle = $("[data-link-checker-toggle]", section);
    const status = $("[data-link-checker-status]", section);
    const retry = $("[data-link-checker-retry]", section);
    let busy = false;
    const refresh = async (next = null) => {
      if (busy || !isAdminProfile()) return;
      busy = true;
      toggle.disabled = true;
      retry.hidden = true;
      status.textContent = next === null ? "Carregando configuração…" : "Salvando configuração…";
      try {
        if (!sb || state.session?.offline || navigator.onLine === false) throw new Error("Conecte-se à internet para gerenciar esta opção.");
        const query = sb.from("link_checker_settings");
        const result = next === null
          ? await query.select("enabled").eq("id", true).single()
          : await query.update({ enabled: next }).eq("id", true).select("enabled").single();
        if (result.error) throw result.error;
        if (typeof result.data?.enabled !== "boolean") throw new Error("Não foi possível confirmar a configuração.");
        toggle.checked = result.data.enabled;
        toggle.disabled = false;
        status.textContent = toggle.checked ? "Ativado" : "Desativado";
      } catch (error) {
        status.textContent = error.message || "Não foi possível confirmar a configuração.";
        retry.hidden = false;
      } finally {
        busy = false;
      }
    };
    toggle.onchange = () => refresh(toggle.checked);
    retry.onclick = () => refresh();
    refresh();
  }

  function bindAdminAccountRetention(overlay) {
    if (!isAdminProfile()) return;
    const section = document.createElement("section");
    section.className = "notice admin-account-retention";
    section.setAttribute("aria-label", "Exclusão automática de contas inativas");
    section.innerHTML = `<h3>Contas comuns inativas</h3><p>Exclusão automática após 30 dias de inatividade, diariamente às 03h de Brasília. Administradores, moderadores, banca e Lendas são preservados.</p><label class="field"><span>Contas a excluir</span><select data-retention-email-scope disabled><option value="all">Todas as contas comuns</option><option value="with_email">Somente com e-mail</option><option value="without_email">Somente sem e-mail</option></select></label><p data-retention-status role="status" aria-live="polite">Carregando configuração…</p><button type="button" class="small-btn" data-retention-toggle disabled>Carregando…</button>`;
    $(".admin-actions", overlay)?.after(section);
    const status = $("[data-retention-status]", section);
    const button = $("[data-retention-toggle]", section);
    const scopeSelect = $("[data-retention-email-scope]", section);
    let enabled = null;
    let emailScope = null;
    let busy = false;
    const refresh = async (next = null, nextScope = null) => {
      if (busy || !isAdminProfile()) return;
      busy = true;
      button.disabled = true;
      scopeSelect.disabled = true;
      const reading = next === null && nextScope === null;
      status.textContent = reading ? "Carregando configuração…" : "Salvando configuração…";
      try {
        if (!sb || state.session?.offline || navigator.onLine === false) throw new Error("Conecte-se à internet para gerenciar esta opção.");
        const result = reading
          ? await sb.rpc("get_inactive_account_cleanup_settings")
          : await sb.rpc("set_inactive_account_cleanup_settings", { p_enabled: next ?? enabled, p_email_scope: nextScope ?? emailScope });
        if (result.error) throw result.error;
        if (typeof result.data?.enabled !== "boolean" || !["all", "with_email", "without_email"].includes(result.data.email_scope)) throw new Error("Não foi possível confirmar a configuração.");
        enabled = result.data.enabled;
        emailScope = result.data.email_scope;
        scopeSelect.value = emailScope;
        scopeSelect.disabled = false;
        status.textContent = enabled ? "Ativada: a limpeza será executada diariamente." : "Desativada: novas execuções automáticas estão pausadas.";
        button.textContent = enabled ? "Desativar exclusão automática" : "Ativar exclusão automática";
      } catch (error) {
        enabled = null;
        scopeSelect.value = emailScope || "all";
        status.textContent = error.message || "Não foi possível confirmar a configuração. Tente novamente.";
        button.textContent = "Tentar novamente";
      } finally {
        busy = false;
        button.disabled = false;
      }
    };
    button.onclick = () => refresh(typeof enabled === "boolean" ? !enabled : null);
    scopeSelect.onchange = () => refresh(null, scopeSelect.value);
    refresh();
  }

  function bindAdminNoveltyBadge(overlay) {
    if (!isAdminProfile()) return;
    const section = document.createElement("section");
    section.className = "admin-novelty-badge";
    section.setAttribute("aria-label", "Etiqueta NOVIDADE");
    section.innerHTML = `<h3>Etiqueta NOVIDADE</h3><label class="field"><span>Duração em horas</span><input type="number" min="0" step="0.25" data-novelty-badge-hours value="${escapeHTML(String(currentNoveltyBadgeHours()))}"><small class="format-hint">Padrão: 36 horas. Use 0 para desativar. Valores decimais também são aceitos.</small></label><p data-novelty-badge-status role="status" aria-live="polite"></p><button type="button" class="small-btn" data-novelty-badge-save>Salvar duração</button>`;
    $(".admin-actions", overlay)?.after(section);
    const input = $("[data-novelty-badge-hours]", section);
    const status = $("[data-novelty-badge-status]", section);
    const button = $("[data-novelty-badge-save]", section);
    const refreshStatus = () => {
      const hours = currentNoveltyBadgeHours();
      status.textContent = hours === 0
        ? "A etiqueta NOVIDADE está desativada."
        : `A etiqueta aparece durante ${hours.toLocaleString("pt-BR")} hora(s) após a inclusão.`;
    };
    refreshStatus();
    button.onclick = async () => {
      const hours = Number(String(input.value || "").replace(",", "."));
      if (!Number.isFinite(hours) || hours < 0) {
        status.textContent = "Informe zero ou um número positivo de horas.";
        return;
      }
      button.disabled = true;
      button.textContent = "Salvando…";
      status.textContent = "Salvando configuração…";
      try {
        if (!sb || state.session?.offline || navigator.onLine === false) throw new Error("Conecte-se à internet para alterar esta opção.");
        const result = await sb.rpc("set_novelty_badge_hours", { p_hours: hours });
        if (result.error) throw result.error;
        const saved = Number(result.data);
        state.noveltyBadgeHours = Number.isFinite(saved) && saved >= 0 ? saved : hours;
        input.value = String(state.noveltyBadgeHours);
        refreshStatus();
        render();
        toast("Duração da etiqueta NOVIDADE salva.");
      } catch (error) {
        status.textContent = error.message || "Não foi possível salvar a duração da etiqueta.";
      } finally {
        button.disabled = false;
        button.textContent = "Salvar duração";
      }
    };
  }

  function openAdmin(editId = null) {
    cancelCoverLoads();
    const overlay = document.createElement("div");
    overlay.className = "modal-backdrop";
    overlay.innerHTML = `
      <div class="modal admin-modal">
        <div class="section-head"><div><h2>Administração</h2><div class="section-subtitle">Catálogo de obras, edições e coleções</div></div><button class="small-btn" data-close>Fechar</button></div>
        <div class="notice"><b>Oneshots e séries</b><br>Deixe o campo Série vazio para abrir uma edição diretamente. Use o mesmo nome de série em várias edições para criar a seleção de volumes.</div>
        <div class="admin-actions" style="margin-bottom:15px">
          <button class="btn btn-danger" data-new>+ Nova edição</button><button class="small-btn" data-new-collection>+ Criar coleção</button><button class="small-btn" data-achievements>Títulos</button><button class="small-btn" data-account-plan>Tipo de conta</button>
          <button class="small-btn" data-export>Exportar</button><button class="small-btn" data-import>Importar</button>
        </div>
        <table class="admin-table"><thead><tr><th>Série / edição</th><th>Editora</th><th>Selo</th><th>Personagem</th><th>Ano</th><th>Ações</th></tr></thead><tbody>
          ${state.db.library.map(x => `<tr><td><b>${escapeHTML(x.seriesTitle || x.title)}</b><br><span style="color:#777">${escapeHTML(x.issue || (x.seriesId ? "Edição" : "Oneshot"))}</span></td><td>${escapeHTML(x.publisher || "—")}</td><td>${escapeHTML(x.imprint || "—")}</td><td>${escapeHTML(x.character || "—")}</td><td>${escapeHTML(String(x.year || "—"))}</td><td><div class="admin-actions"><button class="small-btn" data-edit="${escapeHTML(x.id)}">Editar</button><button class="small-btn danger" data-delete="${escapeHTML(x.id)}">Excluir</button></div></td></tr>`).join("")}
        </tbody></table>
        <h3 style="margin-top:28px">Coleções</h3>
        <div class="admin-collection-list">${state.db.collections.map(c => `<div><b>${escapeHTML(c.title)}</b><span>${c.issueIds.length} edições</span><button class="small-btn danger" data-delete-collection="${escapeHTML(c.id)}">Excluir</button></div>`).join("") || "Nenhuma coleção criada."}</div>
      </div>`;
    $("#modal-root").appendChild(overlay);
    bindAdminNoveltyBadge(overlay);
    bindAdminAccountRetention(overlay);
    bindAdminLinkChecker(overlay);
    const filterBar = document.createElement("div");
    filterBar.className = "admin-catalog-filters";
    filterBar.style.cssText = "display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:0 0 15px";
    filterBar.innerHTML = '<label class="field"><span>Editora</span><select data-admin-publisher><option value="">Todas as editoras</option></select></label><label class="field"><span>Selo</span><select data-admin-imprint><option value="">Todos os selos</option></select></label><label class="field"><span>Personagem</span><select data-admin-character><option value="">Todos os personagens</option></select></label><label class="field"><span>Série</span><select data-admin-series><option value="">Todas as séries</option></select></label>';
    const adminTable = $(".admin-table", overlay);
    adminTable?.before(filterBar);
    const publisherFilter = $("[data-admin-publisher]", filterBar);
    const imprintFilter = $("[data-admin-imprint]", filterBar);
    const characterFilter = $("[data-admin-character]", filterBar);
    const seriesFilter = $("[data-admin-series]", filterBar);
    const catalogRows = $$('tbody tr', adminTable);
    const distinctValues = items => [...new Set(items.map(item => String(item || "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR"));
    const setFilterOptions = (select, emptyLabel, values, currentValue = "") => {
      select.innerHTML = `<option value="">${emptyLabel}</option>${values.map(value => `<option value="${escapeHTML(value)}">${escapeHTML(value)}</option>`).join("")}`;
      select.value = values.includes(currentValue) ? currentValue : "";
    };
    const refreshCatalogFilters = () => {
      const publisher = publisherFilter.value;
      const publisherItems = state.db.library.filter(item => !publisher || String(item.publisher || "").trim() === publisher);
      setFilterOptions(imprintFilter, "Todos os selos", distinctValues(publisherItems.map(item => item.imprint)), imprintFilter.value);
      const imprint = imprintFilter.value;
      const imprintItems = publisherItems.filter(item => !imprint || String(item.imprint || "").trim() === imprint);
      setFilterOptions(characterFilter, "Todos os personagens", distinctValues(imprintItems.map(item => item.character)), characterFilter.value);
      const character = characterFilter.value;
      const characterItems = imprintItems.filter(item => !character || String(item.character || "").trim() === character);
      setFilterOptions(seriesFilter, "Todas as séries", distinctValues(characterItems.map(item => item.seriesTitle || item.title)), seriesFilter.value);
      const series = seriesFilter.value;
      catalogRows.forEach(row => {
        row.hidden = !((!publisher || row.cells[1]?.textContent.trim() === publisher) && (!imprint || row.cells[2]?.textContent.trim() === imprint) && (!character || row.cells[3]?.textContent.trim() === character) && (!series || row.cells[0]?.querySelector("b")?.textContent.trim() === series));
      });
    };
    setFilterOptions(publisherFilter, "Todas as editoras", distinctValues(state.db.library.map(item => item.publisher)));
    publisherFilter.addEventListener("change", () => { imprintFilter.value = ""; characterFilter.value = ""; seriesFilter.value = ""; refreshCatalogFilters(); });
    imprintFilter.addEventListener("change", () => { characterFilter.value = ""; seriesFilter.value = ""; refreshCatalogFilters(); });
    characterFilter.addEventListener("change", () => { seriesFilter.value = ""; refreshCatalogFilters(); });
    seriesFilter.addEventListener("change", refreshCatalogFilters);
    refreshCatalogFilters();
    const closeAdmin = event => { event?.preventDefault(); event?.stopPropagation(); overlay.remove(); hydrateHomeCovers(); };
    overlay.addEventListener("click", event => { if (event.target === overlay) closeAdmin(event); });
    const notificationButton = document.createElement("button");
    notificationButton.className = "small-btn";
    notificationButton.textContent = "Enviar notificação";
    $(".admin-actions", overlay)?.appendChild(notificationButton);
    notificationButton.onclick = () => { overlay.remove(); openAdminNotificationForm(); };
    $("[data-close]", overlay).onclick = closeAdmin;
    $("[data-new]", overlay).onclick = () => { overlay.remove(); openEditForm(); };
    $("[data-new-collection]", overlay).onclick = () => { overlay.remove(); openCollectionForm(); };
    $("[data-achievements]", overlay).onclick = () => { overlay.remove(); openAchievementAdmin(); };
    $("[data-account-plan]", overlay).onclick = () => { overlay.remove(); openAccountPlanAdmin(); };
    $("[data-export]", overlay).onclick = exportDB; $("[data-import]", overlay).onclick = importDB;
    $$('[data-edit]', overlay).forEach(button => button.onclick = () => { overlay.remove(); openEditForm(button.dataset.edit); });
    $$('[data-delete]', overlay).forEach(button => button.onclick = () => deleteCatalogEdition(button, overlay));
    $$('[data-delete-collection]', overlay).forEach(button => button.onclick = () => { state.db.collections = state.db.collections.filter(c => c.id !== button.dataset.deleteCollection); saveCatalog("Coleção excluída."); overlay.remove(); openAdmin(); });
  }

  async function deleteCatalogEdition(button, overlay) {
    if (button.disabled) return;
    const item = state.db.library.find(item => String(item.id) === button.dataset.delete);
    if (!item) return;
    button.disabled = true;
    button.textContent = "Excluindo…";
    // Keep a shared deletion record so stale caches cannot restore this edition.
    const saved = await saveCatalog("Edição excluída.", { ...item, catalogDeleted: true });
    if (!saved) {
      button.disabled = false;
      button.textContent = "Excluir";
      return;
    }
    overlay.remove();
    render();
    openAdmin();
  }

  function bindEditionEditButtons(root = document) {
    $$('[data-edit-item]', root).forEach(button => {
      if (button.dataset.editionEditBound) return;
      button.dataset.editionEditBound = "true";
      button.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();
        if (isAdminProfile()) openEditForm(button.dataset.editItem);
      });
    });
  }

  function openEditForm(id = null, initial = null) {
    const old = id ? state.db.library.find(x => x.id === id) : null;
    const x = old || { id: "item-" + Date.now(), title: "", seriesTitle: "", issue: "", type: "comic", author: "", publisher: "", imprint: "", character: "", year: new Date().getFullYear(), description: "", fileUrl: "", telegramUrl: "", telegramFileId: "", featuredCoverUrl: "", format: "auto", clicks: 0, featured: false, tags: [], collectionIds: [], ...(initial || {}) };
    const secondaryCharacters = Array.isArray(x.secondaryCharacters)
      ? x.secondaryCharacters
      : Array.isArray(x.characters)
        ? x.characters.map(value => typeof value === "object" ? (value.name || value.character || "") : value).filter(value => String(value).trim() && String(value).trim() !== String(x.character || "").trim())
        : [];
    const overlay = document.createElement("div"); overlay.className = "modal-backdrop";
    overlay.innerHTML = `
      <div class="modal"><div class="section-head"><div><h2>${id ? "Editar edição" : "Nova edição"}</h2><div class="section-subtitle">A capa será extraída da primeira página</div></div><button class="small-btn" data-close>Fechar</button></div>
        ${old && (isAdminProfile() || ["moderator", "banca"].includes(state.profile?.plan)) ? '<div class="modal-actions"><button type="button" class="small-btn" data-edition-cover-variants>Adicionar capas variantes</button></div>' : ""}
        <form id="edit-form"><div class="form-grid">
          <div class="field"><label>Título da edição</label><input name="title" required value="${escapeHTML(x.title)}"></div>
          <div class="field"><label for="edition-series-id">ID da série</label><input id="edition-series-id" name="seriesId" value="${escapeHTML(x.seriesId || "")}" placeholder="Ex.: series-minha-serie"><small class="format-hint">Use um ID existente para mover a edição ou um novo para criar uma série. Vazio: gerar pelo nome da série.</small></div>
          <div class="field full"><label>Série (deixe vazio para oneshot)</label><input name="seriesTitle" value="${escapeHTML(x.seriesTitle || "")}" placeholder="Ex.: Homem-Aranha, Universo Casulo"></div>
          <div class="field"><label>Número da edição / volume</label><input name="volume" type="text" value="${escapeHTML(String(x.issue || ""))}" placeholder="Ex.: 0, 1, Anuário"><label class="checkbox-inline"><input name="oneShot" type="checkbox" ${!x.seriesId && !x.issue ? "checked" : ""}> Volume único</label></div>
          <div class="field"><label>Tipo</label><select name="type"><option value="comic" ${x.type === "comic" ? "selected" : ""}>Quadrinho</option><option value="manga" ${x.type === "manga" ? "selected" : ""}>Mangá</option></select></div>
          <div class="field"><label>Ano</label><input name="year" type="number" value="${escapeHTML(x.year || "")}"></div><div class="field"><label>Editora</label><input name="publisher" value="${escapeHTML(x.publisher || "")}"></div><div class="field"><label>Selo</label><input name="imprint" value="${escapeHTML(x.imprint || "")}" placeholder="Ex.: Vertigo, Marvel, Turma da Mônica"></div><div class="field"><label>Personagem principal</label><input name="character" value="${escapeHTML(x.character || "")}"></div><div class="field full"><label>Personagens secundários</label><textarea name="secondaryCharacters" rows="3" placeholder="Um personagem por linha">${escapeHTML(secondaryCharacters.join("\n"))}</textarea><small class="format-hint">Um personagem por linha. O personagem principal continua no campo acima.</small></div><div class="field"><label>Autor</label><input name="author" value="${escapeHTML(x.author || "")}"></div>
          <div class="field full"><label>Link da fonte (Telegram ou arquivo direto)</label><input name="sourceUrl" required value="${escapeHTML(x.telegramUrl || x.fileUrl || "")}" placeholder="https://t.me/canal/123 ou arquivo.pdf"><small class="format-hint">Formato detectado: <b data-format-preview>${escapeHTML(x.format || "auto")}</b></small></div>
          <div class="field"><label>Formato</label><select name="format">${["auto", "pdf", "cbz", "cbr", "jpg", "jpeg", "png", "webp", "gif"].map(format => `<option value="${format}" ${String(x.format || "auto").toLowerCase() === format ? "selected" : ""}>${format.toUpperCase()}</option>`).join("")}</select><small class="format-hint">Em posts do Telegram, selecione PDF, CBZ ou CBR.</small></div>
          <div class="field full"><label>Arquivo do Telegram</label><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><button type="button" class="small-btn" data-resolve-telegram>Identificar arquivo</button><span data-telegram-status role="status" aria-live="polite">${x.telegramFileId ? "Arquivo identificado" : "Cole uma postagem para identificar o arquivo automaticamente."}</span></div><input name="telegramFileId" type="hidden" value="${escapeHTML(x.telegramFileId || "")}"><small class="format-hint">O bot identifica o PDF, CBZ ou CBR e salva apenas seus metadados. O arquivo permanece no Telegram.</small></div>
          <div class="field full"><label>Links reserva (um por linha)</label><textarea name="backupUrls" placeholder="https://segunda-fonte/...\nhttps://terceira-fonte/...">${escapeHTML((x.backupUrls || []).join("\n"))}</textarea><small class="format-hint">Serão tentados automaticamente se a fonte principal falhar.</small></div>
          <div class="field full"><label>Link da capa (opcional)</label><input name="coverUrl" type="url" value="${escapeHTML(x.coverUrl || "")}" placeholder="https://t.me/bancahq/123 ou https://.../capa.jpg"><small class="format-hint">Aceita imagem direta ou postagem de foto/imagem do Telegram. Se preenchido, substitui a primeira página do arquivo.</small><div class="telegram-cover-tools"><button type="button" class="small-btn" data-resolve-telegram-cover="coverUrl">Identificar imagem</button><span data-telegram-cover-status="coverUrl" role="status" aria-live="polite"></span></div></div>
          <div class="field full"><label>Imagem exclusiva do destaque (opcional)</label><input name="featuredCoverUrl" type="url" value="${escapeHTML(x.featuredCoverUrl || "")}" placeholder="https://t.me/bancahq/123 ou https://.../capa-do-destaque.jpg"><small class="format-hint">Aceita imagem direta ou postagem do Telegram. Use uma imagem horizontal ou em alta resolução para o destaque.</small><div class="telegram-cover-tools"><button type="button" class="small-btn" data-resolve-telegram-cover="featuredCoverUrl">Identificar imagem</button><span data-telegram-cover-status="featuredCoverUrl" role="status" aria-live="polite"></span></div></div>
          <div class="field full"><label>Descrição</label><textarea name="description">${escapeHTML(x.description || "")}</textarea></div><div class="field full"><label>Tags</label><input name="tags" value="${escapeHTML((x.tags || []).join(", "))}"></div><div class="field full"><label><input name="featured" type="checkbox" ${x.featured ? "checked" : ""}> Mostrar como destaque</label></div>
        </div><div class="modal-actions"><button type="button" class="small-btn" data-close>Cancelar</button><button class="btn btn-danger">Salvar edição</button></div></form>
      </div>`;
    $("#modal-root").appendChild(overlay); $$('[data-close]', overlay).forEach(button => button.onclick = () => overlay.remove());
    overlay.addEventListener("click", event => { if (event.target === overlay) overlay.remove(); });
    $("[data-edition-cover-variants]", overlay)?.addEventListener("click", () => openCoverVariantsAdmin(x.id));
    const source = $("[name=sourceUrl]", overlay), preview = $("[data-format-preview]", overlay), volume = $("[name=volume]", overlay), oneShot = $("[name=oneShot]", overlay);
    const syncOneShot = () => { volume.disabled = oneShot.checked; if (oneShot.checked) volume.value = ""; };
    oneShot.addEventListener("change", syncOneShot); syncOneShot();
    const seriesIdInput = $("[name=seriesId]", overlay);
    const seriesTitleInput = $("[name=seriesTitle]", overlay);
    const findSeries = seriesId => state.db.library.find(item => item.seriesId === seriesId && item.id !== x.id)
      || (window.DEFAULT_SERIES || []).find(series => series.id === seriesId);
    seriesIdInput.addEventListener("input", () => {
      const seriesId = seriesIdInput.value.trim();
      if (!seriesId) return;
      oneShot.checked = false;
      syncOneShot();
      const series = findSeries(seriesId);
      if (series) seriesTitleInput.value = series.seriesTitle || series.name || series.title || "";
    });
    source.addEventListener("input", () => preview.textContent = detectFormat(source.value));
    const telegramEditor = window.BancaTelegram.bindEditor($("#edit-form", overlay), sb, x);
    const telegramCoverEditor = window.BancaTelegramCovers.bindEditor($("#edit-form", overlay), sb);
    $("#edit-form", overlay).onsubmit = async event => {
      event.preventDefault();
      const form = event.currentTarget;
      if (form.dataset.saving === "true") return;
      const fd = new FormData(form);
      const sourceUrl = String(fd.get("sourceUrl") || "").trim();
      const isTelegram = isTelegramPostUrl(sourceUrl);
      const telegramFileId = String(fd.get("telegramFileId") || "").trim();
      const backupUrls = String(fd.get("backupUrls") || "").split(/\r?\n/).map(value => value.trim()).filter(Boolean);
      const explicitSeriesId = fd.get("oneShot") === "on" ? "" : String(fd.get("seriesId") || "").trim();
      const targetSeries = explicitSeriesId ? findSeries(explicitSeriesId) : null;
      const seriesTitle = fd.get("oneShot") === "on" ? "" : String(targetSeries?.seriesTitle || targetSeries?.name || targetSeries?.title || fd.get("seriesTitle") || (explicitSeriesId ? fd.get("title") : "") || "").trim();
      const volumeNumber = fd.get("oneShot") === "on" ? "" : String(fd.get("volume") || "").trim();
      const character = String(fd.get("character") || "").trim();
      const secondaryCharacters = [...new Set(String(fd.get("secondaryCharacters") || "").split(/\r?\n|,/).map(value => value.trim()).filter(value => value && value !== character))];
      const item = {
        ...x,
        addedAt: old ? (x.addedAt || (catalogAddedTimestamp(x) ? new Date(catalogAddedTimestamp(x)).toISOString() : undefined)) : new Date().toISOString(),
        title: String(fd.get("title") || "").trim(),
        seriesTitle,
        seriesId: explicitSeriesId || (seriesTitle ? seriesKey(seriesTitle) : ""),
        issue: volumeNumber,
        type: fd.get("type"),
        year: Number(fd.get("year")) || new Date().getFullYear(),
        publisher: String(fd.get("publisher") || "").trim(),
        imprint: String(fd.get("imprint") || "").trim(),
        character,
        secondaryCharacters,
        author: String(fd.get("author") || "").trim(),
        format: String(fd.get("format") || "auto").toLowerCase() === "auto" ? detectFormat(sourceUrl) : String(fd.get("format")).toLowerCase(),
        fileUrl: isTelegram ? "" : sourceUrl,
        backupUrls,
        telegramUrl: isTelegram ? sourceUrl : "",
        telegramFileId: isTelegram ? telegramFileId : "",
        catalogEditedAt: new Date().toISOString(),
        cover: "",
        coverUrl: String(fd.get("coverUrl") || "").trim(),
        featuredCoverUrl: String(fd.get("featuredCoverUrl") || "").trim(),
        description: String(fd.get("description") || "").trim(),
        tags: String(fd.get("tags") || "").split(",").map(s => s.trim()).filter(Boolean),
        featured: fd.get("featured") === "on"
      };
      if (Array.isArray(item.characters)) item.characters = [character, ...secondaryCharacters];
      delete item.randomWeight;
      const submit = form.querySelector('button.btn');
      form.dataset.saving = "true";
      submit.disabled = true;
      submit.textContent = "Publicando edição...";
      try {
        if (window.BancaTelegramCovers.isPost(item.coverUrl) || window.BancaTelegramCovers.isPost(item.featuredCoverUrl)) {
          submit.textContent = "Identificando capas…";
          Object.assign(item, await telegramCoverEditor.forSave(item, { coverUrl: item.coverUrl, featuredCoverUrl: item.featuredCoverUrl }));
        }
        if (isTelegram && (!telegramFileId || !window.BancaTelegram.samePost(x.telegramUrl, sourceUrl))) {
          submit.textContent = "Identificando arquivo…";
          try {
            Object.assign(item, await telegramEditor.forSave(item, sourceUrl));
          } catch (error) {
            if (!window.BancaTelegram.samePost(x.telegramUrl, sourceUrl)) throw error;
            item.telegramUrl = sourceUrl;
            item.telegramFileId = telegramFileId || x.telegramFileId || "";
            item.telegramFileName = x.telegramFileName || "";
            item.telegramFileSize = Number(x.telegramFileSize || 0);
          }
        }
        submit.textContent = "Publicando edição...";
        const published = await saveCatalog("Edição salva.", item);
        if (published) {
          overlay.remove();
          render();
        } else {
          let status = form.querySelector('[data-publish-status]');
          if (!status) {
            status = document.createElement("p");
            status.dataset.publishStatus = "";
            status.setAttribute("role", "alert");
            form.appendChild(status);
          }
          status.textContent = "A publicação falhou. A edição permanece neste formulário; tente salvar novamente. Nenhuma alteração não confirmada foi publicada.";
        }
      } catch (error) {
        let status = form.querySelector('[data-publish-status]');
        if (!status) {
          status = document.createElement("p");
          status.dataset.publishStatus = "";
          status.setAttribute("role", "alert");
          form.appendChild(status);
        }
        status.textContent = error.message || "Não foi possível salvar a edição.";
      } finally {
        form.dataset.saving = "false";
        submit.disabled = false;
        submit.textContent = "Salvar edição";
      }
    };
  }

  return {
    openAdmin,
    bindEditionEditButtons,
    openEditForm,
    openSubmission
  };
}
