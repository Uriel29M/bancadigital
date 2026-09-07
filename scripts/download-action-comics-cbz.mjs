import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createCanvas } from '@napi-rs/canvas';
import * as pdfjs from '../js/pdfjs/pdf.min.mjs';

const root = process.cwd();
const dataFile = path.join(root, 'js', 'data', 'dc-comics', 'novos-52.js');
const outputDir = path.join(root, 'Arquivos', 'CBZ', 'DC Comics', 'Novos 52', 'Superman', '2011', 'Action Comics');
const tempDir = path.join(root, 'Arquivos', '.tmp-action-comics');
const seriesId = 'series-action-comics-2011-novos-52';
const execFileAsync = promisify(execFile);

class CanvasFactory {
  create(width, height) {
    const canvas = createCanvas(width, height);
    return { canvas, context: canvas.getContext('2d') };
  }
  reset(pair, width, height) {
    pair.canvas.width = width;
    pair.canvas.height = height;
  }
  destroy(pair) {
    pair.canvas.width = 0;
    pair.canvas.height = 0;
    pair.canvas = null;
    pair.context = null;
  }
}

pdfjs.GlobalWorkerOptions.workerSrc = new URL('../js/pdfjs/pdf.worker.min.mjs', import.meta.url).href;

const source = await fs.readFile(dataFile, 'utf8');
const context = { window: {}, console };
vm.createContext(context);
vm.runInContext(source, context);
const items = (context.window.DEFAULT_LIBRARY || []).filter(item => item.seriesId === seriesId);
if (items.length !== 62) throw new Error(`Catálogo inesperado: ${items.length} edições de Action Comics (esperadas: 62).`);

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(tempDir, { recursive: true });

function safeName(value) {
  return String(value).replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').replace(/\s+/g, ' ').trim();
}

function outputName(issue) {
  return `Action Comics_${safeName(issue)}.cbz`;
}

function driveId(url) {
  const parsed = new URL(url);
  const id = parsed.pathname.match(/\/file\/d\/([^/]+)/i)?.[1] || parsed.searchParams.get('id') || '';
  if (!/^[A-Za-z0-9_-]{10,200}$/.test(id)) throw new Error(`ID inválido no link: ${url}`);
  return id;
}

async function isValidCbz(file) {
  try {
    const data = await fs.readFile(file);
    return data.length > 22 && data.readUInt32LE(0) === 0x04034b50 && data.lastIndexOf(Buffer.from('PK\x05\x06', 'binary')) >= 0;
  } catch {
    return false;
  }
}

async function downloadPdf(sourceUrl, target) {
  const id = driveId(sourceUrl);
  const direct = `https://drive.usercontent.google.com/download?id=${encodeURIComponent(id)}&export=download`;
  let lastError;
  for (let attempt = 1; attempt <= 6; attempt++) {
    try {
      const part = `${target}.part`;
      await fs.rm(part, { force: true });
      await execFileAsync('curl.exe', [
        '-L', '--fail', '--silent', '--show-error', '--retry', '3', '--retry-all-errors', '--http1.1',
        '--connect-timeout', '30', '--max-time', '600', '-A', 'Mozilla/5.0 (Banca Digital CBZ Builder)',
        '-o', part, direct,
      ], { timeout: 650_000, maxBuffer: 1024 * 1024 });
      const header = Buffer.alloc(8);
      const handle = await fs.open(part, 'r');
      try { await handle.read(header, 0, header.length, 0); } finally { await handle.close(); }
      if (!header.subarray(0, 5).equals(Buffer.from('%PDF-'))) {
        await fs.rm(part, { force: true });
        throw new Error('conteúdo baixado não é PDF');
      }
      await fs.rename(part, target);
      return;
    } catch (error) {
      lastError = error;
    }
    if (attempt < 6) await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
  }
  throw lastError;
}

