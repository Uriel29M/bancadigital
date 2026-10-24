/* Converts one edition into ordered JPEG photos in Telegram and exposes the page reader URL. */
(() => {
  "use strict";
  const MAX_PHOTO_BYTES = 9.5 * 1024 * 1024;
  const pause = ms => new Promise(resolve => window.setTimeout(resolve, ms));
  const text = value => String(value == null ? "" : value);
  const extension = value => {
    try {
      const pathname = new URL(text(value), document.baseURI).pathname;
      return (pathname.match(/\.([a-z0-9]+)$/i)?.[1] || "").toLowerCase();
    } catch {
      return (text(value).split("?")[0].match(/\.([a-z0-9]+)$/i)?.[1] || "").toLowerCase();
    }
  };
  function imageUrl(itemId, pageNumber) {
    const base = String(window.BANCA_SUPABASE_URL || "").replace(/\/+$/, "");
    if (!base || !itemId || !Number.isSafeInteger(Number(pageNumber)) || Number(pageNumber) < 1) return "";
    const url = new URL(base + "/functions/v1/telegram-page-image");
    url.searchParams.set("item_id", String(itemId));
    url.searchParams.set("page", String(pageNumber));
    return url.toString();
  }
  async function invoke(client, payload, formData = false) {
    const result = await client.functions.invoke("telegram-page-migration", { body: payload });
    if (result.error || result.data?.error) {
      let message = result.data?.error || result.error?.message || "Não foi possível acessar o serviço do Telegram.";
      const context = result.error?.context;
      if (context?.clone) {
        try {
          const parsed = await context.clone().json();
          if (parsed?.error) message = parsed.error;
        } catch {}
      }
      throw new Error(message);
    }
    return result.data;
  }
  function canvasBlob(canvas, quality) {
    return new Promise((resolve, reject) => canvas.toBlob(blob => {
      if (blob) resolve(blob);
      else reject(new Error("O navegador não conseguiu converter uma página para JPEG."));
    }, "image/jpeg", quality));
  }
  async function canvasToJpeg(canvas) {
    let quality = 0.94;
    let blob = await canvasBlob(canvas, quality);
    while (blob.size > MAX_PHOTO_BYTES && quality > 0.66) {
      quality = Math.max(0.66, quality - 0.07);
      blob = await canvasBlob(canvas, quality);
    }
    while (blob.size > MAX_PHOTO_BYTES && Math.max(canvas.width, canvas.height) > 640) {
      const old = document.createElement("canvas");
      old.width = canvas.width;
      old.height = canvas.height;
      old.getContext("2d").drawImage(canvas, 0, 0);
      const scale = Math.max(0.65, Math.min(0.86, 2100 / Math.max(canvas.width, canvas.height)));
      canvas.width = Math.max(1, Math.floor(old.width * scale));
      canvas.height = Math.max(1, Math.floor(old.height * scale));
      const ctx = canvas.getContext("2d", { alpha: false });
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(old, 0, 0, canvas.width, canvas.height);
      blob = await canvasBlob(canvas, 0.82);
    }
    if (blob.size > MAX_PHOTO_BYTES) throw new Error("Uma página ficou maior que o limite de 10 MB do Telegram, mesmo após a compressão.");
    return blob;
  }
  async function imageBlobToJpeg(blob) {
    let bitmap;
    try {
      bitmap = await createImageBitmap(blob);
      const maxSide = 2400;
      const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const ctx = canvas.getContext("2d", { alpha: false });
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const result = await canvasToJpeg(canvas);
      canvas.width = canvas.height = 0;
      return result;
    } catch (error) {
      throw new Error("Não foi possível converter uma imagem da edição para JPEG: " + (error?.message || error));
    } finally {
      bitmap?.close?.();
    }
  }
  async function preparePdf(buffer, deps, status) {
    await deps.ensureReaderDependency("pdf");
    const pdfjs = await window.pdfjsReady;
    if (!pdfjs?.getDocument) throw new Error("PDF.js não está disponível para converter esta edição.");
    const pdf = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise;
    return {
      count: pdf.numPages,
      getPage: async pageNumber => {
        status("Convertendo página " + pageNumber + "/" + pdf.numPages + " para JPEG…");
        const page = await pdf.getPage(pageNumber);
        const initial = page.getViewport({ scale: 1 });
        const scale = Math.min(2, 2400 / Math.max(initial.width, initial.height));
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement("canvas");
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        const context = canvas.getContext("2d", { alpha: false });
        context.fillStyle = "#fff";
        context.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvasContext: context, viewport }).promise;
        const blob = await canvasToJpeg(canvas);
        canvas.width = canvas.height = 0;
        page.cleanup?.();
        return blob;
      },
      close: () => pdf.destroy(),
    };
  }
  async function prepareCbz(buffer, deps, status) {
    await deps.ensureReaderDependency("cbz");
    const Zip = await window.jszipReady;
    if (!Zip?.loadAsync) throw new Error("O leitor de CBZ não está disponível.");
    const zip = await Zip.loadAsync(buffer);
    const names = Object.keys(zip.files)
      .filter(name => !zip.files[name].dir && /\.(jpe?g|png|webp|gif)$/i.test(name))
      .sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true }));
    if (!names.length) throw new Error("O CBZ não contém páginas de imagem compatíveis.");
    return {
      count: names.length,
      getPage: async pageNumber => {
        status("Convertendo imagem " + pageNumber + "/" + names.length + " para JPEG…");
        return imageBlobToJpeg(await zip.files[names[pageNumber - 1]].async("blob"));
      },
      close: () => {},
    };
  }
  async function prepareCbr(buffer, deps, status) {
    await deps.ensureReaderDependency("cbr");
    const module = await deps.loadLibarchiveModule();
    const Archive = module?.Archive;
    if (!Archive) throw new Error("O leitor de CBR não está disponível.");
    Archive.init({ workerUrl: deps.appAssetUrl("libarchive/worker-bundle.js") });
    const archive = await Archive.open(new File([buffer], "edition.cbr"));
    const images = [];
    const collect = (entries, prefix = "") => {
      for (const [key, value] of Object.entries(entries || {})) {
        const path = prefix + key;
        if (typeof value?.extract === "function") {
          if (/\.(jpe?g|png|webp|gif)$/i.test(value.name || key)) images.push({ path, value });
        } else if (value && typeof value === "object") collect(value, path + "/");
      }
    };
    collect(await archive.getFilesObject());
    images.sort((a, b) => a.path.localeCompare(b.path, "pt-BR", { numeric: true }));
    if (!images.length) {
      await archive.close?.();
      throw new Error("O CBR não contém páginas de imagem compatíveis.");
    }
    return {
      count: images.length,
      getPage: async pageNumber => {
        status("Convertendo imagem " + pageNumber + "/" + images.length + " para JPEG…");
        return imageBlobToJpeg(await images[pageNumber - 1].value.extract());
      },
      close: () => archive.close?.(),
    };
  }
  async function prepareImage(buffer, source, deps, status) {
    const blob = new Blob([buffer]);
    return {
      count: 1,
      getPage: async () => {
        status("Convertendo a imagem para JPEG…");
        return imageBlobToJpeg(blob);
      },
      close: () => {},
    };
  }
  let activeMigrationItemId = null;
  async function migrate(item, deps) {
    if (!deps?.client || !deps.isAdminProfile?.()) throw new Error("Entre com a conta de administrador para migrar edições.");
    if (navigator.onLine === false || deps.sessionOffline?.()) throw new Error("A migração exige conexão com a internet.");
    if (Array.isArray(item?.telegramPages) && item.telegramPages.length) throw new Error("Esta edição já foi migrada para páginas JPEG no Telegram.");
    const migrationItemId = text(item?.id).trim();
    if (!migrationItemId) throw new Error("A edição não possui um ID válido para a migração.");
    if (activeMigrationItemId !== null) throw new Error(`A edição \"${activeMigrationItemId}\" já está em migração. Aguarde antes de iniciar outra para evitar misturar páginas.`);
    // Prefere a URL direta; a postagem do Telegram fica como alternativa.
    // O proxy precisa do registro em catalog_edition_overrides, garantido abaixo.
    const directSource = text(item.fileUrl).trim();
    const originalLink = text(item.fileUrl || item.telegramUrl || "");
    const initialSources = [...new Set([directSource, text(deps.downloadSource(item)).trim()].filter(Boolean))];
    const usableInitialSources = initialSources.filter(url => !deps.isExternalArchiveLink?.(url));
    if (!initialSources.length) throw new Error("Esta edição não possui uma fonte direta para converter.");
    if (!usableInitialSources.length) throw new Error("Esta fonte é um link externo que não pode ser convertida diretamente. Cadastre um link direto para o PDF/CBZ/CBR e tente novamente.");

    activeMigrationItemId = migrationItemId;
    const overlay = document.createElement("div");
    overlay.className = "modal-backdrop telegram-pages-progress-overlay";
    overlay.innerHTML = '<div class="modal telegram-pages-progress-modal" tabindex="-1" role="dialog" aria-modal="true" aria-label="Migração de edição para o Telegram"><div class="section-head"><div><h2>Migrando edição para o Telegram</h2><div data-tg-pages-status role="status" aria-live="polite">Preparando o arquivo…</div></div><div class="modal-actions"><button type="button" class="small-btn" data-tg-pages-minimize>Minimizar</button><button type="button" class="small-btn" data-tg-pages-restore>Abrir</button></div></div><progress data-tg-pages-progress max="100" value="0" aria-label="Progresso da migração"></progress><p class="section-subtitle" data-tg-pages-detail>O original será mantido como link reserva.</p><div class="modal-actions"><button type="button" class="small-btn" data-tg-pages-close disabled>Fechar</button></div></div>';
    document.body.appendChild(overlay);
    const dialog = overlay.querySelector(".telegram-pages-progress-modal");
    const statusNode = overlay.querySelector("[data-tg-pages-status]");
    const detailNode = overlay.querySelector("[data-tg-pages-detail]");
    const progress = overlay.querySelector("[data-tg-pages-progress]");
    const close = overlay.querySelector("[data-tg-pages-close]");
    const minimizeButton = overlay.querySelector("[data-tg-pages-minimize]");
    const restoreButton = overlay.querySelector("[data-tg-pages-restore]");
    const minimize = () => {
      overlay.classList.add("is-minimized");
      dialog?.setAttribute("aria-modal", "false");
      dialog?.setAttribute("role", "region");
      restoreButton?.focus();
    };
    const restore = () => {
      overlay.classList.remove("is-minimized");
      dialog?.setAttribute("aria-modal", "true");
      dialog?.setAttribute("role", "dialog");
      dialog?.focus();
    };
    minimizeButton?.addEventListener("click", minimize);
    restoreButton?.addEventListener("click", restore);
    overlay.addEventListener("keydown", event => {
      if (event.key === "Escape" && !overlay.classList.contains("is-minimized")) {
        event.preventDefault();
        event.stopPropagation();
        minimize();
      }
    });
    overlay.addEventListener("click", event => {
      if (event.target === overlay && !overlay.classList.contains("is-minimized")) minimize();
    });
    const status = message => { if (statusNode) statusNode.textContent = message; };
    let prepared = null;
    try {
      // O proxy do Telegram consulta catalog_edition_overrides. Registre a
      // edição antes de baixá-la, inclusive quando houver um link direto alternativo.
      let migrationSource = "";
      let migrationSourceError = null;
      if (text(item.telegramUrl).trim()) {
        status("Registrando a edição para liberar a fonte do Telegram…");
        await invoke(deps.client, {
          action: "register",
          item_id: String(item.id),
          edition: item,
        });
        // A rota pública recusa séries/edições ocultas. Esta rota emite um ticket
        // de curta duração após validar a sessão admin, sem tornar o item público.
        try {
          status("Preparando acesso temporário à fonte original…");
          const resolved = await invoke(deps.client, {
            action: "resolve-source",
            item_id: String(item.id),
            edition: item,
          });
          migrationSource = text(resolved?.sourceUrl).trim();
          if (!migrationSource) throw new Error("O serviço não retornou uma fonte temporária válida.");
        } catch (error) {
          migrationSourceError = error;
        }
      }
      const candidateSources = [...new Set([
        directSource,
        migrationSource,
        text(deps.downloadSource(item)).trim(),
      ].filter(Boolean))].filter(url => !deps.isExternalArchiveLink?.(url));
      if (!candidateSources.length) throw migrationSourceError || new Error("Não foi possível resolver uma fonte compatível para esta edição.");
      let buffer = null;
      let source = "";
      let sourceError = null;
      let migrationGatewayError = null;
      for (let sourceIndex = 0; sourceIndex < candidateSources.length; sourceIndex++) {
        const candidate = candidateSources[sourceIndex];
        status(sourceIndex === 0
          ? "Baixando a fonte original…"
          : "A fonte principal falhou. Tentando a alternativa disponível…");
        try {
          buffer = await deps.fetchFileArrayBuffer(candidate, (received, total) => {
            if (!statusNode) return;
            if (total > 0) status("Baixando fonte original… " + Math.round(received / total * 100) + "%");
            else status("Baixando fonte original… " + (received / 1048576).toFixed(1) + " MB");
          });
          source = candidate;
          break;
        } catch (error) {
          sourceError = error;
          if (candidate === migrationSource) migrationGatewayError = error;
        }
      }
      if (!buffer) {
        if (migrationGatewayError) throw migrationGatewayError;
        if (migrationSourceError && /Edição indisponível|HTTP 404/i.test(text(sourceError?.message))) throw migrationSourceError;
        throw sourceError || migrationSourceError || new Error("Não foi possível baixar a fonte original desta edição.");
      }
      const configuredFormat = text(item.format || "").toLowerCase();
      const detectedFormat = extension(item.telegramFileName || item.fileUrl || source || item.telegramUrl);
      const format = ["pdf", "cbz", "cbr", "jpg", "jpeg", "png", "webp", "gif"].includes(configuredFormat) && configuredFormat !== "auto"
        ? configuredFormat : detectedFormat;
      if (format === "pdf") prepared = await preparePdf(buffer, deps, status);
      else if (format === "cbz" || extension(source) === "cbz") prepared = await prepareCbz(buffer, deps, status);
      else if (format === "cbr" || extension(source) === "cbr") prepared = await prepareCbr(buffer, deps, status);
      else if (["jpg", "jpeg", "png", "webp", "gif"].includes(format) || ["jpg", "jpeg", "png", "webp", "gif"].includes(extension(source))) prepared = await prepareImage(buffer, source, deps, status);
      else throw new Error("Formato não compatível. Use PDF, CBZ, CBR ou uma imagem.");
      const pageCount = Number(prepared.count);
      if (!Number.isSafeInteger(pageCount) || pageCount < 1 || pageCount > 3000) throw new Error("A edição precisa conter de 1 a 3.000 páginas.");
      status("Preparando o registro da migração…");
      const begun = await invoke(deps.client, {
        action: "begin",
        item_id: String(item.id),
        page_count: pageCount,
        source_url: originalLink,
        edition: item,
      });
      let uploaded = Number(begun.uploadedPages || 0);
      if (uploaded > pageCount) throw new Error("O progresso salvo no Telegram ultrapassa o total de páginas do arquivo.");
      if (detailNode) detailNode.textContent = pageCount + " páginas • envio em ordem • limite do Telegram respeitado";
      for (let pageNumber = uploaded + 1; pageNumber <= pageCount; pageNumber++) {
        status("Preparando página " + pageNumber + "/" + pageCount + "…");
        const blob = await prepared.getPage(pageNumber);
        const form = new FormData();
        form.set("action", "upload");
        form.set("item_id", String(item.id));
        form.set("page_number", String(pageNumber));
        form.set("page_count", String(pageCount));
        form.set("file", blob, "pagina-" + String(pageNumber).padStart(4, "0") + ".jpg");
        const result = await invoke(deps.client, form, true);
        uploaded = Number(result.uploaded || pageNumber);
        if (progress) progress.value = uploaded / pageCount * 100;
        status("Página " + uploaded + "/" + pageCount + " enviada ao Telegram.");
        if (detailNode) detailNode.textContent = (blob.size / 1048576).toFixed(2) + " MB em JPEG • " + uploaded + " de " + pageCount + " publicadas";
        if (pageNumber < pageCount) await pause(3200);
      }
      status("Confirmando os links individuais e salvando a edição…");
      const completed = await invoke(deps.client, { action: "complete", item_id: String(item.id), page_count: pageCount });
      if (String(completed?.edition?.id ?? "") !== migrationItemId) {
        throw new Error("O servidor retornou uma edição diferente da solicitada. A migração foi interrompida para evitar associar páginas à edição errada.");
      }
      if (!completed?.edition?.telegramPages?.length || completed.edition.telegramPages.length !== pageCount) {
        throw new Error("O Telegram recebeu as páginas, mas não foi possível confirmar a lista completa de links.");
      }
      if (progress) progress.value = 100;
      status("Migração concluída. Publicando a edição no catálogo…");
      if (close) {
        close.disabled = false;
        close.textContent = "Concluído";
        close.onclick = () => overlay.remove();
      }
      return completed.edition;
    } catch (error) {
      status("A migração foi interrompida.");
      if (detailNode) detailNode.textContent = (error?.message || String(error)) + " Se alguma página já tiver sido enviada, ela continuará no Telegram; corrija o erro e tente novamente para retomar o progresso.";
      if (close) {
        close.disabled = false;
        close.textContent = "Fechar";
        close.onclick = () => overlay.remove();
      }
      throw error;
    } finally {
      try { await prepared?.close?.(); } catch {}
      if (activeMigrationItemId === migrationItemId) activeMigrationItemId = null;
      if (!statusNode?.textContent?.startsWith("Migração foi interrompida") && close && !close.onclick) {
        close.disabled = false;
        close.onclick = () => overlay.remove();
      }
    }
  }
  window.BancaTelegramPages = { imageUrl, migrate };
})();
