import { UserAvatar } from "@/components/user-avatar";

/** "Zeynep Kaya" → "ZK", upper-cased the Turkish way so "i" becomes "İ". */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const letters = parts.length === 1 ? parts[0]!.slice(0, 2) : `${parts[0]![0]}${parts.at(-1)![0]}`;
  return letters.toLocaleUpperCase("tr");
}

/**
 * A student on the coach's surface: their own photo when they set one, otherwise initials in the
 * coach's soft ink, the same well the round's waiting nodes use (DESIGN.md §2.5).
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
  if (src) return <UserAvatar name={name} src={src} size={size} />;
  const text = size === 56 ? "text-lg" : size === 40 ? "text-sm" : "text-xs";
  return (
    <span
      aria-hidden
      className={`grid shrink-0 place-items-center rounded-full bg-[var(--coach-accent-soft)] font-black text-[var(--coach-accent-ink)] ${size === 56 ? "size-14" : size === 40 ? "size-10" : "size-8"} ${text}`}
    >
      {initialsOf(name)}
    </span>
  );
}
