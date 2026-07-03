import type { AvatarUploadUrlDto } from "@mentor/types";
import { http } from "@mentor/api-client";
import { resolveApiUrl } from "./api-base";

export async function createAvatarUploadUrl(
  contentType: "image/jpeg" | "image/png",
): Promise<AvatarUploadUrlDto> {
  return (await http<AvatarUploadUrlDto>("/v1/users/me/avatar-upload-url", {
    method: "POST",
    body: JSON.stringify({ contentType }),
  })) as AvatarUploadUrlDto;
}

export async function putAvatarToSignedUrl(
  uploadUrl: string,
  file: File,
  contentType: string,
): Promise<void> {
  const res = await fetch(resolveApiUrl(uploadUrl), {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: file,
  });
  if (!res.ok) {
    throw new Error("Avatar upload failed.");
  }
}

export function resolveAvatarUrl(url: string | null): string | null {
  return url ? resolveApiUrl(url) : null;
}
