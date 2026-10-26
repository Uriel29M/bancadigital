(() => {
  "use strict";

  const main = document.getElementById("main");
  if (!main || !window.BANCA_SUPABASE_URL || !window.BANCA_SUPABASE_KEY) return;

  const TITLE_ALIASES = [
    ["recommendations", ["escolhas da banca", "recomendacoes da banca"]],
    ["character-banner", ["personagens em destaque", "personagem em destaque", "herois em destaque"]],
    ["continue", ["continue lendo", "continuar lendo", "continue de onde parou"]],
    ["recent", ["adicionados recentemente", "adicionados agora", "recentemente adicionados"]],
    ["new-series", ["novas series", "series novas"]],
    ["monthly", ["destaques do mes", "destaques deste mes"]],
    ["pinned-publishers", ["selos fixados", "editoras e selos fixados", "selos em destaque"]],
    ["best-series", ["melhores series", "series mais bem avaliadas"]],
    ["featured-collections", ["colecoes em destaque", "colecoes da banca"]],
    ["random", ["surpreenda-me", "surpreenda me", "descubra algo novo"]],
    ["tips", ["dicas", "dicas de leitura"]],
    ["artist", ["artista em destaque", "artista"]],
    ["random-publisher", ["editora aleatoria", "selo aleatorio"]],
    ["downloads", ["downloads", "suas edicoes baixadas"]],
    ["most-read-covers", ["capas mais lidas", "mais lidas"]],
    ["editorial-banner", ["banner editorial", "destaque editorial"]]
  ];
  const SECTION_TITLES = Object.fromEntries(TITLE_ALIASES.map(([key, aliases]) => [key, aliases[0]]));
  const KEY_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

  const style = document.createElement("style");
  style.textContent = [
    ".section-page-transfer-host{display:contents}",
    ".section-page-transfer-button{flex:0 0 auto;min-width:32px;padding:5px 8px;line-height:1.2;white-space:nowrap}",
    ".section-page-transfer-button:disabled{opacity:.55;cursor:wait}",
    "@media(max-width:600px){.section-page-transfer-button{min-width:30px;padding:5px 7px}}"
  ].join("");
  document.head.appendChild(style);

  let client = null;
  let sectionPages = {};
  let syncing = false;
  let bootstrapping = false;
  const sectionTemplates = new Map();
  const sectionOrigins = new Map();
  let templateOrder = [];

  function normalize(value) {
    return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase("pt-BR").replace(/\s+/g, " ").trim();
  }

  function pageFromRoute() {
    const url = new URL(window.location.href);
    const query = normalize(url.searchParams.get("pagina") || "");
    if (["quadrinhos", "comic", "comics"].includes(query)) return "comic";
    if (["inicio", "inicial", "home", ""].includes(query)) {
      const path = normalize(url.pathname.split("/").filter(Boolean).pop() || "");
      if (["quadrinhos", "comic", "comics"].includes(path)) return "comic";
      return "home";
    }
    const path = normalize(url.pathname.split("/").filter(Boolean).pop() || "");
    if (["quadrinhos", "comic", "comics"].includes(path)) return "comic";
    if (["inicio", "inicial", "home", "index.html"].includes(path)) return "home";
    return null;
  }

  function currentPage() {
    const current = window.BancaDigital && window.BancaDigital.state
      ? String(window.BancaDigital.state.section || "") : "";
    if (current === "home") return "home";
    if (current === "comic" || current === "comics") return "comic";

    const active = document.querySelector('.topbar [data-section].active');
    if (active) {
      if (active.dataset.section === "home") return "home";
      if (active.dataset.section === "comics" || active.dataset.section === "comic") return "comic";
    }
    return pageFromRoute();
  }

  function clientCandidate() {
    const candidates = [
      window.BancaDigital && window.BancaDigital.supabase,
      window.BancaDigital && window.BancaDigital.sb,
      window.BancaDigital && window.BancaDigital.client,
      window.bancaSupabase,
      window.sb
    ];
    return candidates.find(candidate => candidate && typeof candidate.from === "function"
      && typeof candidate.rpc === "function") || null;
  }

  function getClient() {
    if (client) return client;
    client = clientCandidate();
    if (!client && window.supabase && typeof window.supabase.createClient === "function") {
      client = window.supabase.createClient(window.BANCA_SUPABASE_URL, window.BANCA_SUPABASE_KEY);
    }
    return client;
  }

  function showToast(message) {
    const appToast = window.BancaDigital && window.BancaDigital.toast;
    if (typeof appToast === "function") {
      try { appToast(message); return; } catch (_) {}
    }
    const root = document.getElementById("toast-root");
    if (!root) return;
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.setAttribute("role", "status");
    toast.textContent = message;
    root.appendChild(toast);
    window.setTimeout(() => toast.remove(), 3600);
  }

  function loadSettings() {
    const supabaseClient = getClient();
    if (!supabaseClient) return Promise.resolve();
    return supabaseClient.from("homepage_settings").select("section_pages")
      .eq("id", true).maybeSingle()
      .then(({ data, error }) => {
        if (error) throw error;
        const result = data && data.section_pages && typeof data.section_pages === "object"
          && !Array.isArray(data.section_pages) ? data.section_pages : {};
        sectionPages = {};
        Object.keys(result).forEach(key => {
          if (KEY_RE.test(key) && ["home", "comic"].includes(result[key])) sectionPages[key] = result[key];
        });
      })
      .catch(error => console.warn("[Banca] Não foi possível carregar os destinos das seções.", error));
  }

  function titleText(head) {
    const element = head && head.querySelector(".section-title, h1, h2, h3, [data-section-title], .section-head > div:first-child");
    if (!element) return "";
    const heading = element.matches(".section-head > div:first-child")
      ? element.querySelector("h1, h2, h3, .section-title, [data-section-title]") || element
      : element;
    const clone = heading.cloneNode(true);
    clone.querySelectorAll("button, .section-subtitle, small, .badge, .count, [aria-hidden='true']").forEach(node => node.remove());
    return clone.textContent.replace(/\s+/g, " ").trim();
  }

  function safeSlug(value) {
    return normalize(value).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 70);
  }

  function keyFromTitle(value) {
    const title = normalize(value);
    for (const [key, aliases] of TITLE_ALIASES) {
      if (aliases.some(alias => title === normalize(alias) || title.startsWith(normalize(alias) + " "))) return key;
    }
    return "";
  }

  function keyFromAttributes(root, head) {
    for (const node of [root, head]) {
      if (!node || !node.dataset) continue;
      const value = node.dataset.homeSectionKey;
      if (value && KEY_RE.test(value)) return value;
    }
    return "";
  }

  function rootForHead(head) {
    let fallback = head.parentElement;
    for (let node = head.parentElement; node && node !== main; node = node.parentElement) {
      const count = node.querySelectorAll(".section-head").length;
      if (count > 1) break;
      fallback = node;
      const sectionLike = node.tagName === "SECTION" || node.classList.contains("section")
        || node.classList.contains("home-section") || node.classList.contains("homepage-section")
        || node.classList.contains("publisher-carousel-section")
        || node.hasAttribute("data-home-section-key") || node.hasAttribute("data-section-key");
      if (sectionLike && count === 1) return node;
    }
    return fallback || head;
  }

  function collectSections(page) {
    const records = [];
    const seenRoots = new Set();
    const seenKeys = new Set();
    const heads = Array.from(main.querySelectorAll(".section-head"));
    for (let index = 0; index < heads.length; index++) {
      const head = heads[index];
      if (head.closest(".section-page-transfer-host, [data-section-page-transfer-clone='true']")) continue;
      const title = titleText(head);
      if (!title) continue;
      const root = rootForHead(head);
      if (!root || root === main || seenRoots.has(root)) continue;

      const explicitKey = root.dataset.sectionPageTransferKey || head.dataset.sectionPageTransferKey;
      let key = explicitKey || keyFromAttributes(root, head);
      if (!key) {
        const known = page === "home" ? keyFromTitle(title) : "";
        const slug = safeSlug(title) || "section-" + (index + 1);
        key = known || (page + "-" + slug);
      }
      if (!KEY_RE.test(key)) continue;
      if (seenKeys.has(key)) {
        let suffix = 2;
        const base = key + "-" + (index + 1);
        key = base;
        while (seenKeys.has(key)) key = base + "-" + suffix++;
      }
      seenRoots.add(root);
      seenKeys.add(key);
      records.push({ key, root, head, title, page });
    }
    return records;
  }

  function isSectionControl(button) {
    const content = (button.textContent || "").replace(/\s+/g, " ").trim();
    if (/[↑↓⊘]/.test(content)) return true;
    const label = normalize((button.getAttribute("aria-label") || "") + " " + (button.getAttribute("title") || ""));
    return /mover.*(para cima|para baixo)|subir secao|descer secao|ocultar secao|esconder secao/.test(label);
  }

  function managedControls(head) {
    return Array.from(head.querySelectorAll("button")).filter(button =>
      !button.hasAttribute("data-section-page-transfer-key") && isSectionControl(button));
  }

  function otherPage(page) {
    return page === "comic" ? "home" : "comic";
  }

  function pageLabel(page) {
    return page === "comic" ? "Quadrinhos" : "Inicial";
  }

  function actualPageFor(key, defaultPage) {
    return sectionPages[key] || defaultPage;
  }

  function makeTransferButton(record, displayPage, className) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = ((className || "small-btn") + " section-page-transfer-button").trim();
    button.textContent = "⇄";
    button.dataset.sectionPageTransferKey = record.key;
    button.title = "Enviar “" + record.title + "” para " + pageLabel(otherPage(displayPage));
    button.setAttribute("aria-label", button.title);
    return button;
  }

  function ensureTransferButton(record) {
    const head = record.head;
    const existing = head.querySelector('button[data-section-page-transfer-key="' + record.key + '"]');
    if (existing) {
      existing.title = "Enviar “" + record.title + "” para " + pageLabel(otherPage(record.page));
      existing.setAttribute("aria-label", existing.title);
      return existing;
    }

    const controls = managedControls(head);
    const button = makeTransferButton(record, record.page, controls[0] && controls[0].className);
    const last = controls[controls.length - 1];
    if (last && last.parentElement && controls.every(item => item.parentElement === last.parentElement)) {
      last.insertAdjacentElement("afterend", button);
    } else {
      head.appendChild(button);
    }
    return button;
  }

  function cacheTemplate(record) {
    if (!record || !KEY_RE.test(record.key)) return;
    const clone = record.root.cloneNode(true);
    clone.setAttribute("data-section-page-transfer-clone", "true");
    clone.dataset.sectionPageTransferKey = record.key;
    const cloneHead = clone.querySelector(".section-head");
    if (cloneHead) {
      const oldButtons = Array.from(cloneHead.querySelectorAll("button[data-section-page-transfer-key]"));
      const oldControls = managedControls(cloneHead);
      const reference = oldControls[0] || oldButtons[0];
      const parent = reference?.parentElement || cloneHead;
      const buttonClass = reference && reference.className;
      oldButtons.forEach(button => button.remove());
      oldControls.forEach(button => button.remove());
      const button = makeTransferButton(record, otherPage(record.page), buttonClass);
      if (parent && cloneHead.contains(parent)) parent.appendChild(button);
      else cloneHead.appendChild(button);
    }
    sectionTemplates.set(record.key, clone);
    sectionOrigins.set(record.key, record.page);
    if (!templateOrder.includes(record.key)) templateOrder.push(record.key);
  }

  function renderMovedSections(destinationPage) {
    const hostClass = "section-page-transfer-host";
    let host = Array.from(main.children).find(child =>
      child.classList.contains(hostClass) && child.dataset.sectionPage === destinationPage);
    const wanted = templateOrder.filter(key =>
      sectionTemplates.has(key) && sectionOrigins.get(key) !== destinationPage
      && actualPageFor(key, sectionOrigins.get(key)) === destinationPage);

    Array.from(main.children).filter(child => child.classList.contains(hostClass)
      && child.dataset.sectionPage !== destinationPage).forEach(child => child.remove());

    if (!wanted.length) {
      if (host) host.remove();
      return;
    }
    if (!host) {
      host = document.createElement("div");
      host.className = hostClass;
      host.dataset.sectionPage = destinationPage;
      host.setAttribute("aria-label", "Seções transferidas para " + pageLabel(destinationPage));
      main.insertBefore(host, main.firstChild);
    }
    host.replaceChildren(...wanted.map(key => sectionTemplates.get(key).cloneNode(true)));
  }

  function sync() {
    if (syncing || bootstrapping) return;
    const page = currentPage();
    if (!page) return;

    syncing = true;
    try {
      const records = collectSections(page);
      for (const record of records) {
        const assignedPage = actualPageFor(record.key, page);
        ensureTransferButton(record);
        if (!sectionTemplates.has(record.key) || assignedPage === page) cacheTemplate(record);
        if (assignedPage !== page) record.root.remove();
      }
      renderMovedSections(page);
    } finally {
      syncing = false;
    }
  }

  function nextFrame() {
    return new Promise(resolve => window.requestAnimationFrame(() => resolve()));
  }

  async function waitForSections(expectedPage, maxFrames = 90) {
    for (let attempt = 0; attempt < maxFrames; attempt++) {
      await nextFrame();
      if (currentPage() === expectedPage && collectSections(expectedPage).length) return true;
    }
    return false;
  }

  async function bootstrapFromHome() {
    const homeButton = document.querySelector('.topbar [data-section="home"]');
    const comicButton = document.querySelector('.topbar [data-section="comics"]');
    if (!homeButton || !comicButton || currentPage() !== "comic") return false;

    bootstrapping = true;
    try {
      // Capture the native Quadrinhos sections before navigating away. This is
      // essential when the page is opened directly with saved transfers to Inicial.
      const comicRecords = collectSections("comic");
      comicRecords.forEach(record => {
        ensureTransferButton(record);
        if (!sectionTemplates.has(record.key)) cacheTemplate(record);
      });
      homeButton.click();
      if (!await waitForSections("home")) return false;
      const records = collectSections("home");
      records.forEach(record => {
        ensureTransferButton(record);
        cacheTemplate(record);
      });
      templateOrder = records.map(record => record.key).concat(templateOrder.filter(key => !records.some(record => record.key === key)));
      comicButton.click();
      await waitForSections("comic");
    } catch (error) {
      console.warn("[Banca] Não foi possível preparar seções transferidas.", error);
      return false;
    } finally {
      bootstrapping = false;
    }
    return true;
  }

  async function bootstrapComicSectionsOnHome() {
    const homeButton = document.querySelector('.topbar [data-section="home"]');
    const comicButton = document.querySelector('.topbar [data-section="comics"]');
    if (!homeButton || !comicButton || currentPage() !== "home") return false;

    bootstrapping = true;
    try {
      comicButton.click();
      if (!await waitForSections("comic")) return false;
      const records = collectSections("comic");
      records.forEach(record => {
        ensureTransferButton(record);
        cacheTemplate(record);
      });
      templateOrder = templateOrder.filter(key => !records.some(record => record.key === key))
        .concat(records.map(record => record.key));
      homeButton.click();
      await waitForSections("home");
    } catch (error) {
      console.warn("[Banca] Não foi possível recuperar seções transferidas para Inicial.", error);
      return false;
    } finally {
      bootstrapping = false;
    }
    return true;
  }

  async function transferSection(button) {
    const key = button.dataset.sectionPageTransferKey;
    if (!KEY_RE.test(key || "")) return;
    const page = currentPage();
    if (page !== "home" && page !== "comic") return;
    const destination = otherPage(page);
    const root = button.closest("[data-section-page-transfer-clone='true']")
      || rootForHead(button.closest(".section-head") || button.parentElement);
    const head = root && root.querySelector(".section-head");
    const title = titleText(head) || SECTION_TITLES[key] || "Seção";

    if (root && head && !sectionTemplates.has(key)) {
      const origin = root.closest(".section-page-transfer-host")?.dataset.sectionPage === "home"
        ? "comic" : root.closest(".section-page-transfer-host")?.dataset.sectionPage === "comic" ? "home" : page;
      cacheTemplate({ key, root, head, title, page: origin });
    }

    const supabaseClient = getClient();
    if (!supabaseClient) {
      showToast("Não foi possível conectar para mover a seção.");
      return;
    }

    button.disabled = true;
    try {
      const { error } = await supabaseClient.rpc("update_homepage_section_page", {
        p_section_key: key,
        p_page: destination
      });
      if (error) throw error;

      sectionPages[key] = destination;
      sync();
      showToast("“" + title + "” enviada para " + pageLabel(destination) + ".");
    } catch (error) {
      console.error("[Banca] Não foi possível mover a seção.", error);
      showToast("Não foi possível mover a seção. Confira sua conexão e suas permissões.");
    } finally {
      button.disabled = false;
      button.title = "Enviar “" + title + "” para " + pageLabel(destination);
      button.setAttribute("aria-label", button.title);
    }
  }

  document.addEventListener("click", event => {
    const button = event.target instanceof Element
      ? event.target.closest("button[data-section-page-transfer-key]") : null;
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    transferSection(button);
  }, true);

  async function init() {
    await loadSettings();

    const observer = new MutationObserver(records => {
      if (bootstrapping || syncing) return;
      const changed = records.some(record => {
        const target = record.target instanceof Element ? record.target : record.target.parentElement;
        return !target?.closest(".section-page-transfer-host");
      });
      if (changed) sync();
    });
    observer.observe(main, { childList: true, subtree: true });

    if (currentPage() === "comic") {
      const nativeSections = collectSections("comic");
      const hasMovedSections = Object.keys(sectionPages).length > 0;
      if (!nativeSections.length || hasMovedSections) await bootstrapFromHome();
    } else if (currentPage() === "home" && Object.entries(sectionPages)
      .some(([key, destination]) => key.startsWith("comic-") && destination === "home")) {
      await bootstrapComicSectionsOnHome();
    }
    sync();

    document.addEventListener("click", event => {
      const target = event.target instanceof Element
        ? event.target.closest('.topbar [data-section], [data-mobile-section]') : null;
      if (!target) return;
      const requested = target.dataset.section || target.dataset.mobileSection;
      if (!["home", "comics", "comic"].includes(requested)) return;
      window.setTimeout(async () => {
        if (currentPage() === "comic" && !sectionTemplates.size) await bootstrapFromHome();
        sync();
      }, 120);
    }, true);

    window.addEventListener("focus", async () => {
      await loadSettings();
      sync();
    });
    document.addEventListener("visibilitychange", async () => {
      if (document.visibilityState !== "visible") return;
      await loadSettings();
      sync();
    });
  }

  init();
})();