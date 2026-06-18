/**
 * Object storage port (§8) — Cloudflare R2 adapter behind it (S3-compatible, zero egress).
 * Usage: avatars, mock-exam photos, forum images.
 */
export const STORAGE_PORT = Symbol("STORAGE_PORT");

export interface StorageUploadUrlResult {
  url: string;
  key: string;
  /** ISO expiry for client display / cache busting. */
  expiresAt: string;
}

export interface StoragePort {
  /** Create a signed upload URL (client→R2 directly). */
  createUploadUrl(input: { key: string; contentType: string }): Promise<StorageUploadUrlResult>;
  getPublicUrl(key: string): string;
  /** Server-side read for the vision pipeline (never exposed to clients). */
  readObject(key: string): Promise<Buffer | null>;
}
