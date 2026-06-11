"use client";

/**
 * Decorative pastel gradient blobs (DESIGN.md §2.2, node 17:3036):
 * large, heavily blurred, low-opacity shapes layered over the white base —
 * they create Nuton's soft tint. Pointer-events off; purely visual.
 */
export function BackgroundBlobs() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div
        className="absolute -top-24 -left-24 h-96 w-96 rounded-full opacity-40 blur-[150px]"
        style={{ backgroundColor: "#FF2DAB" }}
      />
      <div
        className="absolute top-1/3 -right-32 h-[28rem] w-[28rem] rounded-full opacity-60 blur-[150px]"
        style={{ backgroundColor: "#9BC1FB" }}
      />
      <div
        className="absolute -bottom-32 left-1/4 h-96 w-96 rounded-full opacity-60 blur-[150px]"
        style={{ backgroundColor: "#BDEBFF" }}
      />
    </div>
  );
}
