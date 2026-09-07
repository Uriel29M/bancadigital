  function canViewCatalogItem(item, includeHidden = false) {
    const hiddenCharacter = characterNames(item).some(name => state.characterSettings.get(publisherKey(name))?.is_hidden);
    return (!isHiddenCatalogItem(item) && !hiddenCharacter) || (includeHidden && isAdminProfile());
  }
