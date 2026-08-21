import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, test } from "node:test";

import sharp from "sharp";

import {
  validateAchievementAsset,
  validateAchievementDirectory,
} from "./achievement-asset-validator.mjs";

const temporaryDirectories = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) =>
        rm(directory, { recursive: true, maxRetries: 5, retryDelay: 50 }),
      ),
  );
});

async function createTemporaryDirectory() {
  const directory = await mkdtemp(join(tmpdir(), "mentor-achievement-assets-"));
  temporaryDirectories.push(directory);
  return directory;
}

test("rejects an opaque outer matte even when the WebP contains transparent pixels", async () => {
  const directory = await createTemporaryDirectory();
  const filePath = join(directory, "badge.webp");
  const pixels = Buffer.alloc(1024 * 1024 * 4, 255);
  pixels[(512 * 1024 + 512) * 4 + 3] = 0;
  await sharp(pixels, { raw: { width: 1024, height: 1024, channels: 4 } })
    .webp()
    .toFile(filePath);

  const errors = await validateAchievementAsset(filePath, {
    maxBytes: 600 * 1024,
  });

  assert.ok(
    errors.some((error) => error.includes("transparent outer corners")),
  );
});

test("rejects assets that exceed the configured file-size budget", async () => {
  const directory = await createTemporaryDirectory();
  const filePath = join(directory, "badge.webp");
  await sharp({
    create: {
      width: 1024,
      height: 1024,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .webp()
    .toFile(filePath);

  const errors = await validateAchievementAsset(filePath, { maxBytes: 1 });

  assert.ok(errors.some((error) => error.includes("file-size budget")));
});

test("rejects missing and unexpected files in the canonical directory", async () => {
  const directory = await createTemporaryDirectory();
  await writeFile(join(directory, "first_step.webp"), "fixture");
  await writeFile(join(directory, "old-copy.webp"), "fixture");

  const errors = await validateAchievementDirectory({
    directory,
    expectedIds: ["first_step", "route_drawn"],
    maxBytes: 600 * 1024,
  });

  assert.ok(errors.includes("route_drawn.webp is missing"));
  assert.ok(
    errors.includes("old-copy.webp is not a canonical achievement asset"),
  );
});
