  function publicCollectionItems(category, publicState) {
    // A coleção pública deve exibir as edições que foram gravadas nela,
    // mesmo que o proprietário deixe de favoritar alguma delas depois.
    return shelfItemsByIds(category.itemIds || []);
  }

