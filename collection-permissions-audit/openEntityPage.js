  function openEntityPage(kind, value) {
    if (kind === "character") value = canonicalCharacterName(value);
    state.entityFilter = { kind, value };
    state.collectionFilter = { field: "all", query: "" };
    navigate({ pagina: "entidade", tipo: kind, valor: value });
  }

