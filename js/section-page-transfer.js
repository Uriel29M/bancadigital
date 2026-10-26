(() => {
  "use strict";

  const main = document.getElementById("main");
  if (!main || !window.BANCA_SUPABASE_URL || !window.BANCA_SUPABASE_KEY) return;

  const SECTION_KEYS = [
    "recommendations", "character-banner", "continue", "recent", "new-series",
    "monthly", "pinned-publishers", "best-series", "featured-collections",
    "random", "tips", "artist", "random-publisher", "downloads",
    "most-read-covers", "editorial-banner"
  ];
  const SECTION_KEY_SET = new Set(SECTION_KEYS);
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
  const SECTION_TITLES = {
    recommendations: "Escolhas da banca",
    "character-banner": "Personagens em destaque",
    continue: "Continue lendo",
    recent: "Adicionados recentemente",
    "new-series": "Novas séries",
    monthly: "Destaques do mês",
    "pinned-publishers": "Selos fixados",
    "best-series": "Melhores séries",
    "featured-collections": "Coleções em destaque",
    random: "Surpreenda-me",
    tips: "Dicas",
    artist: "Artista em destaque",
    "random-publisher": "Editora aleatória",
    downloads: "Downloads",
    "most-read-covers": "Capas mais lidas",
    "editorial-banner": "Banner editorial"
  };

  const style = document.createElement("style");
  style.textContent = [
    ".section-page-transfer-bootstrap #main{visibility:hidden!important}",
    ".section-page-transfer-host{display:contents}",
    ".section-page-transfer-button{flex:0 0 auto;min-width:30px;padding:5px 8px;line-height:1.2}",
    ".section-page-transfer-button:disabled{opacity:.55;cursor:wait}"
  ].join("");
  document.head.appendChild(style);

  let client = null;
  let sectionPages = {};
  let observer = null;
  let syncing = false;
  let bootstrapping = false;
  const comicTemplates = new Map();
  let templateOrder = [];

  function normalize(value) {
    return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase("pt-BR").replace(/\s+/g, " ").trim();
  }

  function currentPage() {
    const current = window.BancaDigital && window.BancaDigital.state
      ? String(window.BancaDigital.state.section || "") : "";
    if (current === "home") return "home";
    if (current === "comic" || current === "comics") return "comic";
    if (current) return null;

    const route = new URL(window.location.href).searchParams.get("pagina") || "";
    if (route === "quadrinhos" || route === "comic" || route === "comics") return "comic";
    if (!route || route === "inicio" || route === "home") return "home";
    return null;
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
          if (SECTION_KEY_SET.has(key) && result[key] === "comic") sectionPages[key] = "comic";
        });
      })
      .catch(error => console.warn("[Banca] Não foi possível carregar os destinos das seções.", error));
  }

  function titleText(head) {
    const element = head && head.querySelector(".section-title, h1, h2, h3");
    return element ? element.textContent.replace(/\s+/g, " ").trim() : "";
  }

  function keyFromAttributes(root, head) {
    const nodes = [root, head];
    if (root && root.querySelectorAll) {
      nodes.push(...Array.from(root.querySelectorAll("[data-home-section-key], [data-section-key], [data-section-id], [data-home-section], [data-section-order]")).slice(0, 100));
    }
    for (const node of nodes) {
      if (!node || !node.attributes) continue;
      for (const attr of Array.from(node.attributes)) {
        if (!attr.name.startsWith("data-")) continue;
        const value = String(attr.value || "").trim();
        if (SECTION_KEY_SET.has(value) && /section|shelf|home|order|rail|homepage/i.test(attr.name)) return value;
      }
    }
    return "";
  }

  function keyFromTitle(value) {
    const title = normalize(value);
    for (const entry of TITLE_ALIASES) {
      if (entry[1].some(alias => title === normalize(alias) || title.startsWith(normalize(alias) + " "))) return entry[0];
    }
    return "";
  }

  function rootForHead(head) {
    let fallback = head.parentElement;
    for (let node = head.parentElement; node && node !== main; node = node.parentElement) {
      if (!fallback) fallback = node;
      const containsOnlyThisHead = node.querySelector(".section-head") === head;
      const sectionLike = node.tagName === "SECTION" || node.classList.contains("section")
        || node.classList.contains("home-section") || node.classList.contains("homepage-section")
        || node.hasAttribute("data-home-section-key");
      if (containsOnlyThisHead && sectionLike) return node;
    }
    return fallback || head;
  }

  function collectSections() {
    const records = [];
    const seenRoots = new Set();
    const seenKeys = new Set();
    const heads = Array.from(main.querySelectorAll(".section-head"));
    for (const head of heads) {
      if (head.closest(".section-page-transfer-host, [data-section-page-transfer-clone='true']")) continue;
      const title = titleText(head);
      if (!title) continue;
      const root = rootForHead(head);
      if (!root || root === main || seenRoots.has(root)) continue;
      const key = keyFromAttributes(root, head) || keyFromTitle(title);
      if (!SECTION_KEY_SET.has(key) || seenKeys.has(key)) continue;
      seenRoots.add(root);
      seenKeys.add(key);
      records.push({ key, root, head, title });
    }
    return records;
  }

  function isSectionControl(button) {
    const content = (button.textContent || "").replace(/\s+/g, " ").trim();
    if (content === "↑" || content === "↓" || content === "⊘") return true;
    const label = normalize((button.getAttribute("aria-label") || "") + " " + (button.getAttribute("title") || ""));
    return /mover.*(para cima|para baixo)|subir secao|descer secao|ocultar secao|esconder secao/.test(label);
  }

  function managedControls(head) {
    return Array.from(head.querySelectorAll("button")).filter(button =>
      !button.hasAttribute("data-section-page-transfer-key") && isSectionControl(button));
  }

  function targetPageFor(page) {
    return page === "comic" ? "home" : "comic";
  }

  function pageLabel(page) {
    return page === "comic" ? "Quadrinhos" : "Inicial";
  }

  function makeTransferButton(key, title, page, className) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = ((className || "small-btn") + " section-page-transfer-button").trim();
    button.textContent = "⇄";
    button.dataset.sectionPageTransferKey = key;
    button.title = "Enviar “" + (title || SECTION_TITLES[key] || "seção") + "” para " + pageLabel(targetPageFor(page));
    button.setAttribute("aria-label", button.title);
    return button;
  }

  function ensureTransferButton(record, page) {
    const head = record.head;
    const existing = head.querySelector('button[data-section-page-transfer-key="' + record.key + '"]');
    const controls = managedControls(head);
    if (!existing && !controls.length) return false;
    if (existing) {
      existing.title = "Enviar “" + record.title + "” para " + pageLabel(targetPageFor(page));
      existing.setAttribute("aria-label", existing.title);
      return true;
    }
    const button = makeTransferButton(record.key, record.title, page, controls[0] && controls[0].className);
    const last = controls[controls.length - 1];
    if (last && last.parentElement && controls.every(item => item.parentElement === last.parentElement)) {
      last.insertAdjacentElement("afterend", button);
    } else {
      head.appendChild(button);
    }
    return true;
  }

  function makeComicTemplate(record) {
    const clone = record.root.cloneNode(true);
    clone.setAttribute("data-section-page-transfer-clone", "true");
    clone.setAttribute("data-section-page-transfer-key", record.key);
    const cloneHead = clone.querySelector(".section-head");
    if (!cloneHead) return clone;

    const oldTransferButtons = Array.from(cloneHead.querySelectorAll("button[data-section-page-transfer-key]"));
    const oldControls = managedControls(cloneHead);
    const isManaged = oldTransferButtons.length > 0 || oldControls.length > 0;
    const actionParent = (oldControls[0] || oldTransferButtons[0])?.parentElement || cloneHead;
    oldTransferButtons.forEach(button => button.remove());
    oldControls.forEach(button => button.remove());

    if (isManaged) {
      const button = makeTransferButton(record.key, record.title, "comic",
        oldControls[0] && oldControls[0].className || oldTransferButtons[0] && oldTransferButtons[0].className);
      if (cloneHead.contains(actionParent)) actionParent.appendChild(button);
      else cloneHead.appendChild(button);
    }
    return clone;
  }

  function cacheComicTemplate(record) {
    if (!record || !SECTION_KEY_SET.has(record.key)) return;
    const clone = makeComicTemplate(record);
    comicTemplates.set(record.key, clone);
    if (!templateOrder.includes(record.key)) templateOrder.push(record.key);
  }

  function updateTemplateOrder(records) {
    const current = records.map(record => record.key);
    const movedSections = Object.keys(sectionPages).filter(key => sectionPages[key] === "comic");
    const missingMoved = movedSections.some(key => !current.includes(key));
    if (missingMoved) return;
    const leftovers = templateOrder.filter(key => !current.includes(key));
    templateOrder = current.concat(leftovers);
  }

  function renderComicHost() {
    const wanted = templateOrder.filter(key => sectionPages[key] === "comic" && comicTemplates.has(key));
    let host = Array.from(main.children).find(child => child.classList.contains("section-page-transfer-host"));
    if (!wanted.length) {
      if (host) host.remove();
      return;
    }
    if (!host) {
      host = document.createElement("div");
      host.className = "section-page-transfer-host";
      host.setAttribute("aria-label", "Seções enviadas para Quadrinhos");
      main.insertBefore(host, main.firstChild);
    }
    const clones = wanted.map(key => comicTemplates.get(key).cloneNode(true));
    host.replaceChildren(...clones);
  }

  function sync() {
    if (syncing || bootstrapping) return;
    const page = currentPage();
    if (!page) {
      const existingHost = Array.from(main.children).find(child => child.classList.contains("section-page-transfer-host"));
      if (existingHost) existingHost.remove();
      return;
    }

    syncing = true;
    try {
      const records = collectSections();
      if (page === "home") updateTemplateOrder(records);
      for (const record of records) {
        ensureTransferButton(record, page);
        cacheComicTemplate(record);
        if (page === "home" && sectionPages[record.key] === "comic") record.root.remove();
      }
      if (page === "comic") renderComicHost();
      else {
        const existingHost = Array.from(main.children).find(child => child.classList.contains("section-page-transfer-host"));
        if (existingHost) existingHost.remove();
      }
    } finally {
      syncing = false;
    }
  }

  function nextFrame() {
    return new Promise(resolve => window.requestAnimationFrame(() => resolve()));
  }

  async function bootstrapTemplatesForDirectComicRoute() {
    const needed = Object.keys(sectionPages).filter(key => sectionPages[key] === "comic");
    if (!needed.some(key => !comicTemplates.has(key))) return;
    const homeButton = document.querySelector('.topbar [data-section="home"]');
    const comicButton = document.querySelector('.topbar [data-section="comics"]');
    if (!homeButton || !comicButton || currentPage() !== "comic") return;

    bootstrapping = true;
    document.body.classList.add("section-page-transfer-bootstrap");
    try {
      homeButton.click();
      await nextFrame();
      await nextFrame();
      const homeRecords = collectSections();
      updateTemplateOrder(homeRecords);
      homeRecords.forEach(cacheComicTemplate);
      comicButton.click();
      await nextFrame();
      await nextFrame();
    } catch (error) {
      console.warn("[Banca] Não foi possível preparar as seções transferidas.", error);
    } finally {
      bootstrapping = false;
      document.body.classList.remove("section-page-transfer-bootstrap");
      sync();
    }
  }

  async function transferSection(button) {
    const key = button.dataset.sectionPageTransferKey;
    if (!SECTION_KEY_SET.has(key)) return;
    const page = currentPage();
    if (page !== "home" && page !== "comic") return;
    const destination = targetPageFor(page);
    const root = button.closest("[data-section-page-transfer-clone='true']")
      || rootForHead(button.closest(".section-head") || button.parentElement);
    const head = root && root.querySelector(".section-head");
    const title = titleText(head) || SECTION_TITLES[key] || "Seção";

    if (page === "comic" && root) {
      cacheComicTemplate({ key, root, head, title });
    } else {
      const record = collectSections().find(item => item.key === key);
      if (record) cacheComicTemplate(record);
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

      if (destination === "comic") sectionPages[key] = "comic";
      else delete sectionPages[key];

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

    observer = new MutationObserver(records => {
      if (bootstrapping || syncing) return;
      const relevant = records.some(record => {
        const target = record.target instanceof Element ? record.target : record.target.parentElement;
        return !target?.closest(".section-page-transfer-host");
      });
      if (relevant) sync();
    });
    observer.observe(main, { childList: true, subtree: true });

    if (currentPage() === "comic" && Object.values(sectionPages).includes("comic")) {
      await bootstrapTemplatesForDirectComicRoute();
    }
    sync();

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