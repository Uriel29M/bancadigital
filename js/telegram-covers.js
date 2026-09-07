/* Telegram cover links are registered by the administrator and served without exposing the bot token. */
window.BancaTelegramCovers = (() => {
  const endpoint = () => `${window.BANCA_SUPABASE_URL || ''}/functions/v1/telegram-cover`;
  const normalized = value => window.BancaTelegram?.normalized(value) || '';
  const isPost = value => Boolean(normalized(value));
  const publicUrl = value => {
    const source = normalized(value);
    if (!source || !window.BANCA_SUPABASE_URL) return String(value || '');
    const url = new URL(endpoint());
    url.searchParams.set('url', source);
    return url.toString();
  };
  async function resolve(value, client) {
    const source = normalized(value);
    if (!source) throw new Error('Cole o link completo da imagem no Telegram.');
    if (!client) throw new Error('Entre como administrador para identificar a capa.');
    const { data, error } = await client.functions.invoke('telegram-cover', { body: { url: source } });
    if (error || data?.error) {
      let message = data?.error || '';
      if (!message && error?.context?.json) {
        try { message = (await error.context.json()).error || ''; } catch {}
      }
      throw new Error(message || error?.message || 'Não foi possível identificar a imagem.');
    }
    if (!data?.url || normalized(data.sourceUrl) !== source || !['image/jpeg', 'image/png', 'image/webp'].includes(data.mimeType)) throw new Error('O Telegram não confirmou uma imagem válida.');
    return data;
  }
  function bindEditor(form, client) {
    const fields = ['coverUrl', 'featuredCoverUrl'];
    const pending = new Map();
    const resolved = new Map();
    let generation = 0;
    function field(name) { return form.elements[name]; }
    function status(name) { return form.querySelector(`[data-telegram-cover-status="${name}"]`); }
    function show(name, message) { const node = status(name); if (node) node.textContent = message; }
    async function identify(name, value = field(name)?.value || '') {
      const source = normalized(value);
      if (!source) throw new Error('Cole uma postagem de imagem válida.');
      if (resolved.get(name)?.sourceUrl === source) return resolved.get(name);
      const previous = pending.get(name);
      if (previous?.source === source) return previous.promise;
      const current = generation;
      show(name, 'Identificando imagem pelo bot…');
      const button = form.querySelector(`[data-resolve-telegram-cover="${name}"]`);
      if (button) button.disabled = true;
      const promise = resolve(source, client).then(data => {
        if (generation !== current || normalized(field(name)?.value) !== source) throw new Error('O link da capa mudou durante a identificação.');
        resolved.set(name, data);
        show(name, `Imagem identificada · ${data.fileSize ? (data.fileSize / 1048576).toFixed(1) + ' MB' : 'tamanho desconhecido'}`);
        return data;
      }).catch(error => { if (generation === current) show(name, error.message || 'Falha ao identificar imagem.'); throw error; }).finally(() => {
        if (pending.get(name)?.promise === promise) pending.delete(name);
        if (button) button.disabled = false;
      });
      pending.set(name, { source, promise });
      return promise;
    }
    for (const name of fields) {
      const input = field(name);
      if (!input) continue;
      input.addEventListener('input', () => { generation++; resolved.delete(name); show(name, isPost(input.value) ? 'A imagem será identificada ao salvar.' : ''); });
      input.addEventListener('blur', () => { if (isPost(input.value)) void identify(name).catch(() => {}); });
      const button = form.querySelector(`[data-resolve-telegram-cover="${name}"]`);
      button?.addEventListener('click', () => { void identify(name).catch(() => {}); });
    }
    return {
      async forSave(item, values) {
        const changes = {};
        for (const name of fields) {
          const value = String(values[name] || '').trim();
          if (!isPost(value)) continue;
          const data = await identify(name, value);
          if (normalized(field(name)?.value) !== normalized(value)) throw new Error('O link da capa mudou durante a identificação.');
          changes[name] = data.sourceUrl;
        }
        return { ...item, ...changes };
      }
    };
  }
  return { normalized, isPost, publicUrl, resolve, bindEditor };
})();
