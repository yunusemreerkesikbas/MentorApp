import type { ForumAttachmentUploadUrl, ForumFileMime, ForumImageMime } from "@mentor/types";
import type { AttachmentInput } from "@mentor/validation";
import { http } from "@mentor/api-client";
import { resolveApiUrl } from "./api-base";

/** Presigned upload URL for a post attachment — image or file (client then PUTs directly to storage). */
export async function createAttachmentUploadUrl(
  contentType: ForumImageMime | ForumFileMime,
): Promise<ForumAttachmentUploadUrl> {
  return (await http<ForumAttachmentUploadUrl>("/v1/forum/attachments/upload-url", {
    method: "POST",
    body: JSON.stringify({ contentType }),
  })) as ForumAttachmentUploadUrl;
}

async function putFileToSignedUrl(uploadUrl: string, file: File, contentType: string): Promise<void> {
  const res = await fetch(resolveApiUrl(uploadUrl), {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: file,
  });
  if (!res.ok) throw new Error("Attachment upload failed.");
}

/** Best-effort pixel size (lets the server store width/height for no-CLS layout); null if undecodable. */
async function readImageSize(file: File): Promise<{ width: number; height: number } | null> {
  try {
    const bmp = await createImageBitmap(file);
    const size = { width: bmp.width, height: bmp.height };
    bmp.close();
    return size;
  } catch {
    return null;
  }
}

/** Upload one image and return the reference to send when creating the post. */
export async function uploadForumImage(file: File): Promise<AttachmentInput> {
  const contentType = file.type as ForumImageMime;
  const [{ uploadUrl, key }, size] = await Promise.all([
    createAttachmentUploadUrl(contentType),
    readImageSize(file),
  ]);
  await putFileToSignedUrl(uploadUrl, file, contentType);
  return { key, mimeType: contentType, width: size?.width, height: size?.height };
}

/** Upload one file (PDF/Office) and return the reference — carries the original name for its download chip. */
export async function uploadForumFile(file: File): Promise<AttachmentInput> {
  const contentType = file.type as ForumFileMime;
  const { uploadUrl, key } = await createAttachmentUploadUrl(contentType);
  await putFileToSignedUrl(uploadUrl, file, contentType);
  return { key, mimeType: contentType, fileName: file.name };
}
