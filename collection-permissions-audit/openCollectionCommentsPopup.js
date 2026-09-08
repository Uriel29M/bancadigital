  async function openCollectionCommentsPopup(collection, ownerProfile) {
    if (!sb || !collection?.id || !ownerProfile?.id) return toast("Os comentários ainda não estão disponíveis.");
    const overlay = document.createElement("div");
    overlay.className = "modal-backdrop comments-modal-backdrop";
    overlay.innerHTML = `<div class="modal comments-modal"><div class="section-head"><div><h2>Comentários da coleção</h2><div class="section-subtitle">${escapeHTML(collection.name || "Coleção")}</div></div><button class="small-btn" data-close>Fechar</button></div><div class="comments-list"><span class="section-subtitle">Carregando...</span></div>${state.session ? '<form class="comment-form"><textarea name="body" maxlength="1000" required placeholder="Escreva um comentário..."></textarea><button class="small-btn" type="submit">Comentar</button></form>' : '<p class="section-subtitle">Entre para comentar.</p>'}</div>`;
    $("#modal-root").appendChild(overlay);
    overlay.addEventListener("click", event => { if (event.target === overlay) overlay.remove(); });
    $("[data-close]", overlay).onclick = () => overlay.remove();
    const list = $(".comments-list", overlay);
    const refresh = async () => {
      let result = await sb.from("shelf_collection_comments").select("id, collection_id, owner_id, user_id, body, created_at, profiles(username, avatar_url, title, title_color, faction_id, plan)").eq("collection_id", collection.id).order("created_at", { ascending: true });
      if (result.error && /profiles|schema cache|relationship/i.test(result.error.message || "")) {
        result = await sb.from("shelf_collection_comments").select("id, collection_id, owner_id, user_id, body, created_at").eq("collection_id", collection.id).order("created_at", { ascending: true });
      }
      if (result.error) {
        list.innerHTML = `<span class="section-subtitle">${escapeHTML(result.error.message || "Não foi possível carregar os comentários.")}</span>`;
        return;
      }
      list.innerHTML = (result.data || []).map(comment => {
        const profile = { ...(comment.profiles || {}), username: cleanUsername(comment.profiles?.username || "usuário") };
        const canDelete = comment.user_id === state.session?.user?.id || comment.owner_id === state.session?.user?.id || ["moderator", "banca", "admin"].includes(state.profile?.plan);
        return `<article class="comment"><div class="comment-author-row">${avatarMarkup(profile, "comment-avatar")}<div class="comment-author-info"><a class="comment-author" href="${escapeHTML(publicProfileHref(profile.username))}" target="_blank" rel="noopener">@${escapeHTML(profile.username)}</a>${profile.title ? `<span class="comment-title">${escapeHTML(profile.title)}</span>` : ""}</div></div><p>${escapeHTML(comment.body)}</p><div class="comment-actions">${canDelete ? `<button class="comment-action comment-delete-action" data-collection-comment-delete="${escapeHTML(comment.id)}">Excluir</button>` : ""}<time class="comment-date" datetime="${escapeHTML(comment.created_at)}">${escapeHTML(formatCommentDate(comment.created_at))}</time></div></article>`;
      }).join("") || '<span class="section-subtitle">Nenhum comentário ainda.</span>';
      $$('[data-collection-comment-delete]', overlay).forEach(button => button.onclick = async () => {
        const result = await sb.from("shelf_collection_comments").delete().eq("id", button.dataset.collectionCommentDelete);
        if (result.error) return toast(result.error.message || "Não foi possível excluir o comentário.");
        await refresh();
      });
    };
    await refresh();
    $(".comment-form", overlay)?.addEventListener("submit", async event => {
      event.preventDefault();
      if (!state.session?.user?.id) return openAuthPage();
      const form = event.currentTarget;
      const body = String(new FormData(form).get("body") || "").trim();
      if (!body) return;
      const button = $("button", form);
      button.disabled = true;
      const result = await sb.from("shelf_collection_comments").insert({ collection_id: collection.id, owner_id: ownerProfile.id, user_id: state.session.user.id, body });
      if (result.error) {
        const silencedUntil = state.profile?.silenced_until && new Date(state.profile.silenced_until) > new Date();
        toast(silencedUntil
          ? `Sua conta está silenciada até ${formatCommentDate(state.profile.silenced_until)}.`
          : "Não foi possível publicar. Sua conta pode estar temporariamente limitada por anti-spam ou impedida de comentar.");
      }
      else { awardProfileXp("comment", `collection-comment:${collection.id}:${Date.now()}`); form.reset(); await refresh(); }
      button.disabled = false;
    });
  }

