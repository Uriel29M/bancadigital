  async function loadSeriesCoverChoices(userId) {
    if (!userId) {
      state.seriesCoverChoices = new Map();
      return;
    }
    const result = await sb.from("user_series_cover_choices").select("series_id, item_id, cover_url, variant_key, is_variant").eq("user_id", userId);
    state.seriesCoverChoices = result.error ? new Map() : new Map((result.data || []).map(choice => [choice.series_id, choice]));
  }

