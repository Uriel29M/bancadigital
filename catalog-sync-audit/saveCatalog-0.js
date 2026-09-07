  async function saveCatalog(message = "Catálogo salvo.") {
    try {
      save();
      const result = await publishCatalog();
      if (result?.skipped) {
        toast("Alteração salva somente neste navegador. A publicação exige conexão com o Supabase e uma conta de administrador.");
        return false;
      }
      toast(`${message} GitHub atualizado. Os demais usuários receberão a alteração após a publicação do site e ao recarregar a página.`);
      return true;
    } catch (error) {
      console.error("[CATALOG] Falha ao publicar no GitHub:", error);
      const detail = /failed to send a request to the edge function/i.test(error.message || "")
        ? "a Edge Function github-catalog não respondeu. Implante-a no projeto Supabase."
        : (error.message || "não foi possível publicar.");
      toast(`Não foi possível publicar a alteração para os demais usuários. GitHub: ${detail}`);
      return false;
    }
  }

