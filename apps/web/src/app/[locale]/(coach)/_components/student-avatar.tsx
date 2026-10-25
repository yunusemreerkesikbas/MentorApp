import { UserAvatar } from "@/components/user-avatar";

/** "Zeynep Kaya" → "ZK", upper-cased the Turkish way so "i" becomes "İ". */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const letters = parts.length === 1 ? parts[0]!.slice(0, 2) : `${parts[0]![0]}${parts.at(-1)![0]}`;
  return letters.toLocaleUpperCase("tr");
}

/**
 * A student on the coach's surface: their own photo when they set one, otherwise the shared
 * default silhouette (2026-10-25: no-photo avatars are the same everywhere).
 */
export function StudentAvatar({
  name,
  src,
  size = 40,
}: {
  name: string;
  src: string | null;
  size?: 32 | 40 | 56;
}) {
  return <UserAvatar name={name} src={src} size={size} />;
}
