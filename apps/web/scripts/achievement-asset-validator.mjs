import { readFile, readdir, stat } from "node:fs/promises";
import { resolve } from "node:path";

import sharp from "sharp";

const EXPECTED_DIMENSION = 1024;
const CORNER_SAMPLE_SIZE = 32;
const TRANSPARENT_ALPHA_MAX = 8;
const MIN_TRANSPARENT_CORNER_RATIO = 0.95;

export async function validateAchievementAsset(filePath, { maxBytes }) {
  const errors = [];
  const fileStats = await stat(filePath);
  if (fileStats.size > maxBytes) {
    errors.push(`must stay within the ${maxBytes}-byte file-size budget`);
  }

  const imageBuffer = await readFile(filePath);
  const image = sharp(imageBuffer, { failOn: "error" });
  const metadata = await image.metadata();
  if (metadata.format !== "webp") errors.push("must be a WebP file");
  if (
    metadata.width !== EXPECTED_DIMENSION ||
    metadata.height !== EXPECTED_DIMENSION
  ) {
    errors.push(`must be ${EXPECTED_DIMENSION}x${EXPECTED_DIMENSION}`);
  }
  if (!metadata.hasAlpha) {
    errors.push("must include an alpha channel");
    return errors;
  }

  if (
    metadata.width !== EXPECTED_DIMENSION ||
    metadata.height !== EXPECTED_DIMENSION
  ) {
    return errors;
  }

  const { data, info } = await image
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  if (
    !hasTransparentOuterCorners(data, info.channels, info.width, info.height)
  ) {
    errors.push("must have genuinely transparent outer corners");
  }

  return errors;
}

export async function validateAchievementDirectory({
  directory,
  expectedIds,
  maxBytes,
}) {
  const errors = [];
  const expectedFiles = new Set(expectedIds.map((id) => `${id}.webp`));
  const entries = await readdir(directory, { withFileTypes: true });
  const actualFiles = entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name);

  for (const expectedFile of expectedFiles) {
    if (!actualFiles.includes(expectedFile))
      errors.push(`${expectedFile} is missing`);
  }
  for (const actualFile of actualFiles) {
    if (!expectedFiles.has(actualFile)) {
      errors.push(`${actualFile} is not a canonical achievement asset`);
    }
  }

  await Promise.all(
    actualFiles
      .filter((fileName) => expectedFiles.has(fileName))
      .map(async (fileName) => {
        try {
          const assetErrors = await validateAchievementAsset(
            resolve(directory, fileName),
            {
              maxBytes,
            },
          );
          errors.push(...assetErrors.map((error) => `${fileName} ${error}`));
        } catch (error) {
          errors.push(
            `${fileName}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }),
  );

  return errors.toSorted();
}

function hasTransparentOuterCorners(data, channels, width, height) {
  const cornerOrigins = [
    [0, 0],
    [width - CORNER_SAMPLE_SIZE, 0],
    [0, height - CORNER_SAMPLE_SIZE],
    [width - CORNER_SAMPLE_SIZE, height - CORNER_SAMPLE_SIZE],
  ];

  return cornerOrigins.every(([originX, originY]) => {
    let transparentPixels = 0;
    for (let y = originY; y < originY + CORNER_SAMPLE_SIZE; y += 1) {
      for (let x = originX; x < originX + CORNER_SAMPLE_SIZE; x += 1) {
        const alpha = data[(y * width + x) * channels + channels - 1];
        if (alpha <= TRANSPARENT_ALPHA_MAX) transparentPixels += 1;
      }
    }

    return (
      transparentPixels / CORNER_SAMPLE_SIZE ** 2 >=
      MIN_TRANSPARENT_CORNER_RATIO
    );
  });
}
