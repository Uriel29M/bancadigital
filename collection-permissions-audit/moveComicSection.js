  function moveComicSection(key, direction) {
    if (!canManageHomepageOrder()) return;
    const order = normalizeComicSectionOrder(state.comicSectionOrder);
    const visibleIndex = state.comicVisibleSectionKeys.indexOf(key);
    const targetKey = state.comicVisibleSectionKeys[visibleIndex + direction];
    if (visibleIndex < 0 || !targetKey) return;
    const index = order.indexOf(key);
    const target = order.indexOf(targetKey);
    if (index < 0 || target < 0) return;
    [order[index], order[target]] = [order[target], order[index]];
    state.comicSectionOrder = order;
    localStorage.setItem("bancaDigitalComicSectionOrder", JSON.stringify(order));
    render();
  }

