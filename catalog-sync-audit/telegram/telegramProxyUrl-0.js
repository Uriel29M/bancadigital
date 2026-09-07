function telegramProxyUrl(item) {
    const postUrl = String(item?.telegramUrl || "").trim();
    const fileId = String(item?.telegramFileId || "").trim();
    if (!isTelegramPostUrl(postUrl) || !fileId || !window.BANCA_SUPABASE_URL) return "";
    const proxy = new URL(`${window.BANCA_SUPABASE_URL}/functions/v1/telegram-proxy`);
    proxy.searchParams.set("file_id", fileId);
    return proxy.toString();
  }