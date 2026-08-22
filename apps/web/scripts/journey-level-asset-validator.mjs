import { readFile, readdir, stat } from "node:fs/promises";
import { resolve } from "node:path";

import sharp from "sharp";

const EXPECTED_DIMENSION = 1024;
const PREVIEW_DIMENSIONS = [48, 80, 128];
const CORNER_SAMPLE_SIZE = 32;
const TRANSPARENT_ALPHA_MAX = 8;
const MIN_TRANSPARENT_CORNER_RATIO = 0.95;
const FORBIDDEN_ELEMENT_PATTERN = /<(?:image|text|script|foreignObject)\b/i;
const EXTERNAL_REFERENCE_PATTERN = /(?:xlink:)?href\s*=\s*["'](?!#)/i;
const EXTERNAL_STYLE_RESOURCE_PATTERN =
  /@import\b|url\(\s*(?:["'](?!#)|(?!["'#]))/i;

export async function validateJourneyLevelAsset(filePath, { maxBytes }) {
  const errors = [];
  const fileStats = await stat(filePath);
  if (fileStats.size > maxBytes) {
    errors.push(`must stay within the ${maxBytes}-byte file-size budget`);
  }

  const source = await readFile(filePath, "utf8");
  if (!/<svg\b/i.test(source)) errors.push("must be an SVG document");
  if (!hasCanonicalViewBox(source)) {
    errors.push(`must use viewBox="0 0 ${EXPECTED_DIMENSION} ${EXPECTED_DIMENSION}"`);
  }
  const containsUnsafeContent =
    FORBIDDEN_ELEMENT_PATTERN.test(source) ||
    EXTERNAL_REFERENCE_PATTERN.test(source) ||
    EXTERNAL_STYLE_RESOURCE_PATTERN.test(source);
  if (containsUnsafeContent) {
    errors.push(
      "must be vector-only without image, text, script, foreignObject, or external references",
    );
  }
  if (containsUnsafeContent) return errors;

  const imageBuffer = Buffer.from(source);
  const rendered = sharp(imageBuffer, { failOn: "error" }).resize(
    EXPECTED_DIMENSION,
    EXPECTED_DIMENSION,
    { fit: "fill" },
  );
  const { data, info } = await rendered
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  if (!hasTransparentOuterCorners(data, info.channels, info.width, info.height)) {
    errors.push("must have genuinely transparent outer corners");
  }

  for (const dimension of PREVIEW_DIMENSIONS) {
    const preview = await sharp(imageBuffer, { failOn: "error" })
      .resize(dimension, dimension, { fit: "contain" })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    if (!hasVisiblePixels(preview.data, preview.info.channels)) {
      errors.push(`must remain visible when rendered at ${dimension}x${dimension}`);
    }
  }

  return errors;
}

export async function validateJourneyLevelDirectory({
  directory,
  expectedIds,
  maxBytes,
}) {
  const errors = [];
  const expectedFiles = new Set(expectedIds.map((id) => `${id}.svg`));
  let entries = [];
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") {
      throw error;
    }
  }
  const actualFiles = entries.filter((entry) => entry.isFile()).map((entry) => entry.name);

  for (const expectedFile of expectedFiles) {
    if (!actualFiles.includes(expectedFile)) errors.push(`${expectedFile} is missing`);
  }
  for (const actualFile of actualFiles) {
    if (!expectedFiles.has(actualFile)) {
      errors.push(`${actualFile} is not a canonical journey-level asset`);
    }
  }

  await Promise.all(
    actualFiles
      .filter((fileName) => expectedFiles.has(fileName))
      .map(async (fileName) => {
        try {
          const assetErrors = await validateJourneyLevelAsset(
            resolve(directory, fileName),
            { maxBytes },
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

function hasCanonicalViewBox(source) {
  const match = source.match(/\bviewBox\s*=\s*["']([^"']+)["']/i);
  if (!match) return false;
  const values = match[1].trim().split(/[\s,]+/).map(Number);
  return (
    values.length === 4 &&
    values[0] === 0 &&
    values[1] === 0 &&
    values[2] === EXPECTED_DIMENSION &&
    values[3] === EXPECTED_DIMENSION
  );
}

function hasVisiblePixels(data, channels) {
  for (let offset = channels - 1; offset < data.length; offset += channels) {
    if (data[offset] > TRANSPARENT_ALPHA_MAX) return true;
  }
  return false;
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
