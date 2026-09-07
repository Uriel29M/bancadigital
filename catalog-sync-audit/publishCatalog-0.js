  async function publishCatalog() {
    if (!sb || state.profile?.plan !== "admin") return { skipped: true };
    const result = await sb.functions.invoke("github-catalog", {
      body: { library: compactSeriesItems(state.db.library), series: window.DEFAULT_SERIES || [], collections: state.db.collections },
    });
    if (result.error) {
      let detail = result.error.message || "Não foi possível publicar o catálogo.";
      try {
        const response = result.error.context;
        if (response?.clone) {
          const body = await response.clone().json();
          if (body?.error) detail = body.error;
        }
      } catch {}
      throw new Error(detail);
    }
    if (result.data?.error) throw new Error(result.data.error);
    return result.data;
  }

