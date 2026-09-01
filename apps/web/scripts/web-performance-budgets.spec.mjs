import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import {
  evaluateBudgets,
  measureRoute,
  messagePayloadBytes,
} from "./web-performance-budgets.mjs";

async function writeFixture(root, relativePath, content) {
  const target = join(root, relativePath);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, content);
}

function clientReferenceManifest(clientModules) {
  return [
    "globalThis.__RSC_MANIFEST = globalThis.__RSC_MANIFEST || {};",
    `globalThis.__RSC_MANIFEST["/fixture/page"] = ${JSON.stringify({ clientModules })};`,
  ].join("\n");
}

async function createRouteFixture(t) {
  const nextDir = await mkdtemp(join(tmpdir(), "mentor-web-budget-"));
  t.after(() => rm(nextDir, { recursive: true, force: true }));

  const files = {
    clientReferenceManifest: "server/app/fixture/page_client-reference-manifest.js",
    buildManifest: "server/app/fixture/page/build-manifest.json",
    fontManifest: "server/app/fixture/page/next-font-manifest.json",
    fontEntrySuffix: "apps/web/src/app/fixture/page",
  };

  await writeFixture(
    nextDir,
    files.clientReferenceManifest,
    clientReferenceManifest({
      first: {
        chunks: [
          "/_next/static/chunks/shared.js",
          "/_next/static/chunks/shared.js",
        ],
      },
      second: {
        chunks: [
          "/_next/static/chunks/route.js",
          "server/chunks/ssr/ignored.js",
        ],
      },
    }),
  );
  await writeFixture(
    nextDir,
    files.buildManifest,
    JSON.stringify({
      polyfillFiles: ["static/chunks/polyfill.js"],
      rootMainFiles: [
        "static/chunks/shared.js",
        "static/chunks/runtime.js",
        "static/chunks/runtime.js",
      ],
    }),
  );
  await writeFixture(
    nextDir,
    files.fontManifest,
    JSON.stringify({
      app: {
        "[project]/apps/web/src/app/fixture/page": [
          "static/media/font-a.woff2",
          "static/media/font-b.woff2",
          "static/media/font-a.woff2",
        ],
      },
    }),
  );
  await writeFixture(nextDir, "static/chunks/shared.js", "1".repeat(10));
  await writeFixture(nextDir, "static/chunks/route.js", "2".repeat(20));
  await writeFixture(nextDir, "static/chunks/runtime.js", "3".repeat(30));
  await writeFixture(nextDir, "static/chunks/polyfill.js", "4".repeat(40));

  return { files, nextDir };
}

test("route JS measurement de-duplicates route and shared runtime chunks", async (t) => {
  const { files, nextDir } = await createRouteFixture(t);

  const result = await measureRoute(nextDir, files);

  assert.equal(result.routeAttributableBytes, 30);
  assert.equal(result.totalBytes, 100);
  assert.equal(result.fontPreloadCount, 2);
  assert.deepEqual(result.routeChunks, [
    "static/chunks/route.js",
    "static/chunks/shared.js",
  ]);
});

test("message payload measurement counts UTF-8 bytes", () => {
  const messages = { welcome: { title: "Çalış, güçlen 🦉" } };
  const expected = Buffer.byteLength(
    JSON.stringify({ welcome: messages.welcome }),
    "utf8",
  );

  assert.equal(messagePayloadBytes(messages, ["welcome"]), expected);
});

test("budget equality passes and a one-byte overage fails", () => {
  assert.deepEqual(evaluateBudgets({ articleBytes: 1024 }, { articleBytes: 1024 }), []);
  assert.deepEqual(
    evaluateBudgets({ articleBytes: 1025 }, { articleBytes: 1024 }),
    [{ key: "articleBytes", actual: 1025, limit: 1024, overBy: 1 }],
  );
});

test("missing manifests and referenced chunks fail loudly", async (t) => {
  const emptyNextDir = await mkdtemp(join(tmpdir(), "mentor-web-budget-empty-"));
  t.after(() => rm(emptyNextDir, { recursive: true, force: true }));
  await assert.rejects(
    measureRoute(emptyNextDir, {
      clientReferenceManifest: "missing-client-manifest.js",
      buildManifest: "missing-build-manifest.json",
    }),
    /Missing client reference manifest/,
  );

  const { files, nextDir } = await createRouteFixture(t);
  await rm(join(nextDir, "static/chunks/route.js"));
  await assert.rejects(measureRoute(nextDir, files), /Missing client chunk.*route\.js/);
});
