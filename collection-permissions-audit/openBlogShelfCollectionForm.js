  function openBlogShelfCollectionForm(collectionId = null) {
    const existing = state.blogShelfCategories.find(collection => collection.id === collectionId);
    const posts = [...new Map([...state.authoredBlogPosts, ...state.savedBlogPosts].map(post => [String(post.id), post])).values()];
    const overlay = document.createElement("div");
    overlay.className = "modal-backdrop";
    overlay.innerHTML = `<div class="modal"><div class="section-head"><div><h2>${existing ? "Editar coleção de blogs" : "Nova coleção de blogs"}</h2><div class="section-subtitle">Organize blogs escritos ou salvos.</div></div><button class="small-btn" data-close>Fechar</button></div><form id="blog-shelf-collection-form"><div class="field"><label>Nome da coleção</label><input name="name" maxlength="60" required value="${escapeHTML(existing?.name || "")}" placeholder="Ex.: Notícias favoritas"></div><div class="field"><label>Imagem da coleção (opcional)</label><input name="coverUrl" type="url" value="${escapeHTML(existing?.coverUrl || "")}" placeholder="https://..."></div><div class="field"><label><input name="isPublic" type="checkbox" ${existing?.isPublic !== false ? "checked" : ""}> Coleção pública</label></div><div class="field"><label>Blogs</label><div class="collection-picker">${posts.map(post => `<label><input type="checkbox" name="blogIds" value="${escapeHTML(post.id)}" ${existing?.blogIds?.includes(String(post.id)) ? "checked" : ""}> ${escapeHTML(post.title)}</label>`).join("") || "Salve ou escreva algum blog primeiro."}</div></div><div class="modal-actions"><button type="button" class="small-btn" data-close>Cancelar</button><button class="btn btn-danger" type="submit">${existing ? "Salvar alterações" : "Criar coleção"}</button></div></form></div>`;
    $("#modal-root").appendChild(overlay);
    $$('[data-close]', overlay).forEach(button => button.onclick = () => overlay.remove());
    overlay.addEventListener("click", event => { if (event.target === overlay) overlay.remove(); });
    $("#blog-shelf-collection-form", overlay).onsubmit = async event => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const name = String(form.get("name") || "").trim();
      const blogIds = form.getAll("blogIds");
      if (!name) return;
      const payload = { owner_id: state.session.user.id, name, cover_url: String(form.get("coverUrl") || "").trim() || null, is_public: form.get("isPublic") === "on", collection_type: "blog", blog_ids: blogIds, item_ids: [] };
      const result = existing ? await sb.from("shelf_collections").update(payload).eq("id", existing.id).eq("owner_id", state.session.user.id) : await sb.from("shelf_collections").insert({ id: `blog-shelf-${Date.now()}`, ...payload });
      if (result.error) return toast("Não foi possível criar a coleção de blogs.");
      overlay.remove();
      await loadAccount();
    };
  }

