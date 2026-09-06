import { inflateSync } from "node:zlib";
import { ValidationFailedError } from "../../common/errors/domain-error";
import { validateOfficeArchive } from "./upload-office";

const invalid = () => new ValidationFailedError({ reason: "invalid_upload_content" });

function isPng(bytes: Buffer): boolean {
  if (!bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return false;
  let position = 8;
  let sawHeader = false;
  let sawData = false;
  while (position + 12 <= bytes.length) {
    const length = bytes.readUInt32BE(position);
    const end = position + 12 + length;
    if (end > bytes.length) return false;
    const type = bytes.toString("ascii", position + 4, position + 8);
    if (!sawHeader) {
      if (type !== "IHDR" || length !== 13) return false;
      const width = bytes.readUInt32BE(position + 8);
      const height = bytes.readUInt32BE(position + 12);
      if (!width || !height || width * height > 40_000_000) return false;
      sawHeader = true;
    }
    if (type === "IDAT") sawData = true;
    if (type === "IEND") return length === 0 && sawData && end === bytes.length;
    position = end;
  }
  return false;
}

function isJpeg(bytes: Buffer): boolean {
  if (bytes.length < 12 || bytes.readUInt16BE(0) !== 0xffd8 || bytes.readUInt16BE(bytes.length - 2) !== 0xffd9) return false;
  let position = 2;
  let hasFrame = false;
  while (position + 4 <= bytes.length) {
    if (bytes[position++] !== 0xff) return false;
    while (bytes[position] === 0xff) position++;
    const marker = bytes[position++]!;
    const length = bytes.readUInt16BE(position);
    if (length < 2 || position + length > bytes.length) return false;
    if ([0xc0, 0xc1, 0xc2].includes(marker)) {
      if (length < 8) return false;
      const height = bytes.readUInt16BE(position + 3);
      const width = bytes.readUInt16BE(position + 5);
      if (!width || !height || width * height > 40_000_000) return false;
      hasFrame = true;
    }
    if (marker === 0xda) return hasFrame;
    position += length;
  }
  return false;
}

function isWebp(bytes: Buffer): boolean {
  if (bytes.length < 30 || bytes.toString("ascii", 0, 4) !== "RIFF" || bytes.toString("ascii", 8, 12) !== "WEBP" || bytes.readUInt32LE(4) + 8 !== bytes.length) return false;
  let position = 12;
  let hasImage = false;
  while (position + 8 <= bytes.length) {
    const kind = bytes.toString("ascii", position, position + 4);
    const size = bytes.readUInt32LE(position + 4);
    if (size > bytes.length - position - 8) return false;
    if (kind === "VP8 " || kind === "VP8L" || kind === "ANMF") hasImage = true;
    position += 8 + size + (size % 2);
  }
  return hasImage && position === bytes.length;
}

function inspectPdfText(value: string) {
  const decoded = value.replace(/#([0-9a-f]{2})/gi, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)));
  if (/\/(?:JavaScript|JS|OpenAction|AA|Launch|EmbeddedFile|Filespec|RichMedia|XFA|AcroForm|SubmitForm|ImportData|GoToR|Encrypt)\b/i.test(decoded)) throw invalid();
}

function validatePdf(bytes: Buffer) {
  const text = bytes.toString("latin1");
  if (!/^%PDF-1\.[0-7]/.test(text) || !/%%EOF\s*$/.test(text) || !/\b\d+\s+\d+\s+obj\b/.test(text)) throw invalid();
  inspectPdfText(text);
  let expanded = 0;
  for (const match of text.matchAll(/<<(.*?)>>\s*stream\r?\n([\s\S]*?)\r?\nendstream/gs)) {
    const dict = match[1]!;
    if (/\/FlateDecode\b/.test(dict)) {
      const remaining = 30 * 1024 * 1024 - expanded;
      if (remaining <= 0) throw invalid();
      const decoded = inflateSync(Buffer.from(match[2]!, "latin1"), { maxOutputLength: remaining });
      expanded += decoded.length;
      inspectPdfText(decoded.toString("latin1"));
    } else if (/\/Filter\b/.test(dict) && !/\/(DCTDecode|JPXDecode|CCITTFaxDecode)\b/.test(dict)) {
      throw invalid();
    }
  }
}

/** MIME is checked against bytes, never filename, client headers, or claimed attachment metadata. */
export function validateUploadContent(bytes: Buffer, contentType: string): void {
  try {
    if (contentType === "image/png" && isPng(bytes)) return;
    if (contentType === "image/jpeg" && isJpeg(bytes)) return;
    if (contentType === "image/webp" && isWebp(bytes)) return;
    if (contentType === "application/pdf") return validatePdf(bytes);
    if (contentType.startsWith("application/vnd.openxmlformats-officedocument.")) return validateOfficeArchive(bytes, contentType);
  } catch { throw invalid(); }
  throw invalid();
}
