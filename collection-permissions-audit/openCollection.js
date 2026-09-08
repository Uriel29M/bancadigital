  function openCollection(id) {
    if (state.db.collections.some(collection => collection.id === id)) navigate({ pagina: "colecoes", colecao: id });
  }

