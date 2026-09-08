  function shelfCollectionOrderForProfile(profile = {}) {
    if (Array.isArray(profile?.shelf_collection_order)) return profile.shelf_collection_order;
    try { return JSON.parse(localStorage.getItem(`bancaDigitalShelfCollectionOrder:${profile?.id || ""}`) || "null"); } catch { return null; }
  }

