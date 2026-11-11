import { interpolate, useCurrentFrame } from "remotion";

// A full-screen colour flash: up to full by `at` + 2, gone by `at` + 12.
export function Flash({ at = 0, color = "#FFFFFF" }: { at?: number; color?: string }) {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [at, at + 2, at + 4, at + 12], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return opacity > 0 ? <div style={{ position: "absolute", inset: 0, background: color, opacity }} /> : null;
}
