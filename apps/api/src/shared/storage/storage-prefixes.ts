/**
 * Every object-key prefix the app writes, and which bucket it belongs in.
 *
 * This file exists because the R2 adapter and the dev fake controller used to keep their own
 * independent lists, and they drifted: the fake path matched `forum-attachments/` while the R2
 * path only knew `forum/`, which no service has ever produced. Under `STORAGE_PROVIDER=r2` every
 * forum attachment would have failed with BAD_REQUEST — invisible in dev, and the adapter spec
 * asserted on a made-up key so CI stayed green.
 *
 * Adding a new upload feature = adding its prefix here, and nowhere else. The prefix must match
 * what the feature's service actually mints, so each entry names that call site.
 */

/** Not publicly readable: user exam photos are personal data, served only to the owner's pipeline. */
export const PRIVATE_PREFIX = "mock-exams/" as const;

export const PUBLIC_PREFIXES = [
  /** `identity/application/users.service.ts` → `avatars/{userId}/{uuid}.{ext}` */
  "avatars/",
  /** `forum/application/forum-thread.service.ts` → `forum-attachments/{userId}/{uuid}.{ext}` */
  "forum-attachments/",
  /** `content/application/content.service.ts` → `content/articles/{cover|body}/{uuid}.{ext}` */
  "content/",
  /** `coaching/application/vision-board-image.service.ts` → `vision-board/{userId}/{uuid}.{ext}` */
  "vision-board/",
] as const;

export type PublicPrefix = (typeof PUBLIC_PREFIXES)[number];

/** All prefixes, for exhaustive checks (setup verification, drift tests). */
export const ALL_PREFIXES = [PRIVATE_PREFIX, ...PUBLIC_PREFIXES] as const;

export function isPublicKey(key: string): boolean {
  return PUBLIC_PREFIXES.some((prefix) => key.startsWith(prefix));
}

export function isPrivateKey(key: string): boolean {
  return key.startsWith(PRIVATE_PREFIX);
}
