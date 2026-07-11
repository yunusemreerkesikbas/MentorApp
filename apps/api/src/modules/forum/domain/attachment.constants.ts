/**
 * Forum post attachments (APP-018). Phase 1 = images only; video/file are a fast-follow. Mirrors the
 * avatar/photo upload precedents (identity/domain/avatar.ts, ai/domain/photo-classify.constants.ts).
 */
export const FORUM_IMAGE_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
export const FORUM_IMAGE_MAX_BYTES = 5 * 1024 * 1024; // 5 MB per image
export const FORUM_MAX_ATTACHMENTS = 4;

/** File attachments (APP-027): PDF + modern Office (OOXML). 10 MB cap; legacy binary Office excluded. */
const FORUM_FILE_EXT: Record<string, "pdf" | "docx" | "xlsx" | "pptx"> = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
};
export const FORUM_FILE_MIME = new Set(Object.keys(FORUM_FILE_EXT));
export const FORUM_FILE_MAX_BYTES = 10 * 1024 * 1024; // 10 MB per file

export function extensionForForumFileMime(mime: string): "pdf" | "docx" | "xlsx" | "pptx" {
  return FORUM_FILE_EXT[mime] ?? "pdf";
}

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
    `^forum-attachments/${escapedUserId}/[0-9a-f-]+\\.(jpg|jpeg|png|webp|pdf|docx|xlsx|pptx)$`,
    "i",
  ).test(key);
}
