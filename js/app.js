(() => {
  "use strict";

  // --- Inicialização de Bibliotecas ---
  // --- Fim da Inicialização ---
  const DB_KEY = `bancaDigitalDB_v1:${window.CATALOG_VERSION || "local"}`;
  const DEFAULT_AVATAR_URL = "assets/semfoto.jpg?v=1";
  const FACTION_COLOR_OPTIONS = [
    { family: "ruby", label: "Rubi", light: "#e85b68", dark: "#a93345" },
    { family: "cobalt", label: "Cobalto", light: "#5ca9e8", dark: "#2d6295" },
    { family: "gold", label: "Dourado", light: "#e7b94b", dark: "#9a6c12" },
    { family: "violet", label: "Violeta", light: "#ae79e8", dark: "#6f3ca5" },
    { family: "silver", label: "Prata", light: "#b8c2cc", dark: "#59636f" },
    { family: "orange", label: "Âmbar", light: "#ec8b55", dark: "#a84c21" },
    { family: "lime", label: "Lima", light: "#b8d957", dark: "#6b821d" },
    { family: "pink", label: "Rosa", light: "#e17ab3", dark: "#9b3f72" }
  ];
  const FACTION_EMBLEM_OPTIONS = ["🦁", "🐍", "🦊", "🐙", "⚡", "🕷️", "🔥", "🌀", "🦋", "🌵", "🦈", "🎸", "☀️", "🦉", "🐉", "🦅", "🐺", "🌿", "⚔️", "🛸"];
  const SERIES_FIELDS = ["seriesTitle", "author", "publisher", "imprint", "year", "description", "coverUrl", "telegramUrl", "tags", "type", "publication", "status", "editions", "character"];
  let lazyCoverObserver = null;
  let readerIsOpen = false;
  const KNIGHT_TERRORS_VOLUME_GROUPS = [
    ["Principal", 7], ["Batman", 2], ["Devastadora", 2], ["Coringa", 2],
    ["Hera Venenosa", 2], ["Adão Negro", 2], ["Robin", 2], ["Flash", 2],
    ["Zatanna", 2], ["Shazam", 2], ["Lanterna Verde", 2], ["Mulher-Maravilha", 2],
    ["Superman", 2], ["Asa Noturna", 2], ["Mulher-Gato", 2], ["Anedota", 2],
    ["Titãs", 2], ["Action Comics", 2], ["Detective Comics", 2], ["Arlequina", 2],
    ["Algoz dos Anjos", 2]
  ];

  function knightTerrorsVolume(item) {
    if (item?.seriesId !== "series-knight-terrors-2023") return null;
    const issueIndex = Number(String(item.id || "").match(/-(\d+)$/)?.[1]) - 1;
    if (!Number.isInteger(issueIndex) || issueIndex < 0) return null;
    let offset = 0;
    for (const [name, size] of KNIGHT_TERRORS_VOLUME_GROUPS) {
      if (issueIndex < offset + size) return name;
      offset += size;
    }
    return null;
  }

  function materializeSeriesItems(items = []) {
    const series = new Map((window.DEFAULT_SERIES || []).map(entry => [entry.id, entry]));
    return items.map(item => {
      const inferredSeriesId = String(item.id || "").startsWith("harley-quinn-2021-")
        ? "series-harley-quinn-2021"
        : item.seriesId;
      const definition = series.get(inferredSeriesId);
      if (!definition) return item;
      const merged = { ...definition, ...item, seriesId: inferredSeriesId };
      SERIES_FIELDS.forEach(field => {
        if (item[field] === undefined || item[field] === null || item[field] === "") merged[field] = definition[field];
      });
      if (merged.id === "teen-titans-academy-anuario") {
        merged.issue = "Anuário";
        merged.sortOrder = 4.5;
      }
      if (merged.id === "harley-quinn-2021-annual") {
        merged.issue = "Anuário";
        merged.sortOrder = 6.5;
      }
      if (merged.id === "harley-quinn-2021-003") {
        merged.seriesId = "series-harley-quinn-2021";
        merged.issue = "3";
        merged.fileUrl = "https://www.mediafire.com/file/jixe3r7igaresw9/Arlequina_003_%25282021%2529_%2528S%25C3%25B3Quadrinhos%2529.cbr/file";
      }
      if (merged.id === "series-justice-godzilla-kong-2023-08") {
        merged.fileUrl = "https://mega.nz/file/XNISCRga#5NQNVbiHZER9AT6iE-8KG7nOEWBR3bpk2XxWKhFNO9s";
      }
      if (merged.seriesId === "series-batman-urban-legends-2021") {
        const defaultItem = (window.DEFAULT_LIBRARY || []).find(entry => entry.id === merged.id);
        if (defaultItem?.coverUrl) merged.coverUrl = defaultItem.coverUrl;
      }
      if (merged.seriesId === "series-absolute-power-2024") {
        const defaultItem = (window.DEFAULT_LIBRARY || []).find(entry => entry.id === merged.id);
        if (defaultItem?.coverUrl) merged.coverUrl = defaultItem.coverUrl;
      }
      if (String(merged.id || "").startsWith("fury-of-firestorm-2026-") && !String(merged.fileUrl || "").endsWith("/file")) {
        merged.fileUrl = `${merged.fileUrl}/file`;
      }
      const knightVolume = knightTerrorsVolume(merged);
      if (knightVolume) {
        merged.volume = knightVolume;
        merged.volumeTitle = knightVolume;
      }
      merged.seriesTitle = item.seriesTitle || definition.name || definition.seriesTitle;
      merged.title = item.title || merged.seriesTitle;
      return merged;
    });
  }

  function compactSeriesItems(items = []) {
    const series = new Map((window.DEFAULT_SERIES || []).map(entry => [entry.id, entry]));
    return items.map(item => {
      const definition = series.get(item.seriesId);
      if (!definition) return item;
      const compact = { ...item };
      SERIES_FIELDS.forEach(field => {
        if (field !== "type" && compact[field] === definition[field]) delete compact[field];
      });
      if (compact.seriesTitle === definition.name || compact.seriesTitle === definition.seriesTitle) delete compact.seriesTitle;
      if (compact.title === definition.name || compact.title === definition.seriesTitle) delete compact.title;
      return compact;
    });
  }

  function clearGeneratedCoverCache() {
    const keys = [];
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (key?.startsWith("banca-cover:")) keys.push(key);
    }
    keys.forEach(key => localStorage.removeItem(key));
  }

  function storageSafeLibrary(items = []) {
    return compactSeriesItems(items).map(item => {
      const safe = { ...item };
      if (/^data:/i.test(String(safe.cover || ""))) delete safe.cover;
      if (/^data:/i.test(String(safe.coverUrl || ""))) delete safe.coverUrl;
      if (/^data:/i.test(String(safe.featuredCoverUrl || ""))) delete safe.featuredCoverUrl;
      return safe;
    });
  }

  function isLegacyRemovedCatalogItem(item) {
    const text = [item?.id, item?.seriesId, item?.title, item?.name, item?.seriesTitle, item?.originalTitle].join(" ");
    return /tomoki-kun|onnanoko/i.test(text);
  }

  const DataStore = {
    load() {
      try {
        const saved = JSON.parse(localStorage.getItem(DB_KEY));
        if (saved?.library && saved?.collections) {
          const removedItemIds = new Set([
            ...(window.REMOVED_DEFAULT_ITEM_IDS || []),
            ...(Array.isArray(saved.removedItemIds) ? saved.removedItemIds : [])
          ]);
          const legacyRemovedSeriesIds = new Set(saved.library.filter(isLegacyRemovedCatalogItem).map(item => item.seriesId || item.id));
          const isRemoved = item => removedItemIds.has(item.id) || isLegacyRemovedCatalogItem(item) || legacyRemovedSeriesIds.has(item.seriesId);
          const hadRemovedItems = saved.library.some(isRemoved);
          saved.library = saved.library.filter(item => !isRemoved(item));
          saved.collections = saved.collections.map(collection => ({
            ...collection,
            issueIds: (collection.issueIds || []).filter(id => !removedItemIds.has(id) && !legacyRemovedSeriesIds.has(id))
          }));
          const oldAbsolutePowerIds = new Map([
            ["series-absolute-power-2024-02", "series-absolute-power-2024-01"],
            ["series-absolute-power-2024-03", "series-absolute-power-2024-02"],
            ["series-absolute-power-2024-04", "series-absolute-power-2024-03"],
            ["series-absolute-power-2024-05", "series-absolute-power-2024-04"]
          ]);
          if (saved.library.some(item => item.id === "series-absolute-power-2024-05")) {
            saved.library = saved.library
              .filter(item => item.id !== "series-absolute-power-2024-01")
              .map(item => oldAbsolutePowerIds.has(item.id) ? { ...item, id: oldAbsolutePowerIds.get(item.id) } : item);
          }
          const defaultsById = new Map((window.DEFAULT_LIBRARY || []).map(item => [item.id, item]));
          const previousLibrary = saved.library;
          saved.library = materializeSeriesItems(saved.library.map(item => ({ ...(defaultsById.get(item.id) || {}), ...item })));
          const hadStargirlAdvertisement = saved.library.some(item => item.id === "series-stargirl-lost-children-2022-03");
          saved.library = saved.library.filter(item => item.id !== "series-stargirl-lost-children-2022-03");
          if (hadStargirlAdvertisement) {
            saved.collections = saved.collections.map(collection => ({
              ...collection,
              issueIds: (collection.issueIds || []).filter(id => id !== "series-stargirl-lost-children-2022-03")
            }));
          }
          const knightVolumesChanged = saved.library.some(item => {
            const previous = previousLibrary.find(entry => entry.id === item.id);
            return previous && (previous.volume !== item.volume || previous.volumeTitle !== item.volumeTitle);
          });
          if (knightVolumesChanged || hadStargirlAdvertisement) this.save(saved);
          if (saved.library.some(item => item.id === "series-justice-godzilla-kong-2023-08" && String(item.fileUrl || "").includes("bpk2XxWKhFNO9s"))) this.save(saved);
          const knownIds = new Set(saved.library.map(item => item.id));
          const newDefaults = materializeSeriesItems(structuredClone(window.DEFAULT_LIBRARY)).filter(item => !knownIds.has(item.id) && !removedItemIds.has(item.id) && !isLegacyRemovedCatalogItem(item));
          if (newDefaults.length) {
            const merged = { ...saved, library: [...saved.library, ...newDefaults] };
            this.save(merged);
            return merged;
          }
          if (hadRemovedItems) this.save(saved);
          return saved;
        }
      } catch {}
      const fresh = {
        library: structuredClone(window.DEFAULT_LIBRARY),
        collections: structuredClone(window.DEFAULT_COLLECTIONS),
        submissions: [],
        removedItemIds: []
      };
      const removedItemIds = new Set(window.REMOVED_DEFAULT_ITEM_IDS || []);
      fresh.library = fresh.library.filter(item => !removedItemIds.has(item.id) && !isLegacyRemovedCatalogItem(item));
      fresh.collections = fresh.collections.map(collection => ({
        ...collection,
        issueIds: (collection.issueIds || []).filter(id => !removedItemIds.has(id))
      }));
      fresh.library = materializeSeriesItems(fresh.library);
      this.save(fresh);
      return fresh;
    },
    save(db) {
      const payload = JSON.stringify({ ...db, library: storageSafeLibrary(db.library) });
      try {
        localStorage.setItem(DB_KEY, payload);
      } catch (error) {
        if (error?.name !== "QuotaExceededError") throw error;
        clearGeneratedCoverCache();
        try {
          localStorage.setItem(DB_KEY, payload);
        } catch (retryError) {
          console.warn("Catálogo local maior que a cota do navegador; alterações locais não foram persistidas.", retryError);
        }
      }
    }
  };

  const state = {
    db: DataStore.load(),
    section: "home",
    authMode: "login",
    publicProfile: null,
    search: "",
    entityFilter: null,
    collectionId: null,
    editingId: null,
    // Reading mode for PDF, CBZ, and CBR readers
    readingMode: localStorage.getItem("readingMode") || "single-page", // 'single-page', 'double-page', or 'continuous-scroll'
    readingDirection: localStorage.getItem("readingDirection") || "western" // 'western' or 'eastern'
    ,session: null,
    authReady: false,
    profile: null,
    favoriteIds: new Set(),
    favoriteAddedAt: new Map(),
    collectionSortOrders: {},
    coverVariants: new Map(),
    coverChoices: new Map(),
    previewCoverChoices: new Map(),
    coverStyles: new Map(),
    seriesCoverChoices: new Map(),
    offlineCoverData: new Map(),
    readingProgress: new Map(),
    recentlyOpenedIds: (() => {
      try {
        const stored = JSON.parse(localStorage.getItem("bancaDigitalRecentlyOpened") || "[]");
        return Array.isArray(stored) ? stored.map(String).slice(0, 20) : [];
      } catch { return []; }
    })(),
    shelfSnapshot: null,
    shelfExpanded: { saved: false, read: false },
    shelfCategories: [],
    savedPublicCollections: [],
    savedPublisherKeys: new Set(),
    savedPublishers: [],
    blogShelfCategories: [],
    shelfTab: "collections",
    publicShelfTab: "collections",
    blogSaveIds: new Set(),
    authoredBlogPosts: [],
    savedBlogPosts: [],
    collectionFilter: { field: "all", query: "" },
    comicLikeIds: new Set(),
    comicLikeAddedAt: new Map(),
    comicLikeCounts: new Map(),
    comicMonthlyReadCounts: new Map(),
    comicMonthlyReadCountsLoaded: false,
    homeSectionOrder: null,
    homeVisibleSectionKeys: [],
    achievementChecks: new Set(),
    homeHeroId: null,
    homeRandomIds: [],
    homeRandomPublisher: null,
    homeRandomCharacter: null,
    achievements: [],
    followerCount: 0,
    followingCount: 0,
    chatContact: null,
    messageUnreadCount: 0,
    chatRoomUnreadCounts: {},
    downloads: new Map(),
    downloadsSortOrder: localStorage.getItem("bancaDigitalDownloadsSort") || "added_desc",
    downloadsSeriesSortOrders: (() => { try { return JSON.parse(localStorage.getItem("bancaDigitalDownloadsSeriesSort") || "{}"); } catch { return {}; } })(),
    notifications: [],
    notificationUnreadCount: 0,
    notificationChannel: null,
    staffActivities: [],
    staffPendingCount: 0,
    coverVariantReviewTab: "pending",
    localBoxFiles: [],
    localBoxVisible: false,
    publisherSettings: new Map(),
    publisherSeriesExpanded: {},
    popularPublicCollections: [],
    featuredComicCollections: [],
    featuredBlogCollections: [],
    blogPosts: [],
    blogLoading: false,
    blogTab: "recentes",
    blogOpenId: null,
    blogLikeIds: new Set(),
    blogLikeCounts: new Map(),
    blogCommentCounts: new Map(),
    blogCommentThreads: new Map(),
    blogEditorRange: null
    ,wallComments: []
    ,rankingPeriod: "week"
    ,rankingFaction: null
    ,rankingMembers: []
    ,rankingCategory: null
    ,rankingSearch: ""
    ,rankingLoading: false
    ,presenceInterval: null
    ,factions: []
    ,factionStats: new Map()
    ,factionRoles: []
    ,factionRoleMembers: []
    ,factionMembers: []
    ,factionAbafacImages: []
    ,factionAbafacCatalogs: new Map()
    ,factionPageId: null
    ,factionMembersView: false
    ,factionMemberSearch: ""
    ,factionByUser: new Map()
    ,factionChoiceOpen: false
  };

  const DOWNLOADS_KEY = "bancaDigitalDownloads:";
  const DOWNLOADS_MANIFEST_KEY = "bancaDigitalDownloadsManifest";
  const OFFLINE_ACCOUNT_KEY = "bancaDigitalOfflineAccount";
  function saveOfflineAccount(profile = state.profile) {
    if (!state.session?.user?.id) return;
    try {
      const previous = readOfflineAccount();
      const currentDownloads = [...(state.downloads?.values?.() || [])];
      const username = profile?.username || previous?.username || state.offlineUsername || state.session.user.user_metadata?.username || state.session.user.user_metadata?.user_name || "";
      const savedProfile = profile?.username ? profile : (previous?.profile?.username ? previous.profile : profile || previous?.profile || null);
      localStorage.setItem(OFFLINE_ACCOUNT_KEY, JSON.stringify({ user: state.session.user, username, profile: savedProfile, downloads: previous?.downloads?.length ? previous.downloads : currentDownloads, savedAt: Date.now() }));
    } catch {}
  }
  function readOfflineAccount() {
    try {
      const value = JSON.parse(localStorage.getItem(OFFLINE_ACCOUNT_KEY) || "null");
      return value?.user?.id ? value : null;
    } catch { return null; }
  }
  function offlineProfileFor(user, profile = null, savedUsername = "") {
    if (profile?.username) return profile;
    const metadata = user?.user_metadata || {};
    return {
      ...(profile || {}),
      id: profile?.id || user?.id,
      username: savedUsername || metadata.username || metadata.user_name || metadata.preferred_username || "usuario"
    };
  }
  function loadDownloads() {
    const userId = state.session?.user?.id;
    if (!userId) { state.downloads = new Map(); return; }
    try {
      const stored = localStorage.getItem(`${DOWNLOADS_KEY}${userId}`);
      let manifest = {};
      try { manifest = JSON.parse(localStorage.getItem(DOWNLOADS_MANIFEST_KEY) || "{}"); } catch {}
      const primaryRows = stored ? JSON.parse(stored) : [];
      const rows = Array.isArray(primaryRows) && primaryRows.length
        ? primaryRows
        : (manifest[userId] || readOfflineAccount()?.downloads || []);
      const recoveredRows = Array.isArray(rows) ? rows.map(row => {
        if (row?.preparing) return { ...row, status: "paused", preparing: false, pausedAt: new Date().toISOString() };
        if (row?.status === "downloading" && Number(row.progress) >= 100) return { ...row, status: "completed", completedAt: row.completedAt || new Date().toISOString(), progress: 100 };
        if (row?.status !== "downloading") return row;
        return { ...row, status: "paused", pausedAt: new Date().toISOString() };
      }) : [];
      state.downloads = new Map(recoveredRows.map(row => [String(row.id), row]));
      if (recoveredRows.some((row, index) => row?.status === "paused" && rows[index]?.status === "downloading")) persistDownloads();
      validateDownloadedFiles();
    } catch { state.downloads = new Map(); }
  }

  async function validateDownloadedFiles() {
    if (!window.caches || !state.downloads.size) return;
    try {
      const cache = await caches.open(READER_FILE_CACHE);
      let changed = false;
      for (const entry of state.downloads.values()) {
        if (!entry.url) continue;
        const cached = await cache.match(downloadCacheKey(entry.url));
        if (cached && entry.status !== "completed") {
          entry.status = "completed";
          entry.preparing = false;
          entry.progress = 100;
          entry.completedAt = entry.completedAt || new Date().toISOString();
          state.downloads.set(String(entry.id), entry);
          changed = true;
          continue;
        }
        if (cached || entry.status !== "completed") continue;
        entry.status = "paused";
        entry.pausedAt = new Date().toISOString();
        entry.progress = 0;
        state.downloads.set(String(entry.id), entry);
        changed = true;
      }
      if (changed) {
        persistDownloads();
        if (state.section === "downloads") render();
      }
    } catch (error) {
      console.warn("NÃ£o foi possÃ­vel validar os arquivos offline:", error);
    }
  }
  function persistDownloads() {
    if (!state.session?.user?.id) return;
    try {
      const rows = [...state.downloads.values()];
      localStorage.setItem(`${DOWNLOADS_KEY}${state.session.user.id}`, JSON.stringify(rows));
      let manifest = {};
      try { manifest = JSON.parse(localStorage.getItem(DOWNLOADS_MANIFEST_KEY) || "{}"); } catch {}
      manifest[state.session.user.id] = rows;
      localStorage.setItem(DOWNLOADS_MANIFEST_KEY, JSON.stringify(manifest));
      const account = readOfflineAccount();
      if (account) localStorage.setItem(OFFLINE_ACCOUNT_KEY, JSON.stringify({ ...account, downloads: rows, savedAt: Date.now() }));
    } catch {}
  }
  function downloadSource(item) { return item?.fileUrl || (!/^https?:\/\/(?:www\.)?t(?:elegram)?\.me\//i.test(item?.telegramUrl || "") ? item?.telegramUrl : "") || ""; }
  function downloadCacheKey(url) { const proxy = proxiedFileUrl(url); return `${proxy}${proxy.includes("?") ? "&" : "?"}v=240`; }
  async function downloadCoverDataUrl(item) {
    const selectedChoice = state.coverChoices?.get?.(item?.id) || state.coverChoices?.get?.(String(item?.id));
    const source = selectedChoice?.cover_url || coverFor(item);
    if (!source || /^data:/i.test(source)) return source || "";
    // O proxy remoto pode ainda não ter sido publicado com suporte à DC.
    // Mantém a URL da variante como fallback sem gerar uma requisição 400.
    try {
      const fetchSource = imageProxyFetchUrl(source);
      const response = await fetch(fetchSource, { mode: "cors", credentials: "omit", cache: "no-store" });
      if (!response.ok) return "";
      const blob = await response.blob();
      const dataUrl = await blobToDataUrl(blob);
      if (dataUrl) state.offlineCoverData.set(String(item?.id), dataUrl);
      if (dataUrl && window.caches && item?.id) {
        try {
          const cache = await caches.open(OFFLINE_COVER_CACHE);
          await cache.put(offlineCoverCacheKey(item.id), new Response(blob, { headers: { "Content-Type": blob.type || "image/jpeg" } }));
        } catch (error) { console.warn("NÃ£o foi possÃ­vel salvar a capa offline:", error); }
      }
      return dataUrl;
    } catch { return ""; }
  }
  function downloaded(itemId) { return state.downloads.get(String(itemId)); }
  function updateDownloadButtons(itemId) {
    const entry = downloaded(itemId);
    const status = entry?.status || "idle";
    $$('[data-download]').filter(button => String(button.dataset.download) === String(itemId)).forEach(button => {
      button.classList.toggle("is-downloaded", status === "completed");
      button.classList.toggle("is-downloading", status === "downloading" || status === "waiting");
      button.textContent = status === "completed" ? "✓" : status === "downloading" ? "…" : status === "waiting" ? "…" : "↓";
      button.title = status === "completed" ? "Excluir download offline" : status === "downloading" ? "Download em andamento" : status === "waiting" ? "Aguardando na fila" : "Permitir leitura offline";
    });
  }
  async function openDownloaded(item) {
    const entry = downloaded(item.id);
    if (!entry || entry.status !== "completed") return;
    try {
      const buffer = await fetchFileArrayBuffer(entry.url);
      const objectUrl = URL.createObjectURL(new Blob([buffer], { type: "application/octet-stream" }));
      openReader({ ...item, fileUrl: objectUrl, local: true }, { localObjectUrl: objectUrl });
    } catch { toast("Este download não está disponível offline. Baixe novamente quando estiver conectado."); }
  }
  const MAX_CONCURRENT_DOWNLOADS = 3;
  let pumpingDownloadQueue = false;
  function activeDownloadCount() { return [...state.downloads.values()].filter(entry => entry.status === "downloading").length; }
  function pumpDownloadQueue() {
    if (pumpingDownloadQueue || navigator.onLine === false || state.session?.offline) return;
    pumpingDownloadQueue = true;
    try {
      while (activeDownloadCount() < MAX_CONCURRENT_DOWNLOADS) {
        const next = [...state.downloads.values()].filter(entry => entry.status === "waiting").sort((a, b) => new Date(a.startedAt || 0) - new Date(b.startedAt || 0))[0];
        if (!next) break;
        const item = state.db.library.find(entry => String(entry.id) === String(next.id)) || next.snapshot;
        if (!item) { state.downloads.delete(String(next.id)); continue; }
        startDownload(item);
      }
    } finally { pumpingDownloadQueue = false; }
  }

  async function startDownload(item) {
    if (!state.session) return openAuthPage();
    const url = downloadSource(item);
    if (!url) return toast("Este quadrinho não possui um arquivo direto para baixar.");
    const id = String(item.id);
    const previous = downloaded(id);
    if (previous?.status === "downloading") return;
    const shouldWait = activeDownloadCount() >= MAX_CONCURRENT_DOWNLOADS;
    const startedAt = previous?.startedAt || new Date().toISOString();
    state.downloads.set(id, { id, url, status: shouldWait ? "waiting" : "downloading", progress: Number(previous?.progress) || 0, title: itemDisplayTitle(item), snapshot: { ...(previous?.snapshot || item), file: undefined, local: undefined }, startedAt });
    persistDownloads(); updateDownloadButtons(id); render();
    if (shouldWait) return;
    const coverPromise = downloadCoverDataUrl(item).catch(error => { console.warn("NÃ£o foi possÃ­vel preparar a capa offline:", error); return ""; });
    try {
      await fetchFileArrayBuffer(url, (received, total) => {
        const current = state.downloads.get(id); if (!current) return;
        current.progress = total ? Math.min(100, received / total * 100) : 0; current.received = received; current.total = total;
        state.downloads.set(id, current); if (total && received >= total) persistDownloads(); if (state.section === "downloads") renderDownloadsProgress();
      }, () => {
        const ready = state.downloads.get(id);
        if (!ready) return;
        ready.status = "downloading";
        ready.preparing = true;
        ready.progress = 100;
        ready.completedAt = ready.completedAt || new Date().toISOString();
        state.downloads.set(id, ready);
        persistDownloads();
      });
      const current = state.downloads.get(id);
      if (current) {
        current.preparing = true;
        state.suppressDownloadReadyToast = true;
        current.status = "downloading"; current.progress = 100; state.downloads.set(id, current);
        persistDownloads(); updateDownloadButtons(id); render(); toast("Quadrinho disponível para leitura offline.");
        // A capa é auxiliar: o download fica concluído assim que o arquivo foi
        // confirmado no Cache Storage. Ela continua sendo preparada em paralelo.
        const coverUrl = "";
        const selectedCoverUrl = (state.coverChoices?.get?.(item.id) || state.coverChoices?.get?.(String(item.id)))?.cover_url || "";
        current.snapshot = { ...(current.snapshot || item), ...(coverUrl ? { coverUrl } : selectedCoverUrl ? { coverUrl: selectedCoverUrl } : {}), ...(selectedCoverUrl ? { selectedCoverUrl } : {}) };
        if (coverUrl && window.caches) delete current.snapshot.coverUrl;
        current.preparing = false;
        current.status = "completed"; current.progress = 100; current.completedAt = new Date().toISOString(); state.downloads.set(id, current);
        await recordComicDownload(item);
        updateDownloadButtons(id);
        refreshSeriesDownloadButton(item.seriesId);
      }
      persistDownloads(); render(); toast("Quadrinho disponível para leitura offline.");
    } catch (error) { state.downloads.delete(id); persistDownloads(); render(); toast("Não foi possível concluir o download."); console.warn("Download falhou", error); }
      pumpDownloadQueue();
  }
  function startSeriesDownload(editions) {
    if (!state.session) return openAuthPage();
    const pending = editions.filter(item => !["completed", "downloading", "waiting"].includes(downloaded(item.id)?.status));
    if (!pending.length) return toast("Todas as edições desta série já estão baixadas ou na fila.");
    pending.forEach(item => startDownload(item));
    refreshSeriesDownloadButton(pending[0]?.seriesId || editions[0]?.seriesId);
  }
  function refreshSeriesDownloadButton(seriesId) {
    const first = state.db.library.find(item => String(item.seriesId) === String(seriesId));
    const editions = first ? seriesEditions(first) : [];
    const entries = editions.map(item => downloaded(item.id));
    const completed = editions.length > 0 && entries.every(entry => entry?.status === "completed");
    const busy = entries.some(entry => entry?.status === "downloading" || entry?.status === "waiting");
    $$('[data-series-download-modal]').filter(button => String(button.dataset.seriesDownloadModal) === String(seriesId)).forEach(button => {
      button.disabled = completed || busy;
      button.classList.toggle("is-downloaded", completed);
      button.classList.toggle("is-downloading", !completed && busy);
      button.textContent = completed ? "✓ Série baixada" : busy ? "… Baixando série" : "↓ Baixar série";
      button.title = completed ? "Todas as edições desta série estão disponíveis offline" : busy ? "Há edições desta série baixando ou aguardando na fila" : "Permitir leitura offline de todas as edições";
    });
  }
  async function deleteDownload(itemId) {
    const entry = downloaded(itemId); state.downloads.delete(String(itemId)); updateDownloadButtons(itemId); persistDownloads();
    refreshSeriesDownloadButton(entry?.snapshot?.seriesId || state.db.library.find(item => String(item.id) === String(itemId))?.seriesId);
    if (entry?.url && window.caches) { try { const cache = await caches.open(READER_FILE_CACHE); await cache.delete(downloadCacheKey(entry.url)); } catch {} }
    render(); toast("Download excluído deste navegador.");
  }
  async function deleteSeriesDownloads(seriesId) {
    const target = String(seriesId || "__downloads-oneshots");
    const entries = [...state.downloads.values()].filter(entry => {
      const item = state.db.library.find(candidate => String(candidate.id) === String(entry.id)) || entry.snapshot;
      return entry.status === "completed" && String(item?.seriesId || "__downloads-oneshots") === target;
    });
    if (!entries.length) return;
    askDownloadConfirmation("Todos os quadrinhos concluídos desta série serão removidos deste navegador.", "Excluir série?", "Excluir série").then(async confirmed => {
      if (!confirmed) return;
      entries.forEach(entry => state.downloads.delete(String(entry.id)));
      persistDownloads();
      render();
      if (window.caches) {
        try {
          const cache = await caches.open(READER_FILE_CACHE);
          await Promise.all(entries.filter(entry => entry.url).map(entry => cache.delete(downloadCacheKey(entry.url))));
        } catch {}
      }
      toast("Downloads da série excluídos deste navegador.");
    });
  }
  async function deleteAllCompletedDownloads() {
    const entries = [...state.downloads.values()].filter(entry => entry.status === "completed");
    if (!entries.length) return;
    askDownloadConfirmation("Todos os quadrinhos disponíveis offline serão removidos deste navegador.", "Excluir downloads offline?", "Excluir todos").then(async confirmed => {
      if (!confirmed) return;
      entries.forEach(entry => state.downloads.delete(String(entry.id)));
      persistDownloads();
      render();
      if (window.caches) {
        try {
          const cache = await caches.open(READER_FILE_CACHE);
          await Promise.all(entries.filter(entry => entry.url).map(entry => cache.delete(downloadCacheKey(entry.url))));
        } catch {}
      }
      toast("Todos os downloads offline foram excluídos.");
    });
  }
  function resumeAllPendingDownloads() {
    const items = [...state.downloads.values()]
      .filter(entry => entry.status === "paused")
      .map(entry => state.db.library.find(item => String(item.id) === String(entry.id)) || entry.snapshot)
      .filter(Boolean);
    if (!items.length) return;
    items.forEach(item => startDownload(item));
  }
  function askDownloadConfirmation(message, title = "Limpar fila?", confirmLabel = "Limpar fila") {
    return new Promise(resolve => {
      const overlay = document.createElement("div");
      overlay.className = "modal-backdrop";
      overlay.innerHTML = `<div class="modal download-confirm-modal"><div class="section-head"><div><div class="eyebrow">Downloads</div><h2>${escapeHTML(title)}</h2><div class="section-subtitle">${escapeHTML(message)}</div></div></div><div class="modal-actions"><button type="button" class="small-btn" data-close>Manter downloads</button><button type="button" class="btn btn-danger" data-confirm-clear>${escapeHTML(confirmLabel)}</button></div></div>`;
      $("#modal-root").appendChild(overlay);
      const finish = value => { overlay.remove(); resolve(value); };
      $$('[data-close]', overlay).forEach(button => button.addEventListener("click", () => finish(false)));
      overlay.addEventListener("click", event => { if (event.target === overlay) finish(false); });
      $('[data-confirm-clear]', overlay).addEventListener("click", () => finish(true));
    });
  }
  function clearDownloadQueue() {
    const entries = [...state.downloads.values()].filter(entry => entry.status !== "completed");
    if (!entries.length) return;
    askDownloadConfirmation("Os downloads baixando, aguardando ou interrompidos serão removidos da fila.").then(confirmed => {
      if (!confirmed) return;
      entries.forEach(entry => state.downloads.delete(String(entry.id)));
      persistDownloads();
      render();
      toast("Fila de downloads limpa.");
    });
  }

  const downloadCoverHydrations = new Map();
  function updateDownloadCoverImage(itemId) {
    const item = state.db.library.find(entry => String(entry.id) === String(itemId)) || downloaded(itemId)?.snapshot;
    if (!item) return;
    const cover = coverFor(item, "card");
    $$('[data-open-download-cover]').filter(element => String(element.dataset.openDownloadCover) === String(itemId)).forEach(element => {
      element.style.backgroundImage = `url("${cover}")`;
    });
  }
  function hydrateDownloadedCover(entry, item) {
    if (!entry || entry.status !== "completed" || !item || navigator.onLine === false || state.session?.offline) return;
    if ([item.coverUrl, item.selectedCoverUrl, item.cover].some(value => /^data:/i.test(String(value || "")))) return;
    const id = String(entry.id);
    if (downloadCoverHydrations.has(id)) return;
    const task = downloadCoverDataUrl(item).then(coverUrl => {
      if (!coverUrl) return;
      const latest = state.downloads.get(id);
      if (!latest || latest.status !== "completed") return;
      latest.snapshot = { ...(latest.snapshot || item), coverUrl };
      if (window.caches) delete latest.snapshot.coverUrl;
      state.downloads.set(id, latest);
      persistDownloads();
      updateDownloadCoverImage(id);
    }).catch(() => {}).finally(() => downloadCoverHydrations.delete(id));
    downloadCoverHydrations.set(id, task);
  }
  let offlineCoverHydrationRunning = false;
  let offlineCoverHydrationQueued = false;
  async function hydrateOfflineCoverData(items) {
    if (!window.caches || !items?.length) return;
    if (offlineCoverHydrationRunning) {
      offlineCoverHydrationQueued = true;
      return;
    }
    offlineCoverHydrationRunning = true;
    try {
      const cache = await caches.open(OFFLINE_COVER_CACHE);
      let changed = false;
      for (const { entry, item } of items) {
        if (entry.status !== "completed" || !item?.id || state.offlineCoverData.has(String(item.id))) continue;
        const response = await cache.match(offlineCoverCacheKey(item.id));
        if (!response) continue;
        const dataUrl = await blobToDataUrl(await response.blob());
        if (dataUrl) { state.offlineCoverData.set(String(item.id), dataUrl); changed = true; }
      }
      if (changed) {
        for (const { item } of items) updateDownloadCoverImage(item.id);
      }
    } catch (error) {
      console.warn("NÃ£o foi possÃ­vel carregar as capas offline:", error);
    } finally {
      offlineCoverHydrationRunning = false;
      if (offlineCoverHydrationQueued) {
        offlineCoverHydrationQueued = false;
        const currentItems = [...state.downloads.values()]
          .filter(entry => entry.status === "completed")
          .map(entry => {
            const catalogItem = state.db.library.find(item => String(item.id) === String(entry.id));
            return { entry, item: catalogItem && entry.snapshot ? { ...catalogItem, ...entry.snapshot } : catalogItem || entry.snapshot };
          })
          .filter(row => row.item);
        hydrateOfflineCoverData(currentItems);
      }
    }
  }

  let activeReaderCleanup = null;
  let handlingRoute = false;
  const readerFilePrefetches = new Map();
  const MAX_READER_PREFETCHES = 1;

  function waitForPrefetchedBuffer(value, timeoutMs = 15000) {
    if (!value) return Promise.resolve(null);
    return Promise.race([
      Promise.resolve(value),
      new Promise(resolve => window.setTimeout(() => resolve(null), timeoutMs))
    ]).catch(() => null);
  }

  function createArchivePageCache(files, extract) {
    const cache = new Map();
    const pending = new Map();
    const thirdSize = Math.max(1, Math.ceil(files.length / 3));
    const get = index => {
      if (cache.has(index)) return Promise.resolve(cache.get(index));
      if (!pending.has(index)) {
        pending.set(index, Promise.resolve(extract(files[index])).then(value => {
          cache.set(index, value);
          pending.delete(index);
          return value;
        }).catch(error => {
          pending.delete(index);
          throw error;
        }));
      }
      return pending.get(index);
    };
    const prefetchThird = third => {
      if (third < 0 || third > 2) return Promise.resolve();
      const start = third * thirdSize;
      const end = Math.min(files.length, start + thirdSize);
      return Promise.all(Array.from({ length: end - start }, (_, offset) => get(start + offset))).then(() => undefined);
    };
    return { get, prefetchThird, thirdSize };
  }

  async function fetchCbzBuffer(url, signal, onProgress = () => {}) {
    let lastError;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const target = new URL(proxiedFileUrl(url));
        if (attempt) target.searchParams.set("retry", String(Date.now()));
        const response = await fetch(target, {
          method: "GET", mode: "cors", credentials: "omit",
          cache: "no-store", priority: "high", signal
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const total = Number(response.headers.get("content-length")) || 0;
        if (!response.body?.getReader) return await response.arrayBuffer();
        const reader = response.body.getReader();
        const chunks = [];
        let received = 0;
        while (true) {
          const part = await reader.read();
          if (part.done) break;
          chunks.push(part.value);
          received += part.value.byteLength;
          onProgress(received, total);
        }
        const bytes = new Uint8Array(received);
        let offset = 0;
        chunks.forEach(chunk => { bytes.set(chunk, offset); offset += chunk.byteLength; });
        return bytes.buffer;
      } catch (error) {
        lastError = error;
        if (signal?.aborted || attempt) throw error;
        await new Promise(resolve => window.setTimeout(resolve, 350));
      }
    }
    throw lastError || new Error("Não foi possível baixar o CBZ.");
  }

  function prefetchReaderFile(item) {
    if (!item || item.local) return null;
    if (navigator.onLine === false || state.session?.offline) return null;
    const url = item.fileUrl || item.telegramUrl || "";
    const format = String(item.format || extension(url)).toLowerCase();
    if (!/^https?:\/\//i.test(url) || !["pdf", "cbz", "cbr"].includes(format)) return null;
    if (readerFilePrefetches.has(url)) return readerFilePrefetches.get(url);
    if (readerFilePrefetches.size >= MAX_READER_PREFETCHES) return null;
    const promise = fetchFileArrayBuffer(url);
    readerFilePrefetches.set(url, promise);
    promise.catch(() => { if (readerFilePrefetches.get(url) === promise) readerFilePrefetches.delete(url); });
    window.setTimeout(() => { if (readerFilePrefetches.get(url) === promise) readerFilePrefetches.delete(url); }, 30000);
    return promise;
  }

  const sectionRoutes = {
    home: "",
    comic: "quadrinhos",
    ranking: "ranking",
    factions: "faccoes",
    collections: "colecoes",
    search: "pesquisar",
    shelf: "estante",
    downloads: "downloads",
    "local-box": "caixa",
    login: "entrar",
    signup: "cadastro",
    entity: "entidade"
  };

  function routeUrl(params = {}) {
    const url = new URL(window.location.href);
    url.search = "";
    url.hash = "";
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, value);
    });
    return `${url.pathname}${url.search}`;
  }

  function activateOfflineMode() {
    if (navigator.onLine !== false) return false;
    if (state.session?.offline) return true;
    const savedAccount = readOfflineAccount();
    const user = savedAccount?.user || state.session?.user;
    if (!user) return false;
    state.session = { user, offline: true };
    state.profile = offlineProfileFor(user, savedAccount?.profile || state.profile, savedAccount?.username || "");
    state.authReady = true;
    if (state.presenceInterval) clearInterval(state.presenceInterval);
    state.presenceInterval = null;
    state.notificationChannel?.unsubscribe?.();
    state.notificationChannel = null;
    sb?.removeAllChannels?.();
    sb?.auth?.stopAutoRefresh?.();
    loadDownloads();
    syncTopAvatar();
    render();
    return true;
  }

  function navigate(params, replace = false) {
    const offlineNavigation = navigator.onLine === false && activateOfflineMode();
    if (offlineNavigation) params = { pagina: "downloads" };
    const url = routeUrl(params);
    if (replace) window.history.replaceState({}, "", url);
    else window.history.pushState({}, "", url);
    applyRoute();
  }

  function setSectionRoute(section, replace = false) {
    const route = sectionRoutes[section];
    if (route === undefined) return setSection(section);
    const params = new URLSearchParams(window.location.search);
    const currentPage = params.get("pagina") || "";
    if (state.section === section && currentPage === (route || "")) return;
    navigate(route ? { pagina: route } : {}, replace);
  }

  function applyRoute() {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    const params = new URLSearchParams(window.location.search);
    const readerId = params.get("ler");
    const page = params.get("pagina") || "";
    const section = params.get("colecao") ? "collection" : Object.keys(sectionRoutes).find(key => sectionRoutes[key] === page) || "home";
    const item = readerId ? state.db.library.find(entry => entry.id === readerId) : null;

    activeReaderCleanup?.();
    activeReaderCleanup = null;
    handlingRoute = true;
    if (readerId && item) {
      state.section = "reader";
      state.readerItemId = readerId;
      render();
      openReader(item, { routeSync: true });
    } else {
      const previousSection = state.section;
      state.section = section;
      if (section === "home" && previousSection !== "home") {
        state.homeRandomPublisher = null;
        state.homeRandomCharacter = null;
      }
      state.collectionId = params.get("colecao") || null;
      state.rankingCategory = section === "ranking" ? params.get("categoria") || null : null;
      const factionRouteValue = section === "factions" ? params.get("faccao") || null : null;
      const routedFaction = factionRouteValue ? state.factions.find(faction => String(faction.page_key) === String(factionRouteValue) || faction.id === factionRouteValue) : null;
      state.factionPageId = routedFaction?.id || factionRouteValue;
      state.factionMembersView = section === "factions" && params.get("membros") === "1";
      state.factionMemberSearch = state.factionMembersView ? params.get("busca") || "" : "";
      if (section === "blog") state.blogOpenId = params.get("blog") || null;
      if (section === "search") state.search = params.get("q") || "";
      if (section === "entity") state.entityFilter = { kind: params.get("tipo") || "character", value: params.get("valor") || "" };
      render();
      if (section === "blog" && !state.blogPosts.length) loadBlogPosts();
      if (section === "ranking" && state.authReady) loadRankingData();
      if (section === "ranking" && params.get("secao") === "faccoes") setTimeout(() => $(".ranking-faction-overview")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
    }
    handlingRoute = false;
  }

  const sb = window.supabase?.createClient && window.BANCA_SUPABASE_URL
    ? window.supabase.createClient(window.BANCA_SUPABASE_URL, window.BANCA_SUPABASE_KEY)
    : null;

  async function loadComicReadCounts() {
    if (!sb || navigator.onLine === false) return;
    const result = await sb.from("comic_read_counts").select("item_id, clicks");
    if (result.error) {
      console.warn("NÃ£o foi possÃ­vel carregar as quantidades de leitura:", result.error.message);
      return;
    }
    const counts = new Map((result.data || []).map(row => [String(row.item_id), Number(row.clicks) || 0]));
    state.db.library.forEach(item => {
      item.clicks = counts.get(String(item.id)) || 0;
    });
  }

  async function loadComicDownloadCounts() {
    if (!sb || navigator.onLine === false) return;
    const result = await sb.from("comic_download_counts").select("item_id, downloads");
    if (result.error) {
      console.warn("Não foi possível carregar as quantidades de download:", result.error.message);
      return;
    }
    const counts = new Map((result.data || []).map(row => [String(row.item_id), Number(row.downloads) || 0]));
    state.db.library.forEach(item => { item.downloadCount = counts.get(String(item.id)) || 0; });
  }

  async function loadComicMonthlyReadCounts() {
    if (!sb || navigator.onLine === false) return;
    const now = new Date();
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    const result = await sb.from("comic_monthly_read_counts").select("item_id, clicks").eq("month_start", monthStart);
    if (result.error) {
      console.warn("Não foi possível carregar as leituras do mês:", result.error.message);
      return;
    }
    state.comicMonthlyReadCounts = new Map((result.data || []).map(row => [String(row.item_id), Number(row.clicks) || 0]));
    state.comicMonthlyReadCountsLoaded = true;
  }

  const HOME_SECTION_ORDER = [
    "recommendations", "character-banner", "continue", "recent", "new-series", "monthly", "pinned-publishers", "best-series",
    "featured-collections", "random", "tips", "artist", "random-publisher", "downloads", "most-read-covers"
  ];

  function normalizeHomeSectionOrder(value) {
    const saved = Array.isArray(value) ? value.filter(key => HOME_SECTION_ORDER.includes(key)) : [];
    const unique = [...new Set(saved)];
    return [...unique, ...HOME_SECTION_ORDER.filter(key => !unique.includes(key))];
  }

  async function loadHomepageSettings() {
    if (!sb || navigator.onLine === false) return;
    const result = await sb.from("homepage_settings").select("section_order").eq("id", true).maybeSingle();
    if (result.error) {
      console.warn("Não foi possível carregar a ordem da página inicial:", result.error.message);
      return;
    }
    state.homeSectionOrder = normalizeHomeSectionOrder(result.data?.section_order);
  }

  async function recordComicDownload(item) {
    if (!item || item.local || !item.id) return;
    if (!sb) {
      item.downloadCount = (Number(item.downloadCount) || 0) + 1;
      save();
      return;
    }
    const result = await sb.rpc("increment_comic_download", { p_item_id: String(item.id) });
    if (result.error) {
      console.warn("Não foi possível registrar o download:", result.error.message);
      return;
    }
    item.downloadCount = Number(result.data) || 0;
  }

  async function recordComicRead(item) {
    if (!item || item.local || !item.id) return;
    if (!sb) {
      item.clicks = (Number(item.clicks) || 0) + 1;
      state.comicMonthlyReadCounts.set(String(item.id), (state.comicMonthlyReadCounts.get(String(item.id)) || 0) + 1);
      save();
      return;
    }
    const result = await sb.rpc("increment_comic_read", { p_item_id: String(item.id) });
    if (result.error) {
      console.warn("NÃ£o foi possÃ­vel registrar a leitura:", result.error.message);
      return;
    }
    item.clicks = Number(result.data) || 0;
    const itemKey = String(item.id);
    state.comicMonthlyReadCounts.set(itemKey, (state.comicMonthlyReadCounts.get(itemKey) || 0) + 1);
    if (state.session?.user?.id) await sb.rpc("grant_profile_xp", { p_event_type: "read", p_event_key: `read:${item.id}` });
    $$('[data-open]').filter(element => element.dataset.open === item.id).forEach(cardElement => {
      const stats = $(".card-stats", cardElement);
      if (stats) stats.textContent = `♥ ${item.clicks.toLocaleString("pt-BR")} leituras`;
    });
  }

  async function startPresence() {
    if (!sb || !state.session?.user?.id || state.session?.offline || navigator.onLine === false) return;
    if (state.presenceInterval) clearInterval(state.presenceInterval);
    const heartbeat = async () => {
      try {
        const result = await sb.rpc("touch_profile");
        if (result.error) {
          const message = String(result.error.message || "");
          if (/network|fetch|address unreachable|offline|failed/i.test(message)) return false;
          return true;
        }
        if (state.section === "ranking") loadRankingData(true);
        return true;
      } catch (error) {
        const message = String(error?.message || error || "");
        if (/network|fetch|address unreachable|offline|failed/i.test(message)) return false;
        console.warn("NÃ£o foi possÃ­vel atualizar a presenÃ§a:", message);
        return true;
      }
    };
    if (await heartbeat()) state.presenceInterval = setInterval(async () => {
      if (!(await heartbeat())) {
        clearInterval(state.presenceInterval);
        state.presenceInterval = null;
      }
    }, 60000);
  }

  async function loadRankingData(silent = false) {
    if (state.session?.offline || navigator.onLine === false) return;
    if (!sb || state.rankingLoading) return;
    state.rankingLoading = true;
    if (!silent) render();
    const result = await sb.rpc("get_profile_ranking", { p_period: state.rankingPeriod, p_limit: 500 });
    state.rankingMembers = result.error ? [] : (result.data || []);
    const rankingIds = state.rankingMembers.map(member => member.user_id).filter(Boolean);
    const factionRows = rankingIds.length ? await sb.from("profiles").select("id, faction_id").in("id", rankingIds) : { data: [] };
    state.factionByUser = new Map((factionRows.data || []).map(row => [row.id, row.faction_id]));
    state.rankingMembers = state.rankingMembers.map(member => ({ ...member, faction_id: state.factionByUser.get(member.user_id) || null }));
    state.rankingLoading = false;
    if (state.section === "ranking") render();
  }

  async function awardProfileXp(eventType, eventKey) {
    if (!sb || !state.session?.user?.id) return;
    await sb.rpc("grant_profile_xp", { p_event_type: eventType, p_event_key: eventKey });
    await sb.rpc("grant_faction_xp", { p_event_type: eventType, p_event_key: eventKey });
  }

  async function loadFactions() {
    if (!sb) return;
    const result = await sb.from("factions").select("id, page_key, name, color, emblem, description, sort_order, abafac_order, abafac_catalog_url").order("sort_order", { ascending: true });
    state.factions = result.error ? [] : (result.data || []);
    const routeFactionKey = new URLSearchParams(window.location.search).get("faccao");
    if (state.section === "factions" && routeFactionKey) {
      const routeFaction = state.factions.find(faction => String(faction.page_key) === String(routeFactionKey) || faction.id === routeFactionKey);
      if (routeFaction) {
        state.factionPageId = routeFaction.id;
        if (routeFaction.page_key && String(routeFaction.page_key) !== String(routeFactionKey)) {
          const params = new URLSearchParams(window.location.search);
          params.set("faccao", String(routeFaction.page_key));
          window.history.replaceState({}, "", `${window.location.pathname}?${params.toString()}`);
        }
      }
    }
    state.factionAbafacCatalogs = new Map();
    await Promise.all(state.factions.filter(faction => faction.abafac_catalog_url).map(async faction => {
      const parts = parsePublicCatalogLink(faction.abafac_catalog_url);
      if (!parts) return;
      const owner = await sb.from("profiles").select("id, username").ilike("username", parts.username).maybeSingle();
      if (owner.error || !owner.data) return;
      const collection = await sb.from("shelf_collections").select("id, owner_id, name, cover_url, is_public, item_ids, collection_type, cover_styles, cover_choices").eq("id", parts.collectionId).eq("owner_id", owner.data.id).eq("is_public", true).eq("collection_type", "comic").maybeSingle();
      if (collection.error || !collection.data) return;
      state.factionAbafacCatalogs.set(faction.id, { ...collection.data, username: owner.data.username });
    }));
    const abafacImages = await sb.from("faction_abafac_images").select("id, faction_id, image_url, link_url, storage_path, created_by, created_at").order("created_at", { ascending: true });
    state.factionAbafacImages = abafacImages.error ? [] : (abafacImages.data || []);
    if (state.session?.user?.id && state.factions.length) {
      const factionsToRepair = ["moderator", "admin"].includes(state.profile?.plan) ? state.factions : state.factions.filter(faction => faction.id === state.profile?.faction_id);
      await Promise.all(factionsToRepair.map(faction => sb.rpc("ensure_faction_leadership", { p_faction_id: faction.id })));
    }
    const roles = await sb.from("faction_roles").select("user_id, faction_id, role, slot");
    state.factionRoles = roles.error ? [] : (roles.data || []);
    const roleIds = state.factionRoles.map(role => role.user_id).filter(Boolean);
    const roleProfiles = roleIds.length ? await sb.from("profiles").select("id, username, avatar_url, title, plan, faction_id").in("id", roleIds) : { data: [] };
    const roleProfileMap = new Map((roleProfiles.data || []).map(profile => [profile.id, profile]));
    state.factionRoleMembers = state.factionRoles.map(role => ({ ...role, profile: roleProfileMap.get(role.user_id) || null }));
    const memberships = await sb.from("faction_memberships").select("user_id, faction_id, joined_at").order("joined_at", { ascending: false });
    const memberIds = (memberships.data || []).map(row => row.user_id).filter(Boolean);
    const memberProfiles = memberIds.length ? await sb.from("profiles").select("id, username, avatar_url, title, title_color, faction_id").in("id", memberIds) : { data: [] };
    const memberProfileMap = new Map((memberProfiles.data || []).map(profile => [profile.id, profile]));
    state.factionMembers = (memberships.data || []).map(row => ({ ...row, profile: memberProfileMap.get(row.user_id) || null }));
    const season = await sb.from("faction_seasons").select("id, starts_at").order("season_key", { ascending: false }).limit(1).maybeSingle();
    const xp = season.data?.id ? await sb.from("faction_xp_events").select("faction_id, xp").eq("season_id", season.data.id) : { data: [] };
    const adjustments = season.data?.id ? await sb.from("faction_xp_adjustments").select("faction_id, amount").gte("created_at", season.data.starts_at) : { data: [] };
    const stats = new Map(state.factions.map(faction => [faction.id, { members: 0, xp: 0 }]));
    (memberships.data || []).forEach(row => { if (stats.has(row.faction_id)) stats.get(row.faction_id).members += 1; });
    (xp.data || []).forEach(row => { if (stats.has(row.faction_id)) stats.get(row.faction_id).xp += Number(row.xp) || 0; });
    (adjustments.data || []).forEach(row => { if (stats.has(row.faction_id)) stats.get(row.faction_id).xp += Number(row.amount) || 0; });
    state.factionStats = stats;
  }

  async function joinFaction(factionId) {
    if (!sb || !state.session?.user?.id || !factionId || ["moderator", "admin"].includes(state.profile?.plan)) return;
    const result = await sb.rpc("choose_faction", { p_faction_id: factionId });
    if (result.error) return toast(result.error.message || "Não foi possível entrar nesta facção.");
    const selected = result.data?.[0];
    state.profile = { ...state.profile, faction_id: selected?.faction_id, faction_joined_at: selected?.changed_at || state.profile.faction_joined_at, faction_changed_at: selected?.changed_at || state.profile.faction_changed_at };
    await loadFactions();
    render();
    toast(`Você agora faz parte de ${selected?.name || "uma nova facção"}.`);
  }

  function factionDot(profile = {}) {
    const factionId = profile.faction_id || state.factionByUser.get(profile.id);
    const faction = state.factions.find(item => item.id === factionId) || { color: profile.faction_color, name: "Facção", emblem: "" };
    return faction?.emblem ? `<button type="button" class="faction-emblem-button" data-faction-open="${escapeHTML(factionId || "")}" title="Abrir ${escapeHTML(faction.name || "Facção")}" aria-label="Abrir ${escapeHTML(faction.name || "Facção")}">${escapeHTML(faction.emblem)}</button>` : "";
  }

  function factionRouteKey(factionId) {
    const faction = state.factions.find(item => item.id === factionId);
    return faction?.page_key ? String(faction.page_key) : factionId;
  }

  function factionName(profile = {}, username = "usuário") {
    return `${factionDot(profile)}@${escapeHTML(username || "usuário")}`;
  }

  function decorateFactionNames(root = document) {
    const profiles = [
      state.profile,
      state.publicProfile?.profile,
      ...(state.rankingMembers || []),
      ...(state.factionMembers || []).map(item => item.profile),
      ...(state.factionRoleMembers || []).map(item => item.profile),
      ...(state.notifications || []).map(item => item.actor),
      ...(state.blogPosts || []).map(item => item.author),
      ...(state.authoredBlogPosts || []).map(item => item.author),
      ...(state.savedBlogPosts || []).map(item => item.author),
      ...(state.collectionBlogPosts || []).map(item => item.author)
    ].filter(profile => profile?.username && profile?.faction_id);
    const byUsername = new Map(profiles.map(profile => [String(profile.username).toLowerCase(), profile]));
    if (!byUsername.size) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(node => {
      const parent = node.parentElement;
      if (!parent || ["SCRIPT", "STYLE", "TEXTAREA", "INPUT", "OPTION"].includes(parent.tagName) || parent.closest(".faction-emblem-button") || parent.querySelector(".faction-emblem-button")) return;
      const text = node.nodeValue || "";
      const matches = [...text.matchAll(/@([A-Za-z0-9_]{3,24})/g)];
      if (!matches.length) return;
      const fragment = document.createDocumentFragment();
      let cursor = 0;
      matches.forEach(match => {
        const profile = byUsername.get(match[1].toLowerCase());
        if (!profile) return;
        fragment.appendChild(document.createTextNode(text.slice(cursor, match.index)));
        const faction = state.factions.find(item => item.id === profile.faction_id);
        if (faction?.emblem) {
          const emblem = document.createElement("button");
          emblem.type = "button";
          emblem.className = "faction-emblem-button";
          emblem.dataset.factionOpen = profile.faction_id;
          emblem.textContent = faction.emblem;
          emblem.title = faction.name || "Facção";
          emblem.setAttribute("aria-label", faction.name || "Facção");
          fragment.appendChild(emblem);
        }
        fragment.appendChild(document.createTextNode(match[0]));
        cursor = match.index + match[0].length;
      });
      if (cursor) {
        fragment.appendChild(document.createTextNode(text.slice(cursor)));
        node.replaceWith(fragment);
      }
    });
  }

  function factionOverviewMarkup() {
    return `<div class="faction-overview-grid">${state.factions.map(faction => { const stats = state.factionStats.get(faction.id) || { members: 0, xp: 0 }; const current = state.profile?.faction_id === faction.id; return `<article class="faction-overview-card ${current ? "is-current" : ""}" data-faction-open="${escapeHTML(faction.id)}" style="--faction-color:${escapeHTML(faction.color)}" tabindex="0" role="link"><span class="faction-overview-emblem">${escapeHTML(faction.emblem)}</span><span><strong>${escapeHTML(faction.name)}</strong><small>${stats.members} membro(s) · ${stats.xp.toLocaleString("pt-BR")} XP</small></span></article>`; }).join("")}</div>`;
  }

  function factionOverviewNoticeMarkup() {
    if (!state.session) return '<div class="notice faction-access-notice">Você não tem uma facção. Faça login ou crie uma conta para entrar em uma.</div>';
    if (["moderator", "admin"].includes(state.profile?.plan)) return '<div class="notice faction-access-notice">Moderadores e administradores não podem participar de facções.</div>';
    if (!state.profile?.faction_id) return '<div class="notice faction-access-notice">Você ainda não tem uma facção. Escolha uma para participar da disputa.</div>';
    return "";
  }

  function openFactionConfirm(faction) {
    return new Promise(resolve => {
      const color = faction?.color || "#e85b68";
      const overlay = document.createElement("div");
    overlay.className = "modal-backdrop faction-modal-backdrop";
    overlay.innerHTML = `<div class="modal faction-modal" style="--faction-color:${escapeHTML(color)}"><div class="section-head"><div><div class="eyebrow">${escapeHTML(faction?.name || "Facção")}</div><h2>Desistir da liderança?</h2><div class="section-subtitle">O curador mais ativo assumirá o cargo.</div></div></div><div class="modal-actions"><button type="button" class="small-btn" data-faction-modal-cancel>Cancelar</button><button type="button" class="small-btn faction-modal-primary" data-faction-modal-confirm>Desistir da liderança</button></div></div>`;
    overlay.innerHTML = overlay.innerHTML.replaceAll("Desistir da liderança", "Renunciar");
      const finish = value => { overlay.remove(); resolve(value); };
      overlay.addEventListener("click", event => { if (event.target === overlay) finish(false); });
      $("[data-faction-modal-cancel]", overlay).onclick = () => finish(false);
      $("[data-faction-modal-confirm]", overlay).onclick = () => finish(true);
      $("#modal-root").appendChild(overlay);
    });
  }

  function openFactionIdentityEditorV2(faction) {
    return new Promise(resolve => {
      const currentColor = String(faction?.color || FACTION_COLOR_OPTIONS[0].light).toLowerCase();
      const currentEmblem = FACTION_EMBLEM_OPTIONS.includes(faction?.emblem) ? faction.emblem : FACTION_EMBLEM_OPTIONS[0];
      const otherColors = new Set(state.factions.filter(item => item.id !== faction?.id).map(item => String(item.color || "").toLowerCase()));
      const usedFamilies = new Set(FACTION_COLOR_OPTIONS.filter(option => otherColors.has(option.light) || otherColors.has(option.dark)).map(option => option.family));
      const blockedLabels = FACTION_COLOR_OPTIONS.filter(option => usedFamilies.has(option.family)).map(option => option.label);
      const otherEmblems = new Set(state.factions.filter(item => item.id !== faction?.id).map(item => item.emblem).filter(Boolean));
      let colorChoices = FACTION_COLOR_OPTIONS.map(option => [
        { tone: "claro", value: option.light },
        { tone: "escuro", value: option.dark }
      ].map(choice => {
        const blocked = usedFamilies.has(option.family) && currentColor !== choice.value;
        const selected = currentColor === choice.value;
        return `<button type="button" class="faction-color-choice ${selected ? "is-selected" : ""}" data-color="${choice.value}" style="--choice-color:${choice.value}" ${blocked ? "disabled" : ""} aria-label="${option.label} ${choice.tone}" title="${blocked ? "Cor já usada por outra facção" : `${option.label} · ${choice.tone}`}"${blocked ? " aria-disabled=\"true\"" : ""}></button>`;
      }).join("")).join("");
      colorChoices = colorChoices.replace(/<button([^>]*data-color="([^"]+)"[^>]*)><\/button>/g, (_, attributes, value) => {
        const option = FACTION_COLOR_OPTIONS.find(item => item.light === value || item.dark === value);
        const tone = option?.light === value ? "claro" : "escuro";
        return `<button${attributes}><span>${escapeHTML(option?.label || "Cor")}<small>${tone}</small></span></button>`;
      });
      if (blockedLabels.length) colorChoices += `<small class="faction-identity-warning">Bloqueadas por já pertencerem a outras facções: ${escapeHTML(blockedLabels.join(", "))}.</small>`;
      const emblemChoices = FACTION_EMBLEM_OPTIONS.map(emblem => { const blocked = otherEmblems.has(emblem); return `<button type="button" class="faction-emblem-choice ${emblem === currentEmblem ? "is-selected" : ""}" data-emblem="${escapeHTML(emblem)}" ${blocked ? "disabled" : ""} aria-disabled="${blocked ? "true" : "false"}" aria-label="Emoji ${escapeHTML(emblem)}" title="${blocked ? "Emoji já usado por outra facção" : "Escolher este emoji"}">${escapeHTML(emblem)}</button>`; }).join("");
      const overlay = document.createElement("div");
      overlay.className = "modal-backdrop faction-modal-backdrop";
      overlay.innerHTML = `<div class="modal faction-modal faction-identity-modal" style="--faction-color:${escapeHTML(currentColor)}"><div class="section-head"><div><div class="eyebrow">Identidade da facção</div><h2>Editar facção</h2><div class="section-subtitle">Escolha a cor, o emoji e a descrição da sua facção.</div></div><button type="button" class="small-btn" data-faction-modal-close>Fechar</button></div><form class="faction-identity-form"><label class="field"><span>Nome da facção</span><input name="name" type="text" minlength="3" maxlength="80" value="${escapeHTML(faction?.name || "")}" required></label><div class="field"><span>Cor da facção</span><div class="faction-color-palette">${colorChoices}</div><small class="faction-identity-help">Em cada cor, o quadrado da esquerda é claro e o da direita é escuro. Quadrados apagados já pertencem a outra facção.</small><input name="color" type="hidden" value="${escapeHTML(currentColor)}"></div><div class="field"><span>Emoji da facção</span><div class="faction-emblem-palette">${emblemChoices}</div><input name="emblem" type="hidden" value="${escapeHTML(currentEmblem)}"></div><label class="field"><span>Descrição</span><textarea name="description" maxlength="500" rows="4">${escapeHTML(faction?.description || "")}</textarea></label><label class="field"><span>Catálogo público como abafac (opcional)</span><input name="catalogUrl" type="text" maxlength="500" value="${escapeHTML(faction?.abafac_catalog_url || "")}" placeholder="?perfil=usuario&lista=id"><small class="faction-identity-help">Cole o link de uma coleção pública de quadrinhos deste site. Deixe vazio para remover o catálogo.</small></label><label class="field"><span>Enviar imagem abafac</span><input name="abafacImage" type="file" accept="image/png,image/jpeg,image/webp,image/gif"><small class="faction-identity-help">A imagem será adicionada como uma nova abafac. Depois ela poderá ser movida ou removida, mas uma imagem removida precisará ser enviada novamente.</small></label><label class="field"><span>Link interno da imagem (opcional)</span><input name="abafacLink" type="text" maxlength="500" placeholder="?pagina=blogs ou /index.html?pagina=ranking"><small class="faction-identity-help">Aceita somente destinos dentro deste site. O link será aplicado ao card inteiro.</small></label><div class="modal-actions"><button type="button" class="small-btn" data-faction-modal-cancel>Cancelar</button><button type="submit" class="small-btn faction-modal-primary">Salvar alterações</button></div></form></div>`;
      const finish = value => { overlay.remove(); resolve(value); };
      const modal = $(".faction-modal", overlay);
      const form = $(".faction-identity-form", overlay);
      form.elements.abafacLink?.closest("label")?.remove();
      $$('[data-color]', form).forEach(button => button.addEventListener("click", () => {
        const value = button.dataset.color;
        $('[name=color]', form).value = value;
        modal.style.setProperty("--faction-color", value);
        $$('[data-color]', form).forEach(item => item.classList.toggle("is-selected", item === button));
      }));
      $$('[data-emblem]', form).forEach(button => button.addEventListener("click", () => {
        $('[name=emblem]', form).value = button.dataset.emblem;
        $$('[data-emblem]', form).forEach(item => item.classList.toggle("is-selected", item === button));
      }));
      form.addEventListener("submit", event => { event.preventDefault(); const data = new FormData(form); finish({ name: String(data.get("name") || "").trim(), color: String(data.get("color") || "").trim(), emblem: String(data.get("emblem") || "").trim(), description: String(data.get("description") || "").trim(), catalogUrl: String(data.get("catalogUrl") || "").trim(), imageFile: form.elements.abafacImage?.files?.[0] || null, imageLink: String(data.get("abafacLink") || "").trim() }); });
      overlay.addEventListener("click", event => { if (event.target === overlay) finish(null); });
      $("[data-faction-modal-close]", overlay).onclick = () => finish(null);
      $("[data-faction-modal-cancel]", overlay).onclick = () => finish(null);
      $("#modal-root").appendChild(overlay);
      $("[name=name]", form).focus();
    });
  }

  function openFactionIdentityEditor(faction) {
    return new Promise(resolve => {
      const color = /^#[0-9A-Fa-f]{6}$/.test(faction?.color || "") ? faction.color : "#e85b68";
      const overlay = document.createElement("div");
      overlay.className = "modal-backdrop faction-modal-backdrop";
      overlay.innerHTML = `<div class="modal faction-modal faction-identity-modal" style="--faction-color:${escapeHTML(color)}"><div class="section-head"><div><div class="eyebrow">Identidade da facção</div><h2>Editar facção</h2><div class="section-subtitle">Atualize o nome, a cor e a descrição exibidos para a comunidade.</div></div><button type="button" class="small-btn" data-faction-modal-close>Fechar</button></div><form class="faction-identity-form"><label class="field"><span>Nome da facção</span><input name="name" type="text" minlength="3" maxlength="80" value="${escapeHTML(faction?.name || "")}" required></label><label class="field"><span>Cor da facção</span><div class="faction-color-field"><input name="color" type="color" value="${escapeHTML(color)}"><input name="colorText" type="text" value="${escapeHTML(color)}" pattern="^#[0-9A-Fa-f]{6}$" maxlength="7" required></div></label><label class="field"><span>Descrição</span><textarea name="description" maxlength="500" rows="4">${escapeHTML(faction?.description || "")}</textarea></label><div class="modal-actions"><button type="button" class="small-btn" data-faction-modal-cancel>Cancelar</button><button type="submit" class="small-btn faction-modal-primary">Salvar alterações</button></div></form></div>`;
      const finish = value => { overlay.remove(); resolve(value); };
      const form = $(".faction-identity-form", overlay);
      const colorInput = $("[name=color]", form);
      const colorText = $("[name=colorText]", form);
      colorInput.addEventListener("input", () => { colorText.value = colorInput.value; overlay.querySelector(".faction-modal").style.setProperty("--faction-color", colorInput.value); });
      colorText.addEventListener("input", () => { if (/^#[0-9A-Fa-f]{6}$/.test(colorText.value)) { colorInput.value = colorText.value; overlay.querySelector(".faction-modal").style.setProperty("--faction-color", colorText.value); } });
      form.addEventListener("submit", event => { event.preventDefault(); const data = new FormData(form); finish({ name: String(data.get("name") || "").trim(), color: String(data.get("colorText") || "").trim(), description: String(data.get("description") || "").trim() }); });
      overlay.addEventListener("click", event => { if (event.target === overlay) finish(null); });
      $("[data-faction-modal-close]", overlay).onclick = () => finish(null);
      $("[data-faction-modal-cancel]", overlay).onclick = () => finish(null);
      $("#modal-root").appendChild(overlay);
      $("[name=name]", form).focus();
    });
  }

  function openFactionChoice() {
    if (!state.session || !state.profile || ["moderator", "admin"].includes(state.profile.plan) || state.factionChoiceOpen || !state.factions.length) return;
    state.factionChoiceOpen = true;
    const overlay = document.createElement("div");
    overlay.className = "modal-backdrop faction-choice-backdrop";
    overlay.innerHTML = `<div class="modal faction-choice-modal"><div class="section-head"><div><div class="eyebrow">Uma casa para sua jornada</div><h2>${state.profile.faction_id ? "Trocar de facção" : "Escolha sua facção"}</h2><div class="section-subtitle">${state.profile.faction_id ? "A troca pode ser feita uma vez a cada sete dias." : "Faça parte de uma comunidade, ajude sua facção e dispute a temporada."}</div></div><button class="small-btn" data-close>Fechar</button></div><div class="faction-choice-grid">${state.factions.map(faction => `<button class="faction-choice-card ${state.profile.faction_id === faction.id ? "is-current" : ""}" type="button" data-faction-choose="${escapeHTML(faction.id)}" style="--faction-color:${escapeHTML(faction.color)}"><span class="faction-choice-emblem">${escapeHTML(faction.emblem)}</span><strong>${escapeHTML(faction.name)}</strong><span>${escapeHTML(faction.description)}</span></button>`).join("")}</div>${state.profile.faction_id ? "" : '<button class="small-btn faction-auto-choice" type="button" data-faction-auto>Escolher a facção com menor presença</button>'}</div>`;
    $("#modal-root").appendChild(overlay);
    $("[data-close]", overlay).onclick = () => choose(null);
    const choose = async factionId => {
      const result = await sb.rpc("choose_faction", { p_faction_id: factionId || null });
      if (result.error) return toast(result.error.message || "Não foi possível escolher sua facção.");
      const selected = result.data?.[0];
      state.profile = { ...state.profile, faction_id: selected?.faction_id, faction_joined_at: selected?.changed_at || state.profile.faction_joined_at, faction_changed_at: selected?.changed_at || state.profile.faction_changed_at };
      if (selected?.faction_id) await sb.rpc("ensure_faction_leadership", { p_faction_id: selected.faction_id });
      // Recarrega cargos e membros antes de renderizar a página da facção.
      // Sem isso, a tela continuava usando a lista anterior ao ingresso.
      await loadFactions();
      state.factionChoiceOpen = false;
      overlay.remove();
      render();
      toast(`Você agora faz parte de ${selected?.name || "uma nova facção"}.`);
    };
    $$('[data-faction-choose]', overlay).forEach(button => button.onclick = () => choose(button.dataset.factionChoose));
    $('[data-faction-auto]', overlay).onclick = () => choose(null);
  }

  async function publishCatalog() {
    if (!sb || state.profile?.plan !== "admin") return { skipped: true };
    const result = await sb.functions.invoke("github-catalog", {
      body: { library: compactSeriesItems(state.db.library), series: window.DEFAULT_SERIES || [], collections: state.db.collections },
    });
    if (result.error) {
      let detail = result.error.message || "Não foi possível publicar o catálogo.";
      try {
        const response = result.error.context;
        if (response?.clone) {
          const body = await response.clone().json();
          if (body?.error) detail = body.error;
        }
      } catch {}
      throw new Error(detail);
    }
    if (result.data?.error) throw new Error(result.data.error);
    return result.data;
  }

  function saveCatalog(message = "Catálogo salvo.") {
    save();
    publishCatalog()
      .then(result => {
        if (!result?.skipped) toast(`${message} GitHub atualizado.`);
      })
      .catch(error => {
        console.error("[CATALOG] Falha ao publicar no GitHub:", error);
        const detail = /failed to send a request to the edge function/i.test(error.message || "")
          ? "a Edge Function github-catalog não respondeu. Implante-a no projeto Supabase."
          : (error.message || "não foi possível publicar.");
        toast(`${message} GitHub: ${detail}`);
      });
  }

  function authEmail(username) {
    return `${String(username).replace(/^@/, '').toLowerCase()}@login.banca-digital.local`;
  }

  function cleanUsername(value) {
    return String(value || "").replace(/^@/, "").trim().toLowerCase();
  }

  function safeBlogHtml(value = "") {
    const template = document.createElement("template");
    template.innerHTML = String(value || "");
    const allowed = new Set(["B", "STRONG", "I", "EM", "U", "S", "H2", "H3", "P", "DIV", "BR", "BLOCKQUOTE", "UL", "OL", "LI", "A", "IMG"]);
    template.content.querySelectorAll("*").forEach(node => {
      if (!allowed.has(node.tagName)) {
        node.replaceWith(...Array.from(node.childNodes));
        return;
      }
      const href = node.tagName === "A" ? node.getAttribute("href") || "" : "";
      const src = node.tagName === "IMG" ? node.getAttribute("src") || "" : "";
      const style = node.getAttribute("style") || "";
      [...node.attributes].forEach(attribute => node.removeAttribute(attribute.name));
      if (node.tagName === "A") {
        if (!/^https?:\/\//i.test(href)) node.replaceWith(...Array.from(node.childNodes));
        else {
          node.setAttribute("href", href);
          node.setAttribute("target", "_blank");
          node.setAttribute("rel", "noopener noreferrer");
        }
      }
      if (node.tagName === "IMG") {
        if (!/^https?:\/\//i.test(src)) node.replaceWith(...Array.from(node.childNodes));
        else {
          node.setAttribute("src", src);
          node.setAttribute("alt", "Imagem inserida no artigo");
          node.setAttribute("loading", "lazy");
        }
      }
      if ((node.tagName === "P" || node.tagName === "DIV") && /^text-align\s*:\s*(left|center|right|justify)\s*;?$/i.test(style.trim())) {
        node.setAttribute("style", `text-align: ${style.split(":")[1].replace(";", "").trim()}`);
      }
    });
    return template.innerHTML.trim();
  }

  function openBlogLinkDialog() {
    const editor = $("#blog-editor");
    if (!editor) return;
    const selection = window.getSelection();
    const savedRange = selection?.rangeCount ? selection.getRangeAt(0).cloneRange() : null;
    const overlay = document.createElement("div");
    overlay.className = "modal-backdrop";
    overlay.innerHTML = '<div class="modal blog-link-modal"><div class="section-head"><div><h2>Adicionar link</h2><div class="section-subtitle">Cole o endereço do link:</div></div><button type="button" class="small-btn" data-close>Fechar</button></div><form id="blog-link-form"><div class="field"><label>Endereço</label><input name="url" type="url" required placeholder="https://exemplo.com"></div><div class="modal-actions"><button type="button" class="small-btn" data-close>Cancelar</button><button type="submit" class="btn btn-danger">Adicionar link</button></div></form></div>';
    $("#modal-root").appendChild(overlay);
    const close = () => overlay.remove();
    $$('[data-close]', overlay).forEach(button => button.addEventListener("click", close));
    overlay.addEventListener("click", event => { if (event.target === overlay) close(); });
    $("#blog-link-form", overlay)?.addEventListener("submit", event => {
      event.preventDefault();
      const url = String(new FormData(event.currentTarget).get("url") || "").trim();
      if (!/^https?:\/\//i.test(url)) return toast("Use um endereço começando com http:// ou https://.");
      editor.focus();
      const currentSelection = window.getSelection();
      currentSelection?.removeAllRanges();
      if (savedRange) currentSelection?.addRange(savedRange);
      if (currentSelection?.toString().trim()) document.execCommand("createLink", false, url);
      else document.execCommand("insertHTML", false, `<a href="${escapeHTML(url)}">${escapeHTML(url)}</a>`);
      close();
    });
    $("input[name=url]", overlay)?.focus();
  }

  function blogDate(value) {
    if (!value) return "";
    return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
  }

  function blogImageStyle(url) {
    return url ? `style="background-image:url('${escapeHTML(url)}')"` : "";
  }

  async function loadBlogPosts() {
    if (!sb) {
      state.blogError = "A autenticação ainda não foi configurada.";
      render();
      return;
    }
    state.blogLoading = true;
    state.blogError = "";
    render();
    const result = await sb.from("blog_posts")
      .select("id, author_id, title, excerpt, content_html, cover_url, image_2_url, image_3_url, status, is_featured, created_at, updated_at, published_at")
      .eq("status", "published")
      .order("is_featured", { ascending: false })
      .order("published_at", { ascending: false });
    state.blogLoading = false;
    if (result.error) {
      console.error("[BLOGS] Falha ao carregar blog_posts:", result.error);
      state.blogError = "Não foi possível carregar os blogs. Execute a atualização do schema no Supabase.";
      state.blogPosts = [];
    } else {
      const posts = result.data || [];
      const authorIds = [...new Set(posts.map(post => post.author_id).filter(Boolean))];
      const authors = authorIds.length ? await sb.from("profiles").select("id, username, avatar_url, title, title_color, plan, faction_id").in("id", authorIds) : { data: [] };
      const authorsById = new Map((authors.data || []).map(author => [author.id, author]));
      state.blogPosts = posts.map(post => ({ ...post, author: authorsById.get(post.author_id) || null }));
      const blogIds = state.blogPosts.map(post => post.id);
      const likes = blogIds.length ? await sb.from("blog_likes").select("blog_id, user_id").in("blog_id", blogIds) : { data: [] };
      const comments = blogIds.length ? await sb.from("blog_comments").select("blog_id").in("blog_id", blogIds) : { data: [] };
      const saves = blogIds.length && state.session?.user?.id ? await sb.from("blog_saves").select("blog_id").eq("user_id", state.session.user.id).in("blog_id", blogIds) : { data: [] };
      state.blogSaveIds = new Set((saves.data || []).map(row => String(row.blog_id)));
      state.blogLikeIds = new Set((likes.data || []).filter(row => row.user_id === state.session?.user?.id).map(row => String(row.blog_id)));
      state.blogLikeCounts = (likes.data || []).reduce((counts, row) => counts.set(String(row.blog_id), (counts.get(String(row.blog_id)) || 0) + 1), new Map());
      state.blogCommentCounts = (comments.data || []).reduce((counts, row) => counts.set(String(row.blog_id), (counts.get(String(row.blog_id)) || 0) + 1), new Map());
    }
    render();
  }

  async function uploadBlogImage(file, index) {
    if (!file?.size) return null;
    if (!/^image\/(png|jpe?g|webp|gif)$/i.test(file.type)) throw new Error("Use imagens PNG, JPG, WEBP ou GIF.");
    if (file.size > 8 * 1024 * 1024) throw new Error("Cada imagem pode ter no máximo 8 MB.");
    const extension = String(file.name || "jpg").split(".").pop().toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
    const path = `${state.session.user.id}/${Date.now()}-${index}-${Math.random().toString(36).slice(2)}.${extension}`;
    const upload = await sb.storage.from("blog-images").upload(path, file, { upsert: false, contentType: file.type || "image/jpeg" });
    if (upload.error) throw new Error("Não foi possível enviar uma das imagens. Verifique o bucket blog-images no Supabase.");
    return sb.storage.from("blog-images").getPublicUrl(path).data.publicUrl;
  }

  function normalizeBlogImageUrl(value, required = false) {
    const raw = String(value || "").trim();
    if (!raw) return required ? false : null;
    try {
      const url = new URL(raw);
      if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return false;
      return url.href;
    } catch {
      return false;
    }
  }

  async function publishBlogPost(form) {
    if (!state.session) return openAuthPage();
    const data = new FormData(form);
    const title = String(data.get("title") || "").trim();
    const excerpt = String(data.get("excerpt") || "").trim();
    const content = safeBlogHtml($("#blog-editor")?.innerHTML || "");
    const coverUrl = normalizeBlogImageUrl(data.get("cover"), true);
    const image2Url = normalizeBlogImageUrl(data.get("image2"));
    const image3Url = normalizeBlogImageUrl(data.get("image3"));
    if (title.length < 3) return toast("Informe um título para o blog.");
    if (coverUrl === false) return toast("Informe uma URL vÃ¡lida para a capa principal.");
    if (image2Url === false || image3Url === false) return toast("Confira as URLs das imagens laterais.");
    if (!content) return toast("Escreva o conteúdo do blog antes de publicar.");
    const button = $("button[type=submit]", form);
    if (button) button.disabled = true;
    try {
      const staff = ["moderator", "admin"].includes(state.profile?.plan);
      const result = await sb.from("blog_posts").insert({
        author_id: state.session.user.id,
        title,
        excerpt: excerpt.slice(0, 500),
        content_html: content,
        cover_url: coverUrl,
        image_2_url: image2Url,
        image_3_url: image3Url,
        status: "published",
        is_featured: staff && data.get("isFeatured") === "on",
        published_at: new Date().toISOString()
      });
      if (result.error) return toast(result.error.message || "Não foi possível publicar o blog.");
      state.blogTab = "recentes";
      state.blogOpenId = null;
      await loadBlogPosts();
      toast("Blog publicado.");
    } catch (error) {
      toast(error.message || "Não foi possível publicar o blog.");
    } finally {
      if (button) button.disabled = false;
    }
  }

  async function toggleBlogFeatured(id, featured) {
    if (!["moderator", "admin"].includes(state.profile?.plan)) return;
    const result = await sb.from("blog_posts").update({ is_featured: !featured }).eq("id", id);
    if (result.error) return toast("Não foi possível atualizar o destaque.");
    await loadBlogPosts();
    toast(featured ? "Blog removido dos destaques." : "Blog destacado.");
  }

  function findBlogPost(id) {
    return [...state.blogPosts, ...state.authoredBlogPosts, ...state.savedBlogPosts].find(item => String(item.id) === String(id));
  }

  async function deleteBlogPost(id) {
    if (!state.session) return openAuthPage();
    const post = findBlogPost(id);
    if (!post) return;
    const staff = ["moderator", "admin"].includes(state.profile?.plan);
    const isAuthor = post.author_id === state.session.user.id;
    if (!staff && !isAuthor) return toast("Você não pode apagar este blog.");
    if (!window.confirm(`Apagar o blog "${post.title}"? Esta ação não pode ser desfeita.`)) return;
    const result = await sb.from("blog_posts").delete().eq("id", id);
    if (result.error) return toast(result.error.message || "Não foi possível apagar o blog.");
    state.blogOpenId = null;
    await loadBlogPosts();
    toast("Blog apagado.");
  }

  async function toggleBlogLike(id) {
    if (!state.session) return openAuthPage();
    const key = String(id);
    const liked = state.blogLikeIds.has(key);
    const query = sb.from("blog_likes");
    const result = liked
      ? await query.delete().eq("blog_id", id).eq("user_id", state.session.user.id)
      : await query.insert({ blog_id: id, user_id: state.session.user.id });
    if (result.error) return toast("Não foi possível atualizar a curtida.");
    if (liked) {
      state.blogLikeIds.delete(key);
      state.blogLikeCounts.set(key, Math.max(0, (state.blogLikeCounts.get(key) || 1) - 1));
    } else {
      state.blogLikeIds.add(key);
      state.blogLikeCounts.set(key, (state.blogLikeCounts.get(key) || 0) + 1);
    }
    render();
  }

  async function toggleBlogSave(id) {
    if (!state.session) return openAuthPage();
    const key = String(id);
    const saved = state.blogSaveIds.has(key);
    const result = saved
      ? await sb.from("blog_saves").delete().eq("blog_id", id).eq("user_id", state.session.user.id)
      : await sb.from("blog_saves").insert({ blog_id: id, user_id: state.session.user.id });
    if (result.error) return toast("Não foi possível atualizar os blogs salvos. Execute a atualização do schema no Supabase.");
    saved ? state.blogSaveIds.delete(key) : state.blogSaveIds.add(key);
    render();
  }

  async function shareBlog(id, title = "Blog") {
    const url = new URL(window.location.href);
    url.search = "";
    url.searchParams.set("pagina", "blogs");
    url.searchParams.set("blog", id);
    const shareData = { title, text: `Leia ${title} na Banca Digital`, url: url.toString() };
    if (navigator.share) await navigator.share(shareData).catch(() => {});
    else {
      await navigator.clipboard?.writeText(url.toString());
      toast("Link do blog copiado.");
    }
  }

  async function openBlogComments(post) {
    const overlay = document.createElement("div");
    overlay.className = "modal-backdrop";
    overlay.innerHTML = `<div class="modal blog-comments-modal"><div class="section-head"><div><h2>Comentários</h2><div class="section-subtitle">${escapeHTML(post.title)}</div></div><button class="small-btn" data-close>Fechar</button></div><div class="blog-comments-list"><span class="section-subtitle">Carregando...</span></div>${state.session ? '<form class="comment-form" id="blog-comment-form" data-blog-comment-form><textarea name="body" maxlength="1000" required placeholder="Escreva um comentário..."></textarea><button class="small-btn" type="submit">Comentar</button></form>' : '<p class="section-subtitle">Entre para comentar.</p>'}</div>`;
    $("#modal-root").appendChild(overlay);
    $$('[data-close]', overlay).forEach(button => button.onclick = () => overlay.remove());
    const list = $(".blog-comments-list", overlay);
    const refresh = async () => {
      const thread = await loadBlogCommentThread(post);
      state.blogCommentThreads.set(String(post.id), thread);
      renderBlogCommentThread(list, thread);
      linkCommentMentions(list);
      state.blogCommentCounts.set(String(post.id), thread.comments?.length || 0);
    };
    await refresh();
    bindBlogCommentThread(overlay, post, list, refresh);
  }

  function blogEngagementMarkup(post, showComments = true) {
    const id = String(post.id);
    const liked = state.blogLikeIds.has(id);
    const likes = state.blogLikeCounts.get(id) || 0;
    const comments = state.blogCommentCounts.get(id) || 0;
    const saved = state.blogSaveIds.has(id);
    return `<div class="blog-engagement"><button class="small-btn ${liked ? "is-liked" : ""}" data-blog-like="${escapeHTML(id)}">${liked ? "♥" : "♡"} ${likes}</button><button class="small-btn ${saved ? "is-liked" : ""}" data-blog-save="${escapeHTML(id)}">${saved ? "★ Salvo" : "☆ Salvar"}</button>${showComments ? `<button class="small-btn" data-blog-comments="${escapeHTML(id)}">Comentários · ${comments}</button>` : ""}<button class="small-btn" data-blog-share="${escapeHTML(id)}">Compartilhar</button></div>`;
  }

  function blogCard(post, featured = false) {
    const author = post.author || {};
    const staff = ["moderator", "admin"].includes(state.profile?.plan);
    const canDelete = staff || state.session?.user?.id === post.author_id;
    const coverOnly = (!post.image_2_url && !post.image_3_url) || (post.cover_url && post.image_2_url === post.cover_url && post.image_3_url === post.cover_url);
    return `<article class="blog-card ${featured ? "is-featured" : ""}" data-blog-open="${escapeHTML(post.id)}"><div class="blog-card-images ${coverOnly ? "is-cover-only" : ""}"><div class="blog-card-cover ${post.cover_url ? "has-image" : ""}" ${blogImageStyle(post.cover_url)}></div><div class="blog-card-side"><div class="blog-card-side-image ${post.image_2_url ? "has-image" : ""}" ${blogImageStyle(post.image_2_url)}></div><div class="blog-card-side-image ${post.image_3_url ? "has-image" : ""}" ${blogImageStyle(post.image_3_url)}></div></div></div><div class="blog-card-body"><div class="eyebrow">${post.is_featured ? "Destaque" : "Blog"}</div><h3>${escapeHTML(post.title)}</h3><p>${escapeHTML(post.excerpt || "Confira esta publicação na Banca Digital.")}</p><div class="blog-card-meta">@${escapeHTML(author.username || "usuário")} · ${escapeHTML(blogDate(post.published_at || post.created_at))}</div><div class="blog-card-actions"><button class="small-btn" data-blog-read="${escapeHTML(post.id)}">Ler artigo</button>${staff ? `<button class="small-btn" data-blog-feature="${escapeHTML(post.id)}" data-blog-featured="${post.is_featured ? "true" : "false"}">${post.is_featured ? "Remover destaque" : "Destacar"}</button>` : ""}${canDelete ? `<button class="small-btn danger" data-blog-delete="${escapeHTML(post.id)}">Apagar</button>` : ""}</div>${blogEngagementMarkup(post)}</div></article>`;
  }

  function blogHighlightsSidebar() {
    const highlights = state.blogPosts.filter(post => post.is_featured).slice(0, 3);
    const recent = state.blogPosts.filter(post => !post.is_featured).slice(0, 3);
    if (!highlights.length && !recent.length) return "";
    const cards = posts => posts.map(post => `<article class="blog-highlight-item" data-blog-open="${escapeHTML(post.id)}"><div class="blog-highlight-cover ${post.cover_url ? "has-image" : ""}" ${blogImageStyle(post.cover_url)}></div><div class="blog-highlight-body"><h3>${escapeHTML(post.title)}</h3><p>${escapeHTML(post.excerpt || "Confira esta publicação.")}</p></div></article>`).join("");
    return `<aside class="blog-highlights-sidebar">${highlights.length ? `<div class="eyebrow">Em destaque</div><h2>Blogs em destaque</h2><div class="blog-highlights-list">${cards(highlights)}</div>` : ""}${recent.length ? `<div class="blog-sidebar-recent"><div class="eyebrow">Atualizações</div><h2>Recentes</h2><div class="blog-highlights-list">${cards(recent)}</div></div>` : ""}</aside>`;
  }

  function blogAuthorMarkup(post) {
    const author = post.author || {};
    const username = author.username || "usuário";
    return `<a href="${escapeHTML(publicProfileHref(username))}" class="blog-author-card">${avatarMarkup(author, "blog-author-avatar")}<span><span class="eyebrow">Publicado por</span><span class="blog-author-name">@${escapeHTML(username)}</span>${author.title ? `<span class="blog-author-title" style="color:${escapeHTML(safeTitleColor(author.title_color))}">${escapeHTML(author.title)}</span>` : ""}</span></a>`;
  }

  function blogCommentsSection(post) {
    return `<section class="blog-inline-comments" data-blog-inline-comments="${escapeHTML(post.id)}"><div class="section-head"><div><h2>Comentários</h2><div class="section-subtitle">Converse sobre esta publicação.</div></div></div><div class="blog-inline-comments-list"><span class="section-subtitle">Carregando comentários...</span></div>${state.session ? '<form class="comment-form blog-inline-comment-form" data-blog-comment-form><textarea name="body" maxlength="1000" required placeholder="Escreva um comentário..."></textarea><button class="small-btn" type="submit">Comentar</button></form>' : '<p class="section-subtitle">Entre para comentar.</p>'}</section>`;
  }

  async function loadBlogCommentThread(post) {
    let result = await sb.from("blog_comments").select("id, parent_id, user_id, body, created_at").eq("blog_id", post.id).order("created_at", { ascending: true });
    if (result.error && /parent_id|schema cache|column/i.test(result.error.message || "")) {
      const legacyResult = await sb.from("blog_comments").select("id, user_id, body, created_at").eq("blog_id", post.id).order("created_at", { ascending: true });
      result = { ...legacyResult, data: (legacyResult.data || []).map(comment => ({ ...comment, parent_id: null })) };
    }
    if (result.error) return { error: result.error, comments: [] };
    const comments = result.data || [];
    const userIds = [...new Set(comments.map(comment => comment.user_id).filter(Boolean))];
    const profilesResult = userIds.length ? await sb.from("profiles").select("id, username, avatar_url, title, title_color, plan").in("id", userIds) : { data: [] };
    const profiles = new Map((profilesResult.data || []).map(profile => [profile.id, profile]));
    comments.forEach(comment => { comment.profiles = profiles.get(comment.user_id) || {}; });
    const likes = comments.length ? await sb.from("blog_comment_likes").select("blog_comment_id, user_id").in("blog_comment_id", comments.map(comment => comment.id)) : { data: [] };
    const likedIds = new Set((likes.data || []).filter(row => row.user_id === state.session?.user?.id).map(row => row.blog_comment_id));
    const counts = (likes.data || []).reduce((map, row) => map.set(row.blog_comment_id, (map.get(row.blog_comment_id) || 0) + 1), new Map());
    return { comments, likedIds, counts };
  }

  function blogCommentMarkup(comment, childrenByParent, likedIds, likeCounts) {
    const username = cleanUsername(comment.profiles?.username || "usuário");
    const profile = { ...(comment.profiles || {}), username };
    const children = childrenByParent.get(comment.id) || [];
    const replies = children.map(child => blogCommentMarkup(child, childrenByParent, likedIds, likeCounts)).join("");
    const canDelete = state.session?.user?.id === comment.user_id || ["moderator", "admin"].includes(state.profile?.plan);
    return `<article class="comment blog-comment" data-blog-comment-id="${comment.id}"><div class="comment-author-row">${avatarMarkup(profile, "comment-avatar")}<div class="comment-author-info"><a class="comment-author" href="${publicProfileHref(username)}" target="_blank" rel="noopener">@${escapeHTML(username)}</a>${profile.title ? `<span class="comment-title">${escapeHTML(profile.title)}</span>` : ""}</div></div><p>${escapeHTML(comment.body)}</p><div class="comment-actions"><button class="comment-action ${likedIds.has(comment.id) ? "is-liked" : ""}" data-blog-comment-like="${comment.id}">♥ ${likeCounts.get(comment.id) || 0}</button><button class="comment-action" data-blog-comment-reply="${comment.id}">Responder</button>${children.length ? `<button class="comment-action" data-blog-comment-toggle="${comment.id}">Ver ${children.length} resposta${children.length === 1 ? "" : "s"}</button>` : ""}${canDelete ? `<button class="comment-action comment-delete-action" data-blog-comment-delete="${comment.id}">Excluir</button>` : ""}<time class="comment-date" datetime="${escapeHTML(comment.created_at)}">${escapeHTML(formatCommentDate(comment.created_at))}</time></div><div class="comment-replies" data-blog-comment-replies="${comment.id}" hidden>${replies}</div></article>`;
  }

  function renderBlogCommentThread(list, thread) {
    if (thread.error) {
      list.innerHTML = '<span class="section-subtitle">Não foi possível carregar os comentários.</span>';
      return;
    }
    const childrenByParent = new Map();
    thread.comments.forEach(comment => {
      if (!childrenByParent.has(comment.parent_id)) childrenByParent.set(comment.parent_id, []);
      childrenByParent.get(comment.parent_id).push(comment);
    });
    list.innerHTML = (childrenByParent.get(null) || []).map(comment => blogCommentMarkup(comment, childrenByParent, thread.likedIds, thread.counts)).join("") || '<span class="section-subtitle">Nenhum comentário ainda.</span>';
  }

  function bindBlogCommentThread(root, post, list, refresh) {
    if (root.dataset.blogCommentBound) return;
    root.dataset.blogCommentBound = "true";
    root.addEventListener("click", async event => {
      const like = event.target.closest("[data-blog-comment-like]");
      if (like) {
        event.preventDefault();
        if (!state.session) return openAuthPage();
        const id = Number(like.dataset.blogCommentLike);
        const liked = like.classList.contains("is-liked");
        const result = liked ? await sb.from("blog_comment_likes").delete().eq("user_id", state.session.user.id).eq("blog_comment_id", id) : await sb.from("blog_comment_likes").insert({ user_id: state.session.user.id, blog_comment_id: id });
        if (result.error) return toast("Não foi possível atualizar a curtida.");
        await refresh();
        return;
      }
      const deleteButton = event.target.closest("[data-blog-comment-delete]");
      if (deleteButton) {
        event.preventDefault();
        if (!window.confirm("Excluir este comentário e suas respostas?")) return;
        const result = await sb.from("blog_comments").delete().eq("id", deleteButton.dataset.blogCommentDelete);
        if (result.error) return toast("Não foi possível excluir o comentário.");
        await refresh();
        return;
      }
      const toggle = event.target.closest("[data-blog-comment-toggle]");
      if (toggle) {
        const replies = $(`[data-blog-comment-replies="${toggle.dataset.blogCommentToggle}"]`, root);
        if (replies) { replies.hidden = !replies.hidden; toggle.textContent = replies.hidden ? "Ver respostas" : "Ocultar respostas"; }
        return;
      }
      const reply = event.target.closest("[data-blog-comment-reply]");
      if (reply) {
        const comment = $(`[data-blog-comment-id="${reply.dataset.blogCommentReply}"]`, root);
        if (!comment || $("[data-blog-reply-form]", comment)) return;
        comment.insertAdjacentHTML("beforeend", state.session ? '<form class="comment-form comment-reply-form" data-blog-reply-form><textarea name="body" maxlength="1000" required placeholder="Escreva uma resposta..."></textarea><button class="small-btn" type="submit">Responder</button></form>' : '<p class="section-subtitle">Entre para responder.</p>');
      }
    });
    root.addEventListener("submit", async event => {
      const form = event.target.closest("[data-blog-comment-form], [data-blog-reply-form]");
      if (!form) return;
      event.preventDefault();
      if (!state.session?.user?.id) return openAuthPage();
      const body = String(new FormData(form).get("body") || "").trim();
      if (!body) return;
      const parentId = Number(form.closest("[data-blog-comment-id]")?.dataset.blogCommentId) || null;
      const optimisticId = -Date.now();
      const currentThread = state.blogCommentThreads.get(String(post.id)) || { comments: [], likedIds: new Set(), counts: new Map() };
      currentThread.comments = [...currentThread.comments, { id: optimisticId, parent_id: parentId, user_id: state.session.user.id, body, created_at: new Date().toISOString(), profiles: { ...(state.profile || {}), username: state.profile?.username || state.session.user.user_metadata?.username || "usuário" } }];
      state.blogCommentThreads.set(String(post.id), currentThread);
      renderBlogCommentThread(list, currentThread);
      linkCommentMentions(list);
      state.blogCommentCounts.set(String(post.id), currentThread.comments.length);
      form.reset();
      if (parentId) form.remove();
      const button = $("button", form); if (button) button.disabled = true;
      const result = await sb.from("blog_comments").insert({ blog_id: post.id, user_id: state.session.user.id, parent_id: parentId, body });
      if (result.error) { toast(commentWriteError(result.error)); await refresh(); }
      else await refresh();
      if (button) button.disabled = false;
    });
  }

  async function loadBlogCommentsSection(post, section) {
    const list = $(".blog-inline-comments-list", section);
    if (!list) return;
    const thread = await loadBlogCommentThread(post);
    state.blogCommentThreads.set(String(post.id), thread);
    renderBlogCommentThread(list, thread);
    linkCommentMentions(list);
    state.blogCommentCounts.set(String(post.id), thread.comments?.length || 0);
    bindBlogCommentThread(section, post, list, () => loadBlogCommentsSection(post, section));
  }

  function renderBlogEditor() {
    if (!state.session) return `<div class="notice">Entre na sua conta para escrever e publicar um blog.</div><button class="btn btn-danger" data-action="open-auth">Entrar</button>`;
    const staff = ["moderator", "admin"].includes(state.profile?.plan);
    return `<form id="blog-form" class="blog-editor-form"><div class="field"><label>Título</label><input name="title" maxlength="140" required placeholder="Título da sua publicação"></div><div class="field"><label>Resumo</label><textarea name="excerpt" maxlength="500" rows="3" placeholder="Uma chamada curta para os cards da aba Blogs"></textarea></div><div class="blog-image-fields"><div class="field"><label>Capa principal</label><input name="cover" type="file" accept="image/png,image/jpeg,image/webp,image/gif"></div><div class="field"><label>Imagem lateral 1</label><input name="image2" type="file" accept="image/png,image/jpeg,image/webp,image/gif"></div><div class="field"><label>Imagem lateral 2</label><input name="image3" type="file" accept="image/png,image/jpeg,image/webp,image/gif"></div></div><div class="field"><label>Conteúdo</label><div class="blog-toolbar"><button type="button" data-blog-command="bold"><b>B</b></button><button type="button" data-blog-command="italic"><i>I</i></button><button type="button" data-blog-command="underline"><u>U</u></button><button type="button" data-blog-command="formatBlock" data-blog-value="h2">Título</button><button type="button" data-blog-command="formatBlock" data-blog-value="blockquote">Citação</button><button type="button" data-blog-command="insertUnorderedList">Lista</button><button type="button" data-blog-command="createLink">Link</button></div><div id="blog-editor" class="blog-editor" contenteditable="true" data-placeholder="Escreva sua notícia, análise ou história..."></div></div>${staff ? `<label class="checkbox-inline"><input name="isFeatured" type="checkbox"> Destacar na aba Blogs</label>` : ""}<div class="modal-actions"><button type="submit" class="btn btn-danger">Publicar blog</button></div></form>`;
  }

  function renderBlogPostPage(post) {
    const author = post.author || {};
    const staff = ["moderator", "admin"].includes(state.profile?.plan);
    const canDelete = staff || state.session?.user?.id === post.author_id;
    return `<div class="content blog-post-page"><div class="section-head"><div><div class="eyebrow">${post.is_featured ? "Blog em destaque" : "Blog"}</div><h1 class="section-title">${escapeHTML(post.title)}</h1><div class="section-subtitle">@${escapeHTML(author.username || "usuário")} · ${escapeHTML(blogDate(post.published_at || post.created_at))}</div></div><button class="small-btn" data-blog-back>Voltar aos blogs</button></div><div class="blog-post-gallery"><div class="blog-post-cover ${post.cover_url ? "has-image" : ""}" ${blogImageStyle(post.cover_url)}></div><div class="blog-post-side"><div class="blog-post-side-image ${post.image_2_url ? "has-image" : ""}" ${blogImageStyle(post.image_2_url)}></div><div class="blog-post-side-image ${post.image_3_url ? "has-image" : ""}" ${blogImageStyle(post.image_3_url)}></div></div></div>${post.excerpt ? `<p class="blog-post-excerpt">${escapeHTML(post.excerpt)}</p>` : ""}<article class="blog-post-content">${safeBlogHtml(post.content_html)}</article><div class="blog-post-actions">${blogEngagementMarkup(post, false)}${staff ? `<button class="small-btn" data-blog-feature="${escapeHTML(post.id)}" data-blog-featured="${post.is_featured ? "true" : "false"}">${post.is_featured ? "Remover destaque" : "Destacar blog"}</button>` : ""}${canDelete ? `<button class="small-btn danger blog-delete-button" data-blog-delete="${escapeHTML(post.id)}">Apagar blog</button>` : ""}</div>${blogAuthorMarkup(post)}</div>`;
  }

  function renderBlogsPage() {
    if (state.blogOpenId) {
      const post = state.blogPosts.find(item => String(item.id) === String(state.blogOpenId));
      if (post) return renderBlogPostPage(post);
    }
    const featured = state.blogPosts.filter(post => post.is_featured);
    const recent = state.blogPosts.filter(post => !post.is_featured);
    return `<div class="content blogs-page"><div class="section-head"><div><div class="eyebrow">Comunidade</div><h1 class="section-title">Blogs</h1><div class="section-subtitle">Notícias, análises e histórias publicadas pelos leitores.</div></div><button class="btn btn-danger" data-blog-tab="escrever">Escrever blog</button></div><div class="blog-tabs"><button class="small-btn ${state.blogTab === "recentes" ? "is-active" : ""}" data-blog-tab="recentes">Recentes</button><button class="small-btn ${state.blogTab === "escrever" ? "is-active" : ""}" data-blog-tab="escrever">Escrever</button></div>${state.blogTab === "escrever" ? renderBlogEditor() : state.blogLoading ? '<div class="empty">Carregando blogs...</div>' : state.blogError ? `<div class="empty">${escapeHTML(state.blogError)}</div>` : `${featured.length ? `<section class="section"><div class="section-head"><div><h2 class="section-title">Em destaque</h2><div class="section-subtitle">Publicações selecionadas pela equipe.</div></div></div><div class="blog-grid blog-featured-grid">${featured.map(post => blogCard(post, true)).join("")}</div></section>` : ""}<section class="section"><div class="section-head"><div><h2 class="section-title">Recentes</h2><div class="section-subtitle">As últimas publicações da comunidade.</div></div></div><div class="blog-grid">${recent.map(post => blogCard(post)).join("") || '<div class="empty">Ainda não há blogs publicados.</div>'}</div></section>`}</div>`;
  }

  function publisherKey(value = "") {
    return String(value).trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "sem-editora";
  }

  function skipCoverStorageKey(userId = state.session?.user?.id) {
    return userId ? `bancaDigitalSkipCover:${userId}` : "";
  }

  function shouldSkipCover() {
    const key = skipCoverStorageKey();
    return Boolean(key && localStorage.getItem(key) === "true");
  }

  function saveSkipCoverPreference(value) {
    const key = skipCoverStorageKey();
    if (!key) return;
    if (value) localStorage.setItem(key, "true");
    else localStorage.removeItem(key);
  }

  function avatarMarkup(profile, className = "profile-avatar") {
    const factionId = profile?.faction_id || state.factionByUser.get(profile?.id);
    const faction = state.factions.find(item => item.id === factionId);
    const staff = ["moderator", "admin"].includes(profile?.plan);
    const avatarClass = staff ? "avatar-staff" : faction?.color ? "avatar-faction" : "";
    const avatarStyle = !staff && faction?.color ? ` style="--avatar-faction-color:${escapeHTML(faction.color)}"` : "";
    const avatarUrl = state.session?.offline || navigator.onLine === false ? DEFAULT_AVATAR_URL : (profile?.avatar_url || DEFAULT_AVATAR_URL);
    return `<img class="${className} ${avatarClass}"${avatarStyle} src="${escapeHTML(avatarUrl)}" onerror="this.onerror=null;this.src='${DEFAULT_AVATAR_URL}'" alt="Foto de ${escapeHTML(profile?.username || "usuário")}">`;
  }

  function syncTopAvatar() {
    const headerAvatar = $(".avatar");
    if (!headerAvatar) return;
    headerAvatar.innerHTML = avatarMarkup(state.profile, "top-avatar-img");
    headerAvatar.title = state.session ? "Abrir minha estante" : "Entrar ou abrir minha estante";
    headerAvatar.classList.toggle("avatar-staff", ["moderator", "admin"].includes(state.profile?.plan));
  }

  function appAssetUrl(path) {
    return new URL(String(path).replace(/^\/+/, ""), document.baseURI).href;
  }

  let libarchiveModulePromise = null;
  function loadLibarchiveModule() {
    if (!libarchiveModulePromise) {
      libarchiveModulePromise = import(appAssetUrl("libarchive/libarchive.js")).catch(error => {
        libarchiveModulePromise = null;
        throw error;
      });
    }
    return libarchiveModulePromise;
  }

  function publicProfileHref(username, collectionId = "") {
    const url = new URL(window.location.href);
    url.search = "";
    url.hash = "";
    url.searchParams.set("perfil", cleanUsername(username));
    if (collectionId) url.searchParams.set("lista", collectionId);
    return `${url.pathname}?${url.searchParams.toString()}`;
  }

  async function loadCoverCatalog() {
    if (!sb) return;
    const result = await sb.from("comic_cover_variants").select("item_id, variant_key, label, cover_url, source_url").order("label", { ascending: true });
    if (result.error) {
      console.warn("Não foi possível carregar as capas variantes do Supabase:", result.error.message);
      state.coverVariants = new Map();
      return;
    }
    state.coverVariants = (result.data || []).reduce((map, variant) => {
      // Compatibilidade com as linhas antigas gravadas com três dígitos.
      const itemId = {
        "war-earth-3-2022-001": "war-earth-3-2022-01",
        "war-earth-3-2022-002": "war-earth-3-2022-02"
      }[variant.item_id] || variant.item_id;
      const normalizedVariant = itemId === variant.item_id ? variant : { ...variant, item_id: itemId };
      if (!map.has(itemId)) map.set(itemId, []);
      map.get(itemId).push(normalizedVariant);
      return map;
    }, new Map());
  }

  async function loadCoverChoices(userId) {
    if (!sb || !userId) {
      state.coverChoices = new Map();
      return;
    }
    const result = await sb.from("user_cover_choices").select("item_id, variant_key, label, cover_url").eq("user_id", userId);
    state.coverChoices = result.error ? new Map() : new Map((result.data || []).map(choice => [choice.item_id, choice]));
  }

  async function loadCoverStyles(userId) {
    if (!userId) {
      state.coverStyles = new Map();
      return;
    }
    const result = await sb.from("user_cover_styles").select("item_id, style").eq("user_id", userId);
    state.coverStyles = result.error ? new Map() : new Map((result.data || []).map(choice => [choice.item_id, choice.style]));
  }

  async function loadSeriesCoverChoices(userId) {
    if (!userId) {
      state.seriesCoverChoices = new Map();
      return;
    }
    const result = await sb.from("user_series_cover_choices").select("series_id, item_id, cover_url, variant_key, is_variant").eq("user_id", userId);
    state.seriesCoverChoices = result.error ? new Map() : new Map((result.data || []).map(choice => [choice.series_id, choice]));
  }

  async function loadProfileWallComments(profileId) {
    if (!sb || !profileId) return [];
    let result = await sb.from("profile_wall_comments").select("id, user_id, parent_id, body, created_at, profiles(username, avatar_url, title, title_color, faction_id)").eq("profile_id", profileId).order("created_at", { ascending: false });
    if (!result.error) return result.data || [];
    let fallback = await sb.from("profile_wall_comments").select("id, user_id, parent_id, body, created_at").eq("profile_id", profileId).order("created_at", { ascending: false });
    if (fallback.error && /parent_id|schema cache|column/i.test(fallback.error.message || "")) {
      const legacy = await sb.from("profile_wall_comments").select("id, user_id, body, created_at").eq("profile_id", profileId).order("created_at", { ascending: false });
      fallback = { ...legacy, data: (legacy.data || []).map(comment => ({ ...comment, parent_id: null })) };
    }
    if (fallback.error) {
      console.warn("Não foi possível carregar os comentários do mural:", fallback.error.message);
      return [];
    }
    const userIds = [...new Set((fallback.data || []).map(comment => comment.user_id).filter(Boolean))];
    const profiles = userIds.length ? await sb.from("profiles").select("id, username, avatar_url, title, title_color, faction_id").in("id", userIds) : { data: [] };
    const byId = new Map((profiles.data || []).map(profile => [profile.id, profile]));
    return (fallback.data || []).map(comment => ({ ...comment, profiles: byId.get(comment.user_id) || {} }));
  }

  async function loadAccount() {
    const offlineAccount = readOfflineAccount();
    if (!sb) {
      if (offlineAccount?.user) {
        state.session = { user: offlineAccount.user, offline: true };
        state.profile = offlineProfileFor(offlineAccount.user, offlineAccount.profile, offlineAccount.username);
        loadDownloads();
        syncTopAvatar();
      }
      state.authReady = true;
      render();
      return;
    }
    let remoteSession = null;
    try {
      const sessionResult = await sb.auth.getSession();
      remoteSession = sessionResult?.data?.session || null;
    } catch (error) {
      // Sem rede, o cliente Auth pode rejeitar em vez de devolver uma sessão nula.
      console.warn("Sessão online indisponível; usando a sessão local.", error);
    }
    // Mantém a conta visível após recarregar sem internet. O funcionamento
    // offline continua restrito aos arquivos da área Downloads.
    const browserOffline = navigator.onLine === false;
    const offlineFallback = offlineAccount?.user ? { user: offlineAccount.user, offline: true } : null;
    const session = browserOffline ? offlineFallback : (remoteSession || offlineFallback);
    state.session = session?.user ? session : null;
    if (remoteSession?.user) {
      // Persiste a identidade assim que a sessão é reconhecida. A senha e os
      // tokens continuam sob responsabilidade do Supabase Auth.
      saveOfflineAccount(null);
    }
    if (state.session?.offline) {
      state.profile = offlineProfileFor(state.session.user, offlineAccount?.profile, offlineAccount?.username);
      loadDownloads();
      state.authReady = true;
      syncTopAvatar();
      render();
      return;
    }
    if (!remoteSession && !navigator.onLine) {
      if (!state.session?.offline) {
        state.profile = null;
        state.authReady = true;
        render();
        return;
      }
      state.profile = offlineProfileFor(state.session.user, offlineAccount?.profile, offlineAccount?.username);
      loadDownloads();
      state.authReady = true;
      syncTopAvatar();
      render();
      return;
    }
    await loadCoverCatalog();
    await loadCoverChoices(session?.user?.id);
    await loadCoverStyles(session?.user?.id);
    await loadSeriesCoverChoices(session?.user?.id);
    const publisherSettings = await sb.from("publisher_settings").select("publisher_key, publisher_name, cover_url, is_pinned");
    state.publisherSettings = new Map((publisherSettings.data || []).map(setting => [setting.publisher_key, setting]));
    const publicCollectionsResult = await sb.from("shelf_collections").select("id, owner_id, name, cover_url, item_ids, blog_ids, collection_type, is_featured, sort_order").eq("is_public", true).limit(50);
    const publicCollections = publicCollectionsResult.data || [];
    const collectionOwnerIds = [...new Set(publicCollections.map(collection => collection.owner_id).filter(Boolean))];
    const collectionOwnersResult = collectionOwnerIds.length ? await sb.from("profiles").select("id, username").in("id", collectionOwnerIds) : { data: [] };
    const collectionOwners = new Map((collectionOwnersResult.data || []).map(profile => [profile.id, profile.username]));
    const collectionLikesResult = await sb.from("shelf_collection_likes").select("owner_id, collection_id");
    const collectionLikeCounts = (collectionLikesResult.data || []).reduce((counts, like) => {
      const key = `${like.owner_id}:${like.collection_id}`;
      counts.set(key, (counts.get(key) || 0) + 1);
      return counts;
    }, new Map());
    state.popularPublicCollections = publicCollections
      .map(collection => ({ ...collection, username: collectionOwners.get(collection.owner_id) || "", likes: collectionLikeCounts.get(`${collection.owner_id}:${collection.id}`) || 0 }))
      .filter(collection => collection.collection_type !== "blog" && collection.username)
      .sort((a, b) => b.likes - a.likes || String(a.name).localeCompare(String(b.name), "pt-BR"))
      .slice(0, 8);
    const publicCollectionView = publicCollections.map(collection => ({ ...collection, username: collectionOwners.get(collection.owner_id) || "" })).filter(collection => collection.username);
    state.featuredComicCollections = publicCollectionView.filter(collection => collection.collection_type !== "blog" && collection.is_featured).slice(0, 8);
    state.featuredBlogCollections = publicCollectionView.filter(collection => collection.collection_type === "blog" && collection.is_featured).slice(0, 8);
    const comicLikes = await sb.from("comic_likes").select("item_id, user_id, created_at");
    state.comicLikeIds = new Set((comicLikes.data || []).filter(row => row.user_id === session?.user?.id).map(row => row.item_id));
    state.comicLikeAddedAt = new Map((comicLikes.data || []).filter(row => row.user_id === session?.user?.id).map(row => [row.item_id, row.created_at]));
    state.comicLikeCounts = (comicLikes.data || []).reduce((counts, row) => counts.set(row.item_id, (counts.get(row.item_id) || 0) + 1), new Map());
    if (session?.user) {
      const profile = await sb.from("profiles").select("*").eq("id", session.user.id).single();
      state.profile = profile.data;
      loadDownloads();
      saveOfflineAccount(state.profile);
      state.collectionSortOrders = profile.data?.shelf_sort_orders || {};
      try { state.collectionSortOrders = { ...JSON.parse(localStorage.getItem(`bancaDigitalShelfSort:${session.user.id}`) || "{}"), ...state.collectionSortOrders }; } catch {}
      const savedPublishersResult = await sb.from("publisher_saves").select("publisher_key, publisher_name").eq("user_id", session.user.id).order("created_at", { ascending: false });
      state.savedPublishers = savedPublishersResult.data || [];
      state.savedPublisherKeys = new Set(state.savedPublishers.map(publisher => publisher.publisher_key));
      await loadFactions();
      const ownFollowers = await sb.from("profile_follows").select("follower_id").eq("following_id", session.user.id);
      const ownFollowing = await sb.from("profile_follows").select("following_id").eq("follower_id", session.user.id);
      state.followerCount = (ownFollowers.data || []).length;
      state.followingCount = (ownFollowing.data || []).length;
      if (state.profile?.is_banned && !["moderator", "admin"].includes(state.profile.plan)) {
        await sb.auth.signOut();
        state.session = null;
        state.profile = null;
        render();
        return toast("Sua conta está banida.");
      }
      const collections = await sb.from("shelf_collections").select("id, name, cover_url, is_public, item_ids, collection_type, blog_ids, is_featured, sort_order").eq("owner_id", session.user.id).order("created_at", { ascending: true });
      state.shelfCategories = (collections.data || []).filter(collection => collection.collection_type !== "blog").map(collection => ({ id: collection.id, name: collection.name, coverUrl: collection.cover_url || "", isPublic: collection.is_public !== false, is_featured: collection.is_featured === true, sortOrder: collection.sort_order || "added_desc", itemIds: Array.isArray(collection.item_ids) ? collection.item_ids : [] }));
      const savedCollectionLinks = await sb.from("shelf_collection_saves").select("collection_id, owner_id").eq("user_id", session.user.id);
      const savedCollectionIds = (savedCollectionLinks.data || []).map(row => row.collection_id);
      const savedCollectionsResult = savedCollectionIds.length
        ? await sb.from("shelf_collections").select("id, owner_id, name, cover_url, is_public, item_ids, collection_type, is_featured").in("id", savedCollectionIds).eq("is_public", true).eq("collection_type", "comic")
        : { data: [] };
      const savedOwnerIds = [...new Set((savedCollectionsResult.data || []).map(collection => collection.owner_id).filter(Boolean))];
      const savedOwnersResult = savedOwnerIds.length ? await sb.from("profiles").select("id, username").in("id", savedOwnerIds) : { data: [] };
      const savedOwners = new Map((savedOwnersResult.data || []).map(owner => [owner.id, owner.username]));
      state.savedPublicCollections = (savedCollectionsResult.data || []).map(collection => ({ ...collection, username: savedOwners.get(collection.owner_id) || "" })).filter(collection => collection.username);
      state.wallComments = await loadProfileWallComments(session.user.id);
      state.blogShelfCategories = (collections.data || []).filter(collection => collection.collection_type === "blog").map(collection => ({ id: collection.id, name: collection.name, coverUrl: collection.cover_url || "", isPublic: collection.is_public !== false, is_featured: collection.is_featured === true, blogIds: Array.isArray(collection.blog_ids) ? collection.blog_ids : [] }));
      const authoredBlogs = await sb.from("blog_posts").select("id, author_id, title, excerpt, cover_url, image_2_url, image_3_url, status, is_featured, created_at, published_at").eq("author_id", session.user.id).eq("status", "published").order("published_at", { ascending: false });
      state.authoredBlogPosts = authoredBlogs.data || [];
      const blogSaves = await sb.from("blog_saves").select("blog_id").eq("user_id", session.user.id);
      state.blogSaveIds = new Set((blogSaves.data || []).map(row => String(row.blog_id)));
      const savedBlogIds = [...state.blogSaveIds];
      const savedBlogs = savedBlogIds.length ? await sb.from("blog_posts").select("id, author_id, title, excerpt, cover_url, image_2_url, image_3_url, status, is_featured, created_at, published_at").in("id", savedBlogIds).eq("status", "published") : { data: [] };
      state.savedBlogPosts = savedBlogs.data || [];
      const favorites = await sb.from("favorites").select("item_id, created_at").eq("user_id", session.user.id);
      state.favoriteIds = new Set((favorites.data || []).map(row => row.item_id));
      state.favoriteAddedAt = new Map((favorites.data || []).map(row => [row.item_id, row.created_at]));
      const progress = await sb.from("reading_progress").select("item_id, page, total_pages, completed, updated_at").eq("user_id", session.user.id);
      state.readingProgress = new Map((progress.data || []).map(row => [row.item_id, row]));
      state.shelfSnapshot = { saved: new Set(state.favoriteIds), read: new Set([...state.readingProgress.entries()].filter(([, row]) => row.completed).map(([id]) => id)) };
      const achievements = await sb.from("user_achievements").select("achievements(name, description, icon)").eq("user_id", session.user.id);
      state.achievements = (achievements.data || []).map(row => row.achievements).filter(Boolean);
      const checkin = await sb.rpc("daily_profile_checkin");
      if (!checkin.error && checkin.data?.[0]) {
        const result = checkin.data[0];
        state.profile = { ...state.profile, xp: result.total_xp, level: result.current_level, daily_streak: result.streak };
        if (result.awarded_xp > 0) toast(`Check-in diário: +${result.awarded_xp} XP · sequência de ${result.streak} dia(s).`);
      }
      await sb.rpc("touch_profile");
      await startPresence();
    }
    await loadNotifications();
    await loadStaffActivities();
    state.authReady = true;
    syncTopAvatar();
    render();
    if (state.session && state.profile && !["moderator", "admin"].includes(state.profile.plan) && !state.profile.faction_id) setTimeout(openFactionChoice, 0);
    if (state.section === "ranking") loadRankingData();
  }

  async function loadNotifications() {
    if (!sb || !state.session?.user?.id || state.session?.offline || navigator.onLine === false) {
      state.notificationChannel?.unsubscribe?.();
      state.notificationChannel = null;
      state.notifications = [];
      state.notificationUnreadCount = 0;
      state.messageUnreadCount = 0;
      state.chatRoomUnreadCounts = {};
      return;
    }
    const result = await sb.from("notifications").select("id, actor_id, type, title, body, href, metadata, read_at, created_at").eq("user_id", state.session.user.id).order("created_at", { ascending: false }).limit(100);
    if (result.error) {
      if (/fetch|network|disconnected|offline/i.test(String(result.error.message || ""))) {
        state.session = { ...state.session, offline: true };
        state.notificationChannel?.unsubscribe?.();
        state.notificationChannel = null;
      }
      state.notifications = [];
      state.notificationUnreadCount = 0;
      state.messageUnreadCount = 0;
      state.chatRoomUnreadCounts = {};
      return;
    }
    const chatNotificationTypes = ["message", "chat_mention"];
    const unreadChatNotifications = (result.data || []).filter(notification => chatNotificationTypes.includes(notification.type) && !notification.read_at);
    state.messageUnreadCount = unreadChatNotifications.length;
    state.chatRoomUnreadCounts = unreadChatNotifications.reduce((counts, notification) => {
      const roomId = notification.type === "chat_mention" ? notification.metadata?.room_id : null;
      if (roomId) counts[roomId] = (counts[roomId] || 0) + 1;
      return counts;
    }, {});
    const visibleNotifications = (result.data || []).filter(notification => !chatNotificationTypes.includes(notification.type));
    const actorIds = [...new Set(visibleNotifications.map(notification => notification.actor_id).filter(Boolean))];
    const actorsResult = actorIds.length
      ? await sb.from("profiles").select("id, username, avatar_url, title, title_color, plan, faction_id").in("id", actorIds)
      : { data: [] };
    const actors = new Map((actorsResult.data || []).map(actor => [actor.id, actor]));
    state.notifications = visibleNotifications
      .map(notification => ({ ...notification, actor: actors.get(notification.actor_id) || null }))
      .filter(notification => !isNotificationFromOpenChat(notification));
    state.notificationUnreadCount = state.notifications.filter(notification => !notification.read_at).length;
    if (!state.notificationChannel) {
      state.notificationChannel = sb.channel("notifications-" + state.session.user.id).on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: "user_id=eq." + state.session.user.id }, async payload => {
        if (isNotificationFromOpenChat(payload?.new || {})) {
          await markChatNotificationsRead(payload.new.actor_id);
        }
        await loadNotifications();
        $$('[data-chat-room]').forEach(button => {
          const unread = state.chatRoomUnreadCounts?.[button.dataset.chatRoom] || 0;
          let badge = $(".message-badge", button);
          if (unread) {
            if (!badge) {
              badge = document.createElement("span");
              badge.className = "message-badge";
              button.querySelector("small")?.before(badge);
            }
            badge.textContent = unread > 99 ? "99+" : String(unread);
            badge.setAttribute("aria-label", `${unread} marcação(ões) não lida(s)`);
          } else {
            badge?.remove();
          }
        });
        render();
      }).subscribe(status => {
        if (["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"].includes(status)) {
          const channel = state.notificationChannel;
          state.notificationChannel = null;
          channel?.unsubscribe?.();
        }
      });
    }
  }

  async function loadStaffActivities() {
    state.staffActivities = [];
    state.staffPendingCount = 0;
    if (!sb || state.session?.offline || navigator.onLine === false || !["moderator", "admin"].includes(state.profile?.plan)) return;
    const [moderation, bots] = await Promise.all([
      sb.from("moderation_actions").select("id, actor_id, target_id, action, duration_until, details, created_at").order("created_at", { ascending: false }).limit(100),
      sb.from("bot_actions").select("id, bot_name, action, title, body, metadata, status, reviewed_by, reviewed_at, created_at").order("created_at", { ascending: false }).limit(1000)
    ]);
    const rows = moderation.data || [];
    const botReviewerIds = (bots.data || []).map(row => row.reviewed_by).filter(Boolean);
    const ids = [...new Set([...rows.flatMap(row => [row.actor_id, row.target_id]), ...botReviewerIds].filter(Boolean))];
    const profiles = ids.length ? await sb.from("profiles").select("id, username").in("id", ids) : { data: [] };
    const names = new Map((profiles.data || []).map(profile => [profile.id, profile.username]));
    state.staffActivities = [
      ...rows.map(row => ({ ...row, kind: "moderation", actorName: names.get(row.actor_id) || "monitor", targetName: names.get(row.target_id) || "usuário" })),
      ...(bots.data || []).map(row => ({ ...row, kind: "bot", reviewerName: names.get(row.reviewed_by) || "Administrador" }))
    ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    // Candidatas de capas têm contador próprio na tela "Examinar capas variantes".
    state.staffPendingCount = 0;
  }

  function isNotificationFromOpenChat(notification) {
    return Boolean(
      state.chatContact?.id &&
      ["message", "chat_mention"].includes(notification.type) &&
      String(notification.actor_id) === String(state.chatContact.id)
    );
  }

  async function markChatNotificationsRead(contactId) {
    if (!sb || state.session?.offline || navigator.onLine === false || !state.session?.user?.id || !contactId) return;
    const result = await sb.from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", state.session.user.id)
      .eq("actor_id", contactId)
      .in("type", ["message", "chat_mention"])
      .is("read_at", null);
    if (result.error) console.warn("NÃ£o foi possÃ­vel marcar as notificaÃ§Ãµes da conversa como lidas:", result.error.message);
  }

  async function markChatMentionsRead(roomId = null) {
    if (!sb || state.session?.offline || navigator.onLine === false || !state.session?.user?.id) return;
    let query = sb.from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", state.session.user.id)
      .eq("type", "chat_mention")
      .is("read_at", null);
    if (roomId) query = query.contains("metadata", { room_id: roomId });
    await query;
  }

  async function loadPublicProfile(username, collectionId = null) {
    if (navigator.onLine === false || state.session?.offline) {
      activateOfflineMode();
      setSection("downloads");
      return;
    }
    state.publicProfile = { loading: true, username, collectionId };
    state.publicShelfTab = "collections";
    state.collectionFilter = { field: "all", query: "" };
    state.section = "public-profile";
    render();
    if (!sb) {
      state.publicProfile = { error: "A autenticação ainda não foi configurada.", username };
      render();
      return;
    }
    let profile = await sb.from("profiles").select("id, username, avatar_url, profile_banner_url, title, title_color, plan, xp, level, daily_streak, last_seen_at, faction_id, wall_description, profile_wall_public, shelf_saved_public, shelf_saved_public_collections, shelf_series_public, shelf_read_public, shelf_completed_public, shelf_liked_public, shelf_blogs_public, profile_activity_public, allow_messages, shelf_sort_orders, profile_hidden, is_banned, silenced_until").ilike("username", username).maybeSingle();
    if (profile.error) {
      profile = await sb.from("profiles").select("id, username, avatar_url, title, plan, xp, level, daily_streak, last_seen_at, allow_messages").ilike("username", username).maybeSingle();
    }
    if (profile.error || !profile.data) {
      state.publicProfile = { error: "Perfil não encontrado.", username };
      render();
      return;
    }
    const viewerId = state.session?.user?.id;
    const blockRows = viewerId && viewerId !== profile.data.id
      ? await Promise.all([
        sb.from("profile_blocks").select("blocker_id, blocked_id").eq("blocker_id", viewerId).eq("blocked_id", profile.data.id).maybeSingle(),
        sb.from("profile_blocks").select("blocker_id, blocked_id").eq("blocker_id", profile.data.id).eq("blocked_id", viewerId).maybeSingle()
      ])
      : [];
    const block = blockRows.find(result => !result.error && result.data)?.data || null;
    if (block) {
      state.publicProfile = { profile: profile.data, username, collectionId, blocked: true, blockedByMe: block.blocker_id === viewerId };
      render();
      return;
    }
    const favorites = await sb.from("favorites").select("item_id, created_at").eq("user_id", profile.data.id);
    const savedPublishersResult = await sb.from("publisher_saves").select("publisher_key, publisher_name, created_at").eq("user_id", profile.data.id).order("created_at", { ascending: false });
    const progress = await sb.from("reading_progress").select("item_id, page, total_pages, completed, updated_at").eq("user_id", profile.data.id);
    const comicLikes = await sb.from("comic_likes").select("item_id, created_at").eq("user_id", profile.data.id);
    const activityResults = await Promise.all([
      sb.from("comic_likes").select("item_id, created_at").eq("user_id", profile.data.id),
      sb.from("blog_likes").select("blog_id, created_at").eq("user_id", profile.data.id),
      sb.from("shelf_collection_likes").select("owner_id, collection_id, created_at").eq("user_id", profile.data.id),
      sb.from("profile_follows").select("following_id, created_at").eq("follower_id", profile.data.id),
      sb.from("comments").select("id, item_id, body, created_at").eq("user_id", profile.data.id),
      sb.from("blog_comments").select("id, blog_id, body, created_at").eq("user_id", profile.data.id),
      sb.from("profile_wall_comments").select("id, profile_id, body, created_at").eq("user_id", profile.data.id),
      sb.from("favorites").select("item_id, created_at").eq("user_id", profile.data.id),
      sb.from("blog_saves").select("blog_id, created_at").eq("user_id", profile.data.id),
      sb.from("shelf_collection_saves").select("owner_id, collection_id, created_at").eq("user_id", profile.data.id),
      sb.from("publisher_saves").select("publisher_name, created_at").eq("user_id", profile.data.id),
      sb.from("reading_progress").select("item_id, updated_at").eq("user_id", profile.data.id).eq("completed", true)
    ]);
    let collections = await sb.from("shelf_collections").select("id, name, cover_url, is_public, item_ids, collection_type, blog_ids, is_featured, cover_styles, cover_choices, sort_order").eq("owner_id", profile.data.id).order("created_at", { ascending: true });
    if (collections.error) {
      collections = await sb.from("shelf_collections").select("id, name, cover_url, is_public, item_ids, collection_type, blog_ids, is_featured").eq("owner_id", profile.data.id).order("created_at", { ascending: true });
    }
    const authoredBlogs = await sb.from("blog_posts").select("id, author_id, title, excerpt, cover_url, image_2_url, image_3_url, status, is_featured, created_at, published_at").eq("author_id", profile.data.id).eq("status", "published").order("published_at", { ascending: false });
    const publicCollectionBlogIds = [...new Set((collections.data || []).filter(collection => collection.collection_type === "blog" && collection.is_public !== false).flatMap(collection => Array.isArray(collection.blog_ids) ? collection.blog_ids : []))];
    const collectionBlogs = publicCollectionBlogIds.length ? await sb.from("blog_posts").select("id, author_id, title, excerpt, cover_url, image_2_url, image_3_url, status, is_featured, created_at, published_at").in("id", publicCollectionBlogIds).eq("status", "published") : { data: [] };
    const publicBlogSaves = profile.data.shelf_blogs_public !== false ? await sb.from("blog_saves").select("blog_id").eq("user_id", profile.data.id) : { data: [] };
    const publicSavedBlogIds = (publicBlogSaves.data || []).map(row => row.blog_id);
    const savedBlogs = publicSavedBlogIds.length ? await sb.from("blog_posts").select("id, author_id, title, excerpt, cover_url, image_2_url, image_3_url, status, is_featured, created_at, published_at").in("id", publicSavedBlogIds).eq("status", "published") : { data: [] };
    const achievements = await sb.from("user_achievements").select("achievements(name, description, icon)").eq("user_id", profile.data.id);
    const likes = await sb.from("shelf_collection_likes").select("collection_id, user_id").eq("owner_id", profile.data.id);
    const followers = await sb.from("profile_follows").select("follower_id").eq("following_id", profile.data.id);
    const following = await sb.from("profile_follows").select("following_id").eq("follower_id", profile.data.id);
    const isFollowing = state.session?.user?.id ? (followers.data || []).some(row => row.follower_id === state.session.user.id) : false;
    const moderationHistory = ["moderator", "admin"].includes(state.profile?.plan)
      ? await sb.from("moderation_actions").select("id, actor_id, action, duration_until, details, created_at").eq("target_id", profile.data.id).order("created_at", { ascending: false })
      : { data: [] };
    const actorIds = [...new Set((moderationHistory.data || []).map(entry => entry.actor_id).filter(Boolean))];
    const actors = actorIds.length ? await sb.from("profiles").select("id, username").in("id", actorIds) : { data: [] };
    const actorNames = new Map((actors.data || []).map(actor => [actor.id, actor.username]));
    const collectionLikes = new Set((likes.data || []).filter(row => row.user_id === state.session?.user?.id).map(row => row.collection_id));
    const collectionLikeCounts = (likes.data || []).reduce((counts, row) => counts.set(row.collection_id, (counts.get(row.collection_id) || 0) + 1), new Map());
    const publicCoverChoicesResult = ["premium", "moderator", "admin"].includes(profile.data.plan)
      ? await sb.from("user_cover_choices").select("item_id, variant_key, label, cover_url").eq("user_id", profile.data.id)
      : { data: [] };
    const publicCoverChoices = new Map((publicCoverChoicesResult.data || []).map(choice => [choice.item_id, choice]));
    const publicCoverStylesResult = await sb.from("user_cover_styles").select("item_id, style").eq("user_id", profile.data.id);
    const publicCoverStyles = new Map((publicCoverStylesResult.data || []).map(choice => [choice.item_id, choice.style]));
    const publicSeriesCoverChoicesResult = await sb.from("user_series_cover_choices").select("series_id, item_id, cover_url, variant_key, is_variant").eq("user_id", profile.data.id);
    const publicSeriesCoverChoices = new Map((publicSeriesCoverChoicesResult.data || []).map(choice => [choice.series_id, choice]));
    const savedCollectionLinks = await sb.from("shelf_collection_saves").select("collection_id, owner_id").eq("user_id", profile.data.id);
    const savedCollectionIds = (savedCollectionLinks.data || []).map(row => row.collection_id);
    const savedCollectionsResult = savedCollectionIds.length
      ? await sb.from("shelf_collections").select("id, owner_id, name, cover_url, is_public, item_ids, collection_type, is_featured").in("id", savedCollectionIds).eq("is_public", true).eq("collection_type", "comic")
      : { data: [] };
    const savedOwnerIds = [...new Set((savedCollectionsResult.data || []).map(collection => collection.owner_id).filter(Boolean))];
    const savedOwnersResult = savedOwnerIds.length ? await sb.from("profiles").select("id, username").in("id", savedOwnerIds) : { data: [] };
    const savedOwners = new Map((savedOwnersResult.data || []).map(owner => [owner.id, owner.username]));
    const savedPublicCollections = (savedCollectionsResult.data || []).map(collection => ({ ...collection, username: savedOwners.get(collection.owner_id) || "" })).filter(collection => collection.username);
    const wallCommentsResult = await loadProfileWallComments(profile.data.id);
    const activity = await buildPublicProfileActivity(profile.data, activityResults.map(result => result.data || []), [...(collections.data || []), ...(savedCollectionsResult.data || [])]);
    state.publicProfile = {
      profile: profile.data,
      collectionId,
      collections: (collections.data || []).filter(collection => collection.collection_type !== "blog").map(collection => ({ id: collection.id, name: collection.name, coverUrl: collection.cover_url || "", isPublic: collection.is_public !== false, is_featured: collection.is_featured === true, itemIds: Array.isArray(collection.item_ids) ? collection.item_ids : [], sortOrder: collection.sort_order || "added_desc", coverStyles: collection.cover_styles || {}, coverChoices: collection.cover_choices || {} })),
      blogCollections: (collections.data || []).filter(collection => collection.collection_type === "blog").map(collection => ({ id: collection.id, name: collection.name, coverUrl: collection.cover_url || "", isPublic: collection.is_public !== false, is_featured: collection.is_featured === true, blogIds: Array.isArray(collection.blog_ids) ? collection.blog_ids : [] })),
      authoredBlogPosts: authoredBlogs.data || [],
      savedBlogPosts: savedBlogs.data || [],
      collectionBlogPosts: collectionBlogs.data || [],
      favoriteIds: new Set((favorites.data || []).map(row => row.item_id)),
      favoriteAddedAt: new Map((favorites.data || []).map(row => [row.item_id, row.created_at])),
      comicLikeAddedAt: new Map((comicLikes.data || []).map(row => [row.item_id, row.created_at])),
      savedPublishers: savedPublishersResult.data || [],
      comicLikeIds: new Set((comicLikes.data || []).map(row => row.item_id)),
      readingProgress: new Map((progress.data || []).map(row => [row.item_id, row])),
      achievements: (achievements.data || []).map(row => row.achievements).filter(Boolean),
      collectionLikes,
      collectionLikeCounts,
      coverChoices: publicCoverChoices
      ,coverStyles: publicCoverStyles
      ,seriesCoverChoices: publicSeriesCoverChoices
      ,savedPublicCollections
      ,wallComments: wallCommentsResult
      ,activity
      ,moderationHistory: (moderationHistory.data || []).map(entry => ({ ...entry, actor_username: actorNames.get(entry.actor_id) || "moderador" }))
      ,isFollowing
      ,followerCount: (followers.data || []).length
      ,followingCount: (following.data || []).length
    };
    render();
  }

  async function signOut() {
    await sb?.auth.signOut();
    if (state.presenceInterval) clearInterval(state.presenceInterval);
    state.presenceInterval = null;
    state.notificationChannel?.unsubscribe?.();
    state.notificationChannel = null;
    clearLocalBox();
    try { localStorage.removeItem(OFFLINE_ACCOUNT_KEY); } catch {}
    state.localBoxVisible = false;
    state.session = null; state.profile = null; state.downloads = new Map(); state.favoriteIds = new Set(); state.favoriteAddedAt = new Map(); state.readingProgress = new Map(); state.shelfSnapshot = null; state.shelfCategories = []; state.comicLikeIds = new Set(); state.comicLikeAddedAt = new Map(); state.achievements = []; state.achievementChecks = new Set(); state.savedPublisherKeys = new Set(); state.savedPublishers = [];
    state.notifications = [];
    state.notificationUnreadCount = 0;
    state.section = "home"; render(); toast("Você saiu da conta.");
  }

  function clearLocalBox() {
    state.localBoxFiles.forEach(file => file.fileUrl && URL.revokeObjectURL(file.fileUrl));
    state.localBoxFiles = [];
  }

  function localFileFrom(file) {
    const name = file.name.replace(/\\/g, "/").split("/").pop();
    const title = name.replace(/\.(pdf|cbz|cbr|jpg|jpeg|png|webp|gif)$/i, "");
    return { id: `local-${Date.now()}-${Math.random().toString(36).slice(2)}`, title, issue: "", type: "comic", year: "", format: extension(name), file, fileUrl: URL.createObjectURL(file), local: true, clicks: 0 };
  }

  function supportedLocalFile(file) {
    return /\.(pdf|cbz|cbr|jpg|jpeg|png|webp|gif)$/i.test(file.name);
  }

  function openLocalFile(file, keepInBox = false) {
    if (!file || !supportedLocalFile(file)) return toast("Escolha um PDF, CBZ, CBR ou uma imagem.");
    const item = localFileFrom(file);
    if (keepInBox) {
      state.localBoxFiles.push(item);
      render();
      toast("Pasta adicionada à Minha caixa. Ela ficará disponível apenas nesta sessão.");
      return;
    }
    openReader(item, { localObjectUrl: item.fileUrl });
  }

  function ensureShelfSnapshot() {
    if (!state.shelfSnapshot) state.shelfSnapshot = { saved: new Set(state.favoriteIds), read: new Set([...state.readingProgress.entries()].filter(([, row]) => row.completed).map(([id]) => id)) };
    return state.shelfSnapshot;
  }

  function rememberShelfItem(kind, itemId) {
    ensureShelfSnapshot()[kind].add(itemId);
  }

  async function toggleFavorite(itemId) {
    if (!state.session) return openAuthPage();
    if (state.favoriteIds.has(itemId)) {
      await sb.from("favorites").delete().eq("user_id", state.session.user.id).eq("item_id", itemId);
      state.favoriteIds.delete(itemId);
      state.favoriteAddedAt.delete(itemId);
    } else {
      await sb.from("favorites").insert({ user_id: state.session.user.id, item_id: itemId });
      state.favoriteIds.add(itemId);
      state.favoriteAddedAt.set(itemId, new Date().toISOString());
      rememberShelfItem("saved", itemId);
      awardAchievement("first_favorite");
    }
    updateFavoriteButtons(itemId);
    render();
  }

  async function toggleSeriesFavorite(seriesId) {
    if (!state.session) return openAuthPage();
    const saved = state.favoriteIds.has(seriesId);
    const result = saved
      ? await sb.from("favorites").delete().eq("user_id", state.session.user.id).eq("item_id", seriesId)
      : await sb.from("favorites").insert({ user_id: state.session.user.id, item_id: seriesId });
    if (result.error) return toast("Não foi possível atualizar as séries salvas.");
    if (saved) { state.favoriteIds.delete(seriesId); state.favoriteAddedAt.delete(seriesId); }
    else { state.favoriteIds.add(seriesId); state.favoriteAddedAt.set(seriesId, new Date().toISOString()); rememberShelfItem("saved", seriesId); awardAchievement("first_favorite"); }
    render();
  }

  function usableCoverVariants(item) {
    const mainCoverUrl = String(item?.coverUrl || "").trim();
    return (state.coverVariants.get(item?.id) || []).filter(variant => {
      const coverUrl = String(variant.cover_url || "").trim();
      return coverUrl && coverUrl !== mainCoverUrl;
    });
  }

  function openStyledCoverConfirm(message, onConfirm, options = {}) {
    const overlay = document.createElement("div");
    overlay.className = "modal-backdrop";
    const title = options.title || "Remover capa variante?";
    const cancelLabel = options.cancelLabel || "Cancelar";
    const confirmLabel = options.confirmLabel || "Remover";
    overlay.innerHTML = `<div class="modal cover-remove-confirm-modal"><div class="section-head"><div><div class="eyebrow">Administrador</div><h2>${escapeHTML(title)}</h2><div class="section-subtitle">${escapeHTML(message)}</div></div><button type="button" class="small-btn" data-close>${escapeHTML(cancelLabel)}</button></div><div class="modal-actions"><button type="button" class="small-btn" data-close>${escapeHTML(cancelLabel)}</button><button type="button" class="btn btn-danger" data-confirm-remove>${escapeHTML(confirmLabel)}</button></div></div>`;
    $("#modal-root").appendChild(overlay);
    $$('[data-close]', overlay).forEach(button => button.onclick = () => overlay.remove());
    overlay.addEventListener("click", event => { if (event.target === overlay) overlay.remove(); });
    $('[data-confirm-remove]', overlay).onclick = async event => {
      event.currentTarget.disabled = true;
      overlay.remove();
      await onConfirm();
    };
  }

  function openCoverChoice(itemId, collectionId = "") {
    const existingOverlay = $("#modal-root .cover-choice-modal")?.closest(".modal-backdrop");
    if (existingOverlay) return;
    if (!state.session) return openAuthPage();
    if (!["premium", "moderator", "admin"].includes(state.profile?.plan)) return toast("A escolha de capas variantes é exclusiva para usuários Lenda, moderadores e administradores.");
    const item = state.db.library.find(entry => entry.id === itemId);
    if (!item) return;
    const isAdmin = state.profile?.plan === "admin";
    const savedForCover = isAdmin || state.favoriteIds.has(itemId) || (item.seriesId && state.favoriteIds.has(item.seriesId));
    if (!savedForCover) return toast("Salve o quadrinho ou a série na estante antes de escolher uma capa.");
    const collection = collectionId ? state.publicProfile?.collections?.find(entry => entry.id === collectionId) : null;
    const collectionOwner = collection?.ownerId || state.publicProfile?.profile?.id;
    if (collectionId && collectionOwner !== state.session.user.id) return toast("Somente o criador pode alterar capas nesta coleção.");
    const collectionChoices = collectionId ? (collection?.coverChoices || {}) : null;
    const current = collectionId
      ? collectionChoices?.[itemId]
      : state.previewCoverChoices.get(itemId) || state.previewCoverChoices.get(String(itemId)) || state.coverChoices.get(itemId) || state.coverChoices.get(String(itemId));
    const variants = usableCoverVariants(item);
    const botVariants = variants.filter(variant => String(variant.variant_key || "").startsWith("bot-"));
    const options = [{ variant_key: "__default", label: "Capa principal", cover_url: item.coverUrl || "" }, ...variants];
    const overlay = document.createElement("div");
    overlay.className = "modal-backdrop";
    overlay.innerHTML = `<div class="modal cover-choice-modal"><div class="section-head"><div><h2>Escolher capa</h2><div class="section-subtitle">${escapeHTML(itemDisplayTitle(item))}</div></div><button class="small-btn" data-close>Fechar</button></div><form id="cover-choice-form"><div class="cover-choice-options">${options.map(option => `<label class="cover-choice-option"><input type="radio" name="variantKey" value="${escapeHTML(option.variant_key)}" ${current?.variant_key === option.variant_key || (!current && option.variant_key === "__default") ? "checked" : ""}><img src="${escapeHTML(proxiedImageUrl(option.cover_url))}" alt=""><span>${escapeHTML(option.label)}</span>${state.profile?.plan === "admin" && option.variant_key !== "__default" ? `<button type="button" class="small-btn danger cover-variant-remove" data-remove-bot-variant="${escapeHTML(option.variant_key)}">${String(option.variant_key).startsWith("bot-") ? "🤖 " : ""}Remover</button>` : ""}</label>`).join("")}</div>${variants.length ? "" : '<div class="empty">Nenhuma capa variante foi cadastrada para esta edição.</div>'}<div class="modal-actions">${state.profile?.plan === "admin" && botVariants.length ? `<button type="button" class="small-btn danger" data-remove-bot-variants>🤖 Remover capas do bot</button>` : ""}<button type="button" class="small-btn" data-close>Cancelar</button><button class="btn btn-danger">Salvar capa</button></div></form></div>`;
    $("#modal-root").appendChild(overlay);
    $$('[data-close]', overlay).forEach(button => button.onclick = () => overlay.remove());
    overlay.addEventListener("click", event => { if (event.target === overlay) overlay.remove(); });
    if (isAdmin && !collectionId) {
      const previewButton = document.createElement("button");
      previewButton.type = "button";
      previewButton.className = "small-btn";
      previewButton.textContent = "Usar sem salvar";
      previewButton.onclick = () => {
        const selectedKey = String(new FormData($("#cover-choice-form", overlay)).get("variantKey") || "__default");
        const choice = variants.find(option => option.variant_key === selectedKey);
        state.previewCoverChoices.set(itemId, choice
          ? { item_id: itemId, variant_key: choice.variant_key, label: choice.label, cover_url: choice.cover_url }
          : { item_id: itemId, variant_key: "__default", label: "Capa principal", cover_url: item.coverUrl || "" });
        overlay.remove();
        updateCoverChoiceImages(itemId);
        toast("Capa aplicada sem salvar.");
      };
      $(".modal-actions", overlay)?.prepend(previewButton);
    }
    $$('[data-remove-bot-variant]', overlay).forEach(button => button.addEventListener("click", async event => {
      event.preventDefault();
      event.stopPropagation();
      const variantKey = button.dataset.removeBotVariant;
      openStyledCoverConfirm(variantKey.startsWith("bot-") ? "Esta capa foi adicionada pelo bot." : "Esta capa variante será removida do catálogo.", async () => {
        button.disabled = true;
        const result = await sb.functions.invoke("cover-variants-bot", { body: { action: "remove_variant", item_id: itemId, variant_key: variantKey } });
        if (result.error) {
          let detail = result.error.message || "Não foi possível remover esta capa.";
          try { const body = await result.error.context?.json?.(); if (body?.error) detail = body.error; } catch {}
          button.disabled = false;
          return toast(detail);
        }
        await loadCoverCatalog();
        overlay.remove();
        openCoverChoice(itemId, collectionId);
        toast(variantKey.startsWith("bot-") ? "Capa do bot removida." : "Capa variante removida.");
      });
    }));
    $('[data-remove-bot-variants]', overlay)?.addEventListener("click", event => {
      const batchButton = event.currentTarget;
      openStyledCoverConfirm(`${botVariants.length} capa(s) adicionada(s) pelo bot serão removidas desta edição.`, async () => {
        batchButton.disabled = true;
        const result = await sb.functions.invoke("cover-variants-bot", { body: { action: "remove_bot_variants", item_id: itemId } });
        if (result.error) {
          let detail = result.error.message || "Não foi possível remover as capas do bot.";
          try { const body = await result.error.context?.json?.(); if (body?.error) detail = body.error; } catch {}
          batchButton.disabled = false;
          return toast(detail);
        }
        if (current?.variant_key?.startsWith("bot-") && !collectionId) {
          await sb.from("user_cover_choices").delete().eq("user_id", state.session.user.id).eq("item_id", itemId);
        }
        await loadCoverCatalog();
        overlay.remove();
        toast(`${Number(result.data?.removed || botVariants.length)} capa(s) do bot removida(s).`);
      });
    });
    $("#cover-choice-form", overlay).onsubmit = async event => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const selectedKey = String(form.get("variantKey") || "__default");
      let choice = variants.find(option => option.variant_key === selectedKey);
      if (selectedKey === "__default") {
        const nextChoices = collectionId ? { ...collectionChoices } : null;
        if (collectionId) delete nextChoices[itemId];
        const result = collectionId
          ? await sb.from("shelf_collections").update({ cover_choices: nextChoices }).eq("id", collectionId).eq("owner_id", state.session.user.id)
          : await sb.from("user_cover_choices").delete().eq("user_id", state.session.user.id).eq("item_id", itemId);
        if (result.error) return toast(result.error.message);
        if (collectionId) collection.coverChoices = nextChoices;
        else state.coverChoices.delete(itemId);
      } else if (choice) {
        const nextChoice = { item_id: itemId, variant_key: choice.variant_key, label: choice.label, cover_url: choice.cover_url };
        const nextChoices = collectionId ? { ...collectionChoices, [itemId]: nextChoice } : null;
        const result = collectionId
          ? await sb.from("shelf_collections").update({ cover_choices: nextChoices }).eq("id", collectionId).eq("owner_id", state.session.user.id)
          : await sb.from("user_cover_choices").upsert({ user_id: state.session.user.id, ...nextChoice, updated_at: new Date().toISOString() }, { onConflict: "user_id,item_id" });
        if (result.error) return toast(result.error.message);
        if (collectionId) collection.coverChoices = nextChoices;
        else state.coverChoices.set(itemId, { item_id: itemId, ...choice });
      } else return toast("Essa capa variante não está cadastrada para esta edição.");
      state.previewCoverChoices.delete(itemId);
      overlay.remove();
      if (collectionId) await loadPublicProfile(state.publicProfile.profile.username, collectionId);
      else updateCoverChoiceImages(itemId);
      toast("Capa atualizada.");
    };
  }

  function openSeriesCoverChoice(seriesId) {
    const existingOverlay = $("#modal-root .series-cover-choice-modal")?.closest(".modal-backdrop");
    if (existingOverlay) return;
    if (!state.session) return openAuthPage();
    const editions = seriesEditions({ seriesId });
    if (!editions.length) return;
    const current = state.seriesCoverChoices.get(seriesId);
    const options = [];
    editions.forEach(edition => {
      if (edition.coverUrl) options.push({ key: `standard:${edition.id}`, itemId: edition.id, coverUrl: edition.coverUrl, label: `${itemDisplayTitle(edition)} · Capa padrão`, isVariant: false });
      if (["premium", "moderator", "admin"].includes(state.profile?.plan)) usableCoverVariants(edition).forEach(variant => options.push({ key: `variant:${edition.id}:${variant.variant_key}`, itemId: edition.id, coverUrl: variant.cover_url, label: `${itemDisplayTitle(edition)} · ${variant.label}`, variantKey: variant.variant_key, isVariant: true }));
    });
    const seriesStyle = coverStyleFor({ id: seriesId });
    const seriesModalEffects = `<div class="series-cover-modal-effects"><span>Estilo da capa:</span>${coverStyleControl(seriesId, seriesStyle)}</div>`;
    const overlay = document.createElement("div");
    overlay.className = "modal-backdrop";
    overlay.innerHTML = `<div class="modal series-cover-choice-modal"><div class="section-head"><div><h2>Escolher capa da série</h2><div class="section-subtitle">Escolha uma capa entre as edições desta série.</div></div><button class="small-btn" data-close>Fechar</button></div>${seriesModalEffects}<form id="series-cover-choice-form"><div class="cover-choice-options">${options.map(option => `<label class="cover-choice-option"><input type="radio" name="seriesCoverKey" value="${escapeHTML(option.key)}" ${current?.item_id === option.itemId && Boolean(current?.is_variant) === option.isVariant && (option.isVariant ? current?.variant_key === option.variantKey : true) || (!current && option.key === `standard:${editions[0].id}`) || (current?.is_variant && !["premium", "moderator", "admin"].includes(state.profile?.plan) && option.key === `standard:${editions[0].id}`) ? "checked" : ""}><img src="${escapeHTML(proxiedImageUrl(option.coverUrl))}" alt=""><span>${escapeHTML(option.label)}</span></label>`).join("")}</div><div class="modal-actions"><button type="button" class="small-btn" data-close>Cancelar</button><button class="btn btn-danger">Salvar capa</button></div></form></div>`;
    $("#modal-root").appendChild(overlay);
    $$('[data-close]', overlay).forEach(button => button.onclick = () => overlay.remove());
    $$('[data-cover-effect-item]', overlay).forEach(button => {
      button.addEventListener("mousedown", event => event.preventDefault());
      button.onclick = event => {
      event.stopPropagation();
      cycleCoverStyle(button.dataset.coverEffectItem, button.dataset.coverEffectCollection || "");
      };
    });
    $("#series-cover-choice-form", overlay).onsubmit = async event => {
      event.preventDefault();
      const selected = options.find(option => option.key === String(new FormData(event.currentTarget).get("seriesCoverKey")));
      if (!selected) return;
      const result = await sb.from("user_series_cover_choices").upsert({ user_id: state.session.user.id, series_id: seriesId, item_id: selected.itemId, cover_url: selected.coverUrl, variant_key: selected.variantKey || null, is_variant: selected.isVariant, updated_at: new Date().toISOString() }, { onConflict: "user_id,series_id" });
      if (result.error) return toast(result.error.message);
      state.seriesCoverChoices.set(seriesId, { series_id: seriesId, item_id: selected.itemId, cover_url: selected.coverUrl, variant_key: selected.variantKey || null, is_variant: selected.isVariant });
      overlay.remove();
      updateSeriesCoverImages(seriesId);
      toast("Capa da série atualizada.");
    };
  }

  async function setCoverStyle(itemId, style) {
    if (!state.session) return openAuthPage();
    if (style === "gold" && !["premium", "moderator", "admin"].includes(state.profile?.plan)) return toast("A capa dourada é exclusiva para usuários Lenda, moderadores e administradores.");
    const item = state.db.library.find(entry => entry.id === itemId) || state.db.library.find(entry => entry.seriesId === itemId);
    if (!item) return;
    const nextStyle = ["normal", "grayscale", "gold"].includes(style) ? style : "normal";
    const result = nextStyle === "normal"
      ? await sb.from("user_cover_styles").delete().eq("user_id", state.session.user.id).eq("item_id", itemId)
      : await sb.from("user_cover_styles").upsert({ user_id: state.session.user.id, item_id: itemId, style: nextStyle, updated_at: new Date().toISOString() }, { onConflict: "user_id,item_id" });
    if (result.error) return toast(result.error.message);
    if (nextStyle === "normal") state.coverStyles.delete(itemId);
    else state.coverStyles.set(itemId, nextStyle);
    updateCoverStyleImages(itemId);
  }

  function updateCoverChoiceImages(itemId) {
    const item = state.db.library.find(entry => entry.id === itemId);
    if (!item) return;
    const cover = coverFor(item);
    $$('[data-cover-id]').filter(element => element.dataset.coverId === itemId).forEach(element => {
      element.dataset.coverReady = "true";
      element.style.backgroundImage = `url("${cover}")`;
    });
  }

  function updateCoverStyleImages(itemId) {
    const style = coverStyleFor({ id: itemId });
    $$('[data-cover-id]').filter(element => element.dataset.coverId === itemId).forEach(element => { element.dataset.coverStyle = style; });
    $$('[data-favorite]').filter(element => element.dataset.favorite === itemId).forEach(element => {
      element.classList.toggle("has-cover-filter", style !== "normal" && element.classList.contains("is-favorite"));
    });
    $$('[data-cover-style-item]').filter(element => element.dataset.coverStyleItem === itemId).forEach(element => { element.dataset.coverStyle = style; });
    $$('[data-cover-effect-item]').filter(element => element.dataset.coverEffectItem === itemId).forEach(element => {
      const premium = ["premium", "moderator", "admin"].includes(state.profile?.plan);
      const nextLabel = style === "normal" ? "Aplicar preto e branco" : style === "grayscale" && premium ? "Aplicar capa dourada" : "Voltar à capa normal";
      element.classList.remove("cover-effect-normal", "cover-effect-grayscale", "cover-effect-gold");
      element.classList.add(`cover-effect-${style}`);
      element.classList.toggle("is-active", style !== "normal");
      element.title = nextLabel;
      element.setAttribute("aria-label", nextLabel);
    });
  }

  function updateSeriesCoverImages(seriesId) {
    const item = state.db.library.find(entry => entry.seriesId === seriesId);
    if (!item) return;
    const cover = seriesCoverFor(item);
    $$('[data-series-cover-id]').filter(element => element.dataset.seriesCoverId === seriesId).forEach(element => { element.style.backgroundImage = `url("${cover}")`; });
  }

  function updateFavoriteButtons(itemId) {
    const favorite = state.favoriteIds.has(itemId);
    $$('[data-favorite]').filter(button => button.dataset.favorite === itemId).forEach(button => {
      button.classList.toggle("is-favorite", favorite);
      button.textContent = favorite ? "★" : "☆";
    });
  }

  function updateComicLikeButtons(itemId) {
    const liked = state.comicLikeIds.has(itemId);
    const count = state.comicLikeCounts.get(itemId) || 0;
    $$('[data-like-item]').filter(button => button.dataset.likeItem === itemId).forEach(button => {
      button.classList.toggle("is-liked", liked);
      button.textContent = `${liked ? "♥" : "♡"} ${count}`;
    });
  }

  async function toggleComicLike(itemId) {
    if (!state.session) return openAuthPage();
    const liked = state.comicLikeIds.has(itemId);
    const result = liked
      ? await sb.from("comic_likes").delete().eq("user_id", state.session.user.id).eq("item_id", itemId)
      : await sb.from("comic_likes").insert({ user_id: state.session.user.id, item_id: itemId });
    if (result.error) return toast("Não foi possível atualizar a curtida.");
    if (liked) {
      state.comicLikeIds.delete(itemId);
      state.comicLikeAddedAt?.delete(itemId);
      state.comicLikeCounts.set(itemId, Math.max(0, (state.comicLikeCounts.get(itemId) || 1) - 1));
    } else {
      state.comicLikeIds.add(itemId);
      state.comicLikeAddedAt ||= new Map();
      state.comicLikeAddedAt.set(itemId, new Date().toISOString());
      state.comicLikeCounts.set(itemId, (state.comicLikeCounts.get(itemId) || 0) + 1);
      awardProfileXp("like", `like:${itemId}`);
    }
    updateComicLikeButtons(itemId);
  }

  function comicLinkWithSenderAppearance(rawUrl) {
    const original = String(rawUrl || "");
    let linkUrl;
    try { linkUrl = new URL(original, window.location.href); } catch { return original; }
    if (linkUrl.origin !== window.location.origin) return original;
    const itemId = linkUrl.searchParams.get("ler");
    const item = itemId ? state.db.library.find(entry => String(entry.id) === String(itemId) && entry.type === "comic") : null;
    if (!item) return original;
    const publicCollection = state.section === "public-profile" && state.publicProfile?.collectionId
      ? state.publicProfile.collections?.find(collection => collection.id === state.publicProfile.collectionId)
      : null;
    const choice = (publicCollection?.coverChoices?.[item.id] || null) || state.coverChoices.get(item.id);
    if (!linkUrl.searchParams.get("capa_url") && choice?.cover_url) linkUrl.searchParams.set("capa_url", choice.cover_url);
    if (!linkUrl.searchParams.get("capa") && choice?.variant_key) linkUrl.searchParams.set("capa", choice.variant_key);
    const style = senderCoverStyleFor(item, publicCollection);
    if (style === "normal") linkUrl.searchParams.delete("efeito");
    else linkUrl.searchParams.set("efeito", style);
    return linkUrl.href;
  }

  function senderCoverStyleFor(item, publicCollection = null) {
    const collectionStyle = publicCollection?.coverStyles?.[item?.id]
      || (item?.seriesId && publicCollection?.coverStyles?.[item.seriesId]);
    if (["normal", "grayscale", "gold"].includes(collectionStyle)) return collectionStyle;
    const userStyle = state.coverStyles.get(item?.id) || (item?.seriesId && state.coverStyles.get(item.seriesId));
    return ["normal", "grayscale", "gold"].includes(userStyle) ? userStyle : "normal";
  }

  function prepareChatMessage(rawBody) {
    const source = String(rawBody || "").trim();
    const previews = [];
    const body = source.replace(/https?:\/\/[^\s<]+/gi, rawUrl => {
      const enrichedUrl = comicLinkWithSenderAppearance(rawUrl);
      let parsed;
      try { parsed = new URL(enrichedUrl, window.location.href); } catch { return enrichedUrl; }
      const itemId = parsed.searchParams.get("ler");
      const item = itemId ? state.db.library.find(entry => String(entry.id) === String(itemId) && entry.type === "comic") : null;
      if (!item) return enrichedUrl;
      previews.push({
        url: enrichedUrl,
        item_id: String(item.id),
        cover_url: parsed.searchParams.get("capa_url") || null,
        variant_key: parsed.searchParams.get("capa") || null,
        cover_style: senderCoverStyleFor(item)
      });
      return enrichedUrl;
    });
    return { body, metadata: previews.length ? { comic_previews: previews } : {} };
  }

  async function shareComic(itemId) {
    const item = state.db.library.find(entry => entry.id === itemId);
    if (!item) return;
    const link = comicLinkWithSenderAppearance(new URL(routeUrl({ ler: item.id }), window.location.href).href);
    try {
      if (navigator.share) await navigator.share({ title: item.title || "Quadrinho", text: `Leia ${item.title || "este quadrinho"} na Banca Digital`, url: link });
      else { await navigator.clipboard.writeText(link); toast("Link do quadrinho copiado."); }
    } catch (error) {
      if (error?.name !== "AbortError") window.prompt("Copie o link do quadrinho:", link);
    }
  }

  function openAuthPage() { state.authMode = "login"; setSection("login"); }
  function openSignupPage() { state.authMode = "signup"; setSection("signup"); }

  function safeTitleColor(value) {
    return /^#[0-9a-f]{6}$/i.test(String(value || "")) ? value : "#ffd45c";
  }

  function profileTitle(value) {
    return String(value || "").trim().slice(0, 10);
  }

  function trophyRoom(achievements = []) {
    return "";
    return `<div class="trophy-room"><div class="trophy-room-title">Sala de troféus</div><div class="achievement-list">${achievements.length ? achievements.map(a => `<span title="${escapeHTML(a.description || "")}">${escapeHTML(a.icon || "★")} ${escapeHTML(a.name)}</span>`).join("") : '<span class="trophy-empty">Nenhuma insígnia conquistada ainda.</span>'}</div></div>`;
  }

  function awardAchievement(key) {
    if (!state.session || !sb || state.achievementChecks.has(key)) return;
    state.achievementChecks.add(key);
    sb.rpc("award_achievement", { p_key: key }).then(result => {
      if (result.error) console.warn("Não foi possível atualizar a conquista:", result.error.message);
      else loadAccount();
    });
  }

  function progressFor(item, progressMap = state.readingProgress) {
    return progressMap?.get(item?.id) || null;
  }

  function isSeriesCompleted(item, progressMap = state.readingProgress) {
    const editions = seriesEditions(item);
    return Boolean(item?.seriesId && editions.length > 0 && editions.every(edition => progressMap?.get(edition.id)?.completed));
  }

  function completedSeriesItems(progressMap = state.readingProgress) {
    const seen = new Set();
    return state.db.library.filter(item => {
      if (!item.seriesId || seen.has(item.seriesId)) return false;
      seen.add(item.seriesId);
      return isSeriesCompleted(item, progressMap);
    });
  }

  function updateCompletionCards(item, completed) {
    $$('[data-open]').filter(element => element.dataset.open === item?.id).forEach(cardElement => {
      const existing = $(".card-completed", cardElement);
      if (completed && !existing) {
        const status = document.createElement("div");
        status.className = "card-completed";
        status.textContent = "✓ Lida";
        cardElement.querySelector(".card-body")?.before(status);
      } else if (!completed && existing) {
        existing.remove();
      }
    });
  }

  async function saveReadingProgress(item, page, totalPages) {
    if (!state.session || !sb || item?.local || !item?.id || !totalPages) return;
    const current = progressFor(item);
    const completed = Boolean(current?.completed) || page >= Math.max(1, totalPages - 2);
    const row = { user_id: state.session.user.id, item_id: item.id, page: Math.max(1, Math.min(page, totalPages)), total_pages: totalPages, completed, updated_at: new Date().toISOString() };
    state.readingProgress.set(item.id, row);
    if (completed) rememberShelfItem("read", item.id);
    $("[data-toggle-read]")?.replaceChildren(document.createTextNode(completed ? "Desmarcar como lida" : "Marcar como lida"));
    updateCompletionCards(item, completed);
    awardAchievement("first_read");
    if (isSeriesCompleted(item)) { awardAchievement("first_completed"); awardAchievement("five_completed"); }
    const result = await sb.from("reading_progress").upsert(row, { onConflict: "user_id,item_id" });
    if (result.error) console.warn("Não foi possível salvar o progresso de leitura:", result.error.message);
  }

  function toggleReadingCompleted(item, totalPages = progressFor(item)?.total_pages || 1) {
    if (!state.session || !sb || item?.local) return;
    const current = progressFor(item);
    const row = { user_id: state.session.user.id, item_id: item.id, page: current?.page || 1, total_pages: totalPages, completed: !current?.completed, updated_at: new Date().toISOString() };
    state.readingProgress.set(item.id, row);
    if (row.completed) rememberShelfItem("read", item.id);
    updateCompletionCards(item, row.completed);
    if (row.completed && isSeriesCompleted(item)) { awardAchievement("first_completed"); awardAchievement("five_completed"); }
    const result = sb.from("reading_progress").upsert(row, { onConflict: "user_id,item_id" });
    const nextCompleted = row.completed;
    result.then(response => { if (response.error) console.warn("Não foi possível atualizar o status de leitura:", response.error.message); });
    return nextCompleted;
  }

  const coverMemoryCache = new Map();
  const coverLoading = new Map();
  const coverAbortControllers = new Map();
  let deferredCoverObserver = null;

  function cancelCoverLoads() {
    deferredCoverObserver?.disconnect();
    deferredCoverObserver = null;
    for (const controller of coverAbortControllers.values()) controller.abort();
    coverAbortControllers.clear();
    coverLoading.clear();
    $$('[data-cover-id]').forEach(element => {
      const maxWidth = element.classList.contains("hero-bg") || element.classList.contains("hero-cover") ? 1200 : 480;
      if (!coverMemoryCache.has(`${element.dataset.coverId}:${maxWidth}`)) element.dataset.coverReady = "";
    });
  }

  function setReadingMode(mode) {
    state.readingMode = mode;
    localStorage.setItem("readingMode", mode);
  };

  function setReadingDirection(direction) {
    state.readingDirection = direction;
    localStorage.setItem("readingDirection", direction);
  }

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  function escapeHTML(value = "") {
    return String(value).replace(/[&<>"']/g, c => ({
      "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;"
    }[c]));
  }

  function getSpreadIndexes(totalPages, spread) {
    const a = spread * 2;
    const b = a + 1;

    if (state.readingDirection === "eastern") {
      return [b, a].filter(i => i < totalPages);
    }
    return [a, b].filter(i => i < totalPages);
  }

  function getSpreadPages(totalPages, spread) {
    const first = spread * 2 + 1;
    const second = first + 1;

    if (state.readingDirection === "eastern") {
      return [second, first].filter(p => p <= totalPages);
    }
    return [first, second].filter(p => p <= totalPages);
  }

  function getReaderPages(totalPages, skipCover) {
    const firstPage = skipCover && totalPages > 1 ? 2 : 1;
    return Array.from({ length: totalPages - firstPage + 1 }, (_, index) => firstPage + index);
  }

  function getReaderSpreadPages(totalPages, spread, skipCover) {
    const pages = getReaderPages(totalPages, skipCover).slice(spread * 2, spread * 2 + 2);
    return state.readingDirection === "eastern" ? pages.reverse() : pages;
  }

  function getReaderSpreadIndexes(totalPages, spread, skipCover) {
    return getReaderSpreadPages(totalPages, spread, skipCover).map(page => page - 1);
  }

  function formatType(type) {
    return type === "manga" ? "Mangá" : "Quadrinho";
  }

  function save() {
    DataStore.save(state.db);
  }

  function toast(message) {
    if (state.suppressDownloadReadyToast && String(message).includes("Quadrinho")) {
      state.suppressDownloadReadyToast = false;
      return;
    }
    const el = document.createElement("div");
    el.className = "toast";
    el.textContent = message;
    $("#toast-root").appendChild(el);
    setTimeout(() => el.remove(), 2800);
  }

  function openPasswordRecoveryModal() {
    const overlay = document.createElement("div");
    overlay.className = "modal-backdrop";
    overlay.innerHTML = `
      <div class="modal auth-modal">
        <div class="section-head">
          <div>
            <h2>Recuperar acesso</h2>
            <div class="section-subtitle">Informe o email associado à sua conta para receber o link de recuperação.</div>
          </div>
          <button class="small-btn" type="button" data-close>Fechar</button>
        </div>
        <form id="password-recovery-form">
          <div class="field">
            <label for="recovery-email">Email da conta</label>
            <input id="recovery-email" name="email" type="email" required placeholder="voce@email.com" autocomplete="email">
          </div>
          <div class="modal-actions">
            <button type="button" class="small-btn" data-close>Cancelar</button>
            <button class="btn btn-danger" type="submit">Enviar link</button>
          </div>
          <div class="auth-message" id="recovery-message"></div>
        </form>
        </form>
      </div>`;
    $("#modal-root").appendChild(overlay);
    $$("[data-close]", overlay).forEach(button => button.onclick = () => overlay.remove());
    $("#recovery-email", overlay)?.focus();
    $("#password-recovery-form", overlay).addEventListener("submit", async event => {
      event.preventDefault();
      const email = String(new FormData(event.currentTarget).get("email") || "").trim();
      const message = $("#recovery-message", overlay);
      const submit = $('button[type="submit"]', event.currentTarget);
      submit.disabled = true;
      if (!sb) {
        message.textContent = "A autenticação ainda não foi configurada.";
        submit.disabled = false;
        return;
      }
      const redirectTo = `${window.location.origin}${window.location.pathname}`;
      const result = await sb.auth.resetPasswordForEmail(email, { redirectTo });
      if (result.error) {
        message.textContent = result.error.message;
        submit.disabled = false;
        return;
      }
      overlay.remove();
      toast("Enviamos o link de recuperação para o email informado.");
    });
  }

  function weightedRandom(items) {
    return items[Math.floor(Math.random() * items.length)];
  }

  function seriesKey(value = "") {
    return String(value).trim().toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }

  function issueSortValue(item) {
    const explicitOrder = Number(item?.sortOrder);
    if (Number.isFinite(explicitOrder)) return explicitOrder;
    const issueNumber = Number(String(item?.issue || "").match(/\d+(?:\.\d+)?/)?.[0]);
    return Number.isFinite(issueNumber) ? issueNumber : Number.MAX_SAFE_INTEGER;
  }

  function uniqueCatalogItems(items) {
    const seen = new Set();
    return items.filter(item => {
      const key = item.seriesId || item.id;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function personalizedRecommendations(lib) {
    if (!state.session) return [];
    const saved = state.favoriteIds || new Set();
    const liked = state.comicLikeIds || new Set();
    const seeds = lib.filter(item => saved.has(item.id) || liked.has(item.id) || (item.seriesId && saved.has(item.seriesId)));
    if (!seeds.length) return [];

    const values = value => String(value || "").toLowerCase().split(/\s*(?:\/|&|,|\be\b)\s*/i).map(part => seriesKey(part)).filter(Boolean);
    const tags = value => (Array.isArray(value) ? value : String(value || "").split(",")).map(part => seriesKey(part)).filter(Boolean);
    const fields = ["publisher", "imprint", "author", "character"];
    const preferences = new Map(fields.map(field => [field, new Set()]));
    const preferredTags = new Set();
    seeds.forEach(seed => {
      fields.forEach(field => values(seed[field]).forEach(value => preferences.get(field).add(value)));
      tags(seed.tags).forEach(tag => preferredTags.add(tag));
    });

    const seedIds = new Set(seeds.map(item => item.id));
    const seedSeries = new Set(seeds.map(item => item.seriesId).filter(Boolean));
    const candidates = lib.filter(item => !seedIds.has(item.id) && !(item.seriesId && seedSeries.has(item.seriesId)) && !item.local);
    const ranked = candidates.map(item => {
      let score = Math.log1p(Number(item.clicks) || 0) * .25 + (item.featured ? 1 : 0);
      fields.forEach(field => { if (values(item[field]).some(value => preferences.get(field).has(value))) score += field === "publisher" ? 4 : 3; });
      if (tags(item.tags).some(tag => preferredTags.has(tag))) score += 2;
      score += (state.comicLikeCounts.get(item.id) || 0) * .35;
      return { item, score };
    }).sort((a, b) => b.score - a.score || itemDisplayTitle(a.item).localeCompare(itemDisplayTitle(b.item), "pt-BR"));

    return uniqueCatalogItems(ranked.map(entry => entry.item)).slice(0, 6);
  }

  function readArtistSeriesRecommendation(lib) {
    const completedReads = [...(state.readingProgress || new Map()).entries()]
      .filter(([, progress]) => progress?.completed)
      .sort(([, a], [, b]) => new Date(b.updated_at || 0) - new Date(a.updated_at || 0))
      .map(([itemId]) => lib.find(item => String(item.id) === String(itemId)))
      .filter(Boolean);
    const artistValues = value => String(value || "").toLowerCase()
      .split(/\s*(?:\/|&|\be\b)\s*/i)
      .map(part => seriesKey(part))
      .filter(Boolean);
    for (const readItem of completedReads) {
      const artists = new Set(artistValues(readItem.author));
      if (!artists.size) continue;
      const matches = lib.filter(item => item.seriesId && item.seriesId !== readItem.seriesId && artistValues(item.author).some(artist => artists.has(artist)));
      const seriesItems = uniqueCatalogItems(matches).slice(0, 20);
      if (seriesItems.length) return { readItem, seriesItems };
    }
    return null;
  }

  function openItem(item) {
    if (!item) return;
    if (!item.seriesId) return openReader(item);
    const editions = seriesEditions(item);
    if (editions.length < 2) return openReader(item);
    openSeriesSelection(item, editions);
  }

  function seriesEditions(item) {
    if (!item?.seriesId) return [];
    return state.db.library.filter(x => x.seriesId === item.seriesId)
      .sort((a, b) => issueSortValue(a) - issueSortValue(b));
  }

  function appendSeriesNavigation(item, controls, overlay) {
    const editions = seriesEditions(item);
    const previousHost = $("#reader-series-prev", overlay);
    const nextHost = $("#reader-series-next", overlay);
    if (editions.length < 2 || (!previousHost && !nextHost)) return;
    const current = editions.findIndex(x => x.id === item.id);
    const firstEdition = editions[0];
    const previousEdition = editions[current - 1];
    const nextEdition = editions[current + 1];
    const lastEdition = editions[editions.length - 1];
    const editionButtonLabel = edition => edition?.issue ? `#${escapeHTML(String(edition.issue))}` : "Edição";
    const createNavigation = (host, html) => {
      if (!host || host.querySelector("[data-series-nav]")) return;
      const nav = document.createElement("span");
      nav.dataset.seriesNav = "true";
      nav.className = "series-reader-nav";
      nav.innerHTML = html;
      host.appendChild(nav);
      $$('[data-series-target]', nav).forEach(button => button.addEventListener("click", () => {
      const target = editions[Number(button.dataset.seriesTarget)];
      if (!target || target.id === item.id) return;
      overlay._seriesObserver?.disconnect();
      overlay.remove();
      openReader(target);
      }));
    };
    if (current > 0) createNavigation(previousHost, `${current > 1 ? `<button title="Primeira edição${firstEdition?.issue ? ` — ${String(firstEdition.issue)}` : ""}" data-series-target="0">« ${editionButtonLabel(firstEdition)}</button>` : ""}<button title="Edição anterior${previousEdition?.issue ? ` — ${String(previousEdition.issue)}` : ""}" data-series-target="${current - 1}">‹ ${editionButtonLabel(previousEdition)}</button>`);
    if (current < editions.length - 1) createNavigation(nextHost, `<button title="Próxima edição${nextEdition?.issue ? ` — ${String(nextEdition.issue)}` : ""}" data-series-target="${current + 1}">${editionButtonLabel(nextEdition)} ›</button>${current < editions.length - 2 ? `<button title="Última edição${lastEdition?.issue ? ` — ${String(lastEdition.issue)}` : ""}" data-series-target="${editions.length - 1}">${editionButtonLabel(lastEdition)} »</button>` : ""}`);
  }

  function openEntityPage(kind, value) {
    state.entityFilter = { kind, value };
    state.collectionFilter = { field: "all", query: "" };
    navigate({ pagina: "entidade", tipo: kind, valor: value });
  }

  async function attachComments(item, overlay) {
    if (!sb || state.session?.offline || navigator.onLine === false) return;
    const panel = document.createElement("details");
    panel.className = "reader-comments";
    panel.innerHTML = `<div class="section-head"><h3>Comentários</h3></div><div class="comments-list"><span class="section-subtitle">Carregando...</span></div>${state.session ? '<form class="comment-form"><textarea name="body" maxlength="1000" required placeholder="Escreva um comentário..."></textarea><button class="small-btn">Comentar</button></form>' : '<p class="section-subtitle">Entre para comentar.</p>'}`;
    const summary = document.createElement("summary");
    summary.textContent = "Comentários";
    const content = document.createElement("div");
    content.className = "comments-content";
    while (panel.firstChild) content.appendChild(panel.firstChild);
    panel.append(summary, content);
    $(".comment-form button", panel)?.setAttribute("type", "submit");
    overlay.appendChild(panel);
    const list = $(".comments-list", panel);
    const refresh = async () => {
      const result = await sb.from("comments").select("id, body, created_at, profiles(username, avatar_url, title, plan, faction_id)").eq("item_id", item.id).order("created_at", { ascending: false });
      if (result.error) {
        list.innerHTML = '<span class="section-subtitle">Não foi possível carregar os comentários.</span>';
        return;
      }
      list.innerHTML = (result.data || []).map(comment => {
        const username = cleanUsername(comment.profiles?.username || "usuário");
        const profile = { ...(comment.profiles || {}), username };
        return `<article class="comment"><div class="comment-author-row">${avatarMarkup(profile, "comment-avatar")}<div class="comment-author-info"><a class="comment-author" href="${publicProfileHref(username)}" target="_blank" rel="noopener">@${escapeHTML(username)}</a>${profile.title ? `<span class="comment-title">${escapeHTML(profile.title)}</span>` : ""}</div></div><p>${escapeHTML(comment.body)}</p></article>`;
      }).join("") || '<span class="section-subtitle">Nenhum comentário ainda.</span>';
    };
    await refresh();
    $(".comment-form", panel)?.addEventListener("submit", async event => {
      event.preventDefault();
      event.stopImmediatePropagation();
      const form = event.currentTarget;
      const body = String(new FormData(form).get("body") || "").trim();
      const button = $("button", form);
      if (!state.session?.user?.id) { toast("Entre na sua conta para comentar."); return; }
      if (!body) return;
      button.disabled = true;
      const result = await sb.from("comments").insert({ user_id: state.session.user.id, item_id: item.id, body });
      if (result.error) toast(result.error.message);
      else { awardAchievement("first_comment"); awardProfileXp("comment", `comment:${item.id}:${Date.now()}`); form.reset(); await refresh(); }
      button.disabled = false;
    });
  }

  async function openCommentsPopup(item) {
    if (!sb || !item?.id) return toast("Os comentários ainda não estão disponíveis.");
    const overlay = document.createElement("div");
    overlay.className = "modal-backdrop comments-modal-backdrop";
    overlay.innerHTML = `<div class="modal comments-modal"><div class="section-head"><div><h2>Comentários</h2><div class="section-subtitle">${escapeHTML(itemDisplayTitle(item))}</div></div><button class="small-btn" data-close>Fechar</button></div><div class="comments-list"><span class="section-subtitle">Carregando...</span></div>${state.session ? '<form class="comment-form"><textarea name="body" maxlength="1000" required placeholder="Escreva um comentário..."></textarea><button class="small-btn" type="submit">Comentar</button></form>' : '<p class="section-subtitle">Entre para comentar.</p>'}</div>`;
    $("#modal-root").appendChild(overlay);
    $("[data-close]", overlay).onclick = () => overlay.remove();
    const list = $(".comments-list", overlay);
    const titleButton = document.createElement("button");
    titleButton.type = "button";
    titleButton.className = "comment-item-title";
    titleButton.textContent = itemDisplayTitle(item);
    titleButton.title = "Abrir quadrinho";
    titleButton.onclick = () => { overlay.remove(); openReader(item); };
    $(".section-head .section-subtitle", overlay)?.replaceWith(titleButton);
    const refresh = async () => {
      const result = await sb.from("comments").select("id, body, created_at, profiles(username, avatar_url, title, plan, faction_id)").eq("item_id", item.id).order("created_at", { ascending: false });
      if (result.error) { list.innerHTML = '<span class="section-subtitle">Não foi possível carregar os comentários.</span>'; return; }
      list.innerHTML = (result.data || []).map(comment => {
        const username = cleanUsername(comment.profiles?.username || "usuário");
        const profile = { ...(comment.profiles || {}), username };
        return `<article class="comment"><div class="comment-author-row">${avatarMarkup(profile, "comment-avatar")}<div class="comment-author-info"><a class="comment-author" href="${publicProfileHref(username)}" target="_blank" rel="noopener">@${escapeHTML(username)}</a>${profile.title ? `<span class="comment-title">${escapeHTML(profile.title)}</span>` : ""}</div></div><p>${escapeHTML(comment.body)}</p></article>`;
      }).join("") || '<span class="section-subtitle">Nenhum comentário ainda.</span>';
    };
    await refresh();
    $(".comment-form", overlay)?.addEventListener("submit", async event => {
      event.preventDefault();
      const form = event.currentTarget;
      const body = String(new FormData(form).get("body") || "").trim();
      if (!state.session?.user?.id || !body) return;
      const button = $("button", form); button.disabled = true;
      const result = await sb.from("comments").insert({ user_id: state.session.user.id, item_id: item.id, body });
      if (result.error) toast(result.error.message); else { awardProfileXp("comment", `comment:${item.id}:${Date.now()}`); form.reset(); await refresh(); }
      button.disabled = false;
    });
  }

  async function attachComments(item, overlay) {
    if (!sb || state.session?.offline || navigator.onLine === false) return;
    const panel = document.createElement("details");
    panel.className = "reader-comments";
    panel.innerHTML = `<summary>Comentários</summary><div class="comments-content"><div class="comments-list"><span class="section-subtitle">Carregando...</span></div>${state.session ? '<form class="comment-form"><textarea name="body" maxlength="1000" required placeholder="Escreva um comentário..."></textarea><button class="small-btn" type="submit">Comentar</button></form>' : '<p class="section-subtitle">Entre para comentar.</p>'}</div>`;
    overlay.appendChild(panel);
    const list = $(".comments-list", panel);
    const refresh = async () => {
      renderCommentThread(list, await loadCommentThread(item));
      linkCommentMentions(list);
    };
    bindCommentThread(panel, item, list, refresh);
    await refresh();
    $(".comment-form", panel)?.addEventListener("submit", async event => {
      event.preventDefault();
      const form = event.currentTarget;
      if (!state.session?.user?.id) return openAuthPage();
      const body = String(new FormData(form).get("body") || "").trim();
      if (!body) return;
      const button = $("button", form); button.disabled = true;
      const result = await sb.from("comments").insert({ user_id: state.session.user.id, item_id: item.id, body });
      if (result.error) toast(commentWriteError(result.error)); else { awardAchievement("first_comment"); awardProfileXp("comment", `comment:${item.id}:${Date.now()}`); form.reset(); await refresh(); }
      button.disabled = false;
    });
  }

  async function openCommentsPopup(item) {
    if (!sb || !item?.id) return toast("Os comentários ainda não estão disponíveis.");
    const overlay = document.createElement("div");
    overlay.className = "modal-backdrop comments-modal-backdrop";
    overlay.innerHTML = `<div class="modal comments-modal"><div class="section-head"><div><h2>Comentários</h2><div class="section-subtitle">${escapeHTML(item.title || "Quadrinho")}</div></div><button class="small-btn" data-close>Fechar</button></div><div class="comments-list"><span class="section-subtitle">Carregando...</span></div>${state.session ? '<form class="comment-form"><textarea name="body" maxlength="1000" required placeholder="Escreva um comentário..."></textarea><button class="small-btn" type="submit">Comentar</button></form>' : '<p class="section-subtitle">Entre para comentar.</p>'}</div>`;
    $("#modal-root").appendChild(overlay);
    $("[data-close]", overlay).onclick = () => overlay.remove();
    const list = $(".comments-list", overlay);
    const refresh = async () => {
      renderCommentThread(list, await loadCommentThread(item));
      linkCommentMentions(list);
    };
    const titleButton = document.createElement("button");
    titleButton.type = "button";
    titleButton.className = "comment-item-title";
    titleButton.textContent = itemDisplayTitle(item);
    titleButton.title = "Abrir quadrinho";
    titleButton.onclick = () => { overlay.remove(); openReader(item); };
    $(".section-head .section-subtitle", overlay)?.replaceWith(titleButton);
    bindCommentThread(overlay, item, list, refresh);
    await refresh();
    $(".comment-form", overlay)?.addEventListener("submit", async event => {
      event.preventDefault();
      const form = event.currentTarget;
      if (!state.session?.user?.id) return openAuthPage();
      const body = String(new FormData(form).get("body") || "").trim();
      if (!body) return;
      const button = $("button", form); button.disabled = true;
      const result = await sb.from("comments").insert({ user_id: state.session.user.id, item_id: item.id, body });
      if (result.error) toast(commentWriteError(result.error)); else { awardAchievement("first_comment"); form.reset(); await refresh(); }
      button.disabled = false;
    });
  }

  function formatCommentDate(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(date);
  }

  function commentWriteError(error) {
    const message = String(error?.message || "");
    if (/row-level security|permission denied|comments/i.test(message)) return "Você está impedido de comentar no momento.";
    return "Não foi possível publicar o comentário.";
  }

  async function loadCommentThread(item) {
    if (!sb || state.session?.offline || navigator.onLine === false) return { comments: [], likedIds: new Set(), counts: new Map() };
    let result = await sb.from("comments").select("id, parent_id, body, created_at, profiles(username, avatar_url, title, plan, faction_id)").eq("item_id", item.id).order("created_at", { ascending: false });
    if (result.error && /parent_id|schema cache|column/i.test(result.error.message || "")) {
      const legacyResult = await sb.from("comments").select("id, body, created_at, profiles(username, avatar_url, title, plan, faction_id)").eq("item_id", item.id).order("created_at", { ascending: false });
      result = { ...legacyResult, data: (legacyResult.data || []).map(comment => ({ ...comment, parent_id: null })) };
    }
    if (result.error) return { error: result.error };
    const comments = result.data || [];
    const likes = comments.length ? await sb.from("comment_likes").select("comment_id, user_id").in("comment_id", comments.map(comment => comment.id)) : { data: [] };
    const likedIds = new Set((likes.data || []).filter(row => row.user_id === state.session?.user?.id).map(row => row.comment_id));
    const counts = (likes.data || []).reduce((map, row) => map.set(row.comment_id, (map.get(row.comment_id) || 0) + 1), new Map());
    return { comments, likedIds, counts };
  }

  async function loadCommentThread(item) {
    if (!sb || state.session?.offline || navigator.onLine === false) return { comments: [], likedIds: new Set(), counts: new Map() };
    let result = await sb.from("comments").select("id, parent_id, user_id, body, created_at").eq("item_id", item.id).order("created_at", { ascending: false });
    if (result.error && /parent_id|schema cache|column/i.test(result.error.message || "")) {
      const legacyResult = await sb.from("comments").select("id, user_id, body, created_at").eq("item_id", item.id).order("created_at", { ascending: false });
      result = { ...legacyResult, data: (legacyResult.data || []).map(comment => ({ ...comment, parent_id: null })) };
    }
    if (result.error) {
      console.error("[COMMENTS] Falha ao carregar comentários:", result.error);
      return { error: result.error };
    }
    const comments = result.data || [];
    const userIds = [...new Set(comments.map(comment => comment.user_id).filter(Boolean))];
    const profilesResult = userIds.length
      ? await sb.from("profiles").select("id, username, avatar_url, title, plan").in("id", userIds)
      : { data: [] };
    const profiles = new Map((profilesResult.data || []).map(profile => [profile.id, profile]));
    comments.forEach(comment => { comment.profiles = profiles.get(comment.user_id) || {}; });
    const likes = comments.length ? await sb.from("comment_likes").select("comment_id, user_id").in("comment_id", comments.map(comment => comment.id)) : { data: [] };
    const likedIds = new Set((likes.data || []).filter(row => row.user_id === state.session?.user?.id).map(row => row.comment_id));
    const counts = (likes.data || []).reduce((map, row) => map.set(row.comment_id, (map.get(row.comment_id) || 0) + 1), new Map());
    return { comments, likedIds, counts };
  }

  function commentMarkup(comment, childrenByParent, likedIds, likeCounts) {
    const username = cleanUsername(comment.profiles?.username || "usuário");
    const profile = { ...(comment.profiles || {}), username };
    const children = childrenByParent.get(comment.id) || [];
    const replies = children.map(child => commentMarkup(child, childrenByParent, likedIds, likeCounts)).join("");
    const canDelete = state.session?.user?.id === comment.user_id || ["moderator", "admin"].includes(state.profile?.plan);
    return `<article class="comment" data-comment-id="${comment.id}"><div class="comment-author-row">${avatarMarkup(profile, "comment-avatar")}<div class="comment-author-info"><a class="comment-author" href="${publicProfileHref(username)}" target="_blank" rel="noopener">@${escapeHTML(username)}</a>${profile.title ? `<span class="comment-title">${escapeHTML(profile.title)}</span>` : ""}</div></div><p>${escapeHTML(comment.body)}</p><div class="comment-actions"><button class="comment-action ${likedIds.has(comment.id) ? "is-liked" : ""}" data-comment-like="${comment.id}">♥ ${likeCounts.get(comment.id) || 0}</button><button class="comment-action" data-comment-reply="${comment.id}">Responder</button>${children.length ? `<button class="comment-action" data-comment-toggle="${comment.id}">Ver ${children.length} resposta${children.length === 1 ? "" : "s"}</button>` : ""}${canDelete ? `<button class="comment-action comment-delete-action" data-comment-delete="${comment.id}">Excluir</button>` : ""}<time class="comment-date" datetime="${escapeHTML(comment.created_at)}">${escapeHTML(formatCommentDate(comment.created_at))}</time></div><div class="comment-replies" data-comment-replies="${comment.id}" hidden>${replies}</div></article>`;
  }

  async function deleteComment(commentId, root, refresh) {
    if (!state.session?.user?.id || !window.confirm("Excluir este comentário e suas respostas?")) return;
    const result = await sb.from("comments").delete().eq("id", commentId);
    if (result.error) return toast("Não foi possível excluir o comentário.");
    await refresh();
  }

  function renderCommentThread(list, thread) {
    if (thread.error) {
      list.innerHTML = '<span class="section-subtitle">Não foi possível carregar os comentários.</span>';
      return;
    }
    const childrenByParent = new Map();
    thread.comments.forEach(comment => {
      if (!childrenByParent.has(comment.parent_id)) childrenByParent.set(comment.parent_id, []);
      childrenByParent.get(comment.parent_id).push(comment);
    });
    list.innerHTML = (childrenByParent.get(null) || []).map(comment => commentMarkup(comment, childrenByParent, thread.likedIds, thread.counts)).join("") || '<span class="section-subtitle">Nenhum comentário ainda.</span>';
  }

  function linkCommentMentions(root) {
    const mentionPattern = /@([A-Za-z0-9_]{3,24})/g;
    $$('p', root).forEach(paragraph => {
      const text = paragraph.textContent || "";
      let match;
      let cursor = 0;
      let hasMention = false;
      const fragment = document.createDocumentFragment();
      while ((match = mentionPattern.exec(text))) {
        hasMention = true;
        fragment.appendChild(document.createTextNode(text.slice(cursor, match.index)));
        const link = document.createElement("a");
        link.className = "comment-mention";
        link.href = publicProfileHref(match[1]);
        link.target = "_blank";
        link.rel = "noopener";
        link.textContent = match[0];
        fragment.appendChild(link);
        cursor = match.index + match[0].length;
      }
      if (!hasMention) return;
      fragment.appendChild(document.createTextNode(text.slice(cursor)));
      paragraph.replaceChildren(fragment);
    });
  }

  function bindCommentThread(root, item, list, refresh) {
    root.addEventListener("click", async event => {
      const likeButton = event.target.closest("[data-comment-like]");
      if (likeButton) {
        event.preventDefault();
        if (!state.session) return openAuthPage();
        const commentId = Number(likeButton.dataset.commentLike);
        const liked = likeButton.classList.contains("is-liked");
        const result = liked
          ? await sb.from("comment_likes").delete().eq("user_id", state.session.user.id).eq("comment_id", commentId)
          : await sb.from("comment_likes").insert({ user_id: state.session.user.id, comment_id: commentId });
        if (result.error) return toast("Não foi possível atualizar a curtida.");
        await refresh();
        return;
      }
      const deleteButton = event.target.closest("[data-comment-delete]");
      if (deleteButton) {
        event.preventDefault();
        await deleteComment(Number(deleteButton.dataset.commentDelete), root, refresh);
        return;
      }
      const toggle = event.target.closest("[data-comment-toggle]");
      if (toggle) {
        const replies = $(`[data-comment-replies="${toggle.dataset.commentToggle}"]`, root);
        if (replies) { replies.hidden = !replies.hidden; toggle.textContent = replies.hidden ? `Ver respostas` : "Ocultar respostas"; }
        return;
      }
      const reply = event.target.closest("[data-comment-reply]");
      if (reply) {
        const comment = $(`[data-comment-id="${reply.dataset.commentReply}"]`, root);
        if (!comment || $("[data-reply-form]", comment)) return;
        comment.insertAdjacentHTML("beforeend", state.session ? '<form class="comment-form comment-reply-form" data-reply-form><textarea name="body" maxlength="1000" required placeholder="Escreva uma resposta..."></textarea><button class="small-btn" type="submit">Responder</button></form>' : '<p class="section-subtitle">Entre para responder.</p>');
      }
    });
    root.addEventListener("submit", async event => {
      const form = event.target.closest("[data-reply-form]");
      if (!form) return;
      event.preventDefault();
      if (!state.session?.user?.id) return openAuthPage();
      const body = String(new FormData(form).get("body") || "").trim();
      if (!body) return;
      const parentId = Number(form.closest("[data-comment-id]")?.dataset.commentId);
      const button = $("button", form); button.disabled = true;
      const result = await sb.from("comments").insert({ user_id: state.session.user.id, item_id: item.id, parent_id: parentId, body });
      if (result.error) toast(commentWriteError(result.error)); else { awardProfileXp("comment", `comment:${item.id}:${Date.now()}`); form.remove(); await refresh(); }
      button.disabled = false;
    });
  }

  function openProfileSettings() {
    if (!state.session) return openAuthPage();
    const overlay = document.createElement("div"); overlay.className = "modal-backdrop";
    overlay.innerHTML = `<div class="modal"><div class="section-head"><div><h2>Meu perfil</h2><div class="section-subtitle">Personalize seu @, sua foto e a visibilidade da estante</div></div><button class="small-btn" data-close>Fechar</button></div><form id="profile-form"><div class="form-grid"><div class="field full"><label>@usuário</label><input name="username" pattern="[A-Za-z0-9_]{3,24}" required value="${escapeHTML(state.profile?.username || "")}"></div><div class="field full"><label>Foto de perfil</label><input name="avatar" type="file" accept="image/png,image/jpeg,image/webp"></div>${["admin", "moderator", "premium"].includes(state.profile?.plan) ? `<div class="field full"><label>Visibilidade no perfil público</label><label class="checkbox-inline"><input name="shelfSavedPublic" type="checkbox" ${state.profile?.shelf_saved_public !== false ? "checked" : ""}> Mostrar coleção Salvos</label><label class="checkbox-inline"><input name="shelfSeriesPublic" type="checkbox" ${state.profile?.shelf_series_public !== false ? "checked" : ""}> Mostrar coleção Séries salvas</label><label class="checkbox-inline"><input name="shelfReadPublic" type="checkbox" ${state.profile?.shelf_read_public !== false ? "checked" : ""}> Mostrar coleção Lidos</label></div>` : ""}</div><div class="modal-actions"><button type="button" class="small-btn" data-close>Cancelar</button><button class="btn btn-danger">Salvar perfil</button></div></form></div>`;
    $("#modal-root").appendChild(overlay); $$('[data-close]', overlay).forEach(button => button.onclick = () => overlay.remove());
    const profileForm = $("#profile-form", overlay);
    const bannerField = document.createElement("div");
    bannerField.className = "field full profile-banner-field";
    bannerField.innerHTML = `<label>Imagem de fundo da estante</label><input name="profileBannerUrl" type="url" value="${escapeHTML(state.profile?.profile_banner_url || "")}" placeholder="https://.../banner.jpg"><small class="format-hint">Opcional. Sem link, será usada a imagem padrão da estante.</small>`;
    $(".form-grid", profileForm).appendChild(bannerField);
    profileForm.addEventListener("submit", async event => {
      const bannerUrl = String(new FormData(event.currentTarget).get("profileBannerUrl") || "").trim();
      if (bannerUrl && !/^https?:\/\//i.test(bannerUrl)) return toast("Informe um link http(s) válido para o banner.");
      const bannerUpdate = await sb.from("profiles").update({ profile_banner_url: bannerUrl || null }).eq("id", state.session.user.id);
      if (bannerUpdate.error) return toast(bannerUpdate.error.message);
      state.profile = { ...state.profile, profile_banner_url: bannerUrl || null };
    });
    overlay.addEventListener("click", event => { if (event.target === overlay) overlay.remove(); });
    $("[name=shelfLikedPublic]", overlay)?.closest("label")?.remove();
    $("[name=likesPublic]", overlay)?.closest("label")?.remove();
    if (!["admin", "moderator", "premium"].includes(state.profile?.plan)) $(".form-grid", overlay)?.insertAdjacentHTML("beforeend", `<div class="field full"><label class="checkbox-inline"><input name="shelfSeriesPublic" type="checkbox" ${state.profile?.shelf_series_public !== false ? "checked" : ""}> Mostrar coleção Séries salvas no perfil público</label></div>`);
    const shelfVisibilityField = $$(".field.full", overlay).find(field => field.textContent.includes("Visibilidade"));
    if (["admin", "moderator", "premium"].includes(state.profile?.plan) && shelfVisibilityField) {
      shelfVisibilityField.insertAdjacentHTML("beforeend", `<label class="checkbox-inline"><input name="shelfCompletedPublic" type="checkbox" ${state.profile?.shelf_completed_public !== false ? "checked" : ""}> Mostrar coleção Concluídos</label><label class="checkbox-inline"><input name="shelfLikedPublic" type="checkbox" ${state.profile?.shelf_liked_public !== false ? "checked" : ""}> Mostrar coleção Curtidos</label><label class="checkbox-inline"><input name="shelfBlogsPublic" type="checkbox" ${state.profile?.shelf_blogs_public !== false ? "checked" : ""}> Mostrar coleção Blogs</label>`);
    }
    profileForm.addEventListener("submit", async event => {
      if (!["admin", "moderator", "premium"].includes(state.profile?.plan)) return;
      const formData = new FormData(event.currentTarget);
      const visibility = { shelf_completed_public: formData.get("shelfCompletedPublic") === "on", shelf_liked_public: formData.has("shelfLikedPublic") ? formData.get("shelfLikedPublic") === "on" : state.profile?.shelf_liked_public !== false };
      const likedVisibility = await sb.from("profiles").update(visibility).eq("id", state.session.user.id);
      if (likedVisibility.error) toast(likedVisibility.error.message);
      else {
        state.profile = { ...state.profile, ...visibility };
        render();
      }
    });
    const emailField = document.createElement("div");
    const currentEmail = state.session.user.email || "";
    const hasRecoveryEmail = currentEmail && !currentEmail.endsWith("@login.banca-digital.local");
    emailField.className = "field full profile-email-field";
    emailField.innerHTML = `<label>Email de recuperação <span class="field-optional">(opcional)</span></label><input name="email" type="email" placeholder="voce@email.com" autocomplete="email" value="${hasRecoveryEmail ? escapeHTML(currentEmail) : ""}"><small class="format-hint">Adicionar um email permite recuperar a conta e usá-lo para entrar depois.</small>`;
    $(".form-grid", profileForm).appendChild(emailField);
    const privacyField = document.createElement("div");
    privacyField.className = "field full profile-privacy-settings";
    privacyField.innerHTML = `<label>Privacidade e notificações</label><label class="checkbox-inline"><input name="likesPublic" type="checkbox" ${state.profile?.likes_public !== false ? "checked" : ""}> Mostrar minhas curtidas publicamente</label><label class="checkbox-inline"><input name="allowMentions" type="checkbox" ${state.profile?.allow_mentions !== false ? "checked" : ""}> Receber marcações</label><label class="checkbox-inline"><input name="allowMessages" type="checkbox" ${state.profile?.allow_messages !== false ? "checked" : ""}> Receber mensagens privadas</label><label class="checkbox-inline"><input name="notificationsEnabled" type="checkbox" ${state.profile?.notifications_enabled !== false ? "checked" : ""}> Receber notificações</label>`;
    $(".form-grid", profileForm).appendChild(privacyField);
    const profileSectionsPrivacy = document.createElement("div");
    profileSectionsPrivacy.className = "field full profile-privacy-settings";
    profileSectionsPrivacy.innerHTML = `<label>Seções do perfil público</label><label class="checkbox-inline"><input name="wallPublic" type="checkbox" ${state.profile?.profile_wall_public !== false ? "checked" : ""}> Mostrar Mural</label><label class="checkbox-inline"><input name="savedPublicCollectionsPublic" type="checkbox" ${state.profile?.shelf_saved_public_collections !== false ? "checked" : ""}> Mostrar Públicas salvas</label><label class="checkbox-inline"><input name="activityPublic" type="checkbox" ${state.profile?.profile_activity_public !== false ? "checked" : ""}> Mostrar Histórico</label>`;
    $(".form-grid", profileForm).appendChild(profileSectionsPrivacy);
    $("[name=shelfLikedPublic]", overlay)?.closest("label")?.remove();
    $("[name=likesPublic]", overlay)?.closest("label")?.remove();
    const originalProfileSubmit = async () => {};
    const shelfBlogsCheckbox = $("[name=shelfBlogsPublic]", overlay);
    if (shelfBlogsCheckbox) {
      shelfBlogsCheckbox.closest("label")?.remove();
      shelfVisibilityField?.insertAdjacentHTML("beforeend", `<input type="hidden" name="shelfBlogsPublic" value="${state.profile?.shelf_blogs_public !== false ? "on" : "off"}">`);
    }
    profileForm.addEventListener("submit", async event => {
      event.preventDefault();
      const fd = new FormData(profileForm);
      const privacy = { likes_public: fd.has("likesPublic") ? fd.get("likesPublic") === "on" : state.profile?.likes_public !== false, allow_mentions: fd.get("allowMentions") === "on", allow_messages: fd.get("allowMessages") === "on", notifications_enabled: fd.get("notificationsEnabled") === "on" };
      privacy.profile_wall_public = fd.get("wallPublic") === "on";
      privacy.shelf_saved_public_collections = fd.get("savedPublicCollectionsPublic") === "on";
      privacy.profile_activity_public = fd.get("activityPublic") === "on";
      const privacyUpdate = await sb.from("profiles").update(privacy).eq("id", state.session.user.id);
      if (privacyUpdate.error) return toast(privacyUpdate.error.message);
      state.profile = { ...state.profile, ...privacy };
      await originalProfileSubmit(event);
    });
    $("#profile-form", overlay).onsubmit = async event => { event.preventDefault(); const fd = new FormData(event.currentTarget); const username = cleanUsername(fd.get("username")); if (!/^[a-z0-9_]{3,24}$/.test(username)) return toast("@ inválido."); let avatar_url = state.profile?.avatar_url || null; const file = fd.get("avatar"); if (file?.size) { const path = `${state.session.user.id}/${Date.now()}-${file.name.replace(/[^a-z0-9.]/gi, "_")}`; const upload = await sb.storage.from("avatars").upload(path, file, { upsert: true }); if (upload.error) return toast(upload.error.message); avatar_url = sb.storage.from("avatars").getPublicUrl(path).data.publicUrl; } const eligible = ["admin", "moderator", "premium"].includes(state.profile?.plan); const preferences = eligible ? { shelf_saved_public: fd.get("shelfSavedPublic") === "on", shelf_series_public: fd.get("shelfSeriesPublic") === "on", shelf_read_public: fd.get("shelfReadPublic") === "on", shelf_completed_public: fd.get("shelfCompletedPublic") === "on", shelf_blogs_public: fd.get("shelfBlogsPublic") === "on" } : { shelf_series_public: fd.get("shelfSeriesPublic") === "on" }; const update = await sb.from("profiles").update({ username, avatar_url, ...preferences }).eq("id", state.session.user.id); if (update.error) return toast(update.error.message.includes("duplicate") ? "Esse @ já está em uso." : update.error.message); state.profile = { ...state.profile, username, avatar_url, ...preferences }; overlay.remove(); render(); toast("Perfil atualizado."); };
    $("#profile-form", overlay).addEventListener("submit", async event => {
      const email = String(new FormData(event.currentTarget).get("email") || "").trim().toLowerCase();
      if (!email) return;
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return toast("Informe um email válido.");
      if (email === currentEmail.trim().toLowerCase()) return;
      if (email !== currentEmail) {
        const result = await sb.auth.updateUser({ email });
        if (result.error) return toast(result.error.message);
      }
      const profileEmail = await sb.from("profiles").update({ account_email: email }).eq("id", state.session.user.id);
      if (profileEmail.error) return toast(profileEmail.error.message);
      state.session.user.email = email;
      toast(email === currentEmail ? "Email de recuperação salvo." : "Email atualizado. Verifique sua caixa de entrada para confirmar o endereço.");
    });
  }

  function openWallDescriptionEditor() {
    if (!state.session || !sb) return openAuthPage();
    const overlay = document.createElement("div");
    overlay.className = "modal-backdrop";
    overlay.innerHTML = `<div class="modal"><div class="section-head"><div><h2>Editar descrição</h2><div class="section-subtitle">Essa descrição aparece no seu mural.</div></div><button class="small-btn" data-close>Fechar</button></div><form id="wall-description-form"><div class="field"><label>Descrição</label><textarea name="description" maxlength="500" rows="5" placeholder="Escreva uma breve apresentação...">${escapeHTML(state.profile?.wall_description || "")}</textarea></div><div class="modal-actions"><button type="button" class="small-btn" data-close>Cancelar</button><button class="btn btn-danger">Salvar descrição</button></div></form></div>`;
    $("#modal-root").appendChild(overlay);
    $$('[data-close]', overlay).forEach(button => button.onclick = () => overlay.remove());
    $("#wall-description-form", overlay).onsubmit = async event => {
      event.preventDefault();
      const description = String(new FormData(event.currentTarget).get("description") || "").trim().slice(0, 500);
      const result = await sb.from("profiles").update({ wall_description: description }).eq("id", state.session.user.id);
      if (result.error) return toast(result.error.message || "Não foi possível salvar a descrição.");
      state.profile = { ...state.profile, wall_description: description };
      overlay.remove();
      render();
      toast("Descrição atualizada.");
    };
  }

  function openAchievementAdmin() {
    const overlay = document.createElement("div"); overlay.className = "modal-backdrop";
    overlay.innerHTML = `<div class="modal"><div class="section-head"><div><h2>Distribuir título</h2><div class="section-subtitle">Títulos são frases personalizadas; as insígnias são conquistadas automaticamente.</div></div><button class="small-btn" data-close>Fechar</button></div><form id="achievement-form"><div class="form-grid"><div class="field full"><label>@ do usuário</label><input name="username" required placeholder="usuario"></div><div class="field full"><label>Frase do título</label><input name="title" placeholder="Leitor veterano"></div><div class="field full"><label>Cor de fundo</label><select name="titleColor"><option value="#000000">Preto</option><option value="#ffffff">Branco</option><option value="#e50914">Vermelho</option><option value="#2f80ed">Azul</option><option value="#27ae60">Verde</option><option value="#ffd45c" selected>Amarelo</option><option value="#8e44ad">Roxo</option><option value="#f2994a">Laranja</option></select></div></div><div class="modal-actions"><button type="button" class="small-btn" data-close>Cancelar</button><button class="btn btn-danger">Salvar título</button></div></form></div>`;
    $("#modal-root").appendChild(overlay); $$('[data-close]', overlay).forEach(button => button.onclick = () => overlay.remove());
    $("#achievement-form", overlay).onsubmit = async event => { event.preventDefault(); const fd = new FormData(event.currentTarget); const username = cleanUsername(fd.get("username")); const title = String(fd.get("title") || "").trim(); const title_color = safeTitleColor(fd.get("titleColor")); const profile = await sb.from("profiles").select("id").eq("username", username).single(); if (profile.error) return toast("Usuário não encontrado."); let update = await sb.from("profiles").update({ title: title || null, title_color }).eq("id", profile.data.id); if (update.error && /title_color|schema cache/i.test(update.error.message)) update = await sb.from("profiles").update({ title: title || null }).eq("id", profile.data.id); if (update.error) return toast(update.error.message); if (state.profile?.id === profile.data.id) state.profile = { ...state.profile, title, title_color }; overlay.remove(); render(); toast("Título atualizado."); };
  }

  function openReader(item, options = {}) {
    if (!item) return;

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
    const isTelegramLink = (url) => /^https?:\/\/(www\.)?t(elegram)?\.me\//.test(url || "");

    // A URL direta (fileUrl) tem prioridade. Se não houver, usamos a 'telegramUrl'
    // somente se ela NÃO for um link real do Telegram (ou seja, é um caminho de arquivo).
    const resolvedUrl = item.fileUrl || (!isTelegramLink(item.telegramUrl) ? item.telegramUrl : "") || "";

    if (!resolvedUrl) {
      toast(item.telegramUrl ? "Links do Telegram não são suportados sem um servidor de ponte." : "Esta edição não tem uma URL de arquivo direto.");
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
        ${!state.session?.offline && item.character ? `<button class="small-btn" data-browse-character>Ver personagem</button>` : ''}
        ${!state.session?.offline && item.publisher ? `<button class="small-btn" data-browse-publisher>Ver editora</button>` : ''}
        ${!item.local ? `<button class="small-btn reader-like-button ${state.comicLikeIds.has(item.id) ? "is-liked" : ""}" data-like-item="${escapeHTML(item.id)}">${state.comicLikeIds.has(item.id) ? "♥" : "♡"} ${state.comicLikeCounts.get(item.id) || 0}</button><button class="small-btn" data-share-item="${escapeHTML(item.id)}">Compartilhar</button>` : ""}
        ${!item.local ? `<button class="small-btn" data-comment-item="${escapeHTML(item.id)}">Comentários</button>` : ""}
        ${!state.session?.offline ? `<button class="small-btn" data-open-external>Abrir arquivo</button>` : ''}
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
    const cleanupReader = () => {
      if (activeReaderCleanup === cleanupReader) activeReaderCleanup = null;
      readerIsOpen = false;
      overlay._cbzDownloadController?.abort();
      overlay.remove();
      resumeCoverLoading();
      if (options.localObjectUrl) URL.revokeObjectURL(options.localObjectUrl);
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
      setSection(state.session?.offline ? "downloads" : "home");
    };
    $("[data-like-item]", overlay)?.addEventListener("click", event => { event.stopPropagation(); toggleComicLike(item.id); });
    $("[data-share-item]", overlay)?.addEventListener("click", event => { event.stopPropagation(); shareComic(item.id); });
    $("[data-comment-item]", overlay)?.addEventListener("click", event => { event.stopPropagation(); openCommentsPopup(item); });
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
    $("[data-browse-character]", overlay)?.addEventListener("click", () => { overlay.remove(); openEntityPage("character", item.character); });
    $("[data-browse-publisher]", overlay)?.addEventListener("click", () => { overlay.remove(); openEntityPage("publisher", item.publisher); });

    const body = $("#reader-body", overlay);
    const controls = $("#reader-controls", overlay);
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
    let suppressReaderClick = false;
    const toggleReaderChrome = () => overlay.classList.toggle("reader-immersive");
    $("[data-reader-zoom]", overlay).onclick = () => {
      overlay.classList.toggle("reader-zoom-fit");
      overlay.classList.add("reader-immersive");
    };
    body.addEventListener("click", event => {
      if (suppressReaderClick || event.target.closest("button, a, select, textarea")) {
        suppressReaderClick = false;
        return;
      }
      toggleReaderChrome();
    });
    let pointerStart = null;
    body.addEventListener("pointerdown", event => {
      pointerStart = { x: event.clientX, y: event.clientY };
    });
    body.addEventListener("pointerup", event => {
      if (!pointerStart) return;
      const dx = event.clientX - pointerStart.x;
      const dy = event.clientY - pointerStart.y;
      pointerStart = null;
      if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) {
        suppressReaderClick = true;
        overlay._readerNavigate?.(dx < 0 ? 1 : -1);
      }
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


    if (format === "pdf" || resolvedUrl.toLowerCase().split("?")[0].endsWith(".pdf")) {
      void renderPDFReader(item, resolvedUrl, body, controls, overlay, skipCover, resumePage, (...args) => { markReaderReady(); saveReadingProgress(...args); }, prefetchedBuffer).then(markReaderReady).catch(() => {});
    } else if (format === "cbz" || resolvedUrl.toLowerCase().split("?")[0].endsWith(".cbz")) {
      void renderCBZReader(item, resolvedUrl, body, controls, overlay, skipCover, resumePage, (...args) => { markReaderReady(); saveReadingProgress(...args); }, prefetchedBuffer).then(markReaderReady).catch(() => {});
    } else if (format === "cbr" || resolvedUrl.toLowerCase().split("?")[0].endsWith(".cbr")) {
      void renderCBRReader(item, resolvedUrl, body, controls, overlay, skipCover, resumePage, (...args) => { markReaderReady(); saveReadingProgress(...args); }, prefetchedBuffer).then(markReaderReady).catch(() => {});
    } else if (["jpg","jpeg","png","webp","gif"].includes(format)) {
      body.innerHTML = `<img class="reader-image" src="${escapeHTML(resolvedUrl)}" alt="" fetchpriority="high">`;
      const readerImage = $(".reader-image", body);
      if (readerImage) {
        readerImage.loading = "eager";
        readerImage.fetchPriority = "high";
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
      const message = `O formato "${escapeHTML(format.toUpperCase())}" não pode ser lido diretamente no navegador. Use o botão "Abrir arquivo" para abri-lo em uma nova aba.`;
      body.innerHTML = `
        <div class="empty" style="margin:auto;max-width:650px">
          <h3>${escapeHTML(title)}</h3>
          <p>${escapeHTML(message)}</p>
        </div>`;
      controls.innerHTML = `<span class="reader-page">${escapeHTML(format.toUpperCase())}</span>`;
    }
  }

  function extension(url) {
    const raw = String(url || "");
    const clean = /^(https?:|blob:|data:)/i.test(raw) ? raw.split("?")[0].split("#")[0] : raw;
    const filename = clean.split(/[\\/]/).pop();
    return /^.+\.[a-z0-9]{1,8}$/i.test(filename) ? filename.split(".").pop().toLowerCase() : "";
  }

  async function renderPDFReader(item, url, body, controls, overlay, skipCover = false, resumePage = 1, onPageChange = () => {}, prefetchedBuffer = null) {
    body.innerHTML = `<div class="reader-loading"><div class="reader-loading-label">Carregando PDF…</div><progress class="reader-progress"></progress></div>`;
    try {
      const pdfjs = await (window.pdfjsReady || Promise.resolve(window.pdfjsLib));
      // PDF.js 4.x via module pode não expor global em alguns navegadores.
      if (!pdfjs?.getDocument) {
        throw Object.assign(new Error("PDF.js nÃ£o estÃ¡ disponÃ­vel nesta pÃ¡gina."), { name: "PDFJS_MISSING" });
      }

      // Fetch the PDF data manually to have better control over errors.
      // This helps distinguish between "file not found" and "invalid file".
      body.innerHTML = `<div class="reader-loading"><div class="reader-loading-label">Abrindo arquivo PDF…</div><progress class="reader-progress"></progress></div>`;
      let pdfData;
      let pdfUrl = null;
      if (prefetchedBuffer) {
        pdfData = await prefetchedBuffer;
      } else if (item.local && item.file) {
        pdfData = await item.file.arrayBuffer();
      } else if (!prefetchedBuffer && !item.local) {
        // PDF.js busca somente os intervalos necessários do PDF.
        pdfUrl = proxiedFileUrl(url);
      } else {
        const response = await fetch(proxiedFileUrl(url), {
          method: "GET",
          mode: "cors",
          credentials: "omit",
          cache: "default",
          priority: "high"
        });
        if (!response.ok) {
          const error = new Error(`Arquivo não encontrado (HTTP ${response.status})`);
          error.name = 'MissingPDFException';
          throw error;
        }
        pdfData = await response.arrayBuffer();
      }
      if (pdfData && !pdfData.byteLength) throw new Error("PDF vazio.");

      // Pass the data as a typed array.
      body.innerHTML = `<div class="empty" style="margin:auto">Abrindo PDFâ€¦</div>`;
      const pdf = await pdfjs.getDocument(pdfUrl ? { url: pdfUrl } : { data: new Uint8Array(pdfData) }).promise;

      const currentReadingMode = state.readingMode;

      if (currentReadingMode === 'single-page') {
        const firstPage = skipCover && pdf.numPages > 1 ? 2 : 1;
        let page = Math.max(firstPage, Math.min(resumePage, pdf.numPages));
        const canvas = document.createElement("canvas");
        canvas.className = "reader-canvas";
        body.replaceChildren(canvas);

        async function drawSinglePage() {
          const p = await pdf.getPage(page);
          const baseViewport = p.getViewport({ scale: 1 });
          const availableWidth = Math.max(240, body.clientWidth - 40);
          const availableHeight = Math.max(240, body.clientHeight - 40);
          const scale = Math.max(0.5, Math.min(2.2, availableWidth / baseViewport.width, availableHeight / baseViewport.height));
          const viewport = p.getViewport({ scale });
          const dpr = window.devicePixelRatio || 1;
          canvas.width = Math.floor(viewport.width * dpr);
          canvas.height = Math.floor(viewport.height * dpr);
          canvas.style.width = `${viewport.width}px`;
          canvas.style.height = `${viewport.height}px`;
          const ctx = canvas.getContext("2d", { alpha: false });
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

          ctx.fillStyle = "white";
          ctx.fillRect(0, 0, canvas.width, canvas.height);

          await p.render({ canvasContext: ctx, viewport }).promise;
          controls.innerHTML = `
            <button data-prev ${page <= firstPage ? "disabled" : ""}>‹</button>
            <span class="reader-page">${page} / ${pdf.numPages}</span>
            <button data-next ${page >= pdf.numPages ? "disabled" : ""}>›</button>
          `;
          $("[data-prev]", controls)?.addEventListener("click", async () => { if(page > 1){page--; await drawSinglePage();} });
          $("[data-next]", controls)?.addEventListener("click", async () => { if(page < pdf.numPages){page++; await drawSinglePage();} });
          onPageChange(item, page, pdf.numPages);
        }
        await drawSinglePage();
      } else if (currentReadingMode === 'double-page') {
        let spread = Math.max(0, Math.floor((resumePage - 1) / 2));
        const spreadContainer = document.createElement("div");
        spreadContainer.className = "reader-double-page";
        body.replaceChildren(spreadContainer);

        async function drawSpread() {
          const pagesToRender = getReaderSpreadPages(pdf.numPages, spread, skipCover);
          const page2Number = pagesToRender[pagesToRender.length - 1];

          spreadContainer.innerHTML = "";
          const pages = [];

          for (const pageNumber of pagesToRender) {
            const page = await pdf.getPage(pageNumber);
            const baseViewport = page.getViewport({ scale: 1 });
            const availableWidth = Math.max(240, (body.clientWidth - 70) / pagesToRender.length);
            const availableHeight = Math.max(240, body.clientHeight - 40);
            const scale = Math.max(0.5, Math.min(1.5, availableWidth / baseViewport.width, availableHeight / baseViewport.height));
            const viewport = page.getViewport({ scale });
            const canvas = document.createElement("canvas");
            canvas.className = "reader-canvas";
            const dpr = window.devicePixelRatio || 1;
            canvas.width = Math.floor(viewport.width * dpr);
            canvas.height = Math.floor(viewport.height * dpr);
            canvas.style.width = `${viewport.width}px`;
            canvas.style.height = `${viewport.height}px`;
            const ctx = canvas.getContext("2d", { alpha: false });
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

            ctx.fillStyle = "white";
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            await page.render({ canvasContext: ctx, viewport }).promise;

            const wrapper = document.createElement("div");
            wrapper.className = "double-page";
            wrapper.appendChild(canvas);
            spreadContainer.appendChild(wrapper);
            pages.push(pageNumber);
          }

          const displayedPages = [...pages].sort((a, b) => a - b);

          controls.innerHTML = `
            <button data-prev ${spread === 0 ? "disabled" : ""}>‹</button>
            <span class="reader-page">
              ${displayedPages[0]}${displayedPages[1] ? `–${displayedPages[1]}` : ""} / ${pdf.numPages}
            </span>
            <button data-next ${page2Number >= pdf.numPages ? "disabled" : ""}>›</button>
          `;

          $("[data-prev]", controls)?.addEventListener("click", async () => {
            if (spread > 0) {
              spread--;
              await drawSpread();
            }
          });

          $("[data-next]", controls)?.addEventListener("click", async () => {
            if (page2Number < pdf.numPages) {
              spread++;
              await drawSpread();
            }
          });
          onPageChange(item, pagesToRender[0], pdf.numPages);
        }

        await drawSpread();
      } else if (currentReadingMode === 'continuous-scroll') {
        const pageContainer = document.createElement("div");
        pageContainer.className = "pdf-continuous-scroll-container";
        body.replaceChildren(pageContainer);

        const pageElements = [];
        const renderedPages = new Set();
        const observer = new IntersectionObserver(async (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              const pageNum = parseInt(entry.target.dataset.pageNum);
              if (!renderedPages.has(pageNum)) {
                renderedPages.add(pageNum);
                const canvas = entry.target.querySelector('canvas');
                const p = await pdf.getPage(pageNum);
                // Smaller scale for continuous scroll to fit more pages
                const baseViewport = p.getViewport({ scale: 1 });
                const scale = Math.max(0.5, Math.min(1.5, (pageContainer.clientWidth - 40) / baseViewport.width));
                const viewport = p.getViewport({ scale });
                const dpr = window.devicePixelRatio || 1;
                canvas.width = Math.floor(viewport.width * dpr);
                canvas.height = Math.floor(viewport.height * dpr);
                canvas.style.width = `${viewport.width}px`;
                canvas.style.height = `${viewport.height}px`;
                const ctx = canvas.getContext("2d", { alpha: false });
                ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
                ctx.fillStyle = "white";
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                await p.render({ canvasContext: ctx, viewport }).promise;
              }
            }
          }
        }, { root: pageContainer, rootMargin: '200px' }); // Render pages when they are 200px near the viewport

        for (const i of getReaderPages(pdf.numPages, skipCover)) {
          const pageWrapper = document.createElement("div");
          pageWrapper.className = "pdf-page-wrapper";
          pageWrapper.dataset.pageNum = i;
          const canvas = document.createElement("canvas");
          canvas.className = "reader-canvas";
          pageWrapper.appendChild(canvas);
          pageContainer.appendChild(pageWrapper);
          pageElements.push(pageWrapper);
          observer.observe(pageWrapper);
        }

        let currentPageIndex = 0; // 0-indexed
        const updateControls = () => {
          const visiblePage = pageElements.find(el => {
            const rect = el.getBoundingClientRect();
            return rect.top >= 0 && rect.top < window.innerHeight / 2; // Check if top half of page is visible
          }) || pageElements[0]; // Default to first page if none are clearly visible

          currentPageIndex = pageElements.indexOf(visiblePage);
          onPageChange(item, Number(visiblePage.dataset.pageNum), pdf.numPages);

          controls.innerHTML = `
            <button data-prev ${currentPageIndex <= 0 ? "disabled" : ""}>↑</button>
            <span class="reader-page">${pageElements[currentPageIndex].dataset.pageNum} / ${pdf.numPages}</span>
            <button data-next ${currentPageIndex >= pageElements.length - 1 ? "disabled" : ""}>↓</button>
          `;
          $("[data-prev]", controls)?.addEventListener("click", () => {
            if (currentPageIndex > 0) {
              currentPageIndex--;
              pageElements[currentPageIndex].scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
          });
          $("[data-next]", controls)?.addEventListener("click", () => {
            if (currentPageIndex < pageElements.length - 1) {
              currentPageIndex++;
              pageElements[currentPageIndex].scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
          });
        };

        pageContainer.addEventListener('scroll', updateControls);
        updateControls(); // Call once to set initial state
        pageElements.find(el => Number(el.dataset.pageNum) === resumePage)?.scrollIntoView({ block: 'start' });

        // Clean up observer and event listener when overlay is removed
        if (overlay) {
          $("[data-close-reader]", overlay).addEventListener('click', () => {
            observer.disconnect();
            pageContainer.removeEventListener('scroll', updateControls);
          }, { once: true });
        }
      }

      const modeSelect = $("#reading-mode-select", overlay);
      if (modeSelect) {
        modeSelect.disabled = false;
        modeSelect.addEventListener('change', (e) => {
          setReadingMode(e.target.value);
          overlay._reopenReader?.({ skipCover });
        });
      }
    } catch (err) {
      console.error(err);
      let title = "Não foi possível renderizar este PDF.";
      let message = "Ocorreu um erro inesperado. Verifique o console do navegador para mais detalhes.";

      if (err.name === 'PDFJS_MISSING') {
        title = "PDF.js nÃ£o carregado.";
        message = "A biblioteca necessÃ¡ria para renderizar o PDF nÃ£o estÃ¡ disponÃ­vel nesta pÃ¡gina.";
      } else if (err.name === 'MissingPDFException') {
        title = "Arquivo PDF não encontrado.";
        message = `O navegador não conseguiu carregar o arquivo a partir do link fornecido. Verifique se o caminho no cadastro está correto.`;
      } else if (err.name === 'InvalidPDFException') {
        title = "Arquivo PDF inválido.";
        message = "O arquivo parece estar corrompido ou em um formato que não pode ser lido pelo leitor. Tente abrir o arquivo diretamente.";
      } else if (String(err.message).toLowerCase().includes("cors") || String(err.message).toLowerCase().includes("failed to fetch")) {
        title = "Erro de CORS";
        message = "O servidor que hospeda o PDF não permite que este site o acesse diretamente. Use o botão abaixo para abrir em uma nova aba.";
      }

      body.innerHTML = `
        <div class="empty" style="margin:auto;max-width:650px">
          <h3>${escapeHTML(title)}</h3>
          <p>${escapeHTML(message)}</p>
          <button class="btn btn-primary" data-open-anyway>Abrir PDF</button>
        </div>`;
      controls.innerHTML = `<span class="reader-page">PDF</span>`;
      $("[data-open-anyway]", body).onclick = () => {
        window.open(url, "_blank", "noopener");
      };
    }
  }

  async function showCBZProgressivePreview(item, url, body, controls, skipCover, resumePage) {
    // A resposta sem fim do mega-proxy pode ser interrompida pelo HTTP/3
    // depois de retornar 200. O leitor por Range do zip.js não consegue
    // recuperar esse erro; o download por faixas abaixo consegue.
    const isMega = /^https:\/\/(?:www\.)?mega\.nz\/file\//i.test(String(url || ""));
    if (item.local || isMega || !/^https?:\/\//i.test(url) || !window.zipJsReady) return false;
    try {
      const zipjs = await window.zipJsReady;
      if (!zipjs?.ZipReader || !zipjs?.HttpReader || !zipjs?.BlobWriter) return false;
      const reader = new zipjs.ZipReader(new zipjs.HttpReader(proxiedFileUrl(url)));
      const entries = (await reader.getEntries())
        .filter(entry => !entry.directory && /\.(jpg|jpeg|png|webp|gif)$/i.test(entry.filename))
        .sort((a, b) => a.filename.localeCompare(b.filename, undefined, { numeric: true }));
      if (!entries.length) { await reader.close(); return false; }
      const entryIndex = Math.max(0, Math.min((resumePage || (skipCover ? 2 : 1)) - 1, entries.length - 1));
      const blob = await entries[entryIndex].getData(new zipjs.BlobWriter());
      const imageUrl = URL.createObjectURL(blob);
      body.innerHTML = `<img class="reader-image" src="${imageUrl}" alt="Página ${entryIndex + 1}">`;
      controls.innerHTML = `<span class="reader-page">${entryIndex + 1} / ${entries.length} · carregando arquivo</span>`;
      body.querySelector("img")?.addEventListener("load", () => URL.revokeObjectURL(imageUrl), { once: true });
      await reader.close();
      return true;
    } catch (error) {
      console.warn("Prévia progressiva do CBZ indisponível:", error);
      return false;
    }
  }

  async function renderCBZRangeSinglePage(item, url, body, controls, overlay, skipCover, resumePage, onPageChange) {
    const isMega = /^https:\/\/(?:www\.)?mega\.nz\/file\//i.test(String(url || ""));
    if (item.local || isMega || state.readingMode !== "single-page" || !window.zipJsReady || !/^https?:\/\//i.test(url)) return false;
    let reader;
    try {
      const zipjs = await window.zipJsReady;
      if (!zipjs?.ZipReader || !zipjs?.HttpReader || !zipjs?.BlobWriter) return false;
      reader = new zipjs.ZipReader(new zipjs.HttpReader(proxiedFileUrl(url)));
      const entries = (await reader.getEntries()).filter(entry => !entry.directory && /\.(jpg|jpeg|png|webp|gif)$/i.test(entry.filename)).sort((a, b) => a.filename.localeCompare(b.filename, undefined, { numeric: true }));
      if (!entries.length) throw new Error("CBZ sem imagens.");
      const pages = getReaderPages(entries.length, skipCover).map(page => page - 1);
      const requestedPage = Math.max(1, resumePage || 1);
      let page = pages.includes(requestedPage - 1) ? requestedPage - 1 : pages[0];
      const img = document.createElement("img");
      img.className = "reader-image";
      body.replaceChildren(img);
      const urls = new Set();
      const draw = async () => {
        const blob = await entries[page].getData(new zipjs.BlobWriter());
        const objectUrl = URL.createObjectURL(blob);
        urls.add(objectUrl);
        if (img.dataset.url) { URL.revokeObjectURL(img.dataset.url); urls.delete(img.dataset.url); }
        img.dataset.url = objectUrl;
        img.src = objectUrl;
        controls.innerHTML = `<button data-prev ${page <= pages[0] ? "disabled" : ""}>‹</button><span class="reader-page">${page + 1} / ${entries.length}</span><button data-next ${page >= pages[pages.length - 1] ? "disabled" : ""}>›</button>`;
        $("[data-prev]", controls)?.addEventListener("click", async () => { const position = pages.indexOf(page); if (position > 0) { page = pages[position - 1]; await draw(); } });
        $("[data-next]", controls)?.addEventListener("click", async () => { const position = pages.indexOf(page); if (position < pages.length - 1) { page = pages[position + 1]; await draw(); } });
        onPageChange(item, page + 1, entries.length);
      };
      await draw();
      $("[data-close-reader]", overlay).addEventListener("click", async () => { for (const objectUrl of urls) URL.revokeObjectURL(objectUrl); await reader.close(); }, { once: true });
      return true;
    } catch (error) {
      try { await reader?.close(); } catch {}
      console.warn("CBZ por Range indisponível; usando fallback:", error);
      return false;
    }
  }

  async function renderCBZReader(item, url, body, controls, overlay, skipCover = false, resumePage = 1, onPageChange = () => {}, prefetchedBuffer = null) {
    const downloadController = new AbortController();
    overlay._cbzDownloadController = downloadController;
    let progressRoot;
    let progressLabel;
    let progressBar;
    let progressDetail;
    let progressSpinner;
    let progressivePreview = false;
    const showCbzProgress = (message, value = null, detail = "") => {
      if (/de 0(?:\.0+)? MB/.test(detail)) {
        value = null;
        detail = "";
      }
      if (progressivePreview && progressRoot && !progressRoot.isConnected) return;
      if (!progressRoot || !progressRoot.isConnected) {
        progressRoot = document.createElement("div");
        progressRoot.className = "reader-loading";
        progressRoot.setAttribute("role", "status");
        progressLabel = document.createElement("div");
        progressLabel.className = "reader-loading-label";
        progressBar = document.createElement("progress");
        progressBar.className = "reader-progress";
        progressBar.max = 100;
        progressDetail = document.createElement("div");
        progressDetail.className = "reader-loading-detail";
        progressSpinner = document.createElement("div");
        progressSpinner.className = "reader-spinner";
        progressRoot.append(progressLabel, progressBar, progressDetail, progressSpinner);
        body.replaceChildren(progressRoot);
      }
      progressLabel.textContent = message;
      if (value === null) {
        progressBar.hidden = false;
        progressBar.removeAttribute("value");
        progressDetail.hidden = !detail;
        progressDetail.textContent = detail;
      } else {
        progressBar.value = value;
        progressDetail.hidden = false;
        progressDetail.textContent = detail;
      }
      progressSpinner.hidden = true;
    };
    showCbzProgress("Abrindo arquivo CBZ…");
    try {
      progressivePreview = await showCBZProgressivePreview(item, url, body, controls, skipCover, resumePage);
      if (await renderCBZRangeSinglePage(item, url, body, controls, overlay, skipCover, resumePage, onPageChange)) return;
      const JSZipLib = await (window.jszipReady || Promise.resolve(window.JSZip));
      if (!JSZipLib) throw new Error("JSZip não carregou.");
      let buffer = await waitForPrefetchedBuffer(prefetchedBuffer);
      if (buffer) showCbzProgress("Arquivo CBZ carregado. Preparando p\u00e1ginas...", 100, "Abertura conclu\u00edda");
      if (!buffer) {
        // fetchFileArrayBuffer usa faixas independentes para Mega/servidores
        // que derrubam streams longos, evitando ERR_QUIC_PROTOCOL_ERROR.
        buffer = await fetchFileArrayBuffer(url, (received, total) => {
          const value = total ? Math.min(99, Math.round(received / total * 100)) : null;
          const detail = total
            ? `${(received / 1048576).toFixed(1)} MB de ${(total / 1048576).toFixed(1)} MB`
            : `${(received / 1048576).toFixed(1)} MB processados`;
          showCbzProgress("Abrindo arquivo CBZ…", value, detail);
        }, undefined, downloadController.signal);
      }
      const zip = await JSZipLib.loadAsync(buffer);
      const names = Object.keys(zip.files)
        .filter(n => !zip.files[n].dir && /\.(jpg|jpeg|png|webp|gif)$/i.test(n))
        .sort((a,b) => a.localeCompare(b, undefined, {numeric:true}));
      if (!names.length) throw new Error("CBZ sem imagens.");
      showCbzProgress("Preparando páginas…", 0, `0 de ${names.length} páginas`);

      const currentReadingMode = state.readingMode;

      if (currentReadingMode === 'single-page') {
        const firstIndex = skipCover && names.length > 1 ? 1 : 0;
        let page = Math.max(firstIndex, Math.min(resumePage - 1, names.length - 1));
        const pageCache = createArchivePageCache(names, name => zip.files[name].async("blob"));
        const img = document.createElement("img");
        img.className = "reader-image";
        body.replaceChildren(img);

        async function draw() {
          const currentThird = Math.floor(page / pageCache.thirdSize);
          const blob = await pageCache.get(page);
          // Exibe a página atual primeiro; o restante do terço é pré-carregado
          // em segundo plano para a navegação seguinte.
          void pageCache.prefetchThird(currentThird).catch(() => {});
          void pageCache.prefetchThird(currentThird + 1).catch(() => {});
          if (img.dataset.url) URL.revokeObjectURL(img.dataset.url);
          const objectUrl = URL.createObjectURL(blob);
          img.dataset.url = objectUrl;
          img.src = objectUrl;
          controls.innerHTML = `
            <button data-prev ${page <= firstIndex ? "disabled" : ""}>‹</button>
            <span class="reader-page">${page + 1} / ${names.length}</span>
            <button data-next ${page === names.length - 1 ? "disabled" : ""}>›</button>
          `;
          $("[data-prev]", controls)?.addEventListener("click", async () => { if(page>0){page--;await draw();} });
          $("[data-next]", controls)?.addEventListener("click", async () => { if(page<names.length-1){page++;await draw();} });
          onPageChange(item, page + 1, names.length);
        }
        await draw();
        $("[data-close-reader]", overlay).addEventListener('click', () => {
          if (img.dataset.url) URL.revokeObjectURL(img.dataset.url);
        }, { once: true });
      } else if (currentReadingMode === 'double-page') {

        let spread = Math.max(0, Math.floor((resumePage - 1) / 2));
        const spreadContainer = document.createElement("div");
        spreadContainer.className = "reader-double-page";
        body.replaceChildren(spreadContainer);
        const spreadUrls = [];

        async function drawSpread() {
          // Libera URLs anteriores
          for (const u of spreadUrls) {
            URL.revokeObjectURL(u);
          }
          spreadUrls.length = 0;
          spreadContainer.innerHTML = "";

          const indexesToRender = getReaderSpreadIndexes(names.length, spread, skipCover);
          const second = indexesToRender[indexesToRender.length - 1];

          for (const index of indexesToRender) {
            const blob = await zip.files[names[index]].async("blob");
            const objectUrl = URL.createObjectURL(blob);
            spreadUrls.push(objectUrl);

            const wrapper = document.createElement("div");
            wrapper.className = "double-page";

            const img = document.createElement("img");
            img.className = "reader-image";
            img.src = objectUrl;
            img.alt = `Página ${index + 1}`;

            wrapper.appendChild(img);
            spreadContainer.appendChild(wrapper);
          }

          const displayedPages = indexesToRender.map(p => p + 1).sort((a, b) => a - b);

          controls.innerHTML = `
            <button data-prev ${spread === 0 ? "disabled" : ""}>‹</button>
            <span class="reader-page">
              ${displayedPages[0]}${displayedPages[1] ? `–${displayedPages[1]}` : ""} / ${names.length}
            </span>
            <button data-next ${second >= names.length - 1 ? "disabled" : ""}>›</button>
          `;

          $("[data-prev]", controls)?.addEventListener("click", async () => {
            if (spread > 0) { spread--; await drawSpread(); }
          });

          $("[data-next]", controls)?.addEventListener("click", async () => {
            if (second < names.length - 1) { spread++; await drawSpread(); }
          });
          onPageChange(item, indexesToRender[0] + 1, names.length);
        }

        await drawSpread();

        $("[data-close-reader]", overlay).addEventListener("click", () => {
          for (const u of spreadUrls) {
            URL.revokeObjectURL(u);
          }
        }, { once: true });
      } else if (currentReadingMode === 'continuous-scroll') {
        const pageContainer = document.createElement("div");
        pageContainer.className = "image-continuous-scroll-container"; // Note: class name was correct
        body.replaceChildren(pageContainer);
 
        const objectUrls = [];
        const pageElements = [];
 
        // Extrai páginas somente quando se aproximam da viewport.
        const pageStates = new Map();
        // Pages are extracted on demand below.
        // Legacy eager-extraction block removed.
        /*
          const blob = await zip.files[name].async("blob");
          const url = URL.createObjectURL(blob);
          objectUrls.push(url);
          extractedPages += 1;
          showCbzProgress("Extraindo páginas do CBZ…", Math.round(extractedPages / names.length * 100), `${extractedPages} de ${names.length} páginas`);
          return { src: url };
        */
 
        body.replaceChildren(pageContainer); // Clear status message
 
        const loadPage = async pageWrapper => {
          const index = Number(pageWrapper.dataset.pageNum) - 1;
          const state = pageStates.get(index);
          if (!state || state.url || state.loading) return state?.loading;
          state.loading = (async () => {
            const blob = await zip.files[names[index]].async("blob");
            state.url = URL.createObjectURL(blob);
            state.img.src = state.url;
            objectUrls.push(state.url);
          })().catch(error => console.error("[CBZ] Falha ao extrair página", index + 1, error)).finally(() => { state.loading = null; });
          return state.loading;
        };
        const releasePage = pageWrapper => {
          const state = pageStates.get(Number(pageWrapper.dataset.pageNum) - 1);
          if (!state?.url) return;
          URL.revokeObjectURL(state.url);
          objectUrls.splice(objectUrls.indexOf(state.url), 1);
          state.url = null;
          state.img.removeAttribute("src");
        };

        getReaderPages(names.length, skipCover).forEach(pageNum => {
          const index = pageNum - 1;
          const pageWrapper = document.createElement("div");
          pageWrapper.className = "image-page-wrapper";
          pageWrapper.dataset.pageNum = pageNum;
          const img = document.createElement("img");
          img.className = "reader-image";
          img.alt = `Página ${pageNum}`;
          pageWrapper.appendChild(img);
          pageContainer.appendChild(pageWrapper);
          pageElements.push(pageWrapper);
          pageStates.set(index, { img, url: null, loading: null });
        });

        const observer = new IntersectionObserver(entries => {
          entries.forEach(entry => entry.isIntersecting ? loadPage(entry.target) : releasePage(entry.target));
        }, { root: pageContainer, rootMargin: "150% 0px" });
        pageElements.forEach(page => observer.observe(page));
 
        let currentPageIndex = 0;
        const updateControls = () => {
          const visiblePage = pageElements.find(el => {
            const rect = el.getBoundingClientRect();
            return rect.top >= 0 && rect.top < window.innerHeight / 2;
          }) || pageElements.find(el => {
            const rect = el.getBoundingClientRect();
            // Check if any part of the element is visible in the viewport
            return rect.bottom > 0 && rect.top < window.innerHeight;
          }) || pageElements[0];
 
          if (!visiblePage) {
            // If no page is visible (e.g., during initial load or very fast scroll), default to the first page
            currentPageIndex = 0;
            return;
          }
 
          currentPageIndex = pageElements.indexOf(visiblePage);
          controls.innerHTML = `
            <button data-prev ${currentPageIndex <= 0 ? "disabled" : ""}>↑</button>
            <span class="reader-page">${visiblePage.dataset.pageNum} / ${names.length}</span>
            <button data-next ${currentPageIndex >= pageElements.length - 1 ? "disabled" : ""}>↓</button>
          `;
          $("[data-prev]", controls)?.addEventListener("click", () => pageElements[Math.max(0, currentPageIndex - 1)].scrollIntoView({ behavior: 'smooth', block: 'start' }));
          $("[data-next]", controls)?.addEventListener("click", () => pageElements[Math.min(pageElements.length - 1, currentPageIndex + 1)].scrollIntoView({ behavior: 'smooth', block: 'start' }));
          onPageChange(item, Number(visiblePage.dataset.pageNum), names.length);
        };

        pageContainer.addEventListener('scroll', updateControls, { passive: true });
        loadPage(pageElements[0]);
        updateControls();
        pageElements.find(el => Number(el.dataset.pageNum) === resumePage)?.scrollIntoView({ block: 'start' });

        $("[data-close-reader]", overlay).addEventListener('click', () => {
          observer.disconnect();
          pageContainer.removeEventListener('scroll', updateControls);
          for (const url of objectUrls) URL.revokeObjectURL(url);
        }, { once: true });
      }

      const modeSelect = $("#reading-mode-select", overlay);
      if (modeSelect) {
        modeSelect.disabled = false;
        modeSelect.addEventListener('change', (e) => {
          setReadingMode(e.target.value);
          overlay._reopenReader?.({ skipCover });
        });
      }
    } catch (err) {
      if (err?.name === "AbortError" || !overlay.isConnected) return;
      // Local status helper for this function
      const status = (message) => body.innerHTML = `<div class="empty" style="margin:auto">${escapeHTML(message)}</div>`;


      console.error(err);
      body.innerHTML = `
        <div class="empty" style="margin:auto;max-width:650px">
          <h3>Não foi possível abrir o CBZ.</h3>
          <p>O servidor precisa permitir downloads CORS. Você também pode abrir o arquivo diretamente.</p>
          <button class="btn btn-primary" data-open-anyway>Abrir arquivo</button>
        </div>`;
      controls.innerHTML = `<span class="reader-page">CBZ</span>`;
      $("[data-open-anyway]", body).onclick = () => {
        window.open(url, "_blank", "noopener");
      };
    }
  }

  // ... (renderCBZReader and renderCBRReader remain the same)



  // Local status helper for CBR
  const cbrStatus = (body, message) => {
    body.innerHTML = `<div class="empty" style="margin:auto;max-width:650px">${escapeHTML(message)}</div>`;
    console.log("[CBR]", message);
  };

  async function probeArchiveSignature(url) {
    try {
      const source = String(url || "");
      const response = await fetch(/^blob:/i.test(source) ? source : proxiedFileUrl(source), /^blob:/i.test(source) ? {} : {
        headers: { Range: "bytes=0-7" },
        mode: "cors",
        credentials: "omit",
        cache: "no-store",
        priority: "high"
      });
      if (!response.ok && response.status !== 206) return null;
      const reader = response.body?.getReader();
      if (!reader) return new Uint8Array(await response.arrayBuffer()).slice(0, 8);
      const first = await reader.read();
      await reader.cancel().catch(() => {});
      return first.value ? first.value.slice(0, 8) : null;
    } catch (error) {
      console.warn("Não foi possível identificar o contêiner do arquivo:", error);
      return null;
    }
  }

  function isZipSignature(bytes) {
    return bytes?.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
  }

  async function renderCBRReader(item, url, body, controls, overlay, skipCover = false, resumePage = 1, onPageChange = () => {}, prefetchedBuffer = null) {
    let objectUrl = null;
    let archive = null;
    let objectUrls = null; // For continuous scroll
    let cbrProgressRoot;
    let cbrProgressLabel;
    let cbrProgressBar;
    let cbrProgressDetail;

    function showCbrProgress(message, value = 0, detail = "Aguardando abertura…") {
      const safeValue = Number.isFinite(Number(value)) ? Math.max(0, Math.min(100, Number(value))) : 0;
      if (!cbrProgressRoot || !cbrProgressRoot.isConnected) {
        cbrProgressRoot = document.createElement("div");
        cbrProgressRoot.className = "reader-loading";
        cbrProgressLabel = document.createElement("div");
        cbrProgressLabel.className = "reader-loading-label";
        cbrProgressBar = document.createElement("progress");
        cbrProgressBar.className = "reader-progress";
        cbrProgressBar.max = 100;
        cbrProgressDetail = document.createElement("div");
        cbrProgressDetail.className = "reader-loading-detail";
        cbrProgressRoot.append(cbrProgressLabel, cbrProgressBar, cbrProgressDetail);
        body.replaceChildren(cbrProgressRoot);
      }
      cbrProgressLabel.textContent = message;
      cbrProgressBar.value = safeValue;
      cbrProgressDetail.textContent = detail || `${safeValue.toFixed(0)}%`;
      cbrProgressDetail.hidden = !detail;
    }

    function status(message) {
      showCbrProgress(message, 0, "Preparando arquivo…");
      return;
      body.innerHTML = `
      <div class="empty" style="margin:auto;max-width:650px">
        ${escapeHTML(message)}
      </div>
    `;
    }

    function fail(title, message) {
      console.error("[CBR]", title, message);

      body.innerHTML = `
      <div class="empty" style="margin:auto;max-width:650px">
        <h3>${escapeHTML(title)}</h3>
        <p>${escapeHTML(message)}</p>

        <button class="btn btn-primary" data-open-anyway>
          Abrir arquivo
        </button>
      </div>
    `;

      controls.innerHTML = `<span class="reader-page">CBR</span>`;

      $("[data-open-anyway]", body).onclick = () => {
        window.open(url, "_blank", "noopener");
      };
    }

    function timeoutPromise(ms, message) {
      return new Promise((_, reject) => {
        setTimeout(() => {
          const error = new Error(message);
          error.name = "TimeoutError";
          reject(error);
        }, ms);
      });
    }

    async function withTimeout(promise, ms, message) {
      return Promise.race([
        promise,
        timeoutPromise(ms, message)
      ]);
    }

    try {
      // Alguns arquivos cadastrados como CBR são ZIP/CBZ renomeados.
      // Detecta isso com os primeiros bytes antes de baixar o arquivo completo.
      const signature = await probeArchiveSignature(url);
      if (isZipSignature(signature)) {
        console.info("[CBR] Contêiner ZIP detectado; usando leitor CBZ por Range.");
        return renderCBZReader(item, url, body, controls, overlay, skipCover, resumePage, onPageChange, null);
      }
      const libarchivePromise = loadLibarchiveModule();

      // =========================================================
      // 1. BAIXAR CBR
      // =========================================================

      status("Abrindo arquivo CBR…");

      console.log("[CBR] URL:", url);
      const isMegaSource = /^https:\/\/(?:www\.)?mega\.nz\/file\//i.test(String(url || ""));

      // =========================================================
      // 2. LER ARQUIVO
      // =========================================================

      status("Lendo arquivo CBR…");

      const formatCbrBytes = bytes => bytes >= 1024 * 1024
        ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
        : `${Math.round(bytes / 1024)} KB`;
      let buffer = await waitForPrefetchedBuffer(prefetchedBuffer);
      if (buffer) {
        showCbrProgress("Arquivo CBR carregado. Preparando páginas…", 100, "Abertura concluída");
      } else {
        buffer = await fetchFileArrayBuffer(url, (received, total) => {
          const value = total ? (received / total) * 100 : 0;
        showCbrProgress("Abrindo arquivo CBR…", value, total ? `${value.toFixed(0)}% · ${formatCbrBytes(received)} de ${formatCbrBytes(total)}` : `${formatCbrBytes(received)} processados`);
        });
        console.log(`[CBR] ${isMegaSource ? "Mega" : "Arquivo"} baixado:`, buffer.byteLength, "bytes");
      }

      console.log(
        "[CBR] Tamanho:",
        buffer.byteLength,
        "bytes"
      );

      if (buffer.byteLength < 8) {
        throw new Error("CBR_EMPTY");
      }

      const bytes = new Uint8Array(buffer);

      const preview = new TextDecoder().decode(bytes.slice(0, 128)).trimStart().toLowerCase();
      if (preview.startsWith("<!doctype html") || preview.startsWith("<html") || preview.startsWith("<head")) {
        throw new Error("CBR_HTML_RESPONSE");
      }

      const isRAR5 =
        bytes[0] === 0x52 &&
        bytes[1] === 0x61 &&
        bytes[2] === 0x72 &&
        bytes[3] === 0x21 &&
        bytes[4] === 0x1A &&
        bytes[5] === 0x07 &&
        bytes[6] === 0x01 &&
        bytes[7] === 0x00;

      const isRAR4 =
        bytes[0] === 0x52 &&
        bytes[1] === 0x61 &&
        bytes[2] === 0x72 &&
        bytes[3] === 0x21 &&
        bytes[4] === 0x1A &&
        bytes[5] === 0x07 &&
        bytes[6] === 0x00;

      const rarVersion =
        isRAR5 ? "RAR5" :
        isRAR4 ? "RAR4" :
        "UNKNOWN";
      const isZipContainer = bytes[0] === 0x50 && bytes[1] === 0x4B && bytes[2] === 0x03 && bytes[3] === 0x04;

      console.log(
        "[CBR] Formato detectado:",
        rarVersion
      );

      if (rarVersion === "UNKNOWN" && !isZipContainer) {
        const header = Array.from(bytes.slice(0, 16), byte => byte.toString(16).padStart(2, "0")).join(" ");
        console.error("[CBR] Cabeçalho inválido; arquivo baixado não é RAR/ZIP:", header);
        throw new Error("CBR_INVALID_ARCHIVE");
      }

      if (rarVersion === "RAR5") {
        status("RAR5 detectado. Preparando leitor…");
      } else if (rarVersion === "RAR4") {
        status("RAR4 detectado. Preparando leitor…");
      } else {
        if (isZipContainer) {
          status("Arquivo ZIP detectado. Abrindo como CBZ…");
          return renderCBZReader(item, url, body, controls, overlay, skipCover, resumePage, onPageChange, buffer);
        }
        status("Formato compactado detectado. Preparando leitor…");
      }

      // =========================================================
      // 3. VERIFICAR LIBARCHIVE
      // =========================================================

      status("Verificando biblioteca CBR…");

      // A importacao ja foi iniciada em paralelo com o download do CBR.

      // =========================================================
      // 4. IMPORTAR LIBARCHIVE
      // =========================================================

      status("Carregando biblioteca CBR…");

      const module = await libarchivePromise;

      console.log(
        "[CBR] módulo carregado:",
        module
      );

      const Archive = module.Archive;

      console.log("[CBR] Archive:", Archive);
      console.log("[CBR] Archive.init:", Archive?.init);
      console.log("[CBR] Archive.open:", Archive?.open);

      if (
        !Archive ||
        typeof Archive.open !== "function" ||
        typeof Archive.init !== "function"
      ) {
        throw new Error(
          "LIBARCHIVE_API_INVALID"
        );
      }

      // =========================================================
      // 5. INICIALIZAR WORKER
      // =========================================================

      status("Inicializando leitor CBR…");

      const workerUrl = appAssetUrl("libarchive/worker-bundle.js");
      Archive.init({
        workerUrl
      });

      console.log(
        "[CBR] Worker configurado:",
        workerUrl
      );

      // =========================================================
      // 6. CRIAR FILE
      // =========================================================

      status("Preparando arquivo RAR…");

      const file = new File(
        [buffer],
        "comic.cbr",
        {
          type: "application/vnd.rar"
        }
      );

      console.log(
        "[CBR] File criado:",
        file.size
      );

      // =========================================================
      // 7. ABRIR RAR
      // =========================================================

      status(
        rarVersion === "RAR5"
          ? "Abrindo RAR5…"
          : "Abrindo RAR…"
      );

      console.log(
        "[CBR] Chamando Archive.open()..."
      );

      archive = await withTimeout(
        Archive.open(file),
        120000,
        "O libarchive demorou mais de 120 segundos para abrir o RAR."
      );

      console.log(
        "[CBR] Arquivo aberto:",
        archive
      );

      // =========================================================
      // 8. LISTAR ARQUIVOS
      // =========================================================

      status("Localizando páginas…");

      const files = await withTimeout(
        archive.getFilesObject(),
        120000,
        "O RAR abriu, mas demorou mais de 120 segundos para listar os arquivos."
      );

      console.log(
        "[CBR] Arquivos encontrados:",
        files
      );

      // =========================================================
      // 9. ENCONTRAR IMAGENS
      // =========================================================
      
      
      function findArchiveImages(obj, path = "") {
        const images = [];
      
      
        if (!obj || typeof obj !== "object") {
          return images;
        }
      
      
        for (const [key, value] of Object.entries(obj)) {
      
      
          const currentPath = path
            ? `${path}/${key}`
            : key;
      
      
          // Arquivo do libarchive.js
          if (
            value &&
            typeof value === "object" &&
            typeof value.extract === "function"
          ) {
      
      
            const fileName =
              value.name ||
              key;
      
      
            if (
              /\.(jpg|jpeg|png|webp|gif)$/i.test(
                fileName
              )
            ) {
      
      
              images.push({
                name: fileName,
                path: currentPath,
                file: value
              });
      
      
            }
      
      
            continue;
          }
      
      
          // Pasta / diretório
          if (
            value &&
            typeof value === "object"
          ) {
      
      
            images.push(
              ...findArchiveImages(
                value,
                currentPath
              )
            );
      
      
          }
        }
      
      
        return images;
      }
      
      
      const imageEntries =
        findArchiveImages(files);
      
      
      console.log(
        "[CBR] Imagens encontradas:",
        imageEntries.length
      );
      
      
      console.log(
        "[CBR] Lista de imagens:",
        imageEntries.map(
          entry => entry.path
        )
      );
      
      
      if (!imageEntries.length) {
        throw new Error(
          "CBR_NO_IMAGES"
        );
      }
      
      
      // O restante do leitor trabalha diretamente
      // com os objetos do libarchive.js.
      const imageFiles =
        imageEntries.map(
          entry => entry.file
        );
      
      
      console.log(
        "[CBR] Páginas detectadas:",
        imageFiles.map(
          file => file.name
        )
      );

      const currentReadingMode = state.readingMode;

      if (currentReadingMode === 'single-page') {
        const firstIndex = skipCover && imageFiles.length > 1 ? 1 : 0;
        let page = Math.max(firstIndex, Math.min(resumePage - 1, imageFiles.length - 1));
        const pageCache = createArchivePageCache(imageFiles, file => withTimeout(file.extract(), 120000, "A pÃ¡gina demorou mais de 120 segundos para ser extraÃ­da."));
        const img = document.createElement("img");
        img.className = "reader-image";
        img.alt = "Página do quadrinho";
        img.decoding = "async";
        body.replaceChildren(img);

        async function draw() {
          controls.innerHTML = `<span class="reader-page">Extraindo página ${page + 1}…</span>`;
          const currentThird = Math.floor(page / pageCache.thirdSize);
          const extracted = await pageCache.get(page);
          // Não bloqueia a primeira página esperando dezenas de extrações.
          void pageCache.prefetchThird(currentThird).catch(() => {});
          void pageCache.prefetchThird(currentThird + 1).catch(() => {});
          const blob = extracted instanceof Blob ? extracted : new Blob([extracted], { type: "image/jpeg" });
          if (objectUrl) URL.revokeObjectURL(objectUrl);
          objectUrl = URL.createObjectURL(blob);
          img.src = objectUrl;
          controls.innerHTML = `
            <button data-prev ${page <= firstIndex ? "disabled" : ""}>‹</button>
            <span class="reader-page">${page + 1} / ${imageFiles.length}</span>
            <button data-next ${page === imageFiles.length - 1 ? "disabled" : ""}>›</button>
          `;
          $("[data-prev]", controls)?.addEventListener("click", async () => { if (page > 0) { page--; await draw().catch(e => { page++; console.error(e); }); } });
          $("[data-next]", controls)?.addEventListener("click", async () => { if (page < imageFiles.length - 1) { page++; await draw().catch(e => { page--; console.error(e); }); } });
          onPageChange(item, page + 1, imageFiles.length);
        }
        await draw();
        $("[data-close-reader]", overlay).addEventListener('click', () => {
          if (objectUrl) URL.revokeObjectURL(objectUrl);
          archive?.close?.();
        }, { once: true });
      } else if (currentReadingMode === 'double-page') {
        let spread = Math.max(0, Math.floor((resumePage - 1) / 2));
        const spreadContainer = document.createElement("div");
        spreadContainer.className = "reader-double-page";
        body.replaceChildren(spreadContainer);
        const spreadUrls = [];

        async function drawSpread() {
          // Libera URLs anteriores
          for (const u of spreadUrls) {
            URL.revokeObjectURL(u);
          }
          spreadUrls.length = 0;
          spreadContainer.innerHTML = "";

          const indexesToRender = getReaderSpreadIndexes(imageFiles.length, spread, skipCover);
          const second = indexesToRender[indexesToRender.length - 1];

          for (const index of indexesToRender) {
            const extracted = await withTimeout(
              imageFiles[index].extract(),
              120000,
              "A página demorou mais de 120 segundos para ser extraída."
            );

            const blob = extracted instanceof Blob ? extracted : new Blob([extracted], { type: "image/jpeg" });
            const objectUrl = URL.createObjectURL(blob);
            spreadUrls.push(objectUrl);

            const wrapper = document.createElement("div");
            wrapper.className = "double-page";

            const img = document.createElement("img");
            img.className = "reader-image";
            img.alt = `Página ${index + 1}`;
            img.src = objectUrl;

            wrapper.appendChild(img);
            spreadContainer.appendChild(wrapper);
          }

          const displayedPages = indexesToRender.map(p => p + 1).sort((a, b) => a - b);

          controls.innerHTML = `
            <button data-prev ${spread === 0 ? "disabled" : ""}>‹</button>
            <span class="reader-page">
              ${displayedPages[0]}${displayedPages[1] ? `–${displayedPages[1]}` : ""} / ${imageFiles.length}
            </span>
            <button data-next ${second >= imageFiles.length - 1 ? "disabled" : ""}>›</button>
          `;

          $("[data-prev]", controls)?.addEventListener("click", async () => {
            if (spread > 0) { spread--; await drawSpread(); }
          });

          $("[data-next]", controls)?.addEventListener("click", async () => {
            if (second < imageFiles.length - 1) { spread++; await drawSpread(); }
          });
          onPageChange(item, indexesToRender[0] + 1, imageFiles.length);
        }

        await drawSpread();

        $("[data-close-reader]", overlay).addEventListener("click", () => {
          for (const u of spreadUrls) {
            URL.revokeObjectURL(u);
          }
          archive?.close?.();
        }, { once: true });
      } else if (currentReadingMode === 'continuous-scroll') {
        const pageContainer = document.createElement("div");
        pageContainer.className = "image-continuous-scroll-container";
        body.replaceChildren(pageContainer);

        objectUrls = [];
        const pageElements = [];
        const pageStates = new Map();

        imageFiles.forEach((file, index) => {
          if (skipCover && index === 0) return;
          const pageNum = index + 1;
          const pageWrapper = document.createElement("div");
          pageWrapper.className = "image-page-wrapper";
          pageWrapper.style.minHeight = "65vh";
          pageWrapper.style.width = "min(90%, 900px)";
          pageWrapper.dataset.pageNum = pageNum;
          const img = document.createElement("img");
          img.className = "reader-image";
          img.alt = `Página ${pageNum}`;
          pageWrapper.appendChild(img);
          pageContainer.appendChild(pageWrapper);
          pageElements.push({ file, pageNum, wrapper: pageWrapper, img });
          pageStates.set(index, { url: null, loading: null });
        });

        const loadPage = async page => {
          const pageState = pageStates.get(imageFiles.indexOf(page.file));
          if (!pageState || pageState.url || pageState.loading) return;
          pageState.loading = (async () => {
            const extracted = await withTimeout(page.file.extract(), 120000, "A extração de uma página demorou demais.");
            const blob = extracted instanceof Blob ? extracted : new Blob([extracted], { type: "image/jpeg" });
            pageState.url = URL.createObjectURL(blob);
            page.img.src = pageState.url;
            objectUrls.push(pageState.url);
          })().catch(error => console.error("[CBR] Falha ao extrair página", page.pageNum, error)).finally(() => {
            pageState.loading = null;
          });
          await pageState.loading;
        };

        const releasePage = page => {
          const pageState = pageStates.get(imageFiles.indexOf(page.file));
          if (!pageState?.url) return;
          URL.revokeObjectURL(pageState.url);
          objectUrls = objectUrls.filter(url => url !== pageState.url);
          pageState.url = null;
          page.img.removeAttribute("src");
        };

        const observer = new IntersectionObserver(entries => {
          entries.forEach(entry => {
            const page = pageElements.find(candidate => candidate.wrapper === entry.target);
            if (!page) return;
            if (entry.isIntersecting) loadPage(page);
            else releasePage(page);
          });
        }, { root: pageContainer, rootMargin: "150% 0px" });
        pageElements.forEach(page => observer.observe(page.wrapper));

        let currentPageIndex = 0;
        const updateControls = () => {
          const visiblePage = pageElements.find(page => {
            const rect = page.wrapper.getBoundingClientRect();
            return rect.top >= 0 && rect.top < window.innerHeight / 2;
          }) || pageElements.find(page => {
            const rect = page.wrapper.getBoundingClientRect();
            return rect.bottom > 0 && rect.top < window.innerHeight;
          }) || pageElements[0];

          if (!visiblePage) {
            currentPageIndex = 0;
            return;
          }

          currentPageIndex = pageElements.indexOf(visiblePage);
          controls.innerHTML = `
            <button data-prev ${currentPageIndex <= 0 ? "disabled" : ""}>↑</button>
            <span class="reader-page">${visiblePage.pageNum} / ${imageFiles.length}</span>
            <button data-next ${currentPageIndex >= pageElements.length - 1 ? "disabled" : ""}>↓</button>
          `;
          const prevBtn = $("[data-prev]", controls);
          const nextBtn = $("[data-next]", controls);
          prevBtn?.addEventListener("click", () => pageElements[Math.max(0, currentPageIndex - 1)].wrapper.scrollIntoView({ behavior: 'smooth', block: 'start' }));
          nextBtn?.addEventListener("click", () => pageElements[Math.min(pageElements.length - 1, currentPageIndex + 1)].wrapper.scrollIntoView({ behavior: 'smooth', block: 'start' }));
          onPageChange(item, visiblePage.pageNum, imageFiles.length);
        };

        pageContainer.addEventListener('scroll', updateControls, { passive: true });
        loadPage(pageElements[0]);
        updateControls();
        pageElements.find(page => page.pageNum === resumePage)?.wrapper.scrollIntoView({ block: 'start' });

        $("[data-close-reader]", overlay).addEventListener('click', () => {
          observer.disconnect();
          pageContainer.removeEventListener('scroll', updateControls);
          for (const url of objectUrls) URL.revokeObjectURL(url);
          objectUrls = null;
          archive?.close?.();
        }, { once: true });
      }

      const modeSelect = $("#reading-mode-select", overlay);
      if (modeSelect) {
        modeSelect.disabled = false;
        modeSelect.addEventListener('change', (e) => {
          setReadingMode(e.target.value);
          overlay._reopenReader?.({ skipCover });
        });
      }

      console.log(
        "[CBR] ================================="
      );

      console.log(
        "[CBR] LEITOR PRONTO"
      );

      console.log(
        "[CBR] Páginas:",
        imageFiles.length
      );

      console.log(
        "[CBR] ================================="
      );

    } catch (err) {
      archive?.close?.();
      if (objectUrls) {
        for (const url of objectUrls) URL.revokeObjectURL(url);
      }

      console.error(
        "[CBR] ERRO NO LEITOR:",
        err
      );

      const errorText =
        String(
          err?.message || err
        );

      if (
        errorText.includes(
          "LIBARCHIVE_WASM_MISSING"
        )
      ) {

        fail(
          "Biblioteca CBR incompleta.",
          "O arquivo libarchive.wasm não foi encontrado em /libarchive/. Coloque o WASM junto de libarchive.js e worker-bundle.js."
        );

      } else if (
        errorText.includes("LIBARCHIVE_WORKER_MISSING")
      ) {

        fail(
          "Worker do CBR não encontrado.",
          "O arquivo worker-bundle.js não foi encontrado em /libarchive/."
        );

      } else if (
        errorText.includes("LIBARCHIVE_MAIN_MISSING")
      ) {

        fail(
          "Biblioteca CBR não encontrada.",
          "O arquivo libarchive.js não foi encontrado em /libarchive/."
        );

      } else if (
        errorText.includes(
          "LIBARCHIVE_API_INVALID"
        )
      ) {

        fail(
          "Biblioteca CBR incompatível.",
          "O libarchive.js foi carregado, mas sua API Archive não está disponível."
        );

      } else if (
        errorText.includes(
          "CBR_NO_IMAGES"
        )
      ) {

        fail(
          "Nenhuma página encontrada.",
          "O RAR foi aberto, mas nenhuma imagem JPG, PNG, WEBP ou GIF foi encontrada."
        );

      } else if (
        errorText.includes(
          "CBR_EMPTY"
        )
      ) {

        fail(
          "CBR vazio ou inválido.",
          "O arquivo recebido não contém dados suficientes."
        );

      } else if (errorText.includes("CBR_HTML_RESPONSE")) {

        fail(
          "O MediaFire não entregou o CBR.",
          "O servidor devolveu uma página HTML em vez do arquivo. Confirme o link permanente do MediaFire e se a Edge Function mediafire-proxy foi publicada."
        );

      } else if (errorText.includes("CBR_INVALID_SIGNATURE")) {

        fail(
          "Arquivo CBR inválido.",
          "O download terminou, mas o conteúdo não possui assinatura RAR. Verifique o link e o Content-Type exibidos no console."
        );

      } else if (
        errorText.includes(
          "Failed to fetch"
        )
      ) {

        fail(
          "Não foi possível acessar o arquivo.",
          "O servidor pode estar bloqueando o download por CORS."
        );

      } else if (
        errorText.includes(
          "TimeoutError"
        )
      ) {

        fail(
          "O leitor demorou demais.",
          errorText
        );

      } else if (
        /^HTTP \d+/.test(errorText)
      ) {

        fail(
          "Erro ao baixar o CBR.",
          errorText
        );

      } else {

        fail(
          "Não foi possível abrir o CBR.",
          errorText
        );
      }

    }
  }

  function instantCover(item) {
    const title = String(item?.title || "HQ").slice(0, 34);
    const safeTitle = title.replace(/[<>&\"']/g, "");
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="540" viewBox="0 0 360 540"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#29232a"/><stop offset="1" stop-color="#111114"/></linearGradient></defs><rect width="360" height="540" fill="url(#g)"/><path d="M-20 430L380 80V210L-20 560Z" fill="#e50914" opacity=".72"/><text x="28" y="62" fill="#ff5962" font-family="Arial,sans-serif" font-size="13" font-weight="700" letter-spacing="3">BANCA DIGITAL</text><text x="28" y="285" fill="white" font-family="Arial,sans-serif" font-size="27" font-weight="700">${safeTitle}</text><text x="28" y="510" fill="#d2d2d5" font-family="Arial,sans-serif" font-size="12">Carregando capa…</text></svg>`;
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
  }

  function coverFor(item, variant = "card", coverChoices = null) {
    // A capa local aparece imediatamente; a capa real substitui-a quando terminar de carregar.
    if (!item) return instantCover({ title: "HQ" });
    const localCover = [item.coverUrl, item.selectedCoverUrl, item.cover].find(value => /^data:/i.test(String(value || "")));
    if (localCover) return localCover;
    const cachedCover = state.offlineCoverData?.get?.(String(item.id));
    if (cachedCover) return cachedCover;
    if (state.session?.offline) return instantCover(item);
    // Antes de a sessão e as preferências serem carregadas, não mostre a capa
    // padrão: ela seria substituída depois pela variante escolhida.
    if (!state.authReady) return instantCover(item);
    const activeChoices = coverChoices || (state.section === "public-profile" ? state.publicProfile?.coverChoices : state.coverChoices);
    const previewChoice = state.previewCoverChoices?.get?.(item.id) || state.previewCoverChoices?.get?.(String(item.id));
    const selectedCover = previewChoice
      ? (previewChoice.cover_url || item.coverUrl || item.cover)
      : (activeChoices?.get?.(item.id) || activeChoices?.get?.(String(item.id)))?.cover_url;
    if (selectedCover) return proxiedImageUrl(selectedCover);
    if (variant === "hero" && item.featuredCoverUrl) return proxiedImageUrl(item.featuredCoverUrl);
    if (item.coverUrl) return proxiedImageUrl(item.coverUrl);
    if (item.cover) return proxiedImageUrl(item.cover); // backward compatibility
    return instantCover(item);
  }

  function coverStyleFor(item, coverStyles = null) {
    const activeStyles = coverStyles || (state.section === "public-profile" ? state.publicProfile?.coverStyles : state.coverStyles);
    return activeStyles?.get?.(item?.id) || "normal";
  }

  function coverStyleControl(itemId, currentStyle, canUse = true, collectionId = "") {
    if (!canUse) return "";
    const premium = ["premium", "moderator", "admin"].includes(state.profile?.plan);
    const nextLabel = currentStyle === "normal" ? "Aplicar preto e branco" : currentStyle === "grayscale" && premium ? "Aplicar capa dourada" : "Voltar à capa normal";
    return `<span class="cover-effect-controls" aria-label="Efeito da capa"><button type="button" class="cover-effect-dot cover-effect-${escapeHTML(currentStyle)} ${currentStyle !== "normal" ? "is-active" : ""}" data-cover-effect-item="${escapeHTML(itemId)}" ${collectionId ? `data-cover-effect-collection="${escapeHTML(collectionId)}"` : ""} title="${nextLabel}${collectionId ? " (somente nesta coleção)" : ""}" aria-label="${nextLabel}${collectionId ? " (somente nesta coleção)" : ""}"></button></span>`;
  }

  function cycleCoverStyle(itemId, collectionId = "") {
    if (collectionId) return setCollectionCoverStyle(collectionId, itemId);
    const currentStyle = coverStyleFor({ id: itemId });
    const premium = ["premium", "moderator", "admin"].includes(state.profile?.plan);
    const nextStyle = currentStyle === "normal" ? "grayscale" : currentStyle === "grayscale" && premium ? "gold" : "normal";
    return setCoverStyle(itemId, nextStyle);
  }

  async function setCollectionCoverStyle(collectionId, itemId) {
    if (!state.session || state.publicProfile?.profile?.id !== state.session.user.id) return toast("Somente o criador pode alterar esta coleção.");
    const collection = state.publicProfile?.collections?.find(entry => entry.id === collectionId);
    if (!collection) return;
    const styles = { ...(collection.coverStyles || {}) };
    const currentStyle = styles[itemId] || "normal";
    const premium = ["premium", "moderator", "admin"].includes(state.profile?.plan);
    const nextStyle = currentStyle === "normal" ? "grayscale" : currentStyle === "grayscale" && premium ? "gold" : "normal";
    if (nextStyle === "normal") delete styles[itemId];
    else styles[itemId] = nextStyle;
    const result = await sb.from("shelf_collections").update({ cover_styles: styles }).eq("id", collectionId).eq("owner_id", state.session.user.id);
    if (result.error) return toast(result.error.message);
    await loadPublicProfile(state.publicProfile.profile.username, collectionId);
  }

  function seriesCoverFor(item, seriesCoverChoices = null) {
    const activeChoices = seriesCoverChoices || (state.section === "public-profile" ? state.publicProfile?.seriesCoverChoices : state.seriesCoverChoices);
    const selectedCover = activeChoices?.get?.(item?.seriesId)?.cover_url;
    if (selectedCover) return proxiedImageUrl(selectedCover);
    return coverFor(item);
  }

  function coverCacheKey(item, maxWidth) {
    return `banca-cover:v3:${maxWidth}:${item.id}:${item.fileUrl || item.telegramUrl || ""}`;
  }

  function directFileUrl(item) {
    const url = item?.fileUrl || "";
    return /^https?:\/\//i.test(url) || url ? url : "";
  }

  function proxiedFileUrl(url) {
    const source = String(url || "");
    let parsed;
    try { parsed = new URL(source); } catch { return source; }
    const host = parsed.hostname.toLowerCase();
    const isMediaFire = parsed.protocol === "https:" && (
      host === "mediafire.com" ||
      host === "www.mediafire.com" ||
      /^download\d+\.mediafire\.com$/.test(host)
    );
    const isMega = parsed.protocol === "https:" && (host === "mega.nz" || host === "www.mega.nz") && parsed.pathname.startsWith("/file/");
    if ((!isMediaFire && !isMega) || !window.BANCA_SUPABASE_URL) return source;
    const proxy = new URL(`${window.BANCA_SUPABASE_URL}/functions/v1/${isMega ? "mega-proxy" : "mediafire-proxy"}`);
    proxy.searchParams.set("url", source);
    return proxy.toString();
  }

  const READER_FILE_CACHE = "banca-reader-files-v2";
  const OFFLINE_COVER_CACHE = "banca-reader-covers-v1";
  // Os downloads precisam continuar disponíveis mesmo quando o usuário baixa
  // mais de quatro edições. O limite real continua sendo o armazenamento
  // permitido pelo navegador; este valor evita que o app faça uma evicção
  // prematura dos quadrinhos mais antigos.
  const MAX_READER_CACHE_BYTES = 2 * 1024 * 1024 * 1024;
  const MAX_READER_CACHE_FILES = 100;
  function offlineCoverCacheKey(itemId) { return `${location.origin}/__banca_offline_cover__/${encodeURIComponent(String(itemId))}`; }
  function blobToDataUrl(blob) {
    return new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => resolve("");
      reader.readAsDataURL(blob);
    });
  }

  async function readReaderFileCache(proxyUrl, onProgress) {
    if (!window.caches) return null;
    try {
      const cache = await window.caches.open(READER_FILE_CACHE);
      const cached = await cache.match(proxyUrl);
      if (!cached) return null;
      const buffer = await cached.arrayBuffer();
      if (!buffer.byteLength) return null;
      onProgress(buffer.byteLength, buffer.byteLength);
      cache.put(proxyUrl, new Response(buffer, {
        headers: {
          "Content-Type": cached.headers.get("Content-Type") || "application/octet-stream",
          "X-Reader-Size": String(buffer.byteLength),
          "X-Reader-Used": String(Date.now())
        }
      })).catch(() => {});
      return buffer;
    } catch (error) {
      console.warn("Não foi possível ler o cache do leitor:", error);
      return null;
    }
  }

  async function writeReaderFileCache(proxyUrl, buffer) {
    if (!window.caches || !buffer?.byteLength || /^blob:/i.test(String(proxyUrl || ""))) return false;
    try {
      const cache = await window.caches.open(READER_FILE_CACHE);
      const keys = await cache.keys();
      const entries = [];
      for (const key of keys) {
        const response = await cache.match(key);
        const size = Number(response?.headers.get("X-Reader-Size")) || 0;
        const used = Number(response?.headers.get("X-Reader-Used")) || 0;
        entries.push({ key, size, used });
      }
      let total = entries.reduce((sum, entry) => sum + entry.size, 0);
      const existingIndex = entries.findIndex(entry => entry.key.url === proxyUrl);
      if (existingIndex >= 0) {
        const [existing] = entries.splice(existingIndex, 1);
        await cache.delete(existing.key);
        total -= existing.size;
      }
      entries.sort((a, b) => a.used - b.used);
      while (entries.length && (total + buffer.byteLength > MAX_READER_CACHE_BYTES || entries.length >= MAX_READER_CACHE_FILES)) {
        const oldest = entries.shift();
        await cache.delete(oldest.key);
        total -= oldest.size;
      }
      await cache.put(proxyUrl, new Response(buffer, {
        headers: {
          "Content-Type": "application/octet-stream",
          "X-Reader-Size": String(buffer.byteLength),
          "X-Reader-Used": String(Date.now())
        }
      }));
      return true;
    } catch (error) {
      console.warn("Não foi possível salvar o arquivo no cache do leitor:", error);
    }
      return false;
  }

  async function readResponseBuffer(response, onProgress) {
    const total = Number(response.headers.get("content-length")) || 0;
    if (!response.body?.getReader) {
      const buffer = await response.arrayBuffer();
      onProgress(buffer.byteLength, total || buffer.byteLength);
      return buffer;
    }
    const reader = response.body.getReader();
    const chunks = [];
    let received = 0;
    try {
      while (true) {
        const part = await reader.read();
        if (part.done) break;
        chunks.push(part.value);
        received += part.value.byteLength;
        onProgress(received, total);
      }
    } catch (error) {
      error.readerTransfer = { chunks, received, total };
      throw error;
    }
    onProgress(received, total || received);
    const bytes = new Uint8Array(received);
    let offset = 0;
    chunks.forEach(chunk => { bytes.set(chunk, offset); offset += chunk.byteLength; });
    return bytes.buffer;
  }

  async function fetchFileArrayBuffer(url, onProgress = () => {}, onComplete = () => {}, signal = null) {
    const source = String(url || "");
    if (/^blob:/i.test(source)) {
      const response = await fetch(source, signal ? { signal } : {});
      if (!response.ok) throw new Error("HTTP " + response.status);
      const buffer = await readResponseBuffer(response, (received, total) => onProgress(received, total));
      onComplete();
      return buffer;
    }
    const isMega = /^https:\/\/(?:www\.)?mega\.nz\/file\//i.test(source);
    const proxyUrl = proxiedFileUrl(source);
    const cacheKey = `${proxyUrl}${proxyUrl.includes("?") ? "&" : "?"}v=240`;
    const cached = await readReaderFileCache(cacheKey, onProgress);
    if (cached) { onComplete(); return cached; }

    if (!isMega) {
      // Tenta uma única transferência; usa faixas apenas se o servidor falhar.
      try {
        const response = await fetch(proxyUrl, {
          method: "GET",
          mode: "cors",
          credentials: "omit",
          cache: "no-store",
          priority: "high",
          ...(signal ? { signal } : {})
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const buffer = await readResponseBuffer(response, (received, total) => onProgress(received, total));
        if (!buffer.byteLength) throw new Error("Arquivo vazio.");
        if (!await writeReaderFileCache(cacheKey, buffer)) throw new Error("NÃ£o foi possÃ­vel salvar o arquivo offline.");
        onComplete();
        return buffer;
      } catch (error) {
        console.warn("Download contínuo falhou; tentando por faixas:", error);
      }

      const chunkSize = 4 * 1024 * 1024;
      const chunks = [];
      let received = 0;
      let total = 0;
      while (!total || received < total) {
        const end = received + chunkSize - 1;
        let response;
        let lastError;
        for (let attempt = 0; attempt < 3; attempt += 1) {
          try {
            response = await fetch(proxyUrl, {
              headers: { Range: `bytes=${received}-${end}` },
              mode: "cors",
              credentials: "omit",
              cache: "no-store",
              priority: "high",
              ...(signal ? { signal } : {})
            });
            if (!response.ok && response.status !== 206) throw new Error(`HTTP ${response.status}`);
            break;
          } catch (error) {
            lastError = error;
            if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
          }
        }
        if (!response) throw lastError || new Error("Falha ao baixar um bloco do MediaFire.");
        const part = new Uint8Array(await response.arrayBuffer());
        const contentRange = response.headers.get("content-range") || "";
        const match = contentRange.match(/bytes\s+(\d+)-(\d+)\/(\d+)/i);
        if (match) total = Number(match[3]);
        if (!total) total = Number(response.headers.get("content-length")) || 0;
        if (!part.byteLength) throw new Error("O MediaFire retornou um bloco vazio.");
        chunks.push(part);
        received += part.byteLength;
        onProgress(received, total);
        if (response.status !== 206 || part.byteLength < chunkSize) break;
      }
      const bytes = new Uint8Array(received);
      let offset = 0;
      chunks.forEach(chunk => { bytes.set(chunk, offset); offset += chunk.byteLength; });
      if (total && received !== total) throw new Error(`Download incompleto: ${received} de ${total} bytes.`);
      onProgress(received, total || received);
      if (!await writeReaderFileCache(cacheKey, bytes.buffer)) throw new Error("NÃ£o foi possÃ­vel salvar o arquivo offline.");
      onComplete();
      return bytes.buffer;
    }

    // Uma única resposta evita uma chamada à Edge Function para cada bloco.
    // Se a conexão cair, usamos o modo por faixas abaixo como fallback.
    if (false) {
    let continuousError = null;
    try {
      const response = await fetch(proxyUrl, {
        method: "GET",
        mode: "cors",
        credentials: "omit",
        cache: "no-store",
        priority: "high"
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const buffer = await readResponseBuffer(response, (received, total) => onProgress(received, total));
      if (!buffer.byteLength) throw new Error("O Mega retornou um arquivo vazio.");
      await writeReaderFileCache(cacheKey, buffer);
      return buffer;
    } catch (error) {
      continuousError = error;
      console.warn("Download contínuo do Mega falhou; tentando por blocos:", error);
    }

    }
    const downloadByRanges = async (startAt = 0, prefixChunks = [], prefixReceived = 0, totalHint = 0) => {
      const chunkSize = 4 * 1024 * 1024;
      const chunks = [...prefixChunks];
      let total = totalHint;
      let received = prefixReceived;
      let start = startAt;
      while (!total || start < total) {
        const end = start + chunkSize - 1;
        let response;
        let lastError;
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            response = await fetch(proxyUrl, {
              headers: { Range: `bytes=${start}-${end}` },
              mode: "cors",
              credentials: "omit",
              cache: "no-store",
              priority: "high",
              ...(signal ? { signal } : {})
            });
            if (!response.ok && response.status !== 206) throw new Error(`HTTP ${response.status}`);
            break;
          } catch (error) {
            lastError = error;
            if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 250 * (attempt + 1)));
          }
        }
        if (!response) throw lastError || new Error("Falha ao baixar um bloco do Mega.");
        const part = new Uint8Array(await response.arrayBuffer());
        const contentRange = response.headers.get("content-range") || "";
        const match = contentRange.match(/bytes\s+(\d+)-(\d+)\/(\d+)/i);
        if (match) total = Number(match[3]);
        if (!total) total = Number(response.headers.get("content-length")) || 0;
        if (!part.byteLength) throw new Error("O Mega retornou um bloco vazio.");
        chunks.push(part);
        received += part.byteLength;
        onProgress(received, total);
        if (!total || part.byteLength < chunkSize) break;
        start += part.byteLength;
      }
      const bytes = new Uint8Array(received);
      let offset = 0;
      chunks.forEach(chunk => { bytes.set(chunk, offset); offset += chunk.byteLength; });
      if (!received) throw new Error("O Mega retornou um arquivo vazio.");
      if (total && received !== total) throw new Error(`Download incompleto: ${received} de ${total} bytes.`);
      return bytes.buffer;
    };

    // Avoid long-lived HTTP/3 streams: this is the connection mode that was
    // producing ERR_QUIC_PROTOCOL_ERROR. Each range is independently retried.
    // Recomeça as faixas desde o início; não mistura um stream interrompido
    // com blocos descriptografados independentemente pelo proxy do Mega.
    const partial = null;
    const buffer = await downloadByRanges(
      partial?.received || 0,
      partial?.chunks || [],
      partial?.received || 0,
      partial?.total || 0
    );
    onProgress(buffer.byteLength, buffer.byteLength);
    if (!await writeReaderFileCache(cacheKey, buffer)) throw new Error("NÃ£o foi possÃ­vel salvar o arquivo offline.");
    onComplete();
    return buffer;
  }

  function proxiedImageUrl(url) {
    const legacyCoverUrls = {
      "https://storage.googleapis.com/hipcomic/p/622e297bf53964d785dedfd21b923bb4-800.jpg": "https://www.comicsbox.it/cover/SHWRALPHA_001C.jpg",
      "https://dcuguide.com/Special:FilePath/Shadow_War_Alpha_1_%28Cover_B%29.png": "https://www.comicsbox.it/cover/SHWRALPHA_001B.jpg",
      "https://storage.googleapis.com/hipcomic/p/b683dbd84fe7e1f28c831ec91e6e6d22-800.jpg": "https://www.comicsbox.it/cover_dc/BATMAN3_122C.jpg",
      "https://dcuguide.com/Special:FilePath/Shadow_War_Omega_1_%28Cover_B%29.png": "https://www.comicsbox.it/cover_dc/SHWROMEGA_001B.jpg",
      "https://dcuguide.com/Special:FilePath/Shadow_War_Omega_1_%28Cover_C%29.png": "https://www.comicsbox.it/cover_dc/SHWROMEGA_001C.jpg",
    };
    const rawSource = String(url || "").trim();
    const source = legacyCoverUrls[rawSource] || rawSource;
    if (!window.BANCA_SUPABASE_URL || !/^https:\/\/(?:i\.imgur\.com|(?:www\.)?imgur\.com|zonafantasmanet\.files\.wordpress\.com)\//i.test(source)) return source;
    const proxy = new URL(`${window.BANCA_SUPABASE_URL}/functions/v1/image-proxy`);
    proxy.searchParams.set("url", source);
    proxy.searchParams.set("v", "2");
    return proxy.toString();
  }

  function imageProxyFetchUrl(url) {
    const source = String(url || "").trim();
    if (!window.BANCA_SUPABASE_URL || !/^https:\/\/(?:(?:i\.)?imgur\.com|zonafantasmanet\.files\.wordpress\.com|static\.dc\.com|(?:www\.)?dcuguide\.com|multiversohq\.com|www\.midtowncomics\.com|(?:i\.)?ibb\.co|image\.keycollectorcomics\.com|comicvine\.gamespot\.com|static\.pulps\.fr)\//i.test(source)) return proxiedImageUrl(source);
    const proxy = new URL(`${window.BANCA_SUPABASE_URL}/functions/v1/image-proxy`);
    proxy.searchParams.set("url", source);
    proxy.searchParams.set("v", "2");
    return proxy.toString();
  }

  function prepareLazyImages(root = document) {
    if (!root || readerIsOpen) return;
    const priorityRoot = root.closest?.(".modal-backdrop") || root.classList?.contains("modal-backdrop");
    $$('img', root).forEach(image => {
      if (priorityRoot) image.loading = "eager";
      else if (!image.hasAttribute("loading")) image.loading = "lazy";
      image.decoding = "async";
    });
    const backgrounds = $$('[style*="background-image"]', root).filter(element => element.dataset.coverSize !== "hero");
    if (!backgrounds.length) return;
    if (!("IntersectionObserver" in window)) {
      backgrounds.forEach(element => element.classList.remove("is-lazy-cover"));
      return;
    }
    if (!lazyCoverObserver) lazyCoverObserver = new IntersectionObserver(entries => {
      entries.sort((a, b) => {
        const first = a.target.getBoundingClientRect();
        const second = b.target.getBoundingClientRect();
        return first.top - second.top || first.left - second.left;
      }).forEach(entry => {
        if (!entry.isIntersecting) return;
        const element = entry.target;
        if (element.dataset.lazyBackground) {
          element.style.backgroundImage = element.dataset.lazyBackground;
          delete element.dataset.lazyBackground;
        }
        element.classList.remove("is-lazy-cover");
        lazyCoverObserver?.unobserve(element);
      });
    }, { rootMargin: "250px 0px" });
    backgrounds.forEach(element => {
      const background = element.style.backgroundImage;
      if (!background || background === "none") return;
      element.dataset.lazyBackground = background;
      element.style.backgroundImage = "none";
      element.classList.add("is-lazy-cover");
      lazyCoverObserver.observe(element);
    });
  }

  function prioritizeReaderLoading() {
    cancelCoverLoads();
    lazyCoverObserver?.disconnect();
    lazyCoverObserver = null;
    $$(".is-lazy-cover").forEach(element => {
      delete element.dataset.lazyBackground;
      element.style.backgroundImage = "none";
      element.classList.remove("is-lazy-cover");
    });
    $$('#main [style*="background-image"]').forEach(element => {
      if (element.dataset.readerPausedBackground === undefined && element.style.backgroundImage && element.style.backgroundImage !== "none") {
        element.dataset.readerPausedBackground = element.style.backgroundImage;
        element.style.backgroundImage = "none";
      }
    });
    $$('#main img').forEach(image => {
      if (image.dataset.readerPausedSrc === undefined) {
        image.dataset.readerPausedSrc = image.getAttribute("src") || "";
        image.dataset.readerPausedSrcset = image.getAttribute("srcset") || "";
        image.removeAttribute("src");
        image.removeAttribute("srcset");
      }
    });
  }

  function resumeCoverLoading() {
    $$('[data-reader-paused-background]').forEach(element => {
      element.style.backgroundImage = element.dataset.readerPausedBackground || "";
      delete element.dataset.readerPausedBackground;
    });
    $$('[data-reader-paused-src]').forEach(image => {
      if (image.dataset.readerPausedSrc) image.setAttribute("src", image.dataset.readerPausedSrc);
      if (image.dataset.readerPausedSrcset) image.setAttribute("srcset", image.dataset.readerPausedSrcset);
      delete image.dataset.readerPausedSrc;
      delete image.dataset.readerPausedSrcset;
    });
  }

  async function imageBlobToDataUrl(blob, maxWidth = 480) {
    if (!(blob instanceof Blob)) blob = new Blob([blob]);
    const bitmap = await createImageBitmap(blob);
    const scale = Math.min(1, maxWidth / bitmap.width);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const webp = canvas.toDataURL("image/webp", 0.86);
    return webp.startsWith("data:image/webp") ? webp : canvas.toDataURL("image/jpeg", 0.86);
  }

  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      if (!(blob instanceof Blob)) blob = new Blob([blob]);
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  async function pdfCover(url, signal, maxWidth = 480) {
    const response = await fetch(proxiedFileUrl(url), { mode: "cors", credentials: "omit", cache: "no-store", signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const pdf = await window.pdfjsLib.getDocument({ data: new Uint8Array(await response.arrayBuffer()) }).promise;
    const page = await pdf.getPage(1);
    const baseViewport = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: Math.min(2, maxWidth / baseViewport.width) });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
    const webp = canvas.toDataURL("image/webp", 0.86);
    return webp.startsWith("data:image/webp") ? webp : canvas.toDataURL("image/jpeg", 0.86);
  }

  async function cbzCover(url, signal, maxWidth = 480) {
    const response = await fetch(proxiedFileUrl(url), { mode: "cors", credentials: "omit", cache: "no-store", signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const JSZipLib = await (window.jszipReady || Promise.resolve(window.JSZip));
    if (!JSZipLib) throw new Error("JSZip não carregou.");
    const zip = await JSZipLib.loadAsync(await response.arrayBuffer());
    const name = Object.keys(zip.files)
      .filter(n => !zip.files[n].dir && /\.(jpg|jpeg|png|webp|gif)$/i.test(n))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))[0];
    if (!name) throw new Error("CBZ sem imagens");
    return imageBlobToDataUrl(await zip.files[name].async("blob"), maxWidth);
  }

  async function cbrCover(url, signal, maxWidth = 480) {
    const response = await fetch(proxiedFileUrl(url), { mode: "cors", credentials: "omit", cache: "no-store", signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const module = await import(appAssetUrl("libarchive/libarchive.js"));
    const Archive = module.Archive;
    Archive.init({ workerUrl: appAssetUrl("libarchive/worker-bundle.js") });
    const archive = await Archive.open(new File([await response.arrayBuffer()], "cover.cbr"));
    const files = await archive.getFilesObject();
    const images = [];
    const findImages = obj => {
      if (!obj || typeof obj !== "object") return;
      for (const [key, value] of Object.entries(obj)) {
        if (value && typeof value.extract === "function") {
          const name = value.name || key;
          if (/\.(jpg|jpeg|png|webp|gif)$/i.test(name)) images.push(value);
        } else findImages(value);
      }
    };
    findImages(files);
    if (!images.length) throw new Error("CBR sem imagens");
    return imageBlobToDataUrl(await images[0].extract(), maxWidth);
  }

  async function autoCover(item, signal, maxWidth = 480) {
    if (!item || item.coverUrl || item.cover || (maxWidth > 480 && item.featuredCoverUrl)) return null;
    const url = directFileUrl(item);
    if (!url) return null;
    const cacheId = `${item.id}:${maxWidth}`;
    const cacheKey = coverCacheKey(item, maxWidth);
    if (coverMemoryCache.has(cacheId)) return coverMemoryCache.get(cacheId);
    if (coverLoading.has(cacheId)) return coverLoading.get(cacheId);
    const cached = localStorage.getItem(cacheKey);
    if (cached && cached.length <= (maxWidth > 480 ? 900000 : 300000)) {
      coverMemoryCache.set(cacheId, cached);
      return cached;
    }
    if (cached) localStorage.removeItem(cacheKey);
    const format = (item.format || extension(url)).toLowerCase();
    let cover;
    try {
      if (format === "pdf" || /\.pdf(?:[?#]|$)/i.test(url)) cover = await pdfCover(url, signal, maxWidth);
      else if (format === "cbz" || /\.cbz(?:[?#]|$)/i.test(url)) cover = await cbzCover(url, signal, maxWidth);
      else if (format === "cbr" || /\.cbr(?:[?#]|$)/i.test(url)) cover = await cbrCover(url, signal, maxWidth);
      else if (/^(jpg|jpeg|png|webp|gif)$/i.test(format)) cover = url;
    } catch (error) {
      if (!signal?.aborted) coverMemoryCache.set(cacheId, null);
      return null;
    }
    if (cover) {
      coverMemoryCache.set(cacheId, cover);
      try { localStorage.setItem(cacheKey, cover); } catch {}
      return cover;
    }
    return null;
  }

  function hydrateHomeCovers() {
    if (readerIsOpen || state.session?.offline) return;
    const elements = $$('[data-cover-id]');
    if (!elements.length) return;
    const load = element => {
      if (readerIsOpen) return;
      const item = state.db.library.find(x => x.id === element.dataset.coverId) || state.localBoxFiles.find(x => x.id === element.dataset.coverId);
      if (!item || element.dataset.coverReady === "true") return;
      element.dataset.coverReady = "true";
      const controller = new AbortController();
      coverAbortControllers.set(item.id, controller);
      const isHero = element.classList.contains("hero-bg") || element.classList.contains("hero-cover");
      const maxWidth = isHero ? 1200 : 480;
      const cacheId = `${item.id}:${maxWidth}`;
      const job = coverLoading.get(cacheId) || autoCover(item, controller.signal, maxWidth);
      coverLoading.set(cacheId, job);
      job.then(cover => {
        if (!cover) return;
        $$('[data-cover-id]').filter(el => el.dataset.coverId === item.id && ((el.classList.contains("hero-bg") || el.classList.contains("hero-cover")) === isHero)).forEach(el => { el.style.backgroundImage = `url("${cover}")`; });
      }).catch(error => { element.dataset.coverReady = ""; console.warn("Não foi possível gerar a capa de", item.title, error); })
        .finally(() => coverLoading.delete(cacheId));
    };
    const priority = elements.filter(element => element.classList.contains("hero-bg"));
    const deferred = elements.filter(element => !element.classList.contains("hero-bg"));
    const observeDeferred = () => {
      if (readerIsOpen) return;
      deferredCoverObserver?.disconnect();
      deferredCoverObserver = "IntersectionObserver" in window ? new IntersectionObserver(entries => entries.forEach(entry => { if (entry.isIntersecting) { load(entry.target); deferredCoverObserver?.unobserve(entry.target); } }), { rootMargin: "500px" }) : null;
      deferred.forEach(element => deferredCoverObserver ? deferredCoverObserver.observe(element) : load(element));
    };
    const priorityJobs = priority.map(load).filter(Boolean);
    if (priorityJobs.length) Promise.allSettled(priorityJobs).then(observeDeferred);
    else observeDeferred();
  }

  function card(item, progressMap = state.readingProgress, favoriteIds = state.favoriteIds, directOpen = false, coverChoices = null, seriesContext = false, collectionContext = null) {
    const publicCollection = state.section === "public-profile" && state.publicProfile?.collectionId
      ? state.publicProfile.collections?.find(collection => collection.id === state.publicProfile.collectionId)
      : null;
    const activeCollectionContext = collectionContext || (publicCollection ? { id: publicCollection.id, ownerId: state.publicProfile.profile.id, coverStyles: new Map(Object.entries(publicCollection.coverStyles || {})), coverChoices: new Map(Object.entries(publicCollection.coverChoices || {})) } : null);
    const completed = progressFor(item, progressMap)?.completed;
    const displayTitle = itemDisplayTitle(item);
    const issueLabel = itemIssueLabel(item);
    const coverVariants = usableCoverVariants(item);
    const hasCoverVariants = coverVariants.length > 0;
    const savedForCover = favoriteIds.has(item.id) || (seriesContext && item.seriesId && favoriteIds.has(item.seriesId));
    const collectionOwner = activeCollectionContext?.ownerId === state.session?.user?.id;
    const adminCanChooseCover = state.profile?.plan === "admin" && !activeCollectionContext?.id;
    const canChooseCover = state.session && ["premium", "moderator", "admin"].includes(state.profile?.plan) && (collectionOwner || adminCanChooseCover || (favoriteIds === state.favoriteIds && savedForCover)) && hasCoverVariants;
    const coverStyle = coverStyleFor(item, activeCollectionContext?.coverStyles || null);
    const canSetCoverStyle = collectionOwner || (Boolean(state.session) && favoriteIds === state.favoriteIds);
    const coverEffects = coverStyleControl(item.id, coverStyle, canSetCoverStyle, activeCollectionContext?.id || "");
    const authors = String(item.author || "").split(/\s*(?:\/|&|\be\b)\s*/i).map(value => value.trim()).filter(Boolean);
    const entityButton = (kind, value, label = value) => value ? `<button type="button" class="card-entity-link" data-entity-kind="${escapeHTML(kind)}" data-entity-value="${escapeHTML(value)}">${escapeHTML(label)}</button>` : "";
    const cardActions = `<div class="card-actions"><button class="card-like ${state.comicLikeIds.has(item.id) ? "is-liked" : ""}" data-like-item="${escapeHTML(item.id)}" title="Curtir quadrinho">${state.comicLikeIds.has(item.id) ? "♥" : "♡"} ${state.comicLikeCounts.get(item.id) || 0}</button><button class="card-share" data-share-item="${escapeHTML(item.id)}" title="Compartilhar quadrinho">Compartilhar</button><button class="card-comment" data-comment-item="${escapeHTML(item.id)}" title="Ver comentarios">Comentários</button>${item.seriesId ? `<button class="card-series" data-view-series="${escapeHTML(item.seriesId)}" title="Ver serie">Série</button>` : ""}</div>`;
    return `
      <div class="card-wrap"><article class="card" data-open="${escapeHTML(item.id)}" ${(directOpen || (state.section === "public-profile" && state.publicProfile?.collectionId)) ? "data-open-direct=\"true\"" : ""}>
          <div class="cover" data-cover-id="${escapeHTML(item.id)}" data-cover-style="${escapeHTML(coverStyle)}" style="background-image:url('${escapeHTML(coverFor(item, "card", activeCollectionContext?.coverChoices || coverChoices))}')">
          <span class="cover-number">${escapeHTML(issueLabel)}</span>
          <button class="card-favorite ${favoriteIds.has(item.id) ? 'is-favorite' : ''}" data-favorite="${escapeHTML(item.id)}" title="Salvar na estante">★</button>
        </div>
        ${completed ? '<div class="card-completed">✓ Lida</div>' : ''}
        ${state.session && item.type === "comic" ? (() => { const download = downloaded(item.id); const status = download?.status || "idle"; return `<button class="card-download ${status === "completed" ? "is-downloaded" : status === "downloading" ? "is-downloading" : ""}" data-download="${escapeHTML(item.id)}" title="${status === "completed" ? "Excluir download offline" : status === "downloading" ? "Download em andamento" : "Permitir leitura offline"}">${status === "downloading" ? "…" : "↓"}</button>`; })() : ""}
        <div class="card-body">
          <div class="card-title">${escapeHTML(displayTitle)}</div>
          <div class="card-meta">${entityButton("year", String(item.year || ""), String(item.year || ""))}${entityButton("character", item.character)}${entityButton("publisher", item.publisher)}${entityButton("imprint", item.imprint)}</div>
          ${authors.length ? `<div class="card-authors">${authors.map(author => entityButton("author", author)).join(" ")}</div>` : ""}
          <div class="card-stats"><span>♥ ${Number(item.clicks || 0).toLocaleString("pt-BR")} leituras</span>${canChooseCover ? `<button type="button" class="card-cover-choice" data-cover-choice="${escapeHTML(item.id)}" ${activeCollectionContext?.id ? `data-cover-choice-collection="${escapeHTML(activeCollectionContext.id)}"` : ""} title="${activeCollectionContext?.id ? "Capa variante somente nesta coleção" : "Escolher capa"}">${state.profile?.plan === "admin" && !activeCollectionContext?.id ? "Escolher capa" : "Capa"}</button>` : hasCoverVariants ? `<span class="card-variant-info" title="Esta edição possui capas variantes">Capa variante</span>` : ""}${coverEffects}</div>
          <div class="card-actions"><button class="card-like ${state.comicLikeIds.has(item.id) ? "is-liked" : ""}" data-like-item="${escapeHTML(item.id)}" title="Curtir quadrinho">${state.comicLikeIds.has(item.id) ? "♥" : "♡"} ${state.comicLikeCounts.get(item.id) || 0}</button><button class="card-share" data-share-item="${escapeHTML(item.id)}" title="Compartilhar quadrinho">Compartilhar</button><button class="card-comment" data-comment-item="${escapeHTML(item.id)}" title="Ver comentários">Comentários</button>${item.seriesId ? `<button class="card-series" data-view-series="${escapeHTML(item.seriesId)}" title="Ver série">Série</button>` : ""}</div>
        </div>
      </article>${cardActions}</div>`;
  }

  function itemDisplayTitle(item) {
    const candidates = [item?.seriesTitle, item?.title, item?.name, item?.comicTitle, item?.displayTitle];
    let base = candidates.find(value => {
      const text = String(value || "").trim();
      return text && !/^(quadrinho|hq)$/i.test(text);
    });
    if (!base) {
      const source = item?.fileName || item?.filename || item?.originalName || item?.fileUrl;
      let filename = String(source || "").split(/[\\/?]/).pop() || "";
      try { filename = decodeURIComponent(filename); } catch {}
      filename = filename.replace(/\.[a-z0-9]{2,5}$/i, "").replace(/[+_]+/g, " ").replace(/\s+/g, " ").trim();
      if (filename && !/^(quadrinho|hq)$/i.test(filename)) base = filename;
    }
    base ||= "Quadrinho";
    const issue = String(item?.issue || "").trim();
    if (!issue) return base;
    const number = issue.match(/\d+/)?.[0];
    return number ? `${base} #${Number(number)}` : `${base} — ${issue}`;
  }

  function itemIssueLabel(item) {
    const issue = String(item?.issue || "").trim();
    if (!item?.seriesId || !issue || !/^\d+(?:\.\d+)?$/.test(issue)) return issue;
    const availableTotal = state.db.library.filter(entry => entry.seriesId === item.seriesId && (!item.volume || entry.volume === item.volume)).length;
    return availableTotal > 1 ? `${issue}/${availableTotal}` : issue;
  }

  function rail(title, items, subtitle = "", actionText = "", directOpen = false, deduplicate = true, sectionClass = "") {
    if (!items.length) return "";
    const railItems = deduplicate ? uniqueCatalogItems(items) : items;
    return `
      <section class="section ${escapeHTML(sectionClass)}">
        <div class="section-head">
          <div>
            <h2 class="section-title">${escapeHTML(title)}</h2>
            ${subtitle ? `<div class="section-subtitle">${escapeHTML(subtitle)}</div>` : ""}
          </div>
          ${actionText ? `<button class="link-btn" data-section="search">${escapeHTML(actionText)} →</button>` : ""}
        </div>
        <div class="rail-viewport"><div class="rail">${railItems.map(item => card(item, state.readingProgress, state.favoriteIds, directOpen)).join("")}</div></div>
      </section>`;
  }

  function recommendationHash(value = "") {
    let hash = 2166136261;
    for (const character of String(value)) {
      hash ^= character.charCodeAt(0);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0) / 4294967295;
  }

  function recommendationPeriodKeys(now = new Date()) {
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const date = new Date(year, now.getMonth(), now.getDate());
    const firstDay = new Date(year, 0, 1);
    const week = Math.ceil((((date - firstDay) / 86400000) + firstDay.getDay() + 1) / 7);
    return { day: `${year}-${month}-${day}`, week: `${year}-semana-${week}`, month: `${year}-${month}` };
  }

  function globalRecommendation(items, periodKey, groupSeries = false) {
    const groups = new Map();
    items.filter(item => !item.local && (groupSeries ? item.seriesId : item.id)).forEach(item => {
      const key = groupSeries ? item.seriesId : item.id;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(item);
    });
    return [...groups.entries()].map(([key, entries]) => {
      const popularity = entries.reduce((total, item) => total + Math.log1p(Number(item.clicks) || 0), 0);
      const featured = entries.some(item => item.featured) ? 0.35 : 0;
      return { item: entries[0], score: popularity * 0.08 + featured + recommendationHash(`${periodKey}:${key}`), key };
    }).sort((a, b) => b.score - a.score || String(a.key).localeCompare(String(b.key), "pt-BR"))[0]?.item || null;
  }

  function globalRecommendationCard(item, label, description, accent, isSeries = false) {
    if (!item) return "";
    const series = isSeries ? seriesDefinitionFor(item) : null;
    const title = isSeries ? (series.name || item.seriesTitle || item.title) : itemDisplayTitle(item);
    const editions = isSeries ? seriesEditions(item).length : 0;
    const meta = isSeries ? `${editions || 1} ${editions === 1 ? "edição" : "edições"}` : [item.issue ? `Edição ${item.issue}` : "Edição única", item.year].filter(Boolean).join(" · ");
    const action = isSeries ? `data-view-series="${escapeHTML(item.seriesId)}"` : `data-open="${escapeHTML(item.id)}" data-open-direct="true"`;
    const cover = isSeries ? seriesCoverFor(item) : coverFor(item, "card");
    return `<article class="global-recommendation-card global-recommendation-${accent}" ${action} tabindex="0"><div class="global-recommendation-glow"></div><div class="global-recommendation-cover" style="background-image:url('${escapeHTML(cover)}')"></div><div class="global-recommendation-copy"><div class="global-recommendation-label"><span>${escapeHTML(label)}</span><i></i></div><h3>${escapeHTML(title || "Recomendação da banca")}</h3><p>${escapeHTML(description)}</p><div class="global-recommendation-meta">${escapeHTML(meta)}</div><span class="global-recommendation-cta">${isSeries ? "Explorar série" : "Ler edição"} <b>→</b></span></div></article>`;
  }

  function globalRecommendationsSection(lib) {
    const periods = recommendationPeriodKeys();
    const day = globalRecommendation(lib, periods.day);
    const week = globalRecommendation(lib, periods.week);
    const month = globalRecommendation(lib, periods.month, true);
    if (!day && !week && !month) return "";
    return `<section class="section global-recommendations-section"><div class="global-recommendations-heading"><div><div class="eyebrow">Curadoria global</div><h2 class="section-title">Escolhas da banca</h2><div class="section-subtitle">Uma seleção renovada para descobrir algo especial em cada visita.</div></div><span class="global-recommendations-mark">✦</span></div><div class="global-recommendations-grid">${globalRecommendationCard(day, "Recomendação do dia", "Uma edição para abrir agora e deixar a leitura acontecer.", "day")}${globalRecommendationCard(week, "Recomendação da semana", "A edição que merece um espaço na sua agenda desta semana.", "week")}${globalRecommendationCard(month, "Série do mês", "Uma série para acompanhar com calma, edição por edição.", "month", true)}</div></section>`;
  }

  function characterBannerSection(lib) {
    const groups = new Map();
    lib.filter(item => String(item.character || "").trim() && !item.local).forEach(item => {
      const character = String(item.character).trim();
      if (!groups.has(character)) groups.set(character, []);
      groups.get(character).push(item);
    });
    const characters = [...groups.keys()];
    if (!characters.length) return "";
    if (!state.homeRandomCharacter || !groups.has(state.homeRandomCharacter)) {
      state.homeRandomCharacter = weightedRandom(characters);
    }
    const character = state.homeRandomCharacter;
    const editions = groups.get(character) || [];
    const representative = editions.slice().sort((a, b) => Number(b.clicks) - Number(a.clicks))[0] || editions[0];
    const adminHeading = state.profile?.plan === "admin" ? `<div class="section-head character-banner-admin-heading"><div><h2 class="section-title">Personagem em destaque</h2><div class="section-subtitle">Banner editorial da página inicial.</div></div><div data-home-section-controls-slot></div></div>` : "";
    return `<section class="section character-banner-home-section">${adminHeading}<div class="character-banner-section" data-entity-kind="character" data-entity-value="${escapeHTML(character)}" role="link" tabindex="0" aria-label="Ver todas as edições de ${escapeHTML(character)}"><div class="character-banner-bg" style="background-image:url('${escapeHTML(coverFor(representative, "hero"))}')"></div><div class="character-banner-overlay"></div><div class="character-banner-content"><div class="eyebrow">Personagem em destaque</div><h2>${escapeHTML(character)}</h2><p>${editions.length} ${editions.length === 1 ? "edição disponível" : "edições disponíveis"} para explorar.</p><span class="character-banner-cta">Ver todas as edições <b>→</b></span></div><div class="character-banner-spark">✦</div></div></section>`;
  }

  function renderHome() {
    const lib = state.db.library;
    let heroItem = lib.find(item => item.id === state.homeHeroId);
    if (!heroItem) {
      heroItem = weightedRandom(lib.filter(x => x.featured)) || lib[0];
      state.homeHeroId = heroItem?.id || null;
    }
    const monthlyReadCount = item => state.comicMonthlyReadCounts.get(String(item.id)) || 0;
    const mostClicked = uniqueCatalogItems([...lib].sort((a, b) => {
      const aCount = state.comicMonthlyReadCountsLoaded ? monthlyReadCount(a) : Number(a.clicks) || 0;
      const bCount = state.comicMonthlyReadCountsLoaded ? monthlyReadCount(b) : Number(b.clicks) || 0;
      return bCount - aCount || itemDisplayTitle(a).localeCompare(itemDisplayTitle(b), "pt-BR");
    }).slice(0, 10));
    const recentlyAdded = lib
      .map((item, index) => ({ item, index, addedAt: Date.parse(item.addedAt || item.createdAt || "") || 0 }))
      .sort((a, b) => b.addedAt - a.addedAt || a.index - b.index)
      .slice(0, 20)
      .map(entry => entry.item);
    const recentlyAddedSeries = lib
      .map((item, index) => ({ item, index, addedAt: Date.parse(item.addedAt || item.createdAt || "") || 0 }))
      .filter(entry => entry.item.seriesId)
      .sort((a, b) => b.addedAt - a.addedAt || a.index - b.index)
      .filter((entry, index, entries) => entries.findIndex(candidate => candidate.item.seriesId === entry.item.seriesId) === index)
      .slice(0, 20)
      .map(entry => entry.item);
    const recentlyAddedSeriesRail = recentlyAddedSeries.length ? `<section class="section recently-added-series"><div class="section-head"><div><h2 class="section-title">Séries novas</h2><div class="section-subtitle">As séries adicionadas mais recentemente ao catálogo.</div></div></div><div class="rail-viewport"><div class="rail">${recentlyAddedSeries.map(item => seriesCard(item)).join("")}</div></div></section>` : "";
    const progressRecentIds = [...state.readingProgress.entries()]
      .filter(([, progress]) => progress?.updated_at)
      .sort(([, a], [, b]) => new Date(b.updated_at) - new Date(a.updated_at))
      .map(([itemId]) => String(itemId));
    const recentIds = state.session
      ? [...new Set([...state.recentlyOpenedIds, ...progressRecentIds])]
        .filter(itemId => !state.readingProgress.get(itemId)?.completed)
        .slice(0, 6)
      : [];
    const recentlyOpened = recentIds.map(itemId => lib.find(item => String(item.id) === itemId)).filter(Boolean);
    const heroTitle = heroItem ? itemDisplayTitle(heroItem) : "Sua banca digital";
    const heroMeta = heroItem ? [heroItem.issue, heroItem.type ? formatType(heroItem.type) : "", heroItem.year].map(value => String(value || "").trim()).filter(Boolean).join(" · ") : "";
    let randoms = state.homeRandomIds.map(id => lib.find(item => item.id === id)).filter(Boolean).slice(0, 6);
    if (randoms.length < 6) {
      randoms = uniqueCatalogItems([...lib].sort(() => Math.random() - .5).slice(0, 6));
      state.homeRandomIds = randoms.map(item => item.id);
    }
    const personalized = personalizedRecommendations(lib);
    const personalizedRail = state.session && personalized.length ? `<section class="section personalized-recommendations"><div class="section-head"><div><h2 class="section-title">Dicas para você</h2><div class="section-subtitle">Sugestões baseadas nos quadrinhos que você salvou e curtiu.</div></div></div><div class="rail-viewport"><div class="rail">${personalized.map(item => card(item, state.readingProgress, state.favoriteIds, true)).join("")}</div></div></section>` : "";
    const readArtistRecommendation = readArtistSeriesRecommendation(lib);
    const readArtistRail = readArtistRecommendation ? `<section class="section read-artist-recommendations"><div class="section-head"><div><h2 class="section-title">Do mesmo artista de ${escapeHTML(itemDisplayTitle(readArtistRecommendation.readItem))}</h2><div class="section-subtitle">Outras séries do mesmo artista para você conhecer.</div></div></div><div class="rail-viewport"><div class="rail">${readArtistRecommendation.seriesItems.map(item => seriesCard(item)).join("")}</div></div></section>` : "";
    const publisherGroups = new Map();
    lib.filter(item => String(item.publisher || "").trim()).forEach(item => {
      const publisher = String(item.publisher).trim();
      if (!publisherGroups.has(publisher)) publisherGroups.set(publisher, []);
      publisherGroups.get(publisher).push(item);
    });
    const publisherChoices = [...publisherGroups.keys()];
    if (!publisherGroups.has(state.homeRandomPublisher)) state.homeRandomPublisher = weightedRandom(publisherChoices) || null;
    const randomPublisherItems = state.homeRandomPublisher ? publisherGroups.get(state.homeRandomPublisher) || [] : [];
    const randomPublisherRail = randomPublisherItems.length ? rail(state.homeRandomPublisher, randomPublisherItems, "Uma editora escolhida aleatoriamente.", "", true, true, "best-series-section") : "";
    const mostDownloaded = uniqueCatalogItems([...lib]
      .filter(item => Number(item.downloadCount) > 0)
      .sort((a, b) => Number(b.downloadCount) - Number(a.downloadCount) || itemDisplayTitle(a).localeCompare(itemDisplayTitle(b), "pt-BR"))
      .slice(0, 20));
    const mostDownloadedRail = mostDownloaded.length ? rail("Mais baixados", mostDownloaded, "As edições mais baixadas neste catálogo.", "", true) : "";
    const mostReadCoverItems = [...lib]
      .sort((a, b) => Number(b.clicks) - Number(a.clicks) || itemDisplayTitle(a).localeCompare(itemDisplayTitle(b), "pt-BR"))
      .slice(0, 10);
    const mostReadCoverGrid = mostReadCoverItems.length ? `<section class="section most-read-cover-section">${state.profile?.plan === "admin" ? '<div class="section-head"><h2 class="section-title">Mais lidos</h2></div>' : ""}<div class="most-read-cover-grid">${mostReadCoverItems.map(item => `<button type="button" class="most-read-cover" data-open="${escapeHTML(item.id)}" data-open-direct="true" aria-label="Abrir ${escapeHTML(itemDisplayTitle(item))}" style="background-image:url('${escapeHTML(coverFor(item, "card"))}')"></button>`).join("")}</div></section>` : "";

    const seriesEntries = new Map();
    lib.filter(item => item.seriesId).forEach(item => {
      if (!seriesEntries.has(item.seriesId)) seriesEntries.set(item.seriesId, []);
      seriesEntries.get(item.seriesId).push(item);
    });
    const bestSeries = [...seriesEntries.entries()]
      .map(([seriesId, editions]) => ({
        item: editions[0],
        likes: editions.reduce((total, edition) => total + (state.comicLikeCounts.get(edition.id) || 0), 0)
      }))
      .sort((a, b) => b.likes - a.likes || String(a.item.seriesTitle || a.item.title).localeCompare(String(b.item.seriesTitle || b.item.title), "pt-BR"))
      .slice(0, 6);
    const bestSeriesRail = bestSeries.length ? `<section class="section best-series-section"><div class="section-head"><div><h2 class="section-title">Melhores séries</h2><div class="section-subtitle">As séries mais curtidas, pela soma das curtidas de suas edições.</div></div></div><div class="results-grid">${bestSeries.map(entry => seriesCard(entry.item)).join("")}</div></section>` : "";

    const publisherEntries = new Map();
    lib.filter(item => item.type === "comic" && String(item.publisher || "").trim()).forEach(item => {
      const name = String(item.publisher).trim();
      if (!publisherEntries.has(name)) publisherEntries.set(name, []);
      publisherEntries.get(name).push(item);
    });
    const pinnedPublishers = [...publisherEntries.entries()].filter(([name]) => state.publisherSettings.get(publisherKey(name))?.is_pinned);
    const publisherPinnedRail = pinnedPublishers.length ? `<section class="section publisher-pinned-section"><div class="section-head"><div><h2 class="section-title">Editoras fixadas</h2><div class="section-subtitle">Acesso rápido às editoras em destaque.</div></div></div><div class="publisher-carousel">${pinnedPublishers.map(([name, publisherItems]) => { const setting = state.publisherSettings.get(publisherKey(name)); const representative = publisherItems.find(item => item.featuredCoverUrl || item.coverUrl || item.cover) || publisherItems[0]; const cover = setting?.cover_url || coverFor(representative); return `<button class="publisher-card is-pinned" type="button" data-publisher="${escapeHTML(name)}"><div class="publisher-card-cover" style="background-image:url('${escapeHTML(cover)}')"></div><div class="publisher-card-overlay"></div><div class="publisher-card-info"><strong>${escapeHTML(name)}</strong><span>${publisherItems.length} edição(ões)</span></div></button>`; }).join("")}</div></section>` : "";

    const featuredCollectionsRail = state.featuredComicCollections?.length ? `<section class="section featured-collections-rail"><div class="section-head"><div><h2 class="section-title">Coleções de quadrinhos em destaque</h2><div class="section-subtitle">Coleções públicas escolhidas pela equipe.</div></div></div><div class="public-collections-grid">${state.featuredComicCollections.map(collection => publicCollectionCard(collection)).join("")}</div></section>` : "";
    const homeSections = {
      recommendations: globalRecommendationsSection(lib),
      "character-banner": characterBannerSection(lib),
      continue: rail("Continue de onde parou", recentlyOpened, "Edições abertas recentemente.", "", true, false),
      recent: rail("Adicionados recentemente", recentlyAdded, "As últimas edições adicionadas ao catálogo.", "", true, false),
      "new-series": recentlyAddedSeriesRail,
      monthly: rail("Mais lidos do mês", mostClicked, "As edições que mais receberam cliques neste mês.", "Ver catálogo", true),
      "pinned-publishers": publisherPinnedRail,
      "best-series": bestSeriesRail,
      "featured-collections": featuredCollectionsRail,
      random: rail("Escolha aleatória", randoms, "Como escolher uma revista numa banca: você nunca sabe o que vai encontrar.", "", true, true, "random-choice-section"),
      tips: personalizedRail,
      artist: readArtistRail,
      "random-publisher": randomPublisherRail,
      downloads: mostDownloadedRail,
      "most-read-covers": mostReadCoverGrid
    };
    const visibleHomeKeys = normalizeHomeSectionOrder(state.homeSectionOrder).filter(key => homeSections[key]);
    state.homeVisibleSectionKeys = visibleHomeKeys;
    const orderedSections = visibleHomeKeys
      .map((key, index, visible) => decorateHomepageSection(key, homeSections[key], index, visible.length))
      .join("");
    return `
      <section class="hero">
        <div class="hero-bg" data-cover-id="${escapeHTML(heroItem?.id || "")}" data-cover-style="${escapeHTML(coverStyleFor(heroItem))}" data-cover-size="hero" style="background-image:url('${escapeHTML(coverFor(heroItem, "hero"))}')"></div>
        <div class="hero-cover" data-cover-id="${escapeHTML(heroItem?.id || "")}" data-cover-style="${escapeHTML(coverStyleFor(heroItem))}" data-cover-size="hero" data-open="${escapeHTML(heroItem?.id || "")}" data-open-direct="true" style="background-image:url('${escapeHTML(coverFor(heroItem, "hero"))}')" aria-label="Abrir quadrinho em destaque"></div>
        <div class="hero-content">
          <div class="eyebrow">Destaque da banca</div>
          <h1>${escapeHTML(heroTitle)}</h1>
          ${heroMeta ? `<div class="hero-meta">${escapeHTML(heroMeta)}</div>` : ""}
          <p class="hero-description">${escapeHTML(heroItem?.description || "Publique e descubra quadrinhos sem precisar armazenar os arquivos no servidor.")}</p><button class="hero-more" type="button" data-hero-more>Ler mais</button>
          ${heroItem ? `<button class="btn btn-primary" data-open="${escapeHTML(heroItem.id)}" data-open-direct="true">▶ Ler agora</button>` : ""}
          <button class="btn btn-secondary" data-action="random">🎲 Surpreenda-me</button>
        </div>
      </section>
      <div class="content">
        ${orderedSections}
      </div>`;
  }

  function decorateHomepageSection(key, markup, index, total) {
    if (!markup || state.profile?.plan !== "admin") return markup;
    const movableKeys = state.homeVisibleSectionKeys;
    const movableIndex = movableKeys.indexOf(key);
    const controls = `<div class="homepage-section-order-controls"><button type="button" class="small-btn" data-home-section-move="up" data-home-section-key="${escapeHTML(key)}" ${movableIndex <= 0 ? "disabled" : ""} title="Mover seção para cima" aria-label="Mover seção para cima">↑</button><button type="button" class="small-btn" data-home-section-move="down" data-home-section-key="${escapeHTML(key)}" ${movableIndex < 0 || movableIndex === movableKeys.length - 1 ? "disabled" : ""} title="Mover seção para baixo" aria-label="Mover seção para baixo">↓</button></div>`;
    if (markup.includes("data-home-section-controls-slot")) return markup.replace('<div data-home-section-controls-slot></div>', controls);
    const headStart = markup.indexOf('<div class="section-head">');
    if (headStart >= 0) {
      let depth = 0;
      let cursor = headStart;
      while (cursor < markup.length) {
        const nextOpen = markup.indexOf("<div", cursor);
        const nextClose = markup.indexOf("</div>", cursor);
        if (nextClose < 0) break;
        if (nextOpen >= 0 && nextOpen < nextClose) {
          depth += 1;
          cursor = nextOpen + 4;
        } else {
          depth -= 1;
          if (depth === 0) return `${markup.slice(0, nextClose)}${controls}${markup.slice(nextClose)}`;
          cursor = nextClose + 6;
        }
      }
    }
    const sectionOpen = markup.match(/^\s*<section\b[^>]*>/)?.[0];
    return sectionOpen ? markup.replace(sectionOpen, `${sectionOpen}<div class="homepage-section-admin">${controls}</div>`) : markup;
  }

  async function moveHomepageSection(key, direction) {
    if (!sb || state.profile?.plan !== "admin") return;
    const order = normalizeHomeSectionOrder(state.homeSectionOrder);
    const movableKeys = state.homeVisibleSectionKeys;
    const visibleIndex = movableKeys.indexOf(key);
    const visibleTarget = visibleIndex + direction;
    if (visibleIndex < 0 || visibleTarget < 0 || visibleTarget >= movableKeys.length) return;
    const targetKey = movableKeys[visibleTarget];
    const index = order.indexOf(key);
    const target = order.indexOf(targetKey);
    if (index < 0 || target < 0) return;
    [order[index], order[target]] = [order[target], order[index]];
    const persistedOrder = order;
    state.homeSectionOrder = order;
    render();
    const result = await sb.rpc("update_homepage_section_order", { p_order: persistedOrder });
    if (result.error) {
      console.error("Não foi possível persistir a ordem da home:", result.error);
      return toast(result.error.message || "A ordem foi aplicada nesta sessão, mas não pôde ser salva.");
    }
  }

  function renderCollectionsPreview() {
    if (!state.db.collections.length) return "";
    return `
      <section class="section">
        <div class="section-head">
          <h2 class="section-title">Coleções</h2>
          <button class="link-btn" data-section="collections">Ver todas →</button>
        </div>
        <div class="feature-grid">
          ${state.db.collections.slice(0,4).map(c => `
            <div class="feature-card" data-collection="${escapeHTML(c.id)}">
              <div class="cover" style="background-image:url('${escapeHTML(c.cover || "")}')"></div>
              <div class="gradient"></div>
              <div class="feature-info">
                <h3>${escapeHTML(c.title)}</h3>
                <p>${c.issueIds.length} edições</p>
              </div>
            </div>`).join("")}
        </div>
      </section>`;
  }

  function renderEntityPage() {
    const filter = state.entityFilter || { kind: "character", value: "" };
    const normalizedValue = String(filter.value || "").trim().toLowerCase();
    const allItems = state.db.library.filter(item => {
      if (filter.kind === "year") return String(item.year || "") === String(filter.value || "");
      if (filter.kind === "author") return String(item.author || "").split(/\s*(?:\/|&|\be\b)\s*/i).some(author => author.trim().toLowerCase() === normalizedValue);
      return String(item[filter.kind] || "").trim().toLowerCase() === normalizedValue && (filter.kind !== "publisher" || item.type === "comic");
    });
    const collectionFilter = state.collectionFilter || { field: "all", query: "" };
    const items = uniqueCatalogItems(filterCollectionItems(allItems, collectionFilter.field, collectionFilter.query));
    const labels = { publisher: "Editora", character: "Personagem", imprint: "Selo", author: "Autor", year: "Ano", publication: "Publicação", status: "Status" };
    const title = labels[filter.kind] || "Catálogo";
    const wikiSearch = `https://pt.wikipedia.org/wiki/Especial:Pesquisar?search=${encodeURIComponent(filter.value || "")}`;
    const wikiText = filter.kind === "year" ? `Todos os quadrinhos publicados em ${filter.value}.` : `${filter.value} aparece em ${items.length} edição(ões) do catálogo da Banca Digital.`;
    const hideWiki = ["Série Mensal", "Recentes", "Vários autores"].some(value => value.toLowerCase() === String(filter.value || "").trim().toLowerCase());
    const wikiMarkup = filter.kind === "year" || hideWiki ? "" : `<section class="entity-wiki"><div class="eyebrow">Wiki rápida</div><p>${escapeHTML(wikiText)}</p><a class="small-btn" href="${escapeHTML(wikiSearch)}" target="_blank" rel="noopener">Pesquisar na Wikipédia</a></section>`;
    if (filter.kind !== "publisher") {
      const entityCards = uniqueCatalogItems(items).map(item => filter.kind === "character" && item.seriesId ? seriesCard(item) : card(item)).join("");
      const countLabel = filter.kind === "character" ? `${items.filter(item => item.seriesId).length} série(s) · ${items.length} edição(ões)` : `${items.length} edição(ões)`;
      return `<div class="content"><div class="section-head"><div><div class="eyebrow">Explorar catálogo · ${escapeHTML(title)}</div><h1 class="section-title">${escapeHTML(filter.value)}</h1><div class="section-subtitle">${countLabel}</div></div><button class="small-btn" data-section="home">Voltar ao início</button></div>${wikiMarkup}<section class="section"><div class="results-grid">${entityCards || `<div class="empty">Nenhuma edição encontrada.</div>`}</div></section></div>`;
    }
    const setting = state.publisherSettings.get(publisherKey(filter.value));
    const canManage = ["moderator", "admin"].includes(state.profile?.plan);
    const grouped = new Map();
    const initialFor = item => { const initial = String(item.seriesTitle || item.title || "").trim().charAt(0).toUpperCase(); return /[0-9]/.test(initial) ? "0-9" : /^[A-Z]$/.test(initial) ? initial : "#"; };
    items.forEach(item => {
      const imprint = String(item.imprint || "Sem selo").trim() || "Sem selo";
      if (!grouped.has(imprint)) grouped.set(imprint, new Map());
      const initial = initialFor(item);
      if (!grouped.get(imprint).has(initial)) grouped.get(imprint).set(initial, []);
      grouped.get(imprint).get(initial).push(item);
    });
    const initialOrder = ["0-9", ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ".split(""), "#"];
    const publisherGroupMarkupLegacy = groupItems => {
      const seriesGroups = new Map();
      groupItems.forEach(item => {
        const key = item.seriesId || item.id;
        if (!seriesGroups.has(key)) seriesGroups.set(key, []);
        seriesGroups.get(key).push(item);
      });
      return [...seriesGroups.values()].sort((a, b) => String(a[0].seriesTitle || a[0].title).localeCompare(String(b[0].seriesTitle || b[0].title), "pt-BR")).map(seriesItems => {
        const seriesKey = seriesItems[0].seriesId || seriesItems[0].id;
        const expanded = Boolean(state.publisherSeriesExpanded[seriesKey]);
        const orderedItems = seriesItems.sort((a, b) => issueSortValue(a) - issueSortValue(b));
        const visibleItems = expanded ? orderedItems : orderedItems.slice(0, 1);
        return `<div class="publisher-series-group"><div class="publisher-series-heading"><h4 class="publisher-series-title">${escapeHTML(seriesItems[0].seriesTitle || seriesItems[0].title)}</h4>${orderedItems.length > 1 ? `<button class="small-btn publisher-series-toggle" type="button" data-publisher-series-toggle="${escapeHTML(seriesKey)}">${expanded ? "Ocultar edições" : `Mostrar todas (${orderedItems.length})`}</button>` : ""}</div><div class="results-grid">${visibleItems.map(item => card(item)).join("")}</div></div>`;
      }).join("");
    };
    const publisherGroupMarkup = groupItems => {
      const groupedSeries = new Map();
      groupItems.forEach(item => {
        const key = item.seriesId || item.id;
        if (!groupedSeries.has(key)) groupedSeries.set(key, item);
      });
      return [...groupedSeries.values()]
        .sort((a, b) => String(a.seriesTitle || a.title).localeCompare(String(b.seriesTitle || b.title), "pt-BR"))
        .map(item => item.seriesId ? seriesCard(item) : card(item))
        .join("");
    };
    const imprintMarkup = [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b, "pt-BR")).map(([imprint, initials]) => `<section class="search-imprint publisher-imprint"><div class="section-head"><div><h2 class="section-title">${escapeHTML(imprint)}</h2><div class="section-subtitle">Selo</div></div></div>${initialOrder.filter(initial => initials.has(initial)).map(initial => `<section class="search-initial"><h3 class="search-initial-title">${initial}</h3><div class="results-grid publisher-initial-grid">${publisherGroupMarkup(initials.get(initial))}</div></section>`).join("")}</section>`).join("");
    return `<div class="content publisher-page"><div class="section-head"><div><div class="eyebrow">Explorar catálogo · Editora</div><h1 class="section-title">${escapeHTML(filter.value)}</h1><div class="section-subtitle">${items.length} edição(ões) da editora</div></div><div class="publisher-page-actions"><button class="small-btn" data-section="home">Voltar ao início</button>${canManage ? `<button class="small-btn" data-publisher-settings="${escapeHTML(filter.value)}">Configurar editora</button>` : ""}</div></div>${wikiMarkup}${setting?.is_pinned ? '<div class="publisher-pin-badge">★ Editora fixada no carrossel</div>' : ""}${imprintMarkup || '<div class="empty">Nenhuma edição encontrada.</div>'}</div>`;
  }

  function renderLoginPage() {
    return `<div class="content auth-page"><div class="auth-card"><div class="eyebrow">Banca Digital</div><h1>Entrar</h1><p class="section-subtitle">Use seu usuário ou email e sua senha para acessar sua estante.</p><form id="auth-form"><div class="field"><label>Usuário ou email</label><input name="username" required placeholder="seu_usuario ou voce@email.com" autocomplete="username"></div><div class="field"><label>Senha</label><input name="password" type="password" required minlength="6" autocomplete="current-password"></div><div class="auth-actions"><button type="submit" class="btn btn-danger" data-auth-mode="login">Entrar</button><button type="button" class="small-btn" data-auth-switch="signup">Criar conta</button></div><button class="link-btn" type="button" data-forgot-password>Esqueci minha senha</button><div class="auth-message" id="auth-message"></div></form></div></div>`;
  }

  function openAccountPlanAdmin() {
    setTimeout(() => {
      const select = $("#account-plan-form select[name=plan]");
      if (select) {
        $("option[value=free]", select).textContent = "Comum";
        $("option[value=premium]", select).textContent = "Lenda";
      }
    }, 0);
    const overlay = document.createElement("div"); overlay.className = "modal-backdrop";
    overlay.innerHTML = `<div class="modal"><div class="section-head"><div><h2>Alterar tipo de conta</h2><div class="section-subtitle">Defina o nível de acesso da conta.</div></div><button class="small-btn" data-close>Fechar</button></div><form id="account-plan-form"><div class="form-grid"><div class="field full"><label>@ do usuário</label><input name="username" required placeholder="usuario"></div><div class="field full"><label>Novo tipo de conta</label><select name="plan"><option value="free">Free</option><option value="premium">Premium</option><option value="moderator">Moderador</option></select></div></div><div class="modal-actions"><button type="button" class="small-btn" data-close>Cancelar</button><button class="btn btn-danger">Salvar alteração</button></div></form></div>`;
    $("#modal-root").appendChild(overlay);
    $$('[data-close]', overlay).forEach(button => button.onclick = () => overlay.remove());
    $("#account-plan-form", overlay).onsubmit = async event => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const username = cleanUsername(form.get("username"));
      const plan = String(form.get("plan") || "free");
      let result = await sb.rpc("set_user_plan", { p_username: username, p_plan: plan });
      if (result.error && /set_user_plan|schema cache|function/i.test(result.error.message)) {
        const profile = await sb.from("profiles").select("id").eq("username", username).maybeSingle();
        if (!profile.data) return toast("Usuário não encontrado.");
        result = await sb.from("profiles").update({ plan }).eq("id", profile.data.id);
      }
      if (result.error) return toast(result.error.message);
      overlay.remove(); toast("Tipo de conta atualizado.");
    };
  }

  function renderSignupPage() {
    return `<div class="content auth-page"><div class="auth-card"><div class="eyebrow">Banca Digital</div><h1>Criar conta</h1><p class="section-subtitle">Crie seu acesso para salvar edições e montar sua estante.</p><form id="auth-form"><div class="field"><label>Usuário</label><input name="username" required pattern="[A-Za-z0-9_]{3,24}" placeholder="seu_usuario" autocomplete="username"></div><div class="field"><label>Email <span class="field-optional">(opcional)</span></label><input name="email" type="email" placeholder="voce@email.com" autocomplete="email"></div><div class="notice auth-notice">Sem email, não será possível recuperar sua conta caso você perca a senha. Contas gratuitas são excluídas após 30 dias de inatividade. Contas premium e admin são mantidas.</div><div class="field"><label>Senha</label><input name="password" type="password" required minlength="6" autocomplete="new-password"></div><div class="auth-actions"><button type="submit" class="btn btn-danger" data-auth-mode="signup">Criar conta</button><button type="button" class="small-btn" data-auth-switch="login">Já tenho uma conta</button></div><div class="auth-message" id="auth-message"></div></form></div></div>`;
  }

  function renderPasswordResetPage() {
    return `<div class="content auth-page"><div class="auth-card"><div class="eyebrow">Banca Digital</div><h1>Nova senha</h1><p class="section-subtitle">Escolha uma nova senha para sua conta.</p><form id="password-reset-form"><div class="field"><label>Nova senha</label><input name="password" type="password" required minlength="6"></div><div class="field"><label>Confirmar senha</label><input name="confirmation" type="password" required minlength="6"></div><button class="btn btn-danger">Salvar nova senha</button><div class="auth-message" id="auth-message"></div></form></div></div>`;
  }

  function localFileCard(file) {
    return `<article class="card local-file-card" data-local-open="${escapeHTML(file.id)}"><div class="cover local-file-cover" data-cover-id="${escapeHTML(file.id)}" style="background-image:url('${escapeHTML(coverFor(file))}')"><span class="local-file-icon">▣</span></div><div class="card-body"><div class="card-title">${escapeHTML(file.title)}</div><div class="card-meta">${escapeHTML(file.format.toUpperCase())} · somente nesta sessão</div></div></article>`;
  }

  function renderLocalBoxPage() {
    if (!state.session) return renderLoginPage();
    const files = state.localBoxFiles;
    return `<div class="content local-box-page"><div class="section-head"><div><div class="eyebrow">Área privada</div><h1 class="section-title">Minha caixa</h1><div class="section-subtitle">Arquivos locais para ler no navegador</div></div><button class="small-btn" data-section="shelf">Voltar à estante</button></div><div class="notice local-box-notice"><b>Privacidade:</b> os arquivos são armazenados apenas neste navegador, na memória desta sessão. Eles não são enviados para o servidor e desaparecem quando você sair da conta ou fechar a página.</div><div class="local-upload-grid"><label class="local-upload-card"><span class="local-upload-icon">▣</span><strong>Enviar uma pasta</strong><span>Adicione vários quadrinhos de uma vez. Eles aparecerão nesta aba.</span><input id="local-folder-input" type="file" webkitdirectory directory multiple accept=".pdf,.cbz,.cbr,.jpg,.jpeg,.png,.webp,.gif"></label><label class="local-upload-card"><span class="local-upload-icon">＋</span><strong>Enviar um arquivo</strong><span>Abre diretamente no leitor e é descartado ao fechá-lo.</span><input id="local-file-input" type="file" accept=".pdf,.cbz,.cbr,.jpg,.jpeg,.png,.webp,.gif"></label></div><section class="section"><div class="section-head"><div><h2 class="section-title">Arquivos da pasta</h2><div class="section-subtitle">${files.length} arquivo(s) nesta sessão</div></div>${files.length ? '<button class="small-btn" data-action="clear-local-box">Limpar caixa</button>' : ''}</div><div class="results-grid">${files.map(localFileCard).join("") || '<div class="empty">Escolha uma pasta para começar sua leitura local.</div>'}</div></section></div>`;
  }

  const SHELF_PREVIEW_LIMIT = 6;

  const SHELF_SORT_OPTIONS = [
    ["added_desc", "Último adicionado primeiro"], ["added_asc", "Primeiro adicionado primeiro"],
    ["title_asc", "Ordem alfabética crescente"], ["title_desc", "Ordem alfabética decrescente"],
    ["likes_desc", "Mais curtidos primeiro"], ["likes_asc", "Menos curtidos primeiro"],
    ["reads_desc", "Mais lidos primeiro"], ["reads_asc", "Menos lidos primeiro"],
    ["year_desc", "Ano: mais recente"], ["year_asc", "Ano: mais antigo"]
  ];

  function sortShelfItems(items, sortOrder = "added_desc", addedAtMap = null, progressMap = state.readingProgress) {
    const source = items.map((item, index) => ({ item, index }));
    const mapValue = (map, id) => map?.get?.(id) || map?.get?.(String(id)) || "";
    const titleValue = item => itemDisplayTitle(item).toLocaleLowerCase("pt-BR");
    const timestampValue = (item, index) => {
      const raw = mapValue(addedAtMap, item.id) || mapValue(progressMap, item.id)?.updated_at;
      const parsed = raw ? new Date(raw).getTime() : NaN;
      return Number.isFinite(parsed) ? parsed : index;
    };
    return source.sort((a, b) => {
      if (sortOrder === "title_asc" || sortOrder === "title_desc") {
        const result = titleValue(a.item).localeCompare(titleValue(b.item), "pt-BR", { sensitivity: "base" });
        return sortOrder === "title_desc" ? -result : result;
      }
      if (sortOrder === "likes_asc" || sortOrder === "likes_desc") {
        const result = (state.comicLikeCounts.get(a.item.id) || 0) - (state.comicLikeCounts.get(b.item.id) || 0);
        return sortOrder === "likes_desc" ? -result : result;
      }
      if (sortOrder === "reads_asc" || sortOrder === "reads_desc") {
        const result = (Number(a.item.clicks) || 0) - (Number(b.item.clicks) || 0);
        return sortOrder === "reads_desc" ? -result : result;
      }
      if (sortOrder === "year_asc" || sortOrder === "year_desc") {
        const result = (Number(a.item.year) || 0) - (Number(b.item.year) || 0) || titleValue(a.item).localeCompare(titleValue(b.item), "pt-BR");
        return sortOrder === "year_desc" ? -result : result;
      }
      const hasTimestamps = source.some(entry => mapValue(addedAtMap, entry.item.id) || mapValue(progressMap, entry.item.id)?.updated_at);
      if (!hasTimestamps) return sortOrder === "added_asc" ? a.index - b.index : b.index - a.index;
      const result = timestampValue(a.item, a.index) - timestampValue(b.item, b.index);
      return sortOrder === "added_asc" ? result : -result;
    }).map(entry => entry.item);
  }

  function shelfSortSelectMarkup(key, selected) {
    if (state.section !== "shelf" || !state.session) return "";
    return `<label class="shelf-sort-control"><span>Ordenar</span><select data-shelf-sort="${escapeHTML(key)}">${SHELF_SORT_OPTIONS.map(([value, label]) => `<option value="${value}" ${selected === value ? "selected" : ""}>${label}</option>`).join("")}</select></label>`;
  }

  function shelfCollectionMarkup(title, items, key, progressMap = state.readingProgress, favoriteIds = state.favoriteIds, actions = "", coverChoices = null, renderSeriesCards = false) {
    const expanded = Boolean(state.shelfExpanded[key]);
    const fixedCollection = ["saved", "series-saved", "read", "completed", "liked", "public-saved", "public-series-saved", "public-read", "public-completed", "public-liked"].includes(key)
      || key.startsWith("category:")
      || key.startsWith("public-category:");
    const publicState = state.section === "public-profile" ? state.publicProfile : null;
    const sortOrders = publicState?.profile?.shelf_sort_orders || state.collectionSortOrders || {};
    const sortCategoryId = key.startsWith("public-category:") ? key.slice("public-category:".length) : "";
    const publicCategorySortOrder = sortCategoryId ? publicState?.collections?.find(category => category.id === sortCategoryId)?.sortOrder : "";
    const sortOrder = sortOrders[key] || sortOrders[key.replace(/^public-/, "")] || publicCategorySortOrder || "added_desc";
    const addedAtMap = key === "saved" || key === "series-saved" || key === "public-saved" || key === "public-series-saved"
      ? (publicState?.favoriteAddedAt || state.favoriteAddedAt)
      : key === "liked" || key === "public-liked"
        ? (publicState?.comicLikeAddedAt || state.comicLikeAddedAt)
        : null;
    const orderedItems = sortShelfItems(items, sortOrder, addedAtMap, progressMap);
    const visibleItems = fixedCollection || expanded ? orderedItems : orderedItems.slice(0, SHELF_PREVIEW_LIMIT);
    const likedCollection = key === "read" && state.section === "shelf" ? shelfCollectionMarkup("Curtidas", shelfItemsByIds([...state.comicLikeIds]), "liked") : "";
    const directOpen = state.section === "shelf" || (state.section === "public-profile" && state.publicProfile?.collectionId);
    const publicCategoryId = key.startsWith("public-category:") ? key.slice("public-category:".length) : "";
    const publicCategory = publicCategoryId ? state.publicProfile?.collections?.find(category => category.id === publicCategoryId) : null;
    const featureAction = shelfSortSelectMarkup(key, sortOrder) + (publicCategory && ["moderator", "admin"].includes(state.profile?.plan)
      ? `<button class="small-btn" data-collection-feature="${escapeHTML(publicCategory.id)}" data-collection-featured="${publicCategory.is_featured ? "true" : "false"}">${publicCategory.is_featured ? "Remover destaque" : "Destacar"}</button>`
      : "");
    return `<section class="section shelf-collection${fixedCollection ? " shelf-fixed-collection" : ""}"><div class="section-head"><div><h2 class="section-title">${escapeHTML(title)}</h2><div class="section-subtitle">${items.length} item(ns)</div></div><div class="shelf-section-actions">${actions}${featureAction}${!fixedCollection && items.length > SHELF_PREVIEW_LIMIT ? `<button class="small-btn" data-shelf-expand="${escapeHTML(key)}">${expanded ? "Mostrar menos" : "Ver todos"}</button>` : ""}</div></div><div class="results-grid${fixedCollection ? " shelf-fixed-grid" : ""}">${visibleItems.map(item => renderSeriesCards && item.seriesId ? seriesCard(item, favoriteIds) : card(item, progressMap, favoriteIds, directOpen, coverChoices)).join("") || '<div class="empty">Nenhum item nesta coleção.</div>'}</div></section>${likedCollection}`;
  }

  function isSeriesId(id) {
    const value = String(id || "");
    return (window.DEFAULT_SERIES || []).some(series => series.id === value)
      || state.db.library.some(item => item.id === value && item.seriesId === value);
  }

  function shelfItemsByIds(ids, unique = false) {
    const items = [];
    const seen = new Set();
    ids.forEach(rawId => {
      const id = String(rawId);
      const item = state.db.library.find(entry => String(entry.id) === id);
      const seriesItem = item || (isSeriesId(id) ? state.db.library.find(entry => String(entry.seriesId) === id) : null);
      if (seriesItem && !seen.has(seriesItem.id)) { seen.add(seriesItem.id); items.push(seriesItem); }
    });
    return unique ? uniqueCatalogItems(items) : items;
  }

  function publicCollectionItems(category, publicState) {
    return shelfItemsByIds(category.itemIds || []).filter(item => publicState.favoriteIds.has(item.id) || (item.seriesId && publicState.favoriteIds.has(item.seriesId)));
  }

  function profileWallMarkup(profileState, own = false) {
    const profile = own ? state.profile : profileState.profile;
    const comments = own ? state.wallComments : (profileState.wallComments || []);
    const renderComment = (comment, reply = false) => {
      const author = comment.profiles || {};
      return '<article class="profile-wall-comment"><div class="comment-author-row">' + avatarMarkup(author, "comment-avatar") + '<div class="comment-author-info"><b>' + factionDot(author) + '@' + escapeHTML(author.username || "usuário") + '</b></div><time class="comment-date">' + escapeHTML(formatCommentDate(comment.created_at)) + '</time></div><p>' + escapeHTML(comment.body) + '</p></article>';
    };
    const commentMarkup = comments.map(comment => renderComment(comment, Boolean(comment.parent_id))).join("");
    return '<section class="section profile-wall"><div class="section-head"><div><h2 class="section-title">Mural</h2><div class="section-subtitle">Uma apresentação e comentários do perfil.</div></div>' + (own ? '<button class="small-btn" data-action="profile">Editar descrição</button>' : "") + '</div><div class="profile-wall-description">' + (profile?.wall_description ? escapeHTML(profile.wall_description) : '<span class="section-subtitle">Este perfil ainda não adicionou uma descrição.</span>') + '</div>' + (state.session ? '<form class="comment-form profile-wall-comment-form" data-profile-wall-comment-form><textarea name="body" maxlength="1000" required placeholder="Escreva um comentário..."></textarea><button class="small-btn" type="submit">Comentar</button></form>' : '<p class="section-subtitle">Entre para comentar.</p>') + '<div class="section-head profile-wall-comments-head"><div><h3 class="section-title">Comentários do perfil</h3><div class="section-subtitle">' + comments.length + ' comentário(s)</div></div></div><div class="profile-wall-comments">' + (commentMarkup || '<div class="empty">Nenhum comentário neste mural.</div>') + '</div></section>';
  }

  function savedPublicCollectionsMarkup(collections = []) {
    return '<section class="section saved-public-collections"><div class="section-head"><div><h2 class="section-title">Públicas salvas</h2><div class="section-subtitle">Coleções públicas salvas por este perfil.</div></div></div><div class="public-collections-grid">' + (collections.map(collection => publicCollectionCard(collection)).join("") || '<div class="empty">Nenhuma coleção pública salva.</div>') + '</div></section>';
  }

  function savedPublishersMarkup(publishers = []) {
    return `<section class="section saved-publishers"><div class="section-head"><div><h2 class="section-title">Editoras salvas</h2><div class="section-subtitle">Editoras acompanhadas por este perfil.</div></div></div><div class="saved-publishers-list">${publishers.map(publisher => `<article class="saved-publisher-card"><strong>${escapeHTML(publisher.publisher_name)}</strong><button class="small-btn" type="button" data-publisher="${escapeHTML(publisher.publisher_name)}">Abrir editora</button></article>`).join("") || '<div class="empty">Nenhuma editora salva.</div>'}</div></section>`;
  }

  async function togglePublisherSave(button) {
    if (!state.session) return openAuthPage();
    const publisherName = String(button.dataset.savePublisher || "").trim();
    const key = publisherKey(publisherName);
    if (!publisherName || !key) return;
    const saved = state.savedPublisherKeys.has(key);
    const result = saved
      ? await sb.from("publisher_saves").delete().eq("user_id", state.session.user.id).eq("publisher_key", key)
      : await sb.from("publisher_saves").insert({ user_id: state.session.user.id, publisher_key: key, publisher_name: publisherName });
    if (result.error) return toast(result.error.message || "Não foi possível atualizar a editora salva.");
    if (saved) {
      state.savedPublisherKeys.delete(key);
      state.savedPublishers = state.savedPublishers.filter(publisher => publisher.publisher_key !== key);
    } else {
      const publisher = { publisher_key: key, publisher_name: publisherName };
      state.savedPublisherKeys.add(key);
      state.savedPublishers = [publisher, ...state.savedPublishers];
    }
    render();
  }

  function publicProfileActivityMarkup(profileState) {
    const activities = profileState?.activity || [];
    const activityMarkup = activities.map(activity => `<article class="profile-activity-item"><span class="profile-activity-icon">${activity.icon}</span><div class="profile-activity-copy"><div><strong>${escapeHTML(activity.label)}</strong> ${activity.href ? `<a href="${escapeHTML(activity.href)}">${escapeHTML(activity.subject)}</a>` : `<span>${escapeHTML(activity.subject)}</span>`}</div>${activity.detail ? `<p>${escapeHTML(activity.detail)}</p>` : ""}<time datetime="${escapeHTML(activity.created_at)}">${escapeHTML(formatCommentDate(activity.created_at))}</time></div></article>`).join("");
    return `<section class="section profile-activity"><div class="section-head"><div><h2 class="section-title">Histórico</h2><div class="section-subtitle">Atividades recentes de @${escapeHTML(profileState?.profile?.username || "usuário")}.</div></div></div><div class="profile-activity-list">${activityMarkup || '<div class="empty">Nenhuma atividade pública registrada.</div>'}</div></section>`;
  }

  function followSummary(profileId, followerCount, followingCount) {
    return `<div class="profile-follow-summary"><button class="profile-follow-link" data-follow-list="followers" data-follow-profile-id="${escapeHTML(profileId)}">${followerCount || 0} seguidores</button><span> · </span><button class="profile-follow-link" data-follow-list="following" data-follow-profile-id="${escapeHTML(profileId)}">${followingCount || 0} seguindo</button></div>`;
  }

  async function openFollowList(kind, profileId) {
    if (!sb || !profileId) return toast("A lista de seguidores ainda não está disponível.");
    const isFollowers = kind === "followers";
    const relation = isFollowers
      ? await sb.from("profile_follows").select("follower_id").eq("following_id", profileId)
      : await sb.from("profile_follows").select("following_id").eq("follower_id", profileId);
    if (relation.error) return toast("Não foi possível carregar essa lista.");
    const ids = (relation.data || []).map(row => isFollowers ? row.follower_id : row.following_id).filter(Boolean);
    const profiles = ids.length ? await sb.from("profiles").select("id, username, avatar_url, title, plan, faction_id").in("id", ids) : { data: [] };
    if (profiles.error) return toast("Não foi possível carregar os perfis.");
    const byId = new Map((profiles.data || []).map(profile => [profile.id, profile]));
    const title = isFollowers ? "Seguidores" : "Seguindo";
    const overlay = document.createElement("div");
    overlay.className = "modal-backdrop";
    overlay.innerHTML = `<div class="modal follow-list-modal"><div class="section-head"><div><h2>${title}</h2><div class="section-subtitle">${ids.length} perfil(is)</div></div><button class="small-btn" data-close>Fechar</button></div><div class="follow-list">${ids.map(id => { const profile = byId.get(id); return profile ? `<a class="follow-list-item" href="${escapeHTML(publicProfileHref(profile.username))}">${avatarMarkup(profile, "follow-list-avatar")}<span><b>${factionDot(profile)}@${escapeHTML(profile.username)}</b>${profile.title ? `<small>${escapeHTML(profile.title)}</small>` : ""}</span></a>` : ""; }).join("") || '<div class="empty">Nenhum perfil nesta lista.</div>'}</div></div>`;
    $("#modal-root").appendChild(overlay);
    $("[data-close]", overlay).onclick = () => overlay.remove();
  }

  const CHAT_ROOMS = [
    { id: "geral", name: "Chat Geral", access: "public" },
    { id: "decenautas", name: "Decenautas", access: "public" },
    { id: "marvetes", name: "Marvetes", access: "public" },
    { id: "leitores-colecionadores", name: "Leitores e Colecionadores", access: "premium" },
    { id: "staff", name: "Chat da Staff", access: "staff" },
    { id: "faccao-aurora-rubra", name: "Maravilhas", access: "public", factionId: "aurora-rubra" },
    { id: "faccao-vigilia-cobalto", name: "Legado", access: "public", factionId: "vigilia-cobalto" },
    { id: "faccao-forja-dourada", name: "Ruptura", access: "public", factionId: "forja-dourada" },
    { id: "faccao-nevoa-violeta", name: "Horizonte", access: "public", factionId: "nevoa-violeta" }
  ];

  function canOpenChatRoom(room) {
    if (room.factionId) return ["moderator", "admin"].includes(state.profile?.plan) || state.profile?.faction_id === room.factionId;
    return room.access === "public"
      || (room.access === "premium" && ["premium", "admin"].includes(state.profile?.plan))
      || (room.access === "staff" && ["moderator", "admin"].includes(state.profile?.plan));
  }

  function chatRoomLabel(room) {
    return room.access === "premium" ? "Lenda" : room.access === "staff" ? "Staff" : "Público";
  }

  async function loadChatSenderVisuals(senderIds) {
    const ids = [...new Set(senderIds.filter(Boolean))];
    const visuals = new Map(ids.map(id => [id, { coverChoices: new Map(), coverStyles: new Map() }]));
    if (!ids.length || !sb) return visuals;
    const [choicesResult, stylesResult] = await Promise.all([
      sb.from("user_cover_choices").select("user_id, item_id, variant_key, cover_url").in("user_id", ids),
      sb.from("user_cover_styles").select("user_id, item_id, style").in("user_id", ids)
    ]);
    (choicesResult.data || []).forEach(choice => visuals.get(choice.user_id)?.coverChoices.set(choice.item_id, choice));
    (stylesResult.data || []).forEach(style => visuals.get(style.user_id)?.coverStyles.set(style.item_id, style.style));
    return visuals;
  }

  function chatBodyMarkup(body, metadata = {}, senderVisual = null) {
    const mentionMarkup = text => escapeHTML(String(text || "")).replace(/@([A-Za-z0-9_]{3,24})/g, (match, mentionedUsername) => `<a class="comment-mention" href="${escapeHTML(publicProfileHref(mentionedUsername))}" target="_blank" rel="noopener">${match}</a>`);
    const sharedPreviews = Array.isArray(metadata?.comic_previews) ? metadata.comic_previews : [];
    const comicPreview = rawUrl => {
      const cleanUrl = String(rawUrl || "").replace(/[),.!?;:]+$/g, "");
      let parsed;
      try { parsed = new URL(cleanUrl, window.location.href); } catch { return null; }
      if (parsed.origin !== window.location.origin) return null;
      const itemId = parsed.searchParams.get("ler");
      const item = itemId ? state.db.library.find(entry => String(entry.id) === String(itemId) && entry.type === "comic") : null;
      if (!item) return null;
      const sharedPreview = sharedPreviews.find(preview => preview?.url === cleanUrl || String(preview?.item_id) === String(item.id));
      const senderChoice = senderVisual?.coverChoices?.get(item.id);
      const sharedCoverUrl = senderChoice?.cover_url || sharedPreview?.cover_url || parsed.searchParams.get("capa_url");
      const sharedVariantKey = senderChoice?.variant_key || sharedPreview?.variant_key || parsed.searchParams.get("capa");
      const sharedVariant = usableCoverVariants(item).find(variant => variant.variant_key === sharedVariantKey);
      const sharedCover = /^https?:\/\//i.test(sharedCoverUrl || "") ? sharedCoverUrl : sharedVariant?.cover_url;
      const hasSharedAppearance = parsed.searchParams.has("capa") || parsed.searchParams.has("capa_url") || parsed.searchParams.has("efeito");
      const defaultCover = item.coverUrl || item.cover || instantCover(item);
      const previewCover = sharedCover ? proxiedImageUrl(sharedCover) : hasSharedAppearance ? proxiedImageUrl(defaultCover) : coverFor(item);
      const senderStyle = senderVisual?.coverStyles?.get(item.id) || (item.seriesId && senderVisual?.coverStyles?.get(item.seriesId));
      const requestedStyle = sharedPreview?.cover_style || senderStyle || parsed.searchParams.get("efeito");
      // No chat, nunca consultar o estado visual de quem recebe.
      const coverStyle = ["normal", "grayscale", "gold"].includes(requestedStyle) ? requestedStyle : "normal";
      const title = itemDisplayTitle(item) || item.title || "Quadrinho";
      const year = item.year ? ` · ${item.year}` : "";
      return `<a class="chat-comic-preview" href="${escapeHTML(cleanUrl)}" target="_blank" rel="noopener"><div class="chat-comic-preview-cover" data-cover-style="${escapeHTML(coverStyle)}" style="background-image:url('${escapeHTML(previewCover)}')"></div><span class="chat-comic-preview-copy"><b>${escapeHTML(title)}</b><small>${escapeHTML(year.replace(/^ · /, ""))}</small></span></a>`;
    };
    const source = String(body || "");
    const urlPattern = /https?:\/\/[^\s<]+/gi;
    let output = "";
    let cursor = 0;
    for (const match of source.matchAll(urlPattern)) {
      output += mentionMarkup(source.slice(cursor, match.index));
      output += comicPreview(match[0]) || mentionMarkup(match[0]);
      cursor = match.index + match[0].length;
    }
    return output + mentionMarkup(source.slice(cursor));
  }

  function chatMessageMarkup(message, profile = {}, senderVisual = null) {
    const username = cleanUsername(profile.username || "usuário");
    const title = String(profile.title || "").trim();
    const reply = message.metadata?.reply_to;
    const replyMarkup = reply?.body ? `<div class="chat-message-reply"><b>Respondendo a @${escapeHTML(cleanUsername(reply.username || "usuario"))}</b><span>${escapeHTML(String(reply.body).slice(0, 180))}</span></div>` : "";
    return `<div class="chat-message ${message.sender_id === state.session.user.id ? "is-mine" : ""}" data-chat-message-id="${escapeHTML(message.id || "")}"><button type="button" class="chat-reply-action" data-chat-reply="${escapeHTML(message.id || "")}" aria-label="Responder esta mensagem" title="Responder">↩</button><a class="chat-message-author" href="${escapeHTML(publicProfileHref(username))}" target="_blank" rel="noopener">${avatarMarkup({ ...profile, username }, "chat-message-avatar")}<span><b>${factionDot(profile)}@${escapeHTML(username)}</b>${title ? `<em style="--title-bg:${safeTitleColor(profile.title_color)}">${escapeHTML(title)}</em>` : ""}</span></a>${replyMarkup}<div>${chatBodyMarkup(message.body, message.metadata, senderVisual)}</div><small>${escapeHTML(formatCommentDate(message.created_at))}</small></div>`;
  }

  function setupChatReplyUI({ messagesRoot, compose, input, getMessage }) {
    if (!messagesRoot || !compose || !input) {
      const noReply = () => null;
      noReply.clear = () => {};
      return noReply;
    }
    let selectedMessage = null;
    let preview = $(".chat-reply-preview", compose);
    if (!preview) {
      preview = document.createElement("div");
      preview.className = "chat-reply-preview";
      preview.hidden = true;
      preview.innerHTML = `<span></span><button type="button" aria-label="Cancelar resposta">×</button>`;
      compose.insertBefore(preview, compose.firstChild);
    }
    const update = () => {
      preview.hidden = !selectedMessage;
      if (selectedMessage) {
        $("span", preview).innerHTML = `<b>Respondendo a @${escapeHTML(cleanUsername(selectedMessage.profile?.username || "usuario"))}</b> ${escapeHTML(String(selectedMessage.body || "").slice(0, 160))}`;
        input.focus();
      }
    };
    const choose = id => { const message = getMessage(id); if (message) { selectedMessage = message; update(); } };
    $("button", preview).onclick = () => { selectedMessage = null; update(); input.focus(); };
    messagesRoot.addEventListener("click", event => { const button = event.target.closest("[data-chat-reply]"); if (button) choose(button.dataset.chatReply); });
    let touchStartX = 0;
    let touchMessage = null;
    messagesRoot.addEventListener("touchstart", event => { const message = event.target.closest(".chat-message[data-chat-message-id]"); if (!message || event.touches.length !== 1) return; touchMessage = message; touchStartX = event.touches[0].clientX; message.classList.add("is-swiping"); }, { passive: true });
    messagesRoot.addEventListener("touchmove", event => { if (!touchMessage || event.touches.length !== 1) return; const distance = Math.max(0, Math.min(92, event.touches[0].clientX - touchStartX)); touchMessage.style.setProperty("--chat-swipe-x", `${distance}px`); }, { passive: true });
    messagesRoot.addEventListener("touchend", () => { if (!touchMessage) return; const message = touchMessage; const distance = parseFloat(getComputedStyle(message).getPropertyValue("--chat-swipe-x")) || 0; message.classList.remove("is-swiping"); message.style.removeProperty("--chat-swipe-x"); if (distance >= 64) choose(message.dataset.chatMessageId); touchMessage = null; }, { passive: true });
    const getReply = () => selectedMessage ? { id: selectedMessage.id, body: selectedMessage.body, username: selectedMessage.profile?.username || "usuario" } : null;
    getReply.clear = () => { selectedMessage = null; update(); };
    return getReply;
  }

  async function openChatRoom(room) {
    await markChatMentionsRead(room?.id);
    await loadNotifications();
    if (!state.session || !sb || !room || !canOpenChatRoom(room)) return toast("Você não tem acesso a esta sala.");
    $$('.chat-modal').forEach(modal => modal.closest('.modal-backdrop')?.remove());
    const overlay = document.createElement("div");
    overlay.className = "modal-backdrop";
    overlay.innerHTML = `<div class="modal chat-modal"><div class="section-head"><div><h2>${escapeHTML(room.name)}</h2><div class="section-subtitle">Sala ${chatRoomLabel(room).toLowerCase()} · mensagens expiram em 24 horas</div></div><div class="chat-modal-actions"><button class="small-btn" type="button" data-chat-back>Voltar</button><button class="small-btn" type="button" data-close>Fechar</button></div></div><div class="chat-messages" data-chat-messages><div class="empty">Carregando mensagens...</div></div><form class="chat-compose" id="chat-room-compose"><textarea name="body" maxlength="2000" rows="2" required placeholder="Escreva uma mensagem ou marque alguém com @usuario"></textarea><button type="submit" class="btn btn-danger">Enviar</button></form></div>`;
    $("#modal-root").appendChild(overlay);
    if (room.factionId && ["moderator", "admin"].includes(state.profile?.plan)) $("#chat-room-compose", overlay)?.remove();
    let closed = false;
    let channel = null;
    const close = event => {
      event?.preventDefault();
      event?.stopPropagation();
      if (closed) return;
      closed = true;
      channel?.unsubscribe();
      overlay.remove();
    };
    $("[data-close]", overlay).onclick = close;
    $("[data-chat-back]", overlay).onclick = event => { close(event); openChat(); };
    overlay.addEventListener("click", event => {
      if (event.target === overlay) close(event);
    });
    const messagesRoot = $("[data-chat-messages]", overlay);
    const chatInput = $("#chat-room-compose textarea", overlay);
    let chatMessagesById = new Map();
    const resizeChatInput = () => {
      if (!chatInput) return;
      chatInput.style.height = "auto";
      chatInput.style.height = `${chatInput.scrollHeight}px`;
    };
    const renderMessages = async () => {
      const result = await sb.from("chat_messages").select("id, sender_id, body, metadata, created_at, profiles!chat_messages_sender_id_fkey(username, avatar_url, title, title_color, plan, faction_id)").eq("room_id", room.id).gt("expires_at", new Date().toISOString()).order("created_at", { ascending: true }).limit(200);
      if (result.error) return messagesRoot.innerHTML = '<div class="empty">Não foi possível carregar as mensagens.</div>';
      const senderVisuals = await loadChatSenderVisuals((result.data || []).map(message => message.sender_id));
      chatMessagesById = new Map((result.data || []).map(message => [String(message.id), { ...message, profile: message.profiles || {} }]));
      messagesRoot.innerHTML = (result.data || []).map(message => chatMessageMarkup(message, message.profiles || {}, senderVisuals.get(message.sender_id))).join("") || '<div class="empty">Nenhuma mensagem ainda.</div>';
      messagesRoot.scrollTop = messagesRoot.scrollHeight;
    };
    await renderMessages();
    channel = sb.channel(`chat-room-${room.id}-${state.session.user.id}`).on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages", filter: `room_id=eq.${room.id}` }, payload => { if (payload.new?.room_id === room.id) renderMessages(); }).subscribe();
    const chatCompose = $("#chat-room-compose", overlay);
    const getReply = setupChatReplyUI({ messagesRoot, compose: chatCompose, input: chatInput, getMessage: id => chatMessagesById.get(String(id)) });
    if (chatCompose) chatCompose.onsubmit = async event => {
      event.preventDefault();
      const composeForm = event.currentTarget;
      const form = new FormData(composeForm);
      const prepared = prepareChatMessage(String(form.get("body") || "").trim());
      const body = prepared.body;
      const reply = getReply();
      const button = $("button[type=submit]", composeForm);
      if (!body || button.disabled) return;
      button.disabled = true;
      const result = await sb.from("chat_messages").insert({ sender_id: state.session.user.id, room_id: room.id, recipient_id: null, body, metadata: { ...prepared.metadata, ...(reply ? { reply_to: reply } : {}) }, expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() });
      if (result.error) { console.error("[chat room] erro ao enviar mensagem", result.error); toast(result.error.message || "Não foi possível enviar a mensagem."); }
      else { awardProfileXp("chat", `chat:${Date.now()}`); composeForm.reset(); getReply.clear(); await renderMessages(); }
      button.disabled = false;
    };
    chatInput?.addEventListener("keydown", event => {
      if (event.key !== "Enter" || event.shiftKey || event.isComposing) return;
      event.preventDefault();
      chatCompose?.requestSubmit();
    });
  }

  async function openChat(contact = null) {
    $$('.notifications-popup-modal').forEach(modal => modal.closest('.modal-backdrop')?.remove());
    $$('.chat-modal').forEach(modal => modal.closest('.modal-backdrop')?.remove());
    if (!state.session || !sb) return openAuthPage();
    if (contact?.id === state.session.user.id) return toast("Você não pode enviar mensagens para si mesmo.");
    if (contact?.id && contact.allow_messages === false) return toast("Este usuário não está recebendo mensagens privadas.");
    if (contact?.id && contact.allow_messages === undefined) {
      const recipient = await sb.from("profiles").select("allow_messages").eq("id", contact.id).maybeSingle();
      if (recipient.data?.allow_messages === false) return toast("Este usuário não está recebendo mensagens privadas.");
    }
    state.chatContact = contact?.id ? contact : null;
    if (contact?.id) {
      state.notifications = state.notifications.filter(notification => !isNotificationFromOpenChat(notification));
      state.notificationUnreadCount = state.notifications.filter(notification => !notification.read_at).length;
    }
    if (contact?.id) await markChatNotificationsRead(contact.id);
    await loadNotifications();
    render();
    const overlay = document.createElement("div");
    overlay.className = "modal-backdrop";
    overlay.innerHTML = `<div class="modal chat-modal"><div class="section-head"><div><h2>Mensagens</h2><div class="section-subtitle">As mensagens desaparecem após 24 horas.</div></div><div class="chat-modal-actions">${contact ? `<button class="small-btn" type="button" data-chat-back>Voltar</button>` : ""}<button class="small-btn" data-close>Fechar</button></div></div><div class="chat-contact-picker">${contact ? `<div class="chat-contact-selected">Conversando com <b>@${escapeHTML(contact.username)}</b></div>` : `<form id="chat-contact-form"><input name="username" required placeholder="Nome de usuário"><button type="submit" class="small-btn">Abrir conversa</button></form>`}</div>${contact ? `<div class="chat-messages" data-chat-messages><div class="empty">Carregando mensagens...</div></div><form class="chat-compose" id="chat-compose"><textarea name="body" maxlength="2000" rows="2" required placeholder="Escreva uma mensagem"></textarea><button type="submit" class="btn btn-danger">Enviar</button></form>` : `<div class="notice">Abra o perfil de um usuário e clique em “Enviar mensagem”, ou pesquise o nome de usuário acima.</div><div class="chat-private-list" data-private-chat-list hidden></div>`}</div>`;
    $("#modal-root").appendChild(overlay);
    let channel = null;
    let closed = false;
    const close = event => {
      event?.preventDefault();
      event?.stopPropagation();
      if (closed) return;
      closed = true;
      state.chatContact = null;
      channel?.unsubscribe();
      overlay.remove();
      loadNotifications().then(() => render());
    };
    $("[data-close]", overlay).onclick = close;
    $("[data-chat-back]", overlay)?.addEventListener("click", event => { close(event); openChat(); });
    overlay.addEventListener("click", event => {
      if (event.target === overlay) close(event);
    });
    if (!contact) {
      const availableRooms = CHAT_ROOMS.filter(canOpenChatRoom);
      $(".chat-contact-picker", overlay).insertAdjacentHTML("afterbegin", `<div class="chat-room-list"><div class="chat-room-list-title">Salas de conversa</div>${availableRooms.map(room => { const unread = state.chatRoomUnreadCounts?.[room.id] || 0; return `<button type="button" class="chat-room-option" data-chat-room="${escapeHTML(room.id)}"><span>${escapeHTML(room.name)}</span>${unread ? `<span class="message-badge" aria-label="${unread} marcação(ões) não lida(s)">${unread > 99 ? "99+" : unread}</span>` : ""}<small>${chatRoomLabel(room)}</small></button>`; }).join("")}</div>`);
      $$('[data-chat-room]', overlay).forEach(button => button.onclick = () => { overlay.remove(); openChatRoom(CHAT_ROOMS.find(room => room.id === button.dataset.chatRoom)); });
      const privateChatList = $("[data-private-chat-list]", overlay);
      const privateMessages = await sb.from("chat_messages")
        .select("id, sender_id, recipient_id, body, created_at")
        .or(`sender_id.eq.${state.session.user.id},recipient_id.eq.${state.session.user.id}`)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(500);
      const conversations = new Map();
      (privateMessages.data || []).forEach(message => {
        const incoming = String(message.recipient_id) === String(state.session.user.id);
        const contactId = incoming ? message.sender_id : message.recipient_id;
        if (!contactId) return;
        const conversation = conversations.get(contactId) || { latest: message, hasIncoming: false };
        conversation.hasIncoming ||= incoming;
        if (new Date(message.created_at) > new Date(conversation.latest.created_at)) conversation.latest = message;
        conversations.set(contactId, conversation);
      });
      const contactIds = [...conversations.entries()].filter(([, conversation]) => conversation.hasIncoming).map(([id]) => id);
      if (contactIds.length) {
        const profilesResult = await sb.from("profiles").select("id, username, avatar_url, title, title_color, allow_messages").in("id", contactIds);
        const profiles = new Map((profilesResult.data || []).map(profile => [profile.id, profile]));
        const cards = contactIds.map(contactId => {
          const profile = profiles.get(contactId);
          const conversation = conversations.get(contactId);
          if (!profile || !conversation) return "";
          return `<button type="button" class="chat-private-card" data-private-chat-user="${escapeHTML(profile.id)}">${avatarMarkup(profile, "chat-private-card-avatar")}<span class="chat-private-card-copy"><b>${factionDot(profile)}@${escapeHTML(profile.username)}</b><small>${escapeHTML(conversation.latest.body.slice(0, 100))}</small></span><time>${escapeHTML(formatCommentDate(conversation.latest.created_at))}</time></button>`;
        }).join("");
        if (cards) {
          privateChatList.hidden = false;
          privateChatList.innerHTML = `<div class="chat-room-list-title">Conversas recentes</div><div class="chat-private-card-list">${cards}</div>`;
          $$('[data-private-chat-user]', privateChatList).forEach(button => button.onclick = () => {
            const contact = profiles.get(button.dataset.privateChatUser);
            if (!contact) return;
            overlay.remove();
            openChat(contact);
          });
        }
      }
      $("#chat-contact-form", overlay).onsubmit = async event => {
        event.preventDefault();
        const username = String(new FormData(event.currentTarget).get("username") || "").trim();
        if (!username) return;
        const result = await sb.from("profiles").select("id, username, avatar_url, title, allow_messages").ilike("username", username).maybeSingle();
        if (result.error || !result.data) return toast("Usuário não encontrado.");
        if (result.data.allow_messages === false) return toast("Este usuário não está recebendo mensagens privadas.");
        overlay.remove();
        openChat(result.data);
      };
      return;
    }
    const messagesRoot = $("[data-chat-messages]", overlay);
    let chatMessagesById = new Map();
    const renderMessages = async () => {
      const now = new Date().toISOString();
      const result = await sb.from("chat_messages").select("id, sender_id, body, metadata, created_at").or(`and(sender_id.eq.${state.session.user.id},recipient_id.eq.${contact.id}),and(sender_id.eq.${contact.id},recipient_id.eq.${state.session.user.id})`).gt("expires_at", now).order("created_at", { ascending: true }).limit(200);
      if (result.error) return messagesRoot.innerHTML = '<div class="empty">Não foi possível carregar as mensagens.</div>';
      const senderIds = [...new Set((result.data || []).map(message => message.sender_id).filter(Boolean))];
      const profilesResult = senderIds.length ? await sb.from("profiles").select("id, username, avatar_url, title, title_color, plan, faction_id").in("id", senderIds) : { data: [] };
      const profilesById = new Map((profilesResult.data || []).map(profile => [profile.id, profile]));
      const senderVisuals = await loadChatSenderVisuals(senderIds);
      chatMessagesById = new Map((result.data || []).map(message => [String(message.id), { ...message, profile: profilesById.get(message.sender_id) || {} }]));
      messagesRoot.innerHTML = (result.data || []).map(message => chatMessageMarkup(message, profilesById.get(message.sender_id) || (message.sender_id === state.session.user.id ? state.profile : {}), senderVisuals.get(message.sender_id))).join("") || '<div class="empty">Nenhuma mensagem ainda.</div>';
      messagesRoot.scrollTop = messagesRoot.scrollHeight;
    };
    await renderMessages();
    channel = sb.channel(`chat-${state.session.user.id}-${contact.id}`).on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages", filter: `recipient_id=eq.${state.session.user.id}` }, payload => { if (payload.new?.sender_id === contact.id) renderMessages(); }).subscribe();
    const chatCompose = $("#chat-compose", overlay);
    const chatInput = $("#chat-compose textarea", overlay);
    const getReply = setupChatReplyUI({ messagesRoot, compose: chatCompose, input: chatInput, getMessage: id => chatMessagesById.get(String(id)) });
    chatCompose.onsubmit = async event => {
      event.preventDefault();
      const composeForm = event.currentTarget;
      const form = new FormData(event.currentTarget);
      const prepared = prepareChatMessage(String(form.get("body") || "").trim());
      const body = prepared.body;
      const reply = getReply();
      if (!body) return;
      const submitButton = $("button[type=submit]", event.currentTarget);
      if (!submitButton || submitButton.disabled) return;
      submitButton.disabled = true;
      const optimisticId = `chat-pending-${Date.now()}`;
      messagesRoot.insertAdjacentHTML("beforeend", `<div class="chat-message is-mine chat-message-pending" data-chat-pending="${optimisticId}"><div>${escapeHTML(body)}</div><small>Enviando…</small></div>`);
      event.currentTarget.reset();
      messagesRoot.scrollTop = messagesRoot.scrollHeight;
      const result = await sb.from("chat_messages").insert({ sender_id: state.session.user.id, recipient_id: contact.id, body, metadata: { ...prepared.metadata, ...(reply ? { reply_to: reply } : {}) }, expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() });
      if (result.error) {
        $(`[data-chat-pending="${optimisticId}"]`, messagesRoot)?.remove();
        submitButton.disabled = false;
        console.error("[private chat] erro ao enviar mensagem", result.error);
        return toast(result.error.message || "Não foi possível enviar a mensagem.");
      }
      await renderMessages();
      getReply.clear();
      awardProfileXp("chat", `chat:${Date.now()}`);
      submitButton.disabled = false;
    };
    $("#chat-compose textarea", overlay)?.addEventListener("keydown", event => {
      if (event.key !== "Enter" || event.shiftKey || event.isComposing) return;
      event.preventDefault();
      $("#chat-compose", overlay)?.requestSubmit();
    });
  }

  async function saveShelfCategories(categories) {
    if (sb && state.session) {
      const rows = categories.map(category => ({ id: category.id, owner_id: state.session.user.id, name: category.name, cover_url: category.coverUrl || null, is_public: category.isPublic !== false, item_ids: category.itemIds || [], sort_order: category.sortOrder || state.collectionSortOrders?.[`category:${category.id}`] || "added_desc", collection_type: "comic", blog_ids: [], is_featured: category.is_featured === true }));
      let result = rows.length ? await sb.from("shelf_collections").upsert(rows, { onConflict: "id" }) : { error: null };
      if (result.error && /sort_order|schema cache|column/i.test(result.error.message || "")) {
        result = rows.length ? await sb.from("shelf_collections").upsert(rows.map(({ sort_order, ...row }) => row), { onConflict: "id" }) : { error: null };
      }
      if (result.error) return toast("Não foi possível salvar a organização da estante.");
      const ids = rows.map(row => row.id);
      const existing = await sb.from("shelf_collections").select("id").eq("owner_id", state.session.user.id).eq("collection_type", "comic");
      const removedIds = (existing.data || []).map(row => row.id).filter(id => !ids.includes(id));
      if (removedIds.length) await sb.from("shelf_collections").delete().eq("owner_id", state.session.user.id).in("id", removedIds);
    }
    render();
    toast("Estante atualizada.");
  }

  async function saveShelfSortOrder(key, order) {
    if (!state.session || !SHELF_SORT_OPTIONS.some(([value]) => value === order)) return;
    state.collectionSortOrders = { ...(state.collectionSortOrders || {}), [key]: order };
    const result = await sb?.from("profiles").update({ shelf_sort_orders: state.collectionSortOrders }).eq("id", state.session.user.id);
    if (key.startsWith("category:")) {
      const collectionId = key.slice("category:".length);
      const category = state.shelfCategories.find(item => item.id === collectionId);
      if (category) category.sortOrder = order;
      await sb?.from("shelf_collections").update({ sort_order: order }).eq("id", collectionId).eq("owner_id", state.session.user.id);
    }
    if (result?.error) {
      try { localStorage.setItem(`bancaDigitalShelfSort:${state.session.user.id}`, JSON.stringify(state.collectionSortOrders)); } catch {}
    }
    render();
  }

  async function copyCollectionLink(categoryId, username = state.profile?.username) {
    if (!username || !categoryId) return;
    const link = new URL(publicProfileHref(username, categoryId), window.location.href).href;
    try {
      await navigator.clipboard.writeText(link);
      toast("Link da coleção copiado.");
    } catch {
      window.prompt("Copie o link da coleção:", link);
    }
  }

  function shelfComicPickerMarkup(items, selectedIds = []) {
    const normalize = value => String(value || "").trim().toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const groups = new Map();
    items.forEach(item => {
      const publisher = String(item.publisher || "").trim() || "Sem editora";
      const imprint = String(item.imprint || "").trim() || "Sem selo";
      const series = String(item.seriesTitle || item.title || "").trim() || "Sem série";
      const first = normalize(series).charAt(0).toUpperCase();
      const letter = /^[A-Z]$/.test(first) ? first : "#";
      if (!groups.has(publisher)) groups.set(publisher, new Map());
      if (!groups.get(publisher).has(imprint)) groups.get(publisher).set(imprint, new Map());
      if (!groups.get(publisher).get(imprint).has(letter)) groups.get(publisher).get(imprint).set(letter, new Map());
      if (!groups.get(publisher).get(imprint).get(letter).has(series)) groups.get(publisher).get(imprint).get(letter).set(series, []);
      groups.get(publisher).get(imprint).get(letter).get(series).push(item);
    });
    const sortLabels = (a, b) => String(a).localeCompare(String(b), "pt-BR", { sensitivity: "base" });
    const details = (className, label, content, searchText) => `<details class="collection-picker-group ${className}" data-picker-group data-picker-text="${escapeHTML(normalize(searchText))}" open><summary>${escapeHTML(label)}</summary>${content}</details>`;
    const publishers = [...groups.entries()].sort(([a], [b]) => sortLabels(a, b)).map(([publisher, imprints]) => {
      const imprintMarkup = [...imprints.entries()].sort(([a], [b]) => sortLabels(a, b)).map(([imprint, letters]) => {
        const letterMarkup = [...letters.entries()].sort(([a], [b]) => sortLabels(a, b)).map(([letter, seriesMap]) => {
          const seriesMarkup = [...seriesMap.entries()].sort(([a], [b]) => sortLabels(a, b)).map(([series, seriesItems]) => {
            const issueMarkup = seriesItems.slice().sort((a, b) => issueSortValue(a) - issueSortValue(b) || sortLabels(itemDisplayTitle(a), itemDisplayTitle(b))).map(item => `<label class="collection-picker-item" data-picker-item data-picker-text="${escapeHTML(normalize(`${itemDisplayTitle(item)} ${item.issue || ""} ${item.seriesTitle || ""} ${item.publisher || ""} ${item.imprint || ""}`))}"><input type="checkbox" name="itemIds" value="${escapeHTML(item.id)}" ${selectedIds.map(String).includes(String(item.id)) ? "checked" : ""}> ${escapeHTML(itemDisplayTitle(item))}${item.issue ? ` — ${escapeHTML(item.issue)}` : ""}</label>`).join("");
            return details("collection-picker-series", `${series} (${seriesItems.length})`, `<div class="collection-picker-items">${issueMarkup}</div>`, `${series} ${publisher} ${imprint} ${letter}`);
          }).join("");
          return details("collection-picker-letter", letter, `<div class="collection-picker-nested">${seriesMarkup}</div>`, `${publisher} ${imprint} ${letter}`);
        }).join("");
        return details("collection-picker-imprint", imprint, `<div class="collection-picker-nested">${letterMarkup}</div>`, `${publisher} ${imprint}`);
      }).join("");
      return details("collection-picker-publisher", publisher, `<div class="collection-picker-nested">${imprintMarkup}</div>`, publisher);
    }).join("");
    return `<div class="collection-picker collection-picker-comics"><div class="collection-picker-search"><input type="search" data-collection-picker-search placeholder="Pesquisar quadrinho, série, selo ou editora"><span data-collection-picker-count>${items.length} quadrinho(s)</span></div><div data-collection-picker-tree>${publishers || '<div class="empty">Salve algum quadrinho primeiro.</div>'}</div></div>`;
  }

  function openShelfCategoryForm(categoryId = null) {
    const existing = state.shelfCategories.find(category => category.id === categoryId);
    const savedItems = shelfItemsByIds([...ensureShelfSnapshot().saved]);
    const overlay = document.createElement("div");
    overlay.className = "modal-backdrop";
    overlay.innerHTML = `<div class="modal"><div class="section-head"><div><h2>${existing ? "Editar coleção" : "Nova coleção"}</h2><div class="section-subtitle">Organize seus itens salvos e escolha se a coleção será compartilhável</div></div><button class="small-btn" data-close>Fechar</button></div><form id="shelf-category-form"><div class="form-grid"><div class="field full"><label>Nome da coleção</label><input name="name" required maxlength="60" value="${escapeHTML(existing?.name || "")}" placeholder="Ex.: Favoritos, Para reler"></div><div class="field full"><label>Imagem da coleção (opcional)</label><input name="coverUrl" type="url" value="${escapeHTML(existing?.coverUrl || "")}" placeholder="https://.../imagem.jpg"><small class="format-hint">Apenas para coleções públicas.</small></div><div class="field full"><label><input name="isPublic" type="checkbox" ${existing?.isPublic !== false ? "checked" : ""}> Coleção pública — aparecerá no perfil e poderá ser compartilhada</label></div><div class="field full"><label>Quadrinhos nesta coleção</label><div class="collection-picker">${savedItems.map(item => `<label><input type="checkbox" name="itemIds" value="${escapeHTML(item.id)}" ${existing?.itemIds?.includes(item.id) ? "checked" : ""}> ${escapeHTML(item.seriesTitle || item.title)}${item.issue ? ` — ${escapeHTML(item.issue)}` : ""}</label>`).join("") || "Salve algum quadrinho primeiro."}</div></div></div><div class="modal-actions"><button type="button" class="small-btn" data-close>Cancelar</button><button class="btn btn-danger">Salvar coleção</button></div></form></div>`;
    $("#modal-root").appendChild(overlay);
    const comicPicker = $(".collection-picker", overlay);
    if (comicPicker) {
      comicPicker.outerHTML = shelfComicPickerMarkup(savedItems, existing?.itemIds || []);
      const search = $("[data-collection-picker-search]", overlay);
      const tree = $("[data-collection-picker-tree]", overlay);
      const count = $("[data-collection-picker-count]", overlay);
      const normalizeSearch = value => String(value || "").trim().toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const filterPicker = () => {
        const query = normalizeSearch(search?.value);
        let visibleCount = 0;
        $$('[data-picker-item]', tree).forEach(item => {
          const visible = !query || normalizeSearch(item.dataset.pickerText).includes(query);
          item.hidden = !visible;
          if (visible) visibleCount += 1;
        });
        $$('[data-picker-group]', tree).reverse().forEach(group => {
          const hasVisible = Boolean($('[data-picker-item]:not([hidden])', group));
          group.hidden = !hasVisible;
          if (query && hasVisible) group.open = true;
        });
        if (count) count.textContent = `${visibleCount} quadrinho(s)`;
      };
      search?.addEventListener("input", filterPicker);
      filterPicker();
    }
    $$('[data-close]', overlay).forEach(button => button.onclick = () => overlay.remove());
    $("#shelf-category-form", overlay).onsubmit = async event => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const category = { id: existing?.id || `shelf-${Date.now()}`, name: String(form.get("name") || "").trim(), coverUrl: String(form.get("coverUrl") || "").trim(), isPublic: form.get("isPublic") === "on", itemIds: form.getAll("itemIds"), sortOrder: existing?.sortOrder || state.collectionSortOrders?.[`category:${existing?.id}`] || "added_desc" };
      if (!category.name) return;
      const categories = existing ? state.shelfCategories.map(item => item.id === category.id ? category : item) : [...state.shelfCategories, category];
      state.shelfCategories = categories;
      overlay.remove();
      await saveShelfCategories(categories);
    };
  }

  function deleteShelfCategory(categoryId) {
    state.shelfCategories = state.shelfCategories.filter(category => category.id !== categoryId);
    saveShelfCategories(state.shelfCategories);
  }

  function blogShelfCollectionMarkup(collection, posts, editable = false) {
    const items = (collection.blogIds || []).map(id => posts.find(post => String(post.id) === String(id))).filter(Boolean);
    const staff = ["moderator", "admin"].includes(state.profile?.plan);
    const profileUsername = state.publicProfile?.profile?.username || state.profile?.username || "";
    return `<section class="section shelf-collection blog-shelf-collection"><div class="section-head"><div><h2 class="section-title">${escapeHTML(collection.name)}</h2><div class="section-subtitle">${items.length} blog(s)</div></div><div class="shelf-section-actions">${collection.isPublic !== false ? `<span class="shelf-visibility is-public">${collection.is_featured ? "Destaque · " : ""}Pública</span><button class="small-btn" data-copy-collection="${escapeHTML(collection.id)}" data-copy-username="${escapeHTML(profileUsername)}">Compartilhar</button>${!editable && profileUsername ? `<a class="small-btn" href="${escapeHTML(publicProfileHref(profileUsername, collection.id))}">Abrir</a>` : ""}` : '<span class="shelf-visibility is-private">Privada</span>'}${staff && collection.isPublic !== false ? `<button class="small-btn" data-collection-feature="${escapeHTML(collection.id)}" data-collection-featured="${collection.is_featured ? "true" : "false"}">${collection.is_featured ? "Remover destaque" : "Destacar"}</button>` : ""}${editable ? `<button class="small-btn" data-blog-shelf-edit="${escapeHTML(collection.id)}">Editar</button><button class="small-btn danger" data-blog-shelf-delete="${escapeHTML(collection.id)}">Excluir</button>` : ""}</div></div><div class="blog-shelf-grid">${items.map(post => blogCard(post)).join("") || '<div class="empty">Nenhum blog nesta coleção.</div>'}</div></section>`;
  }

  function blogShelfPanelMarkup(publicState = null) {
    const authored = publicState ? publicState.authoredBlogPosts || [] : state.authoredBlogPosts;
    const saved = publicState ? [...(publicState.savedBlogPosts || []), ...(publicState.collectionBlogPosts || [])] : state.savedBlogPosts;
    const collections = (publicState ? publicState.blogCollections || [] : state.blogShelfCategories).filter(collection => !publicState || collection.isPublic !== false);
    const posts = [...new Map([...authored, ...saved].map(post => [String(post.id), post])).values()];
    const canEdit = !publicState;
    return `<div class="blog-shelf-panel"><div class="section-head"><div><h2 class="section-title">Blogs</h2><div class="section-subtitle">Blogs escritos e salvos por esta pessoa.</div></div>${canEdit ? '<button class="small-btn" data-blog-shelf-new>+ Nova coleção</button>' : ""}</div><section class="section shelf-collection"><div class="section-head"><div><h2 class="section-title">Escritos</h2><div class="section-subtitle">${authored.length} blog(s)</div></div></div><div class="blog-shelf-grid">${authored.map(post => blogCard(post)).join("") || '<div class="empty">Nenhum blog escrito ainda.</div>'}</div></section><section class="section shelf-collection"><div class="section-head"><div><h2 class="section-title">Salvos</h2><div class="section-subtitle">${saved.length} blog(s)</div></div></div><div class="blog-shelf-grid">${saved.map(post => blogCard(post)).join("") || '<div class="empty">Nenhum blog salvo ainda.</div>'}</div></section>${collections.map(collection => blogShelfCollectionMarkup(collection, posts, canEdit)).join("")}</div>`;
  }

  function openBlogShelfCollectionForm(collectionId = null) {
    const existing = state.blogShelfCategories.find(collection => collection.id === collectionId);
    const posts = [...new Map([...state.authoredBlogPosts, ...state.savedBlogPosts].map(post => [String(post.id), post])).values()];
    const overlay = document.createElement("div");
    overlay.className = "modal-backdrop";
    overlay.innerHTML = `<div class="modal"><div class="section-head"><div><h2>${existing ? "Editar coleção de blogs" : "Nova coleção de blogs"}</h2><div class="section-subtitle">Organize blogs escritos ou salvos.</div></div><button class="small-btn" data-close>Fechar</button></div><form id="blog-shelf-collection-form"><div class="field"><label>Nome da coleção</label><input name="name" maxlength="60" required value="${escapeHTML(existing?.name || "")}" placeholder="Ex.: Notícias favoritas"></div><div class="field"><label>Imagem da coleção (opcional)</label><input name="coverUrl" type="url" value="${escapeHTML(existing?.coverUrl || "")}" placeholder="https://..."></div><div class="field"><label><input name="isPublic" type="checkbox" ${existing?.isPublic !== false ? "checked" : ""}> Coleção pública</label></div><div class="field"><label>Blogs</label><div class="collection-picker">${posts.map(post => `<label><input type="checkbox" name="blogIds" value="${escapeHTML(post.id)}" ${existing?.blogIds?.includes(String(post.id)) ? "checked" : ""}> ${escapeHTML(post.title)}</label>`).join("") || "Salve ou escreva algum blog primeiro."}</div></div><div class="modal-actions"><button type="button" class="small-btn" data-close>Cancelar</button><button class="btn btn-danger" type="submit">${existing ? "Salvar alterações" : "Criar coleção"}</button></div></form></div>`;
    $("#modal-root").appendChild(overlay);
    $$('[data-close]', overlay).forEach(button => button.onclick = () => overlay.remove());
    $("#blog-shelf-collection-form", overlay).onsubmit = async event => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const name = String(form.get("name") || "").trim();
      const blogIds = form.getAll("blogIds");
      if (!name) return;
      const payload = { owner_id: state.session.user.id, name, cover_url: String(form.get("coverUrl") || "").trim() || null, is_public: form.get("isPublic") === "on", collection_type: "blog", blog_ids: blogIds, item_ids: [] };
      const result = existing ? await sb.from("shelf_collections").update(payload).eq("id", existing.id).eq("owner_id", state.session.user.id) : await sb.from("shelf_collections").insert({ id: `blog-shelf-${Date.now()}`, ...payload });
      if (result.error) return toast("Não foi possível criar a coleção de blogs.");
      overlay.remove();
      await loadAccount();
    };
  }

  async function deleteBlogShelfCollection(id) {
    const result = await sb.from("shelf_collections").delete().eq("id", id).eq("owner_id", state.session.user.id);
    if (result.error) return toast("Não foi possível excluir a coleção.");
    await loadAccount();
  }

  function publicCollectionCard(collection, canManage = false) {
    const blog = collection.collection_type === "blog";
    const count = blog ? (Array.isArray(collection.blog_ids) ? collection.blog_ids.length : 0) : (Array.isArray(collection.item_ids) ? collection.item_ids.length : 0);
    const cover = collection.cover_url || collection.coverUrl || instantCover({ title: collection.name });
    return `<article class="public-shelf-collection-card" data-public-collection="${escapeHTML(collection.id)}" data-public-owner="${escapeHTML(collection.username || "")}" role="link" tabindex="0"><div class="public-shelf-collection-cover has-image" style="background-image:url('${escapeHTML(cover)}')"></div><div class="public-shelf-collection-info"><div class="eyebrow">${collection.is_featured ? "Destaque · " : ""}${blog ? "Blogs" : "Quadrinhos"}</div><h3>${escapeHTML(collection.name)}</h3><p>${count} item(ns) · @${escapeHTML(collection.username || "usuário")}</p><div class="shelf-section-actions"><span class="shelf-visibility is-public">Pública</span><a class="small-btn" href="${escapeHTML(publicProfileHref(collection.username, collection.id))}">Abrir</a>${canManage ? `<button class="small-btn" data-copy-collection="${escapeHTML(collection.id)}" data-copy-username="${escapeHTML(collection.username)}">Compartilhar</button><button class="small-btn" data-collection-feature="${escapeHTML(collection.id)}" data-collection-featured="${collection.is_featured ? "true" : "false"}">${collection.is_featured ? "Remover destaque" : "Destacar"}</button>` : ""}</div></div></article>`;
  }

  async function toggleShelfCollectionFeatured(id, featured) {
    if (!["moderator", "admin"].includes(state.profile?.plan)) return;
    const result = await sb.from("shelf_collections").update({ is_featured: !featured }).eq("id", id);
    if (result.error) return toast("Não foi possível atualizar o destaque da coleção.");
    if (state.section === "public-profile" && state.publicProfile?.profile) await loadPublicProfile(state.publicProfile.profile.username, state.publicProfile.collectionId || null);
    else await loadAccount();
  }

  function profileXpProgressMarkup(profile, compact = false) {
    const xp = Math.max(0, Number(profile?.xp) || 0);
    const level = Math.max(1, Number(profile?.level) || 1);
    const currentFloor = Math.pow(level - 1, 2) * 100;
    const nextFloor = Math.pow(level, 2) * 100;
    const progress = Math.max(0, Math.min(100, ((xp - currentFloor) / Math.max(1, nextFloor - currentFloor)) * 100));
    return `<div class="profile-xp-progress ${compact ? "is-compact" : ""}"><div class="profile-xp-head"><strong>Nível ${level}</strong><span>${xp.toLocaleString("pt-BR")} / ${nextFloor.toLocaleString("pt-BR")} XP para o nível ${level + 1}</span></div><div class="profile-xp-track"><span style="width:${progress.toFixed(2)}%"></span></div>${compact ? "" : `<small>${Math.max(0, nextFloor - xp).toLocaleString("pt-BR")} XP restantes · 🔥 ${Number(profile?.daily_streak || 0)} dia(s) de sequência</small>`}</div>`;
  }

  function profileBannerUrl(profile) {
    const value = String(profile?.profile_banner_url || "").trim();
    return /^https?:\/\//i.test(value) ? value : "/assets/estantepb.jpg";
  }

  function ensureProfileBanner(profile) {
    const content = $(".content");
    const header = $(".content .profile-header");
    if (!content || !header) return null;
    let banner = $(".profile-banner", content);
    if (!banner) {
      banner = document.createElement("div");
      banner.className = "profile-banner";
      header.before(banner);
      banner.appendChild(header);
    }
    const url = profileBannerUrl(profile).replace(/["\\)]/g, "");
    banner.style.setProperty("--profile-banner-image", `url("${url}")`);
    return banner;
  }

  function renderShelfPage() {
    if (!state.session) return renderLoginPage();
    const snapshot = ensureShelfSnapshot();
    const savedItems = shelfItemsByIds([...snapshot.saved].filter(id => !isSeriesId(id)), false);
    const savedSeries = shelfItemsByIds([...snapshot.saved].filter(isSeriesId), true);
    const readItems = shelfItemsByIds([...snapshot.read]);
    const completedItems = completedSeriesItems(state.readingProgress);
    const canCustomize = ["admin", "moderator", "premium"].includes(state.profile?.plan);
    const categories = state.shelfCategories.map(category => ({ ...category, itemIds: (category.itemIds || []).filter(id => snapshot.saved.has(id)) }));
    return `<div class="content"><div class="profile-header">${avatarMarkup(state.profile)}<div><div class="eyebrow">@${escapeHTML(state.profile?.username || "")}</div>${state.profile?.title ? `<div class="profile-title" style="--title-bg:${safeTitleColor(state.profile.title_color)}">${escapeHTML(state.profile.title)}</div>` : ""}${trophyRoom(state.achievements)}</div><div class="profile-actions"><button class="small-btn" data-action="profile">Editar perfil</button><button class="small-btn" data-action="logout">Sair</button></div></div><div class="section-head"><div><h1 class="section-title">Minha estante</h1><div class="section-subtitle">Coleções fixas para organizar seus quadrinhos e séries</div></div><button class="btn btn-danger" data-action="open-local-box">Abrir caixa</button></div><div class="notice local-box-notice"><b>Minha caixa:</b> leia arquivos do seu computador sem enviá-los para o servidor. Tudo fica apenas neste navegador e some quando você sair.</div>${shelfCollectionMarkup("Salvos", savedItems, "saved")}${state.profile?.shelf_series_public !== false ? shelfCollectionMarkup("Séries salvas", savedSeries, "series-saved", state.readingProgress, state.favoriteIds, "", null, true) : ""}${shelfCollectionMarkup("Lidos", readItems, "read")}${state.profile?.shelf_completed_public !== false ? shelfCollectionMarkup("Concluídos", completedItems, "completed", state.readingProgress, state.favoriteIds, "", null, true) : ""}${canCustomize ? `<section class="section shelf-categories"><div class="section-head"><div><h2 class="section-title">Coleções pessoais</h2><div class="section-subtitle">Misture séries e edições na mesma coleção</div></div><button class="small-btn" data-shelf-new-category>+ Nova coleção</button></div>${categories.map(category => shelfCollectionMarkup(category.name, shelfItemsByIds(category.itemIds), `category:${category.id}`, state.readingProgress, state.favoriteIds, `<span class="shelf-visibility ${category.isPublic !== false ? "is-public" : "is-private"}">${category.isPublic !== false ? "Pública" : "Privada"}</span>${category.isPublic !== false ? `<button class="small-btn" data-copy-collection="${escapeHTML(category.id)}">Compartilhar</button>` : ""}<button class="small-btn" data-shelf-edit-category="${escapeHTML(category.id)}">Editar</button><button class="small-btn danger" data-shelf-delete-category="${escapeHTML(category.id)}">Excluir</button>`)).join("") || '<div class="empty">Crie uma coleção para começar a organizar seus salvos.</div>'}</section>` : ""}</div>`;
  }

  function renderPublicCollectionPage(publicState, category) {
    const profile = publicState.profile;
    const allItems = publicCollectionItems(category, publicState);
    const filter = state.collectionFilter || { field: "all", query: "" };
    const filteredItems = filterCollectionItems(allItems, filter.field, filter.query);
    const sortOrder = publicState.profile?.shelf_sort_orders?.[`category:${category.id}`] || category.sortOrder || "added_desc";
    const items = sortShelfItems(filteredItems, sortOrder, null, publicState.readingProgress);
    const isLiked = publicState.collectionLikes?.has(category.id);
    const likes = publicState.collectionLikeCounts?.get(category.id) || 0;
    const cover = category.coverUrl ? `style="background-image:url('${escapeHTML(category.coverUrl)}')"` : "";
    return `<div class="content public-collection-page"><div class="public-collection-hero"><div class="public-collection-icon ${category.coverUrl ? "has-cover" : ""}" ${cover}>${category.coverUrl ? "" : "▣"}</div><div><div class="eyebrow">Coleção pública</div><h1 class="section-title">${escapeHTML(category.name)}</h1><div class="collection-creator-block">${avatarMarkup(profile, "collection-creator-avatar")}<div><a class="collection-creator" href="${escapeHTML(publicProfileHref(profile.username))}">@${escapeHTML(profile.username)}</a>${profile.title ? `<div class="collection-creator-title" style="--title-bg:${safeTitleColor(profile.title_color)}">${escapeHTML(profile.title)}</div>` : ""}</div></div><div class="section-subtitle">${allItems.length} item(ns)</div></div></div><div class="section-head"><div><h2 class="section-title">${escapeHTML(category.name)}</h2><div class="section-subtitle">Uma coleção compartilhada da Banca Digital</div></div><div class="shelf-section-actions"><button class="small-btn ${isLiked ? "is-liked" : ""}" data-like-collection="${escapeHTML(category.id)}" data-like-owner="${escapeHTML(profile.id)}">${isLiked ? "♥ Curtida" : "♡ Curtir"} · ${likes}</button><button class="small-btn" data-copy-collection="${escapeHTML(category.id)}" data-copy-username="${escapeHTML(profile.username)}">Copiar link</button><a class="small-btn" href="${escapeHTML(publicProfileHref(profile.username))}">Ver perfil</a></div></div><form class="collection-filter" data-collection-filter-form><select name="field"><option value="all" ${filter.field === "all" ? "selected" : ""}>Filtrar por qualquer campo</option><option value="author" ${filter.field === "author" ? "selected" : ""}>Autor</option><option value="publisher" ${filter.field === "publisher" ? "selected" : ""}>Editora</option><option value="character" ${filter.field === "character" ? "selected" : ""}>Personagem</option><option value="tag" ${filter.field === "tag" ? "selected" : ""}>Gênero / tag</option><option value="seriesTitle" ${filter.field === "seriesTitle" ? "selected" : ""}>Série</option><option value="title" ${filter.field === "title" ? "selected" : ""}>Título</option></select><input name="query" value="${escapeHTML(filter.query)}" placeholder="Digite para filtrar a coleção"><button class="small-btn">Filtrar</button></form><div class="collection-results-meta">${items.length} de ${allItems.length} item(ns)</div><div class="results-grid">${items.map(item => card(item, publicState.readingProgress, publicState.favoriteIds)).join("") || '<div class="empty">Nenhum quadrinho corresponde ao filtro.</div>'}</div></div>`;
  }

  function renderPublicBlogCollectionPage(publicState, collection) {
    const profile = publicState.profile;
    const posts = (collection.blogIds || [])
      .map(id => (publicState.authoredBlogPosts || []).find(post => String(post.id) === String(id)) || (publicState.savedBlogPosts || []).find(post => String(post.id) === String(id)) || (publicState.collectionBlogPosts || []).find(post => String(post.id) === String(id)))
      .filter(Boolean);
    return `<div class="content public-collection-page public-blog-collection-page"><div class="public-collection-hero"><div class="public-collection-icon ${collection.coverUrl ? "has-cover" : ""}" ${collection.coverUrl ? `style="background-image:url('${escapeHTML(collection.coverUrl)}')"` : ""}>${collection.coverUrl ? "" : "✎"}</div><div><div class="eyebrow">Coleção pública de blogs</div><h1 class="section-title">${escapeHTML(collection.name)}</h1><div class="collection-creator-block">${avatarMarkup(profile, "collection-creator-avatar")}<div><a class="collection-creator" href="${escapeHTML(publicProfileHref(profile.username))}">@${escapeHTML(profile.username)}</a>${profile.title ? `<div class="collection-creator-title" style="--title-bg:${safeTitleColor(profile.title_color)}">${escapeHTML(profile.title)}</div>` : ""}</div></div><div class="section-subtitle">${posts.length} blog(s)</div></div></div><div class="section-head"><div><h2 class="section-title">${escapeHTML(collection.name)}</h2><div class="section-subtitle">Uma coleção pública de blogs da Banca Digital</div></div><div class="shelf-section-actions"><button class="small-btn" data-copy-collection="${escapeHTML(collection.id)}" data-copy-username="${escapeHTML(profile.username)}">Compartilhar</button><a class="small-btn" href="${escapeHTML(publicProfileHref(profile.username))}">Ver perfil</a></div></div><div class="blog-shelf-grid">${posts.map(post => blogCard(post)).join("") || '<div class="empty">Nenhum blog nesta coleção.</div>'}</div></div>`;
  }

  function filterCollectionItems(items, field, query) {
    const normalized = String(query || "").trim().toLowerCase();
    if (!normalized) return items;
    return items.filter(item => {
      const values = field === "tag" ? (item.tags || []) : field === "all" ? [item.title, item.seriesTitle, item.author, item.publisher, item.character, ...(item.tags || [])] : [item[field]];
      return values.some(value => String(value || "").toLowerCase().includes(normalized));
    });
  }

  async function toggleCollectionLike(ownerId, collectionId) {
    if (!state.session) return openAuthPage();
    const publicState = state.publicProfile;
    if (!publicState?.collectionLikes) return;
    const liked = publicState.collectionLikes.has(collectionId);
    const query = sb.from("shelf_collection_likes");
    const result = liked
      ? await query.delete().eq("owner_id", ownerId).eq("collection_id", collectionId).eq("user_id", state.session.user.id)
      : await query.insert({ owner_id: ownerId, collection_id: collectionId, user_id: state.session.user.id });
    if (result.error) return toast("Não foi possível atualizar a curtida.");
    if (liked) {
      publicState.collectionLikes.delete(collectionId);
      publicState.collectionLikeCounts.set(collectionId, Math.max(0, (publicState.collectionLikeCounts.get(collectionId) || 1) - 1));
    } else {
      publicState.collectionLikes.add(collectionId);
      publicState.collectionLikeCounts.set(collectionId, (publicState.collectionLikeCounts.get(collectionId) || 0) + 1);
    }
    render();
  }

  async function runModerationAction(target, action, duration = null, title = null, titleColor = null) {
    if (!sb || !target?.username) return;
    if (action === "title") title = profileTitle(title);
    const result = await sb.rpc("moderate_user", { p_username: target.username, p_action: action, p_duration: duration, p_title: title, p_title_color: titleColor });
    if (result.error) return toast(result.error.message || "Não foi possível aplicar a moderação.");
    toast("Ação de moderação aplicada.");
    await loadPublicProfile(target.username, state.publicProfile?.collectionId || null);
  }

  function attachPlanControl(overlay, target) {
    if (!overlay || !target || !["moderator", "admin"].includes(state.profile?.plan)) return;
    const historySection = $(".moderation-history", overlay)?.closest(".moderation-section");
    if (!historySection) return;
    const planSection = document.createElement("section");
    planSection.className = "moderation-section";
    planSection.innerHTML = `<h3>Tipo de conta</h3><form id="moderation-plan-form"><div class="moderation-plan-row"><select name="plan"><option value="free" ${target.plan === "free" ? "selected" : ""}>Comum</option><option value="premium" ${target.plan === "premium" ? "selected" : ""}>Lenda</option></select><button class="small-btn" type="submit">Salvar tipo</button></div></form>`;
    historySection.before(planSection);
    $("#moderation-plan-form", planSection).onsubmit = async event => {
      event.preventDefault();
      const plan = String(new FormData(event.currentTarget).get("plan") || "free");
      const result = await sb.rpc("set_user_plan", { p_username: target.username, p_plan: plan });
      if (result.error) return toast(result.error.message || "Não foi possível alterar o tipo de conta.");
      toast("Tipo de conta atualizado.");
      overlay.remove();
      await loadPublicProfile(target.username, state.publicProfile?.collectionId || null);
    };
  }

  function openModerationPanel(target) {
    if (!target || !["moderator", "admin"].includes(state.profile?.plan)) return;
    const overlay = document.createElement("div");
    overlay.className = "modal-backdrop";
    const history = state.publicProfile?.moderationHistory || [];
    overlay.innerHTML = `<div class="modal moderation-modal"><div class="section-head"><div><h2>Moderação de @${escapeHTML(target.username)}</h2><div class="section-subtitle">Disponível para moderadores e administradores</div></div><button class="small-btn" data-close>Fechar</button></div><div class="admin-actions moderation-actions"><button class="small-btn danger" data-moderation="ban">Banir usuário</button><button class="small-btn" data-moderation="hide">Ocultar perfil</button><button class="small-btn" data-moderation="unban">Remover banimento</button><button class="small-btn" data-moderation="unhide">Mostrar perfil</button><button class="small-btn" data-moderation="unsilence">Remover silêncio</button></div><div class="field"><label>Silenciar comentários</label><div class="admin-actions"><button class="small-btn" data-silence="24h">24 horas</button><button class="small-btn" data-silence="3d">3 dias</button><button class="small-btn" data-silence="1m">1 mês</button></div></div><form id="moderation-title-form"><div class="field"><label>Título do perfil</label><input name="title" value="${escapeHTML(target.title || "")}" maxlength="80"></div><div class="field"><label>Cor do título</label><input name="titleColor" type="color" value="${escapeHTML(safeTitleColor(target.title_color))}"></div><button class="small-btn" type="submit">Salvar título</button></form><h3>Histórico de moderação</h3><div class="moderation-history">${history.map(entry => `<div class="moderation-history-item"><b>${escapeHTML(entry.action)}</b><span>@${escapeHTML(entry.actor_username || "moderador")} · ${escapeHTML(formatCommentDate(entry.created_at))}</span></div>`).join("") || '<span class="section-subtitle">Nenhuma ação registrada.</span>'}</div></div>`;
    $("#modal-root").appendChild(overlay);
    $("[data-close]", overlay).onclick = () => overlay.remove();
    $$('[data-moderation]', overlay).forEach(button => button.onclick = async () => { await runModerationAction(target, button.dataset.moderation); overlay.remove(); });
    $$('[data-silence]', overlay).forEach(button => button.onclick = async () => { await runModerationAction(target, "silence", button.dataset.silence); overlay.remove(); });
    $("#moderation-title-form", overlay).onsubmit = async event => { event.preventDefault(); const form = new FormData(event.currentTarget); await runModerationAction(target, "title", null, String(form.get("title") || ""), String(form.get("titleColor") || "#ffd45c")); overlay.remove(); };
  }

  function openModerationPanel(target) {
    if (!target || !["moderator", "admin"].includes(state.profile?.plan)) return;
    const overlay = document.createElement("div");
    overlay.className = "modal-backdrop";
    const history = state.publicProfile?.moderationHistory || [];
    const visibilityAction = target.profile_hidden ? "unhide" : "hide";
    const visibilityLabel = target.profile_hidden ? "Mostrar perfil" : "Ocultar perfil";
    const banAction = target.is_banned ? "unban" : "ban";
    const banLabel = target.is_banned ? "Remover banimento" : "Banir usuário";
    const silenceLabel = target.silenced_until ? `Silenciado até ${formatCommentDate(target.silenced_until)}` : "Usuário pode comentar";
    overlay.innerHTML = `<div class="modal moderation-modal"><div class="section-head moderation-header"><div><div class="eyebrow">Painel de moderação</div><h2>@${escapeHTML(target.username)}</h2><div class="section-subtitle">Ações registradas no histórico do perfil</div></div><button class="small-btn" data-close>Fechar</button></div><div class="moderation-status">${target.profile_hidden ? "Perfil oculto" : "Perfil público"} · ${target.is_banned ? "Banido" : "Conta ativa"} · ${escapeHTML(silenceLabel)}</div><div class="moderation-grid"><section class="moderation-section"><h3>Perfil e acesso</h3><div class="moderation-button-grid"><button class="small-btn" data-moderation="${visibilityAction}">${visibilityLabel}</button><button class="small-btn danger" data-moderation="${banAction}">${banLabel}</button></div></section><section class="moderation-section"><h3>Comentários</h3><div class="admin-actions"><button class="small-btn" data-silence="24h">Silenciar 24 horas</button><button class="small-btn" data-silence="3d">Silenciar 3 dias</button><button class="small-btn" data-silence="1m">Silenciar 1 mês</button><button class="small-btn" data-moderation="unsilence">Remover silêncio</button></div></section></div><section class="moderation-section"><h3>Título do perfil</h3><form id="moderation-title-form"><div class="moderation-title-fields"><div class="field"><label>Texto</label><input name="title" value="${escapeHTML(target.title || "")}" maxlength="80" placeholder="Título do usuário"></div><div class="field"><label>Cor</label><input name="titleColor" type="color" value="${escapeHTML(safeTitleColor(target.title_color))}"></div></div><button class="small-btn" type="submit">Salvar título</button></form></section><section class="moderation-section"><h3>Histórico</h3><div class="moderation-history">${history.map(entry => `<div class="moderation-history-item"><b>${escapeHTML(entry.action)}</b><span>@${escapeHTML(entry.actor_username || "moderador")} · ${escapeHTML(formatCommentDate(entry.created_at))}</span></div>`).join("") || '<span class="section-subtitle">Nenhuma ação registrada.</span>'}</div></section></div>`;
    $("#modal-root").appendChild(overlay);
    $("[data-close]", overlay).onclick = () => overlay.remove();
    $$('[data-moderation]', overlay).forEach(button => button.onclick = async () => { await runModerationAction(target, button.dataset.moderation); overlay.remove(); });
    $$('[data-silence]', overlay).forEach(button => button.onclick = async () => { await runModerationAction(target, "silence", button.dataset.silence); overlay.remove(); });
    $("#moderation-title-form", overlay).onsubmit = async event => { event.preventDefault(); const form = new FormData(event.currentTarget); await runModerationAction(target, "title", null, String(form.get("title") || ""), String(form.get("titleColor") || "#ffd45c")); overlay.remove(); };
  }

  async function deletePublicCollection(ownerId, collectionId) {
    if (state.profile?.plan !== "admin") return;
    const result = await sb.from("shelf_collections").delete().eq("owner_id", ownerId).eq("id", collectionId);
    if (result.error) return toast("Não foi possível excluir a coleção.");
    toast("Coleção pública excluída.");
    await loadPublicProfile(state.publicProfile.profile.username);
  }

  function openProfileBlockConfirm(profile, blocked) {
    return new Promise(resolve => {
      const overlay = document.createElement("div");
      overlay.className = "modal-backdrop";
      overlay.innerHTML = `<div class="modal profile-block-confirm-modal"><div class="section-head"><div><div class="eyebrow">Privacidade</div><h2>${blocked ? "Desbloquear usuário?" : "Bloquear usuário?"}</h2><div class="section-subtitle">${blocked ? "Este usuário poderá voltar a ver seu perfil e interagir com você." : "Este usuário não poderá enviar mensagens, comentar no seu mural ou acessar seu perfil, histórico e coleções."}</div></div><button type="button" class="small-btn" data-close>Cancelar</button></div><div class="modal-actions"><button type="button" class="small-btn" data-close>Cancelar</button><button type="button" class="btn btn-danger" data-confirm-block>${blocked ? "Desbloquear" : "Bloquear"}</button></div></div>`;
      $("#modal-root").appendChild(overlay);
      const finish = value => { overlay.remove(); resolve(value); };
      $$('[data-close]', overlay).forEach(button => button.onclick = () => finish(false));
      $("[data-confirm-block]", overlay).onclick = () => finish(true);
    });
  }

  async function toggleProfileBlock(profile) {
    if (!state.session || !sb) return openAuthPage();
    if (!profile?.id || profile.id === state.session.user.id) return;
    const blocked = Boolean(state.publicProfile?.blockedByMe);
    if (!await openProfileBlockConfirm(profile, blocked)) return;
    const query = sb.from("profile_blocks");
    const result = blocked
      ? await query.delete().eq("blocker_id", state.session.user.id).eq("blocked_id", profile.id)
      : await query.insert({ blocker_id: state.session.user.id, blocked_id: profile.id });
    if (result.error) return toast(result.error.message || "Não foi possível atualizar o bloqueio.");
    await loadPublicProfile(profile.username);
  }

  async function toggleProfileFollow(profile) {
    if (!state.session) return openAuthPage();
    if (!profile?.id || profile.id === state.session.user.id) return;
    const publicState = state.publicProfile;
    const following = Boolean(publicState?.isFollowing);
    const query = sb.from("profile_follows");
    const result = following
      ? await query.delete().eq("follower_id", state.session.user.id).eq("following_id", profile.id)
      : await query.insert({ follower_id: state.session.user.id, following_id: profile.id });
    if (result.error) return toast("Não foi possível atualizar o acompanhamento.");
    publicState.isFollowing = !following;
    publicState.followerCount = Math.max(0, (publicState.followerCount || 0) + (following ? -1 : 1));
    state.followingCount = Math.max(0, (state.followingCount || 0) + (following ? -1 : 1));
    render();
  }

  function renderPublicProfilePage() {
    const publicState = state.publicProfile;
    if (!publicState || publicState.loading) return '<div class="content"><div class="empty">Carregando perfil...</div></div>';
    if (publicState.error) return `<div class="content"><div class="empty">${escapeHTML(publicState.error)}</div></div>`;
    const profile = publicState.profile;
    if (publicState.blocked) return `<div class="content public-profile-page"><section class="section blocked-profile-notice"><div class="eyebrow">Privacidade</div><h1 class="section-title">Perfil indisponível</h1><p>${publicState.blockedByMe ? "Você bloqueou este usuário. Ele não pode enviar mensagens, comentar no seu mural ou acessar seu histórico, coleções e foto." : "Este perfil não está disponível para você."}</p><div class="profile-actions"><button class="small-btn" data-section="home">Voltar ao início</button>${publicState.blockedByMe ? `<button class="small-btn" data-unblock-profile>Desbloquear</button>` : ""}</div></section></div>`;
    const savedVisible = !["admin", "moderator", "premium"].includes(profile.plan) || profile.shelf_saved_public !== false;
    const seriesVisible = !["admin", "moderator", "premium"].includes(profile.plan) || profile.shelf_series_public !== false;
    const readVisible = !["admin", "moderator", "premium"].includes(profile.plan) || profile.shelf_read_public !== false;
    const completedVisible = !["admin", "moderator", "premium"].includes(profile.plan) || profile.shelf_completed_public !== false;
    const likedVisible = !["admin", "moderator", "premium"].includes(profile.plan) || profile.shelf_liked_public !== false;
    const wallVisible = profile.profile_wall_public !== false;
    const savedPublicCollectionsVisible = profile.shelf_saved_public_collections !== false;
    const activityVisible = profile.profile_activity_public !== false;
    const savedItems = uniqueCatalogItems(state.db.library.filter(item => publicState.favoriteIds.has(item.id)));
    const savedSeries = shelfItemsByIds([...publicState.favoriteIds].filter(isSeriesId), true);
    const readItems = uniqueCatalogItems(state.db.library.filter(item => publicState.readingProgress.get(item.id)?.completed));
    const likedItems = uniqueCatalogItems(state.db.library.filter(item => publicState.comicLikeIds?.has(item.id)));
    const completedItems = completedSeriesItems(publicState.readingProgress);
    const publicCategories = (publicState.collections || []).filter(category => category.isPublic !== false);
    const publicBlogCollections = (publicState.blogCollections || []).filter(collection => collection.isPublic !== false);
    const selectedCategory = publicCategories.find(category => category.id === publicState.collectionId);
    const selectedBlogCollection = publicBlogCollections.find(collection => collection.id === publicState.collectionId);
    if (publicState.collectionId && selectedCategory) return renderPublicCollectionPage(publicState, selectedCategory);
    if (publicState.collectionId && selectedBlogCollection) return renderPublicBlogCollectionPage(publicState, selectedBlogCollection);
    if (publicState.collectionId && !selectedCategory && !selectedBlogCollection) return `<div class="content"><div class="empty">Esta coleção não existe ou é privada.</div><a class="small-btn" href="${escapeHTML(publicProfileHref(profile.username))}">Voltar ao perfil</a></div>`;
    const canModerate = ["moderator", "admin"].includes(state.profile?.plan) && !["moderator", "admin"].includes(profile.plan);
    const canFollow = Boolean(state.session?.user?.id && state.session.user.id !== profile.id);
    const canBlock = canFollow;
    return `<div class="content public-profile-page">
      <div class="profile-header">
        ${avatarMarkup(profile)}
        <div>
          <div class="eyebrow">${factionDot(profile)}@${escapeHTML(profile.username)}</div>
          ${profile.title ? `<div class="profile-title" style="--title-bg:${safeTitleColor(profile.title_color)}">${escapeHTML(profile.title)}</div>` : '<div class="section-subtitle">Perfil público</div>'}
          ${trophyRoom(publicState.achievements)}
        </div>
      </div>
      <div class="section-head"><div><h1 class="section-title">Estante de @${escapeHTML(profile.username)}</h1><div class="section-subtitle">${publicState.followerCount || 0} seguidores · ${publicState.followingCount || 0} seguindo · Coleções públicas do perfil</div></div><div class="profile-actions">${canFollow ? `<button class="small-btn follow-button ${publicState.isFollowing ? "is-following" : ""}" data-follow-profile>${publicState.isFollowing ? "Seguindo" : "Seguir"}</button>` : ""}${canBlock ? `<button class="small-btn block-button" data-block-profile>Bloquear</button>` : ""}<button class="small-btn" data-section="home">Voltar ao início</button>${canModerate ? `<button class="small-btn moderation-button" data-open-moderation>Moderação</button>` : ""}</div></div>
      ${savedVisible ? shelfCollectionMarkup("Salvos", savedItems, "public-saved", publicState.readingProgress, publicState.favoriteIds) : '<div class="notice">A coleção Salvos está oculta neste perfil.</div>'}
      ${seriesVisible ? shelfCollectionMarkup("Séries salvas", savedSeries, "public-series-saved", publicState.readingProgress, publicState.favoriteIds, "", null, true) : '<div class="notice">A coleção Séries salvas está oculta neste perfil.</div>'}
      ${readVisible ? shelfCollectionMarkup("Lidos", readItems, "public-read", publicState.readingProgress, publicState.favoriteIds) : '<div class="notice">A coleção Lidos está oculta neste perfil.</div>'}
      ${completedVisible ? shelfCollectionMarkup("Concluídos", completedItems, "public-completed", publicState.readingProgress, publicState.favoriteIds, "", null, true) : '<div class="notice">A coleção Concluídos está oculta neste perfil.</div>'}
      ${likedVisible ? shelfCollectionMarkup("Curtidos", likedItems, "public-liked", publicState.readingProgress, publicState.favoriteIds) : '<div class="notice">A coleção Curtidos está oculta neste perfil.</div>'}
      ${publicCategories.map(category => { const items = publicCollectionItems(category, publicState); const liked = publicState.collectionLikes?.has(category.id); const likes = publicState.collectionLikeCounts?.get(category.id) || 0; return shelfCollectionMarkup(category.name, items, `public-category:${category.id}`, publicState.readingProgress, publicState.favoriteIds, `<span class="shelf-visibility is-public">Pública</span><button class="small-btn ${liked ? "is-liked" : ""}" data-like-collection="${escapeHTML(category.id)}" data-like-owner="${escapeHTML(profile.id)}">${liked ? "♥" : "♡"} ${likes}</button><a class="small-btn" href="${escapeHTML(publicProfileHref(profile.username, category.id))}">Abrir coleção</a><button class="small-btn" data-copy-collection="${escapeHTML(category.id)}" data-copy-username="${escapeHTML(profile.username)}">Compartilhar</button>`); }).join("")}
    </div>`;
  }

  function renderCatalog(type = null) {
    const items = type ? state.db.library.filter(x => x.type === type) : state.db.library;
    return `
      <div class="content">
        <div class="section-head">
          <div>
            <h1 class="section-title">${type === "manga" ? "Mangás" : type === "comic" ? "Quadrinhos" : "Catálogo"}</h1>
            <div class="section-subtitle">${items.length} edição(ões)</div>
          </div>
        </div>
        <div class="results-grid">${uniqueCatalogItems(items).map(item => card(item)).join("") || `<div class="empty">Nenhuma edição cadastrada.</div>`}</div>
      </div>`;
  }

  function renderSearch() {
    const q = state.search.trim().toLowerCase();
    const matchingEditions = uniqueCatalogItems(state.db.library.filter(x => {
      const hay = [x.title,x.seriesTitle,x.issue,x.author,x.publisher,x.imprint,x.character,x.description,...(x.tags||[])].join(" ").toLowerCase();
      return !q || hay.includes(q);
    }));
    const seenSeries = new Set();
    const results = matchingEditions.filter(item => {
      if (!item.seriesId) return true;
      if (seenSeries.has(item.seriesId)) return false;
      seenSeries.add(item.seriesId);
      return true;
    });
    const initialOrder = ["0-9", ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ".split(""), "#"];
    const initialFor = item => {
      const initial = String(item.seriesTitle || item.title || "").trim().charAt(0).toUpperCase();
      return /[0-9]/.test(initial) ? "0-9" : /^[A-Z]$/.test(initial) ? initial : "#";
    };
    const grouped = new Map();
    results.forEach(item => {
      const publisher = String(item.publisher || "Sem editora").trim() || "Sem editora";
      const imprint = String(item.imprint || "Sem selo").trim() || "Sem selo";
      if (!grouped.has(publisher)) grouped.set(publisher, new Map());
      if (!grouped.get(publisher).has(imprint)) grouped.get(publisher).set(imprint, new Map());
      const initial = initialFor(item);
      if (!grouped.get(publisher).get(imprint).has(initial)) grouped.get(publisher).get(imprint).set(initial, []);
      grouped.get(publisher).get(imprint).get(initial).push(item);
    });
    const publisherMarkup = [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b, "pt-BR")).map(([publisher, imprints]) => `
      <section class="section search-publisher">
        <div class="section-head"><div><h2 class="section-title">${escapeHTML(publisher)}</h2><div class="section-subtitle">Editora</div></div></div>
        ${[...imprints.entries()].sort(([a], [b]) => a.localeCompare(b, "pt-BR")).map(([imprint, initials]) => `
          <section class="search-imprint">
            <div class="section-head"><div><h3 class="section-title">${escapeHTML(imprint)}</h3><div class="section-subtitle">Selo</div></div></div>
            ${initialOrder.filter(initial => initials.has(initial)).map(initial => `
              <section class="search-initial">
                <h4 class="search-initial-title">${initial}</h4>
                <div class="results-grid">${initials.get(initial).sort((a, b) => (a.seriesTitle || a.title).localeCompare(b.seriesTitle || b.title, "pt-BR")).map(item => item.seriesId ? seriesCard(item) : card(item)).join("")}</div>
              </section>`).join("")}
          </section>`).join("")}
      </section>`).join("");
    return `
      <div class="content">
        <div class="section">
          <h1 class="section-title">Pesquisar</h1>
          <div class="search-wrap">
            <input id="search-input" class="search-input" value="${escapeHTML(state.search)}" placeholder="Título, autor, personagem, gênero, edição…">
            <button class="btn btn-danger" data-action="do-search">Pesquisar</button>
          </div>
          <div class="section-subtitle">${results.length} resultado(s)</div>
          <div style="margin-top:15px">${publisherMarkup || `<div class="empty">Nada encontrado.</div>`}</div>
        </div>
      </div>`;
  }

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

  function renderCollectionPage() {
    const collection = state.db.collections.find(item => item.id === state.collectionId);
    if (!collection) return renderCollections();
    const items = collection.issueIds.map(id => state.db.library.find(item => item.id === id)).filter(Boolean);
    return `<div class="content collection-page"><div class="section-head"><div><div class="eyebrow">Coleção</div><h1 class="section-title">${escapeHTML(collection.title)}</h1><div class="section-subtitle">${items.length} edição(ões)</div></div><button class="small-btn" data-section="collections">Voltar às coleções</button></div><p class="section-subtitle">${escapeHTML(collection.description || "")}</p><div class="results-grid">${items.map(item => card(item)).join("") || '<div class="empty">Coleção vazia.</div>'}</div></div>`;
  }

  async function markNotificationRead(notificationId) {
    const notification = state.notifications.find(item => String(item.id) === String(notificationId));
    if (!notification || notification.read_at || !sb || !state.session) return;
    const result = await sb.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", notification.id).eq("user_id", state.session.user.id);
    if (result.error) return toast("Não foi possível marcar a notificação como lida.");
    notification.read_at = new Date().toISOString();
    state.notificationUnreadCount = Math.max(0, state.notificationUnreadCount - 1);
    render();
  }

  async function markAllNotificationsRead() {
    if (!sb || !state.session || !state.notificationUnreadCount) return;
    const result = await sb.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", state.session.user.id).is("read_at", null);
    if (result.error) return toast("Não foi possível marcar as notificações.");
    state.notifications.forEach(notification => { notification.read_at ||= new Date().toISOString(); });
    state.notificationUnreadCount = 0;
    render();
  }

  function notificationIcon(type) {
    if (type === "profile_wall_comment") return "💬";
    if (type === "profile_wall_reply") return "↩";
    return ({ achievement: "🏆", moderation: "⚖", plan: "★", message: "✉", chat_mention: "@", follow: "♥", collection_like: "♥", comment_reply: "↩", comment_like: "♥", mention: "@", announcement: "!" }[type] || "•");
  }

  function sortDownloadRows(rows, sortOrder = "added_desc") {
    return rows.map((row, index) => ({ row, index })).sort((a, b) => {
      const itemA = a.row.item;
      const itemB = b.row.item;
      if (sortOrder === "title_asc" || sortOrder === "title_desc") {
        const result = itemDisplayTitle(itemA).localeCompare(itemDisplayTitle(itemB), "pt-BR", { sensitivity: "base" });
        return sortOrder === "title_desc" ? -result : result;
      }
      if (sortOrder === "likes_asc" || sortOrder === "likes_desc") {
        const result = (state.comicLikeCounts.get(itemA.id) || 0) - (state.comicLikeCounts.get(itemB.id) || 0);
        return sortOrder === "likes_desc" ? -result : result;
      }
      if (sortOrder === "reads_asc" || sortOrder === "reads_desc") {
        const result = (Number(itemA.clicks) || 0) - (Number(itemB.clicks) || 0);
        return sortOrder === "reads_desc" ? -result : result;
      }
      if (sortOrder === "year_asc" || sortOrder === "year_desc") {
        const result = (Number(itemA.year) || 0) - (Number(itemB.year) || 0) || itemDisplayTitle(itemA).localeCompare(itemDisplayTitle(itemB), "pt-BR");
        return sortOrder === "year_desc" ? -result : result;
      }
      const dateA = new Date(a.row.entry.completedAt || a.row.entry.startedAt || 0).getTime() || 0;
      const dateB = new Date(b.row.entry.completedAt || b.row.entry.startedAt || 0).getTime() || 0;
      const result = dateA - dateB || a.index - b.index;
      return sortOrder === "added_asc" ? result : -result;
    }).map(entry => entry.row);
  }

  function renderDownloadsPage() {
    if (!state.session) return renderLoginPage();
    const entries = [...state.downloads.values()].sort((a, b) => {
      const aPending = a.status !== "completed";
      const bPending = b.status !== "completed";
      if (aPending && bPending) return new Date(a.startedAt || 0) - new Date(b.startedAt || 0);
      if (aPending !== bPending) return aPending ? -1 : 1;
      return new Date(b.completedAt || b.startedAt || 0) - new Date(a.completedAt || a.startedAt || 0);
    });
    const items = entries.map(entry => {
      const catalogItem = state.db.library.find(item => String(item.id) === String(entry.id));
      const item = catalogItem && entry.snapshot ? { ...catalogItem, ...entry.snapshot } : catalogItem || entry.snapshot || { id: entry.id, title: entry.title || "Quadrinho", type: "comic", format: extension(entry.url), fileUrl: entry.url };
      return { entry, item };
    }).filter(row => row.item);
    hydrateOfflineCoverData(items);
    const pendingItems = items.filter(({ entry }) => entry.status !== "completed");
    const completedItems = items.filter(({ entry }) => entry.status === "completed");
    if (navigator.onLine !== false && !state.session?.offline) completedItems.forEach(({ entry, item }) => hydrateDownloadedCover(entry, item));
    const completedSortOrder = state.downloadsSortOrder || "added_desc";
    const orderedCompletedItems = sortDownloadRows(completedItems, completedSortOrder);
    const completedGroups = new Map();
    orderedCompletedItems.forEach(row => {
      const key = row.item.seriesId || "__downloads-oneshots";
      if (!completedGroups.has(key)) completedGroups.set(key, []);
      completedGroups.get(key).push(row);
    });
    completedGroups.forEach((group, seriesId) => {
      const ordered = sortDownloadRows(group, state.downloadsSeriesSortOrders?.[seriesId] || completedSortOrder);
      group.splice(0, group.length, ...ordered);
      group.sort = () => group;
    });
    const dateLabel = value => {
      const date = new Date(value || 0);
      return Number.isNaN(date.getTime()) ? "Data desconhecida" : date.toLocaleDateString("pt-BR");
    };
    const pendingMarkup = pendingItems.length ? `<section class="downloads-pending"><div class="section-head"><div><h2 class="section-title">Baixando</h2><div class="section-subtitle">Downloads em andamento ou interrompidos</div></div></div><div class="downloads-list" data-downloads-list>${pendingItems.map(({ entry, item }) => { const downloading = entry.status === "downloading"; const progress = entry.progress ? ` · ${Math.round(entry.progress)}%` : ""; return `<article class="download-item" data-download-row="${escapeHTML(item.id)}"><div class="download-cover" style="background-image:url('${escapeHTML(coverFor(item, "card"))}')"></div><div class="download-info"><h3>${escapeHTML(itemDisplayTitle(item))}</h3><span class="section-subtitle">${downloading ? `Baixando${progress}` : `Baixamento interrompido${progress}`}</span><progress max="100" value="${Number(entry.progress || 0).toFixed(1)}"></progress><div class="download-actions"><button class="small-btn" data-open-download="${escapeHTML(item.id)}" ${downloading ? "disabled" : ""}>${downloading ? `Baixando…` : `Retomar download`}</button><button class="small-btn danger" data-delete-download="${escapeHTML(item.id)}">Excluir</button></div></div></article>`; }).join("")}</div></section>` : "";
    const completedMarkup = completedGroups.size ? `<section class="downloads-completed"><div class="section-head"><div><h2 class="section-title">Disponíveis offline</h2><div class="section-subtitle">Organizados por série</div></div></div>${[...completedGroups.entries()].map(([seriesId, group]) => { const seriesName = seriesId === "__downloads-oneshots" ? "Quadrinhos avulsos" : (group[0].item.seriesTitle || group[0].item.title || "Série"); return `<section class="downloads-series"><div class="downloads-series-head"><h3>${escapeHTML(seriesName)}</h3><span>${group.length} ${group.length === 1 ? "edição" : "edições"}</span></div><div class="downloads-carousel">${group.sort((a, b) => new Date(b.entry.completedAt || b.entry.startedAt || 0) - new Date(a.entry.completedAt || a.entry.startedAt || 0)).map(({ entry, item }) => `<article class="download-card" data-download-row="${escapeHTML(item.id)}"><div class="download-card-cover download-cover-clickable" data-open-download-cover="${escapeHTML(item.id)}" role="button" tabindex="0" aria-label="Ler ${escapeHTML(itemDisplayTitle(item))}" style="background-image:url('${escapeHTML(coverFor(item, "card"))}')"></div><div class="download-card-body"><h4>${escapeHTML(itemDisplayTitle(item))}</h4><span>${escapeHTML(item.issue ? `Edição ${item.issue}` : `Edição única`)} · ${escapeHTML(dateLabel(entry.completedAt || entry.startedAt))}</span><div class="download-card-actions"><button class="small-btn" data-open-download="${escapeHTML(item.id)}">Ler</button><button class="small-btn danger" data-delete-download="${escapeHTML(item.id)}">Excluir</button></div></div></article>`).join("")}</div></section>`; }).join("")}</section>` : "";
    return `<div class="content downloads-page"><div class="section-head"><div><div class="eyebrow">Neste navegador</div><h1 class="section-title">Downloads</h1><div class="section-subtitle">Leia seus quadrinhos offline e abra mais rápido. Nada é salvo como arquivo no computador.</div></div></div>${pendingMarkup}${completedMarkup || (!pendingMarkup ? `<div class="empty">Você ainda não baixou nenhum quadrinho.</div>` : "")}</div>`;
    return `<div class="content downloads-page"><div class="section-head"><div><div class="eyebrow">Neste navegador</div><h1 class="section-title">Downloads</h1><div class="section-subtitle">Leia seus quadrinhos offline e abra mais rápido. Nada é salvo como arquivo no computador.</div></div></div><div class="downloads-list" data-downloads-list>${items.map(({ entry, item }) => { const completed = entry.status === "completed"; const downloading = entry.status === "downloading"; const progress = entry.progress ? ` · ${Math.round(entry.progress)}%` : ""; return `<article class="download-item" data-download-row="${escapeHTML(item.id)}"><div class="download-cover download-cover-clickable" data-open-download-cover="${escapeHTML(item.id)}" role="button" tabindex="${completed ? "0" : "-1"}" aria-label="Ler ${escapeHTML(itemDisplayTitle(item))}" style="background-image:url('${escapeHTML(coverFor(item, "card"))}')"></div><div class="download-info"><h3>${escapeHTML(itemDisplayTitle(item))}</h3><span class="section-subtitle">${completed ? "Disponível offline" : downloading ? `Baixando${progress}` : `Baixamento interrompido${progress}`}</span>${!completed ? `<progress max="100" value="${Number(entry.progress || 0).toFixed(1)}"></progress>` : ""}<div class="download-actions"><button class="small-btn" data-open-download="${escapeHTML(item.id)}" ${downloading ? "disabled" : ""}>${completed ? "Ler offline" : downloading ? "Baixando…" : "Retomar download"}</button><button class="small-btn danger" data-delete-download="${escapeHTML(item.id)}">Excluir</button></div></div></article>`; }).join("") || '<div class="empty">Você ainda não baixou nenhum quadrinho.</div>'}</div></div>`;
  }
  function renderDownloadsProgress() {
    if (state.section !== "downloads") return;
    [...state.downloads.values()].forEach(entry => { const row = $(`[data-download-row="${CSS.escape(String(entry.id))}"]`); if (!row) return; const progress = $("progress", row); const subtitle = $(".section-subtitle", row); if (progress) progress.value = Number(entry.progress || 0); if (subtitle) subtitle.textContent = `Baixando · ${Math.round(entry.progress || 0)}%`; });
  }

  function rankingMemberMarkup(member, showRank = false) {
    const online = member.is_online === true;
    const current = state.session?.user?.id === member.user_id;
    const staff = ["moderator", "admin"].includes(member.plan);
    const faction = state.factions.find(item => item.id === member.faction_id);
    const lineColor = staff ? "#ffffff" : faction?.color || "#ffffff";
    const rank = showRank && member.ranking ? `<span class="ranking-position">${member.ranking}º</span>` : "";
    const title = member.title ? `<span class="ranking-title" style="--title-bg:${safeTitleColor(member.title_color)}">${escapeHTML(member.title)}</span>` : "";
    return `<a class="ranking-member ${current ? "is-current" : ""}" style="--member-faction-color:${escapeHTML(lineColor)}" href="${escapeHTML(publicProfileHref(member.username))}">${rank}<span class="ranking-avatar-wrap ${online ? "is-online" : ""}">${avatarMarkup(member, "ranking-avatar")}<span class="ranking-online-dot" aria-label="Online"></span></span><span class="ranking-member-copy"><strong>${factionDot({ faction_id: member.faction_id })}@${escapeHTML(member.username)}</strong>${title}<small>Nível ${member.level} · ${Number(member.xp || 0).toLocaleString("pt-BR")} XP</small></span><span class="ranking-period-xp">+${Number(member.period_xp || 0).toLocaleString("pt-BR")} XP</span></a>`;
  }

  function rankingCategoryMembers(members, plan) {
    return members.filter(member => plan === "staff" ? ["moderator", "admin"].includes(member.plan) : member.plan === plan)
      .sort((a, b) => Number(b.level || 1) - Number(a.level || 1) || Number(b.xp || 0) - Number(a.xp || 0) || String(a.username).localeCompare(String(b.username), "pt-BR"));
  }

  function renderRankingCategoryPage(members) {
    const labels = { staff: "Moderadores", premium: "Lenda", free: "Comum" };
    const plan = labels[state.rankingCategory] ? state.rankingCategory : "free";
    const group = rankingCategoryMembers(members, plan);
    return `<div class="content ranking-page ranking-category-page"><div class="section-head"><div><div class="eyebrow">Diretório da comunidade</div><h1 class="section-title">Usuários ${labels[plan]}</h1><div class="section-subtitle">Todos os usuários desta categoria, ordenados por nível.</div></div><button class="small-btn" data-ranking-back>Voltar ao ranking</button></div><section class="section ranking-directory"><div class="ranking-member-list ranking-member-list-full">${group.map(member => rankingMemberMarkup(member, true)).join("") || '<div class="empty">Nenhum usuário nesta categoria.</div>'}</div></section></div>`;
  }

  function renderRankingPage() {
    const members = state.rankingMembers || [];
    if (state.rankingCategory) return renderRankingCategoryPage(members);
    const eligibleMembers = members.filter(member => ["free", "premium"].includes(member.plan) && (!state.rankingFaction || member.faction_id === state.rankingFaction));
    const periodLabels = { day: "24 horas", week: "7 dias", all: "Hall da fama" };
    const topMembers = eligibleMembers.slice(0, 3);
    const groups = [
      ["staff", "Moderadores"],
      ["premium", "Lenda"],
      ["free", "Comum"]
    ];
    return `<div class="content ranking-page"><div class="section-head"><div><div class="eyebrow">Atividade da comunidade</div><h1 class="section-title">Ranking</h1><div class="section-subtitle">Ganhe XP lendo, participando e mantendo seu check-in diário.</div></div>${state.profile ? `<div class="ranking-self"><strong>Nível ${state.profile.level || 1}</strong><span>${Number(state.profile.xp || 0).toLocaleString("pt-BR")} XP · Check-in: 🔥 ${state.profile.daily_streak || 0} dia(s)</span></div>` : ""}</div><section class="section ranking-benefits"><div class="section-head"><div><h2 class="section-title">Vantagens por plano</h2><div class="section-subtitle">Todos podem ganhar XP; os planos liberam recursos diferentes.</div></div></div><div class="ranking-benefit-grid"><article class="ranking-benefit-card"><strong>Free</strong><p>Leitura do catálogo, check-in diário, XP e participação no ranking.</p></article><article class="ranking-benefit-card is-premium"><strong>Premium</strong><p>Todos os benefícios Free, capas variantes, estilos de capa e posição no ranking.</p></article><article class="ranking-benefit-card is-moderator"><strong>Moderador</strong><p>Recursos Premium, ferramentas de moderação, gestão da comunidade e destaque de coleções.</p></article></div></section><div class="ranking-tabs">${Object.entries(periodLabels).map(([period, label]) => `<button class="small-btn ${state.rankingPeriod === period ? "is-active" : ""}" data-ranking-period="${period}">${label}</button>`).join("")}</div><div class="ranking-faction-tabs"><button class="small-btn ${!state.rankingFaction ? "is-active" : ""}" data-ranking-faction="">Todas as facções</button>${state.factions.map(faction => `<button class="small-btn ${state.rankingFaction === faction.id ? "is-active" : ""}" data-ranking-faction="${escapeHTML(faction.id)}" style="--faction-filter-color:${escapeHTML(faction.color)}"><span class="faction-dot" style="--faction-color:${escapeHTML(faction.color)}"></span>${escapeHTML(faction.name)}</button>`).join("")}</div>${state.rankingLoading ? '<div class="empty">Carregando ranking...</div>' : !eligibleMembers.length ? '<div class="empty">Ainda não há participantes Free ou Premium nesta seleção.</div>' : `<section class="section ranking-leaders"><div class="section-head"><div><h2 class="section-title">Membros mais ativos</h2><div class="section-subtitle">${periodLabels[state.rankingPeriod]} · moderadores e administradores não disputam posições.</div></div></div><div class="ranking-top-grid">${topMembers.map(member => `<div class="ranking-top-card"><span class="ranking-top-place">${member.ranking}º</span>${rankingMemberMarkup(member)}</div>`).join("")}</div></section>`}<section class="section ranking-directory"><div class="section-head"><div><h2 class="section-title">Todos os usuários</h2><div class="section-subtitle">Organizados por tipo de conta e com presença online.</div></div></div>${groups.map(([plan, label]) => { const group = plan === "staff" ? members.filter(member => ["moderator", "admin"].includes(member.plan)) : members.filter(member => member.plan === plan && (!state.rankingFaction || member.faction_id === state.rankingFaction)); const sectionFactionId = state.profile?.faction_id; const sectionColor = state.factions.find(faction => faction.id === sectionFactionId)?.color || "#ffffff"; return `<section class="ranking-group ranking-group-abafac linhafac" style="--ranking-section-color:${escapeHTML(sectionColor)}"><h3>${label}<span>${group.length}</span></h3><div class="ranking-member-list">${group.map(member => rankingMemberMarkup(member, true)).join("") || '<div class="empty">Nenhum usuário nesta categoria.</div>'}</div></section>`; }).join("")}</section></div>`;
  }

  function legacyFactionLeadershipMarkup(factionId) {
    const role = state.factionRoles.find(item => item.faction_id === factionId && item.user_id === state.session?.user?.id);
    const members = state.factionRoleMembers.filter(item => item.faction_id === factionId);
    const leader = members.find(item => item.role === "leader");
    const curators = members.filter(item => item.role === "curator").sort((a, b) => a.slot - b.slot);
    const person = item => item?.profile ? `<span class="faction-role-person">${avatarMarkup(item.profile, "faction-role-avatar")}<strong>@${escapeHTML(item.profile.username)}</strong></span>` : '<span class="faction-role-person faction-role-empty">Vaga disponível</span>';
    const currentRole = role ? (role.role === "leader" ? "líder" : "curador") : "membro";
    return `<section class="section faction-leadership-tools"><div class="section-head"><div><h2 class="section-title">Cargos da facção</h2><div class="section-subtitle">Líder: ${person(leader)} · Curadores: ${curators.length}/3</div></div></div><div class="faction-role-list"><div><small>Líder</small>${person(leader)}</div><div><small>Curadores</small>${[1, 2, 3].map(slot => person(curators.find(item => item.slot === slot))).join("")}</div></div>${role ? `<p class="faction-management-note">Você é ${currentRole}. ${role.role === "leader" ? "O líder pode editar a identidade, promover curadores ou desistir do cargo." : "Os curadores organizam a página e os eventos em conjunto."}</p>${role.role === "leader" ? '<div class="faction-leader-actions"><button class="small-btn" data-faction-edit-identity>Editar identidade</button><button class="small-btn" data-faction-resign>Desistir da liderança</button></div>' : ""}` : '<p class="faction-management-note">Os cargos são preenchidos automaticamente conforme a atividade dos membros.</p>'}</section>`;
  }

  function factionLeadershipMarkup(factionId) {
    const role = state.factionRoles.find(item => item.faction_id === factionId && item.user_id === state.session?.user?.id);
    const roles = state.factionRoleMembers.filter(item => item.faction_id === factionId);
    const leader = roles.find(item => item.role === "leader");
    const curators = roles.filter(item => item.role === "curator").sort((a, b) => a.slot - b.slot);
    const roleCard = (item, label, slot = "") => item ? `<article class="faction-featured-role-card" style="--faction-color:${escapeHTML(state.factions.find(faction => faction.id === factionId)?.color || "#e85b68")}">${item.profile ? avatarMarkup(item.profile, "faction-role-avatar") : ""}<div><strong>${item.profile ? `@${escapeHTML(item.profile.username)}` : "Membro da facção"}</strong><span>${label}${slot ? ` ${slot}` : ""}</span></div></article>` : `<article class="faction-featured-role-card is-empty" style="--faction-color:${escapeHTML(state.factions.find(faction => faction.id === factionId)?.color || "#e85b68")}"><div><strong>Vaga disponível</strong><span>${label}${slot ? ` ${slot}` : ""}</span></div></article>`;
    const memberCards = state.factionMembers.filter(item => item.faction_id === factionId).sort((a, b) => new Date(b.joined_at || 0) - new Date(a.joined_at || 0)).slice(0, 4).map(member => {
      if (!member.profile) return "";
      const memberRole = roles.find(item => item.user_id === member.user_id);
      const roleLabel = memberRole ? memberRole.role === "leader" ? "Líder" : `Curador ${memberRole.slot}` : "Membro";
      return `<article class="faction-member-card" style="--faction-color:${escapeHTML(state.factions.find(faction => faction.id === factionId)?.color || "#e85b68")}">${avatarMarkup(member.profile, "faction-member-avatar")}<div><strong>@${escapeHTML(member.profile.username)}</strong>${member.profile.title ? `<small>${escapeHTML(member.profile.title)}</small>` : ""}<span class="faction-member-role">${roleLabel}</span></div></article>`;
    }).join("");
    return `<section class="section faction-leadership-tools"><div class="section-head"><div><h2 class="section-title">Cargos da facção</h2><div class="section-subtitle">Liderança e curadoria em destaque.</div></div></div><div class="faction-featured-role-grid">${roleCard(leader, "Líder")}${[1, 2, 3].map(slot => roleCard(curators.find(item => item.slot === slot), "Curador", slot)).join("")}</div>${role ? `<p class="faction-management-note">Você é ${role.role === "leader" ? "líder" : "curador"}. ${role.role === "leader" ? "O líder pode editar a identidade, promover curadores ou desistir do cargo." : "Os curadores organizam a página e os eventos em conjunto."}</p>${role.role === "leader" ? '<div class="faction-leader-actions"><button class="small-btn" data-faction-edit-identity>Editar identidade</button><button class="small-btn" data-faction-resign>Desistir da liderança</button></div>' : ""}` : ""}</section><section class="section faction-members-section"><div class="section-head"><div><h2 class="section-title">Membros da facção</h2><div class="section-subtitle">Todos os membros desta facção.</div></div></div><div class="faction-member-grid">${memberCards || '<div class="empty">Nenhum membro encontrado.</div>'}</div></section>`;
  }

  function factionAbafacOrder(factionId) {
    const faction = state.factions.find(item => item.id === factionId);
    const saved = faction?.abafac_order;
    const allowed = ["stats", ...(faction?.abafac_catalog_url ? ["catalog"] : []), "leadership", "members", ...state.factionAbafacImages.filter(image => image.faction_id === factionId).map(image => `image:${image.id}`)];
    if (!Array.isArray(saved)) return allowed;
    const order = [...new Set(saved.filter(key => allowed.includes(key)))];
    if (!order.includes("stats")) order.unshift("stats");
    return [...order, ...allowed.filter(key => !order.includes(key))];
  }

  function normalizeInternalFactionLink(value) {
    const raw = String(value || "").trim();
    if (!raw) return null;
    const isCompleteUrl = /^https?:\/\//i.test(raw);
    if (raw.startsWith("//") || raw.includes("\\") || (/^[a-z][a-z0-9+.-]*:/i.test(raw) && !isCompleteUrl)) return false;
    try {
      const url = new URL(raw, window.location.href);
      const allowedHosts = new Set([window.location.hostname, "localhost", "127.0.0.1", "uriel29m.github.io"]);
      if (!['http:', 'https:'].includes(url.protocol) || !allowedHosts.has(url.hostname.toLowerCase()) || url.username || url.password) return false;
      return `${isCompleteUrl ? window.location.pathname : url.pathname}${url.search}${url.hash}`;
    } catch {
      return false;
    }
  }

  async function isRealInternalFactionLink(value) {
    const normalized = normalizeInternalFactionLink(value);
    if (normalized === false) return false;
    if (normalized === null) return true;
    const url = new URL(normalized, window.location.href);
    const currentPath = window.location.pathname;
    const appPaths = new Set([
      currentPath,
      currentPath.endsWith("/index.html") ? currentPath.slice(0, -"index.html".length) : `${currentPath.replace(/\/$/, "")}/index.html`,
      currentPath.endsWith("/") ? `${currentPath}index.html` : `${currentPath}/index.html`
    ]);
    if (!appPaths.has(url.pathname)) return false;
    const page = url.searchParams.get("pagina") || "";
    const knownPages = new Set(Object.values(sectionRoutes).filter(Boolean));
    const hasCollectionRoute = url.searchParams.has("colecao");
    const username = String(url.searchParams.get("perfil") || "").trim();
    if (page && !knownPages.has(page)) return false;
    if (!page && !hasCollectionRoute && username) {
      if (!/^[A-Za-z0-9_]{3,24}$/.test(username)) return false;
      const profile = await sb.from("profiles").select("id").ilike("username", username).maybeSingle();
      return !profile.error && Boolean(profile.data);
    }
    if (hasCollectionRoute) {
      const collectionId = String(url.searchParams.get("colecao") || "").trim();
      if (!collectionId) return false;
      const collection = await sb.from("shelf_collections").select("id").eq("id", collectionId).eq("is_public", true).maybeSingle();
      return !collection.error && Boolean(collection.data);
    }
    if (page === "faccoes" && url.searchParams.has("faccao")) {
      const factionKey = String(url.searchParams.get("faccao") || "");
      return state.factions.some(faction => faction.id === factionKey || String(faction.page_key) === factionKey);
    }
    if (page === "blogs" && url.searchParams.has("blog")) {
      const blogId = Number(url.searchParams.get("blog"));
      if (!Number.isInteger(blogId)) return false;
      const blog = await sb.from("blog_posts").select("id").eq("id", blogId).eq("status", "published").maybeSingle();
      return !blog.error && Boolean(blog.data);
    }
    return Boolean(!page || knownPages.has(page));
  }

  function parsePublicCatalogLink(value) {
    const raw = String(value || "").trim();
    if (!raw || raw.startsWith("//")) return null;
    try {
      const url = new URL(raw, window.location.origin);
      if (url.origin !== window.location.origin) return null;
      const username = cleanUsername(url.searchParams.get("perfil"));
      const collectionId = String(url.searchParams.get("lista") || "").trim();
      if (!/^[a-z0-9_]{3,24}$/.test(username) || !collectionId || url.searchParams.has("pagina")) return null;
      return { username, collectionId };
    } catch {
      return null;
    }
  }

  async function validatePublicCatalogLink(value) {
    const raw = String(value || "").trim();
    if (!raw) return null;
    const parts = parsePublicCatalogLink(raw);
    if (!parts) return false;
    const owner = await sb.from("profiles").select("id, username").ilike("username", parts.username).maybeSingle();
    if (owner.error || !owner.data) return false;
    const collection = await sb.from("shelf_collections").select("id, is_public, collection_type").eq("id", parts.collectionId).eq("owner_id", owner.data.id).eq("is_public", true).eq("collection_type", "comic").maybeSingle();
    if (collection.error || !collection.data) return false;
    return publicProfileHref(owner.data.username, collection.data.id);
  }

  async function uploadFactionAbafacImage(factionId, file, link) {
    if (!file) return true;
    if (!String(file.type || "").startsWith("image/")) return toast("Escolha um arquivo de imagem.");
    if (file.size > 8 * 1024 * 1024) return toast("A imagem deve ter no máximo 8 MB.");
    const normalizedLink = normalizeInternalFactionLink(link);
    if (normalizedLink === false) return toast("O link da abafac precisa apontar para dentro deste site.");
    const extension = String(file.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
    const path = `${factionId}/${state.session.user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;
    const upload = await sb.storage.from("faction-abafac").upload(path, file, { upsert: false });
    if (upload.error) return toast(upload.error.message || "Não foi possível enviar a imagem.");
    const publicUrl = sb.storage.from("faction-abafac").getPublicUrl(path).data.publicUrl;
    const inserted = await sb.from("faction_abafac_images").insert({ faction_id: factionId, image_url: publicUrl, link_url: normalizedLink, storage_path: path, created_by: state.session.user.id }).select("id").single();
    if (inserted.error) {
      await sb.storage.from("faction-abafac").remove([path]);
      return toast(inserted.error.message || "Não foi possível registrar a imagem.");
    }
    const order = [...factionAbafacOrder(factionId), `image:${inserted.data.id}`];
    const ordered = await sb.rpc("update_faction_abafac_order", { p_faction_id: factionId, p_order: order });
    if (ordered.error) {
      await sb.from("faction_abafac_images").delete().eq("id", inserted.data.id);
      await sb.storage.from("faction-abafac").remove([path]);
      return toast(ordered.error.message || "Não foi possível adicionar a abafac.");
    }
    return true;
  }

  async function removeFactionAbafacImage(factionId, key) {
    const imageId = Number(String(key).split(":")[1]);
    if (!Number.isInteger(imageId)) return;
    const image = state.factionAbafacImages.find(item => item.id === imageId && item.faction_id === factionId);
    const result = await sb.rpc("remove_faction_abafac_image", { p_image_id: imageId });
    if (result.error) return toast(result.error.message || "Não foi possível remover esta imagem.");
    if (image?.storage_path) await sb.storage.from("faction-abafac").remove([image.storage_path]);
    await loadFactions();
    render();
  }

  async function buildPublicProfileActivity(profile, rows, collections) {
    const [comicLikes, blogLikes, collectionLikes, follows, comments, blogComments, wallComments, favorites, blogSaves, collectionSaves, publisherSaves, reads] = rows;
    const blogIds = [...new Set([...blogLikes, ...blogComments, ...blogSaves].map(row => row.blog_id).filter(Boolean))];
    const followIds = [...new Set(follows.map(row => row.following_id).filter(Boolean))];
    const wallProfileIds = [...new Set(wallComments.map(row => row.profile_id).filter(Boolean))];
    const savedOwnerIds = [...new Set(collectionSaves.map(row => row.owner_id).filter(Boolean))];
    const [blogsResult, followsResult, wallProfilesResult, savedOwnersResult] = await Promise.all([
      blogIds.length ? sb.from("blog_posts").select("id, title, status").in("id", blogIds) : { data: [] },
      followIds.length ? sb.from("profiles").select("id, username").in("id", followIds) : { data: [] },
      wallProfileIds.length ? sb.from("profiles").select("id, username").in("id", wallProfileIds) : { data: [] },
      savedOwnerIds.length ? sb.from("profiles").select("id, username").in("id", savedOwnerIds) : { data: [] }
    ]);
    const blogNames = new Map((blogsResult.data || []).map(blog => [String(blog.id), blog.title || "blog"]));
    const profileNames = new Map([...(followsResult.data || []), ...(wallProfilesResult.data || []), ...(savedOwnersResult.data || [])].map(row => [row.id, row.username]));
    const collectionNames = new Map(collections.map(collection => [String(collection.id), { name: collection.name, owner_id: collection.owner_id }]));
    const itemName = itemId => state.db.library.find(item => item.id === itemId)?.title || itemId;
    const itemHref = itemId => routeUrl({ ler: itemId });
    const blogHref = blogId => routeUrl({ pagina: "blogs", blog: blogId });
    const publisherHref = publisherName => routeUrl({ pagina: "entidade", tipo: "publisher", valor: publisherName });
    const collectionHref = (ownerId, collectionId) => {
      const owner = profileNames.get(ownerId) || profile.username;
      return publicProfileHref(owner, collectionId);
    };
    const events = [];
    const add = (rows, type, build, dateKey = "created_at") => rows.forEach(row => events.push({ ...build(row), created_at: row[dateKey] || row.created_at }));
    add(comicLikes, "like", row => ({ icon: "♥", label: "Curtiu o quadrinho", subject: itemName(row.item_id), href: itemHref(row.item_id) }));
    add(blogLikes.filter(row => blogNames.has(String(row.blog_id))), "like", row => ({ icon: "♥", label: "Curtiu o blog", subject: blogNames.get(String(row.blog_id)), href: blogHref(row.blog_id) }));
    add(collectionLikes, "like", row => ({ icon: "♥", label: "Curtiu a coleção", subject: collectionNames.get(String(row.collection_id))?.name || "coleção", href: collectionHref(row.owner_id, row.collection_id) }));
    add(follows, "follow", row => ({ icon: "＋", label: "Seguiu", subject: `@${profileNames.get(row.following_id) || "usuário"}`, href: profileNames.get(row.following_id) ? publicProfileHref(profileNames.get(row.following_id)) : "" }));
    add(comments, "comment", row => ({ icon: "💬", label: "Comentou em", subject: itemName(row.item_id), detail: row.body, href: itemHref(row.item_id) }));
    add(blogComments.filter(row => blogNames.has(String(row.blog_id))), "comment", row => ({ icon: "💬", label: "Comentou em", subject: blogNames.get(String(row.blog_id)), detail: row.body, href: blogHref(row.blog_id) }));
    add(wallComments, "comment", row => ({ icon: "💬", label: "Comentou no mural de", subject: `@${profileNames.get(row.profile_id) || "usuário"}`, detail: row.body, href: profileNames.get(row.profile_id) ? publicProfileHref(profileNames.get(row.profile_id)) : "" }));
    add(favorites, "save", row => ({ icon: "★", label: "Salvou", subject: itemName(row.item_id), href: itemHref(row.item_id) }));
    add(blogSaves.filter(row => blogNames.has(String(row.blog_id))), "save", row => ({ icon: "★", label: "Salvou o blog", subject: blogNames.get(String(row.blog_id)), href: blogHref(row.blog_id) }));
    add(collectionSaves, "save", row => ({ icon: "★", label: "Salvou a coleção", subject: collectionNames.get(String(row.collection_id))?.name || "coleção", href: collectionHref(row.owner_id, row.collection_id) }));
    add(publisherSaves, "save", row => ({ icon: "★", label: "Salvou a editora", subject: row.publisher_name, href: publisherHref(row.publisher_name) }));
    add(reads, "read", row => ({ icon: "✓", label: "Concluiu a leitura de", subject: itemName(row.item_id), href: itemHref(row.item_id) }), "updated_at");
    return events.filter(event => event.created_at).sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 100);
  }

  async function toggleSavePublicCollection(button) {
    if (!state.session) return openAuthPage();
    const collectionId = button.dataset.savePublicCollection;
    const ownerId = button.dataset.savePublicOwner;
    const saved = state.savedPublicCollections?.some(collection => collection.id === collectionId);
    const result = saved
      ? await sb.from("shelf_collection_saves").delete().eq("user_id", state.session.user.id).eq("collection_id", collectionId)
      : await sb.from("shelf_collection_saves").insert({ user_id: state.session.user.id, owner_id: ownerId, collection_id: collectionId });
    if (result.error) return toast(result.error.message || "Não foi possível salvar a coleção.");
    if (saved) state.savedPublicCollections = state.savedPublicCollections.filter(collection => collection.id !== collectionId);
    else {
      const publicProfileCollection = state.publicProfile?.collections?.find(item => item.id === collectionId);
      const collection = [...state.featuredComicCollections, ...state.popularPublicCollections, ...(state.savedPublicCollections || [])].find(item => item.id === collectionId)
        || (publicProfileCollection ? { ...publicProfileCollection, owner_id: ownerId, username: state.publicProfile.profile.username, item_ids: publicProfileCollection.itemIds || [] } : null);
      if (collection) state.savedPublicCollections = [...state.savedPublicCollections, collection];
    }
    render();
  }

  function openFactionAbafacLinkEditor(image) {
    return new Promise(resolve => {
      const overlay = document.createElement("div");
      overlay.className = "modal-backdrop faction-modal-backdrop";
      overlay.innerHTML = `<div class="modal faction-modal faction-abafac-link-modal"><div class="section-head"><div><div class="eyebrow">Imagem abafac</div><h2>Editar link</h2><div class="section-subtitle">Defina o destino que será aberto ao clicar na imagem.</div></div><button type="button" class="small-btn" data-faction-modal-close>Fechar</button></div><form class="faction-identity-form"><label class="field"><span>Link interno da imagem (opcional)</span><input name="link" type="text" maxlength="500" value="${escapeHTML(image?.link_url || "")}" placeholder="?pagina=blogs ou /index.html?pagina=ranking"><small class="faction-identity-help">Aceita somente destinos dentro deste site. Deixe vazio para remover o link.</small></label><div class="modal-actions"><button type="button" class="small-btn" data-faction-modal-cancel>Cancelar</button><button type="submit" class="small-btn faction-modal-primary">Salvar link</button></div></form></div>`;
      const finish = value => { overlay.remove(); resolve(value); };
      const form = $(".faction-identity-form", overlay);
      form.addEventListener("submit", async event => {
        event.preventDefault();
        const normalizedLink = normalizeInternalFactionLink(new FormData(form).get("link"));
        if (normalizedLink === false) return toast("O link da abafac precisa apontar para dentro deste site.");
        if (normalizedLink !== null && !await isRealInternalFactionLink(normalizedLink)) return toast("Informe uma página real deste site.");
        finish(normalizedLink);
      });
      overlay.addEventListener("click", event => { if (event.target === overlay) finish(null); });
      $("[data-faction-modal-close]", overlay).onclick = () => finish(null);
      $("[data-faction-modal-cancel]", overlay).onclick = () => finish(null);
      $("#modal-root").appendChild(overlay);
      $("[name=link]", form).focus();
    });
  }

  async function editFactionAbafacLink(factionId, key) {
    const imageId = Number(String(key).split(":")[1]);
    const image = state.factionAbafacImages.find(item => item.id === imageId && item.faction_id === factionId);
    if (!image) return;
    const link = await openFactionAbafacLinkEditor(image);
    if (link === null) return;
    const result = await sb.rpc("update_faction_abafac_link", { p_image_id: imageId, p_link_url: link });
    if (result.error) return toast(result.error.message || "Não foi possível atualizar o link da imagem.");
    await loadFactions();
    render();
  }

  async function moveFactionAbafac(factionId, key, direction) {
    const order = factionAbafacOrder(factionId);
    const index = order.indexOf(key);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= order.length) return;
    [order[index], order[target]] = [order[target], order[index]];
    const result = await sb.rpc("update_faction_abafac_order", { p_faction_id: factionId, p_order: order });
    if (result.error) return toast(result.error.message || "Não foi possível reorganizar as abas.");
    await loadFactions();
    render();
  }

  async function removeFactionAbafac(factionId, key) {
    const order = factionAbafacOrder(factionId).filter(item => item !== key);
    const result = await sb.rpc("update_faction_abafac_order", { p_faction_id: factionId, p_order: order });
    if (result.error) return toast(result.error.message || "Não foi possível remover esta abafac.");
    await loadFactions();
    render();
  }

  function openFactionAbafacManager(factionId) {
    const labels = { stats: "Resumo da facção", ...(state.factions.find(item => item.id === factionId)?.abafac_catalog_url ? { catalog: "Catálogo público" } : {}), leadership: "Cargos da facção", members: "Membros da facção" };
    state.factionAbafacImages.filter(image => image.faction_id === factionId).forEach(image => { labels[`image:${image.id}`] = "Imagem abafac"; });
    const active = new Set(factionAbafacOrder(factionId));
    const overlay = document.createElement("div");
    overlay.className = "modal-backdrop";
    overlay.innerHTML = `<div class="modal faction-abafac-modal"><div class="section-head"><div><div class="eyebrow">Abafac da facção</div><h2>Gerenciar abas</h2><div class="section-subtitle">As abas fixas removidas podem ser recuperadas e voltarão abaixo das demais. Imagens removidas são apagadas definitivamente.</div></div><button type="button" class="small-btn" data-close>Fechar</button></div><div class="faction-abafac-manager">${Object.entries(labels).map(([key, label]) => `<div class="faction-abafac-manager-row"><span>${label}</span>${active.has(key) ? '<small>Ativa</small>' : `<button type="button" class="small-btn" data-faction-abafac-restore="${key}">Recuperar</button>`}</div>`).join("")}</div></div>`;
    $("#modal-root").appendChild(overlay);
    $("[data-close]", overlay).onclick = () => overlay.remove();
    $$('[data-faction-abafac-restore]', overlay).forEach(button => button.addEventListener("click", async () => {
      const order = [...factionAbafacOrder(factionId), button.dataset.factionAbafacRestore];
      const result = await sb.rpc("update_faction_abafac_order", { p_faction_id: factionId, p_order: order });
      if (result.error) return toast(result.error.message || "Não foi possível recuperar esta abafac.");
      overlay.remove();
      await loadFactions();
      render();
    }));
  }

  function applyFactionAbafacOrder(factionId) {
    const page = $(".faction-detail-page");
    if (!page) return;
    const sections = {
      stats: $(".faction-stats-abafac", page),
      catalog: $(".faction-catalog-abafac", page),
      leadership: $(".faction-leadership-tools", page),
      members: $(".faction-members-section", page)
    };
    state.factionAbafacImages.filter(image => image.faction_id === factionId).forEach(image => {
      const key = `image:${image.id}`;
      const section = document.createElement("section");
      section.className = "section faction-abafac-image-section linhafac";
      section.dataset.factionAbafac = key;
      const imageCard = `<div class="faction-abafac-image-card"><img src="${escapeHTML(image.image_url)}" alt="Imagem abafac da facção" loading="lazy"></div>`;
      const imageContent = image.link_url ? `<a class="faction-abafac-image-link" href="${escapeHTML(image.link_url)}">${imageCard}</a>` : imageCard;
      section.innerHTML = `<div class="faction-abafac-image-layout">${imageContent}</div>`;
      page.appendChild(section);
      sections[key] = section;
    });
    const order = factionAbafacOrder(factionId);
    const role = state.factionRoles.find(item => item.faction_id === factionId && item.user_id === state.session?.user?.id);
    const canManage = role && ["leader", "curator"].includes(role.role);
    const anchor = $(".faction-detail-hero", page);
    let previous = anchor;
    order.forEach((key, index) => {
      const section = sections[key];
      if (!section) return;
      section.hidden = !order.includes(key);
      section.dataset.factionAbafac = key;
      previous?.after(section);
      previous = section;
      if ((!canManage && key !== "members") || $("[data-faction-abafac-controls]", section)) return;
      const head = $(".section-head", section);
      if (!key.startsWith("image:") && key !== "stats" && !head) return;
      const controls = document.createElement("div");
      controls.className = "faction-abafac-controls";
      controls.dataset.factionAbafacControls = "true";
      controls.innerHTML = `${canManage ? `<button type="button" class="small-btn" data-faction-abafac-move="up" data-faction-abafac-key="${key}" ${index === 0 ? "disabled" : ""} title="Mover aba para cima" aria-label="Mover aba para cima">↑</button><button type="button" class="small-btn" data-faction-abafac-move="down" data-faction-abafac-key="${key}" ${index === order.length - 1 ? "disabled" : ""} title="Mover aba para baixo" aria-label="Mover aba para baixo">↓</button>` : ""}${key.startsWith("image:") ? `<button type="button" class="small-btn" data-faction-abafac-link="${key}" title="Editar link da imagem" aria-label="Editar link da imagem">↗</button>` : ""}${key === "members" ? `<button type="button" class="small-btn" data-faction-view-members="${factionId}" title="Ver todos os membros" aria-label="Ver todos os membros">Ver todos</button>` : ""}${canManage && !["stats", "catalog"].includes(key) ? `<button type="button" class="small-btn danger" data-faction-abafac-remove="${key}" title="Remover abafac" aria-label="Remover abafac">×</button>` : ""}`;
      if (key.startsWith("image:")) {
        $(".faction-abafac-image-layout", section)?.appendChild(controls);
      } else if (key === "stats") {
        section.appendChild(controls);
      } else {
        head.appendChild(controls);
      }
      $$('[data-faction-abafac-move]', controls).forEach(button => button.addEventListener("click", () => moveFactionAbafac(factionId, key, button.dataset.factionAbafacMove === "up" ? -1 : 1)));
      $('[data-faction-abafac-link]', controls)?.addEventListener("click", () => editFactionAbafacLink(factionId, key));
      $('[data-faction-view-members]', controls)?.addEventListener("click", () => navigate({ pagina: "faccoes", faccao: factionRouteKey(factionId), membros: "1" }));
      $('[data-faction-abafac-remove]', controls)?.addEventListener("click", () => key.startsWith("image:") ? removeFactionAbafacImage(factionId, key) : removeFactionAbafac(factionId, key));
    });
    Object.entries(sections).forEach(([key, section]) => { if (section && !order.includes(key)) section.hidden = true; });
    $$('[data-faction-resign], .faction-management-note', page).forEach(element => { element.textContent = element.textContent.replaceAll("Desistir da liderança", "Renunciar").replaceAll("desistir do cargo", "renunciar"); });

    if (canManage) {
      const detailHead = $(".faction-detail-page > .section-head");
      const backButton = $("[data-faction-back]", detailHead);
      let detailActions = $(".faction-detail-actions", detailHead);
      if (!detailActions && backButton) {
        detailActions = document.createElement("div");
        detailActions.className = "faction-detail-actions";
        backButton.replaceWith(detailActions);
        detailActions.appendChild(backButton);
      }
      if (detailActions && !$("[data-faction-abafac-manage]", detailActions)) {
        const manageButton = document.createElement("button");
        manageButton.type = "button";
        manageButton.className = "small-btn";
        manageButton.dataset.factionAbafacManage = "true";
        manageButton.textContent = "Gerenciar abafacs";
        manageButton.onclick = () => openFactionAbafacManager(factionId);
        detailActions.appendChild(manageButton);
      }
      const roleActions = $(".faction-leader-actions", page);
      if (detailActions && roleActions) {
        $$('button', roleActions).forEach(button => detailActions.appendChild(button));
        roleActions.remove();
      }
      if (detailActions && role.role === "curator" && !$("[data-faction-resign-curator]", detailActions)) {
        const resignCurator = document.createElement("button");
        resignCurator.type = "button";
        resignCurator.className = "small-btn";
        resignCurator.dataset.factionResignCurator = "true";
        resignCurator.textContent = "Renunciar à curadoria";
        resignCurator.onclick = async () => {
          const result = await sb.rpc("resign_faction_curator");
          if (result.error) return toast(result.error.message || "Não foi possível renunciar à curadoria.");
          await loadFactions();
          render();
        };
        detailActions.appendChild(resignCurator);
      }
    }
  }

  function factionCatalogMarkup(faction) {
    const catalog = state.factionAbafacCatalogs.get(faction.id);
    if (!catalog) return "";
    const ids = Array.isArray(catalog.item_ids) ? catalog.item_ids.map(String) : [];
    const items = ids.map(id => state.db.library.find(item => String(item.id) === id)).filter(Boolean);
    const collectionContext = { id: catalog.id, ownerId: catalog.owner_id, coverStyles: new Map(Object.entries(catalog.cover_styles || {})), coverChoices: new Map(Object.entries(catalog.cover_choices || {})) };
    return `<section class="section faction-catalog-abafac" data-faction-abafac="catalog" style="--faction-color:${escapeHTML(faction.color)}"><div class="section-head"><div><div class="eyebrow">Catálogo público</div><h2 class="section-title">${escapeHTML(catalog.name)}</h2><div class="section-subtitle">Coleção de @${escapeHTML(catalog.username)} · ${items.length} item(ns)</div></div></div><div class="results-grid">${items.map(item => card(item, state.readingProgress, state.favoriteIds, false, null, false, collectionContext)).join("") || '<div class="empty">Nenhuma edição nesta coleção pública.</div>'}</div></section>`;
  }

  function factionMembersResultsMarkup(factionId, search = "") {
    const roles = state.factionRoleMembers.filter(item => item.faction_id === factionId);
    const query = String(search || "").trim().toLocaleLowerCase("pt-BR");
    const members = state.factionMembers
      .filter(item => item.faction_id === factionId && item.profile)
      .filter(item => {
        if (!query) return true;
        const text = `${item.profile.username || ""} ${item.profile.title || ""}`.toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return text.includes(query.normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
      })
      .sort((a, b) => new Date(b.joined_at || 0) - new Date(a.joined_at || 0));
    return members.map(member => {
      const role = roles.find(item => item.user_id === member.user_id);
      const roleLabel = role ? role.role === "leader" ? "Líder" : `Curador ${role.slot}` : "Membro";
      return `<article class="faction-member-card" style="--faction-color:${escapeHTML(state.factions.find(faction => faction.id === factionId)?.color || "#e85b68")}">${avatarMarkup(member.profile, "faction-member-avatar")}<div><strong>@${escapeHTML(member.profile.username)}</strong>${member.profile.title ? `<small>${escapeHTML(member.profile.title)}</small>` : ""}<span class="faction-member-role">${roleLabel}</span></div></article>`;
    }).join("") || '<div class="empty">Nenhum membro corresponde à busca.</div>';
  }

  function renderFactionMembersPage() {
    if (!state.session) return renderLoginPage();
    const faction = state.factions.find(item => item.id === state.factionPageId);
    if (!faction) return renderFactionPage();
    const total = state.factionMembers.filter(item => item.faction_id === faction.id).length;
    return `<div class="content faction-page faction-members-directory" style="--faction-color:${escapeHTML(faction.color)}"><div class="section-head"><div><div class="eyebrow">${escapeHTML(faction.emblem)} ${escapeHTML(faction.name)}</div><h1 class="section-title">Todos os membros</h1><div class="section-subtitle">${total} membro(s) · os mais recentes aparecem primeiro.</div></div><button class="small-btn" data-faction-members-back>Voltar à facção</button></div><section class="section"><label class="ranking-user-search-wrap"><span>Pesquisar membro</span><input id="faction-member-search-input" class="ranking-user-search" type="search" data-faction-members-search value="${escapeHTML(state.factionMemberSearch)}" placeholder="Nome ou título..." autocomplete="off"></label><div class="faction-member-directory-grid" data-faction-member-results>${factionMembersResultsMarkup(faction.id, state.factionMemberSearch)}</div></section></div>`;
  }

  function renderFactionPage() {
    if (!state.session) return renderLoginPage();
    const selected = state.factions.find(faction => faction.id === state.factionPageId);
    if (selected) {
      const stats = state.factionStats.get(selected.id) || { members: 0, xp: 0 };
      return `<div class="content faction-page faction-detail-page" style="--faction-color:${escapeHTML(selected.color)}"><div class="section-head"><div><div class="eyebrow">Página da facção</div><h1 class="section-title">${escapeHTML(selected.emblem)} ${escapeHTML(selected.name)}</h1><div class="section-subtitle">${escapeHTML(selected.description)}</div></div><button class="small-btn" data-faction-back>Voltar às facções</button></div><section class="section faction-detail-hero faction-stats-abafac" data-faction-abafac="stats"><span class="faction-page-emblem">${escapeHTML(selected.emblem)}</span><div class="faction-page-stats faction-stats-copy"><strong>${stats.members} membro(s)</strong><span>${stats.xp.toLocaleString("pt-BR")} XP na temporada</span></div></section>${factionCatalogMarkup(selected)}<section class="section faction-rules"><div class="section-head"><div><h2 class="section-title">A identidade desta facção</h2><div class="section-subtitle">Espaço para história, ordens, eventos e coleções da equipe.</div></div></div><p>Os curadores organizam o conteúdo e os eventos. O líder coordena a equipe e responde pela condução da facção.</p></section></div>`;
    }
    return `<div class="content faction-page"><div class="section-head"><div><div class="eyebrow">Comunidade</div><h1 class="section-title">Facções</h1><div class="section-subtitle">Escolha seu lado, ajude sua equipe e dispute a temporada mensal.</div></div>${state.profile && !["moderator", "admin"].includes(state.profile.plan) ? `<button class="small-btn" data-open-faction-choice>${state.profile.faction_id ? "Trocar facção" : "Escolher facção"}</button>` : ""}</div>${factionOverviewMarkup()}<section class="section faction-rules"><div class="section-head"><div><h2 class="section-title">Como funciona</h2><div class="section-subtitle">A temporada recomeça no primeiro dia de cada mês.</div></div></div><p>Leituras, comentários, blogs, curtidas e participação nos chats geram XP para sua facção. Moderadores e administradores acompanham a disputa, mas não participam dela.</p></section></div>`;
  }

  function renderStaffActivities() {
    if (!state.session || !["moderator", "admin"].includes(state.profile?.plan)) return '<div class="empty">Área restrita à equipe de moderação.</div>';
    const items = state.staffActivities.filter(item => item.kind !== "bot").map(item => item.kind === "bot"
      ? ""
      : `<article class="staff-activity-item"><header><span>⚖ ${escapeHTML(item.actorName)}</span><span>${escapeHTML(formatCommentDate(item.created_at))}</span></header><strong>${escapeHTML(item.action)}</strong><p>Alvo: @${escapeHTML(item.targetName)}</p>${item.duration_until ? `<small>Até ${escapeHTML(formatCommentDate(item.duration_until))}</small>` : ""}</article>`).join("");
    return `<div class="staff-activity-list">${items || '<div class="empty">Nenhuma ação interna registrada.</div>'}</div>`;
  }

  function coverVariantCandidates(status = "pending") {
    const seen = new Set();
    const creatorKey = value => String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\([^)]*\)/g, "").split(/\s[-–—]\s/)[0].replace(/\b(?:variante|variant|cover|capa|card stock|foil|sketch|blank|design|preto e branco|black and white|dc pride|homenagem)\b.*$/i, "").replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
    const knownCreators = new Set();
    state.coverVariants.forEach((variants, itemId) => variants.forEach(variant => {
      const key = creatorKey(variant.label);
      if (key) knownCreators.add(`${itemId}:${key}`);
    }));
    return state.staffActivities.filter(item => {
      if (item.kind !== "bot" || item.action !== "cover_variant_candidate") return false;
      if (item.status !== status) return false;
      const url = String(item.metadata?.cover_url || "");
      if (!String(item.metadata?.creator || "").trim()) return false;
      if (/(?:logo|favicon|icon|avatar|banner|sprite|button|badge)/i.test(url)) return false;
      if (/dcuguide/i.test(String(item.metadata?.source_url || "")) && !/cover[_%20-]*[b-z]/i.test(url)) return false;
      const catalogItem = state.db.library.find(entry => String(entry.id) === String(item.metadata?.item_id));
      const itemId = String(item.metadata?.item_id || "");
      const candidateCreator = creatorKey(item.metadata?.creator || item.metadata?.label);
      if (status !== "pending") return Boolean(url && candidateCreator);
      if (!candidateCreator || knownCreators.has(`${itemId}:${candidateCreator}`)) return false;
      const imageKeys = value => { let key = String(value || "").trim().split(/[?#]/, 1)[0]; try { key = decodeURIComponent(key); } catch {} key = key.replace(/\/Special:FilePath\//i, "/images/").replace(/\/images\/thumb\/([^/]+\/[^/]+)\/[^/]+\/(?:\d+px-)?(.+)$/i, "/images/$1/$2").toLowerCase(); const file = (key.split("/").pop() || "").replace(/^\d+px[-_]/i, "").replace(/[^a-z0-9]+/gi, ""); return file ? [key, `file:${file}`] : [key]; };
      const keys = imageKeys(url);
      const primaryKeys = imageKeys(catalogItem?.coverUrl);
      const storedKeys = (state.coverVariants.get(String(item.metadata?.item_id)) || []).flatMap(variant => imageKeys(variant.cover_url));
      if (!url || keys.some(key => primaryKeys.includes(key) || storedKeys.includes(key) || seen.has(`${itemId}:${key}`))) return false;
      if (seen.has(`${itemId}:creator:${candidateCreator}`)) return false;
      keys.forEach(key => seen.add(`${itemId}:${key}`));
      seen.add(`${itemId}:creator:${candidateCreator}`);
      return true;
    });
  }

  async function runCoverVariantsBot(button, overlay) {
    button.disabled = true;
    const items = state.db.library.map(item => ({ id: item.id, title: item.title, seriesTitle: item.seriesTitle, originalTitle: item.originalTitle, issue: item.issue, publisher: item.publisher, coverUrl: item.coverUrl }));
    // The Edge Function scans the complete payload. Keep the payload small
    // enough for slow image sources while ensuring every catalog item is sent.
    const batchSize = 10;
    let candidates = 0;
    try {
      for (let offset = 0; offset < items.length; offset += batchSize) {
        const result = await sb.functions.invoke("cover-variants-bot", { body: { items: items.slice(offset, offset + batchSize) } });
        if (result.error) {
          let detail = result.error.message || "Erro ao executar o bot de capas.";
          try { const body = await result.error.context?.json?.(); if (body?.error) detail = body.error; } catch {}
          throw new Error(detail);
        }
        candidates += Number(result.data?.candidates || 0);
      }
    } catch (error) {
      button.disabled = false;
      return toast(error instanceof Error ? error.message : "Não foi possível executar o bot de capas.");
    }
    button.disabled = false;
    await loadStaffActivities();
    overlay?.remove();
    openCoverVariantsReviewPopup();
    toast(`${candidates} capa(s) candidata(s) encontrada(s).`);
  }

  function openCoverVariantsReviewPopup() {
    closeNotificationsPopups();
    const overlay = document.createElement("div");
    overlay.className = "modal-backdrop";
    const reviewTab = ["pending", "approved", "rejected"].includes(state.coverVariantReviewTab) ? state.coverVariantReviewTab : "pending";
    state.coverVariantReviewTab = reviewTab;
    const candidates = coverVariantCandidates(reviewTab);
    const reviewCounts = {
      pending: coverVariantCandidates("pending").length,
      approved: coverVariantCandidates("approved").length,
      rejected: coverVariantCandidates("rejected").length
    };
    const itemFor = candidate => state.db.library.find(item => String(item.id) === String(candidate.metadata?.item_id));
    const cards = candidates.map(candidate => {
      const item = itemFor(candidate);
      const seriesId = item?.seriesId || "";
      const image = candidate.metadata?.cover_url || "";
      const creator = candidate.metadata?.creator || candidate.metadata?.label || "Criador não identificado";
      const decision = candidate.status === "pending"
        ? "Aguardando revisão"
        : `${candidate.status === "approved" ? "Aprovada" : "Rejeitada"} por @${candidate.reviewerName || "administrador"}${candidate.reviewed_at ? ` · ${formatCommentDate(candidate.reviewed_at)}` : ""}`;
      const historyAction = candidate.status === "approved"
        ? `<button class="small-btn danger" data-bot-transition="${candidate.id}" data-status="rejected">Mudar de ideia</button>`
        : `<button class="small-btn" data-bot-transition="${candidate.id}" data-status="pending">Repescar</button>`;
      return `<article class="cover-variant-review-card"><img src="${escapeHTML(proxiedImageUrl(image))}" alt="Capa candidata" loading="lazy"><div class="cover-variant-review-copy"><strong>${escapeHTML(itemDisplayTitle(item) || candidate.title)}</strong><span>Criador: ${escapeHTML(creator)}</span><small>${escapeHTML(image)}</small><small class="cover-variant-review-decision">${escapeHTML(decision)}</small><div class="staff-activity-actions">${seriesId ? `<button class="small-btn" data-bot-series="${escapeHTML(seriesId)}">Série</button>` : ""}${candidate.status === "pending" && state.profile?.plan === "admin" ? `<button class="small-btn" data-bot-review="${candidate.id}" data-status="approved">Aprovar</button><button class="small-btn danger" data-bot-review="${candidate.id}" data-status="rejected">Rejeitar</button>` : state.profile?.plan === "admin" ? historyAction : `<span class="status-pill">${escapeHTML(candidate.status)}</span>`}</div></div></article>`;
    }).join("");
    const tabLabels = { pending: "Pendentes", approved: "Aprovadas", rejected: "Rejeitadas" };
    const tabs = Object.entries(tabLabels).map(([key, label]) => `<button type="button" class="small-btn cover-variant-review-tab ${reviewTab === key ? "is-active" : ""}" data-cover-review-tab="${key}">${label} <span>${reviewCounts[key]}</span></button>`).join("");
    overlay.innerHTML = `<div class="modal cover-variants-review-modal"><div class="section-head"><div><h2>Examinar capas variantes</h2><div class="section-subtitle">Revise as capas encontradas antes de disponibilizá-las no catálogo.</div></div><div class="cover-variants-review-actions"><button class="small-btn danger" data-run-cover-variants-bot>Nova busca</button><button class="small-btn" data-close>Fechar</button></div></div><div class="cover-variant-review-tabs">${tabs}</div><div class="cover-variant-review-list">${cards || `<div class="empty">Nenhuma capa ${reviewTab === "pending" ? "candidata aguardando revisão" : reviewTab === "approved" ? "aprovada" : "rejeitada"}.</div>`}</div></div>`;
    $("#modal-root").appendChild(overlay);
    $$('[data-close]', overlay).forEach(button => button.onclick = () => overlay.remove());
    overlay.addEventListener("click", event => { if (event.target === overlay) overlay.remove(); });
    $$('[data-cover-review-tab]', overlay).forEach(button => button.onclick = () => {
      state.coverVariantReviewTab = button.dataset.coverReviewTab || "pending";
      overlay.remove();
      openCoverVariantsReviewPopup();
    });
    $('[data-remove-bot-variants]', overlay)?.addEventListener("click", event => {
      const batchButton = event.currentTarget;
      openStyledCoverConfirm(`${botVariants.length} capa(s) adicionada(s) pelo bot serão removidas desta edição.`, async () => {
        batchButton.disabled = true;
        const result = await sb.from("comic_cover_variants").delete().eq("item_id", itemId).like("variant_key", "bot-%");
        if (result.error) { batchButton.disabled = false; return toast(result.error.message || "Não foi possível remover as capas do bot."); }
        if (current?.variant_key?.startsWith("bot-") && !collectionId) await sb.from("user_cover_choices").delete().eq("user_id", state.session.user.id).eq("item_id", itemId);
        await loadCoverCatalog();
        overlay.remove();
        toast("Capas adicionadas pelo bot removidas.");
      });
    });
    $('[data-run-cover-variants-bot]', overlay)?.addEventListener("click", event => runCoverVariantsBot(event.currentTarget, overlay));
    $$('[data-bot-series]', overlay).forEach(button => button.onclick = () => {
      const first = state.db.library.find(item => item.seriesId === button.dataset.botSeries);
      if (!first) return toast("Série não encontrada.");
      overlay.remove();
      openSeriesSelection(first, seriesEditions(first), true);
    });
    const attachReviewTooltip = (button, item) => {
      const variants = usableCoverVariants(item);
      const tooltipVariants = item?.coverUrl ? [{ cover_url: item.coverUrl, label: "Capa padrão" }, ...variants] : variants;
      if (!tooltipVariants.length) return;
      const anchor = document.createElement("span");
      anchor.className = "cover-tooltip-anchor";
      const tooltip = document.createElement("span");
      tooltip.className = "cover-image-tooltip";
      tooltip.innerHTML = tooltipVariants.map(variant => `<span class="cover-image-tooltip-item"><img src="${escapeHTML(proxiedImageUrl(variant.cover_url))}" alt="${escapeHTML(variant.label || "Capa variante")}"><small>${escapeHTML(variant.label || "Capa variante")}</small></span>`).join("");
      const positionTooltip = event => requestAnimationFrame(() => {
        const tooltipWidth = Math.min(360, window.innerWidth * .72);
        const rect = tooltip.getBoundingClientRect();
        const gap = 14;
        const preferredLeft = event.clientX + gap;
        const preferredTop = event.clientY + gap;
        const left = preferredLeft + tooltipWidth > window.innerWidth - 8
          ? Math.max(8, event.clientX - tooltipWidth - gap)
          : Math.max(8, preferredLeft);
        const top = preferredTop + rect.height > window.innerHeight - 8
          ? Math.max(8, event.clientY - rect.height - gap)
          : Math.max(8, preferredTop);
        tooltip.style.left = `${left}px`;
        tooltip.style.top = `${top}px`;
        tooltip.style.right = "auto";
        tooltip.style.bottom = "auto";
      });
      anchor.addEventListener("mouseenter", positionTooltip);
      anchor.addEventListener("mousemove", positionTooltip);
      button.parentElement?.insertBefore(anchor, button);
      anchor.append(button, tooltip);
    };
    $$('[data-bot-review]', overlay).forEach(button => {
      const candidate = candidates.find(entry => Number(entry.id) === Number(button.dataset.botReview));
      attachReviewTooltip(button, itemFor(candidate || {}));
    });
    $$('[data-bot-transition]', overlay).forEach(button => button.onclick = () => {
      const actionId = Number(button.dataset.botTransition);
      const nextStatus = button.dataset.status;
      const candidate = candidates.find(entry => Number(entry.id) === actionId);
      const movingFromApproved = candidate?.status === "approved" && nextStatus === "rejected";
      const message = movingFromApproved
        ? "Esta capa será retirada das variantes aprovadas e enviada para Rejeitadas."
        : "Esta capa voltará para Pendentes e poderá ser revisada novamente.";
      openStyledCoverConfirm(message, async () => {
        button.disabled = true;
        const result = await sb.functions.invoke("cover-variants-bot", { body: { action: "change_review_status", action_id: actionId, status: nextStatus } });
        if (result.error) {
          button.disabled = false;
          return toast(result.error.message || "Não foi possível alterar a decisão.");
        }
        state.coverVariantReviewTab = nextStatus;
        overlay.remove();
        await loadCoverCatalog();
        await loadStaffActivities();
        openCoverVariantsReviewPopup();
        toast(movingFromApproved ? "Capa enviada para Rejeitadas." : "Capa repescada para Pendentes.");
      }, {
        title: movingFromApproved ? "Mudar de ideia?" : "Repescar capa?",
        confirmLabel: movingFromApproved ? "Enviar para rejeitadas" : "Repescar"
      });
    });
    $$('[data-bot-review]', overlay).forEach(button => button.onclick = async () => {
      button.disabled = true;
      const reviewCard = button.closest(".cover-variant-review-card");
      if (reviewCard) reviewCard.style.display = "none";
      const actionId = Number(button.dataset.botReview);
      const candidate = candidates.find(entry => Number(entry.id) === actionId);
      const candidateItem = itemFor(candidate || {});
      const result = button.dataset.status === "approved"
        ? await sb.functions.invoke("cover-variants-bot", { body: { action: "approve_variant", action_id: actionId, primary_cover_url: candidateItem?.coverUrl || "" } })
        : await sb.rpc("review_bot_action", { p_action_id: actionId, p_status: button.dataset.status });
      if (result.error) { button.disabled = false; return toast(result.error.message || "Não foi possível revisar a capa."); }
      state.staffActivities = state.staffActivities.filter(activity => Number(activity.id) !== actionId);
      button.closest(".cover-variant-review-card")?.remove();
      const reviewList = $(".cover-variant-review-list", overlay);
      if (reviewList && !reviewList.querySelector(".cover-variant-review-card")) reviewList.innerHTML = '<div class="empty">Nenhuma capa candidata aguardando revisão.</div>';
      if (button.dataset.status === "approved") {
        await loadCoverCatalog();
        await loadStaffActivities();
        overlay.remove();
        openCoverVariantsReviewPopup();
      } else {
        void loadStaffActivities();
      }
      if (result.data?.duplicate) toast("Essa capa já existe nesta edição e foi descartada.");
    });
  }

  function renderNotifications() {
    if (!state.session) return renderLoginPage();
    return `<div class="content notifications-page"><div class="section-head"><div><div class="eyebrow">Central da conta</div><h1 class="section-title">Notificações</h1><div class="section-subtitle">${state.notificationUnreadCount} não lida(s)</div></div><button class="small-btn" data-mark-all-notifications>Marcar todas como lidas</button></div><div class="notification-list">${state.notifications.map(notification => { const actor = notification.actor; const actorName = actor?.username ? `@${escapeHTML(actor.username)}` : "A Banca Digital"; const actorMarkup = actor?.username ? `<a class="notification-actor" href="${escapeHTML(publicProfileHref(actor.username))}" data-notification-profile="${escapeHTML(actor.username)}">${avatarMarkup(actor, "notification-actor-avatar")}<span><b>${actorName}</b>${actor.title ? `<small style="--title-bg:${safeTitleColor(actor.title_color)}">${escapeHTML(actor.title)}</small>` : ""}</span></a>` : `<span class="notification-system-actor"><span class="notification-icon">${notificationIcon(notification.type)}</span><b>${actorName}</b></span>`; return `<div class="notification-item ${notification.read_at ? "" : "is-unread"}" role="button" tabindex="0" data-notification-open="${escapeHTML(notification.id)}"><span class="notification-icon">${notificationIcon(notification.type)}</span><span class="notification-copy">${actorMarkup}<strong>${escapeHTML(notification.title)}</strong><span>${escapeHTML(notification.body)}</span><small>${escapeHTML(formatCommentDate(notification.created_at))}</small></span></div>`; }).join("") || '<div class="empty">Você ainda não recebeu notificações.</div>'}</div></div>`;
  }

  function closeNotificationsPopups() {
    $$('.notifications-popup-modal').forEach(modal => modal.closest('.modal-backdrop')?.remove());
  }

  function openNotificationsPopup(tab = "notifications") {
    if (!state.session) return openAuthPage();
    closeNotificationsPopups();
    const overlay = document.createElement("div");
    overlay.className = "modal-backdrop";
    const staff = ["moderator", "admin"].includes(state.profile?.plan);
    overlay.innerHTML = `<div class="modal notifications-popup-modal"><div class="section-head"><div><h2>${tab === "staff" ? "📜 Monitoramento" : "Notificações"}</h2><div class="section-subtitle">${tab === "staff" ? "Central interna · não gera notificações públicas" : `${state.notificationUnreadCount} não lida(s)`}</div></div><button class="small-btn" data-close>Fechar</button></div>${staff ? `<div class="notification-tabs"><button class="small-btn notification-tab ${tab !== "staff" ? "is-active" : ""}" data-notification-tab="notifications">🔔 Notificações</button><button class="small-btn notification-tab ${tab === "staff" ? "is-active" : ""}" data-notification-tab="staff">📜 Monitoramento${state.staffPendingCount ? ` (${state.staffPendingCount})` : ""}</button>${state.profile?.plan === "admin" ? `<button class="small-btn" data-open-cover-variants>Examinar capas variantes${coverVariantCandidates().length ? ` (${coverVariantCandidates().length})` : ""}</button>` : ""}</div>` : ""}${tab === "staff" ? renderStaffActivities() : renderNotifications()}</div>`;
    $("#modal-root").appendChild(overlay);
    overlay.addEventListener("click", event => { if (event.target === overlay) overlay.remove(); });
    $$('[data-close]', overlay).forEach(button => button.onclick = event => {
      event.preventDefault();
      event.stopPropagation();
      overlay.remove();
    });
    $$('[data-notification-tab]', overlay).forEach(button => button.onclick = () => openNotificationsPopup(button.dataset.notificationTab));
    $$('[data-bot-review]', overlay).forEach(button => button.onclick = async () => {
      button.disabled = true;
      const result = await sb.rpc("review_bot_action", { p_action_id: Number(button.dataset.botReview), p_status: button.dataset.status });
      if (result.error) { button.disabled = false; return toast(result.error.message || "Não foi possível revisar a ação do bot."); }
      if (button.dataset.status === "approved") await loadCoverCatalog();
      await loadStaffActivities();
      openNotificationsPopup("staff");
    });
    $('[data-open-cover-variants]', overlay)?.addEventListener("click", () => openCoverVariantsReviewPopup());
    $$('[data-notification-open]', overlay).forEach(button => button.onclick = async event => {
      if (event.target.closest("[data-notification-profile]")) return;
      const notification = state.notifications.find(item => String(item.id) === String(button.dataset.notificationOpen));
      await markNotificationRead(notification?.id);
      overlay.remove();
      if (notification?.type === "message" && notification.actor?.id) {
        await openChat(notification.actor);
      } else if (notification?.type === "chat_mention" && notification.metadata?.room_id) {
        const room = CHAT_ROOMS.find(entry => entry.id === notification.metadata.room_id);
        if (room) await openChatRoom(room);
        else openNotificationsPopup();
      } else if (notification?.type === "collection_like" && notification.metadata?.collection_id) {
        openCollection(String(notification.metadata.collection_id));
      } else if ((notification?.type === "profile_wall_comment" || notification?.type === "profile_wall_reply") && notification.metadata?.profile_username) {
        await loadPublicProfile(notification.metadata.profile_username);
      } else if ((notification?.type === "comment_reply" || notification?.type === "comment_like" || notification?.type === "mention") && notification.metadata?.blog_id) {
        navigate({ pagina: "blogs", blog: String(notification.metadata.blog_id) });
      } else if (notification?.type === "mention" && notification.metadata?.item_id) {
        const item = state.db.library.find(entry => String(entry.id) === String(notification.metadata.item_id));
        if (item) openCommentsPopup(item);
        else openNotificationsPopup();
      } else if (notification?.type === "follow" && notification.actor?.username) {
        await loadPublicProfile(notification.actor.username);
      } else {
        openNotificationsPopup();
      }
    });
    $$('[data-notification-profile]', overlay).forEach(link => link.onclick = async event => {
      event.preventDefault();
      event.stopPropagation();
      const notification = state.notifications.find(item => String(item.id) === String(link.closest("[data-notification-open]")?.dataset.notificationOpen));
      await markNotificationRead(notification?.id);
      overlay.remove();
      await loadPublicProfile(link.dataset.notificationProfile);
    });
    $('[data-mark-all-notifications]', overlay)?.addEventListener("click", async () => {
      await markAllNotificationsRead();
      overlay.remove();
      openNotificationsPopup();
    });
  }

  function render() {
    const isBlogTheme = state.section === "blog";
    document.querySelector(".topbar")?.classList.toggle("is-offline", Boolean(state.session?.offline));
    document.body.classList.toggle("blogs-theme", isBlogTheme);
    const brandLogo = document.querySelector(".brand-logo");
    const brandName = document.querySelector(".brand > span:last-child");
    const footerTitle = document.querySelector(".footer > div:first-child > strong");
    const footerDescription = document.querySelector(".footer > div:first-child > span");
    if (brandLogo) {
      brandLogo.src = isBlogTheme ? "assets/bobojacoicon.png?v=1" : "assets/bancadigitaliconbranco.png?v=1";
      brandLogo.alt = isBlogTheme ? "Bobojaco" : "Banca Digital";
    }
    if (brandName) brandName.innerHTML = isBlogTheme ? 'Bobo<span class="brand-accent">jaco</span>' : 'Banca<span class="brand-accent">Digital</span>';
    if (footerTitle) footerTitle.textContent = isBlogTheme ? "Bobojaco" : "Banca Digital";
    if (footerDescription) footerDescription.textContent = isBlogTheme
      ? "Um espaço para publicar, descobrir e conversar sobre histórias."
      : "Uma banca de quadrinhos feita para a era digital.";
    document.title = isBlogTheme ? "Bobojaco — Blogs" : "Banca Digital — Quadrinhos & Mangás";
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) metaDescription.content = isBlogTheme
      ? "Bobojaco: um espaço para publicar, descobrir e conversar sobre histórias."
      : "Uma banca digital para descobrir, pesquisar e ler quadrinhos e mangás.";
    const favicon = document.querySelector('link[rel="icon"]');
    if (favicon) favicon.href = isBlogTheme ? "assets/bobojacoicon.png?v=1" : "assets/bancadigitaliconbranco.png?v=1";
    const appleIcon = document.querySelector('link[rel="apple-touch-icon"]');
    if (appleIcon) appleIcon.href = isBlogTheme ? "assets/bobojacoicon.png?v=1" : "assets/bancadigitaliconbranco.png?v=1";
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
    else if (state.section === "shelf") markup = renderShelfPage();
    else if (state.section === "downloads") markup = renderDownloadsPage();
    else if (state.section === "local-box") markup = renderLocalBoxPage();
    else if (state.section === "public-profile") markup = renderPublicProfilePage();
    else if (state.section === "password-reset") markup = renderPasswordResetPage();
    markup = markup.replace(/\bFree\b/gi, "Comum").replace(/\bPremium\b/gi, "Lenda");
    if (main.innerHTML === markup) {
      syncActiveNav();
      return;
    }
    main.innerHTML = markup;
    bind();
    $$('[data-home-section-move]', main).forEach(button => button.addEventListener("click", () => moveHomepageSection(button.dataset.homeSectionKey, button.dataset.homeSectionMove === "up" ? -1 : 1)));
    hydrateHomeCovers();
    prepareLazyImages(main);
    decorateFactionNames(main);
  }

  function syncActiveNav() {
    const navSection = { comic: "comics", collection: "collections" }[state.section] || state.section;
    $$(".nav-link").forEach(button => button.classList.toggle("active", button.dataset.section === navSection));
  }

  function setSection(section) {
    if (!handlingRoute && sectionRoutes[section] !== undefined) {
      setSectionRoute(section);
      return;
    }
    state.section = section;
    syncActiveNav();
    render();
    if (section === "blog" && !state.blogPosts.length && !state.blogLoading) loadBlogPosts();
    if (section === "ranking" && state.authReady) loadRankingData();
  }

  function openPublisherSettings(name) {
    if (!sb || !["moderator", "admin"].includes(state.profile?.plan)) return;
    const key = publisherKey(name);
    const setting = state.publisherSettings.get(key) || {};
    const overlay = document.createElement("div");
    overlay.className = "modal-backdrop";
    overlay.innerHTML = `<div class="modal publisher-settings-modal"><div class="section-head"><div><h2>Configurar editora</h2><div class="section-subtitle">${escapeHTML(name)}</div></div><button class="small-btn" data-close>Fechar</button></div><form id="publisher-settings-form"><div class="field"><label>Enviar imagem do card</label><input name="coverFile" type="file" accept="image/png,image/jpeg,image/webp"><small class="format-hint">A imagem será armazenada no Supabase e usada no card.</small></div><div class="field"><label>Ou use uma URL de imagem</label><input name="coverUrl" type="url" value="${escapeHTML(setting.cover_url || "")}" placeholder="https://.../imagem.jpg"></div><label class="checkbox-inline"><input name="isPinned" type="checkbox" ${setting.is_pinned ? "checked" : ""}> Fixar no carrossel de destaque</label><div class="modal-actions"><button type="button" class="small-btn" data-close>Cancelar</button><button class="btn btn-danger">Salvar configuração</button></div></form></div>`;
    $("#modal-root").appendChild(overlay);
    $$('[data-close]', overlay).forEach(button => button.onclick = () => overlay.remove());
    $("#publisher-settings-form", overlay).onsubmit = async event => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      let coverUrl = String(form.get("coverUrl") || "").trim() || null;
      const coverFile = form.get("coverFile");
      if (coverFile?.size) {
        const extension = String(coverFile.name || "jpg").split(".").pop().toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
        const path = `${state.session.user.id}/${key}-${Date.now()}.${extension}`;
        const upload = await sb.storage.from("publisher-covers").upload(path, coverFile, { upsert: true, contentType: coverFile.type || "image/jpeg" });
        if (upload.error) return toast("Não foi possível enviar a imagem. Verifique o bucket publisher-covers no Supabase.");
        coverUrl = sb.storage.from("publisher-covers").getPublicUrl(path).data.publicUrl;
      }
      const next = { publisher_key: key, publisher_name: name, cover_url: coverUrl, is_pinned: form.get("isPinned") === "on" };
      const result = await sb.from("publisher_settings").upsert(next, { onConflict: "publisher_key" });
      if (result.error) return toast("Não foi possível salvar a configuração da editora. Execute a atualização do schema no Supabase.");
      state.publisherSettings.set(key, next);
      overlay.remove();
      render();
      toast("Configuração da editora salva.");
    };
  }

  function bind() {
    syncActiveNav();
    const heroDescription = $(".hero-description");
    const heroMore = $("[data-hero-more]");
    if (heroDescription && heroMore) {
      if (heroDescription.scrollHeight > heroDescription.clientHeight + 1) heroMore.classList.add("is-visible");
      heroMore.addEventListener("click", () => {
        const expanded = heroDescription.classList.toggle("is-expanded");
        heroDescription.closest(".hero")?.classList.toggle("is-expanded", expanded);
        heroMore.textContent = expanded ? "Mostrar menos" : "Ler mais";
      });
    }
    $(".content")?.classList.toggle("shelf-page", state.section === "shelf");
    if (state.section === "shelf" && state.profile) ensureProfileBanner(state.profile);
    if (state.section === "public-profile" && state.publicProfile?.profile) ensureProfileBanner(state.publicProfile.profile);
    if (state.session?.offline && $(".content") && !$(".offline-account-notice")) {
      $(".content").insertAdjacentHTML("afterbegin", `<div class="notice offline-account-notice"><b>Perfil de @${escapeHTML(state.profile?.username || "usuário")}</b> · modo offline. Apenas seus Downloads ficam disponíveis sem internet.</div>`);
    }
    if (state.section === "ranking") {
      const rankingPage = $(".ranking-page");
      const benefits = $(".ranking-benefits", rankingPage);
      $(".ranking-benefit-card.is-moderator", benefits)?.remove();
      if (rankingPage && benefits) rankingPage.appendChild(benefits);
      if (rankingPage && !state.rankingCategory) {
        const categoryByLabel = { Moderadores: "staff", Lenda: "premium", Comum: "free" };
        $$(".ranking-group", rankingPage).forEach(groupElement => {
          const list = $(".ranking-member-list", groupElement);
          if (!list) return;
          const cards = $$('a.ranking-member', list).sort((a, b) => {
            const aNumbers = (($("small", a)?.textContent || "").match(/\d+/g) || []).map(Number);
            const bNumbers = (($("small", b)?.textContent || "").match(/\d+/g) || []).map(Number);
            return (bNumbers[0] || 1) - (aNumbers[0] || 1) || (bNumbers[1] || 0) - (aNumbers[1] || 0);
          });
          cards.forEach(card => list.appendChild(card));
          list.classList.add("ranking-member-list-preview");
          const category = categoryByLabel[$("h3", groupElement)?.firstChild?.textContent?.trim()];
          if (category && cards.length && !$('[data-ranking-category]', groupElement)) list.insertAdjacentHTML("afterend", `<div class="faction-abafac-controls ranking-view-all-controls"><button type="button" class="small-btn ranking-view-all" data-ranking-category="${category}">Ver todos</button></div>`);
        });
      }
      const directory = $(".ranking-directory", rankingPage);
      if (false) {
        if (false) directory.insertAdjacentHTML("afterbegin", `<label class="ranking-user-search-wrap"><span>Pesquisar usuários</span><input class="ranking-user-search" type="search" value="${escapeHTML(state.rankingSearch || "")}" placeholder="Nome ou título..." autocomplete="off"></label>`);
        const searchInput = $(".ranking-user-search", directory);
        const applyRankingSearch = () => {
          state.rankingSearch = searchInput.value;
          const query = String(state.rankingSearch || "").trim().toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
          $$("a.ranking-member", directory).forEach(card => {
            const text = card.textContent.toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            card.hidden = Boolean(query) && !text.includes(query);
          });
          $$(".ranking-group", directory).forEach(group => {
            group.hidden = Boolean(query) && !$$('a.ranking-member:not([hidden])', group).length;
          });
        };
        searchInput.addEventListener("input", applyRankingSearch);
        applyRankingSearch();
      }
    }
    if (state.section === "shelf" && state.profile && !$(".profile-xp-progress")) {
      $(".content .profile-header")?.insertAdjacentHTML("afterend", profileXpProgressMarkup(state.profile));
    }
    if (state.section === "shelf" && state.profile) {
      const shelfBanner = $(".profile-banner");
      const shelfXp = $(".profile-xp-progress", $(".content"));
      if (shelfBanner && shelfXp && !shelfBanner.contains(shelfXp)) shelfBanner.appendChild(shelfXp);
    }
    if (state.section === "shelf" && state.session) {
      const profileInfo = $(".content .profile-header > div:nth-child(2)");
      if (profileInfo && !$(".profile-follow-summary", profileInfo)) profileInfo.insertAdjacentHTML("beforeend", followSummary(state.session.user.id, state.followerCount, state.followingCount));
      const shelfProfileHandle = $(".content .profile-header > div:nth-child(2) > .eyebrow");
      if (shelfProfileHandle && !shelfProfileHandle.dataset.profileLinkBound) {
        shelfProfileHandle.dataset.profileLinkBound = "true";
        shelfProfileHandle.classList.add("profile-shelf-username");
        shelfProfileHandle.setAttribute("role", "link");
        shelfProfileHandle.setAttribute("tabindex", "0");
        const openPublicProfile = () => { window.location.href = publicProfileHref(state.profile.username); };
        shelfProfileHandle.addEventListener("click", openPublicProfile);
        shelfProfileHandle.addEventListener("keydown", event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openPublicProfile(); } });
      }
      const shelfHeading = $(".content > .section-head .section-title");
      if (shelfHeading) {
        shelfHeading.textContent = "Minha estante";
      }
    }
    if (state.section === "shelf" && state.session) {
      const shelfHead = $(".content > .section-head");
      if (shelfHead && !$(".shelf-media-tabs")) {
        shelfHead.insertAdjacentHTML("afterend", `<div class="shelf-media-tabs"><button class="small-btn is-active" data-shelf-media="collections">Coleções</button><button class="small-btn" data-shelf-media="wall">Mural</button><button class="small-btn" data-shelf-media="saved-public">Públicas salvas</button><button class="small-btn" data-action="open-local-box">Abrir caixa</button></div><div class="shelf-tab-panel shelf-wall-panel" data-shelf-tab-panel="wall">${profileWallMarkup(null, true)}</div><div class="shelf-tab-panel shelf-saved-public-panel" data-shelf-tab-panel="saved-public">${savedPublicCollectionsMarkup(state.savedPublicCollections)}</div>`);
        $("[data-action=open-local-box]", shelfHead.nextElementSibling)?.addEventListener("click", () => { state.localBoxVisible = true; setSection("local-box"); });
        $("[data-shelf-tab-panel=wall]")?.setAttribute("hidden", "");
        $("[data-shelf-tab-panel=saved-public]")?.setAttribute("hidden", "");
      }
      const ownSavedPublicPanel = $("[data-shelf-tab-panel=saved-public]");
      if (ownSavedPublicPanel && !$(".saved-publishers", ownSavedPublicPanel)) ownSavedPublicPanel.insertAdjacentHTML("afterbegin", savedPublishersMarkup(state.savedPublishers));
      const showSpecialShelfTab = ["wall", "saved-public"].includes(state.shelfTab);
      $$(".shelf-page > .shelf-collection, .shelf-page > .shelf-categories, .shelf-page > .local-box-notice").forEach(element => { element.hidden = showSpecialShelfTab; });
      $$('[data-shelf-tab-panel]').forEach(panel => { panel.hidden = panel.dataset.shelfTabPanel !== state.shelfTab; });
      $$('[data-shelf-media]').forEach(button => button.classList.toggle("is-active", button.dataset.shelfMedia === state.shelfTab));
    }
    if (state.section === "public-profile" && state.publicProfile?.profile && !state.publicProfile.collectionId) {
      const publicProfile = state.publicProfile.profile;
      const wallVisible = publicProfile.profile_wall_public !== false;
      const savedPublicCollectionsVisible = publicProfile.shelf_saved_public_collections !== false;
      const activityVisible = publicProfile.profile_activity_public !== false;
      const publicProfileInfo = $(".public-profile-page .profile-header > div:nth-child(2)");
      if (publicProfileInfo && !$(".profile-follow-summary", publicProfileInfo)) publicProfileInfo.insertAdjacentHTML("beforeend", followSummary(state.publicProfile.profile.id, state.publicProfile.followerCount, state.publicProfile.followingCount));
      if (!$(".public-profile-page .profile-xp-progress") && $(".public-profile-page .profile-header")) $(".public-profile-page .profile-header").insertAdjacentHTML("beforeend", profileXpProgressMarkup(state.publicProfile.profile, true));
      const publicSummary = $(".public-profile-page > .section-head .section-subtitle");
      if (publicSummary) publicSummary.textContent = "Coleções públicas do perfil";
      const publicHead = $(".public-profile-page > .section-head");
      if (publicHead && !$(".public-shelf-media-tabs")) {
        publicHead.insertAdjacentHTML("afterend", `<div class="shelf-media-tabs public-shelf-media-tabs"><button class="small-btn is-active" data-public-shelf-media="collections">Coleções</button><button class="small-btn" data-public-shelf-media="wall">Mural</button><button class="small-btn" data-public-shelf-media="saved-public">Públicas salvas</button></div><div class="shelf-tab-panel public-wall-panel" data-public-shelf-tab-panel="wall">${profileWallMarkup(state.publicProfile)}</div><div class="shelf-tab-panel public-saved-public-panel" data-public-shelf-tab-panel="saved-public">${savedPublicCollectionsMarkup(state.publicProfile.savedPublicCollections || [])}</div>`);
      }
      if ($(".public-shelf-media-tabs") && !$("[data-public-shelf-media=activity]")) {
        $(".public-shelf-media-tabs").insertAdjacentHTML("beforeend", '<button class="small-btn" data-public-shelf-media="activity">Histórico</button>');
        $(".public-shelf-media-tabs").parentElement?.insertAdjacentHTML("beforeend", `<div class="shelf-tab-panel public-activity-panel" data-public-shelf-tab-panel="activity">${publicProfileActivityMarkup(state.publicProfile)}</div>`);
      }
      const publicSavedPublicPanel = $("[data-public-shelf-tab-panel=saved-public]");
      if (publicSavedPublicPanel && !$(".saved-publishers", publicSavedPublicPanel)) publicSavedPublicPanel.insertAdjacentHTML("afterbegin", savedPublishersMarkup(state.publicProfile.savedPublishers || []));
      if (!wallVisible) {
        if (state.publicShelfTab === "wall") state.publicShelfTab = "collections";
        $("[data-public-shelf-media=wall]")?.remove();
        $("[data-public-shelf-tab-panel=wall]")?.remove();
      }
      if (!savedPublicCollectionsVisible) {
        if (state.publicShelfTab === "saved-public") state.publicShelfTab = "collections";
        $("[data-public-shelf-media=saved-public]")?.remove();
        $("[data-public-shelf-tab-panel=saved-public]")?.remove();
      }
      if (!activityVisible) {
        if (state.publicShelfTab === "activity") state.publicShelfTab = "collections";
        $("[data-public-shelf-media=activity]")?.remove();
        $("[data-public-shelf-tab-panel=activity]")?.remove();
      }
      const showSpecialPublicTab = ["wall", "saved-public", "activity"].includes(state.publicShelfTab);
      $$(".public-profile-page > .shelf-collection").forEach(element => { element.hidden = showSpecialPublicTab; });
      $$('[data-public-shelf-tab-panel]').forEach(panel => { panel.hidden = panel.dataset.publicShelfTabPanel !== state.publicShelfTab; });
      $$('[data-public-shelf-media]').forEach(button => button.classList.toggle("is-active", button.dataset.publicShelfMedia === state.publicShelfTab));
    }
    if (state.section === "public-profile" && state.publicProfile?.profile && !state.publicProfile.collectionId) {
      $(".public-profile-page > .section-head > div:first-child")?.remove();
      $(".public-profile-page > .section-head [data-section=home]")?.remove();
      $(".public-shelf-media-tabs [data-public-shelf-media=comics]")?.remove();
    }
    if (state.section === "entity" && !$("[data-entity-filter-form]")) {
      const filter = state.collectionFilter || { field: "all", query: "" };
      const form = document.createElement("form");
      form.className = "collection-filter publisher-filter";
      form.dataset.collectionFilterForm = "true";
      form.dataset.entityFilterForm = "true";
      form.innerHTML = `<select name="field"><option value="all" ${filter.field === "all" ? "selected" : ""}>Filtrar por qualquer campo</option><option value="author" ${filter.field === "author" ? "selected" : ""}>Autor</option><option value="publisher" ${filter.field === "publisher" ? "selected" : ""}>Editora</option><option value="imprint" ${filter.field === "imprint" ? "selected" : ""}>Selo</option><option value="character" ${filter.field === "character" ? "selected" : ""}>Personagem</option><option value="tag" ${filter.field === "tag" ? "selected" : ""}>Gênero / tag</option><option value="seriesTitle" ${filter.field === "seriesTitle" ? "selected" : ""}>Série</option><option value="title" ${filter.field === "title" ? "selected" : ""}>Título</option></select><input name="query" value="${escapeHTML(filter.query)}" placeholder="Digite para filtrar esta página"><button class="small-btn">Filtrar</button><button class="small-btn" type="button" data-clear-collection-filter>Remover filtro</button>`;
      const heading = state.entityFilter?.kind === "publisher" ? $(".publisher-page .section-head") : $(".content > .section-head");
      heading?.after(form);
    }
    const canManage = state.profile?.plan === "admin";
    const isAdmin = state.profile?.plan === "admin";
    syncTopAvatar();
    $$('[data-action="open-admin"]').forEach(button => { button.style.display = canManage ? "" : "none"; });
    $$('[data-action="submit"]').forEach(button => { button.style.display = isAdmin ? "" : "none"; });
    $$('.messages-header-btn').forEach(button => {
      button.style.display = state.session ? "" : "none";
      const badge = $(".message-badge", button);
      if (badge) {
        badge.textContent = state.messageUnreadCount > 99 ? "99+" : String(state.messageUnreadCount);
        badge.hidden = !state.messageUnreadCount;
      }
    });
    $$('.downloads-header-btn').forEach(button => {
      button.style.display = state.session ? "" : "none";
      const downloads = [...state.downloads.values()];
      const hasDownloading = downloads.some(download => download.status === "downloading");
      const hasCompleted = downloads.some(download => download.status === "completed");
      button.classList.toggle("is-downloading", hasDownloading);
      button.classList.toggle("is-downloaded", !hasDownloading && hasCompleted);
      if (button.firstChild) button.firstChild.nodeValue = hasDownloading ? "…" : "↓";
    });
    $$('.notification-bell').forEach(button => {
      button.style.display = state.session ? "" : "none";
      const badge = $(".notification-badge", button);
      if (badge) {
        badge.textContent = state.notificationUnreadCount > 99 ? "99+" : String(state.notificationUnreadCount);
        badge.hidden = !state.notificationUnreadCount;
      }
    });
    $$('.staff-activity-button').forEach(button => {
      const visible = state.session && ["moderator", "admin"].includes(state.profile?.plan);
      button.style.display = visible ? "" : "none";
      const badge = $(".staff-activity-badge", button);
      if (badge) badge.hidden = true;
    });
    $$('.local-box-nav').forEach(button => { button.style.display = state.session && state.localBoxVisible ? "" : "none"; });
    const downloadsSortHead = $(".downloads-completed .section-head");
    if (downloadsSortHead && !$("[data-download-sort]", downloadsSortHead)) {
      const completedCount = [...state.downloads.values()].filter(entry => entry.status === "completed").length;
      downloadsSortHead.insertAdjacentHTML("beforeend", `<span class="downloads-total-count" data-download-total>${completedCount} ${completedCount === 1 ? "edição" : "edições"}</span><label class="shelf-sort-control"><span>Ordenar</span><select data-download-sort>${SHELF_SORT_OPTIONS.map(([value, label]) => `<option value="${escapeHTML(value)}" ${state.downloadsSortOrder === value ? "selected" : ""}>${label}</option>`).join("")}</select></label><button class="small-btn danger" data-delete-all-downloads>Excluir todos</button>`);
    }
    $("[data-download-sort]")?.addEventListener("change", event => {
      state.downloadsSortOrder = event.currentTarget.value;
      try { localStorage.setItem("bancaDigitalDownloadsSort", state.downloadsSortOrder); } catch {}
      render();
    });
    $("[data-delete-all-downloads]")?.addEventListener("click", deleteAllCompletedDownloads);
    const downloadsPendingHead = $(".downloads-pending .section-head");
    if (downloadsPendingHead && !$("[data-download-pending-actions]", downloadsPendingHead)) {
      const pausedCount = [...state.downloads.values()].filter(entry => entry.status === "paused").length;
      downloadsPendingHead.insertAdjacentHTML("beforeend", `<div class="downloads-pending-actions" data-download-pending-actions><button class="small-btn" data-resume-all-downloads ${pausedCount ? "" : "disabled"}>Retomar todos</button><button class="small-btn danger" data-clear-download-queue>Limpar fila</button></div>`);
    }
    $("[data-resume-all-downloads]")?.addEventListener("click", resumeAllPendingDownloads);
    $("[data-clear-download-queue]")?.addEventListener("click", clearDownloadQueue);
    $$('.downloads-series-head').forEach(head => {
      if ($('[data-download-series-sort]', head)) return;
      const series = head.closest('.downloads-series');
      const firstCard = $('[data-download-row]', series);
      const seriesId = firstCard?.dataset.downloadRow ? (state.downloads?.get(firstCard.dataset.downloadRow)?.snapshot?.seriesId || state.db.library.find(item => String(item.id) === String(firstCard.dataset.downloadRow))?.seriesId || '__downloads-oneshots') : '__downloads-oneshots';
      const selected = state.downloadsSeriesSortOrders?.[seriesId] || state.downloadsSortOrder || 'added_desc';
      head.insertAdjacentHTML('beforeend', `<label class="downloads-series-sort"><span>Ordenar</span><select data-download-series-sort="${escapeHTML(seriesId)}">${SHELF_SORT_OPTIONS.map(([value, label]) => `<option value="${escapeHTML(value)}" ${selected === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label><button class="small-btn danger" data-delete-download-series="${escapeHTML(seriesId)}">Excluir série</button>`);
    });
    $$('[data-download-series-sort]').forEach(select => select.addEventListener('change', event => {
      const seriesId = event.currentTarget.dataset.downloadSeriesSort;
      state.downloadsSeriesSortOrders = { ...(state.downloadsSeriesSortOrders || {}), [seriesId]: event.currentTarget.value };
      try { localStorage.setItem('bancaDigitalDownloadsSeriesSort', JSON.stringify(state.downloadsSeriesSortOrders)); } catch {}
      render();
    }));
    $$('[data-delete-download-series]').forEach(button => button.addEventListener('click', () => deleteSeriesDownloads(button.dataset.deleteDownloadSeries)));
    $$('[data-favorite]').forEach(el => el.addEventListener("click", event => { event.stopPropagation(); toggleFavorite(el.dataset.favorite); }));
    $$('[data-download]').forEach(el => {
      const entry = downloaded(el.dataset.download);
      if (entry?.status === "waiting") { el.classList.add("is-downloading"); el.textContent = "…"; el.title = "Aguardando na fila"; }
      el.addEventListener("click", event => { event.stopPropagation(); const item = state.db.library.find(entry => String(entry.id) === String(el.dataset.download)); const download = item && downloaded(item.id); if (!item || download?.status === "downloading" || download?.status === "waiting") return; download?.status === "completed" ? deleteDownload(item.id) : startDownload(item); });
    });
    $$('[data-download-row]').forEach(row => {
      const entry = downloaded(row.dataset.downloadRow);
      if (!entry?.preparing && entry?.status !== "waiting") return;
      const subtitle = $('.section-subtitle', row);
      const progress = $('progress', row);
      const button = $('[data-open-download]', row);
      if (entry.status === "waiting") {
        if (subtitle) subtitle.textContent = 'Aguardando na fila…';
        if (progress) progress.hidden = true;
        if (button) { button.disabled = true; button.textContent = 'Aguardando…'; }
      } else {
        if (subtitle) subtitle.textContent = 'Preparando leitura offline…';
        if (progress) progress.hidden = true;
        if (button) { button.disabled = true; button.textContent = 'Preparando…'; }
      }
    });
    $$('[data-open-download]').forEach(el => el.addEventListener("click", () => { const item = state.db.library.find(entry => String(entry.id) === String(el.dataset.openDownload)) || downloaded(el.dataset.openDownload)?.snapshot; const entry = downloaded(el.dataset.openDownload); if (!item || !entry || entry.status === "waiting" || entry.preparing) return; entry.status === "completed" ? openDownloaded(item) : startDownload(item); }));
    $$('.downloads-completed [data-open-download]').forEach(el => {
      const item = state.db.library.find(entry => String(entry.id) === String(el.dataset.openDownload)) || downloaded(el.dataset.openDownload)?.snapshot;
      const replacement = el.cloneNode(true);
      replacement.removeAttribute('data-open-download');
      replacement.dataset.viewSeries = item?.seriesId || '';
      replacement.textContent = 'Série';
      replacement.disabled = Boolean(state.session?.offline || !item?.seriesId);
      el.replaceWith(replacement);
    });
    $$('[data-open-download-cover]').forEach(el => { const open = () => { const item = state.db.library.find(entry => String(entry.id) === String(el.dataset.openDownloadCover)) || downloaded(el.dataset.openDownloadCover)?.snapshot; const entry = downloaded(el.dataset.openDownloadCover); if (item && entry?.status === "completed") openDownloaded(item); }; el.addEventListener("click", open); el.addEventListener("keydown", event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); open(); } }); });
    $$('[data-delete-download]').forEach(el => el.addEventListener("click", () => deleteDownload(el.dataset.deleteDownload)));
    $$('[data-series-favorite]').forEach(el => el.addEventListener("click", event => { event.stopPropagation(); toggleSeriesFavorite(el.dataset.seriesFavorite); }));
    $$('[data-cover-choice]').forEach(el => {
      if (el.dataset.coverChoiceBound) return;
      el.dataset.coverChoiceBound = "true";
      el.addEventListener("click", event => { event.stopPropagation(); openCoverChoice(el.dataset.coverChoice, el.dataset.coverChoiceCollection || ""); });
    });
    $$('[data-cover-effect-item]').forEach(el => {
      if (el.dataset.coverEffectBound) return;
      el.dataset.coverEffectBound = "true";
      el.addEventListener("mousedown", event => event.preventDefault());
      el.addEventListener("click", event => {
        event.stopPropagation();
        cycleCoverStyle(el.dataset.coverEffectItem, el.dataset.coverEffectCollection || "");
      });
    });
    $$('[data-series-cover-choice]').forEach(el => {
      if (el.dataset.seriesCoverChoiceBound) return;
      el.dataset.seriesCoverChoiceBound = "true";
      el.addEventListener("click", event => { event.stopPropagation(); openSeriesCoverChoice(el.dataset.seriesCoverChoice); });
    });
    $$('[data-read-item]').forEach(el => el.addEventListener("pointerdown", () => {
      prefetchReaderFile(state.db.library.find(x => x.id === el.dataset.readItem));
    }, { once: true }));
    $$('[data-read-item]').forEach(el => el.addEventListener("pointerenter", () => {
      prefetchReaderFile(state.db.library.find(x => x.id === el.dataset.readItem));
    }, { once: true }));
    $$('[data-read-item]').forEach(el => el.addEventListener("click", event => {
      event.stopPropagation();
      const item = state.db.library.find(x => x.id === el.dataset.readItem);
      if (item) openReader(item);
    }));
    $$('[data-open][data-open-direct="true"]').forEach(el => el.addEventListener("pointerdown", () => {
      prefetchReaderFile(state.db.library.find(x => x.id === el.dataset.open));
    }, { once: true }));
    $$('[data-like-item]').forEach(el => el.addEventListener("click", event => { event.stopPropagation(); toggleComicLike(el.dataset.likeItem); }));
    $$('[data-share-item]').forEach(el => el.addEventListener("click", event => { event.stopPropagation(); shareComic(el.dataset.shareItem); }));
    $$('[data-publisher]').forEach(el => el.addEventListener("click", event => { event.preventDefault(); event.stopPropagation(); el.closest(".modal-backdrop")?.remove(); openEntityPage("publisher", el.dataset.publisher); }));
    if (state.section === "entity" && state.entityFilter?.kind === "publisher") {
      const actions = $(".publisher-page-actions");
      if (actions && !$("[data-save-publisher]", actions)) {
        const publisherName = String(state.entityFilter.value || "").trim();
        const saved = state.savedPublisherKeys.has(publisherKey(publisherName));
        const button = document.createElement("button");
        button.className = `small-btn ${saved ? "is-liked" : ""}`;
        button.dataset.savePublisher = publisherName;
        button.textContent = saved ? "★ Editora salva" : "☆ Salvar editora";
        button.onclick = () => togglePublisherSave(button);
        actions.insertBefore(button, actions.firstChild);
      }
    }
    $$('[data-entity-kind]').forEach(el => el.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      el.closest(".modal-backdrop")?.remove();
      openEntityPage(el.dataset.entityKind, el.dataset.entityValue);
    }));
    $$('[data-entity-kind][role="link"]').forEach(el => el.addEventListener("keydown", event => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      openEntityPage(el.dataset.entityKind, el.dataset.entityValue);
    }));
    $$('[data-ranking-period]').forEach(el => el.addEventListener("click", () => {
      state.rankingPeriod = el.dataset.rankingPeriod;
      state.rankingMembers = [];
      render();
      loadRankingData();
    }));
    $$('[data-ranking-faction]').forEach(el => el.addEventListener("click", () => { state.rankingFaction = el.dataset.rankingFaction || null; render(); }));
    $$('[data-ranking-category]').forEach(el => el.addEventListener("click", () => navigate({ pagina: "ranking", categoria: el.dataset.rankingCategory })));
    $('[data-ranking-back]')?.addEventListener("click", () => navigate({ pagina: "ranking" }));
    $('[data-open-faction-choice]')?.addEventListener("click", openFactionChoice);
    $$('[data-faction-open]').forEach(el => {
      if (el.dataset.factionOpenBound) return;
      el.dataset.factionOpenBound = "true";
      el.addEventListener("click", event => { event.preventDefault(); event.stopPropagation(); navigate({ pagina: "faccoes", faccao: factionRouteKey(el.dataset.factionOpen) }); });
      el.addEventListener("keydown", event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); el.click(); } });
    });
    $('[data-faction-members-back]')?.addEventListener("click", () => navigate({ pagina: "faccoes", faccao: factionRouteKey(state.factionPageId) }));
    $('[data-faction-members-search]')?.addEventListener("input", event => {
      state.factionMemberSearch = event.currentTarget.value;
      const results = $("[data-faction-member-results]");
      if (results) results.innerHTML = factionMembersResultsMarkup(state.factionPageId, state.factionMemberSearch);
    });
    const factionBackButton = $('[data-faction-back]');
    if (factionBackButton) {
      factionBackButton.textContent = "Voltar";
      factionBackButton.onclick = () => {
        if (state.profile?.faction_id && state.factionPageId === state.profile.faction_id) return navigate({});
        const ownFactionId = state.profile?.faction_id || state.factionPageId;
        navigate(ownFactionId ? { pagina: "faccoes", faccao: factionRouteKey(ownFactionId) } : {});
      };
    }
    if (state.section === "factions" && state.factionPageId && state.profile && !["moderator", "admin"].includes(state.profile.plan) && state.profile.faction_id !== state.factionPageId && !$("[data-faction-join]")) {
      const joinButton = document.createElement("button");
      joinButton.type = "button";
      joinButton.className = "small-btn faction-join-button";
      joinButton.dataset.factionJoin = state.factionPageId;
      joinButton.textContent = "Entrar nesta facção";
      joinButton.dataset.tooltip = "A troca só pode ser feita uma vez a cada 7 dias. Ao desertar, você perde 50 XP e a facção abandonada perde 25 XP.";
      const detailHead = $(".faction-detail-page > .section-head");
      if (detailHead && factionBackButton) {
        const detailActions = document.createElement("div");
        detailActions.className = "faction-detail-actions";
        factionBackButton.replaceWith(detailActions);
        detailActions.append(factionBackButton, joinButton);
      } else detailHead?.appendChild(joinButton);
      joinButton.addEventListener("click", () => joinFaction(state.factionPageId));
    }
    if (state.section === "factions" && !state.factionPageId && $(".faction-page:not(.faction-detail-page) .section-title")) {
      $(".faction-page:not(.faction-detail-page) .section-title").textContent = "Facção";
    }
    if (state.section === "factions" && state.factionPageId && $(".faction-detail-page") && !$(".faction-leadership-tools")) {
      $(".faction-detail-page").insertAdjacentHTML("beforeend", factionLeadershipMarkup(state.factionPageId));
      applyFactionAbafacOrder(state.factionPageId);
      $('[data-faction-resign]')?.addEventListener("click", async () => {
        const faction = state.factions.find(item => item.id === state.factionPageId);
        if (!await openFactionConfirm(faction)) return;
        const result = await sb.rpc("resign_faction_leader");
        if (result.error) return toast(result.error.message || "Não foi possível renunciar.");
        await loadFactions();
        render();
      });
      $('[data-faction-edit-identity]')?.addEventListener("click", async () => {
        const faction = state.factions.find(item => item.id === state.factionPageId);
        if (!faction) return;
        const values = await openFactionIdentityEditorV2(faction);
        if (!values) return;
        const catalogUrl = await validatePublicCatalogLink(values.catalogUrl);
        if (catalogUrl === false) return toast("Informe o link de um catálogo público de quadrinhos deste site.");
        const result = await sb.rpc("update_faction_identity_v2", { p_faction_id: faction.id, p_name: values.name, p_color: values.color, p_emblem: values.emblem, p_description: values.description, p_catalog_url: catalogUrl });
        if (result.error) return toast(result.error.message || "Não foi possível atualizar a facção.");
        if (values.imageFile) await uploadFactionAbafacImage(faction.id, values.imageFile, values.imageLink);
        await loadFactions();
        const orderResult = await sb.rpc("update_faction_abafac_order", { p_faction_id: faction.id, p_order: factionAbafacOrder(faction.id) });
        if (orderResult.error) return toast(orderResult.error.message || "Não foi possível atualizar a ordem das abafacs.");
        await loadFactions();
        render();
      });
    }
    if (state.section === "ranking" && $(".ranking-benefits") && !$(".ranking-faction-overview")) {
      const overview = document.createElement("section");
      overview.className = "section ranking-faction-overview";
      overview.innerHTML = `<div class="section-head"><div><h2 class="section-title">Facções</h2><div class="section-subtitle">Escolha um lado para conhecer sua página e acompanhar a disputa.</div></div></div>${factionOverviewNoticeMarkup()}${factionOverviewMarkup()}`;
      $(".ranking-benefits").before(overview);
      $$('[data-faction-open]', overview).forEach(el => {
        el.dataset.factionOpenBound = "true";
        el.addEventListener("click", event => { event.preventDefault(); event.stopPropagation(); navigate({ pagina: "faccoes", faccao: factionRouteKey(el.dataset.factionOpen) }); });
        el.addEventListener("keydown", event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); el.click(); } });
      });
    }
    $$('[data-follow-list]').forEach(el => el.addEventListener("click", event => { event.preventDefault(); event.stopPropagation(); openFollowList(el.dataset.followList, el.dataset.followProfileId); }));
    $$('[data-notification-open]').forEach(el => el.addEventListener("click", () => markNotificationRead(el.dataset.notificationOpen)));
    $('[data-mark-all-notifications]')?.addEventListener("click", markAllNotificationsRead);
    if (state.section === "public-profile" && state.publicProfile?.profile && state.publicProfile.profile.allow_messages !== false && state.session?.user?.id !== state.publicProfile.profile.id && !$("[data-open-chat]")) {
      const actions = $(".public-profile-page > .section-head .profile-actions");
      if (actions) { const button = document.createElement("button"); button.className = "small-btn"; button.dataset.openChat = "true"; button.textContent = "Enviar mensagem"; actions.prepend(button); }
    }
    if (state.section === "public-profile" && state.publicProfile?.profile && !state.publicProfile.collectionId) {
      const profileHeader = $(".public-profile-page .profile-header");
      const xp = $(".public-profile-page .profile-xp-progress");
      const actions = $(".public-profile-page > .section-head .profile-actions");
      if (profileHeader && xp && actions && !$("[data-public-profile-header-side]", profileHeader)) {
        const side = document.createElement("div");
        side.className = "public-profile-header-side";
        side.dataset.publicProfileHeaderSide = "true";
        xp.replaceWith(side);
        side.append(xp, actions);
        actions.closest(".section-head")?.remove();
      }
    }
    $('[data-open-chat]')?.addEventListener("click", () => openChat(state.publicProfile?.profile));
    if (!document.body.dataset.commentEnterBound) {
      document.body.dataset.commentEnterBound = "true";
      document.addEventListener("keydown", event => {
        const textarea = event.target.closest?.(".comment-form textarea");
        if (!textarea || event.key !== "Enter" || event.shiftKey || event.isComposing) return;
        event.preventDefault();
        textarea.form?.requestSubmit();
      });
    }
    $$('[data-blog-tab]').forEach(el => el.addEventListener("click", () => { state.blogTab = el.dataset.blogTab; navigate({ pagina: "blogs" }); }));
    if (state.section === "blog" && !state.blogOpenId && $(".blogs-page") && !$(".blog-highlights-sidebar")) $(".blogs-page").insertAdjacentHTML("beforeend", blogHighlightsSidebar());
    if (state.section === "blog" && !state.blogOpenId && state.featuredBlogCollections?.length && $(".blogs-page") && !$("[data-featured-blog-collections]")) {
      const section = `<section class="section featured-blog-collections" data-featured-blog-collections><div class="section-head"><div><h2 class="section-title">Coleções de blogs em destaque</h2><div class="section-subtitle">Coleções públicas escolhidas pela equipe.</div></div></div><div class="public-collections-grid">${state.featuredBlogCollections.map(collection => publicCollectionCard(collection)).join("")}</div></section>`;
      const sections = $$('.blogs-page > .section').filter(Boolean);
      const featured = sections.find(item => $("h2", item)?.textContent.includes("Em destaque"));
      (featured || sections[0])?.insertAdjacentHTML(featured ? "afterend" : "beforebegin", section);
    }
    $$('[data-blog-open]').forEach(el => el.addEventListener("click", () => navigate({ pagina: "blogs", blog: el.dataset.blogOpen })));
    $$('[data-blog-read]').forEach(el => el.addEventListener("click", event => { event.stopPropagation(); navigate({ pagina: "blogs", blog: el.dataset.blogRead }); }));
    $('[data-blog-back]')?.addEventListener("click", () => { state.blogOpenId = null; state.blogTab = "recentes"; navigate({ pagina: "blogs" }); });
    const openedBlog = state.blogOpenId ? state.blogPosts.find(item => String(item.id) === String(state.blogOpenId)) : null;
    $$(".blog-card").forEach(card => {
      const post = state.blogPosts.find(item => String(item.id) === String(card.dataset.blogOpen));
      const meta = $(".blog-card-meta", card);
      if (post?.author?.username && meta) meta.innerHTML = `<a class="blog-meta-author" href="${escapeHTML(publicProfileHref(post.author.username))}">@${escapeHTML(post.author.username)}</a> · ${escapeHTML(blogDate(post.published_at || post.created_at))}`;
    });
    const postMeta = $(".blog-post-page .section-head .section-subtitle");
    if (openedBlog?.author?.username && postMeta) postMeta.innerHTML = `<a class="blog-meta-author" href="${escapeHTML(publicProfileHref(openedBlog.author.username))}">@${escapeHTML(openedBlog.author.username)}</a> · ${escapeHTML(blogDate(openedBlog.published_at || openedBlog.created_at))}`;
    $$(".blog-meta-author").forEach(link => link.addEventListener("click", event => event.stopPropagation()));
    const authorCard = $(".blog-author-card");
    if (openedBlog && authorCard && !$("[data-blog-inline-comments]")) {
      authorCard.insertAdjacentHTML("afterend", blogCommentsSection(openedBlog));
      const commentsSection = $("[data-blog-inline-comments]");
      loadBlogCommentsSection(openedBlog, commentsSection);
    }
    $$('[data-blog-feature]').forEach(el => el.addEventListener("click", event => { event.stopPropagation(); toggleBlogFeatured(el.dataset.blogFeature, el.dataset.blogFeatured === "true"); }));
    $$('[data-blog-delete]').forEach(el => el.addEventListener("click", event => { event.stopPropagation(); deleteBlogPost(el.dataset.blogDelete); }));
    $$('[data-blog-like]').forEach(el => el.addEventListener("click", event => { event.stopPropagation(); toggleBlogLike(el.dataset.blogLike); }));
    $$('[data-blog-save]').forEach(el => el.addEventListener("click", event => { event.stopPropagation(); toggleBlogSave(el.dataset.blogSave); }));
    $$('[data-blog-comments]').forEach(el => el.addEventListener("click", event => { event.stopPropagation(); const post = findBlogPost(el.dataset.blogComments); if (post) openBlogComments(post); }));
    $$('[data-blog-share]').forEach(el => el.addEventListener("click", event => { event.stopPropagation(); const post = findBlogPost(el.dataset.blogShare); if (post) shareBlog(post.id, post.title); }));
    if ($("#blog-form") && $(".blog-toolbar") && !$("#blog-inline-image")) {
      $(".blog-toolbar").insertAdjacentHTML("beforeend", '<button type="button" data-blog-command="strikeThrough">Riscado</button><button type="button" data-blog-command="insertOrderedList">1. Lista</button><button type="button" data-blog-command="justifyLeft">Esquerda</button><button type="button" data-blog-command="justifyCenter">Centro</button><button type="button" data-blog-command="justifyRight">Direita</button><button type="button" data-blog-command="undo">Desfazer</button><button type="button" data-blog-command="redo">Refazer</button><button type="button" data-blog-command="removeFormat">Limpar</button><button type="button" data-blog-break-box>Quebrar caixa</button><button type="button" data-blog-image>Imagem no texto</button>');
    }
    $$('[data-blog-command]').forEach(el => el.addEventListener("click", () => {
      const command = el.dataset.blogCommand;
      const value = el.dataset.blogValue;
      if (command === "createLink") {
        openBlogLinkDialog();
      } else document.execCommand(command, false, value || null);
      $("#blog-editor")?.focus();
    }));
    $('[data-blog-break-box]')?.addEventListener("click", () => {
      const editor = $("#blog-editor");
      if (!editor) return;
      editor.focus();
      document.execCommand("insertHTML", false, "<p><br></p>");
    });
    $('[data-blog-image]')?.addEventListener("click", () => {
      const selection = window.getSelection();
      state.blogEditorRange = selection?.rangeCount ? selection.getRangeAt(0).cloneRange() : null;
      const url = normalizeBlogImageUrl(window.prompt("Cole a URL da imagem para inserir no artigo:") || "");
      if (url === false) return toast("Informe uma URL de imagem vÃ¡lida.");
      if (!url) return;
      const editor = $("#blog-editor");
      if (!editor) return;
      editor.focus();
      document.execCommand("insertHTML", false, `<p><br></p><img src="${escapeHTML(url)}" alt="Imagem inserida no artigo"><p><br></p>`);
    });
    $("#blog-inline-image")?.addEventListener("change", async event => {
      const file = event.currentTarget.files?.[0];
      if (!file) return;
      try {
        const url = await uploadBlogImage(file, "inline");
        const editor = $("#blog-editor");
        if (!editor) return;
        editor.focus();
        const selection = window.getSelection();
        selection?.removeAllRanges();
        if (state.blogEditorRange) selection?.addRange(state.blogEditorRange);
        else {
          const range = document.createRange();
          range.selectNodeContents(editor);
          range.collapse(false);
          selection?.addRange(range);
        }
        document.execCommand("insertHTML", false, `<p><br></p><img src="${escapeHTML(url)}" alt="Imagem inserida no artigo"><p><br></p>`);
      } catch (error) {
        toast(error.message || "Não foi possível inserir a imagem.");
      } finally {
        event.currentTarget.value = "";
        state.blogEditorRange = null;
      }
    });
    if ($("#blog-form") && $(".blog-image-fields")) $(".blog-image-fields").insertAdjacentHTML("beforebegin", '<p class="format-hint blog-image-hint">Formato recomendado: capa vertical 720×1440; imagens laterais quadradas 900×900. Elas serão exibidas com a capa maior e as duas laterais empilhadas.</p>');
    const blogForm = $("#blog-form");
    if (blogForm) {
      const imageLabels = { cover: "URL da capa principal", image2: "URL da imagem lateral 1", image3: "URL da imagem lateral 2" };
      Object.entries(imageLabels).forEach(([name, label]) => {
        const input = $(`input[name=${name}]`, blogForm);
        if (!input) return;
        input.type = "url";
        input.removeAttribute("accept");
        input.placeholder = "https://exemplo.com/imagem.jpg";
        const labelElement = input.closest("label") || input.parentElement?.querySelector("label");
        if (labelElement) labelElement.textContent = label;
      });
    }
    if (blogForm) $("input[name=cover]", blogForm)?.setAttribute("required", "");
    $("#blog-form")?.addEventListener("submit", event => { event.preventDefault(); publishBlogPost(event.currentTarget); });
    if (state.section === "home") {
      $$(".featured-collections-rail .public-shelf-collection-cover").forEach((coverElement, index) => {
        const collection = state.featuredComicCollections?.[index];
        const coverUrl = collection?.cover_url || collection?.coverUrl;
        if (!coverUrl || $(".public-shelf-collection-cover-image", coverElement)) return;
        const image = document.createElement("img");
        image.className = "public-shelf-collection-cover-image";
        image.src = coverUrl;
        image.alt = `Capa da coleção ${collection.name || ""}`;
        image.loading = "lazy";
        coverElement.appendChild(image);
      });
    }
    $$('[data-public-collection]').forEach(el => el.addEventListener("click", event => { if (event.target.closest("a, button")) return; event.stopPropagation(); loadPublicProfile(el.dataset.publicOwner, el.dataset.publicCollection); }));
    $$('.public-shelf-collection-card').forEach(cardElement => {
      if ($('[data-save-public-collection]', cardElement) || !state.session || cardElement.dataset.publicOwner === state.profile?.username) return;
      const collectionId = cardElement.dataset.publicCollection;
      const collection = [...(state.featuredComicCollections || []), ...(state.popularPublicCollections || []), ...(state.savedPublicCollections || [])].find(item => item.id === collectionId);
      if (!collection || collection.collection_type === "blog") return;
      const actions = $(".shelf-section-actions", cardElement);
      if (!actions) return;
      const saved = state.savedPublicCollections?.some(item => item.id === collectionId);
      const button = document.createElement("button");
      button.className = `small-btn ${saved ? "is-liked" : ""}`;
      button.dataset.savePublicCollection = collectionId;
      button.dataset.savePublicOwner = collection.owner_id;
      button.textContent = saved ? "★ Salva" : "☆ Salvar";
      actions.appendChild(button);
      button.onclick = event => { event.preventDefault(); event.stopPropagation(); toggleSavePublicCollection(button); };
    });
    if (state.section === "public-profile" && state.publicProfile?.collectionId) {
      const category = state.publicProfile.collections?.find(item => item.id === state.publicProfile.collectionId);
      const actions = $(".public-collection-page .shelf-section-actions");
      if (category && actions && state.session && state.publicProfile.profile.id !== state.session.user.id && !$("[data-save-public-collection]", actions)) {
        const saved = state.savedPublicCollections?.some(item => item.id === category.id);
        const button = document.createElement("button");
        button.className = `small-btn ${saved ? "is-liked" : ""}`;
        button.dataset.savePublicCollection = category.id;
        button.dataset.savePublicOwner = state.publicProfile.profile.id;
        button.textContent = saved ? "★ Salva" : "☆ Salvar";
        actions.insertBefore(button, actions.firstChild);
        button.onclick = event => { event.preventDefault(); event.stopPropagation(); toggleSavePublicCollection(button); };
      }
    }
    if (state.section === "public-profile" && !state.publicProfile?.collectionId && state.session && state.publicProfile?.profile?.id !== state.session.user.id) {
      (state.publicProfile.collections || []).filter(category => category.isPublic !== false).forEach(category => {
        const copyButton = $$('[data-copy-collection]').find(button => button.dataset.copyCollection === category.id);
        const actions = copyButton?.closest(".shelf-section-actions");
        if (!actions || $("[data-save-public-collection]", actions)) return;
        const button = document.createElement("button");
        const saved = state.savedPublicCollections?.some(item => item.id === category.id);
        button.className = `small-btn ${saved ? "is-liked" : ""}`;
        button.dataset.savePublicCollection = category.id;
        button.dataset.savePublicOwner = state.publicProfile.profile.id;
        button.textContent = saved ? "★ Salva" : "☆ Salvar";
        actions.insertBefore(button, actions.firstChild);
        button.onclick = event => { event.preventDefault(); event.stopPropagation(); toggleSavePublicCollection(button); };
      });
    }
    $$('[data-publisher-settings]').forEach(el => el.addEventListener("click", event => { event.stopPropagation(); openPublisherSettings(el.dataset.publisherSettings); }));
    $$('[data-publisher-series-toggle]').forEach(el => el.addEventListener("click", event => {
      event.stopPropagation();
      const key = el.dataset.publisherSeriesToggle;
      state.publisherSeriesExpanded[key] = !state.publisherSeriesExpanded[key];
      render();
    }));
    $$('[data-comment-item]').forEach(el => el.addEventListener("click", event => {
      event.stopPropagation();
      const item = state.db.library.find(entry => entry.id === el.dataset.commentItem);
      if (item) openCommentsPopup(item);
    }));
    $$('[data-shelf-expand]').forEach(el => el.addEventListener("click", event => { event.stopPropagation(); state.shelfExpanded[el.dataset.shelfExpand] = !state.shelfExpanded[el.dataset.shelfExpand]; render(); }));
    $$('[data-shelf-media]').forEach(el => el.addEventListener("click", () => { state.shelfTab = el.dataset.shelfMedia; render(); }));
    $$('[data-public-shelf-media]').forEach(el => el.addEventListener("click", () => { state.publicShelfTab = el.dataset.publicShelfMedia; render(); }));
    $$('[data-profile-wall-comment-form]').forEach(form => form.onsubmit = async event => {
      event.preventDefault();
      if (!state.session || !sb) return openAuthPage();
      const body = String(new FormData(form).get("body") || "").trim();
      const profileId = state.section === "public-profile" ? state.publicProfile?.profile?.id : state.session.user.id;
      if (!body || !profileId) return;
      const result = await sb.from("profile_wall_comments").insert({ profile_id: profileId, user_id: state.session.user.id, body });
      if (result.error) return toast(result.error.message || "Não foi possível publicar o comentário.");
      const newComment = { id: `wall-local-${Date.now()}`, user_id: state.session.user.id, body, created_at: new Date().toISOString(), profiles: { ...state.profile } };
      if (state.section === "public-profile") state.publicProfile.wallComments = [newComment, ...(state.publicProfile.wallComments || [])];
      else state.wallComments = [newComment, ...(state.wallComments || [])];
      render();
    });
    const visibleWallComments = state.section === "public-profile" ? (state.publicProfile?.wallComments || []) : (state.wallComments || []);
    const wallArticles = $$(".profile-wall-comment");
    const wallCommentById = new Map();
    wallArticles.forEach((article, index) => {
      const comment = visibleWallComments[index];
      if (!comment) return;
      article.dataset.wallCommentId = comment.id;
      wallCommentById.set(String(comment.id), { article, comment });
    });
    wallArticles.forEach(({ dataset }) => {
      const entry = wallCommentById.get(String(dataset.wallCommentId));
      const comment = entry?.comment;
      const article = entry?.article;
      if (!comment || !article || !comment.parent_id) return;
      const parent = wallCommentById.get(String(comment.parent_id))?.article;
      if (!parent) return;
      let replies = $(".profile-wall-replies", parent);
      if (!replies) {
        replies = document.createElement("div");
        replies.className = "profile-wall-replies";
        parent.appendChild(replies);
      }
      replies.hidden = true;
      article.classList.add("is-reply");
      replies.appendChild(article);
    });
    $$(".profile-wall-replies").forEach(replies => {
      const parent = replies.parentElement;
      if (!parent || $("[data-wall-replies-toggle]", parent)) return;
      const toggle = document.createElement("button");
      toggle.className = "comment-action profile-wall-replies-toggle";
      toggle.dataset.wallRepliesToggle = "true";
      toggle.textContent = `Ver ${replies.children.length} resposta${replies.children.length === 1 ? "" : "s"}`;
      toggle.onclick = () => {
        replies.hidden = !replies.hidden;
        toggle.textContent = replies.hidden ? `Ver ${replies.children.length} resposta${replies.children.length === 1 ? "" : "s"}` : "Ocultar respostas";
      };
      parent.appendChild(toggle);
    });
    wallArticles.forEach(article => {
      const comment = wallCommentById.get(String(article.dataset.wallCommentId))?.comment;
      if (!comment) return;
      const actions = document.createElement("div");
      actions.className = "comment-actions";
      const reply = document.createElement("button");
      reply.className = "comment-action";
      reply.textContent = "Responder";
      reply.onclick = () => {
        if ($("[data-wall-reply-form]", article)) return;
        article.insertAdjacentHTML("beforeend", `<form class="comment-form profile-wall-reply-form" data-wall-reply-form><textarea name="body" maxlength="1000" required placeholder="Escreva uma resposta..."></textarea><button class="small-btn" type="submit">Responder</button></form>`);
        $("[data-wall-reply-form]", article).onsubmit = async event => {
          event.preventDefault();
          const body = String(new FormData(event.currentTarget).get("body") || "").trim();
          if (!body) return;
          const profileId = state.section === "public-profile" ? state.publicProfile?.profile?.id : state.session.user.id;
          const result = await sb.from("profile_wall_comments").insert({ profile_id: profileId, user_id: state.session.user.id, parent_id: comment.id, body });
          if (result.error) return toast(result.error.message || "Não foi possível publicar a resposta.");
          const newComment = { id: `wall-local-${Date.now()}`, user_id: state.session.user.id, parent_id: comment.id, body, created_at: new Date().toISOString(), profiles: { ...state.profile } };
          if (state.section === "public-profile") state.publicProfile.wallComments = [...(state.publicProfile.wallComments || []), newComment];
          else state.wallComments = [...(state.wallComments || []), newComment];
          render();
        };
      };
      actions.appendChild(reply);
      if (comment.user_id === state.session?.user?.id || ["moderator", "admin"].includes(state.profile?.plan)) {
        const remove = document.createElement("button");
        remove.className = "comment-action comment-delete-action";
        remove.textContent = "Excluir";
      remove.onclick = async () => {
        if (String(comment.id).startsWith("wall-local-")) {
          const filterLocal = entry => String(entry.id) !== String(comment.id) && String(entry.parent_id || "") !== String(comment.id);
          if (state.section === "public-profile") state.publicProfile.wallComments = (state.publicProfile.wallComments || []).filter(filterLocal);
          else state.wallComments = (state.wallComments || []).filter(filterLocal);
          return render();
        }
        const result = await sb.from("profile_wall_comments").delete().eq("id", comment.id);
          if (result.error) return toast(result.error.message || "Não foi possível excluir o comentário.");
          const filter = entry => String(entry.id) !== String(comment.id) && String(entry.parent_id || "") !== String(comment.id);
          if (state.section === "public-profile") state.publicProfile.wallComments = (state.publicProfile.wallComments || []).filter(filter);
          else state.wallComments = (state.wallComments || []).filter(filter);
          render();
        };
        actions.appendChild(remove);
      }
      article.appendChild(actions);
    });
    $$('.profile-wall [data-action="profile"]').forEach(button => {
      button.removeAttribute("data-action");
      button.addEventListener("click", openWallDescriptionEditor);
    });
    $('[data-blog-shelf-new]')?.addEventListener("click", openBlogShelfCollectionForm);
    $$('[data-blog-shelf-edit]').forEach(el => el.addEventListener("click", event => { event.stopPropagation(); openBlogShelfCollectionForm(el.dataset.blogShelfEdit); }));
    $$('[data-blog-shelf-delete]').forEach(el => el.addEventListener("click", event => { event.stopPropagation(); deleteBlogShelfCollection(el.dataset.blogShelfDelete); }));
    if (["moderator", "admin"].includes(state.profile?.plan)) {
      $$('[data-shelf-edit-category]').forEach(edit => {
        const category = state.shelfCategories.find(item => item.id === edit.dataset.shelfEditCategory);
        const alreadyFeaturedButton = [...edit.parentElement.querySelectorAll("[data-collection-feature]")].some(button => button.dataset.collectionFeature === category?.id);
        if (category && category.isPublic !== false && !alreadyFeaturedButton) edit.insertAdjacentHTML("beforebegin", `<button class="small-btn" data-collection-feature="${escapeHTML(category.id)}" data-collection-featured="${category.is_featured ? "true" : "false"}">${category.is_featured ? "Remover destaque" : "Destacar"}</button>`);
      });
    }
    $$('[data-collection-feature]').forEach(el => el.addEventListener("click", event => { event.stopPropagation(); toggleShelfCollectionFeatured(el.dataset.collectionFeature, el.dataset.collectionFeatured === "true"); }));
    $('[data-shelf-new-category]')?.addEventListener("click", () => openShelfCategoryForm());
    $$('[data-shelf-sort]').forEach(select => select.addEventListener("change", event => saveShelfSortOrder(event.currentTarget.dataset.shelfSort, event.currentTarget.value)));
    $$('[data-shelf-edit-category]').forEach(el => el.addEventListener("click", event => { event.stopPropagation(); openShelfCategoryForm(el.dataset.shelfEditCategory); }));
    $$('[data-shelf-delete-category]').forEach(el => el.addEventListener("click", event => { event.stopPropagation(); deleteShelfCategory(el.dataset.shelfDeleteCategory); }));
    if (state.section === "shelf") $$('[data-copy-collection]', $(".blog-shelf-panel-mount") || document).forEach(el => { delete el.dataset.copyUsername; });
    $$('[data-copy-collection]').forEach(el => {
      if (!el.dataset.copyUsername && state.profile?.username && !el.previousElementSibling?.matches("[data-shelf-open]")) {
        const openLink = document.createElement("a");
        openLink.className = "small-btn";
        openLink.dataset.shelfOpen = "true";
        openLink.href = publicProfileHref(state.profile.username, el.dataset.copyCollection);
        openLink.textContent = "Abrir";
        el.before(openLink);
      }
      el.addEventListener("click", event => { event.stopPropagation(); copyCollectionLink(el.dataset.copyCollection, el.dataset.copyUsername || state.profile?.username); });
    });
    if (state.section === "public-profile" && state.publicProfile?.collectionId && state.profile?.plan === "admin") {
      const actions = $(".public-collection-page .shelf-section-actions");
      const category = state.publicProfile.collections?.find(item => item.id === state.publicProfile.collectionId);
      if (actions && category && !$("[data-admin-delete-public-collection]", actions)) {
        const button = document.createElement("button");
        button.className = "small-btn danger";
        button.textContent = "Excluir coleção";
        button.dataset.adminDeletePublicCollection = category.id;
        button.dataset.collectionOwner = state.publicProfile.profile.id;
        button.onclick = () => deletePublicCollection(button.dataset.collectionOwner, button.dataset.adminDeletePublicCollection);
        actions.appendChild(button);
      }
    }
    $$('[data-like-collection]').forEach(el => el.addEventListener("click", event => { event.stopPropagation(); toggleCollectionLike(el.dataset.likeOwner, el.dataset.likeCollection); }));
    $('[data-open-moderation]')?.addEventListener("click", () => {
      const target = state.publicProfile?.profile;
      openModerationPanel(target);
      setTimeout(() => attachPlanControl($(".moderation-modal")?.closest(".modal-backdrop"), target), 0);
    });
    $('[data-follow-profile]')?.addEventListener("click", () => toggleProfileFollow(state.publicProfile?.profile));
    $('[data-block-profile]')?.addEventListener("click", () => toggleProfileBlock(state.publicProfile?.profile));
    $('[data-unblock-profile]')?.addEventListener("click", () => toggleProfileBlock(state.publicProfile?.profile));
    $("[data-collection-filter-form]")?.addEventListener("submit", event => { event.preventDefault(); const form = new FormData(event.currentTarget); state.collectionFilter = { field: String(form.get("field") || "all"), query: String(form.get("query") || "") }; render(); });
    $("[data-clear-collection-filter]")?.addEventListener("click", () => { state.collectionFilter = { field: "all", query: "" }; render(); });
    $$("[data-open]").forEach(el => el.addEventListener("click", () => {
      $$(".card-wrap > .card-actions").forEach(actions => {
        if ($("[data-card-about]", actions)) return;
        const card = actions.parentElement?.querySelector(":scope > .card");
        if (!card?.dataset.open) return;
        const button = document.createElement("button");
        button.className = "card-about";
        button.dataset.cardAbout = card.dataset.open;
        button.type = "button";
        button.textContent = "Sobre";
        button.title = "Mostrar informações";
        actions.prepend(button);
      });
    $$('[data-card-about]').filter(button => !button.dataset.aboutBound).forEach(button => { button.dataset.aboutBound = "true"; button.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();
        const card = button.closest(".card-wrap")?.querySelector(":scope > .card");
        if (!card) return;
        const open = card.classList.toggle("is-about-open");
        button.textContent = open ? "Fechar" : "Sobre";
      }); });
      const item = state.db.library.find(x => x.id === el.dataset.open);
      if (el.dataset.openDirect === "true") openReader(item);
      else openItem(item);
    }));
    $$(".card-wrap > .card-actions").forEach(actions => {
      if ($("[data-card-about]", actions)) return;
      const card = actions.parentElement?.querySelector(":scope > .card");
      if (!card?.dataset.open) return;
      const button = document.createElement("button");
      button.className = "card-about";
      button.dataset.cardAbout = card.dataset.open;
      button.type = "button";
      button.textContent = "Sobre";
      button.title = "Mostrar informações";
      actions.prepend(button);
    });
    $$('[data-card-about]').filter(button => !button.dataset.aboutBound).forEach(button => { button.dataset.aboutBound = "true"; button.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      const card = button.closest(".card-wrap")?.querySelector(":scope > .card");
      if (!card) return;
      const open = card.classList.toggle("is-about-open");
      button.textContent = open ? "Fechar" : "Sobre";
    }); });
    $$("[data-section]").forEach(el => {
      if (el.dataset.sectionBound) return;
      el.dataset.sectionBound = "true";
      el.addEventListener("click", () => {
      const s = el.dataset.section;
      if (s === "factions") {
        const canOpenOwnFaction = state.session && state.profile?.faction_id && !["moderator", "admin"].includes(state.profile?.plan);
        return canOpenOwnFaction
          ? navigate({ pagina: "faccoes", faccao: factionRouteKey(state.profile.faction_id) })
          : navigate({ pagina: "ranking", secao: "faccoes" });
      }
      setSection(s === "comics" ? "comic" : s);
      });
    });
    $$("[data-action]").forEach(el => {
      if (el.dataset.actionBound) return;
      el.dataset.actionBound = "true";
      el.addEventListener("click", () => {
      const a = el.dataset.action;
      if (a === "home") setSection("home");
      if (a === "random") openReader(weightedRandom(state.db.library));
      if (a === "focus-search") { setSection("search"); setTimeout(() => $("#search-input")?.focus(), 30); }
      if (a === "do-search") { state.search = $("#search-input")?.value || ""; navigate({ pagina: "pesquisar", q: state.search }); }
      if (a === "open-admin") { if (canManage) openAdmin(); }
      if (a === "open-auth") state.session ? setSection("shelf") : openAuthPage();
      if (a === "messages") openChat();
      if (a === "downloads") setSection("downloads");
      if (a === "notifications-popup") openNotificationsPopup();
      if (a === "staff-activity") { if (["moderator", "admin"].includes(state.profile?.plan)) openNotificationsPopup("staff"); }
      if (a === "logout") signOut();
      if (a === "profile") openProfileSettings();
      if (a === "submit") { if (isAdmin) openSubmission(); else toast("O envio de quadrinhos é exclusivo para administradores."); }
      if (a === "open-local-box") { state.localBoxVisible = true; setSection("local-box"); }
      });
    });
    $$("[data-collection]").forEach(el => el.addEventListener("click", () => openCollection(el.dataset.collection)));
    const openSeriesById = seriesId => {
      const first = state.db.library.find(item => item.seriesId === seriesId);
      if (first) openSeriesSelection(first, seriesEditions(first));
    };
    $$('[data-view-series]').forEach(el => el.addEventListener("click", event => {
      event.stopPropagation();
      openSeriesById(el.dataset.viewSeries);
    }));
    $$('.series-card[data-open-series]').forEach(el => {
      if (state.session && !$("[data-series-download]", el)) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "card-download series-download-button";
        button.dataset.seriesDownload = el.dataset.openSeries;
        button.title = "Permitir leitura offline da série";
        button.textContent = "↓";
        const footerActions = $(".series-card-footer-actions", el);
        const filterControl = $(".cover-effect-controls", footerActions);
        const saveButton = $("[data-series-favorite]", footerActions);
        if (footerActions) footerActions.insertBefore(button, filterControl || saveButton || null);
        button.addEventListener("click", event => {
          event.stopPropagation();
          const first = state.db.library.find(item => String(item.seriesId) === String(el.dataset.openSeries));
          if (first) startSeriesDownload(seriesEditions(first));
        });
      }
      el.addEventListener("click", event => {
        if (event.target.closest("button")) return;
        openSeriesById(el.dataset.openSeries);
      });
    });
    if ($('[data-action="clear-local-box"]')) $('[data-action="clear-local-box"]').onclick = () => { clearLocalBox(); render(); toast("Minha caixa foi limpa."); };
    $("#local-folder-input")?.addEventListener("change", event => {
      const files = [...event.target.files].filter(supportedLocalFile);
      if (!files.length) return toast("Nenhum quadrinho compatível foi encontrado na pasta.");
      files.forEach(file => openLocalFile(file, true));
    });
    $("#local-file-input")?.addEventListener("change", event => openLocalFile(event.target.files[0]));
    $$('[data-local-open]').forEach(el => el.addEventListener("click", () => {
      const file = state.localBoxFiles.find(item => item.id === el.dataset.localOpen);
      if (file) openReader(file);
    }));
    $("#search-input")?.addEventListener("keydown", e => {
      if (e.key === "Enter") { state.search = e.target.value; render(); $("#search-input")?.focus(); }
    });
    $("#auth-form")?.addEventListener("submit", async event => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const identifier = String(form.get("username") || "").trim();
      const username = cleanUsername(identifier);
      const password = String(form.get("password") || "");
      const message = $("#auth-message");
      if (!sb) { message.textContent = "A autenticação ainda não foi configurada."; return; }
      if (!identifier.includes("@") && !/^[a-z0-9_]{3,24}$/.test(username)) { message.textContent = "Use de 3 a 24 caracteres: letras, números ou _."; return; }
      const mode = event.submitter?.dataset.authMode || event.currentTarget.dataset.authMode || "login";
      state.offlineUsername = !identifier.includes("@") ? username : "";
      const providedEmail = String(form.get("email") || "").trim().toLowerCase();
      if (mode === "signup" && providedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(providedEmail)) { message.textContent = "Informe um email válido ou deixe o campo em branco."; return; }
      const signupUsername = identifier.includes("@")
        ? cleanUsername(identifier.split("@")[0]).replace(/[^a-z0-9_]/g, "_").slice(0, 24)
        : username;
      if (mode === "signup" && !/^[a-z0-9_]{3,24}$/.test(signupUsername)) { message.textContent = "Não foi possível definir um usuário a partir deste email. Use um usuário de 3 a 24 caracteres."; return; }
      if (mode === "signup") {
        const existing = await sb.from("profiles").select("id").eq("username", signupUsername).maybeSingle();
        if (existing.data) { message.textContent = "Esse usuário já está em uso. Escolha outro."; return; }
      }
      let email = mode === "signup" ? (providedEmail || authEmail(username)) : (identifier.includes("@") ? identifier.toLowerCase() : authEmail(username));
      if (mode === "login" && !identifier.includes("@")) {
        const lookup = await sb.rpc("get_login_email", { p_username: username });
        if (lookup.data) email = lookup.data;
      }
      const result = mode === "signup"
        ? await sb.auth.signUp({ email, password, options: { data: { username: signupUsername } } })
        : await sb.auth.signInWithPassword({ email, password });
      if (result.error) {
        if (mode === "signup" && !providedEmail && /email rate limit exceeded/i.test(result.error.message)) {
          message.textContent = "O cadastro sem email exige a confirmação de email desativada no Supabase. Desative-a em Authentication > Providers > Email ou informe um email válido.";
        } else {
          message.textContent = /database error saving new user/i.test(result.error.message)
            ? "Não foi possível criar a conta. Verifique se esse usuário já está em uso."
            : result.error.message;
        }
        return;
      }
      if (mode === "signup" && !result.data.session) { message.textContent = "Conta criada. Desative a confirmação de email no Supabase para entrar sem email."; return; }
      await loadAccount();
      setSection("shelf");
    });
    $$('[data-auth-mode]').forEach(button => button.addEventListener("click", () => {
      $("#auth-form").dataset.authMode = button.dataset.authMode;
    }));
    $$("[data-auth-switch]").forEach(button => button.addEventListener("click", () => {
      if (button.dataset.authSwitch === "signup") openSignupPage();
      else openAuthPage();
    }));
    $("[data-forgot-password]")?.addEventListener("click", openPasswordRecoveryModal);
    $("#password-reset-form")?.addEventListener("submit", async event => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const password = String(form.get("password") || "");
      const confirmation = String(form.get("confirmation") || "");
      const message = $("#auth-message");
      if (password !== confirmation) { message.textContent = "As senhas não coincidem."; return; }
      const result = await sb.auth.updateUser({ password });
      if (result.error) { message.textContent = result.error.message; return; }
      await sb.auth.signOut({ scope: "global" });
      state.session = null; state.profile = null; state.downloads = new Map(); state.favoriteIds = new Set();
      toast("Senha alterada. Entre novamente com a nova senha.");
      setSection("login");
    });
  }

  function openSeriesSelection(series, editions, returnToCoverVariants = false) {
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
          <div class="modal-actions"><button class="small-btn" data-back-cover-variants ${returnToCoverVariants ? "" : "hidden"}>Voltar</button><button class="small-btn" data-close>Fechar</button></div>
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
   $('[data-back-cover-variants]', overlay)?.addEventListener("click", () => { overlay.remove(); openCoverVariantsReviewPopup(); });
    $$('[data-download]', overlay).forEach(el => el.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      const item = state.db.library.find(entry => String(entry.id) === String(el.dataset.download));
      const download = item && downloaded(item.id);
      const isCompleted = download?.status === "completed" || el.classList.contains("is-downloaded") || /Excluir download offline/i.test(el.title || "");
      if (!item || download?.status === "downloading" || download?.status === "waiting") return;
      isCompleted ? deleteDownload(item.id) : startDownload(item);
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

  function openCollection(id) {
    if (state.db.collections.some(collection => collection.id === id)) navigate({ pagina: "colecoes", colecao: id });
  }

  function detectFormat(url = "") {
    const clean = String(url).split("?")[0].split("#")[0].toLowerCase();
    return clean.match(/\.(pdf|cbz|cbr|jpg|jpeg|png|webp|gif)$/)?.[1] || "auto";
  }

  function openCoverVariantsAdmin() {
    if (!sb || !["moderator", "admin"].includes(state.profile?.plan)) return;
    const items = state.db.library.filter(item => item.type === "comic").sort((a, b) => itemDisplayTitle(a).localeCompare(itemDisplayTitle(b), "pt-BR"));
    const overlay = document.createElement("div");
    overlay.className = "modal-backdrop";
    overlay.innerHTML = `<div class="modal cover-variants-admin-modal"><div class="section-head"><div><h2>Capas variantes oficiais</h2><div class="section-subtitle">Cadastre capas hospedadas oficialmente pela DC para usuários Premium.</div></div><button class="small-btn" data-close>Fechar</button></div><form id="cover-variant-admin-form"><div class="field full"><label>Edição</label><select name="itemId" required>${items.map(item => `<option value="${escapeHTML(item.id)}">${escapeHTML(itemDisplayTitle(item))}${item.issue ? ` — ${escapeHTML(item.issue)}` : ""}</option>`).join("")}</select></div><div class="form-grid"><div class="field"><label>Chave da variante</label><input name="variantKey" required pattern="[A-Za-z0-9_-]{1,80}" placeholder="ex.: variant-a"></div><div class="field"><label>Nome da variante</label><input name="label" required maxlength="80" placeholder="Capa variante A"></div></div><div class="field full"><label>URL oficial da capa</label><input name="coverUrl" type="url" required pattern="https://static\\.dc\\.com/.*" placeholder="https://static.dc.com/2025-01/...jpg"><small class="format-hint">A URL precisa começar com https://static.dc.com/.</small></div><div class="field full"><label>URL da página fonte (opcional)</label><input name="sourceUrl" type="url" placeholder="https://www.dc.com/comics/..."></div><div class="modal-actions"><button type="button" class="small-btn" data-close>Cancelar</button><button class="btn btn-danger">Salvar variante</button></div></form><div class="section-subtitle cover-variants-admin-list"></div></div>`;
    overlay.innerHTML = overlay.innerHTML.replace(/\bFree\b/g, "Comum").replace(/\bPremium\b/g, "Lenda");
    $("#modal-root").appendChild(overlay);
    $$('[data-close]', overlay).forEach(button => button.onclick = () => overlay.remove());
    const itemSelect = $("select[name=itemId]", overlay);
    const list = $(".cover-variants-admin-list", overlay);
    const refreshList = () => {
      const variants = state.coverVariants.get(itemSelect.value) || [];
      list.innerHTML = variants.length ? `<div class="section-subtitle">Variantes cadastradas</div>${variants.map(variant => `<div class="admin-cover-variant-row"><span><b>${escapeHTML(variant.label)}</b><small>${escapeHTML(variant.cover_url)}</small></span><button type="button" class="small-btn danger" data-delete-cover-variant="${escapeHTML(variant.item_id)}" data-delete-variant-key="${escapeHTML(variant.variant_key)}">Excluir</button></div>`).join("")}` : "Nenhuma variante cadastrada para esta edição.";
      $$('[data-delete-cover-variant]', overlay).forEach(button => button.onclick = async () => {
        const result = await sb.from("comic_cover_variants").delete().eq("item_id", button.dataset.deleteCoverVariant).eq("variant_key", button.dataset.deleteVariantKey);
        if (result.error) return toast(result.error.message);
        await loadCoverCatalog();
        refreshList();
        render();
      });
    };
    itemSelect.addEventListener("change", refreshList);
    refreshList();
    $("#cover-variant-admin-form", overlay).onsubmit = async event => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const coverUrl = String(form.get("coverUrl") || "").trim();
      if (!/^https:\/\/static\.dc\.com\//i.test(coverUrl)) return toast("A capa precisa usar uma URL oficial da DC.");
      const payload = { item_id: String(form.get("itemId")), variant_key: String(form.get("variantKey") || "").trim(), label: String(form.get("label") || "").trim(), cover_url: coverUrl, source_url: String(form.get("sourceUrl") || "").trim() || null, created_at: new Date().toISOString() };
      const result = await sb.from("comic_cover_variants").upsert(payload, { onConflict: "item_id,variant_key" });
      if (result.error) return toast(result.error.message);
      await loadCoverCatalog();
      event.currentTarget.reset();
      itemSelect.value = payload.item_id;
      refreshList();
      render();
      toast("Capa variante cadastrada.");
    };
  }

  function openAdmin(editId = null) {
    const existing = editId ? state.db.library.find(x => x.id === editId) : null;
    const overlay = document.createElement("div");
    overlay.className = "modal-backdrop";
    overlay.innerHTML = `
      <div class="modal">
        <div class="section-head">
          <div><h2>Administração</h2><div class="section-subtitle">Catálogo e metadados</div></div>
          <button class="small-btn" data-close>Fechar</button>
        </div>

        <div class="notice">
          <b>Use URLs diretas para os arquivos.</b> Cadastre o link direto para o PDF, CBZ ou outro arquivo no campo "Link da fonte". O site não precisa guardar uma cópia do quadrinho. A funcionalidade de ler arquivos do Telegram foi removida.
        </div>

        <div class="admin-actions" style="margin-bottom:15px">
          <button class="btn btn-danger" data-new>+ Nova edição</button>
          <button class="small-btn" data-cover-variants>Capas variantes</button>
          <button class="small-btn" data-export>Exportar catálogo</button>
          <button class="small-btn" data-import>Importar catálogo</button>
          <button class="small-btn" data-reset>Restaurar exemplo</button>
        </div>

        <table class="admin-table">
          <thead><tr><th>Edição</th><th>Tipo</th><th>Leituras</th><th>Ações</th></tr></thead>
          <tbody>
            ${state.db.library.map(x => `
              <tr>
                <td><b>${escapeHTML(x.title)}</b><br><span style="color:#777">${escapeHTML(x.issue||"")}</span></td>
                <td>${formatType(x.type)}</td>
                <td>${Number(x.clicks||0).toLocaleString("pt-BR")}</td>
                <td><div class="admin-actions">
                  <button class="small-btn" data-edit="${escapeHTML(x.id)}">Editar</button>
                  <button class="small-btn danger" data-delete="${escapeHTML(x.id)}">Excluir</button>
                </div></td>
              </tr>`).join("")}
          </tbody>
        </table>
      </div>`;
    $("#modal-root").appendChild(overlay);

    $("[data-close]", overlay).onclick = () => overlay.remove();
    $("[data-cover-variants]", overlay).onclick = () => { overlay.remove(); openCoverVariantsAdmin(); };
    $("[data-new]", overlay).onclick = () => { overlay.remove(); openEditForm(); };
    $("[data-export]", overlay).onclick = exportDB;
    $("[data-import]", overlay).onclick = importDB;
    $("[data-reset]", overlay).onclick = () => {
      state.db = {library:structuredClone(window.DEFAULT_LIBRARY), collections:structuredClone(window.DEFAULT_COLLECTIONS), submissions:[], removedItemIds:[]};
      save(); overlay.remove(); render(); toast("Catálogo restaurado.");
    };
    $$("[data-edit]", overlay).forEach(b => b.onclick = () => { overlay.remove(); openEditForm(b.dataset.edit); });
    $$("[data-delete]", overlay).forEach(b => b.onclick = () => {
      const itemId = b.dataset.delete;
      state.db.removedItemIds = Array.isArray(state.db.removedItemIds) ? state.db.removedItemIds : [];
      if (!state.db.removedItemIds.includes(itemId)) state.db.removedItemIds.push(itemId);
      state.db.library = state.db.library.filter(x => x.id !== itemId);
      state.db.collections.forEach(c => c.issueIds = c.issueIds.filter(i => i !== itemId));
      save(); overlay.remove(); render(); openAdmin(); toast("Edição excluída.");
    });
  }

  function openEditForm(id = null) {
    const x = id ? state.db.library.find(i => i.id === id) : {
      id: "item-" + Date.now(), addedAt: new Date().toISOString(), title:"", issue:"", type:"comic", author:"", year:new Date().getFullYear(),
      description:"", cover:"", fileUrl:"", telegramUrl:"", format:"pdf", clicks:0, featured:false, randomWeight:5, tags:[], collectionIds:[]
    };

    const overlay = document.createElement("div");
    overlay.className = "modal-backdrop";
    overlay.innerHTML = `
      <div class="modal">
        <h2>${id ? "Editar edição" : "Nova edição"}</h2>
        <form id="edit-form">
          <div class="form-grid">
            <div class="field"><label>Título</label><input name="title" required value="${escapeHTML(x.title)}"></div>
            <div class="field"><label>Edição / capítulo</label><input name="issue" value="${escapeHTML(x.issue||"")}"></div>
            <div class="field"><label>Tipo</label><select name="type">
              <option value="comic" ${x.type==="comic"?"selected":""}>Quadrinho</option>
              <option value="manga" ${x.type==="manga"?"selected":""}>Mangá</option>
            </select></div>
            <div class="field"><label>Ano</label><input name="year" type="number" value="${escapeHTML(x.year||"")}"></div>
            <div class="field"><label>Autor</label><input name="author" value="${escapeHTML(x.author||"")}"></div>
            <div class="field"><label>Formato</label><select name="format">
              ${["pdf","cbz","cbr","jpg","jpeg","png","webp","gif"].map(f=>`<option ${x.format===f?"selected":""}>${f}</option>`).join("")}
            </select></div>
            <div class="field full"><label>Link da fonte</label><input name="sourceUrl" required placeholder="https://t.me/seucanal/123 ou URL direta" value="${escapeHTML(x.telegramUrl || x.fileUrl || "")}"></div>
            <div class="field full"><label>Capa</label><div style="color:#aaa;font-size:12px">Automática: será usada a primeira página/imagem do arquivo. Não é necessário enviar uma capa separada.</div></div>
            <div class="field full"><label>Descrição</label><textarea name="description">${escapeHTML(x.description||"")}</textarea></div>
            <div class="field"><label>Tags separadas por vírgula</label><input name="tags" value="${escapeHTML((x.tags||[]).join(", "))}"></div>
            <div class="field"><label>Peso do aleatório</label><input name="randomWeight" type="number" min="1" value="${escapeHTML(x.randomWeight||5)}"></div>
            <div class="field full">
              <label><input name="featured" type="checkbox" ${x.featured?"checked":""}> Mostrar como destaque</label>
            </div>
          </div>
          <div class="modal-actions">
            <button type="button" class="small-btn" data-close>Cancelar</button>
            <button class="btn btn-danger">Salvar</button>
          </div>
        </form>
      </div>`;
    $("#modal-root").appendChild(overlay);
    $("[data-close]", overlay).onclick = () => overlay.remove();
    $("#edit-form", overlay).onsubmit = e => {
      e.preventDefault();
      const fd = new FormData(e.currentTarget);
      const data = Object.fromEntries(fd.entries());

      const sourceUrl = (data.sourceUrl || "").trim();
      let telegramUrl = "";
      let fileUrl = "";
      if (/^https?:\/\/(www\.)?t(elegram)?\.me\//.test(sourceUrl)) {
        telegramUrl = sourceUrl;
      } else {
        fileUrl = sourceUrl;
      }

      const item = {
        ...x,
        title:data.title.trim(), issue:data.issue.trim(), type:data.type, year:Number(data.year)||new Date().getFullYear(),
        author:data.author.trim(), format:data.format, fileUrl, telegramUrl,
        coverUrl:x.coverUrl || "", description:data.description.trim(), tags:data.tags.split(",").map(s=>s.trim()).filter(Boolean),
        randomWeight:Math.max(1, Number(data.randomWeight)||1), featured:fd.get("featured")==="on"
      };
      const idx = state.db.library.findIndex(i => i.id === item.id);
      if (idx >= 0) state.db.library[idx] = item; else state.db.library.push(item);
      save(); overlay.remove(); render(); toast("Edição salva.");
    };
  }

  function renderCatalog(type = null) {
    const items = type ? state.db.library.filter(x => x.type === type) : state.db.library;
    const series = uniqueCatalogItems(items.filter(x => x.seriesId));
    const oneshots = uniqueCatalogItems(items.filter(x => !x.seriesId));
    const heading = type === "manga" ? "Mangás" : type === "comic" ? "Quadrinhos" : "Catálogo";
    const group = (title, groupItems, isSeries = false) => groupItems.length ? `<section class="section"><div class="section-head"><div><h2 class="section-title">${title}</h2><div class="section-subtitle">${groupItems.length} obra(s)</div></div></div><div class="results-grid${type === "comic" && isSeries ? " catalog-series-grid" : ""}">${groupItems.map(item => isSeries ? seriesCard(item) : card(item)).join("")}</div></section>` : "";
    const publishers = new Map();
    items.filter(item => String(item.publisher || "").trim()).forEach(item => {
      const publisher = String(item.publisher).trim();
      if (!publishers.has(publisher)) publishers.set(publisher, []);
      publishers.get(publisher).push(item);
    });
    const publisherCarousel = type === "comic" && publishers.size ? `<section class="section publisher-carousel-section"><div class="section-head"><div><h2 class="section-title">Editoras</h2><div class="section-subtitle">Explore os quadrinhos por editora</div></div></div><div class="publisher-carousel">${[...publishers.entries()].sort((a, b) => a[0].localeCompare(b[0], "pt-BR")).map(([publisher, publisherItems]) => { const representative = publisherItems.find(item => item.featuredCoverUrl || item.coverUrl || item.cover) || publisherItems[0]; return `<button class="publisher-card" type="button" data-publisher="${escapeHTML(publisher)}"><div class="publisher-card-cover" style="background-image:url('${escapeHTML(coverFor(representative))}')"></div><div class="publisher-card-overlay"></div><div class="publisher-card-info"><strong>${escapeHTML(publisher)}</strong><span>${publisherItems.length} quadrinho(s)</span></div></button>`; }).join("")}</div></section>` : "";
    const catalogHeader = type === "comic" ? "" : `<div class="section-head"><div><h1 class="section-title">${heading}</h1><div class="section-subtitle">${items.length} edição(ões)</div></div></div>`;
    return `<div class="content">${catalogHeader}${group("Séries", series, true)}${group("Oneshots", oneshots)}${!items.length ? `<div class="empty">Nenhuma edição cadastrada.</div>` : ""}${publisherCarousel}</div>`;
  }

  function openSubmission() {
    const overlay = document.createElement("div");
    overlay.className = "modal-backdrop";
    overlay.innerHTML = `
      <div class="modal">
        <h2>Enviar quadrinho</h2>
        <p style="color:#aaa">Envie os dados da obra e um link para o arquivo. O arquivo não é copiado para esta hospedagem.</p>
        <form id="submission-form">
          <div class="form-grid">
            <div class="field"><label>Seu nome</label><input name="author" required></div>
            <div class="field"><label>Título</label><input name="title" required></div>
            <div class="field"><label>Tipo</label><select name="type"><option value="comic">Quadrinho</option><option value="manga">Mangá</option></select></div>
            <div class="field"><label>Edição/capítulo</label><input name="issue"></div>
            <div class="field full"><label>Link da fonte</label><input name="sourceUrl" required placeholder="https://t.me/... ou https://..."></div>
            <div class="field full"><label>Mensagem</label><textarea name="message" placeholder="Conte um pouco sobre a obra."></textarea></div>
          </div>
          <div class="modal-actions">
            <button type="button" class="small-btn" data-close>Cancelar</button>
            <button class="btn btn-danger">Enviar</button>
          </div>
        </form>
      </div>`;
    $("#modal-root").appendChild(overlay);
    $("[data-close]", overlay).onclick = () => overlay.remove();
    $("#submission-form", overlay).onsubmit = e => {
      e.preventDefault();
      const fd = new FormData(e.currentTarget);
      const data = Object.fromEntries(fd.entries());

      const sourceUrl = (data.sourceUrl || "").trim();
      let telegramUrl = "";
      let fileUrl = "";
      if (/^https?:\/\/(www\.)?t(elegram)?\.me\//.test(sourceUrl)) {
        telegramUrl = sourceUrl;
      } else {
        fileUrl = sourceUrl;
      }
      delete data.sourceUrl;

      state.db.submissions.push({
        ...data,
        fileUrl, telegramUrl,
        createdAt:new Date().toISOString(), id:"sub-"+Date.now()});
      save(); overlay.remove(); toast("Envio registrado. No modo local, ele fica salvo neste navegador.");
    };
  }

  function exportDB() {
    const blob = new Blob([JSON.stringify(state.db, null, 2)], {type:"application/json"});
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "banca-digital-catalogo.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  function importDB() {
    const input = document.createElement("input");
    input.type = "file"; input.accept = ".json,application/json";
    input.onchange = async () => {
      try {
        const text = await input.files[0].text();
        const db = JSON.parse(text);
        if (!Array.isArray(db.library) || !Array.isArray(db.collections)) throw new Error("Formato inválido");
        state.db = db; save(); render(); toast("Catálogo importado.");
      } catch (e) { alert("Não foi possível importar: " + e.message); }
    };
    input.click();
  }

  // Inicialização
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
  function openAdminNotificationForm() {
    if (!sb || state.profile?.plan !== "admin") return toast("Apenas administradores podem enviar notificações.");
    const overlay = document.createElement("div");
    overlay.className = "modal-backdrop";
    overlay.innerHTML = '<div class="modal"><div class="section-head"><div><h2>Enviar notificação geral</h2><div class="section-subtitle">A mensagem será enviada para todos os usuários.</div></div><button class="small-btn" data-close>Fechar</button></div><form id="admin-notification-form"><div class="field"><label>Título</label><input name="title" maxlength="120" required placeholder="Ex.: Novidade na banca"></div><div class="field"><label>Mensagem</label><textarea name="body" maxlength="500" required placeholder="Escreva o aviso..."></textarea></div><div class="field"><label>Tipo</label><select name="type"><option value="announcement">Aviso</option><option value="event">Evento</option><option value="maintenance">Manutenção</option></select></div><div class="modal-actions"><button type="button" class="small-btn" data-close>Cancelar</button><button type="submit" class="btn btn-danger">Enviar para todos</button></div></form></div>';
    $("#modal-root").appendChild(overlay);
    $$('[data-close]', overlay).forEach(button => button.onclick = () => overlay.remove());
    $("#admin-notification-form", overlay).onsubmit = async event => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const result = await sb.rpc("send_notification_to_all", { p_title: String(form.get("title") || "").trim(), p_body: String(form.get("body") || "").trim(), p_type: String(form.get("type") || "announcement") });
      if (result.error) return toast(result.error.message || "Não foi possível enviar a notificação.");
      overlay.remove();
      toast("Notificação enviada para " + (result.data || 0) + " usuário(s).");
    };
  }

  function openAdmin(editId = null) {
    cancelCoverLoads();
    const overlay = document.createElement("div");
    overlay.className = "modal-backdrop";
    overlay.innerHTML = `
      <div class="modal admin-modal">
        <div class="section-head"><div><h2>Administração</h2><div class="section-subtitle">Catálogo de obras, edições e coleções</div></div><button class="small-btn" data-close>Fechar</button></div>
        <div class="notice"><b>Oneshots e séries</b><br>Deixe o campo Série vazio para abrir uma edição diretamente. Use o mesmo nome de série em várias edições para criar a seleção de volumes.</div>
        <div class="admin-actions" style="margin-bottom:15px">
          <button class="btn btn-danger" data-new>+ Nova edição</button><button class="small-btn" data-new-collection>+ Criar coleção</button><button class="small-btn" data-achievements>Títulos</button><button class="small-btn" data-account-plan>Tipo de conta</button>
          <button class="small-btn" data-export>Exportar</button><button class="small-btn" data-import>Importar</button><button class="small-btn" data-reset>Restaurar exemplo</button>
        </div>
        <table class="admin-table"><thead><tr><th>Série / edição</th><th>Editora</th><th>Selo</th><th>Personagem</th><th>Ano</th><th>Ações</th></tr></thead><tbody>
          ${state.db.library.map(x => `<tr><td><b>${escapeHTML(x.seriesTitle || x.title)}</b><br><span style="color:#777">${escapeHTML(x.issue || (x.seriesId ? "Edição" : "Oneshot"))}</span></td><td>${escapeHTML(x.publisher || "—")}</td><td>${escapeHTML(x.imprint || "—")}</td><td>${escapeHTML(x.character || "—")}</td><td>${escapeHTML(String(x.year || "—"))}</td><td><div class="admin-actions"><button class="small-btn" data-edit="${escapeHTML(x.id)}">Editar</button><button class="small-btn danger" data-delete="${escapeHTML(x.id)}">Excluir</button></div></td></tr>`).join("")}
        </tbody></table>
        <h3 style="margin-top:28px">Coleções</h3>
        <div class="admin-collection-list">${state.db.collections.map(c => `<div><b>${escapeHTML(c.title)}</b><span>${c.issueIds.length} edições</span><button class="small-btn danger" data-delete-collection="${escapeHTML(c.id)}">Excluir</button></div>`).join("") || "Nenhuma coleção criada."}</div>
      </div>`;
    $("#modal-root").appendChild(overlay);
    const closeAdmin = event => { event?.preventDefault(); event?.stopPropagation(); overlay.remove(); hydrateHomeCovers(); };
    const notificationButton = document.createElement("button");
    notificationButton.className = "small-btn";
    notificationButton.textContent = "Enviar notificação";
    $(".admin-actions", overlay)?.appendChild(notificationButton);
    notificationButton.onclick = () => { overlay.remove(); openAdminNotificationForm(); };
    $("[data-close]", overlay).onclick = closeAdmin;
    $("[data-new]", overlay).onclick = () => { overlay.remove(); openEditForm(); };
    $("[data-new-collection]", overlay).onclick = () => { overlay.remove(); openCollectionForm(); };
    $("[data-achievements]", overlay).onclick = () => { overlay.remove(); openAchievementAdmin(); };
    $("[data-account-plan]", overlay).onclick = () => { overlay.remove(); openAccountPlanAdmin(); };
    $("[data-export]", overlay).onclick = exportDB; $("[data-import]", overlay).onclick = importDB;
    $("[data-reset]", overlay).onclick = () => { state.db = { library: structuredClone(window.DEFAULT_LIBRARY), collections: structuredClone(window.DEFAULT_COLLECTIONS), submissions: [] }; saveCatalog("Catálogo restaurado."); overlay.remove(); render(); };
    $$('[data-edit]', overlay).forEach(button => button.onclick = () => { overlay.remove(); openEditForm(button.dataset.edit); });
    $$('[data-delete]', overlay).forEach(button => button.onclick = () => { state.db.library = state.db.library.filter(x => x.id !== button.dataset.delete); state.db.collections.forEach(c => c.issueIds = c.issueIds.filter(id => id !== button.dataset.delete)); saveCatalog("Edição excluída."); overlay.remove(); render(); openAdmin(); });
    $$('[data-delete-collection]', overlay).forEach(button => button.onclick = () => { state.db.collections = state.db.collections.filter(c => c.id !== button.dataset.deleteCollection); saveCatalog("Coleção excluída."); overlay.remove(); openAdmin(); });
  }

  function openEditForm(id = null) {
    const old = id ? state.db.library.find(x => x.id === id) : null;
    const x = old || { id: "item-" + Date.now(), title: "", seriesTitle: "", issue: "", type: "comic", author: "", publisher: "", imprint: "", character: "", year: new Date().getFullYear(), description: "", fileUrl: "", telegramUrl: "", featuredCoverUrl: "", format: "auto", clicks: 0, featured: false, tags: [], collectionIds: [] };
    const overlay = document.createElement("div"); overlay.className = "modal-backdrop";
    overlay.innerHTML = `
      <div class="modal"><div class="section-head"><div><h2>${id ? "Editar edição" : "Nova edição"}</h2><div class="section-subtitle">A capa será extraída da primeira página</div></div><button class="small-btn" data-close>Fechar</button></div>
        <form id="edit-form"><div class="form-grid">
          <div class="field"><label>Título da edição</label><input name="title" required value="${escapeHTML(x.title)}"></div>
          <div class="field full"><label>Série (deixe vazio para oneshot)</label><input name="seriesTitle" value="${escapeHTML(x.seriesTitle || "")}" placeholder="Ex.: Homem-Aranha, Universo Casulo"></div>
          <div class="field"><label>Número da edição / volume</label><input name="volume" type="number" min="1" step="1" inputmode="numeric" value="${escapeHTML(String(x.issue || "").match(/\d+/)?.[0] || "")}" placeholder="Ex.: 1"><label class="checkbox-inline"><input name="oneShot" type="checkbox" ${!x.seriesId && !x.issue ? "checked" : ""}> Volume único</label></div>
          <div class="field"><label>Tipo</label><select name="type"><option value="comic" ${x.type === "comic" ? "selected" : ""}>Quadrinho</option><option value="manga" ${x.type === "manga" ? "selected" : ""}>Mangá</option></select></div>
          <div class="field"><label>Ano</label><input name="year" type="number" value="${escapeHTML(x.year || "")}"></div><div class="field"><label>Editora</label><input name="publisher" value="${escapeHTML(x.publisher || "")}"></div><div class="field"><label>Selo</label><input name="imprint" value="${escapeHTML(x.imprint || "")}" placeholder="Ex.: Vertigo, Marvel, Turma da Mônica"></div><div class="field"><label>Personagem principal</label><input name="character" value="${escapeHTML(x.character || "")}"></div><div class="field"><label>Autor</label><input name="author" value="${escapeHTML(x.author || "")}"></div>
          <div class="field full"><label>Link direto do arquivo</label><input name="sourceUrl" required value="${escapeHTML(x.telegramUrl || x.fileUrl || "")}" placeholder="arquivo.pdf, arquivo.cbz, arquivo.cbr..."><small class="format-hint">Formato detectado: <b data-format-preview>${escapeHTML(x.format || "auto")}</b></small></div>
          <div class="field full"><label>Imagem exclusiva do destaque (opcional)</label><input name="featuredCoverUrl" type="url" value="${escapeHTML(x.featuredCoverUrl || "")}" placeholder="https://.../capa-do-destaque.jpg"><small class="format-hint">Use uma imagem horizontal ou uma capa em alta resolução para controlar melhor o destaque.</small></div>
          <div class="field full"><label>Descrição</label><textarea name="description">${escapeHTML(x.description || "")}</textarea></div><div class="field full"><label>Tags</label><input name="tags" value="${escapeHTML((x.tags || []).join(", "))}"></div><div class="field full"><label><input name="featured" type="checkbox" ${x.featured ? "checked" : ""}> Mostrar como destaque</label></div>
        </div><div class="modal-actions"><button type="button" class="small-btn" data-close>Cancelar</button><button class="btn btn-danger">Salvar edição</button></div></form>
      </div>`;
    $("#modal-root").appendChild(overlay); $$('[data-close]', overlay).forEach(button => button.onclick = () => overlay.remove());
    const source = $("[name=sourceUrl]", overlay), preview = $("[data-format-preview]", overlay), volume = $("[name=volume]", overlay), oneShot = $("[name=oneShot]", overlay);
    const syncOneShot = () => { volume.disabled = oneShot.checked; if (oneShot.checked) volume.value = ""; };
    oneShot.addEventListener("change", syncOneShot); syncOneShot();
    source.addEventListener("input", () => preview.textContent = detectFormat(source.value));
    $("#edit-form", overlay).onsubmit = event => { event.preventDefault(); const fd = new FormData(event.currentTarget); const sourceUrl = String(fd.get("sourceUrl") || "").trim(); const seriesTitle = fd.get("oneShot") === "on" ? "" : String(fd.get("seriesTitle") || "").trim(); const volumeNumber = fd.get("oneShot") === "on" ? "" : String(fd.get("volume") || "").replace(/\D/g, ""); const item = { ...x, title: String(fd.get("title") || "").trim(), seriesTitle, seriesId: seriesTitle ? seriesKey(seriesTitle) : "", issue: volumeNumber, type: fd.get("type"), year: Number(fd.get("year")) || new Date().getFullYear(), publisher: String(fd.get("publisher") || "").trim(), imprint: String(fd.get("imprint") || "").trim(), character: String(fd.get("character") || "").trim(), author: String(fd.get("author") || "").trim(), format: detectFormat(sourceUrl), fileUrl: sourceUrl, telegramUrl: "", featuredCoverUrl: String(fd.get("featuredCoverUrl") || "").trim(), description: String(fd.get("description") || "").trim(), tags: String(fd.get("tags") || "").split(",").map(s => s.trim()).filter(Boolean), featured: fd.get("featured") === "on" }; delete item.randomWeight; const index = state.db.library.findIndex(i => i.id === item.id); if (index >= 0) state.db.library[index] = item; else state.db.library.push(item); saveCatalog("Edição salva."); overlay.remove(); render(); };
  }

  function renderCatalog(type = null) {
    const items = type ? state.db.library.filter(x => x.type === type) : state.db.library;
    const series = uniqueCatalogItems(items.filter(x => x.seriesId));
    const oneshots = uniqueCatalogItems(items.filter(x => !x.seriesId));
    const heading = type === "manga" ? "Mangás" : type === "comic" ? "Quadrinhos" : "Catálogo";
    const group = (title, groupItems, isSeries = false) => groupItems.length ? `<section class="section"><div class="section-head"><div><h2 class="section-title">${title}</h2><div class="section-subtitle">${groupItems.length} obra(s)</div></div></div><div class="results-grid${type === "comic" && isSeries ? " catalog-series-grid" : ""}">${groupItems.map(item => isSeries ? seriesCard(item) : card(item)).join("")}</div></section>` : "";
    return `<div class="content"><div class="section-head"><div><h1 class="section-title">${heading}</h1><div class="section-subtitle">${items.length} edição(ões)</div></div></div>${group("Séries", series, true)}${group("Oneshots", oneshots)}${!items.length ? `<div class="empty">Nenhuma edição cadastrada.</div>` : ""}</div>`;
  }

  function openSubmission() {
    const overlay = document.createElement("div"); overlay.className = "modal-backdrop";
    overlay.innerHTML = `<div class="modal"><div class="section-head"><div><h2>Enviar uma edição</h2><div class="section-subtitle">Ajude a ampliar o catálogo da banca</div></div><button class="small-btn" data-close>Fechar</button></div><form id="submission-form"><div class="form-grid">
      <div class="field"><label>Seu nome</label><input name="author" required></div><div class="field"><label>Nome da série (opcional)</label><input name="seriesTitle" placeholder="Vazio = oneshot"></div><div class="field"><label>Título da edição</label><input name="title" required></div><div class="field"><label>Edição / volume</label><input name="issue"></div><div class="field"><label>Tipo</label><select name="type"><option value="comic">Quadrinho</option><option value="manga">Mangá</option></select></div><div class="field"><label>Ano</label><input name="year" type="number"></div><div class="field"><label>Editora</label><input name="publisher"></div><div class="field"><label>Selo</label><input name="imprint" placeholder="Ex.: Vertigo, Marvel, Turma da Mônica"></div><div class="field"><label>Personagem</label><input name="character"></div><div class="field full"><label>Link direto do arquivo</label><input name="sourceUrl" required placeholder="arquivo.pdf, arquivo.cbz ou arquivo.cbr"></div><div class="field full"><label>Mensagem</label><textarea name="message" placeholder="Observações sobre esta edição"></textarea></div>
    </div><div class="modal-actions"><button type="button" class="small-btn" data-close>Cancelar</button><button class="btn btn-danger">Enviar para análise</button></div></form></div>`;
    $("#modal-root").appendChild(overlay); $$('[data-close]', overlay).forEach(button => button.onclick = () => overlay.remove());
    $("#submission-form", overlay).onsubmit = event => { event.preventDefault(); const fd = new FormData(event.currentTarget); const seriesTitle = String(fd.get("seriesTitle") || "").trim(); state.db.submissions.push({ id: "sub-" + Date.now(), author: String(fd.get("author") || "").trim(), seriesTitle, seriesId: seriesTitle ? seriesKey(seriesTitle) : "", title: String(fd.get("title") || "").trim(), issue: String(fd.get("issue") || "").trim(), type: fd.get("type"), year: Number(fd.get("year")) || "", publisher: String(fd.get("publisher") || "").trim(), imprint: String(fd.get("imprint") || "").trim(), character: String(fd.get("character") || "").trim(), fileUrl: String(fd.get("sourceUrl") || "").trim(), format: detectFormat(fd.get("sourceUrl") || ""), message: String(fd.get("message") || ""), createdAt: new Date().toISOString() }); save(); overlay.remove(); toast("Envio registrado para análise."); };
  }

  function renderCatalog(type = null) {
    const items = type ? state.db.library.filter(x => x.type === type) : state.db.library;
    const series = uniqueCatalogItems(items.filter(x => x.seriesId));
    const oneshots = uniqueCatalogItems(items.filter(x => !x.seriesId));
    const heading = type === "manga" ? "Mangás" : type === "comic" ? "Quadrinhos" : "Catálogo";
    const group = (title, groupItems, isSeries = false) => groupItems.length ? `<section class="section"><div class="section-head"><div><h2 class="section-title">${title}</h2><div class="section-subtitle">${groupItems.length} obra(s)</div></div></div><div class="results-grid${type === "comic" && isSeries ? " catalog-series-grid" : ""}">${groupItems.map(item => isSeries ? seriesCard(item) : card(item)).join("")}</div></section>` : "";
    const publishers = new Map();
    items.filter(item => String(item.publisher || "").trim()).forEach(item => {
      const publisher = String(item.publisher).trim();
      if (!publishers.has(publisher)) publishers.set(publisher, []);
      publishers.get(publisher).push(item);
    });
    const publisherCarousel = type === "comic" && publishers.size ? `<section class="section publisher-carousel-section"><div class="section-head"><div><h2 class="section-title">Editoras</h2><div class="section-subtitle">Explore os quadrinhos por editora</div></div></div><div class="publisher-carousel">${[...publishers.entries()].sort((a, b) => a[0].localeCompare(b[0], "pt-BR")).map(([publisher, publisherItems]) => { const representative = publisherItems.find(item => item.featuredCoverUrl || item.coverUrl || item.cover) || publisherItems[0]; return `<button class="publisher-card" type="button" data-publisher="${escapeHTML(publisher)}"><div class="publisher-card-cover" style="background-image:url('${escapeHTML(coverFor(representative))}')"></div><div class="publisher-card-overlay"></div><div class="publisher-card-info"><strong>${escapeHTML(publisher)}</strong><span>${publisherItems.length} quadrinho(s)</span></div></button>`; }).join("")}</div></section>` : "";
    const catalogHeader = type === "comic" ? "" : `<div class="section-head"><div><h1 class="section-title">${heading}</h1><div class="section-subtitle">${items.length} edição(ões)</div></div></div>`;
    return `<div class="content">${catalogHeader}${group("Séries", series, true)}${group("Oneshots", oneshots)}${!items.length ? `<div class="empty">Nenhuma edição cadastrada.</div>` : ""}${publisherCarousel}</div>`;
  }

  function renderCatalog(type = null) {
    const items = type ? state.db.library.filter(x => x.type === type) : state.db.library;
    const series = uniqueCatalogItems(items.filter(x => x.seriesId));
    const oneshots = uniqueCatalogItems(items.filter(x => !x.seriesId));
    const group = (title, groupItems, isSeries = false) => groupItems.length ? `<section class="section"><div class="section-head"><div><h2 class="section-title">${title}</h2><div class="section-subtitle">${groupItems.length} obra(s)</div></div></div><div class="results-grid${type === "comic" && isSeries ? " catalog-series-grid" : ""}">${groupItems.map(item => isSeries ? seriesCard(item) : card(item)).join("")}</div></section>` : "";
    const publishers = new Map();
    items.filter(item => String(item.publisher || "").trim()).forEach(item => { const name = String(item.publisher).trim(); if (!publishers.has(name)) publishers.set(name, []); publishers.get(name).push(item); });
    const publisherEntries = [...publishers.entries()].sort((a, b) => a[0].localeCompare(b[0], "pt-BR"));
    const publisherCard = ([name, publisherItems]) => { const setting = state.publisherSettings.get(publisherKey(name)); const cover = setting?.cover_url || instantCover({ title: name }); return `<button class="publisher-card ${setting?.is_pinned ? "is-pinned" : ""}" type="button" data-publisher="${escapeHTML(name)}"><div class="publisher-card-cover" style="background-image:url('${escapeHTML(cover)}')"></div><div class="publisher-card-overlay"></div><div class="publisher-card-info"><strong>${escapeHTML(name)}</strong><span>${publisherItems.length} quadrinho(s)</span></div></button>`; };
    const pinned = publisherEntries.filter(([name]) => state.publisherSettings.get(publisherKey(name))?.is_pinned);
    const publisherPinnedCarousel = type === "comic" && pinned.length ? `<section class="section publisher-pinned-section"><div class="section-head"><div><h2 class="section-title">Editoras fixadas</h2><div class="section-subtitle">Acesso rápido às editoras em destaque</div></div></div><div class="publisher-carousel">${pinned.map(publisherCard).join("")}</div></section>` : "";
    const publisherCarousel = type === "comic" && publisherEntries.length ? `<section class="section publisher-all-section"><div class="section-head"><div><h2 class="section-title">Editoras</h2><div class="section-subtitle">Explore todos os quadrinhos por editora</div></div></div><div class="publisher-carousel">${publisherEntries.map(publisherCard).join("")}</div></section>` : "";
    const popularCollections = state.popularPublicCollections || [];
    const popularCollectionsMarkup = type === "comic" && popularCollections.length ? `<section class="section popular-collections-section"><div class="section-head"><div><h2 class="section-title">Coleções públicas mais curtidas</h2><div class="section-subtitle">Descubra listas públicas da comunidade</div></div></div><div class="feature-grid">${popularCollections.map(collection => `<div class="feature-card" data-public-collection="${escapeHTML(collection.id)}" data-public-owner="${escapeHTML(collection.username)}"><div class="cover" style="background-image:url('${escapeHTML(collection.cover_url || "")}')"></div><div class="gradient"></div><div class="feature-info"><h3>${escapeHTML(collection.name)}</h3><p>${collection.likes} curtida(s) · @${escapeHTML(collection.username)}</p></div></div>`).join("")}</div></section>` : "";
    const heading = type === "manga" ? "Mangás" : type === "comic" ? "Quadrinhos" : "Catálogo";
    const catalogHeader = type === "comic" ? "" : `<div class="section-head"><div><h1 class="section-title">${heading}</h1><div class="section-subtitle">${items.length} edição(ões)</div></div></div>`;
    return `<div class="content">${catalogHeader}${publisherPinnedCarousel}${group("Séries", series, true)}${group("Oneshots", oneshots)}${!items.length ? `<div class="empty">Nenhuma edição cadastrada.</div>` : ""}${publisherCarousel}${popularCollectionsMarkup}</div>`;
  }

  function seriesDefinitionFor(item) {
    const definition = (window.DEFAULT_SERIES || []).find(series => series.id === item?.seriesId);
    return { ...(definition || {}), ...item, title: definition?.name || item?.seriesTitle || item?.title || "Série", seriesTitle: definition?.name || item?.seriesTitle || item?.title || "Série", coverUrl: definition?.coverUrl || item?.coverUrl || item?.cover || "" };
  }

  function seriesCard(item, favoriteIds = state.favoriteIds) {
    const series = seriesDefinitionFor(item);
    const editions = seriesEditions(item);
    const count = editions.length || series.editions || "—";
    const entityButton = (kind, value) => value ? `<button type="button" class="series-entity-link" data-entity-kind="${escapeHTML(kind)}" data-entity-value="${escapeHTML(value)}">${escapeHTML(value)}</button>` : "";
    const seriesCoverStyle = coverStyleFor({ id: item.seriesId });
    const saved = favoriteIds.has(item.seriesId);
    const canSetSeriesCover = Boolean(state.session) && favoriteIds === state.favoriteIds;
    const seriesCoverEffects = coverStyleControl(item.seriesId, seriesCoverStyle, canSetSeriesCover);
    const seriesCoverChoiceButton = canSetSeriesCover ? `<button type="button" class="series-cover-choice" data-series-cover-choice="${escapeHTML(item.seriesId)}" title="Capa da série">Capa</button>` : "";
    const seriesName = series.name || series.seriesTitle;
    const startYearValue = series.year ? String(series.year) : "";
    const startYear = startYearValue ? `<button type="button" class="series-card-year series-entity-link" data-entity-kind="year" data-entity-value="${escapeHTML(startYearValue)}">(${escapeHTML(startYearValue)})</button>` : "";
    const description = String(series.description || "");
    const descriptionTitle = description ? ` title="${escapeHTML(description)}"` : "";
    const mainCover = seriesCoverFor(item);
    const stackCovers = [editions[1], editions[2]].map(edition => edition ? seriesCoverFor(edition) : mainCover);
    const stackMarkup = stackCovers.map((cover, index) => `<div class="series-card-stack-cover series-card-stack-cover-${index + 1}" style="background-image:url('${escapeHTML(cover)}')"></div>`).join("");
    return `<article class="series-card" data-open-series="${escapeHTML(item.seriesId)}" tabindex="0"><div class="series-card-cover" data-series-cover-id="${escapeHTML(item.seriesId)}" data-cover-style-item="${escapeHTML(item.seriesId)}" data-cover-style="${escapeHTML(seriesCoverStyle)}" style="background-image:url('${escapeHTML(seriesCoverFor(item))}')"></div><div class="series-card-body"><div class="eyebrow">Série</div><h3>${escapeHTML(seriesName)} ${startYear}</h3><p class="series-card-description"${descriptionTitle}>${escapeHTML(description)}</p><div class="series-card-meta">${entityButton("publisher", series.publisher)}${entityButton("publication", series.publication)}${entityButton("status", series.status)}</div><div class="series-card-footer"><span class="series-card-count">${escapeHTML(String(count))} edições</span><div class="series-card-footer-actions">${seriesCoverChoiceButton}${seriesCoverEffects}<button type="button" class="series-save-button ${saved ? "is-saved" : ""}" data-series-favorite="${escapeHTML(item.seriesId)}">${saved ? "★ Salva" : "☆ Salvar"}</button></div></div></div></article>`;
  }

  window.addEventListener("popstate", applyRoute);
  window.BancaDigital = { state, openReader, openAdmin };
  const appRoot = document.getElementById("app");
  const modalRoot = document.getElementById("modal-root");
  if (modalRoot && "MutationObserver" in window) {
    new MutationObserver(records => records.forEach(record => [...record.addedNodes].forEach(node => {
      if (node.nodeType === Node.ELEMENT_NODE) prepareLazyImages(node);
    }))).observe(modalRoot, { childList: true, subtree: true });
  }
  const pathParts = window.location.pathname.split("/").filter(Boolean);
  const routeParts = pathParts[0]?.toLowerCase() === "banca-digital-quadrinhos-v3" ? pathParts.slice(1) : pathParts;
  const queryProfile = new URLSearchParams(window.location.search).get("perfil");
  const queryPublicCollection = new URLSearchParams(window.location.search).get("lista");
  const initialPublicUsername = queryProfile
    ? cleanUsername(queryProfile)
    : routeParts.length === 1 && routeParts[0].toLowerCase() !== "index.html"
      ? cleanUsername(decodeURIComponent(routeParts[0]))
      : "";
  if (initialPublicUsername && /^[a-z0-9_]{3,24}$/.test(initialPublicUsername)) {
    state.section = "public-profile";
    state.publicProfile = { loading: true, username: initialPublicUsername, collectionId: queryPublicCollection };
  }
  const bootOfflineAccount = readOfflineAccount();
  if (!initialPublicUsername && navigator.onLine === false && bootOfflineAccount?.user) {
    state.session = { user: bootOfflineAccount.user, offline: true };
    state.profile = offlineProfileFor(bootOfflineAccount.user, bootOfflineAccount.profile, bootOfflineAccount.username);
    loadDownloads();
    state.section = "downloads";
    render();
  } else if (initialPublicUsername) render();
  else applyRoute();
  syncTopAvatar();
  const warmLibarchive = () => loadLibarchiveModule().catch(error => console.warn("Biblioteca CBR indisponível:", error));
  // A biblioteca é pequena perto dos arquivos CBR e precisa estar pronta
  // antes do primeiro clique para não competir com o download.
  warmLibarchive();
  loadComicReadCounts()
    .then(() => { if (state.section !== "reader") render(); })
    .catch(error => console.warn("Contadores de leitura indisponÃ­veis:", error));
  loadComicDownloadCounts()
    .then(() => { if (state.section !== "reader") render(); })
    .catch(error => console.warn("Contadores de download indisponíveis:", error));
  loadComicMonthlyReadCounts()
    .then(() => { if (state.section !== "reader") render(); })
    .catch(error => console.warn("Leituras mensais indisponíveis:", error));
  loadHomepageSettings()
    .then(() => { if (state.section === "home") render(); })
    .catch(error => console.warn("Ordem da página inicial indisponível:", error));
  sb?.auth.onAuthStateChange((event, session) => {
    if (event === "PASSWORD_RECOVERY") {
      state.session = session;
      state.section = "password-reset";
      render();
    }
  });
  let reconnecting = false;
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
      }
    } catch (error) {
      console.warn("Não foi possível retomar a sessão online:", error);
    } finally {
      reconnecting = false;
    }
  });
  window.addEventListener("offline", () => {
    if (state.session) navigate({ pagina: "downloads" }, true);
  });
  loadAccount()
    .then(async () => {
      if (state.section === "reader" && !activeReaderCleanup) applyRoute();
      if (initialPublicUsername) await loadPublicProfile(initialPublicUsername, queryPublicCollection);
      pumpDownloadQueue();
    })
    .catch(error => console.warn("Supabase indisponível:", error))
    .finally(() => {
      if (appRoot) appRoot.style.visibility = "";
    });
})();
