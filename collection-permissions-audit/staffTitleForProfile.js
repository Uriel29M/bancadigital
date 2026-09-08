  function staffTitleForProfile(profile = {}) {
    if (String(profile?.username || "").toLowerCase() === "guria") return "Guia";
    const plan = normalizedPlan(profile);
    if (["moderator", "banca"].includes(plan)) return "ADM";
    return "";
  }

