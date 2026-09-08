  function decorateHomepageSection(key, markup, index, total) {
    if (!markup || !canManageHomepageOrder()) return markup;
    const movableKeys = state.homeVisibleSectionKeys;
    const movableIndex = movableKeys.indexOf(key);
    const visibilityControl = canManageHomepageOrder()
      ? `<button type="button" class="small-btn" data-home-section-visibility="${state.homeHiddenSectionKeys.has(key) ? "show" : "hide"}" data-home-section-key="${escapeHTML(key)}" title="${state.homeHiddenSectionKeys.has(key) ? "Mostrar seção para usuários comuns" : "Ocultar seção para usuários comuns"}" aria-label="${state.homeHiddenSectionKeys.has(key) ? "Mostrar seção para usuários comuns" : "Ocultar seção para usuários comuns"}">${state.homeHiddenSectionKeys.has(key) ? "◉" : "⊘"}</button>`
      : "";
    const controls = `<div class="homepage-section-order-controls"><button type="button" class="small-btn" data-home-section-move="up" data-home-section-key="${escapeHTML(key)}" ${movableIndex <= 0 ? "disabled" : ""} title="Mover seção para cima" aria-label="Mover seção para cima">↑</button><button type="button" class="small-btn" data-home-section-move="down" data-home-section-key="${escapeHTML(key)}" ${movableIndex < 0 || movableIndex === movableKeys.length - 1 ? "disabled" : ""} title="Mover seção para baixo" aria-label="Mover seção para baixo">↓</button>${visibilityControl}</div>`;
    if (markup.includes("data-home-section-controls-slot")) return markup.replace('<div data-home-section-controls-slot></div>', controls);
    const headStart = markup.indexOf('<div class="section-head">');
    if (headStart >= 0) {
      let depth = 0;
      let cursor = headStart;
      while (cursor < markup.length) {
        const nextOpen = markup.indexOf("<div", cursor);
        const nextClose = markup.indexOf("</div>", cursor);
        if (nextClose < 0) break;
        if (nextOpen >= 0 && nextOpen < nextClose) {
          depth += 1;
          cursor = nextOpen + 4;
        } else {
          depth -= 1;
          if (depth === 0) return `${markup.slice(0, nextClose)}${controls}${markup.slice(nextClose)}`;
          cursor = nextClose + 6;
        }
      }
    }
    const sectionOpen = markup.match(/^\s*<section\b[^>]*>/)?.[0];
    return sectionOpen ? markup.replace(sectionOpen, `${sectionOpen}<div class="homepage-section-admin">${controls}</div>`) : markup;
  }

