  function coverStyleControl(itemId, currentStyle, canUse = true, collectionId = "") {
    if (!canUse) return "";
    const premium = ["premium", "moderator", "banca", "admin"].includes(state.profile?.plan);
    const nextLabel = currentStyle === "normal" ? "Aplicar preto e branco" : currentStyle === "grayscale" && premium ? "Aplicar capa dourada" : "Voltar à capa normal";
    return `<span class="cover-effect-controls" aria-label="Efeito da capa"><button type="button" class="cover-effect-dot cover-effect-${escapeHTML(currentStyle)} ${currentStyle !== "normal" ? "is-active" : ""}" data-cover-effect-item="${escapeHTML(itemId)}" ${collectionId ? `data-cover-effect-collection="${escapeHTML(collectionId)}"` : ""} title="${nextLabel}${collectionId ? " (somente nesta coleção)" : ""}" aria-label="${nextLabel}${collectionId ? " (somente nesta coleção)" : ""}"></button></span>`;
  }

