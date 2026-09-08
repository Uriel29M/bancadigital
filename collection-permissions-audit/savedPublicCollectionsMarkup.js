  function savedPublicCollectionsMarkup(collections = []) {
    return '<section class="section saved-publishers saved-public-collections"><div class="section-head"><div><h2 class="section-title">Coleções salvas</h2><div class="section-subtitle">Coleções públicas salvas por este perfil.</div></div></div><div class="public-collections-grid saved-publishers-list">' + (collections.map(collection => publicCollectionCard(collection)).join("") || '<div class="empty">Nenhuma coleção pública salva.</div>') + '</div></section>';
  }

