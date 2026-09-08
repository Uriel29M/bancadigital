  async function moveHomepageSection(key, direction) {
    if (!sb || !canManageHomepageOrder()) return;
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

