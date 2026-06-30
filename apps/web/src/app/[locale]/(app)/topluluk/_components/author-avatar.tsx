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

export function AuthorAvatar({ name, size = 36 }: { name: string; size?: number }) {
  const bg = colorFor(name || "?");
  const fontSize = size <= 28 ? 10 : size <= 36 ? 12 : 14;
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
