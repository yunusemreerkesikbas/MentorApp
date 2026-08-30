import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("dev command resets transient Next.js route manifests before startup", async () => {
  const packageJson = JSON.parse(
    await readFile(new URL("../package.json", import.meta.url), "utf8"),
  );

  assert.match(packageJson.scripts.dev, /^rimraf \.next\/dev && next dev /);
});
