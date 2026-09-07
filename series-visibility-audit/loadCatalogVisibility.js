  async function loadCatalogVisibility() {
    state.hiddenCatalogItemIds = new Set();
    if (!sb || navigator.onLine === false) return;
    const result = await sb.from("catalog_item_visibility").select("item_id, is_hidden");
    if (result.error) {
      console.warn("Não foi possível carregar a visibilidade das edições:", result.error.message);
      return;
    }
    state.hiddenCatalogItemIds = new Set((result.data || []).filter(row => row.is_hidden).map(row => String(row.item_id)));
  }
