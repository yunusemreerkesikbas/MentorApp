import type { VisionBoardImageUploadUrlDto } from "@mentor/types";
import {
  VISION_BOARD_IMAGE_MAX_BYTES,
  VISION_BOARD_IMAGE_MIMES,
} from "@mentor/validation";
import { http } from "@mentor/api-client";
import { resolveApiUrl } from "./api-base";

/**
 * Two-step board photo upload: ask the API for a presigned URL, then PUT the bytes straight to
 * storage. Same shape as `forum-attachments.ts` and `mock-exams.ts` — the API never proxies image
 * bytes.
 */

export type VisionBoardImageMime = (typeof VISION_BOARD_IMAGE_MIMES)[number];

export function isSupportedBoardImage(file: File): file is File & { type: VisionBoardImageMime } {
  return (VISION_BOARD_IMAGE_MIMES as readonly string[]).includes(file.type);
}

export function isWithinBoardImageLimit(file: File): boolean {
  return file.size <= VISION_BOARD_IMAGE_MAX_BYTES;
}

async function createUploadUrl(
  contentType: VisionBoardImageMime,
): Promise<VisionBoardImageUploadUrlDto> {
  return (await http<VisionBoardImageUploadUrlDto>(
    "/v1/coaching/vision/board/image-upload-url",
    { method: "POST", body: JSON.stringify({ contentType }) },
  )) as VisionBoardImageUploadUrlDto;
}

/** Natural aspect ratio, so a fresh item can keep the photo's proportions instead of a fixed box. */
async function readAspectRatio(file: File): Promise<number | undefined> {
  try {
    const bitmap = await createImageBitmap(file);
    const ratio = bitmap.width / bitmap.height;
    bitmap.close();
    return Number.isFinite(ratio) && ratio > 0 ? ratio : undefined;
  } catch {
    return undefined;
  }
}

export interface UploadedBoardImage {
  key: string;
  url: string;
  aspectRatio?: number;
}

export async function uploadBoardImage(file: File): Promise<UploadedBoardImage> {
  const contentType = file.type as VisionBoardImageMime;
  const [{ uploadUrl, key }, aspectRatio] = await Promise.all([
    createUploadUrl(contentType),
    readAspectRatio(file),
  ]);

  const res = await fetch(resolveApiUrl(uploadUrl), {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: file,
  });
  if (!res.ok) throw new Error("vision_board_image_upload_failed");

  /*
   * A local blob URL, not the eventual storage URL: it renders instantly with no round-trip, and
   * it is same-origin so a canvas export taken before the next reload is never tainted. The server
   * replaces it with the real URL on the next read — the item stores only the key either way.
   */
  return { key, url: URL.createObjectURL(file), aspectRatio };
}
