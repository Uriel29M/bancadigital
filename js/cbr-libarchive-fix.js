(() => {
  'use strict';

  const IMAGE_RE = /\.(?:jpe?g|png|webp|gif)$/i;

  const countImages = value => {
    if (!value || typeof value !== 'object') return 0;
    let total = 0;
    for (const [key, child] of Object.entries(value)) {
      if (child && typeof child.extract === 'function') {
        if (IMAGE_RE.test(String(child.name || key))) total += 1;
      } else if (child && typeof child === 'object') {
        total += countImages(child);
      }
    }
    return total;
  };

  const naturalCompare = (a, b) => String(a).localeCompare(String(b), undefined, {
    numeric: true,
    sensitivity: 'base'
  });

  const mimeFor = name => {
    const value = String(name || '').toLowerCase();
    if (value.endsWith('.png')) return 'image/png';
    if (value.endsWith('.webp')) return 'image/webp';
    if (value.endsWith('.gif')) return 'image/gif';
    return 'image/jpeg';
  };

  const readU16 = (view, offset) => view.getUint16(offset, true);
  const readU32 = (view, offset) => view.getUint32(offset, true);

  function decodeRarName(bytes) {
    const zero = bytes.indexOf(0);
    const raw = zero >= 0 ? bytes.subarray(0, zero) : bytes;
    try {
      return new TextDecoder('utf-8', { fatal: true }).decode(raw);
    } catch {
      let text = '';
      for (const byte of raw) text += String.fromCharCode(byte);
      return text;
    }
  }

  function wrapFlatLibarchiveEntries(archive, entries) {
    const images = (entries || [])
      .filter(entry => entry?.type === 'FILE' && IMAGE_RE.test(String(entry.fileName || entry.path || '')))
      .sort((a, b) => naturalCompare(a.fileName || a.path, b.fileName || b.path));

    if (!images.length) return null;

    const output = {};
    images.forEach((entry, index) => {
      const name = String(entry.fileName || entry.path || `pagina-${index + 1}.jpg`);
      const path = String(entry.path || name);
      output[`page-${String(index + 1).padStart(5, '0')}`] = {
        name,
        size: Number(entry.size || 0),
        lastModified: Number(entry.lastModified || 0),
        extract: async () => archive.extractSingleFile(path)
      };
    });
    return output;
  }

  async function recoverStoredRar4(file) {
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const view = new DataView(buffer);

    if (bytes.length < 14 ||
        bytes[0] !== 0x52 || bytes[1] !== 0x61 || bytes[2] !== 0x72 || bytes[3] !== 0x21 ||
        bytes[4] !== 0x1a || bytes[5] !== 0x07 || bytes[6] !== 0x00) {
      return null;
    }

    const entries = [];
    let offset = 7;
    let safety = 0;

    while (offset + 7 <= bytes.length && safety++ < 10000) {
      const type = bytes[offset + 2];
      const flags = readU16(view, offset + 3);
      const headerSize = readU16(view, offset + 5);
      if (headerSize < 7 || offset + headerSize > bytes.length) break;

      if (type === 0x74) {
        if (offset + 32 > bytes.length) break;

        let packSize = readU32(view, offset + 7);
        let unpackedSize = readU32(view, offset + 11);
        const method = bytes[offset + 25];
        const nameSize = readU16(view, offset + 26);
        let nameOffset = offset + 32;

        if (flags & 0x0100) {
          if (offset + 40 > bytes.length) break;
          const highPack = readU32(view, offset + 32);
          const highUnpack = readU32(view, offset + 36);
          packSize += highPack * 0x100000000;
          unpackedSize += highUnpack * 0x100000000;
          nameOffset = offset + 40;
        }

        if (!Number.isSafeInteger(packSize) || packSize < 0 ||
            !Number.isSafeInteger(unpackedSize) || unpackedSize < 0 ||
            nameOffset + nameSize > offset + headerSize) break;

        const name = decodeRarName(bytes.subarray(nameOffset, nameOffset + nameSize));
        const dataOffset = offset + headerSize;
        const nextOffset = dataOffset + packSize;
        if (nextOffset > bytes.length) break;

        if (IMAGE_RE.test(name)) {
          entries.push({ name, method, packSize, unpackedSize, dataOffset });
        }

        offset = nextOffset;
        continue;
      }

      let extraSize = 0;
      if ((flags & 0x8000) && offset + 11 <= bytes.length) {
        extraSize = readU32(view, offset + 7);
      }
      const nextOffset = offset + headerSize + extraSize;
      if (nextOffset <= offset || nextOffset > bytes.length) break;
      offset = nextOffset;

      if (type === 0x7b) break;
    }

    if (entries.length <= 1) return null;

    const stored = entries.filter(entry => entry.method === 0x30 && entry.packSize === entry.unpackedSize);
    if (stored.length !== entries.length) {
      console.info('[CBR] RAR4 alternativo encontrou páginas comprimidas; mantendo libarchive.', {
        total: entries.length,
        stored: stored.length,
        methods: [...new Set(entries.map(entry => entry.method))]
      });
      return null;
    }

    entries.sort((a, b) => naturalCompare(a.name, b.name));
    const output = {};
    entries.forEach((entry, index) => {
      output[`page-${String(index + 1).padStart(5, '0')}`] = {
        name: entry.name,
        size: entry.unpackedSize,
        extract: async () => new File([
          buffer.slice(entry.dataOffset, entry.dataOffset + entry.packSize)
        ], entry.name, { type: mimeFor(entry.name) })
      };
    });
    return output;
  }

  window.BancaCbrFixReady = import('../libarchive/libarchive.js').then(({ Archive }) => {
    if (!Archive?.prototype || Archive.prototype.__bancaCbrFix) return;

    const originalGetFilesObject = Archive.prototype.getFilesObject;

    Archive.prototype.getFilesObject = async function (...args) {
      const listed = await originalGetFilesObject.apply(this, args);
      const listedImages = countImages(listed);
      if (listedImages > 1 || !this.file) return listed;

      // getFilesObject() reconstrói a listagem como árvore de caminhos. Se o RAR
      // tiver caminhos que colidem, entradas podem ser sobrescritas. Use a lista
      // plana do worker e preserve cada arquivo com uma chave única.
      try {
        const flatEntries = await this.client?.listFiles?.();
        const flatWrapped = wrapFlatLibarchiveEntries(this, flatEntries);
        const flatImages = countImages(flatWrapped);
        if (flatImages > listedImages) {
          console.info(`[CBR] árvore do libarchive encontrou ${listedImages} página(s); lista plana encontrou ${flatImages}.`);
          return flatWrapped;
        }
      } catch (error) {
        console.warn('[CBR] Não foi possível usar a listagem plana do libarchive.', error);
      }

      try {
        const recovered = await recoverStoredRar4(this.file);
        const recoveredImages = countImages(recovered);
        if (recoveredImages > listedImages) {
          console.info(`[CBR] libarchive encontrou ${listedImages} página(s); parser RAR4 local recuperou ${recoveredImages}.`);
          return recovered;
        }
      } catch (error) {
        console.warn('[CBR] Recuperação RAR4 local falhou; mantendo libarchive.', error);
      }

      return listed;
    };

    Object.defineProperty(Archive.prototype, '__bancaCbrFix', { value: true });
  }).catch(error => {
    console.warn('[CBR] Não foi possível preparar a correção do leitor CBR.', error);
  });
})();
