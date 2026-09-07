
  async function saveCatalog(message = "Catálogo salvo.", edition = null) {
    let sharedPublished = false;
    try {
      if (edition) {
        if (!sb || state.profile?.plan !== "admin" || !state.session?.user?.id) throw new Error("É necessária uma sessão de administrador para publicar a edição.");
        const record = await BancaCatalogSync.publish(sb, edition, state.session.user.id);
        const canonical = { ...record.edition, catalogEditedAt: record.updated_at };
        BancaCatalogSync.rows.set(String(canonical.id), { ...record, edition: canonical });
        const index = state.db.library.findIndex(item => String(item.id) === String(canonical.id));
        if (index >= 0) state.db.library[index] = canonical;
        else state.db.library.push(canonical);
        sharedPublished = true;
        clearGeneratedCoverCache();
      }
      save();
      const result = await publishCatalog();
      if (result?.skipped) {
        if (!sharedPublished) {
          toast("Alteração salva somente neste navegador. A publicação exige conexão com o Supabase e uma conta de administrador.");
          return false;
        }
        toast(`${message} Alteração compartilhada com todos os usuários.`);
        return true;
      }
      toast(`${message} Alteração compartilhada com todos os usuários. O catálogo estático também foi atualizado.`);
      return true;
    } catch (error) {
      console.error("[CATALOG] Falha ao publicar:", error);
      if (sharedPublished) {
        toast(`${message} Alteração compartilhada com todos os usuários. A cópia estática do GitHub não foi atualizada: ${error.message || "erro desconhecido"}`);
        return true;
      }
      toast(`Não foi possível publicar a alteração para os demais usuários: ${error.message || "erro desconhecido"}`);
      return false;
    }
  }
