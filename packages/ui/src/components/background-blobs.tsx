"use client";

/**
 * Decorative pastel gradient blobs (DESIGN.md §2.2, node 17:3036):
 * large, heavily blurred, low-opacity shapes layered over the white base —
 * they create Nuton's soft tint. Pointer-events off; purely visual.
 *
 * Optional ambient drift (DESIGN.md §9) — transform/opacity only; disabled
 * when `prefers-reduced-motion: reduce`.
 */
export function BackgroundBlobs({ drift = true }: { drift?: boolean } = {}) {
  const driftClass = drift ? "mentor-blob-drift" : undefined;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      <div
        className={`absolute -top-24 -left-24 h-96 w-96 rounded-full blur-[150px] ${driftClass ?? ""}`}
        style={{
          backgroundColor: "var(--blob-pink)",
          opacity: "var(--blob-pink-opacity)",
          animationDelay: "0s",
        }}
      />
      <div
        className={`absolute top-1/3 -right-32 h-[28rem] w-[28rem] rounded-full blur-[150px] ${driftClass ?? ""}`}
        style={{
          backgroundColor: "var(--blob-blue)",
          opacity: "var(--blob-blue-opacity)",
          animationDelay: "-8s",
        }}
      />
      <div
        className={`absolute -bottom-32 left-1/4 h-96 w-96 rounded-full blur-[150px] ${driftClass ?? ""}`}
        style={{
          backgroundColor: "var(--blob-cyan)",
          opacity: "var(--blob-cyan-opacity)",
          animationDelay: "-16s",
        }}
      />
    </div>
  );
}
