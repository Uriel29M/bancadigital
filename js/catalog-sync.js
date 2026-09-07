/* Shared edition records are authoritative over browser and static catalog caches. */
window.BancaCatalogSync = (() => {
  const table = "catalog_edition_overrides";
  const fields = ["coverUrl", "cover", "featuredCoverUrl", "fileUrl", "telegramUrl", "telegramFileId", "backupUrls", "format"];
  const rows = new Map();
  const pending = new Set();
  let channel = null;
  let timer = null;
  let refreshing = null;
  const valid = row => row && row.edition && typeof row.edition === "object" && String(row.edition.id) === String(row.item_id);
  function applyEdition(item, edition) {
    if (!edition || !item) return item;
    const merged = { ...item, ...edition };
    // A source deliberately cleared by an administrator must stay cleared.
    for (const field of fields) {
      if (Object.prototype.hasOwnProperty.call(edition, field)) merged[field] = edition[field];
      else delete merged[field];
    }
    return merged;
  }
  function merge(library, incoming = rows) {
    const result = (library || []).map(item => {
      const record = incoming.get(String(item.id));
      return record && !pending.has(String(item.id)) ? applyEdition(item, record.edition) : item;
    });
    const known = new Set(result.map(item => String(item.id)));
    for (const [id, record] of incoming) {
      if (!known.has(id) && !pending.has(id) && valid(record)) result.push({ ...record.edition });
    }
    return result;
  }
  function accept(incoming) {
    for (const row of incoming || []) {
      if (!valid(row)) continue;
      const id = String(row.item_id);
      if (pending.has(id)) continue;
      const previous = rows.get(id);
      if (!previous || String(row.updated_at || "") >= String(previous.updated_at || "")) rows.set(id, row);
    }
  }
  async function read(client) {
    if (!client || (typeof navigator !== "undefined" && navigator.onLine === false)) return [];
    const result = await client.from(table).select("item_id,edition,updated_at").order("item_id").limit(10000);
    if (result.error) throw result.error;
    accept(result.data || []);
    return result.data || [];
  }
  async function publish(client, edition, userId) {
    if (!client || !userId || !edition?.id) throw new Error("Sessão de administrador necessária.");
    const id = String(edition.id);
    pending.add(id);
    try {
      const result = await client.from(table).upsert({ item_id: id, edition: { ...edition }, updated_by: userId }, { onConflict: "item_id" }).select("item_id,edition,updated_at").single();
      if (result.error) throw result.error;
      if (!valid(result.data)) throw new Error("O banco não confirmou a edição publicada.");
      rows.set(id, result.data);
      return result.data;
    } finally {
      pending.delete(id);
    }
  }
  function start(client, refresh) {
    if (!client || channel) return;
    channel = client.channel("banca-catalog-editions").on("postgres_changes", { event: "*", schema: "public", table }, () => { refresh().catch(error => console.warn("Atualização do catálogo indisponível:", error)); }).subscribe();
    if (typeof window !== "undefined") {
      window.addEventListener("focus", () => { refresh().catch(() => {}); });
      window.addEventListener("online", () => { refresh().catch(() => {}); });
      document.addEventListener("visibilitychange", () => { if (!document.hidden) refresh().catch(() => {}); });
      timer = window.setInterval(() => { if (!document.hidden && navigator.onLine !== false) refresh().catch(() => {}); }, 60000);
    }
  }
  return { fields, rows, pending, merge, accept, read, publish, start, applyEdition };
})();
