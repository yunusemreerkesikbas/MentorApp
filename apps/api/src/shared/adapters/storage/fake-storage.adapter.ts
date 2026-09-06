import { createHmac, timingSafeEqual } from "node:crypto";
import { ConfigService } from "@nestjs/config";
import type { Env } from "../../../config/env.validation";
import { ForbiddenError } from "../../../common/errors/domain-error";
import { isPrivateKey, isPublicKey } from "../../storage/storage-prefixes";
import {
  mkdir,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { Injectable } from "@nestjs/common";
import type {
  StorageObjectSummary,
  ObjectStoragePort,
} from "../../ports/storage.port";

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
export class FakeStorageAdapter implements ObjectStoragePort {
  constructor(private readonly config: ConfigService<Env, true>) {}

  getPublicUrl(key: string): string {
    if (!isPublicKey(key)) throw new ForbiddenError();
    return `/v1/storage/fake-object?key=${encodeURIComponent(key)}`;
  }

  async createReadUrl(key: string, expiresInSeconds: number): Promise<string> {
    if (!isPrivateKey(key)) throw new ForbiddenError();
    const expires = Math.floor(Date.now() / 1000) + Math.max(1, Math.min(expiresInSeconds, 300));
    return `/v1/storage/fake-private-object?key=${encodeURIComponent(key)}&expires=${expires}&signature=${this.readSignature(key, expires)}`;
  }

  verifyReadSignature(key: string, expires: number, signature: string): boolean {
    const now = Math.floor(Date.now() / 1000);
    if (!isPrivateKey(key) || !Number.isSafeInteger(expires) || expires < now || expires > now + 300 || !/^[a-f0-9]{64}$/.test(signature)) return false;
    return timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(this.readSignature(key, expires), "hex"));
  }

  private readSignature(key: string, expires: number): string {
    return createHmac("sha256", this.config.get("JWT_ACCESS_SECRET", { infer: true })).update(`fake-private-read:${key}:${expires}`).digest("hex");
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

  async listObjects(
    prefix: string,
    limit: number,
  ): Promise<StorageObjectSummary[]> {
    const seen = new Map<string, Date | null>();
    // Disk first, then the in-process map, so an object written this run is listed even before it
    // has been read back from disk.
    try {
      const files = await readdir(storageRoot);
      for (const file of files) {
        if (file.endsWith(".json")) continue; // sidecar metadata, not an object
        const key = decodeURIComponent(file);
        if (!key.startsWith(prefix)) continue;
        const info = await stat(path.join(storageRoot, file)).catch(() => null);
        seen.set(key, info?.mtime ?? null);
      }
    } catch {
      /* No .fake-storage directory yet — nothing has been uploaded. */
    }
    for (const key of memoryStore.keys()) {
      if (key.startsWith(prefix) && !seen.has(key)) seen.set(key, new Date());
    }
    return [...seen.entries()]
      .slice(0, limit)
      .map(([key, lastModified]) => ({ key, lastModified }));
  }

  async deleteObject(key: string): Promise<void> {
    memoryStore.delete(key);
    await Promise.all([
      rm(objectPath(key), { force: true }),
      rm(metaPath(key), { force: true }),
    ]);
  }

  async copyObject(sourceKey: string, destinationKey: string): Promise<void> {
    const bytes = await this.readObject(sourceKey);
    if (!bytes)
      throw new Error(`Fake storage: nothing to copy at ${sourceKey}`);
    const contentType =
      this.getContentType(sourceKey) ?? "application/octet-stream";
    memoryStore.set(destinationKey, { bytes, contentType });
    await this.putObject(destinationKey, bytes, contentType);
  }

  async putObject(
    key: string,
    bytes: Buffer,
    contentType: string,
  ): Promise<void> {
    if (!isPrivateKey(key) && !isPublicKey(key)) throw new ForbiddenError();
    memoryStore.set(key, { bytes, contentType });
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
