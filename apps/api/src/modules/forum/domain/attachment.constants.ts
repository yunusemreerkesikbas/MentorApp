/**
 * Forum post attachments (APP-018). Phase 1 = images only; video/file are a fast-follow. Mirrors the
 * avatar/photo upload precedents (identity/domain/avatar.ts, ai/domain/photo-classify.constants.ts).
 */
export const FORUM_IMAGE_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
export const FORUM_IMAGE_MAX_BYTES = 5 * 1024 * 1024; // 5 MB per image
export const FORUM_MAX_ATTACHMENTS = 4;

/** Grace before a minted-but-unattached upload key counts as orphaned (upload precedes create by ms;
 * 24h is far past any legit create). Sweep batch cap keeps each cron tick bounded. */
export const FORUM_ATTACHMENT_ORPHAN_GRACE_MS = 24 * 60 * 60 * 1000;
export const FORUM_ORPHAN_SWEEP_BATCH = 500;

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
