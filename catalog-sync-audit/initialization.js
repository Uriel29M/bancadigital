    const startYear = startYearValue ? `<button type="button" class="series-card-year series-entity-link" data-entity-kind="year" data-entity-value="${escapeHTML(startYearValue)}">(${escapeHTML(startYearValue)})</button>` : "";
    const description = String(series.description || "");
    const descriptionTitle = description ? ` title="${escapeHTML(description)}"` : "";
    const mainCover = seriesCoverFor(item);
    const stackCovers = [editions[1], editions[2]].map(edition => edition ? seriesCoverFor(edition) : mainCover);
    const stackMarkup = stackCovers.map((cover, index) => `<div class="series-card-stack-cover series-card-stack-cover-${index + 1}" style="background-image:url('${escapeHTML(cover)}')"></div>`).join("");
    return `<article class="series-card" data-open-series="${escapeHTML(item.seriesId)}" tabindex="0"><div class="series-card-cover" data-series-cover-id="${escapeHTML(item.seriesId)}" data-cover-style-item="${escapeHTML(item.seriesId)}" data-cover-style="${escapeHTML(seriesCoverStyle)}" style="background-image:url('${escapeHTML(seriesCoverFor(item))}')"></div><div class="series-card-body"><div class="eyebrow">Série</div><h3 title="${escapeHTML(seriesName)}">${escapeHTML(seriesName)} ${startYear}</h3><p class="series-card-description"${descriptionTitle}>${escapeHTML(description)}</p><div class="series-card-meta">${entityButton("publisher", series.publisher)}${entityButton("publication", series.publication)}${entityButton("status", series.status)}</div><div class="series-card-footer"><span class="series-card-count">${escapeHTML(String(count))} edições</span><div class="series-card-footer-actions">${seriesCoverChoiceButton}${seriesCoverEffects}<button type="button" class="series-save-button ${saved ? "is-saved" : ""}" data-series-favorite="${escapeHTML(item.seriesId)}">${saved ? "★ Salva" : "☆ Salvar"}</button></div></div></div></article>`;
  }

  function handlePopState() {
    if (navigator.onLine === false && readerIsOpen) {
      // Mantém o leitor aberto durante uma queda de conexão, inclusive para
      // o botão físico e o gesto de voltar dos celulares.
      const readerUrl = state.readerItemId
        ? routeUrl({ ler: state.readerItemId })
        : routeUrl({ pagina: "downloads" });
      window.history.pushState({
        [ROUTE_HISTORY_KEY]: true,
        [ROUTE_HISTORY_INDEX_KEY]: currentRouteHistoryIndex() + 1,
        [OFFLINE_HISTORY_GUARD_KEY]: true,
      }, "", readerUrl);
      return;
    }
    // Sem internet, o usuário precisa permanecer na área que funciona
    // offline. Recolocamos a rota de Downloads na entrada atual do histórico
    // para absorver o voltar do navegador, o botão físico e o gesto mobile.
    if (navigator.onLine === false && state.session?.offline) {
      const downloadsUrl = routeUrl({ pagina: "downloads" });
      window.history.pushState({
        [ROUTE_HISTORY_KEY]: true,
        [ROUTE_HISTORY_INDEX_KEY]: currentRouteHistoryIndex() + 1,
        [OFFLINE_HISTORY_GUARD_KEY]: true,
      }, "", downloadsUrl);
      applyRoute();
      return;
    }
    applyRoute();
  }

  document.addEventListener("click", event => {
    const target = event.target;
    const overlay = target instanceof Element ? target.closest(".modal-backdrop") : null;
    if (overlay && target === overlay && $("#submission-form", overlay)) overlay.remove();
  });
  window.addEventListener("popstate", handlePopState);
  window.BancaDigital = { state, openReader, openAdmin };
  const appRoot = document.getElementById("app");
  const modalRoot = document.getElementById("modal-root");
  let modalScrollLock = null;
  ["pointerdown", "pointermove", "pointerup", "pointercancel"].forEach(type => {
    modalRoot?.addEventListener(type, event => event.stopPropagation(), true);
  });
  const preventBackgroundScroll = event => {
    if (!modalRoot?.children.length) return;
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest(".modal")) return;
    event.preventDefault();
  };
  document.addEventListener("wheel", preventBackgroundScroll, { passive: false });
  document.addEventListener("touchmove", preventBackgroundScroll, { passive: false });
  const syncModalInteractionState = () => {
    const hasOpenModal = Boolean(modalRoot?.children.length);
    document.body.classList.toggle("modal-open", hasOpenModal);
    document.documentElement.classList.toggle("modal-open", hasOpenModal);
    if (appRoot) {
      appRoot.inert = hasOpenModal;
    }
    if (hasOpenModal && !modalScrollLock) {
      const scrollY = window.scrollY;
      modalScrollLock = {
        scrollY,
        position: document.body.style.position,
        top: document.body.style.top,
        width: document.body.style.width,
        overflow: document.body.style.overflow,
      };
      document.body.style.position = "fixed";
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = "100%";
      document.body.style.overflow = "hidden";
    } else if (!hasOpenModal && modalScrollLock) {
      const lock = modalScrollLock;
      modalScrollLock = null;
      document.body.style.position = lock.position;
      document.body.style.top = lock.top;
      document.body.style.width = lock.width;
      document.body.style.overflow = lock.overflow;
      window.scrollTo(0, lock.scrollY);
    }
  };
  if (modalRoot && "MutationObserver" in window) {
    new MutationObserver(records => {
      records.forEach(record => [...record.addedNodes].forEach(node => {
        if (node.nodeType === Node.ELEMENT_NODE) prepareLazyImages(node);
      }));
      syncModalInteractionState();
    }).observe(modalRoot, { childList: true, subtree: true });
  }
  syncModalInteractionState();
  const pathParts = window.location.pathname.split("/").filter(Boolean);
  if (!window.history.state?.[ROUTE_HISTORY_KEY]) {
    window.history.replaceState({
      ...(window.history.state || {}),
      [ROUTE_HISTORY_KEY]: true,
      [ROUTE_HISTORY_INDEX_KEY]: 0,
    }, "", window.location.href);
  }
  // O site pode ser servido na raiz ou por uma pasta do GitHub Pages. Essas
  // pastas não são nomes de usuário e não devem abrir o perfil público.
  const siteBasePaths = new Set(["banca-digital-quadrinhos-v3", "bancadigital", "banca-digital"]);
  const routeParts = siteBasePaths.has(pathParts[0]?.toLowerCase()) ? pathParts.slice(1) : pathParts;
  const queryProfile = new URLSearchParams(window.location.search).get("perfil");
  const queryPublicCollection = new URLSearchParams(window.location.search).get("lista");
  const queryTop10List = new URLSearchParams(window.location.search).get("lista_top10");
  const legacyShelfRoute = new URLSearchParams(window.location.search).get("pagina") === "estante";
  const initialPublicUsername = queryProfile
    ? cleanUsername(queryProfile)
    : routeParts.length === 1 && routeParts[0].toLowerCase() !== "index.html"
      ? cleanUsername(decodeURIComponent(routeParts[0]))
      : "";
  if (initialPublicUsername && /^[a-z0-9_]{3,24}$/.test(initialPublicUsername)) {
    state.section = "public-profile";
    state.publicProfile = { loading: true, username: initialPublicUsername, collectionId: queryPublicCollection, top10ListId: queryTop10List, album: new URLSearchParams(window.location.search).get("album") === "1" };
  } else if (legacyShelfRoute) {
    // Evita que a rota antiga pisque a home enquanto a sessão é recuperada.
    state.section = "public-profile";
    state.publicProfile = { loading: true, username: "" };
  }
  const bootOfflineAccount = readOfflineAccount();
  if (!initialPublicUsername && navigator.onLine === false && bootOfflineAccount?.user) {
    state.session = { user: bootOfflineAccount.user, offline: true };
    state.profile = offlineProfileFor(bootOfflineAccount.user, bootOfflineAccount.profile, bootOfflineAccount.username);
    loadDownloads();
    state.section = "downloads";
    armOfflineHistoryGuard();
    render();
  } else if (initialPublicUsername) render();
  else applyRoute();
  syncTopAvatar();
  // Busca somente o perfil básico em paralelo ao bootstrap da conta, para que
  // a rota pública não fique bloqueada pelas consultas globais do aplicativo.
  const earlyPublicProfileLoad = initialPublicUsername && sb
    ? loadPublicProfile(initialPublicUsername, queryPublicCollection, new URLSearchParams(window.location.search).get("album") === "1", { basicOnly: true, top10ListId: queryTop10List })
      .catch(error => console.warn("Perfil público inicial indisponível:", error))
    : null;
  const warmLibarchive = () => loadLibarchiveModule().catch(error => console.warn("Biblioteca CBR indisponível:", error));
  // A biblioteca é pequena perto dos arquivos CBR e precisa estar pronta
  // antes do primeiro clique para não competir com o download.
  warmLibarchive();
  loadComicReadCounts()
    .then(() => { if (state.section !== "reader") render(); })
    .catch(error => console.warn("Contadores de leitura indisponíveis:", error));
  loadComicDownloadCounts()
    .then(() => { if (state.section !== "reader") render(); })
    .catch(error => console.warn("Contadores de download indisponíveis:", error));
  loadComicMonthlyReadCounts()
    .then(() => { if (state.section !== "reader") render(); })
    .catch(error => console.warn("Leituras mensais indisponíveis:", error));
  loadHomepageSettings()
    .then(() => { if (state.section === "home" || state.section === "comics") render(); })
    .catch(error => console.warn("Ordem da página inicial indisponível:", error));
  loadHomepageBanners()
    .then(() => { if (state.section === "home") render(); })
    .catch(error => console.warn("Banners da home indisponíveis:", error));
  sb?.auth.onAuthStateChange((event, session) => {
    if (event === "PASSWORD_RECOVERY") {
      state.session = session;
      state.section = "password-reset";
      render();
    }
  });
  let reconnecting = false;
  let forcedOfflineDownloads = false;
  window.addEventListener("online", async () => {
    if (!state.session?.offline || reconnecting) return;
    reconnecting = true;
    try {
      if (!sb) {
        // A página pode ter sido aberta sem carregar o cliente Supabase.
        // Recarregar online permite que o script externo seja carregado e a
        // sessão volte ao fluxo normal, em vez de reativar o modo offline.
        window.setTimeout(() => window.location.reload(), 100);
        return;
      }
      const refreshed = await sb.auth.refreshSession();
      if (!refreshed.error && refreshed.data?.session) {
        sb.auth.startAutoRefresh?.();
        await loadAccount();
        pumpDownloadQueue();
        if (forcedOfflineDownloads) {
          forcedOfflineDownloads = false;
          navigate({}, true);
        }
      }
    } catch (error) {
      console.warn("Não foi possível retomar a sessão online:", error);
    } finally {
      reconnecting = false;
    }
  });
  window.addEventListener("offline", () => {
    if (state.session) {
      if (readerIsOpen) {
        // Atualiza o estado offline sem trocar a rota enquanto o leitor está aberto.
        activateOfflineMode();
        return;
      }
      forcedOfflineDownloads = true;
      navigate({ pagina: "downloads" }, true);
      armOfflineHistoryGuard();
    }
  });
  const accountBootstrap = initialPublicUsername
    ? Promise.race([
      loadAccount(),
      new Promise((_, reject) => window.setTimeout(() => reject(new Error("Account bootstrap timeout")), 15000))
    ])
    : loadAccount();
  accountBootstrap
    .then(async () => {
      if (state.section === "reader" && !activeReaderCleanup) applyRoute();
      if (!initialPublicUsername && new URLSearchParams(window.location.search).get("pagina") === "estante") applyRoute();
      if (initialPublicUsername) await loadPublicProfile(initialPublicUsername, queryPublicCollection, new URLSearchParams(window.location.search).get("album") === "1", { top10ListId: queryTop10List });
      pumpDownloadQueue();
    })
    .catch(error => console.warn("Supabase indisponível:", error))
    .then(async () => {
      if (!initialPublicUsername || !state.publicProfile?.loading) return;
      try {
        await loadPublicProfile(initialPublicUsername, queryPublicCollection, new URLSearchParams(window.location.search).get("album") === "1", { top10ListId: queryTop10List });
      } catch (error) {
        console.warn("Public profile load failed:", error);
        state.publicProfile = { error: "Não foi possível carregar este perfil agora.", username: initialPublicUsername };
        render();
      }
    })
    .finally(() => {
      if (appRoot) appRoot.style.visibility = "";
    });
})();
