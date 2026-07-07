import { HttpStatus } from "@nestjs/common";
import type { AttachmentInput } from "@mentor/validation";
import { DomainError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";
import type { StoragePort } from "../../../shared/ports/storage.port";
import { FORUM_IMAGE_MAX_BYTES, FORUM_IMAGE_MIME, isValidForumAttachmentKey } from "../domain/attachment.constants";
import type { NewAttachment } from "../infrastructure/forum-attachment.repository";

/**
 * Validate + resolve attachment inputs into rows to persist. Shared by the CHAT (ForumThreadService)
 * and QA (ForumQaService) post paths. Each key must be under the uploader's own prefix (blocks
 * arbitrary/other-user objects), carry an allowed image mime, AND resolve to a stored object within
 * the size cap (avatar precedent — `storage.readObject` returns null past `maxBytes`).
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
    // Key regex only bounds the extension; the stored mime is client-supplied — validate it too.
    if (!isValidForumAttachmentKey(userId, a.key) || !FORUM_IMAGE_MIME.has(a.mimeType)) {
      throw new DomainError(ErrorCode.FORUM_ATTACHMENT_INVALID, HttpStatus.BAD_REQUEST);
    }
    const buf = await storage.readObject(a.key, FORUM_IMAGE_MAX_BYTES);
    if (!buf) {
      throw new DomainError(ErrorCode.FORUM_ATTACHMENT_INVALID, HttpStatus.BAD_REQUEST);
    }
    out.push({
      kind: "image",
      storageKey: a.key,
      mimeType: a.mimeType,
      sizeBytes: buf.length,
      width: a.width ?? null,
      height: a.height ?? null,
    });
  }
  return out;
}
