  function canAccessStickerAlbum(profile = state.profile) {
    return Boolean(profile) && normalizedPlan(profile) !== "banca";
  }
