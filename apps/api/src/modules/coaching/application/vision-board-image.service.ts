import { randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import type { VisionBoardImageUploadUrlDto } from "@mentor/types";
import {
  VISION_BOARD_IMAGE_MAX_BYTES,
  VISION_BOARD_IMAGE_MIMES,
} from "@mentor/validation";
import { STORAGE_PORT, type StoragePort } from "../../../shared/ports/storage.port";

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/**
 * Presigned direct-to-R2 upload for one vision-board photo — same two-step shape as the mock-exam
 * and forum uploaders (`POST` for the URL, client `PUT`s the bytes).
 *
 * The key is user-scoped, and that scoping is the whole security story: `VisionService.putBoard`
 * refuses any `storageKey` outside `vision-board/{userId}/`, so an object nobody can name under
 * this user's prefix can never enter their board. Keep the two in step.
 */
@Injectable()
export class VisionBoardImageService {
  constructor(@Inject(STORAGE_PORT) private readonly storage: StoragePort) {}

  async createUploadUrl(
    userId: string,
    contentType: (typeof VISION_BOARD_IMAGE_MIMES)[number],
  ): Promise<VisionBoardImageUploadUrlDto> {
    const key = `vision-board/${userId}/${randomUUID()}.${EXTENSIONS[contentType]}`;
    const result = await this.storage.createUploadUrl({ key, contentType });
    return {
      uploadUrl: result.url,
      key: result.key,
      expiresAt: result.expiresAt,
      // Advisory: R2's presigned PUT does not enforce a size, so the client checks before
      // uploading and `putBoard` is the real gate on what ends up referenced.
      maxBytes: VISION_BOARD_IMAGE_MAX_BYTES,
    };
  }
}
