function proxiedFileUrl(url) {
    const source = directGoogleDriveUrl(url);
    let parsed;
    try { parsed = new URL(source); } catch { return source; }
    const host = parsed.hostname.toLowerCase();
    const isMediaFire = parsed.protocol === "https:" && (
      host === "mediafire.com" ||
      host === "www.mediafire.com" ||
      /^download\d+\.mediafire\.com$/.test(host)
    );
    const isMega = parsed.protocol === "https:" && (host === "mega.nz" || host === "www.mega.nz") && parsed.pathname.startsWith("/file/");
    const isGoogleDrive = parsed.protocol === "https:" && host === "drive.usercontent.google.com";
    if ((!isMediaFire && !isMega && !isGoogleDrive) || !window.BANCA_SUPABASE_URL) return source;
    const proxyName = isGoogleDrive ? "drive-proxy" : isMega ? "mega-proxy" : "mediafire-proxy";
    const proxy = new URL(`${window.BANCA_SUPABASE_URL}/functions/v1/${proxyName}`);
    proxy.searchParams.set("url", source);
    return proxy.toString();
  }