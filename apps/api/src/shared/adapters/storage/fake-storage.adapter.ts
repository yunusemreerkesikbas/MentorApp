import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { Injectable } from "@nestjs/common";
import type { StoragePort, StorageUploadUrlResult } from "../../ports/storage.port";

/** Local fake object store keyed by storage key (dev/test). */
const memoryStore = new Map<string, { bytes: Buffer; contentType: string }>();
const storageRoot = path.resolve(process.cwd(), ".fake-storage");

function objectPath(key: string): string {
  return path.join(storageRoot, encodeURIComponent(key));
}

function metaPath(key: string): string {
  return `${objectPath(key)}.json`;
}

/**
 * Fake storage adapter — stores uploads in-process and exposes a local API upload URL.
 * Production uses R2; fake is the dev/test default (STORAGE_PROVIDER=fake).
 */
@Injectable()
export class FakeStorageAdapter implements StoragePort {
  async createUploadUrl(input: { key: string; contentType: string }): Promise<StorageUploadUrlResult> {
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    const url = `/v1/storage/fake-upload?key=${encodeURIComponent(input.key)}&contentType=${encodeURIComponent(input.contentType)}`;
    return { url, key: input.key, expiresAt };
  }

  getPublicUrl(key: string): string {
    return `/v1/storage/fake-object?key=${encodeURIComponent(key)}`;
  }

  async readObject(key: string, maxBytes?: number): Promise<Buffer | null> {
    let row = memoryStore.get(key);
    if (!row) {
      try {
        const [bytes, meta] = await Promise.all([
          readFile(objectPath(key)),
          readFile(metaPath(key), "utf8"),
        ]);
        const parsed = JSON.parse(meta) as { contentType?: unknown };
        if (typeof parsed.contentType !== "string") return null;
        row = { bytes, contentType: parsed.contentType };
        memoryStore.set(key, row);
      } catch {
        return null;
      }
    }
    if (!row) return null;
    if (maxBytes !== undefined && row.bytes.length > maxBytes) return null;
    return row.bytes;
  }

  async deleteObject(key: string): Promise<void> {
    memoryStore.delete(key);
    await Promise.all([
      rm(objectPath(key), { force: true }),
      rm(metaPath(key), { force: true }),
    ]);
  }

  async putObject(key: string, bytes: Buffer, contentType: string): Promise<void> {
    await mkdir(storageRoot, { recursive: true });
    await Promise.all([
      writeFile(objectPath(key), bytes),
      writeFile(metaPath(key), JSON.stringify({ contentType })),
    ]);
  }

  getContentType(key: string): string | undefined {
    return memoryStore.get(key)?.contentType;
  }
}
