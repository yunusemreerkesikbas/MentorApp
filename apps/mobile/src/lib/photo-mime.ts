const BY_EXTENSION: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };
const ALIASES: Record<string, string> = { "image/jpg": "image/jpeg", "image/pjpeg": "image/jpeg", "image/x-png": "image/png" };

/**
 * The picker's MIME type, or the file's extension when Android leaves it out or reports an alias
 * (a valid PNG from the gallery was read as unsupported). `null` when neither names an image.
 */
export function photoMimeType(reported: string | null | undefined, uri: string): string | null {
  const type = reported?.toLowerCase().trim();
  if (type && BY_EXTENSION[type.split("/")[1] ?? ""] === type) return type;
  if (type && ALIASES[type]) return ALIASES[type];
  const extension = uri.split(/[?#]/)[0]!.split(".").pop()?.toLowerCase() ?? "";
  return BY_EXTENSION[extension] ?? null;
}
