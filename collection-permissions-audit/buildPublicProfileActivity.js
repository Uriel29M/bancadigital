  async function buildPublicProfileActivity(profile, rows, collections) {
    const [comicLikes, blogLikes, collectionLikes, follows, comments, blogComments, wallComments, favorites, blogSaves, collectionSaves, publisherSaves, reads] = rows;
    const blogIds = [...new Set([...blogLikes, ...blogComments, ...blogSaves].map(row => row.blog_id).filter(Boolean))];
    const followIds = [...new Set(follows.map(row => row.following_id).filter(Boolean))];
    const wallProfileIds = [...new Set(wallComments.map(row => row.profile_id).filter(Boolean))];
    const savedOwnerIds = [...new Set(collectionSaves.map(row => row.owner_id).filter(Boolean))];
    const [blogsResult, followsResult, wallProfilesResult, savedOwnersResult] = await Promise.all([
      blogIds.length ? sb.from("blog_posts").select("id, title, status").in("id", blogIds) : { data: [] },
      followIds.length ? sb.from("profiles").select("id, username").in("id", followIds) : { data: [] },
      wallProfileIds.length ? sb.from("profiles").select("id, username").in("id", wallProfileIds) : { data: [] },
      savedOwnerIds.length ? sb.from("profiles").select("id, username").in("id", savedOwnerIds) : { data: [] }
    ]);
    const blogNames = new Map((blogsResult.data || []).map(blog => [String(blog.id), blog.title || "blog"]));
    const profileNames = new Map([...(followsResult.data || []), ...(wallProfilesResult.data || []), ...(savedOwnersResult.data || [])].map(row => [row.id, row.username]));
    const collectionNames = new Map(collections.map(collection => [String(collection.id), { name: collection.name, owner_id: collection.owner_id }]));
    const itemName = itemId => state.db.library.find(item => item.id === itemId)?.title || itemId;
    const itemHref = itemId => routeUrl({ ler: itemId });
    const blogHref = blogId => routeUrl({ pagina: "blogs", blog: blogId });
    const publisherHref = publisherName => routeUrl({ pagina: "entidade", tipo: "publisher", valor: publisherName });
    const collectionHref = (ownerId, collectionId) => {
      const owner = profileNames.get(ownerId) || profile.username;
      return publicProfileHref(owner, collectionId);
    };
    const events = [];
    const add = (rows, type, build, dateKey = "created_at") => rows.forEach(row => events.push({ ...build(row), created_at: row[dateKey] || row.created_at }));
    add(comicLikes, "like", row => ({ icon: "♥", label: "Curtiu o quadrinho", subject: itemName(row.item_id), href: itemHref(row.item_id) }));
    add(blogLikes.filter(row => blogNames.has(String(row.blog_id))), "like", row => ({ icon: "♥", label: "Curtiu o blog", subject: blogNames.get(String(row.blog_id)), href: blogHref(row.blog_id) }));
    add(collectionLikes, "like", row => ({ icon: "♥", label: "Curtiu a coleção", subject: collectionNames.get(String(row.collection_id))?.name || "coleção", href: collectionHref(row.owner_id, row.collection_id) }));
    add(follows, "follow", row => ({ icon: "＋", label: "Seguiu", subject: `@${profileNames.get(row.following_id) || "usuário"}`, href: profileNames.get(row.following_id) ? publicProfileHref(profileNames.get(row.following_id)) : "" }));
    add(comments, "comment", row => ({ icon: "💬", label: "Comentou em", subject: itemName(row.item_id), detail: row.body, href: itemHref(row.item_id) }));
    add(blogComments.filter(row => blogNames.has(String(row.blog_id))), "comment", row => ({ icon: "💬", label: "Comentou em", subject: blogNames.get(String(row.blog_id)), detail: row.body, href: blogHref(row.blog_id) }));
    add(wallComments, "comment", row => ({ icon: "💬", label: "Comentou no mural de", subject: `@${profileNames.get(row.profile_id) || "usuário"}`, detail: row.body, href: profileNames.get(row.profile_id) ? publicProfileHref(profileNames.get(row.profile_id)) : "" }));
    add(favorites, "save", row => ({ icon: "★", label: "Salvou", subject: itemName(row.item_id), href: itemHref(row.item_id) }));
    add(blogSaves.filter(row => blogNames.has(String(row.blog_id))), "save", row => ({ icon: "★", label: "Salvou o blog", subject: blogNames.get(String(row.blog_id)), href: blogHref(row.blog_id) }));
    add(collectionSaves, "save", row => ({ icon: "★", label: "Salvou a coleção", subject: collectionNames.get(String(row.collection_id))?.name || "coleção", href: collectionHref(row.owner_id, row.collection_id) }));
    add(publisherSaves, "save", row => ({ icon: "★", label: "Salvou a editora", subject: row.publisher_name, href: publisherHref(row.publisher_name) }));
    add(reads, "read", row => ({ icon: "✓", label: "Concluiu a leitura de", subject: itemName(row.item_id), href: itemHref(row.item_id) }), "updated_at");
    return events.filter(event => event.created_at).sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 100);
  }

