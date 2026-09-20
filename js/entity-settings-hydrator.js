(() => {
  const SUPABASE_URL = window.BANCA_SUPABASE_URL || "";
  const SUPABASE_KEY = window.BANCA_SUPABASE_KEY || "";
  if (!SUPABASE_URL || !SUPABASE_KEY) return;

  const normalize = value => String(value || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

  const getAccessToken = async () => {
    try {
      const client = window.supabase?.createClient?.(SUPABASE_URL, SUPABASE_KEY);
      const session = await client?.auth?.getSession?.();
      return session?.data?.session?.access_token || SUPABASE_KEY;
    } catch {
      return SUPABASE_KEY;
    }
  };

  const request = async (table, select = "*") => {
    try {
      const response = await fetch(SUPABASE_URL + "/rest/v1/" + table + "?select=" + encodeURIComponent(select), {
        headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + (await getAccessToken()) },
        cache: "no-store"
      });
      if (!response.ok) return [];
      const rows = await response.json();
      return Array.isArray(rows) ? rows : [];
    } catch {
      return [];
    }
  };

  const setValue = (field, value) => {
    if (!field || value === undefined || value === null || field.type === "file") return false;
    field.type === "checkbox" ? field.checked = Boolean(value) : field.value = Array.isArray(value) ? value.join(", ") : String(value);
    return true;
  };

  const findField = (form, names, patterns = []) => {
    for (const name of names) {
      const field = form.querySelector('[name="' + CSS.escape(name) + '"]');
      if (field) return field;
    }
    const wanted = patterns.map(normalize);
    for (const label of form.querySelectorAll("label")) {
      const text = normalize(label.textContent);
      if (!wanted.some(pattern => text.includes(pattern))) continue;
      const id = label.getAttribute("for");
      if (id) {
        const field = document.getElementById(id);
        if (field) return field;
      }
      const field = label.querySelector("input,textarea,select");
      if (field) return field;
    }
    return null;
  };

  const fill = (form, names, value, patterns = []) => setValue(findField(form, names, patterns), value);

  const findAssigned = (form, keys) => {
    const wanted = new Set((Array.isArray(keys) ? keys : []).map(normalize));
    form.querySelectorAll('input[type="checkbox"]').forEach(input => {
      const key = input.dataset.characterKey || input.dataset.key || input.value || "";
      if (wanted.has(normalize(key))) input.checked = true;
    });
  };

  const getEntityContext = form => {
    const scope = form.closest(".modal-overlay,.modal,[role='dialog']") || form.parentElement || form;
    const nodes = [...form.querySelectorAll("[data-entity-name],[data-entity-key],.section-subtitle,.modal-title,h1,h2,h3"),
      ...(scope === form ? [] : scope.querySelectorAll("[data-entity-name],[data-entity-key],.section-subtitle,.modal-title,h1,h2,h3"))];
    for (const node of nodes) {
      const raw = String(node.dataset?.entityName || node.dataset?.entityKey || node.textContent || "").trim();
      if (!raw) continue;
      const tail = raw.replace(/^(configurar|editar)\s+(editora|selo|personagem)?\s*/i, "").trim();
      if (tail && !/^(configurar|editar|editora|selo|personagem)$/i.test(tail)) return tail;
    }
    return "";
  };

  const detectType = form => {
    const text = normalize(form.textContent);
    if (form.id === "character-settings-form" || text.includes("personagens atribuidos") || text.includes("tipo de entidade") || text.includes("deviantart")) return "character";
    if (form.id === "publisher-settings-form" || text.includes("configurar editora")) return "publisher";
    if (form.id === "imprint-settings-form" || text.includes("configurar selo")) return "imprint";
    const names = [...form.querySelectorAll("input,textarea,select")].map(x => normalize(x.name));
    if (names.some(x => x.includes("deviantart") || x.includes("character"))) return "character";
    if (names.some(x => x.includes("publisher"))) return "publisher";
    if (names.some(x => x.includes("imprint"))) return "imprint";
    return null;
  };

  const hydrate = async form => {
    if (!(form instanceof HTMLFormElement) || form.dataset.entityHydrated === "1") return;
    const type = detectType(form);
    if (!type) return;

    const table = type === "character" ? "character_settings" : type === "publisher" ? "publisher_settings" : "imprint_settings";
    const rows = await request(table);
    if (!rows.length) return;

    const context = normalize(getEntityContext(form));
    const keyField = type === "character" ? "character_key" : type === "publisher" ? "publisher_key" : "imprint_key";
    const nameField = type === "character" ? "character_name" : type === "publisher" ? "publisher_name" : "imprint_name";
    const row = rows.find(item => normalize(item[keyField]) === context || normalize(item[nameField]) === context);
    if (!row) return;

    form.dataset.entityHydrated = "1";
    fill(form, ["coverUrl", "imageUrl", "cardImageUrl"], row.cover_url, ["url de imagem", "imagem do card"]);
    fill(form, ["wikipediaUrl", "wikiUrl"], row.wikipedia_url, ["wikipedia/fandom", "wikipedia", "fandom"]);
    fill(form, ["authoredText", "wikiText"], row.authored_text, ["texto autoral da wiki rápida"]);
    fill(form, ["isPinned"], row.is_pinned, ["fixar"]);
    fill(form, ["isHidden"], row.is_hidden, ["ocultar"]);
    fill(form, ["characterType"], row.character_type, ["tipo de entidade"]);
    fill(form, ["characterAlignment"], row.character_alignment, ["categoria"]);
    fill(form, ["redirectCharacterKey"], row.redirect_character_key, ["redirecionar para"]);
    fill(form, ["deviantartFanartsEnabled"], row.deviantart_fanarts_enabled, ["deviantart fanarts"]);
    fill(form, ["deviantartGalleryUrl"], row.deviantart_gallery_url, ["galeria deviantart"]);
    fill(form, ["deviantartFanartImageUrls"], row.deviantart_fanart_image_urls, ["fanarts"]);
    if (type === "character") findAssigned(form, row.assigned_character_keys);
  };

  const scan = root => {
    if (!(root instanceof Element)) return;
    const forms = [];
    if (root.matches("form")) forms.push(root);
    forms.push(...root.querySelectorAll("form"));
    forms.forEach(form => void hydrate(form));
  };

  const root = document.getElementById("modal-root");
  if (!root) return;
  new MutationObserver(mutations => mutations.forEach(mutation => mutation.addedNodes.forEach(scan)))
    .observe(root, { childList: true, subtree: true });
  scan(root);
})();