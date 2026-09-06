/**
 * Object storage port (§8) — Cloudflare R2 adapter behind it (S3-compatible, zero egress).
 * Usage: avatars, mock-exam photos, notebook/vision media, forum and content files.
 */
export const STORAGE_PORT = Symbol("STORAGE_PORT");
export const RAW_STORAGE_PORT = Symbol("RAW_STORAGE_PORT");

export interface StorageUploadUrlResult {
  url: string;
  key: string;
  /** ISO expiry for client display / cache busting. */
  expiresAt: string;
}

export interface StorageUploadInput {
  key: string;
  contentType: string;
  ownerId: string;
  sessionId: string;
}

export interface StoragePort {
  /** Single-use API capability; bytes are validated before any object is published. */
  createUploadUrl(input: StorageUploadInput): Promise<StorageUploadUrlResult>;
  /** Call only from an owner-authorized feature read. */
  getPrivateUrl(key: string, ownerId: string): Promise<string>;
  getPublicUrl(key: string): string;
  readObject(key: string, maxBytes?: number): Promise<Buffer | null>;
  deleteObject(key: string): Promise<void>;
  copyObject(sourceKey: string, destinationKey: string): Promise<void>;
  listObjects(prefix: string, limit: number): Promise<StorageObjectSummary[]>;
}

/** Raw adapter surface. No direct client upload capability exists here. */
export interface ObjectStoragePort {
  putObject(key: string, bytes: Buffer, contentType: string): Promise<void>;
  createReadUrl(key: string, expiresInSeconds: number): Promise<string>;
  getPublicUrl(key: string): string;
  /** Server-side read for the vision pipeline (never exposed to clients). */
  readObject(key: string, maxBytes?: number): Promise<Buffer | null>;
  /** Immediate raw delete used by the durable cleanup job handler. */
  deleteObject(key: string): Promise<void>;
  /**
   * Server-side copy within the store — the bytes never travel through a client.
   *
   * Exists for reusing an object the user already uploaded in one feature as an upload in another
   * (a mistake-notebook photo becoming a forum attachment). The alternative is making the browser
   * download the object and PUT it back, which needs a CORS grant on the read and moves the file
   * twice for no reason.
   *
   * Always a copy, never a shared key: two features pointing at one object share its lifetime, so
   * deleting the notebook card would silently break a community thread months later.
   */
  copyObject(sourceKey: string, destinationKey: string): Promise<void>;
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
