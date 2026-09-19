export function createChatFeature(deps) {
  const {
    $,
    $$,
    CHAT_ROOMS,
    askModerationReason,
    avatarMarkup,
    canOpenChatRoom,
    chatBodyMarkup,
    chatRoomLabel,
    cleanUsername,
    escapeHTML,
    factionChatSheriffIds,
    factionDot,
    formatCommentDate,
    hydrateChatFactionRoleTitles,
    hydrateChatTop10Previews,
    isFactionChatSheriff,
    isNotificationFromOpenChat,
    isSheriffRoom,
    loadChatSenderVisuals,
    loadNotifications,
    markChatMentionsRead,
    markChatNotificationsRead,
    officialAiBadge,
    openAuthPage,
    prepareChatMessage,
    publicProfileHref,
    render,
    safeTitleColor,
    sb,
    sheriffAvatarMarkup,
    staffTitleMarkup,
    state,
    toast
  } = deps;

  function usesMobileChatPage() {
    return window.matchMedia?.("(max-width: 760px)")?.matches ?? window.innerWidth <= 760;
  }

  function discardActiveMobileChatPage() {
    const cleanup = state.chatPageCleanup;
    state.chatPageCleanup = null;
    if (typeof cleanup === "function") cleanup();
    document.querySelectorAll(".chat-page-shell").forEach(node => node.remove());
    document.body.classList.remove("chat-page-open");
  }

  function prepareMobileChatPage() {
    if (state.section !== "messages") state.chatReturnSection = state.section || "home";
    state.section = "messages";
    render();
  }

  function mountChatSurface(markup, mobilePage) {
    const surface = document.createElement("div");
    surface.className = mobilePage ? "chat-page-shell" : "modal-backdrop";
    surface.innerHTML = markup;
    if (mobilePage) {
      const main = $("#main");
      main.replaceChildren(surface);
      document.body.classList.add("chat-page-open");
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    } else {
      $("#modal-root").appendChild(surface);
    }
    return surface;
  }

  function restoreChatReturnSection() {
    const target = state.chatReturnSection && state.chatReturnSection !== "messages" ? state.chatReturnSection : "home";
    state.chatReturnSection = null;
    state.section = target;
    render();
  }

  function chatMessageMarkup(message, profile = {}, senderVisual = null, options = {}) {
    const username = cleanUsername(profile.username || "usuário");
    const isGuria = username.toLowerCase() === "guria";
    const title = isGuria ? "" : String(profile.title || "").trim();
    const reply = message.metadata?.reply_to;
    const replyMarkup = reply?.body ? `<div class="chat-message-reply"><b>Respondendo a @${escapeHTML(cleanUsername(reply.username || "usuario"))}</b><span>${escapeHTML(String(reply.body).slice(0, 180))}</span></div>` : "";
    const canModerateChat = options.canModerate ?? ["moderator", "banca", "admin"].includes(state.profile?.plan);
    const isSheriff = (options.sheriffId && String(options.sheriffId) === String(message.sender_id)) || options.sheriffIds?.has(String(message.sender_id));
    const messageAvatar = isSheriff ? sheriffAvatarMarkup({ ...profile, username }, "chat-message-avatar") : avatarMarkup({ ...profile, username }, "chat-message-avatar");
    const moderationButton = canModerateChat ? `<button type="button" class="chat-delete-action" data-chat-delete="${escapeHTML(message.id || "")}" aria-label="Excluir mensagem" title="Excluir mensagem"><span class="chat-delete-glyph">×</span></button>` : "";
    const expandButton = `<button type="button" class="chat-expand-message-action" data-chat-message-expand aria-expanded="false" hidden>Expandir</button>`;
    const replyButton = `<button type="button" class="chat-reply-action" data-chat-reply="${escapeHTML(message.id || "")}" aria-label="Responder esta mensagem" title="Responder">↩</button>`;
    const pinButton = canModerateChat && options.allowPin ? `<button type="button" class="chat-pin-action" data-chat-pin="${escapeHTML(message.id || "")}" aria-label="Fixar mensagem" title="Fixar mensagem">📌</button>` : "";
    return `<div class="chat-message ${message.sender_id === state.session.user.id ? "is-mine" : ""}${canModerateChat ? " has-chat-moderation" : ""}" data-chat-message-id="${escapeHTML(message.id || "")}">${moderationButton}<a class="chat-message-author" href="${escapeHTML(publicProfileHref(username))}" target="_blank" rel="noopener">${messageAvatar}<span><b>${factionDot(profile)}@${escapeHTML(username)} ${officialAiBadge(profile)}</b>${title ? `<em style="--title-bg:${safeTitleColor(profile.title_color)}">${escapeHTML(title)}</em>` : ""}</span></a>${staffTitleMarkup(profile)}${replyMarkup}<div class="chat-message-body">${chatBodyMarkup(message.body, message.metadata, senderVisual)}</div><div class="chat-message-footer"><small>${escapeHTML(formatCommentDate(message.created_at))}</small><div class="chat-message-actions">${expandButton}${pinButton}${replyButton}</div></div></div>`;
  }

  function updateChatMessageExpansionUI(messagesRoot) {
    if (!messagesRoot) return;
    $$('[data-chat-message-id]', messagesRoot).forEach(message => {
      const body = $(".chat-message-body", message);
      const button = $("[data-chat-message-expand]", message);
      if (!body || !button) return;
      body.classList.remove("is-expanded");
      body.classList.add("is-line-limited");
      button.hidden = true;
      button.textContent = "Expandir";
      button.setAttribute("aria-expanded", "false");
      requestAnimationFrame(() => {
        body.classList.remove("is-line-limited");
        const lineTops = new Set();
        const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT, {
          acceptNode: node => node.textContent.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT
        });
        let node;
        while ((node = walker.nextNode())) {
          const range = document.createRange();
          range.selectNodeContents(node);
          [...range.getClientRects()].forEach(rect => lineTops.add(Math.round(rect.top)));
        }
        const canExpand = lineTops.size > 9;
        body.classList.add("is-line-limited");
        button.hidden = !canExpand;
        button.textContent = "Expandir";
        button.setAttribute("aria-expanded", "false");
      });
    });
  }

  function setupChatMessageExpansionUI(messagesRoot) {
    if (!messagesRoot || messagesRoot.dataset.messageExpansionBound) return;
    messagesRoot.dataset.messageExpansionBound = "true";
    messagesRoot.addEventListener("click", event => {
      const button = event.target.closest?.("[data-chat-message-expand]");
      if (!button) return;
      const body = $(".chat-message-body", button.closest(".chat-message"));
      if (!body) return;
      const expanded = body.classList.toggle("is-expanded");
      body.classList.toggle("is-line-limited", !expanded);
      button.textContent = expanded ? "Recolher" : "Expandir";
      button.setAttribute("aria-expanded", expanded ? "true" : "false");
    });
    updateChatMessageExpansionUI(messagesRoot);
  }

  function setupChatReplyUI({ messagesRoot, compose, input, getMessage }) {
    if (!messagesRoot || !compose || !input) {
      const noReply = () => null;
      noReply.clear = () => {};
      return noReply;
    }
    let selectedMessage = null;
    let preview = $(".chat-reply-preview", compose);
    if (!preview) {
      preview = document.createElement("div");
      preview.className = "chat-reply-preview";
      preview.hidden = true;
      preview.innerHTML = `<span></span><button type="button" aria-label="Cancelar resposta">×</button>`;
      compose.insertBefore(preview, compose.firstChild);
    }
    const update = () => {
      preview.hidden = !selectedMessage;
      if (selectedMessage) {
        $("span", preview).innerHTML = `<b>Respondendo a @${escapeHTML(cleanUsername(selectedMessage.profile?.username || "usuario"))}</b> ${escapeHTML(String(selectedMessage.body || "").slice(0, 160))}`;
        input.focus();
      }
    };
    const choose = id => { const message = getMessage(id); if (message) { selectedMessage = message; update(); } };
    $("button", preview).onclick = () => { selectedMessage = null; update(); input.focus(); };
    messagesRoot.addEventListener("click", event => { const button = event.target.closest("[data-chat-reply]"); if (button) choose(button.dataset.chatReply); });
    messagesRoot.addEventListener("error", event => {
      const image = event.target.closest?.("[data-chat-image-link] img");
      if (!image) return;
      image.hidden = true;
      image.parentElement.classList.add("is-broken");
    }, true);
    const getReply = () => selectedMessage ? { id: selectedMessage.id, body: selectedMessage.body, username: selectedMessage.profile?.username || "usuario" } : null;
    getReply.clear = () => { selectedMessage = null; update(); };
    return getReply;
  }

  function removeLegacyChatScrollControls(root = document) {
    $$(".chat-scroll-controls, .chat-scroll-control, .chat-scroll-edge, [data-chat-scroll-controls], [data-chat-scroll-first], [data-chat-scroll-latest]", root).forEach(element => element.remove());
  }

  function setupChatModerationUI({ messagesRoot, getMessage, renderMessages, roomId = null, pinsRoot = null, canModerate = null }) {
    const canModerateChat = canModerate ?? ["moderator", "banca", "admin"].includes(state.profile?.plan);
    if (!messagesRoot || !canModerateChat) return;
    messagesRoot.addEventListener("click", async event => {
      const reportButton = event.target.closest?.("[data-chat-report]");
      if (reportButton) {
        event.preventDefault(); event.stopPropagation();
        const message = getMessage(reportButton.dataset.chatReport);
        const reason = message && await askChatReportReason();
        if (!message || !reason) return;
        reportButton.disabled = true;
        const result = await sb.from("chat_message_reports").insert({ message_id: message.id, room_id: roomId, reporter_id: state.session.user.id, target_id: message.sender_id, message_body: String(message.body || "").slice(0, 2000), reason });
        reportButton.disabled = false;
        if (result.error) return toast(/duplicate|unique/i.test(result.error.message || "") ? "Você já denunciou esta mensagem." : (result.error.message || "Não foi possível denunciar a mensagem."));
        toast("Denúncia enviada aos moderadores.");
        return;
      }
      const userButton = event.target.closest?.("[data-chat-user-moderate]");
      if (userButton && roomId) {
        event.preventDefault(); event.stopPropagation();
        const action = await askChatModerationAction(userButton.dataset.chatUsername);
        if (!action || !["mute", "unmute", "clear_recent"].includes(action)) return toast("Ação inválida.");
        const duration = action === "mute" ? (await askChatMuteDuration() || "1h") : "1h";
        const audit = ["mute", "clear_recent"].includes(action) ? await askModerationReason(action === "mute" ? "silence" : "delete_message") : { reason: null, internalNote: null };
        if (!audit) return;
        userButton.disabled = true;
        const result = await sb.rpc("moderate_chat_user", { p_room_id: roomId, p_username: userButton.dataset.chatUsername, p_action: action, p_duration: duration, p_reason: audit.reason || "", p_internal_note: audit.internalNote || "" });
        userButton.disabled = false;
        if (result.error) return toast(result.error.message || "Não foi possível aplicar a moderação.");
        toast(action === "mute" ? "Usuário silenciado nesta sala." : action === "unmute" ? "Silenciamento removido." : "Mensagens recentes removidas.");
        await renderMessages();
        return;
      }
      const pinButton = event.target.closest?.("[data-chat-pin]");
      if (pinButton && roomId) {
        event.preventDefault();
        event.stopPropagation();
        pinButton.disabled = true;
        const duration = await askChatPinDuration();
        if (duration) {
          const result = await sb.rpc("pin_chat_message", { p_room_id: roomId, p_message_id: Number(pinButton.dataset.chatPin), p_duration: duration });
          if (result.error) toast(result.error.message || "Não foi possível fixar a mensagem.");
          else await renderChatPins(pinsRoot, roomId, canModerateChat);
        }
        pinButton.disabled = false;
        return;
      }
      const button = event.target.closest?.("[data-chat-delete]");
      if (!button) return;
      event.preventDefault();
      event.stopPropagation();
      const message = getMessage(button.dataset.chatDelete);
      if (!message) return;
      button.disabled = true;
      const confirmed = await askChatDeleteConfirmation();
      if (!confirmed) {
        button.disabled = false;
        return;
      }
      const moderatedDelete = chatCanModerate && message.sender_id !== state.session?.user?.id;
      const audit = moderatedDelete ? await askModerationReason("delete_message") : { reason: null, internalNote: null };
      if (!audit) {
        button.disabled = false;
        return;
      }
      const result = moderatedDelete
        ? await sb.rpc("delete_moderated_chat_message", { p_message_id: message.id, p_reason: audit.reason, p_internal_note: audit.internalNote })
        : await sb.from("chat_messages").delete().eq("id", message.id);
      if (result.error) {
        button.disabled = false;
        return toast(result.error.message || "Não foi possível excluir a mensagem.");
      }
      await renderMessages();
    });
    if (pinsRoot && roomId) pinsRoot.addEventListener("click", async event => {
      const expandButton = event.target.closest?.("[data-chat-pin-expand]");
      if (expandButton) {
        const slide = expandButton.closest("[data-chat-pin-slide]");
        const expanded = slide?.classList.toggle("is-expanded");
        if (expanded) pinsRoot._chatPinPause?.();
        expandButton.textContent = expanded ? "Recolher" : "Expandir";
        expandButton.setAttribute("aria-expanded", expanded ? "true" : "false");
        return;
      }
      const button = event.target.closest?.("[data-chat-unpin]");
      if (!button) return;
      event.preventDefault();
      event.stopPropagation();
      button.disabled = true;
      const result = await sb.rpc("unpin_chat_message", { p_room_id: roomId, p_message_id: Number(button.dataset.chatUnpin) });
      if (result.error) {
        button.disabled = false;
        return toast(result.error.message || "Não foi possível desfixar a mensagem.");
      }
      await renderChatPins(pinsRoot, roomId, canModerateChat);
    });
  }

  function askChatDeleteConfirmation() {
    return new Promise(resolve => {
      const overlay = document.createElement("div");
      overlay.className = "modal-backdrop";
      overlay.innerHTML = `<div class="modal chat-delete-confirm-modal"><div class="section-head"><div><div class="eyebrow">Moderação</div><h2>Excluir mensagem?</h2><div class="section-subtitle">Esta mensagem será removida do chat e essa ação não pode ser desfeita.</div></div></div><div class="modal-actions"><button type="button" class="small-btn" data-chat-delete-cancel>Cancelar</button><button type="button" class="btn btn-danger" data-chat-delete-confirm>Excluir mensagem</button></div></div>`;
      $("#modal-root").appendChild(overlay);
      const finish = value => { overlay.remove(); resolve(value); };
      $("[data-chat-delete-cancel]", overlay).onclick = () => finish(false);
      $("[data-chat-delete-confirm]", overlay).onclick = () => finish(true);
      overlay.addEventListener("click", event => { if (event.target === overlay) finish(false); });
    });
  }

  function askChatPinDuration() {
    return new Promise(resolve => {
      const overlay = document.createElement("div");
      overlay.className = "modal-backdrop chat-pin-duration-backdrop";
      overlay.innerHTML = `<div class="modal chat-pin-duration-modal"><div class="section-head"><div><div class="eyebrow">Moderação</div><h2>Fixar mensagem</h2><div class="section-subtitle">Escolha por quanto tempo ela ficará no carrossel do chat.</div></div><button type="button" class="small-btn" data-chat-pin-cancel>Cancelar</button></div><div class="chat-pin-duration-options"><button type="button" class="small-btn" data-chat-pin-duration="24h">24 horas</button><button type="button" class="small-btn" data-chat-pin-duration="7d">7 dias</button><button type="button" class="small-btn" data-chat-pin-duration="1m">1 mês</button><button type="button" class="small-btn" data-chat-pin-duration="forever">Até eu mudar</button></div></div>`;
      $("#modal-root").appendChild(overlay);
      const finish = value => { overlay.remove(); resolve(value); };
      $$('[data-chat-pin-duration]', overlay).forEach(button => button.onclick = () => finish(button.dataset.chatPinDuration));
      $("[data-chat-pin-cancel]", overlay).onclick = () => finish(null);
      overlay.addEventListener("click", event => { if (event.target === overlay) finish(null); });
    });
  }

  function askChatSlowMode(currentSeconds = 0) {
    return new Promise(resolve => {
      const overlay = document.createElement("div");
      overlay.className = "modal-backdrop chat-slow-mode-backdrop";
      overlay.innerHTML = `<div class="modal chat-slow-mode-modal"><div class="section-head"><div><div class="eyebrow">Moderação</div><h2>Slow mode</h2><div class="section-subtitle">Defina o intervalo mínimo entre mensagens na sala.</div></div><button type="button" class="small-btn" data-chat-slow-mode-cancel>Cancelar</button></div><form data-chat-slow-mode-form><label class="field"><span>Slow mode em segundos</span><input name="seconds" type="number" min="0" max="300" step="1" inputmode="numeric" value="${Math.max(0, Math.min(300, Number(currentSeconds) || 0))}" required><small class="format-hint">0 desativa · máximo 300 segundos</small></label><div class="modal-actions"><button type="button" class="small-btn" data-chat-slow-mode-cancel>Cancelar</button><button type="submit" class="btn btn-danger">Salvar</button></div></form></div>`;
      $("#modal-root").appendChild(overlay);
      const finish = value => { overlay.remove(); resolve(value); };
      $$('[data-chat-slow-mode-cancel]', overlay).forEach(button => button.onclick = () => finish(null));
      $("[data-chat-slow-mode-form]", overlay).onsubmit = event => {
        event.preventDefault();
        const input = $("[name=seconds]", overlay);
        const value = Number(input.value);
        if (!Number.isFinite(value) || value < 0 || value > 300 || !Number.isInteger(value)) return input.reportValidity();
        finish(value);
      };
      overlay.addEventListener("click", event => { if (event.target === overlay) finish(null); });
      $("[name=seconds]", overlay)?.focus();
    });
  }

  function askChatReportReason() {
    return new Promise(resolve => {
      const overlay = document.createElement("div");
      overlay.className = "modal-backdrop chat-report-reason-backdrop";
      overlay.innerHTML = `<div class="modal chat-report-reason-modal"><div class="section-head"><div><div class="eyebrow">Denúncia</div><h2>Motivo da denúncia</h2><div class="section-subtitle">Explique brevemente por que esta mensagem deve ser analisada.</div></div><button type="button" class="small-btn" data-chat-report-cancel>Cancelar</button></div><form data-chat-report-form><label class="field"><span>Motivo</span><textarea name="reason" rows="4" maxlength="500" required placeholder="Descreva o motivo da denúncia"></textarea></label><div class="modal-actions"><button type="button" class="small-btn" data-chat-report-cancel>Cancelar</button><button type="submit" class="btn btn-danger">Enviar denúncia</button></div></form></div>`;
      $("#modal-root").appendChild(overlay);
      const finish = value => { overlay.remove(); resolve(value); };
      $$('[data-chat-report-cancel]', overlay).forEach(button => button.onclick = () => finish(null));
      $("[data-chat-report-form]", overlay).onsubmit = event => {
        event.preventDefault();
        const reason = $("[name=reason]", overlay).value.trim();
        if (!reason) return $("[name=reason]", overlay).reportValidity();
        finish(reason);
      };
      overlay.addEventListener("click", event => { if (event.target === overlay) finish(null); });
      $("[name=reason]", overlay)?.focus();
    });
  }

  function askChatModerationReason() {
    return new Promise(resolve => {
      const overlay = document.createElement("div");
      overlay.className = "modal-backdrop chat-moderation-reason-backdrop";
      overlay.innerHTML = `<div class="modal chat-moderation-reason-modal"><div class="section-head"><div><div class="eyebrow">Moderação</div><h2>Motivo da ação</h2><div class="section-subtitle">Informe o motivo, se desejar. Este campo é opcional.</div></div><button type="button" class="small-btn" data-chat-reason-cancel>Cancelar</button></div><form data-chat-reason-form><label class="field"><span>Motivo (opcional)</span><textarea name="reason" rows="4" maxlength="500" placeholder="Descreva o motivo da ação"></textarea></label><div class="modal-actions"><button type="button" class="small-btn" data-chat-reason-cancel>Cancelar</button><button type="submit" class="btn btn-danger">Continuar</button></div></form></div>`;
      $("#modal-root").appendChild(overlay);
      const finish = value => { overlay.remove(); resolve(value); };
      $$('[data-chat-reason-cancel]', overlay).forEach(button => button.onclick = () => finish(null));
      $("[data-chat-reason-form]", overlay).onsubmit = event => {
        event.preventDefault();
        finish($("[name=reason]", overlay).value.trim());
      };
      overlay.addEventListener("click", event => { if (event.target === overlay) finish(null); });
      $("[name=reason]", overlay)?.focus();
    });
  }

  function askChatMuteDuration() {
    return new Promise(resolve => {
      const overlay = document.createElement("div");
      overlay.className = "modal-backdrop chat-mute-duration-backdrop";
      overlay.innerHTML = `<div class="modal chat-mute-duration-modal"><div class="section-head"><div><div class="eyebrow">Moderação</div><h2>Duração do silenciamento</h2><div class="section-subtitle">Escolha por quanto tempo o usuário ficará impedido de enviar mensagens.</div></div><button type="button" class="small-btn" data-chat-mute-duration-cancel>Cancelar</button></div><div class="chat-mute-duration-options"><button type="button" class="small-btn" data-chat-mute-duration="10m">10 minutos</button><button type="button" class="small-btn" data-chat-mute-duration="1h">1 hora</button><button type="button" class="small-btn" data-chat-mute-duration="24h">24 horas</button><button type="button" class="small-btn" data-chat-mute-duration="7d">7 dias</button></div></div>`;
      $("#modal-root").appendChild(overlay);
      const finish = value => { overlay.remove(); resolve(value); };
      $$('[data-chat-mute-duration]', overlay).forEach(button => button.onclick = () => finish(button.dataset.chatMuteDuration));
      $("[data-chat-mute-duration-cancel]", overlay).onclick = () => finish(null);
      overlay.addEventListener("click", event => { if (event.target === overlay) finish(null); });
    });
  }

  function askChatModerationAction(username) {
    return new Promise(resolve => {
      const overlay = document.createElement("div");
      overlay.className = "modal-backdrop chat-moderation-action-backdrop";
      overlay.innerHTML = `<div class="modal chat-moderation-action-modal"><div class="section-head"><div><div class="eyebrow">Moderação</div><h2>Ação para @${escapeHTML(username)}</h2><div class="section-subtitle">Escolha a ação que será aplicada nesta sala.</div></div><button type="button" class="small-btn" data-chat-action-cancel>Cancelar</button></div><form data-chat-action-form><label class="field"><span>Ação</span><select name="action" required><option value="mute">Silenciar</option><option value="unmute">Remover silenciamento</option><option value="clear_recent">Apagar mensagens recentes</option></select></label><div class="modal-actions"><button type="button" class="small-btn" data-chat-action-cancel>Cancelar</button><button type="submit" class="btn btn-danger">Continuar</button></div></form></div>`;
      $("#modal-root").appendChild(overlay);
      const finish = value => { overlay.remove(); resolve(value); };
      $$('[data-chat-action-cancel]', overlay).forEach(button => button.onclick = () => finish(null));
      $("[data-chat-action-form]", overlay).onsubmit = event => {
        event.preventDefault();
        finish($("[name=action]", overlay).value);
      };
      overlay.addEventListener("click", event => { if (event.target === overlay) finish(null); });
      $("[name=action]", overlay)?.focus();
    });
  }

  function chatPinDurationLabel(pin) {
    if (!pin.expires_at) return "Até ser desfixada";
    const remaining = new Date(pin.expires_at).getTime() - Date.now();
    if (remaining <= 24 * 60 * 60 * 1000) return "Expira em até 24 horas";
    if (remaining <= 7 * 24 * 60 * 60 * 1000) return "Expira em até 7 dias";
    return "Expira em até 1 mês";
  }

  function chatPinsMarkup(pins, canModerate = null) {
    const canModerateChat = canModerate ?? ["moderator", "banca", "admin"].includes(state.profile?.plan);
    return `<div class="chat-pins-inner">${pins.map((pin, index) => `<article class="chat-pin-slide${index === 0 ? " is-active" : ""}" data-chat-pin-slide="${index}"><div class="chat-pin-heading"><span>📌 Mensagem fixada</span><small>${escapeHTML(chatPinDurationLabel(pin))}</small><div class="chat-pin-carousel-actions"><button type="button" class="chat-pin-carousel-button" data-chat-pin-prev aria-label="Mensagem fixada anterior" title="Anterior">‹</button><button type="button" class="chat-pin-carousel-button" data-chat-pin-toggle aria-label="Pausar carrossel" title="Pausar carrossel">⏸</button><button type="button" class="chat-pin-carousel-button" data-chat-pin-next aria-label="Próxima mensagem fixada" title="Próxima">›</button></div></div><div class="chat-pin-body"><div class="chat-pin-copy">${chatBodyMarkup(pin.body, pin.metadata)}</div></div><div class="chat-pin-footer"><span>— @${escapeHTML(cleanUsername(pin.sender_username || "usuario"))}</span><div class="chat-pin-actions"><button type="button" class="small-btn chat-expand-action" data-chat-pin-expand aria-expanded="false" hidden>Expandir</button>${canModerateChat ? `<button type="button" class="small-btn chat-unpin-action" data-chat-unpin="${escapeHTML(String(pin.message_id))}">Desfixar</button>` : ""}</div></div></article>`).join("")}<div class="chat-pin-dots" role="tablist" aria-label="Mensagens fixadas">${pins.map((pin, index) => `<button type="button" class="chat-pin-dot${index === 0 ? " is-active" : ""}" data-chat-pin-index="${index}" role="tab" aria-label="Mensagem fixada ${index + 1}" aria-selected="${index === 0 ? "true" : "false"}"></button>`).join("")}</div></div>`;
  }

  function updateChatPinExpansionUI(root) {
    $$('[data-chat-pin-slide]', root).forEach(slide => {
      const copy = $(".chat-pin-copy", slide);
      const button = $("[data-chat-pin-expand]", slide);
      if (!copy || !button) return;
      const previousSlideDisplay = slide.style.display;
      const previousCopyDisplay = copy.style.display;
      slide.style.display = "block";
      copy.style.display = "block";
      try {
        const lineTops = new Set();
        const walker = document.createTreeWalker(copy, NodeFilter.SHOW_TEXT, { acceptNode: node => node.textContent.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT });
        let node;
        while ((node = walker.nextNode())) {
          const range = document.createRange();
          range.selectNodeContents(node);
          [...range.getClientRects()].forEach(rect => lineTops.add(Math.round(rect.top)));
        }
        button.hidden = lineTops.size <= 2;
      } finally {
        slide.style.display = previousSlideDisplay;
        copy.style.display = previousCopyDisplay;
      }
    });
  }

  function setupChatPinsCarousel(root) {
    root._chatPinCleanup?.();
    const slides = [...root.querySelectorAll("[data-chat-pin-slide]")];
    const dots = [...root.querySelectorAll("[data-chat-pin-index]")];
    const previous = $$('[data-chat-pin-prev]', root);
    const next = $$('[data-chat-pin-next]', root);
    const toggles = $$('[data-chat-pin-toggle]', root);
    if (slides.length < 2) {
      $(".chat-pin-carousel-actions", root)?.setAttribute("hidden", "true");
      return;
    }
    let current = 0;
    let paused = false;
    const show = index => {
      current = (index + slides.length) % slides.length;
      slides.forEach((slide, itemIndex) => {
        slide.classList.toggle("is-active", itemIndex === current);
        slide.classList.remove("is-expanded");
        const expandButton = $("[data-chat-pin-expand]", slide);
        if (expandButton) {
          expandButton.textContent = "Expandir";
          expandButton.setAttribute("aria-expanded", "false");
        }
      });
      updateChatPinExpansionUI(root);
      dots.forEach((dot, itemIndex) => { dot.classList.toggle("is-active", itemIndex === current); dot.setAttribute("aria-selected", itemIndex === current ? "true" : "false"); });
    };
    dots.forEach(dot => dot.onclick = () => show(Number(dot.dataset.chatPinIndex)));
    previous.forEach(button => button.onclick = () => show(current - 1));
    next.forEach(button => button.onclick = () => show(current + 1));
    const updatePauseButton = () => {
      toggles.forEach(toggle => {
        toggle.textContent = paused ? "▶" : "⏸";
        toggle.setAttribute("aria-label", paused ? "Retomar carrossel" : "Pausar carrossel");
        toggle.title = paused ? "Retomar carrossel" : "Pausar carrossel";
      });
    };
    toggles.forEach(toggle => toggle.onclick = () => { paused = !paused; updatePauseButton(); });
    root._chatPinPause = () => { paused = true; updatePauseButton(); };
    const timer = window.setInterval(() => { if (!paused) show(current + 1); }, 10000);
    root._chatPinCleanup = () => { window.clearInterval(timer); root._chatPinPause = null; };
  }

  async function renderChatPins(root, roomId, canModerate = null) {
    if (!root || !roomId || !sb) return;
    const result = await sb.from("chat_pins").select("id, message_id, body, metadata, sender_username, expires_at, pinned_at").eq("room_id", roomId).or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`).order("pinned_at", { ascending: true });
    if (result.error) return;
    const pins = result.data || [];
    root.hidden = !pins.length;
    root.innerHTML = pins.length ? chatPinsMarkup(pins, canModerate) : "";
    setupChatPinsCarousel(root);
    updateChatPinExpansionUI(root);
  }

  async function openChatSheriffManager(room) {
    if (!isSheriffRoom(room) || !["moderator", "banca", "admin"].includes(state.profile?.plan)) return;
    const currentResult = await sb.rpc("get_chat_room_sheriff", { p_room_id: room.id });
    const current = currentResult.data?.[0] || null;
    const overlay = document.createElement("div");
    overlay.className = "modal-backdrop";
    overlay.innerHTML = `<div class="modal chat-sheriff-modal"><div class="section-head"><div><div class="eyebrow">Moderação da sala</div><h2>Xerife · ${escapeHTML(room.name)}</h2><div class="section-subtitle">O xerife pode fixar e excluir mensagens desta sala pública.</div></div><button type="button" class="small-btn" data-close>Fechar</button></div><div class="notice">${current ? `Xerife atual: <b>@${escapeHTML(current.username)}</b>` : "Nenhum xerife definido."}</div><form data-sheriff-form><label class="field"><span>Usuário do novo xerife</span><input name="username" required placeholder="Nome de usuário" value="${escapeHTML(current?.username || "")}"></label><div class="modal-actions"><button type="button" class="small-btn" data-clear-sheriff>Remover xerife</button><button type="submit" class="btn btn-danger">Salvar xerife</button></div></form></div>`;
    $("#modal-root").appendChild(overlay);
    const close = () => overlay.remove();
    $("[data-close]", overlay).onclick = close;
    overlay.addEventListener("click", event => { if (event.target === overlay) close(); });
    $("[data-clear-sheriff]", overlay).onclick = async () => {
      const result = await sb.rpc("set_chat_room_sheriff", { p_room_id: room.id, p_username: "" });
      if (result.error) return toast(result.error.message || "Não foi possível remover o xerife.");
      close();
      toast("Xerife removido da sala.");
    };
    $("[data-sheriff-form]", overlay).onsubmit = async event => {
      event.preventDefault();
      const username = String(new FormData(event.currentTarget).get("username") || "").trim();
      if (!username) return;
      const result = await sb.rpc("set_chat_room_sheriff", { p_room_id: room.id, p_username: username });
      if (result.error) return toast(result.error.message || "Não foi possível definir o xerife.");
      close();
      toast(`@${result.data?.[0]?.username || username} agora é o xerife da sala.`);
    };
    $("[name=username]", overlay).focus();
  }

  async function openChatRoom(room) {
    const mobilePage = usesMobileChatPage();
    discardActiveMobileChatPage();
    const sheriffResult = isSheriffRoom(room) && sb ? await sb.rpc("get_chat_room_sheriff", { p_room_id: room.id }) : { data: [] };
    const sheriff = sheriffResult.data?.[0] || null;
    const chatCanModerate = ["moderator", "banca", "admin"].includes(state.profile?.plan) || (isSheriffRoom(room) && sheriff?.user_id === state.session?.user?.id) || isFactionChatSheriff(room, state.session?.user?.id);
    const factionSheriffIds = factionChatSheriffIds(room);
    removeLegacyChatScrollControls();
    await markChatMentionsRead(room?.id);
    await loadNotifications();
    if (!state.session || !sb || !room || !canOpenChatRoom(room)) return toast("Você não tem acesso a esta sala.");
    $('.chat-modal').forEach(modal => modal.closest('.modal-backdrop')?.remove());
    if (mobilePage) prepareMobileChatPage();
    const roomHeaderActions = mobilePage
      ? '<button class="small-btn" type="button" data-chat-back>Voltar</button>'
      : '<button class="small-btn" type="button" data-chat-back>Voltar</button><button class="small-btn" type="button" data-close>Fechar</button>';
    const overlay = mountChatSurface(`<div class="modal chat-modal chat-conversation-modal${mobilePage ? " chat-page" : ""}"><div class="section-head"><div><h2>${escapeHTML(room.name)}</h2><div class="section-subtitle">Sala ${chatRoomLabel(room).toLowerCase()} · mensagens expiram em 24 horas</div></div><div class="chat-modal-actions">${roomHeaderActions}</div></div><div class="chat-pins" data-chat-pins hidden></div><div class="chat-messages" data-chat-messages><div class="empty">Carregando mensagens...</div></div><form class="chat-compose" id="chat-room-compose"><textarea name="body" maxlength="2000" rows="2" required placeholder="Escreva uma mensagem"></textarea><button type="submit" class="btn btn-danger">Enviar</button></form></div>`, mobilePage);
    if (chatCanModerate) {
      const toolsButton = document.createElement("button");
      toolsButton.className = "small-btn"; toolsButton.type = "button"; toolsButton.textContent = "⚙ Moderação";
      toolsButton.onclick = async () => {
        const current = await sb.from("chat_room_settings").select("slow_mode_seconds").eq("room_id", room.id).maybeSingle();
        const value = await askChatSlowMode(current.data?.slow_mode_seconds || 0);
        if (value !== null) {
          const result = await sb.rpc("set_chat_room_slow_mode", { p_room_id: room.id, p_seconds: Math.max(0, Math.min(300, Number(value) || 0)) });
          if (result.error) toast(result.error.message || "Não foi possível atualizar o slow mode."); else toast("Slow mode atualizado.");
        }
        const history = await sb.rpc("get_chat_moderation_history", { p_room_id: room.id, p_limit: 20 });
        if (!history.error && history.data?.length) {
          const summary = history.data.map(item => `${new Date(item.created_at).toLocaleString("pt-BR")} · ${item.action}${item.duration_until ? ` até ${new Date(item.duration_until).toLocaleString("pt-BR")}` : ""}`).join("\n");
          window.alert(`Histórico de moderação\n\n${summary}`);
        }
      };
      $(".chat-modal-actions", overlay)?.prepend(toolsButton);
    }
    if (isSheriffRoom(room) && ["moderator", "banca", "admin"].includes(state.profile?.plan)) {
      const sheriffButton = document.createElement("button");
      sheriffButton.className = "small-btn";
      sheriffButton.type = "button";
      sheriffButton.textContent = "🤠 Xerife";
      sheriffButton.title = sheriff ? `Xerife atual: @${sheriff.username}` : "Definir xerife";
      sheriffButton.onclick = () => openChatSheriffManager(room);
      $(".chat-modal-actions", overlay)?.prepend(sheriffButton);
    }
    if (room.factionId && ["moderator", "banca", "admin"].includes(state.profile?.plan)) $("#chat-room-compose", overlay)?.remove();
    const pinsRoot = $("[data-chat-pins]", overlay);
    let closed = false;
    let channel = null;
    const close = event => {
      event?.preventDefault();
      event?.stopPropagation();
      if (closed) return;
      closed = true;
      channel?.unsubscribe();
      pinsRoot?._chatPinCleanup?.();
      overlay.remove();
      if (mobilePage) {
        if (state.chatPageCleanup === close) state.chatPageCleanup = null;
        document.body.classList.remove("chat-page-open");
      }
    };
    if (mobilePage) state.chatPageCleanup = close;
    $("[data-close]", overlay)?.addEventListener("click", close);
    $("[data-chat-back]", overlay).onclick = event => { close(event); openChat(); };
    if (!mobilePage) overlay.addEventListener("click", event => {
      if (event.target === overlay) close(event);
    });
    const messagesRoot = $("[data-chat-messages]", overlay);
    const chatInput = $("#chat-room-compose textarea", overlay);
    let chatMessagesById = new Map();
    const resizeChatInput = () => {
      if (!chatInput) return;
      chatInput.style.height = "auto";
      chatInput.style.height = `${chatInput.scrollHeight}px`;
    };
    const renderMessages = async () => {
      const result = await sb.from("chat_messages").select("id, sender_id, body, metadata, created_at, profiles!chat_messages_sender_id_fkey(id, username, avatar_url, title, title_color, plan, faction_id)").eq("room_id", room.id).gt("expires_at", new Date().toISOString()).order("created_at", { ascending: true }).limit(200);
      if (result.error) return messagesRoot.innerHTML = '<div class="empty">Não foi possível carregar as mensagens.</div>';
      const senderVisuals = await loadChatSenderVisuals((result.data || []).map(message => message.sender_id));
      chatMessagesById = new Map((result.data || []).map(message => [String(message.id), { ...message, profile: message.profiles || {} }]));
      messagesRoot.innerHTML = (result.data || []).map(message => chatMessageMarkup(message, message.profiles || {}, senderVisuals.get(message.sender_id), { allowPin: true, canModerate: chatCanModerate, sheriffId: sheriff?.user_id, sheriffIds: factionSheriffIds })).join("") || '<div class="empty">Nenhuma mensagem ainda.</div>';
      hydrateChatTop10Previews(messagesRoot);
      $$('[data-chat-message-id]', messagesRoot).forEach(node => {
        const message = chatMessagesById.get(String(node.dataset.chatMessageId));
        if (!message) return;
        const actions = $(".chat-message-actions", node);
        if (message.sender_id !== state.session?.user?.id) {
          const report = document.createElement("button");
          report.type = "button"; report.className = "chat-report-action"; report.dataset.chatReport = String(message.id); report.textContent = "⚑"; report.title = "Denunciar mensagem";
          actions?.prepend(report);
        }
        if (chatCanModerate && actions) {
          const moderate = document.createElement("button");
          moderate.type = "button"; moderate.className = "chat-report-action"; moderate.dataset.chatUserModerate = String(message.id); moderate.dataset.chatUsername = cleanUsername(message.profiles?.username || "usuario"); moderate.textContent = "⚙"; moderate.title = "Moderar usuário";
          actions.prepend(moderate);
        }
      });
      hydrateChatFactionRoleTitles(messagesRoot);
      updateChatMessageExpansionUI(messagesRoot);
      messagesRoot.scrollTop = messagesRoot.scrollHeight;
      await renderChatPins(pinsRoot, room.id, chatCanModerate);
    };
    await renderMessages();
    channel = sb.channel(`chat-room-${room.id}-${state.session.user.id}`).on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages", filter: `room_id=eq.${room.id}` }, payload => { if (payload.new?.room_id === room.id) renderMessages(); }).on("postgres_changes", { event: "*", schema: "public", table: "chat_pins", filter: `room_id=eq.${room.id}` }, payload => { if (payload.new?.room_id === room.id || payload.old?.room_id === room.id) renderChatPins(pinsRoot, room.id, chatCanModerate); }).subscribe();
    const chatCompose = $("#chat-room-compose", overlay);
    const getReply = setupChatReplyUI({ messagesRoot, compose: chatCompose, input: chatInput, getMessage: id => chatMessagesById.get(String(id)) });
    setupChatMessageExpansionUI(messagesRoot);
    setupChatModerationUI({ messagesRoot, getMessage: id => chatMessagesById.get(String(id)), renderMessages, roomId: room.id, pinsRoot, canModerate: chatCanModerate });
    if (chatCompose) chatCompose.onsubmit = async event => {
      event.preventDefault();
      const composeForm = event.currentTarget;
      const form = new FormData(composeForm);
      const prepared = prepareChatMessage(String(form.get("body") || "").trim());
      const body = prepared.body;
      const reply = getReply();
      const button = $("button[type=submit]", composeForm);
      if (!body || button.disabled) return;
      button.disabled = true;
      // Use the database expiry default so device clock skew cannot violate RLS.
      const result = await sb.from("chat_messages").insert({ sender_id: state.session.user.id, room_id: room.id, recipient_id: null, body, metadata: { ...prepared.metadata, ...(reply ? { reply_to: reply } : {}) } }).select("id").single();
      if (result.error) { console.error("[chat room] erro ao enviar mensagem", result.error); toast(result.error.message || "Não foi possível enviar a mensagem."); }
      else {
        if (/@guria\b/i.test(body) && result.data?.id) sb.functions.invoke("guria-chat", { body: { message_id: result.data.id } }).catch(error => console.warn("[guria] menção pública indisponível", error?.message || error)); composeForm.reset(); getReply.clear(); await renderMessages();
      }
      button.disabled = false;
    };
    chatInput?.addEventListener("keydown", event => {
      if (event.key !== "Enter" || event.shiftKey || event.isComposing) return;
      event.preventDefault();
      chatCompose?.requestSubmit();
    });
  }

  async function openChat(contact = null) {
    const mobilePage = usesMobileChatPage();
    discardActiveMobileChatPage();
    removeLegacyChatScrollControls();
    $$('.notifications-popup-modal').forEach(modal => modal.closest('.modal-backdrop')?.remove());
    $$('.chat-modal').forEach(modal => modal.closest('.modal-backdrop')?.remove());
    if (!state.session || !sb) return openAuthPage();
    if (contact?.id === state.session.user.id) return toast("Você não pode enviar mensagens para si mesmo.");
    if (contact?.id && contact.allow_messages === false) return toast("Este usuário não está recebendo mensagens privadas.");
    if (contact?.id && (contact.allow_messages === undefined || contact.is_bot === undefined || contact.is_official === undefined)) {
      const recipient = await sb.from("profiles_public").select("allow_messages, is_bot, is_official, bot_type").eq("id", contact.id).maybeSingle();
      if (recipient.data) contact = { ...contact, ...recipient.data };
      if (recipient.data?.allow_messages === false) return toast("Este usuário não está recebendo mensagens privadas.");
    }
    state.chatContact = contact?.id ? contact : null;
    if (contact?.id) {
      state.notifications = state.notifications.filter(notification => !isNotificationFromOpenChat(notification));
      state.notificationUnreadCount = state.notifications.filter(notification => !notification.read_at).length;
    }
    if (contact?.id) await markChatNotificationsRead(contact.id);
    await loadNotifications();
    if (mobilePage) prepareMobileChatPage();
    else render();
    const chatHeaderActions = mobilePage
      ? (contact ? '<button class="small-btn" type="button" data-chat-back>Voltar</button>' : '<button class="small-btn" type="button" data-close>Voltar</button>')
      : `${contact ? '<button class="small-btn" type="button" data-chat-back>Voltar</button>' : ""}<button class="small-btn" data-close>Fechar</button>`;
    const overlay = mountChatSurface(`<div class="modal chat-modal${contact ? " chat-conversation-modal" : ""}${mobilePage ? " chat-page" : ""}"><div class="section-head"><div><h2>Mensagens</h2><div class="section-subtitle">As mensagens desaparecem após 24 horas.</div></div><div class="chat-modal-actions">${chatHeaderActions}</div></div><div class="chat-contact-picker">${contact ? `<div class="chat-contact-selected">Conversando com <b>@${escapeHTML(contact.username)} ${officialAiBadge(contact)}</b>${contact.is_bot ? '<small>Mensagens para a IA podem passar por moderação automatizada.</small>' : ''}</div>` : `<form id="chat-contact-form"><input name="username" required placeholder="Nome de usuário"><button type="submit" class="small-btn">Abrir conversa</button></form>`}</div>${contact ? `<div class="chat-messages" data-chat-messages><div class="empty">Carregando mensagens...</div></div><form class="chat-compose" id="chat-compose"><textarea name="body" maxlength="2000" rows="2" required placeholder="Escreva uma mensagem"></textarea><button type="submit" class="btn btn-danger">Enviar</button></form>` : `<div class="notice">Abra o perfil de um usuário e clique em “Enviar mensagem”, ou pesquise o nome de usuário acima.</div><div class="chat-private-list" data-private-chat-list hidden></div>`}</div>`, mobilePage);
    let channel = null;
    let closed = false;
    const teardown = () => {
      if (closed) return;
      closed = true;
      state.chatContact = null;
      channel?.unsubscribe();
      overlay.remove();
      if (mobilePage) {
        if (state.chatPageCleanup === teardown) state.chatPageCleanup = null;
        document.body.classList.remove("chat-page-open");
      }
    };
    const close = event => {
      event?.preventDefault();
      event?.stopPropagation();
      teardown();
      if (mobilePage) restoreChatReturnSection();
      else loadNotifications().then(() => render());
    };
    if (mobilePage) state.chatPageCleanup = teardown;
    $("[data-close]", overlay)?.addEventListener("click", close);
    $("[data-chat-back]", overlay)?.addEventListener("click", event => { event.preventDefault(); event.stopPropagation(); teardown(); openChat(); });
    if (!mobilePage) overlay.addEventListener("click", event => {
      if (event.target === overlay) close(event);
    });
    if (contact) {
      const headerTitle = $(".section-head h2", overlay);
      const selectedContact = $(".chat-contact-selected", overlay);
      if (headerTitle) headerTitle.textContent = `@${contact.username}`;
      if (selectedContact) selectedContact.hidden = true;
    }
    if (!contact) {
      // O formulário fica visível antes do carregamento das conversas recentes.
      // Vincule o submit imediatamente para impedir que Enter faça o envio HTML
      // padrão e recarregue a Banca enquanto as consultas abaixo ainda aguardam.
      const contactForm = $("#chat-contact-form", overlay);
      if (contactForm) contactForm.onsubmit = async event => {
        event.preventDefault();
        event.stopPropagation();
        const username = String(new FormData(event.currentTarget).get("username") || "").trim();
        if (!username) return;
        const submitButton = $("button[type=submit]", event.currentTarget);
        if (submitButton?.disabled) return;
        if (submitButton) submitButton.disabled = true;
        const result = await sb.from("profiles_public").select("id, username, avatar_url, title, allow_messages, is_bot, is_official, bot_type").ilike("username", username).maybeSingle();
        if (submitButton) submitButton.disabled = false;
        if (result.error || !result.data) return toast("Usuário não encontrado.");
        if (result.data.allow_messages === false) return toast("Este usuário não está recebendo mensagens privadas.");
        teardown();
        openChat(result.data);
      };
      const availableRooms = CHAT_ROOMS.filter(canOpenChatRoom);
      $(".chat-contact-picker", overlay).insertAdjacentHTML("afterbegin", `<div class="chat-room-list"><div class="chat-room-list-title">Salas de conversa</div>${availableRooms.map(room => { const unread = state.chatRoomUnreadCounts?.[room.id] || 0; return `<button type="button" class="chat-room-option" data-chat-room="${escapeHTML(room.id)}"><span>${escapeHTML(room.name)}</span>${unread ? `<span class="message-badge" aria-label="${unread} marcação(ões) não lida(s)">${unread > 99 ? "99+" : unread}</span>` : ""}<small>${chatRoomLabel(room)}</small></button>`; }).join("")}</div>`);
      $('[data-chat-room]', overlay).forEach(button => button.onclick = () => { teardown(); openChatRoom(CHAT_ROOMS.find(room => room.id === button.dataset.chatRoom)); });
      const privateChatList = $("[data-private-chat-list]", overlay);
      const privateMessages = await sb.from("chat_messages")
        .select("id, sender_id, recipient_id, body, created_at")
        .or(`sender_id.eq.${state.session.user.id},recipient_id.eq.${state.session.user.id}`)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(500);
      const conversations = new Map();
      (privateMessages.data || []).forEach(message => {
        const incoming = String(message.recipient_id) === String(state.session.user.id);
        const contactId = incoming ? message.sender_id : message.recipient_id;
        if (!contactId) return;
        const conversation = conversations.get(contactId) || { latest: message, hasIncoming: false };
        conversation.hasIncoming ||= incoming;
        if (new Date(message.created_at) > new Date(conversation.latest.created_at)) conversation.latest = message;
        conversations.set(contactId, conversation);
      });
      const contactIds = [...conversations.keys()];
      if (contactIds.length) {
        const profilesResult = await sb.from("profiles_public").select("id, username, avatar_url, title, title_color, allow_messages, is_bot, is_official, bot_type").in("id", contactIds);
        const profiles = new Map((profilesResult.data || []).map(profile => [profile.id, profile]));
        const cards = contactIds.map(contactId => {
          const profile = profiles.get(contactId);
          const conversation = conversations.get(contactId);
          if (!profile || !conversation) return "";
          return `<button type="button" class="chat-private-card" data-private-chat-user="${escapeHTML(profile.id)}">${avatarMarkup(profile, "chat-private-card-avatar")}<span class="chat-private-card-copy"><b>${factionDot(profile)}@${escapeHTML(profile.username)}</b><small>${escapeHTML(conversation.latest.body.slice(0, 100))}</small></span><time>${escapeHTML(formatCommentDate(conversation.latest.created_at))}</time></button>`;
        }).join("");
        if (cards) {
          privateChatList.hidden = false;
          privateChatList.innerHTML = `<div class="chat-room-list-title">Conversas recentes</div><div class="chat-private-card-list">${cards}</div>`;
          $$('[data-private-chat-user]', privateChatList).forEach(button => button.onclick = () => {
            const contact = profiles.get(button.dataset.privateChatUser);
            if (!contact) return;
            teardown();
            openChat(contact);
          });
        }
      }
      return;
    }
    const messagesRoot = $("[data-chat-messages]", overlay);
    let chatMessagesById = new Map();
    const renderMessages = async () => {
      const now = new Date().toISOString();
      const result = await sb.from("chat_messages").select("id, sender_id, body, metadata, created_at").or(`and(sender_id.eq.${state.session.user.id},recipient_id.eq.${contact.id}),and(sender_id.eq.${contact.id},recipient_id.eq.${state.session.user.id})`).gt("expires_at", now).order("created_at", { ascending: true }).limit(200);
      if (result.error) return messagesRoot.innerHTML = '<div class="empty">Não foi possível carregar as mensagens.</div>';
      const senderIds = [...new Set((result.data || []).map(message => message.sender_id).filter(Boolean))];
      const profilesResult = senderIds.length ? await sb.from("profiles_public").select("id, username, avatar_url, title, title_color, plan, faction_id, is_bot, is_official, bot_type").in("id", senderIds) : { data: [] };
      const profilesById = new Map((profilesResult.data || []).map(profile => [profile.id, profile]));
      const senderVisuals = await loadChatSenderVisuals(senderIds);
      chatMessagesById = new Map((result.data || []).map(message => [String(message.id), { ...message, profile: profilesById.get(message.sender_id) || {} }]));
      messagesRoot.innerHTML = (result.data || []).map(message => chatMessageMarkup(message, profilesById.get(message.sender_id) || (message.sender_id === state.session.user.id ? state.profile : {}), senderVisuals.get(message.sender_id))).join("") || '<div class="empty">Nenhuma mensagem ainda.</div>';
      hydrateChatTop10Previews(messagesRoot);
      hydrateChatFactionRoleTitles(messagesRoot);
      updateChatMessageExpansionUI(messagesRoot);
      messagesRoot.scrollTop = messagesRoot.scrollHeight;
    };
    await renderMessages();
    channel = sb.channel(`chat-${state.session.user.id}-${contact.id}`).on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages", filter: `recipient_id=eq.${state.session.user.id}` }, payload => { if (payload.new?.sender_id === contact.id) renderMessages(); }).subscribe();
    const chatCompose = $("#chat-compose", overlay);
    const chatInput = $("#chat-compose textarea", overlay);
    const getReply = setupChatReplyUI({ messagesRoot, compose: chatCompose, input: chatInput, getMessage: id => chatMessagesById.get(String(id)) });
    setupChatMessageExpansionUI(messagesRoot);
    setupChatModerationUI({ messagesRoot, getMessage: id => chatMessagesById.get(String(id)), renderMessages });
    chatCompose.onsubmit = async event => {
      event.preventDefault();
      const composeForm = event.currentTarget;
      const form = new FormData(event.currentTarget);
      const prepared = prepareChatMessage(String(form.get("body") || "").trim());
      const body = prepared.body;
      const reply = getReply();
      if (!body) return;
      const submitButton = $("button[type=submit]", event.currentTarget);
      if (!submitButton || submitButton.disabled) return;
      submitButton.disabled = true;
      const optimisticId = `chat-pending-${Date.now()}`;
      messagesRoot.insertAdjacentHTML("beforeend", `<div class="chat-message is-mine chat-message-pending" data-chat-pending="${optimisticId}"><div>${escapeHTML(body)}</div><small>Enviando…</small></div>`);
      event.currentTarget.reset();
      messagesRoot.scrollTop = messagesRoot.scrollHeight;
      // Use the database expiry default so device clock skew cannot violate RLS.
      const result = await sb.from("chat_messages").insert({ sender_id: state.session.user.id, recipient_id: contact.id, body, metadata: { ...prepared.metadata, ...(reply ? { reply_to: reply } : {}) } }).select("id").single();
      if (result.error) {
        $(`[data-chat-pending="${optimisticId}"]`, messagesRoot)?.remove();
        submitButton.disabled = false;
        const input = composeForm.querySelector("textarea");
        if (input && !input.value) input.value = String(form.get("body") || "");
        console.error("[private chat] erro ao enviar mensagem", result.error);
        return toast(result.error.message || "Não foi possível enviar a mensagem.");
      }
      if (contact.is_bot && contact.is_official && result.data?.id) {
        sb.functions.invoke("guria-chat", { body: { message_id: result.data.id } }).catch(error => console.warn("[guria] resposta assíncrona indisponível", error?.message || error));
      }
      await renderMessages();
      getReply.clear();
      submitButton.disabled = false;
    };
    $("#chat-compose textarea", overlay)?.addEventListener("keydown", event => {
      if (event.key !== "Enter" || event.shiftKey || event.isComposing) return;
      event.preventDefault();
      $("#chat-compose", overlay)?.requestSubmit();
    });
  }

  return { openChat, openChatRoom };
}
