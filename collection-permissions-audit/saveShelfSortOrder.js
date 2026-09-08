  async function saveShelfSortOrder(key, order) {
    if (!state.session || !SHELF_SORT_OPTIONS.some(([value]) => value === order)) return;
    const storageKey = key.replace(/^public-/, "");
    state.collectionSortOrders = { ...(state.collectionSortOrders || {}), [storageKey]: order };
    const result = await sb?.from("profiles").update({ shelf_sort_orders: state.collectionSortOrders }).eq("id", state.session.user.id);
    if (storageKey.startsWith("category:")) {
      const collectionId = storageKey.slice("category:".length);
      const category = state.shelfCategories.find(item => item.id === collectionId);
      if (category) category.sortOrder = order;
      await sb?.from("shelf_collections").update({ sort_order: order }).eq("id", collectionId).eq("owner_id", state.session.user.id);
    }
    if (result?.error) {
      try { localStorage.setItem(`bancaDigitalShelfSort:${state.session.user.id}`, JSON.stringify(state.collectionSortOrders)); } catch {}
    }
    render();
  }

