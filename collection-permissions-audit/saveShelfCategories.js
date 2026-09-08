  async function saveShelfCategories(categories) {
    if (sb && state.session) {
      const rows = categories.map(category => ({ id: category.id, owner_id: state.session.user.id, name: category.name, cover_url: category.coverUrl || null, is_public: category.isPublic !== false, item_ids: category.itemIds || [], sort_order: category.sortOrder || state.collectionSortOrders?.[`category:${category.id}`] || "added_desc", collection_type: "comic", blog_ids: [], is_featured: category.is_featured === true }));
      let result = rows.length ? await sb.from("shelf_collections").upsert(rows, { onConflict: "id" }) : { error: null };
      if (result.error && /sort_order|schema cache|column/i.test(result.error.message || "")) {
        result = rows.length ? await sb.from("shelf_collections").upsert(rows.map(({ sort_order, ...row }) => row), { onConflict: "id" }) : { error: null };
      }
      if (result.error) return toast("Não foi possível salvar a organização da estante.");
      const ids = rows.map(row => row.id);
      const existing = await sb.from("shelf_collections").select("id").eq("owner_id", state.session.user.id).eq("collection_type", "comic");
      const removedIds = (existing.data || []).map(row => row.id).filter(id => !ids.includes(id));
      if (removedIds.length) await sb.from("shelf_collections").delete().eq("owner_id", state.session.user.id).in("id", removedIds);
    }
    render();
    toast("Estante atualizada.");
  }

