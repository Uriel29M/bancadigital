// RAR4 solid archives cannot be skipped/listed reliably by libarchive.
// Keep its lazy reader for other archives, and decode solid RAR4 in a worker.
export function withSolidRarSupport(Archive) {
  return {
    init: options => Archive.init(options),
    async open(file) {
      const header = new Uint8Array(await file.slice(0, 14).arrayBuffer());
      const solid = [82, 97, 114, 33, 26, 7, 0].every((b, i) => header[i] === b)
        && header[9] === 0x73 && (header[10] & 0x08);
      if (!solid) return Archive.open(file);
      const worker = new Worker(new URL('./rar-worker.mjs', import.meta.url), { type: 'module' });
      let closed = false;
      let rejectPending;
      let filesPromise;
      return {
        getFilesObject() {
          if (closed) return Promise.reject(new Error('Archive already closed'));
          if (!filesPromise) filesPromise = new Promise((resolve, reject) => {
            rejectPending = reject;
            worker.onerror = event => {
              worker.terminate();
              reject(new Error(event.message || 'Falha no extrator RAR.'));
            };
            worker.onmessage = ({ data }) => {
              worker.terminate();
              if (data.error) { reject(new Error(data.error)); return; }
              const files = Object.create(null);
              for (const { name, blob } of data.files) {
                files[name] = { name, size: blob.size, extract: async () => {
                  if (closed) throw new Error('Archive already closed');
                  return blob;
                } };
              }
              resolve(files);
            };
            worker.postMessage(file);
          });
          return filesPromise;
        },
        close() {
          closed = true;
          worker.terminate();
          rejectPending?.(new Error('Archive already closed'));
          filesPromise = null;
        }
      };
    }
  };
}
