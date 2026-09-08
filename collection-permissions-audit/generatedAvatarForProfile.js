  function generatedAvatarForProfile(profile = {}) {
    const profileId = profile?.id || profile?.user_id;
    return hasLegendaryAccess(profile) ? (profile?.avatar_url || randomAvatarUrl(profileId)) : randomAvatarUrl(profileId, "#ffffff", factionColorForProfile(profile));
  }
