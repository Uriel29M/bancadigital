import { createExtractorFromData } from './unrar/unrar.mjs';

self.onmessage = async ({ data: file }) => {
  try {
    const response = await fetch(new URL('./unrar/unrar.wasm', import.meta.url));
    if (!response.ok) throw new Error(`UnRAR WASM: HTTP ${response.status}`);
    const extractor = await createExtractorFromData({
      data: await file.arrayBuffer(), wasmBinary: await response.arrayBuffer()
    });
    const files = [];
    // Consume the entire iterator: solid entries depend on previous entries,
    // and UnRAR validates CRCs and releases its archive at the end.
    for (const { fileHeader, extraction } of extractor.extract().files) {
      if (!fileHeader.flags.directory && /\.(jpe?g|png|webp|gif)$/i.test(fileHeader.name)) {
        if (!extraction || extraction.byteLength !== fileHeader.unpSize) {
          throw new Error(`Página RAR incompleta: ${fileHeader.name}`);
        }
        files.push({ name: fileHeader.name, blob: new Blob([extraction]) });
      }
    }
    files.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    self.postMessage({ files });
  } catch (error) {
    self.postMessage({ error: `Não foi possível extrair o RAR completo: ${error.message}` });
  }
};
