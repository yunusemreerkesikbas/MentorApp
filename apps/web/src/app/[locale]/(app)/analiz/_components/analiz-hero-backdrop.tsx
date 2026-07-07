/**
 * Soft pastel blob backdrop for Gelişim tab — CSS fallback when PNG assets are absent.
 */
export function AnalizHeroBackdrop({ className = "" }: { className?: string }) {
  return (
    <div
      className={`pointer-events-none absolute inset-0 overflow-hidden rounded-[var(--radius-card)] ${className}`}
      aria-hidden
    >
      <div
        className="absolute -right-8 -top-12 h-40 w-40 rounded-full blur-3xl"
        style={{ background: "color-mix(in srgb, #9BC1FB 55%, transparent)" }}
      />
      <div
        className="absolute -bottom-10 left-4 h-36 w-36 rounded-full blur-3xl"
        style={{ background: "color-mix(in srgb, #BDEBFF 50%, transparent)" }}
      />
      <div
        className="absolute right-1/3 top-1/2 h-28 w-28 rounded-full blur-3xl"
        style={{ background: "color-mix(in srgb, #FF2DAB 25%, transparent)" }}
      />
    </div>
  );
}
