import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

const packageJson = JSON.parse(
  await readFile(new URL("../package.json", import.meta.url), "utf8"),
);

function runPnpmDev(cwd) {
  const command = process.platform === "win32"
    ? (process.env.ComSpec ?? "cmd.exe")
    : "pnpm";
  const args = process.platform === "win32"
    ? ["/d", "/s", "/c", "pnpm.cmd run dev"]
    : ["run", "dev"];
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: "ignore",
      windowsHide: true,
    });
    child.once("error", reject);
    child.once("exit", (code) => resolve(code));
  });
}

test("default dev command never removes the active server manifests", () => {
  assert.equal(packageJson.scripts.dev, "next dev --port 3000");
  assert.doesNotMatch(packageJson.scripts.dev, /rimraf|\.next\/dev/);
});

test("dev:clean keeps explicit cache cleanup available for exceptional recovery", () => {
  assert.equal(
    packageJson.scripts["dev:clean"],
    "rimraf .next/dev && next dev --port 3000",
  );
});

test("a second dev start can fail without deleting the active manifest", async (t) => {
  const fixture = await mkdtemp(join(tmpdir(), "mentor-web-dev-command-"));
  t.after(() => rm(fixture, { recursive: true, force: true }));

  const manifestPath = join(fixture, ".next", "dev", "routes-manifest.json");
  const binDir = join(fixture, "node_modules", ".bin");
  await mkdir(join(fixture, ".next", "dev"), { recursive: true });
  await mkdir(binDir, { recursive: true });
  await writeFile(manifestPath, '{"active":true}\n');
  await writeFile(
    join(fixture, "package.json"),
    `${JSON.stringify({ private: true, scripts: { dev: packageJson.scripts.dev } })}\n`,
  );

  if (process.platform === "win32") {
    await writeFile(join(binDir, "next.CMD"), "@echo off\r\necho EADDRINUSE 1>&2\r\nexit /b 1\r\n");
  } else {
    const nextPath = join(binDir, "next");
    await writeFile(nextPath, "#!/bin/sh\necho EADDRINUSE >&2\nexit 1\n");
    await chmod(nextPath, 0o755);
  }

  assert.notEqual(await runPnpmDev(fixture), 0);
  assert.equal(await readFile(manifestPath, "utf8"), '{"active":true}\n');
});
