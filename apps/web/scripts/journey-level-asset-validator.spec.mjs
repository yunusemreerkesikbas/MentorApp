import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, test } from "node:test";

let validator;
try {
  validator = await import("./journey-level-asset-validator.mjs");
} catch {
  validator = null;
}

const temporaryDirectories = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, maxRetries: 5, retryDelay: 50 }),
    ),
  );
});

async function createTemporaryDirectory() {
  const directory = await mkdtemp(join(tmpdir(), "mentor-journey-level-assets-"));
  temporaryDirectories.push(directory);
  return directory;
}

function validSvg(inner = '<circle cx="512" cy="512" r="300" fill="#4f7fff"/>') {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">${inner}</svg>`;
}

test("accepts a transparent, vector-only 1024-square SVG", async () => {
  assert.ok(validator, "journey-level asset validator module must exist");
  const directory = await createTemporaryDirectory();
  const filePath = join(directory, "spark.svg");
  await writeFile(filePath, validSvg());

  const errors = await validator.validateJourneyLevelAsset(filePath, {
    maxBytes: 300 * 1024,
  });

  assert.deepEqual(errors, []);
});

test("rejects embedded raster, text, executable content, and external references", async () => {
  assert.ok(validator, "journey-level asset validator module must exist");
  const forbiddenFragments = [
    '<image href="data:image/png;base64,abc"/>',
    "<text>12</text>",
    "<script>alert(1)</script>",
    "<foreignObject><div>badge</div></foreignObject>",
    '<use href="https://cdn.test/symbol.svg#badge"/>',
    '<rect width="10" height="10" style="fill:url(https://cdn.test/fill.svg)"/>',
  ];

  for (const fragment of forbiddenFragments) {
    const directory = await createTemporaryDirectory();
    const filePath = join(directory, "spark.svg");
    await writeFile(filePath, validSvg(fragment));
    const errors = await validator.validateJourneyLevelAsset(filePath, {
      maxBytes: 300 * 1024,
    });
    assert.ok(errors.some((error) => error.includes("vector-only")));
  }
});

test("rejects an opaque outer matte and a non-canonical viewBox", async () => {
  assert.ok(validator, "journey-level asset validator module must exist");
  const directory = await createTemporaryDirectory();
  const filePath = join(directory, "spark.svg");
  await writeFile(
    filePath,
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="#111827"/></svg>',
  );

  const errors = await validator.validateJourneyLevelAsset(filePath, {
    maxBytes: 300 * 1024,
  });

  assert.ok(errors.some((error) => error.includes("viewBox")));
  assert.ok(errors.some((error) => error.includes("transparent outer corners")));
});

test("reports every missing file and rejects unexpected copies", async () => {
  assert.ok(validator, "journey-level asset validator module must exist");
  const directory = await createTemporaryDirectory();
  await writeFile(join(directory, "spark.svg"), validSvg());
  await writeFile(join(directory, "old-copy.svg"), validSvg());

  const errors = await validator.validateJourneyLevelDirectory({
    directory,
    expectedIds: ["spark", "trail"],
    maxBytes: 300 * 1024,
  });

  assert.ok(errors.includes("trail.svg is missing"));
  assert.ok(errors.includes("old-copy.svg is not a canonical journey-level asset"));
});
