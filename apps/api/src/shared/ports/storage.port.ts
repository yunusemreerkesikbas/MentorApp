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
  readObject(key: string, maxBytes?: number): Promise<Buffer | null>;
  /** Best-effort cleanup for replaced user uploads. */
  deleteObject(key: string): Promise<void>;
  /**
   * One page of objects under a prefix, for orphan sweeps.
   *
   * Bounded rather than paginated on purpose: a sweep that runs on a timer should do a fixed
   * amount of work per pass and let the next pass pick up the rest, not walk a whole bucket while
   * holding an interval open.
   */
  listObjects(prefix: string, limit: number): Promise<StorageObjectSummary[]>;
}

export interface StorageObjectSummary {
  key: string;
  /** Null when the backend cannot report it; sweeps must then treat the object as too young. */
  lastModified: Date | null;
}
