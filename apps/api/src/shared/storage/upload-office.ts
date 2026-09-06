import { inflateRawSync } from "node:zlib";

const MAX_ENTRIES = 512;
const MAX_EXPANDED = 30 * 1024 * 1024;
const MAX_ENTRY = 10 * 1024 * 1024;
const invalid = () => new Error("Invalid Office archive");

/** Central-directory traversal only; never extracts paths to disk or follows relationships. */
export function validateOfficeArchive(bytes: Buffer, contentType: string): void {
  const eocd = bytes.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (eocd < 0 || eocd + 22 > bytes.length || eocd + 22 + bytes.readUInt16LE(eocd + 20) !== bytes.length) throw invalid();
  if (bytes.readUInt32LE(eocd + 4) !== 0) throw invalid(); // no multipart/ZIP64
  const count = bytes.readUInt16LE(eocd + 10);
  if (!count || count > MAX_ENTRIES || count !== bytes.readUInt16LE(eocd + 8)) throw invalid();
  const directoryEnd = bytes.readUInt32LE(eocd + 16) + bytes.readUInt32LE(eocd + 12);
  if (directoryEnd !== eocd) throw invalid();
  let position = bytes.readUInt32LE(eocd + 16);
  let expanded = 0;
  const entries = new Map<string, Buffer>();
  for (let i = 0; i < count; i++) {
    if (position + 46 > eocd || bytes.readUInt32LE(position) !== 0x02014b50) throw invalid();
    const flags = bytes.readUInt16LE(position + 8);
    const method = bytes.readUInt16LE(position + 10);
    const compressed = bytes.readUInt32LE(position + 20);
    const size = bytes.readUInt32LE(position + 24);
    const nameLength = bytes.readUInt16LE(position + 28);
    const end = position + 46 + nameLength + bytes.readUInt16LE(position + 30) + bytes.readUInt16LE(position + 32);
    if (end > eocd || (flags & 1) || ![0, 8].includes(method) || size > MAX_ENTRY || (expanded += size) > MAX_EXPANDED || size > Math.max(compressed, 1) * 100) throw invalid();
    const name = bytes.toString("utf8", position + 46, position + 46 + nameLength);
    if (!name || /(^\/|\\|\0|(^|\/)\.\.?($|\/))/.test(name) || entries.has(name)) throw invalid();
    if (!/\.(xml|rels|png|jpg|jpeg|gif|webp|emf|wmf)$/i.test(name) && !name.endsWith("/")) throw invalid();
    if (/vba|macro|activex|embeddings/i.test(name)) throw invalid();
    const local = bytes.readUInt32LE(position + 42);
    if (local + 30 > position || bytes.readUInt32LE(local) !== 0x04034b50 || bytes.readUInt16LE(local + 8) !== method || bytes.readUInt16LE(local + 6) !== flags) throw invalid();
    const localNameLength = bytes.readUInt16LE(local + 26);
    const dataOffset = local + 30 + localNameLength + bytes.readUInt16LE(local + 28);
    if (bytes.toString("utf8", local + 30, local + 30 + localNameLength) !== name || dataOffset + compressed > bytes.readUInt32LE(eocd + 16)) throw invalid();
    const data = bytes.subarray(dataOffset, dataOffset + compressed);
    const decoded = method === 8 ? inflateRawSync(data, { maxOutputLength: Math.max(size, 1) }) : data;
    if (decoded.length !== size) throw invalid();
    if (/\.(xml|rels)$/i.test(name)) {
      const xml = decoded.toString("utf8");
      if (/<!DOCTYPE|<!ENTITY|TargetMode\s*=\s*["']External|macroEnabled|vbaProject|activeX|oleObject/i.test(xml)) throw invalid();
    }
    entries.set(name, decoded);
    position = end;
  }
  if (position !== eocd || !entries.has("[Content_Types].xml") || !entries.has("_rels/.rels")) throw invalid();
  const root = contentType.includes("wordprocessingml") ? "word/document.xml" : contentType.includes("spreadsheetml") ? "xl/workbook.xml" : contentType.includes("presentationml") ? "ppt/presentation.xml" : null;
  if (!root || !entries.has(root)) throw invalid();
  const types = entries.get("[Content_Types].xml")!.toString("utf8");
  if (!types.includes(`/${root}`)) throw invalid();
}
