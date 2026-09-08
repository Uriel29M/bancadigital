  function openReader(item, options = {}) {
    if (!item) return;
    if (!canViewCatalogItem(item, isAdminProfile())) {
      toast("Esta edição está temporariamente oculta.");
      return;
    }
    if (!options.telegramResolved && !item.local && isTelegramPostUrl(item.telegramUrl) && navigator.onLine !== false && sb) {
      if (readerIsOpen && activeReaderCleanup && String(state.readerItemId || "") === String(item.id || "") && document.querySelector(".reader-overlay")) return;
      void window.BancaTelegram.published(item, sb).then(canonical => {
        if (!canonical.telegramFileId && !canonical.fileUrl) {
          toast("Esta postagem ainda não foi identificada pelo bot. Um administrador precisa salvar a edição novamente.");
          return;
        }
        openReader(canonical, { ...options, telegramResolved: true });
      }).catch(error => toast(`Não foi possível consultar a fonte do Telegram: ${error.message || error}`));
      return;
    }
    if (!item) return;
    if (readerIsOpen && activeReaderCleanup && String(state.readerItemId || "") === String(item.id || "") && document.querySelector(".reader-overlay")) return;
    if (!canViewCatalogItem(item, isAdminProfile())) {
      toast("Esta edição está temporariamente oculta.");
      return;
    }
    if (!downloadSource(item) && item?.officialUrl) {
      window.open(item.officialUrl, "_blank", "noopener");
      return;
    }
    const sourceUrl = downloadSource(item);
    if (isExternalArchiveLink(sourceUrl)) {
      window.open(sourceUrl, "_blank", "noopener");
      return;
    }

    if (!item.local && navigator.onLine === false) {
      activateOfflineMode();
      if (downloaded(item.id)?.status === "completed") return openDownloaded(item);
      toast("Este quadrinho não está disponível offline. Abra a área de Downloads para ver os quadrinhos baixados.");
      setSection("downloads");
      return;
    }

    state.recentlyOpenedIds = [String(item.id), ...state.recentlyOpenedIds.filter(id => String(id) !== String(item.id))].slice(0, 20);
    try { localStorage.setItem("bancaDigitalRecentlyOpened", JSON.stringify(state.recentlyOpenedIds)); } catch {}

    prioritizeReaderLoading();

    if (!item.local && !options.routeSync) {
      navigate({ ler: item.id });
      return;
    }

    activeReaderCleanup?.();
    activeReaderCleanup = null;

    recordComicRead(item);
    const sourceCandidates = readerSourceCandidates(item);
    let resolvedUrl = sourceCandidates[0] || "";

    if (!resolvedUrl) {
      toast(item.telegramUrl ? "Esta edição do Telegram ainda não tem o file_id do bot configurado." : "Esta edição não tem uma URL de arquivo direto.");
      return;
    }

    readerIsOpen = true;
    prioritizeReaderLoading();

    const prefetchedBuffer = readerFilePrefetches.get(resolvedUrl) || null;
    readerFilePrefetches.delete(resolvedUrl);
    const itemFormat = String(item.format || "").toLowerCase();
    const fileFormat = extension(item.file?.name || item.name || "");
    const format = /^(pdf|cbz|cbr|jpg|jpeg|png|webp|gif)$/.test(itemFormat)
      ? itemFormat
      : (fileFormat || extension(resolvedUrl)).toLowerCase();
    const skipCover = Object.prototype.hasOwnProperty.call(options, "skipCover") ? options.skipCover === true : shouldSkipCover();
    const savedProgress = progressFor(item);
    const resumePage = savedProgress?.page || (skipCover ? 2 : 1);
    let readerGrayscale = options.grayscale === true;
    const overlay = document.createElement("div");
    overlay.className = "reader-overlay";
    const supportedFormatsForModes = ["pdf", "cbz", "cbr"];
    const showModeSelector = supportedFormatsForModes.includes(format);
    overlay.innerHTML = `
      <div class="reader-top">
        <button class="small-btn" data-close-reader>← Voltar</button>
        <button class="small-btn" data-reader-home>Início</button>
        <div class="reader-title">${escapeHTML(itemDisplayTitle(item))}</div>
        ${showModeSelector ? `
          <select class="small-btn" id="reading-mode-select" disabled>
            <option value="single-page" ${state.readingMode === 'single-page' ? 'selected' : ''}>Página por página</option>
            <option value="double-page" ${state.readingMode === 'double-page' ? 'selected' : ''}>
              Duas páginas
            </option>
            <option value="continuous-scroll" ${state.readingMode === 'continuous-scroll' ? 'selected' : ''}>Rolagem contínua</option>
          </select>
        ` : ''}
        <button class="small-btn" id="reading-direction-btn" style="display: ${showModeSelector && state.readingMode === 'double-page' ? 'inline-block' : 'none'};">
          ${state.readingDirection === 'eastern' ? '↔ Oriental' : '↔ Ocidental'}
        </button>
        ${showModeSelector ? `<button class="small-btn" data-toggle-cover>${skipCover ? 'Incluir capa' : 'Ignorar capa'}</button>` : ''}
        <button class="small-btn" data-toggle-grayscale>${readerGrayscale ? 'Cor normal' : 'Preto e branco'}</button>
        <button class="small-btn" data-reader-zoom>Zoom</button>
        ${state.session && !item.local ? `<button class="small-btn" data-toggle-read>${savedProgress?.completed ? 'Desmarcar como lida' : 'Marcar como lida'}</button>` : ''}
        ${!state.session?.offline && characterNames(item)[0] ? `<button class="small-btn" data-browse-character="${escapeHTML(characterNames(item)[0])}">Ver personagem</button>` : ''}
        ${!state.session?.offline && item.publisher ? `<button class="small-btn" data-browse-publisher>Ver editora</button>` : ''}
        ${!item.local ? `<button class="small-btn reader-like-button ${state.comicLikeIds.has(item.id) ? "is-liked" : ""}" data-like-item="${escapeHTML(item.id)}">${state.comicLikeIds.has(item.id) ? "♥" : "♡"} ${state.comicLikeCounts.get(item.id) || 0}</button><button class="small-btn" data-share-item="${escapeHTML(item.id)}">Compartilhar</button>` : ""}
        ${!item.local ? `<button class="small-btn" data-comment-item="${escapeHTML(item.id)}">Comentários</button>` : ""}
        ${item.seriesId ? `<button class="small-btn" data-view-series="${escapeHTML(item.seriesId)}">Série</button>` : ""}
        ${state.profile?.plan === "admin" && !state.session?.offline ? `<button class="small-btn" data-open-external>Ver arquivo</button>` : ''}
      </div>
      <div class="reader-body" id="reader-body"></div>
      <div class="reader-bottom-controls">
        <div class="reader-series-controls reader-series-prev" id="reader-series-prev"></div>
        <div class="reader-controls" id="reader-controls"><span class="reader-page">O primeiro carregamento costuma ser demorado.</span></div>
        <div class="reader-series-controls reader-series-next" id="reader-series-next"></div>
      </div>
    `;
    document.body.appendChild(overlay);

    const closeReaderButton = $("[data-close-reader]", overlay);
    const readerHomeButton = $("[data-reader-home]", overlay);
    let readerExitToHome = false;
    let removeReaderSwipeListeners = () => {};
    const cleanupReader = () => {
      if (activeReaderCleanup === cleanupReader) activeReaderCleanup = null;
      readerIsOpen = false;
      if (readerSingleClickTimer) window.clearTimeout(readerSingleClickTimer);
      readerSingleClickTimer = null;
      overlay._cbzDownloadController?.abort();
      overlay.remove();
      resumeCoverLoading();
      if (options.localObjectUrl) URL.revokeObjectURL(options.localObjectUrl);
      removeReaderSwipeListeners();
    };
    activeReaderCleanup = cleanupReader;
    // Preserve the temporary Blob URL when the reader is re-opened for a
    // layout change. This is essential for files opened from offline storage.
    overlay._reopenReader = (nextOptions = {}) => {
      const localObjectUrl = options.localObjectUrl;
      options.localObjectUrl = null;
      activeReaderCleanup?.();
      openReader(item, {
        ...nextOptions,
        localObjectUrl,
        routeSync: true,
        grayscale: readerGrayscale
      });
    };
    closeReaderButton.onclick = () => {
      cleanupReader();
      if (readerExitToHome) {
        readerExitToHome = false;
        navigate({ pagina: state.session?.offline ? "downloads" : "" }, true);
        return;
      }
      // A rota do leitor já foi adicionada ao histórico ao abrir o gibi.
      // Voltar de fato uma entrada evita que o botão Voltar gere um novo
      // histórico e depois reabra o leitor ao ser pressionado novamente.
      if (currentRouteHistoryIndex() > 0) window.history.back();
      else navigate({ pagina: state.session?.offline ? "downloads" : "" }, true);
    };
    readerHomeButton.onclick = () => {
      readerExitToHome = true;
      closeReaderButton.click();
    };
    $("[data-like-item]", overlay)?.addEventListener("click", event => { event.stopPropagation(); toggleComicLike(item.id); });
    $("[data-share-item]", overlay)?.addEventListener("click", event => { event.stopPropagation(); shareComic(item.id); });
    $("[data-comment-item]", overlay)?.addEventListener("click", event => { event.stopPropagation(); openCommentsPopup(item); });
    $("[data-view-series]", overlay)?.addEventListener("click", event => {
      event.stopPropagation();
      const editions = seriesEditions(item);
      cleanupReader();
      setSection("home");
      openSeriesSelection(item, editions, false, false, item);
    });
    $("[data-open-external]", overlay)?.addEventListener("click", () => window.open(resolvedUrl, "_blank", "noopener"));
    $("[data-toggle-cover]", overlay)?.addEventListener("click", () => {
      const nextSkipCover = !skipCover;
      if (state.session?.user?.id) saveSkipCoverPreference(nextSkipCover);
      const localObjectUrl = options.localObjectUrl;
      options.localObjectUrl = null;
      cleanupReader();
      openReader(item, { skipCover: nextSkipCover, localObjectUrl, routeSync: true, grayscale: readerGrayscale });
    });

    $("[data-toggle-grayscale]", overlay)?.addEventListener("click", event => {
      readerGrayscale = !readerGrayscale;
      body.classList.toggle("reader-grayscale", readerGrayscale);
      event.currentTarget.textContent = readerGrayscale ? "Cor normal" : "Preto e branco";
    });
    $$('[data-browse-character]', overlay).forEach(button => button.addEventListener("click", () => { overlay.remove(); openEntityPage("character", button.dataset.browseCharacter); }));
    $("[data-browse-publisher]", overlay)?.addEventListener("click", () => { overlay.remove(); openEntityPage("publisher", item.publisher); });

    const body = $("#reader-body", overlay);
    const controls = $("#reader-controls", overlay);
    body.addEventListener("contextmenu", async event => {
      if (!event.target.closest("img.reader-image")) return;
      event.preventDefault();

      try {
        const imageUrl = new URL("assets/Baixarpaginas.jpg", document.baseURI).href;
        const response = await fetch(imageUrl, { cache: "no-store" });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const imageBlob = await response.blob();
        const downloadUrl = URL.createObjectURL(new Blob([imageBlob], { type: "image/jpeg" }));
        const downloadLink = document.createElement("a");
        downloadLink.href = downloadUrl;
        downloadLink.download = "Baixarpaginas.jpg";
        document.body.appendChild(downloadLink);
        downloadLink.click();
        downloadLink.remove();
        window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
      } catch (error) {
        console.warn("Não foi possível baixar a imagem de proteção:", error);
        toast("Não foi possível baixar a imagem de proteção.");
      }
    });
    body.classList.toggle("reader-page-swipe", ["single-page", "double-page"].includes(state.readingMode));
    const toggleReadButton = $("[data-toggle-read]", overlay);
    if (toggleReadButton) toggleReadButton.disabled = true;
    const markReaderReady = () => { if (toggleReadButton) toggleReadButton.disabled = false; };
    let readerReadyObserver = null;
    if (toggleReadButton && "MutationObserver" in window) {
      readerReadyObserver = new MutationObserver(() => {
        if (body.querySelector("canvas, img, .image-continuous-scroll-container, .pdf-continuous-scroll-container, .reader-double-page")) {
          markReaderReady();
          readerReadyObserver.disconnect();
          readerReadyObserver = null;
        }
      });
      readerReadyObserver.observe(body, { childList: true, subtree: true });
    }
    toggleReadButton?.addEventListener("click", event => {
      const completed = toggleReadingCompleted(item, progressFor(item)?.total_pages || 1);
      event.currentTarget.textContent = completed ? "Desmarcar como lida" : "Marcar como lida";
    });
    overlay._readerNavigate = direction => {
      const button = direction > 0 ? $("[data-next]", controls) : $("[data-prev]", controls);
      if (button && !button.disabled) button.click();
    };
    const toggleReaderChrome = () => overlay.classList.toggle("reader-immersive");
    const readerZoomButton = $("[data-reader-zoom]", overlay);
    let readerZoom = 1;
    const READER_DEFAULT_ZOOM = 1;
    const READER_BUTTON_ZOOM = 2;
    let readerZoomOrigin = { x: "50%", y: "50%" };
    let readerPan = { x: 0, y: 0 };
    let readerPanPointer = null;
    let readerSingleClickTimer = null;
    let lastReaderZoomAt = 0;
    const setReaderZoom = (nextZoom, origin = readerZoomOrigin) => {
      readerZoom = Math.max(1, Math.min(3, nextZoom));
      readerZoomOrigin = origin;
      if (readerZoom === READER_DEFAULT_ZOOM) readerPan = { x: 0, y: 0 };
      body.style.setProperty("--reader-zoom", String(readerZoom));
      body.style.setProperty("--reader-pan-x", `${readerPan.x}px`);
      body.style.setProperty("--reader-pan-y", `${readerPan.y}px`);
      body.style.setProperty("--reader-origin-x", origin.x);
      body.style.setProperty("--reader-origin-y", origin.y);
      body.classList.toggle("reader-gesture-zoom", readerZoom > 1);
      readerZoomButton.textContent = readerZoom > 1 ? `Zoom ${Math.round(readerZoom * 100)}%` : "Zoom";
    };
    const toggleReaderZoom = (origin = readerZoomOrigin) => {
      lastReaderZoomAt = Date.now();
      lastReaderClickAt = 0;
      if (readerSingleClickTimer) {
        window.clearTimeout(readerSingleClickTimer);
        readerSingleClickTimer = null;
      }
      setReaderZoom(readerZoom >= READER_BUTTON_ZOOM ? READER_DEFAULT_ZOOM : READER_BUTTON_ZOOM, origin);
      overlay.classList.add("reader-immersive");
    };
    readerZoomButton.onclick = () => toggleReaderZoom();
    let readerSwipe = null;
    let suppressReaderClick = false;
    let lastReaderClickAt = 0;
    let ignoreReaderClicksUntil = 0;
    const activeReaderPointers = new Map();
    let readerPinchStart = null;
    let lastReaderTap = 0;
    let readerTap = null;
    const readerZoomOriginAt = (clientX, clientY) => {
      const rect = body.getBoundingClientRect();
      return { x: `${Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100))}%`, y: `${Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100))}%` };
    };
    const readerPointerDistance = () => {
      const points = [...activeReaderPointers.values()];
      return points.length < 2 ? 0 : Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
    };
    const readerPointerCenter = () => {
      const points = [...activeReaderPointers.values()];
      return { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 };
    };
    const onReaderPointerDown = event => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      if (event.target.closest("button, a, select, textarea, input")) return;
      activeReaderPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      body.setPointerCapture?.(event.pointerId);
      if (activeReaderPointers.size === 2) {
        readerPanPointer = null;
        readerSwipe = null;
        readerTap = null;
        readerPinchStart = { distance: readerPointerDistance(), zoom: readerZoom };
        ignoreReaderClicksUntil = Date.now() + 600;
        body.classList.add("reader-panning");
        event.preventDefault();
        return;
      }
      if (readerZoom > 1) {
        readerPanPointer = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, startX: readerPan.x, startY: readerPan.y };
        body.setPointerCapture?.(event.pointerId);
        body.classList.add("reader-panning");
        event.preventDefault();
        return;
      }
      readerTap = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
      if (!["single-page", "double-page"].includes(state.readingMode)) return;
      readerSwipe = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
    };
    const onReaderPointerMove = event => {
      if (activeReaderPointers.has(event.pointerId)) activeReaderPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (readerPinchStart && activeReaderPointers.size >= 2) {
        const distance = readerPointerDistance();
        const center = readerPointerCenter();
        const rect = body.getBoundingClientRect();
        if (distance > 0 && rect.width && rect.height) {
          setReaderZoom(readerPinchStart.zoom * distance / readerPinchStart.distance, {
            x: `${((center.x - rect.left) / rect.width) * 100}%`,
            y: `${((center.y - rect.top) / rect.height) * 100}%`
          });
          event.preventDefault();
        }
        return;
      }
      if (readerPanPointer && event.pointerId === readerPanPointer.pointerId) {
        readerPan = {
          x: readerPanPointer.startX + event.clientX - readerPanPointer.x,
          y: readerPanPointer.startY + event.clientY - readerPanPointer.y
        };
        body.style.setProperty("--reader-pan-x", `${readerPan.x}px`);
        body.style.setProperty("--reader-pan-y", `${readerPan.y}px`);
        body.classList.add("reader-panning");
        event.preventDefault();
        return;
      }
      if (!readerSwipe || event.pointerId !== readerSwipe.pointerId) return;
      const dx = event.clientX - readerSwipe.x;
      const dy = event.clientY - readerSwipe.y;
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      if (Math.abs(dx) > Math.abs(dy)) {
        event.preventDefault();
        body.setPointerCapture?.(event.pointerId);
      }
    };
    const finishReaderSwipeAt = (clientX, clientY) => {
      if (!readerSwipe) return;
      const swipe = readerSwipe;
      readerSwipe = null;
      const distance = clientX - swipe.x;
      const verticalDistance = Math.abs(clientY - swipe.y);
      if (Math.abs(distance) < 45 || Math.abs(distance) <= verticalDistance) return;
      suppressReaderClick = true;
      window.setTimeout(() => { suppressReaderClick = false; }, 500);
      overlay._readerNavigate?.(distance < 0 ? 1 : -1);
    };
    const finishReaderSwipe = event => {
      activeReaderPointers.delete(event.pointerId);
      if (readerPanPointer && event.pointerId === readerPanPointer.pointerId) {
        readerPanPointer = null;
        body.classList.remove("reader-panning");
        body.releasePointerCapture?.(event.pointerId);
        event.preventDefault();
        return;
      }
      if (readerPinchStart) {
        if (activeReaderPointers.size < 2) {
          readerPinchStart = null;
          ignoreReaderClicksUntil = Date.now() + 600;
          body.classList.remove("reader-panning");
        }
        body.releasePointerCapture?.(event.pointerId);
        event.preventDefault();
        return;
      }
      const tap = readerTap;
      readerTap = null;
      if (tap && Math.hypot(event.clientX - tap.x, event.clientY - tap.y) < 20) {
        const now = Date.now();
        if (now - lastReaderTap < 320) {
          suppressReaderClick = true;
          toggleReaderZoom(readerZoomOriginAt(event.clientX, event.clientY));
          lastReaderTap = 0;
        } else {
          lastReaderTap = now;
        }
        readerSwipe = null;
        return;
      }
      if (!readerSwipe || event.pointerId !== readerSwipe.pointerId) return;
      event.preventDefault();
      body.releasePointerCapture?.(event.pointerId);
      const now = Date.now();
      if (event.pointerType !== "mouse" && now - lastReaderTap < 320) {
        readerSwipe = null;
        suppressReaderClick = true;
        toggleReaderZoom(readerZoomOriginAt(event.clientX, event.clientY));
        lastReaderTap = 0;
        return;
      }
      lastReaderTap = now;
      finishReaderSwipeAt(event.clientX, event.clientY);
    };
    const onReaderTouchStart = event => {
      if (!["single-page", "double-page"].includes(state.readingMode) || event.touches.length !== 1) return;
      if (readerZoom > 1) return;
      if (event.target.closest("button, a, select, textarea, input")) return;
      const touch = event.touches[0];
      readerSwipe = { pointerId: null, x: touch.clientX, y: touch.clientY };
    };
    const onReaderTouchMove = event => {
      if (readerZoom > 1 && readerPanPointer && event.touches.length === 1) {
        const touch = event.touches[0];
        readerPan = {
          x: readerPanPointer.startX + touch.clientX - readerPanPointer.x,
          y: readerPanPointer.startY + touch.clientY - readerPanPointer.y
        };
        body.style.setProperty("--reader-pan-x", `${readerPan.x}px`);
        body.style.setProperty("--reader-pan-y", `${readerPan.y}px`);
        event.preventDefault();
        return;
      }
      if (!readerSwipe || event.touches.length !== 1) return;
      const touch = event.touches[0];
      const dx = touch.clientX - readerSwipe.x;
      const dy = touch.clientY - readerSwipe.y;
      if (Math.abs(dx) > Math.abs(dy)) event.preventDefault();
    };
    const onReaderTouchEnd = event => {
      if (!readerSwipe) return;
      const touch = event.changedTouches[0];
      if (!touch) return;
      event.preventDefault();
      finishReaderSwipeAt(touch.clientX, touch.clientY);
    };
    const onReaderMouseDown = event => {
      if (event.button !== 0 || !["single-page", "double-page"].includes(state.readingMode)) return;
      if (readerZoom > 1) return;
      if (event.target.closest("button, a, select, textarea, input")) return;
      readerSwipe = { pointerId: null, x: event.clientX, y: event.clientY };
    };
    const onReaderMouseMove = event => {
      if (readerZoom > 1 && readerPanPointer) {
        readerPan = {
          x: readerPanPointer.startX + event.clientX - readerPanPointer.x,
          y: readerPanPointer.startY + event.clientY - readerPanPointer.y
        };
        body.style.setProperty("--reader-pan-x", `${readerPan.x}px`);
        body.style.setProperty("--reader-pan-y", `${readerPan.y}px`);
        event.preventDefault();
        return;
      }
      if (!readerSwipe) return;
      const dx = event.clientX - readerSwipe.x;
      const dy = event.clientY - readerSwipe.y;
      if (Math.abs(dx) > Math.abs(dy)) event.preventDefault();
    };
    const onReaderMouseUp = event => {
      if (!readerSwipe) return;
      event.preventDefault();
      finishReaderSwipeAt(event.clientX, event.clientY);
    };
    const cancelReaderSwipe = () => { readerSwipe = null; readerTap = null; readerPanPointer = null; body.classList.remove("reader-panning"); activeReaderPointers.clear(); readerPinchStart = null; };
    const preventReaderDrag = event => event.preventDefault();
    body.addEventListener("pointerdown", onReaderPointerDown);
    body.addEventListener("pointermove", onReaderPointerMove, { passive: false });
    body.addEventListener("pointerup", finishReaderSwipe);
    body.addEventListener("pointercancel", cancelReaderSwipe);
    body.addEventListener("dragstart", preventReaderDrag);
    body.addEventListener("touchstart", onReaderTouchStart, { passive: true });
    body.addEventListener("touchmove", onReaderTouchMove, { passive: false });
    body.addEventListener("touchend", onReaderTouchEnd, { passive: false });
    body.addEventListener("mousedown", onReaderMouseDown);
    document.addEventListener("mousemove", onReaderMouseMove, { passive: false });
    document.addEventListener("mouseup", onReaderMouseUp, { passive: false });
    removeReaderSwipeListeners = () => {
      body.removeEventListener("pointerdown", onReaderPointerDown);
      body.removeEventListener("pointermove", onReaderPointerMove);
      body.removeEventListener("pointerup", finishReaderSwipe);
      body.removeEventListener("pointercancel", cancelReaderSwipe);
      body.removeEventListener("dragstart", preventReaderDrag);
      body.removeEventListener("touchstart", onReaderTouchStart);
      body.removeEventListener("touchmove", onReaderTouchMove);
      body.removeEventListener("touchend", onReaderTouchEnd);
      body.removeEventListener("mousedown", onReaderMouseDown);
      document.removeEventListener("mousemove", onReaderMouseMove);
      document.removeEventListener("mouseup", onReaderMouseUp);
    };
    body.addEventListener("click", event => {
      const now = Date.now();
      if (now < ignoreReaderClicksUntil) {
        lastReaderClickAt = 0;
        return;
      }
      const isDoubleReaderClick = event.detail >= 2 || (now - lastReaderClickAt > 0 && now - lastReaderClickAt < 360);
      if (isDoubleReaderClick) {
        if (readerSingleClickTimer) {
          window.clearTimeout(readerSingleClickTimer);
          readerSingleClickTimer = null;
        }
        lastReaderClickAt = 0;
        if (suppressReaderClick) {
          suppressReaderClick = false;
          return;
        }
        toggleReaderZoom(readerZoomOriginAt(event.clientX, event.clientY));
        return;
      }
      lastReaderClickAt = now;
      if (suppressReaderClick) {
        suppressReaderClick = false;
        return;
      }
      if (event.target.closest("button, a, select, textarea")) {
        return;
      }
      if (readerSingleClickTimer) {
        window.clearTimeout(readerSingleClickTimer);
        readerSingleClickTimer = null;
        return;
      }
      readerSingleClickTimer = window.setTimeout(() => {
        readerSingleClickTimer = null;
        toggleReaderChrome();
      }, 280);
    });
    const onReaderKeydown = event => {
      if (["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName)) return;
      const direction = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1
        : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
      if (!direction) return;
      event.preventDefault();
      overlay._readerNavigate?.(direction);
    };
    document.addEventListener("keydown", onReaderKeydown);
    $("[data-close-reader]", overlay).addEventListener("click", () => document.removeEventListener("keydown", onReaderKeydown), { once: true });
    attachComments(item, overlay);
    body.classList.toggle("reader-grayscale", readerGrayscale);
    const seriesObserver = new MutationObserver(() => appendSeriesNavigation(item, controls, overlay));
    overlay._seriesObserver = seriesObserver;
    seriesObserver.observe(controls, { childList: true });
    appendSeriesNavigation(item, controls, overlay);
    $("[data-close-reader]", overlay).addEventListener("click", () => seriesObserver.disconnect(), { once: true });

    const directionButton = $("#reading-direction-btn", overlay);
    if (directionButton) {
      directionButton.onclick = () => {
        const newDirection = state.readingDirection === "western" ? "eastern" : "western";
        setReadingDirection(newDirection);
        directionButton.textContent = newDirection === "eastern" ? "↔ Oriental" : "↔ Ocidental";

        // If in double-page mode, re-render to apply the change
        if (state.readingMode === "double-page") {
          overlay._reopenReader?.({ skipCover });
        }
      };
    }


    const startReader = async () => {
      const isImage = ["jpg", "jpeg", "png", "webp", "gif"].includes(format);
      let selectedIndex = 0;
      if (!item.local && sourceCandidates.length && !isImage) {
        selectedIndex = -1;
        for (let index = 0; index < sourceCandidates.length; index += 1) {
          if (await probeReaderSource(sourceCandidates[index])) { selectedIndex = index; break; }
          if (index === 0) {
            const fallback = sourceCandidates[1] || "nenhuma fonte reserva cadastrada";
            await reportFileFailure(item, `A fonte principal falhou ao abrir. O leitor tentou uma fonte reserva: ${fallback}`, { silent: true, automatic: true, failedUrl: sourceCandidates[0], fallbackUrl: sourceCandidates[1] });
          }
        }
        if (selectedIndex < 0) {
          body.innerHTML = `<div class="empty" style="margin:auto;max-width:650px"><h3>Arquivo indisponível</h3><p>O MediaFire não encontrou esse arquivo ou o link expirou. Verifique a URL permanente da edição ou relate o problema aos moderadores.</p><button class="btn btn-primary" data-report-file>Relatar arquivo</button></div>`;
          controls.innerHTML = `<span class="reader-page">${escapeHTML(format.toUpperCase())}</span>`;
          $(`[data-report-file]`, body).onclick = () => reportFileFailure(item, "O arquivo não foi encontrado na fonte cadastrada.");
          return;
        }
        resolvedUrl = sourceCandidates[selectedIndex] || resolvedUrl;
      }
      const selectedFormat = String(item.format || format).toLowerCase();
      const callback = (...args) => { markReaderReady(); saveReadingProgress(...args); };
      if (selectedFormat === "pdf" || resolvedUrl.toLowerCase().split("?")[0].endsWith(".pdf")) {
        await renderPDFReader(item, resolvedUrl, body, controls, overlay, skipCover, resumePage, callback, selectedIndex === 0 ? prefetchedBuffer : null);
      } else if (selectedFormat === "cbz" || resolvedUrl.toLowerCase().split("?")[0].endsWith(".cbz")) {
        await renderCBZReader(item, resolvedUrl, body, controls, overlay, skipCover, resumePage, callback, selectedIndex === 0 ? prefetchedBuffer : null);
      } else if (selectedFormat === "cbr" || resolvedUrl.toLowerCase().split("?")[0].endsWith(".cbr")) {
        await renderCBRReader(item, resolvedUrl, body, controls, overlay, skipCover, resumePage, callback, selectedIndex === 0 ? prefetchedBuffer : null);
      }
    };
    if (format === "pdf" || format === "cbz" || format === "cbr") {
      void startReader().then(markReaderReady).catch(() => {});
    } else if (["jpg","jpeg","png","webp","gif"].includes(format)) {
      body.innerHTML = `<img class="reader-image" src="${escapeHTML(resolvedUrl)}" alt="" fetchpriority="high">`;
      const readerImage = $(".reader-image", body);
      if (readerImage) {
        readerImage.loading = "eager";
        readerImage.fetchPriority = "high";
        readerImage.addEventListener("error", async () => {
          if (sourceCandidates.length && readerImage.dataset.backupTried !== "true") {
            readerImage.dataset.backupTried = "true";
            const fallback = sourceCandidates[1] || "nenhuma fonte reserva cadastrada";
            await reportFileFailure(item, `A fonte principal da imagem falhou ao abrir. O leitor tentou uma fonte reserva: ${fallback}`, { silent: true, automatic: true, failedUrl: sourceCandidates[0], fallbackUrl: sourceCandidates[1] });
            if (sourceCandidates[1]) { readerImage.src = sourceCandidates[1]; return; }
          }
          body.innerHTML = `<div class="empty" style="margin:auto;max-width:650px"><h3>Não foi possível abrir esta imagem.</h3><p>O arquivo não abriu. Relate o problema aos moderadores do site para que ele seja verificado.</p><button class="btn btn-primary" data-report-file>Relatar arquivo</button></div>`;
          controls.innerHTML = `<span class="reader-page">Imagem</span>`;
          $("[data-report-file]", body).onclick = () => reportFileFailure(item, "A imagem não abriu no leitor.");
        }, { once: true });
      }
      controls.innerHTML = `<span class="reader-page">Imagem</span>`;
      markReaderReady();
      saveReadingProgress(item, 1, 1);
    } else if (item.seriesUrl && !item.fileUrl && !item.telegramUrl) {
      body.innerHTML = `
        <div class="empty" style="margin:auto;max-width:650px">
          <h3>Catálogo externo</h3>
          <p>Esta entrada possui metadados, mas ainda não possui o link individual do arquivo.</p>
          <button class="btn btn-primary" data-open-series>Abrir página da série</button>
        </div>`;
      $(`[data-open-series]`, body).onclick = () => window.open(item.seriesUrl, "_blank", "noopener");
      controls.innerHTML = `<span class="reader-page">LINK EXTERNO</span>`;
    } else {
      const title = "Formato não suportado no leitor";
      const message = `O formato "${escapeHTML(format.toUpperCase())}" não pôde ser aberto pelo leitor. Relate o problema aos moderadores do site para que o arquivo seja verificado.`;
      body.innerHTML = `
        <div class="empty" style="margin:auto;max-width:650px">
          <h3>${escapeHTML(title)}</h3>
          <p>${escapeHTML(message)}</p><button class="btn btn-primary" data-report-file>Relatar arquivo</button>
        </div>`;
      controls.innerHTML = `<span class="reader-page">${escapeHTML(format.toUpperCase())}</span>`;
      $("[data-report-file]", body).onclick = () => reportFileFailure(item, message);
    }
  }

