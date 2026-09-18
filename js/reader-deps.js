(() => {
  'use strict';

  const scriptBase = new URL('./', document.currentScript?.src || document.baseURI);
  const pdfModuleUrl = new URL('pdfjs/pdf.min.mjs', scriptBase).href;
  const pdfWorkerUrl = new URL('pdfjs/pdf.worker.min.mjs', scriptBase).href;

  let pdfPromise = null;
  let jszipPromise = null;
  let zipJsPromise = null;

  const loadClassicScript = (sources, globalName) => new Promise(resolve => {
    const trySource = index => {
      if (window[globalName]) return resolve(window[globalName]);
      if (index >= sources.length) return resolve(null);

      const script = document.createElement('script');
      script.src = sources[index];
      script.async = true;
      let settled = false;
      const next = () => {
        if (settled) return;
        settled = true;
        script.remove();
        trySource(index + 1);
      };

      script.onload = () => {
        if (window[globalName]) {
          settled = true;
          resolve(window[globalName]);
        } else {
          next();
        }
      };
      script.onerror = next;
      window.setTimeout(next, 8000);
      document.head.appendChild(script);
    };
    trySource(0);
  });

  const loadPdf = () => {
    if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
    if (!pdfPromise) {
      pdfPromise = import(pdfModuleUrl)
        .then(library => {
          window.pdfjsLib = library;
          library.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
          return library;
        })
        .catch(error => {
          pdfPromise = null;
          throw error;
        });
    }
    window.pdfjsReady = pdfPromise;
    return pdfPromise;
  };

  const loadJsZip = () => {
    if (window.JSZip) return Promise.resolve(window.JSZip);
    if (!jszipPromise) {
      jszipPromise = loadClassicScript([
        'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js',
        'https://unpkg.com/jszip@3.10.1/dist/jszip.min.js',
        'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js'
      ], 'JSZip').finally(() => {
        if (!window.JSZip) jszipPromise = null;
      });
    }
    window.jszipReady = jszipPromise;
    return jszipPromise;
  };

  const loadZipJs = () => {
    if (zipJsPromise) return zipJsPromise;
    zipJsPromise = import('https://cdn.jsdelivr.net/npm/@zip.js/zip.js@2.7.57/+esm')
      .catch(error => {
        console.warn('zip.js progressivo indisponível:', error);
        zipJsPromise = null;
        return null;
      });
    window.zipJsReady = zipJsPromise;
    return zipJsPromise;
  };

  const ensure = async format => {
    const value = String(format || '').toLowerCase();
    if (value === 'pdf') {
      await loadPdf();
      return;
    }
    if (value === 'cbz') {
      const [jszip] = await Promise.all([loadJsZip(), loadZipJs()]);
      if (!jszip) throw new Error('JSZip não carregou.');
    }
  };

  window.BancaReaderDeps = { ensure, loadPdf, loadJsZip, loadZipJs };
})();
