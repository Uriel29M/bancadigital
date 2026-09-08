  async function toggleHomepageSectionVisibility(key, hidden) {
    if (!sb || !canManageHomepageOrder() || !HOME_SECTION_ORDER.includes(key)) return;
    const nextHidden = new Set(state.homeHiddenSectionKeys);
    if (hidden) nextHidden.add(key);
    else nextHidden.delete(key);
    state.homeHiddenSectionKeys = nextHidden;
    render();
    const result = await sb.rpc("update_homepage_section_visibility", { p_section_key: key, p_hidden: hidden });
    if (result.error) {
      console.error("Não foi possível persistir a visibilidade da seção da home:", result.error);
      return toast(result.error.message || "A visibilidade foi aplicada nesta sessão, mas não pôde ser salva.");
    }
  }

