  function normalizePersonalCollectionOrder(value, categories = []) {
    const ids = categories.map(category => String(category.id));
    const saved = Array.isArray(value) ? value.map(String).filter(id => ids.includes(id)) : [];
    const unique = [...new Set(saved)];
    return [...unique, ...ids.filter(id => !unique.includes(id))];
  }

