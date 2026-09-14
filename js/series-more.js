(() => {
  "use strict";

  const modalRoot = document.getElementById("modal-root");
  if (!modalRoot) return;

  const escapeHTML = value => String(value ?? "").replace(/[&<>'"]/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;"
  })[char]);

  function catalogItem(itemId) {
    const id = String(itemId || "");
    const sources = [
      ...(window.DEFAULT_LIBRARY || []),
      ...(window.PUBLISHED_CATALOG?.library || [])
    ];
    return sources.find(item => String(item?.id || "") === id) || null;
  }

  function editionCardFor(button) {
    return button.closest(".card-wrap")?.querySelector(":scope > .card") || null;
  }

  function upgradeSeriesModal(scope = modalRoot) {
    const modals = [];
    if (scope instanceof Element && scope.matches(".series-modal")) modals.push(scope);
    if (scope?.querySelectorAll) modals.push(...scope.querySelectorAll(".series-modal"));

    modals.forEach(modal => {
      // O "Sobre" dos cards é um controle separado (principalmente mobile) e
      // não pertence ao seletor de edições.
      modal.querySelectorAll(".card-wrap > .card-actions .card-about").forEach(button => button.remove());

      modal.querySelectorAll(".card-wrap > .card-actions .card-series").forEach(button => {
        if (button.dataset.seriesMoreBound === "true") return;
        const card = editionCardFor(button);
        const itemId = card?.dataset.open;
        if (!itemId) return;

        // Mantém o mesmo quarto lugar ocupado antes pelo botão Série.
        button.textContent = "Ver mais";
        button.title = "Ver mais";
        button.dataset.seriesMore = itemId;
        button.dataset.seriesMoreBound = "true";
        button.removeAttribute("data-view-series");
      });
    });
  }

  function openFallbackDetails(button) {
    const card = editionCardFor(button);
    const itemId = button.dataset.seriesMore;
    const item = catalogItem(itemId) || {};
    if (!card) return;

    const title = card.querySelector(".card-title")?.textContent?.trim()
      || item.title
      || item.seriesTitle
      || "Edição";
    const issue = card.querySelector(".cover-number")?.textContent?.trim() || item.issue || "";
    const type = String(item.type || "").toLowerCase() === "manga" ? "Mangá"
      : String(item.type || "").toLowerCase() === "comic" ? "Quadrinho"
      : "";
    const meta = [issue ? `Edição ${issue}` : "", type, item.year || ""].filter(Boolean).join(" · ");
    const description = item.description || "Esta edição está em destaque na Banca Digital.";
    const coverBackground = card.querySelector(".cover")?.style?.backgroundImage || "";

    const overlay = document.createElement("div");
    overlay.className = "modal-backdrop hero-details-backdrop";
    overlay.innerHTML = `<div class="modal hero-details-modal"><button class="small-btn hero-details-close" data-close aria-label="Fechar">×</button><div class="hero-details-copy"><div class="eyebrow">Destaque da banca</div><h2>${escapeHTML(title)}</h2>${meta ? `<div class="hero-details-meta">${escapeHTML(meta)}</div>` : ""}<p>${escapeHTML(description)}</p><div class="hero-details-actions"><button class="btn btn-primary" data-series-details-open>▶ Ler agora</button><button class="btn btn-secondary" data-close>Fechar</button></div></div><div class="hero-details-cover" data-series-details-open role="button" tabindex="0" aria-label="Ler ${escapeHTML(title)}"></div></div>`;
    const cover = overlay.querySelector(".hero-details-cover");
    if (coverBackground) cover.style.backgroundImage = coverBackground;

    modalRoot.appendChild(overlay);
    overlay.addEventListener("click", event => {
      if (event.target === overlay) overlay.remove();
    });
    overlay.querySelectorAll("[data-close]").forEach(close => {
      close.addEventListener("click", () => overlay.remove());
    });
    overlay.querySelectorAll("[data-series-details-open]").forEach(open => {
      const activate = () => {
        overlay.remove();
        card.click();
      };
      open.addEventListener("click", activate);
      open.addEventListener("keydown", event => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          activate();
        }
      });
    });
  }

  function openEditionDetails(button) {
    const itemId = button.dataset.seriesMore;
    if (!itemId) return;

    // Quando o destaque da home está no DOM, reutiliza literalmente o mesmo
    // handler do botão "Ver mais" já existente no app.
    const heroMore = [...document.querySelectorAll("[data-hero-about]")]
      .find(element => !element.closest(".series-modal"));
    if (heroMore) {
      const previousId = heroMore.dataset.heroAbout;
      heroMore.dataset.heroAbout = itemId;
      heroMore.click();
      heroMore.dataset.heroAbout = previousId;
      return;
    }

    // Em páginas sem o destaque montado (ex.: catálogo), reproduz o mesmo
    // popup e usa o próprio card do seletor para abrir a leitura.
    openFallbackDetails(button);
  }

  modalRoot.addEventListener("click", event => {
    const button = event.target.closest(".series-modal [data-series-more]");
    if (!button) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    openEditionDetails(button);
  }, true);

  const observer = new MutationObserver(mutations => {
    mutations.forEach(mutation => mutation.addedNodes.forEach(node => {
      if (node instanceof Element) upgradeSeriesModal(node);
    }));
  });
  observer.observe(modalRoot, { childList: true, subtree: true });
  upgradeSeriesModal();
})();
