import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import zlib from 'node:zlib';
import sharp from 'sharp';
import { Worker } from 'node:worker_threads';
import { createReadStream, createWriteStream } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { File as MegaFile, decrypt as megaDecrypt } from 'megajs';
const execFileAsync = promisify(execFile);
import { Archive, ArchiveCompression, ArchiveFormat } from './node_modules/libarchive.js/dist/libarchive-node.mjs';

const root = process.cwd();
const outputDir = path.join(root, 'Arquivos', 'CBZ');
const tempDir = path.join(root, 'Arquivos', '.tmp-cbz');
const supabaseUrl = 'https://vqfmbpqurapcsuixgvql.supabase.co';
const source = await fs.readFile(path.join(root, 'js', 'data', 'dc-comics', 'recentes.js'), 'utf8');
const context = { window: {}, console };
vm.createContext(context);
vm.runInContext(source, context);
Archive.init({
  getWorker: () => {
    const worker = new Worker(path.resolve(root, 'node_modules', 'libarchive.js', 'dist', 'worker-bundle-node.mjs'));
    const listeners = new Map();
    return {
      postMessage: worker.postMessage.bind(worker),
      addEventListener: (_type, listener) => { const wrapped = (data) => listener({ data }); listeners.set(listener, wrapped); worker.on('message', wrapped); },
      removeEventListener: (_type, listener) => { const wrapped = listeners.get(listener); if (wrapped) worker.off('message', wrapped); listeners.delete(listener); },
      start: () => {},
      terminate: () => worker.terminate(),
    };
  }
});
const blocked = new Set(['https://www.mediafire.com/file/q94g21ee7lrwfke']);
const manifestPath = path.join(outputDir, '_manifest.json');
let previousManifest = [];
try { previousManifest = JSON.parse(await fs.readFile(manifestPath, 'utf8')); } catch {}
const retryIds = new Set(previousManifest.filter((entry) => entry.status === 'error').map((entry) => entry.id));
const completedIds = new Set(previousManifest.filter((entry) => entry.status === 'ok' || entry.status === 'exists').map((entry) => entry.id));
const items = context.window.DEFAULT_LIBRARY.filter((item) => !blocked.has(item.fileUrl) && (retryIds.size ? retryIds.has(item.id) : !completedIds.has(item.id)));
const seriesById = new Map(context.window.DEFAULT_SERIES.map((series) => [series.id, series]));
const REBUILD_EXISTING = true;

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(tempDir, { recursive: true });

function safe(value) {
  return String(value || 'arquivo').replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').replace(/\s+/g, ' ').trim();
}

function proxyUrl(url) {
  const host = new URL(url).hostname.toLowerCase();
  const fn = host.includes('mega.nz') ? 'mega-proxy' : 'mediafire-proxy';
  return `${supabaseUrl}/functions/v1/${fn}?url=${encodeURIComponent(url)}`;
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

async function makeZip(files) {
  const local = [];
  const central = [];
  let offset = 0;
  for (const entry of files) {
    const name = Buffer.from(entry.pathname.replaceAll('\\', '/'));
    const raw = Buffer.from(await entry.file.arrayBuffer());
    const compressed = zlib.deflateRawSync(raw, { level: 6 });
    const checksum = crc32(raw);
    const header = Buffer.alloc(30 + name.length);
    header.writeUInt32LE(0x04034b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(0x0800, 6);
    header.writeUInt16LE(8, 8);
    header.writeUInt32LE(checksum, 14);
    header.writeUInt32LE(compressed.length, 18);
    header.writeUInt32LE(raw.length, 22);
    header.writeUInt16LE(name.length, 26);
    name.copy(header, 30);
    local.push(header, compressed);
    const record = Buffer.alloc(46 + name.length);
    record.writeUInt32LE(0x02014b50, 0);
    record.writeUInt16LE(20, 4);
    record.writeUInt16LE(20, 6);
    record.writeUInt16LE(0x0800, 8);
    record.writeUInt16LE(8, 10);
    record.writeUInt32LE(checksum, 16);
    record.writeUInt32LE(compressed.length, 20);
    record.writeUInt32LE(raw.length, 24);
    record.writeUInt16LE(name.length, 28);
    record.writeUInt32LE(offset, 42);
    name.copy(record, 46);
    central.push(record);
    offset += header.length + compressed.length;
  }
  const centralBuffer = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralBuffer.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, centralBuffer, end]);
}

async function isUsableZip(file) {
  try {
    const handle = await fs.open(file, 'r');
    const header = Buffer.alloc(30);
    await handle.read(header, 0, 30, 0);
    await handle.close();
    return header.readUInt32LE(0) === 0x04034b50 && header.readUInt16LE(26) > 0;
  } catch { return false; }
}

async function applyLogo(files) {
  const index = files.findIndex((entry) => /\.(jpe?g|png|webp|gif|bmp)$/i.test(entry.pathname));
  if (index < 0) throw new Error('CBR sem primeira página em formato de imagem');
  const page = Buffer.from(await files[index].file.arrayBuffer());
  const logo = await fs.readFile(path.join(root, 'assets', 'barracavermelhaicon.png'));
  const metadata = await sharp(page).metadata();
  const width = Math.max(120, Math.round((metadata.width || 1000) * 0.18));
  const mark = await sharp(logo).resize({ width, withoutEnlargement: true }).png().toBuffer();
  let pipeline = sharp(page).composite([{ input: mark, gravity: 'southwest', top: 0, left: 0 }]);
  if (metadata.format === 'jpeg') pipeline = pipeline.jpeg({ quality: 100, chromaSubsampling: '4:4:4', progressive: false });
  else if (metadata.format === 'png') pipeline = pipeline.png({ compressionLevel: 9, adaptiveFiltering: false });
  const output = await pipeline.toBuffer();
  files[index] = { ...files[index], file: new Blob([output]) };
}

