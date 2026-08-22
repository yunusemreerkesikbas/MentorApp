/**
 * Forum post attachments (APP-018). Phase 1 = images only; video/file are a fast-follow. Mirrors the
 * avatar/photo upload precedents (identity/domain/avatar.ts, ai/domain/photo-classify.constants.ts).
 */
export const FORUM_IMAGE_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);
export const FORUM_IMAGE_MAX_BYTES = 5 * 1024 * 1024; // 5 MB per image
export const FORUM_MAX_ATTACHMENTS = 4;

/** File attachments (APP-027): PDF + modern Office (OOXML). 10 MB cap; legacy binary Office excluded. */
const FORUM_FILE_EXT: Record<string, "pdf" | "docx" | "xlsx" | "pptx"> = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    "docx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation":
    "pptx",
};
export const FORUM_FILE_MIME = new Set(Object.keys(FORUM_FILE_EXT));
export const FORUM_FILE_MAX_BYTES = 10 * 1024 * 1024; // 10 MB per file

export function extensionForForumFileMime(
  mime: string,
): "pdf" | "docx" | "xlsx" | "pptx" {
  return FORUM_FILE_EXT[mime] ?? "pdf";
}

/** Grace before a minted-but-unattached upload key counts as orphaned (upload precedes create by ms;
 * 24h is far past any legit create). Sweep batch cap keeps each cron tick bounded. */
export const FORUM_ATTACHMENT_ORPHAN_GRACE_MS = 24 * 60 * 60 * 1000;
export const FORUM_ORPHAN_SWEEP_BATCH = 500;

export function extensionForForumImageMime(
  mime: string,
): "jpg" | "png" | "webp" {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return "jpg";
}

/** A key must be under the requester's own prefix — blocks attaching arbitrary/other users' objects. */
export function isValidForumAttachmentKey(
  userId: string,
  key: string,
): boolean {
  const escapedUserId = userId.replace(/-/g, "\\-");
  return new RegExp(
    `^forum-attachments/${escapedUserId}/[0-9a-f-]+\\.(jpg|jpeg|png|webp|pdf|docx|xlsx|pptx)$`,
    "i",
  ).test(key);
}

/**
 * The image an already-uploaded object can be copied in as, or null if it is not one.
 *
 * Derived from the key's own extension rather than a client-declared MIME: the caller names a key,
 * not a file, and letting them also name its type would let a `.pdf` be attached as `image/png`.
 * The extension is ours — every prefix mints `{uuid}.{ext}` from a MIME we validated on upload.
 */
export function forumImageMimeForKey(key: string): string | null {
  const ext = key.split(".").pop()?.toLowerCase();
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  return null;
}

/**
 * Does `key` name an image this user uploaded, anywhere in the store?
 *
 * Broader than `isValidForumAttachmentKey` on purpose: the point is to reuse an object from another
 * feature (a mistake-notebook photo), so the prefix cannot be pinned to the forum's own. What is
 * pinned is the part that matters — every upload prefix in this app mints `{feature}/{userId}/…`,
 * so requiring the caller's own id in the second segment is what stops one student attaching
 * another's photo. Path traversal cannot slip through: the shape is anchored at both ends.
 */
export function isOwnUploadKey(userId: string, key: string): boolean {
  const escapedUserId = userId.replace(/-/g, "\\-");
  return new RegExp(
    `^[a-z0-9-]+/${escapedUserId}/[0-9a-f-]+\\.(jpg|jpeg|png|webp)$`,
    "i",
  ).test(key);
}
