import { http } from "@mentor/api-client";
import type { AvatarUploadUrlDto } from "@mentor/types";
import { devicePhotoSize, putDevicePhoto, type DevicePhoto } from "./device-photo.js";
import { getApiBaseUrl } from "./env.js";

/** Picker-side checks, before any upload (the server repeats them). */
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
export const AVATAR_TYPES = new Set(["image/jpeg", "image/png"]);

export class AvatarUploadError extends Error {
  constructor(readonly reason: "too_big" | "upload") {
    super(reason);
  }
}

/** Uploads a picked photo to a fresh avatar slot and resolves its storage key for `PATCH /users/me`. */
export async function uploadAvatar(photo: DevicePhoto): Promise<string> {
  const upload = (await http<AvatarUploadUrlDto>("/v1/users/me/avatar-upload-url", {
    method: "POST",
    body: JSON.stringify({ contentType: photo.mimeType }),
  })) as AvatarUploadUrlDto;
  if (devicePhotoSize(photo) > upload.maxBytes) throw new AvatarUploadError("too_big");
  if (!(await putDevicePhoto(new URL(upload.uploadUrl, getApiBaseUrl()).toString(), photo))) {
    throw new AvatarUploadError("upload");
  }
  return upload.key;
}
