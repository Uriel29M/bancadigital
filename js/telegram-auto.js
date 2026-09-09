/* Telegram metadata only. The document remains on Telegram. */
window.BancaTelegram = (() => {
  const supported = new Set(['pdf', 'cbz', 'cbr']);
  const normalized = value => {
    try {
      const url = new URL(String(value || '').trim());
      if (url.protocol !== 'https:' || !['t.me', 'telegram.me', 'www.t.me', 'www.telegram.me'].includes(url.hostname) || url.username || url.password || url.port) return '';
      const parts = url.pathname.split('/').filter(Boolean);
      if (parts[0] === 'c' && parts.length === 3 && /^\d+$/.test(parts[1]) && /^\d+$/.test(parts[2])) return `https://t.me/c/${parts[1]}/${parts[2]}`;
      if (parts.length === 2 && /^[A-Za-z][A-Za-z0-9_]{3,31}$/.test(parts[0]) && /^\d+$/.test(parts[1])) return `https://t.me/${parts[0].toLowerCase()}/${parts[1]}`;
    } catch {}
    return '';
  };
  const samePost = (a, b) => Boolean(normalized(a) && normalized(a) === normalized(b));
  async function resolve(url, client) {
    if (!normalized(url)) throw new Error('Cole o link completo de uma postagem do Telegram.');
    if (!client) throw new Error('Entre como administrador para identificar o arquivo.');
    const { data, error } = await client.functions.invoke('telegram-resolver', { body: { url } });
    if (error || data?.error) {
      let message = data?.error || '';
      if (!message && error?.context?.json) {
        try { message = (await error.context.json()).error || ''; } catch {}
      }
      throw new Error(message || error?.message || 'Não foi possível identificar o arquivo pelo bot.');
    }
    if (!data?.telegramFileId || !supported.has(data.format) || !samePost(url, data.telegramUrl)) throw new Error('O Telegram não confirmou um documento válido para essa postagem.');
    return { ...data, telegramUrl: normalized(url) };
  }
  function apply(item, metadata) {
    return { ...item, telegramUrl: metadata.telegramUrl, telegramFileId: metadata.telegramFileId,
      telegramFileName: metadata.telegramFileName || '', telegramFileSize: Number(metadata.telegramFileSize || 0),
      format: metadata.format, fileUrl: '' };
  }
  async function published(item, client) {
    if (!item?.id || !client || !normalized(item.telegramUrl)) return item;
    const { data, error } = await client.from('catalog_edition_overrides').select('item_id,edition,updated_at').eq('item_id', String(item.id)).maybeSingle();
    if (error) throw error;
    if (!data?.edition) return item;
    if (String(data.edition.id) !== String(item.id)) throw new Error('O cadastro compartilhado está inconsistente.');
    const merged = { ...item, ...data.edition, catalogEditedAt: data.updated_at };
    const fields = ['fileUrl', 'telegramUrl', 'telegramFileId', 'telegramFileName', 'telegramFileSize', 'format'];
    for (const field of fields) {
      if (Object.prototype.hasOwnProperty.call(data.edition, field)) merged[field] = data.edition[field];
      else delete merged[field];
    }
    if (window.BancaCatalogSync?.rows) window.BancaCatalogSync.rows.set(String(item.id), data);
    return merged;
  }
  function proxyUrl(item) {
    const post = normalized(item?.telegramUrl);
    if (!post || !window.BANCA_SUPABASE_URL) return '';
    const proxy = new URL(`${window.BANCA_SUPABASE_URL}/functions/v1/telegram-mtproto`);
    if (!item.id || !item.telegramFileId) return '';
    proxy.searchParams.set('item_id', String(item.id));
    return proxy.toString();
  }
  function bindEditor(form, client, initial = {}) {
    const source = form.elements.sourceUrl;
    const format = form.elements.format;
    const id = form.elements.telegramFileId;
    const status = form.querySelector('[data-telegram-status]');
    const button = form.querySelector('[data-resolve-telegram]');
    let resolved = null;
    let pending = null;
    let generation = 0;
    const setStatus = message => { if (status) status.textContent = message; };
    const identify = async (url = source.value) => {
      const post = normalized(url);
      if (!post) throw new Error('Cole uma postagem válida do Telegram.');
      if (resolved && samePost(post, resolved.telegramUrl)) return resolved;
      if (pending && pending.post === post) return pending.promise;
      const current = generation;
      setStatus('Identificando documento pelo bot…');
      if (button) button.disabled = true;
      const promise = resolve(post, client).then(metadata => {
        if (current !== generation || !samePost(source.value, post)) throw new Error('O link mudou durante a identificação. Confira a postagem e tente novamente.');
        resolved = metadata;
        id.value = metadata.telegramFileId;
        format.value = metadata.format;
        const preview = form.querySelector('[data-format-preview]');
        if (preview) preview.textContent = metadata.format.toUpperCase();
        setStatus(`${metadata.telegramFileName} · ${metadata.telegramFileSize ? (metadata.telegramFileSize / 1048576).toFixed(1) + ' MB' : 'tamanho desconhecido'}${metadata.warning ? ' — ' + metadata.warning : ' — Pronto para salvar.'}`);
        return metadata;
      }).catch(error => {
        if (current === generation) setStatus(error.message || 'Não foi possível identificar o arquivo.');
        throw error;
      }).finally(() => {
        if (pending?.promise === promise) pending = null;
        if (button) button.disabled = false;
      });
      pending = { post, promise };
      return promise;
    };
    source.addEventListener('input', () => {
      generation++;
      resolved = null;
      id.value = '';
      setStatus(normalized(source.value) ? 'O arquivo será identificado automaticamente ao salvar.' : '');
    });
    source.addEventListener('blur', () => { if (normalized(source.value)) void identify().catch(() => {}); });
    if (button) button.addEventListener('click', () => { void identify().catch(() => {}); });
    return {
      async forSave(item, url) {
        if (!normalized(url)) return item;
        const metadata = await identify(url);
        if (!samePost(source.value, url)) throw new Error('O link mudou durante a identificação. Confira a postagem e tente novamente.');
        return apply(item, metadata);
      }
    };
  }
  return { normalized, samePost, resolve, apply, published, proxyUrl, bindEditor };
})();
