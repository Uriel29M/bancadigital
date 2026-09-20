(() => {
  const SUPABASE_URL = window.BANCA_SUPABASE_URL || "";
  const SUPABASE_KEY = window.BANCA_SUPABASE_KEY || "";
  if (!SUPABASE_URL || !SUPABASE_KEY) return;

  const normalizeKey = value => String(value || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

  const setField = (form, names, value) => {
    if (value === undefined || value === null) return false;
    const list = Array.isArray(names) ? names : [names];
    for (const name of list) {
      const field = form.querySelector('[name="' + CSS.escape(name) + '"]');
      if (!field) continue;
      if (field.type === "checkbox") field.checked = Boolean(value);
      else field.value = Array.isArray(value) ? value.join(", ") : String(value);
      field.dispatchEvent(new Event("input", { bubbles: true }));
      field.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    }
    return false;
  };

  const setAssigned = (form, keys) => {
    const wanted = new Set((Array.isArray(keys) ? keys : []).map(normalizeKey));
    let changed = false;
    form.querySelectorAll('input[type="checkbox"]').forEach(input => {
      const key = input.dataset.characterKey || input.value || input.dataset.key || "";
      if (!key) return;
      if (wanted.has(normalizeKey(key))) {
        input.checked = true;
        changed = true;
      }
    });
    return changed;
  };

  const getAccessToken = async () => {
    try {
      const client = window.supabase?.createClient?.(SUPABASE_URL, SUPABASE_KEY);
      const session = await client?.auth?.getSession?.();
      return session?.data?.session?.access_token || SUPABASE_KEY;
    } catch {
      return SUPABASE_KEY;
    }
  };

  const fetchRow = async (table, key, select) => {
    const url = SUPABASE_URL + "/rest/v1/" + table +
      "?select=" + encodeURIComponent(select) +
      "&" + encodeURIComponent(table === "publisher_settings" ? "publisher_key" : table === "imprint_settings" ? "imprint_key" : "character_key") +
      "=eq." + encodeURIComponent(key) + "&limit=1";
    try {
      const response = await fetch(url, {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: "Bearer " + (await getAccessToken())
        },
        cache: "no-store"
      });
      if (!response.ok) return null;
      const rows = await response.json();
      return rows[0] || null;
    } catch {
      return null;
    }
  };

  const hydrate = async form => {
    if (form.dataset.entityHydrated === "1") return;
    let table = "";
    let key = "";
    let select = "";

    if (form.id === "publisher-settings-form") {
      table = "publisher_settings";
      key = normalizeKey(form.querySelector(".section-subtitle")?.textContent);
      select = "publisher_key,publisher_name,cover_url,is_pinned";
    } else if (form.id === "imprint-settings-form") {
      table = "imprint_settings";
      key = normalizeKey(form.querySelector(".section-subtitle")?.textContent);
      select = "imprint_key,imprint_name,cover_url,wikipedia_url,is_pinned";
    } else if (form.id === "character-settings-form") {
      table = "character_settings";
      key = normalizeKey(form.querySelector(".section-subtitle")?.textContent);
      select = "character_key,character_name,character_type,character_alignment,redirect_character_key,assigned_character_keys,cover_url,wikipedia_url,authored_text,is_pinned,is_hidden,deviantart_fanarts_enabled,deviantart_gallery_url,deviantart_fanart_image_urls";
    } else {
      return;
    }

    const row = await fetchRow(table, key, select);
    if (!row) return;

    form.dataset.entityHydrated = "1";
    setField(form, ["coverUrl"], row.cover_url);
    setField(form, ["wikipediaUrl"], row.wikipedia_url);
    setField(form, ["authoredText"], row.authored_text);
    setField(form, ["isPinned"], row.is_pinned);
    setField(form, ["isHidden"], row.is_hidden);
    setField(form, ["characterType"], row.character_type);
    setField(form, ["characterAlignment"], row.character_alignment);
    setField(form, ["redirectCharacterKey"], row.redirect_character_key);
    setField(form, ["deviantartFanartsEnabled"], row.deviantart_fanarts_enabled);
    setField(form, ["deviantartGalleryUrl"], row.deviantart_gallery_url);
    setField(form, ["deviantartFanartImageUrls"], row.deviantart_fanart_image_urls);
    setAssigned(form, row.assigned_character_keys);
  };

  const observer = new MutationObserver(mutations => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (!(node instanceof Element)) continue;
        const forms = [];
        if (node.matches?.("#publisher-settings-form,#imprint-settings-form,#character-settings-form")) forms.push(node);
        forms.push(...node.querySelectorAll?.("#publisher-settings-form,#imprint-settings-form,#character-settings-form") || []);
        forms.forEach(form => void hydrate(form));
      }
    }
  });

  const root = document.getElementById("modal-root");
  if (root) observer.observe(root, { childList: true, subtree: true });
})();