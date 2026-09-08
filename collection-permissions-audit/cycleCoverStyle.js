  function cycleCoverStyle(itemId, collectionId = "") {
    if (collectionId) return setCollectionCoverStyle(collectionId, itemId);
    const currentStyle = coverStyleFor({ id: itemId });
    const premium = ["premium", "moderator", "banca", "admin"].includes(state.profile?.plan);
    const nextStyle = currentStyle === "normal" ? "grayscale" : currentStyle === "grayscale" && premium ? "gold" : "normal";
    return setCoverStyle(itemId, nextStyle);
  }

