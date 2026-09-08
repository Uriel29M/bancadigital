  function renderCollections() {
    return `
      <div class="content">
        <div class="section-head">
          <div><h1 class="section-title">Coleções</h1><div class="section-subtitle">Coletâneas que juntam várias edições.</div></div>
        </div>
        ${state.db.collections.map(c => `
          <section class="section">
            <div class="collection-banner" style="--collection-bg:url('${escapeHTML(c.cover || "")}')">
              <div class="eyebrow">Coleção</div>
              <h2>${escapeHTML(c.title)}</h2>
              <p>${escapeHTML(c.description || "")}</p>
              <div><button class="btn btn-primary" data-collection="${escapeHTML(c.id)}">Abrir coleção</button></div>
            </div>
          </section>`).join("") || `<div class="empty">Nenhuma coleção cadastrada.</div>`}
      </div>`;
  }

