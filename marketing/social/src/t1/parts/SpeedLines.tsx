import { interpolate, useCurrentFrame } from "remotion";

// White streaks rushing out from (cx, cy) % while the camera dives, from `at` for `frames` frames.
export function SpeedLines({ at, frames, cx = 50, cy = 75 }: { at: number; frames: number; cx?: number; cy?: number }) {
  const frame = useCurrentFrame();
  const t = interpolate(frame, [at, at + frames], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  if (t <= 0) return null;
  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        opacity: Math.min(1, t * 3),
        background: `repeating-conic-gradient(from ${t * 40}deg at ${cx}% ${cy}%, rgba(255, 255, 255, 0.85) 0deg 1.2deg, rgba(255, 255, 255, 0) 1.2deg 9deg)`,
        maskImage: `radial-gradient(circle at ${cx}% ${cy}%, transparent ${30 - t * 22}%, black ${60 - t * 20}%)`,
      }}
    />
  );
}
