import { spring } from "remotion";

// Energetic, snappy spring: ~20% overshoot, settled by frame 14 at 30 fps (test/motion.test.ts).
export const SNAPPY = { damping: 10, stiffness: 260, mass: 0.5 } as const;
// Stiffer and more damped: a stamp lands hard and stops.
const STAMP = { damping: 15, stiffness: 420, mass: 0.5 } as const;

const local = (frame: number, at: number) => frame - at;

// Scale 0 → 1 with overshoot. 0 before `at`.
export function pop(frame: number, fps: number, at: number): number {
  const t = local(frame, at);
  return t < 0 ? 0 : spring({ frame: t, fps, config: SNAPPY });
}

// Scale from 1.8 down to 1, landing like a stamp. 0 before `at`.
export function slam(frame: number, fps: number, at: number): number {
  const t = local(frame, at);
  return t < 0 ? 0 : spring({ frame: t, fps, config: STAMP, from: 1.8, to: 1 });
}

// translateY from `distance` to 0 with an overshoot past 0.
export function slideUp(frame: number, fps: number, at: number, distance: number): number {
  const t = local(frame, at);
  return t < 0 ? distance : spring({ frame: t, fps, config: SNAPPY, from: distance, to: 0 });
}

// Rotation in degrees: a quick wobble that dies out within 12 frames.
export function shake(frame: number, at: number): number {
  const t = local(frame, at);
  if (t < 0 || t >= 12) return 0;
  return 9 * (1 - t / 12) * Math.sin((t * Math.PI) / 2);
}

// How many beats have landed by this frame (R2's seat counter).
export const countAt = (frame: number, beats: readonly number[]): number => beats.filter((b) => frame >= b).length;
