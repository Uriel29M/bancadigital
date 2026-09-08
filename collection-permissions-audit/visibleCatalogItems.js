  function visibleCatalogItems(items = state.db.library, includeHidden = isAdminProfile()) {
    return items.filter(item => canViewCatalogItem(item, includeHidden));
  }
