  function render() {
    const isBlogTheme = state.section === "blog";
    document.querySelector(".topbar")?.classList.toggle("is-offline", Boolean(state.session?.offline));
    const factionsNav = document.querySelector('.nav-link[data-section="factions"]');
    if (factionsNav) factionsNav.style.display = "";
    document.body.classList.toggle("blogs-theme", isBlogTheme);
    const brandLogo = document.querySelector(".brand-logo");
    const brandName = document.querySelector(".brand > span:last-child");
    const footerTitle = document.querySelector(".footer > div:first-child > strong");
    const footerDescription = document.querySelector(".footer > div:first-child > span");
    if (brandLogo) {
      brandLogo.src = isBlogTheme ? "assets/bobojacoicon.png?v=1" : "assets/barracabrancaicon.png?v=1";
      brandLogo.alt = isBlogTheme ? "Bobojaco" : "Banca Digital";
    }
    if (brandName) brandName.innerHTML = isBlogTheme ? 'Bobo<span class="brand-accent">jaco</span>' : 'Banca<span class="brand-accent">Digital</span>';
    if (footerTitle) footerTitle.textContent = isBlogTheme ? "Bobojaco" : "Banca Digital";
    if (footerDescription) footerDescription.textContent = isBlogTheme
      ? "Um espaço para publicar, descobrir e conversar sobre histórias."
      : "Uma biblioteca de quadrinhos feita para a era digital.";
    document.title = isBlogTheme ? "Bobojaco — Blogs" : "Banca Digital — Quadrinhos & Mangás";
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) metaDescription.content = isBlogTheme
      ? "Bobojaco: um espaço para publicar, descobrir e conversar sobre histórias."
      : "Uma banca digital para descobrir, pesquisar e ler quadrinhos e mangás.";
    const favicon = document.querySelector('link[rel="icon"]');
    if (favicon) favicon.href = "assets/barracavermelhaicon.png?v=2";
    const appleIcon = document.querySelector('link[rel="apple-touch-icon"]');
    if (appleIcon) appleIcon.href = isBlogTheme ? "assets/bobojacoicon.png?v=1" : "assets/barracabrancaicon.png?v=1";
    const main = $("#main");
    let markup = "";
    if (state.section === "home") markup = renderHome();
    else if (state.section === "comic") markup = renderCatalog("comic");
    else if (state.section === "blog") markup = renderBlogsPage();
    else if (state.section === "ranking") markup = renderRankingPage();
    else if (state.section === "factions") markup = state.factionMembersView ? renderFactionMembersPage() : renderFactionPage();
    else if (state.section === "manga") markup = renderCatalog("manga");
    else if (state.section === "collections") markup = renderCollections();
    else if (state.section === "collection") markup = renderCollectionPage();
    else if (state.section === "search") markup = renderSearch();
    else if (state.section === "entity") markup = renderEntityPage();
    else if (state.section === "login") markup = renderLoginPage();
    else if (state.section === "signup") markup = renderSignupPage();
    else if (state.section === "downloads") markup = renderDownloadsPage();
    else if (state.section === "local-box") markup = renderLocalBoxPage();
    else if (state.section === "album") markup = canAccessStickerAlbum() ? stickerAlbumMarkup(state.profile, state.stickerAwards, { isOwn: true }) : '<div class="content"><div class="empty">É preciso criar uma conta para usar o álbum.</div></div>';
    else if (state.section === "public-profile") markup = renderPublicProfilePage();
    else if (state.section === "password-reset") markup = renderPasswordResetPage();
    if (state.section === "entity") markup = markup.replace(/<section class="section character-news-section"[\s\S]*?<\/section>/i, "");
    if (state.section === "factions") markup = markup.replace(/blogs?/gi, "atividades");
    applyProfileTheme(state.section === "public-profile" ? state.publicProfile?.profile : ["shelf", "album"].includes(state.section) ? state.profile : null);
    // A estante recebe abas e o Top 10 depois da renderização inicial. Por isso,
    // comparar apenas o HTML base pode esconder alterações nos itens do ranking.
    const hasDynamicShelfContent = ["shelf", "public-profile"].includes(state.section);
    if (main.innerHTML === markup && !hasDynamicShelfContent) {
      syncActiveNav();
      return;
    }
    main.innerHTML = markup;
    applyProfileTheme(state.section === "public-profile" ? state.publicProfile?.profile : ["shelf", "album"].includes(state.section) ? state.profile : null);
    $$('[data-wiki-character]', main).forEach(button => button.addEventListener("click", () => openEntityPage("character", button.dataset.wikiCharacter)));
    $$('[data-wiki-toggle]', main).forEach(button => button.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      toggleWikiQuick(button);
    }));
    bind();
    bindFixedShelfSectionControls();
    $$('[data-home-section-move]', main).forEach(button => button.addEventListener("click", () => moveHomepageSection(button.dataset.homeSectionKey, button.dataset.homeSectionMove === "up" ? -1 : 1)));
    $$('[data-home-section-visibility]', main).forEach(button => button.addEventListener("click", () => toggleHomepageSectionVisibility(button.dataset.homeSectionKey, button.dataset.homeSectionVisibility === "hide")));
    bindComicSectionControls();
    hydrateHomeCovers();
    prepareLazyImages(main);
    decorateFactionNames(main);
    hydrateCommentLinkPreviews(main);
    observeCommentLinkPreviews();
    hydrateFactionRoleTitles(main);
    if (state.section === "entity" && state.entityFilter?.kind !== "year" && !["Série Mensal", "Recentes", "Vários autores"].some(value => value.toLowerCase() === String(state.entityFilter.value || "").trim().toLowerCase())) {
      loadWikiQuickInfo(state.entityFilter.value, state.entityFilter.kind);
    }
    if (state.section === "entity" && state.entityFilter?.kind === "publisher") loadPublisherFans(state.entityFilter.value);
    // Aguarda as configurações remotas dos personagens para que uma imagem
    // personalizada nunca seja substituída momentaneamente pela Wikipédia.
    if (state.authReady && (state.section === "comic" || state.section === "shelf" || state.section === "public-profile" || (state.section === "entity" && ["publisher", "imprint", "character"].includes(state.entityFilter?.kind)))) {
      loadCharacterWikiCarousel();
    }
  }

