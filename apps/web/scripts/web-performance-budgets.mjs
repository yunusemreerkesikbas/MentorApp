import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

async function readRequired(path, label) {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if (error && typeof error === "object" && error.code === "ENOENT") {
      throw new Error(`Missing ${label}: ${path}`);
    }
    throw error;
  }
}

function parseJson(content, label, path) {
  try {
    return JSON.parse(content);
  } catch (error) {
    throw new Error(`Invalid ${label} JSON at ${path}`, { cause: error });
  }
}

function parseClientReferenceManifest(content, path) {
  const assignmentIndex = content.lastIndexOf(" = ");
  if (assignmentIndex < 0) {
    throw new Error(`Unsupported client reference manifest schema at ${path}`);
  }

  const json = content.slice(assignmentIndex + 3).replace(/;\s*$/, "");
  const manifest = parseJson(json, "client reference manifest", path);
  if (!isRecord(manifest) || !isRecord(manifest.clientModules)) {
    throw new Error(`Missing clientModules in client reference manifest: ${path}`);
  }

  return manifest;
}

function normalizeClientChunk(chunk) {
  if (typeof chunk !== "string") {
    throw new Error("Client reference manifest contains a non-string chunk");
  }

  const normalized = chunk.replaceAll("\\", "/").replace(/^\/_next\//, "");
  if (!normalized.startsWith("static/chunks/")) return null;
  if (!normalized.endsWith(".js") || normalized.endsWith(".js.map")) return null;
  return normalized;
}

function extractRouteChunks(manifest, path) {
  const chunks = new Set();

  for (const clientModule of Object.values(manifest.clientModules)) {
    if (!isRecord(clientModule) || !Array.isArray(clientModule.chunks)) {
      throw new Error(`Unsupported clientModules entry in ${path}`);
    }
    for (const chunk of clientModule.chunks) {
      const normalized = normalizeClientChunk(chunk);
      if (normalized) chunks.add(normalized);
    }
  }

  if (chunks.size === 0) {
    throw new Error(`No client JavaScript chunks found in ${path}`);
  }
  return [...chunks].sort();
}

function extractRuntimeChunks(manifest, path) {
  if (
    !isRecord(manifest) ||
    !Array.isArray(manifest.polyfillFiles) ||
    !Array.isArray(manifest.rootMainFiles)
  ) {
    throw new Error(`Unsupported build manifest schema at ${path}`);
  }

  const chunks = new Set();
  for (const chunk of [...manifest.polyfillFiles, ...manifest.rootMainFiles]) {
    const normalized = normalizeClientChunk(chunk);
    if (normalized) chunks.add(normalized);
  }
  return [...chunks].sort();
}

async function sumChunkBytes(nextDir, chunks) {
  let total = 0;
  for (const chunk of chunks) {
    const chunkPath = join(nextDir, ...chunk.split("/"));
    try {
      const details = await stat(chunkPath);
      if (!details.isFile()) throw new Error("not a file");
      total += details.size;
    } catch (error) {
      throw new Error(`Missing client chunk: ${chunkPath}`, { cause: error });
    }
  }
  return total;
}

async function measureFontPreloads(nextDir, files) {
  if (!files.fontManifest) return undefined;
  if (!files.fontEntrySuffix) {
    throw new Error("fontEntrySuffix is required when fontManifest is configured");
  }

  const fontPath = join(nextDir, ...files.fontManifest.split("/"));
  const manifest = parseJson(
    await readRequired(fontPath, "font manifest"),
    "font manifest",
    fontPath,
  );
  if (!isRecord(manifest) || !isRecord(manifest.app)) {
    throw new Error(`Unsupported font manifest schema at ${fontPath}`);
  }

  const matches = Object.entries(manifest.app).filter(([entry]) =>
    entry.replaceAll("\\", "/").endsWith(files.fontEntrySuffix),
  );
  if (matches.length !== 1 || !Array.isArray(matches[0]?.[1])) {
    throw new Error(
      `Expected one font manifest entry ending with ${files.fontEntrySuffix} in ${fontPath}`,
    );
  }

  return new Set(matches[0][1]).size;
}

export async function measureRoute(nextDir, files) {
  const clientPath = join(nextDir, ...files.clientReferenceManifest.split("/"));
  const clientManifest = parseClientReferenceManifest(
    await readRequired(clientPath, "client reference manifest"),
    clientPath,
  );
  const routeChunks = extractRouteChunks(clientManifest, clientPath);

  const buildPath = join(nextDir, ...files.buildManifest.split("/"));
  const buildManifest = parseJson(
    await readRequired(buildPath, "build manifest"),
    "build manifest",
    buildPath,
  );
  const runtimeChunks = extractRuntimeChunks(buildManifest, buildPath);
  const totalChunks = [...new Set([...routeChunks, ...runtimeChunks])].sort();

  return {
    routeAttributableBytes: await sumChunkBytes(nextDir, routeChunks),
    totalBytes: await sumChunkBytes(nextDir, totalChunks),
    fontPreloadCount: await measureFontPreloads(nextDir, files),
    routeChunks,
    totalChunks,
  };
}

export function messagePayloadBytes(messages, namespaces) {
  if (!isRecord(messages) || !Array.isArray(namespaces)) {
    throw new Error("Messages and namespaces must use the expected object/array schema");
  }

  const selected = Object.fromEntries(
    namespaces.map((namespace) => {
      if (typeof namespace !== "string" || !(namespace in messages)) {
        throw new Error(`Missing i18n namespace: ${String(namespace)}`);
      }
      return [namespace, messages[namespace]];
    }),
  );
  return Buffer.byteLength(JSON.stringify(selected), "utf8");
}

export async function measureMessageScopes({
  messagesDir,
  scopesPath,
  locales = ["tr", "en"],
  scopeNames = ["root", "welcome", "article"],
}) {
  const scopes = parseJson(
    await readRequired(scopesPath, "route message scope contract"),
    "route message scope contract",
    scopesPath,
  );
  if (!isRecord(scopes)) {
    throw new Error(`Unsupported route message scope contract at ${scopesPath}`);
  }

  const messagesByLocale = {};
  for (const locale of locales) {
    const path = join(messagesDir, `${locale}.json`);
    messagesByLocale[locale] = parseJson(
      await readRequired(path, `${locale} message catalog`),
      `${locale} message catalog`,
      path,
    );
  }

  return Object.fromEntries(
    scopeNames.map((scopeName) => {
      const namespaces = scopes[scopeName];
      if (!Array.isArray(namespaces) || namespaces.some((value) => typeof value !== "string")) {
        throw new Error(`Invalid message namespaces for route scope: ${scopeName}`);
      }
      const localeBytes = Object.fromEntries(
        locales.map((locale) => [
          locale,
          messagePayloadBytes(messagesByLocale[locale], namespaces),
        ]),
      );
      return [
        scopeName,
        {
          namespaces,
          localeBytes,
          maxBytes: Math.max(...Object.values(localeBytes)),
        },
      ];
    }),
  );
}

export function evaluateBudgets(metrics, limits) {
  return Object.entries(limits).flatMap(([key, limit]) => {
    const actual = metrics[key];
    if (!Number.isFinite(actual)) {
      throw new Error(`Missing numeric performance metric: ${key}`);
    }
    if (!Number.isFinite(limit)) {
      throw new Error(`Invalid performance budget limit: ${key}`);
    }
    return actual <= limit
      ? []
      : [{ key, actual, limit, overBy: actual - limit }];
  });
}
