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
