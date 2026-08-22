import type {
  ForumAttachmentUploadUrl,
  ForumFileMime,
  ForumImageMime,
} from "@mentor/types";
import type { AttachmentInput } from "@mentor/validation";
import { http } from "@mentor/api-client";
import { resolveApiUrl } from "./api-base";

/** Presigned upload URL for a post attachment — image or file (client then PUTs directly to storage). */
export async function createAttachmentUploadUrl(
  contentType: ForumImageMime | ForumFileMime,
): Promise<ForumAttachmentUploadUrl> {
  return (await http<ForumAttachmentUploadUrl>(
    "/v1/forum/attachments/upload-url",
    {
      method: "POST",
      body: JSON.stringify({ contentType }),
    },
  )) as ForumAttachmentUploadUrl;
}

async function putFileToSignedUrl(
  uploadUrl: string,
  file: File,
  contentType: string,
): Promise<void> {
  const res = await fetch(resolveApiUrl(uploadUrl), {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: file,
  });
  if (!res.ok) throw new Error("Attachment upload failed.");
}

/**
 * Reuse an image the user already uploaded elsewhere — the server copies the object in place.
 *
 * The alternative would be fetching the source URL in the browser and PUTting the bytes back, which
 * needs the storage host to allow a cross-origin *read*: displaying an image from another origin is
 * free, reading its bytes is not. Sizes are still measured here, because `naturalWidth` on a
 * displayed image needs no such permission and sparing the post a layout shift is worth passing.
 */
export async function copyForumAttachment(input: {
  sourceKey: string;
  width?: number;
  height?: number;
}): Promise<AttachmentInput> {
  return (await http<AttachmentInput>("/v1/forum/attachments/copy", {
    method: "POST",
    body: JSON.stringify(input),
  })) as AttachmentInput;
}

/**
 * Pixel size of an image at `url`, read the one way that needs no cross-origin permission.
 *
 * `naturalWidth` on a displayed image is readable whatever origin it came from — it is reading the
 * *pixels* that requires a CORS grant. So the browser can measure a notebook photo it cannot
 * download, which is exactly enough to spare the post a layout shift. Null on any failure: the
 * dimensions are optional and not worth failing an attachment over.
 */
export function readDisplayedImageSize(
  url: string,
): Promise<{ width: number; height: number } | Record<string, never>> {
  return new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () =>
      resolve(
        img.naturalWidth && img.naturalHeight
          ? { width: img.naturalWidth, height: img.naturalHeight }
          : {},
      );
    img.onerror = () => resolve({});
    img.src = url;
  });
}

/** Best-effort pixel size (lets the server store width/height for no-CLS layout); null if undecodable. */
async function readImageSize(
  file: File,
): Promise<{ width: number; height: number } | null> {
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
  return {
    key,
    mimeType: contentType,
    width: size?.width,
    height: size?.height,
  };
}

/** Upload one file (PDF/Office) and return the reference — carries the original name for its download chip. */
export async function uploadForumFile(file: File): Promise<AttachmentInput> {
  const contentType = file.type as ForumFileMime;
  const { uploadUrl, key } = await createAttachmentUploadUrl(contentType);
  await putFileToSignedUrl(uploadUrl, file, contentType);
  return { key, mimeType: contentType, fileName: file.name };
}
