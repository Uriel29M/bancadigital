  function publicProfileHref(username, collectionId = "", album = false) {
    const url = new URL(window.location.href);
    url.search = "";
    url.hash = "";
    url.searchParams.set("perfil", cleanUsername(username));
    if (collectionId) url.searchParams.set("lista", collectionId);
    if (album) url.searchParams.set("album", "1");
    return `${url.pathname}?${url.searchParams.toString()}`;
  }

