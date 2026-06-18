import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Env } from "../../config/env.validation";
import type { StoragePort, StorageUploadUrlResult } from "../ports/storage.port";

/** In-memory object store keyed by storage key (dev/test). */
const memoryStore = new Map<string, { bytes: Buffer; contentType: string }>();

/**
 * Fake storage adapter — stores uploads in-process and exposes a local API upload URL.
 * Production uses R2; fake is the dev/test default (STORAGE_PROVIDER=fake).
 */
@Injectable()
export class FakeStorageAdapter implements StoragePort {
  constructor(private readonly config: ConfigService<Env, true>) {}

  async createUploadUrl(input: { key: string; contentType: string }): Promise<StorageUploadUrlResult> {
    const appUrl = this.config.get("APP_URL", { infer: true });
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    const url = `${appUrl}/v1/storage/fake-upload?key=${encodeURIComponent(input.key)}&contentType=${encodeURIComponent(input.contentType)}`;
    return { url, key: input.key, expiresAt };
  }

  getPublicUrl(key: string): string {
    const appUrl = this.config.get("APP_URL", { infer: true });
    return `${appUrl}/v1/storage/fake-object?key=${encodeURIComponent(key)}`;
  }

  async readObject(key: string): Promise<Buffer | null> {
    const row = memoryStore.get(key);
    return row?.bytes ?? null;
  }

  /** Called by the fake upload controller after client PUT. */
  putObject(key: string, bytes: Buffer, contentType: string): void {
    memoryStore.set(key, { bytes, contentType });
  }

  getContentType(key: string): string | undefined {
    return memoryStore.get(key)?.contentType;
  }
}
