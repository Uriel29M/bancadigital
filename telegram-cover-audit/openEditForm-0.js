
  function openEditForm(id = null) {
    const old = id ? state.db.library.find(x => x.id === id) : null;
    const x = old || { id: "item-" + Date.now(), title: "", seriesTitle: "", issue: "", type: "comic", author: "", publisher: "", imprint: "", character: "", year: new Date().getFullYear(), description: "", fileUrl: "", telegramUrl: "", telegramFileId: "", featuredCoverUrl: "", format: "auto", clicks: 0, featured: false, tags: [], collectionIds: [] };
    const secondaryCharacters = Array.isArray(x.secondaryCharacters)
      ? x.secondaryCharacters
      : Array.isArray(x.characters)
        ? x.characters.map(value => typeof value === "object" ? (value.name || value.character || "") : value).filter(value => String(value).trim() && String(value).trim() !== String(x.character || "").trim())
        : [];
    const overlay = document.createElement("div"); overlay.className = "modal-backdrop";
    overlay.innerHTML = `
      <div class="modal"><div class="section-head"><div><h2>${id ? "Editar edição" : "Nova edição"}</h2><div class="section-subtitle">A capa será extraída da primeira página</div></div><button class="small-btn" data-close>Fechar</button></div>
        <form id="edit-form"><div class="form-grid">
          <div class="field"><label>Título da edição</label><input name="title" required value="${escapeHTML(x.title)}"></div>
          <div class="field full"><label>Série (deixe vazio para oneshot)</label><input name="seriesTitle" value="${escapeHTML(x.seriesTitle || "")}" placeholder="Ex.: Homem-Aranha, Universo Casulo"></div>
          <div class="field"><label>Número da edição / volume</label><input name="volume" type="text" value="${escapeHTML(String(x.issue || ""))}" placeholder="Ex.: 0, 1, Anuário"><label class="checkbox-inline"><input name="oneShot" type="checkbox" ${!x.seriesId && !x.issue ? "checked" : ""}> Volume único</label></div>
          <div class="field"><label>Tipo</label><select name="type"><option value="comic" ${x.type === "comic" ? "selected" : ""}>Quadrinho</option><option value="manga" ${x.type === "manga" ? "selected" : ""}>Mangá</option></select></div>
          <div class="field"><label>Ano</label><input name="year" type="number" value="${escapeHTML(x.year || "")}"></div><div class="field"><label>Editora</label><input name="publisher" value="${escapeHTML(x.publisher || "")}"></div><div class="field"><label>Selo</label><input name="imprint" value="${escapeHTML(x.imprint || "")}" placeholder="Ex.: Vertigo, Marvel, Turma da Mônica"></div><div class="field"><label>Personagem principal</label><input name="character" value="${escapeHTML(x.character || "")}"></div><div class="field full"><label>Personagens secundários</label><textarea name="secondaryCharacters" rows="3" placeholder="Um personagem por linha">${escapeHTML(secondaryCharacters.join("\n"))}</textarea><small class="format-hint">Um personagem por linha. O personagem principal continua no campo acima.</small></div><div class="field"><label>Autor</label><input name="author" value="${escapeHTML(x.author || "")}"></div>
          <div class="field full"><label>Link da fonte (Telegram ou arquivo direto)</label><input name="sourceUrl" required value="${escapeHTML(x.telegramUrl || x.fileUrl || "")}" placeholder="https://t.me/canal/123 ou arquivo.pdf"><small class="format-hint">Formato detectado: <b data-format-preview>${escapeHTML(x.format || "auto")}</b></small></div>
          <div class="field"><label>Formato</label><select name="format">${["auto", "pdf", "cbz", "cbr", "jpg", "jpeg", "png", "webp", "gif"].map(format => `<option value="${format}" ${String(x.format || "auto").toLowerCase() === format ? "selected" : ""}>${format.toUpperCase()}</option>`).join("")}</select><small class="format-hint">Em posts do Telegram, selecione PDF, CBZ ou CBR.</small></div>
          <div class="field full"><label>Arquivo do Telegram</label><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><button type="button" class="small-btn" data-resolve-telegram>Identificar arquivo</button><span data-telegram-status role="status" aria-live="polite">${x.telegramFileId ? "Arquivo identificado" : "Cole uma postagem para identificar o arquivo automaticamente."}</span></div><input name="telegramFileId" type="hidden" value="${escapeHTML(x.telegramFileId || "")}"><small class="format-hint">O bot identifica o PDF, CBZ ou CBR e salva apenas seus metadados. O arquivo permanece no Telegram.</small></div>
          <div class="field full"><label>Links reserva (um por linha)</label><textarea name="backupUrls" placeholder="https://segunda-fonte/...\nhttps://terceira-fonte/...">${escapeHTML((x.backupUrls || []).join("\n"))}</textarea><small class="format-hint">Serão tentados automaticamente se a fonte principal falhar.</small></div>
          <div class="field full"><label>Link da capa (opcional)</label><input name="coverUrl" type="url" value="${escapeHTML(x.coverUrl || "")}" placeholder="https://.../capa.jpg"><small class="format-hint">Se preenchido, será usada como capa da edição em vez da primeira página do arquivo.</small></div>
          <div class="field full"><label>Imagem exclusiva do destaque (opcional)</label><input name="featuredCoverUrl" type="url" value="${escapeHTML(x.featuredCoverUrl || "")}" placeholder="https://.../capa-do-destaque.jpg"><small class="format-hint">Use uma imagem horizontal ou uma capa em alta resolução para controlar melhor o destaque.</small></div>
          <div class="field full"><label>Descrição</label><textarea name="description">${escapeHTML(x.description || "")}</textarea></div><div class="field full"><label>Tags</label><input name="tags" value="${escapeHTML((x.tags || []).join(", "))}"></div><div class="field full"><label><input name="featured" type="checkbox" ${x.featured ? "checked" : ""}> Mostrar como destaque</label></div>
        </div><div class="modal-actions"><button type="button" class="small-btn" data-close>Cancelar</button><button class="btn btn-danger">Salvar edição</button></div></form>
      </div>`;
    $("#modal-root").appendChild(overlay); $$('[data-close]', overlay).forEach(button => button.onclick = () => overlay.remove());
    overlay.addEventListener("click", event => { if (event.target === overlay) overlay.remove(); });
    const source = $("[name=sourceUrl]", overlay), preview = $("[data-format-preview]", overlay), volume = $("[name=volume]", overlay), oneShot = $("[name=oneShot]", overlay);
    const syncOneShot = () => { volume.disabled = oneShot.checked; if (oneShot.checked) volume.value = ""; };
    oneShot.addEventListener("change", syncOneShot); syncOneShot();
    source.addEventListener("input", () => preview.textContent = detectFormat(source.value));
    const telegramEditor = window.BancaTelegram.bindEditor($("#edit-form", overlay), sb, x);
    $("#edit-form", overlay).onsubmit = async event => {
      event.preventDefault();
      const form = event.currentTarget;
      if (form.dataset.saving === "true") return;
      const fd = new FormData(form);
      const sourceUrl = String(fd.get("sourceUrl") || "").trim();
      const isTelegram = isTelegramPostUrl(sourceUrl);
      const telegramFileId = String(fd.get("telegramFileId") || "").trim();
      const backupUrls = String(fd.get("backupUrls") || "").split(/\r?\n/).map(value => value.trim()).filter(Boolean);
      const seriesTitle = fd.get("oneShot") === "on" ? "" : String(fd.get("seriesTitle") || "").trim();
      const volumeNumber = fd.get("oneShot") === "on" ? "" : String(fd.get("volume") || "").trim();
      const character = String(fd.get("character") || "").trim();
      const secondaryCharacters = [...new Set(String(fd.get("secondaryCharacters") || "").split(/\r?\n|,/).map(value => value.trim()).filter(value => value && value !== character))];
      const item = {
        ...x,
        title: String(fd.get("title") || "").trim(),
        seriesTitle,
        seriesId: seriesTitle ? seriesKey(seriesTitle) : "",
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
        if (isTelegram) {
          submit.textContent = "Identificando arquivo…";
          Object.assign(item, await telegramEditor.forSave(item, sourceUrl));
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
