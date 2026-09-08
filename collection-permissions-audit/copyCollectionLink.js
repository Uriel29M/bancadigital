  async function copyCollectionLink(categoryId, username = state.profile?.username) {
    if (!username || !categoryId) return;
    const link = new URL(publicProfileHref(username, categoryId), window.location.href).href;
    try {
      await navigator.clipboard.writeText(link);
      toast("Link da coleção copiado.");
    } catch {
      await openSitePrompt("Copie o link da coleção:", link, { title: "Compartilhar coleção", label: "Link" });
    }
  }

