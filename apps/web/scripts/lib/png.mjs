// Minimal PNG read/write over Node's zlib, so mascot art can be inspected and alpha-keyed without
// pulling an image dependency into the web app. Handles the colour types a generator or GDI+ emits.
import { deflateSync, inflateSync } from "node:zlib";

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const CHANNELS = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function unfilter(raw, width, height, channels, depth) {
  const bpp = Math.max(1, Math.ceil((channels * depth) / 8));
  const stride = Math.ceil((width * channels * depth) / 8);
  const out = Buffer.alloc(height * stride);

  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride);
    const prev = y > 0 ? out.subarray((y - 1) * stride, y * stride) : Buffer.alloc(stride);
    const cur = out.subarray(y * stride, (y + 1) * stride);

    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? cur[x - bpp] : 0;
      const b = prev[x];
      const c = x >= bpp ? prev[x - bpp] : 0;
      let value = line[x];
      if (filter === 1) value += a;
      else if (filter === 2) value += b;
      else if (filter === 3) value += (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        value += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      cur[x] = value & 0xff;
    }
  }

  return { pixels: out, stride };
}

/** Decodes any supported PNG into flat RGBA bytes. */
export function decodeRgba(buf) {
  if (!buf.subarray(0, 8).equals(SIGNATURE)) {
    throw new Error("not a PNG file (signature mismatch)");
  }

  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  const depth = buf[24];
  const colorType = buf[25];
  const channels = CHANNELS[colorType];
  if (!channels) throw new Error(`unsupported colour type ${colorType}`);

  const idat = [];
  let palette = null;
  let transparency = null;
  let offset = 8;
  while (offset < buf.length) {
    const length = buf.readUInt32BE(offset);
    const type = buf.toString("ascii", offset + 4, offset + 8);
    const body = buf.subarray(offset + 8, offset + 8 + length);
    if (type === "IDAT") idat.push(body);
    else if (type === "PLTE") palette = Buffer.from(body);
    else if (type === "tRNS") transparency = Buffer.from(body);
    offset += length + 12;
  }

  const { pixels, stride } = unfilter(
    inflateSync(Buffer.concat(idat)),
    width,
    height,
    channels,
    depth,
  );

  const sample = (x, y, channel) => {
    const index = x * channels + channel;
    if (depth === 8) return pixels[y * stride + index];
    if (depth === 16) return pixels[y * stride + index * 2];
    const perByte = 8 / depth;
    const byte = pixels[y * stride + Math.floor(index / perByte)];
    const shift = 8 - depth * ((index % perByte) + 1);
    const value = (byte >> shift) & ((1 << depth) - 1);
    return colorType === 3 ? value : Math.round((value * 255) / ((1 << depth) - 1));
  };

  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const at = (y * width + x) * 4;
      if (colorType === 3) {
        const index = sample(x, y, 0);
        data[at] = palette[index * 3];
        data[at + 1] = palette[index * 3 + 1];
        data[at + 2] = palette[index * 3 + 2];
        data[at + 3] = transparency && index < transparency.length ? transparency[index] : 255;
      } else if (colorType === 0 || colorType === 4) {
        const grey = sample(x, y, 0);
        data[at] = grey;
        data[at + 1] = grey;
        data[at + 2] = grey;
        data[at + 3] = colorType === 4 ? sample(x, y, 1) : 255;
      } else {
        data[at] = sample(x, y, 0);
        data[at + 1] = sample(x, y, 1);
        data[at + 2] = sample(x, y, 2);
        data[at + 3] = colorType === 6 ? sample(x, y, 3) : 255;
      }
    }
  }

  return { width, height, data, sourceColorType: colorType, sourceDepth: depth };
}

function chunk(type, body) {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(body.length, 0);
  head.write(type, 4, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), body])), 0);
  return Buffer.concat([head, body, crc]);
}

/** Writes flat RGBA bytes as a true-colour-with-alpha PNG. */
export function encodeRgba({ width, height, data }) {
  const stride = width * 4;
  const raw = Buffer.alloc(height * (stride + 1));
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    Buffer.from(data.buffer, data.byteOffset + y * stride, stride).copy(
      raw,
      y * (stride + 1) + 1,
    );
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;

  return Buffer.concat([
    SIGNATURE,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/**
 * Area-average downscale. Alpha is weighted into the colour average so transparent pixels cannot
 * bleed their (meaningless) colour into the edge, which is what makes naive resizing look dirty.
 */
export function resize({ width, height, data }, targetWidth, targetHeight) {
  const out = new Uint8Array(targetWidth * targetHeight * 4);
  const scaleX = width / targetWidth;
  const scaleY = height / targetHeight;

  for (let y = 0; y < targetHeight; y++) {
    const y0 = Math.floor(y * scaleY);
    const y1 = Math.max(y0 + 1, Math.floor((y + 1) * scaleY));
    for (let x = 0; x < targetWidth; x++) {
      const x0 = Math.floor(x * scaleX);
      const x1 = Math.max(x0 + 1, Math.floor((x + 1) * scaleX));

      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      let count = 0;

      for (let sy = y0; sy < y1; sy++) {
        for (let sx = x0; sx < x1; sx++) {
          const at = (sy * width + sx) * 4;
          const alpha = data[at + 3];
          r += data[at] * alpha;
          g += data[at + 1] * alpha;
          b += data[at + 2] * alpha;
          a += alpha;
          count++;
        }
      }

      const at = (y * targetWidth + x) * 4;
      out[at] = a ? Math.round(r / a) : 0;
      out[at + 1] = a ? Math.round(g / a) : 0;
      out[at + 2] = a ? Math.round(b / a) : 0;
      out[at + 3] = Math.round(a / count);
    }
  }

  return { width: targetWidth, height: targetHeight, data: out };
}

/** Tight bounding box of everything above `threshold` alpha, plus coverage stats. */
export function alphaBounds({ width, height, data }, threshold = 16) {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  let opaque = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > threshold) {
        opaque++;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < 0) return null;
  return {
    left: minX,
    top: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
    coverage: opaque / (width * height),
  };
}
