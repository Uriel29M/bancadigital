  function canViewHiddenHomepageSections(profile = state.profile) {
    return isStaffProfile(profile);
  }
