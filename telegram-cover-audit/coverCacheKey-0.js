
  function coverCacheKey(item, maxWidth) {
    return `banca-cover:v3:${maxWidth}:${item.id}:${item.fileUrl || item.telegramUrl || ""}`;
  }
