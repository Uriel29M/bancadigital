  function visibleCatalogItems(items = state.db.library, includeHidden = false) {
    return items.filter(item => canViewCatalogItem(item, includeHidden));
  }
