import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import { Worker } from 'node:worker_threads';
import { Archive } from '../node_modules/libarchive.js/dist/libarchive-node.mjs';

const root = process.cwd();
const sourceDir = path.join(root, 'Arquivos', 'CBZ');
Archive.init({
  getWorker: () => {
    const worker = new Worker(path.resolve(root, 'node_modules', 'libarchive.js', 'dist', 'worker-bundle-node.mjs'));
    const listeners = new Map();
    return {
      postMessage: worker.postMessage.bind(worker),
      addEventListener: (_type, listener) => { const wrapped = data => listener({ data }); listeners.set(listener, wrapped); worker.on('message', wrapped); },
      removeEventListener: (_type, listener) => { const wrapped = listeners.get(listener); if (wrapped) worker.off('message', wrapped); listeners.delete(listener); },
      start: () => {},
      terminate: () => worker.terminate(),
    };
  },
});

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

async function makeZip(entries) {
  const local = [], central = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name.replaceAll('\\', '/'));
    const raw = Buffer.from(await entry.file.arrayBuffer());
    const compressed = zlib.deflateRawSync(raw, { level: 6 });
    const checksum = crc32(raw);
    const header = Buffer.alloc(30 + name.length);
    header.writeUInt32LE(0x04034b50, 0); header.writeUInt16LE(20, 4); header.writeUInt16LE(0x0800, 6); header.writeUInt16LE(8, 8);
    header.writeUInt32LE(checksum, 14); header.writeUInt32LE(compressed.length, 18); header.writeUInt32LE(raw.length, 22); header.writeUInt16LE(name.length, 26); name.copy(header, 30);
    local.push(header, compressed);
    const record = Buffer.alloc(46 + name.length);
    record.writeUInt32LE(0x02014b50, 0); record.writeUInt16LE(20, 4); record.writeUInt16LE(20, 6); record.writeUInt16LE(0x0800, 8); record.writeUInt16LE(8, 10);
    record.writeUInt32LE(checksum, 16); record.writeUInt32LE(compressed.length, 20); record.writeUInt32LE(raw.length, 24); record.writeUInt16LE(name.length, 28); record.writeUInt32LE(offset, 42); name.copy(record, 46);
    central.push(record); offset += header.length + compressed.length;
  }
  const centralBuffer = Buffer.concat(central); const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10); end.writeUInt32LE(centralBuffer.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, centralBuffer, end]);
}

const files = await fs.readdir(sourceDir, { recursive: true, withFileTypes: true });
const targets = files.filter(entry => entry.isFile() && entry.name.toLowerCase().endsWith('.cbr'));
let converted = 0, invalid = 0;
for (const entry of targets) {
  const file = path.join(entry.parentPath, entry.name);
  const buffer = await fs.readFile(file);
  const signature = buffer.subarray(0, 4).toString('hex');
  if (signature === '3c21444f') { invalid++; console.log(`INVÁLIDO: ${file}`); continue; }
  if (!['504b0304', '52617221'].includes(signature)) { invalid++; console.log(`DESCONHECIDO: ${file}`); continue; }
  const archive = await Archive.open(new Blob([buffer]));
  try {
    const extracted = await archive.extractFiles();
    const entries = [];
    const walk = async (value, prefix = '') => {
      for (const [name, child] of Object.entries(value || {})) {
        if (child && typeof child === 'object' && typeof child.arrayBuffer !== 'function') await walk(child, `${prefix}${name}/`);
        else if (child) entries.push({ name: `${prefix}${name}`, file: new Blob([await child.arrayBuffer()]) });
      }
    };
    await walk(extracted);
    if (!entries.length) throw new Error('arquivo sem páginas');
    entries.sort((left, right) => left.name.localeCompare(right.name, undefined, {
      numeric: true,
      sensitivity: 'base',
    }));
    const output = file.slice(0, -4) + '.cbz';
    const temp = `${output}.tmp`;
    await fs.writeFile(temp, await makeZip(entries));
    await fs.rename(temp, output);
    await fs.unlink(file);
    converted++;
    console.log(`OK: ${path.basename(output)} (${entries.length} arquivos)`);
  } finally { await archive.close(); }
}
console.log(JSON.stringify({ total: targets.length, converted, invalid }));
