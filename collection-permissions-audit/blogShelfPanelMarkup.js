  function blogShelfPanelMarkup(publicState = null) {
    const authored = publicState ? publicState.authoredBlogPosts || [] : state.authoredBlogPosts;
    const saved = publicState ? [...(publicState.savedBlogPosts || []), ...(publicState.collectionBlogPosts || [])] : state.savedBlogPosts;
    const collections = (publicState ? publicState.blogCollections || [] : state.blogShelfCategories).filter(collection => !publicState || collection.isPublic !== false);
    const posts = [...new Map([...authored, ...saved].map(post => [String(post.id), post])).values()];
    const canEdit = !publicState;
    return `<div class="blog-shelf-panel"><div class="section-head"><div><h2 class="section-title">Blogs</h2><div class="section-subtitle">Blogs escritos e salvos por esta pessoa.</div></div>${canEdit ? '<button class="small-btn" data-blog-shelf-new>+ Nova coleção</button>' : ""}</div><section class="section shelf-collection"><div class="section-head"><div><h2 class="section-title">Escritos</h2><div class="section-subtitle">${authored.length} blog(s)</div></div></div><div class="blog-shelf-grid">${authored.map(post => blogCard(post)).join("") || '<div class="empty">Nenhum blog escrito ainda.</div>'}</div></section><section class="section shelf-collection"><div class="section-head"><div><h2 class="section-title">Salvos</h2><div class="section-subtitle">${saved.length} blog(s)</div></div></div><div class="blog-shelf-grid">${saved.map(post => blogCard(post)).join("") || '<div class="empty">Nenhum blog salvo ainda.</div>'}</div></section>${collections.map(collection => blogShelfCollectionMarkup(collection, posts, canEdit)).join("")}</div>`;
  }

