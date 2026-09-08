  function currentFactionId(profile = state.profile) {
    if (profile?.faction_id) return profile.faction_id;
    if (!["free", "premium"].includes(normalizedPlan(profile))) return null;
    const userId = profile?.id || state.session?.user?.id;
    if (!userId) return null;
    return (state.factionMembers || []).find(member => String(member.user_id) === String(userId))?.faction_id || null;
  }

