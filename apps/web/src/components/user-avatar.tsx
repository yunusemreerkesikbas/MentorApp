import { resolveAvatarUrl } from "@/lib/avatar";

const AVATAR_COLORS = ["#BEA1FE", "#9BC1FB", "#BDEBFF", "#DDACE5", "#D6DBFD"];

function colorFor(name: string): string {
  const value = name.split("").reduce((total, character) => total + character.charCodeAt(0), 0);
  return AVATAR_COLORS[value % AVATAR_COLORS.length]!;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0]}${parts.at(-1)![0]}`.toUpperCase();
}

export interface UserAvatarProps {
  alt?: string;
  className?: string;
  frame?: "default" | "strong";
  name: string;
  size?: number;
  src?: string | null;
}

/** Shared user identity avatar. Content and attachment thumbnails must not use this component. */
export function UserAvatar({ alt = "", className = "", frame = "default", name, size = 36, src }: UserAvatarProps) {
  const resolvedSrc = resolveAvatarUrl(src ?? null);
  const frameClass =
    frame === "strong"
      ? "ring-4 ring-white outline outline-1 outline-offset-4 outline-black/20"
      : "ring-1 ring-black/15";
  const sharedClass = `flex shrink-0 rounded-full object-cover ${frameClass} ${className}`;
  const style = { width: size, height: size, minWidth: size };

  if (resolvedSrc) {
    return (
      // Public/signed R2 URLs are not constrained to Next Image remote patterns.
      // eslint-disable-next-line @next/next/no-img-element
      <img src={resolvedSrc} alt={alt} className={sharedClass} decoding="async" style={style} />
    );
  }

  return (
    <span
      aria-hidden="true"
      className={`${sharedClass} items-center justify-center font-bold`}
      style={{ ...style, backgroundColor: colorFor(name || "?"), color: "var(--color-main)", fontSize: Math.max(10, Math.round(size * 0.36)) }}
    >
      {initials(name || "?")}
    </span>
  );
}
