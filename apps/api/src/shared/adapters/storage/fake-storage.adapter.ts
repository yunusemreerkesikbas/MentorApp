import { Injectable } from "@nestjs/common";
import type { StoragePort, StorageUploadUrlResult } from "../../ports/storage.port";

/** In-memory object store keyed by storage key (dev/test). */
const memoryStore = new Map<string, { bytes: Buffer; contentType: string }>();

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

  async readObject(key: string): Promise<Buffer | null> {
    const row = memoryStore.get(key);
    return row?.bytes ?? null;
  }

  putObject(key: string, bytes: Buffer, contentType: string): void {
    memoryStore.set(key, { bytes, contentType });
  }

  getContentType(key: string): string | undefined {
    return memoryStore.get(key)?.contentType;
  }
}
