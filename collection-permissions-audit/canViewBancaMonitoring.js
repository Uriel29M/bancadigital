  function canViewBancaMonitoring(profile = state.profile) {
    return ["banca", "admin"].includes(normalizedPlan(profile));
  }
