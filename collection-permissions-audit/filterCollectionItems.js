  function filterCollectionItems(items, field, query) {
    const normalized = String(query || "").trim().toLowerCase();
    if (!normalized) return items;
    return items.filter(item => {
      const values = field === "tag" ? (item.tags || []) : field === "character" ? characterNames(item) : field === "all" ? [item.title, item.seriesTitle, item.author, item.publisher, ...characterNames(item), ...(item.tags || [])] : [item[field]];
      return values.some(value => String(value || "").toLowerCase().includes(normalized));
    });
  }