const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let value = n;
  for (let bit = 0; bit < 8; bit++) value = (value >>> 1) ^ (0xedb88320 & -(value & 1));
  crcTable[n] = value >>> 0;
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function makeStoredZip(entries) {
  const local = [];
  const central = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name, 'utf8');
    const raw = entry.data;
    const checksum = crc32(raw);
    const header = Buffer.alloc(30 + name.length);
    header.writeUInt32LE(0x04034b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(0x0800, 6);
    header.writeUInt16LE(0, 8);
    header.writeUInt32LE(checksum, 14);
    header.writeUInt32LE(raw.length, 18);
    header.writeUInt32LE(raw.length, 22);
    header.writeUInt16LE(name.length, 26);
    name.copy(header, 30);
    local.push(header, raw);

    const record = Buffer.alloc(46 + name.length);
    record.writeUInt32LE(0x02014b50, 0);
    record.writeUInt16LE(20, 4);
    record.writeUInt16LE(20, 6);
    record.writeUInt16LE(0x0800, 8);
    record.writeUInt16LE(0, 10);
    record.writeUInt32LE(checksum, 16);
    record.writeUInt32LE(raw.length, 20);
    record.writeUInt32LE(raw.length, 24);
    record.writeUInt16LE(name.length, 28);
    record.writeUInt32LE(offset, 42);
    name.copy(record, 46);
    central.push(record);
    offset += header.length + raw.length;
  }
  const centralData = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralData.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, centralData, end]);
}

async function pdfToCbz(pdfFile, cbzFile) {
  const data = new Uint8Array(await fs.readFile(pdfFile));
  const canvasFactory = new CanvasFactory();
  const document = await pdfjs.getDocument({ data, canvasFactory, verbosity: 0, useSystemFonts: true }).promise;
  const pages = [];
  try {
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
      const page = await document.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1 });
      const pair = canvasFactory.create(Math.ceil(viewport.width), Math.ceil(viewport.height));
      try {
        await page.render({ canvasContext: pair.context, viewport }).promise;
        const image = pair.canvas.toBuffer('image/png');
        pages.push({ name: `page_${String(pageNumber).padStart(3, '0')}.png`, data: image });
      } finally {
        canvasFactory.destroy(pair);
        page.cleanup();
      }
    }
    const temp = `${cbzFile}.tmp`;
    await fs.writeFile(temp, makeStoredZip(pages));
    if (!await isValidCbz(temp)) throw new Error('falha na validação do CBZ gerado');
    await fs.rename(temp, cbzFile);
    return document.numPages;
  } finally {
    await document.destroy();
  }
}

let completed = 0;
let skipped = 0;
const errors = [];
for (let index = 0; index < items.length; index++) {
  const item = items[index];
  const output = path.join(outputDir, outputName(item.issue));
  const pdf = path.join(tempDir, `${String(index + 1).padStart(3, '0')}-${safeName(item.issue)}.pdf`);
  if (await isValidCbz(output)) {
    skipped++;
    console.log(`[${index + 1}/${items.length}] já existe: ${path.basename(output)}`);
    continue;
  }
  try {
    console.log(`[${index + 1}/${items.length}] baixando Action Comics ${item.issue}`);
    if (!await fs.stat(pdf).then(stat => stat.size > 1000).catch(() => false)) await downloadPdf(item.fileUrl, pdf);
    console.log(`[${index + 1}/${items.length}] convertendo Action Comics ${item.issue}`);
    const pageCount = await pdfToCbz(pdf, output);
    await fs.rm(pdf, { force: true });
    completed++;
    console.log(`[${index + 1}/${items.length}] OK: ${path.basename(output)} (${pageCount} páginas)`);
  } catch (error) {
    errors.push({ issue: item.issue, url: item.fileUrl, error: error?.message || String(error) });
    console.error(`[${index + 1}/${items.length}] ERRO ${item.issue}: ${error?.message || error}`);
  }
}

if (!errors.length) await fs.rm(tempDir, { recursive: true, force: true });
console.log(JSON.stringify({ total: items.length, completed, skipped, errors }, null, 2));
if (errors.length) process.exitCode = 1;
