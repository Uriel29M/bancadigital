  function normalizedPlan(profile = state.profile) {
    return String(profile?.plan || "").trim().toLowerCase();
  }
