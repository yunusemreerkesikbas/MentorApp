export const AVATAR_ALLOWED_MIME = new Set(["image/jpeg", "image/png"]);
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;

export function extensionForAvatarMime(mime: string): "jpg" | "png" {
  return mime === "image/png" ? "png" : "jpg";
}

export function isValidAvatarStorageKey(userId: string, key: string): boolean {
  const escapedUserId = userId.replace(/-/g, "\\-");
  return new RegExp(
    `^avatars/${escapedUserId}/[0-9a-f-]+\\.(jpg|jpeg|png)$`,
    "i",
  ).test(key);
}
