  function openSeriesSelection(series, editions, returnToCoverVariants = false, returnToFileReports = false, returnToReader = null) {
    if (isHiddenCatalogSeries(series?.seriesId || series?.id) && !isAdminProfile()) {
      toast("Esta série está temporariamente oculta.");
      return;
    }

    const overlay = document.createElement("div");
    overlay.className = "modal-backdrop";
    const volumeGroups = new Map();
    editions.slice().sort((a, b) => issueSortValue(a) - issueSortValue(b)).forEach(item => {
      const label = item.volumeTitle || item.volume || "Edições";
      if (!volumeGroups.has(label)) volumeGroups.set(label, []);
      volumeGroups.get(label).push(item);
    });
    const volumeEntries = [...volumeGroups.entries()];
    const volumeTabs = volumeEntries.length > 1
      ? `<div class="series-volume-tabs">${volumeEntries.map(([label], index) => `<button class="small-btn ${index === 0 ? "is-active" : ""}" type="button" data-series-volume-tab="${index}">${escapeHTML(label)}</button>`).join("")}</div>`
      : "";
    const volumePanels = volumeEntries.map(([label, items], index) => `<div class="series-volume-panel" data-series-volume-panel="${index}" ${index ? "hidden" : ""}><div class="section-subtitle series-volume-heading">${escapeHTML(label)}</div><div class="results-grid">${items.map(item => card(item, state.readingProgress, state.favoriteIds, false, null, true)).join("")}</div></div>`).join("");
    overlay.innerHTML = `
      <div class="modal series-modal">
        <div class="section-head">
          <div><div class="eyebrow">Série</div><h2>${escapeHTML(series.seriesTitle || series.title)}</h2><div class="section-subtitle">${editions.length} edições disponíveis · clique em uma edição para ler</div></div>
          <div class="modal-actions"><button class="small-btn" data-back-cover-variants ${returnToCoverVariants ? "" : "hidden"}>Voltar</button><button class="small-btn" data-back-file-reports ${returnToFileReports ? "" : "hidden"}>Voltar</button><button class="small-btn" data-back-reader ${returnToReader ? "" : "hidden"}>Voltar à história</button><button class="small-btn" data-close>Fechar</button></div>
        </div>
        ${volumeTabs}${volumePanels}
      </div>`;
    $("#modal-root").appendChild(overlay);
    const downloadSeriesButton = document.createElement("button");
    downloadSeriesButton.className = "small-btn";
    downloadSeriesButton.type = "button";
    downloadSeriesButton.dataset.seriesDownloadModal = series.seriesId;
    $(".modal-actions", overlay)?.prepend(downloadSeriesButton);
    downloadSeriesButton.addEventListener("click", () => startSeriesDownload(editions));
    refreshSeriesDownloadButton(series.seriesId);
    hydrateHomeCovers();
    overlay.addEventListener("click", event => {
      if (event.target === overlay) overlay.remove();
    });
    $("[data-close]", overlay).onclick = () => overlay.remove();
    $("[data-back-reader]", overlay)?.addEventListener("click", () => { overlay.remove(); openReader(returnToReader); });
   $('[data-back-cover-variants]', overlay)?.addEventListener("click", () => { overlay.remove(); openCoverVariantsReviewPopup(); });
    $('[data-back-file-reports]', overlay)?.addEventListener("click", () => { overlay.remove(); openFileReportsPopup(); });
    $$('[data-download]', overlay).forEach(el => el.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      const item = state.db.library.find(entry => String(entry.id) === String(el.dataset.download));
      const download = item && downloaded(item.id);
      const isCompleted = download?.status === "completed" || el.classList.contains("is-downloaded") || /Excluir download offline/i.test(el.title || "");
      if (!item || download?.status === "downloading" || download?.status === "waiting") return;
      isCompleted ? deleteDownload(item.id) : startDownload(item);
    }));
    $$('[data-sticker-request-character]').forEach(button => button.addEventListener('click', async event => {
      event.preventDefault();
      event.stopPropagation();
      if (button.disabled) return;
      button.disabled = true;
      try {
        await requestSticker(button.dataset.stickerRequestCharacter, button.dataset.stickerRequestOwner, button.dataset.stickerRequestType);
      } catch (error) {
        console.error('Falha ao abrir o fluxo de pedido/troca de figurinha:', error);
        toast(error?.message || 'Não foi possível iniciar esse pedido. Atualize o álbum e tente novamente.');
      } finally {
        button.disabled = false;
      }
    }));
    $$('[data-sticker-request]').forEach(button => button.addEventListener('click', async () => {
      button.disabled = true;
      const result = await sb.rpc('respond_sticker_request', { p_request_id: Number(button.dataset.stickerRequest), p_status: button.dataset.stickerResponse });
      if (result.error) toast(result.error.message || 'Não foi possível responder ao pedido.');
      else { toast(button.dataset.stickerResponse === 'accepted' ? 'Pedido concluído.' : 'Pedido recusado.'); await loadAccount(); }
      button.disabled = false;
    }));
    $$('[data-entity-kind]', overlay).forEach(el => el.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      overlay.remove();
      openEntityPage(el.dataset.entityKind, el.dataset.entityValue);
    }));
    $$('[data-publisher]', overlay).forEach(el => el.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      overlay.remove();
      openEntityPage("publisher", el.dataset.publisher);
    }));
    $$('[data-open]', overlay).forEach(el => el.addEventListener("click", event => {
      if (event.target.closest("button, a")) return;
      overlay.remove();
      openReader(state.db.library.find(x => x.id === el.dataset.open));
    }));
    $$('[data-cover-choice]', overlay).forEach(el => {
      if (el.dataset.coverChoiceBound) return;
      el.dataset.coverChoiceBound = "true";
      el.addEventListener("click", event => {
        event.stopPropagation();
        openCoverChoice(el.dataset.coverChoice);
      });
    });
    $$('[data-favorite]', overlay).forEach(el => el.addEventListener("click", event => {
      event.stopPropagation();
      toggleFavorite(el.dataset.favorite);
    }));
    $$('[data-edit-item]', overlay).forEach(el => el.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      if (isAdminProfile()) openEditForm(el.dataset.editItem);
    }));
    $$('[data-like-item]', overlay).forEach(el => el.addEventListener("click", event => {
      event.stopPropagation();
      toggleComicLike(el.dataset.likeItem);
    }));
    $$('[data-share-item]', overlay).forEach(el => el.addEventListener("click", event => {
      event.stopPropagation();
      shareComic(el.dataset.shareItem);
    }));
    $$('[data-comment-item]', overlay).forEach(el => el.addEventListener("click", event => {
      event.stopPropagation();
      const item = state.db.library.find(entry => entry.id === el.dataset.commentItem);
      if (item) openCommentsPopup(item);
    }));
    $$('[data-series-volume-tab]', overlay).forEach(tab => tab.addEventListener("click", () => {
      const selected = tab.dataset.seriesVolumeTab;
      $$('[data-series-volume-tab]', overlay).forEach(button => button.classList.toggle("is-active", button === tab));
      $$('[data-series-volume-panel]', overlay).forEach(panel => { panel.hidden = panel.dataset.seriesVolumePanel !== selected; });
    }));
  }

