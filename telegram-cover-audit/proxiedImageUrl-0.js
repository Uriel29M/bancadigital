
  function proxiedImageUrl(url) {
    const legacyCoverUrls = {
      "https://storage.googleapis.com/hipcomic/p/622e297bf53964d785dedfd21b923bb4-800.jpg": "https://www.comicsbox.it/cover/SHWRALPHA_001C.jpg",
      "https://dcuguide.com/Special:FilePath/Shadow_War_Alpha_1_%28Cover_B%29.png": "https://www.comicsbox.it/cover/SHWRALPHA_001B.jpg",
      "https://storage.googleapis.com/hipcomic/p/b683dbd84fe7e1f28c831ec91e6e6d22-800.jpg": "https://www.comicsbox.it/cover_dc/BATMAN3_122C.jpg",
      "https://dcuguide.com/Special:FilePath/Shadow_War_Omega_1_%28Cover_B%29.png": "https://www.comicsbox.it/cover_dc/SHWROMEGA_001B.jpg",
      "https://dcuguide.com/Special:FilePath/Shadow_War_Omega_1_%28Cover_C%29.png": "https://www.comicsbox.it/cover_dc/SHWROMEGA_001C.jpg",
    };
    const rawSource = String(url || "").trim();
    const source = legacyCoverUrls[rawSource] || rawSource;
    if (!window.BANCA_SUPABASE_URL || !/^https:\/\/(?:i\.imgur\.com|(?:www\.)?imgur\.com|zonafantasmanet\.files\.wordpress\.com|static\.dc\.com|image\.keycollectorcomics\.com)\//i.test(source)) return source;
    const proxy = new URL(`${window.BANCA_SUPABASE_URL}/functions/v1/image-proxy`);
    proxy.searchParams.set("url", source);
    proxy.searchParams.set("v", "3");
    return proxy.toString();
  }
