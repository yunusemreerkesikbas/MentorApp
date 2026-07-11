import { HttpStatus } from "@nestjs/common";
import type { AttachmentInput } from "@mentor/validation";
import { DomainError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";
import type { StoragePort } from "../../../shared/ports/storage.port";
import {
  FORUM_FILE_MAX_BYTES,
  FORUM_FILE_MIME,
  FORUM_IMAGE_MAX_BYTES,
  FORUM_IMAGE_MIME,
  isValidForumAttachmentKey,
} from "../domain/attachment.constants";
import type { NewAttachment } from "../infrastructure/forum-attachment.repository";

/**
 * Validate + resolve attachment inputs into rows to persist (images + files — APP-027). Shared by the
 * CHAT (ForumThreadService) and QA (ForumQaService) post paths. Each key must be under the uploader's
 * own prefix (blocks arbitrary/other-user objects), carry an allowed mime (image OR file allowlist),
 * AND resolve to a stored object within the per-kind size cap (`storage.readObject` returns null past
 * `maxBytes`). `kind` is derived from the mime; files carry the original `fileName` (download label).
 * // ponytail: reads each object to verify size; add a storage HEAD/stat if this shows up on the create hot path.
 */
export async function resolveForumAttachments(
  storage: StoragePort,
  userId: string,
  inputs: AttachmentInput[] | undefined,
): Promise<NewAttachment[]> {
  if (!inputs?.length) return [];
  const out: NewAttachment[] = [];
  for (const a of inputs) {
    const isImage = FORUM_IMAGE_MIME.has(a.mimeType);
    const isFile = FORUM_FILE_MIME.has(a.mimeType);
    // Key regex only bounds the extension; the stored mime is client-supplied — validate it too.
    if (!isValidForumAttachmentKey(userId, a.key) || (!isImage && !isFile)) {
      throw new DomainError(ErrorCode.FORUM_ATTACHMENT_INVALID, HttpStatus.BAD_REQUEST);
    }
    const maxBytes = isImage ? FORUM_IMAGE_MAX_BYTES : FORUM_FILE_MAX_BYTES;
    const buf = await storage.readObject(a.key, maxBytes);
    if (!buf) {
      throw new DomainError(ErrorCode.FORUM_ATTACHMENT_INVALID, HttpStatus.BAD_REQUEST);
    }
    out.push({
      kind: isImage ? "image" : "file",
      storageKey: a.key,
      mimeType: a.mimeType,
      sizeBytes: buf.length,
      fileName: isImage ? null : (a.fileName ?? null),
      width: isImage ? (a.width ?? null) : null,
      height: isImage ? (a.height ?? null) : null,
    });
  }
  return out;
}
