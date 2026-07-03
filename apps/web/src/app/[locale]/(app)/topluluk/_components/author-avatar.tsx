import { resolveAvatarUrl } from "@/lib/avatar";

const COLORS = ["#BEA1FE", "#9BC1FB", "#BDEBFF", "#DDACE5", "#D6DBFD"];

function colorFor(name: string): string {
  const n = name.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return COLORS[n % COLORS.length]!;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) return "?";
  return (parts[0][0]! + (parts[1]?.[0] ?? "")).toUpperCase();
}

export function AuthorAvatar({
  name,
  size = 36,
  src,
}: {
  name: string;
  size?: number;
  src?: string | null;
}) {
  const resolvedSrc = resolveAvatarUrl(src ?? null);
  if (resolvedSrc) {
    return (
      // ponytail: forum avatars can be fake/R2 object URLs; plain img avoids next/image config.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={resolvedSrc}
        alt=""
        className="flex-shrink-0 rounded-full object-cover"
        style={{ width: size, height: size, minWidth: size }}
        aria-hidden="true"
      />
    );
  }

  const bg = colorFor(name || "?");
  const fontSize = Math.max(10, Math.round(size * 0.36));
  return (
    <span
      className="flex flex-shrink-0 items-center justify-center rounded-full font-bold"
      style={{
        width: size,
        height: size,
        minWidth: size,
        background: bg,
        color: "var(--color-main)",
        fontSize,
      }}
      aria-hidden="true"
    >
      {initials(name || "?")}
    </span>
  );
}
