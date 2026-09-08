  function canManageHomepageOrder(profile = state.profile) {
    return ["banca", "admin"].includes(normalizedPlan(profile));
  }
