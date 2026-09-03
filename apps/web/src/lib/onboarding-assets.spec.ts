import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";
import sharp from "sharp";

import { PUHU_MOTION_FRAMES } from "./onboarding-assets";

function readPngContract(buffer: Buffer) {
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
    colorType: buffer.readUInt8(25),
  };
}

async function readOuterPaddingMaxAlpha(buffer: Buffer, padding = 40) {
  const { data, info } = await sharp(buffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let maxAlpha = 0;

  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const isOuterPadding =
        x < padding || y < padding || x >= info.width - padding || y >= info.height - padding;
      if (!isOuterPadding) continue;
      maxAlpha = Math.max(maxAlpha, data[(y * info.width + x) * info.channels + 3]);
    }
  }

  return maxAlpha;
}

describe("Puhu onboarding motion assets", () => {
  it("ships seven distinct, square RGBA frames on one 1024px canvas", async () => {
    const sources = Object.values(PUHU_MOTION_FRAMES);

    expect(new Set(sources).size).toBe(7);

    for (const source of sources) {
      const file = await readFile(path.join(process.cwd(), "public", source));
      expect(readPngContract(file), source).toEqual({
        width: 1024,
        height: 1024,
        colorType: 6,
      });
      expect(await readOuterPaddingMaxAlpha(file), `${source} outer padding`).toBe(0);
    }
  });
});
