function detectFormat(url = "") {
    const clean = String(url).split("?")[0].split("#")[0].toLowerCase();
    return clean.match(/\.(pdf|cbz|cbr|jpg|jpeg|png|webp|gif)$/)?.[1] || "auto";
  }