(() => {
  'use strict';

  window.BancaCbrFixReady = import('../libarchive/libarchive.js').then(({ Archive }) => {
    if (!Archive?.prototype || Archive.prototype.__bancaCbrFix) return;

    const originalGetFilesObject = Archive.prototype.getFilesObject;

    const countImages = value => {
      if (!value || typeof value !== 'object') return 0;
      let total = 0;
      for (const [key, child] of Object.entries(value)) {
        if (child && typeof child.extract === 'function') {
          const name = String(child.name || key);
          if (/\.(?:jpe?g|png|webp|gif)$/i.test(name)) total += 1;
        } else if (child && typeof child === 'object') {
          total += countImages(child);
        }
      }
      return total;
    };

    const wrapExtractedFiles = value => {
      if (!value || typeof value !== 'object') return value;
      const output = {};
      for (const [key, child] of Object.entries(value)) {
        if (child instanceof File) {
          const file = child;
          output[key] = {
            name: file.name || key,
            size: file.size,
            lastModified: file.lastModified,
            extract: async () => file
          };
        } else if (child && typeof child === 'object') {
          output[key] = wrapExtractedFiles(child);
        } else {
          output[key] = child;
        }
      }
      return output;
    };

    Archive.prototype.getFilesObject = async function (...args) {
      const listed = await originalGetFilesObject.apply(this, args);
      const listedImages = countImages(listed);
      if (listedImages > 1) return listed;

      try {
        const extracted = await this.extractFiles();
        const wrapped = wrapExtractedFiles(extracted);
        const extractedImages = countImages(wrapped);
        if (extractedImages > listedImages) {
          console.info(`[CBR] listagem incompleta (${listedImages}); extração completa encontrou ${extractedImages} página(s).`);
          return wrapped;
        }
      } catch (error) {
        console.warn('[CBR] Não foi possível recuperar páginas pela extração completa.', error);
      }
      return listed;
    };

    Object.defineProperty(Archive.prototype, '__bancaCbrFix', { value: true });
  }).catch(error => {
    console.warn('[CBR] Não foi possível preparar a correção do libarchive.', error);
  });
})();
