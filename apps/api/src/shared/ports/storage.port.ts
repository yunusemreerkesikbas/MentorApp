/**
 * Object storage port (§8) — Cloudflare R2 adapter behind it (S3-compatible, zero egress).
 * Usage: avatars, mock-exam photos, forum images.
 */
export const STORAGE_PORT = Symbol("STORAGE_PORT");

export interface StoragePort {
  /** Create a signed upload URL (client→R2 directly). */
  createUploadUrl(input: { key: string; contentType: string }): Promise<{ url: string }>;
  getPublicUrl(key: string): string;
}
