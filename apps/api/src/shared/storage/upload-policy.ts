import { NOTEBOOK_IMAGE_MAX_BYTES, VISION_BOARD_IMAGE_MAX_BYTES } from "@mentor/validation";
import { ValidationFailedError } from "../../common/errors/domain-error";
import { PHOTO_MAX_BYTES } from "../../modules/ai/domain/photo-classify.constants";
import { ARTICLE_IMAGE_MAX_BYTES } from "../../modules/content/domain/content.constants";
import { FORUM_FILE_MAX_BYTES, FORUM_FILE_MIME, FORUM_IMAGE_MAX_BYTES } from "../../modules/forum/domain/attachment.constants";
import { AVATAR_MAX_BYTES } from "../../modules/identity/domain/avatar";

const images: Record<string, string[]> = { "image/jpeg": ["jpg", "jpeg"], "image/png": ["png"], "image/webp": ["webp"] };
const files: Record<string, string> = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
};

/** Called only for server-minted keys; rejects unknown namespaces and feature/type mismatch. */
export function uploadPolicy(key: string, ownerId: string, contentType: string): { purpose: string; maxBytes: number } {
  const invalid = () => new ValidationFailedError({ reason: "invalid_upload_purpose" });
  const parts = key.split("/");
  const prefix = parts[0]!;
  const filename = parts.at(-1)!;
  if (!/^[0-9a-f-]{36}\.[a-z0-9]+$/i.test(filename)) throw invalid();
  const extension = filename.split(".").pop()!;
  if (prefix === "content") {
    if (parts.length !== 4 || parts[1] !== "articles" || !["cover", "body", "gallery"].includes(parts[2]!) || !images[contentType]?.includes(extension)) throw invalid();
    return { purpose: `content:${parts[2]}`, maxBytes: ARTICLE_IMAGE_MAX_BYTES };
  }
  if (parts.length !== 3 || parts[1] !== ownerId) throw invalid();
  if (prefix === "forum-attachments" && FORUM_FILE_MIME.has(contentType) && files[contentType] === extension) return { purpose: prefix, maxBytes: FORUM_FILE_MAX_BYTES };
  if (!images[contentType]?.includes(extension)) throw invalid();
  const caps: Record<string, number> = { avatars: AVATAR_MAX_BYTES, notebook: NOTEBOOK_IMAGE_MAX_BYTES, "vision-board": VISION_BOARD_IMAGE_MAX_BYTES, "forum-attachments": FORUM_IMAGE_MAX_BYTES, "mock-exams": PHOTO_MAX_BYTES };
  if (!caps[prefix] || (prefix === "mock-exams" && contentType === "image/webp")) throw invalid();
  return { purpose: prefix, maxBytes: caps[prefix]! };
}
