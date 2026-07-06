/**
 * Forum post attachments (APP-018). Phase 1 = images only; video/file are a fast-follow. Mirrors the
 * avatar/photo upload precedents (identity/domain/avatar.ts, ai/domain/photo-classify.constants.ts).
 */
export const FORUM_IMAGE_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
export const FORUM_IMAGE_MAX_BYTES = 5 * 1024 * 1024; // 5 MB per image
export const FORUM_MAX_ATTACHMENTS = 4;

export function extensionForForumImageMime(mime: string): "jpg" | "png" | "webp" {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return "jpg";
}

/** A key must be under the requester's own prefix — blocks attaching arbitrary/other users' objects. */
export function isValidForumAttachmentKey(userId: string, key: string): boolean {
  const escapedUserId = userId.replace(/-/g, "\\-");
  return new RegExp(
    `^forum-attachments/${escapedUserId}/[0-9a-f-]+\\.(jpg|jpeg|png|webp)$`,
    "i",
  ).test(key);
}
