  function movePersonalCollection(id, direction) {
    if (!isOwnShelfProfile()) return;
    const profile = state.section === "public-profile" ? state.publicProfile?.profile : state.profile;
    const categories = state.section === "public-profile" ? (state.publicProfile?.collections || []) : (state.shelfCategories || []);
    const order = normalizePersonalCollectionOrder(shelfCollectionOrderForProfile(profile), categories);
    const index = order.indexOf(String(id));
    const target = index + direction;
    if (index < 0 || target < 0 || target >= order.length) return;
    [order[index], order[target]] = [order[target], order[index]];
    state.profile = { ...state.profile, shelf_collection_order: order };
    if (state.section === "public-profile") state.publicProfile.profile = { ...profile, shelf_collection_order: order };
    try { localStorage.setItem(`bancaDigitalShelfCollectionOrder:${state.session.user.id}`, JSON.stringify(order)); } catch {}
    render();
    sb?.from("profiles").update({ shelf_collection_order: order }).eq("id", state.session.user.id).then(result => {
      if (result?.error) toast("A ordem foi aplicada nesta sessão, mas não pôde ser salva.");
    });
  }

