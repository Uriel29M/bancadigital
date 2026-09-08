  function shelfStyleOptionsFor(profile = state.profile) {
    const legendary = hasLegendaryAccess(profile);
    return SHELF_STYLE_OPTIONS.filter(([, , , isLegendary]) => !isLegendary || legendary);
  }
