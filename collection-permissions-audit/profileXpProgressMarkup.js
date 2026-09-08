  function profileXpProgressMarkup(profile, compact = false) {
    if (normalizedPlan(profile) === "banca") {
      return `<div class="profile-xp-progress profile-xp-unavailable ${compact ? "is-compact" : ""}"><div class="profile-xp-head"><strong>Precisa de ajuda?</strong></div><small>Envie uma mensagem se tiver algum problema ou precisar de ajuda.</small></div>`;
    }
    const xp = Math.max(0, Number(profile?.xp) || 0);
    const level = Math.max(1, Number(profile?.level) || 1);
    const currentFloor = Math.pow(level - 1, 2) * 100;
    const nextFloor = Math.pow(level, 2) * 100;
    const progress = Math.max(0, Math.min(100, ((xp - currentFloor) / Math.max(1, nextFloor - currentFloor)) * 100));
    return `<div class="profile-xp-progress ${compact ? "is-compact" : ""}"><div class="profile-xp-head"><strong>Nível ${level}</strong><span>${xp.toLocaleString("pt-BR")} / ${nextFloor.toLocaleString("pt-BR")} XP para o nível ${level + 1}</span></div><div class="profile-xp-track"><span style="width:${progress.toFixed(2)}%"></span></div>${compact ? "" : `<small>${Math.max(0, nextFloor - xp).toLocaleString("pt-BR")} XP restantes · 🔥 ${Number(profile?.daily_streak || 0)} dia(s) de sequência</small>`}</div>`;
  }