async function download(url, target) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const separator = proxyUrl(url).includes('?') ? '&' : '?';
      if (new URL(url).hostname.toLowerCase().endsWith('mega.nz')) {
        try {
          const file = MegaFile.fromURL(url);
          await new Promise((resolve, reject) => file.loadAttributes((error) => error ? reject(error) : resolve()));
          const fileId = new URL(url).pathname.split('/').filter(Boolean).pop();
          const api = await fetch('https://g.api.mega.co.nz/cs?id=1', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify([{ a: 'g', g: 1, p: fileId }])
          });
          const response = await api.json();
          const encrypted = `${target}.encrypted`;
          try {
            let content;
            try { content = await fetch(response[0].g); } catch {}
            if (content?.ok && content.body) {
              await pipeline(Readable.fromWeb(content.body), createWriteStream(encrypted));
            } else {
              await execFileAsync('curl.exe', ['-L', '--fail', '--retry', '3', '--output', encrypted, response[0].g], { timeout: 60 * 60 * 1000 });
            }
            await pipeline(createReadStream(encrypted), megaDecrypt(file.key), createWriteStream(target));
          } finally {
            await fs.rm(encrypted, { force: true });
          }
          const downloadedSize = (await fs.stat(target)).size;
          console.log(`Mega direto: ${downloadedSize} bytes`);
          return;
        } catch (error) {
          lastError = error;
          console.error(`Mega direto falhou: ${error?.stack || error}`);
        }
      }
      const response = await fetch(`${proxyUrl(url)}${separator}retry=${attempt}`, { signal: AbortSignal.timeout(60 * 60 * 1000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const handle = await fs.open(target, 'w');
      try {
        const reader = response.body.getReader();
        while (true) {
          const part = await reader.read();
          if (part.done) break;
          await handle.write(part.value);
        }
      } finally {
        await handle.close();
      }
      return;
    } catch (error) {
      lastError = error;
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, 1500 * attempt));
    }
  }
  throw lastError;
}

const manifest = previousManifest.filter((entry) => !retryIds.has(entry.id));
for (let index = 0; index < items.length; index += 1) {
  const rawItem = items[index];
  const item = { ...(seriesById.get(rawItem.seriesId) || {}), ...rawItem };
  const publisher = safe(item.publisher || 'Sem editora');
  const imprint = safe(item.imprint || 'Sem selo');
  const character = safe(item.character || 'Sem personagem');
  const year = safe(item.year || 'Sem ano');
  const series = safe(item.seriesTitle || item.title || 'Sem série');
  const edition = safe(`Edição ${item.issue || item.id} - ${item.title || 'Arquivo'}`);
  const output = path.join(outputDir, publisher, imprint, character, year, series, `${edition}.cbz`);
  const temp = path.join(tempDir, `${safe(item.id)}.cbr`);
  await fs.mkdir(path.dirname(output), { recursive: true });
  if (!REBUILD_EXISTING && await fs.stat(output).then((stat) => stat.size > 100).catch(() => false) && await isUsableZip(output)) {
    console.log(`[${index + 1}/${items.length}] já existe: ${path.basename(output)}`);
    manifest.push({ id: item.id, output, status: 'exists' });
    continue;
  }
  try {
    console.log(`[${index + 1}/${items.length}] baixando: ${item.title} #${item.issue}`);
    await download(item.fileUrl, temp);
    console.log(`[${index + 1}/${items.length}] download concluído, extraindo CBR`);
    const buffer = await fs.readFile(temp);
    const archive = await Archive.open(new Blob([buffer]));
    const extracted = await archive.extractFiles();
    console.log(`[${index + 1}/${items.length}] extração concluída`);
    await archive.close();
    const files = [];
    const walk = async (value, prefix = '') => {
      for (const [name, entry] of Object.entries(value || {})) {
        if (entry && typeof entry === 'object' && typeof entry.arrayBuffer !== 'function') await walk(entry, `${prefix}${name}/`);
        else if (entry) files.push({ file: new Blob([await entry.arrayBuffer()]), pathname: `${prefix}${name}` });
      }
    };
    await walk(extracted);
    if (!files.length) throw new Error('CBR sem arquivos extraíveis');
    await fs.writeFile(output, await makeZip(files));
    const size = (await fs.stat(output)).size;
    manifest.push({ id: item.id, output, bytes: size, status: 'ok' });
    console.log(`[${index + 1}/${items.length}] concluído: ${(size / 1024 / 1024).toFixed(1)} MiB`);
  } catch (error) {
    manifest.push({ id: item.id, status: 'error', error: error.message });
    console.error(`[${index + 1}/${items.length}] ERRO: ${error.message}`);
  } finally {
    await fs.rm(temp, { force: true });
  }
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
}
await fs.rm(tempDir, { recursive: true, force: true });
console.log(JSON.stringify({ total: items.length, ok: manifest.filter((x) => x.status === 'ok' || x.status === 'exists').length, errors: manifest.filter((x) => x.status === 'error').length }, null, 2));
