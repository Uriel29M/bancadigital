  async function loadCoverChoices(userId) {
    if (!sb || !userId) {
      state.coverChoices = new Map();
      return;
    }
    const result = await sb.from("user_cover_choices").select("item_id, variant_key, label, cover_url").eq("user_id", userId);
    state.coverChoices = result.error ? new Map() : new Map((result.data || []).map(choice => [choice.item_id, choice]));
  }

