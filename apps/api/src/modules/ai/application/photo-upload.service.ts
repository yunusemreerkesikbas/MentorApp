import { randomUUID } from "node:crypto";
import { HttpStatus, Inject, Injectable } from "@nestjs/common";
import type { PhotoUploadUrlDto } from "@mentor/types";
import { DomainError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";
import { STORAGE_PORT, type StoragePort } from "../../../shared/ports/storage.port";
import {
  PHOTO_ALLOWED_MIME,
  PHOTO_MAX_BYTES,
} from "../domain/photo-classify.constants";
import { PhotoAccessService } from "./photo-access.service";

function extensionForMime(mime: string): string {
  if (mime === "image/png") return "png";
  if (mime === "image/jpeg") return "jpg";
  return "jpg";
}

/** Validates storage keys are user-scoped: mock-exams/{userId}/{uuid}.ext */
export function isValidPhotoStorageKey(userId: string, key: string): boolean {
  const pattern = new RegExp(
    `^mock-exams/${userId.replace(/-/g, "\\-")}/[0-9a-f-]+\\.(jpg|jpeg|png)$`,
    "i",
  );
  return pattern.test(key);
}

/**
 * Signed upload URL for mock-exam question photos (R2 or fake storage).
 */
@Injectable()
export class PhotoUploadService {
  constructor(
    @Inject(STORAGE_PORT) private readonly storage: StoragePort,
    private readonly photoAccess: PhotoAccessService,
  ) {}

  async createUploadUrl(
    userId: string,
    rolesHint: string[] | undefined,
    contentType: string,
  ): Promise<PhotoUploadUrlDto> {
    await this.photoAccess.assertCanCategorize(userId, rolesHint);

    if (!PHOTO_ALLOWED_MIME.has(contentType)) {
      throw new DomainError(ErrorCode.AI_PHOTO_INVALID_IMAGE, HttpStatus.BAD_REQUEST);
    }
    const ext = extensionForMime(contentType);
    const key = `mock-exams/${userId}/${randomUUID()}.${ext}`;
    const result = await this.storage.createUploadUrl({ key, contentType });
    return {
      uploadUrl: result.url,
      key: result.key,
      expiresAt: result.expiresAt,
      maxBytes: PHOTO_MAX_BYTES,
    };
  }
}
