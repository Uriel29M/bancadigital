  function toggleComicSectionVisibility(key, hidden) {
    if (!canManageHomepageOrder() || !COMIC_SECTION_ORDER.includes(key)) return;
    const nextHidden = new Set(state.comicHiddenSectionKeys);
    if (hidden) nextHidden.add(key);
    else nextHidden.delete(key);
    state.comicHiddenSectionKeys = nextHidden;
    localStorage.setItem("bancaDigitalComicHiddenSections", JSON.stringify([...nextHidden]));
    render();
  }

