  function isAdminProfile(profile = state.profile) {
    return normalizedPlan(profile) === "admin";
  }
