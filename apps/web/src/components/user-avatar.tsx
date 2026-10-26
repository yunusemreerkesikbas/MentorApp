import { resolveAvatarUrl } from "@/lib/avatar";

export interface UserAvatarProps {
  alt?: string;
  className?: string;
  frame?: "default" | "strong";
  /** Kept on the API for callers; the no-photo fallback is a neutral silhouette, not initials. */
  name: string;
  size?: number;
  src?: string | null;
  /** The photo failed to load (a broken or expired URL); the caller can fall back to the silhouette. */
  onError?: () => void;
}

/** Shared user identity avatar. Content and attachment thumbnails must not use this component. */
export function UserAvatar({ alt = "", className = "", frame = "default", size = 36, src, onError }: UserAvatarProps) {
  const resolvedSrc = resolveAvatarUrl(src ?? null);
  const frameClass =
    frame === "strong"
      ? "ring-4 ring-white outline outline-1 outline-offset-4 outline-black/20"
      : "ring-1 ring-[color-mix(in_srgb,var(--color-main)_16%,transparent)]";
  const sharedClass = `flex shrink-0 rounded-full object-cover ${frameClass} ${className}`;
  const style = { width: size, height: size, minWidth: size };

  if (resolvedSrc) {
    return (
      // Public/signed R2 URLs are not constrained to Next Image remote patterns.
      // eslint-disable-next-line @next/next/no-img-element
      <img src={resolvedSrc} alt={alt} className={sharedClass} decoding="async" style={style} onError={onError} />
    );
  }

  // Default avatar: head + shoulders silhouette in theme tokens, so it follows dark mode.
  return (
    <span
      aria-hidden="true"
      className={`${sharedClass} overflow-hidden`}
      style={{ ...style, backgroundColor: "var(--color-surface-container)" }}
    >
      <svg
        viewBox="0 0 100 100"
        className="size-full"
        style={{ color: "color-mix(in srgb, var(--color-secondary) 38%, var(--color-surface-container))" }}
      >
        <circle cx="50" cy="39" r="21" fill="currentColor" />
        <circle cx="50" cy="98" r="32" fill="currentColor" />
      </svg>
    </span>
  );
}
